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
const ssE = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shEsc = ssE.getSheetByName("Escolas") || ssE.insertSheet("Escolas");
shEsc.clear();
shEsc.getRange(1, 1, 1, 6).setValues([["Escola (Razão Social)", "CNPJ", "Cidade", "UF", "EscolaID", "E-mail (principal)"]]);
shEsc.getRange(2, 1, 2, 6).setValues([
  ["COLEGIO REDE ALFA LTDA", "11222333000225", "VITORIA", "ES", "ESC-002", "col@alfa.com"],
  ["COLEGIO OUTRA REDE LTDA", "99888777000166", "SERRA", "ES", "ESC-003", "col@outra.com"]
]);
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
  if(!el("certNvSituacao").value) t.escolher("#certNvSituacao", "ASSOCIADO");
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
  t.digitar("#certNvEscolaDifNome", "rede alfa");
  await t.assentar(500);
  const itens = doc.querySelectorAll("#certNvEscolaDifLista .cert-nv-item");
  b.ok(itens.length >= 1, "a BUSCA devolveu escolas do cadastro", itens.length + " item(ns)");
  t.clicar(itens[0]); await t.assentar(60);
  b.igual(el("certNvEscolaDifNome").getAttribute("data-escola-id"), "ESC-002", "escolher grava o id da escola");
  b.ok(/11\.222\.333/.test(el("certNvEscolaDifCnpj").value), "e preenche o CNPJ (somente leitura)", el("certNvEscolaDifCnpj").value);
  b.ok(el("certNvEscolaDifCnpj").readOnly, "o CNPJ não é editável");
  await t.assentar(120);
  if(!el("certNvSituacao").value) t.escolher("#certNvSituacao", "ASSOCIADO");
  t.clicar("#certNvSalvarAprovar"); await t.assentar(350);
  const unico = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop().args[0];
  b.ok(unico.escolaDiferenteDoTitular === true, "manda escolaDiferenteDoTitular");
  b.igual(unico.motivoEscolaDiferente, "MESMA_REDE", "com o motivo");
  b.igual(unico.escola, "COLEGIO REDE ALFA LTDA", "a escola do dependente, a do CADASTRO");
  b.igual(unico.cnpjEscola, "11222333000225", "o CNPJ só com dígitos");
  b.igual(unico.escolaId, "ESC-002", "e o id da escola");

  b.passo("6. No LOTE a troca vai SÓ no beneficiário certo — a escola comum não é sobrescrita");
  t.clicar("#certBtnNova"); await t.assentar(40);
  preencherBase("FILHO TRES", "FILHO_1");
  t.marcar("#certNvEscolaDif", true);
  await t.assentar(20);
  t.escolher("#certNvEscolaDifMotivo", "OUTRO");
  t.digitar("#certNvEscolaDifNome", "outra rede");
  await t.assentar(500);
  t.clicar(doc.querySelector("#certNvEscolaDifLista .cert-nv-item")); await t.assentar(60);
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  const c = cards()[0];
  t.escolher(c.querySelector(".js-quem"), "FILHO_2");
  c.querySelector(".js-nome").value = "FILHO QUATRO";
  t.escolher(c.querySelector(".js-modalidade"), "ENSINO_FUNDAMENTAL");
  c.querySelector(".js-curso").value = "Fundamental";
  await t.assentar(120);
  if(!el("certNvSituacao").value) t.escolher("#certNvSituacao", "ASSOCIADO");
  t.clicar("#certNvSalvarAprovar"); await t.assentar(400);
  const lote = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop().args[0];
  b.ok(lote.beneficiarios[0].escolaDiferenteDoTitular === true && lote.beneficiarios[0].escola === "COLEGIO OUTRA REDE LTDA" && lote.beneficiarios[0].escolaId === "ESC-003", "o de cima leva a troca, com o id do cadastro", JSON.stringify(lote.beneficiarios[0]));
  b.ok(!("escolaDiferenteDoTitular" in lote.beneficiarios[1]), "o card, desmarcado, NÃO leva troca");
  b.ok(!("escolaDiferenteDoTitular" in lote.comuns), "e a escola comum (do titular) não foi tocada");

  b.passo("6b. Troca MARCADA sem escolher na busca: a tela barra e NÃO chama o servidor");
t.clicar("#certBtnNova"); await t.assentar(40);
preencherBase("FILHA SEM ESCOLHA", "FILHO_1", "27595487040");
t.marcar("#certNvEscolaDif", true);
await t.assentar(20);
t.escolher("#certNvEscolaDifMotivo", "MESMA_REDE");
t.digitar("#certNvEscolaDifNome", "texto solto sem escolher");
await t.assentar(500);
const antes = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao" || c.fn === "voucherCriarSolicitacoesEmLote").length;
if(!el("certNvSituacao").value) t.escolher("#certNvSituacao", "ASSOCIADO");
t.clicar("#certNvSalvarAprovar"); await t.assentar(300);
b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao" || c.fn === "voucherCriarSolicitacoesEmLote").length, antes, "nada foi enviado ao servidor");
t.digitar("#certNvEscolaDifNome", "rede alfa");
await t.assentar(500);
b.ok(!el("certNvEscolaDifNome").hasAttribute("data-escola-id"), "digitar de novo mantém a escolha invalidada até clicar na lista");

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
  t.digitar(c2.querySelector(".js-escolaNome"), "rede alfa");
  await t.assentar(500);
  t.clicar(c2.querySelector(".js-escolaLista .cert-nv-item")); await t.assentar(60);
  await t.assentar(120);
  b.ok(c2.querySelector(".js-escolaDifBox").style.display !== "none", "os campos do card abrem ao marcar");
  if(!el("certNvSituacao").value) t.escolher("#certNvSituacao", "ASSOCIADO");
  t.clicar("#certNvSalvarAprovar"); await t.assentar(400);
  const lote2 = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop().args[0];
  const bc = lote2.beneficiarios[1];
  b.ok(bc.escolaDiferenteDoTitular === true && bc.motivoEscolaDiferente === "MESMA_REDE" && bc.escola === "COLEGIO REDE ALFA LTDA" && bc.cnpjEscola === "11222333000225" && bc.escolaId === "ESC-002", "o card leva a troca completa, do cadastro", JSON.stringify(bc));
  b.ok(!("escolaDiferenteDoTitular" in lote2.beneficiarios[0]), "o de cima, desmarcado, não leva");
  b.ok(/COLEGIO REDE ALFA LTDA/.test(c2.querySelector(".cert-nv-benef-res").textContent), "o card mostra a escola aplicada", c2.querySelector(".cert-nv-benef-res").textContent);
  b.resumo();
})();
