// ============================================================================
// ARQUIVO: Oficios.gs
// Núcleo principal — geração, preview, PDF, numeração, log e validação pública
// ============================================================================

var PRIMEIRO_OFICIO_PLATAFORMA = 65;
/* Limite de pessoas por ofício: 50 em todos os tipos.
 *
 * Era 25 onde havia ficha por pessoa e 50 nas taxas. O usuário unificou em
 * 18/08/2026, respondendo "Até 50".
 *
 * O QUE VIGIAR: em filiação e desfiliação cada pessoa leva uma ficha
 * anexada ao MESMO e-mail. Com 50 fichas, o e-mail pode estourar o limite
 * de tamanho do Gmail e falhar no envio — e a falha aparece no envio, não
 * na geração. Nas três taxas não há ficha, então 50 não traz esse risco. */
var LIMITE_ASSOCIADOS          = 50;
var LIMITE_PESSOAS_TAXA        = 50;

var PASTA_OFICIOS_ID = "1_0BS8UuPmuhbKycdLy7_M4HhHKMkpu4h"; // fallback → pasta Filiação
var PASTA_OFICIOS_FILIACAO_ID      = "1_0BS8UuPmuhbKycdLy7_M4HhHKMkpu4h";
var PASTA_OFICIOS_DESFILIACAO_ID   = "16pfKB3vxz33QRJooUGW79Ei-D3eInSyd";
var PASTA_OFICIOS_TAXA_NEGOCIAL_ID = "1OcrxiWCGErvYHLaevNTov1aaavLuI3gX";
var PASTA_OFICIOS_TAXA_ASSIST_ID   = "1__l7hUe3g3l6iBNvPBKJUR3eR5Kqjs93";
var PASTA_OFICIOS_LIVRE_ID         = "1MToLVFg_TmRH5DfvnlKIVPwmbmUOYTYn";

/* ================= PASTA POR TIPO ================= */

function obterPastaPorTipo_(tipoNorm) {
  var mapa = {
    "FILIACAO":                 PASTA_OFICIOS_FILIACAO_ID,
    "DESFILIACAO":              PASTA_OFICIOS_DESFILIACAO_ID,
    "TAXA_NEGOCIAL":            PASTA_OFICIOS_TAXA_NEGOCIAL_ID,
    // Sem pasta própria ainda — reaproveita a pasta de Taxa Negocial,
    // já que trata do mesmo assunto (Cláusula 57ª), só que em sentido oposto.
    "OPOSICAO_TAXA_NEGOCIAL":   PASTA_OFICIOS_TAXA_NEGOCIAL_ID,
    "TAXA_ASSISTENCIAL":        PASTA_OFICIOS_TAXA_ASSIST_ID,
    "OFICIO_LIVRE":             PASTA_OFICIOS_LIVRE_ID
  };
  var id = mapa[String(tipoNorm || "").toUpperCase()] || PASTA_OFICIOS_ID;
  return obterOuCriarSubpastaAno(id);
}

/* ================= CONVERTER HTML PARA PDF ================= */

function oficios_converterHtmlParaPdf_(html, nomeArquivo, pastaDestino) {
  try {
var bytes = Utilities.newBlob(html).getBytes();
var blob  = Utilities.newBlob(bytes, "text/html; charset=utf-8", nomeArquivo + ".html");
    var pdfBlob = blob.getAs(MimeType.PDF).setName(nomeArquivo + ".pdf");
    return pastaDestino.createFile(pdfBlob);
  } catch (e) {
    Logger.log("❌ converterHtmlParaPdf_: " + e.message);
    throw new Error("Erro ao converter HTML para PDF: " + e.message);
  }
}

/* ================= DASHBOARD ================= */

function dashboardResumo() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var sh  = ss.getSheetByName(PLANILHA_REGISTRO);
  var ano = anoAtual_();

  if (!sh || sh.getLastRow() < 2) {
    return {
      total: 0, pendentes: 0, confirmados: 0, filiacao: 0, desfiliacao: 0, taxa: 0, livre: 0,
      ultimoOficio:  String(PRIMEIRO_OFICIO_PLATAFORMA - 1).padStart(3,"0") + "/" + ano,
      proximoOficio: String(PRIMEIRO_OFICIO_PLATAFORMA).padStart(3,"0") + "/" + ano
    };
  }

  var headerMap = getHeaderMap_(sh);
  var colStatus = headerMap["Status"];
  var colNumero = headerMap["Número do Ofício"];
  var colTipo   = headerMap["TIPO"] || headerMap["Tipo"];
  if (!colStatus || !colNumero || !colTipo) throw new Error("Dashboard: colunas necessárias não encontradas.");

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var total = 0, pendentes = 0, confirmados = 0, filiacao = 0, desfiliacao = 0, taxa = 0, livre = 0, maiorNumero = 0;

  values.forEach(function(row) {
    var numeroBruto = String(row[colNumero - 1] || "").trim();
    var status      = normalizarTexto_(row[colStatus - 1]);
    var tipo        = normalizarTipoOficio_(row[colTipo - 1]);

    if (!numeroBruto || numeroBruto.indexOf("/" + ano) === -1) return;
    var numeroParte = parseInt(numeroBruto.split("/")[0], 10);
    if (isNaN(numeroParte) || numeroParte < PRIMEIRO_OFICIO_PLATAFORMA) return;

    total++;
    if (status === "enviado" || status === "pendente") pendentes++;
    if (status === "confirmado") confirmados++;
    if (tipo === "DESFILIACAO")        desfiliacao++;
    else if (tipo === "FILIACAO")      filiacao++;
    else if (tipo === "TAXA_NEGOCIAL") taxa++;
    else if (tipo === "OFICIO_LIVRE")  livre++;
    if (numeroParte > maiorNumero) maiorNumero = numeroParte;
  });

  if (maiorNumero < PRIMEIRO_OFICIO_PLATAFORMA) maiorNumero = PRIMEIRO_OFICIO_PLATAFORMA - 1;

  try {
    var numeroTaxa = String(PropertiesService.getScriptProperties()
      .getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
    if (numeroTaxa) {
      var partesTaxa = numeroTaxa.split("/");
      if (partesTaxa.length >= 2 && partesTaxa[1].trim() === ano) {
        var numTaxa = parseInt(partesTaxa[0].trim(), 10);
        if (!isNaN(numTaxa) && numTaxa > maiorNumero) maiorNumero = numTaxa;
      }
    }
  } catch(e) { Logger.log("dashboardResumo: erro ao ler número Taxa Assistencial — " + e.message); }

  return {
    total: total, confirmados: confirmados, pendentes: pendentes,
    filiacao: filiacao, desfiliacao: desfiliacao, taxa: taxa, livre: livre,
    ultimoOficio:  String(maiorNumero).padStart(3,"0")     + "/" + ano,
    proximoOficio: String(maiorNumero + 1).padStart(3,"0") + "/" + ano
  };
}

function dashboardGraficos() {
  var sheet = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(PLANILHA_REGISTRO);
  var ano   = anoAtual_();
  if (!sheet || sheet.getLastRow() < 2) return { tipos: {}, status: {} };

  var headerMap = getHeaderMap_(sheet);
  var colNumero = headerMap["Número do Ofício"];
  var colTipo   = headerMap["TIPO"] || headerMap["Tipo"];
  var colStatus = headerMap["Status"];
  if (!colNumero || !colTipo || !colStatus) return { tipos: {}, status: {} };

  var dados    = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var tipos    = { "Filiação": 0, "Desfiliação": 0, "Taxa Negocial": 0, "Ofício Livre": 0, "Taxa Assistencial": 0 };
  var statusCt = { "ENVIADO": 0, "CONFIRMADO": 0, "PENDENTE": 0 };

  dados.forEach(function(linha) {
    var numero      = String(linha[colNumero - 1] || "").trim();
    var statusLinha = String(linha[colStatus - 1] || "").trim().toUpperCase();
    var tipoLabel   = obterLabelTipoOficio_(linha[colTipo - 1]);
    if (!numero || numero.indexOf("/" + ano) === -1) return;
    var numeroParte = parseInt(numero.split("/")[0], 10);
    if (isNaN(numeroParte) || numeroParte < PRIMEIRO_OFICIO_PLATAFORMA) return;
    if (tipos[tipoLabel]      !== undefined) tipos[tipoLabel]++;
    if (statusCt[statusLinha] !== undefined) statusCt[statusLinha]++;
  });

  try {
    var shFila     = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
    var numeroTaxa = String(PropertiesService.getScriptProperties()
      .getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
    if (shFila && shFila.getLastRow() > 1 && numeroTaxa) {
      shFila.getRange(2, 5, shFila.getLastRow() - 1, 1).getValues().forEach(function(r) {
        var st = String(r[0] || "").trim().toUpperCase();
        if (st === "ENVIADO")       { tipos["Taxa Assistencial"]++; statusCt["ENVIADO"]++; }
        else if (st === "PENDENTE") { statusCt["PENDENTE"]++; }
      });
    }
  } catch(e) { Logger.log("dashboardGraficos: erro ao ler fila Taxa Assistencial — " + e.message); }

  return { tipos: tipos, status: statusCt };
}

/* ================= NUMERAÇÃO ================= */

function preverProximoNumeroOficio() {
  var ss    = SpreadsheetApp.openById(PLANILHA_ID);
  var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sheet) throw new Error("Aba de registro não encontrada.");

  var headerMap = getHeaderMap_(sheet);
  var colNumero = headerMap["Número do Ofício"];
  if (!colNumero) throw new Error("Coluna 'Número do Ofício' não encontrada.");

  var ano        = anoAtual_();
  var maiorNumero = 0;

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, colNumero, sheet.getLastRow() - 1, 1).getValues().forEach(function(r) {
      var texto = String(r[0] || "").trim();
      if (!texto || texto.indexOf("/" + ano) === -1) return;
      var num = parseInt(texto.split("/")[0].trim(), 10);
      if (!isNaN(num) && num > maiorNumero) maiorNumero = num;
    });
  }

  var proximo = String(maiorNumero + 1).padStart(3, "0") + "/" + ano;
  Logger.log("Prévia do próximo número: " + proximo);
  return proximo;
}

