function abrirAssistenteIA() {

  var html = HtmlService
    .createHtmlOutputFromFile('IA_HTML')
    .setTitle('Assistente IA SISGEP');

  return html;

}