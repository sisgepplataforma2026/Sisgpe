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
