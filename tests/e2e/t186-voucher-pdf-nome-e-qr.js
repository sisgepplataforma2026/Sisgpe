/**
 * TESTE — A DATA NO NOME DO ARQUIVO, E O QR FORA DO DOCUMENTO
 *
 * Pedido do usuário em 16/09/2026, com o PDF que chegou por e-mail na mão:
 * "Faltou a data no nome do arquivo, tem que tirar o qr code".
 *
 * O QR ESTAVA QUEBRADO, e isso só apareceu ao conferir antes de mexer (REGRA
 * Nº 1, os 5 passos): ele apontava para `?page=pub-validar-voucher`, e essa
 * rota NÃO EXISTE no doGet do Code.gs. Quem apontasse a câmera não chegava a
 * lugar nenhum — num documento oficial que a instituição de ensino recebe.
 *
 * O QUE NÃO FOI APAGADO, de propósito: `gerarQrCodeVoucherUrl_` e
 * `validarVoucherPublico` continuam no projeto. Validar por código é função
 * que o sindicato pode querer de volta com a página feita, e a REGRA Nº 1
 * manda manter e documentar em vez de remover. O que mudou é o que é impresso.
 */
const b = require("./base");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF = "11144477735";
shA.appendRow([CPF, "MARIA DE TESTE", "SIM", "maria@teste.com", "27999997777"]);

const b64 = Buffer.from("%PDF-1.4 teste").toString("base64");
const envio = g.salvarCadastroESolicitacaoVoucher({
  cpf: CPF, nome: "MARIA DE TESTE", dataNascimento: "1980-05-10",
  escolaAtual: "COLEGIO DE TESTE", situacaoSindicalDeclarada: "ASSOCIADO",
  email: "maria@teste.com", telefone: "27999997777",
  periodoReferencia: new Date().getFullYear() + "/2", regime: "SEMESTRAL",
  tipoBeneficiario: "TITULAR", nomeBeneficiario: "MARIA DE TESTE",
  dataNascimentoBeneficiario: "1980-05-10",
  modalidade: "POS_GRADUACAO", curso: "MBA GESTAO",
  contracheque: { nome: "c.pdf", tipo: "application/pdf", tamanho: 14, base64: b64 },
  docPessoal:   { nome: "r.jpg", tipo: "image/jpeg",      tamanho: 12, base64: b64 }
});
const protocolo = envio && envio.protocolo && envio.protocolo.numeroProtocolo;
b.fluxo("BOLSAS · O arquivo do voucher e o que está impresso nele");

b.passo("1. A emissão roda de ponta a ponta");
b.ok(!!protocolo, "solicitação criada", protocolo);
const aprov = g.aprovarSolicitacaoVoucher(protocolo, "ok", TOKEN);
b.ok(aprov && aprov.ok === true, "aprovada", aprov && aprov.mensagem);

/* A PRÉVIA SAI ANTES DA EMISSÃO, e isto foi um defeito do teste antes de ser
   uma ordem: pedida depois, com a solicitação já EMITIDO, ela voltava vazia —
   e as asserções "não tem QR" passavam sobre uma string vazia. Asserção que
   passa por vacuidade é pior do que asserção nenhuma. Abaixo há uma trava
   explícita de tamanho para isso não voltar. */
const previa = g.gerarDocumentoVoucher(protocolo, "PREVIA", {});

amb.reset();
const emissao = g.gerarDocumentoVoucher(protocolo, "CERTIFICADO", {});
b.ok(emissao && emissao.ok === true, "o voucher foi emitido",
  (emissao && emissao.mensagem) || "sem retorno");

b.passo("2. A DATA no nome do arquivo");
/* O arquivo de verdade, na lista que o emulador guarda do Drive — não o nome
   que eu esperaria ler no código. */
const pdfs = amb.driveFiles.filter(function (f) {
  return String(f.name || "").indexOf("Voucher Bolsa") > -1;
});
b.igual(pdfs.length, 1, "um PDF de voucher foi gravado no Drive",
  pdfs.map(function (f) { return f.name; }).join(" | "));

const nome = String(pdfs[0].name || "");
const hoje = new Date();
const esperado = hoje.getFullYear() + "-" +
  String(hoje.getMonth() + 1).padStart(2, "0") + "-" +
  String(hoje.getDate()).padStart(2, "0");

b.ok(nome.indexOf(esperado) === 0,
  "o nome COMEÇA com a data de hoje, em AAAA-MM-DD", nome);
b.ok(nome.indexOf(protocolo) > -1, "e continua trazendo o protocolo");
b.ok(nome.indexOf("MARIA DE TESTE") > -1, "e o nome de quem recebe");

