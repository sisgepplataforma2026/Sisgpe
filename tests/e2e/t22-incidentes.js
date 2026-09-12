/**
 * TESTE — INCIDENTES DE SEGURANÇA (tela 16.7)
 *
 * O QUE ESTE MÓDULO TEM QUE OS OUTROS NÃO TÊM
 * Relógio correndo. O prazo da LGPD conta da CIÊNCIA do incidente, e é o
 * contador que diz ao sindicato se ainda dá tempo. Contador errado é pior
 * que contador nenhum: quem confia nele deixa de comunicar achando que tem
 * folga.
 *
 * Por isso os passos de prazo (7 a 11) são o centro daqui — inclusive o que
 * verifica que o relógio PARA quando a comunicação foi decidida.
 *
 * ⚠️ NÃO É PARECER JURÍDICO. O prazo padrão de 3 dias úteis vem de
 * resolução da ANPD e é configurável justamente porque muda. Quem responde
 * pelo prazo é o sindicato, não o teste.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

function porId(id) {
  return g.incListar({}, ADM).incidentes.filter(x => x.id === id)[0];
}

/* ══════════ 1. REGISTRO ══════════ */
b.fluxo("INCIDENTE · Registro");

b.passo("1. Registrar cria o incidente em ABERTO");
const r1 = g.incRegistrar({ descricao: "Planilha de associados compartilhada por engano" }, ADM);
b.ok(r1.ok && /^INC-\d{4}-\d{3}$/.test(r1.id), "ID sequencial por ano", r1.id);
b.ok(porId(r1.id).estado === "ABERTO", "nasce aberto", porId(r1.id).estado);

b.passo("2. Descrição curta demais não passa");
// "vazou" não é registro de incidente — e é o registro que o sindicato vai
// apresentar se for questionado.
const curto = g.incRegistrar({ descricao: "vazou" }, ADM);
b.ok(curto.ok === false, "exige o mínimo de descrição", curto.mensagem);

b.passo("3. Detecção no futuro é recusada");
// Aceitar data futura faria o prazo nascer com folga inventada — e essa
// folga é exatamente o que uma fiscalização olharia com desconfiança.
const amanha = new Date(Date.now() + 48 * 3600 * 1000);
const futuro = g.incRegistrar({ detectadoEm: amanha, descricao: "teste de data no futuro" }, ADM);
b.ok(futuro.ok === false, "não dá para comprar prazo com data futura", futuro.mensagem);

b.passo("4. O registro entra na trilha");
const naTrilha = g.auditoriaConsultar({ acao: "REGISTRAR_INCIDENTE" }, ADM).acoes;
b.ok(naTrilha.length >= 1 && naTrilha[0].submodulo === "Incidentes",
  "registrar incidente é evento de auditoria", naTrilha.length + " registro(s)");

/* ══════════ 2. O FLUXO É DE MÃO ÚNICA ══════════ */
b.fluxo("INCIDENTE · Fluxo de estados");

b.passo("5. Não dá para pular de ABERTO para ENCERRADO");
// Apurar, conter e decidir sobre a comunicação são as etapas que a
// fiscalização vai querer ver documentadas. Pular é apagar o histórico.
const pulo = g.incAvancar(r1.id, "ENCERRADO", { relatorio: "encerrando sem apurar nada disso" }, ADM);
b.ok(pulo.ok === false, "o fluxo não se conserta com força bruta", pulo.mensagem);

b.passo("6. Cada passo exige o que aquele passo precisa");
const semTipo = g.incAvancar(r1.id, "EM_ANALISE", { gravidade: "ALTA", numTitulares: 40 }, ADM);
b.ok(semTipo.ok === false, "classificar sem tipo não passa", semTipo.mensagem);

const semNum = g.incAvancar(r1.id, "EM_ANALISE", { tipo: "VAZAMENTO", gravidade: "ALTA" }, ADM);
b.ok(semNum.ok === false, "classificar sem nº de atingidos não passa", semNum.mensagem);

const classificou = g.incAvancar(r1.id, "EM_ANALISE",
  { tipo: "VAZAMENTO", gravidade: "ALTA", dadosAtingidos: "nome, CPF e e-mail", numTitulares: 40 }, ADM);
