/**
 * ROBÔ DOS COMPROVANTES (03/11/2026). O usuário: rotina automática que lê os
 * comprovantes sozinha — "sim"; só a secretaria@; 20h; "Limite 10".
 *
 * Backend real, leitor da Secretaria REAL (vpe-simulador), tela real (jsdom),
 * IA FALSA (devolve uma leitura fixa) e dados FICTÍCIOS.
 *
 * Prova:
 *   - começa desligado: rodar não lê nada; só administrador liga;
 *   - ligar agenda todo dia às 20h (fuso de São Paulo); desligar tira;
 *   - lê só a secretaria@, só o card Contribuições, só com PDF/imagem;
 *   - no máximo 10 por vez; o resto fica para a próxima; não relê o que já leu;
 *     relê quando chega mensagem nova; o que falha tenta de novo (até 3 vezes);
 *   - não responde, não move, não manda nada (nenhuma linha na fila de saída);
 *   - a lista de nomes vai para a Conferência mensal;
 *   - abrir o e-mail mostra a leitura guardada sem chamar a IA de novo;
 *   - "Está certo" / "Corrigir" ficam na memória do robô, corrigem a lista da
 *     conferência e voltam como exemplo no pedido à IA; o acerto aparece.
 *
 * NÃO PROVA: o agendamento de verdade disparar às 20h, a IA de verdade
 * (qualidade da leitura), o Drive de verdade, a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "OPERADOR", "ATIVO", "NAO", "comunicacao"]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);
/* Os anexos que o leitor guardou ficam no Drive da conta dele. */
const getFileOrig = g.DriveApp.getFileById;
g.DriveApp.getFileById = id => { try { return getFileOrig(id); } catch (e) { return SIM.leitor.DriveApp.getFileById(id); } };

g.listarEscolasCadastro_interno_ = () => [{ escola: "COLEGIO BETA LTDA", Fantasia: "Colégio Beta", cnpj: "11.222.333/0001-81",
  email: "rh@beta.exemplo.com", EmailsTodos: "", situacao: "ATIVA" }];
g.listarMensalidadeStatus = f => ({ ok: true, itens: f.escola === "COLEGIO BETA LTDA" ? [
  { nome: "ANA SOUZA", cpf: "11144477735", status: "CONFIRMADO" }, { nome: "CAIO REIS", cpf: "39053344705", status: "PENDENTE_30D" }] : [] });

const chamadas = [];
let leituraIA = () => ({ e_comprovante: true, tipo: "MENSALIDADE", escola: "Colégio Beta", mes: "10", ano: "2026", valor: "R$ 75,00",
  quantidade: 1, pessoas: [{ nome: "Ana Souza", cpf: "111.444.777-35" }] });
g.vpeChamarIA_ = (prompt, blocos) => {
  chamadas.push({ prompt, blocos: (blocos || []).length });
  if (/CASO:QUEBRA/.test(prompt)) throw new Error("IA fora do ar");
  if (/CASO:NAO/.test(prompt)) return { e_comprovante: false };
  return leituraIA();
};

/* A caixa da secretaria@: 12 comprovantes, 1 sem anexo, 1 de outro card, 1 que a IA não consegue. */
for (let i = 1; i <= 12; i++) SIM.novaThread("Comprovante " + i, "RH Beta <rh@beta.exemplo.com>", "Segue o comprovante de outubro. TIPO:FINANCEIRO", [SIM.pdf("comp" + i + ".pdf")]);
SIM.novaThread("Comprovante sem anexo", "RH Beta <rh@beta.exemplo.com>", "Segue o comprovante. TIPO:FINANCEIRO", []);
SIM.novaThread("Ficha de filiação", "Ana <ana@exemplo.com>", "Segue a ficha. TIPO:FILIACAO", [SIM.pdf("ficha.pdf")]);
SIM.ciclo();
const ponte = () => g.cxsLinhasPonte_();
const idPor = assunto => String(ponte().find(p => JSON.parse(p.MENSAGENS_JSON)[0].assunto === assunto).THREAD_ID);
const saidaAntes = SIM.aba("Saida").getLastRow();

b.fluxo("ROBÔ DOS COMPROVANTES · o servidor");
b.passo("1. Começa desligado; só administrador liga");
let r = g.crcRodar_();
b.ok(r.desligado && chamadas.length === 0, "desligado: não leu nada nem chamou a IA");
const e0 = g.caixaRoboComprovantesEstado(T_SEC);
b.ok(e0.ok && !e0.ligado && !e0.podeLigar, "a Marcelha vê o robô desligado e não tem o botão de ligar");
b.ok(!g.caixaRoboComprovantesLigar(true, T_SEC).ok, "a Marcelha (não administradora) não consegue ligar");
const lg = g.caixaRoboComprovantesLigar(true, TOKEN);
b.ok(lg.ok && lg.ligado && lg.agendado, "o Wanderson (administrador) liga", lg.mensagem);
const gat = g.ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "caixaRoboComprovantesRodar");
b.igual(gat.length, 1, "um agendamento só");
g.caixaRoboComprovantesLigar(true, TOKEN);
b.igual(g.ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "caixaRoboComprovantesRodar").length, 1, "ligar de novo não duplica o agendamento");

