/**
 * O CICLO INTEIRO DO VOUCHER, DA SOLICITAÇÃO AO ENVIO — num arquivo só.
 *
 * Pedido do usuário em 13/08/2026: *"vc precisa testar todo o processo desde
 * a solicitação e prevê os erros e já ajustar"*.
 *
 * Os testes t30 a t37 cobrem os pedaços — período, colunas, envio, tela,
 * memória. O que faltava é o que ninguém tinha executado: a MESMA
 * solicitação atravessando todas as etapas, na ordem, como acontece na vida.
 * Defeito de integração não aparece testando etapa por etapa: aparece quando
 * o que uma etapa grava é lido pela seguinte.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 * o PDF de verdade (o emulador não converte HTML em PDF), a entrega do
 * e-mail (registra a chamada, não entrega) e o `wa.me` num celular.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

const CPF = "11144477735";           // CPF válido de teste, não é de ninguém
const NOME = "MARIA DE TESTE SILVA";

function novaSolicitacao(extra) {
  const dados = {
    cpf: CPF, nome: NOME, email: "maria@example.com", telefone: "27999990000",
    escola: "COLEGIO DE TESTE LTDA", modalidade: "GRADUACAO", curso: "Pedagogia",
    regime: "SEMESTRAL", periodo: "2026/1",
    tipoBeneficiario: "TITULAR", nomeBeneficiario: NOME
  };
  Object.keys(extra || {}).forEach(k => { dados[k] = extra[k]; });
  return g.voucherCriarSolicitacao(dados, token);
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 1. A solicitação nasce");

g.setupVoucherModuleFase1 && g.setupVoucherModuleFase1();

b.passo("1. Uma solicitação nova grava e devolve protocolo");
const r1 = novaSolicitacao();
b.igual(r1.ok, true, "gravou", r1.mensagem || "");
b.ok(/^BOLSA-/.test(String(r1.protocolo || "")), "com protocolo no formato do módulo", r1.protocolo);
const PROT = r1.protocolo;

b.passo("2. Ela aparece na lista, com os campos que a tela mostra");
const lista = g.listarSolicitacoesCertBolsa(token) || [];
const s = lista.filter(x => x.protocolo === PROT)[0];
b.ok(s, "está na listagem");
/* NASCE PENDENTE — as duas portas de entrada alinhadas.
 *
 * A tela administrativa gravava "ANALISE" fixo, que é o card rotulado
 * "Complementação solicitada": toda solicitação nova nascia afirmando que
 * já tinha sido analisada e que faltava documento, e o card "Aguardando
 * análise" nunca saía de zero. Achado pelo ciclo em 13/08/2026, corrigido
 * no mesmo dia por decisão do usuário. Quem coloca em ANALISE é quem pede
 * complementação — que é o único momento em que a palavra é verdade. */
b.igual(s && s.status, "PENDENTE", "nasce PENDENTE, como pelo portal público");
b.igual(s && s.periodoReferencia, "2026/1", "e o PERÍODO chega como texto legível");
/* O período era o defeito medido na planilha real em 13/08: o Sheets
 * converte "2026/1" em 1º de janeiro de 2026, e a coluna mostrava
 * "Thu Jan 01 2026 05:00:00 GMT-0300". Aqui se prova a normalização. */
b.igual(g.voucherPeriodoTexto_(new Date(2026, 0, 1)), "2026/1",
  "e uma célula já convertida em data volta a ser período");

b.passo("3. A primeira vez é marcada como PRIMEIRA_VEZ");
b.igual(s && s.tipoSolicitacao, "PRIMEIRA_VEZ", "sem renovação onde não houve anterior");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 2. A trava do período");

b.passo("4. A mesma pessoa, mesmo curso, mesmo semestre: recusado");
const r2 = novaSolicitacao();
b.igual(r2.ok, false, "a segunda não grava");
b.igual(r2.duplicado, true, "e é recusada como duplicata");
b.ok(String(r2.mensagem || "").indexOf(PROT) > -1,
  "a recusa diz QUAL protocolo já existe", r2.mensagem);

