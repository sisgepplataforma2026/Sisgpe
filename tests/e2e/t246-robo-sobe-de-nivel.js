/**
 * O ROBÔ APRENDE E SOBE DE NÍVEL — "E-MAIL QUE NÃO PEDE NADA" (09/11/2026).
 * O usuário: "preciso que comece a entender e a fazer as tarefas";
 * "que ele aprende e vai fazendo sozinho quando tiver alta [taxa] de
 * aprovação"; "eu aprovo sempre antes de sair".
 *
 * Backend real, tela real (jsdom), Gmail da financeiro@ FALSO, dados FICTÍCIOS.
 * Prova: o robô aponta só o que não pede nada (agradecimento, resposta
 * automática) e não aponta pergunta, pedido nem anexo; resolver = acerto,
 * responder = erro; a categoria passa a contar acerto quando a pessoa trata
 * sem mudar o card (e uma vez só); sem 50/95%/20 seguidas ele NÃO deixa
 * ligar; só administrador liga; ligado, resolve sozinho com Desfazer e nunca
 * envia nada; Desfazer conta erro e, abaixo de 90%, ele se desliga e avisa;
 * a nota interna volta a salvar (o id duplicado do quadro da NF).
 * NÃO PROVA: o tempo real da lista no ar.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["fin2", g.gerarHashSenha_("Senha@2026"), "Fin Comum",
  "financeiro@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "financeiro"]);
const W = b.logar(g, "wanderson"), COMUM = b.logar(g, "fin2");

/* O Gmail da financeiro@, falso */
let seq = 0;
const enviados = [];
function msg(de, assunto, corpo, anexos) {
  const id = "M" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getCc: () => "",
    getSubject: () => assunto, getDate: () => new Date(), getPlainBody: () => corpo, getAttachments: () => anexos || [],
    isUnread: () => true, isStarred: () => false,
    reply: (c, op) => enviados.push({ via: "reply", id, op }), forward: (p, op) => enviados.push({ via: "forward", id, p }) };
}
const T = [];
const add = (id, de, assunto, corpo, anexos) => T.push({ id, msgs: [msg(de, assunto, corpo, anexos)] });
add("a1", "Escola A <a@escola-a.exemplo.com>", "Re: guia", "Muito obrigada! Atenciosamente, Ana");
add("a2", "Escola B <b@escola-b.exemplo.com>", "Resposta automática: Re: guia", "Estou fora do escritório até segunda.");
add("p1", "Escola C <c@escola-c.exemplo.com>", "Re: guia", "Obrigada! Mas quando vence a próxima guia?");
add("p2", "Escola D <d@escola-d.exemplo.com>", "Re: guia", "Ok, segue o comprovante.",
  [{ getName: () => "comp.pdf", getContentType: () => "application/pdf", getSize: () => 9, getBytes: () => Buffer.from("x") }]);
add("p3", "Escola E <e@escola-e.exemplo.com>", "Segunda via", "Preciso da segunda via da guia de outubro, por favor.");
const th = t => ({ getId: () => t.id, getMessages: () => t.msgs, getFirstMessageSubject: () => t.msgs[0].getSubject() });
g.cxsGmailFinanceiro_ = () => ({
  search: () => T.map(th),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? th(t) : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; }
});
const limpar = () => g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
limpar();
const itens = () => g.caixaFinanceiroItens(W).itens;
const item = id => itens().find(i => i.id === "F:" + id);

b.fluxo("ROBÔ · aponta o que não pede nada");
b.passo("1. Só agradecimento e resposta automática");
b.ok(item("a1").roboNada === "só agradecimento ou confirmação", "\"Muito obrigada!\" — não pede nada", item("a1").roboNada);
b.ok(item("a2").roboNada === "resposta automática", "resposta automática de férias — não pede nada", item("a2").roboNada);
b.ok(!item("p1").roboNada, "agradece MAS pergunta — pede (não aponta)");
b.ok(!item("p2").roboNada, "\"Ok, segue o comprovante\" com anexo — pede (não aponta)");
b.ok(!item("p3").roboNada, "pedido de segunda via — pede (não aponta)");
b.ok(itens().every(i => i.estado === "NOVO"), "desligado: o robô só aponta, nada muda de situação");

