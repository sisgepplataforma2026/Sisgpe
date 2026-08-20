// ================================================================
// 📄 ARQUIVO: ReciboDiversos.gs
// ✅ Módulo de Recibos Diversos — SISGEP · SindEducação-ES
// ✅ Usa gerarHtmlReciboCompleto_ (mesmo padrão do módulo Recibos)
// ✅ Suporta: individual, lote, preview
// ✅ Histórico na aba RD_HISTORICO
// ✅ Envio automático por WhatsApp/e-mail ao emitir
// ✅ Controle de assinatura: físico, Gov.br, foto/scan
// ✅ Anexo do recibo assinado: upload base64 ou link Drive
// ✅ Envio para contabilidade com o arquivo assinado
// ================================================================

/* ═══════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════ */
var ABA_RD_HISTORICO = "RD_Historico";

/* ═══════════════════════════════════════
   ESTRUTURA DA ABA
═══════════════════════════════════════ */
function garantirEstruturaReciboDiversos_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RD_HISTORICO);

  if (!sh) {
    sh = ss.insertSheet(ABA_RD_HISTORICO);
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "NUMERO",           // 1
      "DATA_GERACAO",     // 2
      "PAGADOR_NOME",     // 3
      "PAGADOR_DOC",      // 4
      "TIPO_DOC",         // 5
      "VALOR",            // 6
      "DESCRICAO",        // 7
      "FORMA_PGTO",       // 8
      "PIX_CHAVE",        // 9
      "CHEQUE_NUMERO",    // 10
      "CHEQUE_BANCO",     // 11
      "CHEQUE_AGENCIA",   // 12
      "CHEQUE_SERIE",     // 13
      "CHEQUE_DATA",      // 14
      "EMAIL",            // 15
      "WHATSAPP",         // 16
      "STATUS_EMAIL",     // 17
      "LINK_PDF",         // 18
      "OBS",              // 19
      "USUARIO",          // 20
      "STATUS_ASSINATURA",       // 21 — PENDENTE / ASSINADO
      "DATA_ASSINATURA",         // 22
      "TIPO_ASSINATURA",         // 23 — FISICO / GOV_BR / FOTO_SCAN
      "LINK_ASSINADO",           // 24 — link Drive ou colar
      "STATUS_CONTABILIDADE",    // 25 — PENDENTE / ENVIADO
      "DATA_ENVIO_CONTABILIDADE" // 26
    ]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 26).setFontWeight("bold");
  } else {
    // Garante colunas novas se a aba já existia
    var cabecalhos = [
      "STATUS_ASSINATURA",
      "DATA_ASSINATURA",
      "TIPO_ASSINATURA",
      "LINK_ASSINADO",
      "STATUS_CONTABILIDADE",
      "DATA_ENVIO_CONTABILIDADE"
    ];
    cabecalhos.forEach(function(col) {
      rdGarantirColuna_(sh, col);
    });
  }
}

function rdGarantirColuna_(sheet, nomeColuna) {
  if (!sheet || !nomeColuna) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });
  if (headers.indexOf(nomeColuna) > -1) return;
  sheet.getRange(1, sheet.getLastColumn() + 1).setValue(nomeColuna);
}

/* ═══════════════════════════════════════
   NUMERAÇÃO SEQUENCIAL  RD-001/2026
═══════════════════════════════════════ */
function gerarNumeroReciboDiverso_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss     = SpreadsheetApp.openById(PLANILHA_ID);
    var config = ss.getSheetByName("CONFIG");

    if (!config) throw new Error("Aba CONFIG não encontrada.");

    var anoAtual  = new Date().getFullYear().toString();
    var rotuloAno = "ANO_RD";
    var rotuloSeq = "SEQ_RD";

    var dados    = config.getDataRange().getValues();
    var linhaAno = -1;
    var linhaSeq = -1;

    for (var i = 0; i < dados.length; i++) {
      var chave = String(dados[i][0] || "").trim().toUpperCase();
      if (chave === rotuloAno) linhaAno = i + 1;
      if (chave === rotuloSeq) linhaSeq = i + 1;
    }

    if (linhaAno === -1) {
      linhaAno = config.getLastRow() + 1;
      config.getRange(linhaAno, 1).setValue(rotuloAno);
      config.getRange(linhaAno, 2).setValue(anoAtual);
    }

    if (linhaSeq === -1) {
      linhaSeq = config.getLastRow() + 1;
      config.getRange(linhaSeq, 1).setValue(rotuloSeq);
      config.getRange(linhaSeq, 2).setValue(0);
    }

    var anoConfig = String(config.getRange(linhaAno, 2).getValue() || "").trim();
    var ultimo    = Number(config.getRange(linhaSeq, 2).getValue() || 0);

    if (anoConfig !== anoAtual) {
      config.getRange(linhaAno, 2).setValue(anoAtual);
      config.getRange(linhaSeq, 2).setValue(0);
      ultimo = 0;
    }

    var proximo = ultimo + 1;
    config.getRange(linhaSeq, 2).setValue(proximo);

    return "RD-" + String(proximo).padStart(3, "0") + "/" + anoAtual;

  } finally {
    lock.releaseLock();
  }
}

/* ═══════════════════════════════════════
   HELPERS INTERNOS
═══════════════════════════════════════ */
function rdNormalizarForma_(forma) {
  var f = String(forma || "").trim().toUpperCase();
  if (f === "CHEQUE")       return "CHEQUE";
  if (f === "DINHEIRO")     return "DINHEIRO";
  if (f === "TRANSFERENCIA" || f === "TRANSFERÊNCIA") return "TRANSFERENCIA";
  return "PIX";
}

