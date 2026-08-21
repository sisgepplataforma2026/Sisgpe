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

/* ══════════════════════════════════════════════════════════════════════════
   MEDIR DE VERDADE — 21/08/2026
   ══════════════════════════════════════════════════════════════════════════

   As funções `estimar*` deste arquivo calculam por fórmula, com números
   supostos. Respondem "quanto DEVE dar". O usuário precisa de outra coisa:

     "preciso fazer teste... a questão de medir o consumo do Firebase, porque
      o acesso é no dia dezenove de dezembro."

   `compasso_medirRodada` roda uma carga de verdade e CONTA as operações, com
   o contador em memória de EventosFirestore.gs — zero operação extra, que era
   exatamente a objeção registrada no cabeçalho deste arquivo.

   O QUE A PRIMEIRA MEDIÇÃO JÁ DEVE MOSTRAR, e é um achado de arquitetura:

   `compasso_checkinBuscarManual` (EventosCheckinPainel.gs:15) chama
   `fs_list_('ingressos', 1000)` — LISTA A COLEÇÃO INTEIRA e filtra em
   memória. Com 2.000 ingressos, cada busca manual na portaria custa 2.000
   leituras. Dez buscas = 20.000 = 40% do teto diário gratuito, só em busca.

   O check-in por QR NÃO tem esse problema: usa `fs_queryEquals_`, que é
   consulta de verdade e custa as poucas linhas que devolve.

   A medição vai dizer se isso é teórico ou se dói. É por isso que ela existe.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Roda uma carga e MEDE. Homologação e administrador — cria dado de verdade.
 *
 * @param {number} quantidade  10, 50, 200, 1000, 2000 ou 2500 (as ondas do plano)
 * @return {string} relatório
 */
function compasso_medirRodada(quantidade, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — medir rodada', true);
  compasso_assertHomologacao_();

  fs_medirIniciar_('rodada de ' + quantidade);
  var erro = '';
  var resumo = null;
  try {
    var ini = compasso_simulacaoIniciar(quantidade, tokenSessao);
    if (!ini || !ini.ok) throw new Error((ini && ini.erro) || 'não foi possível iniciar');
    /* Um lote só, do tamanho que couber: o objetivo aqui é MEDIR o custo por
       inscrição, não concluir a simulação. Rodar até o fim é trabalho do
       compasso_simulacaoExecutarLote, que agora também devolve métrica. */
    resumo = compasso_simulacaoExecutarLote(ini.loteId, 50, tokenSessao);
  } catch (e) { erro = e.message; }
  var m = fs_medirFechar_();

  var feitos = resumo ? Number(resumo.inscritos || 0) : 0;
  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  CONSUMO MEDIDO — ' + m.rotulo);
  L.push('═══════════════════════════════════════════════════════════');
  if (erro) L.push('  ⚠️  ' + erro);
  L.push('  Inscrições processadas : ' + feitos + ' em ' + m.segundos + 's');
  L.push('');
  L.push('  Chamadas   get ' + m.chamadas.get + ' · set ' + m.chamadas.set +
         ' · list ' + m.chamadas.list + ' · query ' + m.chamadas.query);
  L.push('  Documentos lidos por listagem : ' + m.documentosLidos);
  L.push('');
  L.push('  LEITURAS COBRADAS  : ' + m.leiturasCobradas +
         '  (' + m.percentualDoTetoDiario.leituras + ' do teto diário)');
  L.push('  GRAVAÇÕES COBRADAS : ' + m.gravacoesCobradas +
         '  (' + m.percentualDoTetoDiario.gravacoes + ' do teto diário)');
  if (feitos > 0) {
    L.push('');
    L.push('  POR INSCRIÇÃO      : ' + (Math.round(m.leiturasCobradas / feitos * 10) / 10) +
           ' leituras · ' + (Math.round(m.gravacoesCobradas / feitos * 10) / 10) + ' gravações');
    L.push('  Projeção p/ 2.000  : ' + Math.round(m.leiturasCobradas / feitos * 2000) +
           ' leituras · ' + Math.round(m.gravacoesCobradas / feitos * 2000) + ' gravações');
  }
  L.push('');
  L.push('  ' + m.nota);
  L.push('═══════════════════════════════════════════════════════════');
  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}

function compasso_estimarConsumoEvento(qtdParticipantes, qtdLeiturasDuplicadas, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — estimar consumo', false);
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

function compasso_estimarDiaFesta(qtdParticipantes, qtdTentativasDuplicadas, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — estimar dia da festa', false);
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
