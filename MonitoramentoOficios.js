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
            texto.indexOf("acusamos o recebimento") > -1 ||
            texto.indexOf("acuso o recebimento") > -1
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
    var colDataEnvio  = headerMap["Data envio ofício"];

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

      oficiosAtivos.push({
        linhaReal: i + 2,
        numero: numero,
        emails: emails,
        dataEnvio: colDataEnvio ? dados[i][colDataEnvio - 1] : null
      });
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

    // Guarda a data do bounce mais recente por endereço. Sem isso, a mensagem de
    // devolução antiga continua no Gmail dentro da janela de 90 dias e reabre a
    // falha a cada rodada, mesmo depois de um reenvio bem-sucedido.
    var emailsComBounce = {};
    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(msg) {
        var dataMsg = msg.getDate();
        var corpo = (msg.getPlainBody() || "") + " " + (msg.getBody() || "");
        (corpo.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach(function(email) {
          var n = String(email || "").trim().toLowerCase();
          if (!n || n.indexOf("sindeducacao.com") > -1) return;
          if (!emailsComBounce[n] || dataMsg > emailsComBounce[n]) emailsComBounce[n] = dataMsg;
        });
      });
    });

    if (!Object.keys(emailsComBounce).length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum e-mail de bounce extraído.");
      return { ok: true, falhas: 0, mensagem: "Nenhum e-mail de bounce extraído." };
    }

    var totalFalhas = 0;
    var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    var dataEnvioFila = MON_OFICIOS_mapaDataEnvioFila_(ss);

    oficiosAtivos.forEach(function(item) {
      var bounceMaisRecente = null;
      item.emails.forEach(function(e) {
        var d = emailsComBounce[e];
        if (d && (!bounceMaisRecente || d > bounceMaisRecente)) bounceMaisRecente = d;
      });
      if (!bounceMaisRecente) return;

      // A devolução anterior ao último envio se refere a uma tentativa já superada
      // — tipicamente um reenvio depois de corrigir o cadastro. Sem data confiável
      // dos dois lados, mantém o comportamento antigo e marca a falha.
      var ultimoEnvio = MON_OFICIOS_dataMaisRecente_(dataEnvioFila[item.numero], item.dataEnvio);
      if (ultimoEnvio && bounceMaisRecente <= ultimoEnvio) {
        Logger.log("↩ Ofício " + item.numero + ": devolução de " +
          MON_OFICIOS_formatarData_(bounceMaisRecente) + " é anterior ao envio de " +
          MON_OFICIOS_formatarData_(ultimoEnvio) + ". Ignorada.");
        return;
      }

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
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
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
    itens.forEach(function(item) {
      MON_OFICIOS_definirAcoesEnvio_(item);
      MON_OFICIOS_limparCamposInternos_(item);
    });
    var resumo = MON_OFICIOS_resumirItens_(itens);

    itens = MON_OFICIOS_aplicarFiltrosStatus_(itens, filtros);
    itens.sort(MON_OFICIOS_ordenarStatus_);

    // Paginação opcional (achado #9) — resumo continua batendo com o total
    // real (calculado acima, antes de filtrar/paginar); só a lista de itens
    // é fatiada, e só se filtros.porPagina for enviado.
    var pag = paginarItens_(itens, filtros);
    return {
      erro: false, itens: pag.itens, resumo: resumo,
      total: pag.total, pagina: pag.pagina, porPagina: pag.porPagina, totalPaginas: pag.totalPaginas
    };

  } catch (e) {
    Logger.log("❌ Erro em listarStatusOficios: " + e.message);
    return { erro: true, mensagem: e.message, itens: [], resumo: _resumoStatusVazio_() };
  }
}

