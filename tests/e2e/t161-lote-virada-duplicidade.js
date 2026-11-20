/**
 * TESTE — A VIRADA DO LOTE NÃO PODE REENVIAR A ESCOLA INTEIRA
 *
 * DE ONDE VEIO, 11/09/2026. O usuário pediu a comunicação da Taxa Negocial
 * para as 679 escolas da base, *"escalonado, não tudo de uma vez"*. Lendo o
 * motor que já faz envio em massa — `enviarOficioTaxaAssistencialPRO_` — achei
 * um caso que o escalonamento torna rotineiro, e reproduzi antes de afirmar.
 *
 * O DEFEITO. O laço tinha `break` por limite DENTRO do envio de cada endereço,
 * e a escrita do status era uma cadeia de três `if` SEM `else`:
 *
 *     enviou tudo                    -> ENVIADO
 *     enviou parte, com erro         -> ERRO parcial
 *     não enviou nada, com erro      -> ERRO
 *     enviou parte, SEM erro         -> (nada é escrito)
 *
 * O quarto caso é exatamente o da virada de lote. A linha ficava PENDENTE —
 * que significa "nunca recebeu" — e no lote seguinte a escola saía inteira de
 * novo. O primeiro endereço recebia o MESMO número de ofício duas vezes.
 *
 * A REPRODUÇÃO, antes do conserto: fila de 3 endereços, contador da hora em
 * 99 de 100, limite virando no meio da primeira escola.
 *
 *     rodada 1: enviados 1   status PENDENTE | PENDENTE
 *     rodada 2: enviados 3   saíram: alfa1@, alfa1@, alfa2@, beta@
 *     >>> alfa1@ recebeu 2 vezes — 4 envios para 3 endereços
 *
 * E a mensagem da rodada 1 dizia *"Restam 2 escola(s) pendente(s)"*, contando
 * a ALFA como se nada tivesse saído para ela. Quem lê a tela não desconfia.
 *
 * O CONSERTO TEM DUAS PARTES, e as duas são testadas aqui:
 *   1. escola que não cabe no lote não começa — a checagem vem antes até do
 *      PDF, então escola adiada não gasta cópia de Docs nem arquivo no Drive;
 *   2. toda linha que o laço tocou sai com veredito escrito — o `else` que
 *      faltava, gravando ERRO (nunca PENDENTE, que reenviaria tudo).
 *
 * O QUE ESTE TESTE NÃO COBRE: PDF de verdade (DocumentApp não é emulado) e
 * agendamento de gatilho. Ambos são substituídos por dublê — o objeto aqui é a
 * contabilidade de quem já recebeu, não a geração do documento.
 */
const b = require("./base");
const { g, amb } = b.subir({ gmailAliases: ["secretaria@sindeducacao.com",
                                            "financeiro@sindeducacao.com"] });
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const props = g.PropertiesService.getScriptProperties();

/* ── dublês: o que o emulador não alcança e não é o objeto deste teste ── */
g.gerarPDFUniversal_ = function (cfg) {
  pdfsGerados.push(cfg.nomeArquivo);
  return { pdf: { getBlob: () => ({ nome: cfg.nomeArquivo }), getId: () => "PDF-FAKE" } };
};
g.obterPastaPorTipo_ = function () { return { getId: () => "PASTA-FAKE" }; };
let pdfsGerados = [];
let agendou = 0;
g.agendarProximoLoteTaxaAssistencial_ = function () { agendou++; };

/* ── a aba de registro, com os cabeçalhos que appendRowByHeader_ procura ── */
const CAB_REG = ["Status","Número do Ofício","CONFIG","Log_Sistema","Sistema_Versão",
  "Data envio ofício","TIPO","Unidade","Escola (Razão Social)","CNPJ",
  "E-mail (principal)","E-mails (todos)","Colaborador(es)","Observações",
  "Link PDF (Drive)","Link Ficha"];
const reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, CAB_REG.length).setValues([CAB_REG]);

const CAB_FILA = ["NUMERO_OFICIO","ESCOLA","CNPJ","EMAILS","STATUS","ERRO","DATA_HORA","USUARIO"];
const fila = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL") || ss.insertSheet("ENVIO_TAXA_ASSISTENCIAL");

