/**
 * PERFIL DA CARGA GLOBAL — o que roda ANTES de qualquer função, em TODA execução.
 *
 * No Apps Script os 97 arquivos .gs são avaliados no início de cada execução
 * (inclusive de gatilhos). Chamada a serviço do Google em nível superior paga
 * o preço sempre. Este script carrega os arquivos como a produção e conta as
 * chamadas a serviços feitas durante a carga, por arquivo.
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const gas = require("../e2e/gas");
const RAIZ = path.resolve(__dirname, "..", "..");
const ctx = { setTimeout, clearTimeout, Buffer, process, JSON, Math, Date, RegExp, Error, TypeError, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, String, Number, Boolean, Object, Array, Function, Symbol, Map, Set, Promise, crypto: require("crypto") };
ctx.globalThis = ctx; vm.createContext(ctx); gas.install(ctx, {});

let atual = "", porArquivo = {};
function espiar(obj, nomeObj) {
  if (!obj) return;
  Object.keys(obj).forEach(k => {
    if (typeof obj[k] !== "function") return;
    const o = obj[k];
    obj[k] = function () { const c = porArquivo[atual] = porArquivo[atual] || {}; const n = nomeObj + "." + k; c[n] = (c[n] || 0) + 1; return o.apply(this, arguments); };
  });
}
["SpreadsheetApp", "DriveApp", "UrlFetchApp", "MailApp", "GmailApp", "LockService", "ScriptApp", "DocumentApp", "CalendarApp"].forEach(n => espiar(ctx[n], n));
["getScriptProperties", "getUserProperties", "getDocumentProperties"].forEach(n => {
  const o = ctx.PropertiesService[n]; ctx.PropertiesService[n] = function () { const c = porArquivo[atual] = porArquivo[atual] || {}; c["PropertiesService." + n] = (c["PropertiesService." + n] || 0) + 1; return o.apply(this, arguments); };
});
const oc = ctx.CacheService.getScriptCache; ctx.CacheService.getScriptCache = function () { const c = porArquivo[atual] = porArquivo[atual] || {}; c["CacheService.getScriptCache"] = (c["CacheService.getScriptCache"] || 0) + 1; return oc.apply(this, arguments); };

const arquivos = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs")).sort();
let total = 0;
for (const arq of arquivos) {
  atual = arq;
  try { vm.runInContext(fs.readFileSync(path.join(RAIZ, arq), "utf8"), ctx, { filename: arq }); } catch (e) {}
}
console.log("Arquivos .gs carregados: " + arquivos.length);
const lista = Object.keys(porArquivo);
if (!lista.length) console.log("NENHUMA chamada a serviço do Google durante a carga global.");
lista.forEach(a => { console.log("■ " + a); Object.keys(porArquivo[a]).forEach(k => { console.log("    " + porArquivo[a][k] + "×  " + k); total += porArquivo[a][k]; }); });
console.log("\nTOTAL de chamadas a serviços na carga global: " + total);
