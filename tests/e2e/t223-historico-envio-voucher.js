/**
 * HISTÓRICO DE ENVIO DO VOUCHER — 31/10/2026.
 *
 * O usuário: "tem que registrar ... voucher enviado em face da fulana, do
 * beneficiário XYZ, dependente ABC ... quando foi enviado, por quem, qual
 * usuário ... um dia, se tiver uma denúncia no Ministério Público, a gente
 * tem de onde tirar a informação" — e sem tela nova (mockup
 * docs/mock-historico-envio-voucher.png, aprovado). Backend real, leitor
 * real (vpe-simulador), telas reais (jsdom), dados FICTÍCIOS.
 *
 * Prova: emitir e enviar deixam a linha do tempo no Voucher_Historico (quem
 * conferiu, quem pôs na fila, para quem); quando o leitor manda, entra a
 * saída com a hora dela; erro no envio também fica; nada é reescrito (só
 * linhas novas); a lista de Solicitações traz "Enviado em / por" e filtra; a
 * exportação leva quem enviou; a ficha mostra o Histórico.
 *
 * NÃO PROVA: a entrega no destinatário (só que saiu da caixa).
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TOKEN = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
shA.appendRow(["11144477735", "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow(["52998224725", "EDUARDO MELO", "SIM", "edu@exemplo.com", "27999990002", "ESCOLA BETA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, CC, RG, base } = SIM;
EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: "11144477735" },
  anexos: [CC("ANA MARIA SOUZA", "11144477735", "09/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", "11144477735")] });
EXTRACOES.EDU = base({ titular: { nome: "Eduardo Melo", cpf: "52998224725" },
  anexos: [CC("EDUARDO MELO", "52998224725", "09/2026", "ESCOLA BETA"), RG(2, "EDUARDO MELO", "52998224725")] });
const thAna = novaThread("Voucher 2027/1", "Ana <ana@exemplo.com>", "Quero o voucher de Pedagogia. CASO:ANA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
const thEdu = novaThread("Bolsa", "Edu <edu@exemplo.com>", "Voucher de Direito. CASO:EDU", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
SIM.ciclo();
for (let k = 0; k < 10; k++) { if (!g.voucherPedidosLerAgora(TOKEN).restantes) break; }
const ped = th => g.vpeLinhas_().find(r => r.THREAD_ID === th.id);
const hist = () => {
  const v = ss.getSheetByName("Voucher_Historico").getDataRange().getValues();
  return v.slice(1).map(l => Object.fromEntries(v[0].map((c, i) => [String(c), l[i]])));
};

b.fluxo("HISTÓRICO DE ENVIO · o registro");
b.passo("1. Emitir e enviar deixam a linha do tempo, com quem e para quem");
const eA = g.voucherPedidosConferirEmitir(ped(thAna).ID_PEDIDO, {}, {}, TOKEN);
const eE = g.voucherPedidosConferirEmitir(ped(thEdu).ID_PEDIDO, {}, {}, TOKEN);
b.ok(eA.ok && eE.ok, "os dois emitidos", eA.mensagem + " | " + eE.mensagem);
const antes = hist().length;
const env = g.voucherPedidosEnviarEmitidos([ped(thAna).ID_PEDIDO, ped(thEdu).ID_PEDIDO], TOKEN);
b.igual(env.enviados.length, 2, "os dois na fila");
const filaA = hist().filter(h => h.NUMERO_PROTOCOLO === eA.protocolo && h.ACAO === "EMAIL_NA_FILA").pop();
b.ok(filaA && filaA.USUARIO_RESPONSAVEL === "secretaria@sindeducacao.com" && /ana@exemplo\.com/.test(filaA.OBSERVACOES) &&
  /ref ENV_/.test(filaA.OBSERVACOES), "entrou na fila: quem clicou e para onde", JSON.stringify(filaA));
b.ok(filaA && /ANA/i.test(filaA.NOME) && filaA.CPF, "com o nome e o CPF na própria linha", filaA && filaA.NOME);

b.passo("2. O leitor envia; a saída entra no histórico, com a hora dela");
/* A do Eduardo falha (simulado: a caixa recusou). */
const shS = SIM.aba("Saida");
const vs = shS.getDataRange().getValues(), cS = vs[0].map(String);
const refE = (hist().filter(h => h.NUMERO_PROTOCOLO === eE.protocolo && h.ACAO === "EMAIL_NA_FILA").pop().OBSERVACOES.match(/ref (ENV_\w+)/) || [])[1];
SIM.ciclo();
const linE = shS.getDataRange().getValues().findIndex(l => l[cS.indexOf("ID")] === refE);
shS.getRange(linE + 1, cS.indexOf("STATUS") + 1).setValue("ERRO");
shS.getRange(linE + 1, cS.indexOf("DETALHE") + 1).setValue("caixa cheia do destinatário");
const hA = g.voucherHistoricoProtocolo(eA.protocolo, TOKEN);
b.ok(hA.ok, "a ficha lê o histórico", hA.mensagem);
const acoes = hA.eventos.map(e => e.acao);
b.ok(acoes[0] === "PEDIDO_RECEBIDO", "começa no pedido recebido (e-mail de quem pediu)", acoes.join(" > "));
b.ok(acoes.indexOf("VOUCHER_EMITIDO") > -1 && acoes.indexOf("EMAIL_NA_FILA") > acoes.indexOf("VOUCHER_EMITIDO") &&
  acoes.indexOf("EMAIL_SAIU") > acoes.indexOf("EMAIL_NA_FILA"), "emitido > na fila > saiu, nessa ordem", acoes.join(" > "));
