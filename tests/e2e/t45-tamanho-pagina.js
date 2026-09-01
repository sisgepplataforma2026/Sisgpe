/**
 * TESTE — PESO DA PÁGINA MONTADA DO PORTAL ADMINISTRATIVO
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * O index.html não é um arquivo: ele cola 60 outros dentro de si pelo
 * include(), e a página montada passa de 2,5 MB. Ninguém nunca mediu isso.
 * Cada módulo novo entrou às cegas, e o número só apareceu quando foi
 * procurado — em 17/08/2026, depois de uma semana de sintoma sem causa.
 *
 * ATENÇÃO AO QUE ESTE TESTE NÃO AFIRMA
 *
 * Uma versão anterior deste cabeçalho dizia que o HtmlService cortava a
 * página acima de ~2,5 MB e que era isso que derrubava os módulos. ESTÁ
 * RETIRADO. A afirmação se apoiava numa medição do lado do navegador que
 * eu mesmo já havia invalidado (feita no frame errado — o invólucro do
 * Google em vez do userCodeAppPanel). Depois disso o usuário confirmou que
 * a versão 650, com os mesmos ~2,53 MB, ABRE TODAS AS TELAS. Ou seja: não
 * há corte comprovado, e o limite de entrega do HtmlService continua
 * DESCONHECIDO.
 *
 * A causa do apagão de 13/08 segue sem diagnóstico confirmado. Pela
 * REGRA Nº -1, o veredito é "não confirmado" — não "resolvido".
 *
 * O QUE ELE PODE E O QUE NÃO PODE DIZER
 *
 * Ele NÃO abre navegador, não prova que a página renderiza e NÃO sabe onde
 * fica o limite de entrega. O que ele prova, por execução: quanto pesa o
 * HTML que o servidor vai tentar entregar, quem são os maiores responsáveis
 * por esse peso, que todo include aponta para um arquivo que existe, e que
 * não há ciclo de include (a recursão infinita da REGRA Nº 0, que corrompe
 * o HTML sem erro nenhum).
 *
 * Serve para o crescimento da página ser um número visível a cada commit,
 * em vez de uma surpresa. É vigia, não é trava: como não existe limite
 * comprovado, ele AVISA quando a página cresce e só reprova se o peso
 * disparar para um patamar que ninguém pretendeu.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "../..");

/* ── Os dois patamares ──────────────────────────────────────────────────
   Nenhum dos dois é o limite do Apps Script: esse número não é documentado
   pelo Google e não foi medido aqui. São marcas de referência do PROJETO.

   ATENCAO (2,7 MB): a página cresceu além do tamanho conhecido em 17/08/2026
   (2,57 MB) com folga de uns 130 KB. Cruzar isso não quebra nada — significa
   que entrou coisa grande e alguém precisa olhar.

   TETO (3,5 MB): patamar que ninguém pretendeu atingir. Se a página chegar
   lá, houve include em duplicidade, arquivo colado duas vezes ou coisa
   parecida — é defeito, não crescimento. */
const TETO = Math.round(3.5 * 1024 * 1024);
const ATENCAO = Math.round(2.7 * 1024 * 1024);

/* Se um dia o carregamento sob demanda entrar, o índice cai para a ordem de
   200 KB e estes dois números devem descer junto. */

const kb = n => (n / 1024).toFixed(1) + " KB";
const mb = n => (n / 1024 / 1024).toFixed(2) + " MB";

/* ── Monta a página igual ao Apps Script ────────────────────────────────
   include() em Code.gs:282 usa createTemplateFromFile().evaluate(), ou seja,
   include dentro de include é resolvido também. Reproduzimos isso, contando
   quanto cada arquivo de primeiro nível soma (ele mais os seus aninhados).

   Cada uso ganha o SEU regex: objeto com /g guarda lastIndex, e um único
   compartilhado entre o laço de fora e o replace() de dentro da recursão
   volta o cursor para o início a cada chamada — laço infinito. */
const reInclude = () => /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g;

const ausentes = [];
const ciclos = [];

function ler(nome) {
  const arq = path.join(RAIZ, nome + ".html");
  if (!fs.existsSync(arq)) { ausentes.push(nome); return ""; }
  return fs.readFileSync(arq, "utf8");
}

