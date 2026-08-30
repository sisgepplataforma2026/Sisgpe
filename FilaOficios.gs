// ============================================================================
// ARQUIVO: FilaOficios.gs
// Gerenciamento da fila de envio de ofícios
// ============================================================================

function obterOuCriarAbaFilaOficios_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh) {
    sh = ss.insertSheet("FILA_ENVIO_OFICIOS");
sh.appendRow([
  "ID","DATA_CRIACAO","NUMERO_OFICIO","TIPO","ESCOLA","CNPJ",
  "EMAIL_PRINCIPAL","EMAILS_TODOS","ASSUNTO","HTML_BODY",
  "ANEXOS_JSON","STATUS","TENTATIVAS","ULTIMO_ERRO",
  "DATA_ULTIMA_TENTATIVA","USUARIO","CODIGO_VERIFICACAO",
  "DATA_ENVIO","DATA_CONFIRMACAO","MENSAGEM_ID",
  "STATUS_RECEBIMENTO","ABERTURAS","CLIQUES","ORIGEM"
]);

sh.getRange(1, 1, 1, 24).setFontWeight("bold");
    sh.setFrozenRows(1);
    Logger.log("✅ Aba FILA_ENVIO_OFICIOS criada.");
  }
  return sh;
}

function criarFilaEnvioOficio_(dadosFila) {
  if (!dadosFila || typeof dadosFila !== "object") {
    throw new Error("Dados da fila não informados.");
  }

  var sh = obterOuCriarAbaFilaOficios_();

  var headersEsperados = [
    "ID","DATA_CRIACAO","NUMERO_OFICIO","TIPO","ESCOLA","CNPJ",
    "EMAIL_PRINCIPAL","EMAILS_TODOS","ASSUNTO","HTML_BODY",
    "ANEXOS_JSON","STATUS","TENTATIVAS","ULTIMO_ERRO",
    "DATA_ULTIMA_TENTATIVA","USUARIO","CODIGO_VERIFICACAO",
    "DATA_ENVIO","DATA_CONFIRMACAO","MENSAGEM_ID",
    "STATUS_RECEBIMENTO","ABERTURAS","CLIQUES","ORIGEM"
  ];

  var headerMap = getHeaderMap_(sh);

  headersEsperados.forEach(function(nome) {
    if (!headerMap[nome]) {
      throw new Error("Coluna obrigatória não encontrada na fila: " + nome);
    }
  });

  var numeroOficio      = String(dadosFila.numeroOficio || "").trim();
  var tipo              = String(dadosFila.tipo || "").trim();
  var escola            = String(dadosFila.escola || "").trim();
  var cnpj              = String(dadosFila.cnpj || "").trim();
  var emailPrincipal    = String(dadosFila.emailPrincipal || "").trim();
  var emailsTodos       = String(dadosFila.emailsTodos || "").trim();
  var assunto           = String(dadosFila.assunto || "").trim();
  var htmlBodyOriginal  = String(dadosFila.htmlBody || "").trim();
  var usuario           = String(dadosFila.usuario || "secretaria@sindeducacao.com").trim();
  var codigoVerificacao = String(dadosFila.codigoVerificacao || "").trim();
  var anexos            = Array.isArray(dadosFila.anexos) ? dadosFila.anexos : [];

  if (!numeroOficio) {
    throw new Error("Número do ofício não informado para a fila.");
  }

  if (!tipo) {
    throw new Error("Tipo do ofício não informado para a fila.");
  }

  if (!emailPrincipal && !emailsTodos) {
    throw new Error("Nenhum e-mail de destino informado para a fila.");
  }

  if (!assunto) {
    throw new Error("Assunto do e-mail não informado para a fila.");
  }

  var id = String(new Date().getTime()) + "_" + Math.floor(Math.random() * 1000);

  var pixelAbertura = "";

  try {
    if (typeof gerarPixelAberturaOficio_ === "function") {
      pixelAbertura = gerarPixelAberturaOficio_(id) || "";
    }
  } catch (ePixel) {
    Logger.log("⚠ Não foi possível gerar pixel de abertura: " + ePixel.message);
  }

  var htmlBody = htmlBodyOriginal;

  if (pixelAbertura) {
    htmlBody += pixelAbertura;
  }

  appendRowByHeader_(sh, {
    "ID": id,
    "DATA_CRIACAO": new Date(),
    "NUMERO_OFICIO": numeroOficio,
    "TIPO": tipo,
    "ESCOLA": escola,
    "CNPJ": cnpj,
    "EMAIL_PRINCIPAL": emailPrincipal,
    "EMAILS_TODOS": emailsTodos,
    "ASSUNTO": assunto,
    "HTML_BODY": htmlBody,
    "ANEXOS_JSON": JSON.stringify(anexos),
    "STATUS": "PENDENTE",
    "TENTATIVAS": 0,
    "ULTIMO_ERRO": "",
    "DATA_ULTIMA_TENTATIVA": "",
    "USUARIO": usuario,
    "CODIGO_VERIFICACAO": codigoVerificacao,
    "DATA_ENVIO": "",
    "DATA_CONFIRMACAO": "",
    "MENSAGEM_ID": "",
    "STATUS_RECEBIMENTO": "AGUARDANDO",
    "ABERTURAS": 0,
    "CLIQUES": 0,
    "ORIGEM": normalizarOrigemFilaOficio_(tipo)
  });

  return {
    ok: true,
    id: id,
    mensagem: "Envio adicionado à fila com sucesso."
  };
}
/* ── Helpers internos ── */
function normalizarOrigemFilaOficio_(tipo) {
  var t = String(tipo || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (t.indexOf("FILIACAO") > -1) return "FILIACAO";
  if (t.indexOf("DESFILIACAO") > -1) return "DESFILIACAO";
  if (t.indexOf("NEGOCIAL") > -1) return "TAXA_NEGOCIAL";
  if (t.indexOf("ASSISTENCIAL") > -1) return "TAXA_ASSISTENCIAL";
  if (t.indexOf("LIVRE") > -1) return "OFICIO_LIVRE";

  return "OFICIO";
}

function classificarErroEnvio_(mensagemErro) {
  var msg = String(mensagemErro || "").toLowerCase();
  var permanentes = [
    "invalid email", "e-mail inválido", "user unknown", "no such user",
    "address not found", "does not exist", "arquivo não encontrado",
    "file not found", "no item with the given id",
    "permission denied", "access denied", "not authorized"
  ];
  for (var i = 0; i < permanentes.length; i++) {
    if (msg.indexOf(permanentes[i]) > -1) return "ERRO_PERMANENTE";
  }
  return "ERRO";
}

function _atualizarBadgeMonitoramento_(total) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty("BADGE_MONITORAMENTO", String(total || 0));
  } catch(e) {
    Logger.log("⚠ _atualizarBadgeMonitoramento_: " + e.message);
  }
}

