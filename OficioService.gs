// ============================================================================
// ARQUIVO: OficioService.gs
// ============================================================================

var LIMITE_FICHAS_OFICIO = 25;

/**
 * Processa lista de fichas (local ou Google Drive) e retorna base64.
 * @param {Array} fichas - Array de objetos com {base64, nome} ou {driveId}
 * @return {Array} Array de objetos {nome, base64, tipo, origem}
 */
function processarFichasParaOficio(fichas, tokenSessao) {
  /* PORTA ACRESCENTADA EM 01/09/2026 — frente A da auditoria do Modulo 03.
     Devolve dado de escola (razao social, CNPJ, e-mails) e nao tinha checagem
     nenhuma. No Apps Script toda funcao global e endpoint para QUALQUER pagina
     do projeto, inclusive as anonimas que o Code.gs serve. Ver a nota do t125. */
  exigirModulo_(tokenSessao, "documentos", false);
  if (!Array.isArray(fichas) || !fichas.length) return [];

  if (fichas.length > LIMITE_FICHAS_OFICIO) {
    throw new Error("Limite máximo de " + LIMITE_FICHAS_OFICIO + " fichas por ofício. Recebido: " + fichas.length + ".");
  }

  var resultados = [];
  var erros      = [];

  for (var i = 0; i < fichas.length; i++) {
    var ficha   = fichas[i];
    var posicao = i + 1;

    try {
      var resultado;

      // Caso 1: Upload local (já vem em base64 do frontend)
      if (ficha.base64 && ficha.nome) {
        resultado = {
          nome:   ficha.nome,
          base64: ficha.base64,
          tipo:   ficha.tipo || "application/pdf",
          origem: "local"
        };

      // Caso 2: Google Drive
      } else if (ficha.driveId) {
        var arquivo = DriveApp.getFileById(ficha.driveId);
        var blob    = arquivo.getBlob();
        resultado = {
          nome:   ficha.nome || arquivo.getName(),
          base64: Utilities.base64Encode(blob.getBytes()),
          tipo:   ficha.tipo || arquivo.getMimeType(),
          origem: "drive"
        };

      } else {
        throw new Error(
          "Formato de ficha não reconhecido. Campos recebidos: " +
          Object.keys(ficha).join(", ")
        );
      }

      resultados.push(resultado);
      Logger.log("[OFÍCIO] Ficha " + posicao + " processada: " + resultado.nome + " (" + resultado.origem + ")");

    } catch (error) {
      var nomeFicha = ficha.nome || "Ficha #" + posicao;
      erros.push({ posicao: posicao, nome: nomeFicha, erro: error.message });
      Logger.log("[OFÍCIO] ❌ Erro na ficha " + posicao + ": " + error.message);
    }
  }

  if (erros.length > 0) {
    throw new Error(
      "Falha ao processar " + erros.length + " ficha(s):\n" +
      erros.map(function(e) { return "• " + e.nome + ": " + e.erro; }).join("\n")
    );
  }

  return resultados;
}

/**
 * Gera ofício com suporte a fichas locais e do Drive.
 * @param {object} dados - Dados do ofício + array de fichas
 * @return {object} Resultado da geração
 */
function gerarOficioWebComFichas(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    var fichasProcessadas = dados.fichas
      ? processarFichasParaOficio(dados.fichas)
      : [];

    var payload = Object.assign({}, dados, { fichas: fichasProcessadas });
    return gerarOficioWeb(payload, tokenSessao);

  } catch (error) {
    Logger.log("[OFÍCIO] Erro ao gerar: " + error.message);
    return { erro: true, mensagem: error.message };
  }
}