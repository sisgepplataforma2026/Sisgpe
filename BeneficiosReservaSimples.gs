// ============================================================================
// MÓDULO: BENEFÍCIOS COM RESERVA POR DATA (Guriri Beach, Assefaz)
// Motor genérico de reserva/disponibilidade — mesmo padrão do Parque China,
// simplificado (sem distribuição de suíte, sem check-in/checkout operacional,
// sem cálculo financeiro). Um único arquivo atende os dois benefícios,
// diferenciados pelo parâmetro `tipo`.
// ============================================================================

var BRS_TIPOS = {
  GURIRI_BEACH: {
    label: "Guriri Beach Acqua Park",
    aba: "ReservasGuririBeach",
    prefixoId: "GUR",
    // AJUSTE AQUI: quantas reservas simultâneas o benefício comporta por dia.
    vagasPorDia: 10
  },
  ASSEFAZ: {
    label: "Pousada Club Assefaz",
    aba: "ReservasAssefaz",
    prefixoId: "ASF",
    vagasPorDia: 4
  }
};

var BRS_TIMEZONE = "America/Sao_Paulo";

var BRS_STATUS = {
  PENDENTE: "PENDENTE",
  APROVADA: "APROVADA",
  RECUSADA: "RECUSADA",
  CANCELADA: "CANCELADA",
  FINALIZADA: "FINALIZADA"
};

var BRS_STATUS_QUE_OCUPAM_VAGA = [BRS_STATUS.APROVADA, BRS_STATUS.FINALIZADA];

var BRS_COL = {
  ID_RESERVA: 1,
  DATA_SOLICITACAO: 2,
  STATUS: 3,
  DATA_ENTRADA: 4,
  DATA_SAIDA: 5,
  NOME_SOLICITANTE: 6,
  CPF: 7,
  TELEFONE: 8,
  EMAIL: 9,
  ESCOLA: 10,
  QTD_PESSOAS: 11,
  OBSERVACAO_SOLICITANTE: 12,
  OBSERVACAO_ADMIN: 13,
  RESPONSAVEL_APROVACAO: 14,
  DATA_APROVACAO: 15,
  MOTIVO_RECUSA: 16,
  ATUALIZADO_EM: 17,
  ATUALIZADO_POR: 18
};

var BRS_CABECALHO = [
  "ID Reserva", "Data Solicitação", "Status", "Data Entrada", "Data Saída",
  "Nome Solicitante", "CPF", "Telefone", "Email", "Escola/Vínculo",
  "Qtd Pessoas", "Observação Solicitante", "Observação Admin",
  "Responsável Aprovação", "Data Aprovação/Recusa", "Motivo Recusa",
  "Atualizado Em", "Atualizado Por"
];

// ----------------------------------------------------------------------------
// HELPERS INTERNOS
// ----------------------------------------------------------------------------

function brsConfig_(tipo) {
  var cfg = BRS_TIPOS[String(tipo || "").trim()];
  if (!cfg) throw new Error("Benefício inválido: " + tipo);
  return cfg;
}

function brsComLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("CONCORRENCIA");
  try { return callback(); } finally { lock.releaseLock(); }
}

function brsDataDia_(valor) {
  if (!valor) return "";
  var d = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(d)) return "";
  return Utilities.formatDate(d, BRS_TIMEZONE, "yyyy-MM-dd");
}

function brsObterAba_(tipo) {
  var cfg = brsConfig_(tipo);
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(cfg.aba);

  if (!aba) {
    aba = planilha.insertSheet(cfg.aba);
    aba.getRange(1, 1, 1, BRS_CABECALHO.length).setValues([BRS_CABECALHO]);
    aba.getRange(1, 1, 1, BRS_CABECALHO.length).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");
    aba.setFrozenRows(1);
  }
  return aba;
}

function brsGerarId_(tipo) {
  var cfg = brsConfig_(tipo);
  var hoje = new Date();
  var prefixo = cfg.prefixoId + "-" + Utilities.formatDate(hoje, BRS_TIMEZONE, "yyMMdd");
  var aba = brsObterAba_(tipo);
  var ultimaLinha = aba.getLastRow();
  var sequencia = 1;

  if (ultimaLinha >= 2) {
    var ids = aba.getRange(2, BRS_COL.ID_RESERVA, ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).indexOf(prefixo) === 0) sequencia++;
    }
  }
  return prefixo + "-" + ("00" + sequencia).slice(-3);
}

