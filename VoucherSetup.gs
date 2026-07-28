// =============================================================================
// ARQUIVO: VoucherSetup.gs
// Criação automática das abas do módulo Voucher
// =============================================================================

function criarEstruturaVoucherEmitidos() {

  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  let sh = ss.getSheetByName("Voucher_Emitidos");

  if (sh) {
    return {
      ok: true,
      mensagem: "A aba Voucher_Emitidos já existe."
    };
  }

  sh = ss.insertSheet("Voucher_Emitidos");

  const headers = [
    "ID_EMISSAO",
    "DATA_EMISSAO",
    "PROTOCOLO",
    "ID_SOLICITACAO",
    "NOME_SOLICITANTE",
    "CPF",
    "ESCOLA",
    "TIPO_DOCUMENTO",
    "CODIGO_VALIDACAO",
    "LINK_ARQUIVO",
    "PERCENTUAL",
    "USUARIO"
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
    mensagem: "Aba Voucher_Emitidos criada com sucesso."
  };
}
function criarEstruturaVoucherEscolasPendentes() {

  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  let sh = ss.getSheetByName("Voucher_EscolasPendentes");

  if (sh) {
    return {
      ok: true,
      mensagem: "A aba Voucher_EscolasPendentes já existe."
    };
  }

  sh = ss.insertSheet("Voucher_EscolasPendentes");

  const headers = [
    "DATA",
    "ESCOLA",
    "CNPJ",
    "CIDADE",
    "PROTOCOLO",
    "SOLICITANTE",
    "CPF",
    "STATUS",
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
    mensagem: "Aba Voucher_EscolasPendentes criada com sucesso."
  };
}
function criarEstruturaCompletaVoucher() {

  const r1 = criarEstruturaVoucherEmitidos();
  const r2 = criarEstruturaVoucherEscolasPendentes();

  return {
    ok: true,
    emitidos: r1.mensagem,
    escolasPendentes: r2.mensagem
  };
}