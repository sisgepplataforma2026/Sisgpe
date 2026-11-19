/**
 * PROTOCOLO SEQUENCIAL A PARTIR DE 01/2027 (decisão do usuário, 19/11/2026). Até 31/12/2026 o número segue sorteado como sempre; de 2027 em
 * diante vira BOLSA-2027-000001, 000002… (recomeça a cada ano), sob trava, e nunca repete — nem se o contador guardado se perder (a planilha
 * segura). Dados FICTÍCIOS. NÃO PROVA: duas execuções simultâneas de verdade (o emulador roda uma de cada vez).
 */
const b = require("./base");
const { g } = b.subir({});
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(campos) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const d = (iso) => new Date(iso);
const props = () => g.PropertiesService.getScriptProperties();

b.fluxo("PROTOCOLO · até 2026 sorteado, como sempre");
for (let i = 0; i < 40; i++) {
  const p = g.gerarNumeroProtocolo_(false, d("2026-12-31T12:00:00-03:00"));
  if (!/^BOLSA-2026-[1-9]\d{5}$/.test(p)) { b.ok(false, "formato de 2026 mudou: " + p); break; }
  if (i === 39) b.ok(true, "40 protocolos de 2026: BOLSA-2026-NNNNNN, 6 dígitos de 100000 a 999999 (sorteio, como hoje)");
}
b.ok(props().getProperty("VOUCHER_PROTOCOLO_SEQ_2026") === null, "em 2026 nenhum contador é criado");

b.fluxo("PROTOCOLO · a partir de 01/01/2027 é sequencial");
const seq = [1, 2, 3].map(() => g.gerarNumeroProtocolo_(false, d("2027-01-01T08:00:00-03:00")));
b.ok(seq.join(",") === "BOLSA-2027-000001,BOLSA-2027-000002,BOLSA-2027-000003", "1º, 2º e 3º de 2027: 000001, 000002, 000003", seq.join(" "));
b.ok(props().getProperty("VOUCHER_PROTOCOLO_SEQ_2027") === "3", "o contador guardado está em 3");

b.fluxo("PROTOCOLO · nunca repete: se o contador se perder, a planilha segura");
gravar({ ID_SOLICITACAO: "SOL-1", NUMERO_PROTOCOLO: "BOLSA-2027-000007" });
gravar({ ID_SOLICITACAO: "SOL-2", NUMERO_PROTOCOLO: "BOLSA-2026-480404" });   // de outro ano: não conta
gravar({ ID_SOLICITACAO: "SOL-3", NUMERO_PROTOCOLO: "BOLSA-2027-000004" });
props().deleteProperty("VOUCHER_PROTOCOLO_SEQ_2027");                         // simula contador perdido
const apos = g.gerarNumeroProtocolo_(false, d("2027-03-10T09:00:00-03:00"));
b.ok(apos === "BOLSA-2027-000008", "contador perdido: segue do maior já gravado (000007) → 000008", apos);
const apos2 = g.gerarNumeroProtocolo_(false, d("2027-03-10T09:01:00-03:00"));
b.ok(apos2 === "BOLSA-2027-000009", "e continua: 000009", apos2);

b.fluxo("PROTOCOLO · recomeça em cada ano");
const a28 = g.gerarNumeroProtocolo_(false, d("2028-01-02T10:00:00-03:00"));
b.ok(a28 === "BOLSA-2028-000001", "2028 recomeça em 000001", a28);
b.ok(g.gerarNumeroProtocolo_(false, d("2027-06-01T10:00:00-03:00")) === "BOLSA-2027-000010", "e 2027 segue de onde estava (000010)");

b.fluxo("PROTOCOLO · quem já segura a trava não trava de novo");
const antes = g.gerarNumeroProtocolo_(true, d("2027-07-01T10:00:00-03:00"));
b.ok(antes === "BOLSA-2027-000011", "jaTrancado=true devolve o próximo sem tentar a trava", antes);

b.fluxo("PROTOCOLO · sem a trava, não devolve número");
const lockOrig = g.LockService.getScriptLock;
g.LockService.getScriptLock = () => ({ waitLock() { throw new Error("Não foi possível obter a trava"); }, releaseLock() {} });
let falhou = false; try { g.gerarNumeroProtocolo_(false, d("2027-08-01T10:00:00-03:00")); } catch (e) { falhou = true; }
g.LockService.getScriptLock = lockOrig;
b.ok(falhou, "sem a trava levanta erro (melhor falhar do que correr o risco de repetir)");
b.ok(props().getProperty("VOUCHER_PROTOCOLO_SEQ_2027") === "11", "e o contador não andou");
b.resumo();
