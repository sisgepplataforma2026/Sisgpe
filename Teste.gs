
function listarColunasAssociados_TEMP() {
  var ss = SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName('Associados'); // <- agora com o nome certo
  if (!aba) {
    Logger.log('Aba não encontrada. Abas disponíveis: ' + ss.getSheets().map(function(s){return s.getName();}).join(' | '));
    return;
  }
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  cabecalhos.forEach(function(nome, i){ Logger.log((i+1) + ' → ' + nome); });
}
function verFiliado_TEMP() {
  var ss = SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName('Associados');
  var v = aba.getRange(2, 4, 5, 1).getValues(); // coluna "Filiado", 5 primeiras linhas
  Logger.log('Exemplos de "Filiado": ' + JSON.stringify(v));
}
function abrirEmissaoTeste() {
  var html = HtmlService.createHtmlOutputFromFile('EventoPainel').setWidth(780).setHeight(700);
  return html;
}