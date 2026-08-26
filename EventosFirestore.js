/**
 * PONTE SISGEP ↔ FIRESTORE (projeto sisgep-plataforma)
 * Autentica com a conta de serviço guardada no cofre (FIRESTORE_SERVICE_ACCOUNT)
 * e lê/grava documentos no Firestore via API REST.
 * Etapa 1: só a ponte + testes. O motor de emissão vem por cima disto.
 */

// ---------- CONFIG / CREDENCIAL ----------
function fs_getConfig_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FIRESTORE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Credencial FIRESTORE_SERVICE_ACCOUNT não encontrada no cofre.');
  var sa = JSON.parse(raw);
  return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
}

// ---------- TOKEN DE ACESSO (OAuth via JWT da conta de serviço) ----------
function fs_getAccessToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('FS_TOKEN');
  if (cached) return cached;

  var cfg = fs_getConfig_();
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var claim = {
    iss: cfg.clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  var toSign = fs_b64url_(JSON.stringify(header)) + '.' + fs_b64url_(JSON.stringify(claim));
  var signature = Utilities.computeRsaSha256Signature(toSign, cfg.privateKey);
  var jwt = toSign + '.' + fs_b64url_(signature);

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  if (!data.access_token) throw new Error('Falha ao obter token: ' + resp.getContentText());
  cache.put('FS_TOKEN', data.access_token, 3000); // ~50 min
  return data.access_token;
}

function fs_b64url_(input) {
  return Utilities.base64EncodeWebSafe(input).replace(/=+$/, '');
}

// ---------- URL BASE ----------
function fs_baseUrl_() {
  var cfg = fs_getConfig_();
  return 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId +
         '/databases/(default)/documents';
}

// ---------- CONVERSÃO JS <-> FIRESTORE ----------
function fs_toFields_(obj) {
  var fields = {};
  for (var k in obj) {
    var v = obj[k];
    if (v === null || v === undefined)      fields[k] = { nullValue: null };
    else if (typeof v === 'boolean')        fields[k] = { booleanValue: v };
    else if (typeof v === 'number')         fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (v instanceof Date)             fields[k] = { timestampValue: v.toISOString() };
    else                                    fields[k] = { stringValue: String(v) };
  }
  return fields;
}

function fs_fromFields_(fields) {
  var obj = {};
  if (!fields) return obj;
  for (var k in fields) {
    var f = fields[k];
    if ('stringValue' in f)         obj[k] = f.stringValue;
    else if ('booleanValue' in f)   obj[k] = f.booleanValue;
    else if ('integerValue' in f)   obj[k] = parseInt(f.integerValue, 10);
    else if ('doubleValue' in f)    obj[k] = f.doubleValue;
    else if ('timestampValue' in f) obj[k] = f.timestampValue;
    else if ('nullValue' in f)      obj[k] = null;
    else                            obj[k] = f;
  }
  return obj;
}

// ---------- GRAVAR (cria/substitui documento com ID definido) ----------
function fs_set_(collection, docId, obj) {
  var url = fs_baseUrl_() + '/' + collection + '/' + encodeURIComponent(docId);
  var resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
    payload: JSON.stringify({ fields: fs_toFields_(obj) }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300)
    throw new Error('Erro ao gravar (' + resp.getResponseCode() + '): ' + resp.getContentText());
  return fs_fromFields_(JSON.parse(resp.getContentText()).fields);
}

// ---------- LER (retorna objeto ou null) ----------
function fs_get_(collection, docId) {
  var url = fs_baseUrl_() + '/' + collection + '/' + encodeURIComponent(docId);
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() === 404) return null;
  if (resp.getResponseCode() >= 300)
    throw new Error('Erro ao ler (' + resp.getResponseCode() + '): ' + resp.getContentText());
  return fs_fromFields_(JSON.parse(resp.getContentText()).fields);
}

// ---------- CONSULTAR (query estruturada por igualdade de campo) ----------
// Usado pelo check-in: encontrar o ingresso pelo número impresso/digitado
// (FCV-2026-000123), já que o documento é gravado com um UUID como ID.
function fs_queryEquals_(collection, campo, valor) {
  var url = fs_baseUrl_() + ':runQuery';
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: campo },
          op: 'EQUAL',
          value: fs_toFields_({ v: valor }).v
        }
      },
      limit: 5
    }
  };
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300)
    throw new Error('Erro na consulta (' + resp.getResponseCode() + '): ' + resp.getContentText());

  var linhas = JSON.parse(resp.getContentText()) || [];
  var out = [];
  linhas.forEach(function (l) {
    if (l && l.document) {
      var partes = l.document.name.split('/');
      out.push({ id: partes[partes.length - 1], data: fs_fromFields_(l.document.fields) });
    }
  });
  return out;
}

// ================= TESTES DA PONTE =================
function testeFirestore_gravar() {
  var r = fs_set_('ingressos', 'ponte-teste', {
    numero: 'PONTE-000',
    nome: 'Teste da Ponte SISGEP',
    escola: 'Escola da Ponte',
    categoria: 'associado',
    status: 'EMITIDO'
  });
  Logger.log('✅ Gravou com sucesso: ' + JSON.stringify(r));
}

function testeFirestore_ler() {
  var r = fs_get_('ingressos', 'ponte-teste');
  Logger.log(r ? ('✅ Leu com sucesso: ' + JSON.stringify(r)) : '⚠️ Documento não encontrado.');
}