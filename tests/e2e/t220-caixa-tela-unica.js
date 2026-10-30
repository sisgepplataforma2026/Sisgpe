/**
 * TELA ÚNICA DA SECRETARIA — 30/10/2026.
 *
 * O usuário: "preciso que fique tudo no mesmo lugar ... assim não preciso
 * abrir várias telas" (mockup docs/mock-caixa-unica.png, aprovado com
 * "Faça"). Os pedidos de voucher por e-mail e as solicitações presenciais
 * entram na lista da Caixa da Secretaria, junto com os outros e-mails.
 * Backend real, leitor real (vpe-simulador), tela real (jsdom), dados
 * FICTÍCIOS.
 *
 * Prova: os vouchers aparecem na lista com a situação; quem não tem
 * Benefícios não vê voucher (trava no servidor); confirmação de leitura
 * ("Lida:") fica de fora; abrir um voucher abre a conferência de sempre,
 * na própria Caixa; emitidos aparecem na faixa e saem daqui, só os
 * marcados, só com a confirmação; o presencial abre a solicitação.
 *
 * NÃO PROVA: aparência no navegador; a entrega do e-mail; o modal da
 * solicitação presencial por dentro (é o de Scripts_Certificado, testado à
 * parte) — aqui só que ele é chamado com a solicitação certa.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const hash = s => g.gerarHashSenha_(s);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["comu", hash("Senha@2026"), "Só Comunicação", "comu@sindeducacao.com",
  "USUARIO", "ATIVO", "NAO", "comunicacao"]);
const TOKEN = b.logar(g, "wanderson"), T_COMU = b.logar(g, "comu");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");

const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
shA.appendRow(["11144477735", "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow(["52998224725", "BIA LIMA", "SIM", "bia@exemplo.com", "27999990002", "ESCOLA BETA"]);

/* Uma solicitação presencial (fictícia), gravada pelos nomes de coluna. */
const shS = ss.getSheetByName("Voucher_Solicitacoes");
const cabS = shS.getRange(1, 1, 1, shS.getLastColumn()).getValues()[0].map(String);
/* A planilha aceita vários nomes por coluna; grava no que existir. */
const SIN = { NOME: ["NOME_SOLICITANTE", "NOME", "NOME COMPLETO"], EMAIL: ["EMAIL", "E-MAIL"],
  ESCOLA_SELECIONADA: ["ESCOLA_SELECIONADA", "ESCOLA"], NUMERO_PROTOCOLO: ["NUMERO_PROTOCOLO", "PROTOCOLO"],
  STATUS_SOLICITACAO: ["STATUS_SOLICITACAO", "STATUS"], DATA_SOLICITACAO: ["DATA_SOLICITACAO", "DATA"] };
function solicitacao(campos) {
  const porCol = {};
  Object.keys(campos).forEach(k => { const c = (SIN[k] || [k]).find(n => cabS.indexOf(n) > -1) || k; porCol[c] = campos[k]; });
  const linha = cabS.map(c => porCol[c] !== undefined ? porCol[c] : "");
  shS.appendRow(linha);
}
solicitacao({ NUMERO_PROTOCOLO: "VCH-PRES-001", NOME: "CARLOS PRESENCIAL", EMAIL: "carlos@exemplo.com",
  STATUS_SOLICITACAO: "PENDENTE", CURSO: "Direito", PERIODO_REFERENCIA: "2027/1", ESCOLA_SELECIONADA: "COLEGIO ALFA",
  TIPO_BENEFICIARIO: "TITULAR", DATA_SOLICITACAO: new Date() });
solicitacao({ NUMERO_PROTOCOLO: "VCH-PRES-002", NOME: "JA EMITIDO", STATUS_SOLICITACAO: "EMITIDO", DATA_SOLICITACAO: new Date() });

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, CC, RG, base } = SIM;
EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: "11144477735" },
  anexos: [CC("ANA MARIA SOUZA", "11144477735", "09/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", "11144477735")] });
