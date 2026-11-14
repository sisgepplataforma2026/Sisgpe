/**
 * RESPOSTA A QUEM PEDE PARA SE SINDICALIZAR (12/11/2026). O usuário, vendo o
 * robô listar documentos para a Lorrayne: a sindicalização é PRESENCIAL, por
 * visita de um diretor; e deu o modelo de resposta. Backend real, Gmail e IA
 * FALSOS, dados FICTÍCIOS. NÃO PROVA: a qualidade do texto da IA de verdade.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
let seq = 0;
function msg(de, assunto, corpo, anexos) {
  const id = "SD" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(Date.now() - seq * 6e5), getPlainBody: () => corpo, getAttachments: () => anexos || [], reply: () => {} };
}
const pdf = { getName: () => "ficha sindicalizacao.pdf", getContentType: () => "application/pdf", getSize: () => 1000, getBytes: () => [] };
const T = [
  { id: "s1", msgs: [msg("Fulana de Tal <fulana@faculdade.exemplo.br>", "Solicitação de sindicalização – Desconto educacional",
      "Boa tarde! Gostaria de obter informações sobre o processo de sindicalização para ter acesso ao benefício de desconto educacional. Quais documentos preciso apresentar?")] },
  { id: "s2", msgs: [msg("RH Escola <rh@escola.exemplo.com>", "Boleto da taxa", "Preciso do boleto da taxa negocial.")] },
  { id: "s3", msgs: [msg("RH Escola <rh@escola2.exemplo.com>", "Ficha de sindicalização", "Segue a ficha de sindicalização da professora.", [pdf])] }
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
    return { resultados: linhas.map((l, i) => ({ i, tipo: "FILIACAO", pedido: "sindicalização" })) };
  }
  pedidos.push(prompt);
  return { resposta: "Fulana, boa tarde! Tudo bem?", anexar: "Formulário de filiação, CCT" };
};
g.caixaFinanceiroItens(TOKEN);

b.fluxo("SINDICALIZAÇÃO · a resposta segue a regra do sindicato");
b.passo("1. Pedido de sindicalização: a IA recebe a regra e o modelo");
const r1 = g.caixaSugerirResposta("F:s1", TOKEN);
const p1 = pedidos[pedidos.length - 1];
b.ok(r1.ok && /PRESENCIAL, por visita de um diretor/.test(p1), "a regra vai para a IA", r1.mensagem);
b.ok(/processo de sindicalização é realizado presencialmente/.test(p1) && /Nosso diretor entrará em contato/.test(p1), "com o modelo do usuário");
b.ok(/NÃO liste documentos/.test(p1), "e manda não listar documentos");
b.igual(r1.anexar, "", "nada a anexar, mesmo que a IA sugira");
b.passo("2. Outros e-mails não recebem a regra");
g.caixaSugerirResposta("F:s2", TOKEN);
b.ok(!/PRESENCIAL, por visita/.test(pedidos[pedidos.length - 1]), "boleto: sem a regra");
g.caixaSugerirResposta("F:s3", TOKEN);
b.ok(!/PRESENCIAL, por visita/.test(pedidos[pedidos.length - 1]), "ficha anexa (vira ofício): sem a regra");
b.resumo();
