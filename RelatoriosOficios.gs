// ============================================================================
// ARQUIVO: RelatoriosOficios.gs
// Exportação de relatórios, auditoria e histórico de ofícios
// ============================================================================

/* ── Histórico — alias de compatibilidade ── */
function listarHistorico(filtros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  if (typeof listarHistoricoOficios === "function") {
    return listarHistoricoOficios(filtros || {}, tokenSessao);
  }
  return [];
}

/* ── Exportar Relatório de Ofícios ── */
function exportarRelatorio(filtros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
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

  /* Exportação na trilha (item 16.5). O relatório de ofícios não leva CPF —
   * as colunas são número, tipo, escola, CNPJ e data — por isso dadoPessoal
   * fica falso aqui. Marcar tudo como dado pessoal esvaziaria o alerta. */
  try {
    if (typeof aud_deExportacao_ === "function") {
      aud_deExportacao_({
        modulo: "Documentos", submodulo: "Relatórios de Ofícios",
        formato: tipoExportacao, total: linhas.length, dadoPessoal: false,
        filtros: { tipo: tipoFiltro, escola: escolaFiltro,
                   de: filtros.dataInicio || "", ate: filtros.dataFim || "" },
        sessao: sessaoDocumentos
      });
    }
  } catch (e) { Logger.log("[exportacao] ponte de auditoria falhou: " + e.message); }

  /* Exportar a auditoria é, ele próprio, ação auditada — senão a única ação
   * que não deixa rastro seria justamente levar o rastro embora. */
  try {
    if (typeof aud_deExportacao_ === "function") {
      aud_deExportacao_({
        modulo: "Auditoria e Compliance", submodulo: "Exportações",
        formato: tipoExportacao, total: linhas.length, dadoPessoal: false,
        filtros: { usuario: usuarioFiltro, tipo: tipoFiltro, escola: escolaFiltro,
                   de: filtros.dataInicio || "", ate: filtros.dataFim || "" },
        sessao: sessaoDocumentos
      });
    }
  } catch (e) { Logger.log("[exportacao] ponte de auditoria falhou: " + e.message); }

  return relOficios_exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao);
}

/* ── Exportar Auditoria (LOG_SISTEMA) ── */
function exportarAuditoriaLog(filtros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
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

  return relOficios_exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao);
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

/* ── salvarEscolaOficio ── */
function salvarEscolaOficio(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", true);
  dados = dados || {};

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("Escolas")
          || ss.getSheetByName("ESCOLAS")
          || ss.getSheetByName("escolas");
  if (!sh) throw new Error("Aba Escolas não encontrada.");

  var cnpj    = String(dados.cnpj              || "").trim();
  var unidade = String(dados.id || dados.unidade || "").trim();
  if (!cnpj && !unidade) throw new Error("Informe unidade ou CNPJ para salvar a escola.");

  var h      = getHeaderMap_(sh);
  var colCnpj    = h["CNPJ"]          || 3;
  var colUnidade = h["CodigoInterno"] || h["Unidade"] || 1;

  var values         = sh.getDataRange().getValues();
  var linhaEncontrada = -1;

  for (var i = 1; i < values.length; i++) {
    var unidadeLinha = String(values[i][colUnidade - 1] || "").trim();
    var cnpjLinha    = String(values[i][colCnpj    - 1] || "").trim();
    if ((cnpj && cnpjLinha === cnpj) || (unidade && unidadeLinha === unidade)) {
      linhaEncontrada = i + 1;
      break;
    }
  }

  var colNome  = h["NomeEscola"] || h["Escola (Razão Social)"] || h["Escola"] || 2;
  var colEmail = h["Email"]      || h["E-mail (principal)"]    || 4;

  function colunaEscola_(nomes) {
    for (var n = 0; n < nomes.length; n++) if (h[nomes[n]]) return h[nomes[n]];
    var desejados = nomes.map(function(nome) {
      return String(nome || "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    });
    var chaves = Object.keys(h);
    for (var c = 0; c < chaves.length; c++) {
      var normalizada = String(chaves[c] || "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      if (desejados.indexOf(normalizada) !== -1) return h[chaves[c]];
    }
    return 0;
  }

  var camposEndereco = [
    { col: colunaEscola_(["Endereço", "Endereco", "Logradouro"]), valor: dados.logradouro || dados.endereco || "" },
    { col: colunaEscola_(["Número", "Numero"]), valor: dados.numero || "" },
    { col: colunaEscola_(["Complemento"]), valor: dados.complemento || "" },
    { col: colunaEscola_(["Bairro"]), valor: dados.bairro || "" },
    { col: colunaEscola_(["Cidade", "Município", "Municipio"]), valor: dados.cidade || "" },
    { col: colunaEscola_(["UF", "Estado"]), valor: String(dados.uf || "").toUpperCase() },
    { col: colunaEscola_(["CEP"]), valor: dados.cep || "" }
  ];

  function aplicarEndereco_(linha) {
    camposEndereco.forEach(function(campo) {
      if (campo.col > 0) linha[campo.col - 1] = campo.valor;
    });
  }

  if (linhaEncontrada > -1) {
    var totalCols    = sh.getLastColumn();
    var valoresAtual = sh.getRange(linhaEncontrada, 1, 1, totalCols).getValues()[0];
    valoresAtual[colUnidade - 1] = unidade || dados.id || "";
    valoresAtual[colNome    - 1] = dados.nome || dados.razaoSocial || dados.razao || "";
    valoresAtual[colCnpj    - 1] = dados.cnpj || "";
    valoresAtual[colEmail   - 1] = dados.email || dados.emailPrincipal || "";
    aplicarEndereco_(valoresAtual);
    sh.getRange(linhaEncontrada, 1, 1, totalCols).setValues([valoresAtual]);
  } else {
    var novaLinha = new Array(sh.getLastColumn()).fill("");
    novaLinha[colUnidade - 1] = unidade || dados.id || "";
    novaLinha[colNome    - 1] = dados.nome || dados.razaoSocial || dados.razao || "";
    novaLinha[colCnpj    - 1] = dados.cnpj || "";
    novaLinha[colEmail   - 1] = dados.email || dados.emailPrincipal || "";
    aplicarEndereco_(novaLinha);
    sh.appendRow(novaLinha);
  }

  return {
    ok: true,
    mensagem: linhaEncontrada > -1 ? "Escola atualizada com sucesso." : "Escola cadastrada com sucesso.",
    linha:    linhaEncontrada > -1 ? linhaEncontrada : sh.getLastRow()
  };
}

/* ── relOficios_exportarPlanilhaTemporaria_ ── */
function relOficios_exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao) {
  try {
    var idTemp = planilhaTemp.getId();
    var formato = tipoExportacao === "csv" ? "csv" : "xlsx";
    var url  = "https://docs.google.com/spreadsheets/d/" + idTemp + "/export?format=" + formato + "&id=" + idTemp;
    var blob = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(nomeArquivo + "." + formato);

    var arquivo = DriveApp.createFile(blob);
    arquivoAplicarPolitica_(arquivo, "RelatoriosOficios.gs");

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
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
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
