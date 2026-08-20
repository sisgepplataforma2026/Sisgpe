/**
 * COMPASSO 2026 — Check-in atômico para 6–8 celulares simultâneos.
 */
function compasso_checkin(token, dispositivoId) {
  token = String(token || '').trim();
  if (!token) return {ok:false, codigo:'QR_INVALIDO', mensagem:'QR Code inválido.'};

  var tokenHash = compasso_hash_(token);
  var indice = fs_get_('qrTokens', tokenHash);
  if (!indice || indice.eventoId !== EMISSAO_CFG.EVENTO_ID)
    return {ok:false, codigo:'QR_INVALIDO', mensagem:'Ingresso inválido ou de outro evento.'};

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ing = fs_get_('ingressos', indice.ingressoId);
    if (!ing) return {ok:false,codigo:'NAO_ENCONTRADO',mensagem:'Ingresso não encontrado.'};
    if (ing.eventoId !== EMISSAO_CFG.EVENTO_ID)
      return {ok:false,codigo:'OUTRO_EVENTO',mensagem:'Ingresso de outro evento.'};
    if (ing.status === 'CANCELADO')
      return {ok:false,codigo:'CANCELADO',mensagem:'Ingresso cancelado.'};
    if (ing.status === 'UTILIZADO')
      return {ok:false,codigo:'JA_UTILIZADO',mensagem:'Ingresso já utilizado.', utilizadoEm:ing.utilizadoEm, utilizadoPor:ing.utilizadoPor};
    if (ing.status !== 'EMITIDO')
      return {ok:false,codigo:'STATUS_INVALIDO',mensagem:'Ingresso não está liberado para entrada.'};

    var agora = new Date();
    var operador = compasso_emailUsuario_();
    ing.status = 'UTILIZADO';
    ing.utilizadoEm = agora;
    ing.utilizadoPor = operador;
    ing.dispositivoId = String(dispositivoId || 'nao-informado');
    fs_set_('ingressos', indice.ingressoId, ing);

    var checkinId = compasso_uuid_();
    fs_set_('checkinsEventos', checkinId, {
      checkinId: checkinId,
      eventoId: EMISSAO_CFG.EVENTO_ID,
      ingressoId: indice.ingressoId,
      numero: ing.numero,
      pessoaId: ing.pessoaId || '',
      checkinEm: agora,
      checkinPor: operador,
      dispositivoId: String(dispositivoId || 'nao-informado'),
      status: 'VALIDO'
    });
    compasso_auditar_('CHECKIN','ingresso',indice.ingressoId,{checkinId:checkinId,dispositivoId:dispositivoId||''});
    return {ok:true,codigo:'LIBERADO',mensagem:'Entrada liberada.',nome:ing.nome,escola:ing.escola,categoria:ing.categoria,numero:ing.numero,checkinEm:agora};
  } finally { lock.releaseLock(); }
}

function compasso_desfazerCheckin(ingressoId, motivo) {
  motivo = String(motivo || '').trim();
  if (!motivo) throw new Error('Motivo obrigatório para desfazer check-in.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ing = fs_get_('ingressos', ingressoId);
    if (!ing) throw new Error('Ingresso não encontrado.');
    if (ing.status !== 'UTILIZADO') throw new Error('Ingresso não está utilizado.');
    var anterior = {utilizadoEm:ing.utilizadoEm, utilizadoPor:ing.utilizadoPor, dispositivoId:ing.dispositivoId};
    ing.status = 'EMITIDO';
    ing.checkinDesfeitoEm = new Date();
    ing.checkinDesfeitoPor = compasso_emailUsuario_();
    ing.checkinDesfeitoMotivo = motivo;
    ing.utilizadoEm = '';
    ing.utilizadoPor = '';
    ing.dispositivoId = '';
    fs_set_('ingressos', ingressoId, ing);
    compasso_auditar_('DESFAZER_CHECKIN','ingresso',ingressoId,{motivo:motivo,checkinAnterior:anterior});
    return {ok:true, ingressoId:ingressoId, status:'EMITIDO'};
  } finally { lock.releaseLock(); }
}
