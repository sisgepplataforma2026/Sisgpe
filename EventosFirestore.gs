/**
 * PONTE SISGEP ↔ FIRESTORE (projeto sisgep-plataforma)
 *
 * IMPORTANTE:
 * Esta ponte reutiliza a infraestrutura oficial de FirebaseCore.gs.
 * As credenciais ficam separadas em ScriptProperties:
 *   FIREBASE_PROJETO
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * Não usar FIRESTORE_SERVICE_ACCOUNT: manter duas formas de autenticação no
 * mesmo projeto cria configuração duplicada e aumenta o risco operacional.
 */

/* ══════════════════════════════════════════════════════════════════════════
   MEDIÇÃO DE CONSUMO — contagem em memória, custo zero
   ══════════════════════════════════════════════════════════════════════════

   O usuário precisa saber, com DADO REAL, quanto o fluxo consome do Firebase:
   "preciso fazer teste... a questão de medir o consumo do Firebase, porque o
   acesso é no dia dezenove de dezembro."

   O EventosFirebaseCusto.gs ESTIMA por fórmula, e explica por que não mede:
   "não gravamos um documento de métrica a cada operação porque isso
   aumentaria artificialmente o próprio consumo que queremos reduzir."

   A objeção está certa — gravar métrica no Firestore dobraria as escritas. A
   saída não é deixar de medir: é contar EM MEMÓRIA, dentro da execução, e
   reportar no fim. Uma execução do Apps Script é isolada e vive no máximo 6
   minutos; um lote de simulação cabe inteiro nela. Nenhuma leitura, nenhuma
   escrita, nenhum documento a mais.

   O que isto NÃO substitui: o painel oficial do Firebase. Ele é a fonte de
   verdade da cobrança. Este contador dá o que o painel não dá — o número
   separado POR OPERAÇÃO e por etapa do fluxo, que é o que diz ONDE cortar.
   ══════════════════════════════════════════════════════════════════════════ */

var FS_METRICAS = { ligado: false, leituras: 0, gravacoes: 0, listagens: 0,
                    consultas: 0, docsLidos: 0, inicio: 0, rotulo: '' };

/** Liga a contagem e zera. Chamar no começo da rodada que se quer medir. */
function fs_medirIniciar_(rotulo) {
  FS_METRICAS = { ligado: true, leituras: 0, gravacoes: 0, listagens: 0,
                  consultas: 0, docsLidos: 0, inicio: Date.now(),
                  rotulo: String(rotulo || 'rodada') };
}

/** Fecha a contagem e devolve o relatório, já comparado com a faixa gratuita. */
function fs_medirFechar_() {
  var m = FS_METRICAS;
  FS_METRICAS = { ligado: false, leituras: 0, gravacoes: 0, listagens: 0,
                  consultas: 0, docsLidos: 0, inicio: 0, rotulo: '' };

  var teto = (typeof COMPASSO_FIREBASE_BUDGET === 'object')
    ? COMPASSO_FIREBASE_BUDGET : { LEITURAS_DIA: 50000, GRAVACOES_DIA: 20000 };

  /* O que conta para a cobrança é DOCUMENTO lido, não chamada: um fs_list_ de
     1.000 documentos custa 1.000 leituras, não uma. Ignorar isso subestimaria
     o consumo justo na operação mais cara. */
  var leiturasReais = m.leituras + m.docsLidos;

  return {
    rotulo: m.rotulo,
    segundos: m.inicio ? Math.round((Date.now() - m.inicio) / 100) / 10 : 0,
    chamadas: { get: m.leituras, set: m.gravacoes, list: m.listagens, query: m.consultas },
    documentosLidos: m.docsLidos,
    leiturasCobradas: leiturasReais,
    gravacoesCobradas: m.gravacoes,
    percentualDoTetoDiario: {
      leituras: Math.round(leiturasReais / teto.LEITURAS_DIA * 1000) / 10 + '%',
      gravacoes: Math.round(m.gravacoes / teto.GRAVACOES_DIA * 1000) / 10 + '%'
    },
    nota: 'Contagem em memória desta execução. O painel do Firebase continua ' +
          'sendo a fonte de verdade da cobranca.'
  };
}

// ---------- CONFIG / CREDENCIAL ----------
function fs_getConfig_() {
  if (typeof fb_config_ !== 'function') {
    throw new Error('FirebaseCore.gs não está disponível no projeto.');
  }
  var cfg = fb_config_();
  if (!cfg) {
    throw new Error('Firebase não configurado. Verifique FIREBASE_PROJETO, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY nas Propriedades do script.');
  }
  return {
    projectId: cfg.projeto,
    clientEmail: cfg.email,
    privateKey: cfg.chave
  };
}

// ---------- TOKEN DE ACESSO ----------
// Reutiliza o OAuth/cache oficial de FirebaseCore.gs.
function fs_getAccessToken_() {
  if (typeof fb_token_ !== 'function') {
    throw new Error('FirebaseCore.gs não está disponível para gerar o token OAuth.');
  }
  return fb_token_();
}

// Mantida por compatibilidade com código legado que possa chamá-la.
function fs_b64url_(input) {
  if (typeof fb_base64Url_ === 'function') return fb_base64Url_(input);
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
  if (FS_METRICAS.ligado) FS_METRICAS.gravacoes++;
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
  if (FS_METRICAS.ligado) FS_METRICAS.leituras++;
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
function fs_queryEquals_(collection, campo, valor) {
  /* Consulta de verdade (runQuery com filtro e limite 5) — custa as poucas
     linhas que devolve, não a coleção inteira. É o caminho barato, e é o
     que o check-in por número usa. */
  if (typeof FS_METRICAS === 'object' && FS_METRICAS.ligado) FS_METRICAS.consultas++;
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
