/**
 * Carrega TODOS os arquivos .gs do SISGEP num único escopo global — que é
 * exatamente como o Apps Script funciona — e devolve esse escopo para os testes.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gas = require("./gas");

const RAIZ = "/home/user/Sisgpe";

function carregar(opts) {
  opts = opts || {};
  const contexto = { setTimeout, clearTimeout, Buffer, process, JSON, Math, Date, RegExp, Error, TypeError, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, String, Number, Boolean, Object, Array, Function, Symbol, Map, Set, Promise, crypto: require("crypto") };
  contexto.globalThis = contexto;
  vm.createContext(contexto);

  const amb = gas.install(contexto, opts);

  const arquivos = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs")).sort();
  const ignorar = new Set(opts.ignorar || []);
  const carregados = [];
  const falhas = [];

  for (const arq of arquivos) {
    if (ignorar.has(arq)) continue;
    const src = fs.readFileSync(path.join(RAIZ, arq), "utf8");
    try {
      vm.runInContext(src, contexto, { filename: arq });
      carregados.push(arq);
    } catch (e) {
      falhas.push({ arquivo: arq, erro: String(e && e.message || e) });
    }
  }

  return { g: contexto, amb, carregados, falhas };
}

module.exports = { carregar, RAIZ };
