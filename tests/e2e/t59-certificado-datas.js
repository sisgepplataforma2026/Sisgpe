/**
 * TESTE — O CERTIFICADO SAI COM A DATA, E SEM Date CRUA NO TEXTO
 *
 * O QUE ORIGINOU
 *
 * O usuário mandou, em 18/08/2026, o PDF do BOLSA-2026-920837, emitido no
 * sistema no ar. Duas coisas nele:
 *
 *   1. "referente ao semestre letivo de Mon Feb 01 2027 05:00:00 GMT-0300
 *      (Horário Padrão de Brasília)" — o objeto Date impresso cru, dentro
 *      de um documento oficial que vai para a universidade.
 *   2. Nenhuma linha "Vitória/ES, ... de ... de ...". O documento não
 *      dizia quando foi emitido.
 *
 * DIAGNÓSTICO: nenhum dos dois é defeito do repositório. O certificado no
 * ar foi montado por uma versão de VoucherPdf.gs de 13/08, anterior ao
 * commit d166176 — provado por três sinais que batem ao mesmo tempo: a
 * redação antiga ("encontra-se regularmente habilitado", trocada em
 * 8dc6e00), a ausência de voucherPeriodoTexto_ e a ausência do bloco
 * data-local. Os três só coexistem entre a82a67f e 57c9e8c.
 *
 * Ou seja: era divergência entre o projeto Apps Script e o repositório —
 * o risco que o CLAUDE.md registra como "estar no repositório não é estar
 * no ar".
 *
 * POR QUE ESTE TESTE EXISTE MESMO ASSIM
 *
 * O repositório não tinha nenhuma guarda sobre o documento RENDERIZADO. O
 * t33 monta o certificado, mas não olha a data nem o período. Uma volta
 * atrás nesses dois pontos passaria despercebida de novo — e o sintoma
 * aparece num PDF que já foi para a instituição de ensino.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: qual
 * versão de VoucherPdf.gs está no projeto Apps Script. Isso só o usuário
 * confirma, abrindo o arquivo no editor.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;
const fs = require("fs");
const path = require("path");

b.fluxo("CERTIFICADO · A data está no documento e o período não é Date crua");

/* Monta o HTML do certificado pelo mesmo caminho da emissão. Só o
   documento importa aqui — Drive e PDF ficam de fora, e por isso o
   veredito de aparência continua sendo do usuário. */
function certificado(extras) {
  const dados = Object.assign({
    protocolo: "BOLSA-2026-920837",
    codigo: "VAL-20260818202726-3635",
    percentual: 70,
    dataEmissao: new Date(2026, 7, 18, 20, 27),
    reg: {
      NOME_SOLICITANTE: "WANDERSON NASCIMENTO CASTELO",
      CPF_SOLICITANTE: "08538104780",
      CURSO: "MARKETING",
      PERIODO_REFERENCIA: "2027/1",
      ESCOLA_SELECIONADA: "Sociedade Educacao e Gestao de Excelencia I Vila Velha S.a - UVV",
      CNPJ_INSTITUICAO: "37745762000127"
    }
  }, extras || {});
  return g.gerarHtmlDocumentoVoucher_(dados);
}

/* ═══════════════════════════════════════════════════════════
   1. A data de emissão tem que estar no documento
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const html = certificado();
b.ok(html.indexOf("Vitória/ES,") > -1,
  "o certificado traz a linha de local e data",
  "no PDF que o usuário mandou ela não existia — versão antiga no ar");
b.ok(/Vit[óo]ria\/ES,\s*18 de Agosto de 2026/.test(html),
  "com a data da emissão, por extenso",
  (html.match(/Vit[óo]ria\/ES,[^<]*/) || ["(não achou)"])[0]);

b.passo("2");
b.ok(html.indexOf("NaN") === -1,
  "e em lugar nenhum do documento aparece NaN");

/* ═══════════════════════════════════════════════════════════
   2. O período: nunca um objeto Date impresso cru
   ═══════════════════════════════════════════════════════════

   Esta é a asserção que o PDF do usuário reprovaria. "GMT-" e os nomes de
   mês em inglês são a assinatura do toString() de Date, e nenhum deles
   tem o que fazer num documento em português.
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
/* As imagens vão embutidas em base64, e base64 é ruído: a primeira versão
   desta asserção reprovou o código porque a logo tinha "GMT" no meio do
   seu próprio base64. Medir o texto do documento quer dizer medir o que
   não é imagem. */