b.passo("5. A lista continua com uma só");
const qtd = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.nome === NOME).length;
b.igual(qtd, 1, "nada foi gravado pela tentativa recusada");

b.passo("6. Semestre seguinte é renovação, não duplicata");
const r3 = novaSolicitacao({ periodo: "2026/2" });
b.igual(r3.ok, true, "grava", r3.mensagem || "");
const s3 = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === r3.protocolo)[0];
b.igual(s3 && s3.tipoSolicitacao, "RENOVACAO", "e vem marcada como renovação");

b.passo("7. Curso diferente no mesmo semestre não é duplicata");
const r4 = novaSolicitacao({ curso: "Direito" });
b.igual(r4.ok, true, "outro curso passa — é outra bolsa", r4.mensagem || "");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 3. Análise e aprovação");

b.passo("8. Aprovar muda o status");
/* ACHADO DO CRUZAMENTO, 13/08/2026: a TELA de Vouchers não tem ação de
 * aprovar. Ela lista, emite e envia — as 14 chamadas que ela faz existem
 * todas no backend, e nenhuma delas muda status. Quem aprova é
 * `aprovarSolicitacaoCertBolsa` (VoucherAdmin.gs), chamada de outro lugar.
 * O teste entra por ela, que é o caminho real. */
const ap = g.aprovarSolicitacaoCertBolsa(PROT, "aprovado no teste do ciclo", token);
b.ok(ap && ap.ok !== false, "a aprovação foi aceita", (ap && ap.mensagem) || "");
const sAp = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === PROT)[0];
b.igual(sAp && sAp.status, "APROVADO", "e a lista já mostra APROVADO");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 4. O documento");

b.passo("9. A prévia monta o documento sem emitir nada");
const prev = g.gerarDocumentoVoucher(PROT, "PREVIA", { percentual: 70 });
b.igual(prev && prev.ok, true, "a prévia foi gerada", (prev && prev.mensagem) || "");
const html = String((prev && prev.html) || "");

b.passo("10. E o documento sai em A4, em milímetros");
/* Milímetro e não pixel: a conversão do Apps Script não garante 96dpi, e
 * altura em px joga o rodapé para uma segunda página em branco. */
