/**
 * CATEGORIA VOUCHER NA MÃO + MEMÓRIA DO ROBÔ — 30/10/2026.
 *
 * O usuário: "tudo que for voucher, quando eu clicar ver, ele tem que ir
 * para aquela tela do voucher"; e "esse robô ... é como se fosse um
 * funcionário meu ... preciso que ele aprenda, tenha memória evolutiva".
 * Backend real, leitor real (vpe-simulador), tela real (jsdom), Gmail do
 * Financeiro FALSO, dados FICTÍCIOS.
 *
 * Prova: mudar um e-mail da Secretaria para Voucher faz dele um pedido (a
 * IA lê os documentos) e a conferência abre; a correção fica na memória do
 * robô e vira exemplo que o leitor manda à IA; no Financeiro, o que a
 * equipe decidiu para um remetente vale para o próximo e-mail dele; voucher
 * que chegou no Financeiro vai encaminhado à Secretaria só com o clique;
 * quem não tem Benefícios não transforma em voucher.
 *
 * NÃO PROVA: a IA de verdade seguindo os exemplos (aqui a IA é simulada);
 * a entrega do encaminhamento.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["comu", g.gerarHashSenha_("Senha@2026"), "Só Comunicação", "comu@sindeducacao.com",
  "USUARIO", "ATIVO", "NAO", "comunicacao"]);
const TOKEN = b.logar(g, "wanderson"), T_COMU = b.logar(g, "comu");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
shA.appendRow(["11144477735", "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
SIM.EXTRACOES.ANA = SIM.base({ titular: { nome: "Ana Maria Souza", cpf: "11144477735" },
  anexos: [SIM.CC("ANA MARIA SOUZA", "11144477735", "09/2026", "COLEGIO ALFA"), SIM.RG(2, "ANA MARIA SOUZA", "11144477735")] });
/* A IA do leitor errou: um pedido escrito sem a palavra "voucher". */
const thAna = SIM.novaThread("Documentos para o desconto do meu curso", "Ana <ana@exemplo.com>",
  "Segue meu contracheque e RG para o desconto de Pedagogia. TIPO:OUTRO CASO:ANA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
SIM.ciclo();

/* Gmail da financeiro@, falso. */
let seq = 0; const encaminhados = [];
function msg(de, assunto, corpo) {
  const id = "FM" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
    getSubject: () => assunto, getDate: () => new Date(Date.now() - seq * 60000), getPlainBody: () => corpo,
    getAttachments: () => [], reply: () => {}, forward: (para, op) => encaminhados.push({ id, para, op }) };
}
const T = [{ id: "a1", msgs: [msg("Escola Zeta <dp@zeta.exemplo.com>", "Planilha de outubro", "Segue a planilha.")] },
           { id: "a2", msgs: [msg("Rui <rui@exemplo.com>", "Bolsa para meu filho", "Quero o desconto da bolsa.")] }];
const fake = {
  search: () => T.map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; }
};
g.cxsGmailFinanceiro_ = () => fake;
const limparCache = () => g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const memoria = () => {
  const v = ss.getSheetByName("Robo_Memoria").getDataRange().getValues();
  return v.slice(1).map(l => Object.fromEntries(v[0].map((c, i) => [String(c), l[i]])));
};

const painelTudo = tk => {
  const p = g.caixaSecretariaPainel(tk), f = g.caixaFinanceiroItens(tk);
  p.itens = p.itens.concat(f.itens || []);
  p.porCaixa = Object.assign({}, p.porCaixa, { FINANCEIRO: (f.itens || []).filter(i => i.estado !== "RESOLVIDO").length });
  p.erroFinanceiro = f.ok ? "" : f.mensagem;
  return p;
};
b.fluxo("VOUCHER NA MÃO · Secretaria");
b.passo("1. A IA errou: o pedido da Ana caiu na Caixa como 'Outro'");
let p = painelTudo(TOKEN);
const itAna = p.itens.find(i => i.id === thAna.id);
b.ok(itAna && itAna.fonte === "EMAIL" && itAna.tipo === "OUTRO", "está na Caixa como Outro", JSON.stringify(itAna && itAna.tipo));
b.ok(p.tipos.some(t => t.chave === "VOUCHER"), "'Voucher' está entre as categorias para escolher");

b.passo("2. Quem só tem Comunicação não transforma em voucher");
const rC = g.caixaSecretariaReclassificar(thAna.id, "VOUCHER", T_COMU);
b.ok(!rC.ok || !rC.pedidoId, "não vira pedido", rC.mensagem);
b.ok(!g.vpeLinhas_().some(r => r.THREAD_ID === thAna.id), "nenhum pedido criado");

