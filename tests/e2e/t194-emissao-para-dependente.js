/**
 * TESTE — O VOUCHER EMITIDO DIZ PARA QUEM FOI, E DE QUANDO ERA O PEDIDO
 *
 * "Tem que salvar a data da solicitação, e colocar a informação para quem —
 * ex: voucher emitido para o dependente (nome + data)" — você, 22/09/2026.
 *
 * O QUE HAVIA. O PDF saía com `NOME_SOLICITANTE` no nome do arquivo, que numa
 * bolsa de dependente é o pai. Dois filhos do mesmo associado produziam dois
 * arquivos com o MESMO nome de pessoa, diferentes só pelo protocolo — e quem
 * procura na pasta o voucher do Bernardo não tem como saber qual é. A aba
 * `Voucher_Emitidos` tinha o mesmo problema, agravado: guardava o nome do
 * titular e o CPF dele, que são idênticos nas duas linhas, então o histórico
 * de emissões não respondia a única pergunta para a qual ele existe.
 *
 * E não guardava a DATA_SOLICITACAO. Ela é outra coisa que a DATA_EMISSAO:
 * uma diz quando o associado pediu, a outra quando a secretaria emitiu. A
 * distância entre as duas é o prazo de atendimento — sem as duas, não há como
 * medi-lo.
 *
 * O QUE ESTE TESTE NÃO PROVA, e segue "não testado" pela REGRA Nº -1: o PDF
 * de verdade. No emulador o Drive é dublê e a conversão HTML→PDF não roda —
 * o que se mede aqui é o nome do arquivo e a linha gravada.
 */
const b = require("./base");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

b.fluxo("BOLSAS · Emissão para dependente: nome do arquivo e registro");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF = "11144477735";
const TITULAR = "WANDERSON NASCIMENTO CASTELO";
shA.appendRow([CPF, TITULAR, "SIM", "w@teste.com", "27999997777"]);

const b64 = Buffer.from("%PDF-1.4 teste").toString("base64");

/** Um pedido completo, do jeito que o portal manda. */
function pedir(nomeBenef, tipo, ordem, curso) {
  return g.salvarCadastroESolicitacaoVoucher({
    cpf: CPF, nome: TITULAR, dataNascimento: "1980-05-10",
    escolaAtual: "UVV - VILA VELHA", situacaoSindicalDeclarada: "ASSOCIADO",
    email: "w@teste.com", telefone: "27999997777",
    periodoReferencia: new Date().getFullYear() + "/2", regime: "SEMESTRAL",
    tipoBeneficiario: tipo, nomeBeneficiario: nomeBenef, parentesco: tipo,
    dataNascimentoBeneficiario: tipo === "TITULAR" ? "1980-05-10" : "2014-07-19",
    ordemFilho: ordem,
    modalidade: tipo === "TITULAR" ? "POS_GRADUACAO" : "ENSINO_FUNDAMENTAL",
    curso: curso,
    contracheque: { nome: "c.pdf", tipo: "application/pdf", tamanho: 14, base64: b64 },
    docPessoal:   { nome: "d.pdf", tipo: "application/pdf", tamanho: 14, base64: b64 }
  });
}

b.passo("1. a emissão do dependente roda de ponta a ponta");
const envioDep = pedir("BERNARDO SIMOURA CASTELO", "FILHO", "1", "6 SERIE");
const protDep = envioDep && envioDep.protocolo && envioDep.protocolo.numeroProtocolo;
b.ok(!!protDep, "solicitação do dependente criada", protDep);

const aprovDep = g.aprovarSolicitacaoVoucher(protDep, "ok", TOKEN);
b.ok(aprovDep && aprovDep.ok === true, "aprovada", aprovDep && aprovDep.mensagem);

amb.reset();
const emiDep = g.gerarDocumentoVoucher(protDep, "CERTIFICADO", {});
b.ok(emiDep && emiDep.ok === true, "o voucher foi emitido",
  (emiDep && emiDep.mensagem) || "sem retorno");

b.passo("2. o nome do arquivo diz para quem o voucher saiu");
const pdfsDep = amb.driveFiles.filter(function (f) {
  return String(f.name || "").indexOf("Voucher Bolsa") > -1;
});
b.igual(pdfsDep.length, 1, "um PDF foi gravado no Drive",
  pdfsDep.map(function (f) { return f.name; }).join(" | "));

const nomeDep = String(pdfsDep[0].name || "");
b.ok(nomeDep.indexOf("BERNARDO SIMOURA CASTELO") > -1,
  "com o nome do DEPENDENTE, que é quem recebe a bolsa", nomeDep);
