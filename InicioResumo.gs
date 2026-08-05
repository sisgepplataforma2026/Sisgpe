// ================================
// ARQUIVO: InicioResumo.gs
// MÓDULO: Início (Home) — resumo real do dia
//
// A tela Início (index.html, div #mInicio) tinha 3 blocos com números e
// status inteiramente HARDCODED no HTML ("Suas prioridades de hoje",
// "Saúde do sindicato", "Atividades recentes da SOFIA") — nenhum vinha
// de google.script.run, então ninguém via dado real ali, só uma
// maquete estática. Este arquivo religa os 3 blocos a dados de verdade,
// reaproveitando as funções que cada módulo JÁ usa no próprio
// dashboard, em vez de reimplementar contagem por conta própria:
//   - E-mails            → getCockpit (CockpitCore.gs)
//   - Ofícios            → getDashboardOficiosData (DashboardOficios.gs)
//   - Jurídico           → jurListarProcessos (Juridico.gs)
//   - Notas fiscais      → obterResumoDespesas (Despesas.gs)
//   - Escolas            → listarEscolasCadastro (Escolas.gs)
//   - Atividades da SOFIA→ aba Sofia_Auditoria (ChatIACore.gs, já gravada
//                          a cada interação real com a IA)
//
// "Saúde do sindicato" não tinha (e ainda não tem) um critério de
// negócio definido pelo usuário para SAUDÁVEL/ORGANIZADO/ATENÇÃO — em
// vez de inventar uma fórmula sofisticada, uso uma regra única e
// simples, documentada aqui: ATENÇÃO se a área tem alguma pendência
// real contada acima, OK caso contrário. Se o usuário quiser um
// critério mais elaborado por área, é ajuste futuro.
//
// Cada fonte é best-effort (try/catch individual) — se um módulo falhar
// ao consultar, o card dele mostra 0 (nunca trava a tela toda nem
// finge sucesso).
// ================================

function getResumoInicioSISGEP(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);

  var notasFiscais = inicio_contarNotasFiscaisAguardando_();
  var emails = inicio_contarEmailsUrgentes_(tokenSessao);
  var oficios = inicio_contarOficiosPendentes_(tokenSessao);
  var juridico = inicio_contarProcessosJuridicosComPrazo_(tokenSessao);
  var escolasIncompletas = inicio_contarEscolasCadastroIncompleto_(tokenSessao);

  return {
    ok: true,
    prioridades: {
      notasFiscais: notasFiscais,
      emails: emails,
      oficios: oficios,
      juridico: juridico,
      escolasIncompletas: escolasIncompletas
    },
    saude: {
      financeiro: notasFiscais > 0 ? "ATENÇÃO" : "OK",
      administrativo: escolasIncompletas > 0 ? "ATENÇÃO" : "OK",
      juridico: juridico > 0 ? "ATENÇÃO" : "OK",
      comunicacao: emails > 0 ? "ATENÇÃO" : "OK",
      oficios: oficios > 0 ? "ATENÇÃO" : "OK"
    },
    atividadesRecentes: inicio_atividadesRecentesSofia_()
  };
}

function inicio_contarNotasFiscaisAguardando_() {
  try {
    var r = obterResumoDespesas_interno_();
    return (r && r.ok && r.resumo) ? Number(r.resumo.totalDocRecebido || 0) : 0;
  } catch (e) {
    Logger.log("[Início] falha ao contar notas fiscais: " + e.message);
    return 0;
  }
}

function inicio_contarEmailsUrgentes_(tokenSessao) {
  try {
    var r = getCockpit(tokenSessao);
    return (r && r.ok && r.indicadores) ? Number(r.indicadores.urgentes || 0) : 0;
  } catch (e) {
    Logger.log("[Início] falha ao contar e-mails urgentes: " + e.message);
    return 0;
  }
}

function inicio_contarOficiosPendentes_(tokenSessao) {
  try {
    var r = getDashboardOficiosData({}, tokenSessao);
    return (r && r.resumo) ? Number(r.resumo.pendentes || 0) : 0;
  } catch (e) {
    Logger.log("[Início] falha ao contar ofícios pendentes: " + e.message);
    return 0;
  }
}

function inicio_contarProcessosJuridicosComPrazo_(tokenSessao) {
  try {
    var r = jurListarProcessos(tokenSessao);
    if (!r || !r.ok || !Array.isArray(r.itens)) return 0;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return r.itens.filter(function (x) {
      if (x.status === "Concluído" || !x.prazo) return false;
      var d = Math.ceil((new Date(x.prazo + "T00:00:00") - hoje) / 86400000);
      return d >= 0 && d <= 15;
    }).length;
  } catch (e) {
    Logger.log("[Início] falha ao contar processos jurídicos: " + e.message);
    return 0;
  }
}

function inicio_contarEscolasCadastroIncompleto_(tokenSessao) {
  try {
    var escolas = listarEscolasCadastro(tokenSessao);
    if (!Array.isArray(escolas)) return 0;
    return escolas.filter(function (e) {
      return !e.CNPJ || String(e.CNPJ).replace(/\D/g, "").length !== 14 || !e.Email;
    }).length;
  } catch (e) {
    Logger.log("[Início] falha ao contar escolas com cadastro incompleto: " + e.message);
    return 0;
  }
}

function inicio_atividadesRecentesSofia_() {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName("Sofia_Auditoria");
    if (!aba || aba.getLastRow() < 2) return [];
    var ultimaLinha = aba.getLastRow();
    var inicio = Math.max(2, ultimaLinha - 4); // últimas 5 linhas
    var dados = aba.getRange(inicio, 1, ultimaLinha - inicio + 1, 7).getValues();
    return dados.reverse().map(function (l) {
      return {
        dataHora: String(l[0] || ""),
        dominio: String(l[3] || "Geral"),
        pergunta: String(l[4] || "").substring(0, 90),
        ok: l[6] === true
      };
    });
  } catch (e) {
    Logger.log("[Início] falha ao ler atividades recentes da SOFIA: " + e.message);
    return [];
  }
}
