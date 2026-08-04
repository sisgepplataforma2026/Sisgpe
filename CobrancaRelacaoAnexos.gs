// ================================
// ARQUIVO: CobrancaRelacaoAnexos.gs
// MÓDULO: Escolas — Cobrança de Relação Nominal — extração do anexo
//
// A maioria das escolas manda a relação nominal como ANEXO (xlsx/xls/csv/
// pdf), não no corpo do e-mail — por isso CobrancaRelacaoNominal.gs
// (rotina diária) só confere METADADOS do e-mail. Este arquivo abre de
// fato o anexo, sob comando explícito de um administrador, para extrair
// a lista de associados.
//
// MESMA REGRA DE OURO de IA_DocumentosSindicalizacao.gs (reaproveitada,
// não reinventada): "analisar" só LÊ o anexo e devolve uma lista para
// revisão — nada é gravado. "confirmar" só grava depois que um humano
// revisou/editou a lista na tela. Isso é ainda mais importante aqui do
// que nos outros fluxos de IA do sistema: a partir do momento em que o
// anexo é aberto, o SISGEP passa a tocar CPF/nome/cargo/salário de
// associados de verdade — dado pessoal sensível para fins da LGPD — e
// isso NUNCA é persistido sem um administrador confirmar.
//
// OCR (PDF/imagem) reaproveita docIA_ocrParaTexto_ (IA_DocumentosSindica
// lizacao.gs) e extração de JSON reaproveita docIA_extrairJSON_ do mesmo
// arquivo — não duplica a chamada à IA nem ao Drive OCR.
// ================================

var ABA_RELACAO_ASSOCIADOS = "RELACAO_NOMINAL_ASSOCIADOS";
var COB_FORMATOS_ANEXO_SUPORTADOS_ = /\.(xlsx|xls|csv|pdf)$/i;

/* =========================================
 * LOCALIZAÇÃO DO ANEXO NO GMAIL (acesso direto via GmailApp — não pelo
 * wrapper eiaBuscarEmailsGmail_, que só devolve metadados, sem Blob)
 * ========================================= */

function cob_localizarAnexoRelacao_(escola, competenciaYYYYMM) {
  var label = cob_competenciaLabel_(competenciaYYYYMM);
  var query = cob_montarQuery_(escola, label);
  var threads = GmailApp.search(query, 0, 10);
  var candidatos = [];

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      var anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [];
      anexos.forEach(function (anexo) {
        if (!COB_FORMATOS_ANEXO_SUPORTADOS_.test(anexo.getName())) return;
        candidatos.push({
          blob: anexo.copyBlob(),
          nomeArquivo: anexo.getName(),
          mimeType: anexo.getContentType(),
          assunto: msg.getSubject() || "",
          remetente: msg.getFrom() || "",
          dataStr: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
          dataTs: msg.getDate().getTime()
        });
      });
    });
  });

  if (!candidatos.length) return null;
  candidatos.sort(function (a, b) { return b.dataTs - a.dataTs; });
  return candidatos[0];
}

/* =========================================
 * LEITURA DO ANEXO POR FORMATO
 * ========================================= */

function cob_lerGridDePlanilhaAnexo_(blob) {
  var arq = Drive.Files.insert({ title: "TMP_COB_RELACAO_" + new Date().getTime() }, blob, { convert: true });
  try {
    if (!arq.id) throw new Error("O Drive não conseguiu converter a planilha.");
    var ss = SpreadsheetApp.openById(arq.id);
    return ss.getSheets()[0].getDataRange().getValues();
  } finally {
    try { DriveApp.getFileById(arq.id).setTrashed(true); } catch (eTrash) { /* silencioso */ }
  }
}

function cob_parseCsvAnexo_(blob) {
  try {
    return Utilities.parseCsv(blob.getDataAsString("UTF-8"));
  } catch (e) {
    return Utilities.parseCsv(blob.getDataAsString("ISO-8859-1"));
  }
}

