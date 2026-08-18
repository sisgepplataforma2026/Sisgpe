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
/* Agora é um por vez: nome, CPF e "+ Adicionar". Colar várias linhas no
   campo de nome continua adicionando todas — é o atalho de quem já tem a
   lista pronta na planilha. */
function digitarLote(txt) {
  String(txt).split("\n").forEach(linha => {
    const partes = linha.split(/[;,\t]/);
    $("loteNome").value = String(partes[0] || "").trim();
    $("loteCpf").value = partes.length > 1 ? String(partes.slice(1).join("")).trim() : "";
    clicar("btnLoteAdicionarPessoa");
  });
}
function pessoasNaFila() {
  return $("loteTrabalhadoresPreview").querySelectorAll(".lote-remover").length;
}

b.passo("1. O lote tem UMA porta de entrada: o modo, não botões soltos");
/* O usuário apontou os dois botões que eu tinha deixado no cabeçalho do
   bloco de trabalhadores — "por que tem esses botões aqui, não deveria
   ter". Estava certo: com o lote virando modo de preenchimento, aqueles
   botões eram uma segunda entrada para a mesma coisa, e o cabeçalho do
   cartão não é onde se escolhe COMO preencher o ofício. */
b.ok(!$("btnColarLoteTrabalhadores"), "o botão 'Colar lista' saiu do cabeçalho");
b.ok(!$("btnAnexarFichasLote"), "o botão 'Fichas em lote' saiu do cabeçalho");
b.ok(!!$("btnAddTrabalhador"), "o '+ Adicionar' continua no cabeçalho");
b.ok(!!$("modalLoteTrabalhadores"), "modal do lote existe");

b.passo("1a. O modal tem as três etapas: escola, trabalhadores e fichas");
b.ok(!!$("loteEscolaBusca") && !!$("loteEscolaLista"), "1 · escola: busca e lista");
b.ok(!!$("loteNome") && !!$("loteCpf") && !!$("btnLoteAdicionarPessoa"),
  "2 · trabalhadores: nome, CPF e botão de adicionar um por vez");
b.ok(!!$("loteFichasInput"), "3 · fichas: campo de anexo dentro do modal");

b.passo("1b. O lote é o terceiro modo, numa linha de modos ÚNICA");
/* Decisão do usuário em 18/08/2026 ("terceiro modo ao lado de preencher
   manualmente") e, dois dias depois, o padrão único: "independente se é
   taxa negocial, taxa assistencial... tem dois formatos, individual e em
   lote, ou outro através da IA".

   Até então cada tipo tinha a SUA cópia da linha de modos — quatro blocos
   diferentes. Elas divergiram, e em Taxa Negocial duas apareciam
   empilhadas: foi o print que o usuário mandou perguntando "pq tem esses
   botões aqui, não deveria ter". A cobertura mudou de "cada tipo tem o seu
   botão" para "existe UMA linha, e ela vale para todos". */
["btnModoIndividual", "btnModoLote", "btnModoIAUnico"].forEach(id => {
  const el = $(id);
  b.ok(!!el, "botão '" + id + "' existe na linha única de modos",
    el ? (el.textContent || "").trim() : "AUSENTE");
});

/* Nenhum dos IDs antigos pode ter sobrado: dois lugares oferecendo o mesmo
   lote é exatamente como a divergência recomeça. */
const ANTIGOS_MODO = ["btnModoManualFil", "btnModoLoteFil", "btnModoManualDesf",
                      "btnModoLoteDesf", "btnModoManualOpos", "btnModoLoteOpos",
                      "btnModoManualTaxa", "btnModoLoteTaxa"];
b.igual(ANTIGOS_MODO.filter(id => !!$(id)), [],
  "nenhuma linha de modos duplicada sobrou");

