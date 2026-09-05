/**
 * TESTE — PADRÃO ÚNICO DE EMISSÃO DE OFÍCIO
 *
 * O QUE ORIGINOU
 *
 * Pedido do usuário em 18/08/2026, com estas palavras: "o que eu preciso
 * que funcione, independente se é taxa negocial, taxa assistencial, ofício
 * livre... tem dois formatos: formato individual e formato em lote, ou
 * outro através da IA pra leitura. E todos eles têm um campo trabalhador,
 * tem um campo de escola, você pode adicionar até cinquenta trabalhador...
 * o CPF não precisa ser obrigatório. Em lote eu não preciso ficha... e no
 * final você incluir o PDF único. Aí vai gerar o documento, aí eu posso
 * baixar, posso imprimir, posso enviar por e-mail, posso enviar por
 * WhatsApp. Essa sequência é um padrão único."
 *
 * Na conversa seguinte ele corrigiu um ponto do meu desenho: o OFÍCIO LIVRE
 * é a exceção. "Vamos enviar um ofício pro governo do estado, vou enviar um
 * ofício para secretaria de saúde. Então usa um padrão de ofício, mas o
 * texto é livre." Ou seja: papel timbrado e número sequencial sim; escola e
 * trabalhadores não.
 *
 * E sobre o CPF: "pode ser opcional, mas a sugestão que eu sei falar pra
 * quem trabalha no SISGEP é que inclua o CPF, que tem muita gente que não
 * sabe nem o próprio CPF". Opcional, com o sistema pedindo — não exigindo.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Monta a tela num DOM real e, para cada um dos cinco tipos, troca o
 * seletor e mede o que ficou visível. Antes de existir a correção ele
 * documentava o estado que o usuário encontrou:
 *
 *   Taxa Assistencial ... sem botão de IA (correto), mas a linha de modos
 *                         era uma cópia separada das outras três
 *   Ofício Livre ........ sem modo nenhum E com a seção de texto livre
 *                         que NUNCA abre — nada no projeto inteiro dá
 *                         display nela. O tipo estava inutilizável.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência (jsdom não aplica CSS), a emissão real e o PDF que sai.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("OFÍCIOS · Padrão único: individual, lote e IA em todos os tipos");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Padrão único na tela", "jsdom não instalado (npm install)");
  b.resumo();
  process.exit(process.exitCode || 0);
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

/** Visível de verdade: nenhum ancestral com display:none. */
function visivel(id) {
  let n = $(id);
  if (!n) return false;
  while (n && n.style) {
    if (n.style.display === "none") return false;
    n = n.parentElement;
  }
  return true;
}

function escolherTipo(t) {
  $("tipo").value = t;
  $("tipo").dispatchEvent(new win.Event("change", { bubbles: true }));
}

/* A OPOSIÇÃO virou tipo próprio no seletor em 18/08/2026. Antes ela existia
   só no backend e era alcançável apenas pelo caminho da IA — quem precisava
   emitir uma oposição escolhia "Taxa Negocial" e recebia a COBRANÇA, o
   contrário do que queria mandar. Palavras do usuário: "eu não estou
   cobrando as escolas; esse ofício é ofício de oposição à taxa negocial". */
const COM_ESCOLA = ["Filiação", "Desfiliação", "Taxa Negocial",
                    "Oposição à Taxa Negocial", "Taxa Assistencial"];
const COM_IA     = ["Filiação", "Desfiliação", "Oposição à Taxa Negocial"];

/* ═══════════════════════════════════════════════════════════
   1. Uma linha de modos só — não quatro cópias
   ═══════════════════════════════════════════════════════════

   As quatro cópias (blocoFiliacaoIA, blocoDesfiliacaoIA,
   blocoOposicaoTaxaIA, blocoModoTaxas) foram a causa direta do "por que tem
   esses botões aqui" e das duas linhas empilhadas que o usuário fotografou.
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
b.ok(!!$("blocoModosOficio"), "existe UMA linha de modos na tela");
b.ok(!!$("btnModoIndividual"), "botão Individual existe");
b.ok(!!$("btnModoLote"),       "botão Em lote existe");
b.ok(!!$("btnModoIAUnico"),    "botão Extrair com IA existe");

/* As linhas antigas não podem ter sobrado: duas linhas de modo na mesma
   tela é exatamente o defeito que o usuário viu. */
