/**
 * A ABA APONTA, O PAINEL OBEDECE — E O TESTE PROVA QUE OS DOIS FALAM A MESMA
 * LÍNGUA
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. A tela de Eventos ganhou cinco abas, e a aba "Participantes"
 * abre este painel já apontado para um estado:
 *
 *     evAbrirPainel('compasso', '', 'participantes')
 *     evAbrirPainel('compasso', '', 'a-enviar')
 *
 * O botão foi escrito, o `&filtro=` foi para a URL — e NADA do outro lado lia
 * esse parâmetro. Os dois botões abriam a lista inteira. Não quebrava, não dava
 * erro: só mostrava a lista errada, que é o defeito mais caro de achar, porque
 * a tela parece funcionar.
 *
 * É UM DEFEITO DE COSTURA, E É O QUE ESTE TESTE GUARDA
 *
 * Ninguém erra isso lendo um arquivo só. Quem lê EventosAdmin.html vê um botão
 * que passa um filtro; quem lê CompassoInscricoes.html vê um painel coerente.
 * O buraco está EXATAMENTE no meio, e é por isso que a asserção central deste
 * arquivo cruza os dois lados:
 *
 *     todo `filtro=` que a tela de Eventos manda tem de existir na tabela
 *     FILTROS_URL do painel que recebe.
 *
 * Essa é a asserção que teria pego o defeito no dia em que ele nasceu. As
 * outras protegem o comportamento; esta protege a costura.
 *
 * DUAS CORREÇÕES DE BACKEND ENTRAM JUNTO
 *
 *   1. COM_INGRESSO não existia. Havia SEM_INGRESSO e não o complemento, então
 *      "participante" (quem tem ingresso) só existia como a soma de dois cards.
 *
 *   2. O card "A analisar" NUNCA FILTROU. Ele levava f:{status:''}, e a
 *      mesclagem de filtros descarta valor vazio — clicar acendia o card e
 *      devolvia a lista inteira. Achado ao ler o caminho do filtro para
 *      escrever este teste. Agora é a sentinela 'NAO_ANALISADA', porque status
 *      vazio não dá para pedir por igualdade: string vazia é indistinguível de
 *      "não filtrar".
 *
 * MUTAÇÕES MATADAS (21/08/2026) — 8 de 8, nenhuma sobrevivente
 *
 *   1. o painel parar de ler o parâmetro do endereço ........... 1 falha
 *   2. aceitar qualquer slug, inclusive desconhecido ........... 1 falha
 *   3. COM_INGRESSO deixar de filtrar ......................... 2 falhas
 *   4. a sentinela NAO_ANALISADA voltar a ser igualdade ....... 1 falha
 *   5. "Limpar" não limpar o filtro do endereço ............... 2 falhas
 *   6. o card perder a precedência sobre o endereço ........... 1 falha
 *   7. o chip sumir da tela (filtro invisível) ................ 1 falha
 *   8. a aba mandar um slug que o painel não conhece .......... 1 falha
 *
 * O QUE A MUTAÇÃO CORRIGIU NO PRÓPRIO TESTE
 *
 * Duas sobreviveram na primeira rodada, e as duas pelo mesmo motivo: o teste
 * chamava `lerFiltroUrl()` na mão e media só o que vinha depois.
 *
 *   MUTAÇÃO 1 sobreviveu porque apagar a chamada de partida do painel não
 *   afetava em nada um teste que faz a chamada por conta própria. Ou seja: o
 *   painel podia parar de ler o endereço na tela de verdade, e as 5 asserções
 *   sobre o filtro continuavam verdes. Foi preciso uma asserção sobre a
 *   PARTIDA — as linhas depois da última função, que é onde o script começa a
 *   rodar — exigindo lerFiltroUrl() antes de carregar().
 *
 *   MUTAÇÃO 2 sobreviveu porque eu media o slug desconhecido só pelo filtro
 *   resultante, que continuava vazio. O que a mutação de fato estragava era o
 *   CHIP: passava a anunciar um filtro que não existe. A asserção nova mede o
 *   chip, não o filtro.
 *
 * Nas duas, o teste media o efeito e não a ligação. É o mesmo erro que deixou
 * o defeito original passar.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const val     = semComentario(ler("EventosValidacao.gs"));
const painel  = ler("CompassoInscricoes.html");
const eventos = ler("EventosAdmin.html");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return codigo.slice(m.index + m[0].length, i - 1);
}

fluxo("FILTRO PELO ENDEREÇO · a aba aponta, o painel obedece");

/* ─────────────────────────────────────────────────────────────────────────────
   1. O BACKEND FILTRA DE VERDADE

   Roda compasso_validacaoListar_interno_ contra uma base de mentira. Nada de
   procurar string no arquivo: a contagem é que responde.
   ───────────────────────────────────────────────────────────────────────────*/
