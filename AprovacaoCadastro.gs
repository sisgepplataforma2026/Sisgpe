// ============================================================================
// ARQUIVO: AprovacaoCadastro.gs
// Módulo SISGEP: aprovação de solicitações de atualização cadastral enviadas
// pelo Portal do Associado (projeto público separado, mesma planilha de
// produção). Só usuários autenticados no SISGEP acessam este módulo.
// ============================================================================

var APROV_ABA_SOLICITACOES = 'Solicitacoes_Atualizacao';
var APROV_ABA_ASSOCIADOS = 'Associados';
var APROV_ABA_CARTEIRINHAS = 'Carteirinhas';

/**
 * Lista as solicitações com status "Pendente", mais recentes primeiro.
 * O numeroLinha retornado é a linha real na planilha — usado depois
 * para aprovar ou rejeitar.
 */
function listarSolicitacoesPendentes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(APROV_ABA_SOLICITACOES);
    if (!sh) return [];

    var dados = sh.getDataRange().getValues();
    var pendentes = [];

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var status = String(linha[13] || '').trim(); // Coluna N — Status
      if (status === 'Pendente') {
        pendentes.push({
          numeroLinha: i + 1,
          data: linha[0] instanceof Date
            ? Utilities.formatDate(linha[0], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
            : String(linha[0] || ''),
          cpf: linha[1] || '',
          nome: linha[2] || '',
          logradouro: linha[4] || '',
          numero: linha[5] || '',
          bairro: linha[6] || '',
          cidade: linha[7] || '',
          cep: linha[8] || '',
          celular: linha[9] || '',
          celular2: linha[10] || '',
          email: linha[11] || '',
          fotoUrl: linha[12] || '',
          origem: linha[15] || ''
        });
      }
    }

    pendentes.reverse(); // mais recentes primeiro
    return pendentes;
  } catch (e) {
    Logger.log('listarSolicitacoesPendentes: ' + e);
    return [];
  }
}

/**
 * Aprova uma solicitação: grava os dados novos na aba Associados,
 * grava a data de última atualização (reinicia o contador de 90 dias
 * usado pelo Portal), marca a solicitação como aprovada e replica a
 * foto (se houver) para a aba Carteirinhas.
 */
function aprovarSolicitacaoCadastro(numeroLinha, aprovadoPor) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shSolic = ss.getSheetByName(APROV_ABA_SOLICITACOES);
    if (!shSolic) return {sucesso:false, mensagem:'Aba de solicitações não encontrada.'};

    var linha = shSolic.getRange(numeroLinha, 1, 1, 16).getValues()[0];
    var statusAtual = String(linha[13] || '').trim();
    if (statusAtual !== 'Pendente') {
      return {sucesso:false, mensagem:'Esta solicitação já foi processada (status atual: ' + statusAtual + ').'};
    }

    var cpf = String(linha[1] || '');
    var linhaAssociado = Number(linha[3]);
    var fotoUrl = linha[12] || '';

    var shAssoc = ss.getSheetByName(APROV_ABA_ASSOCIADOS);
    if (!shAssoc) return {sucesso:false, mensagem:'Aba Associados não encontrada.'};

    // Revalida que a linha do associado ainda corresponde ao mesmo CPF
    // (proteção contra a planilha ter sido reordenada entre o envio e a aprovação)
    var cpfNaLinha = String(shAssoc.getRange(linhaAssociado, 3).getValue()).replace(/\D/g, '');
    if (cpfNaLinha !== cpf.replace(/\D/g, '')) {
      return {sucesso:false, mensagem:'A linha do associado não corresponde mais ao CPF da solicitação. Verifique manualmente antes de aprovar.'};
    }

    shAssoc.getRange(linhaAssociado, 5).setValue(linha[4]);   // Logradouro
    shAssoc.getRange(linhaAssociado, 6).setValue(linha[5]);   // Número
    shAssoc.getRange(linhaAssociado, 7).setValue(linha[6]);   // Bairro
    shAssoc.getRange(linhaAssociado, 8).setValue(linha[7]);   // Cidade
    shAssoc.getRange(linhaAssociado, 9).setValue(linha[8]);   // CEP
    shAssoc.getRange(linhaAssociado, 10).setValue(linha[9]);  // Celular
    shAssoc.getRange(linhaAssociado, 11).setValue(linha[10]); // Celular2
    shAssoc.getRange(linhaAssociado, 12).setValue(linha[11]); // Email
    shAssoc.getRange(linhaAssociado, 13).setValue(new Date()); // Última atualização

    shSolic.getRange(numeroLinha, 14).setValue('Aprovado');
    shSolic.getRange(numeroLinha, 15).setValue(new Date());

    if (fotoUrl) {
      aprovFotoParaCarteirinha_(cpf, String(linha[2] || ''), fotoUrl, aprovadoPor);
    }

    return {sucesso:true, mensagem:'Solicitação aprovada e cadastro atualizado com sucesso.'};
  } catch (e) {
    Logger.log('aprovarSolicitacaoCadastro: ' + e);
    return {sucesso:false, mensagem:'Erro ao aprovar: ' + e};
  }
}

