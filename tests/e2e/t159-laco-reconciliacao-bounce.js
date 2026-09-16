/**
 * TESTE — O LAÇO: RECONCILIAR E RE-CONDENAR, DE TRÊS EM TRÊS HORAS
 *
 * O QUE ORIGINOU, 11/09/2026. O usuário abriu o Histórico filtrado em falha de
 * entrega e viu SETE ofícios da MESMA escola — FAESA —, de 07/05 a 20/08. No
 * dia anterior eram outros três. Perguntou a coisa certa: *"Posso reenviar?
 * Ontem não estava com falha."*
 *
 * A RESPOSTA ERA NÃO, e o LOG_SISTEMA provou por quê:
 *
 *   04/09 05:39   144/2026 (REENVIO)  ->  luiza.stefani@, karolina.caldeira@
 *   ...
 *   04/09 17:33:30   OFICIOS_REENVIO_RECONCILIADO   9 ofício(s)
 *   04/09 17:33:42   144/2026 (FALHA_ENTREGA)  thalia.ferreira@faesa.br
 *                    └─ DOZE SEGUNDOS depois
 *
 * Os sete já tinham sido reenviados em 04/09, para endereços NOVOS — o
 * cadastro já havia sido corrigido. O que aparecia na tela era status velho
 * sendo reescrito 8 vezes por dia (02:33, 05:33, 08:33...), por sete dias.
 *
 * O LAÇO INTEIRO ESTÁ DENTRO DE UMA FUNÇÃO SÓ, e a ordem é deliberada —
 * `verificarFalhasEntregaOficios` reconcilia ANTES de checar bounce, para o
 * ofício reconciliado ser reexaminado no mesmo passe. A intenção é boa. O que
 * ela não previu:
 *
 *   1. a reconciliação grava Status = ENVIADO e JA_FALHOU = SIM,
 *      mas NÃO grava REENVIADO_EM;
 *   2. sem REENVIADO_EM, o "último envio" conhecido é o ORIGINAL — maio;
 *   3. o bounce guardado no Gmail é de setembro e sobrevive 90 dias;
 *   4. setembro > maio, então a falha "é nova" -> FALHA_ENTREGA de novo.
 *
 * Cada parte está certa sozinha. Juntas, se desfazem para sempre.
 *
 * O CUSTO NÃO É SÓ O STATUS ERRADO: são 8 varreduras de Gmail por dia, há uma
 * semana, no MESMO orçamento que entrega os ofícios. É o item 77 outra vez —
 * e foi parte do que faltou para os 517 a 520 saírem em 10/09.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const MORTO = "thalia.ferreira@faesa.br";
const NOVOS = "karolina.caldeira@faesa.br, luiza.stefani@faesa.br";

const ENVIO_ORIGINAL = new Date(2026, 4, 7, 12, 54);   /* 07/05/2026 */
const DATA_REENVIO   = new Date(2026, 8, 4,  5, 39);   /* 04/09/2026 */
const DATA_BOUNCE    = new Date(2026, 8, 1,  8, 33);   /* 01/09 — ANTES do reenvio */

/* ── O Controle, na forma exata da produção ──────────────────────────────
   O endereço continua o MORTO: reenviar para outro endereço não reescreve
   "E-mails (todos)". É por ele que o bounce casa. */
const CAB = ["Número do Ofício", "Escola", "E-mails (todos)", "Status",
             "Data envio ofício", "Observações", "JA_FALHOU", "REENVIADO_EM"];
const reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, CAB.length).setValues([CAB]);
reg.getRange(2, 1, 1, CAB.length).setValues([[
  "144/2026", "FUNDACAO DE ASSISTENCIA E EDUCACAO - FAESA", MORTO,
  "FALHA_ENTREGA", ENVIO_ORIGINAL, "", "SIM", ""
]]);

/* ── O log diz que o ofício FOI reenviado, em 04/09 ──────────────────── */
const log = ss.getSheetByName("LOG_SISTEMA") || ss.insertSheet("LOG_SISTEMA");
log.getRange(1, 1, 1, 9).setValues([[
  "DATA_HORA","USUARIO","NUMERO","TIPO","ESCOLA","CNPJ","EMAIL_DESTINO","CODIGO","SISTEMA_VERSAO"
]]);
log.getRange(2, 1, 1, 9).setValues([[
  DATA_REENVIO, "financeiro@sindeducacao.com", "144/2026 (REENVIO)",
  "Filiação", "FAESA", "", NOVOS, "", "2.1.2000"
]]);

/* ── O bounce que está no Gmail, do endereço MORTO, ANTERIOR ao reenvio ── */
g.GmailApp.search = () => [{
  getMessages: () => [{
    getDate: () => DATA_BOUNCE,
    getPlainBody: () => "Delivery failed: " + MORTO + " — address not found",
    getBody:      () => "Delivery failed: " + MORTO + " — address not found"
  }]
}];

const statusDe = () => String(reg.getRange(2, 4).getValue() || "").trim().toUpperCase();
const reenviadoEm = () => reg.getRange(2, 8).getValue();

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · o laço entre reconciliar e re-condenar");

passo("o ponto de partida é o da produção: falha no status, reenvio no log");

igual(statusDe(), "FALHA_ENTREGA", "o 144 está como falha de entrega");
ok(!reenviadoEm(), "  e REENVIADO_EM está vazio",
   "é essa ausência que apaga a única data que quebraria o laço");

passo("UMA execução faz as duas coisas — é onde o laço mora");

const r = g.verificarFalhasEntregaOficios();
ok(r && r.ok !== false, "a rotina roda até o fim");

passo("O QUE TEM QUE ACONTECER: reconciliado continua reconciliado");

/* O bounce é de 01/09 e o reenvio é de 04/09. Um bounce ANTERIOR ao reenvio
   não diz nada sobre ele — é notícia velha sobre um endereço aposentado. */
igual(statusDe(), "ENVIADO",
      "o 144 fica ENVIADO depois da rodada",
      "antes voltava a FALHA_ENTREGA 12 segundos depois de ser reconciliado");

passo("e a data do reenvio fica gravada, que é o que fecha o buraco");

const dt = reenviadoEm();
ok(dt instanceof Date, "REENVIADO_EM passa a ter data");
igual(dt && dt.getTime(), DATA_REENVIO.getTime(),
      "  e é a data que o LOG registra, não a de agora",
      "gravar 'agora' esconderia quando o reenvio realmente aconteceu");

passo("a rodada seguinte não mexe mais nele — o laço não reabre");

const antes = statusDe();
g.verificarFalhasEntregaOficios();
igual(statusDe(), antes, "segunda rodada: continua ENVIADO",
      "eram 8 rodadas por dia, 7 dias, reescrevendo o mesmo status");

passo("MAS bounce POSTERIOR ao reenvio continua valendo");

/* O conserto não pode cegar a detecção: se o endereço novo também quicar,
   depois do reenvio, isso é notícia de verdade e tem de aparecer. */
g.GmailApp.search = () => [{
  getMessages: () => [{
    getDate: () => new Date(2026, 8, 9, 10, 0),   /* 09/09 — DEPOIS do reenvio */
    getPlainBody: () => "Delivery failed: " + MORTO,
    getBody:      () => "Delivery failed: " + MORTO
  }]
}];
g.verificarFalhasEntregaOficios();
igual(statusDe(), "FALHA_ENTREGA",
      "bounce depois do reenvio volta a marcar falha",
      "senão o conserto trocaria alarme falso por silêncio, que é pior");

resumo();