/* ── Atualiza status no PLANILHA_REGISTRO em batch ── */
function _atualizarRegistroOficioEnviado_(ss, numeroOficio) {
  try {
    var shReg = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!shReg || shReg.getLastRow() < 2) return;
    var hmReg  = getHeaderMap_(shReg);
    var colN   = hmReg["Número do Ofício"];
    var colS   = hmReg["Status"];
    if (!colN || !colS) return;
    var dados = shReg.getRange(2, 1, shReg.getLastRow() - 1, shReg.getLastColumn()).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][colN - 1] || "").trim() === String(numeroOficio).trim()) {
        shReg.getRange(i + 2, colS).setValue("ENVIADO");
        break;
      }
    }
  } catch (e) {
    Logger.log("⚠ Falha ao atualizar Registro: " + e.message);
  }
}

/* ── Escreve resultado de uma linha da fila em batch (1 setValues) ── */
function _gravarResultadoFila_(sh, linhaPlanilha, totalCols, valoresLinha,
                                colStatus, colTentativas, colUltimoErro, colDataUltimaTent,
                                novoStatus, novasTentativas, ultimoErro) {
  valoresLinha[colStatus        - 1] = novoStatus;
  valoresLinha[colTentativas    - 1] = novasTentativas;
  valoresLinha[colUltimoErro    - 1] = ultimoErro;
  valoresLinha[colDataUltimaTent- 1] = new Date();
  sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);
}

/* ============================================================
   processarFilaEnvioOficios
   ============================================================ */
