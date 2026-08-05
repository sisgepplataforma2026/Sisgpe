// =============================================================================
// ARQUIVO: VoucherAdm.gs
// Ações administrativas do módulo Voucher/Bolsa
// =============================================================================

function atualizarStatusSolicitacao_(item, novoStatus, obs, extras) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const headers = item.headers;
  const usuario = obterUsuarioAtualVoucher_();

  function idx(n) {
    return headers.indexOf(n);
  }

  if (idx("STATUS_SOLICITACAO") > -1) {
    sh.getRange(item.linha, idx("STATUS_SOLICITACAO") + 1).setValue(novoStatus);
  }

  if (idx("OBSERVACOES") > -1) {
    sh.getRange(item.linha, idx("OBSERVACOES") + 1).setValue(obs || "");
  }

  if (idx("USUARIO_VALIDACAO") > -1) {
    sh.getRange(item.linha, idx("USUARIO_VALIDACAO") + 1).setValue(usuario);
  }

  if (idx("DATA_VALIDACAO") > -1) {
    sh.getRange(item.linha, idx("DATA_VALIDACAO") + 1).setValue(new Date());
  }

  Object.keys(extras || {}).forEach(function(campo) {
    if (idx(campo) > -1) {
      sh.getRange(item.linha, idx(campo) + 1).setValue(extras[campo]);
    }
  });
}

function atualizarStatusProtocolo_(protocolo, status, responsavel, observacao) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Protocolos");

  if (!sh || sh.getLastRow() < 2) return;

  const headers = obterHeaders_(sh);

  function idx(n) {
    return headers.indexOf(n);
  }

  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idx("NUMERO_PROTOCOLO")] || "") === String(protocolo || "")) {
      if (idx("STATUS_PROTOCOLO") > -1) {
        sh.getRange(i + 2, idx("STATUS_PROTOCOLO") + 1).setValue(status);
      }

      if (idx("RESPONSAVEL") > -1) {
        sh.getRange(i + 2, idx("RESPONSAVEL") + 1).setValue(responsavel || obterUsuarioAtualVoucher_());
      }

      if (idx("OBSERVACOES") > -1) {
        sh.getRange(i + 2, idx("OBSERVACOES") + 1).setValue(observacao || "");
      }

      break;
    }
  }
}

function solicitarComplementacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const usuario = obterUsuarioAtualVoucher_();
    const observacao = obs || "Complementação solicitada pela análise administrativa.";

    atualizarStatusSolicitacao_(item, "ANALISE", observacao);
    atualizarStatusProtocolo_(protocolo, "ANALISE", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "COMPLEMENTACAO_SOLICITADA",
      usuario,
      observacao,
      protocolo
    );

    enviarEmailComplementacaoVoucher_(item.registro, protocolo, observacao);

    return { ok: true, mensagem: "Complementação solicitada com sucesso." };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao solicitar complementação: " + e.message };
  }
}

function confirmarAssociacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const usuario = obterUsuarioAtualVoucher_();
    const cpf = normalizarCPF_(item.registro.CPF_SOLICITANTE);

    const observacao = obs || "Associação confirmada pela análise administrativa.";

    atualizarSituacaoSindicalCadastro_(cpf, "ASSOCIADO");

    atualizarStatusSolicitacao_(item, "PENDENTE", observacao, {
      SITUACAO_SINDICAL: "ASSOCIADO",
      STATUS_VALIDACAO_SINDICAL: "VALIDADO"
    });

    atualizarStatusProtocolo_(protocolo, "PENDENTE", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      cpf,
      "ASSOCIACAO_CONFIRMADA",
      usuario,
      observacao,
      protocolo
    );

    return {
      ok: true,
      mensagem: "Associação confirmada. Solicitação liberada para análise/aprovação."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao confirmar associação: " + e.message };
  }
}

function marcarNaoAssociadoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const usuario = obterUsuarioAtualVoucher_();
    const cpf = normalizarCPF_(item.registro.CPF_SOLICITANTE);

    const observacao = obs ||
      "Cadastro marcado como não associado. Orientar atendimento presencial na sede do SindEducação-ES em até 15 dias úteis.";

    atualizarSituacaoSindicalCadastro_(cpf, "NAO_ASSOCIADO");

    atualizarStatusSolicitacao_(item, "AGUARDANDO_ATENDIMENTO_PRESENCIAL", observacao, {
      SITUACAO_SINDICAL: "NAO_ASSOCIADO",
      STATUS_VALIDACAO_SINDICAL: "NAO_ASSOCIADO"
    });

    atualizarStatusProtocolo_(protocolo, "AGUARDANDO_ATENDIMENTO_PRESENCIAL", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      cpf,
      "NAO_ASSOCIADO_CONFIRMADO",
      usuario,
      observacao,
      protocolo
    );

    enviarEmailNaoAssociadoVoucher_(item.registro, protocolo);

    return {
      ok: true,
      mensagem: "Solicitação marcada como atendimento presencial para não associado."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao marcar não associado: " + e.message };
  }
}

function aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const situacaoSindical = String(item.registro.SITUACAO_SINDICAL || "").toUpperCase();
    const statusValidacao = String(item.registro.STATUS_VALIDACAO_SINDICAL || "").toUpperCase();

    if (situacaoSindical !== "ASSOCIADO" || statusValidacao !== "VALIDADO") {
      return {
        ok: false,
        mensagem: "A solicitação só pode ser aprovada após confirmação de associação."
      };
    }

    const usuario = obterUsuarioAtualVoucher_();
    const observacao = obs || "Solicitação aprovada pela análise administrativa.";

    atualizarStatusSolicitacao_(item, "APROVADO", observacao);
    atualizarStatusProtocolo_(protocolo, "APROVADO", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "SOLICITACAO_APROVADA",
      usuario,
      observacao,
      protocolo
    );

    enviarEmailAprovacaoVoucher_(item.registro, protocolo);

    return {
      ok: true,
      mensagem: "Solicitação aprovada com sucesso."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao aprovar: " + e.message };
  }
}

function indeferirSolicitacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    if (!obs || !String(obs).trim()) {
      return { ok: false, mensagem: "Informe a justificativa do indeferimento." };
    }

    const usuario = obterUsuarioAtualVoucher_();

    atualizarStatusSolicitacao_(item, "INDEFERIDO", obs);
    atualizarStatusProtocolo_(protocolo, "INDEFERIDO", usuario, obs);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "SOLICITACAO_INDEFERIDA",
      usuario,
      obs,
      protocolo
    );

    enviarEmailIndeferimentoVoucher_(item.registro, protocolo, obs);

    return {
      ok: true,
      mensagem: "Solicitação indeferida com sucesso."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao indeferir: " + e.message };
  }
}

/* ================= E-MAILS ADMIN ================= */

function enviarEmailComplementacaoVoucher_(reg, protocolo, obs) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    MailApp.sendEmail({
      to: email,
      subject: "Complementação de documentos — " + protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
        "<h2 style='color:#002f6c;'>Solicitação de complementação</h2>" +
        "<p>Olá <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Precisamos de complementação para dar continuidade à sua solicitação de bolsa.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Orientação:</strong> " + escHtmlVoucher_(obs) + "</p>" +
        "<p>Atenciosamente,<br>SindEducação-ES</p>" +
        "</div>"
    });

  } catch (e) {
    Logger.log("enviarEmailComplementacaoVoucher_ erro: " + e.message);
  }
}

function enviarEmailNaoAssociadoVoucher_(reg, protocolo) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    MailApp.sendEmail({
      to: email,
      subject: "Atendimento presencial necessário — " + protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
        "<h2 style='color:#92400e;'>Atendimento presencial necessário</h2>" +
        "<p>Olá <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Seu cadastro foi identificado como <strong>não associado</strong>.</p>" +
        "<p>Para continuidade da solicitação, compareça à sede do SindEducação-ES em até <strong>15 dias úteis</strong>, levando este protocolo e a documentação necessária.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Endereço:</strong> " + escHtmlVoucher_(ENDERECO_SIND_V) + "</p>" +
        "<p><strong>Telefone:</strong> " + escHtmlVoucher_(TELEFONE_SIND_V) + "</p>" +
        "<p>Atenciosamente,<br>SindEducação-ES</p>" +
        "</div>"
    });

  } catch (e) {
    Logger.log("enviarEmailNaoAssociadoVoucher_ erro: " + e.message);
  }
}

function enviarEmailAprovacaoVoucher_(reg, protocolo) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    const percentual = valorSeguroVoucher_(reg.PERCENTUAL_APLICADO);

    MailApp.sendEmail({
      to: email,
      subject: "Bolsa aprovada — " + protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
        "<h2 style='color:#166534;'>Bolsa aprovada</h2>" +
        "<p>Olá <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Sua solicitação de bolsa foi aprovada.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Curso:</strong> " + escHtmlVoucher_(reg.CURSO) + "</p>" +
        "<p><strong>Desconto:</strong> " + escHtmlVoucher_(percentual || "—") + "%</p>" +
        "<p>O voucher será emitido e encaminhado após a geração do documento oficial.</p>" +
        "<p>Atenciosamente,<br>SindEducação-ES</p>" +
        "</div>"
    });

  } catch (e) {
    Logger.log("enviarEmailAprovacaoVoucher_ erro: " + e.message);
  }
}

function enviarEmailIndeferimentoVoucher_(reg, protocolo, obs) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    MailApp.sendEmail({
      to: email,
      subject: "Solicitação indeferida — " + protocolo + " · SindEducação-ES",
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
        "<h2 style='color:#991b1b;'>Solicitação indeferida</h2>" +
        "<p>Olá <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Sua solicitação foi indeferida após análise administrativa.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Justificativa:</strong> " + escHtmlVoucher_(obs) + "</p>" +
        "<p>Atenciosamente,<br>SindEducação-ES</p>" +
        "</div>"
    });

  } catch (e) {
    Logger.log("enviarEmailIndeferimentoVoucher_ erro: " + e.message);
  }
}

/* ================= ALIASES COMPATIBILIDADE ================= */

function solicitarComplementacaoCertBolsa(protocolo, obs, tokenSessao) {
  return solicitarComplementacaoVoucher(protocolo, obs, tokenSessao);
}

function aprovarSolicitacaoCertBolsa(protocolo, obs, tokenSessao) {
  return aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao);
}

function aprovarSolicitacaoCertBolsaComEmail(protocolo, obs, tokenSessao) {
  return aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao);
}

function indeferirSolicitacaoCertBolsa(protocolo, obs, tokenSessao) {
  return indeferirSolicitacaoVoucher(protocolo, obs, tokenSessao);
}