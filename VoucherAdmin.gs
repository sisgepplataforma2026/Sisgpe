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

/**
 * PEDIR DOCUMENTO SEM DIZER QUAL NÃO É PEDIDO, É ADIVINHAÇÃO — 17/09/2026.
 *
 * O usuário perguntou se o associado recebia e-mail ao ter a complementação
 * solicitada. Recebia — e foi ao conferir POR EXECUÇÃO que o defeito
 * apareceu: sem ninguém digitar nada, saía um e-mail dizendo
 *
 *   "Precisamos de complementação para dar continuidade à sua solicitação.
 *    Complementação solicitada pela análise administrativa."
 *
 * ...que não nomeia UM documento. Quem recebe não sabe o que mandar, e liga
 * para o sindicato para perguntar — o oposto do que o e-mail existia para
 * fazer. O texto padrão preenchia a lacuna e, ao preenchê-la, escondia que
 * ela existia.
 *
 * Agora a orientação é OBRIGATÓRIA, como já era a justificativa do
 * indeferimento. A trava fica aqui, no backend, e não só na tela: tela é
 * conveniência, servidor é regra.
 */
function solicitarComplementacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const observacao = String(obs || "").trim();
    if (!observacao) {
      return {
        ok: false,
        mensagem: "Escreva o que está faltando — esse texto vai no e-mail para o associado."
      };
    }

    const usuario = obterUsuarioAtualVoucher_();

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

/**
 * `percentual` é OPCIONAL e entrou em 16/09/2026.
 *
 * "Aqui eu tenho que ter uma opção de alterar o desconto caso esteja errado"
 * — o usuário, olhando o modal de análise, onde o percentual calculado pela
 * convenção aparecia como número fixo.
 *
 * O cálculo automático continua sendo o padrão: quem aprova sem mexer no
 * campo aprova com o que a convenção mandou. Mas o cálculo depende de dados
 * que a própria pessoa digitou no portal (modalidade, área do curso, ordem do
 * filho), e um desses errado produz percentual errado — que hoje só seria
 * descoberto depois do voucher emitido, com a escola já informada.
 *
 * Ajustar aqui NÃO É silencioso: quem muda deixa rastro no histórico, com o
 * valor de antes e o de depois, e a observação registra a mudança.
 * Sugerir com origem à vista, nunca impor em silêncio — REGRA Nº 0.6.
 */
function aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao, percentual) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    /* O AJUSTE DO PERCENTUAL, CONFERIDO ANTES DE QUALQUER ESCRITA.
     *
     * Percentual fora de 1–100 não é ajuste, é dedo errado — e gravar 700%
     * num voucher seria descoberto pela escola, não por nós. Zero também não
     * passa: bolsa de 0% é indeferimento, e indeferir tem botão próprio, com
     * justificativa e e-mail ao associado. */
    var pctAntes = String(valorSeguroVoucher_(item.registro.PERCENTUAL_APLICADO) || "").replace("%", "").trim();
    var pctNovo  = String(percentual === undefined || percentual === null ? "" : percentual).replace("%", "").trim();
    var mudouPct = false;

    if (pctNovo !== "") {
      var n = Number(pctNovo);
      if (isNaN(n) || n <= 0 || n > 100) {
        return { ok: false, mensagem: "O desconto precisa ser um número entre 1 e 100." };
      }
      pctNovo = String(Math.round(n));
      mudouPct = (pctNovo !== pctAntes);
    }

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
     * E APROVAR É VALIDAR: quem aprova está declarando que conferiu. O campo
     * passa a VALIDADO aqui, com quem e quando, em vez de exigir um passo
     * anterior que não existe.
     *
     * AQUI TAMBÉM HAVIA UMA RECUSA POR NÃO SER ASSOCIADO, e ela saiu em
     * 14/08/2026. Todo mundo tem o mesmo benefício; o que muda é o canal
     * (ver o cabeçalho de calcularRegraVoucher_ em Voucher.gs). Com a recusa
     * aqui, o não associado que o próprio sistema mandava à sede chegava com
     * o papel e não conseguia ser atendido — o presencial existia no nome do
     * status e em lugar nenhum mais.
     *
     * O que fica no lugar não é uma trava, é um REGISTRO: a aprovação anota
     * que aquele atendimento é presencial, para quem emitir depois saber que
     * o voucher não vai por e-mail.
     *
     * E O CANAL É DERIVADO, NÃO GRAVADO EM COLUNA PRÓPRIA. Duas razões. A
     * primeira é que coluna nova exige migração na aba de produção — que eu
     * não tenho como rodar, e que a REGRA Nº 1 manda tratar com cuidado. A
     * segunda é melhor: duas colunas dizendo a mesma coisa é uma chance de
     * elas se contradizerem, e um dia uma linha teria SITUACAO_SINDICAL
     * "NAO_ASSOCIADO" com canal "REMOTO" e ninguém saberia qual acreditar.
     * A situação sindical é a fonte; o canal se lê dela.
     *
     * O rastro durável vai para o HISTÓRICO, que é append-only — não para
     * OBSERVACOES, que `atualizarStatusSolicitacao_` sobrescreve na ação
     * seguinte (defeito achado em 13/08 na correção de período). */
    const presencial = voucherEhNaoAssociado_(situacaoSindical);

    const usuario = obterUsuarioAtualVoucher_();
    const observacao = obs || (presencial
      ? "Solicitação aprovada pela análise administrativa. Atendimento " +
        "presencial: solicitação em papel, retirada na sede, sem envio por e-mail."
      : "Solicitação aprovada pela análise administrativa.");

    const extras = {
      SITUACAO_SINDICAL: situacaoSindical || "ASSOCIADO",
      STATUS_VALIDACAO_SINDICAL: "VALIDADO",
      USUARIO_VALIDACAO: usuario,
      DATA_VALIDACAO: new Date()
    };
    if (mudouPct) extras.PERCENTUAL_APLICADO = pctNovo;

    atualizarStatusSolicitacao_(item, "APROVADO", observacao, extras);
    atualizarStatusProtocolo_(protocolo, "APROVADO", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "SOLICITACAO_APROVADA",
      usuario,
      observacao,
      protocolo
    );

    /* O RASTRO DA MUDANÇA VAI PARA O HISTÓRICO, que é append-only — e não
     * para OBSERVACOES, que a ação seguinte sobrescreve. Com o valor de
     * antes: saber que mudou sem saber de quanto não serve para conferir. */
    if (mudouPct) {
      registrarHistoricoVoucher_(
        item.registro.ID_SOLICITACAO,
        item.registro.CPF_SOLICITANTE,
        "PERCENTUAL_AJUSTADO",
        usuario,
        "Desconto alterado de " + (pctAntes || "vazio") + "% para " + pctNovo +
          "% na aprovação, pela análise administrativa.",
        protocolo
      );
      /* O e-mail de aprovação lê o percentual do registro em memória, que
       * ainda traz o valor antigo — sem isto o associado receberia a
       * aprovação anunciando o desconto que NÃO foi concedido. */
      item.registro.PERCENTUAL_APLICADO = pctNovo;
    }

    enviarEmailAprovacaoVoucher_(item.registro, protocolo);

    return {
      ok: true,
      percentual: mudouPct ? pctNovo : pctAntes,
      mensagem: mudouPct
        ? "Solicitação aprovada com o desconto ajustado para " + pctNovo + "%."
        : "Solicitação aprovada com sucesso."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao aprovar: " + e.message };
  }
}

/**
 * CONFIRMA QUE A PESSOA É ASSOCIADA, e tira a solicitação do limbo.
 *
 * POR QUE PRECISOU EXISTIR — 16/09/2026.
 *
 * `AGUARDANDO_VALIDACAO_CADASTRAL` é o estado de quem pediu pelo portal e
 * cujo CPF NÃO FOI ENCONTRADO na base de Associados. Não é recusa: pode ser
 * associado novo ainda não lançado, e barrá-lo seria negar direito por atraso
 * de cadastro. O sistema pede conferência humana.
 *
 * SÓ QUE A CONFERÊNCIA NÃO TINHA ONDE ACONTECER. Nenhum card de contagem
 * cobria esse status, o filtro de status não o oferecia, e não havia ação que
 * o resolvesse — só Aprovar, Indeferir e Complementação. Uma solicitação real
 * (Marcelha, pela Fucape) ficou parada, invisível em todos os indicadores,
 * esperando um passo que o sistema exigia e não oferecia.
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ: aprovar. Confirmar o cadastro é dizer "esta
 * pessoa é associada"; aprovar é dizer "esta bolsa está deferida". São duas
 * decisões, e juntá-las faria a conferência cadastral conceder benefício sem
 * ninguém olhar a regra. A solicitação vai para PENDENTE — a fila de análise
 * normal, de onde ela deveria ter saído se o CPF estivesse na base.
 *
 * O RASTRO VAI PARA O HISTÓRICO, que é append-only, e não para OBSERVACOES,
 * que a ação seguinte sobrescreve.
 */
