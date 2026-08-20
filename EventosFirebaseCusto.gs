/**
 * COMPASSO 2026 — Orçamento estimado Firebase/Firestore.
 * Requisito: desenho operacional compatível com a faixa gratuita.
 *
 * IMPORTANTE: não gravamos um documento de métrica a cada operação porque isso
 * aumentaria artificialmente o próprio consumo que queremos reduzir.
 * As métricas abaixo são estimativas de arquitetura/homologação; no ensaio real,
 * conferir também o painel oficial do Firebase.
 */
var COMPASSO_FIREBASE_BUDGET = {
  LEITURAS_DIA: 50000,
  GRAVACOES_DIA: 20000,
  EXCLUSOES_DIA: 20000,
  ALERTA_PERCENTUAL: 0.70,
  CRITICO_PERCENTUAL: 0.90
};

function compasso_estimarConsumoEvento(qtdParticipantes, qtdLeiturasDuplicadas) {
  var n = Math.max(0, Number(qtdParticipantes || 0));
  var d = Math.max(0, Number(qtdLeiturasDuplicadas || 0));

  // Meta otimizada por participante (estimativa):
  // inscrição ~2R/3W; validação ~1R/2W; emissão ~4R/5W; check-in ~2R/2W.
  // Duplicidade de QR: ~2R e nenhuma gravação quando corretamente bloqueada.
  var leituras = n * 9 + d * 2;
  var gravacoes = n * 12;

  // Nem todas as fases ocorrem no mesmo dia. O número abaixo representa um
  // cenário artificialmente concentrado e serve como teste de estresse de custo.
  return {
    participantes: n,
    leiturasDuplicadas: d,
    leiturasEstimadasCicloCompleto: leituras,
    gravacoesEstimadasCicloCompleto: gravacoes,
    cabeLeiturasGratisSeMesmoDia: leituras <= COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA,
    cabeGravacoesGratisSeMesmoDia: gravacoes <= COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA,
    checkinSomenteLeiturasEstimadas: n * 2 + d * 2,
    checkinSomenteGravacoesEstimadas: n * 2,
    nota: 'Inscrição, validação e emissão ocorrerão antes da festa. No dia do evento, o principal consumo é o check-in.'
  };
}

function compasso_estimarDiaFesta(qtdParticipantes, qtdTentativasDuplicadas) {
  var n = Math.max(0, Number(qtdParticipantes || 0));
  var d = Math.max(0, Number(qtdTentativasDuplicadas || 0));
  var leituras = n * 2 + d * 2;
  var gravacoes = n * 2; // ingresso + registro de check-in; auditoria pode ser agregada.
  return {
    participantes: n,
    duplicadas: d,
    leituras: leituras,
    gravacoes: gravacoes,
    percentualLeituras: Math.round((leituras / COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA) * 10000) / 100,
    percentualGravacoes: Math.round((gravacoes / COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA) * 10000) / 100,
    aprovado: leituras <= COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA && gravacoes <= COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA
  };
}
