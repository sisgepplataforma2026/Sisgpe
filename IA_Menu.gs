// ================================================================
// 📄 ARQUIVO: IA_Menu.gs
//
// ⚠️ LEGADO — porta de entrada do assistente ANTERIOR à SOFIA.
//
// Verificado em 13/08/2026 pelos 5 passos da REGRA Nº 1:
//
//   1. cabeçalho .......... o arquivo não tinha nenhum (esta nota corrige)
//   2. rotas doGet/doPost . nenhuma rota de Code.gs chama abrirAssistenteIA
//   3. triggers/onOpen .... não existe onOpen no projeto
//   4. git log ............ vem do "Primeiro backup do Sisgpe"
//   5. grep no projeto .... nenhum .gs ou .html chama abrirAssistenteIA
//
// O assistente de hoje é a SOFIA: `chatSISGEP` (ChatIACore.gs) servido por
// ChatSISGEP.html dentro do Portal Administrativo, módulo "sofia". Este
// arquivo é a porta do que existia antes dela.
//
// FICA — REGRA Nº 1. Remoção só com pedido explícito, em commit separado.
// ================================================================

function abrirAssistenteIA() {
  /* PEDIA UM ARQUIVO QUE NÃO EXISTE.
   *
   * Pedia, pelo nome, um arquivo HTML chamado IA_HTML. Não existe arquivo
   * com esse nome no projeto, nem parecido. Quem chamasse esta função
   * recebia "No HTML file named IA_HTML", que não diz nada a quem clicou. Como a função continua exposta ao google.script.run, ela agora
   * responde em português e aponta para onde o assistente foi parar. */
  return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Assistente IA — agora é a SOFIA</title></head>' +
      '<body style="margin:0;padding:28px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'color:#0f172a;background:#f1f5f9;line-height:1.6">' +
      '<h2 style="margin:0 0 8px;color:#001f4d;font-size:18px">O assistente agora é a SOFIA</h2>' +
      '<p style="margin:0;font-size:14px">Esta tela é de uma versão anterior e não existe mais. ' +
      'Abra o Portal Administrativo e escolha <strong>Conversar com a SOFIA</strong> no menu.</p>' +
      '</body></html>')
    .setTitle('Assistente IA SISGEP');
}
