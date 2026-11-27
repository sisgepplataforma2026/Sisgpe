/**
 * TODA FUNÇÃO CHAMADA EXISTE? (10/11/2026). O usuário: "eu sempre peço que você
 * faça auditoria de todas as funções, o que é chamado, do que é proposto ...
 * isso não pode acontecer" — depois de achar formatarDataExtensoBR, que
 * Recibo.gs e ReciboDiversos.gs chamavam e nunca existiu.
 *
 * Estático (lê o código, não roda): em todo .gs e em todo <script> dos .html,
 * cada função chamada pelo nome precisa estar declarada em algum lugar; cada
 * google.script.run.X da tela precisa ser função de servidor PÚBLICA (o Apps
 * Script não deixa o navegador chamar função terminada em "_").
 * As exceções abaixo foram conferidas uma a uma e têm o motivo escrito.
 * NÃO PROVA: que a função faz o que promete — isso é dos testes de fluxo.
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
let acorn, walk;
try { acorn = require("acorn"); walk = require("acorn-walk"); } catch (e) {
  b.fluxo("AUDITORIA · toda função chamada existe"); b.naoTestavel("a auditoria", "acorn não instalado — rode: npm install"); b.resumo(); process.exit(process.exitCode || 0);
}
const RAIZ = path.join(__dirname, "..", "..");
const BROWSER = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, "navegador-globais.json"), "utf8")));
const JSBUILT = new Set(Object.getOwnPropertyNames(globalThis).concat(["require", "arguments", "undefined", "NaN", "Infinity", "eval", "isNaN", "isFinite",
  "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI", "escape", "unescape", "Date", "Math", "JSON", "Array", "Object",
  "String", "Number", "Boolean", "RegExp", "Error", "TypeError", "RangeError", "Promise", "Symbol", "Map", "Set", "WeakMap", "Function", "Intl", "setTimeout", "setInterval", "clearTimeout", "clearInterval"]));
const GAS = new Set(["SpreadsheetApp", "DriveApp", "GmailApp", "MailApp", "Utilities", "Session", "PropertiesService", "CacheService", "LockService", "ScriptApp",
  "HtmlService", "UrlFetchApp", "ContentService", "Logger", "console", "DocumentApp", "CalendarApp", "Charts", "XmlService", "Browser", "FormApp", "SlidesApp",
  "Drive", "Gmail", "Sheets", "BigQuery", "AdminDirectory", "People", "Calendar", "Docs", "Maps", "LanguageApp", "GroupsApp", "ContactsApp", "SitesApp", "Jdbc", "Blob", "Console"]);

function arquivos(dir, ext) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (["node_modules", "tests", ".git", "scratchpad", "docs", "leitor-secretaria"].includes(f)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...arquivos(p, ext)); else if (f.endsWith(ext)) out.push(p);
  }
  return out;
}
function parse(src) {
  for (const sourceType of ["script", "module"]) {
    try { return acorn.parse(src, { ecmaVersion: "latest", sourceType, allowReturnOutsideFunction: true, allowHashBang: true, locations: true }); } catch (e) { if (sourceType === "module") return null; }
  }
}
/* declarações no topo (globais) e todas as locais do arquivo */
function coletar(ast) {
  const globais = new Set(), locais = new Set();
  for (const n of ast.body) {
    if (n.type === "FunctionDeclaration" && n.id) globais.add(n.id.name);
    if (n.type === "VariableDeclaration") n.declarations.forEach(d => d.id && d.id.name && globais.add(d.id.name));
    if (n.type === "ClassDeclaration" && n.id) globais.add(n.id.name);
    /* window.X = / this.X = / X = (atribuição global) */
    if (n.type === "ExpressionStatement") marcarAtrib(n.expression, globais);
  }
  walk.full(ast, n => {
    if ((n.type === "FunctionDeclaration" || n.type === "FunctionExpression") && n.id) locais.add(n.id.name);
    if (n.type === "VariableDeclarator" && n.id && n.id.name) locais.add(n.id.name);
    if (n.type === "VariableDeclarator" && n.id && n.id.type === "ObjectPattern") n.id.properties.forEach(p => p.value && p.value.name && locais.add(p.value.name));
    if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(n.type)) n.params.forEach(p => p.name ? locais.add(p.name) : (p.left && p.left.name && locais.add(p.left.name)));
    if (n.type === "CatchClause" && n.param && n.param.name) locais.add(n.param.name);
    if (n.type === "AssignmentExpression") marcarAtrib(n, globais);
  });
  return { globais, locais };
}
function marcarAtrib(e, set) {
  if (!e || e.type !== "AssignmentExpression") return;
  const l = e.left;
  if (l.type === "Identifier") set.add(l.name);
  if (l.type === "MemberExpression" && !l.computed && l.object.type === "Identifier" && ["window", "self", "globalThis", "this"].includes(l.object.name)) set.add(l.property.name);
  if (l.type === "MemberExpression" && !l.computed && l.object.type === "ThisExpression") set.add(l.property.name);
}
function chamadas(ast) {
  const out = [];
  walk.full(ast, n => {
    if (n.type === "CallExpression" && n.callee.type === "Identifier") out.push({ nome: n.callee.name, linha: n.loc.start.line });
    if (n.type === "NewExpression" && n.callee.type === "Identifier") out.push({ nome: n.callee.name, linha: n.loc.start.line });
  });
  return out;
}

