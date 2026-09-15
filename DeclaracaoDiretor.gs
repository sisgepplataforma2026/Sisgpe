// ============================================================================
// ARQUIVO: DeclaracaoDiretor.gs
// MÓDULO: Documentos › Declarações — Declaração de Diretor (art. 543 da CLT)
// ============================================================================
//
// O QUE É
//
// A declaração que o sindicato entrega à escola empregadora informando que um
// diretor estará à disposição da entidade em determinado dia, com fundamento
// no art. 543 da CLT. O modelo em papel que originou este arquivo é o
// "DECLARAÇÃO 03.09.2026", conferido linha a linha em 15/09/2026.
//
// 🚨 MODELO FIXO COM VARIÁVEIS — NÃO É EDITOR DE TEXTO. Decisão do usuário.
//
// Só quatro coisas variam: o diretor, o dia da liberação, o período e a data
// de emissão. Todo o resto — inclusive a citação literal do art. 543 e a
// redação dada pelo Decreto-lei nº 229/1967 — é texto fixo, e é fixo de
// propósito: é o trecho jurídico do documento. Um editor livre aqui
// significaria alguém alterar sem querer a citação da lei num documento
// assinado pelo presidente.
//
// SEM HORÁRIO — decisão do usuário em 15/09/2026
//
// A primeira versão do desenho tinha horário inicial e final. Foram retirados
// a pedido dele, com razão concreta: declarar intervalo restringe a atuação
// sindical sem necessidade. A declaração diz o DIA, e no máximo o período.
//
// O TEXTO QUE SAI, nas três formas possíveis:
//
//   sem período   ...no dia 18 de setembro de 2026, estará à disposição...
//   integral      ...no dia 18 de setembro de 2026, em período integral, ...
//   turno         ...no dia 18 de setembro de 2026, no período vespertino, ...
//
// DUPLICATA AVISA, NÃO BLOQUEIA
//
// Emitir duas declarações para o mesmo diretor no mesmo dia é quase sempre
// engano — mas não sempre: a via se perde, a escola pede outra. Então o
// sistema avisa e pede confirmação, em vez de recusar. Recusar obrigaria a
// pessoa a resolver por fora, que é pior.
//
// O TEXTO EMITIDO FICA GRAVADO na coluna TEXTO, não só o PDF. Se um dia a
// redação mudar, a declaração de hoje continua reimprimível exatamente como
// foi assinada. Guardar só os campos e remontar depois produziria um
// documento diferente do que a escola recebeu.
//
// PASTA DO DRIVE — precisa ser configurada uma vez por ambiente.
// Ver `declPastaDestino_` logo abaixo e RECURSOS_AMBIENTE.DECLARACOES.
// ============================================================================

var ABA_DECLARACOES_DIRETOR = "DECLARACOES_DIRETOR";

var DECL_COLUNAS_EMISSAO = [
  "NUMERO", "DIRETOR_ID", "DIRETOR_NOME", "CARGO",
  "DATA_LIBERACAO", "PERIODO", "DATA_EMISSAO",
  "SIGNATARIO", "TEXTO", "PDF_ID", "PDF_URL",
  "EMITIDO_POR", "EMITIDO_EM", "GESTAO", "ORGAO", "CONDICAO",
  "ESCOLA_ID", "ESCOLA_NOME", "ESCOLA_DOCUMENTO", "CONTATOS_ORIGEM",
  "EMAILS_USADOS", "EMAIL_STATUS", "EMAIL_ENVIADO_EM", "EMAIL_ENVIADO_POR",
  "WHATSAPP_STATUS", "WHATSAPP_EM", "WHATSAPP_POR"
];

/* Rótulos e trechos de texto por período. Chave vazia = sem período. */
var DECL_PERIODOS = {
  "":           { rotulo: "Não informar", trecho: "" },
  "INTEGRAL":   { rotulo: "Integral",     trecho: ", em período integral" },
  "MATUTINO":   { rotulo: "Matutino",     trecho: ", no período matutino" },
  "VESPERTINO": { rotulo: "Vespertino",   trecho: ", no período vespertino" },
  "NOTURNO":    { rotulo: "Noturno",      trecho: ", no período noturno" }
};

/* Citação literal do art. 543, conferida contra o modelo em papel. */
var DECL_ART_543 =
  "Art. 543 – O empregado eleito para o cargo de administração sindical ou " +
  "representação profissional, inclusive junto a órgão de deliberação coletiva, " +
  "não poderá ser impedido do exercício de suas funções, nem transferido para " +
  "lugar ou mister que lhe dificulte ou torne impossível o desempenho das suas " +
  "atribuições sindicais. (Redação dada pelo Decreto-lei nº 229, 28.2.1967)";

