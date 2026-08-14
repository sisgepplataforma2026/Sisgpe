/**
 * TESTE — O BLOCO DE BENEFICIÁRIOS NA TELA
 *
 * O backend do lote está provado no t41. Aqui é a outra metade.
 *
 * TUDO PELO DOM, sem chamar função interna nenhuma. O arquivo da tela roda
 * dentro de uma IIFE e só exporta `initCertificadoAdmin` — e isso é bom:
 * obriga o teste a fazer o que a pessoa faz, clicar e digitar. A primeira
 * versão deste arquivo chamava `win.nvBenefCards()` e morreu na hora, o que
 * poupou um teste que provaria o funcionamento de um caminho que ninguém
 * percorre.
 *
 * O backend é o de verdade (emulador), então o lote parcial deste arquivo é
 * um lote parcial real: uma criança que já tem bolsa naquele período.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER · Bloco de beneficiários");
  b.naoTestavel("bloco de beneficiários", "jsdom não instalado");
  b.resumo(); process.exit(0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const CPF = "11144477735";
const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
function el(id) { return doc.getElementById(id); }
function cards() { return doc.querySelectorAll("#certNvBenefLista .cert-nv-benef-card"); }
function campo(card, classe) { return card.querySelector("." + classe); }

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);

  b.fluxo("BLOCO · Existe, começa vazio e obedece ao teto");

  b.passo("1. Os elementos do bloco existem");
  t.clicar("#certBtnNova");
  await t.assentar(40);
  ["certNvBenefAdd", "certNvBenefLista", "certNvBenefSub"].forEach(function (id) {
    b.ok(!!el(id), "existe #" + id);
  });
  b.igual(cards().length, 0, "e começa sem card nenhum");

  b.passo("2. O + Adicionar cria card, numerado a partir do 2");
  /* O 1 é o beneficiário de cima, que não mudou de lugar. */
  t.clicar("#certNvBenefAdd");
  await t.assentar(30);
  b.igual(cards().length, 1, "um card");
  b.ok(/Beneficiário 2/.test(el("certNvBenefLista").textContent),
    "o primeiro card extra é o de número 2");

  b.passo("3. Com o TITULAR em cima, cabem três dependentes extras");
  t.escolher("#certNvQuem", "PROPRIO");
  t.clicar("#certNvBenefAdd");
  t.clicar("#certNvBenefAdd");
  await t.assentar(40);
  b.igual(cards().length, 3, "três cards");
  b.igual(el("certNvBenefAdd").disabled, true, "e o + Adicionar desabilita no teto");
  b.ok(/[Ll]imite/.test(el("certNvBenefSub").textContent),
    "com o limite escrito na tela", el("certNvBenefSub").textContent);

  b.passo("3b. Com um DEPENDENTE em cima, cabem só mais DOIS");
  /* O beneficiário de cima ocupa vaga quando não é o titular — é a mesma
     conta que o servidor faz. Sem este passo, uma mutação que fizesse o de
     cima nunca contar sobrevivia: com o titular em cima os números batem por
     coincidência (0+3 = 3 dos dois jeitos). */
  cards()[0].querySelector(".cert-nv-benef-x").click();
  await t.assentar(20);
  t.escolher("#certNvQuem", "FILHO_1");
  await t.assentar(30);
  b.igual(cards().length, 2, "dois cards extras");
  b.igual(el("certNvBenefAdd").disabled, true,
    "e o + Adicionar já trava: o de cima é o terceiro dependente");
  t.escolher("#certNvQuem", "PROPRIO");
  await t.assentar(30);
  b.igual(el("certNvBenefAdd").disabled, false,
    "voltando para o titular, cabe mais um");
  t.clicar("#certNvBenefAdd");
  await t.assentar(30);

  b.passo("4. O ✕ remove e renumera os que sobraram");
  cards()[0].querySelector(".cert-nv-benef-x").click();
  await t.assentar(30);
  b.igual(cards().length, 2, "sobraram dois");
  const txt = el("certNvBenefLista").textContent;
  b.ok(/Beneficiário 2/.test(txt) && /Beneficiário 3/.test(txt),
    "renumerados para 2 e 3, sem buraco");
  b.igual(el("certNvBenefAdd").disabled, false, "e o botão volta a valer");

  b.fluxo("BLOCO · O pedido que sai da tela");

  b.passo("5. Sem cards extras, a tela continua chamando a criação ÚNICA");
  /* O caminho que já funcionava não pode ter mudado. */
  t.clicar("#certNvCancelar");
  await t.assentar(40);
  t.clicar("#certBtnNova");
  await t.assentar(40);
  b.igual(cards().length, 0, "o bloco veio limpo do atendimento anterior");

  el("certNvCpf").value = CPF;
  el("certNvNome").value = "PAI DE FAMILIA";
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  el("certNvCurso").value = "Pedagogia";
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear()));
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(150);
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(300);
  b.ok(!!t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop(),
    "chamou voucherCriarSolicitacao");
  b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").length, 0,
    "e NÃO chamou o lote");

  b.passo("6. Com cards, vai o lote — e o de cima é o primeiro da lista");
  t.clicar("#certBtnNova");
  await t.assentar(40);
  el("certNvCpf").value = CPF;
  el("certNvNome").value = "PAI DE FAMILIA";
  t.escolher("#certNvQuem", "FILHO_1");
  el("certNvBeneficiario").value = "ANA MARIA";
  t.escolher("#certNvModalidade", "ENSINO_FUNDAMENTAL");
  el("certNvCurso").value = "Fundamental";
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1));
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(120);

  t.clicar("#certNvBenefAdd");
  await t.assentar(30);
  const c2 = cards()[0];
  t.escolher(campo(c2, "js-quem"), "FILHO_2");
  campo(c2, "js-nome").value = "BRUNO CESAR";
  t.escolher(campo(c2, "js-modalidade"), "ENSINO_FUNDAMENTAL");
  campo(c2, "js-curso").value = "Fundamental";
  await t.assentar(40);

  t.clicar("#certNvSalvarAprovar");
  await t.assentar(350);
  const lote = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop();
  b.ok(!!lote, "chamou o lote");
  const pedido = lote && lote.args[0];
  b.igual(pedido && pedido.beneficiarios.length, 2, "com dois beneficiários");
  b.igual(pedido && pedido.beneficiarios[0].beneficiario, "ANA MARIA",
    "o de cima é o PRIMEIRO da lista");
  b.igual(pedido && pedido.beneficiarios[1].beneficiario, "BRUNO CESAR",
    "e o card extra vem depois");
  b.igual(pedido && pedido.beneficiarios[1].tipoBeneficiario, "FILHO",
    "com o tipo traduzido do seletor");
  b.igual(pedido && pedido.beneficiarios[1].ordemFilho, "2", "e a ordem junto");
  b.igual(pedido && pedido.comuns.cpf, CPF, "o CPF do titular vai nos comuns");

  b.passo("7. E as duas viraram solicitações de verdade");
  const lista = g.listarSolicitacoesCertBolsa(TOKEN) || [];
  ["ANA MARIA", "BRUNO CESAR"].forEach(function (nome) {
    b.igual(lista.filter(function (s) {
      return String(s.nomeBeneficiario || "").toUpperCase() === nome;
    }).length, 1, nome + " tem uma linha");
  });

  b.fluxo("BLOCO · O resultado aparece NO CARD, e o modal não foge");

  b.passo("8. Lote parcial: um card com protocolo, outro com o motivo");
  /* Parcial DE VERDADE: a ANA MARIA já tem bolsa naquele período — foi
     criada no passo 6 —, então ela é recusada e a irmã nova entra. */
  t.clicar("#certBtnNova");
  await t.assentar(40);
  el("certNvCpf").value = CPF;
  el("certNvNome").value = "PAI DE FAMILIA";
  t.escolher("#certNvQuem", "FILHO_1");
  el("certNvBeneficiario").value = "ANA MARIA";
  t.escolher("#certNvModalidade", "ENSINO_FUNDAMENTAL");
  el("certNvCurso").value = "Fundamental";
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1));
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(120);

  t.clicar("#certNvBenefAdd");
  await t.assentar(30);
  const c3 = cards()[0];
  t.escolher(campo(c3, "js-quem"), "FILHO_3");
  campo(c3, "js-nome").value = "CARLA SOFIA";
  t.escolher(campo(c3, "js-modalidade"), "ENSINO_FUNDAMENTAL");
  campo(c3, "js-curso").value = "Fundamental";
  await t.assentar(40);

  t.clicar("#certNvSalvarAprovar");
  await t.assentar(400);

  b.ok(el("certNovaOverlay").classList.contains("ativo"),
    "o modal NÃO fecha no parcial — o que falhou está marcado nele");
  const res = cards()[0] && cards()[0].querySelector(".cert-nv-benef-res");
  b.ok(!!res && res.style.display !== "none", "o card extra mostra o resultado");
  b.ok(/ok/.test(res.className), "a CARLA entrou", res.textContent);
  b.ok(/BOLSA-/.test(res.textContent), "com o protocolo dela", res.textContent);

  b.passo("9. E a ANA MARIA foi recusada, com o motivo");
  const respostaLote = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop();
  b.ok(!!respostaLote, "o lote foi chamado");
  const daAna = (g.listarSolicitacoesCertBolsa(TOKEN) || []).filter(function (s) {
    return String(s.nomeBeneficiario || "").toUpperCase() === "ANA MARIA";
  });
  b.igual(daAna.length, 1,
    "ANA MARIA continua com UMA linha — a segunda tentativa não gravou");
  b.igual((g.listarSolicitacoesCertBolsa(TOKEN) || []).filter(function (s) {
    return String(s.nomeBeneficiario || "").toUpperCase() === "CARLA SOFIA";
  }).length, 1, "e a CARLA SOFIA foi criada assim mesmo");

  b.passo("10. Cancelar limpa os cards extras junto com o resto");
  /* Sem isto, o próximo atendimento abriria com a família do anterior. */
  t.clicar("#certNvCancelar");
  await t.assentar(40);
  t.clicar("#certBtnNova");
  await t.assentar(40);
  b.igual(cards().length, 0, "o bloco voltou a ficar vazio");

  b.naoTestavel("O botão 'Renovar os 3'",
    "a faixa de renovação a partir da memória ainda não foi ligada à tela");

  b.resumo();
  process.exit(0);
})();
