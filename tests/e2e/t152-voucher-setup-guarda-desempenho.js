/**
 * TESTE — A ESTRUTURA DO MÓDULO VOUCHER NÃO É REFEITA A CADA CLIQUE
 *
 * O QUE ORIGINOU (23/11/2026): lentidão geral. As listagens do voucher levavam
 * 17 s e a emissão 18–21 s. `setupVoucherModuleFase1` roda em ~13 caminhos,
 * quase todos de leitura, e a cada chamada refazia 7 abas com ~160
 * `autoResizeColumn`, formatação e congelamento de linha.
 *
 * PROVA: a 2ª chamada é pulada (e a estrutura continua certa); aba apagada ou
 * coluna nova no código forçam a volta completa — a guarda não pode esconder
 * defeito de estrutura.
 *
 * NÃO PROVA: o ganho de tempo real. O emulador não mede a duração do Google;
 * o que se mede aqui é o NÚMERO de chamadas caras evitadas.
 */
const b = require("./base");
const { g } = b.subir({});
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

b.fluxo("VOUCHER · guarda de desempenho do setup");

/* Conta autoResizeColumn: é a chamada cara que a guarda existe para evitar. */
let resizes = 0;
const abasObservadas = new Set();
function observar() {
  ss.getSheets().forEach(sh => {
    if (abasObservadas.has(sh)) return;
    abasObservadas.add(sh);
    const orig = sh.autoResizeColumn && sh.autoResizeColumn.bind(sh);
    if (orig) sh.autoResizeColumn = function (i) { resizes++; return orig(i); };
  });
}

b.passo("1. Primeira chamada faz a volta completa");
const r1 = g.setupVoucherModuleFase1();
b.ok(r1.ok === true && !r1.pulado, "primeira chamada inicializa de verdade");
observar();
b.ok(!!ss.getSheetByName("Voucher_Solicitacoes"), "as abas do módulo existem");

b.passo("2. Segunda chamada é PULADA");
resizes = 0;
const r2 = g.setupVoucherModuleFase1();
b.ok(r2.ok === true && r2.pulado === true, "devolve ok e pulado:true");
b.igual(resizes, 0, "nenhum autoResizeColumn na segunda chamada");

b.passo("3. Dez chamadas seguidas (listagem, prévia, emissão) — nenhuma refaz");
resizes = 0;
for (let i = 0; i < 10; i++) g.setupVoucherModuleFase1();
b.igual(resizes, 0, "zero chamadas caras em 10 chamadas");

b.passo("4. Aba apagada à mão força a volta completa e RECRIA");
ss.deleteSheet(ss.getSheetByName("Voucher_Documentos"));
const r4 = g.setupVoucherModuleFase1();
b.ok(!r4.pulado, "não é pulada quando falta aba");
b.ok(!!ss.getSheetByName("Voucher_Documentos"), "a aba apagada foi recriada");

b.passo("5. Marca do cache perdida (expirou/despejada) → volta completa");
g.CacheService.getScriptCache().remove("VOUCHER_ESTRUTURA_OK");
observar();
resizes = 0;
b.ok(!g.setupVoucherModuleFase1().pulado, "sem marca, roda completo — o comportamento de sempre");
/* Contraprova do contador: se ele nunca contasse, os "zero" acima seriam vazios. */
b.ok(resizes > 100, "o contador funciona: a volta completa faz mais de 100 autoResizeColumn", "contou " + resizes);

b.passo("6. Coluna nova no código muda a assinatura e força a volta");
const defs = [{ name: "A", headers: ["X", "Y"] }];
const ass1 = g.voucherAssinaturaEstrutura_(defs);
const ass2 = g.voucherAssinaturaEstrutura_([{ name: "A", headers: ["X", "Y", "Z"] }]);
b.ok(ass1 !== ass2, "assinatura muda quando entra coluna");
b.igual(g.voucherAssinaturaEstrutura_(defs), ass1, "e é estável para a mesma estrutura");

b.resumo();
