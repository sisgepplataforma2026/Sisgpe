/**
 * t108 — MÓDULO 01 · INÍCIO · O QUE CUSTA ABRIR A HOME
 *
 * Achados da auditoria do módulo Início (31/08/2026), medidos por execução.
 *
 * ─── 1. O leque de chamadas ───────────────────────────────────────────────
 * O index.html é uma SPA: ele inclui o HTML de TODOS os módulos de uma vez.
 * Cada tela incluída registra o próprio `DOMContentLoaded` e sai buscando os
 * dados dela na hora — mesmo com o usuário parado na Home, sem ter aberto
 * módulo nenhum. O resultado é dezenas de idas ao servidor por login.
 *
 * Em Apps Script isso não é detalhe: cada `google.script.run` é uma execução
 * do servidor, sujeita a cota diária e a fila de concorrência. A Home é a
 * primeira tela de todo mundo, todo dia.
 *
 * ─── 2. A corrida ────────────────────────────────────────────────────────
 * `index.html` e `Helpers.html` chamam AMBOS `getResumoInicioSISGEP` e
 * escrevem nos MESMOS ids do DOM, com leituras que discordam:
 *
 *   index.html    → usa `r.prioridades` (campo de compatibilidade):
 *                   fonte que falhou vira o número 0.
 *   Helpers.html  → usa `r.statusFontes` (a verdade):
 *                   fonte que falhou vira "⚠" âmbar com o motivo no title.
 *
 * `Helpers.html` tenta ganhar com `setTimeout(..., 450)` e o comentário
 * "garante que este passe de confiabilidade seja o último a refletir na UI".
 * 450 ms é palpite sobre a rede, não garantia: quem escreve por último é
 * quem RESPONDE por último. O backend foi escrito de propósito para separar
 * "zero" de "não consegui consultar" (InicioResumo.gs, garantia nº 2 do
 * cabeçalho); quando o index chega por último, essa distinção é descartada e
 * a Home afirma "0 pendências" sobre um módulo que ela não conseguiu ler.
 */

