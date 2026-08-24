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

/**
 * A base de todo link que o sistema manda para fora.
 *
 * `ScriptApp.getService().getUrl()` devolve coisas DIFERENTES conforme quem
 * chama: `/exec` quando a chamada parte do web app publicado, e `/dev` quando
 * parte do editor. E `/dev` só abre para quem tem acesso de EDIÇÃO ao script —
 * para o associado é erro de permissão.
 *
 * Isso vazou para dentro de um e-mail em 21/08/2026: o piloto do Compasso,
 * rodado pelo editor, mandou o ingresso com o botão apontando para `/dev`.
 * Para o dono do projeto abriu normalmente; para qualquer outra pessoa seria
 * uma porta fechada — e o pior tipo de defeito, porque quem envia não vê.
 *
 * Por isso a propriedade `SISGEP_URL_BASE` tem precedência: declare nela a
 * URL `/exec` da implantação, e todo link nasce certo, inclusive o gerado por
 * rotina que roda no editor ou por trigger. Sem a propriedade, o
 * comportamento é exatamente o de antes.
 */
function getSistemaUrlBase() {
  if (!SISTEMA_URL_BASE) {
    var declarada = '';
    try {
      declarada = String(PropertiesService.getScriptProperties()
        .getProperty('SISGEP_URL_BASE') || '').trim();
    } catch (e) {}
    SISTEMA_URL_BASE = declarada || ScriptApp.getService().getUrl();
  }
  return SISTEMA_URL_BASE;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ðŸ—„ï¸ PLANILHAS (Google Sheets)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var PLANILHAS_PADRAO = {
  PRODUCAO: "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E",
  HOMOLOGACAO: "1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk",
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
    HOMOLOGACAO: "1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk",
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
  OFICIOS_HOMOLOGACAO:       "1AHzDV6m8C0-5RDK9_xcm-eT0VdVjzTs-",
  OFICIOS_LIVRE:             "1MToLVFg_TmRH5DfvnlKIVPwmbmUOYTYn",
  OFICIOS_DESFILIACAO:       "16pfKB3vxz33QRJooUGW79Ei-D3eInSyd",
  OFICIOS_TAXA_ASSISTENCIAL: "1__l7hUe3g3l6iBNvPBKJUR3eR5Kqjs93",
  OFICIOS_TAXA_NEGOCIAL:     "1OcrxiWCGErvYHLaevNTov1aaavLuI3gX",
  /* ID TROCADO EM 21/08/2026. O anterior — 1gudfaRCd3LxScSsqbF1kJXeI796LHr9b —
     NAO EXISTE. Descoberto pela auditoria de arquivos publicos: a pasta de
     RECIBOS voltou com TOTAL 0 e ERRO 1, e o DriveApp respondeu "Requested
     entity was not found" tanto para o script de producao quanto para acesso
     externo. Nao era permissao — a pasta nao estava la.

     Consequencia que ninguem tinha visto: gerarPDFRecibo chama
     obterOuCriarSubpastaAno com este id e estoura. Emitir recibo em producao
     falharia. Passou despercebido porque Recibos nao esta em operacao. */
  RECIBOS:    "12qepZmMbx343pI4qoulNh5Mk3uUztz1Y",
  RELATORIOS: "14_ea7nIXNSrMuKe8bByZ5AaEKXbUzJZr"
};

function getPastaId(tipo) {
  var chave = String(tipo || "").toLowerCase().trim();
  var map = {
    oficios:                   PASTAS.OFICIOS,
    oficios_homologacao:       PASTAS.OFICIOS_HOMOLOGACAO,
    oficios_livre:             PASTAS.OFICIOS_LIVRE,
    oficios_desfiliacao:       PASTAS.OFICIOS_DESFILIACAO,
    oficios_taxa_assistencial: PASTAS.OFICIOS_TAXA_ASSISTENCIAL,
    oficios_taxa_negocial:     PASTAS.OFICIOS_TAXA_NEGOCIAL,
    recibos:                   PASTAS.RECIBOS,
    relatorios:                PASTAS.RELATORIOS
  };
  return map[chave] || null;
}

function getPastaOficiosDestinoId_(tipoNorm) {
  if (typeof getAmbienteAtual === "function" && getAmbienteAtual() === "homologacao") {
    return PASTAS.OFICIOS_HOMOLOGACAO;
  }
  var mapa = {
    "FILIACAO":                 PASTAS.OFICIOS,
    "DESFILIACAO":              PASTAS.OFICIOS_DESFILIACAO,
    "TAXA_NEGOCIAL":            PASTAS.OFICIOS_TAXA_NEGOCIAL,
    "OPOSICAO_TAXA_NEGOCIAL":   PASTAS.OFICIOS_TAXA_NEGOCIAL,
    "TAXA_ASSISTENCIAL":        PASTAS.OFICIOS_TAXA_ASSISTENCIAL,
    "OFICIO_LIVRE":             PASTAS.OFICIOS_LIVRE
  };
  return mapa[String(tipoNorm || "").toUpperCase()] || PASTAS.OFICIOS;
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
  /* 50 desde 18/08/2026, por decisão do usuário ("Até 50"), para os ofícios
     que levam lista nominal de trabalhadores. Era 25.
     ATENÇÃO: em filiação e desfiliação cada pessoa leva uma ficha anexada ao
     mesmo e-mail. 50 anexos podem estourar o limite de tamanho da mensagem —
     ver o aviso registrado em Oficios.gs. */
  LIMITE_ASSOCIADOS_POR_LOTE: 50,
  /* Teto de exclusao em lote — pedido do usuario em 20/08/2026, ao decidir
     sobre excluirEscolasEmLote, que podia mandar centenas de escolas de uma
     vez. Acima do teto a operacao RECUSA e diz quantas foram pedidas: nao
     corta em silencio. Ver Lixeira.gs. */
  LIMITE_EXCLUSAO_POR_LOTE: 50,
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

/**
 * Os quatro indicadores do topo de Configurações, verificados de verdade.
 *
 * POR QUE ESTA FUNÇÃO EXISTE (2026-08-06)
 * A tela chamava getConfigPublica() e lia campos que aquele retorno não tem:
 *
 *   r.ambiente   → é um OBJETO {nome, isProducao}. Jogado em textContent,
 *                  virava a palavra "[object Object]" na tela.
 *   r.planilhaId → não existe no retorno. Caía no fallback e escrevia
 *                  "Configurada" SEM VERIFICAR NADA. Era o pior dos quatro:
 *                  dava garantia falsa. A planilha podia estar inacessível e
 *                  o painel afirmava que estava certa.
 *   r.versao     → está em r.sistema.versao. Caía no fallback "SISGEP",
 *                  então a versão 2.1.0 nunca chegou à tela.
 *   usuário      → texto fixo "Administrador" escrito no HTML. Mostrava isso
 *                  para qualquer pessoa logada, inclusive quem não é admin.
 *
 * Aqui cada campo é apurado e devolvido plano — string, não objeto. A
 * planilha é ABERTA para responder; se não abrir, o retorno diz que não
 * abriu, em vez de dizer "Configurada".
 */
function getConfigPainel(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);

  var ambiente = "producao";
  try { ambiente = getAmbienteAtual(); } catch (e) {}

  // Verificação real: abrir a planilha. "Configurada" sem abrir é chute.
  var planilha = { ok: false, texto: "Não foi possível verificar", id: "" };
  try {
    var ss = planilhaSisgep_();
    var id = ss.getId();
    planilha = {
      ok: true,
      // Só o final do ID: identifica qual é sem expor a chave inteira numa
      // tela que fica aberta na mesa de todo mundo.
      texto: ss.getName() + " (…" + id.slice(-6) + ")",
      id: "…" + id.slice(-6)
    };
  } catch (e) {
    planilha.texto = "Falhou ao abrir: " + e.message;
  }

  // O perfil já vem na sessão como texto. Não existe sessao.administrador —
  // a checagem de admin em todo o projeto é feita pela normalização abaixo
  // (Sessao.gs:395-401). Ler um campo que não existe daria "Usuário" para
  // todo mundo, que é o mesmo erro do card antigo, invertido.
  var perfilBruto = String(sessao.perfil || "");
  var perfilNorm = perfilBruto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  var ehAdmin = perfilNorm.indexOf("ADMIN") > -1;

  return {
    ok: true,
    ambiente: ambiente,
    ambienteRotulo: ambiente === "homologacao" ? "HOMOLOGAÇÃO" : "Produção",
    // Homologação precisa saltar aos olhos: quem não percebe que está nela
    // acha que gravou em produção — ou pior, o contrário.
    ambienteAlerta: ambiente === "homologacao",
    planilhaOk: planilha.ok,
    planilha: planilha.texto,
    versao: (typeof SISTEMA_VERSAO === "string" ? SISTEMA_VERSAO : "—"),
    versaoDescricao: (typeof SISTEMA_VERSAO_DESC === "string" ? SISTEMA_VERSAO_DESC : ""),
    usuario: sessao.nome || sessao.usuario || sessao.email || "—",
    perfil: perfilBruto || "—",
    administrador: ehAdmin
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
/* PADRÃO DE PRODUÇÃO — PASTA_RECIBO_ID e PASTA_RELATORIOS_ID valem produção em
   QUALQUER ambiente. Não leia nenhuma das duas para gravar arquivo: use
   getRecursoId_("RECIBOS") / getRecursoId_("RELATORIOS"), de AmbienteRecursos.gs,
   que troca por ambiente e trava a gravação se a homologação cair na pasta de
   produção. Elas continuam declaradas porque três arquivos ainda as consultam
   com `typeof ... !== "undefined"` como último recurso, e porque resolver aqui
   no TOPO do arquivo dependeria da ordem de carga dos .gs. */
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
    /* semTrava nos dois abaixo: diagnóstico tem de conseguir RELATAR a pasta
       errada, não estourar ao ser perguntado sobre ela. Ver AmbienteRecursos.gs
       e, para o quadro completo por ambiente, diagnosticoAmbienteRecursos_(). */
    pastas: {
      recibos:                getRecursoId_("RECIBOS", { semTrava: true }),
      oficios:                PASTA_OFICIOS_ID,
      oficiosDesfiliacao:     PASTA_OFICIOS_DESFILIACAO_ID,
      oficiosTaxaAssistencial:PASTA_OFICIOS_TAXA_ASSISTENCIAL_ID,
      oficiosTaxaNegocial:    PASTA_OFICIOS_TAXA_NEGOCIAL_ID,
      relatorios:             getRecursoId_("RELATORIOS", { semTrava: true })
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

/**
 * A URL /exec se descobre sozinha — ninguém precisa declarar.
 *
 * O QUE ORIGINOU (21/08/2026)
 *
 * Eu pedi ao usuário para declarar `SISGEP_URL_BASE` à mão, e ele perguntou
 * por que aquilo não tinha sido feito. A resposta que eu dei era só metade:
 * eu não tenho acesso ao projeto Apps Script, é verdade — mas o SISTEMA tem,
 * e eu não tinha usado isso. É a REGRA Nº 0.6 invertida: eu estava pedindo
 * que uma pessoa digitasse um dado que o próprio sistema sabe dizer.
 *
 * COMO FUNCIONA
 *
 * `ScriptApp.getService().getUrl()` devolve `/exec` quando a chamada parte de
 * DENTRO do web app publicado, e `/dev` quando parte do editor. O `doGet` só
 * roda dentro do web app — então na primeira vez que qualquer pessoa abrir
 * qualquer página, a URL correta passa por aqui e fica gravada.
 *
 * A partir daí, e-mail, PDF e link de ingresso nascem com `/exec`, mesmo
 * quando gerados por rotina do editor ou por trigger, que sozinhos só
 * enxergariam `/dev`.
 *
 * AS TRÊS TRAVAS
 *
 *   1. só grava se a URL terminar em `/exec` — abrir a página pelo `/dev`
 *      não pode contaminar a configuração;
 *   2. só grava se ainda não houver valor, para nunca sobrescrever uma
 *      declaração feita à mão;
 *   3. falha em silêncio. Isto roda no caminho de TODA página do sistema:
 *      um erro de propriedade aqui não pode derrubar o SISGEP inteiro.
 */
function sisgep_aprenderUrlBase_() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (String(props.getProperty('SISGEP_URL_BASE') || '').trim()) return;

    var url = String(ScriptApp.getService().getUrl() || '');
    if (url.slice(-5) !== '/exec') return;

    props.setProperty('SISGEP_URL_BASE', url);
    SISTEMA_URL_BASE = url;
    Logger.log('[SistemaConfig] SISGEP_URL_BASE aprendida sozinha: ' + url);
  } catch (e) { /* silencioso: roda em toda página */ }
}
