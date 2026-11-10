/**
 * ATALHOS NO E-MAIL — FASE 2: RECIBO DIVERSO (10/11/2026). O usuário: "vamos
 * para a fase 2, recibo diverso"; quem recebe o recibo é "quem recebeu do
 * sindicato"; "2 - sim" (só gerar / gerar e enviar); "secretaria e financeiro".
 *
 * Backend real (inclusive o módulo de Recibos Diversos: gerarReciboDiverso,
 * salvarAnexoAssinadoDiverso, enviarReciboDiversoContabilidade), tela real
 * (jsdom), Gmail da financeiro@ FALSO, IA FALSA, dados FICTÍCIOS. O PDF do
 * recibo é falso (o emulador não converte HTML em PDF).
 * Prova: o robô sugere o atalho e preenche com a origem; travas (conferi, CPF,
 * módulo Documentos); "Só gerar" NÃO manda e-mail; "Gerar e enviar" manda ao
 * beneficiário; o recibo assinado que volta acha o recibo pelo número, é
 * anexado, marcado assinado e vai à contabilidade; memória do robô; tela.
 * NÃO PROVA: o PDF do recibo e a entrega dos e-mails (no ar).
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["fin2", g.gerarHashSenha_("Senha@2026"), "Fin Comum",
  "fin2@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "financeiro"]);
const W = b.logar(g, "wanderson"), SEMDOC = b.logar(g, "fin2");
g.recibo_converterHtmlParaPdf_ = (html, nome, pasta) => pasta.createFile(g.Utilities.newBlob("%PDF-1.4 recibo", "application/pdf", nome + ".pdf"));
g.vpeChamarIA_ = prompt => /RECIBO/.test(prompt)
  ? { nome: "João da Silva", documento: "529.982.247-25", valor: "R$ 350,00", descricao: "Compra avulsa de material de escritório", forma: "PIX", pix: "joao@exemplo.com" }
  : {};

let seq = 0;
const pdf = nome => ({ getName: () => nome, getContentType: () => "application/pdf", getSize: () => 40,
  getBytes: () => Buffer.from("%PDF-1.4\n%assinado\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"), copyBlob() { return this; } });
function msg(de, assunto, corpo, anexos) {
  const id = "M" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com", getCc: () => "",
    getSubject: () => assunto, getDate: () => new Date(), getPlainBody: () => corpo, getAttachments: () => anexos || [],
    isUnread: () => true, isStarred: () => false, reply: () => {}, forward: () => {} };
}
const T = [{ id: "p1", msgs: [msg("João da Silva <joao@exemplo.com>", "Dados para pagamento — compra avulsa",
  "Bom dia! Segue meu PIX joao@exemplo.com e CPF 529.982.247-25. Valor de R$ 350,00 referente à compra de material de escritório.")] }];
const th = t => ({ getId: () => t.id, getMessages: () => t.msgs, getFirstMessageSubject: () => t.msgs[0].getSubject() });
g.cxsGmailFinanceiro_ = () => ({ search: () => T.map(th),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? th(t) : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; } });
const limpar = () => g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
limpar();
const mem = t => { const v = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), c = v[0].map(String);
  return v.slice(1).map(l => Object.fromEntries(c.map((k, i) => [k, String(l[i])]))).filter(x => x.TAREFA === t); };

b.fluxo("RECIBO DIVERSO · do e-mail");
b.passo("1. O robô sugere e preenche, com a origem");
let a = g.caixaAtalhos("F:p1", W);
b.ok(a.ok && a.sugeridos.some(s => s.acao === "RECIBO"), "o e-mail de pagamento sugere 'Fazer recibo diverso'", JSON.stringify(a.sugeridos));
const r = g.caixaReciboDoEmail("F:p1", W);
const x = r.recibo;
b.ok(r.ok && x.pagadorNome.valor === "João da Silva" && x.pagadorDoc.valor === "52998224725" && x.valor.valor === "350,00" && x.pixChave.valor === "joao@exemplo.com",
  "nome, CPF, valor e PIX preenchidos", JSON.stringify(r.recibo));
b.ok(/e-mail/.test(x.pagadorDoc.origem) && /remetente/.test(x.email.origem), "cada campo diz de onde veio", x.pagadorDoc.origem + " · " + x.email.origem);
b.ok(!g.caixaReciboDoEmail("F:p1", SEMDOC).ok, "sem o módulo Documentos: não abre");

b.passo("2. Travas");
const base = { pagadorNome: "João da Silva", pagadorDoc: "529.982.247-25", valor: "350,00", descricao: "Compra avulsa", formaPgto: "PIX", pixChave: "joao@exemplo.com", email: "joao@exemplo.com" };
b.ok(!g.caixaReciboGerar("F:p1", Object.assign({}, base), W).ok, "sem 'conferi': não gera");
b.ok(/CPF\/CNPJ/.test(g.caixaReciboGerar("F:p1", Object.assign({}, base, { pagadorDoc: "123", conferi: true }), W).mensagem), "CPF que não confere: não gera");

b.passo("3. Só gerar: sai o recibo, NENHUM e-mail");
let antes = amb.outbox.length;
let gr = g.caixaReciboGerar("F:p1", Object.assign({}, base, { conferi: true, enviar: false, descricao: "Compra avulsa de material de escritório" }), W);
b.ok(gr.ok && /RD-001\/2026/.test(gr.numero), "gerou pelo módulo (número de sempre)", gr.mensagem);
b.igual(amb.outbox.length, antes, "nenhum e-mail saiu");
let h = g.listarHistoricoReciboDiversos({ porPagina: 50 }, W).dados;
b.ok(h.length === 1 && h[0].statusAssinatura === "PENDENTE" && !h[0].email, "está no histórico do módulo, pendente de assinatura");
b.ok(g.cxsEstados_()["F:p1"].ESTADO === "RESOLVIDO", "o e-mail ficou resolvido, com a nota do recibo");
b.ok(mem("recibo-email").some(m => m.ACERTOU === "SIM"), "o robô guardou: preencheu igual ao que foi gerado (acerto)");

b.passo("4. Gerar e enviar: vai ao beneficiário assinar");
antes = amb.outbox.length;
gr = g.caixaReciboGerar("F:p1", Object.assign({}, base, { conferi: true, enviar: true, valor: "120,00" }), W);
b.ok(gr.ok && amb.outbox.length > antes && amb.outbox.slice(antes).some(e => /joao@exemplo\.com/.test(JSON.stringify(e))), "o recibo foi por e-mail ao beneficiário", gr.mensagem);
b.ok(mem("recibo-email").some(m => m.ACERTOU === "NAO"), "o valor mudado fica registrado (o robô aprende)");

b.fluxo("RECIBO DIVERSO · o assinado que volta");
T.push({ id: "p2", msgs: [msg("João da Silva <joao@exemplo.com>", "Re: Recibo RD-001/2026", "Segue o recibo RD-001/2026 assinado.", [pdf("recibo-assinado.pdf")])] });
limpar();
a = g.caixaAtalhos("F:p2", W);
b.ok(a.sugeridos.some(s => s.acao === "RECIBO_ASSINADO"), "sugere 'Recibo assinado → contabilidade'", JSON.stringify(a.sugeridos));
const as = g.caixaReciboAssinadoDoEmail("F:p2", W).assinado;
b.ok(as.escolhida === "RD-001/2026" && /número/.test(as.candidatas[0].motivo), "acha o recibo pelo número citado, com o motivo", JSON.stringify(as.candidatas));
b.ok(as.anexos.some(x => x.sugerido && /assinado/.test(x.nome)), "pré-marca o anexo assinado");
b.ok(!g.caixaReciboAssinadoAnexar("F:p2", { numero: "RD-001/2026", anexo: 0, enviar: true }, W).ok, "sem 'conferi': não anexa");
antes = amb.outbox.length;
const an = g.caixaReciboAssinadoAnexar("F:p2", { numero: "RD-001/2026", anexo: 0, enviar: true, conferi: true }, W);
b.ok(an.ok && an.enviado, "anexou e enviou", an.mensagem);
h = g.listarHistoricoReciboDiversos({ porPagina: 50 }, W).dados.find(r => r.numero === "RD-001/2026");
b.ok(h.statusAssinatura === "ASSINADO" && h.linkAssinado && h.statusContabilidade === "ENVIADO", "no módulo: assinado, com o arquivo, enviado à contabilidade", JSON.stringify([h.statusAssinatura, h.statusContabilidade]));
b.ok(amb.outbox.slice(antes).some(e => /financeiro@sindeducacao\.com/.test(JSON.stringify(e))), "o e-mail foi para a contabilidade (a mesma das Despesas)");
b.ok(!g.caixaReciboAssinadoAnexar("F:p2", { numero: "RD-001/2026", anexo: 0, enviar: false, conferi: true }, W).ok, "o mesmo recibo não é anexado duas vezes");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
T.push({ id: "p3", msgs: [msg("Maria Prestadora <maria@exemplo.com>", "Pagamento do processo", "Segue o PIX para o pagamento do processo. Recibo para a contabilidade.")] });
limpar();
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: W });
(async function () {
  b.fluxo("RECIBO DIVERSO · na tela");
  t.win.cxsIniciar(); await t.assentar(400);
  t.clicar("[data-cxs='abrir'][data-arg='F:p3']"); await t.assentar(300);
  b.ok(/Fazer recibo diverso/.test(t.texto("#cxsMAtalhos")), "o atalho aparece no e-mail", t.texto("#cxsMAtalhos").slice(0, 160));
  t.clicar("#cxsMAtalhos [data-cxs='atalho'][data-arg='RECIBO']"); await t.assentar(300);
  const box = () => t.texto("#cxsMRecibo");
  b.ok(/o robô preencheu/.test(box()) && /← lido no e-mail/.test(box()) && /Só gerar o recibo/.test(box()), "o quadro mostra os campos com a origem e os dois botões", box().slice(0, 200));
  t.clicar("[data-cxs='rdGerar'][data-arg='enviar']"); await t.assentar(50);
  b.ok(!/Sim, gerar e enviar/.test(box()) && /Gerar e enviar ao beneficiário/.test(box()), "sem 'Conferi', não segue para o envio");
  t.doc.getElementById("cxsRdConferi").checked = true;
  t.clicar("[data-cxs='rdGerar'][data-arg='enviar']"); await t.assentar(50);
  b.ok(/enviar para maria@exemplo\.com assinar/.test(box()), "antes de enviar, pergunta dizendo para quem", box().slice(0, 160));
  const ant = amb.outbox.length;
  t.clicar("[data-cxs='rdGerar'][data-arg='enviar-sim']"); await t.assentar(400);
  b.ok(/RD-003\/2026/.test(box()) && amb.outbox.length > ant, "Sim: gerou e enviou ao beneficiário", box().slice(0, 160));
  b.naoTestavel("o PDF do recibo e a entrega dos e-mails", "em HML: abrir um e-mail de pagamento, Atalhos › Fazer recibo diverso, conferir e gerar");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
