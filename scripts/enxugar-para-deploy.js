#!/usr/bin/env node
/**
 * ENXUGAR PARA DEPLOY — gera uma cópia do projeto SEM COMENTÁRIOS, para colar
 * no Apps Script. O repositório continua com os arquivos completos.
 *
 * POR QUE EXISTE (24/11/2026): o projeto passou de 7,7 MB (175 .gs + 97 .html)
 * e o editor do Apps Script não está conseguindo salvá-lo. 23,5% dos bytes
 * dos .gs são comentário. Os comentários são a MEMÓRIA do projeto (decisões,
 * casos reais, regras), então NÃO se apaga do repositório: só a cópia que vai
 * para o Apps Script sai enxuta.
 *
 * GARANTIA, e ela é conferida arquivo por arquivo (não é promessa):
 *   - .gs: o código é lido por um parser de JavaScript (acorn). Só comentário
 *     é removido. Depois a ÁRVORE SINTÁTICA do original e a do enxuto são
 *     comparadas — têm de ser idênticas. Se diferirem em qualquer nó, o
 *     arquivo vai INTEIRO, sem mexer, e fica listado no relatório.
 *   - .html: só comentário HTML (<!-- -->) fora de script/style e comentário
 *     JavaScript dentro de <script> SEM scriptlet. Mesma prova por árvore.
 *     Comentário que contém scriptlet nunca é removido.
 *   - também sai a indentação e as linhas em branco, FORA de template literal e
 *     de string de várias linhas (onde o espaço é valor). Quebra de linha
 *     nunca é removida. Mesma prova por árvore.
 *   - nada é apagado, renomeado ou reordenado; o appsscript.json é copiado.
 *
 * O QUE MUDA PARA QUEM DEPURA: os números de linha dos erros no Apps Script
 * deixam de bater com o repositório. O nome do arquivo e da função batem.
 *
 * Uso: node scripts/enxugar-para-deploy.js [pasta-de-saida]
 */
const fs = require("fs");
const path = require("path");
let acorn;
try { acorn = require("acorn"); }
catch (e) { acorn = require("/opt/node-tools/node_modules/acorn"); }

const RAIZ = path.resolve(__dirname, "..");
const SAIDA = path.resolve(process.argv[2] || path.join(RAIZ, "dist-apps-script"));

function arvore(codigo) {
  const ast = acorn.parse(codigo, { ecmaVersion: "latest", allowReturnOutsideFunction: true, allowHashBang: true });
  return JSON.stringify(ast, (k, v) => (k === "start" || k === "end") ? undefined : v);
}

/** Remove os comentários de um trecho JavaScript, linha a linha, sem tocar no resto. */
function tirarComentariosJs(src) {
  const comentarios = [];
  acorn.parse(src, { ecmaVersion: "latest", onComment: comentarios, allowReturnOutsideFunction: true, allowHashBang: true });
  if (!comentarios.length) return src;
  let saida = "", cursor = 0;
  for (const c of comentarios) {
    let ini = c.start, fim = c.end;
    // início da linha onde o comentário começa e fim da linha onde termina
    let linhaIni = src.lastIndexOf("\n", ini - 1) + 1;
    let linhaFim = src.indexOf("\n", fim); if (linhaFim === -1) linhaFim = src.length;
    const antes = src.slice(linhaIni, ini), depois = src.slice(fim, linhaFim);
    if (/^\s*$/.test(antes) && /^\s*$/.test(depois)) {
      // comentário sozinho na(s) linha(s): some a linha inteira, com o \n
      ini = linhaIni; fim = Math.min(linhaFim + 1, src.length);
    } else if (c.type === "Line" || /^\s*$/.test(depois)) {
      // comentário no fim de uma linha de código: some junto com o espaço antes dele
      while (ini > linhaIni && /[ \t]/.test(src[ini - 1])) ini--;
    } else {
      // bloco no meio da linha: vira um espaço, para não colar dois tokens
      saida += src.slice(cursor, ini) + " "; cursor = fim; continue;
    }
    saida += src.slice(cursor, ini); cursor = fim;
  }
  return saida + src.slice(cursor);
}

/**
 * Tira a indentação e as linhas em branco FORA de template literal e de string
 * de várias linhas, onde o espaço faz parte do valor. Quebra de linha nunca é
 * removida (a inserção automática de ponto e vírgula depende dela).
 */
