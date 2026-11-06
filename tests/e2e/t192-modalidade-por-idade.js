/**
 * TESTE — A MODALIDADE É SUGERIDA PELA IDADE, E "PARA MIM" IMPÕE O TITULAR
 *
 * Duas coisas que você apontou em 22/09/2026, olhando a tela publicada:
 *
 *   1. "Pela idade dos dependentes eles poderiam limitar a modalidade,
 *      correto?" — e a resposta combinada foi SUGERIR, não limitar.
 *   2. Um print com "Para mim" marcado e a tela dizendo "Filho(a)", com o
 *      nome de outra pessoa e "1º filho".
 *
 * O SEGUNDO É O MAIS GRAVE, e é defeito de uma linha: ao escolher "para
 * mim", o tipo de beneficiário só era ajustado QUANDO ESTAVA VAZIO. Quem
 * tivesse escolhido Filho(a) antes levava a escolha antiga junto, e a
 * solicitação chegava ao servidor dizendo duas coisas contrárias sobre a
 * mesma pessoa.
 *
 * O PRIMEIRO TEM UMA ARMADILHA que este teste guarda: LIMITAR seria repetir
 * um defeito já medido. Em 17/09 a tela recusava cinco casos que a convenção
 * aprova (filho de 16 no Fundamental, de 19 no Médio, de 13 no Técnico, de
 * 10 no Médio, criança de 4 no Fundamental). Esconder as opções fora da
 * faixa traria o mesmo estrago de volta — e pior, sem mensagem nenhuma.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("PORTAL · modalidade sugerida pela idade");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Sugestão de modalidade", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const tela = dom.montar(g, ["PortalVoucher.html"], { token: "" });
const win = tela.win, doc = win.document;

function campo(id) { return doc.getElementById(id); }

/* O menu vem do servidor; o teste o semeia como o carregamento faria. */
const MODALIDADES = [
  { value: "CRECHE", label: "Creche (0–3 anos)" },
  { value: "EDUCACAO_INFANTIL", label: "Educação Infantil (4–5 anos)" },
  { value: "ENSINO_FUNDAMENTAL", label: "Ensino Fundamental (6–14 anos)" },
  { value: "ENSINO_MEDIO", label: "Ensino Médio (15–17 anos)" },
  { value: "PRE_VESTIBULAR", label: "Pré-Vestibular" },
  { value: "GRADUACAO", label: "Graduação" },
  { value: "POS_GRADUACAO", label: "Pós-Graduação" }
];
win.INIT.modalidades = MODALIDADES;
campo("modalidade").innerHTML =
  '<option value="">Selecione...</option>' +
  MODALIDADES.map(function (m) {
    return '<option value="' + m.value + '">' + m.label + '</option>';
  }).join("");

function anosAtras(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() - 1);   /* um dia a mais, para não depender do aniversário de hoje */
  return d.toISOString().slice(0, 10);
}

/* ── 1. A CONTA DA IDADE ─────────────────────────────────────────────── */
b.passo("1. A idade sai da data, e o aniversário do dia conta certo");
b.igual(win.idadeEmAnos(anosAtras(15)), 15, "quinze anos");
b.igual(win.idadeEmAnos(anosAtras(3)), 3, "três anos");
b.igual(win.idadeEmAnos(""), null, "sem data, não inventa idade");
b.igual(win.idadeEmAnos("data-qualquer"), null, "texto que não é data também não");

/* ── 2. A FAIXA ──────────────────────────────────────────────────────── */
b.passo("2. Cada faixa sugere a sua modalidade");
[[2, "CRECHE"], [3, "CRECHE"], [4, "EDUCACAO_INFANTIL"], [5, "EDUCACAO_INFANTIL"],
 [6, "ENSINO_FUNDAMENTAL"], [14, "ENSINO_FUNDAMENTAL"], [15, "ENSINO_MEDIO"],
 [17, "ENSINO_MEDIO"], [18, "PRE_VESTIBULAR"], [19, "GRADUACAO"], [40, "GRADUACAO"]
].forEach(function (par) {
  b.igual(win.modalidadeSugerida(par[0]), par[1], par[0] + " anos → " + par[1]);
});
b.igual(win.modalidadeSugerida(null), "", "sem idade, nenhuma sugestão");

