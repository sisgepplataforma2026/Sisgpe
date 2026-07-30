// =========================
// ARQUIVO: Despesas.gs
// Módulo de Gestão de Despesas — SISGEP
// ✅ Fluxo automático: D-5 → Prestador (link upload) → SISGEP → Contabilidade → Baixa
// ✅ Fluxo manual: Lançamento → Documento → Contabilidade → Baixa
// ✅ Tokens seguros via PropertiesService (30–60 dias de validade)
// ✅ Trigger diário às 8h (D-5, D-3, D-1)
// ✅ Lançamentos automáticos mensais a partir de Prestadores_Serviços
// ✅ Envio em lote para a contabilidade com link de confirmação por despesa
// ✅ Baixa automática ao confirmar pagamento
// ✅ TIPO_LANCAMENTO: recorrente | avulso
// ✅ Upload manual pela Marcelha no painel admin
// ✅ CRUD completo de prestadores integrado (migrado de GuiasPagamento.gs)
// ✅ Despesa avulsa: prestador digitado livremente, sem cadastro
// =========================

/* ================= CONSTANTES ================= */

var ABA_DESPESAS             = "DESPESAS";
var ABA_PRESTADORES_SERVICOS = "Prestadores_Serviços";

// Cabeçalho canônico — TIPO_LANCAMENTO adicionado
var CABECALHO_DESPESAS = [
  "ID_DESPESA",
  "NUMERO_DESPESA",
  "DATA_CADASTRO",
  "TIPO_LANCAMENTO",
  "CATEGORIA",
  "PRESTADOR_NOME",
  "PRESTADOR_DOC",
  "PRESTADOR_EMAIL",
  "PRESTADOR_WHATS",
  "DESCRICAO",
  "VALOR",
  "DATA_VENCIMENTO",
  "STATUS_VENCIMENTO",
  "QUEM_AGENDOU",
  "TIPO_DOC",
  "STATUS",
  "LINK_DOCUMENTO",
  "FILE_ID_DOCUMENTO",
  "NOME_ARQUIVO",
  "TOKEN_FORNECEDOR",
  "TOKEN_CONTABILIDADE",
  "LINK_FORNECEDOR",
  "LINK_CONTABILIDADE",
  "DATA_ALERTA_D5",
  "DATA_RECEBIMENTO_DOC",
  "DATA_ENVIO_CONTABILIDADE",
  "DATA_PAGAMENTO",
  "CRIADO_POR",
  "OBSERVACOES",
  "ULTIMA_ATUALIZACAO"
];

// Cabeçalho canônico dos prestadores
// Migrado de GuiasPagamento.gs + campos Categoria, Tipo_Doc, Quem_Agenda
var CABECALHO_PRESTADORES_DESP = [
  "ID", "DataHora", "Nome do Prestador", "Documento",
  "E-mail", "WhatsApp",
  "Valor", "Dia de Vencimento",
  "Descricao", "Categoria", "Tipo_Doc", "Quem_Agenda",
  "Ativo"
];

var EMAILS_CONTABILIDADE_DESPESAS = [
  "financeiro@sindeducacao.com"
];

var EMAILS_FINANCEIRO_DESPESAS = [
  "financeiro@sindeducacao.com",
  "secretaria@sindeducacao.com"
];

var STATUS_DESPESA = {
  PENDENTE:               "PENDENTE",
  AGUARDANDO_DOC:         "AGUARDANDO_DOC",
  DOC_RECEBIDO:           "DOC_RECEBIDO",
  ENVIADO_CONTABILIDADE:  "ENVIADO_CONTABILIDADE",
  PAGO:                   "PAGO",
  CANCELADO:              "CANCELADO",
  ESTORNADO:              "ESTORNADO"
};

var COLUNAS_APROVACAO_DESP = ["APROVADO_PARA_PAGAMENTO", "APROVADO_POR", "DATA_APROVACAO"];
var COLUNAS_ESTORNO_DESP   = ["DATA_ESTORNO", "ESTORNADO_POR", "MOTIVO_ESTORNO"];
var COLUNAS_PAGAMENTO_DESP = ["FORMA_PAGAMENTO", "NUMERO_NF"];

/**
 * Garante as colunas de aprovação/estorno/forma de pagamento na aba
 * DESPESAS — mesmo padrão de finGarantirColunasDespesas_
 * (CentralFinanceiraIA.gs): só adiciona a coluna que ainda não existe,
 * idempotente, sem exigir setup manual.
 */
function garantirColunasAprovacaoDesp_() {
  var aba = obterAbaDesp_();
  var lastCol = Math.max(aba.getLastColumn(), 1);
  var headers = aba.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || "").trim(); });
  COLUNAS_APROVACAO_DESP.concat(COLUNAS_ESTORNO_DESP).concat(COLUNAS_PAGAMENTO_DESP).forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var prox = aba.getLastColumn() + 1;
      aba.getRange(1, prox).setValue(col);
      headers.push(col);
    }
  });
}

// Tipos de lançamento
var TIPO_LANCAMENTO_DESP = {
  RECORRENTE: "recorrente",  // gerado automaticamente a partir do cadastro de prestadores
  AVULSO:     "avulso"       // lançado manualmente pela Marcelha, prestador digitado livremente
};

var CATEGORIAS_DESPESA = {
  FORNECEDOR_FIXO:  "Fornecedor Fixo",
  CONTA_MENSAL:     "Conta Mensal",
  DESPESA_VARIAVEL: "Despesa Variável",
  ALUGUEL:          "Aluguel",
  ALVARA_TAXA:      "Alvará / Taxa",
  MATERIAL:         "Material de Consumo",
  SERVICO:          "Serviço Avulso",
  BENEFICIOS:       "Beneficios",
  OUTRA:            "Outra"
};

var TIPOS_DOC_DESPESA = [
  "NF",
  "Cupom Fiscal / Recibo",
  "Boleto",
  "Comprovante de Pagamento",
  "Sem Documento"
];

var QUEM_AGENDA_OPCOES = [
  "Automático",
  "Marcelha - Gerente",
  "Rogério - Diretor Financeiro",
  "Contabilidade"
];

/* ================= SETUP ================= */

function setupModuloDespesas() {
  try {
    garantirAbaDespesas_();
    garantirAbaPrestadoresDesp_();
    instalarTriggerAlertasD5();
    return {
      ok:       true,
      mensagem: "✅ Módulo de Despesas configurado com sucesso! Trigger D-5 instalado (diariamente às 8h)."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro no setup: " + e.message };
  }
}

/* ================= ABA DESPESAS ================= */

function garantirAbaDespesas_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_DESPESAS);

  if (!aba) {
    aba = ss.insertSheet(ABA_DESPESAS);
    aba.getRange(1, 1, 1, CABECALHO_DESPESAS.length).setValues([CABECALHO_DESPESAS]);
    aba.getRange(1, 1, 1, CABECALHO_DESPESAS.length)
      .setFontWeight("bold")
      .setBackground("#001f4d")
      .setFontColor("#ffffff");
    aba.setFrozenRows(1);
    aba.autoResizeColumns(1, CABECALHO_DESPESAS.length);
    Logger.log("✅ Aba " + ABA_DESPESAS + " criada.");
    return aba;
  }

  var headersAtuais = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });

  var adicionadas = 0;
  CABECALHO_DESPESAS.forEach(function(col) {
    if (headersAtuais.indexOf(col) === -1) {
      var proxCol = aba.getLastColumn() + 1;
      aba.getRange(1, proxCol)
        .setValue(col)
        .setFontWeight("bold")
        .setBackground("#001f4d")
        .setFontColor("#ffffff");
      headersAtuais.push(col);
      adicionadas++;
    }
  });

  Logger.log("garantirAbaDespesas_: " + adicionadas + " coluna(s) adicionada(s).");
  return aba;
}

// Alias mantido por compatibilidade
function criarAbaDespesas() { return garantirAbaDespesas_(); }

function obterAbaDesp_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_DESPESAS);
  if (!aba) { garantirAbaDespesas_(); aba = ss.getSheetByName(ABA_DESPESAS); }
  return aba;
}

/* ================= ABA PRESTADORES (CRUD) ================= */

/**
 * Cabeçalho canônico dos prestadores.
 * Mantém compatibilidade com a aba antiga que usava "Nome do Fornecedor".
 */
var CABECALHO_PRESTADORES_DESP = [
  "ID", "DataHora", "Nome do Prestador", "Documento",
  "E-mail", "WhatsApp",
  "Valor", "Dia de Vencimento",
  "Descricao", "Categoria", "Tipo_Doc", "Quem_Agenda",
  "Ativo"
];

/**
 * Garante que a aba Prestadores_Serviços existe com o cabeçalho canônico.
 * Adiciona colunas faltantes sem apagar dados existentes.
 * Se encontrar a coluna antiga "Nome do Fornecedor", renomeia/migra para "Nome do Prestador".
 */
function garantirAbaPrestadoresDesp_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_PRESTADORES_SERVICOS);

  if (!aba) {
    aba = ss.insertSheet(ABA_PRESTADORES_SERVICOS);
    aba.appendRow(CABECALHO_PRESTADORES_DESP);
    aba.getRange(1, 1, 1, CABECALHO_PRESTADORES_DESP.length)
      .setFontWeight("bold")
      .setBackground("#001f4d")
      .setFontColor("#ffffff");
    aba.setFrozenRows(1);
    Logger.log("✅ Aba " + ABA_PRESTADORES_SERVICOS + " criada.");
    return aba;
  }

  var lastCol = Math.max(aba.getLastColumn(), 1);
  var headersAtuais = aba.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });

  // Migração segura: coluna antiga -> nova
  var idxNomeFornecedor = headersAtuais.indexOf("Nome do Fornecedor");
  var idxNomePrestador  = headersAtuais.indexOf("Nome do Prestador");

  if (idxNomeFornecedor > -1 && idxNomePrestador === -1) {
    aba.getRange(1, idxNomeFornecedor + 1).setValue("Nome do Prestador");
    headersAtuais[idxNomeFornecedor] = "Nome do Prestador";
  } else if (idxNomeFornecedor > -1 && idxNomePrestador > -1 && aba.getLastRow() > 1) {
    // Se as duas colunas existirem, copia os nomes antigos para a coluna nova quando ela estiver vazia.
    var numRows = aba.getLastRow() - 1;
    var antigos = aba.getRange(2, idxNomeFornecedor + 1, numRows, 1).getValues();
    var novos   = aba.getRange(2, idxNomePrestador  + 1, numRows, 1).getValues();
    var mudou = false;
    for (var i = 0; i < numRows; i++) {
      if (!String(novos[i][0] || "").trim() && String(antigos[i][0] || "").trim()) {
        novos[i][0] = antigos[i][0];
        mudou = true;
      }
    }
    if (mudou) aba.getRange(2, idxNomePrestador + 1, numRows, 1).setValues(novos);
  }

  headersAtuais = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });

  var adicionadas = 0;
  CABECALHO_PRESTADORES_DESP.forEach(function(col) {
    if (headersAtuais.indexOf(col) === -1) {
      var proxCol = aba.getLastColumn() + 1;
      aba.getRange(1, proxCol)
        .setValue(col)
        .setFontWeight("bold")
        .setBackground("#001f4d")
        .setFontColor("#ffffff");
      headersAtuais.push(col);
      adicionadas++;
    }
  });

  // Preenche Ativo = "ATIVO" para linhas sem valor
  if (aba.getLastRow() > 1) {
    headersAtuais = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });
    var idxAtivo = headersAtuais.indexOf("Ativo") + 1;
    if (idxAtivo > 0) {
      for (var r = 2; r <= aba.getLastRow(); r++) {
        var val = aba.getRange(r, idxAtivo).getValue();
        if (!val || String(val).trim() === "") {
          aba.getRange(r, idxAtivo).setValue("ATIVO");
        }
      }
    }
  }

  Logger.log("garantirAbaPrestadoresDesp_: " + adicionadas + " coluna(s) adicionada(s).");
  return aba;
}

// Aliases mantidos para não quebrar chamadas antigas do módulo de despesas.
function garantirAbaFornecedoresDesp_() { return garantirAbaPrestadoresDesp_(); }

function listarPrestadoresDesp(filtros, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarPrestadoresDesp_(filtros);
}

// Núcleo sem checagem de sessão — usado por automações internas
// (ex.: geração mensal de lançamentos via trigger, sem usuário logado).
function listarPrestadoresDesp_(filtros) {
  try {
    filtros = filtros || {};

    var planilha = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = planilha.getSheetByName(ABA_PRESTADORES_SERVICOS);

    if (!aba) {
      return { ok: false, mensagem: "Aba Prestadores_Serviços não encontrada." };
    }

    var lastRow = aba.getLastRow();

    if (lastRow < 2) {
      return {
        ok: true,
        lista: [],
        total: 0,
        comEmail: 0,
        comWhatsapp: 0,
        categorias: []
      };
    }

    var dados = aba.getDataRange().getDisplayValues();
    var headers = dados[0];

    function normalizarHeader_(v) {
      return String(v || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_\s]+/g, "")
        .trim();
    }

    var mapa = {};

    headers.forEach(function(h, i) {
      mapa[normalizarHeader_(h)] = i;
    });

    function idx() {
      for (var i = 0; i < arguments.length; i++) {
        var chave = normalizarHeader_(arguments[i]);
        if (mapa[chave] !== undefined) return mapa[chave];
      }
      return -1;
    }

    var iNumero         = idx("Nº", "Numero", "ID");
    var iNomePrestador  = idx("Nome do Prestador", "Nome do Fornecedor", "Prestador");
    var iDoc            = idx("CNPJ_CPF", "CNPJ CPF", "Documento", "CNPJ/CPF");
    var iEmail          = idx("Email", "E-mail");
    var iWhats          = idx("WhatsApp", "Whatsapp", "Telefone");
    var iValor          = idx("Valor");
    var iDiaVenc        = idx("Data de Vecimento", "Data de Vencimento", "Dia de Vencimento", "Dia Venc.");
    var iCategoria      = idx("Categoria");
    var iTipoDoc        = idx("Tipo_Doc", "Tipo Doc", "Tipo de Doc", "NF/Recibo/Boleto/Tipo_Doc");
    var iQuem           = idx("Quem_Agenda", "Forma", "Forma ", "Quem Agenda");
    var iAtivo          = idx("Ativo");
    var iDescricao      = idx("Descricao", "Descrição");

    var lista = [];
    var comEmail = 0;
    var comWhatsapp = 0;

    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];

      var ativo = iAtivo > -1
        ? String(row[iAtivo] || "").trim().toUpperCase()
        : "S";

      if (
        ativo === "N" ||
        ativo === "NÃO" ||
        ativo === "NAO" ||
        ativo === "INATIVO"
      ) {
        continue;
      }

      var nome = iNomePrestador > -1
        ? String(row[iNomePrestador] || "").trim()
        : "";

      if (!nome && iDoc > -1) {
        nome = String(row[iDoc] || "").trim();
      }

      if (!nome) continue;

      var email = iEmail > -1
        ? String(row[iEmail] || "").trim()
        : "";

      var whatsapp = iWhats > -1
        ? String(row[iWhats] || "").trim()
        : "";

      if (email) comEmail++;
      if (whatsapp) comWhatsapp++;

      var valorBruto = iValor > -1
        ? String(row[iValor] || "").trim()
        : "";

      var valorFormatado = valorBruto;

      if (typeof formatarValorDesp_ === "function") {
        valorFormatado = formatarValorDesp_(valorBruto);
      }

      var item = {
        rowIndex: i + 1,

        id: iNumero > -1 ? String(row[iNumero] || "").trim() : "",

        nome: nome,
        prestador: nome,

        documento: iDoc > -1 ? String(row[iDoc] || "").trim() : "",
        cnpjCpf: iDoc > -1 ? String(row[iDoc] || "").trim() : "",

        email: email,
        whatsapp: whatsapp,

        valor: valorFormatado,
        valorBruto: valorBruto,
        valorPadrao: valorFormatado,

        diaVenc: iDiaVenc > -1 ? String(row[iDiaVenc] || "").trim() : "",
        diaVencimento: iDiaVenc > -1 ? String(row[iDiaVenc] || "").trim() : "",

        categoria: iCategoria > -1 ? String(row[iCategoria] || "").trim() : "",
        tipoDoc: iTipoDoc > -1 ? String(row[iTipoDoc] || "").trim() : "",
        tipoDocumento: iTipoDoc > -1 ? String(row[iTipoDoc] || "").trim() : "",

        quemAgenda: iQuem > -1 ? String(row[iQuem] || "").trim() : "",
        forma: iQuem > -1 ? String(row[iQuem] || "").trim() : "",

        descricao: iDescricao > -1 ? String(row[iDescricao] || "").trim() : "",
        ativo: ativo
      };

      if (filtros.busca) {
        var busca = normalizarTextoDesp_(filtros.busca);
        var txt = normalizarTextoDesp_([
          item.nome,
          item.documento,
          item.email,
          item.categoria,
          item.tipoDoc,
          item.quemAgenda
        ].join(" "));

        if (txt.indexOf(busca) === -1) continue;
      }

      lista.push(item);
    }

    lista.sort(function(a, b) {
      return normalizarTextoDesp_(a.nome)
        .localeCompare(normalizarTextoDesp_(b.nome), "pt-BR");
    });

    var categorias = [];

    lista.forEach(function(p) {
      if (p.categoria && categorias.indexOf(p.categoria) === -1) {
        categorias.push(p.categoria);
      }
    });

    categorias.sort();

    return {
      ok: true,
      lista: lista,
      total: lista.length,
      comEmail: comEmail,
      comWhatsapp: comWhatsapp,
      categorias: categorias
    };

  } catch(e) {
    Logger.log("❌ listarPrestadoresDesp: " + e.message);

    return {
      ok: false,
      mensagem: e.message
    };
  }
}
function salvarPrestadorDesp(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var nome = String(payload.nome || "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o nome do prestador." };

    var aba     = garantirAbaPrestadoresDesp_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });

    function col(nomeCol) { return headers.indexOf(nomeCol) + 1; }
    function setCell(row, nomesCol, valor) {
      if (typeof nomesCol === "string") nomesCol = [nomesCol];
      nomesCol.forEach(function(nomeCol) {
        var c = col(nomeCol);
        if (c > 0) aba.getRange(row, c).setValue(valor);
      });
    }

    // EDIÇÃO
    if (payload.rowIndex && payload.rowIndex > 1) {
      var r = payload.rowIndex;
      setCell(r, ["Nome do Prestador", "Nome do Fornecedor"],           nome);
      setCell(r, ["CNPJ_CPF", "Documento"],                             payload.documento  || "");
      setCell(r, ["Email", "E-mail"],                                   payload.email      || "");
      setCell(r, "WhatsApp",                                            payload.whatsapp   || "");
      setCell(r, "Valor",                                               payload.valor      || "");
      setCell(r, ["Data de Vecimento", "Dia de Vencimento"],            payload.diaVenc    || "");
      setCell(r, "Descricao",                                           payload.descricao  || "");
      setCell(r, "Categoria",                                           payload.categoria  || "");
      setCell(r, ["NF/Recibo/Boleto/Tipo_Doc", "Tipo_Doc"],             payload.tipoDoc    || "");
      setCell(r, "Quem_Agenda",                                         payload.quemAgenda || "");
      setCell(r, "Ativo",                                               "ATIVO");
      invalidarCachePrestadoresDesp_();
      return { ok: true, mensagem: "Prestador atualizado com sucesso." };
    }

    // NOVO
    var id        = "PREST_" + new Date().getTime();
    var novaLinha = new Array(headers.length).fill("");

    function set(nomeCol, valor) {
      var c = headers.indexOf(nomeCol);
      if (c > -1) novaLinha[c] = valor;
    }

    set("Nome do Prestador",              nome);
    set("Nome do Fornecedor",             nome); // compatibilidade
    set("CNPJ_CPF",                       payload.documento  || "");
    set("Documento",                      payload.documento  || "");
    set("Email",                          payload.email      || "");
