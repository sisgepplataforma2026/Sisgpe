// ============================================================================
// ARQUIVO: DocumentosSeguranca.gs
// Controle de acesso e diagnósticos seguros do módulo Documentos/Ofícios
// ============================================================================

/**
 * Filiação e Desfiliação são reutilizadas por Sindicalização.
 * Os demais tipos são exclusivos de Documentos.
 */
function exigirAcessoOficioPorTipo_(tokenSessao, tipo) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var tipoNorm = normalizarTipoOficio_(tipo);
  var podeDocumentos = (typeof sessaoPodeModulo_ === "function")
    ? sessaoPodeModulo_(sessao, "documentos")
    : false;
  var ehFluxoSindicalizacao = tipoNorm === "FILIACAO" || tipoNorm === "DESFILIACAO";

  if (podeDocumentos) return sessao;

  if (ehFluxoSindicalizacao) {
    var podeSindicalizacao = (typeof sessaoPodeModulo_ === "function")
      ? sessaoPodeModulo_(sessao, "sindicalizacao")
      : false;
    if (podeSindicalizacao) return sessao;
  }

  throw new Error(
    ehFluxoSindicalizacao
      ? "Acesso negado. Este ofício exige permissão em Documentos ou Sindicalização."
      : "Acesso negado. Este ofício exige permissão no módulo Documentos."
  );
}

/** Somente leitura. */
function documentosDiagnosticarFuso_() {
  var scriptTz = Session.getScriptTimeZone();
  var idAtivo = (typeof getPlanilhaId === "function") ? getPlanilhaId() : PLANILHA_ID;
  var ss = SpreadsheetApp.openById(idAtivo);
  var planilhaTz = "";

  try {
    planilhaTz = ss.getSpreadsheetTimeZone();
  } catch (e) {
    planilhaTz = "ERRO: " + e.message;
  }

  return {
    ambiente: (typeof getAmbienteAtual === "function") ? getAmbienteAtual(true) : "desconhecido",
    scriptTimeZone: scriptTz,
    spreadsheetTimeZone: planilhaTz,
    esperado: "America/Sao_Paulo",
    alinhado: scriptTz === "America/Sao_Paulo" && planilhaTz === "America/Sao_Paulo"
  };
}

/**
 * Cinto de segurança: qualquer teste que possa consumir número é recusado se
 * o projeto não estiver explicitamente apontado para a planilha de homologação.
 */
function documentosExigirHomologacaoSegura_() {
  if (typeof getAmbienteAtual !== "function" || typeof getPlanilhaId !== "function") {
    throw new Error("Configuração de ambiente indisponível. Teste cancelado.");
  }

  var ambiente = String(getAmbienteAtual(true) || "").trim().toLowerCase();
  var idHomologacao = String(getPlanilhaId("homologacao") || "").trim();
  var idProducao = String(getPlanilhaId("producao") || "").trim();
  var idAtivo = String(getPlanilhaId() || "").trim();

  if (ambiente !== "homologacao") {
    throw new Error("Teste recusado: SISGEP_AMBIENTE não está em homologacao.");
  }
  if (!idHomologacao || idAtivo !== idHomologacao) {
    throw new Error("Teste recusado: a planilha ativa não é a planilha de homologação.");
  }
  if (idAtivo === idProducao) {
    throw new Error("Teste recusado: a planilha ativa coincide com produção.");
  }

  var ss = SpreadsheetApp.openById(idAtivo);
  if (String(ss.getId()) !== idHomologacao) {
    throw new Error("Teste recusado: identidade da planilha de homologação não confirmada.");
  }

  return {
    ambiente: ambiente,
    planilhaId: idHomologacao,
    planilhaNome: ss.getName()
  };
}

/** Pode ser chamado pela sessão web ou diretamente pelo administrador no editor. */
function documentosDiagnosticoHomologacao(tokenSessao) {
  exigirAdminOuSessao_(
    tokenSessao,
    "documentos",
    "Diagnóstico de homologação de Documentos",
    true
  );

  var alvo = documentosExigirHomologacaoSegura_();
  var fuso = documentosDiagnosticarFuso_();

  return {
    ok: true,
    ambiente: alvo.ambiente,
    planilhaNome: alvo.planilhaNome,
    planilhaIdFinal: "…" + alvo.planilhaId.slice(-6),
    fuso: fuso,
    prontoParaTeste: fuso.alinhado === true
  };
}

/**
 * Reserva UM número usando exatamente o mecanismo real. É impossível executar
 * fora de homologação e exige administrador. Chamadas simultâneas deste método
 * são usadas para comprovar que não há colisão.
 */
function documentosTesteReservarNumeroHomologacao(tokenSessao) {
  exigirAdminOuSessao_(
    tokenSessao,
    "documentos",
    "Teste de concorrência da numeração de ofícios",
    true
  );

  var alvo = documentosExigirHomologacaoSegura_();
  var numero = gerarProximoNumeroSeguro();

  return {
    ok: true,
    numero: numero,
    ambiente: alvo.ambiente,
    planilhaIdFinal: "…" + alvo.planilhaId.slice(-6),
    executadoEm: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy HH:mm:ss.SSS"
    )
  };
}
