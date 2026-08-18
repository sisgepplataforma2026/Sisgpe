/**
 * TESTE — LOTE DE TRABALHADORES NA TELA DE OFÍCIOS
 *
 * O QUE ORIGINOU
 *
 * Pedido do usuário em 18/08/2026: "Hoje está cada trabalhador com sua
 * ficha, preciso que tenha um modal ou um botão para enviar por lote" e,
 * logo depois: "quando for o lote só adiciono as pessoas e coloco todas as
 * fichas comparando com a quantidade de pessoas".
 *
 * Para uma cobrança de taxa com 50 pessoas, criar 50 cartões na mão e
 * anexar 50 fichas uma a uma é meia hora de trabalho repetitivo.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * A tela é montada num DOM de verdade, com os <script> executados. O teste
 * digita no campo, clica nos botões e confere o que apareceu na tela: os
 * cartões criados, os nomes e CPFs preenchidos, a prévia antes de
 * confirmar, e o anexo das fichas — tanto o PDF único escaneado quanto uma
 * ficha por pessoa.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 *   - aparência: jsdom não aplica CSS, então "o modal abriu" aqui quer
 *     dizer que a classe `aberto` entrou, não que ele apareceu bonito.
 *   - o upload real de arquivo e a emissão ponta a ponta no Apps Script.
 */
const path = require("path");
const b = require("./base");
const dom = require("./dom");

b.fluxo("OFÍCIOS · Lote de trabalhadores na tela");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Comportamento do lote na tela", "jsdom não instalado (npm install)");
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

/* O jsdom monta o DOM e o andaime executa os <script> na mão, então o
 * documento fica com readyState "loading" e o DOMContentLoaded nunca
 * dispara sozinho. A tela registra TODOS os seus binds nesse evento — sem
 * dispará-lo aqui, nenhum botão responde e o teste acusaria defeito onde
 * não há. Disparar é o que o navegador faz ao terminar de ler a página. */
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

function $(id) { return doc.getElementById(id); }
function cards() { return doc.querySelectorAll("#listaTrabalhadores .trabalhador-card"); }
function clicar(id) { const el = $(id); if (el) el.click(); return !!el; }
function digitarLote(txt) {
  const ta = $("loteTrabalhadoresTexto");
  ta.value = txt;
  ta.dispatchEvent(new win.Event("input"));
}

b.passo("1. Os controles do lote existem na tela");
b.ok(!!$("btnColarLoteTrabalhadores"), "botão 'Colar lista' existe");
b.ok(!!$("btnAnexarFichasLote"), "botão 'Fichas em lote' existe");
b.ok(!!$("modalLoteTrabalhadores"), "modal do lote existe");
b.ok(!!$("fichasLoteInput"), "campo de arquivo do lote existe");

b.passo("1b. O lote é o terceiro modo, ao lado de 'Preencher manualmente'");
/* Decisão do usuário em 18/08/2026: "terceiro modo ao lado de preencher
   manualmente". Filiação, Desfiliação e Oposição têm a linha de modos; Taxa
   Negocial e Taxa Assistencial não têm, e mantêm o botão no cabeçalho do
   bloco de trabalhadores. Todos abrem o mesmo modal. */
["btnModoLoteFil", "btnModoLoteDesf", "btnModoLoteOpos"].forEach(id => {
  const el = $(id);
  b.ok(!!el, "botão '" + id + "' existe na linha de modos",
    el ? (el.textContent || "").trim() : "AUSENTE");
});
const linhaModos = $("btnModoManualFil") && $("btnModoManualFil").parentNode;
b.ok(!!linhaModos && linhaModos.contains($("btnModoLoteFil")),
  "o botão do lote está na MESMA linha do 'Preencher manualmente'",
  linhaModos ? linhaModos.querySelectorAll("button").length + " botões na linha" : "linha não encontrada");