function atualizarStatusOficio(numero, novoStatus, observacao, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
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

/**
 * Diagnóstico read-only: para cada ofício que o painel mostra como Pendente,
 * diz se ele existe na fila de envio e em que estado. Responde à pergunta
 * "os pendentes já saíram ou ainda estão para sair?".
 *
 * Não altera nada. Pode ser executada direto no editor do Apps Script,
 * sem sessão web — o resultado sai no registro de execução.
 */
function diagnosticarPendentesOficios() {
  var ss = MON_OFICIOS_getSS_();
  var linhas = [];

  function log(txt) { linhas.push(txt); }

  /* ── Estado atual da fila de envio ── */
  var statusFila = {};
  var distFila = {};
  var shFila = ss.getSheetByName("FILA_ENVIO_OFICIOS");

  if (shFila && shFila.getLastRow() > 1) {
    var hmF    = getHeaderMap_(shFila);
    var cNumF  = hmF["NUMERO_OFICIO"];
    var cStF   = hmF["STATUS"];
    if (!cNumF || !cStF) throw new Error("Colunas NUMERO_OFICIO/STATUS não encontradas na fila.");

    shFila.getRange(2, 1, shFila.getLastRow() - 1, shFila.getLastColumn()).getValues().forEach(function(row) {
      var num = String(row[cNumF - 1] || "").trim();
      if (!num) return;
      var st = MON_OFICIOS_normStatus_(row[cStF - 1]) || "(vazio)";
      statusFila[num] = st;
      distFila[st] = (distFila[st] || 0) + 1;
    });
  }

  log("FILA_ENVIO_OFICIOS — " + Object.keys(statusFila).length + " ofício(s):");
  Object.keys(distFila).sort().forEach(function(st) { log("   " + st + ": " + distFila[st]); });

  /* ── Pendentes do Controle, confrontados com a fila ── */
  var shReg = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!shReg || shReg.getLastRow() < 2) {
    log("Aba de Controle vazia ou não encontrada.");
    Logger.log(linhas.join("\n"));
    return { ok: true, relatorio: linhas };
  }

  var hmR   = getHeaderMap_(shReg);
  var cNumR = hmR["Número do Ofício"];
  var cStR  = hmR["Status"];
  var cEscR = hmR["Escola (Razão Social)"] || hmR["NomeEscola"] || hmR["Escola"];
  var cDtR  = hmR["Data envio ofício"] || hmR["DATA_CRIACAO"];
  if (!cNumR || !cStR) throw new Error("Colunas Número do Ofício/Status não encontradas no Controle.");

  var grupos = { jaEnviado: [], aguardandoFila: [], travado: [], semFila: [] };

  shReg.getRange(2, 1, shReg.getLastRow() - 1, shReg.getLastColumn()).getValues().forEach(function(row) {
    var num = String(row[cNumR - 1] || "").trim();
    if (!num) return;

    // Mesma regra do painel: Status em branco conta como PENDENTE.
    var st = MON_OFICIOS_normStatus_(row[cStR - 1]) || "PENDENTE";
    if (st !== "PENDENTE" && st !== "PROCESSANDO") return;

    var stFila = statusFila[num];
    var desc = num
      + " | " + (cEscR ? String(row[cEscR - 1] || "").substring(0, 34) : "")
      + " | " + (cDtR ? MON_OFICIOS_formatarData_(row[cDtR - 1]) : "");

    if (!stFila)                                              grupos.semFila.push(desc);
    else if (stFila === "ENVIADO" || stFila === "CONFIRMADO")  grupos.jaEnviado.push(desc + " | fila: " + stFila);
    else if (stFila === "PENDENTE" || stFila === "ERRO")       grupos.aguardandoFila.push(desc + " | fila: " + stFila);
    else                                                       grupos.travado.push(desc + " | fila: " + stFila);
  });

  function bloco(titulo, itens, explicacao) {
    log("");
    log(titulo + ": " + itens.length);
    if (itens.length) log("   → " + explicacao);
    itens.slice(0, 40).forEach(function(t) { log("   " + t); });
    if (itens.length > 40) log("   ... e mais " + (itens.length - 40) + ".");
  }

  var total = grupos.jaEnviado.length + grupos.aguardandoFila.length + grupos.travado.length + grupos.semFila.length;
  log("");
  log("PENDENTES NO CONTROLE: " + total);

  bloco("JÁ ENVIADOS", grupos.jaEnviado,
    "O e-mail saiu pela fila. É o Status do Controle que está desatualizado.");
  bloco("AGUARDANDO NA FILA", grupos.aguardandoFila,
    "Ainda vão sair sozinhos: o gatilho processa 5 a cada 5 minutos.");
  bloco("PRESOS EM PROCESSAMENTO", grupos.travado,
    "Rode destravarOficiosProcessandoTravados() para devolvê-los à fila.");
  bloco("SEM LINHA NA FILA", grupos.semFila,
    "Nunca foram enfileirados: não existe e-mail montado para disparar. Precisam ser reemitidos ou ter o status corrigido.");

  Logger.log(linhas.join("\n"));
  return { ok: true, relatorio: linhas };
}

