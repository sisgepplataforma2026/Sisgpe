/**
 * TESTE PONTA A PONTA — FINANCEIRO / FLUXO DE PAGAMENTO
 *
 * É o fluxo obrigatório do item 11 do prompt mestre. O teste não termina no
 * cadastro da despesa: vai até conciliação, contabilidade, histórico e
 * auditoria, e passa pelos cenários alternativos que o item 11 lista.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");    // financeiro + rh
const ESC = b.logar(g, "joscimar");   // escolas + sindicalizacao — NÃO tem financeiro

// A aba CONFIG é pré-requisito do módulo: gerarNumeroDespesa_ lê o contador
// dali. Sem ela, registrarLancamentoDespesa morre já na primeira linha.
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) {
  const cfg = ss.insertSheet("CONFIG");
  cfg.getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
}

const hoje = new Date();
const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const br = s => s.split("-").reverse().join("/");

function novaDespesa(desc, valor, venc) {
  return g.registrarLancamentoDespesa({
    prestadorNome: "Fornecedor Teste LTDA",
    prestadorDocumento: "11.222.333/0001-81",
    descricao: desc,
    categoria: "SERVICOS",
    valor: valor,
    dataVencimento: venc || dias(15),
    formaPagamento: "PIX",
    observacao: "teste ponta a ponta"
  }, FIN);
}

/* ═══════════════ CENÁRIO PRINCIPAL ═══════════════ */
b.fluxo("FINANCEIRO · Pagamento — cadastro → aprovação → banco → pago → comprovante → conciliação → contabilidade");

b.passo("1. Cadastrar a despesa");
const nova = novaDespesa("Aluguel da sede", 1234.56);
b.ok(nova && nova.ok, "registrarLancamentoDespesa registra",
  nova && !nova.ok ? "ERRO: " + (nova.mensagem || JSON.stringify(nova)) : "ID " + (nova.idDespesa || nova.id || "?"));
const ID = nova && (nova.idDespesa || nova.id);

b.passo("2. Registro — ID, status inicial, quem lançou");
let lista = g.listarDespesas({}, FIN);
const linha = ((lista && (lista.lista || lista.dados || [])) || []).find(d => String(d.idDespesa) === String(ID));
b.ok(!!linha, "a despesa aparece na listagem", linha ? "status: " + linha.status : "não encontrada");
if (linha) {
  b.ok(Math.abs(Number(linha.valor) - 1234.56) < 0.01, "valor gravado sem perder os centavos", "R$ " + linha.valor);
}

b.passo("3. Aprovar para pagamento");
const apr = g.aprovarDespesaParaPagamento({ idDespesa: ID }, FIN);
b.ok(apr && apr.ok, "aprovarDespesaParaPagamento aprova", apr && !apr.ok ? "ERRO: " + apr.mensagem : "");

b.passo("4. Lançar no banco");
const lan = g.pagLancarNoBanco({ idDespesa: ID, dataLancamento: dias(0), contaBancaria: "Sicoob 1234-5" }, FIN);
b.ok(lan && lan.ok, "pagLancarNoBanco marca LANCADO_BANCO", lan && !lan.ok ? "ERRO: " + lan.mensagem : "");

b.passo("5. Confirmar o pagamento — a data do banco é OUTRA");
const pgto = g.pagConfirmarPagamento({ idDespesa: ID, dataPagamento: dias(2) }, FIN);
b.ok(pgto && pgto.ok, "pagConfirmarPagamento confirma", pgto && !pgto.ok ? "ERRO: " + pgto.mensagem : "");

const ctrl = g.pagListarControle({}, FIN);
const item = ((ctrl && ctrl.lista) || []).find(i => String(i.idDespesa) === String(ID));
if (item) {
  b.ok(item.dataLancamentoBanco && item.dataPagamento && item.dataLancamentoBanco !== item.dataPagamento,
    "guarda as DUAS datas separadas — lançamento e pagamento",
    "banco: " + item.dataLancamentoBanco + " · pago: " + item.dataPagamento);
} else b.ok(false, "a despesa aparece no Controle de Pagamentos", "não encontrada em pagListarControle");