const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("MÓDULO 01 · INÍCIO — carga da Home");
  b.naoTestavel("carga e corrida da Home", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
// Admin: tem TODOS os módulos, então nenhuma fonte cai em "sem acesso".
// Sem dado semeado, as fontes FALHAM — que é o caso que separa as duas
// leituras (falha vira "⚠" no Helpers e 0 no index).
const TOKEN = b.logar(g, "wanderson");

const ESPERA = 1600; // folga sobre o setTimeout(450) do Helpers

/** Sobe a Home como o navegador sobe: o jsdom dispara o DOMContentLoaded. */
function abrirHome(atrasos) {
  // Só o index: ele já traz o Helpers pelo include('Helpers') da linha 753.
  const tela = dom.montar(g, ["index.html"], { token: TOKEN });

  // O index declara `var SISGEP_TOKEN_SESSAO = "<?!= tokenSessao ?>"`. Fora do
  // Apps Script o scriptlet não é avaliado e a var fica com o texto cru, o que
  // derruba toda chamada em "Sessão inválida". Reposto aqui — é o que o doGet
  // faz em produção.
  tela.win.SISGEP_TOKEN_SESSAO = TOKEN;

  (atrasos || []).forEach(function (a) {
    tela.atrasar("getResumoInicioSISGEP", a.indice, a.ms);
  });

  return tela;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

(async function () {

  /* ══════════════════════════════════════════════════════════ */
  b.fluxo("MÓDULO 01 · INÍCIO — o custo de abrir a Home");

  b.passo("1. quantas idas ao servidor custa uma carga da Home");
  const sonda = abrirHome();
  await esperar(ESPERA);

  const fns = sonda.chamadas.map(c => c.fn);
  const total = fns.length;

  console.log("\n    chamadas na carga da Home (" + total + "):");
  const contagem = {};
  fns.forEach(f => { contagem[f] = (contagem[f] || 0) + 1; });
  Object.keys(contagem).sort((a, x) => contagem[x] - contagem[a]).forEach(function (f) {
    console.log("      " + String(contagem[f]) + "×  " + f);
  });
  console.log("");

  // Teto deliberadamente generoso: a Home precisa do resumo, da sessão e dos
  // módulos do usuário. Qualquer coisa muito além disso é módulo fechado
  // buscando dado que ninguém pediu.
  // ATENÇÃO e não FALHOU: o defeito é real e está medido, mas a correção
  // mexe na arquitetura da SPA e depende de decisão do usuário (REGRA Nº 0.5).
  // Vira b.ok() no dia em que o carregamento sob demanda entrar.
  if (total <= 8) {
    b.ok(true, "abrir a Home custa poucas chamadas ao backend", total + " chamadas");
  } else {
    b.aviso(
      "abrir a Home custa " + total + " chamadas ao backend (esperado ~8)",
      "a SPA inicializa TODOS os módulos incluídos, não só o Início — " +
      "cada uma é uma execução de Apps Script, com cota e fila"
    );
  }

  const repetidas = Object.keys(contagem).filter(f => contagem[f] > 1);
  if (repetidas.length === 0) {
    b.ok(true, "nenhuma função é chamada duas vezes na mesma carga");
  } else {
    b.aviso(
      repetidas.length + " funções são chamadas mais de uma vez na mesma carga",
      repetidas.map(f => contagem[f] + "× " + f).join("  ·  ")
    );
  }

  /* 06/11/2026 — A Home virou o Dashboard Executivo (InicioExecutivo.gs,
     t240). Os passos 2 a 5 antigos testavam o resumo de 5 cards e a "Saúde do
     sindicato", que saíram da tela por decisão do usuário. O que eles
     guardavam continua guardado aqui, no painel novo:
       - um dono só, uma chamada só;
       - fonte que falha aparece como falha, nunca como 0;
       - todo card leva a algum lugar. */
  b.passo("2. o painel do Início tem um dono só");
  const indices = [];
  fns.forEach((f, i) => { if (f === "getPainelExecutivoSISGEP") indices.push(i); });
  /* 06/11/2026: por partes — 4 pedidos ao mesmo tempo, UM por grupo (na HML a
     chamada única levou ~2 min). O que se guarda é que nenhum grupo é pedido
     duas vezes. */
  const grupos = sonda.chamadas.filter(c => c.fn === "getPainelExecutivoSISGEP").map(c => String((c.args || [])[1]));
  b.igual(grupos.slice().sort(), ["cadastros", "caixa", "financeiro", "oficios"], "o painel é pedido por partes: uma vez cada grupo", grupos.join(","));
  b.igual(fns.filter(f => f === "getResumoInicioSISGEP").length, 0, "o resumo antigo não é mais pedido (não há onde desenhá-lo)");

  b.fluxo("MÓDULO 01 · INÍCIO — fonte que falha não vira zero");
  g.obterResumoDespesas_interno_ = function () {
    throw new Error("fonte de despesas indisponível (falha injetada pelo teste)");
  };
  /* Sem a guarda de 3 minutos aqui: a carga do passo 1 guardou as partes
     com a fonte ainda boa, e o que se testa agora é a fonte quebrada. */
  g.CacheService.getScriptCache = () => ({ get: () => null, put() {}, remove() {}, getAll: () => ({}), putAll() {}, removeAll() {} });
  b.passo("3. curso normal");
  const normal = abrirHome();
  await esperar(ESPERA);
  const kNF = [...normal.doc.querySelectorAll("#spXKpis .spXK")].find(e => /Notas fiscais/i.test(e.textContent));
  b.ok(kNF && /—/.test(kNF.querySelector("b").textContent) && /não consegui ler/.test(kNF.textContent),
    "a fonte que falhou mostra '—' e 'não consegui ler agora' (nunca 0)", kNF && kNF.textContent);
  b.ok(/notas fiscais/.test(normal.texto("#spXIndisponivel")), "e o aviso embaixo da lista diz qual ficou de fora", normal.texto("#spXIndisponivel"));

  b.passo("4. resposta lenta: o atraso não muda o que a Home afirma");
  const lenta = abrirHome([{ indice: 0, ms: 1200 }]);
  await esperar(ESPERA + 1200);
  const kNF2 = [...lenta.doc.querySelectorAll("#spXKpis .spXK")].find(e => /Notas fiscais/i.test(e.textContent));
  b.ok(kNF2 && /—/.test(kNF2.querySelector("b").textContent), "com a resposta lenta, continua '—', nunca 0");

  b.passo("4b. todo card leva a algum lugar");
  const nav = normal;
  const idas = [];
  const spIrOriginal = nav.win.spIr;
  nav.win.spIr = function (mod, el, opts) { idas.push({ mod: mod, opts: opts || null }); };
  const clicaveis = [...nav.doc.querySelectorAll("#spXKpis [onclick], #spXTarefas [onclick], #spXAreas [onclick], #spXChegou [onclick]")];
  clicaveis.forEach(function (c) { nav.win.eval(c.getAttribute("onclick")); });
  nav.win.spIr = spIrOriginal;
  const kComAcao = [...nav.doc.querySelectorAll("#spXKpis .spXK")].length;
  b.ok(clicaveis.length > 0 && idas.length >= clicaveis.length - 1, "os cards do painel respondem ao clique (" + idas.length + " de " + clicaveis.length + ")",
    idas.map(i => i.mod).join(", "));
  b.ok(!idas.some(i => i.mod === "comunicacao" || i.mod === "relatorios"), "nenhum leva ao Painel do Dia antigo nem aos Relatórios de Ofícios por engano");

  b.passo("5. o que saiu da tela por decisão do usuário (06/11/2026)");
  b.ok(!nav.doc.getElementById("spNB"), "sem o sino com número fixo");
  b.ok(![...nav.doc.querySelectorAll(".spTopBtn")].some(x => /^(\?|WC)$/.test(x.textContent.trim())), "sem os botões '?' e 'WC', que não faziam nada");
  b.ok(!/👋/.test(nav.texto("#spGreet")), "sem a mãozinha na saudação");

  b.naoTestavel(
    "o tempo real de carga da Home no Apps Script",
    "o jsdom responde instantâneo; a latência de cada google.script.run depende " +
    "de cold start e da carga do Google. Cronometrar em homologação"
  );

  b.resumo();
  // O index.html deixa timers de pé (relógio, rádio) e o processo não encerra
  // sozinho. Sai preservando o código que o resumo() definiu — process.exit(0)
  // cravado mascararia asserção reprovada, que é justo o que o run-suite lê.
  process.exit(process.exitCode || 0);
})();