/**
 * Corrige no Controle o Status dos ofícios que a fila já enviou.
 *
 * Só toca em linha que está PENDENTE, vazia ou PROCESSANDO no Controle e que
 * a fila dá como ENVIADO ou CONFIRMADO — nunca sobrescreve status decidido por
 * alguém. Grava célula a célula: a sincronização antiga reescrevia a aba
 * inteira, o que achata qualquer fórmula do Controle no valor calculado.
 *
 * Comece por simularSincronizacaoPendentes(), que não altera nada.
 */
function sincronizarStatusPendentesEnviados(aplicar) {
  var aplicando = (aplicar === true);
  var ss = MON_OFICIOS_getSS_();
  var linhas = [];
  function log(t) { linhas.push(t); }

  var shFila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!shFila || shFila.getLastRow() < 2) throw new Error("Fila de envio vazia ou não encontrada.");

  var hmF   = getHeaderMap_(shFila);
  var cNumF = hmF["NUMERO_OFICIO"];
  var cStF  = hmF["STATUS"];
  if (!cNumF || !cStF) throw new Error("Colunas NUMERO_OFICIO/STATUS não encontradas na fila.");

  var statusFila = {};
  shFila.getRange(2, 1, shFila.getLastRow() - 1, shFila.getLastColumn()).getValues().forEach(function(row) {
    var num = String(row[cNumF - 1] || "").trim();
    if (!num) return;
    var st = MON_OFICIOS_normStatus_(row[cStF - 1]);
    if (st === "ENVIADO" || st === "CONFIRMADO") statusFila[num] = st;
  });

  var shReg = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!shReg || shReg.getLastRow() < 2) throw new Error("Aba de Controle vazia ou não encontrada.");

  var hmR   = getHeaderMap_(shReg);
  var cNumR = hmR["Número do Ofício"];
  var cStR  = hmR["Status"];
  if (!cNumR || !cStR) throw new Error("Colunas Número do Ofício/Status não encontradas no Controle.");

  var totalLinhas = shReg.getLastRow() - 1;
  var numeros = shReg.getRange(2, cNumR, totalLinhas, 1).getValues();
  var status  = shReg.getRange(2, cStR,  totalLinhas, 1).getValues();
  var correcoes = [];

  for (var i = 0; i < totalLinhas; i++) {
    var num = String(numeros[i][0] || "").trim();
    if (!num) continue;

    var stAtual = MON_OFICIOS_normStatus_(status[i][0]);
    if (stAtual && stAtual !== "PENDENTE" && stAtual !== "PROCESSANDO") continue;

    var stFila = statusFila[num];
    if (!stFila) continue;

    correcoes.push({ linha: i + 2, numero: num, de: stAtual || "(vazio)", para: stFila });
  }

  log((aplicando ? "APLICANDO" : "SIMULAÇÃO — nada foi alterado") + ".");
  log("Ofícios a corrigir no Controle: " + correcoes.length);
  correcoes.slice(0, 60).forEach(function(c) {
    log("   linha " + c.linha + " | " + c.numero + " | " + c.de + " → " + c.para);
  });
  if (correcoes.length > 60) log("   ... e mais " + (correcoes.length - 60) + ".");

  if (!aplicando) {
    log("");
    log("Para gravar, execute aplicarSincronizacaoPendentes().");
    Logger.log(linhas.join("\n"));
    return { ok: true, aplicado: false, total: correcoes.length, correcoes: correcoes };
  }

  correcoes.forEach(function(c) { shReg.getRange(c.linha, cStR).setValue(c.para); });
  SpreadsheetApp.flush();

  try {
    registrarLogSistema({
      usuario: "sistema",
      numero: correcoes.length + " ofício(s) (SINCRONIZACAO STATUS CONTROLE)",
      tipo: "", escola: "", cnpj: "", email: "", codigo: ""
    });
  } catch (eLog) {
    Logger.log("⚠ Falha ao registrar log da sincronização: " + eLog.message);
  }

  log("");
  log("✅ " + correcoes.length + " status corrigido(s) no Controle.");
  Logger.log(linhas.join("\n"));
  return { ok: true, aplicado: true, total: correcoes.length, correcoes: correcoes };
}

