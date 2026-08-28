// ============================================================================
// ARQUIVO: DashboardOficios.gs
// VERSÃO AJUSTADA — sem sobrescrever funções de Oficios.gs/FilaOficios.gs
// ----------------------------------------------------------------------------
// OBJETIVO DA CORREÇÃO
// 1. Remover duplicidade de funções globais como dashboardResumo(),
//    dashboardGraficos(), dashboardFilaEnvioResumo(), etc.
// 2. Preservar as entradas usadas pelo frontend:
//    - getDashboardOficiosData()
//    - getDashboardOficiosDataV2()
//    - consultarEscolaDashboardOficios()
// 3. Buscar dados reais tanto da aba Controle quanto da FILA_ENVIO_OFICIOS.
// 4. Manter fallback seguro com zeros, sem valores fictícios.
// ============================================================================

function getDashboardOficiosData(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  filtros = filtros || {};

  var agoraFormatado = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm:ss"
  );

  var data = {
    dadosReais: false,
    resumo: {
      total: 0,
      confirmados: 0,
      pendentes: 0,
      enviados: 0,
      erros: 0,
      falhas: 0,
      proximoOficio: "",
      ultimoOficio: "",
      taxaSucesso: 0
    },
    monitoramento: {
      enviados: 0,
      confirmados: 0,
      visualizados: 0,
      aguardando: 0,
      aberturas: 0,
      cliques: 0,
      taxaConfirmacao: 0,
      taxaAbertura: 0,
      taxaCliques: 0
    },
    graficos: { tipos: {}, status: {} },
    fila: {
      total: 0,
      pendentes: 0,
      processando: 0,
      enviados: 0,
      confirmados: 0,
      erros: 0,
      falhas: 0,
      taxaSucesso: 0,
      taxaErro: 0
    },
    controle: {
      total: 0,
      pendentes: 0,
      enviados: 0,
      confirmados: 0,
      erros: 0,
      falhas: 0
    },
    errosRecentes: [],
    pendenciasCriticas: [],
    taxaAssistencial: { ativa: false, numero: "", total: 0, enviado: 0, pendente: 0, erro: 0 },
    escolas: [],
    atividades: [],
    badge: 0,
    atualizadoEm: agoraFormatado
  };

  try {
    var badgeStr = PropertiesService.getScriptProperties().getProperty("BADGE_MONITORAMENTO");
    data.badge = badgeStr !== null ? (parseInt(badgeStr, 10) || 0) : 0;
  } catch (eBadge) {
    Logger.log("getDashboardOficiosData.badge: " + eBadge.message);
  }

  try {
    data.controle = DASH_OFICIOS_resumoControle_();
    data.dadosReais = data.dadosReais || data.controle.total > 0;
  } catch (eControle) {
    Logger.log("getDashboardOficiosData.controle: " + eControle.message);
  }

  try {
    data.fila = DASH_OFICIOS_resumoFila_();
    data.dadosReais = data.dadosReais || data.fila.total > 0;
  } catch (eFila) {
    Logger.log("getDashboardOficiosData.fila: " + eFila.message);
  }