set("Email",                          payload.email      || "");
set("E-mail",                         payload.email      || "");
    set("WhatsApp",                       payload.whatsapp   || "");
    set("Valor",                          payload.valor      || "");
    set("Data de Vecimento",              payload.diaVenc    || "");
    set("Dia de Vencimento",              payload.diaVenc    || "");
    set("Descricao",                      payload.descricao  || "");
    set("Categoria",                      payload.categoria  || "");
    set("NF/Recibo/Boleto/Tipo_Doc",      payload.tipoDoc    || "");
    set("Tipo_Doc",                       payload.tipoDoc    || "");
    set("Quem_Agenda",                    payload.quemAgenda || "");
    set("Ativo",                          "ATIVO");

    aba.appendRow(novaLinha);
    invalidarCachePrestadoresDesp_();
    return { ok: true, mensagem: "Prestador cadastrado com sucesso.", id: id };

  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
/**
 * Formata valor monetário
 */
function formatarValorDesp_(valor) {
  if (!valor) return "";
  var v = String(valor).trim();
  if (v.toLowerCase().indexOf("vari") > -1) return "variável";
  if (v.toLowerCase().indexOf("cart") > -1) return "variável";
  
  // Tenta converter número
  var num = parseFloat(v.replace(/[^\d,]/g, "").replace(",", "."));
  if (!isNaN(num) && num > 0) {
    return "R$ " + num.toFixed(2).replace(".", ",");
  }
  return v;
}
/**
 * Inativa um prestador (soft delete).
 */
function excluirPrestadorDesp(rowIndex, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    if (!rowIndex || rowIndex < 2) return { ok: false, mensagem: "Linha inválida." };
    var aba     = garantirAbaPrestadoresDesp_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });
    var idxAtivo = headers.indexOf("Ativo");
    if (idxAtivo === -1) return { ok: false, mensagem: "Coluna Ativo não encontrada." };
    aba.getRange(rowIndex, idxAtivo + 1).setValue("INATIVO");
    invalidarCachePrestadoresDesp_();
    return { ok: true, mensagem: "Prestador removido com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/**
 * Salva e-mail e WhatsApp rapidamente (card "Sem E-mail").
 */
function salvarContatoPrestadorRapido(rowIndex, email, whatsapp, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    if (!rowIndex || rowIndex < 2) return { ok: false, mensagem: "Linha inválida." };
    if (!email) return { ok: false, mensagem: "Informe o e-mail." };

    var aba     = garantirAbaPrestadoresDesp_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });

    var idxEmail    = headers.indexOf("E-mail");
    var idxWhatsapp = headers.indexOf("WhatsApp");

    if (idxEmail === -1) return { ok: false, mensagem: "Coluna E-mail não encontrada." };

    aba.getRange(rowIndex, idxEmail + 1).setValue(email);
    if (idxWhatsapp > -1 && whatsapp) {
      aba.getRange(rowIndex, idxWhatsapp + 1).setValue(whatsapp);
    }

    invalidarCachePrestadoresDesp_();
    return { ok: true, mensagem: "Contato salvo com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/**
 * Lista prestadores sem e-mail cadastrado.
 */
function listarPrestadoresSemEmailDesp(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var resultado = listarPrestadoresDesp({}, tokenSessao);
    var lista = (resultado.lista || []).filter(function(p) { return !p.email; });
    return {
      ok:          true,
      lista:       lista,
      total:       lista.length,
      comWhatsapp: lista.filter(function(p) { return !!p.whatsapp; }).length,
      semWhatsapp: lista.filter(function(p) { return !p.whatsapp; }).length
    };
  } catch (e) {
    return { ok: false, mensagem: e.message, lista: [] };
  }
}

/* ================= CACHE DE PRESTADORES ================= */

var CACHE_KEY_PRESTADORES_DESP = "sisgep_prestadores_despesas_v1";

function invalidarCachePrestadoresDesp_() {
  try { CacheService.getScriptCache().remove(CACHE_KEY_PRESTADORES_DESP); } catch (e) {}
}

// Alias mantido por compatibilidade interna.
function invalidarCacheFornecedoresDesp_() { return invalidarCachePrestadoresDesp_(); }

function listarPrestadoresAtivosComCache_() {
  try {
    var cache  = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY_PRESTADORES_DESP);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (eCache) {}
    }
    var resultado = listarPrestadoresDesp_({});
    var lista     = resultado.lista || [];
    try { cache.put(CACHE_KEY_PRESTADORES_DESP, JSON.stringify(lista), 300); } catch (ePut) {}
    return lista;
  } catch (e) {
    Logger.log("listarPrestadoresAtivosComCache_: " + e.message);
    return [];
  }
}

// Alias mantido por compatibilidade interna.
function listarFornecedoresAtivosComCache_() { return listarPrestadoresAtivosComCache_(); }

/* ================= NUMERAÇÃO SEGURA ================= */

function gerarNumeroDespesa_() {
  var lock       = LockService.getScriptLock();
  var lockObtido = lock.tryLock(30000);
  if (!lockObtido) throw new Error("Não foi possível gerar número da despesa. Tente novamente.");

  try {
    var ss     = SpreadsheetApp.openById(PLANILHA_ID);
    var config = ss.getSheetByName("CONFIG");
    if (!config) throw new Error("Aba CONFIG não encontrada.");

    var anoAtual  = new Date().getFullYear().toString();
    var rotuloAno = "ANO_DESPESA";
    var rotuloSeq = "SEQ_DESPESA";

    var dados    = config.getDataRange().getValues();
    var linhaAno = -1;
    var linhaSeq = -1;

    for (var i = 0; i < dados.length; i++) {
      var chave = String(dados[i][0] || "").trim().toUpperCase();
      if (chave === rotuloAno) linhaAno = i + 1;
      if (chave === rotuloSeq) linhaSeq = i + 1;
    }

    if (linhaAno === -1) { linhaAno = config.getLastRow() + 1; config.getRange(linhaAno, 1).setValue(rotuloAno); config.getRange(linhaAno, 2).setValue(anoAtual); }
    if (linhaSeq === -1) { linhaSeq = config.getLastRow() + 1; config.getRange(linhaSeq, 1).setValue(rotuloSeq); config.getRange(linhaSeq, 2).setValue(0); }

    var anoConfig = String(config.getRange(linhaAno, 2).getValue() || "").trim();
    var ultimo    = Number(config.getRange(linhaSeq, 2).getValue() || 0);

    if (anoConfig !== anoAtual) { config.getRange(linhaAno, 2).setValue(anoAtual); config.getRange(linhaSeq, 2).setValue(0); ultimo = 0; }

    var proximo = ultimo + 1;
    config.getRange(linhaSeq, 2).setValue(proximo);
    return "DEP-" + String(proximo).padStart(4, "0") + "/" + anoAtual;
  } finally {
    lock.releaseLock();
  }
}

/* ================= HELPERS ================= */

function normalizarTextoDesp_(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calcularStatusVencimentoDesp_(vencimento) {
  if (!vencimento) return "";
  var venc = converterDataBRParaDateDesp_(vencimento);
  if (!venc || isNaN(venc.getTime())) return "";
  var hoje     = new Date();
  var hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  var vencZero = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  var diff     = Math.floor((vencZero - hojeZero) / 86400000);
  if (diff < 0)  return "VENCIDO";
  if (diff <= 5) return "URGENTE";
  return "OK";
}

function converterDataBRParaDateDesp_(valor) {
  var txt = String(valor || "").trim();
  if (!txt) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    var p = txt.split("/");
    return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 12, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return new Date(txt + "T12:00:00");
  var d = new Date(txt);
  return isNaN(d.getTime()) ? null : d;
}

function formatarDataBRDesp_(valor) {
  var txt = String(valor || "").trim();
  if (!txt) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) return txt;
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) { var p = txt.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  if (valor instanceof Date && !isNaN(valor.getTime())) return Utilities.formatDate(valor, Session.getScriptTimeZone(), "dd/MM/yyyy");
  var d = new Date(txt);
  if (isNaN(d.getTime())) return txt;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarDataHoraBRDesp_(valor) {
  if (!valor) return "";
  var d = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function agoraFormatadoDesp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function obterPastaDesp_() {
  var props   = PropertiesService.getScriptProperties();
  var pastaId = (props.getProperty("PASTA_DESPESAS_ID") || "").trim();

  if (pastaId) {
    try {
      return obterOuCriarSubpastaAno(pastaId);
    } catch (e) {
      Logger.log("obterPastaDesp_: PASTA_DESPESAS_ID configurado (" + pastaId + ") está inválido/inacessível — recriando. " + e.message);
    }
  }

  // Sem pasta configurada, ou configuração quebrada (pasta apagada/sem permissão):
  // cria (ou reaproveita) uma pasta "Despesas" dedicada dentro da pasta-mãe dos
  // Ofícios e grava o ID nas Propriedades do Script para as próximas chamadas.
  var parentId = "";
  try { parentId = PASTA_OFICIOS_ID; } catch (e) {}
  if (!parentId) throw new Error("Não foi possível determinar uma pasta-mãe para criar a pasta de Despesas.");

  var parent          = DriveApp.getFolderById(parentId);
  var pastasDespesas   = parent.getFoldersByName("Despesas");
  var pastaDespesas    = pastasDespesas.hasNext() ? pastasDespesas.next() : parent.createFolder("Despesas");
  props.setProperty("PASTA_DESPESAS_ID", pastaDespesas.getId());

  return obterOuCriarSubpastaAno(pastaDespesas.getId());
}

/* ================= LOCALIZAR / ATUALIZAR LINHA ================= */

function localizarLinhaDespesaPorId_(idDespesa) {
  var id = String(idDespesa || "").trim();
  if (!id) return null;
  var aba     = obterAbaDesp_();
  var lastRow = aba.getLastRow();
  if (lastRow < 2) return null;
  var headerMap = getHeaderMap_(aba);
  var colId     = headerMap["ID_DESPESA"];
  if (!colId) return null;
  var dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][colId - 1] || "").trim() === id) {
      return { aba: aba, rowNumber: i + 2, headerMap: headerMap, row: dados[i] };
    }
  }
  return null;
}

function parseDataFlexivelDesp_(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  var s = String(valor).trim();
  if (!s) return null;
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (m) {
    var d = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10),
      m[4]?parseInt(m[4],10):0, m[5]?parseInt(m[5],10):0, m[6]?parseInt(m[6],10):0);
    return isNaN(d.getTime()) ? null : d;
  }
  var d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2;
}

// Sintetiza o histórico de uma despesa a partir dos campos já gravados na
// própria linha (não depende de uma tabela de log separada) — cobre criação,
// anexo, envio à contabilidade, aprovação, pagamento/confirmação e estorno.
function obterHistoricoDespesa(idDespesa, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    idDespesa = String(idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { var i = (headerMap[col] || 0) - 1; return i > -1 ? row[i] : ""; }
    function getStr(col) { return String(get(col) || "").trim(); }

    var eventos = [];
    function add(tipo, titulo, dataRaw, detalhe, usuario) {
      var d = parseDataFlexivelDesp_(dataRaw);
      if (!d) return;
      eventos.push({ tipo: tipo, titulo: titulo, data: formatarDataHoraBRDesp_(d), detalhe: detalhe || "", usuario: usuario || "", _ts: d.getTime() });
    }

    add("CRIADO", "Lançamento criado", get("DATA_CADASTRO"), getStr("DESCRICAO"), getStr("CRIADO_POR"));

    if (getStr("DATA_RECEBIMENTO_DOC")) {
      add("DOC", "Documento anexado", get("DATA_RECEBIMENTO_DOC"), getStr("NOME_ARQUIVO"), "");
    }
    if (getStr("DATA_ENVIO_CONTABILIDADE")) {
      add("ENVIADO", "Enviado à contabilidade", get("DATA_ENVIO_CONTABILIDADE"), "", "");
    }
    if (getStr("DATA_APROVACAO")) {
      add("STATUS", "Aprovado para pagamento", get("DATA_APROVACAO"), "", getStr("APROVADO_POR"));
    }
    if (getStr("DATA_PAGAMENTO")) {
      var obs = getStr("OBSERVACOES");
      var viaContab = obs.indexOf("Confirmado pela contabilidade") > -1;
      add(viaContab ? "CONFIRMADO" : "PAGO",
        viaContab ? "Pagamento confirmado pela contabilidade" : "Marcado como pago",
        get("DATA_PAGAMENTO"), viaContab ? obs : "", "");
    }
    if (getStr("DATA_ESTORNO")) {
      add("CANCELADO", "Pagamento estornado", get("DATA_ESTORNO"), getStr("MOTIVO_ESTORNO"), getStr("ESTORNADO_POR"));
    }
    if (getStr("STATUS") === STATUS_DESPESA.CANCELADO) {
      add("CANCELADO", "Despesa cancelada", get("ULTIMA_ATUALIZACAO"), getStr("OBSERVACOES"), "");
    }

    eventos.sort(function(a, b) { return b._ts - a._ts; });
    eventos.forEach(function(e) { delete e._ts; });

    return { ok: true, historico: eventos };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function atualizarCamposDespesa_(idDespesa, campos) {
  var info = localizarLinhaDespesaPorId_(idDespesa);
  if (!info) return { ok: false, mensagem: "Despesa não encontrada: " + idDespesa };
  var aba = info.aba; var rowNumber = info.rowNumber; var headerMap = info.headerMap;
  Object.keys(campos || {}).forEach(function(chave) {
    var col = headerMap[chave];
    if (col) aba.getRange(rowNumber, col).setValue(campos[chave]);
  });
  var colUA = headerMap["ULTIMA_ATUALIZACAO"];
  if (colUA) aba.getRange(rowNumber, colUA).setValue(new Date());
  limparCacheHeader_(aba);
  return { ok: true };
}

function atualizarStatusDespesa_(idDespesa, novoStatus, observacao, extras) {
  var payload = { "STATUS": String(novoStatus || "").trim() };
  if (observacao && String(observacao).trim()) payload["OBSERVACOES"] = String(observacao).trim();
  Object.keys(extras || {}).forEach(function(k) { payload[k] = extras[k]; });
  return atualizarCamposDespesa_(idDespesa, payload);
}

/* ================= TOKENS ================= */

function gerarTokenFornecedorDespesa_(idDespesa) {
  var token = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(
    "TOKEN_FORN_DESP_" + token,
    JSON.stringify({ idDespesa: idDespesa, criado: new Date().getTime(), expira: new Date().getTime() + (30 * 24 * 60 * 60 * 1000) })
  );
  return token;
}

function buscarTokenFornecedorDespesa_(token) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("TOKEN_FORN_DESP_" + token);
    if (!raw) return null;
    var dados = JSON.parse(raw);
    if (new Date().getTime() > dados.expira) return null;
    return dados;
  } catch (e) { return null; }
}

function gerarTokenContabilidadeDespesa_(idDespesa) {
  var token = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(
    "TOKEN_CONT_DESP_" + token,
    JSON.stringify({ idDespesa: idDespesa, criado: new Date().getTime(), expira: new Date().getTime() + (60 * 24 * 60 * 60 * 1000) })
  );
  return token;
}

function buscarTokenContabilidadeDespesa_(token) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("TOKEN_CONT_DESP_" + token);
    if (!raw) return null;
    var dados = JSON.parse(raw);
    if (new Date().getTime() > dados.expira) return null;
    return dados;
  } catch (e) { return null; }
}

function invalidarTokenDesp_(chaveCompleta) {
  try { PropertiesService.getScriptProperties().deleteProperty(chaveCompleta); } catch (e) {}
}

/* ================= REGISTRAR LANÇAMENTO ================= */