function simularSincronizacaoPendentes() { return sincronizarStatusPendentesEnviados(false); }
function aplicarSincronizacaoPendentes() { return sincronizarStatusPendentesEnviados(true); }

/**
 * Tudo o que o card da escola precisa saber antes de emitir, numa consulta só:
 * histórico de ofícios, endereços que já recusaram entrega, e se já existe
 * ofício do mesmo tipo no período.
 *
 * A varredura do Controle é uma só — quatro chamadas separadas custariam
 * quatro leituras da mesma aba de ~1.000 linhas.
 */
function obterAvisosEscolaOficio(cnpj, tipo, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var vazio = { ok: true, enviados: 0, confirmados: 0, ultimo: "", emailsComFalha: [], duplicata: null };
  var alvo = String(cnpj || "").replace(/\D/g, "");
  if (!alvo) return vazio;

  var ss = MON_OFICIOS_getSS_();
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) return vazio;

  var hm      = getHeaderMap_(sh);
  var cCnpj   = hm["CNPJ"];
  var cStatus = hm["Status"];
  var cNumero = hm["Número do Ofício"];
  var cTipo   = hm["TIPO"] || hm["Tipo"];
  var cData   = hm["Data envio ofício"];
  var cEmails = hm["E-mails (todos)"] || hm["E-mail (principal)"];
  if (!cCnpj || !cStatus) return vazio;

  var tipoAlvo = MON_OFICIOS_normStatus_(tipo);
  var agora    = new Date();
  var res      = { ok: true, enviados: 0, confirmados: 0, ultimo: "", emailsComFalha: [], duplicata: null };
  var falhas      = {};
  var confirmados = {};
  var maisRecente = null;

  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function(row) {
    if (String(row[cCnpj - 1] || "").replace(/\D/g, "") !== alvo) return;

    var status = MON_OFICIOS_normStatus_(row[cStatus - 1]);
    var data   = cData ? MON_OFICIOS_paraData_(row[cData - 1]) : null;

    if (status === "ENVIADO" || status === "CONFIRMADO" || status === "FALHA_ENTREGA") res.enviados++;
    if (status === "CONFIRMADO") res.confirmados++;
    if (data && (!maisRecente || data > maisRecente)) maisRecente = data;

    // Endereços que recusaram: é o que evita repetir o erro no próximo envio.
    // O bounce é registrado no ofício, não no endereço — se a mensagem foi para
    // três pessoas e voltou, não dá para saber qual recusou. Por isso a certeza
    // é alta só quando havia um único destinatário.
    if (cEmails) {
      var lista = MON_OFICIOS_normalizarEmails_(row[cEmails - 1]);

      if (status === "CONFIRMADO") {
        lista.forEach(function(em) { confirmados[em] = true; });
      } else if (status === "FALHA_ENTREGA") {
        lista.forEach(function(em) {
          var anterior = falhas[em];
          if (!anterior || (data && anterior.data && data > anterior.data) || (data && !anterior.data)) {
            falhas[em] = { data: data || (anterior && anterior.data) || null, sozinho: lista.length === 1 };
          } else if (anterior && lista.length === 1) {
            anterior.sozinho = true;
          }
        });
      }
    }

    // Mesmo tipo, mesmo mês: aviso antes de o operador preencher o resto.
    if (tipoAlvo && data && MON_OFICIOS_normStatus_(cTipo ? row[cTipo - 1] : "") === tipoAlvo
        && data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear()
        && status !== "ERRO" && status !== "ERRO_PERMANENTE") {
      res.duplicata = {
        numero: cNumero ? String(row[cNumero - 1] || "").trim() : "",
        data: MON_OFICIOS_formatarData_(row[cData - 1])
      };
    }
  });

  res.ultimo = maisRecente ? MON_OFICIOS_formatarData_(maisRecente) : "";
  /* Quem já confirmou recebimento não é o endereço quebrado: sai da lista.
     Sem isto, um envio com três destinatários marcaria os três. */
  res.emailsComFalha = Object.keys(falhas)
    .filter(function(em) { return !confirmados[em]; })
    .map(function(em) {
      return {
        email: em,
        data: falhas[em].data ? MON_OFICIOS_formatarData_(falhas[em].data) : "",
        certeza: falhas[em].sozinho ? "alta" : "baixa"
      };
    });

  return res;
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

