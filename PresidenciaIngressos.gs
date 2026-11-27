/**
 * ÁREA DA PRESIDÊNCIA NO CELULAR — INGRESSOS (27/11/2026). CÓDIGO NOVO: não altera nenhuma função existente.
 * Decisões do usuário (CLAUDE.md, "ÁREA DA PRESIDÊNCIA"): só 3 pessoas — Presidente, Wanderson e Marcela —, cada uma com um LINK PESSOAL SECRETO e
 * revogável; só NOME e CATEGORIA (Convidado ou Acompanhante de associado); emissão pelo robô no TickOne (sem confirmação de outra pessoa);
 * ver/compartilhar/baixar o PDF na tela do celular; cancelar e "Corrigir nome" (= cancelar e emitir de novo); limite diário e registro de quem
 * emitiu. Ingresso de ASSOCIADO nunca aparece nesta área: só entra o que foi emitido AQUI (PEDIDO_POR começa com "PRES:").
 * Reaproveita as filas e os robôs de CompassoIngressosDados.gs (aba Ingressos_Emissoes / Ingressos_Exclusoes) sem modificá-los.
 *
 * SEGURANÇA: o link é a credencial. Só o HASH do link fica guardado (Propriedade PRES_ACESSOS). Toda função pública valida o link no
 * servidor e responde igual para link inexistente ou cancelado; excesso de tentativas inválidas bloqueia por 10 min. Gerar/revogar links
 * só roda no EDITOR, pelo dono do projeto (presidenciaGerarLinksSISGEP / presidenciaRevogarLinksSISGEP).
 */
var PRES_PROP = "PRES_ACESSOS";
var PRES_LIMITE_DIA = 100;          // ingressos por dia, somando os três (decisão do usuário: sugestão 100)
var PRES_MAX_POR_PEDIDO = 50;
var PRES_PESSOAS = ["Presidente", "Wanderson", "Marcela"];
var PRES_MSG_NEGADO = "Sem permissão: link inválido ou cancelado. Peça um novo link.";