passo("o backend, executado contra registros de mentira");

const EVENTO = "COMPASSO2026";
const BASE = [
  /* validada, ingresso emitido, JÁ enviada */
  {inscricaoId:"i1", eventoId:EVENTO, nome:"Ana",   status:"VALIDADA_ADMINISTRATIVAMENTE",
   ingressoId:"g1", entregaCanais:"EMAIL", escola:"EEEFM Central", cidade:"Vitória"},
  /* validada, ingresso emitido, AINDA NÃO enviada */
  {inscricaoId:"i2", eventoId:EVENTO, nome:"Bruno", status:"VALIDADA_ADMINISTRATIVAMENTE",
   ingressoId:"g2", entregaCanais:"",      escola:"EEEFM Central", cidade:"Vitória"},
  /* validada, SEM ingresso */
  {inscricaoId:"i3", eventoId:EVENTO, nome:"Célia", status:"VALIDADA_ADMINISTRATIVAMENTE",
   ingressoId:"",   entregaCanais:"",      escola:"EMEF Norte",    cidade:"Serra"},
  /* nunca analisada: status vazio */
  {inscricaoId:"i4", eventoId:EVENTO, nome:"Diego", status:"",
   ingressoId:"",   entregaCanais:"",      escola:"EMEF Norte",    cidade:"Serra"},
  /* nunca analisada também, para a contagem não passar por acaso com 1 */
  {inscricaoId:"i5", eventoId:EVENTO, nome:"Elza",  status:"",
   ingressoId:"",   entregaCanais:"",      escola:"EEEFM Sul",     cidade:"Vila Velha"},
  /* pendente: tem status, NÃO é "a analisar" */
  {inscricaoId:"i6", eventoId:EVENTO, nome:"Fábio", status:"PENDENTE",
   ingressoId:"",   entregaCanais:"",      escola:"EEEFM Sul",     cidade:"Vila Velha"},
  /* de OUTRO evento: nunca pode aparecer */
  {inscricaoId:"i7", eventoId:"OUTRO",  nome:"Gil",  status:"",
   ingressoId:"g7", entregaCanais:"",      escola:"EEEFM Sul",     cidade:"Vila Velha"}
];

function listar(filtros) {
  const deps = {
    fs_list_: () => BASE.map(x => Object.assign({}, x)),
    EMISSAO_CFG: { EVENTO_ID: EVENTO },
    compasso_pagamentoDaInscricao_: () => ({}),
    compasso_entregaDaInscricao_: x => ({
      enviado: !!String(x.entregaCanais || ""),
      canais: String(x.entregaCanais || "") ? String(x.entregaCanais).split(",") : []
    })
  };
  const nomes = Object.keys(deps);
  return new Function("filtros", ...nomes,
    corpoDe(val, "compasso_validacaoListar_interno_"))(
      filtros, ...nomes.map(n => deps[n]));
}

const nomesDe = r => r.map(x => x.nome).sort().join(",");

igual(nomesDe(listar({})), "Ana,Bruno,Célia,Diego,Elza,Fábio",
      "sem filtro: as 6 do evento — a de outro evento fica fora",
      "se a de outro evento entrar, todo o resto da contagem mente");

