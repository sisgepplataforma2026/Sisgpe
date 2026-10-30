/**
 * A JORNADA COMPLETA, CRUZANDO TODAS AS FUNÇÕES — 30/10/2026.
 *
 * O usuário: "cruze todas as funções para ver se estão funcionando". Um
 * cenário só, do e-mail chegando até o voucher enviado, passando por todos
 * os módulos que tocam nele — e a Caixa da Secretaria ao lado. Backend
 * real, leitor real, dados FICTÍCIOS. Cada passo depende do anterior: se
 * uma peça não encaixa na outra, quebra aqui.
 *
 *   KingHost (Drive) → leitor → ponte → SISGEP (IA, associado, escola)
 *   → só texto: resposta-padrão → complemento (lista) → a pessoa responde
 *   → relido inteiro → PRONTO → conferir e emitir → aguardando envio
 *   → dias depois, enviar → PDF com a data do envio → resposta na conversa
 *   → assinatura de quem enviou → solicitação, histórico, observação
 *   + Caixa da Secretaria: tipo, acesso, responder, resolver, reabrir.
 *
 * NÃO PROVA: o PDF de verdade, a entrega do e-mail, a IA de verdade, a
 * aparência — esses ficam para o roteiro em homologação.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const usu = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
usu.appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline", "secretaria@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios,comunicacao"]);
usu.appendRow(["rhzinho", g.gerarHashSenha_("Senha@2026"), "Só RH", "rh@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "rh"]);
const T_WAN = b.logar(g, "wanderson"), T_MAR = b.logar(g, "marcelha"), T_FIN = b.logar(g, "rogerio"), T_RH = b.logar(g, "rhzinho");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");

const shEsc = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
shEsc.getRange(1, 1, 1, 4).setValues([["EscolaID", "Escola (Razão Social)", "CNPJ", "NOME_FANTASIA"]]);
shEsc.appendRow(["ESC-1", "SOCIEDADE EDUCACIONAL ALFA LTDA", "11.222.333/0001-81", "COLÉGIO ALFA"]);
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
const CPF_PAULA = "11144477735", CPF_IGOR = "52998224725";
shA.appendRow([CPF_PAULA, "PAULA REIS", "SIM", "paula@exemplo.com", "27999990001", "COLÉGIO ALFA"]);
shA.appendRow([CPF_IGOR, "IGOR MELO", "SIM", "igor@exemplo.com", "27999990002", "COLÉGIO ALFA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, responder, CC, RG, base } = SIM;
const ped = email => g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === email);
const saida = () => g.vpeLinhas_(SIM.aba("Saida"));
const lerSisgep = () => { for (let k = 0; k < 20; k++) { if (!g.voucherPedidosLerAgora(T_WAN).restantes) break; } };
const outboxDe = para => amb.outbox.filter(m => m.via === "reply" && m.to === para);

/* ════════ DIA 1: chega tudo ════════ */
b.fluxo("JORNADA · 1. Chega tudo de uma vez");
EXTRACOES.PAULA = base({ titular: { nome: "Paula Reis", cpf: "" }, curso: "", instituicao: "", anexos: [] });
const thPaula = novaThread("Voucher", "Paula <paula@exemplo.com>", "Gostaria do meu voucher. CASO:PAULA");
const thJoao = novaThread("Quero me desfiliar", "João <joao@exemplo.com>", "Quero cancelar a filiação. TIPO:FILIACAO");
novaThread("Promoção", "Loja <ofertas@loja.exemplo.com>", "50% off! TIPO:PROPAGANDA");
/* Pedido antigo, que o robô da KingHost deixou no Drive. */
EXTRACOES.IGOR = base({ titular: { nome: "Igor Melo", cpf: CPF_IGOR },
  anexos: [Object.assign(CC("IGOR MELO", CPF_IGOR, "09/2026", "SOC EDUC ALFA"), { cnpj_empregador: "11222333000181" }), RG(2, "IGOR MELO", CPF_IGOR)] });
