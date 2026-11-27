/**
 * TODAS AS TELAS DO MÓDULO DE EVENTOS, ABERTAS UMA A UMA
 *
 * O QUE ORIGINOU
 *
 * 25/08/2026, o usuário: *"Tem que testar todas desse módulo"*. Ele disse isso
 * depois de achar, clicando, quatro defeitos que nenhuma das minhas 867
 * asserções tinha tocado — e a razão era sempre a mesma: os testes executavam
 * os `.gs` e LIAM os `.html`. Nenhum abria uma tela.
 *
 * O QUARTO DEFEITO, que este arquivo existe para nunca mais deixar passar:
 *
 *   `evTelaInterno` revelava o conteúdo varrendo um array escrito à mão:
 *
 *     ['calendario','informacoes','inscricoes','participantes',
 *      'credenciamento','sorteios']
 *
 *   Faltavam DOIS — 'painel' e 'executivo', que são justamente as telas do
 *   submódulo Painel. A aba acendia, o bloco continuava escondido, e a área
 *   ficava em branco. Uma lista paralela com entrada esquecida, exatamente
 *   como o mapa de submódulos do index.html no mesmo dia.
 *
 * O QUE ESTE TESTE FAZ
 *
 * Percorre `EV_SUBMODULOS` inteiro — todo submódulo, toda tela — e para cada
 * uma exige três coisas:
 *
 *   1. o container certo fica VISÍVEL;
 *   2. todos os outros ficam escondidos;
 *   3. abrir não estoura exceção.
 *
 * O ponto de escrever assim, em vez de listar as telas à mão: se alguém
 * acrescentar uma tela nova ao mapa, ela entra no teste sozinha. Uma lista
 * paralela aqui repetiria o defeito que o teste existe para pegar.
 */
const b = require("./base");
const dom = require("./dom");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = b;

fluxo("EVENTOS · todas as telas do módulo, abertas uma a uma");

if (!dom.jsdomDisponivel()) {
  naoTestavel("as telas do módulo de Eventos",
              "jsdom não está instalado neste ambiente — `npm i jsdom` para rodar");
  resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const BANCO = new Map();
const clonar = o => JSON.parse(JSON.stringify(o));
g.fs_set_ = (c, i, o) => { BANCO.set(c + "/" + i, clonar(o)); return { ok: true }; };
g.fs_get_ = (c, i) => { const v = BANCO.get(c + "/" + i); return v ? clonar(v) : null; };
g.fs_list_ = c => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(c + "/") === 0) o.push(clonar(v)); }); return o; };
g.fs_queryEquals_ = (c, campo, v) => g.fs_list_(c).filter(d => String(d[campo]) === String(v));
g.bingo_queryEquals_ = () => [];

g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

g.fs_set_("inscricoesEventos", "INS-1", {
  inscricaoId: "INS-1", eventoId: g.EMISSAO_CFG.EVENTO_ID,
  nome: "Maria Aparecida da Silva", cpf: "11144477735", escola: "EMEF Castelo Branco",
  cidade: "Vitória", status: "", criadoEm: new Date(), vagaReservada: true,
  email: "maria@exemplo.com", whatsapp: "27998765432" });

/* A tela de Eventos INCLUI a Central — a mesma ordem do index.html:663. */
const tela = dom.montar(g, ["EventosAdmin.html", "CompassoInscricoes.html"], { token: "" });
tela.win.SISGEP_TOKEN_SESSAO = TOKEN;

/* ══════════════════════════════════════════════════════════════════════════
   1 · NADA ACONTECE ANTES DE A SESSÃO EXISTIR
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · a tela lida não é a tela aberta");

igual(tela.chamadas.filter(c => /^compasso_/.test(c.fn)).length, 0,
      "a Central embutida não chama o backend só por ter sido lida",
      "é o defeito que deixava a Central inteira em 'Sessão inválida'");

(async function () {
  /* A tela tem partida própria: `evIniciar` roda 80 ms depois do
     carregamento e restaura o último submódulo aberto. Sem esperar por ela,
     o primeiro `evSub` do laço era desfeito no meio — e o teste acusava a
     tela de não marcar o submódulo. Era corrida do teste, não defeito. */
  await tela.assentar(200);

  /* ════════════════════════════════════════════════════════════════════════
     2 · CADA SUBMÓDULO ABRE, E ABRE NA PRIMEIRA TELA
     ════════════════════════════════════════════════════════════════════════ */
  passo("2 · os quatro submódulos");

