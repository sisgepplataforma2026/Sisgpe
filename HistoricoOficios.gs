// ============================================================================
// ARQUIVO: HistoricoOficios.gs
// ============================================================================

var ABA_FILA_OFICIOS      = "FILA_ENVIO_OFICIOS";

/* ── Listar histórico com filtros ── */

// SEM trava de modulo: consultada pela Central de E-mails e pelo nucleo
// de IA para dar contexto ao usuario. Sessao continua exigida.
function listarHistoricoOficios(filtros, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
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