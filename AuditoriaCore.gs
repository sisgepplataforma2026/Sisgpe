// ============================================================================
// ARQUIVO: AuditoriaCore.gs
// TRILHA ÚNICA DE AUDITORIA — item 16 do PROMPT-MESTRE (Auditoria e
// Compliance) e a seção AUDITORIA, que lista os 14 campos obrigatórios.
//
// O QUE HAVIA ANTES
// Seis lugares diferentes gravando log, com cabeçalhos incompatíveis:
//   LOG_SISTEMA               DATA_HORA, USUARIO, NUMERO, TIPO, ESCOLA, CNPJ...
//   Auditoria_LOG_ / _Log_    duas grafias da mesma coisa
//   DESPESAS_PAGAMENTOS_LOG   DATA, MODULO, ID_REGISTRO, VALOR_ANTERIOR...
//   Historico_Guias, HistoricoParqueChina, HISTORICO_LEMBRETES
//
// Com a trilha partida em seis, a pergunta que a auditoria existe para
// responder — "quem mexeu neste registro, quando e por quê" — exigia abrir
// seis abas e cruzar na mão. Na prática, ninguém respondia.
//
// POR QUE FIRESTORE E NÃO PLANILHA
// Duas razões concretas, não preferência:
//
//   1. TAMANHO. Planilha do Google tem teto de 10 milhões de células. Os
//      8.000 associados já ocupam 128 mil. Um log com 14 campos e ~200 ações
//      por dia come 1 milhão de células por ano. Em três ou quatro anos a
//      planilha INTEIRA para de aceitar dado — não só o log.
//
//   2. IMUTABILIDADE. Qualquer pessoa com acesso à planilha apaga uma linha
//      de auditoria e não fica rastro. Log que se apaga não é log. No
//      Firestore a regra "allow update, delete: if false" impede isso.
//
// A AUDITORIA NUNCA DERRUBA A OPERAÇÃO
// auditar_() não lança exceção, em nenhuma hipótese. Se o Firestore não
// responder, grava na planilha de reserva; se a planilha também falhar,
// escreve no Logger e devolve. Ninguém fica sem lançar pagamento porque a
// auditoria caiu — esse é o único jeito de a trilha ser aceita nos 28 pontos
// do sistema sem que alguém queira desligá-la.
//
// COMO USAR
//
//   auditar_({
//     registroId: "DESP-2026-0412",
//     modulo: "Financeiro", submodulo: "Pagamentos",
//     acao: "LANCAR_NO_BANCO",
//     sessao: sessao,                       // objeto da sessão; extrai quem é
//     valorAnterior: { status: "APROVADA" },
//     valorNovo:     { status: "LANCADA"  },
//     justificativa: "Lote 08/2026, banco 341",
//     documento: "comprovante-0412.pdf"
//   });
//
// Nenhum campo é obrigatório além de modulo e acao — um log incompleto vale
// mais que log nenhum, e exigir preenchimento completo faria os 28 pontos
// existentes pararem de gravar.
// ============================================================================

var AUD_COLECAO = "historico_acoes";
var AUD_ABA_RESERVA = "SISGEP_Auditoria";
var AUD_MODULO = "auditoria";

// Ações que merecem destaque no painel: mexem em dinheiro, em cadastro de
// pessoa ou desfazem coisa feita.
var AUD_ACOES_CRITICAS = [
  "EXCLUIR", "CANCELAR", "ESTORNAR", "REVOGAR", "DESFILIAR", "REABRIR",
  "APROVAR", "LANCAR_NO_BANCO", "CONFIRMAR_PAGAMENTO", "DEFINIR_AMBIENTE",
  "ALTERAR_PERMISSAO", "EXPORTAR"
];

var AUD_COLUNAS_RESERVA = [
  "DATA_HORA", "REGISTRO_ID", "MODULO", "SUBMODULO", "ACAO", "USUARIO",
  "PERFIL", "SETOR", "ORIGEM", "SESSAO", "VALOR_ANTERIOR", "VALOR_NOVO",
  "JUSTIFICATIVA", "DOCUMENTO", "RESULTADO", "DESTINO"
];

/* ==========================================================================
 * MONTAGEM DO REGISTRO
 * ========================================================================== */

/**
 * Monta o registro nos 14 campos do §15 a partir do que o chamador passou.
 * Separada de propósito: é a parte testável sem tocar em Firestore.
 */