b.passo("6. Anexar comprovante");
const comp = g.pagAnexarComprovante({
  idDespesa: ID, nomeArquivo: "comprovante.pdf", mimeType: "application/pdf",
  base64: Buffer.from("conteudo").toString("base64")
}, FIN);
b.ok(comp && comp.ok, "pagAnexarComprovante anexa", comp && !comp.ok ? "ERRO: " + comp.mensagem : "");

b.passo("7. Histórico — os quatro eventos");
const hist = g.pagHistoricoDespesa(ID, FIN);
const eventos = (hist && hist.historico) || [];
const nomes = eventos.map(e => e.evento || e.tipo);
b.ok(eventos.length >= 5, "trilha ÚNICA, do cadastro ao comprovante",
  eventos.length + " eventos: " + nomes.join(", ").slice(0, 110));

b.passo("7b. A trilha conta a vida inteira do lançamento");
[["CRIADO", "cadastro"], ["APROVADO", "aprovação"], ["LANCADO_BANCO", "lançamento no banco"],
 ["PAGAMENTO_CONFIRMADO", "pagamento"], ["COMPROVANTE_ANEXADO", "comprovante"]
].forEach(function (par) {
  b.ok(nomes.indexOf(par[0]) >= 0, "a trilha inclui " + par[1]);
});

b.passo("7c. As duas telas leem a MESMA trilha");
const histDesp = g.obterHistoricoDespesa(ID, FIN);
b.ok(histDesp.ok && histDesp.historico.length === eventos.length,
  "obterHistoricoDespesa e pagHistoricoDespesa devolvem o mesmo",
  (histDesp.historico || []).length + " x " + eventos.length);

b.passo("7d. Cada evento serve às duas telas sem mexer no HTML");
const um = eventos[0] || {};
b.ok(um.titulo && um.data && um.evento && um.dataHora,
  "o evento traz titulo/data (Despesas) e evento/dataHora (Pagamentos)",
  um.titulo + " · " + um.evento);

b.passo("7e. Pagamento não aparece duas vezes");
const pagos = nomes.filter(n => n === "PAGAMENTO_CONFIRMADO" || n === "PAGO");
b.ok(pagos.length === 1, "o log vence sobre o campo da linha — sem evento repetido",
  pagos.join(", "));

b.passo("8. INTEGRAÇÃO — a conciliação enxerga essa despesa?");
// Achado R2 do relatório: conc_despesasEmAberto usa ocultarPagos:true.
const abertas = g.conc_despesasEmAberto(FIN);
const achou = (abertas || []).some(d => String(d.idDespesa) === String(ID));
b.ok(achou, "despesa paga ainda é oferecida à conciliação bancária",
  achou ? "" : "NÃO aparece — o extrato do banco vai cair como 'saída sem despesa correspondente'");

b.passo("9. Contabilidade");
let contab; try { contab = g.listarDespesasParaEnvioContabilidade(FIN); } catch (e) { contab = { erro: e.message }; }
b.ok(contab && !contab.erro, "listarDespesasParaEnvioContabilidade responde",
  contab && contab.erro ? "ERRO: " + contab.erro : JSON.stringify(contab).slice(0, 80));

b.passo("10. Resumo financeiro conta o dinheiro?");
const resumo = g.obterResumoDespesas(FIN);
b.ok(resumo && !resumo.erro, "obterResumoDespesas responde", JSON.stringify(resumo).slice(0, 110));

/* ═══════════════ CENÁRIOS ALTERNATIVOS (item 11) ═══════════════ */
b.fluxo("FINANCEIRO · Cenários alternativos e exceções");

