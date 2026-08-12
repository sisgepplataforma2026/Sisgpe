// =============================================================================
// ARQUIVO: VoucherPdf.gs
// Geração de prévia, voucher oficial, PDF, ofício, envio e registro de emissão
// =============================================================================

function gerarDocumentoVoucher(protocolo, tipoDocumento, opcoes) {
  try {
    setupVoucherModuleFase1();

    tipoDocumento = String(tipoDocumento || "CERTIFICADO").toUpperCase();
    opcoes = opcoes || {};

    const modo = String(opcoes.modo || "").toUpperCase();
 const isPreview =
  [
    "PREVIEW",
    "PREVIA"
  ].indexOf(tipoDocumento) > -1 ||
  [
    "PREVIEW",
    "PREVIA"
  ].indexOf(modo) > -1;

    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) {
      return { ok: false, mensagem: "Solicitação não encontrada." };
    }

    const reg = item.registro;
    const statusAtual = String(reg.STATUS_SOLICITACAO || "").toUpperCase();
    const situacaoSindical = String(reg.SITUACAO_SINDICAL || "").toUpperCase();
    const statusValidacao = String(reg.STATUS_VALIDACAO_SINDICAL || "").toUpperCase();

    if (!isPreview) {
      if (situacaoSindical !== "ASSOCIADO" || statusValidacao !== "VALIDADO") {
        return {
          ok: false,
          mensagem: "O voucher só pode ser emitido após confirmação de associação."
        };
      }

      if (["PENDENTE", "ANALISE", "APROVADO", "EMITIDO"].indexOf(statusAtual) === -1) {
        return {
          ok: false,
          mensagem: "Status atual não permite emissão do voucher: " + statusAtual
        };
      }
    }

    const usuario = obterUsuarioAtualVoucher_();
    const agora = new Date();
    const voucherExistente =
  buscarVoucherEmitidoPorProtocolo_(protocolo);

if (voucherExistente) {
  return {
    ok: true,
    mensagem: 'Voucher já emitido.',
    codigoValidacao: voucherExistente.codigo,
    linkPdf: voucherExistente.linkPdf,
    reemitido: true
  };
}
    const codigo = gerarCodigoValidacaoVoucher_();

    const percentual = Number(opcoes.percentual || reg.PERCENTUAL_APLICADO || 70);
    const rg = valorSeguroVoucher_(opcoes.rg || "");
    const documentos = Array.isArray(opcoes.documentos) ? opcoes.documentos : [];

 const dadosDoc = {
  protocolo: protocolo,
  codigo: codigo,
  tipoDocumento: "VOUCHER",
  dataEmissao: agora,
  usuario: usuario,
  rg: rg,
  percentual: percentual,
  documentos: documentos,
  observacao: valorSeguroVoucher_(opcoes.observacao || ""),
  reg: reg
};

    const htmlVoucher = gerarHtmlDocumentoVoucher_(dadosDoc);

    if (isPreview) {
      return {
        ok: true,
        mensagem: "Prévia gerada com sucesso.",
        html: htmlVoucher,
        codigoValidacao: codigo,
        percentual: percentual
      };
    }

    const pdfVoucher = salvarHtmlComoPdfVoucher_(
      htmlVoucher,
      "Voucher Bolsa - " + protocolo + " - " + reg.NOME_SOLICITANTE
    );

    let linkOficio = "";
    let idOficio = "";

    if (opcoes.enviarRhEscola === true) {
      const htmlOficio = gerarHtmlOficioEscolaVoucher_(dadosDoc);
      const pdfOficio = salvarHtmlComoPdfVoucher_(
        htmlOficio,
        "Oficio Escola - " + protocolo + " - " + reg.NOME_SOLICITANTE
      );

      linkOficio = pdfOficio.url;
      idOficio = pdfOficio.id;
    }

registrarEmissaoVoucher_(reg, {
  protocolo: protocolo,
  idSolicitacao: reg.ID_SOLICITACAO,
  tipoDocumento: "VOUCHER",
  codigo: codigo,
  linkArquivo: pdfVoucher.url,
  percentual: percentual,
  usuario: usuario
});

    atualizarStatusSolicitacao_(item, "EMITIDO", opcoes.observacao || "Voucher emitido.", {
      DATA_EMISSAO: agora
    });

    atualizarStatusProtocolo_(protocolo, "EMITIDO", usuario, "Voucher emitido.");

    registrarHistoricoVoucher_(
      reg.ID_SOLICITACAO,
      reg.CPF_SOLICITANTE,
      "VOUCHER_EMITIDO",
      usuario,
      "Voucher emitido. Código: " + codigo,
      protocolo
    );

    if (opcoes.enviarAssociado === true) {
      enviarVoucherAssociado_(reg, {
        protocolo: protocolo,
        codigo: codigo,
        linkPdf: pdfVoucher.url,
        percentual: percentual
      });
    }

    if (opcoes.enviarRhEscola === true) {
      enviarVoucherEscola_(reg, {
        protocolo: protocolo,
        codigo: codigo,
        linkPdf: pdfVoucher.url,
        linkOficio: linkOficio,
        percentual: percentual
      });
    }

    return {
      ok: true,
      mensagem: "Voucher emitido com sucesso.",
      codigoValidacao: codigo,
      linkPdf: pdfVoucher.url,
      idArquivo: pdfVoucher.id,
      linkOficio: linkOficio,
      idOficio: idOficio,
      html: htmlVoucher,
      percentual: percentual
    };

  } catch (e) {
    Logger.log("gerarDocumentoVoucher erro: " + e.message);
    return {
      ok: false,
      mensagem: "Erro ao gerar voucher: " + e.message
    };
  }
}

