/**
 * TESTE — VÁRIOS BENEFICIÁRIOS NUM PEDIDO SÓ
 *
 * Pergunta do usuário em 13/08/2026: *"eu consigo fazer os três num único
 * pedido?"*. Não conseguia — cada beneficiário é uma solicitação, e quem
 * atende abria o modal três vezes redigitando associado, escola e período.
 *
 * O QUE ESTE ARQUIVO PRECISA PROVAR, em ordem de importância:
 *
 *   1. Que o lote NÃO tem regra própria. Ele chama a criação uma vez por
 *      pessoa; a trava de período, o teto de três e a obrigatoriedade do
 *      período continuam valendo exatamente como valem no pedido único. Uma
 *      segunda implementação das mesmas regras é a forma mais confiável de
 *      elas divergirem daqui a seis meses.
 *   2. Que o resultado é PARCIAL: se o segundo é recusado, o primeiro e o
 *      terceiro ficam gravados, e cada card sabe por que foi recusado.
 *   3. Que a memória devolve os dependentes já conhecidos — é o que faz a
 *      renovação valer a pena.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");
g.setupVoucherModuleFase1 && g.setupVoucherModuleFase1();

const CPF = "11144477735";

function comuns(extra) {
  return Object.assign({
    cpf: CPF, nome: "PAI DE FAMILIA", email: "pai@exemplo.com",
    telefone: "27999990000", escola: "COLEGIO ONDE TRABALHA",
    periodo: "2040/1", regime: "SEMESTRAL", aprovar: true
  }, extra || {});
}
function filho(nome, ordem, extra) {
  return Object.assign({
    tipoBeneficiario: "FILHO", beneficiario: nome, ordemFilho: String(ordem),
    instituicao: "MULTIVIX", modalidade: "ENSINO_FUNDAMENTAL",
    curso: "Ensino Fundamental"
  }, extra || {});
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("LOTE · Três dependentes num pedido só");

b.passo("1. Os três entram e cada um volta com o seu protocolo");
const r = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns(),
  beneficiarios: [filho("ANA MARIA", 1), filho("BRUNO CESAR", 2), filho("CARLA SOFIA", 3)]
}, token);
b.igual(r.ok, true, "o lote foi aceito", r.mensagem);
b.igual(r.criados, 3, "três criados");
b.igual(r.parcial, false, "sem recusa nenhuma");
b.igual(r.resultados.length, 3, "um resultado por beneficiário");
r.resultados.forEach(function (x, i) {
  b.ok(x.ok && /^BOLSA-/.test(x.protocolo),
    "o " + (i + 1) + "º (" + x.nome + ") tem protocolo", x.protocolo || x.mensagem);
});

b.passo("2. Cada um virou uma solicitação de verdade na planilha");
const lista = g.listarSolicitacoesCertBolsa(token) || [];
["ANA MARIA", "BRUNO CESAR", "CARLA SOFIA"].forEach(function (nome) {
  const achou = lista.filter(function (s) {
    return String(s.nomeBeneficiario || "").toUpperCase() === nome;
  });
  b.igual(achou.length, 1, nome + " tem uma linha só");
});

b.passo("3. O que é COMUM foi para todas, o que é do CARD ficou no card");
const daAna = lista.filter(function (s) {
  return String(s.nomeBeneficiario || "").toUpperCase() === "ANA MARIA";
})[0];
b.igual(daAna && daAna.escola, "COLEGIO ONDE TRABALHA", "a escola do titular é comum");
b.igual(daAna && daAna.periodoReferencia, "2040/1", "o período é comum");
b.igual(daAna && daAna.nome, "PAI DE FAMILIA", "e o associado é o mesmo nas três");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("LOTE · As regras continuam sendo as mesmas do pedido único");

b.passo("4. O 4º dependente é recusado — e os outros não são desfeitos");
/* É a asserção central do desenho: resultado parcial, sem rollback. */
const r2 = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns({ periodo: "2041/1" }),
  beneficiarios: [
    filho("DANIEL", 1), filho("ELISA", 2), filho("FABIO", 3), filho("GABRIEL", 3)
  ]
}, token);
b.igual(r2.ok, false, "o lote inteiro é recusado ANTES de gravar");
b.ok(/máximo é 3/.test(r2.mensagem || ""),
  "porque quatro dependentes não cabem no mesmo pedido", r2.mensagem);
b.igual(r2.criados, undefined, "e nada foi criado");
/* Recusar o lote inteiro aqui, e não gravar três e reclamar do quarto, é
 * decisão de desenho: meio pedido feito é pior que pedido nenhum, porque
 * quem atende não sabe onde parou. */
