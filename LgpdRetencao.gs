// ================================================================
// ARQUIVO: LgpdRetencao.gs
// Orquestra o expurgo periódico de dados sensíveis com prazo de
// guarda definido: geolocalização de check-in (Visitas.gs) e dados
// brutos de consulta à Receita Federal (EscolasReceita.gs).
//
// Prazo de retenção: 5 anos, decisão registrada em 2026-08-04.
//
// INSTALAÇÃO (uma vez, pelo editor do Apps Script):
//   instalarTriggerExpurgoLGPD()
// ================================================================

/**
 * Função chamada pelo gatilho diário. Sem sessão — assim como os
 * demais gatilhos de horário do SISGEP (ex.: processarEmailsMensalidade),
 * roda sem usuário logado.
 */
function verificarEExpurgarDadosLGPD() {
  var resultado = { visitas: null, receita: null };

  try {
    resultado.visitas = visitas_expurgarGeolocalizacaoAntiga_();
    Logger.log('[LGPD] Expurgo de geolocalização (Visitas): ' + JSON.stringify(resultado.visitas));
  } catch (e) {
    Logger.log('[LGPD] Erro no expurgo de geolocalização: ' + e.message);
  }

  try {
    resultado.receita = escolasReceitaExpurgarDadosAntigos_();
    Logger.log('[LGPD] Expurgo de dados da Receita Federal: ' + JSON.stringify(resultado.receita));
  } catch (e) {
    Logger.log('[LGPD] Erro no expurgo de dados da Receita: ' + e.message);
  }

  return resultado;
}

/**
 * Execução manual sob demanda, para um administrador confirmar o
 * expurgo fora do horário do gatilho (ex.: auditoria de compliance).
 */
function executarExpurgoLGPDAgora(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  return verificarEExpurgarDadosLGPD();
}

/* ================= TRIGGER: INSTALAR / REMOVER ================= */

function instalarTriggerExpurgoLGPD() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarEExpurgarDadosLGPD') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('verificarEExpurgarDadosLGPD').timeBased().everyDays(1).atHour(3).create();
  Logger.log('✅ Trigger de expurgo LGPD instalado — executa diariamente às 3h.');
  return { ok: true, mensagem: 'Trigger de expurgo LGPD instalado com sucesso — executa diariamente às 3h.' };
}

function removerTriggerExpurgoLGPD() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarEExpurgarDadosLGPD') {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  return { ok: true, mensagem: removidos + ' trigger(s) removido(s).' };
}