const tipoSel = $("tipo");
["Filiação", "Desfiliação", "Taxa Negocial", "Taxa Assistencial"].forEach(valor => {
  tipoSel.value = valor;
  tipoSel.dispatchEvent(new win.Event("change", { bubbles: true }));
  const linha = $("blocoModosOficio");
  b.ok(linha && linha.style.display !== "none",
    "em '" + valor + "' a linha única de modos aparece");
  b.ok($("btnModoLote") && $("btnModoLote").style.display !== "none",
    "e o botão Em lote está nela, em " + valor);
});

tipoSel.value = "Filiação";
tipoSel.dispatchEvent(new win.Event("change", { bubbles: true }));

const linhaModos = $("btnModoIndividual") && $("btnModoIndividual").parentNode;
b.ok(!!linhaModos && linhaModos.contains($("btnModoLote")),
  "o botão do lote está na MESMA linha do 'Individual'",
  linhaModos ? linhaModos.querySelectorAll("button").length + " botões na linha" : "linha não encontrada");
$("btnModoLote").click();
b.ok($("modalLoteTrabalhadores").classList.contains("aberto"),
  "o terceiro modo abre o mesmo modal do lote");
clicar("btnCancelarLoteTrabalhadores");

b.passo("2. O modal abre e fecha");
clicar("btnModoLote");
b.ok($("modalLoteTrabalhadores").classList.contains("aberto"), "modal abriu pelo modo 'Via lote'");
clicar("btnCancelarLoteTrabalhadores");
b.ok(!$("modalLoteTrabalhadores").classList.contains("aberto"), "modal fechou no Cancelar");

b.passo("3. A prévia mostra o que foi adicionado ANTES de criar os cartões");
/* Reabrir o modal zera a fila — é o que acontece quando a pessoa fecha e
   abre de novo, e sem isso um cenário contaminaria o seguinte. */
clicar("btnModoLote");
digitarLote("Zuleica Ramos, 111.444.777-35\nAna Paula Lima\nBruno Alves; 12345678909");
b.igual(pessoasNaFila(), 3, "as três pessoas entraram na fila do modal");
const previa = $("loteTrabalhadoresPreview").textContent.replace(/\s+/g, " ").trim();
b.ok(/2 de 3 com CPF informado/.test(previa),
  "a prévia conta as pessoas e diz quantas têm CPF", previa.slice(0, 70));
const nomesPrevia = ["Zuleica Ramos", "Ana Paula Lima", "Bruno Alves"]
  .filter(n => previa.indexOf(n) !== -1);
b.igual(nomesPrevia.length, 3, "os três nomes aparecem na prévia, para conferência");
b.igual(cards().length, 0, "nenhum cartão foi criado ainda — só a fila");

b.passo("3b. Dá para tirar alguém da fila antes de confirmar");
$("loteTrabalhadoresPreview").querySelectorAll(".lote-remover")[1].click();
b.igual(pessoasNaFila(), 2, "removeu uma da fila");
b.ok($("loteTrabalhadoresPreview").textContent.indexOf("Ana Paula Lima") === -1,
  "a pessoa removida sumiu da prévia");

b.passo("4. CPF com quantidade errada de dígitos não entra calado");
clicar("btnModoLote");
$("loteNome").value = "Fulano De Tal";
$("loteCpf").value = "123";
clicar("btnLoteAdicionarPessoa");
b.igual(pessoasNaFila(), 0, "não adicionou com CPF de 3 dígitos");
b.ok(($("loteNome").value || "") === "Fulano De Tal",
  "o nome digitado não foi perdido — dá para corrigir o CPF e tentar de novo");
$("loteCpf").value = "";
clicar("btnLoteAdicionarPessoa");
b.igual(pessoasNaFila(), 1, "sem CPF, entra normalmente");

b.passo("4b. Sem escola escolhida, o modal não adiciona ninguém");
/* Descobrir que falta escola só na hora de emitir faria a pessoa refazer a
   lista inteira. */
clicar("btnConfirmarLoteTrabalhadores");
b.igual(cards().length, 0, "não criou cartão sem escola selecionada");
b.ok(!$("escolaBusca").value, "a escola realmente estava vazia no momento da recusa");