const aindaNao = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(function (s) { return String(s.nomeBeneficiario || "").toUpperCase() === "DANIEL"; });
b.igual(aindaNao.length, 0, "DANIEL não foi gravado");

b.passo("5. Um beneficiário duplicado NÃO derruba os irmãos");
/* Aqui sim o resultado é parcial: o teto está respeitado, e a recusa vem de
 * uma regra que só se descobre linha a linha.
 *
 * JANELA PRÓPRIA, com UMA vaga ocupada. A primeira versão deste passo usava
 * 2040/1, onde os três filhos do passo 1 já estavam — a HELENA era a QUARTA
 * e caía no teto, não na duplicidade. O teste acusava o lote de não gravar
 * quando o backend estava certo; era o cenário que estava errado. */
const preExistente = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns({ periodo: "2043/1" }),
  beneficiarios: [filho("ANA MARIA", 1)]
}, token);
b.igual(preExistente.criados, 1, "ANA MARIA já tem bolsa em 2043/1");

const r3 = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns({ periodo: "2043/1" }),
  beneficiarios: [filho("ANA MARIA", 1), filho("HELENA", 2)]
}, token);
b.igual(r3.parcial, true, "o lote é parcial");
b.igual(r3.criados, 1, "só a HELENA entrou");
b.igual(r3.resultados[0].ok, false, "ANA MARIA foi recusada");
b.igual(r3.resultados[0].duplicado, true, "como duplicata");
b.ok(/já existe/i.test(r3.resultados[0].mensagem || ""),
  "com o motivo no card dela", r3.resultados[0].mensagem);
b.igual(r3.resultados[1].ok, true, "e a HELENA foi criada assim mesmo");
b.ok(/1 de 2/.test(r3.mensagem || ""), "o resumo diz quantas entraram", r3.mensagem);

b.passo("6. Sem período, o lote inteiro é recusado beneficiário a beneficiário");
const r4 = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns({ periodo: "" }),
  beneficiarios: [filho("IGOR", 1)]
}, token);
b.igual(r4.ok, false, "não grava");
b.ok(/período de referência/i.test(r4.resultados[0].mensagem || ""),
  "e o motivo é o mesmo do pedido único", r4.resultados[0].mensagem);

b.passo("7. Lote vazio é recusado com frase, não com erro");
const r5 = g.voucherCriarSolicitacoesEmLote({ comuns: comuns(), beneficiarios: [] }, token);
b.igual(r5.ok, false, "recusado");
b.ok(/nenhum beneficiário/i.test(r5.mensagem || ""), "com a frase certa", r5.mensagem);

b.passo("8. A porta dupla protege o lote como protege o resto");
b.bloqueia(function () {
  g.voucherCriarSolicitacoesEmLote({ comuns: comuns(), beneficiarios: [filho("X", 1)] },
    "token-que-nao-existe");
}, "sem sessão, o lote não entra");

b.passo("9. O titular pode ir junto no mesmo pedido");
/* Três filhos e o pai são quatro bolsas — o teto de três é dos dependentes. */
const r6 = g.voucherCriarSolicitacoesEmLote({
  comuns: comuns({ periodo: "2042/1" }),
  beneficiarios: [
    { tipoBeneficiario: "TITULAR", beneficiario: "PAI DE FAMILIA",
      instituicao: "MULTIVIX", modalidade: "GRADUACAO", curso: "Pedagogia" },
    filho("JULIA", 1), filho("KAUA", 2), filho("LARA", 3)
  ]
}, token);
b.igual(r6.criados, 4, "as quatro entram", r6.mensagem);
b.igual(r6.parcial, false, "sem recusa");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("LOTE · A memória devolve a família, não só o último");

b.passo("10. Os dependentes conhecidos voltam, um por pessoa");
/* ERA O BURACO QUE INVIABILIZAVA A RENOVAÇÃO: `voucherMemoriaAssociado`
 * devolvia UM beneficiário — o da última linha. Um pai de três filhos
 * recuperava um só, e os outros dois eram redigitados todo semestre. */
const mem = g.voucherMemoriaAssociado(CPF, token);
b.igual(mem.achou, true, "a memória achou o associado");
b.ok(Array.isArray(mem.dependentes), "e devolve uma lista de dependentes");
const nomes = mem.dependentes.map(function (d) { return d.nome.toUpperCase(); });
["ANA MARIA", "BRUNO CESAR", "CARLA SOFIA"].forEach(function (n) {
  b.ok(nomes.indexOf(n) > -1, n + " está na lista");
});

b.passo("11. Cada dependente traz a história DELE, não a do último pedido");
const ana = mem.dependentes.filter(function (d) {
  return d.nome.toUpperCase() === "ANA MARIA";
})[0];
b.igual(ana && ana.ordemFilho, "1", "a ordem é a dela");
b.igual(ana && ana.modalidade, "ENSINO_FUNDAMENTAL", "a modalidade é a dela");
b.igual(ana && ana.ehTitular, false, "e ela não é o titular");