function salvarHtmlComoPdfVoucher_(html, nomeArquivo) {
  const pasta = obterPastaVoucherDocumentos_();

  const nomeSeguro = sanitizarNomeArquivoVoucher_(nomeArquivo || "Voucher");
  const blobHtml = Utilities.newBlob(html, "text/html", nomeSeguro + ".html");
  const blobPdf = blobHtml.getAs(MimeType.PDF).setName(nomeSeguro + ".pdf");

  const file = pasta.createFile(blobPdf);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  return {
    id: file.getId(),
    url: file.getUrl(),
    nome: file.getName()
  };
}

function registrarEmissaoVoucher_(reg, dados) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Emitidos");

  if (!sh) return;

  sh.appendRow([
    gerarIdPadrao_("EMI"),
    new Date(),
    dados.protocolo || "",
    dados.idSolicitacao || "",
    reg.NOME_SOLICITANTE || "",
    reg.CPF_SOLICITANTE || "",
    reg.ESCOLA_SELECIONADA || "",
    dados.tipoDocumento || "CERTIFICADO",
    dados.codigo || "",
    dados.linkArquivo || "",
    dados.percentual || "",
    dados.usuario || obterUsuarioAtualVoucher_()
  ]);
}

/**
 * A assinatura do presidente, como data URI para embutir no PDF.
 *
 * POR QUE BASE64 E NÃO A URL DO DRIVE
 *
 * O PDF é gerado por getAs(MimeType.PDF) a partir do HTML. Nessa conversão o
 * Google não busca imagem de host externo de forma confiável — e uma
 * assinatura que às vezes aparece é pior que assinatura nenhuma, porque
 * ninguém descobre que faltou até o associado reclamar. Embutida, ela sempre
 * vai junto.
 *
 * O CACHE existe porque a conversão base64 de uma imagem custa caro e o
 * arquivo não muda. Sem ele, cada voucher emitido bate no Drive.
 *
 * FALHA SILENCIOSA É DELIBERADA AQUI, e só aqui: se o Drive estiver fora, o
 * documento sai com a linha de assinatura e o nome, como saía antes. Travar a
 * emissão de um benefício por causa de uma imagem seria pior que emitir sem
 * ela — mas o log registra, para não virar defeito invisível.
 */
