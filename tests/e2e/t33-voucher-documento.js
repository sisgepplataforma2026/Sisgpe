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
/* O papel do TITULAR escreve o período mais curto que o do dependente:
   "do Curso de X semestre 2026/1", sem o "letivo de". Confirmado nos dois
   modelos que o usuário mandou em 18/08/2026 — ver t61. */
b.ok(/semestre 2026\/1/.test(htmlTitular),
  "e o titular semestral diz 'semestre 2026/1', como no papel dele");
b.ok(!/semestre letivo de 2026\/1/.test(htmlTitular),
  "sem o 'letivo de', que é a forma do papel do dependente");
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

/* ══════════════════════════════════════════════════════════════════════
   O PAPEL TIMBRADO

   Este bloco existe porque o cabeçalho e o rodapé DEIXARAM de ser imagem.
   Eram dois JPEG de 1000px (12 KB e 21 KB) e o conversor de PDF do Apps
   Script largou os dois sem avisar — o certificado saía sem timbre e sem
   rodapé, e nenhum teste acusava, porque o HTML continuava perfeito.

   Agora as faixas, os contatos e a tarja do Salmos são retângulos de CSS.
   O que se ganha em robustez se paga em geometria: peça posicionada em
   milímetro pode ATROPELAR peça vizinha, e foi exatamente o que aconteceu
   na primeira versão — as duas últimas linhas de contato caíram dentro da
   tarja azul, texto azul sobre fundo azul. O HTML estava certo; só a
   renderização mostrava.

   Por isso as asserções abaixo leem os NÚMEROS do CSS e checam a relação
   entre eles, em vez de só conferir que a classe existe.
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O documento sai no papel timbrado do sindicato");

const papel = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-PAPEL", codigo: "AAAA-BBBB",
  reg: { NOME_SOLICITANTE: "Fulano de Tal", PERIODO_REFERENCIA: "2026/1" }
});

/* mm declarado para uma propriedade dentro de um seletor */
function mm(seletor, prop) {
  const bloco = new RegExp("\\" + seletor + "\\{([^}]*)\\}").exec(papel);
  if (!bloco) return null;
  const achou = new RegExp("(?:^|;)\\s*" + prop + ":\\s*(-?[\\d.]+)mm").exec(bloco[1]);
  return achou ? Number(achou[1]) : null;
}

b.passo("17. A folha é A4 em milímetro, não em pixel");
b.ok(/@page\{size:A4 portrait;margin:0;\}/.test(papel),
  "a página é declarada A4 retrato sem margem de impressora");
b.igual(mm(".pagina", "width"), 210, "largura de folha A4");
b.igual(mm(".pagina", "min-height"), 297, "altura de folha A4");

/* ── A ARTE PRIMEIRO, O DESENHO DE RESERVA ────────────────────────────
   Este passo era o contrário disto até 13/08/2026, e o contrário estava
   errado. Eu tinha medido UM PDF sem cabeçalho e concluído que o conversor
   largava imagem grande; um segundo PDF, 46 minutos depois, trouxe as duas
   imagens inteiras (12.010 e 21.865 bytes). O que faltava na primeira
   emissão era o arquivo, que ainda não estava no projeto.

   Agora o teste exercita AS DUAS PONTAS — porque reserva que ninguém
   exercita é reserva que não funciona. */
b.passo("18. Com a arte do papel, é a arte que entra");
b.ok(/<img class='cab-img'/.test(papel), "o cabeçalho é a imagem do papel timbrado");
b.ok(/<img class='rod-img'/.test(papel), "e o rodapé também");
b.ok(!/<div class='faixa faixa-azul'>/.test(papel),
  "e o desenho NÃO entra junto — faixa em cima de faixa foi defeito real");
b.ok(String(g.cabecalhoVoucher_()).indexOf("data:") === 0 &&
     String(g.rodapeVoucher_()).indexOf("data:") === 0,
  "as duas vêm embutidas em base64, não de URL externa");