b.ok(classificou.ok === true && porId(r1.id).estado === "EM_ANALISE",
  "com tudo preenchido, avança", porId(r1.id).estado);

b.passo("7. Conter exige dizer o que foi feito");
const semMedidas = g.incAvancar(r1.id, "CONTIDO", { medidas: "ok" }, ADM);
b.ok(semMedidas.ok === false, "'ok' não é medida de contenção", semMedidas.mensagem);
g.incAvancar(r1.id, "CONTIDO", { medidas: "Compartilhamento revogado e link desativado" }, ADM);
b.ok(porId(r1.id).estado === "CONTIDO", "contido", porId(r1.id).estado);

/* ══════════ 3. O PRAZO ══════════ */
b.fluxo("INCIDENTE · O relógio da ANPD");

b.passo("8. O prazo é contado em dias ÚTEIS");
// Sexta + 3 dias úteis = quarta. Se contasse dia corrido, daria segunda —
// dois dias a menos, e a diferença aparece justamente quando o incidente
// cai numa sexta, que é quando ninguém está olhando.
const sexta = new Date(2026, 7, 7);            // 07/08/2026 é uma sexta
const limite = g.inc_somarDiasUteis_(sexta, 3);
b.ok(limite.getDate() === 12 && limite.getMonth() === 7,
  "sexta + 3 úteis = quarta, não segunda",
  limite.getDate() + "/" + (limite.getMonth() + 1));

b.passo("9. Incidente antigo aparece como VENCIDO");
const antigo = g.incRegistrar({
  detectadoEm: new Date(Date.now() - 30 * 24 * 3600 * 1000),
  descricao: "Incidente detectado há um mês e nunca comunicado"
}, ADM);
const inc2 = porId(antigo.id);
b.ok(inc2.prazo.vencido === true && inc2.prazo.diasRestantes < 0,
  "o contador acusa o atraso", inc2.prazo.diasRestantes + " dias");

b.passo("10. E entra na lista do que exige ação agora");
const painel = g.incListar({}, ADM);
b.ok(painel.vencendo.some(x => x.id === antigo.id),
  "o card vermelho tem em que se apoiar", painel.vencendo.length + " vencendo/vencido(s)");

b.passo("11. Depois de COMUNICADO, o relógio PARA");
// Se continuasse correndo, um incidente resolvido ficaria para sempre no
// alerta vermelho — e alerta que não sai é alerta que ninguém mais lê.
g.incAvancar(antigo.id, "EM_ANALISE",
  { tipo: "PERDA", gravidade: "MEDIA", dadosAtingidos: "e-mails", numTitulares: 5 }, ADM);
g.incAvancar(antigo.id, "CONTIDO", { medidas: "Backup restaurado e acesso revisado" }, ADM);
g.incAvancar(antigo.id, "COMUNICADO", { anpdData: new Date() }, ADM);
const parado = porId(antigo.id);
b.ok(parado.prazo.parado === true && parado.prazo.vencido === false,
  "obrigação cumprida, alerta sai da tela", "parado=" + parado.prazo.parado);

b.passo("12. O prazo é configurável pela CONFIG");
// A norma da ANPD muda mais rápido que o código. Se o número estivesse
// cravado, cada mudança viraria pedido de alteração de sistema.
const cfg = ss.getSheetByName("CONFIG");
cfg.appendRow(["LGPD_PRAZO_ANPD_DIAS_UTEIS", 5]);
b.ok(g.inc_prazoDiasUteis_() === 5, "a CONFIG manda", g.inc_prazoDiasUteis_() + " dias úteis");
cfg.appendRow(["LGPD_PRAZO_ANPD_DIAS_UTEIS_BACKUP", 3]);

b.passo("13. Valor inválido na CONFIG cai no padrão, não quebra");
cfg.getRange(cfg.getLastRow() - 1, 2).setValue("três");
b.ok(g.inc_prazoDiasUteis_() === 3, "texto onde devia ser número não derruba a tela",
  g.inc_prazoDiasUteis_() + " dias úteis");

/* ══════════ 4. COMUNICAR E DISPENSAR ══════════ */
b.fluxo("INCIDENTE · Comunicação");

