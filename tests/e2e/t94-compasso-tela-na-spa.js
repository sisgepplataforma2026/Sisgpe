/**
 * A CENTRAL DENTRO DA SPA — O TESTE QUE FALTAVA, E QUE DEIXOU PASSAR TRÊS
 *
 * O QUE ORIGINOU
 *
 * 25/08/2026. O usuário abriu a tela e achou três defeitos em sequência, todos
 * clicando:
 *
 *   1. "Sessão inválida ou expirada" na Central inteira;
 *   2. "clico em copiar link de inscrição e não acontece nada";
 *   3. "quando clico em painel não acontece nada".
 *
 * Nenhum dos três foi tocado pelas 867 asserções que eu tinha. E não foi
 * azar — foi um buraco de método com forma bem definida:
 *
 *   os testes EXECUTAM os .gs contra um banco de mentira,
 *   e LEEM os .html como texto.
 *
 * Nada executava o navegador. Então todo defeito que mora em QUANDO o script
 * roda dentro da página — ordem de carregamento, variável ainda sem valor,
 * rota do menu — escapava inteiro. Os três são exatamente dessa família.
 *
 * O pior detalhe: o andaime para isso já existia (`dom.js`, com jsdom) e
 * outros dez testes já o usavam. As telas do Compasso nunca passaram por ele.
 *
 * O QUE ESTE ARQUIVO FAZ DE DIFERENTE
 *
 * Ele reproduz a ORDEM REAL da SPA, que é a coisa que nenhum outro teste
 * fazia. No index.html:
 *
 *   linha  663   <?!= include('EventosAdmin'); ?>   ← o script da Central roda
 *   linha 1345   var SISGEP_TOKEN_SESSAO = "..."    ← 682 linhas DEPOIS
 *
 * Então aqui a tela sobe com o token AINDA VAZIO, e só depois ele é
 * declarado — como acontece de verdade. Um token capturado no carregamento
 * fica vazio para sempre; um resolvido a cada chamada funciona. É a diferença
 * entre a tela morta e a tela viva, e agora ela é medida.
 */
const b = require("./base");
const dom = require("./dom");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = b;

fluxo("COMPASSO NA SPA · a tela dentro do portal, na ordem real");

if (!dom.jsdomDisponivel()) {
  naoTestavel("a Central dentro da SPA",
              "jsdom não está instalado neste ambiente — `npm i jsdom` para rodar");
  resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN_REAL = b.logar(g, "wanderson");

/* Firestore em memória, com uma inscrição para a lista ter o que mostrar. */
const BANCO = new Map();
const clonar = o => JSON.parse(JSON.stringify(o));
g.fs_set_ = (c, i, o) => { BANCO.set(c + "/" + i, clonar(o)); return { ok: true }; };
g.fs_get_ = (c, i) => { const v = BANCO.get(c + "/" + i); return v ? clonar(v) : null; };
g.fs_list_ = c => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(c + "/") === 0) o.push(clonar(v)); }); return o; };
g.fs_queryEquals_ = (c, campo, v) => g.fs_list_(c).filter(d => String(d[campo]) === String(v));

g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

g.fs_set_("inscricoesEventos", "INS-1", {
  inscricaoId: "INS-1", eventoId: g.EMISSAO_CFG.EVENTO_ID,
  nome: "Maria Aparecida da Silva", cpf: "11144477735", escola: "EMEF Castelo Branco",
  cidade: "Vitória", status: "", criadoEm: new Date(), vagaReservada: true,
  email: "maria@exemplo.com", whatsapp: "27998765432" });

/* ══════════════════════════════════════════════════════════════════════════
   1 · A ORDEM REAL: a tela sobe ANTES de o token existir
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · o token chega depois da tela, como no index.html");

/* token vazio no momento em que os scripts rodam — é a situação real. */
const tela = dom.montar(g, ["CompassoInscricoes.html"], { token: "" });

/* Agora o index.html:1345 "acontece": a variável recebe valor. */
tela.win.SISGEP_TOKEN_SESSAO = TOKEN_REAL;

ok(typeof tela.win.compassoToken === "function",
   "a Central resolve o token por FUNÇÃO, não por variável capturada",
   "variável avaliada no carregamento congela vazia — a tela roda 682 linhas " +
   "antes de o token ser declarado");

igual(tela.win.compassoToken(), TOKEN_REAL,
      "e depois de o token existir, a função devolve o token real",
      "era aqui que a Central inteira dizia 'Sessão inválida ou expirada'");

/* A ROTA AVULSA continua tendo precedência. Aberta por ?painel=compasso a
   Central não tem SPA para consultar: o token vem na URL, e é ele que vale.

   ESTA É LEITURA DE CÓDIGO, NÃO EXECUÇÃO — e está declarado. O jsdom não
   deixa trocar `location.search` da janela já montada, então o que dá para
   afirmar aqui é a ORDEM escrita na função. O caminho avulso só se prova
   abrindo ?painel=compasso&sessao=… no navegador. */
