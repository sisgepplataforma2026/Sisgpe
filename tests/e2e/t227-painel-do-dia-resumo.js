/**
 * PAINEL DO DIA — SÓ RESUMO, LIDO DA CAIXA (03/11/2026). Desenho aprovado
 * pelo usuário ("Aprovo").
 *
 * Prova (backend real, tela real em jsdom, Gmail FALSO, dados FICTÍCIOS):
 *   - os números do Painel são os mesmos da Caixa (a tratar, por card);
 *   - cada um com a sua caixa: o Wanderson vê a financeiro@, a Marcelha a
 *     secretaria@ e os vouchers;
 *   - "precisa de você": os novos mais antigos, sem os resolvidos;
 *   - o robô: taxa de acerto tirada da memória (Robo_Memoria);
 *   - o Painel não chama a IA;
 *   - clicar num card abre a Caixa já filtrada; "Abrir" abre a conversa.
 *
 * NÃO PROVA: o Gmail de verdade, o tempo de abertura, a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);

let seq = 0;
function msg(de, assunto, corpo, horasAtras) {
  const id = "PD" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - horasAtras * 3600e3), getPlainBody: () => corpo, getAttachments: () => [] };
}
const T = [
  { id: "a", msgs: [msg("Escola A <rh@a.exemplo.com>", "Relação nominal de outubro", "segue", 30)] },
  { id: "b", msgs: [msg("Escola B <rh@b.exemplo.com>", "Taxa negocial 2/3", "boleto da taxa", 5)] },
  { id: "c", msgs: [msg("Loja <c@loja.exemplo.com>", "Boleto de luz", "fatura", 1)] },
  { id: "d", msgs: [msg("Escola D <rh@d.exemplo.com>", "Desconto em folha", "comprovante", 50)] }
];
const fake = {
  search: (q, i, m) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: () => null, getUserLabels: () => [], getUserLabelByName: () => null
};
g.cxsGmailFinanceiro_ = () => fake;
let chamouIA = 0;
g.vpeChamarIA_ = function (prompt) {
  chamouIA++;
  const linhas = (prompt.split("E-MAILS:\n")[1] || "").split("\n").filter(Boolean);
  return { resultados: linhas.map((l, i) => ({ i, tipo: /luz/.test(l) ? "CONTAS" : "FINANCEIRO", pedido: "x" })) };
};
/* Na Secretaria: um e-mail comum (o leitor copia). */
SIM.novaThread("Quero me desfiliar", "João <joao@exemplo.com>", "Quero cancelar a filiação. TIPO:FILIACAO");
SIM.ciclo();

