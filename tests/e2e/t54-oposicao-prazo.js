/**
 * TESTE — PRAZO DE OPOSIÇÃO E COMPETÊNCIA INICIAL DA TAXA NEGOCIAL
 *
 * A FONTE
 *
 * O usuário mandou, em 18/08/2026, a foto do COMUNICADO SOBRE A CONTRIBUIÇÃO
 * ASSISTENCIAL LABORAL (TAXA NEGOCIAL) — CCT 2026/2027, publicado por ele em
 * jornal (A Tribuna), assinado por Leonil Dias da Silva, Presidente do
 * SindEducação-ES, datado de Vitória-ES, 17 de julho de 2026.
 *
 * Os números que este teste protege saem DE LÁ, não de memória:
 *
 *   • 6% do salário-base, em 3 parcelas mensais e sucessivas de 2% cada
 *   • iniciando-se na COMPETÊNCIA SETEMBRO DE 2026
 *   • filiados ao SindEducação-ES são ISENTOS
 *   • repasse até o 10º dia útil do mês subsequente ao desconto
 *   • PRAZO DE OPOSIÇÃO: entre os dias 17 e 26 de AGOSTO de 2026
 *   • oposição por carta de próprio punho, entregue pessoalmente, em duas
 *     vias de igual teor, na sede do sindicato
 *
 * O QUE ORIGINOU
 *
 * Duas coisas que eu havia levantado e o usuário resolveu com a foto:
 *
 *  1. O ofício de oposição dizia "dentro do prazo legal" sem dizer QUAL. É
 *     uma afirmação de tempestividade que a escola não tem como conferir —
 *     e que o sindicato assina. Agora o texto cita o período publicado.
 *
 *  2. "A questão do singular deve se observar o quantitativo de pessoas."
 *     O ofício já fazia singular/plural certo (eu tinha dito que não, por
 *     ter renderizado só com uma pessoa). O e-mail também. Este teste passa
 *     a TRAVAR os dois, para não regredir.
 *
 * E um defeito achado no caminho: CCTCore.gs, que alimenta a base de
 * conhecimento da Sofia, dizia "iniciando em setembro/2025" na Cláusula 57.
 * O comunicado publicado diz setembro DE 2026. Um ano errado na fonte que a
 * IA consulta vira resposta errada para quem pergunta.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: o PDF
 * gerado e a entrega do e-mail.
 */
const b = require("./base");
const g = b.subir({}).g;

const limpo = h => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function oficio(tipo, nomes) {
  const proc = g.montarDadosOficio_({
    tipo: tipo, escola: "COLEGIO EXEMPLO LTDA", para: "DIRETORIA",
    cnpj: "36136001000105", colaboradores: nomes
  }, "preview");
  return limpo(proc.corpoTexto);
}
function email(tipo, qtd) {
  return limpo(g.montarEmailHTML(tipo, "280/2026", tipo, qtd, ""));
}

const UM   = [{ nome: "CLARA GOMES" }];
const TRES = [{ nome: "CLARA GOMES" }, { nome: "ANA LIMA" }, { nome: "JOAO REIS" }];

/* ═══════════════════════════════════════════════════════════
   1. O prazo de oposição publicado aparece no documento
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OPOSIÇÃO · O prazo publicado, no lugar de 'prazo legal'");

b.passo("1");
const opOficio = oficio("OPOSICAO_TAXA_NEGOCIAL", UM);
b.ok(/17 (a|e) 26 de agosto de 2026/.test(opOficio),
  "o ofício cita o período de oposição publicado (17 a 26/08/2026)",
  "antes dizia só 'dentro do prazo legal', sem dizer qual");

b.passo("2");
const opEmail = email("Oposição à Taxa Negocial", 1);
b.ok(/17 (a|e) 26 de agosto de 2026/.test(opEmail),
  "o e-mail cita o mesmo período");

/* Contraprova: o período não pode aparecer onde não é assunto. Um ofício de
   filiação citando prazo de oposição confunde a escola. */
b.passo("3");
b.ok(!/17 a 26 de agosto/.test(oficio("FILIACAO", UM)),
  "o ofício de Filiação NÃO cita o prazo de oposição");
b.ok(!/17 a 26 de agosto/.test(oficio("DESFILIACAO", UM)),
  "o ofício de Desfiliação NÃO cita o prazo de oposição");

/* ═══════════════════════════════════════════════════════════
   2. Competência inicial da Taxa Negocial: setembro de 2026
   ═══════════════════════════════════════════════════════════ */
b.fluxo("TAXA NEGOCIAL · Quando os descontos começam");

b.passo("4");
const tnOficio = oficio("TAXA_NEGOCIAL", TRES);
b.ok(/compet(ê|e)ncia de setembro de 2026|setembro de 2026/.test(tnOficio),
  "o ofício de Taxa Negocial diz que os descontos começam em setembro/2026",
  "o comunicado publicado é explícito: 'iniciando-se na competência setembro de 2026'");

b.passo("5");
b.ok(/setembro de 2026|setembro\/2026/.test(email("Taxa Negocial", 3)),
  "o e-mail de Taxa Negocial também diz a competência inicial");

/* A base de conhecimento que a Sofia consulta tinha o ano errado. */
b.passo("6");
/* getCCTTexto_ é o nome real (CCTCore.gs:9). Eu tinha chutado
   "obterTextoCCT_", e o `||` mascarou o erro devolvendo string vazia — duas
   asserções falharam por causa do teste, não do sistema. */
const cct = String(g.getCCTTexto_());
b.ok(cct.length > 500, "a base de conhecimento da CCT foi lida de verdade",
  cct.length + " caracteres");