const fonteCentral = require("fs").readFileSync(
  require("path").join(dom.RAIZ, "CompassoInscricoes.html"), "utf8");
const corpoToken = (fonteCentral.match(
  /function compassoToken\(\)\{[\s\S]*?\n\}/) || [""])[0];
ok(corpoToken.indexOf("location.search") < corpoToken.indexOf("SISGEP_TOKEN_SESSAO"),
   "na função, o token da URL é consultado ANTES do da SPA",
   "quem abre a Central fora do portal não tem SPA para consultar");

/* ══════════════════════════════════════════════════════════════════════════
   2 · A TELA NÃO BATE NA PORTA ANTES DE TER CHAVE
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · nada é pedido ao servidor no carregamento");

igual(tela.chamadas.length, 0,
      "ao ser lida dentro do portal, a tela NÃO chama o backend",
      "aqui saíam quatro chamadas com token vazio — opções, pagamento, resumo " +
      "e lista —, e as quatro voltavam 'Sessão inválida ou expirada'");

ok(typeof tela.win.compassoIniciar === "function",
   "  ela expõe um início sob demanda");
ok(tela.win.INICIADA === false,
   "  e se declara não iniciada");

/* ══════════════════════════════════════════════════════════════════════════
   3 · QUANDO A TELA É ABERTA, AÍ SIM
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · abrir a Central é o que a faz começar");

(async function () {
  /* É a mesma chamada que EventosAdmin faz ao mostrar a Central
     (EventosAdmin.html:445). */
  tela.win.compassoAplicarFiltro("");
  await tela.assentar(60);

  ok(tela.chamadas.length > 0,
     "abrir a Central dispara as chamadas: " +
     tela.chamadas.map(c => c.fn).join(", "));
  ok(tela.chamadas.every(c => c.args[c.args.length - 1] === TOKEN_REAL),
     "  e TODAS levam o token real no último argumento",
     "é o que faltava: a sessão já existe no momento em que a tela é aberta");

  /* Abrir de novo não repete o que é pedido uma vez só. */
  const antesReabrir = tela.chamadas.filter(c => c.fn === "compasso_validacaoOpcoes").length;
  tela.win.compassoAplicarFiltro("participantes");
  await tela.assentar(60);
  igual(tela.chamadas.filter(c => c.fn === "compasso_validacaoOpcoes").length,
        antesReabrir,
        "reabrir não pede as opções de novo",
        "elas mudam por deploy, não por clique");
  ok(tela.chamadas.filter(c => c.fn === "compasso_validacaoListar").length > 1,
     "  mas a lista é relida, porque o filtro mudou");

  /* ════════════════════════════════════════════════════════════════════════
     4 · O BOTÃO QUE "NÃO FAZIA NADA"
     ════════════════════════════════════════════════════════════════════════ */
  passo("4 · copiar link de inscrição");

  const botao = tela.win.document.querySelector('button[onclick="copiarLink()"]');
  ok(!!botao, "o botão existe na linha das abas",
     "ele tinha sumido junto com o cabeçalho escondido no embutimento");

  const antes = tela.chamadas.length;
  tela.win.copiarLink();
  await tela.assentar(60);
  const novas = tela.chamadas.slice(antes);
  const pediuUrl = novas.filter(c => c.fn === "eventos_obterWebAppUrl");
  ok(pediuUrl.length === 1,
     "clicar pede a URL base ao servidor",
     "'não acontece nada' era a chamada indo sem sessão e voltando erro");
  igual(pediuUrl[0].args[pediuUrl[0].args.length - 1], TOKEN_REAL,
        "  com a sessão junto");

  /* O plano B do link tem de existir: dentro do iframe do Apps Script a área
     de transferência costuma ser recusada, e aí o endereço precisa aparecer
     em algum lugar de onde dê para copiar à mão. */
  ok(typeof tela.win.mostrarLink === "function",
     "  e há plano B quando o navegador recusa a área de transferência");

  /* ════════════════════════════════════════════════════════════════════════
     5 · A LISTA RENDERIZA
     ════════════════════════════════════════════════════════════════════════ */
  passo("5 · a inscrição aparece na tela");

  /* Volta ao filtro vazio: o passo anterior deixou "participantes" ligado, que
     mostra só quem tem ingresso — e a inscrição semeada não tem. */
  tela.win.compassoAplicarFiltro("");
  await tela.assentar(60);

  const corpo = tela.win.document.body.textContent || "";
  ok(corpo.indexOf("Maria Aparecida da Silva") >= 0,
     "o nome da inscrição aparece na lista",
     "a tela estava em branco porque nenhuma chamada passava da porta");

  resumo();
})();
