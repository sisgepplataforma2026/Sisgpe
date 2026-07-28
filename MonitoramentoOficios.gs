// ============================================================================
// ARQUIVO: MonitoramentoOficios.gs
// VERSÃO AJUSTADA — preserva funções públicas e sincroniza Controle + Fila
// ----------------------------------------------------------------------------
// OBJETIVO DA CORREÇÃO
// 1. Não perder nenhuma função pública usada pelo frontend/triggers.
// 2. Manter o monitoramento funcionando com a aba Controle.
// 3. Sincronizar status também na FILA_ENVIO_OFICIOS quando existir.
// 4. Listar status combinando Controle + Fila para evitar tela vazia.
// ============================================================================

/* ── Confirmações de Recebimento ── */

function instalarTriggerConfirmacoes() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarConfirmacoesRecebimento") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("verificarConfirmacoesRecebimento").timeBased().everyHours(2).create();
  Logger.log("✅ Trigger de confirmações instalado — executa a cada 2 horas.");
  return { ok: true, mensagem: "Trigger de confirmações instalado com sucesso." };
}

function removerTriggerConfirmacoes() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarConfirmacoesRecebimento") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log("✅ Trigger de confirmações removido.");
  return { ok: true, mensagem: "Trigger de confirmações removido com sucesso." };
}