b.passo("2");
const ANTIGOS = ["btnModoManualFil", "btnModoIAFil", "btnModoLoteFil",
                 "btnModoManualDesf", "btnModoIADesf", "btnModoLoteDesf",
                 "btnModoManualOpos", "btnModoIAOpos", "btnModoLoteOpos",
                 "btnModoManualTaxa", "btnModoLoteTaxa"];
const sobraram = ANTIGOS.filter(id => !!$(id));
b.igual(sobraram, [], "nenhuma linha de modos duplicada sobrou na tela");

/* ═══════════════════════════════════════════════════════════
   2. Individual e Lote em todos os tipos com escola
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
COM_ESCOLA.forEach(t => {
  escolherTipo(t);
  b.ok(visivel("btnModoIndividual"), "Individual aparece em " + t);
  b.ok(visivel("btnModoLote"),       "Em lote aparece em " + t);
  b.ok(visivel("secaoOficioPadrao"), "escola e trabalhadores aparecem em " + t);
});

/* IA só onde existe documento para ler. Em Taxa Assistencial não existe
   carta nem ficha para a IA ler — botão que não faz nada é pior que botão
   ausente. */
b.passo("4");
COM_IA.forEach(t => {
  escolherTipo(t);
  b.ok(visivel("btnModoIAUnico"), "Extrair com IA aparece em " + t);
});
escolherTipo("Taxa Assistencial");
b.ok(!visivel("btnModoIAUnico"), "Extrair com IA NÃO aparece em Taxa Assistencial",
  "não há documento para a IA ler nesse tipo");

/* ═══════════════════════════════════════════════════════════
   3. Ofício Livre — a exceção, e ela precisa funcionar
   ═══════════════════════════════════════════════════════════

   "Vamos enviar um ofício pro governo do estado... usa um padrão de ofício,
   mas o texto é livre." Sem escola, sem trabalhadores, sem os três modos.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
escolherTipo("Ofício Livre");
b.ok(visivel("secaoOficioLivre"),
  "a seção de texto livre ABRE ao escolher Ofício Livre",
  "antes ela nascia display:none e nada no projeto a abria — o tipo era inutilizável");
b.ok(!visivel("secaoOficioPadrao"),
  "escola e trabalhadores somem no Ofício Livre");
b.ok(!visivel("blocoModosOficio"),
  "a linha de modos some no Ofício Livre — não há individual nem lote aqui");

b.passo("6");
["para", "cargo", "assunto", "corpo", "emailLivreAux"].forEach(id => {
  b.ok(visivel(id), "o campo " + id + " está acessível no Ofício Livre");
});

/* Voltar para um tipo com escola tem que desfazer tudo. Sem esta asserção,
   esconder a seção padrão "para sempre" passaria no teste acima. */
b.passo("7");
escolherTipo("Taxa Negocial");
b.ok(visivel("secaoOficioPadrao"), "ao sair do Ofício Livre, escola e trabalhadores voltam");
b.ok(!visivel("secaoOficioLivre"), "e a seção de texto livre some");
b.ok(visivel("blocoModosOficio"),  "e a linha de modos volta");

/* ═══════════════════════════════════════════════════════════
   4. A ficha muda de lugar entre Individual e Lote
   ═══════════════════════════════════════════════════════════

   É a ÚNICA diferença entre os dois formatos. Todo o resto — escola,
   nomes, CPF, limite, revisão, emissão — é o mesmo caminho.
   ═══════════════════════════════════════════════════════════ */