function cob_gridParaTexto_(grid) {
  var limite = 500; // teto de linhas por chamada de IA — escolas reais têm dezenas, não milhares
  var linhas = grid.slice(0, limite).map(function (l) { return l.join(" | "); });
  var texto = linhas.join("\n");
  if (grid.length > limite) texto += "\n[...tabela truncada em " + limite + " linhas para processamento...]";
  return texto;
}

/**
 * Extrai a lista de associados de UM anexo já localizado. Não grava
 * nada — só lê e devolve. NUNCA inventa associado que não está no
 * anexo (reforçado no prompt da IA, igual aos outros fluxos do
 * sistema).
 */
function cob_extrairAssociadosDeAnexo_(anexo) {
  var mime = String(anexo.mimeType || "");
  var conteudo = "", contexto = "";

  if (mime === "text/csv" || /\.csv$/i.test(anexo.nomeArquivo)) {
    conteudo = cob_gridParaTexto_(cob_parseCsvAnexo_(anexo.blob));
    contexto = "O conteúdo abaixo é uma tabela CSV (colunas separadas por \" | \"), uma linha por pessoa.";
  } else if (/spreadsheetml|ms-excel/.test(mime) || /\.(xlsx|xls)$/i.test(anexo.nomeArquivo)) {
    conteudo = cob_gridParaTexto_(cob_lerGridDePlanilhaAnexo_(anexo.blob));
    contexto = "O conteúdo abaixo é uma planilha (colunas separadas por \" | \"), uma linha por pessoa.";
  } else if (mime === "application/pdf" || /^image\//.test(mime)) {
    var base64 = Utilities.base64Encode(anexo.blob.getBytes());
    conteudo = docIA_ocrParaTexto_(base64, anexo.nomeArquivo, mime);
    contexto = "O conteúdo abaixo foi extraído por OCR de um PDF/imagem — pode ter erros de leitura.";
  } else {
    return { sucesso: false, mensagem: "Formato de anexo não suportado para extração automática (" + mime + ")." };
  }

  if (!conteudo.trim()) return { sucesso: false, mensagem: "Não foi possível ler nenhum conteúdo no anexo." };

  var associados = cob_iaExtrairAssociadosDeTexto_(conteudo, contexto);
  return { sucesso: true, associados: associados };
}

function cob_iaExtrairAssociadosDeTexto_(conteudo, contexto) {
  var prompt = [
    "Você está lendo o conteúdo de uma \"relação nominal de associados\" enviada por uma escola",
    "conveniada ao SindEducação-ES, usada para conferência e emissão da guia sindical. " + contexto,
    "",
    "CONTEÚDO:",
    '"""',
    conteudo,
    '"""',
    "",
    "Extraia CADA associado/colaborador listado em um array JSON, com exatamente estas chaves",
    'por item (use "" quando não encontrar, NUNCA invente um valor que não está no conteúdo,',
    "NUNCA invente uma linha/pessoa que não aparece explicitamente):",
    "[",
    '  {"nome":"", "cpf":"", "matricula":"", "cargo":"", "salario":"", "admissao":""}',
    "]",
    "",
    "Regras:",
    '- "cpf": só dígitos, sem pontuação (deixe "" se não houver CPF na linha).',
    '- "salario": só números com ponto decimal, sem "R$" nem separador de milhar (ex: 1234.56).',
    '- "admissao": formato dd/mm/aaaa se identificar, senão "".',
    "- Ignore linhas de cabeçalho, totais, subtotais e rodapés — só pessoas reais.",
    "- Se não identificar nenhuma pessoa, responda com um array vazio [].",
    "- Responda APENAS com o array JSON, sem texto antes ou depois, sem markdown."
  ].join("\n");

  var arr = docIA_extrairJSON_(prompt);
  return Array.isArray(arr) ? arr : [];
}

/* =========================================
 * ANALISAR (só leitura, admin) — devolve a lista extraída para revisão
 * ========================================= */