try {

  data.monitoramento =
    DASH_OFICIOS_monitoramentoAvancado_();

  data.monitoramento.lista =
    DASH_OFICIOS_listaMonitoramento_();

} catch (eMonitoramento) {

  Logger.log(
    "getDashboardOficiosData.monitoramento: " +
    eMonitoramento.message
  );

}

  try {
    data.graficos = DASH_OFICIOS_graficos_();
  } catch (eGraf) {
    Logger.log("getDashboardOficiosData.graficos: " + eGraf.message);
  }

  try {
    data.errosRecentes = DASH_OFICIOS_errosRecentesFila_();
  } catch (eErros) {
    Logger.log("getDashboardOficiosData.errosRecentes: " + eErros.message);
  }

  try {
    data.pendenciasCriticas = DASH_OFICIOS_pendenciasCriticas_();
  } catch (ePend) {
    Logger.log("getDashboardOficiosData.pendenciasCriticas: " + ePend.message);
  }

  try {
    if (typeof obterStatusTaxaAssistencialDashboard === "function") {
      data.taxaAssistencial = obterStatusTaxaAssistencialDashboard() || data.taxaAssistencial;
    }
  } catch (eTaxa) {
    Logger.log("getDashboardOficiosData.taxaAssistencial: " + eTaxa.message);
  }

  var unificado = DASH_OFICIOS_unificarPorNumero_();

  data.resumo.total         = unificado.resumo.total;
  data.resumo.confirmados   = unificado.resumo.confirmados;
  data.resumo.enviados      = unificado.resumo.enviados;
  data.resumo.pendentes     = unificado.resumo.pendentes;
  data.resumo.erros         = unificado.resumo.erros;
  data.resumo.falhas        = unificado.resumo.falhas;
  data.resumo.taxaSucesso   = unificado.resumo.taxaSucesso;
  data.resumo.proximoOficio = data.controle.proximoOficio || DASH_OFICIOS_preverProximoNumero_();
  data.resumo.ultimoOficio  = data.controle.ultimoOficio || "";

  if (data.badge === 0 && data.pendenciasCriticas.length > 0) {
    data.badge = data.pendenciasCriticas.length;
  }

  try {
    data.escolas = DASH_OFICIOS_montarEscolasAcompanhamento_(data) || [];
  } catch (eEsc) {
    Logger.log("getDashboardOficiosData.escolas: " + eEsc.message);
    data.escolas = [];
  }

  try {
    data.atividades = DASH_OFICIOS_montarAtividadesRecentes_(data) || [];
  } catch (eAtiv) {
    Logger.log("getDashboardOficiosData.atividades: " + eAtiv.message);
    data.atividades = [];
  }

  return JSON.parse(JSON.stringify(data));
}

function getDashboardOficiosDataV2(filtros, tokenSessao) {
  try {
    return getDashboardOficiosData(filtros || {}, tokenSessao);
  } catch (e) {
    Logger.log("getDashboardOficiosDataV2: " + e.message);
    return {
      dadosReais: false,
      resumo: { total: 0, confirmados: 0, pendentes: 0, enviados: 0, erros: 0, falhas: 0, proximoOficio: "", taxaSucesso: 0 },
      graficos: { tipos: {}, status: {} },
      fila: { total: 0, pendentes: 0, processando: 0, enviados: 0, confirmados: 0, erros: 0, falhas: 0, taxaSucesso: 0 },
      controle: { total: 0, pendentes: 0, enviados: 0, confirmados: 0, erros: 0, falhas: 0 },
      errosRecentes: [],
      pendenciasCriticas: [],
      taxaAssistencial: { ativa: false, numero: "", total: 0, enviado: 0, pendente: 0, erro: 0 },
      escolas: [],
      atividades: [],
      badge: 0,
      atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
      erro: String(e.message || e)
    };
  }
}

function consultarEscolaDashboardOficios(query, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    query = String(query || "").trim();
    if (!query || query.length < 2) return [];

    if (typeof buscarEscolasPorTermo === "function") {
      return (buscarEscolasPorTermo_interno_(query) || []).map(function(e) {
        return {
          nome:     e.escola || e.nome || e.razaoSocial || "",
          cnpj:     e.cnpj || e.cnpjLimpo || "",
          email:    e.emailsTodos || e.email || "",
          endereco: e.enderecoCompleto || e.endereco || "",
          cidade:   e.cidade || e.municipio || "",
          uf:       e.uf || ""
        };
      });
    }

    return [];
  } catch (err) {
    Logger.log("consultarEscolaDashboardOficios: " + err.message);
    return [];
  }
}

/* ============================================================================
   HELPERS PRIVADOS DO DASHBOARD — prefixados para não conflitar com outros .gs
============================================================================ */

function DASH_OFICIOS_getSS_() {
  return SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
}

function DASH_OFICIOS_normStatus_(v) {
  return String(v || "").trim().toUpperCase();
}

