/**
 * TESTE — PESO DA PÁGINA MONTADA DO PORTAL ADMINISTRATIVO
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * Em 13/08/2026 metade do sistema parou de abrir — Jurídico, RH,
 * Sindicalização, Financeiro, Eventos. Nenhum erro, nenhum log, nenhuma
 * mensagem. O botão clicava e não acontecia nada.
 *
 * A causa não estava em módulo nenhum: o index.html cola 60 arquivos dentro
 * de si pelo include(), e a página montada passou de 2,5 MB. O HtmlService
 * do Apps Script CORTA a saída quando ela fica grande demais e não avisa —
 * nem no navegador, nem no registro de execução. O servidor montou os 2,5 MB
 * inteiros (medido: 41 seções, terminando em </html>); o navegador recebeu
 * ~78 KB. Tudo que estava depois do corte simplesmente não existia na tela.
 *
 * Medição que delimita o limite, feita no projeto em produção:
 *
 *     versão 627 (11/08) ≈ 2,42 MB  → entrega inteira, sistema funcionando
 *     versão 650 (13/08) ≈ 2,53 MB  → cortada, metade do sistema morta
 *
 * O que faltou não foi diagnóstico. Faltou TRAVA: ninguém mediu o tamanho da
 * página em momento nenhum, e cada módulo novo entrou às cegas até um deles
 * cruzar a linha. Este teste é a trava. Ele mede a página montada do mesmo
 * jeito que o Apps Script monta e reprova quando ela chega perto do limite
 * conhecido — para o próximo módulo quebrar o teste na hora, e não a tela do
 * sindicato três dias depois.
 *
 * O QUE ELE PODE E O QUE NÃO PODE DIZER
 *
 * Ele NÃO abre navegador e não prova que a página renderiza. O que ele prova,
 * por execução: quanto pesa o HTML que o servidor vai tentar entregar, quem
 * são os maiores responsáveis por esse peso, que todo include aponta para um
 * arquivo que existe, e que não há ciclo de include (a recursão infinita da
 * REGRA Nº 0, que corrompe o HTML sem erro).
 *
 * ESTE TESTE SAI COM CÓDIGO 1 QUANDO REPROVA — de propósito, diferente dos
 * demais. Trava que não trava não é trava.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "../..");

/* ── Os dois patamares ──────────────────────────────────────────────────
   TETO: acima disso o Apps Script pode cortar. 2,42 MB é o maior tamanho
   comprovadamente entregue; 2,53 MB é o menor comprovadamente cortado. O
   teto fica ABAIXO do que funcionou, porque o ponto exato do corte não é
   documentado pelo Google e pode variar com o conteúdo.

   ATENCAO: aviso antecipado, para a conversa acontecer antes da parede. */
const TETO = Math.round(2.0 * 1024 * 1024);
const ATENCAO = Math.round(1.2 * 1024 * 1024);

/* Depois do carregamento sob demanda entrar, o índice deve cair para a
   ordem de 200 KB. Quando isso acontecer, baixar TETO para ~600 KB — aí a
   trava volta a ter folga real em vez de vigiar uma linha já estourada. */

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
  "página montada dentro do teto de entrega",
  "montada: " + mb(montado.length) + "  ·  teto: " + mb(TETO) +
  (dentroDoTeto ? "  ·  folga: " + kb(TETO - montado.length)
                : "  ·  ESTOUROU em " + kb(montado.length - TETO)));

if (dentroDoTeto && montado.length > ATENCAO) {
  b.aviso("página passou do patamar de atenção",
    mb(montado.length) + " de " + mb(TETO) + " — restam " + kb(TETO - montado.length) +
    " antes do corte silencioso");
}

if (!dentroDoTeto) {
  console.log("\n\x1b[31m  O QUE ISSO SIGNIFICA NA PRÁTICA\x1b[0m");
  console.log("  O HtmlService vai cortar esta página na entrega, sem erro nenhum.");
  console.log("  Os módulos que estiverem depois do ponto de corte abrem em branco:");
  console.log("  o botão do menu clica e não acontece nada. Não adianta procurar");
  console.log("  defeito no módulo — a seção dele não chegou ao navegador.");
  console.log("  Conserto: carregamento sob demanda (a página manda o menu e busca");
  console.log("  a tela no clique), não dividir o index em mais arquivos — o");
  console.log("  include cola tudo de volta antes de entregar.\n");
}

b.naoTestavel("O ponto exato em que o HtmlService corta",
  "não é documentado pelo Google; o teto aqui vem de medição em produção (2,42 MB entregue, 2,53 MB cortado)");
b.naoTestavel("Se a página realmente renderiza no navegador", "exige abrir o portal");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
