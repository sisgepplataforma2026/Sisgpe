/**
 * TESTE — A DATA DE EMISSÃO DO VOUCHER SAI, E SAI CERTA
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 18/08/2026: "no voucher não está saindo a data de emissão".
 *
 * Medindo os formatadores um por um, o defeito é maior do que o relato — e
 * a metade mais grave é a que NÃO aparece, porque não deixa buraco na tela.
 *
 * As quatro funções de data do módulo faziam `new Date(texto)`. O JavaScript
 * lê texto com barra no formato AMERICANO, mês primeiro:
 *
 *     "12/08/2026 10:30"  →  8 de DEZEMBRO      dia e mês trocados
 *     "25/08/2026"        →  Date inválida      não existe mês 25
 *
 * Os dois estragos:
 *
 *   - Dia até 12 — a data SAI e sai ERRADA. O certificado chega na
 *     instituição de ensino com outra data e ninguém percebe, porque
 *     08/12/2026 é uma data plausível. Este é o pior dos dois.
 *   - Dia de 13 em diante — a data não sai. Em branco na lista, e no
 *     documento saía "Vitória/ES, NaN de undefined de NaN.".
 *
 * E pegava a ORDENAÇÃO junto: a lista ordena por timestampSeguroVoucher_
 * aplicado ao texto já formatado, então toda linha com dia acima de 12
 * virava timestamp 0 e afundava para o fim da lista.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO: os quatro caminhos de data lendo
 * texto brasileiro, ISO, Date, Date inválida e vazio — mais a ordenação da
 * lista com datas que cruzam o dia 12.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: como a
 * data aparece no PDF montado pelo Drive. O emulador não gera PDF.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;

b.fluxo("VOUCHER · A data lida da planilha é a data que estava escrita");

/* ═══════════════════════════════════════════════════════════
   1. O leitor único: texto brasileiro é lido como brasileiro
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
b.ok(typeof g.voucherDataDeQualquerCoisa_ === "function",
  "existe um leitor único de data para o módulo");

function lido(valor) {
  const d = g.voucherDataDeQualquerCoisa_(valor);
  return d ? [d.getDate(), d.getMonth() + 1, d.getFullYear()].join("/") : null;
}

b.igual(lido("25/08/2026"), "25/8/2026",
  "dia 25 é lido como DIA 25 — antes virava Date inválida e sumia da tela");
b.igual(lido("12/08/2026 10:30"), "12/8/2026",
  "dia 12 é lido como DIA 12, não como mês 12",
  "este é o caso silencioso: antes saía 8 de dezembro, e parecia certo");
b.igual(lido("05/08/2026"), "5/8/2026",
  "dia 5 de agosto não vira 8 de maio");
b.igual(lido("31/12/2026 23:59"), "31/12/2026", "fim de ano");
b.igual(lido("01/01/2027"), "1/1/2027", "começo de ano");

b.passo("2");
/* Date de verdade continua passando — é o que VoucherPdf.gs grava. */
b.igual(lido(new Date(2026, 7, 12)), "12/8/2026", "objeto Date passa direto");
b.igual(lido("2026-08-12T10:30:00"), "12/8/2026", "ISO continua sendo lido");

b.passo("3");
/* O que NÃO é data tem que voltar null — e não uma data inventada. */
b.igual(lido(""), null, "vazio devolve null");
b.igual(lido(null), null, "null devolve null");
b.igual(lido(new Date("banana")), null, "Date inválida devolve null");
b.igual(lido("período 2026/2"), null, "texto que não é data devolve null");
b.igual(lido("2026/2"), null,
  "PERÍODO não vira data — este apareceu ao rodar o teste",
  "o Date nativo lia \"período 2026/2\" como 1º de fevereiro, e o campo " +
  "PERIODO_REFERENCIA deste módulo é literalmente \"2026/2\"");
b.igual(lido("2026/2"), lido("'2026/2"),
  "com ou sem o apóstrofo protetor da planilha, período segue não sendo data");
b.igual(lido("31/02/2026"), null,
  "31 de fevereiro devolve null — data que não existe não pode escorregar para março",
  "sem esta checagem o JavaScript devolveria 03/03 calado");
b.igual(lido("00/08/2026"), null, "dia zero devolve null");
b.igual(lido("12/13/2026"), null, "mês 13 devolve null");