/* ── SERVIDOR ── */
const gs = arquivos(RAIZ, ".gs").map(f => ({ f, src: fs.readFileSync(f, "utf8") }));
const globaisGs = new Set(); const porArq = {};
gs.forEach(a => { const ast = parse(a.src); if (!ast) { console.log("NÃO LÊ:", a.f); return; } a.ast = ast; const c = coletar(ast); a.c = c; c.globais.forEach(n => globaisGs.add(n)); });
const faltaGs = {};
gs.forEach(a => {
  if (!a.ast) return;
  chamadas(a.ast).forEach(c => {
    if (globaisGs.has(c.nome) || a.c.locais.has(c.nome) || JSBUILT.has(c.nome) || GAS.has(c.nome)) return;
    (faltaGs[c.nome] = faltaGs[c.nome] || []).push(path.basename(a.f) + ":" + c.linha);
  });
});

/* ── TELA (.html, todos os <script> num escopo só) ── */
const html = arquivos(RAIZ, ".html").map(f => ({ f, src: fs.readFileSync(f, "utf8") }));
const globaisH = new Set(), blocos = [], runs = [];
html.forEach(a => {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(a.src))) {
    let code = m[1].replace(/<\?[\s\S]*?\?>/g, "0");
    const linha0 = a.src.slice(0, m.index).split("\n").length;
    const ast = parse(code); if (!ast) continue;
    const c = coletar(ast); c.globais.forEach(n => globaisH.add(n));
    blocos.push({ f: a.f, ast, c, linha0, code });
  }
  /* google.script.run ... .nome( */
  const rr = /google\.script\.run(?:\s*\.\s*(?:withSuccessHandler|withFailureHandler|withUserObject)\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))*\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g; let r;
  while ((r = rr.exec(a.src))) runs.push({ nome: r[1], onde: path.basename(a.f) + ":" + a.src.slice(0, r.index).split("\n").length });
});
const faltaH = {};
blocos.forEach(b => chamadas(b.ast).forEach(c => {
  if (globaisH.has(c.nome) || b.c.locais.has(c.nome) || BROWSER.has(c.nome) || JSBUILT.has(c.nome)) return;
  (faltaH[c.nome] = faltaH[c.nome] || []).push(path.basename(b.f) + ":" + (b.linha0 + c.linha - 1));
}));
const faltaRun = {}, privadaRun = {};
runs.forEach(r => {
  if (["withSuccessHandler", "withFailureHandler", "withUserObject"].includes(r.nome)) return;
  if (!globaisGs.has(r.nome)) (faltaRun[r.nome] = faltaRun[r.nome] || []).push(r.onde);
  else if (/_$/.test(r.nome)) (privadaRun[r.nome] = privadaRun[r.nome] || []).push(r.onde);
});

/* Conferidas uma a uma em 10/11/2026 — não são defeito (ou são legado documentado). */
const ACEITAS = {
  registrarAuditoria: "protegida por typeof (ArquivoDrive.gs)",
  emailCore_enviar_: "protegida por typeof (BingoInscricao.gs)",
  obterDadosEscolaParaExportacao_: "protegida por typeof (SistemaExportacao.gs)",
  criarAbaEscolaExportacao_: "protegida por typeof (SistemaExportacao.gs)",
  garantirAbaGuiasPagamento_: "GuiasPagamento.gs é LEGADO (cabeçalho); só o pixel antigo usa, dentro de try",
  mapearCabecalhoGuia_: "GuiasPagamento.gs é LEGADO",
  formatarDataHoraBRGuia_: "GuiasPagamento.gs é LEGADO",
  enviarAlerteLimiteDiario: "TaxaAssistencial.gs, dentro de try — o aviso nunca saiu; decisão pendente com o usuário",
  Chart: "biblioteca carregada por <script src> (Chart.js)",
  QRCode: "biblioteca carregada por <script src>",
  BarcodeDetector: "API do navegador (Chrome), usada só onde existe",
  initHistorico: "protegida por typeof", atualizarResumoTrabalhadores: "protegida por typeof", sincronizarFichasGlobais: "protegida por typeof",
  showToast: "protegida por typeof", normalizarTelefoneFrontend: "protegida por typeof", limparForm: "protegida por typeof",
  esconderTodosOsBlocos_: "CentralemailIA.html — tela legada (Painel do Dia saiu do menu em 03/11/2026)",
  dashboardExecutivoGeral: "Scripts_Dash.html não é incluído em nenhuma tela (legado)"
};
b.fluxo("AUDITORIA · toda função chamada existe");
const novos = [];
[["servidor", faltaGs], ["tela", faltaH], ["tela → servidor", faltaRun]].forEach(([onde, m]) =>
  Object.keys(m).forEach(n => { if (!ACEITAS[n]) novos.push(onde + ": " + n + " (" + m[n].slice(0, 3).join(", ") + ")"); }));
b.ok(gs.length > 150 && html.length > 80 && runs.length > 400, "leu o projeto inteiro", gs.length + " .gs · " + html.length + " .html · " + runs.length + " chamadas da tela ao servidor");
b.igual(novos, [], "nenhuma função chamada que não existe (fora as exceções conferidas)");
b.igual(Object.keys(privadaRun), [], "a tela não chama função privada do servidor (terminada em _)");
b.resumo();
process.exit(process.exitCode || 0);
