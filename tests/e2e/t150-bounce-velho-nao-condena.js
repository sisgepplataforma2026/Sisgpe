/**
 * TESTE — BOUNCE VELHO NÃO CONDENA ENVIO NOVO, E O ALERTA PARA DE REPETIR
 *
 * O QUE ORIGINOU, 08/09/2026. O usuário mandou o print da caixa de entrada: o
 * MESMO alerta "⚠️ SISGEP — 9 ofício(s) com falha de entrega", de três em três
 * horas, dias seguidos. E já tinha criado um rótulo `SISGEP_Ignorado` para
 * varrê-los da vista.
 *
 * Esse rótulo é a medida do estrago. Alerta que se repete vira ruído, ruído é
 * filtrado, e o alerta seguinte — o que importa — cai na mesma pasta.
 *
 * Depois veio a frase que fechou o diagnóstico: **"esses ofícios foram
 * enviados"**. Não era o alerta com defeito: era a detecção marcando como
 * falha o que tinha chegado.
 *
 * O CICLO:
 *   1. ofício quica       → FALHA_ENTREGA
 *   2. alguém reenvia     → volta a ENVIADO
 *   3. o gatilho roda     → ENVIADO está na lista de ativos
 *   4. o Registro ainda guarda o endereço MORTO
 *   5. a busca é newer_than:90d — o bounce de março continua no Gmail
 *   6. casa por ENDEREÇO  → marca FALHA_ENTREGA de novo → alerta → volta ao 2
 *
 * O que este teste protege é a quebra do ciclo: a comparação por DATA, a data
 * do reenvio sendo gravada, e o alerta que só fala do que é novo.
 *
 * O QUE ELE NÃO ALCANÇA: o Gmail de verdade. O emulador não busca bounce nem
 * entrega e-mail — ele prova a REGRA de decisão, não a leitura da caixa.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const MARCO   = new Date(2026, 2, 10, 9, 0, 0);   // o bounce antigo
const AGOSTO  = new Date(2026, 7, 20, 9, 0, 0);   // emissão do ofício
const SETEMBRO= new Date(2026, 8,  5, 18, 0, 0);  // o reenvio de sexta

fluxo("BOUNCE · a data separa 'quicou agora' de 'quicou em março'");
passo("o resolvedor do último envio");

ok(typeof g.MON_OFICIOS_ultimoEnvio_ === "function",
   "existe uma função que diz quando o ofício saiu pela última vez");

igual(g.MON_OFICIOS_ultimoEnvio_({ dataEnvio: AGOSTO, reenviadoEm: SETEMBRO }).getTime(),
      SETEMBRO.getTime(),
      "o REENVIO vence a emissão — é o envio mais recente",
      "é contra ele que o bounce precisa ser comparado");

igual(g.MON_OFICIOS_ultimoEnvio_({ dataEnvio: AGOSTO, reenviadoEm: "" }).getTime(),
      AGOSTO.getTime(),
      "sem reenvio, vale a data de emissão");

igual(g.MON_OFICIOS_ultimoEnvio_({ dataEnvio: "", reenviadoEm: null }), null,
      "sem nenhuma data utilizável, devolve null");

igual(g.MON_OFICIOS_ultimoEnvio_({ dataEnvio: new Date("xx"), reenviadoEm: null }), null,
      "data inválida na planilha NÃO vira 1970",
      "se virasse, todo bounce pareceria mais novo que o envio e tudo cairia em falha");

passo("a regra da comparação, como o gatilho aplica");

/* Reproduz a decisão do detector: bounce só conta se for POSTERIOR ao último
   envio. É a linha que quebra o ciclo. */
function condena(bounce, item) {
  const envio = g.MON_OFICIOS_ultimoEnvio_(item);
  if (!envio) return !item.jaFalhou;
  return bounce > envio;
}

igual(condena(MARCO, { dataEnvio: AGOSTO, reenviadoEm: SETEMBRO, jaFalhou: true }), false,
      "bounce de MARÇO não condena ofício reenviado em SETEMBRO",
      "era exatamente isto que devolvia os reenviados para a caixa de falha");

igual(condena(new Date(2026, 8, 6), { dataEnvio: AGOSTO, reenviadoEm: SETEMBRO, jaFalhou: true }), true,
      "bounce do dia SEGUINTE ao reenvio condena — é falha de verdade",
      "o conserto não pode cegar o detector; só ensiná-lo a ler a data");

