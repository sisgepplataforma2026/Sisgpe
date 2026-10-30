/**
 * CAIXA DA SECRETARIA — A TELA (29/10/2026). DOM real (jsdom), backend
 * real, leitor real, cliques reais, dados FICTÍCIOS.
 *
 * Prova: quem não pode vê o cadeado (e nenhum e-mail); quem pode vê os
 * cards por tipo, filtra, abre a conversa, corrige o tipo, responde (sai
 * só pelo clique, na fila da Secretaria) e marca como resolvido.
 *
 * NÃO PROVA: aparência, a entrega do e-mail.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) {
  b.fluxo("CAIXA DA SECRETARIA · Tela");
  b.naoTestavel("tela da Caixa da Secretaria", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha",
  "secretaria@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios,caixaSecretaria"]);
const T_SEC = b.logar(g, "marcelha"), T_FIN = b.logar(g, "rogerio");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);
const thFil = SIM.novaThread("Quero me desfiliar", "João <joao@exemplo.com>", "Quero cancelar a filiação. TIPO:FILIACAO");
const thEsc = SIM.novaThread("Relação de descontos", "rh@colegio.exemplo.com", "Segue a relação do mês. TIPO:OFICIO_ESCOLA",
  [SIM.pdf("relacao.pdf")]);
const thGuia = SIM.novaThread("Segunda via da guia", "contador@escola.exemplo.com", "Preciso da guia. TIPO:FINANCEIRO");
SIM.ciclo();

function montar(token) {
  const t = dom.montar(g, ["CaixaSecretariaUI.html"], { token });
  return t;
}

(async function () {
  b.fluxo("CAIXA DA SECRETARIA · Tela · a trava");
  b.passo("1. Quem não pode vê o cadeado — e nenhum e-mail");
  const tf = montar(T_FIN);
  tf.win.cxsIniciar();
  await tf.assentar(120);
  b.ok(/🔒/.test(tf.texto("#cxsLista") || "") && /só para a Secretaria/.test(tf.texto("#cxsLista") || ""), "aparece o cadeado com o motivo");
  b.ok(!/joao@exemplo|Relação de descontos/.test(tf.doc.body.innerHTML), "nenhum e-mail aparece");

  b.fluxo("CAIXA DA SECRETARIA · Tela · trabalhar");
  const t = montar(T_SEC);
  const win = t.win, doc = t.doc, el = id => doc.getElementById(id);
  const itens = () => Array.from(doc.querySelectorAll("#cxsLista .cxs-item-nome")).map(x => x.textContent);
  win.cxsIniciar();
  await t.assentar(150);
  b.passo("2. Cards por tipo e a lista");
  b.ok(doc.querySelectorAll("#cxsTipos .cxs-tipo").length >= 7, "um card por tipo (+ o atalho do Voucher)");
  b.igual(itens().length, 3, "três e-mails");
  t.clicar("#cxsTipos [data-arg='FINANCEIRO']");
  await t.assentar(10);
  b.ok(itens().length === 1 && /guia/i.test(itens()[0]), "card Financeiro filtra só a guia");
  t.clicar("#cxsTipos [data-arg='FINANCEIRO']");
  await t.assentar(10);
  t.marcar("#cxsFAnexo", true);
  await t.assentar(10);
  b.ok(itens().length === 1 && /Relação/.test(itens()[0]), "'só com anexo' deixa a relação da escola");
  t.clicar("[data-cxs='limpar']");
  await t.assentar(10);
  t.digitar("#cxsBusca", "desfiliar");
  await t.assentar(10);
  b.igual(itens().length, 1, "a busca acha o João");
  t.digitar("#cxsBusca", "");
  await t.assentar(10);

  b.passo("3. Abrir: a conversa, o tipo e a resposta pronta para editar");
  win.CXS.abrir(thFil.id);
  await t.assentar(120);
  b.ok(el("cxsModal").classList.contains("aberto"), "abriu");
  b.ok(/cancelar a filia/.test(t.texto("#cxsMMensagens") || ""), "a mensagem do João");
  b.igual(el("cxsMTipo").value, "FILIACAO", "o tipo sugerido pela IA");
  b.ok(/Olá, João!/.test(el("cxsMResposta").value), "resposta com saudação, para editar");
  b.ok(el("cxsMModulo").style.display !== "none" && /Filia/.test(el("cxsMModulo").textContent), "atalho para o módulo certo");

  b.passo("4. Responder: sai só pelo clique, na fila da Secretaria");
  const out0 = amb.outbox.length;
  t.digitar("#cxsMResposta", "Olá, João! Recebemos seu pedido e vamos processar a desfiliação.");
  t.clicar("[data-cxs='responder']");
  await t.assentar(150);
  b.ok(t.chamadas.some(c => c.fn === "caixaSecretariaResponder"), "chamou o servidor");
  b.igual(amb.outbox.length, out0, "nada saiu direto do SISGEP");
  SIM.ciclo();
  b.ok(amb.outbox.slice(out0).some(m => m.via === "reply" && m.to === "joao@exemplo.com"), "o leitor mandou como resposta ao João");

  b.passo("5. Corrigir o tipo e marcar como resolvido");
  win.CXS.abrir(thGuia.id);
  await t.assentar(120);
  t.escolher("#cxsMTipo", "OUTRO");
  t.clicar("[data-cxs='reclassificar']");
  await t.assentar(150);
  b.ok(t.chamadas.some(c => c.fn === "caixaSecretariaReclassificar" && c.args[1] === "OUTRO"), "tipo corrigido para Outro");
  t.digitar("#cxsMNota", "Guia mandada pelo financeiro.");
  t.clicar("[data-cxs='resolver']");
  await t.assentar(150);
  b.ok(t.chamadas.some(c => c.fn === "caixaSecretariaMarcar" && c.args[1] === "RESOLVIDO" && /financeiro/.test(c.args[2])),
    "resolvido, com a nota");
  b.ok(!itens().some(n => /guia/i.test(n)), "sai da lista 'a resolver'");

  b.naoTestavel("aparência", "jsdom não desenha — conferir no navegador");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
