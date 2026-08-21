/**
 * BINGO ONLINE — TEMPO REAL
 * Publica apenas estado NÃO SENSÍVEL da rodada em uma coleção de leitura
 * pública controlada por regras do Firestore. Cartela e identidade continuam
 * atrás do token e do Apps Script.
 *
 * Para ativar o listener Web, configure FIREBASE_WEB_CONFIG nas propriedades
 * do script com JSON contendo apiKey, authDomain, projectId e appId.
 */

function bingo_realtimeColecao_() {
  return bingo_ambiente_() === 'homologacao'
    ? 'bingo_public_hml_rodadas'
    : 'bingo_public_prd_rodadas';
}

function bingo_realtimeDocId_(rodadaId) {
  return bingo_hash_('PUBLIC|' + String(rodadaId || '')).substring(0, 40);
}

function bingo_realtimeWebConfig_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_CONFIG');
    if (!raw) return null;
    var cfg = JSON.parse(raw);
    if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
    return {
      apiKey: String(cfg.apiKey),
      authDomain: String(cfg.authDomain || (cfg.projectId + '.firebaseapp.com')),
      projectId: String(cfg.projectId),
      appId: String(cfg.appId)
    };
  } catch (e) {
    return null;
  }
}

function bingo_publicarEstadoRodada_(rodada) {
  if (!rodada || !rodada.rodadaId) return { ok: false };
  try {
    var sorteios = bingo_numerosOficiais_(rodada.rodadaId);
    var estado = {
      rodadaId: rodada.rodadaId,
      eventoId: rodada.eventoId,
      nome: rodada.nome || 'Rodada',
      modalidade: rodada.modalidade || '',
      premioDescricao: rodada.premioDescricao || '',
      status: rodada.status || 'RASCUNHO',
      ultimoNumero: Number(rodada.ultimoNumero || 0),
      ultimaLetra: String(rodada.ultimaLetra || ''),
      sequenciaAtual: Number(rodada.sequenciaAtual || 0),
      versaoEstado: Number(rodada.versaoEstado || 0),
      sorteiosJson: bingo_json_(sorteios.map(function(s) {
        return {
          numero: Number(s.numero),
          letra: String(s.letra || ''),
          posicao: Number(s.posicao || 0),
          registradoEm: String(s.registradoEm || '')
        };
      })),
      atualizadoEm: bingo_agoraIso_()
    };
    fs_set_(bingo_realtimeColecao_(), bingo_realtimeDocId_(rodada.rodadaId), estado);
    return { ok: true };
  } catch (e) {
    Logger.log('[BINGO REALTIME] falha ao publicar: ' + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/**
 * Chamado pela cartela depois da primeira validação segura via token.
 * Não devolve identidade, cartela ou qualquer dado pessoal.
 */
function bingo_realtimeInfoPublico(token) {
  var acesso = bingo_resolverTokenPublico_(token);
  if (!acesso) return { ok: false, habilitado: false, mensagem: 'Link inválido.' };
  var c = acesso.cartela;
  var cfg = bingo_realtimeWebConfig_();
  if (!cfg) {
    return {
      ok: true,
      habilitado: false,
      fallbackMs: 5000,
      mensagem: 'Firebase Web ainda não configurado; usando sincronização de contingência.'
    };
  }
  return {
    ok: true,
    habilitado: true,
    firebase: cfg,
    colecao: bingo_realtimeColecao_(),
    documento: bingo_realtimeDocId_(c.rodadaId),
    rodadaId: c.rodadaId
  };
}

function bingo_realtimeDiagnostico(tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  var web = bingo_realtimeWebConfig_();
  var service = null;
  try { service = fs_getConfig_(); } catch (e) {}
  return {
    ok: !!(web && service),
    ambiente: bingo_ambiente_(),
    webConfigurado: !!web,
    serviceAccountConfigurada: !!service,
    colecaoPublica: bingo_realtimeColecao_()
  };
}
