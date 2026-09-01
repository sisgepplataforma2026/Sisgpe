/**
 * Emulador do Google Apps Script para testes ponta a ponta do SISGEP.
 *
 * Objetivo: rodar o código REAL dos arquivos .gs contra uma planilha em
 * memória, sem tocar na planilha de produção. O que é emulado com fidelidade:
 * planilha (linhas, colunas, appendRow, getRange/setValue), PropertiesService,
 * CacheService, LockService, Utilities e datas.
 *
 * O que é apenas REGISTRADO (não executado de verdade): e-mail, Drive, UrlFetch.
 * Um teste que dependa do conteúdo real de um PDF ou da entrega de um e-mail
 * NÃO é validável aqui — e isso está declarado no relatório.
 */

const crypto = require("crypto");

/* ───────────────────────── PLANILHA ───────────────────────── */

function colLetter(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

class Range {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
  }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numCols; }
  getA1Notation() {
    return colLetter(this.col) + this.row + ":" + colLetter(this.col + this.numCols - 1) + (this.row + this.numRows - 1);
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) row.push(this.sheet._get(this.row + r, this.col + c));
      out.push(row);
    }
    return out;
  }
  getValue() { return this.sheet._get(this.row, this.col); }
  getDisplayValues() {
    return this.getValues().map(r => r.map(v => {
      if (v instanceof Date) return v.toLocaleDateString("pt-BR");
      return v === null || v === undefined ? "" : String(v);
    }));
  }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValue(v) {
    for (let r = 0; r < this.numRows; r++)
      for (let c = 0; c < this.numCols; c++) this.sheet._set(this.row + r, this.col + c, v);
    return this;
  }
  setValues(vals) {
    if (vals.length !== this.numRows)
      throw new Error("setValues: número de linhas (" + vals.length + ") diferente do range (" + this.numRows + ")");
    for (let r = 0; r < this.numRows; r++) {
      if (vals[r].length !== this.numCols)
        throw new Error("setValues: número de colunas (" + vals[r].length + ") diferente do range (" + this.numCols + ")");
      for (let c = 0; c < this.numCols; c++) this.sheet._set(this.row + r, this.col + c, vals[r][c]);
    }
    return this;
  }
  clearContent() { return this.setValue(""); }
  clear() { return this.setValue(""); }
  // formatação: sem efeito no dado, mas precisa ser encadeável
  setFontWeight() { return this; } setFontColor() { return this; } setBackground() { return this; }
  setFontSize() { return this; } setFontFamily() { return this; } setHorizontalAlignment() { return this; }
  setVerticalAlignment() { return this; } setNumberFormat() { return this; } setNumberFormats() { return this; }
  setWrap() { return this; } setBorder() { return this; } setNote() { return this; } setFontStyle() { return this; }
  setFontLine() { return this; } merge() { return this; } setDataValidation() { return this; }
  setFontWeights() { return this; } setBackgrounds() { return this; } setValuesAsync() { return this; }
  activate() { return this; } offset(r, c, nr, nc) {
    return new Range(this.sheet, this.row + r, this.col + c, nr || this.numRows, nc || this.numCols);
  }
  sort() { return this; }
}

