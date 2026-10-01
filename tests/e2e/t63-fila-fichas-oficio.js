/**
 * TESTE — A FILA DE FICHAS COM CHECK DE EXCLUIR, NOS DOIS LUGARES
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 19/08/2026: "o módulo de ofício não tem um check para
 * excluir as fichas em lote". Perguntou em seguida se era só o lote que
 * faltava.
 *
 * NÃO ERA. Levantando os oito campos de arquivo do módulo, o defeito era
 * maior e mais estranho do que o relato: A REMOÇÃO JÁ ESTAVA ESCRITA, e
 * não tinha por onde ser acionada.
 *
 *     function renderizarPreviewFichaCard(prev, dt) { if (prev) prev.innerHTML = ""; }
 *     function atualizarPreviewFichas() { ... prev.innerHTML = ""; }
 *
 * As duas funções que deveriam desenhar a lista de arquivos apagavam o
 * container e não desenhavam nada. Como era ali que os botões apareceriam,
 * `removerFicha` e `removerFichaCard` ficaram com ZERO chamadas nos 125
 * .gs e 80 .html — prontas, corretas e inalcançáveis. Numa leitura o
 * código parecia completo.
 *
 * POR QUE ISSO CUSTAVA CARO. Um <input type="file"> nativo não deixa tirar
 * UM arquivo: escolher de novo substitui o conjunto inteiro. Errar um PDF
 * em quatro custava refazer os quatro — e sem lista à vista, nem dava para
 * saber qual estava errado.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO: a fila desenhada, o check por
 * linha, o botão que só habilita com algo marcado, a remoção de vários de
 * uma vez sem levar o arquivo errado, o acúmulo entre duas escolhas e a
 * limpeza ao resetar o formulário.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência. jsdom não aplica CSS.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("OFÍCIO · Fila de fichas com check de excluir");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("A fila de fichas", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
const doc = tela.doc, win = tela.win;
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

/** Um File de mentira, com nome e tamanho controlados. */
function arquivo(nome, bytes) {
  return new win.File([new win.Uint8Array(bytes || 100)], nome, { type: "application/pdf" });
}

/** Põe arquivos no input e dispara o change, como o navegador faria. */
function anexar(input, arquivos) {
  const dt = new win.DataTransfer();
  arquivos.forEach(function (f) { dt.items.add(f); });
  input.files = dt.files;
  input.dispatchEvent(new win.Event("change", { bubbles: true }));
}

/* ═══════════════════════════════════════════════════════════
   1. A fila aparece — era isto que não existia
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const inp = doc.getElementById("fichasOficioLote");
const fila = doc.getElementById("fichasOficioFila");
b.ok(!!inp, "o campo das fichas do ofício existe");
b.ok(!!fila, "e agora existe o container da fila");
b.igual(fila.innerHTML, "", "que começa vazio — sem anexo, sem lista");

b.passo("2");
anexar(inp, [arquivo("carta_01.pdf", 1500), arquivo("scan_errado.pdf", 90000),
             arquivo("carta_02.pdf", 2400)]);
const linhas = () => Array.from(fila.querySelectorAll(".of-fila-chk"));
b.igual(linhas().length, 3, "os três arquivos viram três linhas com check");
b.ok(fila.textContent.indexOf("carta_01.pdf") > -1,
  "com o nome de cada um à vista",
  "sem nome, 'remover o segundo' é adivinhação");
b.ok(/KB|MB|B\b/.test(fila.textContent), "e o tamanho", fila.textContent.slice(0, 90));

/* ═══════════════════════════════════════════════════════════
   2. O botão só habilita com algo marcado, e diz quantos
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
const btn = () => fila.querySelector(".of-fila-remover");
b.ok(!!btn(), "existe o botão de remover marcados");
b.ok(btn().disabled === true,
  "e ele nasce DESABILITADO",
  "botão de remoção sempre clicável é o que se aperta por engano");

b.passo("4");
/* Defensivo de propósito: quando uma mutação encolhe a fila, marcar uma
   linha que não existe DERRUBAVA o teste — e teste que quebra esconde as
   outras falhas, que é justamente o que se quer ler numa mutação. Agora a
   linha faltando é ela mesma uma falha, com nome. */
function marcar(i) {
  const c = linhas()[i];
  if (!c) { b.ok(false, "existe a linha " + i + " para marcar", "a fila tem " + linhas().length); return; }
  c.checked = true;
  c.dispatchEvent(new win.Event("change", { bubbles: true }));
}
marcar(1);
b.ok(btn().disabled === false, "marcar um habilita o botão");
b.ok(/\(1\)/.test(btn().textContent),
  "e ele diz quantos vai remover", btn().textContent);

/* ═══════════════════════════════════════════════════════════
   3. Remove o marcado — e SÓ ele
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
btn().click();
b.igual(inp.files.length, 2, "sobraram dois arquivos no input");
const nomes = Array.from(inp.files).map(f => f.name);
b.ok(nomes.indexOf("scan_errado.pdf") === -1,
  "o arquivo marcado saiu", nomes.join(" · "));
b.ok(nomes.indexOf("carta_01.pdf") > -1 && nomes.indexOf("carta_02.pdf") > -1,
  "e os outros dois continuam", nomes.join(" · "));
b.igual(linhas().length, 2, "a fila na tela também tem dois");

/* ═══════════════════════════════════════════════════════════
   4. Vários de uma vez, sem levar o arquivo errado
   ═══════════════════════════════════════════════════════════

   Apagar por índice em laço, enquanto a lista encolhe, desloca tudo o que
   vem depois — e o segundo apagado seria outro arquivo. É o defeito mais
   fácil de escrever aqui, e o mais difícil de perceber olhando.
   ═══════════════════════════════════════════════════════════ */
