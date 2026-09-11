/**
 * TESTE — ANEXAR UM DOCUMENTO NA HORA DO REENVIO, E ELE FICAR
 *
 * DE ONDE VEIO, 11/09/2026. O usuário abriu o reenvio do ofício 388/2026
 * (Oposição à Taxa Negocial, Centro Educacional Linus Pauling) e a tela
 * mostrou o aviso vermelho: *"A ficha não foi encontrada. O corpo deste ofício
 * afirma que ela segue em anexo."*
 *
 * O sistema detectava certo e avisava certo — e não oferecia jeito nenhum de
 * resolver. Não havia `input type=file` no modal, e o `reenviarOficio` não
 * tinha parâmetro por onde receber arquivo. A pessoa só podia mandar assim
 * mesmo ou cancelar e ir caçar o documento por fora.
 *
 * O PEDIDO, textual: *"Para todos, a possibilidade de anexar quando precisar
 * reenviar e assim não precisaria fazer novamente"* — e, em seguida, *"todos
 * até mesmo o enviado"*. Duas exigências, e as duas são testadas aqui:
 *
 *   1. QUALQUER ofício, em QUALQUER status — não só os que exigem ficha, não
 *      só os que falharam;
 *   2. PERMANENTE — guardado uma vez, o reenvio seguinte acha sozinho.
 *
 * A DECISÃO DE ONDE GUARDAR, e por que ela é o coração deste teste. O
 * `ANEXOS_JSON` da fila é o registro do que DE FATO SAIU na emissão. Escrever
 * ali um arquivo anexado três semanas depois faria a planilha mentir sobre o
 * passado: quem auditasse o 388 leria a carta como se ela tivesse ido junto em
 * 27/08. Não foi. Por isso o acrescentado mora em coluna separada do Controle,
 * com quem e quando — e há asserção explícita de que o ANEXOS_JSON continua
 * intocado.
 *
 * O QUE ESTE TESTE NÃO COBRE: o Drive de verdade. O emulador guarda o arquivo
 * e devolve por id, mas não valida conteúdo nem permissão de pasta. A prova de
 * que a escola recebeu o anexo certo continua sendo manual.
 */
const b = require("./base");
const { g, amb } = b.subir({ gmailAliases: ["secretaria@sindeducacao.com",
                                            "financeiro@sindeducacao.com"] });
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const token = b.logar(g, "wanderson");

g.obterPastaPorTipo_ = function () { return g.DriveApp.getFolderById("PASTA-OFICIOS"); };

const URL_PDF = "https://drive.google.com/file/d/PDF_DO_OFICIO_388/view";
const b64 = (txt) => g.Utilities.base64Encode(txt);

/* ── O Controle, com o 388 já ENVIADO: o caso "até mesmo o enviado" ────── */
const CAB_REG = ["Número do Ofício","Escola","Tipo","Status","E-mails (todos)",
                 "Data envio ofício","Observações","Link Ficha","Link PDF (Drive)"];
const reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.clearContents();
reg.getRange(1, 1, 1, CAB_REG.length).setValues([CAB_REG]);
reg.getRange(2, 1, 1, CAB_REG.length).setValues([[
  "388/2026", "CENTRO EDUCACIONAL LINUS PAULING", "Oposição à Taxa Negocial",
  "ENVIADO", "dp@linuspauling.com.br", new Date(2026, 7, 27, 9, 0), "", "", URL_PDF
]]);

/* ── A fila, com o pacote original: SÓ o PDF do ofício, sem a carta ────── */
const CAB_FILA = ["NUMERO_OFICIO","ANEXOS_JSON","STATUS","TENTATIVAS","ULTIMO_ERRO"];
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") || ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.clearContents();
fila.getRange(1, 1, 1, CAB_FILA.length).setValues([CAB_FILA]);
const ANEXOS_JSON_ORIGINAL = JSON.stringify([
  { fileId: "PDF_DO_OFICIO_388", nome: "Ofício 388 2026 - LINUS PAULING.pdf" }
]);
fila.getRange(2, 1, 1, CAB_FILA.length).setValues([[
  "388/2026", ANEXOS_JSON_ORIGINAL, "ENVIADO", 1, ""
]]);

