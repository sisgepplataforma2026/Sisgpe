/**
 * TESTE — O TEXTO DO E-MAIL É ADAPTADO A CADA TIPO DE OFÍCIO
 *
 * O QUE ORIGINOU
 *
 * Pergunta do usuário em 18/08/2026: "como é o texto do e-mail que é
 * enviado? Ele é adaptado a cada taxa?". Em vez de responder pela leitura
 * do código, gerei o e-mail de verdade para os seis tipos e li o que saiu.
 *
 * A resposta medida foi: adaptado sim, MENOS em um — e justo o que estava
 * sem cobertura nenhuma.
 *
 *     Filiação .................. texto próprio, Cláusula 56ª
 *     Desfiliação ............... texto próprio, Cláusula 56ª
 *     Taxa Negocial ............. texto próprio, Cláusula 57ª
 *     Taxa Assistencial ......... texto próprio, Cláusula 58ª
 *     Ofício Livre .............. texto genérico (correto: o texto está no PDF)
 *     Oposição à Taxa Negocial .. CORPO VAZIO
 *
 * A escola recebia um e-mail com cabeçalho, selo do tipo e assinatura — e
 * NENHUMA linha de texto. O motivo: montarEmailHTML tinha um if/else por
 * assuntoTipo e "Oposição à Taxa Negocial" não tinha ramo, então
 * textoPrincipal ficava string vazia e ninguém reclamava.
 *
 * O segundo achado é de conteúdo: os textos das duas taxas estavam mais
 * pobres que o ofício que vai anexo. O ofício de Taxa Negocial já dizia 6%
 * em três parcelas de 2%, isenção dos filiados e relação nominal; o e-mail
 * só falava do prazo. O de Taxa Assistencial não citava a competência nem
 * os vencimentos. Quem lê o e-mail e não abre o anexo ficava sem a regra.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Gera o HTML real do e-mail para cada tipo e verifica o texto que saiu.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a entrega
 * do e-mail, como ele aparece no Gmail da escola e o anexo em PDF.
 */
const b = require("./base");
const g = b.subir({}).g;

const TIPOS = ["Filiação", "Desfiliação", "Taxa Negocial",
               "Oposição à Taxa Negocial", "Taxa Assistencial", "Ofício Livre"];

