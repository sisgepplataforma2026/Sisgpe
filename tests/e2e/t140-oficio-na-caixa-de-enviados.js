/**
 * t140 — O OFÍCIO PASSA A FICAR NA CAIXA DE ENVIADOS, E A TER ID
 *
 * O usuário relatou em 02/09/2026: "foram enviados mas não aparecem na caixa
 * de enviados". Estava certo, e o defeito era um só, com dois sintomas que
 * pareciam separados.
 *
 * `GmailApp.sendEmail()` não devolve nada. Daí:
 *
 *   1. o ofício não ficava registrado em Enviados — documento oficial saindo
 *      sem deixar cópia no e-mail de quem mandou;
 *   2. sem retorno não havia ID, e o registro gravava o texto fixo
 *      "GMAILAPP_SEM_ID".
 *
 * E A (2) É PARTE DA CAUSA DO ITEM 49. Sem ID não há thread para o verificador
 * de confirmação olhar; sobrou procurar pelo número do ofício e pelo nome da
 * escola em toda a caixa — a busca larga que fez a assinatura "Outlook"
 * confirmar ofício que tinha quicado.
 *
 * `createDraft(...).send()` devolve o GmailMessage, e daí sai o ID real.
 *
 * O QUE ESTE TESTE NÃO PROVA, e está dito no fim: que a mensagem realmente
 * apareça na caixa de Enviados do Gmail. O emulador não é o Gmail. Isso se
 * confere em homologação, olhando a caixa.
 */

const b = require("./base");
const { g, amb } = b.subir({});

b.fluxo("OFÍCIOS · o envio devolve o ID real da mensagem");

b.passo("1. o ofício não é mais mandado por sendEmail");
/* Se voltar para o sendEmail, os dois sintomas voltam juntos e em silêncio.
   A busca é feita no CÓDIGO, com os comentários removidos: a nota que explica
   a troca cita `GmailApp.sendEmail()` de propósito, e uma varredura ingênua
   casaria com a própria explicação — foi o que aconteceu na primeira versão
   deste passo. É o mesmo tropeço que o t126 e o t127 já registraram. */
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}
const RAIZ140 = require("path").resolve(__dirname, "..", "..");
const fonte = semComentarios(
  require("fs").readFileSync(require("path").join(RAIZ140, "EmailOficios.gs"), "utf8"));
b.ok(fonte.indexOf("GmailApp.sendEmail(") === -1,
  "GmailApp.sendEmail saiu do CÓDIGO do ofício");
b.ok(fonte.indexOf("GmailApp.createDraft(") > -1,
  "e entrou o createDraft, que devolve a mensagem");

b.passo("2. e devolve um ID de verdade, não o texto fixo de antes");
amb.reset();
const r = g.enviarEmailOficio_(
  "secretaria@sindeducacao.com", "<p>corpo</p>", [],
  "Ofício de Teste nº 999/2026", "escola@exemplo.com.br", "Segue ofício.");
b.ok(r && typeof r.mensagemId === "string", "o retorno traz mensagemId");
b.ok(r.mensagemId.length > 0, "e ele não vem vazio", r.mensagemId);
b.ok(r.mensagemId !== "GMAILAPP_SEM_ID",
  "e NÃO é o texto fixo que ficava gravado antes");

b.passo("3. o e-mail continua saindo — a troca não pode custar o envio");
b.igual(amb.outbox.length, 1, "um e-mail no outbox");
b.ok(String(amb.outbox[0].to).indexOf("escola@exemplo.com.br") > -1,
  "para a escola certa");
b.ok(String(amb.outbox[0].replyTo || "").indexOf("secretaria@sindeducacao.com") > -1,
  "e com o replyTo da Secretaria, como antes");

b.fluxo("OFÍCIOS · o registro guarda o ID, e não mais um texto fixo");

