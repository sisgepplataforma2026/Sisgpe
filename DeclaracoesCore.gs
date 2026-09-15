// ============================================================================
// ARQUIVO: DeclaracoesCore.gs
// MÓDULO: Documentos › Declarações — integração com Governança e base comum
// ============================================================================
//
// POR QUE ESTE ARQUIVO EXISTE
//
// A declaração de liberação sindical (art. 543 da CLT) era feita em Word, um
// arquivo por vez, com o texto jurídico à mão. O risco não é o trabalho: é
// alguém alterar sem querer a citação do artigo, ou emitir declaração para
// quem já não está no mandato.
//
// DECISÃO: DECLARAÇÃO NÃO É OFÍCIO, E NÃO É RECIBO (15/09/2026)
//
// Foi avaliado encaixar como um tipo novo em `normalizarTipoOficio_`
// (HelperOficios.gs:32) e descartado com motivo concreto:
//
//   • ofício tem escola destinatária, numeração própria, fila de envio e
//     rastreio de leitura — a declaração não tem nada disso;
//   • Ofícios é a ÚNICA operação em uso diário do sindicato. Mexer no
//     arquivo que a Marcela usa todo dia para acrescentar um documento que
//     não é ofício é risco sem contrapartida.
//
// Por isso Declarações nasceu como terceira subcamada de Documentos, ao lado
// de Ofícios e Recibos, sem tocar em nenhum dos dois.
//
// DECISÃO: CADASTRO PRÓPRIO DE DIRETORIA, SEPARADO DE VERBAS_DIRETORIA
//
// Já existe `VERBAS_DIRETORIA` (VerbasDiretoria.gs), com nome, CPF e cargo de
// parte da diretoria. Ele NÃO foi reaproveitado como fonte, e a razão é que
// os dois cadastros respondem perguntas diferentes:
//
//     VERBAS_DIRETORIA  → quem RECEBE gratificação (dinheiro)
//     DIRETORIA         → quem TEM MANDATO (representação)
//
// Nem todo diretor recebe gratificação, e mandato tem início e fim, que a
// verba não guarda. Misturar os dois faria a declaração depender de uma
// planilha financeira — e faria alteração de valor de gratificação mexer em
// documento jurídico.
//
// A digitação dupla foi resolvida sem acoplar: `declImportarDeVerbas` traz os
// diretores de lá numa lista para conferência, e só grava o que a pessoa
// confirmar. É importação única, não sincronização contínua.
//
// QUEM ASSINA
//
// O signatário sai do próprio cadastro, do diretor marcado em
// ASSINA_COMO_PRESIDENTE — não de constante no código. Troca de presidente é
// marcação de caixa, não alteração de arquivo. Só um pode estar marcado por
// vez, e a trava está em `declSalvarDiretor`.
// ============================================================================

/* A aba DIRETORIA é legada. Continua disponível somente para preservar a
 * resolução de documentos antigos; novas emissões usam GOV_COMPOSICAO e
 * GOV_GESTOES como fonte institucional única. */
var ABA_DIRETORIA = "DIRETORIA";

var DECL_COLUNAS_DIRETORIA = [
  "ID", "NOME", "CPF", "CARGO",
  "MANDATO_INICIO", "MANDATO_FIM",
  "ASSINA_COMO_PRESIDENTE", "ATIVO", "OBSERVACAO",
  "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
];

/* =========================================
 * PLANILHA
 * ========================================= */

function declPlanilha_() {
  var id = (typeof getPlanilhaId === "function") ? getPlanilhaId() : PLANILHA_ID;
  return SpreadsheetApp.openById(id);
}

