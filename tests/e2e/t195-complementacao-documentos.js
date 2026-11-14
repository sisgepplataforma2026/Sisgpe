/**
 * TESTE — PEDIR COMPLEMENTAÇÃO DIZENDO QUAIS DOCUMENTOS FALTAM
 *
 * O QUE ORIGINOU (22/09/2026, você, em duas mensagens seguidas):
 *   "Essa complementação eu deveria informar quais documentos estariam
 *    pendentes"
 *   "Mas o sistema encaminhou direto! Não entendi"
 *
 * A EXPLICAÇÃO DO "ENCAMINHOU DIRETO", e ela é o centro deste teste: a trava
 * de "escreva o que está faltando" existia e não pegou, porque o campo de
 * observação NÃO ESTAVA VAZIO — ele já vinha preenchido pelo próprio sistema
 * ("Solicitação enquadrada por ordem do filho. | Escola não localizada no
 * cadastro de escolas."). Era anotação interna da análise, e foi ela que saiu
 * no e-mail do associado como se fosse o pedido de documento. A pessoa
 * recebeu uma mensagem que não nomeia documento nenhum.
 *
 * O que se mede aqui: que a observação interna NÃO vai mais para o associado,
 * que a lista marcada vai, que ela fica gravada em coluna própria, e que o
 * botão da fileira deixou de enviar.
 *
 * NÃO TESTADO pela REGRA Nº -1: o e-mail chegando na caixa de verdade e a
 * aparência do bloco na tela — jsdom não aplica CSS e o envio é dublê.
 */
const b = require("./base");
const dom = require("./dom");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

b.fluxo("BOLSAS · A complementação diz quais documentos faltam");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF = "11144477735";
const TITULAR = "WANDERSON NASCIMENTO CASTELO";
const EMAIL = "w@teste.com";
shA.appendRow([CPF, TITULAR, "SIM", EMAIL, "27999997777"]);

const b64 = Buffer.from("%PDF-1.4 teste").toString("base64");
const envio = g.salvarCadastroESolicitacaoVoucher({
  cpf: CPF, nome: TITULAR, dataNascimento: "1980-05-10",
  escolaAtual: "UVV - VILA VELHA", situacaoSindicalDeclarada: "ASSOCIADO",
  email: EMAIL, telefone: "27999997777",
  periodoReferencia: new Date().getFullYear() + "/2", regime: "SEMESTRAL",
  tipoBeneficiario: "FILHO", nomeBeneficiario: "BERNARDO SIMOURA CASTELO",
  parentesco: "FILHO", dataNascimentoBeneficiario: "2014-07-19", ordemFilho: "1",
  modalidade: "ENSINO_FUNDAMENTAL", curso: "6 SERIE",
  contracheque: { nome: "c.pdf", tipo: "application/pdf", tamanho: 14, base64: b64 },
  docPessoal:   { nome: "d.pdf", tipo: "application/pdf", tamanho: 14, base64: b64 }
});
const PROT = envio && envio.protocolo && envio.protocolo.numeroProtocolo;
b.passo("1. a solicitação existe e já nasce com observação do sistema");
b.ok(!!PROT, "solicitação criada", PROT);

/* A OBSERVAÇÃO AUTOMÁTICA É O GATILHO DO DEFEITO. Reproduzo exatamente o que
   o print mostrava: um texto interno, gravado pelo sistema, no campo que a
   tela usava como mensagem para o associado. */
const OBS_INTERNA = "Solicitação enquadrada por ordem do filho. | Escola não localizada no cadastro de escolas.";

b.passo("2. nada é enviado sem dizer o que falta");
amb.reset();
const vazio = g.solicitarComplementacaoCertBolsa(PROT, OBS_INTERNA, TOKEN, { documentos: [], detalhe: "" });
b.ok(vazio && vazio.ok === false,
  "pedido sem nenhum documento e sem detalhe é recusado", vazio && vazio.mensagem);