var DECL_CIDADE = "Vitória";

/* =========================================
 * PLANILHA
 * ========================================= */

function declGarantirEmissoes_() {
  var ss = declPlanilha_();
  var sh = ss.getSheetByName(ABA_DECLARACOES_DIRETOR);
  if (!sh) sh = ss.insertSheet(ABA_DECLARACOES_DIRETOR);
  if (sh.getLastRow() === 0) {
    sh.appendRow(DECL_COLUNAS_EMISSAO);
    sh.getRange(1, 1, 1, DECL_COLUNAS_EMISSAO.length)
      .setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  var mapa = declCabecalho_(sh);
  DECL_COLUNAS_EMISSAO.forEach(function (nome) {
    if (!mapa[nome]) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(nome);
      mapa[nome] = col;
    }
  });
  return sh;
}

function declEmissoes_interno_() {
  var sh = declGarantirEmissoes_();
  if (sh.getLastRow() < 2) return [];

  var mapa = declCabecalho_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  function col(l, nome) { return mapa[nome] ? l[mapa[nome] - 1] : ""; }

  return dados.map(function (l) {
    var periodo = declTexto_(col(l, "PERIODO")).toUpperCase();
    return {
      numero:        declTexto_(col(l, "NUMERO")),
      diretorId:     declTexto_(col(l, "DIRETOR_ID")),
      diretorNome:   declTexto_(col(l, "DIRETOR_NOME")),
      cargo:         declTexto_(col(l, "CARGO")),
      dataLiberacao: declDataBR_(col(l, "DATA_LIBERACAO")),
      periodo:       periodo,
      periodoRotulo: (DECL_PERIODOS[periodo] || DECL_PERIODOS[""]).rotulo,
      dataEmissao:   declDataBR_(col(l, "DATA_EMISSAO")),
      signatario:    declTexto_(col(l, "SIGNATARIO")),
      texto:         declTexto_(col(l, "TEXTO")),
      pdfId:         declTexto_(col(l, "PDF_ID")),
      pdfUrl:        declTexto_(col(l, "PDF_URL")),
      emitidoPor:    declTexto_(col(l, "EMITIDO_POR")),
      emitidoEm:     declDataBR_(col(l, "EMITIDO_EM")),
      gestao:        declTexto_(col(l, "GESTAO")),
      escolaId:      declTexto_(col(l, "ESCOLA_ID")),
      escolaNome:    declTexto_(col(l, "ESCOLA_NOME")),
      emailsUsados:  declTexto_(col(l, "EMAILS_USADOS")),
      emailStatus:   declTexto_(col(l, "EMAIL_STATUS")),
      whatsappStatus: declTexto_(col(l, "WHATSAPP_STATUS"))
    };
  }).filter(function (d) { return !!d.numero; });
}

/**
 * Próximo número do ano, no formato 001/2026.
 *
 * Deriva das linhas já gravadas, não de um contador guardado à parte: linha
 * gravada é a única fonte que não dessincroniza. Só é chamada de dentro do
 * lock de `declEmitirDeclaracaoDiretor`.
 */
function declProximoNumero_(ano) {
  ano = Number(ano || new Date().getFullYear());
  var maior = 0;
  declEmissoes_interno_().forEach(function (e) {
    var m = String(e.numero).match(/^(\d+)\/(\d{4})$/);
    if (m && Number(m[2]) === ano) maior = Math.max(maior, Number(m[1]));
  });
  var proximo = maior + 1;
  return ("00" + proximo).slice(-3) + "/" + ano;
}

/* =========================================
 * PASTA DO DRIVE
 * ========================================= */

/**
 * Pasta onde o PDF é gravado, já com a subpasta do ano.
 *
 * O ID sai de `getRecursoId_("DECLARACOES")` (AmbienteRecursos.gs), que é o
 * único mecanismo do sistema que separa produção de homologação. A tabela
 * nasce SEM id justamente para não haver chance de a homologação gravar no
 * acervo real — quem instala configura a Script Property uma vez por
 * ambiente, e a mensagem abaixo diz exatamente qual é.
 */