EXTRACOES.BIA = base({ titular: { nome: "Bia Lima", cpf: "52998224725" }, anexos: [RG(1, "BIA LIMA", "52998224725")] });
novaThread("Voucher 2027/1", "Ana <ana@exemplo.com>", "Quero o voucher de Pedagogia. CASO:ANA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
novaThread("Bolsa", "Bia <bia@exemplo.com>", "Voucher 2027/1 Enfermagem. CASO:BIA", [SIM.jpg("rg.jpg")]);
novaThread("Quero me desfiliar", "João <joao@exemplo.com>", "Quero cancelar a filiação. TIPO:FILIACAO");
novaThread("Lida: Envio da Relação de Desconto", "Fulano <fulano@escola.exemplo.com>", "A sua mensagem foi lida. TIPO:FINANCEIRO");
SIM.ciclo();
for (let k = 0; k < 10; k++) { if (!g.voucherPedidosLerAgora(TOKEN).restantes) break; }
/* Uma confirmação de leitura que entrou na ponte ANTES da correção do leitor. */
const shCx = SIM.aba("Caixa");
const cabCx = shCx.getRange(1, 1, 1, shCx.getLastColumn()).getValues()[0].map(String);
shCx.appendRow(cabCx.map(c => ({ THREAD_ID: "lida-antiga", ULTIMA_MENSAGEM_ID: "lida-antiga", CAIXA: "SECRETARIA", TIPO: "FINANCEIRO",
  ATUALIZADO_EM: new Date(), ANEXOS_JSON: "[]",
  MENSAGENS_JSON: JSON.stringify([{ id: "lida-antiga", de: "x@y.com", assunto: "Lida: Relação de Mensalidade", data: new Date().toISOString(), corpo: "lida" }])
}[c] !== undefined ? ({ THREAD_ID: "lida-antiga", ULTIMA_MENSAGEM_ID: "lida-antiga", CAIXA: "SECRETARIA", TIPO: "FINANCEIRO",
  ATUALIZADO_EM: new Date(), ANEXOS_JSON: "[]",
  MENSAGENS_JSON: JSON.stringify([{ id: "lida-antiga", de: "x@y.com", assunto: "Lida: Relação de Mensalidade", data: new Date().toISOString(), corpo: "lida" }])
})[c] : "")));

const ped = email => g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === email);

b.fluxo("TELA ÚNICA · o painel");
b.passo("1. Os vouchers entram na lista da Caixa, com a situação de cada um");
let p = g.caixaSecretariaPainel(TOKEN);
b.ok(p.ok, "o painel abre", p.mensagem);
const vAna = p.itens.find(i => i.fonte === "VOUCHER" && i.de === "ana@exemplo.com");
const vBia = p.itens.find(i => i.fonte === "VOUCHER" && i.de === "bia@exemplo.com");
b.ok(vAna && /Pronto/.test(vAna.selo) && vAna.estado === "NOVO", "Ana: voucher pronto, a tratar", JSON.stringify(vAna && vAna.selo));
b.ok(vBia && /Falta documento/.test(vBia.selo) && /Falta:/.test(vBia.trecho), "Bia: falta documento, com o que falta", vBia && vBia.trecho);
const pres = p.itens.find(i => i.fonte === "PRESENCIAL");
b.ok(pres && pres.id === "VCH-PRES-001" && /Presencial/.test(pres.selo) && pres.sol && pres.sol.protocolo === "VCH-PRES-001",
  "a solicitação presencial pendente também", JSON.stringify(pres && pres.selo));
b.ok(!p.itens.some(i => i.id === "VCH-PRES-002"), "a presencial já emitida não (não precisa de ninguém)");
b.ok(p.itens.some(i => i.fonte === "EMAIL" && i.tipo === "FILIACAO"), "e os outros e-mails continuam ali");
b.igual(p.porTipo.VOUCHER, 3, "o card de voucher conta 3 a tratar");
b.ok(p.voucher.pode && p.voucher.cont.PRONTO === 1 && p.voucher.cont.FALTA_DOC === 1 && p.voucher.cont.PRESENCIAL === 1,
  "com as contagens por situação", JSON.stringify(p.voucher.cont));

b.passo("2. Confirmação de leitura ('Lida:') fica de fora");
b.ok(!p.itens.some(i => /^Lida:/i.test(i.assunto)), "nem a nova (o leitor deixa de fora) nem a antiga (o painel esconde)",
  p.itens.filter(i => /Lida/.test(i.assunto)).map(i => i.assunto).join(", "));

