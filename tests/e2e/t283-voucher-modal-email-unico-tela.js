/**
 * TESTE (TELA) — O MODAL DE ENVIO OFERECE O E-MAIL ÚNICO
 *
 * Pedido do usuário (24/11/2026): "quando tiver mais dependentes deve sair um
 * único e-mail para o solicitante". O modal descobre os outros certificados
 * prontos do mesmo associado e oferece incluí-los — NADA vem marcado sozinho:
 * incluir é escolha de quem envia.
 *
 * PROVA: o DOM do modal contra o backend de verdade (emulador). NÃO PROVA: a
 * aparência (jsdom não desenha) nem o navegador real.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER · modal de envio — e-mail único");
  b.naoTestavel("tela do modal de envio", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();
g.__cotaEmailRestante = 1500;

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(c => (campos[c] !== undefined ? campos[c] : ""))]);
}
function semear(proto, cpf, benef, extras) {
  gravar("Voucher_Solicitacoes", Object.assign({
    ID_SOLICITACAO: "SOL-" + proto, CPF_SOLICITANTE: cpf, NOME_SOLICITANTE: "CAMILA ZANI", EMAIL: "camila@exemplo.com",
    NOME_BENEFICIARIO: benef, TIPO_BENEFICIARIO: "FILHO", INSTITUICAO_ENSINO: "COLEGIO ALFA", CURSO: "Curso " + benef,
    PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70", REGIME: "SEMESTRAL", SITUACAO_SINDICAL: "ASSOCIADO",
    STATUS_SOLICITACAO: "EMITIDO", NUMERO_PROTOCOLO: proto }, extras || {}));
  gravar("Voucher_Emitidos", { ID_EMISSAO: "EMI-" + proto, DATA_EMISSAO: "23/11/2026 10:30", PROTOCOLO: proto, ID_SOLICITACAO: "SOL-" + proto,
    NOME_SOLICITANTE: "CAMILA ZANI", CPF: cpf, TIPO_DOCUMENTO: "CERTIFICADO", CODIGO_VALIDACAO: "COD" + proto.slice(-3),
    LINK_ARQUIVO: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view", PERCENTUAL: "70", USUARIO: "wanderson" });
}
const A = "BOLSA-2026-000111", B = "BOLSA-2026-000222", C = "BOLSA-2026-000333", Z = "BOLSA-2026-000999";
semear(A, "11144477735", "MARIA");
semear(B, "11144477735", "JOAO");
semear(C, "11144477735", "PEDRO");
semear(Z, "52998224725", "SOZINHO", { NOME_SOLICITANTE: "OUTRA FAMILIA", EMAIL: "outra@exemplo.com" });

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
const el = id => doc.getElementById(id);

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);

  b.fluxo("VOUCHER · modal de envio — e-mail único");

  b.passo("1. Quem tem outros certificados prontos vê o convite — e eles JÁ VÊM MARCADOS (e-mail único é o padrão)");
  win.certAbrirEnvio(A);
  await t.assentar(200);
  ok_(el("certEnvIrmaos").style.display !== "none", "o bloco dos outros certificados aparece");
  const caixas = doc.querySelectorAll("#certEnvIrmaosLista .cert-env-irmao");
  b.igual(caixas.length, 2, "com 2 certificados oferecidos (JOAO e PEDRO)");
  b.ok(Array.from(caixas).every(c => c.checked === true), "todos vêm marcados (mesmo e-mail do associado): saem juntos num e-mail só");
  const txt = doc.getElementById("certEnvIrmaosLista").textContent;
  b.ok(/JOAO/.test(txt) && /PEDRO/.test(txt) && !/MARIA/.test(txt), "mostra os irmãos, não o próprio protocolo");
  b.ok(!/SOZINHO/.test(txt), "e não mostra o de outra família");

  b.passo("2. DESMARCANDO os outros, o envio é o de SEMPRE (voucherEnviarPorEmail, um e-mail)");
  caixas.forEach(c => { c.checked = false; });
  amb.outbox.length = 0;
  t.clicar("#certEnvBtnEmail");
  await t.assentar(250);
  const individual = t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").pop();
  b.ok(!!individual && individual.args[0] === A, "chamou o envio individual do protocolo certo");
  b.ok(!t.chamadas.some(c => c.fn === "voucherEnviarFamiliaPorEmail"), "e NÃO chamou o e-mail único");
  b.igual(amb.outbox.length, 1, "saiu 1 e-mail");

  b.passo("3. Clicando em Enviar sem mexer em nada, sai UM e-mail com os certificados da família");
  win.certAbrirEnvio(B);
  await t.assentar(200);
  const caixas2 = doc.querySelectorAll("#certEnvIrmaosLista .cert-env-irmao");
  b.ok(caixas2.length >= 1 && Array.from(caixas2).some(c => c.value === C), "o PEDRO continua oferecido (ainda não foi enviado)");
  b.ok(!Array.from(caixas2).some(c => c.value === A), "e a MARIA, já enviada, não é oferecida de novo");
  b.ok(Array.from(caixas2).every(c => c.checked === true), "já vêm marcados, sem a pessoa fazer nada");
  amb.outbox.length = 0;
  t.clicar("#certEnvBtnEmail");
  await t.assentar(300);
  const fam = t.chamadas.filter(c => c.fn === "voucherEnviarFamiliaPorEmail").pop();
  b.ok(!!fam, "chamou voucherEnviarFamiliaPorEmail");
  b.ok(fam && fam.args[0][0] === B && fam.args[0].indexOf(C) > -1, "com o protocolo aberto e o marcado", JSON.stringify(fam && fam.args[0]));
  b.ok(fam && fam.args[2] === TOKEN, "e com o token");
  b.igual(amb.outbox.length, 1, "saiu UM e-mail");
  b.ok(amb.outbox[0] && /JOAO|PEDRO/.test(amb.outbox[0].subject + amb.outbox[0].htmlBody), "com os dois certificados");

  b.passo("4. Sem outros certificados prontos, o bloco não aparece");
  win.certAbrirEnvio(Z);
  await t.assentar(200);
  ok_(el("certEnvIrmaos").style.display === "none", "o bloco fica escondido");

  b.passo("5. Trocar de protocolo limpa o convite do anterior");
  win.certAbrirEnvio(C);
  await t.assentar(30);
  b.igual(doc.querySelectorAll("#certEnvIrmaosLista .cert-env-irmao").length, 0, "a lista é limpa ao abrir outro (nada do protocolo anterior)");
  b.resumo();
  function ok_(c, m) { b.ok(!!c, m); }
})();