b.passo("8");
escolherTipo("Taxa Negocial");
$("btnModoIndividual").click();
$("btnAddTrabalhador").click();
const ficha = doc.querySelector("#listaTrabalhadores .trabalhador-ficha-area");
b.ok(!!ficha, "no modo Individual o cartão do trabalhador tem campo de ficha");
b.ok(ficha && ficha.style.display !== "none",
  "e o campo de ficha está visível", "foi o que o usuário cobrou: 'vc tirou?'");

b.passo("9");
$("btnModoLote").click();
const fichaLote = doc.querySelector("#listaTrabalhadores .trabalhador-ficha-area");
b.ok(fichaLote && fichaLote.style.display === "none",
  "no modo Em lote a ficha por trabalhador some");
b.ok(visivel("blocoFichasOficio"),
  "e o bloco do PDF único do lote aparece");

/* Volta para Individual: a ficha por pessoa tem que voltar. */
b.passo("10");
$("btnModoIndividual").click();
const fichaVolta = doc.querySelector("#listaTrabalhadores .trabalhador-ficha-area");
b.ok(fichaVolta && fichaVolta.style.display !== "none",
  "voltando para Individual, a ficha por trabalhador volta");

/* O ✕ continua removendo o cartão, em qualquer modo. */
b.passo("11");
const antes = doc.querySelectorAll("#listaTrabalhadores .trabalhador-card").length;
doc.querySelector("#listaTrabalhadores .btn-remover-trabalhador-premium").click();
const depois = doc.querySelectorAll("#listaTrabalhadores .trabalhador-card").length;
b.igual(depois, antes - 1, "o botão ✕ remove o cartão do trabalhador");

/* ═══════════════════════════════════════════════════════════
   5. CPF opcional nos cinco tipos, com o sistema pedindo
   ═══════════════════════════════════════════════════════════ */
b.passo("12");
b.ok(typeof win.oficioExigeCpf === "function",
  "existe uma regra única de obrigatoriedade de CPF");
COM_ESCOLA.forEach(t => {
  b.ok(win.oficioExigeCpf(t) === false, "CPF é opcional em " + t);
});

/* Opcional não é indiferente: a tela pede o CPF, porque sem ele o ofício
   sai sem o dado que liga a pessoa ao cadastro. "Muita gente não sabe nem
   o próprio CPF" — então o sistema pede, e deixa passar. */
b.passo("13");
escolherTipo("Desfiliação");
$("btnModoIndividual").click();
$("btnAddTrabalhador").click();
const cardCpf = doc.querySelector("#listaTrabalhadores .trabalhador-card");
const rotuloCpf = cardCpf ? String(cardCpf.textContent || "") : "";
b.ok(/opcional/i.test(rotuloCpf),
  "o rótulo do CPF diz que é opcional", "para ninguém travar achando que é obrigatório");
b.ok(!!(cardCpf && cardCpf.querySelector(".cpf-recomendacao")),
  "e a tela explica por que vale a pena preencher");

/* ═══════════════════════════════════════════════════════════
   6. Limite de 50 igual em todos
   ═══════════════════════════════════════════════════════════ */
b.passo("14");
["Filiação", "Desfiliação", "Taxa Negocial", "Taxa Assistencial"].forEach(t => {
  b.igual(win.oficioLimitePessoas(t), 50, "limite de 50 trabalhadores em " + t);
});

/* ═══════════════════════════════════════════════════════════
   7. CPF opcional TAMBÉM na hora de emitir
   ═══════════════════════════════════════════════════════════

   O usuário mandou o print: o rótulo dizia "CPF (opcional)" e, ao clicar em
   emitir, aparecia "Complete nome e CPF." Eu tinha criado oficioExigeCpf()
   devolvendo false e esquecido de ligar na emissão — a regra existia e não
   valia. Rótulo dizendo uma coisa e botão fazendo outra é pior que exigir o
   CPF abertamente: a pessoa não entende por que não consegue emitir.
   ═══════════════════════════════════════════════════════════ */
