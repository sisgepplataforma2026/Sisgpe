/**
 * TESTE — TODA MODALIDADE OFERECIDA NO MENU TEM REGRA QUE A ACEITA
 *
 * "Tem pré-vestibular também" — você, 17/09/2026.
 *
 * O PRÉ-VESTIBULAR EXISTIA EM UM LUGAR SÓ: numa tabela de percentual do
 * painel (100%). Não estava no menu do portal, então ninguém conseguia pedir;
 * e não estava na regra da convenção, então quem chegasse lá por outro
 * caminho levaria "Modalidade não reconhecida" — pedido recusado por um
 * buraco no código, não por regra do sindicato.
 *
 * É A SEGUNDA VEZ QUE ISSO ACONTECE. O Ensino Médio teve exatamente o mesmo
 * defeito, e a correção dele está documentada em Voucher.gs — mas a
 * documentação não impediu a repetição, porque comentário não executa.
 *
 * POR ISSO ESTE TESTE NÃO OLHA O PRÉ-VESTIBULAR: ele pega TODAS as
 * modalidades que o menu oferece e exige que cada uma passe pela regra. A
 * próxima que alguém acrescentar já nasce coberta, e a terceira vez não
 * acontece.
 */
const b = require("./base");

const { g } = b.subir({});
b.seedUsuarios(g);

b.fluxo("BOLSAS · Toda modalidade do menu passa pela regra");

const init = g.getPortalVoucherInitData();
const modalidades = (init && init.modalidades) || [];

b.ok(modalidades.length >= 7, "o menu oferece as modalidades", modalidades.length);
b.ok(modalidades.some(function (m) { return m.value === "PRE_VESTIBULAR"; }),
  "e o pré-vestibular agora está entre elas");

b.passo("1. Nenhuma delas cai em 'modalidade não reconhecida'");
/* O beneficiário é FILHO de 16 anos com ordem 1: passa na idade, e a ordem é
   a que a convenção usa no ensino básico. Para graduação e pós a área entra
   junto, senão o caso seria inválido por outro motivo. */
modalidades.forEach(function (m) {
  const dados = {
    modalidade: m.value,
    tipoBeneficiario: "FILHO",
    ordemFilho: "1",
    areaCurso: "HUMANAS",
    curso: "Curso de teste"
  };
  const regra = g.calcularRegraVoucher_(dados, 16);
  const obs = String((regra && regra.observacao) || "");

  b.ok(!/não reconhecida|nao reconhecida/i.test(obs),
    m.value + " é reconhecida pela regra", obs || "(sem observação)");
  b.ok(regra && regra.apto === true,
    m.value + " é aprovada para o 1º filho", obs || regra.percentual + "%");
});

b.passo("2. O pré-vestibular segue a regra do ensino básico");
/* Confirmado por você em 17/09/2026: mesma regra das demais do básico. */
[["1", "100"], ["2", "100"], ["3", "60"]].forEach(function (par) {
  const r = g.calcularRegraVoucher_({
    modalidade: "PRE_VESTIBULAR", tipoBeneficiario: "FILHO",
    ordemFilho: par[0], curso: "Pré-vestibular"
  }, 17);
  b.igual(String(r.percentual), par[1],
    par[0] + "º filho em pré-vestibular recebe " + par[1] + "%");
});

/* E O MESMO QUE O ENSINO MÉDIO, que é a modalidade logo antes dele — se um
   dia alguém mudar um e esquecer o outro, isto acusa. */
const medio = g.calcularRegraVoucher_({
  modalidade: "ENSINO_MEDIO", tipoBeneficiario: "FILHO", ordemFilho: "3", curso: "x" }, 17);
const pre = g.calcularRegraVoucher_({
  modalidade: "PRE_VESTIBULAR", tipoBeneficiario: "FILHO", ordemFilho: "3", curso: "x" }, 17);
b.igual(String(pre.percentual), String(medio.percentual),
  "pré-vestibular e ensino médio dão o mesmo percentual na mesma ordem");

b.passo("3. A idade do dependente continua valendo");
/* Não é porque a modalidade entrou que o limite da convenção sumiu. */
const velho = g.calcularRegraVoucher_({
  modalidade: "PRE_VESTIBULAR", tipoBeneficiario: "FILHO", ordemFilho: "1", curso: "x" }, 26);
b.ok(velho.apto === false, "filho de 26 anos em pré-vestibular continua fora da regra");
b.ok(String(velho.observacao).indexOf("24") > -1,
  "e a mensagem cita o limite de 24 anos", velho.observacao);

b.passo("4. O titular também pode pedir");
const titular = g.calcularRegraVoucher_({
  modalidade: "PRE_VESTIBULAR", tipoBeneficiario: "TITULAR", ordemFilho: "1", curso: "x" }, 45);
b.ok(titular.apto === true,
  "titular de 45 anos em pré-vestibular é aprovado — não há limite de idade para ele",
  titular.observacao || titular.percentual + "%");

b.naoTestavel("o menu desenhado na tela",
  "jsdom não aplica CSS — roteiro manual: abrir o portal e conferir que " +
  "'Pré-Vestibular (17–18 anos)' aparece na lista de modalidades");
b.resumo();