SIM.drivePendentes.existe = true;
SIM.drivePendentes.arquivos.push({ nome: "CERTIFICADO-2027-1__igor.eml", raw:
  "From: Igor <igor@exemplo.com>\r\nTo: secretaria@sindeducacao.com\r\nSubject: Voucher 2027/1\r\nDate: Mon, 05 Oct 2026 10:00:00 -0300\r\n\r\nVoucher de Pedagogia. CASO:IGOR" });
const CPF_RITA = "39053344705";
shA.appendRow([CPF_RITA, "RITA LOPES", "SIM", "rita@exemplo.com", "27999990003", "COLÉGIO ALFA"]);
EXTRACOES.RITA = base({ titular: { nome: "Rita Lopes", cpf: CPF_RITA },
  anexos: [Object.assign(CC("RITA LOPES", CPF_RITA, "09/2026", "SOC EDUC ALFA"), { cnpj_empregador: "11222333000181" }), RG(2, "RITA LOPES", CPF_RITA)] });
novaThread("Voucher Letras", "rita@exemplo.com", "Voucher Letras 2027/1. CASO:RITA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
const outInicial = amb.outbox.length;
SIM.ciclo(); SIM.ciclo();
lerSisgep();

b.passo("1a. Cada coisa no seu lugar");
b.ok(!!ped("paula@exemplo.com"), "Paula (só texto) está nos pedidos de voucher");
const pIgor = ped("igor@exemplo.com");
b.ok(!!pIgor, "Igor (pedido antigo da KingHost, via Drive) também");
const caixa = g.caixaSecretariaPainel(T_MAR);
b.ok(caixa.itens.some(i => i.id === thJoao.id && i.tipo === "FILIACAO"), "João (desfiliação) na Caixa da Secretaria, como Filiação");
b.ok(!caixa.itens.some(i => /loja/.test(i.de)), "a propaganda em lugar nenhum");
b.igual(amb.outbox.length, outInicial, "NADA saiu sozinho");

b.passo("1b. O Igor (o .eml de teste não tem anexo) fica em 'falta documento'; a Rita chegou completa");
b.igual(pIgor.ESTADO, "FALTA_DOC", "Igor: falta documento");
b.igual(ped("rita@exemplo.com").ESTADO, "PRONTO", "Rita pronta");
b.igual(g.voucherPedidosDetalhe(ped("rita@exemplo.com").ID_PEDIDO, T_WAN).campos.escola.valor, "SOCIEDADE EDUCACIONAL ALFA LTDA",
  "escola oficial do cadastro, achada pelo CNPJ");

/* ════════ Paula: só texto → resposta-padrão → complemento ════════ */
b.fluxo("JORNADA · 2. Paula mandou só texto");
const dPaula = g.voucherPedidosDetalhe(ped("paula@exemplo.com").ID_PEDIDO, T_MAR);
b.igual(ped("paula@exemplo.com").ESTADO, "FALTA_DOC", "falta documento");
b.ok(/Recebemos sua solicitação de voucher/.test(dPaula.respostaSugerida) && /Ainda não é associado/.test(dPaula.respostaSugerida),
  "a resposta é a padrão do sindicato");
b.ok(/Marcelha Aline/.test(dPaula.respostaSugerida) && !/Wanderson/.test(dPaula.respostaSugerida), "assinada pela Marcela (logada)");
b.ok(dPaula.complemento && Object.keys(dPaula.complemento.sugeridos).indexOf("VINCULO") > -1, "a lista já vem marcada");
const r2 = g.voucherPedidosResponder(ped("paula@exemplo.com").ID_PEDIDO, "COMPLEMENTO", dPaula.respostaSugerida,
  { sugeridos: Object.keys(dPaula.complemento.sugeridos), escolhidos: Object.keys(dPaula.complemento.sugeridos), textoSugerido: dPaula.respostaSugerida }, T_MAR);
b.ok(r2.ok, "Marcela clicou em enviar o pedido de complemento", r2.mensagem);
b.igual(outboxDe("paula@exemplo.com").length, 0, "ainda não saiu — está na fila do leitor");
SIM.ciclo();
const e2 = outboxDe("paula@exemplo.com").pop();
b.ok(e2 && /Ainda não é associado/.test(e2.htmlBody), "o leitor mandou, como resposta à Paula");
b.igual((e2.htmlBody.match(/Marcelha Aline/g) || []).length, 1, "com UMA assinatura");
b.igual(ped("paula@exemplo.com").ESTADO, "AGUARDANDO", "aguardando a Paula");

b.fluxo("JORNADA · 3. Paula responde com os documentos");
EXTRACOES.PAULA = base({ titular: { nome: "Paula Reis", cpf: CPF_PAULA }, curso: "Pedagogia", instituicao: "FACULDADE X",
  anexos: [Object.assign(CC("PAULA REIS", CPF_PAULA, "09/2026", "COLEGIO ALFA"), { cnpj_empregador: "11222333000181", indice: 1 }),
           RG(2, "PAULA REIS", CPF_PAULA)] });
responder(thPaula, "paula@exemplo.com", "Segue o contracheque e o RG. Pedagogia na Faculdade X, 2027/1. CASO:PAULA",
  [SIM.pdf("contracheque.pdf"), SIM.jpg("rg.jpg")]);
SIM.ciclo(); lerSisgep();
b.igual(ped("paula@exemplo.com").ESTADO, "PRONTO", "relido inteiro: PRONTO");
const dP2 = g.voucherPedidosDetalhe(ped("paula@exemplo.com").ID_PEDIDO, T_MAR);
b.igual(dP2.campos.comprovanteVinculo.valor, "CONTRACHEQUE", "vínculo pelo contracheque");
b.ok(/pelo CNPJ/.test(dP2.campos.escola.origem), "escola achada pelo CNPJ");

/* ════════ conferir e emitir; enviar depois ════════ */
b.fluxo("JORNADA · 4. Conferir e emitir (Marcela), enviar dias depois (Wanderson)");
const emP = g.voucherPedidosConferirEmitir(ped("paula@exemplo.com").ID_PEDIDO, {}, {}, T_MAR);
const emI = g.voucherPedidosConferirEmitir(ped("rita@exemplo.com").ID_PEDIDO, {}, {}, T_MAR);
b.ok(emP.ok && emI.ok, "os dois emitidos", emP.mensagem + " | " + emI.mensagem);
const fila4 = saida().length;
b.igual(g.voucherPedidosEmitidos(T_WAN).itens.length, 2, "dois aguardando envio");
b.igual(saida().length, fila4, "nada na fila de e-mail");
const shE = ss.getSheetByName(g.VOUCHER_ABA_EMITIDOS);
const cab = shE.getRange(1, 1, 1, shE.getLastColumn()).getValues()[0].map(String);
for (let r = 2; r <= shE.getLastRow(); r++) ["DATA_DOCUMENTO", "DATA_EMISSAO"].forEach(c => {
  if (cab.indexOf(c) > -1) shE.getRange(r, cab.indexOf(c) + 1).setValue(new Date(2026, 9, 27, 10, 0));
});
const env = g.voucherPedidosEnviarEmitidos([ped("paula@exemplo.com").ID_PEDIDO], T_WAN);
b.ok(env.ok && env.enviados.length === 1, "Wanderson enviou a Paula", JSON.stringify(env));
const hoje = g.Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
const emiP = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_EMITIDOS, emP.protocolo);
b.igual(g.Utilities.formatDate(new Date(emiP.DATA_DOCUMENTO), "America/Sao_Paulo", "yyyy-MM-dd"), hoje, "voucher com a data do ENVIO");
SIM.ciclo();
const e4 = outboxDe("paula@exemplo.com").pop();
b.ok(e4 && e4 !== e2 && (e4.attachments || []).length >= 1, "saiu na conversa da Paula, com o PDF");
b.igual((e4.htmlBody.match(/Wanderson N Castelo/g) || []).length, 1, "assinado por quem enviou (Wanderson), uma vez");
b.ok(!/Marcelha Aline/.test(e4.htmlBody), "sem a assinatura da Marcela junto");
b.igual(ped("paula@exemplo.com").ESTADO, "CONCLUIDO", "Paula concluída");
b.igual(ped("rita@exemplo.com").ESTADO, "EMITIDO", "Rita, não marcada, continua aguardando envio");

