// ==========================================================
// ARQUIVO: Escolas.gs
// ✅ Mapeamento corrigido para o cabeçalho REAL da planilha
// ✅ Colunas existentes preservadas na posição original
// ✅ 6 colunas novas adicionadas ao final pelo inicializar()
// ✅ Colunas de sincronização (STATUS_SINCRO, OBS_SINCRO,
//    ULTIMA_VERIFICACAO, etc.) intocadas
// ==========================================================

const ABA_ESCOLAS = "Escolas";

// Nomes REAIS das colunas na planilha (usados em getHeaderMapEscolas_)
const COL_UNIDADE           = "Unidade";
const COL_NOME_ESCOLA       = "Escola (Razão Social)";
const COL_CNPJ              = "CNPJ";
const COL_EMAIL             = "E-mail (principal)";
const COL_EMAILS_TODOS      = "E-mails (todos)";
const COL_TELEFONE          = "Telefone 1";
const COL_WHATSAPP          = "Telefone 2";
const COL_CIDADE            = "Cidade";
const COL_ENDERECO          = "Endereço";
const COL_NUMERO            = "Número";
const COL_BAIRRO            = "Bairro";
const COL_COMPLEMENTO       = "Complemento";
const COL_UF                = "UF";
const COL_CEP               = "CEP";
const COL_FANTASIA          = "NOME_FANTASIA";
const COL_SITUACAO          = "SITUACAO_CADASTRAL";
// Novas colunas (adicionadas ao final pela inicialização)
const COL_REDE              = "Rede";
const COL_RESPONSAVEL       = "Responsavel";
const COL_CARGO             = "CargoResponsavel";
const COL_OBSERVACOES       = "Observacoes";
const COL_DATA_CADASTRO     = "DataCadastro";
const COL_USUARIO_CADASTRO  = "UsuarioCadastro";

// Colunas novas que devem ser criadas se não existirem
const COLUNAS_NOVAS_ESCOLAS = [
  COL_REDE, COL_RESPONSAVEL, COL_CARGO,
  COL_OBSERVACOES, COL_DATA_CADASTRO, COL_USUARIO_CADASTRO
];

/* =============================================================== */
/* INICIALIZAÇÃO — adiciona colunas novas sem tocar nas existentes  */
/* =============================================================== */
function inicializarModuloEscolas() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  let sh = ss.getSheetByName(ABA_ESCOLAS);
  if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada. Crie-a primeiro." };

  const headersAtuais = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });

  let adicionadas = 0;
  COLUNAS_NOVAS_ESCOLAS.forEach(function(col) {
    if (headersAtuais.indexOf(col) === -1) {
      const novaCol = sh.getLastColumn() + 1;
      sh.getRange(1, novaCol).setValue(col).setFontWeight("bold");
      headersAtuais.push(col);
      adicionadas++;
    }
  });

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, sh.getLastColumn()); } catch(e) {}

  return {
    ok: true,
    mensagem: "Módulo inicializado. " +
      (adicionadas > 0 ? adicionadas + " coluna(s) nova(s) adicionada(s)." : "Nenhuma coluna nova necessária.")
  };
}

