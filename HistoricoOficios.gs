// ============================================================================
// ARQUIVO: HistoricoOficios.gs
// ============================================================================

var ABA_FILA_OFICIOS      = "FILA_ENVIO_OFICIOS";
var ABA_HISTORICO_OFICIOS = "Oficios_Historico";

/* ── Setup inicial ── */

function setupHistoricoOficios() {
  var ss   = SpreadsheetApp.openById(PLANILHA_ID);
  var fila = ss.getSheetByName(ABA_FILA_OFICIOS);
  if (!fila) throw new Error("Aba " + ABA_FILA_OFICIOS + " não encontrada.");

  var historico = ss.getSheetByName(ABA_HISTORICO_OFICIOS);
  if (!historico) {
    historico = ss.insertSheet(ABA_HISTORICO_OFICIOS);
    var cabecalho = [
      "DATA","NUMERO_OFICIO","TIPO","ESCOLA","CNPJ","EMAIL",
      "STATUS","USUARIO","CODIGO_VERIFICACAO","LINK_PDF","ID_FILA"
    ];
    historico.appendRow(cabecalho);
    historico.setFrozenRows(1);
    historico.getRange(1, 1, 1, cabecalho.length)
      .setFontWeight("bold")
      .setBackground("#002f6c")
      .setFontColor("#ffffff");
    historico.autoResizeColumns(1, cabecalho.length);
  }

  return sincronizarHistoricoOficios();
}

/* ── Sincronização INCREMENTAL ── */

function sincronizarHistoricoOficios() {
  var ss   = SpreadsheetApp.openById(PLANILHA_ID);
  var fila = ss.getSheetByName(ABA_FILA_OFICIOS);

  if (!fila) {
    return { erro: true, mensagem: "Aba " + ABA_FILA_OFICIOS + " não encontrada." };
  }

  var historico = ss.getSheetByName(ABA_HISTORICO_OFICIOS);
  if (!historico) {
    historico = ss.insertSheet(ABA_HISTORICO_OFICIOS);
    var cab = [
      "DATA","NUMERO_OFICIO","TIPO","ESCOLA","CNPJ","EMAIL",
      "STATUS","USUARIO","CODIGO_VERIFICACAO","LINK_PDF","ID_FILA"
    ];
    historico.appendRow(cab);
    historico.setFrozenRows(1);
    historico.getRange(1, 1, 1, cab.length)
      .setFontWeight("bold")
      .setBackground("#002f6c")
      .setFontColor("#ffffff");
  }

  var dadosFila = fila.getDataRange().getValues();
  if (dadosFila.length <= 1) {
    return { ok: true, novos: 0, mensagem: "Fila vazia — nada a sincronizar." };
  }

  var cabFila = dadosFila[0].map(String);
  var idx     = function(nome) { return cabFila.indexOf(nome); };
  var col     = getColunasFilaOficios_(idx);

  // Monta conjunto de IDs já presentes no histórico
  var idsExistentes = {};
  if (historico.getLastRow() > 1) {
    var dadosHist = historico.getDataRange().getValues();
    var cabHist   = dadosHist[0].map(String);
    var colIdHist = cabHist.indexOf("ID_FILA");
    if (colIdHist >= 0) {
      for (var h = 1; h < dadosHist.length; h++) {
        var idH = String(dadosHist[h][colIdHist] || "").trim();
        if (idH) idsExistentes[idH] = true;
      }
    }
  }

  // Apenas registros com ID novo
  var novasLinhas = [];
  for (var i = 1; i < dadosFila.length; i++) {
    var l  = dadosFila[i];
    var id = String(l[col.id] || "").trim();
    if (!id || idsExistentes[id]) continue;
    novasLinhas.push([
      l[col.data],
      l[col.numero],
      l[col.tipo],
      l[col.escola],
      l[col.cnpj],
      l[col.email],
      l[col.status] || "PENDENTE",
      l[col.usuario],
      l[col.codigo],
      extrairLinkPdfOficio_(l[col.anexos]),
      l[col.id]
    ]);
  }

  if (novasLinhas.length > 0) {
    historico.getRange(
      historico.getLastRow() + 1, 1, novasLinhas.length, 11
    ).setValues(novasLinhas);
    // autoResizeColumns apenas no setup — removido aqui para performance
  }

  return {
    ok: true,
    novos: novasLinhas.length,
    mensagem: "Sincronização concluída. " + novasLinhas.length + " novo(s) registro(s) adicionado(s)."
  };
}

/* ── Listar histórico com filtros ── */

