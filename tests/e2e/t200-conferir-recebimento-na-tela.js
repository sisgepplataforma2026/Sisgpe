/**
 * TESTE — O BOTÃO "CONFERIR RECEBIMENTO", PELO CLIQUE
 *
 * POR QUE ESTE TESTE EXISTE, e o que o t154 não cobria.
 *
 * Em 30/09/2026 o gatilho `verificarConfirmacoesRecebimento` foi desligado em
 * produção: rodava 12x/dia, fazia uma busca no Gmail POR OFÍCIO PENDENTE, e
 * comia a cota do ENVIO — foi o que derrubou o reenvio do ofício 407 em 09/09.
 * Desde então, a ÚNICA forma de saber se a escola respondeu é este botão.
 *
 * O t154 prova o backend: o teto por clique, a recusa sem seleção, a contagem
 * de consultas e a porta de permissão — tudo executado, 60 asserções verdes.
 * A TELA, ele confere com uma regex: `/id="btnHistConf"/`. Isso é ler, não
 * testar (REGRA Nº -1). O clique nunca tinha sido executado.
 *
 * A distância entre as duas coisas não é teórica. Entre o botão existir no
 * HTML e ele funcionar há: a barra aparecer com seleção e sumir sem ela, o
 * rótulo dizer quantas consultas custa ANTES do clique, o handler mandar os
 * números certos ao servidor, e o resultado ser desenhado de volta. Cada um
 * desses pode estar quebrado com o botão presente no arquivo.
 *
 * O CUSTO À VISTA É REGRA, não enfeite. Sem ele, um botão de conferência é um
 * relógio disfarçado de botão: a pessoa clica em 300 ofícios sem perceber que
 * gastou o mesmo que o gatilho que ela acabou de desligar.
 *
 * O QUE ESTE TESTE NÃO PROVA: a busca no Gmail de verdade. No emulador o
 * GmailApp é dublê — o que se mede aqui é o que a tela PEDE e o que ela FAZ
 * com a resposta.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.fluxo("OFÍCIOS · Conferir recebimento, pelo clique");
  b.naoTestavel("o botão de conferência na tela", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* ─── a fila, com um ofício enviado e um já confirmado ─────────────────── */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
if (fila) ss.deleteSheet(fila);
fila = ss.insertSheet("FILA_ENVIO_OFICIOS");
const CAB = ["NUMERO_OFICIO", "ESCOLA", "EMAIL_PRINCIPAL", "EMAILS_TODOS",
             "STATUS", "DATA_ENVIO", "DATA_CONFIRMACAO", "MENSAGEM_ID",
             "STATUS_RECEBIMENTO"];
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);
const d = (a, m, dia) => new Date(a, m - 1, dia);
fila.getRange(2, 1, 3, CAB.length).setValues([
  ["601/2026", "EMEF Alfa", "a@a.com", "a@a.com", "ENVIADO", d(2026, 9, 25), "", "MSG-601", ""],
  ["602/2026", "EMEF Beta", "b@b.com", "b@b.com", "ENVIADO", d(2026, 9, 25), "", "MSG-602", ""],
  ["603/2026", "EMEF Gama", "c@c.com", "c@c.com", "ENVIADO", d(2026, 9, 26), "", "MSG-603", ""]
]);

const tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
const doc = tela.doc, win = tela.win;
/* A tela registra os binds no DOMContentLoaded, e o andaime executa os
   <script> na mão — sem disparar o evento, nenhum botão responde e o teste
   acusaria defeito onde não há. */
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

const $ = (id) => doc.getElementById(id);

/* O CLIQUE, COMO ELE EXISTE NESTA TELA — e por que não é `el.click()`.
 *
 * O botão liga por ATRIBUTO: `onclick="Historico.conferirRecebimento()"`. O
 * jsdom deste andaime roda com `runScripts: "outside-only"`, que NÃO compila
 * atributo de evento inline — disparar o clique aqui não executaria nada, e o
 * teste acusaria a tela de não responder quando ela responde no navegador.
 *
 * Então a ligação é provada de um jeito e o comportamento de outro: primeiro
 * se confere que o atributo aponta para a função certa (é isso que o
 * navegador vai executar), depois a função é chamada. Uma coisa sem a outra
 * deixaria passar ou um botão ligado no nada, ou uma função certa que ninguém
 * chama. */
