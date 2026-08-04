/**
 * PAINEL DE EMISSÃO (Marcelha) — abre a tela e conversa com o motor.
 * Depende de EventosEmissao (emissao_*) e EventosFirestore (fs_*).
 */

// Abre a tela em modal (padrão dos módulos do SISGEP)
// AVISO (Fase 2 da auditoria de Eventos): desde que painelEmissao_* passaram
// a exigir sessão SISGEP válida, este caminho manual pelo editor da planilha
// deixou de funcionar — não há como obter um tokenSessao aqui dentro. O
// caminho real de produção é o botão "Abrir emissão de ingressos" em
// EventosAdmin.html, que abre a URL do webapp com o token da sessão já
// logada. Mantido só para referência; considerar remover na limpeza de
// código morto (Fase 4).
function abrirPainelEmissaoEventos() {
  var html = HtmlService.createHtmlOutputFromFile('EventoPainel')
    .setWidth(780).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Emissão de Ingressos — Compasso da Vida 2026');
}

// --- funções chamadas pela tela (google.script.run) — exigem sessão SISGEP ---
function painelEmissao_status(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var c = emissao_lerContador_();
  return { limite: c.limite, usadas: c.vagasUsadas, restantes: c.limite - c.vagasUsadas,
           ultimoNumero: c.ultimoNumero, modoTeste: emissao_modoTeste_(),
           operador: sessao.nome || sessao.usuario || 'SISGEP' };
}

function painelEmissao_buscar(termo, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return emissao_buscarAssociado(termo);
}

// O operador vem da sessão validada, nunca do que o cliente envie —
// antes era um campo de texto livre, agora é sempre quem está logado.
function painelEmissao_emitirGrupo(itens, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var operador = sessao.nome || sessao.usuario || 'SISGEP';
  var resultados = [];
  for (var i = 0; i < itens.length; i++) {
    var it = itens[i];
    it.operador = operador;
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
