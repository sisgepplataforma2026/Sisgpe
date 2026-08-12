/**
 * TESTE DE TELA — Pendências do Cadastro, do clique até a planilha e de volta.
 *
 * O PRIMEIRO TESTE DE TELA DESTE PROJETO.
 *
 * Pedido do usuário em 12/08/2026, depois de eu entregar a tela duas vezes
 * com o veredito "não testado": *"Tem que testar todas as funções antes de
 * implementar, ou seja o que está sendo proposto do início ao fim"*.
 *
 * Aqui a tela é carregada num DOM real, os scripts dela rodam, e o
 * `google.script.run` está ligado no backend real sobre a planilha em
 * memória. Clicar num card aqui executa exatamente o que executa no
 * navegador: handler da tela → escolasPendenciasListar → planilha → volta →
 * redesenho. Nada é simulado no meio do caminho.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA, e continua "não testado":
 * aparência, cor, alinhamento e visibilidade por CSS. jsdom não desenha.
 */
const b = require("./base");
const d = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CABECALHO = [
  "EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "E-mails (todos)",
  "Telefone 1", "Telefone 2", "Cidade", "UF", "CEP",
  "NOME_FANTASIA", "SITUACAO_CADASTRAL", "ULTIMA_VERIFICACAO"
];

function linha(id, nome, extras) {
  const l = new Array(CABECALHO.length).fill("");
  const set = (c, v) => { l[CABECALHO.indexOf(c)] = v; };
  set("EscolaID", id);
  set("Escola (Razão Social)", nome);
  set("CNPJ", "11.222.333/0001-81");
  set("E-mail (principal)", "contato@x.com");
  set("Telefone 1", "(27) 3256-6107");
  set("Cidade", "Alegre");
  set("UF", "ES");
  set("SITUACAO_CADASTRAL", "ATIVA");
  Object.keys(extras || {}).forEach(function (k) {
    const i = CABECALHO.indexOf(k);
    if (i > -1) l[i] = extras[k];
  });
  return l;
}

function montarBase() {
  const velha = ss.getSheetByName("Escolas");
  if (velha) ss.deleteSheet(velha);
  const sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);

  const linhas = [];
  // 3 casos nomeados, que os passos citam por id
  linhas.push(linha("ESC-000090", "Pré-escola Anjo Azul",
    { "CNPJ": "00.652.298/0001-14", "E-mail (principal)": "", "Telefone 1": "", "Telefone 2": "",
      "E-mails (todos)": "307" }));
  linhas.push(linha("ESC-000091", "Centro Brilho de Sol",
    { "CNPJ": "06.272.153/0002-55", "E-mail (principal)": "ceibrilhodesol@gmail.com", "UF": "" }));
  linhas.push(linha("ESC-000092", "Zumbi dos Palmares",
    { "E-mail (principal)": "zumbi@escola.com", "SITUACAO_CADASTRAL": "" }));
  // massa para forçar mais de uma página (50 por página)
  for (let i = 0; i < 60; i++) {
    linhas.push(linha("ESC-1" + String(i).padStart(5, "0"), "Escola Comum " + i,
      { "Telefone 1": "", "Telefone 2": "" }));
  }
  // uma completa, que NÃO pode aparecer em lugar nenhum
  linhas.push(linha("ESC-000099", "Escola Perfeita"));

  sh.getRange(2, 1, linhas.length, CABECALHO.length).setValues(linhas);
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  return sh;
}

