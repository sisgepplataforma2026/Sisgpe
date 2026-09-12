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

/* =============================================================== */
/* DOCUMENTO DA ESCOLA — CPF **OU** CNPJ                           */
/* =============================================================== */
/*
 * Nem toda escola é pessoa jurídica.
 *
 * Confirmado pelo usuário em 11/08/2026: "tem alguns colaboradores que pagam
 * pelo CPF e não CNPJ". A base tem pelo menos três — creches e escolas de
 * pessoa física, que contribuem igual e são associadas igual.
 *
 * O que isso causava, e foi medido por execução antes de virar código:
 *
 *   cadastrarEscola({ nomeEscola: "...", cnpj: "111.444.777-35" })
 *   → { ok: false, mensagem: "CNPJ inválido — dígito verificador incorreto." }
 *
 * Ou seja: essas escolas existem na base, aparecem na lista e emitem ofício,
 * mas NÃO PODEM SER EDITADAS. Qualquer tentativa de salvar era recusada. Elas
 * estavam congeladas e ninguém sabia, porque só quem tentasse editar
 * descobriria.
 *
 * A coluna continua se chamando CNPJ — meio sistema depende desse nome, e
 * renomear seria trocar um problema pequeno por um grande. O que muda é o que
 * ela aceita.
 *
 * ⚠ LGPD: CPF é DADO PESSOAL. Passando a viver oficialmente nesta coluna, ele
 * herda tudo que a coluna faz — aparece em tela e sai em exportação. Por isso
 * vem junto o mascaramento; ver escolaDocMascarado_.
 */