function declPastaDestino_() {
  var idRaiz;
  try {
    idRaiz = getRecursoId_("DECLARACOES");
  } catch (e) {
    throw new Error(
      "A pasta das declarações ainda não foi configurada neste ambiente. " +
      "Crie a pasta no Drive e informe o ID na Script Property " +
      "SISGEP_PASTA_DECLARACOES (Apps Script › Configurações do projeto › " +
      "Propriedades do script). Detalhe técnico: " + e.message
    );
  }

  var pastaRaiz = DriveApp.getFolderById(idRaiz);
  var ano = String(new Date().getFullYear());
  var achadas = pastaRaiz.getFoldersByName(ano);
  return achadas.hasNext() ? achadas.next() : pastaRaiz.createFolder(ano);
}

/* =========================================
 * MONTAGEM DO TEXTO
 * ========================================= */

function declPeriodoValido_(p) {
  var chave = declTexto_(p).toUpperCase();
  return Object.prototype.hasOwnProperty.call(DECL_PERIODOS, chave) ? chave : null;
}

/**
 * O primeiro parágrafo da declaração — a única parte que varia.
 *
 * @param {{nome:string, cargo:string, dataLiberacao:*, periodo:string}} p
 * @return {string}
 */
function declMontarTexto_(p) {
  p = p || {};
  var nome = declTexto_(p.nome).toUpperCase();
  var cargo = declTexto_(p.cargo).toLowerCase() || "diretor";
  var periodo = declPeriodoValido_(p.periodo) || "";
  var trecho = DECL_PERIODOS[periodo].trecho;
  var dia = declDataExtenso_(p.dataLiberacao);

  return "Declaramos, para os devidos fins e efeitos legais a que se destina, que " +
    nome + ", " + cargo + " desta Entidade Sindical, no dia " + dia + trecho +
    ", estará à disposição do SindEducação/ES para o exercício de atividades " +
    "inerentes ao seu mandato sindical.";
}

/* =========================================
 * VALIDAÇÃO COMPARTILHADA (prévia e emissão)
 * ========================================= */

function declValidarPedido_(dados) {
  dados = dados || {};

  var diretor = declDiretorPorId_(dados.diretorId);
  if (!diretor) return { ok: false, mensagem: "Selecione o diretor." };
  if (!diretor.ativo) return { ok: false, mensagem: "Este diretor está inativo no cadastro da Diretoria." };
  if (!diretor.mandatoVigente) {
    return {
      ok: false,
      mensagem: "O mandato de " + diretor.nome + " não está vigente (" +
                (diretor.mandatoInicio || "sem início") + " a " +
                (diretor.mandatoFim || "sem fim") + "). Corrija o cadastro antes de emitir."
    };
  }

  var dataLib = declSoData_(dados.dataLiberacao);
  if (!dataLib) return { ok: false, mensagem: "Informe a data da liberação." };

  var periodo = declPeriodoValido_(dados.periodo);
  if (periodo === null) return { ok: false, mensagem: "Período inválido." };

  var dataEmi = declSoData_(dados.dataEmissao) || declHoje_();

  var contexto = declContextoDiretor_interno_(diretor);
  var escolaId = declTexto_(dados.escolaId);
  var escola = contexto.vinculos.filter(function (v) { return v.escolaId === escolaId; })[0];
  if (!escola) return { ok: false, mensagem: "Selecione a escola empregadora do dirigente." };

  var signatario = declSignatario_();
  if (!signatario) {
    return {
      ok: false,
      mensagem: "Não há Presidente com mandato vigente na composição de Governança — e declaração sem assinatura não vale nada. Corrija a composição em Governança antes de emitir."
    };
  }

  return {
    ok: true,
    diretor: diretor,
    signatario: signatario,
    dataLiberacao: dataLib,
    dataEmissao: dataEmi,
    periodo: periodo,
    contexto: contexto,
    escola: escola,
    texto: declMontarTexto_({
      nome: diretor.nome,
      cargo: diretor.cargo,
      dataLiberacao: dataLib,
      periodo: periodo
    })
  };
}

/** Declarações já emitidas para o mesmo diretor no mesmo dia. */
function declDuplicatas_(diretorId, dataLiberacao) {
  var alvo = declDataBR_(dataLiberacao);
  return declEmissoes_interno_().filter(function (e) {
    return e.diretorId === declTexto_(diretorId) && e.dataLiberacao === alvo;
  });
}

/* =========================================
 * ENDPOINTS
 * ========================================= */