function cob_analisarAnexoEscola_publico(tokenSessao, idLinha) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var sh = cob_garantirSheet_();
    var mapa = cob_mapaCabecalho_(sh);
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { sucesso: false, mensagem: "Nada cadastrado ainda." };

    var ids = sh.getRange(2, mapa["ID"], ultimaLinha - 1, 1).getValues();
    var numLinha = null;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(idLinha)) { numLinha = i + 2; break; }
    }
    if (!numLinha) return { sucesso: false, mensagem: "Registro não encontrado." };

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var linha = cob_linhaParaObjeto_(cab, sh.getRange(numLinha, 1, 1, sh.getLastColumn()).getValues()[0]);

    var anexo = cob_localizarAnexoRelacao_({ cnpj: linha.cnpj, nome: linha.nome }, linha.competencia);
    if (!anexo) {
      return { sucesso: false, mensagem: "Nenhum anexo compatível (xlsx/xls/csv/pdf) foi localizado no Gmail para esta escola/competência." };
    }

    var extraido = cob_extrairAssociadosDeAnexo_(anexo);
    if (!extraido.sucesso) return { sucesso: false, mensagem: extraido.mensagem };

    return {
      sucesso: true,
      idLinha: idLinha,
      escolaNome: linha.nome,
      assuntoOrigem: anexo.assunto,
      remetenteOrigem: anexo.remetente,
      dataOrigem: anexo.dataStr,
      nomeArquivo: anexo.nomeArquivo,
      associados: extraido.associados,
      aviso: extraido.associados.length ? "" : "A IA não identificou nenhuma linha de associado no anexo — confira manualmente antes de importar."
    };
  } catch (e) {
    Logger.log("[Cobrança] erro ao analisar anexo: " + e.message);
    return { sucesso: false, mensagem: "Erro ao analisar anexo: " + e.message };
  }
}

/* =========================================
 * PERSISTÊNCIA — só depois de revisão humana
 * ========================================= */

function cob_garantirSheetAssociados_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RELACAO_ASSOCIADOS);
  if (!sh) sh = ss.insertSheet(ABA_RELACAO_ASSOCIADOS);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "ESCOLA_CNPJ", "ESCOLA_NOME", "COMPETENCIA",
      "NOME", "CPF", "MATRICULA", "CARGO", "SALARIO", "ADMISSAO",
      "IMPORTADO_POR", "IMPORTADO_EM"
    ]);
    sh.getRange(1, 1, 1, 12).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Grava a lista JÁ REVISADA (e possivelmente corrigida) pelo
 * administrador na tela. Reimportar a mesma escola/competência
 * SUBSTITUI o lote anterior (não acumula duplicata) — é sempre o
 * retrato mais atual conferido, não um log de tentativas.
 */
