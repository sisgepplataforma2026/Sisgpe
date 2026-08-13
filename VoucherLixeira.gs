// ============================================================================
// ARQUIVO: VoucherLixeira.gs
// EXCLUIR SOLICITAÇÃO DE BOLSA — que aqui quer dizer MOVER, nunca apagar.
//
// A DECISÃO, e de quem ela é
//
// O usuário pediu "checkbox de excluir em ações" em 13/08/2026. Perguntei se
// era apagar de verdade ou lixeira, e ele respondeu: "vai para lixeira".
//
// POR QUE A LIXEIRA MUDA A NATUREZA DA OPERAÇÃO
//
// Esta mesma tela emite documento que vai para o associado e para a escola.
// Uma linha apagada some com o rastro de um papel que existe no mundo — e o
// buraco só aparece meses depois, quando a escola liga perguntando de um
// certificado que o sindicato não tem mais registro de ter emitido.
//
// Movida, a linha continua inteira noutra aba, com quem tirou e quando. Custa
// uma aba, e devolve o "desfazer" que a operação de um sindicato precisa ter.
//
// SOBRE EXCLUIR UMA JÁ EMITIDA
//
// É permitido, com aviso extra na confirmação. Foi decisão minha, declarada
// ao usuário: com lixeira, nada se perde, e proibir obrigaria a secretaria a
// conviver com lixo na tela sem ter como limpar. Se ele preferir bloquear, é
// uma linha em voucherExcluirSolicitacoes.
//
// O QUE A LIXEIRA **NÃO** É
//
// Não é cancelamento. Cancelar é um ato da operação — a bolsa existiu e foi
// desfeita, e isso é STATUS_SOLICITACAO = CANCELADO, que continua na lista e
// libera a janela do período. A lixeira é para o que nunca deveria ter sido
// digitado: teste, duplicata, engano. Confundir os dois faria a estatística
// de bolsas concedidas mentir nos dois sentidos.
// ============================================================================

var VOUCHER_ABA_LIXEIRA = "Voucher_Excluidas";

/** As três colunas que a lixeira acrescenta ao que já existia na linha. */
function VOUCHER_LIXEIRA_COLUNAS_() {
  return ["EXCLUIDO_EM", "EXCLUIDO_POR", "EXCLUIDO_MOTIVO"];
}

