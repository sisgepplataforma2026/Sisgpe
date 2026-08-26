// ============================================================================
// ARQUIVO: DiagnosticoOficios.gs
// SISGEP · Diagnóstico do Módulo de Ofícios
// ============================================================================

var VERSAO_DIAGNOSTICO_OFICIOS = "2026.06.23.1";

function diagnosticarModuloOficios() {
  var relatorio = {
    versao: VERSAO_DIAGNOSTICO_OFICIOS,
    dataHora: new Date(),
    statusGeral: "OK",
    itens: []
  };

verificarConstantesOficios_(relatorio);
verificarAbasOficios_(relatorio);
verificarColunasFilaOficios_(relatorio);
verificarFuncoesOficios_(relatorio);
verificarPastasOficios_(relatorio);
verificarTriggersOficios_(relatorio);

  var criticos = relatorio.itens.filter(function(i) {
    return i.status === "ERRO";
  }).length;

  var alertas = relatorio.itens.filter(function(i) {
    return i.status === "ALERTA";
  }).length;

  relatorio.statusGeral = criticos > 0 ? "ERRO" : alertas > 0 ? "ALERTA" : "OK";

  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}

function addDiagOficios_(relatorio, categoria, item, status, mensagem) {
  relatorio.itens.push({
    categoria: categoria,
    item: item,
    status: status,
    mensagem: mensagem || ""
  });
}

function verificarConstantesOficios_(relatorio) {
  var obrigatorias = [
    "PLANILHA_ID",
    "PLANILHA_REGISTRO",
    "SISTEMA_VERSAO",
    "PASTA_OFICIOS_ID",
    "PASTA_OFICIOS_FILIACAO_ID",
    "PASTA_OFICIOS_DESFILIACAO_ID",
    "PASTA_OFICIOS_TAXA_NEGOCIAL_ID",
    "PASTA_OFICIOS_TAXA_ASSIST_ID",
    "PASTA_OFICIOS_LIVRE_ID"
  ];

  obrigatorias.forEach(function(nome) {
    try {
      var valor = this[nome];
      if (valor === undefined || valor === null || String(valor).trim() === "") {
        addDiagOficios_(relatorio, "Constantes", nome, "ERRO", "Constante vazia ou não definida.");
      } else {
        addDiagOficios_(relatorio, "Constantes", nome, "OK", "Definida.");
      }
    } catch (e) {
      addDiagOficios_(relatorio, "Constantes", nome, "ERRO", e.message);
    }
  });
}

function verificarAbasOficios_(relatorio) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);

    var abas = [
      PLANILHA_REGISTRO,
      "FILA_ENVIO_OFICIOS",
      "LOG_SISTEMA"
    ];

    abas.forEach(function(nomeAba) {
      var sh = ss.getSheetByName(nomeAba);
      if (sh) {
        addDiagOficios_(relatorio, "Abas", nomeAba, "OK", "Aba encontrada.");
      } else {
        addDiagOficios_(relatorio, "Abas", nomeAba, "ERRO", "Aba não encontrada.");
      }
    });

  } catch (e) {
    addDiagOficios_(relatorio, "Abas", "Planilha", "ERRO", e.message);
  }
}

function verificarFuncoesOficios_(relatorio) {
  var funcoes = [
    "gerarOficioWeb",
    "previewOficioWeb",
    "montarDadosOficio_",
    "gerarProximoNumeroSeguro",
    "criarFilaEnvioOficio_",
    "enviarOficioDaFilaAgora",
    "reprocessarOficioDaFila",
    "destravarOficiosProcessandoTravados",
    "listarHistoricoOficios",
    "listarStatusOficios",
    "atualizarStatusOficio",
    "montarEmailHTML",
    "resolverConfigTipoOficio_",
    "normalizarTipoOficio_",
    "getHeaderMap_",
    "appendRowByHeader_"
  ];

  funcoes.forEach(function(nome) {
    if (typeof this[nome] === "function") {
      addDiagOficios_(relatorio, "Funções", nome, "OK", "Função encontrada.");
    } else {
      addDiagOficios_(relatorio, "Funções", nome, "ERRO", "Função não encontrada.");
    }
  });
}