b.ok(/@page\{size:A4 portrait/.test(html), "declara A4 retrato");
b.ok(/width:210mm;min-height:297mm/.test(html), "com a folha em 210×297mm");
b.ok(/@media screen\{/.test(html),
  "e a prévia na tela ganha fundo e sombra — para se ver onde a folha acaba");

b.passo("11. O período aparece no documento como período, não como data");
b.igual(/Thu |Mon |GMT/.test(html), false,
  "nenhum resto de Date no texto do certificado");
b.ok(/2026/.test(html), "e o ano está lá");

b.passo("12. O documento traz o que identifica a pessoa");
b.ok(html.indexOf(NOME) > -1, "o nome do beneficiário");
b.ok(/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(html), "o CPF formatado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 5. A emissão de verdade");

/* Até aqui o teste parava na prévia — que retorna antes de tudo o que
 * importa: PDF, Drive, planilha de emitidos, status, histórico. O emulador
 * tem DriveApp, então o caminho inteiro roda. */

b.passo("13. Solicitação NÃO aprovada não emite certificado");
/* A trava mais importante do módulo: certificado de bolsa é benefício de
 * associado, e emitir para quem não passou pela aprovação é conceder
 * benefício sem conferência — com o documento saindo com cara de legítimo.
 *
 * MINHA PRIMEIRA VERSÃO DESTE PASSO ESTAVA ERRADA, e vale registrar: usei o
 * protocolo que JÁ TINHA SIDO APROVADO no passo 8 e esperei recusa. O
 * sistema emitiu, e por um instante pareceu defeito grave. Não era: APROVAR
 * É VALIDAR — decisão documentada em VoucherAdmin.gs, porque o único lugar
 * que gravava VALIDADO era a confirmação de associação, e quem aprova está
 * declarando que conferiu. O teste é que apontava para o protocolo errado. */
const naoAprovado = g.gerarDocumentoVoucher(r4.protocolo, "CERTIFICADO", { percentual: 70 });
b.igual(naoAprovado.ok, false, "recusa quem não passou pela aprovação");
b.ok(/associa|status/i.test(String(naoAprovado.mensagem || "")),
  "dizendo por quê", naoAprovado.mensagem);

b.passo("14. O protocolo aprovado emite");
const emitido = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", { percentual: 70, rg: "1234567" });
b.igual(emitido.ok, true, "emitiu", emitido.mensagem || "");
b.ok(emitido.codigoValidacao, "com código de validação", emitido.codigoValidacao);
b.ok(emitido.linkPdf, "e com o PDF salvo no Drive", emitido.linkPdf);

b.passo("15. O status vira EMITIDO e o RG fica guardado");
const sEmit = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === PROT)[0];
b.igual(sEmit && sEmit.status, "EMITIDO", "a lista mostra EMITIDO");
b.igual(sEmit && sEmit.rg, "1234567", "e o RG digitado ficou na linha");

b.passo("16. Emitir de novo NÃO gera segundo documento");
/* Idempotência: dois cliques no botão, ou duas abas abertas, não podem
 * produzir dois certificados com códigos diferentes para o mesmo protocolo —
 * cada um validaria, e a escola receberia dois papéis igualmente legítimos. */
const denovo = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", { percentual: 70 });
b.igual(denovo.ok, true, "responde ok");
b.igual(denovo.reemitido, true, "mas marcado como já emitido");
b.igual(denovo.codigoValidacao, emitido.codigoValidacao,
  "e com o MESMO código — não nasceu um segundo certificado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 6. Quando quebra, o erro diz ONDE");

b.passo("13. A falha traz a etapa, não só a mensagem do Google");
/* NASCEU DE UM ERRO REAL, 13/08/2026: "Erro ao gerar voucher: This
 * operation is not supported for this document: 1QPpsx...". Esse id é o da
 * PLANILHA, e a mensagem não dizia em que passo o Google recusou. Os três
 * lugares que tocam o Drive já tratam a própria falha, então o erro vinha de
 * fora deles — e sem a etapa não havia por onde começar. */
const quebrado = g.gerarDocumentoVoucher("BOLSA-NAO-EXISTE-999", "PREVIA", {});
b.igual(quebrado.ok, false, "protocolo inexistente é recusado");

/* Força uma quebra de verdade no meio do processo, para ver a etapa sair.
 * Num protocolo AINDA NÃO EMITIDO: a checagem de "já emitido" acontece
 * antes do retorno da prévia, então um protocolo já emitido devolveria
 * "Voucher já emitido" sem chegar na montagem do HTML. */
const originalHtml = g.gerarHtmlDocumentoVoucher_;
g.gerarHtmlDocumentoVoucher_ = function () {
  throw new Error("This operation is not supported for this document: TESTE");
};
const comFalha = g.gerarDocumentoVoucher(r3.protocolo, "PREVIA", { percentual: 70 });
g.gerarHtmlDocumentoVoucher_ = originalHtml;
b.igual(comFalha.ok, false, "a emissão falha");
b.ok(/etapa/i.test(String(comFalha.mensagem || "")),
  "e a mensagem diz a etapa", comFalha.mensagem);
b.ok(/HTML do certificado/.test(String(comFalha.etapa || "")),
  "apontando o passo certo", comFalha.etapa);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 7. O que ainda não dá para provar aqui");

b.naoTestavel("O PDF de verdade",
  "getAs(MimeType.PDF) não existe no emulador; A4 se confere abrindo o arquivo");
b.naoTestavel("A entrega do e-mail e o anexo",
  "o emulador registra a chamada, não entrega — item 16 de PENDENTE-VERIFICACAO");
b.naoTestavel("O período gravado como texto na planilha real",
  "o apóstrofo protetor só se confere no Sheets; o emulador não converte nada");

b.resumo();
process.exit(0);
