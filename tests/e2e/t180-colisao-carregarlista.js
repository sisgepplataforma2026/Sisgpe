/**
 * TESTE — QUEM VENCE A DISPUTA POR `carregarLista` NO ESCOPO GLOBAL
 *
 * POR QUE ESTE ARQUIVO EXISTE — 16/09/2026.
 *
 * Investigando a lista vazia de Bolsas, encontrei `carregarLista` declarada em
 * mais de um `.html` e ANUNCIEI AO USUÁRIO que Financeiro, Conciliação e
 * Despesas estavam chamando o carregador errado. Eu havia deduzido isso da
 * ordem dos includes, sem executar.
 *
 * ESTE TESTE EXECUTA, e a conclusão é outra. Há dois mecanismos diferentes em
 * jogo, e eles não se resolvem pela mesma regra:
 *
 *   CadastroEscolas.html  `function carregarLista(){}` — declaração de topo,
 *                         criada no PARSE do arquivo;
 *   Scripts_Despesas.html `window.carregarLista = carregarLista` — atribuição
 *                         em tempo de EXECUÇÃO, dentro de um IIFE.
 *
 * A atribuição roda depois de todas as declarações terem sido içadas. Então
 * quem fica em `window.carregarLista` é a de Despesas — e os três chamadores
 * do Financeiro, que QUEREM a de Despesas, estavam certos o tempo todo.
 *
 * A VÍTIMA É OUTRA: as onze chamadas internas de CadastroEscolas.html
 * resolvem pelo mesmo `window.carregarLista`. Depois de salvar, importar ou
 * excluir uma escola, a tela de Escolas recarrega a lista de DESPESAS.
 *
 * O teste fixa qual é o comportamento real, para a próxima conclusão sobre
 * isto não voltar a ser deduzida de leitura.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.join(__dirname, "..", "..");

function corpo(arquivo) {
  return fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
}

/* A ORDEM É A DO index.html, não a alfabética: é ela que decide o vencedor. */
function ordemNoIndex(arquivo) {
  const idx = corpo("index.html");
  return idx.indexOf("include('" + arquivo.replace(".html", "") + "')");
}

b.fluxo("ESCOPO GLOBAL · a disputa por `carregarLista`");

const escolas = "CadastroEscolas.html";
const despesas = "Scripts_Despesas.html";

/* A asserção original aqui exigia que CadastroEscolas AINDA declarasse
   `carregarLista` no topo — ou seja, exigia o defeito. Ela reprovou assim que
   o conserto entrou, e com razão: teste não deve travar o bug no lugar. O que
   se afirma agora é o MECANISMO, que continua valendo e é o que precisa ser
   entendido por quem ler depois. */
b.ok(/^function ceCarregarLista\(\)/m.test(corpo(escolas)),
  "CadastroEscolas declara suas funções no topo — declaração de topo vira global no parse");
b.ok(/window\.carregarLista\s*=\s*carregarLista;/.test(corpo(despesas)),
  "Scripts_Despesas ATRIBUI `window.carregarLista` em tempo de execução");

const posEscolas = ordemNoIndex(escolas);
const posDespesas = ordemNoIndex(despesas);
b.ok(posEscolas > -1 && posDespesas > -1, "os dois entram no index", posEscolas + " e " + posDespesas);
b.ok(posDespesas > posEscolas,
  "e Despesas entra DEPOIS de Escolas", "escolas@" + posEscolas + " < despesas@" + posDespesas);

/* A REGRA QUE DECIDE, exercitada de verdade: declaração içada perde para
   atribuição que roda depois. É isto que eu tinha deduzido errado. */
const janela = {};
(function () {
  const g = janela;
  /* imita o parse do arquivo de Escolas: declaração de topo vira global */
  g.carregarLista = function () { return "ESCOLAS"; };
  /* imita o IIFE de Despesas, que roda depois */
  (function () {
    function carregarLista() { return "DESPESAS"; }
    g.carregarLista = carregarLista;
  })();
})();
b.ok(janela.carregarLista() === "DESPESAS",
  "quem fica em window.carregarLista é a de DESPESAS", janela.carregarLista());

/* E daí sai a conclusão sobre cada chamador. */
b.ok(/window\.carregarLista\(\)/.test(corpo("FinanceiroAdmin.html")),
  "FinanceiroAdmin chama window.carregarLista");
b.ok(/window\.carregarLista\(\)/.test(corpo("FinanceiroConciliacao.html")),
  "FinanceiroConciliacao também");
/* `b.ok(true === true, ...)` é asserção que não pode falhar, e eu já escrevi
   duas hoje. O que se AFIRMA aqui é verificável: o Financeiro chama a dupla
   `carregarDashboard` + `carregarLista`, que é a de Despesas — as duas são
   exportadas juntas no mesmo bloco de Scripts_Despesas. */
b.ok(/window\.carregarDashboard\(\)/.test(corpo("FinanceiroAdmin.html")),
  "o Financeiro chama carregarDashboard junto — a dupla é a de Despesas");
b.ok(/window\.carregarDashboard\s*=\s*carregarDashboard;/.test(corpo(despesas)),
  "e é Scripts_Despesas quem exporta as duas, no mesmo bloco");

b.passo("O conserto: Escolas passa a ter nome próprio");
/* Três funções de CadastroEscolas eram sobrescritas por Scripts_Despesas:
   carregarLista, aplicarFiltros e limparFiltros. Depois de salvar, importar
   ou excluir uma escola, a tela recarregava a lista de DESPESAS. */
const txtEscolas = corpo(escolas);
["ceCarregarLista", "ceAplicarFiltros", "ceLimparFiltros"].forEach(function (n) {
  b.ok(new RegExp("function " + n + "\\(").test(txtEscolas),
    "CadastroEscolas declara `" + n + "`");
});
["carregarLista", "aplicarFiltros", "limparFiltros"].forEach(function (n) {
  b.ok(!new RegExp("^function " + n + "\\(", "m").test(txtEscolas),
    "e não declara mais `" + n + "` sem prefixo");
  b.ok(!new RegExp("(?<![\\w.$-])" + n + "\\(\\)").test(txtEscolas),
    "nem sobrou chamada solta a `" + n + "`");
});

/* A VARREDURA QUE SEGURA ISSO: nenhuma função de topo de CadastroEscolas pode
   ter o mesmo nome de algo que Scripts_Despesas exporta para o window. */
const exportadas = (corpo(despesas).match(/window\.([a-zA-Z_][\w$]*)\s*=/g) || [])
  .map(function (m) { return m.replace(/window\.|\s*=/g, ""); });
const doEscolas = (txtEscolas.match(/^function ([a-zA-Z_][\w$]*)\(/gm) || [])
  .map(function (m) { return m.replace(/^function |\($/g, ""); });
const aindaColidem = doEscolas.filter(function (n) { return exportadas.indexOf(n) > -1; });
b.ok(aindaColidem.length === 0,
  "nenhuma função de Escolas é sobrescrita por Despesas",
  aindaColidem.length ? aindaColidem.join(", ") : "nenhuma");

b.naoTestavel("A tela de Escolas recarregando errado no navegador",
  "jsdom não monta o index com os 100 includes; o efeito só aparece no ambiente publicado");
b.resumo();
