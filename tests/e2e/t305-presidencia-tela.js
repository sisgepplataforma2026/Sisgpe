/**
 * ÁREA DA PRESIDÊNCIA · TELA DO CELULAR (PresidenciaIngressosTela.html) em jsdom, com o servidor de verdade (emulador), base/filas/robô FALSOS.
 * Prova: entra com o link, mostra o nome e o limite; adicionar nomes (só nome e categoria); conferir; gerar com confirmação; Meus ingressos com
 * Ver/Compartilhar/PDF/Corrigir/Cancelar quando pronto; cancelar com confirmação; link inválido não mostra nada.
 * NÃO PROVA: o visual real no celular, o Compartilhar nativo, o robô nem o TickOne.
 */
const b = require("./base");
const dom = require("./dom");
const fs = require("fs");
if (!dom.jsdomDisponivel()) { b.fluxo("PRESIDÊNCIA · tela"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { JSDOM } = require("jsdom");
const { g } = b.subir({});
b.seedUsuarios(g);
const agora = new Date().toISOString();
let BASE = { lidoEm: agora, evento: "x", total: 1, linhas: [{ nome: "Francisco Primo", cpf: "", tel: "", codigo: "AAAA-0001", tipo: "Convite", escola: "", cidade: "", ref: "R1", zap: 0 }] };
g.cingLerBase_ = () => JSON.parse(JSON.stringify(BASE)); g.cingFilaPronta_ = () => true; g.cingGravarFila_ = () => {};
g.cingDispararRobo_ = () => ({ acionado: true, motivo: "" }); g.cingPdfs_ = () => ({ "ademir carlos pin": "https://drive.google.com/file/d/ID1/view" });
g.cingSincronizarEmissoes_ = () => 0; g.cingSincronizarResultado_ = () => 0;
const TOK = "k".repeat(32);
g.presRegistrarAcesso_("Presidente", TOK);
const espera = (ms) => new Promise(r => setTimeout(r, ms));
(async function () {
  b.fluxo("PRESIDÊNCIA · tela");
  // o script já rodou na criação do JSDOM, antes do google existir: recarrega com o google injetado
  const html = fs.readFileSync(dom.RAIZ + "/PresidenciaIngressosTela.html", "utf8").replace("__PRES_K__", TOK);
  const chamadas = [];
  const virt = new (require("jsdom").VirtualConsole)();
  const w = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: virt, beforeParse(win) {
    function runner() { let ok = null, falha = null;
      const p = new Proxy({}, { get(_, fn) {
        if (fn === "withSuccessHandler") return (f) => { ok = f; return p; };
        if (fn === "withFailureHandler") return (f) => { falha = f; return p; };
        return (...args) => { chamadas.push({ fn, args }); setTimeout(() => { try { ok && ok(JSON.parse(JSON.stringify(g[fn](...args)))); } catch (e) { falha && falha(e); } }, 0); };
      } }); return p; }
    Object.defineProperty(win, "google", { value: { script: { get run() { return runner(); } } } });
  } }).window;
  const d = w.document, $ = (id) => d.getElementById(id);
  const clicar = (el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await espera(40);
  b.ok(/presidente/.test($("oi").textContent), "mostra 'Olá, presidente!'", $("oi").textContent);
b.ok(!$("kEmit") && !$("kHoje") && !$("kLim") && !/Ingressos emitidos|limite/i.test($("tInicio").textContent), "NÃO mostra totais nem limite (decisão do usuário: ele não vê a quantidade)");
  b.ok(!/CPF/i.test(d.body.textContent) && !!$("aTel"), "a tela não pede CPF e pede o telefone (obrigatório para o TickOne)");
  clicar($("bAdd")); b.ok($("tAdd").classList.contains("on"), "Adicionar convidados abre a tela de cadastro");
  $("aNome").value = "Zé"; $("aTel").value = "27999990001"; clicar($("aAdd")); b.igual($("aQtd").textContent, "0", "nome curto não entra");
  $("aNome").value = "Nome Sem Telefone"; $("aTel").value = ""; clicar($("aAdd")); b.igual($("aQtd").textContent, "0", "sem telefone não entra na lista");
  $("aNome").value = "Ademir Carlos Pin"; $("aTel").value = "27999139936"; clicar($("aAdd"));
  $("aNome").value = "Francisco Primo"; $("aTel").value = "27999161454"; clicar(d.querySelector('#aCat [data-v="acompanhante"]')); clicar($("aAdd"));
  b.igual($("aQtd").textContent, "2", "dois nomes na lista, só com nome e categoria");
  b.ok(!$("aConf").disabled, "Conferir e gerar acende");
  clicar($("aConf")); await espera(60);
  b.ok($("tConf").classList.contains("on") && /Ademir/.test($("cLista").textContent) && /emitir mesmo/.test($("cLista").textContent), "conferência: um novo e um 'emitir mesmo' (mesmo nome da base)");
  b.ok($("cGerar").textContent === "Gerar 1 ingresso", "o botão conta só o que vai ser gerado", $("cGerar").textContent);
  const casa = d.querySelector("[data-f]"); casa.checked = true; casa.dispatchEvent(new w.Event("change", { bubbles: true }));
  b.ok($("cGerar").textContent === "Gerar 2 ingressos", "marcar 'emitir mesmo' soma");
  clicar($("cGerar")); b.ok($("ov").classList.contains("on") && /cria ingresso de verdade/.test($("ovP").textContent), "pede confirmação antes de gerar");
  clicar($("ovSim")); await espera(80);
  b.ok($("tMeus").classList.contains("on") && g.cingEmissoes_().length === 2, "gerou 2 pedidos e abriu Meus ingressos");
  b.ok(chamadas.some(c => c.fn === "presidencia_gerar" && c.args[2] === true), "só chamou o servidor com a confirmação");
  b.passo("Meus ingressos");
  const l = g.cingEmissoes_().filter(o => o.NOME === "Ademir Carlos Pin")[0];
  g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName(g.CING_ABA_EMIS).getRange(l._linha, 11, 1, 2).setValues([["EMITIDO", "AAAA-0400"]]);
  BASE.linhas.push({ nome: "Ademir Carlos Pin", cpf: "", tel: "", codigo: "AAAA-0400", tipo: "Convite", escola: "", cidade: "", ref: "R4", zap: 0 });
  clicar(d.querySelector('.nav [data-t="tInicio"]')); await espera(40); clicar($("bMeus")); await espera(80);
  const t = $("mLista").textContent;
  b.ok(/Ver ingresso/.test(t) && /Compartilhar/.test(t) && /Corrigir nome/.test(t) && /Cancelar/.test(t), "ingresso pronto: Ver, Compartilhar, PDF, Corrigir nome e Cancelar");
  b.ok(/gerando/.test(t), "o outro ainda está 'gerando…'");
  clicar(d.querySelector('[data-a="cancela"]')); b.ok($("ov").classList.contains("on") && /não tem volta/.test($("ovP").textContent), "Cancelar pede confirmação 'não tem volta'");
  clicar($("ovSim")); await espera(80);
  b.ok(g.cingExclusoes_().length === 1 && /cancelando/.test($("mLista").textContent), "cancelamento pedido e a lista passa a 'cancelando…'");
  b.passo("link inválido");
  const ruim = new JSDOM(html.replace(TOK, "z".repeat(32)), { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
    function runner() { let ok = null; const p = new Proxy({}, { get(_, fn) { if (fn === "withSuccessHandler") return (f) => { ok = f; return p; }; if (fn === "withFailureHandler") return () => p; return (...a) => setTimeout(() => ok && ok(JSON.parse(JSON.stringify(g[fn](...a)))), 0); } }); return p; }
    Object.defineProperty(win, "google", { value: { script: { get run() { return runner(); } } } });
  } }).window;
  await espera(50);
  b.ok(/Sem permissão/.test(ruim.document.body.textContent) && !/Adicionar convidados/.test(ruim.document.body.textContent), "link inválido: mostra só a recusa, nenhum botão");
  b.naoTestavel("Compartilhar nativo, Ver ingresso e o visual no celular", "jsdom não tem share/PDF/tela; conferir no celular de verdade");
  b.resumo(); process.exit(process.exitCode || 0);
})();
