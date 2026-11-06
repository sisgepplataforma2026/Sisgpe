/**
 * ETAPA B DA FINANCEIRO@ (03/11/2026): ✏ NOVO E-MAIL / RASCUNHOS e CARDS
 * QUE O ROBÔ PROPÕE. Mockup aprovado: docs/mock-caixa-pastas-financeiro.png.
 *
 * Prova (backend real, tela real em jsdom, Gmail FALSO, IA FALSA, dados
 * FICTÍCIOS):
 *   - novo e-mail: valida, sai pela financeiro@ com assinatura e anexo, só
 *     com o clique (a tela pede confirmação); em HML só para a equipe;
 *   - rascunho: guarda no Gmail, aparece em Rascunhos, abre, envia;
 *   - card: o robô propõe (uma vez por dia), a pessoa cria — os e-mails vão
 *     para o card e o robô passa a usar; "Não" não volta; renomear/apagar
 *     só vazio; a Secretaria não vê nem mexe.
 *
 * NÃO PROVA: o Gmail de verdade (createDraft/update/send), a qualidade da
 * proposta da IA, a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();

/* ── Gmail falso ── */
let seq = 0;
const enviados = [], rascunhos = [];
function msg(de, para, assunto, corpo) {
  const id = "NM" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => para, getCc: () => "", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - seq * 1e5), getPlainBody: () => corpo, getAttachments: () => [], isStarred: () => false };
}
const T = [];
for (let k = 1; k <= 5; k++) T.push({ id: "r" + k, msgs: [msg("Escola " + k + " <rh@e" + k + ".exemplo.com>", "financeiro@sindeducacao.com",
  "Relação nominal de funcionários — Cláusula 40ª", "Segue a relação nominal.")] });
T.push({ id: "o1", msgs: [msg("Loja <c@loja.exemplo.com>", "financeiro@sindeducacao.com", "Boleto", "boleto")] });
function rascunho(para, assunto, corpo, op) {
  const id = "DR" + (rascunhos.length + 1);
  const d = { id, para, assunto, corpo, op, enviado: false };
  d.obj = { getId: () => id,
    getMessage: () => Object.assign(msg("financeiro@sindeducacao.com", d.para, d.assunto, d.corpo), { getAttachments: () => (d.op && d.op.attachments) || [] }),
    update: (p, a, c, o) => { d.para = p; d.assunto = a; d.corpo = c; d.op = o; return d.obj; },
    send: () => { d.enviado = true; enviados.push({ via: "rascunho", para: d.para, assunto: d.assunto, op: d.op }); } };
  rascunhos.push(d);
  return d.obj;
}
const fake = {
  search: (q, i, m) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).slice(i || 0, (i || 0) + (m || 100))
    .map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: () => null,
  getUserLabels: () => [], getUserLabelByName: () => null,
  sendEmail: (para, assunto, corpo, op) => enviados.push({ via: "novo", para, assunto, corpo, op }),
  createDraft: (p, a, c, o) => rascunho(p, a, c, o),
  getDrafts: () => rascunhos.filter(d => !d.enviado).map(d => d.obj),
  getDraft: id => { const d = rascunhos.find(x => x.id === id && !x.enviado); return d ? d.obj : null; }
};
g.cxsGmailFinanceiro_ = () => fake;
const pedidosIA = [];
let proposta = { propostas: [{ rotulo: "Relação nominal", icone: "📋", descricao: "relação nominal de funcionários mandada pelas escolas",
  ids: ["F:r1", "F:r2", "F:r3", "F:r4", "F:r5"] }] };
g.vpeChamarIA_ = function (prompt) {
  pedidosIA.push(prompt);
  if (/ASSUNTO QUE SE REPETE/.test(prompt)) return proposta;
  const linhas = (prompt.split("E-MAILS:\n")[1] || "").split("\n").filter(Boolean);
  return { resultados: linhas.map((l, i) => ({ i, tipo: /Relação nominal/.test(l) ? "FINANCEIRO" : "CONTAS", pedido: "x" })) };
};
const limpa = () => g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");

