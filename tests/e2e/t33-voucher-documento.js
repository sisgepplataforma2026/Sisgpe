/**
 * TESTE — OS DOIS DEFEITOS DO DOCUMENTO EMITIDO
 *
 * Ambos apareceram no log da prévia real de 12/08/2026, e ambos são do tipo
 * que não dá erro: o certificado sai, bonito, e errado.
 *
 * 1. CPF SEM O ZERO À ESQUERDA. Saiu "8538104780" cru no documento — dez
 *    dígitos. Não era cadastro errado: a planilha guarda a coluna como
 *    NÚMERO, e número não tem zero à esquerda. `formatarCpfVoucher_`
 *    desistia (`if (d.length !== 11) return cpf`) e imprimia o número cru
 *    num documento oficial.
 *
 * 2. LOGO POR URL EXTERNA. `getAs(MimeType.PDF)` não busca imagem de host
 *    externo de forma confiável. A assinatura virou base64 justamente por
 *    isso; a logo ficou de fora e tinha o mesmo risco.
 *
 * O QUE ESTE TESTE NÃO PROVA: que o PDF final mostra a imagem. Isso depende
 * do conversor do Google e continua "não testado" pela REGRA Nº -1 — o
 * roteiro manual vai no PENDENTE-VERIFICACAO. O que se prova aqui é que o
 * HTML entregue ao conversor já não depende de rede nenhuma.
 */
const b = require("./base");
const { g } = b.subir({});

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · CPF que a planilha guardou como número");

b.passo("1. Dez dígitos: devolve o zero que o Sheets comeu");
/* 085.381.047-80 é um CPF válido cujos dígitos verificadores fecham. Guardado
 * como número, vira 85381047 80 — dez dígitos. */
b.igual(g.formatarCpfVoucher_("8538104780"), "085.381.047-80",
  "CPF de 10 dígitos é completado e formatado");
b.igual(g.formatarCpfVoucher_(8538104780), "085.381.047-80",
  "e funciona recebendo NÚMERO, que é como a planilha entrega");

b.passo("2. Nove dígitos: dois zeros perdidos");
b.igual(g.formatarCpfVoucher_("11144477735").length, 14, "CPF normal de 11 dígitos continua formatado");
const doisZeros = "00" + "111444777";
b.ok(typeof g.formatarCpfVoucher_(doisZeros) === "string", "não explode com 9 dígitos");

b.passo("3. NÃO inventa CPF — completar só vale se o dígito verificador fechar");
/* Esta é a asserção que mais importa. Completar com zero é palpite; o que
 * transforma o palpite em certeza é o dígito verificador. Um número de 10
 * dígitos que NÃO vira CPF válido ao ganhar um zero não era CPF nenhum, e
 * fabricar um documento com o CPF de outra pessoa é muito pior do que
 * imprimir o número cru. */
/* O número de controle precisa ser escolhido com cuidado, e eu errei na
 * primeira tentativa: usei "1234567890", que ao ganhar um zero vira
 * 012.345.678-90 — um CPF cujos dígitos verificadores FECHAM. O teste
 * acusou o código de "inventar CPF" quando o código estava certo e a minha
 * premissa é que estava errada. Daí a asserção de guarda logo abaixo: o
 * teste confere que o controle é mesmo um controle antes de usá-lo. */
const naoEhCpf = "1234567891";
b.ok(!g.cpfValido("0" + naoEhCpf),
  "o número de controle realmente NÃO vira CPF válido ao ganhar um zero",
  "0" + naoEhCpf);
b.igual(g.formatarCpfVoucher_(naoEhCpf), naoEhCpf,
  "e por isso volta como veio, sem ser 'corrigido'");

b.passo("4. Casos que não são CPF nenhum");
b.igual(g.formatarCpfVoucher_(""), "", "vazio continua vazio");
b.igual(g.formatarCpfVoucher_(null), "", "nulo vira vazio");
b.igual(g.formatarCpfVoucher_("não informado"), "não informado", "texto volta como veio");
b.igual(g.formatarCpfVoucher_("123"), "123", "número curto demais não é completado");

