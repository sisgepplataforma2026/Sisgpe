/**
 * TESTE (TELA) — BOTÃO EDITAR NA LISTA DE VOUCHERS
 *
 * Pedido do usuário (24/11/2026): "Preciso do botão editar, pois caso tenha esquecido de alguma informação eu consigo editar".
 * PROVA: botão na linha, janela preenchida com o que está gravado, só o que mudou é enviado, o servidor grava, emitido mostra o aviso
 * e o "refazer o certificado", e a janela está no CSS padrão da tela (cada janela precisa do id dentro das regras — falhou uma vez).
 * NÃO PROVA: a aparência real.
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.fluxo("VOUCHER · Editar na lista");
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const r = g.voucherCriarSolicitacao({ cpf: "11144477735", nome: "TITULAR EXEMPLO", email: "t@x.com", modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO",
  periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1", beneficiario: "FILHA UM", escola: "COLEGIO ALFA", aprovar: true }, TOKEN);
const P = r.protocolo;
const r2 = g.voucherCriarSolicitacao({ cpf: "52998224725", nome: "OUTRO TITULAR", email: "o@x.com", modalidade: "ENSINO_MEDIO", curso: "1 ANO",
  periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1", beneficiario: "DEP EMITIDO", escola: "COLEGIO ALFA", aprovar: true }, TOKEN);
(function () {   // emissão de verdade na aba, para a linha ser EMITIDO com data de emissão
  const sh = ss.getSheetByName("Voucher_Emitidos");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(x => ({ ID_EMISSAO: "EMI-9", DATA_EMISSAO: new Date(2026, 10, 24, 8, 12), PROTOCOLO: r2.protocolo, TIPO_DOCUMENTO: "CERTIFICADO", CODIGO_VALIDACAO: "COD9", PERCENTUAL: "70" }[x] || ""))]);
})();
function celula(col) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(x => String(x[cab.indexOf("NUMERO_PROTOCOLO")]).trim() === P)[0];
  return String(l[cab.indexOf(col)]);
}
if (!dom.jsdomDisponivel()) { b.naoTestavel("tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
  win.initCertificadoAdmin();
  await t.assentar(120);
  const tr = doc.querySelector('#certTbody tr[data-prot="' + P + '"]');

  b.passo("1. A linha tem o botão Editar (o lápis) e o Ver/Ações virou olho");
  b.ok(!!tr.querySelector(".cert-btn-editar") && /Editar/.test(tr.querySelector(".cert-btn-editar").title), "botão Editar presente, com o título");
  b.ok(!!tr.querySelector(".cert-btn-abrir-modal"), "e o Ver / Ações continua");

  b.passo("2. Clicar abre a janela já preenchida");
  t.clicar(tr.querySelector(".cert-btn-editar")); await t.assentar(200);
  b.ok(el("certEditOverlay").style.display === "flex", "janela aberta");
  b.igual(el("certEd_email").value, "t@x.com", "e-mail preenchido"); b.igual(el("certEd_beneficiario").value, "FILHA UM", "beneficiário preenchido");
  b.igual(el("certEd_curso").value, "6 ANO", "curso preenchido"); b.igual(el("certEd_modalidade").value, "ENSINO_FUNDAMENTAL", "modalidade (lista) selecionada");
  b.ok(["nome", "cpf", "telefone", "escola", "cnpjEscola", "instituicao", "cnpjInstituicao", "emailInstituicao", "area", "regime", "periodo", "percentual", "ordemFilho", "tipoBeneficiario"].every(k => !!el("certEd_" + k)), "todos os campos do formulário estão na janela");
  b.ok(el("certEditRefazerBox").style.display === "none", "não emitido: sem 'refazer o certificado'");

  b.passo("3. Sem mudar nada, Salvar avisa e NÃO chama o servidor");
  const antes = t.chamadas.filter(c => c.fn === "voucherEditarSolicitacao").length;
  t.clicar("#certEditSalvar"); await t.assentar(80);
  b.igual(t.chamadas.filter(c => c.fn === "voucherEditarSolicitacao").length, antes, "nenhuma chamada");

  b.passo("4. Mudar e-mail e curso: manda SÓ esses dois, o servidor grava, a janela fecha");
  t.digitar("#certEd_email", "novo@x.com"); t.digitar("#certEd_curso", "7 ANO");
  t.clicar("#certEditSalvar"); await t.assentar(350);
  const ch = t.chamadas.filter(c => c.fn === "voucherEditarSolicitacao").pop();
  b.ok(ch && ch.args[0] === P && JSON.stringify(Object.keys(ch.args[1]).sort()) === '["curso","email"]', "só os campos mudados", ch && JSON.stringify(ch.args[1]));
  b.igual(celula("EMAIL"), "novo@x.com", "e-mail gravado na planilha"); b.igual(celula("CURSO"), "7 ANO", "curso gravado");
  b.ok(el("certEditOverlay").style.display === "none", "janela fechada");

  b.passo("5. Erro do servidor aparece NA JANELA e ela continua aberta");
  const tr2 = doc.querySelector('#certTbody tr[data-prot="' + P + '"]');
  t.clicar(tr2.querySelector(".cert-btn-editar")); await t.assentar(200);
  t.digitar("#certEd_email", "isso-nao-e-email"); t.clicar("#certEditSalvar"); await t.assentar(300);
  b.ok(el("certEditOverlay").style.display === "flex" && /inválido/.test(el("certEditErro").textContent), "mostra o motivo e não fecha", el("certEditErro").textContent);
  b.igual(celula("EMAIL"), "novo@x.com", "e nada foi gravado");

  b.passo("5b. Voucher EMITIDO: avisa que o certificado muda e oferece refazer (marcado)");
  t.clicar("#certEditCancelar"); await t.assentar(40);
  const trE = doc.querySelector('#certTbody tr[data-prot="' + r2.protocolo + '"]');
  t.clicar(trE.querySelector(".cert-btn-editar")); await t.assentar(250);
  b.ok(el("certEditAviso").style.display === "block" && /emitido/.test(el("certEditAviso").textContent) && /24\/11\/2026/.test(el("certEditAviso").textContent), "aviso de emitido, com a data", el("certEditAviso").textContent.slice(0, 120));
  b.ok(el("certEditRefazerBox").style.display !== "none" && el("certEditRefazer").checked === true, "'Refazer o certificado' vem marcado");
  t.digitar("#certEd_curso", "2 ANO"); t.clicar("#certEditSalvar"); await t.assentar(350);
  const che = t.chamadas.filter(c => c.fn === "voucherEditarSolicitacao").pop();
  b.ok(che && che.args[0] === r2.protocolo && che.args[2].refazerCertificado === true, "pede ao servidor para refazer", che && JSON.stringify(che.args[2]));

  b.passo("6. A janela está no CSS padrão (id dentro das regras de cabeçalho, corpo, rodapé e campos)");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");
  ["head", "body", "foot", "title", "close"].forEach(k => b.ok(css.indexOf("#certEditBox .cert-modal-" + k) > -1, "regra .cert-modal-" + k));
  ["campo", "lbl", "input", "check"].forEach(k => b.ok(css.indexOf("#certEditBox .cert-env-" + k) > -1, "regra .cert-env-" + k));
  b.resumo();
})();