function brsBuscarPorId_(tipo, idReserva) {
  var aba = brsObterAba_(tipo);
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  var dados = aba.getRange(2, 1, ultimaLinha - 1, BRS_CABECALHO.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][BRS_COL.ID_RESERVA - 1]) === String(idReserva)) {
      return { linha: i + 2, valores: dados[i] };
    }
  }
  return null;
}

function brsMapearLinha_(valores) {
  return {
    idReserva: valores[BRS_COL.ID_RESERVA - 1],
    dataSolicitacao: valores[BRS_COL.DATA_SOLICITACAO - 1],
    status: valores[BRS_COL.STATUS - 1],
    dataEntrada: brsDataDia_(valores[BRS_COL.DATA_ENTRADA - 1]),
    dataSaida: brsDataDia_(valores[BRS_COL.DATA_SAIDA - 1]),
    nomeSolicitante: valores[BRS_COL.NOME_SOLICITANTE - 1],
    cpf: valores[BRS_COL.CPF - 1],
    telefone: valores[BRS_COL.TELEFONE - 1],
    email: valores[BRS_COL.EMAIL - 1],
    escola: valores[BRS_COL.ESCOLA - 1],
    qtdPessoas: valores[BRS_COL.QTD_PESSOAS - 1],
    observacaoSolicitante: valores[BRS_COL.OBSERVACAO_SOLICITANTE - 1],
    observacaoAdmin: valores[BRS_COL.OBSERVACAO_ADMIN - 1],
    responsavelAprovacao: valores[BRS_COL.RESPONSAVEL_APROVACAO - 1],
    dataAprovacao: valores[BRS_COL.DATA_APROVACAO - 1],
    motivoRecusa: valores[BRS_COL.MOTIVO_RECUSA - 1],
    atualizadoEm: valores[BRS_COL.ATUALIZADO_EM - 1],
    atualizadoPor: valores[BRS_COL.ATUALIZADO_POR - 1]
  };
}