function verificarConfirmacoesRecebimento() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = obterOuCriarAbaFilaOficios_();

  if (!sh || sh.getLastRow() < 2) {
    var vazio = {
      ok: true,
      mensagem: "Fila vazia.",
      verificados: 0,
      confirmados: 0,
      sincronizadosControle: 0
    };

    Logger.log(JSON.stringify(vazio, null, 2));
    return vazio;
  }

  var hm = getHeaderMap_(sh);

  var colNumero            = hm["NUMERO_OFICIO"];
  var colEscola            = hm["ESCOLA"];
  var colEmailPrincipal    = hm["EMAIL_PRINCIPAL"];
  var colEmailsTodos       = hm["EMAILS_TODOS"];
  var colStatus            = hm["STATUS"];
  var colDataEnvio         = hm["DATA_ENVIO"];
  var colDataConfirmacao   = hm["DATA_CONFIRMACAO"];
  var colStatusRecebimento = hm["STATUS_RECEBIMENTO"];

  var obrigatorias = {
    NUMERO_OFICIO: colNumero,
    ESCOLA: colEscola,
    EMAIL_PRINCIPAL: colEmailPrincipal,
    EMAILS_TODOS: colEmailsTodos,
    STATUS: colStatus,
    DATA_ENVIO: colDataEnvio,
    DATA_CONFIRMACAO: colDataConfirmacao,
    STATUS_RECEBIMENTO: colStatusRecebimento
  };

  Object.keys(obrigatorias).forEach(function(nome) {
    if (!obrigatorias[nome]) {
      throw new Error("Coluna obrigatória não encontrada na fila: " + nome);
    }
  });

  var mapaControleConfirmado = {};

  try {
    var shControle = ss.getSheetByName(PLANILHA_REGISTRO);

    if (shControle && shControle.getLastRow() >= 2) {
      var hmControle = getHeaderMap_(shControle);
      var cNumeroControle = hmControle["Número do Ofício"];
      var cStatusControle = hmControle["Status"];

      if (cNumeroControle && cStatusControle) {
        var dadosControle = shControle
          .getRange(2, 1, shControle.getLastRow() - 1, shControle.getLastColumn())
          .getValues();

        dadosControle.forEach(function(linhaControle) {
          var numeroControle = String(linhaControle[cNumeroControle - 1] || "").trim();
          var statusControle = String(linhaControle[cStatusControle - 1] || "").trim().toUpperCase();

          if (numeroControle && statusControle === "CONFIRMADO") {
            mapaControleConfirmado[numeroControle] = true;
          }
        });
      }
    }
  } catch (eControle) {
    Logger.log("⚠ Erro ao ler confirmações do Controle: " + eControle.message);
  }

  var totalCols = sh.getLastColumn();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();

  var verificados = 0;
  var confirmados = 0;
  var sincronizadosControle = 0;

  dados.forEach(function(linha, idx) {
    var linhaPlanilha = idx + 2;

    var numero = String(linha[colNumero - 1] || "").trim();
    var escola = String(linha[colEscola - 1] || "").trim();
    var emailPrincipal = String(linha[colEmailPrincipal - 1] || "").trim();
    var emailsTodos = String(linha[colEmailsTodos - 1] || "").trim();
    var status = String(linha[colStatus - 1] || "").trim().toUpperCase();
    var statusReceb = String(linha[colStatusRecebimento - 1] || "").trim().toUpperCase();
    var dataEnvio = linha[colDataEnvio - 1];

    if (!numero) return;
    if (status !== "ENVIADO") return;
    if (statusReceb === "CONFIRMADO") return;

    var valoresLinha = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];

    if (mapaControleConfirmado[numero]) {
      valoresLinha[colStatusRecebimento - 1] = "CONFIRMADO";

      if (!valoresLinha[colDataConfirmacao - 1]) {
        valoresLinha[colDataConfirmacao - 1] = new Date();
      }

      sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);

      sincronizadosControle++;
      confirmados++;
      return;
    }

    verificados++;

    var dataFiltro = "";

    if (dataEnvio instanceof Date && !isNaN(dataEnvio.getTime())) {
      dataFiltro = " after:" + Utilities.formatDate(
        dataEnvio,
        Session.getScriptTimeZone(),
        "yyyy/MM/dd"
      );
    }

    var query =
      '(' +
      '"' + numero + '" OR ' +
      '"' + numero.replace("/", "-") + '" OR ' +
      '"' + escola + '"' +
      ')' +
      ' newer_than:30d' +
      dataFiltro +
      ' -from:financeiro@sindeducacao.com' +
      ' -from:secretaria@sindeducacao.com';

    var confirmado = false;

    try {
      var threads = GmailApp.search(query, 0, 10);

      for (var t = 0; t < threads.length; t++) {
        var msgs = threads[t].getMessages();

        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m];
          var from = String(msg.getFrom() || "").toLowerCase();
          var body = String(msg.getPlainBody() || "").toLowerCase();
          var subject = String(msg.getSubject() || "").toLowerCase();

          if (from.indexOf("financeiro@sindeducacao.com") > -1) continue;
          if (from.indexOf("secretaria@sindeducacao.com") > -1) continue;

          var texto = subject + " " + body;

          if (
            texto.indexOf("recebido") > -1 ||
            texto.indexOf("recebemos") > -1 ||
            texto.indexOf("confirmo") > -1 ||
            texto.indexOf("confirmamos") > -1 ||
            texto.indexOf("ciente") > -1 ||
            texto.indexOf("ok") > -1 ||
            texto.indexOf("acusamos") > -1 ||
            texto.indexOf("obrigado") > -1 ||
            texto.indexOf("obrigada") > -1
          ) {
            confirmado = true;
            break;
          }
        }

        if (confirmado) break;
      }

      if (confirmado) {
        valoresLinha[colStatusRecebimento - 1] = "CONFIRMADO";
        valoresLinha[colDataConfirmacao - 1] = new Date();

        sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);

        try {
          MON_OFICIOS_atualizarStatusNoControle_(ss, numero, "CONFIRMADO", "Confirmação localizada automaticamente no Gmail.");
          MON_OFICIOS_atualizarStatusNaFila_(ss, numero, "CONFIRMADO", "Confirmação localizada automaticamente no Gmail.");
        } catch (eStatus) {
          Logger.log("⚠ Não foi possível atualizar Controle: " + eStatus.message);
        }

        confirmados++;
      }

    } catch (e) {
      Logger.log("⚠ Erro ao verificar confirmação do ofício " + numero + ": " + e.message);
    }
  });

  SpreadsheetApp.flush();

  var retorno = {
    ok: true,
    mensagem: "Verificação concluída.",
    verificados: verificados,
    confirmados: confirmados,
    sincronizadosControle: sincronizadosControle
  };

  Logger.log(JSON.stringify(retorno, null, 2));
  return retorno;
}
/* ── Falhas de Entrega (Bounces) ── */