class Sheet {
  constructor(name, ss) { this.name = name; this.ss = ss; this.data = []; this.hidden = false; this.frozen = 0; }
  _cell(r, c) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1];
    while (row.length < c) row.push("");
    return row;
  }
  _get(r, c) { if (r < 1 || c < 1) throw new Error("índice inválido " + r + "," + c); const row = this._cell(r, c); const v = row[c - 1]; return v === undefined ? "" : v; }
  _set(r, c, v) { const row = this._cell(r, c); row[c - 1] = v === undefined ? "" : v; }
  getName() { return this.name; }
  setName(n) { const old = this.name; this.name = n; this.ss._rename(old, n); return this; }
  getLastRow() {
    let last = 0;
    for (let r = 0; r < this.data.length; r++) {
      const row = this.data[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== "" && row[c] !== null && row[c] !== undefined) { last = r + 1; break; }
      }
    }
    return last;
  }
  getLastColumn() {
    let last = 0;
    for (let r = 0; r < this.data.length; r++) {
      const row = this.data[r] || [];
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== "" && row[c] !== null && row[c] !== undefined) { if (c + 1 > last) last = c + 1; break; }
      }
    }
    return last;
  }
  getMaxRows() { return Math.max(this.data.length, this._maxRows || 1000); }
  getMaxColumns() { return Math.max(this.getLastColumn(), this._maxCols || 26); }
  insertColumnsAfter(pos, n) { this._maxCols = this.getMaxColumns() + (n || 1); return this; }
  insertColumnAfter(pos) { return this.insertColumnsAfter(pos, 1); }
  insertColumnsBefore(pos, n) { return this.insertColumnsAfter(pos, n); }
  insertRowsAfter(pos, n) { this._maxRows = this.getMaxRows() + (n || 1); return this; }
  insertRowsBefore(pos, n) { for (let i = 0; i < (n || 1); i++) this.data.splice(pos - 1, 0, []); return this; }
  getRange(a, b, c, d) {
    if (typeof a === "string") { // notação A1 simples: "A1" ou "A1:C5"
      const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      if (!m) throw new Error("Notação A1 não suportada no emulador: " + a);
      const toNum = s => s.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
      const c1 = toNum(m[1]), r1 = Number(m[2]);
      const c2 = m[3] ? toNum(m[3]) : c1, r2 = m[4] ? Number(m[4]) : r1;
      return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
    }
    return new Range(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d);
  }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(values) {
    const r = this.getLastRow() + 1;
    for (let c = 0; c < values.length; c++) this._set(r, c + 1, values[c]);
    return this;
  }
  insertRowAfter() { return this; }
  insertRowBefore(pos) { this.data.splice(pos - 1, 0, []); return this; }
  deleteRow(pos) { this.data.splice(pos - 1, 1); return this; }
  deleteRows(pos, n) { this.data.splice(pos - 1, n || 1); return this; }
  deleteColumn() { return this; }
  clear() { this.data = []; return this; }
  clearContents() { this.data = []; return this; }
  // Só formatação — o emulador não guarda formato, então é no-op de propósito.
  // Precisa existir mesmo assim: removerEscolasDuplicadas() chama clearFormats()
  // logo depois de clearContents(), e sem o método a função inteira caía no
  // catch e devolvia ok:false — dando a impressão de bug de produto.
  clearFormats() { return this; }
  setFrozenRows(n) { this.frozen = n; return this; }
  setFrozenColumns() { return this; }
  autoResizeColumn() { return this; } autoResizeColumns() { return this; }
  setColumnWidth() { return this; } setColumnWidths() { return this; } setRowHeight() { return this; }
  hideSheet() { this.hidden = true; return this; } showSheet() { this.hidden = false; return this; }
  isSheetHidden() { return this.hidden; }
  getFilter() { return null; }
  sort() { return this; }
  getIndex() { return this.ss.sheets.indexOf(this) + 1; }
  activate() { return this; }
  getSheetId() { return Math.abs(hashCode(this.name)); }
  getParent() { return this.ss; }
  insertChart() { return this; } getCharts() { return []; }
  getProtections() { return []; }
  protect() {
    const p = {
      _editors: [], _desc: "",
      setDescription(d) { p._desc = d; return p; },
      getEditors() { return p._editors.slice(); },
      removeEditors(list) { (list || []).forEach(e => { const i = p._editors.indexOf(e); if (i >= 0) p._editors.splice(i, 1); }); return p; },
      removeEditor(e) { return p.removeEditors([e]); },
      addEditors(list) { (list || []).forEach(e => p._editors.push(e)); return p; },
      addEditor(e) { p._editors.push(e); return p; },
      canDomainEdit() { return false; },
      setDomainEdit() { return p; },
      setWarningOnly() { return p; },
      remove() { return p; },
      getRange() { return null; }
    };
    return p;
  }
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name || "SISGEP (teste)"; this.sheets = []; }
  _rename() {}
  getId() { return this.id; }
  getName() { return this.name; }
  getUrl() { return "https://docs.google.com/spreadsheets/d/" + this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets.slice(); }
  insertSheet(n) {
    if (typeof n !== "string") n = "Página" + (this.sheets.length + 1);
    if (this.getSheetByName(n)) throw new Error("Já existe uma aba chamada " + n);
    const s = new Sheet(n, this); this.sheets.push(s); return s;
  }
  deleteSheet(s) { const i = this.sheets.indexOf(s); if (i >= 0) this.sheets.splice(i, 1); }
  getActiveSheet() { return this.sheets[0] || this.insertSheet("Página1"); }
  setActiveSheet(s) { return s; }
  getSpreadsheetTimeZone() { return "America/Sao_Paulo"; }
  toast() {}
  getRangeByName() { return null; }
}

