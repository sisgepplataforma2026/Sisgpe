/**
 * A SECRETARIA@ COM AS PASTAS, NO SISGEP (06/11/2026). O usuário: "as pastas
 * do e-mail da secretaria não vieram?" → "ler é uma coisa e aparecer é
 * outra" → "ela vai trabalhar dentro do SISGEP junto ao e-mail" → "De acordo".
 *
 * O LEITOR É O DE VERDADE (LeitorSecretaria.gs.txt), num contexto separado,
 * como no ar; o SISGEP fala com ele pelo UrlFetch, como no ar (o fetch daqui
 * chama o doPost dele). Gmail da Secretaria FALSO, dados FICTÍCIOS.
 *
 * Prova:
 *   - sem o leitor ligado, a tela não inventa pasta (ligada=false);
 *   - com ele: pastas (Enviados, Lixeira, criadas; sem as etiquetas do
 *     robô), cada uma carrega no clique, abrir, responder e encaminhar
 *     saem pela caixa da Secretaria;
 *   - ações em lote (estrela, mover, lixeira só confirmada, restaurar)
 *     numa chamada só; a Entrada da ponte também;
 *   - travas: segredo errado não passa; app rodando com outra conta recusa;
 *     o Wanderson (financeiro@) não abre as pastas da secretaria@;
 *   - o SISGEP NUNCA usa o próprio GmailApp para a secretaria@.
 * NÃO PROVA: o App da Web publicado de verdade (endereço, permissão) — no ar.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Exemplo",
  "secretaria@sindeducacao.com", "OPERADOR", "ATIVO", "NAO", "comunicacao"]);
const T_W = b.logar(g, "wanderson"), T_M = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);
const L = SIM.leitor;

/* ── O Gmail da Secretaria, falso, com pastas ── */
let seq = 0;
const TH = [], enviados = [];
function msg(th, de, para, corpo, quando) {
  const id = "SM" + (++seq);
  const m = { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => para, getCc: () => "",
    getSubject: () => th.assunto, getDate: () => quando, getPlainBody: () => corpo, getThread: () => th.obj,
    getAttachments: () => th.anexos || [], isStarred: () => !!m._est, isUnread: () => false,
    star: () => { m._est = true; }, unstar: () => { m._est = false; },
    reply: (body, op) => enviados.push(Object.assign({ via: "reply", msg: id }, op)),
    forward: (to, op) => enviados.push(Object.assign({ via: "forward", msg: id, to }, op)) };
  return m;
}
function conversa(id, assunto, onde, de, para, extra) {
  const th = Object.assign({ id, assunto, onde, etiquetas: [] }, extra || {});
  th.msgs = [msg(th, de, para, "Texto de " + assunto, new Date(Date.UTC(2026, 10, 5, 12, TH.length)))];
  th.obj = { getId: () => id, getMessages: () => th.msgs.slice(),
    moveToTrash: () => { th.onde = "TRASH"; }, moveToArchive: () => { if (th.onde === "INBOX") th.onde = "ARQ"; },
    moveToInbox: () => { th.onde = "INBOX"; }, addLabel: l => { th.etiquetas.push(l.getName()); } };
  TH.push(th);
  return th;
}
const anexoFalso = { getName: () => "ficha.pdf", getContentType: () => "application/pdf", getSize: () => 9, getBytes: () => Buffer.from("PDF-falso") };
conversa("E1", "Pedido de ficha", "INBOX", "Escola Exemplo <rh@escola.exemplo.com>", "secretaria@sindeducacao.com", { anexos: [anexoFalso] });
conversa("E2", "Resposta enviada pela Marcelha", "SENT", "SindEducação-ES <secretaria@sindeducacao.com>", "pessoa@exemplo.com");
conversa("E3", "Antigo apagado", "TRASH", "Fulano <fulano@exemplo.com>", "secretaria@sindeducacao.com");
conversa("E4", "Certificado 2027-1 de Ana", "ARQ", "Ana <ana@exemplo.com>", "secretaria@sindeducacao.com", { etiquetas: ["CERTIFICADO 2027-1"] });
const LABELS = ["CERTIFICADO 2027-1", "SISGEP/Filiação", "Convênios"];
const lab = n => ({ getName: () => n, getUnreadCount: () => 0,
  getThreads: (ini, max) => TH.filter(t => t.etiquetas.indexOf(n) > -1).slice(ini, ini + max).map(t => t.obj) });
