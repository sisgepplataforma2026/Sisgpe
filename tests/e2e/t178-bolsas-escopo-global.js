/**
 * TESTE — O PAINEL DE BOLSAS NÃO PODE DIVIDIR NOME COM OUTRA TELA
 *
 * O DEFEITO QUE ORIGINOU ISTO — 16/09/2026, produção.
 *
 * O usuário mandou uma solicitação pelo portal público. A linha foi gravada
 * (ele achou na planilha), o e-mail de aviso chegou à Secretaria — e o painel
 * mostrava "Nenhuma solicitação encontrada", com todos os contadores em 0.
 *
 * A CAUSA. Todo `.html` do projeto é colado dentro do index e os `<script>`
 * viram UM escopo global só. `Scripts_Certificado.html` declarava
 * `aplicarFiltros`, `atualizarMetricas` e `renderTabela` — e os mesmos nomes
 * existiam em CadastroPrestadores (include 627) e MensalidadesAdmin (633),
 * DEPOIS do Certificado (589). A última declaração vence, calada.
 *
 * Então `cert_carregarLista()` buscava a lista, recebia a solicitação, e
 * chamava `atualizarMetricas()` e `aplicarFiltros()` — que eram as de OUTRAS
 * TELAS. O dado chegava e ninguém o desenhava. Nenhum erro, nenhum log: a
 * tabela simplesmente ficava no texto inicial.
 *
 * É a mesma família da REGRA Nº 0: escopo global único, sintoma que não
 * aponta para o culpado.
 *
 * O CONSERTO foi prefixar as funções da tela de Bolsas com `cert_`. Este
 * teste trava isso: nenhuma função de topo do painel pode existir com o mesmo
 * nome em outro `.html`.
 *
 * `g` é a EXCEÇÃO CONSCIENTE. Renomeá-lo quebrou as flags `/.../g` das
 * expressões regulares do arquivo — o t46 pegou na hora. Ele é
 * `document.getElementById` em todo lugar, com uma variação em Prestadores
 * que consulta um `_root` antes e cai no mesmo lugar quando não acha. Fica,
 * documentado, em vez de ser renomeado por simetria.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.join(__dirname, "..", "..");
const ALVO = "Scripts_Certificado.html";
const TOLERADOS = new Set(["g"]);

function funcoesDeTopo(arquivo) {
  const texto = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
  const nomes = new Set();
  const re = /^function ([a-zA-Z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(texto)) !== null) nomes.add(m[1]);
  return nomes;
}

b.fluxo("BOLSAS · O painel não divide nome global com outra tela");

const htmls = fs.readdirSync(RAIZ).filter(f => f.endsWith(".html") && f !== ALVO);
const doPainel = funcoesDeTopo(ALVO);

b.ok(doPainel.size > 0, "o arquivo do painel declara funções de topo", doPainel.size + " função(ões)");

const colisoes = [];
htmls.forEach(function (outro) {
  const deles = funcoesDeTopo(outro);
  doPainel.forEach(function (n) {
    if (deles.has(n) && !TOLERADOS.has(n)) colisoes.push(n + " (também em " + outro + ")");
  });
});

b.ok(colisoes.length === 0,
  "nenhuma função do painel de Bolsas colide com outra tela",
  colisoes.length ? colisoes.slice(0, 6).join(" | ") : "nenhuma colisão");

/* AS TRÊS QUE CAUSARAM O DEFEITO, nomeadas: se alguém reintroduzir uma delas
   sem prefixo, a asserção acima já pega — mas o nome explícito aqui conta a
   história para quem for ler o vermelho. */
["aplicarFiltros", "atualizarMetricas", "renderTabela", "carregarLista"].forEach(function (n) {
  b.ok(!doPainel.has(n),
    "`" + n + "` não existe sem prefixo no painel — foi ela que sumiu com a lista");
});

/* O ELO QUE LIGA O MENU À TELA. Renomear a função e esquecer o index deixaria
   o painel abrindo sem carregar nada — o mesmo sintoma, por outra causa. */
const indice = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
b.ok(/callFn\("cert_carregarLista"\)/.test(indice),
  "o index chama o carregador pelo nome NOVO");
b.ok(!/callFn\("carregarLista"\)/.test(indice),
  "e não sobrou chamada pelo nome antigo");

/* Prova que o prefixo foi aplicado de ponta a ponta, e não só na declaração:
   um onclick apontando para o nome velho quebraria o botão em silêncio. */
const painel = fs.readFileSync(path.join(RAIZ, ALVO), "utf8");
["aplicarFiltros", "carregarLista", "renderTabela"].forEach(function (n) {
  const sobrou = new RegExp("(?<![\\w.$_])" + n + "\\s*\\(").test(painel);
  b.ok(!sobrou, "nenhuma chamada solta a `" + n + "` sobrou no arquivo");
});

b.naoTestavel("A tabela desenhando no navegador",
  "jsdom não monta o index inteiro com os 100 includes; só o ambiente publicado responde");
b.resumo();