const saiu = hA.eventos.find(e => e.acao === "EMAIL_SAIU");
b.ok(saiu && /ana@exemplo\.com/.test(saiu.detalhe) && /leitor/.test(saiu.quem), "a saída diz para quem e quem mandou (o leitor)", JSON.stringify(saiu));
const hE = g.voucherHistoricoProtocolo(eE.protocolo, TOKEN);
b.ok(hE.eventos.some(e => e.acao === "EMAIL_ERRO" && /caixa cheia/.test(e.detalhe)), "o erro do Eduardo também fica, com o motivo");

b.passo("3. Só se acrescenta: nada antigo muda, e a saída não se repete");
const snap = JSON.stringify(hist().slice(0, antes));
g.voucherHistoricoProtocolo(eA.protocolo, TOKEN);
g.listarSolicitacoesCertBolsa(TOKEN);
b.igual(JSON.stringify(hist().slice(0, antes)), snap, "as linhas antigas continuam iguais");
b.igual(hist().filter(h => h.NUMERO_PROTOCOLO === eA.protocolo && h.ACAO === "EMAIL_SAIU").length, 1, "a saída foi registrada uma vez só");

b.passo("4. A lista de Solicitações traz 'Enviado em / por'");
const lista = g.listarSolicitacoesCertBolsa(TOKEN);
const sA = lista.find(s => s.protocolo === eA.protocolo), sE = lista.find(s => s.protocolo === eE.protocolo);
b.ok(sA && sA.envio && sA.envio.situacao === "ENVIADO" && sA.envio.por === "secretaria@sindeducacao.com" && sA.envio.para === "ana@exemplo.com",
  "Ana: enviado, por quem, para quem", JSON.stringify(sA && sA.envio));
b.ok(sE && sE.envio && sE.envio.situacao === "ERRO", "Eduardo: erro no envio", JSON.stringify(sE && sE.envio));
b.bloqueia(() => g.voucherHistoricoProtocolo(eA.protocolo, "token-invalido"), "sem login não lê o histórico");

if (!dom.jsdomDisponivel()) { b.naoTestavel("as telas", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "Scripts_Certificado.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("HISTÓRICO DE ENVIO · as telas");
  b.passo("5. A ficha do voucher mostra o Histórico");
  win.VPE.abrir(ped(thAna).ID_PEDIDO);
  await t.assentar(250);
  b.ok(/Histórico/.test(t.texto("#vpeMHist")) && /Saiu da caixa/.test(t.texto("#vpeMHist")) && /secretaria@sindeducacao\.com/.test(t.texto("#vpeMHist")),
    "linha do tempo com a saída e quem enviou", t.texto("#vpeMHist").slice(0, 300));
  b.ok(/Registro permanente/.test(t.texto("#vpeMHist")), "avisando que é permanente");

  b.passo("6. A lista de Solicitações: coluna, filtro e exportação");
  t.clicar("#certBtnRecarregar");
  await t.assentar(300);
  const tab = () => t.texto("#certTbody");
  b.ok(/para ana@exemplo\.com/.test(tab()) && /erro no envio/.test(tab()), "a coluna 'Enviado em / por' aparece", tab().slice(0, 300));
  const f = el("certFiltroEnvio");
  f.value = "ENVIADO"; f.dispatchEvent(new win.Event("change", { bubbles: true }));
  await t.assentar(30);
  b.ok(/ana@exemplo\.com/.test(tab()) && !/erro no envio/.test(tab()), "filtro 'Enviados' deixa só os enviados");
  b.ok(Array.from(el("certFiltroEnviadoPor").options).some(o => o.value === "secretaria@sindeducacao.com"), "filtro 'Enviado por' com quem enviou");
  let csv = "";
  win.URL.createObjectURL = blob => { csv = blob; return "#"; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () {};
  win.Blob = function (partes) { this.texto = partes.join(""); };
  t.clicar("#certBtnExportarCsv");
  await t.assentar(20);
  b.ok(csv && /Enviado por/.test(csv.texto) && /secretaria@sindeducacao\.com/.test(csv.texto), "a exportação leva quem enviou");

  b.passo("7. A ficha das Solicitações também mostra o Histórico");
  win.certAbrirSolicitacao(sA);
  await t.assentar(200);
  b.ok(/Saiu da caixa/.test(t.texto("#certModalHistorico")), "o mesmo histórico no modal da solicitação");

  b.passo("8. Pela Caixa de E-mails, o presencial abre de verdade a ficha da solicitação");
  b.ok(typeof win.certAbrirSolicitacao === "function", "a tela de Solicitações expõe a abertura da ficha");

  b.naoTestavel("a entrega no destinatário", "o leitor confirma só que saiu da caixa");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
