/**
 * CENTRAL DE VOUCHER · LINHA REFINADA (19/11/2026, desenho aprovado pelo usuário: 6 colunas + checkbox, botão da próxima ação, dependente
 * claro, irmãos agrupados, cartão no celular). Condição dele: "desde que não perca nenhuma função". Este teste prova o que é NOVO; o que já
 * existia continua guardado pelos testes antigos da mesma tela (t193 dependente/titular/CPF, t62 selo presencial, t199 data e quem fez,
 * t223 envio e filtros, t36/t37 sem período), que passam SEM alteração. Dados FICTÍCIOS.
 * NÃO PROVA: o aspecto na tela (jsdom não aplica CSS; a conferência visual é feita à parte, em navegador) nem o celular de verdade.
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.fluxo("VOUCHER · Central com a linha refinada");
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(campos) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const base = { EMAIL: "x@exemplo.com", ESCOLA_SELECIONADA: "Colégio Exemplo", MODALIDADE: "ENSINO_FUNDAMENTAL", PERIODO_REFERENCIA: "2027", SITUACAO_SINDICAL: "ASSOCIADO" };
const MARIANA = "MARIANA EXEMPLO SILVA", CPF_M = "11144477735", CPF_P = "52998224725", CPF_C = "39053344705";
// Irmãos gravados FORA de ordem (2º filho primeiro) e com um dependente de outro titular no meio, para provar o agrupamento
gravar({ ...base, ID_SOLICITACAO: "S1", NUMERO_PROTOCOLO: "BOLSA-2026-111111", CPF_SOLICITANTE: CPF_M, NOME_SOLICITANTE: MARIANA, NOME_BENEFICIARIO: "BEATRIZ EXEMPLO SILVA", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "2", CURSO: "5 ano", STATUS_SOLICITACAO: "APROVADO" });
gravar({ ...base, ID_SOLICITACAO: "S2", NUMERO_PROTOCOLO: "BOLSA-2026-222222", CPF_SOLICITANTE: CPF_P, NOME_SOLICITANTE: "PAULO EXEMPLO LIMA", NOME_BENEFICIARIO: "ANA EXEMPLO LIMA", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "1", CURSO: "7 ano", STATUS_SOLICITACAO: "EMITIDO" });
gravar({ ...base, ID_SOLICITACAO: "S3", NUMERO_PROTOCOLO: "BOLSA-2026-333333", CPF_SOLICITANTE: CPF_M, NOME_SOLICITANTE: MARIANA, NOME_BENEFICIARIO: "LUCAS EXEMPLO SILVA", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "1", CURSO: "3 ano", STATUS_SOLICITACAO: "APROVADO" });
gravar({ ...base, ID_SOLICITACAO: "S4", NUMERO_PROTOCOLO: "BOLSA-2026-444444", CPF_SOLICITANTE: CPF_C, NOME_SOLICITANTE: "CARLOS EXEMPLO SOUZA", NOME_BENEFICIARIO: "CARLOS EXEMPLO SOUZA", TIPO_BENEFICIARIO: "TITULAR", MODALIDADE: "GRADUACAO", CURSO: "Administração", STATUS_SOLICITACAO: "PENDENTE" });
gravar({ ...base, ID_SOLICITACAO: "S5", NUMERO_PROTOCOLO: "BOLSA-2026-555555", CPF_SOLICITANTE: CPF_C, NOME_SOLICITANTE: "CARLOS EXEMPLO SOUZA", NOME_BENEFICIARIO: "DENISE EXEMPLO SOUZA", TIPO_BENEFICIARIO: "FILHO", CURSO: "1 ano", STATUS_SOLICITACAO: "APROVADO" });   // sem ORDEM_FILHO: linha antiga

gravar({ ...base, ID_SOLICITACAO: "S6", NUMERO_PROTOCOLO: "BOLSA-2026-666666", CPF_SOLICITANTE: "11122233396", NOME_SOLICITANTE: "ELZA EXEMPLO ROCHA", NOME_BENEFICIARIO: "ELZA EXEMPLO ROCHA", TIPO_BENEFICIARIO: "TITULAR", MODALIDADE: "GRADUACAO", CURSO: "Pedagogia", STATUS_SOLICITACAO: "EMITIDO" });
const listarOrig = g.listarSolicitacoesCertBolsa;
g.listarSolicitacoesCertBolsa = function () {   // a Ana (EMITIDO) já foi enviada; a Elza (EMITIDO) não
  const r = listarOrig.apply(this, arguments);
  if (Array.isArray(r)) r.forEach((x) => { if (x.protocolo === "BOLSA-2026-222222") x.envio = { situacao: "ENVIADO", em: "18/11 16:31", por: "marcela@sindeducacao.com", para: "ana@exemplo.com" }; });
  return r;
};

if (!dom.jsdomDisponivel()) { b.naoTestavel("tela da Central", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win;
  win.initCertificadoAdmin();
  await t.assentar(120);
  const tbody = doc.getElementById("certTbody");
  const linhas = Array.from(tbody.querySelectorAll("tr[data-prot]"));
  const por = (p) => linhas.filter((tr) => tr.getAttribute("data-prot") === p)[0];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  b.passo("1. a tabela tem 7 colunas (checkbox + 6) e todos os filtros continuam");
  b.igual(linhas.length, 6, "as seis solicitações foram desenhadas");
  const ths = doc.querySelectorAll(".cert-tabela thead tr:first-child th");
  b.igual(ths.length, 7, "cabeçalho com 7 colunas (eram 11)", Array.from(ths).map(txt).join(" | "));
  b.ok(linhas.every((tr) => tr.querySelectorAll("td").length === 7), "toda linha tem 7 células");
  ["Protocolo", "Solicitante", "Escola", "Curso", "Modalidade", "Periodo", "Status", "Envio", "EnviadoPor"].forEach((n) =>
    b.ok(!!doc.querySelector(".cert-linha-filtros #certFiltro" + n), "filtro de " + n + " continua na linha de filtros"));
  b.ok(!!doc.getElementById("certFiltroDataDe") && !!doc.getElementById("certFiltroDataAte") && !!doc.getElementById("certBusca"), "busca geral e filtro de data continuam");

  b.passo("2. dependente claro: nome primeiro, ordem do filho, titular e CPF em toda linha");
  const trB = por("BOLSA-2026-111111"), trL = por("BOLSA-2026-333333"), trA = por("BOLSA-2026-222222"), trC = por("BOLSA-2026-444444"), trD = por("BOLSA-2026-555555");
  b.ok(/2º filho\(a\)/.test(txt(trB.querySelector(".cert-tag-parentesco"))), "Beatriz: selo '2º filho(a)'");
  b.ok(/1º filho\(a\)/.test(txt(trL.querySelector(".cert-tag-parentesco"))), "Lucas: selo '1º filho(a)'");
  b.ok(txt(trD.querySelector(".cert-tag-parentesco")) === "filho(a)", "linha antiga sem ordem continua 'filho(a)' (não inventa número)", txt(trD.querySelector(".cert-tag-parentesco")));
  b.ok(txt(trC.querySelector(".cert-benef-nome")).indexOf("CARLOS EXEMPLO SOUZA") === 0 && !!trC.querySelector(".cert-tag-proprio") && !trC.querySelector(".cert-tag-parentesco"), "associado: nome primeiro e selo 'associado', sem selo de parentesco");
  [trB, trL].forEach((tr) => b.ok(/Titular: MARIANA EXEMPLO SILVA/.test(txt(tr)) && /111\.444\.777-35/.test(txt(tr)), "cada irmão traz o titular e o CPF formatado (filtrando por um só, a linha continua dizendo de quem é)"));
  b.ok(trB.querySelector("td.c-benef").getAttribute("data-ini") === "BS" && trC.querySelector("td.c-benef").getAttribute("data-ini") === "CS", "iniciais do avatar vão em atributo (não entram no texto da célula)");
  b.ok(/^BEATRIZ/.test(txt(trB.querySelector(".cert-benef-nome"))), "e o nome continua sendo a primeira coisa lida");

  b.passo("3. irmãos juntos, em ordem de filho");
  const protsOrdem = linhas.map((tr) => tr.getAttribute("data-prot"));
  const iL = protsOrdem.indexOf("BOLSA-2026-333333"), iB = protsOrdem.indexOf("BOLSA-2026-111111");
  b.ok(iB === iL + 1, "Lucas (1º) e Beatriz (2º) ficam um ao lado do outro, na ordem do filho", protsOrdem.join(" "));
  b.ok(trL.classList.contains("cert-irmao") && trB.classList.contains("cert-irmao"), "os dois levam a marca de irmãos");
  b.ok(!trA.classList.contains("cert-irmao") && !trC.classList.contains("cert-irmao") && !trD.classList.contains("cert-irmao"), "quem não tem irmão na página não leva a marca");

  b.passo("4. o botão da próxima ação, e os três de antes continuam");
  const btn = (tr, sel) => tr.querySelector(sel);
  b.ok(txt(btn(trL, ".cert-btn-emitir-rapido.cert-acao-prim")) === "Emitir" && !btn(trL, ".cert-btn-enviar"), "APROVADO: botão 'Emitir' em destaque, sem Enviar");
  const trE = por("BOLSA-2026-666666");
  b.ok(txt(btn(trE, ".cert-btn-enviar.cert-acao-prim")) === "Enviar" && !!btn(trE, ".cert-btn-emitir-rapido:not(.cert-acao-prim)"), "EMITIDO e ainda não enviado: 'Enviar' em destaque, e a reemissão (🎓) continua à mão");
  b.ok(txt(btn(trA, ".cert-btn-enviar.cert-acao-prim")) === "Reenviar", "EMITIDO e já enviado: o mesmo botão passa a dizer 'Reenviar'");
  b.ok(/marcela/.test(txt(trA.querySelector("td.c-sit"))) && /ana@exemplo\.com/.test(txt(trA.querySelector("td.c-sit"))), "e a situação mostra quem enviou e para quem");
  b.ok(!btn(trC, ".cert-acao-prim") && !btn(trC, ".cert-btn-emitir-rapido"), "PENDENTE: sem botão de emitir/enviar (como antes)");
  b.ok(linhas.every((tr) => !!btn(tr, ".cert-btn-abrir-modal")), "toda linha mantém o botão de Ver / Ações");

  b.passo("5. tocar na linha abre os detalhes; caixa e botões não");
  const sub = () => txt(doc.getElementById("certModalSub"));
  const lin = () => Array.from(tbody.querySelectorAll("tr[data-prot]")).filter((tr) => tr.getAttribute("data-prot") === "BOLSA-2026-444444")[0];
  lin().querySelector("td.c-benef").click();
  await t.assentar(60);
  b.ok(sub() === "BOLSA-2026-444444", "tocar no nome abre a solicitação (mesmo caminho do lápis)", sub());
  doc.getElementById("certModalSub").textContent = "";
  lin().querySelector(".cert-sel-linha").click();
  await t.assentar(40);
  b.ok(sub() === "", "marcar a caixa NÃO abre os detalhes");
  b.ok(/1 selecionada/.test(txt(doc.getElementById("certBarraSelTxt"))), "e a barra de seleção em lote continua contando");

  b.passo("6. o CSS do celular existe e a tabela não tem mais largura mínima de 1000px");
  const fonte = fs.readFileSync(path.join(__dirname, "../../Scripts_Certificado.html"), "utf8");
  b.ok(/@media \(max-width:760px\)\{#secCertificadoAdmin \.cert-tabela,/.test(fonte) && /grid-template-areas:"chk sol sit"/.test(fonte), "regra de cartão para tela estreita");
  b.ok(!/\.cert-tabela \{ width: 100%; min-width: 1000px/.test(fonte), "a largura mínima de 1000px saiu (era o que escondia a coluna Ações)");
  b.resumo();
})();