function instalarTriggerFalhasEntrega() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarFalhasEntregaOficios") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("verificarFalhasEntregaOficios").timeBased().everyHours(3).create();
  Logger.log("✅ Trigger de falhas de entrega instalado — executa a cada 3 horas.");
  return { ok: true, mensagem: "Trigger instalado com sucesso." };
}

function removerTriggerFalhasEntrega() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarFalhasEntregaOficios") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log("✅ Trigger de falhas de entrega removido.");
  return { ok: true, mensagem: "Trigger removido com sucesso." };
}

function verificarFalhasEntregaOficios() {
  try {
    var ss = MON_OFICIOS_getSS_();
    var shRegistro = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!shRegistro || shRegistro.getLastRow() < 2) return { ok: true, falhas: 0, mensagem: "Registro vazio." };

    var headerMap     = getHeaderMap_(shRegistro);
    var colStatus     = headerMap["Status"];
    var colNumero     = headerMap["Número do Ofício"];
    var colEmailTodos = headerMap["E-mails (todos)"] || headerMap["E-mail (principal)"];
    var colObs        = headerMap["Observações"];

    if (!colStatus || !colNumero || !colEmailTodos) {
      Logger.log("verificarFalhasEntregaOficios: colunas não encontradas.");
      return { ok: false, mensagem: "Colunas obrigatórias não encontradas." };
    }

    var dados = shRegistro.getRange(2, 1, shRegistro.getLastRow() - 1, shRegistro.getLastColumn()).getValues();
    var oficiosAtivos = [];

    for (var i = 0; i < dados.length; i++) {
      var status = MON_OFICIOS_normStatus_(dados[i][colStatus - 1]);
      if (status !== "ENVIADO" && status !== "PENDENTE") continue;

      var numero = String(dados[i][colNumero - 1] || "").trim();
      if (!numero) continue;

      var emails = MON_OFICIOS_normalizarEmails_(dados[i][colEmailTodos - 1]);
      if (!emails.length) continue;

      oficiosAtivos.push({ linhaReal: i + 2, numero: numero, emails: emails });
    }

    if (!oficiosAtivos.length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum ofício ativo para verificar.");
      return { ok: true, falhas: 0, mensagem: "Nenhum ofício ativo para verificar." };
    }

    var queryBounce = [
      "subject:(\"delivery failed\")",
      "subject:(\"delivery status notification\")",
      "subject:(\"undeliverable\")",
      "subject:(\"mail delivery failed\")",
      "subject:(\"falha na entrega\")",
      "subject:(\"returned mail\")",
      "subject:(\"failure notice\")"
    ].join(" OR ");

    var threads = [];
    try {
      threads = GmailApp.search("(" + queryBounce + ") newer_than:90d", 0, 50);
    } catch (eSearch) {
      Logger.log("⚠ Erro ao buscar bounces: " + eSearch.message);
      return { ok: false, mensagem: eSearch.message };
    }

    if (!threads.length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum bounce encontrado.");
      return { ok: true, falhas: 0, mensagem: "Nenhum bounce encontrado." };
    }

    var emailsComBounce = {};
    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(msg) {
        var corpo = (msg.getPlainBody() || "") + " " + (msg.getBody() || "");
        (corpo.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach(function(email) {
          var n = String(email || "").trim().toLowerCase();
          if (!n || n.indexOf("sindeducacao.com") > -1) return;
          emailsComBounce[n] = true;
        });
      });
    });

    if (!Object.keys(emailsComBounce).length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum e-mail de bounce extraído.");
      return { ok: true, falhas: 0, mensagem: "Nenhum e-mail de bounce extraído." };
    }

    var totalFalhas = 0;
    var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    oficiosAtivos.forEach(function(item) {
      var teveBounce = item.emails.some(function(e) { return emailsComBounce[e] === true; });
      if (!teveBounce) return;

      shRegistro.getRange(item.linhaReal, colStatus).setValue("FALHA_ENTREGA");

      if (colObs) {
        var obsAtual = String(shRegistro.getRange(item.linhaReal, colObs).getValue() || "").trim();
        var novaObs = obsAtual
          ? obsAtual + " | Bounce detectado automaticamente em " + agora
          : "Bounce detectado automaticamente em " + agora;
        shRegistro.getRange(item.linhaReal, colObs).setValue(novaObs);
      }

      MON_OFICIOS_atualizarStatusNaFila_(ss, item.numero, "FALHA_ENTREGA", "Bounce detectado automaticamente em " + agora);

      registrarLogSistema({
        usuario: "sistema",
        numero: item.numero + " (FALHA_ENTREGA)",
        tipo: "Bounce",
        escola: item.emails.join(", "),
        cnpj: "",
        email: item.emails.join(", "),
        codigo: ""
      });

      Logger.log("❌ Bounce — Ofício " + item.numero + " · " + item.emails.join(", "));
      totalFalhas++;
    });

    if (totalFalhas > 0) notificarFalhasEntregaOficios_(totalFalhas);
    return { ok: true, falhas: totalFalhas, mensagem: totalFalhas + " falha(s) registrada(s)." };

  } catch (e) {
    Logger.log("❌ Erro em verificarFalhasEntregaOficios: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function notificarFalhasEntregaOficios_(totalFalhas) {
  try {
    var htmlBody = "<div style='font-family:Arial,sans-serif;padding:20px;max-width:600px;'>" +
      "<div style='background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:16px 20px;margin-bottom:16px;'>" +
      "<strong style='color:#991b1b;font-size:15px;'>⚠️ Falhas de entrega detectadas</strong>" +
      "<p style='margin:8px 0 0;font-size:13px;color:#7f1d1d;'>" + totalFalhas + " ofício(s) com bounce. Acesse o painel SISGEP para verificar.</p></div>" +
      "<p style='font-size:13px;color:#334155;'>Este e-mail foi gerado automaticamente pelo SISGEP.</p></div>";

    GmailApp.sendEmail(
      "financeiro@sindeducacao.com",
      "⚠️ SISGEP — " + totalFalhas + " ofício(s) com falha de entrega",
      "Falhas de entrega detectadas. Acesse o painel SISGEP.",
      { htmlBody: htmlBody, name: "SISGEP — Alerta Automático" }
    );
  } catch (e) {
    Logger.log("⚠ Erro ao notificar falhas: " + e.message);
  }
}

/* ── Painel de Status ── */

function _resumoStatusVazio_() {
  return { total: 0, confirmados: 0, enviados: 0, pendentes: 0, falhas: 0, erros: 0 };
}

function listarStatusOficios(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    filtros = filtros || {};

    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    var ss = MON_OFICIOS_getSS_();
    var itensControle = MON_OFICIOS_listarStatusControle_(ss);
    var itensFila     = MON_OFICIOS_listarStatusFila_(ss);

    var mapa = {};
    itensControle.concat(itensFila).forEach(function(item) {
      var chave = String(item.numero || "").trim() || (String(item.escola || "") + "::" + String(item.data || ""));
      if (!chave) return;

      if (!mapa[chave]) {
        mapa[chave] = item;
        return;
      }

      // Prioriza status mais recente/relevante sem descartar dados do Controle.
      mapa[chave] = MON_OFICIOS_mesclarItemStatus_(mapa[chave], item);
    });

    var itens = Object.keys(mapa).map(function(k) { return mapa[k]; });
    var resumo = MON_OFICIOS_resumirItens_(itens);

    itens = MON_OFICIOS_aplicarFiltrosStatus_(itens, filtros);
    itens.sort(MON_OFICIOS_ordenarStatus_);

    return { erro: false, itens: itens, resumo: resumo };

  } catch (e) {
    Logger.log("❌ Erro em listarStatusOficios: " + e.message);
    return { erro: true, mensagem: e.message, itens: [], resumo: _resumoStatusVazio_() };
  }
}

