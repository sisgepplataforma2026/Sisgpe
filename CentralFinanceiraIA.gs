// ================================================================
// 💼 CentralFinanceiraIA.gs
// SISGEP · Central Financeira IA
// Base estrutural da nova camada financeira inteligente
// ================================================================

var FIN_ABA_PROJETOS        = "FIN_PROJETOS";
var FIN_ABA_FORNECEDORES_IA = "FIN_FORNECEDORES_IA";
var FIN_ABA_CONTRATOS       = "FIN_CONTRATOS";
var FIN_ABA_DOCUMENTOS      = "FIN_DOCUMENTOS";
var FIN_ABA_LOTES_CONTABEIS = "FIN_LOTES_CONTABEIS";
var FIN_ABA_EVENTOS_IA      = "FIN_EVENTOS_IA";
var FIN_ABA_CENTROS_CUSTO   = "FIN_CENTROS_CUSTO";

var FIN_COLUNAS_EXTRAS_DESPESAS = [
  "PROJETO_ID",
  "CENTRO_CUSTO",
  "CONTRATO_ID",
  "DOCUMENTO_ID",
  "LOTE_ID",
  "ORIGEM",
  "IA_STATUS",
  "IA_CONFIANCA",
  "IA_RESUMO"
];

function setupCentralFinanceiraIA() {
  try {
    finGarantirAbasBase_();
    finGarantirColunasDespesas_();

    return {
      ok: true,
      mensagem: "✅ Central Financeira IA configurada com sucesso."
    };

  } catch (e) {
    return {
      ok: false,
      mensagem: "Erro ao configurar Central Financeira IA: " + e.message
    };
  }
}

