/* ================================================================
   AVISAR O DIRETOR DA VISITA PELO WHATSAPP — 12/11/2026
   ================================================================
   O usuário: a sindicalização é presencial, na visita de um diretor ao
   local de trabalho; "teria que ter um atalho para enviar pelo zap ao
   Diretor que fará a visita"; "vai no zap dos Diretores: Jocimar Vila Real
   e Lindolpho Gadelha"; "3 - faça o aviso"; "nós incluímos e ele envia".

   - Os números NÃO ficam no código (LGPD): ficam nas Propriedades do
     script, cadastrados na tela (⚙ Diretores da visita), só por
     administrador.
   - O robô monta a mensagem a partir do e-mail (nome, local de trabalho,
     setor/função, e-mail, telefone), com a origem à vista; a pessoa edita.
   - O SISGEP abre o WhatsApp do diretor com a mensagem pronta. O envio é o
     toque da pessoa no WhatsApp (sem serviço pago, o WhatsApp não deixa o
     sistema enviar sozinho). Nada sai sem o clique.
   - Fica registrado na nota interna do e-mail e na memória do robô (tarefa
     "diretor-visita"): com o tempo ele sugere o diretor de cada escola.
   ================================================================ */

var CDV_PROP = "CXA_DIRETORES_VISITA";
var CDV_PADRAO = [{ nome: "Jocimar Vila Real", whats: "" }, { nome: "Lindolpho Gadelha", whats: "" }];

function cdvLer_() {
  var v = null;
  try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty(CDV_PROP) || "null"); } catch (e) { v = null; }
  return Array.isArray(v) && v.length ? v : CDV_PADRAO.map(function (d) { return { nome: d.nome, whats: d.whats }; });
}

