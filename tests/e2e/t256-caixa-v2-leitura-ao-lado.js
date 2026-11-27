/**
 * CAIXA v2 — E-MAIL ABERTO AO LADO DA LISTA (12/11/2026; desenho
 * docs/mock-caixa-v2.png, aprovado: "1 - sim"). Tela real (jsdom), backend
 * real, Gmail e IA FALSOS, dados FICTÍCIOS. jsdom não desenha: aparência foi
 * conferida no Chromium (foto); aqui prova o LUGAR das peças e o clique.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
let seq = 0;
function msg(de, assunto, corpo) {
  const id = "V" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - seq * 6e5), getPlainBody: () => corpo, getAttachments: () => [], reply: () => {} };
}
const T = [{ id: "a1", msgs: [msg("Ana <ana@escola.exemplo.com>", "Boleto da taxa", "Preciso do boleto.")] },
           { id: "a2", msgs: [msg("Beto <beto@escola2.exemplo.com>", "Nota fiscal", "Segue a nota.")] }];
g.cxsGmailFinanceiro_ = () => ({
  search: (q) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; },
  getUserLabels: () => [], getUserLabelByName: () => null
});
g.vpeChamarIA_ = (p) => /E-MAILS:\n/.test(p) ? { resultados: p.split("E-MAILS:\n")[1].split("\n").filter(Boolean).map((l, i) => ({ i, tipo: "FINANCEIRO" })) } : { resposta: "Olá!", anexar: "" };
if (!dom.jsdomDisponivel()) { b.fluxo("CAIXA v2"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("CAIXA v2 · tela larga");
  Object.defineProperty(win, "innerWidth", { value: 1400, configurable: true });
  win.cxsIniciar(); await t.assentar(250);
  b.passo("1. A janela do e-mail mora na coluna da direita; a busca sobe para o topo");
  b.ok(el("cxsSecao").classList.contains("cxs-doca"), "modo de três colunas ligado");
  b.ok(el("cxsModal").parentNode === el("cxsLeitura"), "e-mail aberto fica ao lado da lista");
  b.ok(el("cxsBusca").parentNode === el("cxsTopoBusca"), "busca no topo");
  b.ok(/Escolha um e-mail/.test(el("cxsLeitura").textContent), "sem e-mail aberto: aviso para escolher");
  b.passo("2. Clicar na LINHA abre o e-mail ao lado e marca a linha");
  const linha = doc.querySelectorAll("#cxsLista .cxs-item")[1];
  linha.querySelector(".cxs-item-nome").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await t.assentar(250);
  b.ok(el("cxsModal").classList.contains("aberto") && linha.classList.contains("on"), "abriu e marcou", el("cxsMTitulo").textContent);
  b.ok(/Nota fiscal|Boleto/.test(el("cxsMTitulo").textContent), "o e-mail certo");
  b.passo("3. A busca continua filtrando a lista, agora do topo");
  el("cxsBusca").value = "Nota"; el("cxsBusca").dispatchEvent(new win.Event("input", { bubbles: true })); await t.assentar(50);
  b.igual(doc.querySelectorAll("#cxsLista .cxs-item").length, 1, "filtrou");
  b.passo("4. ⚙ Filtros mostra e esconde os filtros extras");
  t.clicar("[data-cxs='filtrosAbrir']");
  b.ok(el("cxsFiltros").classList.contains("abertos"), "abriu");
  b.passo("5. Tela estreita: volta ao jeito antigo (janela por cima)");
  Object.defineProperty(win, "innerWidth", { value: 900, configurable: true });
  win.dispatchEvent(new win.Event("resize")); await t.assentar(50);
  b.ok(!el("cxsSecao").classList.contains("cxs-doca") && el("cxsModal").parentNode !== el("cxsLeitura") &&
       el("cxsBusca").parentNode === el("cxsBuscaLugar"), "tudo de volta ao lugar");
  b.resumo();
})();
