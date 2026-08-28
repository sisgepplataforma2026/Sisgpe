// ============================================================================
// ARQUIVO: DocumentosSeguranca.gs
// Controle de acesso e diagnosticos seguros do modulo Documentos/Oficios
// ============================================================================

/**
 * Exige sessao valida e aplica a permissao correta para cada tipo de oficio.
 *
 * Regra de compatibilidade:
 * - FILIACAO e DESFILIACAO podem ser operadas por Documentos OU Sindicalizacao,
 *   porque o fluxo de sindicalizacao reutiliza o gerador oficial de oficios.
 * - Demais tipos (Taxa Negocial, Oposicao, Taxa Assistencial e Oficio Livre)
 *   exigem o modulo Documentos.
 *
 * Usuarios legados com modulos="TODOS" continuam funcionando porque a fonte
 * canonica sessaoPodeModulo_ ja trata TODOS como acesso integral.
 */
function exigirAcessoOficioPorTipo_(tokenSessao, tipo) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var tipoNorm = normalizarTipoOficio_(tipo);

  var podeDocumentos = (typeof sessaoPodeModulo_ === "function")
    ? sessaoPodeModulo_(sessao, "documentos")
    : false;

  var ehFluxoSindicalizacao = (
    tipoNorm === "FILIACAO" ||
    tipoNorm === "DESFILIACAO"
  );

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

/**
 * Diagnostico SOMENTE de leitura.
 * Não altera fuso, planilha, propriedades nem dados.
 */
function documentosDiagnosticarFuso_() {
  var scriptTz = Session.getScriptTimeZone();
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
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
 * Cinto de seguranca para qualquer teste que possa consumir numero oficial.
 *
 * Não basta o projeto ser chamado de "homologacao": o ScriptProperty precisa
 * apontar para homologacao E a PLANILHA_ID resolvida precisa ser exatamente a
 * planilha de homologacao. Se qualquer uma dessas verificacoes falhar, recusa.
 */
function documentosExigirHomologacaoSegura_() {
  if (typeof getAmbienteAtual !== "function" || typeof getPlanilhaId !== "function") {
    throw new Error("Configuração de ambiente indisponível. Teste cancelado.");
  }

  var ambiente = String(getAmbienteAtual(true) || "").trim().toLowerCase();
  var idHomologacao = String(getPlanilhaId("homologacao") || "").trim();
  var idProducao = String(getPlanilhaId("producao") || "").trim();
  var idAtivo = String(PLANILHA_ID || "").trim();

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
    throw new Error("Teste recusado: falha ao confirmar a identidade da planilha de homologação.");
  }

  return {
    ambiente: ambiente,
    planilhaId: idHomologacao,
    planilhaNome: ss.getName()
  };
}

/**
 * Diagnóstico público, porém restrito a administrador, para ser chamado na
 * homologação antes do teste de concorrência. É somente leitura.
 */
function documentosDiagnosticoHomologacao(tokenSessao) {
  if (typeof exigirAdminOuSessao_ !== "function") {
    throw new Error("Controle administrativo indisponível.");
  }
  exigirAdminOuSessao_(tokenSessao, "documentos", "Diagnóstico de homologação de Documentos", true);

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
 * Endpoint controlado para o teste REAL de concorrência.
 *
 * Cada chamada executa a mesma gerarProximoNumeroSeguro() usada pelo módulo.
 * O teste deve disparar várias chamadas simultâneas via google.script.run na
 * homologação e confirmar que nenhum número se repete.
 *
 * IMPORTANTE: a chamada consome/reserva números somente na homologação. Isso é
 * intencional para testar o mecanismo real e nunca é permitido em produção.
 */
function documentosTesteReservarNumeroHomologacao(tokenSessao) {
  if (typeof exigirAdminOuSessao_ !== "function") {
    throw new Error("Controle administrativo indisponível.");
  }
  exigirAdminOuSessao_(tokenSessao, "documentos", "Teste de concorrência da numeração de ofícios", true);

  var alvo = documentosExigirHomologacaoSegura_();
  var numero = gerarProximoNumeroSeguro();

  return {
    ok: true,
    numero: numero,
    ambiente: alvo.ambiente,
    planilhaIdFinal: "…" + alvo.planilhaId.slice(-6),
    executadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss.SSS")
  };
}
