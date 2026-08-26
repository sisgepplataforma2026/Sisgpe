/**
 * ============================================================================
 * IMPORTAÇÃO ÚNICA DE HISTÓRICO — Parque do China
 * ============================================================================
 * Uso:
 * 1. Abra o arquivo "Importacao_ParqueChina_Historico.xlsx" que foi gerado.
 * 2. Na planilha do SISGEP: Arquivo > Importar > Fazer upload > selecione o
 *    arquivo > "Inserir nova(s) planilha(s)". Isso vai criar 2 abas novas:
 *    "ImportacaoHistoricoParqueChina" e "Revisao Necessaria".
 * 3. Rode a função importarHistoricoParqueChina() UMA VEZ pelo editor do GAS
 *    (selecione a função no dropdown e clique em Executar).
 * 4. Confira o log (Ver > Registros de execução) com o resumo.
 * 5. Depois de confirmar que está tudo certo, pode apagar a aba
 *    "ImportacaoHistoricoParqueChina" (a "Revisao Necessaria" pode ficar
 *    guardada pra você tratar os 20 casos manualmente, ou apagar também).
 *
 * Esta função NÃO apaga nem sobrescreve nada em ReservasParqueChina — só
 * adiciona linhas novas no final. Pode rodar com segurança mesmo que a aba
 * já tenha dados de teste.
 *
 * Requer que ReservaParqueChina.gs (v2) já esteja no projeto.
 * ============================================================================
 */