b.ok(g.caixaRoboComprovantesRodar() === undefined && g.caixaRoboComprovantesRodar({ triggerUid: "INVENTADO" }) === undefined &&
  chamadas.length === 0, "chamada pela tela (sem o id do gatilho, ou com id inventado): não lê nada, não devolve nada");
const n00 = chamadas.length;
g.caixaRoboComprovantesRodar({ triggerUid: gat[0].getUniqueId() });
b.ok(chamadas.length > n00, "chamada pelo gatilho de verdade: lê");
/* Volta ao começo para medir a primeira noite. */
ss.getSheetByName("Caixa_Comprovantes_Lidos").deleteRows(2, ss.getSheetByName("Caixa_Comprovantes_Lidos").getLastRow() - 1);
ss.getSheetByName("Contribuicao_Listas").deleteRows(2, ss.getSheetByName("Contribuicao_Listas").getLastRow() - 1);
chamadas.length = 0;

b.passo("2. A primeira noite: no máximo 10, só secretaria@, só Contribuições com PDF");
r = g.crcRodar_();
b.ok(r.ok, "rodou", r.mensagem);
b.igual([r.resultado.vistos, r.resultado.lidos, r.resultado.restam], [10, 10, 2], "leu 10, ficaram 2 para a próxima");
b.ok(chamadas.every(c => c.blocos === 1), "mandou o PDF para a IA em cada leitura");
const lidos = g.crcMapa_();
b.ok(!lidos[idPor("Comprovante sem anexo")] && !lidos[idPor("Ficha de filiação")], "não leu o e-mail sem anexo nem o de outro card");
b.igual(SIM.aba("Saida").getLastRow(), saidaAntes, "nenhuma resposta na fila de saída: nada sai");
const listas = ss.getSheetByName("Contribuicao_Listas").getDataRange().getValues();
b.ok(listas.length === 11 && listas.slice(1).every(l => String(l[3]) === "10/2026"), "as 10 listas foram para a Conferência mensal");

b.passo("3. A segunda noite: os 2 que sobraram; não relê o que já leu");
const n0 = chamadas.length;
r = g.crcRodar_();
b.igual([r.resultado.vistos, chamadas.length - n0, r.resultado.restam], [2, 2, 0], "leu só os 2 que faltavam");
r = g.crcRodar_();
b.igual(r.resultado.vistos, 0, "terceira noite: nada novo, nada lido");

b.passo("4. Mensagem nova na conversa: lê de novo");
const th1 = SIM.threads.find(t => t.assunto === "Comprovante 1" || (t.getFirstMessageSubject && t.getFirstMessageSubject() === "Comprovante 1"));
SIM.responder(th1 || SIM.threads[0], "RH Beta <rh@beta.exemplo.com>", "Corrigindo: segue o comprovante certo. TIPO:FINANCEIRO", [SIM.pdf("comp1b.pdf")]);
SIM.ciclo();
r = g.crcRodar_();
b.igual(r.resultado.vistos, 1, "releu só a conversa que teve mensagem nova");

b.passo("5. A IA falha: tenta de novo nas próximas noites, até 3 vezes, e mostra no rodapé");
SIM.novaThread("Comprovante ilegível", "RH Beta <rh@beta.exemplo.com>", "Segue. CASO:QUEBRA TIPO:FINANCEIRO", [SIM.jpg("foto.jpg")]);
SIM.ciclo();
const idQ = idPor("Comprovante ilegível");
for (let k = 0; k < 4; k++) g.crcRodar_();
b.igual(Number(g.crcMapa_()[idQ].TENTATIVAS), 3, "três tentativas e para");
const eF = g.caixaRoboComprovantesEstado(T_SEC);
b.ok(eF.falhas.some(f => f.id === idQ), "o rodapé mostra que não conseguiu ler este");
b.ok(eF.ultima && eF.ultima.em, "o rodapé mostra a última vez");

b.passo("6. Abrir o e-mail: a leitura guardada, sem gastar IA");
const id2 = idPor("Comprovante 2");
const n1 = chamadas.length;
const lc = g.caixaLerComprovante(id2, T_SEC);
b.ok(lc.ok && lc.comprovante && lc.comprovante.referencia === "10/2026" && chamadas.length === n1, "veio a leitura do robô, sem chamar a IA");
b.ok(lc.leitura.porRobo && lc.leitura.em, "diz que foi o robô e quando");
b.igual(lc.comprovante.faltaram, ["CAIO REIS"], "quem faltou");
const ld = g.caixaLerComprovante(id2, true, T_SEC);
b.ok(ld.ok && chamadas.length === n1 + 1 && !ld.leitura.porRobo, "\"Ler de novo\" chama a IA e fica no nome de quem pediu");