b.passo("6");
anexar(inp, [arquivo("extra_A.pdf", 500), arquivo("extra_B.pdf", 600)]);
b.igual(inp.files.length, 4, "agora são quatro",
  Array.from(inp.files).map(f => f.name).join(" · "));

marcar(0); marcar(2);
btn().click();
const sobrou = Array.from(inp.files).map(f => f.name);
b.igual(sobrou.length, 2, "removeu os dois marcados");
b.igual(sobrou, ["carta_02.pdf", "extra_B.pdf"],
  "e sobraram EXATAMENTE os não marcados — nenhum deslocamento de índice",
  sobrou.join(" · "));

/* ═══════════════════════════════════════════════════════════
   5. A segunda escolha SOMA, não substitui
   ═══════════════════════════════════════════════════════════

   O passo 6 já dependia disso, mas aqui vai explícito: era um estrago
   silencioso. Quem digitaliza em duas levas perdia a primeira sem aviso.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
const antes = inp.files.length;
anexar(inp, [arquivo("terceira_leva.pdf", 700)]);
b.igual(inp.files.length, antes + 1,
  "anexar de novo SOMA ao que já estava",
  "antes, a segunda escolha apagava a primeira em silêncio");

b.passo("8");
/* Repetido pelo nome e tamanho não entra duas vezes: quem reanexa por
   dúvida não pode acabar mandando o mesmo PDF em duplicata para a escola. */
const antesRep = inp.files.length;
anexar(inp, [arquivo("terceira_leva.pdf", 700)]);
b.igual(inp.files.length, antesRep,
  "e o mesmo arquivo não entra duas vezes");

/* ═══════════════════════════════════════════════════════════
   6. Resetar o formulário zera a fila
   ═══════════════════════════════════════════════════════════

   Sem isto o próximo ofício nasceria com os anexos do anterior — e sairia
   para a escola errada. É o pior desfecho possível desta tela.
   ═══════════════════════════════════════════════════════════ */
b.passo("9");
/* O reset mora dentro do IIFE e é exposto como window.Oficio.resetarFormulario
   — é por ali que o botão "Novo documento" o aciona. */
const resetar = win.Oficio && win.Oficio.resetarFormulario;
if (typeof resetar === "function") {
  resetar();
  b.igual(inp.files.length, 0, "o reset esvazia as fichas do ofício");
  b.igual(fila.innerHTML, "", "e a fila some da tela");
} else {
  b.naoTestavel("O reset do formulário", "resetarFormulario não está exposta na janela");
}

/* ═══════════════════════════════════════════════════════════
   7. O CARTÃO do trabalhador — o outro lugar que faltava
   ═══════════════════════════════════════════════════════════ */
b.fluxo("CARTÃO · A ficha do trabalhador também ganha fila");

b.passo("10");
b.ok(typeof win.renderizarPreviewFichaCard === "function",
  "a função que desenha a fila do cartão existe");

/* A prova de que ela deixou de ser casca: dado um container e arquivos,
   tem que SAIR marcação. Antes ela apagava e devolvia nada. */
const caixa = doc.createElement("div");
doc.body.appendChild(caixa);
const dtCard = new win.DataTransfer();
dtCard.items.add(arquivo("ficha_pessoa.pdf", 800));
dtCard.items.add(arquivo("ficha_pessoa_2.pdf", 900));
win.renderizarPreviewFichaCard(caixa, dtCard);

b.ok(caixa.innerHTML.length > 0,
  "ela DESENHA a fila em vez de apagar o container",
  "era uma casca: 'if (prev) prev.innerHTML = \"\"' e mais nada");
b.igual(caixa.querySelectorAll(".of-fila-chk").length, 2,
  "com um check por arquivo");
b.ok(!!caixa.querySelector(".of-fila-remover"),
  "e o botão de remover marcados");

b.passo("11");
/* Contraprova do desenhador: sem arquivo, nada é desenhado. Uma fila que
   aparece vazia ocupa espaço e não informa. */
const vazia = doc.createElement("div");
win.renderizarPreviewFichaCard(vazia, new win.DataTransfer());
b.igual(vazia.innerHTML, "", "sem arquivo nenhum, não desenha fila");

b.passo("12");
/* As funções de remoção deixaram de ser inalcançáveis. */
b.ok(typeof win.removerFichasCard === "function",
  "existe a remoção de vários do cartão");
b.ok(typeof win.removerFichaCard === "function",
  "e a de um só continua, agora em cima da de vários",
  "o caminho antigo não some — outra tela pode estar usando");

b.naoTestavel("A aparência da fila — cor, alinhamento, largura",
  "jsdom não aplica CSS; isso se confere abrindo a tela");

b.resumo();
