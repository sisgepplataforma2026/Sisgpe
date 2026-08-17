/**
 * TESTE — OS NOMES SAEM NO OFÍCIO, EM TODO OFÍCIO NOMINAL
 *
 * O QUE ORIGINOU ESTE TESTE
 *
 * O usuário perguntou, em 17/08/2026: "o ofício de taxa negocial eu consigo
 * incluir até 25 pessoas e sai no ofício o nome das 25 pessoas?". A resposta,
 * medida antes de mexer em qualquer coisa: incluía as 25, exigia uma ficha
 * anexada para cada uma, e imprimia ZERO nomes no PDF.
 *
 *     TAXA_NEGOCIAL ............ 0 de 25 nomes no documento
 *     TAXA_ASSISTENCIAL ........ 0 de 25
 *     OPOSICAO_TAXA_NEGOCIAL ... 0 de 25
 *     FILIACAO ................. 25 de 25
 *     DESFILIACAO .............. 25 de 25
 *
 * A escola recebia uma cobrança de taxa sem saber de quem descontar. A causa
 * era uma condição em Oficios.gs que citava FILIACAO e DESFILIACAO pelo nome
 * e deixava os outros três de fora.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Ele gera o HTML real do ofício, com 25 nomes, para cada tipo, e CONTA
 * quantos aparecem no documento. Não confere se a função existe nem se o
 * código "parece certo": conta nome dentro do HTML que vira PDF.
 *
 * A contraprova está junto: o OFÍCIO LIVRE tem que continuar SEM a lista.
 * Sem essa asserção, trocar a condição por "sempre mostra" passaria no teste
 * e colocaria um bloco de colaboradores num ofício de texto livre.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * conversão para PDF, a aparência do bloco na folha e o envio por e-mail.
 * Isso exige gerar um ofício de verdade no sistema no ar.
 */
const b = require("./base");
const g = b.subir({}).g;

/* Tipos que levam lista de pessoas. O texto do corpo muda entre eles; o
   bloco de nomes é o mesmo — foi o que o usuário pediu, com essas palavras:
   "Mesmo formato do ofício de filiação e desfiliação, o que muda é o texto". */
const TIPOS_NOMINAIS = ["FILIACAO", "DESFILIACAO", "TAXA_NEGOCIAL",
                        "TAXA_ASSISTENCIAL", "OPOSICAO_TAXA_NEGOCIAL"];

const nomes = [];
for (let i = 1; i <= 25; i++) nomes.push("COLABORADOR TESTE " + String(i).padStart(2, "0"));

function gerarOficio(tipo, listaNomes) {
  const proc = g.montarDadosOficio_({
    tipo: tipo, escola: "ESCOLA TESTE", para: "DIRETORIA",
    cnpj: "00.000.000/0001-00", colaboradores: listaNomes,
    assunto: "Teste", corpo: "Texto livre de teste."
  }, "preview");
  const html = g.gerarHtmlOficioCompleto_({
    numero: proc.numero, tipoNorm: proc.tipoNorm, assunto: "Teste",
    escola: "ESCOLA TESTE", para: "DIRETORIA", cnpj: "00.000.000/0001-00",
    colaboradores: proc.colaboradoresArr, corpoTexto: proc.corpoTexto,
    dataHoje: proc.dataExtenso, assBase64: "", assMime: ""
  }, true);
  return { html: html, tipoNorm: proc.tipoNorm, corpo: proc.corpoTexto || "" };
}

function contarNomes(html, listaNomes) {
  return listaNomes.filter(n => html.indexOf(n) !== -1).length;
}

b.fluxo("OFÍCIOS · Os nomes saem no documento");

b.passo("1. Todo ofício nominal imprime as 25 pessoas");
TIPOS_NOMINAIS.forEach(tipo => {
  const r = gerarOficio(tipo, nomes);
  const achados = contarNomes(r.html, nomes);
  b.ok(achados === 25, tipo + " imprime os 25 nomes",
    achados === 25 ? "25 de 25" : "SÓ " + achados + " de 25 apareceram no documento");
});

b.passo("2. O bloco 'Colaborador(es)' aparece, com o contador certo");
TIPOS_NOMINAIS.forEach(tipo => {
  const r = gerarOficio(tipo, nomes);
  const temBloco = /Colaborador\(es\)/.test(r.html);
  // O contador dourado do cabeçalho do bloco mostra quantos são.
  const temContador = r.html.indexOf(">25<") !== -1;
  b.ok(temBloco && temContador, tipo + " tem o bloco de colaboradores com contador",
    temBloco ? (temContador ? "bloco e contador presentes" : "bloco presente, contador ausente")
             : "BLOCO AUSENTE");
});

b.passo("3. Ofício livre continua SEM lista de nomes");
// Contraprova. Sem ela, "mostrar sempre" passaria como se fosse acerto.
const livre = gerarOficio("OFICIO_LIVRE", nomes);
b.ok(!/Colaborador\(es\)/.test(livre.html),
  "OFICIO_LIVRE não ganha bloco de colaboradores",
  livre.tipoNorm + " · " + (/Colaborador\(es\)/.test(livre.html) ? "GANHOU BLOCO — errado" : "sem bloco, como deve ser"));

b.passo("4. Cada tipo mantém o SEU texto — só a lista é comum");
// O pedido foi "muda o texto, o formato é o mesmo". Se dois tipos passarem a
// gerar o mesmo corpo, alguma coisa se perdeu no caminho.
const corpos = {};
TIPOS_NOMINAIS.forEach(t => { corpos[t] = gerarOficio(t, nomes).corpo; });
const textosDistintos = new Set(Object.values(corpos)).size;
b.ok(textosDistintos === TIPOS_NOMINAIS.length,
  "os " + TIPOS_NOMINAIS.length + " tipos têm textos diferentes entre si",
  textosDistintos + " textos distintos");
b.ok(/Cláusula 57/.test(corpos.TAXA_NEGOCIAL),
  "o texto da Taxa Negocial continua citando a Cláusula 57ª da CCT",
  corpos.TAXA_NEGOCIAL.slice(0, 60).replace(/\n/g, " ") + "...");

b.passo("5. Um só nome também sai (não é caso especial do 25)");
const um = gerarOficio("TAXA_NEGOCIAL", ["MARIA DA SILVA"]);
b.ok(um.html.indexOf("MARIA DA SILVA") !== -1,
  "Taxa Negocial com uma pessoa imprime o nome dela",
  um.html.indexOf("MARIA DA SILVA") !== -1 ? "nome presente" : "NOME AUSENTE");

b.naoTestavel("A conversão para PDF e a aparência do bloco na folha",
  "o emulador não converte HTML em PDF — exige gerar um ofício no sistema no ar");
b.naoTestavel("O envio do ofício por e-mail à escola", "idem");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
