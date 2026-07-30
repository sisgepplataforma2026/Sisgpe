// ============================================================================
// ARQUIVO: CarteirinhaAdmin.gs
// Emissão e gestão de carteirinhas digitais — lado administrativo.
//
// O associado envia a foto pela atualização de cadastro no Portal Público
// (aprovFotoParaCarteirinha_, em AprovacaoCadastro.gs), que grava na aba
// "Carteirinhas" com Status "Aprovada". Este arquivo cuida do passo
// seguinte, que faltava: emitir a carteirinha de fato (gerar um código de
// validação imprevisível e uma validade), gravando na aba
// "Carteirinhas_Emitidas" — a mesma aba que o projeto do Portal Público
// (repositório separado, mesma planilha) já lê para decidir se mostra o
// QR Code da credencial e para onde ele aponta.
// ============================================================================

var CARTAD_ABA_CARTEIRINHAS = 'Carteirinhas';
var CARTAD_ABA_EMITIDAS = 'Carteirinhas_Emitidas';
var CARTAD_CABECALHO_EMITIDAS = ['CPF', 'Nome', 'Codigo_Validacao', 'Status', 'Validade', 'Data_Emissao', 'Emitido_Por'];

function cartAd_obterAbaEmitidas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CARTAD_ABA_EMITIDAS);
  if (!sh) {
    sh = ss.insertSheet(CARTAD_ABA_EMITIDAS);
    sh.appendRow(CARTAD_CABECALHO_EMITIDAS);
  }
  return sh;
}

// Código imprevisível — o QR Code da credencial aponta pra ele publicamente,
// por isso não pode ser algo dedutível a partir do CPF (achado de segurança
// já registrado no código do Portal Público).
function cartAd_gerarCodigoValidacao_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

// Sugestão de validade padrão: 28/02 do próximo ciclo de filiação (mesmo
// padrão já usado no cartão da credencial). Só uma sugestão — o atendente
// pode ajustar antes de confirmar a emissão.
function cartAd_sugerirValidade_() {
  var hoje = new Date();
  var ano = hoje.getMonth() >= 1 ? hoje.getFullYear() + 1 : hoje.getFullYear(); // mês 1 = fevereiro (0-index)
  return '28/02/' + ano;
}

// Mapa CPF -> emissão mais recente (percorre de baixo pra cima, igual à
// leitura feita no Portal Público, pra pegar sempre a última emissão).
function cartAd_mapaEmitidasPorCpf_() {
  var sh = cartAd_obterAbaEmitidas_();
  var mapa = {};
  if (sh.getLastRow() < 2) return mapa;

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    var cpf = String(dados[i][0] || '').replace(/\D/g, '');
    if (!cpf) continue;
    mapa[cpf] = {
      linha: i + 2,
      nome: dados[i][1] || '',
      codigo: dados[i][2] || '',
      status: dados[i][3] || '',
      validade: dados[i][4] || ''
    };
  }
  return mapa;
}

/**
 * Lista as carteirinhas com foto aprovada (aba "Carteirinhas"), já
 * indicando se cada uma tem emissão ativa, revogada, ou nenhuma ainda.
 */
function listarCarteirinhasParaEmissao(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    if (!sh || sh.getLastRow() < 2) return [];

    var dados = sh.getDataRange().getValues();
    var emitidas = cartAd_mapaEmitidasPorCpf_();
    var lista = [];

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var cpf = String(linha[0] || '').replace(/\D/g, '');
      if (!cpf) continue;

      var emissao = emitidas[cpf];

      lista.push({
        cpf: cpf,
        nome: linha[1] || '',
        urlFoto: linha[2] || '',
        statusFoto: linha[3] || '',
        dataEnvio: linha[4] instanceof Date ? Utilities.formatDate(linha[4], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(linha[4] || ''),
        dataAprovacao: linha[5] instanceof Date ? Utilities.formatDate(linha[5], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(linha[5] || ''),
        aprovadoPor: linha[6] || '',
        origem: linha[7] || '',
        motivoRejeicao: linha[8] || '',
        emitida: !!emissao,
        emissaoStatus: emissao ? String(emissao.status || '').toUpperCase() : '',
        emissaoValidade: emissao ? emissao.validade : '',
        emissaoCodigo: emissao ? emissao.codigo : ''
      });
    }

    lista.reverse(); // mais recentes primeiro
    return lista;
  } catch (e) {
    Logger.log('listarCarteirinhasParaEmissao: ' + e);
    return [];
  }
}

function sugerirValidadeCarteirinha(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return cartAd_sugerirValidade_();
}

/**
 * Emite (ou reemite) a carteirinha de um associado: gera um novo código de
 * validação e grava a validade escolhida na aba "Carteirinhas_Emitidas".
 * Uma nova linha é sempre adicionada (histórico completo); a leitura no
 * Portal Público já considera só a mais recente por CPF.
 */
function emitirCarteirinha(cpf, validade, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (!validade || !String(validade).trim()) return { sucesso: false, mensagem: 'Informe a validade da carteirinha.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shCarteirinhas = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var nome = '';
    if (shCarteirinhas && shCarteirinhas.getLastRow() > 1) {
      var dados = shCarteirinhas.getDataRange().getValues();
      for (var i = 1; i < dados.length; i++) {
        if (String(dados[i][0] || '').replace(/\D/g, '') === cpfLimpo) {
          nome = dados[i][1] || '';
          break;
        }
      }
    }
    if (!nome) return { sucesso: false, mensagem: 'CPF não encontrado na lista de fotos aprovadas.' };

    var codigo = cartAd_gerarCodigoValidacao_();
    var sh = cartAd_obterAbaEmitidas_();
    sh.appendRow([
      cpfLimpo,
      nome,
      codigo,
      'ATIVA',
      String(validade).trim(),
      new Date(),
      sessao.email || sessao.usuario || 'SISGEP'
    ]);

    return {
      sucesso: true,
      codigo: codigo,
      mensagem: 'Carteirinha emitida com sucesso. O QR Code já fica ativo no Portal do Associado.'
    };
  } catch (e) {
    Logger.log('emitirCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao emitir: ' + e.message };
  }
}

