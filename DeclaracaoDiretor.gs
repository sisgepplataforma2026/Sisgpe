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
  "EMITIDO_POR", "EMITIDO_EM"
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
      emitidoEm:     declDataBR_(col(l, "EMITIDO_EM"))
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

  var signatario = declSignatario_();
  if (!signatario) {
    return {
      ok: false,
      mensagem: "Nenhum diretor está marcado como signatário. Abra Declarações › Diretoria e marque quem assina as declarações."
    };
  }

  return {
    ok: true,
    diretor: diretor,
    signatario: signatario,
    dataLiberacao: dataLib,
    dataEmissao: dataEmi,
    periodo: periodo,
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
      EMITIDO_EM: new Date()
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
      mensagem: "Declaração " + numero + " emitida."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao emitir: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (eRel) {}
  }
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