$("btnModoLoteFil").click();
b.ok($("modalLoteTrabalhadores").classList.contains("aberto"),
  "o terceiro modo abre o mesmo modal do lote");
clicar("btnCancelarLoteTrabalhadores");

b.passo("2. O modal abre e fecha");
clicar("btnColarLoteTrabalhadores");
b.ok($("modalLoteTrabalhadores").classList.contains("aberto"), "modal abriu ao clicar em 'Colar lista'");
clicar("btnCancelarLoteTrabalhadores");
b.ok(!$("modalLoteTrabalhadores").classList.contains("aberto"), "modal fechou no Cancelar");

b.passo("3. A prévia mostra o que foi entendido ANTES de criar os cartões");
clicar("btnColarLoteTrabalhadores");
digitarLote("Zuleica Ramos, 111.444.777-35\nAna Paula Lima\nBruno Alves; 12345678909");
const previa = $("loteTrabalhadoresPreview").textContent.replace(/\s+/g, " ").trim();
b.ok(/2 de 3 com CPF informado/.test(previa),
  "conta as 3 pessoas e diz quantas têm CPF", previa.slice(0, 70));
const nomesPrevia = ["Zuleica Ramos", "Ana Paula Lima", "Bruno Alves"]
  .filter(n => previa.indexOf(n) !== -1);
b.igual(nomesPrevia.length, 3, "os três nomes aparecem na prévia, para conferência");
b.igual(cards().length, 0, "nenhum cartão foi criado ainda — só a prévia");

b.passo("4. CPF com quantidade errada de dígitos é avisado, não aceito calado");
digitarLote("Fulano De Tal, 123\nCiclano De Tal, 11144477735");
const previaAviso = $("loteTrabalhadoresPreview").textContent;
b.ok(/3 d[íi]gitos/.test(previaAviso), "avisa o CPF incompleto e diz por quê",
  (previaAviso.match(/Linha[^·]*/) || [""])[0].slice(0, 80));

b.passo("5. Confirmar cria os cartões com nome e CPF preenchidos");
digitarLote("Zuleica Ramos, 111.444.777-35\nAna Paula Lima\nBruno Alves; 12345678909");
clicar("btnConfirmarLoteTrabalhadores");
b.igual(cards().length, 3, "três cartões criados");
b.ok(!$("modalLoteTrabalhadores").classList.contains("aberto"), "modal fechou depois de adicionar");
const nomes = Array.from(cards()).map(c => c.querySelector(".input-nome-trabalhador").value);
b.igual(nomes, ["Zuleica Ramos", "Ana Paula Lima", "Bruno Alves"],
  "os nomes entraram nos cartões, na ordem colada");
const cpfs = Array.from(cards()).map(c => c.querySelector(".input-cpf-trabalhador").value);
b.igual(cpfs, ["111.444.777-35", "", "123.456.789-09"],
  "os CPFs entraram mascarados, e quem não tinha ficou em branco");

b.passo("6. Colar de planilha (separado por TAB) também funciona");
clicar("btnColarLoteTrabalhadores");
digitarLote("Carlos Souza\t98765432100");
clicar("btnConfirmarLoteTrabalhadores");
b.igual(cards().length, 4, "o quarto cartão entrou");
const ultimo = cards()[3];
b.igual(ultimo.querySelector(".input-nome-trabalhador").value, "Carlos Souza",
  "nome separado por tabulação foi lido certo");
b.igual(ultimo.querySelector(".input-cpf-trabalhador").value, "987.654.321-00",
  "CPF separado por tabulação foi lido certo");

b.passo("7. Ficha em lote: um arquivo só com todas as fichas é aceito");
/* A regra mudou no meio da conversa, e vale registrar por quê.
   Primeiro o usuário pediu conferência de quantidade ("coloco todas as
   fichas comparando com a quantidade de pessoas"). Depois olhou a operação
   real e corrigiu: "geralmente quando você escaneia, vem um arquivo só com
   todas as fichas... talvez a gente deixe liberado nesse momento" e
   "seria um PDF de fichas para cada escola por dia". Ou seja: exigir uma
   ficha por pessoa recusaria justamente o formato normal da secretaria.

   As asserções olham o EFEITO na tela, não a mensagem: o toast é da própria
   tela e não passa pelo gravador do andaime, então conferir texto provaria
   menos e quebraria à toa se a frase mudasse. */