/**
 * Registra uma despesa — manual (Marcelha) ou automática (gerador mensal).
 * Campos obrigatórios: prestadorNome, valor, dataVencimento.
 * tipoLancamento: "recorrente" | "avulso" (default: "recorrente")
 *
 * Para despesa AVULSA: prestadorNome é texto livre, sem vínculo com cadastro.
 */
/**
 * Ponto de entrada chamado pela tela (Scripts_Despesas.html) — exige sessão
 * válida antes de gravar qualquer despesa manual/avulsa.
 */
function registrarLancamentoDespesa(dados, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  dados = dados || {};

  // Duplicidade só é checada em lançamento manual/avulso — o recorrente
  // automático já tem sua própria checagem (jaExisteLancamentoMesDesp_)
  // antes de chegar aqui, e "duplicar despesa" existe justamente pra criar
  // uma cópia de propósito, então não faz sentido bloquear ali.
  var ehAvulso = String(dados.tipoLancamento || "").trim() === TIPO_LANCAMENTO_DESP.AVULSO;
  if (ehAvulso && !dados.confirmarDuplicidade) {
    var jaExiste = jaExisteLancamentoDuplicadoAvulsoDesp_(dados.prestadorNome, dados.dataVencimento, dados.valor);
    if (jaExiste) {
      return {
        ok: false,
        duplicado: true,
        mensagem: "Já existe uma despesa com o mesmo fornecedor, valor e vencimento. Envie novamente para confirmar mesmo assim."
      };
    }
  }

  return registrarLancamentoDespesa_(dados);
}

/**
 * Lógica interna de gravação — sem checagem de sessão própria, porque
 * também é chamada por rotinas automáticas/em lote (gerarLancamentosAutomaticos_,
 * gerarDespesasEmLote, duplicarDespesa) que já validam (ou não precisam
 * validar, por serem disparadas por trigger) antes de chegar aqui. Nunca
 * exponha esta função (com underscore) direto a uma tela.
 */
function registrarLancamentoDespesa_(dados) {
  try {
    dados = dados || {};
    function limpar(v) { return String(v || "").trim(); }

    var idDespesa     = Utilities.getUuid();
    var numeroDespesa = gerarNumeroDespesa_();

    var tipoLancamento = limpar(dados.tipoLancamento) || TIPO_LANCAMENTO_DESP.RECORRENTE;
    var categoria      = limpar(dados.categoria);
    var prestadorNome  = limpar(dados.prestadorNome);
    var prestadorDoc   = limpar(dados.prestadorDoc);
    var prestadorEmail = limpar(dados.prestadorEmail);
    var prestadorWhats = limpar(dados.prestadorWhats);
    var descricao      = limpar(dados.descricao);
    var valor          = limpar(dados.valor);
    var dataVencimento = limpar(dados.dataVencimento);
    var quemAgendou    = limpar(dados.quemAgendou);
    var tipoDoc        = limpar(dados.tipoDoc);
    var observacoes    = limpar(dados.observacoes);
    var centroCusto    = limpar(dados.centroCusto);
    var projetoId      = limpar(dados.projetoId);
    var formaPagamento = limpar(dados.formaPagamento);
    var numeroNf       = limpar(dados.numeroNf);

    var tokenFornecedor    = gerarTokenFornecedorDespesa_(idDespesa);
    var tokenContabilidade = gerarTokenContabilidadeDespesa_(idDespesa);
  var baseUrl = ScriptApp.getService().getUrl().replace("/dev", "/exec");

    var linkFornecedor    = baseUrl + "?page=pub-nf-despesa&token="       + encodeURIComponent(tokenFornecedor);
    var linkContabilidade = baseUrl + "?page=pub-contabil-despesa&token=" + encodeURIComponent(tokenContabilidade);

    // Garante que as colunas de Centro de Custo/Projeto existem na aba —
    // essa estrutura já existia (CentralFinanceiraIA.gs) mas dependia de
    // alguém rodar setupCentralFinanceiraIA() manualmente antes. Idempotente.
    if (typeof finGarantirColunasDespesas_ === "function") finGarantirColunasDespesas_();
    garantirColunasAprovacaoDesp_();

    var aba     = obterAbaDesp_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];

    var novaLinha = [];
    headers.forEach(function(h) {
      h = String(h || "").trim().toUpperCase();
      switch (h) {
        case "ID_DESPESA":          novaLinha.push(idDespesa);      break;
        case "NUMERO_DESPESA":      novaLinha.push(numeroDespesa);  break;
        case "DATA_CADASTRO":       novaLinha.push(agoraFormatadoDesp_()); break;
        case "TIPO_LANCAMENTO":     novaLinha.push(tipoLancamento); break;
        case "CATEGORIA":           novaLinha.push(categoria);      break;
        case "PRESTADOR_NOME":      novaLinha.push(prestadorNome);  break;
        case "PRESTADOR_DOC":       novaLinha.push(prestadorDoc);   break;
        case "PRESTADOR_EMAIL":     novaLinha.push(prestadorEmail); break;
        case "PRESTADOR_WHATS":     novaLinha.push(prestadorWhats); break;
        case "DESCRICAO":           novaLinha.push(descricao);      break;
        case "VALOR":               novaLinha.push(valor);          break;
        case "DATA_VENCIMENTO":     novaLinha.push(dataVencimento); break;
        case "STATUS_VENCIMENTO":   novaLinha.push(calcularStatusVencimentoDesp_(dataVencimento)); break;
        case "QUEM_AGENDOU":        novaLinha.push(quemAgendou);    break;
        case "TIPO_DOC":            novaLinha.push(tipoDoc);        break;
        case "STATUS":              novaLinha.push(STATUS_DESPESA.PENDENTE); break;
        case "TOKEN_FORNECEDOR":    novaLinha.push(tokenFornecedor);    break;
        case "TOKEN_CONTABILIDADE": novaLinha.push(tokenContabilidade); break;
        case "LINK_FORNECEDOR":     novaLinha.push(linkFornecedor);    break;
        case "LINK_CONTABILIDADE":  novaLinha.push(linkContabilidade); break;
        case "CRIADO_POR":          novaLinha.push(Session.getActiveUser().getEmail()); break;
        case "OBSERVACOES":         novaLinha.push(observacoes);    break;
        case "ULTIMA_ATUALIZACAO":  novaLinha.push(agoraFormatadoDesp_()); break;
        case "CENTRO_CUSTO":        novaLinha.push(centroCusto);    break;
        case "PROJETO_ID":          novaLinha.push(projetoId);      break;
        case "FORMA_PAGAMENTO":     novaLinha.push(formaPagamento); break;
        case "NUMERO_NF":           novaLinha.push(numeroNf);       break;
        default:                    novaLinha.push("");
      }
    });

    aba.appendRow(novaLinha);

    return {
      ok:                 true,
      idDespesa:          idDespesa,
      numeroDespesa:      numeroDespesa,
      tipoLancamento:     tipoLancamento,
      tokenFornecedor:    tokenFornecedor,
      tokenContabilidade: tokenContabilidade,
      linkFornecedor:     linkFornecedor,
      linkContabilidade:  linkContabilidade,
      mensagem:           "Despesa cadastrada com sucesso."
    };

  } catch (erro) {
    Logger.log("Erro registrarLancamentoDespesa_: " + erro.message);
    return { ok: false, mensagem: erro.message };
  }
}

/* ================= UPLOAD MANUAL PELA MARCELHA ================= */

/**
 * Permite que a Marcelha anexe um documento diretamente pelo painel admin,
 * sem depender do portal do fornecedor.
 * dadosUpload: { idDespesa, arquivos: [{base64, nome, tipo}], obs: "" }
 */
function uploadDocumentoManual(dadosUpload) {
  try {
    dadosUpload   = dadosUpload || {};
    var idDespesa = String(dadosUpload.idDespesa || "").trim();
    var arquivos  = Array.isArray(dadosUpload.arquivos) ? dadosUpload.arquivos : [];
    var obs       = String(dadosUpload.obs || "").trim();

    if (!idDespesa)       return { ok: false, mensagem: "ID da despesa não informado." };
    if (!arquivos.length) return { ok: false, mensagem: "Nenhum arquivo recebido." };

    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row       = despInfo.row;
    var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var nome        = get("PRESTADOR_NOME");
    var valor       = get("VALOR");
    var vencimento  = get("DATA_VENCIMENTO");
    var numero      = get("NUMERO_DESPESA");
    var statusAtual = get("STATUS");

    // Não permite anexar em despesa já enviada, paga, cancelada ou estornada
    if (statusAtual === STATUS_DESPESA.ENVIADO_CONTABILIDADE || statusAtual === STATUS_DESPESA.PAGO ||
        statusAtual === STATUS_DESPESA.CANCELADO || statusAtual === STATUS_DESPESA.ESTORNADO) {
      return { ok: false, mensagem: "Não é possível anexar documento a uma despesa enviada à contabilidade, paga, cancelada ou estornada." };
    }

    var pasta      = obterPastaDesp_();
    var linksArqs  = [];
    var nomesArqs  = [];
    var primeiroId = "";

    arquivos.forEach(function(arq, i) {
      var base64  = String(arq.base64 || "").trim();
      var nomeArq = String(arq.nome   || ("DOC_" + (i + 1) + ".pdf")).trim();
      var tipoArq = String(arq.tipo   || "application/pdf").trim();
      if (!base64) return;

      var nomeFinal = "DOC_MANUAL_" +
        nome.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g, "_").substring(0, 30) +
        "_" + (numero || idDespesa).replace(/\//g, "-") +
        "_" + (i + 1) + "_" + nomeArq;

      var blob    = Utilities.newBlob(Utilities.base64Decode(base64), tipoArq, nomeFinal);
      var arquivo = pasta.createFile(blob);
      try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eShare) {}

      linksArqs.push("https://drive.google.com/file/d/" + arquivo.getId() + "/view");
      nomesArqs.push(arquivo.getName());
      if (!primeiroId) primeiroId = arquivo.getId();
    });

    if (!linksArqs.length) return { ok: false, mensagem: "Nenhum arquivo válido processado." };

    var emailUsuario = "";
    try { emailUsuario = Session.getActiveUser().getEmail(); } catch(e) {}

    var obsCompleta = "Documento anexado manualmente por " + (emailUsuario || "Marcelha") +
      " em " + agoraFormatadoDesp_() +
      " | Arquivo(s): " + nomesArqs.join(", ") +
      (obs ? " | Obs: " + obs : "");

    atualizarCamposDespesa_(idDespesa, {
      "STATUS":               STATUS_DESPESA.DOC_RECEBIDO,
      "LINK_DOCUMENTO":       linksArqs[0],
      "FILE_ID_DOCUMENTO":    primeiroId,
      "NOME_ARQUIVO":         nomesArqs[0],
      "DATA_RECEBIMENTO_DOC": agoraFormatadoDesp_(),
      "OBSERVACOES":          obsCompleta
    });

    return {
      ok:        true,
      nomesArqs: nomesArqs,
      links:     linksArqs,
      mensagem:  "Documento(s) anexado(s) com sucesso. Despesa pronta para envio à contabilidade."
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao fazer upload manual: " + e.message };
  }
}

/* ================= GERAÇÃO AUTOMÁTICA MENSAL ================= */

/**
 * Lê Prestadores_Serviços e cria lançamentos RECORRENTES para o mês corrente.
 * Não duplica lançamentos já existentes para o mesmo prestador/vencimento.
 */
function gerarLancamentosAutomaticos_() {
  try {
    var prestadores = listarPrestadoresAtivosComCache_();
    if (!prestadores.length) { Logger.log("gerarLancamentosAutomaticos_: nenhum prestador ativo."); return; }

    var hoje     = new Date();
    var anoAtual = hoje.getFullYear();
    var mesAtual = hoje.getMonth();

    var gerados   = 0;
    var ignorados = 0;

    prestadores.forEach(function(forn) {
      var nome    = String(forn.nome    || "").trim();
      var diaVenc = String(forn.diaVenc || "").trim();
      var tipoDoc = String(forn.tipoDoc || "NF").trim();

      if (!nome) { ignorados++; return; }

      var diaNumero = parseInt(String(diaVenc).replace(/\D/g, ""), 10);
      if (isNaN(diaNumero)) {
        Logger.log("Prestador [" + nome + "] sem dia numérico (" + diaVenc + ") — pulando geração automática.");
        ignorados++;
        return;
      }

      var ultimoDia    = new Date(anoAtual, mesAtual + 1, 0).getDate();
      var dia          = Math.min(diaNumero, ultimoDia);
      var dataVencDate = new Date(anoAtual, mesAtual, dia);
      var dataVencStr  = Utilities.formatDate(dataVencDate, Session.getScriptTimeZone(), "dd/MM/yyyy");

      if (jaExisteLancamentoMesDesp_(nome, dataVencStr)) { ignorados++; return; }

      var valorBruto = String(forn.valor || "").trim().toLowerCase();
      var ehVariavel = !valorBruto || valorBruto.indexOf("vari") > -1 || valorBruto.indexOf("cart") > -1;
      var valor      = ehVariavel ? "variável" : String(forn.valor || "").trim();

      var resultado = registrarLancamentoDespesa_({
        tipoLancamento: TIPO_LANCAMENTO_DESP.RECORRENTE,
        categoria:      forn.categoria || CATEGORIAS_DESPESA.FORNECEDOR_FIXO,
        prestadorNome:  nome,
        prestadorDoc:   forn.documento  || "",
        prestadorEmail: forn.email      || "",
        prestadorWhats: forn.whatsapp   || "",
        descricao:      forn.descricao  || nome,
        valor:          valor,
        dataVencimento: dataVencStr,
        quemAgendou:    forn.quemAgenda || "Automático",
        tipoDoc:        tipoDoc
      });

      if (resultado.ok) {
        gerados++;
        Logger.log("Lançamento automático criado: " + resultado.numeroDespesa + " — " + nome + " — " + dataVencStr);
      }
    });

    Logger.log("✅ gerarLancamentosAutomaticos_: gerados=" + gerados + " ignorados=" + ignorados);
  } catch (e) {
    Logger.log("❌ gerarLancamentosAutomaticos_: " + e.message);
  }
}

function jaExisteLancamentoMesDesp_(prestadorNome, dataVencimento) {
  try {
    var aba = obterAbaDesp_();
    if (aba.getLastRow() < 2) return false;
    var dados     = aba.getDataRange().getValues();
    var headers   = dados[0].map(function(h) { return String(h || "").trim(); });
    var idxNome   = headers.indexOf("PRESTADOR_NOME");
    var idxVenc   = headers.indexOf("DATA_VENCIMENTO");
    var idxStatus = headers.indexOf("STATUS");
    var nomeNorm  = normalizarTextoDesp_(prestadorNome);
    for (var i = 1; i < dados.length; i++) {
      var status = String(dados[i][idxStatus] || "").trim();
      if (status === STATUS_DESPESA.CANCELADO) continue;
      var nomeL    = normalizarTextoDesp_(dados[i][idxNome] || "");
      var vencNorm = formatarDataBRDesp_(String(dados[i][idxVenc] || "").trim());
      var dataAlvo = formatarDataBRDesp_(dataVencimento);
      if (nomeL === nomeNorm && vencNorm === dataAlvo) return true;
    }
    return false;
  } catch (e) { return false; }
}

/**
 * Duplicidade de lançamento MANUAL/avulso: mesmo fornecedor + mesmo
 * vencimento + mesmo valor, numa despesa ainda não cancelada. Mais
 * rígido que jaExisteLancamentoMesDesp_ (que não olha valor) de propósito
 * — um mesmo fornecedor pode ter mais de uma despesa legítima no mês,
 * só não a mesma despesa duas vezes.
 */
function jaExisteLancamentoDuplicadoAvulsoDesp_(prestadorNome, dataVencimento, valor) {
  try {
    var aba = obterAbaDesp_();
    if (aba.getLastRow() < 2) return false;
    var dados     = aba.getDataRange().getValues();
    var headers   = dados[0].map(function(h) { return String(h || "").trim(); });
    var idxNome   = headers.indexOf("PRESTADOR_NOME");
    var idxVenc   = headers.indexOf("DATA_VENCIMENTO");
    var idxValor  = headers.indexOf("VALOR");
    var idxStatus = headers.indexOf("STATUS");
    var nomeNorm  = normalizarTextoDesp_(prestadorNome);
    var dataAlvo  = formatarDataBRDesp_(dataVencimento);
    var valorAlvo = String(valor || "").trim();
    for (var i = 1; i < dados.length; i++) {
      var status = String(dados[i][idxStatus] || "").trim();
      if (status === STATUS_DESPESA.CANCELADO) continue;
      var nomeL    = normalizarTextoDesp_(dados[i][idxNome] || "");
      var vencNorm = formatarDataBRDesp_(String(dados[i][idxVenc] || "").trim());
      var valorL   = String(dados[i][idxValor] || "").trim();
      if (nomeL === nomeNorm && vencNorm === dataAlvo && valorL === valorAlvo) return true;
    }
    return false;
  } catch (e) { return false; }
}

/* ================= TRIGGER D-5 ================= */

