/**
 * DIAGNÓSTICO DA FILA DE OFÍCIOS — "por que os ofícios não saem". SOMENTE LEITURA.
 *
 * (25/11/2026, o usuário: "Ofícios não estão sendo enviados"; a produção não é legível daqui.)
 *
 * COMO USAR: no editor do Apps Script de PRODUÇÃO, executar `diagnosticoFilaOficiosSISGEP` e abrir Execuções → Registro.
 *
 * LÊ: cota de e-mail do dia, gatilhos, e da aba FILA_ENVIO_OFICIOS só as colunas de status (NÃO lê HTML_BODY nem os anexos).
 * NÃO GRAVA, NÃO ENVIA e NÃO CRIA nada: usa getSheetByName (e não obterOuCriarAbaFilaOficios_, que cria a aba).
 * Não imprime endereços de e-mail — só quantidades. Pode ser apagado a qualquer momento.
 */
function diagnosticoFilaOficiosSISGEP() {
  var L = [], LIMITE_POR_EXECUCAO = 5, MAX_TENTATIVAS = 3, tz = "America/Sao_Paulo";
  function txt(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function data(v) {
    if (!v) return "—";
    if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? "—" : Utilities.formatDate(v, tz, "dd/MM HH:mm");
    return txt(v).slice(0, 16) || "—";
  }
  function ts(v) {
    if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? 0 : v.getTime();
    var d = new Date(txt(v)); return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  L.push("═══ DIAGNÓSTICO DA FILA DE OFÍCIOS — " + Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm") + " ═══");

  /* 1) cota */
  var cota = null;
  try { cota = MailApp.getRemainingDailyQuota(); } catch (e1) { L.push("1. Cota de e-mail: ERRO " + e1.message); }
  if (cota !== null) {
    L.push("1. Cota de e-mail restante hoje: " + cota + (cota < LIMITE_POR_EXECUCAO
      ? "   ⚠ ABAIXO DE " + LIMITE_POR_EXECUCAO + ": a fila PAUSA sem marcar erro (só volta quando a cota renova)" : "   (suficiente para uma rodada)"));
  }

  /* 2) gatilhos */
  try {
    var gat = ScriptApp.getProjectTriggers(), cont = {};
    gat.forEach(function (g) { var f = g.getHandlerFunction(); cont[f] = (cont[f] || 0) + 1; });
    var n = cont["processarFilaEnvioOficios"] || 0;
    L.push("2. Gatilho da fila (processarFilaEnvioOficios, 5 em 5 min): " + n + (n === 0
      ? "   ⚠ NÃO INSTALADO: nada processa a fila sozinho" : n > 1 ? "   ⚠ DUPLICADO" : "   ok"));
  } catch (e2) { L.push("2. Gatilhos: ERRO " + e2.message); }

  /* 3) a fila */
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh) { L.push("3. Aba FILA_ENVIO_OFICIOS: NÃO EXISTE"); Logger.log(L.join("\n")); return { texto: L.join("\n") }; }
  var ult = sh.getLastRow();
  L.push("3. Fila: " + Math.max(ult - 1, 0) + " linha(s) no total.");
  if (ult < 2) { Logger.log(L.join("\n")); return { texto: L.join("\n") }; }
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(txt);
  var ix = {};
  ["NUMERO_OFICIO", "ESCOLA", "STATUS", "TENTATIVAS", "ULTIMO_ERRO", "DATA_ULTIMA_TENTATIVA", "DATA_ENVIO", "DATA_CRIACAO", "EMAILS_TODOS", "EMAIL_PRINCIPAL"]
    .forEach(function (c) { ix[c] = cab.indexOf(c) + 1; });
  var faltam = Object.keys(ix).filter(function (c) { return !ix[c]; });
  if (faltam.length) L.push("   ⚠ colunas que não achei no cabeçalho: " + faltam.join(", "));
  function col(nome) { return ix[nome] ? sh.getRange(2, ix[nome], ult - 1, 1).getValues().map(function (r) { return r[0]; }) : []; }
  var st = col("STATUS"), num = col("NUMERO_OFICIO"), esc = col("ESCOLA"), tent = col("TENTATIVAS"), err = col("ULTIMO_ERRO"),
      dUlt = col("DATA_ULTIMA_TENTATIVA"), dEnv = col("DATA_ENVIO"), dCri = col("DATA_CRIACAO"), todos = col("EMAILS_TODOS"), prin = col("EMAIL_PRINCIPAL");

  var cont2 = {};
  st.forEach(function (s) { var k = txt(s).toUpperCase() || "(vazio)"; cont2[k] = (cont2[k] || 0) + 1; });
  L.push("   Por status: " + Object.keys(cont2).sort().map(function (k) { return k + " " + cont2[k]; }).join(" · "));

  /* o que a rodada de 5 min pegaria, e quantos destinatários isso consome */
  function nDest(i) {
    var t = txt(todos[i]) || txt(prin[i]);
    return t ? t.split(/[;,\s]+/).filter(function (x) { return x.indexOf("@") > 0; }).length : 0;
  }
  var abertos = [], destAbertos = 0, condenaveis = 0;
  for (var i = 0; i < st.length; i++) {
    var s = txt(st[i]).toUpperCase();
    if (s === "PENDENTE" || s === "ERRO") {
      abertos.push(i);
      var t = parseInt(tent[i], 10) || 0;
      if (t >= MAX_TENTATIVAS) condenaveis++; else destAbertos += nDest(i);
    }
  }
  L.push("4. Esperando envio (PENDENTE ou ERRO): " + abertos.length + " ofício(s), ~" + destAbertos + " destinatário(s) a enviar"
    + (condenaveis ? "; " + condenaveis + " já com " + MAX_TENTATIVAS + "+ tentativas (a próxima rodada os encerra como erro permanente)" : "") + ".");
  if (cota !== null && abertos.length) {
    L.push("   Cota (" + cota + ") " + (cota >= destAbertos ? "COBRE" : "NÃO COBRE") + " o que está esperando (" + destAbertos + ").");
  }

  /* 5) o que foi enviado hoje / último envio */
  var hoje = Utilities.formatDate(new Date(), tz, "yyyyMMdd"), enviadosHoje = 0, maiorEnvio = 0, maiorIdx = -1;
  for (var j = 0; j < st.length; j++) {
    if (txt(st[j]).toUpperCase() !== "ENVIADO") continue;
    var t2 = ts(dEnv[j]);
    if (t2 && Utilities.formatDate(new Date(t2), tz, "yyyyMMdd") === hoje) enviadosHoje++;
    if (t2 > maiorEnvio) { maiorEnvio = t2; maiorIdx = j; }
  }
  L.push("5. Enviados HOJE: " + enviadosHoje + ". Último envio da fila: " + (maiorIdx > -1 ? data(new Date(maiorEnvio)) + " (ofício " + txt(num[maiorIdx]) + ")" : "nenhum com data"));

  /* 6) os abertos, do mais recente para o mais antigo (no máximo 15) */
  abertos.sort(function (a, b) { return ts(dCri[b]) - ts(dCri[a]); });
  L.push("6. Os que estão esperando (até 15, mais recentes primeiro):");
  abertos.slice(0, 15).forEach(function (k) {
    L.push("   • " + (txt(num[k]) || "(sem nº)") + " · " + txt(esc[k]).slice(0, 36) + " · " + txt(st[k]).toUpperCase() + " · tent. " + (txt(tent[k]) || 0)
      + " · criado " + data(dCri[k]) + " · última tentativa " + data(dUlt[k]) + " · " + nDest(k) + " dest."
      + (txt(err[k]) ? " · erro: " + txt(err[k]).slice(0, 110) : ""));
  });
  if (!abertos.length) L.push("   (nenhum — se o ofício não aparece aqui, ele nem entrou na fila: o defeito é na EMISSÃO, antes do envio)");

  /* 7) erros permanentes recentes */
  var perm = [];
  for (var m = 0; m < st.length; m++) if (txt(st[m]).toUpperCase() === "ERRO_PERMANENTE") perm.push(m);
  perm.sort(function (a, b) { return ts(dUlt[b]) - ts(dUlt[a]); });
  L.push("7. ERRO_PERMANENTE: " + perm.length + (perm.length ? " — os 5 mais recentes:" : ""));
  perm.slice(0, 5).forEach(function (k) {
    L.push("   • " + (txt(num[k]) || "(sem nº)") + " · " + txt(esc[k]).slice(0, 36) + " · última tentativa " + data(dUlt[k]) + " · " + txt(err[k]).slice(0, 110));
  });

  /* veredito em palavras */
  L.push("──────────────────────────────────────");
  var v;
  if (cota !== null && cota < LIMITE_POR_EXECUCAO && abertos.length) v = "A COTA DE E-MAIL ACABOU: os " + abertos.length + " ofício(s) esperam a renovação (rolante, até ~24h). Nada se perdeu.";
  else if (!abertos.length) v = "Nenhum ofício esperando na fila. Se um ofício não saiu, ele não entrou na fila (olhar a emissão) ou já consta ENVIADO (item 5).";
  else if (cota !== null && cota < destAbertos) v = "A cota não cobre tudo: saem os que couberem hoje e o resto amanhã.";
  else v = "Há ofício esperando e a cota cobre: a próxima rodada de 5 min deve enviar. Se não envia, ver o ERRO do item 6 e a execução de processarFilaEnvioOficios em Execuções.";
  L.push("LEITURA: " + v);
  Logger.log(L.join("\n"));
  return { texto: L.join("\n"), aguardando: abertos.length, cota: cota, enviadosHoje: enviadosHoje };
}
