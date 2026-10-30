/**
 * A ESCOLA DO PEDIDO NO CADASTRO DO SISGEP — 30/10/2026.
 *
 * O usuário: cruzar a escola com as escolas do SISGEP; se não estiver
 * cadastrada, "pode cadastrar manualmente no SISGEP, ou abre um link para
 * cadastrar". Backend real, leitor real, tela real (jsdom), dados FICTÍCIOS.
 *
 * Prova: acha pelo CNPJ do contracheque, pela raiz (outra unidade) e pelo
 * nome; o nome oficial do cadastro vai para o pedido; escola fora do
 * cadastro trava em "precisa de você" com as parecidas; "É esta" resolve;
 * o cadastro abre preenchido; escola diferente da do associado avisa.
 *
 * NÃO PROVA: a IA de verdade lendo o CNPJ no contracheque escaneado.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* O cadastro de escolas (fictício). */
const shEsc = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
shEsc.getRange(1, 1, 1, 4).setValues([["EscolaID", "Escola (Razão Social)", "CNPJ", "NOME_FANTASIA"]]);
shEsc.appendRow(["ESC-1", "SOCIEDADE EDUCACIONAL ALFA LTDA", "11.222.333/0001-81", "COLÉGIO ALFA"]);
shEsc.appendRow(["ESC-2", "INSTITUTO BETA DE ENSINO LTDA", "44.555.666/0001-99", "ESCOLA BETA"]);
shEsc.appendRow(["ESC-3", "CENTRO EDUCACIONAL NOVO HORIZONTE LTDA", "77.888.999/0002-10", "NOVO HORIZONTE"]);