function aud_montar_(dados) {
  dados = dados || {};
  var s = dados.sessao || {};

  var acao = String(dados.acao || "").trim().toUpperCase();

  return {
    // 1-4 identificação
    registroId: String(dados.registroId || "").trim(),
    modulo: String(dados.modulo || "").trim(),
    submodulo: String(dados.submodulo || "").trim(),
    acao: acao,
    // 5-9 quem
    usuario: String(dados.usuario || s.email || s.usuario || "").trim() || "—",
    perfil: String(dados.perfil || s.perfil || "").trim() || "—",
    setor: String(dados.setor || s.setor || "").trim() || "—",
    sessao: String(dados.sessaoId || s.token || "").slice(0, 12),
    origem: String(dados.origem || "PORTAL_ADMIN").trim().toUpperCase(),
    // 10 quando
    dataHora: dados.dataHora instanceof Date ? dados.dataHora : new Date(),
    // 11-14 o quê
    valorAnterior: dados.valorAnterior === undefined ? null : dados.valorAnterior,
    valorNovo: dados.valorNovo === undefined ? null : dados.valorNovo,
    justificativa: String(dados.justificativa || "").trim(),
    documento: String(dados.documento || "").trim(),
    resultado: String(dados.resultado || "SUCESSO").trim().toUpperCase(),
    // derivado — o painel filtra por isto
    critica: aud_ehCritica_(acao)
  };
}

function aud_ehCritica_(acao) {
  var a = String(acao || "").toUpperCase();
  for (var i = 0; i < AUD_ACOES_CRITICAS.length; i++) {
    if (a.indexOf(AUD_ACOES_CRITICAS[i]) > -1) return true;
  }
  return false;
}

/* ==========================================================================
 * GRAVAÇÃO
 * ========================================================================== */

/**
 * Registra a ação. NUNCA lança.
 * Devolve { ok, destino } — destino em FIRESTORE, PLANILHA ou NENHUM.
 */
function auditar_(dados) {
  var registro;
  try {
    registro = aud_montar_(dados);
    if (!registro.modulo || !registro.acao) {
      Logger.log("auditar_: chamada sem modulo ou acao — ignorada.");
      return { ok: false, destino: "NENHUM", mensagem: "Faltou módulo ou ação." };
    }
  } catch (e) {
    Logger.log("auditar_ — falha ao montar: " + e);
    return { ok: false, destino: "NENHUM", mensagem: e.message };
  }

  // 1ª tentativa: Firestore.
  try {
    if (typeof firebaseDisponivel_ === "function" && firebaseDisponivel_()) {
      var r = firebaseCriar_(AUD_COLECAO, registro);
      if (r && r.ok) return { ok: true, destino: "FIRESTORE", id: r.id };
      Logger.log("auditar_ — Firestore recusou: " + (r && r.mensagem));
    }
  } catch (e) {
    Logger.log("auditar_ — Firestore falhou: " + e);
  }

  // 2ª: planilha de reserva. O log não pode simplesmente sumir.
  try {
    aud_gravarNaPlanilha_(registro);
    return { ok: true, destino: "PLANILHA" };
  } catch (e2) {
    Logger.log("auditar_ — reserva na planilha também falhou: " + e2 +
      " | registro: " + JSON.stringify(registro).slice(0, 300));
    return { ok: false, destino: "NENHUM", mensagem: e2.message };
  }
}

function aud_gravarNaPlanilha_(r) {
  var aba = abaSisgep_(AUD_ABA_RESERVA, AUD_COLUNAS_RESERVA);
  aba.appendRow([
    r.dataHora, r.registroId, r.modulo, r.submodulo, r.acao, r.usuario,
    r.perfil, r.setor, r.origem, r.sessao,
    r.valorAnterior === null ? "" : JSON.stringify(r.valorAnterior),
    r.valorNovo === null ? "" : JSON.stringify(r.valorNovo),
    r.justificativa, r.documento, r.resultado, "RESERVA"
  ]);
}

/* ==========================================================================
 * CONSULTA
 * ========================================================================== */

/**
 * Consulta a trilha. Lê do Firestore; se não estiver configurado ou falhar,
 * lê da planilha de reserva — assim a tela funciona nos dois cenários.
 */