/** Converte para Date apenas o que é data de verdade. */
function MON_OFICIOS_paraData_(v) {
  if (!v) return null;
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function MON_OFICIOS_dataMaisRecente_(a, b) {
  var da = MON_OFICIOS_paraData_(a);
  var db = MON_OFICIOS_paraData_(b);
  if (!da) return db;
  if (!db) return da;
  return da > db ? da : db;
}

/** Número do ofício → data do último envio registrado na fila. */
function MON_OFICIOS_mapaDataEnvioFila_(ss) {
  var mapa = {};
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return mapa;

  var hm      = getHeaderMap_(sh);
  var cNumero = hm["NUMERO_OFICIO"];
  var cEnvio  = hm["DATA_ENVIO"];
  if (!cNumero || !cEnvio) return mapa;

  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function(row) {
    var num = String(row[cNumero - 1] || "").trim();
    if (!num) return;
    mapa[num] = MON_OFICIOS_dataMaisRecente_(mapa[num], row[cEnvio - 1]);
  });

  return mapa;
}

/**
 * Fecha o ciclo do reenvio: tira o ofício de FALHA_ENTREGA e passa a data de
 * envio para agora, nos dois lados. Sem isso o painel continua mostrando falha
 * mesmo depois de a mensagem sair, e o detector de bounce reabre a falha usando
 * a devolução antiga.
 */
function MON_OFICIOS_registrarReenvio_(ss, numero, usuario) {
  var quando = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  var nota = "Reenviado em " + quando + (usuario ? " por " + usuario : "") + ".";

  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (sh && sh.getLastRow() > 1) {
    var hm      = getHeaderMap_(sh);
    var cStatus = hm["Status"];
    var cNumero = hm["Número do Ofício"];
    var cObs    = hm["Observações"];
    var cData   = hm["Data envio ofício"];

    if (cStatus && cNumero) {
      var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][cNumero - 1] || "").trim() !== String(numero || "").trim()) continue;

        // Nunca rebaixa um CONFIRMADO: quem confirmou o recebimento decidiu antes.
        var stAtual = MON_OFICIOS_normStatus_(dados[i][cStatus - 1]);
        if (stAtual !== "CONFIRMADO") sh.getRange(i + 2, cStatus).setValue("ENVIADO");
        if (cData) sh.getRange(i + 2, cData).setValue(new Date());

        if (cObs) {
          var obsAtual = String(dados[i][cObs - 1] || "").trim();
          sh.getRange(i + 2, cObs).setValue(obsAtual ? obsAtual + " | " + nota : nota);
        }
        break;
      }
    }
  }

  var shFila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (shFila && shFila.getLastRow() > 1) {
    var hmF     = getHeaderMap_(shFila);
    var cNumF   = hmF["NUMERO_OFICIO"];
    var cStF    = hmF["STATUS"];
    var cEnvioF = hmF["DATA_ENVIO"];

    if (cNumF && cStF) {
      var dadosF = shFila.getRange(2, cNumF, shFila.getLastRow() - 1, 1).getValues();
      for (var j = 0; j < dadosF.length; j++) {
        if (String(dadosF[j][0] || "").trim() !== String(numero || "").trim()) continue;
        shFila.getRange(j + 2, cStF).setValue("ENVIADO");
        if (cEnvioF) shFila.getRange(j + 2, cEnvioF).setValue(new Date());
        break;
      }
    }
  }

  SpreadsheetApp.flush();
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
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal),
      naFila: false,
      statusFila: "",
      tentativas: 0,
      dataUltimaTentativa: null
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
  var cTent   = hm["TENTATIVAS"];
  var cDataTent = hm["DATA_ULTIMA_TENTATIVA"];

  if (!cStatus || !cNumero) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  dados.forEach(function(row) {
    var numero = String(row[cNumero - 1] || "").trim();
    if (!numero) return;

    var statusFila = MON_OFICIOS_normStatus_(row[cStatus - 1]) || "PENDENTE";
    var status = statusFila === "ERRO_PERMANENTE" ? "ERRO" : statusFila;

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
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal),
      naFila: true,
      statusFila: statusFila,
      tentativas: cTent ? (parseInt(row[cTent - 1], 10) || 0) : 0,
      dataUltimaTentativa: cDataTent ? row[cDataTent - 1] : null
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

  // O laço acima só preenche campo vazio, e `false`/`0` não contam como vazio.
  // Estes campos vêm da fila e decidem se ainda dá para enviar — mescla explícita.
  base.naFila = !!(a.naFila || b.naFila);
  base.statusFila = a.statusFila || b.statusFila || "";
  base.tentativas = Math.max(Number(a.tentativas) || 0, Number(b.tentativas) || 0);
  base.dataUltimaTentativa = a.dataUltimaTentativa || b.dataUltimaTentativa || null;

  return base;
}