const buscas = [];
L.GmailApp.search = (q, ini, max) => {
  buscas.push(q);
  const f = /in:sent/.test(q) ? t => t.onde === "SENT" : /in:trash/.test(q) ? t => t.onde === "TRASH"
    : /is:starred/.test(q) ? t => t.msgs.some(m => m._est) : /in:spam/.test(q) ? () => false
    : /-in:trash/.test(q) ? t => t.onde !== "TRASH" : t => t.onde === "INBOX";
  return TH.filter(f).slice(ini || 0, (ini || 0) + (max || 50)).map(t => t.obj);
};
L.GmailApp.getThreadById = id => (TH.find(t => t.id === id) || {}).obj || null;
L.GmailApp.getMessageById = id => { for (const t of TH) for (const m of t.msgs) if (m.getId() === id) return m; return null; };
L.GmailApp.getUserLabels = () => LABELS.map(lab);
L.GmailApp.getUserLabelByName = n => (LABELS.indexOf(n) > -1 ? lab(n) : null);
L.GmailApp.createLabel = n => { LABELS.push(n); return lab(n); };

/* O fetch do SISGEP chega no doPost do leitor — como no ar. */
let urlChamada = "";
const fetchOrig = g.UrlFetchApp.fetch;
g.UrlFetchApp.fetch = (url, op) => {
  if (!/macros\/s\/LEITOR/.test(url)) return fetchOrig(url, op);
  urlChamada = url;
  const out = L.doPost({ postData: { contents: op.payload } });
  return { getResponseCode: () => 200, getContentText: () => out.getContent() };
};
L.ScriptApp.getService = () => ({ getUrl: () => "https://script.google.com/macros/s/LEITOR/exec" });

b.fluxo("SECRETARIA@ · PASTAS · ligar");
b.passo("1. Antes de ligar o leitor, nada de pasta inventada");
let p = g.caixaSecretariaPastas(T_M);
b.ok(p.ok && p.ligada === false && !p.pastas.length, "sem o leitor na hora: ligada=false, sem pastas", JSON.stringify(p));

b.passo("2. caixaApiConfigurar: segredo + endereço na ponte, para o SISGEP achar sozinho");
L.caixaApiConfigurar();
const api = g.SpreadsheetApp.openById(g.PropertiesService.getScriptProperties().getProperty("VOUCHER_PEDIDOS_PONTE_ID")).getSheetByName("API");
b.ok(api && /LEITOR/.test(api.getRange(2, 1).getValue()) && String(api.getRange(2, 2).getValue()).length >= 60, "aba API com o endereço e um segredo longo");
g.CacheService.getScriptCache().remove("cxg_cfg_v1");

b.fluxo("SECRETARIA@ · PASTAS · o servidor");
b.passo("3. As pastas");
p = g.caixaSecretariaPastas(T_M);
b.ok(p.ok && p.ligada, "ligada", p.mensagem);
b.igual(p.pastas.map(x => x.chave), ["INBOX", "STARRED", "SENT", "DRAFTS", "ALL", "SPAM", "TRASH"], "Entrada, Estrela, Enviados, Rascunhos, Todos, Spam, Lixeira");
b.igual(p.marcadores.map(x => x.rotulo), ["CERTIFICADO 2027-1", "Convênios"], "as pastas criadas — sem as etiquetas do robô (SISGEP/…)");
b.ok(p.marcadores.find(m => m.rotulo === "CERTIFICADO 2027-1").robo && !p.pastas.find(x => x.chave === "SENT").robo, "🤖 só na Entrada e na CERTIFICADO 2027-1 (o robô não lê as outras)");
b.ok(g.caixaSecretariaPastas(T_W).ok === false, "o Wanderson (financeiro@) não abre as pastas da secretaria@");