/** Dados de abertura da tela: quem pode receber declaração e quem assina. */
function declDadosEmissao(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var signatario = declSignatario_();
    return {
      ok: true,
      diretores: declDiretoresHabilitados_().map(function (d) {
        return { id: d.id, nome: d.nome, cargo: d.cargo, mandatoFim: d.mandatoFim };
      }),
      periodos: Object.keys(DECL_PERIODOS).map(function (k) {
        return { valor: k, rotulo: DECL_PERIODOS[k].rotulo };
      }),
      signatario: signatario ? { nome: signatario.nome, cargo: signatario.cargo } : null,
      gestao: (typeof GOV_MANDATO !== "undefined") ? GOV_MANDATO.gestao : "",
      hoje: declDataBR_(declHoje_())
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao carregar a tela: " + e.message, diretores: [] };
  }
}

/** Prévia do texto. Não grava nada e não gera PDF. */
function declPreviaDeclaracaoDiretor(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var v = declValidarPedido_(dados);
    if (!v.ok) return v;

    var dup = declDuplicatas_(v.diretor.id, v.dataLiberacao);
    return {
      ok: true,
      texto: v.texto,
      cidadeData: DECL_CIDADE + ", " + declDataExtenso_(v.dataEmissao) + ".",
      signatario: { nome: v.signatario.nome, cargo: v.signatario.cargo },
      escola: v.escola,
      duplicatas: dup.map(function (d) { return d.numero; })
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar a prévia: " + e.message };
  }
}

/**
 * Emite: gera o PDF, grava a linha e registra na trilha de auditoria.
 *
 * ORDEM PROPOSITAL — PDF primeiro, linha depois. Se o Drive falhar, nada é
 * gravado e nenhum número é consumido (o número deriva das linhas). O
 * contrário produziria declaração registrada sem documento, que é pior de
 * descobrir do que um erro na hora.
 */
function declEmitirDeclaracaoDiretor(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) {
      return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    }

    var v = declValidarPedido_(dados);
    if (!v.ok) return v;

    var dup = declDuplicatas_(v.diretor.id, v.dataLiberacao);
    if (dup.length && (dados || {}).confirmado !== true) {
      return {
        ok: false,
        precisaConfirmar: true,
        duplicatas: dup.map(function (d) { return d.numero; }),
        mensagem: "Já existe declaração para " + v.diretor.nome + " no dia " +
                  declDataBR_(v.dataLiberacao) + " (nº " +
                  dup.map(function (d) { return d.numero; }).join(", ") +
                  "). Confirme para emitir outra via."
      };
    }

    var numero = declProximoNumero_(new Date().getFullYear());

    var pdf = declGerarPdf_({
      numero: numero,
      texto: v.texto,
      dataEmissao: v.dataEmissao,
      signatario: v.signatario,
      diretor: v.diretor
    });

    var sh = declGarantirEmissoes_();
    var mapa = declCabecalho_(sh);
    var linha = sh.getLastRow() + 1;
    var quem = declQuem_(sessao);

    var valores = {
      NUMERO: numero,
      DIRETOR_ID: v.diretor.id,
      DIRETOR_NOME: v.diretor.nome,
      CARGO: v.diretor.cargo,
      DATA_LIBERACAO: v.dataLiberacao,
      PERIODO: v.periodo,
      DATA_EMISSAO: v.dataEmissao,
      SIGNATARIO: v.signatario.nome,
      TEXTO: v.texto,
      PDF_ID: pdf.id,
      PDF_URL: pdf.url,
      EMITIDO_POR: quem,
      EMITIDO_EM: new Date(),
      GESTAO: v.diretor.gestao || "",
      ORGAO: v.diretor.orgao || "",
      CONDICAO: v.diretor.condicao || "",
      ESCOLA_ID: v.escola.escolaId,
      ESCOLA_NOME: v.escola.nome,
      ESCOLA_DOCUMENTO: v.escola.documento || "",
      CONTATOS_ORIGEM: JSON.stringify(v.escola.contatos || []),
      EMAIL_STATUS: "AGUARDANDO_CONFERENCIA",
      WHATSAPP_STATUS: "NAO_PREPARADO"
    };
    Object.keys(valores).forEach(function (k) {
      if (mapa[k]) sh.getRange(linha, mapa[k]).setValue(valores[k]);
    });

    declAuditar_({
      sessao: sessao,
      registroId: numero,
      acao: "DECLARACAO_DIRETOR_EMITIDA",
      documento: pdf.url,
      valorNovo: v.diretor.nome + " · " + declDataBR_(v.dataLiberacao) +
                 " · " + (DECL_PERIODOS[v.periodo] || DECL_PERIODOS[""]).rotulo
    });

    return {
      ok: true,
      numero: numero,
      url: pdf.url,
      texto: v.texto,
      escola: v.escola,
      emailStatus: "AGUARDANDO_CONFERENCIA",
      mensagem: "Declaração " + numero + " emitida."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao emitir: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (eRel) {}
  }
}

