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

b.passo("11. O CPF sai no certificado — formatado, e nunca cru");
/* DUAS MUDANÇAS NO MESMO DIA, e vale registrar as duas porque a segunda
 * corrige a primeira:
 *
 *   1. Quando o usuário mandou o documento real, tirei o CPF: o papel de hoje
 *      identifica o titular pelo RG e o beneficiário pelo nome.
 *   2. Ele então pediu "tem que ter o CPF também e identidade". É decisão
 *      dele — é o documento do sindicato dele — e o CPF voltou.
 *
 * O que NÃO muda em nenhuma das duas versões é o que este teste protege
 * desde o começo: se o CPF aparecer, aparece completo e formatado. O número
 * cru de dez dígitos num documento oficial foi o defeito real de 12/08. */
b.ok(String(html).indexOf("085.381.047-80") > -1,
  "o CPF aparece completo e formatado");
b.ok(String(html).indexOf(">8538104780<") === -1 &&
     String(html).indexOf(" 8538104780") === -1,
  "e o número cru de 10 dígitos não aparece em lugar nenhum");
b.ok(/inscrito no CPF sob o nº/.test(html),
  "com a mesma construção que o documento usa para o CNPJ");

b.passo("12. O texto é o do documento real, e muda com quem é o beneficiário");
/* O PDF que o sindicato emite, mandado pelo usuário em 13/08/2026. As frases
 * abaixo são dele, não minhas — é o que separa "documento do sindicato" de
 * "documento que eu achei bonito". */
b.ok(/CERTIFICADO DE HABILITAÇÃO À BOLSA DE ESTUDOS/.test(html), "o título é o do papel");
b.ok(/SINEPE/.test(html), "cita o convênio com o SINEPE-ES");
b.ok(/dependente de <strong>Fulano de Tal<\/strong>/.test(html),
  "beneficiário diferente do titular ganha a oração 'dependente de'");
b.ok(/ano letivo de 2026\/2/.test(html),
  "e bolsa ANUAL diz 'ano letivo', não 'semestre letivo'");

const htmlTitular = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-2026-000002", codigo: "T2", percentual: 50,
  reg: { NOME_SOLICITANTE: "Fulano de Tal", NOME_BENEFICIARIO: "Fulano de Tal",
         TIPO_BENEFICIARIO: "TITULAR", ESCOLA_FANTASIA: "MULTIVIX",
         ESCOLA_SELECIONADA: "EMBRAE S/A", CNPJ_ESCOLA: "01936248000121",
         CURSO: "Direito", PERIODO_REFERENCIA: "2026/1", REGIME: "SEMESTRAL" }
});
b.ok(!/dependente de/.test(htmlTitular),
  "quando o beneficiário é o próprio titular, a oração some");
b.ok(/semestre letivo de 2026\/1/.test(htmlTitular), "e semestral diz 'semestre letivo'");
b.ok(/instituição <strong>MULTIVIX<\/strong>/.test(htmlTitular),
  "a instituição é o NOME FANTASIA");
b.ok(/mantida pela <strong>EMBRAE S\/A<\/strong>/.test(htmlTitular),
  "e a mantenedora é a RAZÃO SOCIAL — os dois já existem no cadastro de Escolas");
b.ok(/01\.936\.248\/0001-21/.test(htmlTitular), "com o CNPJ formatado");

b.passo("13. Oração sem dado não vira 'campo vazio' no documento");
/* "portador da carteira de identidade nº —" num documento oficial é pior que
 * não dizer nada: parece erro de emissão para quem recebe. */
b.ok(!/carteira de identidade/.test(htmlTitular),
  "sem RG, a oração inteira desaparece");
b.ok(!/inscrito no CPF/.test(htmlTitular),
  "e sem CPF, a do CPF também — cada oração some sozinha");

b.passo("14. O RG digitado na emissão fica guardado na linha");
/* Sem isto ele vivia só na tela: reemitir exigia digitar de novo, e quem
 * esquecesse emitia um certificado SEM a oração da identidade — sem aviso,
 * porque omitir é o comportamento certo quando o dado não existe. */
b.seedUsuarios(g);
const TK = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const criada = g.voucherCriarSolicitacao({
  cpf: "11144477735", nome: "Fulano de Tal", modalidade: "GRADUACAO",
  area: "HUMANAS", curso: "Pedagogia", regime: "SEMESTRAL",
  periodo: "2026/1", percentual: 70, aprovar: true
}, TK);
b.ok(criada.ok, "solicitação para emitir", criada.mensagem);

