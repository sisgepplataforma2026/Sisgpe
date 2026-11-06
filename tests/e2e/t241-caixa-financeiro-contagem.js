/**
 * CAIXA DA FINANCEIRO@ — A CONTA BATE COM O GMAIL (06/11/2026). O usuário,
 * com o Gmail aberto ao lado: "Está com diferença da qt de e-mails, pq?"
 * (Gmail 67 na caixa de entrada × SISGEP 54 a tratar) → "Monte".
 *
 * Causa: a Caixa lia no máximo 60 conversas. Agora até 200, em páginas, e
 * a tela mostra a conta: quantas leu, quantas a tratar / respondidas /
 * automáticas, e quantas com mais de 60 dias ficaram de fora.
 *
 * Backend real, tela real (jsdom), Gmail FALSO com dados FICTÍCIOS.
 * NÃO PROVA: o tempo de leitura de 200 conversas no Gmail de verdade.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

let seq = 0;
function msg(de, assunto, quando) {
  const id = "M" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
    getSubject: () => assunto, getDate: () => quando, getPlainBody: () => "Segue a relação do mês.", getAttachments: () => [] };
}
const agora = Date.now();
const recentes = [], antigas = [];
for (let i = 0; i < 70; i++) {
  const quando = new Date(agora - (i + 1) * 3600e3);
  let msgs;
  if (i < 5) msgs = [msg("noreply@banco.exemplo.com", "Seu extrato " + i, quando)];                    // automáticas
  else if (i < 9) msgs = [msg("Escola " + i + " <rh" + i + "@escola.exemplo.com>", "Relação nominal " + i, new Date(quando - 864e5)),
                          msg("Wanderson <financeiro@sindeducacao.com>", "Re: Relação nominal " + i, quando)]; // respondidas
  else msgs = [msg("Escola " + i + " <rh" + i + "@escola.exemplo.com>", "Relação nominal de funcionários " + i, quando)];
  recentes.push({ id: "r" + i, msgs });
}
for (let i = 0; i < 160; i++) antigas.push({ id: "a" + i, msgs: [msg("Escola A" + i + " <x" + i + "@ant.exemplo.com>", "Antiga " + i, new Date(agora - 90 * 864e5))] });
const chamadas = [];
const th = t => ({ getId: () => t.id, getMessages: () => t.msgs });
const fake = {
  search: (q, ini, max) => {
    chamadas.push([q, ini, max]);
    const base = /older_than:60d/.test(q) ? antigas : recentes;
    return base.slice(ini, ini + max).map(th);
  },
  getThreadById: id => { const t = recentes.concat(antigas).find(x => x.id === id); return t ? th(t) : null; },
  getMessageById: () => null
};
g.cxsGmailFinanceiro_ = () => fake;
const limpa = () => g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");

b.fluxo("CAIXA · a financeiro@ com mais de 60 conversas");
b.passo("1. Lê todas as 70 (antes parava em 60)");
limpa();
const f = g.caixaFinanceiroItens(TOKEN);
b.ok(f.ok, "abre", f.mensagem);
b.igual(f.contagem.lidas, 70, "as 70 conversas dos últimos 60 dias foram lidas");
b.igual(f.contagem.automaticas, 5, "5 automáticas ficam de fora (e entram na conta)");
b.igual(f.itens.length, 65, "65 na lista");
b.igual(f.itens.filter(i => i.estado === "NOVO").length, 61, "61 a tratar");
b.igual(f.itens.filter(i => i.estado === "RESPONDIDO").length, 4, "4 respondidas (a última mensagem é nossa)");
b.igual(f.contagem.antigas, 160, "160 com mais de 60 dias: contadas, não lidas");
b.ok(!f.contagem.noLimite, "não bateu no limite de 200");
b.ok(chamadas.filter(c => !/older_than|has:attachment/.test(c[0])).every(c => c[2] <= 100), "o Gmail é lido em páginas de até 100");

b.passo("2. Guardada por 5 minutos, com a conta junto");
const n = chamadas.length;
const f2 = g.caixaFinanceiroItens(TOKEN);
b.ok(chamadas.length === n && f2.contagem && f2.contagem.lidas === 70 && f2.itens.length === 65, "abrir de novo não relê o Gmail e a conta continua");

b.passo("3. Guardada pela versão de antes (só a lista): lê de novo, sem lista vazia");
g.CacheService.getScriptCache().put("cxs_fin_lista_v1", JSON.stringify([{ THREAD_ID: "F:velho" }]), 300);
const f3 = g.caixaFinanceiroItens(TOKEN);
b.ok(f3.itens.length === 65 && f3.contagem, "a lista antiga guardada não engana a tela");

b.passo("4. Com mais de 200: mostra as 200 mais recentes e avisa");
for (let i = 70; i < 260; i++) recentes.push({ id: "r" + i, msgs: [msg("Escola " + i + " <rh" + i + "@escola.exemplo.com>", "Pedido " + i, new Date(agora - (i + 1) * 3600e3))] });
limpa();
const f4 = g.caixaFinanceiroItens(TOKEN);
b.ok(f4.contagem.lidas === 200 && f4.contagem.noLimite, "lê 200 e diz que chegou no limite", JSON.stringify(f4.contagem));
recentes.length = 70; limpa();

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
(async function () {
  b.fluxo("CAIXA · a conta na tela");
  t.win.cxsIniciar(); await t.assentar(200);
  const txt = t.texto("#cxsSubFin");
  b.ok(/70 conversa\(s\) da caixa de entrada nos últimos 60 dias/.test(txt), "diz quantas leu", txt);
  b.ok(/61 a tratar/.test(txt) && /4 respondida\(s\)/.test(txt) && /5 automática\(s\)\/propaganda/.test(txt), "e para onde foi cada uma", txt);
  b.ok(/Mais 160 com mais de 60 dias ficam de fora/.test(txt), "e as antigas que ficam de fora", txt);
  b.naoTestavel("o Gmail de verdade (tempo de 200 conversas)", "abrir a Caixa em HML e comparar com o Gmail");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
