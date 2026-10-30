// ================================================================
// ARQUIVO: CaixaSecretaria.gs
// CAIXA DA SECRETARIA NO SISGEP — 29/10/2026
//
// O usuário, em 29/10/2026: "Posso trabalhar os e-mails dentro do SISGEP?",
// "Tudo no mesmo lugar", "todos categorizados". A regra de 21/10 ("os
// e-mails da secretaria não devem ser acessados pelo financeiro") foi
// MUDADA por ele: em 29/10 só Secretaria e administrador; em 30/10, também
// o Financeiro. Ver CLAUDE.md, "E-MAILS DA SECRETARIA NO SISGEP".
//
// De onde vem: o leitor (leitor-secretaria/LeitorSecretaria.gs.txt), na
// conta da Secretaria, copia para a aba "Caixa" da ponte cada e-mail que não
// é voucher nem propaganda/notificação, com o TIPO que a IA deu. Voucher
// continua no módulo de Voucher (VoucherPedidosEmail.gs).
//
// Para onde vai: a resposta entra na fila "Saida" da ponte, e o leitor a
// envia como RESPOSTA na conversa, pela caixa da Secretaria. Nada sai sem o
// clique de uma pessoa (CLAUDE.md, "NADA SAI SOZINHO").
//
// QUEM ABRE (30/10/2026, o usuário mudou de novo: "tanto secretaria quanto
// financeiro podem olhar tudo. Se tiver categorizado, não tem problema"):
// administrador, o usuário secretaria@, e quem tem o módulo Comunicação,
// Financeiro ou Caixa da Secretaria. Quem só tem outros módulos (RH,
// Jurídico…) não abre.
// ================================================================

var CXS_ABA = "Caixa_Secretaria";
var CXS_COLUNAS = ["THREAD_ID", "ESTADO", "ULTIMA_VISTA", "TIPO_CORRIGIDO", "NOTA", "DECIDIDO_POR", "DECIDIDO_EM",
                   "CORRECOES_JSON"];
var CXS_TIPOS = {
  FILIACAO: { rotulo: "Filiação ou desfiliação", icone: "🪪", modulo: "sindicalizacao" },
  OFICIO_ESCOLA: { rotulo: "Escola — ofício, relação, desconto em folha", icone: "🏫", modulo: "documentos" },
  CONVENCAO: { rotulo: "Convenção e direitos trabalhistas", icone: "📜", modulo: "negociacao" },
  FINANCEIRO: { rotulo: "Financeiro — guia, boleto, pagamento", icone: "💰", modulo: "financeiro" },
  JURIDICO: { rotulo: "Jurídico — homologação, rescisão, processo", icone: "⚖", modulo: "juridico" },
  EVENTO: { rotulo: "Evento ou assembleia", icone: "📅", modulo: "eventos" },
  OUTRO: { rotulo: "Outro assunto", icone: "❓", modulo: "" }
};
var CXS_ESTADOS = { NOVO: "NOVO", RESPONDIDO: "RESPONDIDO", RESOLVIDO: "RESOLVIDO" };

/* ── a trava ── */
function cxsPode_(sessao) {
  if (!sessao || sessao.logado !== true) return false;
  if (String(sessao.perfil || "").toUpperCase().indexOf("ADMIN") > -1) return true;
  if (String(sessao.email || "").trim().toLowerCase() === "secretaria@sindeducacao.com") return true;
  /* 30/10/2026, o usuário: "tanto secretaria quanto financeiro podem olhar
     tudo. Se tiver categorizado, não tem problema." Abre para quem usa a
     Comunicação ou o Financeiro (e quem tem a Caixa liberada pelo nome). */
  return ["comunicacao", "financeiro", "caixaSecretaria"].some(function (m) { return sessaoPodeModulo_(sessao, m); });
}
function cxsExigir_(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  if (!cxsPode_(sessao)) {
    throw new Error("A Caixa da Secretaria abre para quem usa a Comunicação ou o Financeiro. " +
      "Peça ao administrador para liberar um desses módulos no seu usuário.");
  }
  return sessao;
}

