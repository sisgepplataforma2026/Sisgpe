/**
 * TESTE (TELA) — "APROVAR SELECIONADAS": UM E-MAIL POR FAMÍLIA
 *
 * Desenho aprovado em 24/11/2026: botão na barra de seleção da Central e janela
 * de conferência com o desconto editável por protocolo. Quem tem mais de um
 * dependente recebe UM e-mail só (VoucherAprovacaoFamilia.gs); a aprovação em si
 * é a de sempre, protocolo a protocolo.
 *
 * PROVA: o DOM e a chamada contra o backend de verdade (jsdom + emulador).
 * NÃO PROVA: a aparência nem o e-mail entregue.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER · aprovar selecionadas — tela");
  b.naoTestavel("tela da Central", "jsdom não instalado — rode: npm install jsdom");
  b.resumo(); process.exit(process.exitCode || 0);
}
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();
g.__cotaEmailRestante = 1500;

function pedir(cpf, nome, email, benef, ordem, aprovar) {
  const r = g.voucherCriarSolicitacao({ cpf, nome, email, modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO", periodo: "2027", regime: "ANUAL",
    tipoBeneficiario: "FILHO", ordemFilho: String(ordem), beneficiario: benef, escola: "COLEGIO ALFA", aprovar: !!aprovar }, TOKEN);
  if (!r.ok) throw new Error("não criou " + benef + ": " + r.mensagem);
  return r.protocolo;
}
function status(p) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(r => String(r[cab.indexOf("NUMERO_PROTOCOLO")]).trim() === p)[0];
  return String(l[cab.indexOf("STATUS_SOLICITACAO")]).trim();
}
const A1 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "MARIA", 1);
const A2 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "JOAO", 2);
const A3 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "PEDRO", 3);
const B1 = pedir("52998224725", "OUTRA FAMILIA", "outra@exemplo.com", "SOLO", 1);
const J = pedir("39053344705", "JA APROVADA", "ja@exemplo.com", "FILHA JA", 1, true);

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
const el = id => doc.getElementById(id);

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(300);

  b.fluxo("VOUCHER · aprovar selecionadas");

  b.passo("1. O botão existe na barra de seleção e mostra quantas estão marcadas");
  b.ok(!!el("certSelAprovar"), "existe #certSelAprovar");
  function marcar(p, v) { const c = doc.querySelector('.cert-sel-linha[data-prot="' + p + '"]'); if (!c) throw new Error("linha não achada: " + p); c.checked = v; c.dispatchEvent(new win.Event("change", { bubbles: true })); }
  [A1, A2, A3, B1, J].forEach(p => marcar(p, true));
  await t.assentar(60);
  b.ok(/\(5\)/.test(el("certSelAprovar").textContent), "o botão mostra a contagem (5)", el("certSelAprovar").textContent);

  b.passo("2. A janela agrupa por família e deixa de fora quem não está em análise");
  t.clicar("#certSelAprovar");
  await t.assentar(80);
  b.ok(el("certLoteAprOverlay").style.display !== "none", "a janela abriu");
  const txt = el("certLoteAprLista").textContent;
  b.ok(/CAMILA ZANI/.test(txt) && /MARIA/.test(txt) && /JOAO/.test(txt) && /PEDRO/.test(txt), "a família da CAMILA aparece com os 3");
  b.ok(/1 e-mail com os 3 protocolos/.test(txt), "e diz que vai UM e-mail com os 3");
  b.ok(/OUTRA FAMILIA/.test(txt) && /SOLO/.test(txt), "a outra família aparece à parte");
  b.ok(/fica de fora/.test(txt) && /FILHA JA/.test(txt), "quem já está aprovada fica de fora, com o motivo");
  b.igual(doc.querySelectorAll("#certLoteAprLista .cert-lote-apr-pct").length, 4, "4 campos de desconto (os elegíveis)");
  b.ok(/4 solicita/.test(el("certLoteAprSub").textContent) && /2 e-mails/.test(el("certLoteAprSub").textContent), "o subtítulo conta: 4 solicitações · 2 e-mails", el("certLoteAprSub").textContent);

  b.passo("3. Desconto inválido barra e NÃO chama o servidor");
  const campos = doc.querySelectorAll("#certLoteAprLista .cert-lote-apr-pct");
  campos[0].value = "700";
  t.clicar("#certLoteAprConfirmar");
  await t.assentar(120);
  b.igual(t.chamadas.filter(c => c.fn === "aprovarSolicitacoesCertBolsaEmLote").length, 0, "nada foi enviado ao servidor");

  b.passo("4. Confirmando: aprova os 4 com 2 e-mails (não 4)");
  b.ok(Array.from(campos).some(c => String(c.value).trim() === ""), "desconto em branco (sem percentual calculado) também barra até ser preenchido");
  const val = { [A1]: "100", [A2]: "70", [A3]: "50", [B1]: "100" };
  Array.from(campos).forEach(c => { c.value = val[c.getAttribute("data-prot")]; });
  doc.getElementById("certLoteAprObs").value = "conferido na reunião";
  amb.outbox.length = 0;
  t.clicar("#certLoteAprConfirmar");
  await t.assentar(500);
  const chamada = t.chamadas.filter(c => c.fn === "aprovarSolicitacoesCertBolsaEmLote").pop();
  b.ok(!!chamada, "chamou aprovarSolicitacoesCertBolsaEmLote");
  b.ok(chamada && chamada.args[0].length === 4 && chamada.args[0].indexOf(J) === -1, "com os 4 elegíveis (sem a já aprovada)", JSON.stringify(chamada && chamada.args[0]));
  b.igual(chamada && chamada.args[1], "conferido na reunião", "e a observação");
  b.igual(chamada && chamada.args[3][A2], "70", "e o desconto editado (70) por protocolo");
  b.ok(chamada && chamada.args[2] === TOKEN, "e o token");
  b.ok([A1, A2, A3, B1].every(p => status(p) === "APROVADO"), "os 4 ficaram APROVADO");
  b.igual(amb.outbox.length, 2, "saíram 2 e-mails");
  b.ok(/✓/.test(el("certLoteAprResumo").textContent) && /2 e-mail/.test(el("certLoteAprResumo").textContent), "a janela mostra o resultado por protocolo", el("certLoteAprResumo").textContent.slice(0, 120));
  b.ok(el("certLoteAprConfirmar").disabled === true, "e o botão de confirmar trava (não aprova duas vezes)");
  b.resumo();
})();
