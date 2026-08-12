// =============================================================================
// ARQUIVO: VoucherSolicitacao.gs
// Solicitação, validação, protocolo e gravação do Portal Voucher
// =============================================================================

function salvarCadastroESolicitacaoVoucher(payload) {
  try {
    validarPayloadPortalVoucher_(payload);
    setupVoucherModuleFase1();

    const cpf              = normalizarCPF_(payload.cpf);
    const nome             = valorSeguroVoucher_(payload.nome);
    const tipoBeneficiario = String(payload.tipoBeneficiario || "").trim().toUpperCase();
    const nomeBeneficiario = valorSeguroVoucher_(payload.nomeBeneficiario || (tipoBeneficiario === "TITULAR" ? nome : ""));
    const parentesco       = valorSeguroVoucher_(payload.parentesco || tipoBeneficiario).toUpperCase();
    const escolaAtual      = valorSeguroVoucher_(payload.escolaAtual || payload.escola);
    const tipoDocVinculo   = inferirTipoDocumentoVinculo_(payload);

    registrarOuAtualizarCadastroVoucher({
      cpf: cpf,
      nome: nome,
      dataNascimento: payload.dataNascimento,
      telefone: payload.telefone,
      email: payload.email,
      endereco: payload.endereco,
      escolaAtual: escolaAtual,
      cargoFuncao: payload.cargoFuncao,
      situacaoVinculo: payload.situacaoVinculo,
      origemCadastro: "PORTAL_VOUCHER",
      observacoes: "Cadastro/atualização realizada pelo Portal Voucher."
    });

    const resultadoBase = consultarAssociadoNaBase_(cpf);

    const situacaoSindicalFinal = resultadoBase.filiado
      ? "ASSOCIADO"
      : (resultadoBase.encontrado ? "NAO_ASSOCIADO" : "PENDENTE_VALIDACAO");

    atualizarSituacaoSindicalCadastro_(cpf, situacaoSindicalFinal);

    const idadeBeneficiario = calcularIdade_(payload.dataNascimentoBeneficiario);
    const regra             = calcularRegraVoucher_(payload, idadeBeneficiario);

    const dupCheck = verificarDuplicidadeVoucher_(
      cpf,
      payload.modalidade,
      payload.periodoReferencia,
      regra.regime
    );

    if (dupCheck.duplicado) {
      return {
        ok: false,
        mensagem: "Já existe uma solicitação ativa para este benefício no período " +
          dupCheck.periodo + ". Protocolo: " + dupCheck.protocolo + "."
      };
    }

    const escolaInfo    = buscarEscolaPorNome_(escolaAtual);
    const idSolicitacao = gerarIdPadrao_("SOL");
    const protocolo     = gerarNumeroProtocolo_();
    const usuario       = obterUsuarioAtualVoucher_();
    const agora         = new Date();

    const escolaNaoCadastrada = !escolaInfo.cnpj && !escolaInfo.unidade ? "SIM" : "NAO";
    const funcionarioNovo     = !resultadoBase.encontrado ? "SIM" : "NAO";

    let statusValidacaoSindical = "PENDENTE_VALIDACAO_SINDICAL";
    let statusSolicitacao       = "AGUARDANDO_VALIDACAO_CADASTRAL";

    if (!regra.apto) {
      statusSolicitacao = "BLOQUEADA_POR_REGRA";
      statusValidacaoSindical = "NAO_ANALISADO";
    } else if (resultadoBase.filiado) {
      statusSolicitacao = "PENDENTE";
      statusValidacaoSindical = "VALIDADO";
    } else if (resultadoBase.encontrado && !resultadoBase.filiado) {
      statusSolicitacao = "AGUARDANDO_ATENDIMENTO_PRESENCIAL";
      statusValidacaoSindical = "NAO_ASSOCIADO";
    }

    const docsResult       = registrarDocumentosPayloadVoucher_(idSolicitacao, cpf, payload);
    const linkContracheque = docsResult.find(function(d) { return d && d.tipoDocumento !== "DOCUMENTO_PESSOAL"; });
    const linkDocPessoal   = docsResult.find(function(d) { return d && d.tipoDocumento === "DOCUMENTO_PESSOAL"; });

    const ss  = SpreadsheetApp.openById(PLANILHA_ID);
    const sh  = ss.getSheetByName("Voucher_Solicitacoes");
    const shP = ss.getSheetByName("Voucher_Protocolos");

    const headers = obterHeaders_(sh);
    const linha   = new Array(headers.length).fill("");

    function setCol(colName, valor) {
      const i = headers.indexOf(colName);
      if (i > -1) linha[i] = valor;
    }

    setCol("ID_SOLICITACAO", idSolicitacao);
    setCol("DATA_SOLICITACAO", agora);
    setCol("DATA_SOLICITACAO_TEXTO", formatarDataBrVoucher_(agora));

    setCol("CPF_SOLICITANTE", cpf);
    setCol("NOME_SOLICITANTE", nome);
    setCol("EMAIL", valorSeguroVoucher_(payload.email));
    setCol("TELEFONE", valorSeguroVoucher_(payload.telefone));

    setCol("ESCOLA_SELECIONADA", escolaInfo.escola || escolaAtual);
    setCol("UNIDADE_ESCOLA", escolaInfo.unidade || "");
    setCol("CNPJ_ESCOLA", escolaInfo.cnpj || "");
    setCol("CIDADE_ESCOLA", escolaInfo.cidade || "");

    setCol("SITUACAO_SINDICAL", situacaoSindicalFinal);
    setCol("STATUS_VALIDACAO_SINDICAL", statusValidacaoSindical);

    setCol("TIPO_BENEFICIARIO", tipoBeneficiario);
    setCol("NOME_BENEFICIARIO", nomeBeneficiario);
    setCol("DATA_NASCIMENTO_BENEFICIARIO", valorSeguroVoucher_(payload.dataNascimentoBeneficiario));
    setCol("IDADE_BENEFICIARIO", idadeBeneficiario);
    setCol("NOME_TITULAR_ASSOCIADO", valorSeguroVoucher_(payload.nomeTitularAssociado || nome));
    setCol("PARENTESCO", parentesco);
    setCol("ENTEADO_DECLARADO_IR", valorSeguroVoucher_(payload.enteadoDeclaradoIR || "NAO").toUpperCase());

    /* Instituição de ensino — onde a pessoa ESTUDA, diferente da escola onde
     * trabalha. Opcional na gravação para não quebrar solicitações que já
     * existem nem o portal atual, que ainda não coleta estes campos. */
    setCol("INSTITUICAO_ENSINO", valorSeguroVoucher_(payload.instituicaoEnsino));
    setCol("CNPJ_INSTITUICAO",   valorSeguroVoucher_(payload.cnpjInstituicao));
    setCol("EMAIL_INSTITUICAO",  String(payload.emailInstituicao || "").trim().toLowerCase());
    setCol("MODALIDADE", String(payload.modalidade || "").toUpperCase());
    setCol("CURSO", valorSeguroVoucher_(payload.curso));
    setCol("AREA_CURSO", String(payload.areaCurso || "").toUpperCase());
    setCol("ORDEM_FILHO", valorSeguroVoucher_(payload.ordemFilho));
    setCol("REGIME", regra.regime);
    setCol("PERIODO_REFERENCIA", valorSeguroVoucher_(payload.periodoReferencia));
    setCol("PERCENTUAL_APLICADO", regra.percentual);

    setCol("TIPO_DOCUMENTO_VINCULO", tipoDocVinculo);
    setCol("LINK_CONTRACHEQUE", linkContracheque ? linkContracheque.linkArquivo : "");
    setCol("LINK_DOC_PESSOAL", linkDocPessoal ? linkDocPessoal.linkArquivo : "");

    setCol("STATUS_SOLICITACAO", statusSolicitacao);
    setCol("CANAL_ENTRADA", "PORTAL");
    setCol("USUARIO_CADASTRO", usuario);
    setCol("OBSERVACOES", montarObservacaoSolicitacaoVoucher_(regra, {
      escolaNaoCadastrada: escolaNaoCadastrada,
      funcionarioNovo: funcionarioNovo,
      situacaoSindicalFinal: situacaoSindicalFinal
    }));
    setCol("NUMERO_PROTOCOLO", protocolo);

    sh.appendRow(linha);

    if (shP) {
      shP.appendRow([
        protocolo,
        agora,
        idSolicitacao,
        cpf,
        nome,
        escolaInfo.escola || escolaAtual,
        escolaInfo.unidade || "",
        escolaInfo.cnpj || "",
        escolaInfo.cidade || "",
        statusSolicitacao,
        usuario,
        regra.observacao || ""
      ]);
    }

    registrarHistoricoVoucher_(
      idSolicitacao,
      cpf,
      "SOLICITACAO_CRIADA",
      usuario,
      "Solicitação criada via portal. Status: " + statusSolicitacao +
        " | Situação sindical: " + situacaoSindicalFinal +
        " | Escola não cadastrada: " + escolaNaoCadastrada +
        " | Funcionário novo: " + funcionarioNovo,
      protocolo
    );

    enviarEmailConfirmacaoSolicitacaoVoucher_({
      email: valorSeguroVoucher_(payload.email),
      nome: nome,
      protocolo: protocolo,
      nomeBeneficiario: nomeBeneficiario,
      modalidade: payload.modalidade,
      curso: payload.curso,
      escola: escolaInfo.escola || escolaAtual,
      percentual: regra.percentual,
      situacaoSindicalFinal: situacaoSindicalFinal,
      statusSolicitacao: statusSolicitacao
    });

    enviarEmailInternoNovaSolicitacaoVoucher_({
      protocolo: protocolo,
      nome: nome,
      cpf: cpf,
      escola: escolaInfo.escola || escolaAtual,
      modalidade: payload.modalidade,
      curso: payload.curso,
      periodoReferencia: payload.periodoReferencia,
      percentual: regra.percentual,
      statusSolicitacao: statusSolicitacao,
      situacaoSindicalFinal: situacaoSindicalFinal,
      escolaNaoCadastrada: escolaNaoCadastrada,
      funcionarioNovo: funcionarioNovo
    });

    return {
      ok: true,
      mensagem: "Solicitação registrada com sucesso!",
      protocolo: { numeroProtocolo: protocolo },
      solicitacao: { idSolicitacao: idSolicitacao },
      percentual: regra.percentual,
      apto: regra.apto,
      status: statusSolicitacao,
      situacaoSindical: situacaoSindicalFinal
    };

  } catch(e) {
    Logger.log("salvarCadastroESolicitacaoVoucher erro: " + e.message);
    return {
      ok: false,
      mensagem: "Erro ao salvar solicitação: " + e.message
    };
  }
}

