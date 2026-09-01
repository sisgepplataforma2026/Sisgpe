// =========================
// ARQUIVO: VerbasDiretoria.gs
// MÓDULO: Financeiro › Despesas — Gratificação mensal da diretoria
//
// POR QUE ESTE ARQUIVO EXISTE
// As gratificações pagas aos diretores não existiam em lugar nenhum do
// SISGEP: não havia categoria, nem cadastro, nem lançamento. Elas eram
// pagas por fora, o que fazia o total do mês no Controle de Pagamentos
// mostrar menos do que o sindicato realmente desembolsa — justamente o
// número que a diretoria olha.
//
// COMO FUNCIONA
// Um cadastro simples (nome, CPF, cargo, valor da gratificação, dia de
// vencimento) e um botão que gera as despesas do mês. A partir daí elas
// são despesas comuns: entram na fila do Controle de Pagamentos, são
// lançadas no banco, confirmadas e recebem comprovante como qualquer
// outra. Nada de digitação dupla.
//
// 🚨 DECISÃO: DIRETOR NÃO É PRESTADOR DE SERVIÇO
// Seria mais barato reaproveitar o cadastro de Prestadores_Serviços,
// que já tem geração mensal automática. NÃO foi feito — e a razão é
// concreta, não conceitual: existe uma rotina diária (D-5) que envia
// e-mail automático COBRANDO NOTA FISCAL dos prestadores com despesa a
// vencer. Cadastrar diretor como prestador faria o sistema mandar
// "envie sua nota fiscal" para a diretoria do sindicato.
//
// A proteção contra isso é dupla e proposital:
//   1. A despesa nasce com TIPO_DOC = "Sem Documento". A rotina D-5 só
//      cobra quando o tipo é NF ou Cupom Fiscal/Recibo.
//   2. A despesa nasce com PRESTADOR_EMAIL vazio. Mesmo que alguém
//      mude o tipo de documento depois, sem e-mail não há disparo.
// O e-mail do diretor fica guardado só aqui, no cadastro.
//
// 🚨 SEM DESCONTO DE INSS/IRRF — confirmado com o sindicato.
// A gratificação é paga pelo valor cheio. Não há cálculo de retenção
// aqui, e isso é deliberado: modelar imposto "por precaução", sem a
// regra confirmada, produziria valor errado com aparência de certo.
// Se o contador orientar que passa a haver retenção, o lugar de ligar é
// este arquivo, reusando rh_calcularInss_/rh_calcularIrrf_ e as tabelas
// já configuráveis em RH › Config. Tributária.
//
// IDEMPOTÊNCIA — gerar o mesmo mês duas vezes não duplica pagamento.
// Cada geração fica registrada em VERBAS_DIRETORIA_GERADAS (diretor +
// competência + id da despesa). Regerar a competência só cria o que
// falta, e informa o que já existia. Pagar diretor duas vezes é o erro
// caro que isto evita.
// =========================

var ABA_VERBAS_DIRETORIA = "VERBAS_DIRETORIA";
var ABA_VERBAS_GERADAS   = "VERBAS_DIRETORIA_GERADAS";

/* =========================================
 * PLANILHA
 * ========================================= */