b.passo("19. Sem a arte, o desenho assume — e o documento não sai careca");
const cabOrig = g.cabecalhoVoucher_, rodOrig = g.rodapeVoucher_;
g.cabecalhoVoucher_ = function () { return ""; };
g.rodapeVoucher_ = function () { return ""; };
const reserva = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-RESERVA", codigo: "X1",
  reg: { NOME_SOLICITANTE: "Fulano de Tal" }
});
g.cabecalhoVoucher_ = cabOrig; g.rodapeVoucher_ = rodOrig;
b.ok(!/<img class='cab-img'/.test(reserva) && !/<img class='rod-img'/.test(reserva),
  "sem a arte, nenhuma das duas imagens é escrita");
b.ok(/<div class='faixa faixa-azul'>/.test(reserva) && /<div class='faixa faixa-rosa'>/.test(reserva),
  "as faixas passam a ser desenhadas");
b.ok(/rod-tarja/.test(reserva) && /Salmos 128:2/.test(reserva),
  "a tarja do Salmos vai como texto");
/* Endereços conferidos com o usuário em 13/08/2026. Valem para o desenho; a
 * arte tem os antigos gravados dentro do JPEG e só muda trocando a imagem. */
b.ok(/secretaria@sindeducacao\.com/.test(reserva) && /www\.sindeducacao\.com/.test(reserva),
  "com o e-mail e o site corretos");
b.ok(String(g.logoVoucherPapel_()).indexOf("data:") === 0,
  "e a logo pequena do desenho é embutida em base64");

b.passo("20. No desenho, as faixas se sobrepõem em vez de virar escada");
const azulTopo = mm(".faixa-azul", "top");
const rosaTopo = mm(".faixa-rosa", "top");
b.ok(Math.abs(azulTopo - rosaTopo) <= 2,
  "rosa e azul no mesmo nível (≤2mm de diferença), como no papel real",
  "azul " + azulTopo + "mm, rosa " + rosaTopo + "mm");
b.ok(rosaTopo < azulTopo, "com a rosa por cima, ligeiramente acima");

b.passo("21. E o rodapé desenhado não atropela a si mesmo");
const tarjaBase = mm(".rod-tarja", "bottom");
const contatosBase = mm(".rod-contatos", "bottom");
const validaBase = mm(".valida-box", "bottom");
/* 12mm é a altura da tarja com folga: 3mm de padding em cima, 3mm embaixo e
 * uma linha de 11pt (≈3,9mm). Quem ficar abaixo disso entra no azul. */
const TETO_TARJA = tarjaBase + 12;
b.ok(contatosBase >= TETO_TARJA,
  "os contatos começam ACIMA da tarja azul",
  "contatos em " + contatosBase + "mm, topo da tarja em ~" + TETO_TARJA + "mm");
b.ok(validaBase >= TETO_TARJA,
  "o código de validação e o QR também",
  "validação em " + validaBase + "mm");
b.ok(tarjaBase > 0, "e a tarja não encosta na borda de baixo da folha");

b.passo("22. O QR e o código de validação FICAM — decisão do usuário, travada aqui");
/* 13/08/2026. Eu apontei que o certificado de referência do sindicato não tem
 * QR nem código; o usuário respondeu "manter o QR code e código de validação".
 * Está escrito neste teste, e não só num comentário, porque comentário não
 * impede ninguém de "limpar" o que parece sobra. Aqui, quebra. */
const comQr = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-QR", codigo: "ZZZZ-9999",
  reg: { NOME_SOLICITANTE: "Fulano de Tal" }
});
b.ok(/class='valida-qr'/.test(comQr), "o QR está no documento");
b.ok(/Código ZZZZ-9999/.test(comQr), "e o código de validação também");
b.ok(/BOLSA-QR/.test(comQr), "com o protocolo embaixo");