function processarFilaEnvioOficios() {
  var LIMITE_POR_EXECUCAO   = 5;
  var PAUSA_ENTRE_ENVIOS_MS = 4000;
  var MAX_TENTATIVAS        = 3;

  if (typeof getAmbienteAtual === "function" &&
      getAmbienteAtual() === "homologacao") {
    Logger.log("[HOMOLOGACAO] Fila ativa sob a política segura de destinatário único.");
  }

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = obterOuCriarAbaFilaOficios_();

  if (sh.getLastRow() < 2) {
    _atualizarBadgeMonitoramento_(0);
    return { ok: true, mensagem: "Fila vazia.", processados: 0, enviados: 0, erros: 0 };
  }

  // Achado #10: sem checar a cota, um pico de envio esgotava a cota diária do
  // Gmail no meio do lote e cada ofício restante virava "ERRO" genérico —
  // indistinguível de e-mail inválido, consumindo tentativas à toa. Se a cota
  // não cobre nem este lote, pausa sem tocar nas linhas (nenhuma tentativa é
  // gasta) — a próxima execução do trigger (5 em 5 min) tenta de novo.
  var quotaRestante = MailApp.getRemainingDailyQuota();
  if (quotaRestante < LIMITE_POR_EXECUCAO) {
    Logger.log("⚠ processarFilaEnvioOficios: cota diária de e-mail insuficiente (" + quotaRestante + " restante(s)). Execução pausada, sem marcar erro nas linhas.");
    return {
      ok: true,
      mensagem: "Cota diária de e-mail quase esgotada (" + quotaRestante + " restante(s)). Processamento pausado nesta execução — retoma sozinho quando a cota renovar.",
      processados: 0, enviados: 0, erros: 0, cotaInsuficiente: true
    };
  }

  var headerMap            = getHeaderMap_(sh);
  /* colId entrou na lista de obrigatórias em 20/08/2026 (commit 731ed4e) sem
     ser declarada aqui — só na outra função que aquele commit tocou. O efeito
     era ReferenceError logo abaixo, ao montar `obrigatorias`: a fila de envio
     de ofícios parava antes de processar a primeira linha. */
  var colId                = headerMap["ID"];
  var colNumero            = headerMap["NUMERO_OFICIO"];
  var colTipo              = headerMap["TIPO"];
  var colEscola            = headerMap["ESCOLA"];
  var colCnpj              = headerMap["CNPJ"];
  var colEmailPrincipal    = headerMap["EMAIL_PRINCIPAL"];
  var colEmailsTodos       = headerMap["EMAILS_TODOS"];
  var colAssunto           = headerMap["ASSUNTO"];
  var colHtmlBody          = headerMap["HTML_BODY"];
  var colAnexosJson        = headerMap["ANEXOS_JSON"];
  var colStatus            = headerMap["STATUS"];
  var colTentativas        = headerMap["TENTATIVAS"];
  var colUltimoErro        = headerMap["ULTIMO_ERRO"];
  var colDataUltimaTent    = headerMap["DATA_ULTIMA_TENTATIVA"];
  var colCodigoVerificacao = headerMap["CODIGO_VERIFICACAO"];

  var colDataEnvio         = headerMap["DATA_ENVIO"];
  var colMensagemId        = headerMap["MENSAGEM_ID"];
  var colStatusRecebimento = headerMap["STATUS_RECEBIMENTO"];

  var obrigatorias = {
    ID: colId,
    NUMERO_OFICIO: colNumero,
    TIPO: colTipo,
    ESCOLA: colEscola,
    CNPJ: colCnpj,
    EMAIL_PRINCIPAL: colEmailPrincipal,
    EMAILS_TODOS: colEmailsTodos,
    ASSUNTO: colAssunto,
    HTML_BODY: colHtmlBody,
    ANEXOS_JSON: colAnexosJson,
    STATUS: colStatus,
    TENTATIVAS: colTentativas,
    ULTIMO_ERRO: colUltimoErro,
    DATA_ULTIMA_TENTATIVA: colDataUltimaTent,
    CODIGO_VERIFICACAO: colCodigoVerificacao,
    DATA_ENVIO: colDataEnvio,
    MENSAGEM_ID: colMensagemId,
    STATUS_RECEBIMENTO: colStatusRecebimento
  };

  Object.keys(obrigatorias).forEach(function(nome) {
    if (!obrigatorias[nome]) {
      throw new Error("Coluna obrigatória não encontrada na fila: " + nome);
    }
  });

  var totalCols    = sh.getLastColumn();
  var dados        = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();
  var usuarioEnvio = "secretaria@sindeducacao.com";
  var processados  = 0;
  var enviados     = 0;
  var erros        = 0;
  var pendentes    = 0;

  for (var i = 0; i < dados.length; i++) {
    var linha         = dados[i];
    var linhaPlanilha = i + 2;
    var status        = String(linha[colStatus - 1] || "").trim().toUpperCase();
    var tentativas    = parseInt(linha[colTentativas - 1], 10) || 0;

    if (status === "PENDENTE" || status === "ERRO") pendentes++;
    if (status === "ERRO_PERMANENTE") continue;
    if (status !== "PENDENTE" && status !== "ERRO") continue;

    if (tentativas >= MAX_TENTATIVAS) {
      var vL = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];

      _gravarResultadoFila_(
        sh,
        linhaPlanilha,
        totalCols,
        vL,
        colStatus,
        colTentativas,
        colUltimoErro,
        colDataUltimaTent,
        "ERRO_PERMANENTE",
        tentativas,
        "Máximo de " + MAX_TENTATIVAS + " tentativas atingido."
      );

      continue;
    }

    if (processados >= LIMITE_POR_EXECUCAO) break;

    var numeroOficio      = String(linha[colNumero - 1] || "").trim();
    var tipo              = String(linha[colTipo - 1] || "").trim();
    var escola            = String(linha[colEscola - 1] || "").trim();
    var cnpj              = String(linha[colCnpj - 1] || "").trim();
    var emailPrincipal    = String(linha[colEmailPrincipal - 1] || "").trim();
    var emailsTodos       = String(linha[colEmailsTodos - 1] || "").trim();
    var assunto           = String(linha[colAssunto - 1] || "").trim();
    var htmlBody          = String(linha[colHtmlBody - 1] || "").trim();
    var anexosJson        = String(linha[colAnexosJson - 1] || "").trim();
    var codigoVerificacao = String(linha[colCodigoVerificacao - 1] || "").trim();

    var valoresLinha;
    var lockItemFila = LockService.getScriptLock();
    if (!lockItemFila.tryLock(5000)) {
      continue;
    }

    try {
      valoresLinha = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];
      var statusAtualFila = String(valoresLinha[colStatus - 1] || "").trim().toUpperCase();
      if (statusAtualFila !== "PENDENTE" && statusAtualFila !== "ERRO") {
        continue;
      }

      tentativas = parseInt(valoresLinha[colTentativas - 1], 10) || 0;
      if (tentativas >= MAX_TENTATIVAS) {
        _gravarResultadoFila_(sh, linhaPlanilha, totalCols, valoresLinha, colStatus, colTentativas, colUltimoErro, colDataUltimaTent, "ERRO_PERMANENTE", tentativas, "Máximo de " + MAX_TENTATIVAS + " tentativas atingido.");
        continue;
      }

      valoresLinha[colStatus - 1] = "PROCESSANDO";
      valoresLinha[colDataUltimaTent - 1] = new Date();
      sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);
      SpreadsheetApp.flush();
    } finally {
      lockItemFila.releaseLock();
    }

    processados++;

    try {

      var validacaoEmails = validarListaEmails_(emailsTodos || emailPrincipal);

      if (!validacaoEmails.ok) {
        throw new Error("E-mail inválido na fila: " + (validacaoEmails.invalido || "não informado"));
      }

      var anexosInfo = [];

      try {
        anexosInfo = anexosJson ? JSON.parse(anexosJson) : [];
      } catch (eJson) {
        throw new Error("ANEXOS_JSON inválido: " + eJson.message);
      }

      if (!Array.isArray(anexosInfo)) {
        throw new Error("ANEXOS_JSON deve ser uma lista.");
      }

      var anexos = [];

      anexosInfo.forEach(function(anexo) {
        if (!anexo || !anexo.fileId) return;

        var blob = DriveApp.getFileById(String(anexo.fileId).trim()).getBlob();

        if (anexo.nome) {
          blob.setName(String(anexo.nome).trim());
        }

        anexos.push(blob);
      });

      enviarEmailOficio_(
        usuarioEnvio,
        htmlBody,
        anexos,
        assunto,
        validacaoEmails.todos,
        "Segue ofício em anexo."
      );

      valoresLinha[colDataEnvio - 1] = new Date();
      valoresLinha[colMensagemId - 1] = "GMAILAPP_SEM_ID";
      valoresLinha[colStatusRecebimento - 1] = "ENVIADO";

      _gravarResultadoFila_(
        sh,
        linhaPlanilha,
        totalCols,
        valoresLinha,
        colStatus,
        colTentativas,
        colUltimoErro,
        colDataUltimaTent,
        "ENVIADO",
        tentativas + 1,
        ""
      );

      pendentes = Math.max(0, pendentes - 1);
      _atualizarRegistroOficioEnviado_(ss, numeroOficio);

      try {
        registrarLogSistema({
          usuario: usuarioEnvio,
          numero: numeroOficio + " (FILA)",
          tipo: tipo,
          escola: escola,
          cnpj: cnpj,
          email: validacaoEmails.todos,
          codigo: codigoVerificacao
        });
      } catch (eLog) {
        Logger.log("⚠ Falha ao registrar log: " + eLog.message);
      }

      enviados++;
      Utilities.sleep(PAUSA_ENTRE_ENVIOS_MS);

    } catch (e) {
      var tipoErro = classificarErroEnvio_(e.message);

      _gravarResultadoFila_(
        sh,
        linhaPlanilha,
        totalCols,
        valoresLinha,
        colStatus,
        colTentativas,
        colUltimoErro,
        colDataUltimaTent,
        tipoErro,
        tentativas + 1,
        String(e.message || e)
      );

      erros++;
      Logger.log("❌ Erro (" + tipoErro + ") na fila linha " + linhaPlanilha + ": " + e.message);
    }
  }

  SpreadsheetApp.flush();
  _atualizarBadgeMonitoramento_(pendentes);

  return {
    ok: true,
    mensagem: "Processamento concluído.",
    processados: processados,
    enviados: enviados,
    erros: erros
  };
}
function enviarOficioDaFilaAgora(numero, tokenSessao, filaId) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  if (!numero) return { ok: false, mensagem: "Número do ofício não informado." };

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = obterOuCriarAbaFilaOficios_();

  if (sh.getLastRow() < 2) {
    return { ok: false, mensagem: "Fila de envio vazia." };
  }

  var headerMap = getHeaderMap_(sh);

  var colId                  = headerMap["ID"];
  var colNumero              = headerMap["NUMERO_OFICIO"];
  var colEmailPrincipal      = headerMap["EMAIL_PRINCIPAL"];
  var colEmailsTodos         = headerMap["EMAILS_TODOS"];
  var colTipo                = headerMap["TIPO"];
  var colEscola              = headerMap["ESCOLA"];
  var colCnpj                = headerMap["CNPJ"];
  var colAssunto             = headerMap["ASSUNTO"];
  var colHtmlBody            = headerMap["HTML_BODY"];
  var colAnexosJson          = headerMap["ANEXOS_JSON"];
  var colStatus              = headerMap["STATUS"];
  var colTentativas          = headerMap["TENTATIVAS"];
  var colUltimoErro          = headerMap["ULTIMO_ERRO"];
  var colDataUltimaTent      = headerMap["DATA_ULTIMA_TENTATIVA"];
  var colDataEnvio           = headerMap["DATA_ENVIO"];
  var colMensagemId          = headerMap["MENSAGEM_ID"];
  var colStatusRecebimento   = headerMap["STATUS_RECEBIMENTO"];

  var obrigatorias = {
    NUMERO_OFICIO: colNumero,
    EMAIL_PRINCIPAL: colEmailPrincipal,
    EMAILS_TODOS: colEmailsTodos,
    TIPO: colTipo,
    ESCOLA: colEscola,
    CNPJ: colCnpj,
    ASSUNTO: colAssunto,
    HTML_BODY: colHtmlBody,
    ANEXOS_JSON: colAnexosJson,
    STATUS: colStatus,
    TENTATIVAS: colTentativas,
    ULTIMO_ERRO: colUltimoErro,
    DATA_ULTIMA_TENTATIVA: colDataUltimaTent,
    DATA_ENVIO: colDataEnvio,
    MENSAGEM_ID: colMensagemId,
    STATUS_RECEBIMENTO: colStatusRecebimento
  };

  Object.keys(obrigatorias).forEach(function(nome) {
    if (!obrigatorias[nome]) {
      throw new Error("Coluna obrigatória não encontrada na fila: " + nome);
    }
  });

  var totalCols = sh.getLastColumn();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();
  var linhaIdx = -1;
  var linhaIdxFallback = -1;
  var numeroBuscado = String(numero).trim();
  var filaIdBuscado = String(filaId || "").trim();

  // Caminho principal: o ID é único e identifica exatamente a linha criada
  // nesta emissão. Isso elimina ambiguidades quando dois ambientes possuem o
  // mesmo NUMERO_OFICIO (ex.: histórico de Produção copiado para HML).
  if (filaIdBuscado) {
    for (var i = dados.length - 1; i >= 0; i--) {
      if (String(dados[i][colId - 1] || "").trim() === filaIdBuscado) {
        linhaIdx = i;
        break;
      }
    }

    if (linhaIdx === -1) {
      return { ok: false, mensagem: "Registro da fila não encontrado para o ID informado." };
    }

    var numeroDoId = String(dados[linhaIdx][colNumero - 1] || "").trim();
    if (numeroBuscado && numeroDoId !== numeroBuscado) {
      return { ok: false, mensagem: "O ID da fila não corresponde ao número do ofício informado." };
    }
  } else {
    // Compatibilidade com chamadas antigas: sem filaId, usa o número e
    // prioriza o registro acionável mais recente.
    for (var j = dados.length - 1; j >= 0; j--) {
      if (String(dados[j][colNumero - 1] || "").trim() !== numeroBuscado) continue;

      var statusCandidato = String(dados[j][colStatus - 1] || "").trim().toUpperCase();
      if (statusCandidato === "PENDENTE" || statusCandidato === "ERRO" || statusCandidato === "PROCESSANDO") {
        linhaIdx = j;
        break;
      }

      if (linhaIdxFallback === -1) linhaIdxFallback = j;
    }

    if (linhaIdx === -1) linhaIdx = linhaIdxFallback;

    if (linhaIdx === -1) {
      return { ok: false, mensagem: "Ofício " + numero + " não encontrado na fila." };
    }
  }

  var linha = dados[linhaIdx];
  var linhaPlanilha = linhaIdx + 2;
  var status = String(linha[colStatus - 1] || "").trim().toUpperCase();
  Logger.log("[ENVIO_AGORA] Selecionado ofício " + numero + " na linha " + linhaPlanilha + " com status " + status + ".");

  if (status === "ENVIADO") {
    return { ok: true, mensagem: "E-mail já foi enviado anteriormente." };
  }

  var htmlBody       = String(linha[colHtmlBody - 1] || "").trim();
  var assunto        = String(linha[colAssunto - 1] || "").trim();
  var emailsTodos    = String(linha[colEmailsTodos - 1] || "").trim();
  var tipo           = String(linha[colTipo - 1] || "").trim();
  var escola         = String(linha[colEscola - 1] || "").trim();
  var cnpj           = String(linha[colCnpj - 1] || "").trim();
  var emailPrincipal = String(linha[colEmailPrincipal - 1] || "").trim();
  var anexosJson     = String(linha[colAnexosJson - 1] || "").trim();
  var tentativas     = parseInt(linha[colTentativas - 1], 10) || 0;
  var usuarioEnvio   = "secretaria@sindeducacao.com";

  var validacaoEmails = validarListaEmails_(emailsTodos || emailPrincipal || "");

  if (!validacaoEmails.ok || !validacaoEmails.emails.length) {
    return { ok: false, mensagem: "E-mail inválido ou não informado." };
  }

  var valoresLinha;
  var lockEnvioAgora = LockService.getScriptLock();
  var lockObtido = false;

  // O SISGEP possui vários módulos no mesmo projeto. Um lock global curto de
  // 5 s fazia o botão "Enviar agora" desistir durante operações paralelas,
  // sem sequer registrar uma tentativa. Aguarda um pouco mais, mantendo a
  // proteção contra envio duplicado.
  try {
    lockObtido = lockEnvioAgora.tryLock(15000);
  } catch (eLock) {
    Logger.log("[ENVIO_AGORA] Falha ao obter lock para o ofício " + numero + ": " + (eLock.message || eLock));
  }

  if (!lockObtido) {
    Logger.log("[ENVIO_AGORA] Fila permaneceu ocupada para o ofício " + numero + " após 15 s.");
    return { ok: false, mensagem: "Fila ocupada. Aguarde alguns segundos e tente novamente." };
  }

  try {
    valoresLinha = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];
    var statusAtualEnvio = String(valoresLinha[colStatus - 1] || "").trim().toUpperCase();
    if (statusAtualEnvio === "ENVIADO") {
      return { ok: true, mensagem: "E-mail já foi enviado anteriormente." };
    }
    if (statusAtualEnvio === "PROCESSANDO") {
      return { ok: false, mensagem: "Este ofício já está sendo processado." };
    }

    tentativas = parseInt(valoresLinha[colTentativas - 1], 10) || 0;
    valoresLinha[colStatus - 1] = "PROCESSANDO";
    valoresLinha[colDataUltimaTent - 1] = new Date();
    sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);
    SpreadsheetApp.flush();
  } finally {
    if (lockObtido) lockEnvioAgora.releaseLock();
  }

  try {

    var anexos = [];

    if (anexosJson) {
      var anexosInfo = JSON.parse(anexosJson);

      if (Array.isArray(anexosInfo)) {
        anexosInfo.forEach(function(anexo) {
          if (!anexo || !anexo.fileId) return;

          var blob = DriveApp.getFileById(String(anexo.fileId).trim()).getBlob();

          if (anexo.nome) {
            blob.setName(String(anexo.nome).trim());
          }

          anexos.push(blob);
        });
      }
    }

    enviarEmailOficio_(
      usuarioEnvio,
      htmlBody,
      anexos,
      assunto,
      validacaoEmails.todos,
      "Segue ofício em anexo."
    );

    valoresLinha[colDataEnvio - 1] = new Date();
    valoresLinha[colMensagemId - 1] = "GMAILAPP_SEM_ID";
    valoresLinha[colStatusRecebimento - 1] = "ENVIADO";

    _gravarResultadoFila_(
      sh,
      linhaPlanilha,
      totalCols,
      valoresLinha,
      colStatus,
      colTentativas,
      colUltimoErro,
      colDataUltimaTent,
      "ENVIADO",
      tentativas + 1,
      ""
    );

    SpreadsheetApp.flush();

    _atualizarRegistroOficioEnviado_(ss, numero);

    try {
      registrarLogSistema({
        usuario: usuarioEnvio,
        numero: numero,
        tipo: tipo,
        escola: escola,
        cnpj: cnpj,
        email: validacaoEmails.todos,
        codigo: ""
      });
    } catch (eLog) {
      Logger.log("Log erro: " + eLog.message);
    }

    return { ok: true, mensagem: "E-mail enviado com sucesso." };

  } catch (e) {
    var tipoErro = classificarErroEnvio_(e.message);

    _gravarResultadoFila_(
      sh,
      linhaPlanilha,
      totalCols,
      valoresLinha,
      colStatus,
      colTentativas,
      colUltimoErro,
      colDataUltimaTent,
      tipoErro,
      tentativas + 1,
      String(e.message || e)
    );

    SpreadsheetApp.flush();

    return { ok: false, mensagem: "Erro ao enviar: " + (e.message || e) };
  }
}
function sincronizarStatusOficiosEnviados() {
  var ss    = SpreadsheetApp.openById(PLANILHA_ID);
  var sh    = obterOuCriarAbaFilaOficios_();
  var shReg = ss.getSheetByName(PLANILHA_REGISTRO);

  if (!sh    || sh.getLastRow()    < 2) { Logger.log("Fila vazia.");     return; }
  if (!shReg || shReg.getLastRow() < 2) { Logger.log("Registro vazio."); return; }

  var hmFila = getHeaderMap_(sh);
  var hmReg  = getHeaderMap_(shReg);

  var colNFila = hmFila["NUMERO_OFICIO"];
  var colSFila = hmFila["STATUS"];
  var colNReg  = hmReg["Número do Ofício"];
  var colSReg  = hmReg["Status"];

  if (!colNFila || !colSFila || !colNReg || !colSReg) {
    Logger.log("Colunas não encontradas."); return;
  }

  var dadosFila  = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var totalCols  = shReg.getLastColumn();
  var dadosReg   = shReg.getRange(2, 1, shReg.getLastRow() - 1, totalCols).getValues();

  // Monta mapa de número → índice no registro
  var mapaReg = {};
  dadosReg.forEach(function(linha, idx) {
    var num = String(linha[colNReg - 1] || "").trim();
    if (num) mapaReg[num] = idx;
  });

  var atualizados = 0, naoEncontrados = [];

  dadosFila.forEach(function(linha) {
    if (String(linha[colSFila - 1] || "").trim().toUpperCase() !== "ENVIADO") return;
    var numero = String(linha[colNFila - 1] || "").trim();
    if (!numero) return;
    var idxReg = mapaReg[numero];
    if (idxReg !== undefined) {
      var statusAtual = String(dadosReg[idxReg][colSReg - 1] || "").trim().toUpperCase();
      if (statusAtual !== "ENVIADO") {
        dadosReg[idxReg][colSReg - 1] = "ENVIADO";
        atualizados++;
      }
    } else {
      naoEncontrados.push(numero);
    }
  });

  // Grava todas as alterações em uma única chamada
  if (atualizados > 0) {
    shReg.getRange(2, 1, dadosReg.length, totalCols).setValues(dadosReg);
    SpreadsheetApp.flush();
  }

  Logger.log("✅ Atualizados: " + atualizados + " ofícios.");
  if (naoEncontrados.length) Logger.log("⚠️ Não encontrados: " + naoEncontrados.join(", "));
}