function DASH_OFICIOS_anoAtual_() {
  if (typeof anoAtual_ === "function") return anoAtual_();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
}

function DASH_OFICIOS_preverProximoNumero_() {
  try {
    if (typeof preverProximoNumeroOficio === "function") return preverProximoNumeroOficio();
  } catch (e) {}
  return "";
}

// ============================================================================
// DASH_OFICIOS_unificarPorNumero_()
// ----------------------------------------------------------------------------
// Correção definitiva da duplicação Controle x Fila (17/06/2026):
// Confirmado com o usuário que os ofícios 119/2026 a 219/2026 existem em AMBAS
// as abas (mesmo NUMERO_OFICIO), e que 045/2026 a 118/2026 existem APENAS na
// aba Controle (PLANILHA_REGISTRO) — não foram reprocessados pela Fila.
// Logo, não dá para usar só a Fila (perderia 045-118) nem somar Controle+Fila
// sem critério (duplicaria 119-219). Esta função monta um mapa único
// NUMERO_OFICIO -> STATUS, varrendo primeiro o Controle e depois sobrescrevendo
// com o status da Fila quando o mesmo número existir nos dois lugares (a Fila
// é o sistema mais novo/ativo e deve refletir o status mais atual do envio).
// O resultado consolidado (1 status por número de ofício, sem duplicar) é usado
// tanto no resumo (KPIs) quanto nos gráficos (tipos/status) do Dashboard.
// ============================================================================
function DASH_OFICIOS_unificarPorNumero_() {
  var mapa = {}; // numero -> { status, tipo }
  var ss = DASH_OFICIOS_getSS_();

  // Passo 1 - Controle (PLANILHA_REGISTRO) primeiro — base mais antiga/completa.
  try {
    var shControle = ss.getSheetByName(PLANILHA_REGISTRO);
    if (shControle && shControle.getLastRow() >= 2) {
      var hmC = getHeaderMap_(shControle);
      var cNumero = hmC["Número do Ofício"];
      var cStatus = hmC["Status"];
      var cTipo   = hmC["TIPO"];
      if (cNumero && cStatus) {
        var dadosC = shControle.getRange(2, 1, shControle.getLastRow() - 1, shControle.getLastColumn()).getValues();
        dadosC.forEach(function(row) {
          var numero = String(row[cNumero - 1] || "").trim();
          if (!numero) return;
          // Validação: número de ofício deve ter formato NNN/AAAA (ex: 065/2026).
          // Linhas de cadastro de escolas no Controle têm numeração sequencial sem
          // a barra e o ano, então são ignoradas aqui para evitar contagem errada.
          if (!/^\d+\/\d{4}$/.test(numero)) return;
          var status = DASH_OFICIOS_normStatus_(row[cStatus - 1]);
          if (!status) return; // ignora linhas sem status
          mapa[numero] = {
            status: status,
            tipo: cTipo ? String(row[cTipo - 1] || "Sem tipo").trim() : "Sem tipo"
          };
        });
      }
    }
  } catch (eC) {
    Logger.log("DASH_OFICIOS_unificarPorNumero_.controle: " + eC.message);
  }

  // Passo 2 - Fila (FILA_ENVIO_OFICIOS) depois — sobrescreve quando o número já existe,
  //    pois a fila reflete o status mais recente do envio automatizado.
  try {
    var shFila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
    if (shFila && shFila.getLastRow() >= 2) {
      var hmF = getHeaderMap_(shFila);
      var fNumero = hmF["NUMERO_OFICIO"];
      var fStatus = hmF["STATUS"];
      var fTipo   = hmF["TIPO"];
      if (fNumero && fStatus) {
        var dadosF = shFila.getRange(2, 1, shFila.getLastRow() - 1, shFila.getLastColumn()).getValues();
        dadosF.forEach(function(row) {
          var numero = String(row[fNumero - 1] || "").trim();
          if (!numero) return;
          var status = DASH_OFICIOS_normStatus_(row[fStatus - 1]);
          if (!status) return;
          mapa[numero] = {
            status: status,
            tipo: fTipo ? String(row[fTipo - 1] || "Sem tipo").trim() : "Sem tipo"
          };
        });
      }
    }
  } catch (eF) {
    Logger.log("DASH_OFICIOS_unificarPorNumero_.fila: " + eF.message);
  }

  // Passo 3 - Consolida contagens a partir do mapa unico - 1 status por NUMERO_OFICIO.
  var resumo = { total: 0, confirmados: 0, enviados: 0, pendentes: 0, erros: 0, falhas: 0 };
  var tipos = {};
  var status = {};

  Object.keys(mapa).forEach(function(numero) {
    var item = mapa[numero];
    resumo.total++;
    tipos[item.tipo] = (tipos[item.tipo] || 0) + 1;
    status[item.status] = (status[item.status] || 0) + 1;

    if      (item.status === "CONFIRMADO")                                resumo.confirmados++;
    else if (item.status === "ENVIADO")                                   resumo.enviados++;
    else if (item.status === "PENDENTE" || item.status === "PROCESSANDO") resumo.pendentes++;
    else if (item.status === "ERRO" || item.status === "ERRO_PERMANENTE") resumo.erros++;
    else if (item.status === "FALHA_ENTREGA")                             resumo.falhas++;
    // Status desconhecido/inesperado: conta no total mas não em nenhuma
    // categoria específica. Isso evita o "ofício fantasma" onde o total
    // não batia com a soma dos status no frontend.
    // O status real fica registrado em graficos.status para diagnóstico.
  });

  resumo.taxaSucesso = resumo.total > 0
    ? Number((((resumo.enviados + resumo.confirmados) / resumo.total) * 100).toFixed(1))
    : 0;

  return { resumo: resumo, tipos: tipos, status: status };
}