b.passo("14. COMUNICADO exige que alguma comunicação tenha acontecido");
// Marcar como comunicado sem data seria o estado mentindo — e este é o pior
// lugar do sistema para uma mentira ficar registrada.
const r3 = g.incRegistrar({ descricao: "Terceiro incidente para testar comunicação" }, ADM);
g.incAvancar(r3.id, "EM_ANALISE",
  { tipo: "ACESSO_INDEVIDO", gravidade: "BAIXA", dadosAtingidos: "nome", numTitulares: 1 }, ADM);
g.incAvancar(r3.id, "CONTIDO", { medidas: "Senha trocada imediatamente" }, ADM);
const semData = g.incAvancar(r3.id, "COMUNICADO", {}, ADM);
b.ok(semData.ok === false, "sem data, não vira comunicado", semData.mensagem);

b.passo("15. DISPENSAR exige justificativa longa");
// É a decisão que a ANPD questiona. Se ela discordar depois, esta
// justificativa é o que o sindicato terá para apresentar.
const dispCurto = g.incAvancar(r3.id, "DISPENSADO", { motivo: "sem risco" }, ADM);
b.ok(dispCurto.ok === false, "'sem risco' não é justificativa", dispCurto.mensagem);

const disp = g.incAvancar(r3.id, "DISPENSADO",
  { motivo: "Dado exposto era apenas o primeiro nome, sem qualquer identificador adicional" }, ADM);
b.ok(disp.ok === true && porId(r3.id).estado === "DISPENSADO",
  "com justificativa real, passa", porId(r3.id).estado);

b.passo("16. E a dispensa entra na trilha com nome próprio");
// Não pode ficar indistinguível de "comunicou": são decisões opostas, e a
// diferença é o que vai ser cobrado.
const daDispensa = g.auditoriaConsultar({ acao: "DISPENSAR_COMUNICACAO_INCIDENTE" }, ADM).acoes;
b.ok(daDispensa.length >= 1, "dispensar tem ação própria na auditoria",
  daDispensa.length ? daDispensa[0].justificativa.slice(0, 60) : "não achou");

b.passo("17. Encerrar exige relatório final");
const semRel = g.incAvancar(r3.id, "ENCERRADO", { relatorio: "fim" }, ADM);
b.ok(semRel.ok === false, "'fim' não é relatório", semRel.mensagem);
const enc = g.incAvancar(r3.id, "ENCERRADO",
  { relatorio: "Exposição de primeiro nome, contida em minutos, sem risco ao titular" }, ADM);
b.ok(enc.ok === true && !!porId(r3.id).encerradoPor,
  "encerrado com autor registrado", porId(r3.id).encerradoPor);

/* ══════════ 5. PERMISSÃO ══════════ */
b.fluxo("INCIDENTE · Permissão (decisão do usuário: tudo exige administrador)");

b.passo("18. Quem não é administrador não registra");
// Decisão do usuário em 11/08/2026. Eu havia proposto liberar o registro
// para quem tem o módulo, pelo argumento do relógio correndo — ele decidiu
// diferente, e o teste trava a decisão dele, não a minha proposta.
b.bloqueia(() => g.incRegistrar({ descricao: "tentativa sem ser administrador" }, FIN),
  "incRegistrar nega não-admin");

b.passo("19. Nem avança o fluxo");
b.bloqueia(() => g.incAvancar(r1.id, "COMUNICADO", { anpdData: new Date() }, FIN),
  "incAvancar nega não-admin");

b.passo("20. E quem não tem o módulo não lê a lista");
b.bloqueia(() => g.incListar({}, FIN), "incListar nega");
b.bloqueia(() => g.incListar({}, ""), "nega token vazio");

b.naoTestavel("O prazo legal em si",
  "3 dias úteis vem de resolução da ANPD e muda; o sistema conta os dias, " +
  "quem responde pelo prazo é o sindicato — confirmar com o jurídico");
b.naoTestavel("Feriados no cálculo do prazo",
  "o contador pula só sábado e domingo. Com feriado no meio, ele aponta um " +
  "dia a mais do que a ANPD consideraria — aperta o prazo, não afrouxa");

b.resumo();
