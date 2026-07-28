function gerarDiagnosticoSISGEP() {
  var PLANILHA_ID_DIAG = "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E";
  var ss = SpreadsheetApp.openById(PLANILHA_ID_DIAG);

  var resultado = {
    geradoEm: new Date(),
    planilha: {
      nome: ss.getName(),
      id: ss.getId(),
      url: ss.getUrl()
    },
    abas: [],
    triggers: [],
    propriedades: {},
    modulosDeclarados: [
      "Login",
      "Ofícios",
      "Cadastro de Escolas",
      "Histórico de Ofícios",
      "Dashboard de Ofícios",
      "Mensalidade Sindical",
      "Relatórios",
      "Monitoramento"
    ],
    sugestoesIA: [
      "Gerar texto de ofício com base no tipo, escola e histórico",
      "Resumir histórico da escola",
      "Gerar resposta de e-mail",
      "Classificar pendências por risco",
      "Criar tarefa de acompanhamento",
      "Sugerir próximo passo operacional"
    ]
  };

  ss.getSheets().forEach(function(sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    var headers = [];
    if (lastRow >= 1 && lastCol >= 1) {
      headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    }

    resultado.abas.push({
      nome: sheet.getName(),
      linhas: lastRow,
      colunas: lastCol,
      cabecalhos: headers
    });
  });

  ScriptApp.getProjectTriggers().forEach(function(t) {
    resultado.triggers.push({
      funcao: t.getHandlerFunction(),
      origem: String(t.getTriggerSource()),
      tipoEvento: String(t.getEventType())
    });
  });

  var props = PropertiesService.getScriptProperties().getProperties();
  Object.keys(props).forEach(function(k) {
    var nome = String(k || "").toUpperCase();
    resultado.propriedades[k] =
      nome.indexOf("KEY") >= 0 ||
      nome.indexOf("TOKEN") >= 0 ||
      nome.indexOf("SECRET") >= 0
        ? "***OCULTO***"
        : props[k];
  });

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}