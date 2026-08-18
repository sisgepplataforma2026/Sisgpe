/**
 * TESTE — O AVISO DE DUPLICATA APARECE NO PADRÃO DO SISTEMA
 *
 * O QUE ORIGINOU
 *
 * Foto mandada pelo usuário em 18/08/2026: a caixa cinza do navegador, com
 * o cabeçalho "Uma página incorporada em n-3btszrv3emvrofzxiplemwz7oqdt2-
 * qapsbjnp6q-0lu-script.googleusercontent.com diz", perguntando "Deseja
 * gerar mesmo assim?" com botões OK e Cancelar.
 *
 * Dois problemas ali. O primeiro é de padrão: o CLAUDE.md proíbe confirm()
 * nativo para feedback do sistema, e essa caixa mostra a URL crua do Apps
 * Script para quem só queria emitir um ofício. O segundo é de leitura: os
 * dados vêm num parágrafo corrido, então achar o número do ofício exige ler
 * a frase inteira.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Monta a tela num DOM real e chama abrirModalDuplicata() com uma resposta
 * de backend igual à que o servidor devolve. Depois mede:
 *
 *   1. que o confirm() do navegador NÃO foi chamado;
 *   2. que o modal do sistema abriu (classe `aberto`);
 *   3. que escola, tipo, número e data foram para campos separados;
 *   4. que a contagem só aparece quando há mais de um;
 *   5. que "Gerar mesmo assim" chama o callback de confirmação, e só ele;
 *   6. que "Cancelar emissão", o ✕ e a tecla Esc chamam o de cancelamento;
 *   7. que reabrir o modal não faz a emissão disparar duas vezes — o risco
 *      real de trocar confirm() por um modal com listener acumulado.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência. jsdom não aplica CSS — "abriu" aqui significa que a classe
 * entrou no elemento, não que o modal ficou bonito na tela.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("OFÍCIOS · Aviso de duplicata no padrão do sistema");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Modal de duplicata na tela", "jsdom não instalado (npm install)");
  b.resumo();
  process.exit(0);
}

const g = b.subir({}).g;
let tela;
try {
  tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: "TESTE" });
} catch (e) {
  b.ok(false, "a tela de ofícios sobe sem quebrar", String(e.message).slice(0, 160));
  b.resumo();
  process.exit(1);
}
const doc = tela.doc, win = tela.win;
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

function $(id) { return doc.getElementById(id); }
function txt(id) { const e = $(id); return e ? String(e.textContent || "").trim() : "(sem elemento)"; }

/* Espiona o confirm() do navegador. Se o modal do sistema estiver
   funcionando, este contador tem que ficar em zero. */
let confirmsNativos = 0;
win.confirm = function () { confirmsNativos += 1; return true; };

/* A mesma forma de resposta que gerarOficioWeb devolve quando acha
   duplicata — inclusive os campos novos (tipo, quantidade). */
function resposta(extra) {
  const dup = Object.assign({
    duplicata: true,
    escola: "TESTE LTDA",
    tipo: "Taxa Negocial",
    numeroExistente: "278/2026",
    dataExistente: "17/08/2026 às 19:38",
    quantidade: 1
  }, extra || {});
  return {
    erro: false,
    duplicataDetectada: true,
    duplicata: dup,
    mensagem: "Já existe um ofício de Taxa Negocial para TESTE LTDA (nº 278/2026)."
  };
}

/* ═══════════════════════════════════════════════════════════
   1. O modal existe e é ele que aparece
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
b.ok(!!$("modalDuplicataOficio"), "o modal de duplicata está na tela");
b.ok(typeof win.abrirModalDuplicata === "function",
  "abrirModalDuplicata está exposta para os três fluxos de emissão");

b.passo("2");
let confirmou = 0, cancelou = 0;
win.abrirModalDuplicata(resposta(), function () { confirmou += 1; }, function () { cancelou += 1; });

b.ok(confirmsNativos === 0,
  "o confirm() do navegador NÃO é usado", "chamadas nativas: " + confirmsNativos);
b.ok($("modalDuplicataOficio").classList.contains("aberto"),
  "o modal do sistema abriu");
b.ok($("modalDuplicataOficio").classList.contains("of-modal-overlay"),
  "usa o componente de modal do design system (of-modal-overlay)");

/* ═══════════════════════════════════════════════════════════
   2. Cada dado na sua linha
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
b.igual(txt("dupEscola"), "TESTE LTDA", "a escola vai para o campo próprio");
b.igual(txt("dupNumero"), "278/2026",   "o número do ofício vai para o campo próprio");
b.igual(txt("dupData"), "17/08/2026 às 19:38", "a data vai para o campo próprio");
b.igual(txt("dupTipo"), "Taxa Negocial", "o tipo vai para o campo próprio");

/* Com um só, a faixa de contagem não faz sentido e some. */
b.ok($("dupQuantidade").style.display === "none",
  "com um único ofício, a faixa de contagem fica escondida");