function atualizarStatusOficio(numero, novoStatus, observacao, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    novoStatus = MON_OFICIOS_normStatus_(novoStatus);
    var statusPermitidos = ["CONFIRMADO", "FALHA_ENTREGA", "ENVIADO", "PENDENTE", "ERRO", "ERRO_PERMANENTE", "PROCESSANDO"];
    if (statusPermitidos.indexOf(novoStatus) === -1) throw new Error("Status inválido: " + novoStatus);

    var ss = MON_OFICIOS_getSS_();
    var alvo = String(numero || "").trim();
    if (!alvo) throw new Error("Número do ofício não informado.");

    var atualizouControle = MON_OFICIOS_atualizarStatusNoControle_(ss, alvo, novoStatus, observacao);
    var atualizouFila     = MON_OFICIOS_atualizarStatusNaFila_(ss, alvo, novoStatus, observacao);

    if (atualizouControle || atualizouFila) {
      registrarLogSistema({
        usuario: emailUsuario,
        numero: alvo + " (STATUS → " + novoStatus + ")",
        tipo: "",
        escola: "",
        cnpj: "",
        email: "",
        codigo: ""
      });

      return { erro: false, mensagem: "Status atualizado para " + novoStatus + "." };
    }

    return { erro: true, mensagem: "Ofício " + alvo + " não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: e.message };
  }
}