function confirmarCadastroSolicitacaoVoucher(protocolo, obs, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    const item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    const statusAtual = String(item.registro.STATUS_SOLICITACAO || "").toUpperCase();
    if (statusAtual !== "AGUARDANDO_VALIDACAO_CADASTRAL") {
      /* Recusa explicando, em vez de aceitar em silêncio: confirmar cadastro
         de uma solicitação já aprovada ou indeferida a jogaria de volta para
         PENDENTE, desfazendo uma decisão sem que ninguém percebesse. */
      return {
        ok: false,
        mensagem: "Esta solicitação não está aguardando validação cadastral (está " +
                  (statusAtual || "sem status") + "). Nada foi alterado."
      };
    }

    const usuario = obterUsuarioAtualVoucher_();
    const observacao = obs ||
      "Cadastro conferido pela Secretaria: filiação confirmada fora da base no momento da solicitação.";

    atualizarStatusSolicitacao_(item, "PENDENTE", observacao, {
      SITUACAO_SINDICAL: "ASSOCIADO",
      STATUS_VALIDACAO_SINDICAL: "VALIDADO",
      USUARIO_VALIDACAO: usuario,
      DATA_VALIDACAO: new Date()
    });
    atualizarStatusProtocolo_(protocolo, "PENDENTE", usuario, observacao);

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "CADASTRO_CONFIRMADO",
      usuario,
      observacao,
      protocolo
    );

    return {
      ok: true,
      mensagem: "Cadastro confirmado. A solicitação foi para a fila de análise."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao confirmar cadastro: " + e.message };
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

    voucherEnviarMsg_({
      to: email,
      subject: "Complementação de documentos — " + protocolo + " · SindEducação-ES",
      htmlBody:
        voucherEmailHtml_("Solicitação de complementação",
        "<p>Olá, <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Para dar continuidade à sua solicitação de bolsa, precisamos do seguinte:</p>" +
        /* O QUE FALTA VEM ANTES DO PROTOCOLO e em destaque. Na versão
         * anterior o pedido aparecia depois do número, num bloco cinza sem
         * título — e quem lê no celular via primeiro um código e depois uma
         * frase administrativa. O documento pedido é a única informação que
         * essa mensagem precisa entregar. */
        "<div style='margin:14px 0;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;" +
        "border-left:4px solid #d97706;border-radius:8px;font-size:14.5px;color:#92400e;'>" +
        escHtmlVoucher_(obs) + "</div>" +
        "<p style='font-size:13px;color:#475569;'>Basta responder a este e-mail com o documento anexado, " +
        "ou falar com a Secretaria se tiver dúvida sobre o que enviar.</p>" +
        "<p style='font-size:12.5px;color:#64748b;'>Protocolo: <strong>" + escHtmlVoucher_(protocolo) + "</strong></p>" +
        "<p>Atenciosamente,<br><strong>Secretaria — SindEducação-ES</strong></p>")
    });

  } catch (e) {
    Logger.log("enviarEmailComplementacaoVoucher_ erro: " + e.message);
  }
}

function enviarEmailNaoAssociadoVoucher_(reg, protocolo) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    voucherEnviarMsg_({
      to: email,
      subject: "Atendimento presencial necessário — " + protocolo + " · SindEducação-ES",
      htmlBody:
        voucherEmailHtml_("Atendimento presencial necessário",
        "<p>Olá, <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Seu cadastro foi identificado como <strong>não associado</strong>.</p>" +
        "<p>Para continuidade da solicitação, compareça à sede do SindEducação-ES em até <strong>15 dias úteis</strong>, levando este protocolo e a documentação necessária.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Endereço:</strong> " + escHtmlVoucher_(ENDERECO_SIND_V) + "</p>" +
        "<p><strong>Telefone:</strong> " + escHtmlVoucher_(TELEFONE_SIND_V) + "</p>" +
        "<p>Atenciosamente,<br><strong>Secretaria — SindEducação-ES</strong></p>")
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

    /* ESTE E-MAIL PROMETIA ALGO QUE NÃO IA ACONTECER.
     *
     * A frase de fecho era "o voucher será emitido e ENCAMINHADO após a
     * geração do documento oficial" — verdade para o associado, mentira
     * para quem retira presencialmente. A pessoa ficaria esperando um
     * e-mail que, por decisão de 14/08/2026, nunca sai.
     *
     * Achado por um teste que media a caixa de saída, não a intenção do
     * código: eu tinha bloqueado o envio DO VOUCHER na emissão e concluído
     * que nenhum e-mail chegava ao não associado. Chegava — este, de outro
     * arquivo, disparado na aprovação, que eu nem sabia que existia.
     *
     * O aviso de aprovação em si CONTINUA saindo, e deve mesmo: ser
     * aprovado é notícia boa e a pessoa tem direito de saber. O que muda é
     * a última frase, que passa a dizer a verdade do canal dela. */
    const presencial = voucherEhNaoAssociado_(reg.SITUACAO_SINDICAL);

    voucherEnviarMsg_({
      to: email,
      subject: "Bolsa aprovada — " + protocolo + " · SindEducação-ES",
      htmlBody:
        voucherEmailHtml_("Bolsa aprovada",
        "<p>Olá, <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
        "<p>Sua solicitação de bolsa foi aprovada.</p>" +
        "<p><strong>Protocolo:</strong> " + escHtmlVoucher_(protocolo) + "</p>" +
        "<p><strong>Curso:</strong> " + escHtmlVoucher_(reg.CURSO) + "</p>" +
        "<p><strong>Desconto:</strong> " + escHtmlVoucher_(percentual || "—") + "%</p>" +
        (presencial
          ? "<p><strong>A retirada é presencial.</strong> Compareça à sede do " +
            "SindEducação-ES com um documento com foto e este número de " +
            "protocolo para retirar o seu voucher. Ele não será enviado por " +
            "e-mail.</p>"
          : "<p>O voucher será emitido e encaminhado após a geração do " +
            "documento oficial.</p>") +
        "<p>Atenciosamente,<br><strong>Secretaria — SindEducação-ES</strong></p>")
    });

  } catch (e) {
    Logger.log("enviarEmailAprovacaoVoucher_ erro: " + e.message);
  }
}