/* =========================================
 * VÍNCULO, ESCOLA E ENTREGA
 * ========================================= */

function declNormalizar_(v) {
  return String(v || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function declContextoDiretor_interno_(diretor) {
  if (typeof assoc_todos_ !== "function") throw new Error("A base de Associados não está disponível.");
  var chave = declNormalizar_(diretor && diretor.nome);
  var associados = assoc_todos_().filter(function (a) { return declNormalizar_(a.nome) === chave; });
  var escolas = (typeof listarEscolasCadastro_interno_ === "function") ? listarEscolasCadastro_interno_() : [];
  var porId = {};

  associados.forEach(function (a) {
    var esc = declNormalizar_(a.escola);
    if (!esc) return;
    var candidatas = escolas.filter(function (e) {
      return [e.NomeEscola, e.Fantasia, e.escola, e.CodigoInterno]
        .some(function (n) { return declNormalizar_(n) === esc; });
    });
    candidatas.forEach(function (e) {
      var id = declTexto_(e.escolaId || e.EscolaID || e.linha);
      if (!id || porId[id]) return;
      porId[id] = {
        escolaId: id,
        nome: declTexto_(e.NomeEscola || e.escola),
        fantasia: declTexto_(e.Fantasia),
        documento: declTexto_(e.CNPJ || e.cnpj),
        vinculoOrigem: "Associados",
        telefoneDiretor: declTexto_(a.celular),
        contatos: declContatosEscola_(e)
      };
    });
  });

  return { diretorId: diretor.id, associadosEncontrados: associados.length, vinculos: Object.keys(porId).map(function (k) { return porId[k]; }) };
}

function declContatosEscola_(escola) {
  var mapa = {};
  function juntar(valor, origem) {
    String(valor || "").split(/[;,\n]/).forEach(function (email) {
      email = String(email || "").trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
      if (!mapa[email]) mapa[email] = { email: email, origens: [], falhas: 0, confirmacoes: 0 };
      if (mapa[email].origens.indexOf(origem) < 0) mapa[email].origens.push(origem);
      if (typeof ofDest_historico_ === "function") {
        var h = ofDest_historico_(email);
        mapa[email].falhas = h.falhas || 0;
        mapa[email].confirmacoes = h.confirmacoes || 0;
      }
    });
  }
  juntar(escola.Email || escola.email, "Escolas · principal");
  juntar(escola.EmailsTodos, "Escolas · todos");
  /* A Controle pode conter endereços usados depois da última atualização do
     cadastro. Lemos em bloco e só aceitamos linhas da mesma escola. */
  try {
    var ss = declPlanilha_(), sh = ss.getSheetByName(PLANILHA_REGISTRO || "Controle");
    if (sh && sh.getLastRow() > 1) {
      var hm = declCabecalho_(sh);
      var cEscola = hm.ESCOLA || hm["ESCOLA (RAZÃO SOCIAL)"] || hm.UNIDADE;
      var cEmails = hm.EMAILS_TODOS || hm["E-MAILS (TODOS)"] || hm.EMAIL || hm["E-MAIL"];
      var alvos = [escola.NomeEscola, escola.escola, escola.Fantasia, escola.CodigoInterno]
        .map(declNormalizar_).filter(Boolean);
      if (cEscola && cEmails && alvos.length) {
        var linhas = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
        linhas.forEach(function (l) {
          if (alvos.indexOf(declNormalizar_(l[cEscola - 1])) >= 0) juntar(l[cEmails - 1], "Controle · histórico");
        });
      }
    }
  } catch (eControle) { Logger.log("Declaração: leitura da Controle indisponível — " + eControle.message); }
  /* Falhas e confirmações vêm da mesma memória usada pelos Ofícios; assim o
     conhecimento operacional não é duplicado. */
  return Object.keys(mapa).map(function (k) {
    var c = mapa[k]; c.marcado = c.falhas === 0; return c;
  });
}

function declContextoDiretor(diretorId, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  var diretor = declDiretorPorId_(diretorId);
  if (!diretor || diretor.fonte !== "GOVERNANCA") return { ok: false, mensagem: "Dirigente vigente não encontrado em Governança." };
  var r = declContextoDiretor_interno_(diretor); r.ok = true; return r;
}

function declAcharEmissao_(numero) {
  var sh = declGarantirEmissoes_(), hm = declCabecalho_(sh);
  if (sh.getLastRow() < 2) return null;
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) if (declTexto_(dados[i][hm.NUMERO - 1]) === declTexto_(numero)) return { sh: sh, hm: hm, linha: i + 2, valores: dados[i] };
  return null;
}

/**
 * Reabre a entrega de uma declaração já emitida — só lê, não envia nada.
 *
 * OS CONTATOS SAEM DA LINHA, não de uma nova varredura de Associados e
 * Escolas. É a conferência congelada no dia da emissão, que é exatamente o
 * conjunto que `declEnviarEmail` aceita logo abaixo. Reconsultar o cadastro
 * aqui traria endereços que ninguém conferiu para dentro de um documento
 * assinado — e ainda faria a trava de destinatário divergir da tela.
 *
 * Existe porque, até 15/09/2026, a entrega só aparecia logo depois de emitir:
 * fechar a tela deixava a declaração parada em AGUARDANDO_CONFERENCIA sem
 * nenhum caminho de volta.
 */
function declEntregaDeclaracao(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var achado = declAcharEmissao_(numero);
    if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };

    function campo(nome) {
      return achado.hm[nome] ? declTexto_(achado.valores[achado.hm[nome] - 1]) : "";
    }

    var contatos = [];
    try {
      contatos = JSON.parse(campo("CONTATOS_ORIGEM") || "[]") || [];
    } catch (eJson) {
      contatos = [];
    }

    return {
      ok: true,
      numero: campo("NUMERO"),
      diretorNome: campo("DIRETOR_NOME"),
      escola: {
        escolaId: campo("ESCOLA_ID"),
        nome: campo("ESCOLA_NOME"),
        documento: campo("ESCOLA_DOCUMENTO"),
        contatos: contatos
      },
      pdfUrl: campo("PDF_URL"),
      emailStatus: campo("EMAIL_STATUS"),
      emailsUsados: campo("EMAILS_USADOS"),
      whatsappStatus: campo("WHATSAPP_STATUS")
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao abrir a entrega: " + e.message };
  }
}

