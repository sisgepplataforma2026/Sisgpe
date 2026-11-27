/**
 * TESTE — UM E-MAIL SÓ PARA O SOLICITANTE (VoucherEnvioFamilia.gs)
 *
 * Pedido do usuário (24/11/2026): "quando tiver mais dependentes deve sair um
 * único e-mail para o solicitante". A cópia para a instituição continua
 * OPCIONAL ("não é obrigatório envio à escola"); ligada, instituições
 * diferentes recebem e-mail À PARTE, cada uma só com o certificado do seu
 * dependente (LGPD).
 *
 * PROVA: no emulador, contagem de e-mails, destinatários, anexos, histórico por
 * protocolo e o lote agrupando. NÃO PROVA: a entrega, o PDF de verdade nem o
 * visual no Gmail.
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
const LINK = n => "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123" + n + "/view";
function criar(proto, cpf, benef, instit, emailInst, extra) {
  gravar("Voucher_Solicitacoes", Object.assign({
    ID_SOLICITACAO: "SOL-" + proto, CPF_SOLICITANTE: cpf, NOME_SOLICITANTE: "CAMILA ZANI BORGES",
    EMAIL: "camila@exemplo.com", NOME_BENEFICIARIO: benef, TIPO_BENEFICIARIO: "FILHO",
    INSTITUICAO_ENSINO: instit, EMAIL_INSTITUICAO: emailInst, CURSO: "Curso de " + benef,
    PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70", REGIME: "SEMESTRAL",
    STATUS_SOLICITACAO: "APROVADO", NUMERO_PROTOCOLO: proto
  }, extra || {}));
  gravar("Voucher_Emitidos", { ID_EMISSAO: "EMI-" + proto, DATA_EMISSAO: "23/11/2026 10:30", PROTOCOLO: proto,
    ID_SOLICITACAO: "SOL-" + proto, NOME_SOLICITANTE: "CAMILA ZANI BORGES", CPF: cpf, TIPO_DOCUMENTO: "CERTIFICADO",
    CODIGO_VALIDACAO: "COD" + proto, LINK_ARQUIVO: LINK(proto.slice(-1)), PERCENTUAL: "70", USUARIO: "wanderson" });
}
const CPF = "11144477735";
criar("VCH-1", CPF, "MARIA", "COLEGIO ALFA", "alfa@escola.com");
criar("VCH-2", CPF, "JOAO", "COLEGIO ALFA", "alfa@escola.com");
criar("VCH-3", CPF, "PEDRO", "COLEGIO BETA", "beta@escola.com");
criar("VCH-4", "52998224725", "OUTRA PESSOA", "COLEGIO ALFA", "alfa@escola.com", { NOME_SOLICITANTE: "OUTRA FAMILIA", EMAIL: "outra@exemplo.com" });
const caixa = () => amb.outbox.slice();
const zerar = () => { amb.outbox.length = 0; };
const texto = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function historico(proto) {
  const sh = ss.getSheetByName("Voucher_Historico");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().map(r => r.join(" | ")).filter(t => t.indexOf(proto) > -1);
}

b.fluxo("VOUCHER · e-mail único para o solicitante");

b.passo("1. Três filhos, SEM cópia à escola: UM e-mail, três PDFs");
zerar();
const r1 = g.voucherEnviarFamiliaPorEmail(["VCH-1", "VCH-2", "VCH-3"], { enviarInstituicao: false }, ADM);
b.ok(r1.ok === true, "envio ok", r1.mensagem);
b.igual(caixa().length, 1, "saiu UM e-mail (eram três)");
const m1 = caixa()[0];
b.igual(m1.to, "camila@exemplo.com", "para o solicitante");
b.ok(/VCH-1/.test(m1.subject) && /VCH-2/.test(m1.subject) && /VCH-3/.test(m1.subject), "o assunto lista os 3 protocolos", m1.subject);
b.igual((m1.attachments || []).length, 3, "com os 3 PDFs anexados");
const t1 = texto(m1.htmlBody);
b.ok(/MARIA/.test(t1) && /JOAO/.test(t1) && /PEDRO/.test(t1), "a tabela traz cada beneficiário");
b.ok(/Semestre 2026\/2/.test(t1) && /70%/.test(t1), "com semestre e desconto");
b.ok(/seguem anexos/.test(t1), "e diz que seguem anexos");
b.ok(m1.cc === undefined, "sem cópia");
["VCH-1", "VCH-2", "VCH-3"].forEach(p => b.ok(historico(p).some(t => /ENVIO_EMAIL/.test(t) && /e-mail único com 3/.test(t)), "o histórico de " + p + " tem a sua linha de envio"));

b.passo("2. Cópia LIGADA e TODOS na mesma escola: a escola vai em cópia no e-mail único");
zerar();
const r2 = g.voucherEnviarFamiliaPorEmail(["VCH-1", "VCH-2"], { enviarInstituicao: true }, ADM);
b.ok(r2.ok === true, "ok", r2.mensagem);
b.igual(caixa().length, 1, "ainda UM e-mail");
b.igual(caixa()[0].cc, "alfa@escola.com", "com a escola em cópia");

b.passo("3. Cópia LIGADA e escolas DIFERENTES: e-mail à parte, cada escola só com o seu");
zerar();
const r3 = g.voucherEnviarFamiliaPorEmail(["VCH-1", "VCH-2", "VCH-3"], { enviarInstituicao: true }, ADM);
b.ok(r3.ok === true, "ok", r3.mensagem);
b.igual(caixa().length, 3, "1 para o associado + 1 para cada escola = 3");
const assoc = caixa().find(m => m.to === "camila@exemplo.com"), alfa = caixa().find(m => m.to === "alfa@escola.com"), beta = caixa().find(m => m.to === "beta@escola.com");
b.ok(assoc && (assoc.attachments || []).length === 3 && assoc.cc === undefined, "o associado recebe os 3, SEM cópia no e-mail dele");
b.igual((alfa.attachments || []).length, 2, "a escola ALFA recebe só os 2 dela (MARIA e JOAO)");
b.ok(!/PEDRO/.test(texto(alfa.htmlBody)), "e o certificado do PEDRO NÃO aparece no e-mail da ALFA (LGPD)");
b.igual((beta.attachments || []).length, 1, "a escola BETA recebe só o dela");
b.ok(!/MARIA|JOAO/.test(texto(beta.htmlBody)), "e a BETA não vê os outros");

b.passo("4. Cópia MARCADA sem e-mail da escola: recusa e NÃO manda nada");
ss.getSheetByName("Voucher_Solicitacoes").getRange(2, 1, 1, 1);   // (sem efeito; só garante a aba aberta)
criar("VCH-5", CPF, "ANA", "COLEGIO SEM EMAIL", "");
criar("VCH-6", CPF, "LUCAS", "COLEGIO SEM EMAIL", "");
zerar();
const r4 = g.voucherEnviarFamiliaPorEmail(["VCH-5", "VCH-6"], { enviarInstituicao: true }, ADM);
b.ok(r4.ok === false && r4.semEmailInstituicao === true, "recusa com o motivo", r4.mensagem);
b.igual(caixa().length, 0, "nenhum e-mail saiu");

b.passo("5. Titulares diferentes não se juntam");
zerar();
const r5 = g.voucherEnviarFamiliaPorEmail(["VCH-1", "VCH-4"], { enviarInstituicao: false }, ADM);
b.ok(r5.ok === false && /diferentes/.test(r5.mensagem), "recusa", r5.mensagem);
b.igual(caixa().length, 0, "nada saiu");

b.passo("6. Um protocolo só: é o envio de sempre");
zerar();
const r6 = g.voucherEnviarFamiliaPorEmail(["VCH-6"], { enviarInstituicao: false }, ADM);
b.ok(r6.ok === true && caixa().length === 1, "um e-mail, como antes", r6.mensagem);
b.ok(!/Certificados de Bolsa/.test(caixa()[0].subject), "assunto de certificado único");

b.passo("7. O modal descobre os irmãos prontos (só os que AINDA NÃO foram enviados)");
criar("VCH-10", CPF, "IRMA UM", "COLEGIO ALFA", "alfa@escola.com");
criar("VCH-11", CPF, "IRMA DOIS", "COLEGIO ALFA", "alfa@escola.com");
const ir = g.voucherIrmaosProntosParaEnvio("VCH-10", ADM);
b.ok(ir.ok && ir.irmaos.some(i => i.protocolo === "VCH-11"), "VCH-11, do mesmo titular e ainda não enviado, é oferecido", JSON.stringify(ir.irmaos.map(i => i.protocolo)));
b.ok(!ir.irmaos.some(i => ["VCH-1", "VCH-2", "VCH-3", "VCH-6"].indexOf(i.protocolo) > -1), "os já enviados (VCH-1, 2, 3 e 6) NÃO são oferecidos de novo");
b.ok(!ir.irmaos.some(i => i.protocolo === "VCH-4"), "e o de OUTRA família não");

b.passo("8. O LOTE agrupa: 3 da mesma família + 1 de outra = 2 e-mails, não 4");
criar("VCH-7", "39053344705", "SOLO", "COLEGIO ALFA", "alfa@escola.com", { NOME_SOLICITANTE: "FAMILIA SOLO", EMAIL: "solo@exemplo.com" });
criar("VCH-8", "39053344705", "SOLO DOIS", "COLEGIO ALFA", "alfa@escola.com", { NOME_SOLICITANTE: "FAMILIA SOLO", EMAIL: "solo@exemplo.com" });
criar("VCH-9", "27595487040", "UNICO", "COLEGIO ALFA", "alfa@escola.com", { NOME_SOLICITANTE: "FAMILIA UNICO", EMAIL: "unico@exemplo.com" });
zerar();
const lote = g.voucherEnvioLoteExecutar(["VCH-7", "VCH-8", "VCH-9"], { copiaInstituicao: false }, ADM);
b.ok(lote.ok, "lote ok", lote.mensagem);
b.igual(caixa().length, 2, "2 e-mails: um da família SOLO (2 certificados) e um do UNICO");
b.igual((lote.enviados || []).length, 3, "e os 3 protocolos constam como enviados");
const famSolo = caixa().find(m => m.to === "solo@exemplo.com");
b.ok(famSolo && (famSolo.attachments || []).length === 2 && /VCH-7/.test(famSolo.subject) && /VCH-8/.test(famSolo.subject), "a família SOLO recebeu um e-mail só com os 2");
b.ok(["VCH-7", "VCH-8", "VCH-9"].every(p => historico(p).some(t => /ENVIO_EMAIL/.test(t))), "cada protocolo tem o seu registro de envio");
b.resumo();
