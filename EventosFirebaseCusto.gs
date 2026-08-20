/**
 * COMPASSO 2026 — Monitor estimado de consumo Firebase/Firestore.
 * Objetivo: manter o fluxo dentro da faixa gratuita e detectar desenho ineficiente.
 * OBS: contagem estimada da aplicação; não substitui métricas oficiais do Firebase.
 */
var COMPASSO_FIREBASE_BUDGET = {
  LEITURAS_DIA: 50000,
  GRAVACOES_DIA: 20000,
  EXCLUSOES_DIA: 20000,
  ALERTA_PERCENTUAL: 0.70,
  CRITICO_PERCENTUAL: 0.90
};

function compasso_custoDiaId_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function compasso_registrarUsoFirebase_(tipo, quantidade, origem) {
  tipo = String(tipo || '').toUpperCase();
  quantidade = Math.max(0, Number(quantidade || 1));
  if (['LEITURA','GRAVACAO','EXCLUSAO'].indexOf(tipo) < 0) return;
  var dia = compasso_custoDiaId_();
  var id = EMISSAO_CFG.EVENTO_ID + '-' + dia;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var u = fs_get_('metricasEventos', id) || {eventoId:EMISSAO_CFG.EVENTO_ID,dia:dia,leituras:0,gravacoes:0,exclusoes:0};
    if (tipo === 'LEITURA') u.leituras = Number(u.leituras || 0) + quantidade;
    if (tipo === 'GRAVACAO') u.gravacoes = Number(u.gravacoes || 0) + quantidade;
    if (tipo === 'EXCLUSAO') u.exclusoes = Number(u.exclusoes || 0) + quantidade;
    u.ultimaOrigem = String(origem || '');
    u.atualizadoEm = new Date();
    fs_set_('metricasEventos', id, u);
  } finally { lock.releaseLock(); }
}

function compasso_resumoUsoFirebase() {
  var dia = compasso_custoDiaId_();
  var id = EMISSAO_CFG.EVENTO_ID + '-' + dia;
  var u = fs_get_('metricasEventos', id) || {eventoId:EMISSAO_CFG.EVENTO_ID,dia:dia,leituras:0,gravacoes:0,exclusoes:0};
  function faixa(valor, limite){
    var p = limite ? valor / limite : 0;
    return p >= COMPASSO_FIREBASE_BUDGET.CRITICO_PERCENTUAL ? 'CRITICO' :
           p >= COMPASSO_FIREBASE_BUDGET.ALERTA_PERCENTUAL ? 'ALERTA' : 'OK';
  }
  return {
    dia: dia,
    leituras: Number(u.leituras||0), limiteLeituras: COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA,
    gravacoes: Number(u.gravacoes||0), limiteGravacoes: COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA,
    exclusoes: Number(u.exclusoes||0), limiteExclusoes: COMPASSO_FIREBASE_BUDGET.EXCLUSOES_DIA,
    statusLeituras: faixa(Number(u.leituras||0), COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA),
    statusGravacoes: faixa(Number(u.gravacoes||0), COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA),
    statusExclusoes: faixa(Number(u.exclusoes||0), COMPASSO_FIREBASE_BUDGET.EXCLUSOES_DIA),
    observacao: 'Estimativa interna. Conferir também o painel oficial do Firebase antes do evento.'
  };
}

/** Estimativa conservadora para planejamento, sem executar operações reais. */
function compasso_estimarConsumoEvento(qtdParticipantes, qtdLeiturasDuplicadas) {
  var n = Math.max(0, Number(qtdParticipantes || 0));
  var d = Math.max(0, Number(qtdLeiturasDuplicadas || 0));
  // Inscrição: ~3 leituras + 4 gravações; validação: ~2 + 2; emissão: ~5 + 5; check-in: ~2 + 3.
  // Margem extra para consultas administrativas e reenvios.
  var leituras = n * 14 + d * 2;
  var gravacoes = n * 14 + d * 1;
  return {
    participantes:n,
    leiturasDuplicadas:d,
    leiturasEstimadas:leituras,
    gravacoesEstimadas:gravacoes,
    cabeLeiturasGratis:leituras <= COMPASSO_FIREBASE_BUDGET.LEITURAS_DIA,
    cabeGravacoesGratis:gravacoes <= COMPASSO_FIREBASE_BUDGET.GRAVACOES_DIA,
    nota:'Estimativa conservadora; o desenho deve reduzir consultas em lista e evitar polling contínuo nos celulares.'
  };
}