b.ok(cct.indexOf("setembro/2025") === -1,
  "CCTCore não diz mais 'setembro/2025' na Cláusula 57",
  "a IA responderia o ano errado a quem perguntasse quando começa o desconto");
b.ok(/setembro\/2026/.test(cct),
  "CCTCore diz setembro/2026");
b.ok(/17 a 26 de agosto de 2026/.test(cct),
  "CCTCore registra o prazo de oposição publicado");

/* ═══════════════════════════════════════════════════════════
   3. Singular e plural seguem o número de pessoas
   ═══════════════════════════════════════════════════════════

   "A questão do singular deve se observar o quantitativo de pessoas."
   O ofício já acertava; o teste passa a travar para não regredir.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OPOSIÇÃO · Concordância com o número de trabalhadores");

b.passo("7");
const um = oficio("OPOSICAO_TAXA_NEGOCIAL", UM);
b.ok(/colaborador\(a\) acima identificado\(a\) exerceu/.test(um),
  "com 1 pessoa o ofício usa o singular");
b.ok(/conforme carta em anexo/.test(um),
  "e fala em 'carta', no singular");
b.ok(/N(Ã|A)O seja efetuado o desconto referente/.test(um),
  "e o pedido vai no singular");

b.passo("8");
const tres = oficio("OPOSICAO_TAXA_NEGOCIAL", TRES);
b.ok(/colaboradores\(as\) acima identificados\(as\) exerceram/.test(tres),
  "com 3 pessoas o ofício usa o plural");
b.ok(/conforme cartas em anexo/.test(tres),
  "e fala em 'cartas', no plural");
b.ok(/N(Ã|A)O sejam efetuados os descontos referentes/.test(tres),
  "e o pedido vai no plural");

b.passo("9");
b.ok(um !== tres, "os dois textos são realmente diferentes",
  "sem isto, um texto neutro para os dois passaria nas asserções acima");

b.passo("10");
b.ok(/trabalhador\(a\) relacionado\(a\) manifestou/.test(email("Oposição à Taxa Negocial", 1)),
  "o e-mail com 1 pessoa vai no singular");
b.ok(/trabalhadores\(as\) relacionados\(as\) manifestaram/.test(email("Oposição à Taxa Negocial", 3)),
  "o e-mail com 3 pessoas vai no plural");

/* Desfiliação usa o mesmo mecanismo — se alguém quebrar o helper de plural,
   o estrago não fica só na oposição. */
b.passo("11");
b.ok(/colaborador\(a\) acima identificado\(a\) exerceu/.test(oficio("DESFILIACAO", UM)),
  "Desfiliação com 1 pessoa também vai no singular");
b.ok(/colaboradores\(as\) acima identificados\(as\) exerceram/.test(oficio("DESFILIACAO", TRES)),
  "Desfiliação com 3 pessoas também vai no plural");

/* ═══════════════════════════════════════════════════════════
   4. Sábado e domingo NÃO entram no prazo
   ═══════════════════════════════════════════════════════════

   Correção do usuário em 18/08/2026: "17 a 26 — não entra sábado e domingo".
   O comunicado publicado fecha a questão no horário de atendimento: "Segunda
   a sexta-feira, das 10h às 12h e das 14h às 16h". O intervalo tem 10 dias
   corridos e só 8 valem.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OPOSIÇÃO · O prazo conta em dias úteis");

b.passo("12");
const uteis = g.oposicao_diasUteisDoPrazo_();
b.igual(uteis.length, 8, "o prazo tem 8 dias úteis, não os 10 corridos");
b.igual(uteis.map(d => d.getDate()), [17, 18, 19, 20, 21, 24, 25, 26],
  "e são exatamente 17 a 21 e 24 a 26 de agosto");

/* Os dois dias que o usuário apontou. */
b.passo("13");
[[22, "sábado"], [23, "domingo"]].forEach(([dia, nome]) => {
  const r = g.oposicao_dentroDoPrazo_(new Date(2026, 7, dia));
  b.ok(r.dentro === false, dia + "/08 (" + nome + ") fica FORA do prazo");
  b.ok(/[Ss](á|a)bado e domingo/.test(r.motivo),
    "e o motivo diz por quê, para virar aviso na tela", r.motivo);
});

/* Contraprova: os dias úteis do meio do intervalo continuam dentro. Sem
   isto, uma função que recusasse tudo passaria nas asserções acima. */
b.passo("14");
[17, 21, 24, 26].forEach(dia => {
  b.ok(g.oposicao_dentroDoPrazo_(new Date(2026, 7, dia)).dentro === true,
    dia + "/08 é dia útil e está DENTRO do prazo");
});

b.passo("15");
const antes = g.oposicao_dentroDoPrazo_(new Date(2026, 7, 14));
b.ok(antes.dentro === false && /Antes/.test(antes.motivo),
  "14/08 (antes da abertura) fica fora, e o motivo diz isso", antes.motivo);
const depois = g.oposicao_dentroDoPrazo_(new Date(2026, 7, 27));
b.ok(depois.dentro === false && /Depois/.test(depois.motivo),
  "27/08 (depois do encerramento) fica fora, e o motivo diz isso", depois.motivo);

/* Data lixo não pode virar "dentro do prazo" por acidente. */
b.passo("16");
b.ok(g.oposicao_dentroDoPrazo_("banana").dentro === false,
  "texto que não é data não passa como dentro do prazo");

/* O aviso na tela ainda NÃO existe — estas funções são de leitura e nada as
   chama na emissão. Registrado como não testável para não virar "pronto". */
b.naoTestavel("Aviso na tela quando a oposição estiver fora do prazo",
  "as funções existem e estão cobertas, mas nada as chama ainda na emissão — falta o usuário decidir se quer o aviso");

b.resumo();