b.passo("4. Cada pasta carrega no clique");
const env = g.caixaSecretariaPasta("SENT", 0, T_M);
b.ok(env.ok && env.itens.length === 1 && env.itens[0].id === "S:E2" && /^Para: /.test(env.itens[0].nome), "Itens enviados: S:E2, mostrando PARA QUEM", JSON.stringify(env.itens.map(i => [i.id, i.nome])));
b.ok(env.itens[0].caixa === "SECRETARIA", "o item é da secretaria@");
const cert = g.caixaSecretariaPasta("LABEL:CERTIFICADO 2027-1", 0, T_M);
b.ok(cert.ok && cert.itens.map(i => i.id).join() === "S:E4", "pasta criada (CERTIFICADO 2027-1) carrega as conversas dela");
const lix = g.caixaSecretariaPasta("TRASH", 0, T_M);
b.ok(lix.ok && lix.itens.map(i => i.id).join() === "S:E3", "Lixeira");

b.passo("5. Abrir, ver anexo, responder e encaminhar — pela caixa da Secretaria, na hora");
const d = g.caixaSecretariaDetalhe("S:E1", T_M);
b.ok(d.ok && d.mensagens.length === 1 && d.anexos.length === 1 && d.anexos[0].disponivel, "abre a conversa com o anexo", d.mensagem);
const ax = g.caixaSecretariaAnexo("S:E1", 0, T_M);
b.ok(ax.ok && /^data:application\/pdf;base64,/.test(ax.dataUrl), "o anexo abre (veio pelo leitor)", ax.mensagem);
const resp = g.caixaSecretariaResponder("S:E1", "Bom dia! Recebemos a ficha, obrigado.", T_M);
b.ok(resp.ok && /pela secretaria@/.test(resp.mensagem), "responde", resp.mensagem);
const er = enviados.find(e => e.via === "reply");
b.ok(er && er.replyTo === "secretaria@sindeducacao.com" && er.from === "secretaria@sindeducacao.com" && /Recebemos a ficha/.test(er.htmlBody),
  "sai como secretaria@, na mesma conversa (reply), com o texto", JSON.stringify(er && [er.from, er.replyTo]));
const enc = g.caixaEncaminhar("S:E1", "colega@sindeducacao.com", "Para você ver.", T_M);
b.ok(enc.ok && enviados.some(e => e.via === "forward" && e.to === "colega@sindeducacao.com"), "encaminha na hora", enc.mensagem);
/* 06/11/2026: "novo e-mail, responder e encaminhar devem ter a assinatura" */
const temAssin = h => /Atenciosamente,/.test(h) && /<em>Administrativo \/ Secretaria<\/em>/.test(h) && /lh3\.googleusercontent\.com/.test(h) && (h.match(/Atenciosamente/g) || []).length === 1;
b.ok(temAssin(er.htmlBody), "a resposta sai com a assinatura formatada e o logo", er.htmlBody.slice(-300));
const sug = g.caixaSecretariaDetalhe("S:E1", T_M).sugestao;
b.ok(/Atenciosamente,\n\nMarcelha Aline\nAdministrativo \/ Secretaria/.test(sug), "a resposta já abre com a assinatura, no formato novo", sug);
g.caixaSecretariaResponder("S:E1", sug.replace("\n\n\n\n", "\nSegue o combinado.\n\n"), T_M);
const er2 = enviados.filter(e => e.via === "reply").pop();
b.ok(temAssin(er2.htmlBody) && /Segue o combinado/.test(er2.htmlBody), "com a assinatura que veio na tela: sai uma só, a formatada, com o logo", er2.htmlBody.slice(-300));
const ef = enviados.filter(e => e.via === "forward").pop();
b.ok(temAssin(ef.htmlBody) && /Para você ver/.test(ef.htmlBody), "o encaminhar sai com a assinatura e o logo", ef.htmlBody.slice(-300));
g.caixaEncaminhar("S:E1", "colega@sindeducacao.com", "Veja abaixo.\n\n" + g.caixaMinhaAssinatura(T_M).texto, T_M);
const ef2 = enviados.filter(e => e.via === "forward").pop();
b.ok(temAssin(ef2.htmlBody), "encaminhar com a assinatura da tela: não repete", ef2.htmlBody.slice(-300));
g.caixaEncaminhar("S:E1", "colega@sindeducacao.com", "", T_M);
b.ok(temAssin(enviados.filter(e => e.via === "forward").pop().htmlBody), "encaminhar sem nota: vai só a assinatura");