/**
 * A CASCA DE E-MAIL DO MÓDULO, no padrão do SISGEP — 16/09/2026.
 *
 * O indeferimento saía em Arial cru, sem o bloco navy com que TODO documento
 * do sistema abre — o ofício, a declaração, o certificado. "Não pode cada
 * módulo ter um padrão diferente", e e-mail também é documento.
 *
 * @param {string} titulo    o que aparece na faixa
 * @param {string} corpoHtml o conteúdo, já escapado por quem chama
 */
function voucherEmailHtml_(titulo, corpoHtml) {
  return "" +
    "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:640px;color:#0f172a;'>" +
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 55%,#003b82 100%);padding:22px 26px;border-radius:8px 8px 0 0;'>" +
    "<div style='border-left:4px solid #C9A84C;padding-left:14px;'>" +
    "<div style='font-size:19px;font-weight:900;color:#fff;'>SINDEDUCAÇÃO-ES</div>" +
    "<div style='font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;'>Sindicato dos Educadores Técnico-Administrativos<br>em Estabelecimentos de Ensino Particular no Estado do Espírito Santo</div>" +
    "</div>" +
    "<div style='height:1px;background:rgba(201,168,76,.25);margin:14px 0 12px;'></div>" +
    "<div style='font-size:15px;font-weight:800;color:#C9A84C;'>" + escHtmlVoucher_(titulo) + "</div>" +
    "</div>" +
    "<div style='background:#fff;padding:26px;border:1px solid #e2e8f0;border-top:none;line-height:1.7;font-size:14px;'>" +
    corpoHtml +
    "</div>" +
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 60%,#002f6c 100%);border-radius:0 0 8px 8px;padding:20px 26px;text-align:center;'>" +
    "<div style='height:3px;background:linear-gradient(90deg,#C9A84C,#f0c843,#C9A84C);margin-bottom:14px;'></div>" +
    "<div style='font-size:12px;color:rgba(255,255,255,.75);line-height:1.7;'>" +
    "Av. Nossa Senhora dos Navegantes, 755 - Salas 707/708<br>" +
    "Enseada do Suá - Vitória/ES<br>" +
    "(27) 3222-2706 &bull; secretaria@sindeducacao.com" +
    "</div></div></div>";
}

/**
 * Envia pelo caminho que RESPEITA O REMETENTE.
 *
 * O `MailApp.sendEmail` IGNORA a opção `from`, em silêncio — foi o defeito que
 * fez a Declaração de Diretor sair da conta executora mesmo com o alias da
 * Secretaria configurado (ver enviarComoRascunhoSISGEP_ em EmailOficios.gs).
 * Todo e-mail deste módulo usava MailApp, então todos saíam da conta errada.
 * Aqui passam pela mesma porta do ofício e da declaração.
 */
function voucherEnviarEmail_(para, assunto, corpoHtml) {
  return voucherEnviarMsg_({ to: para, subject: assunto, htmlBody: corpoHtml });
}

/**
 * Substituto direto do antigo MailApp.sendEmail(msg) neste módulo.
 *
 * Aceita a MESMA forma de objeto — to, subject, htmlBody, cc, attachments —
 * para a troca ser mecânica nos sete pontos que usavam MailApp. O que muda é
 * por onde sai: `GmailApp.createDraft().send()`, que respeita o `from` da
 * Secretaria quando ele é alias verificado da conta executora.
 */
function voucherEnviarMsg_(msg) {
  msg = msg || {};
  var opcoes = montarOpcoesEmailSISGEP_(
    "", msg.htmlBody || "", msg.attachments || [], msg.subject || "", msg.to || "");
  if (msg.cc) opcoes.cc = msg.cc;
  return enviarComoRascunhoSISGEP_(opcoes, msg.body || "Mensagem do SindEducação-ES.");
}