function rdTipoDoc_(doc) {
  var d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return "PF";
  if (d.length === 14) return "PJ";
  return "PF";
}

function rdRotuloPagamento_(forma) {
  if (forma === "CHEQUE")        return "🏦 PAGAMENTO VIA CHEQUE";
  if (forma === "DINHEIRO")      return "💵 PAGAMENTO EM DINHEIRO";
  if (forma === "TRANSFERENCIA") return "🏦 PAGAMENTO VIA TRANSFERÊNCIA";
  return "⚡ PAGAMENTO VIA PIX";
}

function rdTextoPgto_(forma, pixChave, chequeNum, chequeBanco, chequeAgencia, chequeSerie) {
  if (forma === "CHEQUE") {
    return "<strong>Banco:</strong> " + (chequeBanco || "Sicoob") +
           "<br><strong>Agência:</strong> " + (chequeAgencia || "3010") +
           "<br><strong>Série:</strong> " + (chequeSerie || "001") +
           "<br><strong>Cheque Nº:</strong> " + (chequeNum || "");
  }
  if (forma === "DINHEIRO")      return "<strong>Forma:</strong> Dinheiro em espécie";
  if (forma === "TRANSFERENCIA") return "<strong>Forma:</strong> Transferência bancária";
  return "<strong>Chave:</strong> " + (pixChave || "");
}

function rdTextoPgtoCorpoDiverso_(forma, pixChave, chequeNum, chequeBanco, chequeAgencia, chequeSerie, chequeData, descricao) {
  var desc = descricao ? ", referente a: <strong>" + descricao + "</strong>" : "";

  if (forma === "CHEQUE") {
    return "mediante emissão de cheque nº " + (chequeNum || "") +
           ", Banco " + (chequeBanco || "Sicoob") +
           ", Agência " + (chequeAgencia || "3010") +
           ", Série " + (chequeSerie || "001") +
           (chequeData ? ", com vencimento em " + chequeData : "") +
           desc;
  }
  if (forma === "DINHEIRO")      return "em dinheiro" + desc;
  if (forma === "TRANSFERENCIA") return "via transferência bancária" + desc;
  return "via Pix, chave: " + (pixChave || "") + desc;
}

function rdParsarValorNumerico_(valor) {
  if (!valor) return 0;
  var txt = String(valor)
    .replace(/\s/g, "")
    .replace(/^R\$/i, "");
  if (txt.indexOf(",") > -1 && txt.indexOf(".") > -1) {
    txt = txt.replace(/\./g, "").replace(",", ".");
  } else if (txt.indexOf(",") > -1) {
    txt = txt.replace(",", ".");
  }
  var n = parseFloat(txt);
  return isNaN(n) ? 0 : n;
}

/* ═══════════════════════════════════════
   MONTAR PARAMS PARA gerarHtmlReciboCompleto_
═══════════════════════════════════════ */
function rdMontarParamsHtml_(dados, numero, isPreview) {
  var nome       = String(dados.pagadorNome || "").trim().toUpperCase();
  var doc        = String(dados.pagadorDoc  || "").replace(/\D/g, "");
  var descricao  = String(dados.descricao   || "").trim();
  var valorRaw   = String(dados.valor       || "0").trim();
  var forma      = rdNormalizarForma_(dados.formaPgto);
  var pixChave   = String(dados.pixChave    || "").trim();
  var chequeNum  = String(dados.chequeNum   || "").trim();
  var chequeBanco   = String(dados.chequeBanco   || "Sicoob").trim();
  var chequeAgencia = String(dados.chequeAgencia || "3010").trim();
  var chequeSerie   = String(dados.chequeSerie   || "001").trim();
  var chequeData    = dados.chequeData
    ? formatarDataExtensoBR(new Date(dados.chequeData))
    : "";
  var obs = String(dados.obs || "").trim();

  var cpfFmt = doc.length === 11
    ? doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

  var valorFmt     = formatarValorMonetarioBR_(valorRaw);
  var valorNumerico= rdParsarValorNumerico_(valorRaw);
  var valorExt     = valorPorExtenso(String(valorNumerico)).toLowerCase();

  var iniciais = nome.split(" ")
    .filter(function(p) { return p && p.length > 2; })
    .slice(0, 3)
    .map(function(p) { return p[0]; })
    .join("");

  var rotuloPagamento = rdRotuloPagamento_(forma);
  var textoPgto       = rdTextoPgto_(forma, pixChave, chequeNum, chequeBanco, chequeAgencia, chequeSerie);
  var textoPgtoCorpo  = rdTextoPgtoCorpoDiverso_(
    forma, pixChave, chequeNum, chequeBanco, chequeAgencia, chequeSerie, chequeData, descricao
  );

  var obsTexto = obs ? "Observações: " + obs + ". " : "";
  var imgs     = carregarImagensRecibo_();
  var nomeTier = nome.length > 40 ? "xs" : nome.length > 26 ? "sm" : "";

  return {
    nome:            nome,
    nomeTier:        nomeTier,
    cpf:             cpfFmt,
    valorFmt:        valorFmt,
    valorExt:        valorExt,
    isReciboDiverso: true,
    descricao:       descricao,
    processo:        "RECIBO_DIVERSO",
    empresa:         descricao,
    formaPagamento:  forma,
    rotuloPagamento: rotuloPagamento,
    textoPgto:       textoPgto,
    textoPgtoCorpo:  textoPgtoCorpo,
    obs:             obs,
    obsTexto:        obsTexto,
    dataHoje:        formatarDataExtensoBR(new Date()),
    numero:          numero,
    codigo:          isPreview ? "" : gerarCodigoVerificacao(numero),
    iniciais:        iniciais,
    logoBase64:      imgs.logoBase64,
    logoMime:        imgs.logoMime,
    assBase64:       imgs.assBase64,
    assMime:         imgs.assMime
  };
}