b.fluxo("JORNADA · 5. O módulo de Voucher ficou certo por dentro");
const sol = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_SOLICITACOES, emP.protocolo);
b.ok(sol && sol.CANAL_ENTRADA === "EMAIL", "a solicitação existe, canal e-mail", sol && sol.CANAL_ENTRADA);
b.igual(sol.TIPO_DOCUMENTO_VINCULO, "CONTRACHEQUE", "com o tipo do comprovante de vínculo");
const shH = ss.getSheetByName("Voucher_Historico");
const acoes = shH.getRange(1, 1, shH.getLastRow(), shH.getLastColumn()).getValues()
  .filter(l => l.indexOf(emP.protocolo) > -1).map(l => l.join("|")).join(" ; ");
b.ok(/PEDIDO_POR_EMAIL/.test(acoes) && /VOUCHER_REDATADO/.test(acoes), "histórico: pedido por e-mail e redatado no envio", acoes);
const corr = JSON.parse(ped("paula@exemplo.com").CORRECOES_JSON || "[]");
b.ok(corr.length >= 1 && corr[0].por, "a conferência ficou registrada (para aprender)");
b.ok(!g.voucherPedidosEnviarEmitidos([ped("paula@exemplo.com").ID_PEDIDO], T_WAN).enviados.length, "enviar de novo: recusado");