/* A ASSERÇÃO QUE PROVA O DEFEITO ANTIGO: a observação interna, sozinha, não
   autoriza mais o envio. Antes ela passava pela trava e virava o e-mail. */
b.igual(amb.outbox.length, 0, "e nenhum e-mail saiu",
  amb.outbox.map(function (x) { return x.subject; }).join(" | "));

b.passo("3. com a lista marcada, o e-mail sai dizendo cada documento");
amb.reset();
const DOCS = [
  "Contracheque do titular (o mais recente)",
  "Documento do dependente (BERNARDO SIMOURA CASTELO), com CPF e data de nascimento"
];
const res = g.solicitarComplementacaoCertBolsa(PROT, OBS_INTERNA, TOKEN, {
  documentos: DOCS,
  detalhe: "O contracheque precisa ser de agosto."
});
b.ok(res && res.ok === true, "o pedido foi aceito", res && res.mensagem);
b.ok(/2 documentos pedidos/.test(String(res.mensagem || "")),
  "e a confirmação diz quantos foram pedidos", res && res.mensagem);

const paraAssociado = amb.outbox.filter(function (x) { return String(x.to || "") === EMAIL; });
b.igual(paraAssociado.length, 1, "um e-mail saiu para o associado",
  amb.outbox.map(function (x) { return x.to; }).join(" | "));

const corpo = String(paraAssociado[0].htmlBody || "");
DOCS.forEach(function (d) {
  b.ok(corpo.indexOf(d.replace(/&/g, "&amp;")) > -1,
    "o e-mail nomeia: " + d.slice(0, 40), corpo.slice(0, 200));
});
b.ok(/<li/.test(corpo),
  "cada documento em linha própria — um parágrafo corrido faz mandar um e esquecer o resto");
b.ok(corpo.indexOf("O contracheque precisa ser de agosto.") > -1,
  "o detalhe livre também vai, separado da lista");
b.ok(corpo.indexOf("BERNARDO SIMOURA CASTELO") > -1,
  "e o e-mail diz de quem é a bolsa — quem tem três filhos recebe três mensagens parecidas");

/* O CORAÇÃO DESTE TESTE. */
b.ok(corpo.indexOf("Escola não localizada no cadastro de escolas") === -1,
  "a observação INTERNA do sistema não vai para o associado",
  "era exatamente ela que saía no e-mail antes de 22/09/2026");

b.passo("4. o que foi pedido fica gravado, não só enviado");
const sh = ss.getSheetByName("Voucher_Solicitacoes");
const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });
b.ok(cab.indexOf("DOCUMENTOS_PENDENTES") > -1, "a coluna DOCUMENTOS_PENDENTES existe");
b.ok(cab.indexOf("DATA_COMPLEMENTACAO") > -1, "e a DATA_COMPLEMENTACAO também");

const linhas = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
const linha = linhas.filter(function (l) {
  return String(l[cab.indexOf("NUMERO_PROTOCOLO")] || "") === String(PROT);
})[0];
b.ok(!!linha, "a solicitação foi encontrada na planilha");

const pendentes = String(linha[cab.indexOf("DOCUMENTOS_PENDENTES")] || "");
b.ok(pendentes.indexOf("Contracheque do titular") > -1,
  "com os documentos pedidos gravados", pendentes);
b.ok(pendentes.indexOf("O contracheque precisa ser de agosto.") > -1,
  "incluindo o detalhe livre");
b.ok(String(linha[cab.indexOf("DATA_COMPLEMENTACAO")] || "").trim() !== "",
  "e a data em que se pediu");
b.igual(String(linha[cab.indexOf("STATUS_SOLICITACAO")] || ""), "ANALISE",
  "a solicitação vai para a fila de análise — complementação não encerra nada");
/* A OBSERVAÇÃO CONTINUA SENDO A INTERNA: é o registro do analista, e ele não
   se perde por causa do pedido. */
b.igual(String(linha[cab.indexOf("OBSERVACOES")] || ""), OBS_INTERNA,
  "e a observação interna permanece como observação interna");

