/**
 * TESTE — O LIMITE DO GMAIL NÃO PODE CONDENAR O OFÍCIO
 *
 * O QUE ORIGINOU, 10/09/2026. O usuário, depois de eu explicar que o ofício
 * 407 não saiu porque a cota do Gmail tinha estourado:
 *
 *   "Se a cota estourou ele deve aparecer quando for iniciada"
 *
 * É requisito, e estava certo. O sistema NÃO fazia isso — e o motivo é que a
 * intenção existia no lugar errado. A trava de cota do processarFilaEnvioOficios
 * lê `MailApp.getRemainingDailyQuota()`, que conta DESTINATÁRIOS; o que estoura
 * é o limite de CHAMADAS ao serviço Gmail. São contadores diferentes. Em 09/09
 * o medidor dizia "96 restantes" às 11h53 e o envio morreu às 11h56 (item 77).
 *
 * A CADEIA QUE ISSO ABRIA, e que este teste existe para impedir:
 *
 *   1. a trava deixa passar, porque mede o contador que não estourou;
 *   2. o send() levanta "Service invoked too many times for one day: gmail";
 *   3. classificarErroEnvio_ não conhecia a frase -> "ERRO" -> soma tentativa;
 *   4. o gatilho roda de 5 em 5 min e MAX_TENTATIVAS é 3;
 *   5. em QUINZE MINUTOS o ofício vira ERRO_PERMANENTE;
 *   6. no dia seguinte, cota renovada, ele não é reenviado. Ficou para trás.
 *
 * Um apagão de quinze minutos condenava o ofício para sempre, e a linha ficava
 * dizendo "Máximo de 3 tentativas atingido" — que descreve o sintoma e esconde
 * a causa. Quem lesse iria procurar e-mail inválido.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: o limite de verdade. O emulador levanta a
 * exceção que o teste mandar. O que se prova aqui é a REGRA — o que acontece
 * com a linha, com a tentativa e com a rodada quando essa exceção chega.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* A fila com as colunas que o processador exige. Duas linhas PENDENTE: a
   segunda existe para provar que a rodada PARA na primeira — sem isso, um
   apagão de cota gastaria a tentativa de todo mundo na mesma execução. */
const CAB = ["ID", "NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ",
             "EMAIL_PRINCIPAL", "EMAILS_TODOS", "ASSUNTO", "HTML_BODY",
             "ANEXOS_JSON", "STATUS", "TENTATIVAS", "ULTIMO_ERRO",
             "DATA_ULTIMA_TENTATIVA", "CODIGO_VERIFICACAO", "DATA_ENVIO",
             "MENSAGEM_ID", "STATUS_RECEBIMENTO"];

const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") ||
             ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const linha = (id, num) =>
  [id, num, "Filiação", "EMEF Teste", "00.000.000/0001-00",
   "escola@teste.com", "escola@teste.com", "Ofício " + num, "<p>corpo</p>",
   "[]", "PENDENTE", 0, "", "", "", "", "", ""];

fila.getRange(2, 1, 2, CAB.length).setValues([
  linha("1_a", "601/2026"),
  linha("2_b", "602/2026")
]);

/* A ARMADILHA REPRODUZIDA: a cota de DESTINATÁRIOS está folgada — é ela que a
   trava lê — e o serviço recusa mesmo assim. Foi exatamente o 09/09. */
g.__cotaEmailRestante = 1500;
const draftBom = g.GmailApp.createDraft;
g.GmailApp.createDraft = function () {
  throw new Error("Service invoked too many times for one day: gmail");
};

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · cota estourada não condena o ofício");

passo("a trava de cota não pega este caso — e é por isso que a regra existe");

ok(g.MailApp.getRemainingDailyQuota() >= 5,
   "o medidor de destinatários diz que há cota de sobra: " +
     g.MailApp.getRemainingDailyQuota(),
   "ele conta destinatários; quem estoura é o limite de chamadas ao serviço");

passo("o limite tem veredito próprio");

igual(g.classificarErroEnvio_("Service invoked too many times for one day: gmail"),
      "COTA",
      "a frase do Google é reconhecida como COTA",
      "antes caía em ERRO genérico, indistinguível de e-mail inválido");
igual(g.classificarErroEnvio_("Invalid email: xxx"), "ERRO_PERMANENTE",
      "e-mail inválido continua permanente");
igual(g.classificarErroEnvio_("Timeout"), "ERRO",
      "erro temporário continua ERRO, que gasta tentativa e tenta de novo");

/* A regra de reconhecer o limite é a MESMA que a conferência da caixa de
   Enviados usa. Duas listas de trechos divergiriam no primeiro ajuste, e um
   dos lados trataria o apagão como notícia sobre um ofício. */
ok(typeof g.oficio_ehLimiteDoGmail_ === "function",
   "e o reconhecedor é um só, compartilhado com a conferência",
   "cópia paralela garantiria que um lado reconhecesse e o outro não");

passo("A LINHA FICA INTACTA — nem status, nem tentativa, nem último erro");

