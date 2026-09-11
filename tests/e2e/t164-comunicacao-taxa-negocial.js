/**
 * TESTE — A COMUNICAÇÃO DA TAXA NEGOCIAL ÀS ESCOLAS
 *
 * O PEDIDO, por voz, em 11/09/2026:
 *
 *   "preciso enviar um e-mail pras escolas com ofício... pra todas as escolas
 *    da base. Tem que ver a questão da cota de e-mails por dia: se chegar
 *    próximo da cota ele trava, joga para o dia seguinte, porque até o final do
 *    mês todas as escolas devem ter sido comunicadas. Que seja escalonado, não
 *    tudo de uma vez."
 *
 * ESTE TESTE EXISTE PARA PROVAR AS TRÊS DIFERENÇAS para o motor que já havia
 * (`TaxaAssistencial.gs`), porque cada uma nasceu de um defeito real:
 *
 *   1. REPREPARAR NÃO APAGA. Lá, `prepararFilaTaxaAssistencial` chama
 *      `clearContents()`: numa campanha de vinte dias, clicar "Preparar" duas
 *      vezes apaga quem já recebeu e todo mundo recebe de novo.
 *   2. A FILA É POR ENDEREÇO. Lá era por escola, e o limite virando no meio de
 *      uma escola de vários contatos deixava a linha PENDENTE depois de um
 *      deles já ter recebido — reproduzido no t161, 4 envios para 3 endereços.
 *   3. A COTA MANDA. Lá o teto é `100` escrito no código, com ZERO consultas à
 *      cota. Aqui o `CotaEmail.gs` responde antes de cada envio.
 *
 * E prova o que faltava: o AVISO. O `enviarAlerteLimiteDiario` do outro arquivo
 * é chamado duas vezes e não existe em lugar nenhum do projeto.
 *
 * O QUE NÃO COBRE: PDF de verdade (DocumentApp não é emulado), agendamento de
 * gatilho e entrega de e-mail. Substituídos por dublê — o objeto aqui é a
 * contabilidade da fila, o orçamento e as travas.
 */
const b = require("./base");
const { g, amb } = b.subir({ gmailAliases: ["secretaria@sindeducacao.com"] });
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const props = g.PropertiesService.getScriptProperties();

/* ── dublês: o que o emulador não alcança e não é o objeto do teste ────── */
let pdfsGerados = [];
g.obterPastaPorTipo_ = function () { return { getId: () => "PASTA-TN" }; };
g.gerarPDFUniversal_ = function (cfg) {
  pdfsGerados.push(cfg.nomeArquivo);
  return { pdf: { getBlob: () => ({ nome: cfg.nomeArquivo }), getId: () => "PDF-" + pdfsGerados.length } };
};
let agendou = 0, removeu = 0;
g.tnCom_agendarProximo_ = function () { agendou++; };
g.tnCom_removerTriggers_ = function () { removeu++; };
g.gerarProximoNumeroSeguro_ = function () { return "521/2026"; };

const ABA = "COMUNICACAO_TAXA_NEGOCIAL";
const comAlias = () => { g.GmailApp.getAliases = () => ["secretaria@sindeducacao.com",
                                                        "financeiro@sindeducacao.com"]; };
const semAlias = () => { g.GmailApp.getAliases = () => ["secretaria@sindeducacao.com"]; };

/** A base de escolas: uma com 3 contatos, uma com 1, uma sem nenhum. */
function montarEscolas(comContatoNovo) {
  const sh = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
  sh.clearContents();
  sh.getRange(1, 1, 1, 3).setValues([["Escola (Razão Social)", "CNPJ", "E-mails (todos)"]]);
  sh.getRange(2, 1, 3, 3).setValues([
    ["COLEGIO ALFA", "11.111.111/0001-11",
     comContatoNovo ? "a1@alfa.com, a2@alfa.com, a3@alfa.com, novo@alfa.com"
                    : "a1@alfa.com, a2@alfa.com, a3@alfa.com"],
    ["COLEGIO BETA", "22.222.222/0001-22", "b1@beta.com"],
    ["ESCOLA SEM CONTATO", "33.333.333/0001-33", ""]
  ]);
}