const prever = (nomesExtras) => g.preverReenvioOficio({
  numero: "388/2026", url: URL_PDF, tipo: "Oposição à Taxa Negocial",
  escola: "CENTRO EDUCACIONAL LINUS PAULING",
  nomesExtras: nomesExtras || []
}, token);

const reenviar = (anexosNovos) => g.reenviarOficio({
  numero: "388/2026", url: URL_PDF, tipo: "Oposição à Taxa Negocial",
  escola: "CENTRO EDUCACIONAL LINUS PAULING",
  destinatarios: ["dp@linuspauling.com.br"],
  anexosNovos: anexosNovos || []
}, token);

const colunaExtras = () => {
  const hm = g.getHeaderMap_(reg);
  const c = hm[g.OFICIO_COL_ANEXOS_EXTRAS];
  return c ? String(reg.getRange(2, c).getValue() || "") : "";
};
const nomesDosItens = (r) => (r.anexos.itens || []).map(i => i.nome);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Antes de anexar: o aviso que o usuário viu na tela");

passo("prévia do 388/2026, como o modal a pede");
const antes = prever();

ok(antes.ok === true, "a prévia responde para um ofício já ENVIADO",
   "status do 388 é ENVIADO");
ok(antes.anexos.exigeFicha === true,
   "Oposição à Taxa Negocial é tipo que afirma ficha no corpo");
ok(antes.anexos.temFicha === false,
   "a ficha NÃO está no pacote — é o aviso vermelho do print");
igual((antes.anexos.itens || []).length, 1,
   "um único anexo — só o PDF do ofício, como o print mostrava");
ok((antes.anexos.itens || []).every(i => !/^fichas?_/i.test(i.nome)),
   "e nenhum dos anexos é ficha",
   nomesDosItens(antes).join(" | "));

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A pessoa escolhe a carta, e a prévia recalcula antes de enviar");

passo("prévia com o nome do arquivo que está na mão dela");
const comEscolha = prever(["Fichas_Linus_Pauling_27-08-2026.pdf"]);

ok(comEscolha.anexos.temFicha === true,
   "o aviso vermelho some assim que ela escolhe a carta");
ok(nomesDosItens(comEscolha).indexOf("Fichas_Linus_Pauling_27-08-2026.pdf") > -1,
   "o arquivo escolhido aparece na lista antes do envio");
ok((comEscolha.anexos.itens || []).some(i => String(i.origem).indexOf("escolhida agora") === 0),
   "e aparece marcado como ainda não enviado, não como se já estivesse no ofício");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Reenvio com a carta anexada");

passo("reenviar levando o arquivo");
amb.outbox.length = 0;
const env = reenviar([{
  nome: "Fichas_Linus_Pauling_27-08-2026.pdf",
  tipo: "application/pdf",
  base64: b64("carta de oposicao dos trabalhadores")
}]);

ok(env.erro === false, "o reenvio saiu", String(env.mensagem || "").slice(0, 90));
igual(amb.outbox.length, 1, "um e-mail foi enviado");
ok(String(env.mensagem || "").indexOf("Anexos: 2") > -1,
   "a mensagem diz que foram DOIS anexos — o ofício e a carta",
   String(env.mensagem || "").slice(0, 80));

/* TODOS OS ANEXOS VÃO NO E-MAIL — 11/09/2026, pedido do usuário: "e no email
   deve ser enviado todos os arquivos anexados".

   A contagem da mensagem de retorno é o que o sistema DIZ. Isto aqui é o que
   ele FEZ: os anexos que realmente foram parar na mensagem. Se um dia as duas
   divergirem, é esta asserção que tem de reprovar — a mensagem pode mentir, a
   caixa de saída não. */
const anexosDoEmail = (amb.outbox[0] && amb.outbox[0].attachments) || [];
igual(anexosDoEmail.length, 2,
   "o e-mail saiu com os DOIS arquivos, não só com o ofício");
ok(anexosDoEmail.some(bl => /^fichas?_/i.test(String(bl.getName && bl.getName() || ""))),
   "e a carta está entre eles",
   anexosDoEmail.map(bl => String(bl.getName && bl.getName() || "?")).join(" | "));

