/**
 * TESTE — CANCELAR DEVOLVE A VAGA NO CONTADOR QUE A PÁGINA PÚBLICA LÊ
 *
 * O QUE ORIGINOU, 14/09/2026. O usuário descreveu um caso de operação:
 *
 *   "Às vezes um associado não quer ir e temos que cancelar."
 *
 * O cancelamento do ingresso fazia quase tudo certo — marcava CANCELADO,
 * matava o QR (a portaria recusa) e liberava a identidade. Mas devolvia a
 * vaga no contador ERRADO.
 *
 * SÃO DOIS MEDIDORES PARALELOS dos mesmos 2.000 lugares, em estágios
 * diferentes do mesmo caminho:
 *
 *   reservasEventos.reservadas  ← a INSCRIÇÃO pública soma aqui, e é ESTE
 *                                 que a página lê para dizer "esgotadas"
 *   contadores.vagasUsadas      ← a EMISSÃO do ingresso soma aqui
 *
 * A mesma pessoa ocupa uma unidade em cada. Cancelar baixava só o segundo:
 * o ingresso morria certo e a cadeira continuava ocupada aos olhos do
 * público. Algumas dezenas de desistências em 2.000 lugares e a inscrição
 * fecharia com cadeira vazia no salão, no dia do evento.
 *
 * E o índice de duplicidade tem o mesmo par. `eventoIdentidades` já era
 * liberado; `inscricaoUnicaEventos` — o que a página pública consulta — não.
 * Quem cancelasse e mudasse de ideia não conseguiria se inscrever de novo.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: o Firestore de verdade. Aqui ele é um Map em
 * memória, no mesmo padrão do t152. O que se prova é a REGRA — quais
 * documentos mudam e em que direção. Que a página pública passa a mostrar a
 * vaga livre, só o ensaio no ar responde.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ADM = b.logar(g, "wanderson");

/* ─── Firestore em memória (mesmo padrão do t152) ────────────────────────── */
const BANCO = new Map();
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o), (k, v) =>
  (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) ? new Date(v) : v);

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => { const v = BANCO.get(chave(col, id)); return v ? clonar(v) : null; };
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  return out;
};
g.fs_queryEquals_ = (col, campo, valor) =>
  g.fs_list_(col).filter(d => String(d[campo]) === String(valor));

const EV = g.EMISSAO_CFG.EVENTO_ID;
const CPF = "08538104780";

/** Estado inicial: uma pessoa inscrita E com ingresso emitido. */
function montar(statusIngresso) {
  BANCO.clear();
  g.fs_set_("reservasEventos", EV, { eventoId: EV, limite: 2000, reservadas: 5 });
  g.fs_set_("contadores", EV, { limite: 2000, vagasUsadas: 3, ultimoNumero: 428 });

  g.fs_set_("inscricoesEventos", "INS-1", {
    inscricaoId: "INS-1", eventoId: EV, pessoaId: "", cpf: CPF,
    nome: "Wanderson Nascimento Castelo",
    status: g.COMPASSO_STATUS.VALIDADA, vagaReservada: true
  });

  const kIdx = g.compasso_chavePessoaEvento_(EV, "", CPF);
  g.fs_set_("inscricaoUnicaEventos", kIdx, {
    eventoId: EV, inscricaoId: "INS-1", status: "ATIVA"
  });

  g.fs_set_("ingressos", "ING-1", {
    ingressoId: "ING-1", eventoId: EV, inscricaoId: "INS-1",
    numero: "FCV-2026-000428", nome: "Wanderson Nascimento Castelo",
    cpf: CPF, pessoaId: "", status: statusIngresso || "EMITIDO",
    qrTokenHash: "HASH-DO-QR"
  });
  return kIdx;
}

const reservas = () => g.fs_get_("reservasEventos", EV).reservadas;
const usadas   = () => g.fs_get_("contadores", EV).vagasUsadas;

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O associado desistiu — cancelar o ingresso (V2)");

const idx1 = montar("EMITIDO");
igual(reservas(), 5, "antes: 5 vagas reservadas pelo público");
igual(usadas(), 3, "antes: 3 ingressos emitidos");

const r1 = g.compasso_cancelarIngressoV2("ING-1", "SOLICITACAO_ASSOCIADO", ADM);
igual(r1.ok, true, "o cancelamento aceita", JSON.stringify(r1).slice(0, 70));

passo("o ingresso morre, e morre na portaria");
igual(g.fs_get_("ingressos", "ING-1").status, "CANCELADO", "o ingresso fica CANCELADO");
igual(g.fs_get_("qrTokens", "HASH-DO-QR").status, "CANCELADO",
   "e o QR também — o PDF continua no celular da pessoa, quem barra é o servidor");