/**
 * Localiza a linha mais recente de um CPF na aba "Carteirinhas".
 * Retorna 0 se não encontrar.
 */
function cartAd_linhaPorCpf_(sh, cpfLimpo) {
  if (!sh || sh.getLastRow() < 2) return 0;
  var cpfs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var linha = 0;
  for (var i = 0; i < cpfs.length; i++) {
    if (String(cpfs[i][0] || '').replace(/\D/g, '') === cpfLimpo) linha = i + 2;
  }
  return linha;
}

/**
 * Garante que a aba "Carteirinhas" tem a 9ª coluna "Motivo Rejeição"
 * (abas criadas antes dessa função só tinham 8). Idempotente.
 */
function cartAd_garantirColunaMotivo_(sh) {
  if (sh.getLastColumn() < 9) sh.getRange(1, 9).setValue('Motivo Rejeição');
}

/**
 * Aprova a foto de uma solicitação de carteirinha (feita pelo associado
 * no Portal Público, Status "Pendente" na aba "Carteirinhas") E já emite
 * a credencial no mesmo passo — antes eram duas ferramentas separadas,
 * agora Marcela faz tudo numa ação só: confere se é sindicalizado, se a
 * foto está adequada, confirma a validade e pronto.
 */
function aprovarEEmitirCarteirinha(cpf, validade, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { sucesso: false, mensagem: 'Solicitação não encontrada.' };

    sh.getRange(linha, 4).setValue('Aprovada'); // Status
    sh.getRange(linha, 6).setValue(new Date()); // Data Aprovação
    sh.getRange(linha, 7).setValue(sessao.email || sessao.usuario || 'SISGEP'); // Aprovado Por
    cartAd_garantirColunaMotivo_(sh);
    sh.getRange(linha, 9).setValue(''); // limpa motivo de rejeição anterior, se houver

    return emitirCarteirinha(cpfLimpo, validade, tokenSessao);
  } catch (e) {
    Logger.log('aprovarEEmitirCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao aprovar e emitir: ' + e.message };
  }
}

/**
 * Rejeita a foto de uma solicitação (não emite nada) — o associado vê o
 * motivo no Portal Público e pode enviar uma foto nova.
 */
function rejeitarSolicitacaoCarteirinha(cpf, motivo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (!motivo || !String(motivo).trim()) return { sucesso: false, mensagem: 'Informe o motivo da rejeição.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { sucesso: false, mensagem: 'Solicitação não encontrada.' };

    sh.getRange(linha, 4).setValue('Rejeitada'); // Status
    sh.getRange(linha, 6).setValue(new Date()); // Data Aprovação (aqui, data da decisão)
    sh.getRange(linha, 7).setValue(sessao.email || sessao.usuario || 'SISGEP'); // Aprovado Por
    cartAd_garantirColunaMotivo_(sh);
    sh.getRange(linha, 9).setValue(String(motivo).trim());

    return { sucesso: true, mensagem: 'Solicitação rejeitada. O associado vai ver o motivo e pode enviar outra foto.' };
  } catch (e) {
    Logger.log('rejeitarSolicitacaoCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao rejeitar: ' + e.message };
  }
}

/**
 * Devolve a foto da solicitação como data URI, pra revisão da equipe
 * antes de aprovar/rejeitar. Mesma lógica de acesso do Portal Público
 * (arquivo fica PRIVADO no Drive; só a execução do Apps Script, que
 * roda como quem implantou, consegue ler — não expõe link público).
 */
function obterFotoCarteirinhaParaRevisao(cpf, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { ok: false };
    var fotoId = String(sh.getRange(linha, 3).getValue() || '');
    if (!fotoId) return { ok: false };
    var blob = DriveApp.getFileById(fotoId).getBlob();
    return { ok: true, dataUri: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    Logger.log('obterFotoCarteirinhaParaRevisao: ' + e);
    return { ok: false, mensagem: 'Não foi possível carregar a foto.' };
  }
}

/**
 * Revoga a emissão ativa mais recente de um CPF (ex: carteirinha perdida,
 * cadastro cancelado). Não apaga o histórico — grava uma nova linha com
 * status REVOGADA, mesma lógica de sempre pegar a mais recente por CPF.
 */
function revogarCarteirinha(cpf, motivo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };

    var emitidas = cartAd_mapaEmitidasPorCpf_();
    var emissao = emitidas[cpfLimpo];
    if (!emissao) return { sucesso: false, mensagem: 'Este CPF não tem nenhuma carteirinha emitida.' };

    var sh = cartAd_obterAbaEmitidas_();
    sh.appendRow([
      cpfLimpo,
      emissao.nome,
      emissao.codigo,
      'REVOGADA',
      emissao.validade,
      new Date(),
      sessao.email || sessao.usuario || 'SISGEP'
    ]);

    return { sucesso: true, mensagem: 'Carteirinha revogada. O QR Code deixa de validar imediatamente.' };
  } catch (e) {
    Logger.log('revogarCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao revogar: ' + e.message };
  }
}