function DASH_OFICIOS_resumoControle_() {
  var out = {
    total: 0, pendentes: 0, enviados: 0, confirmados: 0, erros: 0, falhas: 0,
    proximoOficio: "", ultimoOficio: ""
  };

  var ss = DASH_OFICIOS_getSS_();
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) {
    out.proximoOficio = DASH_OFICIOS_preverProximoNumero_();
    return out;
  }

  var hm = getHeaderMap_(sh);
  var colStatus = hm["Status"];
  var colNumero = hm["Número do Ofício"];
  if (!colStatus || !colNumero) return out;

  var ano = DASH_OFICIOS_anoAtual_();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var maiorNumero = 0;

  dados.forEach(function(row) {
    var numero = String(row[colNumero - 1] || "").trim();
    if (!numero) return;

    // Aceita números com /ANO; se não tiver ano, ainda conta, mas não usa para próximo número.
    var pertenceAno = numero.indexOf("/" + ano) > -1;
    var status = DASH_OFICIOS_normStatus_(row[colStatus - 1]);

    out.total++;
    if      (status === "CONFIRMADO")    out.confirmados++;
    else if (status === "ENVIADO")       out.enviados++;
    else if (status === "PENDENTE")      out.pendentes++;
    else if (status === "ERRO")          out.erros++;
    else if (status === "FALHA_ENTREGA") out.falhas++;
    else if (status)                      out.pendentes++;

    if (pertenceAno) {
      var n = parseInt(numero.split("/")[0], 10);
      if (!isNaN(n) && n > maiorNumero) maiorNumero = n;
    }
  });

  if (maiorNumero > 0) {
    out.ultimoOficio = String(maiorNumero).padStart(3, "0") + "/" + ano;
    out.proximoOficio = String(maiorNumero + 1).padStart(3, "0") + "/" + ano;
  } else {
    out.proximoOficio = DASH_OFICIOS_preverProximoNumero_();
  }

  return out;
}

