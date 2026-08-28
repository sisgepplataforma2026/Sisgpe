// ============================================================================
// ARQUIVO: FinanceiroAuditoria.gs
// Log de alteração de valor em registros financeiros (Despesas, Recibos).
// Achado da auditoria do módulo Financeiro: editarDespesa/editarProcessoRecibo
// sobrescreviam o valor sem guardar quem mudou, de quanto pra quanto, nem
// por quê. Este arquivo só registra — não decide nada, não bloqueia nada.
// ============================================================================

var FINAUD_ABA = 'LOG_ALTERACOES_FINANCEIRAS';
var FINAUD_CABECALHO = ['DATA', 'MODULO', 'ID_REGISTRO', 'USUARIO', 'VALOR_ANTERIOR', 'VALOR_NOVO', 'MOTIVO'];

function finAudObterAba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(FINAUD_ABA);
  if (!sh) {
    sh = ss.insertSheet(FINAUD_ABA);
    sh.appendRow(FINAUD_CABECALHO);
    sh.getRange(1, 1, 1, FINAUD_CABECALHO.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Registra uma alteração de valor, só se o valor realmente mudou (compara
 * como texto normalizado — evita logar "100" -> "100,00" como se fosse
 * mudança real). Nunca lança erro: uma falha aqui não pode travar a edição
 * do registro financeiro em si.
 */
function finAudRegistrarAlteracaoValor_(modulo, idRegistro, valorAnterior, valorNovo, usuario, motivo) {
  try {
    var normalizar = function(v) {
      return String(v == null ? '' : v).trim().replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
    };
    if (normalizar(valorAnterior) === normalizar(valorNovo)) return;

    var sh = finAudObterAba_();
    sh.appendRow([
      new Date(),
      String(modulo || ''),
      String(idRegistro || ''),
      String(usuario || ''),
      String(valorAnterior == null ? '' : valorAnterior),
      String(valorNovo == null ? '' : valorNovo),
      String(motivo || '')
    ]);
  } catch (e) {
    Logger.log('finAudRegistrarAlteracaoValor_: ' + e);
  }
}

/**
 * Lista as últimas alterações de valor, mais recentes primeiro. Usado por
 * uma futura tela de consulta — por enquanto só a função de leitura, sem UI.
 */
function finAudListarAlteracoesValor(tokenSessao, modulo) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var sh = finAudObterAba_();
    if (sh.getLastRow() < 2) return [];
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, FINAUD_CABECALHO.length).getValues();
    var lista = [];
    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      if (modulo && String(linha[1] || '') !== modulo) continue;
      lista.push({
        data: linha[0] instanceof Date
          ? Utilities.formatDate(linha[0], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
          : String(linha[0] || ''),
        modulo: String(linha[1] || ''),
        idRegistro: String(linha[2] || ''),
        usuario: String(linha[3] || ''),
        valorAnterior: String(linha[4] || ''),
        valorNovo: String(linha[5] || ''),
        motivo: String(linha[6] || '')
      });
    }
    lista.reverse();
    return lista;
  } catch (e) {
    Logger.log('finAudListarAlteracoesValor: ' + e);
    return [];
  }
}