/* ════════ Caixa da Secretaria ════════ */
b.fluxo("JORNADA · 6. Caixa da Secretaria");
b.ok(g.caixaSecretariaPainel(T_FIN).ok, "o Financeiro abre (categorizado)");
b.ok(!g.caixaSecretariaPainel(T_RH).ok, "quem só tem RH não abre");
const dJ = g.caixaSecretariaDetalhe(thJoao.id, T_MAR);
b.ok(/Marcelha Aline/.test(dJ.sugestao), "resposta já com a assinatura de quem está logado");
const o6 = outboxDe("joao@exemplo.com").length;
g.caixaSecretariaResponder(thJoao.id, dJ.sugestao.replace("Tudo bem?", "Tudo bem? Recebemos o pedido de desfiliação."), T_MAR);
b.igual(outboxDe("joao@exemplo.com").length, o6, "não saiu direto do SISGEP");
SIM.ciclo();
b.ok(outboxDe("joao@exemplo.com").length === o6 + 1, "o leitor respondeu o João");
g.caixaSecretariaMarcar(thJoao.id, "RESOLVIDO", "processado", T_MAR);
responder(thJoao, "joao@exemplo.com", "Obrigado! Quando sai?");
SIM.ciclo();
const iJ = g.caixaSecretariaPainel(T_MAR).itens.find(i => i.id === thJoao.id);
b.ok(iJ.estado === "NOVO" && iJ.mensagemNova, "mensagem nova reabre a conversa");

b.fluxo("JORNADA · 7. Nada saiu sem clique");
b.igual(amb.outbox.length - outInicial, outboxDe("paula@exemplo.com").length + outboxDe("joao@exemplo.com").length,
  "todo e-mail que saiu foi resposta a quem escreveu, depois de um clique");

b.naoTestavel("PDF, entrega, IA de verdade e aparência", "roteiro em homologação (docs/PENDENTE-VERIFICACAO.md)");
b.resumo();