function gerarProximoNumeroSeguro() {
  // travarSisgep_ (TravaSisgep.gs): gerarOficioWeb chama esta função e, no
  // ofício de desfiliação, também sindAss_desfiliar_ — que trava igual. Com
  // LockService direto, basta alguém aninhar as duas para travar a emissão.
  var trava = travarSisgep_(15000);

  try {
    var ss    = SpreadsheetApp.openById(PLANILHA_ID);
    var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    var ano   = anoAtual_();
    if (!sheet) throw new Error("Aba de registro não encontrada.");

    var headerMap   = getHeaderMap_(sheet);
    var colNumero   = headerMap["Número do Ofício"];
    if (!colNumero) throw new Error("Coluna 'Número do Ofício' não encontrada.");

    var maiorNumero = PRIMEIRO_OFICIO_PLATAFORMA - 1;

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, colNumero, sheet.getLastRow() - 1, 1).getValues().forEach(function(r) {
        var texto = String(r[0] || "").trim();
        if (!texto || texto.indexOf("/" + ano) === -1) return;
        var num = parseInt(texto.split("/")[0].trim(), 10);
        if (!isNaN(num) && num > maiorNumero) maiorNumero = num;
      });
    }

    try {
      var numeroTaxa = String(PropertiesService.getScriptProperties()
        .getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
      if (numeroTaxa && numeroTaxa.indexOf("/" + ano) > -1) {
        var numTaxa = parseInt(numeroTaxa.split("/")[0].trim(), 10);
        if (!isNaN(numTaxa) && numTaxa > maiorNumero) maiorNumero = numTaxa;
      }
    } catch (e) { Logger.log("[gerarProximoNumeroSeguro] " + e); }

    var proximo = String(maiorNumero + 1).padStart(3, "0") + "/" + ano;
    Logger.log("gerarProximoNumeroSeguro: " + proximo);
    return proximo;

  } finally {
    trava.liberar();
  }
}

/* ================= LOG SISTEMA ================= */

function registrarLogSistema(dadosLog) {
  var ss       = SpreadsheetApp.openById(PLANILHA_ID);
  var logSheet = ss.getSheetByName("LOG_SISTEMA");
  if (!logSheet) {
    logSheet = ss.insertSheet("LOG_SISTEMA");
    logSheet.appendRow(["DATA_HORA","USUARIO","NUMERO","TIPO","ESCOLA","CNPJ","EMAIL_DESTINO","CODIGO","SISTEMA_VERSAO"]);
    protegerLogSistema_(logSheet);
  }
  logSheet.appendRow([
    new Date(), dadosLog.usuario, dadosLog.numero, dadosLog.tipo,
    dadosLog.escola, dadosLog.cnpj, dadosLog.email, dadosLog.codigo, SISTEMA_VERSAO
  ]);

  /* PONTE PARA A TRILHA ÚNICA (item 16 do PROMPT-MESTRE).
   *
   * Primeiro dos 28 pontos de log a ser ligado, e de propósito: Ofícios é a
   * única operação em uso diário, então é a única que alimenta a trilha com
   * movimento real em vez de dado de teste.
   *
   * ADITIVO. O LOG_SISTEMA acima continua gravando exatamente como sempre —
   * nada foi removido nem substituído, e desfazer é apagar este bloco.
   *
   * As duas travas que tornam isto seguro para produção:
   *   1. typeof — se o AuditoriaCore.gs não estiver no projeto, nem chama.
   *   2. try/catch — auditar_() já promete nunca lançar; o catch é o cinto
   *      além do suspensório. Emissão de ofício não pode parar porque a
   *      auditoria teve um problema. */
  try {
    if (typeof aud_deLogSistema_ === "function") aud_deLogSistema_(dadosLog);
  } catch (e) {
    Logger.log("registrarLogSistema — ponte de auditoria falhou (ofício seguiu): " + e);
  }
}

function protegerLogSistema_(sheet) {
  if (!sheet) {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    sheet = ss.getSheetByName("LOG_SISTEMA");
  }
  if (!sheet) return;
  var protecoes = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (protecoes.length > 0) return;
  var protection = sheet.protect();
  protection.setDescription("Proteção automática - LOG_SISTEMA");
  var emailEditorAtual = Session.getEffectiveUser().getEmail() || "financeiro@sindeducacao.com";
  protection.removeEditors(protection.getEditors());
  protection.addEditors([emailEditorAtual, "financeiro@sindeducacao.com"]);
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

/* ================= GERAR PDF ================= */

function gerarPDFOficio(templateId, numero, escola, cnpj, colaboradores, dataHoje, codigo) {
  var pastaAno     = obterOuCriarSubpastaAno(PASTA_OFICIOS_ID);
  var baseUrl      = ScriptApp.getService().getUrl();
  var urlValidacao = baseUrl ? baseUrl + "?codigo=" + codigo : "";
  var nomeBase     = montarNomeArquivoOficio_(numero, escola, colaboradores, new Date()).replace(/\.pdf$/i, "");

  var retorno = gerarPDFUniversal({
    templateId: templateId, nomeArquivo: nomeBase, pastaDestinoId: pastaAno.getId(),
    substituicoes: {
      "{{NUMERO}}": numero, "{{DATA}}": dataHoje, "{{ESCOLA}}": escola,
      "{{CNPJ}}": cnpj, "{{COLABORADORES}}": colaboradores,
      "{{CODIGO}}": codigo, "{{LINK_VALIDACAO}}": urlValidacao
    }
  });
  return retorno.pdf;
}

function gerarPDFOficioLivre(numero, para, cargo, assunto, corpo, dataHoje, codigo, cidadeUf) {
  var pastaAno     = obterOuCriarSubpastaAno(PASTA_OFICIOS_LIVRE_ID);
  var baseUrl      = ScriptApp.getService().getUrl();
  var urlValidacao = baseUrl ? baseUrl + "?codigo=" + codigo : "";
  var nomeBase     = montarNomeArquivoOficio_(numero, para || "", []).replace(/\.pdf$/i, "");
  var templateId   = obterTemplateOficioLivreId_();
  var copia        = DriveApp.getFileById(templateId).makeCopy(nomeBase, pastaAno);
  var doc          = DocumentApp.openById(copia.getId());

  substituirMarcadoresDocumentoOficioLivre_(doc, {
    "{{CIDADE_UF}}":        cidadeUf  || "Vitória/ES",
    "{{DATA_EXTENSO}}":     dataHoje  || "",
    "{{NUMERO_ANO}}":       numero    || "",
    "{{NOME_INSTITUICAO}}": para      || "",
    "{{ASSUNTO}}":          assunto   || "",
    "{{CORPO_TEXTO}}":      corpo     || "",
    "{{NUMERO}}":           numero    || "",
    "{{DATA}}":             dataHoje  || "",
    "{{PARA}}":             para      || "",
    "{{CARGO}}":            cargo     || "",
    "{{CORPO}}":            corpo     || "",
    "{{CODIGO}}":           codigo    || "",
    "{{LINK_VALIDACAO}}":   urlValidacao || ""
  });

  doc.saveAndClose();

  var pdfBlob = copia.getBlob().getAs(MimeType.PDF).setName(nomeBase + ".pdf");
  var pdfFile = pastaAno.createFile(pdfBlob);
  try { copia.setTrashed(true); } catch(e) {}
  return pdfFile;
}

function gerarPDFUniversal(config) {
  var copia = null;
  try {
    if (!config || !config.templateId) throw new Error("Template não informado.");

    var template    = DriveApp.getFileById(config.templateId);
    var pasta       = config.pastaDestinoId ? DriveApp.getFolderById(config.pastaDestinoId) : DriveApp.getRootFolder();
    var nomeArquivo = String(config.nomeArquivo || "Documento").trim();

    copia = template.makeCopy(nomeArquivo, pasta);

    var doc          = DocumentApp.openById(copia.getId());
    var body         = doc.getBody();
    var substituicoes = config.substituicoes || {};

    // 1. Substitui todos os marcadores EXCETO {{CORPO}}
    Object.keys(substituicoes).forEach(function(chave) {
      if (chave === "{{CORPO}}") return;
      var valor = substituicoes[chave] != null ? String(substituicoes[chave]) : "";
      var esc   = String(chave).replace(/([\\^$.*+?()[\]{}|])/g, "\\$1");
      body.replaceText(esc, valor);
      var header = doc.getHeader(); if (header) header.replaceText(esc, valor);
      var footer = doc.getFooter(); if (footer) footer.replaceText(esc, valor);
    });

    // 2. Trata {{CORPO}} preservando parágrafos
    if (substituicoes["{{CORPO}}"]) {
      var corpoTexto = String(substituicoes["{{CORPO}}"] || "").replace(/\r/g, "");
      var linhas     = corpoTexto.split("\n");

      for (var i = 0; i < body.getNumChildren(); i++) {
        var el = body.getChild(i);
        if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
        var par = el.asParagraph();
        if (par.getText().indexOf("{{CORPO}}") === -1) continue;

        par.clear();
        par.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);

        if (linhas[0]) {
          var t0 = par.appendText(linhas[0]);
          t0.setBold(false); t0.setItalic(false); t0.setUnderline(false);
          t0.setFontSize(11); t0.setFontFamily("Arial"); t0.setForegroundColor("#000000");
        }

        for (var l = 1; l < linhas.length; l++) {
          i++;
          var novoPar = body.insertParagraph(i, "");
          novoPar.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
          novoPar.setIndentStart(0); novoPar.setIndentFirstLine(0);
          if (linhas[l]) {
            var t = novoPar.appendText(linhas[l]);
            t.setBold(false); t.setItalic(false); t.setUnderline(false);
            t.setFontSize(11); t.setFontFamily("Arial"); t.setForegroundColor("#000000");
          }
        }
        break;
      }
    }

    // 3. Força justificação em todos os parágrafos
    for (var p = 0; p < body.getNumChildren(); p++) {
      var elP = body.getChild(p);
      if (elP.getType() === DocumentApp.ElementType.PARAGRAPH) {
        elP.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
      }
    }

    doc.saveAndClose();

    var pdfBlob = DriveApp.getFileById(copia.getId()).getBlob().getAs(MimeType.PDF).setName(nomeArquivo + ".pdf");
    var pdfFile = pasta.createFile(pdfBlob);

    return { pdf: pdfFile, docId: copia.getId(), pdfId: pdfFile.getId() };

  } catch (e) {
    Logger.log("❌ ERRO gerarPDFUniversal: " + e.toString());
    throw new Error("Erro ao gerar PDF: " + e.message);
  } finally {
    if (copia) { try { DriveApp.getFileById(copia.getId()).setTrashed(true); } catch(e) {} }
  }
}

