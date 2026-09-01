// ============================================================================
// ARQUIVO: FirebaseCore.gs
// Acesso ao Cloud Firestore do projeto sisgep-plataforma.
//
// POR QUE ESTE ARQUIVO É ASSIM
// O Apps Script não tem SDK do Firebase. O acesso é pela API REST do
// Firestore, e a API REST exige um token OAuth2 — que por sua vez exige
// montar e ASSINAR um JWT com a chave privada de uma conta de serviço.
// É isso que este arquivo faz, e é a razão de ele ser mais longo do que
// "gravar um registro" deveria ser.
//
// CONFIGURAÇÃO — o que precisa estar em ScriptProperties (Configurações do
// projeto → Propriedades do script). NADA DISSO VAI PARA O CÓDIGO:
//
//   FIREBASE_PROJETO       sisgep-plataforma
//   FIREBASE_CLIENT_EMAIL  algo@sisgep-plataforma.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY   -----BEGIN PRIVATE KEY-----\nMIIE...\n-----END...
//
// A chave privada é o que dá acesso de escrita ao banco do sindicato. Ela
// nunca entra em arquivo versionado, nunca é colada em conversa e nunca
// aparece em log. Se vazar, quem tiver a chave escreve no banco como se
// fosse o sistema.
//
// SOBRE AS REGRAS DE SEGURANÇA DO FIRESTORE
// Elas NÃO protegem este caminho. Conta de serviço passa por cima das regras,
// por desenho do Firebase — regra vale para acesso direto do cliente (app
// web, mobile). A trava real de quem pode fazer o quê continua sendo o
// exigirModulo_ do Apps Script.
//
// Isso está escrito aqui porque é exatamente onde a confusão acontece:
// alguém escreve uma regra bonita no console, acha que o sistema está
// protegido, e não está.
//
// PLANO SPARK (gratuito): 20 mil gravações e 50 mil leituras por dia. O
// sindicato faz ~200 ações/dia. Cabe com folga; se um dia não couber, o
// erro aparece como quota exceeded e o fallback assume.
// ============================================================================

var FB_PROP_PROJETO = "FIREBASE_PROJETO";
var FB_PROP_EMAIL   = "FIREBASE_CLIENT_EMAIL";
var FB_PROP_CHAVE   = "FIREBASE_PRIVATE_KEY";

var FB_ESCOPO = "https://www.googleapis.com/auth/datastore";
var FB_CACHE_TOKEN = "FIREBASE_TOKEN_OAUTH";

// O token vale 1h. Guardo por 55min para nunca usar um que expira no meio.
var FB_TOKEN_VALIDADE_SEG = 3300;

/** Configuração lida das propriedades. Devolve null se não estiver completa. */
function fb_config_() {
  try {
    var p = PropertiesService.getScriptProperties();
    var projeto = p.getProperty(FB_PROP_PROJETO);
    var email = p.getProperty(FB_PROP_EMAIL);
    var chave = p.getProperty(FB_PROP_CHAVE);
    if (!projeto || !email || !chave) return null;
    // A chave vem do JSON com \n literais; o assinador precisa de quebras reais.
    return { projeto: projeto, email: email, chave: String(chave).replace(/\\n/g, "\n") };
  } catch (e) {
    Logger.log("fb_config_: " + e);
    return null;
  }
}

/** O Firestore está configurado neste projeto? */
function firebaseDisponivel_() {
  return fb_config_() !== null;
}

/* ==========================================================================
 * OAUTH — JWT assinado com a chave da conta de serviço
 * ========================================================================== */

function fb_base64Url_(texto) {
  return Utilities.base64EncodeWebSafe(texto).replace(/=+$/, "");
}

/**
 * Token de acesso, com cache. Renovar a cada chamada custaria uma ida à rede
 * por gravação de log — o que dobraria o custo de auditar qualquer coisa.
 */