const r = g.processarFilaEnvioOficios();

const l1 = fila.getRange(2, 1, 1, CAB.length).getValues()[0];
igual(String(l1[CAB.indexOf("STATUS")]).trim(), "PENDENTE",
      "o 601 continua PENDENTE — não virou ERRO",
      "ERRO é afirmação sobre o ofício; a cota não afirma nada sobre ele");
igual(Number(l1[CAB.indexOf("TENTATIVAS")]) || 0, 0,
      "e nenhuma tentativa foi gasta",
      "três apagões de 5 min queimariam as 3 e o ofício nunca mais sairia");
igual(String(l1[CAB.indexOf("ULTIMO_ERRO")] || "").trim(), "",
      "  e ULTIMO_ERRO fica vazio");

passo("a rodada PARA — não gasta a fila inteira no mesmo apagão");

const l2 = fila.getRange(3, 1, 1, CAB.length).getValues()[0];
igual(String(l2[CAB.indexOf("STATUS")]).trim(), "PENDENTE",
      "o 602 sequer foi tentado");
igual(Number(l2[CAB.indexOf("TENTATIVAS")]) || 0, 0, "  e também está com 0");
igual(r.cotaAcabou, true, "e o retorno diz que foi a cota");
igual(r.erros, 0, "  sem contar isso como erro de ofício");

passo("a mensagem diz o que a pessoa precisa saber");

ok(/limite diário/i.test(r.mensagem), "diz que foi o limite do Google");
ok(/intacto/i.test(r.mensagem), "  que o ofício está intacto");
ok(/amanh/i.test(r.mensagem), "  e quando voltar",
   "sem isso a reação natural é tentar de novo agora, o que só gasta mais");
ok(!/Service invoked/i.test(r.mensagem),
   "  e não devolve a frase em inglês do Google",
   "quem lê a tela é a secretaria, não um programador");

passo("O QUE O USUÁRIO PEDIU: quando a cota volta, o ofício sai");

/* "Se a cota estourou ele deve aparecer quando for iniciada." É a asserção
   que fecha o requisito — e só passa porque nada foi gravado acima. */
g.GmailApp.createDraft = draftBom;
const r2 = g.processarFilaEnvioOficios();

const d1 = fila.getRange(2, 1, 1, CAB.length).getValues()[0];
igual(String(d1[CAB.indexOf("STATUS")]).trim(), "ENVIADO",
      "com a cota de volta, o 601 sai sozinho na execução seguinte",
      "é o requisito dele: a fila retoma sem ninguém refazer nada");
ok(String(d1[CAB.indexOf("MENSAGEM_ID")] || "").trim() !== "",
   "  e sai com id de mensagem — a prova de que o Gmail aceitou");
ok(r2.enviados >= 1, "a execução seguinte reporta envio: " + r2.enviados);

passo("o envio manual segue a mesma regra");

/* Aqui tem gente olhando a tela, e a diferença importa: um "Erro ao enviar"
   genérico manda a pessoa clicar de novo, gastando o que ainda resta. */
fila.getRange(4, 1, 1, CAB.length).setValues([linha("3_c", "603/2026")]);
g.GmailApp.createDraft = function () {
  throw new Error("Service invoked too many times for one day: gmail");
};

const manual = g.enviarOficioDaFilaAgora("603/2026", TOKEN, "3_c");
igual(manual.ok, false, "o envio imediato recusa");
igual(manual.cotaAcabou, true, "  dizendo que foi a cota");

const l3 = fila.getRange(4, 1, 1, CAB.length).getValues()[0];
igual(String(l3[CAB.indexOf("STATUS")]).trim(), "PENDENTE",
      "e a linha do 603 também fica intacta");
igual(Number(l3[CAB.indexOf("TENTATIVAS")]) || 0, 0, "  com 0 tentativas");
ok(/NÃO foi enviado/.test(manual.mensagem),
   "a mensagem começa dizendo que NÃO saiu",
   "o pior desfecho é a pessoa achar que saiu e não conferir");
ok(/intacto/i.test(manual.mensagem) && /amanh/i.test(manual.mensagem),
   "  e diz que está intacto e quando tentar de novo");

g.GmailApp.createDraft = draftBom;

/* ══════════════════════════════════════════════════════════════════════════ */
naoTestavel("o limite de verdade do Gmail",
  "o emulador levanta a exceção que este teste manda. Se o Google mudar a " +
  "frase da mensagem, o reconhecedor deixa de casar e a cadeia antiga volta " +
  "— por isso oficio_ehLimiteDoGmail_ casa por vários trechos, e não pela " +
  "frase inteira. Quem responde de fato é o próximo dia de cota estourada.");

naoTestavel("se a fila retoma sozinha em produção",
  "aqui a segunda execução é chamada pelo teste. Em produção quem chama é o " +
  "gatilho de 5 em 5 minutos, e o que prova que ele está instalado é a tela " +
  "de Acionadores — não o código.");

resumo();
