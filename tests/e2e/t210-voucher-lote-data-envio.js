/**
 * VOUCHERS EM LOTE E A DATA DO DOCUMENTO NO DIA EM QUE ELE SAI — 29/10/2026.
 *
 * Pedido do usuário: "preciso emitir todos e quando forem enviar ele deve
 * sair com a data de envio, preciso enviar pelo email que solicitou". Mais:
 * retirada presencial sai com a data da impressão; cópia para a instituição
 * é opcional "mas tem que ter o email"; envio em lote e individual; e ele
 * pediu teste "com dados fictícios" antes de qualquer coisa ir para o ar.
 *
 * Oito pessoas FICTÍCIAS, cada uma um caso: associada titular, dependente,
 * não associado (presencial), sem e-mail, sem período, sem e-mail da
 * instituição, e duas para a cota. O código é o real (VoucherLote.gs,
 * VoucherEnvio.gs, VoucherPdf.gs) contra a planilha em memória.
 *
 * NÃO PROVA: o PDF de verdade (o emulador não renderiza), a entrega do
 * e-mail, o gatilho disparando no horário, a tela. Isso é homologação.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");          // sem o módulo benefícios
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(c => campos[c] !== undefined ? campos[c] : "")]);
}
function linhasDe(aba) {
  const sh = ss.getSheetByName(aba);
  const v = sh.getDataRange().getValues();
  const cab = v[0].map(c => String(c || "").trim());
  return v.slice(1).map(l => { const o = {}; cab.forEach((c, i) => { o[c] = l[i]; }); return o; });
}
const emitidoDe = p => linhasDe("Voucher_Emitidos").filter(r => r.PROTOCOLO === p).pop();

let n = 0;
function pessoa(prot, nome, extras) {
  n++;
  gravar("Voucher_Solicitacoes", Object.assign({
    ID_SOLICITACAO: "SOL-FICT-" + n, NUMERO_PROTOCOLO: prot,
    CPF_SOLICITANTE: String(90000000000 + n), NOME_SOLICITANTE: nome,
    EMAIL: "teste" + n + "@ficticio.invalid", TELEFONE: "(27) 99999-00" + String(n).padStart(2, "0"),
    INSTITUICAO_ENSINO: "FACULDADE FICTÍCIA " + n, CNPJ_INSTITUICAO: "",
    EMAIL_INSTITUICAO: "secretaria" + n + "@faculdade-ficticia.invalid",
    CURSO: "Pedagogia", MODALIDADE: "GRADUACAO", AREA_CURSO: "HUMANAS",
    PERIODO_REFERENCIA: "2027/1", PERCENTUAL_APLICADO: "70",
    STATUS_SOLICITACAO: "APROVADO", STATUS_VALIDACAO_SINDICAL: "VALIDADO",
    SITUACAO_SINDICAL: "ASSOCIADO", TIPO_BENEFICIARIO: "TITULAR", NOME_BENEFICIARIO: nome
  }, extras || {}));
}
pessoa("FICT-01", "ANA PAULA FICTÍCIA");
pessoa("FICT-02", "JOANA FICTÍCIA", { TIPO_BENEFICIARIO: "FILHO", NOME_BENEFICIARIO: "BERNARDO FICTÍCIO" });
pessoa("FICT-03", "CARLOS FICTÍCIO", { SITUACAO_SINDICAL: "NAO_ASSOCIADO" });
pessoa("FICT-04", "MÁRCIA FICTÍCIA", { EMAIL: "" });
pessoa("FICT-05", "PEDRO FICTÍCIO", { PERIODO_REFERENCIA: "" });
pessoa("FICT-06", "LUCAS FICTÍCIO", { EMAIL_INSTITUICAO: "" });
pessoa("FICT-07", "RITA FICTÍCIA");
pessoa("FICT-08", "SÉRGIO FICTÍCIO");
const TODOS = ["FICT-01", "FICT-02", "FICT-03", "FICT-04", "FICT-05", "FICT-06", "FICT-07", "FICT-08"];

/* Captura o HTML de cada PDF salvo — o emulador não guarda conteúdo de arquivo. */
const salvos = [];
const salvarOriginal = g.salvarHtmlComoPdfVoucher_;
g.salvarHtmlComoPdfVoucher_ = function (html, nome) {
  const r = salvarOriginal(html, nome); salvos.push({ html: String(html), nome: nome, url: r.url }); return r;
};
/* A cota do Google desce a cada destinatário, como no ar. */
const draftOriginal = g.GmailApp.createDraft;
g.GmailApp.createDraft = function (to, s, c, o) {
  const d = draftOriginal.apply(this, arguments);
  const envio = d.send;
  d.send = function () {
    const r = envio.apply(this, arguments);
    const quantos = 1 + (o && o.cc ? 1 : 0);
    if (g.__cotaEmailRestante !== undefined) g.__cotaEmailRestante -= quantos;
    return r;
  };
  return d;
};

