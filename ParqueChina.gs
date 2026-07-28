// ==========================================================
// ARQUIVO: ParqueChina.gs
// MÓDULO: Reserva Parque do China
// ==========================================================

const ABA_CHALES_CHINA           = 'Chales_Parque_China';
const ABA_RESERVAS_CHINA         = 'Reservas_Parque_China';
const ABA_HISTORICO_CHINA        = 'Historico_Reservas_China';
const ABA_CONFIG_CHINA           = 'Configuracoes_Parque_China';

const CAB_CHALES_CHINA = [
  'IDChale',
  'NomeChale',
  'Tipo',
  'CapacidadePadrao',
  'PermiteColchaoExtra',
  'CapacidadeMaxima',
  'TaxaColchaoExtra',
  'Ativo',
  'Observacoes'
];

const CAB_RESERVAS_CHINA = [
  'IDReserva',
  'DataHoraSolicitacao',
  'Timestamp',
  'NomeSolicitante',
  'CPF',
  'Telefone',
  'Email',
  'Escola',
  'DataEntrada',
  'DataSaida',
  'QuantidadeNoites',
  'QuantidadePessoas',
  'SolicitouColchaoExtra',
  'ValorColchaoExtra',
  'ValorPrevisto',
  'ChaleSolicitado',
  'ChaleAprovado',
  'Status',
  'ObservacaoSolicitante',
  'ObservacaoInterna',
  'ResponsavelAnalise',
  'DataHoraAnalise',
  'MotivoRecusa'
];

const CAB_HIST_CHINA = [
  'IDHistorico',
  'IDReserva',
  'DataHora',
  'Acao',
  'Usuario',
  'StatusAnterior',
  'StatusNovo',
  'Detalhes'
];

const STATUS_RESERVA_CHINA = {
  PENDENTE: 'PENDENTE',
  EM_ANALISE: 'EM_ANALISE',
  APROVADA: 'APROVADA',
  RECUSADA: 'RECUSADA',
  CANCELADA: 'CANCELADA',
  FINALIZADA: 'FINALIZADA'
};

const CONFIG_CHINA = {
  MAX_DIAS_ANTECEDENCIA: 30,
  CHECKIN_HORA: 14,
  CHECKOUT_HORA: 12,
  CAPACIDADE_PADRAO: 4,
  CAPACIDADE_MAXIMA: 5,
  TAXA_COLCHAO_EXTRA: 80,
  QUANTIDADE_CHALES: 8
};

/* ==========================================================
 * MENU / VIEW
 * ========================================================== */
function incluirSecaoReservaParqueChina_() {
  return HtmlService.createHtmlOutputFromFile('ReservaParqueChina').getContent();
}

/* ==========================================================
 * INICIALIZAÇÃO
 * ========================================================== */
function inicializarModuloParqueChina() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const shChales = obterOuCriarAba_(ss, ABA_CHALES_CHINA, CAB_CHALES_CHINA);
  const shReservas = obterOuCriarAba_(ss, ABA_RESERVAS_CHINA, CAB_RESERVAS_CHINA);
  const shHist = obterOuCriarAba_(ss, ABA_HISTORICO_CHINA, CAB_HIST_CHINA);
  const shConfig = obterOuCriarAba_(ss, ABA_CONFIG_CHINA, ['Chave', 'Valor', 'Descricao']);

  if (shChales.getLastRow() === 1) {
    popularChalesPadrao_(shChales);
  }

  if (shConfig.getLastRow() === 1) {
    popularConfiguracoesPadraoChina_(shConfig);
  }

  formatarAbasModuloChina_(shChales, shReservas, shHist, shConfig);

  return {
    ok: true,
    mensagem: 'Módulo Parque do China inicializado com sucesso.'
  };
}

function obterOuCriarAba_(ss, nomeAba, cabecalho) {
  let sh = ss.getSheetByName(nomeAba);
  if (!sh) sh = ss.insertSheet(nomeAba);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  } else {
    const atual = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), cabecalho.length)).getValues()[0];
    const precisaAtualizar = cabecalho.some((h, i) => atual[i] !== h);
    if (precisaAtualizar) {
      sh.clear();
      sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    }
  }

  return sh;
}