/* ═══════════════════════════════════════
   REGISTRAR NO HISTÓRICO
═══════════════════════════════════════ */
function rdRegistrarHistorico_(dados, numero, linkPdf, statusEmail) {
  garantirEstruturaReciboDiversos_();

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RD_HISTORICO);

  var forma = rdNormalizarForma_(dados.formaPgto);

  sh.appendRow([
    numero,
    new Date(),
    String(dados.pagadorNome || "").trim(),
    String(dados.pagadorDoc  || "").trim(),
    rdTipoDoc_(dados.pagadorDoc),
    String(dados.valor       || "").trim(),
    String(dados.descricao   || "").trim(),
    forma,
    forma === "PIX"    ? String(dados.pixChave  || "").trim() : "",
    forma === "CHEQUE" ? String(dados.chequeNum || "").trim() : "",
    forma === "CHEQUE" ? String(dados.chequeBanco   || "Sicoob").trim() : "",
    forma === "CHEQUE" ? String(dados.chequeAgencia || "3010").trim()   : "",
    forma === "CHEQUE" ? String(dados.chequeSerie   || "001").trim()    : "",
    forma === "CHEQUE" ? String(dados.chequeData    || "").trim()       : "",
    String(dados.email    || "").trim(),
    String(dados.whatsapp || "").trim(),
    statusEmail || "",
    linkPdf || "",
    String(dados.obs || "").trim(),
    obterEmailUsuarioAtual_() || "",
    "PENDENTE",  // STATUS_ASSINATURA
    "",          // DATA_ASSINATURA
    "",          // TIPO_ASSINATURA
    "",          // LINK_ASSINADO
    "PENDENTE",  // STATUS_CONTABILIDADE
    ""           // DATA_ENVIO_CONTABILIDADE
  ]);
}

/* ═══════════════════════════════════════
   PREVIEW
═══════════════════════════════════════ */
function previewReciboDiverso(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  dados = dados || {};

  if (!dados.pagadorNome) throw new Error("Informe o nome do beneficiário.");
  if (!dados.pagadorDoc)  throw new Error("Informe o CPF ou CNPJ.");
  if (!dados.valor)       throw new Error("Informe o valor.");
  if (!dados.descricao)   throw new Error("Informe a descrição.");

  var numero = "PRÉVIA-" + Utilities.getUuid().slice(0, 6).toUpperCase() + "/" + new Date().getFullYear();
  var params = rdMontarParamsHtml_(dados, numero, true);

  return gerarHtmlReciboCompleto_(params, true);
}

/* ═══════════════════════════════════════
   GERAR RECIBO DIVERSO INDIVIDUAL
═══════════════════════════════════════ */
function gerarReciboDiverso(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    if (!dados.pagadorNome) return { ok: false, mensagem: "Informe o nome do beneficiário." };
    if (!dados.pagadorDoc)  return { ok: false, mensagem: "Informe o CPF ou CNPJ." };
    if (!dados.valor)       return { ok: false, mensagem: "Informe o valor." };
    if (!dados.descricao)   return { ok: false, mensagem: "Informe a descrição." };

    var forma = rdNormalizarForma_(dados.formaPgto);
    if (forma === "PIX" && !dados.pixChave) {
      return { ok: false, mensagem: "Informe a chave PIX." };
    }
    if (forma === "CHEQUE" && !dados.chequeNum) {
      return { ok: false, mensagem: "Informe o número do cheque." };
    }

    var numero = gerarNumeroReciboDiverso_();
    var params = rdMontarParamsHtml_(dados, numero, false);
    var html   = gerarHtmlReciboCompleto_(params, false);

    var pastaAno = obterOuCriarSubpastaAno(getRecursoId_("RECIBOS"));
    var nomeArq  = ("ReciboDiverso " + numero + " - " + params.nome)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    var pdfFile = recibo_converterHtmlParaPdf_(html, nomeArq, pastaAno);

    try {
      arquivoAplicarPolitica_(pdfFile, "ReciboDiversos.gs");
    } catch(e) {}

    var fileId      = pdfFile.getId();
    var urlPreview  = "https://drive.google.com/file/d/" + fileId + "/preview";
    var urlDownload = "https://drive.google.com/uc?export=download&id=" + fileId;

    // ✅ Envio automático se WhatsApp ou e-mail informado
    var statusEmail = "";
    if (dados.email) {
      var envio = rdEnviarEmailIndividual_(dados, numero, urlPreview, pdfFile.getBlob().setName(nomeArq + ".pdf"));
      statusEmail = envio.ok ? "ENVIADO" : "FALHA";
    }

    if (dados.whatsapp) {
      // Link WhatsApp gerado — o envio via API não é suportado no GAS,
      // mas registramos para o frontend abrir automaticamente
    }

    rdRegistrarHistorico_(dados, numero, urlPreview, statusEmail);

    return {
      ok:          true,
      numero:      numero,
      url:         urlPreview,
      download:    urlDownload,
      statusEmail: statusEmail,
      whatsapp:    dados.whatsapp || "",
      mensagem:    "Recibo gerado com sucesso."
    };

  } catch(e) {
    Logger.log("Erro gerarReciboDiverso: " + e.message);
    return { ok: false, mensagem: "Erro ao gerar recibo: " + e.message };
  }
}

