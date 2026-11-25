/**
 * PERFIL DE GARGALOS — conta o que cada caminho do SISGEP pede ao Google.
 *
 * POR QUE EXISTE (23/11/2026): a produção ficou lenta e o histórico de
 * Execuções só dá a duração total de cada função, não onde ela gasta. Este
 * script roda o código REAL contra a planilha em memória e conta, por caminho:
 * quantas vezes abre a planilha, quantos pedidos faz, quantas células lê e
 * grava, quantos redimensionamentos, quantas gravações em Propriedades.
 *
 * No Apps Script cada chamada ao serviço de planilha é uma ida e volta ao
 * servidor do Google. Muitas chamadas e muitas células lidas = lentidão.
 *
 * O QUE MEDE: CONTAGEM de operações. O QUE NÃO MEDE: segundos — o emulador não
 * tem a latência do Google. Segundos só saem das Execuções da produção.
 *
 * Uso: node tests/perfil/perfil-gargalos.js
 */
const path = require("path");
const b = require(path.join(__dirname, "..", "e2e", "base"));
const { g, amb } = b.subir({});
b.seedUsuarios(g);

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const cont = {};
function z() { Object.keys(cont).forEach(k => delete cont[k]); }
function inc(k, n) { cont[k] = (cont[k] || 0) + (n === undefined ? 1 : n); }

/* ── ganchos nos protótipos do emulador ── */
const sh0 = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
const Sheet = Object.getPrototypeOf(sh0);
const Range = Object.getPrototypeOf(sh0.getRange(1, 1));
const Spreadsheet = Object.getPrototypeOf(ss);
function gancho(proto, nome, fn) {
  const orig = proto[nome]; if (!orig) return;
  proto[nome] = function () { fn.apply(this, arguments); return orig.apply(this, arguments); };
}
gancho(Sheet, "getRange", () => inc("pedidos de intervalo"));
gancho(Sheet, "getDataRange", () => inc("pedidos de intervalo"));
gancho(Sheet, "appendRow", function () { inc("gravações de linha"); inc("  ↳ appendRow em: " + (this.getName ? this.getName() : "?") + " (linhas: " + (this.getLastRow ? this.getLastRow() : "?") + ")"); });
gancho(Sheet, "autoResizeColumn", () => inc("autoResizeColumn"));
gancho(Sheet, "setFrozenRows", () => inc("setFrozenRows"));
gancho(Sheet, "getLastRow", () => inc("getLastRow/Column"));
gancho(Sheet, "getLastColumn", () => inc("getLastRow/Column"));
gancho(Sheet, "deleteRows", () => inc("deleteRows"));
gancho(Spreadsheet, "getSheetByName", () => inc("getSheetByName"));
gancho(Spreadsheet, "getSheets", () => inc("getSheets"));
const getV = Range.getValues;
Range.getValues = function () { const r = getV.apply(this, arguments); inc("leituras (getValues)"); inc("CÉLULAS lidas", (r.length || 0) * ((r[0] && r[0].length) || 0)); return r; };
const setV = Range.setValues;
Range.setValues = function (v) { inc("gravações (setValues)"); inc("CÉLULAS gravadas", (v.length || 0) * ((v[0] && v[0].length) || 0)); return setV.apply(this, arguments); };
gancho(Range, "setValue", () => { inc("gravações (setValue)"); inc("CÉLULAS gravadas"); });

const oSS = g.SpreadsheetApp.openById;
g.SpreadsheetApp.openById = function (id) { inc("openById (abrir planilha)"); return oSS.apply(this, arguments); };

const PS = g.PropertiesService.getScriptProperties();
const wrapPS = (nome, chave) => { const o = PS[nome]; if (!o) return; PS[nome] = function () { inc(chave); return o.apply(this, arguments); }; };
wrapPS("setProperty", "Propriedades: GRAVAR"); wrapPS("getProperty", "Propriedades: ler 1");
wrapPS("getProperties", "Propriedades: ler TODAS"); wrapPS("deleteProperty", "Propriedades: apagar");
const oF = g.UrlFetchApp && g.UrlFetchApp.fetch;
if (oF) g.UrlFetchApp.fetch = function () { inc("UrlFetch (rede externa)"); return oF.apply(this, arguments); };
const oL = g.LockService && g.LockService.getScriptLock;
if (oL) g.LockService.getScriptLock = function () { inc("LockService"); return oL.apply(this, arguments); };