// Conta, por dia dentro do período [dataEntrada, dataSaida), quantas reservas
// que ocupam vaga já existem — usado tanto na consulta de disponibilidade
// quanto na trava antes de aprovar/criar uma reserva.
function brsContarOcupacaoPorDia_(tipo, idExcluir) {
  var aba = brsObterAba_(tipo);
  var ultimaLinha = aba.getLastRow();
  var ocupacao = {};
  if (ultimaLinha < 2) return ocupacao;

  var dados = aba.getRange(2, 1, ultimaLinha - 1, BRS_CABECALHO.length).getValues();
  dados.forEach(function(linha) {
    var status = String(linha[BRS_COL.STATUS - 1]);
    if (BRS_STATUS_QUE_OCUPAM_VAGA.indexOf(status) === -1) return;
    if (idExcluir && String(linha[BRS_COL.ID_RESERVA - 1]) === String(idExcluir)) return;

    var entrada = brsDataDia_(linha[BRS_COL.DATA_ENTRADA - 1]);
    var saida = brsDataDia_(linha[BRS_COL.DATA_SAIDA - 1]);
    if (!entrada || !saida) return;

    var cursor = new Date(entrada + "T00:00:00");
    var fim = new Date(saida + "T00:00:00");
    while (cursor < fim) {
      var chave = Utilities.formatDate(cursor, BRS_TIMEZONE, "yyyy-MM-dd");
      ocupacao[chave] = (ocupacao[chave] || 0) + 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return ocupacao;
}

function brsVerificarDisponibilidade_(tipo, dataEntrada, dataSaida, idExcluir) {
  var cfg = brsConfig_(tipo);
  var entrada = brsDataDia_(dataEntrada);
  var saida = brsDataDia_(dataSaida);
  if (!entrada || !saida) return { disponivel: false, mensagem: "Informe as datas de entrada e saída." };
  if (new Date(saida) <= new Date(entrada)) return { disponivel: false, mensagem: "A data de saída deve ser depois da data de entrada." };

  var ocupacao = brsContarOcupacaoPorDia_(tipo, idExcluir);
  var cursor = new Date(entrada + "T00:00:00");
  var fim = new Date(saida + "T00:00:00");
  var diasLotados = [];

  while (cursor < fim) {
    var chave = Utilities.formatDate(cursor, BRS_TIMEZONE, "yyyy-MM-dd");
    if ((ocupacao[chave] || 0) >= cfg.vagasPorDia) diasLotados.push(chave);
    cursor.setDate(cursor.getDate() + 1);
  }

  if (diasLotados.length) {
    return { disponivel: false, mensagem: "Sem vagas em: " + diasLotados.join(", "), diasLotados: diasLotados };
  }
  return { disponivel: true };
}

function brsEnviarEmail_(tipo, evento, reserva) {
  if (!reserva.email) return;
  var cfg = brsConfig_(tipo);
  var titulo, corpo;
  if (evento === "APROVADA") {
    titulo = "Reserva confirmada — " + cfg.label;
    corpo = "<p>Olá, <b>" + reserva.nomeSolicitante + "</b>!</p>" +
      "<p>Sua reserva em <b>" + cfg.label + "</b> foi confirmada.</p>" +
      "<p><b>Entrada:</b> " + reserva.dataEntrada + "<br><b>Saída:</b> " + reserva.dataSaida + "</p>";
  } else if (evento === "RECUSADA") {
    titulo = "Solicitação não aprovada — " + cfg.label;
    corpo = "<p>Olá, <b>" + reserva.nomeSolicitante + "</b>!</p>" +
      "<p>Sua solicitação em <b>" + cfg.label + "</b> não pôde ser aprovada.</p>" +
      "<p><b>Motivo:</b> " + (reserva.motivoRecusa || "Não informado") + "</p>";
  } else if (evento === "CANCELADA") {
    titulo = "Reserva cancelada — " + cfg.label;
    corpo = "<p>Olá, <b>" + reserva.nomeSolicitante + "</b>!</p>" +
      "<p>Sua reserva em <b>" + cfg.label + "</b> foi cancelada.</p>";
  } else {
    return;
  }
  var envio = enviarEmailSISGEP_(reserva.email, titulo, corpo.replace(/<[^>]+>/g, ""), {
    origem: "Benefícios",
    htmlBody: sind_emailHtml_(titulo, corpo)
  });
  if (!envio.ok) Logger.log("brsEnviarEmail_ (" + tipo + "/" + evento + "): " + envio.mensagem);
}

// ----------------------------------------------------------------------------
// FUNÇÕES PÚBLICAS — chamadas pelo painel administrativo
// ----------------------------------------------------------------------------

function listarReservasBeneficioSimples(tipo, filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    filtros = filtros || {};
    var aba = brsObterAba_(tipo);
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, BRS_CABECALHO.length).getValues();
    var itens = dados.map(brsMapearLinha_);

    if (filtros.status) itens = itens.filter(function(r) { return r.status === filtros.status; });
    if (filtros.busca) {
      var termo = String(filtros.busca).toLowerCase();
      itens = itens.filter(function(r) {
        return (String(r.nomeSolicitante || "").toLowerCase().indexOf(termo) >= 0) ||
          (String(r.cpf || "").indexOf(termo.replace(/\D/g, "")) >= 0) ||
          (String(r.idReserva || "").toLowerCase().indexOf(termo) >= 0);
      });
    }

    itens.sort(function(a, b) { return new Date(b.dataSolicitacao) - new Date(a.dataSolicitacao); });
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("listarReservasBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function getDashboardBeneficioSimples(tipo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var cfg = brsConfig_(tipo);
    var r = listarReservasBeneficioSimples(tipo, {}, tokenSessao);
    if (!r.ok) return r;

    var hoje = brsDataDia_(new Date());
    var total = r.itens.length;
    var aprovadas = r.itens.filter(function(i) { return i.status === BRS_STATUS.APROVADA; }).length;
    var pendentes = r.itens.filter(function(i) { return i.status === BRS_STATUS.PENDENTE; }).length;
    var proximas = r.itens.filter(function(i) {
      return i.status === BRS_STATUS.APROVADA && i.dataEntrada >= hoje;
    }).length;

    return {
      ok: true,
      label: cfg.label,
      vagasPorDia: cfg.vagasPorDia,
      indicadores: { total: total, aprovadas: aprovadas, pendentes: pendentes, proximas: proximas }
    };
  } catch (e) {
    Logger.log("getDashboardBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function consultarDisponibilidadeBeneficioSimples(tipo, dataEntrada, dataSaida, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    return Object.assign({ ok: true }, brsVerificarDisponibilidade_(tipo, dataEntrada, dataSaida, null));
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

// Cria a reserva — por padrão já aprovada (a equipe faz a intake manual da
// solicitação por telefone/e-mail/presencial, mesmo modelo do Parque China).
// Se dados.statusInicial === "PENDENTE", cria como solicitação aguardando
// aprovação, sem checar disponibilidade ainda (a checagem acontece na hora
// de aprovar, quando a vaga realmente precisa ser reservada).
function criarReservaBeneficioSimples(tipo, dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    dados = dados || {};
    var responsavel = sessao.nome || sessao.usuario || sessao.email;
    var statusInicial = dados.statusInicial === "PENDENTE" ? BRS_STATUS.PENDENTE : BRS_STATUS.APROVADA;

    if (!String(dados.nomeSolicitante || "").trim()) return { ok: false, mensagem: "Informe o nome do associado." };
    if (!String(dados.cpf || "").trim()) return { ok: false, mensagem: "Informe o CPF do associado." };

    return brsComLock_(function() {
      if (statusInicial === BRS_STATUS.APROVADA) {
        var disponibilidade = brsVerificarDisponibilidade_(tipo, dados.dataEntrada, dados.dataSaida, null);
        if (!disponibilidade.disponivel) return { ok: false, mensagem: disponibilidade.mensagem };
      }

      var id = brsGerarId_(tipo);
      var aba = brsObterAba_(tipo);
      var linha = new Array(BRS_CABECALHO.length).fill("");
      linha[BRS_COL.ID_RESERVA - 1] = id;
      linha[BRS_COL.DATA_SOLICITACAO - 1] = new Date();
      linha[BRS_COL.STATUS - 1] = statusInicial;
      linha[BRS_COL.DATA_ENTRADA - 1] = brsDataDia_(dados.dataEntrada);
      linha[BRS_COL.DATA_SAIDA - 1] = brsDataDia_(dados.dataSaida);
      linha[BRS_COL.NOME_SOLICITANTE - 1] = String(dados.nomeSolicitante).trim();
      linha[BRS_COL.CPF - 1] = String(dados.cpf).replace(/\D/g, "");
      linha[BRS_COL.TELEFONE - 1] = dados.telefone || "";
      linha[BRS_COL.EMAIL - 1] = dados.email || "";
      linha[BRS_COL.ESCOLA - 1] = dados.escola || "";
      linha[BRS_COL.QTD_PESSOAS - 1] = Number(dados.qtdPessoas || 1);
      linha[BRS_COL.OBSERVACAO_SOLICITANTE - 1] = dados.observacaoSolicitante || "";
      linha[BRS_COL.OBSERVACAO_ADMIN - 1] = dados.observacaoAdmin || (statusInicial === BRS_STATUS.APROVADA ? "Reserva lançada manualmente" : "");
      if (statusInicial === BRS_STATUS.APROVADA) {
        linha[BRS_COL.RESPONSAVEL_APROVACAO - 1] = responsavel;
        linha[BRS_COL.DATA_APROVACAO - 1] = new Date();
      }
      linha[BRS_COL.ATUALIZADO_EM - 1] = new Date();
      linha[BRS_COL.ATUALIZADO_POR - 1] = responsavel;

      aba.appendRow(linha);
      var reserva = brsMapearLinha_(linha);
      if (statusInicial === BRS_STATUS.APROVADA) brsEnviarEmail_(tipo, "APROVADA", reserva);
      return { ok: true, idReserva: id, status: statusInicial };
    });
  } catch (e) {
    Logger.log("criarReservaBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message === "CONCORRENCIA" ? "Outra pessoa está usando a agenda agora. Tente novamente em instantes." : e.message };
  }
}

function aprovarReservaBeneficioSimples(tipo, idReserva, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return brsComLock_(function() {
      var encontrada = brsBuscarPorId_(tipo, idReserva);
      if (!encontrada) return { ok: false, mensagem: "Reserva não encontrada." };
      var statusAtual = String(encontrada.valores[BRS_COL.STATUS - 1]);
      if (statusAtual !== BRS_STATUS.PENDENTE) return { ok: false, mensagem: "Somente solicitações pendentes podem ser aprovadas." };

      var entrada = encontrada.valores[BRS_COL.DATA_ENTRADA - 1];
      var saida = encontrada.valores[BRS_COL.DATA_SAIDA - 1];
      var disponibilidade = brsVerificarDisponibilidade_(tipo, entrada, saida, idReserva);
      if (!disponibilidade.disponivel) return { ok: false, mensagem: disponibilidade.mensagem };

      var aba = brsObterAba_(tipo);
      aba.getRange(encontrada.linha, BRS_COL.STATUS).setValue(BRS_STATUS.APROVADA);
      aba.getRange(encontrada.linha, BRS_COL.RESPONSAVEL_APROVACAO).setValue(responsavel);
      aba.getRange(encontrada.linha, BRS_COL.DATA_APROVACAO).setValue(new Date());
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_POR).setValue(responsavel);

      var reserva = brsMapearLinha_(aba.getRange(encontrada.linha, 1, 1, BRS_CABECALHO.length).getValues()[0]);
      brsEnviarEmail_(tipo, "APROVADA", reserva);
      return { ok: true, idReserva: idReserva, status: BRS_STATUS.APROVADA };
    });
  } catch (e) {
    Logger.log("aprovarReservaBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message === "CONCORRENCIA" ? "Outra pessoa está usando a agenda agora. Tente novamente em instantes." : e.message };
  }
}

function recusarReservaBeneficioSimples(tipo, idReserva, motivo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    if (!String(motivo || "").trim()) return { ok: false, mensagem: "Informe o motivo da recusa." };
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return brsComLock_(function() {
      var encontrada = brsBuscarPorId_(tipo, idReserva);
      if (!encontrada) return { ok: false, mensagem: "Reserva não encontrada." };
      var statusAtual = String(encontrada.valores[BRS_COL.STATUS - 1]);
      if (statusAtual !== BRS_STATUS.PENDENTE) return { ok: false, mensagem: "Somente solicitações pendentes podem ser recusadas." };

      var aba = brsObterAba_(tipo);
      aba.getRange(encontrada.linha, BRS_COL.STATUS).setValue(BRS_STATUS.RECUSADA);
      aba.getRange(encontrada.linha, BRS_COL.MOTIVO_RECUSA).setValue(motivo);
      aba.getRange(encontrada.linha, BRS_COL.RESPONSAVEL_APROVACAO).setValue(responsavel);
      aba.getRange(encontrada.linha, BRS_COL.DATA_APROVACAO).setValue(new Date());
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_POR).setValue(responsavel);

      var reserva = brsMapearLinha_(aba.getRange(encontrada.linha, 1, 1, BRS_CABECALHO.length).getValues()[0]);
      reserva.motivoRecusa = motivo;
      brsEnviarEmail_(tipo, "RECUSADA", reserva);
      return { ok: true, idReserva: idReserva, status: BRS_STATUS.RECUSADA };
    });
  } catch (e) {
    Logger.log("recusarReservaBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function cancelarReservaBeneficioSimples(tipo, idReserva, motivo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    if (!String(motivo || "").trim()) return { ok: false, mensagem: "Informe o motivo do cancelamento." };
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return brsComLock_(function() {
      var encontrada = brsBuscarPorId_(tipo, idReserva);
      if (!encontrada) return { ok: false, mensagem: "Reserva não encontrada." };
      var statusAtual = String(encontrada.valores[BRS_COL.STATUS - 1]);
      if ([BRS_STATUS.CANCELADA, BRS_STATUS.RECUSADA, BRS_STATUS.FINALIZADA].indexOf(statusAtual) !== -1) {
        return { ok: false, mensagem: "O status atual não permite cancelamento." };
      }

      var aba = brsObterAba_(tipo);
      aba.getRange(encontrada.linha, BRS_COL.STATUS).setValue(BRS_STATUS.CANCELADA);
      aba.getRange(encontrada.linha, BRS_COL.OBSERVACAO_ADMIN).setValue((encontrada.valores[BRS_COL.OBSERVACAO_ADMIN - 1] || "") + " | Cancelada: " + motivo);
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, BRS_COL.ATUALIZADO_POR).setValue(responsavel);

      var reserva = brsMapearLinha_(aba.getRange(encontrada.linha, 1, 1, BRS_CABECALHO.length).getValues()[0]);
      brsEnviarEmail_(tipo, "CANCELADA", reserva);
      return { ok: true, idReserva: idReserva, status: BRS_STATUS.CANCELADA };
    });
  } catch (e) {
    Logger.log("cancelarReservaBeneficioSimples (" + tipo + "): " + e.message);
    return { ok: false, mensagem: e.message };
  }
}
