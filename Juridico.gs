// ============================================================================
// MÓDULO: JURÍDICO — Processos, notificações e prazos
// Antes era só localStorage do navegador (achado da auditoria de arquitetura:
// dado de processo com prazo não pode sumir se alguém limpar o cache, nem
// pode ficar visível só pra quem cadastrou). Backend real: planilha, sessão
// obrigatória, exclusão lógica (nunca apaga histórico de processo).
// ============================================================================

var JUR_ABA = "Juridico";

var JUR_CABECALHO = [
  "ID", "Assunto", "Tipo", "Prazo", "Status",
  "Criado Em", "Criado Por", "Atualizado Em", "Atualizado Por", "Ativo"
];

var JUR_COL = {
  ID: 1,
  ASSUNTO: 2,
  TIPO: 3,
  PRAZO: 4,
  STATUS: 5,
  CRIADO_EM: 6,
  CRIADO_POR: 7,
  ATUALIZADO_EM: 8,
  ATUALIZADO_POR: 9,
  ATIVO: 10
};

var JUR_TIPOS = ["Processo", "Notificação", "Contrato", "Consulta"];
var JUR_STATUS = ["Ativo", "Atenção", "Concluído"];

function jurObterAba_() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(JUR_ABA);
  if (!aba) {
    aba = planilha.insertSheet(JUR_ABA);
    aba.getRange(1, 1, 1, JUR_CABECALHO.length).setValues([JUR_CABECALHO]);
    aba.getRange(1, 1, 1, JUR_CABECALHO.length).setFontWeight("bold").setBackground("#001f4d").setFontColor("#ffffff");
    aba.setFrozenRows(1);
  }
  return aba;
}

function jurComLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("CONCORRENCIA");
  try { return callback(); } finally { lock.releaseLock(); }
}

function jurGerarId_() {
  return "JUR-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function jurMapearLinha_(valores) {
  return {
    id: valores[JUR_COL.ID - 1],
    assunto: valores[JUR_COL.ASSUNTO - 1],
    tipo: valores[JUR_COL.TIPO - 1],
    prazo: valores[JUR_COL.PRAZO - 1],
    status: valores[JUR_COL.STATUS - 1],
    criadoEm: valores[JUR_COL.CRIADO_EM - 1],
    criadoPor: valores[JUR_COL.CRIADO_POR - 1],
    atualizadoEm: valores[JUR_COL.ATUALIZADO_EM - 1],
    atualizadoPor: valores[JUR_COL.ATUALIZADO_POR - 1]
  };
}

function jurBuscarLinhaPorId_(aba, id) {
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][JUR_COL.ID - 1]) === String(id)) {
      return { linha: i + 2, valores: dados[i] };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// FUNÇÕES PÚBLICAS — chamadas pela tela
// ----------------------------------------------------------------------------

function jurListarProcessos(tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var aba = jurObterAba_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO.length).getValues();
    var itens = dados
      .filter(function(linha) { return String(linha[JUR_COL.ATIVO - 1] || "SIM") !== "NAO"; })
      .map(jurMapearLinha_);

    itens.sort(function(a, b) {
      return new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm);
    });

    Logger.log("jurListarProcessos OK: " + itens.length + " itens");
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("jurListarProcessos ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro desconhecido ao listar." };
  }
}

function jurSalvarProcesso(dados, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    dados = dados || {};
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    var assunto = String(dados.assunto || "").trim();
    if (!assunto) return { ok: false, mensagem: "Informe o assunto." };

    var tipo = JUR_TIPOS.indexOf(dados.tipo) > -1 ? dados.tipo : JUR_TIPOS[0];
    var status = JUR_STATUS.indexOf(dados.status) > -1 ? dados.status : JUR_STATUS[0];
    var prazo = String(dados.prazo || "").trim();

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var agora = new Date();

      if (dados.id) {
        var encontrada = jurBuscarLinhaPorId_(aba, dados.id);
        if (!encontrada) return { ok: false, mensagem: "Registro não encontrado." };

        aba.getRange(encontrada.linha, JUR_COL.ASSUNTO).setValue(assunto);
        aba.getRange(encontrada.linha, JUR_COL.TIPO).setValue(tipo);
        aba.getRange(encontrada.linha, JUR_COL.PRAZO).setValue(prazo);
        aba.getRange(encontrada.linha, JUR_COL.STATUS).setValue(status);
        aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(agora);
        aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_POR).setValue(responsavel);

        return { ok: true, id: dados.id };
      }

      var id = jurGerarId_();
      var linha = new Array(JUR_CABECALHO.length).fill("");
      linha[JUR_COL.ID - 1] = id;
      linha[JUR_COL.ASSUNTO - 1] = assunto;
      linha[JUR_COL.TIPO - 1] = tipo;
      linha[JUR_COL.PRAZO - 1] = prazo;
      linha[JUR_COL.STATUS - 1] = status;
      linha[JUR_COL.CRIADO_EM - 1] = agora;
      linha[JUR_COL.CRIADO_POR - 1] = responsavel;
      linha[JUR_COL.ATUALIZADO_EM - 1] = agora;
      linha[JUR_COL.ATUALIZADO_POR - 1] = responsavel;
      linha[JUR_COL.ATIVO - 1] = "SIM";

      aba.appendRow(linha);
      Logger.log("jurSalvarProcesso OK: criado " + id);
      return { ok: true, id: id };
    });
  } catch (e) {
    Logger.log("jurSalvarProcesso ERRO: " + e.message + " | stack: " + e.stack);
    var mensagem = e.message === "CONCORRENCIA"
      ? "Outra pessoa está salvando um registro agora. Tente novamente em instantes."
      : (e.message || "Erro desconhecido ao salvar.");
    return { ok: false, mensagem: mensagem };
  }
}

// Exclusão lógica — nunca apaga a linha de verdade. Processo/notificação
// jurídica é registro que precisa continuar existindo pra auditoria mesmo
// depois de "removido" da lista.
function jurExcluirProcesso(id, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var encontrada = jurBuscarLinhaPorId_(aba, id);
      if (!encontrada) return { ok: false, mensagem: "Registro não encontrado." };

      aba.getRange(encontrada.linha, JUR_COL.ATIVO).setValue("NAO");
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_POR).setValue(responsavel);

      Logger.log("jurExcluirProcesso OK: " + id);
      return { ok: true };
    });
  } catch (e) {
    Logger.log("jurExcluirProcesso ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro desconhecido ao excluir." };
  }
}
