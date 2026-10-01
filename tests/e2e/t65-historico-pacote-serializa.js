/**
 * TESTE — O PACOTE DO HISTÓRICO ATRAVESSA PARA A TELA
 *
 * O QUE ORIGINOU
 *
 * 19/08/2026. O usuário publicou a trava de espera e mandou o print: a
 * tela mostrou "⏱️ O servidor não respondeu ao carregar o histórico".
 *
 * Isso é um DIAGNÓSTICO, não só um sintoma. Quer dizer que nem o handler
 * de sucesso nem o de falha dispararam — a chamada não voltou. Em
 * google.script.run só duas coisas produzem isso:
 *
 *   1. o retorno não SERIALIZA (o cliente recebe null, sem erro e sem log);
 *   2. a execução demora demais ou morre no meio.
 *
 * ESTE TESTE ATACA AS DUAS.
 *
 * (1) O pacote vinha com os valores CRUS da planilha — id, número, tipo,
 *     escola, CNPJ, e-mail, status, usuário, código. Qualquer um deles
 *     pode ser uma Date convertida pelo Sheets, e uma Date INVÁLIDA mata a
 *     serialização em silêncio. É o mesmíssimo mecanismo que derrubou o
 *     envio do voucher em 18/08/2026.
 *
 * (2) A leitura era `getDataRange().getValues()`: TODAS as colunas de
 *     TODAS as linhas. Entre elas, HTML_BODY — o corpo inteiro do e-mail
 *     de cada ofício, de longe a célula mais pesada da aba, e que esta
 *     função NUNCA usa.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: qual das
 * duas causas era a do sistema no ar. As duas foram fechadas; qual delas
 * estava ativa, só a próxima tentativa dele ou o painel de Execuções diz.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;

b.fluxo("HISTÓRICO · O pacote serializa e a leitura não carrega o que não usa");

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* A aba real da fila, com as colunas que o sistema grava — inclusive
   HTML_BODY, que é o peso morto da leitura. */
const CAB = ["ID", "DATA_CRIACAO", "NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ",
             "EMAIL_PRINCIPAL", "EMAILS_TODOS", "ASSUNTO", "HTML_BODY",
             "ANEXOS_JSON", "STATUS", "TENTATIVAS", "ULTIMO_ERRO",
             "DATA_ULTIMA_TENTATIVA", "USUARIO", "CODIGO_VERIFICACAO", "DATA_ENVIO"];
let sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
if (sh) ss.deleteSheet(sh);
sh = ss.insertSheet("FILA_ENVIO_OFICIOS");
sh.getRange(1, 1, 1, CAB.length).setValues([CAB]);

