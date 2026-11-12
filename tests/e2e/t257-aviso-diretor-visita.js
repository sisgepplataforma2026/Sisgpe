/**
 * AVISAR O DIRETOR DA VISITA PELO WHATSAPP (12/11/2026, CaixaDiretorVisita.gs).
 * O usuário: "teria que ter um atalho para enviar pelo zap ao Diretor que fará
 * a visita"; "Jocimar Vila Real e Lindolpho Gadelha"; "nós incluímos e ele
 * envia". E a Caixa com o e-mail embaixo e as categorias num seletor
 * ("1 - embaixo, 2 - seletor"). Backend real, tela real (jsdom), Gmail e IA
 * FALSOS, dados FICTÍCIOS. NÃO PROVA: a mensagem chegar no WhatsApp (o envio é
 * o toque da pessoa no aplicativo).
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ROG = b.logar(g, "rogerio");
g.setupVoucherModuleFase1();
let seq = 0;
function msg(de, assunto, corpo) {
  const id = "D" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - seq * 6e5), getPlainBody: () => corpo, getAttachments: () => [], reply: () => {} };
}
const T = [
  { id: "s1", msgs: [msg("Fulana de Souza <fulana@faculdade.exemplo.br>", "Solicitação de sindicalização – Desconto educacional",
    "Boa tarde! Meu nome é Fulana de Souza, trabalho na Faculdade Exemplo, campus Vitória, no setor de Relacionamento. Gostaria de me sindicalizar. Telefone (27) 99888-7766.")] },
  { id: "b1", msgs: [msg("RH <rh@escola.exemplo.com>", "Boleto da taxa", "Preciso do boleto da taxa negocial.")] }
];
g.cxsGmailFinanceiro_ = () => ({
  search: (q) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; },
  getUserLabels: () => [], getUserLabelByName: () => null
});
g.vpeChamarIA_ = function (p) {
  if (/E-MAILS:\n/.test(p)) return { resultados: p.split("E-MAILS:\n")[1].split("\n").filter(Boolean).map((l, i) => ({ i, tipo: /sindicaliz/i.test(l) ? "FILIACAO" : "FINANCEIRO" })) };
  if (/quer se sindicalizar/.test(p)) return { nome: "Fulana de Souza", local: "Faculdade Exemplo — campus Vitória", setor: "Relacionamento", telefone: "(27) 99888-7766" };
  return { resposta: "Olá!", anexar: "" };
};
g.caixaFinanceiroItens(TOKEN);

b.fluxo("DIRETOR DA VISITA · cadastro");
b.passo("1. Os dois diretores já vêm na lista, sem WhatsApp (o número não fica no código)");
const l0 = g.caixaDiretoresVisita(TOKEN);
b.ok(l0.ok && l0.diretores.map(d => d.nome).join("|") === "Jocimar Vila Real|Lindolpho Gadelha" && l0.diretores.every(d => !d.whats), "Jocimar e Lindolpho");
b.passo("2. Só administrador cadastra; número inválido é recusado");
b.ok(g.caixaDiretoresVisitaSalvar([{ nome: "X", whats: "27999999999" }], ROG).ok === false, "quem não é administrador não cadastra");
b.ok(/inválido/.test(g.caixaDiretoresVisitaSalvar([{ nome: "Jocimar Vila Real", whats: "123" }], TOKEN).mensagem), "número curto recusado");
const sv = g.caixaDiretoresVisitaSalvar([{ nome: "Jocimar Vila Real", whats: "(27) 99111-2222" }, { nome: "Lindolpho Gadelha", whats: "27 98333-4444" }], TOKEN);
b.ok(sv.ok && sv.diretores[0].whats === "5527991112222" && sv.diretores[1].whats === "5527983334444", "salvos com o 55 na frente", JSON.stringify(sv.diretores));

b.fluxo("DIRETOR DA VISITA · no e-mail");
b.passo("3. Pedido de sindicalização: o robô sugere o atalho");
const at = g.caixaAtalhos("F:s1", TOKEN);
b.ok(at.ok && at.sugeridos.some(s => s.acao === "AVISAR_DIRETOR"), "sugere avisar o diretor", JSON.stringify(at.sugeridos.map(s => s.acao)));
b.ok(!g.caixaAtalhos("F:b1", TOKEN).sugeridos.some(s => s.acao === "AVISAR_DIRETOR"), "num boleto, não sugere");
b.passo("4. A mensagem sai preenchida a partir do e-mail, com a origem");
const pr = g.caixaAvisoDiretorPreparar("F:s1", TOKEN);
b.ok(pr.ok && pr.dados.nome.valor === "Fulana de Souza" && /campus Vitória/.test(pr.dados.local.valor) && pr.dados.email.valor === "fulana@faculdade.exemplo.br",
  "nome, local e e-mail", JSON.stringify(pr.dados));
b.ok(pr.dados.local.origem === "lido do e-mail" && pr.dados.email.origem === "do remetente", "com a origem à vista");
b.passo("5. Depois do clique: nota interna e memória do robô");
const rg = g.caixaAvisoDiretorRegistrar("F:s1", "Lindolpho Gadelha", "Jocimar Vila Real", TOKEN);
b.ok(rg.ok && /Avisado Lindolpho Gadelha pelo WhatsApp/.test(rg.nota), "anotado na nota interna", rg.nota);
b.ok(g.caixaAvisoDiretorRegistrar("F:s1", "Fulano Qualquer", "", TOKEN).ok === false, "diretor fora da lista é recusado");
const pr2 = g.caixaAvisoDiretorPreparar("F:s1", TOKEN);
b.ok(pr2.sugerido.nome === "Lindolpho Gadelha" && /faculdade\.exemplo\.br/.test(pr2.sugerido.motivo), "o robô aprende: sugere quem foi avisado para o mesmo domínio", pr2.sugerido.motivo);

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const abertos = [];
win.open = (u) => { abertos.push(u); return null; };
(async function () {
  b.fluxo("CAIXA · e-mail embaixo, categorias no seletor, aviso ao diretor (tela)");
  Object.defineProperty(win, "innerWidth", { value: 1400, configurable: true });
  win.cxsIniciar(); await t.assentar(250);
  b.passo("6. Padrão: e-mail embaixo; categorias num seletor ▾");
  b.ok(el("cxsSecao").classList.contains("cxs-vis-baixo") && el("cxsVis").value === "baixo", "embaixo por padrão");
  b.ok(/Todos/.test(el("cxsCatSelRot").textContent), "seletor mostra a categoria atual", el("cxsCatSelRot").textContent);
  t.clicar("[data-cxs='catAbrir']");
  b.ok(el("cxsCatSel").classList.contains("aberto"), "a setinha abre a lista de categorias");
  t.clicar("#cxsTipos [data-cxs='filtrarTipo'][data-arg='FILIACAO']"); await t.assentar(50);
  b.ok(!el("cxsCatSel").classList.contains("aberto") && /Filia/.test(el("cxsCatSelRot").textContent), "escolheu e fechou", el("cxsCatSelRot").textContent);
  b.passo("7. Trocar para 'janela' fica lembrado");
  el("cxsVis").value = "janela"; el("cxsVis").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(30);
  let ls = null; try { ls = win.localStorage.getItem("cxs_vis"); } catch (e) { ls = "sem-localStorage"; }
  b.ok(el("cxsSecao").classList.contains("cxs-vis-janela") && el("cxsModal").parentNode !== el("cxsLeitura") && (ls === "janela" || ls === "sem-localStorage"), "janela, lembrada",
    [el("cxsSecao").className, el("cxsModal").parentNode === el("cxsLeitura"), ls].join(" | "));
  el("cxsVis").value = "baixo"; el("cxsVis").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(30);
  b.passo("8. No e-mail: 📱 abre o quadro, troca o diretor e abre o WhatsApp certo");
  const linha = [...doc.querySelectorAll("#cxsLista .cxs-item")].find(x => /sindicaliza/i.test(x.textContent));
  linha.querySelector(".cxs-item-nome").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await t.assentar(300);
  t.clicar("[data-cxs='atalho'][data-arg='AVISAR_DIRETOR']"); await t.assentar(250);
  b.ok(/Olá, Lindolpho!/.test(el("cxsDirTxt").value) && /Faculdade Exemplo/.test(el("cxsDirTxt").value), "mensagem pronta para o sugerido", el("cxsDirTxt").value.split("\n")[0]);
  const rj = doc.querySelector("input[name=cxsDir][value='Jocimar Vila Real']");
  rj.checked = true; rj.dispatchEvent(new win.Event("change", { bubbles: true }));
  b.ok(/Olá, Jocimar!/.test(el("cxsDirTxt").value), "trocou o diretor, trocou o texto");
  t.clicar("[data-cxs='diretorZap']"); await t.assentar(250);
  b.ok(abertos.length === 1 && /^https:\/\/wa\.me\/5527991112222\?text=Ol%C3%A1%2C%20Jocimar/.test(abertos[0]), "abriu o WhatsApp do Jocimar com a mensagem", abertos[0] && abertos[0].slice(0, 60));
  b.ok(/Avisado Jocimar Vila Real/.test(el("cxsMNota").value), "e a nota interna mostra o aviso");
  b.resumo();
})();