function voucherLixeiraAba_(ss, cabecalhoOrigem) {
  var sh = ss.getSheetByName(VOUCHER_ABA_LIXEIRA);
  if (!sh) {
    sh = ss.insertSheet(VOUCHER_ABA_LIXEIRA);
    sh.getRange(1, 1, 1, cabecalhoOrigem.length + 3)
      .setValues([cabecalhoOrigem.concat(VOUCHER_LIXEIRA_COLUNAS_())]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Move para a lixeira as solicitações dos protocolos informados.
 *
 * SÓ ADMINISTRADOR. Excluir é decisão de gestão: quem atende corrige,
 * recusa e cancela — tirar da lista é outra coisa.
 *
 * A ordem das operações importa e não é intercambiável: copia primeiro,
 * confere que copiou, e só então apaga. Invertido, uma falha no meio deixaria
 * a linha fora dos dois lugares.
 */
function voucherExcluirSolicitacoes(protocolos, motivo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", true);

  var lista = (protocolos || []).map(function (p) { return String(p || "").trim(); })
    .filter(Boolean);
  if (!lista.length) return { ok: false, mensagem: "Nenhuma solicitação selecionada." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, mensagem: "Outra operação está em andamento. Tente de novo em instantes." };
  }

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!sh || sh.getLastRow() < 2) return { ok: false, mensagem: "Aba de solicitações não encontrada." };

    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    var iProt = cab.indexOf("NUMERO_PROTOCOLO");
    if (iProt === -1) iProt = cab.indexOf("PROTOCOLO");
    if (iProt === -1) return { ok: false, mensagem: "Coluna de protocolo não encontrada." };

    var alvos = {};
    lista.forEach(function (p) { alvos[p.toUpperCase()] = true; });

    var linhas = [];      // { indice (1-based), valores }
    for (var l = 1; l < tudo.length; l++) {
      var p = String(tudo[l][iProt] || "").trim().toUpperCase();
      if (p && alvos[p]) linhas.push({ indice: l + 1, valores: tudo[l] });
    }
    if (!linhas.length) {
      return { ok: false, mensagem: "Nenhuma das solicitações selecionadas foi encontrada." };
    }

    var quem = (sessao && (sessao.email || sessao.usuario || sessao.nome)) || "";
    var agora = new Date();
    var texto = String(motivo || "").trim();

    /* 1. COPIA. A linha vai inteira, na largura do cabeçalho de origem — se a
     *    aba ganhar colunas depois, o que já está na lixeira continua legível
     *    porque o cabeçalho dela foi gravado junto, na criação. */
    var shLix = voucherLixeiraAba_(ss, cab);
    var paraGravar = linhas.map(function (x) {
      var linha = x.valores.slice(0, cab.length);
      while (linha.length < cab.length) linha.push("");
      return linha.concat([agora, quem, texto]);
    });
    shLix.getRange(shLix.getLastRow() + 1, 1, paraGravar.length, cab.length + 3)
      .setValues(paraGravar);
    SpreadsheetApp.flush();

    /* 2. CONFERE que chegou. Sem esta leitura, um erro silencioso de escrita
     *    apagaria a origem com a lixeira vazia — e aí não haveria desfazer
     *    nenhum, que é justamente o que a lixeira existe para dar. */
    var conferencia = shLix.getRange(shLix.getLastRow() - paraGravar.length + 1, iProt + 1,
      paraGravar.length, 1).getValues().map(function (r) {
        return String(r[0] || "").trim().toUpperCase();
      });
    var faltou = linhas.filter(function (x) {
      return conferencia.indexOf(String(x.valores[iProt] || "").trim().toUpperCase()) === -1;
    });
    if (faltou.length) {
      return { ok: false, mensagem: "A cópia para a lixeira não confirmou. Nada foi excluído." };
    }

    /* 3. APAGA, de baixo para cima. Apagar de cima para baixo move as linhas
     *    seguintes e o índice guardado passa a apontar para o vizinho — que é
     *    como se apaga o registro errado sem ninguém perceber. */
    linhas.sort(function (a, b) { return b.indice - a.indice; });
    linhas.forEach(function (x) { sh.deleteRow(x.indice); });

    if (typeof auditar_ === "function") {
      linhas.forEach(function (x) {
        var prot = String(x.valores[iProt] || "").trim();
        auditar_({
          modulo: "Benefícios", submodulo: "Certificado de Bolsa",
          acao: "EXCLUIR_SOLICITACAO",
          registroId: prot, documento: prot,
          valorAnterior: String(x.valores[cab.indexOf("STATUS_SOLICITACAO")] || ""),
          valorNovo: "LIXEIRA",
          justificativa: texto,
          sessao: sessao || {}
        });
      });
    }

    return {
      ok: true,
      excluidas: linhas.length,
      protocolos: linhas.map(function (x) { return String(x.valores[iProt] || "").trim(); }),
      mensagem: linhas.length === 1
        ? "1 solicitação movida para a lixeira."
        : linhas.length + " solicitações movidas para a lixeira."
    };
  } catch (e) {
    Logger.log("voucherExcluirSolicitacoes: " + e.message);
    return { ok: false, mensagem: "Erro ao excluir: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * O que está na lixeira. Sem isto, a lixeira seria um buraco: o registro sai
 * da lista, ninguém consegue olhar o que tem lá, e o "desfazer" que ela
 * promete não existe na prática.
 */
function voucherListarLixeira(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", true);
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_LIXEIRA);
    if (!sh || sh.getLastRow() < 2) return { ok: true, itens: [] };

    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    function v(linha, nome) {
      var i = cab.indexOf(nome);
      return i === -1 ? "" : linha[i];
    }

    var itens = [];
    for (var l = tudo.length - 1; l >= 1; l--) {
      itens.push({
        protocolo: String(v(tudo[l], "NUMERO_PROTOCOLO") || "").trim(),
        nome: String(v(tudo[l], "NOME_SOLICITANTE") || "").trim(),
        curso: String(v(tudo[l], "CURSO") || "").trim(),
        periodo: String(v(tudo[l], "PERIODO_REFERENCIA") || "").trim(),
        status: String(v(tudo[l], "STATUS_SOLICITACAO") || "").trim(),
        excluidoEm: v(tudo[l], "EXCLUIDO_EM") || "",
        excluidoPor: String(v(tudo[l], "EXCLUIDO_POR") || "").trim(),
        motivo: String(v(tudo[l], "EXCLUIDO_MOTIVO") || "").trim()
      });
    }
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("voucherListarLixeira: " + e.message);
    return { ok: false, mensagem: e.message, itens: [] };
  }
}

/**
 * Devolve da lixeira para a lista.
 *
 * A volta é escrita POR NOME DE COLUNA, e não copiando a linha inteira de
 * volta: entre a exclusão e a restauração a aba de origem pode ter ganhado
 * colunas novas, e devolver por posição desalinharia tudo — foi exatamente
 * esse tipo de confiança em posição que desalinhou 13 colunas em 12/08.
 */
function voucherRestaurarDaLixeira(protocolo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", true);
  var alvo = String(protocolo || "").trim().toUpperCase();
  if (!alvo) return { ok: false, mensagem: "Informe o protocolo." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, mensagem: "Outra operação está em andamento. Tente de novo." };
  }

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var shLix = ss.getSheetByName(VOUCHER_ABA_LIXEIRA);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!shLix || shLix.getLastRow() < 2) return { ok: false, mensagem: "A lixeira está vazia." };
    if (!sh) return { ok: false, mensagem: "Aba de solicitações não encontrada." };

    var tudo = shLix.getRange(1, 1, shLix.getLastRow(), shLix.getLastColumn()).getValues();
    var cabLix = tudo[0].map(function (c) { return String(c || "").trim(); });
    var iProt = cabLix.indexOf("NUMERO_PROTOCOLO");
    if (iProt === -1) return { ok: false, mensagem: "Coluna de protocolo não encontrada na lixeira." };

    var achou = -1;
    for (var l = tudo.length - 1; l >= 1; l--) {
      if (String(tudo[l][iProt] || "").trim().toUpperCase() === alvo) { achou = l; break; }
    }
    if (achou === -1) return { ok: false, mensagem: "Protocolo não está na lixeira." };

    var origem = {};
    cabLix.forEach(function (nome, i) { if (nome) origem[nome] = tudo[achou][i]; });

    var cabDestino = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });
    sh.getRange(sh.getLastRow() + 1, 1, 1, cabDestino.length).setValues([
      cabDestino.map(function (c) { return origem[c] !== undefined ? origem[c] : ""; })
    ]);

    shLix.deleteRow(achou + 1);

    if (typeof auditar_ === "function") {
      auditar_({
        modulo: "Benefícios", submodulo: "Certificado de Bolsa",
        acao: "RESTAURAR_SOLICITACAO",
        registroId: alvo, documento: alvo,
        valorAnterior: "LIXEIRA",
        valorNovo: String(origem.STATUS_SOLICITACAO || ""),
        sessao: sessao || {}
      });
    }

    return { ok: true, mensagem: "Solicitação " + alvo + " restaurada." };
  } catch (e) {
    Logger.log("voucherRestaurarDaLixeira: " + e.message);
    return { ok: false, mensagem: "Erro ao restaurar: " + e.message };
  } finally {
    lock.releaseLock();
  }
}
