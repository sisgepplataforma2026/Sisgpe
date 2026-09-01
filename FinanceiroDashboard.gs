// ============================================================================
// ARQUIVO: FinanceiroDashboard.gs
//
// Agregador executivo da Central Financeira. Responde, num lugar só, as três
// perguntas que a Diretoria e o Conselho Fiscal fazem: quanto entrou, quanto
// saiu e quanto está pendente.
//
// Achado da auditoria do módulo Financeiro que originou este arquivo: cada
// fonte de recurso só era visível entrando na tela específica. Não existia
// nenhum painel que somasse despesas, receitas, mensalidade, taxa assistencial
// e cobrança de relação nominal — o que tornava impossível olhar o caixa do
// sindicato sem abrir cinco telas e somar na mão.
//
// Este arquivo NÃO tem regra de negócio própria e NÃO grava nada. Ele só chama
// os resumos que cada módulo já produz e junta o resultado. Se um módulo
// falhar, o painel mostra os demais e sinaliza a fonte indisponível — um erro
// em taxa assistencial não pode derrubar a visão de despesas.
// ============================================================================

/**
 * Fonte única do painel executivo. Cada bloco é isolado em try/catch próprio:
 * a indisponibilidade de uma fonte vira aviso na tela, não erro geral.
 */
function finDashboardExecutivo(tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);

  var out = {
    ok: true,
    geradoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    fontesIndisponiveis: [],
    despesas: null,
    receitas: null,
    mensalidade: null,
    taxaAssistencial: null,
    cobranca: null,
    consolidado: { entrou: 0, saiu: 0, aReceber: 0, aPagar: 0, saldo: 0 }
  };

  // ── SAÍDA: despesas ──────────────────────────────────────────────────────
  try {
    var d = obterResumoDespesas_interno_();
    if (d && d.ok && d.resumo) {
      out.despesas = {
        total:        Number(d.resumo.total || 0),
        pagas:        Number(d.resumo.totalPagos || 0),
        pendentes:    Number(d.resumo.totalPendentes || 0),
        vencidas:     Number(d.resumo.totalVencidas || 0),
        urgentes:     Number(d.resumo.totalUrgentes || 0),
        aguardandoNF: Number(d.resumo.totalAguardandoDoc || 0),
        naContabil:   Number(d.resumo.totalEnviadosContab || 0),
        valorTotal:   Number(d.resumo.valorTotal || 0),
        valorPago:    Number(d.resumo.valorPago || 0),
        valorPendente:Number(d.resumo.valorPendente || 0)
      };
      out.consolidado.saiu   += out.despesas.valorPago;
      out.consolidado.aPagar += out.despesas.valorPendente;
    } else {
      out.fontesIndisponiveis.push("Despesas");
    }
  } catch (e) {
    Logger.log("finDashboardExecutivo/despesas: " + e);
    out.fontesIndisponiveis.push("Despesas");
  }

  // ── ENTRADA: receitas lançadas (eventos, Parque do China, manuais) ───────
  try {
    var r = obterResumoReceitas(tokenSessao);
    out.receitas = {
      lancamentos: Number((r && r.totalReceitas) || 0),
      valorTotal:  Number((r && r.valorTotal) || 0)
    };
    out.consolidado.entrou += out.receitas.valorTotal;
  } catch (e) {
    Logger.log("finDashboardExecutivo/receitas: " + e);
    out.fontesIndisponiveis.push("Receitas");
  }

  // ── ENTRADA: mensalidade sindical (CCT cl. 56) ──────────────────────────
  // Aqui o controle é por associado e por status de confirmação do desconto,
  // não por valor — por isso entra como contagem, não como dinheiro. Somar
  // valor de mensalidade exigiria o valor individual, que ainda não é
  // registrado (ver FIN-F6).
  try {
    var m = listarMensalidadeStatus({});
    if (m && m.ok && m.resumo) {
      out.mensalidade = {
        total:          Number(m.resumo.total || 0),
        confirmados:    Number(m.resumo.confirmados || 0),
        aguardando:     Number(m.resumo.aguardando || 0),
        pendentes:      Number(m.resumo.pendentes || 0),
        cobracaEnviada: Number(m.resumo.cobracaEnviada || 0),
        regularizados:  Number(m.resumo.regularizados || 0)
      };
    } else {
      out.fontesIndisponiveis.push("Mensalidade");
    }
  } catch (e) {
    Logger.log("finDashboardExecutivo/mensalidade: " + e);
    out.fontesIndisponiveis.push("Mensalidade");
  }

  // ── COBRANÇA: taxa assistencial (status do envio do ofício) ─────────────
  try {
    var t = obterStatusTaxaAssistencialDashboard();
    out.taxaAssistencial = {
      ativa:    !!(t && t.ativa),
      numero:   String((t && t.numero) || ""),
      total:    Number((t && t.total) || 0),
      enviado:  Number((t && t.enviado) || 0),
      pendente: Number((t && t.pendente) || 0),
      erro:     Number((t && t.erro) || 0)
    };
  } catch (e) {
    Logger.log("finDashboardExecutivo/taxaAssistencial: " + e);
    out.fontesIndisponiveis.push("Taxa Assistencial");
  }

  // ── COBRANÇA: relação nominal das escolas (CCT cl. 55) ──────────────────
  try {
    // cob_listarPainel já devolve total/recebidas/pendentes calculados e a
    // competência corrente. "Crítica" ali é um STATUS próprio (COB_STATUS.CRITICA),
    // atribuído pela régua de lembretes — não um cálculo por dias. Conta pelo
    // mesmo critério do painel de Cobrança (CobrancaAdmin.html:202) para os dois
    // números nunca divergirem.
    var c = cob_listarPainel(tokenSessao, null);
    if (c && c.ok) {
      var crit = 0;
      (c.linhas || []).forEach(function (x) {
        if (x.status === COB_STATUS.CRITICA) crit++;
      });
      out.cobranca = {
        competencia: String(c.competenciaLabel || c.competencia || ""),
        total:       Number(c.total || 0),
        recebidas:   Number(c.recebidas || 0),
        pendentes:   Number(c.pendentes || 0),
        criticas:    crit
      };
    } else {
      out.fontesIndisponiveis.push("Cobrança de Relação Nominal");
    }
  } catch (e) {
    Logger.log("finDashboardExecutivo/cobranca: " + e);
    out.fontesIndisponiveis.push("Cobrança de Relação Nominal");
  }

  out.consolidado.saldo = out.consolidado.entrou - out.consolidado.saiu;
  return out;
}
