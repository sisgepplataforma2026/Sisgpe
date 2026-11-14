/**
 * NOTA FISCAL DO PRESTADOR → DESPESA → CONTABILIDADE, DO PRÓPRIO E-MAIL
 * (06/11/2026). O usuário: "quando é nota fiscal, tem que ter a opção de
 * enviar NF" — "2 - b" (o prestador manda a nota); desenho
 * docs/mock-acoes-no-email.png com os ajustes ("sim").
 *
 * Backend real (inclusive o módulo de Despesas: registrarLancamentoDespesa,
 * uploadDocumentoManual, enviarLoteDespesasParaContabilidade), tela real
 * (jsdom), Gmail da financeiro@ FALSO, dados FICTÍCIOS.
 * Prova: acha a despesa pelo e-mail do prestador (motivo à vista); com duas
 * iguais, não chuta; travas (conferi, anexo, módulo Financeiro); "Só anexar"
 * deixa a despesa com o documento; "Anexar e enviar" manda à contabilidade
 * pelo mesmo envio; só o anexo marcado vai; e-mail resolvido; memória.
 * NÃO PROVA: o e-mail chegando na contabilidade (no ar).
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
const W = b.logar(g, "wanderson"), ESC = b.logar(g, "joscimar");   // joscimar não tem Financeiro
const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const desp = (nome, email, desc, valor) => g.registrarLancamentoDespesa({ prestadorNome: nome, prestadorEmail: email, prestadorDocumento: "11.222.333/0001-81",
  descricao: desc, categoria: "SERVICOS", valor: valor, dataVencimento: dias(10), formaPagamento: "PIX", tipoLancamento: "AVULSO" }, W);
const d1 = desp("Prestador Exemplo LTDA", "contato@prestador.exemplo.com", "Manutenção outubro", "850,00");
const d2 = desp("Outro Fornecedor", "vendas@outro.exemplo.com", "Material de escritório", "120,00");
b.ok(d1.ok && d2.ok, "duas despesas em aberto", d1.mensagem + " / " + d2.mensagem);

/* O Gmail da financeiro@, falso */
let seq = 0;
const blob = (nome, tipo) => ({ getName: () => nome, getContentType: () => tipo, getSize: () => 12, getBytes: () => Buffer.from("conteudo-" + nome) });
function msg(de, assunto, corpo, anexos) {
  const id = "M" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getSubject: () => assunto,
    getDate: () => new Date(), getPlainBody: () => corpo, getAttachments: () => anexos || [], reply: () => {}, forward: () => {} };
}
const T = [
  { id: "n1", msgs: [msg("Prestador Exemplo <contato@prestador.exemplo.com>", "NF 1234 — manutenção outubro", "Segue a nota fiscal do serviço.",
      [blob("nf-1234.pdf", "application/pdf"), blob("boleto.pdf", "application/pdf")])] },
  { id: "n2", msgs: [msg("Alguém <alguem@gmail.com>", "Nota fiscal", "Segue a nota.", [blob("nota.pdf", "application/pdf")])] }
];
g.cxsGmailFinanceiro_ = () => ({
  search: () => T.map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; }
});
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");

b.fluxo("NOTA FISCAL · o servidor");
b.passo("1. Acha a despesa do prestador");
const r = g.caixaNotaFiscalDoEmail("F:n1", W);
b.ok(r.ok && r.nota.escolhida === d1.idDespesa, "a despesa de Manutenção, pelo e-mail do prestador", JSON.stringify(r.nota && r.nota.candidatas.map(c => [c.descricao, c.motivo])));
b.ok(/e-mail do prestador/.test(r.nota.candidatas[0].motivo), "com o motivo à vista");
b.igual(r.nota.anexos.filter(a => a.sugerido).map(a => a.nome), ["nf-1234.pdf"], "o robô pré-marca a nota (o boleto não)");
const r2 = g.caixaNotaFiscalDoEmail("F:n2", W);
b.ok(r2.ok && !r2.nota.escolhida && r2.nota.candidatas.length === 0, "remetente que não bate com despesa nenhuma: não chuta");
b.ok(!g.caixaNotaFiscalDoEmail("F:n1", ESC).ok, "sem o módulo Financeiro: não abre");

