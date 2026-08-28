// ================================
// ARQUIVO: EventosAgenda.gs
// MÓDULO: Agenda Operacional de Eventos (Fase 3 da auditoria de Eventos)
//
// Antes, EventosAdmin.html gravava tudo em localStorage do navegador:
// cada pessoa só via o que ela mesma tinha digitado, nada sincronizava
// entre usuários nem dispositivos — a tela prometia organização de
// equipe e entregava um bloco de notas individual.
//
// Este arquivo é o backend real: uma aba central na planilha
// (EVENTOS_AGENDA), compartilhada por toda a equipe, com sessão
// obrigatória em toda operação.
// ================================

var ABA_EVENTOS_AGENDA = "EVENTOS_AGENDA";

function agendaEventos_garantirEstrutura_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_EVENTOS_AGENDA);
  if (!sh) sh = ss.insertSheet(ABA_EVENTOS_AGENDA);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "NOME", "DATA", "TIPO", "STATUS",
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function agendaEventos_gerarId_() {
  return "EVT-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function agendaEventos_formatarData_(v) {
  if (!v) return "";
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v);
}

/* =========================================
 * LISTAR
 * ========================================= */
function listarEventosAgenda(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var sh = agendaEventos_garantirEstrutura_();
    if (sh.getLastRow() < 2) return [];

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    return dados
      .map(function (linha) {
        var obj = {};
        cab.forEach(function (col, i) { obj[col] = linha[i]; });
        return {
          id: String(obj.ID || ""),
          nome: String(obj.NOME || ""),
          data: agendaEventos_formatarData_(obj.DATA),
          tipo: String(obj.TIPO || "Outro"),
          status: String(obj.STATUS || "Planejado")
        };
      })
      .filter(function (x) { return !!x.id; })
      .sort(function (a, b) { return (a.data || "").localeCompare(b.data || ""); });
  } catch (e) {
    Logger.log("listarEventosAgenda erro: " + e.message);
    return [];
  }
}

/* =========================================
 * SALVAR (cria ou atualiza)
 * ========================================= */
function salvarEventoAgenda(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};
    var nome = String(dados.nome || "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o evento." };

    var sh = agendaEventos_garantirEstrutura_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();
    var idAlvo = String(dados.id || "").trim();

    if (idAlvo) {
      var idsCol = sh.getLastRow() > 1
        ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
        : [];
      for (var i = 0; i < idsCol.length; i++) {
        if (String(idsCol[i][0]) === idAlvo) {
          var linha = i + 2;
          sh.getRange(linha, 2).setValue(nome);
          sh.getRange(linha, 3).setValue(dados.data || "");
          sh.getRange(linha, 4).setValue(dados.tipo || "Outro");
          sh.getRange(linha, 5).setValue(dados.status || "Planejado");
          sh.getRange(linha, 8).setValue(quem);
          sh.getRange(linha, 9).setValue(agora);
          return { ok: true, id: idAlvo, mensagem: "Evento atualizado com sucesso." };
        }
      }
      // ID informado não existe mais (linha removida por outra pessoa) — cadastra como novo.
    }

    var novoId = agendaEventos_gerarId_();
    sh.appendRow([
      novoId, nome, dados.data || "", dados.tipo || "Outro", dados.status || "Planejado",
      quem, agora, quem, agora
    ]);
    return { ok: true, id: novoId, mensagem: "Evento cadastrado com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar evento: " + e.message };
  }
}

/* =========================================
 * EXCLUIR
 * ========================================= */
function excluirEventoAgenda(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Informe o evento a excluir." };

    var sh = agendaEventos_garantirEstrutura_();
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Evento não encontrado." };

    var idsCol = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = idsCol.length - 1; i >= 0; i--) {
      if (String(idsCol[i][0]) === id) {
        sh.deleteRow(i + 2);
        return { ok: true, mensagem: "Evento excluído com sucesso." };
      }
    }
    return { ok: false, mensagem: "Evento não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao excluir evento: " + e.message };
  }
}