/* ============================================================================
   HELPERS PRIVADOS DO MONITORAMENTO
============================================================================ */

function MON_OFICIOS_getSS_() {
  return SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
}

function MON_OFICIOS_normStatus_(v) {
  return String(v || "").trim().toUpperCase();
}

function MON_OFICIOS_normalizarEmails_(valor) {
  return String(valor || "")
    .split(/[\n,;]+/)
    .map(function(e) { return String(e || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(e, i, arr) { return arr.indexOf(e) === i; });
}

function MON_OFICIOS_formatarData_(v) {
  if (!v) return "";
  try {
    if (typeof formatarDataHoraBR_ === "function") return formatarDataHoraBR_(v);
    return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  } catch (e) {
    return String(v || "");
  }
}

function MON_OFICIOS_diasSemResposta_(dataVal) {
  if (!dataVal) return null;
  var d = dataVal instanceof Date ? dataVal : new Date(dataVal);
  if (isNaN(d.getTime())) return null;
  return Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function MON_OFICIOS_listarStatusControle_(ss) {
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["Status"];
  var cNumero = hm["Número do Ofício"];
  var cTipo   = hm["TIPO"] || hm["Tipo"];
  var cEscola = hm["Escola (Razão Social)"] || hm["NomeEscola"] || hm["Escola"];
  var cEmail  = hm["E-mails (todos)"] || hm["E-mail (principal)"] || hm["EmailsTodos"] || hm["Email"];
  var cData   = hm["Data envio ofício"] || hm["DATA_CRIACAO"];
  var cObs    = hm["Observações"] || hm["OBSERVACOES"];
  var cLink   = hm["Link PDF (Drive)"] || hm["LINK_PDF"];

  if (!cStatus || !cNumero) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  dados.forEach(function(row) {
    var numero = String(row[cNumero - 1] || "").trim();
    if (!numero) return;

    var status = MON_OFICIOS_normStatus_(row[cStatus - 1]) || "PENDENTE";
    var tipoRaw = cTipo ? String(row[cTipo - 1] || "").trim() : "";
    var dataVal = cData ? row[cData - 1] : null;

    itens.push({
      origem: "Controle",
      numero: numero,
      status: status,
      tipo: typeof obterLabelTipoOficio_ === "function" ? obterLabelTipoOficio_(tipoRaw) : tipoRaw,
      tipoRaw: tipoRaw,
      escola: cEscola ? String(row[cEscola - 1] || "").trim() : "",
      email: cEmail ? String(row[cEmail - 1] || "").trim() : "",
      data: MON_OFICIOS_formatarData_(dataVal),
      obs: cObs ? String(row[cObs - 1] || "").trim() : "",
      link: cLink ? String(row[cLink - 1] || "").trim() : "",
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal)
    });
  });

  return itens;
}

function MON_OFICIOS_listarStatusFila_(ss) {
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cTipo   = hm["TIPO"];
  var cEscola = hm["ESCOLA"];
  var cEmail  = hm["EMAILS_TODOS"] || hm["EMAIL_PRINCIPAL"];
  var cData   = hm["DATA_CRIACAO"];
  var cErro   = hm["ULTIMO_ERRO"];
  var cAnexos = hm["ANEXOS_JSON"];

  if (!cStatus || !cNumero) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  dados.forEach(function(row) {
    var numero = String(row[cNumero - 1] || "").trim();
    if (!numero) return;

    var status = MON_OFICIOS_normStatus_(row[cStatus - 1]) || "PENDENTE";
    if (status === "ERRO_PERMANENTE") status = "ERRO";

    var tipoRaw = cTipo ? String(row[cTipo - 1] || "").trim() : "";
    var dataVal = cData ? row[cData - 1] : null;

    itens.push({
      origem: "Fila",
      numero: numero,
      status: status,
      tipo: typeof obterLabelTipoOficio_ === "function" ? obterLabelTipoOficio_(tipoRaw) : tipoRaw,
      tipoRaw: tipoRaw,
      escola: cEscola ? String(row[cEscola - 1] || "").trim() : "",
      email: cEmail ? String(row[cEmail - 1] || "").trim() : "",
      data: MON_OFICIOS_formatarData_(dataVal),
      obs: cErro ? String(row[cErro - 1] || "").trim() : "",
      link: cAnexos ? MON_OFICIOS_extrairLinkPdf_(row[cAnexos - 1]) : "",
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal)
    });
  });

  return itens;
}

function MON_OFICIOS_mesclarItemStatus_(a, b) {
  var prioridade = { FALHA_ENTREGA: 0, ERRO: 1, PENDENTE: 2, PROCESSANDO: 3, ENVIADO: 4, CONFIRMADO: 5 };
  var pa = prioridade[a.status] !== undefined ? prioridade[a.status] : 9;
  var pb = prioridade[b.status] !== undefined ? prioridade[b.status] : 9;

  // Menor prioridade numérica = mais crítico. Mantém o mais crítico, mas completa campos vazios.
  var base = pb < pa ? b : a;
  var extra = pb < pa ? a : b;

  Object.keys(extra).forEach(function(k) {
    if ((base[k] === "" || base[k] === null || base[k] === undefined) && extra[k]) base[k] = extra[k];
  });

  base.origem = base.origem === extra.origem ? base.origem : "Controle/Fila";
  return base;
}

function MON_OFICIOS_resumirItens_(itens) {
  var resumo = _resumoStatusVazio_();
  (itens || []).forEach(function(i) {
    var s = MON_OFICIOS_normStatus_(i.status);
    if (!s) return;
    resumo.total++;
    if      (s === "CONFIRMADO")    resumo.confirmados++;
    else if (s === "ENVIADO")       resumo.enviados++;
    else if (s === "PENDENTE" || s === "PROCESSANDO") resumo.pendentes++;
    else if (s === "FALHA_ENTREGA") resumo.falhas++;
    else if (s === "ERRO" || s === "ERRO_PERMANENTE") resumo.erros++;
  });
  return resumo;
}

function MON_OFICIOS_aplicarFiltrosStatus_(itens, filtros) {
  filtros = filtros || {};
  var statusFiltro = MON_OFICIOS_normStatus_(filtros.status);
  var tipoFiltro = String(filtros.tipo || "").trim().toLowerCase();
  var escolaFiltro = String(filtros.escola || "").trim().toLowerCase();
  var numeroFiltro = String(filtros.numero || "").trim().toLowerCase();

  return (itens || []).filter(function(i) {
    if (statusFiltro && MON_OFICIOS_normStatus_(i.status) !== statusFiltro) return false;
    if (tipoFiltro && String(i.tipoRaw || i.tipo || "").toLowerCase().indexOf(tipoFiltro) === -1) return false;
    if (escolaFiltro && String(i.escola || "").toLowerCase().indexOf(escolaFiltro) === -1) return false;
    if (numeroFiltro && String(i.numero || "").toLowerCase().indexOf(numeroFiltro) === -1) return false;
    return true;
  });
}

function MON_OFICIOS_ordenarStatus_(a, b) {
  var p = { FALHA_ENTREGA: 0, ERRO: 1, PENDENTE: 2, PROCESSANDO: 3, ENVIADO: 4, CONFIRMADO: 5 };
  var pa = p[a.status] !== undefined ? p[a.status] : 9;
  var pb = p[b.status] !== undefined ? p[b.status] : 9;
  if (pa !== pb) return pa - pb;
  return (b.diasSemResposta || 0) - (a.diasSemResposta || 0);
}

function MON_OFICIOS_atualizarStatusNoControle_(ss, numero, novoStatus, observacao) {
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) return false;

  var hm = getHeaderMap_(sh);
  var cStatus = hm["Status"];
  var cNumero = hm["Número do Ofício"];
  var cObs    = hm["Observações"];
  if (!cStatus || !cNumero) return false;

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var atualizou = false;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][cNumero - 1] || "").trim() !== String(numero || "").trim()) continue;

    sh.getRange(i + 2, cStatus).setValue(novoStatus);

    if (cObs && observacao) {
      var obsAtual = String(sh.getRange(i + 2, cObs).getValue() || "").trim();
      var registro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      var novaObs = obsAtual
        ? obsAtual + " | " + novoStatus + " em " + registro + ": " + observacao
        : novoStatus + " em " + registro + ": " + observacao;
      sh.getRange(i + 2, cObs).setValue(novaObs);
    }

    atualizou = true;
  }

  return atualizou;
}

