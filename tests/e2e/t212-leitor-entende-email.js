/**
 * O LEITOR DA SECRETARIA ENTENDE O QUE É CADA E-MAIL — 29/10/2026.
 *
 * O caso real: a primeira versão separava por palavra e copiou para a ponte
 * (que o Financeiro lê) propaganda da Leroy Merlin, Sam's Club, TikTok —
 * tudo tem "desconto". O usuário: "o leitor tem que entender o que está
 * sendo solicitado", "tem que entender o que é cada email".
 *
 * O LEITOR É O DE VERDADE (LeitorSecretaria.gs.txt), num contexto separado,
 * como no ar. A IA é simulada; o que se prova é o que o leitor FAZ com a
 * resposta dela, não a qualidade da leitura (isso só no ar).
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
const SIM = require("./vpe-simulador").instalar(g, amb);
const { novaThread, EXTRACOES, base, pdf } = SIM;
const L = SIM.leitor;
const entrada = () => L.leitorLinhas_(SIM.aba("Entrada"));
const vistos = () => L.leitorLinhas_(SIM.aba("Vistos"));
const naPonte = th => entrada().some(r => String(r.THREAD_ID) === th.id);
const pedidoDa = th => g.vpeLinhas_().find(r => r.THREAD_ID === th.id);

b.fluxo("LEITOR · entende cada e-mail antes de copiar");

b.passo("1. A busca já deixa de fora as abas de propaganda do Gmail");
SIM.ciclo();
const q = SIM.consultas[SIM.consultas.length - 1] || "";
["promotions", "social", "updates", "forums"].forEach(c =>
  b.ok(q.indexOf("-category:" + c) > -1, "exclui a aba " + c, q));

b.passo("2. Propaganda, notificação e outros assuntos NÃO saem da caixa");
const thLeroy = novaThread("Só hoje: 30% de desconto", "Leroy Merlin <reply-abc.70269@exclusivo.leroymerlin.com.br>",
  "Desconto em toda a loja, curso de pintura grátis!");
const thLista = novaThread("Novidades da semana", "Loja Exemplo <contato@loja.exemplo.com>",
  "Ofertas imperdíveis de desconto. Clique aqui.");
thLista.msgs[0].getHeader = h => (h === "List-Unsubscribe" ? "<mailto:sair@loja.exemplo.com>" : "");
const thCurso = novaThread("Pós-graduação com 50% de desconto", "Faculdade Venda <comercial@fac.exemplo.com>",
  "Matrícula aberta, desconto na mensalidade do curso de graduação! TIPO:PROPAGANDA");
const thFiliacao = novaThread("Quero me desfiliar", "joao@exemplo.com",
  "Bom dia, quero cancelar minha filiação ao sindicato. TIPO:FILIACAO");
const thVoucher = novaThread("Voucher 2027/1", "ana@exemplo.com",
  "Bom dia, quero o voucher de Pedagogia para 2027/1. CASO:ANA", [pdf("contracheque.pdf")]);
EXTRACOES.ANA = base({});
SIM.chamadasIALeitor.length = 0;
SIM.ciclo();

b.ok(!naPonte(thLeroy), "Leroy Merlin (remetente reply-…) não foi copiada");
b.ok(!naPonte(thLista), "boletim com cabeçalho de descadastro não foi copiado");
b.ok(!naPonte(thCurso), "propaganda de faculdade, que fala em desconto e graduação, não foi copiada");
b.ok(!naPonte(thFiliacao), "pedido de desfiliação (outro assunto da Secretaria) não foi copiado");
b.ok(naPonte(thVoucher), "o pedido de voucher FOI copiado");
const perguntadas = SIM.chamadasIALeitor.map(c => c.texto).join(" | ");
b.ok(perguntadas.indexOf("30% de desconto") === -1, "a Leroy Merlin nem chegou à IA (peneira de automáticos)");
b.ok(perguntadas.indexOf("Ofertas imperdíveis") === -1, "o boletim também não");
b.ok(/Pós-graduação com 50%/.test(perguntadas), "a propaganda que parece pedido foi para a IA, que a reconheceu");

b.passo("3. O que não é voucher fica só com o número da conversa");
const v = vistos();
[thLeroy, thLista, thCurso].forEach(th =>
  b.ok(v.some(r => String(r.THREAD_ID) === th.id), "em Vistos: " + th.assunto));
/* 29/10/2026: o que é assunto da Secretaria (e não propaganda/automático)
   vai para a CAIXA DA SECRETARIA, com o tipo. */
