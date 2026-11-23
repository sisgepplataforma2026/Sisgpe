/**
 * TESTE — E-MAIL DO CERTIFICADO: SEM LINK, REMETENTE DA SECRETARIA, REGIME
 *
 * O QUE ORIGINOU (23/11/2026)
 *
 * Chegaram e-mails do Google Drive ("Solicitação de compartilhamento de
 * Voucher Bolsa...") de associados tentando abrir o link do certificado. O
 * arquivo é PRIVADO de propósito (ArquivoDrive.gs) e o botão "Abrir o
 * certificado" do e-mail só abre para a conta dona do arquivo. O usuário
 * mandou tirar o link, tirar o código de validação do corpo, fazer o e-mail
 * sair pela secretaria e o semestre acompanhar o REGIME.
 *
 * O QUE ELE PROVA: o envio, ponta a ponta, contra a planilha em memória.
 * O QUE NÃO PROVA (continua "não testado"): a entrega real, o alias de
 * "enviar como" na conta que executa o script, e o visual no Gmail.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const PROTOCOLO = "VCH-2026-000042";
g.setupVoucherModuleFase1();

function gravar(nomeAba, campos) {
  const sh = ss.getSheetByName(nomeAba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(c => (campos[c] !== undefined ? campos[c] : ""))]);
}
function semear(extras) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  const c = {
    ID_SOLICITACAO: "SOL-0001", CPF_SOLICITANTE: "11144477735",
    NOME_SOLICITANTE: "CAMILA ZANI BORGES DE SOUZA", EMAIL: "camila@exemplo.com",
    INSTITUICAO_ENSINO: "IESES", CNPJ_INSTITUICAO: "02213188000181",
    CURSO: "Medicina", PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70",
    STATUS_SOLICITACAO: "APROVADO", NUMERO_PROTOCOLO: PROTOCOLO
  };
  Object.keys(extras || {}).forEach(k => { c[k] = extras[k]; });
  gravar("Voucher_Solicitacoes", c);
}
gravar("Voucher_Emitidos", {
  ID_EMISSAO: "EMI-0001", DATA_EMISSAO: "23/11/2026 10:30", PROTOCOLO: PROTOCOLO,
  ID_SOLICITACAO: "SOL-0001", NOME_SOLICITANTE: "CAMILA ZANI BORGES DE SOUZA",
  CPF: "11144477735", TIPO_DOCUMENTO: "CERTIFICADO", CODIGO_VALIDACAO: "A1B2C3D4",
  LINK_ARQUIVO: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view",
  PERCENTUAL: "70", USUARIO: "wanderson"
});
const ultimo = () => amb.outbox[amb.outbox.length - 1] || null;
const texto = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

b.fluxo("E-MAIL DO CERTIFICADO · sem link, sem código, remetente, regime");

b.passo("1. Semestral, com anexo");
semear({ REGIME: "SEMESTRAL" });
amb.outbox.length = 0;
const r1 = g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
const m1 = ultimo();
b.ok(r1.ok === true && !!m1, "envio ok e e-mail entregue", String(r1.mensagem));
b.igual(m1.via, "GmailApp", "sai por GmailApp (MailApp não aceita remetente)");
b.ok(m1.htmlBody.indexOf("drive.google.com") === -1 && m1.htmlBody.indexOf("Abrir o certificado") === -1,
  "o corpo NÃO tem link do Drive nem botão de abrir");
b.ok(m1.htmlBody.indexOf("A1B2C3D4") === -1, "o corpo NÃO traz o código de validação");
b.ok(Array.isArray(m1.attachments) && m1.attachments.length === 1, "o PDF vai anexado");
b.ok(/referente ao semestre letivo de 2026\/2/.test(texto(m1.htmlBody)), "o texto diz 'semestre letivo de 2026/2'");
b.ok(/Semestre\s+2026\/2/.test(texto(m1.htmlBody)), "a tabela rotula 'Semestre'");
b.ok(/segue anexo a este e-mail/.test(texto(m1.htmlBody)), "e diz que segue anexo");
b.igual(m1.replyTo, "secretaria@sindeducacao.com", "resposta vai para a secretaria");

b.passo("2. Anual");
semear({ REGIME: "ANUAL", PERIODO_REFERENCIA: "2026" });
amb.outbox.length = 0;
g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
const m2 = ultimo();
b.ok(/referente ao ano letivo de 2026/.test(texto(m2.htmlBody)), "o texto diz 'ano letivo de 2026'");
b.ok(/Ano letivo\s+2026/.test(texto(m2.htmlBody)), "a tabela rotula 'Ano letivo'");
b.ok(!/semestre/i.test(texto(m2.htmlBody)), "e a palavra 'semestre' não aparece");

b.passo("3. Remetente: a secretaria É alias da conta executora → from preenchido");
semear({ REGIME: "SEMESTRAL" });
g.__donoDoProjetoEmail = "financeiro@gmail.com";
b.ok(g.GmailApp.getAliases().indexOf("secretaria@sindeducacao.com") > -1, "pré-condição: o emulador tem o alias da secretaria");
amb.outbox.length = 0;
const r3 = g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
b.igual(ultimo().from, "secretaria@sindeducacao.com", "from = secretaria");
b.ok(String(r3.mensagem).indexOf("não está como alias") === -1, "sem aviso de alias");

b.passo("4. Remetente: sem alias → sai pela conta do sistema, avisa e NÃO trava");
const aliasesOrig = g.GmailApp.getAliases;
g.GmailApp.getAliases = () => [];
amb.outbox.length = 0;
const r4 = g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
b.ok(r4.ok === true && !!ultimo(), "o e-mail sai mesmo sem o alias");
b.ok(ultimo().from === undefined, "sem from (o Gmail recusaria um from sem alias)");
b.igual(ultimo().replyTo, "secretaria@sindeducacao.com", "mas a resposta continua na secretaria");
b.ok(String(r4.mensagem).indexOf("não está como alias") > -1, "e a tela é avisada do remetente");
g.GmailApp.getAliases = aliasesOrig;

b.passo("5. Anexo falha → o texto NÃO afirma que há anexo, e a tela avisa");
const orig = g.DriveApp.getFileById;
g.DriveApp.getFileById = () => { throw new Error("sem acesso"); };
amb.outbox.length = 0;
const r5 = g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
g.DriveApp.getFileById = orig;
const m5 = ultimo();
b.ok(r5.ok === true && !!m5, "o envio não trava");
b.ok(!m5.attachments || m5.attachments.length === 0, "sem anexo");
b.ok(!/segue anexo/.test(texto(m5.htmlBody)) && /retirada na sede/.test(texto(m5.htmlBody)),
  "o texto não diz 'anexo' e orienta a retirada na sede");
b.ok(m5.htmlBody.indexOf("drive.google.com") === -1, "e mesmo assim não manda link do Drive");
b.ok(/NÃO foi anexado/.test(r5.mensagem), "a tela recebe o ATENÇÃO de PDF não anexado");

b.passo("6. Sem período na solicitação");
semear({ REGIME: "SEMESTRAL", PERIODO_REFERENCIA: "" });
amb.outbox.length = 0;
g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
b.ok(!/referente ao/.test(texto(ultimo().htmlBody)), "some o trecho 'referente ao...' em vez de sair vazio");

b.passo("7. Ofício à escola: rótulo acompanha o regime");
const of = (regime) => texto(g.gerarHtmlOficioEscolaVoucher_({
  reg: { REGIME: regime, PERIODO_REFERENCIA: "2026/2", CURSO: "X", MODALIDADE: "GRADUACAO" },
  protocolo: "P", codigo: "C", percentual: 70 }));
b.ok(/Semestre:\s*2026\/2/.test(of("SEMESTRAL")), "semestral → 'Semestre:'");
b.ok(/Ano letivo:/.test(of("ANUAL")), "anual → 'Ano letivo:'");

b.resumo();
