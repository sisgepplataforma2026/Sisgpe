/**
 * DIAGNÓSTICO DE LATÊNCIA — onde os segundos vão. SOMENTE LEITURA.
 *
 * POR QUE EXISTE (23/11/2026): a produção ficou lenta e o painel de Execuções
 * só mostra a duração TOTAL de cada função. Funções quase vazias (login,
 * rotina da fila de ofícios) levavam 8–9 s, as pesadas 17–21 s. Quando uma
 * função que faz meia dúzia de chamadas leva 8 s, o tempo não está no que ela
 * faz — está num custo FIXO por execução, ou em UM serviço lento.
 *
 * COMO USAR (2 minutos, no editor do Apps Script, projeto de PRODUÇÃO):
 *
 *   1. Executar `pingSISGEP` e olhar a duração em Execuções.
 *        - ~0,3 s  → o custo fixo de iniciar o projeto é baixo; o gargalo
 *                    está em serviço (planilha etc.). Siga para o passo 2.
 *        - 4 s ou mais → o gargalo é o INÍCIO de toda execução: o Apps Script
 *                    avalia os ~174 arquivos .gs (4 MB) antes de rodar qualquer
 *                    função, e isso é pago em cada clique e cada gatilho.
 *   2. Executar `diagnosticoLatenciaSISGEP`, abrir Execuções → Registro e me
 *      mandar a tabela. Ela mede cada serviço em milissegundos.
 *
 * NÃO GRAVA DADO NENHUM. Não envia e-mail, não cria arquivo, não mexe em
 * planilha, propriedade ou gatilho. A única escrita é uma chave de cache que
 * expira sozinha em 30 segundos (item 2, para medir o cache). Só lê o resto. Pode ser apagado a qualquer momento.
 */

/** Função vazia: a duração dela em Execuções É o custo fixo de iniciar o projeto. */
function pingSISGEP() {
  return Date.now();
}

function diagnosticoLatenciaSISGEP() {
  var inicioGeral = Date.now();
  var linhas = [];

  function m(nome, fn) {
    var a = Date.now(), detalhe = "";
    try { var r = fn(); detalhe = (r === undefined || r === null) ? "" : String(r); }
    catch (e) { detalhe = "ERRO: " + e.message; }
    linhas.push({ nome: nome, ms: Date.now() - a, detalhe: detalhe });
  }

  var ss = null;
  var abas = [];

  m("1. Propriedades do script — ler 1 chave", function () {
    return PropertiesService.getScriptProperties().getProperty("SISGEP_AMBIENTE") || "(vazio)";
  });
  m("2. Cache — gravar e ler", function () {
    var c = CacheService.getScriptCache();
    c.put("DIAG_LATENCIA", "1", 30);
    return c.get("DIAG_LATENCIA") === "1" ? "ok" : "falhou";
  });
  m("3. Planilha — openById (abrir)", function () {
    ss = SpreadsheetApp.openById(PLANILHA_ID);
    return "aberta";
  });
  m("4. Planilha — getSheets (listar abas)", function () {
    abas = ss.getSheets();
    return abas.length + " abas";
  });
  m("5. Planilha — getSheetByName (usuários)", function () {
    return ss.getSheetByName(ABA_USUARIOS_LOGIN) ? "achou" : "NÃO achou";
  });
  m("6. Planilha — ler a aba de usuários inteira", function () {
    var sh = ss.getSheetByName(ABA_USUARIOS_LOGIN);
    var v = sh.getDataRange().getValues();
    return v.length + " linhas × " + (v[0] ? v[0].length : 0) + " colunas";
  });
  m("7. Planilha — tamanho em CÉLULAS reservadas (limite do Google: 10.000.000)", function () {
    var total = 0, maiores = [];
    abas.forEach(function (sh) {
      var c = sh.getMaxRows() * sh.getMaxColumns();
      total += c;
      maiores.push({ n: sh.getName(), c: c, l: sh.getLastRow() });
    });
    maiores.sort(function (x, y) { return y.c - x.c; });
    var top = maiores.slice(0, 5).map(function (x) {
      return x.n + " (" + x.c + " céls, " + x.l + " linhas usadas)";
    }).join(" | ");
    return total + " células no total · maiores: " + top;
  });
  m("8. Auditoria — tamanho da aba de log", function () {
    var sh = ss.getSheetByName("SISGEP_Auditoria");
    return sh ? sh.getLastRow() + " linhas" : "(aba não existe)";
  });
  m("9. Sessão — quem executa", function () {
    return Session.getEffectiveUser().getEmail();
  });
  m("10. Drive — pasta raiz", function () {
    return DriveApp.getRootFolder().getName();
  });
  m("11. Gatilhos — quantos e quais", function () {
    var t = ScriptApp.getProjectTriggers();
    var cont = {};
    t.forEach(function (g) { var f = g.getHandlerFunction(); cont[f] = (cont[f] || 0) + 1; });
    return t.length + " gatilhos: " + Object.keys(cont).sort().join(", ");
  });
  m("12. Propriedades do script — quantidade e tamanho", function () {
    var p = PropertiesService.getScriptProperties().getProperties();
    var n = 0, bytes = 0;
    Object.keys(p).forEach(function (k) { n++; bytes += k.length + String(p[k]).length; });
    return n + " propriedades, ~" + Math.round(bytes / 1024) + " KB de 500 KB";
  });

  var totalDentro = Date.now() - inicioGeral;
  var saida = [];
  saida.push("═══ DIAGNÓSTICO DE LATÊNCIA — SISGEP ═══");
  linhas.forEach(function (l) {
    saida.push(("      " + l.ms).slice(-6) + " ms  " + l.nome + "  →  " + l.detalhe);
  });
  saida.push("──────────────────────────────────────");
  saida.push("Tempo medido DENTRO da função: " + totalDentro + " ms");
  saida.push("Agora olhe a duração desta execução em Execuções. A DIFERENÇA entre ela e");
  saida.push("o tempo acima é o custo fixo de iniciar o projeto (carga dos arquivos).");
  Logger.log(saida.join("\n"));
  return { totalDentroMs: totalDentro, itens: linhas };
}
