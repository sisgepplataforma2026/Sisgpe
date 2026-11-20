/**
 * t138 — DE QUEM SAI O OFÍCIO, E QUEM NÃO PODE CONFIRMÁ-LO
 *
 * Nasceu de um ofício real. Em 02/09/2026 o usuário abriu o 487/2026, enviado
 * às 11:17, e o cabeçalho dizia:
 *
 *   De:             SindEducação-ES <financeirosindecucacao@gmail.com>
 *   Responder para: secretaria@sindeducacao.com
 *
 * Ou seja: o ofício institucional sai de um endereço @gmail.com. Não é
 * defeito de código — é o caminho de emergência do
 * `validarRemetenteInstitucionalOficios_`, que existe de propósito: sem o
 * alias cadastrado, forçar o `from` faz o Gmail RECUSAR o envio, e aí não sai
 * ofício nenhum. Sair pelo endereço errado é menos ruim do que não sair.
 *
 * O DEFEITO QUE ISSO REVELOU, e que é o motivo deste arquivo:
 *
 * O verificador de confirmações ignorava `financeiro@sindeducacao.com` e
 * `secretaria@sindeducacao.com` para que o sistema não confirmasse o próprio
 * ofício. Só que quem envia é `financeirosindecucacao@gmail.com` — nenhum dos
 * dois casa. A guarda existia e não guardava nada.
 *
 * NÃO DEU PROBLEMA POR SORTE: o corpo do ofício não tem palavra de
 * confirmação. Isso é medido aqui, não suposto — e é o passo 4. Bastaria um
 * "Agradecemos" no modelo para todo ofício se autoconfirmar ao ser enviado, e
 * o efeito seria o do item 49, multiplicado por todos.
 */

const fs = require("fs");
const path = require("path");
const b = require("./base");
const { g } = b.subir({});

/* A CONTA EXECUTORA NÃO FICA CRAVADA AQUI, e isso é o ponto. Na captura de
   tela o endereço parecia "financeirosindecucacao"; o emulador diz
   "financeirosindeducacao". `d` e `c` se confundem numa imagem, e uma letra
   errada faria a guarda falhar exatamente como falhava antes. O código passou
   a PERGUNTAR ao Gmail quem executa — então a grafia deixou de importar, e o
   teste pergunta pelo mesmo caminho. */
const CONTA = g.Session.getEffectiveUser().getEmail();
const REAL = "SindEducação-ES <" + CONTA + ">";

b.fluxo("MÓDULO 03 · a própria casa não confirma o próprio ofício");

b.passo("1. O REMETENTE REAL é reconhecido como da casa");
/* É a asserção que estava faltando. Se ela cair, o sistema volta a poder
   confirmar o ofício que ele mesmo acabou de enviar. */
b.ok(g.MON_OFICIOS_ehRemetenteProprio_(REAL) === true,
  "a conta que REALMENTE envia é ignorada pelo verificador", REAL);

b.passo("1b. e funciona para QUALQUER conta executora — não é lista cravada");
/* O defeito antigo era exatamente uma lista escrita à mão que envelheceu.
   Aqui o sistema sobe com outra conta e a guarda acompanha sozinha. */
const outra = b.subir({ donoDoProjeto: "outra.conta@exemplo.org" }).g;
b.ok(outra.MON_OFICIOS_ehRemetenteProprio_("Fulano <outra.conta@exemplo.org>") === true,
  "trocando a conta do projeto, a nova é reconhecida sem tocar em código");
b.ok(outra.MON_OFICIOS_ehRemetenteProprio_("thalia.ferreira@faesa.br") === false,
  "e a escola continua de fora");

b.passo("2. e os institucionais continuam valendo, como piso");
["financeiro@sindeducacao.com", "secretaria@sindeducacao.com",
 "Secretaria <SECRETARIA@sindeducacao.com>"].forEach(function (e) {
  b.ok(g.MON_OFICIOS_ehRemetenteProprio_(e) === true, "é da casa: " + e);
});