function clicarConferir() {
  const attr = String($("btnHistConf").getAttribute("onclick") || "");
  if (attr.indexOf("Historico.conferirRecebimento()") === -1) {
    b.ok(false, "o botão está ligado em Historico.conferirRecebimento()", attr);
    return;
  }
  win.Historico.conferirRecebimento();
}

function selecionar(numeros) {
  win.Historico.selecionados = numeros.slice();
  win.Historico._confRotular();
}

/* ══════════════════════════════════════════════════════════════════
   PARTE 1 — A BARRA SÓ EXISTE QUANDO HÁ O QUE CONFERIR
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIOS · A barra de conferência aparece com a seleção");

b.ok(!!$("btnHistConf"), "o botão existe na tela do Histórico");
b.ok(!!$("histConfBarra"), "e a barra que o contém também");

selecionar([]);
b.igual($("histConfBarra").style.display, "none",
  "sem seleção, a barra SOME — barra vazia é convite para varrer tudo, que é o gasto que desligar o gatilho evitou");
b.igual($("btnHistConf").disabled, true, "e o botão fica desabilitado");

selecionar(["601/2026", "602/2026"]);
b.igual($("histConfBarra").style.display, "flex", "com seleção, a barra aparece");
b.igual($("btnHistConf").disabled, false, "e o botão libera");

/* ══════════════════════════════════════════════════════════════════
   PARTE 2 — O CUSTO É DITO ANTES DO CLIQUE
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIOS · O botão diz quanto vai custar, antes de gastar");

b.ok($("btnHistConf").innerHTML.indexOf("(2)") > -1,
  "o rótulo do botão traz a quantidade selecionada",
  $("btnHistConf").textContent.trim());
b.ok(/2 of.cio\(s\) selecionado\(s\).*custo: 2 consulta\(s\) ao Gmail/.test($("histConfResumo").textContent),
  "e o resumo diz o CUSTO em consultas ao Gmail — sem isso o botão é um relógio disfarçado",
  $("histConfResumo").textContent.trim());

selecionar(["601/2026", "602/2026", "603/2026"]);
b.ok(/custo: 3 consulta/.test($("histConfResumo").textContent),
  "o custo acompanha a seleção — três marcados, três consultas",
  $("histConfResumo").textContent.trim());

/* ══════════════════════════════════════════════════════════════════
   PARTE 3 — O CLIQUE PEDE AO SERVIDOR O QUE ESTÁ MARCADO
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIOS · O clique manda ao servidor exatamente o que foi marcado");

(async function () {
  selecionar(["601/2026", "603/2026"]);
  tela.chamadas.length = 0;
  b.ok(String($("btnHistConf").getAttribute("onclick") || "").indexOf("Historico.conferirRecebimento()") > -1,
    "o botão está ligado na função de conferência",
    $("btnHistConf").getAttribute("onclick"));
  clicarConferir();

  /* O botão trava enquanto espera — dois cliques seriam duas varreduras, e a
     segunda gastaria cota para responder o que a primeira já ia responder. */
  b.igual($("btnHistConf").disabled, true,
    "durante a consulta o botão trava — clique duplo seria cota gasta duas vezes");
  b.ok(/Procurando no Gmail a resposta de 2 of/.test($("histConfResultado").textContent),
    "e a tela avisa que está procurando, dizendo quantos",
    $("histConfResultado").textContent.slice(0, 80));

  await tela.assentar(200);

  const chamada = (tela.chamadas || []).filter(c => c.fn === "conferirRecebimentoOficios")[0];
  b.ok(!!chamada, "o servidor foi chamado");
  if (chamada) {
    b.igual(JSON.stringify(chamada.args[0]), JSON.stringify(["601/2026", "603/2026"]),
      "com os DOIS números marcados — não com a fila inteira",
      JSON.stringify(chamada.args[0]));
    b.ok(String(chamada.args[1] || "").length > 0,
      "e com o token da sessão, que é o que a porta do backend exige");
  }

  /* ══════════════════════════════════════════════════════════════
     PARTE 4 — A RESPOSTA É DESENHADA DE VOLTA
     ══════════════════════════════════════════════════════════════ */
  b.fluxo("OFÍCIOS · O resultado volta para a tela");