/** Remonta a fila e o contador da hora. `jaEnviados` é onde o contador começa. */
function armar(jaEnviados) {
  fila.clearContents();
  fila.getRange(1, 1, 1, CAB_FILA.length).setValues([CAB_FILA]);
  fila.getRange(2, 1, 2, CAB_FILA.length).setValues([
    ["521/2026","COLEGIO ALFA","11.111.111/0001-11","alfa1@escola.com, alfa2@escola.com","PENDENTE","","",""],
    ["521/2026","COLEGIO BETA","22.222.222/0001-22","beta@escola.com","PENDENTE","","",""]
  ]);
  props.setProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO", "521/2026");
  props.setProperty("TAXA_ASSISTENCIAL_CODIGO", "COD-521");
  props.setProperty("TAXA_ASSISTENCIAL_HORA_CONTROLE",
    g.Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd-HH"));
  props.setProperty("TAXA_ASSISTENCIAL_EMAILS_ENVIADOS_HORA", String(jaEnviados));
  amb.outbox.length = 0;
  pdfsGerados = [];
  agendou = 0;
}

/** Vira a hora, para o contador nascer zerado como na produção. */
function viraAHora() { props.setProperty("TAXA_ASSISTENCIAL_HORA_CONTROLE", "2020-01-01-00"); }

const disparar = () => g.enviarOficioTaxaAssistencialPRO_({ assunto: "Taxa", corpo: "corpo {{ESCOLA}}" });
const destinos = () => amb.outbox.map(m => String(m.to || "")).filter(Boolean);
const quantasVezes = (e) => destinos().filter(d => d.indexOf(e) > -1).length;
const statusDe = (linha) => String(fila.getRange(linha, 5).getValue() || "");
const notaDe   = (linha) => String(fila.getRange(linha, 6).getValue() || "");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A virada do lote no meio de uma escola");

/* 99 de 100: cabe UM e-mail, e a ALFA precisa de dois. */
armar(99);

passo("rodada 1 — o limite vira no meio da ALFA");
const r1 = disparar();

ok(r1.enviados === 0,
   "escola que não cabe no lote não começa",
   "enviados=" + r1.enviados);
igual(destinos(), [],
   "nenhum e-mail saiu pela metade");
ok(pdfsGerados.length === 0,
   "escola adiada não gasta PDF nem cópia no Drive",
   pdfsGerados.length + " PDF(s)");
igual([statusDe(2), statusDe(3)], ["PENDENTE", "PENDENTE"],
   "as duas continuam PENDENTE — e agora isso é verdade");
ok(agendou === 1,
   "o próximo lote foi reagendado, a campanha não para sozinha");

passo("rodada 2 — hora nova, a fila roda de novo");
viraAHora();
const r2 = disparar();

ok(quantasVezes("alfa1@escola.com") === 1,
   "alfa1@ recebeu UMA vez — era aqui que vinha a duplicata",
   quantasVezes("alfa1@escola.com") + " vez(es)");
ok(quantasVezes("alfa2@escola.com") === 1, "alfa2@ recebeu uma vez");
ok(quantasVezes("beta@escola.com")  === 1, "beta@ recebeu uma vez");
igual(destinos().length, 3,
   "3 endereços na fila, 3 envios — antes do conserto eram 4");
igual([statusDe(2), statusDe(3)], ["ENVIADO", "ENVIADO"],
   "as duas escolas terminam ENVIADO");
ok(r2.finalizado === true, "a campanha se declara terminada");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Toda linha que o laço tocou sai com veredito escrito");

/* O caso extremo que a guarda deixa passar de propósito: escola maior que o
   lote inteiro. Sem a guarda a campanha travaria nela para sempre; com ela, a
   escola começa no lote limpo e o `else` registra o que aconteceu. Aqui o
   limite é atingido no meio da ALFA com o contador em zero. */
armar(0);
const LIMITE = 100;
fila.getRange(2, 4).setValue(
  Array.from({ length: LIMITE + 1 }, (_, i) => "muitos" + i + "@escola.com").join(", ")
);

passo("escola com mais endereços do que o lote inteiro");
disparar();

ok(statusDe(2) !== "PENDENTE",
   "a linha NÃO fica PENDENTE — PENDENTE reenviaria tudo e é o bug de volta",
   "status=" + statusDe(2));
igual(statusDe(2), "ERRO",
   "grava ERRO: sai da fila automática e vai para o reenvio com gente olhando");
ok(notaDe(2).indexOf("Envio parcial") === 0,
   "a nota diz que foi parcial",
   notaDe(2).slice(0, 60));
ok(/\d+ de \d+ endere/.test(notaDe(2)),
   "a nota diz QUANTOS já receberam, para quem for reenviar conferir");
ok(notaDe(2).indexOf("número do ofício é o mesmo") > -1 ||
   notaDe(2).indexOf("numero do oficio e o mesmo") > -1,
   "a nota avisa que o número do ofício se repete");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O aviso de que a campanha pausou",
  "enviarAlerteLimiteDiario é chamada duas vezes em TaxaAssistencial.gs e não " +
  "existe em lugar nenhum do projeto — typeof devolve undefined. As duas " +
  "chamadas estão dentro de try/catch que engole. Não é bug deste laço: é " +
  "função que nunca foi escrita, e fica registrada para a campanha nova.");

naoTestavel("O PDF nominal e o anexo da CCT",
  "DocumentApp não é emulado. A geração do documento continua sem teste " +
  "executável — roteiro manual quando a campanha for ao ar.");

resumo();
