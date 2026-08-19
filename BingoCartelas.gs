/**
 * BINGO ONLINE — CARTELAS
 * Geração server-side, uma cartela por participante/rodada por padrão.
 */

function bingo_embaralhar_(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function bingo_intervalo_(inicio, fim) {
  var out = [];
  for (var i = inicio; i <= fim; i++) out.push(i);
  return out;
}

function bingo_gerarNumeros75_(casaLivre) {
  var colunas = [
    bingo_embaralhar_(bingo_intervalo_(1, 15)).slice(0, 5),
    bingo_embaralhar_(bingo_intervalo_(16, 30)).slice(0, 5),
    bingo_embaralhar_(bingo_intervalo_(31, 45)).slice(0, 5),
    bingo_embaralhar_(bingo_intervalo_(46, 60)).slice(0, 5),
    bingo_embaralhar_(bingo_intervalo_(61, 75)).slice(0, 5)
  ];
  if (casaLivre) colunas[2][2] = 0;
  return colunas;
}

function bingo_fingerprintCartela_(rodadaId, participanteId, numeros) {
  return bingo_hash_(String(rodadaId) + '|' + String(participanteId) + '|' + bingo_json_(numeros));
}

function bingo_cartelaDocId_(rodadaId, participanteId) {
  return bingo_hash_(String(rodadaId) + '|' + String(participanteId)).substring(0, 40);
}

function bingo_gerarCartela(dados, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  dados = dados || {};
  var rodadaId = String(dados.rodadaId || '').trim();
  var participanteId = String(dados.participanteId || '').trim();
  var associadoId = String(dados.associadoId || '').trim();
  if (!rodadaId || !participanteId) return { ok: false, mensagem: 'rodadaId e participanteId são obrigatórios.' };

  var rodada = bingo_obterRodada_(rodadaId);
  if (!rodada) return { ok: false, mensagem: 'Rodada não encontrada.' };
  if ([BINGO_STATUS_RODADA.EM_ANDAMENTO, BINGO_STATUS_RODADA.PAUSADA, BINGO_STATUS_RODADA.AGUARDANDO_MANIFESTACAO, BINGO_STATUS_RODADA.ENCERRADA].indexOf(rodada.status) >= 0) {
    return { ok: false, mensagem: 'Não é permitido gerar nova cartela após o início da rodada.' };
  }

  var docId = bingo_cartelaDocId_(rodadaId, participanteId);
  var existente = fs_get_(bingo_colecao_('cartelas'), docId);
  if (existente) return { ok: true, existente: true, cartela: bingo_hidratarCartela_(existente) };

  var numeros = bingo_gerarNumeros75_(rodada.usaCasaLivre !== false);
  var token = bingo_tokenSeguro_();
  var cartela = {
    cartelaId: bingo_uuid_('CAR'),
    eventoId: rodada.eventoId,
    rodadaId: rodadaId,
    participanteId: participanteId,
    associadoId: associadoId,
    numerosJson: bingo_json_(numeros),
    fingerprint: bingo_fingerprintCartela_(rodadaId, participanteId, numeros),
    tokenHash: bingo_hash_(token),
    status: 'ATIVA',
    bloqueada: false,
    geradaEm: bingo_agoraIso_(),
    geradaPor: sessao.nome || sessao.usuario || sessao.email || 'SISGEP'
  };

  fs_set_(bingo_colecao_('cartelas'), docId, cartela);
  bingo_auditar_('CARTELA_GERADA', cartela.cartelaId, sessao, null, {
    eventoId: cartela.eventoId,
    rodadaId: rodadaId,
    participanteId: participanteId,
    fingerprint: cartela.fingerprint
  });

  var retorno = bingo_hidratarCartela_(cartela);
  retorno.token = token; // mostrado só nesta resposta para distribuição; persistido apenas como hash.
  return { ok: true, existente: false, cartela: retorno };
}

function bingo_hidratarCartela_(c) {
  if (!c) return null;
  var out = {};
  Object.keys(c).forEach(function(k) { out[k] = c[k]; });
  out.numeros = bingo_parseJson_(c.numerosJson, []);
  delete out.numerosJson;
  delete out.tokenHash;
  return out;
}

function bingo_bloquearCartelasRodada_(rodadaId, sessao) {
  // Com a ponte REST atual não há query por rodada + atualização em lote.
  // A imutabilidade é garantida por regra: bingo_gerarCartela recusa geração
  // após o início e nenhuma função pública de alteração de números existe.
  // Este marcador na rodada deixa a intenção explícita para futuras migrações.
  var rodada = bingo_obterRodada_(rodadaId);
  if (!rodada) throw new Error('Rodada não encontrada.');
  rodada.cartelasBloqueadas = true;
  rodada.cartelasBloqueadasEm = bingo_agoraIso_();
  rodada.versaoEstado = (parseInt(rodada.versaoEstado, 10) || 0) + 1;
  bingo_salvarRodada_(rodada);
  bingo_auditar_('CARTELAS_BLOQUEADAS', rodadaId, sessao, null, { rodadaId: rodadaId });
  return rodada;
}
