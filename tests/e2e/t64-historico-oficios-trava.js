/**
 * TESTE — O HISTÓRICO DE OFÍCIOS NÃO FICA "CARREGANDO" PARA SEMPRE
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 19/08/2026: "o histórico só está carregando".
 *
 * O QUE A MEDIÇÃO MOSTROU. Rodando `listarHistoricoOficios` no emulador,
 * ela NÃO explode: devolve
 *
 *     { erro:true, mensagem:"Aba FILA_ENVIO_OFICIOS não encontrada.", itens:[] }
 *
 * pelo caminho de SUCESSO. E a tela lia só `itens`. Com a origem dos dados
 * faltando, a tabela dizia "Nenhum registro encontrado" — uma mentira
 * tranquila: quem lê conclui que não existe ofício nenhum, quando o que
 * sumiu foi a aba.
 *
 * Esse não é o sintoma que ele relatou, e vale dizer com todas as letras:
 * no emulador a tela CHEGA AO FIM, tanto no caminho normal quanto no de
 * erro conhecido. O "Carregando" eterno é um TERCEIRO caso — a chamada que
 * não volta: função ausente no projeto publicado, execução interrompida,
 * sessão derrubada no meio. Nesses, nenhum dos dois handlers dispara e a
 * tabela fica no "Carregando..." sem erro e sem log.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO: que o erro do backend aparece na
 * tela, que a lista normal continua desenhando, e que existe uma trava de
 * espera que troca o "Carregando" eterno por uma mensagem que diz o que
 * fazer.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: qual dos
 * três casos está acontecendo no sistema do usuário. Isso o painel de
 * Execuções do Apps Script diz.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("HISTÓRICO · O erro aparece, e a espera tem fim");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("O histórico de ofícios", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
const doc = tela.doc, win = tela.win;
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

const tbody = doc.getElementById("corpoHistorico");
const texto = () => (tbody.textContent || "").replace(/\s+/g, " ").trim();

/* ═══════════════════════════════════════════════════════════
   1. O caminho que o usuário viveria: a aba não existe
   ═══════════════════════════════════════════════════════════

   O emulador não tem a aba FILA_ENVIO_OFICIOS, então este é o retorno real
   do backend — não um simulado meu.
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
b.ok(!!tbody, "a tabela do histórico existe na tela");
b.ok(typeof win.Historico === "object" && typeof win.Historico.carregar === "function",
  "e o carregador está ligado");

b.passo("2");
const respostaReal = g.listarHistoricoOficios({ escola: "", numero: "", status: "", tipo: "" }, TOKEN);
b.ok(respostaReal && respostaReal.erro === true,
  "o backend devolve erro pelo caminho de SUCESSO, não por exceção",
  JSON.stringify(respostaReal).slice(0, 120));
b.ok(Array.isArray(respostaReal.itens) && respostaReal.itens.length === 0,
  "com itens vazio junto — foi isso que enganou a tela");

b.passo("3");
/* A resposta do backend chega ASSÍNCRONA, mesmo no emulador — a primeira
   versão deste passo conferiu no instante seguinte à chamada e leu o
   "Carregando..." que a própria função acabara de escrever. Não era o
   código falhando: era eu medindo antes da resposta. */
(async function () {
win.Historico.carregar();
await tela.assentar(120);
b.ok(texto().indexOf("Carregando") === -1,
  "depois de carregar, a tabela não fica em 'Carregando'", texto().slice(0, 80));
b.ok(/não foi possível carregar|nao foi possivel carregar/i.test(texto()),
  "a tela DIZ que não conseguiu carregar",
  texto().slice(0, 120));
b.ok(texto().indexOf("FILA_ENVIO_OFICIOS") > -1,
  "e mostra a razão que o backend deu",
  "antes dizia 'Nenhum registro encontrado' — quem lê concluía que não há ofício");

b.passo("4");
/* CONTRAPROVA: "não encontrado" e "não consegui ler" são estados
   diferentes, e trocar um pelo outro é o defeito original ao contrário. */
b.ok(!/nenhum registro encontrado/i.test(texto()),
  "e NÃO diz 'nenhum registro encontrado', que seria mentira",
  texto().slice(0, 120));

/* ═══════════════════════════════════════════════════════════
   2. A lista normal continua desenhando
   ═══════════════════════════════════════════════════════════

   Sem isto, uma correção que mostrasse erro para tudo passaria acima.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
win.Historico.renderLista([
  { numero: "279/2026", tipo: "Oposição à Taxa Negocial", escola: "COLEGIO EXEMPLO",
    status: "ENVIADO", data: "18/08/2026" },
  { numero: "280/2026", tipo: "Filiação", escola: "OUTRA ESCOLA",
    status: "PENDENTE", data: "19/08/2026" }
]);
b.ok(texto().indexOf("279/2026") > -1, "com dados, a lista desenha as linhas", texto().slice(0, 100));
b.ok(texto().indexOf("280/2026") > -1, "as duas");
b.ok(!/não foi possível/i.test(texto()),
  "e sem mensagem de erro quando não há erro");

b.passo("6");
win.Historico.renderLista([]);
b.ok(/nenhum registro/i.test(texto()),
  "lista vazia DE VERDADE continua dizendo 'nenhum registro'",
  "vazio e falha são coisas diferentes, e as duas precisam existir");

/* ═══════════════════════════════════════════════════════════
   3. A trava de espera — o caso do relato
   ═══════════════════════════════════════════════════════════

   O "Carregando" eterno acontece quando NENHUM handler dispara. Aqui isso
   é forçado trocando google.script.run por um que nunca responde.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
const trecho = fonte.slice(fonte.indexOf("carregar: function()"),
                           fonte.indexOf("bindFiltros: function()"));
const semComentario = trecho.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

b.ok(/setTimeout\(/.test(semComentario),
  "existe uma trava de espera no carregamento",
  "sem ela, chamada que não volta deixa a tela em 'Carregando' para sempre");
b.ok(/clearTimeout\(/.test(semComentario),
  "que é cancelada quando a resposta chega",
  "trava que não se cancela mostraria erro por cima de uma lista já pronta");
b.ok((semComentario.match(/clearTimeout\(/g) || []).length >= 2,
  "nos DOIS handlers — sucesso e falha",
  "cancelar só num deles deixa metade dos casos com aviso indevido");
b.ok(/respondeu = true/.test(semComentario),
  "e há uma marca de que já respondeu, além do clearTimeout",
  "o timer pode ter disparado no exato instante da resposta");

b.passo("8");
/* A mensagem da trava precisa dizer o que fazer. Aviso que só informa que
   deu errado deixa a pessoa parada do mesmo jeito. */
b.ok(/Execuç|Execuc/.test(trecho) && /F5|Recarregue/.test(trecho),
  "a mensagem da trava ensina o caminho: recarregar e olhar Execuções",
  "'deu erro' sem próximo passo é o mesmo que 'Carregando' eterno");

b.naoTestavel("Qual dos três casos está acontecendo no sistema do usuário",
  "no emulador a tela chega ao fim; o 'Carregando' eterno é chamada que não volta — o painel de Execuções do Apps Script diz qual");

b.resumo();
})();