function importarHistoricoParqueChina() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var abaImportacao = planilha.getSheetByName("ImportacaoHistoricoParqueChina");

  if (!abaImportacao) {
    throw new Error('Aba "ImportacaoHistoricoParqueChina" não encontrada. Importe o arquivo xlsx primeiro (Arquivo > Importar).');
  }

  var ultimaLinha = abaImportacao.getLastRow();
  if (ultimaLinha < 2) {
    Logger.log("Nenhuma linha para importar.");
    return { ok: true, totalImportado: 0 };
  }

  // Colunas da aba de importação (mesma ordem do xlsx gerado):
  // status, tipo_reserva, data_entrada, data_saida, suite_solicitada, suite_definida,
  // nome_solicitante, cpf, telefone, escola, dependente1-4, valor_total, gratuito_pago,
  // observacao_admin, aba_origem
  var dados = abaImportacao.getRange(2, 1, ultimaLinha - 1, 18).getValues();

  var abaDestino = obterAbaReservaParqueChina_();
  var linhasParaGravar = [];
  var contadorPorDia = {}; // pra gerar IDs sequenciais sem repetir dentro da própria importação

  dados.forEach(function (linha) {
    var status = linha[0] || "APROVADA";
    var tipoReserva = linha[1] || "SEMANAL";
    var dataEntradaRaw = linha[2];
    var dataSaidaRaw = linha[3];
    var suiteSolicitada = String(linha[4] || "").trim();
    var suiteDefinida = String(linha[5] || "").trim();
    var nomeSolicitante = String(linha[6] || "").trim();
    var cpf = String(linha[7] || "").trim();
    var telefone = String(linha[8] || "-").trim() || "-";
    var escola = String(linha[9] || "").trim();
    var dependentes = [linha[10], linha[11], linha[12], linha[13]].map(function (d) { return String(d || "").trim(); });
    var valorTotal = Number(linha[14]) || 0;
    var gratuitoPago = linha[15] || "GRATUITO";
    var observacaoAdmin = String(linha[16] || "").trim();
    var abaOrigem = String(linha[17] || "").trim();

    if (!nomeSolicitante || !dataEntradaRaw || !dataSaidaRaw) return; // segurança extra

    var dataEntrada = new Date(dataEntradaRaw);
    var dataSaida = new Date(dataSaidaRaw);
    if (isNaN(dataEntrada.getTime()) || isNaN(dataSaida.getTime())) return;

    // gera ID sequencial baseado na data de entrada (histórico), evitando
    // colisão com o gerador padrão (que usa a data de HOJE)
    var prefixoData = Utilities.formatDate(dataEntrada, PARQUE_CHINA_CONFIG.TIMEZONE, "yyMMdd");
    contadorPorDia[prefixoData] = (contadorPorDia[prefixoData] || 0) + 1;
    var idReserva = "PC-HIST-" + prefixoData + "-" + ("00" + contadorPorDia[prefixoData]).slice(-3);

    var novaLinha = [];
    novaLinha[PC_COL.ID_RESERVA - 1] = idReserva;
    novaLinha[PC_COL.DATA_SOLICITACAO - 1] = dataEntrada; // não temos a data real de solicitação em todos os casos
    novaLinha[PC_COL.STATUS - 1] = status;
    novaLinha[PC_COL.TIPO_RESERVA - 1] = (tipoReserva === "FIM_DE_SEMANA") ? "FIM_DE_SEMANA" : "SEMANAL";
    novaLinha[PC_COL.DATA_ENTRADA - 1] = dataEntrada;
    novaLinha[PC_COL.DATA_SAIDA - 1] = dataSaida;
    novaLinha[PC_COL.SUITE_SOLICITADA - 1] = suiteSolicitada || "QUALQUER_DISPONIVEL";
    novaLinha[PC_COL.NOME_SOLICITANTE - 1] = nomeSolicitante;
    novaLinha[PC_COL.CPF - 1] = cpf;
    novaLinha[PC_COL.TELEFONE - 1] = telefone;
    novaLinha[PC_COL.EMAIL - 1] = "";
    novaLinha[PC_COL.ESCOLA - 1] = escola;
    novaLinha[PC_COL.QTD_PESSOAS - 1] = "";
    novaLinha[PC_COL.DEPENDENTE_1 - 1] = dependentes[0];
    novaLinha[PC_COL.DEPENDENTE_2 - 1] = dependentes[1];
    novaLinha[PC_COL.DEPENDENTE_3 - 1] = dependentes[2];
    novaLinha[PC_COL.DEPENDENTE_4 - 1] = dependentes[3];
    novaLinha[PC_COL.COLCHAO_EXTRA - 1] = "NAO";
    novaLinha[PC_COL.VALOR_COLCHAO_EXTRA - 1] = 0;
    novaLinha[PC_COL.VALOR_DIARIA - 1] = "";
    novaLinha[PC_COL.VALOR_TOTAL - 1] = valorTotal;
    novaLinha[PC_COL.FORMA_PAGAMENTO - 1] = valorTotal > 0 ? "Não especificado (migração)" : "";
    novaLinha[PC_COL.GRATUITO_PAGO - 1] = gratuitoPago;
    novaLinha[PC_COL.OBSERVACAO_SOLICITANTE - 1] = "";
    novaLinha[PC_COL.OBSERVACAO_ADMIN - 1] = "[Migrado de '" + abaOrigem + "'] " + observacaoAdmin;
    novaLinha[PC_COL.RESPONSAVEL_APROVACAO - 1] = "Migração histórica automática";
    novaLinha[PC_COL.DATA_APROVACAO - 1] = dataEntrada;
    novaLinha[PC_COL.MOTIVO_RECUSA - 1] = "";
    novaLinha[PC_COL.SUITE_DEFINIDA - 1] = suiteDefinida;
    novaLinha[PC_COL.SORTEIO_ID - 1] = "";

    linhasParaGravar.push(novaLinha);
  });

  if (linhasParaGravar.length > 0) {
    abaDestino.getRange(abaDestino.getLastRow() + 1, 1, linhasParaGravar.length, PC_CABECALHO.length)
      .setValues(linhasParaGravar);
  }

  var mensagem = "Importação concluída: " + linhasParaGravar.length + " reserva(s) histórica(s) adicionada(s) em ReservasParqueChina.";
  Logger.log(mensagem);

  return { ok: true, totalImportado: linhasParaGravar.length, mensagem: mensagem };
}