function assinaturaPresidenteVoucher_() {
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  var CHAVE = "sisgep_assinatura_presidente_v1";

  if (cache) {
    var guardado = cache.get(CHAVE);
    if (guardado) return guardado;
  }

  try {
    var blob = DriveApp.getFileById(ASSINATURA_FILE_ID_V).getBlob();
    var mime = blob.getContentType() || "image/jpeg";
    var uri = "data:" + mime + ";base64," + Utilities.base64Encode(blob.getBytes());
    /* 100KB é o teto de um item no CacheService. Assinatura maior que isso
     * não é cacheada — funciona igual, só relê do Drive a cada emissão. */
    if (cache && uri.length < 95000) {
      try { cache.put(CHAVE, uri, 21600); } catch (e2) {}
    }
    return uri;
  } catch (e) {
    Logger.log("⚠ Assinatura do presidente não carregada (documento sai sem ela): " + e.message);
    return "";
  }
}

function gerarHtmlDocumentoVoucher_(dados) {
  const reg = dados.reg || {};

  const protocolo = dados.protocolo || "";
  const codigo = dados.codigo || "";
  const percentual = Number(dados.percentual || 70);
  const percentualExtenso = percentualPorExtensoVoucher_(percentual);
  const dataExtenso = dataExtensoVoucher_(dados.dataEmissao || new Date());

  const nomeSolicitante = reg.NOME_SOLICITANTE || "";
  const cpf = formatarCpfVoucher_(reg.CPF_SOLICITANTE || "");
  const rg = dados.rg || "—";
  const escola = reg.ESCOLA_SELECIONADA || "";
  const beneficiario = reg.NOME_BENEFICIARIO || nomeSolicitante;
  const modalidade = reg.MODALIDADE || "";
  const curso = reg.CURSO || "";
  const periodo = reg.PERIODO_REFERENCIA || "";
  const regime = reg.REGIME || "";
const documentos =
  (dados.documentos && dados.documentos.length)
    ? dados.documentos
    : ["Documento pessoal", "Comprovante de vínculo"];

const qrCodeUrl = gerarQrCodeVoucherUrl_(codigo);
const assinaturaImg = assinaturaPresidenteVoucher_();
const instituicao = reg.INSTITUICAO_ENSINO || "";
const cnpjInstituicao = reg.CNPJ_INSTITUICAO || "";

  const docsHtml = documentos.map(function(d) {
    return "<li>" + escHtmlVoucher_(d) + "</li>";
  }).join("");

  return (
    "<!DOCTYPE html>" +
    "<html lang='pt-BR'>" +
    "<head>" +
    "<meta charset='UTF-8'>" +
    "<title>Voucher de Bolsa - " + escHtmlVoucher_(protocolo) + "</title>" +
    "<style>" +
    "@page{size:A4 portrait;margin:14mm 13mm;}" +
    "html,body{width:184mm;}" +
    "body{font-family:Arial,sans-serif;color:#111827;margin:0;background:#fff;" +
      "-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
    /* Altura em MILÍMETROS, não em pixel.
     *
     * Estava min-height:940px. A área útil de um A4 com estas margens tem
     * ~269mm, que a 96dpi dá ~1017px — mas a conversão para PDF do Apps
     * Script não usa 96dpi de forma garantida, e 940px + padding passava do
     * limite em algumas renderizações, jogando o rodapé para uma segunda
     * página em branco. Milímetro é absoluto na impressão; pixel não é. */
    ".doc{border:2px solid #002f6c;padding:8mm 9mm;min-height:262mm;" +
      "box-sizing:border-box;position:relative;page-break-inside:avoid;}" +
    ".top{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #C9A84C;padding-bottom:16px;margin-bottom:24px;}" +
    ".brand{display:flex;align-items:center;gap:14px;}" +
    ".logo{width:82px;height:auto;}" +
    ".brand-title{font-size:20px;font-weight:900;color:#002f6c;text-transform:uppercase;line-height:1.1;}" +
    ".brand-sub{font-size:11px;color:#64748b;margin-top:4px;}" +
    ".proto{text-align:right;font-size:11px;color:#64748b;line-height:1.5;}" +
    ".proto strong{display:block;color:#002f6c;font-size:15px;margin-top:2px;}" +
    ".title{text-align:center;margin:30px 0 24px;}" +
    ".title h1{margin:0;color:#002f6c;font-size:24px;text-transform:uppercase;letter-spacing:.08em;}" +
    ".title .bar{width:90px;height:3px;background:#C9A84C;margin:12px auto 0;}" +
    ".texto{font-size:14.5px;line-height:1.85;text-align:justify;margin-top:18px;}" +
    ".box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:16px 18px;margin:22px 0;}" +
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;font-size:13px;}" +
    ".label{color:#64748b;font-size:10px;text-transform:uppercase;font-weight:800;letter-spacing:.08em;display:block;margin-bottom:3px;}" +
    ".val{font-weight:800;color:#0f172a;}" +
    ".desconto{background:#ecfdf5;border:2px solid #10b981;border-radius:14px;padding:18px;text-align:center;margin:24px 0;}" +
    ".desconto .n{font-size:42px;font-weight:900;color:#047857;line-height:1;}" +
    ".desconto .t{font-size:13px;color:#065f46;margin-top:8px;font-weight:700;}" +
    ".docs{font-size:12.5px;color:#334155;line-height:1.6;margin-top:6px;}" +
    ".assinatura{margin-top:58px;text-align:center;}" +
    ".linha{width:270px;border-top:1px solid #111827;margin:0 auto 8px;}" +
    ".pres{font-size:13px;font-weight:800;color:#111827;}" +
    ".cargo{font-size:11px;color:#64748b;margin-top:2px;}" +
    ".validacao{margin-top:34px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;padding:12px;font-size:11px;color:#475569;}" +
    ".footer{position:absolute;left:30px;right:30px;bottom:18px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10.5px;color:#64748b;text-align:center;line-height:1.5;}" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div class='doc'>" +

    "<div class='top'>" +
    "<div class='brand'>" +
    "<img class='logo' src='" + escHtmlVoucher_(LOGO_VOUCHER) + "'>" +
    "<div>" +
    "<div class='brand-title'>SindEducação-ES</div>" +
    "<div class='brand-sub'>Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos de Ensino Privado do Estado do Espírito Santo</div>" +
    "</div>" +
    "</div>" +
    "<div class='proto'>Protocolo<strong>" + escHtmlVoucher_(protocolo) + "</strong></div>" +
    "</div>" +

    "<div class='title'>" +
    "<h1>Voucher de Bolsa de Estudo</h1>" +
    "<div class='bar'></div>" +
    "</div>" +

    "<p class='texto'>" +
    "O <strong>SindEducação-ES</strong>, no uso de suas atribuições e conforme previsto na " +
    "<strong>" + escHtmlVoucher_(CCT_TEXTO_V) + "</strong>, " +
    "<strong>" + escHtmlVoucher_(CCT_CLAUSULA_V) + "</strong>, certifica que o(a) trabalhador(a) abaixo identificado(a) teve sua solicitação de bolsa analisada e deferida, " +
    "fazendo jus ao desconto indicado neste voucher, observadas as regras da Convenção Coletiva e da instituição de ensino." +
    "</p>" +

    "<div class='box'>" +
    "<div class='grid'>" +
    "<div><span class='label'>Associado(a)</span><span class='val'>" + escHtmlVoucher_(nomeSolicitante) + "</span></div>" +
    "<div><span class='label'>CPF</span><span class='val'>" + escHtmlVoucher_(cpf) + "</span></div>" +
    "<div><span class='label'>RG</span><span class='val'>" + escHtmlVoucher_(rg) + "</span></div>" +
    "<div><span class='label'>Empresa empregadora</span><span class='val'>" + escHtmlVoucher_(escola) + "</span></div>" +
    "<div><span class='label'>Beneficiário</span><span class='val'>" + escHtmlVoucher_(beneficiario) + "</span></div>" +
    "<div><span class='label'>Modalidade</span><span class='val'>" + escHtmlVoucher_(modalidade) + "</span></div>" +
    "<div><span class='label'>Curso</span><span class='val'>" + escHtmlVoucher_(curso) + "</span></div>" +
    "<div><span class='label'>Período / Regime</span><span class='val'>" + escHtmlVoucher_(periodo + (regime ? " · " + regime : "")) + "</span></div>" +
    "</div>" +
    /* A instituição de ensino ocupa a largura inteira porque o nome costuma
     * ser longo — "INSTITUTO DE ENSINO SUP. DO ESPÍRITO SANTO - IESES" não
     * cabe em meia coluna sem quebrar feio. */
    (instituicao
      ? "<div style='margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;'>" +
        "<span class='label'>Instituição de ensino</span>" +
        "<span class='val'>" + escHtmlVoucher_(instituicao) +
        (cnpjInstituicao ? " &nbsp;·&nbsp; CNPJ " + escHtmlVoucher_(cnpjInstituicao) : "") +
        "</span></div>"
      : "") +
    "</div>" +

    "<div class='desconto'>" +
    "<div class='n'>" + escHtmlVoucher_(percentual) + "%</div>" +
    "<div class='t'>Desconto concedido — " + escHtmlVoucher_(percentualExtenso) + "</div>" +
    "</div>" +

    /* DOCUMENTOS CONFERIDOS — SÓ NA VIA INTERNA.
     *
     * A lista revela Certidão de Casamento, Sentença Judicial de Guarda e
     * Declaração de IR. Isso é dado da vida privada do associado e da
     * família dele, e não tem por que chegar à instituição de ensino, que
     * precisa saber apenas o percentual do desconto.
     *
     * No documento em papel que o sindicato usa hoje, a lista aparece na
     * folha do COMPROVANTE DE ENTREGA — a que o associado assina no balcão —
     * e NÃO no certificado da folha seguinte. A regra já existia; o sistema
     * é que a estava ignorando. Apontado pelo usuário em 12/08/2026.
     *
     * O PADRÃO É NÃO MOSTRAR, e a inversão é deliberada: quem criar um tipo
     * novo de documento e esquecer deste campo produz um documento sem a
     * lista, não um documento vazando a vida do associado. Falha para o lado
     * seguro. */
    (dados.mostrarDocumentos === true
      ? "<div class='box'>" +
        "<span class='label'>Documentos conferidos</span>" +
        "<ul class='docs'>" + docsHtml + "</ul>" +
        "</div>"
      : "") +

    "<p class='texto'>" +
    "Este voucher é pessoal, intransferível e deverá ser apresentado à instituição de ensino para fins de validação do benefício. " +
    "A concessão do desconto está condicionada à confirmação dos dados e à observância das normas internas da instituição e da Convenção Coletiva vigente." +
    "</p>" +

    "<p class='texto' style='text-align:right;margin-top:28px;'>" + escHtmlVoucher_(dataExtenso) + "</p>" +

    "<div class='assinatura'>" +
    (assinaturaImg
      ? "<img src='" + assinaturaImg + "' style='height:56px;width:auto;display:block;margin:0 auto -4px;'>"
      : "") +
    "<div class='linha'></div>" +
    "<div class='pres'>" + escHtmlVoucher_(PRESIDENTE_VOUCHER) + "</div>" +
    "<div class='cargo'>" + escHtmlVoucher_(CARGO_PRESIDENTE_V) + "</div>" +
    "</div>" +

"<div class='validacao' style='display:flex;align-items:center;justify-content:space-between;gap:16px;'>" +
  "<div>" +
    "<strong>Código de validação:</strong> " + escHtmlVoucher_(codigo) + "<br>" +
    "Documento emitido eletronicamente pelo SISGEP/SindEducação-ES em " + escHtmlVoucher_(formatarDataHoraBrVoucher_(dados.dataEmissao)) + ".<br>" +
    "A autenticidade pode ser confirmada pelo QR Code ao lado." +
  "</div>" +
  "<img src='" + escHtmlVoucher_(qrCodeUrl) + "' style='width:92px;height:92px;border:1px solid #cbd5e1;border-radius:8px;padding:4px;background:#fff;'>" +
"</div>" +

    "<div class='footer'>" +
    escHtmlVoucher_(ENDERECO_SIND_V) + "<br>" +
    escHtmlVoucher_(TELEFONE_SIND_V) + " · " + escHtmlVoucher_(SITE_SIND_V) +
    "</div>" +

    "</div>" +
    "</body>" +
    "</html>"
  );
}