passo("a vaga volta nos DOIS contadores");
igual(usadas(), 2, "o contador de ingressos baixa — isso já funcionava");
igual(reservas(), 4,
   "e o da INSCRIÇÃO também — é este que a página pública lê para dizer 'esgotadas'");

passo("e o CPF é liberado para se inscrever de novo");
igual(g.fs_get_("inscricaoUnicaEventos", idx1).status, "CANCELADA",
   "o índice que a página pública consulta sai de ATIVA");
igual(g.fs_get_("inscricoesEventos", "INS-1").vagaReservada, false,
   "a inscrição deixa de segurar vaga");
igual(g.fs_get_("inscricoesEventos", "INS-1").ingressoStatus, "CANCELADO",
   "e registra que o ingresso dela foi cancelado");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Quem já entrou na festa NÃO devolve vaga");

montar("UTILIZADO");
const r2 = g.compasso_cancelarIngressoV2("ING-1", "OUTRO", ADM);
igual(r2.ok, true, "cancela mesmo assim — pode ser fraude a apurar");
igual(r2.avisoJaEntrou, true, "mas avisa que a pessoa já entrou");
igual(usadas(), 3, "o contador de ingressos não mexe");
igual(reservas(), 5,
   "nem o da inscrição — a cadeira foi ocupada de verdade, devolver seria contar duas vezes");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Cancelar duas vezes não devolve vaga duas vezes");

montar("EMITIDO");
g.compasso_cancelarIngressoV2("ING-1", "SOLICITACAO_ASSOCIADO", ADM);
igual(reservas(), 4, "primeira vez devolve");
const r3 = g.compasso_cancelarIngressoV2("ING-1", "SOLICITACAO_ASSOCIADO", ADM);
igual(r3.ok, false, "a segunda é recusada", String(r3.erro || ""));
igual(reservas(), 4, "e a vaga continua devolvida uma vez só");

passo("a trava é a marca na inscrição, não a memória de quem clicou");
const insSolta = g.fs_get_("inscricoesEventos", "INS-1");
igual(g.compasso_liberarReservaDaInscricao_(insSolta, "CANCELADA"), false,
   "liberar de novo uma inscrição que já soltou a vaga não faz nada");
igual(reservas(), 4, "o contador não se mexe");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O cancelamento ANTIGO (V1) faz a mesma coisa");

/* Havia dois caminhos de cancelamento e o antigo nem tocava na inscrição:
   baixava o contador de ingressos e ia embora. Dois caminhos para a mesma
   decisão precisam terminar no mesmo lugar, senão o resultado depende de por
   qual tela a pessoa passou. */
const idx4 = montar("EMITIDO");
const r4 = g.emissao_cancelarIngresso("ING-1", ADM);
igual(r4.ok, true, "o caminho antigo cancela");
igual(usadas(), 2, "baixa o contador de ingressos");
igual(reservas(), 4, "E TAMBÉM o da inscrição — antes esta linha falhava");
igual(g.fs_get_("inscricaoUnicaEventos", idx4).status, "CANCELADA",
   "libera o CPF igual ao caminho novo");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Sem ingresso emitido, quem devolve a vaga é a decisão administrativa");

/* A pessoa que desiste ANTES de o ingresso sair não passa pelo cancelamento
   de ingresso — não há ingresso. O caminho é a decisão administrativa com o
   motivo SOLICITACAO_ASSOCIADO, que já existe na lista fechada. */
montar("EMITIDO");
BANCO.delete(chave("ingressos", "ING-1"));
ok(g.COMPASSO_MOTIVOS_REPROVACAO.indexOf("SOLICITACAO_ASSOCIADO") > -1,
   "o motivo 'o associado pediu' existe na lista de reprovação");

const r5 = g.compasso_validarDecisaoAdmin(
  "INS-1", g.COMPASSO_STATUS.REPROVADA, "SOLICITACAO_ASSOCIADO", "", ADM);
igual(r5.ok, true, "a decisão é aceita");
igual(reservas(), 4, "e a vaga volta para o público");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("A página pública mostrando a vaga livre",
  "o Firestore aqui é um Map em memória. Que o número de vagas restantes " +
  "muda na tela depois de um cancelamento, só o ensaio em homologação responde.");
naoTestavel("As duas cópias da mesma regra",
  "compasso_validarDecisaoAdmin tem a liberação inline, no ramo REPROVADA, e " +
  "não foi migrada para o compasso_liberarReservaDaInscricao_: aquela função é " +
  "uma linha só, densa, e está em uso. Quem mexer numa precisa olhar a outra.");

resumo();