b.fluxo("NOVO E-MAIL · o servidor");
b.passo("1. Validar antes de sair");
b.ok(!g.caixaFinanceiroNovoEmail({ para: "", assunto: "x", texto: "texto qualquer" }, TOKEN).ok, "sem destinatário: não sai");
b.ok(/inválido/.test(g.caixaFinanceiroNovoEmail({ para: "nao-e-email", assunto: "x", texto: "texto qualquer" }, TOKEN).mensagem), "e-mail inválido: avisa");
b.ok(!g.caixaFinanceiroNovoEmail({ para: "a@b.exemplo.com", assunto: "", texto: "texto qualquer" }, TOKEN).ok, "sem assunto: não sai");
b.igual(enviados.length, 0, "nada saiu");
b.passo("2. Enviar com anexo e assinatura");
const pdf = Buffer.from("%PDF-1.4 x").toString("base64");
const ne = g.caixaFinanceiroNovoEmail({ para: "rh@beta.exemplo.com, rh2@beta.exemplo.com", cc: "contador@exemplo.com", assunto: "Cobrança de outubro",
  texto: "Prezados, segue a cobrança.", anexos: [{ nome: "cobranca.pdf", tipo: "application/pdf", base64: pdf }] }, TOKEN);
b.ok(ne.ok && enviados.length === 1, "enviou", ne.mensagem);
const e1 = enviados[0];
b.igual(e1.para, "rh@beta.exemplo.com, rh2@beta.exemplo.com", "para os dois");
b.ok(e1.op.cc === "contador@exemplo.com" && e1.op.attachments.length === 1, "com cópia e o anexo");
b.ok(/Wanderson N Castelo/.test(e1.op.htmlBody), "com a assinatura de quem está logado");
b.passo("3. Em homologação, só para a equipe");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao"); g.getAmbienteAtual._cache = undefined;
const nh = g.caixaFinanceiroNovoEmail({ para: "fora@exemplo.com", assunto: "Teste", texto: "texto de teste" }, TOKEN);
b.ok(!nh.ok && /\[HML\]/.test(nh.mensagem) && enviados.length === 1, "para fora da equipe é bloqueado", nh.mensagem);
const ncc = g.caixaFinanceiroNovoEmail({ para: "wanderson@sindeducacao.com", cc: "fora@exemplo.com", assunto: "Teste", texto: "texto de teste" }, TOKEN);
b.ok(!ncc.ok && enviados.length === 1, "nem escondido no Cc");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao"); g.getAmbienteAtual._cache = undefined;
b.passo("4. Rascunho: guarda, aparece, abre e envia");
const gr = g.caixaFinanceiroNovoEmail({ para: "rh@gama.exemplo.com", assunto: "Rascunho de cobrança", texto: "Começo do texto", soGuardar: true }, TOKEN);
b.ok(gr.ok && rascunhos.length === 1 && enviados.length === 1, "guardou no Gmail, sem enviar", gr.mensagem);
const pr = g.caixaFinanceiroPasta("DRAFTS", 0, TOKEN);
b.ok(pr.ok && pr.itens.length === 1 && pr.itens[0].fonte === "RASCUNHO" && /Para: rh@gama/.test(pr.itens[0].nome), "aparece em Rascunhos", JSON.stringify(pr.itens[0]));
const ab = g.caixaFinanceiroRascunho(pr.itens[0].id, TOKEN);
b.ok(ab.ok && ab.rascunho.assunto === "Rascunho de cobrança" && ab.rascunho.texto === "Começo do texto", "abre com o que foi escrito");
const er = g.caixaFinanceiroNovoEmail({ para: "rh@gama.exemplo.com", assunto: "Rascunho de cobrança", texto: "Texto final da cobrança.", rascunhoId: pr.itens[0].id }, TOKEN);
b.ok(er.ok && enviados.length === 2 && enviados[1].via === "rascunho" && /Texto final/.test(enviados[1].op.htmlBody), "o rascunho é enviado com o texto final", er.mensagem);
b.igual(g.caixaFinanceiroPasta("DRAFTS", 0, TOKEN).itens.length, 0, "e sai de Rascunhos");
b.ok(!g.caixaFinanceiroNovoEmail({ para: "a@b.exemplo.com", assunto: "x", texto: "texto qualquer" }, T_SEC).ok, "a Secretaria não escreve pela financeiro@");