passo("o que ficou guardado");
const guardado = colunaExtras();
ok(guardado.indexOf("Fichas_Linus_Pauling_27-08-2026.pdf") > -1,
   "a carta ficou registrada na coluna própria do Controle");
ok(guardado.indexOf("wanderson") > -1,
   "com QUEM anexou — o recurso manda documento com dado pessoal, e isso tem de ter rastro");
ok(/"quando":"20\d\d-\d\d-\d\d/.test(guardado),
   "e QUANDO", guardado.slice(0, 110));

passo("a verdade do envio original continua de pé");
igual(String(fila.getRange(2, 2).getValue() || ""), ANEXOS_JSON_ORIGINAL,
   "o ANEXOS_JSON da fila NÃO foi tocado — ele registra o que saiu em 27/08");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Não precisar fazer de novo");

passo("um novo reenvio, SEM anexar nada");
const depois = prever();

ok(depois.anexos.temFicha === true,
   "a carta é encontrada sozinha — é o \"não precisaria fazer novamente\"");
ok((depois.anexos.itens || []).some(i => String(i.origem).indexOf("acrescentada") === 0),
   "e a origem diz que foi acrescentada, não que veio do pacote original",
   (depois.anexos.itens || []).map(i => i.origem).join(" | "));

passo("e não duplica");
amb.outbox.length = 0;
const env2 = reenviar([]);
ok(String(env2.mensagem || "").indexOf("Anexos: 2") > -1,
   "continuam dois anexos, não três",
   String(env2.mensagem || "").slice(0, 80));
igual(((amb.outbox[0] && amb.outbox[0].attachments) || []).length, 2,
   "e o e-mail seguinte também leva os dois, sem ninguém anexar de novo");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que o sistema recusa, e como avisa");

passo("arquivo de tipo não aceito");
const antesDoLixo = colunaExtras();
const envLixo = reenviar([{ nome: "virus.exe", tipo: "application/octet-stream", base64: b64("x") }]);

ok(envLixo.erro === true, "recusa o envio quando NENHUM anexo pôde ser guardado");
ok(String(envLixo.mensagem || "").indexOf("não aceito") > -1,
   "e diz o motivo em palavras", String(envLixo.mensagem || "").slice(0, 90));
igual(colunaExtras(), antesDoLixo,
   "nada foi gravado no Controle");

passo("arquivo acima do teto por arquivo");
const gigante = "A".repeat(g.OFICIO_ANEXO_EXTRA_MAX_MB * 1024 * 1024 * 2);
const envGrande = reenviar([{ nome: "enorme.pdf", tipo: "application/pdf", base64: gigante }]);
ok(String(envGrande.mensagem || "").indexOf("MB") > -1,
   "recusa dizendo o tamanho, em vez de deixar o Gmail devolver erro genérico",
   String(envGrande.mensagem || "").slice(0, 90));

passo("um aceito junto de um recusado");
amb.outbox.length = 0;
const envMisto = reenviar([
  { nome: "Relacao_nominal.xlsx", tipo: "application/vnd.ms-excel", base64: b64("planilha") },
  { nome: "foto.bmp",            tipo: "image/bmp",                base64: b64("imagem") }
]);
ok(envMisto.erro === false, "o ofício sai com o que deu para guardar");
ok(String(envMisto.mensagem || "").indexOf("não incluído") > -1,
   "e a mensagem de sucesso avisa qual arquivo ficou de fora",
   String(envMisto.mensagem || "").slice(-90));
ok(colunaExtras().indexOf("Relacao_nominal.xlsx") > -1,
   "planilha é aceita — o Financeiro manda relação nominal, não só PDF");
ok(colunaExtras().indexOf("foto.bmp") === -1,
   "e o formato fora da lista não entrou");
const anexosMisto = ((amb.outbox[0] && amb.outbox[0].attachments) || [])
  .map(bl => String(bl.getName && bl.getName() || ""));
igual(anexosMisto.length, 3,
   "o e-mail leva ofício + carta + planilha — todo arquivo aceito vai junto",
   anexosMisto.join(" | "));

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O arquivo chegar íntegro na escola",
  "o emulador guarda o blob e devolve por id, mas não valida conteúdo, " +
  "permissão de pasta do Drive nem entrega de e-mail. Abrir o anexo recebido " +
  "continua sendo verificação manual.");

resumo();
