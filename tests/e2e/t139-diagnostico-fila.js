/**
 * t139 — POR QUE OS OFÍCIOS DE ONTEM NÃO SAÍRAM
 *
 * O usuário relatou em 02/09/2026 que os ofícios do dia anterior não foram
 * enviados em produção. Eu não enxergo a produção, então o que dá para fazer é
 * o que já funcionou no item 49: um diagnóstico só-leitura que ele roda lá.
 *
 * ESTE TESTE PROVA O DIAGNÓSTICO, não o defeito. A diferença importa: se o
 * relatório mentir, ele leva a corrigir a coisa errada num sistema em operação.
 *
 * A CAUSA MAIS PROVÁVEL, e por que ela é invisível: a fila tem uma guarda de
 * cota (`FilaOficios.gs:249`) que, quando a cota diária não cobre o lote,
 * PAUSA sem marcar nada — as linhas ficam PENDENTE, nenhuma tentativa é gasta,
 * e o único rastro é um `Logger.log`. Foi desenhada assim de propósito, para
 * não queimar as três tentativas de cada ofício num problema que se resolve
 * sozinho em 24h. O efeito colateral é que, de fora, é idêntico a "o sistema
 * parou" — e ninguém é avisado.
 *
 * Numa conta gmail.com comum o teto do Apps Script é 100 DESTINATÁRIOS por
 * dia, não 100 e-mails. Cada ofício consome um por endereço em EMAILS_TODOS.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const b = require("./base");

const FIXTURES = path.join(__dirname, "..", "fixtures", "producao");
const { g } = b.subir({});
vm.runInContext(
  fs.readFileSync(path.join(FIXTURES, "DiagnosticoFilaOficios.gs.txt"), "utf8"),
  g, { filename: "DiagnosticoFilaOficios.gs" });

/* ── a fila, montada como a de produção ───────────────────────────────── */
const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
const fila = g.obterOuCriarAbaFilaOficios_();
const hm = g.getHeaderMap_(fila);
const col = n => hm[n];

function escrever(linhas) {
  if (fila.getLastRow() > 1) fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).clearContent();
  linhas.forEach(function (dados, i) {
    Object.keys(dados).forEach(function (k) {
      if (col(k)) fila.getRange(2 + i, col(k)).setValue(dados[k]);
    });
  });
  g._headerCache = {};
}

escrever([
  { NUMERO_OFICIO: "500/2026", ESCOLA: "COLEGIO ALFA",  STATUS: "PENDENTE",
    EMAILS_TODOS: "a@alfa.br;b@alfa.br;c@alfa.br", TENTATIVAS: 0, ULTIMO_ERRO: "" },
  { NUMERO_OFICIO: "501/2026", ESCOLA: "COLEGIO BETA",  STATUS: "PENDENTE",
    EMAILS_TODOS: "d@beta.br;e@beta.br",           TENTATIVAS: 0, ULTIMO_ERRO: "" },
  { NUMERO_OFICIO: "502/2026", ESCOLA: "COLEGIO GAMA",  STATUS: "ERRO",
    EMAILS_TODOS: "f@gama.br", TENTATIVAS: 3, ULTIMO_ERRO: "E-mail inválido ou não informado." },
  { NUMERO_OFICIO: "503/2026", ESCOLA: "COLEGIO DELTA", STATUS: "ENVIADO",
    EMAILS_TODOS: "g@delta.br", TENTATIVAS: 1, ULTIMO_ERRO: "" }
]);

b.fluxo("FILA · o diagnóstico lê a cota, os gatilhos e as linhas");

b.passo("1. ele roda e devolve as quatro seções");
const saida = g.diagnosticoFilaOficios();
b.ok(typeof saida === "string" && saida.length > 0, "devolveu texto");
["1. COTA DIARIA DE E-MAIL", "2. GATILHOS INSTALADOS",
 "3. O QUE ESTA NA FILA", "4. LINHAS QUE NAO SAIRAM"].forEach(function (s) {
  b.ok(saida.indexOf(s) > -1, "seção: " + s);
});

b.passo("2. conta os destinatários PRESOS, não as linhas");
/* É a distinção que decide o diagnóstico. A cota do Apps Script é por
   DESTINATÁRIO: 3 + 2 = 5 presos em duas linhas. Contar linhas daria 2 e
   subestimaria o problema pela metade. */
b.ok(/destinatarios presos em PENDENTE \.+ 5/.test(saida),
  "cinco destinatários presos em duas linhas PENDENTE",
  "a cota é por destinatário, não por e-mail");

b.passo("3. separa os status");
b.ok(/PENDENTE: 2/.test(saida), "duas PENDENTE");
b.ok(/ERRO: 1/.test(saida), "uma em ERRO");
b.ok(/ENVIADO: 1/.test(saida), "uma já enviada");

b.passo("4. e a linha que JÁ SAIU não aparece no detalhe");
/* O detalhe é para o que está preso. Misturar o que já saiu faria a lista
   crescer sem fim e esconder o que importa. */