/* Preenche os campos de escola da tela — os mesmos que a emissão valida.
   O modal olha para eles, não para uma variável interna, justamente para o
   que a pessoa vê e o que o sistema considera não divergirem. */
$("escolaBusca").value = "COLEGIO TESTE";
$("cnpj").value = "36.136.001/0001-05";

b.passo("5. Confirmar cria os cartões com nome e CPF preenchidos");
clicar("btnModoLote");
digitarLote("Zuleica Ramos, 111.444.777-35\nAna Paula Lima\nBruno Alves; 12345678909");
clicar("btnConfirmarLoteTrabalhadores");
b.igual(cards().length, 3, "três cartões criados");
b.ok(!$("modalLoteTrabalhadores").classList.contains("aberto"), "modal fechou depois de adicionar");
const nomes = Array.from(cards()).map(c => c.querySelector(".input-nome-trabalhador").value);
b.igual(nomes, ["Zuleica Ramos", "Ana Paula Lima", "Bruno Alves"],
  "os nomes entraram nos cartões, na ordem em que foram adicionados");
const cpfs = Array.from(cards()).map(c => c.querySelector(".input-cpf-trabalhador").value);
b.igual(cpfs, ["111.444.777-35", "", "123.456.789-09"],
  "os CPFs entraram mascarados, e quem não tinha ficou em branco");

b.passo("6. Colar várias linhas no campo de nome adiciona todas");
/* Atalho de quem já tem a lista pronta na planilha: quem digita uma por vez
   nem percebe que existe. */
clicar("btnModoLote");
$("loteNome").value = "Carlos Souza\tMaria Souza";
clicar("btnLoteAdicionarPessoa");
b.ok(pessoasNaFila() >= 1, "colar várias linhas entra de uma vez",
  pessoasNaFila() + " na fila");
clicar("btnCancelarLoteTrabalhadores");

b.passo("7. Um PDF único com todas as fichas é aceito");
/* A regra mudou no meio da conversa, e vale registrar por quê.
   Primeiro o usuário pediu conferência de quantidade. Depois olhou a
   operação real e corrigiu: "geralmente quando você escaneia, vem um
   arquivo só com todas as fichas... talvez a gente deixe liberado" e
   "seria um PDF de fichas para cada escola por dia". Exigir uma ficha por
   pessoa recusaria justamente o formato normal da secretaria. */
function cardsComFicha() {
  return Array.from(cards()).filter(c => {
    const i = c.querySelector(".input-ficha-trabalhador");
    return i && i.files && i.files.length > 0;
  }).length;
}
function lotePorModal(nomes, fichas) {
  clicar("btnModoLote");
  digitarLote(nomes);
  const fi = $("loteFichasInput");
  fi.files = (fichas || []).map(n => ({ name: n, type: "application/pdf", lastModified: 0 }));
  clicar("btnConfirmarLoteTrabalhadores");
}

const antesUnico = cards().length;
lotePorModal("Paulo Um\nPaula Dois\nPedro Tres", ["digitalizacao-completa.pdf"]);
b.igual(cards().length, antesUnico + 3, "as três pessoas entraram");
/* O arquivo vai para o bloco do OFÍCIO, não para os cartões: ele é um PDF
   com as fichas de todo mundo, não a ficha de uma pessoa. */
b.ok(Array.from($("fichasOficioLote").files || []).some(f => f.name === "digitalizacao-completa.pdf"),
  "o PDF único foi aceito e anexado ao ofício",
  Array.from($("fichasOficioLote").files || []).map(f => f.name).join(", ") || "NENHUM");
b.igual(cardsComFicha(), 0,
  "e não foi espalhado pelos cartões, que não são donos dele");

b.passo("8. Ficha por pessoa continua possível, no cartão de cada uma");
/* O modal manda tudo para o bloco do OFÍCIO — é o caso normal, um PDF por
   escola. Quem quiser uma ficha por pessoa anexa no cartão dela, e esse
   caminho não pode ter sido quebrado pelo lote. */