b.passo("2. Aprende: resolver = acerto; responder = erro");
let r = g.caixaSecretariaMarcar("F:a1", "RESOLVIDO", "", W);
b.ok(r.ok, "resolveu o agradecimento", r.mensagem);
r = g.caixaSecretariaResponder("F:a2", "Olá! Recebemos, obrigado. Até mais.", W);
b.ok(r.ok, "respondeu a resposta automática", r.mensagem);
const mem = () => { const v = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), c = v[0].map(String);
  return v.slice(1).map(l => Object.fromEntries(c.map((k, i) => [k, String(l[i])]))); };
const nada = mem().filter(x => x.TAREFA === "nada-a-fazer");
b.ok(nada.length === 2 && nada.some(x => x.CHAVE.startsWith("F:a1|") && x.ACERTOU === "SIM") && nada.some(x => x.CHAVE.startsWith("F:a2|") && x.ACERTOU === "NAO"),
  "a memória guarda: a1 acertou, a2 errou", JSON.stringify(nada.map(x => [x.CHAVE, x.ACERTOU])));

b.passo("3. A categoria: tratar sem mudar o card = acerto, uma vez só");
let cat = mem().filter(x => x.TAREFA === "categoria-email" && x.ACERTOU === "SIM");
b.ok(cat.some(x => x.CHAVE === "F:a1") && cat.some(x => x.CHAVE === "F:a2"), "resolver e responder contam acerto da categoria", JSON.stringify(cat.map(x => x.CHAVE)));
b.ok(cat.every(x => !x.REMETENTE), "sem remetente: o acerto não vira regra fixa do remetente");
g.caixaSecretariaMarcar("F:a1", "NOVO", "", W); g.caixaSecretariaMarcar("F:a1", "RESOLVIDO", "", W);
cat = mem().filter(x => x.TAREFA === "categoria-email" && x.CHAVE === "F:a1");
b.igual(cat.length, 1, "resolver de novo não conta duas vezes");
const novoTipo = item("p3").tipo === "NEGOCIACAO" ? "JURIDICO" : "NEGOCIACAO";
b.ok(g.caixaSecretariaReclassificar("F:p3", novoTipo, W).ok, "a pessoa corrige o card de p3");
g.caixaSecretariaResponder("F:p3", "Olá! Segue a segunda via em anexo.", W);
b.ok(!mem().some(x => x.TAREFA === "categoria-email" && x.CHAVE === "F:p3" && x.ACERTOU === "SIM"), "card corrigido antes: não conta como acerto do robô",
  JSON.stringify(mem().filter(x => x.CHAVE === "F:p3").map(x => [x.TAREFA, x.SUGERIDO, x.DECIDIDO, x.ACERTOU])));

b.fluxo("ROBÔ · subir de nível só com o usuário");
b.passo("4. Sem os números, não liga");
let n = g.caixaRoboNiveis(W).tarefas.find(x => x.caixa === "FINANCEIRO");
b.ok(n && !n.ligado && !n.podePropor && /decisões/.test(n.falta), "ainda aprendendo, com o que falta à vista", n && n.falta);
r = g.caixaRoboNivelLigar("nada-a-fazer", "FINANCEIRO", true, W);
b.ok(!r.ok && /Ainda não/.test(r.mensagem), "o servidor recusa ligar antes da hora", r.mensagem);

b.passo("5. Com 50 decisões, 95% e 20 seguidas: propõe");
for (let i = 0; i < 58; i++) g.roboMemoriaRegistrar_({ tarefa: "nada-a-fazer", origem: "FINANCEIRO", chave: "X" + i + "|m", sugerido: "RESOLVER", decidido: "RESOLVER", quem: "w" });
n = g.caixaRoboNiveis(W).tarefas.find(x => x.caixa === "FINANCEIRO");
b.ok(n.podePropor && n.pct >= 95 && n.seq >= 20, "propõe", JSON.stringify([n.n, n.pct, n.seq]));
r = g.caixaRoboNivelLigar("nada-a-fazer", "FINANCEIRO", true, COMUM);
b.ok(!r.ok && /administrador/.test(r.mensagem), "quem não é administrador não liga", r.mensagem);
b.ok(!g.caixaRoboNiveis(W).tarefas.find(x => x.caixa === "FINANCEIRO").ligado, "o robô não se liga sozinho");
r = g.caixaRoboNivelLigar("nada-a-fazer", "FINANCEIRO", true, W);
b.ok(r.ok, "o administrador liga", r.mensagem);