function enviarEmailIndeferimentoVoucher_(reg, protocolo, obs) {
  try {
    const email = valorSeguroVoucher_(reg.EMAIL);
    if (!email) return;

    voucherEnviarEmail_(
      email,
      "Sobre sua solicitação de bolsa — " + protocolo,
      "<p>Olá, <strong>" + escHtmlVoucher_(reg.NOME_SOLICITANTE) + "</strong>,</p>" +
      "<p>Recebemos sua solicitação de bolsa de estudo e agradecemos a confiança.</p>" +
      "<p>Após a conferência, <strong>não foi possível conceder o benefício neste caso</strong>. " +
      "O motivo registrado pela Secretaria foi:</p>" +
      "<div style='margin:14px 0;padding:12px 16px;background:#f8fafc;border-left:4px solid #001f4d;border-radius:8px;'>" +
      escHtmlVoucher_(obs) + "</div>" +
      "<p><strong>Isso não impede novas solicitações.</strong> Se algum dado tiver sido " +
      "informado por engano, ou se houver outro beneficiário que atenda aos critérios, " +
      "basta refazer o pedido pelo portal — ou falar com a Secretaria, que ajudamos a conferir.</p>" +
      "<p style='font-size:12.5px;color:#64748b;'>Protocolo: <strong>" + escHtmlVoucher_(protocolo) + "</strong></p>" +
      "<p>Qualquer dúvida, é só responder a este e-mail.</p>" +
      "<p>Atenciosamente,<br><strong>Secretaria — SindEducação-ES</strong></p>"
    );

  } catch (e) {
    Logger.log("enviarEmailIndeferimentoVoucher_ erro: " + e.message);
  }
}

/* ================= ALIASES COMPATIBILIDADE ================= */

function solicitarComplementacaoCertBolsa(protocolo, obs, tokenSessao) {
  return solicitarComplementacaoVoucher(protocolo, obs, tokenSessao);
}

/* A tela de Bolsas chama pelos nomes CertBolsa — mesma convenção dos demais. */
function confirmarCadastroCertBolsa(protocolo, obs, tokenSessao) {
  return confirmarCadastroSolicitacaoVoucher(protocolo, obs, tokenSessao);
}

function aprovarSolicitacaoCertBolsa(protocolo, obs, tokenSessao) {
  return aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao);
}

