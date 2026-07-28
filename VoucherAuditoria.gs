// =============================================================================
// ARQUIVO: VoucherAuditoria.gs
// Auditoria de consultas públicas de validação de voucher
// =============================================================================

function criarEstruturaVoucherAuditoria() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  let sh = ss.getSheetByName("Voucher_Auditoria");

  if (sh) {
    return {
      ok: true,
      mensagem: "A aba Voucher_Auditoria já existe."
    };
  }

  sh = ss.insertSheet("Voucher_Auditoria");

  const headers = [
    "DATA_HORA",
    "CODIGO_VALIDACAO",
    "PROTOCOLO",
    "TIPO_ACESSO",
    "RESULTADO",
    "USUARIO",
    "OBSERVACAO"
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  sh.getRange(1, 1, 1, headers.length)
    .setBackground("#002f6c")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);

  return {
    ok: true,
    mensagem: "Aba Voucher_Auditoria criada com sucesso."
  };
}

function registrarAuditoriaVoucher_(dados) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    let sh = ss.getSheetByName("Voucher_Auditoria");

    if (!sh) {
      criarEstruturaVoucherAuditoria();
      sh = ss.getSheetByName("Voucher_Auditoria");
    }

    sh.appendRow([
      new Date(),
      dados.codigoValidacao || "",
      dados.protocolo || "",
      dados.tipoAcesso || "VALIDACAO_PUBLICA",
      dados.resultado || "",
      dados.usuario || "PUBLICO",
      dados.observacao || ""
    ]);

  } catch (e) {
    Logger.log("registrarAuditoriaVoucher_ erro: " + e.message);
  }
}
function buscarVoucherEmitidoPorProtocolo_(protocolo) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Emitidos");

    if (!sh || sh.getLastRow() < 2) {
      return null;
    }

    const dados = sh.getDataRange().getValues();
    const headers = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    function idx() {
      for (let i = 0; i < arguments.length; i++) {
        const pos = headers.indexOf(arguments[i]);
        if (pos > -1) return pos;
      }
      return -1;
    }

    const idxProtocolo  = idx("PROTOCOLO", "NUMERO_PROTOCOLO");
    const idxCodigo     = idx("CODIGO_VALIDACAO", "CODIGO", "CÓDIGO");
    const idxLink       = idx("LINK_ARQUIVO", "LINK_PDF", "URL", "LINK");
    const idxData       = idx("DATA_EMISSAO", "DATA", "DATA_HORA");
    const idxPercentual = idx("PERCENTUAL", "PERCENTUAL_APLICADO");

    if (idxProtocolo === -1) {
      return null;
    }

    const protocoloBusca = String(protocolo || "").trim();

    for (let i = dados.length - 1; i >= 1; i--) {
      const protocoloLinha = String(dados[i][idxProtocolo] || "").trim();

      if (protocoloLinha === protocoloBusca) {
        return {
          encontrado: true,
          protocolo: protocoloLinha,
          codigo: idxCodigo > -1 ? String(dados[i][idxCodigo] || "") : "",
          linkPdf: idxLink > -1 ? String(dados[i][idxLink] || "") : "",
          dataEmissao: idxData > -1 ? dados[i][idxData] : "",
          percentual: idxPercentual > -1 ? dados[i][idxPercentual] : ""
        };
      }
    }

    return null;

  } catch (e) {
    Logger.log("buscarVoucherEmitidoPorProtocolo_ erro: " + e.message);
    return null;
  }
}