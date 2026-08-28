/**
 * Carrega TODOS os arquivos .gs do SISGEP num único escopo global — que é
 * exatamente como o Apps Script funciona — e devolve esse escopo para os testes.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gas = require("./gas");

/* A RAIZ SAI DO LOCAL DESTE ARQUIVO, NUNCA DE UM CAMINHO DE MÁQUINA.
   Aqui havia "/home/user/Sisgpe" cravado. Funcionava na minha máquina e
   estourava em qualquer outra: no runner do GitHub o repositório fica em
   /home/runner/work/Sisgpe/Sisgpe, e todo teste que sobe o emulador
   morria com ENOENT antes da primeira asserção. Foi o CI que achou, no
   primeiro deploy de homologação — 19/08/2026. */
const RAIZ = require("path").resolve(__dirname, "..", "..");

function carregar(opts) {
  opts = opts || {};
  const contexto = { setTimeout, clearTimeout, Buffer, process, JSON, Math, Date, RegExp, Error, TypeError, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, String, Number, Boolean, Object, Array, Function, Symbol, Map, Set, Promise, crypto: require("crypto") };
  contexto.globalThis = contexto;
  vm.createContext(contexto);

  const amb = gas.install(contexto, opts);

  /* O envio de Ofícios exige, corretamente, que secretaria@sindeducacao.com
     seja o usuário efetivo ou um alias Gmail autorizado. Nos testes de fluxo
     positivo (t56/t57), o emulador precisa reproduzir essa pré-condição real;
     caso contrário ele reprova antes de chegar ao comportamento que o teste
     quer medir (anexos e filaId). Para testes de recusa, basta subir com
     { gmailAliases: [] }. Isso NÃO altera a trava do código de produção. */
  const gmailAliases = Object.prototype.hasOwnProperty.call(opts, "gmailAliases")
    ? (Array.isArray(opts.gmailAliases) ? opts.gmailAliases.slice() : [])
    : ["secretaria@sindeducacao.com"];
  if (contexto.GmailApp) {
    contexto.GmailApp.getAliases = () => gmailAliases.slice();
  }

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
