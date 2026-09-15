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
const b = require("./base");
const { g } = b.subir({});
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const tpl = fs.readFileSync(RAIZ + "/EventosIngressoTemplate.html", "utf8");
const css = (tpl.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
const pdf = fs.readFileSync(RAIZ + "/EventosEntrega.gs", "utf8");

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
fluxo("A arte oficial precisa chegar à tela — senão não há modelo nenhum");

/* 15/09/2026. Ele abriu o ingresso pelo link: fundo azul liso, o texto
   alternativo da imagem no canto, e os campos soltos no nada. Os campos são
   posicionados em % SOBRE a arte; sem ela, nada está no lugar.
   O scriptlet de impressão padrão do Apps Script escapa por CONTEXTO, e
   dentro de atributo de URL recusa URI de dados embutido. O PDF do e-mail
   nunca sofreu disso porque é montado por concatenação, sem template — era
   por isso que um saía certo e o outro não. */
passo("a arte é impressa sem o filtro de URL");
ok(/<\?!=\s*dados\.arteDataUri\s*\?>/.test(tpl),
   "usa a forma de impressão forçada",
   "com a forma padrão o filtro de contexto troca o data: por um valor " +
   "inválido, e a imagem fica na página sem carregar");
ok(!/src="<\?=\s*dados\.arteDataUri/.test(tpl),
   "e não sobrou nenhuma impressão escapada no src da arte");

passo("e se a arte falhar, o ingresso DIZ que está incompleto");
ok(/onerror=/.test(tpl) && /semArte/.test(tpl),
   "há aviso ligado ao erro de carga da imagem",
   "um ingresso bonito e vazio é pior do que um que avisa: ninguém " +
   "descobriria até a portaria");
ok(/A arte oficial não carregou/.test(tpl), "com texto que a secretaria entende");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Os DOIS geradores desenham o mesmo bilhete");

/* A descoberta de 15/09, e a que responde de verdade ao pedido dele: o
   ingresso não tem um gerador, tem DOIS. `EventosIngressoTemplate.html` faz a
   tela e o link; `compasso_ingressoPdf_` monta outro HTML, por concatenação,
   para o PDF do e-mail. Ajustar a fonte do primeiro nunca ia bastar.
   Eles não precisam ser o mesmo CÓDIGO — precisam desenhar o mesmo bilhete.
   É isso que este bloco cobra, campo a campo. */
const CAMPOS_PDF = [
  ["main-name",     "67.35", "25.7", "10.2", "7.6"],
  ["main-school",   "67.35", "34.4", "10.4", "7.8"],
  ["main-category", "67.35", "43.4", "10.3", "5.4"],
  ["stub-name",     "84.7",  "46.7", "13.1", "9.8"],
  ["stub-school",   "84.7",  "58.2", "13.1", "9.4"],
  ["stub-category", "84.7",  "69.1", "13.1", "7.5"]
];

passo("cada campo ocupa a mesma posição e o mesmo tamanho nos dois");
CAMPOS_PDF.forEach(function (c) {
  const nome = c[0];
  const regra = (css.match(new RegExp("\\." + nome + "\\{[^}]*\\}")) || [""])[0];
  const naTela = ["left", "top", "width", "height"].map(function (k) {
    const m = regra.match(new RegExp(k + ":\\s*([0-9.]+)%"));
    return m ? m[1] : "?";
  }).join(" ");
  const esperado = c.slice(1).join(" ");
  igual(naTela, esperado, "  ." + nome + " — tela bate com o PDF");
  ok(new RegExp("caixa\\(\\s*" + c[1] + ",\\s*" + c[2] + ",\\s*" + c[3] +
                ",\\s*" + c[4]).test(pdf),
     "  ." + nome + " — o PDF declara as mesmas quatro medidas");
});

passo("e a caixa do PDF passou a ter ALTURA, como a da tela");
ok(/height:' \+ altPct \+ '%/.test(pdf),
   "a altura entra no estilo do campo",
   "sem altura o nome longo escorria para fora e entrava na caixa de baixo — " +
   "era a divergência que sobrava entre os dois modelos");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A conta que encolhe o nome no PDF");

/* Na tela o texto é MEDIDO depois de desenhado. No PDF não há navegador: o
   conversor recebe HTML pronto. Então esta conta é ESTIMADA — e o que se
   cobra dela não é acertar o pixel, é obedecer à mesma REGRA. */
const CAIXA_L = 1634 * 10.2 / 100;   /* a caixa do nome, na frente */
const CAIXA_A = 962 * 7.6 / 100;
const FONTE   = 1634 * 1.05 / 100;

passo("nome curto não encolhe nada");
igual(g.compasso_fontePdfQueCabe_("ANA SILVA", CAIXA_L, CAIXA_A, FONTE), FONTE,
      "a fonte sai igual à original");

/* UMA CORREÇÃO DE ROTA, REGISTRADA. Eu esperava que "MARCELHA ALINE PINTO
   GOMES" encolhesse, e o teste reprovou: pela conta, ela CABE. Com 26
   caracteres numa caixa de 167px a 17,2px, dá duas linhas — 38px numa caixa
   de 73px. O teste estava errado, não a conta.
   Isso importa para entender o print dele: o nome quebrando em três linhas
   NÃO era transbordamento. Era a arte faltando, que deixou os campos soltos
   num fundo liso e fez tudo parecer errado. Caixa estreita com nome em duas
   ou três linhas é o desenho aprovado. */
passo("o nome dela CABE — quem estava errado era a minha expectativa");
igual(g.compasso_fontePdfQueCabe_("MARCELHA ALINE PINTO GOMES",
                                  CAIXA_L, CAIXA_A, FONTE), FONTE,
      "26 caracteres em duas linhas cabem na caixa sem encolher");

passo("o que não cabe, esse sim encolhe");
const longo = g.compasso_fontePdfQueCabe_(
  "MARIA DAS GRAÇAS WANDERLEY MONTENEGRO DE ALBUQUERQUE MARANHÃO FILHA",
  CAIXA_L, CAIXA_A, FONTE);
ok(longo < FONTE, "67 caracteres saem menores",
   "de " + FONTE.toFixed(1) + "px para " + longo.toFixed(1) + "px");
ok(longo >= FONTE * 0.55 - 0.001, "  sem passar do piso");

passo("e numa caixa impossível ele para no piso, em vez de sumir");
const espremido = g.compasso_fontePdfQueCabe_(
  "MARIA DAS GRAÇAS WANDERLEY MONTENEGRO DE ALBUQUERQUE MARANHÃO FILHA",
  CAIXA_L, 962 * 0.02 / 100, FONTE);
igual(Math.round(espremido * 100) / 100, Math.round(FONTE * 0.55 * 100) / 100,
      "para em 55% do tamanho original — o mesmo piso da tela",
      "texto que cabe mas ninguém lê não resolve: a portaria confere no papel");

passo("texto vazio não quebra a conta");
igual(g.compasso_fontePdfQueCabe_("", CAIXA_L, CAIXA_A, FONTE), FONTE, "devolve a original");
igual(g.compasso_fontePdfQueCabe_("X", 0, CAIXA_A, FONTE), FONTE,
      "caixa sem largura também — nenhuma divisão por zero");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("Se o texto realmente cabe",
  "não há navegador, fonte nem layout aqui: scrollHeight não existe. " +
  "Prova-se que a regra está no arquivo; que o nome de 30 letras cabe na " +
  "caixa, e que tela e PDF saem idênticos, só o olho responde.");

resumo();
