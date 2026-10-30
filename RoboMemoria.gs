/* ================================================================
   MEMÓRIA DO ROBÔ — 30/10/2026
   ================================================================
   Diretriz do usuário (CLAUDE.md, "O ROBÔ É UM FUNCIONÁRIO QUE APRENDE"):
   "esse robô ... é como se fosse um trabalhador, um funcionário meu. Então,
   eu preciso que ele aprenda, tenha memória evolutiva, vai aprendendo os
   processos, para mais adiante ele fazer todo o processo."

   Um lugar só para o que as pessoas decidiram, de qualquer tarefa:
     - REGISTRAR: o robô sugeriu X, a pessoa decidiu Y (aba Robo_Memoria).
     - USAR: roboMemoriaUltimaDecisao_ devolve o que já se decidiu para o
       mesmo remetente; e as correções de categoria da Secretaria vão também
       para a aba "Exemplos" da ponte, que o leitor põe no pedido à IA.
     - MEDIR: a coluna ACERTOU (o robô acertou?) — é dela que sai, um dia,
       a nota de cada tarefa e a proposta de deixar fazer sozinho.
   Nada aqui decide sozinho: guarda e devolve exemplos.
   ================================================================ */

var ROBO_MEM_ABA = "Robo_Memoria";
var ROBO_MEM_COLUNAS = ["EM", "TAREFA", "ORIGEM", "CHAVE", "REMETENTE", "ASSUNTO", "TRECHO",
                        "SUGERIDO", "DECIDIDO", "ACERTOU", "QUEM"];
var ROBO_MEM_PONTE_ABA = "Exemplos";
var ROBO_MEM_PONTE_COLUNAS = ["EM", "REMETENTE", "ASSUNTO", "TRECHO", "TIPO_IA", "TIPO_CERTO", "QUEM"];

function roboMemAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ROBO_MEM_ABA);
  if (!sh) {
    sh = ss.insertSheet(ROBO_MEM_ABA);
    sh.getRange(1, 1, 1, ROBO_MEM_COLUNAS.length).setValues([ROBO_MEM_COLUNAS]);
  }
  return sh;
}

/**
 * Guarda uma decisão de pessoa. o = { tarefa, origem, chave, remetente,
 * assunto, trecho, sugerido, decidido, quem }. Falhar aqui nunca derruba a
 * ação da pessoa: a memória é registro, não trava.
 */
function roboMemoriaRegistrar_(o) {
  o = o || {};
  try {
    var linha = {
      EM: new Date(), TAREFA: String(o.tarefa || ""), ORIGEM: String(o.origem || ""), CHAVE: String(o.chave || ""),
      REMETENTE: String(o.remetente || "").toLowerCase(), ASSUNTO: String(o.assunto || "").substring(0, 200),
      TRECHO: String(o.trecho || "").replace(/\s+/g, " ").substring(0, 300),
      SUGERIDO: String(o.sugerido || ""), DECIDIDO: String(o.decidido || ""),
      ACERTOU: String(o.sugerido || "") === String(o.decidido || "") ? "SIM" : "NAO", QUEM: String(o.quem || "")
    };
    roboMemAba_().appendRow(ROBO_MEM_COLUNAS.map(function (c) { return linha[c]; }));
    delete ROBO_MEM_CACHE[linha.TAREFA];
    if (o.tarefa === "categoria-email" && String(o.origem || "") === "SECRETARIA" && linha.ACERTOU === "NAO") {
      roboMemoriaExemploPonte_(linha);
    }
    return true;
  } catch (e) {
    Logger.log("Memória do robô: não registrou — " + e.message);
    return false;
  }
}

/* A correção vira exemplo para a IA do leitor (que roda na conta da
   Secretaria e só enxerga a ponte). */
function roboMemoriaExemploPonte_(linha) {
  var ss = vpePonte_();
  var sh = ss.getSheetByName(ROBO_MEM_PONTE_ABA);
  if (!sh) {
    sh = ss.insertSheet(ROBO_MEM_PONTE_ABA);
    sh.getRange(1, 1, 1, ROBO_MEM_PONTE_COLUNAS.length).setValues([ROBO_MEM_PONTE_COLUNAS]);
  }
  var m = { EM: linha.EM, REMETENTE: linha.REMETENTE, ASSUNTO: linha.ASSUNTO, TRECHO: linha.TRECHO,
            TIPO_IA: linha.SUGERIDO, TIPO_CERTO: linha.DECIDIDO, QUEM: linha.QUEM };
  sh.appendRow(ROBO_MEM_PONTE_COLUNAS.map(function (c) { return m[c]; }));
}

/**
 * O que já se decidiu, por último, para este remetente nesta tarefa — ou
 * "" se nunca. É o "da última vez, o e-mail dele foi para Financeiro".
 */
function roboMemoriaUltimaDecisao_(tarefa, remetente) {
  var alvo = String(remetente || "").toLowerCase().trim();
  if (!alvo) return "";
  try {
    var mapa = roboMemoriaMapa_(tarefa);
    return mapa[alvo] || "";
  } catch (e) { return ""; }
}

/* Remetente → última decisão, lido uma vez por execução. */
var ROBO_MEM_CACHE = {};
function roboMemoriaMapa_(tarefa) {
  if (ROBO_MEM_CACHE[tarefa]) return ROBO_MEM_CACHE[tarefa];
  var mapa = {};
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
  if (sh && sh.getLastRow() > 1) {
    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(String), iT = cab.indexOf("TAREFA"), iR = cab.indexOf("REMETENTE"), iD = cab.indexOf("DECIDIDO");
    for (var l = 1; l < tudo.length; l++) {
      if (String(tudo[l][iT]) === tarefa && tudo[l][iR]) mapa[String(tudo[l][iR]).toLowerCase()] = String(tudo[l][iD]);
    }
  }
  ROBO_MEM_CACHE[tarefa] = mapa;
  return mapa;
}
