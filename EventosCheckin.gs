/**
 * CHECK-IN DE INGRESSOS — Festa Compasso da Vida 2026
 * Fase 1 da auditoria do módulo Eventos: até aqui, nenhuma função marcava
 * um ingresso como usado (EventosEmissao.gs:155 já previa o status
 * 'UTILIZADO', mas nada o produzia). Este arquivo fecha esse ciclo.
 *
 * Fluxo: a equipe na entrada digita/lê o número do ingresso (FCV-2026-000123),
 * confere os dados na tela e confirma a entrada. Uma vez UTILIZADO, uma nova
 * tentativa é bloqueada (evita reentrada com o mesmo ingresso).
 *
 * Depende de EventosFirestore (fs_queryEquals_, fs_set_) e do cadastro de
 * EMISSAO_CFG em EventosEmissao.gs.
 */

var CHECKIN_COLLECTION_ = 'ingressos';

function checkin_normalizarNumero_(v) {
  var s = String(v || '').trim().toUpperCase();
  if (!s) return '';
  // aceita digitar só os números finais (ex.: "123" ou "000123")
  if (/^\d+$/.test(s)) {
    return EMISSAO_CFG.PREFIXO + s.padStart(6, '0');
  }
  return s;
}

// Busca o ingresso pelo número, sem alterar nada — usado para conferir antes de confirmar.
function checkin_buscarIngresso(codigo, tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  try {
    var numero = checkin_normalizarNumero_(codigo);
    if (!numero) return { ok: false, mensagem: 'Informe o número do ingresso.' };

    var resultados = fs_queryEquals_(CHECKIN_COLLECTION_, 'numero', numero);
    if (!resultados.length) return { ok: false, mensagem: 'Ingresso não encontrado: ' + numero };

    var ing = resultados[0].data;
    return {
      ok: true,
      id: resultados[0].id,
      numero: ing.numero,
      nome: ing.nome,
      categoria: ing.categoria,
      escola: ing.escola,
      status: ing.status,
      checkinEm: ing.checkinEm || '',
      checkinPor: ing.checkinPor || ''
    };
  } catch (e) {
    return { ok: false, mensagem: 'Erro ao buscar ingresso: ' + e.message };
  }
}

// Confirma a entrada: marca status='UTILIZADO'. Bloqueia dupla entrada e ingresso cancelado.
function checkin_confirmarEntrada(codigo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "eventos", false);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var numero = checkin_normalizarNumero_(codigo);
    if (!numero) return { ok: false, mensagem: 'Informe o número do ingresso.' };

    var resultados = fs_queryEquals_(CHECKIN_COLLECTION_, 'numero', numero);
    if (!resultados.length) return { ok: false, mensagem: 'Ingresso não encontrado: ' + numero };

    var docId = resultados[0].id;
    var ing = resultados[0].data;

    if (ing.status === 'CANCELADO') {
      return { ok: false, mensagem: 'Ingresso CANCELADO — entrada não permitida.', status: 'CANCELADO' };
    }
    if (ing.status === 'UTILIZADO') {
      return {
        ok: false,
        jaUsado: true,
        status: 'UTILIZADO',
        mensagem: 'Ingresso já utilizado' + (ing.checkinPor ? ' por ' + ing.checkinPor : '') +
                   (ing.checkinEm ? ' em ' + ing.checkinEm : '') + '.',
        checkinEm: ing.checkinEm || '',
        checkinPor: ing.checkinPor || ''
      };
    }

    ing.status = 'UTILIZADO';
    ing.checkinEm = new Date();
    ing.checkinPor = sessao.nome || sessao.usuario || 'Check-in';
    fs_set_(CHECKIN_COLLECTION_, docId, ing);

    return {
      ok: true,
      mensagem: 'Entrada confirmada.',
      numero: ing.numero,
      nome: ing.nome,
      categoria: ing.categoria,
      escola: ing.escola
    };
  } catch (e) {
    return { ok: false, mensagem: 'Erro ao confirmar entrada: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPASSO 2026 — CHECK-IN DE PORTARIA

   Trazido de feat/compasso-2026-hardening em 21/08/2026, por ADIÇÃO.

   POR QUE ADIÇÃO E NÃO SUBSTITUIÇÃO DO ARQUIVO. Os dois branches se separaram
   em 29/07 e seguiram por caminhos diferentes por três semanas. Copiar o
   arquivo inteiro do Compasso apagaria o que foi feito aqui nesse intervalo.
   Medido antes de trazer: o Compasso SÓ ACRESCENTOU a este arquivo (+73, −0),
   então as duas funções abaixo entram sem custo para nada que já existia.

   As demais mudanças daquele branch em arquivos compartilhados NÃO vieram
   junto, e isso foi decisão consciente: ele removia três rotas públicas do
   Code.gs, uma delas a `?codigo=`, que é o link de validação impresso dentro
   do PDF de todo ofício (Oficios.gs:284 e :301). Ofícios é o único módulo em
   operação — apagar essa rota quebraria a conferência de documentos que já
   estão na mão das escolas.
   ══════════════════════════════════════════════════════════════════════════ */

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
