/**
 * O ROBÔ APRENDE E SOBE DE NÍVEL — "E-MAIL QUE NÃO PEDE NADA" (09/11/2026).
 * ATUALIZADO NO MESMO DIA: o usuário, "não quero mais esse serviço" — o
 * "não pede nada" está DESLIGADO (CRN_NADA_ATIVO). Este teste prova que ele
 * não aparece nem age, e que a medição da categoria e a nota interna ficam.
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

b.fluxo("ROBÔ · 'não pede nada' DESLIGADO (o usuário, 09/11/2026: \"não quero mais esse serviço\")");
b.passo("1. Não aponta, não resolve, não registra");
b.ok(itens().every(i => !i.roboNada && !i.roboResolveu), "nenhum e-mail recebe o aviso do robô");
g.PropertiesService.getScriptProperties().setProperty("CRN_NIVEIS", JSON.stringify({ "nada-a-fazer|FINANCEIRO": { ligado: true } }));
limpar();
b.ok(itens().every(i => i.estado === "NOVO"), "mesmo com o nível gravado como ligado, não resolve nada sozinho");
let r = g.caixaSecretariaMarcar("F:a1", "RESOLVIDO", "", W);
b.ok(r.ok, "resolver continua igual", r.mensagem);
r = g.caixaSecretariaResponder("F:a2", "Olá! Recebemos, obrigado. Até mais.", W);
b.ok(r.ok, "responder continua igual", r.mensagem);
const mem = () => { const v = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), c = v[0].map(String);
  return v.slice(1).map(l => Object.fromEntries(c.map((k, i) => [k, String(l[i])]))); };
b.ok(!mem().some(x => x.TAREFA === "nada-a-fazer"), "nada do 'não pede nada' na memória");
b.ok(g.caixaRoboNiveis(W).tarefas.length === 0, "o painel do rodapé não tem a tarefa");
b.ok(!g.caixaRoboNivelLigar("nada-a-fazer", "FINANCEIRO", true, W).ok, "e não dá para ligar");
b.ok(!g.caixaRoboMedicao(W).robo.some(x => x.tarefa === "nada-a-fazer"), "a medição do rodapé não mostra a tarefa");

b.fluxo("ROBÔ · a medição da categoria (fica: é invisível)");
b.passo("2. Tratar sem mudar o card = acerto, uma vez só");
let cat = mem().filter(x => x.TAREFA === "categoria-email" && x.ACERTOU === "SIM");
b.ok(cat.some(x => x.CHAVE === "F:a1") && cat.some(x => x.CHAVE === "F:a2"), "resolver e responder contam acerto da categoria", JSON.stringify(cat.map(x => x.CHAVE)));
b.ok(cat.every(x => !x.REMETENTE), "sem remetente: o acerto não vira regra fixa do remetente");
g.caixaSecretariaMarcar("F:a1", "NOVO", "", W); g.caixaSecretariaMarcar("F:a1", "RESOLVIDO", "", W);
b.igual(mem().filter(x => x.TAREFA === "categoria-email" && x.CHAVE === "F:a1").length, 1, "resolver de novo não conta duas vezes");
const novoTipo = item("p3").tipo === "NEGOCIACAO" ? "JURIDICO" : "NEGOCIACAO";
b.ok(g.caixaSecretariaReclassificar("F:p3", novoTipo, W).ok, "a pessoa corrige o card de p3");
g.caixaSecretariaResponder("F:p3", "Olá! Segue a segunda via em anexo.", W);
b.ok(!mem().some(x => x.TAREFA === "categoria-email" && x.CHAVE === "F:p3" && x.ACERTOU === "SIM"), "card corrigido antes: não conta como acerto do robô");
b.ok(g.caixaRoboMedicao(W).robo.some(x => x.tarefa === "categoria-email"), "a taxa da categoria aparece no rodapé");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: W });
(async function () {
  b.fluxo("ROBÔ · na tela");
  t.win.cxsIniciar(); await t.assentar(400);
  b.ok(!/não pede nada/.test(t.doc.body.textContent), "nada do 'não pede nada' na tela");
  t.clicar("[data-cxs='abrir'][data-arg='F:p1']"); await t.assentar(300);
  b.ok(t.doc.getElementById("cxsMRoboNada").style.display === "none", "no e-mail aberto, sem o aviso do robô");
  t.digitar("#cxsMNota", "Respondido por telefone.");
  t.clicar("#cxsMAcoes [data-cxs='resolver']"); await t.assentar(300);
  const e = g.cxsEstados_()["F:p1"];
  b.ok(e && e.ESTADO === "RESOLVIDO" && e.NOTA === "Respondido por telefone.", "Marcar como resolvido salva a nota interna (o id não está mais duplicado)", e && e.NOTA);
  b.resumo();
  process.exit(process.exitCode || 0);
})();
