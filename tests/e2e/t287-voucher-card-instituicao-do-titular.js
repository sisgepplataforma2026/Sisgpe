/**
 * TESTE (TELA) — 2º E 3º DEPENDENTE NASCEM COM A ESCOLA DO TITULAR
 *
 * Pedido do usuário (24/11/2026): "para a mesma titular, quando adiciona o segundo e
 * terceiro dependente não está buscando a escola do titular". O cartão do dependente
 * extra nascia com "Instituição de ensino" VAZIA. Agora nasce com a escola do titular
 * (origem à vista, editável); não sobrescreve o que a pessoa digitou; segue a escola do
 * titular enquanto ninguém mexeu; e o CNPJ/e-mail só vão junto quando o nome é o do titular.
 *
 * PROVA: DOM + payload na tela de verdade (jsdom) e o lote no servidor. NÃO PROVA: a aparência.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) {
  b.fluxo("BOLSAS · card herda a escola — tela");
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
/* a escola do titular como a tela a deixa depois da busca no cadastro: campos + evento de input */
function aplicarEscola(x) {
  el("certNvEscola").value = x.nome || "";
  el("certNvEscola").setAttribute("data-escola-id", x.escolaId || "");
  el("certNvEscola").setAttribute("data-escola-email", x.email || "");
  el("certNvCnpjEscola").value = x.cnpj || "";
  el("certNvEscola").dispatchEvent(new win.Event("input", { bubbles: true }));
}
/* o que a tela MANDA ao servidor: salva e lê a chamada registrada */
async function payload() {
  el("certNvCpf").value = "11144477735"; el("certNvNome").value = "TITULAR";
  t.escolher("#certNvQuem", "FILHO_1"); el("certNvBeneficiario").value = "PRIMEIRO";
  t.escolher("#certNvModalidade", "ENSINO_FUNDAMENTAL"); el("certNvCurso").value = "F";
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1)); t.escolher("#certNvPeriodoSem", "1");
  cards().forEach((c, i) => { t.escolher(c.querySelector(".js-quem"), "FILHO_" + (i + 2)); c.querySelector(".js-nome").value = "DEP" + i;
    t.escolher(c.querySelector(".js-modalidade"), "ENSINO_FUNDAMENTAL"); c.querySelector(".js-curso").value = "F"; });
  await t.assentar(120);
  t.clicar("#certNvSalvarAprovar"); await t.assentar(400);
  return t.chamadas.filter(c => c.fn === "voucherCriarSolicitacoesEmLote").pop().args[0].beneficiarios.slice(1);
}
const cards = () => Array.from(doc.querySelectorAll("#certNvBenefLista .cert-nv-benef-card"));

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);
  t.clicar("#certBtnNova");
  await t.assentar(40);
  b.fluxo("BOLSAS · cartões de dependentes herdam a escola do titular");

  t.escolher("#certNvQuem", "FILHO_1");
  await t.assentar(20);
  /* a escola do titular, como a tela a deixa depois da busca no cadastro */
  aplicarEscola({ nome: "JUNTA DE EDUCACAO DA CONVENCAO BATISTA MINEIRA", escolaId: "ESC-9", cnpj: "11222333000144", email: "rh@junta.com" });

  b.passo("1. 2º e 3º dependente nascem com a instituição = escola do titular");
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  b.igual(cards().length, 2, "dois cartões extras");
  cards().forEach((c, i) => {
    b.igual(c.querySelector(".js-inst").value, "JUNTA DE EDUCACAO DA CONVENCAO BATISTA MINEIRA", "cartão " + (i + 2) + ": instituição preenchida com a escola do titular");
    b.ok(/escola do titular/.test(c.querySelector(".js-instOrigem").textContent), "e diz de onde veio");
  });

  b.passo("2. Quem digitou a instituição NÃO é sobrescrito quando a escola do titular muda");
  const c2 = cards()[1].querySelector(".js-inst");
  c2.value = "COLEGIO OUTRA REDE"; c2.dispatchEvent(new win.Event("input", { bubbles: true }));
  aplicarEscola({ nome: "ESCOLA NOVA DO TITULAR", escolaId: "ESC-10", cnpj: "99888777000166", email: "rh@nova.com" });
  b.igual(cards()[1].querySelector(".js-inst").value, "COLEGIO OUTRA REDE", "o digitado fica");
  b.ok(!/escola do titular/.test(cards()[1].querySelector(".js-instOrigem").textContent), "sem a etiqueta 'do titular'");

  b.passo("3. Quem não foi mexido SEGUE a escola do titular se ela mudar");
  b.igual(cards()[0].querySelector(".js-inst").value, "ESCOLA NOVA DO TITULAR", "o 1º cartão acompanhou");

  b.passo("4. O que a tela MANDA: o cartão do titular leva nome + CNPJ + e-mail; o digitado não leva os do titular");
  const pay = await payload();
  b.igual(pay[0].instituicao, "ESCOLA NOVA DO TITULAR", "cartão 2: instituição = escola do titular");
  b.igual(pay[0].cnpjInstituicao, "99888777000166", "com o CNPJ dela");
  b.igual(pay[0].emailInstituicao, "rh@nova.com", "e o e-mail dela (o certificado chega à escola)");
  b.igual(pay[1].instituicao, "COLEGIO OUTRA REDE", "cartão 3: o que foi digitado");
  b.igual(pay[1].cnpjInstituicao, "", "sem herdar o CNPJ do titular");

  b.passo("5. Sem escola do titular na tela: o cartão fica em branco, sem inventar");
  t.clicar("#certBtnNova"); await t.assentar(40);
  t.escolher("#certNvQuem", "FILHO_1"); await t.assentar(20);
  t.clicar("#certNvBenefAdd"); await t.assentar(30);
  b.igual(cards()[0].querySelector(".js-inst").value, "", "vazio, e sem etiqueta");
  aplicarEscola({ nome: "ESCOLA X", escolaId: "E", cnpj: "", email: "" });
  b.igual(cards()[0].querySelector(".js-inst").value, "ESCOLA X", "escolhida a escola depois, o cartão acompanha");
  aplicarEscola({ nome: "", escolaId: "", cnpj: "", email: "" });
  b.igual(cards()[0].querySelector(".js-inst").value, "", "apagada a escola, volta a ficar vazio");

  b.passo("6. SERVIDOR: cartão com instituição DIFERENTE não herda CNPJ/e-mail do cabeçalho");
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  const r = g.voucherCriarSolicitacoesEmLote({
    comuns: { cpf: "11144477735", nome: "TITULAR", email: "t@x.com", periodo: "2028", regime: "ANUAL", modalidade: "ENSINO_MEDIO", curso: "1",
              instituicao: "ESCOLA DO CABECALHO", cnpjInstituicao: "11222333000144", emailInstituicao: "cab@escola.com" },
    beneficiarios: [
      { tipoBeneficiario: "FILHO", beneficiario: "A", ordemFilho: "1", instituicao: "ESCOLA DO CABECALHO" },
      { tipoBeneficiario: "FILHO", beneficiario: "B", ordemFilho: "2", instituicao: "OUTRA ESCOLA" }]
  }, TOKEN);
  b.igual(r.criados, 2, "criou os 2", r.mensagem);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const linhas = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues();
  const de = p => { const l = linhas.filter(x => String(x[cab.indexOf("NUMERO_PROTOCOLO")]) === p)[0]; const o = {}; cab.forEach((c, i) => o[c] = l[i]); return o; };
  const A = de(r.resultados[0].protocolo), B = de(r.resultados[1].protocolo);
  b.igual(String(A.CNPJ_INSTITUICAO).replace(/\D/g, ""), "11222333000144", "A (mesma do cabeçalho) mantém o CNPJ");
  b.igual(String(B.CNPJ_INSTITUICAO || ""), "", "B (outra escola) NÃO ficou com o CNPJ do cabeçalho");
  b.ok(String(B.EMAIL_INSTITUICAO || "") !== "cab@escola.com", "nem com o e-mail do cabeçalho", B.EMAIL_INSTITUICAO);
  b.resumo();
})();
