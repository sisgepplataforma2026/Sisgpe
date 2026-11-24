/**
 * TESTE — APROVAR VÁRIOS DEPENDENTES SAI NUM E-MAIL SÓ (VoucherAprovacaoFamilia.gs)
 *
 * Pedido do usuário (24/11/2026): e-mail único ao solicitante para certificado E
 * aprovação. A aprovação continua protocolo a protocolo, com todas as travas;
 * só o e-mail é por grupo (mesmo titular e destino).
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();
g.__cotaEmailRestante = 1500;

function pedir(cpf, nome, email, benef, ordem) {
  const r = g.voucherCriarSolicitacao({ cpf, nome, email, modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO", periodo: "2027", regime: "ANUAL",
    tipoBeneficiario: "FILHO", ordemFilho: String(ordem), beneficiario: benef, escola: "COLEGIO ALFA", aprovar: false }, ADM);
  if (!r.ok) throw new Error("não criou " + benef + ": " + r.mensagem);
  return r.protocolo;
}
function status(p) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(r => String(r[cab.indexOf("NUMERO_PROTOCOLO")]).trim() === p)[0];
  return String(l[cab.indexOf("STATUS_SOLICITACAO")]).trim();
}
const texto = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const A1 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "MARIA", 1);
const A2 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "JOAO", 2);
const A3 = pedir("11144477735", "CAMILA ZANI", "camila@exemplo.com", "PEDRO", 3);
const B1 = pedir("52998224725", "OUTRA FAMILIA", "outra@exemplo.com", "SOLO", 1);

b.fluxo("VOUCHER · aprovação em lote, e-mail único");

b.passo("1. 3 dependentes de uma família + 1 de outra: 2 e-mails, não 4");
amb.outbox.length = 0;
const r = g.aprovarSolicitacoesCertBolsaEmLote([A1, A2, A3, B1], "conferido", ADM);
b.ok(r.ok && r.aprovados === 4, "aprovou os 4", r.mensagem);
b.igual(amb.outbox.length, 2, "saíram 2 e-mails (eram 4)");
b.ok([A1, A2, A3, B1].every(p => status(p) === "APROVADO"), "e os 4 ficaram APROVADO na planilha");
const fam = amb.outbox.find(m => m.to === "camila@exemplo.com");
b.ok(fam && [A1, A2, A3].every(p => fam.subject.indexOf(p) > -1), "o e-mail da família cita os 3 protocolos", fam && fam.subject);
const t = texto(fam.htmlBody);
b.ok(/MARIA/.test(t) && /JOAO/.test(t) && /PEDRO/.test(t), "com cada beneficiário na tabela");
b.ok(!/SOLO/.test(t), "sem misturar a outra família");
const solo = amb.outbox.find(m => m.to === "outra@exemplo.com");
b.ok(solo && /Bolsa aprovada/.test(solo.subject) && solo.subject.indexOf(B1) > -1, "quem tem um só recebe o e-mail de sempre", solo && solo.subject);

b.passo("2. Uma recusada não derruba as outras");
const C1 = pedir("39053344705", "TERCEIRA FAMILIA", "t@exemplo.com", "FILHO UM", 1);
const C2 = pedir("39053344705", "TERCEIRA FAMILIA", "t@exemplo.com", "FILHO DOIS", 2);
amb.outbox.length = 0;
const rr = g.aprovarSolicitacoesCertBolsaEmLote([C1, C2], "ok", ADM, { [C2]: "700" });
b.ok(rr.ok && rr.aprovados === 1, "aprovou 1 (o desconto 700% é recusado pela trava de sempre)", rr.mensagem);
b.ok(rr.resultados.find(x => x.protocolo === C2 && !x.ok && /entre 1 e 100/.test(x.mensagem)), "e o motivo vem no item");
b.igual(amb.outbox.length, 1, "um e-mail, do que foi aprovado");
b.ok(status(C1) === "APROVADO" && status(C2) !== "APROVADO", "só o C1 foi aprovado");

b.passo("3. A aprovação INDIVIDUAL continua mandando o e-mail de sempre");
const D1 = pedir("27595487040", "UNICA FAMILIA", "u@exemplo.com", "UNICO", 1);
amb.outbox.length = 0;
const ri = g.aprovarSolicitacaoCertBolsaComEmail(D1, "ok", ADM, "");
b.ok(ri.ok, "aprovou", ri.mensagem);
b.igual(amb.outbox.length, 1, "e o e-mail individual saiu");
b.ok(!ri.registro, "e a resposta pública NÃO devolve o registro interno");
b.resumo();
