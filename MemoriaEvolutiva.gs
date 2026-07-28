// ================================================================
// ARQUIVO: MemoriaEvolutiva.gs
// Memória Evolutiva — SindEducação-ES
// Aprende automaticamente com e-mails enviados pelo Gmail
// Trigger: a cada 6h via configurarTriggerMemoriaEvolutiva()
// v1.1 — fix typo novasPalavras + filtros e-mail automático
// ================================================================

var ME_LABEL_PROCESSADO = "SISGEP_Aprendido";
var ME_LABEL_IGNORADO   = "SISGEP_Ignorado";
var ME_MAX_EMAILS       = 15;
var ME_MODEL            = "claude-haiku-4-5-20251001";

function configurarTriggerMemoriaEvolutiva() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "memoriaEvolutivaGmail") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("memoriaEvolutivaGmail")
    .timeBased()
    .everyHours(6)
    .create();
  Logger.log("Trigger memoriaEvolutivaGmail configurado: a cada 6 horas.");
  return { ok: true, mensagem: "Trigger configurado com sucesso." };
}

function memoriaEvolutivaGmail() {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) {
      Logger.log("memoriaEvolutivaGmail: ANTHROPIC_API_KEY não configurada.");
      return { ok: false, mensagem: "API key não configurada." };
    }

    var labelAprendido = GmailApp.getUserLabelByName(ME_LABEL_PROCESSADO)
      || GmailApp.createLabel(ME_LABEL_PROCESSADO);
    var labelIgnorado  = GmailApp.getUserLabelByName(ME_LABEL_IGNORADO)
      || GmailApp.createLabel(ME_LABEL_IGNORADO);

    var query = "in:sent -label:" + ME_LABEL_PROCESSADO + " -label:" + ME_LABEL_IGNORADO;
    var threads = GmailApp.search(query, 0, ME_MAX_EMAILS);

    if (!threads.length) {
      Logger.log("memoriaEvolutivaGmail: nenhum e-mail novo para aprender.");
      return { ok: true, aprendidos: 0, mensagem: "Nenhum e-mail novo." };
    }

    var assuntosAprendidos = carregarAssuntosAprendidos_();
    var aprendidos = 0, ignorados = 0, erros = 0;
    var resumo = [];

    threads.forEach(function(thread) {
      try {
        var msgs = thread.getMessages();
        var msg  = msgs[msgs.length - 1];

        var assunto = String(msg.getSubject() || "").trim();
        var corpo   = msg.getPlainBody() || "";
        var para    = msg.getTo() || "";
        var data    = msg.getDate();

        if (corpo.length < 80) {
          thread.addLabel(labelIgnorado);
          ignorados++;
          return;
        }

        if (ehEmailAutomatico_(assunto, corpo)) {
          thread.addLabel(labelIgnorado);
          ignorados++;
          return;
        }

        var categoriaAssunto = categorizarAssunto_(assunto);
        if (assuntosAprendidos[categoriaAssunto]) {
          var temNovidade = verificarNovidade_(corpo, assuntosAprendidos[categoriaAssunto]);
          if (!temNovidade) {
            thread.addLabel(labelIgnorado);
            ignorados++;
            return;
          }
        }

        var aprendizado = aprenderComEmail_(apiKey, {
          assunto:   assunto,
          corpo:     corpo.substring(0, 3000),
          para:      para,
          data:      data,
          categoria: categoriaAssunto
        });

        if (aprendizado && aprendizado.ok) {
          thread.addLabel(labelAprendido);
          assuntosAprendidos[categoriaAssunto] = aprendizado.resumo || "";
          aprendidos++;
          resumo.push({
            assunto:   assunto,
            categoria: categoriaAssunto,
            aprendido: aprendizado.resumo || "",
            status:    "OK"
          });
        } else {
          thread.addLabel(labelIgnorado);
          erros++;
        }

      } catch (eThread) {
        Logger.log("memoriaEvolutivaGmail thread erro: " + eThread.message);
        erros++;
      }
    });

    salvarAssuntosAprendidos_(assuntosAprendidos);

    Logger.log("memoriaEvolutivaGmail: " + aprendidos + " aprendidos, " + ignorados + " ignorados, " + erros + " erros.");
    return {
      ok:         true,
      aprendidos: aprendidos,
      ignorados:  ignorados,
      erros:      erros,
      resumo:     resumo,
      mensagem:   aprendidos + " padrão(ões) de escrita aprendido(s)."
    };

  } catch (e) {
    Logger.log("memoriaEvolutivaGmail erro geral: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

function aprenderComEmail_(apiKey, dados) {
  try {
    var prompt =
      "Analise este e-mail enviado pelo SindEducação-ES e extraia o padrão de escrita.\n\n" +
      "Assunto: " + dados.assunto + "\n" +
      "Para: " + dados.para + "\n" +
      "Categoria identificada: " + dados.categoria + "\n\n" +
      "CORPO DO E-MAIL:\n" + dados.corpo + "\n\n" +
      "Retorne APENAS um JSON válido com estas chaves:\n" +
      "{\n" +
      "  \"categoria\": \"categoria do e-mail\",\n" +
      "  \"saudacao\": \"como o e-mail começa\",\n" +
      "  \"tom\": \"formal/informal/assertivo/cordial/etc\",\n" +
      "  \"argumento_principal\": \"principal argumento usado\",\n" +
      "  \"base_legal\": \"cláusula ou lei citada, se houver\",\n" +
      "  \"prazo_dado\": \"prazo mencionado, se houver\",\n" +
      "  \"fechamento\": \"como o e-mail termina\",\n" +
      "  \"assinatura\": \"nome e cargo do signatário\",\n" +
      "  \"expressoes_chave\": [\"expressão 1\", \"expressão 2\"],\n" +
      "  \"resumo\": \"resumo de 1 linha do padrão aprendido\",\n" +
      "  \"exemplo_abertura\": \"primeiras 2 linhas do e-mail\",\n" +
      "  \"exemplo_fechamento\": \"últimas 2 linhas antes da assinatura\"\n" +
      "}\n\n" +
      "Sem texto adicional, sem markdown, apenas o JSON.";

    var requestBody = {
      model: ME_MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    if (response.getResponseCode() !== 200) {
      Logger.log("aprenderComEmail_ API erro: " + response.getResponseCode());
      return { ok: false };
    }

    var respJson  = JSON.parse(response.getContentText());
    var textoResp = respJson.content && respJson.content[0] ? respJson.content[0].text : "";

    var padrao;
    try {
      padrao = JSON.parse(textoResp.replace(/```json|```/g, "").trim());
    } catch(e) {
      Logger.log("aprenderComEmail_ parse erro: " + textoResp.substring(0, 200));
      return { ok: false };
    }

    var categoria  = "ESCRITA_" + String(dados.categoria || "GERAL").toUpperCase().replace(/\s+/g, "_");
    var subcatBase = padrao.categoria || dados.categoria;
    var dataStr    = Utilities.formatDate(dados.data || new Date(), "America/Sao_Paulo", "dd/MM/yyyy");

    salvarMemoria_(categoria, "Saudação",            padrao.saudacao            || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Tom",                 padrao.tom                 || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Argumento principal", padrao.argumento_principal || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Base legal",          padrao.base_legal          || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Prazo dado",          padrao.prazo_dado          || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Fechamento",          padrao.fechamento          || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Assinatura",          padrao.assinatura          || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Expressões-chave",    (padrao.expressoes_chave || []).join(" | "), "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Exemplo abertura",    padrao.exemplo_abertura    || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Exemplo fechamento",  padrao.exemplo_fechamento  || "", "Gmail/" + dataStr);
    salvarMemoria_(categoria, "Assunto aprendido",   dados.assunto              || "", "Gmail/" + dataStr);

    SpreadsheetApp.flush();

    Logger.log("aprenderComEmail_: padrão salvo para categoria " + categoria);
    return {
      ok:        true,
      resumo:    padrao.resumo || subcatBase,
      padrao:    padrao,
      categoria: categoria
    };

  } catch (e) {
    Logger.log("aprenderComEmail_ erro: " + e.message);
    return { ok: false };
  }
}

function categorizarAssunto_(assunto) {
  var a = String(assunto || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (a.indexOf("cobranca") >= 0 || a.indexOf("cobrança") >= 0 || a.indexOf("atraso") >= 0)
    return "COBRANCA";
  if (a.indexOf("mensalidade") >= 0 || a.indexOf("desconto") >= 0 || a.indexOf("folha") >= 0)
    return "MENSALIDADE";
  if (a.indexOf("oficio") >= 0 || a.indexOf("ofício") >= 0 || a.indexOf("filiacao") >= 0)
    return "OFICIO";
  if (a.indexOf("notificacao") >= 0 || a.indexOf("notificação") >= 0 || a.indexOf("juridico") >= 0)
    return "JURIDICO";
  if (a.indexOf("cct") >= 0 || a.indexOf("convencao") >= 0 || a.indexOf("convenção") >= 0)
    return "CCT";
  if (a.indexOf("rescisao") >= 0 || a.indexOf("rescisão") >= 0 || a.indexOf("demissao") >= 0)
    return "RESCISAO";
  if (a.indexOf("relatorio") >= 0 || a.indexOf("relatório") >= 0 || a.indexOf("comprovante") >= 0)
    return "RELATORIO";
  if (a.indexOf("voucher") >= 0 || a.indexOf("bolsa") >= 0 || a.indexOf("certificado") >= 0)
    return "VOUCHER";
  if (a.indexOf("sindeducacao") >= 0 || a.indexOf("sindicato") >= 0)
    return "INSTITUCIONAL";

  return "GERAL";
}

function verificarNovidade_(corpo, resumoAnterior) {
  var palavrasCorpo  = corpo.split(/\s+/).length;
  var palavrasResumo = resumoAnterior.split(/\s+/).length;
  var corpNorm       = corpo.toLowerCase().substring(0, 500);
  var resumoNorm     = resumoAnterior.toLowerCase();

  var palavrasChave = ["prezad", "solicita", "clausula", "mensalidade", "cobranca", "atenciosamente"];
  var novasPalavras = 0; // ✅ FIX: typo corrigido
  palavrasChave.forEach(function(p) {
    if (corpNorm.indexOf(p) >= 0 && resumoNorm.indexOf(p) < 0) novasPalavras++; // ✅ FIX
  });

  return novasPalavras >= 2 || palavrasCorpo > palavrasResumo * 2;
}

function ehEmailAutomatico_(assunto, corpo) {
  var a = String(assunto || "").toLowerCase();
  var c = String(corpo   || "").toLowerCase().substring(0, 200);

  if (a.indexOf("[sisgep]") >= 0) return true;
  if (a.indexOf("processamento automatico") >= 0) return true;
  if (c.indexOf("este e um e-mail automatico") >= 0) return true;
  if (c.indexOf("mensagem automatica") >= 0) return true;
  if (a.indexOf("noreply") >= 0 || a.indexOf("no-reply") >= 0) return true;
  // ✅ NOVO: filtros para e-mails de sistema
  if (a.indexOf("delivery status") >= 0) return true;
  if (a.indexOf("mailer-daemon") >= 0) return true;
  if (a.indexOf("undeliverable") >= 0) return true;
  if (a.indexOf("failure") >= 0 && a.indexOf("notification") >= 0) return true;
  if (a.indexOf("out of office") >= 0 || a.indexOf("auto:") >= 0) return true;
  if (a.indexOf("autoreply") >= 0 || a.indexOf("auto reply") >= 0) return true;
  if (c.indexOf("this is an automatic") >= 0) return true;
  if (c.indexOf("do not reply") >= 0 || c.indexOf("do not respond") >= 0) return true;

  return false;
}

function carregarAssuntosAprendidos_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("ME_ASSUNTOS_APRENDIDOS");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch(e) {
    return {};
  }
}

function salvarAssuntosAprendidos_(mapa) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      "ME_ASSUNTOS_APRENDIDOS",
      JSON.stringify(mapa)
    );
  } catch(e) {
    Logger.log("salvarAssuntosAprendidos_ erro: " + e.message);
  }
}

