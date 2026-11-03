/**
 * A CAIXA PROPÕE A RESPOSTA AO ABRIR E APRENDE COM O QUE A EQUIPE FAZ
 * (03/11/2026). O usuário, sobre um pedido de boleto: "deveria me propor a
 * resposta à solicitação dela... e sempre aprendendo com o que estou
 * fazendo".
 *
 * Prova (backend real, tela real em jsdom, Gmail e IA FALSOS, dados
 * FICTÍCIOS):
 *   - ao abrir, a proposta já vem no campo (sem clicar), com a dica do que
 *     anexar; nada sai;
 *   - a IA recebe, como exemplo, o que a equipe respondeu antes a ESTE
 *     remetente e a e-mails do MESMO tipo;
 *   - abrir de novo não gasta IA; o ✨ pede uma nova;
 *   - se a pessoa já começou a escrever, a proposta não apaga o texto dela;
 *   - o que for enviado fica guardado ao lado da proposta (memória).
 *
 * NÃO PROVA: a qualidade do texto da IA de verdade.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

let seq = 0;
const respostas = [];
function msg(de, assunto, corpo) {
  const id = "PR" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - seq * 6e5), getPlainBody: () => corpo, getAttachments: () => [],
    reply: (body, op) => respostas.push({ id, op }) };
}
const T = [
  { id: "z1", msgs: [msg("Zelia Zordan <rh@colegio.exemplo.com>", "SOLICITAÇÃO DE BOLETO - COLÉGIO",
      "Prezados, solicito os boletos da mensalidade de OUTUBRO R$ 299,23 e da taxa negocial parcela 02/03 R$ 1.140,59.")] },
  { id: "z2", msgs: [msg("Outra Escola <rh@outra.exemplo.com>", "Boleto da taxa", "Preciso do boleto da taxa negocial.")] }
];
g.cxsGmailFinanceiro_ = () => ({
  search: (q) => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? T : []).map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; },
  getUserLabels: () => [], getUserLabelByName: () => null
});
const pedidos = [];
g.vpeChamarIA_ = function (prompt) {
  if (/E-MAILS:\n/.test(prompt) && /Responda SOMENTE com JSON: \{"resultados"/.test(prompt)) {
    const linhas = prompt.split("E-MAILS:\n")[1].split("\n").filter(Boolean);
    return { resultados: linhas.map((l, i) => ({ i, tipo: "FINANCEIRO", pedido: "boleto" })) };
  }
  pedidos.push(prompt);
  return { resposta: "Olá, Zelia! Seguem em anexo os boletos da mensalidade de outubro (R$ 299,23) e da taxa negocial, parcela 02/03 (R$ 1.140,59).",
           anexar: "boleto da mensalidade de outubro e boleto da taxa negocial 02/03" };
};
/* O que a equipe já respondeu antes (memória do robô). */
const mem = (rem, tipo, assunto, texto) => g.roboMemoriaRegistrar_({ tarefa: "resposta-email", origem: "FINANCEIRO", chave: "x",
  remetente: rem, assunto, sugerido: "", decidido: texto, quem: "wanderson", tipoEmail: tipo });
mem("rh@colegio.exemplo.com", "FINANCEIRO", "Boleto setembro", "Olá, Zelia! Seguem os boletos de setembro. EXEMPLO-DA-ZELIA");
mem("rh@x.exemplo.com", "FINANCEIRO", "Guia", "Prezados, segue a guia. EXEMPLO-DO-TIPO");
mem("rh@y.exemplo.com", "CONTAS", "Fatura", "Recebido, obrigado. EXEMPLO-DE-OUTRO-TIPO");
for (let k = 0; k < 4; k++) mem("rh@k" + k + ".exemplo.com", "CONTAS", "Outro " + k, "Texto genérico " + k);
g.caixaFinanceiroItens(TOKEN);

