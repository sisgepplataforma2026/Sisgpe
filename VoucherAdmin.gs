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

    /* A TRAVA EXIGIA UM ESTADO QUE NENHUMA TELA PRODUZIA.
     *
     * A versão anterior recusava quando STATUS_VALIDACAO_SINDICAL não fosse
     * "VALIDADO". Só que solicitação criada "em análise" nasce PENDENTE, e o
     * único lugar do sistema que grava VALIDADO é confirmarAssociacao... —
     * que não tem botão em tela nenhuma. Resultado: o botão Aprovar recusava
     * SEMPRE, para toda solicitação em análise. Porta trancada com a chave
     * do lado de dentro.
     *
     * O que a regra realmente exige — dita pelo usuário em 12/08/2026 — é
     * que a pessoa SEJA ASSOCIADA. Isso continua sendo verificado, e com
     * mensagem que diz a situação encontrada em vez de uma frase genérica.
     *
     * E APROVAR É VALIDAR: quem aprova está declarando que conferiu. O campo
     * passa a VALIDADO aqui, com quem e quando, em vez de exigir um passo
     * anterior que não existe. */
    if (situacaoSindical && situacaoSindical !== "ASSOCIADO") {
      return {
        ok: false,
        mensagem: "Só associado tem direito ao benefício. Situação registrada: " +
                  situacaoSindical + "."
      };
    }

    const usuario = obterUsuarioAtualVoucher_();
    const observacao = obs || "Solicitação aprovada pela análise administrativa.";

    atualizarStatusSolicitacao_(item, "APROVADO", observacao, {
      SITUACAO_SINDICAL: situacaoSindical || "ASSOCIADO",
      STATUS_VALIDACAO_SINDICAL: "VALIDADO",
      USUARIO_VALIDACAO: usuario,
      DATA_VALIDACAO: new Date()
    });
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
/**
 * CORRIGIR O PERÍODO QUE FALTOU numa solicitação já gravada.
 *
 * Aprovado pelo usuário em 13/08/2026. Duas linhas da base foram criadas
 * antes de o período virar obrigatório: elas não emitem — a trava recusa,
 * porque o período sai impresso no certificado e é ele que impede o mesmo
 * voucher sair duas vezes — e não havia como consertá-las pelo sistema. O
 * lápis da lista é "Ver / Ações": aprova e emite, não edita campo.
 *
 * ESTA PORTA SÓ PREENCHE O QUE ESTÁ VAZIO. Trocar um período existente move
 * a bolsa de janela e é outra decisão, com outras consequências — não entra
 * por aqui, e a recusa diz isso em vez de fingir que não entendeu.
 *
 * E ELA NÃO PODE VIRAR ATALHO PARA A DUPLICATA. Se a pessoa já tem bolsa
 * naquela janela, preencher aqui criaria justamente o que a regra proíbe —
 * então a mesma checagem da criação roda antes de gravar, e a mensagem diz
 * qual protocolo já ocupa o lugar.
 *
 * Permissão: a mesma de quem aprova e emite — decisão do usuário no mesmo
 * dia. Exigir administrador para uma correção trivial travaria a secretaria
 * no meio do atendimento. O rastro fica nas observações.
 */
