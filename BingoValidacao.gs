/**
 * BINGO ONLINE — VALIDAÇÃO E DETECÇÃO
 * Toda decisão de vitória ocorre no servidor com a cartela persistida e os
 * números oficiais já registrados.
 */

function bingo_queryEquals_(collection, campo, valor, limite) {
  var url = fs_baseUrl_() + ':runQuery';
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: campo },
          op: 'EQUAL',
          value: fs_toFields_({ v: valor }).v
        }
      },
      limit: Math.min(Math.max(parseInt(limite, 10) || 500, 1), 1000)
    }
  };
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) throw new Error('Erro na consulta Bingo (' + resp.getResponseCode() + '): ' + resp.getContentText());

  var linhas = JSON.parse(resp.getContentText()) || [];
  var out = [];
  linhas.forEach(function(l) {
    if (l && l.document) {
      var partes = l.document.name.split('/');
      out.push({ id: partes[partes.length - 1], data: fs_fromFields_(l.document.fields) });
    }
  });
  return out;
}

function bingo_numerosOficiais_(rodadaId) {
  var itens = bingo_queryEquals_(bingo_colecao_('sorteios'), 'rodadaId', String(rodadaId), 100);
  return itens
    .map(function(x) { return x.data; })
    .filter(function(x) { return x.status === 'VALIDO'; })
    .sort(function(a, b) { return Number(a.posicao || 0) - Number(b.posicao || 0); });
}

function bingo_setSorteados_(sorteios) {
  var set = {};
  (sorteios || []).forEach(function(s) { set[Number(s.numero)] = true; });
  set[0] = true; // casa livre
  return set;
}

function bingo_linhasMatriz_(colunas) {
  var linhas = [];
  for (var r = 0; r < 5; r++) {
    var linha = [];
    for (var c = 0; c < 5; c++) linha.push(Number(colunas[c][r]));
    linhas.push(linha);
  }
  return linhas;
}

function bingo_todosMarcados_(nums, set) {
  for (var i = 0; i < nums.length; i++) if (!set[Number(nums[i])]) return false;
  return true;
}

function bingo_validarPadrao_(numeros, modalidade, setSorteados) {
  if (!numeros || numeros.length !== 5) return false;
  var linhas = bingo_linhasMatriz_(numeros);
  var m = String(modalidade || '').toUpperCase();
  var i;

  if (m === 'LINHA_HORIZONTAL') {
    for (i = 0; i < 5; i++) if (bingo_todosMarcados_(linhas[i], setSorteados)) return true;
    return false;
  }
  if (m === 'COLUNA') {
    for (i = 0; i < 5; i++) if (bingo_todosMarcados_(numeros[i], setSorteados)) return true;
    return false;
  }
  if (m === 'DIAGONAL') {
    var d1 = [], d2 = [];
    for (i = 0; i < 5; i++) { d1.push(Number(numeros[i][i])); d2.push(Number(numeros[i][4 - i])); }
    return bingo_todosMarcados_(d1, setSorteados) || bingo_todosMarcados_(d2, setSorteados);
  }
  if (m === 'QUATRO_CANTOS') {
    return bingo_todosMarcados_([numeros[0][0], numeros[4][0], numeros[0][4], numeros[4][4]], setSorteados);
  }
  if (m === 'X') {
    var x = [];
    for (i = 0; i < 5; i++) { x.push(Number(numeros[i][i])); x.push(Number(numeros[i][4 - i])); }
    return bingo_todosMarcados_(x, setSorteados);
  }
  if (m === 'CARTELA_CHEIA') {
    var todos = [];
    for (var c = 0; c < 5; c++) for (var r = 0; r < 5; r++) todos.push(Number(numeros[c][r]));
    return bingo_todosMarcados_(todos, setSorteados);
  }
  return false;
}