b.fluxo("CARDS · o robô propõe, a pessoa cria");
b.passo("5. A proposta");
limpa();
g.caixaFinanceiroItens(TOKEN);
const nIA = pedidosIA.length;
const pp = g.caixaPropostasCards(TOKEN);
b.ok(pp.ok && pp.propostas.length === 1 && pp.propostas[0].rotulo === "Relação nominal" && pp.propostas[0].ids.length === 5, "propõe o card", JSON.stringify(pp));
b.ok(pp.propostas[0].exemplos.length === 3, "com exemplos dos e-mails");
g.caixaPropostasCards(TOKEN);
b.igual(pedidosIA.length, nIA + 1, "uma pergunta à IA por dia (a segunda abertura não pergunta)");
b.ok(!Object.keys(g.CXS_TIPOS).some(k => /RELACAO/.test(k)), "nada criado sozinho");
b.ok(!g.caixaPropostasCards(T_SEC).ok, "a Secretaria não recebe proposta da financeiro@");
b.passo("6. Criar: os e-mails vão para o card e o robô passa a usar");
const cc = g.caixaCriarCard(pp.propostas[0], TOKEN);
b.ok(cc.ok && /5 e-mail/.test(cc.mensagem), "criou com os 5", cc.mensagem);
limpa();
const itens = g.caixaFinanceiroItens(TOKEN).itens;
b.ok(itens.filter(i => i.tipo === cc.chave).length === 5, "os 5 estão no card novo");
const painel = g.caixaSecretariaPainel(TOKEN);
b.ok(painel.tipos.some(t => t.chave === cc.chave && t.caixa === "FINANCEIRO"), "o card entra na lista de cards (da financeiro@)");
g.CXC_CARREGADAS = false;
T.push({ id: "r6", msgs: [msg("Escola 6 <rh@e6.exemplo.com>", "financeiro@sindeducacao.com", "Relação nominal nova", "relação")] });
limpa(); pedidosIA.length = 0;
g.caixaFinanceiroItens(TOKEN);
b.ok(pedidosIA.some(p => new RegExp(cc.chave + " = relação nominal de funcionários").test(p)), "a IA passa a receber a categoria nova");
b.ok(g.caixaPropostasCards(TOKEN).propostas.length === 0, "não propõe de novo o que já existe");
b.passo("7. \"Não\" não volta");
g.PropertiesService.getScriptProperties().deleteProperty("CXC_PROPOSTA_FIN");
proposta = { propostas: [{ rotulo: "Boletos de loja", icone: "🧾", descricao: "x", ids: ["F:o1", "F:r6", "F:r1", "F:r2"] }] };
const p2 = g.caixaPropostasCards(TOKEN);
b.ok(p2.propostas.length === 1, "uma proposta nova");
b.ok(g.caixaRecusarCard(p2.propostas[0], TOKEN).ok, "recusou");
g.PropertiesService.getScriptProperties().deleteProperty("CXC_PROPOSTA_FIN");
b.igual(g.caixaPropostasCards(TOKEN).propostas.length, 0, "e não volta, nem em outro dia");
b.passo("8. Renomear e apagar só com o card vazio");
const ad = g.caixaCardsCriados(TOKEN);
const meu = (ad.cards || []).find(c => c.chave === cc.chave);
b.ok(ad.ok && meu && meu.emails === 5 && !meu.sistema && ad.cards.some(c => c.chave === "CONTAS" && c.sistema), "a lista de todos os cards, com quantos têm", JSON.stringify(meu));
const ap = g.caixaAlterarCard(cc.chave, "APAGAR", "", TOKEN);
b.ok(!ap.ok && /5 e-mail/.test(ap.mensagem), "com e-mail dentro, não apaga", ap.mensagem);
["F:r1", "F:r2", "F:r3", "F:r4", "F:r5"].forEach(id => g.caixaSecretariaReclassificar(id, "FINANCEIRO", TOKEN));
limpa();
b.ok(g.caixaAlterarCard(cc.chave, "RENOMEAR", "Relações nominais", TOKEN).ok, "vazio: renomeia");
const pc = g.caixaAlterarCard(cc.chave, "APAGAR", "", TOKEN);
b.ok(!pc.ok && pc.precisaConfirmar && /Excluir o card/.test(pc.mensagem), "vazio: pede confirmação antes", pc.mensagem);
b.ok(g.caixaSecretariaPainel(TOKEN).tipos.some(t => t.chave === cc.chave), "sem confirmar, nada muda");
b.ok(g.caixaAlterarCard(cc.chave, "APAGAR_CONFIRMADO", "", TOKEN).ok, "confirmou: exclui");
b.ok(!g.caixaSecretariaPainel(TOKEN).tipos.some(t => t.chave === cc.chave), "e some da lista");
b.passo("8b. Cards do sistema: renomear e excluir (só vazio, com confirmação) — só na financeiro@");
b.ok(g.caixaAlterarCard("CONTAS", "RENOMEAR", "Contas a pagar", TOKEN).ok, "renomeia um card do sistema");
limpa();
const itC = g.caixaFinanceiroItens(TOKEN).itens.find(i => i.tipo === "CONTAS");
b.ok(itC && itC.tipoRotulo === "Contas a pagar", "o e-mail da financeiro@ mostra o nome novo", itC && itC.tipoRotulo);
b.ok(g.caixaSecretariaPainel(TOKEN).tipos.find(t => t.chave === "CONTAS").rotuloFin === "Contas a pagar", "o card também");
const exC = g.caixaAlterarCard("CONTAS", "APAGAR", "", TOKEN);
b.ok(!exC.ok && /só dá para excluir com ele vazio/i.test(exC.mensagem), "com e-mail dentro: não exclui", exC.mensagem);
b.ok(!g.caixaAlterarCard("OUTRO", "APAGAR_CONFIRMADO", "", TOKEN).ok, "Outros nunca se exclui (é onde cai o resto)");
const pj = g.caixaAlterarCard("JURIDICO", "APAGAR", "", TOKEN);
b.ok(pj.precisaConfirmar && /trazer de volta/.test(pj.mensagem), "Jurídico vazio: pede confirmação", pj.mensagem);
b.ok(g.caixaAlterarCard("JURIDICO", "APAGAR_CONFIRMADO", "", TOKEN).ok, "confirmou: excluído na financeiro@");
b.ok(g.caixaSecretariaPainel(TOKEN).tipos.find(t => t.chave === "JURIDICO").ocultoFin, "marcado como excluído");
b.ok(!g.caixaSecretariaReclassificar("F:o1", "JURIDICO", TOKEN).ok, "não dá para mandar e-mail da financeiro@ para ele");
g.PropertiesService.getScriptProperties().deleteProperty("CXC_PROPOSTA_FIN");
T.push({ id: "j9", msgs: [msg("Adv <adv@escritorio.exemplo.com>", "Notificação extrajudicial", "processo")] });
limpa(); pedidosIA.length = 0;
g.caixaFinanceiroItens(TOKEN);
b.ok(pedidosIA.length && !/JURIDICO = /.test(pedidosIA[0]), "o robô não usa mais a categoria na financeiro@");
const ca = (g.caixaCardsCriados(TOKEN).cards || []).find(c => c.chave === "JURIDICO");
b.ok(ca && ca.excluido, "aparece em ⚙ Cards como excluído");
b.ok(g.caixaAlterarCard("JURIDICO", "RESTAURAR", "", TOKEN).ok && !g.caixaSecretariaPainel(TOKEN).tipos.find(t => t.chave === "JURIDICO").ocultoFin, "e volta");
b.passo("8c. Criar card à mão");
const cm = g.caixaCriarCard({ rotulo: "Pedidos de boleto", icone: "🧾", descricao: "escola pedindo boleto de mensalidade ou taxa", ids: [] }, TOKEN);
b.ok(cm.ok && g.caixaSecretariaPainel(TOKEN).tipos.some(t => t.chave === cm.chave), "criado, entra na lista", cm.mensagem);
const cod = g.caixaCriarCard({ rotulo: "NOTIFICACAO_DE_RESCISAO", icone: "📋", ids: [] }, TOKEN);
b.ok(cod.ok && g.caixaSecretariaPainel(TOKEN).tipos.find(t => t.chave === cod.chave).rotulo === "Notificação de rescisão",
  "nome com cara de código (como a IA devolveu) vira nome legível", cod.mensagem);

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
/* Para a tela: uma proposta nova à espera. */
g.PropertiesService.getScriptProperties().deleteProperty("CXC_PROPOSTA_FIN");
proposta = { propostas: [{ rotulo: "Relação de funcionários", icone: "📋", descricao: "relação nominal", ids: ["F:r1", "F:r2", "F:r3", "F:r4", "F:r5", "F:r6"] }] };
limpa();
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("ETAPA B · a tela");
  win.cxsIniciar(); await t.assentar(300);
  b.passo("9. A faixa do robô e o Criar card");
  b.ok(el("cxsProposta").style.display !== "none" && /Relação de funcionários/.test(t.texto("#cxsProposta")), "a faixa aparece", t.texto("#cxsProposta"));
  t.clicar("[data-cxs='propostaCriar']"); await t.assentar(300);
  b.ok(Array.from(doc.querySelectorAll("#cxsTipos .cxs-tipo")).some(c => /Relação de funcionários/.test(c.textContent)), "o card novo aparece");
  b.passo("10. ✏ Novo e-mail: confirma antes de enviar");
  b.ok(el("cxsBtnNovo").style.display !== "none", "o botão aparece para o Wanderson");
  t.clicar("[data-cxs='novoAbrir']"); await t.assentar(30);
  b.ok(el("cxsNovo").classList.contains("aberto"), "abre a tela de escrever");
  el("cxsNPara").value = "rh@delta.exemplo.com"; el("cxsNAssunto").value = "Aviso"; el("cxsNTexto").value = "Prezados, um aviso.";
  const n0 = enviados.length;
  t.clicar("[data-cxs='novoEnviar']"); await t.assentar(30);
  b.ok(/rh@delta\.exemplo\.com/.test(t.texto("#cxsNConfirma")) && enviados.length === n0, "1º clique: mostra para quem vai, não envia", t.texto("#cxsNConfirma"));
  t.clicar("[data-cxs='novoEnviar']"); await t.assentar(150);
  b.ok(enviados.length === n0 + 1 && enviados[enviados.length - 1].para === "rh@delta.exemplo.com", "2º clique: enviou");
  b.ok(!el("cxsNovo").classList.contains("aberto"), "e a tela fechou");
  b.passo("11. ⚙ Cards: criar e excluir com mensagem antes");
  t.clicar("[data-cxs='cardsAdm']"); await t.assentar(100);
  el("cxsCardNovoNome").value = "Declarações"; el("cxsCardNovoDesc").value = "pedido de declaração";
  t.clicar("[data-cxs='cardCriar']"); await t.assentar(250);
  b.ok(/Declarações/.test(t.texto("#cxsCardsAdm")), "o card criado aparece na lista", t.texto("#cxsCardsAdm").slice(0, 200));
  const chave = (g.caixaCardsCriados(TOKEN).cards.find(c => c.rotulo === "Declarações") || {}).chave;
  t.clicar("[data-cxs='cardApagar'][data-arg='" + chave + "']"); await t.assentar(100);
  b.ok(/Excluir o card "Declarações"\? Ele está vazio/.test(t.texto("[data-card-conf='" + chave + "']")), "a mensagem antes de excluir", t.texto("[data-card-conf='" + chave + "']"));
  b.ok(g.caixaCardsCriados(TOKEN).cards.some(c => c.chave === chave), "ainda não excluiu");
  t.clicar("[data-cxs='cardExcluirSim'][data-arg='" + chave + "']"); await t.assentar(250);
  b.ok(!g.caixaCardsCriados(TOKEN).cards.some(c => c.chave === chave), "confirmou: excluído");
  const comEmail = g.caixaCardsCriados(TOKEN).cards.find(c => c.emails > 0 && !c.fixo);
  const cheio = comEmail && doc.querySelector("[data-cxs='cardApagar'][data-arg='" + comEmail.chave + "']");
  b.ok(comEmail && cheio && cheio.disabled, "card com e-mail: o Excluir fica desligado", comEmail && comEmail.chave);
  b.naoTestavel("o Gmail de verdade e a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
