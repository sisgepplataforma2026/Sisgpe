// ============================================================================
// ARQUIVO: RelatoriosOficios.gs
// Exportação de relatórios, auditoria e histórico de ofícios
// ============================================================================

/* ── Histórico — alias de compatibilidade ── */
function listarHistorico(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  if (typeof listarHistoricoOficios === "function") {
    return listarHistoricoOficios(filtros || {}, tokenSessao);
  }
  return [];
}

/* ── Exportar Relatório de Ofícios ── */
function exportarRelatorio(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  filtros = filtros || {};
  var tipoExportacao = filtros.tipoExportacao || "excel";
  var dataInicio     = filtros.dataInicio ? new Date(filtros.dataInicio + "T00:00:00") : null;
  var dataFim        = filtros.dataFim    ? new Date(filtros.dataFim    + "T23:59:59") : null;
  var tipoFiltro     = filtros.tipo   || "";
  var escolaFiltro   = String(filtros.escola || "").toLowerCase().trim();

  var ss    = SpreadsheetApp.openById(PLANILHA_ID);
  var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sheet || sheet.getLastRow() < 2) return { erro: true, mensagem: "Nenhum registro encontrado." };

  var h     = getHeaderMap_(sheet);
  var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var cabecalho = ["Status","Nº Ofício","Data Envio","Escola","CNPJ","Tipo","E-mail","Usuário"];
  var linhas    = [];

  for (var i = 0; i < dados.length; i++) {
    var linha     = dados[i];
    var dataEnvio = h["Data envio ofício"] && linha[h["Data envio ofício"] - 1]
      ? new Date(linha[h["Data envio ofício"] - 1]) : null;
    var escola    = h["Escola (Razão Social)"] ? String(linha[h["Escola (Razão Social)"] - 1] || "") : "";
    var tipo      = (h["TIPO"] || h["Tipo"])   ? linha[(h["TIPO"] || h["Tipo"]) - 1] : "";

    if (dataInicio   && (!dataEnvio || dataEnvio < dataInicio)) continue;
    if (dataFim      && (!dataEnvio || dataEnvio > dataFim))    continue;
    if (tipoFiltro   && tipo !== tipoFiltro)                     continue;
    if (escolaFiltro && escola.toLowerCase().indexOf(escolaFiltro) === -1) continue;

    linhas.push([
      h["Status"]             ? linha[h["Status"] - 1]              : "",
      h["Número do Ofício"]   ? linha[h["Número do Ofício"] - 1]    : "",
      dataEnvio               ? formatarDataHoraBR_(dataEnvio)       : "",
      escola,
      h["CNPJ"]               ? linha[h["CNPJ"] - 1]                : "",
      tipo,
      h["E-mail (principal)"] ? linha[h["E-mail (principal)"] - 1]  : "",
      h["Log_Sistema"]        ? linha[h["Log_Sistema"] - 1]         : ""
    ]);
  }

  if (!linhas.length) return { erro: true, mensagem: "Nenhum registro encontrado com os filtros aplicados." };

  var nomeArquivo  = "Relatorio_Oficios_" + new Date().getTime();
  var planilhaTemp = SpreadsheetApp.create(nomeArquivo);
  var aba          = planilhaTemp.getActiveSheet();
  aba.appendRow(cabecalho);
  aba.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  aba.autoResizeColumns(1, cabecalho.length);

  return exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao);
}

