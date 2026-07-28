// ============================================================================
// ðŸ“„ ARQUIVO: SistemaConfig.gs
// ðŸ·ï¸  SISGEP - ConfiguraÃ§Ãµes Globais e UtilitÃ¡rios do Sistema
// ðŸ“¦  VersÃ£o: 2.1.0
// ============================================================================

var SISTEMA_NOME = "SISGEP - Sistema de GestÃ£o de Processos do SindEducaÃ§Ã£o-ES";
var SISTEMA_VERSAO = "2.1.0";
var SISTEMA_VERSAO_DESC = "Estrutura Organizacional Profissional 2026";
var SISTEMA_URL_BASE = null;

var AMBIENTE_CONFIG = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
  ? AMBIENTE_CONFIG
  : {
      PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE",
      PADRAO: "producao"
    };

function getSistemaUrlBase() {
  if (!SISTEMA_URL_BASE) {
    SISTEMA_URL_BASE = ScriptApp.getService().getUrl();
  }
  return SISTEMA_URL_BASE;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ—„ï¸ PLANILHAS (Google Sheets)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var PLANILHAS_PADRAO = {
  PRODUCAO: "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E",
  HOMOLOGACAO: "1ZRjyxKew4YJxEuMejNqfORfHw58Lg3UWii73UHiAS8c",
  CONTATOS: "1IT02LHH8tO3A-RZW6Pu-tIWASawdxIAJgV9UwEaOOx0",
  ABAS: {
    REGISTRO: "Controle",
    ESCOLAS: "Escolas",
    USUARIOS: "USUARIO",
    RECIBO_PROCESSOS: "Recibo_Processos",
    RECIBO_BENEFICIARIOS: "Recibo_Beneficiarios",
    PRESTADORES_SERVICOS: "Prestadores_Servicos"
  }
};

var PLANILHAS = (typeof PLANILHAS === "object" && PLANILHAS && PLANILHAS.PRODUCAO)
  ? PLANILHAS
  : PLANILHAS_PADRAO;

function getPlanilhaId(ambiente) {
  var cfgPlanilhas = getPlanilhasConfig_();
  var env = (ambiente || getAmbienteAtual()).toLowerCase();
  if (env === "homologacao") return cfgPlanilhas.HOMOLOGACAO;
  return cfgPlanilhas.PRODUCAO;
}

function getNomeAba(chave) {
  var cfgPlanilhas = getPlanilhasConfig_();
  return cfgPlanilhas.ABAS[String(chave || "").toUpperCase()] || null;
}

function getPlanilhasConfig_() {
  var fallback = {
    PRODUCAO: "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E",
    HOMOLOGACAO: "1ZRjyxKew4YJxEuMejNqfORfHw58Lg3UWii73UHiAS8c",
    CONTATOS: "1IT02LHH8tO3A-RZW6Pu-tIWASawdxIAJgV9UwEaOOx0",
    ABAS: {
      REGISTRO: "Controle",
      ESCOLAS: "Escolas",
      USUARIOS: "USUARIO",
      RECIBO_PROCESSOS: "Recibo_Processos",
      RECIBO_BENEFICIARIOS: "Recibo_Beneficiarios",
      PRESTADORES_SERVICOS: "Prestadores_Servicos"
    }
  };
  var cfg = (typeof PLANILHAS === "object" && PLANILHAS) ? PLANILHAS : {};
  cfg.PRODUCAO = cfg.PRODUCAO || fallback.PRODUCAO;
  cfg.HOMOLOGACAO = cfg.HOMOLOGACAO || fallback.HOMOLOGACAO;
  cfg.CONTATOS = cfg.CONTATOS || fallback.CONTATOS;
  cfg.ABAS = cfg.ABAS || {};
  Object.keys(fallback.ABAS).forEach(function(k) {
    cfg.ABAS[k] = cfg.ABAS[k] || fallback.ABAS[k];
  });
  return cfg;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“„ TEMPLATES (Google Docs)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var TEMPLATES = {
  FILIACAO: "1TzI9RheOqO1tnsq9hDwrIFxHv3CB9jGpA3EpMhWKKRM",
  DESFILIACAO: "1T9vo_-4zB-j5uShElpCZqcKzmVqSGp10OsJyr6T4rUE",
  TAXA: "1flP0xsAaTjhACQWzlroM8RGmRtsMHCORmXU27J39AAA",
  RECIBO: "1sfpKSySoY1kRWSIuVh819Qqjb7c1o_LepVSs2Cdtcuo",
  LIVRE: "11W2FEgT4gPkCxkuQnhkbJpKd2NFIX_XI",
  TAXA_ASSISTENCIAL: "1Awpat0OhOSadMYni7696JVLGXU40dP6mCwBpWXoqJgs",
  OFICIO_PADRAO: "1SjHBuVZvy3xJXsfKxwuakKTZeFd_k46NMRKaV0BPDIM"
};

function getTemplateId(tipo) {
  var chave = String(tipo || "").toLowerCase().trim();
  var map = {
    recibo: TEMPLATES.RECIBO,
    filiacao: TEMPLATES.FILIACAO,
    desfiliacao: TEMPLATES.DESFILIACAO,
    taxa: TEMPLATES.TAXA,
    livre: TEMPLATES.LIVRE,
    taxa_assistencial: TEMPLATES.TAXA_ASSISTENCIAL,
    oficio: TEMPLATES.OFICIO_PADRAO
  };
  return map[chave] || null;
}

function getTiposTemplatesDisponiveis() {
  return ["recibo","filiacao","desfiliacao","taxa","livre","taxa_assistencial","oficio"];
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“ PASTAS (Google Drive)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var PASTAS = {
  OFICIOS:                   "1_0BS8UuPmuhbKycdLy7_M4HhHKMkpu4h",
  OFICIOS_DESFILIACAO:       "16pfKB3vxz33QRJooUGW79Ei-D3eInSyd",
  OFICIOS_TAXA_ASSISTENCIAL: "1__l7hUe3g3l6iBNvPBKJUR3eR5Kqjs93",
  OFICIOS_TAXA_NEGOCIAL:     "1OcrxiWCGErvYHLaevNTov1aaavLuI3gX",
  RECIBOS:    "1gudfaRCd3LxScSsqbF1kJXeI796LHr9b",
  RELATORIOS: "14_ea7nIXNSrMuKe8bByZ5AaEKXbUzJZr"
};

function getPastaId(tipo) {
  var chave = String(tipo || "").toLowerCase().trim();
  var map = {
    oficios:                   PASTAS.OFICIOS,
    oficios_desfiliacao:       PASTAS.OFICIOS_DESFILIACAO,
    oficios_taxa_assistencial: PASTAS.OFICIOS_TAXA_ASSISTENCIAL,
    oficios_taxa_negocial:     PASTAS.OFICIOS_TAXA_NEGOCIAL,
    recibos:                   PASTAS.RECIBOS,
    relatorios:                PASTAS.RELATORIOS
  };
  return map[chave] || null;
}

function isPastaConfigurada(tipo) {
  var id = getPastaId(tipo);
  return !!(id && id.length >= 33 && String(id).indexOf("COLE_AQUI") === -1);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ” CONTROLE DE ACESSO E SEGURANÃ‡A
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var SEGURANCA = {
  USUARIOS_AUTORIZADOS: [
    "financeiro@sindeducacao.com",
    "secretaria@sindeducacao.com",
        "financeirosindecucacao@gmail.com"
  ],
  TOKEN_EXPIRACAO_MINUTOS: 30,
  MAX_TENTATIVAS_LOGIN: 5,
  BLOQUEIO_APOS_FALHAS_MINUTOS: 15
};

function usuarioAutorizado(email) {
  if (!email || typeof email !== "string") return false;
  var emailNormalizado = email.trim().toLowerCase();
  return SEGURANCA.USUARIOS_AUTORIZADOS.some(function(e) {
    return String(e || "").trim().toLowerCase() === emailNormalizado;
  });
}

function getUsuariosAutorizados() {
  return SEGURANCA.USUARIOS_AUTORIZADOS.slice();
}

function obterEmailUsuarioAtual() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) email = Session.getEffectiveUser().getEmail();
    return email ? email.trim().toLowerCase() : null;
  } catch (e) {
    Logger.log("NÃ£o foi possÃ­vel obter e-mail do usuÃ¡rio: " + e.message);
    try { return Session.getEffectiveUser().getEmail() || null; } catch(e2) { return null; }
  }
}

// Alias com underscore para compatibilidade com outros mÃ³dulos
function obterEmailUsuarioAtual_() {
  return obterEmailUsuarioAtual();
}

function usuarioEstaLogadoEAutorizado() {
  var email = obterEmailUsuarioAtual();
  return !!(email && usuarioAutorizado(email));
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“ REGRAS DE NEGÃ“CIO E LIMITES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var REGRAS_NEGOCIO = {
  LIMITE_ASSOCIADOS_POR_LOTE: 25,
  VALOR_MINIMO_RECIBO_CENTAVOS: 100,
  CPF_TAMANHO_FORMATADO: 14,
  CNPJ_TAMANHO_FORMATADO: 18,
  MAX_UPLOADS_SIMULTANEOS: 3,
  MAX_TAMANHO_ARQUIVO_MB: 10
};

function dentroDoLimite(quantidade, tipo) {
  if (typeof quantidade !== "number" || quantidade < 0) return false;
  switch (String(tipo || "").toLowerCase()) {
    case "associados": return quantidade <= REGRAS_NEGOCIO.LIMITE_ASSOCIADOS_POR_LOTE;
    case "uploads":    return quantidade <= REGRAS_NEGOCIO.MAX_UPLOADS_SIMULTANEOS;
    default:           return false;
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“Š STATUS E ENUMS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var STATUS = {
  SINCRO_ESCOLA: {
    OK: "ATUALIZADA",
    DIVERGENTE: "DIVERGENTE",
    NOVA: "NOVA",
    SEM_ALTERACAO: "SEM ALTERAÃ‡ÃƒO"
  },
  ASSINATURA_RECIBO: {
    PENDENTE: "PENDENTE_ASSINATURA",
    ENVIADO: "ENVIADO_PARA_ASSINATURA",
    ASSINADO: "ASSINADO_RECEBIDO",
    RECUSADO: "RECUSADO"
  },
  ENVIO_EMAIL: {
    PENDENTE: "PENDENTE",
    ENVIADO: "ENVIADO_COM_SUCESSO",
    FALHA: "FALHA_NO_ENVIO",
    REENVIADO: "REENVIADO"
  }
};

function getValoresStatus(categoria) {
  var chave = String(categoria || "").toLowerCase();
  var map = {
    sincro_escola:     STATUS.SINCRO_ESCOLA,
    assinatura_recibo: STATUS.ASSINATURA_RECIBO,
    envio_email:       STATUS.ENVIO_EMAIL
  };
  var enumObj = map[chave];
  if (!enumObj) return [];
  return Object.values(enumObj).filter(function(v) { return typeof v === "string"; });
}

function statusEhValido(categoria, valor) {
  return getValoresStatus(categoria).indexOf(String(valor || "").trim().toUpperCase()) > -1;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸŒ GERENCIAMENTO DE AMBIENTE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var AMBIENTE_CONFIG = {
  PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE",
  PADRAO: "producao"
};

function getAmbienteAtual(forcarLeitura) {
  if (!forcarLeitura && typeof getAmbienteAtual._cache === "string") {
    return getAmbienteAtual._cache;
  }
  var cfgAmbiente = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
    ? AMBIENTE_CONFIG
    : { PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE", PADRAO: "producao" };
  try {
    var props = PropertiesService.getScriptProperties();
    var ambiente = props.getProperty(cfgAmbiente.PROPRIEDADE_CHAVE);
    var resultado = ambiente === "homologacao" ? "homologacao" : "producao";
    getAmbienteAtual._cache = resultado;
    return resultado;
  } catch (e) {
    Logger.log("Erro ao ler ambiente: " + e.message);
    return cfgAmbiente.PADRAO || "producao";
  }
}

function definirAmbiente(ambiente) {
  try {
    if (!usuarioEstaLogadoEAutorizado()) {
      return { ok: false, mensagem: "Acesso nÃ£o autorizado para alterar ambiente." };
    }
    var env = String(ambiente || "").trim().toLowerCase();
    if (env !== "producao" && env !== "homologacao") {
      return { ok: false, mensagem: "Ambiente invÃ¡lido. Use 'producao' ou 'homologacao'." };
    }
    var cfgAmbiente = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
      ? AMBIENTE_CONFIG
      : { PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE", PADRAO: "producao" };
    var props = PropertiesService.getScriptProperties();
    props.setProperty(cfgAmbiente.PROPRIEDADE_CHAVE, env);
    delete getAmbienteAtual._cache;
    logSistema("INFO", "Ambiente", "Ambiente alterado para: " + env, { usuario: obterEmailUsuarioAtual() });
    return { ok: true, mensagem: "Ambiente definido como: " + env };
  } catch (e) {
    logSistema("ERROR", "Ambiente", "Falha ao definir ambiente: " + e.message);
    return { ok: false, mensagem: "Erro interno: " + e.message };
  }
}

function getInfoAmbiente() {
  var ambiente = getAmbienteAtual();
  return {
    idPlanilha:      getPlanilhaId(ambiente),
    nomeAmbiente:    ambiente.toUpperCase(),
    isProducao:      ambiente === "producao",
    urlBase:         getSistemaUrlBase(),
    versao:          SISTEMA_VERSAO,
    dataAtualizacao: new Date().toISOString()
  };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“ SISTEMA DE LOGS PADRONIZADO
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var LOG_CONFIG = {
  ENABLED: true,
  NIVEL_MINIMO: "INFO",
  MAX_ENTRIES_MEMORIA: 100,
  RETENCAO_DIAS: 30,
  LOG_EM_PLANILHA: false,
  PLANILHA_LOGS_ID: null
};

var LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

var _logBuffer = [];

function logSistema(nivel, modulo, mensagem, dados) {
  if (!LOG_CONFIG.ENABLED) return false;
  nivel = String(nivel || "INFO").toUpperCase().trim();
  if (!(nivel in LOG_LEVELS)) { nivel = "INFO"; }
  if (LOG_LEVELS[nivel] < LOG_LEVELS[LOG_CONFIG.NIVEL_MINIMO]) return false;
  var tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  var timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");
  var entry = {
    timestamp: timestamp,
    nivel:     nivel,
    modulo:    String(modulo || "Sistema").trim(),
    mensagem:  String(mensagem || "").trim(),
    dados:     dados || null,
    usuario:   obterEmailUsuarioAtual(),
    ambiente:  getAmbienteAtual()
  };
  var logMsg = "[" + entry.timestamp + "] [" + entry.nivel + "] [" + entry.modulo + "] " + entry.mensagem;
  if (entry.dados && Object.keys(entry.dados).length > 0) {
    try { logMsg += " | Dados: " + JSON.stringify(entry.dados); } catch (e) { logMsg += " | Dados: [nÃ£o serializÃ¡vel]"; }
  }
  Logger.log(logMsg);
  _logBuffer.push(entry);
  if (_logBuffer.length > LOG_CONFIG.MAX_ENTRIES_MEMORIA) _logBuffer.shift();
  if (nivel === "ERROR") _notificarErroCritico(entry);
  return true;
}

function getLogsRecentes(filtros) {
  filtros = filtros || {};
  var resultados = _logBuffer.slice();
  if (filtros.nivel)  resultados = resultados.filter(function(e){ return e.nivel === String(filtros.nivel).toUpperCase(); });
  if (filtros.modulo) resultados = resultados.filter(function(e){ return e.modulo.toLowerCase().indexOf(String(filtros.modulo).toLowerCase()) > -1; });
  if (filtros.desde)  resultados = resultados.filter(function(e){ return new Date(e.timestamp) >= new Date(filtros.desde); });
  return resultados.reverse();
}

function limparLogsMemoria(confirmacao) {
  if (!confirmacao) { logSistema("WARN", "Logs", "Tentativa de limpar logs sem confirmaÃ§Ã£o"); return false; }
  var qtdAntes = _logBuffer.length;
  _logBuffer = [];
  logSistema("INFO", "Logs", "Buffer de logs limpo", { entradasRemovidas: qtdAntes, usuario: obterEmailUsuarioAtual() });
  return true;
}

function _notificarErroCritico(entry) {
  Logger.log("ERRO CRÃTICO DETECTADO: " + entry.mensagem);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ”§ UTILITÃRIOS GERAIS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function validarConfiguracoes() {
  var resultado = { ok: true, faltantes: [], avisos: [] };
  if (!getPlanilhaId("producao") || getPlanilhaId("producao").length < 33) {
    resultado.faltantes.push("PLANILHAS.PRODUCAO"); resultado.ok = false;
  }
  ["RECIBO", "OFICIO_PADRAO"].forEach(function(key) {
    if (!TEMPLATES[key] || TEMPLATES[key].length < 33) {
      resultado.faltantes.push("TEMPLATES." + key); resultado.ok = false;
    }
  });
  if (!isPastaConfigurada("recibos")) resultado.avisos.push("Pasta de recibos nÃ£o configurada corretamente");
  if (SEGURANCA.USUARIOS_AUTORIZADOS.length === 0) {
    resultado.faltantes.push("SEGURANCA.USUARIOS_AUTORIZADOS (lista vazia)"); resultado.ok = false;
  }
  if (resultado.ok) logSistema("INFO", "Config", "ValidaÃ§Ã£o de configuraÃ§Ãµes: OK");
  else logSistema("ERROR", "Config", "ValidaÃ§Ã£o de configuraÃ§Ãµes: FALHA", { faltantes: resultado.faltantes, avisos: resultado.avisos });
  return resultado;
}

function getConfigPublica() {
  return {
    sistema: { nome: SISTEMA_NOME, versao: SISTEMA_VERSAO, versaoDesc: SISTEMA_VERSAO_DESC },
    regras: {
      limiteAssociados:    REGRAS_NEGOCIO.LIMITE_ASSOCIADOS_POR_LOTE,
      valorMinimoRecibo:   REGRAS_NEGOCIO.VALOR_MINIMO_RECIBO_CENTAVOS / 100,
      maxTamanhoArquivoMB: REGRAS_NEGOCIO.MAX_TAMANHO_ARQUIVO_MB
    },
    status:  { assinaturaRecibo: STATUS.ASSINATURA_RECIBO, syncEscola: STATUS.SINCRO_ESCOLA },
    ambiente: { nome: getAmbienteAtual(), isProducao: getAmbienteAtual() === "producao" }
  };
}

function inicializarConfig() {
  try {
    logSistema("INFO", "Config", "Inicializando mÃ³dulo de configuraÃ§Ãµes...");
    var validacao = validarConfiguracoes();
    if (!validacao.ok) {
      logSistema("ERROR", "Config", "ConfiguraÃ§Ãµes invÃ¡lidas", validacao);
      return { ok: false, mensagem: "ConfiguraÃ§Ãµes do sistema invÃ¡lidas. Verifique os logs.", detalhes: validacao };
    }
    getSistemaUrlBase();
    logSistema("INFO", "Config", "MÃ³dulo inicializado com sucesso", { ambiente: getAmbienteAtual(), urlBase: SISTEMA_URL_BASE });
    return { ok: true, mensagem: "ConfiguraÃ§Ãµes carregadas com sucesso" };
  } catch (e) {
    logSistema("ERROR", "Config", "Falha na inicializaÃ§Ã£o: " + e.message);
    return { ok: false, mensagem: "Erro ao inicializar configuraÃ§Ãµes: " + e.message };
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸš€ AUTO-EXECUÃ‡ÃƒO
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function onInstall() { onStartup(); }

function onStartup() {
  var props = PropertiesService.getScriptProperties();
  var cfgAmbiente = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
    ? AMBIENTE_CONFIG
    : { PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE", PADRAO: "producao" };
  if (!props.getProperty(cfgAmbiente.PROPRIEDADE_CHAVE)) {
    props.setProperty(cfgAmbiente.PROPRIEDADE_CHAVE, cfgAmbiente.PADRAO || "producao");
    Logger.log("Ambiente padrao definido como: " + (cfgAmbiente.PADRAO || "producao"));
  }
  validarConfiguracoes();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ”— CONSTANTES DE COMPATIBILIDADE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ Planilha ativa â”€â”€
var PLANILHA_ID = getPlanilhaId();

// â”€â”€ Abas â”€â”€
var ABA_RECIBO_PROCESSOS     = getNomeAba("RECIBO_PROCESSOS");
var ABA_RECIBO_BENEFICIARIOS = getNomeAba("RECIBO_BENEFICIARIOS");
var ABA_USUARIOS_LOGIN       = getNomeAba("USUARIOS");
var PLANILHA_REGISTRO        = getNomeAba("REGISTRO");
var PLANILHA_ESCOLAS         = getNomeAba("ESCOLAS");

// â”€â”€ Templates â”€â”€
var TEMPLATE_RECIBO_ID            = TEMPLATES.RECIBO;
var TEMPLATE_FILIACAO_ID          = TEMPLATES.FILIACAO;
var TEMPLATE_DESFILIACAO_ID       = TEMPLATES.DESFILIACAO;
var TEMPLATE_TAXA_ID              = TEMPLATES.TAXA;
var TEMPLATE_TAXA_ASSISTENCIAL_ID = TEMPLATES.TAXA_ASSISTENCIAL;
var TEMPLATE_OFICIO_PADRAO_ID     = TEMPLATES.OFICIO_PADRAO;
var TEMPLATE_LIVRE_ID             = TEMPLATES.LIVRE;

// â”€â”€ Pastas â”€â”€
var PASTA_RECIBO_ID                    = PASTAS.RECIBOS;
var PASTA_OFICIOS_ID                   = PASTAS.OFICIOS;
var PASTA_OFICIOS_DESFILIACAO_ID       = PASTAS.OFICIOS_DESFILIACAO;
var PASTA_OFICIOS_TAXA_ASSISTENCIAL_ID = PASTAS.OFICIOS_TAXA_ASSISTENCIAL;
var PASTA_OFICIOS_TAXA_NEGOCIAL_ID     = PASTAS.OFICIOS_TAXA_NEGOCIAL;
var PASTA_RELATORIOS_ID                = PASTAS.RELATORIOS;

// â”€â”€ Regras de negÃ³cio â”€â”€
var LIMITE_ASSOCIADOS = REGRAS_NEGOCIO.LIMITE_ASSOCIADOS_POR_LOTE;

// â”€â”€ Login / SeguranÃ§a â”€â”€
var LOGIN_CONFIG = {
  PRIMEIRA_SENHA_PADRAO:   "123456",
  SENHA_MIN_CARACTERES:    8,
  MAX_TENTATIVAS:          SEGURANCA.MAX_TENTATIVAS_LOGIN,
  BLOQUEIO_MINUTOS:        SEGURANCA.BLOQUEIO_APOS_FALHAS_MINUTOS,
  TOKEN_EXPIRACAO_MINUTOS: SEGURANCA.TOKEN_EXPIRACAO_MINUTOS
};

// â”€â”€ Status padrÃ£o â”€â”€
var STATUS_ATIVO   = "ATIVO";
var STATUS_INATIVO = "INATIVO";

// â”€â”€ FunÃ§Ã£o auxiliar global â”€â”€
function getConfigSistemaCompleta() {
  return {
    sistema:  { nome: SISTEMA_NOME, versao: SISTEMA_VERSAO, descricao: SISTEMA_VERSAO_DESC },
    ambiente: { atual: getAmbienteAtual(), planilhaId: PLANILHA_ID, urlBase: getSistemaUrlBase() },
    seguranca: LOGIN_CONFIG,
    templates: {
      recibo: TEMPLATE_RECIBO_ID, filiacao: TEMPLATE_FILIACAO_ID,
      desfiliacao: TEMPLATE_DESFILIACAO_ID, taxa: TEMPLATE_TAXA_ID,
      taxaAssistencial: TEMPLATE_TAXA_ASSISTENCIAL_ID,
      oficio: TEMPLATE_OFICIO_PADRAO_ID, livre: TEMPLATE_LIVRE_ID
    },
    pastas: {
      recibos:                PASTA_RECIBO_ID,
      oficios:                PASTA_OFICIOS_ID,
      oficiosDesfiliacao:     PASTA_OFICIOS_DESFILIACAO_ID,
      oficiosTaxaAssistencial:PASTA_OFICIOS_TAXA_ASSISTENCIAL_ID,
      oficiosTaxaNegocial:    PASTA_OFICIOS_TAXA_NEGOCIAL_ID,
      relatorios:             PASTA_RELATORIOS_ID
    },
    abas: {
      usuarios:      ABA_USUARIOS_LOGIN,
      processos:     ABA_RECIBO_PROCESSOS,
      beneficiarios: ABA_RECIBO_BENEFICIARIOS,
      escolas:       PLANILHA_ESCOLAS,
      controle:      PLANILHA_REGISTRO
    }
  };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ”„ FUNÃ‡Ã•ES DE ALTERNÃ‚NCIA DE AMBIENTE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ativarHomologacao() {
  var props = PropertiesService.getScriptProperties();
  var cfgAmbiente = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
    ? AMBIENTE_CONFIG
    : { PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE", PADRAO: "producao" };
  props.setProperty(cfgAmbiente.PROPRIEDADE_CHAVE, "homologacao");
  delete getAmbienteAtual._cache;
  Logger.log("Ambiente definido como: homologacao");
  Logger.log("Planilha ativa: " + getPlanilhaId());
}

function ativarProducao() {
  var props = PropertiesService.getScriptProperties();
  var cfgAmbiente = (typeof AMBIENTE_CONFIG === "object" && AMBIENTE_CONFIG)
    ? AMBIENTE_CONFIG
    : { PROPRIEDADE_CHAVE: "SISGEP_AMBIENTE", PADRAO: "producao" };
  props.setProperty(cfgAmbiente.PROPRIEDADE_CHAVE, "producao");
  delete getAmbienteAtual._cache;
  Logger.log("Ambiente definido como: producao");
  Logger.log("Planilha ativa: " + getPlanilhaId());
}

function verificarAmbiente() {
  var info = getInfoAmbiente();
  Logger.log("Ambiente: " + info.nomeAmbiente);
  Logger.log("Planilha: " + info.idPlanilha);
  Logger.log("VersÃ£o: "   + info.versao);
  Logger.log("URL: "      + info.urlBase);
}

function copiarUsuariosParaHomologacao() {
  var ssProducao    = SpreadsheetApp.openById("1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E");
  var ssHomologacao = SpreadsheetApp.openById("1ZRjyxKew4YJxEuMejNqfORfHw58Lg3UWii73UHiAS8c");
  var abaOrigem = ssProducao.getSheetByName("USUARIO");
  if (!abaOrigem) { Logger.log("Aba USUARIO nÃ£o encontrada na produÃ§Ã£o."); return; }
  var abaDestino = ssHomologacao.getSheetByName("USUARIO");
  if (abaDestino) ssHomologacao.deleteSheet(abaDestino);
  abaOrigem.copyTo(ssHomologacao).setName("USUARIO");
  Logger.log("Aba USUARIO copiada com sucesso para homologaÃ§Ã£o!");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ“Œ INICIALIZAÃ‡ÃƒO GLOBAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function inicializacaoGlobalSistema() {
  try {
    Logger.log("[SistemaConfig] v" + SISTEMA_VERSAO + " carregado.");
  } catch (e) {
    Logger.log("Erro ao inicializar SistemaConfig: " + e.message);
  }
})();