/* ═══ 1. PERMISSÃO ═══ */
b.fluxo("VOUCHER EM LOTE · quem pode");
b.passo("1. Sem o módulo Benefícios, nada é emitido nem enviado");
const negado = g.voucherEmitirEmLote(TODOS, ESC);
b.ok(!negado.ok, "emitir em lote recusado para quem não tem Benefícios", negado.mensagem);
b.ok(linhasDe("Voucher_Emitidos").length === 0, "nenhuma linha em Voucher_Emitidos");
b.ok(!g.voucherEnvioLotePreparar(TODOS, ESC).ok, "a conferência do lote também é recusada");
b.ok(!g.voucherEnvioLoteExecutar(TODOS, {}, ESC).ok, "o envio em lote também é recusado");
b.ok(!g.voucherDocumentoParaImpressao("FICT-03", ESC).ok, "a impressão também é recusada");
b.ok(amb.outbox.length === 0, "nenhum e-mail saiu");

/* ═══ 2. EMITIR EM LOTE ═══ */
b.fluxo("VOUCHER EM LOTE · emitir as selecionadas");
b.passo("2. Emite as oito; a sem período recusa com o motivo e não trava as outras");
amb.lockEvents.length = 0;
const em = g.voucherEmitirEmLote(TODOS, ADM);
b.ok(em.ok, "a emissão em lote rodou", em.mensagem);
b.igual(em.emitidas.length, 7, "sete emitidas");
b.igual(em.recusadas.map(x => x.protocolo).join(","), "FICT-05", "só a sem período recusou");
b.ok(/PER[IÍ]ODO/i.test(em.recusadas[0].mensagem), "e o motivo diz que falta o período", em.recusadas[0].mensagem);
b.ok(em.emitidas.some(x => x.protocolo === "FICT-03" && x.presencial), "o não associado é marcado como presencial");
b.ok(amb.outbox.length === 0, "emitir NÃO envia e-mail nenhum");
b.ok(!amb.lockEvents.some(e => e.resultado === "NEGADO" || e.resultado === "DEADLOCK"),
  "nenhuma trava negada durante o lote (o lote não segura a trava do script)",
  amb.lockEvents.filter(e => e.resultado !== "OBTIDO" && e.resultado !== "LIBERADO").length + " eventos ruins");
const codigoAna = emitidoDe("FICT-01").CODIGO_VALIDACAO;
b.ok(!!codigoAna, "a Ana ganhou código de validação", codigoAna);

b.passo("3. Emitir de novo não gera código novo");
const em2 = g.voucherEmitirEmLote(["FICT-01", "FICT-02"], ADM);
b.igual(em2.jaEmitidas.length, 2, "as duas voltam como 'já emitidas'");
b.igual(emitidoDe("FICT-01").CODIGO_VALIDACAO, codigoAna, "o código da Ana é o mesmo");
b.igual(linhasDe("Voucher_Emitidos").length, 7, "e não criou linha nova");

b.passo("4. Dois lotes ao mesmo tempo: o segundo espera");
g.CacheService.getScriptCache().put("VOUCHER_LOTE_EM_ANDAMENTO", "x", 300);
const ocupado = g.voucherEmitirEmLote(["FICT-01"], ADM);
b.ok(!ocupado.ok && /Outro lote/.test(ocupado.mensagem), "recusado com aviso de outro lote rodando", ocupado.mensagem);
g.CacheService.getScriptCache().remove("VOUCHER_LOTE_EM_ANDAMENTO");