function verbGarantirCadastro_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_VERBAS_DIRETORIA);
  if (!sh) sh = ss.insertSheet(ABA_VERBAS_DIRETORIA);
  if (sh.getLastRow() === 0) {
    var cab = [
      "ID", "NOME", "CPF", "CARGO", "EMAIL",
      "VALOR_GRATIFICACAO", "DIA_VENCIMENTO", "ATIVO", "OBSERVACAO",
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ];
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

function verbGarantirGeradas_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_VERBAS_GERADAS);
  if (!sh) {
    sh = ss.insertSheet(ABA_VERBAS_GERADAS);
    var cab = ["ID_DESPESA", "DIRETOR_ID", "DIRETOR_NOME", "COMPETENCIA", "VALOR", "GERADO_POR", "GERADO_EM"];
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/* =========================================
 * HELPERS
 * ========================================= */

function verbNumero_(v) {
  var s = String(v == null ? "" : v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

// Mesma formatação direta usada no Controle de Pagamentos — NÃO usar
// formatarValorDesp_ com número, que descarta o ponto decimal.
function verbValorBR_(n) {
  var v = Number(n || 0);
  if (!isFinite(v)) v = 0;
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function verbCompetenciaValida_(c) {
  return /^\d{4}-\d{2}$/.test(String(c || "").trim());
}

// Vencimento no dia pedido, respeitando mês curto: dia 31 em fevereiro
// vira o último dia do mês em vez de vazar para março.
function verbVencimentoBR_(competencia, dia) {
  var p = String(competencia).split("-");
  var ano = Number(p[0]), mes = Number(p[1]);
  var ultimo = new Date(ano, mes, 0).getDate();
  var d = Math.min(Math.max(1, Number(dia) || 1), ultimo);
  return String(d).padStart(2, "0") + "/" + String(mes).padStart(2, "0") + "/" + ano;
}

function verbCabecalho_(sh) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (n, i) { if (n) mapa[String(n).trim().toUpperCase()] = i + 1; });
  return mapa;
}

/* =========================================
 * CADASTRO
 * ========================================= */

function verbListarDiretores_interno_() {
  var sh = verbGarantirCadastro_();
  if (sh.getLastRow() < 2) return [];
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return dados.map(function (l) {
    return {
      id: String(l[0] || ""), nome: String(l[1] || ""), cpf: String(l[2] || ""),
      cargo: String(l[3] || ""), email: String(l[4] || ""),
      valor: verbNumero_(l[5]), diaVencimento: Number(l[6] || 5),
      ativo: l[7] !== false && String(l[7]).toUpperCase() !== "NAO" && String(l[7]).toUpperCase() !== "NÃO",
      observacao: String(l[8] || "")
    };
  }).filter(function (d) { return !!d.id; });
}

function verbListarDiretores(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    return { ok: true, diretores: verbListarDiretores_interno_() };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar diretores: " + e.message, diretores: [] };
  }
}

/** Cria ou atualiza. ID vazio = novo. */
function verbSalvarDiretor(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    dados = dados || {};
    var nome = String(dados.nome || "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o nome do diretor." };

    var valor = verbNumero_(dados.valor);
    if (!(valor > 0)) return { ok: false, mensagem: "Informe o valor da gratificação." };

    var dia = Number(dados.diaVencimento || 5);
    if (!(dia >= 1 && dia <= 31)) return { ok: false, mensagem: "Dia de vencimento deve ficar entre 1 e 31." };

    var sh = verbGarantirCadastro_();
    var mapa = verbCabecalho_(sh);
    var quem = sessao.nome || sessao.usuario || sessao.email || "SISGEP";
    var agora = new Date();
    var idAlvo = String(dados.id || "").trim();

    var campos = {
      NOME: nome,
      CPF: String(dados.cpf || "").trim(),
      CARGO: String(dados.cargo || "").trim(),
      EMAIL: String(dados.email || "").trim(),
      VALOR_GRATIFICACAO: valor,
      DIA_VENCIMENTO: dia,
      ATIVO: dados.ativo === false ? false : true,
      OBSERVACAO: String(dados.observacao || "").trim()
    };

    function escrever(linha) {
      Object.keys(campos).forEach(function (k) {
        if (mapa[k]) sh.getRange(linha, mapa[k]).setValue(campos[k]);
      });
      if (mapa["ATUALIZADO_POR"]) sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
      if (mapa["ATUALIZADO_EM"])  sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(agora);
    }

    if (idAlvo && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, mapa["ID"] || 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === idAlvo) {
          escrever(i + 2);
          return { ok: true, id: idAlvo, mensagem: "Diretor atualizado. O novo valor vale nas próximas gerações — competências já geradas não mudam sozinhas." };
        }
      }
    }

    var novoId = "DIR-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var linhaNova = sh.getLastRow() + 1;
    sh.getRange(linhaNova, mapa["ID"] || 1).setValue(novoId);
    escrever(linhaNova);
    if (mapa["CRIADO_POR"]) sh.getRange(linhaNova, mapa["CRIADO_POR"]).setValue(quem);
    if (mapa["CRIADO_EM"])  sh.getRange(linhaNova, mapa["CRIADO_EM"]).setValue(agora);
    return { ok: true, id: novoId, mensagem: "Diretor cadastrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/**
 * Ativa/inativa. Não existe exclusão: um diretor que já teve verba
 * gerada precisa continuar existindo para o histórico fazer sentido —
 * inativar tira das próximas gerações sem apagar o passado.
 */
function verbAlternarDiretor(id, ativo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Diretor não informado." };
    var sh = verbGarantirCadastro_();
    var mapa = verbCabecalho_(sh);
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Diretor não encontrado." };
    var ids = sh.getRange(2, mapa["ID"] || 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        sh.getRange(i + 2, mapa["ATIVO"]).setValue(ativo !== false);
        if (mapa["ATUALIZADO_POR"]) sh.getRange(i + 2, mapa["ATUALIZADO_POR"]).setValue(sessao.nome || sessao.usuario || "SISGEP");
        if (mapa["ATUALIZADO_EM"])  sh.getRange(i + 2, mapa["ATUALIZADO_EM"]).setValue(new Date());
        return { ok: true, mensagem: ativo !== false ? "Diretor reativado." : "Diretor inativado — não entra nas próximas gerações." };
      }
    }
    return { ok: false, mensagem: "Diretor não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* =========================================
 * GERAÇÃO DA COMPETÊNCIA
 * ========================================= */

function verbGeradasDaCompetencia_(competencia) {
  var sh = verbGarantirGeradas_();
  if (sh.getLastRow() < 2) return {};
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var mapa = {};
  dados.forEach(function (l) {
    if (String(l[3]) === String(competencia)) mapa[String(l[1])] = { idDespesa: String(l[0]), valor: l[4] };
  });
  return mapa;
}

/** Prévia — mostra quem entra, quanto e o que já foi gerado. Não grava. */
function verbPreviaCompetencia(competencia, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    competencia = String(competencia || "").trim();
    if (!verbCompetenciaValida_(competencia)) return { ok: false, mensagem: "Informe a competência no formato AAAA-MM." };

    var jaGeradas = verbGeradasDaCompetencia_(competencia);
    var itens = verbListarDiretores_interno_()
      .filter(function (d) { return d.ativo; })
      .map(function (d) {
        return {
          id: d.id, nome: d.nome, cargo: d.cargo, valor: d.valor,
          valorFmt: verbValorBR_(d.valor),
          vencimento: verbVencimentoBR_(competencia, d.diaVencimento),
          jaGerado: !!jaGeradas[d.id],
          idDespesa: jaGeradas[d.id] ? jaGeradas[d.id].idDespesa : ""
        };
      });

    var totalNovo = 0, totalGeral = 0;
    itens.forEach(function (i) { totalGeral += i.valor; if (!i.jaGerado) totalNovo += i.valor; });

    return {
      ok: true, competencia: competencia, itens: itens,
      quantidade: itens.length,
      quantidadeNova: itens.filter(function (i) { return !i.jaGerado; }).length,
      totalGeral: Math.round(totalGeral * 100) / 100,
      totalGeralFmt: verbValorBR_(totalGeral),
      totalNovo: Math.round(totalNovo * 100) / 100,
      totalNovoFmt: verbValorBR_(totalNovo)
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar a prévia: " + e.message };
  }
}

/**
 * Gera as despesas do mês. Idempotente: quem já tem verba gerada nesta
 * competência é PULADO, nunca duplicado.
 */
function verbGerarCompetencia(competencia, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var lock = LockService.getScriptLock();
  var resultado;
  try {
    if (!lock.tryLock(25000)) return { ok: false, mensagem: "Outra geração está em andamento. Aguarde alguns segundos." };

    competencia = String(competencia || "").trim();
    if (!verbCompetenciaValida_(competencia)) return { ok: false, mensagem: "Informe a competência no formato AAAA-MM." };

    var jaGeradas = verbGeradasDaCompetencia_(competencia);
    var diretores = verbListarDiretores_interno_().filter(function (d) { return d.ativo && d.valor > 0; });
    if (!diretores.length) return { ok: false, mensagem: "Nenhum diretor ativo com valor de gratificação cadastrado." };

    var pendentes = diretores.filter(function (d) { return !jaGeradas[d.id]; });
    resultado = {
      ok: true, competencia: competencia,
      pendentes: pendentes, jaExistiam: diretores.length - pendentes.length,
      quem: sessao.nome || sessao.usuario || sessao.email || "SISGEP"
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao preparar a geração: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }

  // A criação das despesas acontece FORA do lock acima, de propósito:
  // registrarLancamentoDespesa chama gerarNumeroDespesa_, que pede o
  // próprio LockService. Dentro do nosso lock, esse pedido esperaria por
  // um lock que só sairia quando ele mesmo terminasse — e nenhuma
  // despesa seria criada. Mesmo cuidado de ConciliacaoCore.gs e do RH.
  if (!resultado.pendentes.length) {
    return { ok: true, criadas: 0, jaExistiam: resultado.jaExistiam,
      mensagem: "Todas as verbas de " + competencia + " já tinham sido geradas. Nada foi duplicado." };
  }

  if (typeof registrarLancamentoDespesa !== "function") {
    return { ok: false, mensagem: "O módulo de Despesas não está disponível — verbas não geradas." };
  }

  var criadas = [], falhas = [];
  resultado.pendentes.forEach(function (d) {
    try {
      var venc = verbVencimentoBR_(competencia, d.diaVencimento);
      var r = registrarLancamentoDespesa({
        tipoLancamento: (typeof TIPO_LANCAMENTO_DESP !== "undefined" ? TIPO_LANCAMENTO_DESP.AVULSO : "avulso"),
        categoria: (typeof CATEGORIAS_DESPESA !== "undefined" && CATEGORIAS_DESPESA.VERBA_DIRETORIA) || "Verba de Diretoria",
        prestadorNome: d.nome,
        prestadorDoc: d.cpf || "",
        // E-mail vazio DE PROPÓSITO — ver cabeçalho: é a segunda trava
        // contra a rotina que cobra nota fiscal por e-mail.
        prestadorEmail: "",
        prestadorWhats: "",
        descricao: "Gratificação de diretoria — " + competencia + (d.cargo ? " (" + d.cargo + ")" : ""),
        valor: verbValorBR_(d.valor),
        dataVencimento: venc,
        // "Sem Documento" é a primeira trava: a rotina D-5 só cobra
        // documento quando o tipo é NF ou Cupom Fiscal/Recibo.
        tipoDoc: "Sem Documento",
        quemAgendou: "Automático",
        observacoes: "Gerada automaticamente pelo cadastro de Verbas de Diretoria. Gratificação paga pelo valor cheio, sem retenção de INSS/IRRF.",
        confirmarDuplicidade: true
      }, tokenSessao);

      if (r && r.ok) {
        criadas.push({ diretor: d.nome, valor: d.valor, idDespesa: r.idDespesa || r.id || "" });
        try {
          verbGarantirGeradas_().appendRow([
            String((r && (r.idDespesa || r.id)) || ""), d.id, d.nome, competencia, d.valor,
            resultado.quem, new Date()
          ]);
        } catch (eReg) {
          // Se o registro de idempotência falhar, a despesa JÁ existe.
          // Avisar é obrigatório: sem esta linha, regerar a competência
          // criaria a verba de novo e o diretor receberia em duplicidade.
          Logger.log("[VERBAS] despesa criada mas idempotência não registrada (" + d.nome + "): " + eReg.message);
          falhas.push(d.nome + ": despesa criada, mas o controle de duplicidade falhou — NÃO gere esta competência de novo sem conferir.");
        }
      } else {
        falhas.push(d.nome + ": " + ((r && r.mensagem) || "falha desconhecida"));
      }
    } catch (e) {
      falhas.push(d.nome + ": " + e.message);
    }
  });

  var total = criadas.reduce(function (s, c) { return s + c.valor; }, 0);
  return {
    ok: true, competencia: competencia,
    criadas: criadas.length, jaExistiam: resultado.jaExistiam,
    falhas: falhas, total: Math.round(total * 100) / 100, totalFmt: verbValorBR_(total),
    mensagem: criadas.length + " verba(s) gerada(s), total " + verbValorBR_(total) +
      (resultado.jaExistiam ? " · " + resultado.jaExistiam + " já existia(m) e não foram duplicadas" : "") +
      (falhas.length ? " · " + falhas.length + " falha(s)" : "") +
      ". Elas já estão na fila do Controle de Pagamentos."
  };
}

/** Histórico do que já foi gerado, para conferência. */
function verbHistoricoGeracoes(competencia, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var sh = verbGarantirGeradas_();
    if (sh.getLastRow() < 2) return { ok: true, historico: [] };
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    competencia = String(competencia || "").trim();
    var historico = dados
      .filter(function (l) { return !competencia || String(l[3]) === competencia; })
      .map(function (l) {
        return {
          idDespesa: String(l[0] || ""), diretorId: String(l[1] || ""), diretor: String(l[2] || ""),
          competencia: String(l[3] || ""), valor: verbNumero_(l[4]), valorFmt: verbValorBR_(verbNumero_(l[4])),
          geradoPor: String(l[5] || ""),
          geradoEm: (typeof formatarDataHoraBRDesp_ === "function") ? formatarDataHoraBRDesp_(l[6]) : String(l[6] || "")
        };
      })
      .reverse();
    return { ok: true, historico: historico };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ler o histórico: " + e.message, historico: [] };
  }
}
