/**
 * BINGO ONLINE — PARTICIPANTES DO EVENTO
 *
 * Fonte atual:
 * 1) evento_participantes (quando existir no módulo Eventos genérico);
 * 2) ingressos do evento (fonte operacional já existente hoje).
 *
 * O restante do Bingo depende apenas desta camada. Quando Eventos ganhar uma
 * entidade única de participante, só este arquivo precisa mudar.
 */

function bingo_normalizarParticipanteEvento_(item, origem) {
  var d = item.data || {};
  var participanteId = String(d.participanteId || item.id || '').trim();
  if (!participanteId) return null;
  return {
    participanteId: participanteId,
    associadoId: String(d.associadoId || d.matricula || '').trim(),
    nome: String(d.nome || d.nomeCompleto || 'Participante').trim(),
    escola: String(d.escola || '').trim(),
    email: String(d.email || '').trim(),
    whatsapp: String(d.whatsapp || '').trim(),
    categoria: String(d.categoria || 'associado').trim(),
    status: String(d.status || 'ATIVO').trim(),
    origem: origem
  };
}

function bingo_listarParticipantesEvento(eventoId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  eventoId = String(eventoId || '').trim();
  if (!eventoId) return [];

  var itens = [];
  try {
    itens = bingo_queryEquals_('evento_participantes', 'eventoId', eventoId, 500);
  } catch (e) {
    itens = [];
  }

  var origem = 'EVENTO_PARTICIPANTES';
  if (!itens.length) {
    origem = 'INGRESSOS';
    itens = bingo_queryEquals_('ingressos', 'eventoId', eventoId, 500)
      .filter(function(x) {
        var st = String((x.data || {}).status || '').toUpperCase();
        return st !== 'CANCELADO';
      });
  }

  var vistos = {};
  return itens.map(function(item) {
    return bingo_normalizarParticipanteEvento_(item, origem);
  }).filter(function(p) {
    if (!p || vistos[p.participanteId]) return false;
    vistos[p.participanteId] = true;
    return true;
  }).sort(function(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });
}

function bingo_firestoreBatchSet_(colecao, registros) {
  registros = registros || [];
  if (!registros.length) return { ok: true, total: 0 };
  var cfg = fs_getConfig_();
  var baseNome = 'projects/' + cfg.projectId + '/databases/(default)/documents/';
  var url = fs_baseUrl_() + ':batchWrite';
  var total = 0;

  for (var ini = 0; ini < registros.length; ini += 200) {
    var lote = registros.slice(ini, ini + 200);
    var writes = lote.map(function(r) {
      return {
        update: {
          name: baseNome + colecao + '/' + r.docId,
          fields: fs_toFields_(r.data)
        },
        currentDocument: { exists: false }
      };
    });
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
      payload: JSON.stringify({ writes: writes }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) {
      throw new Error('Falha no lote de cartelas (' + resp.getResponseCode() + '): ' + String(resp.getContentText()).slice(0, 400));
    }
    var body = JSON.parse(resp.getContentText() || '{}');
    var status = body.status || [];
    for (var s = 0; s < status.length; s++) {
      if (!status[s] || !status[s].code) total++;
    }
  }
  return { ok: true, total: total };
}