b.passo("6. Ligado: resolve sozinho, só por dentro");
T.push({ id: "a3", msgs: [msg("Escola F <f@escola-f.exemplo.com>", "Re: ofício", "Recebido, obrigado.")] });
T.push({ id: "p4", msgs: [msg("Escola G <g@escola-g.exemplo.com>", "Dúvida", "Bom dia, qual o valor da mensalidade?")] });
limpar();
const antesEnv = enviados.length, antesOut = amb.outbox.length;
b.ok(item("a3").estado === "RESOLVIDO" && item("a3").roboResolveu, "o \"Recebido, obrigado\" já vem resolvido pelo robô", JSON.stringify(item("a3")));
b.ok(item("p4").estado === "NOVO", "a pergunta continua esperando a equipe");
b.ok(enviados.length === antesEnv && amb.outbox.length === antesOut, "nada saiu: nem resposta, nem encaminhamento, nem e-mail");
const det = g.caixaSecretariaDetalhe("F:a3", W);
b.ok(det.roboResolveu && /Resolvido pelo robô/.test(det.nota), "ao abrir, diz que foi o robô", det.roboResolveu);

b.passo("7. Desfazer conta erro; abaixo de 90%, ele se desliga e avisa");
r = g.caixaRoboDesfazer("F:a3", W);
b.ok(r.ok && item("a3").estado === "NOVO", "Desfazer: volta para os novos", r.mensagem);
b.ok(mem().some(x => x.TAREFA === "nada-a-fazer" && x.CHAVE.startsWith("F:a3|") && x.ACERTOU === "NAO"), "e o robô anotou o erro");
limpar();
b.ok(item("a3").estado === "NOVO", "e não resolve de novo o que a pessoa desfez");
b.ok(!g.caixaRoboDesfazer("F:p4", W).ok, "não desfaz o que o robô não fez");
for (let i = 0; i < 2; i++) g.roboMemoriaRegistrar_({ tarefa: "nada-a-fazer", origem: "FINANCEIRO", chave: "E" + i + "|m", sugerido: "RESOLVER", decidido: "TRATAR", quem: "w" });
T.push({ id: "a4", msgs: [msg("Escola H <h@escola-h.exemplo.com>", "Re: guia", "Ok, obrigado.")] });
limpar();
b.ok(item("a4").estado === "RESOLVIDO", "ainda ligado: resolveu outro");
r = g.caixaSecretariaMarcar("F:a4", "NOVO", "", W);
n = g.caixaRoboNiveis(W).tarefas.find(x => x.caixa === "FINANCEIRO");
b.ok(!n.ligado && /Voltei a só sugerir/.test(n.aviso), "4 erros nas últimas 20: desligou sozinho e avisou", n.aviso + " · " + r.mensagem);
limpar();
b.ok(item("a4").estado === "NOVO" && item("a4").roboNada, "desligado: volta a só apontar");

b.passo("8. A medição no rodapé tem a tarefa nova");
const med = g.caixaRoboMedicao(W).robo;
b.ok(med.some(x => x.tarefa === "nada-a-fazer") && med.some(x => x.tarefa === "categoria-email"), "E-mail que não pede nada e Categoria", JSON.stringify(med.map(x => [x.tarefa, x.pct, x.n])));

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: W });
(async function () {
  b.fluxo("ROBÔ · na tela");
  t.win.cxsIniciar(); await t.assentar(400);
  b.ok(/parece que não pede nada/.test(t.texto("#cxsLista")), "a lista mostra o que o robô achou");
  b.ok(/E-mail que não pede nada/.test(t.texto("#cxsRoboNiveis")) && /Voltei a só sugerir/.test(t.texto("#cxsRoboNiveis")), "o rodapé mostra o nível e o aviso", t.texto("#cxsRoboNiveis"));
  t.clicar("[data-cxs='abrir'][data-arg='F:a4']"); await t.assentar(300);
  b.ok(/não pede nada/.test(t.texto("#cxsMRoboNada")) && t.doc.querySelector("#cxsMRoboNada [data-cxs='resolver']"), "no e-mail: o aviso com 'Marcar como resolvido'");
  t.digitar("#cxsMNota", "Só agradeceu.");
  t.clicar("#cxsMRoboNada [data-cxs='resolver']"); await t.assentar(300);
  const e = g.cxsEstados_()["F:a4"];
  b.ok(e && e.ESTADO === "RESOLVIDO" && e.NOTA === "Só agradeceu.", "resolveu pelo aviso, e a nota interna salvou (id não está mais duplicado)", e && e.NOTA);
  b.resumo();
  process.exit(process.exitCode || 0);
})();