b.fluxo("PAINEL DO DIA · o servidor");
b.passo("1. Os números são os mesmos da Caixa (Wanderson → financeiro@)");
g.caixaFinanceiroItens(TOKEN);   // a Caixa classifica (a IA, uma vez)
g.caixaSecretariaMarcar("F:d", "RESOLVIDO", "", TOKEN);
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const iaAntes = chamouIA;
const r = g.caixaResumoDoDia(TOKEN);
b.ok(r.ok, "abre", r.mensagem);
b.igual(r.caixa, "financeiro@sindeducacao.com", "a caixa dele");
const daCaixa = g.caixaFinanceiroItens(TOKEN).itens.filter(i => i.estado !== "RESOLVIDO");
b.igual(r.aTratar, daCaixa.length, "a tratar = o mesmo número da Caixa (3)");
b.igual(r.cards.map(c => c.chave + ":" + c.n), ["FINANCEIRO:2", "CONTAS:1"], "os cards com e-mail, como na Caixa");
b.igual(r.precisa.map(p => p.id), ["F:a", "F:b", "F:c"], "precisa de você: os mais antigos primeiro, sem o resolvido");
b.ok(/há \d+h|há 1 dias|há \d+ dias/.test(r.precisa[0].ha), "com há quanto tempo", r.precisa[0].ha);
b.ok(r.voucher === null, "voucher é da Secretaria: não aparece para ele");
b.igual(chamouIA, iaAntes, "o Painel não chamou a IA");
b.passo("2. Marcelha → secretaria@ e os vouchers");
const rs = g.caixaResumoDoDia(T_SEC);
b.ok(rs.ok && rs.caixa === "secretaria@sindeducacao.com", "a caixa dela", rs.mensagem);
b.ok(rs.cards.some(c => /FILIACAO/.test(c.chave)) && !rs.precisa.some(p => /^F:/.test(p.id)), "só a secretaria@, nada da financeiro@");
b.ok(rs.voucher && typeof rs.voucher.aConferir === "number", "com o bloco de vouchers");
b.passo("3. O robô: a taxa de acerto vem da memória");
b.igual(r.robo, [], "sem decisões ainda: vazio");
g.caixaSecretariaReclassificar("F:a", "FILIACAO", TOKEN);   // a equipe corrigiu (robô errou)
g.roboMemoriaRegistrar_({ tarefa: "categoria-email", origem: "FINANCEIRO", chave: "x1", sugerido: "CONTAS", decidido: "CONTAS", quem: "w" });
g.roboMemoriaRegistrar_({ tarefa: "categoria-email", origem: "FINANCEIRO", chave: "x2", sugerido: "CONTAS", decidido: "CONTAS", quem: "w" });
g.roboMemoriaRegistrar_({ tarefa: "categoria-email", origem: "SECRETARIA", chave: "x3", sugerido: "OUTRO", decidido: "FILIACAO", quem: "m" });
const r2 = g.caixaResumoDoDia(TOKEN);
const cat = r2.robo.find(x => x.tarefa === "categoria-email");
b.ok(cat && cat.n === 3 && cat.pct === 67, "categoria: 2 de 3 certas na financeiro@ = 67%", JSON.stringify(r2.robo));
const med = g.caixaRoboMedicao(TOKEN);
b.ok(med.ok && med.robo.find(x => x.tarefa === "categoria-email").pct === 67, "a mesma medição no rodapé da Caixa", JSON.stringify(med.robo));
b.passo("4. Quem não pode abrir a Caixa não abre o Painel");
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["rhzinho", g.gerarHashSenha_("Senha@2026"), "Só RH", "rh@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "rh"]);
b.ok(!g.caixaResumoDoDia(b.logar(g, "rhzinho")).ok, "só RH: não abre");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const t = dom.montar(g, ["PainelDoDiaUI.html", "VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const foi = [];
win.spIr = m => { foi.push(m); if (m === "caixaSecretaria") win.cxsIniciar(); };
(async function () {
  b.fluxo("PAINEL DO DIA · a tela");
  win.pddIniciar(); await t.assentar(250);
  b.passo("5. Os cards e a lista");
  b.ok(/Wanderson/.test(t.texto("#pddTitulo")), "cumprimenta pelo nome", t.texto("#pddTitulo"));
  b.ok(/financeiro@sindeducacao\.com/.test(t.texto("#pddSub")), "diz qual caixa");
  const cards = Array.from(doc.querySelectorAll("#pddCards .pdd-card")).map(c => c.textContent);
  b.ok(/a tratar/.test(cards[0]) && cards.some(c => /Contas/.test(c)), "a tratar e os cards", cards.join(" | "));
  b.ok(/Escola B/.test(t.texto("#pddPrecisa")), "precisa de você", t.texto("#pddPrecisa"));
  b.ok(/Categoria do e-mail/.test(t.texto("#pddRobo")) && /67%/.test(t.texto("#pddRobo")), "o robô, com a taxa", t.texto("#pddRobo"));
  b.ok(el("pddVoucherBloco").style.display === "none", "sem vouchers para ele");
  b.passo("6. Clicar no card abre a Caixa já filtrada");
  t.clicar("#pddCards [data-pdd='tipo'][data-arg='CONTAS']"); await t.assentar(250);
  b.ok(/O robô, nos últimos 90 dias/.test(t.texto("#cxsRobo")) && /67%/.test(t.texto("#cxsRobo")), "o rodapé da Caixa mostra quanto o robô acerta", t.texto("#cxsRobo"));
  b.igual(foi[foi.length - 1], "caixaSecretaria", "foi para a Caixa");
  const ativo = doc.querySelector("#cxsTipos .cxs-tipo.ativo");
  b.ok(ativo && /Contas/.test(ativo.textContent), "com o card Contas selecionado", ativo && ativo.textContent);
  b.passo("7. \"Abrir\" abre a conversa na Caixa");
  t.clicar("#pddPrecisa [data-pdd='abrir'][data-arg='F:b']"); await t.assentar(250);
  b.ok(el("cxsModal").classList.contains("aberto") && /Taxa negocial 2\/3/.test(t.texto("#cxsMTitulo")), "a conversa abriu", t.texto("#cxsMTitulo"));
  b.naoTestavel("o Gmail de verdade e a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