const caixaL = () => SIM.leitor.leitorLinhas_(SIM.leitor.leitorAba_(SIM.leitor.leitorPonte_(), "Caixa"));
const cFil = caixaL().find(r => String(r.THREAD_ID) === thFiliacao.id);
b.ok(cFil && cFil.TIPO === "FILIACAO", "a desfiliação foi para a Caixa da Secretaria, com o tipo FILIACAO", cFil && cFil.TIPO);
b.ok(!caixaL().some(r => [thLeroy.id, thLista.id, thCurso.id].indexOf(String(r.THREAD_ID)) > -1),
  "propaganda e boletim não vão para a Caixa");
const colunasVistos = Object.keys(v[0] || {}).filter(k => k !== "__linha").sort().join(",");
b.igual(colunasVistos, "THREAD_ID,ULTIMA_MENSAGEM_ID,VISTO_EM", "e Vistos não guarda assunto, remetente, texto nem tipo");

b.passo("4. Cada e-mail ganha a etiqueta do que ele é — no Gmail da Secretaria");
b.ok(thFiliacao.etiquetas.some(e => /SISGEP\/Filia/.test(e)), "desfiliação: SISGEP/Filiação…", thFiliacao.etiquetas.join(","));
b.ok(thCurso.etiquetas.some(e => /SISGEP\/Propaganda/.test(e)), "propaganda de faculdade: SISGEP/Propaganda", thCurso.etiquetas.join(","));
b.ok(thLeroy.etiquetas.some(e => /SISGEP\/Notifica/.test(e)), "Leroy Merlin: SISGEP/Notificação automática", thLeroy.etiquetas.join(","));
b.ok(thVoucher.etiquetas.some(e => /SISGEP\/Voucher/.test(e)), "voucher: SISGEP/Voucher…", thVoucher.etiquetas.join(","));

b.passo("5. O SISGEP só vê o voucher");
g.vpeLerCaixa_({});
b.ok(!!pedidoDa(thVoucher), "o pedido de voucher aparece no SISGEP");
[thLeroy, thLista, thCurso, thFiliacao].forEach(th => b.ok(!pedidoDa(th), "não aparece no SISGEP: " + th.assunto));

b.fluxo("LEITOR · IA fora do ar (sem crédito)");
b.passo("6. Sem IA, nada é copiado e nada é dado como visto — tenta de novo depois");
SIM.estadoIALeitor.fora = true;
const thNovo = novaThread("Bolsa de estudos", "bia@exemplo.com", "Gostaria da bolsa para Enfermagem. CASO:BIA");
SIM.ciclo();
b.ok(!naPonte(thNovo), "não copiou");
b.ok(!vistos().some(r => String(r.THREAD_ID) === thNovo.id), "e não marcou como visto");
SIM.estadoIALeitor.fora = false;
SIM.ciclo();
b.ok(naPonte(thNovo), "a IA voltou: no ciclo seguinte o pedido foi copiado");