b.passo("15");
const fonteEmissao = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
b.ok(!/oficioExigeFichaECpf\([^)]*\)\s*&&[^;]*!b\.cpf/.test(fonteEmissao),
  "nenhuma trava de emissão exige CPF por tipo",
  "a checagem tem que passar por oficioExigeCpf(), que devolve false");

b.passo("16");
["Filiação", "Desfiliação", "Taxa Negocial", "Taxa Assistencial"].forEach(t => {
  b.ok(win.oficioExigeCpf(t) === false, "emitir " + t + " sem CPF não é bloqueado");
});

/* Contraprova: a FICHA continua exigida onde ela é a prova da autorização do
   desconto. Sem esta asserção, apagar as duas travas passaria. */
b.passo("17");
b.ok(/oficioExigeFichaECpf\(d\.tipo\)\s*&&\s*!todosArquivosTemAlgumaFicha\(\)/.test(fonteEmissao),
  "a exigência de ficha em Filiação e Desfiliação continua de pé");

/* ═══════════════════════════════════════════════════════════
   8. O lote preenche o cartão vazio antes de criar outro
   ═══════════════════════════════════════════════════════════

   Sugestão do usuário, com o print: "quando for em lote ele deveria mudar o
   card de trabalhador acima e não criar outro". A tela nasce com um cartão
   em branco; sem isto o lote empilhava os nomes DEPOIS dele e sobrava um
   "Trabalhador 1" vazio — que ainda barrava a emissão por "Complete o nome".
   ═══════════════════════════════════════════════════════════ */
b.passo("18");
escolherTipo("Taxa Negocial");
$("btnModoIndividual").click();
doc.querySelectorAll("#listaTrabalhadores .trabalhador-card").forEach(c => c.remove());
$("btnAddTrabalhador").click();
b.igual(doc.querySelectorAll("#listaTrabalhadores .trabalhador-card").length, 1,
  "a tela começa com um cartão em branco");

/* Escola pelos campos visíveis — é o que loteConfirmar valida. */
$("escolaBusca").value = "COLEGIO EXEMPLO LTDA";
$("cnpj").value = "36.136.001/0001-05";

/* Dirigido pela TELA, não por função interna: o lote não é exposto no
   window, e chamar por dentro testaria um caminho que o atendente não usa. */
function lote(nomes) {
  $("btnModoLote").click();
  nomes.forEach(n => {
    $("loteNome").value = n;
    $("loteCpf").value = "";
    $("btnLoteAdicionarPessoa").click();
  });
  $("btnConfirmarLoteTrabalhadores").click();
}
function nomesNaTela() {
  return Array.from(doc.querySelectorAll("#listaTrabalhadores .trabalhador-card"))
    .map(c => (c.querySelector(".input-nome-trabalhador") || {}).value || "");
}

lote(["CLARA GOMES", "ANA LIMA", "JOAO REIS"]);
b.igual(nomesNaTela().length, 3,
  "3 pessoas no lote geram 3 cartões — o vazio foi aproveitado, não somado");

b.passo("19");
b.igual(nomesNaTela(), ["CLARA GOMES", "ANA LIMA", "JOAO REIS"],
  "e o primeiro cartão ficou com o primeiro nome, sem sobra em branco");

/* Contraprova: com a lista JÁ preenchida, o lote não pode sobrescrever
   ninguém — aí ele cria cartões novos mesmo. */
b.passo("20");
lote(["MARIA SOUZA"]);
b.igual(nomesNaTela(), ["CLARA GOMES", "ANA LIMA", "JOAO REIS", "MARIA SOUZA"],
  "com todos os cartões preenchidos, o lote acrescenta sem apagar nada");

/* ═══════════════════════════════════════════════════════════
   9. A oposição é escolhível no seletor, e traz o texto dela
   ═══════════════════════════════════════════════════════════ */
b.fluxo("OFÍCIOS · Oposição à Taxa Negocial como tipo próprio");

b.passo("21");
const opcoes = Array.from($("tipo").options).map(o => o.value);
b.ok(opcoes.indexOf("Oposição à Taxa Negocial") > -1,
  "a oposição aparece na lista de tipos", opcoes.join(" | "));
