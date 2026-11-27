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
b.passo("1. em branco é RECUSADO (decisão do usuário, 27/11/2026: escolha explícita)");
const vazio = g.voucherCriarSolicitacao({ ...base, cpf: "11144477735", nome: "TITULAR EM BRANCO", nomeBeneficiario: "FILHO A", situacaoSindical: "" }, TOKEN);
b.ok(!vazio.ok && /situação sindical/.test(vazio.mensagem || ""), "em branco é recusado e a mensagem diz o que falta", vazio.mensagem);
const semCampo = g.voucherCriarSolicitacao({ ...base, cpf: "52998224725", nome: "TITULAR SEM CAMPO", nomeBeneficiario: "FILHO B" }, TOKEN);
b.ok(!semCampo.ok, "campo ausente também é recusado", semCampo.mensagem);
const invalido = g.voucherCriarSolicitacao({ ...base, cpf: "52998224725", nome: "TITULAR X", nomeBeneficiario: "FILHO B", situacaoSindical: "TALVEZ" }, TOKEN);
b.ok(!invalido.ok, "valor fora de ASSOCIADO/NAO_ASSOCIADO é recusado", invalido.mensagem);
const linhas = ss.getSheetByName("Voucher_Solicitacoes").getLastRow();
b.ok(linhas <= 1, "nada foi gravado pelas recusas", String(linhas));
b.passo("2. o que a pessoa escolhe é gravado");
const assoc = g.voucherCriarSolicitacao({ ...base, cpf: "39053344705", nome: "TITULAR ASSOCIADO", nomeBeneficiario: "FILHO C", situacaoSindical: "ASSOCIADO" }, TOKEN);
b.ok(assoc.ok && lerSituacao(assoc.protocolo).situacao === "ASSOCIADO", "ASSOCIADO escolhido → ASSOCIADO");
b.ok(lerSituacao(assoc.protocolo).canal !== "PRESENCIAL", "canal remoto, como sempre");
const nao = g.voucherCriarSolicitacao({ ...base, cpf: "11122233396", nome: "TITULAR NAO ASSOCIADO", nomeBeneficiario: "FILHO D", situacaoSindical: "NAO_ASSOCIADO" }, TOKEN);
b.ok(nao.ok && lerSituacao(nao.protocolo).situacao === "NAO_ASSOCIADO", "NAO_ASSOCIADO escolhido → NAO_ASSOCIADO");
b.ok(lerSituacao(nao.protocolo).canal === "PAPEL" && lerSituacao(assoc.protocolo).canal === "EMAIL", "e o canal continua certo: não associado = PAPEL, associado = EMAIL");

b.resumo();