b.fluxo("LEITOR · limpeza do que a versão antiga copiou");
b.passo("7. Cópias antigas de propaganda saem da ponte, com os anexos, e do SISGEP");
/* A ponte como a versão antiga deixou: propaganda copiada com anexo. */
const pasta = L.DriveApp.getFolderById(L.PropertiesService.getScriptProperties().getProperty("PASTA_ID"));
const anexoVelho = pasta.createFile(SIM.pdf("folheto.pdf"));
L.leitorGravar_(SIM.aba("Entrada"), {
  THREAD_ID: "T-ANTIGA-1", ULTIMA_MENSAGEM_ID: "M-ANTIGA-1", CAIXA: "SECRETARIA", ATUALIZADO_EM: new Date(),
  MENSAGENS_JSON: JSON.stringify([{ id: "M-ANTIGA-1", de: "Sam's Club <noreply@email.samsclub.com.br>",
    para: "secretaria@sindeducacao.com", assunto: "Ofertas com desconto", data: new Date().toISOString(),
    corpo: "Desconto em eletrônicos" }]),
  ANEXOS_JSON: JSON.stringify([{ msgId: "M-ANTIGA-1", pos: 0, nome: "folheto.pdf", tipo: "application/pdf",
    tamanho: 10, fileId: anexoVelho.getId() }])
});
L.leitorGravar_(SIM.aba("Entrada"), {
  THREAD_ID: "T-ANTIGA-2", ULTIMA_MENSAGEM_ID: "M-ANTIGA-2", CAIXA: "SECRETARIA", ATUALIZADO_EM: new Date(),
  MENSAGENS_JSON: JSON.stringify([{ id: "M-ANTIGA-2", de: "Contabilidade <dp@contab.exemplo.com>",
    para: "secretaria@sindeducacao.com", assunto: "Homologação de rescisão", data: new Date().toISOString(),
    corpo: "Precisamos agendar a homologação. TIPO:JURIDICO" }]),
  ANEXOS_JSON: "[]"
});
/* O SISGEP já tinha lido essas duas (como na tela do usuário). */
g.vpeGravar_({ ID_PEDIDO: g.vpeNovoId_(), THREAD_ID: "T-ANTIGA-1", ESTADO: "PRECISA_VOCE",
  REMETENTE_EMAIL: "noreply@email.samsclub.com.br", REMETENTE_NOME: "Sam's Club", ASSUNTO: "Ofertas com desconto",
  ERRO: "credit balance is too low" });
g.vpeGravar_({ ID_PEDIDO: g.vpeNovoId_(), THREAD_ID: "T-ANTIGA-2", ESTADO: "PRECISA_VOCE",
  REMETENTE_EMAIL: "dp@contab.exemplo.com", REMETENTE_NOME: "Contabilidade", ASSUNTO: "Homologação de rescisão" });

b.passo("8. Com a IA fora do ar, a limpeza PARA sem apagar nada");
SIM.estadoIALeitor.fora = true;
const antesLimpeza = entrada().length;
L.leitorLimparCopiasIndevidas();
/* A do Sam's Club é automática (noreply) e não precisa da IA; a da
   contabilidade precisa — então ela fica. Apagar só depois de decidir. */
b.ok(entrada().some(r => r.THREAD_ID === "T-ANTIGA-2"), "a que dependia da IA continua na ponte");
b.ok(!entrada().some(r => r.THREAD_ID === "T-ANTIGA-1"), "mas a do Sam's Club (noreply) saiu mesmo sem IA");
b.ok(naPonte(thVoucher), "e os pedidos de voucher não foram tocados");
SIM.estadoIALeitor.fora = false;

const r = L.leitorLimparCopiasIndevidas();
b.ok(!entrada().some(r => r.THREAD_ID === "T-ANTIGA-1"), "Sam's Club saiu da ponte");
b.ok(!entrada().some(r => r.THREAD_ID === "T-ANTIGA-2"), "homologação (outro assunto) saiu da ponte");
b.ok(naPonte(thVoucher) && naPonte(thNovo), "os pedidos de voucher continuam");
b.ok(anexoVelho.trashed === true, "o anexo da propaganda foi para a lixeira do Drive da Secretaria");
b.ok(vistos().some(x => x.THREAD_ID === "T-ANTIGA-1"), "e a conversa ficou só como número em Vistos");
b.ok(r.removidas >= 1 && !r.iaFora, "a limpeza informa quantas saíram", JSON.stringify(r));
b.ok(antesLimpeza > entrada().length, "a ponte encolheu");

