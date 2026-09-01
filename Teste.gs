
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
function medirPaginaSISGEP() {
  var t = HtmlService.createTemplateFromFile('index');
  t.tokenSessao = 'TESTE-DIAGNOSTICO';          // ← o que faltava

  var html = t.evaluate().getContent();

  Logger.log('TAMANHO MONTADO ...... ' + html.length + ' caracteres');
  Logger.log('tem spCont? ......... ' + (html.indexOf('spCont') > -1));
  Logger.log('tem mJuridico? ...... ' + (html.indexOf('mJuridico') > -1));
  Logger.log('tem mFichasSindicais? ' + (html.indexOf('mFichasSindicais') > -1));
  Logger.log('quantas seções spM .. ' + (html.split('class="spM').length - 1));
  Logger.log('ULTIMOS 200 ......... ' + html.slice(-200));
}
function medirPropriedades() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var n = 0, bytes = 0, antiga = null, nova = null;
  Object.keys(p).forEach(function (k) {
    bytes += k.length + String(p[k]).length;
    if (k.indexOf("SESSAO_SISGEP_") !== 0) return;
    n++;
    try {
      var s = JSON.parse(p[k]);
      if (!antiga || s.criadoEm < antiga) antiga = s.criadoEm;
      if (!nova   || s.criadoEm > nova)   nova   = s.criadoEm;
    } catch (e) {}
  });
  var f = function (t) { return t
    ? Utilities.formatDate(new Date(t), "America/Sao_Paulo", "dd/MM/yyyy HH:mm") : "—"; };
  Logger.log("Propriedades no total : " + Object.keys(p).length);
  Logger.log("Sessões               : " + n);
  Logger.log("Espaço usado          : " + (bytes/1024).toFixed(1) + " KB de 500 KB  ("
                                        + (bytes/5120).toFixed(1) + "%)");
  Logger.log("Mais antiga           : " + f(antiga));
  Logger.log("Mais nova             : " + f(nova));
}
/**
 * IMPRESSAO DIGITAL DAS FUNCOES DOS MODULOS 01, 02 e 03
 * ---------------------------------------------------------------------------
 * SO LE. Nao altera nada, nao envia nada, nao grava nada.
 *
 * POR QUE ELA EXISTE: quem esta do outro lado (o Claude) tem acesso apenas ao
 * repositorio GitHub — nao consegue ler o codigo do projeto de producao. Sem
 * comparar os dois lados, aplicar homologacao por cima seria escrever por cima
 * de coisa que ele nao viu.
 *
 * Esta funcao mede o lado de PRODUCAO de forma compacta: para cada funcao dos
 * modulos auditados, diz se ela existe, quanto ocupa e um hash do corpo
 * normalizado (espacos colapsados, para o hash nao mudar por formatacao).
 *
 * Comparando os hashes com os do repositorio sai a lista exata do que difere —
 * sem precisar copiar 460 KB de codigo.
 *
 * COMO USAR: cole no fim de qualquer arquivo .gs da PRODUCAO, salve, rode
 * `impressaoDigitalModulos` e me mande o registro de execucao inteiro.
 * Depois pode apagar a funcao.
 */
function impressaoDigitalModulos() {
  var alvos = [
  "inicio_contarOficiosPendentes_",
  "inicio_statusSaude_",
  "inicio_executarFonte_",
  "getResumoInicioSISGEP",
  "chatSISGEP",
  "coletarContextoSISGEP_",
  "montarSystemPrompt_",
  "selecionarContextoIA_",
  "blocoDocumentoIA_",
  "chatPodeFonte_",
  "extrairTermoNome_",
  "radicalBuscaIA_",
  "agruparPorArtigoIA_",
  "normalizarBuscaIA_",
  "reenviarOficio",
  "obterAnexosOriginaisFilaOficio_",
  "obterDestinoReenvioOficio",
  "tokenEscolaArquivo_",
  "recuperarAnexosDaPastaDrive_",
  "enviarEmailOficio_",
  "validarListaEmails_",
  "verificarConfirmacoesRecebimento",
  "verificarFalhasEntregaOficios",
  "MON_OFICIOS_textoConfirmaRecebimento_",
  "MON_OFICIOS_ehRemetenteAutomatico_",
  "instalarTriggerConfirmacoes",
  "removerTriggerConfirmacoes",
  "instalarTriggerFalhasEntrega",
  "removerTriggerFalhasEntrega",
  "instalarTriggerConfirmacoesOficios",
  "oficiosQueNaoChegaram",
  "ofDiag_classificar_",
  "getDashboardOficiosData",
  "processarFilaEnvioOficios",
  "enviarOficioDaFilaAgora",
  "exigirAdminOuSessao_",
  "exigirModulo_"
  ];

  /* djb2 — hash curto e estavel, so para comparar igualdade. Nao e seguranca. */
  function hash_(txt) {
    var h = 5381;
    for (var i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  var linhas = [];
  linhas.push("IMPRESSAO_DIGITAL_SISGEP v1");
  linhas.push("ambiente=" + (typeof getAmbienteAtual === "function"
    ? String(getAmbienteAtual() || "?") : "?"));
  linhas.push("quando=" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"));
  linhas.push("---");

  var existem = 0, faltam = 0;
  alvos.forEach(function (nome) {
    var fn = null;
    try { fn = this[nome]; } catch (e) {}
    if (typeof fn !== "function") {
      try { fn = eval(nome); } catch (e2) { fn = null; }
    }
    if (typeof fn !== "function") {
      linhas.push(nome + " | AUSENTE");
      faltam++;
      return;
    }
    var src = String(fn).replace(/\s+/g, " ").trim();
    linhas.push(nome + " | " + src.length + " | " + hash_(src));
    existem++;
  });

  linhas.push("---");
  linhas.push("existem=" + existem + " ausentes=" + faltam);

  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