function bingo_detectarBingosAposNumero_(rodada, sorteio, sessao) {
  if (!rodada || !rodada.rodadaId) return [];
  var sorteios = bingo_numerosOficiais_(rodada.rodadaId);
  var set = bingo_setSorteados_(sorteios);
  var cartelas = bingo_queryEquals_(bingo_colecao_('cartelas'), 'rodadaId', rodada.rodadaId, 500);
  var deteccoes = [];

  cartelas.forEach(function(item) {
    var c = item.data;
    if (String(c.status || 'ATIVA') !== 'ATIVA') return;
    var numeros = bingo_parseJson_(c.numerosJson, []);
    if (!bingo_validarPadrao_(numeros, rodada.modalidade, set)) return;

    var detDocId = bingo_hash_(rodada.rodadaId + '|' + c.cartelaId + '|' + sorteio.posicao).substring(0, 40);
    var existente = fs_get_(bingo_colecao_('deteccoes'), detDocId);
    if (existente) { deteccoes.push(existente); return; }

    var prazoSeg = Math.max(30, parseInt(rodada.prazoManifestacaoSegundos || 180, 10));
    var detectado = new Date();
    var prazo = new Date(detectado.getTime() + prazoSeg * 1000);
    var d = {
      deteccaoId: bingo_uuid_('DET'),
      eventoId: rodada.eventoId,
      rodadaId: rodada.rodadaId,
      cartelaId: c.cartelaId,
      participanteId: c.participanteId,
      associadoId: c.associadoId || '',
      numeroVencedor: Number(sorteio.numero),
      posicaoSorteio: Number(sorteio.posicao),
      modalidade: rodada.modalidade,
      detectadoEm: detectado.toISOString(),
      prazoManifestacaoAte: prazo.toISOString(),
      status: 'AGUARDANDO_MANIFESTACAO'
    };
    fs_set_(bingo_colecao_('deteccoes'), detDocId, d);
    bingo_auditar_('BINGO_DETECTADO', d.deteccaoId, sessao, null, d);
    deteccoes.push(d);
  });
  return deteccoes;
}

function bingo_validarCartelaOficial(cartelaId, rodadaId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var itens = bingo_queryEquals_(bingo_colecao_('cartelas'), 'cartelaId', String(cartelaId || ''), 5);
  if (!itens.length) return { ok: false, valido: false, mensagem: 'Cartela não encontrada.' };
  var c = itens[0].data;
  if (String(c.rodadaId) !== String(rodadaId)) return { ok: false, valido: false, mensagem: 'Cartela não pertence à rodada.' };
  var rodada = bingo_obterRodada_(rodadaId);
  if (!rodada) return { ok: false, valido: false, mensagem: 'Rodada não encontrada.' };
  var sorteios = bingo_numerosOficiais_(rodadaId);
  var valido = bingo_validarPadrao_(bingo_parseJson_(c.numerosJson, []), rodada.modalidade, bingo_setSorteados_(sorteios));
  return { ok: true, valido: valido, modalidade: rodada.modalidade, totalSorteados: sorteios.length };
}

function bingo_confirmarManifestacao(deteccaoId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var itens = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'deteccaoId', String(deteccaoId || ''), 5);
    if (!itens.length) return { ok: false, mensagem: 'Detecção não encontrada.' };
    var docId = itens[0].id;
    var d = itens[0].data;
    if (d.status === 'CONFIRMADO') return { ok: true, existente: true, deteccao: d };
    if (d.status !== 'AGUARDANDO_MANIFESTACAO') return { ok: false, mensagem: 'Detecção não aguarda manifestação.', status: d.status };

    var agora = new Date();
    if (d.prazoManifestacaoAte && agora.getTime() > new Date(d.prazoManifestacaoAte).getTime()) {
      d.status = 'EXPIRADO';
      d.expiradoEm = agora.toISOString();
      fs_set_(bingo_colecao_('deteccoes'), docId, d);
      bingo_auditar_('MANIFESTACAO_EXPIRADA', d.deteccaoId, sessao, null, d);
      return { ok: false, expirado: true, mensagem: 'Prazo de manifestação expirado.' };
    }

    d.status = 'CONFIRMADO';
    d.manifestadoEm = agora.toISOString();
    d.confirmadoEm = agora.toISOString();
    d.confirmadoPor = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
    fs_set_(bingo_colecao_('deteccoes'), docId, d);

    var vencedorId = bingo_uuid_('VENC');
    var vencedor = {
      vencedorId: vencedorId,
      deteccaoId: d.deteccaoId,
      eventoId: d.eventoId,
      rodadaId: d.rodadaId,
      cartelaId: d.cartelaId,
      participanteId: d.participanteId,
      associadoId: d.associadoId || '',
      numeroVencedor: Number(d.numeroVencedor),
      confirmadoEm: agora.toISOString(),
      confirmadoPor: d.confirmadoPor,
      statusPremio: 'PENDENTE'
    };
    fs_set_(bingo_colecao_('vencedores'), vencedorId, vencedor);
    bingo_auditar_('VENCEDOR_CONFIRMADO', vencedorId, sessao, null, vencedor);
    return { ok: true, deteccao: d, vencedor: vencedor };
  } finally {
    lock.releaseLock();
  }
}