/**
 * Rejeita uma solicitação, sem alterar a aba Associados.
 */
function rejeitarSolicitacaoCadastro(numeroLinha, motivo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shSolic = ss.getSheetByName(APROV_ABA_SOLICITACOES);
    if (!shSolic) return {sucesso:false, mensagem:'Aba de solicitações não encontrada.'};

    var statusAtual = String(shSolic.getRange(numeroLinha, 14).getValue() || '').trim();
    if (statusAtual !== 'Pendente') {
      return {sucesso:false, mensagem:'Esta solicitação já foi processada (status atual: ' + statusAtual + ').'};
    }

    shSolic.getRange(numeroLinha, 14).setValue('Rejeitado' + (motivo ? ' — ' + motivo : ''));
    shSolic.getRange(numeroLinha, 15).setValue(new Date());

    return {sucesso:true, mensagem:'Solicitação rejeitada.'};
  } catch (e) {
    Logger.log('rejeitarSolicitacaoCadastro: ' + e);
    return {sucesso:false, mensagem:'Erro ao rejeitar: ' + e};
  }
}

/**
 * Cria (ou atualiza) o registro do associado na aba Carteirinhas com a
 * foto recém-aprovada. Cria a aba com o cabeçalho padrão se ainda não existir.
 * AJUSTE se a aba Carteirinhas já existir com colunas diferentes — me avise
 * a estrutura real e eu adapto esta função sem tocar no resto do módulo.
 */
function aprovFotoParaCarteirinha_(cpf, nome, fotoUrl, aprovadoPor) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(APROV_ABA_CARTEIRINHAS);

  if (!sh) {
    sh = ss.insertSheet(APROV_ABA_CARTEIRINHAS);
    sh.appendRow(['CPF', 'Nome', 'URL Foto', 'Status', 'Data Envio', 'Data Aprovação', 'Aprovado Por', 'Origem']);
  }

  var dados = sh.getDataRange().getValues();
  var cpfLimpo = String(cpf).replace(/\D/g, '');

  for (var i = 1; i < dados.length; i++) {
    var cpfLinha = String(dados[i][0]).replace(/\D/g, '');
    if (cpfLinha === cpfLimpo) {
      sh.getRange(i + 1, 3).setValue(fotoUrl);
      sh.getRange(i + 1, 4).setValue('Aprovada');
      sh.getRange(i + 1, 6).setValue(new Date());
      sh.getRange(i + 1, 7).setValue(aprovadoPor || '');
      return;
    }
  }

  sh.appendRow([cpf, nome, fotoUrl, 'Aprovada', new Date(), new Date(), aprovadoPor || '', 'portal-otp']);
}
