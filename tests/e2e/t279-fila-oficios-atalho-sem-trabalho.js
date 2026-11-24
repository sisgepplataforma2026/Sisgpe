/**
 * TESTE — A FILA DE OFÍCIOS NÃO LÊ A PLANILHA INTEIRA QUANDO NÃO HÁ O QUE ENVIAR
 *
 * O QUE ORIGINOU (24/11/2026): na produção a fila tinha 486 linhas, que nunca
 * são apagadas, e `processarFilaEnvioOficios` roda de 5 em 5 minutos (288 por
 * dia). Cada rodada lia TODAS as linhas e colunas — inclusive HTML_BODY — e só
 * depois descartava o que não era PENDENTE nem ERRO. Levava ~8 s para não
 * fazer nada. Agora lê só a coluna STATUS e sai se não há trabalho.
 *
 * É a OPERAÇÃO VIVA do sindicato. O teste cobre as duas pontas do atalho:
 *   - sem trabalho: mesmo resultado de sempre, mesmo badge, e MUITO menos leitura;
 *   - com trabalho (PENDENTE, ERRO, qualquer caixa/espaço): o caminho completo
 *     roda — o atalho nunca pode esconder um ofício a enviar.
 *
 * NÃO PROVA: os segundos reais (só a produção mede) nem o envio de verdade.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CAB = ["ID", "NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ", "EMAIL_PRINCIPAL", "EMAILS_TODOS", "ASSUNTO",
  "HTML_BODY", "ANEXOS_JSON", "STATUS", "TENTATIVAS", "ULTIMO_ERRO", "DATA_ULTIMA_TENTATIVA",
  "CODIGO_VERIFICACAO", "DATA_ENVIO", "MENSAGEM_ID", "STATUS_RECEBIMENTO"];
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") || ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);
const CORPO = "<p>" + "x".repeat(20000) + "</p>";
const linha = (id, num, status) => [id, num, "Filiação", "EMEF Teste", "00.000.000/0001-00", "escola@teste.com",
  "escola@teste.com", "Ofício " + num, CORPO, "[]", status, 0, "", "", "", "", "", ""];
const colStatus = CAB.indexOf("STATUS") + 1;
function semear(statuses) {
  if (fila.getLastRow() > 1) fila.deleteRows(2, fila.getLastRow() - 1);
  fila.getRange(2, 1, statuses.length, CAB.length).setValues(statuses.map((s, i) => linha(i + "_id", (600 + i) + "/2026", s)));
}

/* conta as células LIDAS por getValues */
const Range = Object.getPrototypeOf(fila.getRange(1, 1));
const original = Range.getValues; let lidas = 0;
Range.getValues = function () { const r = original.apply(this, arguments); lidas += (r.length || 0) * ((r[0] && r[0].length) || 0); return r; };
const badge = () => g.PropertiesService.getScriptProperties().getProperty("BADGE_MONITORAMENTO");
g.__cotaEmailRestante = 1500;

fluxo("OFÍCIOS · fila sem trabalho não lê a planilha inteira");

passo("1. 300 enviados + condenados + aguardando conferência: NADA a processar");
const semTrabalho = [];
for (let i = 0; i < 296; i++) semTrabalho.push("ENVIADO");
semTrabalho.push("ERRO_PERMANENTE", "ERRO_PERMANENTE", g.OFDEST_STATUS_AGUARDANDO, g.OFDEST_STATUS_AGUARDANDO);
semear(semTrabalho);
g.PropertiesService.getScriptProperties().setProperty("BADGE_MONITORAMENTO", "9");
lidas = 0;
const r1 = g.processarFilaEnvioOficios();
const lidasSem = lidas;
igual(JSON.stringify(r1), JSON.stringify({ ok: true, mensagem: "Processamento concluído.", processados: 0, enviados: 0, erros: 0, condenados: 0, cotaAcabou: false }),
  "devolve o MESMO resultado de sempre");
igual(badge(), "0", "e atualiza o badge de monitoramento para 0, como o laço fazia");
ok(lidasSem < 1000, "leu pouco: " + lidasSem + " células (a leitura inteira seria " + (300 * CAB.length) + ")",
  "ler só STATUS = ~300 + o cabeçalho");

passo("2. UM pendente no meio: o caminho completo roda");
const comPendente = semTrabalho.slice(); comPendente[150] = "PENDENTE"; semear(comPendente);
lidas = 0;
const r2 = g.processarFilaEnvioOficios();
ok(lidas >= 300 * CAB.length, "leu a fila inteira: " + lidas + " células", "há trabalho, então o código de sempre roda");
ok(r2.processados + r2.enviados + r2.erros >= 1, "e tocou o ofício pendente",
  JSON.stringify(r2));
const st150 = String(fila.getRange(152, colStatus, 1, 1).getValues()[0][0]).trim();
ok(st150 !== "PENDENTE", "o pendente saiu de PENDENTE (agora: " + st150 + ")");

passo("3. ERRO e variações de caixa/espaço também são trabalho — o atalho não pode escondê-los");
["ERRO", " erro ", "pendente", "  Pendente"].forEach(function (s) {
  const arr = semTrabalho.slice(); arr[10] = s; semear(arr);
  lidas = 0; g.processarFilaEnvioOficios();
  ok(lidas >= 300 * CAB.length, "status '" + s + "' leva ao caminho completo");
});

passo("4. fila só com o cabeçalho continua como antes");
if (fila.getLastRow() > 1) fila.deleteRows(2, fila.getLastRow() - 1);
const r4 = g.processarFilaEnvioOficios();
igual(r4.mensagem, "Fila vazia.", "mensagem de fila vazia preservada");

Range.getValues = original;
resumo();