function instalarTriggerFilaEnvioOficios(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Instalação do gatilho da fila de Ofícios", true);
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "processarFilaEnvioOficios") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processarFilaEnvioOficios").timeBased().everyMinutes(5).create();
  Logger.log("✅ Trigger instalado — executa a cada 5 minutos.");
  return { ok: true, mensagem: "Trigger instalado com sucesso." };
}

function removerTriggerFilaEnvioOficios(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Remoção do gatilho da fila de Ofícios", true);
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "processarFilaEnvioOficios") ScriptApp.deleteTrigger(t);
  });
  Logger.log("✅ Trigger removido.");
}

/* ── Dashboard da fila ── */

function dashboardFilaEnvioResumo() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) {
    return { total: 0, pendentes: 0, processando: 0, enviados: 0, erros: 0, taxaSucesso: 0, taxaErro: 0 };
  }
  var hm        = getHeaderMap_(sh);
  var colStatus = hm["STATUS"], colTentativas = hm["TENTATIVAS"];
  if (!colStatus || !colTentativas) throw new Error("Colunas obrigatórias não encontradas na fila.");

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var total = 0, pendentes = 0, processando = 0, enviados = 0, erros = 0;

  dados.forEach(function(linha) {
    var s = String(linha[colStatus - 1] || "").trim().toUpperCase();
    if (!s) return;
    total++;
    if      (s === "PENDENTE")                         pendentes++;
    else if (s === "PROCESSANDO")                      processando++;
    else if (s === "ENVIADO")                          enviados++;
    else if (s === "ERRO" || s === "ERRO_PERMANENTE")  erros++;
  });

  return {
    total: total, pendentes: pendentes, processando: processando,
    enviados: enviados, erros: erros,
    taxaSucesso: total > 0 ? Number(((enviados / total) * 100).toFixed(1)) : 0,
    taxaErro:    total > 0 ? Number(((erros    / total) * 100).toFixed(1)) : 0
  };
}