/* ═══════════════════════════════════════
   GERAR LOTE DE RECIBOS DIVERSOS
═══════════════════════════════════════ */
function gerarLoteReciboDiversos(lista, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    if (!Array.isArray(lista) || !lista.length) {
      return { erro: true, mensagem: "Lista de beneficiários vazia." };
    }

    if (lista.length > 25) {
      return { erro: true, mensagem: "Limite máximo de 25 beneficiários por lote." };
    }

    var arquivos = [];
    var erros    = [];
    var pastaAno = obterOuCriarSubpastaAno(getRecursoId_("RECIBOS"));

    lista.forEach(function(dados, idx) {
      try {
        var forma = rdNormalizarForma_(dados.formaPgto);

        if (!dados.pagadorNome) throw new Error("Nome não informado.");
        if (!dados.pagadorDoc)  throw new Error("CPF/CNPJ não informado.");
        if (!dados.valor)       throw new Error("Valor não informado.");
        if (!dados.descricao)   throw new Error("Descrição não informada.");
        if (forma === "PIX" && !dados.pixChave)     throw new Error("Chave PIX não informada.");
        if (forma === "CHEQUE" && !dados.chequeNum) throw new Error("Nº cheque não informado.");

        var numero = gerarNumeroReciboDiverso_();
        var params = rdMontarParamsHtml_(dados, numero, false);
        var html   = gerarHtmlReciboCompleto_(params, false);

        var nomeArq = ("ReciboDiverso " + numero + " - " + params.nome)
          .replace(/[\\/:*?"<>|]/g, "-")
          .replace(/\s+/g, " ")
          .trim();

        var pdfFile = recibo_converterHtmlParaPdf_(html, nomeArq, pastaAno);
        try { arquivoAplicarPolitica_(pdfFile, "ReciboDiversos.gs"); } catch(e) {}

        var fileId      = pdfFile.getId();
        var urlPreview  = "https://drive.google.com/file/d/" + fileId + "/preview";
        var urlDownload = "https://drive.google.com/uc?export=download&id=" + fileId;

        var statusEmail = "";
        if (dados.email) {
          var envio = rdEnviarEmailIndividual_(dados, numero, urlPreview, pdfFile.getBlob().setName(nomeArq + ".pdf"));
          statusEmail = envio.ok ? "ENVIADO" : "FALHA";
        }

        rdRegistrarHistorico_(dados, numero, urlPreview, statusEmail);

        arquivos.push({
          indice:      idx + 1,
          nome:        dados.pagadorNome,
          doc:         dados.pagadorDoc,
          valor:       dados.valor,
          descricao:   dados.descricao,
          numero:      numero,
          url:         urlPreview,
          download:    urlDownload,
          email:       dados.email    || "",
          whatsapp:    dados.whatsapp || "",
          statusEmail: statusEmail
        });

      } catch(eItem) {
        erros.push({
          indice: idx + 1,
          nome:   dados.pagadorNome || ("Item " + (idx + 1)),
          erro:   eItem.message
        });
      }
    });

    return {
      erro:        arquivos.length === 0,
      totalGerado: arquivos.length,
      totalErros:  erros.length,
      arquivos:    arquivos,
      erros:       erros,
      mensagem:    arquivos.length + " recibo(s) gerado(s)" + (erros.length ? ", " + erros.length + " com falha." : " com sucesso.")
    };

  } catch(e) {
    Logger.log("Erro gerarLoteReciboDiversos: " + e.message);
    return { erro: true, mensagem: "Erro ao gerar lote: " + e.message, arquivos: [], erros: [] };
  }
}

/* ═══════════════════════════════════════
   ENVIO DE E-MAIL INDIVIDUAL (ao emitir)
═══════════════════════════════════════ */
function rdEnviarEmailIndividual_(dados, numero, urlPdf, blobPdf) {
  try {
    var destino = String(dados.email || "").trim();
    if (!destino) return { ok: false };

    var nome      = String(dados.pagadorNome || "").trim();
    var valor     = String(dados.valor       || "").trim();
    var descricao = String(dados.descricao   || "").trim();

    var htmlBody =
      "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;'>" +
        "<p>Prezado(a) <strong>" + nome + "</strong>,</p>" +
        "<p>Segue o Recibo Diverso Nº <strong>" + numero + "</strong>, no valor de <strong>R$ " + valor + "</strong>.</p>" +
        "<p><strong>Referente a:</strong> " + descricao + "</p>" +
        /* O PDF vai anexado (blobPdf, no fim desta função). O link ia para
           o Drive, que era público — 20/08/2026. */
        "<p>📄 O recibo segue <strong>em anexo</strong>.</p>" +
        "<p>Após assinar (físico ou pelo Gov.br), por favor devolva o documento assinado por este e-mail ou WhatsApp.</p>" +
        "<p>Em caso de dúvidas, entre em contato.</p>" +
        "<p><strong>Atenciosamente,</strong><br>SINDEDUCAÇÃO-ES</p>" +
      "</div>";

    var emailUsuario = obterEmailUsuarioAtual_();

    var opcoes = {
      to:       destino,
      subject:  "Recibo para assinatura — Nº " + numero + " — SindEducação-ES",
      htmlBody: htmlBody,
      replyTo:  emailUsuario || ""
    };

    if (blobPdf) opcoes.attachments = [blobPdf];

    MailApp.sendEmail(opcoes);
    return { ok: true };

  } catch(e) {
    Logger.log("rdEnviarEmailIndividual_: " + e.message);
    return { ok: false, erro: e.message };
  }
}

/* ═══════════════════════════════════════
   MARCAR RECIBO COMO ASSINADO
═══════════════════════════════════════ */
function marcarReciboDiversoAssinado(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var numero = String(dados.numero || "").trim();
    var tipo   = String(dados.tipo   || "FISICO").trim().toUpperCase(); // FISICO / GOV_BR / FOTO_SCAN

    if (!numero) return { ok: false, mensagem: "Número do recibo não informado." };

    garantirEstruturaReciboDiversos_();

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RD_HISTORICO);
    if (!sh || sh.getLastRow() < 2) return { ok: false, mensagem: "Histórico vazio." };

    var valores = sh.getDataRange().getValues();
    var cab     = valores[0].map(function(h) { return String(h || "").trim(); });

    var idxNum  = cab.indexOf("NUMERO");
    var idxSt   = cab.indexOf("STATUS_ASSINATURA");
    var idxData = cab.indexOf("DATA_ASSINATURA");
    var idxTipo = cab.indexOf("TIPO_ASSINATURA");

    if (idxNum < 0 || idxSt < 0) return { ok: false, mensagem: "Estrutura da planilha incorreta." };

    for (var i = 1; i < valores.length; i++) {
      if (String(valores[i][idxNum] || "").trim() !== numero) continue;

      sh.getRange(i + 1, idxSt   + 1).setValue("ASSINADO");
      sh.getRange(i + 1, idxData + 1).setValue(new Date());
      if (idxTipo > -1) sh.getRange(i + 1, idxTipo + 1).setValue(tipo);

      return { ok: true, mensagem: "Recibo marcado como assinado." };
    }

    return { ok: false, mensagem: "Recibo não encontrado." };

  } catch(e) {
    Logger.log("marcarReciboDiversoAssinado: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════
   SALVAR ANEXO ASSINADO (base64 → Drive)
═══════════════════════════════════════ */
function salvarAnexoAssinadoDiverso(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var numero   = String(dados.numero   || "").trim();
    var base64   = String(dados.base64   || "").trim();
    var nomeArq  = String(dados.nomeArq  || "").trim() || ("assinado_" + numero + ".pdf");
    var mimeType = String(dados.mimeType || "application/pdf").trim();

    if (!numero) return { ok: false, mensagem: "Número do recibo não informado." };
    if (!base64) return { ok: false, mensagem: "Arquivo não recebido." };

    var validacaoPdf = validarPdfBase64Documento_({
      nomeArq: nomeArq,
      mimeType: mimeType,
      base64: base64
    }, { limiteMb: 10 });
    if (!validacaoPdf.ok) return { ok: false, mensagem: validacaoPdf.mensagem };

    nomeArq = validacaoPdf.nomeArquivo;
    mimeType = validacaoPdf.mimeType;
    base64 = validacaoPdf.base64;

    garantirEstruturaReciboDiversos_();

    // Salva na mesma pasta de recibos
    var pastaAno = obterOuCriarSubpastaAno(getRecursoId_("RECIBOS"));
    var bytes    = validacaoPdf.bytes;
    var blob     = Utilities.newBlob(bytes, mimeType, nomeArq);
    var arquivo  = pastaAno.createFile(blob);

    try {
      arquivoAplicarPolitica_(arquivo, "ReciboDiversos.gs");
    } catch(e) {}

    var link = "https://drive.google.com/file/d/" + arquivo.getId() + "/preview";

    // Atualiza LINK_ASSINADO na planilha
    rdSalvarLinkAssinado_(numero, link);

    return { ok: true, link: link, mensagem: "Arquivo salvo com sucesso." };

  } catch(e) {
    Logger.log("salvarAnexoAssinadoDiverso: " + e.message);
    return { ok: false, mensagem: "Erro ao salvar arquivo: " + e.message };
  }
}

/* ═══════════════════════════════════════
   SALVAR LINK ASSINADO (colar link Drive)
═══════════════════════════════════════ */
function salvarLinkAssinadoDiverso(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var numero = String(dados.numero || "").trim();
    var link   = String(dados.link   || "").trim();

    if (!numero) return { ok: false, mensagem: "Número do recibo não informado." };
    if (!link)   return { ok: false, mensagem: "Link não informado." };

    garantirEstruturaReciboDiversos_();
    rdSalvarLinkAssinado_(numero, link);

    return { ok: true, mensagem: "Link salvo com sucesso." };

  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

function rdSalvarLinkAssinado_(numero, link) {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RD_HISTORICO);
  if (!sh || sh.getLastRow() < 2) return;

  var valores = sh.getDataRange().getValues();
  var cab     = valores[0].map(function(h) { return String(h || "").trim(); });
  var idxNum  = cab.indexOf("NUMERO");
  var idxLink = cab.indexOf("LINK_ASSINADO");

  if (idxNum < 0 || idxLink < 0) return;

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][idxNum] || "").trim() === numero) {
      sh.getRange(i + 1, idxLink + 1).setValue(link);
      break;
    }
  }
}

