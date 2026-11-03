/**
 * AS PASTAS DO GMAIL DA FINANCEIRO@ + CARDS DINÂMICOS (03/11/2026).
 * Mockup aprovado: docs/mock-caixa-pastas-financeiro.png, com o card
 * "Todos" pedido junto. Só a financeiro@ — a secretaria@ não muda.
 *
 * Prova (backend real, tela real em jsdom, Gmail FALSO, dados FICTÍCIOS):
 *   - as pastas e os marcadores aparecem, com contagem;
 *   - cada pasta lista os e-mails dela; Enviados mostra PARA QUEM;
 *   - ações só por clique: estrela, mover para marcador, não é spam,
 *     restaurar, resolver; lixeira só com a confirmação (servidor recusa
 *     sem ela) e vai para a lixeira do Gmail (não apaga de vez);
 *   - a Secretaria não vê nem mexe nas pastas da financeiro@;
 *   - card Todos; card vazio some; ao arrastar, todos voltam.
 *
 * NÃO PROVA: o Gmail de verdade (as buscas in:sent/in:trash, o
 * moveToInbox tirando da lixeira, cota e tempo), a aparência.
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
g.vpeChamarIA_ = () => ({ resultados: [] });

/* ── Gmail falso, com pastas ── */
const feito = [];
let seq = 0;
function msg(de, para, assunto, corpo, quando) {
  const id = "PM" + (++seq);
  let estrela = false;
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => para, getSubject: () => assunto,
    getDate: () => quando, getPlainBody: () => corpo, getAttachments: () => [],
    isStarred: () => estrela, star: () => { estrela = true; feito.push("star " + id); }, unstar: () => { estrela = false; feito.push("unstar " + id); } };
}
const agora = Date.now();
const T = {};
function th(id, pasta, m, labels) {
  T[id] = { id, pasta, msgs: [m], labels: labels || [] };
  const o = T[id];
  o.obj = { getId: () => id, getMessages: () => o.msgs,
    moveToTrash: () => { o.pasta = "TRASH"; feito.push("trash " + id); },
    moveToInbox: () => { o.pasta = "INBOX"; feito.push("inbox " + id); },
    moveToArchive: () => { o.pasta = "ARQUIVO"; feito.push("archive " + id); },
    addLabel: l => { o.labels.push(l.getName()); feito.push("label " + id + " " + l.getName()); } };
}
th("i1", "INBOX", msg("Escola Alfa <rh@alfa.exemplo.com>", "financeiro@sindeducacao.com", "Relação nominal outubro", "Segue.", new Date(agora - 1e6)));
th("i2", "INBOX", msg("Loja <contato@loja.exemplo.com>", "financeiro@sindeducacao.com", "Boleto de outubro", "Boleto.", new Date(agora - 2e6)));
th("s1", "SENT", msg("Wanderson <financeiro@sindeducacao.com>", "Escola Beta <rh@beta.exemplo.com>", "Cobrança de mensalidade", "Prezados.", new Date(agora - 3e6)));
th("x1", "SPAM", msg("Ganhe <promo@spam.exemplo.com>", "financeiro@sindeducacao.com", "Você ganhou", "clique", new Date(agora - 4e6)));
th("l1", "TRASH", msg("Escola Gama <rh@gama.exemplo.com>", "financeiro@sindeducacao.com", "Guia antiga", "guia", new Date(agora - 5e6)));
th("a1", "ARQUIVO", msg("Contador <c@contab.exemplo.com>", "financeiro@sindeducacao.com", "Balancete", "anexo", new Date(agora - 6e6)), ["Contabilidade"]);
const LABELS = ["Contabilidade", "Escolas"].map(n => ({ getName: () => n, getUnreadCount: () => 1,
  getThreads: (i, m) => Object.values(T).filter(t => t.labels.indexOf(n) > -1 && t.pasta !== "TRASH").slice(i, i + m).map(t => t.obj) }));
const buscas = [];
const fake = {
  search: (q, i, m) => {
    buscas.push(q);
    const em = p => Object.values(T).filter(t => t.pasta === p);
    let r;
    if (/^in:inbox/.test(q)) r = em("INBOX");
    else if (q === "in:sent") r = em("SENT");
    else if (q === "in:spam") r = em("SPAM");
    else if (q === "in:trash") r = em("TRASH");
    else if (q === "in:drafts") r = [];
    else if (q === "is:starred") r = Object.values(T).filter(t => t.msgs.some(x => x.isStarred()));
    else if (q === "-in:spam -in:trash") r = Object.values(T).filter(t => t.pasta !== "SPAM" && t.pasta !== "TRASH");
    else r = [];
    if (/has:attachment/.test(q)) r = [];
    return r.slice(i || 0, (i || 0) + (m || 100)).map(t => t.obj);
  },
  getThreadById: id => (T[id] || {}).obj || null,
  getMessageById: id => { for (const t of Object.values(T)) for (const x of t.msgs) if (x.getId() === id) return x; return null; },
  getUserLabels: () => LABELS,
  getUserLabelByName: n => LABELS.find(l => l.getName() === n) || null
};
g.cxsGmailFinanceiro_ = () => fake;
const limpa = () => { g.CacheService.getScriptCache().remove("cxs_fin_lista_v1"); g.CacheService.getScriptCache().remove("cxp_pastas_v1"); };

