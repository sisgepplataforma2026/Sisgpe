/**
 * CENTRAL DE VOUCHER · SITUAÇÃO SINDICAL CLARA EM TODA LINHA (desenho aprovado em 26/11/2026).
 * O usuário, vendo "○ Ainda não enviado" em vouchers de não associado: "dá a entender que foi emitido e não foi enviado ... os não
 * associados são somente impressos e devem retirar presencialmente" e "tem que ter uma observação de quem é associado ou não".
 * Também: a etiqueta 'associado' das linhas de titular queria dizer "o próprio titular", não "filiado" — virou 'titular'.
 * Prova: etiqueta de situação sindical em toda linha; não associado SEM envio → "Só impresso — retirada presencial" (sem "Ainda não
 * enviado") e botão Imprimir no lugar de Enviar; em branco → "não informada" + aviso, sem presumir; associado segue como era.
 * NÃO PROVA: cor e aspecto (jsdom não desenha). Dados FICTÍCIOS.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.fluxo("VOUCHER · situação sindical na linha");
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function gravar(campos) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((c) => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([cab.map((c) => (campos[c] !== undefined ? campos[c] : ""))]);
}
const base = { EMAIL: "x@exemplo.com", ESCOLA_SELECIONADA: "Colégio Exemplo", MODALIDADE: "GRADUACAO", CURSO: "Pedagogia", PERIODO_REFERENCIA: "2027/1", STATUS_SOLICITACAO: "EMITIDO" };
// A: associado, titular · B: NÃO associado, titular · C: em branco, titular · D: não associado, DEPENDENTE · E: associado, dependente
gravar({ ...base, ID_SOLICITACAO: "A", NUMERO_PROTOCOLO: "BOLSA-2026-000001", CPF_SOLICITANTE: "11144477735", NOME_SOLICITANTE: "ANA ASSOCIADA SILVA", NOME_BENEFICIARIO: "ANA ASSOCIADA SILVA", TIPO_BENEFICIARIO: "TITULAR", SITUACAO_SINDICAL: "ASSOCIADO" });
gravar({ ...base, ID_SOLICITACAO: "B", NUMERO_PROTOCOLO: "BOLSA-2026-000002", CPF_SOLICITANTE: "52998224725", NOME_SOLICITANTE: "BRUNO NAO ASSOCIADO LIMA", NOME_BENEFICIARIO: "BRUNO NAO ASSOCIADO LIMA", TIPO_BENEFICIARIO: "TITULAR", SITUACAO_SINDICAL: "NAO_ASSOCIADO" });
gravar({ ...base, ID_SOLICITACAO: "C", NUMERO_PROTOCOLO: "BOLSA-2026-000003", CPF_SOLICITANTE: "39053344705", NOME_SOLICITANTE: "CLARA EM BRANCO ROCHA", NOME_BENEFICIARIO: "CLARA EM BRANCO ROCHA", TIPO_BENEFICIARIO: "TITULAR", SITUACAO_SINDICAL: "" });
gravar({ ...base, ID_SOLICITACAO: "D", NUMERO_PROTOCOLO: "BOLSA-2026-000004", CPF_SOLICITANTE: "11122233396", NOME_SOLICITANTE: "DANIELA TITULAR NAO ASSOC", NOME_BENEFICIARIO: "DUDA FILHA", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "1", SITUACAO_SINDICAL: "NAO_ASSOCIADO" });
gravar({ ...base, ID_SOLICITACAO: "E", NUMERO_PROTOCOLO: "BOLSA-2026-000005", CPF_SOLICITANTE: "11144477735", NOME_SOLICITANTE: "ANA ASSOCIADA SILVA", NOME_BENEFICIARIO: "EDUARDO FILHO", TIPO_BENEFICIARIO: "FILHO", ORDEM_FILHO: "1", SITUACAO_SINDICAL: "ASSOCIADO" });
gravar({ ...base, ID_SOLICITACAO: "F", NUMERO_PROTOCOLO: "BOLSA-2026-000006", CPF_SOLICITANTE: "98765432100", NOME_SOLICITANTE: "FABIO NAO ASSOCIADO JA ENVIADO", NOME_BENEFICIARIO: "FABIO NAO ASSOCIADO JA ENVIADO", TIPO_BENEFICIARIO: "TITULAR", SITUACAO_SINDICAL: "NAO_ASSOCIADO" });
const listarOrig = g.listarSolicitacoesCertBolsa;
g.listarSolicitacoesCertBolsa = function () {   // o Fábio (não associado) JÁ teve um envio registrado: o botão volta ao normal
  const r = listarOrig.apply(this, arguments);
  if (Array.isArray(r)) r.forEach((x) => { x.emitidoEm = "26/11/2026 10:44"; if (x.protocolo === "BOLSA-2026-000006") x.envio = { situacao: "ENVIADO", em: "20/11 10:00", por: "marcela@sindeducacao.com", para: "f@exemplo.com" }; });
  return r;
};
if (!dom.jsdomDisponivel()) { b.naoTestavel("tela da Central", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc, win = t.win;
  win.initCertificadoAdmin();
  await t.assentar(120);
  const linhas = Array.from(doc.getElementById("certTbody").querySelectorAll("tr[data-prot]"));
  const por = (n) => linhas.filter((tr) => tr.getAttribute("data-prot") === "BOLSA-2026-00000" + n)[0];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const sit = (tr) => txt(tr.querySelector("td.c-sit"));
  const btnPrim = (tr) => tr.querySelector(".cert-acao-prim");
  b.igual(linhas.length, 6, "as seis solicitações foram desenhadas");

  b.passo("1. toda linha diz a situação sindical");
  const A = por(1), B = por(2), C = por(3), D = por(4), E = por(5), F = por(6);
  b.ok(!!A.querySelector(".cert-tag-assoc") && /associado/i.test(txt(A.querySelector(".cert-tag-assoc"))), "associado: etiqueta verde 'associado'");
  b.ok(!!B.querySelector(".cert-tag-presencial") && txt(B.querySelector(".cert-tag-presencial")).toLowerCase() === "não associado", "não associado: etiqueta 'NÃO ASSOCIADO' (texto do desenho)", txt(B.querySelector(".cert-tag-presencial")));
  b.ok(!!C.querySelector(".cert-tag-sind-ni") && /não informada/i.test(txt(C.querySelector(".cert-tag-sind-ni"))), "em branco: 'sindical não informada' (não presume nada)");
  b.ok(!!D.querySelector(".cert-tag-presencial") && !!D.querySelector(".cert-tag-parentesco"), "dependente de titular não associado: as duas etiquetas (filho e não associado)");
  b.ok(!!E.querySelector(".cert-tag-assoc") && !!E.querySelector(".cert-tag-parentesco"), "dependente de titular associado: filho + associado");
  b.ok(!A.querySelector(".cert-tag-presencial") && !A.querySelector(".cert-tag-sind-ni") && !B.querySelector(".cert-tag-assoc") && !C.querySelector(".cert-tag-assoc"), "contraprova: nenhuma linha leva etiqueta de outra situação");

  b.passo("2. a etiqueta 'associado' antiga virou 'titular'");
  b.ok(/titular/i.test(txt(A.querySelector(".cert-tag-proprio"))) && !/associado/i.test(txt(A.querySelector(".cert-tag-proprio"))), "o titular diz 'titular', não 'associado'", txt(A.querySelector(".cert-tag-proprio")));
  b.ok(!D.querySelector(".cert-tag-proprio") && !E.querySelector(".cert-tag-proprio"), "dependente não leva a etiqueta de titular");

  b.passo("3. não associado sem envio: 'Só impresso', nunca 'Ainda não enviado'");
  b.ok(/Só impresso — retirada presencial na sede/.test(sit(B)) && /não é enviado por e-mail/.test(sit(B)), "mostra 'Só impresso — retirada presencial'", sit(B));
  b.ok(!/Ainda não enviado/.test(sit(B)) && !/Ainda não enviado/.test(sit(D)), "e NÃO diz 'Ainda não enviado'");
  b.ok(/Emitido:/.test(sit(B)), "a data de emissão continua à vista");
  b.ok(/Emitido:/.test(sit(A)) && /Emitido:/.test(sit(C)), "e nas outras situações também");

  b.passo("4. o botão");
  b.ok(txt(btnPrim(B)) === "Imprimir" && btnPrim(B).classList.contains("cert-btn-emitir-rapido") && !B.querySelector(".cert-btn-enviar"), "não associado: 'Imprimir' (abre o certificado), sem o botão Enviar", txt(btnPrim(B)));
  b.ok(txt(btnPrim(D)) === "Imprimir", "o mesmo no dependente");
  b.ok(!!B.querySelector(".cert-btn-abrir-modal") && !!B.querySelector(".cert-btn-editar"), "Ver / Ações e Editar continuam (o envio segue acessível pelo modal)");
  b.ok(txt(btnPrim(A)) === "Enviar" && !!A.querySelector(".cert-btn-enviar"), "associado: 'Enviar', como sempre");
  b.ok(/✉ Aguardando envio por e-mail/.test(sit(A)) && !/Só impresso/.test(sit(A)) && !/Ainda não enviado/.test(sit(A)), "associado emitido e sem envio: '✉ Aguardando envio por e-mail' (texto do desenho)", sit(A));

  b.passo("5. em branco: não presume, avisa");
  b.ok(/⚠ Situação sindical em branco — defina para saber como entregar/.test(sit(C)) && !/Ainda não enviado/.test(sit(C)), "em branco: o aviso do desenho, no lugar de 'Ainda não enviado'", sit(C));
  b.ok(txt(btnPrim(C)) === "Enviar", "o botão segue como era (não decide pela pessoa)");

  b.passo("6. não associado que JÁ teve envio registrado volta ao normal");
  b.ok(/Enviado:/.test(sit(F)) && !/Só impresso/.test(sit(F)), "mostra o envio, não 'Só impresso'", sit(F));
  b.ok(txt(btnPrim(F)) === "Reenviar", "e o botão diz 'Reenviar'");
  b.naoTestavel("cor das etiquetas (verde, dourado, tracejado) e do quadro dourado", "jsdom não desenha — conferir em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