function dashboardFilaEnvioGraficos() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) {
    return { status: { PENDENTE: 0, PROCESSANDO: 0, ENVIADO: 0, ERRO: 0 }, tipos: {} };
  }
  var hm        = getHeaderMap_(sh);
  var colStatus = hm["STATUS"], colTipo = hm["TIPO"];
  if (!colStatus || !colTipo) throw new Error("Colunas obrigatórias não encontradas na fila.");

  var dados  = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var status = { PENDENTE: 0, PROCESSANDO: 0, ENVIADO: 0, ERRO: 0 };
  var tipos  = {};

  dados.forEach(function(linha) {
    var s    = String(linha[colStatus - 1] || "").trim().toUpperCase();
    var t    = String(linha[colTipo   - 1] || "").trim() || "Sem tipo";
    var sKey = (s === "ERRO_PERMANENTE") ? "ERRO" : s;
    if (status[sKey] !== undefined) status[sKey]++;
    if (!tipos[t]) tipos[t] = 0;
    tipos[t]++;
  });

  return { status: status, tipos: tipos };
}

function dashboardFilaEnvioErrosRecentes() {
  var LIMITE = 20;
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var colNumero         = hm["NUMERO_OFICIO"], colTipo   = hm["TIPO"],
      colEscola         = hm["ESCOLA"],          colStatus = hm["STATUS"],
      colErro           = hm["ULTIMO_ERRO"],      colTent  = hm["TENTATIVAS"],
      colDataUltimaTent = hm["DATA_ULTIMA_TENTATIVA"];

  if (!colNumero || !colTipo || !colEscola || !colStatus || !colErro || !colTent || !colDataUltimaTent) {
    throw new Error("Colunas obrigatórias não encontradas na fila.");
  }

  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function(linha) {
      var s = String(linha[colStatus - 1] || "").trim().toUpperCase();
      if (s !== "ERRO" && s !== "ERRO_PERMANENTE") return null;
      var dataTent = linha[colDataUltimaTent - 1] ? new Date(linha[colDataUltimaTent - 1]) : null;
      return {
        numero:        String(linha[colNumero - 1] || "").trim(),
        tipo:          String(linha[colTipo   - 1] || "").trim(),
        escola:        String(linha[colEscola - 1] || "").trim(),
        erro:          String(linha[colErro   - 1] || "").trim(),
        permanente:    s === "ERRO_PERMANENTE",
        tentativas:    parseInt(linha[colTent - 1], 10) || 0,
        dataTentativa: dataTent,
        dataFormatada: dataTent ? formatarDataHoraBRSegundos_(dataTent) : ""
      };
    })
    .filter(Boolean)
    .sort(function(a, b) {
      return (b.dataTentativa ? b.dataTentativa.getTime() : 0) -
             (a.dataTentativa ? a.dataTentativa.getTime() : 0);
    })
    .slice(0, LIMITE);
}