igual(condena(MARCO, { dataEnvio: new Date(2026, 1, 1), reenviadoEm: null, jaFalhou: false }), true,
      "bounce posterior à emissão condena ofício nunca reenviado");

passo("sem data, o caminho conservador depende de já ter falhado");

igual(condena(MARCO, { dataEnvio: "", reenviadoEm: "", jaFalhou: false }), true,
      "ofício que NUNCA falhou e não tem data: o bounce vale",
      "é a única informação que existe sobre ele");

igual(condena(MARCO, { dataEnvio: "", reenviadoEm: "", jaFalhou: true }), false,
      "ofício JÁ reenviado e sem data NÃO é reaberto sem prova nova",
      "reabrir sem prova é o ciclo que este conserto existe para quebrar");

fluxo("REENVIO · a data do reenvio é gravada, senão não há o que comparar");
passo("a coluna");

const fonteEmail = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EmailOficios.gs"), "utf8");

ok(/OFICIO_COL_REENVIADO_EM\s*=\s*"REENVIADO_EM"/.test(fonteEmail),
   "existe a coluna REENVIADO_EM");
ok(typeof g.oficio_garantirColuna_ === "function",
   "e um helper genérico que a cria sem mexer em dado nenhum");

const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const corpoMarcar = semComentarios(
  fonteEmail.slice(fonteEmail.indexOf("function oficio_marcarReenviado_")));

ok(corpoMarcar.indexOf("OFICIO_COL_REENVIADO_EM") > -1,
   "o reenvio grava a data",
   "sem ela o detector não tem contra o que comparar e o ciclo volta");
ok(/setValue\(new Date\(\)\)/.test(corpoMarcar.slice(0, 2500)),
   "e grava a hora de AGORA, não uma string formatada",
   "string não compara com data");

fluxo("ALERTA · para de repetir, e passa a dizer QUAIS");
passo("o mesmo conjunto não avisa duas vezes");

const props = g.PropertiesService.getScriptProperties();
props.setProperty(g.MON_OFICIOS_PROP_ALERTADOS, "");

let enviados = [];
const gmailOriginal = g.GmailApp.sendEmail;
g.GmailApp.sendEmail = (para, assunto, corpo, opcoes) =>
  enviados.push({ assunto: assunto, html: (opcoes || {}).htmlBody || "" });

g.notificarFalhasEntregaOficios_(["144/2026", "168/2026"]);
igual(enviados.length, 1, "a primeira vez avisa");
ok(enviados[0].html.indexOf("144/2026") > -1,
   "e NOMEIA os ofícios",
   '"9 com falha" não diz o que fazer — foi assim que virou rótulo de ignorado');

g.notificarFalhasEntregaOficios_(["144/2026", "168/2026"]);
igual(enviados.length, 1,
      "a segunda passada com a MESMA lista não manda nada",
      "era o e-mail de três em três horas que fez o usuário criar SISGEP_Ignorado");

g.notificarFalhasEntregaOficios_(["144/2026", "168/2026", "500/2026"]);
igual(enviados.length, 2, "entrou um ofício novo: volta a avisar");
ok(enviados[1].html.indexOf("500/2026") > -1 &&
   enviados[1].html.indexOf("já avisados continuam em falha") > -1,
   "e distingue o novo dos que já eram conhecidos");

passo("ofício resolvido some do registro e, se voltar, é notícia de novo");

g.notificarFalhasEntregaOficios_(["144/2026"]);
igual(enviados.length, 2, "lista menor, nada novo: silêncio");
g.notificarFalhasEntregaOficios_(["144/2026", "500/2026"]);
igual(enviados.length, 3,
      "o 500 saiu da lista e voltou — volta a ser notícia",
      "guardar a união faria um problema que voltou passar despercebido");

passo("formato antigo continua funcionando");

g.notificarFalhasEntregaOficios_(7);
igual(enviados.length, 4,
      "chamada só com o total ainda avisa",
      "sem os números não há como saber o que é novo — avisar é o conservador");

g.GmailApp.sendEmail = gmailOriginal;
props.setProperty(g.MON_OFICIOS_PROP_ALERTADOS, "");

naoTestavel("se o Gmail devolve as datas de bounce como esperado",
  "o emulador não busca a caixa. A regra de decisão está provada; a leitura " +
  "de msg.getDate() só o gatilho no ar responde.");

resumo();