const _spreadsheets = {};
function _ss(id) { if (!_spreadsheets[id]) _spreadsheets[id] = new Spreadsheet(id); return _spreadsheets[id]; }

/* ───────────────────────── SERVIÇOS ───────────────────────── */

const _props = { script: {}, user: {}, document: {} };
function propsApi(store) {
  return {
    getProperty: k => (k in store ? store[k] : null),
    setProperty: (k, v) => { store[k] = String(v); return propsApi(store); },
    deleteProperty: k => { delete store[k]; return propsApi(store); },
    getProperties: () => Object.assign({}, store),
    setProperties: o => { Object.keys(o).forEach(k => (store[k] = String(o[k]))); return propsApi(store); },
    getKeys: () => Object.keys(store)
  };
}

const _cache = { script: {}, user: {}, document: {} };
function cacheApi(store) {
  return {
    get: k => (k in store ? store[k] : null),
    put: (k, v) => { store[k] = String(v); },
    putAll: o => Object.keys(o).forEach(k => (store[k] = String(o[k]))),
    remove: k => { delete store[k]; },
    removeAll: ks => (ks || []).forEach(k => { delete store[k]; }),
    getAll: ks => { const o = {}; (ks || []).forEach(k => { if (k in store) o[k] = store[k]; }); return o; }
  };
}

// LockService de verdade importa: o SISGEP já teve deadlock por lock aninhado.
// O emulador reproduz o comportamento: pedir um lock já obtido por outra
// "execução" falha; pedir o MESMO lock na mesma execução também falha
// (é assim que o Apps Script se comporta e foi o que causou o bug da folha).
const _locks = { script: false, user: false, document: false };
const lockEvents = [];
function lockApi(kind) {
  return {
    tryLock(ms) {
      if (_locks[kind]) { lockEvents.push({ kind, resultado: "NEGADO", ms }); return false; }
      _locks[kind] = true; lockEvents.push({ kind, resultado: "OBTIDO" }); return true;
    },
    waitLock(ms) {
      if (_locks[kind]) { lockEvents.push({ kind, resultado: "DEADLOCK", ms }); throw new Error("Lock timeout (deadlock detectado pelo emulador)"); }
      _locks[kind] = true; lockEvents.push({ kind, resultado: "OBTIDO" });
    },
    hasLock() { return _locks[kind]; },
    releaseLock() { _locks[kind] = false; lockEvents.push({ kind, resultado: "LIBERADO" }); }
  };
}

const outbox = [];      // e-mails
const driveFiles = [];  // arquivos "criados"
const fetches = [];     // chamadas externas

function pad(n, w) { return String(n).padStart(w || 2, "0"); }