/* O MAPA VEM DA FONTE, NÃO DA JANELA — e isso não é atalho.
     O script de EventosAdmin roda dentro de uma IIFE: `EV_SUBMODULOS` não é
     alcançável de fora, e só o que a tela publica em `window` (evSub, evTela)
     existe para quem a inclui. Isso é bom — superfície pequena. Então o teste
     LÊ o mapa da fonte para saber o que percorrer, e DIRIGE pelos botões,
     que é o caminho do usuário. */
  const fonteAdmin = require("fs").readFileSync(
    require("path").join(dom.RAIZ, "EventosAdmin.html"), "utf8");
  const SUBS = (function(){
    const m = /var EV_SUBMODULOS\s*=\s*\{[\s\S]*?\n\};/.exec(fonteAdmin);
    if (!m) return null;
    /* eslint-disable no-eval */
    return eval("(" + m[0].replace(/^var EV_SUBMODULOS\s*=\s*/, "").replace(/;$/, "") + ")");
  })();
  ok(!!SUBS, "o mapa de submódulos foi lido da fonte");
  const nomes = Object.keys(SUBS || {});
  /* Cinco desde 26/08/2026: Programação virou Eventos (a agenda é modo de
     ver), Bingo Online virou Sorteios (bingo é UM sorteio) e Credenciamento
     saiu de dentro da Festa, porque tem fila e estados próprios. */
  igual(nomes.slice().sort().join(","), "credenciamento,festa,lista,painel,sorteios",
        "são cinco: " + nomes.join(", "));

  for (const sub of nomes) {
    let estourou = "";
    /* POR ONDE A SPA DIRIGE, que é o caminho real.
       A barra de submódulos da tela está escondida de propósito desde 25/08 —
       quem navega é o menu lateral do index.html, e ele chama `window.evSub`.
       Clicar num botão invisível seria testar um caminho que ninguém usa. */
    try { tela.win.evSub(sub); } catch (e) { estourou = e.message; }
    await tela.assentar(40);
    ok(!estourou, "abrir o submódulo '" + sub + "' não estoura", estourou);
    igual(tela.win.document.getElementById("sub-" + sub).getAttribute("aria-selected"),
          "true", "  e ele fica marcado como o atual");

    const abas = tela.win.document.querySelectorAll('#evTelas .ev-tela');
    igual(abas.length, SUBS[sub].length,
          "  com " + SUBS[sub].length + " aba(s) desenhada(s)");
    const primeira = tela.win.document.getElementById("tela-" + SUBS[sub][0].id);
    ok(primeira && primeira.getAttribute("aria-selected") === "true",
       "  e a primeira tela já selecionada: " + SUBS[sub][0].id,
       "abrir um submódulo e não ver nada foi mutação que sobreviveu uma vez");
  }

  /* ════════════════════════════════════════════════════════════════════════
     3 · CADA TELA MOSTRA O SEU CONTEÚDO — E ESCONDE O DOS OUTROS
     ════════════════════════════════════════════════════════════════════════ */
  passo("3 · todas as telas, uma a uma");

  /* Os containers são varridos do DOM. Se alguém acrescentar um bloco novo,
     ele entra neste teste sozinho — que é o oposto da lista à mão que causou
     o defeito. */
  const containers = Array.prototype.map.call(
    tela.win.document.querySelectorAll('.ev-conteudo[id^="conteudo-"]'),
    el => el.id);
  ok(containers.length >= 8,
     "há " + containers.length + " blocos de conteúdo: " +
     containers.map(x => x.replace("conteudo-", "")).join(", "));

  for (const sub of nomes) {
    tela.win.evSub(sub);
    await tela.assentar(40);

    for (const t of SUBS[sub]) {
      let estourou = "";
      try { tela.win.evTela(t.id); } catch (e) { estourou = e.message; }
      await tela.assentar(60);

      const rotulo = sub + " › " + t.id;
      ok(!estourou, "abrir " + rotulo + " não estoura", estourou);

      if (t.conteudo) {
        /* Uma tela pode revelar MAIS DE UM bloco — é o que funde "o que pede
           ação hoje" e o executivo numa página só, como o usuário pediu. */
        const esperados = String(t.conteudo).split(",").map(x => "conteudo-" + x.trim());
        esperados.forEach(function (idAlvo) {
          const alvo = tela.win.document.getElementById(idAlvo);
          ok(alvo && alvo.hidden === false,
             "  " + rotulo + " revela " + idAlvo,
             alvo ? "" : "o bloco " + idAlvo + " nem existe no HTML");
        });

        const intrusos = containers.filter(function (id) {
          const el = tela.win.document.getElementById(id);
          return esperados.indexOf(id) < 0 && el && el.hidden === false;
        });
        igual(intrusos.length, 0,
              "  e esconde todos os outros",
              intrusos.length ? "ficaram à vista: " + intrusos.join(", ") : "");
      }

      if (t.embutido === "inscricoes") {
        const emb = tela.win.document.getElementById("evInscricoes");
        ok(emb && emb.hidden === false,
           "  " + rotulo + " revela a Central embutida");
        ok(tela.win.INICIADA === true,
           "  e a Central foi iniciada, com sessão",
           "abrir a tela é o que dispara as chamadas — nunca o carregamento");
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     4 · O SUBMÓDULO PAINEL, QUE ERA O QUE ESTAVA EM BRANCO
     ════════════════════════════════════════════════════════════════════════ */
  passo("4 · o caso que originou este arquivo");

  tela.win.evSub("painel");
  await tela.assentar(40);
  tela.win.evTela("hoje");
  await tela.assentar(80);

  const blocoPainel = tela.win.document.getElementById("conteudo-painel");
  ok(blocoPainel && blocoPainel.hidden === false,
     "Painel › O que pede ação hoje aparece de verdade",
     "faltava 'painel' na lista escrita à mão — a aba acendia e o bloco " +
     "continuava escondido");

  tela.win.evTela("executivo");
  await tela.assentar(80);
  const blocoExec = tela.win.document.getElementById("conteudo-executivo");
  ok(blocoExec && blocoExec.hidden === false,
     "e o Executivo também",
     "'executivo' era o segundo nome que faltava");

  const pediuExec = tela.chamadas.filter(c => c.fn === "compasso_executivoResumo");
  ok(pediuExec.length >= 1, "  e ele busca os números no servidor");
  ok(pediuExec.every(c => c.args[c.args.length - 1] === TOKEN),
     "  com a sessão junto");

  /* ════════════════════════════════════════════════════════════════════════
     5 · A LISTA À MÃO NÃO PODE VOLTAR
     ════════════════════════════════════════════════════════════════════════ */
  passo("5 · a regra que impede a repetição");

  const fonte = require("fs").readFileSync(
    require("path").join(dom.RAIZ, "EventosAdmin.html"), "utf8");
  ok(/querySelectorAll\('\.ev-conteudo\[id\^="conteudo-"\]'\)/.test(fonte),
     "os blocos são varridos do DOM, não listados à mão",
     "criar um conteúdo novo passa a bastar — não há segunda lista para esquecer");
  ok(!/\['calendario','informacoes','inscricoes'/.test(fonte),
     "  e o array literal que faltava dois nomes não está mais lá");

  const indice = require("fs").readFileSync(
    require("path").join(dom.RAIZ, "index.html"), "utf8");
  ok(!/eventosProgramacao:"programacao",eventosFesta:"festa"/.test(indice),
     "no index.html o nome do submódulo também é derivado, não mapeado",
     "era ali que faltava a entrada `eventos` → o botão Painel não fazia nada");
  ok(/restoEv\.charAt\(0\)\.toLowerCase\(\)/.test(indice),
     "  derivado do próprio nome do módulo");

  naoTestavel("a aparência das telas",
              "jsdom não aplica CSS nem desenha: cor, alinhamento e o que cabe " +
              "na tela continuam dependendo de olhar no navegador");

  resumo();
})();