b.fluxo("PROPOSTA DE RESPOSTA · o servidor");
b.passo("1. A IA aprende com o que a equipe respondeu a e-mails parecidos");
const r1 = g.caixaSugerirResposta("F:z1", TOKEN);
b.ok(r1.ok && /Seguem em anexo os boletos/.test(r1.texto) && /Wanderson N Castelo/.test(r1.texto), "propôs, com a assinatura", r1.mensagem);
b.ok(/boleto da mensalidade/.test(r1.anexar), "e diz o que anexar", r1.anexar);
const p1 = pedidos[0];
b.ok(/EXEMPLO-DA-ZELIA/.test(p1), "exemplo: o que se respondeu a ESTA pessoa");
b.ok(/EXEMPLO-DO-TIPO/.test(p1), "exemplo: o que se respondeu a e-mails do mesmo tipo");
b.ok(p1.indexOf("EXEMPLO-DA-ZELIA") < p1.indexOf("EXEMPLO-DO-TIPO"), "a mesma pessoa vem primeiro");
b.ok(/documento \(boleto, guia/.test(p1), "e a regra de responder ao que foi pedido (anexo)");
b.passo("2. Abrir de novo não gasta IA; o ✨ pede uma nova");
g.caixaSugerirResposta("F:z1", TOKEN);
b.igual(pedidos.length, 1, "a mesma proposta, sem nova chamada");
g.caixaSugerirResposta("F:z1", true, TOKEN);
b.igual(pedidos.length, 2, "pedindo de novo, pergunta à IA");
b.igual(respostas.length, 0, "nada saiu sozinho");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("PROPOSTA DE RESPOSTA · a tela");
  win.cxsIniciar(); await t.assentar(200);
  b.passo("3. Ao abrir, a proposta já está no campo");
  t.clicar("[data-cxs='abrir'][data-arg='F:z1']"); await t.assentar(250);
  b.ok(/Seguem em anexo os boletos/.test(el("cxsMResposta").value), "o campo já tem a resposta do robô", el("cxsMResposta").value.slice(0, 80));
  b.ok(/Proposta do robô/.test(t.texto("#cxsMRespIA")) && /Lembre de anexar: boleto da mensalidade/.test(t.texto("#cxsMRespIA")),
    "com o aviso de conferir e o que anexar", t.texto("#cxsMRespIA"));
  b.igual(respostas.length, 0, "nada saiu");
  b.passo("4. Enviar, editado: a memória guarda a proposta e o que saiu");
  el("cxsMResposta").value = el("cxsMResposta").value.replace("Olá, Zelia!", "Olá, Zelia! Tudo bem?");
  t.clicar("[data-cxs='responder']"); await t.assentar(250);
  b.igual(respostas.length, 1, "respondeu com o clique");
  const v = ss.getSheetByName("Robo_Memoria").getDataRange().getValues();
  const c = v[0], ult = v.filter(l => l[c.indexOf("TAREFA")] === "resposta-email" && l[c.indexOf("CHAVE")] === "F:z1").pop();
  b.ok(ult && /Seguem em anexo/.test(ult[c.indexOf("SUGERIDO")]) && /Tudo bem\?/.test(ult[c.indexOf("DECIDIDO")]) && ult[c.indexOf("ACERTOU")] === "NAO",
    "proposta e texto enviado lado a lado (editou → conta como ajuste)");
  b.passo("5. Se a pessoa já escreveu, a proposta não apaga");
  t.clicar("[data-cxs='fechar']");
  const n0 = t.chamadas.length;
  for (let k = n0; k < n0 + 12; k++) t.atrasar("caixaSugerirResposta", k, 300);   // a IA demora
  t.clicar("[data-cxs='abrir'][data-arg='F:z2']"); await t.assentar(80);
  b.ok(/escrevendo uma proposta/.test(t.texto("#cxsMRespIA")), "enquanto a IA escreve, avisa", t.texto("#cxsMRespIA"));
  el("cxsMResposta").value = "Texto que eu já comecei a escrever";
  await t.assentar(450);
  b.igual(el("cxsMResposta").value, "Texto que eu já comecei a escrever", "o texto da pessoa fica");
  b.ok(/tem uma proposta/.test(t.texto("#cxsMRespIA")), "e avisa que há proposta, se quiser usar", t.texto("#cxsMRespIA"));
  b.naoTestavel("o texto da IA de verdade", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
