/* ================================================================
   RECIBOS EM BRANCO DA FESTA — Compasso da Vida 2026 (04/11/2026)
   ================================================================
   O usuário: "Preciso gerar vários recibos para festa" — "Nome, CPF, Valor
   e serviço serão preenchidos na hora da festa"; "Data será impressa,
   numeração é necessário"; modelo A (1 por folha) aprovado
   (docs/mock-recibo-festa-A-1-por-folha.png).

   O que o SISGEP imprime: o timbrado, o número, a festa, o dia e a data.
   O resto fica em branco, para preencher à mão.

   NUMERAÇÃO SEM REPETIR: cada "Gerar" RESERVA os números no servidor (com
   trava), e o próximo lote continua de onde parou. Reimprimir um lote usa
   os MESMOS números — papel que deu problema na impressora não vira
   número novo. Os lotes ficam na aba Compasso_Recibos_Lotes.
   ================================================================ */

var CREC_PROP_PROXIMO = "COMPASSO_RECIBOS_PROXIMO";
var CREC_ABA = "Compasso_Recibos_Lotes";
var CREC_COLUNAS = ["LOTE", "INICIO", "FIM", "QUANTIDADE", "FESTA", "DIA", "CIDADE", "GERADO_EM", "GERADO_POR"];
var CREC_MAX = 300;
var CREC_PADRAO = { festa: "Festa dos Educadores — No Compasso da Vida 2026", dia: "19/12/2026", cidade: "Vitória" };
var CREC_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function crecAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CREC_ABA);
  if (!sh) { sh = ss.insertSheet(CREC_ABA); sh.getRange(1, 1, 1, CREC_COLUNAS.length).setValues([CREC_COLUNAS]); }
  return sh;
}
function crecLotes_() {
  var sh = crecAba_();
  if (sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), CREC_COLUNAS.length).getValues(), cab = v[0].map(String);
  return v.slice(1).map(function (l) { var o = {}; cab.forEach(function (c, i) { o[c] = l[i]; }); return o; })
    .filter(function (o) { return o.LOTE; });
}
function crecProximo_() {
  var n = Number(PropertiesService.getScriptProperties().getProperty(CREC_PROP_PROXIMO) || 0);
  if (!n) {   // sem propriedade: continua depois do maior número já reservado
    var maior = 0;
    crecLotes_().forEach(function (l) { maior = Math.max(maior, Number(l.FIM || 0)); });
    n = maior + 1;
  }
  return n;
}
/* "19/12/2026" → Date válida, ou null. */
function crecData_(s) {
  var m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return (d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1) ? d : null;
}
function crecExtenso_(d) { return d.getDate() + " de " + CREC_MESES[d.getMonth()] + " de " + d.getFullYear(); }
function crecFmt_(d) { return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); }

/* A arte do timbrado — a mesma do certificado de voucher (VoucherMarcaDagua.gs). */
function crecArte_() {
  return {
    cab: typeof cabecalhoVoucher_ === "function" ? cabecalhoVoucher_() : "",
    rod: typeof rodapeVoucher_ === "function" ? rodapeVoucher_() : "",
    md: typeof marcaDaguaVoucher_ === "function" ? marcaDaguaVoucher_() : ""
  };
}
function crecSaida_(lote, arte) {
  var d = crecData_(lote.DIA instanceof Date ? crecFmt_(lote.DIA) : lote.DIA);
  return { lote: String(lote.LOTE), inicio: Number(lote.INICIO), fim: Number(lote.FIM), quantidade: Number(lote.QUANTIDADE),
           festa: String(lote.FESTA), dia: d ? crecFmt_(d) : String(lote.DIA), cidade: String(lote.CIDADE),
           dataExtenso: d ? crecExtenso_(d) : String(lote.DIA), arte: arte || null };
}

/** A tela: o próximo número, os padrões da festa e os últimos lotes. */
function compassoRecibos_estado(tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  var lotes = crecLotes_().slice(-10).reverse().map(function (l) {
    var o = crecSaida_(l, null);
    o.geradoEm = l.GERADO_EM instanceof Date ? Utilities.formatDate(l.GERADO_EM, "America/Sao_Paulo", "dd/MM HH:mm") : String(l.GERADO_EM || "");
    o.geradoPor = String(l.GERADO_POR || "");
    return o;
  });
  return { ok: true, proximo: crecProximo_(), padrao: CREC_PADRAO, lotes: lotes, max: CREC_MAX };
}

/** Reserva os números e devolve o que a folha precisa. Nada é preenchido por ninguém além do SISGEP: festa, dia e data. */
function compassoRecibos_gerar(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "eventos", false);
  dados = dados || {};
  var qtd = Math.floor(Number(dados.quantidade || 0));
  if (!(qtd >= 1 && qtd <= CREC_MAX)) return { ok: false, mensagem: "Quantidade de 1 a " + CREC_MAX + "." };
  var festa = String(dados.festa || "").trim().substring(0, 140);
  if (!festa) return { ok: false, mensagem: "Escreva o nome da festa." };
  var dia = crecData_(dados.dia);
  if (!dia) return { ok: false, mensagem: "Dia da festa no formato dd/mm/aaaa (ex.: 19/12/2026)." };
  var cidade = String(dados.cidade || "").trim().substring(0, 60) || "Vitória";
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está gerando recibos agora. Tente de novo em alguns segundos." };
  try {
    var inicio = crecProximo_(), fim = inicio + qtd - 1;
    var lote = { LOTE: "L" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + inicio,
                 INICIO: inicio, FIM: fim, QUANTIDADE: qtd, FESTA: festa, DIA: crecFmt_(dia), CIDADE: cidade,
                 GERADO_EM: new Date(), GERADO_POR: String((sessao && (sessao.email || sessao.usuario)) || "") };
    crecAba_().appendRow(CREC_COLUNAS.map(function (c) { return lote[c]; }));
    PropertiesService.getScriptProperties().setProperty(CREC_PROP_PROXIMO, String(fim + 1));
    try { if (typeof auditar_ === "function") auditar_({ modulo: "Eventos", submodulo: "Recibos da festa", acao: "GERAR",
      registroId: lote.LOTE, valorNovo: "Nº " + inicio + " a " + fim + " · " + festa, sessao: sessao || {} }); } catch (eA) {}
    var r = crecSaida_(lote, crecArte_());
    r.ok = true;
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** Reimprimir um lote: os MESMOS números, nada novo é reservado. */
function compassoRecibos_reimprimir(loteId, tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  var l = crecLotes_().filter(function (x) { return String(x.LOTE) === String(loteId); })[0];
  if (!l) return { ok: false, mensagem: "Lote não encontrado." };
  var r = crecSaida_(l, crecArte_());
  r.ok = true;
  return r;
}

/** Prévia: 1 recibo, sem reservar número (sai "Nº PRÉVIA"). */
function compassoRecibos_previa(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  dados = dados || {};
  var dia = crecData_(dados.dia);
  if (!dia) return { ok: false, mensagem: "Dia da festa no formato dd/mm/aaaa (ex.: 19/12/2026)." };
  return { ok: true, previa: true, inicio: 0, fim: 0, quantidade: 1, festa: String(dados.festa || "").trim() || CREC_PADRAO.festa,
           dia: crecFmt_(dia), cidade: String(dados.cidade || "").trim() || "Vitória", dataExtenso: crecExtenso_(dia), arte: crecArte_() };
}