b.passo("3. Mudar para Voucher: vira pedido na hora, a IA lê os documentos");
const r = g.caixaSecretariaReclassificar(thAna.id, "VOUCHER", TOKEN);
b.ok(r.ok && r.pedidoId, "virou pedido", r.mensagem);
const ped = g.vpeLinhas_().find(x => x.THREAD_ID === thAna.id);
b.ok(ped && ped.ID_PEDIDO === r.pedidoId && ped.ESTADO !== "IGNORADO", "o pedido existe e não foi descartado pela peneira",
  ped && ped.ESTADO);
b.igual(ped && ped.ESTADO, "PRONTO", "com os documentos lidos, está pronto para conferir");
b.ok(SIM.aba("Caixa").getDataRange().getValues().some(l => l[0] === thAna.id), "a linha da Caixa continua guardada (nada se apaga)");
b.ok(SIM.aba("Entrada").getDataRange().getValues().some(l => l[0] === thAna.id), "e entrou na Entrada (onde moram os vouchers)");
p = painelTudo(TOKEN);
b.ok(p.itens.some(i => i.fonte === "VOUCHER" && i.id === r.pedidoId) && !p.itens.some(i => i.id === thAna.id),
  "na lista ela aparece uma vez só, como voucher");

b.passo("4. A memória do robô guardou a correção — e o leitor usa");
const mAna = memoria().filter(m => m.CHAVE === thAna.id && m.QUEM === "wanderson@sindeducacao.com").pop() ||
  memoria().filter(m => m.CHAVE === thAna.id).pop();
b.ok(mAna && mAna.SUGERIDO === "OUTRO" && mAna.DECIDIDO === "VOUCHER" && mAna.ACERTOU === "NAO" && mAna.REMETENTE === "ana@exemplo.com",
  "sugerido Outro, decidido Voucher, errou", JSON.stringify(mAna));
const ex = SIM.aba("Exemplos");
b.ok(ex && ex.getLastRow() >= 2, "virou exemplo na ponte, para o leitor");
SIM.novaThread("Outra dúvida", "Beto <beto@exemplo.com>", "Bom dia, tenho uma dúvida. TIPO:OUTRO");
SIM.ciclo();
const ult = SIM.chamadasIALeitor[SIM.chamadasIALeitor.length - 1];
b.ok(ult && /Correções feitas pela equipe/.test(ult.prompt) && /Documentos para o desconto/.test(ult.prompt) && /→ VOUCHER/.test(ult.prompt),
  "a próxima pergunta à IA leva o exemplo da equipe");

b.passo("5. Mensagem nova da Ana vai para o pedido, não volta para a Caixa");
SIM.responder(thAna, "ana@exemplo.com", "Esqueci: o curso é na UVV. CASO:ANA");
SIM.ciclo();
b.ok(!painelTudo(TOKEN).itens.some(i => i.fonte === "EMAIL" && i.id === thAna.id), "não voltou para a lista como e-mail comum");
b.ok(SIM.aba("Entrada").getDataRange().getValues().some(l => l[0] === thAna.id && /UVV/.test(String(l[4]))), "a mensagem nova foi para o pedido (Entrada)");

b.fluxo("MEMÓRIA · Financeiro");
b.passo("6. A equipe corrige o tipo de um remetente; o próximo e-mail dele já vem certo");
limparCache();
p = painelTudo(TOKEN);
b.igual(p.itens.find(i => i.id === "F:a1").tipo, "OUTRO", "a regra não soube (Outro)");
b.ok(g.caixaSecretariaReclassificar("F:a1", "OFICIO_ESCOLA", TOKEN).ok, "a equipe diz: é Escola");
T.push({ id: "a3", msgs: [msg("Escola Zeta <dp@zeta.exemplo.com>", "Mais uma planilha", "Segue outra.")] });
limparCache();
p = painelTudo(TOKEN);
b.igual(p.itens.find(i => i.id === "F:a3").tipo, "OFICIO_ESCOLA", "o próximo e-mail da Escola Zeta já vem como Escola");

b.passo("7. Voucher que chegou no Financeiro: encaminhado à Secretaria, só com o clique");
b.igual(encaminhados.length, 0, "nada encaminhado sozinho");
const rF = g.caixaSecretariaReclassificar("F:a2", "VOUCHER", TOKEN);
b.ok(rF.ok && /Secretaria/.test(rF.mensagem), "encaminhado", rF.mensagem);
b.ok(encaminhados.length === 1 && encaminhados[0].para === "secretaria@sindeducacao.com", "para a secretaria@");
limparCache();
b.igual(painelTudo(TOKEN).itens.find(i => i.id === "F:a2").estado, "RESOLVIDO", "e sai da lista de a tratar");

