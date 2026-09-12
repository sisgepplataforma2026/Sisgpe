// =============================================================================
// ARQUIVO: VoucherPdf.gs
// Geração de prévia, voucher oficial, PDF, ofício, envio e registro de emissão
// =============================================================================

function gerarDocumentoVoucher(protocolo, tipoDocumento, opcoes) {
  /* Declarada FORA do try e antes do setup: o primeiro passo do processo é
     o próprio setup, e uma etapa que só começa depois dele mentiria sobre
     onde quebrou justamente na primeira coisa que roda. */
  var etapa = "preparar as abas do módulo (setupVoucherModuleFase1)";
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

    /* EM QUE ETAPA QUEBROU — instrumentação de 13/08/2026.
     *
     * O usuário recebeu "Erro ao gerar voucher: This operation is not
     * supported for this document: <id da planilha>". A mensagem diz o QUE
     * o Google recusou e não diz ONDE, e o `catch` no fim engolia a pilha:
     * sobrava um id e nenhum caminho. Os três lugares que tocam o Drive já
     * tratam a própria falha, então o erro vem de fora deles — e por leitura
     * não se acha.
     *
     * `etapa` é atualizada antes de cada passo e entra na mensagem e no log,
     * junto com a pilha. Custa uma linha por passo e transforma um mistério
     * em diagnóstico na próxima tentativa. */
    etapa = "localizar a solicitação";
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) {
      return { ok: false, mensagem: "Solicitação não encontrada." };
    }

    const reg = item.registro;
    const statusAtual = String(reg.STATUS_SOLICITACAO || "").toUpperCase();
    const situacaoSindical = String(reg.SITUACAO_SINDICAL || "").toUpperCase();
    const statusValidacao = String(reg.STATUS_VALIDACAO_SINDICAL || "").toUpperCase();

    /* PRESENCIAL NÃO É RECUSA — é outra forma de entregar.
     *
     * Até 14/08/2026 este bloco exigia `situacaoSindical === "ASSOCIADO"` e
     * recusava todo o resto. Somado à recusa igual na aprovação, o efeito era
     * que o não associado NÃO CONSEGUIA SER ATENDIDO DE JEITO NENHUM — nem
     * pelo portal, que o mandava à sede, nem no balcão, que o recusava
     * quando ele chegava lá. Medido no emulador antes de mexer.
     *
     * A regra real, dita pelo usuário: todos têm o mesmo benefício; o não
     * associado solicita em papel e RETIRA PRESENCIALMENTE. Então o que
     * muda aqui não é o direito de emitir, é o que acontece depois de
     * emitir — o voucher dele não sai por e-mail, fica guardado para ele
     * buscar. Ver `voucherEhNaoAssociado_` em Voucher.gs. */
    const retiradaPresencial = voucherEhNaoAssociado_(situacaoSindical);

    if (!isPreview) {
      /* A validação continua exigida para os dois: ela diz que ALGUÉM
       * CONFERIU o pedido, e isso vale igual no papel e no portal. O que
       * saiu foi a exigência de ser associado, não a de ter sido conferido. */
      if (statusValidacao !== "VALIDADO") {
        return {
          ok: false,
          mensagem: "O voucher só pode ser emitido após a análise aprovar a solicitação."
        };
      }

      if (["PENDENTE", "ANALISE", "APROVADO", "EMITIDO"].indexOf(statusAtual) === -1) {
        return {
          ok: false,
          mensagem: "Status atual não permite emissão do voucher: " + statusAtual
        };
      }

      /* SEM PERÍODO NÃO SE EMITE — decisão do usuário em 13/08/2026:
       * "trava, tem que sair o período e deveria avisar quando não estiver".
       *
       * São dois motivos, e o segundo é o grave:
       *
       *   1. O período SAI IMPRESSO no certificado ("referente ao semestre
       *      letivo de 2026/2"). Sem ele, a escola recebe um documento que
       *      não diz a que semestre o desconto se refere.
       *   2. É a janela da trava de duplicidade. Uma linha sem período não
       *      ocupa janela nenhuma — a mesma pessoa, no mesmo curso, passa de
       *      novo. Emitir por cima de uma linha assim é dar validade a um
       *      furo em vez de fechá-lo.
       *
       * A criação já exige o período desde hoje; esta trava existe para as
       * linhas que foram gravadas ANTES, e que continuam na base. A mensagem
       * diz o que fazer, porque quem está emitindo não tem culpa do que foi
       * gravado semana passada.
       *
       * NA PRÉVIA, NÃO. Prévia é para conferir, inclusive para conferir que
       * está faltando o período — travar ali esconderia o problema em vez de
       * mostrá-lo. */
      var periodoDaLinha = (typeof voucherPeriodoTexto_ === "function")
        ? voucherPeriodoTexto_(reg.PERIODO_REFERENCIA)
        : String(reg.PERIODO_REFERENCIA || "").trim();
      if (!periodoDaLinha) {
        return {
          ok: false,
          semPeriodo: true,
          mensagem: "Esta solicitação está sem PERÍODO DE REFERÊNCIA e por isso não " +
                    "pode ser emitida. O período sai impresso no certificado e é ele " +
                    "que impede o mesmo voucher sair duas vezes para a mesma pessoa. " +
                    "Abra a solicitação, informe o período e emita em seguida."
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
    etapa = "gerar código de validação";
    const codigo = gerarCodigoValidacaoVoucher_();

    /* O PERCENTUAL SAI DA SOLICITAÇÃO, NUNCA DE UM NÚMERO ESCRITO NA MÃO.
     *
     * ESTA LINHA IMPRIMIU 70% NUM CERTIFICADO DE MEDICINA, que é 50%.
     * Achado por conferência do usuário num PDF real, em 17/08/2026.
     *
     * A ordem estava invertida e o padrão era um chute. `opcoes.percentual`
     * vinha primeiro — e a tela mandava `{ percentual: 70 }` FIXO em
     * Scripts_Certificado.html, para toda emissão. Resultado: o
     * PERCENTUAL_APLICADO, calculado pela regra da convenção e gravado certo
     * na planilha, nunca era lido. O documento oficial saía com um número que
     * ninguém escolheu.
     *
     * POR QUE DEMOROU A APARECER: 70 é o percentual de Humanas, que é a área
     * mais comum. Todo certificado de humanas saiu correto por coincidência.
     * Só Saúde (50) e Engenharia (60) revelavam o defeito — e bastava não
     * emitir nenhum desses para o sistema parecer certo por meses.
     *
     * AGORA: o gravado manda. `opcoes.percentual` só entra quando a linha não
     * tem percentual — caso de solicitação antiga, anterior ao cálculo
     * automático.
     *
     * E NÃO HÁ MAIS PADRÃO. O `|| 70` saiu de propósito: sem percentual
     * nenhum, isto RECUSA em vez de inventar um número. Foi exatamente o
     * padrão silencioso que transformou um campo vazio num certificado
     * errado — e certificado é documento que a escola aceita como prova de
     * desconto. Recusar dá trabalho a uma pessoa; inventar dá prejuízo a
     * alguém. */
    const percentualBruto = String(
      reg.PERCENTUAL_APLICADO !== undefined && String(reg.PERCENTUAL_APLICADO).trim() !== ""
        ? reg.PERCENTUAL_APLICADO
        : (opcoes.percentual !== undefined ? opcoes.percentual : "")
    ).replace("%", "").replace(",", ".").trim();

    const percentual = Number(percentualBruto);

    if (!isPreview && (!percentualBruto || isNaN(percentual) || percentual <= 0)) {
      return {
        ok: false,
        semPercentual: true,
        mensagem: "Esta solicitação está sem percentual de desconto. Abra a " +
                  "solicitação, confira a modalidade e a área do curso para a " +
                  "regra calcular, e emita depois — o certificado não pode sair " +
                  "com um percentual arbitrado."
      };
    }

    /* O que foi digitado agora manda; o que já estava guardado salva a
     * emissão de quem não digitou nada. */
    const rg = valorSeguroVoucher_(opcoes.rg || reg.RG_SOLICITANTE || "");
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

    etapa = "montar o HTML do certificado (logo, assinatura, QR, marca d'água)";
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

    etapa = "converter em PDF e salvar na pasta do Drive";
    const pdfVoucher = salvarHtmlComoPdfVoucher_(
      htmlVoucher,
      "Voucher Bolsa - " + protocolo + " - " + reg.NOME_SOLICITANTE
    );

    let linkOficio = "";
    let idOficio = "";

    if (opcoes.enviarRhEscola === true) {
      etapa = "gerar o ofício da escola";
      const htmlOficio = gerarHtmlOficioEscolaVoucher_(dadosDoc);
      const pdfOficio = salvarHtmlComoPdfVoucher_(
        htmlOficio,
        "Oficio Escola - " + protocolo + " - " + reg.NOME_SOLICITANTE
      );

      linkOficio = pdfOficio.url;
      idOficio = pdfOficio.id;
    }

etapa = "registrar a emissão na planilha";
registrarEmissaoVoucher_(reg, {
  protocolo: protocolo,
  idSolicitacao: reg.ID_SOLICITACAO,
  tipoDocumento: "VOUCHER",
  codigo: codigo,
  linkArquivo: pdfVoucher.url,
  percentual: percentual,
  usuario: usuario
});

    /* O REGISTRO DA EMISSÃO DIZ EM FACE DE QUEM E QUANDO — pedido do usuário
     * em 13/08/2026.
     *
     * Era "Voucher emitido." nos três lugares que gravam: a solicitação, o
     * protocolo e o histórico. Uma frase que não diz de quem nem quando não
     * responde a única pergunta que se faz meses depois, olhando a linha:
     * "esse voucher saiu para quem, e em que dia?". O nome do beneficiário
     * pode ser o do filho, não o do titular — e é justamente esse o caso em
     * que a frase genérica engana.
     *
     * Montado UMA vez e usado nos três, para os três dizerem o mesmo. Quando
     * a emissão traz observação própria (o `opcoes.observacao`), ela ganha o
     * carimbo junto em vez de perdê-lo. */
    var emFaceDe = String(reg.NOME_BENEFICIARIO || reg.NOME_SOLICITANTE || "").trim();
    var quandoTexto = Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
    var carimboEmissao = "Voucher emitido em face de " +
      (emFaceDe || "beneficiário não identificado") + " em " + quandoTexto +
      (usuario ? " por " + usuario : "") + ".";

    etapa = "atualizar o status para EMITIDO";
    atualizarStatusSolicitacao_(item, "EMITIDO",
      opcoes.observacao ? (carimboEmissao + " | " + opcoes.observacao) : carimboEmissao, {
      DATA_EMISSAO: agora
    });

    atualizarStatusProtocolo_(protocolo, "EMITIDO", usuario, carimboEmissao);
    /* O RG digitado agora fica na linha, para a próxima emissão já vir com
     * ele. Nunca lança: o certificado já foi gerado quando isto roda, e
     * perder a emissão por causa de uma gravação de conveniência seria
     * trocar o problema grande pelo pequeno. */
    etapa = "gravar o RG do solicitante";
    voucherGravarRgSolicitante_(protocolo, rg);

    /* A MEMÓRIA APRENDE NA EMISSÃO — só aqui, nunca na prévia.
     *
     * Prévia é rascunho: alguém experimentando 100% para ver como fica não
     * está concedendo nada. Se a prévia alimentasse a memória, o padrão
     * passaria a refletir o que se testou, não o que se deu — e a sugestão
     * ficaria pior a cada experimento.
     *
     * O caminho da prévia retorna bem antes desta linha, então a separação
     * é estrutural, não uma condição que alguém possa esquecer de manter. */
    etapa = "atualizar a memória de percentual e instituição";
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

    etapa = "registrar no histórico";
    registrarHistoricoVoucher_(
      reg.ID_SOLICITACAO,
      reg.CPF_SOLICITANTE,
      "VOUCHER_EMITIDO",
      usuario,
      carimboEmissao + " Código: " + codigo,
      protocolo
    );

    /* RETIRADA PRESENCIAL: O VOUCHER DELE NÃO SAI POR E-MAIL.
     *
     * Decisão do usuário em 14/08/2026, escolhendo "não envia — só retirada
     * presencial" entre as três opções. O certificado é gerado e fica
     * guardado; a pessoa busca na sede.
     *
     * A TRAVA MORA AQUI, no backend, e não em não marcar a caixinha na tela.
     * Marcar caixinha é aparência: qualquer chamada direta, qualquer tela
     * futura e qualquer lote passariam por cima. Se `opcoes.enviarAssociado`
     * vier `true` para um atendimento presencial, o envio NÃO acontece e o
     * motivo fica registrado — em vez de sair calado, que é como um e-mail
     * indevido viraria descoberta de terceiro. */
    etapa = "enviar por e-mail ao associado";
    var envioBloqueadoPresencial = false;
    if (opcoes.enviarAssociado === true && retiradaPresencial) {
      envioBloqueadoPresencial = true;
      registrarHistoricoVoucher_(
        reg.ID_SOLICITACAO,
        reg.CPF_SOLICITANTE,
        "EMAIL_NAO_ENVIADO_RETIRADA_PRESENCIAL",
        usuario,
        "Envio por e-mail não realizado: atendimento presencial, o voucher " +
        "fica guardado para retirada na sede.",
        protocolo
      );
    } else if (opcoes.enviarAssociado === true) {
      enviarVoucherAssociado_(reg, {
        protocolo: protocolo,
        codigo: codigo,
        linkPdf: pdfVoucher.url,
        percentual: percentual
      });
    }

    etapa = "enviar por e-mail à escola";
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
      /* A mensagem DIZ a diferença. Quem emite precisa saber, na hora, que
       * aquele voucher não foi para a caixa de entrada de ninguém — senão
       * a pessoa vai embora esperando um e-mail que nunca vem. */
      mensagem: retiradaPresencial
        ? "Voucher emitido. Atendimento presencial: o documento NÃO foi " +
          "enviado por e-mail e fica guardado para retirada na sede."
        : "Voucher emitido com sucesso.",
      codigoValidacao: codigo,
      linkPdf: pdfVoucher.url,
      idArquivo: pdfVoucher.id,
      linkOficio: linkOficio,
      idOficio: idOficio,
      html: htmlVoucher,
      percentual: percentual,
      retiradaPresencial: retiradaPresencial,
      envioBloqueadoPresencial: envioBloqueadoPresencial
    };

  } catch (e) {
    Logger.log("gerarDocumentoVoucher · ETAPA: " + etapa +
               "\nmensagem: " + e.message +
               "\npilha: " + (e.stack || "(sem pilha)"));
    return {
      ok: false,
      etapa: etapa,
      mensagem: "Erro ao gerar voucher na etapa \"" + etapa + "\": " + e.message
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
    arquivoAplicarPolitica_(file, "VoucherPdf.gs");
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
/**
 * O período da CCT que o certificado cita — "2026/2027".
 *
 * NÃO É CONSTANTE AQUI DE PROPÓSITO. Sai de NEGCOL_VIGENCIA, em
 * NegociacaoColetiva.gs, que é onde a CCT vigente já era declarada e que o
 * t10 confere contra o texto do documento. Assim, quando a CCT for trocada no
 * ano que vem, o certificado acompanha sozinho — e ninguém precisa lembrar
 * que existia um ano escrito dentro do gerador de PDF.
 *
 * O papel de referência mostra exatamente o custo de não fazer isso: emitido
 * em agosto de 2026, cita "2025/2026", CCT que venceu em 28/02/2026.
 *
 * O fallback existe porque este arquivo não pode depender da ordem de
 * carregamento dos .gs no Apps Script. Se NEGCOL_VIGENCIA não estiver lá, o
 * certificado sai sem o ano em vez de sair com "undefined" — omitir é feio,
 * escrever errado é pior.
 */
function cctVigenteVoucher_() {
  try {
    if (typeof NEGCOL_VIGENCIA === "undefined" || !NEGCOL_VIGENCIA) return "vigente";
    const achou = /(\d{4}\/\d{4})/.exec(String(NEGCOL_VIGENCIA.identificacao || ""));
    return achou ? achou[1] : "vigente";
  } catch (e) {
    return "vigente";
  }
}

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

  const rg = dados.rg || reg.RG || reg.RG_SOLICITANTE || "";
  /* O CPF É DO TITULAR, como o RG — mesmo quando o beneficiário é o filho.
   * Quem tem vínculo de emprego com a instituição é o associado, e é o
   * vínculo dele que sustenta o benefício; identificar o dependente por
   * documento não diria nada à escola.
   *
   * Ele não existe no papel de hoje — entrou por pedido do usuário em
   * 13/08/2026 ("tem que ter o CPF também e identidade"). Passa pelo mesmo
   * formatarCpfVoucher_ que devolve o zero à esquerda que o Sheets come. */
  const cpf = formatarCpfVoucher_(reg.CPF_SOLICITANTE || "");
  const curso = reg.CURSO || "";
  /* Normalizado: sem isto o certificado sairia com "semestre letivo de Thu
     Jan 01 2026 05:00:00 GMT-0300". Ver voucherPeriodoTexto_. */
  const periodo = voucherPeriodoTexto_(reg.PERIODO_REFERENCIA);
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

  /* O período é escrito DIFERENTE nos dois papéis, e a diferença não é
   * estilo — é como a frase se encaixa:
   *
   *   titular ..... "...do Curso de BIOMEDICINA semestre 2026/2."
   *   dependente .. "...do Curso de Biomedicina, referente ao semestre
   *                  letivo de 2026/2, após verificação..."
   *
   * Nos dois casos, bolsa anual não tem semestre — daí o par ano/semestre. */
  const ehAnual = regime.indexOf("ANUAL") > -1;
  const rotuloPeriodo = (ehAnual ? "ano letivo de " : "semestre letivo de ") + periodo;
  const rotuloPeriodoTitular = (ehAnual ? "ano " : "semestre ") + periodo;

  const qrCodeUrl = gerarQrCodeVoucherUrl_(codigo);
  const assinaturaImg = assinaturaPresidenteVoucher_();
  const logoImg = logoSindicatoVoucher_();
  /* A marca d'água tem imagem PRÓPRIA — a do papel do sindicato, extraída do
   * PDF real. Reusar a logo com transparência chegava perto e não era: a logo
   * traz o texto "SindEducação ES" junto, e o que aparece no fundo da página
   * é só o símbolo. Ver VoucherMarcaDagua.gs. */
  const marcaDagua = (typeof marcaDaguaVoucher_ === "function") ? marcaDaguaVoucher_() : "";
  /* ── CABEÇALHO E RODAPÉ: A ARTE REAL, COM DESENHO DE RESERVA ──────────
   *
   * ERRO MEU, CORRIGIDO EM 13/08/2026 — vale registrar porque a conclusão
   * errada quase virou arquitetura.
   *
   * Eu tinha medido UM PDF emitido no ar, visto que faltavam o cabeçalho e o
   * rodapé, e concluído que o conversor `getAs(MimeType.PDF)` largava as
   * imagens grandes (12 KB e 21 KB) pelo caminho. Reescrevi as duas peças em
   * CSS por causa disso.
   *
   * Estava errado. Um segundo PDF, emitido 46 minutos depois, traz as duas
   * imagens inteiras — 1000×177 com 12.010 bytes e 1000×226 com 21.865. O
   * conversor nunca largou nada. O que faltava, na primeira emissão, era o
   * PRÓPRIO ARQUIVO: as constantes de cabeçalho e rodapé ainda não estavam no
   * projeto do Apps Script naquele momento.
   *
   * Uma amostra, duas explicações possíveis, e eu escolhi a que exigia menos
   * verificação. A arte volta a ser imagem porque a arte é melhor: a faixa
   * rosa do papel é um paralelogramo, os contatos têm ícones e a tarja do
   * Salmos é manuscrita — nada disso se reproduz com retângulo de CSS.
   *
   * O DESENHO FICA COMO RESERVA. Se um dia a constante não estiver lá, o
   * documento sai com a logo pequena e as faixas desenhadas em vez de sair
   * careca — e é isso que a primeira emissão precisava ter feito. Reserva
   * que ninguém exercita é reserva que não funciona, então o t33 exercita as
   * duas pontas. */
  const cabecalhoImg = (typeof cabecalhoVoucher_ === "function") ? cabecalhoVoucher_() : "";
  const rodapeImg = (typeof rodapeVoucher_ === "function") ? rodapeVoucher_() : "";
  const logoPapel = (typeof logoVoucherPapel_ === "function") ? logoVoucherPapel_() : "";
  /* O rodapé virou desenho; a data por extenso vem do mesmo helper que o
     ofício da escola já usa, para os dois documentos datarem igual. */
  const dataExtenso = dataExtensoVoucher_(dados.dataEmissao || new Date());

  function frag(rotulo, valor) {
    return valor ? rotulo + "<strong>" + escHtmlVoucher_(valor) + "</strong>" : "";
  }

  /* ── SÃO DUAS REDAÇÕES, NÃO UMA ───────────────────────────────────────
   *
   * O usuário mandou, em 18/08/2026, os DOIS certificados que o sindicato
   * emite hoje — "segue os modelos como devem sair tanto para o titular
   * quanto o dependente" —, escaneados dos originais assinados.
   *
   * Até aqui o código tinha UMA redação (a do titular) e injetava nela
   * ", dependente de FULANO" quando o beneficiário era filho. Está errado:
   * o papel do dependente não é o do titular com uma oração a mais. Ele
   * tem fundamento jurídico próprio, verbo próprio e fecho próprio.
   *
   *   TITULAR ....... "em conformidade com a cláusula de Incentivo ao
   *                    Aprimoramento prevista na CCT"
   *                   "ATENDE AOS REQUISITOS ESTABELECIDOS para a concessão"
   *                   "...e semestralidade/ANUIDADE ESCOLAR do Curso de X
   *                    semestre 2026/2"
   *                   fecho: "A presente certificação destina-se..."
   *
   *   DEPENDENTE .... "nos termos do CONVÊNIO firmado com o SINEPE-ES"
   *                   "ENCONTRA-SE REGULARMENTE HABILITADO ao benefício"
   *                   "...e semestralidade do Curso de X, referente ao
   *                    semestre letivo de 2026/2, após verificação..."
   *                   fecho: "O presente certificado destina-se
   *                    EXCLUSIVAMENTE... pessoal, individual e
   *                    intransferível..."
   *
   * ATENÇÃO A UMA COISA QUE OS DOIS MODELOS CONFIRMAM: no do dependente, o
   * RG e o vínculo de emprego são do TITULAR, não da criança. Quem tem
   * vínculo com a instituição é o associado, e é o vínculo dele que
   * sustenta o benefício. `rg` e `cpf` já vêm do titular — não trocar.
   *
   * O QUE MUDA EM RELAÇÃO AO PAPEL, e por quê (confirmado pelo usuário em
   * 18/08/2026, pergunta a pergunta):
   *
   * - "inscrita no CNPJ: sob nº" → "inscrita no CNPJ sob nº". O
   *   dois-pontos é erro de digitação do original nos dois modelos.
   *   Reproduzir erro não é fidelidade.
   * - O ano da CCT sai de NEGCOL_VIGENCIA, não fixo no texto. O papel cita
   *   "2025/2026" num documento de agosto de 2026 — CCT já vencida (a
   *   vigente vai de 01/03/2026 a 28/02/2027). Amarrado à fonte única, o
   *   certificado não envelhece sozinho.
   * - O modelo do dependente não traz a linha de local e data; o do
   *   titular traz. Os DOIS passam a trazer, por decisão dele: documento
   *   sem data é difícil de conferir depois.
   *
   * Cada oração some quando o dado dela não existe: sem RG não se escreve
   * "portador da carteira de identidade nº —", que é pior que não dizer. */

  /* A identificação do TITULAR — RG, CPF, instituição, mantenedora, CNPJ.
     É idêntica nos dois modelos, e é por isso que fica separada: o que
     muda entre titular e dependente é o texto ao redor dela. */
  const identificacaoTitular =
    frag(", portador da carteira de identidade nº ", rg) +
    /* "e inscrito no CPF sob o nº" — a mesma construção que o documento já
     * usa para o CNPJ da mantenedora, para as duas identificações lerem
     * igual. Some inteira quando não há CPF, como as outras orações. */
    (cpf ? " e inscrito no CPF sob o nº <strong>" + escHtmlVoucher_(cpf) + "</strong>" : "") +
    frag(", empregado da instituição ", instituicaoTexto) +
    frag(", mantida pela ", mantenedora) +
    (cnpj ? ", inscrita no CNPJ sob nº <strong>" + escHtmlVoucher_(cnpj) + "</strong>" : "");

  const beneficioExtenso =
    "<strong>" + escHtmlVoucher_(percentual) + "% (" +
    escHtmlVoucher_(percentualExtenso) + ")</strong>";

  const corpo = ehDependente
    ? /* ── DEPENDENTE ── */
      "O Sindicato dos Educadores Técnico - Administrativos em Estabelecimentos de Ensino " +
      "Particular no Estado do Espírito Santo – <strong>SINDEDUCAÇÃO-ES</strong>, nos termos " +
      "do convênio firmado com o Sindicato das Empresas Particulares de Ensino do Estado do " +
      "Espírito Santo – <strong>SINEPE – ES</strong>, certifica que " +
      "<strong>" + escHtmlVoucher_(beneficiario) + "</strong>" +
      ", dependente de <strong>" + escHtmlVoucher_(nomeSolicitante) + "</strong>" +
      identificacaoTitular +
      " encontra-se regularmente habilitado ao benefício de " + beneficioExtenso +
      " de desconto sobre a matrícula, rematrícula e semestralidade" +
      frag(" do Curso de ", curso) +
      (periodo ? ", referente ao " + escHtmlVoucher_(rotuloPeriodo) : "") +
      ", após verificação do atendimento aos requisitos exigidos para a concessão do benefício."

    : /* ── TITULAR ── */
      "O <strong>SINDEDUCAÇÃO-ES</strong> - Sindicato dos Educadores Técnico – Administrativos " +
      "em Estabelecimentos de Ensino Particular no Estado do Espírito Santo, em conformidade " +
      "com a cláusula de Incentivo ao Aprimoramento prevista na Convenção Coletiva de " +
      "Trabalho " + escHtmlVoucher_(cctVigenteVoucher_()) + ", firmada com o " +
      "<strong>SINEPE – ES</strong> - Sindicato das Empresas Particulares de Ensino do Estado " +
      "do Espírito Santo, certifica que " +
      "<strong>" + escHtmlVoucher_(beneficiario) + "</strong>" +
      identificacaoTitular +
      ", atende aos requisitos estabelecidos para a concessão do benefício de " +
      beneficioExtenso +
      " de desconto sobre matrícula, rematrícula e semestralidade/anuidade escolar" +
      frag(" do Curso de ", curso) +
      (periodo ? " " + escHtmlVoucher_(rotuloPeriodoTitular) : "") +
      ".";

  /* O segundo parágrafo também é diferente nos dois papéis. O do
     dependente é mais restritivo — "exclusivamente", "pessoal, individual
     e intransferível" —, e faz sentido: benefício de filho não se
     transfere para outro filho. */
  const fecho = ehDependente
    ? "O presente certificado destina-se exclusivamente à comprovação da habilitação do " +
      "beneficiário para utilização do benefício acima especificado, sendo pessoal, individual " +
      "e intransferível, produzindo efeitos enquanto permanecerem atendidas as condições que " +
      "fundamentaram sua emissão."
    : "A presente certificação destina-se à comprovação da habilitação do beneficiário ao " +
      "referido desconto, nos termos da Convenção Coletiva de Trabalho vigente, para fins de " +
      "utilização junto à instituição de ensino acima identificada.";

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
    /* SERIFADA, como o documento oficial. O certificado que o sindicato
     * emite hoje é Times; sair em Arial fazia o mesmo texto parecer outro
     * documento — e quem recebe compara com o que já viu. */
    "body{font-family:'Times New Roman',Times,Georgia,serif;color:#1a1a1a;" +
      "-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
    ".pagina{position:relative;width:210mm;min-height:297mm;box-sizing:border-box;" +
      "padding:0 0 40mm;overflow:hidden;page-break-inside:avoid;}" +

    /* A PRÉVIA TEM QUE PARECER UMA FOLHA — pedido do usuário em 13/08/2026.
     *
     * O documento sempre teve A4 em milímetros, mas isso vale para o PDF.
     * Na prévia, que abre numa aba do navegador, a página era um bloco branco
     * encostado no canto superior esquerdo de uma tela branca: não dava para
     * ver onde a folha começava nem onde terminava, e portanto não dava para
     * conferir margem, corte de rodapé nem se o conteúdo cabe.
     *
     * Só em `@media screen`: no papel, nada disto existe — fundo cinza e
     * sombra em PDF seriam tinta desperdiçada, e a conversão do Apps Script
     * ignora o bloco de tela por definição. O documento impresso continua
     * exatamente o mesmo. */
    "@media screen{" +
      "body{background:#e9edf3;padding:18px 0;}" +
      ".pagina{margin:0 auto;background:#fff;" +
        "box-shadow:0 2px 6px rgba(15,39,71,.12),0 12px 34px rgba(15,39,71,.18);}" +
    "}" +

    /* ── cabeçalho: a arte do papel, largura inteira ── */
    ".cab-img{width:100%;display:block;}" +

    /* ── e o desenho de reserva, para quando a arte não estiver lá ──
       Só entra em cena se cabecalhoVoucher_ devolver vazio. Ver o comentário
       longo em gerarHtmlDocumentoVoucher_ sobre por que a reserva existe. */
    ".cab{position:relative;height:40mm;padding:9mm 0 0 28mm;box-sizing:border-box;}" +
    ".cab-logo{width:60mm;height:auto;display:block;}" +
    /* AS DUAS FAIXAS SE SOBREPÕEM, não se empilham. Medindo o papel real: a
     * azul atravessa até a borda direita e a rosa fica POR CIMA dela, recuada,
     * com o topo 1,5mm acima — é isso que dá o efeito de camada. No primeiro
     * desenho a rosa estava 4mm acima da azul e o resultado foi uma escada de
     * duas faixas separadas, coisa que o papel não tem. */
    ".faixa{position:absolute;}" +
    ".faixa-azul{right:0;top:13mm;width:100mm;height:9mm;background:#29abe2;}" +
    ".faixa-rosa{right:33mm;top:11.5mm;width:63mm;height:9mm;background:#ec008c;}" +

    /* ── marca d'água: símbolo no canto inferior direito, sangrando ── */
    /* A IMAGEM JÁ É CINZA CLARÍSSIMO — ela nasce assim no papel do sindicato.
     * Estava com opacity .07 por cima disso, e o resultado foi marca d'água
     * NENHUMA: a prévia renderizada saiu com o fundo branco. Opacidade se
     * aplica sobre o tom que a imagem tem, não sobre o tom que ela deveria
     * ter. */
    ".dagua{position:absolute;right:-8mm;bottom:14mm;width:112mm;opacity:.9;" +
      "z-index:0;pointer-events:none;}" +

    /* 15mm de margem lateral, medido no papel (≈6% da largura da folha). Com
     * 20mm o texto sobrava linha e a mancha ficava estreita demais perto do
     * documento real. */
    ".corpo{position:relative;z-index:1;padding:0 15mm;}" +
    "h1{text-align:center;font-size:13.5pt;font-weight:bold;color:#1a1a1a;" +
      "margin:14mm 0 14mm;letter-spacing:.01em;}" +
    /* ENTRELINHA 1.45, não 1.75: o certificado do sindicato é um texto denso
     * de dois parágrafos, e com 1.75 o mesmo conteúdo ocupava meia página a
     * mais e parecia carta, não certificado. */
    "p{font-size:11pt;line-height:1.45;text-align:justify;margin:0 0 6mm;}" +

    /* À ESQUERDA, como no certificado que o sindicato emite. Centralizada era
     * escolha minha, e destoava do papel que a escola já conhece. */
    ".assinatura{margin-top:14mm;text-align:left;padding-left:4mm;}" +
    ".assinatura img{width:34mm;height:auto;display:block;margin:0 0 1mm;}" +
    ".pres{font-size:11pt;font-weight:bold;}" +
    /* Negrito também no cargo, com o nome do sindicato em itálico — é assim no
     * papel, e é o único lugar do documento onde a marca aparece escrita. */
    ".cargo{font-size:11pt;font-weight:bold;}" +
    ".cargo em{font-style:italic;}" +

    /* ── rodapé: contatos + faixa do salmo + a validação ── */
    /* CADA PEÇA ANCORADA NA PÁGINA, e não empilhada dentro do rodapé.
       No primeiro desenho a tarja azul não aparecia: o bloco do rodapé era
       absoluto com bottom:0 e os filhos em fluxo, e a tarja acabava fora da
       área visível de uma página com overflow:hidden. Ancorando as duas
       diretamente — contatos acima, tarja colada no pé — não há empilhamento
       para dar errado, e o conversor não precisa calcular fluxo nenhum. */
    /* SEM ALTURA FIXA: com a arte, quem dá a altura é a própria imagem. Fixar
     * 44mm aqui cortava o rodapé do papel, que é mais alto que isso. */
    ".rodape{position:absolute;left:0;right:0;bottom:0;}" +
    ".rod-img{width:100%;display:block;}" +
    /* O desenho de reserva precisa da altura, porque as peças dele são
     * absolutas e sem caixa não teriam de onde se pendurar. */
    ".rod-desenho{position:relative;height:44mm;}" +
    /* 25mm: a tarja termina em 22mm, e com 18mm as duas últimas linhas de
     * contato caíam DENTRO do azul — texto azul sobre fundo azul, ilegível.
     * Medido na renderização, não estimado. */
    ".rod-contatos{position:absolute;left:28mm;bottom:25mm;font-size:8.5pt;" +
      "color:#2b6cb0;line-height:1.75;}" +
    /* A TARJA NÃO ENCOSTA NAS BORDAS. No papel ela é um retângulo com a mesma
     * margem lateral da mancha de texto e sobra branca embaixo; encostada nas
     * quatro bordas parecia rodapé de sistema, não papel timbrado. */
    ".rod-tarja{position:absolute;left:14mm;right:14mm;bottom:8mm;background:#1a7fd4;" +
      "color:#fff;text-align:center;font-style:italic;font-size:11pt;" +
      "padding:3mm 0;letter-spacing:.2px;}" +
    ".data-local{text-align:right;margin:14mm 0 0;font-size:11pt;}" +
    /* A validação flutua SOBRE o rodapé do papel, no espaço vazio à direita
     * dos contatos — assim ela não empurra a arte nem cria uma faixa a mais. */
    ".valida-box{position:absolute;right:14mm;bottom:26mm;text-align:right;}" +
    /* O QR E O CÓDIGO DE VALIDAÇÃO FICAM — decisão do usuário em 13/08/2026,
     * reafirmada depois de eu apontar que o certificado de referência do
     * sindicato NÃO os tem. Não reabrir: é acréscimo nosso ao modelo, feito
     * de propósito, e a ausência deles no papel antigo não é argumento para
     * tirá-los daqui.
     *
     * Por que aqui e não no meio do documento: o que é acréscimo não disputa
     * espaço com o que a escola já sabe ler. Discreto no canto do rodapé,
     * flutuando sobre a arte, sem empurrar nada. */
    ".valida{font-size:7pt;color:#64748b;line-height:1.35;margin-top:1mm;}" +
    ".valida-qr{width:15mm;height:15mm;display:block;margin-left:auto;}" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div class='pagina'>" +

    (marcaDagua ? "<img class='dagua' src='" + escHtmlVoucher_(marcaDagua) + "'>" : "") +

    /* A arte primeiro; o desenho só se ela faltar. Nunca os dois — foi o que
     * aconteceu numa tentativa anterior e as faixas saíram em duplicata. */
    (cabecalhoImg
      ? "<img class='cab-img' src='" + escHtmlVoucher_(cabecalhoImg) + "'>"
      : "<div class='cab'>" +
          (logoPapel ? "<img class='cab-logo' src='" + escHtmlVoucher_(logoPapel) + "'>" : "") +
          "<div class='faixa faixa-azul'></div>" +
          "<div class='faixa faixa-rosa'></div>" +
        "</div>") +

    "<div class='corpo'>" +
    "<h1>CERTIFICADO DE HABILITAÇÃO À BOLSA DE ESTUDOS</h1>" +
    "<p>" + corpo + "</p>" +
    /* Segundo parágrafo, extraído do papel real — e DIFERENTE nos dois
     * modelos. Ver o bloco que monta `fecho`. */
    "<p>" + fecho + "</p>" +

    /* A LINHA DE LOCAL E DATA FICA NO FIM DO TEXTO, alinhada à direita,
     * logo acima da assinatura — como nos dois modelos que o usuário
     * mandou em 18/08/2026, e como ele reforçou: "a data tem que sair no
     * final do arquivo igual o modelo enviado". Depois dela só vem quem
     * assina. */
    "<div class='data-local'>" + escHtmlVoucher_(dataExtenso) + "</div>" +

    "<div class='assinatura'>" +
    (assinaturaImg ? "<img src='" + escHtmlVoucher_(assinaturaImg) + "'>" : "") +
    "<div class='pres'>" + escHtmlVoucher_(PRESIDENTE_VOUCHER) + "</div>" +
    "<div class='cargo'>Presidente – <em>SindEducação/ES</em></div>" +
    "</div>" +
    "</div>" +

    "<div class='rodape'>" +
    (rodapeImg
      ? "<img class='rod-img' src='" + escHtmlVoucher_(rodapeImg) + "'>"
      : "<div class='rod-desenho'>" +
          /* E-mail e site conferidos com o usuário em 13/08/2026:
           * secretaria@sindeducacao.com e www.sindeducacao.com.
           *
           * ATENÇÃO: a ARTE do rodapé (VOUCHER_RODAPE_B64_) ainda traz
           * "contato@sindeducacao.com" e "sindeducacao.com" desenhados dentro
           * do JPEG, e daqui não há como corrigir — imagem não se edita por
           * código. Enquanto o caminho normal for a arte, é o endereço antigo
           * que sai impresso. Para corrigir de verdade, é preciso uma nova
           * imagem de rodapé. */
          "<div class='rod-contatos'>" +
            "(27) 3222-2706<br>(27) 99735-8900<br>www.sindeducacao.com<br>" +
            "secretaria@sindeducacao.com<br>SindEducacaoES<br>sindeducacaoes" +
          "</div>" +
          "<div class='rod-tarja'>Você comerá do fruto do seu trabalho e será feliz e próspero. Salmos 128:2.</div>" +
        "</div>") +
    "<div class='valida-box'>" +
    (qrCodeUrl ? "<img class='valida-qr' src='" + escHtmlVoucher_(qrCodeUrl) + "'>" : "") +
    "<div class='valida'>" +
    (codigo ? "Código " + escHtmlVoucher_(codigo) + "<br>" : "") +
    (protocolo ? escHtmlVoucher_(protocolo) : "") +
    "</div>" +
    "</div>" +
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
  /* Normalizado: sem isto o certificado sairia com "semestre letivo de Thu
     Jan 01 2026 05:00:00 GMT-0300". Ver voucherPeriodoTexto_. */
  const periodo = voucherPeriodoTexto_(reg.PERIODO_REFERENCIA);

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


/**
 * Guarda o RG do titular na linha da solicitação.
 *
 * Só escreve quando há RG novo e a coluna existe — não inventa coluna, pela
 * mesma razão que o resto do módulo não inventa: aba de produção com coluna
 * a mais criada por engano é o começo do desalinhamento que custou 13 colunas
 * em 12/08.
 */
function voucherGravarRgSolicitante_(protocolo, rg) {
  var valor = String(rg || "").trim();
  if (!valor || !protocolo) return false;
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!sh || sh.getLastRow() < 2) return false;

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });
    var iRg = cab.indexOf("RG_SOLICITANTE");
    var iProt = cab.indexOf("NUMERO_PROTOCOLO");
    if (iProt === -1) iProt = cab.indexOf("PROTOCOLO");
    if (iRg === -1 || iProt === -1) return false;

    var alvo = String(protocolo).trim().toUpperCase();
    var col = sh.getRange(2, iProt + 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = col.length - 1; i >= 0; i--) {
      if (String(col[i][0] || "").trim().toUpperCase() !== alvo) continue;
      var cel = sh.getRange(i + 2, iRg + 1);
      /* Não sobrescreve um RG já guardado com o mesmo valor — poupa escrita
       * e mantém a data de modificação da linha significando alguma coisa. */
      if (String(cel.getValue() || "").trim() === valor) return true;
      cel.setValue(valor);
      return true;
    }
    return false;
  } catch (e) {
    Logger.log("RG não foi guardado (o certificado saiu): " + e.message);
    return false;
  }
}