const Utilities_ = {
  formatDate(d, tz, fmt) {
    if (!(d instanceof Date)) d = new Date(d);
    if (isNaN(d.getTime())) return "";
    const map = {
      yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(2),
      MM: pad(d.getMonth() + 1), M: d.getMonth() + 1,
      dd: pad(d.getDate()), d: d.getDate(),
      HH: pad(d.getHours()), H: d.getHours(),
      mm: pad(d.getMinutes()), ss: pad(d.getSeconds()),
      SSS: pad(d.getMilliseconds(), 3)
    };
    // Literais entre aspas simples ('T', 'às') saem como texto — é assim que o
    // Apps Script se comporta, e o SISGEP usa isso para montar ISO 8601
    // ("yyyy-MM-dd'T'HH:mm:ss"). Sem isto, o emulador devolvia a data com as
    // aspas no meio e qualquer new Date() em cima virava Invalid Date.
    return String(fmt).replace(/'([^']*)'|yyyy|yy|MMM|MM|M|dd|d|HH|H|mm|ss|SSS/g,
      (m, lit) => (lit !== undefined ? lit : (m in map ? map[m] : m)));
  },
  getUuid() { return crypto.randomUUID(); },
  sleep() {},
  base64Encode(s) { return Buffer.from(typeof s === "string" ? s : Buffer.from(s)).toString("base64"); },
  base64EncodeWebSafe(s) { return Buffer.from(typeof s === "string" ? s : Buffer.from(s)).toString("base64url"); },
  base64Decode(s) { return Array.from(Buffer.from(s, "base64")); },
  base64DecodeWebSafe(s) { return Array.from(Buffer.from(s, "base64url")); },
  newBlob(content, type, name) { return blob(content, type, name); },
  computeDigest(alg, value) {
    const h = crypto.createHash("sha256").update(String(value)).digest();
    return Array.from(h).map(b => (b > 127 ? b - 256 : b));
  },
  computeRsaSha256Signature() { return [1, 2, 3]; },
  // HMAC de verdade. Um stub fixo aqui faria QUALQUER teste de token passar
  // (ou falhar) por motivo errado — foi o que aconteceu com o link de
  // hóspedes do China Park, onde duas reservas geravam o mesmo token.
  computeHmacSha256Signature(valor, chave) {
    const h = crypto.createHmac("sha256", Buffer.from(String(chave)))
                    .update(Buffer.from(String(valor))).digest();
    return Array.from(h).map(b => (b > 127 ? b - 256 : b));
  },
  DigestAlgorithm: { SHA_256: "SHA_256", MD5: "MD5" },
  MacAlgorithm: { HMAC_SHA_256: "HMAC_SHA_256" },
  Charset: { UTF_8: "UTF_8" },
  parseCsv(t) { return String(t).split(/\r?\n/).map(l => l.split(",")); },
  zip() { return blob("zip", "application/zip", "arquivos.zip"); },
  unzip() { return []; },
  gzip() { return blob("gz", "application/gzip", "a.gz"); }
};

function blob(content, type, name) {
  return {
    _content: content, _type: type || "application/octet-stream", _name: name || "arquivo",
    getBytes() { return Array.from(Buffer.from(String(this._content))); },
    getDataAsString() { return String(this._content); },
    getContentType() { return this._type; },
    getName() { return this._name; },
    setName(n) { this._name = n; return this; },
    getAs() { return this; },
    copyBlob() { return blob(this._content, this._type, this._name); }
  };
}