function declGarantirDiretoria_() {
  var ss = declPlanilha_();
  var sh = ss.getSheetByName(ABA_DIRETORIA);
  if (!sh) sh = ss.insertSheet(ABA_DIRETORIA);
  if (sh.getLastRow() === 0) {
    sh.appendRow(DECL_COLUNAS_DIRETORIA);
    sh.getRange(1, 1, 1, DECL_COLUNAS_DIRETORIA.length)
      .setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Mapa CABEÇALHO → número da coluna. Lê o cabeçalho real, não a posição. */
function declCabecalho_(sh) {
  var mapa = {};
  if (!sh || sh.getLastColumn() < 1) return mapa;
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cab.forEach(function (c, i) {
    var chave = String(c || "").trim().toUpperCase();
    if (chave) mapa[chave] = i + 1;
  });
  return mapa;
}

/* =========================================
 * HELPERS DE DATA
 *
 * Data digitada chega como "18/09/2026" da tela e como Date da planilha.
 * Os dois caminhos passam por aqui para o resto do módulo só ver Date.
 * ========================================= */

var DECL_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

function declParaData_(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  var s = String(v).trim();
  if (!s) return null;

  var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** "18 de setembro de 2026" — o formato que o modelo em papel usa. */
function declDataExtenso_(v) {
  var d = declParaData_(v);
  if (!d) return "";
  return d.getDate() + " de " + DECL_MESES[d.getMonth()] + " de " + d.getFullYear();
}

function declDataBR_(v) {
  var d = declParaData_(v);
  if (!d) return "";
  var dd = ("0" + d.getDate()).slice(-2);
  var mm = ("0" + (d.getMonth() + 1)).slice(-2);
  return dd + "/" + mm + "/" + d.getFullYear();
}

/** Zera hora — comparação de mandato é por dia, não por instante. */
function declSoData_(v) {
  var d = declParaData_(v);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function declHoje_() {
  var agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function declSim_(v) {
  if (v === true) return true;
  var s = String(v == null ? "" : v).trim().toUpperCase();
  return s === "SIM" || s === "TRUE" || s === "VERDADEIRO" || s === "X";
}

/** ATIVO em branco conta como ativo — cadastro antigo não fica invisível. */
function declAtivo_(v) {
  if (v === false) return false;
  var s = String(v == null ? "" : v).trim().toUpperCase();
  if (!s) return true;
  return s !== "NAO" && s !== "NÃO" && s !== "FALSE" && s !== "INATIVO";
}

function declTexto_(v) {
  return String(v == null ? "" : v).trim();
}

function declQuem_(sessao) {
  sessao = sessao || {};
  return sessao.nome || sessao.usuario || sessao.email || "SISGEP";
}

/* =========================================
 * LEITURA DA DIRETORIA
 * ========================================= */

function declListarDiretoriaLegada_() {
  var sh = declGarantirDiretoria_();
  if (sh.getLastRow() < 2) return [];

  var mapa = declCabecalho_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var hoje = declHoje_();

  function col(linha, nome) {
    return mapa[nome] ? linha[mapa[nome] - 1] : "";
  }

  return dados.map(function (l) {
    var inicio = declSoData_(col(l, "MANDATO_INICIO"));
    var fim    = declSoData_(col(l, "MANDATO_FIM"));

    /* Mandato sem data não impede emissão — impede é mandato VENCIDO.
       Cadastro incompleto é problema de cadastro, não motivo para travar
       a secretaria no meio do expediente. */
    var vigente = true;
    if (inicio && hoje < inicio) vigente = false;
    if (fim && hoje > fim) vigente = false;

    return {
      id:              declTexto_(col(l, "ID")),
      nome:            declTexto_(col(l, "NOME")),
      cpf:             declTexto_(col(l, "CPF")),
      cargo:           declTexto_(col(l, "CARGO")),
      mandatoInicio:   declDataBR_(col(l, "MANDATO_INICIO")),
      mandatoFim:      declDataBR_(col(l, "MANDATO_FIM")),
      assinaComoPresidente: declSim_(col(l, "ASSINA_COMO_PRESIDENTE")),
      ativo:           declAtivo_(col(l, "ATIVO")),
      observacao:      declTexto_(col(l, "OBSERVACAO")),
      mandatoVigente:  vigente
    };
  }).filter(function (d) { return !!d.id; });
}

/** Composição institucional vigente — fonte única das novas emissões. */
function declListarDiretoria_interno_() {
  if (typeof GOV_COMPOSICAO === "undefined" || typeof GOV_MANDATO === "undefined") {
    throw new Error("O módulo Governança não está disponível.");
  }

  var hoje = declHoje_();
  var inicio = declSoData_(GOV_MANDATO.posse);
  var fim = declSoData_(GOV_MANDATO.termino);
  var vigente = (!inicio || hoje >= inicio) && (!fim || hoje <= fim) && GOV_MANDATO.atual !== false;

  return GOV_COMPOSICAO.map(function (p) {
    var id = ["GOV", p.orgao, p.condicao, p.ordem].join("-");
    return {
      id: id,
      nome: declTexto_(p.nome).toUpperCase(),
      cpf: "",
      cargo: declTexto_(p.cargo),
      orgao: declTexto_(p.orgao),
      condicao: declTexto_(p.condicao),
      gestao: declTexto_(GOV_MANDATO.gestao),
      mandatoInicio: declDataBR_(GOV_MANDATO.posse),
      mandatoFim: declDataBR_(GOV_MANDATO.termino),
      assinaComoPresidente: p.orgao === "DIRETORIA_EXECUTIVA" &&
        p.condicao === "EFETIVO" && declChaveNome_(p.cargo) === "PRESIDENTE",
      ativo: vigente,
      observacao: "Fonte: Governança",
      mandatoVigente: vigente,
      fonte: "GOVERNANCA"
    };
  });
}

/** Quem pode receber declaração hoje: ativo E com mandato vigente. */
function declDiretoresHabilitados_() {
  return declListarDiretoria_interno_().filter(function (d) {
    return d.ativo && d.mandatoVigente;
  });
}

/**
 * Quem assina. Único lugar do módulo que decide isso.
 * Devolve null quando ninguém está marcado — e quem chama precisa tratar,
 * porque declaração sem assinatura não vale nada.
 */
function declSignatario_() {
  var marcados = declListarDiretoria_interno_().filter(function (d) {
    return d.assinaComoPresidente && d.ativo && d.mandatoVigente;
  });
  return marcados.length ? marcados[0] : null;
}

function declDiretorPorId_(id) {
  id = declTexto_(id);
  if (!id) return null;
  var achados = declListarDiretoria_interno_().filter(function (d) { return d.id === id; });
  if (achados.length) return achados[0];
  /* Compatibilidade: permite abrir/reemitir registros antigos sem recolocar a
     aba legada como fonte das novas listas. */
  var antigos = declListarDiretoriaLegada_().filter(function (d) { return d.id === id; });
  return antigos.length ? antigos[0] : null;
}

/* =========================================
 * ENDPOINTS — CADASTRO DA DIRETORIA
 * ========================================= */

function declListarDiretoria(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var diretores = declListarDiretoria_interno_();
    var signatario = declSignatario_();
    return {
      ok: true,
      diretores: diretores,
      signatario: signatario ? signatario.nome : "",
      resumo: {
        ativos:        diretores.filter(function (d) { return d.ativo; }).length,
        inativos:      diretores.filter(function (d) { return !d.ativo; }).length,
        mandatoVencido: diretores.filter(function (d) { return d.ativo && !d.mandatoVigente; }).length
      }
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar a diretoria: " + e.message, diretores: [] };
  }
}

/**
 * Cria ou atualiza um diretor. ID vazio = novo.
 *
 * A trava do signatário está aqui: marcar alguém como quem assina DESMARCA
 * todos os outros na mesma transação. Duas assinaturas válidas ao mesmo
 * tempo produziriam declarações assinadas por pessoas diferentes no mesmo
 * dia, sem ninguém perceber.
 */
function declSalvarDiretor(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  return { ok: false, mensagem: "A Diretoria é mantida exclusivamente em Governança. Nenhuma alteração foi realizada." };
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) {
      return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    }

    dados = dados || {};
    var nome = declTexto_(dados.nome).toUpperCase();
    if (!nome) return { ok: false, mensagem: "Informe o nome do diretor." };

    var cargo = declTexto_(dados.cargo);
    if (!cargo) return { ok: false, mensagem: "Informe o cargo do diretor." };

    var inicio = declSoData_(dados.mandatoInicio);
    var fim    = declSoData_(dados.mandatoFim);
    if (dados.mandatoInicio && !inicio) return { ok: false, mensagem: "Data de início do mandato inválida." };
    if (dados.mandatoFim && !fim)       return { ok: false, mensagem: "Data de fim do mandato inválida." };
    if (inicio && fim && fim < inicio)  return { ok: false, mensagem: "O fim do mandato não pode ser anterior ao início." };

    var sh    = declGarantirDiretoria_();
    var mapa  = declCabecalho_(sh);
    var quem  = declQuem_(sessao);
    var agora = new Date();
    var idAlvo = declTexto_(dados.id);
    var assina = dados.assinaComoPresidente === true;

    var campos = {
      NOME: nome,
      CPF: declTexto_(dados.cpf),
      CARGO: cargo,
      MANDATO_INICIO: inicio || "",
      MANDATO_FIM: fim || "",
      ASSINA_COMO_PRESIDENTE: assina,
      ATIVO: dados.ativo === false ? false : true,
      OBSERVACAO: declTexto_(dados.observacao)
    };

    function escrever(linha) {
      Object.keys(campos).forEach(function (k) {
        if (mapa[k]) sh.getRange(linha, mapa[k]).setValue(campos[k]);
      });
      if (mapa["ATUALIZADO_POR"]) sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
      if (mapa["ATUALIZADO_EM"])  sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(agora);
    }

    /* Desmarca os outros ANTES de gravar, para não existir instante com dois
       signatários — mesmo que a gravação seguinte falhe. */
    function desmarcarOutros(linhaExcecao) {
      if (!assina || !mapa["ASSINA_COMO_PRESIDENTE"] || sh.getLastRow() < 2) return;
      var total = sh.getLastRow() - 1;
      var faixa = sh.getRange(2, mapa["ASSINA_COMO_PRESIDENTE"], total, 1);
      var valores = faixa.getValues();
      var mudou = false;
      for (var i = 0; i < valores.length; i++) {
        if ((i + 2) === linhaExcecao) continue;
        if (declSim_(valores[i][0])) { valores[i][0] = false; mudou = true; }
      }
      if (mudou) faixa.setValues(valores);
    }

    if (idAlvo && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, mapa["ID"] || 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (declTexto_(ids[i][0]) === idAlvo) {
          desmarcarOutros(i + 2);
          escrever(i + 2);
          return { ok: true, id: idAlvo, mensagem: "Diretor atualizado." };
        }
      }
      return { ok: false, mensagem: "Diretor não encontrado." };
    }

    var novoId = "DIRET-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var linhaNova = sh.getLastRow() + 1;
    desmarcarOutros(linhaNova);
    sh.getRange(linhaNova, mapa["ID"] || 1).setValue(novoId);
    escrever(linhaNova);
    if (mapa["CRIADO_POR"]) sh.getRange(linhaNova, mapa["CRIADO_POR"]).setValue(quem);
    if (mapa["CRIADO_EM"])  sh.getRange(linhaNova, mapa["CRIADO_EM"]).setValue(agora);

    return { ok: true, id: novoId, mensagem: "Diretor cadastrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (eRel) {}
  }
}

/**
 * Ativa/inativa. NÃO existe exclusão, pelo mesmo motivo de VerbasDiretoria:
 * diretor que já teve declaração emitida precisa continuar existindo para o
 * histórico fazer sentido. Inativar tira das próximas emissões sem apagar o
 * que já foi assinado.
 */
function declAlternarDiretor(id, ativo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  return { ok: false, mensagem: "A situação do mandato é definida em Governança. Nenhuma alteração foi realizada." };
  try {
    id = declTexto_(id);
    if (!id) return { ok: false, mensagem: "Diretor não informado." };

    var sh = declGarantirDiretoria_();
    var mapa = declCabecalho_(sh);
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Diretor não encontrado." };

    var ids = sh.getRange(2, mapa["ID"] || 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (declTexto_(ids[i][0]) !== id) continue;

      var linha = i + 2;
      var virandoInativo = (ativo === false);

      /* Inativar quem assina deixaria o sistema sem signatário e as
         declarações sem assinatura. Recusa com o motivo à vista. */
      if (virandoInativo && mapa["ASSINA_COMO_PRESIDENTE"]) {
        var assinaAtual = declSim_(sh.getRange(linha, mapa["ASSINA_COMO_PRESIDENTE"]).getValue());
        if (assinaAtual) {
          return {
            ok: false,
            mensagem: "Este diretor é quem assina as declarações. Marque outro como signatário antes de inativá-lo."
          };
        }
      }

      sh.getRange(linha, mapa["ATIVO"]).setValue(!virandoInativo);
      if (mapa["ATUALIZADO_POR"]) sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(declQuem_(sessao));
      if (mapa["ATUALIZADO_EM"])  sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(new Date());

      return {
        ok: true,
        mensagem: virandoInativo
          ? "Diretor inativado — não aparece mais na emissão."
          : "Diretor reativado."
      };
    }
    return { ok: false, mensagem: "Diretor não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* =========================================
 * IMPORTAÇÃO A PARTIR DE VERBAS_DIRETORIA
 *
 * Um clique para não redigitar o que o sistema já tem (REGRA Nº 0.6), com a
 * origem à vista e conferência antes de gravar. NÃO é sincronização: depois
 * de importado, os dois cadastros seguem vidas separadas de propósito.
 * ========================================= */

/** Só lê e devolve os candidatos. Não grava nada. */
function declCandidatosDeVerbas(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return { ok: false, candidatos: [], mensagem: "Importação desativada: Verbas da Diretoria não é fonte de mandato." };
  try {
    if (typeof verbListarDiretores_interno_ !== "function") {
      return { ok: true, candidatos: [], mensagem: "O cadastro de gratificações da diretoria não está disponível neste projeto." };
    }

    var jaCadastrados = {};
    declListarDiretoria_interno_().forEach(function (d) {
      jaCadastrados[declChaveNome_(d.nome)] = true;
      if (d.cpf) jaCadastrados[declSoDigitos_(d.cpf)] = true;
    });

    var candidatos = verbListarDiretores_interno_()
      .filter(function (v) { return v.ativo; })
      .map(function (v) {
        var repetido = !!jaCadastrados[declChaveNome_(v.nome)] ||
                       (!!v.cpf && !!jaCadastrados[declSoDigitos_(v.cpf)]);
        return {
          nome: declTexto_(v.nome).toUpperCase(),
          cpf: declTexto_(v.cpf),
          cargo: declTexto_(v.cargo) || "Diretor",
          jaCadastrado: repetido
        };
      });

    return { ok: true, candidatos: candidatos };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ler o cadastro de gratificações: " + e.message, candidatos: [] };
  }
}

function declSoDigitos_(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}

function declChaveNome_(v) {
  return String(v == null ? "" : v).trim().toUpperCase().replace(/\s+/g, " ");
}

/** Grava os confirmados. Repetido é PULADO, não duplicado. */
function declImportarDeVerbas(selecionados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return { ok: false, importados: 0, mensagem: "Importação desativada: a composição oficial vem de Governança." };
  try {
    selecionados = selecionados || [];
    if (!selecionados.length) return { ok: false, mensagem: "Nenhum diretor selecionado." };

    var existentes = {};
    declListarDiretoria_interno_().forEach(function (d) {
      existentes[declChaveNome_(d.nome)] = true;
      if (d.cpf) existentes[declSoDigitos_(d.cpf)] = true;
    });

    var importados = 0, pulados = 0, erros = [];

    selecionados.forEach(function (s) {
      var chaveNome = declChaveNome_(s && s.nome);
      var chaveCpf  = declSoDigitos_(s && s.cpf);
      if (!chaveNome) { pulados++; return; }
      if (existentes[chaveNome] || (chaveCpf && existentes[chaveCpf])) { pulados++; return; }

      var r = declSalvarDiretor({
        nome: s.nome,
        cpf: s.cpf,
        cargo: s.cargo || "Diretor",
        mandatoInicio: s.mandatoInicio || "",
        mandatoFim: s.mandatoFim || "",
        assinaComoPresidente: false,
        ativo: true,
        observacao: "Importado do cadastro de gratificações da diretoria."
      }, tokenSessao);

      if (r && r.ok) {
        importados++;
        existentes[chaveNome] = true;
        if (chaveCpf) existentes[chaveCpf] = true;
      } else {
        erros.push(declTexto_(s.nome) + ": " + (r && r.mensagem));
      }
    });

    return {
      ok: true,
      importados: importados,
      pulados: pulados,
      erros: erros,
      mensagem: importados + " diretor(es) importado(s)." +
                (pulados ? " " + pulados + " já estava(m) no cadastro e foi(ram) pulado(s)." : "") +
                (erros.length ? " " + erros.length + " com erro." : "")
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao importar: " + e.message };
  }
}