b.passo("2. Travas");
const nfIdx = r.nota.anexos.filter(a => a.sugerido).map(a => a.indice);
let a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: d1.idDespesa, anexos: nfIdx, enviar: false }, W);
b.ok(!a.ok && /conferiu/.test(a.mensagem), "sem 'conferi': não anexa");
a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: d1.idDespesa, anexos: [], enviar: false, conferi: true }, W);
b.ok(!a.ok && /anexo/.test(a.mensagem), "sem anexo marcado: não anexa");
a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: "", anexos: nfIdx, enviar: false, conferi: true }, W);
b.ok(!a.ok && /despesa/.test(a.mensagem), "sem despesa: não anexa");

b.passo("3. Só anexar: a despesa fica com o documento (o mesmo do módulo)");
a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: d1.idDespesa, anexos: nfIdx, enviar: false, conferi: true }, W);
b.ok(a.ok && !a.enviado, "anexou", a.mensagem);
let l = g.listarDespesas({}, W).lista.find(x => x.idDespesa === d1.idDespesa);
b.ok(l.status === "DOC_RECEBIDO" && /nf-1234/.test(l.nomeArquivo) && !/boleto/.test(l.nomeArquivo), "despesa com o documento recebido — só a nota, não o boleto", l.status + " · " + l.nomeArquivo);
b.ok(/Caixa de E-mails/.test(l.observacoes), "a observação diz que veio pela Caixa");
const det = g.caixaSecretariaDetalhe("F:n1", W);
b.ok(det.item.estado === "RESOLVIDO" && /NF anexada/.test(det.nota), "e-mail resolvido com a nota", det.nota);

b.passo("4. Anexar e enviar: vai à contabilidade pelo mesmo envio");
const antes = amb.outbox.length;
a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: d1.idDespesa, anexos: nfIdx, enviar: true, conferi: true }, W);
b.ok(a.ok && a.enviado, "anexou e enviou", a.mensagem);
l = g.listarDespesas({}, W).lista.find(x => x.idDespesa === d1.idDespesa);
b.ok(l.status === "ENVIADO_CONTABILIDADE" && l.dataEnvioContab, "a despesa está enviada à contabilidade", l.status);
b.ok(amb.outbox.length > antes, "saiu o e-mail da contabilidade (o de sempre do módulo)");
a = g.caixaNotaFiscalAnexar("F:n1", { idDespesa: d1.idDespesa, anexos: nfIdx, enviar: true, conferi: true }, W);
b.ok(!a.ok, "despesa já enviada: não anexa de novo", a.mensagem);
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), cab = mem[0].map(String);
b.ok(mem.some(x => x[cab.indexOf("TAREFA")] === "nf-despesa" && String(x[cab.indexOf("DECIDIDO")]) === d1.idDespesa), "o robô guarda a despesa escolhida");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const d3 = desp("Prestador Exemplo LTDA", "contato@prestador.exemplo.com", "Manutenção novembro", "850,00");
T.push({ id: "n3", msgs: [msg("Prestador Exemplo <contato@prestador.exemplo.com>", "NF 1300 — manutenção novembro", "Segue a NF.", [blob("NF-1300.pdf", "application/pdf")])] });
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: W });
(async function () {
  b.fluxo("NOTA FISCAL · na tela");
  t.win.cxsIniciar(); await t.assentar(300);
  g.caixaSecretariaReclassificar("F:n3", "NOTA_FISCAL", W);
  t.win.eval("void 0"); t.clicar("[data-cxs='abrir'][data-arg='F:n3']"); await t.assentar(300);
  const box = () => t.texto("#cxsMNF");
  b.ok(/Manutenção novembro/.test(box()) && /Anexar à despesa e enviar/.test(box()) && /Conferi a nota/.test(box()), "o quadro mostra a despesa e os botões", box().slice(0, 200));
  t.doc.getElementById("cxsNfConferi").checked = true;
  t.clicar("[data-cxs='nfAnexar'][data-arg='enviar']"); await t.assentar(50);
  b.ok(/e enviar à contabilidade/.test(box()) && /Sim/.test(box()), "pergunta antes, dizendo o que vai e para onde");
  t.clicar("[data-cxs='nfAnexar'][data-arg='enviar-sim']"); await t.assentar(300);
  const l3 = g.listarDespesas({}, W).lista.find(x => x.idDespesa === d3.idDespesa);
  b.ok(l3.status === "ENVIADO_CONTABILIDADE" && /NF anexada/.test(box()), "Sim: anexada e enviada", l3.status + " · " + box().slice(0, 120));
  b.naoTestavel("o e-mail chegando na contabilidade", "em HML: abrir uma NF de prestador na financeiro@, Anexar e enviar, e conferir em Financeiro › Despesas");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