function voucherCorrigirPeriodo(protocolo, periodo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, mensagem: "Outra gravação está em andamento. Tente de novo em instantes." };
  }

  try {
    protocolo = String(protocolo || "").trim();
    if (!protocolo) return { ok: false, mensagem: "Informe o protocolo." };

    var novo = (typeof voucherPeriodoTexto_ === "function")
      ? voucherPeriodoTexto_(periodo)
      : String(periodo || "").trim();
    if (!novo) return { ok: false, mensagem: "Informe o período de referência." };

    var item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    var reg = item.registro || {};
    var atual = (typeof voucherPeriodoTexto_ === "function")
      ? voucherPeriodoTexto_(reg.PERIODO_REFERENCIA)
      : String(reg.PERIODO_REFERENCIA || "").trim();

    if (atual) {
      return {
        ok: false,
        jaTem: true,
        mensagem: "Esta solicitação já tem período (" + atual + "). Esta correção só " +
                  "preenche o que está em branco — trocar um período existente move a " +
                  "bolsa de janela e não se faz por aqui."
      };
    }

    /* A MESMA CHECAGEM DA CRIAÇÃO, antes de gravar. Sem ela, a correção
     * viraria porta lateral: bastava criar sem período e preencher depois
     * para furar a trava de "um por pessoa por janela". */
    if (typeof voucherPeriodoHistorico_ === "function") {
      var hist = voucherPeriodoHistorico_({
        cpf: reg.CPF_SOLICITANTE,
        nome: reg.NOME_SOLICITANTE,
        beneficiario: reg.NOME_BENEFICIARIO,
        modalidade: reg.MODALIDADE,
        curso: reg.CURSO,
        regime: reg.REGIME,
        periodo: novo,
        /* A própria linha não bloqueia a si mesma.
         *
         * INALCANÇÁVEL HOJE, e é bom saber por quê: esta ação só roda em
         * linha SEM período, e linha sem período não ocupa janela nenhuma —
         * então ela nunca conflitaria consigo mesma de qualquer forma. Uma
         * mutação que apaga este argumento sobrevive, e não é falha de
         * teste: é código sem efeito no caminho atual.
         *
         * Fica porque é a forma CORRETA de chamar voucherPeriodoHistorico_,
         * e porque passa a valer no minuto em que alguém relaxar a regra de
         * "só preenche o que está vazio". */
        protocoloAtual: protocolo
      });
      if (hist.bloqueado) {
        return {
          ok: false,
          duplicado: true,
          mensagem: voucherPeriodoMensagemBloqueio_(hist.bloqueio, {
            regime: reg.REGIME, periodo: novo
          })
        };
      }
    }

    /* Com o apóstrofo protetor: gravar "2026/2" cru faz o Sheets converter em
     * 1º de fevereiro, que é o defeito que originou tudo isto. */
    var paraGravar = (typeof voucherPeriodoParaGravar_ === "function")
      ? voucherPeriodoParaGravar_(novo)
      : novo;

    var quem = (typeof obterUsuarioAtualVoucher_ === "function")
      ? obterUsuarioAtualVoucher_()
      : ((sessao && (sessao.email || sessao.usuario)) || "");

    var carimbo = "Período preenchido (" + novo + ") por " + quem + " em " +
      Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm") + ".";

    /* O RASTRO VAI PARA A AUDITORIA, NÃO PARA AS OBSERVAÇÕES — e isto foi
     * achado por teste em 13/08/2026.
     *
     * `atualizarStatusSolicitacao_` SOBRESCREVE a coluna OBSERVACOES. O
     * carimbo escrito lá durava até a próxima ação: a emissão logo em
     * seguida trocava o texto por "Voucher emitido." e o registro de quem
     * corrigiu sumia. Prometer rastro que some é pior do que não prometer —
     * quem for conferir depois acha a linha limpa e conclui que ninguém
     * mexeu.
     *
     * A aba Voucher_Auditoria é append-only: cada ação vira uma linha, e
     * nenhuma apaga a anterior. É o lugar de quem-fez-o-quê. */
    if (typeof registrarAuditoriaVoucher_ === "function") {
      registrarAuditoriaVoucher_({
        protocolo: protocolo,
        tipoAcesso: "CORRECAO_PERIODO",
        resultado: "PERIODO_PREENCHIDO",
        usuario: quem,
        observacao: carimbo
      });
    }

    /* Nas observações o carimbo entra ACRESCENTADO ao que já havia, não no
     * lugar. Ele é volátil — a próxima ação apaga —, mas enquanto está lá
     * aparece na tela, que é onde quem atende olha primeiro. */
    var obsAnterior = String(reg.OBSERVACOES || "").trim();
    atualizarStatusSolicitacao_(item, String(reg.STATUS_SOLICITACAO || "PENDENTE"),
      obsAnterior ? (carimbo + " | " + obsAnterior) : carimbo, {
      PERIODO_REFERENCIA: paraGravar
    });

    return {
      ok: true,
      periodo: novo,
      protocolo: protocolo,
      mensagem: "Período " + novo + " gravado. A solicitação já pode ser emitida."
    };
  } catch (e) {
    Logger.log("voucherCorrigirPeriodo: " + e.message + "\n" + (e.stack || ""));
    return { ok: false, mensagem: "Erro ao gravar o período: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