function MON_OFICIOS_atualizarStatusNaFila_(ss, numero, novoStatus, observacao) {
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return false;

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cErro   = hm["ULTIMO_ERRO"];
  var cData   = hm["DATA_ULTIMA_TENTATIVA"];
  if (!cStatus || !cNumero) return false;

  var totalCols = sh.getLastColumn();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();
  var atualizou = false;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][cNumero - 1] || "").trim() !== String(numero || "").trim()) continue;

    var row = dados[i].slice();
    row[cStatus - 1] = novoStatus;
    if (cErro && observacao) row[cErro - 1] = String(observacao || "").trim();
    if (cData) row[cData - 1] = new Date();
    sh.getRange(i + 2, 1, 1, totalCols).setValues([row]);
    atualizou = true;
  }

  return atualizou;
}

function MON_OFICIOS_extrairLinkPdf_(anexosJson) {
  try {
    var anexos = JSON.parse(String(anexosJson || "[]"));
    var pdf = null;
    for (var i = 0; i < anexos.length; i++) {
      if (String(anexos[i].mimeType || "").indexOf("pdf") > -1) {
        pdf = anexos[i];
        break;
      }
    }
    if (!pdf && anexos.length) pdf = anexos[0];
    if (pdf && pdf.fileId) return "https://drive.google.com/file/d/" + pdf.fileId + "/view";
  } catch (e) {}
  return "";
}
