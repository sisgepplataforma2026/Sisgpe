/**
 * BINGO ONLINE — API ADMINISTRATIVA DE CONSULTA
 * Mantém listagens fora dos serviços críticos de sorteio/validação.
 */

function bingo_listarRodadas(eventoId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var itens = bingo_queryEquals_(bingo_colecao_('rodadas'), 'eventoId', String(eventoId || ''), 100);
  return itens.map(function(x) { return x.data; }).sort(function(a, b) {
    return String(a.criadoEm || '').localeCompare(String(b.criadoEm || ''));
  });
}

function bingo_listarCartelas(eventoId, rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var itens = bingo_queryEquals_(bingo_colecao_('cartelas'), 'rodadaId', String(rodadaId || ''), 500);
  return itens.map(function(x) {
    var c = x.data;
    return {
      cartelaId: c.cartelaId,
      eventoId: c.eventoId,
      rodadaId: c.rodadaId,
      participanteId: c.participanteId,
      associadoId: c.associadoId || '',
      status: c.status || 'ATIVA',
      geradaEm: c.geradaEm || '',
      fingerprint: c.fingerprint || '',
      possuiLink: !!c.tokenHash
    };
  }).filter(function(c) { return !eventoId || String(c.eventoId) === String(eventoId); });
}

function bingo_listarDeteccoes(rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var itens = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'rodadaId', String(rodadaId || ''), 500);
  return itens.map(function(x) { return x.data; }).sort(function(a, b) {
    return String(b.detectadoEm || '').localeCompare(String(a.detectadoEm || ''));
  });
}

function bingo_estadoAdmin(eventoId, rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var cfg = fs_get_(bingo_colecao_('config'), String(eventoId || '')) || bingo_configPadrao_(eventoId);
  var rodada = rodadaId ? bingo_obterRodada_(rodadaId) : null;
  var sorteios = rodadaId ? bingo_numerosOficiais_(rodadaId) : [];
  var deteccoes = rodadaId ? bingo_listarDeteccoes(rodadaId, tokenSessao) : [];
  return {
    ok: true,
    config: cfg,
    rodada: rodada,
    sorteios: sorteios,
    deteccoes: deteccoes,
    ambiente: bingo_ambiente_()
  };
}
