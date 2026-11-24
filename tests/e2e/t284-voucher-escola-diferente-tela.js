/**
 * TESTE (TELA) — "ESCOLA DIFERENTE DA DO TITULAR" NA NOVA SOLICITAÇÃO
 *
 * Decisão do usuário (24/11/2026): o dependente puxa a escola do titular, mas
 * tem de haver uma OPÇÃO de troca (titular numa faculdade, filho num colégio da
 * mesma rede). A opção só existe para quem NÃO é o titular, nasce desmarcada, e
 * só manda os campos quando marcada. O que o servidor decide aparece na tela.
 *
 * PROVA: DOM + payload contra a tela de verdade (jsdom). NÃO PROVA: a
 * aparência. A regra em si é do servidor (t280).
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) {
  b.fluxo("BOLSAS · escola diferente — tela");
  b.naoTestavel("tela da nova solicitação", "jsdom não instalado — rode: npm install jsdom");
  b.resumo(); process.exit(process.exitCode || 0);
}
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
const el = id => doc.getElementById(id);
const cards = () => doc.querySelectorAll("#certNvBenefLista .cert-nv-benef-card");

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);
  t.clicar("#certBtnNova");
  await t.assentar(40);

  b.fluxo("BOLSAS · escola diferente — beneficiário de cima");

  b.passo("1. Titular como beneficiário: a opção NÃO aparece");
  t.escolher("#certNvQuem", "PROPRIO");
  await t.assentar(20);
  b.igual(el("certNvBoxEscolaDif").style.display, "none", "escondida para o titular");

  b.passo("2. Dependente: a opção aparece, desmarcada, com os campos escondidos");
  t.escolher("#certNvQuem", "FILHO_1");
  await t.assentar(20);
  b.ok(el("certNvBoxEscolaDif").style.display !== "none", "aparece para o 1º filho");
  b.ok(el("certNvEscolaDif").checked === false, "nasce DESMARCADA");
  b.igual(el("certNvEscolaDifBox").style.display, "none", "com os campos escondidos");

  b.passo("3. Marcar abre os campos; voltar para titular desmarca e esconde");
  t.marcar("#certNvEscolaDif", true);
  await t.assentar(20);
  b.ok(el("certNvEscolaDifBox").style.display !== "none", "os campos abrem");
  t.escolher("#certNvQuem", "PROPRIO");
  await t.assentar(20);
  b.ok(el("certNvEscolaDif").checked === false && el("certNvBoxEscolaDif").style.display === "none", "some e desmarca");

  b.fluxo("BOLSAS · escola diferente — o que sai da tela");

  function preencherBase(nome, quem, cpf) {
    el("certNvCpf").value = cpf || "11144477735";
    el("certNvNome").value = "PAI DE FAMILIA";
    t.escolher("#certNvQuem", quem);
    el("certNvBeneficiario").value = nome;
    t.escolher("#certNvModalidade", "ENSINO_FUNDAMENTAL");
    el("certNvCurso").value = "Fundamental";
    t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1));
    t.escolher("#certNvPeriodoSem", "1");
  }

  b.passo("4. SEM marcar nada, o pedido sai como sempre — nenhum campo de troca");
  t.clicar("#certNvCancelar"); await t.assentar(30);
  t.clicar("#certBtnNova"); await t.assentar(40);
  preencherBase("FILHA UM", "FILHO_1");
  await t.assentar(120);
  t.clicar("#certNvSalvarAprovar"); await t.assentar(350);
  const semTroca = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop();
  b.ok(!!semTroca, "chamou a criação");
  b.ok(semTroca && !("escolaDiferenteDoTitular" in semTroca.args[0]), "sem 'escolaDiferenteDoTitular' no pedido");

  b.passo("5. Beneficiário de cima COM troca (caminho único): manda escola, CNPJ e motivo");
  t.clicar("#certBtnNova"); await t.assentar(40);
  preencherBase("FILHA DOIS", "FILHO_2");
  t.marcar("#certNvEscolaDif", true);
  await t.assentar(20);
  t.escolher("#certNvEscolaDifMotivo", "MESMA_REDE");
  t.digitar("#certNvEscolaDifNome", "COLEGIO REDE ALFA");
  t.digitar("#certNvEscolaDifCnpj", "11.222.333/0002-25");
  await t.assentar(120);
  t.clicar("#certNvSalvarAprovar"); await t.assentar(350);
  const unico = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop().args[0];
  b.ok(unico.escolaDiferenteDoTitular === true, "manda escolaDiferenteDoTitular");
  b.igual(unico.motivoEscolaDiferente, "MESMA_REDE", "com o motivo");
  b.igual(unico.escola, "COLEGIO REDE ALFA", "a escola do dependente");
  b.igual(unico.cnpjEscola, "11222333000225", "e o CNPJ só com dígitos");

  b.passo("6. No LOTE a troca vai SÓ no beneficiário certo — a escola comum não é sobrescrita");
  t.clicar("#certBtnNova"); await t.assentar(40);
  preencherBase("FILHO TRES", "FILHO_1");
  t.marcar("#certNvEscolaDif", true);
  await t.assentar(20);
  t.escolher("#certNvEscolaDifMotivo", "OUTRO");
  t.digitar("#certNvEscolaDifNome", "COLEGIO OUTRA REDE");
  t.digitar("#certNvEscolaDifCnpj", "99888777000166");
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  const c = cards()[0];
  t.escolher(c.querySelector(".js-quem"), "FILHO_2");
  c.querySelector(".js-nome").value = "FILHO QUATRO";
  t.escolher(c.querySelector(".js-modalidade"), "ENSINO_FUNDAMENTAL");
  c.querySelector(".js-curso").value = "Fundamental";
  await t.assentar(120);
  t.clicar("#certNvSalvarAprovar"); await t.assentar(400);
  const lote = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop().args[0];
  b.ok(lote.beneficiarios[0].escolaDiferenteDoTitular === true && lote.beneficiarios[0].escola === "COLEGIO OUTRA REDE", "o de cima leva a troca", JSON.stringify(lote.beneficiarios[0]));
  b.ok(!("escolaDiferenteDoTitular" in lote.beneficiarios[1]), "o card, desmarcado, NÃO leva troca");
  b.ok(!("escolaDiferenteDoTitular" in lote.comuns), "e a escola comum (do titular) não foi tocada");

  b.passo("7. Card COM troca; e o resultado traz a escola aplicada na tela");
  t.clicar("#certBtnNova"); await t.assentar(40);
  preencherBase("FILHO CINCO", "FILHO_1", "52998224725");   // outro titular: o teto de 3 dependentes é por associado
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  const c2 = cards()[0];
  t.escolher(c2.querySelector(".js-quem"), "FILHO_2");
  c2.querySelector(".js-nome").value = "FILHO SEIS";
  t.escolher(c2.querySelector(".js-modalidade"), "ENSINO_FUNDAMENTAL");
  c2.querySelector(".js-curso").value = "Fundamental";
  const chk = c2.querySelector(".js-escolaDif"); chk.checked = true; chk.dispatchEvent(new win.Event("change"));
  c2.querySelector(".js-escolaMotivo").value = "MESMA_REDE";
  c2.querySelector(".js-escolaNome").value = "COLEGIO REDE ALFA";
  c2.querySelector(".js-escolaCnpj").value = "11.222.333/0002-25";
  await t.assentar(120);
  b.ok(c2.querySelector(".js-escolaDifBox").style.display !== "none", "os campos do card abrem ao marcar");
  t.clicar("#certNvSalvarAprovar"); await t.assentar(400);
  const lote2 = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop().args[0];
  const bc = lote2.beneficiarios[1];
  b.ok(bc.escolaDiferenteDoTitular === true && bc.motivoEscolaDiferente === "MESMA_REDE" && bc.escola === "COLEGIO REDE ALFA" && bc.cnpjEscola === "11222333000225", "o card leva a troca completa", JSON.stringify(bc));
  b.ok(!("escolaDiferenteDoTitular" in lote2.beneficiarios[0]), "o de cima, desmarcado, não leva");
  b.ok(/COLEGIO REDE ALFA/.test(c2.querySelector(".cert-nv-benef-res").textContent), "o card mostra a escola aplicada", c2.querySelector(".cert-nv-benef-res").textContent);
  b.resumo();
})();