/* ── Exportar Auditoria (LOG_SISTEMA) ── */
function exportarAuditoriaLog(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  filtros = filtros || {};
  var tipoExportacao = filtros.tipoExportacao || "excel";
  var dataInicio     = filtros.dataInicio ? new Date(filtros.dataInicio + "T00:00:00") : null;
  var dataFim        = filtros.dataFim    ? new Date(filtros.dataFim    + "T23:59:59") : null;
  var usuarioFiltro  = String(filtros.usuario || "").toLowerCase().trim();
  var tipoFiltro     = String(filtros.tipo    || "").toLowerCase().trim();
  var escolaFiltro   = String(filtros.escola  || "").toLowerCase().trim();

  var ss    = SpreadsheetApp.openById(PLANILHA_ID);
  var sheet = ss.getSheetByName("LOG_SISTEMA");
  if (!sheet || sheet.getLastRow() < 2) return { erro: true, mensagem: "Nenhum registro encontrado no LOG." };

  var dados     = sheet.getDataRange().getValues();
  var cabecalho = ["Data/Hora","Usuário","Número","Tipo","Escola","CNPJ","Email Destino","Código"];
  var linhas    = [];

  for (var i = 1; i < dados.length; i++) {
    var dataHora = dados[i][0] ? new Date(dados[i][0]) : null;
    var usuario  = String(dados[i][1] || "").toLowerCase();
    var tipo     = String(dados[i][3] || "").toLowerCase();
    var escola   = String(dados[i][4] || "").toLowerCase();

    if (dataInicio   && (!dataHora || dataHora < dataInicio))    continue;
    if (dataFim      && (!dataHora || dataHora > dataFim))       continue;
    if (usuarioFiltro && usuario.indexOf(usuarioFiltro) === -1)  continue;
    if (tipoFiltro    && tipo.indexOf(tipoFiltro)       === -1)  continue;
    if (escolaFiltro  && escola.indexOf(escolaFiltro)   === -1)  continue;

    linhas.push([
      dataHora ? formatarDataHoraBRSegundos_(dataHora) : "",
      usuario,
      dados[i][2] || "",
      tipo,
      escola,
      dados[i][5] || "",
      dados[i][6] || "",
      dados[i][7] || ""
    ]);
  }

  if (!linhas.length) return { erro: true, mensagem: "Nenhum registro encontrado com os filtros aplicados." };

  var nomeArquivo  = "Auditoria_LOG_" + new Date().getTime();
  var planilhaTemp = SpreadsheetApp.create(nomeArquivo);
  var aba          = planilhaTemp.getActiveSheet();
  aba.appendRow(cabecalho);
  aba.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  aba.autoResizeColumns(1, cabecalho.length);

  return exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao);
}

