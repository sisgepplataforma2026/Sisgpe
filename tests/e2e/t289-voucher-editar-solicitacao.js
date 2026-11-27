/**
 * TESTE — EDITAR UMA SOLICITAÇÃO DE VOUCHER (VoucherEdicao.gs)
 *
 * Pedido do usuário (24/11/2026): botão Editar para corrigir o que foi esquecido — todos os campos da Nova solicitação.
 * PROVA (emulador): validação, gravação só das células que mudaram, histórico campo a campo, trava de duplicidade, certificado
 * desatualizado sinalizado (voucher emitido), refazer chamando a regeneração. NÃO PROVA: o PDF de verdade (Drive/HTML→PDF).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shE = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
shE.clear();
shE.getRange(1, 1, 1, 6).setValues([["Escola (Razão Social)", "CNPJ", "Cidade", "UF", "EscolaID", "E-mail (principal)"]]);
shE.getRange(2, 1, 2, 6).setValues([["COLEGIO ALFA LTDA", "11222333000144", "VITORIA", "ES", "ESC-001", "rh@alfa.com"], ["COLEGIO BETA LTDA", "99888777000166", "SERRA", "ES", "ESC-002", "rh@beta.com"]]);

function criar(extra) {
  return g.voucherCriarSolicitacao(Object.assign({ situacaoSindical: "ASSOCIADO", cpf: "11144477735", nome: "TITULAR EXEMPLO", email: "t@x.com", modalidade: "ENSINO_FUNDAMENTAL",
    curso: "6 ANO", periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1", beneficiario: "FILHA UM",
    escola: "COLEGIO ALFA LTDA", instituicao: "COLEGIO ALFA LTDA", aprovar: true }, extra || {}), TOKEN);
}
function linha(proto) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(r => String(r[cab.indexOf("NUMERO_PROTOCOLO")]).trim() === proto)[0];
  const o = {}; cab.forEach((c, i) => { o[c] = l[i]; }); return o;
}
function historico(proto) {
  const sh = ss.getSheetByName("Voucher_Historico");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().map(r => r.join(" | ")).filter(t => t.indexOf(proto) > -1);
}
const A = criar();
const P = A.protocolo;
b.fluxo("VOUCHER · editar solicitação");

b.passo("1. Abrir a edição traz tudo o que está gravado");
const c = g.voucherCarregarParaEdicao(P, TOKEN);
b.ok(c.ok && c.valores.beneficiario === "FILHA UM" && c.valores.curso === "6 ANO" && c.valores.email === "t@x.com", "valores preenchidos", JSON.stringify(c.valores).slice(0, 160));
b.igual(c.emitido, false, "ainda não emitido");

b.passo("2. Corrigir e-mail, telefone e curso: só essas células mudam");
const r1 = g.voucherEditarSolicitacao(P, { email: "novo@x.com", telefone: "27999990000", curso: "7 ANO", beneficiario: "FILHA UM" }, {}, TOKEN);
b.ok(r1.ok && r1.alteradas === 3, "3 campos alterados (o nome igual é ignorado)", r1.mensagem + " " + JSON.stringify(r1.campos));
const l1 = linha(P);
b.igual(l1.EMAIL, "novo@x.com", "e-mail gravado"); b.igual(String(l1.TELEFONE), "27999990000", "telefone gravado"); b.igual(l1.CURSO, "7 ANO", "curso gravado");
b.igual(l1.NUMERO_PROTOCOLO, P, "protocolo intacto");
b.igual(historico(P).filter(t => /CAMPO_EDITADO/.test(t)).length, 3, "uma linha de histórico por campo");
b.ok(historico(P).some(t => /Curso: “6 ANO” → “7 ANO”/.test(t)), "o histórico diz antigo → novo", historico(P).join(" // "));

b.passo("3. Sem mudança: não grava nada nem escreve histórico");
const antes = historico(P).length;
const r2 = g.voucherEditarSolicitacao(P, { email: "novo@x.com" }, {}, TOKEN);
b.ok(r2.ok && r2.semMudanca, "diz que nada mudou", r2.mensagem);
b.igual(historico(P).length, antes, "e o histórico não cresce");

b.passo("4. Validações recusam e NÃO gravam nada");
[[{ cpf: "11111111111" }, /CPF inválido/], [{ email: "isso-nao-e-email" }, /inválido/], [{ percentual: 150 }, /Percentual/],
 [{ modalidade: "OUTRA" }, /Modalidade inválida/], [{ tipoBeneficiario: "PRIMO" }, /Tipo/], [{ ordemFilho: "4" }, /3º dependente/]].forEach(([campos, re]) => {
  const r = g.voucherEditarSolicitacao(P, Object.assign({ telefone: "27888880000" }, campos), {}, TOKEN);
  b.ok(r.ok === false && re.test(r.mensagem), "recusa " + JSON.stringify(campos), r.mensagem);
});
b.igual(String(linha(P).TELEFONE), "27999990000", "nenhuma das recusas gravou (o telefone ficou como estava)");

b.passo("5. Escola: o CADASTRO vale (CNPJ, cidade, ID vêm juntos); fora do cadastro grava com aviso");
const r3 = g.voucherEditarSolicitacao(P, { escola: "COLEGIO BETA LTDA" }, {}, TOKEN);
b.ok(r3.ok, "ok", r3.mensagem);
const l3 = linha(P);
b.ok(l3.ESCOLA_SELECIONADA === "COLEGIO BETA LTDA" && String(l3.CNPJ_ESCOLA) === "99888777000166" && ("ESCOLA_ID" in l3 ? l3.ESCOLA_ID === "ESC-002" : true), "escola + CNPJ (+ ID, quando a aba tem a coluna) do cadastro", [l3.ESCOLA_SELECIONADA, l3.CNPJ_ESCOLA, l3.ESCOLA_ID].join("|"));
const r4 = g.voucherEditarSolicitacao(P, { escola: "ESCOLINHA QUE NAO EXISTE" }, {}, TOKEN);
b.ok(r4.ok && r4.avisos.length === 1 && /não foi encontrada/.test(r4.avisos[0]), "fora do cadastro: grava e avisa", JSON.stringify(r4.avisos));

b.passo("6. Duplicidade: não deixa ficar igual a outra solicitação");
const B = criar({ beneficiario: "FILHA DOIS", ordemFilho: "2", curso: "8 ANO" });
const r5 = g.voucherEditarSolicitacao(B.protocolo, { beneficiario: "FILHA UM", curso: "7 ANO" }, {}, TOKEN);
b.ok(r5.ok === false && r5.duplicado && r5.mensagem.indexOf(P) > -1, "recusa e diz o protocolo", r5.mensagem);

b.passo("7. Voucher EMITIDO: mudança que aparece no certificado sinaliza e, se pedido, refaz");
const C = criar({ cpf: "52998224725", nome: "OUTRO TITULAR", beneficiario: "DEP EMITIDO", curso: "9 ANO" });
const ShE = ss.getSheetByName("Voucher_Emitidos");
const cabE = ShE.getRange(1, 1, 1, ShE.getLastColumn()).getValues()[0].map(x => String(x || "").trim());
ShE.getRange(ShE.getLastRow() + 1, 1, 1, cabE.length).setValues([cabE.map(x => ({ ID_EMISSAO: "EMI-1", DATA_EMISSAO: new Date(2026, 10, 24, 8, 0), PROTOCOLO: C.protocolo, TIPO_DOCUMENTO: "CERTIFICADO", CODIGO_VALIDACAO: "COD123", PERCENTUAL: "70", LINK_ARQUIVO: "https://drive.google.com/file/d/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456/view" }[x] || ""))]);
const rc = g.voucherEditarSolicitacao(C.protocolo, { curso: "9 ANO TECNICO" }, {}, TOKEN);
b.ok(rc.ok && rc.certificadoDesatualizado === true && /refaça o certificado/i.test(rc.mensagem), "avisa que o certificado ficou desatualizado", rc.mensagem);
let chamou = 0; const orig = g.voucherRedatarDocumento_;
g.voucherRedatarDocumento_ = function (p, q, m, u, f) { chamou++; b.ok(f === true && p === C.protocolo && /correção/.test(m), "refaz FORÇADO, do protocolo certo, com o motivo"); return { ok: true, redatado: true, linkPdf: "x" }; };
const rd = g.voucherEditarSolicitacao(C.protocolo, { curso: "9 ANO MEDIO", percentual: 60 }, { refazerCertificado: true }, TOKEN);
g.voucherRedatarDocumento_ = orig;
b.ok(rd.ok && rd.certificadoRefeito === true && chamou === 1, "refez uma vez", rd.mensagem);
b.igual(String(ShE.getRange(ShE.getLastRow(), cabE.indexOf("PERCENTUAL") + 1).getValue()), "60", "o percentual do registro da emissão acompanhou");
const ro = g.voucherEditarSolicitacao(C.protocolo, { email: "so-contato@x.com" }, {}, TOKEN);
b.ok(ro.ok && ro.certificadoDesatualizado === false, "mudar só o e-mail NÃO mexe no certificado", ro.mensagem);

b.passo("8. Sem sessão não edita");
const rs = g.voucherEditarSolicitacao(P, { email: "x@x.com" }, {}, "token-falso");
b.ok(!rs || rs.ok === false, "recusado sem sessão válida", JSON.stringify(rs).slice(0, 120));
b.resumo();