const ssT = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function lerRg(prot) {
  const sh = ssT.getSheetByName("Voucher_Solicitacoes");
  const tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cab = tudo[0].map(c => String(c || "").trim());
  for (let l = tudo.length - 1; l >= 1; l--) {
    if (String(tudo[l][cab.indexOf("NUMERO_PROTOCOLO")] || "").trim() !== prot) continue;
    return String(tudo[l][cab.indexOf("RG_SOLICITANTE")] || "").trim();
  }
  return null;
}
b.igual(lerRg(criada.protocolo), "", "nasce sem RG");
g.voucherGravarRgSolicitante_(criada.protocolo, "1.234.567/SPTC-ES");
b.igual(lerRg(criada.protocolo), "1.234.567/SPTC-ES", "e passa a ter o RG digitado");

b.passo("15. Não grava vazio por cima do que já existe");
/* Emitir de novo sem digitar nada não pode APAGAR o RG guardado — seria o
 * defeito ao contrário, e mais difícil de perceber. */
g.voucherGravarRgSolicitante_(criada.protocolo, "");
b.igual(lerRg(criada.protocolo), "1.234.567/SPTC-ES", "RG vazio não sobrescreve");
b.igual(g.voucherGravarRgSolicitante_("BOLSA-QUE-NAO-EXISTE", "9.9"), false,
  "protocolo inexistente devolve false em vez de escrever em linha errada");

b.passo("16. A marca d'água é imagem própria e embutida");
b.ok(/class='dagua'/.test(htmlTitular), "a marca d'água está no documento");
const marca = g.marcaDaguaVoucher_();
b.ok(String(marca).indexOf("data:") === 0,
  "e vem como data: — URL externa funcionaria na prévia e sumiria no PDF",
  String(marca).slice(0, 30));

/* ══════════════════════════════════════════════════════════════════════
   O DIAGNÓSTICO DAS IMAGENS

   ATENÇÃO AO QUE ESTE BLOCO **NÃO** PROVA. No emulador, DriveApp e UrlFetch
   são simulados e devolvem base64 de mentira — então "as três viram data:"
   aqui é resultado do andaime, não do Drive real. O diagnóstico só vale
   rodado no Apps Script.

   O que dá para provar é o que importa em seguida: que o diagnóstico SABE
   acusar. Um verificador que devolve verde para tudo é pior que não ter
   verificador — passa confiança sem base.
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O diagnóstico das imagens sabe acusar");

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

b.passo("12. A porta dupla protege");
b.bloqueia(() => g.voucherDiagnosticoImagens("token-que-nao-existe"),
  "recusa quem não tem sessão");

b.passo("13. URL externa é acusada — é o defeito que a prévia esconde");
const logoOrig = g.logoSindicatoVoucher_;
const qrOrig = g.gerarQrCodeVoucherUrl_;
g.logoSindicatoVoucher_ = function () { return "https://exemplo.com/logo.png"; };
const comHttp = g.voucherDiagnosticoImagens(TOKEN);
b.ok(!comHttp.ok, "o diagnóstico não fica verde com uma imagem em http");
b.igual(comHttp.falhas, 1, "uma falha contada");
b.igual((comHttp.itens.find(i => /Logo/.test(i.rotulo)) || {}).tipo, "http",
  "e o tipo aparece como http, que é o que some no PDF");

b.passo("14. Imagem vazia também");
g.logoSindicatoVoucher_ = function () { return ""; };
b.igual((g.voucherDiagnosticoImagens(TOKEN).itens.find(i => /Logo/.test(i.rotulo)) || {}).tipo,
  "VAZIO", "vazio é acusado, não tratado como 'sem imagem, tudo bem'");

b.passo("15. O QR é o único marcado como CRÍTICO");
g.logoSindicatoVoucher_ = logoOrig;
g.gerarQrCodeVoucherUrl_ = function () { return ""; };
const semQr = g.voucherDiagnosticoImagens(TOKEN);
b.igual(semQr.criticas, 1, "a falha do QR conta como crítica");
b.ok(/QR/.test(semQr.mensagem), "e a mensagem nomeia o QR", semQr.mensagem);
/* Logo e assinatura faltando são feios; QR faltando quebra a validação do
 * certificado — a escola aponta a câmera e não acontece nada. */
g.gerarQrCodeVoucherUrl_ = qrOrig;
g.logoSindicatoVoucher_ = function () { return ""; };
b.igual(g.voucherDiagnosticoImagens(TOKEN).criticas, 0,
  "já a logo faltando NÃO é crítica — a gravidade não é a mesma");
g.logoSindicatoVoucher_ = logoOrig;

b.passo("16. Com tudo em base64, fica verde");
const limpo = g.voucherDiagnosticoImagens(TOKEN);
b.ok(limpo.ok, "as três em data: — mas isto é o emulador, não o Drive real");
b.naoTestavel("As imagens REAIS (Drive e quickchart) no PDF de produção",
  "DriveApp e UrlFetch são simulados aqui — rodar voucherDiagnosticoImagens() no Apps Script");

b.resumo();
process.exit(0);
