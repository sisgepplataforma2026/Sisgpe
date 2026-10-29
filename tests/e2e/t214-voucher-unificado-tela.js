/**
 * O VOUCHER EM TRÊS ETAPAS, NA TELA — 29/10/2026 (maquete
 * docs/mock-voucher-unificado.png): 1 · Entrada → 2 · Emitidos, aguardando
 * envio → 3 · Solicitações, enviados e presenciais.
 *
 * DOM real (jsdom), backend real, leitor real, cliques reais, dados
 * FICTÍCIOS. Prova: os filtros da Entrada; "Conferir e emitir" não envia e
 * leva para a aba 2; a aba 2 filtra, marca, CONFERE antes e só envia os
 * marcados; nada sai sem o clique de confirmar.
 *
 * NÃO PROVA: aparência, o PDF de verdade, a entrega.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER UNIFICADO · Tela");
  b.naoTestavel("tela do voucher unificado", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
shA.appendRow(["11144477735", "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow(["52998224725", "EDUARDO MELO", "SIM", "edu@exemplo.com", "27999990002", "ESCOLA BETA"]);
shA.appendRow(["39053344705", "CARLA DIAS", "SIM", "carla@exemplo.com", "27999990003", "COLEGIO ALFA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, CC, RG, base } = SIM;
EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: "11144477735" },
  anexos: [CC("ANA MARIA SOUZA", "11144477735", "09/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", "11144477735")] });
EXTRACOES.EDU = base({ titular: { nome: "Eduardo Melo", cpf: "52998224725" }, curso: "Direito", periodo: "2026/2",
  anexos: [CC("EDUARDO MELO", "52998224725", "09/2026", "ESCOLA BETA"), RG(2, "EDUARDO MELO", "52998224725")] });
EXTRACOES.CARLA = base({ titular: { nome: "Carla Dias", cpf: "39053344705" }, curso: "Letras",
  anexos: [CC("CARLA DIAS", "39053344705", "09/2026", "COLEGIO ALFA"), RG(2, "CARLA DIAS", "39053344705")] });
novaThread("Voucher", "ana@exemplo.com", "Voucher Pedagogia 2027/1. CASO:ANA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
novaThread("Bolsa", "edu@exemplo.com", "Voucher Direito 2026/2. CASO:EDU", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
novaThread("Bolsa", "carla@exemplo.com", "Voucher Letras 2027/1. CASO:CARLA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
SIM.ciclo();
g.voucherPedidosLerAgora(TOKEN);
const idDe = email => g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === email).ID_PEDIDO;

const t = dom.montar(g, ["VoucherPedidosEmailUI.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
const solic = doc.createElement("div"); solic.id = "secCertificadoAdmin"; doc.body.appendChild(solic);
const el = id => doc.getElementById(id);
const visivel = id => el(id) && el(id).style.display !== "none";
const nomesNaLista = () => Array.from(doc.querySelectorAll("#vpeLista .vpe-item-nome")).map(x => x.textContent);
const botao = rot => Array.from(doc.querySelectorAll("#vpeMAcoes button")).find(x => x.textContent.trim() === rot);

(async function () {
  win.VPE.carregar();
  await t.assentar(150);

  b.fluxo("VOUCHER UNIFICADO · as três abas");
  b.passo("1. Três abas, na ordem do trabalho");
  b.ok(/1 · Entrada/.test(el("vpeAbaPedidos").textContent), "1 · Entrada");
  b.ok(/2 · Emitidos/.test(el("vpeAbaEmitidos").textContent), "2 · Emitidos — aguardando envio");
  b.ok(/3 · Solicitações/.test(el("vpeAbaSolicitacoes").textContent), "3 · Solicitações, enviados e presenciais");
  b.ok(visivel("vpeSecao"), "abre na Entrada (há pedido esperando)");

  b.fluxo("VOUCHER UNIFICADO · filtros da Entrada");
  b.passo("2. Busca, semestre e escola");
  b.igual(nomesNaLista().length, 3, "três pedidos");
  t.digitar("#vpeFBusca", "eduardo");
  await t.assentar(10);
  b.igual(nomesNaLista().length, 1, "buscar 'eduardo' deixa um");
  t.digitar("#vpeFBusca", "");
  t.escolher("#vpeFSemestre", "2026/2");
  await t.assentar(10);
  b.ok(nomesNaLista().length === 1 && /EDUARDO/.test(nomesNaLista()[0]), "semestre 2026/2: só o Eduardo");
  t.escolher("#vpeFSemestre", "");
  t.escolher("#vpeFEscola", "COLEGIO ALFA");
  await t.assentar(10);
  b.igual(nomesNaLista().length, 2, "escola Colégio Alfa: Ana e Carla");
  t.clicar("[data-vpe='limparFiltros']");
  await t.assentar(10);
  b.igual(nomesNaLista().length, 3, "'Limpar filtros' volta tudo");

  b.fluxo("VOUCHER UNIFICADO · conferir e emitir");
  b.passo("3. No pedido pronto: 'Conferir e emitir' e 'Conferir e enviar agora'");
  win.VPE.abrir(idDe("ana@exemplo.com"));
  await t.assentar(80);
  b.ok(botao("Conferir e emitir") && botao("Conferir e enviar agora"), "os dois botões");
  const out0 = amb.outbox.length, fila0 = g.vpeLinhas_(SIM.aba("Saida")).length;
  t.clicar(botao("Conferir e emitir"));
  await t.assentar(150);
  b.ok(t.chamadas.some(c => c.fn === "voucherPedidosConferirEmitir"), "chamou o 'conferir e emitir'");
  b.igual(g.vpeLinhas_(SIM.aba("Saida")).length, fila0, "nada foi para a fila de envio");
  b.igual(amb.outbox.length, out0, "nenhum e-mail saiu");
  b.ok(!nomesNaLista().some(n => /ANA/.test(n)), "a Ana sai da Entrada");
  b.igual(el("vpeAbaBadgeEmi").textContent, "1", "e a aba 2 mostra 1");
  win.VPE.abrir(idDe("edu@exemplo.com")); await t.assentar(80);
  t.clicar(botao("Conferir e emitir")); await t.assentar(150);

  b.fluxo("VOUCHER UNIFICADO · 2 · emitidos, aguardando envio");
  b.passo("4. A aba 2 lista os emitidos, com filtro");
  t.clicar("#vpeAbaEmitidos");
  await t.assentar(120);
  b.ok(visivel("vpeEmitidos") && !visivel("vpeSecao"), "a aba 2 abriu");
  const linhas = () => doc.querySelectorAll("#vpeEmiLista .vpe-emi-linha").length;
  b.igual(linhas(), 2, "Ana e Eduardo");
  b.ok(/ana@exemplo\.com/.test(t.texto("#vpeEmiLista")) && /sai com a data do envio/.test(t.texto("#vpeEmiLista")),
    "mostra para quem vai e que sai com a data do envio");
  t.escolher("#vpeESemestre", "2026/2");
  await t.assentar(10);
  b.igual(linhas(), 1, "filtro de semestre: só o Eduardo");
  t.escolher("#vpeESemestre", "");
  await t.assentar(10);

  b.passo("5. Marcar a Ana e enviar: CONFERE antes, e só os marcados saem");
  b.ok(el("vpeEmiEnviar").disabled, "sem marcar, o botão não envia");
  t.marcar("#vpeEmiLista .vpe-emi-chk[data-id='" + idDe("ana@exemplo.com") + "']", true);
  await t.assentar(10);
  b.ok(/\(1\)/.test(el("vpeEmiEnviar").textContent), "o botão diz (1)");
  t.clicar("#vpeEmiEnviar");
  await t.assentar(20);
  b.ok(el("vpeEnvOverlay").classList.contains("aberto"), "abre a conferência");
  b.ok(/ANA MARIA SOUZA/.test(t.texto("#vpeEnvLista")) && !/EDUARDO/.test(t.texto("#vpeEnvLista")),
    "na conferência só a Ana");
  b.ok(!t.chamadas.some(c => c.fn === "voucherPedidosEnviarEmitidos"), "ainda não enviou nada");
  t.clicar("#vpeEnvConfirmar");
  await t.assentar(200);
  const env = t.chamadas.filter(c => c.fn === "voucherPedidosEnviarEmitidos").pop();
  b.ok(env && env.args[0].length === 1 && env.args[0][0] === idDe("ana@exemplo.com"), "enviou só a Ana");
  b.ok(g.vpeLinhas_(SIM.aba("Saida")).some(r => r.STATUS === "PENDENTE"), "a resposta da Ana entrou na fila da Secretaria");
  b.igual(linhas(), 1, "a aba 2 fica só com o Eduardo");

  b.passo("6. 'Marcar todos da lista' respeita o filtro");
  t.digitar("#vpeEBusca", "nada-assim");
  await t.assentar(10);
  t.marcar("#vpeEmiTodos", true);
  await t.assentar(10);
  b.ok(el("vpeEmiEnviar").disabled, "com a lista vazia pelo filtro, ninguém foi marcado");

  b.naoTestavel("a aparência das três abas", "jsdom não desenha — ver a maquete e conferir no navegador");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
