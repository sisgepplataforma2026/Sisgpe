/**
 * BINGO ONLINE — SORTEIO
 * Fonte oficial: servidor. Usa LockService contra duplo clique/dois operadores.
 */

function bingo_letraNumero_(numero) {
  numero = parseInt(numero, 10);
  if (numero >= 1 && numero <= 15) return 'B';
  if (numero <= 30) return 'I';
  if (numero <= 45) return 'N';
  if (numero <= 60) return 'G';
  if (numero <= 75) return 'O';
  return '';
}

function bingo_sorteioDocId_(rodadaId, numero) {
  return bingo_hash_(String(rodadaId) + '|' + String(numero)).substring(0, 40);
}

function bingo_iniciarRodada(rodadaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  rodadaId = String(rodadaId || '').trim();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rodada = bingo_obterRodada_(rodadaId);
    if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
    if (rodada.status === BINGO_STATUS_RODADA.EM_ANDAMENTO) return { ok: true, rodada: rodada, existente: true };
    if ([BINGO_STATUS_RODADA.ENCERRADA, BINGO_STATUS_RODADA.CANCELADA].indexOf(rodada.status) >= 0) {
      return { ok: false, mensagem: 'Rodada encerrada/cancelada não pode ser iniciada.' };
    }

    bingo_bloquearCartelasRodada_(rodadaId, sessao);
    rodada = bingo_obterRodada_(rodadaId);
    rodada.status = BINGO_STATUS_RODADA.EM_ANDAMENTO;
    rodada.iniciadaEm = rodada.iniciadaEm || bingo_agoraIso_();
    rodada.iniciadaPor = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
    rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
    bingo_salvarRodada_(rodada);
    bingo_auditar_('RODADA_INICIADA', rodadaId, sessao, null, rodada);
    return { ok: true, rodada: rodada };
  } finally {
    lock.releaseLock();
  }
}

function bingo_registrarNumero(dados, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  dados = dados || {};
  var rodadaId = String(dados.rodadaId || '').trim();
  var numero = parseInt(dados.numero, 10);
  var requestId = String(dados.requestId || '').trim() || bingo_uuid_('REQ');
  if (!rodadaId || isNaN(numero) || numero < 1 || numero > 75) {
    return { ok: false, mensagem: 'Informe rodadaId e número entre 1 e 75.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rodada = bingo_obterRodada_(rodadaId);
    if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
    if (rodada.status !== BINGO_STATUS_RODADA.EM_ANDAMENTO) {
      return { ok: false, mensagem: 'A rodada não está em andamento.', status: rodada.status };
    }

    var docId = bingo_sorteioDocId_(rodadaId, numero);
    var existente = fs_get_(bingo_colecao_('sorteios'), docId);
    if (existente) {
      return { ok: false, duplicado: true, mensagem: bingo_letraNumero_(numero) + '-' + numero + ' já foi registrado.', sorteio: existente };
    }

    var posicao = (parseInt(rodada.sequenciaAtual, 10) || 0) + 1;
    var sorteio = {
      sorteioId: bingo_uuid_('SOR'),
      eventoId: rodada.eventoId,
      rodadaId: rodadaId,
      numero: numero,
      letra: bingo_letraNumero_(numero),
      posicao: posicao,
      requestId: requestId,
      status: 'VALIDO',
      registradoEm: bingo_agoraIso_(),
      registradoPor: sessao.nome || sessao.usuario || sessao.email || 'SISGEP'
    };

    fs_set_(bingo_colecao_('sorteios'), docId, sorteio);
    rodada.sequenciaAtual = posicao;
    rodada.ultimoNumero = numero;
    rodada.ultimaLetra = sorteio.letra;
    rodada.ultimoSorteioEm = sorteio.registradoEm;
    rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
    bingo_salvarRodada_(rodada);

    bingo_auditar_('NUMERO_REGISTRADO', sorteio.sorteioId, sessao, null, sorteio);

    var deteccoes = bingo_detectarBingosAposNumero_(rodada, sorteio, sessao);
    if (deteccoes.length && rodada.status === BINGO_STATUS_RODADA.EM_ANDAMENTO) {
      rodada.status = BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO;
      rodada.pausadaEm = bingo_agoraIso_();
      rodada.motivoPausa = 'BINGO_DETECTADO';
      rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
      bingo_salvarRodada_(rodada);
      bingo_auditar_('RODADA_PAUSADA_BINGO', rodadaId, sessao, null, { deteccoes: deteccoes.length, numero: numero });
    }

    return { ok: true, sorteio: sorteio, rodada: rodada, bingosDetectados: deteccoes };
  } finally {
    lock.releaseLock();
  }
}

function bingo_pausarRodada(rodadaId, motivo, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rodada = bingo_obterRodada_(rodadaId);
    if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
    if (rodada.status !== BINGO_STATUS_RODADA.EM_ANDAMENTO) return { ok: false, mensagem: 'Somente rodada em andamento pode ser pausada.' };
    rodada.status = BINGO_STATUS_RODADA.PAUSADA;
    rodada.pausadaEm = bingo_agoraIso_();
    rodada.motivoPausa = String(motivo || 'PAUSA_OPERACIONAL');
    rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
    bingo_salvarRodada_(rodada);
    bingo_auditar_('RODADA_PAUSADA', rodadaId, sessao, null, { motivo: rodada.motivoPausa });
    return { ok: true, rodada: rodada };
  } finally { lock.releaseLock(); }
}

function bingo_retomarRodada(rodadaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rodada = bingo_obterRodada_(rodadaId);
    if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
    if ([BINGO_STATUS_RODADA.PAUSADA, BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO].indexOf(rodada.status) < 0) {
      return { ok: false, mensagem: 'A rodada não está pausada.' };
    }

    if (rodada.status === BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO) {
      if (typeof bingo_expirarManifestacoesPendentes === 'function') {
        bingo_expirarManifestacoesPendentes(rodadaId, tokenSessao);
      }
      var pendentes = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'rodadaId', String(rodadaId), 500)
        .map(function(x) { return x.data || {}; })
        .filter(function(d) { return String(d.status || '') === 'AGUARDANDO_MANIFESTACAO'; });
      if (pendentes.length) {
        return { ok: false, mensagem: 'Existe Bingo aguardando manifestação. Resolva ou aguarde o prazo antes de retomar.', pendentes: pendentes.length };
      }
    }

    rodada.status = BINGO_STATUS_RODADA.EM_ANDAMENTO;
    rodada.retomadaEm = bingo_agoraIso_();
    rodada.motivoPausa = '';
    rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
    bingo_salvarRodada_(rodada);
    bingo_auditar_('RODADA_RETOMADA', rodadaId, sessao, null, { rodadaId: rodadaId });
    return { ok: true, rodada: rodada };
  } finally { lock.releaseLock(); }
}