function popularChalesPadrao_(sh) {
  const linhas = [];
  for (let i = 1; i <= CONFIG_CHINA.QUANTIDADE_CHALES; i++) {
    const id = Utilities.formatString('CH%02d', i);
    const nome = Utilities.formatString('Chalé %02d', i);
    const tipo = (i === 1) ? 'Luxo / Hidromassagem' : 'Suíte Comum';

    linhas.push([
      id,
      nome,
      tipo,
      CONFIG_CHINA.CAPACIDADE_PADRAO,
      'SIM',
      CONFIG_CHINA.CAPACIDADE_MAXIMA,
      CONFIG_CHINA.TAXA_COLCHAO_EXTRA,
      'SIM',
      ''
    ]);
  }

  sh.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
}

function popularConfiguracoesPadraoChina_(sh) {
  const dados = [
    ['MAX_DIAS_ANTECEDENCIA', CONFIG_CHINA.MAX_DIAS_ANTECEDENCIA, 'Período máximo de antecedência para reserva'],
    ['CHECKIN_HORA', CONFIG_CHINA.CHECKIN_HORA, 'Hora padrão de check-in'],
    ['CHECKOUT_HORA', CONFIG_CHINA.CHECKOUT_HORA, 'Hora padrão de check-out'],
    ['CAPACIDADE_PADRAO', CONFIG_CHINA.CAPACIDADE_PADRAO, 'Capacidade padrão por chalé'],
    ['CAPACIDADE_MAXIMA', CONFIG_CHINA.CAPACIDADE_MAXIMA, 'Capacidade máxima com colchão extra'],
    ['TAXA_COLCHAO_EXTRA', CONFIG_CHINA.TAXA_COLCHAO_EXTRA, 'Valor do colchão extra'],
    ['QUANTIDADE_CHALES', CONFIG_CHINA.QUANTIDADE_CHALES, 'Número de chalés/suítes disponíveis']
  ];
  sh.getRange(2, 1, dados.length, dados[0].length).setValues(dados);
}

function formatarAbasModuloChina_(shChales, shReservas, shHist, shConfig) {
  [shChales, shReservas, shHist, shConfig].forEach(function(sh) {
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, sh.getLastColumn());
    sh.getRange(1, 1, 1, sh.getLastColumn())
      .setFontWeight('bold')
      .setBackground('#0b3b75')
      .setFontColor('#ffffff');
  });
}

/* ==========================================================
 * HELPERS
 * ========================================================== */
function agoraFormatado_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function timestampAtual_() {
  return new Date().getTime();
}

function gerarIdReservaChina_() {
  return 'RPC_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '_' + Math.floor(Math.random() * 900 + 100);
}

function gerarIdHistoricoChina_() {
  return 'HPC_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '_' + Math.floor(Math.random() * 900 + 100);
}

function normalizarTextoChina_(texto) {
  return String(texto || '').trim();
}