/* ═══════════════════════════════════════
   ENVIAR PARA CONTABILIDADE (com assinado)
═══════════════════════════════════════ */
function enviarReciboDiversoContabilidade(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var emailTo = String(dados.emailTo || "").trim();
    var emailCc = String(dados.emailCc || "").trim();

    if (!emailTo) return { ok: false, mensagem: "E-mail destino não informado." };

    var isLote   = !!dados.isLote;
    var arquivos = Array.isArray(dados.arquivos) ? dados.arquivos : [];
    var htmlBody;
    var anexos   = [];

    if (isLote && arquivos.length) {
      // ── Lote ──
      var listaHtml = arquivos.map(function(a) {
        return "<li><strong>" + (a.numero || "") + "</strong> — " +
          (a.nome || "") + " — R$ " + (a.valor || "") +
          (a.linkAssinado || a.url
            ? " (<a href='" + (a.linkAssinado || a.url) + "'>abrir</a>)"
            : "") +
          "</li>";
      }).join("");

      htmlBody =
        "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;'>" +
          "<p>Segue o lote de <strong>" + arquivos.length + " Recibos Diversos assinados</strong> — Total: <strong>R$ " + (dados.valor || "") + "</strong></p>" +
          "<ul>" + listaHtml + "</ul>" +
          "<p><strong>Atenciosamente,</strong><br>SINDEDUCAÇÃO-ES</p>" +
        "</div>";

      // Tentar anexar PDFs assinados
      arquivos.forEach(function(a) {
        var url = a.linkAssinado || a.url || "";
        var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) return;
        try { anexos.push(DriveApp.getFileById(match[1]).getBlob()); } catch(e) {}
      });

    } else {
      // ── Individual ──
      var linkParaEnviar = dados.linkAssinado || dados.linkPdf || "";

      htmlBody =
        "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;'>" +
          "<p>Segue o Recibo Diverso Nº <strong>" + (dados.numero || "") + "</strong> — <strong>assinado</strong>.</p>" +
          "<p><strong>Beneficiário:</strong> " + (dados.nome || "") + "</p>" +
          "<p><strong>Valor:</strong> R$ " + (dados.valor || "") + "</p>" +
          "<p><strong>Referente a:</strong> " + (dados.descricao || "") + "</p>" +
          /* O arquivo vai anexado logo abaixo, a partir deste mesmo
             linkParaEnviar. O link no corpo apontava para o Drive, que era
             público — 20/08/2026. */
          "<p>📄 O recibo assinado segue <strong>em anexo</strong>.</p>" +
          "<p><strong>Atenciosamente,</strong><br>SINDEDUCAÇÃO-ES</p>" +
        "</div>";

      var match = linkParaEnviar.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        try { anexos.push(DriveApp.getFileById(match[1]).getBlob()); } catch(e) {}
      }
    }

    var opcoes = {
      to:       emailTo,
      subject:  isLote
        ? "Recibos Diversos assinados (" + arquivos.length + ") — SindEducação-ES"
        : "Recibo Diverso Nº " + (dados.numero || "") + " — Assinado — SindEducação-ES",
      htmlBody: htmlBody
    };

    if (emailCc)       opcoes.cc          = emailCc;
    if (anexos.length) opcoes.attachments = anexos;

    MailApp.sendEmail(opcoes);

    // Atualiza STATUS_CONTABILIDADE
    if (!isLote && dados.numero) {
      rdAtualizarStatusContabilidade_(dados.numero, "ENVIADO");
    } else if (isLote) {
      arquivos.forEach(function(a) {
        if (a.numero) rdAtualizarStatusContabilidade_(a.numero, "ENVIADO");
      });
    }

    return { ok: true, mensagem: "E-mail enviado para " + emailTo + "." };

  } catch(e) {
    Logger.log("enviarReciboDiversoContabilidade: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar: " + e.message };
  }
}

