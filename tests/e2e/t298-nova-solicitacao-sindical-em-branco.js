/**
 * NOVA SOLICITAÇÃO · A SITUAÇÃO SINDICAL EM BRANCO NÃO VIRA "ASSOCIADO" (pedido do usuário, 26/11/2026).
 * Defeito: VoucherNovaSolicitacao.gs gravava `dados.situacaoSindical || "ASSOCIADO"` — campo vazio virava ASSOCIADO em silêncio, e a Marcela
 * enviaria por e-mail o certificado de quem não é associado ("nem todos os certificados são de associados ... você colocou como associado").
 * Prova: em branco → grava em branco (a lista mostra "sindical não informada"); ASSOCIADO e NAO_ASSOCIADO escolhidos continuam sendo gravados;
 * o canal (REMOTO/PRESENCIAL) não muda. NÃO PROVA: o formulário em si, que ainda volta a "Associado" ao abrir (decisão pendente do usuário).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const lerSituacao = (protocolo) => {
  const v = ss.getSheetByName("Voucher_Solicitacoes").getDataRange().getValues();
  const cab = v[0].map(String), iP = cab.indexOf("NUMERO_PROTOCOLO"), iS = cab.indexOf("SITUACAO_SINDICAL"), iC = cab.indexOf("CANAL_ENTRADA");
  const l = v.slice(1).find((x) => String(x[iP]) === protocolo);
  return l ? { situacao: String(l[iS]), canal: String(l[iC]) } : null;
};
const base = { email: "x@teste.com", escola: "ESCOLA X", modalidade: "ENSINO_FUNDAMENTAL", instituicao: "INST Y", curso: "6 ANO", tipoBeneficiario: "FILHO", ordemFilho: "1", idade: 12, periodo: "2026/2", regime: "SEMESTRAL" };

b.fluxo("NOVA SOLICITAÇÃO · situação sindical");
b.passo("1. em branco continua em branco");
const vazio = g.voucherCriarSolicitacao({ ...base, cpf: "11144477735", nome: "TITULAR EM BRANCO", nomeBeneficiario: "FILHO A", situacaoSindical: "" }, TOKEN);
b.ok(vazio.ok, "a solicitação em branco é criada", vazio.mensagem || vazio.protocolo);
const lv = lerSituacao(vazio.protocolo);
b.ok(lv && lv.situacao === "", "SITUACAO_SINDICAL fica EM BRANCO (antes virava ASSOCIADO)", JSON.stringify(lv));
const semCampo = g.voucherCriarSolicitacao({ ...base, cpf: "52998224725", nome: "TITULAR SEM CAMPO", nomeBeneficiario: "FILHO B" }, TOKEN);
b.ok(semCampo.ok && lerSituacao(semCampo.protocolo).situacao === "", "campo ausente também fica em branco", JSON.stringify(lerSituacao(semCampo.protocolo)));
b.passo("2. o que a pessoa escolhe é gravado");
const assoc = g.voucherCriarSolicitacao({ ...base, cpf: "39053344705", nome: "TITULAR ASSOCIADO", nomeBeneficiario: "FILHO C", situacaoSindical: "ASSOCIADO" }, TOKEN);
b.ok(assoc.ok && lerSituacao(assoc.protocolo).situacao === "ASSOCIADO", "ASSOCIADO escolhido → ASSOCIADO");
b.ok(lerSituacao(assoc.protocolo).canal !== "PRESENCIAL", "canal remoto, como sempre");
const nao = g.voucherCriarSolicitacao({ ...base, cpf: "11122233396", nome: "TITULAR NAO ASSOCIADO", nomeBeneficiario: "FILHO D", situacaoSindical: "NAO_ASSOCIADO" }, TOKEN);
b.ok(nao.ok && lerSituacao(nao.protocolo).situacao === "NAO_ASSOCIADO", "NAO_ASSOCIADO escolhido → NAO_ASSOCIADO");
b.ok(lerSituacao(nao.protocolo).canal === "PAPEL" && lerSituacao(assoc.protocolo).canal === "EMAIL", "e o canal continua certo: não associado = PAPEL, associado = EMAIL");
b.naoTestavel("o formulário pré-selecionando 'Associado' ao abrir", "decisão do usuário pendente (Scripts_Certificado.html, abrir a Nova solicitação)");
b.resumo();