function normalizarCPFChina_(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function normalizarTelefoneChina_(telefone) {
  return String(telefone || '').replace(/\D/g, '');
}

function converterDataSegura_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }

  const txt = String(valor || '').trim();
  if (!txt) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    const partes = txt.split('-');
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const partes = txt.split('/');
    return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  }

  const dt = new Date(txt);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function formatarDataBR_(dt) {
  if (!dt || isNaN(dt.getTime())) return '';
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function diferencaDias_(inicio, fim) {
  const ms = fim.getTime() - inicio.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function diasDeAntecedencia_(dataEntrada) {
  const hoje = new Date();
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return diferencaDias_(hojeZerado, dataEntrada);
}

function obterIndiceColunaPorCabecalho_(cabecalho, nome) {
  return cabecalho.indexOf(nome);
}

function obterLinhasDados_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

/* ==========================================================
 * REGRAS DE NEGÓCIO
 * ========================================================== */
function validarSolicitacaoReservaChina_(dados) {
  const erros = [];

  const nome = normalizarTextoChina_(dados.nomeSolicitante);
  const cpf = normalizarCPFChina_(dados.cpf);
  const telefone = normalizarTelefoneChina_(dados.telefone);
  const email = normalizarTextoChina_(dados.email);
  const escola = normalizarTextoChina_(dados.escola);
  const dataEntrada = converterDataSegura_(dados.dataEntrada);
  const dataSaida = converterDataSegura_(dados.dataSaida);
  const quantidadePessoas = Number(dados.quantidadePessoas || 0);
  const solicitouColchaoExtra = String(dados.solicitouColchaoExtra || 'NAO').toUpperCase() === 'SIM';

  if (!nome) erros.push('Informe o nome do solicitante.');
  if (!cpf || cpf.length !== 11) erros.push('Informe um CPF válido com 11 dígitos.');
  if (!telefone || telefone.length < 10) erros.push('Informe um telefone válido.');
  if (!email) erros.push('Informe o e-mail.');
  if (!escola) erros.push('Informe a escola/vínculo.');
  if (!dataEntrada) erros.push('Informe a data de entrada.');
  if (!dataSaida) erros.push('Informe a data de saída.');

  if (dataEntrada && dataSaida) {
    if (dataSaida.getTime() <= dataEntrada.getTime()) {
      erros.push('A data de saída deve ser posterior à data de entrada.');
    }

    const antecedencia = diasDeAntecedencia_(dataEntrada);
    if (antecedencia < 0) {
      erros.push('A data de entrada não pode ser no passado.');
    }

    if (antecedencia > CONFIG_CHINA.MAX_DIAS_ANTECEDENCIA) {
      erros.push('As reservas só podem ser solicitadas com até 30 dias de antecedência.');
    }
  }

  if (quantidadePessoas <= 0) {
    erros.push('Informe a quantidade de pessoas.');
  }

  if (quantidadePessoas > CONFIG_CHINA.CAPACIDADE_MAXIMA) {
    erros.push('Cada chalé comporta no máximo 5 pessoas com colchão extra.');
  }

  if (quantidadePessoas > CONFIG_CHINA.CAPACIDADE_PADRAO && !solicitouColchaoExtra) {
    erros.push('Para 5 pessoas é obrigatório solicitar colchão extra.');
  }

  if (solicitouColchaoExtra && quantidadePessoas <= CONFIG_CHINA.CAPACIDADE_PADRAO) {
    // permitido, mas pode ser opcional
  }

  return {
    ok: erros.length === 0,
    erros: erros
  };
}

function calcularValorColchaoExtraChina_(quantidadePessoas, solicitouColchaoExtra) {
  quantidadePessoas = Number(quantidadePessoas || 0);
  solicitouColchaoExtra = String(solicitouColchaoExtra || 'NAO').toUpperCase() === 'SIM';

  if (solicitouColchaoExtra && quantidadePessoas > CONFIG_CHINA.CAPACIDADE_PADRAO) {
    return CONFIG_CHINA.TAXA_COLCHAO_EXTRA;
  }

  return 0;
}

function listarChalesAtivosChina_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_CHALES_CHINA);
  if (!sh || sh.getLastRow() < 2) return [];

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dados = obterLinhasDados_(sh);

  const idxId = obterIndiceColunaPorCabecalho_(cab, 'IDChale');
  const idxNome = obterIndiceColunaPorCabecalho_(cab, 'NomeChale');
  const idxTipo = obterIndiceColunaPorCabecalho_(cab, 'Tipo');
  const idxAtivo = obterIndiceColunaPorCabecalho_(cab, 'Ativo');

  return dados
    .filter(l => String(l[idxAtivo]).toUpperCase() === 'SIM')
    .map(l => ({
      id: l[idxId],
      nome: l[idxNome],
      tipo: l[idxTipo]
    }));
}