function rdAtualizarStatusContabilidade_(numero, novoStatus) {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var sh  = ss.getSheetByName(ABA_RD_HISTORICO);
    if (!sh || sh.getLastRow() < 2) return;

    var valores = sh.getDataRange().getValues();
    var cab     = valores[0].map(function(h) { return String(h || "").trim(); });
    var idxNum  = cab.indexOf("NUMERO");
    var idxSt   = cab.indexOf("STATUS_CONTABILIDADE");
    var idxData = cab.indexOf("DATA_ENVIO_CONTABILIDADE");

    if (idxNum < 0 || idxSt < 0) return;

    for (var i = 1; i < valores.length; i++) {
      if (String(valores[i][idxNum] || "").trim() === numero) {
        sh.getRange(i + 1, idxSt + 1).setValue(novoStatus);
        if (idxData > -1) sh.getRange(i + 1, idxData + 1).setValue(new Date());
        break;
      }
    }
  } catch(e) {
    Logger.log("rdAtualizarStatusContabilidade_: " + e.message);
  }
}

/* ═══════════════════════════════════════
   REENVIAR E-MAIL DO HISTÓRICO
═══════════════════════════════════════ */
function reenviarEmailReciboDiverso(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var email   = String(dados.email   || "").trim();
    var linkPdf = String(dados.linkPdf || "").trim();
    var numero  = String(dados.numero  || "").trim();
    var nome    = String(dados.nome    || "").trim();
    var valor   = String(dados.valor   || "").trim();
    var desc    = String(dados.descricao || "").trim();

    if (!email)   return { ok: false, mensagem: "E-mail não informado." };
    if (!linkPdf) return { ok: false, mensagem: "Link do PDF não disponível." };

    var htmlBody =
      "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;'>" +
        "<p>Prezado(a) <strong>" + nome + "</strong>,</p>" +
        "<p>Segue o reenvio do Recibo Diverso Nº <strong>" + numero + "</strong>, no valor de <strong>R$ " + valor + "</strong>.</p>" +
        (desc ? "<p><strong>Referente a:</strong> " + desc + "</p>" : "") +
        "<p>O recibo segue <strong>em anexo</strong> neste e-mail.</p>" +
        "<p>Após assinar (físico ou pelo Gov.br), por favor devolva o documento assinado.</p>" +
        "<p><strong>Atenciosamente,</strong><br>SINDEDUCAÇÃO-ES</p>" +
      "</div>";

    /* O PDF VAI ANEXADO, E NÃO POR LINK — 20/08/2026.
       Este e-mail levava só um link para o arquivo no Drive, e o arquivo era
       público para quem tivesse a URL. Fechado o compartilhamento, o link
       deixaria de abrir; então o documento passa a viajar no próprio e-mail.
       Mesmo padrão já usado no envio em lote, logo acima. */
    var anexosReenvio = [];
    var idPdf = linkPdf.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idPdf) {
      try {
        anexosReenvio.push(
          DriveApp.getFileById(idPdf[1]).getBlob()
            .setName("ReciboDiverso " + numero + ".pdf")
        );
      } catch (eAnexo) {
        return { ok: false, mensagem: "Não consegui anexar o recibo: " + eAnexo.message };
      }
    }

    var opcoesReenvio = {
      to:       email,
      subject:  "Reenvio — Recibo para assinatura Nº " + numero + " — SindEducação-ES",
      htmlBody: htmlBody
    };
    if (anexosReenvio.length) opcoesReenvio.attachments = anexosReenvio;

    MailApp.sendEmail(opcoesReenvio);

    rdAtualizarStatusEmail_(numero, "REENVIADO");

    return { ok: true, mensagem: "E-mail reenviado para " + email + "." };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao reenviar: " + e.message };
  }
}

