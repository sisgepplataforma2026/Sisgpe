/**
 * t109 — CARREGAMENTO SOB DEMANDA (lote 1)
 *
 * O index.html inclui as 60 telas do sistema de uma vez. Até 31/08/2026, vinte
 * delas buscavam os próprios dados no `DOMContentLoaded` — quando a PÁGINA
 * carregava, não quando o MÓDULO era aberto. Resultado medido: 40 chamadas ao
 * backend por carga da Home, das quais o Início usa três.
 *
 * Em Apps Script isso não é desperdício abstrato: cada `google.script.run` é
 * uma execução de servidor, com cota diária e fila. E dava para ver — a Home
 * ficava com os indicadores em "—" por segundos, porque o resumo dela entrava
 * na fila atrás de 37 chamadas de módulos fechados.
 *
 * A correção não construiu mecanismo novo. O `spIr()` já terminava em
 * `initModulo(mod)`, um despacho que cobre 37 módulos e inicializa cada um ao
 * abrir. As telas apenas faziam as duas coisas: initModulo E DOMContentLoaded.
 * Tirar o segundo é a correção.
 *
 * ESTE TESTE É O PLACAR, e cobra os dois lados — porque só o primeiro seria
 * fácil de "passar" quebrando o módulo:
 *
 *   1. na carga da Home, a chamada do módulo NÃO acontece;
 *   2. ao abrir o módulo pelo spIr(), ela acontece.
 *
 * Sem o item 2, remover a inicialização "passaria" no teste e entregaria uma
 * tela que abre vazia — que é o único jeito de esta correção dar errado.
 */

const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("CARREGAMENTO SOB DEMANDA");
  b.naoTestavel("carga e abertura de módulo", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson"); // admin: enxerga todos os módulos

/* Telas do lote 1 e a chamada que denuncia cada uma. A chamada escolhida é
   sempre uma que SÓ aquele módulo faz, para o teste não confundir origem. */
const LOTE = [
  { modulo: "rh",                  tela: "RHAdmin.html",             chamada: "listarFolhaRH" },
  { modulo: "rh",                  tela: "RHEventosAdmin.html",      chamada: "rhEvListar" },
  { modulo: "cadastroPrestadores", tela: "CadastroPrestadores.html", chamada: "listarPrestadoresDesp" },
  { modulo: "financeiro",          tela: "Scripts_Despesas.html",    chamada: "obterResumoDespesas" },
  { modulo: "financeiro",          tela: "FinanceiroConciliacao.html", chamada: "conc_listar" }
];

const esperar = ms => new Promise(r => setTimeout(r, ms));

function abrirHome() {
  const tela = dom.montar(g, ["index.html"], { token: TOKEN });
  // O index declara SISGEP_TOKEN_SESSAO a partir de um scriptlet que só o Apps
  // Script avalia; fora dele a var fica com o texto cru e tudo cai em sessão
  // inválida. Reposto aqui — é o que o doGet faz em produção.
  tela.win.SISGEP_TOKEN_SESSAO = TOKEN;
  return tela;
}

const contar = (tela, fn) => tela.chamadas.filter(c => c.fn === fn).length;

(async function () {

  /* ══════════════════════════════════════════════════════════ */
  b.fluxo("SOB DEMANDA · 1. o que a Home NÃO deve pedir");

  b.passo("1. carga da Home com o usuário parado no Início");
  const home = abrirHome();
  await esperar(1800);

  const total = home.chamadas.length;
  console.log("\n    chamadas na carga da Home: " + total + "\n");

  LOTE.forEach(function (item) {
    b.igual(
      contar(home, item.chamada), 0,
      "a Home não pede " + item.chamada + " (" + item.tela + ")"
    );
  });

  /* Teto de regressão. Não é meta — é o retrato de hoje, para que uma tela nova
     que volte a se auto-inicializar apareça aqui em vez de passar despercebida.
     A meta continua sendo 3: sessão, módulos do usuário e o resumo do Início. */
  const TETO = 24;
  if (total <= TETO) {
    b.ok(true, "a carga da Home cabe no teto de " + TETO + " chamadas", total + " chamadas");
  } else {
    b.aviso(
      "a carga da Home subiu para " + total + " chamadas (teto " + TETO + ")",
      "alguma tela voltou a buscar dados no DOMContentLoaded"
    );
  }

  /* ══════════════════════════════════════════════════════════ */
  b.fluxo("SOB DEMANDA · 2. o módulo carrega AO ABRIR");

  b.passo("2. abrir RH pelo spIr");
  const tRH = abrirHome();
  await esperar(1500);
  tRH.win.spIr("rh");
  await esperar(1200);

  b.ok(contar(tRH, "listarFolhaRH") > 0,
    "abrir o RH dispara listarFolhaRH (RHAdmin)",
    contar(tRH, "listarFolhaRH") + " chamada(s)");
  b.ok(contar(tRH, "rhEvListar") > 0,
    "e também rhEvListar (RHEventosAdmin, incluída dentro do RH)",
    contar(tRH, "rhEvListar") + " chamada(s)");

  b.passo("3. abrir Financeiro pelo spIr");
  const tFin = abrirHome();
  await esperar(1500);
  tFin.win.spIr("financeiro");
  await esperar(1200);

  b.ok(contar(tFin, "obterResumoDespesas") > 0,
    "abrir o Financeiro dispara obterResumoDespesas (Scripts_Despesas)",
    contar(tFin, "obterResumoDespesas") + " chamada(s)");
  // Esta era a única tela do lote SEM ponto de entrada sob demanda. A ligação
  // foi criada no initFinanceiro() do index.html — se alguém a remover, cai aqui.
  b.ok(contar(tFin, "conc_listar") > 0,
    "e a Conciliação também, pela ligação criada no initFinanceiro",
    contar(tFin, "conc_listar") + " chamada(s)");

  b.passo("4. abrir Prestadores pelo spIr");
  const tPre = abrirHome();
  await esperar(1500);
  tPre.win.spIr("cadastroPrestadores");
  await esperar(1200);

  b.ok(contar(tPre, "listarPrestadoresDesp") > 0,
    "abrir Prestadores dispara listarPrestadoresDesp",
    contar(tPre, "listarPrestadoresDesp") + " chamada(s)");

  b.naoTestavel(
    "se a tela fica visualmente correta ao abrir",
    "o jsdom não aplica CSS nem mede layout; conferir no navegador da homologação"
  );

  b.resumo();
  // O index.html deixa timers de pé (relógio, rádio) e o processo não encerra
  // sozinho. Preserva o código que o resumo() definiu.
  process.exit(process.exitCode || 0);
})();