function listarHistoricoOficios(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  filtros = filtros || {};

  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_FILA_OFICIOS);

  if (!aba) {
    return { erro: true, mensagem: "Aba " + ABA_FILA_OFICIOS + " não encontrada.", itens: [] };
  }

  var dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return { total: 0, itens: [] };

  var cab = dados[0].map(String);
  var idx = function(nome) { return cab.indexOf(nome); };
  var col = getColunasFilaOficios_(idx);

  var itens = [];
  for (var i = 1; i < dados.length; i++) {
    var l = dados[i];
    if (!l[col.id]) continue;
    itens.push({
      id:      l[col.id],
      data:    formatarDataHistoricoOficio_(l[col.data]),
      numero:  l[col.numero],
      tipo:    l[col.tipo],
      escola:  l[col.escola],
      cnpj:    l[col.cnpj],
      email:   l[col.email],
      status:  l[col.status] || "PENDENTE",
      usuario: l[col.usuario],
      codigo:  l[col.codigo],
      url:     extrairLinkPdfOficio_(l[col.anexos]),
      linkPdf: extrairLinkPdfOficio_(l[col.anexos])
    });
  }

  itens = aplicarFiltrosHistoricoOficios_(itens, filtros);
  itens.reverse();

  // Paginação opcional (achado #9) — só ativa se o chamador enviar
  // filtros.porPagina; sem isso, devolve a lista inteira como sempre.
  var pag = paginarItens_(itens, filtros);
  return {
    total:        pag.total,
    itens:        pag.itens,
    pagina:       pag.pagina,
    porPagina:    pag.porPagina,
    totalPaginas: pag.totalPaginas
  };
}

/* ── Registrar/atualizar por ID da fila ── */

function registrarHistoricoOficioPorFilaId(filaId) {
  if (!filaId) return { erro: true, mensagem: "ID da fila não informado." };

  var ss        = SpreadsheetApp.openById(PLANILHA_ID);
  var fila      = ss.getSheetByName(ABA_FILA_OFICIOS);
  var historico = ss.getSheetByName(ABA_HISTORICO_OFICIOS);

  if (!fila) return { erro: true, mensagem: "Aba " + ABA_FILA_OFICIOS + " não encontrada." };
  if (!historico) { setupHistoricoOficios(); historico = ss.getSheetByName(ABA_HISTORICO_OFICIOS); }

  var dados = fila.getDataRange().getValues();
  var cab   = dados[0].map(String);
  var idx   = function(nome) { return cab.indexOf(nome); };
  var col   = getColunasFilaOficios_(idx);

  var linha = null;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][col.id]) === String(filaId)) { linha = dados[i]; break; }
  }

  if (!linha) return { erro: true, mensagem: "Registro da fila não encontrado." };

  var valores = [[
    linha[col.data],   linha[col.numero], linha[col.tipo],
    linha[col.escola], linha[col.cnpj],   linha[col.email],
    linha[col.status] || "PENDENTE",
    linha[col.usuario], linha[col.codigo],
    extrairLinkPdfOficio_(linha[col.anexos]),
    linha[col.id]
  ]];

  var linhaExistente = localizarLinhaHistoricoPorId_(historico, filaId);
  if (linhaExistente > 1) {
    historico.getRange(linhaExistente, 1, 1, valores[0].length).setValues(valores);
  } else {
    historico.appendRow(valores[0]);
  }

  return { ok: true, mensagem: "Histórico do ofício atualizado." };
}

/* ── Helpers ── */

function getColunasFilaOficios_(idx) {
  return {
    id:      idx("ID"),
    data:    idx("DATA_CRIACAO"),
    numero:  idx("NUMERO_OFICIO"),
    tipo:    idx("TIPO"),
    escola:  idx("ESCOLA"),
    cnpj:    idx("CNPJ"),
    email:   idx("EMAIL_PRINCIPAL"),
    anexos:  idx("ANEXOS_JSON"),
    status:  idx("STATUS"),
    usuario: idx("USUARIO"),
    codigo:  idx("CODIGO_VERIFICACAO")
  };
}

function aplicarFiltrosHistoricoOficios_(itens, filtros) {
  var normalizar = function(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  var saida = itens;

  if (filtros.escola) {
    var qE = normalizar(filtros.escola);
    saida = saida.filter(function(i) { return normalizar(i.escola).indexOf(qE) > -1; });
  }
  if (filtros.numero) {
    var qN = normalizar(filtros.numero);
    saida = saida.filter(function(i) { return normalizar(i.numero).indexOf(qN) > -1; });
  }
  if (filtros.status) {
    var qS = normalizar(filtros.status);
    saida = saida.filter(function(i) { return normalizar(i.status) === qS; });
  }
  if (filtros.tipo) {
    var qT = normalizar(filtros.tipo);
    saida = saida.filter(function(i) { return normalizar(i.tipo).indexOf(qT) > -1; });
  }

  return saida;
}

function extrairLinkPdfOficio_(anexosJson) {
  try {
    var anexos = JSON.parse(String(anexosJson || "[]"));
    var pdf    = null;
    for (var i = 0; i < anexos.length; i++) {
      if (String(anexos[i].mimeType || "").indexOf("pdf") > -1) { pdf = anexos[i]; break; }
    }
    if (!pdf && anexos.length) pdf = anexos[0];
    if (pdf && pdf.fileId) return "https://drive.google.com/file/d/" + pdf.fileId + "/view";
  } catch (e) {}
  return "";
}

function formatarDataHistoricoOficio_(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  }
  return String(v);
}

function localizarLinhaHistoricoPorId_(aba, filaId) {
  var valores = aba.getDataRange().getValues();
  if (valores.length <= 1) return -1;
  var cab   = valores[0].map(String);
  var colId = cab.indexOf("ID_FILA");
  if (colId < 0) return -1;
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][colId]) === String(filaId)) return i + 1;
  }
  return -1;
}