function validarDigitosCpf_(cpf) {
  const c = onlyDigitsEscolas_(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;   // 111.111.111-11 e afins
  function dig(qtd) {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += parseInt(c[i], 10) * (qtd + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  }
  return dig(9) === parseInt(c[9], 10) && dig(10) === parseInt(c[10], 10);
}

function formatarCpfEscolas_(cpf) {
  const d = onlyDigitsEscolas_(cpf).slice(0, 11);
  if (d.length !== 11) return d;
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Analisa o documento e diz o que ele é.
 * Devolve { ok, tipo: "CPF"|"CNPJ"|"", digitos, formatado, mensagem }.
 */
function escolaAnalisarDocumento_(doc) {
  const d = onlyDigitsEscolas_(doc);
  if (!d) return { ok: true, tipo: "", digitos: "", formatado: "", mensagem: "" };

  if (d.length === 11) {
    if (!validarDigitosCpf_(d)) {
      return { ok: false, tipo: "CPF", digitos: d, formatado: "",
               mensagem: "CPF inválido — dígito verificador incorreto." };
    }
    return { ok: true, tipo: "CPF", digitos: d, formatado: formatarCpfEscolas_(d), mensagem: "" };
  }

  if (d.length === 14) {
    if (!validarDigitosCnpj_(d)) {
      return { ok: false, tipo: "CNPJ", digitos: d, formatado: "",
               mensagem: "CNPJ inválido — dígito verificador incorreto." };
    }
    return { ok: true, tipo: "CNPJ", digitos: d, formatado: formatarCNPJEscolas_(d), mensagem: "" };
  }

  return { ok: false, tipo: "", digitos: d, formatado: "",
           mensagem: "Documento inválido: informe um CPF (11 dígitos) ou um CNPJ (14 dígitos). Recebi " + d.length + "." };
}

/**
 * Versão do documento que pode aparecer em lista e sair em arquivo.
 *
 * CNPJ é público — sai inteiro. CPF é dado pessoal — sai mascarado.
 * Nunca troque isto por "mascarar os dois" nem por "mostrar os dois": o
 * primeiro atrapalha o trabalho sem proteger ninguém, o segundo expõe pessoa
 * física numa planilha que circula por e-mail.
 */
function escolaDocMascarado_(doc) {
  const a = escolaAnalisarDocumento_(doc);
  if (a.tipo !== "CPF" || !a.digitos) return String(doc || "").trim();
  return a.digitos.slice(0, 3) + ".***.***-" + a.digitos.slice(9);
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

/* =============================================================== */
/* PONTE PARA A TRILHA ÚNICA (item 16 do PROMPT-MESTRE)            */
/* =============================================================== */
/*
 * Escolas é cadastro mestre institucional: 681 registros reais que Ofícios,
 * Cobrança, Visitas e Sindicalização consomem. Até aqui, NENHUMA ação deste
 * módulo entrava na trilha — nem a exclusão em massa. Apagada a base, não
 * havia de onde saber quem apagou nem quando.
 *
 * Fecha por fora, como a ponte de Ofícios: falha de auditoria nunca derruba a
 * operação de cadastro. Registrar é obrigação do sistema, não do usuário —
 * quem está cadastrando escola não pode perder o trabalho porque o Firestore
 * estava fora do ar.
 */
function escolaAuditar_(acao, nomeEscola, cnpj, justificativa, usuario) {
  try {
    if (typeof auditar_ !== "function") return;
    auditar_({
      modulo: "Escolas",
      submodulo: "Cadastro de Escolas",
      acao: acao,
      registroId: String(cnpj || "").replace(/\D/g, "") || String(nomeEscola || ""),
      usuario: usuario || "",
      documento: String(nomeEscola || ""),
      justificativa: justificativa || ""
    });
  } catch (e) {
    Logger.log("escolaAuditar_ — trilha falhou (cadastro seguiu): " + e);
  }
}

/*
 * "O formulário mandou esta informação?" — diferente de "veio vazia".
 *
 * Existe para o caminho de ATUALIZAÇÃO do cadastro. Chave ausente significa
 * "não mexe nisso"; chave presente e vazia significa "limpa mesmo". Sem essa
 * distinção, qualquer chamada parcial (integração, script, a própria tela
 * quando a lista não trazia um campo) apagava dado que ninguém pediu para
 * apagar.
 */
function escolaEnviouCampo_(dados, chaves) {
  for (var i = 0; i < chaves.length; i++) {
    if (Object.prototype.hasOwnProperty.call(dados, chaves[i])) return true;
  }
  return false;
}

/* Só escreve quando o campo veio no payload. Ver escolaEnviouCampo_. */
function setSeEnviouEscola_(sh, rowNum, hMap, colNomeReal, dados, chaves, valor) {
  if (!escolaEnviouCampo_(dados, chaves)) return;
  setIfColEscola_(sh, rowNum, hMap, colNomeReal, valor);
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
  const sessaoEscola = exigirModulo_(tokenSessao, "escolas", false);
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
    // Aceita CPF (pessoa física) e CNPJ. Ver escolaAnalisarDocumento_.
    const doc = escolaAnalisarDocumento_(cnpjRaw);
    if (!doc.ok) return { ok: false, mensagem: doc.mensagem };

    const agora = agoraFormatadoEscolas_();
    // Quem cadastrou é quem está LOGADO, não quem publicou a implantação.
    // Session.getActiveUser() num app web publicado "executar como eu" devolve
    // sempre o dono do projeto — carimbava a mesma pessoa em todo cadastro,
    // independente de quem tivesse mexido.
    let usuario = "Sistema";
    try {
      usuario = String((sessaoEscola && (sessaoEscola.nome || sessaoEscola.usuario || sessaoEscola.email)) || "").trim() || "Sistema";
    } catch(e) {}

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

        // Atualiza campos nos nomes REAIS das colunas.
        //
        // Só escreve o que o chamador MANDOU. Campo ausente do payload fica
        // como está na planilha; campo presente e vazio é limpeza deliberada.
        // Antes disto, toda atualização escrevia as 20 colunas — e o que não
        // viesse no objeto era gravado como "" por cima do dado bom.
        // O nome é exceção: já foi validado como obrigatório lá em cima.
        setIfColEscola_(sh, rowNum, hMap, COL_NOME_ESCOLA, nome);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_FANTASIA,     dados, ["fantasia","nomeFantasia"],  fantasia);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_CNPJ,         dados, ["cnpj"],                     doc.formatado);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_UNIDADE,      dados, ["codigoInterno"],            String(dados.codigoInterno || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_REDE,         dados, ["rede"],                     String(dados.rede || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_CIDADE,       dados, ["municipio","cidade"],       municipio);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_UF,           dados, ["uf"],                       uf);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_ENDERECO,     dados, ["endereco"],                 String(dados.endereco || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_NUMERO,       dados, ["numero"],                   String(dados.numero || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_COMPLEMENTO,  dados, ["complemento"],              String(dados.complemento || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_BAIRRO,       dados, ["bairro"],                   String(dados.bairro || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_CEP,          dados, ["cep"],                      String(dados.cep || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_TELEFONE,     dados, ["telefone"],                 String(dados.telefone || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_WHATSAPP,     dados, ["whatsapp"],                 String(dados.whatsapp || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_EMAIL,        dados, ["email"],                    email);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_EMAILS_TODOS, dados, ["email","emailsTodos"],      emailTodos);
        setSeEnviouEscola_(sh, rowNum, hMap, COL_RESPONSAVEL,  dados, ["responsavel"],              String(dados.responsavel || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_CARGO,        dados, ["cargoResponsavel"],         String(dados.cargoResponsavel || "").trim());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_SITUACAO,     dados, ["situacao"],                 String(dados.situacao || "ATIVA").trim().toUpperCase());
        setSeEnviouEscola_(sh, rowNum, hMap, COL_OBSERVACOES,  dados, ["observacoes"],              String(dados.observacoes || "").trim());
        // Quem mexeu por último. Sem isto, uma alteração era indistinguível de
        // um cadastro antigo intocado.
        setIfColEscola_(sh, rowNum, hMap, COL_DATA_CADASTRO,    agora);
        setIfColEscola_(sh, rowNum, hMap, COL_USUARIO_CADASTRO, usuario);

        SpreadsheetApp.flush();
        invalidarCacheEscolasInterno_();
        escolaAuditar_("ALTERAR", nome, cnpjRaw, "Cadastro atualizado pela tela de Escolas.", usuario);
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
    setCol(COL_CNPJ,            doc.formatado);
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

    // Identidade única, no nascimento do registro (item 8 do PROMPT-MESTRE).
    // Fecha por fora: se a alocação falhar, a escola fica cadastrada sem id e
    // a migração pega depois. Perder o cadastro por causa do id seria pior.
    var idNovo = "";
    try {
      if (typeof escolaIdDaLinha_ === "function") idNovo = escolaIdDaLinha_(sh, sh.getLastRow());
    } catch (eId) {
      Logger.log("cadastrarEscola — identidade nao atribuida (cadastro seguiu): " + eId);
    }

    invalidarCacheEscolasInterno_();
    escolaAuditar_("CRIAR", nome, cnpjRaw, "Escola cadastrada pela tela de Escolas." +
      (idNovo ? " Identidade: " + idNovo + "." : ""), usuario);
    return { ok: true, mensagem: "Escola cadastrada com sucesso.", atualizado: false, escolaId: idNovo };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao cadastrar escola: " + e.message };
  }
}

/* =============================================================== */
/* LISTAR PARA O MÓDULO INTERNO                                     */
/* =============================================================== */
/** Exige sessão válida — usada diretamente por telas via google.script.run. */
// SEM trava de modulo: leitura compartilhada, usada pela tela de Oficios
// para escolher o destinatario. Sessao continua exigida.
function listarEscolas(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarEscolasCadastro_interno_();
}

/** Exige sessão válida — usada diretamente por telas via google.script.run. */
// SEM trava de modulo: leitura compartilhada. Chamada pela Central de
// E-mails, pelo nucleo de IA e pelo resumo da tela Inicio — travar aqui
// quebraria a home de quem nao tem Escolas. Dado institucional da
// escola (nome, CNPJ, contato), nao dado pessoal. Sessao continua exigida.
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
    var resultado = dados.map(function(linha, iLinha) {
      const obj = {};
      cab.forEach(function(coluna, i) {
        obj[String(coluna || "").trim()] = linha[i] !== undefined ? linha[i] : "";
      });
      // Número REAL da linha na planilha. É a identidade estável do registro:
      // o CNPJ não serve — pode estar vazio, e pode se repetir (matriz/filial e
      // as duplicatas que a própria base tem). Calculado antes do filter, para
      // não deslizar quando linha sem nome é descartada da lista.
      obj.linha = iLinha + 2;
      // Identidade única (item 8). É por ela que as telas e os outros módulos
      // devem apontar — nunca pelo nome, nunca pelo número da linha.
      obj.EscolaID = String(obj[ESC_COL_ID] || "").trim().toUpperCase();
      obj.escolaId = obj.EscolaID;
      // Tipo do documento e versão mascarada. A tela escolhe qual usar: a
      // lista mostra a mascarada, a ficha individual mostra a inteira.
      // Sem isto, a tela não teria como saber que aquele número é CPF de
      // pessoa física e o trataria como CNPJ público.
      var docInfo = escolaAnalisarDocumento_(obj.CNPJ);
      obj.documentoTipo = docInfo.tipo;
      obj.documentoMascarado = escolaDocMascarado_(obj.CNPJ);
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
  const sessaoSit = exigirModulo_(tokenSessao, "escolas", false);
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

    // Aceita EscolaID e CNPJ. Sem o id, escola cadastrada sem CNPJ não podia
    // sequer ser inativada — ficava presa ATIVA para sempre.
    const colIdSit = hMap[ESC_COL_ID];
    const alvo = {};
    const alvoIdSit = {};
    cnpjs.forEach(function(c) {
      const bruto = String(c || "").trim();
      if (typeof escolaIdValido_ === "function" && escolaIdValido_(bruto)) {
        alvoIdSit[bruto.toUpperCase()] = true;
        return;
      }
      const d = onlyDigitsEscolas_(bruto);
      if (d) alvo[d] = true;
    });
    // Seleção sem nenhum alvo válido é recusa, não sucesso com zero linhas.
    // Devolver ok:true/atualizadas:0 fazia a tela dizer "pronto" sem ter feito
    // nada — o usuário só descobria conferindo linha por linha.
    if (!Object.keys(alvo).length && !Object.keys(alvoIdSit).length) {
      return { ok: false, atualizadas: 0, mensagem: "Nenhuma escola válida na seleção." };
    }

    const numCols = sh.getLastColumn();
    const dadosSit = sh.getRange(2, 1, lastRow - 1, numCols).getValues();
    let atualizadas = 0;

    for (let i = 0; i < dadosSit.length; i++) {
      const idLinha = colIdSit ? String(dadosSit[i][colIdSit - 1] || "").trim().toUpperCase() : "";
      const cnpjLinha = onlyDigitsEscolas_(dadosSit[i][colCnpj - 1]);
      const bate = (idLinha && alvoIdSit[idLinha]) || (cnpjLinha && alvo[cnpjLinha]);
      if (!bate) continue;
      sh.getRange(i + 2, colSit).setValue(situacao);
      atualizadas++;
    }

    if (atualizadas > 0) {
      SpreadsheetApp.flush();
      invalidarCacheEscolasInterno_();
      escolaAuditar_("ALTERAR", "", "",
        "Situação alterada em lote para " + situacao + " em " + atualizadas + " escola(s).",
        String((sessaoSit && (sessaoSit.nome || sessaoSit.usuario || sessaoSit.email)) || "").trim());
    }

    return {
      ok: true,
      atualizadas: atualizadas,
      mensagem: atualizadas + " escola(s) atualizada(s) para " + situacao + "."
    };
  } catch(e) {
    return { ok: false, mensagem: "Erro ao atualizar situação em lote: " + e.message };
  }
}

/*
 * EXCLUSÃO EM LOTE — a operação sem volta desta tela.
 *
 * O que estava errado: o casamento era por CNPJ, e TODA linha com aquele CNPJ
 * era apagada. Como a base tem duplicatas conhecidas (existe uma tela só para
 * achá-las) e matriz/filial dividem raiz de CNPJ, marcar uma linha para
 * excluir levava a irmã junto — inclusive a que estava correta. O usuário via
 * "1 escola excluída" quando duas tinham sumido.
 *
 * Como ficou: CNPJ que bate em mais de uma linha NÃO é excluído. A operação
 * segue com os que são inequívocos e devolve os ambíguos por nome, para o
 * usuário resolver pela tela de Duplicadas. Recusar é reversível; apagar a
 * escola errada não é.
 *
 * O que ainda NÃO resolve: escola cadastrada sem CNPJ continua não podendo
 * ser excluída por aqui — não há como apontá-la. Isso só se fecha com o
 * escolaId do item 8 do PROMPT-MESTRE, que é o próximo passo.
 */
function excluirEscolasEmLote(cnpjs, tokenSessao) {
  const sessaoExcl = exigirModulo_(tokenSessao, "escolas", true);
  try {
    if (!Array.isArray(cnpjs) || !cnpjs.length) {
      return { ok: false, mensagem: "Nenhum CNPJ informado para exclusão em lote." };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, excluidas: 0, mensagem: "Nenhum registro na base." };

    const hMap    = getHeaderMapEscolas_(sh);
    const colCnpj = hMap[COL_CNPJ];
    const colNome = hMap[COL_NOME_ESCOLA];
    // Checado ANTES do backup: sem a coluna não há o que excluir, e criar aba
    // de backup para depois desistir só deixa lixo na planilha.
    if (!colCnpj) return { ok: false, mensagem: "Coluna '" + COL_CNPJ + "' não encontrada." };

    // A seleção aceita EscolaID (preferido) e CNPJ (compatibilidade).
    // Com id não existe ambiguidade nenhuma: um id, uma linha. É por isso que
    // escola sem CNPJ — que antes ficava presa na base, sem poder ser excluída
    // — passa a ser tratável como qualquer outra.
    const colIdEscola = hMap[ESC_COL_ID];
    const alvo = {};
    const alvoId = {};
    cnpjs.forEach(function(c) {
      const bruto = String(c || "").trim();
      if (typeof escolaIdValido_ === "function" && escolaIdValido_(bruto)) {
        alvoId[bruto.toUpperCase()] = true;
        return;
      }
      const d = onlyDigitsEscolas_(bruto);
      if (d) alvo[d] = true;
    });
    if (!Object.keys(alvo).length && !Object.keys(alvoId).length) {
      return { ok: false, mensagem: "Nenhuma escola válida na seleção." };
    }

    const dados = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    // Passo 1: agrupa as linhas por chave, para saber quais são ambíguas.
    // Chave de id nunca agrupa mais de uma; só CNPJ pode.
    const linhasPorCnpj = {};
    for (let i = 0; i < dados.length; i++) {
      const idLinha = colIdEscola ? String(dados[i][colIdEscola - 1] || "").trim().toUpperCase() : "";
      const c = onlyDigitsEscolas_(dados[i][colCnpj - 1]);
      let chave = "";
      if (idLinha && alvoId[idLinha]) chave = "ID::" + idLinha;
      else if (c && alvo[c])          chave = "CNPJ::" + c;
      else continue;
      if (!linhasPorCnpj[chave]) linhasPorCnpj[chave] = [];
      linhasPorCnpj[chave].push({
        row: i + 2,
        nome: colNome ? String(dados[i][colNome - 1] || "").trim() : ""
      });
    }

    // Passo 2: separa o que é seguro apagar do que é ambíguo.
    const linhasParaExcluir = [];
    const ambiguos = [];
    const nomesExcluidos = [];
    Object.keys(linhasPorCnpj).forEach(function(chave) {
      const grupo = linhasPorCnpj[chave];
      if (grupo.length > 1) {
        const c = chave.replace(/^CNPJ::/, "");
        ambiguos.push({
          cnpj: formatarCNPJEscolas_(c),
          quantidade: grupo.length,
          nomes: grupo.map(function(x) { return x.nome || "(sem nome)"; })
        });
        return;
      }
      linhasParaExcluir.push(grupo[0].row);
      nomesExcluidos.push(grupo[0].nome || "(sem nome)");
    });

    if (!linhasParaExcluir.length) {
      return {
        ok: false,
        excluidas: 0,
        ambiguos: ambiguos,
        mensagem: ambiguos.length
          ? "Nada foi excluído: " + ambiguos.length + " CNPJ(s) aparecem em mais de uma linha. " +
            "Resolva primeiro em Escolas › Duplicadas."
          : "Nenhuma escola encontrada com os CNPJs informados."
      };
    }

    /* ── O TETO VEM ANTES DO BACKUP ─────────────────────────────────────
       Pedido do usuário em 20/08/2026: "Exclusão Com limite!".

       A ordem importa. Se a checagem viesse depois, uma exclusão recusada
       ainda teria criado uma aba de backup na planilha — lixo permanente
       gerado por uma operação que não aconteceu.

       E o teto RECUSA, não corta: excluir 50 de 300 e responder "50
       excluídas" deixaria quem pediu achando que as 300 saíram. */
    const tetoLote = (typeof lixeiraLimiteLote_ === "function") ? lixeiraLimiteLote_() : 50;
    if (linhasParaExcluir.length > tetoLote) {
      return {
        ok: false,
        excluidas: 0,
        ambiguos: ambiguos,
        mensagem: "Foram selecionadas " + linhasParaExcluir.length + " escolas, e o " +
          "limite por lote é " + tetoLote + ". NADA foi excluído — faça em lotes " +
          "menores. O limite existe porque a base tem cadastro real, e uma " +
          "exclusão grande feita por engano é difícil de perceber a tempo."
      };
    }

    // Backup automático — só agora, com a exclusão já decidida.
    const dadosCompletos = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
    const nomeBackup = escolaNomeBackupLivre_(ss, "BACKUP_ESCOLAS_EXCLUSAO_");
    const shBackup = ss.insertSheet(nomeBackup);
    shBackup.getRange(1, 1, dadosCompletos.length, dadosCompletos[0].length).setValues(dadosCompletos);
    shBackup.getRange(1, 1, 1, dadosCompletos[0].length).setFontWeight("bold");
    shBackup.setFrozenRows(1);

    /* EXCLUIR AQUI É MOVER PARA A LIXEIRA, NÃO APAGAR — 20/08/2026.
       São 679 escolas reais na base. lixeiraMoverVarias_ já ordena de baixo
       para cima (apagar de cima desloca os índices seguintes) e grava quem,
       quando e por quê em Escolas_LIXEIRA. Ver Lixeira.gs. */
    const quemExcluiu = String((sessaoExcl && (sessaoExcl.nome || sessaoExcl.usuario || sessaoExcl.email)) || "").trim();
    const movidas = lixeiraMoverVarias_(sh, linhasParaExcluir, {
      origem: "excluirEscolasEmLote",
      quem:   quemExcluiu,
      motivo: "Exclusão em lote de " + linhasParaExcluir.length + " escola(s)."
    });
    if (!movidas.ok) {
      return { ok: false, excluidas: 0, ambiguos: ambiguos, mensagem: movidas.mensagem };
    }

    SpreadsheetApp.flush();
    invalidarCacheEscolasInterno_();

    const quem = quemExcluiu;
    escolaAuditar_("EXCLUIR", nomesExcluidos.join(" · ").slice(0, 200), "",
      "Exclusão em lote de " + linhasParaExcluir.length + " escola(s). Backup: " + nomeBackup +
      (ambiguos.length ? " | " + ambiguos.length + " CNPJ(s) ambíguos foram preservados." : ""),
      quem);

    return {
      ok: true,
      excluidas: linhasParaExcluir.length,
      ambiguos: ambiguos,
      backup: nomeBackup,
      mensagem: linhasParaExcluir.length + " escola(s) excluída(s). Backup: " + nomeBackup + "." +
        (ambiguos.length
          ? " ATENÇÃO: " + ambiguos.length + " CNPJ(s) aparecem em mais de uma linha e NÃO foram excluídos — resolva em Escolas › Duplicadas."
          : "")
    };
  } catch(e) {
    return { ok: false, mensagem: "Erro ao excluir em lote: " + e.message };
  }
}

/*
 * Nome de aba de backup que ainda não existe.
 *
 * O carimbo só tinha precisão de segundo. Duas operações destrutivas seguidas
 * — perfeitamente normal quando se está limpando a base — colidiam, e a
 * segunda morria com a exceção crua do Sheets na cara do usuário.
 */
function escolaNomeBackupLivre_(ss, prefixo) {
  const base = prefixo + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  if (!ss.getSheetByName(base)) return base;
  for (let n = 2; n <= 99; n++) {
    const tentativa = base + "_" + n;
    if (!ss.getSheetByName(tentativa)) return tentativa;
  }
  return base + "_" + new Date().getTime();
}

/* =============================================================== */
/* ANALISAR / REMOVER DUPLICADAS (mantidas do original)            */
/* =============================================================== */
function analisarEscolasDuplicadas(tokenSessao) {
  exigirModulo_(tokenSessao, "escolas", false);
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
  const sessaoDedup = exigirModulo_(tokenSessao, "escolas", true);
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
    const nomeBackup = escolaNomeBackupLivre_(ss, "BACKUP_ESCOLAS_");
    const shBackup = ss.insertSheet(nomeBackup);
    shBackup.getRange(1,1,dados.length,dados[0].length).setValues(dados);
    shBackup.getRange(1,1,1,dados[0].length).setFontWeight("bold");
    shBackup.setFrozenRows(1);

    /* Esta função reescreve a aba INTEIRA a partir do que montar aqui. Logo,
     * linha que não entrar em 'map' nem em 'semNome' desaparece da base.
     *
     * Era exatamente o que acontecia com linha de razão social em branco: o
     * agrupamento é indexado pelo nome, o 'continue' pulava a linha, e ela
     * sumia na reescrita — sem entrar na contagem de "removidas", que só
     * conta duplicata. A tela dizia "0 removidas" e a base tinha uma linha a
     * menos.
     *
     * Linha sem nome não é duplicata: é cadastro incompleto. Some com o dado
     * de contato que ela carrega e não há de onde recuperar fora do backup.
     * Agora ela atravessa intacta e vira trabalho da fila de Pendências. */
    const map = {};
    const semNome = [];
    for (let i=1; i<dados.length; i++) {
      const row  = dados[i];
      const nome = String(row[iNome]||"").trim();
      if (!nome) {
        // Linha totalmente vazia é lixo de planilha, não cadastro — essa sai.
        const temAlgumDado = row.some(function(c){ return String(c||"").trim() !== ""; });
        if (temAlgumDado) semNome.push(row);
        continue;
      }
      const cnpj = iCnpj>-1 ? od_(row[iCnpj]) : "";
      const mun  = iMun >-1 ? String(row[iMun ]||"").trim() : "";
      const uf   = iUf  >-1 ? String(row[iUf  ]||"").trim().toUpperCase() : "";
      const k    = (cnpj&&cnpj.length>=14) ? "CNPJ::"+cnpj : "NOME::"+n_(nome)+"||"+n_(mun)+"||"+n_(uf);
      if (!map[k]) map[k]=[];
      map[k].push({ linhaPlanilha:i+1, row });
    }

    /* Identidade na fusão (item 8 do PROMPT-MESTRE).
     *
     * Ao fundir duas linhas, uma identidade deixa de existir como registro.
     * Quem tiver guardado o id absorvido ficaria com um ponteiro para o nada —
     * e, pior, sem saber disso. Por isso cada absorção vira uma linha em
     * SISGEP_Escolas_Merges, e escolaResolverId_ passa a levar o id antigo até
     * o sobrevivente. É o que permite fundir duplicata sem quebrar o passado.
     *
     * Sobrevive o id da linha mais antiga do grupo — a que tem mais chance de
     * já estar referenciada por ofício ou cobrança emitidos. */
    const iId = cab.indexOf(ESC_COL_ID);
    const fusoes = [];

    const mantidas=[dados[0]]; let removidas=0;
    Object.keys(map).forEach(function(k){
      const itens=map[k];
      if(itens.length===1){ mantidas.push(itens[0].row); return; }
      itens.sort(function(a,b){ return a.linhaPlanilha-b.linhaPlanilha; });
      let linhaFinal=itens[0].row.slice();
      for(let i=1;i<itens.length;i++) linhaFinal=mesclar_(linhaFinal,itens[i].row);

      if (iId > -1) {
        // mesclar_ só preenche vazio, então o id do primeiro já prevalece.
        // Aqui só se anota quem foi absorvido.
        const idFinal = String(linhaFinal[iId] || "").trim().toUpperCase();
        for (let j = 0; j < itens.length; j++) {
          const idItem = String(itens[j].row[iId] || "").trim().toUpperCase();
          if (idItem && idFinal && idItem !== idFinal) {
            fusoes.push({ de: idItem, para: idFinal });
          }
        }
      }

      mantidas.push(linhaFinal); removidas+=itens.length-1;
    });
    // As sem nome voltam ao fim, preservadas.
    semNome.forEach(function(row){ mantidas.push(row); });

    sh.clearContents(); sh.clearFormats();
    sh.getRange(1,1,mantidas.length,mantidas[0].length).setValues(mantidas);
    sh.getRange(1,1,1,mantidas[0].length).setFontWeight("bold");
    sh.setFrozenRows(1);
    try { sh.autoResizeColumns(1,sh.getLastColumn()); } catch(e) {}

    SpreadsheetApp.flush();
    invalidarCacheEscolasInterno_();

    const quemDedup = String((sessaoDedup && (sessaoDedup.nome || sessaoDedup.usuario || sessaoDedup.email)) || "").trim();
    fusoes.forEach(function(f){
      try {
        if (typeof escolaRegistrarFusao_ === "function") {
          escolaRegistrarFusao_(f.de, f.para, "Deduplicação automática de Escolas.", quemDedup);
        }
      } catch (eF) { Logger.log("removerEscolasDuplicadas — fusao nao registrada: " + eF); }
    });

    escolaAuditar_("EXCLUIR", "", "",
      "Deduplicação: " + removidas + " linha(s) fundida(s). Backup: " + nomeBackup +
      (fusoes.length ? " | " + fusoes.length + " identidade(s) redirecionada(s)." : "") +
      (semNome.length ? " | " + semNome.length + " linha(s) sem razão social preservadas." : ""),
      String((sessaoDedup && (sessaoDedup.nome || sessaoDedup.usuario || sessaoDedup.email)) || "").trim());
    return {
      ok:true, removidas, mantidas:mantidas.length-1, semNome:semNome.length, backup:nomeBackup,
      mensagem:"Deduplicação concluída." +
        (semNome.length ? " " + semNome.length + " linha(s) sem razão social foram mantidas — veja em Pendências." : "")
    };
  } catch(e) {
    return { ok:false, removidas:0, mantidas:0, mensagem:"Erro ao remover duplicadas: "+e.message };
  }
}

/* =============================================================== */
/* ESTATÍSTICAS (usa nomes reais das colunas)                      */
/* =============================================================== */
// SEM trava de modulo: alimenta o dashboard de Oficios (modulo
// Documentos). Sessao continua exigida.
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
  exigirModulo_(tokenSessao, "escolas", false);
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
  exigirModulo_(tokenSessao, "escolas", false);
  return listarEscolasParaModulo_interno_();
}

/*
 * ATENÇÃO AO EDITAR: esta lista alimenta o formulário de edição da tela.
 *
 * O formulário devolve TODOS os campos ao salvar (coletar() em
 * CadastroEscolas.html monta o objeto inteiro, com "" no que estiver em
 * branco). Logo, todo campo que NÃO sair daqui volta vazio e apaga o que
 * estava gravado na planilha.
 *
 * Era exatamente esse o bug: faltavam endereço, número, complemento, bairro,
 * CEP, observações, rede, cargo do responsável e WhatsApp. Quem abrisse uma
 * escola para corrigir o telefone perdia os nove, sem aviso nenhum.
 *
 * Regra: campo novo na aba Escolas entra AQUI junto — ou o cadastro passa a
 * apagá-lo.
 */
function listarEscolasParaModulo_interno_() {
  try {
    function str(v) { return v instanceof Date ? "" : String(v || ""); }
    var lista = listarEscolasCadastro_interno_();
    return lista.map(function(item) {
      return {
        linha:         Number(item.linha || 0),
        EscolaID:      str(item.EscolaID),
        escolaId:      str(item.EscolaID),
        NomeEscola:    str(item.NomeEscola  || item.escola),
        escola:        str(item.escola      || item.NomeEscola),
        CNPJ:          str(item.CNPJ        || item.cnpj),
        cnpj:          str(item.cnpj        || item.CNPJ),
        documentoTipo:      str(item.documentoTipo),
        documentoMascarado: str(item.documentoMascarado),
        Email:         str(item.Email       || item.email),
        email:         str(item.email       || item.Email),
        EmailsTodos:   str(item.EmailsTodos),
        Municipio:     str(item.Municipio   || item.municipio || item.cidade),
        municipio:     str(item.municipio   || item.Municipio),
        cidade:        str(item.cidade      || item.Municipio),
        UF:            str(item.UF          || item.uf),
        uf:            str(item.uf          || item.UF),
        Situacao:      str(item.Situacao    || item.situacao) || "ATIVA",
        situacao:      str(item.situacao    || item.Situacao) || "ATIVA",
        Fantasia:      str(item.Fantasia    || item.fantasia),
        Telefone:      str(item.Telefone    || item.telefone),
        Whatsapp:      str(item.Whatsapp),
        Endereco:      str(item.Endereco),
        Numero:        str(item.Numero),
        Complemento:   str(item.Complemento),
        Bairro:        str(item.Bairro),
        CEP:           str(item.CEP),
        Rede:          str(item.Rede),
        Responsavel:   str(item.Responsavel),
        CargoResponsavel: str(item.CargoResponsavel),
        Observacoes:   str(item.Observacoes),
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
  exigirModulo_(tokenSessao, "escolas", false);
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