/* ── volume realista (CLAUDE.md: ~8.000 associados, 679 escolas) ── */
function semear(nome, cab, n, gera) {
  let sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  const linhas = [];
  for (let i = 0; i < n; i++) linhas.push(gera(i));
  sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
}
g.setupVoucherModuleFase1();
const cabSol = ss.getSheetByName("Voucher_Solicitacoes").getRange(1, 1, 1, ss.getSheetByName("Voucher_Solicitacoes").getLastColumn()).getValues()[0];
semear("Voucher_Solicitacoes", cabSol, 600, i => cabSol.map(c => c === "ID_SOLICITACAO" ? "SOL-" + i : c === "NUMERO_PROTOCOLO" ? "VCH-" + i : "x" + i));
semear("Associados", ["CPF", "NOME", "EMAIL", "TELEFONE", "ESCOLA", "STATUS", "CIDADE", "CARGO", "DATA"], 8000, i => ["" + i, "Nome " + i, "e" + i + "@x.com", "27999", "Escola " + (i % 679), "ATIVO", "Vitória", "Prof", "2020-01-01"]);
semear("Escolas", ["Escola (Razão Social)", "CNPJ", "E-mail (principal)", "UF"], 679, i => ["Escola " + i, "" + i, "e" + i + "@e.com", "ES"]);

const ADM = b.logar(g, "wanderson");
const resultados = [];
function medir(nome, fn) {
  z(); let erro = "";
  try { fn(); } catch (e) { erro = " (erro: " + String(e.message).slice(0, 70) + ")"; }
  resultados.push({ nome: nome + erro, c: Object.assign({}, cont) });
}

medir("1. autenticarUsuario (login)", () => g.autenticarUsuario("wanderson", "Senha@2026"));
medir("2. getSessaoUsuario (cada chamada de tela)", () => g.getSessaoUsuario(ADM));
medir("3. exigirModulo_ (porta de TODA função)", () => g.exigirModulo_(ADM, "beneficios", false));
medir("4. doGet (abrir página, sem parâmetro)", () => g.doGet({ parameter: {} }));
medir("5. doPost abrirSessao (entrar no portal)", () => g.doPost({ parameter: { acao: "abrirSessao", sessao: ADM }, parameters: {} }));
medir("6. voucherPrepararEnvio", () => g.voucherPrepararEnvio("VCH-5", ADM));
medir("7. listarSolicitacoesCertBolsa (1ª chamada)", () => g.listarSolicitacoesCertBolsa(ADM));
medir("8. listarSolicitacoesCertBolsa (2ª chamada)", () => g.listarSolicitacoesCertBolsa(ADM));
medir("9. voucherPedidosPainel", () => g.voucherPedidosPainel && g.voucherPedidosPainel(ADM));
medir("10. processarFilaEnvioOficios (rotina de 5 em 5 min)", () => g.processarFilaEnvioOficios());

const extras = (c) => Object.keys(c).filter(k => k.indexOf("↳") > -1);
const ordem = ["openById (abrir planilha)", "getSheetByName", "pedidos de intervalo", "leituras (getValues)", "CÉLULAS lidas",
  "gravações (setValues)", "gravações (setValue)", "gravações de linha", "CÉLULAS gravadas", "autoResizeColumn", "setFrozenRows",
  "Propriedades: GRAVAR", "Propriedades: ler TODAS", "Propriedades: ler 1", "LockService", "UrlFetch (rede externa)"];
console.log("\nPERFIL DE OPERAÇÕES POR CAMINHO (contagem; segundos NÃO medidos)\n");
resultados.forEach(r => {
  console.log("■ " + r.nome);
  const linhas = ordem.concat(extras(r.c)).filter(k => r.c[k]).map(k => "    " + String(r.c[k]).padStart(8) + "  " + k);
  console.log(linhas.length ? linhas.join("\n") : "    (nenhuma operação de planilha/propriedade)");
});