/* ══════════════════════════════════════════════════════════════════════
   A REDAÇÃO É A DO PAPEL

   "Texto tem que ser o padrão que te enviei" — usuário, 13/08/2026. A
   redação anterior era invenção minha: dizia a mesma coisa com outras
   palavras. Num documento que a escola confere contra o que já recebeu
   antes, "a mesma coisa com outras palavras" é problema, não estilo.

   Os trechos abaixo foram EXTRAÍDOS do certificado real
   (GLAUCIA_SOUZA_NRAMOS.pdf) com PyMuPDF, não transcritos de memória.
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · A redação é a do certificado que o sindicato emite");

const red = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-RED", codigo: "R1", percentual: 60,
  rg: "2079656 SPTC ES",
  reg: {
    NOME_SOLICITANTE: "Glaucia Souza Ramos", TIPO_BENEFICIARIO: "TITULAR",
    CURSO: "ENGENHARIA DE PRODUÇÃO EAD", REGIME: "SEMESTRAL",
    PERIODO_REFERENCIA: "2026/2",
    ESCOLA_FANTASIA: "MULTIVIX - SERRA",
    ESCOLA_SELECIONADA: "EMPRESA CAPIXABA DA SERRA ENS. PESQ. EXTENSÃO",
    CNPJ_ESCOLA: "11062400000148"
  }
});

b.passo("23. As orações do papel, palavra por palavra");
b.ok(/em conformidade com a cláusula de Incentivo ao Aprimoramento prevista na/.test(red),
  "cita a cláusula de Incentivo ao Aprimoramento — era 'nos termos do convênio'");
b.ok(/atende aos requisitos estabelecidos para a concessão do benefício de/.test(red),
  "'atende aos requisitos estabelecidos' — era 'encontra-se regularmente habilitado'");
b.ok(/de desconto sobre matrícula, rematrícula e semestralidade\/anuidade escolar/.test(red),
  "'semestralidade/anuidade escolar' — a nossa dizia só 'semestralidade'");
b.ok(/A presente certificação destina-se à comprovação da habilitação do beneficiário ao referido desconto, nos termos da Convenção Coletiva de Trabalho vigente, para fins de utilização junto à instituição de ensino acima identificada\./.test(red),
  "e o segundo parágrafo inteiro é o do papel");
b.ok(!/pessoal, individual e intransferível/.test(red),
  "a redação antiga saiu de vez — não ficou meio a meio");

b.passo("24. O ano da CCT sai da fonte única, não fixo no texto");
b.igual(g.cctVigenteVoucher_(), "2026/2027",
  "vem de NEGCOL_VIGENCIA, que é onde a CCT vigente já era declarada");
b.ok(/Convenção Coletiva de Trabalho 2026\/2027, firmada com o/.test(red),
  "e é esse ano que entra no certificado");
/* O papel de referência foi emitido em agosto de 2026 citando "2025/2026" —
 * CCT vencida em 28/02/2026. É exatamente o erro que amarrar à fonte evita:
 * trocada a CCT, o certificado acompanha sem ninguém lembrar dele. */
b.ok(!/2025\/2026/.test(red),
  "e NÃO sai a CCT vencida que o papel de referência citava");

b.passo("24. Sem a fonte, omite o ano — nunca escreve 'undefined'");
const vigOrig = g.NEGCOL_VIGENCIA;
g.NEGCOL_VIGENCIA = null;
b.igual(g.cctVigenteVoucher_(), "vigente", "cai para 'vigente', que é verdade e não quebra a frase");
g.NEGCOL_VIGENCIA = { identificacao: "sem ano nenhum aqui" };
b.igual(g.cctVigenteVoucher_(), "vigente", "identificação sem ano também");
g.NEGCOL_VIGENCIA = vigOrig;
b.igual(g.cctVigenteVoucher_(), "2026/2027", "e volta ao normal quando a fonte volta");

b.naoTestavel("A aparência final do PDF convertido pelo Apps Script",
  "conferir emitindo um certificado no ar e comparando com o papel do sindicato");

b.resumo();
process.exit(0);
