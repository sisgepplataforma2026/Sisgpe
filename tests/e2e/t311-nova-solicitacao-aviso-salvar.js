/**
 * NOVA SOLICITAÇÃO · AVISO DO SALVAR APAGADO (27/11/2026). Relato: "ele não está permitindo salvar?" — o Salvar fica apagado até escolher Associado/Não associado, que fica no
 * COMEÇO do formulário; quem está no fim não via o motivo. Prova (jsdom): ao abrir, o aviso aparece perto do Salvar; "Ir para o campo" marca o campo; escolher some o aviso e
 * acende o Salvar; reabrir mostra o aviso de novo. NÃO PROVA: o visual real.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("NOVA SOLICITAÇÃO · aviso"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  win.initCertificadoAdmin(); await t.assentar(60);
  b.fluxo("NOVA SOLICITAÇÃO · aviso do Salvar apagado");
  t.clicar("#certBtnNova"); await t.assentar(30);
  b.ok(el("certNvSindAviso").style.display === "block" && /escolha Associado ou Não associado no começo do formulário/.test(el("certNvSindAviso").textContent), "ao abrir, o aviso está à vista perto do Salvar, com o texto combinado");
  b.ok(el("certNvSalvarAnalise").disabled && el("certNvSalvarAprovar").disabled, "e o Salvar segue apagado");
  t.clicar("#certNvSindIr");
  b.ok(el("certNvSindBtns").classList.contains("falta"), "'Ir para o campo' marca o campo da situação sindical");
  t.clicar('#certNvSindBtns [data-v="NAO_ASSOCIADO"]');
  b.ok(el("certNvSindAviso").style.display === "none" && !el("certNvSalvarAprovar").disabled, "escolher some com o aviso e acende o Salvar");
  t.clicar("#certNvCancelar"); t.clicar("#certBtnNova"); await t.assentar(30);
  b.ok(el("certNvSindAviso").style.display === "block", "ao abrir de novo, o aviso volta (a escolha não é herdada)");
  b.resumo(); process.exit(process.exitCode || 0);
})();