g.vpeLerCaixa_({});
const p1 = g.vpeLinhas_().find(x => x.THREAD_ID === "T-ANTIGA-1");
const p2 = g.vpeLinhas_().find(x => x.THREAD_ID === "T-ANTIGA-2");
b.igual(p1 && p1.ESTADO, "IGNORADO", "no SISGEP, a do Sam's Club virou IGNORADO");
b.ok(p1 && !p1.REMETENTE_EMAIL && !p1.ASSUNTO && !p1.ERRO, "sem remetente, assunto nem erro");
b.ok(p2 && p2.ESTADO === "IGNORADO" && !p2.ASSUNTO, "a da homologação também");
const painel = g.voucherPedidosPainel("SECRETARIA", TOKEN);
const nomes = JSON.stringify(painel);
b.ok(nomes.indexOf("Sam's Club") === -1 && nomes.indexOf("Homologação") === -1, "e nenhuma das duas aparece no painel");
b.ok(!!pedidoDa(thVoucher) && pedidoDa(thVoucher).ESTADO !== "IGNORADO", "o voucher continua no painel");

b.fluxo("LEITOR · pendentes das pastas importadas (CERTIFICADO 2026-2 / 2027-1)");
b.passo("9. Sem as etiquetas (importação não feita), não faz nada");
const L9 = L.leitorBuscarPendentesDasPastas_();
b.ok(L9.semEtiquetas, "sem etiquetas: nada a fazer");

b.passo("10. Copia só os pendentes das duas pastas — e nada da pasta EMITIDOS");
const antesPastas = entrada().length;
const thPend = SIM.pasta("CERTIFICADO 2027-1",
  novaThread("Certificado de bolsa 2027", "lucia@exemplo.com", "Bom dia, peço o certificado de bolsa para meu filho."));
const thResp = SIM.pasta("CERTIFICADO 2027-1",
  novaThread("Voucher 2027/1", "marcos@exemplo.com", "Quero o voucher de Direito."));
SIM.responder(thResp, "Marcelha <secretaria@sindeducacao.com>", "Segue o certificado.", [SIM.pdf("Voucher.pdf")]);
/* Caso do usuário: a Secretaria respondeu pedindo o contracheque que falta. */
const thFalta = SIM.pasta("CERTIFICADO 2027-1",
  novaThread("Voucher 2027/1 Direito", "carla@exemplo.com", "Peço o voucher de bolsa."));
SIM.responder(thFalta, "Marcelha <secretaria@sindeducacao.com>", "Falta o contracheque.");
const thPend2 = SIM.pasta("CERTIFICADO 2026-2",
  novaThread("Bolsa 2026/2", "rui@exemplo.com", "Ainda aguardo o certificado de bolsa."));
const thEmit = SIM.pasta("CERTIFICADOS 2026-2 - EMITIDOS",
  novaThread("Bolsa antiga", "ze@exemplo.com", "Pedido já atendido."));
