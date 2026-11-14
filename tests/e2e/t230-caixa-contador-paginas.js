/**
 * CONTADOR DE PÁGINAS DA CAIXA (03/11/2026: "contador de páginas, exemplo
 * 1-5"), como no Gmail: "1–50 de 120", ‹ ›.
 *
 * Prova (tela real em jsdom, Gmail FALSO, dados FICTÍCIOS): 50 por página;
 * › e ‹ andam; nas pontas o botão desliga; mudar de card volta à página 1;
 * "Marcar todos" marca só a página (como no Gmail); numa pasta com mais
 * e-mails no Gmail, o › busca os próximos.
 *
 * NÃO PROVA: a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.vpeChamarIA_ = p => { const l = (p.split("E-MAILS:\n")[1] || "").split("\n").filter(Boolean); return { resultados: l.map((x, i) => ({ i, tipo: /Boleto/.test(x) ? "CONTAS" : "FINANCEIRO" })) }; };

let seq = 0;
function msg(de, assunto, minAtras) {
  const id = "PG" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - minAtras * 6e4), getPlainBody: () => "texto", getAttachments: () => [] };
}
const T = [];
for (let k = 1; k <= 120; k++) T.push({ id: "e" + k, msgs: [msg("Escola " + k + " <rh@e" + k + ".exemplo.com>", (k <= 10 ? "Boleto " : "Relação ") + k, k)] });
const LIX = [];
for (let k = 1; k <= 70; k++) LIX.push({ id: "l" + k, msgs: [msg("Velho " + k + " <v@v.exemplo.com>", "Antigo " + k, 1000 + k)] });
g.CXS_FIN_MAX = 200;
g.cxsGmailFinanceiro_ = () => ({
  search: (q, i, m) => {
    const base = q === "in:trash" ? LIX : (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []);
    return base.slice(i || 0, (i || 0) + (m || 500)).map(t => ({ getId: () => t.id, getMessages: () => t.msgs }));
  },
  getThreadById: id => { const t = T.concat(LIX).find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: () => null, getUserLabels: () => [], getUserLabelByName: () => null
});

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
const linhas = () => doc.querySelectorAll("#cxsLista .cxs-item").length;
const pager = () => t.texto("#cxsPagerTopo");
(async function () {
  b.fluxo("CAIXA · contador de páginas");
  win.cxsIniciar(); await t.assentar(400);
  b.passo("1. 50 por página, com o contador");
  b.igual(linhas(), 50, "50 e-mails na tela");
  b.ok(/1–50 de 120/.test(pager()), "1–50 de 120", pager());
  b.ok(doc.querySelector("#cxsPagerTopo [data-cxs='pagAnt']").disabled, "‹ desligado na 1ª página");
  b.passo("2. › e ‹ andam");
  t.clicar("#cxsPagerTopo [data-cxs='pagProx']"); await t.assentar(30);
  b.ok(/51–100 de 120/.test(pager()), "51–100", pager());
  t.clicar("#cxsPagerTopo [data-cxs='pagProx']"); await t.assentar(30);
  b.ok(/101–120 de 120/.test(pager()) && linhas() === 20, "101–120 (20 na tela)", pager());
  b.ok(doc.querySelector("#cxsPagerTopo [data-cxs='pagProx']").disabled, "› desligado na última");
  b.ok(doc.querySelector("#cxsPagerBaixo [data-cxs='pagAnt']"), "o contador também embaixo");
  t.clicar("#cxsPagerTopo [data-cxs='pagAnt']"); await t.assentar(30);
  b.ok(/51–100/.test(pager()), "‹ volta", pager());
  b.passo("3. Marcar todos marca só a página");
  const todos = doc.getElementById("cxsSelTodos");
  todos.checked = true; todos.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(20);
  b.ok(/50 marcado/.test(t.texto("#cxsLote")), "50 marcados (a página)", t.texto("#cxsLote").slice(0, 60));
  b.passo("4. Mudar de card volta para a página 1");
  t.clicar("#cxsTipos [data-cxs='filtrarTipo'][data-arg='CONTAS']"); await t.assentar(30);
  b.ok(/1–10 de 10/.test(pager()) && linhas() === 10, "Contas: 1–10 de 10", pager());
  b.passo("5. Pasta com mais no Gmail: o › busca os próximos");
  t.clicar("[data-cxs='abrirPasta'][data-arg='TRASH']"); await t.assentar(200);
  b.ok(/1–50 de 50\+/.test(pager()), "Lixeira: 1–50 de 50+ (tem mais no Gmail)", pager());
  t.clicar("#cxsPagerTopo [data-cxs='pagProx']"); await t.assentar(250);
  b.ok(/51–70 de 70/.test(pager()) && linhas() === 20, "buscou e foi para 51–70", pager());
  b.naoTestavel("a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
