/**
 * CAIXA DA SECRETARIA NO SISGEP — 29/10/2026.
 *
 * Regra mudada pelo usuário: todos os e-mails da Secretaria, categorizados,
 * dentro do SISGEP — abre SÓ a Secretaria e o administrador. Backend real,
 * leitor real (vpe-simulador), dados FICTÍCIOS.
 *
 * Prova: a trava (inclusive para usuário com "todos os módulos"); o painel
 * por tipo; a conversa e o anexo; responder só com clique e só como
 * resposta; resolvido volta a novo com mensagem nova; a correção de tipo
 * fica registrada.
 *
 * NÃO PROVA: a tela no navegador, a entrega do e-mail, a qualidade da IA.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const aba = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
const hash = s => g.gerarHashSenha_(s);
aba.appendRow(["marcelha", hash("Senha@2026"), "Marcelha", "secretaria@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios,caixaSecretaria"]);
aba.appendRow(["tudo", hash("Senha@2026"), "Usuário com todos os módulos", "tudo@sindeducacao.com", "USUARIO", "ATIVO", "NAO", ""]);
aba.appendRow(["fin", hash("Senha@2026"), "Financeiro", "financeiro@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "financeiro,beneficios"]);
const T_ADM = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha"), T_TUDO = b.logar(g, "tudo"), T_FIN = b.logar(g, "fin");
g.setupVoucherModuleFase1();

const SIM = require("./vpe-simulador").instalar(g, amb);
const { novaThread, responder } = SIM;
const thFil = novaThread("Quero me desfiliar", "João <joao@exemplo.com>", "Bom dia, quero cancelar minha filiação. TIPO:FILIACAO",
  [SIM.pdf("carta.pdf")]);
const thEsc = novaThread("Relação de descontos", "rh@colegio.exemplo.com", "Segue a relação do mês. TIPO:OFICIO_ESCOLA");
const thGuia = novaThread("Segunda via da guia", "contador@escola.exemplo.com", "Preciso da guia de outubro. TIPO:FINANCEIRO");
const thProp = novaThread("Promoção", "Loja <ofertas@loja.exemplo.com>", "50% off! TIPO:PROPAGANDA");
SIM.ciclo();

b.fluxo("CAIXA DA SECRETARIA · a trava");
b.passo("1. Abre só Secretaria e administrador");
b.ok(g.caixaSecretariaPainel(T_ADM).ok, "administrador abre");
b.ok(g.caixaSecretariaPainel(T_SEC).ok, "a Secretaria (com Caixa da Secretaria liberada) abre");
const rT = g.caixaSecretariaPainel(T_TUDO);
b.ok(!rT.ok && /só para a Secretaria/.test(rT.mensagem), "usuário com 'todos os módulos' NÃO abre", rT.mensagem);
b.ok(!g.caixaSecretariaPainel(T_FIN).ok, "o Financeiro NÃO abre");
aba.appendRow(["marcela2", hash("Senha@2026"), "Marcela (todos os módulos)", "secretaria@sindeducacao.com", "USUARIO", "ATIVO", "NAO", ""]);
b.ok(g.caixaSecretariaPainel(b.logar(g, "marcela2")).ok, "o usuário com o e-mail secretaria@ abre, mesmo sem liberar o módulo");
b.ok(!g.caixaSecretariaDetalhe(thFil.id, T_FIN).ok, "nem a conversa pelo número");
b.ok(!g.caixaSecretariaResponder(thFil.id, "tentativa de resposta pelo financeiro", T_FIN).ok, "nem responde");
b.ok(!g.caixaSecretariaAnexo(thFil.id, 0, T_TUDO).ok, "nem abre anexo");
b.igual(g.caixaSecretariaPodeAbrir(T_FIN).pode, false, "a tela sabe que não pode (para mostrar o aviso)");

b.fluxo("CAIXA DA SECRETARIA · categorizado");
b.passo("2. Cada e-mail com o seu tipo; propaganda de fora");
const pn = g.caixaSecretariaPainel(T_SEC);
const tipoDe = th => (pn.itens.find(i => i.id === th.id) || {}).tipo;
b.igual(tipoDe(thFil), "FILIACAO", "desfiliação → Filiação");
b.igual(tipoDe(thEsc), "OFICIO_ESCOLA", "relação da escola → Escola");
b.igual(tipoDe(thGuia), "FINANCEIRO", "guia → Financeiro");
b.ok(!pn.itens.some(i => i.id === thProp.id), "propaganda não aparece");
b.igual(pn.porTipo.FILIACAO, 1, "contagem por tipo");
b.igual(pn.porEstado.NOVO, 3, "três novos");

b.passo("3. A conversa inteira e o anexo");
const d = g.caixaSecretariaDetalhe(thFil.id, T_SEC);
b.ok(d.ok && d.mensagens.some(m => /cancelar minha filia/.test(m.corpo)), "a mensagem do João");
b.igual(d.anexos.length, 1, "um anexo listado");
const an = g.caixaSecretariaAnexo(thFil.id, 0, T_SEC);
b.ok(an.ok && /^data:/.test(an.dataUrl), "o anexo abre");
b.ok(/Olá, João!/.test(d.sugestao) && /Marcelha Aline/.test(d.sugestao), "a resposta vem com saudação e assinatura, para editar");

b.fluxo("CAIXA DA SECRETARIA · responder");
b.passo("4. Responder entra na fila e o leitor envia como resposta ao João");
const out0 = amb.outbox.length;
const r4 = g.caixaSecretariaResponder(thFil.id, "Olá, João! Recebemos seu pedido de desfiliação e vamos processar.", T_SEC);
b.ok(r4.ok, "na fila", r4.mensagem);
b.igual(amb.outbox.length, out0, "o SISGEP não enviou nada sozinho — foi para a fila");
SIM.ciclo();
b.ok(amb.outbox.slice(out0).some(m => m.via === "reply" && m.to === "joao@exemplo.com"), "o leitor enviou, como resposta");
const pn4 = g.caixaSecretariaPainel(T_SEC);
b.igual(pn4.itens.find(i => i.id === thFil.id).estado, "RESPONDIDO", "fica 'respondido'");
b.ok(!g.caixaSecretariaResponder(thFil.id, "oi", T_SEC).ok, "resposta vazia/curta não sai");

b.passo("5. Resolvido; e mensagem nova faz voltar para novo");
b.ok(g.caixaSecretariaMarcar(thEsc.id, "RESOLVIDO", "Lançado no financeiro", T_SEC).ok, "marcou resolvido");
b.igual(g.caixaSecretariaPainel(T_SEC).itens.find(i => i.id === thEsc.id).estado, "RESOLVIDO", "resolvido");
responder(thEsc, "rh@colegio.exemplo.com", "Esqueci de mandar a planilha, segue agora.");
SIM.ciclo();
const iEsc = g.caixaSecretariaPainel(T_SEC).itens.find(i => i.id === thEsc.id);
b.ok(iEsc.estado === "NOVO" && iEsc.mensagemNova, "voltou para novo, avisando que chegou mensagem nova");

b.passo("6. A IA errou o tipo: a pessoa corrige, e fica registrado");
b.ok(g.caixaSecretariaReclassificar(thGuia.id, "OUTRO", T_SEC).ok, "corrigiu");
b.igual(g.caixaSecretariaPainel(T_SEC).itens.find(i => i.id === thGuia.id).tipo, "OUTRO", "o tipo novo vale");
const est = g.vpeLinhas_(ss.getSheetByName("Caixa_Secretaria")).find(r => r.THREAD_ID === thGuia.id);
const corr = JSON.parse(est.CORRECOES_JSON || "[]").pop();
b.ok(corr && corr.deTipo === "FINANCEIRO" && corr.paraTipo === "OUTRO" && corr.por, "registro: de, para e quem", JSON.stringify(corr));

b.naoTestavel("a tela no navegador", "jsdom testa a tela em t216");
b.resumo();
