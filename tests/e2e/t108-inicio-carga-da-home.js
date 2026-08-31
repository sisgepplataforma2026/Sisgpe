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

  b.passo("2. o resumo do Início tem um dono só");
  const indices = [];
  fns.forEach((f, i) => { if (f === "getResumoInicioSISGEP") indices.push(i); });
  // GUARDA da correção de 31/08: eram DUAS chamadas (index.html e Helpers.html)
  // escrevendo nos mesmos ids. Se voltar a dar 2, a disputa voltou.
  b.igual(indices.length, 1, "getResumoInicioSISGEP é pedido UMA vez por carga");

  /* ══════════════════════════════════════════════════════════ */
  b.fluxo("MÓDULO 01 · INÍCIO — a corrida entre index.html e Helpers.html");

  /* FALHA INJETADA, de propósito.
   *
   * Com a planilha de teste vazia, todas as cinco fontes respondem ok:true
   * com valor 0 — e aí as duas telas concordam, porque 0 é 0 mesmo. A
   * divergência só existe quando uma fonte FALHA: o Helpers mostra "⚠" e o
   * index mostra 0. É esse caso que precisa ser encenado.
   *
   * O que se quebra aqui é o que quebra de verdade em produção: a aba de
   * Despesas fora do ar, a planilha renomeada, a cota estourada. */
  g.obterResumoDespesas_interno_ = function () {
    throw new Error("fonte de despesas indisponível (falha injetada pelo teste)");
  };

  b.passo("3. curso normal: o Helpers responde por último e a verdade aparece");
  const normal = abrirHome();
  await esperar(ESPERA);
  const prioNormal = normal.texto("#spPrioNF");
  b.ok(
    prioNormal === "⚠",
    "com as duas respostas rápidas, fonte que falhou mostra '⚠' (correto)",
    JSON.stringify(prioNormal)
  );

  b.passo("4. resposta lenta: a verdade não pode depender do tempo de rede");
  // Antes da correção, este era o passo que reprovava: com a resposta do
  // index.html chegando depois do setTimeout(450) do Helpers, "⚠" virava "0".
  // Com um dono só, o atraso deixou de poder mudar o que a Home afirma.
  const lenta = abrirHome([{ indice: indices[0], ms: 1200 }]);
  await esperar(ESPERA + 1200);

  b.ok(
    lenta.texto("#spPrioNF") === "⚠",
    "com a resposta lenta, fonte que falhou continua mostrando '⚠', nunca 0",
    JSON.stringify(lenta.texto("#spPrioNF"))
  );

  b.passo("5. o indicador de saúde de Ofícios tem onde aparecer");
  // O InicioResumo.gs sempre devolveu saude.oficios; até 31/08 não havia
  // elemento para recebê-lo e o valor era calculado e descartado.
  b.ok(
    normal.doc.getElementById("spSaudeOficios") !== null,
    "existe o elemento spSaudeOficios na Home",
    "Ofícios é o único módulo em uso diário e faltava no painel de saúde"
  );
  b.ok(
    normal.texto("#spSaudeOficios") === "OK",
    "e ele recebe o valor vindo do servidor",
    JSON.stringify(normal.texto("#spSaudeOficios"))
  );

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
