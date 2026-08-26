/**
 * A LISTA DE INSCRIÇÕES CABE NA TELA — E A AÇÃO ACERTA A LINHA CERTA
 *
 * O QUE ORIGINOU
 *
 * 24/08/2026. O usuário importou a planilha real e o painel passou a mostrar
 * 124 inscrições numa página só, uma abaixo da outra, sem fim. A festa tem
 * 2.000 vagas: pintar a lista inteira não era um incômodo de rolagem, era o
 * desenho não escalando para o tamanho do próprio evento.
 *
 * ONDE ESTÁ O PERIGO — E POR QUE ESTE TESTE EXECUTA EM VEZ DE LER
 *
 * Paginar uma tabela cujas linhas carregam AÇÕES é diferente de paginar uma
 * lista de leitura. Cada linha traz `emitir(i)`, `porEmail(i)`, `marcar(i)`, e
 * esse `i` é posição em LISTA. Fatiar com `.map(function(x,i))` sobre a fatia
 * faz o índice recomeçar do zero a cada página — e aí:
 *
 *     na página 2, "Emitir" da primeira linha emite o ingresso da 1ª pessoa
 *     da lista, não da 51ª.
 *
 * Isso não dá erro. Emite. Para a pessoa errada, consumindo uma das 2.000
 * vagas, e o defeito só aparece quando alguém reclamar que recebeu ingresso
 * sem ter pedido. É exatamente o tipo de coisa que passa em leitura de código
 * e em teste de regex: o HTML gerado tem `onclick="emitir(0)"` nos dois casos.
 *
 * Por isso este arquivo NÃO procura texto no HTML. Ele carrega o bloco de
 * script da tela num DOM de mentira, enche LISTA com 124 registros de posição
 * conhecida, pede a página 2 e LÊ O HTML QUE SAIU para conferir de quem é o
 * índice em cada botão.
 *
 * O QUE ESTÁ COBERTO
 *
 *   1. a fatia — quantas linhas, e quais
 *   2. o índice das ações é o índice em LISTA, não o da fatia
 *   3. os limites: não passa da última página, não vai abaixo da primeira
 *   4. "todas" no seletor volta a mostrar a lista inteira
 *   5. a numeração some quando tudo cabe numa página
 *   6. marcar-todos alcança a página, não a lista inteira
 *   7. filtrar volta para a página 1; emitir/enviar NÃO tiram a pessoa de onde
 *      ela estava
 *
 * O QUE NÃO ESTÁ COBERTO
 *
 * Nada de aparência: se o rodapé está bonito, se o botão desabilitado parece
 * desabilitado, se rola bem no celular. Isso é olho, e continua sendo teste
 * manual.
 */

const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const html = fs.readFileSync(path.join(RAIZ, "CompassoInscricoes.html"), "utf8");

fluxo("INSCRIÇÕES · a lista pagina, e a ação acerta a linha");

/* ── DOM de mentira ────────────────────────────────────────────────────────
   Só o suficiente para o script da tela rodar: um elemento guarda o que lhe
   escrevem e devolve os checkboxes que o próprio innerHTML criou. */
function elemento(id) {
  const classes = new Set();
  return {
    id, innerHTML: "", textContent: "", value: "", checked: false,
    disabled: false, hidden: false, style: {}, options: [],
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c),
      toggle: (c, on) => on ? classes.add(c) : classes.delete(c)
    },
    addEventListener() {},
    querySelectorAll() {
      const n = (this.innerHTML.match(/type="checkbox"/g) || []).length;
      return Array.from({ length: n }, () => ({ checked: false }));
    }
  };
}

function montar() {
  const els = {};
  const doc = {
    getElementById(id) { return (els[id] = els[id] || elemento(id)); },
    addEventListener() {}   /* a tela registra Esc para fechar a gaveta */
  };
  const chamadas = [];
  const sandbox = {
    document: doc,
    location: { search: "" },
    /* google.script.run: registra a chamada e nunca responde. As funções de
       página não dependem do backend — é justamente o que se quer isolar. */
    google: { script: { run: new Proxy({}, {
      get: (_, nome) => {
        if (nome === "withSuccessHandler" || nome === "withFailureHandler")
          return () => sandbox.google.script.run;
        return (...args) => { chamadas.push({ nome, args }); };
      }
    }) } },
    /* a tela expõe compassoAplicarFiltro para quem a inclui */
    /* A tela registra `resize` para fechar o menu de status — 26/08/2026.
       Sem isto o sandbox estoura em "window.addEventListener is not a
       function" e o teste acusaria defeito onde não há: é falta do andaime. */
    window: { addEventListener() {} },
    alert() {}, confirm() { return true; }, setTimeout() {}, console
  };

  const corpo = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1];
  if (!corpo) throw new Error("bloco <script> não encontrado");

  const nomes = Object.keys(sandbox);
  /* Devolve o escopo da tela para o teste poder mexer nele. */
  const expor = `; return {
    get PAGINA(){return PAGINA}, set PAGINA(v){PAGINA=v},
    get POR_PAGINA(){return POR_PAGINA}, set POR_PAGINA(v){POR_PAGINA=v},
    get LISTA(){return LISTA}, set LISTA(v){LISTA=v},
    get SEL(){return SEL},
    paginas, irPagina, trocarTamanho, pintarLista, marcarTodos, carregar
  };`;
  const tela = new Function(...nomes, corpo + expor)(...nomes.map(n => sandbox[n]));
  return { tela, els, doc, chamadas };
}

