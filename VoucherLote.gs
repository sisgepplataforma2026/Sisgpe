// ============================================================================
// ARQUIVO: VoucherLote.gs
// EMITIR EM LOTE, E A DATA DO DOCUMENTO SER A DO DIA EM QUE ELE SAI
// ============================================================================
//
// DE ONDE VEIO, 29/10/2026. O usuário:
//
//   "preciso emitir todos e quando forem enviar ele deve sair com a data de
//    envio, preciso enviar pelo email que solicitou"
//
// e, nas respostas: retirada presencial sai com a data em que é IMPRESSO
// para entregar; a cópia para a instituição é opcional, "mas tem que ter o
// email".
//
// O PROBLEMA QUE ISTO RESOLVE. Até aqui o certificado nascia com a data da
// emissão e nunca mais mudava — `gerarDocumentoVoucher` devolve o PDF já
// guardado quando o protocolo é emitido de novo. Emitir o semestre inteiro
// numa segunda-feira e enviar ao longo da semana faria o associado receber,
// na sexta, um documento datado de segunda.
//
// A SAÍDA: o documento é REFEITO no dia em que sai (envio ou impressão), com
// o MESMO protocolo e o MESMO código de validação. O QR continua apontando
// para o mesmo registro, então nada do que a escola confere muda — só a data
// impressa. O PDF antigo fica na pasta (não se apaga documento emitido); a
// linha de Voucher_Emitidos passa a apontar para o novo, e DATA_DOCUMENTO diz
// a data que está no papel. DATA_EMISSAO continua sendo quando se emitiu.
// ============================================================================

var VOUCHER_LOTE_LIMITE_MS = 240000;   // folga para o teto de 6 min do Apps Script

/** "yyyy-MM-dd" no fuso do sindicato — o que decide se é "o mesmo dia". */
function voucherDiaDe_(d) {
  if (Object.prototype.toString.call(d) !== "[object Date]" || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd");
}

/** Linha de Voucher_Emitidos do protocolo, com o número da linha e os cabeçalhos. */
function voucherLinhaEmitido_(protocolo) {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Voucher_Emitidos");
  if (!sh || sh.getLastRow() < 2) return null;
  var dados = sh.getDataRange().getValues();
  var cab = dados[0].map(function (h) { return String(h || "").trim(); });
  var iProt = cab.indexOf("PROTOCOLO");
  if (iProt < 0) return null;
  /* De baixo para cima, como buscarVoucherEmitidoPorProtocolo_: se houver
     duas linhas do mesmo protocolo, vale a mais recente. */
  for (var i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][iProt] || "").trim() === protocolo) {
      var obj = {};
      cab.forEach(function (h, j) { obj[h] = dados[i][j]; });
      return { sh: sh, linha: i + 1, cab: cab, reg: obj };
    }
  }
  return null;
}

/**
 * Deixa o documento datado de `quando`, refazendo o PDF se a data no papel
 * for de outro dia. Devolve o link que vale e o HTML desse documento.
 *
 * NUNCA gera código novo e nunca muda o percentual: os dois saem do registro
 * da emissão. O HTML do certificado só lê protocolo, código, percentual, RG,
 * data e a linha da solicitação — então o documento refeito é o mesmo papel
 * com outra data, não uma emissão nova.
 */