/* ── 3. NA TELA ──────────────────────────────────────────────────────── */
b.passo("3. Preencher a data já escolhe a modalidade, dizendo por quê");
/* O Guilherme do seu print: 25/09/2010, quinze anos. */
campo("dataNascimentoBeneficiario").value = anosAtras(15);
campo("dataNascimentoBeneficiario").dispatchEvent(new win.Event("change", { bubbles: true }));

b.igual(campo("modalidade").value, "ENSINO_MEDIO", "quinze anos → Ensino Médio");
b.ok(/Sugerido pela idade \(15 anos\)/.test(campo("avisoModalidade").textContent),
  "e a tela diz de onde veio", campo("avisoModalidade").textContent);
b.ok(campo("avisoModalidade").className.indexOf("visivel") > -1, "o aviso aparece");

b.passo("A LISTA CONTINUA INTEIRA — sugerir não é limitar");
/* Era o risco da pergunta original. Esconder o que está fora da faixa
   recusaria de novo os cinco casos reais medidos em 17/09 — e sem mensagem
   nenhuma, o que é pior do que a recusa que a gente já tinha tirado. */
b.igual(campo("modalidade").querySelectorAll("option").length, MODALIDADES.length + 1,
  "todas as modalidades seguem no menu, mais o 'Selecione...'");
["CRECHE", "ENSINO_FUNDAMENTAL", "POS_GRADUACAO"].forEach(function (v) {
  b.ok(!!campo("modalidade").querySelector('option[value="' + v + '"]'),
    v + " continua escolhível por quem tem quinze anos");
});

b.passo("Quem escolhe manda: a sugestão se cala depois do primeiro toque");
/* Campo que se reescreve sozinho depois de preenchido é o jeito mais rápido
   de perder a confiança de quem digita. */
campo("modalidade").value = "ENSINO_FUNDAMENTAL";
campo("modalidade").dispatchEvent(new win.Event("change", { bubbles: true }));
b.ok(campo("avisoModalidade").className.indexOf("visivel") === -1,
  "o aviso de sugestão some quando a pessoa escolhe");

campo("dataNascimentoBeneficiario").value = anosAtras(7);
campo("dataNascimentoBeneficiario").dispatchEvent(new win.Event("change", { bubbles: true }));
b.igual(campo("modalidade").value, "ENSINO_FUNDAMENTAL",
  "e trocar a data depois NÃO desfaz a escolha dela");

b.passo("Modalidade que não existe no menu não é sugerida");
/* O menu vem do servidor e pode mudar. Sugerir um valor ausente deixaria o
   campo vazio em silêncio, e a pessoa levaria 'escolha a modalidade' sem
   entender o que aconteceu. */
const soDuas = doc.createElement("select");
soDuas.innerHTML = '<option value=""></option><option value="GRADUACAO">Graduação</option>';
const dataFalsa = doc.createElement("input");
dataFalsa.value = anosAtras(15);
win.aplicarSugestaoModalidade(dataFalsa, soDuas, null);
b.igual(soDuas.value, "", "sem ENSINO_MEDIO no menu, nada é escolhido");

/* ── 4. "PARA MIM" IMPÕE O TITULAR ───────────────────────────────────── */
b.passo("4. Escolher 'para mim' apaga o tipo de dependente escolhido antes");
/* O DEFEITO DO SEU PRINT. */
const tipo = campo("tipoBeneficiario");
tipo.innerHTML = '<option value=""></option><option value="TITULAR">Titular</option>' +
                 '<option value="FILHO">Filho(a)</option>';
tipo.value = "FILHO";
win.paraQuemEscolher("TITULAR");
b.igual(tipo.value, "TITULAR",
  "'Filho(a)' escolhido antes não sobrevive a 'para mim'");

b.passo("E a pergunta não é feita duas vezes");
/* O seletor lá em cima já respondeu para quem é a bolsa; repetir logo abaixo
   é convidar a resposta divergente. */
b.ok(campo("boxTipoBeneficiario").className.indexOf("hidden") > -1,
  "o campo 'Tipo de beneficiário' some no caminho do titular");

b.naoTestavel("A sugestão aparecendo na tela publicada",
  "jsdom não aplica CSS; roteiro: abrir o portal, digitar uma data de " +
  "nascimento e conferir que a modalidade vem escolhida com a explicação");
b.resumo();