function dashboardFilaPendenciasCriticas() {
  var LIMITE = 20;
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var colNumero      = hm["NUMERO_OFICIO"], colTipo        = hm["TIPO"],
      colEscola      = hm["ESCOLA"],          colStatus      = hm["STATUS"],
      colTentativas  = hm["TENTATIVAS"],      colDataCriacao = hm["DATA_CRIACAO"];

  if (!colNumero || !colTipo || !colEscola || !colStatus || !colTentativas || !colDataCriacao) {
    throw new Error("Colunas obrigatórias não encontradas na fila.");
  }

  var agora = new Date();
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function(linha) {
      var s = String(linha[colStatus - 1] || "").trim().toUpperCase();
      if (s !== "PENDENTE" && s !== "ERRO") return null;
      var dataCriacao  = linha[colDataCriacao - 1] ? new Date(linha[colDataCriacao - 1]) : null;
      var tentativas   = parseInt(linha[colTentativas - 1], 10) || 0;
      var horasAbertas = dataCriacao && !isNaN(dataCriacao.getTime())
        ? Math.floor((agora - dataCriacao) / (1000 * 60 * 60)) : 0;
      return {
        numero:      String(linha[colNumero - 1] || "").trim(),
        tipo:        String(linha[colTipo   - 1] || "").trim(),
        escola:      String(linha[colEscola - 1] || "").trim(),
        status:      s, tentativas: tentativas, horasAbertas: horasAbertas,
        dataCriacao: dataCriacao ? formatarDataHoraBR_(dataCriacao) : ""
      };
    })
    .filter(Boolean)
    .sort(function(a, b) {
      if (b.horasAbertas !== a.horasAbertas) return b.horasAbertas - a.horasAbertas;
      return b.tentativas - a.tentativas;
    })
    .slice(0, LIMITE);
}