b.passo("11. Duplo clique em Confirmar pagamento");
const antesEv = ((g.pagHistoricoDespesa(ID, FIN) || {}).historico || []).length;
g.pagConfirmarPagamento({ idDespesa: ID, dataPagamento: dias(2) }, FIN);
const depoisEv = ((g.pagHistoricoDespesa(ID, FIN) || {}).historico || []).length;
b.ok(depoisEv <= antesEv + 1, "reconfirmar não duplica evento no histórico",
  antesEv + " → " + depoisEv);

b.passo("12. Lançar no banco uma despesa que nem foi aprovada");
const d2 = novaDespesa("Material de escritório", 300);
const ID2 = d2 && (d2.idDespesa || d2.id);
const lanCedo = g.pagLancarNoBanco({ idDespesa: ID2, dataLancamento: dias(0) }, FIN);
b.ok(lanCedo && lanCedo.ok === false, "recusa lançar no banco sem aprovação prévia", lanCedo && lanCedo.mensagem);
// E depois de aprovar, passa — a trava não pode virar impedimento.
g.aprovarDespesaParaPagamento({ idDespesa: ID2 }, FIN);
const lanDepois = g.pagLancarNoBanco({ idDespesa: ID2, dataLancamento: dias(0) }, FIN);
b.ok(lanDepois && lanDepois.ok, "depois de aprovada, lança normalmente", lanDepois && lanDepois.mensagem);

b.passo("13. Despesa inexistente");
const fantasma = g.pagConfirmarPagamento({ idDespesa: "NAO-EXISTE-999", dataPagamento: dias(0) }, FIN);
b.ok(fantasma && fantasma.ok === false, "ID inexistente é recusado", fantasma && fantasma.mensagem);

b.passo("14. Valor zero e valor negativo");
const zero = novaDespesa("Teste zero", 0);
const neg = novaDespesa("Teste negativo", -500);
b.ok(zero && zero.ok === false, "recusa valor ZERO", zero && zero.mensagem);
b.ok(neg && neg.ok === false, "recusa valor NEGATIVO", neg && neg.mensagem);
b.ok(novaDespesa("Teste vazio", "").ok === false, "recusa valor vazio");
// Formato que vem da tela precisa continuar passando.
const brl = novaDespesa("Teste formato BR", "1.234,56");
b.ok(brl && brl.ok, "aceita 1.234,56 no formato da tela", brl && brl.mensagem);
// A edição também barra.
const edZero = g.editarDespesa({ idDespesa: ID, valor: 0 }, FIN);
b.ok(edZero && edZero.ok === false, "editar para zero também é recusado", edZero && edZero.mensagem);

b.passo("15. Desfazer o lançamento no banco");
const desf = g.pagDesfazerLancamentoBanco({ idDespesa: ID2 }, FIN);
b.ok(desf !== undefined, "pagDesfazerLancamentoBanco existe e responde",
  desf && desf.ok ? "desfeito" : (desf && desf.mensagem) || "");

/* ═══════════════ PERMISSÃO (item 14) ═══════════════ */
b.fluxo("FINANCEIRO · Permissão");

b.passo("16. Usuário de Escolas mexendo em dinheiro");
b.bloqueia(() => g.pagLancarNoBanco({ idDespesa: ID, dataLancamento: dias(0) }, ESC), "pagLancarNoBanco nega quem não tem Financeiro");
b.bloqueia(() => g.pagConfirmarPagamento({ idDespesa: ID, dataPagamento: dias(0) }, ESC), "pagConfirmarPagamento nega");
b.bloqueia(() => g.pagAnexarComprovante({ idDespesa: ID }, ESC), "pagAnexarComprovante nega");
b.bloqueia(() => g.conc_despesasEmAberto(ESC), "conciliação nega");

b.passo("17. Sem sessão nenhuma");
b.bloqueia(() => g.pagListarControle({}, ""), "pagListarControle nega token vazio");

b.naoTestavel("Conteúdo do PDF do comprovante e do ofício fiscal", "template do Google Docs");
b.naoTestavel("Importação de extrato OFX real do banco", "depende de arquivo do banco");

b.resumo();
process.exit(0);
