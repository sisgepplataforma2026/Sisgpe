/**
 * NOVA SOLICITAÇÃO · ESCOLHA EXPLÍCITA ASSOCIADO / NÃO ASSOCIADO (tela) — pedido do usuário, 27/11/2026.
 * Prova (jsdom): abre SEM nada marcado; Salvar apagado até escolher; o clique grava a escolha no campo que vai ao servidor;
 * reabrir limpa. O e-mail escondido no modal de envio NÃO é testado aqui.
 * NÃO PROVA: o visual real no navegador (ver captura) nem o envio de e-mail.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("NOVA SOLICITAÇÃO · escolha sindical"); b.naoTestavel("tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
const el = (id) => doc.getElementById(id);
(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);
  b.fluxo("NOVA SOLICITAÇÃO · escolha sindical na tela");
  t.clicar("#certBtnNova");
  await t.assentar(30);
  b.passo("1. abre sem nada marcado");
  b.igual(el("certNvSituacao").value, "", "o campo nasce em branco");
  b.igual(doc.querySelectorAll("#certNvSindBtns .cert-nv-sind-b.on").length, 0, "nenhum botão aceso");
  b.ok(el("certNvSalvarAnalise").disabled && el("certNvSalvarAprovar").disabled, "os dois Salvar nascem apagados");
  b.passo("2. escolher grava e acende");
  t.clicar('#certNvSindBtns [data-v="NAO_ASSOCIADO"]');
  b.igual(el("certNvSituacao").value, "NAO_ASSOCIADO", "Não associado vai para o campo");
  b.ok(!el("certNvSalvarAnalise").disabled && !el("certNvSalvarAprovar").disabled, "Salvar acende");
  t.clicar('#certNvSindBtns [data-v="ASSOCIADO"]');
  b.igual(el("certNvSituacao").value, "ASSOCIADO", "trocar para Associado");
  b.igual(doc.querySelectorAll("#certNvSindBtns .cert-nv-sind-b.on").length, 1, "só um botão aceso");
  b.passo("3. reabrir limpa a escolha (não herda do atendimento anterior)");
  t.clicar("#certNvCancelar");
  t.clicar("#certBtnNova");
  await t.assentar(30);
  b.igual(el("certNvSituacao").value, "", "campo em branco de novo");
  b.ok(el("certNvSalvarAprovar").disabled, "Salvar apagado de novo");
  b.passo("4. e-mail escondido para não associado sem envio");
  b.naoTestavel("esconder o e-mail do modal de envio para não associado", "o estado fica dentro do escopo da tela; só captura/uso real prova");
  b.resumo(); process.exit(process.exitCode || 0);
})();