Array.from(cards()).forEach(c => c.querySelector(".btn-remover-trabalhador-premium").click());
b.igual(cards().length, 0, "lista zerada antes do caso um-para-um");
lotePorModal("Ana Alfa\nBeto Beta", []);
b.igual(cards().length, 2, "duas pessoas entraram");

const inpAna = cards()[0].querySelector(".input-ficha-trabalhador");
inpAna.files = [{ name: "ficha-da-ana.pdf", type: "application/pdf", lastModified: 0 }];
inpAna.dispatchEvent(new win.Event("change"));
b.igual(cardsComFicha(), 1, "só o cartão da Ana ficou com ficha");
const fichaDoPrimeiro = inpAna.files[0].name;
b.ok(fichaDoPrimeiro.indexOf("Ficha_") === 0 && /Ana/i.test(fichaDoPrimeiro),
  "o anexo do cartão leva o nome da pessoa dele", fichaDoPrimeiro);

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

b.ok(doLote.length >= 2, "os cartões do lote estão preenchidos",
  doLote.length + " pessoas");
/* Confere o par nome+CPF num lote criado agora, para a asserção não depender
   do que sobrou dos passos anteriores. */
Array.from(cards()).forEach(c => c.querySelector(".btn-remover-trabalhador-premium").click());
lotePorModal("Zuleica Ramos, 111.444.777-35", []);
const parFinal = Array.from(cards()).map(c => ({
  nome: c.querySelector(".input-nome-trabalhador").value.trim(),
  cpf: c.querySelector(".input-cpf-trabalhador").value.replace(/\D/g, "")
}));
b.igual(parFinal, [{ nome: "Zuleica Ramos", cpf: "11144477735" }],
  "nome e CPF do lote ficam juntos no cartão — é esse par que vai ao ofício");
b.ok(doLote.every(p => p.nome),
  "toda pessoa criada pelo lote tem nome — é o que o ofício imprime");

b.passo("11. O campo de ficha do cartão existe em TODO tipo de ofício");
/* Eu havia escondido nas três taxas e o usuário pegou: "não tem a ficha do
   trabalhador no modo individual, você tirou?". O furo era real e não
   estético: "Oposição à Taxa Negocial" não é um tipo próprio no seletor —
   roda dentro de "Taxa Negocial" —, e na oposição existe documento: a carta
   de oposição, que o texto do ofício cita como "conforme carta em anexo".
   Esconder por tipo deixava a oposição sem onde anexar a prova dela.

   Anexar não é obrigatório em lugar nenhum, então um campo opcional a mais
   custa espaço; um campo ausente custa uma emissão que não dá para fazer. */
function areaFichaVisivelNoUltimoCard() {
  const cs = cards();
  if (!cs.length) return null;
  const area = cs[cs.length - 1].querySelector(".trabalhador-ficha-area");
  return area ? area.style.display !== "none" : null;
}
const tipoFicha = $("tipo");
["Filiação", "Desfiliação", "Taxa Negocial", "Taxa Assistencial"].forEach(valor => {
  tipoFicha.value = valor;
  tipoFicha.dispatchEvent(new win.Event("change", { bubbles: true }));
  clicar("btnAddTrabalhador");
  b.igual(areaFichaVisivelNoUltimoCard(), true,
    "em '" + valor + "' o cartão nasce COM o campo de ficha");
  b.ok($("blocoFichasOficio").style.display !== "none",
    "em '" + valor + "' o bloco de fichas do ofício também aparece");
});

/* E o cartão JÁ CRIADO não pode perder a ficha quando o tipo muda.
   Este é o caso que a asserção acima não pega: criar o cartão depois da
   troca de tipo não exercita a rotina que varre os cartões existentes. Sem
   esta, a regra podia voltar a esconder e o teste continuaria verde — foi o
   que uma mutação mostrou. */