function verificarEDispararAlertasD5() {
  try {
    Logger.log("▶ verificarEDispararAlertasD5 iniciado em " + agoraFormatadoDesp_());

    gerarLancamentosAutomaticos_();
    recalcularStatusVencimentosDesp_();
    dispararAlertaVencimentoPagamentoInterno_();

    var aba     = obterAbaDesp_();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) { Logger.log("verificarEDispararAlertasD5: sem lançamentos."); return; }

    var dados     = aba.getDataRange().getValues();
    var headerMap = getHeaderMap_(aba);
    var hoje      = new Date();
    hoje.setHours(0, 0, 0, 0);

    var enviados  = 0;
    var ignorados = 0;

    for (var i = 1; i < dados.length; i++) {
      var row       = dados[i];
      var idDesp    = String(row[(headerMap["ID_DESPESA"]      || 0) - 1] || "").trim();
      var status    = String(row[(headerMap["STATUS"]           || 0) - 1] || "").trim();
      var venc      = String(row[(headerMap["DATA_VENCIMENTO"] || 0) - 1] || "").trim();
      var email     = String(row[(headerMap["PRESTADOR_EMAIL"] || 0) - 1] || "").trim();
      var tipoDoc   = String(row[(headerMap["TIPO_DOC"]        || 0) - 1] || "NF").trim();
      var jaAlertou = String(row[(headerMap["DATA_ALERTA_D5"]  || 0) - 1] || "").trim();

      if (!idDesp || !venc) { ignorados++; continue; }
      if (status === STATUS_DESPESA.PAGO || status === STATUS_DESPESA.CANCELADO ||
          status === STATUS_DESPESA.DOC_RECEBIDO || status === STATUS_DESPESA.ENVIADO_CONTABILIDADE) { ignorados++; continue; }

      var precisaDoc = tipoDoc === "NF" || tipoDoc === "Cupom Fiscal / Recibo" || tipoDoc === "NF/Recibo";
      if (!precisaDoc || !email) { ignorados++; continue; }

      var dataVenc = converterDataBRParaDateDesp_(venc);
      if (!dataVenc) { ignorados++; continue; }
      dataVenc.setHours(0, 0, 0, 0);

      var diffDias = Math.floor((dataVenc - hoje) / 86400000);
      if ([5, 3, 1].indexOf(diffDias) === -1) { ignorados++; continue; }

      if (jaAlertou) {
        var dataUltimoAlerta = converterDataBRParaDateDesp_(jaAlertou);
        if (dataUltimoAlerta) {
          dataUltimoAlerta.setHours(0, 0, 0, 0);
          if (dataUltimoAlerta.getTime() === hoje.getTime()) { ignorados++; continue; }
        }
      }

      dispararAlertaD5_(idDesp, row, headerMap, diffDias);
      enviados++;
    }

    Logger.log("✅ verificarEDispararAlertasD5: enviados=" + enviados + " ignorados=" + ignorados);
  } catch (e) {
    Logger.log("❌ verificarEDispararAlertasD5: " + e.message);
  }
}

/**
 * Lembrete PROATIVO pra equipe financeira interna (não pro fornecedor —
 * isso já existe acima, verificarEDispararAlertasD5, D-5/D-3/D-1 pedindo
 * NF) de que uma despesa vence em 3 dias e ainda não foi paga. Um só
 * e-mail-resumo por dia (não um por despesa), pra EMAILS_FINANCEIRO_DESPESAS.
 * Achado 🟡 da auditoria: o vencimento próximo só aparecia passivamente
 * no dashboard, sem nenhum aviso proativo.
 */
function dispararAlertaVencimentoPagamentoInterno_() {
  try {
    var aba = obterAbaDesp_();
    if (aba.getLastRow() < 2) return;

    var colAlerta = "DATA_ALERTA_VENCIMENTO_PAGTO";
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(function(h) { return String(h || "").trim(); });
    if (headers.indexOf(colAlerta) === -1) {
      aba.getRange(1, aba.getLastColumn() + 1).setValue(colAlerta);
    }

    var dados     = aba.getDataRange().getValues();
    var headerMap = getHeaderMap_(aba);
    var hoje      = new Date();
    hoje.setHours(0, 0, 0, 0);

    var pendentes = [];
    var linhasParaMarcar = [];

    for (var i = 1; i < dados.length; i++) {
      var row    = dados[i];
      var status = String(row[(headerMap["STATUS"] || 0) - 1] || "").trim();
      if (status === STATUS_DESPESA.PAGO || status === STATUS_DESPESA.CANCELADO || status === STATUS_DESPESA.ESTORNADO) continue;

      var venc = String(row[(headerMap["DATA_VENCIMENTO"] || 0) - 1] || "").trim();
      var dataVenc = converterDataBRParaDateDesp_(venc);
      if (!dataVenc) continue;
      dataVenc.setHours(0, 0, 0, 0);

      var diffDias = Math.floor((dataVenc - hoje) / 86400000);
      if (diffDias !== 3) continue;

      var jaAlertou = String(row[(headerMap[colAlerta] || 0) - 1] || "").trim();
      if (jaAlertou) {
        var dataUltimo = converterDataBRParaDateDesp_(jaAlertou) || (jaAlertou ? new Date(jaAlertou) : null);
        if (dataUltimo) {
          dataUltimo.setHours(0, 0, 0, 0);
          if (dataUltimo.getTime() === hoje.getTime()) continue;
        }
      }

      pendentes.push({
        nome:   String(row[(headerMap["PRESTADOR_NOME"]  || 0) - 1] || ""),
        numero: String(row[(headerMap["NUMERO_DESPESA"]  || 0) - 1] || ""),
        valor:  String(row[(headerMap["VALOR"]           || 0) - 1] || ""),
        venc:   venc,
        categoria: String(row[(headerMap["CATEGORIA"]    || 0) - 1] || "")
      });
      linhasParaMarcar.push(i + 1);
    }

    if (!pendentes.length) return;

    var linhas = pendentes.map(function(p) {
      return '<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">' + p.numero + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">' + p.nome + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">' + p.categoria + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">' + p.valor + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">' + p.venc + '</td></tr>';
    }).join('');

    var html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;">' +
      '<h2 style="color:#001f4d;">📅 Despesas vencendo em 3 dias</h2>' +
      '<p style="color:#475569;font-size:13px;">' + pendentes.length + ' despesa(s) ainda não paga(s) vencem em 3 dias:</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
      '<tr style="background:#f1f5f9;text-align:left;"><th style="padding:8px 10px;">Nº</th><th style="padding:8px 10px;">Fornecedor</th><th style="padding:8px 10px;">Categoria</th><th style="padding:8px 10px;">Valor</th><th style="padding:8px 10px;">Vencimento</th></tr>' +
      linhas + '</table></div>';

    MailApp.sendEmail({
      to: EMAILS_FINANCEIRO_DESPESAS.join(","),
      subject: "📅 " + pendentes.length + " despesa(s) vencendo em 3 dias — SindEducação-ES",
      htmlBody: html,
      name: "SISGEP · SindEducação-ES"
    });

    var agora = agoraFormatadoDesp_();
    var colIdx = headerMap[colAlerta] || aba.getLastColumn();
    linhasParaMarcar.forEach(function(linha) {
      aba.getRange(linha, colIdx).setValue(agora);
    });

    Logger.log("✅ dispararAlertaVencimentoPagamentoInterno_: " + pendentes.length + " despesa(s) no resumo.");
  } catch (e) {
    Logger.log("❌ dispararAlertaVencimentoPagamentoInterno_: " + e.message);
  }
}

function recalcularStatusVencimentosDesp_() {
  try {
    var aba = obterAbaDesp_();
    if (aba.getLastRow() < 2) return;
    var dados     = aba.getDataRange().getValues();
    var headerMap = getHeaderMap_(aba);
    var colVenc   = headerMap["DATA_VENCIMENTO"];
    var colStatus = headerMap["STATUS"];
    var colSV     = headerMap["STATUS_VENCIMENTO"];
    if (!colVenc || !colSV) return;
    for (var i = 1; i < dados.length; i++) {
      var statusRow = String(dados[i][colStatus - 1] || "").trim();
      if (statusRow === STATUS_DESPESA.PAGO || statusRow === STATUS_DESPESA.CANCELADO) continue;
      var venc   = String(dados[i][colVenc - 1] || "").trim();
      var novoSV = calcularStatusVencimentoDesp_(venc);
      var atualSV = String(dados[i][colSV - 1] || "").trim();
      if (novoSV && novoSV !== atualSV) aba.getRange(i + 1, colSV).setValue(novoSV);
    }
  } catch (e) {
    Logger.log("❌ recalcularStatusVencimentosDesp_: " + e.message);
  }
}

function dispararAlertaD5_(idDespesa, row, headerMap, diffDias) {
  try {
    function getCol(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var nome      = getCol("PRESTADOR_NOME");
    var email     = getCol("PRESTADOR_EMAIL");
    var whatsapp  = getCol("PRESTADOR_WHATS");
    var valor     = getCol("VALOR");
    var vencimento = getCol("DATA_VENCIMENTO");
    var descricao = getCol("DESCRICAO") || nome;
    var numero    = getCol("NUMERO_DESPESA");
    var vencBr    = formatarDataBRDesp_(vencimento);

    var token      = gerarTokenFornecedorDespesa_(idDespesa);
    var urlBase    = ScriptApp.getService().getUrl();
    var linkUpload = urlBase + "?page=pub-nf-despesa&token=" + token;
    var saudacao   = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Olá";

    var assunto = diffDias > 1
      ? "⏰ Lembrete: Envie seu documento — vence em " + diffDias + " dia(s) — " + nome
      : "🔔 AMANHÃ: Envie seu documento — " + nome;

    MailApp.sendEmail({
      to:       email,
      subject:  assunto,
      htmlBody: montarHtmlAlertaD5Fornecedor_(nome, valor, vencBr, descricao, numero, linkUpload, diffDias, saudacao),
      name:     "SindEducação-ES",
      bcc:      EMAILS_FINANCEIRO_DESPESAS.join(",")
    });

    // Link WhatsApp gerado no log para envio manual se necessário
    if (whatsapp) {
      var fone = String(whatsapp).replace(/\D/g, "");
      if (fone.length >= 10) {
        var telFull  = (fone.length === 10 || fone.length === 11) ? "55" + fone : fone;
        var textoWpp = encodeURIComponent(
          saudacao + ", " + nome + "! 👋\n\n" +
          "Lembrete do SindEducação-ES:\n\n" +
          "📋 Envie seu documento fiscal pelo link:\n" +
          "💰 Valor: " + valor + "\n" +
          "📅 Vencimento: " + vencBr + "\n\n" +
          "🔗 " + linkUpload
        );
        Logger.log("WhatsApp D-" + diffDias + " [" + nome + "]: https://wa.me/" + telFull + "?text=" + textoWpp);
      }
    }

    atualizarCamposDespesa_(idDespesa, {
      "STATUS":           STATUS_DESPESA.AGUARDANDO_DOC,
      "TOKEN_FORNECEDOR": token,
      "LINK_FORNECEDOR":  linkUpload,
      "DATA_ALERTA_D5":   agoraFormatadoDesp_()
    });

    Logger.log("✅ Alerta D-" + diffDias + " enviado: [" + nome + "] → " + email);
  } catch (e) {
    Logger.log("⚠ Erro alerta D-5 [" + idDespesa + "]: " + e.message);
  }
}

/* ================= HTML: ALERTA D-5 ================= */

function montarHtmlAlertaD5Fornecedor_(nome, valor, vencBr, descricao, numero, linkUpload, diffDias, saudacao) {
  var emoji, titulo, subtitulo, corBarra;
  if (diffDias >= 3) {
    emoji = "⏰"; corBarra = "#1565C0";
    titulo    = "Lembrete de Envio de Documento Fiscal";
    subtitulo = "Seu documento vence em <strong>" + diffDias + " dia(s)</strong> (" + vencBr + "). Por favor, envie pelo link abaixo.";
  } else {
    emoji = "🔔"; corBarra = "#d97706";
    titulo    = "AMANHÃ: Envie seu Documento Fiscal";
    subtitulo = "O vencimento é <strong>amanhã</strong> (" + vencBr + "). Envie agora para garantir o pagamento em dia.";
  }
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid ' + corBarra + ';">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gestão de Processos — SISGEP</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#001f4d;margin:0 0 8px;">' + emoji + ' ' + titulo + '</h2>' +
        '<p style="color:#475569;margin:0 0 6px;line-height:1.7;">' + saudacao + ', <strong>' + nome + '</strong>! Tudo bem?</p>' +
        '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">' + subtitulo + '</p>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ' + corBarra + ';border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            (numero ? '<tr><td style="padding:5px 0;font-weight:700;width:130px;">Nº Despesa:</td><td>' + numero + '</td></tr>' : '') +
            '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td>' + nome + '</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong style="font-size:16px;">' + valor + '</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
            (descricao && descricao !== nome ? '<tr><td style="padding:5px 0;font-weight:700;">Descrição:</td><td>' + descricao + '</td></tr>' : '') +
          '</table>' +
        '</div>' +
        '<div style="text-align:center;margin:0 0 16px;">' +
          '<a href="' + linkUpload + '" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#1565C0,#003b82);color:#fff;font-weight:800;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(21,101,192,.35);">📋 Enviar Documento Fiscal</a>' +
        '</div>' +
        '<p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;">Ou copie e cole este link:<br><span style="color:#1565C0;">' + linkUpload + '</span></p>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES · financeiro@sindeducacao.com · (27) 99813-5965</div>' +
      '</div>' +
    '</div>'
  );
}

/* ================= PORTAL DO FORNECEDOR — pub-nf-despesa ================= */



function receberUploadDocFornecedor(token, dadosUpload) {
  try {
    var info = buscarTokenFornecedorDespesa_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado." };

    dadosUpload  = dadosUpload || {};
    var arquivos = Array.isArray(dadosUpload.arquivos) ? dadosUpload.arquivos : [];
    var obs      = String(dadosUpload.obs || "").trim();
    if (!arquivos.length) return { ok: false, mensagem: "Nenhum arquivo recebido." };

    var idDespesa      = String(info.idDespesa || "").trim();
    var lembreteDireto = idDespesa.indexOf("PREST_LEMBRETE_") === 0;

    var nome       = "";
    var valor      = "";
    var vencimento = "";
    var numero     = idDespesa;
    var emailPrest = "";

    // Para lembrete manual: busca dados do prestador diretamente
    if (lembreteDireto) {
      var partes   = idDespesa.split("_");
      var rowIndex = partes.length >= 3 ? parseInt(partes[2], 10) : 0;
      if (rowIndex > 1) {
        try {
          var aba     = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_PRESTADORES_SERVICOS);
          var headers = aba.getRange(1,1,1,aba.getLastColumn()).getValues()[0].map(function(h){ return String(h||"").trim(); });
          var rowData = aba.getRange(rowIndex,1,1,aba.getLastColumn()).getValues()[0];
          function getP(nomes) {
            if (typeof nomes === "string") nomes = [nomes];
            for (var n = 0; n < nomes.length; n++) {
              var c = headers.indexOf(nomes[n]);
              if (c > -1) return String(rowData[c]||"").trim();
            }
            return "";
          }
          nome       = getP(["Nome do Prestador","Nome do Fornecedor"]);
          valor      = getP(["Valor"]) || "a confirmar";
          numero     = "LEMBRETE-" + rowIndex;
          emailPrest = getP(["E-mail","Email"]);
        } catch(eP) { Logger.log("Erro ao buscar prestador: " + eP.message); }
      }
      if (!nome) nome = "Prestador";
    } else {
      // Despesa real
      var despInfo = localizarLinhaDespesaPorId_(idDespesa);
      if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

      var row2      = despInfo.row;
      var headerMap = despInfo.headerMap;
      function get2(col) { return String(row2[(headerMap[col]||0)-1]||"").trim(); }

      nome       = get2("PRESTADOR_NOME");
      valor      = get2("VALOR");
      vencimento = get2("DATA_VENCIMENTO");
      numero     = get2("NUMERO_DESPESA");
      emailPrest = get2("PRESTADOR_EMAIL");
    }

    // Salva arquivos no Drive
    var pasta      = obterPastaDesp_();
    var linksArqs  = [];
    var nomesArqs  = [];
    var primeiroId = "";
    var blobsArqs  = []; // reutilizados para anexo no e-mail

    arquivos.forEach(function(arq, i) {
      var base64  = String(arq.base64 || "").trim();
      var nomeArq = String(arq.nome   || ("DOC_"+(i+1)+".pdf")).trim();
      var tipoArq = String(arq.tipo   || "application/pdf").trim();
      if (!base64) return;
      var decoded = Utilities.base64Decode(base64);
      var blob    = Utilities.newBlob(decoded, tipoArq, nomeArq);
      blobsArqs.push({ blob: blob.copyBlob(), nome: nomeArq, tipo: tipoArq });
      var nomeFinal = "DOC_"+nome.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g,"_").substring(0,30)+"_"+(numero||idDespesa).replace(/\//g,"-")+"_"+(i+1)+"_"+nomeArq;
      blob.setName(nomeFinal);
      var arquivo = pasta.createFile(blob);
      try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eShare){}
      linksArqs.push("https://drive.google.com/file/d/"+arquivo.getId()+"/view");
      nomesArqs.push(arquivo.getName());
      if (!primeiroId) primeiroId = arquivo.getId();
    });

    if (!linksArqs.length) return { ok: false, mensagem: "Nenhum arquivo válido processado." };

    var obsCompleta = "Documento recebido via portal em "+agoraFormatadoDesp_()+" | Arquivo(s): "+nomesArqs.join(", ")+(obs?" | Obs: "+obs:"");

    // Atualiza despesa real
    if (!lembreteDireto) {
      atualizarCamposDespesa_(idDespesa, {
        "STATUS":               STATUS_DESPESA.DOC_RECEBIDO,
        "LINK_DOCUMENTO":       linksArqs[0],
        "FILE_ID_DOCUMENTO":    primeiroId,
        "NOME_ARQUIVO":         nomesArqs[0],
        "DATA_RECEBIMENTO_DOC": agoraFormatadoDesp_(),
        "OBSERVACOES":          obsCompleta
      });
    } else {
      Logger.log("Upload lembrete manual recebido: "+nome+" | "+nomesArqs.join(", ")+" | Links: "+linksArqs.join(", "));
    }

    // Monta anexos para e-mail
    var anexosEmail = blobsArqs.map(function(a) {
      return Utilities.newBlob(a.blob.getBytes(), a.tipo, a.nome);
    });

    // Gera token de rastreamento de abertura
    var tokenPixel = Utilities.getUuid().replace(/-/g,"");
    PropertiesService.getScriptProperties().setProperty(
      "PIXEL_DOC_"+tokenPixel,
      JSON.stringify({ nome: nome, numero: numero, criado: new Date().getTime() })
    );
    var urlBase    = ScriptApp.getService().getUrl();
    var pixelUrl   = urlBase + "?page=pub-pixel-nf&t=" + tokenPixel;
    var pixelHtml  = '<img src="'+pixelUrl+'" width="1" height="1" style="display:none;" alt="">';

    // E-mail para o financeiro com anexo
    MailApp.sendEmail({
      to:          EMAILS_FINANCEIRO_DESPESAS.join(","),
      subject:     "📋 Documento Recebido — "+nome+(numero?" ("+numero+")":""),
      htmlBody:    montarHtmlDocRecebidoDesp_(nome, valor, formatarDataBRDesp_(vencimento), numero, nomesArqs, obs) + pixelHtml,
      attachments: anexosEmail,
      name:        "SISGEP · SindEducação-ES"
    });

    // E-mail de confirmação para o prestador
    if (emailPrest) {
      try {
        MailApp.sendEmail({
          to:      emailPrest,
          subject: "✅ Recebemos seu documento — SindEducação-ES",
          htmlBody: montarHtmlConfirmacaoPrestador_(nome, valor, formatarDataBRDesp_(vencimento), numero, nomesArqs),
          name:    "SindEducação-ES"
        });
        Logger.log("✅ Confirmação enviada para prestador: " + emailPrest);
      } catch(eConf) {
        Logger.log("⚠ Erro ao enviar confirmação para prestador: " + eConf.message);
      }
    }

    invalidarTokenDesp_("TOKEN_FORN_DESP_"+token);
    return { ok: true, mensagem: "Documento(s) enviado(s) com sucesso! Nossa equipe foi notificada. Obrigado! ✅" };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao processar upload: "+e.message };
  }
}
/* ================= CONFIG EMAILS / PRÉVIA CONTABILIDADE ================= */