/* ═══════════════════════════════════════════════════════════
   3. "Gerar mesmo assim" segue a emissão
   ═══════════════════════════════════════════════════════════ */
b.passo("4");
$("btnConfirmarDuplicata").click();
b.igual([confirmou, cancelou], [1, 0],
  "o botão de gerar chama só o callback de confirmação");
b.ok(!$("modalDuplicataOficio").classList.contains("aberto"),
  "e o modal fecha depois de confirmar");

/* ═══════════════════════════════════════════════════════════
   4. Cancelar não emite
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
confirmou = 0; cancelou = 0;
win.abrirModalDuplicata(resposta(), function () { confirmou += 1; }, function () { cancelou += 1; });
$("btnCancelarDuplicata").click();
b.igual([confirmou, cancelou], [0, 1],
  "cancelar chama só o callback de cancelamento");

b.passo("6");
confirmou = 0; cancelou = 0;
win.abrirModalDuplicata(resposta(), function () { confirmou += 1; }, function () { cancelou += 1; });
$("btnFecharDuplicata").click();
b.igual([confirmou, cancelou], [0, 1],
  "fechar no ✕ conta como cancelar, não como confirmar");

b.passo("7");
confirmou = 0; cancelou = 0;
win.abrirModalDuplicata(resposta(), function () { confirmou += 1; }, function () { cancelou += 1; });
doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
b.igual([confirmou, cancelou], [0, 1],
  "Esc cancela — a tecla de fuga não pode emitir ofício");

/* ═══════════════════════════════════════════════════════════
   5. Reabrir não faz a emissão sair duas vezes
   ═══════════════════════════════════════════════════════════

   Este é o defeito clássico de trocar confirm() por modal: cada abertura
   registra mais um listener no mesmo botão, e na terceira emissão o ofício
   sai três vezes. Sem esta asserção, um addEventListener no lugar do
   onclick passaria despercebido. */
b.passo("8");
let disparos = 0;
for (let i = 0; i < 3; i++) {
  win.abrirModalDuplicata(resposta(), function () { disparos += 1; }, function () {});
}
$("btnConfirmarDuplicata").click();
b.igual(disparos, 1,
  "depois de abrir 3 vezes, um clique gera UM ofício — não três");

/* E o callback que roda é o da última abertura, não o da primeira. */
b.passo("9");
let qualRodou = "";
win.abrirModalDuplicata(resposta(), function () { qualRodou = "antiga"; }, function () {});
win.abrirModalDuplicata(resposta(), function () { qualRodou = "nova";   }, function () {});
$("btnConfirmarDuplicata").click();
b.igual(qualRodou, "nova", "vale o payload da abertura mais recente");

/* Depois do Esc, o listener de teclado sai junto: apertar Esc com o modal
   fechado não pode cancelar nada às escondidas. */
b.passo("10");
cancelou = 0;
win.abrirModalDuplicata(resposta(), function () {}, function () { cancelou += 1; });
doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
b.igual(cancelou, 1, "o Esc para de responder depois que o modal fecha");

/* ═══════════════════════════════════════════════════════════
   6. Vários ofícios na janela: a faixa de contagem aparece
   ═══════════════════════════════════════════════════════════ */
b.passo("11");
win.abrirModalDuplicata(resposta({ quantidade: 3 }), function () {}, function () {});
b.ok($("dupQuantidade").style.display !== "none",
  "com 3 ofícios no período, a faixa de contagem aparece");
b.ok(txt("dupQuantidade").indexOf("3") > -1,
  "e diz quantos são", txt("dupQuantidade"));
$("btnCancelarDuplicata").click();

/* ═══════════════════════════════════════════════════════════
   7. Backend sem os campos novos não quebra a tela
   ═══════════════════════════════════════════════════════════

   Se o Apps Script estiver rodando um PrevencaoDuplicata antigo, o objeto
   vem sem tipo e sem quantidade. O modal tem que abrir assim mesmo — parar
   a emissão por causa de um campo ausente seria pior que o aviso feio. */
b.passo("12");
confirmou = 0;
win.abrirModalDuplicata({
  duplicataDetectada: true,
  duplicata: { duplicata: true, escola: "ESCOLA X", numeroExistente: "100/2026", dataExistente: "18/08/2026 às 08:00" },
  mensagem: "Já existe um ofício."
}, function () { confirmou += 1; }, function () {});
b.ok($("modalDuplicataOficio").classList.contains("aberto"),
  "resposta sem os campos novos ainda abre o modal");
b.ok($("dupQuantidade").style.display === "none",
  "sem quantidade, a faixa de contagem não aparece");
$("btnConfirmarDuplicata").click();
b.igual(confirmou, 1, "e a emissão segue normalmente");

b.ok(confirmsNativos === 0,
  "em nenhum momento do teste o navegador mostrou a caixa cinza",
  "chamadas a confirm(): " + confirmsNativos);

b.resumo();