b.ok(opcoes.indexOf("Taxa Negocial") > -1,
  "e a cobrança continua existindo, separada",
  "quem for cobrar em setembro/2026 precisa dela");

/* Os rótulos têm que deixar claro qual é qual — escolher errado aqui manda
   a escola descontar quando era para NÃO descontar. */
b.passo("22");
const rotulos = Array.from($("tipo").options).map(o => o.textContent.trim());
b.ok(rotulos.some(r => /cobran(ç|c)a/i.test(r)),
  "o rótulo da cobrança diz que é cobrança", rotulos.join(" | "));
b.ok(rotulos.some(r => /oposi(ç|c)(ã|a)o/i.test(r)),
  "e o da oposição diz que é oposição");

b.passo("23");
escolherTipo("Oposição à Taxa Negocial");
b.ok(visivel("secaoOficioPadrao"), "a oposição tem escola e trabalhadores");
b.ok(visivel("blocoModosOficio"),  "e a linha de modos");
b.ok(visivel("btnModoIAUnico"),    "com IA, porque existe carta para ler");

/* O bloco de leitura da carta de oposição segue o tipo NOVO. Antes ele
   aparecia em "Taxa Negocial" — na tela de cobrança, onde não faz sentido. */
b.passo("24");
b.ok(visivel("blocoOposicaoTaxaIA"),
  "a área de leitura da carta de oposição aparece na oposição");
escolherTipo("Taxa Negocial");
b.ok(!visivel("blocoOposicaoTaxaIA"),
  "e NÃO aparece na cobrança");

/* O que fecha o caso do usuário: escolher a oposição tem que produzir o
   texto da oposição, não o da cobrança. */
b.passo("25");
function corpoDe(tipo) {
  return String(g.montarDadosOficio_({
    tipo: tipo, escola: "COLEGIO EXEMPLO", cnpj: "36136001000105",
    colaboradores: [{ nome: "CLARA GOMES" }]
  }, "preview").corpoTexto || "");
}
const txtOpos = corpoDe("Oposição à Taxa Negocial");
b.ok(/N(Ã|A)O seja efetuado o desconto/.test(txtOpos),
  "escolher a oposição gera o texto que manda NÃO descontar");
b.ok(!/6% \(seis por cento\)/.test(txtOpos),
  "e NÃO o texto de cobrança",
  "era o defeito: escolhia oposição e saía cobrança");

const txtCobr = corpoDe("Taxa Negocial");
b.ok(/6% \(seis por cento\)/.test(txtCobr),
  "e a cobrança continua gerando o texto de cobrança");

/* ═══════════════════════════════════════════════════════════
   10. O card da escola não esmaga a identidade nem exibe ações legadas
   ═══════════════════════════════════════════════════════════

   Em uma coluna estreita, as três ações consumiam toda a largura e faziam
   CNPJ/endereço quebrar letra por letra. Além disso, a regra display:flex
   dos botões anulava o atributo HTML hidden de duas ações de compatibilidade.
   ═══════════════════════════════════════════════════════════ */
b.passo("26");
const fonteCss = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosStyles.html"), "utf8");
b.ok(/\.escola-profile-head-premium\s*\{[^}]*flex-wrap:\s*wrap/s.test(fonteCss),
  "o cabeçalho do card permite levar as ações para uma segunda linha");
b.ok(/\.escola-profile-main\s*\{[^}]*flex:\s*1\s+1\s+280px/s.test(fonteCss),
  "a identidade da escola mantém largura legível antes de dividir espaço");
b.ok(/\.escola-profile-actions\s+button\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s.test(fonteCss),
  "ações legadas marcadas como hidden continuam realmente ocultas");
b.ok($("btnConsultarCnpjSmart").hidden && $("btnSalvarEscolaSmart").hidden,
  "Consultar CNPJ e Salvar cadastro não aparecem duplicados no card compacto");

b.resumo();