/* BARRA NÃO PODE APARECER: o formato brasileiro dd/MM/yyyy viraria caminho de
   pasta, e o sanitizador de nome a trocaria por outra coisa. */
b.ok(nome.indexOf("/") === -1, "sem barra — não é dd/MM/yyyy, que quebraria o nome");

/* A ORDEM ALFABÉTICA DA PASTA VIRA ORDEM CRONOLÓGICA, que é o ganho real de
   pôr a data na frente: quem abre a pasta do Drive acha "os de setembro"
   juntos. Dois nomes gerados com datas diferentes têm de ordenar certo. */
const antigo = "2026-01-05 - Voucher Bolsa - X - A";
const novo   = "2026-09-16 - Voucher Bolsa - X - A";
b.ok(antigo < novo, "e a ordenação alfabética da pasta fica cronológica");

b.passo("3. O QR não é mais impresso");
const html = (previa && previa.html) || "";
b.ok(previa && previa.ok === true, "a prévia do documento foi gerada",
  (previa && previa.mensagem) || "sem retorno");
/* A TRAVA CONTRA A VACUIDADE: sem um piso de tamanho, um HTML vazio faria
   todas as asserções de ausência abaixo passarem sem provar nada. */
b.ok(html.length > 5000, "e veio com o documento inteiro", html.length + " chars");
b.ok(html.indexOf("valida-qr") === -1, "nenhuma imagem de QR no documento");
b.ok(html.indexOf("quickchart.io") === -1, "e nenhuma chamada ao gerador de QR");

/* E O CÓDIGO TAMBÉM SAIU — 23/09/2026, você com o certificado emitido na
   mão: "pode tirar isso". Era o bloco cinza do rodapé, com "Código VAL-…" e
   o protocolo. Os dois modelos do sindicato não trazem nada disso, e o que
   esse código validaria é uma página pública que não existe: num documento
   oficial, é ruído com aparência de segurança.

   O CÓDIGO CONTINUA SENDO GERADO E GRAVADO — a asserção logo abaixo prova
   isso. O que acabou foi a impressão dele. */
b.ok(html.indexOf("Código VAL-") === -1,
  "o código de validação NÃO é mais impresso",
  (html.match(/C[óo]digo[^<]{0,30}/) || ["(não achou)"])[0]);
/* Mede o BLOCO, não a classe: `.valida-box` continua no CSS de propósito,
   para voltar a servir no dia em que a página de validação existir. */
b.ok(html.indexOf("<div class='valida-box'>") === -1,
  "e o bloco do rodapé não é mais desenhado");
/* O protocolo sai do CORPO do documento. No <title> ele fica — é o nome da
   aba e do arquivo, não texto impresso na folha. */
const corpoDoc = html.slice(html.indexOf("<body"));
b.ok(corpoDoc.indexOf(protocolo) === -1,
  "o protocolo também sai do papel — ele vive no painel, não no documento",
  (corpoDoc.match(new RegExp("[^>]{0,40}" + protocolo)) || ["(não achou)"])[0]);

/* A CONTRAPROVA que impede isto de virar perda de dado: a emissão continua
   devolvendo o código, e é ele que vai para Voucher_Emitidos e o histórico. */
b.ok(!!(emissao && emissao.codigoValidacao),
  "a emissão continua gerando o código de validação",
  (emissao && emissao.codigoValidacao) || "(vazio)");

b.passo("4. A emissão não vai mais à internet buscar imagem de QR");
/* Era o custo escondido: um UrlFetch por bolsa emitida, com tempo de espera e
   chance de falha, para produzir uma imagem que o documento descartava. */
const idasAoQr = amb.fetches.filter(function (f) {
  return String(f.url || f || "").indexOf("quickchart") > -1;
});
b.igual(idasAoQr.length, 0, "nenhuma ida ao quickchart.io durante a emissão");

b.passo("5. O que NÃO foi apagado");
/* REGRA Nº 1: na dúvida, o arquivo fica. Validar por código é função que o
   sindicato pode querer de volta — falta a página pública, não o código. */
b.igual(typeof g.gerarQrCodeVoucherUrl_, "function",
  "gerarQrCodeVoucherUrl_ continua no projeto, só não é chamada na emissão");
b.igual(typeof g.validarVoucherPublico, "function",
  "validarVoucherPublico continua no projeto");

b.naoTestavel("o PDF impresso",
  "o conversor de HTML do Apps Script não roda no emulador — roteiro manual: " +
  "emitir um voucher e conferir que o canto inferior direito traz só o código " +
  "e o protocolo, sem o quadrado do QR");
b.resumo();