b.passo("7. Está certo / Corrigir: memória, lista da conferência, exemplo para a IA, acerto");
const id3 = idPor("Comprovante 3"), id4 = idPor("Comprovante 4");
b.ok(g.caixaComprovanteConferir(id3, { certo: true }, T_SEC).ok, "Está certo");
b.ok(!g.caixaComprovanteConferir(id4, { referencia: "13/2026" }, T_SEC).ok, "mês inválido: recusa");
const cr = g.caixaComprovanteConferir(id4, { referencia: "9/2026", tipo: "MENSALIDADE" }, T_SEC);
b.ok(cr.ok && cr.comprovante.referencia === "09/2026", "Corrigir para 09/2026", cr.mensagem);
const lst4 = ss.getSheetByName("Contribuicao_Listas").getDataRange().getValues().filter(l => String(l[5]) === id4);
b.ok(lst4.length === 1 && String(lst4[0][3]) === "09/2026", "a lista da Conferência mensal passou a valer como 09/2026");
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues();
const cab = mem[0].map(String);
const conf = mem.filter(l => l[cab.indexOf("TAREFA")] === "comprovante-conferido");
b.igual(conf.map(l => l[cab.indexOf("ACERTOU")]), ["SIM", "NAO"], "a memória do robô: um acerto, um erro");
const eA = g.caixaRoboComprovantesEstado(T_SEC);
b.igual([eA.acerto.ok, eA.acerto.n], [1, 2], "o acerto aparece: 1 de 2 conferidos");
b.ok(g.pddRobo_("SECRETARIA").some(t => t.tarefa === "comprovante-conferido" && t.pct === 50), "e entra na medição do robô no rodapé (50%)");
g.caixaLerComprovante(idPor("Comprovante 5"), true, T_SEC);
b.ok(/a equipe corrigiu para 09\/2026/.test(chamadas[chamadas.length - 1].prompt), "a correção volta como exemplo no pedido à IA");
const reaberto = g.caixaLerComprovante(id4, T_SEC);
b.ok(reaberto.comprovante.referencia === "09/2026" && reaberto.leitura.conferido === "CORRIGIDO", "reabrir mostra a leitura corrigida");

b.passo("8. Cada um com a sua caixa; desligar tira o agendamento");
g.cxsMeuPapel_ = s => (String(s.email) === "secretaria@sindeducacao.com" ? "SECRETARIA" : "FINANCEIRO");
b.ok(!g.caixaComprovanteConferir(id3, { certo: true }, TOKEN).ok, "o financeiro@ não confere comprovante da secretaria@");
const dl = g.caixaRoboComprovantesLigar(false, TOKEN);
b.ok(dl.ok && !dl.ligado && !dl.agendado, "desligou e tirou o agendamento");
delete g.cxsMeuPapel_;
b.ok(g.crcRodar_().desligado, "desligado: a rotina não lê");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: T_SEC });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("ROBÔ DOS COMPROVANTES · a tela");
  win.cxsIniciar(); await t.assentar(300);
  b.ok(/Robô dos comprovantes/.test(t.texto("#cxsRoboComp")) && /Desligado/.test(t.texto("#cxsRoboComp")), "o rodapé mostra o robô desligado", t.texto("#cxsRoboComp").slice(0, 120));
  b.ok(!doc.querySelector("[data-cxs='roboComp']"), "para a Marcelha, sem botão de ligar");
  el("cxsFEstado").value = ""; el("cxsFEstado").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(30);
  const id6 = idPor("Comprovante 6");
  const leiturasComp = () => chamadas.filter(c => /lê comprovantes de desconto/.test(c.prompt)).length;
  const n2 = leiturasComp();
  t.clicar("[data-cxs='abrir'][data-arg='" + id6 + "']"); await t.assentar(300);
  b.ok(/Lido pelo robô/.test(t.texto("#cxsMComprovante")) && leiturasComp() === n2, "abrir mostra \"Lido pelo robô\", sem chamar a IA", t.texto("#cxsMComprovante").slice(0, 160));
  t.clicar("[data-cxs='compCorrigir']"); await t.assentar(20);
  el("cxsMCompRef").value = "08/2026";
  t.clicar("[data-cxs='compSalvar']"); await t.assentar(200);
  b.ok(/Corrigido/.test(t.texto("#cxsMComprovante")) && /08\/2026/.test(t.texto("#cxsMComprovante")), "corrigiu pela tela", t.texto("#cxsMComprovante").slice(0, 200));
  b.ok(g.crcMapa_()[id6].CONFERIDO === "CORRIGIDO", "ficou gravado");
  b.naoTestavel("o agendamento disparar às 20h de verdade", "ver em HML no dia seguinte");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