function cob_confirmarImportacaoAssociados_publico(tokenSessao, idLinha, associados) {
  exigirSessaoDocumentos_(tokenSessao, true);
  if (!Array.isArray(associados) || !associados.length) return { ok: false, mensagem: "Nenhum associado para importar." };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var shCob = cob_garantirSheet_();
    var mapaCob = cob_mapaCabecalho_(shCob);
    var ultimaLinhaCob = shCob.getLastRow();
    var idsCob = ultimaLinhaCob > 1 ? shCob.getRange(2, mapaCob["ID"], ultimaLinhaCob - 1, 1).getValues() : [];
    var numLinhaCob = null;
    for (var i = 0; i < idsCob.length; i++) {
      if (String(idsCob[i][0]) === String(idLinha)) { numLinhaCob = i + 2; break; }
    }
    if (!numLinhaCob) return { ok: false, mensagem: "Registro de cobrança não encontrado." };

    var cabCob = shCob.getRange(1, 1, 1, shCob.getLastColumn()).getValues()[0];
    var linhaCob = cob_linhaParaObjeto_(cabCob, shCob.getRange(numLinhaCob, 1, 1, shCob.getLastColumn()).getValues()[0]);

    var shAss = cob_garantirSheetAssociados_();
    var mapaAss = cob_mapaCabecalho_(shAss);

    // Remove importação anterior da MESMA escola+competência antes de gravar a nova.
    var totalAss = shAss.getLastRow();
    if (totalAss > 1) {
      var dadosAss = shAss.getRange(2, 1, totalAss - 1, shAss.getLastColumn()).getValues();
      for (var r = dadosAss.length - 1; r >= 0; r--) {
        if (String(dadosAss[r][mapaAss["ESCOLA_CNPJ"] - 1]) === linhaCob.cnpj &&
          String(dadosAss[r][mapaAss["COMPETENCIA"] - 1]) === linhaCob.competencia) {
          shAss.deleteRow(r + 2);
        }
      }
    }

    var quem = Session.getActiveUser().getEmail() || "SISGEP (cobrança)";
    var agora = new Date();
    var importados = 0;

    associados.forEach(function (a) {
      var nome = String(a.nome || "").trim();
      if (!nome) return;
      var novaLinha = shAss.getLastRow() + 1;
      shAss.getRange(novaLinha, mapaAss["ID"]).setValue(cob_gerarId_());
      shAss.getRange(novaLinha, mapaAss["ESCOLA_CNPJ"]).setValue(linhaCob.cnpj);
      shAss.getRange(novaLinha, mapaAss["ESCOLA_NOME"]).setValue(linhaCob.nome);
      shAss.getRange(novaLinha, mapaAss["COMPETENCIA"]).setValue(linhaCob.competencia);
      shAss.getRange(novaLinha, mapaAss["NOME"]).setValue(nome);
      shAss.getRange(novaLinha, mapaAss["CPF"]).setValue(String(a.cpf || "").replace(/\D/g, ""));
      shAss.getRange(novaLinha, mapaAss["MATRICULA"]).setValue(String(a.matricula || ""));
      shAss.getRange(novaLinha, mapaAss["CARGO"]).setValue(String(a.cargo || ""));
      shAss.getRange(novaLinha, mapaAss["SALARIO"]).setValue(String(a.salario || ""));
      shAss.getRange(novaLinha, mapaAss["ADMISSAO"]).setValue(String(a.admissao || ""));
      shAss.getRange(novaLinha, mapaAss["IMPORTADO_POR"]).setValue(quem);
      shAss.getRange(novaLinha, mapaAss["IMPORTADO_EM"]).setValue(agora);
      importados++;
    });

    shCob.getRange(numLinhaCob, mapaCob["STATUS"]).setValue(COB_STATUS.RECEBIDA);
    shCob.getRange(numLinhaCob, mapaCob["DATA_RECEBIDA"]).setValue(agora);
    shCob.getRange(numLinhaCob, mapaCob["ATUALIZADO_POR"]).setValue(quem);
    shCob.getRange(numLinhaCob, mapaCob["ATUALIZADO_EM"]).setValue(agora);

    return { ok: true, importados: importados };
  } finally {
    lock.releaseLock();
  }
}

function cob_listarAssociadosImportados_publico(tokenSessao, cnpj, competencia) {
  exigirSessaoDocumentos_(tokenSessao, true);
  var sh = cob_garantirSheetAssociados_();
  var mapa = cob_mapaCabecalho_(sh);
  var total = sh.getLastRow();
  if (total < 2) return { ok: true, associados: [] };

  var dados = sh.getRange(2, 1, total - 1, sh.getLastColumn()).getValues();
  var lista = dados
    .filter(function (l) {
      return String(l[mapa["ESCOLA_CNPJ"] - 1]) === String(cnpj) && String(l[mapa["COMPETENCIA"] - 1]) === String(competencia);
    })
    .map(function (l) {
      return {
        nome: l[mapa["NOME"] - 1], cpf: l[mapa["CPF"] - 1], matricula: l[mapa["MATRICULA"] - 1],
        cargo: l[mapa["CARGO"] - 1], salario: l[mapa["SALARIO"] - 1], admissao: l[mapa["ADMISSAO"] - 1]
      };
    });
  return { ok: true, associados: lista };
}