function add(v) {
  const linha = CAB.map(c => (v[c] !== undefined ? v[c] : ""));
  sh.getRange(sh.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
}

/* Um corpo de e-mail grande, como o real: é ele que a leitura antiga
   trazia para nada, linha após linha. */
const CORPO_PESADO = "<div>" + "x".repeat(8000) + "</div>";

add({ ID: "OF-1", DATA_CRIACAO: new Date(2026, 7, 18, 10, 30),
      NUMERO_OFICIO: "279/2026", TIPO: "Oposição à Taxa Negocial",
      ESCOLA: "COLEGIO EXEMPLO LTDA", CNPJ: "36136001000105",
      EMAIL_PRINCIPAL: "diretoria@exemplo.com", HTML_BODY: CORPO_PESADO,
      ANEXOS_JSON: JSON.stringify([{ fileId: "ABC123", mimeType: "application/pdf" }]),
      STATUS: "ENVIADO", USUARIO: "wanderson", CODIGO_VERIFICACAO: "V1" });

/* A linha envenenada: data INVÁLIDA e um número que virou Date. São
   exatamente os dois estragos que o Sheets produz sozinho. */
add({ ID: "OF-2", DATA_CRIACAO: new Date("banana"),
      NUMERO_OFICIO: new Date(2026, 7, 19), TIPO: "Filiação",
      ESCOLA: "ESCOLA Y", HTML_BODY: CORPO_PESADO,
      STATUS: "PENDENTE", USUARIO: "marcelha" });

/* ═══════════════════════════════════════════════════════════
   1. O pacote não leva nenhum objeto Date
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const pacote = g.listarHistoricoOficios({ escola: "", numero: "", status: "", tipo: "" }, TOKEN);
b.ok(pacote && Array.isArray(pacote.itens), "a listagem responde", JSON.stringify(pacote).slice(0, 100));
b.igual(pacote.itens.length, 2, "com as duas linhas");

/** Varre o pacote inteiro atrás de Date — recursivo, porque uma escondida
    dentro de itens[] quebra igual a uma no primeiro nível. */
function datasNoPacote(obj, caminho, achados) {
  caminho = caminho || "retorno"; achados = achados || [];
  if (obj === null || typeof obj !== "object") return achados;
  if (Object.prototype.toString.call(obj) === "[object Date]") {
    achados.push(caminho + (isNaN(obj.getTime()) ? " (Date INVÁLIDA)" : " (Date)"));
    return achados;
  }
  Object.keys(obj).forEach(k => datasNoPacote(obj[k], caminho + "." + k, achados));
  return achados;
}

b.passo("2");
b.igual(datasNoPacote(pacote), [],
  "nenhum objeto Date sobra no pacote",
  "Date inválida no retorno faz o google.script.run devolver null, sem erro e sem log");
b.ok(JSON.stringify(pacote).length > 20,
  "e o pacote sobrevive a JSON.stringify");

b.passo("3");
/* A linha envenenada não pode derrubar a listagem NEM sumir dela: um
   ofício que desaparece do histórico é pior que um campo vazio. */
const envenenada = pacote.itens.filter(i => i.id === "OF-2")[0];
b.ok(!!envenenada, "a linha com data inválida CONTINUA na lista",
  "sumir do histórico é pior que sair com campo vazio");
b.igual(envenenada.data, "", "com a data ilegível vazia, em vez de derrubar tudo");
/* Confere o TIPO antes do conteúdo. A primeira versão chamava .indexOf
   direto e, sob mutação, o campo voltava a ser um objeto Date — o teste
   QUEBRAVA em vez de reprovar, escondendo as outras falhas. O tipo é o
   que se está medindo aqui: o pacote tem que sair em texto. */
b.igual(typeof envenenada.numero, "string",
  "o número sai como TEXTO, não como objeto Date",
  "objeto Date no pacote é o que faz o google.script.run devolver null");
b.ok(String(envenenada.numero).indexOf("2026") > -1,
  "e sai legível", String(envenenada.numero));
b.igual(envenenada.escola, "ESCOLA Y", "o resto da linha chega inteiro");

b.passo("4");
/* Contraprova: a linha boa continua boa. Uma correção que apagasse tudo
   também passaria nas asserções acima. */
const boa = pacote.itens.filter(i => i.id === "OF-1")[0];
b.igual(boa.numero, "279/2026", "a linha normal sai com o número certo");
b.igual(boa.data, "18/08/2026 10:30", "e com a data formatada");
b.ok(boa.linkPdf.indexOf("ABC123") > -1, "com o link do PDF", boa.linkPdf);

/* ═══════════════════════════════════════════════════════════
   2. A leitura não traz o corpo do e-mail
   ═══════════════════════════════════════════════════════════

   HTML_BODY é a célula mais pesada da aba e o histórico nunca a usa. Com
   a fila crescendo, trazê-la era carregar megabytes para descartar.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
const bruto = JSON.stringify(pacote);
b.ok(bruto.indexOf("xxxxxxxxxx") === -1,
  "o corpo do e-mail NÃO vai no pacote de retorno",
  "ele nem é campo da listagem — se aparecesse, estaria sendo carregado à toa");

b.passo("6");
const fs = require("fs"), path = require("path");
const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "HistoricoOficios.gs"), "utf8");
const corpoFn = fonte.slice(fonte.indexOf("function listarHistoricoOficios"),
                            fonte.indexOf("function getColunasFilaOficios_"));
const limpo = corpoFn.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
b.ok(!/getDataRange\(\)/.test(limpo),
  "a função não lê mais a planilha inteira com getDataRange()",
  "era ela que trazia HTML_BODY de todas as linhas");
b.ok(/getRange\(2,\s*indice \+ 1/.test(limpo),
  "e passou a ler coluna a coluna, só as que usa");

b.passo("7");
/* O conversor de texto precisa existir e aguentar os quatro casos. */
b.ok(typeof g.textoHistoricoOficio_ === "function",
  "existe o conversor de célula para texto");
b.igual(g.textoHistoricoOficio_(new Date("banana")), "",
  "Date inválida vira vazio");
b.igual(g.textoHistoricoOficio_(""), "", "vazio continua vazio");
b.igual(g.textoHistoricoOficio_("279/2026"), "279/2026", "texto passa direto");
b.ok(g.textoHistoricoOficio_(new Date(2026, 7, 18)).indexOf("2026") > -1,
  "e Date válida sai legível, com o ano",
  g.textoHistoricoOficio_(new Date(2026, 7, 18)));

b.passo("8");
/* Contraprova do conversor: se devolvesse "" para tudo, ele "resolveria"
   o problema apagando o histórico inteiro. */
b.ok(g.textoHistoricoOficio_("COLEGIO EXEMPLO") === "COLEGIO EXEMPLO",
  "o conversor não apaga o que é bom");

b.naoTestavel("Qual das duas causas estava ativa no sistema do usuário",
  "as duas foram fechadas — serialização e leitura pesada; qual delas travava, só a próxima tentativa no ar ou o painel de Execuções diz");

b.resumo();