function validarPayloadPortalVoucher_(payload) {
  if (!payload) throw new Error("Dados da solicitação não informados.");
  if (!normalizarCPF_(payload.cpf)) throw new Error("CPF inválido.");
  if (!payload.dataNascimento) throw new Error("Informe a data de nascimento.");
  if (!valorSeguroVoucher_(payload.nome)) throw new Error("Informe o nome do solicitante.");
  if (!valorSeguroVoucher_(payload.escolaAtual || payload.escola)) throw new Error("Selecione ou informe a escola.");
  if (!payload.situacaoSindicalDeclarada) throw new Error("Informe a situação sindical.");
  if (!payload.tipoBeneficiario) throw new Error("Informe o tipo de beneficiário.");
  if (!payload.dataNascimentoBeneficiario) throw new Error("Informe a data de nascimento do beneficiário.");
  if (!payload.modalidade) throw new Error("Informe a modalidade.");
  if (!valorSeguroVoucher_(payload.curso)) throw new Error("Informe o curso.");
  if (!valorSeguroVoucher_(payload.periodoReferencia)) throw new Error("Informe o período de referência.");

  const tipoBenef  = String(payload.tipoBeneficiario || "").trim().toUpperCase();
  const modalidade = String(payload.modalidade || "").trim().toUpperCase();

  if (tipoBenef !== "TITULAR" && !valorSeguroVoucher_(payload.nomeBeneficiario)) {
    throw new Error("Informe o nome do beneficiário.");
  }

  if (
    ["EDUCACAO_INFANTIL", "CRECHE", "ENSINO_FUNDAMENTAL", "TECNICO"].indexOf(modalidade) > -1 &&
    tipoBenef !== "TITULAR" &&
    !valorSeguroVoucher_(payload.ordemFilho)
  ) {
    throw new Error("Informe a ordem do filho para a modalidade selecionada.");
  }

  if (modalidade === "GRADUACAO" && !valorSeguroVoucher_(payload.areaCurso)) {
    throw new Error("Informe a área do curso para graduação.");
  }
}