function aprovarSolicitacaoCertBolsaComEmail(protocolo, obs, tokenSessao, percentual) {
  /* O QUARTO ARGUMENTO PRECISA ATRAVESSAR. Este apelido é o que o painel
   * chama de verdade — esquecer o repasse aqui faria o ajuste de desconto
   * sumir no caminho, e a aprovação gravaria o percentual antigo sem que
   * ninguém visse erro nenhum. */
  return aprovarSolicitacaoVoucher(protocolo, obs, tokenSessao, percentual);
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

/**
 * RELATÓRIO — QUEM TEM MAIS DE UMA BOLSA NA MESMA JANELA.
 *
 * Pedido do usuário em 13/08/2026, depois de a regra mudar. Ela vale para
 * pedido NOVO; o que já estava gravado continua como está, porque a trava
 * antiga chaveava por pessoa + CURSO + janela e deixava passar. Medido no
 * emulador: o mesmo titular chegou a ter três vouchers para 2026/2 —
 * Pedagogia, Direito e um MBA.
 *
 * SÓ LEITURA. Não apaga, não cancela, não corrige. Devolve a lista para
 * alguém olhar e decidir caso a caso: se foi erro, cancela uma; se foi
 * exceção autorizada, deixa. Decidir isso é trabalho de quem conhece o caso,
 * não de uma rotina.
 *
 * Duas listas, porque são dois problemas diferentes:
 *   - `pessoas`  — o mesmo beneficiário com duas bolsas ocupando a mesma
 *                  janela. É a duplicidade propriamente dita.
 *   - `familias` — o mesmo associado com mais de três dependentes na mesma
 *                  janela. Não é duplicidade: é o teto estourado.
 *
 * Roda pelo editor do Apps Script (Executar) ou por tela, e escreve o
 * resultado no log formatado — para quem rodar pelo editor conseguir ler
 * sem montar nada.
 */
function voucherRelatorioDuplicidades(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!sh || sh.getLastRow() < 2) {
      return { ok: true, pessoas: [], familias: [], total: 0, mensagem: "Nenhuma solicitação na base." };
    }

    var ocupa = VOUCHER_STATUS_OCUPA_PERIODO_();
    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    function v(l, n) { var i = cab.indexOf(n); return i === -1 ? "" : l[i]; }

    /* Agrupado por PESSOA + JANELA. A janela é o texto normalizado do
     * período: linha que guardou Date volta a ser "2026/1" antes de comparar,
     * senão a mesma janela apareceria como duas. */
    var porPessoa = {};
    var porFamilia = {};

    for (var i = 1; i < tudo.length; i++) {
      var l = tudo[i];
      var status = String(v(l, "STATUS_SOLICITACAO") || "").trim().toUpperCase();
      if (ocupa.indexOf(status) === -1) continue;

      var cpf = String(v(l, "CPF_SOLICITANTE") || "").replace(/\D/g, "");
      if (!cpf) continue;

      var periodo = (typeof voucherPeriodoTexto_ === "function")
        ? voucherPeriodoTexto_(v(l, "PERIODO_REFERENCIA"))
        : String(v(l, "PERIODO_REFERENCIA") || "").trim();
      /* Linha sem período não entra: ela não ocupa janela nenhuma, e é outro
       * problema — o do "⚠ sem período", que tem correção própria. */
      if (!periodo) continue;

      var nome = String(v(l, "NOME_BENEFICIARIO") || v(l, "NOME_SOLICITANTE") || "").trim();
      var tipo = String(v(l, "TIPO_BENEFICIARIO") || "").trim().toUpperCase();
      var registro = {
        protocolo: String(v(l, "NUMERO_PROTOCOLO") || "").trim(),
        linha: i + 1,
        curso: String(v(l, "CURSO") || "").trim(),
        modalidade: String(v(l, "MODALIDADE") || "").trim(),
        status: status,
        data: String(v(l, "DATA_SOLICITACAO_TEXTO") || "").trim()
      };

      var chaveP = cpf + "|" + nome.toUpperCase() + "|" + periodo;
      if (!porPessoa[chaveP]) {
        porPessoa[chaveP] = {
          cpf: cpf, nome: nome, titular: String(v(l, "NOME_SOLICITANTE") || "").trim(),
          ehTitular: !tipo || tipo === "TITULAR", periodo: periodo, bolsas: []
        };
      }
      porPessoa[chaveP].bolsas.push(registro);

      if (tipo && tipo !== "TITULAR") {
        var chaveF = cpf + "|" + periodo;
        if (!porFamilia[chaveF]) {
          porFamilia[chaveF] = {
            cpf: cpf, titular: String(v(l, "NOME_SOLICITANTE") || "").trim(),
            periodo: periodo, dependentes: [], vistos: {}
          };
        }
        var chave = nome.toUpperCase();
        if (!porFamilia[chaveF].vistos[chave]) {
          porFamilia[chaveF].vistos[chave] = true;
          porFamilia[chaveF].dependentes.push(nome);
        }
      }
    }

    var pessoas = Object.keys(porPessoa)
      .map(function (k) { return porPessoa[k]; })
      .filter(function (p) { return p.bolsas.length > 1; });

    var teto = (typeof VOUCHER_MAX_DEPENDENTES_ !== "undefined") ? VOUCHER_MAX_DEPENDENTES_ : 3;
    var familias = Object.keys(porFamilia)
      .map(function (k) { var f = porFamilia[k]; delete f.vistos; return f; })
      .filter(function (f) { return f.dependentes.length > teto; });

    /* O log formatado é para quem roda pelo editor do Apps Script — ali não
     * há tela, e um objeto cru no console não se lê. */
    var linhas = ["=== VOUCHERS EM DUPLICIDADE NA MESMA JANELA ==="];
    if (!pessoas.length) linhas.push("(nenhuma pessoa com mais de uma bolsa na mesma janela)");
    pessoas.forEach(function (p) {
      linhas.push("");
      linhas.push(p.nome + (p.ehTitular ? " (titular)" : " (dependente de " + p.titular + ")") +
                  " — CPF " + p.cpf + " — janela " + p.periodo + " — " + p.bolsas.length + " bolsas:");
      p.bolsas.forEach(function (b) {
        linhas.push("   linha " + b.linha + " · " + b.protocolo + " · " +
                    (b.curso || b.modalidade) + " · " + b.status + " · " + b.data);
      });
    });
    linhas.push("");
    linhas.push("=== ASSOCIADOS COM MAIS DE " + teto + " DEPENDENTES NA MESMA JANELA ===");
    if (!familias.length) linhas.push("(nenhum)");
    familias.forEach(function (f) {
      linhas.push(f.titular + " — CPF " + f.cpf + " — janela " + f.periodo + " — " +
                  f.dependentes.length + ": " + f.dependentes.join(", "));
    });
    Logger.log(linhas.join("\n"));

    return {
      ok: true,
      pessoas: pessoas,
      familias: familias,
      total: pessoas.length + familias.length,
      relatorio: linhas.join("\n"),
      mensagem: (pessoas.length + familias.length) === 0
        ? "Nenhuma duplicidade encontrada na base."
        : pessoas.length + " pessoa(s) com mais de uma bolsa na mesma janela e " +
          familias.length + " associado(s) acima do teto de dependentes."
    };
  } catch (e) {
    Logger.log("voucherRelatorioDuplicidades: " + e.message + "\n" + (e.stack || ""));
    return { ok: false, mensagem: "Erro ao montar o relatório: " + e.message };
  }
}