/* Pessoas com o número delas no nome, para qualquer linha que apareça se
   identificar sozinha.
   O estado importa: quem AINDA NÃO tem ingresso ganha o botão "Emitir" (é
   nele que se lê o índice); quem JÁ tem ganha o checkbox (é ele que o
   marcar-todos alcança). Os dois casos são testados, cada um com a sua
   população. */
const pessoas = (n, comIngresso) => Array.from({ length: n }, (_, i) => ({
  inscricaoId: "insc-" + i, nome: "PESSOA " + i, cpf: "000", escola: "E",
  cidade: "C", status: "VALIDADA_ADMINISTRATIVAMENTE",
  situacaoAssociado: "ASSOCIADO",
  ingressoId: comIngresso ? "ing-" + i : "",
  numeroIngresso: comIngresso ? "FCV-" + i : ""
}));

const linhasDe = el => (el.innerHTML.match(/<tr>/g) || []).length;
const nomesDe  = el => (el.innerHTML.match(/PESSOA \d+/g) || []);
/* O ÍNDICE VEM DO BOTÃO DE SITUAÇÃO — 26/08/2026.
   A linha não tem mais botão "Emitir": o controle passou a ser o próprio
   status, e é dele que saem emitir, enviar, editar e excluir. O que este
   teste guarda continua igual — que o índice da linha acompanhe a paginação,
   para a ação não acertar a pessoa errada. */