function voucherRedatarDocumento_(protocolo, quando, motivo, usuario) {
  protocolo = String(protocolo || "").trim();
  var emi = voucherLinhaEmitido_(protocolo);
  if (!emi) return { ok: false, mensagem: "O protocolo " + protocolo + " ainda não foi emitido." };

  var item = buscarSolicitacaoPorProtocolo_(protocolo);
  if (!item) return { ok: false, mensagem: "Solicitação " + protocolo + " não encontrada." };
  var reg = item.registro;

  var percentual = Number(String(emi.reg.PERCENTUAL !== "" && emi.reg.PERCENTUAL !== undefined
    ? emi.reg.PERCENTUAL : reg.PERCENTUAL_APLICADO).replace("%", "").replace(",", "."));
  var dadosDoc = {
    protocolo: protocolo,
    codigo: String(emi.reg.CODIGO_VALIDACAO || ""),
    tipoDocumento: "VOUCHER",
    dataEmissao: quando,
    usuario: usuario,
    rg: valorSeguroVoucher_(reg.RG_SOLICITANTE || ""),
    percentual: percentual,
    documentos: [],
    observacao: "",
    reg: reg
  };
  var html = gerarHtmlDocumentoVoucher_(dadosDoc);

  var dataNoPapel = emi.reg.DATA_DOCUMENTO || emi.reg.DATA_EMISSAO;
  if (voucherDiaDe_(dataNoPapel) === voucherDiaDe_(quando)) {
    return { ok: true, redatado: false, linkPdf: String(emi.reg.LINK_ARQUIVO || ""), html: html };
  }

  /* Mesmo nome que a emissão dá ao arquivo — data primeiro, depois para
     quem — para a pasta continuar em ordem e a busca pelo nome achar os dois. */
  var benef = String(reg.NOME_BENEFICIARIO || "").trim();
  var titular = String(reg.NOME_SOLICITANTE || "").trim();
  var paraQuem = benef && benef.toUpperCase() !== titular.toUpperCase()
    ? benef + " (dependente de " + titular + ")" : titular;
  var pdf = salvarHtmlComoPdfVoucher_(html,
    voucherDiaDe_(quando) + " - Voucher Bolsa - " + protocolo + " - " + paraQuem);

  var iLink = emi.cab.indexOf("LINK_ARQUIVO");
  var iData = emi.cab.indexOf("DATA_DOCUMENTO");
  if (iLink > -1) emi.sh.getRange(emi.linha, iLink + 1).setValue(pdf.url);
  if (iData > -1) emi.sh.getRange(emi.linha, iData + 1).setValue(quando);

  var dataTexto = Utilities.formatDate(quando, "America/Sao_Paulo", "dd/MM/yyyy");
  registrarHistoricoVoucher_(reg.ID_SOLICITACAO, reg.CPF_SOLICITANTE, "VOUCHER_REDATADO", usuario,
    "Documento datado de " + dataTexto + " para " + motivo + ". Mesmo protocolo e mesmo código (" +
    dadosDoc.codigo + "); o PDF anterior continua na pasta.", protocolo);

  return { ok: true, redatado: true, linkPdf: pdf.url, html: html };
}

/**
 * O certificado já emitido, datado de hoje, para imprimir e entregar.
 * Retirada presencial: "a data é a do dia em que imprimir para entregar".
 */
function voucherDocumentoParaImpressao(protocolo, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "beneficios", false);
    var quem = (sessao && (sessao.email || sessao.usuario)) || obterUsuarioAtualVoucher_();
    var r = voucherRedatarDocumento_(protocolo, new Date(), "impressão e entrega", quem);
    if (!r.ok) return r;
    return { ok: true, html: r.html, linkPdf: r.linkPdf, redatado: r.redatado,
             dataDocumento: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy") };
  } catch (e) {
    Logger.log("voucherDocumentoParaImpressao: " + e.message);
    return { ok: false, mensagem: "Erro ao preparar a impressão: " + e.message };
  }
}

/**
 * Emite várias solicitações de uma vez.
 *
 * Cada uma passa pela MESMA emissão do botão "Gerar certificado" — com as
 * mesmas travas (período, percentual, situação) — e uma que recusa não
 * derruba as outras. Para no limite de tempo e devolve as `restantes`, que a
 * tela manda de novo: lote grande vira duas ou três chamadas, não um erro de
 * tempo esgotado no meio.
 */
function voucherEmitirEmLote(protocolos, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    if (!lista.length) return { ok: false, mensagem: "Nenhuma solicitação selecionada." };

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return { ok: false, mensagem: "Outra emissão em lote está rodando. Tente de novo em um minuto." };
    }
    var inicio = Date.now();
    var emitidas = [], jaEmitidas = [], recusadas = [], restantes = [];
    try {
      for (var i = 0; i < lista.length; i++) {
        if (Date.now() - inicio > VOUCHER_LOTE_LIMITE_MS) { restantes = lista.slice(i); break; }
        var p = lista[i];
        var r;
        try { r = gerarDocumentoVoucher(p, "CERTIFICADO", {}); }
        catch (e) { r = { ok: false, mensagem: e.message }; }
        if (r && r.ok && r.reemitido) jaEmitidas.push(p);
        else if (r && r.ok) emitidas.push({ protocolo: p, presencial: !!r.retiradaPresencial });
        else recusadas.push({ protocolo: p, mensagem: (r && r.mensagem) || "Não emitiu." });
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true, emitidas: emitidas, jaEmitidas: jaEmitidas,
             recusadas: recusadas, restantes: restantes };
  } catch (e) {
    Logger.log("voucherEmitirEmLote: " + e.message);
    return { ok: false, mensagem: "Erro na emissão em lote: " + e.message };
  }
}