/* ═══════════════════════════════════════
   ATUALIZAR STATUS E-MAIL NO HISTÓRICO
═══════════════════════════════════════ */
function rdAtualizarStatusEmail_(numero, novoStatus) {
  try {
    var ss   = SpreadsheetApp.openById(PLANILHA_ID);
    var sh   = ss.getSheetByName(ABA_RD_HISTORICO);
    if (!sh || sh.getLastRow() < 2) return;

    var dados = sh.getDataRange().getValues();
    var cab   = dados[0].map(function(h) { return String(h || "").trim(); });
    var idxNum = cab.indexOf("NUMERO");
    var idxSt  = cab.indexOf("STATUS_EMAIL");
    if (idxNum < 0 || idxSt < 0) return;

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idxNum] || "").trim() === numero) {
        sh.getRange(i + 1, idxSt + 1).setValue(novoStatus);
        break;
      }
    }
  } catch(e) {
    Logger.log("rdAtualizarStatusEmail_: " + e.message);
  }
}

/* ═══════════════════════════════════════
   LISTAR HISTÓRICO (com filtros + paginação)
   Retorna campos de assinatura e contabilidade
═══════════════════════════════════════ */
function listarHistoricoReciboDiversos(filtros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    garantirEstruturaReciboDiversos_();

    filtros = filtros || {};

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RD_HISTORICO);

    if (!sh || sh.getLastRow() < 2) {
      return { ok: true, total: 0, pagina: 1, paginas: 1, dados: [] };
    }

    var valores = sh.getDataRange().getValues();
    var cab     = valores[0].map(function(h) { return String(h || "").trim(); });

    var idx = function(nome) { return cab.indexOf(nome); };

    var iNum    = idx("NUMERO");
    var iData   = idx("DATA_GERACAO");
    var iNome   = idx("PAGADOR_NOME");
    var iDoc    = idx("PAGADOR_DOC");
    var iTipo   = idx("TIPO_DOC");
    var iVal    = idx("VALOR");
    var iDesc   = idx("DESCRICAO");
    var iForma  = idx("FORMA_PGTO");
    var iPix    = idx("PIX_CHAVE");
    var iEmail  = idx("EMAIL");
    var iZap    = idx("WHATSAPP");
    var iStEm   = idx("STATUS_EMAIL");
    var iLink   = idx("LINK_PDF");
    var iStAss  = idx("STATUS_ASSINATURA");
    var iDataAss= idx("DATA_ASSINATURA");
    var iTipoAss= idx("TIPO_ASSINATURA");
    var iLinkAss= idx("LINK_ASSINADO");
    var iStCont = idx("STATUS_CONTABILIDADE");

    var fNome   = String(filtros.nome   || "").toLowerCase().trim();
    var fNumero = String(filtros.numero || "").toLowerCase().trim();
    var fStatus = String(filtros.status || "").toUpperCase().trim();
    var fDe     = filtros.dataDe  ? new Date(filtros.dataDe)  : null;
    var fAte    = filtros.dataAte ? new Date(filtros.dataAte) : null;
    if (fAte) fAte.setHours(23, 59, 59, 999);

    var pagina    = Number(filtros.pagina    || 1);
    var porPagina = Number(filtros.porPagina || 20);

    var lista = [];

    for (var i = 1; i < valores.length; i++) {
      var linha  = valores[i];
      var numero = String(linha[iNum]  || "").trim();
      var nome   = String(linha[iNome] || "").trim();
      var status = String(iStEm > -1 ? linha[iStEm] : "").trim().toUpperCase();
      var dataRaw = linha[iData];
      var dataObj = dataRaw ? new Date(dataRaw) : null;

      if (!numero && !nome) continue;

      if (fNome   && nome.toLowerCase().indexOf(fNome)     < 0) continue;
      if (fNumero && numero.toLowerCase().indexOf(fNumero) < 0) continue;
      if (fStatus && status !== fStatus) continue;
      if (fDe  && dataObj && dataObj < fDe)  continue;
      if (fAte && dataObj && dataObj > fAte) continue;

      var statusAssinatura  = iStAss  > -1 ? String(linha[iStAss]  || "PENDENTE").trim().toUpperCase() : "PENDENTE";
      var statusContabilidade = iStCont > -1 ? String(linha[iStCont] || "PENDENTE").trim().toUpperCase() : "PENDENTE";
      var linkAssinado      = iLinkAss > -1 ? String(linha[iLinkAss]|| "").trim() : "";
      var tipoAssinatura    = iTipoAss > -1 ? String(linha[iTipoAss]|| "").trim() : "";

      var dataAssObj = iDataAss > -1 && linha[iDataAss] ? new Date(linha[iDataAss]) : null;

      lista.push({
        numero:      numero,
        data:        dataObj ? Utilities.formatDate(dataObj, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : "",
        pagadorNome: nome,
        pagadorDoc:  String(iDoc   > -1 ? linha[iDoc]   : "" || "").trim(),
        tipo:        String(iTipo  > -1 ? linha[iTipo]  : "PF" || "PF").trim(),
        valor:       String(iVal   > -1 ? linha[iVal]   : "" || "").trim(),
        descricao:   String(iDesc  > -1 ? linha[iDesc]  : "" || "").trim(),
        formaPgto:   String(iForma > -1 ? linha[iForma] : "" || "").trim(),
        pixChave:    String(iPix   > -1 ? linha[iPix]   : "" || "").trim(),
        email:       String(iEmail > -1 ? linha[iEmail] : "" || "").trim(),
        whatsapp:    String(iZap   > -1 ? linha[iZap]   : "" || "").trim(),
        statusEmail: status,
        linkPdf:     String(iLink  > -1 ? linha[iLink]  : "" || "").trim(),
        // ✅ Novos campos
        statusAssinatura:    statusAssinatura,
        tipoAssinatura:      tipoAssinatura,
        dataAssinatura:      dataAssObj ? Utilities.formatDate(dataAssObj, Session.getScriptTimeZone(), "dd/MM/yyyy") : "",
        linkAssinado:        linkAssinado,
        statusContabilidade: statusContabilidade
      });
    }

    lista.sort(function(a, b) {
      return b.numero.localeCompare(a.numero);
    });

    var total   = lista.length;
    var paginas = Math.max(1, Math.ceil(total / porPagina));
    var inicio  = (pagina - 1) * porPagina;
    var dados   = lista.slice(inicio, inicio + porPagina);

    return {
      ok:      true,
      total:   total,
      pagina:  pagina,
      paginas: paginas,
      dados:   dados
    };

  } catch(e) {
    Logger.log("listarHistoricoReciboDiversos: " + e.message);
    return { ok: false, mensagem: e.message, total: 0, pagina: 1, paginas: 1, dados: [] };
  }
}