function auditoriaConsultar(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, AUD_MODULO, false);
  filtros = filtros || {};

  var condicoes = [];
  if (filtros.modulo) condicoes.push({ campo: "modulo", op: "EQUAL", valor: filtros.modulo });
  if (filtros.usuario) condicoes.push({ campo: "usuario", op: "EQUAL", valor: filtros.usuario });
  if (filtros.acao) condicoes.push({ campo: "acao", op: "EQUAL", valor: filtros.acao });
  if (filtros.registroId) condicoes.push({ campo: "registroId", op: "EQUAL", valor: filtros.registroId });
  if (filtros.apenasCriticas === true) condicoes.push({ campo: "critica", op: "EQUAL", valor: true });

  if (typeof firebaseDisponivel_ === "function" && firebaseDisponivel_()) {
    var r = firebaseConsultar_(AUD_COLECAO, condicoes, "dataHora", true,
                               filtros.limite || 200);
    if (r && r.ok) {
      return { ok: true, fonte: "FIRESTORE", total: r.total, acoes: r.itens };
    }
    // Consulta com filtro composto exige índice. O erro traz o link que o
    // cria; preservar a mensagem é o que permite resolver em um clique.
    return { ok: true, fonte: "PLANILHA", avisoFirestore: r && r.mensagem,
      total: 0, acoes: aud_lerDaPlanilha_(condicoes, filtros.limite || 200) };
  }

  return { ok: true, fonte: "PLANILHA",
    acoes: aud_lerDaPlanilha_(condicoes, filtros.limite || 200) };
}

function aud_lerDaPlanilha_(condicoes, limite) {
  var aba = abaSisgep_(AUD_ABA_RESERVA, AUD_COLUNAS_RESERVA);
  if (!aba || aba.getLastRow() < 2) return [];

  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, AUD_COLUNAS_RESERVA.length).getValues();
  var itens = dados.map(function (l) {
    return {
      dataHora: l[0], registroId: l[1], modulo: l[2], submodulo: l[3],
      acao: l[4], usuario: l[5], perfil: l[6], setor: l[7], origem: l[8],
      sessao: l[9], valorAnterior: l[10], valorNovo: l[11],
      justificativa: l[12], documento: l[13], resultado: l[14],
      critica: aud_ehCritica_(l[4])
    };
  });

  (condicoes || []).forEach(function (c) {
    itens = itens.filter(function (i) { return String(i[c.campo]) === String(c.valor); });
  });

  itens.reverse();
  return itens.slice(0, limite);
}

/** Contagens do painel (item 16). */
function auditoriaPainel(tokenSessao) {
  exigirModulo_(tokenSessao, AUD_MODULO, false);

  var r = auditoriaConsultar({ limite: 1000 }, tokenSessao);
  var acoes = r.acoes || [];
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");

  function dia(v) {
    try {
      var d = (v instanceof Date) ? v : new Date(v);
      return Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd");
    } catch (e) { return ""; }
  }

  return {
    ok: true,
    fonte: r.fonte,
    avisoFirestore: r.avisoFirestore || "",
    total: acoes.length,
    hoje: acoes.filter(function (a) { return dia(a.dataHora) === hoje; }).length,
    criticas: acoes.filter(function (a) { return a.critica; }).length,
    falhas: acoes.filter(function (a) { return String(a.resultado) === "FALHA"; }).length,
    porModulo: acoes.reduce(function (m, a) {
      var k = a.modulo || "—"; m[k] = (m[k] || 0) + 1; return m;
    }, {})
  };
}

/* ==========================================================================
 * PONTE COM OS LOGS ANTIGOS
 *
 * Os 28 pontos que já gravam log continuam chamando o que sempre chamaram.
 * Estas funções recebem o formato velho e o traduzem para a trilha nova, de
 * modo que a migração acontece sem tocar nos 28 pontos de uma vez.
 * ========================================================================== */

/** Formato do LOG_SISTEMA (ofícios): { usuario, numero, tipo, escola, cnpj, email, codigo } */
function aud_deLogSistema_(d) {
  d = d || {};
  return auditar_({
    registroId: d.numero || "",
    modulo: "Documentos", submodulo: "Ofícios",
    acao: String(d.tipo || "EMITIR_OFICIO").toUpperCase(),
    usuario: d.usuario,
    documento: d.codigo || "",
    justificativa: [d.escola, d.cnpj, d.email].filter(Boolean).join(" · "),
    origem: "PORTAL_ADMIN"
  });
}

/** Formato do log financeiro: { modulo, idRegistro, usuario, valorAnterior, valorNovo, motivo } */
function aud_deLogFinanceiro_(d) {
  d = d || {};
  return auditar_({
    registroId: d.idRegistro || d.ID_REGISTRO || "",
    modulo: d.modulo || "Financeiro",
    acao: String(d.acao || "ALTERAR_VALOR").toUpperCase(),
    usuario: d.usuario,
    valorAnterior: d.valorAnterior !== undefined ? d.valorAnterior : d.VALOR_ANTERIOR,
    valorNovo: d.valorNovo !== undefined ? d.valorNovo : d.VALOR_NOVO,
    justificativa: d.motivo || d.MOTIVO || ""
  });
}