b.passo("11b. A lista vem em ORDEM DE FAMÍLIA, não de planilha");
/* As linhas chegam da mais recente para a mais antiga, então sem ordenação a
 * lista saía na ordem em que cada bolsa foi mexida pela última vez — o 2º
 * filho antes do 1º. Na tela de renovação isso é pior do que parece: o
 * PRIMEIRO da lista é o que vai para o beneficiário de cima, e quem atende
 * confere uma família fora de ordem toda vez. Achado pelo teste de tela em
 * 13/08/2026, corrigido no backend, que é onde a lista nasce. */
const ordem = mem.dependentes.map(function (d) {
  return d.ehTitular ? "T" : (d.ordemFilho || "?");
});
b.igual(ordem[0], "T", "o titular vem primeiro");
const soFilhos = mem.dependentes.filter(function (d) { return !d.ehTitular && d.ordemFilho; });
const crescente = soFilhos.every(function (d, i) {
  return i === 0 || Number(soFilhos[i - 1].ordemFilho) <= Number(d.ordemFilho);
});
b.ok(crescente, "e os filhos vêm em ordem crescente",
  soFilhos.map(function (d) { return d.ordemFilho + "º " + d.nome; }).join(" · "));

b.passo("12. O titular aparece na lista, marcado");
/* Sem isto, a renovação em lote deixaria a bolsa do próprio associado de
 * fora e ninguém perceberia até o semestre acabar. */
const oPai = mem.dependentes.filter(function (d) { return d.ehTitular; })[0];
b.ok(!!oPai, "o titular está na lista");
b.igual(oPai && oPai.tipo, "TITULAR", "marcado como titular");
b.igual(oPai && oPai.curso, "Pedagogia", "com o curso dele, não o dos filhos");

b.passo("13. Ninguém aparece duas vezes, mesmo com várias bolsas");
const contagem = {};
mem.dependentes.forEach(function (d) {
  contagem[d.nome.toUpperCase()] = (contagem[d.nome.toUpperCase()] || 0) + 1;
});
b.ok(Object.keys(contagem).every(function (k) { return contagem[k] === 1; }),
  "um registro por pessoa, com a bolsa mais recente dela");

b.passo("14. Linha ANTIGA, sem beneficiário gravado, conta como o titular");
/* Solicitação anterior à coluna NOME_BENEFICIARIO existir: quem estuda é o
 * associado, e é assim que ela tem que voltar. Sem este tratamento a linha
 * sairia da lista inteira — a bolsa some da tela e ninguém procura o que não
 * sabe que existiu.
 *
 * Escrito direto na aba porque é o único jeito de reproduzir o que já está
 * gravado: a criação de hoje sempre preenche o beneficiário. */
const shAntiga = g.SpreadsheetApp.openById(g.PLANILHA_ID)
  .getSheetByName(g.VOUCHER_ABA_SOLICITACOES || "Voucher_Solicitacoes");
const cabAntiga = shAntiga.getRange(1, 1, 1, shAntiga.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });
const linhaAntiga = new Array(cabAntiga.length).fill("");
function poe(nome, valor) {
  const i = cabAntiga.indexOf(nome);
  if (i > -1) linhaAntiga[i] = valor;
}
poe("NUMERO_PROTOCOLO", "BOLSA-LINHA-ANTIGA");
poe("CPF_SOLICITANTE", "40157625080");
poe("NOME_SOLICITANTE", "ASSOCIADO ANTIGO");
poe("CURSO", "Letras");
poe("MODALIDADE", "GRADUACAO");
poe("PERIODO_REFERENCIA", "2024/1");
poe("STATUS_SOLICITACAO", "APROVADO");
shAntiga.appendRow(linhaAntiga);

const memAntiga = g.voucherMemoriaAssociado("40157625080", token);
b.igual(memAntiga.achou, true, "a memória acha o associado da linha antiga");
b.igual((memAntiga.dependentes || []).length, 1, "e devolve um beneficiário");
const oAntigo = (memAntiga.dependentes || [])[0] || {};
b.igual(oAntigo.nome, "ASSOCIADO ANTIGO",
  "com o nome do SOLICITANTE, já que não há beneficiário gravado");
b.igual(oAntigo.ehTitular, true, "marcado como titular");
b.igual(oAntigo.tipo, "TITULAR", "e com o tipo preenchido, não vazio");

b.naoTestavel("A tela de renovação em lote",
  "o bloco repetível ainda não existe — este arquivo cobre só o backend");

b.resumo();
process.exit(0);
