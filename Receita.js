// ================================
// ARQUIVO: Receitas.gs
// MÓDULO: GESTÃO DE RECEITAS
// SISGEP
// ================================

const ABA_RECEITAS = "RECEITAS";

/* =========================================
 * GARANTIR ESTRUTURA
 * ========================================= */
function garantirEstruturaReceitas_() {

  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  let sh = ss.getSheetByName(ABA_RECEITAS);

  if (!sh) {
    sh = ss.insertSheet(ABA_RECEITAS);
  }

  if (sh.getLastRow() === 0) {

    sh.appendRow([
      "ID_RECEITA",
      "DATA_CADASTRO",
      "TIPO",
      "CATEGORIA",
      "DESCRICAO",
      "EMPRESA",
      "CNPJ",
      "VALOR",
      "FORMA_RECEBIMENTO",
      "DATA_RECEBIMENTO",
      "COMPETENCIA",
      "STATUS",
      "OBSERVACOES",
      "USUARIO",
      "LINK_COMPROVANTE"
    ]);

  }

}

/* =========================================
 * GERAR ID
 * ========================================= */
function gerarIdReceita_() {
  return "REC-" + Utilities.getUuid()
    .substring(0, 8)
    .toUpperCase();
}

/* =========================================
 * FORMATAR VALOR
 * ========================================= */
function normalizarValorReceita_(valor) {

  if (valor === null || valor === undefined) {
    return 0;
  }

  const texto = String(valor)
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = parseFloat(texto);

  return isNaN(numero) ? 0 : numero;

}

/* =========================================
 * CADASTRAR RECEITA
 * ========================================= */
function cadastrarReceita(dados, tokenSessao) {

  try {

    exigirSessaoDocumentos_(tokenSessao, false);

    garantirEstruturaReceitas_();

    dados = dados || {};

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECEITAS);

    const id = gerarIdReceita_();

    const valor = normalizarValorReceita_(dados.valor);

    sh.appendRow([
      id,
      new Date(),
      dados.tipo || "",
      dados.categoria || "",
      dados.descricao || "",
      dados.empresa || "",
      dados.cnpj || "",
      valor,
      dados.formaRecebimento || "",
      dados.dataRecebimento || "",
      dados.competencia || "",
      dados.status || "RECEBIDO",
      dados.observacoes || "",
      Session.getActiveUser().getEmail() || "",
      dados.linkComprovante || ""
    ]);

    return {
      erro: false,
      id: id,
      mensagem: "Receita cadastrada com sucesso."
    };

  } catch (e) {

    return {
      erro: true,
      mensagem: e.message
    };

  }

}

/* =========================================
 * LISTAR RECEITAS
 * ========================================= */
// Não engole erro: devolver [] quando a sessão expirou faz a tela mostrar
// "nenhuma receita" em vez de "sua sessão expirou" — num painel de dinheiro
// isso é pior do que um erro visível. A falha sobe para o withFailureHandler.
// Único consumidor além da tela é obterResumoReceitas (abaixo), que já trata.
function listarReceitas(tokenSessao) {

  exigirSessaoDocumentos_(tokenSessao, false);

  try {

    garantirEstruturaReceitas_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECEITAS);

    if (!sh || sh.getLastRow() < 2) {
      return [];
    }

    const dados = sh.getDataRange().getValues();

    const cab = dados[0];

    return dados
      .slice(1)
      .reverse()
      .map(function(linha) {

        let obj = {};

        cab.forEach(function(col, i) {
          obj[col] = linha[i];
        });

        return obj;

      });

  } catch (e) {

    return [];

  }

}

/* =========================================
 * RESUMO RECEITAS
 * ========================================= */
function obterResumoReceitas(tokenSessao) {

  try {

    exigirSessaoDocumentos_(tokenSessao, false);

    const receitas = listarReceitas(tokenSessao);

    let total = 0;

    receitas.forEach(function(r) {

      total += Number(r.VALOR || 0);

    });

    return {
      totalReceitas: receitas.length,
      valorTotal: total
    };

  } catch (e) {

    return {
      totalReceitas: 0,
      valorTotal: 0
    };

  }

}

/* =========================================
 * EXCLUIR RECEITA
 * ========================================= */
function excluirReceita(idReceita, tokenSessao) {

  try {

    exigirSessaoDocumentos_(tokenSessao, true);

    garantirEstruturaReceitas_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECEITAS);

    const dados = sh.getDataRange().getValues();

    const cab = dados[0];

    const idxId = cab.indexOf("ID_RECEITA");

    for (let i = dados.length - 1; i >= 1; i--) {

      if (String(dados[i][idxId]) === String(idReceita)) {

        sh.deleteRow(i + 1);

        return {
          erro: false,
          mensagem: "Receita excluída com sucesso."
        };

      }

    }

    return {
      erro: true,
      mensagem: "Receita não encontrada."
    };

  } catch (e) {

    return {
      erro: true,
      mensagem: e.message
    };

  }

}

