// ============================================================================
// ARQUIVO: OficiosDiagnostico.gs
// SISGEP · Diagnóstico do Módulo de Ofícios
// ============================================================================

var VERSAO_DIAGNOSTICO_OFICIOS = "2026.06.23.1";

function oficiosDiagnostico_diagnosticarModulo() {
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
function instalarTriggerConfirmacoesOficios(tokenSessao) {
  /* Mesma porta dos quatro do MonitoramentoOficios.gs — ver a nota de lá. */
  exigirAdminOuSessao_(tokenSessao, "documentos", "Instalação do gatilho de confirmações (diagnóstico)", true);
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

// ============================================================================
// QUAIS OFÍCIOS NÃO CHEGARAM — e por quê
// ----------------------------------------------------------------------------
// Acrescentado em 01/09/2026, na auditoria do Módulo 03.
//
// DE ONDE VEIO: na tela de Acionadores da produção, o
// `processarFilaEnvioOficios` mostrava 0,26% de erro. Uma taxa não diz nada
// para quem opera — não dá para ligar para uma porcentagem e avisar que o
// ofício não chegou. Esta função troca a taxa por NOMES: quais ofícios, de
// que escola, para que e-mail, com que erro e há quantos dias.
//
// Só lê. Não reenvia, não altera status, não apaga nada. Reenviar é decisão de
// quem opera, e tem função própria (`enviarOficioDaFilaAgora`).
//
// Lê as DUAS bases, como o dashboard faz: a fila (FILA_ENVIO_OFICIOS), que é o
// envio automatizado, e o Controle (PLANILHA_REGISTRO), que é a base antiga.
// Quando o mesmo número está nas duas, a fila vence — ela reflete o estado
// mais recente do envio.
// ============================================================================

/** Um ofício que precisa de gente, ou um que ainda vai sozinho. */
function ofDiag_classificar_(status) {
  var s = String(status || "").trim().toUpperCase();
  if (s === "ERRO_PERMANENTE") return { grupo: "ERRO_PERMANENTE", precisaGente: true  };
  if (s === "FALHA_ENTREGA")   return { grupo: "FALHA_ENTREGA",   precisaGente: true  };
  if (s === "ERRO")            return { grupo: "ERRO",            precisaGente: false };
  if (s === "PENDENTE" || s === "PROCESSANDO") return { grupo: "PENDENTE", precisaGente: false };
  if (s === "ENVIADO" || s === "CONFIRMADO")   return { grupo: s,          precisaGente: false };
  return { grupo: s || "(sem status)", precisaGente: false };
}

/**
 * Relatório dos ofícios por situação, com a lista dos que não chegaram.
 * Rodar no editor: Executar → oficiosQueNaoChegaram → ver o Registro.
 */
function oficiosQueNaoChegaram() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var mapa = {};   /* numero -> { status, escola, email, erro, tentativas, data, origem } */

  /* Controle primeiro; a fila sobrescreve depois, mesma ordem do dashboard. */
  try {
    var shC = ss.getSheetByName(PLANILHA_REGISTRO);
    if (shC && shC.getLastRow() >= 2) {
      var hmC = getHeaderMap_(shC);
      var cNum = hmC["Número do Ofício"], cSt = hmC["Status"],
          cEsc = hmC["Escola"], cMail = hmC["E-mail"];
      if (cNum && cSt) {
        shC.getRange(2, 1, shC.getLastRow() - 1, shC.getLastColumn()).getValues()
          .forEach(function (l) {
            var n = String(l[cNum - 1] || "").trim();
            /* Mesma trava do dashboard: só NNN/AAAA é ofício. O Controle
               guarda também linhas de cadastro de escola, com numeração
               sequencial sem barra. */
            if (!/^\d+\/\d{4}$/.test(n)) return;
            mapa[n] = {
              status: String(l[cSt - 1] || "").trim(),
              escola: cEsc  ? String(l[cEsc  - 1] || "").trim() : "",
              email:  cMail ? String(l[cMail - 1] || "").trim() : "",
              erro: "", tentativas: "", data: null, origem: "Controle"
            };
          });
      }
    }
  } catch (eC) { Logger.log("⚠ Controle: " + eC.message); }

  try {
    var shF = ss.getSheetByName("FILA_ENVIO_OFICIOS");
    if (shF && shF.getLastRow() >= 2) {
      var hmF = getHeaderMap_(shF);
      var fNum = hmF["NUMERO_OFICIO"], fSt = hmF["STATUS"], fEsc = hmF["ESCOLA"],
          fMail = hmF["EMAIL_DESTINO"], fErr = hmF["ULTIMO_ERRO"],
          fTent = hmF["TENTATIVAS"], fData = hmF["DATA_ULTIMA_TENTATIVA"];
      if (fNum && fSt) {
        shF.getRange(2, 1, shF.getLastRow() - 1, shF.getLastColumn()).getValues()
          .forEach(function (l) {
            var n = String(l[fNum - 1] || "").trim();
            if (!n) return;
            mapa[n] = {
              status: String(l[fSt - 1] || "").trim(),
              escola: fEsc  ? String(l[fEsc  - 1] || "").trim() : "",
              email:  fMail ? String(l[fMail - 1] || "").trim() : "",
              erro:   fErr  ? String(l[fErr  - 1] || "").trim() : "",
              tentativas: fTent ? (parseInt(l[fTent - 1], 10) || 0) : "",
              data:   fData && l[fData - 1] ? new Date(l[fData - 1]) : null,
              origem: "Fila"
            };
          });
      }
    }
  } catch (eF) { Logger.log("⚠ Fila: " + eF.message); }

  var porGrupo = {}, naoChegaram = [];
  Object.keys(mapa).forEach(function (n) {
    var it = mapa[n];
    var c = ofDiag_classificar_(it.status);
    porGrupo[c.grupo] = (porGrupo[c.grupo] || 0) + 1;
    if (c.precisaGente) { it.numero = n; naoChegaram.push(it); }
  });

  naoChegaram.sort(function (a, b) {
    return (b.data ? b.data.getTime() : 0) - (a.data ? a.data.getTime() : 0);
  });

  var l = [];
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  OFÍCIOS — SITUAÇÃO DE ENVIO");
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  Total de ofícios : " + Object.keys(mapa).length);
  l.push("");
  Object.keys(porGrupo).sort().forEach(function (g) {
    var nota = "";
    if (g === "PENDENTE") nota = "   (sai sozinho no próximo gatilho)";
    if (g === "ERRO")     nota = "   (ainda vai tentar de novo)";
    if (g === "ERRO_PERMANENTE") nota = "   ← A FILA DESISTIU. Precisa de gente.";
    if (g === "FALHA_ENTREGA")   nota = "   ← voltou do servidor de e-mail.";
    l.push("  " + (g + "                    ").substring(0, 18) + ": " + porGrupo[g] + nota);
  });

  l.push("");
  if (!naoChegaram.length) {
    l.push("  ✅ Nenhum ofício parado esperando uma pessoa.");
  } else {
    l.push("  ── OS " + naoChegaram.length + " QUE PRECISAM DE GENTE ──────────────────");
    naoChegaram.forEach(function (o) {
      var quando = o.data
        ? Utilities.formatDate(o.data, "America/Sao_Paulo", "dd/MM/yyyy HH:mm")
        : "sem data";
      var dias = o.data
        ? Math.floor((new Date().getTime() - o.data.getTime()) / 86400000)
        : null;
      l.push("");
      l.push("  " + o.numero + "  ·  " + (o.escola || "(sem escola)"));
      l.push("     para : " + (o.email || "(sem e-mail)"));
      l.push("     desde: " + quando + (dias !== null ? "   (" + dias + " dia(s) parado)" : ""));
      if (o.tentativas !== "") l.push("     tentativas: " + o.tentativas);
      if (o.erro) l.push("     erro : " + o.erro.substring(0, 120));
    });
    l.push("");
    l.push("  Para reenviar um deles depois de corrigir o e-mail, use");
    l.push("  enviarOficioDaFilaAgora — esta função aqui só lê.");
  }
  l.push("═══════════════════════════════════════════════════════════");

  var texto = l.join("\n");
  Logger.log(texto);
  return {
    ok: true, total: Object.keys(mapa).length, porGrupo: porGrupo,
    precisamDeGente: naoChegaram.length, relatorio: texto
  };
}