function cdvFone_(s) {
  var d = String(s || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 12 && d.length <= 13 ? d : "";
}

function cdvAdmin_(sessao) {
  return String((sessao && sessao.perfil) || "").toUpperCase().indexOf("ADMIN") > -1;
}

/** Os diretores da visita (nome + WhatsApp). */
function caixaDiretoresVisita(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    return { ok: true, diretores: cdvLer_(), podeEditar: cdvAdmin_(sessao) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Cadastra/troca os diretores e o WhatsApp de cada um (só administrador). */
function caixaDiretoresVisitaSalvar(lista, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    if (!cdvAdmin_(sessao)) return { ok: false, mensagem: "Só um administrador cadastra os diretores da visita." };
    var limpa = [], erros = [];
    (Array.isArray(lista) ? lista : []).forEach(function (d) {
      var nome = String((d && d.nome) || "").trim().substring(0, 80);
      if (!nome) return;
      var bruto = String((d && d.whats) || "").trim(), fone = bruto ? cdvFone_(bruto) : "";
      if (bruto && !fone) erros.push(nome + ": WhatsApp inválido (use DDD + número)");
      limpa.push({ nome: nome, whats: fone });
    });
    if (erros.length) return { ok: false, mensagem: erros.join("; ") };
    if (!limpa.length) return { ok: false, mensagem: "Informe ao menos um diretor." };
    PropertiesService.getScriptProperties().setProperty(CDV_PROP, JSON.stringify(limpa));
    try { cxsAuditar_("DIRETORES_VISITA", "", limpa.map(function (d) { return d.nome; }).join(", "), sessao); } catch (eA) {}
    return { ok: true, diretores: limpa, mensagem: "Diretores salvos." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* O que o e-mail diz sobre a pessoa. A IA lê; sem IA, o que dá para tirar
   do remetente. Cada campo volta com a origem. */
function cdvDadosDoEmail_(conv) {
  var ult = conv.ultimo || {}, de = String(ult.replyTo || ult.de || "");
  var email = cxsEmail_(de);
  var nomeRem = de.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  var corpo = String(ult.corpo || "").substring(0, 3000);
  var out = {
    nome: { valor: nomeRem && nomeRem.indexOf("@") === -1 ? nomeRem : "", origem: "do remetente" },
    local: { valor: "", origem: "" }, setor: { valor: "", origem: "" },
    email: { valor: email, origem: "do remetente" },
    telefone: { valor: "", origem: "" }
  };
  var tel = corpo.match(/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/);
  if (tel) out.telefone = { valor: tel[0], origem: "do texto do e-mail" };
  try {
    var j = vpeChamarIA_("Leia o e-mail abaixo de uma pessoa que quer se sindicalizar e devolva SOMENTE JSON " +
      "{\"nome\":\"nome completo\",\"local\":\"empresa/escola e unidade/campus onde trabalha\",\"setor\":\"setor e função\",\"telefone\":\"telefone se houver\"}. " +
      "Campo que não estiver no e-mail fica vazio; não invente.\n\nDe: " + de + "\nAssunto: " + (ult.assunto || "") + "\n\n" + corpo, null, "diretor-visita");
    if (j) {
      if (j.nome) out.nome = { valor: String(j.nome).substring(0, 120), origem: "lido do e-mail" };
      if (j.local) out.local = { valor: String(j.local).substring(0, 160), origem: "lido do e-mail" };
      if (j.setor) out.setor = { valor: String(j.setor).substring(0, 160), origem: "lido do e-mail" };
      if (j.telefone) out.telefone = { valor: String(j.telefone).substring(0, 40), origem: "lido do e-mail" };
    }
  } catch (eIa) { /* sem IA: fica o que veio do remetente */ }
  if (!out.local.valor) {
    var esc = null;
    try { esc = cxfAcharEscola_(conv); } catch (eE) {}
    if (esc && esc.e) out.local = { valor: String(esc.e.escola || esc.e.Fantasia || esc.e.nome || ""), origem: "cadastro de escolas, " + esc.origem };
  }
  return out;
}

/* O diretor que a equipe mais avisou para e-mails do mesmo domínio. */
function cdvSugerido_(email, diretores) {
  var dom = String(email || "").split("@")[1] || "";
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
    if (sh && sh.getLastRow() > 1) {
      var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), c = v[0].map(String);
      var iT = c.indexOf("TAREFA"), iR = c.indexOf("REMETENTE"), iD = c.indexOf("DECIDIDO"), cont = {};
      v.slice(1).forEach(function (l) {
        if (String(l[iT]) !== "diretor-visita" || !dom || String(l[iR]).split("@")[1] !== dom) return;
        cont[String(l[iD])] = (cont[String(l[iD])] || 0) + 1;
      });
      var melhor = null;
      Object.keys(cont).forEach(function (n) { if (!melhor || cont[n] > cont[melhor]) melhor = n; });
      if (melhor && diretores.some(function (d) { return d.nome === melhor; }))
        return { nome: melhor, motivo: "é quem vocês avisaram para " + dom + " (" + cont[melhor] + "×)" };
    }
  } catch (e) {}
  return { nome: (diretores[0] || {}).nome || "", motivo: "" };
}

/** Prepara o aviso: diretores, sugestão e os dados da pessoa (não envia nada). */
function caixaAvisoDiretorPreparar(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    var diretores = cdvLer_();
    var dados = cdvDadosDoEmail_(conv);
    return { ok: true, diretores: diretores, sugerido: cdvSugerido_(dados.email.valor, diretores),
             dados: dados, podeEditar: cdvAdmin_(sessao) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Depois do clique em "Abrir no WhatsApp": fica na nota interna e na memória. */
function caixaAvisoDiretorRegistrar(id, diretor, sugerido, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    cxsExigirCaixaDe_(sessao, id);
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    diretor = String(diretor || "").trim();
    if (!cdvLer_().some(function (d) { return d.nome === diretor; })) return { ok: false, mensagem: "Diretor não cadastrado." };
    var quem = sessao.email || sessao.usuario || "";
    var quando = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
    var linha = "📱 Avisado " + diretor + " pelo WhatsApp em " + quando + (sessao.nome ? " (" + sessao.nome + ")" : "");
    var antes = String((cxsEstados_()[String(id)] || {}).NOTA || "");
    var nota = (antes ? antes + "\n" : "") + linha;
    cxsGravarEstado_(id, { NOTA: nota.substring(Math.max(0, nota.length - 1000)) }, quem);
    var conv = cxfConversaDe_(p);
    roboMemoriaRegistrar_({ tarefa: "diretor-visita", origem: String(p.CAIXA || "SECRETARIA"), chave: String(id),
      remetente: cxsEmail_((conv.ultimo || {}).replyTo || (conv.ultimo || {}).de), assunto: (conv.ultimo || {}).assunto || "",
      sugerido: String(sugerido || ""), decidido: diretor, quem: quem });
    return { ok: true, nota: nota, mensagem: linha };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