/* ══════════════════════════════════════════════════════════════════════ */
(async function () {

  if (!d.jsdomDisponivel()) {
    b.fluxo("TELA · Pendências");
    b.naoTestavel("A tela não pôde ser executada",
      "jsdom não instalado — rode `npm install jsdom` na raiz do projeto. " +
      "O backend continua coberto por t27; a TELA fica sem prova.");
    const c = b.resumo();
    process.exit(c.FALHOU ? 1 : 0);
  }

  montarBase();

  /* ────────────────────────────────────────────────────────────────────
     1. A TELA ABRE
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Abrir Pendências");

  const t = d.montar(g, ["PendenciasAdmin.html"], { token: ADM });

  b.passo("1. O bloco de script executou");
  /* REGRA Nº 0: tela que renderiza mas não responde é JavaScript morto na
   * página. Este marcador é o primeiro sintoma a checar. */
  b.ok(t.win.ESC_PENDENCIAS_MARCADOR === "bloco de script executou" &&
       typeof t.win.initEscolasPendencias === "function",
    "o JavaScript da tela está vivo e initEscolasPendencias existe");

  t.win.initEscolasPendencias();
  await t.assentar();

  b.passo("2. Ela pediu a lista ao servidor, com o token da sessão");
  const ch1 = t.chamadas[0];
  b.ok(ch1 && ch1.fn === "escolasPendenciasListar" && ch1.args[1] === ADM,
    "chamou escolasPendenciasListar passando a sessão",
    ch1 ? ch1.fn + " · token=" + String(ch1.args[1]).slice(0, 8) + "…" : "nenhuma chamada");

  b.passo("3. E desenhou os sete cards, nas duas faixas");
  const g1 = t.doc.querySelectorAll("#epCardsG1 .ep-card");
  const g2 = t.doc.querySelectorAll("#epCardsG2 .ep-card");
  b.ok(g1.length === 4 && g2.length === 3,
    "4 em 'Trava a operação', 3 em 'Reduz o alcance'",
    "g1=" + g1.length + " g2=" + g2.length);

  b.passo("4. Os números dos cards são os do backend, não inventados");
  const backend = g.escolasPendenciasListar({}, ADM);
  function valorDoCard(chave) {
    const el = t.doc.querySelector('.ep-card[data-tipo="' + chave + '"] div');
    return el ? parseInt(el.textContent, 10) : null;
  }
  const conferem = Object.keys(backend.resumo).every(function (k) {
    return valorDoCard(k) === backend.resumo[k];
  });
  b.ok(conferem, "cada card mostra exatamente o que o servidor mediu",
    "SEM_TELEFONE na tela=" + valorDoCard("SEM_TELEFONE") + " no backend=" + backend.resumo.SEM_TELEFONE);

  b.passo("5. Os cards zerados continuam na tela");
  /* Decisão do usuário: "Mantem até para verificação e ajuste". */
  b.ok(valorDoCard("SEM_DOCUMENTO") === 0 && valorDoCard("SEM_NOME") === 0,
    "zero aparece, não some");

  b.passo("6. A lista trouxe linhas de escola");
  const linhas0 = t.doc.querySelectorAll("#epLista tbody tr");
  b.ok(linhas0.length === 50, "primeira página com 50", "linhas=" + linhas0.length);

  b.passo("6b. O e-mail aparece na linha de quem tem");
  /* Aparece porque dá para BUSCAR por ele: quem procurou precisa ver o que
   * casou, senão o resultado parece arbitrário. */
  /* O e-mail conferido aqui é o das "Escola Comum", que estão na página 1.
   * A Brilho de Sol tem só SEM_UF (gravidade 3) e cai na página 2 — asserção
   * minha errada na primeira versão, corrigida sem mexer na tela. */
  const htmlLista0 = t.doc.querySelector("#epLista").innerHTML;
  b.ok(htmlLista0.indexOf("✉ contato@x.com") > -1,
    "o e-mail que o backend devolve chega na tela");

  b.passo("6c. E quem NÃO tem e-mail não ganha uma linha vazia");
  const trAnjo = Array.prototype.filter.call(t.doc.querySelectorAll("#epLista tbody tr"),
    function (tr) { return tr.textContent.indexOf("Anjo Azul") > -1; })[0];
  b.ok(trAnjo && trAnjo.textContent.indexOf("✉") === -1,
    "sem e-mail, sem o símbolo de e-mail");

  b.passo("7. A escola completa NÃO aparece na fila");
  b.ok(t.doc.querySelector("#epLista").innerHTML.indexOf("Escola Perfeita") === -1,
    "quem está em dia não entra na lista de pendência");

  /* ────────────────────────────────────────────────────────────────────
     2. CLICAR NUM CARD FILTRA — e os outros seis não mudam
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Clicar no card");

  const antesDosCards = {};
  Object.keys(backend.resumo).forEach(function (k) { antesDosCards[k] = valorDoCard(k); });

  t.clicar('.ep-card[data-tipo="SEM_SITUACAO"]');
  await t.assentar();

  b.passo("8. O clique virou uma chamada com o tipo filtrado");
  const ultima = t.chamadas[t.chamadas.length - 1];
  b.ok(ultima.fn === "escolasPendenciasListar" && ultima.args[0].tipo === "SEM_SITUACAO",
    "a tela pediu ao servidor só esse tipo", JSON.stringify(ultima.args[0]));

  b.passo("9. A lista encolheu para as escolas daquele tipo");
  const linhasFiltro = t.doc.querySelectorAll("#epLista tbody tr");
  b.ok(linhasFiltro.length === backend.resumo.SEM_SITUACAO && linhasFiltro.length > 0,
    "lista bate com o número do card", "linhas=" + linhasFiltro.length);

  b.passo("10. E OS SETE CARDS CONTINUAM COM OS MESMOS NÚMEROS");
  /* O passo mais importante desta tela. Se os cards seguissem o filtro,
   * clicar num deles zeraria os outros seis e a pessoa acreditaria ter
   * resolvido o que só escondeu. */
  const depoisDosCards = {};
  Object.keys(backend.resumo).forEach(function (k) { depoisDosCards[k] = valorDoCard(k); });
  b.igual(depoisDosCards, antesDosCards,
    "filtrar não mexe na medição");

  b.passo("11. Clicar no mesmo card de novo desliga o filtro");
  t.clicar('.ep-card[data-tipo="SEM_SITUACAO"]');
  await t.assentar();
  b.ok(t.chamadas[t.chamadas.length - 1].args[0].tipo === "",
    "o segundo clique limpa", JSON.stringify(t.chamadas[t.chamadas.length - 1].args[0]));

  /* ────────────────────────────────────────────────────────────────────
     3. BUSCA
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Busca");

  b.passo("12. Digitar espera a pessoa parar (debounce), não dispara por letra");
  const antesDeDigitar = t.chamadas.length;
  t.digitar("#epBusca", "a");
  t.digitar("#epBusca", "an");
  t.digitar("#epBusca", "anj");
  t.digitar("#epBusca", "anjo");
  await t.assentar(50);
  b.ok(t.chamadas.length === antesDeDigitar,
    "quatro teclas, nenhuma chamada ainda",
    "chamadas=" + (t.chamadas.length - antesDeDigitar));

  await t.assentar(400);
  b.passo("13. Passados os 350ms, foi UMA chamada só");
  b.ok(t.chamadas.length === antesDeDigitar + 1 &&
       t.chamadas[t.chamadas.length - 1].args[0].busca === "anjo",
    "uma chamada, com o texto inteiro",
    "chamadas=" + (t.chamadas.length - antesDeDigitar));

  b.passo("14. E a lista mostra só a escola buscada");
  const htmlBusca = t.doc.querySelector("#epLista").innerHTML;
  b.ok(htmlBusca.indexOf("Anjo Azul") > -1 && htmlBusca.indexOf("Brilho de Sol") === -1,
    "achou a Anjo Azul e escondeu o resto");

  b.passo("15. Os cards continuam intactos com a busca ligada");
  const comBusca = {};
  Object.keys(backend.resumo).forEach(function (k) { comBusca[k] = valorDoCard(k); });
  b.igual(comBusca, antesDosCards, "buscar também não mexe na medição");

  b.passo("16. Busca por e-mail funciona — o motivo de ela ser no servidor");
  t.digitar("#epBusca", "ceibrilhodesol");
  await t.assentar(400);
  const htmlEmail = t.doc.querySelector("#epLista").innerHTML;
  b.ok(htmlEmail.indexOf("Brilho de Sol") > -1 && htmlEmail.indexOf("Anjo Azul") === -1,
    "achou pelo e-mail, que a tela sozinha não teria");

  b.passo("17. Busca sem resultado NÃO diz que está tudo certo");
  t.digitar("#epBusca", "zzzznaoexiste");
  await t.assentar(400);
  const vazio = t.doc.querySelector("#epLista").textContent;
  b.ok(/Nenhuma escola com pendência casa com/.test(vazio) && !/estão completas/.test(vazio),
    "não achar é diferente de não haver pendência",
    vazio.slice(0, 80));

  b.passo("18. Limpar filtros volta tudo ao começo");
  t.clicar("#epBtnTudo");
  await t.assentar();
  const argsLimpo = t.chamadas[t.chamadas.length - 1].args[0];
  b.ok(argsLimpo.busca === "" && argsLimpo.tipo === "" && argsLimpo.pagina === 1 &&
       t.doc.querySelector("#epBusca").value === "",
    "busca, tipo, página e o campo na tela", JSON.stringify(argsLimpo));

  /* ────────────────────────────────────────────────────────────────────
     4. PAGINAÇÃO
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Paginação");

  b.passo("19. O contador diz em que página está e quantas existem");
  const rodape = t.texto("#epPaginacao");
  b.ok(/Página 1 de 2/.test(rodape) && /1–50 de 63/.test(rodape),
    "'Página 1 de 2 · 1–50 de 63'", rodape);

  b.passo("20. 'Primeira' e 'Anterior' nascem desligadas na página 1");
  const bts = t.doc.querySelectorAll("#epPaginacao .ep-pag");
  b.ok(bts[0].disabled === true && bts[1].disabled === true &&
       bts[2].disabled === false && bts[3].disabled === false,
    "não dá para voltar do começo");

  b.passo("21. Clicar em 'Próxima' vai para a página 2");
  t.clicar(bts[2]);
  await t.assentar();
  b.ok(t.chamadas[t.chamadas.length - 1].args[0].pagina === 2 &&
       /Página 2 de 2/.test(t.texto("#epPaginacao")),
    "pediu a página 2 e o contador acompanhou", t.texto("#epPaginacao"));

  b.passo("22. A página 2 traz o resto — 13, não 50");
  b.ok(t.doc.querySelectorAll("#epLista tbody tr").length === 13,
    "63 = 50 + 13", "linhas=" + t.doc.querySelectorAll("#epLista tbody tr").length);

  b.passo("23. E as escolas da página 2 são outras");
  const idsP2 = Array.prototype.map.call(t.doc.querySelectorAll("#epLista tbody tr"),
    function (tr) { return tr.textContent.match(/ESC-\d+/)[0]; });
  t.clicar(t.doc.querySelectorAll("#epPaginacao .ep-pag")[0]);   // « Primeira
  await t.assentar();
  const idsP1 = Array.prototype.map.call(t.doc.querySelectorAll("#epLista tbody tr"),
    function (tr) { return tr.textContent.match(/ESC-\d+/)[0]; });
  b.ok(idsP2.every(function (id) { return idsP1.indexOf(id) === -1; }),
    "nenhuma escola aparece nas duas páginas");

  b.passo("24. Filtrar estando na página 2 volta para a PÁGINA 1");
  /* O caso real: a pessoa está na 2, clica num card com poucos resultados.
   *
   * O servidor sozinho já evita a tela em branco — ele corrige a página para
   * a última existente. Mas isso deixaria a pessoa na ÚLTIMA página do
   * resultado filtrado, sem ter visto a primeira. Por isso a tela também
   * zera a página ao filtrar, e é isso que este passo exige.
   *
   * Escrito assim porque a primeira versão só checava "veio lista, não
   * branco" — e uma mutação que removesse o `epPagina = 1` da tela
   * sobreviveu, escondida pela correção do servidor. */
  t.clicar(t.doc.querySelectorAll("#epPaginacao .ep-pag")[2]);   // Próxima → pág 2
  await t.assentar();
  t.clicar('.ep-card[data-tipo="SEM_TELEFONE"]');
  await t.assentar();
  const pedidoAoFiltrar = t.chamadas[t.chamadas.length - 1].args[0];
  b.ok(pedidoAoFiltrar.pagina === 1 && t.doc.querySelectorAll("#epLista tbody tr").length > 0 &&
       /Página 1 de/.test(t.texto("#epPaginacao") || "Página 1 de 1"),
    "quem filtra quer ver do começo, não a última página do filtro",
    "pediu pagina=" + pedidoAoFiltrar.pagina);

  t.clicar('.ep-card[data-tipo="SEM_TELEFONE"]');
  await t.assentar();

  /* ────────────────────────────────────────────────────────────────────
     4b. CORRIDA — resposta velha não pode passar na frente da nova
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Duas buscas ao mesmo tempo");

  b.passo("24b. A resposta ATRASADA de uma busca antiga é descartada");
  /* Digitar "anjo", o servidor demorar, e no meio disso a pessoa trocar para
   * "brilho". A resposta de "anjo" chega DEPOIS. Se a tela a aceitasse,
   * mostraria a Anjo Azul com "brilho" escrito no campo de busca.
   *
   * É o defeito que o `if(epCarregando) return` original tinha na forma
   * oposta — ele descartava a busca nova. Trocado por numeração de chamada,
   * que resolve os dois lados; este passo prova o lado difícil. */
  const antesDaCorrida = t.chamadas.length;
  /* 1200ms de atraso na chamada de "anjo": tem que ser MAIOR que a soma das
   * esperas abaixo, senão ela responde antes de "brilho" ser digitado e a
   * corrida nunca acontece. Na primeira versão eu pus 300ms contra um
   * `assentar(400)` — a resposta chegava na hora certa, o teste passava, e
   * uma mutação que removesse o descarte sobrevivia. */
  t.atrasar("escolasPendenciasListar", antesDaCorrida, 900);
  t.digitar("#epBusca", "anjo");
  await t.assentar(400);              // passa o debounce, a chamada lenta sai
  t.digitar("#epBusca", "brilho");
  await t.assentar(400);              // a de "brilho" sai e responde rápido

  b.ok(t.doc.querySelector("#epLista").innerHTML.indexOf("Brilho de Sol") > -1,
    "antes da atrasada chegar, a tela já mostra a busca nova");

  await t.assentar(900);              // agora chega a de "anjo", atrasada

  const htmlCorrida = t.doc.querySelector("#epLista").innerHTML;
  b.ok(htmlCorrida.indexOf("Brilho de Sol") > -1 && htmlCorrida.indexOf("Anjo Azul") === -1,
    "a tela ficou com o resultado da busca mais nova",
    htmlCorrida.indexOf("Anjo Azul") > -1 ? "a resposta velha sobrescreveu" : "ok");

  t.clicar("#epBtnTudo");
  await t.assentar();

  /* ────────────────────────────────────────────────────────────────────
     5. ORDEM A a Z
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Ordem alfabética");

  b.passo("25. Escolher 'A a Z' manda a ordem para o servidor");
  t.escolher("#epOrdem", "AZ");
  await t.assentar();
  b.ok(t.chamadas[t.chamadas.length - 1].args[0].ordem === "AZ" &&
       t.chamadas[t.chamadas.length - 1].args[0].pagina === 1,
    "ordem AZ e volta para a página 1",
    JSON.stringify(t.chamadas[t.chamadas.length - 1].args[0]));

  b.passo("26. E a lista sai realmente em ordem alfabética");
  function nomesNaTela() {
    return Array.prototype.map.call(t.doc.querySelectorAll("#epLista tbody tr"),
      function (tr) { return tr.querySelector("td div").textContent.trim(); });
  }
  const az = nomesNaTela();
  const azOrdenado = az.slice().sort(function (x, y) {
    return x.localeCompare(y, "pt-BR");
  });
  b.igual(az, azOrdenado, "a página 1 está em ordem", "primeira: " + az[0]);

  b.passo("27. A ordem vale para a FILA INTEIRA, não só para a página");
  /* Se a ordenação fosse na tela, o "A" da página 1 seria só o primeiro das
   * 50 que por acaso vieram. Aqui a primeira da fila em A–Z tem que ser a
   * primeira das 63. */
  const todasAZ = g.escolasPendenciasListar({ ordem: "AZ", porPagina: 200 }, ADM);
  b.ok(az[0] === todasAZ.escolas[0].nome,
    "a primeira da tela é a primeira das 63, não das 50",
    az[0] + " vs " + todasAZ.escolas[0].nome);

  b.passo("28. Z a A inverte");
  t.escolher("#epOrdem", "ZA");
  await t.assentar();
  b.ok(nomesNaTela()[0] === "Zumbi dos Palmares",
    "a última em A–Z vira a primeira", nomesNaTela()[0]);

  t.escolher("#epOrdem", "GRAVIDADE");
  await t.assentar();

  /* ────────────────────────────────────────────────────────────────────
     6. ABRIR NO CADASTRO — o pedido do usuário
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Abrir no Cadastro vai NA ESCOLA");

  /* As duas telas juntas na mesma janela, como no index.html. */
  const j = d.montar(g, ["PendenciasAdmin.html", "CadastroEscolas.html"], { token: ADM });
  j.win.initEscolasPendencias();
  await j.assentar();

  b.passo("29. O Cadastro expõe a porta de entrada");
  b.ok(typeof j.win.ceAbrirEscolaPorChave === "function",
    "ceAbrirEscolaPorChave existe — sem ela o botão não teria para onde ir");

  b.passo("30. O botão da linha carrega o EscolaID, não só o nome");
  const btnAbrir = j.doc.querySelector("#epLista .ep-abrir");
  const chave = btnAbrir && btnAbrir.getAttribute("data-chave");
  b.ok(/^ESC-\d+$/.test(String(chave)),
    "a identidade é que viaja, não um texto que muda", String(chave));

  b.passo("31. Clicar abre a ficha DAQUELA escola");
  const nomeEsperado = j.doc.querySelector("#epLista tbody tr td div").textContent.trim();
  j.win.initCadastroEscolas();
  await j.assentar(60);
  j.clicar(btnAbrir);
  await j.assentar(600);          // a base do cadastro carrega assíncrona

  const campoNome = j.doc.querySelector("#ceEscola, #ceNomeEscola, [name='escola']");
  const preenchido = campoNome ? String(campoNome.value || "").trim() : "";
  b.ok(preenchido === nomeEsperado,
    "o formulário abriu com a escola da linha clicada",
    "esperado '" + nomeEsperado + "', no campo '" + preenchido + "'");

  b.passo("32. E entrou em modo EDIÇÃO, não em cadastro novo");
  /* Se abrisse como novo, salvar criaria uma escola duplicada em vez de
   * corrigir a que tem pendência. */
  const btnSalvar = j.doc.querySelector("#btnCeSalvar");
  b.ok(btnSalvar && /Atualizar/i.test(btnSalvar.textContent),
    "o botão diz Atualizar, não Salvar",
    btnSalvar ? btnSalvar.textContent.trim() : "botão não existe");

  b.passo("33. A aba visível passou a ser a de Cadastrar / Editar");
  const abaCad = j.doc.querySelector('[data-tab="ceTabCadastro"]');
  b.ok(abaCad && abaCad.classList.contains("ativo"),
    "trocou de aba sozinho — a pessoa não precisa procurar");

  b.passo("33b. Funciona mesmo clicando ANTES de a base do Cadastro carregar");
  /* O caso real, e o único que importa: quem vem das Pendências chega ao
   * Cadastro antes do google.script.run dele responder. Se a função não
   * esperasse o CE_CACHE, ela acharia a lista vazia e desistiria — e o botão
   * só funcionaria quando o Cadastro já estivesse aberto, que é justamente
   * quando ninguém precisa dele.
   *
   * A primeira versão deste teste chamava initCadastroEscolas e esperava
   * 60ms antes de clicar, então a espera nunca era exercitada: uma mutação
   * que a removesse passava batido. Aqui a janela é nova e o clique é
   * imediato. */
  const z = d.montar(g, ["CadastroEscolas.html"], { token: ADM });
  z.win.initCadastroEscolas();          // dispara o carregamento…
  const pediu = z.win.ceAbrirEscolaPorChave("ESC-000090");   // …e pede NO MESMO INSTANTE

  /* Nenhum `assentar` antes desta linha, de propósito: qualquer espera aqui
   * deixaria o CE_CACHE encher e a função nunca precisaria aguardar. Foi
   * assim que a primeira versão deste passo passou com a espera removida. */
  b.ok(pediu === true, "aceitou o pedido mesmo com a base ainda vazia");

  await z.assentar(1200);
  const campoZ = z.doc.querySelector("#ceEscola, #ceNomeEscola, [name='escola']");
  b.ok(campoZ && String(campoZ.value || "").trim() === "Pré-escola Anjo Azul",
    "esperou a base chegar e abriu a escola certa",
    "no campo: '" + (campoZ ? campoZ.value : "(sem campo)") + "'");

  b.passo("34. Chave inexistente avisa, em vez de não fazer nada");
  const abriu = j.win.ceAbrirEscolaPorChave("ESC-999999");
  await j.assentar(60);
  const caixa = j.doc.querySelector("#ceMsgBox");
  b.ok(abriu === false && caixa && /Não encontrei/.test(caixa.textContent),
    "botão que não responde é o pior desfecho — aqui ele explica",
    caixa ? caixa.textContent.trim().slice(0, 70) : "sem caixa de mensagem");

  /* ────────────────────────────────────────────────────────────────────
     7. QUANDO O SERVIDOR RECUSA
     ──────────────────────────────────────────────────────────────────── */
  b.fluxo("TELA · Erro do servidor");

  const semSessao = d.montar(g, ["PendenciasAdmin.html"], { token: "" });
  semSessao.win.initEscolasPendencias();
  await semSessao.assentar(60);

  b.passo("35. Sem sessão, a tela mostra o motivo — não fica carregando para sempre");
  const est = semSessao.texto("#epEstado") || "";
  b.ok(/Erro ao carregar|Sessão inválida|recusou/i.test(est) &&
       semSessao.texto("#epResumo") !== "Carregando…",
    "a recusa do backend chega na tela em português",
    est.slice(0, 90));

  const c = b.resumo();
  process.exit(c.FALHOU ? 1 : 0);
})().catch(function (e) {
  console.error("\n\x1b[31mO TESTE DE TELA QUEBROU:\x1b[0m", e && e.stack || e);
  process.exit(1);
});
