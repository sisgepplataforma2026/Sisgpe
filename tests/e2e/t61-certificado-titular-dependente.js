/**
 * TESTE — SÃO DOIS CERTIFICADOS, NÃO UM COM UMA ORAÇÃO A MAIS
 *
 * O QUE ORIGINOU
 *
 * O usuário mandou, em 18/08/2026, os DOIS certificados que o sindicato
 * emite hoje, escaneados dos originais assinados: "segue os modelos como
 * devem sair tanto para o titular quanto o dependente, gentileza analisar".
 *
 * A análise mostrou o que eu não sabia: o papel do dependente NÃO é o do
 * titular com ", dependente de FULANO" injetado no meio — que era
 * exatamente o que o código fazia. São duas redações com fundamento
 * jurídico diferente, verbo diferente e fecho diferente.
 *
 *     TITULAR ...... "cláusula de Incentivo ao Aprimoramento prevista na CCT"
 *                    "ATENDE AOS REQUISITOS ESTABELECIDOS"
 *                    "...semestralidade/ANUIDADE ESCOLAR do Curso de X
 *                     semestre 2026/2"
 *                    "A presente certificação destina-se..."
 *
 *     DEPENDENTE ... "nos termos do CONVÊNIO firmado"
 *                    "ENCONTRA-SE REGULARMENTE HABILITADO"
 *                    "...semestralidade do Curso de X, referente ao
 *                     semestre letivo de 2026/2, após verificação..."
 *                    "O presente certificado destina-se EXCLUSIVAMENTE...
 *                     pessoal, individual e intransferível..."
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO: que cada beneficiário recebe a SUA
 * redação, e — o que mais importa — que uma não vaza na outra. Um
 * dependente que receba "atende aos requisitos estabelecidos" está com o
 * documento do titular, e a instituição de ensino confere isso contra o
 * que já recebeu antes.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: como o
 * documento fica no PDF montado pelo Drive — quebra de linha, margem,
 * posição da data. Isso se confere abrindo um certificado emitido.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;

b.fluxo("CERTIFICADO · Titular e dependente têm redações próprias");

/** O texto do documento, sem marcação e sem as imagens em base64. */
function texto(html) {
  return html
    .replace(/data:[a-z\/+-]+;base64,[A-Za-z0-9+\/=]+/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const BASE = {
  protocolo: "BOLSA-2026-1", codigo: "VAL-1", percentual: 70,
  dataEmissao: new Date(2026, 7, 18)
};

/* Os dados dos DOIS modelos reais que ele mandou. */
const titular = texto(g.gerarHtmlDocumentoVoucher_(Object.assign({}, BASE, {
  rg: "213.360.487-19",
  reg: {
    NOME_SOLICITANTE: "NATHALIA BATISTA DOS SANTOS",
    TIPO_BENEFICIARIO: "TITULAR",
    CURSO: "BIOMEDICINA", PERIODO_REFERENCIA: "2026/2",
    ESCOLA_FANTASIA: "MULTIVIX – VITÓRIA",
    ESCOLA_SELECIONADA: "EMPRESA BRASILEIRA DE ENSINO, PESQUISA E EXTENSÃO S/A - EMBRAE",
    CNPJ_INSTITUICAO: "01936248000121"
  }
})));

const dependente = texto(g.gerarHtmlDocumentoVoucher_(Object.assign({}, BASE, {
  rg: "2.288.609/SPTC-ES",
  reg: {
    NOME_SOLICITANTE: "ATILA HENRIQUE DE OLIVEIRA GONÇALVES",
    NOME_BENEFICIARIO: "ISABELA CRISTINA MICAELLA DOS ANJOS PEREIRA",
    TIPO_BENEFICIARIO: "DEPENDENTE",
    CURSO: "Biomedicina", PERIODO_REFERENCIA: "2026/2",
    ESCOLA_FANTASIA: "MULTIVIX – VITÓRIA",
    ESCOLA_SELECIONADA: "Empresa Brasileira de Ensino, Pesquisa e Extensão S/A EMBRAE",
    CNPJ_INSTITUICAO: "01936248000121"
  }
})));

/* ═══════════════════════════════════════════════════════════
   1. Cada um recebe a SUA redação
   ═══════════════════════════════════════════════════════════ */
b.passo("1 · titular");
b.ok(titular.indexOf("cláusula de Incentivo ao Aprimoramento") > -1,
  "o titular é fundamentado na cláusula de Incentivo ao Aprimoramento");
b.ok(titular.indexOf("atende aos requisitos estabelecidos para a concessão") > -1,
  "com o verbo 'atende aos requisitos estabelecidos'");
b.ok(titular.indexOf("semestralidade/anuidade escolar") > -1,
  "e o desconto sobre 'semestralidade/anuidade escolar'");
b.ok(titular.indexOf("do Curso de BIOMEDICINA semestre 2026/2") > -1,
  "o período escrito como no papel: 'Curso de X semestre 2026/2'",
  (titular.match(/do Curso de [^.]*/) || ["(não achou)"])[0]);
b.ok(titular.indexOf("A presente certificação destina-se à comprovação") > -1,
  "e o fecho do titular");

b.passo("2 · dependente");
b.ok(dependente.indexOf("nos termos do convênio firmado") > -1,
  "o dependente é fundamentado no convênio, não na cláusula da CCT");
b.ok(dependente.indexOf("encontra-se regularmente habilitado ao benefício") > -1,
  "com o verbo 'encontra-se regularmente habilitado'");
b.ok(dependente.indexOf("dependente de ATILA HENRIQUE DE OLIVEIRA GONÇALVES") > -1,
  "nomeando de quem ele é dependente");
b.ok(dependente.indexOf("referente ao semestre letivo de 2026/2") > -1,
  "o período escrito como no papel dele: 'referente ao semestre letivo de'");
b.ok(dependente.indexOf("após verificação do atendimento aos requisitos exigidos") > -1,
  "e a oração de verificação, que só existe no papel do dependente");
b.ok(dependente.indexOf("pessoal, individual e intransferível") > -1,
  "com o fecho restritivo — benefício de filho não se transfere");

/* ═══════════════════════════════════════════════════════════
   2. CONTRAPROVA CRUZADA: uma redação não vaza na outra
   ═══════════════════════════════════════════════════════════

   Esta é a parte que vale o teste. Sem ela, um documento que trouxesse as
   DUAS redações grudadas passaria em tudo acima.
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
b.ok(titular.indexOf("encontra-se regularmente habilitado") === -1,
  "o titular NÃO traz o verbo do dependente");
b.ok(titular.indexOf("nos termos do convênio") === -1,
  "nem o fundamento do dependente");
b.ok(titular.indexOf("pessoal, individual e intransferível") === -1,
  "nem o fecho do dependente");
b.ok(titular.indexOf("dependente de") === -1,
  "e não diz que alguém é dependente de ninguém");

b.passo("4");
b.ok(dependente.indexOf("atende aos requisitos estabelecidos") === -1,
  "o dependente NÃO traz o verbo do titular",
  "documento trocado é o que a instituição de ensino percebe primeiro");
b.ok(dependente.indexOf("Incentivo ao Aprimoramento") === -1,
  "nem o fundamento do titular");
b.ok(dependente.indexOf("anuidade escolar") === -1,
  "nem 'anuidade escolar', que só está no papel do titular");
b.ok(dependente.indexOf("A presente certificação") === -1,
  "nem o fecho do titular");

/* ═══════════════════════════════════════════════════════════
   3. O RG e o vínculo são do TITULAR, mesmo no do dependente
   ═══════════════════════════════════════════════════════════

   Os dois modelos confirmam: quem tem vínculo de emprego com a
   instituição é o associado, e é esse vínculo que sustenta o benefício.
   Identificar a criança por documento não diria nada à faculdade.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
b.ok(dependente.indexOf("2.288.609/SPTC-ES") > -1,
  "o RG que aparece no do dependente é o do titular");
b.ok(/dependente de ATILA[^,]*, portador da carteira de identidade/.test(dependente),
  "e vem logo depois do nome do titular, não do nome da criança",
  "a ordem das orações é o que diz de quem é o documento");
b.ok(dependente.indexOf("empregado da instituição MULTIVIX") > -1,
  "o vínculo de emprego também é o do titular");

/* ═══════════════════════════════════════════════════════════
   4. O que é IGUAL nos dois, e tem que continuar igual
   ═══════════════════════════════════════════════════════════ */
b.passo("6");
[["titular", titular], ["dependente", dependente]].forEach(function (par) {
  const nome = par[0], t = par[1];
  b.ok(t.indexOf("CERTIFICADO DE HABILITAÇÃO À BOLSA DE ESTUDOS") > -1,
    "o " + nome + " tem o mesmo título");
  b.ok(t.indexOf("70% (setenta por cento)") > -1,
    "o percentual por extenso no " + nome);
  b.ok(t.indexOf("01.936.248/0001-21") > -1,
    "o CNPJ formatado no " + nome);
  b.ok(t.indexOf("CNPJ: sob") === -1,
    "sem os dois-pontos do original no " + nome,
    "decisão do usuário em 18/08/2026: erro de digitação do papel não se reproduz");
  b.ok(t.indexOf("Leonil Dias da Silva") > -1,
    "e quem assina o " + nome + " é o presidente");
});

/* ═══════════════════════════════════════════════════════════
   5. A data, no fim do texto, nos DOIS
   ═══════════════════════════════════════════════════════════

   "A data tem que sair no final do arquivo igual o modelo enviado."
   O papel do dependente não trazia data; por decisão dele, os dois passam
   a trazer — documento sem data é difícil de conferir depois.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
b.ok(titular.indexOf("Vitória/ES, 18 de agosto de 2026") > -1,
  "o titular traz local e data, em minúscula como no papel",
  (titular.match(/Vit[óo]ria\/ES,[^A-Z]*/) || ["(não achou)"])[0]);
b.ok(dependente.indexOf("Vitória/ES, 18 de agosto de 2026") > -1,
  "o do dependente também — decisão do usuário, o papel dele não tinha");

b.passo("8");
/* A data vem DEPOIS do texto e ANTES de quem assina. */
[["titular", titular], ["dependente", dependente]].forEach(function (par) {
  const nome = par[0], t = par[1];
  const iFecho = t.indexOf("destina-se");
  const iData = t.indexOf("Vitória/ES, 18");
  const iAssina = t.indexOf("Leonil Dias da Silva");
  b.ok(iFecho > -1 && iData > iFecho && iAssina > iData,
    "no " + nome + ", a data fica no fim do texto e acima da assinatura",
    "posições: fecho " + iFecho + " · data " + iData + " · assinatura " + iAssina);
});

b.naoTestavel("Como o documento fica no PDF montado pelo Drive",
  "quebra de linha, margem e posição da data no papel se conferem abrindo um certificado emitido");

b.resumo();