/* MUTAÇÃO 3: tirar o ramo COM_INGRESSO faz esta cair. */
igual(nomesDe(listar({ entrega: "COM_INGRESSO" })), "Ana,Bruno",
      "COM_INGRESSO → só quem tem ingresso emitido (enviado ou não)",
      "é o que a aba Participantes pede: quem já é participante de fato");

igual(nomesDe(listar({ entrega: "SEM_INGRESSO" })), "Célia,Diego,Elza,Fábio",
      "SEM_INGRESSO é o complemento exato — os dois somam a lista inteira");

igual(listar({ entrega: "COM_INGRESSO" }).length +
      listar({ entrega: "SEM_INGRESSO" }).length,
      listar({}).length,
      "com + sem = total: nenhuma inscrição cai no vão entre os dois");

igual(nomesDe(listar({ entrega: "A_ENVIAR" })), "Bruno",
      "A_ENVIAR → tem ingresso e ainda não saiu");

igual(nomesDe(listar({ entrega: "ENVIADA" })), "Ana",
      "ENVIADA → já saiu por algum canal");

/* MUTAÇÃO 4: trocar a sentinela por comparação de igualdade faz estas duas
   caírem. Antes eu procurava a string no arquivo, e `if (false)` sobrevivia. */
igual(nomesDe(listar({ status: "NAO_ANALISADA" })), "Diego,Elza",
      "NAO_ANALISADA → só quem ainda não tem status gravado",
      "o card 'A analisar' devolvia a lista inteira antes desta sentinela");

ok(nomesDe(listar({ status: "NAO_ANALISADA" })).indexOf("Fábio") < 0,
   "e PENDENTE não conta como 'a analisar' — já foi analisada",
   "se contar, a fila de trabalho da secretaria mostra número inflado");

igual(nomesDe(listar({ status: "PENDENTE" })), "Fábio",
      "filtro por status normal continua funcionando ao lado da sentinela");

igual(nomesDe(listar({ status: "" })), "Ana,Bruno,Célia,Diego,Elza,Fábio",
      "status vazio continua querendo dizer 'não filtre'",
      "é a ambiguidade que obrigou a sentinela a existir");

igual(nomesDe(listar({ entrega: "COM_INGRESSO", escola: "central" })), "Ana,Bruno",
      "COM_INGRESSO combina com os outros filtros, não os substitui");

/* ─────────────────────────────────────────────────────────────────────────────
   2. O PAINEL LÊ O ENDEREÇO

   Executa lerFiltroUrl() e filtros() do HTML com um location de mentira.
   ───────────────────────────────────────────────────────────────────────────*/
passo("o painel, executado com um endereço de mentira");