function bingo_gerarCartelasDoEvento(rodadaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  rodadaId = String(rodadaId || '').trim();
  var rodada = bingo_obterRodada_(rodadaId);
  if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
  if ([BINGO_STATUS_RODADA.EM_ANDAMENTO, BINGO_STATUS_RODADA.PAUSADA, BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO, BINGO_STATUS_RODADA.ENCERRADA].indexOf(rodada.status) >= 0) {
    return { ok: false, mensagem: 'Geração de cartelas encerrada para esta rodada.' };
  }

  var participantes = bingo_listarParticipantesEvento(rodada.eventoId, tokenSessao);
  if (!participantes.length) {
    return { ok: false, mensagem: 'Nenhum participante encontrado no Evento. Cadastre/importe os participantes antes de gerar as cartelas.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    rodada = bingo_obterRodada_(rodadaId);
    if (!rodada || [BINGO_STATUS_RODADA.EM_ANDAMENTO, BINGO_STATUS_RODADA.PAUSADA, BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO, BINGO_STATUS_RODADA.ENCERRADA].indexOf(rodada.status) >= 0) {
      return { ok: false, mensagem: 'Rodada já iniciada; geração bloqueada.' };
    }

    var existentes = bingo_queryEquals_(bingo_colecao_('cartelas'), 'rodadaId', rodadaId, 500);
    var porParticipante = {};
    var combinacoes = {};
    existentes.forEach(function(x) {
      var c = x.data || {};
      porParticipante[String(c.participanteId || '')] = c;
      if (c.combinacaoHash) combinacoes[String(c.combinacaoHash)] = true;
    });

    var agora = bingo_agoraIso_();
    var operador = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
    var novos = [], links = [], jaExistentes = 0;

    participantes.forEach(function(p) {
      if (porParticipante[p.participanteId]) { jaExistentes++; return; }

      var numeros, combinacaoHash, tent = 0;
      do {
        numeros = bingo_gerarNumeros75_(rodada.usaCasaLivre !== false);
        combinacaoHash = bingo_hashCombinacao_(rodadaId, numeros);
        tent++;
      } while (combinacoes[combinacaoHash] && tent < 50);
      if (combinacoes[combinacaoHash]) throw new Error('Não foi possível gerar combinação única para todos os participantes.');
      combinacoes[combinacaoHash] = true;

      var token = bingo_tokenSeguro_();
      var cartela = {
        cartelaId: bingo_uuid_('CAR'),
        eventoId: rodada.eventoId,
        rodadaId: rodadaId,
        participanteId: p.participanteId,
        associadoId: p.associadoId || '',
        numerosJson: bingo_json_(numeros),
        combinacaoHash: combinacaoHash,
        fingerprint: bingo_fingerprintCartela_(rodadaId, p.participanteId, numeros),
        tokenHash: bingo_hash_(token),
        status: 'ATIVA',
        bloqueada: false,
        geradaEm: agora,
        geradaPor: operador
      };
      novos.push({ docId: bingo_cartelaDocId_(rodadaId, p.participanteId), data: cartela });
      links.push({
        participanteId: p.participanteId,
        associadoId: p.associadoId || '',
        nome: p.nome || 'Participante',
        email: p.email || '',
        whatsapp: p.whatsapp || '',
        cartelaId: cartela.cartelaId,
        url: bingo_linkPublico_(token)
      });
    });

    var gravacao = bingo_firestoreBatchSet_(bingo_colecao_('cartelas'), novos);
    bingo_auditar_('CARTELAS_EVENTO_GERADAS', rodadaId, sessao, null, {
      eventoId: rodada.eventoId,
      participantes: participantes.length,
      novas: gravacao.total,
      existentes: jaExistentes
    });

    return {
      ok: true,
      eventoId: rodada.eventoId,
      rodadaId: rodadaId,
      participantes: participantes.length,
      geradas: gravacao.total,
      existentes: jaExistentes,
      links: links
    };
  } finally {
    lock.releaseLock();
  }
}

function bingo_statusParticipantesEvento(eventoId, rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var participantes = bingo_listarParticipantesEvento(eventoId, tokenSessao);
  var cartelas = rodadaId
    ? bingo_queryEquals_(bingo_colecao_('cartelas'), 'rodadaId', String(rodadaId), 500)
    : [];
  var porParticipante = {};
  cartelas.forEach(function(x) {
    var c = x.data || {};
    porParticipante[String(c.participanteId || '')] = c;
  });

  return participantes.map(function(p) {
    var c = porParticipante[p.participanteId] || null;
    return {
      participanteId: p.participanteId,
      associadoId: p.associadoId || '',
      nome: p.nome,
      escola: p.escola || '',
      email: p.email || '',
      whatsapp: p.whatsapp || '',
      categoria: p.categoria || '',
      origem: p.origem,
      cartelaId: c ? c.cartelaId : '',
      cartelaGerada: !!c,
      possuiLink: !!(c && c.tokenHash),
      statusCartela: c ? (c.status || 'ATIVA') : ''
    };
  });
}