/* Já copiado pelo caminho normal (depois de 21/10): mesma pessoa, assunto e data. */
const original = entrada().find(r => String(r.THREAD_ID) === thVoucher.id);
const m0 = JSON.parse(original.MENSAGENS_JSON)[0];
const thDup = SIM.pasta("CERTIFICADO 2027-1", novaThread(m0.assunto, "ana@exemplo.com", "cópia importada"));
thDup.msgs[0].getDate = () => new Date(m0.data);
const r10 = L.leitorBuscarPendentesDasPastas_();
b.igual(r10.copiados, 3, "três pendentes copiados", JSON.stringify(r10));
b.ok(naPonte(thFalta), "Carla, respondida só pedindo o contracheque (sem voucher), CONTINUA pendente e foi");
b.ok(naPonte(thPend) && naPonte(thPend2), "Lúcia (2027-1) e Rui (2026-2) foram para a ponte");
b.ok(!naPonte(thResp), "o que já recebeu o voucher em PDF NÃO foi");
b.ok(!naPonte(thEmit), "nada da pasta EMITIDOS");
b.ok(!naPonte(thDup), "a cópia importada de um pedido já copiado não duplicou");
b.igual(r10.respondidos, 1, "o relatório conta o respondido");
b.igual(r10.repetidos, 1, "e o repetido");
b.igual(entrada().length, antesPastas + 3, "a ponte cresceu só três");
b.ok(!SIM.chamadasIALeitor.some(c => /certificado de bolsa para meu filho/.test(c.texto)),
  "pedido de pasta não passa pela IA (a Marcela já separou)");

b.passo("11. Repassar no mesmo dia não faz nada; e o SISGEP mostra os pendentes");
SIM.ciclo();
b.igual(entrada().length, antesPastas + 3, "o ciclo do mesmo dia não copiou de novo");
g.vpeLerCaixa_({});
b.ok(!!pedidoDa(thPend) && !!pedidoDa(thPend2), "os dois pendentes aparecem no SISGEP");

b.fluxo("LEITOR · pendentes que o robô da KingHost deixou no Drive");
b.passo("12. Sem a pasta no Drive, o ciclo segue normal");
const r12 = SIM.ciclo();
b.ok(r12.importados && r12.importados.semPasta, "sem pasta: nada importado, sem erro", JSON.stringify(r12.importados));

b.passo("13. Com a pasta: cada .eml vai para o Gmail na etiqueta da pasta e daí para a ponte");
const eml = (de, assunto, corpo) => "From: " + de + "\r\nTo: Marcelha <secretaria@sindeducacao.com>\r\nSubject: " + assunto +
  "\r\nDate: Mon, 05 Oct 2026 10:00:00 -0300\r\n\r\n" + corpo;
SIM.drivePendentes.existe = true;
SIM.drivePendentes.arquivos.push(
  { nome: "CERTIFICADO-2027-1__aaa111.eml", raw: eml("Paula <paula@exemplo.com>", "Bolsa de estudo 2027/1", "Peço o certificado de bolsa.") },
  { nome: "CERTIFICADO-2026-2__bbb222.eml", raw: eml("Igor <igor@exemplo.com>", "Voucher 2026/2", "Aguardo o voucher.") },
  { nome: "leia-me.txt", raw: "não é e-mail" });
const antes13 = entrada().length;
const r13 = SIM.ciclo();
b.igual(r13.importados.importados, 2, "dois importados (o .txt fica de fora)", JSON.stringify(r13.importados));
b.igual(SIM.importados.map(x => x.etiqueta).sort().join(" | "), "CERTIFICADO 2026-2 | CERTIFICADO 2027-1",
  "cada um na etiqueta da sua pasta");
b.ok(SIM.importados.every(x => x.op && x.op.internalDateSource === "dateHeader"), "com a data original do e-mail");
b.igual(entrada().length, antes13 + 2, "e os dois chegaram à ponte no mesmo ciclo", JSON.stringify(r13.pendentesPastas));
b.ok(SIM.tentativasSisgep.length === 0, "o SISGEP não tocou em caixa nenhuma");

b.passo("14. O robô rodar de novo não duplica nada");
const r14 = SIM.ciclo();
b.igual(r14.importados.importados, 0, "nada importado de novo");
b.igual(entrada().length, antes13 + 2, "a ponte não cresceu");

b.passo("15. Serviço Gmail indisponível: o ciclo não para");
SIM.drivePendentes.arquivos.push({ nome: "CERTIFICADO-2027-1__ccc333.eml", raw: eml("x <x@exemplo.com>", "Bolsa", "y") });
const gmailOk = SIM.leitor.Gmail;
SIM.leitor.Gmail = undefined;
const r15 = SIM.ciclo();
SIM.leitor.Gmail = gmailOk;
b.ok(r15.importados && r15.importados.erro, "o erro fica no relatório", JSON.stringify(r15.importados));
b.ok(r15.lidas !== undefined, "e o resto do ciclo rodou");