/* ================= COMUNICADO DE "FORA DA REGRA" =================
 *
 * PEDIDO DO USUÁRIO, 16/09/2026, sobre o dependente acima de 24 anos:
 *
 *   "Ele pode preencher o cadastro, tudo normalmente. Quando vai chegar para
 *    a Marcela fazer validação, o sistema automaticamente tem que informar
 *    [...] Dependente fora da idade. E ela só vai enviar um comunicado, vai
 *    ter um botão em ações lá, ela vai enviar um comunicado já padrão, uma
 *    mensagem padrão, em que infelizmente não é possível devido à idade dele."
 *
 * E, perguntado se o texto sai fechado: "Pode editar".
 *
 * POR QUE NÃO É O INDEFERIMENTO COMUM. O indeferimento pede que alguém
 * DIGITE a justificativa — e a justificativa aqui é sempre a mesma frase,
 * sobre um fato que o sistema já conferiu sozinho. Redigitar todo semestre o
 * que o sistema já sabe é defeito de desenho, não trabalho (REGRA Nº 0.6).
 * Então o texto nasce pronto, com o motivo medido do cadastro, e ela edita se
 * o caso pedir.
 */

/**
 * O que travou a solicitação, medido do registro — não do que alguém digitou.
 *
 * Devolve `null` quando a solicitação NÃO está fora da regra. É isso que
 * decide se o botão aparece na tela: botão que existe sempre e só funciona às
 * vezes ensina a pessoa a clicar e receber recusa.
 */
function voucherMotivoForaDaRegra_(reg) {
  if (!reg) return null;

  var status = String(valorSeguroVoucher_(reg.STATUS_SOLICITACAO) || "").toUpperCase();
  if (status !== "BLOQUEADA_POR_REGRA") return null;

  var tipo  = String(valorSeguroVoucher_(reg.TIPO_BENEFICIARIO) || "").toUpperCase();
  var idade = String(valorSeguroVoucher_(reg.IDADE_BENEFICIARIO) || "").trim();
  var obs   = String(valorSeguroVoucher_(reg.OBSERVACOES) || "").trim();

  /* IDADE primeiro, porque é o caso que o usuário descreveu e o único em que
   * o sistema tem um número para mostrar. "até 24" inclui os 24 — ver o
   * cabeçalho da regra em Voucher.gs. */
  if (idade !== "" && !isNaN(Number(idade)) && Number(idade) > 24 &&
      tipo !== "TITULAR" && tipo !== "") {
    return {
      tipo: "IDADE",
      rotulo: "Beneficiário com " + idade + " anos — o limite da convenção é 24.",
      origem: "conferido no cadastro, no campo IDADE_BENEFICIÁRIO",
      idade: idade
    };
  }

  /* TETO POR ASSOCIADO. Gravado com esse prefixo em VoucherSolicitacao.gs. */
  if (obs.indexOf("LIMITE POR ASSOCIADO") > -1) {
    return {
      tipo: "LIMITE",
      rotulo: "O associado já está no teto de três bolsas no período.",
      origem: "contado pelo sistema entre as bolsas ativas do associado",
      idade: idade
    };
  }

  /* Qualquer outro bloqueio de regra: mostra o que a regra registrou, sem
   * inventar motivo. Texto vazio aqui seria pior que texto genérico. */
  return {
    tipo: "OUTRA",
    rotulo: obs || "A solicitação não atende a uma regra da convenção.",
    origem: "registrado pela conferência automática na entrada",
    idade: idade
  };
}

/**
 * O texto padrão, já preenchido — para a tela mostrar e ela editar.
 *
 * Devolve TEXTO CORRIDO, não HTML: é o que vai dentro de um <textarea>. A
 * casca visual do e-mail entra só no envio, em enviarComunicadoRegraVoucher.
 */
function voucherTextoComunicadoRegra_(reg, protocolo, motivo) {
  var nome  = valorSeguroVoucher_(reg.NOME_SOLICITANTE) || "associado(a)";
  var benef = valorSeguroVoucher_(reg.NOME_BENEFICIARIO) || "";

  var explicacao;
  if (motivo && motivo.tipo === "IDADE") {
    explicacao = "A convenção coletiva prevê o benefício para dependentes de até 24 anos. " +
      (benef ? "Como " + benef + " já ultrapassou essa idade" : "Como o beneficiário já ultrapassou essa idade") +
      ", infelizmente não é possível conceder a bolsa neste caso.";
  } else if (motivo && motivo.tipo === "LIMITE") {
    explicacao = "A convenção coletiva prevê até três bolsas por associado no mesmo período, " +
      "e esse limite já está ocupado. Infelizmente não é possível conceder mais uma bolsa agora.";
  } else {
    explicacao = "Após a conferência, infelizmente não foi possível conceder a bolsa neste caso. " +
      ((motivo && motivo.rotulo) ? "Motivo: " + motivo.rotulo : "");
  }

  return "" +
    "Olá, " + nome + ",\n\n" +
    "Recebemos sua solicitação de bolsa de estudo" +
    (benef ? " para " + benef : "") + " e agradecemos a confiança.\n\n" +
    explicacao + "\n\n" +
    "Isso não impede novas solicitações: se houver outro dependente que atenda aos " +
    "critérios, ou se algum dado tiver sido informado por engano, basta refazer o " +
    "pedido pelo portal — ou falar com a Secretaria, que ajudamos a conferir.\n\n" +
    "Protocolo: " + protocolo + "\n\n" +
    "Qualquer dúvida, é só responder a este e-mail.\n\n" +
    "Atenciosamente,\n" +
    "Secretaria — SindEducação-ES";
}