b.fluxo("MEMÓRIA · aprende com tudo o que é feito");
b.passo("8a. A resposta: o que o sistema sugeriu e o que saiu");
T.push({ id: "a4", msgs: [msg("Escola Teta <rh@teta.exemplo.com>", "Dúvida sobre o boleto", "Qual o vencimento?")] });
limparCache();
const dT = g.caixaSecretariaDetalhe("F:a4", TOKEN);
g.caixaSecretariaResponder("F:a4", dT.sugestao.replace("Tudo bem?", "Tudo bem? O vencimento é dia 10."), { sugerido: dT.sugestao }, TOKEN);
const mR = memoria().filter(m => m.TAREFA === "resposta-email" && m.CHAVE === "F:a4").pop();
b.ok(mR && mR.ACERTOU === "NAO" && /vencimento é dia 10/.test(mR.DECIDIDO) && mR.SUGERIDO && mR.TIPO_EMAIL,
  "guarda a sugestão, o texto enviado e o tipo do e-mail", JSON.stringify(mR && [mR.ACERTOU, mR.TIPO_EMAIL]));
b.passo("8b. Resolver também fica na memória");
g.caixaSecretariaMarcar("F:a1", "RESOLVIDO", "lançado", TOKEN);
b.ok(memoria().some(m => m.TAREFA === "situacao-email" && m.CHAVE === "F:a1" && /RESOLVIDO/.test(m.DECIDIDO)), "resolver ficou registrado");
b.passo("8c. Campo do voucher corrigido pela pessoa");
g.voucherPedidosSalvarCampos(r.pedidoId, { telefone: "27988887777" }, TOKEN);
const mC = memoria().filter(m => m.TAREFA === "voucher-campo:telefone").pop();
b.ok(mC && mC.DECIDIDO === "27988887777" && mC.ACERTOU === "NAO", "o que a IA leu e o que a pessoa corrigiu", JSON.stringify(mC && [mC.SUGERIDO, mC.DECIDIDO]));

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
/* Mais um pedido escondido como 'Outro', para a tela. */
const thBia = SIM.novaThread("Desconto do curso", "Bia <bia@exemplo.com>", "Segue documento. TIPO:OUTRO", [SIM.jpg("rg.jpg")]);
SIM.ciclo();
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("VOUCHER NA MÃO · a tela");
  b.passo("8. Escolher Voucher avisa o que vai acontecer; salvar abre a conferência");
  win.cxsIniciar(); await t.assentar(150);
  t.clicar("[data-cxs='abrir'][data-arg='" + thBia.id + "']"); await t.assentar(150);
  const sel = el("cxsMTipo");
  b.ok(Array.from(sel.options).some(o => o.value === "VOUCHER"), "'Voucher' na lista de categorias");
  sel.value = "VOUCHER"; sel.dispatchEvent(new win.Event("change", { bubbles: true }));
  b.ok(/vira pedido de voucher/.test(t.texto("#cxsMTipoAviso")), "avisa antes de salvar");
  t.clicar("[data-cxs='reclassificar']"); await t.assentar(250);
  b.ok(el("vpeModal").classList.contains("aberto"), "a conferência do voucher abriu");
  b.ok(!el("cxsModal").classList.contains("aberto"), "e a conversa fechou");
  b.ok(/Bia/i.test(t.texto("#vpeMTitulo")) || /bia@exemplo/i.test(t.texto("#vpeMSub")), "com o pedido da Bia",
    t.texto("#vpeMTitulo") + " | " + t.texto("#vpeMSub"));

  b.passo("9. Arrastar o e-mail para o card da categoria certa");
  win.VPE.fechar && win.VPE.fechar();
  win.cxsIniciar(); await t.assentar(200);
  const item = doc.querySelector("[data-arrastar='F:a3']");
  b.ok(item && item.getAttribute("draggable") === "true", "o e-mail pode ser arrastado");
  b.ok(!doc.querySelector("[data-arrastar='" + r.pedidoId + "']"), "voucher não se arrasta (já está no lugar dele)");
  item.dispatchEvent(new win.Event("dragstart", { bubbles: true }));
  const card = doc.querySelector("#cxsTipos [data-cxs='filtrarTipo'][data-arg='FINANCEIRO']");
  card.dispatchEvent(new win.Event("dragover", { bubbles: true, cancelable: true }));
  b.ok(card.classList.contains("alvo"), "o card acende ao passar por cima");
  card.dispatchEvent(new win.Event("drop", { bubbles: true, cancelable: true }));
  await t.assentar(200);
  b.igual(painelTudo(TOKEN).itens.find(i => i.id === "F:a3").tipo, "FINANCEIRO", "soltou no Financeiro: mudou");
  b.ok(memoria().some(m => m.TAREFA === "categoria-email" && m.CHAVE === "F:a3" && m.DECIDIDO === "FINANCEIRO"), "e o robô guardou");

  b.naoTestavel("arrastar com o mouse de verdade", "jsdom dispara o evento; o gesto só no navegador");
  b.naoTestavel("a IA de verdade seguindo os exemplos", "a IA aqui é simulada");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