b.passo("15b. Caixa de entrada da KingHost: a IA confere o que veio de lá; a pasta 2026-1 é ignorada");
SIM.drivePendentes.arquivos.length = 0;
SIM.drivePendentes.arquivos.push(
  { nome: "KINGHOST-ENTRADA__e1.eml", raw: eml("Hugo <hugo@exemplo.com>", "Solicitação", "Gostaria do certificado de bolsa do meu filho.") },
  { nome: "KINGHOST-ENTRADA__e2.eml", raw: eml("Ivo <ivo@exemplo.com>", "Desconto", "TIPO:JURIDICO Sobre o desconto indevido na rescisão.") },
  { nome: "CERTIFICADO-2026-1__g1.eml", raw: eml("Gil <gil@exemplo.com>", "Voucher 2026/1", "Peço o voucher.") });
const antes15b = entrada().length;
const iaAntes15b = SIM.chamadasIALeitor.length;
const r15b = SIM.ciclo();
const deNaPonte = () => entrada().map(r => String(r.MENSAGENS_JSON));
b.igual(r15b.importados.importados, 2, "os dois da entrada entram no Gmail; o de 2026-1 nem entra", JSON.stringify(r15b.importados));
b.ok(deNaPonte().some(t => /hugo@exemplo\.com/.test(t)), "Hugo (entrada, pedido de verdade) foi para o SISGEP");
b.ok(!deNaPonte().some(t => /ivo@exemplo\.com/.test(t)), "Ivo (entrada, fala de 'desconto' mas é jurídico) NÃO foi");
b.ok(!deNaPonte().some(t => /gil@exemplo\.com/.test(t)), "Gil (pasta CERTIFICADO 2026-1) NÃO foi: 2026/1 é ignorado");
b.igual(entrada().length, antes15b + 1, "a ponte cresceu só um");
const iaUsadas = SIM.chamadasIALeitor.slice(iaAntes15b).map(c => c.texto).join(" | ");
b.ok(/hugo|bolsa do meu filho/i.test(iaUsadas) && /rescis/i.test(iaUsadas), "a IA leu os dois da entrada");
b.passo("15d. O que já tinha sido copiado da pasta 2026-1 sai da ponte");
const thVelho261 = SIM.pasta("CERTIFICADO 2026-1", novaThread("Voucher 2026/1", "gil@exemplo.com", "Peço o voucher de 2026/1."));
SIM.leitor.leitorGravar_(SIM.leitor.leitorAba_(SIM.leitor.leitorPonte_(), "Entrada"),
  { THREAD_ID: thVelho261.id, ULTIMA_MENSAGEM_ID: thVelho261.msgs[0].getId(), CAIXA: "SECRETARIA", ATUALIZADO_EM: new Date(),
    MENSAGENS_JSON: "[]", ANEXOS_JSON: "[]" });
b.ok(naPonte(thVelho261), "(antes: estava na ponte)");
SIM.leitor.PropertiesService.getScriptProperties().deleteProperty("IGNORADOS_2026_1_OK");
const r15d = SIM.ciclo();
b.ok(!naPonte(thVelho261), "saiu da ponte", JSON.stringify(r15d.ignorados));
b.igual(r15d.ignorados.tirados, 1, "o relatório conta um tirado");
b.igual(r15b.pendentesPastas.naoVoucher, 1, "o relatório conta o que a IA viu que não é pedido");
const iaAntes15c = SIM.chamadasIALeitor.length;
SIM.leitor.PropertiesService.getScriptProperties().deleteProperty("PENDENTES_PASTAS_DIA");
SIM.ciclo();
b.igual(SIM.chamadasIALeitor.length, iaAntes15c, "na passada seguinte, o que não é pedido não volta à IA (não gasta crédito)");

