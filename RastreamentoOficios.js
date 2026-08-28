function registrarAberturaOficio_(idFila) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");

    if (!sh || sh.getLastRow() < 2) return;

    var hm = getHeaderMap_(sh);

    var colId                = hm["ID"];
    var colStatusRecebimento = hm["STATUS_RECEBIMENTO"];
    var colAberturas         = hm["ABERTURAS"];
    var colDataUltimaTent    = hm["DATA_ULTIMA_TENTATIVA"];

    if (!colId || !colStatusRecebimento || !colAberturas) return;

    var totalCols = sh.getLastColumn();
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();

    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      var idAtual = String(linha[colId - 1] || "").trim();

      if (idAtual !== String(idFila || "").trim()) continue;

      var linhaPlanilha = i + 2;
      var valoresLinha = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];

      var aberturasAtuais = parseInt(valoresLinha[colAberturas - 1], 10) || 0;
      var statusAtual = String(valoresLinha[colStatusRecebimento - 1] || "").trim().toUpperCase();

      valoresLinha[colAberturas - 1] = aberturasAtuais + 1;

      if (statusAtual !== "CONFIRMADO") {
        valoresLinha[colStatusRecebimento - 1] = "VISUALIZADO";
      }

      if (colDataUltimaTent) {
        valoresLinha[colDataUltimaTent - 1] = new Date();
      }

      sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);
      SpreadsheetApp.flush();

      return;
    }

  } catch (e) {
    Logger.log("Erro em registrarAberturaOficio_: " + e.message);
  }
}

function pixelTransparente_() {
  /* O ContentService entrega texto, não bytes binários e não possui MimeType.GIF.
   * O rastreamento já foi registrado por registrarAberturaOficio_ antes desta
   * resposta. Portanto devolvemos uma resposta vazia e válida; o elemento img
   * é invisível e não depende do corpo retornado para contabilizar o GET. */
  return ContentService
    .createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function gerarPixelAberturaOficio_(idFila) {
  var url = ScriptApp.getService().getUrl();

  if (!url) return "";

  return '<img src="' +
    url +
    '?track=open&id=' +
    encodeURIComponent(idFila) +
    '" width="1" height="1" style="display:none;width:1px;height:1px;" alt="">';
}