b.fluxo("PASTAS DA FINANCEIRO@ · o servidor");
b.passo("1. As pastas e os marcadores");
const ps = g.caixaFinanceiroPastas(TOKEN);
b.ok(ps.ok, "abre", ps.mensagem);
b.igual(ps.pastas.map(p => p.chave), ["INBOX", "STARRED", "SENT", "DRAFTS", "ALL", "SPAM", "TRASH"], "as pastas do Gmail, na ordem do mockup");
b.igual([ps.pastas.find(p => p.chave === "SPAM").total, ps.pastas.find(p => p.chave === "TRASH").total], [1, 1], "com quantos têm (spam, lixeira)");
b.ok(ps.pastas.filter(p => p.robo).map(p => p.chave).join() === "INBOX,SENT", "o robô lê Entrada e Enviados");
b.igual(ps.marcadores.map(m => m.rotulo), ["Contabilidade", "Escolas"], "os marcadores do Gmail");

b.passo("2. Cada pasta lista os e-mails dela");
const env = g.caixaFinanceiroPasta("SENT", 0, TOKEN);
b.ok(env.ok && env.itens.length === 1 && env.itens[0].id === "F:s1", "Itens enviados", env.mensagem);
b.ok(/^Para: Escola Beta/.test(env.itens[0].nome) && env.itens[0].de === "rh@beta.exemplo.com", "mostra PARA QUEM foi", env.itens[0].nome);
b.igual(g.caixaFinanceiroPasta("TRASH", 0, TOKEN).itens.map(i => i.id), ["F:l1"], "Lixeira");
b.igual(g.caixaFinanceiroPasta("LABEL:Contabilidade", 0, TOKEN).itens.map(i => i.id), ["F:a1"], "um marcador");
b.ok(g.caixaFinanceiroPasta("ALL", 0, TOKEN).itens.length === 4, "Todos os e-mails (sem spam e lixeira)");
b.ok(g.caixaSecretariaDetalhe("F:s1", TOKEN).ok, "e-mail de outra pasta abre como sempre");

b.passo("3. Ações, só por clique");
b.igual(feito, [], "listar não mexeu em nada no Gmail");
const sl = g.caixaFinanceiroAcao(["F:i2"], "LIXEIRA", {}, TOKEN);
b.ok(!sl.ok && /Confirme/.test(sl.mensagem) && T.i2.pasta === "INBOX", "lixeira sem confirmação: o servidor recusa", sl.mensagem);
const lx = g.caixaFinanceiroAcao(["F:i2"], "LIXEIRA", { confirmado: true }, TOKEN);
b.ok(lx.ok && T.i2.pasta === "TRASH", "com a confirmação vai para a lixeira do Gmail", lx.mensagem);
b.ok(g.caixaFinanceiroAcao(["F:i2"], "RESTAURAR", {}, TOKEN).ok && T.i2.pasta === "INBOX", "e restaura para a Entrada");
b.ok(g.caixaFinanceiroAcao(["F:x1"], "NAO_SPAM", {}, TOKEN).ok && T.x1.pasta === "INBOX", "não é spam: volta para a Entrada");
b.ok(g.caixaFinanceiroAcao(["F:i1"], "ESTRELA", {}, TOKEN).ok && T.i1.msgs[0].isStarred(), "estrela");
b.igual(g.caixaFinanceiroPasta("STARRED", 0, TOKEN).itens.map(i => i.id), ["F:i1"], "e aparece em Com estrela");
b.ok(g.caixaFinanceiroAcao(["F:i1"], "TIRAR_ESTRELA", {}, TOKEN).ok && !T.i1.msgs[0].isStarred(), "tira a estrela");
const mv = g.caixaFinanceiroAcao(["F:i1"], "MOVER", { para: "LABEL:Escolas" }, TOKEN);
b.ok(mv.ok && T.i1.labels.indexOf("Escolas") > -1 && T.i1.pasta === "ARQUIVO", "mover para o marcador (sai da Entrada, como no Gmail)", mv.mensagem);
b.ok(!g.caixaFinanceiroAcao(["F:i1"], "MOVER", { para: "LABEL:Nao existe" }, TOKEN).ok, "marcador que não existe: recusa");
b.ok(g.caixaFinanceiroAcao(["F:i1"], "MOVER", { para: "INBOX" }, TOKEN).ok && T.i1.pasta === "INBOX", "e de volta para a Entrada");
limpa();
b.ok(g.caixaFinanceiroAcao(["F:i1"], "RESOLVER", {}, TOKEN).ok, "resolver em lote");
b.igual(g.caixaFinanceiroItens(TOKEN).itens.find(i => i.id === "F:i1").estado, "RESOLVIDO", "fica resolvido no SISGEP");
b.ok(!g.caixaFinanceiroAcao(["T123"], "ESTRELA", {}, TOKEN).ok, "e-mail da secretaria@ não entra nas ações da financeiro@");
const aud = JSON.stringify(ss.getSheets().filter(s => /Auditoria/i.test(s.getName())).map(s => s.getDataRange().getValues()));
b.ok(/PASTA_LIXEIRA/.test(aud) && /Boleto de outubro/.test(aud), "a auditoria guarda o que foi para a lixeira, e o assunto");

