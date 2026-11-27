/**
 * VOUCHER · LISTA COM COLUNA EMISSÃO E FILTRO ▾ EM CADA COLUNA (27/11/2026, desenho aprovado). Prova (jsdom): a coluna Emissão mostra data e hora ("—" sem emissão);
 * o ▾ de cada coluna abre a caixinha e filtra/ordena usando os MESMOS campos do painel; o ponto de "coluna filtrada" e a etiqueta em Filtros ativos aparecem; Limpar volta
 * tudo; no celular valem o campo "Emitido em" e o seletor "Ordenar" do painel. NÃO PROVA: o visual real nem o cartão do celular (jsdom não aplica CSS).
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("VOUCHER · filtro por coluna"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const base = { EMAIL: "a@exemplo.com", MODALIDADE: "ENSINO_FUNDAMENTAL", PERIODO_REFERENCIA: "2027", STATUS_SOLICITACAO: "EMITIDO", TIPO_BENEFICIARIO: "FILHO", CPF_SOLICITANTE: "11144477735" };
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S1", NUMERO_PROTOCOLO: "BOLSA-2026-000001", NOME_BENEFICIARIO: "AMANDA", NOME_SOLICITANTE: "AMANDA TITULAR", ESCOLA_SELECIONADA: "Escola Beta" });
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S2", NUMERO_PROTOCOLO: "BOLSA-2026-000002", NOME_BENEFICIARIO: "MIRIAN", NOME_SOLICITANTE: "MIRIAN TITULAR", ESCOLA_SELECIONADA: "Escola Alfa", PERIODO_REFERENCIA: "2026" });
gravar("Voucher_Solicitacoes", { ...base, ID_SOLICITACAO: "S3", NUMERO_PROTOCOLO: "BOLSA-2026-000003", NOME_BENEFICIARIO: "SOFIA", NOME_SOLICITANTE: "SOFIA TITULAR", ESCOLA_SELECIONADA: "Escola Gama", STATUS_SOLICITACAO: "APROVADO" });
gravar("Voucher_Emitidos", { ID_EMISSAO: "E1", DATA_EMISSAO: new Date(2026, 10, 27, 12, 49), PROTOCOLO: "BOLSA-2026-000001", TIPO_DOCUMENTO: "CERTIFICADO", USUARIO: "wanderson" });
gravar("Voucher_Emitidos", { ID_EMISSAO: "E2", DATA_EMISSAO: new Date(2026, 10, 26, 13, 6), PROTOCOLO: "BOLSA-2026-000002", TIPO_DOCUMENTO: "CERTIFICADO", USUARIO: "wanderson" });
(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win, el = (id) => doc.getElementById(id);
  win.initCertificadoAdmin(); await t.assentar(120);
  const txt = (x) => (x ? x.textContent.replace(/\s+/g, " ").trim() : "");
  const prots = () => Array.from(doc.querySelectorAll("#certTbody tr[data-prot]")).map((r) => r.getAttribute("data-prot").replace("BOLSA-2026-", ""));
  const abrir = (col) => { doc.querySelector('th[data-col="' + col + '"] .cert-col-f').click(); };
  const pop = () => el("certColPop");
  b.fluxo("VOUCHER · coluna Emissão e filtro ▾ por coluna");

  b.passo("1. A coluna Emissão");
  b.ok(Array.from(doc.querySelectorAll("thead th")).map((x) => txt(x).replace(" ▾", "")).join("|").indexOf("Situação|Emissão|Ação") > -1, "o título Emissão vem logo depois de Situação e antes de Ação");
  b.ok(/27\/11\/2026\s*12:49/.test(txt(doc.querySelector('tr[data-prot="BOLSA-2026-000001"] .c-emi'))), "mostra a data e a hora da emissão");
  b.igual(txt(doc.querySelector('tr[data-prot="BOLSA-2026-000003"] .c-emi')), "—", "sem emissão mostra '—'");
  b.ok(!/Emitido:/.test(txt(doc.querySelector('tr[data-prot="BOLSA-2026-000001"] .c-sit'))), "e a data não repete dentro da Situação");

  b.passo("2. ▾ da Emissão: ordenar");
  abrir("emi"); b.ok(!!pop() && /Mais recente primeiro/.test(txt(pop())), "abre a caixinha com a ordem por data");
  pop().querySelector('[data-ord="desc"]').click(); await t.assentar(10);
  b.igual(prots().join(","), "000001,000002,000003", "mais recente primeiro (quem não tem emissão fica por último)");
  b.ok(doc.querySelector('th[data-col="emi"]').classList.contains("cert-col-on"), "a coluna ordenada ganha o ponto dourado");
  abrir("emi"); pop().querySelector('[data-ord="asc"]').click(); await t.assentar(10);
  b.igual(prots().join(","), "000002,000001,000003", "mais antiga primeiro (sem emissão continua por último)");
  b.igual(el("certOrdemSel").value, "emi:asc", "o seletor Ordenar do painel (celular) acompanha");

  b.passo("3. ▾ da Emissão: filtrar por dia");
  abrir("emi"); const di = el("certColIn"); di.value = "2026-11-26"; di.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000002", "só as emitidas naquele dia");
  b.igual(el("certFiltroEmissao").value, "2026-11-26", "usa o mesmo campo do painel (Emitido em)");
  b.ok(/Emissão: 2026-11-26/.test(txt(el("certChips"))), "aparece em Filtros ativos", txt(el("certChips")));
  pop() && pop().querySelector("[data-limpar]").click(); await t.assentar(10);
  b.igual(el("certFiltroEmissao").value, "", "Limpar tira o filtro do dia");

  b.passo("4. ▾ de Nível/Período/Situação: lista de opções");
  abrir("per"); pop().querySelector('[data-val="2026"]').click(); await t.assentar(10);
  b.igual(prots().join(","), "000002", "Período: escolher 2026 mostra só ele");
  b.igual(el("certFiltroPeriodo").value, "2026", "mesmo campo do painel");
  abrir("sit"); pop().querySelector('[data-val="APROVADO"]').click(); await t.assentar(10);
  b.igual(prots().length, 0, "Período 2026 + Situação Aprovado se combinam (E) e não sobra nenhuma");
  el("certLimparFiltros").click(); await t.assentar(10);
  b.ok(prots().length === 3, "Limpar filtros devolve as 3");

  b.passo("5. ▾ de texto: Escola, Nº da bolsa e Funcionário");
  abrir("escola"); let i = el("certColIn"); i.value = "alfa"; i.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000002", "Escola: 'alfa' acha a Escola Alfa");
  el("certLimparFiltros").click(); await t.assentar(10);
  abrir("prot"); i = el("certColIn"); i.value = "000003"; i.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000003", "Nº da bolsa: filtra pelo número");
  el("certLimparFiltros").click(); await t.assentar(10);
  abrir("func"); i = el("certColIn"); i.value = "sofia"; i.dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000003", "Funcionário: filtra pelo nome");
  el("certLimparFiltros").click(); await t.assentar(10);

  b.passo("6. Ordenar pelo Funcionário continua do jeito antigo e o seletor acompanha; Escola/Nº da bolsa ordenam");
  doc.getElementById("certThFunc").click(); await t.assentar(10);
  b.igual(el("certOrdemSel").value, "func:asc", "clicar no título Funcionário continua dando A–Z e o seletor acompanha");
  el("certOrdemSel").value = "esc:asc"; el("certOrdemSel").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000002,000001,000003", "Escola A–Z (Alfa, Beta, Gama) pelo seletor do painel, e a ordem de Funcionário sai");
  el("certOrdemSel").value = "prot:desc"; el("certOrdemSel").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(10);
  b.igual(prots().join(","), "000003,000002,000001", "Nº da bolsa Z–A");

  b.passo("7. Fechar");
  abrir("sit"); b.ok(!!pop(), "abre"); doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape" })); b.ok(!pop(), "Esc fecha a caixinha");
  b.resumo(); process.exit(process.exitCode || 0);
})();
