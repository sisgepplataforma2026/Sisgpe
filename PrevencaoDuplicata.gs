// ================================================================
// 📄 ARQUIVO: PrevencaoDuplicata.gs
// 👉 AÇÃO: Criar NOVO arquivo no GAS
//          Clique no "+" ao lado de "Arquivos" → nomeie "PrevencaoDuplicata"
// ================================================================

function verificarDuplicata(params) {
  try {
    const ss    = SpreadsheetApp.openById(PLANILHA_ID);
    const sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet || sheet.getLastRow() < 2) return { duplicata: false };

    const h         = getHeaderMap_(sheet);
    const colEscola = h["Escola (Razão Social)"];
    const colCnpj   = h["CNPJ"];
    const colTipo   = h["TIPO"] || h["Tipo"];
    const colData   = h["Data envio ofício"];
    const colNumero = h["Número do Ofício"];

    if (!colEscola || !colData) return { duplicata: false };

    const agora     = new Date();
    const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const dados     = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    const buscaEscola = String(params.escola || "").trim().toLowerCase();
    const buscaCnpj   = String(params.cnpj   || "").replace(/\D/g, "");
    const buscaTipo   = String(params.tipo   || "").trim().toLowerCase();

    for (let i = 0; i < dados.length; i++) {
      const linha     = dados[i];
      const escola    = String(linha[colEscola - 1] || "").trim().toLowerCase();
      const cnpj      = String(colCnpj  ? linha[colCnpj  - 1] || "" : "").replace(/\D/g, "");
      const tipo      = String(colTipo  ? linha[colTipo  - 1] || "" : "").trim().toLowerCase();
      const dataEnvio = linha[colData - 1] ? new Date(linha[colData - 1]) : null;
      const numero    = colNumero ? String(linha[colNumero - 1] || "") : "";

      if (!dataEnvio || dataEnvio < limite24h) continue;

      const mesmaEscola = (buscaCnpj && cnpj && buscaCnpj === cnpj)
                       || (buscaEscola && escola && escola.includes(buscaEscola.slice(0, 20)));
      const mesmoTipo   = !buscaTipo || tipo.includes(buscaTipo.slice(0, 8));

      if (!mesmaEscola || !mesmoTipo) continue;

      let dataFmt = "";
      try {
        dataFmt = Utilities.formatDate(dataEnvio, Session.getScriptTimeZone(), "dd/MM/yyyy 'às' HH:mm");
      } catch(e) { dataFmt = String(dataEnvio); }

      return {
        duplicata:       true,
        escola:          String(dados[i][colEscola - 1] || ""),
        numeroExistente: numero,
        dataExistente:   dataFmt
      };
    }

    return { duplicata: false };
  } catch(e) {
    Logger.log("verificarDuplicata erro: " + e.message);
    return { duplicata: false };
  }
}