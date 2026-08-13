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

    /* A MEMÓRIA APRENDE NA EMISSÃO — só aqui, nunca na prévia.
     *
     * Prévia é rascunho: alguém experimentando 100% para ver como fica não
     * está concedendo nada. Se a prévia alimentasse a memória, o padrão
     * passaria a refletir o que se testou, não o que se deu — e a sugestão
     * ficaria pior a cada experimento.
     *
     * O caminho da prévia retorna bem antes desta linha, então a separação
     * é estrutural, não uma condição que alguém possa esquecer de manter. */
    if (typeof voucherPadraoLembrar_ === "function") {
      voucherPadraoLembrar_({
        modalidade: reg.MODALIDADE,
        area: reg.AREA_CURSO,
        curso: reg.CURSO,
        percentual: percentual
      });
    }
    if (typeof voucherInstLembrar_ === "function") {
      voucherInstLembrar_({
        nome: reg.INSTITUICAO_ENSINO,
        cnpj: reg.CNPJ_INSTITUICAO,
        email: reg.EMAIL_INSTITUICAO,
        percentual: percentual,
        quem: usuario
      });
    }

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
 * Uma imagem do Drive como data: URI, pronta para entrar no HTML.
 *
 * TODA IMAGEM DO DOCUMENTO PASSA POR AQUI — e isso não é organização, é
 * requisito. `getAs(MimeType.PDF)` renderiza o HTML num processo do Google
 * que não busca imagem por URL externa de forma confiável: às vezes vem, às
 * vezes o PDF sai com um quadrado vazio, sem erro nenhum no log.
 *
 * E o sintoma engana: na PRÉVIA, que é HTML aberto no navegador, a imagem
 * aparece normalmente — quem busca a URL ali é o navegador. Só no PDF é que
 * some. Conferir pela prévia, portanto, não prova nada sobre imagem.
 *
 * Falha aqui NÃO derruba a emissão: devolve "" e o documento sai sem aquela
 * imagem. Um certificado sem brasão ainda vale; uma emissão que explode por
 * causa do Drive fora do ar, não.
 */
function imagemDoDriveVoucher_(fileId, chaveCache, rotulo) {
  if (!fileId) return "";

  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache) {
    var guardado = cache.get(chaveCache);
    if (guardado) return guardado;
  }

  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    var mime = blob.getContentType() || "image/jpeg";
    var uri = "data:" + mime + ";base64," + Utilities.base64Encode(blob.getBytes());
    /* 100KB é o teto de um item no CacheService. Imagem maior que isso não é
     * cacheada — funciona igual, só relê do Drive a cada emissão. */
    if (cache && uri.length < 95000) {
      try { cache.put(chaveCache, uri, 21600); } catch (e2) {}
    }
    return uri;
  } catch (e) {
    Logger.log("⚠ " + rotulo + " não carregada (o documento sai sem ela): " + e.message);
    return "";
  }
}

/**
 * A assinatura do presidente.
 *
 * Uma assinatura que às vezes aparece é pior que assinatura nenhuma: ninguém
 * descobre que faltou até o associado reclamar do documento na mão. Por isso
 * ela é embutida, e por isso o log registra quando não carrega.
 */
function assinaturaPresidenteVoucher_() {
  return imagemDoDriveVoucher_(
    ASSINATURA_FILE_ID_V, "sisgep_assinatura_presidente_v1", "Assinatura do presidente");
}

/** O brasão do cabeçalho. Ver o comentário de LOGO_VOUCHER_FILE_ID. */
function logoSindicatoVoucher_() {
  return imagemDoDriveVoucher_(
    LOGO_VOUCHER_FILE_ID, "sisgep_logo_sindicato_v1", "Logo do sindicato");
}

