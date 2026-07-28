// ============================================================================
// 📄 ARQUIVO: SistemaExportacao.gs
// 📤 Exportação de Relatórios, PDF/Excel e Estrutura de Abas
// ============================================================================

function obterPastaRelatorios_() { 
  return DriveApp.getFolderById(PASTAS.RELATORIOS); 
}

function moverArquivoParaPasta_(arquivoId, pastaDestinoId) { 
  const f = DriveApp.getFileById(arquivoId); 
  DriveApp.getFolderById(pastaDestinoId).addFile(f); 
  return f; 
}

function exportarPlanilhaTemporaria_(planilhaTemp, nomeArquivo, tipoExportacao) {
  const pasta = obterPastaRelatorios_(); 
  moverArquivoParaPasta_(planilhaTemp.getId(), pasta.getId());
  
  const token = ScriptApp.getOAuthToken(); 
  const tipo = String(tipoExportacao || "excel").toLowerCase();
  
  if (tipo === "pdf") {
    const blob = UrlFetchApp.fetch(
      "https://docs.google.com/spreadsheets/d/" + planilhaTemp.getId() + "/export?format=pdf&size=A4&portrait=true&fitw=true&gridlines=false", 
      { headers: { Authorization: "Bearer " + token } }
    ).getBlob().setName(nomeArquivo + ".pdf");
    
    const arquivo = pasta.createFile(blob); 
    try { DriveApp.getFileById(planilhaTemp.getId()).setTrashed(true); } catch(e){}
    return { erro: false, formato: "pdf", nome: arquivo.getName(), url: arquivo.getUrl() };
  }
  
  const blob = UrlFetchApp.fetch(
    "https://docs.google.com/spreadsheets/d/" + planilhaTemp.getId() + "/export?format=xlsx", 
    { headers: { Authorization: "Bearer " + token } }
  ).getBlob().setName(nomeArquivo + ".xlsx");
  
  const arquivo = pasta.createFile(blob); 
  try { DriveApp.getFileById(planilhaTemp.getId()).setTrashed(true); } catch(e){}
  return { erro: false, formato: "excel", nome: arquivo.getName(), url: arquivo.getUrl() };
}

function normalizarColaboradoresExportacao_(colaboradores) {
  if (!Array.isArray(colaboradores)) return [];
  return colaboradores.map(function(item) {
    if (typeof item === "string") return { nome: String(item||"").trim(), cpf: "", ficha: "" };
    return { 
      nome: String(item && (item.nome || item.colaborador) || "").trim(), 
      cpf: String(item && item.cpf || "").trim(), 
      ficha: String(item && (item.ficha || item.arquivo) || "").trim() 
    };
  }).filter(function(c){ return c.nome || c.cpf || c.ficha; })
    .map(function(c, i){ c.indice = i + 1; return c; });
}

function criarAbaAssociadosExportacao_(planilha, colaboradores, meta) {
  const aba = planilha.insertSheet("Associados");
  const cabecalho = [["Item","Nome","CPF","Ficha / Arquivo","Tipo do Ofício","Número do Ofício","Escola","CNPJ","Data"]];
  aba.getRange(1,1,1,cabecalho[0].length).setValues([cabecalho]).setFontWeight("bold");
  
  const linhas = (colaboradores || []).map(function(c, i){
    return [i+1, c.nome||"", c.cpf||"", c.ficha||"", meta.tipo||"", meta.numeroOficio||"", meta.escola||"", meta.cnpj||"", meta.data||""];
  });
  if (linhas.length) aba.getRange(2,1,linhas.length,cabecalho[0].length).setValues(linhas);
  aba.autoResizeColumns(1, cabecalho[0].length); 
  return aba;
}

function exportarAssociadosOficio(dados) {
  dados = dados || {}; 
  const formato = String(dados.formato || "excel").toLowerCase();
  const colaboradores = normalizarColaboradoresExportacao_(dados.colaboradores || []);
  if (!colaboradores.length) throw new Error("Nenhum associado informado.");
  
  const meta = { 
    tipo: dados.tipo || "", 
    numeroOficio: dados.numeroOficio || "", 
    escola: dados.escola || "", 
    cnpj: dados.cnpj || "", 
    data: dados.data || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") 
  };
  const nomeArquivo = "Associados - " + String(meta.escola || "Oficio").substring(0, 80);
  
  const planilha = SpreadsheetApp.create(nomeArquivo); 
  const aba = planilha.getActiveSheet(); 
  aba.setName("Associados");
  const cabecalho = [["Item","Nome","CPF","Ficha / Arquivo","Tipo do Ofício","Número do Ofício","Escola","CNPJ","Data"]];
  aba.getRange(1,1,1,cabecalho[0].length).setValues([cabecalho]).setFontWeight("bold");
  
  const linhas = colaboradores.map(function(c, i){
    return [i+1, c.nome||"", c.cpf||"", c.ficha||"", meta.tipo||"", meta.numeroOficio||"", meta.escola||"", meta.cnpj||"", meta.data||""];
  });
  if (linhas.length) aba.getRange(2,1,linhas.length,cabecalho[0].length).setValues(linhas);
  aba.autoResizeColumns(1, cabecalho[0].length); 
  
  return exportarPlanilhaTemporaria_(planilha, nomeArquivo, formato);
}

function exportarEscolaEAssociados(dados) {
  dados = dados || {}; 
  const formato = String(dados.formato || "excel").toLowerCase();
  const colaboradores = normalizarColaboradoresExportacao_(dados.colaboradores || []); 
  var escola = {};
  try { if (typeof obterDadosEscolaParaExportacao_ === "function") escola = obterDadosEscolaParaExportacao_(dados) || {}; } catch(e){}
  
  const meta = { 
    tipo: dados.tipo || "", 
    numeroOficio: dados.numeroOficio || "", 
    escola: escola.escola || dados.escola || "", 
    cnpj: escola.cnpj || dados.cnpj || "", 
    data: dados.data || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") 
  };
  const nomeArquivo = "Exportacao Completa - " + String(meta.escola || "Escola").substring(0, 80);
  
  const planilha = SpreadsheetApp.create(nomeArquivo);
  if (typeof criarAbaEscolaExportacao_ === "function" && Object.keys(escola).length) {
    criarAbaEscolaExportacao_(planilha, escola);
  }
  criarAbaAssociadosExportacao_(planilha, colaboradores, meta);
  return exportarPlanilhaTemporaria_(planilha, nomeArquivo, formato);
}