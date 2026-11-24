/**
 * TESTE — IRMÃOS SAEM JUNTOS NO ENVIO EM LOTE (conferência + fila do dia seguinte)
 *
 * Pedido do usuário (24/11/2026), com a foto da tela de Vouchers: duas
 * solicitações do MESMO titular selecionadas em "Enviar selecionadas" —
 * "Precisa ser enviado os dois juntos".
 *
 * PROVA (emulador): a conferência marca quem sai junto e quem tem o mesmo titular
 * mas e-mail diferente; o envio sai em UM e-mail; e a FILA do dia seguinte (cota
 * estourada) também mantém a família junta. NÃO PROVA: entrega nem o visual.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();
g.__cotaEmailRestante = 1500;

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(c => (campos[c] !== undefined ? campos[c] : ""))]);
}
function criar(proto, cpf, benef, email) {
  gravar("Voucher_Solicitacoes", { ID_SOLICITACAO: "SOL-" + proto, CPF_SOLICITANTE: cpf, NOME_SOLICITANTE: "GABRIELA TITULAR",
    EMAIL: email, NOME_BENEFICIARIO: benef, TIPO_BENEFICIARIO: "FILHO", INSTITUICAO_ENSINO: "JUNTA DE EDUCACAO",
    EMAIL_INSTITUICAO: "junta@escola.com", CURSO: "Ens. Fundamental", PERIODO_REFERENCIA: "2027", PERCENTUAL_APLICADO: "70",
    REGIME: "ANUAL", STATUS_SOLICITACAO: "APROVADO", NUMERO_PROTOCOLO: proto });
  gravar("Voucher_Emitidos", { ID_EMISSAO: "EMI-" + proto, DATA_EMISSAO: "24/11/2026 05:00", PROTOCOLO: proto,
    ID_SOLICITACAO: "SOL-" + proto, NOME_SOLICITANTE: "GABRIELA TITULAR", CPF: cpf, TIPO_DOCUMENTO: "CERTIFICADO",
    CODIGO_VALIDACAO: "COD" + proto, LINK_ARQUIVO: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123" + proto.slice(-1) + "/view",
    PERCENTUAL: "70", USUARIO: "wanderson" });
}
const TIT = "11144477735";
criar("VCH-A1", TIT, "LUIZA", "gabriela@exemplo.com");
criar("VCH-A2", TIT, "ALICE", "gabriela@exemplo.com");
criar("VCH-A3", TIT, "TERCEIRA", "outro@exemplo.com");       // mesmo titular, e-mail DIFERENTE
criar("VCH-B1", "52998224725", "SOZINHA", "sozinha@exemplo.com");
const caixa = () => amb.outbox.slice();
const zerar = () => { amb.outbox.length = 0; };

b.fluxo("VOUCHER · lote: irmãos juntos");

b.passo("1. A conferência diz quem sai junto");
const prep = g.voucherEnvioLotePreparar(["VCH-A1", "VCH-A2", "VCH-A3", "VCH-B1"], ADM);
b.ok(prep.ok, "preparou", prep.mensagem);
const L = {}; prep.linhas.forEach(l => { L[l.protocolo] = l; });
b.ok(L["VCH-A1"].grupo && L["VCH-A1"].grupo === L["VCH-A2"].grupo, "A1 e A2 estão no MESMO grupo de envio");
b.ok(L["VCH-A3"].grupo !== L["VCH-A1"].grupo, "A3 (e-mail diferente) fica em outro grupo");
b.igual(L["VCH-A3"].titular, L["VCH-A1"].titular, "mas a conferência sabe que é o MESMO titular (para avisar)");
b.ok(L["VCH-B1"].titular !== L["VCH-A1"].titular, "outra família não se mistura");
b.ok(!JSON.stringify(prep).includes(TIT), "o CPF do titular não vai para a tela");

b.passo("2. O envio: os dois irmãos saem num e-mail só");
zerar();
const r = g.voucherEnvioLoteExecutar(["VCH-A1", "VCH-A2"], { copiaInstituicao: false }, ADM);
b.ok(r.ok, "ok", r.mensagem);
b.igual(caixa().length, 1, "UM e-mail");
b.igual((caixa()[0].attachments || []).length, 2, "com os dois PDFs");

b.passo("3. FILA do dia seguinte (cota estourada): a família continua junta");
criar("VCH-C1", "39053344705", "IRMA UM", "fam@exemplo.com");
criar("VCH-C2", "39053344705", "IRMA DOIS", "fam@exemplo.com");
g.__cotaEmailRestante = 0;                                  // hoje não cabe nada
zerar();
const rq = g.voucherEnvioLoteExecutar(["VCH-C1", "VCH-C2"], { copiaInstituicao: false }, ADM);
b.ok(rq.ok && rq.agendados === 2, "os dois foram para a fila", rq.mensagem);
b.igual(caixa().length, 0, "nada saiu hoje");
g.__cotaEmailRestante = 1500;                               // amanhã
g.voucherEnvioLoteContinuar();
b.igual(caixa().length, 1, "a fila mandou UM e-mail para a família (antes saíam dois, item a item)");
b.igual((caixa()[0].attachments || []).length, 2, "com os dois certificados");
b.igual(g.voucherFilaLer_().itens.length, 0, "e a fila esvaziou");
b.resumo();