/* ================= PREVIEW E GERAÇÃO WEB ================= */

/* Máscara de CNPJ e CPF para o documento.
 *
 * Existem formatadores em Utils.gs e Sindicalizacao.gs, mas eles são de
 * outros módulos e podem não estar carregados quando o ofício é gerado por
 * uma rota pública. Estes dois são locais, sem dependência, e caem para o
 * valor original quando a quantidade de dígitos não bate — imprimir o
 * número como veio é melhor do que imprimir um número cortado. */
function oficios_formatarCnpj_(valor) {
  var d = String(valor || "").replace(/\D/g, "");
  if (d.length !== 14) return String(valor || "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function oficios_formatarCpf_(valor) {
  var d = String(valor || "").replace(/\D/g, "");
  if (d.length !== 11) return String(valor || "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/* Chave de ordenação alfabética em português.
 *
 * localeCompare com locale não é confiável no runtime do Apps Script, e
 * comparar direto joga "Ângela" depois de "Zuleica" — a acentuada vai para
 * o fim da tabela. Tirar o acento antes de comparar resolve, e maiúscula
 * evita que "ana" caia depois de "Bruno". */
function oficios_chaveOrdenacao_(nome) {
  return String(nome || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

function montarDadosOficio_(dados, modo) {
  if (!dados || typeof dados !== "object") throw new Error("Dados inválidos para processamento do ofício.");

  var modoExec    = String(modo || "preview").toLowerCase();
  var dataHoje    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  var dataExtenso = (typeof dataPorExtenso === "function") ? dataPorExtenso() : dataHoje;
  var tipoNorm    = normalizarTipoOficio_(dados.tipo);
  var configTipo  = resolverConfigTipoOficio_(dados.tipo);
  var numero      = modoExec === "preview" ? "Nº PRÉVIA" : gerarProximoNumeroSeguro();

  var codigoVerificacao = numero.replace("/", "-");
  if (modoExec !== "preview" && typeof gerarCodigoVerificacao === "function") {
    try { codigoVerificacao = gerarCodigoVerificacao(numero); } catch (e) { Logger.log("⚠ gerarCodigoVerificacao falhou: " + e.message); }
  }

  /* A lista de pessoas do ofício.
   *
   * Aceita três formas, para não quebrar quem já chama esta função:
   *   - array de textos:    ["MARIA", "JOAO"]
   *   - texto separado por vírgula: "MARIA, JOAO"
   *   - array de objetos:   [{nome:"MARIA", cpf:"123..."}, ...]   ← lote
   *
   * O CPF é OPCIONAL em qualquer uma delas: quem não informar continua
   * gerando o ofício igual, só sem o CPF impresso.
   *
   * `indiceOriginal` guarda a posição em que a pessoa foi digitada, porque
   * as fichas anexadas são casadas com os nomes POR POSIÇÃO em
   * gerarOficioWeb. Sem isso, ordenar a lista renomearia os anexos com o
   * nome da pessoa errada — o tipo de erro que ninguém percebe até chegar
   * na escola. */
  var listaBruta = Array.isArray(dados.colaboradores)
    ? dados.colaboradores
    : String(dados.colaboradores || "").split(",");

  var colaboradoresLista = listaBruta.map(function (item, i) {
    if (item && typeof item === "object") {
      return { nome: String(item.nome || "").trim(),
               cpf:  String(item.cpf  || "").trim(),
               indiceOriginal: i };
    }
    return { nome: String(item || "").trim(), cpf: "", indiceOriginal: i };
  }).filter(function (x) { return x.nome; });

  colaboradoresLista.sort(function (a, c) {
    return oficios_chaveOrdenacao_(a.nome) < oficios_chaveOrdenacao_(c.nome) ? -1
         : oficios_chaveOrdenacao_(a.nome) > oficios_chaveOrdenacao_(c.nome) ?  1 : 0;
  });

  var colaboradoresArr = colaboradoresLista.map(function (x) { return x.nome; });
  var colaboradoresStr = colaboradoresArr.map(function(n, i){ return (i + 1) + ". " + n.toUpperCase(); }).join("\n");

  var corpoTexto = "";
  switch (tipoNorm) {
    case "FILIACAO":
      if (typeof montarTextoFiliacao_ !== "function") throw new Error("Função montarTextoFiliacao_ não encontrada.");
      corpoTexto = montarTextoFiliacao_(dados, colaboradoresArr); break;
    case "DESFILIACAO":
      if (typeof montarTextoDesfiliacao_ !== "function") throw new Error("Função montarTextoDesfiliacao_ não encontrada.");
      corpoTexto = montarTextoDesfiliacao_(dados, colaboradoresArr); break;
    case "TAXA_NEGOCIAL":
      if (typeof montarTextoTaxaNegocial_ !== "function") throw new Error("Função montarTextoTaxaNegocial_ não encontrada.");
      corpoTexto = montarTextoTaxaNegocial_(dados, colaboradoresArr); break;
    case "OPOSICAO_TAXA_NEGOCIAL":
      if (typeof montarTextoOposicaoTaxaNegocial_ !== "function") throw new Error("Função montarTextoOposicaoTaxaNegocial_ não encontrada.");
      corpoTexto = montarTextoOposicaoTaxaNegocial_(dados, colaboradoresArr); break;
    case "TAXA_ASSISTENCIAL":
      if (typeof montarTextoTaxaAssistencial_ !== "function") throw new Error("Função montarTextoTaxaAssistencial_ não encontrada.");
      corpoTexto = montarTextoTaxaAssistencial_(dados, colaboradoresArr); break;
    default:
      corpoTexto = String(dados.corpo || "").trim(); break;
  }

  return {
    modo: modoExec, tipoNorm: tipoNorm, isLivre: tipoNorm === "OFICIO_LIVRE",
    configTipo: configTipo, numero: numero, codigoVerificacao: codigoVerificacao,
    dataHoje: dataHoje, dataExtenso: dataExtenso,
    colaboradoresArr: colaboradoresArr, colaboradoresStr: colaboradoresStr,
    colaboradoresLista: colaboradoresLista,
    corpoTexto: corpoTexto
  };
}

// SEM trava de modulo: mesma razao de gerarOficioWeb — a Sindicalizacao
// monta a previa do oficio de filiacao por aqui. Sessao continua exigida.
function previewOficioWeb(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  Logger.log("✅ previewOficioWeb — " + new Date());
  try {
    var proc       = montarDadosOficio_(dados, "preview");
    var imgs       = carregarImagensOficio_();
    var assuntoTipo = (proc.configTipo && proc.configTipo.assuntoTipo)
      ? proc.configTipo.assuntoTipo : proc.tipoNorm.replace(/_/g, " ");

    var p = {
      numero:       proc.numero,
      tipoNorm:     proc.tipoNorm,
      assuntoTipo:  assuntoTipo,
      assunto:      dados.assunto || assuntoTipo,
      escola:       dados.escola || "",
      para:         dados.para || "",
      cnpj:         formatarCnpj_(dados.cnpj || ""),
      colaboradores: proc.colaboradoresArr || [],
      colaboradoresLista: proc.colaboradoresLista || [],
      corpoTexto:   proc.corpoTexto || "",
      dataHoje:     proc.dataExtenso || proc.dataHoje,
      assBase64:    imgs.assBase64,
      assMime:      imgs.assMime
    };

    return gerarHtmlOficioCompleto_(p, true);

  } catch (e) {
    Logger.log("❌ Erro em previewOficioWeb: " + e.message);
    return "<html><body><p>Erro: " + e.message + "</p></body></html>";
  }
}

// SEM trava de modulo: a Sindicalizacao gera o oficio de filiacao e de
// desfiliacao por aqui (SindicalizacaoOficio.gs e a leitura por IA).
// Exigir Documentos quebraria a filiacao de quem so tem Sindicalizacao.
// Sessao continua exigida.
// A variavel PRECISA se chamar sessaoDocumentos. A linha de baixo le esse
// nome, e o restante do projeto (outras 42 ocorrencias) usa o mesmo. Aqui a
// declaracao estava como "sessao" e a leitura como "sessaoDocumentos": gerar
// oficio devolvia "sessaoDocumentos is not defined" dentro do try, virava
// {erro:true} e a tela mostrava a falha sem dizer a causa. Achado por teste
// de execucao em 2026-08-05 (tests/e2e/t1-documentos.js).
function gerarOficioWeb(dados, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();
    if (!dados || typeof dados !== "object") throw new Error("Dados inválidos.");
    if (!dados.tipo) throw new Error("Tipo de documento não informado.");

    var ss    = SpreadsheetApp.openById(PLANILHA_ID);
    var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet) throw new Error("Aba de registro não encontrada: " + PLANILHA_REGISTRO);

    var configTipo  = resolverConfigTipoOficio_(dados.tipo);
    var assuntoTipo = configTipo.assuntoTipo;
    var tituloEmail = configTipo.tituloEmail;
    var isLivre     = configTipo.isLivre;

    if (isLivre) {
      if (!dados.para)    throw new Error("Destinatário é obrigatório.");
      if (!dados.email)   throw new Error("E-mail é obrigatório.");
      if (!dados.assunto) throw new Error("O assunto do ofício é obrigatório.");
      if (!dados.corpo)   throw new Error("O corpo do ofício é obrigatório.");
    } else {
      if (!dados.escola) throw new Error("Escola é obrigatória.");
      if (!dados.cnpj)   throw new Error("CNPJ é obrigatório.");
      dados.cnpj = String(dados.cnpj || "").replace(/\D/g, "");
      if (dados.cnpj.length !== 14) throw new Error("CNPJ inválido.");
      if (!dados.email)  throw new Error("E-mail é obrigatório.");
    }

    // Prevenção de duplicidade (achado #4): avisa e deixa o atendente confirmar,
    // não bloqueia — a mesma escola pode legitimamente receber dois ofícios do
    // mesmo tipo no mesmo dia (ex.: desfiliação seguida de nova filiação).
    // Só se aplica aos tipos institucionais (não ao Ofício Livre, que não usa
    // escola/CNPJ). dados.confirmarDuplicata vem true quando o atendente já
    // confirmou o aviso no passo anterior.
    if (!isLivre && !dados.confirmarDuplicata) {
      var duplicata = verificarDuplicata({ escola: dados.escola, cnpj: dados.cnpj, tipo: assuntoTipo });
      if (duplicata && duplicata.duplicata) {
        return {
          erro: false,
          duplicataDetectada: true,
          duplicata: duplicata,
          mensagem: "Já existe um ofício de " + assuntoTipo + " para " + (duplicata.escola || dados.escola) +
            (duplicata.numeroExistente ? " (nº " + duplicata.numeroExistente + ")" : "") +
            (duplicata.dataExistente ? ", gerado em " + duplicata.dataExistente : "") +
            " nas últimas 24h. Confirme se deseja gerar mesmo assim."
        };
      }
    }

    var validacaoEmails = validarListaEmails_(dados.email || "");
    if (!validacaoEmails.ok) {
      if (!validacaoEmails.emails.length) throw new Error("Informe pelo menos um e-mail válido.");
      throw new Error("E-mail inválido: " + validacaoEmails.invalido);
    }
    dados.email       = validacaoEmails.principal;
    dados.emailsTodos = validacaoEmails.todos;

    var proc = montarDadosOficio_(dados, "gerar");

    /* Ofício de taxa não é ofício de filiação.
     *
     * Filiação e desfiliação nascem de um documento assinado: a ficha é a
     * prova da autorização do desconto, e sem ela o ofício não deve sair.
     * As três taxas são cobrança prevista na CCT — a escola deve recolher
     * de todo o quadro técnico-administrativo, filiado ou não, e não existe
     * ficha para anexar. Exigir ficha ali era trabalho inútil: o usuário
     * teria que juntar 50 documentos para mandar uma lista de nomes.
     *
     * Por isso o limite também é diferente: 25 no que depende de ficha, 50
     * nas taxas, que é o que ele pediu para o lote. */
    var exigeFicha  = (proc.tipoNorm === "FILIACAO" || proc.tipoNorm === "DESFILIACAO");
    var limitePessoas = exigeFicha ? LIMITE_ASSOCIADOS : LIMITE_PESSOAS_TAXA;

    if (!proc.isLivre) {
      if (!proc.colaboradoresArr.length) throw new Error("Informe o(s) colaborador(es).");
      if (proc.colaboradoresArr.length > limitePessoas) {
        throw new Error("Limite máximo de " + limitePessoas + " pessoas por ofício. Recebido: " + proc.colaboradoresArr.length + ".");
      }
      if (exigeFicha) {
        if (!Array.isArray(dados.fichas) || dados.fichas.length === 0) throw new Error("É obrigatório anexar pelo menos uma ficha.");
        if (dados.fichas.length > limitePessoas) throw new Error("Limite máximo de " + limitePessoas + " fichas por ofício. Recebido: " + dados.fichas.length + ".");
        /* A quantidade de fichas NÃO precisa mais bater com a de pessoas.
         *
         * Até 18/08/2026 exigia-se uma ficha por colaborador. O usuário
         * apontou o caso real que a regra ignorava: "geralmente quando você
         * escaneia, vem um arquivo só com todas as fichas". Ou seja, o
         * formato mais comum na secretaria — um PDF único com 25 fichas
         * dentro — era justamente o que a validação recusava.
         *
         * Continua obrigatório anexar ALGUMA ficha em filiação e
         * desfiliação: ali a ficha é a prova da autorização do desconto, e
         * sem nenhuma o ofício não deve sair. O que caiu foi a exigência de
         * contagem exata. */
      }
    }

    /* A lista sai do montarDadosOficio_ em ordem alfabética, mas as fichas
     * chegaram na ordem em que foram digitadas. Reordenar as fichas pela
     * posição original de cada pessoa mantém o casamento nome↔ficha — sem
     * isto, o anexo da Ana sairia com o nome do Bruno. */
    if (exigeFicha && Array.isArray(dados.fichas) && dados.fichas.length === proc.colaboradoresLista.length) {
      /* Só reordena quando é uma ficha por pessoa — com o arquivo único
       * escaneado não há par a preservar. */
      dados.fichas = proc.colaboradoresLista.map(function (pessoa) {
        return dados.fichas[pessoa.indiceOriginal];
      });
    }

    var imgs = carregarImagensOficio_();
    var p = {
      numero:        proc.numero,
      tipoNorm:      proc.tipoNorm,
      assuntoTipo:   assuntoTipo,
      assunto:       dados.assunto || assuntoTipo,
      escola:        dados.escola || "",
      para:          dados.para || "",
      cargo:         dados.cargo || "",
      instituicao:   dados.instituicao || "",
      cnpj:          dados.cnpj || "",
      colaboradores: proc.colaboradoresArr || [],
      colaboradoresLista: proc.colaboradoresLista || [],
      corpoTexto:    proc.corpoTexto || "",
      dataHoje:      proc.dataExtenso || proc.dataHoje,
      assBase64:     imgs.assBase64,
      assMime:       imgs.assMime
    };

    var htmlOficio = gerarHtmlOficioCompleto_(p, false);
    var pastaAno   = obterPastaPorTipo_(proc.tipoNorm);
    var nomeBase   = montarNomeArquivoOficio_(proc.numero, dados.escola || dados.para || "", proc.colaboradoresArr, new Date()).replace(/\.pdf$/i, "");
    var pdfFile    = oficios_converterHtmlParaPdf_(htmlOficio, nomeBase, pastaAno);

    var anexosFila = [{ nome: pdfFile.getName(), mimeType: MimeType.PDF, fileId: pdfFile.getId() }];

    /* Ofício de taxa não tem ficha para anexar — e agora pode não ter
     * mesmo, sem isto o forEach explodiria em `undefined.forEach`. */
    /* Uma ficha por pessoa: o anexo leva o nome da pessoa. Um arquivo só com
     * várias fichas dentro (o escaneado): não dá para dizer de quem é, e
     * batizar com o nome do primeiro da lista seria informação errada no
     * nome do arquivo. Nesse caso o anexo é numerado. */
    var fichaPorPessoa = !proc.isLivre && Array.isArray(dados.fichas) &&
                         dados.fichas.length === proc.colaboradoresArr.length;

    /* Nome do arquivo do lote: escola e data.
     *
     * Pedido do usuário em 18/08/2026 — "na hora de salvar pode colocar o
     * nome da escola e a data" — e faz sentido com o formato que ele
     * descreveu: "seria um PDF de fichas para cada escola por dia". Assim o
     * arquivo se identifica sozinho na pasta do Drive, sem depender de
     * abrir para saber de quem é. */
    var escolaArquivo = String(dados.escola || dados.para || "ESCOLA")
      .toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").slice(0, 45) || "ESCOLA";
    var dataArquivo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy");

    if (!proc.isLivre && Array.isArray(dados.fichas)) {
      dados.fichas.forEach(function(ficha, indice) {
        var extensao = obterExtensaoArquivo_(ficha.nome, ficha.tipo);
        var nomeArquivo;
        if (fichaPorPessoa) {
          var nomeFormatado = String(proc.colaboradoresArr[indice] || "ASSOCIADO")
            .toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
          nomeArquivo = "Ficha_Filiacao_" + nomeFormatado + "." + extensao;
        } else {
          /* Um PDF por escola por dia: o número de ordem só entra quando há
           * mais de um arquivo, para o caso comum não ganhar um "_1" inútil. */
          nomeArquivo = "Fichas_" + escolaArquivo + "_" + dataArquivo +
            (dados.fichas.length > 1 ? "_" + (indice + 1) : "") + "." + extensao;
        }
        var blob        = Utilities.newBlob(Utilities.base64Decode(ficha.base64), ficha.tipo || "application/pdf", nomeArquivo);
        var arquivoFicha = pastaAno.createFile(blob);
        anexosFila.push({ nome: arquivoFicha.getName(), mimeType: ficha.tipo || "application/pdf", fileId: arquivoFicha.getId() });
      });
    }

    var qtdFichas          = (proc.isLivre || !Array.isArray(dados.fichas)) ? 0 : dados.fichas.length;
    // Texto digitado pelo atendente (Ofício Livre) — escapado antes de entrar no
    // e-mail para não permitir injeção de HTML. Os textos padrão dos demais tipos
    // (Filiação/Desfiliação/Taxas) são montados internamente por montarEmailHTML e
    // usam <strong> de propósito, por isso o escaping é feito aqui, não lá dentro.
    var textoPrincipalEmail = escapeHtml_(dados.textoPrincipal || dados.corpo || "");
    var htmlBody     = montarEmailHTML(tituloEmail, proc.numero, assuntoTipo, qtdFichas, textoPrincipalEmail);
    var assuntoEmail = tituloEmail + " Nº " + proc.numero;

    var retornoFila = criarFilaEnvioOficio_({
      numeroOficio:      proc.numero,
      tipo:              assuntoTipo,
      escola:            proc.isLivre ? (dados.para || "") : (dados.escola || ""),
      cnpj:              proc.isLivre ? "" : (dados.cnpj || ""),
      emailPrincipal:    dados.email || "",
      emailsTodos:       dados.emailsTodos || dados.email || "",
      assunto:           assuntoEmail,
      htmlBody:          htmlBody,
      anexos:            anexosFila,
      usuario:           emailUsuario,
      codigoVerificacao: proc.codigoVerificacao
    });

    var urlView = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";

    appendRowByHeader_(sheet, {
      "Status":                "PENDENTE",
      "Número do Ofício":      proc.numero,
      "CONFIG":                proc.codigoVerificacao,
      "Log_Sistema":           emailUsuario,
      "Sistema_Versão":        SISTEMA_VERSAO,
      "Data envio ofício":     new Date(),
      "TIPO":                  assuntoTipo,
      "Unidade":               dados.unidade || "",
      "Escola (Razão Social)": proc.isLivre ? (dados.para || "") : (dados.escola || ""),
      "CNPJ":                  proc.isLivre ? "" : (dados.cnpj || ""),
      "E-mail (principal)":    dados.email || "",
      "E-mails (todos)":       dados.emailsTodos || dados.email || "",
      "Colaborador(es)":       proc.isLivre ? "" : proc.colaboradoresStr,
      "Observações":           proc.isLivre ? (dados.assunto || "") : (dados.observacoes || ""),
      "Link PDF (Drive)":      urlView,
      "Link Ficha":            ""
    });

registrarLogSistema({
      usuario: emailUsuario,
      numero:  proc.numero + " (FILA)",
      tipo:    assuntoTipo,
      escola:  proc.isLivre ? dados.para : dados.escola,
      cnpj:    proc.isLivre ? "" : dados.cnpj,
      email:   dados.emailsTodos || dados.email,
      codigo:  proc.codigoVerificacao
    });

    // ✅ Registra automaticamente na Mensalidade_Controle se for Filiação
    if (proc.tipoNorm === "FILIACAO") {
      try {
        registrarOficioNaMensalidade({
          tipo:          assuntoTipo,
          escola:        dados.escola || "",
          numero:        proc.numero,
          colaboradores: proc.colaboradoresArr || [],
          colaboradoresLista: proc.colaboradoresLista || [],
          cpfs:          Array.isArray(dados.cpfs) ? dados.cpfs : []
        });
        Logger.log("✅ Mensalidade_Controle atualizado — Ofício " + proc.numero);
      } catch (eMens) {
        Logger.log("⚠ Erro ao registrar mensalidade (não crítico): " + eMens.message);
      }
    }

    // ✅ Atualiza o cadastro do associado (Filiado=N) automaticamente se for
    // Desfiliação — sem isso, o ofício sai certinho mas o cadastro continua
    // "ativo" pra sempre (achado crítico da auditoria de Sindicalização: só
    // o caminho de desfiliação via leitura de carta por IA fazia essa
    // atualização, o caminho manual — o mais usado — nunca fazia).
    // Vive aqui em vez de em cada chamador porque tanto o formulário manual
    // quanto confirmarDesfiliacaoIA passam por gerarOficioWeb — um lugar só,
    // os dois caminhos ganham a correção.
    var avisosDesfiliacao = [];
    if (proc.tipoNorm === "DESFILIACAO") {
      var cpfsDesfiliar = Array.isArray(dados.cpfs) ? dados.cpfs : [];
      if (!cpfsDesfiliar.length) {
        avisosDesfiliacao.push("Ofício de desfiliação gerado sem CPF informado — o cadastro do(s) associado(s) NÃO foi atualizado automaticamente. Atualize manualmente em Sindicalização.");
      } else if (typeof sindAss_desfiliar_ !== "function") {
        avisosDesfiliacao.push("Ofício gerado, mas o módulo de Sindicalização não está disponível — atualize o cadastro manualmente.");
      } else {
        cpfsDesfiliar.forEach(function(cpfDesfiliar, idx) {
          var rotulo = (proc.colaboradoresArr && proc.colaboradoresArr[idx]) || cpfDesfiliar;
          try {
            var resultadoDesfiliar = sindAss_desfiliar_(cpfDesfiliar, emailUsuario, tokenSessao);
            if (!resultadoDesfiliar || !resultadoDesfiliar.encontrado) {
              avisosDesfiliacao.push('Nenhum associado com o CPF de "' + rotulo + '" foi encontrado na base — atualize manualmente se necessário.');
            }
          } catch (eDesf) {
            Logger.log("gerarOficioWeb — sindAss_desfiliar_ falhou (" + cpfDesfiliar + "): " + eDesf.message);
            avisosDesfiliacao.push('Não foi possível atualizar o cadastro de "' + rotulo + '": ' + eDesf.message);
          }
        });
      }
    }

    return {
      erro:  false,
      dados: {
        numero:             proc.numero,
        codigoVerificacao:  proc.codigoVerificacao,
        url:                urlView,
        filaId:             retornoFila && retornoFila.id ? retornoFila.id : "",
        statusFila:         "PENDENTE",
        avisosDesfiliacao:  avisosDesfiliacao
      },
      mensagem: "Ofício gerado e adicionado à fila de envio com sucesso."
    };

  } catch (e) {
    Logger.log("❌ Erro em gerarOficioWeb: " + e.message);
    return { erro: true, mensagem: e.message };
  }
}

/* ================= HTML DO OFÍCIO ================= */

function gerarHtmlOficioCompleto_(p, isPreview) {
  p = p || {};

  var assTag = p.assBase64
    ? '<img src="data:' + p.assMime + ';base64,' + p.assBase64 + '" style="height:52px;width:auto;object-fit:contain;display:block;margin:0 auto 2px;">'
    : '';

  var watermark = isPreview
    ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(0,31,77,.025);pointer-events:none;user-select:none;white-space:nowrap;z-index:0;">PR\u00c9VIA</div>'
    : '';

  var actionBar = isPreview
    ? '<div class="no-print" style="position:fixed;top:0;left:0;right:0;height:56px;background:#001f4d;display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.3);">' +
      '<div style="display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;font-weight:700;">&#x1F4C4; Of\u00edcio' +
      '<span style="background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">PR\u00c9-VISUALIZA\u00c7\u00c3O</span></div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button onclick="window.print()" style="height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">&#x1F5A8; Imprimir</button>' +
      '<button onclick="window.location.reload()" style="height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">&#x1F504; Atualizar</button>' +
      '</div></div>'
    : '';

  var avisoHTML = isPreview
    ? '<div class="no-print" style="max-width:780px;margin:0 auto 16px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12.5px;color:#92400e;line-height:1.5;">' +
      '<span style="font-size:18px;flex-shrink:0;">&#x26A0;&#xFE0F;</span>' +
      '<div><strong style="display:block;font-size:13px;color:#78350f;margin-bottom:2px;">Documento n\u00e3o emitido oficialmente</strong>' +
      'Esta \u00e9 apenas uma pr\u00e9-visualiza\u00e7\u00e3o. Nenhum n\u00famero foi gerado e nenhum dado foi gravado.</div></div>'
    : '';

  var topPad = isPreview ? '76px 24px 48px' : '0';

  var badgeCor = "#334155";
  var refTexto = p.assuntoTipo || "";
  if      (p.tipoNorm === "FILIACAO")          { badgeCor = "#d97706"; refTexto = "Comunicado de Filia\u00e7\u00e3o Sindical"; }
  else if (p.tipoNorm === "DESFILIACAO")       { badgeCor = "#b91c1c"; refTexto = "Comunicado de Desfilia\u00e7\u00e3o Sindical"; }
  else if (p.tipoNorm === "TAXA_NEGOCIAL")     { badgeCor = "#0369a1"; refTexto = "Cobran\u00e7a de Taxa Negocial"; }
  else if (p.tipoNorm === "OPOSICAO_TAXA_NEGOCIAL") { badgeCor = "#7c3aed"; refTexto = "Oposi\u00e7\u00e3o \u00e0 Taxa Negocial"; }
  else if (p.tipoNorm === "TAXA_ASSISTENCIAL") { badgeCor = "#166534"; refTexto = "Repasse de Taxa Assistencial"; }
  else if (p.tipoNorm === "OFICIO_LIVRE")      { badgeCor = "#334155"; refTexto = p.assunto || "Of\u00edcio Sindical"; }

  var nomeEscola         = String(p.escola || p.para || "");
var iniciais = nomeEscola.split(/\s+/).filter(function(w){ return w.length > 2 && /^[a-zA-ZÀ-ÿ]/.test(w); }).slice(0, 2).map(function(w){ return w[0].toUpperCase(); }).join("") || "SE";
  var escolaNomeFontSize = nomeEscola.length <= 30 ? "15px" : nomeEscola.length <= 50 ? "13px" : "11px";

  var blocoColabHTML = "";
  /* A lista de nomes sai em TODO ofício nominal — não só filiação e
   * desfiliação.
   *
   * Até 17/08/2026 a condição citava os dois tipos pelo nome, e Taxa
   * Negocial, Taxa Assistencial e Oposição saíam sem nome nenhum: o
   * usuário informava até 25 pessoas, anexava uma ficha para cada, e o
   * documento chegava à escola sem dizer de quem descontar. Medido antes
   * de mexer: 0 de 25 nomes no PDF de Taxa Negocial, contra 25 de 25 no
   * de filiação.
   *
   * Agora a regra é pela natureza do ofício, não por lista de tipos: todo
   * ofício que tem colaborador mostra os colaboradores. Só o OFÍCIO LIVRE
   * fica de fora, porque nele o corpo é escrito à mão e não existe lista.
   * Escrito assim, o próximo tipo nominal que aparecer já nasce certo. */
  if (p.tipoNorm !== "OFICIO_LIVRE" && p.colaboradores && p.colaboradores.length > 0) {
    /* A lista pode vir de duas formas: como array de nomes (chamadas
     * antigas) ou como array de {nome, cpf} (lote). Normalizamos aqui para
     * a montagem não precisar saber de onde veio. */
    var listaColab = (p.colaboradoresLista && p.colaboradoresLista.length)
      ? p.colaboradoresLista
      : p.colaboradores.map(function (n) { return { nome: n, cpf: "" }; });

    var itens = listaColab.map(function(pessoa, i) {
      var nome = String(pessoa && pessoa.nome !== undefined ? pessoa.nome : pessoa);
      var cpfBruto = String(pessoa && pessoa.cpf ? pessoa.cpf : "").replace(/\D/g, "");
      /* CPF é opcional: quem não informou não ganha linha vazia no documento. */
      var cpfHTML = cpfBruto
        ? '<div style="font-size:11px;color:#64748b;margin-top:2px;letter-spacing:.02em;">CPF: ' +
            escapeHtml_(oficios_formatarCpf_(cpfBruto)) + '</div>'
        : '';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;' + (i % 2 === 0 ? 'background:#f8fafc;' : 'background:#fff;') + 'border-bottom:1px solid #f1f5f9;">' +
        '<div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#001f4d,#1565C0);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">' + (i + 1) + '</div>' +
        '<div><div style="font-size:13px;font-weight:700;color:#0f172a;">' + escapeHtml_(nome) + '</div>' + cpfHTML + '</div>' +
        '<div style="margin-left:auto;width:18px;height:18px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;"><span style="color:#166534;font-size:11px;">&#x2713;</span></div>' +
        '</div>';
    }).join("");

    blocoColabHTML =
      '<div style="margin:0 28px 16px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#001f4d,#002f6c);padding:10px 14px;display:flex;align-items:center;gap:8px;">' +
      '<span style="font-size:14px;">&#x1F464;</span>' +
      '<span style="font-size:11px;font-weight:900;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.08em;">Colaborador(es)</span>' +
      '<span style="margin-left:auto;background:#C9A84C;color:#001f4d;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">' + p.colaboradores.length + '</span>' +
      '</div>' + itens + '</div>';
  }

  var corpoHTML = "";
  if (p.corpoTexto) {
    var paragrafos = String(p.corpoTexto).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().split(/\n\s*\n/);
    corpoHTML = paragrafos.map(function(par, idx) {
      var texto = escapeHtml_(par.trim()).replace(/\n/g, "<br>");
      if (idx === 0) return '<p style="font-size:13.5px;line-height:1.9;color:#111827;font-weight:500;margin:0 0 14px 0;">' + texto + '</p>';
      return '<p style="font-size:13.5px;line-height:1.9;color:#111827;text-align:justify;text-indent:1.25cm;margin:0 0 14px 0;">' + texto + '</p>';
    }).join("");
  }

  /* CNPJ com máscara. O cadastro guarda só os dígitos, e o documento saía
   * com "36136001000105" na cara da escola. Se vier com quantidade de
   * dígitos que não é 14, imprime como veio — melhor um número estranho
   * do que um número mutilado por uma máscara que não serve. */
  var cnpjHTML   = p.cnpj ? '<div style="font-size:12px;color:#475569;margin-top:3px;">CNPJ: ' + escapeHtml_(oficios_formatarCnpj_(p.cnpj)) + '</div>' : '';
  var numeroEsc  = escapeHtml_(p.numero || 'PR\u00c9VIA');

  return "<!DOCTYPE html>\n" +
    "<html lang=\"pt-BR\">\n<head>\n" +
"<meta charset=\"UTF-8\">\n" +
"<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">\n" +
    "<title>Of\u00edcio " + numeroEsc + " \u2014 SindEduca\u00e7\u00e3o-ES</title>\n" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap\" rel=\"stylesheet\">\n" +
    "<style>\n" +
    "*,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }\n" +
    "html,body{ width:100%; min-height:100%; font-family:'Plus Jakarta Sans',Arial,sans-serif; background:#eef2f7; color:#0f172a; }\n" +
    "body{ padding:" + topPad + "; }\n" +
    "@page{ size:A4 portrait; margin:0.3cm; }\n" +
    ".pw{ width:100%; display:flex; justify-content:center; }\n" +
    ".rec{ width:100%; max-width:780px; background:#fff; overflow:hidden; border-radius:8px; box-shadow:0 6px 30px rgba(0,20,60,.12); position:relative; page-break-inside:avoid; }\n" +
    "@media print{\n" +
    "  @page{ size:A4 portrait; margin:0.3cm; }\n" +
    "  html,body{ width:210mm!important; min-height:auto!important; background:#fff!important; }\n" +
    "  body{ padding:0!important; }\n" +
    "  .no-print{ display:none!important; }\n" +
    "  .pw{ width:100%; display:flex; justify-content:center; padding:16px; }\n" +
    "  .rec{ width:100%!important; max-width:200mm!important; margin:0 auto!important; border-radius:0!important; box-shadow:none!important; }\n" +
    "}\n</style>\n</head>\n<body>\n" +
    watermark + "\n" +
    actionBar + "\n" +
    avisoHTML + "\n" +
    "<div class=\"pw\"><div class=\"rec\">\n\n" +

    "<div style=\"background:linear-gradient(135deg,#001f4d,#003b82);padding:18px 28px 16px;border-bottom:4px solid #C9A84C;\">" +
    "<div style=\"display:flex;align-items:flex-start;justify-content:space-between;gap:20px;\">" +
    "<div style=\"border-left:4px solid #C9A84C;padding-left:18px;flex:1;\">" +
"<div style=\"font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.3px;line-height:1;\">SINDEDUCAÇÃO-ES</div>" +
"<div style=\"font-size:11.5px;color:rgba(255,255,255,.75);margin-top:6px;line-height:1.55;\">Sindicato dos Educadores T&eacute;cnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do Esp&iacute;rito Santo</div>" +
    "<div style=\"font-size:11px;font-weight:900;color:#C9A84C;margin-top:8px;\">CNPJ: 31.815.780/0001-51</div>" +
    "</div>" +
    "<div style=\"width:1px;height:64px;background:rgba(255,255,255,.15);flex-shrink:0;margin-top:2px;\"></div>" +
    "<div style=\"text-align:right;flex-shrink:0;\">" +
    "<div style=\"font-size:10px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px;\">Of\u00edcio N\u00ba</div>" +
    "<div style=\"font-size:28px;font-weight:900;color:#C9A84C;line-height:1;letter-spacing:-0.5px;\">" + numeroEsc + "</div>" +
    "</div></div></div>\n\n" +

    "<div style=\"padding:14px 28px 0;\">" +
    "<div style=\"display:inline-flex;align-items:center;gap:6px;background:" + badgeCor + ";color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em;\">" + escapeHtml_(p.assuntoTipo || '') + "</div>" +
    "</div>\n\n" +

    "<div style=\"margin:14px 28px;border:1px solid #cfd8e3;border-left:4px solid #001f4d;border-radius:14px;display:grid;grid-template-columns:58% 42%;overflow:hidden;\">" +
    "<div style=\"padding:14px;display:flex;align-items:center;gap:12px;border-right:1px solid #d8e0ec;\">" +
    "<div style=\"width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#001f4d,#1565C0);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#C9A84C;flex-shrink:0;\">" + escapeHtml_(iniciais) + "</div>" +
    "<div style=\"flex:1;min-width:0;\">" +
    "<div style=\"font-size:" + escolaNomeFontSize + ";font-weight:900;color:#001f4d;line-height:1.2;word-break:break-word;\">" + escapeHtml_(nomeEscola) + "</div>" +
    cnpjHTML + "</div></div>" +
    "<div style=\"padding:14px;background:#f8fafc;display:flex;flex-direction:column;justify-content:center;\">" +
    "<div style=\"font-size:10px;font-weight:900;color:#001f4d;text-transform:uppercase;letter-spacing:.10em;margin-bottom:6px;\">Ref.</div>" +
    "<div style=\"font-size:13px;font-weight:700;color:#0f172a;line-height:1.4;\">" + escapeHtml_(refTexto) + "</div>" +
    "</div></div>\n\n" +

    blocoColabHTML + "\n\n" +

    "<div style=\"padding:0 28px 16px;\">" + corpoHTML + "</div>\n\n" +

    "<div style=\"padding:16px 28px 24px;border-top:1px solid #e2e8f0;text-align:center;\">" +
    "<div style=\"display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:12px;\">" +
    "<div style=\"flex:1;max-width:100px;height:2px;background:#C9A84C;border-radius:999px;\"></div>" +
    "<span style=\"font-size:11px;font-weight:800;color:#C9A84C;text-transform:uppercase;letter-spacing:.10em;\">Local e Data</span>" +
    "<div style=\"flex:1;max-width:100px;height:2px;background:#C9A84C;border-radius:999px;\"></div></div>" +
    "<div style=\"font-size:14px;font-weight:700;color:#0f172a;margin-bottom:40px;\">Vit\u00f3ria/ES, <strong>" + escapeHtml_(p.dataHoje || '') + ".</strong></div>" +
    "<div style=\"max-width:260px;margin:0 auto;text-align:center;\">" +
    "<div style=\"height:70px;display:flex;align-items:flex-end;justify-content:center;\">" + assTag + "</div>" +
    "<div style=\"height:2px;background:#111827;width:100%;margin-bottom:10px;\"></div>" +
    "<div style=\"font-size:14px;font-weight:900;color:#0f172a;\">LEONIL DIAS DA SILVA</div>" +
    "<div style=\"font-size:12px;color:#475569;margin-top:4px;\">Presidente \u2014 SindEduca\u00e7\u00e3o-ES</div>" +
    "</div></div>\n\n" +

    "<div style=\"background:#001f4d;padding:18px 28px 14px;\">" +
"<div style=\"font-size:14px;font-weight:900;color:#fff;text-align:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.1);\">SINDEDUCAÇÃO-ES</div>" +
    "<div style=\"text-align:center;display:flex;flex-direction:column;gap:7px;\">" +
    "<div style=\"font-size:11px;color:rgba(255,255,255,.7);\">Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 \u2014 Enseada do Su\u00e1 \u00b7 Vit\u00f3ria/ES \u00b7 CEP 29.050-355</div>" +
    "<div style=\"display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap;\">" +
    "<span style=\"font-size:11px;color:rgba(255,255,255,.7);\">(27) 99735-8900</span>" +
    "<span style=\"font-size:11px;color:rgba(255,255,255,.3);\">&#xB7;</span>" +
    "<span style=\"font-size:11px;color:rgba(255,255,255,.7);\">secretaria@sindeducacao.com</span>" +
    "<span style=\"font-size:11px;color:rgba(255,255,255,.3);\">&#xB7;</span>" +
    "<span style=\"font-size:11px;color:rgba(255,255,255,.7);\">www.sindeducacao.com.br</span>" +
    "</div></div>" +
    "<div style=\"margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);text-align:center;\">" +
    "<span style=\"font-size:10px;color:rgba(255,255,255,.3);\">Documento gerado pelo SISGEP \u00b7 " + numeroEsc + "</span>" +
    "</div></div>\n\n" +

    "</div></div>\n</body>\n</html>";
}

/* ================= VALIDAÇÃO PÚBLICA ================= */

function verificarCodigoPublico(codigo) {
  var ss    = SpreadsheetApp.openById(PLANILHA_ID);
  var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sheet || sheet.getLastRow() < 2) return { status: "INVALIDO", mensagem: "Nenhum registro encontrado." };

  var headerMap = getHeaderMap_(sheet);
  var colCodigo = headerMap["CONFIG"];
  if (!colCodigo) return { status: "INVALIDO", mensagem: "Coluna CONFIG não encontrada." };

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var cod    = String(codigo || "").trim().toUpperCase();

  for (var i = 0; i < values.length; i++) {
    var linha = values[i];
    if (String(linha[colCodigo - 1] || "").trim().toUpperCase() !== cod) continue;

    var dataVal = headerMap["Data envio ofício"] && linha[headerMap["Data envio ofício"] - 1]
      ? linha[headerMap["Data envio ofício"] - 1] : null;

    return {
      status: "VALIDO",
      numero: headerMap["Número do Ofício"] ? String(linha[headerMap["Número do Ofício"] - 1] || "") : "",
      tipo:   (headerMap["TIPO"] || headerMap["Tipo"]) ? String(linha[(headerMap["TIPO"] || headerMap["Tipo"]) - 1] || "") : "",
      escola: headerMap["Escola (Razão Social)"] ? String(linha[headerMap["Escola (Razão Social)"] - 1] || "") : "",
      data:   formatarDataHoraBR_(dataVal),
      link:   headerMap["Link PDF (Drive)"] ? String(linha[headerMap["Link PDF (Drive)"] - 1] || "") : ""
    };
  }

  return { status: "INVALIDO", mensagem: "Código não encontrado." };
}

function validarPublico(codigo) {
  var resultado = verificarCodigoPublico(codigo) || {};
  var esc = function(valor) { return escapeHtml_(String(valor == null ? "" : valor)); };
  var linkSeguro = String(resultado.link || "").trim();
  if (!/^https:\/\/drive\.google\.com\//i.test(linkSeguro)) linkSeguro = "";

  var html = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Valida\u00e7\u00e3o \u2014 SISGEP</title>"
    + "<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}"
    + ".card{max-width:520px;width:100%;background:#fff;border-radius:20px;padding:36px;box-shadow:0 10px 40px rgba(10,22,40,.1);text-align:center;}"
    + ".icon{font-size:48px;margin-bottom:16px;}h2{font-size:22px;margin-bottom:16px;}"
    + ".field{text-align:left;margin-bottom:12px;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #dbe5f0;}"
    + ".field-lbl{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px;}"
    + ".field-val{font-size:14px;font-weight:600;color:#0a1628;}"
    + "a.btn{display:inline-block;margin-top:18px;padding:12px 24px;background:#003366;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;}"
    + "</style></head><body><div class='card'>";

  if (resultado.status === "VALIDO") {
    html += "<div class='icon'>&#x2705;</div><h2 style='color:#166534;'>Documento V\u00e1lido</h2>"
      + (resultado.numero ? "<div class='field'><div class='field-lbl'>N\u00famero</div><div class='field-val'>" + esc(resultado.numero) + "</div></div>" : "")
      + (resultado.tipo   ? "<div class='field'><div class='field-lbl'>Tipo</div><div class='field-val'>" + esc(resultado.tipo) + "</div></div>" : "")
      + (resultado.escola ? "<div class='field'><div class='field-lbl'>Escola</div><div class='field-val'>" + esc(resultado.escola) + "</div></div>" : "")
      + (resultado.data   ? "<div class='field'><div class='field-lbl'>Data</div><div class='field-val'>" + esc(resultado.data) + "</div></div>" : "")
      + (linkSeguro ? "<a class='btn' href='" + esc(linkSeguro) + "' target='_blank' rel='noopener noreferrer'>Visualizar PDF</a>"
                    : "<p style='margin-top:16px;color:#64748b;font-size:13px;'>PDF n\u00e3o dispon\u00edvel.</p>");
  } else {
    html += "<div class='icon'>&#x274C;</div><h2 style='color:#991b1b;'>Documento Inv\u00e1lido</h2>"
      + "<p style='color:#64748b;font-size:14px;line-height:1.6;'>" + esc(resultado.mensagem || "C\u00f3digo n\u00e3o encontrado.") + "</p>";
  }

  html += "</div></body></html>";
  return HtmlService.createHtmlOutput(html);
}

/* ================= EXCLUIR REGISTROS ================= */

function excluirRegistroOficio(numero, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", true);
  try {
    var ss        = SpreadsheetApp.openById(PLANILHA_ID);
    var excluidos = 0;

    // Exclui da FILA_ENVIO_OFICIOS
    var fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
    if (fila && fila.getLastRow() > 1) {
      var cab    = fila.getRange(1, 1, 1, fila.getLastColumn()).getValues()[0].map(String);
      var colNum = cab.indexOf("NUMERO_OFICIO");
      if (colNum >= 0) {
        var dados = fila.getDataRange().getValues();
        for (var i = dados.length - 1; i >= 1; i--) {
          if (String(dados[i][colNum] || "").trim() === String(numero || "").trim()) {
            fila.deleteRow(i + 1);
            excluidos++;
          }
        }
      }
    }

    // Exclui do Controle
    var controle = ss.getSheetByName(PLANILHA_REGISTRO);
    if (controle && controle.getLastRow() > 1) {
      var hMap    = getHeaderMap_(controle);
      var colCtrl = hMap["Número do Ofício"];
      if (colCtrl) {
        var dadosCtrl = controle.getDataRange().getValues();
        for (var j = dadosCtrl.length - 1; j >= 1; j--) {
          if (String(dadosCtrl[j][colCtrl - 1] || "").trim() === String(numero || "").trim()) {
            controle.deleteRow(j + 1);
            excluidos++;
          }
        }
      }
    }

    if (excluidos > 0) {
      registrarLogSistema({
        usuario: sessaoDocumentos.email || sessaoDocumentos.usuario || "SISGEP",
        numero:  numero + " (EXCLUSÃO)",
        tipo:    "EXCLUSAO_OFICIO",
        escola:  "", cnpj: "", email: "", codigo: ""
      });
      return { ok: true, mensagem: "Ofício " + numero + " excluído." };
    }
    return { ok: false, mensagem: "Registro não encontrado." };

  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

function excluirRegistrosOficio(numeros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", true);
  try {
    if (!Array.isArray(numeros) || !numeros.length) return { ok: false, mensagem: "Nenhum número informado." };

    var ss        = SpreadsheetApp.openById(PLANILHA_ID);
    var excluidos = 0;

    // Exclui da FILA_ENVIO_OFICIOS
    var fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
    if (fila && fila.getLastRow() > 1) {
      var cab    = fila.getRange(1, 1, 1, fila.getLastColumn()).getValues()[0].map(String);
      var colNum = cab.indexOf("NUMERO_OFICIO");
      if (colNum >= 0) {
        var dados = fila.getDataRange().getValues();
        for (var i = dados.length - 1; i >= 1; i--) {
          if (numeros.indexOf(String(dados[i][colNum] || "").trim()) > -1) {
            fila.deleteRow(i + 1);
            excluidos++;
          }
        }
      }
    }

    // Exclui do Controle
    var controle = ss.getSheetByName(PLANILHA_REGISTRO);
    if (controle && controle.getLastRow() > 1) {
      var hMap    = getHeaderMap_(controle);
      var colCtrl = hMap["Número do Ofício"];
      if (colCtrl) {
        var dadosCtrl = controle.getDataRange().getValues();
        for (var j = dadosCtrl.length - 1; j >= 1; j--) {
          if (numeros.indexOf(String(dadosCtrl[j][colCtrl - 1] || "").trim()) > -1) {
            controle.deleteRow(j + 1);
            excluidos++;
          }
        }
      }
    }

    if (excluidos > 0) {
      registrarLogSistema({
        usuario: sessaoDocumentos.email || sessaoDocumentos.usuario || "SISGEP",
        numero:  numeros.join(", ") + " (EXCLUSÃO EM LOTE)",
        tipo:    "EXCLUSAO_OFICIO",
        escola:  "", cnpj: "", email: "", codigo: ""
      });
    }

    return { ok: true, mensagem: excluidos + " registro(s) excluído(s)." };

  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}
/* ================= GET TEMPLATE CONTEÚDO ================= */

function getTemplateConteudo(templateId) {
  try {
    var doc   = DocumentApp.openById(templateId);
    var texto = doc.getBody().getText();
    if (!texto) return { sucesso: false, erro: "Template vazio ou sem conteúdo." };
    return { sucesso: true, texto: texto };
  } catch(e) {
    Logger.log("Erro ao carregar template: " + e.message);
    return { sucesso: false, erro: e.message };
  }
}