b.ok(/dependente de/i.test(nomeDep),
  "dizendo que é de um dependente", nomeDep);
b.ok(nomeDep.indexOf(TITULAR) > -1,
  "e o titular junto — o direito continua sendo dele", nomeDep);

/* A DATA CONTINUA NO NOME, e em ISO: barra é separador de pasta, e só o ISO
   ordena certo quando alguém ordena a pasta por nome. */
const hoje = new Date();
const hojeISO = hoje.getFullYear() + "-" +
  String(hoje.getMonth() + 1).padStart(2, "0") + "-" +
  String(hoje.getDate()).padStart(2, "0");
b.ok(nomeDep.indexOf(hojeISO) === 0,
  "e a data da emissão abrindo o nome", nomeDep);

b.passo("3. a linha de Voucher_Emitidos responde 'para quem' e 'de quando'");
const shE = ss.getSheetByName("Voucher_Emitidos");
b.ok(!!shE, "a aba de emitidos existe");

const cab = shE.getRange(1, 1, 1, shE.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });
["NOME_BENEFICIARIO", "TIPO_BENEFICIARIO", "DATA_SOLICITACAO"].forEach(function (col) {
  b.ok(cab.indexOf(col) > -1, "a coluna " + col + " existe", cab.join(", "));
});

const linhas = shE.getRange(2, 1, Math.max(shE.getLastRow() - 1, 1), shE.getLastColumn()).getValues();
function campo(linha, nome) {
  const i = cab.indexOf(nome);
  return i > -1 ? linha[i] : "";
}
const linhaDep = linhas.filter(function (l) {
  return String(campo(l, "PROTOCOLO") || "") === String(protDep);
})[0];
b.ok(!!linhaDep, "a emissão do dependente foi registrada");

b.igual(String(campo(linhaDep, "NOME_BENEFICIARIO") || ""), "BERNARDO SIMOURA CASTELO",
  "com o nome de quem recebeu a bolsa");
b.igual(String(campo(linhaDep, "NOME_SOLICITANTE") || ""), TITULAR,
  "e o do titular, que continua sendo quem pediu");
b.igual(String(campo(linhaDep, "TIPO_BENEFICIARIO") || ""), "FILHO",
  "com o parentesco, que explica os dois nomes");
b.ok(String(campo(linhaDep, "DATA_SOLICITACAO") || "").trim() !== "",
  "e a data da SOLICITAÇÃO gravada",
  "sem ela não há como medir o prazo entre pedir e emitir");
b.ok(String(campo(linhaDep, "DATA_EMISSAO") || "").trim() !== "",
  "ao lado da data da emissão, que é outra coisa");

/* A ESCRITA É POR NOME DE COLUNA, e esta é a asserção que prova: o
   appendRow posicional que existia antes gravaria a escola no lugar do CPF
   assim que a ordem do cabeçalho mudasse. */
b.igual(String(campo(linhaDep, "CPF") || ""), String(CPF),
  "e cada valor caiu na sua coluna, não na vizinha",
  cab.join(", "));

b.passo("4. contraprova: na bolsa do próprio associado não se inventa dependente");
const envioTit = pedir(TITULAR, "TITULAR", "", "MBA GESTAO");
const protTit = envioTit && envioTit.protocolo && envioTit.protocolo.numeroProtocolo;
b.ok(!!protTit, "solicitação do titular criada", protTit);
g.aprovarSolicitacaoVoucher(protTit, "ok", TOKEN);

amb.reset();
const emiTit = g.gerarDocumentoVoucher(protTit, "CERTIFICADO", {});
b.ok(emiTit && emiTit.ok === true, "emitida", emiTit && emiTit.mensagem);

const nomeTit = String((amb.driveFiles.filter(function (f) {
  return String(f.name || "").indexOf("Voucher Bolsa") > -1;
})[0] || {}).name || "");
b.ok(nomeTit.indexOf(TITULAR) > -1, "o nome do arquivo traz o associado", nomeTit);
b.ok(!/dependente de/i.test(nomeTit),
  "e NÃO diz 'dependente de' — seria falso, e num documento oficial", nomeTit);

b.naoTestavel("o PDF de verdade e a pasta do Drive",
  "no emulador o Drive é dublê e a conversão HTML→PDF não roda — roteiro: " +
  "emitir um voucher de dependente e conferir o nome do arquivo na pasta");
b.resumo();