function declEnviarEmail(numero, emails, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  var achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var validacao = validarListaEmails_(Array.isArray(emails) ? emails.join(";") : emails);
  if (!validacao.ok || !validacao.emails.length) return { ok: false, mensagem: "Selecione ao menos um e-mail válido." };
  var permitidos = [];
  try {
    permitidos = JSON.parse(declTexto_(achado.valores[achado.hm.CONTATOS_ORIGEM - 1]) || "[]")
      .map(function (c) { return String(c.email || "").trim().toLowerCase(); });
  } catch (eContatos) {}
  var foraDaConferencia = validacao.emails.filter(function (e) { return permitidos.indexOf(String(e).toLowerCase()) < 0; });
  if (foraDaConferencia.length) return { ok: false, mensagem: "Destinatário não pertence à conferência desta declaração." };

  var ambiente = String(getAmbienteAtual() || "producao").toLowerCase();
  var destinoReal = validacao.todos;
  var destinoEnvio = ambiente === "homologacao" ? OFICIOS_HML_EMAIL_PADRAO_TESTE : destinoReal;
  var pdfId = declTexto_(achado.valores[achado.hm.PDF_ID - 1]);
  var nome = declTexto_(achado.valores[achado.hm.DIRETOR_NOME - 1]);
  var escola = declTexto_(achado.valores[achado.hm.ESCOLA_NOME - 1]);
  var assunto = "Declaração " + numero + " — " + nome;
  var html = "<p>Prezados(as),</p><p>Segue, em anexo, a declaração de liberação sindical de <strong>" + declEscapar_(nome) + "</strong>.</p><p>Atenciosamente,<br>SindEducação-ES</p>";
  if (ambiente === "homologacao") html = "<p><strong>HOMOLOGAÇÃO.</strong> Destinatário real: " + declEscapar_(destinoReal) + "</p>" + html;
  try {
    var op = montarOpcoesEmailSISGEP_(declQuem_(sessao), html, [DriveApp.getFileById(pdfId).getBlob()], assunto, destinoEnvio);
    MailApp.sendEmail(op);
    achado.sh.getRange(achado.linha, achado.hm.EMAILS_USADOS).setValue(destinoReal);
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_STATUS).setValue(ambiente === "homologacao" ? "TESTE_HML_ENVIADO" : "ENVIADO");
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_ENVIADO_EM).setValue(new Date());
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_ENVIADO_POR).setValue(declQuem_(sessao));
    declAuditar_({ sessao: sessao, registroId: numero, acao: "DECLARACAO_EMAIL_ENVIADO", documento: escola, valorNovo: ambiente === "homologacao" ? "TESTE_HML" : "ENVIADO" });
    return { ok: true, mensagem: ambiente === "homologacao" ? "Teste enviado à Secretaria. A escola real não recebeu." : "Declaração enviada à escola.", destinoReal: destinoReal, destinoUtilizado: destinoEnvio };
  } catch (e) {
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_STATUS).setValue("ERRO");
    return { ok: false, mensagem: "Falha no envio: " + e.message };
  }
}