b.passo("3. Quem não tem Benefícios não vê voucher (trava no servidor)");
const pc = g.caixaSecretariaPainel(T_COMU);
b.ok(pc.ok, "abre a Caixa (tem Comunicação)");
b.ok(!pc.itens.some(i => i.tipo === "VOUCHER") && !pc.voucher.pode, "mas nenhum voucher vem do servidor");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a tela única", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
/* O modal do voucher fica dentro da tela de Benefícios, escondida. */
const escondida = doc.createElement("div"); escondida.style.display = "none"; doc.body.appendChild(escondida);
escondida.appendChild(el("vpeModal"));
let solAberta = null;
win.cert_abrirModal = s => { solAberta = s; };
(async function () {
  b.fluxo("TELA ÚNICA · a tela");
  b.passo("4. A lista mostra vouchers e e-mails juntos; o card de voucher filtra");
  win.cxsIniciar();
  await t.assentar(150);
  t.clicar("[data-cxs='filtrarMeus'][data-arg='']"); await t.assentar(30);   // "Tudo" (não só o meu departamento)
  const lista = () => t.texto("#cxsLista");
  b.ok(/ANA MARIA/i.test(lista()) && /CARLOS PRESENCIAL/.test(lista()) && /desfiliar/.test(lista()), "tudo na mesma lista", lista().slice(0, 600));
  b.ok(/Pronto/.test(lista()) && /Falta documento/.test(lista()) && /Presencial/.test(lista()), "com a situação de cada voucher");
  b.ok(/1 prontos/.test(t.texto("#cxsTipos")) && /1 presenciais/.test(t.texto("#cxsTipos")), "o card mostra as contagens");
  t.clicar("[data-cxs='filtrarTipo'][data-arg='VOUCHER']");
  await t.assentar(30);
  b.ok(!/desfiliar/.test(lista()) && /ANA MARIA/i.test(lista()), "clicar no card deixa só os vouchers");
  t.clicar("[data-cxs='filtrarTipo'][data-arg='VOUCHER']");
  await t.assentar(30);

  b.passo("5. Abrir o voucher da Ana abre a conferência de sempre, aqui mesmo");
  t.clicar("[data-cxs='abrir'][data-arg='" + vAna.id + "']");
  await t.assentar(150);
  b.ok(el("vpeModal").classList.contains("aberto"), "o modal de conferência abriu");
  b.ok(el("vpeModal").parentNode === doc.body, "fora da tela escondida (senão não aparece)");
  b.ok(/Ana/i.test(t.texto("#vpeMTitulo")), "com o pedido da Ana", t.texto("#vpeMTitulo"));

  b.passo("6. Conferir e emitir; a Caixa se atualiza e mostra a faixa de envio");
  const nPainel = () => t.chamadas.filter(c => c.fn === "caixaSecretariaPainel").length;
  const n0 = nPainel();
  const botao = Array.from(doc.querySelectorAll("#vpeMAcoes button")).find(x => /Conferir e emitir/.test(x.textContent));
  t.clicar(botao);
  await t.assentar(200);
  b.igual(ped("ana@exemplo.com").ESTADO, "EMITIDO", "emitido (e nada enviado)");
  b.ok(!el("vpeModal").classList.contains("aberto"), "o modal fechou");
  b.ok(nPainel() > n0, "e a Caixa recarregou sozinha");
  b.ok(el("cxsFaixa").style.display !== "none" && /1 voucher/.test(t.texto("#cxsFaixa")), "a faixa avisa: 1 emitido aguardando envio",
    t.texto("#cxsFaixa"));

  b.passo("7. Enviar daqui: só os marcados, e só depois de confirmar");
  const out0 = SIM.aba("Saida").getLastRow();
  t.clicar("[data-cxs='envAbrir']");
  await t.assentar(80);
  b.ok(/Ana/i.test(t.texto("#cxsEnvLista")), "a Ana está na lista de envio");
  b.ok(el("cxsEnvBtn").disabled, "sem marcar ninguém, o botão não envia");
  const chk = doc.querySelector(".cxs-env-chk");
  chk.checked = true; chk.dispatchEvent(new win.Event("change", { bubbles: true }));
  t.clicar("#cxsEnvBtn");
  await t.assentar(50);
  b.ok(/Clique de novo para confirmar/.test(t.texto("#cxsEnvConfirma")), "o primeiro clique só mostra o que vai sair");
  b.igual(SIM.aba("Saida").getLastRow(), out0, "nada saiu ainda");
  t.clicar("#cxsEnvBtn");
  await t.assentar(200);
  b.ok(SIM.aba("Saida").getLastRow() > out0, "o segundo clique põe na fila da Secretaria");
  b.igual(ped("ana@exemplo.com").ESTADO, "CONCLUIDO", "e a Ana fica concluída");

  b.passo("8. O presencial abre a solicitação dele");
  t.clicar("[data-cxs='abrir'][data-arg='VCH-PRES-001']");
  await t.assentar(30);
  b.ok(solAberta && solAberta.protocolo === "VCH-PRES-001", "abre a solicitação certa");

  b.passo("9. Filtros de semestre e escola valem para tudo");
  const selE = el("cxsFEscola");
  b.ok(Array.from(selE.options).some(o => o.value === "COLEGIO ALFA"), "a escola aparece no filtro");
  selE.value = "COLEGIO ALFA"; selE.dispatchEvent(new win.Event("change", { bubbles: true }));
  await t.assentar(20);
  b.ok(/CARLOS PRESENCIAL/.test(lista()) && !/desfiliar/.test(lista()), "filtrar pela escola deixa só o que é dela");

  b.naoTestavel("aparência e o modal presencial por dentro", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
