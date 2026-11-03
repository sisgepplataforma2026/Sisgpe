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
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["rhzinho", g.gerarHashSenha_("Senha@2026"), "Só RH",
  "rh@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "rh"]);
const T_SEC = b.logar(g, "marcelha"), T_FIN = b.logar(g, "rhzinho");
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
  b.passo("1. Quem não pode (só RH) vê o cadeado — e nenhum e-mail");
  const tf = montar(T_FIN);
  tf.win.cxsIniciar();
  await tf.assentar(120);
  b.ok(/🔒/.test(tf.texto("#cxsLista") || "") && /Comunicação ou o Financeiro/.test(tf.texto("#cxsLista") || ""), "aparece o cadeado com o motivo");
  b.ok(!/joao@exemplo|Relação de descontos/.test(tf.doc.body.innerHTML), "nenhum e-mail aparece");

  b.fluxo("CAIXA DA SECRETARIA · Tela · trabalhar");
  const t = montar(T_SEC);
  const win = t.win, doc = t.doc, el = id => doc.getElementById(id);
  const itens = () => Array.from(doc.querySelectorAll("#cxsLista .cxs-item-nome")).map(x => x.textContent);
  win.cxsIniciar();
  await t.assentar(150);
  b.passo("2. Cards por tipo e a lista");
  b.ok(doc.querySelector("#cxsTipos .cxs-tipo.todos"), "o card Todos (03/11/2026)");
  const cardsCom = Array.from(doc.querySelectorAll("#cxsTipos .cxs-tipo:not(.todos):not(.voucher):not(.oficio)"));
  /* Os cards de Ofícios (03/11/2026) ficam sempre à vista, numa linha própria. */
  b.igual(doc.querySelectorAll("#cxsTipos .cxs-tipo.oficio").length, 5, "a linha de Ofícios com os 5 cards, mesmo vazios");
  b.ok(cardsCom.length >= 1 && cardsCom.every(c => Number(c.querySelector(".n").textContent) > 0),
    "cards dinâmicos: só os que têm e-mail", cardsCom.map(c => c.textContent).join(" | "));
  /* 31/10/2026, o usuário: "cada um com o seu" — a Marcelha vê a caixa
     secretaria@ inteira (inclusive o que é do Financeiro, em cópia). */
  b.ok(/Caixa de E-mails — secretaria@sindeducacao\.com/.test(t.texto("#cxsTitulo")), "a Marcelha vê a caixa dela",
    t.texto("#cxsTitulo"));
  b.igual(itens().length, 3, "os três e-mails da secretaria@ (a guia também, que ela recebe)");
  t.clicar("#cxsTipos [data-arg='FINANCEIRO']");
  await t.assentar(10);
  b.ok(itens().length === 2 && itens().some(x => /guia/i.test(x)) && itens().some(x => /Relação/.test(x)),
    "card Contribuições: a guia e a relação da escola");
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
  /* 03/11/2026: "quero cancelar a filiação" é pedido de ofício de desfiliação. */
  b.igual(el("cxsMTipo").value, "OFICIO_DESFILIACAO", "o tipo: ofício de desfiliação (pela regra da secretaria@)");
  b.ok(/Olá, João!/.test(el("cxsMResposta").value), "resposta com saudação, para editar");
  b.ok(el("cxsMModulo").style.display !== "none" && /Of[ií]cio/i.test(el("cxsMModulo").textContent), "atalho para o módulo certo (Ofícios)", el("cxsMModulo").textContent);

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