function declPrepararWhatsapp(numero, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false), achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var diretor = declDiretorPorId_(declTexto_(achado.valores[achado.hm.DIRETOR_ID - 1]));
  var ctx = declContextoDiretor_interno_(diretor), escolaId = declTexto_(achado.valores[achado.hm.ESCOLA_ID - 1]);
  var vinculo = ctx.vinculos.filter(function (v) { return v.escolaId === escolaId; })[0];
  var fone = String(vinculo && vinculo.telefoneDiretor || "").replace(/\D/g, "");
  if (fone.length < 10) return { ok: false, mensagem: "O diretor não possui celular válido em Associados." };
  if (fone.length <= 11) fone = "55" + fone;
  var urlPdf = declTexto_(achado.valores[achado.hm.PDF_URL - 1]);
  var msg = "Olá! A declaração " + numero + " foi emitida para ciência. PDF: " + urlPdf;
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_STATUS).setValue("PREPARADO");
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_EM).setValue(new Date());
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_POR).setValue(declQuem_(sessao));
  return { ok: true, url: "https://wa.me/" + fone + "?text=" + encodeURIComponent(msg), mensagem: msg };
}

function declConfirmarWhatsapp(numero, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false), achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var atual = declTexto_(achado.valores[achado.hm.WHATSAPP_STATUS - 1]);
  if (atual !== "PREPARADO") return { ok: false, mensagem: "Prepare a mensagem antes de confirmar o envio." };
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_STATUS).setValue("ENVIADO_CONFIRMADO");
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_EM).setValue(new Date());
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_POR).setValue(declQuem_(sessao));
  declAuditar_({ sessao: sessao, registroId: numero, acao: "DECLARACAO_WHATSAPP_CONFIRMADO" });
  return { ok: true, mensagem: "Ciência por WhatsApp registrada." };
}

function declHistoricoDeclaracoes(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    filtros = filtros || {};
    var busca = declTexto_(filtros.busca).toUpperCase();
    var de    = declSoData_(filtros.de);
    var ate   = declSoData_(filtros.ate);

    var itens = declEmissoes_interno_().filter(function (e) {
      if (busca) {
        var alvo = (e.diretorNome + " " + e.numero + " " + e.dataLiberacao).toUpperCase();
        if (alvo.indexOf(busca) < 0) return false;
      }
      if (de || ate) {
        var d = declSoData_(e.dataLiberacao);
        if (!d) return false;
        if (de && d < de) return false;
        if (ate && d > ate) return false;
      }
      return true;
    });

    itens.reverse(); // mais recente primeiro
    return { ok: true, itens: itens, total: itens.length };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar: " + e.message, itens: [] };
  }
}

/* =========================================
 * PDF
 * ========================================= */

/**
 * Gera o PDF e devolve { id, url }.
 *
 * Isolada de propósito: é a única parte do fluxo que depende de Drive e do
 * conversor de HTML, que o emulador de teste não reproduz. Separada assim, o
 * teste cobre número, texto, duplicata, registro e auditoria de verdade, e o
 * PDF em si fica honestamente marcado como "não testado" até alguém emitir
 * uma declaração no ar.
 */
function declGerarPdf_(p) {
  p = p || {};
  var html = declHtmlDeclaracao_(p);
  var nome = "Declaracao_" + String(p.numero).replace("/", "-") + "_" +
             declTexto_(p.diretor && p.diretor.nome).split(" ")[0];

  var blob = HtmlService.createHtmlOutput(html)
    .getBlob()
    .getAs("application/pdf")
    .setName(nome + ".pdf");

  var pasta = declPastaDestino_();
  var arquivo = pasta.createFile(blob);

  try {
    if (typeof arquivoAplicarPolitica_ === "function") {
      arquivoAplicarPolitica_(arquivo, "Declaração de Diretor " + p.numero);
    }
  } catch (e) {
    Logger.log("DeclaracaoDiretor: política de compartilhamento falhou — " + e.message);
  }

  return { id: arquivo.getId(), url: arquivo.getUrl() };
}

/**
 * O documento em si. Espelha o modelo em papel: título centralizado, corpo
 * justificado, citação do art. 543 recuada e menor, fecho, cidade/data e
 * assinatura.
 */