const emitirDe = el => (el.innerHTML.match(/abrirMenuStatus\((\d+),/g) || [])
                        .map(s => Number(s.replace(/\D/g, "")));

/* ───────────────────────────────────────────────────────────────────────── */
passo("a página corta a lista");

let { tela, els } = montar();
tela.LISTA = pessoas(124, false);
tela.pintarLista();

igual(linhasDe(els.tb), 50, "a primeira página traz 50 linhas de 124");
igual(nomesDe(els.tb)[0], "PESSOA 0", "  começando na primeira");
igual(nomesDe(els.tb)[49], "PESSOA 49", "  e terminando na 50ª");
ok(els.paginacao.hidden === false, "a numeração aparece");
igual(els.pgConta.textContent, "Mostrando 1–50 de 124", "  e diz onde a pessoa está");
igual(els.pgAtual.textContent, "Página 1 de 3", "  e quantas páginas existem");
ok(els.pgAnt.disabled === true, "  'Anterior' está desligado na primeira");
ok(els.pgProx.disabled === false, "  'Próxima' está ligado");

/* ───────────────────────────────────────────────────────────────────────── */
passo("O ÍNDICE DA AÇÃO É O DA LISTA, NÃO O DA PÁGINA");

tela.irPagina(2);
igual(nomesDe(els.tb)[0], "PESSOA 50", "a página 2 começa na 51ª pessoa");
igual(emitirDe(els.tb)[0], 50,
      "e o botão Emitir dela carrega o índice 50",
      "com o índice da fatia seria 0 — emitiria para a 1ª pessoa da lista, " +
      "sem erro nenhum, consumindo uma das 2.000 vagas");
igual(emitirDe(els.tb)[49], 99, "  e a última linha da página, o índice 99");

tela.irPagina(3);
igual(linhasDe(els.tb), 24, "a última página traz o resto: 24 linhas");
igual(emitirDe(els.tb)[0], 100, "  e continua com o índice certo");
igual(els.pgConta.textContent, "Mostrando 101–124 de 124", "  e a contagem fecha");
ok(els.pgProx.disabled === true, "  'Próxima' desliga no fim");

/* ───────────────────────────────────────────────────────────────────────── */
passo("os limites seguram");

tela.irPagina(99);
igual(tela.PAGINA, 3, "pedir página 99 para na última");
tela.irPagina(-4);
igual(tela.PAGINA, 1, "pedir página negativa para na primeira");

/* ───────────────────────────────────────────────────────────────────────── */
passo("dá para ver tudo de uma vez");

tela.trocarTamanho("0");
igual(linhasDe(els.tb), 124, "'todas' mostra a lista inteira");
ok(els.paginacao.hidden === true, "  e a numeração some, porque não há o que numerar");
igual(emitirDe(els.tb)[123], 123, "  com o índice ainda certo na última");

tela.trocarTamanho("25");
igual(linhasDe(els.tb), 25, "25 por página mostra 25");
igual(tela.PAGINA, 1, "  e volta para a primeira página");
igual(els.pgAtual.textContent, "Página 1 de 5", "  recontando as páginas");

/* ───────────────────────────────────────────────────────────────────────── */
passo("lista curta não ganha numeração");

({ tela, els } = montar());
tela.LISTA = pessoas(12, false);
tela.pintarLista();
igual(linhasDe(els.tb), 12, "as 12 aparecem");
ok(els.paginacao.hidden === true, "e o rodapé de página fica escondido",
   "numeração de página numa lista de 12 é enfeite que ocupa espaço");

/* ───────────────────────────────────────────────────────────────────────── */
passo("marcar todos alcança a página, não a lista inteira");

/* SEM ingresso de propósito. Em 25/08/2026 o usuário marcou o checkbox do
   cabeçalho sobre as 122 importadas e a barra de ações nem apareceu: o
   marcar-todos ainda filtrava por ingresso, e nenhuma delas tinha. O checkbox
   da LINHA já tinha sido corrigido; este ficou para trás. */
({ tela, els } = montar());
tela.LISTA = pessoas(124, false);
tela.pintarLista();
tela.irPagina(2);
tela.marcarTodos({ checked: true });

const marcados = Object.keys(tela.SEL).map(Number).sort((a, b) => a - b);
igual(marcados.length, 50,
      "marcou 50 — o tamanho da página, mesmo sem nenhuma ter ingresso",
      "selecionar não é decidir o que fazer: quem decide é o botão");
igual(marcados[0], 50, "  a partir da 51ª pessoa");
igual(marcados[49], 99,
      "  até a 100ª",
      "marcar a lista toda selecionaria 2.000 pessoas que a pessoa não está " +
      "vendo, e o próximo clique seria 'enviar ingresso' para todas elas");

tela.marcarTodos({ checked: false });
igual(Object.keys(tela.SEL).length, 0, "desmarcar limpa");

/* ───────────────────────────────────────────────────────────────────────── */
passo("recarregar depois de uma ação não tira a pessoa da página");

/* carregar() sem argumento zera a página (filtro novo, lista nova);
   carregar(true) mantém — é o que emitir/enviar usam. */
const corpoCarregar = (html.match(/function carregar\([^)]*\)\s*\{[\s\S]*?\n\}/) || [""])[0];
ok(/if \(!manterPagina\) PAGINA = 1;/.test(corpoCarregar),
   "carregar só volta para a página 1 quando não pedem para manter");
ok(/function recarregar\(\)\{ carregar\(true\); \}/.test(html),
   "e existe recarregar(), que mantém");

/* A costura: as ações têm de usar recarregar, e os filtros, carregar. */
const acoes = ["emitir", "porEmail", "porWhats", "enviarLote"];
acoes.forEach(nome => {
  const corpo = (html.match(new RegExp("function " + nome + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}")) || [""])[0];
  if (!corpo) return ok(false, nome + " não encontrada");
  ok(!/[^re]carregar\(\);/.test(corpo.replace(/recarregar\(\);/g, "")),
     nome + " recarrega sem resetar a página",
     "emitir 40 ingressos na página 3 e ser jogado para a página 1 a cada um " +
     "é o tipo de detalhe que faz a pessoa desistir da tela");
});

/* E o contrário: quem MUDA o filtro tem de voltar ao começo. */
["limpar", "clicarCard", "limparFiltroUrl"].forEach(nome => {
  const corpo = (html.match(new RegExp("function " + nome + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}")) || [""])[0];
  if (!corpo) return ok(false, nome + " não encontrada");
  ok(/[^re]carregar\(\);/.test(" " + corpo) && !/recarregar\(\);/.test(corpo),
     nome + " volta para a página 1",
     "outro filtro é outra lista: continuar na página 7 mostraria o vazio");
});

resumo();