/**
 * O CERTIFICADO, fiel ao documento que o sindicato já emite.
 *
 * O usuário mandou o PDF real em 13/08/2026 — o do ÁTILA/ISABELA — e disse
 * "esse é o texto de base para voucher de dependente", "olha o layout de
 * página, marca d'água", "precisamos ajustar o texto". O que existia aqui era
 * um documento inventado por mim: caixa com borda azul, faixa dourada, um
 * quadro verde gigante com o percentual. Bonito e errado — a escola conhece o
 * papel do sindicato, e um documento que não se parece com aquele levanta
 * dúvida em vez de resolver.
 *
 * O QUE O PDF REAL TEM, e está reproduzido aqui:
 *
 *   • A4, cabeçalho com a logo à esquerda e duas faixas (rosa sobre azul) à
 *     direita;
 *   • marca d'água do símbolo em cinza claríssimo, ancorada no canto
 *     INFERIOR DIREITO e sangrando para fora da página;
 *   • dois parágrafos, sem quadros nem caixas — o texto é o documento;
 *   • assinatura manuscrita sobre o nome do presidente;
 *   • rodapé com os contatos e a faixa azul do Salmos 128:2.
 *
 * O QUE FOI ACRESCENTADO AO MODELO, com autorização explícita: o QR e o
 * código de validação, discretos no rodapé. Eles não existem no papel de
 * hoje, e são o único jeito de a escola conferir se o certificado é
 * verdadeiro sem telefonar para o sindicato.
 *
 * MANTENEDORA NÃO É CAMPO NOVO. O documento diz "instituição MULTIVIX –
 * VITÓRIA, mantida pela Empresa Brasileira de Ensino... EMBRAE, inscrita no
 * CNPJ 01.936.248/0001-21". Isso é, respectivamente, o NOME FANTASIA, a RAZÃO
 * SOCIAL e o CNPJ — os três já no cadastro de Escolas. Decisão do usuário:
 * "ficam na escola".
 *
 * PARA DEPENDENTE, A INSTITUIÇÃO É UMA SÓ: onde o titular trabalha é onde o
 * dependente estuda, e é por isso que o documento cita uma única empresa.
 * Confirmado pelo usuário. Quando o beneficiário é o próprio titular, o texto
 * perde a oração "dependente de" e segue igual.
 */