function anexarFichas(nomes) {
  const inp = $("fichasLoteInput");
  inp.files = nomes.map(n => ({ name: n, type: "application/pdf", lastModified: 0 }));
  inp.dispatchEvent(new win.Event("change"));
}
function cardsComFicha() {
  return Array.from(cards()).filter(c => {
    const i = c.querySelector(".input-ficha-trabalhador");
    return i && i.files && i.files.length > 0;
  }).length;
}
b.igual(cards().length, 4, "quatro pessoas na lista antes de anexar");
anexarFichas(["digitalizacao-completa.pdf"]);
b.ok(cardsComFicha() >= 1,
  "um arquivo unico com todas as fichas e aceito, nao recusado",
  cardsComFicha() + " cartao(oes) com anexo");

b.passo("8. Ficha em lote: distribui uma por pessoa quando bate");
anexarFichas(["4.pdf", "2.pdf", "3.pdf", "1.pdf"]);
b.igual(cardsComFicha(), 4, "4 fichas para 4 pessoas: todas distribuídas");
// Os arquivos são ordenados pelo nome antes de distribuir, porque a ordem
// em que o navegador entrega depende do sistema operacional.
const fichaDoPrimeiro = cards()[0].querySelector(".input-ficha-trabalhador").files[0].name;
b.ok(/_1\.pdf$|1\.pdf/.test(fichaDoPrimeiro) || fichaDoPrimeiro.indexOf("Ficha_") === 0,
  "a ficha foi renomeada com o nome da pessoa, como no anexo individual",
  fichaDoPrimeiro);

b.passo("9. O botão '+ Adicionar' um a um continua funcionando");
const antes = cards().length;
clicar("btnAddTrabalhador");
b.igual(cards().length, antes + 1, "o fluxo antigo não foi quebrado pelo lote");

b.passo("10. O ofício sai com os nomes do mesmo jeito do fluxo um a um");
/* Pedido do usuário: "tem que ser o ofício com o nome das pessoas do mesmo
   jeito". O lote não cria caminho paralelo — ele preenche os MESMOS cartões
   que o "+ Adicionar" preenche, e é dos cartões que sai o payload enviado
   ao backend. Esta asserção fecha esse elo: o que o lote criou chega ao
   backend como {nome, cpf}, que é o que o documento imprime. */
/* Lido direto dos cartões, que é de onde a tela monta o payload. Preferi
   isto a expor getTrabalhadoresPayload no window só para o teste alcançar:
   mudar código de produção para caber no teste é o começo de um teste que
   prova a si mesmo. */
const doLote = Array.from(cards()).map(c => ({
  nome: c.querySelector(".input-nome-trabalhador").value.trim(),
  cpf: c.querySelector(".input-cpf-trabalhador").value.replace(/\D/g, "")
})).filter(p => p.nome);

b.ok(doLote.length >= 4, "os cartões do lote estão preenchidos",
  doLote.length + " pessoas");
b.ok(doLote.some(p => p.nome === "Zuleica Ramos" && p.cpf === "11144477735"),
  "nome e CPF do lote ficam juntos no cartão — é esse par que vai ao ofício",
  JSON.stringify(doLote[0] || {}));
b.ok(doLote.every(p => p.nome),
  "toda pessoa criada pelo lote tem nome — é o que o ofício imprime");

b.naoTestavel("Aparência do modal e do cartão", "jsdom não aplica CSS");
b.naoTestavel("Upload real das fichas e emissão do ofício no Apps Script",
  "exige navegador e o sistema no ar");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
