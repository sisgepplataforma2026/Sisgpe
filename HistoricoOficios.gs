// ============================================================================
// ARQUIVO: HistoricoOficios.gs
// ============================================================================

var ABA_FILA_OFICIOS      = "FILA_ENVIO_OFICIOS";

/* ── Listar histórico com filtros ── */

// SEM trava de modulo: consultada pela Central de E-mails e pelo nucleo
// de IA para dar contexto ao usuario. Sessao continua exigida.
function listarHistoricoOficios(filtros, tokenSessao) {
  /* PORTA TROCADA EM 01/09/2026 — de exigirSessaoDocumentos_ para
     exigirModulo_. A antiga (Sessao.gs:405) confere se a SESSAO e valida
     e, quando pedido, se o perfil e administrador — mas NAO consulta os
     modulos do usuario. Entao qualquer pessoa logada, com ou sem o modulo
     Documentos, alcancava esta funcao por chamada direta.

     Na Home isso nao aparecia porque o InicioResumo consulta
     `sessaoPodeModulo_` ANTES de chamar a fonte — a protecao estava no
     chamador, nao na funcao. Medido pelo t125, passo 9.

     `exigirModulo_` e o padrao da casa (398 usos em 78 arquivos). */
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  filtros = filtros || {};

  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_FILA_OFICIOS);

  if (!aba) {
    return { erro: true, mensagem: "Aba " + ABA_FILA_OFICIOS + " não encontrada.", itens: [] };
  }

  var ultimaLinha = aba.getLastRow();
  var ultimaCol   = aba.getLastColumn();
  if (ultimaLinha <= 1) return { total: 0, itens: [] };

  var cab = aba.getRange(1, 1, 1, ultimaCol).getValues()[0].map(String);
  var idx = function(nome) { return cab.indexOf(nome); };
  var col = getColunasFilaOficios_(idx);

  /* SÓ AS COLUNAS QUE O HISTÓRICO USA — e não a planilha inteira.
   *
   * A leitura era `getDataRange().getValues()`, que traz TODAS as colunas
   * de TODAS as linhas. Entre elas está HTML_BODY, que guarda o corpo
   * inteiro do e-mail de cada ofício — de longe a célula mais pesada da
   * aba, e que esta função nunca usa. Com a fila crescendo, a listagem
   * carregava megabytes de HTML só para descartá-los.
   *
   * Contexto de 19/08/2026: o usuário viu o histórico parado em
   * "Carregando" e a trava de espera confirmou que a chamada NÃO VOLTAVA —
   * nem sucesso, nem falha. Leitura pesada demais é uma das duas causas
   * que produzem exatamente isso; a outra está tratada logo abaixo, no
   * texto do pacote de retorno.
   *
   * Cada coluna vira uma leitura estreita. São mais chamadas, sim, e ainda
   * assim muito menos dado — que é o que custa aqui. */
  var nLinhas = ultimaLinha - 1;
  var cacheCol = {};
  function coluna(indice) {
    if (indice === undefined || indice < 0) return null;
    if (!cacheCol[indice]) {
      cacheCol[indice] = aba.getRange(2, indice + 1, nLinhas, 1).getValues();
    }
    return cacheCol[indice];
  }
  function valor(indice, linha) {
    var c = coluna(indice);
    return c ? c[linha][0] : "";
  }

  var itens = [];
  for (var i = 0; i < nLinhas; i++) {
    if (!valor(col.id, i)) continue;
    var anexosLinha = valor(col.anexos, i);
    var link = extrairLinkPdfOficio_(anexosLinha);
    /* TEXTO, NUNCA O VALOR CRU DA CÉLULA.
     *
     * google.script.run serializa o retorno para o navegador. Quando algo
     * no pacote não serializa — e uma Date inválida, vinda de célula com
     * conteúdo estranho, é o caso clássico —, o cliente recebe NULL: sem
     * erro, sem log, e NENHUM dos dois handlers dispara. A tela fica no
     * "Carregando" para sempre.
     *
     * Foi exatamente esse mecanismo que derrubou o envio do voucher em
     * 18/08/2026. Aqui os campos vinham crus da planilha — qualquer um
     * deles podia ser uma Date convertida pelo Sheets. */
    itens.push({
      id:      textoHistoricoOficio_(valor(col.id, i)),
      data:    formatarDataHistoricoOficio_(valor(col.data, i)),
      numero:  textoHistoricoOficio_(valor(col.numero, i)),
      tipo:    textoHistoricoOficio_(valor(col.tipo, i)),
      escola:  textoHistoricoOficio_(valor(col.escola, i)),
      cnpj:    textoHistoricoOficio_(valor(col.cnpj, i)),
      email:   textoHistoricoOficio_(valor(col.email, i)),
      status:  textoHistoricoOficio_(valor(col.status, i)) || "PENDENTE",
      usuario: textoHistoricoOficio_(valor(col.usuario, i)),
      codigo:  textoHistoricoOficio_(valor(col.codigo, i)),
      url:     link,
      linkPdf: link
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

/**
 * Qualquer célula vira texto que o google.script.run consegue mandar.
 *
 * Date válida sai legível; Date INVÁLIDA sai vazia em vez de derrubar a
 * serialização inteira. É a mesma trava que VoucherEnvio.gs ganhou em
 * 18/08/2026, pelo mesmo motivo: pacote que não serializa devolve NULL ao
 * navegador, sem erro e sem log, e a tela fica esperando para sempre.
 */
function textoHistoricoOficio_(v) {
  if (v === null || v === undefined || v === "") return "";
  try {
    if (Object.prototype.toString.call(v) === "[object Date]") {
      if (isNaN(v.getTime())) return "";
      return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    }
    return String(v);
  } catch (e) {
    return "";
  }
}

/* Delega ao conversor único. A versão anterior chamava Utilities.formatDate
   direto numa Date sem conferir se ela era válida — e formatDate LEVANTA
   exceção com Date inválida, o que derrubava a listagem inteira por causa
   de uma célula. */
function formatarDataHistoricoOficio_(v) {
  return textoHistoricoOficio_(v);
}