function fb_token_() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get(FB_CACHE_TOKEN);
  if (guardado) return guardado;

  var cfg = fb_config_();
  if (!cfg) throw new Error("Firebase não configurado neste projeto.");

  var agora = Math.floor(Date.now() / 1000);
  var cabecalho = { alg: "RS256", typ: "JWT" };
  var corpo = {
    iss: cfg.email,
    scope: FB_ESCOPO,
    aud: "https://oauth2.googleapis.com/token",
    exp: agora + 3600,
    iat: agora
  };

  var base = fb_base64Url_(JSON.stringify(cabecalho)) + "." +
             fb_base64Url_(JSON.stringify(corpo));
  var assinatura = Utilities.computeRsaSha256Signature(base, cfg.chave);
  var jwt = base + "." + Utilities.base64EncodeWebSafe(assinatura).replace(/=+$/, "");

  var resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    // Sem o corpo do erro é impossível saber se é chave errada, relógio
    // fora de hora ou conta sem permissão. Os três dão 400.
    throw new Error("OAuth do Firebase falhou (" + resp.getResponseCode() + "): " +
      String(resp.getContentText()).slice(0, 200));
  }

  var token = JSON.parse(resp.getContentText()).access_token;
  cache.put(FB_CACHE_TOKEN, token, FB_TOKEN_VALIDADE_SEG);
  return token;
}

/* ==========================================================================
 * CONVERSÃO DE VALORES
 * O Firestore não aceita JSON comum: cada valor vai tipado. Um número
 * enviado como {stringValue} vira texto no banco e não é comparável depois.
 * ========================================================================== */

function fb_valor_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(fb_valor_) } };
  }
  if (typeof v === "object") {
    var campos = {};
    Object.keys(v).forEach(function (k) { campos[k] = fb_valor_(v[k]); });
    return { mapValue: { fields: campos } };
  }
  return { stringValue: String(v) };
}

/** Caminho do documento inverso: do formato do Firestore para objeto comum. */
function fb_desvalor_(f) {
  if (!f || typeof f !== "object") return null;
  if ("nullValue" in f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return Number(f.doubleValue);
  if ("timestampValue" in f) return f.timestampValue;
  if ("arrayValue" in f) return ((f.arrayValue && f.arrayValue.values) || []).map(fb_desvalor_);
  if ("mapValue" in f) {
    var o = {}, campos = (f.mapValue && f.mapValue.fields) || {};
    Object.keys(campos).forEach(function (k) { o[k] = fb_desvalor_(campos[k]); });
    return o;
  }
  return null;
}

/** Documento inteiro, do formato do Firestore para objeto. */
function fb_documentoParaObjeto_(doc) {
  var o = {};
  var campos = (doc && doc.fields) || {};
  Object.keys(campos).forEach(function (k) { o[k] = fb_desvalor_(campos[k]); });
  if (doc && doc.name) o._id = String(doc.name).split("/").pop();
  return o;
}

/* ==========================================================================
 * OPERAÇÕES
 * ========================================================================== */

function fb_urlBase_(cfg) {
  return "https://firestore.googleapis.com/v1/projects/" + cfg.projeto +
         "/databases/(default)/documents/";
}

/**
 * Grava um documento na coleção, com id automático.
 * Devolve { ok, id } ou { ok:false, mensagem } — NUNCA lança.
 *
 * Não lança de propósito: quem chama isto é a auditoria, e auditoria que
 * derruba a operação é pior que auditoria nenhuma. Quem precisa saber se
 * gravou lê o retorno.
 */
function firebaseCriar_(colecao, dados) {
  var cfg = fb_config_();
  if (!cfg) return { ok: false, mensagem: "Firebase não configurado." };

  try {
    var campos = {};
    Object.keys(dados || {}).forEach(function (k) { campos[k] = fb_valor_(dados[k]); });

    var resp = UrlFetchApp.fetch(fb_urlBase_(cfg) + encodeURIComponent(colecao), {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + fb_token_() },
      payload: JSON.stringify({ fields: campos }),
      muteHttpExceptions: true
    });

    var codigo = resp.getResponseCode();
    if (codigo < 200 || codigo >= 300) {
      return { ok: false, codigo: codigo,
        mensagem: "Firestore recusou (" + codigo + "): " +
          String(resp.getContentText()).slice(0, 180) };
    }

    var doc = JSON.parse(resp.getContentText());
    return { ok: true, id: String(doc.name || "").split("/").pop() };
  } catch (e) {
    return { ok: false, mensagem: "Firestore indisponível: " + e.message };
  }
}