b.passo("6. Ações em lote, numa chamada só ao leitor");
let chamadas = 0;
const f2 = g.UrlFetchApp.fetch;
g.UrlFetchApp.fetch = (u, o) => { if (/LEITOR/.test(u)) chamadas++; return f2(u, o); };
let a = g.caixaSecretariaAcao(["S:E2", "S:E4"], "ESTRELA", {}, T_M);
b.ok(a.ok && a.feitos === 2 && chamadas === 1, "estrela em 2 e-mails: 1 chamada", a.mensagem + " / " + chamadas);
b.ok(TH.find(t => t.id === "E2").msgs[0]._est, "a estrela está no Gmail da Secretaria");
a = g.caixaSecretariaAcao(["S:E2"], "LIXEIRA", {}, T_M);
b.ok(!a.ok && /Confirme/.test(a.mensagem) && TH.find(t => t.id === "E2").onde === "SENT", "lixeira sem confirmar: não vai");
a = g.caixaSecretariaAcao(["S:E2"], "LIXEIRA", { confirmado: true }, T_M);
b.ok(a.ok && TH.find(t => t.id === "E2").onde === "TRASH", "lixeira confirmada: vai para a lixeira da Secretaria");
a = g.caixaSecretariaAcao(["S:E3"], "RESTAURAR", {}, T_M);
b.ok(a.ok && TH.find(t => t.id === "E3").onde === "INBOX", "restaurar volta para a Entrada");
a = g.caixaSecretariaAcao(["E1"], "MOVER", { para: "LABEL:Convênios" }, T_M);
b.ok(a.ok && TH.find(t => t.id === "E1").etiquetas.indexOf("Convênios") > -1, "o id da Entrada (ponte) também serve: mover para Convênios");
const nova = g.caixaSecretariaCriarPasta("Ofícios 2026", T_M);
b.ok(nova.ok && LABELS.indexOf("Ofícios 2026") > -1, "criar pasta: aparece no Gmail da Secretaria", nova.mensagem);
b.ok(!g.caixaSecretariaCriarPasta("SISGEP/Teste", T_M).ok, "nome das etiquetas do robô é reservado");
b.ok(g.caixaSecretariaAcao(["S:E1"], "ESTRELA", {}, T_W).ok === false, "o Wanderson não age na caixa da Secretaria");
g.UrlFetchApp.fetch = f2;

b.passo("6b. Novo e-mail e rascunho pela secretaria@ — e-mail normal, com a assinatura");
const DRAFTS = [];
L.GmailApp.getDrafts = () => DRAFTS.map(d => d.obj);
L.GmailApp.getDraft = id => (DRAFTS.find(d => d.id === id) || {}).obj || null;
L.GmailApp.createDraft = (para, assunto, texto, op) => {
  const d = { id: "D" + (DRAFTS.length + 1), para, assunto, texto, op };
  d.obj = { getId: () => d.id, getMessage: () => ({ getTo: () => d.para, getCc: () => (d.op && d.op.cc) || "", getSubject: () => d.assunto,
    getPlainBody: () => d.texto, getDate: () => new Date(), getAttachments: () => [] }),
    update: (p2, a2, t2, o2) => { Object.assign(d, { para: p2, assunto: a2, texto: t2, op: o2 }); return d.obj; },
    send: () => { enviados.push(Object.assign({ via: "rascunho", to: d.para, subject: d.assunto }, d.op)); } };
  DRAFTS.push(d); return d.obj;
};
L.GmailApp.sendEmail = (to, subject, texto, op) => enviados.push(Object.assign({ via: "novo", to, subject, texto }, op));
let nv = g.caixaSecretariaNovoEmail({ para: "", assunto: "Convite", texto: "Rascunho do convite", soGuardar: true }, T_M);
b.ok(nv.ok && /^R:D1$/.test(nv.rascunhoId), "guarda o rascunho na caixa da Secretaria", nv.mensagem);
const rp = g.caixaSecretariaPasta("DRAFTS", 0, T_M);
b.ok(rp.ok && rp.itens.length === 1 && rp.itens[0].fonte === "RASCUNHO" && rp.itens[0].caixa === "SECRETARIA", "aparece na pasta Rascunhos");
b.ok(g.caixaSecretariaRascunho("R:D1", T_M).rascunho.texto === "Rascunho do convite", "abre o rascunho para continuar");
nv = g.caixaSecretariaNovoEmail({ para: "equipe@sindeducacao.com", cc: "outra@sindeducacao.com", assunto: "Reunião de sexta",
  texto: "Bom dia! A reunião é às 14h.", anexos: [{ nome: "pauta.pdf", tipo: "application/pdf", base64: Buffer.from("PDF").toString("base64") }] }, T_M);
