/**
 * TESTE — RECUSA QUE NINGUÉM VÊ É PIOR QUE ERRO
 *
 * O QUE ORIGINOU, 15/09/2026. Ele tentou excluir a inscrição do PILOTO
 * COMPASSO, que usa para testar:
 *
 *   "Quando vou excluir um cadastro para teste, ele está dando a segunda
 *    imagem e depois vai para a primeira e não acontece nada."
 *
 * "Não acontece nada" é o sintoma. Aconteceram DUAS coisas, e nenhuma delas
 * apareceu na tela.
 *
 * PRIMEIRA: o servidor RECUSOU, e recusou certo. A inscrição do piloto tem o
 * ingresso FCV-2026-000001 emitido, e `compasso_excluirInscricao` devolve
 * INGRESSO_ATIVO nesse caso — excluir a inscrição deixaria o QR valendo na
 * portaria, e alguém entraria com o ingresso de uma inscrição que não existe
 * mais. A regra está certa; o que faltava era ela chegar aos olhos dele.
 *
 * SEGUNDA, e é a que explica o silêncio: a faixa de aviso tinha `z-index:50`.
 * O fundo da gaveta é 60, a gaveta 61, o diálogo 70. Ou seja, TODA mensagem
 * dada com a gaveta aberta era desenhada ATRÁS dela. Não era um defeito do
 * botão de excluir: era de cancelar, emitir, salvar dados — de tudo o que
 * responde de dentro da gaveta. O sistema vinha respondendo o tempo todo,
 * para uma parede.
 *
 * E O QUE MUDOU ALÉM DE APARECER: a tela parou de pedir o motivo para só
 * depois descobrir que não podia. Erro previsível se avisa ANTES de a pessoa
 * terminar de digitar, e com o próximo passo na mão — que aqui é cancelar o
 * ingresso.
 *
 * O QUE NÃO ALCANÇA: se a faixa aparece de fato. Não há CSS aplicado nem
 * pintura aqui; o que se prova é que o número está no arquivo e maior que o
 * da gaveta, e qual caminho a tela toma antes de ir ao servidor.
 */
const fs = require("fs");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const html = fs.readFileSync(RAIZ + "/CompassoInscricoes.html", "utf8");

function elemento(id) {
  const classes = new Set();
  return {
    id, innerHTML: "", textContent: "", value: "", hidden: false, style: {},
    classList: { add: c => classes.add(c), remove: c => classes.delete(c),
                 contains: c => classes.has(c),
                 toggle: (c, on) => on ? classes.add(c) : classes.delete(c) },
    addEventListener() {}, querySelectorAll: () => []
  };
}

function montarTela() {
  const els = {};
  const chamadas = [];
  const perguntas = [];
  let pendente = null;

  const sandbox = {
    document: { getElementById: id => (els[id] = els[id] || elemento(id)),
                addEventListener() {},
                createElement: tag => Object.assign(elemento("novo"), { tag, click(){} }),
                body: { appendChild() {}, removeChild() {} } },
    window: { addEventListener() {}, innerHeight: 900, innerWidth: 1440 },
    location: { search: "" },
    google: { script: { run: new Proxy({}, { get: (_, n) => {
      if (n === "withSuccessHandler") return cb => { pendente = cb; return sandbox.google.script.run; };
      if (n === "withFailureHandler") return () => sandbox.google.script.run;
      return (...args) => { chamadas.push({ fn: n, args }); };
    } }) } },
    perguntar: (opcoes, aoConfirmar) => { perguntas.push(opcoes); aoConfirmar("motivo digitado"); },
    alert() {}, confirm: () => true, prompt: () => "motivo",
    /* NÃO dispara: a faixa de aviso se esconde sozinha em 7 segundos, e um
       setTimeout que roda na hora apagaria a mensagem antes de o teste
       conseguir olhar para ela. */
    setTimeout: () => 1, clearTimeout() {}, console
  };

  const corpo = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1];
  const nomes = Object.keys(sandbox);
  const expor = `; return {
    set LISTA(v){LISTA=v}, get LISTA(){return LISTA},
    set ABERTO(v){ABERTO=v}, get ABERTO(){return ABERTO},
    excluirInscricao, aviso, aposAcao
  };`;
  const tela = new Function(...nomes, corpo + expor)(...nomes.map(n => sandbox[n]));
  return { tela, els, chamadas, perguntas,
           responder: r => { const cb = pendente; pendente = null; if (cb) cb(r); } };
}

const pessoa = extra => Object.assign({
  inscricaoId: "INS-1", nome: "PILOTO COMPASSO 965771023", cpf: "96577102350",
  escola: "ESCOLA DE TESTE", cidade: "Vitória", email: "financeiro@exemplo.com",
  whatsapp: "", categoria: "associado", status: "VALIDADA_ADMINISTRATIVAMENTE",
  situacaoAssociado: "NAO_ENCONTRADO", ingressoId: "", numeroIngresso: "",
  entrega: { canais: [] }, pagamento: {}, criadoEm: new Date().toISOString()
}, extra || {});

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A faixa de aviso fica na frente da gaveta, não atrás");