function gerarHtmlOficioEscolaVoucher_(dados) {
  const reg = dados.reg || {};

  const protocolo = dados.protocolo || "";
  const codigo = dados.codigo || "";
  const percentual = Number(dados.percentual || 70);

  const escola = reg.ESCOLA_SELECIONADA || "";
  const nomeSolicitante = reg.NOME_SOLICITANTE || "";
  const cpf = formatarCpfVoucher_(reg.CPF_SOLICITANTE || "");
  const beneficiario = reg.NOME_BENEFICIARIO || nomeSolicitante;
  const modalidade = reg.MODALIDADE || "";
  const curso = reg.CURSO || "";
  const periodo = reg.PERIODO_REFERENCIA || "";

  return (
    "<!DOCTYPE html>" +
    "<html lang='pt-BR'>" +
    "<head>" +
    "<meta charset='UTF-8'>" +
    "<title>Ofício - " + escHtmlVoucher_(protocolo) + "</title>" +
    "<style>" +
    "@page{size:A4;margin:20mm 18mm;}" +
    "body{font-family:Arial,sans-serif;color:#111827;background:#fff;margin:0;}" +
    ".doc{min-height:920px;position:relative;}" +
    ".top{display:flex;align-items:center;gap:14px;border-bottom:4px solid #C9A84C;padding-bottom:16px;margin-bottom:28px;}" +
    ".logo{width:82px;}" +
    ".brand{font-size:20px;font-weight:900;color:#002f6c;text-transform:uppercase;}" +
    ".sub{font-size:11px;color:#64748b;margin-top:3px;}" +
    ".ref{text-align:right;font-size:13px;color:#334155;margin-bottom:24px;}" +
    ".titulo{text-align:center;font-size:18px;font-weight:900;color:#002f6c;text-transform:uppercase;margin:30px 0;}" +
    "p{font-size:14.5px;line-height:1.85;text-align:justify;}" +
    ".box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px 16px;margin:20px 0;font-size:13px;line-height:1.7;}" +
    ".assinatura{margin-top:64px;text-align:center;}" +
    ".linha{width:270px;border-top:1px solid #111827;margin:0 auto 8px;}" +
    ".pres{font-size:13px;font-weight:800;}" +
    ".cargo{font-size:11px;color:#64748b;}" +
    ".footer{position:absolute;left:0;right:0;bottom:0;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10.5px;color:#64748b;text-align:center;line-height:1.5;}" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div class='doc'>" +

    "<div class='top'>" +
    "<img class='logo' src='" + escHtmlVoucher_(LOGO_VOUCHER) + "'>" +
    "<div>" +
    "<div class='brand'>SindEducação-ES</div>" +
    "<div class='sub'>Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos de Ensino Privado do Estado do Espírito Santo</div>" +
    "</div>" +
    "</div>" +

    "<div class='ref'>" + escHtmlVoucher_(dataExtensoVoucher_(dados.dataEmissao || new Date())) + "<br><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</div>" +

    "<div class='titulo'>Ofício de encaminhamento de voucher</div>" +

    "<p>À instituição de ensino <strong>" + escHtmlVoucher_(escola) + "</strong>,</p>" +

    "<p>O <strong>SindEducação-ES</strong> encaminha, para ciência e providências cabíveis, o voucher de bolsa de estudo referente ao(à) trabalhador(a) associado(a) abaixo identificado(a), conforme previsão em Convenção Coletiva de Trabalho vigente.</p>" +

    "<div class='box'>" +
    "<strong>Associado(a):</strong> " + escHtmlVoucher_(nomeSolicitante) + "<br>" +
    "<strong>CPF:</strong> " + escHtmlVoucher_(cpf) + "<br>" +
    "<strong>Beneficiário:</strong> " + escHtmlVoucher_(beneficiario) + "<br>" +
    "<strong>Modalidade:</strong> " + escHtmlVoucher_(modalidade) + "<br>" +
    "<strong>Curso:</strong> " + escHtmlVoucher_(curso) + "<br>" +
    "<strong>Período:</strong> " + escHtmlVoucher_(periodo) + "<br>" +
    "<strong>Percentual concedido:</strong> " + escHtmlVoucher_(percentual) + "%<br>" +
    "<strong>Código de validação:</strong> " + escHtmlVoucher_(codigo) +
    "</div>" +

    "<p>Solicitamos que o benefício seja analisado e aplicado conforme as regras pactuadas, observando-se os dados constantes no voucher oficial emitido pelo sindicato.</p>" +

    "<p>Sem mais para o momento, renovamos nossos votos de estima e consideração.</p>" +

    "<div class='assinatura'>" +
    "<div class='linha'></div>" +
    "<div class='pres'>" + escHtmlVoucher_(PRESIDENTE_VOUCHER) + "</div>" +
    "<div class='cargo'>" + escHtmlVoucher_(CARGO_PRESIDENTE_V) + "</div>" +
    "</div>" +

    "<div class='footer'>" +
    escHtmlVoucher_(ENDERECO_SIND_V) + "<br>" +
    escHtmlVoucher_(TELEFONE_SIND_V) + " · " + escHtmlVoucher_(SITE_SIND_V) +
    "</div>" +

    "</div>" +
    "</body>" +
    "</html>"
  );
}