function verificarPastasOficios_(relatorio) {
  var pastas = {
    PASTA_OFICIOS_ID: typeof PASTA_OFICIOS_ID !== "undefined" ? PASTA_OFICIOS_ID : "",
    PASTA_OFICIOS_FILIACAO_ID: typeof PASTA_OFICIOS_FILIACAO_ID !== "undefined" ? PASTA_OFICIOS_FILIACAO_ID : "",
    PASTA_OFICIOS_DESFILIACAO_ID: typeof PASTA_OFICIOS_DESFILIACAO_ID !== "undefined" ? PASTA_OFICIOS_DESFILIACAO_ID : "",
    PASTA_OFICIOS_TAXA_NEGOCIAL_ID: typeof PASTA_OFICIOS_TAXA_NEGOCIAL_ID !== "undefined" ? PASTA_OFICIOS_TAXA_NEGOCIAL_ID : "",
    PASTA_OFICIOS_TAXA_ASSIST_ID: typeof PASTA_OFICIOS_TAXA_ASSIST_ID !== "undefined" ? PASTA_OFICIOS_TAXA_ASSIST_ID : "",
    PASTA_OFICIOS_LIVRE_ID: typeof PASTA_OFICIOS_LIVRE_ID !== "undefined" ? PASTA_OFICIOS_LIVRE_ID : ""
  };

  Object.keys(pastas).forEach(function(nome) {
    var id = pastas[nome];

    if (!id) {
      addDiagOficios_(relatorio, "Pastas", nome, "ERRO", "ID não informado.");
      return;
    }

    try {
      var pasta = DriveApp.getFolderById(id);
      addDiagOficios_(relatorio, "Pastas", nome, "OK", "Pasta acessível: " + pasta.getName());
    } catch (e) {
      addDiagOficios_(relatorio, "Pastas", nome, "ERRO", "Pasta inacessível: " + e.message);
    }
  });
}

function verificarTriggersOficios_(relatorio) {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var nomes = triggers.map(function(t) {
      return t.getHandlerFunction();
    });

    var esperados = [
      "processarFilaEnvioOficios",
      "verificarConfirmacoesRecebimento"
    ];

    esperados.forEach(function(nome) {
      if (nomes.indexOf(nome) >= 0) {
        addDiagOficios_(relatorio, "Triggers", nome, "OK", "Trigger encontrado.");
      } else {
        addDiagOficios_(relatorio, "Triggers", nome, "ALERTA", "Trigger não encontrado.");
      }
    });

  } catch (e) {
    addDiagOficios_(relatorio, "Triggers", "Projeto", "ERRO", e.message);
  }
}
function instalarTriggerConfirmacoesOficios() {
  var nomeFuncao = "verificarConfirmacoesRecebimento";

  var triggers = ScriptApp.getProjectTriggers();
  var jaExiste = triggers.some(function(t) {
    return t.getHandlerFunction() === nomeFuncao;
  });

  if (jaExiste) {
    return {
      ok: true,
      mensagem: "Trigger de confirmações já existe."
    };
  }

  ScriptApp.newTrigger(nomeFuncao)
    .timeBased()
    .everyHours(1)
    .create();

  return {
    ok: true,
    mensagem: "Trigger de confirmações criado com sucesso para rodar a cada 1 hora."
  };
}
function verificarColunasFilaOficios_(relatorio) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");

    if (!sh) {
      addDiagOficios_(relatorio, "Colunas", "FILA_ENVIO_OFICIOS", "ERRO", "Aba não encontrada.");
      return;
    }

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim().toUpperCase(); });

    var obrigatorias = [
      "ID",
      "DATA_CRIACAO",
      "NUMERO_OFICIO",
      "TIPO",
      "ESCOLA",
      "CNPJ",
      "EMAIL_PRINCIPAL",
      "EMAILS_TODOS",
      "ASSUNTO",
      "HTML_BODY",
      "ANEXOS_JSON",
      "STATUS",
      "TENTATIVAS",
      "ULTIMO_ERRO",
      "DATA_ULTIMA_TENTATIVA",
      "USUARIO",
      "CODIGO_VERIFICACAO",
      "DATA_ENVIO",
      "DATA_CONFIRMACAO",
      "MENSAGEM_ID",
      "STATUS_RECEBIMENTO",
      "ABERTURAS",
      "CLIQUES",
      "ORIGEM"
    ];

    obrigatorias.forEach(function(col) {
      if (cab.indexOf(col) >= 0) {
        addDiagOficios_(relatorio, "Colunas FILA", col, "OK", "Coluna encontrada.");
      } else {
        addDiagOficios_(relatorio, "Colunas FILA", col, "ALERTA", "Coluna não encontrada.");
      }
    });

  } catch (e) {
    addDiagOficios_(relatorio, "Colunas FILA", "Erro geral", "ERRO", e.message);
  }
}