const scriptPainel = (painel.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
ok(scriptPainel.length > 500, "o bloco de script do painel foi extraído");

/* Monta o ambiente do painel: pega só as partes que interessam (a tabela, a
   leitura do endereço e a montagem dos filtros) e injeta DOM de mentira. */
function ambientePainel(search) {
  const trechos = [
    (scriptPainel.match(/var FILTROS_URL = \{[\s\S]*?\n\};/) || [])[0],
    "var FILTRO_URL = null;",
    "var FILTRO_CARD = '';",
    (scriptPainel.match(/var CARDS = \[[\s\S]*?\n\];/) || [])[0],
    "function lerFiltroUrl(){" + corpoDe(scriptPainel, "lerFiltroUrl") + "}",
    "function limpar(){" + corpoDe(scriptPainel, "limpar") + "}",
    "function filtros(){" + corpoDe(scriptPainel, "filtros") + "}"
  ].filter(Boolean).join("\n");

  const campos = {};
  const visivel = { chipUrl: "none", chipUrlTexto: "" };
  const g = id => ({
    get value(){ return campos[id] || ""; },
    set value(v){ campos[id] = v; },
    get textContent(){ return visivel[id] || ""; },
    set textContent(v){ visivel[id] = v; },
    style: { get display(){ return visivel[id]; }, set display(v){ visivel[id] = v; } }
  });
  /* g() precisa devolver SEMPRE o mesmo objeto por id, senão o style escrito
     em um se perde no próximo. */
  const cache = {};
  const gEstavel = id => (cache[id] = cache[id] || g(id));

  const api = new Function("g", "location", "carregar",
    trechos + "\nreturn {lerFiltroUrl:lerFiltroUrl,filtros:filtros,limpar:limpar," +
    "chip:function(){return {display:g('chipUrl').style.display," +
    "texto:g('chipUrlTexto').textContent};}," +
    "card:function(i){FILTRO_CARD=String(i);}};")(
      gEstavel, { search: search }, function(){});
  return api;
}

/* MUTAÇÃO 1: apagar a chamada de lerFiltroUrl, ou o corpo dela, faz as três
   próximas caírem. */
const pParticipantes = ambientePainel("?sessao=abc&filtro=participantes");
pParticipantes.lerFiltroUrl();
igual(pParticipantes.filtros().entrega, "COM_INGRESSO",
      "?filtro=participantes → o painel pede COM_INGRESSO ao servidor",
      "era exatamente isto que não acontecia: o botão mandava, ninguém lia");

const pAEnviar = ambientePainel("?sessao=abc&filtro=a-enviar");
pAEnviar.lerFiltroUrl();
igual(pAEnviar.filtros().entrega, "A_ENVIAR",
      "?filtro=a-enviar → A_ENVIAR");

const pAnalisar = ambientePainel("?sessao=abc&filtro=a-analisar");
pAnalisar.lerFiltroUrl();
igual(pAnalisar.filtros().status, "NAO_ANALISADA",
      "?filtro=a-analisar → a sentinela, não string vazia");

/* MUTAÇÃO 2: aceitar slug desconhecido faz esta cair. */
const pInventado = ambientePainel("?sessao=abc&filtro=slug-que-nao-existe");
pInventado.lerFiltroUrl();
igual(pInventado.filtros().entrega, undefined,
      "slug desconhecido é ignorado e a tela abre completa",
      "link velho ou digitado errado não pode devolver lista vazia sem explicação");

igual(pInventado.chip().display, "none",
      "e o chip NÃO aparece para slug desconhecido",
      "chip sem filtro atrás seria pior que nada: diz que a lista está filtrada quando não está");

const pSemFiltro = ambientePainel("?sessao=abc");
pSemFiltro.lerFiltroUrl();
igual(pSemFiltro.filtros().entrega, undefined,
      "sem parâmetro nenhum: nada muda");

/* MUTAÇÃO 1: tudo acima chama lerFiltroUrl() na mão. Se o painel parar de
   chamá-la sozinho ao abrir, nada disso acontece na tela de verdade — e as
   asserções acima continuariam passando. Esta é a que guarda a ligação.

   Olha só a partida do painel: as linhas depois da última função. É onde o
   script de fato começa a rodar, e é o único lugar onde uma chamada a
   lerFiltroUrl() significa "acontece quando a tela abre". */
const topo = (function(){
  const linhas = scriptPainel.split("\n");
  let ultima = -1;
  linhas.forEach((l, i) => { if (l === "}") ultima = i; });
  return linhas.slice(ultima + 1).join("\n");
})();
const posLer  = topo.indexOf("lerFiltroUrl();");
const posCarr = topo.indexOf("carregar();");
ok(posLer >= 0 && posCarr >= 0 && posLer < posCarr,
   "ao abrir, o painel chama lerFiltroUrl() ANTES de carregar()",
   "se ler depois, a primeira lista vem sem filtro e pisca a lista inteira");

/* MUTAÇÃO 7: o chip é o que torna o filtro visível. Sem ele, a pessoa vê uma
   lista curta e conclui que sumiu inscrição. */
igual(pParticipantes.chip().display, "block",
      "o filtro do endereço aparece na tela como chip",
      "lista filtrada em silêncio é o que faz alguém achar que perdeu dado");
ok(pParticipantes.chip().texto.length > 0,
   "e o chip diz qual filtro é: " + pParticipantes.chip().texto);

/* MUTAÇÃO 5: "Limpar" tem de limpar TUDO. */
pParticipantes.limpar();
igual(pParticipantes.filtros().entrega, undefined,
      "'Limpar' derruba também o filtro que veio pelo endereço",
      "senão a pessoa limpa, continua vendo lista curta e não tem como saber por quê");
igual(pParticipantes.chip().display, "none",
      "e o chip some junto");

/* MUTAÇÃO 6: precedência. O card é o gesto explícito da pessoa naquele
   momento; o endereço é de quando a tela abriu. */
const pPrecedencia = ambientePainel("?sessao=abc&filtro=participantes");
pPrecedencia.lerFiltroUrl();
const iSemIngresso = (function(){
  const cards = pPrecedencia.filtros; /* só para manter o escopo vivo */
  return 4; /* índice de 'Sem ingresso' em CARDS */
})();
pPrecedencia.card(iSemIngresso);
igual(pPrecedencia.filtros().entrega, "SEM_INGRESSO",
      "clicar um card manda mais que o filtro do endereço",
      "o gesto de agora vence o link de dez minutos atrás");

/* ─────────────────────────────────────────────────────────────────────────────
   3. A COSTURA — a asserção que teria pego o defeito no dia em que nasceu
   ───────────────────────────────────────────────────────────────────────────*/
passo("os dois lados falam a mesma língua");

/* O que a tela de Eventos MANDA. */
const mandados = [];
const reChamada = /evAbrirPainel\(\s*'compasso'\s*,\s*'[^']*'\s*,\s*'([^']+)'\s*\)/g;
let m;
while ((m = reChamada.exec(eventos)) !== null) mandados.push(m[1]);

ok(mandados.length >= 2,
   "a tela de Eventos manda " + mandados.length + " filtro(s): " + mandados.join(", "),
   "se um dia parar de mandar nenhum, esta asserção avisa em vez de passar vazia");

/* O que o painel CONHECE. */
const tabela = (scriptPainel.match(/var FILTROS_URL = \{[\s\S]*?\n\};/) || [])[0] || "";
const conhecidos = (tabela.match(/'([a-z-]+)':\s*\{/g) || [])
  .map(s => s.replace(/'([a-z-]+)'.*/, "$1"));

ok(conhecidos.length >= 3,
   "o painel conhece " + conhecidos.length + " slug(s): " + conhecidos.join(", "));

/* MUTAÇÃO 8: mudar o slug em qualquer um dos dois lados faz esta cair. É a
   asserção central deste arquivo. */
const orfaos = mandados.filter(s => conhecidos.indexOf(s) < 0);
igual(orfaos.join(",") || "(nenhum)", "(nenhum)",
      "todo filtro que a aba manda existe na tabela do painel",
      "esta é a asserção que teria pego o defeito no dia em que ele nasceu: " +
      "o botão passava 'participantes' e o painel não lia parâmetro nenhum");

/* E o caminho de volta: um slug conhecido que ninguém usa não é defeito, mas
   vale ser dito, porque é onde mora código que se acha vivo e não está. */
const naoUsados = conhecidos.filter(s => mandados.indexOf(s) < 0);
ok(true,
   naoUsados.length
     ? "slugs prontos e ainda sem botão: " + naoUsados.join(", ")
     : "todo slug conhecido tem botão que o use",
   "não é falha: são atalhos que funcionam por URL antes de virarem botão");

/* A rota tem de existir do outro lado, senão o link não abre nada. */
ok(/painel === "compasso"/.test(ler("Code.gs")),
   "a rota ?painel=compasso existe em Code.gs",
   "sem ela o botão abre uma aba em branco");

resumo();