function montarObservacaoSolicitacaoVoucher_(regra, flags) {
  const partes = [];

  if (regra && regra.observacao) partes.push(regra.observacao);

  if (flags && flags.funcionarioNovo === "SIM") {
    partes.push("Possível funcionário novo: CPF não localizado na base de Associados.");
  }

  if (flags && flags.escolaNaoCadastrada === "SIM") {
    partes.push("Escola não localizada no cadastro de escolas.");
  }

  if (flags && flags.situacaoSindicalFinal === "NAO_ASSOCIADO") {
    partes.push("Cadastro identificado como não associado. Orientar atendimento presencial.");
  }

  return partes.join(" | ");
}

function verificarDuplicidadeVoucher_(cpf, modalidade, periodoReferencia, regime) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Solicitacoes");

    if (!sh || sh.getLastRow() < 2) {
      return { duplicado: false };
    }

    const headers = obterHeaders_(sh);
    const idx = function(n) { return headers.indexOf(n); };
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    const cpfNorm = normalizarCPF_(cpf);
    const modalUp = String(modalidade || "").toUpperCase();
    const periodoNorm = String(periodoReferencia || "").trim();
    const regimeUp = String(regime || "ANUAL").toUpperCase();

    const anoAtual = periodoNorm.substring(0, 4);
    const semestreAtual = periodoNorm.indexOf("/") > -1 ? periodoNorm.split("/")[1] : "";

    const statusBloqueantes = [
      "PENDENTE",
      "ANALISE",
      "APROVADO",
      "EMITIDO",
      "AGUARDANDO_VALIDACAO_CADASTRAL",
      "AGUARDANDO_ATENDIMENTO_PRESENCIAL"
    ];

    for (let i = 0; i < dados.length; i++) {
      const cpfLinha = normalizarCPF_(dados[i][idx("CPF_SOLICITANTE")]);
      const modalLinha = String(dados[i][idx("MODALIDADE")] || "").toUpperCase();
      const periodoLinha = String(dados[i][idx("PERIODO_REFERENCIA")] || "").trim();
      const statusLinha = String(dados[i][idx("STATUS_SOLICITACAO")] || "").toUpperCase();
      const regimeLinha = String(dados[i][idx("REGIME")] || "ANUAL").toUpperCase();
      const protocoloLinha = String(dados[i][idx("NUMERO_PROTOCOLO")] || "");

      if (cpfLinha !== cpfNorm) continue;
      if (modalLinha !== modalUp) continue;
      if (statusBloqueantes.indexOf(statusLinha) === -1) continue;

      if (regimeUp === "ANUAL" || regimeLinha === "ANUAL") {
        const anoLinha = periodoLinha.substring(0, 4);

        if (anoLinha && anoAtual && anoLinha === anoAtual) {
          return {
            duplicado: true,
            protocolo: protocoloLinha,
            periodo: periodoLinha
          };
        }
      }

      if (regimeUp === "SEMESTRAL" || regimeLinha === "SEMESTRAL") {
        const anoLinha = periodoLinha.substring(0, 4);
        const semestreLinha = periodoLinha.indexOf("/") > -1 ? periodoLinha.split("/")[1] : "";

        if (
          anoLinha &&
          anoAtual &&
          anoLinha === anoAtual &&
          semestreLinha &&
          semestreAtual &&
          semestreLinha === semestreAtual
        ) {
          return {
            duplicado: true,
            protocolo: protocoloLinha,
            periodo: periodoLinha
          };
        }
      }
    }

    return { duplicado: false };

  } catch(e) {
    Logger.log("verificarDuplicidadeVoucher_ erro: " + e.message);
    return { duplicado: false };
  }
}