var ABA_CONFIG_EMAILS = "CONFIG_EMAILS";

function garantirAbaConfigEmailsDesp_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_CONFIG_EMAILS);

  if (!sh) {
    sh = ss.insertSheet(ABA_CONFIG_EMAILS);

    var headers = ["ATIVO", "MODULO", "TIPO", "NOME", "EMAIL", "PADRAO"];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#001f4d")
      .setFontColor("#ffffff");

    sh.appendRow(["SIM", "DESPESAS", "PARA", "Operacional 02 - Impacto Condomínios", "operacional02@impactocondominios.com", "SIM"]);
    sh.appendRow(["SIM", "DESPESAS", "PARA", "Operacional 03 - Impacto Condomínios", "operacional03.impactocond@gmail.com", "SIM"]);
    sh.appendRow(["SIM", "DESPESAS", "CC", "Secretaria SindEducação", "secretaria@sindeducacao.com", "SIM"]);

    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }

  return sh;
}

function listarEmailsEnvioDespesas() {
  try {
    var sh = garantirAbaConfigEmailsDesp_();
    var dados = sh.getDataRange().getDisplayValues();

    var lista = [];

    for (var i = 1; i < dados.length; i++) {
      var ativo  = String(dados[i][0] || "").trim().toUpperCase();
      var modulo = String(dados[i][1] || "").trim().toUpperCase();
      var tipo   = String(dados[i][2] || "").trim().toUpperCase();
      var nome   = String(dados[i][3] || "").trim();
      var email  = String(dados[i][4] || "").trim();
      var padrao = String(dados[i][5] || "").trim().toUpperCase();

      if (ativo !== "SIM") continue;
      if (modulo !== "DESPESAS") continue;
      if (!email) continue;

      lista.push({
        tipo: tipo === "CC" ? "CC" : "PARA",
        nome: nome || email,
        email: email,
        padrao: padrao === "SIM"
      });
    }

    return {
      ok: true,
      lista: lista
    };

  } catch (e) {
    return {
      ok: false,
      mensagem: e.message,
      lista: []
    };
  }
}

function montarAssuntoDocumentacaoFiscalDesp_(fornecedores) {
  fornecedores = fornecedores || [];

  var unicos = [];
  fornecedores.forEach(function(nome) {
    nome = String(nome || "").trim();
    if (nome && unicos.indexOf(nome) === -1) unicos.push(nome);
  });

  var mesAno = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM/yyyy");
  mesAno = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

  var nomes = "";

  if (unicos.length === 1) {
    nomes = unicos[0];
  } else if (unicos.length <= 3) {
    nomes = unicos.join(" + ");
  } else {
    nomes = unicos.slice(0, 3).join(" + ") + " e outros " + (unicos.length - 3);
  }

  return "📤 Documentação Fiscal - " + nomes + " - " + mesAno;
}

