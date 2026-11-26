/**
 * CENTRAL DE VOUCHER · CABEÇALHO, FILTROS E ORDEM A–Z (refino UX aprovado em 26/11/2026).
 * "O cabeçalho é: número da bolsa, funcionário, escola, nível, período, situação e ação"; "filtro por funcionário, escola, curso";
 * "aqueles filtros não ficaram bacanas"; "em negrito somente os funcionários"; "coloca um filtro de A a Z no funcionário".
 * Prova: cabeçalho só com títulos (nenhum campo dentro); filtros num painel próprio, com rótulo; "Filtros ativos" com ✕ que limpa só um filtro;
 * Limpar filtros; clique em "Funcionário" ordena A–Z → Z–A → original; negrito só no funcionário (CSS). NÃO PROVA: aparência (jsdom não desenha).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.fluxo("VOUCHER · cabeçalho, filtros e ordem A–Z");
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(campos) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const base = { EMAIL: "x@exemplo.com", ESCOLA_SELECIONADA: "Colégio Exemplo", MODALIDADE: "GRADUACAO", CURSO: "Pedagogia", PERIODO_REFERENCIA: "2027/1", SITUACAO_SINDICAL: "ASSOCIADO" };
// gravadas FORA de ordem alfabética: Carlos, Ana, Eva (aprovada), Bruno (titular com dependente Zé)
gravar({ ...base, ID_SOLICITACAO: "1", NUMERO_PROTOCOLO: "BOLSA-2026-000001", CPF_SOLICITANTE: "11144477735", NOME_SOLICITANTE: "CARLOS TITULAR", NOME_BENEFICIARIO: "CARLOS TITULAR", TIPO_BENEFICIARIO: "TITULAR", STATUS_SOLICITACAO: "EMITIDO" });
gravar({ ...base, ID_SOLICITACAO: "2", NUMERO_PROTOCOLO: "BOLSA-2026-000002", CPF_SOLICITANTE: "52998224725", NOME_SOLICITANTE: "ANA TITULAR", NOME_BENEFICIARIO: "ANA TITULAR", TIPO_BENEFICIARIO: "TITULAR", STATUS_SOLICITACAO: "PENDENTE" });
gravar({ ...base, ID_SOLICITACAO: "3", NUMERO_PROTOCOLO: "BOLSA-2026-000003", CPF_SOLICITANTE: "39053344705", NOME_SOLICITANTE: "ÉRICA TITULAR", NOME_BENEFICIARIO: "ÉRICA TITULAR", TIPO_BENEFICIARIO: "TITULAR", STATUS_SOLICITACAO: "EMITIDO", MODALIDADE: "ENSINO_MEDIO", CURSO: "" });
gravar({ ...base, ID_SOLICITACAO: "4", NUMERO_PROTOCOLO: "BOLSA-2026-000004", CPF_SOLICITANTE: "11122233396", NOME_SOLICITANTE: "BRUNO TITULAR", NOME_BENEFICIARIO: "ZÉ FILHO", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "1", STATUS_SOLICITACAO: "EMITIDO" });
if (!dom.jsdomDisponivel()) { b.naoTestavel("tela da Central", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win;
  win.initCertificadoAdmin();
  await t.assentar(120);
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const ordem = () => Array.from(doc.getElementById("certTbody").querySelectorAll("tr[data-prot]")).map((tr) => txt(tr.querySelector(".cert-benef-nome")).split(" ").slice(0, 1).join(" "));
  const original = ordem();
  b.igual(original.length, 4, "as quatro solicitações foram desenhadas");

  b.passo("1. cabeçalho só com títulos");
  const ths = Array.from(doc.querySelectorAll(".cert-tabela thead tr:first-child th")).map((th) => txt(th).replace(/[↕▲▼].*$/, "").trim());
  b.igual(ths.slice(1), ["Nº da bolsa", "Funcionário", "Escola", "Nível", "Período", "Situação", "Ação"], "os sete títulos, na ordem pedida");
  b.ok(doc.querySelectorAll(".cert-tabela thead input:not(#certSelTodos), .cert-tabela thead select").length === 0, "nenhum campo de filtro dentro do cabeçalho");
  b.ok(doc.querySelectorAll(".cert-tabela thead tr").length === 1, "o cabeçalho é uma linha só (a segunda linha de filtros saiu)");

  b.passo("2. filtros no painel, com rótulo fixo");
  const painel = doc.getElementById("certPainelFiltros");
  b.ok(!!painel && !painel.closest("table"), "o painel existe e fica fora da tabela");
  ["certBusca", "certFiltroDataDe", "certFiltroDataAte", "certFiltroEscola", "certFiltroCurso", "certFiltroModalidade", "certFiltroPeriodo", "certFiltroStatus", "certFiltroEnvio", "certFiltroEnviadoPor"]
    .forEach((id) => b.ok(!!painel.querySelector("#" + id) && !!painel.querySelector('label[for="' + id + '"]'), "painel: " + id + " com rótulo"));
  b.ok(doc.getElementById("certFiltroModalidade").options.length >= 9 && doc.getElementById("certFiltroStatus").options.length >= 9, "as opções de Nível e de Situação vieram inteiras");

  b.passo("3. Filtros ativos: etiqueta com ✕");
  const ativos = doc.getElementById("certFiltrosAtivos");
  b.ok(ativos.style.display === "none", "sem filtro, a faixa 'Filtros ativos' não aparece");
  doc.getElementById("certFiltroStatus").value = "EMITIDO";
  doc.getElementById("certFiltroStatus").dispatchEvent(new win.Event("change", { bubbles: true }));
  doc.getElementById("certFiltroModalidade").value = "GRADUACAO";
  doc.getElementById("certFiltroModalidade").dispatchEvent(new win.Event("change", { bubbles: true }));
  await t.assentar(120);
  const chips = () => Array.from(doc.querySelectorAll("#certChips .cert-pf-chip")).map(txt);
  b.ok(ativos.style.display !== "none" && chips().some((c) => /Situação: Emitido/.test(c)) && chips().some((c) => /Nível: Graduação/.test(c)), "aparece uma etiqueta para cada filtro em uso", chips().join(" | "));
  b.igual(ordem().length, 2, "e a lista respeita os dois filtros (Emitido + Graduação: Carlos e Zé/Bruno)", ordem().join(","));
  doc.querySelector('#certChips .cert-pf-chip[data-filtro="certFiltroModalidade"]').click();
  await t.assentar(120);
  b.ok(chips().length === 1 && /Situação/.test(chips()[0]) && doc.getElementById("certFiltroModalidade").value === "", "o ✕ tira só aquele filtro", chips().join(" | "));
  b.igual(ordem().length, 3, "e a lista volta a mostrar os Emitidos de qualquer nível", ordem().join(","));
  doc.getElementById("certLimparFiltros").click();
  await t.assentar(120);
  b.ok(chips().length === 0 && doc.getElementById("certFiltroStatus").value === "" && ordem().length === 4, "'Limpar filtros' zera tudo");
  doc.getElementById("certFiltroEnvio").value = "ENVIADO";
  doc.getElementById("certFiltroEnvio").dispatchEvent(new win.Event("change", { bubbles: true }));
  await t.assentar(120);
  b.ok(chips().some((c) => /Envio/.test(c)) && doc.getElementById("certLimparFiltros").style.display !== "none", "o filtro de envio também conta como filtro ativo (antes não contava)");
  doc.getElementById("certLimparFiltros").click(); await t.assentar(120);

  b.passo("4. A–Z no funcionário");
  const th = doc.getElementById("certThFunc");
  b.ok(th.getAttribute("data-ordem") === "" && /A–Z/.test(txt(th)), "o título 'Funcionário' oferece a ordem A–Z");
  th.click(); await t.assentar(60);
  b.igual(ordem(), ["ANA", "BRUNO", "CARLOS", "ÉRICA"], "1º clique: A a Z, pelo nome do funcionário (o titular; o dependente Zé não puxa o Bruno para o fim)");
  b.ok(/▲/.test(txt(th)) && th.getAttribute("data-ordem") === "asc", "e a seta mostra A–Z");
  th.click(); await t.assentar(60);
  b.igual(ordem(), ["ÉRICA", "CARLOS", "BRUNO", "ANA"], "2º clique: Z a A");
  th.click(); await t.assentar(60);
  b.igual(ordem(), original, "3º clique: volta à ordem original");
  th.click(); await t.assentar(60);
  doc.getElementById("certFiltroStatus").value = "EMITIDO";
  doc.getElementById("certFiltroStatus").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(120);
  b.igual(ordem(), ["BRUNO", "CARLOS", "ÉRICA"], "a ordem A–Z vale junto com os filtros");

  b.passo("5. negrito só no funcionário");
  const fonte = fs.readFileSync(path.join(__dirname, "../../Scripts_Certificado.html"), "utf8");
  b.ok(/\.cert-benef-nome\{font-weight:800/.test(fonte), "o funcionário em negrito");
  b.ok(/\.cert-sol-prot\{[^}]*font-weight:400/.test(fonte) && /\.cert-escola-nome\{[^}]*font-weight:400/.test(fonte) && /\.cert-dep-linha\{font-weight:400/.test(fonte), "número da bolsa, escola e dependente em peso normal");
  b.naoTestavel("aparência (faixa azul-marinho, painel, etiquetas azuis)", "jsdom não desenha — conferir na captura real e em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
