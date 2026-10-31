/**
 * t118 — MÓDULO 03 · O OFÍCIO QUE FALHOU SOME DA HOME
 *
 * Auditoria do Módulo 03 (Documentos/Ofícios), 01/09/2026. Primeiro achado, e
 * ele veio de um sintoma que estava no ar, não de leitura de código.
 *
 * DE ONDE VEIO
 *
 * Na tela de Acionadores da PRODUÇÃO, o `processarFilaEnvioOficios` mostrava
 * **0,26% de taxa de erro**. Baixo — mas essa é a rotina que manda o ofício, e
 * ofício é a única operação viva do sindicato. 0,26% de uma rotina que roda a
 * cada 5 minutos são ofícios que não saíram, hoje, de verdade.
 *
 * O QUE A FILA FAZ, e está certo
 *
 * Três tentativas (`MAX_TENTATIVAS`), pausa de 4 s entre envios, guarda de
 * cota de e-mail que pausa sem gastar tentativa, e classificação de erro
 * permanente (`classificarErroEnvio_`) para não insistir em e-mail inválido.
 * Esgotadas as tentativas, a linha vira **ERRO_PERMANENTE** e a fila para de
 * tentar — o que é a decisão correta.
 *
 * O QUE ACONTECE DEPOIS, e é o defeito
 *
 * Ninguém fica sabendo.
 *
 * 1. `FilaOficios.gs` não manda e-mail nem alerta nenhum quando um ofício
 *    morre na fila — a única chamada de `MailApp` no arquivo inteiro é
 *    `getRemainingDailyQuota`.
 * 2. O contador de "pendentes" do dashboard (`DashboardOficios.gs:339`) conta
 *    só PENDENTE e PROCESSANDO. ERRO_PERMANENTE cai em `erros`, que é outra
 *    conta.
 * 3. A Home lê **apenas** `resumo.pendentes` (`InicioResumo.gs:162`), e a
 *    saúde é `valor > 0 ? ATENÇÃO : OK` (`InicioResumo.gs:144`).
 * 4. O `BADGE_MONITORAMENTO` recebe `pendentes` também
 *    (`FilaOficios.gs:473`).
 *
 * Resultado: o ofício sai da fila de pendentes, **nenhum indicador se mexe**,
 * e a Home diz **OK**. O documento nunca chegou ao destino e o painel que
 * existe para dizer "o que precisa ser feito hoje" afirma que está tudo em dia.
 *
 * É exatamente o sintoma que o CLAUDE.md descreve como o pior deste projeto:
 * a tela responde, nada dá erro, e o trabalho não aconteceu. Só aparece no
 * painel de Monitoramento, se alguém abrir — e ninguém abre um painel para
 * conferir se algo que ele não sabe que falhou falhou.
 *
 * ESTE TESTE mede os dois lados: que o ofício falhado é invisível ANTES, e que
 * passa a ser visto DEPOIS, sem que o pendente comum mude de comportamento.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* Semeia o registro de ofícios com quatro situações: uma enviada, uma
   pendente, uma que estourou as tentativas e uma que voltou do servidor de
   e-mail. As duas últimas são ofícios que NÃO chegaram a ninguém. */
(function semear() {
  let sh = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (!sh) sh = ss.insertSheet(g.PLANILHA_REGISTRO);
  const cab = ["Número do Ofício", "Escola", "E-mail", "Status", "Data"];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  /* O NÚMERO PRECISA SER "NNN/AAAA". O dashboard descarta qualquer outro
     formato (`DashboardOficios.gs:285`) — é a trava que separa ofício de
     linha de cadastro de escola no mesmo Controle. A primeira versão deste
     teste semeou "OF-2026-000001" e todas as quatro linhas foram ignoradas
     na entrada: o teste falhava por semente errada, não pelo defeito. */
  sh.getRange(2, 1, 4, cab.length).setValues([
    ["001/2026", "Escola A", "a@teste.com", "ENVIADO",          "01/09/2026"],
    ["002/2026", "Escola B", "b@teste.com", "PENDENTE",         "01/09/2026"],
    ["003/2026", "Escola C", "c@teste.com", "ERRO_PERMANENTE",  "01/09/2026"],
    ["004/2026", "Escola D", "d@teste.com", "FALHA_ENTREGA",    "01/09/2026"]
  ]);
})();

b.fluxo("MÓDULO 03 · o ofício que falhou tem de aparecer na Home");

b.passo("1. o dashboard SEPARA as contas — e isso está certo");
/* A separação não é o defeito: pendente e falhado são coisas diferentes para
   quem opera. O defeito é a Home ler só uma delas. */
const dash = g.getDashboardOficiosData({}, TOKEN);
b.ok(dash && dash.resumo, "o dashboard responde", dash && dash.ok);
b.igual(Number(dash.resumo.pendentes || 0), 1, "conta 1 pendente (o que ainda vai sair sozinho)");
b.igual(Number(dash.resumo.erros || 0), 1, "e 1 em erro, numa conta separada");
b.igual(Number(dash.resumo.falhas || 0), 1, "e 1 com falha de entrega, em outra");