const filaLinhas = () => {
  const sh = ss.getSheetByName(ABA);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
};
const porStatus = (st) => filaLinhas().filter(r => String(r[5]) === st);
const emailsEnviados = () => amb.outbox.map(m => String(m.to || "")).filter(Boolean);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Preparar: uma linha por ENDEREÇO, não por escola");

montarEscolas(false);
passo("primeira preparação");
const p1 = g.tnCom_preparar_({ competencia: "setembro/2026", dataAlvo: "2026-09-30" },
                             "wanderson@sindeducacao.com");

ok(p1.ok === true, "a fila foi preparada", p1.mensagem);
igual(porStatus("PENDENTE").length, 4,
   "4 endereços pendentes — 3 da ALFA + 1 da BETA, e NÃO 2 escolas");
igual(porStatus("SEM_EMAIL").length, 1,
   "a escola sem contato vira SEM_EMAIL, que não é falha de envio");
igual(p1.contagem.escolas, 3, "as três escolas foram lidas");

passo("o teto nasce calculado, com a conta à mostra");
ok(p1.tetoSugerido.teto > 0, "sugeriu um teto", JSON.stringify(p1.tetoSugerido));
ok(String(p1.tetoSugerido.conta).indexOf("÷") > -1,
   "e mostra a divisão que o produziu, em vez de um número sem origem",
   p1.tetoSugerido.conta);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Repreparar NÃO apaga — a diferença que motivou o arquivo novo");

passo("marca uma linha como já enviada e prepara de novo");
const sh = ss.getSheetByName(ABA);
sh.getRange(2, 6).setValue("ENVIADO");
montarEscolas(true);            /* o cadastro ganhou um contato novo */
const p2 = g.tnCom_preparar_({}, "wanderson@sindeducacao.com");

igual(porStatus("ENVIADO").length, 1,
   "quem já recebeu CONTINUA como enviado — no motor antigo isso seria apagado");
igual(porStatus("PENDENTE").length, 4,
   "3 pendentes de antes + 1 contato novo, sem duplicar os que já estavam");
igual(p2.contagem.acrescentados, 1,
   "só o contato novo foi acrescentado");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Liberar barra quando o remetente não é o esperado");

passo("sem o alias do financeiro");
semAlias();
const barrado = g.tnCom_liberar_();
ok(barrado.ok === false, "recusa liberar", barrado.mensagem.slice(0, 70));
ok(String(barrado.mensagem).indexOf("alias") > -1,
   "e diz o que fazer para destravar, em vez de só negar");
igual(props.getProperty("TN_COM_LIBERADA"), null,
   "e a campanha NÃO fica marcada como liberada");

passo("com o alias ativo");
comAlias();
const liberado = g.tnCom_liberar_();
ok(liberado.ok === true, "libera", liberado.mensagem);
igual(liberado.remetente.real, "financeiro@sindeducacao.com",
   "e o remetente medido é o que as escolas vão ver");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O lote pergunta à cota antes de enviar");

passo("teto de 2 por dia, com 4 na fila");
amb.outbox.length = 0; pdfsGerados = []; agendou = 0;
g.tnCom_ajustarTeto_(2);
const l1 = g.tnCom_enviarLote_();

igual(l1.enviados, 2, "manda só o que o teto do dia permite", l1.mensagem);
igual(emailsEnviados().length, 2, "dois e-mails saíram de verdade");
ok(l1.restam >= 2, "e o resto continua na fila", "restam " + l1.restam);
ok(agendou >= 1, "reagendou sozinho — a campanha não para por falta de gatilho");

passo("o PDF é por ESCOLA, não por endereço");
ok(pdfsGerados.length <= 2, "não gerou um PDF por e-mail da mesma escola",
   pdfsGerados.length + " PDF(s) para " + emailsEnviados().length + " envios");