function gerarHtmlDocumentoVoucher_(dados) {
  const reg = dados.reg || {};

  const protocolo = dados.protocolo || "";
  const codigo = dados.codigo || "";
  const percentual = Number(dados.percentual || 70);
  const percentualExtenso = percentualPorExtensoVoucher_(percentual);

  const nomeSolicitante = reg.NOME_SOLICITANTE || "";
  const beneficiario = reg.NOME_BENEFICIARIO || nomeSolicitante;
  const tipoBenef = String(reg.TIPO_BENEFICIARIO || "").toUpperCase();
  /* Dependente é qualquer beneficiário que não seja o próprio titular — e a
   * comparação de nome cobre o caso de a coluna vir vazia em linha antiga. */
  const ehDependente = (tipoBenef && tipoBenef !== "TITULAR") ||
    (!!beneficiario && !!nomeSolicitante &&
      beneficiario.trim().toUpperCase() !== nomeSolicitante.trim().toUpperCase());

  const rg = dados.rg || reg.RG || "";
  const curso = reg.CURSO || "";
  const periodo = reg.PERIODO_REFERENCIA || "";
  const regime = String(reg.REGIME || "").toUpperCase();

  /* Fantasia = "instituição"; razão social = "mantida pela"; e o CNPJ é o
   * dela. Quando a fantasia não estiver preenchida, a razão social ocupa o
   * lugar da instituição e a oração "mantida pela" desaparece — repetir o
   * mesmo nome duas vezes na mesma frase é pior que omitir. */
  const fantasia = String(reg.ESCOLA_FANTASIA || "").trim();
  const razaoSocial = String(reg.ESCOLA_SELECIONADA || reg.INSTITUICAO_ENSINO || "").trim();
  const instituicaoTexto = fantasia || razaoSocial;
  const mantenedora = (fantasia && razaoSocial && fantasia !== razaoSocial) ? razaoSocial : "";
  const cnpj = formatarCnpj_(reg.CNPJ_ESCOLA || reg.CNPJ_INSTITUICAO || "");

  /* "semestre letivo de 2026/2" ou "ano letivo de 2026": o documento diz o
   * que a bolsa é, e bolsa anual não tem semestre. */
  const rotuloPeriodo = (regime.indexOf("ANUAL") > -1 ? "ano letivo de " : "semestre letivo de ")
    + periodo;

  const qrCodeUrl = gerarQrCodeVoucherUrl_(codigo);
  const assinaturaImg = assinaturaPresidenteVoucher_();
  const logoImg = logoSindicatoVoucher_();

  function frag(rotulo, valor) {
    return valor ? rotulo + "<strong>" + escHtmlVoucher_(valor) + "</strong>" : "";
  }

  /* O CORPO É UMA FRASE SÓ, como no papel. Montada por pedaços porque cada
   * oração some quando o dado dela não existe: sem RG não se escreve
   * "portador da carteira de identidade nº —", que é pior que não dizer. */
  const corpo =
    "O Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos de Ensino " +
    "Particular no Estado do Espírito Santo – <strong>SINDEDUCAÇÃO-ES</strong>, nos termos do " +
    "convênio firmado com o Sindicato das Empresas Particulares de Ensino do Estado do " +
    "Espírito Santo – <strong>SINEPE-ES</strong>, certifica que " +
    "<strong>" + escHtmlVoucher_(beneficiario) + "</strong>" +
    (ehDependente ? ", dependente de <strong>" + escHtmlVoucher_(nomeSolicitante) + "</strong>" : "") +
    frag(", portador da carteira de identidade nº ", rg) +
    frag(", empregado da instituição ", instituicaoTexto) +
    frag(", mantida pela ", mantenedora) +
    (cnpj ? ", inscrita no CNPJ sob nº <strong>" + escHtmlVoucher_(cnpj) + "</strong>" : "") +
    " encontra-se regularmente habilitado ao benefício de <strong>" +
    escHtmlVoucher_(percentual) + "% (" + escHtmlVoucher_(percentualExtenso) + ")</strong> " +
    "de desconto sobre a matrícula, rematrícula e semestralidade" +
    frag(" do Curso de ", curso) +
    (periodo ? ", referente ao " + escHtmlVoucher_(rotuloPeriodo) : "") +
    ", após verificação do atendimento aos requisitos exigidos para a concessão do benefício.";

  return (
    "<!DOCTYPE html>" +
    "<html lang='pt-BR'>" +
    "<head>" +
    "<meta charset='UTF-8'>" +
    "<title>Certificado de Habilitação à Bolsa de Estudos - " + escHtmlVoucher_(protocolo) + "</title>" +
    "<style>" +
    /* Milímetro, nunca pixel: a conversão para PDF do Apps Script não garante
     * 96dpi, e altura em px joga o rodapé para uma segunda página em branco. */
    "@page{size:A4 portrait;margin:0;}" +
    "html,body{margin:0;padding:0;background:#fff;}" +
    "body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;" +
      "-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
    ".pagina{position:relative;width:210mm;min-height:297mm;box-sizing:border-box;" +
      "padding:0 0 40mm;overflow:hidden;page-break-inside:avoid;}" +

    /* ── cabeçalho: logo à esquerda, faixas à direita ── */
    ".cab{display:flex;align-items:flex-start;justify-content:space-between;padding:12mm 15mm 0;}" +
    ".cab-logo{width:52mm;height:auto;}" +
    ".faixas{position:relative;width:78mm;height:16mm;margin-top:2mm;}" +
    ".faixa-azul{position:absolute;right:-15mm;top:3mm;width:88mm;height:7mm;background:#00A0E3;transform:skewX(-20deg);}" +
    ".faixa-rosa{position:absolute;right:-2mm;top:0;width:62mm;height:7mm;background:#E5187E;transform:skewX(-20deg);}" +

    /* ── marca d'água: símbolo no canto inferior direito, sangrando ── */
    ".dagua{position:absolute;right:-28mm;bottom:18mm;width:120mm;opacity:.07;" +
      "filter:grayscale(100%);z-index:0;pointer-events:none;}" +

    ".corpo{position:relative;z-index:1;padding:0 20mm;}" +
    "h1{text-align:center;font-size:15pt;font-weight:bold;color:#1a1a1a;" +
      "margin:16mm 0 12mm;letter-spacing:.02em;}" +
    "p{font-size:11pt;line-height:1.75;text-align:justify;margin:0 0 6mm;}" +

    ".assinatura{margin-top:22mm;text-align:center;}" +
    ".assinatura img{width:34mm;height:auto;display:block;margin:0 auto 1mm;}" +
    ".pres{font-size:11pt;font-weight:bold;}" +
    ".cargo{font-size:10pt;}" +

    /* ── rodapé: contatos + faixa do salmo + a validação ── */
    ".rodape{position:absolute;left:0;right:0;bottom:0;}" +
    ".contatos{padding:0 15mm 3mm;font-size:8.5pt;color:#1565C0;line-height:1.5;" +
      "display:flex;justify-content:space-between;align-items:flex-end;}" +
    ".contatos div{white-space:nowrap;}" +
    /* O QR fica AQUI, discreto, e não no meio do documento: foi acrescentado
     * ao modelo com autorização, e o que é acréscimo não disputa espaço com o
     * que a escola já sabe ler. */
    ".valida{text-align:right;font-size:7.5pt;color:#64748b;line-height:1.4;}" +
    ".valida img{width:16mm;height:16mm;display:block;margin-left:auto;}" +
    ".salmo{background:#1565C0;color:#fff;text-align:center;font-style:italic;" +
      "font-size:10pt;padding:2.5mm 4mm;}" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div class='pagina'>" +

    (logoImg ? "<img class='dagua' src='" + escHtmlVoucher_(logoImg) + "'>" : "") +

    "<div class='cab'>" +
    (logoImg ? "<img class='cab-logo' src='" + escHtmlVoucher_(logoImg) + "'>" : "<div></div>") +
    "<div class='faixas'><div class='faixa-azul'></div><div class='faixa-rosa'></div></div>" +
    "</div>" +

    "<div class='corpo'>" +
    "<h1>CERTIFICADO DE HABILITAÇÃO À BOLSA DE ESTUDOS</h1>" +
    "<p>" + corpo + "</p>" +
    "<p>O presente certificado destina-se exclusivamente à comprovação da habilitação do " +
    "beneficiário para utilização do benefício acima especificado, sendo pessoal, individual " +
    "e intransferível, produzindo efeitos enquanto permanecerem atendidas as condições que " +
    "fundamentaram sua emissão.</p>" +

    "<div class='assinatura'>" +
    (assinaturaImg ? "<img src='" + escHtmlVoucher_(assinaturaImg) + "'>" : "") +
    "<div class='pres'>" + escHtmlVoucher_(PRESIDENTE_VOUCHER) + "</div>" +
    "<div class='cargo'>Presidente - SindEducação-ES</div>" +
    "</div>" +
    "</div>" +

    "<div class='rodape'>" +
    "<div class='contatos'>" +
    "<div>" +
    "(27) 3222-2706<br>(27) 99735-8900<br>sindeducacao.com<br>contato@sindeducacao.com" +
    "</div>" +
    "<div class='valida'>" +
    (qrCodeUrl ? "<img src='" + escHtmlVoucher_(qrCodeUrl) + "'>" : "") +
    (codigo ? "Código " + escHtmlVoucher_(codigo) + "<br>" : "") +
    (protocolo ? escHtmlVoucher_(protocolo) : "") +
    "</div>" +
    "</div>" +
    "<div class='salmo'>Você comerá do fruto do seu trabalho e será feliz e próspero. Salmos 128:2.</div>" +
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
    "<img class='logo' src='" + escHtmlVoucher_(logoSindicatoVoucher_()) + "'>" +
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
/**
 * O QR de validação, EMBUTIDO — não é um link para o quickchart.io.
 *
 * ACHADO EM 12/08/2026, e foi o teste que apontou: eu tinha corrigido a
 * assinatura e a logo para base64 por causa do `getAs(MimeType.PDF)`, que não
 * busca imagem de host externo de forma confiável — e passei direto pelo QR,
 * que tinha exatamente o mesmo problema. O teste t33 varre o HTML inteiro
 * atrás de `src=http` e não deixou passar.
 *
 * E aqui doía mais que nas outras duas. Logo faltando é feio; QR faltando
 * quebra a função do documento: é por ele que a escola confere se o
 * certificado é verdadeiro. Um voucher impresso com o quadrado em branco não
 * tem como ser validado por quem o recebe no papel.
 *
 * A imagem é buscada UMA vez, na emissão, e vai embutida. Se o quickchart
 * estiver fora do ar nesse momento, devolve "" e o documento sai sem o QR —
 * o código de validação em texto continua impresso logo ao lado, e é por ele
 * que se confere. Travar a emissão por causa disso seria pior.
 */
function gerarQrCodeVoucherUrl_(codigoValidacao) {
  var codigo = String(codigoValidacao || "");
  var urlValidacao =
    ScriptApp.getService().getUrl() +
    "?page=pub-validar-voucher&codigo=" + encodeURIComponent(codigo);

  var urlQr = "https://quickchart.io/qr?size=160&text=" + encodeURIComponent(urlValidacao);

  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  var chave = "sisgep_qr_voucher_" + codigo;
  if (cache) {
    var guardado = cache.get(chave);
    if (guardado) return guardado;
  }

  try {
    var resp = UrlFetchApp.fetch(urlQr, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      Logger.log("⚠ QR do voucher: quickchart devolveu " + resp.getResponseCode() +
                 " (documento sai sem o QR, com o código em texto).");
      return "";
    }
    var blob = resp.getBlob();
    var uri = "data:" + (blob.getContentType() || "image/png") +
              ";base64," + Utilities.base64Encode(blob.getBytes());
    if (cache && uri.length < 95000) {
      try { cache.put(chave, uri, 21600); } catch (e2) {}
    }
    return uri;
  } catch (e) {
    Logger.log("⚠ QR do voucher não gerado (documento sai sem ele): " + e.message);
    return "";
  }
}

/**
 * DIAGNÓSTICO DAS TRÊS IMAGENS DO CERTIFICADO — logo, assinatura e QR.
 *
 * POR QUE ESTA FUNÇÃO EXISTE, e por que ela vale mais que olhar a prévia.
 *
 * As três imagens têm que virar `data:` (base64) antes de entrarem no HTML.
 * `getAs(MimeType.PDF)` não busca host externo de forma confiável: uma URL
 * `https://` funciona perfeitamente na PRÉVIA — porque quem baixa a imagem
 * ali é o navegador — e sai em branco no PDF, que é o documento que chega no
 * associado e na escola. É o pior tipo de defeito: invisível exatamente no
 * lugar onde a pessoa foi conferir.
 *
 * O QR é o que mais importa dos três. Logo faltando é feio; assinatura
 * faltando é grave; QR faltando quebra a VALIDAÇÃO do certificado — a escola
 * aponta a câmera e não acontece nada.
 *
 * SÓ LÊ. Não emite, não envia, não grava, não apaga cache. Pode rodar em
 * produção a qualquer hora, inclusive pelo botão Run do editor — daí a porta
 * dupla, que é o que permite chamar sem token.
 *
 * COMO LER O RESULTADO:
 *
 *   data:  ✅  — vai aparecer no PDF
 *   http:  🔴  — aparece na prévia e SOME no PDF
 *   vazio: 🔴  — some nos dois; ver o motivo no log da função que carrega
 */
function voucherDiagnosticoImagens(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "voucherDiagnosticoImagens", false);

  function medir(rotulo, critico, fn) {
    var uri = "", erro = "";
    try { uri = String(fn() || ""); } catch (e) { erro = e.message; }

    var tipo = !uri ? "VAZIO"
             : uri.indexOf("data:") === 0 ? "data"
             : uri.indexOf("http") === 0 ? "http" : "?";
    var ok = tipo === "data";

    Logger.log((ok ? "✅ " : "🔴 ") + rotulo + " — " + tipo +
      (ok ? " · " + Math.round(uri.length / 1024) + " KB" : "") +
      (erro ? " · erro: " + erro : "") +
      (!ok && critico ? "  ← ISTO QUEBRA A VALIDAÇÃO DO CERTIFICADO" : ""));

    return { rotulo: rotulo, ok: ok, tipo: tipo, critico: !!critico,
             tamanhoKb: uri ? Math.round(uri.length / 1024) : 0, erro: erro };
  }

  Logger.log("── Imagens do certificado ─────────────────────────────");
  var itens = [
    medir("Logo do sindicato", false, logoSindicatoVoucher_),
    medir("Assinatura do presidente", false, assinaturaPresidenteVoucher_),
    /* Um código de brincadeira: gerar o QR não emite nada nem consome
     * numeração — o que se está medindo é se a imagem VOLTA como base64. */
    medir("QR code de validação", true, function () {
      return gerarQrCodeVoucherUrl_("DIAGNOSTICO-SEM-VALOR");
    })
  ];

  var falhas = itens.filter(function (i) { return !i.ok; });
  var criticas = falhas.filter(function (i) { return i.critico; });

  Logger.log("───────────────────────────────────────────────────────");
  if (!falhas.length) {
    Logger.log("✅ As três imagens viram base64 — o PDF sai completo.");
  } else {
    Logger.log("🔴 " + falhas.length + " de 3 não viram base64: " +
      falhas.map(function (i) { return i.rotulo; }).join(", ") + ".");
    Logger.log("   Atenção: a PRÉVIA no navegador vai mostrar essas imagens " +
               "assim mesmo. Só o PDF prova.");
  }
  /* O cache guarda por 6 horas. Se alguém acabou de trocar a logo no Drive e
   * o diagnóstico ainda mostra a antiga, não é defeito — é o cache. */
  Logger.log("   (logo e assinatura ficam 6h em cache; QR também)");

  return {
    ok: !falhas.length,
    itens: itens,
    falhas: falhas.length,
    criticas: criticas.length,
    mensagem: !falhas.length
      ? "As três imagens viram base64 — o PDF sai completo."
      : falhas.length + " de 3 não viram base64: " +
        falhas.map(function (i) { return i.rotulo; }).join(", ") + "."
  };
}