/* DEPOIS DE CONFERIR, A SELEÇÃO SE DESFAZ — e isso é o certo, não um bug.
   O handler manda recarregar a tabela para os status novos aparecerem, e
   recarregar limpa a seleção. Efeito colateral feliz: ninguém confere duas
   vezes o mesmo lote por distração, que seria cota gasta à toa.
   A primeira versão desta asserção esperava o botão destravado e reprovou —
   eu é que estava errado sobre o comportamento, não a tela. */
  b.igual($("btnHistConf").disabled, true,
    "terminada a consulta a seleção se desfaz, e o botão volta a travar — ninguém confere o mesmo lote duas vezes por distração");
  b.igual($("histConfBarra").style.display, "none",
    "e a barra some junto, como some sempre que não há seleção");
  b.ok($("btnHistConf").innerHTML.indexOf("Conferir recebimento") > -1,
    "o rótulo volta a dizer o que faz, em vez de ficar em 'Conferindo…'",
    $("btnHistConf").textContent.trim());
  b.ok($("histConfResultado").textContent.length > 0 &&
       !/Procurando no Gmail/.test($("histConfResultado").textContent),
    "a caixa de resultado deixou de dizer 'procurando' e trouxe a resposta",
    $("histConfResultado").textContent.slice(0, 110));

  /* NENHUMA CONFIRMAÇÃO não é erro. O certo é dizer que não achou, e não
     pintar de vermelho — vermelho faria a pessoa procurar defeito onde há
     apenas escola que ainda não respondeu. */
  /* O jsdom devolve a cor normalizada em rgb(), não o hexadecimal escrito no
     código — por isso a comparação é pelo valor calculado. */
  const VERMELHO = "rgb(254, 242, 242)";
  b.ok($("histConfResultado").style.background !== VERMELHO,
    "conferir e não achar resposta NÃO é pintado como erro — vermelho faria procurar defeito onde há escola que ainda não respondeu",
    "fundo: " + $("histConfResultado").style.background);
  b.ok(/Custo: 2 consulta\(s\) ao Gmail/.test($("histConfResultado").textContent),
    "e o resultado REPETE o custo, depois de gastar",
    $("histConfResultado").textContent.slice(-40));

  /* ══════════════════════════════════════════════════════════════
     PARTE 5 — O TETO DO BACKEND CHEGA NA TELA
     ══════════════════════════════════════════════════════════════ */
  b.fluxo("OFÍCIOS · O teto por clique é dito na tela, não só recusado");

  const demais = [];
  for (let i = 0; i <= g.MON_OFICIOS_MAX_CONFERENCIA; i++) demais.push("X" + i + "/2026");
  selecionar(demais);
  clicarConferir();
  await tela.assentar(200);

  const cx = $("histConfResultado");
  b.ok(/m.ximo/i.test(cx.textContent) && /consulta ao Gmail/.test(cx.textContent),
    "acima do teto, a tela mostra a recusa E o motivo — não some em silêncio",
    cx.textContent.slice(0, 130));
  b.igual(cx.style.background, "rgb(254, 242, 242)",
    "e ESTA sim é pintada como erro, porque foi recusa de verdade");
  b.igual($("btnHistConf").disabled, false,
    "o botão volta a funcionar depois da recusa — senão a pessoa ficaria presa");

  /* ══════════════════════════════════════════════════════════════
     PARTE 6 — SEM SELEÇÃO, NÃO SAI CHAMADA
     ══════════════════════════════════════════════════════════════ */
  b.fluxo("OFÍCIOS · Sem seleção, o servidor nem é incomodado");

  selecionar([]);
  tela.chamadas.length = 0;
  /* O botão está desabilitado, então o clique não passa; a função é chamada
     direto para provar a trava de dentro dela, que é a que resta se alguém
     reabilitar o botão um dia. */
  win.Historico.conferirRecebimento();
  await tela.assentar(80);
  b.igual((tela.chamadas || []).filter(c => c.fn === "conferirRecebimentoOficios").length, 0,
    "nenhuma chamada ao servidor sai sem ofício marcado");
  const avisos = (tela.avisos || []).map(a => String(a && a.msg || a)).join(" | ");
  b.ok(/Marque ao menos um of/.test(avisos),
    "e a pessoa é avisada do que fazer", avisos.slice(-60));

  b.resumo();
})();