/** Resolve recursivamente, guardando a pilha para detectar ciclo. */
function montar(nome, pilha) {
  if (pilha.indexOf(nome) !== -1) {
    ciclos.push(pilha.concat(nome).join(" → "));
    return ""; // corta a recursão para o teste não travar
  }
  const proximaPilha = pilha.concat(nome);
  return ler(nome).replace(reInclude(), (_, alvo) => montar(alvo, proximaPilha));
}

const indexBruto = ler("index");
const montado = montar("index", []);

/* Peso de cada include de primeiro nível do index, já com os aninhados. */
const primeiroNivel = [];
let m;
const varredura = reInclude();
while ((m = varredura.exec(indexBruto))) {
  const nome = m[1];
  primeiroNivel.push({ nome, bytes: montar(nome, ["index"]).length });
}
const somaIncludes = primeiroNivel.reduce((s, x) => s + x.bytes, 0);
const proprio = montado.length - somaIncludes;

b.fluxo("PÁGINA · Peso do index.html montado");

b.passo("1. A página foi montada como o Apps Script monta");
b.ok(montado.length > 0, "index.html montado com os includes resolvidos",
  primeiroNivel.length + " includes de primeiro nível");

b.passo("2. Todo include aponta para um arquivo que existe");
b.ok(ausentes.length === 0, "nenhum include aponta para arquivo inexistente",
  ausentes.length ? "AUSENTES: " + [...new Set(ausentes)].join(", ")
                  : "todos os destinos existem");

b.passo("3. Não há ciclo de include (REGRA Nº 0)");
// Arquivo que se inclui, direto ou por caminho longo, entra em recursão
// infinita no Apps Script: o HTML sai corrompido, o <script> quebra no meio
// e a tela inteira fica muda — sem erro nenhum. Foi o que RHEventosAdmin.html
// fez em 05/08, com a chamada escrita dentro de um comentário HTML.
b.ok(ciclos.length === 0, "nenhum arquivo se inclui em ciclo",
  ciclos.length ? "CICLO: " + [...new Set(ciclos)].join(" | ") : "cadeia de includes acíclica");

b.passo("4. Os maiores responsáveis pelo peso");
const ranking = primeiroNivel.slice().sort((a, c) => c.bytes - a.bytes);
console.log("\n    \x1b[90mindex.html (menu, cascas de seção e scripts próprios)  " +
  kb(proprio) + "\x1b[0m");
ranking.slice(0, 10).forEach((x, i) => {
  console.log("    \x1b[90m" + String(i + 1).padStart(2) + ". " +
    x.nome.padEnd(38) + kb(x.bytes).padStart(10) + "\x1b[0m");
});
const resto = ranking.slice(10).reduce((s, x) => s + x.bytes, 0);
console.log("    \x1b[90m    ... outros " + (ranking.length - 10) + " includes" +
  " ".repeat(19) + kb(resto).padStart(10) + "\x1b[0m\n");
b.ok(ranking.length > 0, "ranking de contribuição calculado",
  "maior: " + ranking[0].nome + " (" + kb(ranking[0].bytes) + ")");

b.passo("5. A página cabe no que o Apps Script entrega");
const dentroDoTeto = montado.length <= TETO;
b.ok(dentroDoTeto,
  "página montada dentro do patamar de referência",
  "montada: " + mb(montado.length) + "  ·  teto: " + mb(TETO) +
  (dentroDoTeto ? "  ·  folga: " + kb(TETO - montado.length)
                : "  ·  ESTOUROU em " + kb(montado.length - TETO)));

if (dentroDoTeto && montado.length > ATENCAO) {
  b.aviso("página passou do patamar de atenção",
    mb(montado.length) + " de " + mb(TETO) + " — restam " + kb(TETO - montado.length) +
    " antes do corte silencioso");
}

if (!dentroDoTeto) {
  console.log("\n\x1b[31m  O QUE OLHAR\x1b[0m");
  console.log("  Este patamar não é limite do Apps Script — é peso que ninguém");
  console.log("  pretendeu. Procure include repetido, arquivo colado duas vezes ou");
  console.log("  um módulo que dobrou de tamanho. O ranking acima diz onde.\n");
}

b.naoTestavel("Onde fica o limite de entrega do HtmlService",
  "não é documentado pelo Google e não foi medido aqui; a página de ~2,53 MB da versão 650 abre todas as telas, então o limite é maior que isso");
b.naoTestavel("Se a página realmente renderiza no navegador", "exige abrir o portal");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