function finGarantirAbasBase_() {
  finGarantirAba_(
    FIN_ABA_PROJETOS,
    [
      "PROJETO_ID",
      "NOME",
      "TIPO",
      "STATUS",
      "DATA_INICIO",
      "DATA_FIM",
      "ORCAMENTO_PREVISTO",
      "RESPONSAVEL",
      "OBSERVACOES",
      "CRIADO_EM",
      "ATUALIZADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_FORNECEDORES_IA,
    [
      "FORNECEDOR_ID",
      "NOME",
      "DOCUMENTO",
      "EMAIL",
      "WHATSAPP",
      "RECORRENTE",
      "DIA_ESPERADO_NF",
      "DIA_VENCIMENTO_PADRAO",
      "CATEGORIA_PADRAO",
      "CENTRO_CUSTO_PADRAO",
      "FORMA_ENVIO",
      "STATUS",
      "OBSERVACOES",
      "CRIADO_EM",
      "ATUALIZADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_CONTRATOS,
    [
      "CONTRATO_ID",
      "FORNECEDOR_ID",
      "NOME_FORNECEDOR",
      "OBJETO",
      "VALOR_CONTRATADO",
      "DATA_INICIO",
      "DATA_FIM",
      "INDICE_REAJUSTE",
      "PERIODICIDADE",
      "STATUS",
      "LINK_CONTRATO",
      "OBSERVACOES",
      "CRIADO_EM",
      "ATUALIZADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_DOCUMENTOS,
    [
      "DOCUMENTO_ID",
      "TIPO_DOCUMENTO",
      "ORIGEM",
      "FORNECEDOR_ID",
      "NOME_FORNECEDOR",
      "DOCUMENTO_FORNECEDOR",
      "VALOR",
      "COMPETENCIA",
      "DATA_EMISSAO",
      "DATA_VENCIMENTO",
      "FILE_ID",
      "FILE_URL",
      "STATUS",
      "IA_STATUS",
      "IA_CONFIANCA",
      "IA_RESUMO",
      "CRIADO_EM",
      "ATUALIZADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_LOTES_CONTABEIS,
    [
      "LOTE_ID",
      "NUMERO_LOTE",
      "DATA_CRIACAO",
      "STATUS",
      "QTDE_DOCUMENTOS",
      "VALOR_TOTAL",
      "EMAIL_CONTABILIDADE",
      "DATA_ENVIO",
      "DATA_CONFIRMACAO",
      "LINK_OFICIO",
      "OBSERVACOES",
      "CRIADO_POR",
      "ATUALIZADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_EVENTOS_IA,
    [
      "EVENTO_ID",
      "DATA_HORA",
      "TIPO_EVENTO",
      "ORIGEM",
      "ENTIDADE",
      "ENTIDADE_ID",
      "STATUS",
      "MENSAGEM",
      "SUGESTAO_IA",
      "CRIADO_EM"
    ]
  );

  finGarantirAba_(
    FIN_ABA_CENTROS_CUSTO,
    [
      "CENTRO_CUSTO_ID",
      "NOME",
      "DESCRICAO",
      "STATUS",
      "CRIADO_EM",
      "ATUALIZADO_EM"
    ]
  );
}

function finGarantirAba_(nomeAba, cabecalho) {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(nomeAba);

  if (!aba) {
    aba = ss.insertSheet(nomeAba);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    finFormatarCabecalho_(aba, cabecalho.length);
    return aba;
  }

  var lastCol = Math.max(aba.getLastColumn(), 1);
  var headers = aba.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  cabecalho.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var prox = aba.getLastColumn() + 1;
      aba.getRange(1, prox).setValue(col);
      headers.push(col);
    }
  });

  finFormatarCabecalho_(aba, aba.getLastColumn());
  return aba;
}

/**
 * Listas pra popular os selects de Centro de Custo e Projeto no formulário
 * de despesa — achado da auditoria: essas abas já existiam prontas
 * (finGarantirAbasBase_), mas nunca chegaram a ser usadas por nenhuma tela.
 * Garante a estrutura antes de ler, então funciona mesmo se
 * setupCentralFinanceiraIA() nunca tiver sido rodado manualmente.
 */
function finListarCentrosCustoEProjetos(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    finGarantirAbasBase_();
    var ss = SpreadsheetApp.openById(PLANILHA_ID);

    var lerLista = function(nomeAba, idxId, idxNome, idxStatus) {
      var aba = ss.getSheetByName(nomeAba);
      if (!aba || aba.getLastRow() < 2) return [];
      var dados = aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
      var lista = [];
      dados.forEach(function(linha) {
        var status = String(linha[idxStatus] || "").trim().toUpperCase();
        if (status === "INATIVO" || status === "ENCERRADO" || status === "CANCELADO") return;
        var id = String(linha[idxId] || "").trim();
        var nome = String(linha[idxNome] || "").trim();
        if (!id || !nome) return;
        lista.push({ id: id, nome: nome });
      });
      return lista;
    };

    return {
      ok: true,
      centrosCusto: lerLista(FIN_ABA_CENTROS_CUSTO, 0, 1, 3),
      projetos:     lerLista(FIN_ABA_PROJETOS, 0, 1, 3)
    };
  } catch (e) {
    Logger.log("finListarCentrosCustoEProjetos: " + e);
    return { ok: false, mensagem: e.message, centrosCusto: [], projetos: [] };
  }
}

function finFormatarCabecalho_(aba, qtdCols) {
  aba.getRange(1, 1, 1, qtdCols)
    .setFontWeight("bold")
    .setBackground("#001f4d")
    .setFontColor("#ffffff");

  aba.setFrozenRows(1);
}

function finGarantirColunasDespesas_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName("DESPESAS");

  if (!aba) {
    if (typeof garantirAbaDespesas_ === "function") {
      garantirAbaDespesas_();
      aba = ss.getSheetByName("DESPESAS");
    }
  }

  if (!aba) {
    throw new Error("Aba DESPESAS não encontrada.");
  }

  var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  FIN_COLUNAS_EXTRAS_DESPESAS.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var prox = aba.getLastColumn() + 1;
      aba.getRange(1, prox)
        .setValue(col)
        .setFontWeight("bold")
        .setBackground("#001f4d")
        .setFontColor("#ffffff");
      headers.push(col);
    }
  });
}