function verificarConflitoReservaChina_(chaleId, dataEntrada, dataSaida, ignorarIdReserva) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_RESERVAS_CHINA);
  if (!sh || sh.getLastRow() < 2) return false;

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dados = obterLinhasDados_(sh);

  const idxIdReserva = obterIndiceColunaPorCabecalho_(cab, 'IDReserva');
  const idxDataEntrada = obterIndiceColunaPorCabecalho_(cab, 'DataEntrada');
  const idxDataSaida = obterIndiceColunaPorCabecalho_(cab, 'DataSaida');
  const idxChaleAprovado = obterIndiceColunaPorCabecalho_(cab, 'ChaleAprovado');
  const idxStatus = obterIndiceColunaPorCabecalho_(cab, 'Status');

  return dados.some(function(l) {
    const idReserva = l[idxIdReserva];
    const chaleAprovado = l[idxChaleAprovado];
    const status = String(l[idxStatus] || '').toUpperCase();

    if (ignorarIdReserva && idReserva === ignorarIdReserva) return false;
    if (chaleAprovado !== chaleId) return false;
    if (status !== STATUS_RESERVA_CHINA.APROVADA && status !== STATUS_RESERVA_CHINA.FINALIZADA && status !== STATUS_RESERVA_CHINA.EM_ANALISE) {
      return false;
    }

    const iniExistente = converterDataSegura_(l[idxDataEntrada]);
    const fimExistente = converterDataSegura_(l[idxDataSaida]);
    if (!iniExistente || !fimExistente) return false;

    return (dataEntrada < fimExistente) && (dataSaida > iniExistente);
  });
}

function obterChalesDisponiveisChina(dataEntrada, dataSaida) {
  const ini = converterDataSegura_(dataEntrada);
  const fim = converterDataSegura_(dataSaida);

  if (!ini || !fim) {
    return {
      ok: false,
      mensagem: 'Informe datas válidas.'
    };
  }

  const chales = listarChalesAtivosChina_();
  const disponiveis = chales.filter(ch => !verificarConflitoReservaChina_(ch.id, ini, fim, ''));

  return {
    ok: true,
    total: chales.length,
    disponiveis: disponiveis,
    quantidadeDisponivel: disponiveis.length
  };
}

/* ==========================================================
 * SOLICITAÇÃO DO USUÁRIO
 * ========================================================== */