passo("chamar de novo no mesmo dia não fura o teto");
const l2 = g.tnCom_enviarLote_();
igual(l2.enviados, 0, "o teto do dia já foi alcançado", l2.mensagem);
igual(l2.motivo, "TETO", "e o motivo é o TETO, não a cota do Google");
ok(String(l2.mensagem).indexOf("amanhã") > -1,
   "a mensagem diz o que acontece a seguir, em vez de só 'limite atingido'",
   l2.mensagem);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A cota do Google no fim");

passo("cota abaixo da reserva do resto do SISGEP");
g.tnCom_ajustarTeto_(500);
g.__cotaEmailRestante = 10;          /* reserva padrão é 40 */
amb.outbox.length = 0;
const l3 = g.tnCom_enviarLote_();

igual(l3.enviados, 0, "não manda nada");
igual(l3.motivo, "RESERVA", "e diz que foi a reserva, não o teto da campanha");
/* A caixa NÃO fica vazia aqui, e é de propósito: sai o AVISO. Afirmar
   "nenhum e-mail" seria afrouxar o teste até ele deixar de provar o que
   importa — que nenhuma ESCOLA recebeu e que o usuário FOI avisado. */
const paraEscola = emailsEnviados().filter(e => /alfa\.com|beta\.com/.test(e));
const paraFinanceiro = emailsEnviados().filter(e => e.indexOf("financeiro@") > -1);
igual(paraEscola.length, 0, "nenhuma escola recebeu ofício");
igual(paraFinanceiro.length, 1,
   "e saiu UM aviso para o financeiro — é o que o motor antigo nunca fez",
   String((amb.outbox[0] || {}).subject || ""));
ok(String((amb.outbox[0] || {}).body || "").indexOf("amanhã") > -1,
   "o aviso diz que a campanha volta sozinha, para ninguém tentar refazer",
   String((amb.outbox[0] || {}).body || "").slice(0, 90));
igual(porStatus("ERRO").length, 0,
   "e NENHUMA linha foi marcada com erro — cota não é veredito sobre o envio");

g.__cotaEmailRestante = 1500;

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Pausar e o aviso que o motor antigo nunca teve");

passo("a função de aviso existe de verdade");
igual(typeof g.tnCom_avisar_, "function",
   "diferente do enviarAlerteLimiteDiario, que é chamado 2x no TaxaAssistencial e não existe");
igual(typeof g.enviarAlerteLimiteDiario, "undefined",
   "prova de que o do outro arquivo continua sem existir");

passo("pausar trava o lote");
g.tnCom_pausar_();
const pausado = g.tnCom_enviarLote_();
igual(pausado.motivo, "PAUSADA", "o lote se recusa a rodar pausado");
igual(pausado.enviados, 0, "e não manda nada");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O painel");

const st = g.tnCom_status_();
igual(st.numero, "521/2026", "o número do ofício, um para todas");
ok(st.total > 0, "conta o total", "total=" + st.total);
ok(st.comunicadas >= 2, "e quantas já foram", "comunicadas=" + st.comunicadas);
igual(st.aCorrigir, 1, "a escola sem e-mail aparece em 'a corrigir', separada das falhas");
ok(st.remetente.ok === true, "e mostra o remetente medido");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O PDF nominal e a CCT anexa",
  "DocumentApp não é emulado — a geração do documento e o anexo da CCT " +
  "continuam sem teste executável. Roteiro manual antes do primeiro disparo.");
naoTestavel("O gatilho reagendando sozinho de hora em hora",
  "o emulador não reproduz agendamento do Apps Script. Aqui se prova que a " +
  "função de reagendar É CHAMADA; que ela dispara no ar, só no ar.");
naoTestavel("O limite de CHAMADAS ao serviço Gmail",
  "MailApp.getRemainingDailyQuota conta DESTINATÁRIOS. O que estourou em " +
  "09/09 foi o limite de chamadas, que o Google não expõe. A segunda linha de " +
  "defesa é o oficio_ehLimiteDoGmail_, tratado no laço.");

resumo();