function declHtmlDeclaracao_(p) {
  p = p || {};
  var sig = p.signatario || {};
  var imgs = {};
  try {
    if (typeof carregarImagensRecibo_ === "function") imgs = carregarImagensRecibo_() || {};
  } catch (e) {
    Logger.log("DeclaracaoDiretor: imagens institucionais indisponíveis — " + e.message);
  }

  var logo = imgs.logoBase64
    ? '<img src="data:' + imgs.logoMime + ';base64,' + imgs.logoBase64 + '" style="max-height:90px;">'
    : '<div style="font-size:18px;font-weight:bold;color:#001f4d;">SindEducação/ES</div>';

  var assinaturaImg = imgs.assBase64
    ? '<img src="data:' + imgs.assMime + ';base64,' + imgs.assBase64 + '" style="max-height:70px;"><br>'
    : '<div style="height:52px;"></div>';

  return '' +
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@page { size: A4; margin: 2.5cm 2.5cm; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #111; line-height: 1.6; }' +
    '.cabecalho { text-align: center; margin-bottom: 26px; }' +
    '.titulo { text-align: center; font-size: 15pt; font-weight: bold; letter-spacing: 2px; margin: 26px 0 34px; }' +
    '.corpo { text-align: justify; margin-bottom: 18px; }' +
    '.citacao { text-align: justify; font-size: 10.5pt; margin: 16px 0 16px 2.2cm; color: #222; }' +
    '.fecho { margin-top: 26px; }' +
    '.local { margin-top: 30px; }' +
    '.assinatura { text-align: center; margin-top: 46px; }' +
    '.assinatura .nome { font-weight: bold; }' +
    '.rodape { margin-top: 40px; text-align: center; font-size: 8pt; color: #777; }' +
    '</style></head><body>' +
    '<div class="cabecalho">' + logo + '</div>' +
    '<div class="titulo">DECLARAÇÃO</div>' +
    '<div class="corpo">' + declEscapar_(p.texto) + '</div>' +
    '<div class="corpo">Nos termos do Artigo 543, da CLT, requeremos a liberação do empregado ' +
      'para o pleno exercício de seu mandato sindical, conforme lhe assegura a lei:</div>' +
    '<div class="citacao">' + declEscapar_(DECL_ART_543) + '</div>' +
    '<div class="fecho">Por ser verdade firmamos a presente.</div>' +
    '<div class="local">' + DECL_CIDADE + ', ' + declDataExtenso_(p.dataEmissao) + '.</div>' +
    '<div class="assinatura">' + assinaturaImg +
      '<div class="nome">' + declEscapar_(sig.nome || "") + '</div>' +
      '<div>' + declEscapar_(sig.cargo || "Presidente") + ' – SindEducação/ES</div>' +
    '</div>' +
    '<div class="rodape">Declaração nº ' + declEscapar_(p.numero || "") + ' · SISGEP</div>' +
    '</body></html>';
}

function declEscapar_(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================
 * AUDITORIA
 *
 * Nunca derruba a emissão. Documento assinado que não chega à escola porque
 * a trilha de auditoria estava fora do ar seria o defeito pior.
 * ========================================= */

function declAuditar_(dados) {
  try {
    if (typeof auditar_ !== "function") return;
    auditar_({
      sessao: dados.sessao,
      registroId: dados.registroId,
      modulo: "Documentos",
      submodulo: "Declarações",
      acao: dados.acao,
      documento: dados.documento || "",
      valorNovo: dados.valorNovo || "",
      origem: "PORTAL_ADMIN"
    });
  } catch (e) {
    Logger.log("DeclaracaoDiretor: auditoria falhou — " + e.message);
  }
}

/* =========================================
 * DIAGNÓSTICO — roda no editor do Apps Script, só lê.
 * ========================================= */

function declDiagnosticoPasta_() {
  var linhas = [];
  try {
    var id = getRecursoId_("DECLARACOES");
    linhas.push("ID resolvido: " + id);
    var pasta = DriveApp.getFolderById(id);
    linhas.push("Pasta: " + pasta.getName() + " ✅ acessível");
  } catch (e) {
    linhas.push("❌ " + e.message);
    linhas.push("Configure a Script Property SISGEP_PASTA_DECLARACOES com o ID da pasta do Drive.");
  }
  var s = declSignatario_();
  linhas.push("Signatário: " + (s ? s.nome + " (" + s.cargo + ")" : "❌ ninguém marcado"));
  linhas.push("Diretores habilitados: " + declDiretoresHabilitados_().length);
  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