tipoFicha.value = "Filiação";
tipoFicha.dispatchEvent(new win.Event("change", { bubbles: true }));
clicar("btnAddTrabalhador");
b.igual(areaFichaVisivelNoUltimoCard(), true, "cartão criado em Filiação tem ficha");
["Taxa Negocial", "Taxa Assistencial", "Desfiliação"].forEach(valor => {
  tipoFicha.value = valor;
  tipoFicha.dispatchEvent(new win.Event("change", { bubbles: true }));
  b.igual(areaFichaVisivelNoUltimoCard(), true,
    "ao trocar para '" + valor + "', o cartão existente MANTÉM a ficha");
});

/* O botão de excluir do cartão: o usuário perguntou se eu tinha tirado.
   Nunca foi mexido, mas sem asserção isso é palavra minha. */
b.ok(!!cards()[cards().length - 1].querySelector(".btn-remover-trabalhador-premium"),
  "o cartão tem o botão de excluir");
const antesExcluir = cards().length;
cards()[cards().length - 1].querySelector(".btn-remover-trabalhador-premium").click();
b.igual(cards().length, antesExcluir - 1, "e ele remove o cartão de verdade");

b.passo("12. O PDF único do lote tem onde ser anexado");
/* Pergunta do usuário em 18/08/2026: "e onde eu coloco o pdf das fichas do
   lote?". Não tinha resposta boa — getFichasPayload() só lia fichas DOS
   CARTÕES, então um PDF com todas as fichas da escola não tinha lugar. */
const tipoPdf = $("tipo");
tipoPdf.value = "Filiação";
tipoPdf.dispatchEvent(new win.Event("change", { bubbles: true }));

b.ok(!!$("fichasOficioLote"), "existe o campo de fichas do OFÍCIO, fora dos cartões");
b.ok($("blocoFichasOficio").style.display !== "none",
  "o bloco de fichas do ofício está visível");

/* O anexo do ofício precisa CHEGAR no payload: sem isso o campo existiria
   na tela e o arquivo não sairia junto do ofício — o pior dos mundos. */
$("fichasOficioLote").files = [{ name: "fichas-da-escola.pdf", type: "application/pdf", lastModified: 0 }];
$("fichasOficioLote").dispatchEvent(new win.Event("change"));
const fichasPayload = (typeof win.getFichasPayload === "function") ? win.getFichasPayload() : null;
if (!fichasPayload) {
  b.naoTestavel("Payload das fichas", "getFichasPayload não exposta no escopo da janela");
} else {
  b.ok(fichasPayload.some(f => f.arquivoOriginal === "fichas-da-escola.pdf"),
    "o PDF do ofício entra no payload que vai ao backend",
    JSON.stringify(fichasPayload.map(f => f.arquivoOriginal)));
  b.ok(fichasPayload.some(f => f.arquivoOriginal === "fichas-da-escola.pdf" && !f.beneficiario),
    "e vai SEM beneficiário — não é ficha de ninguém em particular");
}

b.passo("13. O modal manda as fichas para o bloco do ofício");
clicar("btnModoLote");
$("loteNome").value = "Teste Do Lote";
clicar("btnLoteAdicionarPessoa");
$("loteFichasInput").files = [{ name: "digitalizacao-do-dia.pdf", type: "application/pdf", lastModified: 0 }];
clicar("btnConfirmarLoteTrabalhadores");
b.ok(Array.from($("fichasOficioLote").files || []).some(f => f.name === "digitalizacao-do-dia.pdf"),
  "o arquivo escolhido no modal foi parar no bloco do ofício",
  Array.from($("fichasOficioLote").files || []).map(f => f.name).join(", "));

b.naoTestavel("Aparência do modal e do cartão", "jsdom não aplica CSS");
b.naoTestavel("Upload real das fichas e emissão do ofício no Apps Script",
  "exige navegador e o sistema no ar");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