const nE = enviados.filter(e => e.via === "novo").pop();
b.ok(nv.ok && /pela secretaria@/.test(nv.mensagem), "envia", nv.mensagem);
b.ok(nE && nE.to === "equipe@sindeducacao.com" && nE.cc === "outra@sindeducacao.com" && nE.from === "secretaria@sindeducacao.com" && nE.replyTo === "secretaria@sindeducacao.com",
  "sai como secretaria@, com Cc", JSON.stringify(nE && [nE.to, nE.cc, nE.from]));
b.ok(nE && /A reunião é às 14h/.test(nE.htmlBody) && /Atenciosamente,/.test(nE.htmlBody) && /<em>Administrativo \/ Secretaria<\/em>/.test(nE.htmlBody) &&
  /mailto:secretaria@sindeducacao\.com/.test(nE.htmlBody) && /lh3\.googleusercontent\.com\/d\/1c-RHfb0W/.test(nE.htmlBody), "com a assinatura da KingHost: cargo em itálico, e-mail em link e o logo", (nE && nE.htmlBody || "").slice(-300));
/* Texto com a assinatura que a tela pôs: sai uma só, a de verdade, com o logo. */
const assin = g.caixaMinhaAssinatura(T_M).texto;
g.caixaSecretariaNovoEmail({ para: "equipe@sindeducacao.com", assunto: "Com a assinatura da tela", texto: "Olá!\n\n" + assin + "\n" }, T_M);
const nE2 = enviados.filter(e => e.via === "novo").pop();
b.ok((nE2.htmlBody.match(/Atenciosamente/g) || []).length === 1 && /<img /.test(nE2.htmlBody) && /<em>/.test(nE2.htmlBody), "a assinatura que veio na tela não sai repetida — sai a formatada, com o logo", nE2.htmlBody.slice(0, 300));
g.caixaSecretariaNovoEmail({ para: "equipe@sindeducacao.com", assunto: "Assinada à mão", texto: "Olá!\n\nAtenciosamente,\nMarcela" }, T_M);
const nE3 = enviados.filter(e => e.via === "novo").pop();
b.ok((nE3.htmlBody.match(/Atenciosamente/g) || []).length === 1 && !/<img /.test(nE3.htmlBody), "assinou à mão: fica como ela escreveu, sem pôr outra");
b.ok(nE && (nE.attachments || []).length === 1 && nE.attachments[0].getName() === "pauta.pdf", "com o anexo");
b.ok(!g.caixaSecretariaNovoEmail({ para: "x@y.com", assunto: "a", texto: "texto qualquer" }, T_W).ok, "o Wanderson não escreve pela secretaria@");
b.ok(!g.caixaSecretariaNovoEmail({ para: "nao-email", assunto: "a", texto: "texto qualquer" }, T_M).ok, "e-mail inválido é barrado antes de sair");

b.passo("6c. Endereço de teste (/dev) não serve");
const shApi = api;
const urlBoa = shApi.getRange(2, 1).getValue();
shApi.getRange(2, 1).setValue("https://script.google.com/macros/s/LEITOR/dev");
g.CacheService.getScriptCache().remove("cxg_cfg_v1");
const rDev = g.caixaSecretariaPasta("SENT", 0, T_M);
b.ok(!rDev.ok && /implantação \(\/exec\)/.test(rDev.mensagem), "com /dev na ponte: avisa claro, não tenta", rDev.mensagem);
shApi.getRange(2, 1).setValue(urlBoa); g.CacheService.getScriptCache().remove("cxg_cfg_v1");