/* ═══════════════════════════════════════
   EXCLUIR DO HISTÓRICO
═══════════════════════════════════════ */
function excluirReciboDiverso(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", true);
  try {
    var numero = String((dados && dados.numero) || "").trim();
    if (!numero) return { ok: false, mensagem: "Número não informado." };

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RD_HISTORICO);
    if (!sh || sh.getLastRow() < 2) return { ok: false, mensagem: "Histórico vazio." };

    var valores = sh.getDataRange().getValues();
    var cab     = valores[0].map(function(h) { return String(h || "").trim(); });
    var idxNum  = cab.indexOf("NUMERO");

    for (var i = valores.length - 1; i >= 1; i--) {
      if (String(valores[i][idxNum] || "").trim() === numero) {
        sh.deleteRow(i + 1);
        return { ok: true, mensagem: "Recibo " + numero + " removido do histórico." };
      }
    }

    return { ok: false, mensagem: "Recibo não encontrado." };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao excluir: " + e.message };
  }
}


/* ═══════════════════════════════════════
   TESTES
═══════════════════════════════════════ */
function testePreviewReciboDiverso() {
  return previewReciboDiverso({
    pagadorNome: "WANDERSON NASCIMENTO CASTELO",
    pagadorDoc:  "085.381.047-80",
    valor:       "234,56",
    descricao:   "Serviço de som — Festa de fim de ano 2026",
    formaPgto:   "PIX",
    pixChave:    "08538104780"
  });
}

function testeGerarReciboDiverso() {
  return gerarReciboDiverso({
    pagadorNome: "WANDERSON NASCIMENTO CASTELO",
    pagadorDoc:  "085.381.047-80",
    valor:       "150,00",
    descricao:   "Honorários — maio/2026",
    formaPgto:   "PIX",
    pixChave:    "08538104780",
    email:       "",
    whatsapp:    ""
  });
}

function testeGerarLoteReciboDiversos() {
  return gerarLoteReciboDiversos([
    {
      pagadorNome: "WANDERSON NASCIMENTO CASTELO",
      pagadorDoc:  "085.381.047-80",
      valor:       "850,00",
      descricao:   "Serviço de som",
      formaPgto:   "PIX",
      pixChave:    "08538104780"
    },
    {
      pagadorNome: "LEONIL DIAS DA SILVA",
      pagadorDoc:  "000.000.000-00",
      valor:       "1200,00",
      descricao:   "Buffet",
      formaPgto:   "DINHEIRO"
    }
  ]);
}

function testeMarcarAssinado() {
  return marcarReciboDiversoAssinado({
    numero: "RD-001/2026",
    tipo:   "GOV_BR"
  });
}