function resetarMemoriaEvolutiva() {
  try {
    PropertiesService.getScriptProperties().deleteProperty("ME_ASSUNTOS_APRENDIDOS");

    var labelAp = GmailApp.getUserLabelByName(ME_LABEL_PROCESSADO);
    var labelIg = GmailApp.getUserLabelByName(ME_LABEL_IGNORADO);

    if (labelAp) {
      var threads = GmailApp.search("label:" + ME_LABEL_PROCESSADO, 0, 100);
      threads.forEach(function(t) { t.removeLabel(labelAp); });
    }
    if (labelIg) {
      var threads2 = GmailApp.search("label:" + ME_LABEL_IGNORADO, 0, 100);
      threads2.forEach(function(t) { t.removeLabel(labelIg); });
    }

    Logger.log("resetarMemoriaEvolutiva: aprendizado resetado.");
    return { ok: true, mensagem: "Memória evolutiva resetada. Próxima execução reprocessará tudo." };
  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

function testarMemoriaEvolutiva() {
  var resultado = memoriaEvolutivaGmail();
  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function listarAprendizados() {
  var mapa = carregarAssuntosAprendidos_();
  Logger.log("Categorias aprendidas: " + Object.keys(mapa).join(", "));
  Logger.log(JSON.stringify(mapa, null, 2));
  return mapa;
}