b.passo("3. mas a escola continua podendo confirmar");
/* O limite. Se esta cair, a correção virou defeito: ninguém mais confirma. */
["thalia.ferreira@faesa.br", "diretoria@escola.com.br",
 "contato@multivix.edu.br"].forEach(function (e) {
  b.ok(g.MON_OFICIOS_ehRemetenteProprio_(e) === false, "não é da casa: " + e);
});

b.passo("4. A SORTE MEDIDA — o corpo do ofício não confirma nada");
/* Todo texto literal do arquivo que monta o e-mail. Se um dia alguém puser
   "Agradecemos" ou "recebido" no modelo, este passo cai ANTES de ir para o
   ar — e é exatamente para isso que ele existe. */
const fonteEmail = fs.readFileSync(
  path.join(path.resolve(__dirname, "..", ".."), "EmailOficios.gs"), "utf8");
const literais = (fonteEmail.match(/"[^"]*"|'[^']*'/g) || []).join(" ");
b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(literais) === false,
  "nenhum texto do e-mail de ofício casa com palavra de confirmação");
b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(
  "Solicitamos, por gentileza, a confirmação do recebimento respondendo a este e-mail.") === false,
  "nem a frase que PEDE confirmação",
  "'confirmação' não contém 'confirmo' nem 'confirmamos'");
b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(
  "Ofício de Oposição à Taxa Negocial Nº 487/2026") === false,
  "nem o assunto do ofício real que originou este teste");

b.fluxo("MÓDULO 03 · a falta do alias precisa APARECER");

b.passo("5. sem alias, o envio continua — e não força o `from`");
/* O comportamento que não pode mudar: forçar o `from` sem alias faz o Gmail
   recusar TODOS os ofícios. Sair pelo endereço errado é menos ruim do que
   não sair. */
const semAlias = b.subir({ gmailAliases: [] }).g;
b.igual(semAlias.validarRemetenteInstitucionalOficios_(), "",
  "sem alias, devolve vazio — o Gmail usa a conta executora");

b.passo("6. E REGISTRA no log de sistema, não só no Logger");
/* Era um Logger.log, e ninguém lê Logger.log. Os ofícios saíram meses pelo
   endereço errado sem ninguém saber; foi preciso abrir um e-mail enviado
   para descobrir. */
const ss = semAlias.SpreadsheetApp.openById(semAlias.getPlanilhaId());
function linhasDeLog() {
  const aba = ss.getSheetByName(semAlias.ABA_LOG_SISTEMA || "LOG_SISTEMA");
  if (!aba || aba.getLastRow() < 2) return [];
  return aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
}
const registrou = linhasDeLog().some(function (l) {
  return l.join(" ").indexOf("OFICIOS_REMETENTE_SEM_ALIAS") > -1;
});
b.ok(registrou, "a falta do alias virou registro de auditoria",
  "tipo: OFICIOS_REMETENTE_SEM_ALIAS");

b.passo("7. e NÃO repete a cada ofício — a fila roda de 5 em 5 minutos");
/* Sem trava, a aba de log ganharia uma linha por ofício enviado. */
const antes = linhasDeLog().length;
for (let i = 0; i < 5; i++) semAlias.validarRemetenteInstitucionalOficios_();
b.igual(linhasDeLog().length, antes,
  "cinco envios seguidos não geram cinco registros");

b.passo("8. COM alias, o remetente passa a ser a Secretaria");
/* O estado que se quer alcançar. Quando o alias for cadastrado no Gmail,
   nada mais precisa mudar no código — é este passo que garante isso. */
const comAlias = b.subir({ gmailAliases: ["secretaria@sindeducacao.com"] }).g;
b.igual(comAlias.validarRemetenteInstitucionalOficios_(),
  "secretaria@sindeducacao.com",
  "com o alias cadastrado, o ofício sai pela Secretaria");

b.naoTestavel(
  "cadastrar o alias no Gmail",
  "é configuração da conta, não código: Gmail → Contas e importação → " +
  "Enviar e-mail como → secretaria@sindeducacao.com, confirmando o código " +
  "que chega nessa caixa. Enquanto não for feito, o passo 8 prova o código e " +
  "o ofício continua saindo pela conta executora"
);

b.resumo();