function DASH_OFICIOS_resumoFila_() {
  var out = {
    total: 0, pendentes: 0, processando: 0, enviados: 0, confirmados: 0,
    erros: 0, falhas: 0, taxaSucesso: 0, taxaErro: 0
  };

  var ss = DASH_OFICIOS_getSS_();
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return out;

  var hm = getHeaderMap_(sh);
  var colStatus = hm["STATUS"];
  if (!colStatus) return out;

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  dados.forEach(function(row) {
    var s = DASH_OFICIOS_normStatus_(row[colStatus - 1]);
    if (!s) return;
    out.total++;
    if      (s === "PENDENTE")          out.pendentes++;
    else if (s === "PROCESSANDO")       out.processando++;
    else if (s === "ENVIADO")           out.enviados++;
    else if (s === "CONFIRMADO")        out.confirmados++;
    else if (s === "FALHA_ENTREGA")     out.falhas++;
    else if (s === "ERRO" || s === "ERRO_PERMANENTE") out.erros++;
  });

  out.taxaSucesso = out.total > 0 ? Number((((out.enviados + out.confirmados) / out.total) * 100).toFixed(1)) : 0;
  out.taxaErro    = out.total > 0 ? Number((((out.erros + out.falhas) / out.total) * 100).toFixed(1)) : 0;
  return out;
}

function DASH_OFICIOS_graficos_() {
  // NOTA (correção duplicação - 17/06/2026, versão definitiva):
  // Antes esta função lia só FILA_ENVIO_OFICIOS para evitar duplicação com o
  // Controle. Porém o usuário confirmou que os ofícios 045/2026 a 118/2026
  // existem APENAS no Controle (nunca passaram pela Fila), então usar só a
  // Fila sub-contava "Ofícios por área" e os status. Agora os tipos/status
  // vêm da mesma fonte unificada (dedup por NUMERO_OFICIO) usada no resumo
  // dos KPIs, garantindo consistência entre todos os blocos do Dashboard.
  var unificado = DASH_OFICIOS_unificarPorNumero_();
  return { tipos: unificado.tipos, status: unificado.status };
}