let _fileSeq = 0;
function driveFile(name, mime, parentName) {
  _fileSeq++;
  const f = {
    id: "FILE_" + _fileSeq, name, mime, parent: parentName || "raiz", trashed: false,
    getId() { return this.id; }, getName() { return this.name; },
    setName(n) { this.name = n; return this; },
    getUrl() { return "https://drive.google.com/file/d/" + this.id; },
    getDownloadUrl() { return this.getUrl(); },
    getBlob() { return blob("conteudo", this.mime, this.name); },
    getMimeType() { return this.mime; },
    getSize() { return 1024; },
    getDateCreated() { return new Date(); },
    getLastUpdated() { return new Date(); },
    setTrashed(v) { this.trashed = !!v; return this; },
    setSharing() { return this; }, addViewer() { return this; }, addEditor() { return this; },
    makeCopy(n) { return driveFile(n || this.name + " (cópia)", this.mime, this.parent); },
    getParents() { return iter([driveFolder(this.parent)]); },
    setDescription() { return this; },
    getOwner() { return { getEmail: () => "sistema@sindeducacao.com" }; }
  };
  driveFiles.push(f);
  return f;
}
function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
function driveFolder(name) {
  return {
    getId() { return "FOLDER_" + name; }, getName() { return name; },
    getUrl() { return "https://drive.google.com/drive/folders/FOLDER_" + name; },
    createFile(a, b, c) {
      if (typeof a === "object" && a && a.getName) return driveFile(a.getName(), a.getContentType(), name);
      return driveFile(String(a), c || "text/plain", name);
    },
    createFolder(n) { return driveFolder(n); },
    getFilesByName(n) { return iter(driveFiles.filter(f => f.name === n && f.parent === name)); },
    getFiles() { return iter(driveFiles.filter(f => f.parent === name)); },
    getFoldersByName() { return iter([]); },
    getFolders() { return iter([]); },
    addFile() { return this; }, removeFile() { return this; }, setSharing() { return this; },
    getParents() { return iter([]); }
  };
}

/* ───────────────────────── INSTALAÇÃO ───────────────────────── */