function enviarVoucherAssociado_(reg, dados) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    MailApp.sendEmail({
      to: email,
      subject: "📄 Voucher de Bolsa emitido — " + dados.protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
        "<div style='background:#002f6c;padding:24px;border-radius:12px 12px 0 0;text-align:center;'>" +
        "<h1 style='color:#C9A84C;margin:0;font-size:22px;'>SindEducação-ES</h1>" +
        "</div>" +
        "<div style='background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;'>" +
        "<p>Olá <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Seu voucher de bolsa foi emitido com sucesso.</p>" +
        "<div style='background:#ede9fe;border:1px solid #c4b5fd;border-radius:8px;padding:16px;margin:20px 0;text-align:center;'>" +
        "<p style='font-size:11px;color:#64748b;margin-bottom:4px;'>Código de Validação</p>" +
        "<p style='font-size:20px;font-weight:900;color:#5b21b6;letter-spacing:.08em;'>" + escHtmlVoucher_(dados.codigo) + "</p>" +
        "</div>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(dados.protocolo) + "</p>" +
        "<p><strong>Desconto:</strong> " + escHtmlVoucher_(dados.percentual) + "%</p>" +
        "<p><a href='" + escHtmlVoucher_(dados.linkPdf) + "' style='color:#002f6c;font-weight:700;'>📄 Acessar voucher</a></p>" +
        "<p style='font-size:12px;color:#64748b;'>Apresente este documento à instituição de ensino.</p>" +
        "</div>" +
        "</div>"
    });

  } catch (e) {
    Logger.log("enviarVoucherAssociado_ erro: " + e.message);
  }
}

