/**
 * TESTE — O INGRESSO É UM MODELO SÓ, EM QUALQUER CENÁRIO
 *
 * O QUE ORIGINOU, 14/09/2026. Ele abriu o ingresso pelo link e mandou o print:
 * o nome "MARCELHA ALINE PINTO GOMES" quebrado em quatro linhas, invadindo a
 * caixa da escola. Baixou o mesmo ingresso em PDF e estava perfeito.
 *
 * A CAUSA. As caixas eram medidas pelo INGRESSO (`width:10.2%`) e a fonte pela
 * JANELA (`font-size:1.05vw`). O ingresso trava em `min(1200px,100%)`; a fonte
 * não trava em nada. Em janela larga o texto cresce além da caixa que o
 * deveria conter. Na impressão a proporção voltava a bater — por acidente, e
 * era esse acidente que fazia o PDF parecer certo.
 *
 * Havia um segundo caminho para o mesmo estrago: o bloco `@media(max-width:800px)`
 * trocava a fonte de todos os campos por outro valor em `vw`. O mesmo ingresso
 * saía com letra diferente no celular — dois modelos para o mesmo documento.
 *
 * A ORDEM DELE: "em todos os cenários o ingresso tem que ser num único modelo
 * (o que foi aprovado)". O aprovado é o PDF. Então a proporção do PDF virou a
 * medida de todo lugar: `cqw` mede a largura do PRÓPRIO ingresso.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: se o texto realmente cabe. Não há navegador
 * aqui, nem fonte, nem layout — `scrollHeight` não existe. O que se prova é
 * que a REGRA está no arquivo: nada mede pela janela, o ajuste existe e tem
 * piso. Que o nome de 30 letras cabe na caixa, só o olho responde.
 */
const fs = require("fs");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const tpl = fs.readFileSync(RAIZ + "/EventosIngressoTemplate.html", "utf8");
const css = (tpl.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A medida é o ingresso, nunca a janela");

passo("o ingresso se declara como a referência de medida");
ok(/\.ticket\{[^}]*container-type:\s*inline-size/.test(css),
   "o .ticket é container de consulta",
   "sem isso o cqw não tem de quem se medir e o texto fica sem tamanho");

passo("todo campo de texto mede em cqw");
const CAMPOS = ["main-name", "main-school", "main-category", "main-number",
                "stub-number", "stub-name", "stub-school", "stub-category"];
CAMPOS.forEach(function (c) {
  const regra = (css.match(new RegExp("\\." + c + "\\{[^}]*\\}")) || [""])[0];
  ok(/font-size:[^;}]*cqw/.test(regra), "  ." + c + " em cqw",
     regra.slice(0, 90));
});

passo("e o vw fica só como plano B para navegador antigo");
CAMPOS.forEach(function (c) {
  const regra = (css.match(new RegExp("\\." + c + "\\{[^}]*\\}")) || [""])[0];
  const iVw  = regra.indexOf("vw");
  const iCqw = regra.indexOf("cqw");
  ok(iVw === -1 || iVw < iCqw, "  ." + c + ": o cqw vem depois e vence",
     "declarar o vw DEPOIS do cqw anularia o conserto em silêncio");
});

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Nenhum cenário muda o tamanho da letra");

passo("o bloco de celular não mexe mais em fonte");
const mediaCel = (css.match(/@media\(max-width:800px\)\{[^}]*\}[^}]*\}/) || [""])[0];
ok(!/font-size/.test(mediaCel),
   "sem font-size no @media de tela estreita",
   "era o segundo caminho para o mesmo estrago: outro modelo no celular · " +
   mediaCel.slice(0, 80));

passo("a impressão também não");
const mediaPrint = (css.match(/@media print\{[^}]*\}[^}]*\}/) || [""])[0];
ok(!/font-size/.test(mediaPrint),
   "sem font-size no @media print",
   "o PDF é o modelo aprovado: ele não pode ser um caso à parte · " +
   mediaPrint.slice(0, 80));

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O nome longo encolhe, não transborda nem some");

passo("as caixas de texto têm altura — sem ela não há excesso a detectar");
["main-name", "main-school", "main-category",
 "stub-name", "stub-school", "stub-category"].forEach(function (c) {
  const regra = (css.match(new RegExp("\\." + c + "\\{[^}]*\\}")) || [""])[0];
  ok(/height:[^;}]*%/.test(regra), "  ." + c + " tem altura",
     "sem altura a caixa cresce e invade a de baixo — foi o que ele viu");
});

passo("o ajuste mede o desenhado, em vez de adivinhar pelo número de letras");
ok(/scrollHeight/.test(tpl) && /clientHeight/.test(tpl),
   "compara o conteúdo com a caixa",
   "contar caracteres erra: 'WW' ocupa o dobro de 'ii' na mesma contagem");

passo("e tem piso, para não virar letra ilegível");
ok(/0\.55/.test(tpl), "para de encolher em 55% do tamanho original",
   "texto que cabe mas ninguém lê não resolve — a portaria confere no papel");

passo("refaz a conta quando a largura muda");
ok(/addEventListener\('resize'/.test(tpl),
   "ao redimensionar a janela",
   "a medida é em cqw: mudou a largura do ingresso, o ajuste anterior venceu");
ok(/addEventListener\('beforeprint'/.test(tpl),
   "e antes de imprimir — é o momento em que a largura muda mais");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("Se o texto realmente cabe",
  "não há navegador, fonte nem layout aqui: scrollHeight não existe. " +
  "Prova-se que a regra está no arquivo; que o nome de 30 letras cabe na " +
  "caixa, e que tela e PDF saem idênticos, só o olho responde.");

resumo();
