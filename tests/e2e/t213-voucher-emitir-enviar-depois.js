/**
 * CONFERIR E EMITIR AGORA, ENVIAR DEPOIS — 29/10/2026.
 *
 * O usuário: "a gente emite e não envia. Quando for o tempo de enviar, a
 * gente pode enviar ... sai com a data do envio e não com a data que foi
 * feita." Backend real (gas.js), leitor real (vpe-simulador), dados
 * FICTÍCIOS.
 *
 * Prova: emitir não manda nada; o pedido fica EMITIDO e aparece na lista de
 * envio; enviar refaz o PDF com a data de HOJE e responde na conversa do
 * pedido; um emitido não volta a "Pronto" sozinho; nada sai duas vezes.
 *
 * NÃO PROVA: o PDF de verdade, a entrega do e-mail, a tela no navegador.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
const CPF_ANA = "11144477735", CPF_EDU = "52998224725";
shA.appendRow([CPF_ANA, "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow([CPF_EDU, "EDUARDO MELO", "SIM", "edu@exemplo.com", "27999990002", "ESCOLA BETA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, responder, CC, RG, base } = SIM;
const ler = () => { SIM.ciclo(); for (let k = 0; k < 20; k++) { if (!g.voucherPedidosLerAgora(TOKEN).restantes) break; } };
const pedidoDa = th => g.vpeLinhas_().find(r => r.THREAD_ID === th.id);
const saida = () => g.vpeLinhas_(SIM.aba("Saida"));

EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: CPF_ANA },
  anexos: [CC("ANA MARIA SOUZA", CPF_ANA, "09/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", CPF_ANA)] });
EXTRACOES.EDU = base({ titular: { nome: "Eduardo Melo", cpf: CPF_EDU }, curso: "Direito", periodo: "2026/2",
  anexos: [CC("EDUARDO MELO", CPF_EDU, "09/2026", "ESCOLA BETA"), RG(2, "EDUARDO MELO", CPF_EDU)] });
const thAna = novaThread("Voucher 2027/1", "Ana <ana@exemplo.com>", "Quero o voucher de Pedagogia. CASO:ANA",
  [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
const thEdu = novaThread("Bolsa 2026/2", "Edu <edu@exemplo.com>", "Voucher de Direito 2026/2. CASO:EDU",
  [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
ler();

b.fluxo("VOUCHER · conferir e emitir agora");
b.passo("1. Os dois chegam prontos");
b.igual(pedidoDa(thAna).ESTADO, "PRONTO", "Ana pronta");
b.igual(pedidoDa(thEdu).ESTADO, "PRONTO", "Eduardo pronto");

b.passo("2. 'Conferir e emitir' emite e NÃO envia");
const fila0 = saida().length, out0 = amb.outbox.length;
const e1 = g.voucherPedidosConferirEmitir(pedidoDa(thAna).ID_PEDIDO, {}, {}, TOKEN);
const e2 = g.voucherPedidosConferirEmitir(pedidoDa(thEdu).ID_PEDIDO, {}, {}, TOKEN);
b.ok(e1.ok && e2.ok, "os dois emitidos", e1.mensagem + " | " + e2.mensagem);
b.igual(saida().length, fila0, "nada entrou na fila de envio da Secretaria");
b.igual(amb.outbox.length, out0, "nenhum e-mail saiu");
b.igual(pedidoDa(thAna).ESTADO, "EMITIDO", "o pedido fica EMITIDO (aguardando envio)");
const emi = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_EMITIDOS, e1.protocolo);
b.ok(emi && emi.CODIGO_VALIDACAO, "o voucher existe, com código", e1.protocolo);

b.passo("3. Aparece em 'Emitidos, aguardando envio', com para quem vai e quem conferiu");
const lista = g.voucherPedidosEmitidos(TOKEN);
b.igual(lista.itens.length, 2, "dois na lista");
const ana = lista.itens.find(i => i.protocolo === e1.protocolo);
b.ok(ana && ana.para === "ana@exemplo.com" && ana.periodo === "2027/1" && ana.conferidoPor, "com e-mail, semestre e quem conferiu",
  JSON.stringify(ana));
b.igual(g.voucherPedidosPainel("SECRETARIA", TOKEN).contagens.EMITIDO, 2, "o painel conta 2 emitidos");

b.passo("4. Emitido não volta a 'Pronto' nem aceita pedir complemento");
g.voucherPedidosSalvarCampos(pedidoDa(thAna).ID_PEDIDO, { telefone: "27999990009" }, TOKEN);
b.igual(pedidoDa(thAna).ESTADO, "EMITIDO", "'Salvar e reconferir' não desfaz a emissão");
const comp = g.voucherPedidosResponder(pedidoDa(thAna).ID_PEDIDO, "COMPLEMENTO", "Falta algo? Não deveria sair isto.", TOKEN);
b.ok(!comp.ok, "pedir complemento num emitido é recusado", comp.mensagem);
const de2 = g.voucherPedidosConferirEmitir(pedidoDa(thAna).ID_PEDIDO, {}, {}, TOKEN);
b.ok(!de2.ok && /aguardando envio/.test(de2.mensagem), "emitir de novo é recusado", de2.mensagem);

b.fluxo("VOUCHER · enviar depois, com a data do envio");
b.passo("5. Dias depois: o voucher foi feito em 27/10");
const shE = ss.getSheetByName(g.VOUCHER_ABA_EMITIDOS);
const cab = shE.getRange(1, 1, 1, shE.getLastColumn()).getValues()[0].map(String);
const iDoc = cab.indexOf("DATA_DOCUMENTO"), iEmi = cab.indexOf("DATA_EMISSAO"), iLink = cab.indexOf("LINK_ARQUIVO");
for (let r = 2; r <= shE.getLastRow(); r++) {
  if (iDoc > -1) shE.getRange(r, iDoc + 1).setValue(new Date(2026, 9, 27, 10, 0));
  if (iEmi > -1) shE.getRange(r, iEmi + 1).setValue(new Date(2026, 9, 27, 10, 0));
}
const linkAntes = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_EMITIDOS, e1.protocolo).LINK_ARQUIVO;

b.passo("6. 'Enviar selecionados' só com a Ana");
const env = g.voucherPedidosEnviarEmitidos([pedidoDa(thAna).ID_PEDIDO], TOKEN);
b.ok(env.ok && env.enviados.length === 1, "um enviado", JSON.stringify(env));
const emiDepois = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_EMITIDOS, e1.protocolo);
const hoje = g.Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
b.igual(g.Utilities.formatDate(new Date(emiDepois.DATA_DOCUMENTO), "America/Sao_Paulo", "yyyy-MM-dd"), hoje,
  "o voucher foi refeito com a data de HOJE");
b.ok(emiDepois.LINK_ARQUIVO && emiDepois.LINK_ARQUIVO !== linkAntes, "com PDF novo");
b.igual(emiDepois.CODIGO_VALIDACAO, emi.CODIGO_VALIDACAO, "e o MESMO código");
const resp = saida().filter(r => r.THREAD_ID === thAna.id).pop();
b.ok(resp && resp.STATUS === "PENDENTE" && resp.ANEXOS_FILE_IDS, "a resposta entrou na fila, na conversa da Ana, com o PDF");
b.ok(!saida().some(r => r.THREAD_ID === thEdu.id), "o Eduardo, não marcado, não foi");
b.igual(pedidoDa(thAna).ESTADO, "CONCLUIDO", "a Ana fica concluída");
b.igual(pedidoDa(thEdu).ESTADO, "EMITIDO", "o Eduardo continua aguardando");

b.passo("7. O leitor envia pela caixa da Secretaria, respondendo o pedido");
SIM.ciclo();
const saiu = amb.outbox.filter(m => m.via === "reply" && m.to === "ana@exemplo.com").pop();
b.ok(saiu, "saiu como resposta na conversa da Ana");

b.passo("8. Enviar de novo a mesma pessoa é recusado (não sai duas vezes)");
const env2 = g.voucherPedidosEnviarEmitidos([pedidoDa(thAna).ID_PEDIDO], TOKEN);
b.igual(env2.enviados.length, 0, "nada enviado");
b.igual(env2.recusados.length, 1, "recusado: não está mais aguardando envio");

b.passo("9. Nova mensagem do Eduardo enquanto aguarda envio: não desfaz a emissão");
responder(thEdu, "edu@exemplo.com", "Oi, já saiu meu voucher? Segue de novo o contracheque. CASO:EDU", [SIM.pdf("cc2.pdf")]);
ler();
b.igual(pedidoDa(thEdu).ESTADO, "EMITIDO", "continua na fila de envio");
b.igual(pedidoDa(thEdu).PROTOCOLO, e2.protocolo, "com o mesmo voucher");
const edu = g.voucherPedidosEmitidos(TOKEN).itens.find(i => i.protocolo === e2.protocolo);
b.ok(edu && /aguardava envio/.test(edu.aviso), "e a lista avisa que chegou mensagem nova", edu && edu.aviso);

b.passo("10. Sem nada marcado, nada sai");
b.ok(!g.voucherPedidosEnviarEmitidos([], TOKEN).ok, "pede para marcar quem vai receber");

b.naoTestavel("o PDF de verdade e a entrega", "o emulador registra, não entrega");
b.resumo();