function solicitarReservaParqueChina(dados) {
  const validacao = validarSolicitacaoReservaChina_(dados);
  if (!validacao.ok) {
    return {
      ok: false,
      mensagem: 'Não foi possível registrar a solicitação.',
      erros: validacao.erros
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_RESERVAS_CHINA);

  const dataEntrada = converterDataSegura_(dados.dataEntrada);
  const dataSaida = converterDataSegura_(dados.dataSaida);
  const quantidadeNoites = diferencaDias_(dataEntrada, dataSaida);
  const quantidadePessoas = Number(dados.quantidadePessoas || 0);
  const solicitouColchaoExtra = String(dados.solicitouColchaoExtra || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NAO';
  const valorColchaoExtra = calcularValorColchaoExtraChina_(quantidadePessoas, solicitouColchaoExtra);

  const idReserva = gerarIdReservaChina_();

  sh.appendRow([
    idReserva,
    agoraFormatado_(),
    timestampAtual_(),
    normalizarTextoChina_(dados.nomeSolicitante),
    normalizarCPFChina_(dados.cpf),
    normalizarTelefoneChina_(dados.telefone),
    normalizarTextoChina_(dados.email),
    normalizarTextoChina_(dados.escola),
    formatarDataBR_(dataEntrada),
    formatarDataBR_(dataSaida),
    quantidadeNoites,
    quantidadePessoas,
    solicitouColchaoExtra,
    valorColchaoExtra,
    valorColchaoExtra,
    normalizarTextoChina_(dados.chaleSolicitado || 'QUALQUER_DISPONIVEL'),
    '',
    STATUS_RESERVA_CHINA.PENDENTE,
    normalizarTextoChina_(dados.observacaoSolicitante),
    '',
    '',
    '',
    ''
  ]);

  registrarHistoricoReservaChina_(idReserva, 'SOLICITACAO_CRIADA', '', STATUS_RESERVA_CHINA.PENDENTE, 'Solicitação registrada pelo usuário.');

  return {
    ok: true,
    mensagem: 'Solicitação registrada com sucesso.',
    idReserva: idReserva,
    status: STATUS_RESERVA_CHINA.PENDENTE,
    valorColchaoExtra: valorColchaoExtra
  };
}

/* ==========================================================
 * ADMINISTRAÇÃO
 * ========================================================== */
function listarReservasParqueChina(filtroStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_RESERVAS_CHINA);
  if (!sh || sh.getLastRow() < 2) return [];

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dados = obterLinhasDados_(sh);
  const idxStatus = obterIndiceColunaPorCabecalho_(cab, 'Status');

  return dados
    .filter(function(l) {
      if (!filtroStatus) return true;
      return String(l[idxStatus] || '').toUpperCase() === String(filtroStatus).toUpperCase();
    })
    .map(function(l) {
      const obj = {};
      cab.forEach(function(nome, i) { obj[nome] = l[i]; });
      return obj;
    })
    .sort(function(a, b) {
      return Number(b.Timestamp || 0) - Number(a.Timestamp || 0);
    });
}

function aprovarReservaParqueChina(idReserva, chaleId, observacaoInterna, responsavel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_RESERVAS_CHINA);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: false, mensagem: 'Base de reservas não encontrada.' };
  }

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dados = obterLinhasDados_(sh);

  const idxIdReserva = obterIndiceColunaPorCabecalho_(cab, 'IDReserva');
  const idxDataEntrada = obterIndiceColunaPorCabecalho_(cab, 'DataEntrada');
  const idxDataSaida = obterIndiceColunaPorCabecalho_(cab, 'DataSaida');
  const idxStatus = obterIndiceColunaPorCabecalho_(cab, 'Status');
  const idxChaleAprovado = obterIndiceColunaPorCabecalho_(cab, 'ChaleAprovado');
  const idxObsInterna = obterIndiceColunaPorCabecalho_(cab, 'ObservacaoInterna');
  const idxResponsavel = obterIndiceColunaPorCabecalho_(cab, 'ResponsavelAnalise');
  const idxDataHoraAnalise = obterIndiceColunaPorCabecalho_(cab, 'DataHoraAnalise');

  for (let i = 0; i < dados.length; i++) {
    if (dados[i][idxIdReserva] === idReserva) {
      const linhaPlanilha = i + 2;
      const dataEntrada = converterDataSegura_(dados[i][idxDataEntrada]);
      const dataSaida = converterDataSegura_(dados[i][idxDataSaida]);
      const statusAnterior = String(dados[i][idxStatus] || '');

      if (!chaleId) {
        return { ok: false, mensagem: 'Informe o chalé a ser aprovado.' };
      }

      if (verificarConflitoReservaChina_(chaleId, dataEntrada, dataSaida, idReserva)) {
        return {
          ok: false,
          mensagem: 'Já existe conflito de datas para esse chalé no período selecionado.'
        };
      }

      sh.getRange(linhaPlanilha, idxChaleAprovado + 1).setValue(chaleId);
      sh.getRange(linhaPlanilha, idxStatus + 1).setValue(STATUS_RESERVA_CHINA.APROVADA);
      sh.getRange(linhaPlanilha, idxObsInterna + 1).setValue(normalizarTextoChina_(observacaoInterna));
      sh.getRange(linhaPlanilha, idxResponsavel + 1).setValue(normalizarTextoChina_(responsavel));
      sh.getRange(linhaPlanilha, idxDataHoraAnalise + 1).setValue(agoraFormatado_());

      registrarHistoricoReservaChina_(
        idReserva,
        'APROVACAO',
        statusAnterior,
        STATUS_RESERVA_CHINA.APROVADA,
        'Reserva aprovada para o chalé ' + chaleId + '.'
      );

      return {
        ok: true,
        mensagem: 'Reserva aprovada com sucesso.',
        chaleId: chaleId
      };
    }
  }

  return { ok: false, mensagem: 'Reserva não encontrada.' };
}