function enviarVoucherEscola_(reg, dados) {
  try {
    const emailEscola = buscarEmailRhEscolaVoucher_(reg.ESCOLA_SELECIONADA, reg.CNPJ_ESCOLA);

    if (!emailEscola) {
      registrarHistoricoVoucher_(
        reg.ID_SOLICITACAO,
        reg.CPF_SOLICITANTE,
        "EMAIL_ESCOLA_NAO_ENVIADO",
        obterUsuarioAtualVoucher_(),
        "E-mail da escola/RH não localizado para envio automático.",
        dados.protocolo
      );
      return;
    }

    MailApp.sendEmail({
      to: emailEscola,
      cc: "secretaria@sindeducacao.com",
      subject: "Ofício e Voucher de Bolsa — " + dados.protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:620px;margin:0 auto;'>" +
        "<div style='background:#002f6c;padding:22px;border-radius:12px 12px 0 0;'>" +
        "<h2 style='color:#C9A84C;margin:0;font-size:19px;'>Encaminhamento de Voucher de Bolsa</h2>" +
        "</div>" +
        "<div style='background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;'>" +
        "<p>Prezados(as),</p>" +
        "<p>Encaminhamos voucher de bolsa de estudo emitido pelo SindEducação-ES.</p>" +
        "<p><strong>Associado(a):</strong> " + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</p>" +
        "<p><strong>Beneficiário:</strong> " + escHtmlVoucher_(reg.NOME_BENEFICIARIO || reg.NOME_SOLICITANTE) + "</p>" +
        "<p><strong>Curso:</strong> " + escHtmlVoucher_(reg.CURSO) + "</p>" +
        "<p><strong>Desconto:</strong> " + escHtmlVoucher_(dados.percentual) + "%</p>" +
        "<p><strong>Código de validação:</strong> " + escHtmlVoucher_(dados.codigo) + "</p>" +
        "<p><a href='" + escHtmlVoucher_(dados.linkPdf) + "' style='color:#002f6c;font-weight:700;'>📄 Acessar voucher</a></p>" +
        (dados.linkOficio ? "<p><a href='" + escHtmlVoucher_(dados.linkOficio) + "' style='color:#002f6c;font-weight:700;'>📨 Acessar ofício</a></p>" : "") +
        "<p>Atenciosamente,<br>SindEducação-ES</p>" +
        "</div>" +
        "</div>"
    });

    registrarHistoricoVoucher_(
      reg.ID_SOLICITACAO,
      reg.CPF_SOLICITANTE,
      "EMAIL_ESCOLA_ENVIADO",
      obterUsuarioAtualVoucher_(),
      "Voucher encaminhado para: " + emailEscola,
      dados.protocolo
    );

  } catch (e) {
    Logger.log("enviarVoucherEscola_ erro: " + e.message);
  }
}