/* =============================================================== */
/* HELPERS INTERNOS                                                 */
/* =============================================================== */
function agoraFormatadoEscolas_() {
  if (typeof agoraFormatado_ === "function") return agoraFormatado_();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function normalizarEmailsEscolas_(valor) {
  return String(valor || "").split(/[\n,;]+/)
    .map(function(e) { return String(e || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(e, i, arr) { return arr.indexOf(e) === i; })
    .join(", ");
}

function getHeaderMapEscolas_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(nome, idx) { map[String(nome || "").trim()] = idx + 1; });
  return map;
}

function onlyDigitsEscolas_(v) { return String(v || "").replace(/\D/g, ""); }

function normEscolas_(v) {
  return String(v || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function formatarCNPJEscolas_(cnpj) {
  const d = onlyDigitsEscolas_(cnpj).slice(0, 14);
  if (d.length !== 14) return d;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function validarDigitosCnpj_(cnpj) {
  const c = onlyDigitsEscolas_(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  function calc(v, n) {
    let soma = 0, pos = n - 7;
    for (let i = 0; i < n; i++) { soma += parseInt(v[i], 10) * pos--; if (pos < 2) pos = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  }
  return calc(c, 12) === parseInt(c[12], 10) && calc(c, 13) === parseInt(c[13], 10);
}

function setIfColEscola_(sh, rowNum, hMap, colNomeReal, valor) {
  const colIdx = hMap[colNomeReal];
  if (colIdx) {
    sh.getRange(rowNum, colIdx).setValue(valor !== undefined && valor !== null ? valor : "");
  } else {
    Logger.log("setIfColEscola_: coluna '" + colNomeReal + "' nao encontrada no cabecalho da planilha.");
  }
}

function invalidarCacheEscolasInterno_() {
  try { invalidarCacheEscolas_(); } catch(e) {
    try { CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch(e2) {}
  }
  try { CacheService.getScriptCache().remove(CACHE_KEY_ESCOLAS_CADASTRO_); } catch(e3) {}
}

/* =============================================================== */
/* CADASTRAR / ATUALIZAR ESCOLA                                     */
/* =============================================================== */
function cadastrarEscola(dados, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    const nome      = String(dados.nomeEscola || dados.escola || dados.razaoSocial || "").trim();
    const fantasia  = String(dados.fantasia || dados.nomeFantasia || "").trim();
    const cnpjRaw   = onlyDigitsEscolas_(dados.cnpj);
    const municipio = String(dados.municipio || dados.cidade || "").trim();
    const uf        = String(dados.uf || "").trim().toUpperCase();
    const email     = String(dados.email || "").trim();
    const emailTodos = normalizarEmailsEscolas_([dados.emailsTodos || "", email].join(", "));

    if (!nome) return { ok: false, mensagem: "Informe o nome da escola." };
    if (cnpjRaw && !validarDigitosCnpj_(cnpjRaw)) {
      return { ok: false, mensagem: "CNPJ inválido — dígito verificador incorreto." };
    }

    const agora = agoraFormatadoEscolas_();
    let usuario = "Sistema";
    try { usuario = Session.getActiveUser().getEmail() || "Sistema"; } catch(e) {}

    const hMap    = getHeaderMapEscolas_(sh);
    const lastRow = sh.getLastRow();
    const colCnpj = hMap[COL_CNPJ];
    const colNome = hMap[COL_NOME_ESCOLA];
    const colMun  = hMap[COL_CIDADE];
    const colUf   = hMap[COL_UF];

    // Busca linha existente
    if (lastRow >= 2 && (colCnpj || colNome)) {
      const numCols = sh.getLastColumn();
      const linhas  = sh.getRange(2, 1, lastRow - 1, numCols).getValues();
      const chaveAtual = normEscolas_(nome) + "||" + normEscolas_(municipio) + "||" + normEscolas_(uf);

      for (let i = 0; i < linhas.length; i++) {
        const rowNum         = i + 2;
        const cnpjExistente  = colCnpj ? onlyDigitsEscolas_(linhas[i][colCnpj - 1]) : "";
        const nomeExistente  = colNome ? String(linhas[i][colNome - 1] || "").trim() : "";
        const munExistente   = colMun  ? String(linhas[i][colMun  - 1] || "").trim() : "";
        const ufExistente    = colUf   ? String(linhas[i][colUf   - 1] || "").trim().toUpperCase() : "";
        const chaveExistente = normEscolas_(nomeExistente) + "||" + normEscolas_(munExistente) + "||" + normEscolas_(ufExistente);

        const encontrou = (cnpjRaw && cnpjExistente && cnpjRaw === cnpjExistente) ||
          (!cnpjRaw && !cnpjExistente && chaveAtual === chaveExistente);

        if (!encontrou) continue;

        // Atualiza campos nos nomes REAIS das colunas
        setIfColEscola_(sh, rowNum, hMap, COL_NOME_ESCOLA,  nome);
        setIfColEscola_(sh, rowNum, hMap, COL_FANTASIA,     fantasia);
        setIfColEscola_(sh, rowNum, hMap, COL_CNPJ,         cnpjRaw ? formatarCNPJEscolas_(cnpjRaw) : "");
        setIfColEscola_(sh, rowNum, hMap, COL_UNIDADE,      String(dados.codigoInterno || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_REDE,         String(dados.rede || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_CIDADE,       municipio);
        setIfColEscola_(sh, rowNum, hMap, COL_UF,           uf);
        setIfColEscola_(sh, rowNum, hMap, COL_ENDERECO,     String(dados.endereco || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_NUMERO,       String(dados.numero || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_COMPLEMENTO,  String(dados.complemento || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_BAIRRO,       String(dados.bairro || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_CEP,          String(dados.cep || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_TELEFONE,     String(dados.telefone || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_WHATSAPP,     String(dados.whatsapp || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_EMAIL,        email);
        setIfColEscola_(sh, rowNum, hMap, COL_EMAILS_TODOS, emailTodos);
        setIfColEscola_(sh, rowNum, hMap, COL_RESPONSAVEL,  String(dados.responsavel || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_CARGO,        String(dados.cargoResponsavel || "").trim());
        setIfColEscola_(sh, rowNum, hMap, COL_SITUACAO,     String(dados.situacao || "ATIVA").trim().toUpperCase());
        setIfColEscola_(sh, rowNum, hMap, COL_OBSERVACOES,  String(dados.observacoes || "").trim());

        SpreadsheetApp.flush();
        invalidarCacheEscolasInterno_();
        return { ok: true, mensagem: "Cadastro da escola atualizado com sucesso.", atualizado: true };
      }
    }

    // Insere nova linha
    // Monta a linha respeitando a posição REAL das colunas existentes
    const numCols  = sh.getLastColumn();
    const novaLinha = new Array(numCols).fill("");

    function setCol(colNome, valor) {
      const idx = hMap[colNome];
      if (idx) novaLinha[idx - 1] = valor !== undefined && valor !== null ? valor : "";
    }

    setCol(COL_NOME_ESCOLA,     nome);
    setCol(COL_FANTASIA,        fantasia);
    setCol(COL_CNPJ,            cnpjRaw ? formatarCNPJEscolas_(cnpjRaw) : "");
    setCol(COL_UNIDADE,         String(dados.codigoInterno || "").trim());
    setCol(COL_REDE,            String(dados.rede || "").trim());
    setCol(COL_CIDADE,          municipio);
    setCol(COL_UF,              uf);
    setCol(COL_ENDERECO,        String(dados.endereco || "").trim());
    setCol(COL_NUMERO,          String(dados.numero || "").trim());
    setCol(COL_COMPLEMENTO,     String(dados.complemento || "").trim());
    setCol(COL_BAIRRO,          String(dados.bairro || "").trim());
    setCol(COL_CEP,             String(dados.cep || "").trim());
    setCol(COL_TELEFONE,        String(dados.telefone || "").trim());
    setCol(COL_WHATSAPP,        String(dados.whatsapp || "").trim());
    setCol(COL_EMAIL,           email);
    setCol(COL_EMAILS_TODOS,    emailTodos);
    setCol(COL_RESPONSAVEL,     String(dados.responsavel || "").trim());
    setCol(COL_CARGO,           String(dados.cargoResponsavel || "").trim());
    setCol(COL_SITUACAO,        String(dados.situacao || "ATIVA").trim().toUpperCase());
    setCol(COL_OBSERVACOES,     String(dados.observacoes || "").trim());
    setCol(COL_DATA_CADASTRO,   agora);
    setCol(COL_USUARIO_CADASTRO,usuario);

    sh.appendRow(novaLinha);
    SpreadsheetApp.flush();
    invalidarCacheEscolasInterno_();
    return { ok: true, mensagem: "Escola cadastrada com sucesso.", atualizado: false };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao cadastrar escola: " + e.message };
  }
}

/* =============================================================== */
/* LISTAR PARA O MÓDULO INTERNO                                     */
/* =============================================================== */
/** Exige sessão válida — usada diretamente por telas via google.script.run. */
function listarEscolas(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarEscolasCadastro_interno_();
}

/** Exige sessão válida — usada diretamente por telas via google.script.run. */
function listarEscolasCadastro(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarEscolasCadastro_interno_();
}

/**
 * Núcleo sem checagem de sessão, para uso interno de outras funções do
 * servidor que já validam a própria sessão (ou não têm sessão de usuário
 * disponível, como triggers automáticos) — nunca exponha esta função
 * diretamente a google.script.run.
 */
var CACHE_KEY_ESCOLAS_CADASTRO_ = "sisgep_escolas_cadastro_v1";
var CACHE_TTL_ESCOLAS_CADASTRO_ = 300; // 5 minutos — mesmo padrão de listarEscolasOficio_interno_

function listarEscolasCadastro_interno_() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY_ESCOLAS_CADASTRO_);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (eCache) { Logger.log("[listarEscolasCadastro] cache read: " + eCache); }
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh || sh.getLastRow() < 2) return [];
    const cab   = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var resultado = dados.map(function(linha) {
      const obj = {};
      cab.forEach(function(coluna, i) {
        obj[String(coluna || "").trim()] = linha[i] !== undefined ? linha[i] : "";
      });
      // Aliases para compatibilidade com o frontend
      obj.NomeEscola  = obj[COL_NOME_ESCOLA]  || "";
      obj.escola      = obj[COL_NOME_ESCOLA]  || "";
      obj.Fantasia    = obj[COL_FANTASIA]     || "";
      obj.CNPJ        = obj[COL_CNPJ]         || "";
      obj.cnpj        = obj[COL_CNPJ]         || "";
      obj.Email       = obj[COL_EMAIL]        || "";
      obj.email       = obj[COL_EMAIL]        || "";
      obj.EmailsTodos = obj[COL_EMAILS_TODOS] || "";
      obj.Municipio   = obj[COL_CIDADE]       || "";
      obj.municipio   = obj[COL_CIDADE]       || "";
      obj.cidade      = obj[COL_CIDADE]       || "";
      obj.UF          = obj[COL_UF]           || "";
      obj.uf          = obj[COL_UF]           || "";
      obj.Telefone    = obj[COL_TELEFONE]     || "";
      obj.telefone    = obj[COL_TELEFONE]     || "";
      obj.Whatsapp    = obj[COL_WHATSAPP]     || "";
      obj.Endereco    = obj[COL_ENDERECO]     || "";
      obj.Numero      = obj[COL_NUMERO]       || "";
      obj.Bairro      = obj[COL_BAIRRO]       || "";
      obj.Complemento = obj[COL_COMPLEMENTO]  || "";
      obj.CEP         = obj[COL_CEP]          || "";
      obj.Situacao    = obj[COL_SITUACAO]     || "ATIVA";
      obj.situacao    = obj[COL_SITUACAO]     || "ATIVA";
      obj.Responsavel = obj[COL_RESPONSAVEL]  || "";
      obj.CargoResponsavel = obj[COL_CARGO]   || "";
      obj.Observacoes = obj[COL_OBSERVACOES]  || "";
      obj.CodigoInterno = obj[COL_UNIDADE]    || "";
      obj.Rede        = obj[COL_REDE]         || "";
      return obj;
}).filter(function(item) {
      return !!String(item[COL_NOME_ESCOLA] || item.NomeEscola || "").trim();
    }).map(function(item) {
      return serializarParaCliente_(item);
    });

    try {
      var json = JSON.stringify(resultado);
      if (json.length < 95000) {
        cache.put(CACHE_KEY_ESCOLAS_CADASTRO_, json, CACHE_TTL_ESCOLAS_CADASTRO_);
      } else {
        Logger.log("[listarEscolasCadastro] lista muito grande para cache: " + json.length + " bytes");
      }
    } catch (ePut) { Logger.log("[listarEscolasCadastro] cache put: " + ePut); }

    return resultado;
  } catch(e) {
    Logger.log("listarEscolasCadastro erro: " + e.message);
    return [];
  }
}

/* =============================================================== */
/* AÇÕES EM MASSA                                                   */
/* =============================================================== */
function atualizarSituacaoEscolasEmLote(cnpjs, novaSituacao, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    if (!Array.isArray(cnpjs) || !cnpjs.length) {
      return { ok: false, mensagem: "Nenhum CNPJ informado para atualização em lote." };
    }
    const situacao = String(novaSituacao || "").trim().toUpperCase();
    if (["ATIVA", "INATIVA", "PENDENTE"].indexOf(situacao) === -1) {
      return { ok: false, mensagem: "Situação inválida: " + novaSituacao };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, atualizadas: 0, mensagem: "Nenhum registro na base." };

    const hMap    = getHeaderMapEscolas_(sh);
    const colCnpj = hMap[COL_CNPJ];
    const colSit  = hMap[COL_SITUACAO];
    if (!colCnpj) return { ok: false, mensagem: "Coluna '" + COL_CNPJ + "' não encontrada." };
    if (!colSit)  return { ok: false, mensagem: "Coluna '" + COL_SITUACAO + "' não encontrada." };

    const alvo = {};
    cnpjs.forEach(function(c) { alvo[onlyDigitsEscolas_(c)] = true; });

    const dadosCnpj = sh.getRange(2, colCnpj, lastRow - 1, 1).getValues();
    let atualizadas = 0;

    for (let i = 0; i < dadosCnpj.length; i++) {
      const cnpjLinha = onlyDigitsEscolas_(dadosCnpj[i][0]);
      if (!cnpjLinha || !alvo[cnpjLinha]) continue;
      sh.getRange(i + 2, colSit).setValue(situacao);
      atualizadas++;
    }

    if (atualizadas > 0) { SpreadsheetApp.flush(); invalidarCacheEscolasInterno_(); }

    return {
      ok: true,
      atualizadas: atualizadas,
      mensagem: atualizadas + " escola(s) atualizada(s) para " + situacao + "."
    };
  } catch(e) {
    return { ok: false, mensagem: "Erro ao atualizar situação em lote: " + e.message };
  }
}

function excluirEscolasEmLote(cnpjs, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    if (!Array.isArray(cnpjs) || !cnpjs.length) {
      return { ok: false, mensagem: "Nenhum CNPJ informado para exclusão em lote." };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, excluidas: 0, mensagem: "Nenhum registro na base." };

    // Backup automático antes de excluir
    const dadosCompletos = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
    const nomeBackup = "BACKUP_ESCOLAS_EXCLUSAO_" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const shBackup = ss.insertSheet(nomeBackup);
    shBackup.getRange(1, 1, dadosCompletos.length, dadosCompletos[0].length).setValues(dadosCompletos);
    shBackup.getRange(1, 1, 1, dadosCompletos[0].length).setFontWeight("bold");
    shBackup.setFrozenRows(1);

    const hMap    = getHeaderMapEscolas_(sh);
    const colCnpj = hMap[COL_CNPJ];
    if (!colCnpj) return { ok: false, mensagem: "Coluna '" + COL_CNPJ + "' não encontrada." };

    const alvo = {};
    cnpjs.forEach(function(c) { alvo[onlyDigitsEscolas_(c)] = true; });

    const dadosCnpj = sh.getRange(2, colCnpj, lastRow - 1, 1).getValues();
    const linhasParaExcluir = [];

    for (let i = 0; i < dadosCnpj.length; i++) {
      const cnpjLinha = onlyDigitsEscolas_(dadosCnpj[i][0]);
      if (cnpjLinha && alvo[cnpjLinha]) linhasParaExcluir.push(i + 2);
    }

    // Exclui de baixo para cima para não deslocar índices
    linhasParaExcluir.sort(function(a, b) { return b - a; });
    linhasParaExcluir.forEach(function(rowNum) { sh.deleteRow(rowNum); });

    if (linhasParaExcluir.length > 0) { SpreadsheetApp.flush(); invalidarCacheEscolasInterno_(); }

    return {
      ok: true,
      excluidas: linhasParaExcluir.length,
      backup: nomeBackup,
      mensagem: linhasParaExcluir.length + " escola(s) excluída(s). Backup: " + nomeBackup + "."
    };
  } catch(e) {
    return { ok: false, mensagem: "Erro ao excluir em lote: " + e.message };
  }
}

/* =============================================================== */
/* ANALISAR / REMOVER DUPLICADAS (mantidas do original)            */
/* =============================================================== */
function analisarEscolasDuplicadas(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) throw new Error("Aba '" + ABA_ESCOLAS + "' não encontrada.");

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok:true, duplicadas:0, grupos:0, detalhes:[], mensagem:"Nenhum registro para analisar." };

    function od_(v)        { return String(v||"").replace(/\D/g,""); }
    function n_(v)         { return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
    function score_(row)   { let s=0; row.forEach(function(c){ if(String(c||"").trim()) s++; }); return s; }

    const dados = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
    const cab   = dados[0].map(function(c){ return String(c||"").trim(); });
    const iNome = cab.indexOf(COL_NOME_ESCOLA);
    const iCnpj = cab.indexOf(COL_CNPJ);
    const iMun  = cab.indexOf(COL_CIDADE);
    const iUf   = cab.indexOf(COL_UF);

    if (iNome === -1) throw new Error("Coluna '" + COL_NOME_ESCOLA + "' não encontrada.");

    const map = {};
    for (let i = 1; i < dados.length; i++) {
      const row  = dados[i];
      const nome = String(row[iNome]||"").trim(); if (!nome) continue;
      const cnpj = iCnpj>-1 ? od_(row[iCnpj]) : "";
      const mun  = iMun >-1 ? String(row[iMun ]||"").trim() : "";
      const uf   = iUf  >-1 ? String(row[iUf  ]||"").trim().toUpperCase() : "";
      const k    = (cnpj&&cnpj.length>=14) ? "CNPJ::"+cnpj : "NOME::"+n_(nome)+"||"+n_(mun)+"||"+n_(uf);
      if (!map[k]) map[k]=[];
      map[k].push({ linhaPlanilha:i+1, nome, cnpj, municipio:mun, uf, score:score_(row) });
    }

    let duplicadas=0, grupos=0;
    const detalhes=[];
    Object.keys(map).forEach(function(k){
      const itens=map[k]; if(itens.length<=1) return;
      grupos++; duplicadas+=itens.length-1;
      itens.sort(function(a,b){ return b.score-a.score; });
      detalhes.push({ chave:k, quantidade:itens.length, manterLinha:itens[0].linhaPlanilha, manterNome:itens[0].nome, manterCnpj:itens[0].cnpj||"", itens });
    });

    return { ok:true, duplicadas, grupos, detalhes:detalhes.slice(0,50), mensagem:"Análise concluída." };
  } catch(e) {
    return { ok:false, duplicadas:0, grupos:0, detalhes:[], mensagem:"Erro ao analisar duplicadas: "+e.message };
  }
}

function removerEscolasDuplicadas(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) throw new Error("Aba '" + ABA_ESCOLAS + "' não encontrada.");

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok:true, removidas:0, mantidas:0, mensagem:"Nenhum registro para deduplicar." };

    function od_(v)        { return String(v||"").replace(/\D/g,""); }
    function n_(v)         { return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
    function mesclar_(base,extra){ const out=base.slice(); for(let i=0;i<out.length;i++){ if(!String(out[i]||"").trim()&&String(extra[i]||"").trim()) out[i]=extra[i]; } return out; }

    const dados = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
    const cab   = dados[0].map(function(c){ return String(c||"").trim(); });
    const iNome = cab.indexOf(COL_NOME_ESCOLA);
    const iCnpj = cab.indexOf(COL_CNPJ);
    const iMun  = cab.indexOf(COL_CIDADE);
    const iUf   = cab.indexOf(COL_UF);
    if (iNome===-1) throw new Error("Coluna '" + COL_NOME_ESCOLA + "' não encontrada.");

    // Backup automático
    const nomeBackup = "BACKUP_ESCOLAS_" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const shBackup = ss.insertSheet(nomeBackup);
    shBackup.getRange(1,1,dados.length,dados[0].length).setValues(dados);
    shBackup.getRange(1,1,1,dados[0].length).setFontWeight("bold");
    shBackup.setFrozenRows(1);

    const map = {};
    for (let i=1; i<dados.length; i++) {
      const row  = dados[i];
      const nome = String(row[iNome]||"").trim(); if (!nome) continue;
      const cnpj = iCnpj>-1 ? od_(row[iCnpj]) : "";
      const mun  = iMun >-1 ? String(row[iMun ]||"").trim() : "";
      const uf   = iUf  >-1 ? String(row[iUf  ]||"").trim().toUpperCase() : "";
      const k    = (cnpj&&cnpj.length>=14) ? "CNPJ::"+cnpj : "NOME::"+n_(nome)+"||"+n_(mun)+"||"+n_(uf);
      if (!map[k]) map[k]=[];
      map[k].push({ linhaPlanilha:i+1, row });
    }

    const mantidas=[dados[0]]; let removidas=0;
    Object.keys(map).forEach(function(k){
      const itens=map[k];
      if(itens.length===1){ mantidas.push(itens[0].row); return; }
      itens.sort(function(a,b){ return a.linhaPlanilha-b.linhaPlanilha; });
      let linhaFinal=itens[0].row.slice();
      for(let i=1;i<itens.length;i++) linhaFinal=mesclar_(linhaFinal,itens[i].row);
      mantidas.push(linhaFinal); removidas+=itens.length-1;
    });

    sh.clearContents(); sh.clearFormats();
    sh.getRange(1,1,mantidas.length,mantidas[0].length).setValues(mantidas);
    sh.getRange(1,1,1,mantidas[0].length).setFontWeight("bold");
    sh.setFrozenRows(1);
    try { sh.autoResizeColumns(1,sh.getLastColumn()); } catch(e) {}

    SpreadsheetApp.flush();
    invalidarCacheEscolasInterno_();
    return { ok:true, removidas, mantidas:mantidas.length-1, backup:nomeBackup, mensagem:"Deduplicação concluída." };
  } catch(e) {
    return { ok:false, removidas:0, mantidas:0, mensagem:"Erro ao remover duplicadas: "+e.message };
  }
}

/* =============================================================== */
/* ESTATÍSTICAS (usa nomes reais das colunas)                      */
/* =============================================================== */
function obterEstatisticasEscolas(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    const ss  = SpreadsheetApp.openById(PLANILHA_ID);
    const sh  = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh || sh.getLastRow() < 2) return { total:0, ativas:0, inativas:0, comCnpj:0, comEmail:0, semEmail:0 };

    const hMap = getHeaderMapEscolas_(sh);
    const colNome  = hMap[COL_NOME_ESCOLA];
    const colCnpj  = hMap[COL_CNPJ];
    const colEmail = hMap[COL_EMAIL];
    const colEmails= hMap[COL_EMAILS_TODOS];
    const colSit   = hMap[COL_SITUACAO];

    const dados = sh.getRange(2, 1, sh.getLastRow()-1, sh.getLastColumn()).getValues();
    let total=0, ativas=0, inativas=0, comCnpj=0, comEmail=0;

    dados.forEach(function(linha) {
      const nome = colNome ? String(linha[colNome-1]||"").trim() : "";
      const cnpj = colCnpj ? String(linha[colCnpj-1]||"").trim() : "";
      if (!nome && !cnpj) return;
      total++;
      if (cnpj) comCnpj++;
      const ep = colEmail  ? String(linha[colEmail -1]||"").trim() : "";
      const et = colEmails ? String(linha[colEmails-1]||"").trim() : "";
      if (ep || et) comEmail++;
      const sit = colSit ? String(linha[colSit-1]||"").trim().toUpperCase() : "";
      if (["BAIXADA","INATIVA","INAPTA","SUSPENSA","ENCERRADA"].indexOf(sit)>=0) inativas++;
      else ativas++;
    });

    return { total, ativas, inativas, comCnpj, comEmail, semEmail: Math.max(0, total-comEmail) };
  } catch(e) {
    return { total:0, ativas:0, inativas:0, comCnpj:0, comEmail:0, semEmail:0, erro:e.message };
  }
}

function resumoDashboardEscolas(tokenSessao) {
  const stats = obterEstatisticasEscolas(tokenSessao);
  return {
    total:    stats.total   || 0,
    comEmail: stats.comEmail|| 0,
    semEmail: Math.max(0, (stats.total||0) - (stats.comEmail||0)),
    comCnpj:  stats.comCnpj || 0,
    semCnpj:  Math.max(0, (stats.total||0) - (stats.comCnpj||0))
  };
}

/* =============================================================== */
/* IMPORTAR DE ABA / SINCRONIZAR / CONSULTAR CNPJ                  */
/* (mantidos do Escolas.gs original, apenas ajustando nomes das    */
/*  colunas nos pontos onde referenciavam os nomes antigos)        */
/* =============================================================== */
function importarEscolasDeAba(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    const ss        = SpreadsheetApp.openById(PLANILHA_ID);
    const abaOrigem = ss.getSheetByName("IMPORTACAO_ESCOLAS");
    const abaDest   = ss.getSheetByName(ABA_ESCOLAS);
    if (!abaOrigem) throw new Error("Aba IMPORTACAO_ESCOLAS não encontrada.");
    if (!abaDest)   throw new Error("Aba '" + ABA_ESCOLAS + "' não encontrada.");

    const dadosOrigem = abaOrigem.getDataRange().getValues();
    if (dadosOrigem.length < 2) return { importadas:0, atualizadas:0, puladas:0, total:0 };

    const cabOrigem = dadosOrigem[0].map(function(c){ return String(c||"").trim(); });
    function col(nome){ return cabOrigem.indexOf(nome); }
    function get(linha,idx){ return idx>-1 ? String(linha[idx]||"").trim() : ""; }

    const iRazao  = col("Escola (Razão Social)");
    const iCnpj   = col("CNPJ");
    const iCidade = col("Cidade");
    const iUF     = col("UF");
    if (iRazao===-1||iCnpj===-1) throw new Error("Colunas obrigatórias não encontradas na aba IMPORTACAO_ESCOLAS.");

    let importadas=0, atualizadas=0, puladas=0;
    for (let i=1; i<dadosOrigem.length; i++) {
      const r    = dadosOrigem[i];
      const nome = get(r,iRazao); if(!nome){ puladas++; continue; }
      const res  = cadastrarEscola({
        nomeEscola: nome,
        cnpj:       get(r,iCnpj),
        municipio:  get(r,iCidade),
        cidade:     get(r,iCidade),
        uf:         get(r,iUF),
        situacao:   "ATIVA"
      }, tokenSessao);
      if (res && res.ok) { if (res.atualizado) atualizadas++; else importadas++; }
      else puladas++;
    }

    invalidarCacheEscolasInterno_();
    return { importadas, atualizadas, puladas, total: dadosOrigem.length-1 };
  } catch(e) {
    Logger.log("importarEscolasDeAba erro: "+e.message); throw e;
  }
}

/** Exige sessão válida — usada diretamente pela tela de Cadastro de Escolas. */
function listarEscolasParaModulo(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarEscolasParaModulo_interno_();
}

function listarEscolasParaModulo_interno_() {
  try {
    function str(v) { return v instanceof Date ? "" : String(v || ""); }
    var lista = listarEscolasCadastro_interno_();
    return lista.map(function(item) {
      return {
        NomeEscola:    str(item.NomeEscola  || item.escola),
        escola:        str(item.escola      || item.NomeEscola),
        CNPJ:          str(item.CNPJ        || item.cnpj),
        cnpj:          str(item.cnpj        || item.CNPJ),
        Email:         str(item.Email       || item.email),
        email:         str(item.email       || item.Email),
        Municipio:     str(item.Municipio   || item.municipio || item.cidade),
        municipio:     str(item.municipio   || item.Municipio),
        cidade:        str(item.cidade      || item.Municipio),
        UF:            str(item.UF          || item.uf),
        uf:            str(item.uf          || item.UF),
        Situacao:      str(item.Situacao    || item.situacao) || "ATIVA",
        situacao:      str(item.situacao    || item.Situacao) || "ATIVA",
        Fantasia:      str(item.Fantasia    || item.fantasia),
        Telefone:      str(item.Telefone    || item.telefone),
        Responsavel:   str(item.Responsavel),
        CodigoInterno: str(item.CodigoInterno)
      };
    });
  } catch(e) {
    Logger.log("listarEscolasParaModulo erro: " + e.message);
    return [];
  }
}
/**
 * Envia e-mail em massa para escolas selecionadas, roteado pela camada
 * central de envio (EmailCore.gs) em vez de abrir o cliente de e-mail
 * pessoal do usuário (mailto:) — fica registrado em Log_Emails_Enviados
 * (quem enviou, para quem, quando, status), como qualquer outro envio do
 * SISGEP.
 */
function escolasEnviarEmailMassa(destinatarios, assunto, corpo, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var lista = (Array.isArray(destinatarios) ? destinatarios : []).filter(Boolean);
    if (!lista.length) return { ok: false, mensagem: "Nenhum destinatário informado." };

    assunto = String(assunto || "").trim();
    if (!assunto) return { ok: false, mensagem: "Informe o assunto." };

    corpo = String(corpo || "").trim();
    if (!corpo) return { ok: false, mensagem: "Informe o corpo do e-mail." };

    var resultado = enviarEmailSISGEP_(
      SIND_EMAIL_REMETENTE,
      assunto,
      corpo,
      { origem: "Escolas", bcc: lista.join(",") }
    );

    if (!resultado.ok) {
      return { ok: false, mensagem: resultado.mensagem || "Falha ao enviar o e-mail." };
    }
    return { ok: true, mensagem: "E-mail enviado para " + lista.length + " escola(s)." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar e-mail: " + e.message };
  }
}