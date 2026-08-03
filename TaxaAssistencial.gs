// ============================================================================
// ARQUIVO: TaxaAssistencial.gs
// Envio em massa da Taxa Assistencial
// ============================================================================

function obterOuCriarAbaFilaTaxaAssistencial_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
  if (!sh) sh = ss.insertSheet("ENVIO_TAXA_ASSISTENCIAL");
  sh.clearContents();
  sh.appendRow(["NUMERO_OFICIO","ESCOLA","CNPJ","EMAILS","STATUS","ERRO","DATA_HORA","USUARIO"]);
  return sh;
}

function limparEstadoFilaTaxaAssistencial_() {
  var props = PropertiesService.getScriptProperties();
  var cctFileId = String(props.getProperty("TAXA_ASSISTENCIAL_CCT_FILE_ID") || "").trim();
  if (cctFileId) { try { DriveApp.getFileById(cctFileId).setTrashed(true); } catch(e) {} }
  props.deleteProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO");
  props.deleteProperty("TAXA_ASSISTENCIAL_CODIGO");
  props.deleteProperty("TAXA_ASSISTENCIAL_PDF_ID");
  props.deleteProperty("TAXA_ASSISTENCIAL_PDF_URL");
  props.deleteProperty("TAXA_ASSISTENCIAL_CCT_FILE_ID");
  props.deleteProperty("TAXA_ASSISTENCIAL_CCT_NOME");
}

function removerTriggersTaxaAssistencial_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "executarLoteTaxaAssistencialAgendado") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function contarPendentesFilaTaxaAssistencial_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
  if (!sh || sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 5, sh.getLastRow() - 1, 1).getValues().flat()
    .filter(function(s){ return String(s || "").trim() === "PENDENTE"; }).length;
}

function agendarProximoLoteTaxaAssistencial_(horas) {
  removerTriggersTaxaAssistencial_();
  ScriptApp.newTrigger("executarLoteTaxaAssistencialAgendado")
    .timeBased().after((horas || 1) * 60 * 60 * 1000).create();
}

function executarLoteTaxaAssistencialAgendado() {
  var props = PropertiesService.getScriptProperties();
  return enviarOficioTaxaAssistencialPRO({
    assunto: String(props.getProperty("TAXA_ASSISTENCIAL_ASSUNTO") || "").trim(),
    corpo:   String(props.getProperty("TAXA_ASSISTENCIAL_CORPO")   || "").trim()
  });
}

function cancelarEnvioTaxaAssistencial() {
  try {
    removerTriggersTaxaAssistencial_();
    return { ok: true, mensagem: "Triggers do envio em massa removidos com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao cancelar envio: " + e.message };
  }
}

