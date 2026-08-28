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
 * Diagnostico SOMENTE de leitura para homologacao/editor.
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
    ambiente: (typeof getAmbienteAtual === "function") ? getAmbienteAtual() : "desconhecido",
    scriptTimeZone: scriptTz,
    spreadsheetTimeZone: planilhaTz,
    esperado: "America/Sao_Paulo",
    alinhado: scriptTz === "America/Sao_Paulo" && planilhaTz === "America/Sao_Paulo"
  };
}
