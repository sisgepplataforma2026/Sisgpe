/**
 * A TELA DO LOTE DE VOUCHERS — 29/10/2026, mockup docs/mock-voucher-lote.png.
 *
 * DOM real (jsdom), backend real (gas.js), cliques reais, dados FICTÍCIOS.
 * Prova que a tela: mostra os dois botões novos ao selecionar; emite pelo
 * servidor e mostra o resultado; leva à CONFERÊNCIA (nunca envia direto);
 * deixa quem já recebeu desmarcado; tira da lista quem não tem e-mail da
 * instituição quando a cópia é marcada; e só envia os marcados.
 *
 * NÃO PROVA: aparência, impressão no navegador, entrega do e-mail.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER EM LOTE · tela");
  b.naoTestavel("tela do lote", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map(c => campos[c] !== undefined ? campos[c] : "")]);
}
let n = 0;
function pessoa(prot, nome, extras) {
  n++;
  gravar("Voucher_Solicitacoes", Object.assign({
    ID_SOLICITACAO: "SOL-TELA-" + n, NUMERO_PROTOCOLO: prot, DATA_SOLICITACAO: new Date(2026, 9, 20),
    CPF_SOLICITANTE: String(91000000000 + n), NOME_SOLICITANTE: nome,
    EMAIL: "tela" + n + "@ficticio.invalid", INSTITUICAO_ENSINO: "FACULDADE FICTÍCIA",
    EMAIL_INSTITUICAO: "inst" + n + "@faculdade-ficticia.invalid",
    CURSO: "Pedagogia", MODALIDADE: "GRADUACAO", AREA_CURSO: "HUMANAS",
    PERIODO_REFERENCIA: "2027/1", PERCENTUAL_APLICADO: "70",
    STATUS_SOLICITACAO: "APROVADO", STATUS_VALIDACAO_SINDICAL: "VALIDADO",
    SITUACAO_SINDICAL: "ASSOCIADO", TIPO_BENEFICIARIO: "TITULAR", NOME_BENEFICIARIO: nome
  }, extras || {}));
}
pessoa("TELA-01", "ALICE FICTÍCIA");
pessoa("TELA-02", "BRUNO FICTÍCIO", { EMAIL_INSTITUICAO: "" });
pessoa("TELA-03", "CÍNTIA FICTÍCIA");

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
const el = id => doc.getElementById(id);
const visivel = id => el(id) && el(id).style.display !== "none";

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(120);

  b.fluxo("VOUCHER EM LOTE · barra de seleção");
  b.passo("1. Os dois botões novos existem e contam a seleção");
  b.ok(!!el("certSelEmitir") && !!el("certSelEnviar"), "Emitir selecionadas e Enviar selecionadas existem");
  ["TELA-01", "TELA-02", "TELA-03"].forEach(p => t.marcar('.cert-sel-linha[data-prot="' + p + '"]', true));
  await t.assentar(20);
  b.ok(/\(3\)/.test(el("certSelEmitir").textContent), "o botão de emitir mostra (3)", el("certSelEmitir").textContent);

  b.fluxo("VOUCHER EM LOTE · emitir pela tela");
  b.passo("2. Emitir mostra o resultado e NÃO envia nada");
  t.clicar("#certSelEmitir");
  await t.assentar(200);
  b.ok(visivel("certLoteEmiOverlay"), "o modal da emissão em lote abriu");
  const corpo = t.texto("#certLoteEmiCorpo") || "";
  b.ok(/3\s*emitidas/.test(corpo.replace(/\s+/g, " ")), "diz que emitiu as 3", corpo.slice(0, 120));
  b.ok(amb.outbox.length === 0, "nenhum e-mail saiu ao emitir");
  b.ok(visivel("certLoteEmiEnviar"), "aparece o botão para conferir e enviar");

  b.passo("3. 'Conferir e enviar' abre a CONFERÊNCIA, não envia");
  t.clicar("#certLoteEmiEnviar");
  await t.assentar(200);
  b.ok(visivel("certLoteEnvOverlay"), "a conferência abriu");
  b.ok(amb.outbox.length === 0, "ainda nenhum e-mail");
  b.igual(doc.querySelectorAll("#certLoteEnvLista .cert-lote-chk").length, 3, "três linhas com caixa de marcar");
  b.ok(el("certLoteEnvCopia").checked === false, "a cópia para a instituição nasce desmarcada");
  b.ok(/Enviar 3 certificados/.test(el("certLoteEnvConfirmar").textContent), "o botão diz quantos vão sair",
    el("certLoteEnvConfirmar").textContent);

  b.passo("4. Marcar a cópia tira da lista quem não tem e-mail da instituição");
  t.marcar("#certLoteEnvCopia", true);
  await t.assentar(30);
  b.igual(doc.querySelectorAll("#certLoteEnvLista .cert-lote-chk").length, 2, "o Bruno perde a caixa de marcar");
  b.ok(/sem e-mail da institui/i.test(t.texto("#certLoteEnvLista") || ""), "e aparece 'sem e-mail da instituição'");
  t.marcar("#certLoteEnvCopia", false);
  await t.assentar(30);

  b.passo("5. Desmarcar um e enviar: só os marcados saem, para quem solicitou");
  t.marcar('#certLoteEnvLista .cert-lote-chk[data-i="2"]', false);
  await t.assentar(20);
  b.ok(/Enviar 2 certificados/.test(el("certLoteEnvConfirmar").textContent), "o botão atualiza para 2");
  t.clicar("#certLoteEnvConfirmar");
  await t.assentar(300);
  b.igual(amb.outbox.length, 2, "dois e-mails saíram");
  b.igual(amb.outbox.map(m => m.to).sort().join(","), "tela1@ficticio.invalid,tela2@ficticio.invalid",
    "para Alice e Bruno, nos e-mails das solicitações");
  b.ok(amb.outbox.every(m => !m.cc), "sem cópia, como foi escolhido");
  b.ok(/2 certificado/.test(t.texto("#certLoteEnvLista") || ""), "a tela mostra o resultado");

  b.passo("6. Abrir a conferência de novo: quem já recebeu vem desmarcado");
  t.clicar("#certLoteEnvCancelar");
  await t.assentar(20);
  ["TELA-01", "TELA-03"].forEach(p => t.marcar('.cert-sel-linha[data-prot="' + p + '"]', true));
  await t.assentar(20);
  t.clicar("#certSelEnviar");
  await t.assentar(200);
  const chks = Array.prototype.slice.call(doc.querySelectorAll("#certLoteEnvLista .cert-lote-chk"));
  b.ok(chks[0] && chks[0].checked === false, "Alice (já enviada) desmarcada");
  b.ok(chks[1] && chks[1].checked === true, "Cíntia (não enviada) marcada");

  b.fluxo("VOUCHER · envio individual com a cópia marcada");
  b.passo("7. Cópia marcada sem e-mail: a tela barra antes de chamar o servidor");
  win.certAbrirEnvio("TELA-02");
  await t.assentar(120);
  b.ok(/datado de hoje/i.test(t.texto("#certEnvDataAviso") || ""), "o modal avisa a data que vai no papel",
    t.texto("#certEnvDataAviso"));
  const antes = t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").length;
  t.marcar("#certEnvCopiaAtiva", true);
  await t.assentar(20);
  t.digitar("#certEnvCopia", "");
  t.clicar("#certEnvBtnEmail");
  await t.assentar(60);
  b.igual(t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").length, antes, "nenhuma chamada ao servidor");

  b.fluxo("VOUCHER · imprimir o já emitido");
  b.passo("8. Imprimir um emitido pede ao servidor o documento datado de hoje");
  win.certDocAbrir({ protocolo: "TELA-03", nome: "CÍNTIA FICTÍCIA", status: "EMITIDO" });
  await t.assentar(150);
  t.clicar("#certDocImprimir");
  await t.assentar(150);
  b.ok(t.chamadas.some(c => c.fn === "voucherDocumentoParaImpressao" && c.args[0] === "TELA-03"),
    "chamou voucherDocumentoParaImpressao para o protocolo certo");
  b.ok(/datada de hoje/i.test(t.texto("#certDocAviso") || ""), "e avisa que a impressão sai datada de hoje",
    t.texto("#certDocAviso"));

  b.resumo();
  process.exit(process.exitCode || 0);
})();
