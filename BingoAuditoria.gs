/**
 * BINGO ONLINE — AUDITORIA
 * Reutiliza a trilha única do SISGEP (AuditoriaCore.gs).
 */

function bingo_auditar_(acao, registroId, sessao, valorAnterior, valorNovo, justificativa) {
  try {
    if (typeof auditar_ !== 'function') return { ok: false, destino: 'NENHUM' };
    return auditar_({
      registroId: String(registroId || ''),
      modulo: 'Eventos',
      submodulo: 'Bingo Online',
      acao: String(acao || '').toUpperCase(),
      sessao: sessao || {},
      valorAnterior: valorAnterior === undefined ? null : valorAnterior,
      valorNovo: valorNovo === undefined ? null : valorNovo,
      justificativa: String(justificativa || ''),
      origem: 'SISGEP_BINGO'
    });
  } catch (e) {
    Logger.log('[BINGO][AUDITORIA] ' + e.message);
    return { ok: false, destino: 'NENHUM', mensagem: e.message };
  }
}