/* O número é o defeito inteiro: 50 contra 61. */
const zMsg = Number((html.match(/#msg\{[^}]*z-index:(\d+)/) || [])[1]);
const zFundo = Number((html.match(/\.gv-fundo\{[^}]*z-index:(\d+)/) || [])[1]);
const zGaveta = Number((html.match(/box-shadow:-14px 0 40px[^;]*;z-index:(\d+)/) || [])[1]);

passo("os três números, lado a lado");
ok(zFundo > 0 && zGaveta > 0 && zMsg > 0,
   "fundo=" + zFundo + " gaveta=" + zGaveta + " aviso=" + zMsg);
ok(zMsg > zGaveta, "o aviso vence a gaveta",
   "com 50 contra 61 toda mensagem dada de dentro da gaveta era desenhada " +
   "atrás dela — e o sistema parecia mudo quando estava respondendo");
ok(zMsg > zFundo, "e vence o fundo escuro dela também");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Inscrição COM ingresso: avisa antes, e não pede motivo à toa");

const t = montarTela();
t.tela.LISTA = [pessoa({ ingressoId: "ING-1", numeroIngresso: "FCV-2026-000001" })];
t.tela.ABERTO = 0;
t.tela.excluirInscricao();

/* NOTA SOBRE O DUBLÊ: aqui `perguntar` confirma sozinho, sempre. Então o
   botão "Cancelar o ingresso" é clicado por conta própria e o cancelamento
   segue adiante — o que, na tela de verdade, só aconteceria se a pessoa
   quisesse. Por isso o que se afirma não é "nada foi mandado", e sim que a
   EXCLUSÃO não foi, e que a primeira pergunta é o aviso. */
passo("a exclusão não chega a ser tentada");
ok(!t.chamadas.some(c => c.fn === "compasso_excluirInscricao"),
   "compasso_excluirInscricao não é chamada",
   "antes a tela pedia o motivo, mandava, e só então ouvia a recusa — " +
   "invisível, ainda por cima");

passo("e a primeira pergunta explica o que fazer");
ok(/Cancele o ingresso antes/.test(t.perguntas[0].titulo),
   "o título diz o que está barrando", t.perguntas[0].titulo);
ok(/FCV-2026-000001/.test(t.perguntas[0].texto),
   "citando o ingresso pelo número — é o que a pessoa vai procurar");
ok(/portaria/.test(t.perguntas[0].texto),
   "e POR QUE a regra existe: o QR continuaria valendo na porta",
   "regra sem motivo vira burocracia, e quem não entende tenta contornar");
ok(!t.perguntas[0].campo,
   "não pede motivo de exclusão",
   "pedir o que vai ser descartado é fazer a pessoa trabalhar para nada");
ok(/Cancelar o ingresso/.test(t.perguntas[0].ok),
   "e o botão leva ao próximo passo, em vez de só dizer não");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Inscrição SEM ingresso: o caminho normal continua inteiro");

const t2 = montarTela();
t2.tela.LISTA = [pessoa()];
t2.tela.ABERTO = 0;
t2.tela.excluirInscricao();

igual(t2.perguntas.length, 1, "pergunta antes de excluir");
ok(/Excluir a inscrição/.test(t2.perguntas[0].titulo), "com o título de exclusão");
ok(t2.perguntas[0].campo === true, "  e AÍ sim pede o motivo");
ok(/vaga volta/.test(t2.perguntas[0].texto),
   "  dizendo que a vaga volta para as 2.000");

igual(t2.chamadas.length, 1, "e manda ao servidor");
igual(t2.chamadas[0].fn, "compasso_excluirInscricao", "a função certa");
igual(t2.chamadas[0].args[0], "INS-1", "com a inscrição");
igual(t2.chamadas[0].args[1], "motivo digitado", "e o motivo que a pessoa escreveu");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("E se o servidor recusar mesmo assim, a tela conta");

/* A trava da tela é conveniência, não segurança: a do servidor é que vale.
   Se ele recusar por outro motivo — inscrição já excluída, não encontrada —,
   a mensagem tem de aparecer. Antes aparecia; só que atrás da gaveta. */
const t3 = montarTela();
t3.tela.LISTA = [pessoa()];
t3.tela.ABERTO = 0;
t3.tela.excluirInscricao();
t3.responder({ ok: false, erro: "Esta inscrição já foi excluída." });

igual(t3.els.msg.textContent, "Esta inscrição já foi excluída.",
      "a recusa do servidor vira texto na faixa");
igual(t3.els.msg.style.display, "block", "  e a faixa é mostrada");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("A faixa sendo vista",
  "não há CSS aplicado nem pintura aqui. Que o aviso apareça na frente da " +
  "gaveta, e por tempo suficiente para alguém ler, só o navegador responde.");

resumo();
