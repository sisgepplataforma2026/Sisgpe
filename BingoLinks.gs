/**
 * BINGO ONLINE — LINKS PÚBLICOS E ESTADO DO ASSOCIADO
 * O token nunca contém CPF, associadoId ou cartelaId. O banco guarda só hash.
 */

function bingo_linkPublico_(token) {
  return getSistemaUrlBase() + '?bingo=' + encodeURIComponent(String(token || ''));
}

function bingo_buscarCartelaPorId_(cartelaId) {
  var itens = bingo_queryEquals_(bingo_colecao_('cartelas'), 'cartelaId', String(cartelaId || ''), 5);
  return itens.length ? { docId: itens[0].id, data: itens[0].data } : null;
}

/**
 * Gera ou renova o link de uma cartela. Pode ser feito depois do início da
 * rodada porque muda somente a credencial de acesso, nunca os números.
 */
function bingo_gerarLinkCartela(cartelaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  var achado = bingo_buscarCartelaPorId_(cartelaId);
  if (!achado) return { ok: false, mensagem: 'Cartela não encontrada.' };

  var token = bingo_tokenSeguro_();
  var cartela = achado.data;
  var anterior = { tokenHash: cartela.tokenHash || '', linkAtualizadoEm: cartela.linkAtualizadoEm || '' };
  cartela.tokenHash = bingo_hash_(token);
  cartela.linkAtualizadoEm = bingo_agoraIso_();
  cartela.linkAtualizadoPor = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
  fs_set_(bingo_colecao_('cartelas'), achado.docId, cartela);

  bingo_auditar_('LINK_CARTELA_GERADO', cartela.cartelaId, sessao, anterior, {
    eventoId: cartela.eventoId,
    rodadaId: cartela.rodadaId,
    participanteId: cartela.participanteId,
    linkAtualizadoEm: cartela.linkAtualizadoEm
  });

  return {
    ok: true,
    cartelaId: cartela.cartelaId,
    participanteId: cartela.participanteId,
    url: bingo_linkPublico_(token),
    token: token
  };
}

function bingo_revogarLinkCartela(cartelaId, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  var achado = bingo_buscarCartelaPorId_(cartelaId);
  if (!achado) return { ok: false, mensagem: 'Cartela não encontrada.' };
  var c = achado.data;
  c.tokenHash = '';
  c.linkRevogadoEm = bingo_agoraIso_();
  c.linkRevogadoPor = sessao.nome || sessao.usuario || sessao.email || 'SISGEP';
  fs_set_(bingo_colecao_('cartelas'), achado.docId, c);
  bingo_auditar_('LINK_CARTELA_REVOGADO', c.cartelaId, sessao, null, {
    eventoId: c.eventoId, rodadaId: c.rodadaId, participanteId: c.participanteId
  });
  return { ok: true };
}

function bingo_resolverTokenPublico_(token) {
  token = String(token || '').trim();
  if (!token || token.length < 30) return null;
  var hash = bingo_hash_(token);
  var itens = bingo_queryEquals_(bingo_colecao_('cartelas'), 'tokenHash', hash, 2);
  if (!itens.length) return null;
  var c = itens[0].data;
  if (String(c.status || 'ATIVA') !== 'ATIVA') return null;
  return { docId: itens[0].id, cartela: c };
}

function bingo_estadoPublico(token) {
  var acesso = bingo_resolverTokenPublico_(token);
  if (!acesso) return { ok: false, codigo: 'LINK_INVALIDO', mensagem: 'Link inválido ou revogado.' };

  var c = acesso.cartela;
  var rodada = bingo_obterRodada_(c.rodadaId);
  if (!rodada) return { ok: false, codigo: 'RODADA_NAO_ENCONTRADA', mensagem: 'Rodada não encontrada.' };
  var cfg = fs_get_(bingo_colecao_('config'), c.eventoId) || bingo_configPadrao_(c.eventoId);
  var sorteios = bingo_numerosOficiais_(c.rodadaId);
  var deteccoes = bingo_queryEquals_(bingo_colecao_('deteccoes'), 'cartelaId', c.cartelaId, 20)
    .map(function(x) { return x.data; })
    .filter(function(x) { return String(x.rodadaId) === String(c.rodadaId); });
  var deteccao = deteccoes.length ? deteccoes[0] : null;

  return {
    ok: true,
    servidorEm: bingo_agoraIso_(),
    evento: {
      eventoId: c.eventoId,
      youtubeUrl: cfg.youtubeUrl || '',
      status: cfg.status || 'RASCUNHO'
    },
    rodada: {
      rodadaId: rodada.rodadaId,
      nome: rodada.nome || 'Rodada',
      descricao: rodada.descricao || '',
      modalidade: rodada.modalidade,
      premioDescricao: rodada.premioDescricao || '',
      status: rodada.status,
      prazoManifestacaoSegundos: Number(rodada.prazoManifestacaoSegundos || 180)
    },
    cartela: {
      cartelaId: c.cartelaId,
      numeros: bingo_parseJson_(c.numerosJson, []),
      fingerprint: c.fingerprint || ''
    },
    sorteios: sorteios.map(function(s) {
      return { numero: Number(s.numero), letra: String(s.letra || ''), posicao: Number(s.posicao || 0), registradoEm: s.registradoEm || '' };
    }),
    deteccao: deteccao ? {
      deteccaoId: deteccao.deteccaoId,
      status: deteccao.status,
      numeroVencedor: Number(deteccao.numeroVencedor || 0),
      detectadoEm: deteccao.detectadoEm || '',
      prazoManifestacaoAte: deteccao.prazoManifestacaoAte || '',
      confirmadoEm: deteccao.confirmadoEm || ''
    } : null
  };
}