function enviarEmailConfirmacaoSolicitacaoVoucher_(dados) {
  try {
    if (!dados || !dados.email) return;

    const isAssociado = String(dados.situacaoSindicalFinal || "").toUpperCase() === "ASSOCIADO";
    const status = String(dados.statusSolicitacao || "").toUpperCase();

    let aviso = "";

    if (!isAssociado || status === "AGUARDANDO_ATENDIMENTO_PRESENCIAL") {
      aviso =
        "<p style='background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;'>" +
        "⚠️ <strong>Atenção:</strong> cadastro identificado como <strong>não associado</strong> ou pendente de validação. " +
        "Guarde este protocolo e compareça à sede do SindEducação-ES em até <strong>15 dias úteis</strong> com sua documentação." +
        "</p>";
    } else {
      aviso =
        "<p style='background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;'>" +
        "✅ Sua solicitação será analisada pela equipe do SindEducação-ES. Após aprovação, o voucher será emitido eletronicamente." +
        "</p>";
    }

    MailApp.sendEmail({
      to: dados.email,
      subject: "Protocolo de Solicitação de Bolsa — SindEducação-ES · " + dados.protocolo,
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
          "<div style='background:#002f6c;padding:24px;border-radius:12px 12px 0 0;text-align:center;'>" +
            "<h1 style='color:#C9A84C;margin:0;font-size:22px;'>SindEducação-ES</h1>" +
            "<p style='color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px;'>Solicitação de Bolsa de Estudo</p>" +
          "</div>" +
          "<div style='background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;'>" +
            "<p>Olá <strong>" + escHtmlVoucher_(dados.nome) + "</strong>,</p>" +
            "<p>Sua solicitação foi registrada com sucesso.</p>" +
            "<div style='background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:20px 0;text-align:center;'>" +
              "<p style='font-size:11px;color:#64748b;margin-bottom:4px;'>Número do Protocolo</p>" +
              "<p style='font-size:22px;font-weight:700;color:#166534;letter-spacing:.04em;'>" + escHtmlVoucher_(dados.protocolo) + "</p>" +
            "</div>" +
            "<table style='width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;'>" +
              "<tr><td style='color:#64748b;padding:6px 0;width:40%;'>Beneficiário:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.nomeBeneficiario) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Modalidade:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.modalidade) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Curso:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.curso) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Escola:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.escola) + "</td></tr>" +
              (dados.percentual ? "<tr><td style='color:#64748b;padding:6px 0;'>Desconto previsto:</td><td style='font-weight:700;color:#059669;'>" + dados.percentual + "%</td></tr>" : "") +
            "</table>" +
            aviso +
            "<p style='font-size:13px;color:#64748b;'>Prazo de análise: até <strong>15 dias úteis</strong>.</p>" +
          "</div>" +
          "<div style='background:#f8fafc;padding:14px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;'>" +
            "<p style='font-size:11px;color:#94a3b8;'>SindEducação-ES · " + escHtmlVoucher_(SITE_SIND_V) + "</p>" +
          "</div>" +
        "</div>"
    });

  } catch(e) {
    Logger.log("E-mail de confirmação não enviado: " + e.message);
  }
}