/* ═══ A TELA ═══════════════════════════════════════════════════════════════ */
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("O bloco de complementação na tela", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win;
  win.initCertificadoAdmin();
  await t.assentar(80);

  const alvo = (g.listarSolicitacoesCertBolsa(TOKEN) || []).filter(function (x) {
    return x.protocolo === PROT;
  })[0];
  win.certAbrirSolicitacao(alvo);
  await t.assentar(40);

  b.passo("5. o botão da fileira ABRE o pedido, não envia");
  const antes = t.chamadas.length;
  doc.getElementById("certBtnComplementar")
     .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await t.assentar(60);

  b.igual(t.chamadas.length, antes,
    "clicar em 'Solicitar Complementação' não manda nada ao servidor",
    "era esse clique que 'encaminhava direto'");
  b.ok(doc.getElementById("certCompBox").style.display !== "none",
    "em vez disso, o pedido abre na tela");
  b.igual(doc.getElementById("certModalAcoes").style.display, "none",
    "e as ações somem — aprovar no meio de escrever é o clique errado mais fácil");

  b.passo("6. a lista oferece o documento do dependente, porque a bolsa é dele");
  const itens = Array.from(doc.querySelectorAll("#certCompLista .cert-comp-item"));
  b.ok(itens.length >= 4, "há itens para marcar", itens.length + "");
  const textos = itens.map(function (el) { return el.getAttribute("data-txt") || ""; });
  b.ok(textos.some(function (x) { return /dependente/i.test(x); }),
    "com o documento do dependente entre eles", textos.join(" | "));
  b.ok(textos.some(function (x) { return /BERNARDO/i.test(x); }),
    "nomeando a criança, para não marcar o item do filho errado");
  b.ok(textos.some(function (x) { return /Contracheque do titular/i.test(x); }),
    "e o contracheque do titular");

  b.passo("7. nada marcado não envia — e o aviso aparece antes da viagem");
  const antes2 = t.chamadas.length;
  doc.getElementById("certCompEnviar")
     .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await t.assentar(60);
  b.igual(t.chamadas.length, antes2, "sem marcar nada, o envio não sai da tela");

  b.passo("8. marcado, a prévia mostra o que o associado vai ler");
  itens[0].checked = true;
  itens[0].dispatchEvent(new win.Event("change", { bubbles: true }));
  await t.assentar(30);
  const previa = doc.getElementById("certCompPrevia").textContent;
  b.ok(previa.indexOf("Contracheque do titular") > -1,
    "a prévia traz o documento marcado", previa);
  b.ok(previa.indexOf("BERNARDO SIMOURA CASTELO") > -1,
    "e diz de quem é a bolsa", previa);

  b.passo("9. o envio leva a lista ao servidor");
  doc.getElementById("certCompDetalhe").value = "Precisa ser do mês passado.";
  doc.getElementById("certCompEnviar")
     .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await t.assentar(120);

  const enviadas = t.chamadas.filter(function (c) {
    return c.fn === "solicitarComplementacaoCertBolsa";
  });
  b.igual(enviadas.length, 1, "a chamada chegou ao servidor");
  const args = enviadas[0].args;
  b.ok(args[3] && Array.isArray(args[3].documentos) && args[3].documentos.length === 1,
    "com a lista de documentos no quarto argumento",
    JSON.stringify(args[3]));
  b.igual(String(args[3].detalhe || ""), "Precisa ser do mês passado.",
    "e o detalhe livre junto");
  /* O SEGUNDO ARGUMENTO CONTINUA SENDO A OBSERVAÇÃO — ela vai para a
     planilha, não para o e-mail. Esta asserção guarda a separação. */
  b.ok(typeof args[1] === "string",
    "a observação continua indo em separado, como observação");

  b.naoTestavel("o e-mail chegando na caixa e a aparência do bloco",
    "o envio é dublê no emulador e jsdom não aplica CSS — roteiro: pedir " +
    "complementação de uma bolsa de teste e conferir a mensagem recebida");
  b.resumo();
})();