/* Dois dias se passam: tudo foi emitido em 27/10. */
const sh = ss.getSheetByName("Voucher_Emitidos");
const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
const iData = cab.indexOf("DATA_EMISSAO");
for (let r = 2; r <= sh.getLastRow(); r++) sh.getRange(r, iData + 1).setValue(new Date(2026, 9, 27, 10, 0));
const hojeExtenso = g.dataExtensoVoucher_(new Date());
const velhoExtenso = g.dataExtensoVoucher_(new Date(2026, 9, 27, 10, 0));

/* ═══ 3. ENVIO INDIVIDUAL ═══ */
b.fluxo("VOUCHER · envio individual com a data do envio");
b.passo("5. Cópia marcada SEM e-mail da instituição: recusa, nada sai, nada é refeito");
const salvosAntes = salvos.length;
const semInst = g.voucherEnviarPorEmail("FICT-06", { enviarInstituicao: true, copia: "" }, ADM);
b.ok(!semInst.ok && semInst.semEmailInstituicao, "recusado: falta o e-mail da instituição", semInst.mensagem);
b.ok(amb.outbox.length === 0, "nenhum e-mail saiu");
b.igual(salvos.length, salvosAntes, "o documento não foi refeito");

b.passo("6. A conferência do envio avisa a data que vai no papel");
const prep = g.voucherPrepararEnvio("FICT-01", ADM);
b.igual(prep.dataNoPapel, "27/10/2026", "o papel hoje diz 27/10");
b.igual(prep.dataDoEnvio, g.Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy"), "e vai sair com a data de hoje");

b.passo("7. Envia a Ana: o certificado sai refeito com a data de hoje, mesmo código");
const linkAntes = emitidoDe("FICT-01").LINK_ARQUIVO;
const envAna = g.voucherEnviarPorEmail("FICT-01", { enviarInstituicao: false }, ADM);
b.ok(envAna.ok, "enviado", envAna.mensagem);
b.ok(envAna.redatado, "o documento foi refeito");
b.igual(amb.outbox.length, 1, "um e-mail");
b.igual(amb.outbox[0].to, "teste1@ficticio.invalid", "para o e-mail de quem solicitou");
b.ok(!amb.outbox[0].cc, "sem cópia, porque a cópia não foi marcada");
const docAna = salvos[salvos.length - 1];
b.ok(docAna.html.indexOf(hojeExtenso) > -1, "o PDF novo traz a data de hoje", hojeExtenso);
b.ok(docAna.html.indexOf(velhoExtenso) === -1, "e não traz mais a de 27/10", velhoExtenso);
/* O papel não imprime código nem QR desde 23/09/2026 ("pode tirar isso"):
   o código vive no registro, e é ele que se confere abaixo. */
b.ok(/ANA PAULA FICT/.test(docAna.html), "o PDF novo é da Ana");
const emiAna = emitidoDe("FICT-01");
b.igual(emiAna.CODIGO_VALIDACAO, codigoAna, "o registro mantém o código");
b.ok(emiAna.LINK_ARQUIVO && emiAna.LINK_ARQUIVO !== linkAntes, "o registro aponta para o PDF novo");
b.ok(emiAna.DATA_DOCUMENTO instanceof Date, "DATA_DOCUMENTO gravada");
b.ok(Object.prototype.toString.call(emiAna.DATA_EMISSAO) === "[object Date]" && emiAna.DATA_EMISSAO.getDate() === 27,
  "DATA_EMISSAO continua sendo a da emissão (27/10)");
const hist = linhasDe("Voucher_Historico").filter(h => h.NUMERO_PROTOCOLO === "FICT-01" && h.ACAO === "VOUCHER_REDATADO");
b.igual(hist.length, 1, "o histórico registra o documento refeito");
b.ok(/mesmo c[oó]digo/i.test(String(hist[0] && hist[0].OBSERVACOES)), "dizendo que o código é o mesmo", hist[0] && hist[0].OBSERVACOES);

b.passo("8. Reenviar no mesmo dia não refaz de novo");
const s8 = salvos.length;
const reAna = g.voucherEnviarPorEmail("FICT-01", { enviarInstituicao: false }, ADM);
b.ok(reAna.ok && !reAna.redatado, "enviado sem refazer");
b.igual(salvos.length, s8, "nenhum PDF novo");

b.passo("9. Com a cópia marcada e o e-mail da instituição, a cópia vai");
const envJoana = g.voucherEnviarPorEmail("FICT-02", { enviarInstituicao: true }, ADM);
b.ok(envJoana.ok, "enviado", envJoana.mensagem);
b.igual(amb.outbox[amb.outbox.length - 1].cc, "secretaria2@faculdade-ficticia.invalid", "cópia para a instituição");

/* ═══ 4. ENVIO EM LOTE ═══ */
b.fluxo("VOUCHER EM LOTE · conferência, cota e o resto amanhã");
b.passo("10. A conferência separa quem vai, quem já recebeu e quem fica de fora");
const conf = g.voucherEnvioLotePreparar(TODOS, ADM);
b.ok(conf.ok, "a conferência montou");
const sit = {}; conf.linhas.forEach(l => { sit[l.protocolo] = l; });
b.igual(sit["FICT-01"].situacao, "JA_ENVIADO", "Ana: já enviado");
b.ok(sit["FICT-01"].marcado === false, "e vem DESMARCADA");
b.igual(sit["FICT-03"].situacao, "PRESENCIAL", "Carlos: retirada presencial");
b.igual(sit["FICT-04"].situacao, "SEM_EMAIL", "Márcia: sem e-mail");
b.igual(sit["FICT-05"].situacao, "NAO_EMITIDO", "Pedro: não emitido");
["FICT-06", "FICT-07", "FICT-08"].forEach(p => b.ok(sit[p].situacao === "PRONTO" && sit[p].marcado, p + ": pronto e marcado"));
b.ok(amb.outbox.length === 3, "a conferência não enviou nada");

b.passo("11. Cópia marcada no lote: quem não tem e-mail da instituição fica de fora");
const comCopia = g.voucherEnvioLoteExecutar(["FICT-06"], { copiaInstituicao: true }, ADM);
b.ok(comCopia.ok && comCopia.enviados.length === 0, "o Lucas não foi enviado");
b.ok(/sem e-mail da institui/i.test((comCopia.pulados[0] || {}).motivo), "motivo: sem e-mail da instituição", (comCopia.pulados[0] || {}).motivo);

b.passo("12. Cota curta: cabem 2 sem tocar na reserva dos ofícios; o 3º fica para amanhã");
g.__cotaEmailRestante = 42;            // reserva padrão: 40
const saidosAntes = amb.outbox.length;
const lote = g.voucherEnvioLoteExecutar(["FICT-06", "FICT-07", "FICT-03", "FICT-08"], { copiaInstituicao: false }, ADM);
b.ok(lote.ok, "o lote rodou", lote.mensagem);
b.igual(lote.enviados.map(x => x.protocolo).join(","), "FICT-06,FICT-07", "Lucas e Rita enviados hoje");
b.igual(lote.pulados.map(x => x.protocolo).join(","), "FICT-03", "Carlos (presencial) ficou de fora");
b.igual(lote.agendados, 1, "o Sérgio ficou para amanhã");
b.ok(lote.porCota && /amanhã/.test(lote.mensagem), "e a mensagem diz que sai amanhã", lote.mensagem);
b.igual(g.__cotaEmailRestante, 40, "a reserva de 40 dos ofícios ficou intacta");
b.igual(amb.outbox.length - saidosAntes, 2, "só dois e-mails saíram");
b.ok(amb.outbox.slice(saidosAntes).every(m => /ficticio\.invalid$/.test(m.to)), "todos para o e-mail de quem solicitou");
const gat = amb.triggers.filter(t => t.fn === "voucherEnvioLoteContinuar");
b.igual(gat.length, 1, "um gatilho de continuação");
b.ok(gat[0] && gat[0].detalhe.em && gat[0].detalhe.em.getHours() === 8, "agendado para as 8h", gat[0] && String(gat[0].detalhe.em));
b.igual(JSON.parse(g.PropertiesService.getScriptProperties().getProperty("VOUCHER_LOTE_FILA")).itens.map(i => i.p).join(","), "FICT-08", "a fila guarda o Sérgio");

b.passo("13. No dia seguinte, a continuação envia o Sérgio e esvazia a fila");
g.__cotaEmailRestante = 1500;
const antes13 = amb.outbox.length;
g.voucherEnvioLoteContinuar();
b.igual(amb.outbox.length - antes13, 1, "um e-mail saiu");
b.igual(amb.outbox[amb.outbox.length - 1].to, "teste8@ficticio.invalid", "para o Sérgio");
b.ok(!g.PropertiesService.getScriptProperties().getProperty("VOUCHER_LOTE_FILA"), "a fila ficou vazia");
const antes13b = amb.outbox.length;
g.voucherEnvioLoteContinuar();
b.igual(amb.outbox.length, antes13b, "rodar de novo, com a fila vazia, não envia nada");

/* ═══ 5. IMPRESSÃO PRESENCIAL ═══ */
b.fluxo("VOUCHER · retirada presencial sai com a data da impressão");
b.passo("14. Imprimir o do Carlos refaz com a data de hoje, mesmo código");
const codCarlos = emitidoDe("FICT-03").CODIGO_VALIDACAO;
const imp = g.voucherDocumentoParaImpressao("FICT-03", ADM);
b.ok(imp.ok && imp.redatado, "refeito para imprimir", imp.mensagem);
b.ok(imp.html.indexOf(hojeExtenso) > -1, "o documento impresso traz a data de hoje");
b.igual(emitidoDe("FICT-03").CODIGO_VALIDACAO, codCarlos, "o registro mantém o mesmo código");
b.ok(!amb.outbox.some(m => m.to === "teste3@ficticio.invalid"), "e o Carlos não recebeu e-mail nenhum");
const imp2 = g.voucherDocumentoParaImpressao("FICT-03", ADM);
b.ok(imp2.ok && !imp2.redatado && imp2.html.indexOf(hojeExtenso) > -1, "imprimir de novo hoje não refaz, e a data continua a de hoje");
b.ok(!g.voucherDocumentoParaImpressao("FICT-05", ADM).ok, "quem não foi emitido não imprime");

/* ═══ 6. MASSA DE TESTE PARA HOMOLOGAÇÃO ═══ */
b.fluxo("VOUCHER · massa de teste fictícia (homologação)");
b.passo("15. Fora de homologação a massa de teste é RECUSADA");
const linhasAntes = linhasDe("Voucher_Solicitacoes").length;
let recusou = "";
try { g.voucherHomologacaoCriarMassaTeste("qa@ficticio.invalid", ADM); } catch (e) { recusou = e.message; }
b.ok(/recusado|homologa/i.test(recusou), "recusou: o ambiente não é homologação", recusou);
b.igual(linhasDe("Voucher_Solicitacoes").length, linhasAntes, "nenhuma linha criada");
let recusouEsc = "";
try { g.voucherHomologacaoCriarMassaTeste("qa@ficticio.invalid", ESC); } catch (e) { recusouEsc = e.message; }
b.ok(!!recusouEsc, "e quem não é administrador também é recusado", recusouEsc);

b.passo("16. Em homologação, cria os 6 casos e o lote funciona com eles");
const travaReal = g.documentosExigirHomologacaoSegura_;
g.documentosExigirHomologacaoSegura_ = () => ({ ambiente: "homologacao", planilhaId: g.PLANILHA_ID, planilhaNome: "HML (emulador)" });
const massa = g.voucherHomologacaoCriarMassaTeste("qa@ficticio.invalid", ADM);
g.documentosExigirHomologacaoSegura_ = travaReal;
b.igual(massa.criados.length, 6, "seis solicitações fictícias");
b.ok(massa.criados.every(c => /^TESTE FICT/.test(c.nome)), "todas com 'TESTE FICTÍCIO' no nome");
b.ok(massa.criados.filter(c => c.email).every(c => /^qa\+teste\d@ficticio\.invalid$/.test(c.email)),
  "e-mails vão para a caixa de teste, com +testeN", massa.criados.map(c => c.email).join(" "));
const emMassa = g.voucherEmitirEmLote(massa.criados.map(c => c.protocolo), ADM);
b.igual(emMassa.emitidas.length, 5, "cinco emitidas");
b.igual(emMassa.recusadas.length, 1, "uma recusada (a sem período)");
b.ok(/PEDRO/.test(massa.criados.find(c => c.protocolo === emMassa.recusadas[0].protocolo).nome), "e é a do Pedro");

b.resumo();