/** Texto puro do e-mail, sem as tags. */
function corpo(tipo, quantidade) {
  const html = g.montarEmailHTML(tipo, "280/2026", tipo, quantidade || 3, "");
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* ═══════════════════════════════════════════════════════════
   1. Nenhum tipo sai com o corpo em branco
   ═══════════════════════════════════════════════════════════ */
b.fluxo("E-MAIL · Todo tipo tem texto próprio");

b.passo("1");
TIPOS.forEach(t => {
  const c = corpo(t);
  b.ok(c.indexOf("Encaminhamos") > -1,
    "o e-mail de " + t + " tem texto principal",
    c.indexOf("Encaminhamos") > -1 ? "" : "CORPO VAZIO — a escola recebia e-mail sem uma linha de texto");
});

/* Contraprova: os textos têm que ser DIFERENTES entre si. Um texto genérico
   único passaria na asserção acima e destruiria a adaptação por tipo. */
b.passo("2");
const corpos = {};
TIPOS.forEach(t => { corpos[t] = corpo(t); });
const distintos = new Set(TIPOS.filter(t => t !== "Ofício Livre").map(t => corpos[t]));
b.igual(distintos.size, 5,
  "os cinco tipos institucionais têm textos DIFERENTES entre si",
  "sem isto, um texto genérico para todos passaria no teste anterior");

/* ═══════════════════════════════════════════════════════════
   2. Cada texto cita a cláusula certa da CCT 2026/2027
   ═══════════════════════════════════════════════════════════ */
b.fluxo("E-MAIL · A cláusula citada é a do tipo");

b.passo("3");
const CLAUSULA = {
  "Filiação": "56", "Desfiliação": "56",
  "Taxa Negocial": "57", "Oposição à Taxa Negocial": "57",
  "Taxa Assistencial": "58"
};
Object.keys(CLAUSULA).forEach(t => {
  const c = corpo(t);
  b.ok(c.indexOf("Cláusula " + CLAUSULA[t]) > -1,
    t + " cita a Cláusula " + CLAUSULA[t] + "ª");
  b.ok(c.indexOf("CCT 2026/2027") > -1, t + " cita a CCT 2026/2027");
});

/* Contraprova: a CCT velha não pode ter sobrado em lugar nenhum. */
b.passo("4");
TIPOS.forEach(t => {
  b.ok(corpo(t).indexOf("2025/2026") === -1,
    "o e-mail de " + t + " não cita a CCT antiga");
});

/* ═══════════════════════════════════════════════════════════
   3. O e-mail conta a mesma regra que o ofício anexo
   ═══════════════════════════════════════════════════════════

   Quem recebe lê o e-mail primeiro; muita gente decide sem abrir o PDF.
   Se a regra só está no anexo, ela não chegou.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("E-MAIL · A regra da CCT chega no corpo, não só no anexo");

b.passo("5");
const negocial = corpo("Taxa Negocial");
b.ok(/6%|6 %|seis por cento/i.test(negocial),
  "Taxa Negocial diz o percentual total de 6%");
b.ok(/tr(ê|e)s parcelas/i.test(negocial),
  "Taxa Negocial diz que são três parcelas");
b.ok(/filiad/i.test(negocial),
  "Taxa Negocial avisa da isenção de quem é filiado",
  "sem isso a escola desconta de quem já paga mensalidade");
b.ok(/rela(ç|c)(ã|a)o nominal/i.test(negocial),
  "Taxa Negocial pede a relação nominal do repasse");
b.ok(/10º dia útil/.test(negocial),
  "Taxa Negocial mantém o prazo do repasse");

b.passo("6");
const assistencial = corpo("Taxa Assistencial");
b.ok(/mar(ç|c)o\/2027|março de 2027/i.test(assistencial),
  "Taxa Assistencial diz a competência (março/2027)");
b.ok(assistencial.indexOf("15/04/2027") > -1 && assistencial.indexOf("15/05/2027") > -1,
  "Taxa Assistencial diz os dois vencimentos");
b.ok(/duas parcelas/i.test(assistencial),
  "Taxa Assistencial diz que são duas parcelas");

b.passo("7");
const oposicao = corpo("Oposição à Taxa Negocial");
b.ok(/oposi(ç|c)(ã|a)o/i.test(oposicao),
  "o e-mail de oposição fala em oposição");
/* A asserção anterior procurava "não" ANTES de "desconto" e reprovava o
   texto correto, que diz "o desconto da Taxa Negocial não seja realizado".
   O que importa não é a ordem das palavras: é a frase pedir para não
   descontar e falar em devolver o que já foi descontado. */
b.ok(/descont/i.test(oposicao) && /n(ã|a)o seja (realizado|efetuado|feito)/i.test(oposicao),
  "e pede que o desconto NÃO seja realizado para quem se opôs",
  "é a única coisa que esse ofício existe para dizer");
/* NÃO pede restituição. Eu havia escrito "caso já tenha sido efetuado, que
   o valor seja restituído" e o usuário mandou tirar: o ofício anexo não pede
   devolução, só determina que o desconto não seja feito. E-mail e documento
   têm que dizer a mesma coisa — se o e-mail pede mais que o ofício, a escola
   recebe duas ordens diferentes no mesmo envio. */
b.ok(!/restitu/i.test(oposicao),
  "NÃO pede restituição — o ofício anexo também não pede",
  "e-mail e documento precisam determinar a mesma coisa");
b.ok(!/6%|tr(ê|e)s parcelas/i.test(oposicao),
  "e NÃO repete a cobrança da Taxa Negocial",
  "seria o contrário do que o documento pede");

/* ═══════════════════════════════════════════════════════════
   4. Singular e plural
   ═══════════════════════════════════════════════════════════ */
b.fluxo("E-MAIL · Uma pessoa e várias pessoas");

b.passo("8");
b.ok(corpo("Filiação", 1) !== corpo("Filiação", 3),
  "o texto muda entre 1 e 3 trabalhadores");
b.ok(/ficha de filiação/i.test(corpo("Filiação", 1)),
  "com 1 pessoa fala em 'ficha' no singular");
b.ok(/fichas de filiação/i.test(corpo("Filiação", 3)),
  "com 3 pessoas fala em 'fichas' no plural");

/* ═══════════════════════════════════════════════════════════
   5. Texto escrito à mão continua mandando
   ═══════════════════════════════════════════════════════════

   Quem atende pode reescrever o e-mail. O texto padrão é sugestão, não
   imposição — se o custom for ignorado, a pessoa edita e o sistema manda
   outra coisa sem avisar. É o pior tipo de defeito.
   ═══════════════════════════════════════════════════════════ */
b.passo("9");
const custom = g.montarEmailHTML("Taxa Negocial", "280/2026", "Taxa Negocial", 3,
  "Texto escrito pela secretaria, bem diferente do padrão.");
b.ok(String(custom).indexOf("Texto escrito pela secretaria") > -1,
  "o texto digitado pelo atendente é o que vai no e-mail");
b.ok(String(custom).indexOf("10º dia útil") === -1,
  "e o texto padrão não é grudado junto");

/* ═══════════════════════════════════════════════════════════
   8. O OFÍCIO também tem texto próprio por tipo
   ═══════════════════════════════════════════════════════════

   O usuário, em 18/08/2026, foi taxativo: "você tem que tratar cada taxa
   com seu texto. Taxa Negocial é um texto, Taxa Assistencial é outro texto,
   Filiação é outro, Desfiliação é outro, cada um com o seu. Você não pode
   classificar um somente para todos."

   O e-mail já estava coberto acima. O corpo do OFÍCIO, não — e é ele que
   vira o PDF que a escola arquiva. Este bloco fecha a porta nos dois lados.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIO · Cada tipo com o seu texto no documento");

const UMA_PESSOA = [{ nome: "CLARA GOMES" }];
function corpoOficio(tipo) {
  const p = g.montarDadosOficio_({
    tipo: tipo, escola: "COLEGIO EXEMPLO", cnpj: "36136001000105",
    colaboradores: UMA_PESSOA
  }, "preview");
  return String(p.corpoTexto || "").replace(/\s+/g, " ").trim();
}

b.passo("10");
const TIPOS_DOC = ["Filiação", "Desfiliação", "Taxa Negocial",
                   "Oposição à Taxa Negocial", "Taxa Assistencial"];
const corposDoc = {};
TIPOS_DOC.forEach(t => {
  corposDoc[t] = corpoOficio(t);
  b.ok(corposDoc[t].length > 200, "o ofício de " + t + " tem corpo",
    corposDoc[t].length + " caracteres");
});

b.passo("11");
b.igual(new Set(TIPOS_DOC.map(t => corposDoc[t])).size, 5,
  "os CINCO textos de ofício são diferentes entre si",
  "um texto único para todos passaria na asserção anterior");

/* Cada um tem que citar a SUA cláusula. É o que separa um documento
   institucional de um texto genérico com o nome do tipo trocado. */
b.passo("12");
const CLAUSULA_DOC = {
  "Filiação": "56", "Desfiliação": "56", "Taxa Negocial": "57",
  "Oposição à Taxa Negocial": "57", "Taxa Assistencial": "58"
};
TIPOS_DOC.forEach(t => {
  b.ok(corposDoc[t].indexOf("Cláusula " + CLAUSULA_DOC[t]) > -1,
    "o ofício de " + t + " cita a Cláusula " + CLAUSULA_DOC[t] + "ª");
});

/* O assunto de cada um aparece no seu próprio texto e NÃO no dos outros —
   a prova de que nenhum foi copiado do vizinho. */
b.passo("13");
const MARCA = {
  "Filiação": /quadro de associados.*a partir da presente data/i,
  "Desfiliação": /direito de desfiliação/i,
  "Taxa Negocial": /6% \(seis por cento\)/i,
  "Oposição à Taxa Negocial": /direito de oposição/i,
  "Taxa Assistencial": /Assistência Médica/i
};
TIPOS_DOC.forEach(t => {
  b.ok(MARCA[t].test(corposDoc[t]),
    "o ofício de " + t + " diz o que só ele diz");
});

/* Contraprova cruzada: a marca de um tipo não pode aparecer no texto de
   outro. Se a Filiação carregasse "6% (seis por cento)", seria sinal de
   texto emprestado. */
b.passo("14");
let vazamentos = [];
TIPOS_DOC.forEach(dono => {
  TIPOS_DOC.forEach(outro => {
    if (dono === outro) return;
    /* Negocial e Oposição falam da mesma taxa de propósito — a oposição
       PRECISA citar a Taxa Negocial para dizer que não se deve descontar. */
    if (/Taxa Negocial/.test(dono) && /Taxa Negocial/.test(outro)) return;
    if (MARCA[dono].test(corposDoc[outro])) vazamentos.push(dono + " → " + outro);
  });
});
b.igual(vazamentos, [], "nenhum tipo carrega a marca registrada de outro");

/* ═══════════════════════════════════════════════════════════
   9. Existe UM despachante de texto, não dois
   ═══════════════════════════════════════════════════════════

   Descoberto ao mutar o código para provar as asserções acima: a mutação
   PASSOU. Havia dois despachantes — o switch de Oficios.gs, que está no ar,
   e montarTextoOficioPadrao_ em HelperOficios.gs, que não tem chamador
   nenhum. Mutei o morto e o teste não sentiu.

   Um despachante duplicado é onde "cada tipo com o seu texto" volta a se
   misturar sem ninguém ver — e o legado já tinha divergido: não trata
   OPOSICAO_TAXA_NEGOCIAL. Este bloco vigia os dois.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIO · Um despachante de texto, não dois");

const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..", "..");
const fonteOficios = fs.readFileSync(path.join(raiz, "Oficios.gs"), "utf8");
const fonteHelper  = fs.readFileSync(path.join(raiz, "HelperOficios.gs"), "utf8");

b.passo("15");
/* O switch vivo tem que cobrir os CINCO tipos, cada um com a sua função. */
["montarTextoFiliacao_", "montarTextoDesfiliacao_", "montarTextoTaxaNegocial_",
 "montarTextoOposicaoTaxaNegocial_", "montarTextoTaxaAssistencial_"].forEach(fn => {
  b.ok(fonteOficios.indexOf(fn + "(dados, colaboradoresArr)") > -1,
    "o despachante vivo chama " + fn);
});

b.passo("16");
/* O legado continua sem chamador. Se alguém o religar, esta asserção cai e
   obriga a decidir qual dos dois manda — em vez de os dois divergirem. */
const chamadasLegado = (fonteOficios + fonteHelper)
  .split("montarTextoOficioPadrao_").length - 1;
b.igual(chamadasLegado, 1,
  "montarTextoOficioPadrao_ aparece só na própria declaração",
  "mais de uma ocorrência significa que o despachante morto foi religado");

b.ok(/DESPACHANTE LEGADO/.test(fonteHelper),
  "e está marcado no arquivo como legado, para ninguém corrigir o lado errado");

b.resumo();