function presHash_(k) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(k || ""));
  return d.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
}
function presAcessos_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PRES_PROP) || "{}"); } catch (e) { return {}; }
}
/** Registra um link (hash). `tokenFixo` só para teste; em uso o token é sorteado. */
function presRegistrarAcesso_(nome, tokenFixo) {
  var token = tokenFixo || (Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  var a = presAcessos_();
  a[presHash_(token)] = { nome: String(nome), criado: new Date().toISOString() };
  PropertiesService.getScriptProperties().setProperty(PRES_PROP, JSON.stringify(a));
  return token;
}
/** Devolve {nome} do dono do link, ou null. Conta tentativas inválidas (bloqueio de 10 min depois de 30). */
function presAcesso_(k) {
  var cache = CacheService.getScriptCache(), n = 0;
  try { n = Number(cache.get("PRES_FALHAS") || 0); } catch (e) {}
  if (n >= 30) return null;
  k = String(k || "");
  var ac = k.length >= 20 ? presAcessos_()[presHash_(k)] : null;
  if (!ac) { try { cache.put("PRES_FALHAS", String(n + 1), 600); } catch (e2) {} return null; }
  return ac;
}
function presNegado_() { return { ok: false, negado: true, mensagem: PRES_MSG_NEGADO }; }
function presDonoNoEditor_() {
  var a = "", ef = "";
  try { a = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e1) {}
  try { ef = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
  return !!a && a === ef;
}

/** EDITOR: cria um link novo para cada pessoa (os antigos deixam de valer). Mostra os endereços UMA vez no Registro. */
function presidenciaGerarLinksSISGEP() {
  if (!presDonoNoEditor_()) return { erro: true, mensagem: "Sem permissão: só roda no editor do Apps Script, pelo dono do projeto." };
  PropertiesService.getScriptProperties().deleteProperty(PRES_PROP);
  var base = "";
  try { base = String(ScriptApp.getService().getUrl() || ""); } catch (e) {}
  var L = ["═══ LINKS DA PRESIDÊNCIA — guarde; não serão mostrados de novo ═══"];
  PRES_PESSOAS.forEach(function (nome) { L.push(nome + ": " + base + "?page=presidencia&k=" + presRegistrarAcesso_(nome)); });
  Logger.log(L.join("\n"));
  return L;
}
function presidenciaRevogarLinksSISGEP() {
  if (!presDonoNoEditor_()) return { erro: true, mensagem: "Sem permissão: só roda no editor do Apps Script, pelo dono do projeto." };
  PropertiesService.getScriptProperties().deleteProperty(PRES_PROP);
  Logger.log("Todos os links da Presidência foram cancelados.");
  return "ok";
}

/* ─────────── dados da área ─────────── */
function presDoArea_(o) { return String(o.PEDIDO_POR || "").indexOf("PRES:") === 0; }
function presHoje_() { return Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd"); }
function presQtdHoje_() {
  var hoje = presHoje_(), n = 0;
  cingEmissoes_().forEach(function (o) {
    if (!presDoArea_(o) || o.STATUS === "FALHOU") return;
    var d = o.PEDIDO_EM instanceof Date ? Utilities.formatDate(o.PEDIDO_EM, "America/Sao_Paulo", "yyyy-MM-dd") : String(o.PEDIDO_EM || "").slice(0, 10);
    if (d === hoje) n++;
  });
  return n;
}
function presCategoriaValida_(c) { c = String(c || ""); return (c === "convite" || c === "acompanhante") ? c : ""; }

function presidencia_estado(k) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    var emitidos = cingEmissoes_().filter(function (o) { return presDoArea_(o) && o.STATUS === "EMITIDO"; }).length;
    var hoje = presQtdHoje_();
    return { ok: true, nome: ac.nome, emitidos: emitidos, hoje: hoje, limite: PRES_LIMITE_DIA, restante: Math.max(0, PRES_LIMITE_DIA - hoje) };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** Pesquisa antes de pedir (por NOME, pois não há CPF). Não grava nada. */
function presidencia_conferir(k, itens) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    itens = Array.isArray(itens) ? itens.slice(0, PRES_MAX_POR_PEDIDO) : [];
    if (!itens.length) return { ok: false, mensagem: "Adicione pelo menos um nome." };
    var base = cingLerBase_();
    var porNome = {};
    if (base) base.linhas.forEach(function (l) { var c = cingNomeChave_(l.nome); if (c) (porNome[c] = porNome[c] || []).push(l); });
    var abertos = {};
    cingEmissoes_().forEach(function (o) { if (o.STATUS === "PEDIDO") abertos[cingNomeChave_(o.NOME)] = true; });
    var vistos = {}, res = [];
    itens.forEach(function (it, i) {
      it = it || {};
      var nome = String(it.nome || "").replace(/\s+/g, " ").trim().substring(0, 120), cat = presCategoriaValida_(it.categoria);
      var r = { i: i, nome: nome, categoria: cat, situacao: "novo", motivo: "" }, ch = cingNomeChave_(nome);
      if (nome.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 3) { r.situacao = "invalido"; r.motivo = "Escreva o nome completo."; }
      else if (!cat) { r.situacao = "invalido"; r.motivo = "Escolha Convidado ou Acompanhante de associado."; }
      else if (vistos[ch] != null) { r.situacao = "invalido"; r.motivo = "Nome repetido na lista."; }
      else if (abertos[ch]) { r.situacao = "ja_pedido"; r.motivo = "Já foi pedido e está sendo gerado."; }
      else if ((porNome[ch] || []).length) { r.situacao = "conferir"; r.codigo = porNome[ch][0].codigo; r.motivo = "Já existe ingresso com este nome (" + porNome[ch][0].codigo + "). Se é outra pessoa, marque para emitir mesmo."; }
      if (ch) vistos[ch] = i;
      res.push(r);
    });
    var cont = { novo: 0, conferir: 0, outros: 0 };
    res.forEach(function (r) { if (r.situacao === "novo") cont.novo++; else if (r.situacao === "conferir") cont.conferir++; else cont.outros++; });
    return { ok: true, resultados: res, contagem: cont, hoje: presQtdHoje_(), limite: PRES_LIMITE_DIA };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** Pede a emissão. Refaz a conferência aqui; 'conferir' só entra com `forcar: true`. Respeita o limite do dia. */
function presidencia_gerar(k, itens, confirmado) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    if (confirmado !== true) return { ok: false, mensagem: "Confirme que isto cria ingresso de verdade." };
    var cf = presidencia_conferir(k, itens);
    if (!cf.ok) return cf;
    var forca = {};
    (Array.isArray(itens) ? itens : []).forEach(function (it, i) { if (it && it.forcar === true) forca[i] = true; });
    var emitir = cf.resultados.filter(function (r) { return r.situacao === "novo" || (r.situacao === "conferir" && forca[r.i]); });
    if (!emitir.length) return { ok: false, mensagem: "Ninguém novo para gerar." };
    if (presQtdHoje_() + emitir.length > PRES_LIMITE_DIA) return { ok: false, mensagem: "Limite do dia: " + PRES_LIMITE_DIA + " ingressos (já foram " + presQtdHoje_() + " hoje). Peça menos ou espere amanhã." };
    if (!cingFilaPronta_(CING_ARQ_FILA_EMIS)) return { ok: false, mensagem: "O sistema de emissão ainda não está pronto. Avise o Wanderson." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Há outro pedido sendo feito agora. Tente de novo em instantes." };
    try {
      var sh = cingAbaEmis_(), agora = new Date(), linhas = [], quem = "PRES:" + ac.nome;
      emitir.forEach(function (r, n) {
        var id = "E" + Utilities.formatDate(agora, "America/Sao_Paulo", "yyyyMMddHHmmss") + "-P" + (n + 1);
        linhas.push([id, r.nome, "", "", "", "", "", r.categoria, agora, quem, "PEDIDO", "", "", ""]);
      });
      var ini = sh.getLastRow() + 1;
      try { sh.getRange(ini, 3, linhas.length, 1).setNumberFormat("@"); sh.getRange(ini, 5, linhas.length, 1).setNumberFormat("@"); } catch (eF) {}
      sh.getRange(ini, 1, linhas.length, CING_COLUNAS_EMIS.length).setValues(linhas);
      cingPublicarFilaEmissao_();
      var rb = cingDispararRobo_("emitir");
      return { ok: true, pedidos: linhas.length, robo: rb, mensagem: linhas.length + " ingresso(s) sendo gerado(s). Leva alguns minutos." + (rb.acionado ? "" : " (O robô será acionado pelo Wanderson.)") };
    } finally { lock.releaseLock(); }
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** A lista da área, mais nova primeiro, já com o estado de cada ingresso (gerando / pronto / falhou / cancelando / cancelado). */
function presidencia_meus(k) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    try { cingSincronizarEmissoes_(); } catch (e1) {}
    try { cingSincronizarResultado_(); } catch (e2) {}
    var pdfs = {}; try { pdfs = cingPdfs_(); } catch (e3) {}
    var exc = cingExclusaoPorCodigo_();
    var lista = cingEmissoes_().filter(presDoArea_).reverse().map(function (o) {
      var cod = String(o.CODIGO || ""), x = cod ? exc[cod] : null, estado = "gerando", pdf = "";
      if (o.STATUS === "FALHOU") estado = "falhou";
      else if (o.STATUS === "EMITIDO") { pdf = pdfs[cingNomeChave_(o.NOME)] || ""; estado = pdf ? "pronto" : "gerando"; }
      if (x && x.STATUS === "EXCLUIDO") estado = "cancelado";
      else if (x && x.STATUS === "PEDIDO") estado = "cancelando";
      return { pedido: String(o.PEDIDO), nome: String(o.NOME), categoria: String(o.CATEGORIA), rotulo: cingRotuloCategoria_(String(o.CATEGORIA)), codigo: cod,
               estado: estado, pdf: pdf, por: String(o.PEDIDO_POR || "").replace(/^PRES:/, ""), detalhe: o.STATUS === "FALHOU" ? String(o.RESULTADO || "").substring(0, 160) : "" };
    });
    return { ok: true, ingressos: lista, hoje: presQtdHoje_(), limite: PRES_LIMITE_DIA };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** Só do que foi emitido NESTA área, e que ainda existe. */
function presLinhaDaArea_(codigo) {
  var cod = String(codigo || "").trim(); if (!cod) return null;
  var achou = cingEmissoes_().filter(function (o) { return presDoArea_(o) && o.STATUS === "EMITIDO" && String(o.CODIGO) === cod; })[0];
  return achou || null;
}

function presidencia_cancelar(k, codigo, motivo, confirmado) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    if (confirmado !== true) return { ok: false, mensagem: "Confirme que entende que o cancelamento não tem volta." };
    var o = presLinhaDaArea_(codigo);
    if (!o) return { ok: false, mensagem: "Este ingresso não é da Presidência (ou já foi cancelado)." };
    var base = cingLerBase_();
    var l = base && base.linhas.filter(function (x) { return x.codigo === String(o.CODIGO); })[0];
    if (!l) return { ok: false, mensagem: "O ingresso não está mais na base do TickOne (talvez já tenha sido cancelado)." };
    if (!cingFilaPronta_(CING_ARQ_FILA)) return { ok: false, mensagem: "O sistema de cancelamento ainda não está pronto. Avise o Wanderson." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Tente de novo em instantes." };
    try {
      var atual = cingExclusaoPorCodigo_()[l.codigo];
      if (atual && (atual.STATUS === "PEDIDO" || atual.STATUS === "EXCLUIDO")) return { ok: false, mensagem: "Este ingresso já está sendo cancelado ou foi cancelado." };
      var id = "X" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + l.codigo;
      var shX = cingAbaExcl_(), linhaX = shX.getLastRow() + 1;
      try { shX.getRange(linhaX, 4).setNumberFormat("@"); shX.getRange(linhaX, 8).setNumberFormat("@"); } catch (eF) {}
      shX.appendRow([id, l.codigo, l.nome, l.cpf, l.tipo, l.escola, l.cidade, l.tel, String(motivo || "Presidência").trim().substring(0, 200), new Date(), "PRES:" + ac.nome, "PEDIDO", "", ""]);
      cingPublicarFila_();
      var rb = cingDispararRobo_("excluir");
      return { ok: true, pedido: id, robo: rb, mensagem: "Cancelamento pedido. Leva alguns minutos." };
    } finally { lock.releaseLock(); }
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** O PDF em base64, para Compartilhar/Baixar no celular. Só de ingresso da área. */
function presidencia_pdf(k, codigo) {
  try {
    var ac = presAcesso_(k); if (!ac) return presNegado_();
    var o = presLinhaDaArea_(codigo);
    if (!o) return { ok: false, mensagem: "Este ingresso não é da Presidência." };
    var url = (cingPdfs_()[cingNomeChave_(o.NOME)] || "");
    var m = url.match(/\/d\/([\w-]+)/);
    if (!m) return { ok: false, mensagem: "O PDF ainda está sendo preparado." };
    var blob = DriveApp.getFileById(m[1]).getBlob();
    if (blob.getBytes().length > 4000000) return { ok: false, mensagem: "O PDF é grande demais para compartilhar daqui; use Ver ingresso." };
    return { ok: true, nome: "Ingresso - " + String(o.NOME) + ".pdf", base64: Utilities.base64Encode(blob.getBytes()), tipo: "application/pdf" };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** Entrega da página (usada pela rota ?page=presidencia&k=…). Link inválido → página simples, sem dado nenhum. */
function presidencia_pagina_(k) {
  var ac = presAcesso_(k);
  if (!ac) {
    return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:28px;text-align:center"><h2>SindEducação-ES</h2><p>Este link não é válido ou foi cancelado.</p><p>Peça um novo link ao Wanderson.</p></body>')
      .setTitle("SindEducação-ES").addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  }
  var html = HtmlService.createHtmlOutputFromFile("PresidenciaIngressosTela").getContent().replace("__PRES_K__", String(k).replace(/[^A-Za-z0-9]/g, ""));
  return HtmlService.createHtmlOutput(html).setTitle("Compasso da Vida 2026 — Presidência")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