function DASH_OFICIOS_errosRecentesFila_() {
  var ss = DASH_OFICIOS_getSS_();
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cEscola = hm["ESCOLA"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cErro = hm["ULTIMO_ERRO"];
  var cTentativas = hm["TENTATIVAS"];
  var cData = hm["DATA_ULTIMA_TENTATIVA"] || hm["DATA_CRIACAO"];
  if (!cStatus) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var erros = [];

  for (var i = dados.length - 1; i >= 0; i--) {
    var row = dados[i];
    var s = DASH_OFICIOS_normStatus_(row[cStatus - 1]);
    if (s !== "ERRO" && s !== "ERRO_PERMANENTE" && s !== "FALHA_ENTREGA") continue;

    var dataVal = cData ? row[cData - 1] : "";
    erros.push({
      escola: cEscola ? String(row[cEscola - 1] || "") : "—",
      numero: cNumero ? String(row[cNumero - 1] || "") : "—",
      erro: cErro ? String(row[cErro - 1] || "") : "",
      tentativas: cTentativas ? (parseInt(row[cTentativas - 1], 10) || 0) : 0,
      permanente: s === "ERRO_PERMANENTE" || s === "FALHA_ENTREGA",
      dataFormatada: dataVal instanceof Date
        ? Utilities.formatDate(dataVal, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : String(dataVal || "—")
    });
    if (erros.length >= 10) break;
  }

  return erros;
}

function DASH_OFICIOS_pendenciasCriticas_() {
  var ss = DASH_OFICIOS_getSS_();
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cEscola = hm["ESCOLA"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cTipo = hm["TIPO"];
  var cTent = hm["TENTATIVAS"];
  var cData = hm["DATA_CRIACAO"];
  if (!cStatus || !cData) return [];

  var agora = new Date();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var pendencias = [];

  dados.forEach(function(row) {
    var s = DASH_OFICIOS_normStatus_(row[cStatus - 1]);
    if (s !== "PENDENTE" && s !== "PROCESSANDO" && s !== "ERRO") return;

    var dataCriacao = row[cData - 1];
    var horasAbertas = dataCriacao instanceof Date
      ? Math.floor((agora.getTime() - dataCriacao.getTime()) / 3600000)
      : 0;

    pendencias.push({
      escola: cEscola ? String(row[cEscola - 1] || "") : "—",
      numero: cNumero ? String(row[cNumero - 1] || "") : "—",
      tipo: cTipo ? String(row[cTipo - 1] || "") : "",
      status: s,
      tentativas: cTent ? (parseInt(row[cTent - 1], 10) || 0) : 0,
      dataCriacao: dataCriacao instanceof Date
        ? Utilities.formatDate(dataCriacao, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : String(dataCriacao || "—"),
      horasAbertas: horasAbertas
    });
  });

  return pendencias.sort(function(a, b) {
    if (b.horasAbertas !== a.horasAbertas) return b.horasAbertas - a.horasAbertas;
    return b.tentativas - a.tentativas;
  }).slice(0, 20);
}

function DASH_OFICIOS_montarEscolasAcompanhamento_(data) {
  var mapa = {};

  function add(nome, tipo) {
    nome = String(nome || "").trim();
    if (!nome || nome === "—") return;
    if (!mapa[nome]) mapa[nome] = { escola: nome, pendencias: 0, falhas: 0, semConfirmacao: 0 };
    mapa[nome][tipo] = (mapa[nome][tipo] || 0) + 1;
  }

  (data.pendenciasCriticas || []).forEach(function(item) { add(item.escola, "pendencias"); });
  (data.errosRecentes || []).forEach(function(item) { add(item.escola, "falhas"); });

  return Object.keys(mapa)
    .map(function(nome) { return mapa[nome]; })
    .sort(function(a, b) {
      return (b.pendencias + b.falhas + b.semConfirmacao) -
             (a.pendencias + a.falhas + a.semConfirmacao);
    })
    .slice(0, 5);
}

function DASH_OFICIOS_montarAtividadesRecentes_(data) {
  var atividades = [];
  var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  (data.errosRecentes || []).slice(0, 3).forEach(function(e) {
    atividades.push({
      icon: e.permanente ? "ti-ban" : "ti-alert-triangle",
      cor: "#dc2626",
      texto: "Falha" + (e.permanente ? " permanente" : "") + " — " + (e.escola || e.numero || "—"),
      tempo: e.dataFormatada || "—",
      tipo: "falha"
    });
  });

  (data.pendenciasCriticas || []).filter(function(p) {
    return Number(p.horasAbertas || 0) > 1;
  }).slice(0, 2).forEach(function(p) {
    atividades.push({
      icon: "ti-clock-exclamation",
      cor: "#d97706",
      texto: "Pendente há " + p.horasAbertas + "h — " + (p.escola || p.numero || "—"),
      tempo: p.dataCriacao || "—",
      tipo: "pendente"
    });
  });

  if (data.fila && data.fila.enviados > 0) {
    atividades.push({ icon: "ti-send", cor: "#002f6c", texto: data.fila.enviados + " ofício(s) enviados pela fila", tempo: agora, tipo: "enviado" });
  }

  if (data.controle && data.controle.confirmados > 0) {
    atividades.push({ icon: "ti-circle-check", cor: "#16a34a", texto: data.controle.confirmados + " ofício(s) confirmados", tempo: agora, tipo: "confirmado" });
  }

  return atividades.slice(0, 6);
}
function DASH_OFICIOS_monitoramentoAvancado_() {
  var retorno = {
    enviados: 0,
    confirmados: 0,
    visualizados: 0,
    aguardando: 0,
    aberturas: 0,
    cliques: 0,
    taxaConfirmacao: 0,
    taxaAbertura: 0,
    taxaCliques: 0
  };

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");

    if (!sh || sh.getLastRow() < 2) return retorno;

    var hm = getHeaderMap_(sh);

    var colStatus = hm["STATUS"];
    var colReceb  = hm["STATUS_RECEBIMENTO"];
    var colAbert  = hm["ABERTURAS"];
    var colCliq   = hm["CLIQUES"];

    if (!colStatus || !colReceb) return retorno;

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    dados.forEach(function(linha) {
      var status = String(linha[colStatus - 1] || "").trim().toUpperCase();
      var receb  = String(linha[colReceb - 1] || "").trim().toUpperCase();

      if (status !== "ENVIADO" && status !== "CONFIRMADO") return;

      var aberturas = colAbert ? (parseInt(linha[colAbert - 1], 10) || 0) : 0;
      var cliques   = colCliq  ? (parseInt(linha[colCliq - 1], 10) || 0) : 0;

      retorno.enviados++;
      retorno.aberturas += aberturas;
      retorno.cliques += cliques;

      if (status === "CONFIRMADO" || receb === "CONFIRMADO") {
        retorno.confirmados++;
      } else if (receb === "VISUALIZADO" || aberturas > 0) {
        retorno.visualizados++;
      } else {
        retorno.aguardando++;
      }
    });

    if (retorno.enviados > 0) {
      retorno.taxaConfirmacao = Number(((retorno.confirmados / retorno.enviados) * 100).toFixed(1));
      retorno.taxaAbertura = Number((((retorno.visualizados + retorno.confirmados) / retorno.enviados) * 100).toFixed(1));
      retorno.taxaCliques = Number(((retorno.cliques / retorno.enviados) * 100).toFixed(1));
    }

  } catch (e) {
    Logger.log("DASH_OFICIOS_monitoramentoAvancado_: " + e.message);
  }

  return retorno;
}
function DASH_OFICIOS_listaMonitoramento_() {
  var lista = [];

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");

    if (!sh || sh.getLastRow() < 2) return [];

    var hm = getHeaderMap_(sh);

    var colNumero      = hm["NUMERO_OFICIO"];
    var colEscola      = hm["ESCOLA"];
    var colEmail       = hm["EMAIL_PRINCIPAL"];
    var colStatus      = hm["STATUS"];
    var colReceb       = hm["STATUS_RECEBIMENTO"];
    var colAberturas   = hm["ABERTURAS"];
    var colCliques     = hm["CLIQUES"];
    var colDataEnvio   = hm["DATA_ENVIO"];
    var colDataConfirm = hm["DATA_CONFIRMACAO"];

    if (!colNumero || !colEscola || !colEmail || !colStatus || !colReceb) return [];

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    dados.forEach(function(linha) {
      var status = String(linha[colStatus - 1] || "").trim().toUpperCase();

      if (status !== "ENVIADO" && status !== "CONFIRMADO") return;

      var receb = String(linha[colReceb - 1] || "").trim().toUpperCase();

      if (status === "CONFIRMADO") receb = "CONFIRMADO";

      lista.push({
        numero: String(linha[colNumero - 1] || ""),
        escola: String(linha[colEscola - 1] || ""),
        email: String(linha[colEmail - 1] || ""),
        status: status,
        statusRecebimento: receb || "AGUARDANDO",
        aberturas: colAberturas ? (parseInt(linha[colAberturas - 1], 10) || 0) : 0,
        cliques: colCliques ? (parseInt(linha[colCliques - 1], 10) || 0) : 0,
        dataEnvio: DASH_OFICIOS_formatarDataSegura_(colDataEnvio ? linha[colDataEnvio - 1] : ""),
        dataConfirmacao: DASH_OFICIOS_formatarDataSegura_(colDataConfirm ? linha[colDataConfirm - 1] : "")
      });
    });

    lista.sort(function(a, b) {
      var peso = { CONFIRMADO: 1, VISUALIZADO: 2, AGUARDANDO: 3 };
      return (peso[a.statusRecebimento] || 9) - (peso[b.statusRecebimento] || 9);
    });

  } catch (e) {
    Logger.log("DASH_OFICIOS_listaMonitoramento_: " + e.message);
  }

  return lista;
}

function DASH_OFICIOS_formatarDataSegura_(valor) {
  if (!valor) return "";

  try {
    var data = valor instanceof Date ? valor : new Date(valor);

    if (!data || isNaN(data.getTime())) return "";
    if (data.getFullYear() < 2000) return "";

    return formatarDataHoraBR_(data);

  } catch (e) {
    return "";
  }
}