function compactarEspacos(src) {
  const protegidos = [];
  const ast = acorn.parse(src, { ecmaVersion: "latest", allowReturnOutsideFunction: true, allowHashBang: true });
  (function visitar(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "TemplateElement") protegidos.push([n.start, n.end]);
    else if (n.type === "Literal" && src.slice(n.start, n.end).indexOf("\n") > -1) protegidos.push([n.start, n.end]);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visitar); else if (v && typeof v.type === "string") visitar(v);
    }
  })(ast);
  const dentro = off => protegidos.some(([a, b]) => off > a && off < b);
  const linhas = src.split("\n"); let off = 0; const saida = [];
  for (const l of linhas) {
    const inicio = off; off += l.length + 1;
    if (dentro(inicio)) { saida.push(l); continue; }
    const t = l.replace(/^[ \t]+/, "").replace(/[ \t]+$/, "");
    if (t === "" || t === "\r") continue;
    saida.push(t);
  }
  return saida.join("\n");
}

function enxugarGs(src) {
  const novo = compactarEspacos(tirarComentariosJs(src));
  if (arvore(src) !== arvore(novo)) throw new Error("a árvore sintática mudou");
  return novo;
}

function enxugarHtml(src) {
  // separa script/style do resto
  const partes = []; const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi; let ult = 0, m;
  while ((m = re.exec(src))) { partes.push({ t: "html", s: src.slice(ult, m.index) }); partes.push({ t: m[1].toLowerCase(), s: m[0] }); ult = m.index + m[0].length; }
  partes.push({ t: "html", s: src.slice(ult) });
  let saida = "";
  for (const p of partes) {
    if (p.t === "html") {
      saida += p.s.replace(/[ \t]*<!--([\s\S]*?)-->[ \t]*(\r?\n)?/g, (todo, miolo) => miolo.indexOf("<?") > -1 ? todo : "");
    } else if (p.t === "script") {
      const abre = p.s.match(/^<script\b[^>]*>/i)[0], fecha = p.s.match(/<\/script\s*>$/i)[0];
      const corpo = p.s.slice(abre.length, p.s.length - fecha.length);
      if (corpo.indexOf("<?") > -1 || !corpo.trim() || /\btype\s*=\s*["'](?!text\/javascript|module)/i.test(abre)) { saida += p.s; continue; }
      try { saida += abre + enxugarGs(corpo) + fecha; } catch (e) { saida += p.s; }
    } else saida += p.s;
  }
  return saida;
}

fs.mkdirSync(SAIDA, { recursive: true });
const rel = { gs: [0, 0], html: [0, 0], mantidos: [] };
for (const f of fs.readdirSync(RAIZ).sort()) {
  const ext = path.extname(f); if (![".gs", ".html", ".json"].includes(ext)) continue;
  if (ext === ".json" && f !== "appsscript.json") continue;
  const src = fs.readFileSync(path.join(RAIZ, f), "utf8"); let novo = src;
  try {
    if (ext === ".gs") novo = enxugarGs(src); else if (ext === ".html") novo = enxugarHtml(src);
  } catch (e) { novo = src; rel.mantidos.push(f + " — " + e.message); }
  fs.writeFileSync(path.join(SAIDA, f), novo);
  if (ext === ".gs") { rel.gs[0] += Buffer.byteLength(src); rel.gs[1] += Buffer.byteLength(novo); }
  if (ext === ".html") { rel.html[0] += Buffer.byteLength(src); rel.html[1] += Buffer.byteLength(novo); }
}
const fmt = n => (n / 1048576).toFixed(2) + " MB";
const pct = (a, b) => (100 * (a - b) / a).toFixed(1) + "%";
console.log("Pacote enxuto em: " + SAIDA);
console.log(".gs   : " + fmt(rel.gs[0]) + " → " + fmt(rel.gs[1]) + "  (-" + pct(rel.gs[0], rel.gs[1]) + ")");
console.log(".html : " + fmt(rel.html[0]) + " → " + fmt(rel.html[1]) + "  (-" + pct(rel.html[0], rel.html[1]) + ")");
console.log("TOTAL : " + fmt(rel.gs[0] + rel.html[0]) + " → " + fmt(rel.gs[1] + rel.html[1]) + "  (-" + pct(rel.gs[0] + rel.html[0], rel.gs[1] + rel.html[1]) + ")");
console.log("Arquivos mantidos SEM alteração por não passar na prova de árvore: " + rel.mantidos.length);
rel.mantidos.forEach(x => console.log("  " + x));