function enviarEmailInternoNovaSolicitacaoVoucher_(dados) {
  try {
    const emailSecretaria = "secretaria@sindeducacao.com";

    MailApp.sendEmail({
      to: emailSecretaria,
      cc: "financeiro@sindeducacao.com",
      subject: "📋 Nova solicitação de bolsa — " + dados.protocolo,
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:620px;'>" +
          "<div style='background:#002f6c;padding:20px;border-radius:10px 10px 0 0;'>" +
            "<h2 style='color:#C9A84C;margin:0;font-size:18px;'>Nova solicitação de bolsa</h2>" +
          "</div>" +
          "<div style='background:#fff;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;'>" +
            "<table style='width:100%;font-size:13px;border-collapse:collapse;'>" +
              "<tr><td style='color:#64748b;padding:5px 0;width:38%;'>Protocolo:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.protocolo) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Solicitante:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.nome) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>CPF:</td><td>" + escHtmlVoucher_(formatarCpfVoucher_(dados.cpf)) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Escola:</td><td>" + escHtmlVoucher_(dados.escola) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Modalidade:</td><td>" + escHtmlVoucher_(dados.modalidade) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Curso:</td><td>" + escHtmlVoucher_(dados.curso) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Período:</td><td>" + escHtmlVoucher_(dados.periodoReferencia) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Status:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.statusSolicitacao) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Situação sindical:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.situacaoSindicalFinal) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Funcionário novo:</td><td>" + escHtmlVoucher_(dados.funcionarioNovo) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Escola não cadastrada:</td><td>" + escHtmlVoucher_(dados.escolaNaoCadastrada) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Desconto calculado:</td><td style='font-weight:700;color:#059669;'>" + (dados.percentual || "—") + "%</td></tr>" +
            "</table>" +
          "</div>" +
        "</div>"
    });

  } catch(e) {
    Logger.log("E-mail interno nova solicitação não enviado: " + e.message);
  }
}