b.passo("2. A DIFERENÇA QUE IMPORTA — pendente se resolve sozinho, erro não");
/* O `processarFilaEnvioOficios` roda a cada 5 minutos e leva o PENDENTE
   embora. O ERRO_PERMANENTE ele pula de propósito (FilaOficios.gs:304), para
   não insistir em e-mail inválido. Ou seja: dos três, o único que NÃO precisa
   de gente é justamente o único que a Home mostra. */
const fonte = String(g.processarFilaEnvioOficios);
b.ok(
  /ERRO_PERMANENTE"\)\s*continue/.test(fonte.replace(/\s+/g, " ")) ||
  fonte.indexOf('=== "ERRO_PERMANENTE") continue') >= 0,
  "a fila PULA o erro permanente — ele nunca mais é tentado",
  "por isso ele precisa de uma pessoa, e o pendente não"
);

b.passo("3. ninguém é avisado quando o ofício morre na fila");
/* A única chamada de MailApp no arquivo inteiro é a de consulta de cota. Não
   há e-mail, não há alerta, não há nada — a linha muda de status na planilha
   e o assunto morre ali. */
const fila = require("fs").readFileSync(
  require("path").join(require("./dom").RAIZ, "FilaOficios.gs"), "utf8");
const chamadasMail = (fila.match(/MailApp\.\w+|GmailApp\.\w+/g) || []);
b.ok(
  chamadasMail.every(c => c.indexOf("getRemainingDailyQuota") >= 0),
  "FilaOficios.gs não envia nenhum aviso de falha",
  chamadasMail.join(", ") || "nenhuma chamada de e-mail"
);

b.passo("4. O DEFEITO — a Home não vê o ofício que não chegou");
const resumo = g.getResumoInicioSISGEP(TOKEN);
b.ok(resumo && resumo.ok, "o resumo da Home responde");

const valorOficios = Number((resumo.prioridades || {}).oficios || 0);
const saudeOficios = (resumo.saude || {}).oficios;

b.igual(
  valorOficios, 3,
  "a Home conta os 3 ofícios que NÃO chegaram ao destino",
  "1 pendente + 1 erro permanente + 1 falha de entrega — antes da correção " +
  "contava só o pendente, e os outros dois sumiam do painel"
);
b.igual(
  saudeOficios, "ATENÇÃO",
  "e a saúde acusa ATENÇÃO",
  "antes: com 0 pendentes e 2 falhados, a Home dizia OK enquanto dois ofícios " +
  "nunca haviam chegado"
);

b.passo("5. O CASO QUE PROVA — zero pendentes, mas um ofício falhado");
/* É o cenário real: a fila esvazia, o pendente vira enviado, e sobra só o que
   quebrou. Antes da correção este era o estado em que a Home dizia OK. */
const sh = ss.getSheetByName(g.PLANILHA_REGISTRO);
sh.getRange(3, 4).setValue("ENVIADO");   // o pendente saiu
sh.getRange(5, 4).setValue("ENVIADO");   // a falha de entrega foi resolvida
try { g.CacheService.getScriptCache().removeAll([]); } catch (e) {}

const dash2 = g.getDashboardOficiosData({}, TOKEN);
b.igual(Number(dash2.resumo.pendentes || 0), 0, "não há mais nenhum pendente");
b.igual(Number(dash2.resumo.erros || 0), 1, "mas o erro permanente continua lá");

const resumo2 = g.getResumoInicioSISGEP(TOKEN);
b.igual(
  Number((resumo2.prioridades || {}).oficios || 0), 1,
  "a Home mostra 1 — o ofício que não chegou",
  "ANTES mostrava 0, e o documento simplesmente não existia para o painel"
);
b.igual(
  (resumo2.saude || {}).oficios, "ATENÇÃO",
  "e continua em ATENÇÃO com a fila vazia",
  "é o estado exato em que o defeito acontecia: nada pendente, tudo 'OK', e " +
  "um ofício que nunca saiu"
);

b.naoTestavel(
  "os 0,26% de erro do acionador na produção",
  "a taxa vem do painel de Acionadores do Apps Script, que o emulador não " +
  "tem. O que se prova aqui é o que acontece COM um ofício falhado depois " +
  "que ele existe — conferir a taxa real em Acionadores → Execuções"
);
b.naoTestavel(
  "avisar ativamente quem emite (e-mail, alerta)",
  "hoje não existe, e acrescentar é decisão de produto: para quem avisa, com " +
  "que frequência, e o que fazer quando o mesmo ofício falha todo dia. A " +
  "correção deste teste torna a falha VISÍVEL; não a torna avisada"
);

b.resumo();