/**
 * Diz, para cada linha do painel, o que o operador pode fazer.
 * Só é enviável o que tem linha em FILA_ENVIO_OFICIOS: um "Pendente" que veio
 * apenas do Controle não tem e-mail montado, não há o que disparar.
 */
function MON_OFICIOS_definirAcoesEnvio_(item) {
  var maxTentativas = typeof FILA_OFICIOS_MAX_TENTATIVAS !== "undefined" ? FILA_OFICIOS_MAX_TENTATIVAS : 3;

  item.podeEnviar = false;
  item.podeReprocessar = false;
  item.motivoBloqueio = "";

  if (!item.naFila) {
    item.motivoBloqueio = "Sem registro na fila de envio — nada a disparar por aqui.";
    return item;
  }

  var statusFila = MON_OFICIOS_normStatus_(item.statusFila);
  var tentativas = Number(item.tentativas) || 0;

  if (statusFila === "ENVIADO") {
    var statusPainel = MON_OFICIOS_normStatus_(item.status);
    if (statusPainel !== "ENVIADO" && statusPainel !== "CONFIRMADO") {
      item.motivoBloqueio = "E-mail já enviado pela fila — o status do Controle é que está desatualizado.";
    }
    return item;
  }

  if (statusFila === "ERRO_PERMANENTE" || tentativas >= maxTentativas) {
    item.podeReprocessar = true;
    item.motivoBloqueio = "Limite de " + maxTentativas + " tentativas atingido — reprocesse para voltar à fila.";
    return item;
  }

  if (statusFila === "PROCESSANDO") {
    var travado = typeof filaOficiosProcessandoTravado_ === "function"
      ? filaOficiosProcessandoTravado_(item.dataUltimaTentativa)
      : false;

    if (travado) {
      item.podeEnviar = true;
      item.podeReprocessar = true;
      item.motivoBloqueio = "Envio interrompido em processamento.";
    } else {
      item.motivoBloqueio = "Envio em processamento agora.";
    }
    return item;
  }

  if (statusFila === "PENDENTE" || statusFila === "ERRO") {
    item.podeEnviar = true;
    if (tentativas > 0) item.motivoBloqueio = "Tentativas até agora: " + tentativas + " de " + maxTentativas + ".";
  }

  return item;
}

/**
 * Os campos que só servem para calcular as ações ficam no servidor.
 * O google.script.run não entrega objetos Date crus da planilha ao navegador:
 * a resposta inteira chega nula no handler de sucesso. Todo o resto do painel
 * já trafega como string ou número — este é o único ponto que precisava disso.
 */
function MON_OFICIOS_limparCamposInternos_(item) {
  delete item.naFila;
  delete item.statusFila;
  delete item.tentativas;
  delete item.dataUltimaTentativa;
  return item;
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