function buscarEmailRhEscolaVoucher_(nomeEscola, cnpj) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Escolas");

    if (!sh || sh.getLastRow() < 2) return "";

    const dados = sh.getDataRange().getValues();
    const headers = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    function findCol() {
      for (let i = 0; i < arguments.length; i++) {
        const idx = headers.indexOf(arguments[i]);
        if (idx > -1) return idx;
      }
      return -1;
    }

    const idxEscola = findCol("NomeEscola", "Escola (Razão Social)", "Escola");
    const idxCnpj = findCol("CNPJ");
    /* "E-mail (principal)" É O NOME REAL DA COLUNA na aba Escolas, e faltava.
     *
     * A lista original procurava por Email, E-mail, EMAIL_RH e variações —
     * nenhuma delas existe ali. O resultado é que esta função devolvia string
     * vazia para as 679 escolas, em silêncio, e o ofício ao RH nunca
     * encontrava destinatário. Achado em 12/08/2026 ao montar o envio do
     * certificado. O nome correto está em Escolas.gs:16, COL_EMAIL.
     *
     * A ordem importa: e-mail de RH, quando existe, é melhor destinatário que
     * o e-mail geral da escola. Por isso os específicos vêm antes. */
    const idxEmail = findCol(
      "Email RH",
      "E-mail RH",
      "EMAIL_RH",
      "E-mail (principal)",
      "E-mails (todos)",
      "EMAILS_RECEITA",
      "Email",
      "E-mail",
      "EMAIL",
      "email"
    );

    if (idxEmail === -1) return "";

    const buscaNome = normalizarTextoVoucher_(nomeEscola || "");
    const buscaCnpj = String(cnpj || "").replace(/\D/g, "");

    for (let i = 1; i < dados.length; i++) {
      const nomeLinha = idxEscola > -1 ? normalizarTextoVoucher_(dados[i][idxEscola]) : "";
      const cnpjLinha = idxCnpj > -1 ? String(dados[i][idxCnpj] || "").replace(/\D/g, "") : "";

      const bateCnpj = buscaCnpj && cnpjLinha && buscaCnpj === cnpjLinha;
      const bateNome = buscaNome && nomeLinha && (nomeLinha === buscaNome || nomeLinha.indexOf(buscaNome) > -1 || buscaNome.indexOf(nomeLinha) > -1);

      if (bateCnpj || bateNome) {
        return valorSeguroVoucher_(dados[i][idxEmail]);
      }
    }

    return "";

  } catch (e) {
    Logger.log("buscarEmailRhEscolaVoucher_ erro: " + e.message);
    return "";
  }
}

function gerarDocumentoCertBolsa(protocolo, tipoDocumento) {
  return gerarDocumentoVoucher(protocolo, tipoDocumento, {});
}

function gerarDocumentoCertBolsaCompleto(protocolo, tipoDocumento, opcoes, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  return gerarDocumentoVoucher(protocolo, tipoDocumento, opcoes || {});
}
function gerarQrCodeVoucherUrl_(codigoValidacao) {
  var baseUrl = ScriptApp.getService().getUrl();

  var urlValidacao =
    baseUrl +
    "?page=pub-validar-voucher&codigo=" +
    encodeURIComponent(String(codigoValidacao || ""));

  return "https://quickchart.io/qr?size=160&text=" +
    encodeURIComponent(urlValidacao);
}