function textoDoDocumento(h) {
  return h.replace(/data:[a-z\/+-]+;base64,[A-Za-z0-9+\/=]+/g, "[IMAGEM]");
}
b.ok(textoDoDocumento(html).indexOf("GMT") === -1,
  "o documento NÃO contém 'GMT' — assinatura de Date impressa crua",
  "no PDF do BOLSA-2026-920837 saiu 'Mon Feb 01 2027 05:00:00 GMT-0300'");
b.ok(!/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} \d{2} \d{4}/.test(html),
  "nem a data no formato do toString() do JavaScript");
b.ok(!/Horário Padrão de Brasília/.test(html),
  "nem o nome do fuso, que só aparece quando a Date foi impressa inteira");

b.passo("4");
b.ok(html.indexOf("semestre letivo de 2027/1") > -1,
  "o período sai legível: 'semestre letivo de 2027/1'",
  (html.match(/(semestre|ano) letivo de [^<.,]*/) || ["(não achou)"])[0]);

/* ═══════════════════════════════════════════════════════════
   3. O período vindo como Date da planilha
   ═══════════════════════════════════════════════════════════

   É o caso real: o Sheets converte "2027/1" em 1º de fevereiro de 2027.
   O documento tem que desconverter, não imprimir.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
/* Como o Sheets converte: "2027/1" vira 1º de JANEIRO de 2027 e "2027/2"
   vira 1º de FEVEREIRO — o semestre cai na casa do mês. Minha primeira
   versão aqui esperava que fevereiro voltasse como 2027/1, e reprovou o
   código estando ele certo. O período do PDF do usuário saiu "Feb 01
   2027" justamente porque a solicitação dele é do 2º semestre. */
function periodoNoDocumento(data) {
  const h = certificado({
    reg: { NOME_SOLICITANTE: "WANDERSON NASCIMENTO CASTELO", CURSO: "MARKETING",
           PERIODO_REFERENCIA: data, ESCOLA_SELECIONADA: "UVV" }
  });
  return { html: h, rotulo: (h.match(/(semestre|ano) letivo de [^<.,]*/) || ["(não achou)"])[0] };
}

const segundoSem = periodoNoDocumento(new Date(2027, 1, 1));
b.ok(textoDoDocumento(segundoSem.html).indexOf("GMT") === -1,
  "com o período vindo como Date da planilha, nada de GMT no texto",
  "este é EXATAMENTE o caso do PDF que o usuário mandou");
b.igual(segundoSem.rotulo, "semestre letivo de 2027/2",
  "1º de fevereiro volta a ser 2027/2 — o semestre estava na casa do mês");

b.passo("6");
/* Contraprova: janeiro tem que dar OUTRO resultado. Sem isto, uma função
   que devolvesse "2027/2" para tudo passaria na asserção de cima. */
const primeiroSem = periodoNoDocumento(new Date(2027, 0, 1));
b.igual(primeiroSem.rotulo, "semestre letivo de 2027/1",
  "e 1º de janeiro volta a ser 2027/1, não o mesmo valor");

/* ═══════════════════════════════════════════════════════════
   4. A redação é a extraída do papel do sindicato
   ═══════════════════════════════════════════════════════════

   O PDF do usuário trazia a redação ANTERIOR a 8dc6e00. Guardar isto é o
   que torna uma versão velha no ar detectável: se o certificado voltar a
   dizer "encontra-se regularmente habilitado", alguém desfez o commit.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
b.ok(html.indexOf("Incentivo ao Aprimoramento") > -1,
  "o corpo cita a cláusula de Incentivo ao Aprimoramento, como o papel real");
b.ok(html.indexOf("encontra-se regularmente habilitado") === -1,
  "e NÃO usa mais a redação antiga, trocada em 8dc6e00",
  "era a que estava no PDF do BOLSA-2026-920837");

/* ═══════════════════════════════════════════════════════════
   5. O arquivo do repositório é o que se está medindo
   ═══════════════════════════════════════════════════════════ */
b.passo("8");
const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "VoucherPdf.gs"), "utf8");
const limpo = fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
b.ok(/voucherPeriodoTexto_\(\s*reg\.PERIODO_REFERENCIA\s*\)/.test(limpo),
  "o período é lido pelo normalizador, não cru");
b.ok(/class='data-local'/.test(limpo),
  "e o bloco da data de emissão está no template");

b.naoTestavel("Qual versão de VoucherPdf.gs está no projeto Apps Script",
  "o repositório está certo nos dois pontos; o PDF de 18/08 veio de uma versão de 13/08 — só o usuário confirma abrindo o arquivo no editor");

b.resumo();
