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
aba.appendRow(["rhzinho", hash("Senha@2026"), "Só RH", "rh@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "rh"]);
const T_ADM = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha"), T_TUDO = b.logar(g, "tudo"), T_FIN = b.logar(g, "fin"), T_RH = b.logar(g, "rhzinho");
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
b.passo("1. Abre para Secretaria, Financeiro e administrador (regra de 30/10/2026); não para quem só tem outros módulos");
b.ok(g.caixaSecretariaPainel(T_ADM).ok, "administrador abre");
b.ok(g.caixaSecretariaPainel(T_SEC).ok, "a Secretaria abre");
b.ok(g.caixaSecretariaPainel(T_FIN).ok, "o Financeiro abre (usuário: 'se tiver categorizado, não tem problema')");
b.ok(g.caixaSecretariaPainel(T_TUDO).ok, "quem tem todos os módulos abre");
const rRh = g.caixaSecretariaPainel(T_RH);
b.ok(!rRh.ok, "quem só tem RH NÃO abre", rRh.mensagem);
b.ok(!g.caixaSecretariaDetalhe(thFil.id, T_RH).ok, "nem a conversa pelo número");
b.ok(!g.caixaSecretariaResponder(thFil.id, "tentativa de resposta por quem não pode", T_RH).ok, "nem responde");
b.ok(!g.caixaSecretariaAnexo(thFil.id, 0, T_RH).ok, "nem abre anexo");
b.igual(g.caixaSecretariaPodeAbrir(T_RH).pode, false, "a tela sabe que não pode (para mostrar o aviso)");
aba.appendRow(["marcela2", hash("Senha@2026"), "Marcela (só benefícios)", "secretaria@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios"]);
b.ok(g.caixaSecretariaPainel(b.logar(g, "marcela2")).ok, "o usuário com o e-mail secretaria@ abre sempre");

b.fluxo("CAIXA DA SECRETARIA · categorizado");
b.passo("2. Cada e-mail com o seu tipo; propaganda de fora");
const pn = g.caixaSecretariaPainel(T_SEC);
const tipoDe = th => (pn.itens.find(i => i.id === th.id) || {}).tipo;
b.igual(tipoDe(thFil), "FILIACAO", "desfiliação → Filiação");
b.igual(tipoDe(thEsc), "FINANCEIRO", "relação da escola → Escolas: contribuições (categorias de 30/10/2026)");
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
b.ok(/^https:\/\/drive\.google\.com\/file\/d\/.+\/view$/.test(an.driveUrl), "com o link do Drive (para quando a prévia não abrir)", an.driveUrl);
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

b.fluxo("CAIXA DA SECRETARIA · a assinatura é de quem está logado (30/10/2026)");
b.passo("7. Marcela assina como Secretaria; Wanderson como Financeiro; nunca duas assinaturas");
const dSec = g.caixaSecretariaDetalhe(thGuia.id, T_SEC);
b.ok(/Marcelha Aline/.test(dSec.sugestao) && /Secretaria/.test(dSec.sugestao) && !/Wanderson/.test(dSec.sugestao),
  "logada a Marcela: assinatura da Secretaria");
const dAdm = g.caixaSecretariaDetalhe(thGuia.id, T_ADM);
b.ok(/Wanderson N Castelo/.test(dAdm.sugestao) && /Financeiro/.test(dAdm.sugestao) && !/Marcelha/.test(dAdm.sugestao),
  "logado o Wanderson: assinatura do Financeiro");
const fila0 = g.vpeLinhas_(SIM.aba("Saida")).length;
g.caixaSecretariaResponder(thGuia.id, dAdm.sugestao.replace("Tudo bem?", "Tudo bem? Segue a orientação sobre a guia."), T_ADM);
const html = g.vpeLinhas_(SIM.aba("Saida")).slice(fila0).pop().HTML;
b.igual((html.match(/Wanderson N Castelo/g) || []).length, 1, "o e-mail sai com UMA assinatura");
b.ok(!/Marcelha/.test(html), "e não leva a da Marcela junto");
g.caixaSecretariaResponder(thEsc.id, "Olá! Recebemos a planilha, obrigado.", T_SEC);
const html2 = g.vpeLinhas_(SIM.aba("Saida")).pop().HTML;
b.ok(/Marcelha Aline/.test(html2), "texto sem assinatura: o rodapé de quem está logado entra sozinho");

b.naoTestavel("a tela no navegador", "jsdom testa a tela em t216");
b.resumo();