/* ── listarEscolasOficios ── */
function listarEscolasOficios() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("Escolas")
          || ss.getSheetByName("ESCOLAS")
          || ss.getSheetByName("escolas");
  if (!sh) throw new Error("Aba de escolas não encontrada.");

  var h      = getHeaderMap_(sh);
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  var colNome    = h["NomeEscola"]    || h["Escola (Razão Social)"] || h["Escola"] || 2;
  var colCnpj    = h["CNPJ"]          || 3;
  var colEmail   = h["Email"]         || h["E-mail (principal)"]    || 4;
  var colUnidade = h["CodigoInterno"] || h["Unidade"]               || 1;

  return values.slice(1)
    .filter(function(row) { return String(row[colNome - 1] || "").trim() !== ""; })
    .map(function(row) {
      var unidade = String(row[colUnidade - 1] || "").trim();
      var escola  = String(row[colNome    - 1] || "").trim();
      var cnpj    = String(row[colCnpj    - 1] || "").trim();
      var email   = String(row[colEmail   - 1] || "").trim();
      return {
        id: unidade || cnpj || escola, unidade: unidade,
        nome: escola, escola: escola, razao: escola, razaoSocial: escola,
        cnpj: cnpj, email: email, emailPrincipal: email,
        emails: email ? [email] : [],
        cidade: "", uf: "", endereco: "", status: "Ativa",
        oficios: 0, confirmados: 0, ultimo: "—"
      };
    })
    .sort(function(a, b) {
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
}

/* ── salvarEscolaOficio — helpers ── */
function colunaEscolaOficio_(headerMap, nomes) {
  for (var i = 0; i < nomes.length; i++) {
    if (headerMap[nomes[i]]) return headerMap[nomes[i]];
  }
  return 0;
}

function digitosEscolaOficio_(valor) {
  return String(valor == null ? "" : valor).replace(/\D/g, "");
}

function normalizarTextoEscolaOficio_(valor) {
  return String(valor == null ? "" : valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatarCnpjEscolaOficio_(valor) {
  var d = digitosEscolaOficio_(valor).slice(0, 14);
  if (d.length !== 14) return String(valor == null ? "" : valor).trim();
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Junta e-mails vindos de várias origens (array, string "a; b", célula da
 * planilha) em uma única lista sem duplicidades, preservando a ordem.
 */
function listaEmailsEscolaOficio_(origens) {
  return [].concat(origens || [])
    .reduce(function(acc, item) {
      if (Array.isArray(item)) return acc.concat(item);
      return acc.concat(String(item == null ? "" : item).split(/[\n,;]+/));
    }, [])
    .map(function(email) { return String(email || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(email) { return email.indexOf("@") > 0; })
    .filter(function(email, i, arr) { return arr.indexOf(email) === i; });
}

/* ── salvarEscolaOficio ── */
function salvarEscolaOficio(dados, tokenSessao) {
  // Manter os contatos da escola faz parte da rotina de quem emite ofício,
  // então basta sessão válida no módulo — não é ação restrita a administrador.
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  dados = dados || {};

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("Escolas")
          || ss.getSheetByName("ESCOLAS")
          || ss.getSheetByName("escolas");
  if (!sh) throw new Error("Aba Escolas não encontrada.");

  var cnpjDigitos = digitosEscolaOficio_(dados.cnpj);
  var unidade     = String(dados.unidade || dados.codigoInterno || "").trim();
  var nome        = String(dados.nome || dados.razaoSocial || dados.razao || "").trim();

  // Correção de CNPJ: cnpjAtual é a chave de busca e cnpj o valor a gravar.
  // Sem isso, corrigir o número criaria uma escola nova em vez de atualizar.
  var cnpjBusca = digitosEscolaOficio_(dados.cnpjAtual) || cnpjDigitos;

  if (!cnpjDigitos && !unidade && !nome) {
    throw new Error("Informe unidade, CNPJ ou nome para salvar a escola.");
  }

  var h = getHeaderMap_(sh);
  var colUnidade  = colunaEscolaOficio_(h, ["Unidade", "CodigoInterno", "Código Interno", "Codigo Interno"]);
  var colNome     = colunaEscolaOficio_(h, ["Escola (Razão Social)", "NomeEscola", "Escola", "Razão Social", "Razao Social"]);
  var colCnpj     = colunaEscolaOficio_(h, ["CNPJ", "Cnpj", "cnpj"]);
  var colEmail    = colunaEscolaOficio_(h, ["E-mail (principal)", "Email", "E-mail", "EmailPrincipal", "Email Principal"]);
  var colEmails   = colunaEscolaOficio_(h, ["E-mails (todos)", "EmailsTodos", "E-mails", "Emails", "E-mails adicionais"]);
  var colCidade   = colunaEscolaOficio_(h, ["Cidade", "Municipio", "Município"]);
  var colUf       = colunaEscolaOficio_(h, ["UF", "Uf", "Estado"]);
  var colEndereco = colunaEscolaOficio_(h, ["Endereço", "Endereco", "EnderecoCompleto"]);

  if (!colNome && !colCnpj) {
    throw new Error("Cabeçalho da aba Escolas não possui as colunas de nome/CNPJ.");
  }

  // Cidade / UF podem chegar juntos no formato "Vitória / ES".
  var cidade = String(dados.cidade || dados.municipio || "").trim();
  var uf     = String(dados.uf || "").trim().toUpperCase();
  var cidadeUf = String(dados.cidadeUf || "").trim();
  if (cidadeUf) {
    var partes = cidadeUf.split("/");
    if (!cidade) cidade = String(partes[0] || "").trim();
    if (!uf && partes.length > 1) uf = String(partes[partes.length - 1] || "").trim().toUpperCase();
  }

  var emailPrincipal = String(dados.email || dados.emailPrincipal || "").trim().toLowerCase();
  var endereco       = String(dados.endereco || "").trim();

  var totalCols = sh.getLastColumn();
  var values    = sh.getDataRange().getValues();

  // Localiza a linha: 1º por CNPJ (somente dígitos), 2º por unidade,
  // 3º por nome normalizado — evita duplicar a escola quando a formatação
  // do CNPJ na planilha difere da enviada pela tela.
  var linhaEncontrada = -1;
  var linhaPorUnidade = -1;
  var linhaPorNome    = -1;
  var nomeNormalizado = normalizarTextoEscolaOficio_(nome);

  for (var i = 1; i < values.length; i++) {
    if (cnpjBusca && colCnpj) {
      var cnpjLinha = digitosEscolaOficio_(values[i][colCnpj - 1]);
      if (cnpjLinha && cnpjLinha === cnpjBusca) { linhaEncontrada = i + 1; break; }
    }
    if (linhaPorUnidade === -1 && unidade && colUnidade) {
      var unidadeLinha = String(values[i][colUnidade - 1] || "").trim();
      if (unidadeLinha && unidadeLinha === unidade) linhaPorUnidade = i + 1;
    }
    if (linhaPorNome === -1 && nomeNormalizado && colNome) {
      var nomeLinha = normalizarTextoEscolaOficio_(values[i][colNome - 1]);
      if (nomeLinha && nomeLinha === nomeNormalizado) linhaPorNome = i + 1;
    }
  }

  if (linhaEncontrada === -1) linhaEncontrada = linhaPorUnidade;
  if (linhaEncontrada === -1) linhaEncontrada = linhaPorNome;

  var criouLinha = linhaEncontrada === -1;
  var linhaValores = criouLinha
    ? new Array(totalCols).fill("")
    : sh.getRange(linhaEncontrada, 1, 1, totalCols).getValues()[0];

  // Só grava o que veio preenchido: campos vazios preservam o cadastro atual.
  function gravar(col, valor) {
    if (!col) return;
    if (valor === "" || valor === null || valor === undefined) return;
    linhaValores[col - 1] = valor;
  }

  gravar(colUnidade, unidade);
  gravar(colNome, nome);
  gravar(colCnpj, cnpjDigitos ? formatarCnpjEscolaOficio_(cnpjDigitos) : "");
  gravar(colEmail, emailPrincipal);
  gravar(colCidade, cidade);
  gravar(colUf, uf);
  gravar(colEndereco, endereco);

  // E-mails: por padrão mescla com o que já está na planilha. Quando a tela
  // gerencia a lista inteira (modal de envio, onde dá para excluir contatos),
  // substituirEmails=true faz a lista enviada valer como está.
  var substituir = dados.substituirEmails === true;
  var emailsInformados = listaEmailsEscolaOficio_([
    emailPrincipal,
    dados.emails || [],
    dados.emailsTodos || ""
  ]);
  var emailsFinais = substituir
    ? emailsInformados
    : listaEmailsEscolaOficio_([
        colEmails ? linhaValores[colEmails - 1] : "",
        colEmail ? linhaValores[colEmail - 1] : "",
        emailsInformados
      ]);

  if (substituir && !emailsFinais.length) {
    throw new Error("Informe pelo menos um e-mail para a escola.");
  }

  if (colEmails && emailsFinais.length) {
    linhaValores[colEmails - 1] = emailsFinais.join(", ");
  }
  if (colEmail && !String(linhaValores[colEmail - 1] || "").trim() && emailsFinais.length) {
    linhaValores[colEmail - 1] = emailsFinais[0];
  }

  if (criouLinha) {
    sh.appendRow(linhaValores);
    linhaEncontrada = sh.getLastRow();
  } else {
    sh.getRange(linhaEncontrada, 1, 1, totalCols).setValues([linhaValores]);
  }

  SpreadsheetApp.flush();
  try {
    if (typeof invalidarCacheEscolasInterno_ === "function") invalidarCacheEscolasInterno_();
    else if (typeof invalidarCacheEscolas_ === "function") invalidarCacheEscolas_();
  } catch (e) {
    Logger.log("salvarEscolaOficio: falha ao invalidar cache de escolas — " + e.message);
  }

  return {
    ok: true,
    mensagem: criouLinha ? "Escola cadastrada com sucesso." : "Escola atualizada com sucesso.",
    criada: criouLinha,
    linha: linhaEncontrada,
    escola: {
      // Sem "id" próprio: o front deriva a chave do CNPJ, igual ao que
      // listarEscolasCadastro() devolve. Mandar a Unidade aqui criaria uma
      // entrada duplicada no cache da tela.
      unidade: colUnidade ? String(linhaValores[colUnidade - 1] || "") : "",
      nome: colNome ? String(linhaValores[colNome - 1] || "") : nome,
      razaoSocial: colNome ? String(linhaValores[colNome - 1] || "") : nome,
      cnpj: colCnpj ? String(linhaValores[colCnpj - 1] || "") : "",
      email: colEmail ? String(linhaValores[colEmail - 1] || "") : emailPrincipal,
      emailPrincipal: colEmail ? String(linhaValores[colEmail - 1] || "") : emailPrincipal,
      emails: emailsFinais,
      emailsTodos: emailsFinais.join(", "),
      cidade: colCidade ? String(linhaValores[colCidade - 1] || "") : cidade,
      uf: colUf ? String(linhaValores[colUf - 1] || "") : uf,
      endereco: colEndereco ? String(linhaValores[colEndereco - 1] || "") : endereco
    }
  };
}

/* ── exportarPlanilhaTemporaria_ ── */
function exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao) {
  try {
    var idTemp = planilhaTemp.getId();
    var formato = tipoExportacao === "csv" ? "csv" : "xlsx";
    var url  = "https://docs.google.com/spreadsheets/d/" + idTemp + "/export?format=" + formato + "&id=" + idTemp;
    var blob = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(nomeArquivo + "." + formato);

    var arquivo = DriveApp.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    try { DriveApp.getFileById(idTemp).setTrashed(true); } catch(e) {}

    return {
      ok:            true,
      link:          "https://drive.google.com/uc?export=download&id=" + arquivo.getId(),
      linkVisualizar:"https://drive.google.com/file/d/" + arquivo.getId() + "/view",
      fileId:        arquivo.getId(),
      nome:          arquivo.getName(),
      mensagem:      "Relatório gerado com sucesso."
    };

  } catch (e) {
    try { DriveApp.getFileById(planilhaTemp.getId()).setTrashed(true); } catch(e2) {}
    Logger.log("❌ exportarPlanilhaTemporaria_: " + e.message);
    return { erro: true, mensagem: "Erro ao exportar relatório: " + e.message };
  }
}

/* ── registrarOficioGerado ── */
function registrarOficioGerado(payload, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  payload = payload || {};

  var escola        = payload.escola || {};
  var beneficiarios = Array.isArray(payload.beneficiarios) ? payload.beneficiarios : [];

  var registro = {
    numeroOficio:  String(payload.numeroOficio || "").trim(),
    tipo:          String(payload.tipo         || "").trim(),
    escola:        String(escola.nome || escola.razaoSocial || "").trim(),
    cnpj:          String(escola.cnpj  || "").trim(),
    email:         String(escola.email || "").trim(),
    beneficiarios: beneficiarios.map(function(b){ return String(b.nome || "").trim(); }).filter(Boolean).join(", "),
    cpfs:          beneficiarios.map(function(b){ return String(b.cpf  || "").trim(); }).filter(Boolean).join(", "),
    fichas:        Array.isArray(payload.fichas)
      ? payload.fichas.map(function(f){ return String(f.arquivoSugerido || f.arquivoOriginal || "").trim(); }).filter(Boolean).join(", ")
      : "",
    dataRegistro: new Date(),
    usuario: String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase()
  };

  if (typeof logSistema === "function") logSistema("INFO", "Ofícios", "Ofício gerado registrado", registro);

  return { ok: true, registro: registro };
}