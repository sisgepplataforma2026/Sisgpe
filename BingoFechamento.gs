/**
 * BINGO ONLINE — FECHAMENTO, EXPIRAÇÃO E RELATÓRIO
 * Homologação: operações críticas ficam no servidor, com lock e auditoria.
 */

function bingo_expirarManifestacoesPendentes(rodadaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  rodadaId = String(rodadaId || '').trim();
  if (!rodadaId) return { ok: false, mensagem: 'rodadaId é obrigatório.' };
  var agora = new Date();
  var itens = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'rodadaId', rodadaId, 500);
  var expiradas = 0;
  itens.forEach(function(item) {
    var d = item.data || {};
    if (String(d.status || '') !== 'AGUARDANDO_MANIFESTACAO') return;
    if (!d.prazoManifestacaoAte) return;
    if (agora.getTime() <= new Date(d.prazoManifestacaoAte).getTime()) return;
    d.status = 'EXPIRADO';
    d.expiradoEm = agora.toISOString();
    fs_set_(bingo_colecao_('deteccoes'), item.id, d);
    bingo_auditar_('MANIFESTACAO_EXPIRADA', d.deteccaoId || item.id, sessao, null, d);
    expiradas++;
  });
  return { ok: true, expiradas: expiradas };
}

function bingo_encerrarRodada(rodadaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  rodadaId = String(rodadaId || '').trim();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rodada = bingo_obterRodada_(rodadaId);
    if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
    if (rodada.status === BINGO_STATUS_RODADA.ENCERRADA) return { ok: true, existente: true, rodada: rodada };
    if (rodada.status === BINGO_STATUS_RODADA.CANCELADA) return { ok: false, mensagem: 'Rodada cancelada não pode ser encerrada.' };

    bingo_expirarManifestacoesPendentes(rodadaId, tokenSessao);
    var pendentes = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'rodadaId', rodadaId, 500)
      .map(function(x) { return x.data || {}; })
      .filter(function(d) { return String(d.status || '') === 'AGUARDANDO_MANIFESTACAO'; });
    if (pendentes.length) {
      return { ok: false, mensagem: 'Ainda existem manifestações dentro do prazo.', pendentes: pendentes.length };
    }

    var anterior = JSON.parse(JSON.stringify(rodada));
    rodada.status = BINGO_STATUS_RODADA.ENCERRADA;
    rodada.encerradaEm = bingo_agoraIso_();
    rodada.encerradaPor = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
    rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
    bingo_salvarRodada_(rodada);
    bingo_auditar_('RODADA_ENCERRADA', rodadaId, sessao, anterior, rodada);
    return { ok: true, rodada: rodada };
  } finally {
    lock.releaseLock();
  }
}

function bingo_relatorioRodada(rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  rodadaId = String(rodadaId || '').trim();
  var rodada = bingo_obterRodada_(rodadaId);
  if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };

  var cartelas = bingo_queryEquals_(bingo_colecao_('cartelas'), 'rodadaId', rodadaId, 500).map(function(x) {
    var c = x.data || {};
    return {
      cartelaId: c.cartelaId || '', participanteId: c.participanteId || '', associadoId: c.associadoId || '',
      fingerprint: c.fingerprint || '', geradaEm: c.geradaEm || '', status: c.status || 'ATIVA'
    };
  });
  var sorteios = bingo_numerosOficiais_(rodadaId).map(function(s) {
    return { posicao: Number(s.posicao || 0), numero: Number(s.numero || 0), letra: String(s.letra || ''), registradoEm: s.registradoEm || '', registradoPor: s.registradoPor || '' };
  });
  var deteccoes = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'rodadaId', rodadaId, 500).map(function(x) { return x.data || {}; });
  var vencedores = bingo_queryEquals_(bingo_colecao_('vencedores'), 'rodadaId', rodadaId, 500).map(function(x) { return x.data || {}; });

  return {
    ok: true,
    geradoEm: bingo_agoraIso_(),
    ambiente: bingo_ambiente_(),
    rodada: rodada,
    resumo: {
      cartelas: cartelas.length,
      numerosSorteados: sorteios.length,
      bingosDetectados: deteccoes.length,
      bingosConfirmados: deteccoes.filter(function(d) { return d.status === 'CONFIRMADO'; }).length,
      bingosExpirados: deteccoes.filter(function(d) { return d.status === 'EXPIRADO'; }).length,
      vencedores: vencedores.length
    },
    cartelas: cartelas,
    sorteios: sorteios,
    deteccoes: deteccoes,
    vencedores: vencedores
  };
}