b.passo("7. Travas do leitor");
const seg = L.PropertiesService.getScriptProperties().getProperty("CAIXA_API_SEGREDO");
let out = JSON.parse(L.doPost({ postData: { contents: JSON.stringify({ segredo: "errado", op: "marcadores" }) } }).getContent());
b.ok(!out.ok && /acesso negado/.test(out.erro), "segredo errado: acesso negado");
const effOrig = L.Session.getEffectiveUser;
L.Session.getEffectiveUser = () => ({ getEmail: () => "financeirosindecucacao@gmail.com" });
out = JSON.parse(L.doPost({ postData: { contents: JSON.stringify({ segredo: seg, op: "marcadores" }) } }).getContent());
b.ok(!out.ok && /não está rodando como a conta da Secretaria/.test(out.erro), "publicado com outra conta: recusa (não abre a caixa errada)");
L.Session.getEffectiveUser = effOrig;
b.igual(SIM.tentativasSisgep || [], [], "o SISGEP não usou o GmailApp dele para a secretaria@");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: T_M });
(async function () {
  b.fluxo("SECRETARIA@ · PASTAS · a tela da Marcelha");
  t.win.cxsIniciar(); await t.assentar(300);
  const doc = t.doc;
  b.ok(doc.getElementById("cxsPastas").style.display !== "none", "a lateral de pastas aparece para ela");
  const txt = t.texto("#cxsPastas");
  b.ok(/Itens enviados/.test(txt) && /Lixeira/.test(txt) && /CERTIFICADO 2027-1/.test(txt) && /Convênios/.test(txt) && !/SISGEP\//.test(txt), "Enviados, Lixeira, as pastas dela; sem as etiquetas do robô", txt.slice(0, 200));
  b.ok(!/Cards: criar/.test(txt), "sem os cards da financeiro@ (são de lá)");
  b.ok(doc.getElementById("cxsBtnNovo").style.display !== "none", "tem o ✏ Novo e-mail (\"tem que ter para ambos\")");
  t.clicar("#cxsBtnNovo"); await t.assentar(100);
  b.ok(/secretaria@sindeducacao\.com/.test(t.texto("#cxsNSub")), "a janela diz que sai pela secretaria@", t.texto("#cxsNSub"));
  await t.assentar(100);
  const txtN = t.doc.getElementById("cxsNTexto").value;
  b.ok(/Atenciosamente,\n\nMarcelha Aline\nAdministrativo \/ Secretaria\n.+\nsecretaria@sindeducacao\.com/.test(txtN), "o texto já abre com a assinatura no formato da KingHost", txtN.slice(0, 160));
  doc.getElementById("cxsNovo").classList.remove("aberto");
  t.clicar("[data-cxs='abrirPasta'][data-arg='TRASH']"); await t.assentar(200);
  const lista = t.texto("#cxsLista");
  b.ok(/Resposta enviada pela Marcelha/.test(lista), "clicou na Lixeira: aparece o que foi para lá", lista.slice(0, 160));
  b.ok(t.chamadas.some(c => c.fn === "caixaSecretariaPasta" && c.args[0] === "TRASH"), "a tela pediu a pasta da secretaria@ (não a da financeiro@)");
  const abrirS = doc.querySelector("[data-cxs='abrir'][data-arg^='S:']");
  if (abrirS) {
    t.clicar("[data-cxs='abrir'][data-arg='" + abrirS.getAttribute("data-arg") + "']"); await t.assentar(300);
    b.ok(/Atenciosamente,\n\nMarcelha Aline/.test(doc.getElementById("cxsMResposta").value), "Responder: o texto já abre com a assinatura", doc.getElementById("cxsMResposta").value.slice(-120));
    t.clicar("[data-cxs='encaminharAbrir']"); await t.assentar(100);
    b.ok(/Atenciosamente,\n\nMarcelha Aline\nAdministrativo \/ Secretaria/.test(doc.getElementById("cxsMEncNota").value), "Encaminhar: a nota já abre com a assinatura", doc.getElementById("cxsMEncNota").value);
  } else b.ok(false, "achou um e-mail S: na lista para abrir", lista.slice(0, 200));
  b.naoTestavel("o App da Web publicado de verdade", "em HML: publicar o leitor como App da Web pela conta da Secretaria e rodar caixaApiConfigurar");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