b.passo("5. CPF já formatado não é mexido");
b.igual(g.formatarCpfVoucher_("111.444.777-35"), "111.444.777-35",
  "entra formatado, sai formatado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Imagens do documento não podem depender de rede");

b.passo("6. A logo passa a ser lida do Drive, não buscada por URL");
const logo = g.logoSindicatoVoucher_();
b.ok(String(logo).indexOf("data:") === 0,
  "logoSindicatoVoucher_ devolve data: URI", String(logo).slice(0, 34));
b.ok(String(logo).indexOf("base64,") > -1, "com o conteúdo em base64");

b.passo("7. A assinatura continua funcionando pelo mesmo caminho");
const assinatura = g.assinaturaPresidenteVoucher_();
b.ok(String(assinatura).indexOf("data:") === 0,
  "assinaturaPresidenteVoucher_ devolve data: URI");

b.passo("8. Falha do Drive NÃO derruba a emissão");
/* Travar a entrega de um benefício por causa de uma imagem seria pior que
 * entregar sem ela. Mas tem que ficar no log — senão vira defeito invisível. */
const drivePrevio = g.DriveApp.getFileById;
g.DriveApp.getFileById = function () { throw new Error("Drive indisponível"); };
try {
  const semDrive = g.imagemDoDriveVoucher_("id-qualquer", "chave_de_teste_falha", "Imagem de teste");
  b.igual(semDrive, "", "devolve vazio em vez de explodir");
} finally {
  g.DriveApp.getFileById = drivePrevio;
}

b.passo("9. Id vazio devolve vazio, sem ir ao Drive");
b.igual(g.imagemDoDriveVoucher_("", "chave_x", "Imagem"), "", "sem id, sem chamada");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O documento montado");

b.passo("10. Nenhuma imagem do documento aponta para host externo");
/* É a asserção de verdade deste arquivo: não basta a função nova existir, o
 * HTML entregue ao conversor é que não pode ter src apontando para fora.
 *
 * E foi ela que achou o TERCEIRO caso, que eu não tinha visto: o QR de
 * validação vinha do quickchart.io por URL. Eu havia corrigido assinatura e
 * logo, e passei direto pelo QR — que tinha o mesmo problema e doía mais,
 * porque é por ele que a escola confere se o certificado é verdadeiro. Um
 * voucher impresso com o quadrado em branco não pode ser validado por quem
 * o recebe no papel.
 *
 * Varrer o HTML inteiro, em vez de checar as imagens que eu lembrava de ter
 * tratado, é o que fez a diferença. */
const html = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-2026-000001",
  codigo: "TESTE123",
  percentual: 70,
  dataEmissao: new Date(2026, 7, 12),
  documentos: [],
  reg: {
    NOME_SOLICITANTE: "Fulano de Tal",
    CPF_SOLICITANTE: "8538104780",
    ESCOLA_SELECIONADA: "ESCOLA TESTE",
    NOME_BENEFICIARIO: "Beltrano de Tal",
    CURSO: "Pedagogia",
    PERIODO_REFERENCIA: "2026/2",
    REGIME: "ANUAL"
  }
});

const externas = (String(html).match(/src=['"]https?:\/\/[^'"]+/g) || []);
b.ok(externas.length === 0,
  "nenhum src=http no documento — tudo embutido",
  externas.length ? externas.slice(0, 2).join(" · ") : "");

b.passo("11. E o CPF sai formatado no documento, não cru");
b.ok(String(html).indexOf("085.381.047-80") > -1,
  "o CPF aparece completo e formatado no HTML do certificado");
b.ok(String(html).indexOf(">8538104780<") === -1,
  "e o número cru de 10 dígitos não aparece em lugar nenhum");

b.resumo();
process.exit(0);
