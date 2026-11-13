/**
 * CAIXA · RESPONDER A TODOS, ARRASTAR PARA A PASTA, NÃO LIDOS (13/11/2026).
 * O usuário: "tem que ter responder a todos, mover para a pasta arrastando o
 * e-mail e os não lidos". Backend real, tela real (jsdom), Gmail e IA FALSOS,
 * dados FICTÍCIOS. NÃO PROVA: o arrastar com o mouse de verdade no navegador
 * (aqui os eventos de arrastar são disparados à mão) nem o Gmail real mover.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
let seq = 0; const movidos = [];
function msg(de, assunto, corpo, cc) {
  const id = "N" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com, diretora@escola.exemplo.com", getCc: () => cc || "",
    getSubject: () => assunto, getDate: () => new Date(Date.now() - seq * 6e5), getPlainBody: () => corpo, getAttachments: () => [], reply: () => {} };
}
const T = [{ id: "c1", msgs: [msg("Ana <ana@escola.exemplo.com>", "Relação nominal", "Segue a relação.", "Contador <contador@escritorio.exemplo.com>, secretaria@sindeducacao.com")] },
           { id: "c2", msgs: [msg("Beto <beto@escola2.exemplo.com>", "Boleto", "Preciso do boleto.")] }];
const rotulo = { getName: () => "ABRIR", getUnreadCount: () => 0, addToThread: (th) => movidos.push(th.getId()), addToThreads: (ths) => ths.forEach(t => movidos.push(t.getId())) };
const thr = t => ({ getId: () => t.id, getMessages: () => t.msgs, addLabel: (l) => { movidos.push(t.id); }, moveToArchive: () => {}, getLabels: () => [] });
g.cxsGmailFinanceiro_ = () => ({
  search: (q) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).map(thr),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? thr(t) : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; },
  getUserLabels: () => [rotulo], getUserLabelByName: n => (n === "ABRIR" ? rotulo : null)
});
g.vpeChamarIA_ = (p) => /E-MAILS:\n/.test(p) ? { resultados: p.split("E-MAILS:\n")[1].split("\n").filter(Boolean).map((l, i) => ({ i, tipo: "FINANCEIRO" })) } : { resposta: "Olá!", anexar: "" };

b.fluxo("CAIXA · não lidos e responder a todos (servidor)");
b.passo("1. E-mail que ninguém abriu chega como não lido; abrir marca como lido");
let pn = g.caixaSecretariaPainel(TOKEN);
if (!(pn.itens || []).length) { g.caixaFinanceiroItens(TOKEN); pn = g.caixaSecretariaPainel(TOKEN); }
const itens0 = (g.caixaFinanceiroItens(TOKEN).itens || pn.itens || []);
const i1 = itens0.find(x => x.id === "F:c1");
b.ok(i1 && i1.naoLido === true, "não lido ao chegar", JSON.stringify(i1 && { id: i1.id, naoLido: i1.naoLido }));
const d1 = g.caixaSecretariaDetalhe("F:c1", TOKEN);
b.ok(d1.ok && d1.item.naoLido === false, "abriu: lido");
g.CXS_LIDOS_MEMO = null;
const i1b = (g.caixaFinanceiroItens(TOKEN).itens || []).find(x => x.id === "F:c1");
const i2b = (g.caixaFinanceiroItens(TOKEN).itens || []).find(x => x.id === "F:c2");
b.ok(i1b && i1b.naoLido === false && i2b && i2b.naoLido === true, "fica lido depois; o outro continua não lido");
b.passo("2. Responder a todos: quem mais estava na conversa, sem os nossos e sem o remetente");
b.igual((d1.todos || []).join(","), "diretora@escola.exemplo.com,contador@escritorio.exemplo.com", "Para + Cc, sem financeiro@/secretaria@ e sem a Ana");
b.igual((g.cxsTodosDaConversa_(g.cxsLinhaPonte_("F:c2")) || []).join(","), "diretora@escola.exemplo.com", "no outro, só quem estava no Para");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
g.CXS_LIDOS_MEMO = null;
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("CAIXA · a tela");
  Object.defineProperty(win, "innerWidth", { value: 1400, configurable: true });
  win.cxsIniciar(); await t.assentar(300);
  b.passo("3. Aba Não lidos mostra só o que ninguém abriu, com a contagem");
  b.ok(/Não lidos \(\d+\)/.test(el("cxsAbaNL").textContent), "aba com a contagem", el("cxsAbaNL").textContent);
  const antes = doc.querySelectorAll("#cxsLista .cxs-item").length;
  t.clicar("#cxsAbaNL"); await t.assentar(40);
  const nl = doc.querySelectorAll("#cxsLista .cxs-item");
  b.ok(nl.length >= 1 && nl.length <= antes && [...nl].every(x => x.classList.contains("nl")), "só não lidos na lista (" + nl.length + " de " + antes + ")");
  t.clicar("[data-cxs='abaEstado'][data-arg='']"); await t.assentar(40);
  b.passo("4. Responder a todos põe as pessoas em Cc");
  const linha = [...doc.querySelectorAll("#cxsLista .cxs-item")].find(x => /Relação nominal/.test(x.textContent));
  linha.querySelector(".cxs-item-nome").dispatchEvent(new win.MouseEvent("click", { bubbles: true })); await t.assentar(300);
  t.clicar("[data-cxs='responderTodos']");
  b.ok(/diretora@escola\.exemplo\.com/.test(el("cxsMCc").value) && /contador@escritorio\.exemplo\.com/.test(el("cxsMCc").value), "Cc preenchido", el("cxsMCc").value);
  b.passo("5. Arrastar o e-mail para a pasta chama o mesmo 'Mover para'");
  const pasta = [...doc.querySelectorAll("#cxsPastas [data-cxs='abrirPasta']")].find(x => /^LABEL:/.test(x.getAttribute("data-arg")));
  b.ok(!!pasta, "a pasta ABRIR está na lateral", pasta && pasta.getAttribute("data-arg"));
  const item = [...doc.querySelectorAll("#cxsLista [data-arrastar]")].find(x => /Boleto/.test(x.textContent));
  const ev = (tipo, alvo) => { const e = new win.Event(tipo, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {}, effectAllowed: "" }; alvo.dispatchEvent(e); return e; };
  ev("dragstart", item); const over = ev("dragover", pasta);
  b.ok(over.defaultPrevented && pasta.classList.contains("alvo"), "a pasta acende como alvo");
  const n0 = t.chamadas.length;
  ev("drop", pasta); await t.assentar(300);
  const ch = t.chamadas.slice(n0).find(c => c.fn === "caixaFinanceiroAcao");
  b.ok(ch && JSON.stringify(ch.args[0]) === '["F:c2"]' && ch.args[1] === "MOVER" && ch.args[2].para === pasta.getAttribute("data-arg"), "pediu ao servidor: mover F:c2 para a pasta",
    ch ? JSON.stringify(ch.args.slice(0, 3)) : "sem chamada");
  b.resumo();
})();