b.fluxo("LEITOR · Caixa da Secretaria (29/10/2026)");
b.passo("15e. Mensagem nova numa conversa da Caixa: atualiza, sem perguntar de novo à IA");
const ia15e = SIM.chamadasIALeitor.length;
SIM.responder(thFiliacao, "joao@exemplo.com", "Reforçando: quero me desfiliar ainda este mês.");
SIM.ciclo();
const cFil2 = caixaL().find(r => String(r.THREAD_ID) === thFiliacao.id);
b.ok(/ainda este m[eê]s/.test(cFil2.MENSAGENS_JSON), "a mensagem nova está na Caixa");
b.igual(cFil2.TIPO, "FILIACAO", "o tipo continua");
b.igual(SIM.chamadasIALeitor.length, ia15e, "sem nova pergunta à IA");

b.passo("15f. Resposta numa conversa da Caixa sai, como resposta, para quem escreveu");
const shSaida = SIM.leitor.leitorAba_(SIM.leitor.leitorPonte_(), "Saida");
SIM.leitor.leitorGravar_(shSaida, { ID: "ENV_CAIXA_1", THREAD_ID: thFiliacao.id, MENSAGEM_ID: thFiliacao.msgs[thFiliacao.msgs.length - 1].getId(),
  HTML: "<p>Recebemos seu pedido de desfiliação.</p>", STATUS: "PENDENTE", CRIADO_EM: new Date() });
const out15f = amb.outbox.length;
SIM.ciclo();
const env15f = SIM.leitor.leitorLinhas_(shSaida).find(r => r.ID === "ENV_CAIXA_1");
b.igual(env15f.STATUS, "ENVIADO", "enviado", env15f.DETALHE);
b.ok(amb.outbox.slice(out15f).some(m => m.via === "reply" && m.to === "joao@exemplo.com"), "como resposta ao João");

b.passo("15g. Os e-mails de antes da Caixa (já com etiqueta) entram uma vez, sem IA");
const thAntigo = novaThread("Homologação de rescisão", "rh@escola.exemplo.com", "Precisamos agendar a homologação.");
thAntigo.etiquetas.push("SISGEP/" + SIM.leitor.LEITOR_TIPOS.JURIDICO);
SIM.leitor.GmailApp.createLabel("SISGEP/" + SIM.leitor.LEITOR_TIPOS.JURIDICO);
thAntigo.arquivada = true;   // fora da busca normal: só a passada das etiquetas acha
thAntigo.msgs[0].getDate = () => new Date(Date.now() - 3 * 86400000);
SIM.leitor.PropertiesService.getScriptProperties().deleteProperty("CAIXA_PREENCHIDA_OK");
const ia15g = SIM.chamadasIALeitor.length;
const r15g = SIM.ciclo();
const cAnt = caixaL().find(r => String(r.THREAD_ID) === thAntigo.id);
b.ok(cAnt && cAnt.TIPO === "JURIDICO", "entrou na Caixa com o tipo da etiqueta", JSON.stringify(r15g.caixaPreenchida));
b.igual(SIM.chamadasIALeitor.length, ia15g, "sem IA");
const r15g2 = SIM.ciclo();
b.ok(!r15g2.caixaPreenchida, "e não repete");

b.passo("16. Cada rodada fica anotada na aba Status da ponte (só números)");
const st = SIM.aba("Status").getRange(1, 1, 3, 2).getValues();
b.ok(st[0][0] === "ULTIMA_RODADA" && /\d{2}\/\d{2}\/\d{4}/.test(st[0][1]), "a hora da última rodada", String(st[0][1]));
b.ok(/"importados"/.test(st[1][1]), "e o resultado em números");
b.ok(!/@exemplo\.com/.test(String(st[1][1])), "sem nenhum e-mail de pessoa");

b.resumo();
