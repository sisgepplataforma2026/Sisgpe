/**
 * CC E CCO NA CAIXA (03/11/2026: "não tem opção de com cópia e cópia oculta
 * ... tem que ter"). Backend real, tela real (jsdom), Gmail e leitor FALSOS.
 *
 * Prova: resposta pela financeiro@ sai com cc e bcc; pela secretaria@ a
 * fila leva CC/CCO e o leitor manda com cc/bcc; e-mail inválido é recusado;
 * em homologação o Cc/Cco também só vai para a equipe; o Novo e-mail tem
 * Cco; a tela manda os campos. NÃO PROVA: a entrega de verdade.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);
g.vpeChamarIA_ = () => ({ resultados: [] });

const respostas = [], novos = [];
const m1 = { getId: () => "CC1", getFrom: () => "Escola <rh@e.exemplo.com>", getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
  getSubject: () => "Guia", getDate: () => new Date(), getPlainBody: () => "Pedido de guia", getAttachments: () => [],
  reply: (body, op) => respostas.push(op) };
g.cxsGmailFinanceiro_ = () => ({
  search: q => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? [{ getId: () => "t1", getMessages: () => [m1] }] : []),
  getThreadById: id => id === "t1" ? { getId: () => "t1", getMessages: () => [m1] } : null,
  getMessageById: id => id === "CC1" ? m1 : null, getUserLabels: () => [], getUserLabelByName: () => null,
  sendEmail: (p, a, c, op) => novos.push({ p, op })
});
g.caixaFinanceiroItens(TOKEN);

b.fluxo("CC E CCO · o servidor");
b.passo("1. financeiro@: resposta com cópia e cópia oculta");
const r = g.caixaSecretariaResponder("F:t1", "Prezados, segue a guia pedida.", { cc: "contador@exemplo.com, dp@exemplo.com", cco: "wanderson@sindeducacao.com" }, TOKEN);
b.ok(r.ok && respostas.length === 1, "respondeu", r.mensagem);
b.igual([respostas[0].cc, respostas[0].bcc], ["contador@exemplo.com,dp@exemplo.com", "wanderson@sindeducacao.com"], "com cc e bcc");
b.ok(!g.caixaSecretariaResponder("F:t1", "Prezados, segue a guia pedida.", { cc: "nao-e-email" }, TOKEN).ok, "Cc inválido: recusa");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao"); g.getAmbienteAtual._cache = undefined;
const h = g.caixaSecretariaResponder("F:t1", "Prezados, segue a guia pedida.", { cco: "fora@exemplo.com" }, TOKEN);
b.ok(!h.ok && /\[HML\]/.test(h.mensagem) && respostas.length === 1, "em HML, Cco para fora da equipe é bloqueado (nada saiu)");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao"); g.getAmbienteAtual._cache = undefined;
const aud = JSON.stringify(ss.getSheets().filter(s => /Auditoria/i.test(s.getName())).map(s => s.getDataRange().getValues()));
b.ok(/cc contador@exemplo\.com/.test(aud) && /cco wanderson@/.test(aud), "a auditoria guarda o cc e o cco");

b.passo("2. secretaria@: a fila leva CC/CCO e o leitor manda junto");
SIM.novaThread("Pedido de declaração", "Ana <ana@exemplo.com>", "Preciso da declaração. TIPO:FILIACAO");
SIM.ciclo();
const it = g.caixaSecretariaPainel(T_SEC).itens.find(i => /declaração/.test(i.assunto));
const rs = g.caixaSecretariaResponder(it.id, "Olá, Ana! Segue a declaração.", { cc: "rh@escola.exemplo.com", cco: "secretaria@sindeducacao.com" }, T_SEC);
b.ok(rs.ok, "na fila", rs.mensagem);
const sh = SIM.aba("Saida"), cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
const ult = sh.getDataRange().getValues().slice(-1)[0];
b.igual([ult[cab.indexOf("CC")], ult[cab.indexOf("CCO")]], ["rh@escola.exemplo.com", "secretaria@sindeducacao.com"], "a linha da fila com CC e CCO");
const antes = amb.outbox.length;
SIM.ciclo();
const saiu = amb.outbox.slice(antes).find(o => o.via === "reply");
b.ok(saiu && saiu.cc === "rh@escola.exemplo.com" && saiu.bcc === "secretaria@sindeducacao.com", "o leitor respondeu com cc e bcc", JSON.stringify(saiu && [saiu.cc, saiu.bcc]));

b.passo("3. Novo e-mail com Cco");
const n = g.caixaFinanceiroNovoEmail({ para: "rh@e.exemplo.com", cc: "a@exemplo.com", cco: "b@exemplo.com", assunto: "Aviso", texto: "Prezados, um aviso." }, TOKEN);
b.ok(n.ok && novos[0].op.cc === "a@exemplo.com" && novos[0].op.bcc === "b@exemplo.com", "saiu com cc e bcc", n.mensagem);

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("CC E CCO · a tela");
  win.cxsIniciar(); await t.assentar(250);
  el("cxsFEstado").value = ""; el("cxsFEstado").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(20);
  t.clicar("[data-cxs='abrir'][data-arg='F:t1']"); await t.assentar(250);
  b.ok(el("cxsMCc") && el("cxsMCco"), "a resposta tem os campos Cc e Cco");
  b.passo("5. Em homologação, para fora da equipe: o erro aparece DENTRO da janela");
  g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao"); g.getAmbienteAtual._cache = undefined;
  el("cxsMResposta").value = "Prezados, segue a guia.";
  const nH = respostas.length;
  t.clicar("[data-cxs='responder']"); await t.assentar(250);
  b.ok(el("cxsMErro").style.display !== "none" && /Não foi enviado: \[HML\]/.test(el("cxsMErro").textContent), "aviso vermelho na janela", el("cxsMErro").textContent.slice(0, 90));
  b.ok(el("cxsModal").classList.contains("aberto") && respostas.length === nH, "a janela continua aberta e nada saiu");
  g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao"); g.getAmbienteAtual._cache = undefined;
  b.passo("6. Deu certo: fecha a janela e mostra a faixa verde");
  el("cxsMCc").value = "copia@exemplo.com"; el("cxsMCco").value = "oculta@exemplo.com";
  el("cxsMResposta").value = "Prezados, segue de novo a guia.";
  const n0 = respostas.length;
  t.clicar("[data-cxs='responder']"); await t.assentar(250);
  const ultR = respostas[respostas.length - 1];
  b.ok(respostas.length === n0 + 1 && ultR.cc === "copia@exemplo.com" && ultR.bcc === "oculta@exemplo.com", "a tela mandou com cc e cco");
  b.ok(!el("cxsModal").classList.contains("aberto"), "a janela fechou");
  b.ok(el("cxsEnviado").style.display !== "none" && /✅ Resposta enviada para rh@e\.exemplo\.com/.test(t.texto("#cxsEnviado")), "a faixa verde: enviado para quem", t.texto("#cxsEnviado"));
  b.ok(el("cxsNCco"), "o Novo e-mail tem Cco");
  b.naoTestavel("a entrega de verdade", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