function obterPreviewEnvioContabilidadeDesp(idsDespesas) {
  try {
    if (!Array.isArray(idsDespesas) || !idsDespesas.length) {
      return { ok: false, mensagem: "Nenhuma despesa selecionada." };
    }

    var emailUsuario = "";
    try {
      emailUsuario = Session.getActiveUser().getEmail() || "financeiro@sindeducacao.com";
    } catch (e) {
      emailUsuario = "financeiro@sindeducacao.com";
    }

    var despesasOk = [];
    var fornecedores = [];
    var totalValor = 0;

    idsDespesas.forEach(function(idDesp) {
      var despInfo = localizarLinhaDespesaPorId_(idDesp);
      if (!despInfo) return;

      var row = despInfo.row;
      var headerMap = despInfo.headerMap;

      function get(col) {
        return String(row[(headerMap[col] || 0) - 1] || "").trim();
      }

      var nome = get("PRESTADOR_NOME");
      var valor = get("VALOR");
      var venc = get("DATA_VENCIMENTO");

      var vNum = parseFloat(String(valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      totalValor += vNum;

      if (nome && fornecedores.indexOf(nome) === -1) fornecedores.push(nome);

      despesasOk.push({
        id: idDesp,
        nome: nome,
        valor: valor,
        vencimento: formatarDataBRDesp_(venc),
        descricao: get("DESCRICAO") || nome,
        numero: get("NUMERO_DESPESA"),
        categoria: get("CATEGORIA"),
        tipoLanc: get("TIPO_LANCAMENTO"),
        linkConfirm: "#"
      });
    });

    if (!despesasOk.length) {
      return { ok: false, mensagem: "Nenhuma despesa válida para prévia." };
    }

    var emailsResp = listarEmailsEnvioDespesas();
    var emails = emailsResp.lista || [];

    var paraPadrao = emails
      .filter(function(e) { return e.tipo === "PARA" && e.padrao; })
      .map(function(e) { return e.email; });

    var ccPadrao = emails
      .filter(function(e) { return e.tipo === "CC" && e.padrao; })
      .map(function(e) { return e.email; });

    return {
      ok: true,
      idsDespesas: idsDespesas,
      emails: emails,
      para: paraPadrao.join(","),
      cc: ccPadrao.join(","),
      assunto: montarAssuntoDocumentacaoFiscalDesp_(fornecedores),
      fornecedores: fornecedores,
      total: despesasOk.length,
      totalValor: "R$ " + totalValor.toFixed(2).replace(".", ","),
      htmlBody: montarHtmlEnvioContabilidadeDesp_(despesasOk, totalValor, emailUsuario)
    };

  } catch (e) {
    return {
      ok: false,
      mensagem: "Erro ao gerar prévia: " + e.message
    };
  }
}
/* ================= ENVIO EM LOTE PARA CONTABILIDADE ================= */

function enviarLoteDespesasParaContabilidade(idsDespesas) {
  try {
    var emailUsuario = "";
    try { emailUsuario = Session.getActiveUser().getEmail() || "financeiro@sindeducacao.com"; } catch(e) { emailUsuario = "financeiro@sindeducacao.com"; }

    if (!Array.isArray(idsDespesas) || !idsDespesas.length) return { ok: false, mensagem: "Nenhuma despesa selecionada." };

    var urlBase = ScriptApp.getService().getUrl();
    var despesasOk  = [];
    var despesasErr = [];
    var anexos      = [];
    var totalValor  = 0;

    idsDespesas.forEach(function(idDesp) {
      try {
        var despInfo = localizarLinhaDespesaPorId_(idDesp);
        if (!despInfo) { despesasErr.push({ id: idDesp, erro: "Não encontrada." }); return; }

        var row = despInfo.row; var headerMap = despInfo.headerMap;
        function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

        var nome      = get("PRESTADOR_NOME");
        var valor     = get("VALOR");
        var venc      = get("DATA_VENCIMENTO");
        var descricao = get("DESCRICAO") || nome;
        var numero    = get("NUMERO_DESPESA");
        var fileId    = get("FILE_ID_DOCUMENTO");
        var nomeArq   = get("NOME_ARQUIVO");
        var categoria = get("CATEGORIA");
        var tipoLanc  = get("TIPO_LANCAMENTO");

        var tokenCont   = gerarTokenContabilidadeDespesa_(idDesp);
        var linkConfirm = urlBase + "?page=pub-contabil-despesa&token=" + tokenCont;

        if (fileId) {
          try {
            var blob = DriveApp.getFileById(fileId).getBlob().setName((nomeArq || "Documento_" + numero) + ".pdf");
            anexos.push(blob);
          } catch (eAnexo) { Logger.log("⚠ Não foi possível anexar doc de " + nome + ": " + eAnexo.message); }
        }

        var vNum = parseFloat(String(valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
        totalValor += vNum;

        despesasOk.push({ id: idDesp, nome: nome, valor: valor, vencimento: formatarDataBRDesp_(venc), descricao: descricao, numero: numero, categoria: categoria, tipoLanc: tipoLanc, linkConfirm: linkConfirm });

        atualizarCamposDespesa_(idDesp, {
          "STATUS":                   STATUS_DESPESA.ENVIADO_CONTABILIDADE,
          "TOKEN_CONTABILIDADE":      tokenCont,
          "DATA_ENVIO_CONTABILIDADE": agoraFormatadoDesp_()
        });
      } catch (eDep) { despesasErr.push({ id: idDesp, erro: eDep.message }); }
    });

    if (!despesasOk.length) return { ok: false, mensagem: "Nenhuma despesa processada. " + despesasErr.length + " erro(s).", erros: despesasErr };

    var mesAno = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
    MailApp.sendEmail({
      to:          EMAILS_CONTABILIDADE_DESPESAS.join(","),
      subject:     "📤 Prestação de Contas — " + despesasOk.length + " despesa(s) — " + mesAno,
      htmlBody:    montarHtmlEnvioContabilidadeDesp_(despesasOk, totalValor, emailUsuario),
      attachments: anexos,
      name:        "SindEducação-ES",
      replyTo:     emailUsuario,
      bcc:         emailUsuario
    });

    return {
      ok:            true,
      totalEnviadas: despesasOk.length,
      totalErros:    despesasErr.length,
      totalValor:    "R$ " + totalValor.toFixed(2).replace(".", ","),
      erros:         despesasErr,
      mensagem:      despesasOk.length + " despesa(s) enviada(s) à contabilidade com sucesso."
    };
  } catch (e) { return { ok: false, mensagem: "Erro ao enviar lote: " + e.message }; }
}

/* ================= PORTAL DA CONTABILIDADE — pub-contabil-despesa ================= */

function obterDadosDespesaPorTokenFornecedor(token) {
  try {
    var info = buscarTokenFornecedorDespesa_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado. Solicite novo envio ao SindEducação-ES." };

    var idDespesa = String(info.idDespesa || "").trim();

    // ── Lembrete manual: sem despesa vinculada ──
    if (idDespesa.indexOf("PREST_LEMBRETE_") === 0) {
      // Extrai rowIndex do ID: PREST_LEMBRETE_{rowIndex}_{timestamp}
      var partes    = idDespesa.split("_");
      var rowIndex  = partes.length >= 3 ? parseInt(partes[2], 10) : 0;
      var prestador = null;

      if (rowIndex > 1) {
        try {
          var aba      = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_PRESTADORES_SERVICOS);
          if (aba && aba.getLastRow() >= rowIndex) {
            var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
              .map(function(h){ return String(h||"").trim(); });
            var row     = aba.getRange(rowIndex, 1, 1, aba.getLastColumn()).getValues()[0];
            function get(nomes) {
              if (typeof nomes === "string") nomes = [nomes];
              for (var n = 0; n < nomes.length; n++) {
                var c = headers.indexOf(nomes[n]);
                if (c > -1) return String(row[c] || "").trim();
              }
              return "";
            }
            var nome = get(["Nome do Prestador","Nome do Fornecedor"]);
            if (nome) {
              var diaNum = parseInt(get(["Dia de Vencimento"]).replace(/\D/g,""), 10);
              var vencBr = "";
              if (!isNaN(diaNum)) {
                var hj       = new Date();
                var ultimoDia = new Date(hj.getFullYear(), hj.getMonth()+1, 0).getDate();
                var dia      = Math.min(diaNum, ultimoDia);
                var dtVenc   = new Date(hj.getFullYear(), hj.getMonth(), dia);
                var pad      = function(n){ return n<10?"0"+n:n; };
                vencBr = pad(dtVenc.getDate())+"/"+pad(dtVenc.getMonth()+1)+"/"+dtVenc.getFullYear();
              }
              prestador = {
                nome:      nome,
                valor:     get(["Valor"]) || "a confirmar",
                vencimento: vencBr,
                descricao: get(["Descricao","Descrição"]) || nome,
                tipoDoc:   get(["Tipo_Doc","Tipo de Documento"]) || "NF"
              };
            }
          }
        } catch (ePrest) {
          Logger.log("obterDadosDespesaPorTokenFornecedor lembrete: " + ePrest.message);
        }
      }

      if (!prestador) {
        prestador = { nome: "Prestador", valor: "a confirmar", vencimento: "", descricao: "", tipoDoc: "NF" };
      }

      return {
        ok:        true,
        nome:      prestador.nome,
        valor:     prestador.valor,
        vencimento: prestador.vencimento,
        descricao:  prestador.descricao,
        tipoDoc:    prestador.tipoDoc,
        numero:     "",
        lembreteDireto: true
      };
    }

    // ── Despesa real vinculada ──
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row2      = despInfo.row;
    var headerMap = despInfo.headerMap;
    function get2(col) { return String(row2[(headerMap[col]||0)-1]||"").trim(); }

    var status = get2("STATUS");
    if (status === STATUS_DESPESA.DOC_RECEBIDO ||
        status === STATUS_DESPESA.ENVIADO_CONTABILIDADE ||
        status === STATUS_DESPESA.PAGO) {
      return { ok: false, jaEnviado: true, mensagem: "Documento já recebido para esta despesa. Obrigado!" };
    }

    return {
      ok:        true,
      nome:      get2("PRESTADOR_NOME"),
      valor:     get2("VALOR"),
      vencimento: formatarDataBRDesp_(get2("DATA_VENCIMENTO")),
      descricao:  get2("DESCRICAO"),
      numero:     get2("NUMERO_DESPESA"),
      tipoDoc:    get2("TIPO_DOC") || "NF"
    };

  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/**
 * Dados da despesa pro Portal da Contabilidade (?page=pub-contabil-despesa)
 * — link enviado no e-mail de "Enviar à Contabilidade". Achado: essa rota
 * nunca tinha sido cadastrada no roteador (doGet, Code.gs) nem esta função
 * de leitura existia — só a de confirmar (confirmarPagamentoDespesaPublico)
 * já estava pronta, sem nenhuma tela pra chamá-la.
 */
function obterDadosDespesaPorTokenContabilidade(token) {
  try {
    var info = buscarTokenContabilidadeDespesa_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado. Peça um novo envio ao SindEducação-ES." };

    var idDespesa = String(info.idDespesa || "").trim();
    var despInfo  = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var status = get("STATUS");
    if (status === STATUS_DESPESA.PAGO) {
      return { ok: false, jaConfirmado: true, mensagem: "Este pagamento já foi confirmado anteriormente.", nome: get("PRESTADOR_NOME"), dataPagamento: get("DATA_PAGAMENTO") };
    }
    if (status === STATUS_DESPESA.CANCELADO || status === STATUS_DESPESA.ESTORNADO) {
      return { ok: false, mensagem: "Esta despesa foi " + (status === STATUS_DESPESA.CANCELADO ? "cancelada" : "estornada") + " e não deve ser paga." };
    }

    return {
      ok:         true,
      nome:       get("PRESTADOR_NOME"),
      valor:      get("VALOR"),
      vencimento: formatarDataBRDesp_(get("DATA_VENCIMENTO")),
      descricao:  get("DESCRICAO"),
      numero:     get("NUMERO_DESPESA"),
      categoria:  get("CATEGORIA")
    };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function confirmarPagamentoDespesaPublico(token, dados) {
  try {
    var info = buscarTokenContabilidadeDespesa_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado. Solicite novo envio." };

    dados = dados || {};
    var dataPagamento = String(dados.dataPagamento || "").trim();
    var observacao    = String(dados.observacao    || "").trim();
    var banco         = String(dados.banco         || "").trim();
    if (!dataPagamento) return { ok: false, mensagem: "Informe a data do pagamento." };

    var idDespesa = info.idDespesa;
    var despInfo  = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada no sistema." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var nome      = get("PRESTADOR_NOME");
    var valor     = get("VALOR");
    var numero    = get("NUMERO_DESPESA");
    var statusAtual = get("STATUS");

    if (statusAtual === STATUS_DESPESA.PAGO) return { ok: false, mensagem: "Este pagamento já foi confirmado anteriormente." };

    var obsCompleta = "✅ Confirmado pela contabilidade em " + dataPagamento +
      (banco ? " | Banco: " + banco : "") + (observacao ? " | Obs: " + observacao : "");

    atualizarCamposDespesa_(idDespesa, { "STATUS": STATUS_DESPESA.PAGO, "DATA_PAGAMENTO": dataPagamento, "OBSERVACOES": obsCompleta });

    try {
      MailApp.sendEmail({ to: EMAILS_FINANCEIRO_DESPESAS.join(","), subject: "✅ Pagamento Confirmado — " + nome + (numero ? " (" + numero + ")" : ""), htmlBody: montarHtmlConfirmacaoPagamentoDesp_(nome, valor, dataPagamento, banco, observacao, numero), name: "SISGEP · SindEducação-ES" });
    } catch (eEmail) { Logger.log("⚠ Erro ao notificar confirmação: " + eEmail.message); }

    invalidarTokenDesp_("TOKEN_CONT_DESP_" + token);
    return { ok: true, nome: nome, valor: valor, numero: numero, mensagem: "Pagamento confirmado com sucesso! O financeiro do SindEducação-ES foi notificado. ✅" };
  } catch (e) { return { ok: false, mensagem: "Erro ao confirmar pagamento: " + e.message }; }
}

/* ================= LISTAGEM E BUSCA ================= */

function listarDespesas(filtros) {
  try {
    filtros = filtros || {};
    var aba     = obterAbaDesp_();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return { ok: true, lista: [], total: 0 };

    var dados   = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h) { return String(h || "").trim(); });
    function idx(nome) { return headers.indexOf(nome); }

    var lista = [];
    for (var i = 1; i < dados.length; i++) {
      var row       = dados[i];
      var statusRow = String(row[idx("STATUS")] || "").trim();
      var venc      = String(row[idx("DATA_VENCIMENTO")] || "").trim();
      var svAtual   = (statusRow === STATUS_DESPESA.PAGO || statusRow === STATUS_DESPESA.CANCELADO)
        ? String(row[idx("STATUS_VENCIMENTO")] || "")
        : calcularStatusVencimentoDesp_(venc);

      var item = {
        idDespesa:          String(row[idx("ID_DESPESA")]              || ""),
        numeroDespesa:      String(row[idx("NUMERO_DESPESA")]          || ""),
        dataCadastro:       formatarDataHoraBRDesp_(row[idx("DATA_CADASTRO")]),
        tipoLancamento:     String(row[idx("TIPO_LANCAMENTO")]         || TIPO_LANCAMENTO_DESP.RECORRENTE),
        categoria:          String(row[idx("CATEGORIA")]               || ""),
        prestadorNome:      String(row[idx("PRESTADOR_NOME")]          || ""),
        prestadorDoc:       String(row[idx("PRESTADOR_DOC")]           || ""),
        prestadorEmail:     String(row[idx("PRESTADOR_EMAIL")]         || ""),
        prestadorWhats:     String(row[idx("PRESTADOR_WHATS")]         || ""),
        descricao:          String(row[idx("DESCRICAO")]               || ""),
        valor:              String(row[idx("VALOR")]                   || ""),
        dataVencimento:     venc,
        dataVencimentoBR:   formatarDataBRDesp_(venc),
        statusVencimento:   svAtual,
        quemAgendou:        String(row[idx("QUEM_AGENDOU")]            || ""),
        tipoDoc:            String(row[idx("TIPO_DOC")]                || ""),
        status:             statusRow,
        linkDocumento:      String(row[idx("LINK_DOCUMENTO")]          || ""),
        fileIdDocumento:    String(row[idx("FILE_ID_DOCUMENTO")]       || ""),
        nomeArquivo:        String(row[idx("NOME_ARQUIVO")]            || ""),
        dataRecebimentoDoc: String(row[idx("DATA_RECEBIMENTO_DOC")]    || ""),
        dataEnvioContab:    String(row[idx("DATA_ENVIO_CONTABILIDADE")] || ""),
        dataPagamento:      String(row[idx("DATA_PAGAMENTO")]          || ""),
        usuarioCadastro:    String(row[idx("CRIADO_POR")]              || ""),
        observacoes:        String(row[idx("OBSERVACOES")]             || ""),
        centroCusto:        String(row[idx("CENTRO_CUSTO")]            || ""),
        projetoId:          String(row[idx("PROJETO_ID")]              || ""),
        aprovadoParaPagamento: String(row[idx("APROVADO_PARA_PAGAMENTO")] || "").trim().toUpperCase() === "SIM",
        aprovadoPor:        String(row[idx("APROVADO_POR")]            || ""),
        dataAprovacao:      String(row[idx("DATA_APROVACAO")]          || ""),
        dataEstorno:        String(row[idx("DATA_ESTORNO")]            || ""),
        estornadoPor:       String(row[idx("ESTORNADO_POR")]           || ""),
        motivoEstorno:      String(row[idx("MOTIVO_ESTORNO")]          || ""),
        formaPagamento:     String(row[idx("FORMA_PAGAMENTO")]         || ""),
        numeroNf:           String(row[idx("NUMERO_NF")]               || "")
      };

      if (filtros.status           && item.status !== filtros.status) continue;
      if (filtros.tipoLancamento   && item.tipoLancamento !== filtros.tipoLancamento) continue;
      if (filtros.ocultarPagos     && item.status === STATUS_DESPESA.PAGO)      continue;
      if (filtros.ocultarCancelados && item.status === STATUS_DESPESA.CANCELADO) continue;
      if (filtros.categoria && normalizarTextoDesp_(item.categoria) !== normalizarTextoDesp_(filtros.categoria)) continue;
      if (filtros.statusVencimento && item.statusVencimento !== filtros.statusVencimento) continue;
      if (filtros.busca) {
        var busca = normalizarTextoDesp_(filtros.busca);
        var txt   = normalizarTextoDesp_([item.prestadorNome, item.descricao, item.numeroDespesa, item.categoria].join(" "));
        if (txt.indexOf(busca) === -1) continue;
      }

      lista.push(item);
    }

    lista.sort(function(a, b) {
      var da = converterDataBRParaDateDesp_(a.dataVencimento);
      var db = converterDataBRParaDateDesp_(b.dataVencimento);
      if (!da) return 1; if (!db) return -1;
      return da.getTime() - db.getTime();
    });

    return { ok: true, lista: lista, total: lista.length };
  } catch (e) { return { ok: false, mensagem: "Erro ao listar despesas: " + e.message, lista: [], total: 0 }; }
}

function buscarDespesaPorId(idDespesa) {
  try {
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }
    var venc = get("DATA_VENCIMENTO");
    return {
      ok: true, idDespesa: get("ID_DESPESA"), numeroDespesa: get("NUMERO_DESPESA"),
      dataCadastro: formatarDataHoraBRDesp_(row[(headerMap["DATA_CADASTRO"] || 0) - 1]),
      tipoLancamento: get("TIPO_LANCAMENTO") || TIPO_LANCAMENTO_DESP.RECORRENTE,
      categoria: get("CATEGORIA"), prestadorNome: get("PRESTADOR_NOME"), prestadorDoc: get("PRESTADOR_DOC"),
      prestadorEmail: get("PRESTADOR_EMAIL"), prestadorWhats: get("PRESTADOR_WHATS"),
      descricao: get("DESCRICAO"), valor: get("VALOR"), dataVencimento: venc,
      dataVencimentoBR: formatarDataBRDesp_(venc), statusVencimento: calcularStatusVencimentoDesp_(venc),
      quemAgendou: get("QUEM_AGENDOU"), tipoDoc: get("TIPO_DOC"), status: get("STATUS"),
      linkDocumento: get("LINK_DOCUMENTO"), fileIdDocumento: get("FILE_ID_DOCUMENTO"),
      nomeArquivo: get("NOME_ARQUIVO"), dataRecebimentoDoc: get("DATA_RECEBIMENTO_DOC"),
      dataEnvioContab: get("DATA_ENVIO_CONTABILIDADE"), dataPagamento: get("DATA_PAGAMENTO"),
      usuarioCadastro: get("CRIADO_POR"), observacoes: get("OBSERVACOES")
    };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function listarDespesasParaEnvioContabilidade() { return listarDespesas({ status: STATUS_DESPESA.DOC_RECEBIDO }); }
function listarDespesasPendentes() { return listarDespesas({ ocultarPagos: true, ocultarCancelados: true }); }

/* ================= AÇÕES MANUAIS ================= */

function marcarDespesaComoPaga(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa     = String(payload.idDespesa     || "").trim();
    var dataPagamento = String(payload.dataPagamento || "").trim() || agoraFormatadoDesp_();
    var observacao    = String(payload.observacao    || "Pagamento registrado manualmente.").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var idxAprov = (despInfo.headerMap["APROVADO_PARA_PAGAMENTO"] || 0) - 1;
    var aprovado = idxAprov > -1 ? String(despInfo.row[idxAprov] || "").trim().toUpperCase() : "";
    if (aprovado !== "SIM") {
      return { ok: false, precisaAprovacao: true, mensagem: "Esta despesa ainda não foi aprovada para pagamento. Aprove antes de marcar como paga." };
    }
    atualizarCamposDespesa_(idDespesa, { "STATUS": STATUS_DESPESA.PAGO, "DATA_PAGAMENTO": dataPagamento, "OBSERVACOES": observacao });
    return { ok: true, mensagem: "Despesa marcada como paga com sucesso." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/**
 * Aprovação de pagamento — item 🟠 da auditoria: antes, uma despesa ia
 * direto de Pendente pra Paga sem ninguém validar. Qualquer usuário com
 * perfil admin pode aprovar (sem restrição de autoaprovação, por decisão
 * explícita: 1 nível, qualquer admin).
 */
function aprovarDespesaParaPagamento(payload, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    garantirColunasAprovacaoDesp_();
    atualizarCamposDespesa_(idDespesa, {
      "APROVADO_PARA_PAGAMENTO": "SIM",
      "APROVADO_POR":            sessao.email || sessao.usuario || "SISGEP",
      "DATA_APROVACAO":          agoraFormatadoDesp_()
    });
    return { ok: true, mensagem: "Despesa aprovada para pagamento." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/**
 * Estorno de uma despesa já PAGA — distinto de cancelar (que só existe
 * antes do pagamento). Mantém o histórico de que foi paga e depois
 * estornada, com motivo obrigatório.
 */
function estornarDespesa(payload, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    var motivo    = String(payload.motivo    || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    if (!motivo)    return { ok: false, mensagem: "Informe o motivo do estorno." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var idxStatus = (despInfo.headerMap["STATUS"] || 0) - 1;
    var statusAtual = idxStatus > -1 ? String(despInfo.row[idxStatus] || "").trim() : "";
    if (statusAtual !== STATUS_DESPESA.PAGO) {
      return { ok: false, mensagem: "Só é possível estornar uma despesa que já está paga." };
    }
    garantirColunasAprovacaoDesp_();
    atualizarCamposDespesa_(idDespesa, {
      "STATUS":         STATUS_DESPESA.ESTORNADO,
      "DATA_ESTORNO":   agoraFormatadoDesp_(),
      "ESTORNADO_POR":  sessao.email || sessao.usuario || "SISGEP",
      "MOTIVO_ESTORNO": motivo
    });
    return { ok: true, mensagem: "Despesa estornada com sucesso." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function cancelarDespesa(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa  = String(payload.idDespesa  || "").trim();
    var observacao = String(payload.observacao || "Despesa cancelada.").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    atualizarCamposDespesa_(idDespesa, { "STATUS": STATUS_DESPESA.CANCELADO, "OBSERVACOES": observacao });
    return { ok: true, mensagem: "Despesa cancelada com sucesso." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function removerAnexoDespesa(payload, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var idxStatus = (despInfo.headerMap["STATUS"] || 0) - 1;
    var statusAtual = idxStatus > -1 ? String(despInfo.row[idxStatus] || "").trim() : "";
    if (statusAtual === STATUS_DESPESA.PAGO || statusAtual === STATUS_DESPESA.ENVIADO_CONTABILIDADE || statusAtual === STATUS_DESPESA.ESTORNADO) {
      return { ok: false, mensagem: "Não é possível remover o anexo de uma despesa já paga, enviada à contabilidade ou estornada." };
    }
    var obs = "Anexo removido por " + (sessao.email || sessao.usuario || "SISGEP") + " em " + agoraFormatadoDesp_() + ".";
    // Volta ao zero também a aprovação: uma aprovação anterior não pode
    // sobreviver a uma reversão para Pendente, senão a despesa pula direto
    // para "Pago" sem passar pela aprovação de novo.
    atualizarCamposDespesa_(idDespesa, {
      "STATUS":                    STATUS_DESPESA.PENDENTE,
      "LINK_DOCUMENTO":            "",
      "FILE_ID_DOCUMENTO":         "",
      "NOME_ARQUIVO":              "",
      "DATA_RECEBIMENTO_DOC":      "",
      "APROVADO_PARA_PAGAMENTO":   "",
      "APROVADO_POR":              "",
      "DATA_APROVACAO":            "",
      "OBSERVACOES":               obs
    });
    return { ok: true, mensagem: "Anexo removido. A despesa voltou para Pendente." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

// Desfaz o envio de uma despesa à contabilidade (ex.: enviada por engano,
// fornecedor/valor errado). Invalida o token público já emitido e volta a
// despesa para DOC_RECEBIDO, mantendo o documento anexado.
function cancelarEnvioContabilidadeDespesa(payload, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var idxStatus = (despInfo.headerMap["STATUS"] || 0) - 1;
    var statusAtual = idxStatus > -1 ? String(despInfo.row[idxStatus] || "").trim() : "";
    if (statusAtual !== STATUS_DESPESA.ENVIADO_CONTABILIDADE) {
      return { ok: false, mensagem: "Só é possível desfazer o envio de uma despesa que está com a contabilidade." };
    }

    var idxToken = (despInfo.headerMap["TOKEN_CONTABILIDADE"] || 0) - 1;
    var tokenAtual = idxToken > -1 ? String(despInfo.row[idxToken] || "").trim() : "";
    if (tokenAtual) invalidarTokenDesp_("TOKEN_CONT_DESP_" + tokenAtual);

    var obs = "Envio à contabilidade desfeito por " + (sessao.email || sessao.usuario || "SISGEP") + " em " + agoraFormatadoDesp_() + ".";
    atualizarCamposDespesa_(idDespesa, {
      "STATUS":                   STATUS_DESPESA.DOC_RECEBIDO,
      "TOKEN_CONTABILIDADE":      "",
      "DATA_ENVIO_CONTABILIDADE": "",
      "OBSERVACOES":              obs
    });
    return { ok: true, mensagem: "Envio à contabilidade desfeito. A despesa voltou para Documento Recebido." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function editarDespesa(payload, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    garantirColunasAprovacaoDesp_();
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "ID não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    var idxStatusEd = (despInfo.headerMap["STATUS"] || 0) - 1;
    var statusAtualEd = idxStatusEd > -1 ? String(despInfo.row[idxStatusEd] || "").trim() : "";
    if (statusAtualEd === STATUS_DESPESA.PAGO || statusAtualEd === STATUS_DESPESA.CANCELADO ||
        statusAtualEd === STATUS_DESPESA.ENVIADO_CONTABILIDADE || statusAtualEd === STATUS_DESPESA.ESTORNADO) {
      return { ok: false, mensagem: "Não é possível editar uma despesa paga, cancelada, enviada à contabilidade ou estornada." };
    }
    var idxValor = (despInfo.headerMap["VALOR"] || 0) - 1;
    var valorAnterior = idxValor > -1 ? String(despInfo.row[idxValor] || "").trim() : "";
    var campos = {};
    if (payload.tipoLancamento) campos["TIPO_LANCAMENTO"]  = String(payload.tipoLancamento).trim();
    if (payload.categoria)      campos["CATEGORIA"]        = String(payload.categoria).trim();
    if (payload.prestadorNome)  campos["PRESTADOR_NOME"]   = String(payload.prestadorNome).trim();
    if (payload.prestadorDoc)   campos["PRESTADOR_DOC"]    = String(payload.prestadorDoc).trim();
    if (payload.prestadorEmail) campos["PRESTADOR_EMAIL"]  = String(payload.prestadorEmail).trim();
    if (payload.prestadorWhats) campos["PRESTADOR_WHATS"]  = String(payload.prestadorWhats).trim();
    if (payload.descricao)      campos["DESCRICAO"]        = String(payload.descricao).trim();
    if (payload.valor)          campos["VALOR"]            = String(payload.valor).trim();
    if (payload.dataVencimento) {
      campos["DATA_VENCIMENTO"]   = String(payload.dataVencimento).trim();
      campos["STATUS_VENCIMENTO"] = calcularStatusVencimentoDesp_(String(payload.dataVencimento).trim());
    }
    if (payload.quemAgendou) campos["QUEM_AGENDOU"] = String(payload.quemAgendou).trim();
    if (payload.tipoDoc)     campos["TIPO_DOC"]     = String(payload.tipoDoc).trim();
    if (payload.observacoes) campos["OBSERVACOES"]  = String(payload.observacoes).trim();
    if (payload.centroCusto !== undefined) campos["CENTRO_CUSTO"] = String(payload.centroCusto).trim();
    if (payload.projetoId   !== undefined) campos["PROJETO_ID"]   = String(payload.projetoId).trim();
    if (payload.formaPagamento !== undefined) campos["FORMA_PAGAMENTO"] = String(payload.formaPagamento).trim();
    if (payload.numeroNf       !== undefined) campos["NUMERO_NF"]       = String(payload.numeroNf).trim();
    atualizarCamposDespesa_(idDespesa, campos);
    if (campos["VALOR"]) {
      finAudRegistrarAlteracaoValor_("DESPESAS", idDespesa, valorAnterior, campos["VALOR"],
        sessao.email || sessao.usuario || "SISGEP", payload.motivoAlteracaoValor || "");
    }
    return { ok: true, mensagem: "Despesa atualizada com sucesso." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/* ================= DASHBOARD ================= */

function obterResumoDespesas() {
  try {
    var resultado = listarDespesas({});
    var lista     = resultado.lista || [];

    var resumo = {
      total: lista.length, totalRecorrentes: 0, totalAvulsos: 0,
      totalPendentes: 0, totalAguardandoDoc: 0, totalDocRecebido: 0,
      totalEnviadosContab: 0, totalPagos: 0, totalCancelados: 0, totalEstornados: 0,
      totalVencidas: 0, totalUrgentes: 0,
      valorTotal: 0, valorPago: 0, valorPendente: 0,
      porCategoria: {}
    };

    lista.forEach(function(item) {
      var val = parseFloat(String(item.valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      if (!isNaN(val)) resumo.valorTotal += val;

      if (item.tipoLancamento === TIPO_LANCAMENTO_DESP.AVULSO) resumo.totalAvulsos++;
      else resumo.totalRecorrentes++;

      switch (item.status) {
        case STATUS_DESPESA.PENDENTE:              resumo.totalPendentes++;      resumo.valorPendente += val; break;
        case STATUS_DESPESA.AGUARDANDO_DOC:        resumo.totalAguardandoDoc++;  resumo.valorPendente += val; break;
        case STATUS_DESPESA.DOC_RECEBIDO:          resumo.totalDocRecebido++;    resumo.valorPendente += val; break;
        case STATUS_DESPESA.ENVIADO_CONTABILIDADE: resumo.totalEnviadosContab++; resumo.valorPendente += val; break;
        case STATUS_DESPESA.PAGO:                  resumo.totalPagos++;          resumo.valorPago     += val; break;
        case STATUS_DESPESA.CANCELADO:             resumo.totalCancelados++;     break;
        case STATUS_DESPESA.ESTORNADO:             resumo.totalEstornados++;     break;
      }

      var statusFinalizado = item.status === STATUS_DESPESA.PAGO || item.status === STATUS_DESPESA.CANCELADO || item.status === STATUS_DESPESA.ESTORNADO;
      if (item.statusVencimento === "VENCIDO" && !statusFinalizado) resumo.totalVencidas++;
      if (item.statusVencimento === "URGENTE" && !statusFinalizado) resumo.totalUrgentes++;

      var cat = item.categoria || "Outra";
      if (!resumo.porCategoria[cat]) resumo.porCategoria[cat] = { qtd: 0, valor: 0 };
      resumo.porCategoria[cat].qtd++;
      resumo.porCategoria[cat].valor += val;
    });

    function fmt(v) { return v.toFixed(2).replace(".", ","); }
    resumo.valorTotalFmt    = "R$ " + fmt(resumo.valorTotal);
    resumo.valorPagoFmt     = "R$ " + fmt(resumo.valorPago);
    resumo.valorPendenteFmt = "R$ " + fmt(resumo.valorPendente);

    return { ok: true, resumo: resumo };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/* ================= HTMLS DE NOTIFICAÇÃO ================= */

function montarHtmlDocRecebidoDesp_(nome, valor, vencBr, numero, nomesArqs, obs) {
  var listaArqs = (nomesArqs || []).map(function(n, i) {
    return '<div style="padding:6px 10px;background:#eff6ff;border-radius:8px;font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:6px;">📋 ' + (i + 1) + '. ' + n + '</div>';
  }).join("");
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #1565C0;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">SISGEP — Documento Fiscal Recebido</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#1565C0;margin:0 0 16px;">📋 Documento Recebido!</h2>' +
        '<p style="color:#475569;margin:0 0 16px;line-height:1.7;">O documento fiscal foi recebido e salvo no Drive.</p>' +
        '<div style="background:#eff6ff;border:1px solid #93c5fd;border-left:4px solid #1565C0;border-radius:10px;padding:16px 18px;margin-bottom:16px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            (numero ? '<tr><td style="padding:5px 0;font-weight:700;width:140px;">Nº Despesa:</td><td>' + numero + '</td></tr>' : '') +
            '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td><strong>' + nome + '</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong>' + valor + '</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
          '</table>' +
        '</div>' +
        (listaArqs ? '<div style="margin-bottom:12px;"><strong style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Arquivo(s)</strong><div style="margin-top:8px;">' + listaArqs + '</div></div>' : '') +
        (obs ? '<div style="padding:10px 12px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#78350f;line-height:1.6;"><strong>Obs:</strong> ' + obs + '</div>' : '') +
        '<p style="color:#475569;font-size:13px;margin-top:14px;">Despesa atualizada para <strong>DOC_RECEBIDO</strong>. Pronta para envio à contabilidade.</p>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES</div>' +
      '</div>' +
    '</div>'
  );
}

function montarHtmlEnvioContabilidadeDesp_(despesas, totalValor, emailRemetente) {
  var linhasDespesas = despesas.map(function(d, i) {
    var badgeLanc = d.tipoLanc === TIPO_LANCAMENTO_DESP.AVULSO
      ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:2px 6px;font-weight:700;">AVULSO</span>'
      : '<span style="font-size:10px;background:#e0f2fe;color:#0369a1;border-radius:4px;padding:2px 6px;font-weight:700;">FIXO</span>';
    return (
      '<tr style="background:' + (i % 2 === 0 ? "#f8fafc" : "#fff") + ';">' +
        '<td style="padding:10px 12px;font-weight:700;font-size:12px;white-space:nowrap;">' + (d.numero || "-") + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + d.nome + ' ' + badgeLanc + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:#475569;">' + (d.categoria || "-") + '</td>' +
        '<td style="padding:10px 12px;font-weight:700;font-size:13px;white-space:nowrap;">' + d.valor + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;white-space:nowrap;">' + d.vencimento + '</td>' +
        '<td style="padding:10px 12px;"><a href="' + d.linkConfirm + '" target="_blank" style="display:inline-block;background:#059669;color:#fff;font-weight:700;font-size:12px;padding:6px 14px;border-radius:999px;text-decoration:none;">✅ Confirmar Pago</a></td>' +
      '</tr>'
    );
  }).join("");
  var mesAno = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:820px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #C9A84C;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Prestação de Contas — ' + mesAno + '</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#001f4d;margin:0 0 8px;">📤 Encaminhamento de Despesas</h2>' +
        '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">Relação de despesas de <strong>' + mesAno + '</strong> para processamento contábil. Documentos em anexo quando disponíveis.</p>' +
        '<div style="background:#f0f4f8;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
          '<div><span style="font-size:12px;color:#475569;">Total de despesas</span><br><strong style="font-size:22px;color:#001f4d;">' + despesas.length + '</strong></div>' +
          '<div style="text-align:right;"><span style="font-size:12px;color:#475569;">Valor total estimado</span><br><strong style="font-size:22px;color:#C9A84C;">R$ ' + totalValor.toFixed(2).replace(".", ",") + '</strong></div>' +
        '</div>' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr style="background:#001f4d;color:#fff;">' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Nº</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Prestador / Despesa</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Categoria</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Valor</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Vencimento</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:12px;">Ação</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasDespesas + '</tbody>' +
        '</table></div>' +
        '<p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.7;">Após efetuar cada pagamento, clique em <strong>✅ Confirmar Pago</strong> para registrar a baixa automaticamente no SISGEP.</p>' +
        '<p style="margin:6px 0 0;color:#475569;font-size:12px;">Dúvidas: ' + emailRemetente + ' · (27) 99813-5965</p>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">Gerado automaticamente pelo SISGEP · SindEducação-ES</div>' +
      '</div>' +
    '</div>'
  );
}

function montarHtmlConfirmacaoPagamentoDesp_(nome, valor, dataPagamento, banco, observacao, numero) {
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #059669;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">SISGEP — Pagamento Confirmado</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#059669;margin:0 0 16px;">✅ Pagamento Confirmado pela Contabilidade!</h2>' +
        '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">Baixa registrada automaticamente no SISGEP.</p>' +
        '<div style="background:#f0fdf4;border:1px solid #6ee7b7;border-left:4px solid #059669;border-radius:10px;padding:16px 18px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            (numero ? '<tr><td style="padding:5px 0;font-weight:700;width:140px;">Nº Despesa:</td><td>' + numero + '</td></tr>' : '') +
            '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td>' + nome + '</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong>' + valor + '</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Data de Pagamento:</td><td><strong>' + dataPagamento + '</strong></td></tr>' +
            (banco ? '<tr><td style="padding:5px 0;font-weight:700;">Banco/Forma:</td><td>' + banco + '</td></tr>' : '') +
            (observacao ? '<tr><td style="padding:5px 0;font-weight:700;">Observação:</td><td>' + observacao + '</td></tr>' : '') +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES</div>' +
      '</div>' +
    '</div>'
  );
}

/* ================= TRIGGER: INSTALAR / REMOVER ================= */

function instalarTriggerAlertasD5() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarEDispararAlertasD5") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarEDispararAlertasD5").timeBased().everyDays(1).atHour(8).create();
  Logger.log("✅ Trigger D-5 instalado — executa diariamente às 8h.");
  return { ok: true, mensagem: "Trigger D-5 instalado com sucesso — executa diariamente às 8h." };
}

function removerTriggerAlertasD5() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarEDispararAlertasD5") { ScriptApp.deleteTrigger(t); Logger.log("Trigger D-5 removido."); }
  });
  return { ok: true, mensagem: "Trigger D-5 removido." };
}

/* ================= TESTES OPERACIONAIS ================= */

function testeSetupModuloDespesas() {
  var resultado = setupModuloDespesas();
  Logger.log(JSON.stringify(resultado));
  return resultado;
}

function testeRegistrarLancamentoRecorrente() {
  return registrarLancamentoDespesa_({
    tipoLancamento: TIPO_LANCAMENTO_DESP.RECORRENTE,
    categoria:      CATEGORIAS_DESPESA.CONTA_MENSAL,
    prestadorNome:  "EDP - Sala Térreo",
    descricao:      "Energia elétrica — sala térreo",
    valor:          "variável",
    dataVencimento: "08/06/2026",
    quemAgendou:    "Automático",
    tipoDoc:        "Boleto"
  });
}

function testeRegistrarLancamentoAvulso() {
  return registrarLancamentoDespesa_({
    tipoLancamento: TIPO_LANCAMENTO_DESP.AVULSO,
    categoria:      CATEGORIAS_DESPESA.MATERIAL,
    prestadorNome:  "Mercado do Bairro",
    descricao:      "Material de limpeza — maio/2026",
    valor:          "R$ 87,50",
    dataVencimento: "15/05/2026",
    quemAgendou:    "Marcelha",
    tipoDoc:        "Cupom Fiscal / Recibo"
  });
}

function testeListarDespesas() {
  var resultado = listarDespesas({});
  Logger.log("Total: " + resultado.total);
  if (resultado.lista.length) Logger.log(JSON.stringify(resultado.lista.slice(0, 3)));
  return resultado;
}

function testeResumoDespesas() {
  var resultado = obterResumoDespesas();
  Logger.log(JSON.stringify(resultado));
  return resultado;
}

function testeGerarLancamentosAutomaticos() {
  gerarLancamentosAutomaticos_();
  return { ok: true, mensagem: "Verificação de lançamentos automáticos concluída. Veja o log." };
}

function testeDisparateAlertasD5() {
  verificarEDispararAlertasD5();
  return { ok: true, mensagem: "Verificação D-5 executada. Veja o log." };
}

/* ================= ENVIO MANUAL DE LEMBRETES ================= */

/**
 * Dispara lembrete manual para um ou mais prestadores pelo painel admin.
 * payload: { rowIndexes: [2, 5, 10], forcarReenvio: true }
 * Gera novo token a cada envio (substitui o anterior).
 */
function enviarLembretePrestadoresManual(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var rowIndexes    = Array.isArray(payload.rowIndexes) ? payload.rowIndexes : [];
    var forcarReenvio = payload.forcarReenvio !== false;

    if (!rowIndexes.length) return { ok: false, mensagem: "Nenhum prestador selecionado." };

    var resultado = listarPrestadoresDesp({}, tokenSessao);
    var todos     = resultado.lista || [];

    var urlBase  = ScriptApp.getService().getUrl();
    var saudacao = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Olá";

    var enviados  = [];
    var ignorados = [];
    var erros     = [];

    rowIndexes.forEach(function(rowIndex) {
      try {
        var p = null;
        for (var i = 0; i < todos.length; i++) {
          if (Number(todos[i].rowIndex) === Number(rowIndex)) { p = todos[i]; break; }
        }
        if (!p)        { ignorados.push({ rowIndex: rowIndex, motivo: "Prestador não encontrado." }); return; }
        if (!p.email)  { ignorados.push({ nome: p.nome,      motivo: "Sem e-mail cadastrado."    }); return; }

        // Vencimento do mês corrente
        var diaNum = parseInt(String(p.diaVenc || "").replace(/\D/g, ""), 10);
        var vencBr = "";
        if (!isNaN(diaNum)) {
          var hj       = new Date();
          var ultimoDia = new Date(hj.getFullYear(), hj.getMonth() + 1, 0).getDate();
          var dia      = Math.min(diaNum, ultimoDia);
          var dtVenc   = new Date(hj.getFullYear(), hj.getMonth(), dia);
          var pad      = function(n) { return n < 10 ? "0" + n : n; };
          vencBr = pad(dtVenc.getDate()) + "/" + pad(dtVenc.getMonth() + 1) + "/" + dtVenc.getFullYear();
        }

        // Gera token
        var idTemp = "PREST_LEMBRETE_" + rowIndex + "_" + new Date().getTime();
        var token  = Utilities.getUuid().replace(/-/g, "");
        PropertiesService.getScriptProperties().setProperty(
          "TOKEN_FORN_DESP_" + token,
          JSON.stringify({
            idDespesa: idTemp,
            criado:    new Date().getTime(),
            expira:    new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
          })
        );
        var linkUpload = urlBase + "?page=pub-nf-despesa&token=" + token;

        var valorExib = p.valor || "a confirmar";
        var ehVar = !p.valor || normalizarTextoDesp_(p.valor).indexOf("vari") > -1;
        if (ehVar) valorExib = "variável (a confirmar)";

        // Envia e-mail
        MailApp.sendEmail({
          to:       p.email,
          subject:  "📋 Lembrete: Envie seu documento fiscal — " + p.nome,
          htmlBody: montarHtmlLembreteManual_(p.nome, valorExib, vencBr, p.descricao || p.nome, linkUpload, saudacao),
          name:     "SindEducação-ES",
          bcc:      EMAILS_FINANCEIRO_DESPESAS.join(",")
        });

        // Monta link WhatsApp e retorna na resposta
        var linkWhatsapp = "";
        if (p.whatsapp) {
          var fone = String(p.whatsapp).replace(/\D/g, "");
          if (fone.length >= 10) {
            var telFull  = (fone.length === 10 || fone.length === 11) ? "55" + fone : fone;
            var textoWpp = encodeURIComponent(
              saudacao + ", " + p.nome + "! 👋\n\n" +
              "Lembrete do SindEducação-ES:\n\n" +
              "Por favor, envie seu documento fiscal (NF/Recibo) pelo link abaixo:\n" +
              (vencBr ? "📅 Vencimento: " + vencBr + "\n" : "") +
              "💰 Valor: " + valorExib + "\n\n" +
              "🔗 " + linkUpload + "\n\n" +
              "Dúvidas: (27) 99813-5965"
            );
            linkWhatsapp = "https://wa.me/" + telFull + "?text=" + textoWpp;
            Logger.log("WhatsApp lembrete manual [" + p.nome + "]: " + linkWhatsapp);
          }
        }

        enviados.push({ nome: p.nome, email: p.email, whatsapp: p.whatsapp, linkWhatsapp: linkWhatsapp });
        Logger.log("✅ Lembrete manual enviado: [" + p.nome + "] → " + p.email);

      } catch (eItem) {
        erros.push({ rowIndex: rowIndex, erro: eItem.message });
        Logger.log("⚠ Erro lembrete manual rowIndex=" + rowIndex + ": " + eItem.message);
      }
    });

    var msgRet = enviados.length + " lembrete(s) enviado(s) com sucesso.";
    if (ignorados.length) msgRet += " " + ignorados.length + " ignorado(s) (sem e-mail ou não encontrado).";
    if (erros.length)     msgRet += " " + erros.length + " erro(s).";

    return {
      ok:        enviados.length > 0 || (ignorados.length === 0 && erros.length === 0),
      enviados:  enviados,
      ignorados: ignorados,
      erros:     erros,
      mensagem:  msgRet
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar lembretes: " + e.message };
  }
}
function montarHtmlLembreteManual_(nome, valor, vencBr, descricao, linkUpload, saudacao) {
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid #C9A84C;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gestão de Processos — SISGEP</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#001f4d;margin:0 0 8px;">📋 Solicitação de Documento Fiscal</h2>' +
        '<p style="color:#475569;margin:0 0 6px;line-height:1.7;">' + saudacao + ', <strong>' + nome + '</strong>! Tudo bem?</p>' +
        '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">Gostaríamos de solicitar o envio do seu documento fiscal (NF ou recibo) referente ao serviço prestado ao SindEducação-ES.</p>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #C9A84C;border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<tr><td style="padding:5px 0;font-weight:700;width:130px;">Prestador:</td><td>' + nome + '</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong style="font-size:16px;">' + valor + '</strong></td></tr>' +
            (vencBr ? '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' : '') +
            (descricao && descricao !== nome ? '<tr><td style="padding:5px 0;font-weight:700;">Referente a:</td><td>' + descricao + '</td></tr>' : '') +
          '</table>' +
        '</div>' +
        '<div style="text-align:center;margin:0 0 16px;">' +
          '<a href="' + linkUpload + '" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#001f4d,#1565C0);color:#fff;font-weight:800;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(0,31,77,.3);">📎 Enviar Documento Fiscal</a>' +
        '</div>' +
        '<p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;">Ou copie e cole este link:<br><span style="color:#1565C0;">' + linkUpload + '</span></p>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES · financeiro@sindeducacao.com · (27) 99813-5965</div>' +
      '</div>' +
    '</div>'
  );
}
function montarHtmlConfirmacaoPrestador_(nome, valor, vencBr, numero, nomesArqs) {
  var listaArqs = (nomesArqs || []).map(function(n, i) {
    return '<div style="padding:6px 10px;background:#f0fdf4;border-radius:8px;font-size:13px;font-weight:600;color:#065f46;margin-bottom:6px;">✅ '+(i+1)+'. '+n+'</div>';
  }).join("");
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid #C9A84C;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gestão de Processos — SISGEP</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
          '<div style="font-size:52px;line-height:1;margin-bottom:12px;">✅</div>' +
          '<h2 style="color:#059669;margin:0 0 8px;font-size:20px;">Documento Recebido com Sucesso!</h2>' +
          '<p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">Obrigado, <strong>'+nome+'</strong>! Recebemos seu documento fiscal e nossa equipe financeira já foi notificada.</p>' +
        '</div>' +
        '<div style="background:#f0fdf4;border:1px solid #6ee7b7;border-left:4px solid #059669;border-radius:10px;padding:16px 18px;margin-bottom:16px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            (numero && numero.indexOf("LEMBRETE") === -1 ? '<tr><td style="padding:5px 0;font-weight:700;width:130px;">Nº Despesa:</td><td>'+numero+'</td></tr>' : '') +
            '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td>'+nome+'</td></tr>' +
            (valor ? '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong>'+valor+'</strong></td></tr>' : '') +
            (vencBr ? '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>'+vencBr+'</td></tr>' : '') +
            '<tr><td style="padding:5px 0;font-weight:700;">Recebido em:</td><td>'+agoraFormatadoDesp_()+'</td></tr>' +
          '</table>' +
        '</div>' +
        (listaArqs ? '<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Arquivo(s) recebido(s)</div>'+listaArqs+'</div>' : '') +
        '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:14px 16px;text-align:center;">' +
          '<p style="font-size:13px;color:#1d4ed8;margin:0;line-height:1.6;">Dúvidas? Entre em contato com nossa equipe:<br>' +
          '<strong>Marcelha</strong> · (27) 99735-8900 · financeiro@sindeducacao.com</p>' +
        '</div>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES · financeiro@sindeducacao.com · (27) 99813-5965</div>' +
      '</div>' +
    '</div>'
  );
}
function despesas_registrarLeituraEmail(tokenPixel) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("PIXEL_DOC_" + tokenPixel);
    if (!raw) return;
    var dados = JSON.parse(raw);
    Logger.log("📧 E-mail aberto — Prestador: " + dados.nome + " | Nº: " + dados.numero + " | Em: " + agoraFormatadoDesp_());
    PropertiesService.getScriptProperties().deleteProperty("PIXEL_DOC_" + tokenPixel);
  } catch(e) {
    Logger.log("registrarLeituraEmail: " + e.message);
  }
}
/**
 * Salva e-mail/WhatsApp na despesa e dispara o lembrete de solicitação de NF.
 * Chamado pelo painel "Solicitar NF" / "Reenviar NF".
 * payload: { idDespesa, email, whatsapp }
 */
function solicitarNFDespesa(payload) {
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    var email     = String(payload.email     || "").trim();
    var whatsapp  = String(payload.whatsapp  || "").trim();

    if (!idDespesa) return { ok: false, mensagem: "ID da despesa não informado." };
    if (!email)     return { ok: false, mensagem: "E-mail não informado." };

    // 1. Localiza a despesa
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var nome      = get("PRESTADOR_NOME");
    var valor     = get("VALOR");
    var vencimento = get("DATA_VENCIMENTO");
    var descricao = get("DESCRICAO") || nome;
    var numero    = get("NUMERO_DESPESA");
    var vencBr    = formatarDataBRDesp_(vencimento);
    var saudacao  = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Olá";

    // 2. Atualiza e-mail/WhatsApp e status na planilha
    atualizarCamposDespesa_(idDespesa, {
      "PRESTADOR_EMAIL": email,
      "PRESTADOR_WHATS": whatsapp,
      "STATUS":           STATUS_DESPESA.AGUARDANDO_DOC,
      "DATA_ALERTA_D5":   agoraFormatadoDesp_()
    });

    // 3. Gera token e link de upload
    var token      = gerarTokenFornecedorDespesa_(idDespesa);
    var urlBase    = ScriptApp.getService().getUrl();
    var linkUpload = urlBase + "?page=pub-nf-despesa&token=" + token;

    // Atualiza token e link na planilha
    atualizarCamposDespesa_(idDespesa, {
      "TOKEN_FORNECEDOR": token,
      "LINK_FORNECEDOR":  linkUpload
    });

    // 4. Envia e-mail
    var assunto = "📋 Solicitação de Documento Fiscal — " + nome;
    MailApp.sendEmail({
      to:       email,
      subject:  assunto,
      htmlBody: montarHtmlLembreteManual_(nome, valor, vencBr, descricao, linkUpload, saudacao),
      name:     "SindEducação-ES",
      bcc:      EMAILS_FINANCEIRO_DESPESAS.join(",")
    });

    // 5. Log WhatsApp se tiver número
    if (whatsapp) {
      var fone = String(whatsapp).replace(/\D/g, "");
      if (fone.length >= 10) {
        var telFull  = (fone.length === 10 || fone.length === 11) ? "55" + fone : fone;
        var textoWpp = encodeURIComponent(
          saudacao + ", " + nome + "! 👋\n\n" +
          "Lembrete do SindEducação-ES:\n\n" +
          "Por favor, envie seu documento fiscal pelo link abaixo:\n" +
          (vencBr ? "📅 Vencimento: " + vencBr + "\n" : "") +
          "💰 Valor: " + valor + "\n\n" +
          "🔗 " + linkUpload + "\n\n" +
          "Dúvidas: (27) 99813-5965"
        );
        Logger.log("WhatsApp NF [" + nome + "]: https://wa.me/" + telFull + "?text=" + textoWpp);
      }
    }

    Logger.log("✅ solicitarNFDespesa: [" + nome + "] → " + email);
    return {
      ok:      true,
      numero:  numero,
      mensagem: "Solicitação enviada com sucesso para " + email + "."
    };

  } catch (e) {
    Logger.log("❌ solicitarNFDespesa: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}
function cancelarEnvioDespesaLote(idDespesa) {
  try {
    var idDespesa = String(idDespesa || "").trim();
    if(!idDespesa) return { ok: false, mensagem: "ID não informado." };
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if(!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };
    atualizarCamposDespesa_(idDespesa, {
      "STATUS":               STATUS_DESPESA.PENDENTE,
      "LINK_DOCUMENTO":       "",
      "FILE_ID_DOCUMENTO":    "",
      "NOME_ARQUIVO":         "",
      "DATA_RECEBIMENTO_DOC": "",
      "OBSERVACOES":          "Envio cancelado manualmente em " + agoraFormatadoDesp_()
    });
    return { ok: true, mensagem: "Despesa devolvida para PENDENTE." };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}
// =============================================================================
// ARQUIVO: Despesas_Novas_Funcoes.gs
// Adicionar ao projeto junto com Despesas.gs
// Contém: gerarDespesasEmLote, duplicarDespesa, ajustarRecorrencia,
//         validarCnpjNFDespesa, obterCnpjPrestadorDespesa
// =============================================================================

/* ===============================================================
   1. GERAÇÃO EM LOTE
   Cria despesas recorrentes do mês/ano solicitado para todos os
   prestadores ativos. Pula quem já foi gerado naquele mês.
   payload: { mes: "06", ano: "2026" }  (strings)
   =============================================================== */
function gerarDespesasEmLote(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var pad = function(n) { return n < 10 ? "0" + n : n; };

    var mes = parseInt(String(payload.mes || "").trim(), 10);
    var ano = parseInt(String(payload.ano || "").trim(), 10);

    if (isNaN(mes) || mes < 1 || mes > 12) {
      var hoje = new Date();
      mes = hoje.getMonth() + 1;
      ano = hoje.getFullYear();
    }
    if (isNaN(ano) || ano < 2020) ano = new Date().getFullYear();

    var prestadores = listarPrestadoresAtivosComCache_();
    if (!prestadores.length) {
      return { ok: false, mensagem: "Nenhum prestador ativo encontrado." };
    }

    var gerados   = [];
    var ignorados = [];
    var erros     = [];

    prestadores.forEach(function(p) {
      try {
        var nome    = String(p.nome    || "").trim();
        var diaVenc = String(p.diaVenc || "").trim();

        if (!nome) { ignorados.push({ nome: "(sem nome)", motivo: "Nome vazio." }); return; }

        var diaNum = parseInt(String(diaVenc).replace(/\D/g, ""), 10);
        if (isNaN(diaNum)) {
          ignorados.push({ nome: nome, motivo: "Sem dia de vencimento numérico (" + diaVenc + ")." });
          return;
        }

        var ultimoDia = new Date(ano, mes, 0).getDate();
        var dia       = Math.min(diaNum, ultimoDia);
        var dataVencDate = new Date(ano, mes - 1, dia);
        var dataVencStr = pad(dia) + "/" + pad(mes) + "/" + ano;

        if (jaExisteLancamentoMesDesp_(nome, dataVencStr)) {
          ignorados.push({ nome: nome, motivo: "Já gerado para " + dataVencStr + "." });
          return;
        }

        var valorBruto = String(p.valor || "").trim().toLowerCase();
        var ehVariavel = !valorBruto || valorBruto.indexOf("vari") > -1 || valorBruto.indexOf("cart") > -1;
        var valor      = ehVariavel ? "variável" : String(p.valor || "").trim();

        var resultado = registrarLancamentoDespesa_({
          tipoLancamento: TIPO_LANCAMENTO_DESP.RECORRENTE,
          categoria:      p.categoria   || CATEGORIAS_DESPESA.FORNECEDOR_FIXO,
          prestadorNome:  nome,
          prestadorDoc:   p.documento   || "",
          prestadorEmail: p.email       || "",
          prestadorWhats: p.whatsapp    || "",
          descricao:      p.descricao   || nome,
          valor:          valor,
          dataVencimento: dataVencStr,
          quemAgendou:    p.quemAgenda  || "Automático",
          tipoDoc:        p.tipoDoc     || "NF"
        });

        if (resultado.ok) {
          gerados.push({ nome: nome, numero: resultado.numeroDespesa, vencimento: dataVencStr });
        } else {
          erros.push({ nome: nome, erro: resultado.mensagem });
        }
      } catch(eItem) {
        erros.push({ nome: String(p.nome || "?"), erro: eItem.message });
      }
    });

    var mesAno = pad(mes) + "/" + ano;
    var msg = gerados.length + " despesa(s) gerada(s) para " + mesAno + ".";
    if (ignorados.length) msg += " " + ignorados.length + " já existia(m) ou sem dia de vencimento.";
    if (erros.length)     msg += " " + erros.length + " erro(s).";

    return {
      ok:        gerados.length > 0 || (erros.length === 0 && ignorados.length > 0),
      gerados:   gerados,
      ignorados: ignorados,
      erros:     erros,
      total:     gerados.length,
      mensagem:  msg
    };

  } catch(e) {
    Logger.log("❌ gerarDespesasEmLote: " + e.message);
    return { ok: false, mensagem: "Erro ao gerar em lote: " + e.message };
  }
}

/* ===============================================================
   2. DUPLICAR DESPESA
   Clona uma despesa existente com novo vencimento.
   payload: { idDespesa: "...", novoVencimento: "DD/MM/YYYY" }
   =============================================================== */
function duplicarDespesa(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    payload = payload || {};
    var idOrigem      = String(payload.idDespesa      || "").trim();
    var novoVencimento = String(payload.novoVencimento || "").trim();

    if (!idOrigem)       return { ok: false, mensagem: "ID da despesa não informado." };
    if (!novoVencimento) return { ok: false, mensagem: "Novo vencimento não informado." };

    var despInfo = localizarLinhaDespesaPorId_(idOrigem);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

    var resultado = registrarLancamentoDespesa_({
      tipoLancamento: get("TIPO_LANCAMENTO") || TIPO_LANCAMENTO_DESP.RECORRENTE,
      categoria:      get("CATEGORIA"),
      prestadorNome:  get("PRESTADOR_NOME"),
      prestadorDoc:   get("PRESTADOR_DOC"),
      prestadorEmail: get("PRESTADOR_EMAIL"),
      prestadorWhats: get("PRESTADOR_WHATS"),
      descricao:      get("DESCRICAO"),
      valor:          get("VALOR"),
      dataVencimento: novoVencimento,
      quemAgendou:    get("QUEM_AGENDOU"),
      tipoDoc:        get("TIPO_DOC"),
      observacoes:    "Duplicado de " + get("NUMERO_DESPESA") + " em " + agoraFormatadoDesp_()
    });

    if (!resultado.ok) return resultado;

    return {
      ok:           true,
      numeroDespesa: resultado.numeroDespesa,
      idDespesa:    resultado.idDespesa,
      mensagem:     "Despesa duplicada com sucesso: " + resultado.numeroDespesa
    };

  } catch(e) {
    Logger.log("❌ duplicarDespesa: " + e.message);
    return { ok: false, mensagem: "Erro ao duplicar: " + e.message };
  }
}

/* ===============================================================
   3. AJUSTE DE RECORRÊNCIA
   Atualiza o valor de um prestador e, opcionalmente, aplica o
   novo valor a todas as despesas PENDENTES/AGUARDANDO_DOC deste
   prestador.
   payload: {
     rowIndex:      2,
     novoValor:     "R$ 1.200,00",
     aplicarPendentes: true   // se true, atualiza despesas abertas
   }
   =============================================================== */
function ajustarRecorrencia(payload) {
  try {
    payload = payload || {};
    var rowIndex          = parseInt(String(payload.rowIndex || "0"), 10);
    var novoValor         = String(payload.novoValor || "").trim();
    var aplicarPendentes  = payload.aplicarPendentes !== false;

    if (rowIndex < 2)  return { ok: false, mensagem: "Linha do prestador inválida." };
    if (!novoValor)    return { ok: false, mensagem: "Novo valor não informado." };

    // Atualiza cadastro do prestador
    var aba     = garantirAbaPrestadoresDesp_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });
    var idxValor = headers.indexOf("Valor");
    if (idxValor === -1) return { ok: false, mensagem: "Coluna Valor não encontrada." };

    // Lê o nome do prestador para localizar despesas
    var idxNome = headers.indexOf("Nome do Prestador");
    if (idxNome === -1) idxNome = headers.indexOf("Nome do Fornecedor");
    var nomePrestador = idxNome > -1
      ? String(aba.getRange(rowIndex, idxNome + 1).getValue() || "").trim()
      : "";

    aba.getRange(rowIndex, idxValor + 1).setValue(novoValor);
    invalidarCachePrestadoresDesp_();

    if (!aplicarPendentes || !nomePrestador) {
      return { ok: true, mensagem: "Valor do prestador atualizado.", atualizadas: 0 };
    }

    // Atualiza despesas PENDENTE e AGUARDANDO_DOC do prestador
    var abaDesp   = obterAbaDesp_();
    var lastRow   = abaDesp.getLastRow();
    var atualizadas = 0;

    if (lastRow >= 2) {
      var dadosDesp   = abaDesp.getDataRange().getValues();
      var headersDesp = dadosDesp[0].map(function(h) { return String(h || "").trim(); });
      var idxNomeDesp   = headersDesp.indexOf("PRESTADOR_NOME");
      var idxStatusDesp = headersDesp.indexOf("STATUS");
      var idxValorDesp  = headersDesp.indexOf("VALOR");
      var idxUltAt      = headersDesp.indexOf("ULTIMA_ATUALIZACAO");
      var nomeNorm      = normalizarTextoDesp_(nomePrestador);

      for (var i = 1; i < dadosDesp.length; i++) {
        var nomeRow   = normalizarTextoDesp_(String(dadosDesp[i][idxNomeDesp]   || ""));
        var statusRow = String(dadosDesp[i][idxStatusDesp] || "").trim();
        if (nomeRow !== nomeNorm) continue;
        if (statusRow !== STATUS_DESPESA.PENDENTE && statusRow !== STATUS_DESPESA.AGUARDANDO_DOC) continue;
        if (idxValorDesp > -1) abaDesp.getRange(i + 1, idxValorDesp + 1).setValue(novoValor);
        if (idxUltAt    > -1) abaDesp.getRange(i + 1, idxUltAt    + 1).setValue(new Date());
        atualizadas++;
      }
    }

    return {
      ok:         true,
      atualizadas: atualizadas,
      mensagem:   "Valor atualizado. " + atualizadas + " despesa(s) pendente(s) atualizada(s)."
    };

  } catch(e) {
    Logger.log("❌ ajustarRecorrencia: " + e.message);
    return { ok: false, mensagem: "Erro ao ajustar recorrência: " + e.message };
  }
}

/* ===============================================================
   4. VALIDAÇÃO DE CNPJ NA NF
   Retorna o CNPJ/CPF cadastrado do prestador vinculado à despesa
   pelo token. O frontend compara com o que o fornecedor informa.
   =============================================================== */
function obterCnpjPrestadorDespesa(token) {
  try {
    var info = buscarTokenFornecedorDespesa_(token);
    if (!info) return { ok: false, mensagem: "Token inválido." };

    var idDespesa = String(info.idDespesa || "").trim();
    if (idDespesa.indexOf("PREST_LEMBRETE_") === 0) {
      return { ok: true, cnpj: "", ignorar: true };
    }

    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var row = despInfo.row; var headerMap = despInfo.headerMap;
    var cnpj = String(row[(headerMap["PRESTADOR_DOC"] || 0) - 1] || "").trim();

    return { ok: true, cnpj: cnpj, ignorar: !cnpj };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}

/* helper: normaliza CNPJ/CPF para comparação (só dígitos) */
function normalizarDocDesp_(v) {
  return String(v || "").replace(/\D/g, "");
}