/**
 * A tela pede o rascunho ANTES de mostrar o modal — o texto chega pronto.
 */
function previewComunicadoRegraVoucher(protocolo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    var motivo = voucherMotivoForaDaRegra_(item.registro);
    if (!motivo) {
      return { ok: false, mensagem: "Esta solicitação não está bloqueada por regra." };
    }

    return {
      ok: true,
      protocolo: protocolo,
      email: valorSeguroVoucher_(item.registro.EMAIL) || "",
      nome: valorSeguroVoucher_(item.registro.NOME_SOLICITANTE) || "",
      beneficiario: valorSeguroVoucher_(item.registro.NOME_BENEFICIARIO) || "",
      motivo: motivo,
      assunto: "Sobre sua solicitação de bolsa — " + protocolo,
      texto: voucherTextoComunicadoRegra_(item.registro, protocolo, motivo)
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar o comunicado: " + e.message };
  }
}

/**
 * Envia o comunicado — com o texto que ELA aprovou, não com o meu.
 *
 * `indeferir` chega marcado da tela, e com a origem à vista: comunicar que
 * "infelizmente não é possível" e deixar a solicitação na fila faria a fila
 * crescer com caso já resolvido. Mas quem decide é quem está atendendo, então
 * é caixa desmarcável, não efeito colateral silencioso (REGRA Nº 0.6).
 */
function enviarComunicadoRegraVoucher(protocolo, texto, indeferir, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };

    var corpo = String(texto || "").trim();
    if (!corpo) return { ok: false, mensagem: "O comunicado está vazio — escreva a mensagem antes de enviar." };

    var email = valorSeguroVoucher_(item.registro.EMAIL);
    if (!email) {
      return { ok: false, mensagem: "Esta solicitação não tem e-mail cadastrado — o comunicado precisa ser dado por telefone." };
    }

    var motivo  = voucherMotivoForaDaRegra_(item.registro);
    var usuario = obterUsuarioAtualVoucher_();

    /* O TEXTO VEM DO <textarea>, ENTÃO É ESCAPADO E SÓ DEPOIS QUEBRADO EM
     * PARÁGRAFOS. Na ordem inversa, um "<" digitado por engano viraria tag e
     * quebraria o e-mail — ou pior, o que ela digitasse viraria HTML. */
    var corpoHtml = corpo.split(/\n{2,}/).map(function (par) {
      return "<p>" + escHtmlVoucher_(par).replace(/\n/g, "<br>") + "</p>";
    }).join("");

    voucherEnviarEmail_(email, "Sobre sua solicitação de bolsa — " + protocolo,
      voucherEmailHtml_("Sobre sua solicitação de bolsa", corpoHtml));

    var resumoMotivo = (motivo && motivo.rotulo) || "fora da regra";

    registrarHistoricoVoucher_(
      item.registro.ID_SOLICITACAO,
      item.registro.CPF_SOLICITANTE,
      "COMUNICADO_REGRA_ENVIADO",
      usuario,
      "Comunicado enviado para " + email + " — " + resumoMotivo,
      protocolo
    );

    if (indeferir === true || String(indeferir) === "true") {
      var justificativa = "Comunicado enviado ao associado. " + resumoMotivo;
      atualizarStatusSolicitacao_(item, "INDEFERIDO", justificativa);
      atualizarStatusProtocolo_(protocolo, "INDEFERIDO", usuario, justificativa);
      registrarHistoricoVoucher_(
        item.registro.ID_SOLICITACAO,
        item.registro.CPF_SOLICITANTE,
        "SOLICITACAO_INDEFERIDA",
        usuario,
        justificativa,
        protocolo
      );
      /* NÃO dispara enviarEmailIndeferimentoVoucher_: o associado acabou de
       * receber o comunicado, e dois e-mails sobre a mesma recusa, com textos
       * diferentes, é o tipo de coisa que gera ligação para o sindicato. */
      return { ok: true, mensagem: "Comunicado enviado e solicitação indeferida." };
    }

    return { ok: true, mensagem: "Comunicado enviado para " + email + "." };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar o comunicado: " + e.message };
  }
}