b.passo("4. Cada um com a sua caixa");
b.ok(!g.caixaFinanceiroPastas(T_SEC).ok, "a Secretaria não vê as pastas da financeiro@");
b.ok(!g.caixaFinanceiroPasta("TRASH", 0, T_SEC).ok, "nem abre uma pasta");
const antes = T.i2.pasta;
b.ok(!g.caixaFinanceiroAcao(["F:i2"], "LIXEIRA", { confirmado: true }, T_SEC).ok && T.i2.pasta === antes, "nem manda para a lixeira");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
limpa();
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("PASTAS DA FINANCEIRO@ · a tela");
  win.cxsIniciar(); await t.assentar(250);
  b.passo("5. A lateral com as pastas e os marcadores");
  b.ok(el("cxsPastas").style.display !== "none", "a lateral aparece para o Wanderson");
  const pastasTela = Array.from(doc.querySelectorAll("#cxsPastas .cxs-pasta")).map(x => x.textContent);
  b.ok(/Caixa de entrada/.test(pastasTela[0]) && pastasTela.some(x => /Itens enviados/.test(x)) && pastasTela.some(x => /Lixeira/.test(x)) &&
    pastasTela.some(x => /Contabilidade/.test(x)), "Entrada, Enviados, Lixeira e os marcadores", pastasTela.join(" | "));
  b.passo("6. Card Todos e cards dinâmicos");
  b.ok(doc.querySelector("#cxsTipos .cxs-tipo.todos"), "tem o card Todos");
  const cards = Array.from(doc.querySelectorAll("#cxsTipos .cxs-tipo:not(.todos)"));
  b.ok(cards.every(c => Number(c.querySelector(".n").textContent) > 0), "só aparece card com e-mail", cards.map(c => c.textContent).join(" | "));
  const nAntes = cards.length;
  const it = doc.querySelector("[data-arrastar]");
  it.dispatchEvent(new win.Event("dragstart", { bubbles: true }));
  b.ok(doc.querySelectorAll("#cxsTipos .cxs-tipo:not(.todos)").length > nAntes, "ao arrastar, todos os cards aparecem (dá para soltar no vazio)");
  it.dispatchEvent(new win.Event("dragend", { bubbles: true })); await t.assentar(20);
  b.igual(doc.querySelectorAll("#cxsTipos .cxs-tipo:not(.todos)").length, nAntes, "e somem de novo ao soltar");
  b.passo("7. Abrir a Lixeira: lista, sem cards, com Restaurar");
  t.clicar("[data-cxs='abrirPasta'][data-arg='TRASH']"); await t.assentar(150);
  b.ok(el("cxsTipos").style.display === "none", "os cards são só da Entrada");
  b.ok(/Guia antiga/.test(t.texto("#cxsLista")), "o e-mail da lixeira", t.texto("#cxsLista").slice(0, 120));
  b.ok(/Restaurar/.test(t.texto("#cxsLote")) && !/Lixeira/.test(t.texto("#cxsLote")), "com Restaurar (e sem Lixeira)");
  b.passo("8. Lixeira pela tela: mostra o que vai e pede confirmação");
  t.clicar("[data-cxs='abrirPasta'][data-arg='INBOX']"); await t.assentar(150);
  const chk = doc.querySelector(".cxs-sel[data-sel='F:i2']");
  b.ok(chk, "o e-mail tem a caixinha de marcar");
  chk.checked = true; chk.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(20);
  b.ok(/1 marcado/.test(t.texto("#cxsLote")), "1 marcado");
  t.clicar("[data-cxs='lote'][data-arg='LIXEIRA']"); await t.assentar(30);
  b.ok(el("cxsLoteConf").style.display !== "none" && /Boleto de outubro/.test(t.texto("#cxsLoteConf")) && /do Gmail também/.test(t.texto("#cxsLoteConf")),
    "mostra o que vai e avisa que vai para a lixeira do Gmail", t.texto("#cxsLoteConf"));
  b.igual(T.i2.pasta, "INBOX", "nada foi até confirmar");
  t.clicar("[data-cxs='loteLixeiraSim']"); await t.assentar(200);
  b.igual(T.i2.pasta, "TRASH", "confirmou: foi para a lixeira");
  b.passo("9. Enviados pela tela");
  t.clicar("[data-cxs='abrirPasta'][data-arg='SENT']"); await t.assentar(150);
  b.ok(/Para: Escola Beta/.test(t.texto("#cxsLista")), "mostra para quem foi");
  b.naoTestavel("o Gmail de verdade e a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