/* ── a planilha de estado (do lado do SISGEP) ── */
function cxsAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CXS_ABA);
  if (!sh) {
    sh = ss.insertSheet(CXS_ABA);
    sh.getRange(1, 1, 1, CXS_COLUNAS.length).setValues([CXS_COLUNAS]);
  }
  return sh;
}
function cxsEstados_() {
  var m = {};
  vpeLinhas_(cxsAba_()).forEach(function (r) { m[String(r.THREAD_ID)] = r; });
  return m;
}
function cxsLinhasPonte_() {
  var sh = vpePonte_().getSheetByName("Caixa");
  return sh ? vpeLinhas_(sh) : [];
}
function cxsLinhaPonte_(id) {
  return cxsLinhasPonte_().filter(function (r) { return String(r.THREAD_ID) === String(id); })[0] || null;
}
function cxsEmail_(s) {
  var m = String(s || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : "";
}
function cxsNome_(s) {
  var t = String(s || "").replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return t && t.indexOf("@") === -1 ? t : "";
}

/** Situação de uma conversa: mensagem nova depois de resolvida volta a NOVO. */
function cxsSituacao_(p, est) {
  var estado = est ? String(est.ESTADO || CXS_ESTADOS.NOVO) : CXS_ESTADOS.NOVO;
  var nova = !!(est && String(est.ULTIMA_VISTA || "") && String(est.ULTIMA_VISTA) !== String(p.ULTIMA_MENSAGEM_ID));
  if (nova) estado = CXS_ESTADOS.NOVO;
  return { estado: estado, mensagemNova: nova };
}

function cxsResumo_(p, est, envios) {
  var msgs = vpeJson_(p.MENSAGENS_JSON, []);
  var primeira = msgs[0] || {}, ultima = msgs[msgs.length - 1] || {};
  var tipo = String((est && est.TIPO_CORRIGIDO) || p.TIPO || "OUTRO");
  var sit = cxsSituacao_(p, est);
  var meus = (envios[String(p.THREAD_ID)] || []);
  return {
    id: String(p.THREAD_ID), tipo: tipo, tipoRotulo: (CXS_TIPOS[tipo] || CXS_TIPOS.OUTRO).rotulo,
    icone: (CXS_TIPOS[tipo] || CXS_TIPOS.OUTRO).icone,
    de: cxsEmail_(ultima.replyTo || ultima.de), nome: cxsNome_(ultima.de) || cxsEmail_(ultima.de),
    assunto: String(primeira.assunto || "(sem assunto)"), pedido: String(p.PEDIDO || ""),
    trecho: String(ultima.corpo || "").replace(/\s+/g, " ").substring(0, 160),
    mensagens: msgs.length, anexos: vpeJson_(p.ANEXOS_JSON, []).length,
    recebidoTs: ultima.data ? new Date(ultima.data).getTime() : 0,
    recebidoEm: ultima.data ? Utilities.formatDate(new Date(ultima.data), "America/Sao_Paulo", "dd/MM HH:mm") : "",
    estado: sit.estado, mensagemNova: sit.mensagemNova,
    ultimaResposta: meus.length ? vpeRotuloEnvio_(meus[meus.length - 1].STATUS) : "",
    decididoPor: est ? String(est.DECIDIDO_POR || "") : ""
  };
}

/* ═══════════════ O QUE A TELA CHAMA ═══════════════ */

function caixaSecretariaPainel(tokenSessao) {
  try {
    cxsExigir_(tokenSessao);
    var est = cxsEstados_();
    var envios = vpeEnviosPorConversa_();
    var itens = cxsLinhasPonte_().map(function (p) { return cxsResumo_(p, est[String(p.THREAD_ID)], envios); });
    itens.sort(function (a, b) { return b.recebidoTs - a.recebidoTs; });
    var porTipo = {}, porEstado = { NOVO: 0, RESPONDIDO: 0, RESOLVIDO: 0 };
    itens.forEach(function (i) {
      if (i.estado !== CXS_ESTADOS.RESOLVIDO) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
      porEstado[i.estado] = (porEstado[i.estado] || 0) + 1;
    });
    var voucher = 0;
    try {
      vpeLinhas_().forEach(function (r) {
        var e = String(r.ESTADO || "");
        if (String(r.CAIXA) === "SECRETARIA" && ["PRONTO", "FALTA_DOC", "NAO_ENCONTRADO", "PRECISA_VOCE"].indexOf(e) > -1) voucher++;
      });
    } catch (eV) {}
    return { ok: true, itens: itens, porTipo: porTipo, porEstado: porEstado, voucherAConferir: voucher,
             tipos: Object.keys(CXS_TIPOS).map(function (k) {
               return { chave: k, rotulo: CXS_TIPOS[k].rotulo, icone: CXS_TIPOS[k].icone, modulo: CXS_TIPOS[k].modulo };
             }) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function caixaSecretariaDetalhe(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var est = cxsEstados_()[String(id)];
    var envios = vpeEnviosPorConversa_();
    var resumo = cxsResumo_(p, est, envios);
    var msgs = vpeJson_(p.MENSAGENS_JSON, []).map(function (m) {
      var d = new Date(m.data);
      return { de: m.de || "", nossa: false, ts: d.getTime(), assunto: m.assunto || "",
               data: Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"), corpo: m.corpo || "", id: m.id };
    });
    (envios[String(id)] || []).forEach(function (e) {
      var q = new Date(e.PROCESSADO_EM || e.CRIADO_EM);
      msgs.push({ de: "Secretaria (" + vpeRotuloEnvio_(e.STATUS) + ")", nossa: true, ts: q.getTime(), assunto: "",
        data: Utilities.formatDate(q, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
        corpo: String(e.HTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").substring(0, 4000) });
    });
    msgs.sort(function (a, b) { return a.ts - b.ts; });
    var anexos = vpeJson_(p.ANEXOS_JSON, []).map(function (a, i) {
      return { indice: i, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, disponivel: !!a.fileId };
    });
    var primeiro = (resumo.nome || "").split(/\s+/)[0] || "";
    primeiro = primeiro && primeiro.indexOf("@") === -1 ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
    var sugestao = "Olá" + (primeiro ? ", " + primeiro : "") + "!\nTudo bem?\n\n\n\nEstamos à disposição para esclarecer qualquer dúvida!\n\n" +
      vpeAssinaturaTexto_(sessao);   // de quem está logado (30/10/2026)
    return { ok: true, item: resumo, mensagens: msgs, anexos: anexos, sugestao: sugestao,
             nota: est ? String(est.NOTA || "") : "",
             tipos: Object.keys(CXS_TIPOS).map(function (k) { return { chave: k, rotulo: CXS_TIPOS[k].rotulo, modulo: CXS_TIPOS[k].modulo }; }) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function caixaSecretariaAnexo(id, indice, tokenSessao) {
  try {
    cxsExigir_(tokenSessao);
    var p = cxsLinhaPonte_(id);
    var a = p ? vpeJson_(p.ANEXOS_JSON, [])[Number(indice)] : null;
    if (!a || !a.fileId) return { ok: false, mensagem: "Anexo não disponível." };
    var blob = DriveApp.getFileById(String(a.fileId)).getBlob();
    var tipo = blob.getContentType() || a.tipo || "application/octet-stream";
    return { ok: true, nome: a.nome, tipo: tipo, dataUrl: "data:" + tipo + ";base64," + Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Responder — só com o clique, só como resposta, para quem escreveu. */
function caixaSecretariaResponder(id, texto, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    texto = String(texto || "").trim();
    if (texto.length < 10) return { ok: false, mensagem: "Escreva a resposta antes de enviar." };
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var ultima = msgs[msgs.length - 1] || {};
    var quem = sessao.email || sessao.usuario || "";
    var para = vpeResponderThread_({ REMETENTE_EMAIL: cxsEmail_(ultima.replyTo || ultima.de), CAIXA: "SECRETARIA",
      THREAD_ID: String(p.THREAD_ID), ULTIMA_MENSAGEM_ID: String(p.ULTIMA_MENSAGEM_ID) }, vpeTextoParaHtml_(texto), [], quem,
      /Atenciosamente/i.test(texto) ? "" : vpeAssinaturaHtml_("SECRETARIA", sessao));
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESPONDIDO, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID) }, quem);
    cxsAuditar_("RESPONDER", id, "Resposta para " + para, sessao);
    return { ok: true, mensagem: "Resposta para " + para + " na fila da Secretaria — sai em até 15 minutos." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Resolvido (com nota opcional) ou de volta para novo. */
function caixaSecretariaMarcar(id, estado, nota, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    estado = String(estado || "").toUpperCase();
    if (!CXS_ESTADOS[estado]) return { ok: false, mensagem: "Situação inválida." };
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var quem = sessao.email || sessao.usuario || "";
    var mud = { ESTADO: estado, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID) };
    if (nota !== undefined && nota !== null) mud.NOTA = String(nota).substring(0, 1000);
    cxsGravarEstado_(id, mud, quem);
    cxsAuditar_("MARCAR_" + estado, id, nota || "", sessao);
    return { ok: true, mensagem: estado === "RESOLVIDO" ? "Marcado como resolvido." : "Voltou para os novos." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** A IA errou o tipo: a pessoa corrige — e fica registrado (para aprender). */
function caixaSecretariaReclassificar(id, tipo, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    tipo = String(tipo || "").toUpperCase();
    if (!CXS_TIPOS[tipo]) return { ok: false, mensagem: "Tipo inválido." };
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var quem = sessao.email || sessao.usuario || "";
    var est = cxsEstados_()[String(id)] || {};
    var corr = vpeJson_(est.CORRECOES_JSON, []);
    corr.push({ em: Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm"), por: quem,
                deTipo: String(est.TIPO_CORRIGIDO || p.TIPO || ""), paraTipo: tipo });
    cxsGravarEstado_(id, { TIPO_CORRIGIDO: tipo, CORRECOES_JSON: JSON.stringify(corr) }, quem);
    cxsAuditar_("RECLASSIFICAR", id, (p.TIPO || "") + " → " + tipo, sessao);
    return { ok: true, mensagem: "Tipo corrigido para " + CXS_TIPOS[tipo].rotulo + "." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** A tela pergunta antes de desenhar: mostra o aviso certo, sem expor nada. */
function caixaSecretariaPodeAbrir(tokenSessao) {
  try { return { ok: true, pode: cxsPode_(exigirSessaoDocumentos_(tokenSessao, false)) }; }
  catch (e) { return { ok: false, pode: false, mensagem: e.message }; }
}

function cxsGravarEstado_(id, mud, quem) {
  var sh = cxsAba_();
  var reg = cxsEstados_()[String(id)] || { THREAD_ID: String(id), ESTADO: CXS_ESTADOS.NOVO };
  Object.keys(mud).forEach(function (k) { reg[k] = mud[k]; });
  reg.DECIDIDO_POR = quem;
  reg.DECIDIDO_EM = new Date();
  vpeGravar_(reg, sh);
}

function cxsAuditar_(acao, id, texto, sessao) {
  try {
    if (typeof auditar_ !== "function") return;
    auditar_({ modulo: "Comunicação", submodulo: "Caixa da Secretaria", acao: acao,
               registroId: String(id), valorNovo: String(texto || "").substring(0, 500), sessao: sessao || {} });
  } catch (e) { Logger.log("Auditoria da Caixa falhou: " + e.message); }
}
