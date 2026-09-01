// ============================================================================
// ARQUIVO: PortalAuditoriaAdmin.gs
// Painel de leitura da aba "Portal_Auditoria" — hoje só gravada pelo Portal
// Público (portalAuditar_, em Código.gs do repositório sisgep-portal-publico),
// sem nenhuma tela pra equipe/diretoria consultar sem abrir a planilha.
// Este módulo é só leitura: não grava nada nessa aba.
// ============================================================================

var PAUD_ABA = 'Portal_Auditoria';
var PAUD_LIMITE_LINHAS = 500; // mais recentes primeiro — evita payload gigante

/**
 * Lista os registros mais recentes da auditoria do Portal do Associado.
 */
function listarPortalAuditoria(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(PAUD_ABA);
    if (!sh || sh.getLastRow() < 2) return [];

    var ultimaLinha = sh.getLastRow();
    var primeiraLinha = Math.max(2, ultimaLinha - PAUD_LIMITE_LINHAS + 1);
    var qtdLinhas = ultimaLinha - primeiraLinha + 1;

    var dados = sh.getRange(primeiraLinha, 1, qtdLinhas, 3).getValues();
    var lista = [];
    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      lista.push({
        data: linha[0] instanceof Date
          ? Utilities.formatDate(linha[0], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
          : String(linha[0] || ''),
        cpfFinal: String(linha[1] || ''),
        acao: String(linha[2] || '')
      });
    }
    lista.reverse(); // mais recentes primeiro
    return lista;
  } catch (e) {
    Logger.log('listarPortalAuditoria: ' + e);
    return [];
  }
}
