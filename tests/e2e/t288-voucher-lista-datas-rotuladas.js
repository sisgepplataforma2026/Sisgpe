/**
 * TESTE — A LISTA DE VOUCHERS DIZ O QUE CADA DATA É (Solicitado / Emitido / Enviado)
 *
 * Pedido do usuário (24/11/2026): "tem que ter a informação de quando foi enviado" — a lista só tinha a data sem rótulo sob o protocolo,
 * lida como "emitido". Desenho aprovado: "Solicitado: …" sob o protocolo; na coluna Situação e envio, "Emitido: …" e
 * "✔ Enviado: … por … · para …" (ou "○ Ainda não enviado"). Envio de verdade, lido do histórico permanente — nada simulado na lista.
 * NÃO PROVA: a aparência (jsdom não aplica CSS).
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.fluxo("VOUCHER · lista com as datas rotuladas");
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const base = { EMAIL: "assoc@exemplo.com", ESCOLA_SELECIONADA: "Colégio Exemplo", MODALIDADE: "ENSINO_FUNDAMENTAL", PERIODO_REFERENCIA: "2027", STATUS_SOLICITACAO: "EMITIDO", TIPO_BENEFICIARIO: "FILHO", NOME_SOLICITANTE: "TITULAR EXEMPLO", CPF_SOLICITANTE: "11144477735" };
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S1", NUMERO_PROTOCOLO: "BOLSA-2026-100001", NOME_BENEFICIARIO: "JA ENVIADA", ORDEM_FILHO: "1" });
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S2", NUMERO_PROTOCOLO: "BOLSA-2026-100002", NOME_BENEFICIARIO: "NAO ENVIADA", ORDEM_FILHO: "2" });
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S3", NUMERO_PROTOCOLO: "BOLSA-2026-100003", NOME_BENEFICIARIO: "SO SOLICITADA", ORDEM_FILHO: "3", STATUS_SOLICITACAO: "APROVADO" });
["100001", "100002"].forEach((n) => gravar("Voucher_Emitidos", { ID_EMISSAO: "E" + n, DATA_EMISSAO: new Date(2026, 10, 24, 8, 12), PROTOCOLO: "BOLSA-2026-" + n, TIPO_DOCUMENTO: "CERTIFICADO", USUARIO: "wanderson" }));
g.voucherHistoricoAnotar_("BOLSA-2026-100001", "ENVIO_EMAIL", "marcela@sindeducacao.com", "assoc@exemplo.com · e-mail único com 2 certificados");

b.passo("1. SERVIDOR: a lista traz a data de emissão (com hora) só de quem foi emitido");
const lista = g.listarSolicitacoesCertBolsa(TOKEN);
const L = {}; lista.forEach((x) => { L[x.protocolo] = x; });
b.ok(/^24\/11\/2026 08:12$/.test(L["BOLSA-2026-100001"].emitidoEm), "emitido: data e hora", L["BOLSA-2026-100001"].emitidoEm);
b.igual(L["BOLSA-2026-100003"].emitidoEm, "", "nunca emitido: vazio (não afirma emissão que não houve)");
b.ok(L["BOLSA-2026-100001"].envio && L["BOLSA-2026-100001"].envio.situacao === "ENVIADO", "o envio real vem do histórico");

if (!dom.jsdomDisponivel()) { b.naoTestavel("tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win;
  win.initCertificadoAdmin();
  await t.assentar(120);
  const tr = (p) => doc.querySelector('#certTbody tr[data-prot="' + p + '"]');
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  b.passo("2. A data sob o protocolo diz que é a da SOLICITAÇÃO");
  b.ok(/^Solicitado: /.test(txt(tr("BOLSA-2026-100001").querySelector(".cert-sol-data"))), "rótulo 'Solicitado:'", txt(tr("BOLSA-2026-100001").querySelector(".cert-sol-data")));

  b.passo("3. Enviado: 'Emitido: …' e '✔ Enviado: … por … · para …'");
  const c1 = txt(tr("BOLSA-2026-100001").querySelector(".c-sit .cert-env"));
  b.ok(/24\/11\/2026\s*08:12/.test(txt(tr("BOLSA-2026-100001").querySelector(".c-emi"))), "diz quando foi emitido (coluna Emissão, desde 27/11/2026)", txt(tr("BOLSA-2026-100001").querySelector(".c-emi")));
  b.ok(/✔ Enviado: \d\d\/\d\d\/\d{4} \d\d:\d\d/.test(c1), "diz quando foi enviado, com o rótulo", c1);
  b.ok(/por marcela · para assoc@exemplo\.com/.test(c1), "por quem e para onde", c1);

  b.passo("4. Emitido e não enviado: 'Ainda não enviado'");
  const c2 = txt(tr("BOLSA-2026-100002").querySelector(".c-sit .cert-env"));
  /* 26/11/2026 (desenho aprovado): emitido e sem envio de uma solicitação com a situação sindical EM BRANCO mostra o aviso no lugar de
   "Ainda não enviado"; com ASSOCIADO mostra "✉ Aguardando envio por e-mail" (coberto em t293). Esta linha do teste tem a situação em branco. */
  b.ok(/24\/11\/2026\s*08:12/.test(txt(tr("BOLSA-2026-100002").querySelector(".c-emi"))) && /Situação sindical em branco — defina para saber como entregar/.test(c2), "emissão à vista e o aviso de situação sindical em branco", c2);

  b.passo("5. Nunca emitido: sem 'Emitido:' (não afirma o que não houve)");
  const c3 = txt(tr("BOLSA-2026-100003").querySelector(".c-sit .cert-env"));
  b.ok(txt(tr("BOLSA-2026-100003").querySelector(".c-emi")) === "—" && /Ainda não enviado/.test(c3), "coluna Emissão com '—' e só 'Ainda não enviado'", c3);

  b.passo("6. O CSV exportado separa Solicitado em / Emitido em / Enviado em");
  const fonte = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");
  b.ok(/'Status','Solicitado em','Emitido em',\s*'Situação do envio','Enviado em','Enviado por','Enviado para'/.test(fonte), "cabeçalho do CSV com as três datas");
  b.resumo();
})();