function recusarReservaParqueChina(idReserva, motivoRecusa, observacaoInterna, responsavel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_RESERVAS_CHINA);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: false, mensagem: 'Base de reservas não encontrada.' };
  }

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dados = obterLinhasDados_(sh);

  const idxIdReserva = obterIndiceColunaPorCabecalho_(cab, 'IDReserva');
  const idxStatus = obterIndiceColunaPorCabecalho_(cab, 'Status');
  const idxObsInterna = obterIndiceColunaPorCabecalho_(cab, 'ObservacaoInterna');
  const idxResponsavel = obterIndiceColunaPorCabecalho_(cab, 'ResponsavelAnalise');
  const idxDataHoraAnalise = obterIndiceColunaPorCabecalho_(cab, 'DataHoraAnalise');
  const idxMotivoRecusa = obterIndiceColunaPorCabecalho_(cab, 'MotivoRecusa');

  for (let i = 0; i < dados.length; i++) {
    if (dados[i][idxIdReserva] === idReserva) {
      const linhaPlanilha = i + 2;
      const statusAnterior = String(dados[i][idxStatus] || '');

      sh.getRange(linhaPlanilha, idxStatus + 1).setValue(STATUS_RESERVA_CHINA.RECUSADA);
      sh.getRange(linhaPlanilha, idxObsInterna + 1).setValue(normalizarTextoChina_(observacaoInterna));
      sh.getRange(linhaPlanilha, idxResponsavel + 1).setValue(normalizarTextoChina_(responsavel));
      sh.getRange(linhaPlanilha, idxDataHoraAnalise + 1).setValue(agoraFormatado_());
      sh.getRange(linhaPlanilha, idxMotivoRecusa + 1).setValue(normalizarTextoChina_(motivoRecusa));

      registrarHistoricoReservaChina_(
        idReserva,
        'RECUSA',
        statusAnterior,
        STATUS_RESERVA_CHINA.RECUSADA,
        'Reserva recusada. Motivo: ' + normalizarTextoChina_(motivoRecusa)
      );

      return {
        ok: true,
        mensagem: 'Reserva recusada com sucesso.'
      };
    }
  }

  return { ok: false, mensagem: 'Reserva não encontrada.' };
}

function registrarHistoricoReservaChina_(idReserva, acao, statusAnterior, statusNovo, detalhes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_HISTORICO_CHINA);
  if (!sh) return;

  sh.appendRow([
    gerarIdHistoricoChina_(),
    idReserva,
    agoraFormatado_(),
    acao,
    Session.getActiveUser().getEmail() || 'Sistema',
    statusAnterior || '',
    statusNovo || '',
    detalhes || ''
  ]);
}

/* ==========================================================
 * DASHBOARD
 * ========================================================== */
function dashboardReservaParqueChina() {
  const reservas = listarReservasParqueChina();
  const hoje = new Date();
  const hojeBr = formatarDataBR_(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));

  let pendentes = 0;
  let aprovadas = 0;
  let recusadas = 0;
  let emAnalise = 0;
  let ocupadosHoje = 0;

  reservas.forEach(function(r) {
    const status = String(r.Status || '').toUpperCase();

    if (status === STATUS_RESERVA_CHINA.PENDENTE) pendentes++;
    if (status === STATUS_RESERVA_CHINA.APROVADA) aprovadas++;
    if (status === STATUS_RESERVA_CHINA.RECUSADA) recusadas++;
    if (status === STATUS_RESERVA_CHINA.EM_ANALISE) emAnalise++;

    const ini = converterDataSegura_(r.DataEntrada);
    const fim = converterDataSegura_(r.DataSaida);
    const hojeDt = converterDataSegura_(hojeBr);

    if (status === STATUS_RESERVA_CHINA.APROVADA && ini && fim && hojeDt) {
      if (hojeDt >= ini && hojeDt < fim) {
        ocupadosHoje++;
      }
    }
  });

  return {
    totalReservas: reservas.length,
    pendentes: pendentes,
    aprovadas: aprovadas,
    recusadas: recusadas,
    emAnalise: emAnalise,
    chalesTotais: CONFIG_CHINA.QUANTIDADE_CHALES,
    chalesOcupadosHoje: ocupadosHoje,
    chalesDisponiveisHoje: Math.max(0, CONFIG_CHINA.QUANTIDADE_CHALES - ocupadosHoje),
    taxaColchaoExtra: CONFIG_CHINA.TAXA_COLCHAO_EXTRA
  };
}