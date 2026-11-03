/* ================================================================
   CAIXA DA FINANCEIRO@ — NOVO E-MAIL E RASCUNHOS (03/11/2026)
   ================================================================
   Etapa B do mockup aprovado (docs/mock-caixa-pastas-financeiro.png):
   escrever do zero, guardar como rascunho no Gmail, abrir um rascunho e
   enviar. Só a financeiro@ (Gmail da conta do projeto). Nada sai sem o
   clique; em homologação só para a equipe (vpeChecarDestinoAmbiente_).
   ================================================================ */

var CXN_PREFIXO_RASCUNHO = "R:";

function cxnEmails_(s) {
  return String(s || "").split(/[,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(String);
}
function cxnValidar_(lista, rotulo, obrigatorio) {
  if (obrigatorio && !lista.length) throw new Error("Informe para quem vai o e-mail.");
  lista.forEach(function (e) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("E-mail inválido em " + rotulo + ": " + e);
  });
}

/** Os rascunhos da financeiro@, para a pasta Rascunhos. */
function cxnListarRascunhos_() {
  return (cxsGmailFinanceiro_().getDrafts() || []).map(function (d) {
    var m = d.getMessage();
    var para = String(m.getTo() || "");
    var quando = new Date(m.getDate());
    var corpo = vpeSemCitacao_(String(m.getPlainBody() || ""));
    return { id: CXN_PREFIXO_RASCUNHO + d.getId(), fonte: "RASCUNHO", caixa: "FINANCEIRO", pasta: "DRAFTS",
      nome: "Para: " + (cxsNome_(para) || cxsEmail_(para) || "(sem destinatário)"), de: cxsEmail_(para),
      assunto: String(m.getSubject() || "(sem assunto)"), trecho: corpo.replace(/\s+/g, " ").substring(0, 160),
      tipo: "OUTRO", tipoRotulo: "📝 Rascunho", icone: "📝", estado: "NOVO", anexos: (m.getAttachments() || []).length,
      recebidoTs: quando.getTime(), recebidoEm: Utilities.formatDate(quando, "America/Sao_Paulo", "dd/MM HH:mm") };
  });
}

/** Um rascunho, para abrir na tela de escrever. */
function caixaFinanceiroRascunho(id, tokenSessao) {
  try {
    cxpExigirFinanceiro_(tokenSessao);
    var d = cxnRascunho_(id);
    var m = d.getMessage();
    return { ok: true, rascunho: { id: String(id), para: String(m.getTo() || ""), cc: String(m.getCc() || ""),
      assunto: String(m.getSubject() || ""), texto: String(m.getPlainBody() || ""),
      anexos: (m.getAttachments() || []).map(function (a) { return a.getName(); }) } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
function cxnRascunho_(id) {
  id = String(id || "");
  if (id.indexOf(CXN_PREFIXO_RASCUNHO) !== 0) throw new Error("Rascunho inválido.");
  var d = cxsGmailFinanceiro_().getDraft(id.substring(CXN_PREFIXO_RASCUNHO.length));
  if (!d) throw new Error("O rascunho não está mais no Gmail.");
  return d;
}

/**
 * Enviar (ou só guardar como rascunho) um e-mail novo pela financeiro@.
 * dados = { para, cc, assunto, texto, anexos:[{nome,tipo,base64}], anexosSisgep:[fileId],
 *           rascunhoId (abriu um rascunho), soGuardar: true (rascunho) }
 */
function caixaFinanceiroNovoEmail(dados, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    dados = dados || {};
    var para = cxnEmails_(dados.para), cc = cxnEmails_(dados.cc), cco = cxnEmails_(dados.cco);
    var assunto = String(dados.assunto || "").trim(), texto = String(dados.texto || "").trim();
    var soGuardar = dados.soGuardar === true;
    cxnValidar_(para, "Para", !soGuardar);
    cxnValidar_(cc, "Cc", false);
    cxnValidar_(cco, "Cco", false);
    if (!soGuardar) {
      if (!assunto) return { ok: false, mensagem: "Escreva o assunto antes de enviar." };
      if (texto.length < 5) return { ok: false, mensagem: "Escreva o texto antes de enviar." };
      para.concat(cc).concat(cco).forEach(vpeChecarDestinoAmbiente_);
    }
    var quem = sessao.email || sessao.usuario || "";
    var ids = cxfGuardarAnexos_({ anexos: dados.anexos || [], anexosSisgep: dados.anexosSisgep || [] }, quem);
    var blobs = ids.map(function (fid) { return DriveApp.getFileById(fid).getBlob(); });
    var gm = cxsGmailFinanceiro_();
    var rasc = dados.rascunhoId ? cxnRascunho_(dados.rascunhoId) : null;
    /* Os anexos que o rascunho já tinha (posto no Gmail) continuam junto. */
    if (rasc) blobs = (rasc.getMessage().getAttachments() || []).concat(blobs);
    var html = vpeTextoParaHtml_(texto) + (/Atenciosamente/i.test(texto) || !texto ? "" : vpeAssinaturaHtml_("FINANCEIRO", sessao));
    var op = { htmlBody: html, name: "SindEducação-ES — Financeiro" };
    if (cc.length) op.cc = cc.join(",");
    if (cco.length) op.bcc = cco.join(",");
    if (blobs.length) op.attachments = blobs;
    var destino = para.join(", ");
    if (soGuardar) {
      if (rasc) rasc.update(destino, assunto, texto, op); else rasc = gm.createDraft(destino, assunto, texto, op);
      cxsAuditar_("RASCUNHO", CXN_PREFIXO_RASCUNHO + rasc.getId(), "Rascunho guardado: " + assunto + (destino ? " · para " + destino : ""), sessao);
      try { CacheService.getScriptCache().remove("cxp_pastas_v1"); } catch (e) {}
      return { ok: true, rascunhoId: CXN_PREFIXO_RASCUNHO + rasc.getId(), mensagem: "Rascunho guardado no Gmail." };
    }
    if (rasc) { rasc.update(destino, assunto, texto, op); rasc.send(); }
    else gm.sendEmail(destino, assunto, texto, op);
    var nomesAnexos = blobs.map(function (b) { return b.getName(); });
    cxsAuditar_("NOVO_EMAIL", "financeiro@", "Enviado para " + destino + (cc.length ? " (cc " + cc.join(", ") + ")" : "") + (cco.length ? " (cco " + cco.join(", ") + ")" : "") + ": " + assunto +
      (nomesAnexos.length ? " · com " + nomesAnexos.length + " anexo(s): " + nomesAnexos.join(", ") : ""), sessao);
    roboMemoriaRegistrar_({ tarefa: "novo-email", origem: "FINANCEIRO", chave: destino, remetente: para[0], assunto: assunto,
      trecho: texto, sugerido: "", decidido: texto.substring(0, 2000), quem: quem });
    try { var c = CacheService.getScriptCache(); c.remove("cxp_pastas_v1"); } catch (e) {}
    return { ok: true, mensagem: "E-mail enviado para " + destino + " pela financeiro@" + (nomesAnexos.length ? ", com " + nomesAnexos.length + " anexo(s)." : ".") };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