b.passo("4. a fila grava o ID que o envio devolveu");
b.seedUsuarios(g);
const fonteFila = require("fs").readFileSync(
  require("path").join(RAIZ140, "FilaOficios.gs"), "utf8");
/* Procura a ATRIBUIÇÃO, não a menção: as duas notas que expliquem a troca
   citam o nome antigo de propósito. */
b.ok(!/colMensagemId - 1\] = "GMAILAPP_SEM_ID"/.test(fonteFila),
  "nenhum dos dois pontos grava mais o texto fixo");
b.igual((fonteFila.match(/colMensagemId - 1\] = \(envio && envio\.mensagemId\)/g) || []).length, 2,
  "e os dois passaram a gravar o ID devolvido pelo envio");

b.fluxo("OFÍCIOS · o rascunho não pode ficar órfão");

b.passo("5. SE O ENVIO FALHAR, o rascunho é apagado");
/* É o risco que a troca introduz. Rascunho criado e não enviado fica na caixa
   de quem manda parecendo ofício pendente — e ninguém saberia de onde veio. */
const createOriginal = g.GmailApp.createDraft;
let apagou = false, tentouEnviar = false;
g.GmailApp.createDraft = function () {
  return {
    send: function () { tentouEnviar = true; throw new Error("cota estourada"); },
    deleteDraft: function () { apagou = true; },
    getId: function () { return "DRAFT_FALSO"; }
  };
};
let subiu = null;
try {
  g.enviarEmailOficio_("x@y.com", "<p>a</p>", [], "Assunto", "escola@z.com", "corpo");
} catch (e) { subiu = String(e.message || e); }
g.GmailApp.createDraft = createOriginal;

b.ok(tentouEnviar, "tentou enviar");
b.ok(apagou, "e APAGOU o rascunho quando o envio falhou");
b.ok(subiu && /cota estourada/.test(subiu),
  "a exceção original sobe intacta — a limpeza não engole o erro", subiu);

b.passo("6. e se a própria limpeza falhar, o erro de ENVIO é o que sobe");
/* A ordem importa: quem chama precisa saber por que o ofício não saiu, não por
   que a faxina não funcionou. */
g.GmailApp.createDraft = function () {
  return {
    send: function () { throw new Error("erro REAL do envio"); },
    deleteDraft: function () { throw new Error("erro da limpeza"); },
    getId: function () { return "D"; }
  };
};
let subiu2 = null;
try {
  g.enviarEmailOficio_("x@y.com", "<p>a</p>", [], "Assunto", "escola@z.com", "corpo");
} catch (e) { subiu2 = String(e.message || e); }
g.GmailApp.createDraft = createOriginal;
b.ok(/erro REAL do envio/.test(subiu2 || ""),
  "sobe o erro do envio, não o da limpeza", subiu2);

b.passo("7. rascunho apagado NÃO conta como e-mail enviado");
amb.reset();
const rascunho = g.GmailApp.createDraft("a@b.com", "s", "c", {});
rascunho.deleteDraft();
b.igual(amb.outbox.length, 0, "nada no outbox se o rascunho não foi enviado");
let recusou = false;
try { rascunho.send(); } catch (e) { recusou = true; }
b.ok(recusou, "e enviar um rascunho apagado não é permitido");

b.naoTestavel(
  "se a mensagem aparece MESMO na caixa de Enviados",
  "o emulador não é o Gmail — ele prova que o código pede o caminho certo e " +
  "guarda o ID devolvido. A conferência é emitir um ofício em homologação e " +
  "abrir a caixa de Enviados da conta que executa o script"
);
b.naoTestavel(
  "o mesmo defeito na fila do Parque do China",
  "Reservaparquechina.gs:1656 também grava MENSAGEM_ID = GMAILAPP_SEM_ID. É " +
  "outro módulo e não foi tocado aqui: mexer nele junto misturaria dois " +
  "assuntos no mesmo commit, e o Parque não está em operação"
);

b.resumo();
