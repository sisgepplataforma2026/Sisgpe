/**
 * PAINEL DE EMISSÃO (Marcelha) — abre a tela e conversa com o motor.
 * Depende de EventosEmissao (emissao_*) e EventosFirestore (fs_*).
 */

// Abre a tela em modal (padrão dos módulos do SISGEP)
function abrirPainelEmissaoEventos() {
  var html = HtmlService.createHtmlOutputFromFile('EventoPainel')
    .setWidth(780).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Emissão de Ingressos — Compasso da Vida 2026');
}

// --- funções chamadas pela tela (google.script.run) ---
function painelEmissao_status() {
  var c = emissao_lerContador_();
  return { limite: c.limite, usadas: c.vagasUsadas, restantes: c.limite - c.vagasUsadas,
           ultimoNumero: c.ultimoNumero, modoTeste: emissao_modoTeste_() };
}

function painelEmissao_buscar(termo) {
  return emissao_buscarAssociado(termo);
}

function painelEmissao_emitirGrupo(itens, operador) {
  var resultados = [];
  for (var i = 0; i < itens.length; i++) {
    var it = itens[i];
    it.operador = operador || 'Painel';
    resultados.push(emissao_emitirIngresso(it));
  }
  return resultados;
}
function testarTelaEmissao_TEMP() {
  var html = HtmlService.createHtmlOutputFromFile('EventoPainel').setWidth(780).setHeight(700);
  var ss = SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  SpreadsheetApp.setActiveSpreadsheet(ss);
  ss.toast('Abra a planilha do SISGEP para ver a tela.', 'Emissão', 5);
  SpreadsheetApp.getUi().showModalDialog(html, 'Emissão de Ingressos — Teste');
}
// Cria o menu "Eventos" na planilha. Rode UMA vez a partir da planilha aberta.
function criarMenuEventos() {
  SpreadsheetApp.getUi()
    .createMenu('🎫 Eventos')
    .addItem('Emissão de Ingressos', 'abrirPainelEmissaoEventos')
    .addToUi();
}