const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
const P = { ANA: "11144477735", BIA: "52998224725", CAIO: "39053344705", DANI: "86288366757", EDU: "71428793860" };
shA.appendRow([P.ANA, "ANA SOUZA", "SIM", "ana@exemplo.com", "1", "COLÉGIO ALFA"]);
shA.appendRow([P.BIA, "BIA LIMA", "SIM", "bia@exemplo.com", "2", "ESCOLA BETA"]);
shA.appendRow([P.CAIO, "CAIO DIAS", "SIM", "caio@exemplo.com", "3", "NOVO HORIZONTE"]);
shA.appendRow([P.DANI, "DANI ROCHA", "SIM", "dani@exemplo.com", "4", ""]);
shA.appendRow([P.EDU, "EDU MELO", "SIM", "edu@exemplo.com", "5", "COLÉGIO ALFA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, CC, RG, base } = SIM;
const cc = (nome, cpf, emp, cnpj) => Object.assign(CC(nome, cpf, "09/2026", emp), { cnpj_empregador: cnpj || "" });
EXTRACOES.ANA = base({ titular: { nome: "Ana Souza", cpf: P.ANA }, anexos: [cc("ANA SOUZA", P.ANA, "SOC EDUC ALFA", "11222333000181"), RG(2, "ANA SOUZA", P.ANA)] });
EXTRACOES.BIA = base({ titular: { nome: "Bia Lima", cpf: P.BIA }, anexos: [cc("BIA LIMA", P.BIA, "INSTITUTO BETA - UNIDADE 2", "44555666000270"), RG(2, "BIA LIMA", P.BIA)] });
EXTRACOES.CAIO = base({ titular: { nome: "Caio Dias", cpf: P.CAIO }, anexos: [cc("CAIO DIAS", P.CAIO, "Novo Horizonte", ""), RG(2, "CAIO DIAS", P.CAIO)] });
EXTRACOES.DANI = base({ titular: { nome: "Dani Rocha", cpf: P.DANI }, anexos: [cc("DANI ROCHA", P.DANI, "COLEGIO HORIZONTE AZUL", "99000111000155"), RG(2, "DANI ROCHA", P.DANI)] });
EXTRACOES.EDU = base({ titular: { nome: "Edu Melo", cpf: P.EDU }, anexos: [cc("EDU MELO", P.EDU, "INSTITUTO BETA DE ENSINO", "44555666000199"), RG(2, "EDU MELO", P.EDU)] });
["ANA", "BIA", "CAIO", "DANI", "EDU"].forEach(k =>
  novaThread("Voucher " + k, k.toLowerCase() + "@exemplo.com", "Quero o voucher. CASO:" + k, [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]));
SIM.ciclo();
for (let k = 0; k < 10; k++) { if (!g.voucherPedidosLerAgora(TOKEN).restantes) break; }
const ped = email => g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === email);
const det = email => g.voucherPedidosDetalhe(ped(email).ID_PEDIDO, TOKEN);

b.fluxo("VOUCHER · escola no cadastro do SISGEP");
b.passo("1. Pelo CNPJ do contracheque: o nome oficial do cadastro vai para o pedido");
const dA = det("ana@exemplo.com");
b.igual(dA.campos.escola.valor, "SOCIEDADE EDUCACIONAL ALFA LTDA", "Ana: razão social do cadastro");
b.ok(/pelo CNPJ do documento/.test(dA.campos.escola.origem), "com a origem à vista", dA.campos.escola.origem);
b.igual(ped("ana@exemplo.com").ESTADO, "PRONTO", "e o pedido fica pronto");

b.passo("2. CNPJ de outra unidade da mesma escola (mesma raiz)");
const dB = det("bia@exemplo.com");
b.igual(dB.campos.escola.valor, "INSTITUTO BETA DE ENSINO LTDA", "Bia: achou a escola");
b.ok(/outra unidade/.test(dB.campos.escola.origem), "dizendo que é outra unidade", dB.campos.escola.origem);

b.passo("3. Sem CNPJ, pelo nome (fantasia)");
const dC = det("caio@exemplo.com");
b.igual(dC.campos.escola.valor, "CENTRO EDUCACIONAL NOVO HORIZONTE LTDA", "Caio: achou pelo nome");
b.ok(/pelo nome/.test(dC.campos.escola.origem), "pelo nome");

b.passo("4. Escola fora do cadastro: trava para alguém decidir, com as parecidas");
const pD = ped("dani@exemplo.com");
b.igual(pD.ESTADO, "PRECISA_VOCE", "Dani: precisa de você");
const dD = det("dani@exemplo.com");
b.ok(dD.pendencias.some(p => /Escola não cadastrada no SISGEP/.test(p.texto)), "pendência: escola não cadastrada");
b.ok(dD.escola && dD.escola.cnpjLido === "99000111000155", "guarda o CNPJ lido, para o cadastro");
b.ok(dD.escola.parecidas.some(x => /NOVO HORIZONTE/.test(x.nome)), "sugere a parecida (Novo Horizonte)",
  JSON.stringify(dD.escola.parecidas));
b.ok(!g.voucherPedidosConferirEmitir(pD.ID_PEDIDO, {}, {}, TOKEN).ok, "não emite sem decidir");

b.passo("5. Escola do documento diferente da do cadastro do associado: avisa");
const dE = det("edu@exemplo.com");
b.ok(dE.pendencias.some(p => p.tipo === "AVISO" && /pode ter mudado de escola/.test(p.texto)),
  "Edu: cadastro diz Alfa, contracheque é da Beta — aviso", JSON.stringify(dE.pendencias));

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a tela da escola fora do cadastro", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}
const t = dom.montar(g, ["VoucherPedidosEmailUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
/* O cadastro de escolas, como na página do SISGEP (só os campos usados). */
const ceN = doc.createElement("input"); ceN.id = "ceNomeEscola"; doc.body.appendChild(ceN);
const ceC = doc.createElement("input"); ceC.id = "ceCnpj"; doc.body.appendChild(ceC);
win.spIr = function (mod) { win.__abriu = mod; };
(async function () {
  b.fluxo("VOUCHER · escola fora do cadastro, na tela");
  b.passo("6. O quadro aparece com a parecida e o botão de cadastrar");
  win.VPE.abrir(pD.ID_PEDIDO);
  await t.assentar(120);
  b.ok(el("vpeMEscola").style.display !== "none" && /não cadastrada/.test(t.texto("#vpeMEscola")), "o quadro aparece");
  b.ok(/NOVO HORIZONTE/.test(t.texto("#vpeMEscola")), "com a parecida");

  b.passo("7. 'Cadastrar escola' abre o cadastro já preenchido com o que veio no documento");
  t.clicar("[data-vpe='cadastrarEscola']");
  await t.assentar(800);
  b.igual(win.__abriu, "escolas", "abriu o módulo Escolas");
  b.igual(ceN.value, "COLEGIO HORIZONTE AZUL", "com o nome lido");
  b.igual(ceC.value, "99000111000155", "e o CNPJ lido");

  b.passo("8. 'É esta' (a parecida): reconfere e o pedido sai do 'precisa de você'");
  win.VPE.abrir(pD.ID_PEDIDO);
  await t.assentar(120);
  const k = Array.from(doc.querySelectorAll("[data-vpe='escolherEscola']")).findIndex(x =>
    /NOVO HORIZONTE/.test(x.parentNode.textContent));
  t.clicar(doc.querySelectorAll("[data-vpe='escolherEscola']")[k]);
  await t.assentar(150);
  b.igual(ped("dani@exemplo.com").ESTADO, "PRONTO", "agora está PRONTO");
  b.ok(el("vpeMEscola").style.display === "none", "o quadro some");

  b.resumo();
  process.exit(process.exitCode || 0);
})();