b.ok(saida.indexOf("503/2026") === -1, "o ofício ENVIADO fica fora do detalhe");
["500/2026", "501/2026", "502/2026"].forEach(function (n) {
  b.ok(saida.indexOf(n) > -1, "mas o preso aparece: " + n);
});

b.passo("5. mostra tentativas e o último erro — é o que diz se dá para tentar de novo");
b.ok(/tentativas: 3/.test(saida), "as tentativas gastas aparecem");
b.ok(/E-mail inv[áa]lido/.test(saida), "e o erro que travou a linha");

b.fluxo("FILA · a cota, que é a causa invisível");

b.passo("6. COTA ESTOURADA — o diagnóstico diz o nome disso");
/* Sem esta seção, o sintoma na produção é indistinguível de "o sistema
   parou": as linhas ficam PENDENTE, nenhuma tentativa é gasta e nenhum erro é
   gravado. */
const quotaOriginal = g.MailApp.getRemainingDailyQuota;
g.MailApp.getRemainingDailyQuota = () => 2;
const comCotaZero = g.diagnosticoFilaOficios();
b.ok(/restantes hoje \.+ 2/.test(comCotaZero), "reporta a cota real");
b.ok(/ESTOURADA/.test(comCotaZero), "e diz que ela estourou");
b.ok(/PAUSADA e nao marca erro nenhum/.test(comCotaZero),
  "explicando que a fila pausa SEM marcar erro",
  "é exatamente por isso que ninguém foi avisado");

b.passo("7. cota folgada HOJE não inocenta ONTEM");
/* A armadilha do diagnóstico: a cota renova a cada 24h. Rodar hoje e ver
   folga não prova que ontem estava folgada — e o relatado é justamente sobre
   ontem. Se esta asserção cair, o diagnóstico passa a inocentar a causa certa. */
g.MailApp.getRemainingDailyQuota = () => 400;
const comCotaFolgada = g.diagnosticoFilaOficios();
b.ok(/Folgada AGORA/.test(comCotaFolgada), "diz que está folgada agora");
b.ok(/pode ter estourado ONTEM/.test(comCotaFolgada),
  "E AVISA que ontem pode ter sido diferente",
  "a cota renova a cada 24h — sem este aviso o diagnóstico enganaria");

b.passo("8. e avisa quando o que está preso não cabe na cota");
g.MailApp.getRemainingDailyQuota = () => 4;
const naoCabe = g.diagnosticoFilaOficios();
b.ok(/NAO CABE NA COTA DE HOJE/.test(naoCabe),
  "5 destinatários presos não cabem em 4 de cota");
g.MailApp.getRemainingDailyQuota = quotaOriginal;

b.fluxo("FILA · o gatilho, que é a outra causa silenciosa");

b.passo("9. sem o gatilho da fila, ele aponta isso como causa");
/* A fila só anda de 5 em 5 minutos porque um gatilho a chama. Apagado, ela
   para sem erro nenhum — e nada na tela diz isso. */
const semGatilho = g.diagnosticoFilaOficios();
b.ok(/NAO ESTA NA LISTA|NENHUM gatilho instalado/.test(semGatilho),
  "acusa a ausência do processarFilaEnvioOficios");

b.passo("10. e com ele instalado, para de acusar");
g.ScriptApp.newTrigger("processarFilaEnvioOficios").timeBased().everyMinutes(5).create();
const comGatilho = g.diagnosticoFilaOficios();
b.ok(/- processarFilaEnvioOficios/.test(comGatilho), "lista o gatilho");
b.ok(!/NAO ESTA NA LISTA/.test(comGatilho), "e não acusa mais falta");

b.passo("11. NÃO ESCREVEU NADA — é o que autoriza rodá-lo na produção");
const antes = fila.getRange(2, 1, 4, fila.getLastColumn()).getValues();
g.diagnosticoFilaOficios();
b.igual(fila.getRange(2, 1, 4, fila.getLastColumn()).getValues(), antes,
  "a fila está idêntica depois de rodar o diagnóstico");
const fonte = fs.readFileSync(path.join(FIXTURES, "DiagnosticoFilaOficios.gs.txt"), "utf8");
["setValue", "appendRow", "sendEmail", "newTrigger", "deleteTrigger"].forEach(function (p) {
  b.ok(fonte.indexOf(p + "(") === -1, "o arquivo não chama " + p + "()");
});

b.naoTestavel(
  "qual foi a causa REAL de ontem",
  "o emulador não tem o histórico da produção. O diagnóstico responde isso " +
  "lá: rodar `diagnosticoFilaOficios` no projeto de produção e mandar o log"
);
b.naoTestavel(
  "o teto real da cota da conta",
  "o emulador devolve 1500, que é o de conta Workspace. A conta executora é " +
  "gmail.com comum, onde o teto do Apps Script é 100 DESTINATÁRIOS por dia — " +
  "e só a execução real diz o número"
);

b.resumo();