function prepararFilaTaxaAssistencial(params) {
  params = params || {};
  var assunto = String(params.assunto || "").trim();
  var corpo   = String(params.corpo   || "").trim();
  if (!assunto) throw new Error("Assunto não informado.");
  if (!corpo)   throw new Error("Corpo do e-mail não informado.");

  var ss        = SpreadsheetApp.openById(PLANILHA_ID);
  var shEscolas = ss.getSheetByName("Escolas");
  if (!shEscolas) throw new Error("Aba 'Escolas' não encontrada.");

  var dados = shEscolas.getDataRange().getValues();
  if (!dados || dados.length < 2) throw new Error("Nenhuma escola cadastrada encontrada.");

  var headers = dados[0].map(function(h){ return String(h || "").trim(); });

  function normCab(txt) {
    return String(txt || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  }

  function encontrarIndice_(lista) {
    for (var i = 0; i < headers.length; i++) {
      var h = normCab(headers[i]);
      for (var j = 0; j < lista.length; j++) {
        if (h === normCab(lista[j])) return i;
      }
    }
    return -1;
  }

  var idxNome           = encontrarIndice_(["Escola (Razão Social)","Escola","Razão Social","Nome Escola","Nome Fantasia"]);
  var idxEmailsTodos    = encontrarIndice_(["E-mails (todos)","Emails (todos)","Todos os E-mails","EmailsTodos"]);
  var idxEmailPrincipal = encontrarIndice_(["E-mail (principal)","Email (principal)","E-mail","Email","EmailPrincipal"]);
  var idxCnpj           = encontrarIndice_(["CNPJ"]);

  if (idxNome === -1) throw new Error("Coluna da escola não encontrada na aba 'Escolas'.");
  if (idxEmailsTodos === -1 && idxEmailPrincipal === -1) throw new Error("Nenhuma coluna de e-mail encontrada.");

  var props  = PropertiesService.getScriptProperties();
  var numero = String(props.getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
  if (!numero) numero = gerarProximoNumeroSeguro();

  var codigo = numero.replace("/", "-");
  if (typeof gerarCodigoVerificacao === "function") {
    try { codigo = gerarCodigoVerificacao(numero); } catch(e) {}
  }

  var emailUsuario = (typeof obterEmailUsuarioAtual_ === "function")
    ? String(obterEmailUsuarioAtual_() || "").trim().toLowerCase()
    : String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();

  var cctFileId = "", cctNome = "";
  if (params.anexo && params.anexo.base64) {
    try {
      var pasta = obterPastaPorTipo_("TAXA_ASSISTENCIAL");
      cctNome = String(params.anexo.nome || "CCT.pdf").trim();
      var blobCCT = Utilities.newBlob(
        Utilities.base64Decode(params.anexo.base64),
        params.anexo.tipo || "application/pdf", cctNome
      );
      var fileCCT = pasta.createFile(blobCCT);
      cctFileId = fileCCT.getId();
      Logger.log("CCT salvo no Drive: " + cctFileId);
    } catch(e) { Logger.log("⚠ Erro ao salvar CCT: " + e.message); }
  }

  var shFila = obterOuCriarAbaFilaTaxaAssistencial_();
  shFila.clearContents();
  shFila.appendRow(["NUMERO_OFICIO","ESCOLA","CNPJ","EMAILS","STATUS","ERRO","DATA_HORA","USUARIO"]);

  var filas = [];
  var validas = 0, invalidas = 0, semEmail = 0;

  for (var i = 1; i < dados.length; i++) {
    var nome = String(dados[i][idxNome] || "").trim();
    var cnpj = idxCnpj > -1 ? String(dados[i][idxCnpj] || "").trim() : "";
    if (!nome) continue;

    var emailsBruto    = idxEmailsTodos    > -1 ? String(dados[i][idxEmailsTodos]    || "").trim() : "";
    var emailPrincipal = idxEmailPrincipal > -1 ? String(dados[i][idxEmailPrincipal] || "").trim() : "";
    var emailFinal     = emailsBruto || emailPrincipal;

    if (!emailFinal) {
      filas.push([numero, nome, cnpj, "", "SEM_EMAIL", "Sem e-mail cadastrado", new Date(), emailUsuario]);
      semEmail++; continue;
    }

    var validacao = validarListaEmails_(emailFinal);
    if (!validacao.ok) {
      filas.push([numero, nome, cnpj, emailFinal, "EMAIL_INVALIDO", "E-mail inválido: " + (validacao.invalido || emailFinal), new Date(), emailUsuario]);
      invalidas++; continue;
    }

    filas.push([numero, nome, cnpj, validacao.todos, "PENDENTE", "", "", emailUsuario]);
    validas++;
  }

  filas.sort(function(a, b) {
    return String(a[1] || "").localeCompare(String(b[1] || ""), "pt-BR", {sensitivity:"base"});
  });

  if (filas.length) shFila.getRange(2, 1, filas.length, filas[0].length).setValues(filas);

  props.setProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO", numero);
  props.setProperty("TAXA_ASSISTENCIAL_CODIGO", codigo);
  props.setProperty("TAXA_ASSISTENCIAL_ASSUNTO", assunto);
  props.setProperty("TAXA_ASSISTENCIAL_CORPO", corpo);
  props.setProperty("TAXA_ASSISTENCIAL_FILA_PREPARADA", "1");
  if (cctFileId) props.setProperty("TAXA_ASSISTENCIAL_CCT_FILE_ID", cctFileId);
  if (cctNome)   props.setProperty("TAXA_ASSISTENCIAL_CCT_NOME", cctNome);

  return { total: filas.length, validas: validas, invalidas: invalidas, semEmail: semEmail,
    numero: numero, temAnexo: !!cctFileId,
    mensagem: "Fila preparada com sucesso em ordem alfabética (A-Z)." };
}

function enviarOficioTaxaAssistencialPRO(params) {
  params = params || {};
  var LIMITE_EMAILS_HORA               = 100;
  var INTERVALO_PROXIMA_EXECUCAO_HORAS = 1;
  var REPLY_TO = "financeiro@sindeducacao.com, secretaria@sindeducacao.com";

  var props             = PropertiesService.getScriptProperties();
  var numero            = String(props.getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
  var codigoVerificacao = String(props.getProperty("TAXA_ASSISTENCIAL_CODIGO") || "").trim();

  if (!numero) throw new Error("Fila não preparada. Execute 'Preparar fila' antes de iniciar o envio.");

  var ss         = SpreadsheetApp.openById(PLANILHA_ID);
  var shFila     = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
  var shRegistro = ss.getSheetByName(PLANILHA_REGISTRO);

  if (!shFila)     throw new Error("Aba 'ENVIO_TAXA_ASSISTENCIAL' não encontrada.");
  if (!shRegistro) throw new Error("Aba de registro não encontrada: " + PLANILHA_REGISTRO);

  var lastRow = shFila.getLastRow();
  if (lastRow < 2) return { enviados:0, erros:0, finalizado:true, numero:numero, detalhesErros:[], mensagem:"Nenhuma fila encontrada." };

  var dados = shFila.getRange(2, 1, lastRow - 1, 8).getValues();

  var emailUsuario = (typeof obterEmailUsuarioAtual_ === "function")
    ? String(obterEmailUsuarioAtual_() || "").trim().toLowerCase()
    : String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();

  var dataHoje = (typeof dataPorExtenso === "function")
    ? dataPorExtenso()
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  var cidadeUf = (typeof CIDADE_UF !== "undefined" && CIDADE_UF) ? CIDADE_UF : "Vitória/ES";
  var baseUrl_ = (function(){ try { return ScriptApp.getService().getUrl(); } catch(e) { return ""; } })();

  var TEMPLATE_PADRAO = "1Awpat0OhOSadMYni7696JVLGXU40dP6mCwBpWXoqJgs";
  var templateId = (typeof TEMPLATE_TAXA_ASSISTENCIAL_ID !== "undefined" && String(TEMPLATE_TAXA_ASSISTENCIAL_ID || "").trim())
    ? String(TEMPLATE_TAXA_ASSISTENCIAL_ID).trim() : TEMPLATE_PADRAO;

  var pasta = obterPastaPorTipo_("TAXA_ASSISTENCIAL");

  var cctFileId = String(props.getProperty("TAXA_ASSISTENCIAL_CCT_FILE_ID") || "").trim();
  var cctNome   = String(props.getProperty("TAXA_ASSISTENCIAL_CCT_NOME") || "CCT.pdf").trim();
  var blobCCT = null;
  if (cctFileId) {
    try { blobCCT = DriveApp.getFileById(cctFileId).getBlob().setName(cctNome); }
    catch(e) { Logger.log("⚠ Erro ao carregar CCT: " + e.message); }
  }

  var assuntoEmail       = "Ofício de Taxa Assistencial Nº " + numero + " — " + (String(params.assunto || "").trim() || "SindEducação-ES");
  var corpoPersonalizado = String(params.corpo || "").trim();
  var saudacao           = saudacaoHoraBR_();

  var horaChave = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd-HH");
  var horaSalva = String(props.getProperty("TAXA_ASSISTENCIAL_HORA_CONTROLE") || "").trim();
  var emailsEnviadosHora = parseInt(props.getProperty("TAXA_ASSISTENCIAL_EMAILS_ENVIADOS_HORA") || "0", 10);
  if (horaSalva !== horaChave) {
    emailsEnviadosHora = 0;
    props.setProperty("TAXA_ASSISTENCIAL_HORA_CONTROLE", horaChave);
    props.setProperty("TAXA_ASSISTENCIAL_EMAILS_ENVIADOS_HORA", "0");
  }

  var enviados = 0, erros = 0, detalhesErros = [];

  for (var i = 0; i < dados.length; i++) {
    if (emailsEnviadosHora >= LIMITE_EMAILS_HORA) break;
    if (String(dados[i][4] || "").trim() !== "PENDENTE") continue;

    var nomeEscola    = String(dados[i][1] || "").trim();
    var cnpjEscola    = String(dados[i][2] || "").trim();
    var emailsDestino = String(dados[i][3] || "").trim();
    var linhaReal     = i + 2;

    if (!emailsDestino) {
      shFila.getRange(linhaReal, 5, 1, 3).setValues([["ERRO", "Escola sem e-mail válido.", new Date()]]);
      detalhesErros.push(nomeEscola + ": Escola sem e-mail válido."); erros++; continue;
    }

    var listaEmails = emailsDestino.split(/[;,]/).map(function(e){ return String(e||"").trim(); }).filter(Boolean);
    if (!listaEmails.length) {
      shFila.getRange(linhaReal, 5, 1, 3).setValues([["ERRO", "Nenhum e-mail válido.", new Date()]]);
      detalhesErros.push(nomeEscola + ": Nenhum e-mail válido."); erros++; continue;
    }

    var pdfBlob = null;
    try {
      var corpoEscola = corpoPersonalizado
        ? corpoPersonalizado.replace(/\{\{ESCOLA\}\}/gi, nomeEscola)
        : "Encaminhamos, em anexo, o Ofício referente à Taxa Assistencial – Assistência Médica, conforme previsto na CCT 2026.";

      var retorno = gerarPDFUniversal({
        templateId: templateId, pastaDestinoId: pasta.getId(),
        nomeArquivo: "Ofício " + numero + " - " + nomeEscola + " - Taxa Assistencial",
        substituicoes: {
          "{{NUMERO}}": numero, "{{DATA}}": dataHoje, "{{CIDADE_UF}}": cidadeUf,
          "{{ESCOLA}}": nomeEscola, "{{CNPJ}}": cnpjEscola,
          "{{ASSUNTO}}": assuntoEmail, "{{CORPO}}": corpoEscola,
          "{{CODIGO}}": codigoVerificacao,
          "{{LINK_VALIDACAO}}": baseUrl_ ? (baseUrl_ + "?codigo=" + codigoVerificacao) : ""
        }
      });

      pdfBlob = retorno.pdf.getBlob();

      appendRowByHeader_(shRegistro, {
        "Status": "ENVIADO", "Número do Ofício": numero, "CONFIG": codigoVerificacao,
        "Log_Sistema": emailUsuario, "Sistema_Versão": SISTEMA_VERSAO,
        "Data envio ofício": new Date(), "TIPO": "Taxa Assistencial", "Unidade": "",
        "Escola (Razão Social)": nomeEscola, "CNPJ": cnpjEscola,
        "E-mail (principal)": listaEmails[0] || "", "E-mails (todos)": emailsDestino,
        "Colaborador(es)": "", "Observações": assuntoEmail,
        "Link PDF (Drive)": "https://drive.google.com/file/d/" + retorno.pdf.getId() + "/view",
        "Link Ficha": ""
      });
    } catch(e) {
      shFila.getRange(linhaReal, 5, 1, 3).setValues([["ERRO", "Falha ao gerar PDF: " + e.message, new Date()]]);
      detalhesErros.push(nomeEscola + ": Falha ao gerar PDF — " + e.message); erros++; continue;
    }

    var anexosEscola = [pdfBlob];
    if (blobCCT) anexosEscola.push(blobCCT);

    var corpoEscolaEmail = corpoPersonalizado
      ? corpoPersonalizado.replace(/\{\{ESCOLA\}\}/gi, nomeEscola)
      : "Encaminhamos, em anexo, o Ofício referente à Taxa Assistencial – Assistência Médica, conforme previsto na CCT 2026.";

    var htmlBodyEscola = montarEmailHTML("Ofício de Taxa Assistencial", numero, "Taxa Assistencial", 0, corpoEscolaEmail);

    var enviadosEscola = 0, errosEscola = [];

    for (var j = 0; j < listaEmails.length; j++) {
      if (emailsEnviadosHora >= LIMITE_EMAILS_HORA) break;
      try {
        GmailApp.sendEmail({
          to: listaEmails[j], subject: assuntoEmail,
          htmlBody: htmlBodyEscola,
          body: saudacao + "!\n\n" + corpoEscolaEmail + "\n\nAtenciosamente,\n\nFinanceiro & Cobrança\nSindEducação-ES",
          name: "SindEducação-ES", replyTo: REPLY_TO, attachments: anexosEscola
        });
        enviados++; enviadosEscola++; emailsEnviadosHora++;
        props.setProperty("TAXA_ASSISTENCIAL_EMAILS_ENVIADOS_HORA", String(emailsEnviadosHora));
        registrarLogSistema({ usuario: emailUsuario, numero: numero, tipo: "Taxa Assistencial",
          escola: nomeEscola, cnpj: cnpjEscola, email: listaEmails[j], codigo: codigoVerificacao });
        Utilities.sleep(300);
      } catch(e) {
        erros++; errosEscola.push(listaEmails[j] + ": " + String(e.message || e));
        detalhesErros.push(nomeEscola + " / " + listaEmails[j] + ": " + String(e.message || e));
      }
    }

    if      (enviadosEscola === listaEmails.length)         shFila.getRange(linhaReal, 5, 1, 3).setValues([["ENVIADO", "", new Date()]]);
    else if (enviadosEscola > 0 && errosEscola.length > 0)  shFila.getRange(linhaReal, 5, 1, 3).setValues([["ERRO", "Envio parcial. " + errosEscola.join(" | "), new Date()]]);
    else if (errosEscola.length > 0)                         shFila.getRange(linhaReal, 5, 1, 3).setValues([["ERRO", errosEscola.join(" | "), new Date()]]);
  }

  var pendentes = contarPendentesFilaTaxaAssistencial_();
  if (pendentes > 0) {
    agendarProximoLoteTaxaAssistencial_(INTERVALO_PROXIMA_EXECUCAO_HORAS);
    try { enviarAlerteLimiteDiario({ enviados: enviados, erros: erros, finalizado: false }); } catch(e) {}
    return { enviados: enviados, erros: erros, finalizado: false, numero: numero, detalhesErros: detalhesErros,
      mensagem: "Lote enviado. Restam " + pendentes + " escola(s) pendente(s)." };
  }

  removerTriggersTaxaAssistencial_();
  limparEstadoFilaTaxaAssistencial_();
  try { enviarAlerteLimiteDiario({ enviados: enviados, erros: erros, finalizado: true }); } catch(e) {}
  return { enviados: enviados, erros: erros, finalizado: true, numero: numero, detalhesErros: detalhesErros,
    mensagem: "Envio finalizado com sucesso." };
}

function enviarTaxaEscolaEspecifica(params) {
  params = params || {};
  try {
    var emailUsuario = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim().toLowerCase()
      : String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
    if (!emailUsuario) throw new Error("Não foi possível identificar o usuário logado.");
    if (typeof usuarioAutorizado === "function" && !usuarioAutorizado(emailUsuario)) throw new Error("Acesso negado.");

    var assunto   = String(params.assunto || "").trim();
    var corpoRaw  = String(params.corpo   || "").trim();
    var escola    = String(params.escola  || "").trim();
    var cnpj      = String(params.cnpj    || "").trim();
    var emailDest = String(params.email   || "").trim();

    if (!assunto)   throw new Error("Assunto não informado.");
    if (!corpoRaw)  throw new Error("Corpo do e-mail não informado.");
    if (!escola)    throw new Error("Nome da escola não informado.");
    if (!emailDest) throw new Error("E-mail da escola não informado.");

    var validacao = validarListaEmails_(emailDest);
    if (!validacao.ok) throw new Error("E-mail inválido: " + (validacao.invalido || emailDest));

    var corpo = corpoRaw.replace(/\{\{ESCOLA\}\}/gi, escola);

    var props_ = PropertiesService.getScriptProperties();
    var numero  = String(props_.getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();
    if (!numero) { numero = gerarProximoNumeroSeguro(); props_.setProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO", numero); }

    var dataHoje = (typeof dataPorExtenso === "function") ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    var cidadeUf = (typeof CIDADE_UF !== "undefined" && CIDADE_UF) ? CIDADE_UF : "Vitória/ES";

    var codigoVerificacao = numero.replace("/", "-");
    if (typeof gerarCodigoVerificacao === "function") { try { codigoVerificacao = gerarCodigoVerificacao(numero); } catch(e) {} }

    var baseUrl_ = (function(){ try { return ScriptApp.getService().getUrl(); } catch(e) { return ""; } })();
    var TEMPLATE_PADRAO = "1Awpat0OhOSadMYni7696JVLGXU40dP6mCwBpWXoqJgs";
    var templateId = (typeof TEMPLATE_TAXA_ASSISTENCIAL_ID !== "undefined" && String(TEMPLATE_TAXA_ASSISTENCIAL_ID || "").trim())
      ? String(TEMPLATE_TAXA_ASSISTENCIAL_ID).trim() : TEMPLATE_PADRAO;

    var retorno = gerarPDFUniversal({
      templateId: templateId, pastaDestinoId: obterPastaPorTipo_("TAXA_ASSISTENCIAL").getId(),
      nomeArquivo: "Ofício " + numero + " - " + escola + " - Taxa Assistencial",
      substituicoes: {
        "{{NUMERO}}": numero, "{{DATA}}": dataHoje, "{{CIDADE_UF}}": cidadeUf,
        "{{ESCOLA}}": escola, "{{CNPJ}}": cnpj || "", "{{ASSUNTO}}": assunto,
        "{{CORPO}}": corpo, "{{CODIGO}}": codigoVerificacao,
        "{{LINK_VALIDACAO}}": baseUrl_ ? baseUrl_ + "?codigo=" + codigoVerificacao : ""
      }
    });

    var anexos = [retorno.pdf.getBlob()];
    if (params.anexo && params.anexo.base64) {
      try {
        anexos.push(Utilities.newBlob(
          Utilities.base64Decode(params.anexo.base64),
          params.anexo.tipo || "application/pdf",
          params.anexo.nome || "Anexo.pdf"
        ));
      } catch(e) { Logger.log("⚠ Erro ao processar anexo CCT: " + e.message); }
    }

    var htmlBody = montarEmailHTML("Ofício de Taxa Assistencial", numero, "Taxa Assistencial", 0, corpo);

    GmailApp.sendEmail({
      to: validacao.todos, cc: "financeiro@sindeducacao.com",
      subject: assunto || "Ofício de Taxa Assistencial Nº " + numero,
      htmlBody: htmlBody, name: "SindEducação-ES", replyTo: "secretaria@sindeducacao.com", attachments: anexos
    });

    var urlView = "https://drive.google.com/file/d/" + retorno.pdf.getId() + "/view";
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    appendRowByHeader_(ss.getSheetByName(PLANILHA_REGISTRO), {
      "Status":"ENVIADO", "Número do Ofício":numero, "CONFIG":codigoVerificacao,
      "Log_Sistema":emailUsuario, "Sistema_Versão":SISTEMA_VERSAO,
      "Data envio ofício":new Date(), "TIPO":"Taxa Assistencial", "Unidade":"",
      "Escola (Razão Social)":escola, "CNPJ":cnpj||"",
      "E-mail (principal)":validacao.principal, "E-mails (todos)":validacao.todos,
      "Colaborador(es)":"", "Observações":assunto, "Link PDF (Drive)":urlView, "Link Ficha":""
    });

    registrarLogSistema({ usuario:emailUsuario, numero:numero, tipo:"Taxa Assistencial",
      escola:escola, cnpj:cnpj||"", email:validacao.todos, codigo:codigoVerificacao });

    return { ok:true, numero:numero, codigoVerificacao:codigoVerificacao, url:urlView,
      mensagem:"Ofício enviado com sucesso para " + validacao.todos + "." };
  } catch(e) {
    Logger.log("Erro em enviarTaxaEscolaEspecifica: " + e.message);
    throw new Error(e.message);
  }
}

function reenviarFalhasTaxaAssistencial() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
  if (!sh || sh.getLastRow() < 2) return { total: 0, ignoradosLimite: 0, mensagem: "Nenhuma fila encontrada." };

  var dados = sh.getDataRange().getValues();
  var total = 0, ignoradosLimite = 0;

  for (var i = 1; i < dados.length; i++) {
    var status = String(dados[i][4] || "").trim().toUpperCase();
    if (status === "BLOQUEADO_LIMITE") { ignoradosLimite++; continue; }
    if (status === "ERRO") {
      sh.getRange(i + 1, 5).setValue("PENDENTE");
      sh.getRange(i + 1, 6).setValue("");
      sh.getRange(i + 1, 7).setValue(new Date());
      total++;
    }
  }

  return { total: total, ignoradosLimite: ignoradosLimite,
    mensagem: total > 0 ? "Falhas remarcadas com sucesso." : "Nenhum registro com status ERRO foi encontrado." };
}

function obterStatusFilaTaxaAssistencial() {
  try {
    var ss     = SpreadsheetApp.openById(PLANILHA_ID);
    var sh     = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
    var props  = PropertiesService.getScriptProperties();
    var numero = String(props.getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO") || "").trim();

    if (!sh || sh.getLastRow() < 2) {
      return {
        preparada: false,
        ativa: false,
        numero: numero || "",
        total: 0,
        pendente: 0,
        enviado: 0,
        erro: 0,
        semEmail: 0,
        invalido: 0,
        emAndamento: false
      };
    }

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var total = 0;
    var pendente = 0;
    var enviado = 0;
    var erro = 0;
    var semEmail = 0;
    var invalido = 0;

    dados.forEach(function(row) {
      var s = String(row[4] || "").trim().toUpperCase();
      if (!s) return;

      total++;

      if (s === "PENDENTE") {
        pendente++;
      } else if (s === "ENVIADO") {
        enviado++;
      } else if (s === "ERRO") {
        erro++;
      } else if (s === "SEM_EMAIL") {
        semEmail++;
      } else if (s === "EMAIL_INVALIDO") {
        invalido++;
      }
    });

    return {
      preparada: true,
      ativa: pendente > 0,
      numero: numero || "",
      total: total,
      pendente: pendente,
      enviado: enviado,
      erro: erro + semEmail + invalido,
      semEmail: semEmail,
      invalido: invalido,
      emAndamento: pendente > 0
    };

  } catch(e) {
    return {
      preparada: false,
      ativa: false,
      numero: "",
      total: 0,
      pendente: 0,
      enviado: 0,
      erro: 0,
      semEmail: 0,
      invalido: 0,
      emAndamento: false
    };
  }
}

function obterStatusTaxaAssistencialDashboard() {
  try {
    var ss     = SpreadsheetApp.openById(PLANILHA_ID);
    var sh     = ss.getSheetByName("ENVIO_TAXA_ASSISTENCIAL");
    var numero = String(PropertiesService.getScriptProperties()
      .getProperty("TAXA_ASSISTENCIAL_NUMERO_OFICIO")||"").trim();

    if (!sh || sh.getLastRow() < 2 || !numero) {
      return { ativa:false, numero:"", total:0, enviado:0, pendente:0, erro:0 };
    }

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    var total=0, enviado=0, pendente=0, erro=0;

    dados.forEach(function(row) {
      var s = String(row[4]||"").trim().toUpperCase();
      if (!s) return; total++;
      if      (s === "ENVIADO")        enviado++;
      else if (s === "PENDENTE")       pendente++;
      else if (s === "ERRO" || s === "SEM_EMAIL" || s === "EMAIL_INVALIDO") erro++;
    });

    return { ativa:true, numero:numero, total:total, enviado:enviado, pendente:pendente, erro:erro };
  } catch(e) {
    return { ativa:false, numero:"", total:0, enviado:0, pendente:0, erro:0 };
  }
}

function listarTodasEscolasTaxa() {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("Escolas");
    if (!sh || sh.getLastRow() < 2) return [];

    var dados   = sh.getDataRange().getValues();
    var headers = dados[0].map(function(h){ return String(h||"").trim(); });

    function norm(txt){ return String(txt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,""); }

    function idx(trechos) {
      for (var i = 0; i < headers.length; i++) {
        var hn = norm(headers[i]);
        for (var j = 0; j < trechos.length; j++) {
          if (hn.indexOf(norm(trechos[j])) > -1) return i;
        }
      }
      return -1;
    }

    var idxNome   = idx(["escola","razao social","nome fantasia"]);
    var idxEmails = idx(["e-mails (todos)","emails (todos)","emailstodos","todos os emails"]);
    var idxEmailP = idx(["e-mail (principal)","email (principal)","emailprincipal","e-mail principal"]);
    var idxEmailG = idx(["e-mail","email"]);
    var idxCnpj   = idx(["cnpj"]);
    var idxEmail  = idxEmails>-1 ? idxEmails : idxEmailP>-1 ? idxEmailP : idxEmailG;

    if (idxNome === -1) return [];

    var resultado = [];
    for (var i = 1; i < dados.length; i++) {
      var nome = String(dados[i][idxNome] || "").trim();
      if (!nome) continue;
      resultado.push({
        nome:  nome,
        cnpj:  idxCnpj  > -1 ? String(dados[i][idxCnpj]  || "").trim() : "",
        email: idxEmail > -1  ? String(dados[i][idxEmail] || "").trim() : ""
      });
    }

    resultado.sort(function(a,b){ return a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"}); });
    return resultado;
  } catch(e) {
    Logger.log("Erro em listarTodasEscolasTaxa: " + e.message);
    return [];
  }
}

function buscarEscolaTaxa(termo) {
  try {
    termo = String(termo || "").trim();
    if (!termo || termo.length < 2) return [];

    function norm_(txt){ return String(txt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
    function nums_(txt){ return String(txt||"").replace(/\D/g,""); }
    function normEmails_(v){ return String(v||"").split(/[\n,;]+/).map(function(e){return String(e||"").trim();}).filter(Boolean).filter(function(e,i,a){return a.indexOf(e)===i;}).join(", "); }

    var termoNorm = norm_(termo), termoNum = nums_(termo);

    if (typeof listarEscolas === "function") {
      var resultado = (listarEscolasCadastro_interno_() || []).filter(function(item) {
        var nome = String(item.escola||item.nome||item.razaoSocial||"").trim();
        var cnpj = String(item.cnpj||item.cnpjLimpo||"").trim();
        return norm_(nome).indexOf(termoNorm) > -1 || (termoNum.length >= 3 && nums_(cnpj).indexOf(termoNum) > -1);
      }).map(function(item) {
        return {
          nome:  String(item.escola||item.nome||item.razaoSocial||"").trim(),
          cnpj:  String(item.cnpj||item.cnpjLimpo||"").trim(),
          email: normEmails_(item.emailsTodos||item.email||"")
        };
      }).filter(function(i){ return i.nome; });

      resultado.sort(function(a,b){ return String(a.nome||"").localeCompare(String(b.nome||""),"pt-BR",{sensitivity:"base"}); });
      return resultado.slice(0, 20);
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("Escolas") || ss.getSheetByName("Controle") || ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sh) return [];

    var dados = sh.getDataRange().getValues();
    if (!dados || dados.length < 2) return [];
    var headers = dados[0].map(function(h){ return String(h||"").trim(); });

    function findIdx_(trechos) {
      var tn = trechos.map(norm_);
      for (var i = 0; i < headers.length; i++) {
        var h = norm_(headers[i]);
        for (var j = 0; j < tn.length; j++) {
          if (h.indexOf(tn[j]) > -1) return i;
        }
      }
      return -1;
    }

    var idxNome   = findIdx_(["escola","razao social","nome fantasia"]);
    var idxEmails = findIdx_(["e-mails (todos)","emails (todos)","todos os e-mails"]);
    var idxEmailP = findIdx_(["e-mail (principal)","email (principal)","e-mail","email"]);
    var idxCnpj   = findIdx_(["cnpj"]);

    if (idxNome === -1) return [];

    var resultado2 = [];
    for (var i = 1; i < dados.length; i++) {
      var nome = String(dados[i][idxNome]||"").trim();
      if (!nome) continue;
      var cnpj  = idxCnpj   > -1 ? String(dados[i][idxCnpj]   || "").trim() : "";
      var email = normEmails_((idxEmails > -1 ? String(dados[i][idxEmails]||"") : "") || (idxEmailP > -1 ? String(dados[i][idxEmailP]||"") : ""));
      if (norm_(nome).indexOf(termoNorm) > -1 || (termoNum.length >= 3 && nums_(cnpj).indexOf(termoNum) > -1)) {
        resultado2.push({ nome: nome, cnpj: cnpj, email: email });
      }
    }

    resultado2.sort(function(a,b){ return String(a.nome||"").localeCompare(String(b.nome||""),"pt-BR",{sensitivity:"base"}); });
    return resultado2.slice(0, 20);
  } catch (e) {
    Logger.log("Erro em buscarEscolaTaxa: " + e.message);
    return [];
  }
}

function previewOficioTaxaAssistencial(params) {
  params = params || {};
  var assunto   = String(params.assunto || "").trim() || "Repasse da Taxa Assistencial – Assistência Médica | SindEducação-ES";
  var corpoHtml = formatarCorpoEmailHTML_(String(params.corpo || "").trim());
  var assuntoEsc = String(assunto).replace(/</g,"&lt;").replace(/>/g,"&gt;");

  return {
    assunto: assunto,
    html: "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>"
      + "<title>Prévia — Taxa Assistencial</title>"
      + "<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#eef2f7;padding:24px;}"
      + ".card{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 30px rgba(0,20,60,.12);}"
      + ".th{padding:18px 28px 14px;background:linear-gradient(135deg,#001f4d,#003b82);color:#fff;border-bottom:4px solid #C9A84C;}"
      + ".th-nome{font-size:20px;font-weight:900;margin-bottom:6px;}.th-assunto{font-size:13px;font-weight:700;color:#C9A84C;margin-top:8px;}"
      + ".corpo{padding:24px 28px;font-size:14px;line-height:1.7;color:#1a2233;}"
      + ".badge{display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:#475569;margin-bottom:10px;}"
      + "hr{margin:20px 28px;border:none;border-top:1px solid #e2e8f0;}"
      + ".ass{padding:0 28px 20px;font-size:13px;line-height:1.8;color:#334155;}"
      + "</style></head><body><div class='card'>"
      + "<div class='th'><div class='th-nome'>SINDEDUCAÇÃO-ES</div><div class='th-assunto'>📧 " + assuntoEsc + "</div></div>"
      + "<div class='corpo'><div class='badge'>PRÉVIA DO E-MAIL</div>" + corpoHtml + "</div>"
      + "<hr><div class='ass'><strong>Financeiro &amp; Cobrança</strong><br>SindEducação-ES<br>(27) 99813-5965 | financeiro@sindeducacao.com</div>"
      + "</div></body></html>"
  };
}

function enviarTesteTaxaAssistencial(params) {
  params = params || {};
  var assunto    = String(params.assunto    || "").trim();
  var corpo      = String(params.corpo      || "").trim();
  var emailTeste = String(params.emailTeste || "").trim();

  if (!assunto)    throw new Error("Assunto não informado.");
  if (!corpo)      throw new Error("Corpo do e-mail não informado.");
  if (!emailTeste || !emailValido(emailTeste)) throw new Error("E-mail de teste inválido: " + emailTeste);

  var htmlBody =
    "<div style='font-family:Segoe UI,Arial,sans-serif;padding:20px;max-width:700px;'>"
    + "<div style='background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 14px;font-size:12px;color:#9a3412;margin-bottom:16px;'>"
    + "⚠ <strong>ENVIO DE TESTE</strong> — Número de ofício NÃO registrado no sistema.</div>"
    + formatarCorpoEmailHTML_(corpo) + "</div>";

  GmailApp.sendEmail({
    to: emailTeste, subject: "[TESTE] " + assunto,
    htmlBody: htmlBody, body: "[TESTE]\n\n" + corpo, name: "SindEducação-ES (teste)"
  });

  return { mensagem: "E-mail de teste enviado para " + emailTeste + ". Número NÃO registrado." };
}