function install(g, opts) {
  opts = opts || {};
  const PLANILHA = opts.planilhaId || "PLANILHA_TESTE";

  g.SpreadsheetApp = {
    openById: id => _ss(id),
    openByUrl: url => _ss(String(url).split("/d/")[1] || PLANILHA),
    getActiveSpreadsheet: () => _ss(PLANILHA),
    getActive: () => _ss(PLANILHA),
    getUi: () => { throw new Error("getUi() não existe fora do editor — chamada indevida em contexto web"); },
    flush: () => {},
    newDataValidation: () => ({ requireValueInList: () => ({ setAllowInvalid: () => ({ build: () => ({}) }), build: () => ({}) }), setAllowInvalid: () => ({ build: () => ({}) }), build: () => ({}) }),
    BorderStyle: { SOLID: "SOLID" },
    ProtectionType: { SHEET: "SHEET", RANGE: "RANGE" },
    Dimension: { ROWS: "ROWS", COLUMNS: "COLUMNS" }
  };

  g.PropertiesService = {
    getScriptProperties: () => propsApi(_props.script),
    getUserProperties: () => propsApi(_props.user),
    getDocumentProperties: () => propsApi(_props.document)
  };
  g.CacheService = {
    getScriptCache: () => cacheApi(_cache.script),
    getUserCache: () => cacheApi(_cache.user),
    getDocumentCache: () => cacheApi(_cache.document)
  };
  g.LockService = {
    getScriptLock: () => lockApi("script"),
    getUserLock: () => lockApi("user"),
    getDocumentLock: () => lockApi("document")
  };
  g.Utilities = Utilities_;

  const logs = [];
  g.Logger = { log: m => logs.push(typeof m === "string" ? m : JSON.stringify(m)), clear: () => (logs.length = 0), getLog: () => logs.join("\n") };
  g.console = console;

  // A identidade Google de quem executa. Lida a cada chamada, e não fixada no
  // carregamento, porque virou trava de segurança: o caminho sem token de
  // escolaMigrarIds só passa para administrador identificado. Testar isso exige
  // trocar de identidade no meio do teste — daí __usuarioAtivoEmail.
  // Em app publicado "executar como eu / qualquer pessoa", getActiveUser()
  // devolve string vazia; é esse o caso que a string vazia representa aqui.
  // ATIVO e EFETIVO são identidades DIFERENTES, e a diferença virou trava de
  // segurança — por isso são modeladas separadas aqui:
  //
  //   getActiveUser()    quem disparou a execução. No editor, a pessoa. Num app
  //                      publicado "executar como eu / qualquer pessoa", VAZIO
  //                      para o visitante anônimo.
  //   getEffectiveUser() sob qual identidade o script roda — o dono do projeto.
  //                      Não muda com quem chama.
  //
  // Modelar as duas como a mesma coisa faria "quem executa é o dono do
  // projeto?" dar verdadeiro sempre, e o teste dessa trava passaria sem nunca
  // exercitá-la.
  g.__donoDoProjetoEmail = opts.donoDoProjeto || "financeirosindeducacao@gmail.com";
  g.Session = {
    getScriptTimeZone: () => "America/Sao_Paulo",
    getActiveUser: () => ({ getEmail: () =>
      (g.__usuarioAtivoEmail !== undefined ? g.__usuarioAtivoEmail : (opts.usuarioAtivo || "")) }),
    getEffectiveUser: () => ({ getEmail: () => g.__donoDoProjetoEmail }),
    getTemporaryActiveUserKey: () => "chave-temp"
  };

  g.MailApp = {
    sendEmail(a, b, c, d) {
      const m = (typeof a === "object") ? a : Object.assign({ to: a, subject: b, body: c }, d || {});
      outbox.push({ via: "MailApp", ...m, quando: new Date() });
    },
    getRemainingDailyQuota: () => 1500
  };
  g.GmailApp = {
    sendEmail(a, b, c, d) {
      const m = (typeof a === "object") ? a : Object.assign({ to: a, subject: b, body: c }, d || {});
      outbox.push({ via: "GmailApp", ...m, quando: new Date() });
    },
    search: () => [],
    getInboxThreads: () => [],
    getUserLabelByName: () => null,
    createLabel: n => ({ getName: () => n }),
    getMessageById: () => null,
    getAliases: () => []
  };

  g.DriveApp = {
    getFileById: id => driveFiles.find(f => f.id === id) || driveFile("arquivo-" + id, "application/pdf", "raiz"),
    getFolderById: id => driveFolder(String(id)),
    getRootFolder: () => driveFolder("raiz"),
    createFile: (a, b, c) => driveFolder("raiz").createFile(a, b, c),
    createFolder: n => driveFolder(n),
    getFilesByName: n => iter(driveFiles.filter(f => f.name === n)),
    getFoldersByName: () => iter([]),
    Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK", PRIVATE: "PRIVATE" },
    Permission: { VIEW: "VIEW", EDIT: "EDIT", NONE: "NONE" }
  };

  g.UrlFetchApp = {
    fetch(url, params) {
      fetches.push({ url: String(url), params: params || {}, quando: new Date() });
      const resp = (opts.respostasHttp && opts.respostasHttp[String(url)]) || null;
      return {
        getResponseCode: () => (resp ? resp.code || 200 : 200),
        getContentText: () => (resp ? resp.body || "{}" : "{}"),
        getBlob: () => blob(resp ? resp.body : "", "application/json", "resposta"),
        getAllHeaders: () => ({}), getHeaders: () => ({})
      };
    },
    fetchAll(reqs) { return (reqs || []).map(r => g.UrlFetchApp.fetch(r.url, r)); }
  };

  const triggersCriados = [];
  g.ScriptApp = {
    newTrigger(fn) {
      const t = { fn, tipo: null, detalhe: {} };
      const spec = {
        timeBased: () => {
          t.tipo = "TEMPO";
          const tb = {
            everyMinutes: n => { t.detalhe.minutos = n; return tb; },
            everyHours: n => { t.detalhe.horas = n; return tb; },
            everyDays: n => { t.detalhe.dias = n; return tb; },
            everyWeeks: n => { t.detalhe.semanas = n; return tb; },
            atHour: n => { t.detalhe.hora = n; return tb; },
            nearMinute: n => { t.detalhe.minuto = n; return tb; },
            onWeekDay: d => { t.detalhe.diaSemana = d; return tb; },
            at: d => { t.detalhe.em = d; return tb; },
            inTimezone: tz => { t.detalhe.tz = tz; return tb; },
            create: () => { triggersCriados.push(t); return { getUniqueId: () => "TRIG_" + triggersCriados.length }; }
          };
          return tb;
        },
        forSpreadsheet: () => spec.timeBased()
      };
      return spec;
    },
    getProjectTriggers: () => triggersCriados.map((t, i) => ({
      getHandlerFunction: () => t.fn, getUniqueId: () => "TRIG_" + (i + 1), getEventType: () => t.tipo
    })),
    deleteTrigger(tr) {
      const id = tr.getUniqueId && tr.getUniqueId();
      const idx = Number(String(id).replace("TRIG_", "")) - 1;
      if (idx >= 0) triggersCriados.splice(idx, 1);
    },
    getService: () => ({ getUrl: () => "https://script.google.com/macros/s/TESTE/exec" }),
    WeekDay: { MONDAY: "MONDAY", TUESDAY: "TUESDAY", WEDNESDAY: "WEDNESDAY", THURSDAY: "THURSDAY", FRIDAY: "FRIDAY", SATURDAY: "SATURDAY", SUNDAY: "SUNDAY" },
    EventType: { CLOCK: "CLOCK" },
    AuthMode: { FULL: "FULL", LIMITED: "LIMITED", NONE: "NONE" },
    Authorization: { AuthorizationStatus: { REQUIRED: "REQUIRED", NOT_REQUIRED: "NOT_REQUIRED" } },
    getAuthorizationInfo: () => ({ getAuthorizationStatus: () => "NOT_REQUIRED" })
  };

  const htmlOut = html => ({
    _html: html,
    setTitle() { return this; }, setXFrameOptionsMode() { return this; }, setSandboxMode() { return this; },
    addMetaTag() { return this; }, setWidth() { return this; }, setHeight() { return this; },
    setFaviconUrl() { return this; }, getContent() { return this._html; }, append(s) { this._html += s; return this; }
  });
  g.HtmlService = {
    createHtmlOutput: h => htmlOut(String(h || "")),
    createHtmlOutputFromFile: f => htmlOut("<!--arquivo:" + f + "-->"),
    createTemplateFromFile(f) {
      const tpl = { _f: f, evaluate: () => htmlOut("<!--template:" + f + "-->") };
      return new Proxy(tpl, { set: (o, k, v) => { o[k] = v; return true; } });
    },
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL", DEFAULT: "DEFAULT" },
    SandboxMode: { IFRAME: "IFRAME" }
  };
  g.ContentService = {
    createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
    MimeType: { JSON: "JSON", TEXT: "TEXT" }
  };
  g.XmlService = { parse: () => ({ getRootElement: () => ({ getChildren: () => [] }) }) };
  g.DocumentApp = {
    openById: () => { throw new Error("DocumentApp não emulado — teste que depende de template do Docs não é validável aqui"); },
    create: () => { throw new Error("DocumentApp não emulado"); }
  };
  g.CalendarApp = { getDefaultCalendar: () => ({ createEvent: () => ({ getId: () => "EV1" }) }) };
  g.MimeType = { PDF: "application/pdf", GOOGLE_DOCS: "application/vnd.google-apps.document", PLAIN_TEXT: "text/plain", CSV: "text/csv", MICROSOFT_EXCEL: "xlsx", JPEG: "image/jpeg", PNG: "image/png" };
  g.Charts = {};
  g.Browser = { msgBox: () => "ok" };

  return {
    ss: _ss(PLANILHA),
    planilhaId: PLANILHA,
    outbox, driveFiles, fetches, logs, lockEvents,
    triggers: triggersCriados,
    props: _props.script,
    reset() {
      outbox.length = 0; driveFiles.length = 0; fetches.length = 0; logs.length = 0; lockEvents.length = 0;
      _locks.script = _locks.user = _locks.document = false;
    }
  };
}

module.exports = { install, Spreadsheet, Sheet, Range, blob };