/* ═══════════════════════════════════════════════════════════
   2. A lista: o que o usuário vê na tela de emitidos
   ═══════════════════════════════════════════════════════════ */
b.passo("4");
b.igual(g.formatarDataHoraBrVoucher_("25/08/2026"), "25/08/2026 00:00",
  "a data de emissão APARECE na lista",
  "era exatamente isto que o usuário relatou não estar saindo");
b.igual(g.formatarDataHoraBrVoucher_("12/08/2026 10:30"), "12/08/2026 10:30",
  "e com o dia e o mês no lugar certo");
b.igual(g.formatarDataHoraBrVoucher_(new Date(2026, 7, 12, 10, 30)), "12/08/2026 10:30",
  "Date também");
b.igual(g.formatarDataHoraBrVoucher_(""), "",
  "vazio continua vazio — não se inventa data na lista");
b.igual(g.formatarDataHoraBrVoucher_(new Date("banana")), "",
  "Date inválida continua vazia");

b.passo("5");
b.igual(g.formatarDataBrVoucher_("25/08/2026"), "25/08/2026",
  "a versão só-data também");
b.igual(g.formatarDataBrVoucher_("12/08/2026"), "12/08/2026",
  "sem trocar dia por mês");

/* ═══════════════════════════════════════════════════════════
   3. O documento: nunca imprimir NaN
   ═══════════════════════════════════════════════════════════ */
b.passo("6");
const extenso25 = g.dataExtensoVoucher_("25/08/2026");
b.ok(extenso25.indexOf("NaN") === -1,
  "o documento NUNCA imprime NaN", extenso25);
b.ok(extenso25.indexOf("25 de Agosto de 2026") > -1,
  "e traz a data que estava na planilha, por extenso", extenso25);

const extenso12 = g.dataExtensoVoucher_("12/08/2026 10:30");
b.ok(extenso12.indexOf("12 de Agosto") > -1,
  "dia 12 sai como 12 de agosto, não como 8 de dezembro", extenso12);

b.passo("7");
/* Contraprova: o extenso não pode ter virado uma função que sempre devolve
   hoje. Isso "consertaria" o NaN apagando a informação. */
const extensoAntigo = g.dataExtensoVoucher_(new Date(2024, 2, 7));
b.ok(extensoAntigo.indexOf("07 de Março de 2024") > -1,
  "uma data antiga sai como ela é, não como hoje", extensoAntigo);
b.ok(g.dataExtensoVoucher_(new Date("banana")).indexOf("NaN") === -1,
  "e o ilegível cai para hoje em vez de imprimir NaN",
  g.dataExtensoVoucher_(new Date("banana")));

/* ═══════════════════════════════════════════════════════════
   4. A ordenação da lista, que quebrava junto
   ═══════════════════════════════════════════════════════════

   A tela ordena por timestampSeguroVoucher_ aplicado ao texto já formatado.
   Com o leitor antigo, todo dia acima de 12 virava 0 e ia para o fim — a
   lista ficava fora de ordem sem nenhum sinal de erro.
   ═══════════════════════════════════════════════════════════ */
b.passo("8");
const datas = ["25/08/2026 10:00", "12/08/2026 10:00", "05/08/2026 10:00",
               "31/07/2026 10:00", "01/09/2026 10:00"];
const ordenado = datas.slice().sort(function (x, y) {
  return g.timestampSeguroVoucher_(y) - g.timestampSeguroVoucher_(x);
});
b.igual(ordenado,
  ["01/09/2026 10:00", "25/08/2026 10:00", "12/08/2026 10:00",
   "05/08/2026 10:00", "31/07/2026 10:00"],
  "a lista ordena da mais recente para a mais antiga",
  "com o leitor antigo, 25/08 e 31/07 caíam para o fim com timestamp 0");

b.passo("9");
b.ok(g.timestampSeguroVoucher_("25/08/2026") > 0,
  "dia acima de 12 tem timestamp de verdade, não 0");
b.igual(g.timestampSeguroVoucher_(""), 0, "vazio continua 0");
b.igual(g.timestampSeguroVoucher_("não é data"), 0, "texto qualquer continua 0");

b.naoTestavel("Como a data aparece no PDF montado pelo Drive",
  "o emulador não gera PDF — a linha 'Vitória/ES, ...' se confere abrindo um certificado no ar");

b.resumo();