/**
 * Consulta com filtro e ordenação, via runQuery.
 * filtros: [{ campo, op, valor }] — op em EQUAL, GREATER_THAN_OR_EQUAL etc.
 */
function firebaseConsultar_(colecao, filtros, ordenarPor, decrescente, limite) {
  var cfg = fb_config_();
  if (!cfg) return { ok: false, mensagem: "Firebase não configurado.", itens: [] };

  try {
    var consulta = { from: [{ collectionId: colecao }] };

    var lista = (filtros || []).filter(function (f) { return f && f.campo; });
    if (lista.length === 1) {
      consulta.where = { fieldFilter: {
        field: { fieldPath: lista[0].campo },
        op: lista[0].op || "EQUAL",
        value: fb_valor_(lista[0].valor)
      }};
    } else if (lista.length > 1) {
      consulta.where = { compositeFilter: { op: "AND", filters: lista.map(function (f) {
        return { fieldFilter: {
          field: { fieldPath: f.campo }, op: f.op || "EQUAL", value: fb_valor_(f.valor)
        }};
      })}};
    }

    if (ordenarPor) {
      consulta.orderBy = [{ field: { fieldPath: ordenarPor },
        direction: decrescente ? "DESCENDING" : "ASCENDING" }];
    }
    consulta.limit = Math.min(parseInt(limite, 10) || 100, 1000);

    var resp = UrlFetchApp.fetch(fb_urlBase_(cfg) + ":runQuery", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + fb_token_() },
      payload: JSON.stringify({ structuredQuery: consulta }),
      muteHttpExceptions: true
    });

    var codigo = resp.getResponseCode();
    if (codigo < 200 || codigo >= 300) {
      // Falta de índice é o erro mais comum aqui, e a resposta traz o link
      // que cria o índice com um clique. Preservar o texto importa.
      return { ok: false, codigo: codigo, itens: [],
        mensagem: "Firestore recusou a consulta (" + codigo + "): " +
          String(resp.getContentText()).slice(0, 300) };
    }

    var linhas = JSON.parse(resp.getContentText()) || [];
    var itens = linhas.filter(function (l) { return l && l.document; })
                      .map(function (l) { return fb_documentoParaObjeto_(l.document); });
    return { ok: true, total: itens.length, itens: itens };
  } catch (e) {
    return { ok: false, mensagem: "Firestore indisponível: " + e.message, itens: [] };
  }
}

/* ==========================================================================
 * DIAGNÓSTICO
 * ========================================================================== */

/**
 * Testa a conexão de ponta a ponta: lê a configuração, pega o token e grava
 * um registro na coleção de diagnóstico.
 *
 * Rodar UMA vez depois de configurar as propriedades. É o único jeito de
 * saber se a chave e a conta de serviço estão certas — o resto do sistema
 * usa fallback e não reclama alto quando o Firestore não responde.
 */
function firebaseTestarConexao(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);

  var cfg = fb_config_();
  if (!cfg) {
    return { ok: false, etapa: "CONFIGURACAO",
      mensagem: "Faltam propriedades. Configure " + FB_PROP_PROJETO + ", " +
        FB_PROP_EMAIL + " e " + FB_PROP_CHAVE + " em Propriedades do script." };
  }

  try {
    fb_token_();
  } catch (e) {
    return { ok: false, etapa: "OAUTH", mensagem: e.message };
  }

  var r = firebaseCriar_("_diagnostico", {
    executadoEm: new Date(),
    origem: "firebaseTestarConexao",
    projeto: cfg.projeto
  });

  if (!r.ok) return { ok: false, etapa: "GRAVACAO", mensagem: r.mensagem };

  return { ok: true, etapa: "COMPLETO", projeto: cfg.projeto, documento: r.id,
    mensagem: "Conexão com o Firestore funcionando. Documento de teste gravado " +
      "em _diagnostico (pode apagar pelo console)." };
}
