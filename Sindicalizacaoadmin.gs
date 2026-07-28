// ============================================================================
// ARQUIVO: SindicalizacaoAdmin.gs
// Módulo SISGEP: lado ADMINISTRATIVO da Sindicalização Digital.
// O lado público do fluxo (formulário, OTP, assinatura, CEP) vive no
// arquivo Sindicalizacao.gs, NESTE MESMO projeto (SISGEP-OFICIOS).
// A aba SISGEP_Sindicalizacao na planilha de produção é a fonte única.
//
// IMPORTANTE: o contador de matrícula sequencial (PropertiesService) e as
// funções de aprovação vivem SOMENTE neste arquivo. Se um dia o fluxo
// público for movido para outro projeto (ex.: Portal do Associado), as
// aprovações devem continuar acontecendo apenas por aqui, pois
// LockService/PropertiesService são por projeto.
//
// DEPENDÊNCIAS (mesmo projeto):
//   SindicalizacaoAssociados.gs → sindAss_gravarDaFicha_
//   SindicalizacaoEmails.gs     → sind_enviarEmailBoasVindas_,
//                                 sind_enviarEmailRejeicao_
//
// Helpers internos prefixados com sindAdm_ para não colidir com funções já
// existentes no SISGEP. Funções públicas mantêm os nomes chamados pela tela
// de Aprovações: listarFichasSindicalizacao, obterFichaSindicalizacao,
// aprovarFichaSindicalizacao, rejeitarFichaSindicalizacao.
// ============================================================================

var SIND_ADM_ABA = 'SISGEP_Sindicalizacao';
var SIND_ADM_PROP_MATRICULA = 'SINDICALIZACAO_ULTIMA_MATRICULA';
var SIND_ADM_PASTA_PDF = 'SISGEP_Fichas_Sindicalizacao';
var SIND_ADM_CACHE_SEG = 120;

// Logo oficial usada no cabeçalho da ficha (mesma arte do index.html).
// Trocar pelo ID do arquivo no Drive caso a arte da ficha seja outra.
var SIND_ADM_LOGO_FILE_ID = '1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7';

var SIND_ADM_COLUNAS = [
  'ID_FICHA', 'TIPO', 'MATRICULA',
  'NOME_COMPLETO', 'SEXO', 'CPF', 'RG', 'ORGAO_EXPEDIDOR', 'UF_RG',
  'TITULO_ELEITOR', 'ZONA', 'SECAO',
  'TELEFONE_1', 'TELEFONE_2', 'CELULAR', 'EMAIL', 'TIPO_EMAIL',
  'CEP_RESIDENCIAL', 'TIPO_LOGRADOURO', 'ENDERECO', 'NUMERO',
  'COMPLEMENTO', 'BAIRRO', 'UF', 'CIDADE',
  'DATA_NASCIMENTO', 'ESCOLARIDADE',
  'ESCOLA', 'DATA_ADMISSAO', 'CARGO', 'CIDADE_ESCOLA', 'CEP_ESCOLA',
  'STATUS', 'ORIGEM', 'ID_VISITA', 'DIRETOR_BASE',
  'DATA_CRIACAO', 'DATA_HORA_ASSINATURA', 'IP_ASSINATURA',
  'OTP_VALIDADO', 'HASH_FICHA', 'LINK_PDF',
  'MOTIVO_REJEICAO', 'APROVADO_POR', 'DATA_APROVACAO'
];

// ============================================================================
// FUNÇÕES PÚBLICAS (chamadas pela tela de Fichas Sindicais)
// ============================================================================

/**
 * Lista fichas para o painel, com filtros opcionais:
 * { status, escola, origem, diretorBase, texto }.
 */
function listarFichasSindicalizacao(filtros) {
  filtros = filtros || {};
  var semFiltros = !filtros.status && !filtros.escola &&
    !filtros.origem && !filtros.diretorBase && !filtros.texto;

  var cache = CacheService.getScriptCache();
  if (semFiltros) {
    var emCache = cache.get('SIND_ADM_LISTA');
    if (emCache) return JSON.parse(emCache);
  }
  var todas = sindAdm_lerTodas_();
  var fichas = todas.filter(function (r) {
    if (filtros.status && r.STATUS !== filtros.status) return false;
    if (filtros.escola && String(r.ESCOLA).toUpperCase()
        .indexOf(String(filtros.escola).toUpperCase()) < 0) return false;
    if (filtros.origem && r.ORIGEM !== filtros.origem) return false;
    if (filtros.diretorBase && r.DIRETOR_BASE !== filtros.diretorBase) return false;
    if (filtros.texto) {
      var t = String(filtros.texto).toUpperCase();
      var alvo = (r.NOME_COMPLETO + ' ' + r.CPF + ' ' + r.MATRICULA +
        ' ' + r.ESCOLA).toUpperCase();
      if (alvo.indexOf(t) < 0) return false;
    }
    return true;
  }).map(sindAdm_resumir_);

  var resposta = {
    sucesso: true,
    total: fichas.length,
    kpis: sindAdm_kpis_(todas),
    fichas: fichas
  };
  if (semFiltros) {
    try {
      cache.put('SIND_ADM_LISTA', JSON.stringify(resposta), SIND_ADM_CACHE_SEG);
    } catch (e) { /* payload grande: segue sem cache */ }
  }
  return resposta;
}

/**
 * Detalhe completo de uma ficha.
 */
function obterFichaSindicalizacao(idFicha) {
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
  r.CPF_FORMATADO = sindAdm_cpfNormalizado_(r.CPF);
  return { sucesso: true, ficha: r };
}

/**
 * Aprova ficha ASSINADA e ENCAMINHA: emite matrícula sequencial atômica,
 * grava o trabalhador na base de Associados (é isto que o torna visível
 * para Portal, Carteirinha, China Park e Vouchers), regenera o PDF com a
 * matrícula e envia o e-mail de boas-vindas.
 */
function aprovarFichaSindicalizacao(idFicha, aprovadoPor) {
  var usuario = String(aprovadoPor || '').trim() || 'SISGEP';
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = sindAdm_buscarPorId_(idFicha);
    if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    if (r.STATUS !== 'ASSINADA') {
      return {
        sucesso: false,
        mensagem: 'Só é possível aprovar fichas com status ASSINADA. ' +
          'Status atual: ' + r.STATUS + '.'
      };
    }

    r.MATRICULA = sindAdm_gerarMatricula_();
    r.STATUS = 'MATRICULADA';
    r.APROVADO_POR = usuario;
    r.DATA_APROVACAO = new Date();
    sindAdm_gravar_(r);

    // Grava na base de Associados — passo que integra com todo o SISGEP.
    var assoc = null;
    var avisos = [];
    try {
      assoc = sindAss_gravarDaFicha_(r);
      if (assoc.avisos && assoc.avisos.length) avisos = avisos.concat(assoc.avisos);
    } catch (eAssoc) {
      Logger.log('Gravação em Associados falhou (' + idFicha + '): ' + eAssoc.message);
      avisos.push('ATENÇÃO: a matrícula foi emitida, mas a gravação na base ' +
        'de Associados falhou (' + eAssoc.message + '). O trabalhador ainda ' +
        'não tem acesso ao Portal e aos benefícios — avise o suporte.');
    }

    try {
      r.LINK_PDF = gerarPDFFichaSindicalizacao(r.ID_FICHA);
      sindAdm_gravar_(r);
    } catch (ePdf) {
      Logger.log('PDF pós-aprovação falhou (' + idFicha + '): ' + ePdf.message);
    }
    sindAdm_limparCache_();

    sind_enviarEmailBoasVindas_(r);

    var msg = 'Ficha aprovada. Matrícula ' + r.MATRICULA + ' emitida';
    if (assoc) {
      msg += assoc.criado ?
        ' e associado cadastrado na base.' :
        ' e cadastro do associado atualizado (linha ' + assoc.linha + ').';
    } else {
      msg += '.';
    }
    if (avisos.length) msg += ' ⚠ ' + avisos.join(' ');

    return {
      sucesso: true,
      matricula: r.MATRICULA,
      associado: assoc,
      avisos: avisos,
      mensagem: msg
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rejeita ficha não finalizada, registrando motivo (obrigatório) e
 * notificando o trabalhador quando houver e-mail.
 */
function rejeitarFichaSindicalizacao(idFicha, motivo, aprovadoPor) {
  if (!motivo || !String(motivo).trim()) {
    return { sucesso: false, mensagem: 'Informe o motivo da rejeição.' };
  }
  var usuario = String(aprovadoPor || '').trim() || 'SISGEP';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = sindAdm_buscarPorId_(idFicha);
    if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    if (r.STATUS === 'MATRICULADA') {
      return { sucesso: false, mensagem: 'Ficha já matriculada não pode ser rejeitada por aqui.' };
    }
    r.STATUS = 'REJEITADA';
    r.MOTIVO_REJEICAO = String(motivo).trim();
    r.APROVADO_POR = usuario;
    r.DATA_APROVACAO = new Date();
    sindAdm_gravar_(r);
    sindAdm_limparCache_();

    sind_enviarEmailRejeicao_(r);

    return { sucesso: true, mensagem: 'Ficha rejeitada e trabalhador notificado.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Define manualmente o ponto de partida do contador de matrícula neste
 * projeto (ex.: última matrícula física já emitida). Executar UMA vez
 * pelo editor: definirMatriculaInicialSindicalizacao(4587)
 * → próxima matrícula emitida será 004588.
 */
function definirMatriculaInicialSindicalizacao(ultimaMatriculaUsada) {
  var n = parseInt(ultimaMatriculaUsada, 10);
  if (isNaN(n) || n < 0) {
    throw new Error('Informe um número válido (última matrícula já usada).');
  }
  PropertiesService.getScriptProperties()
    .setProperty(SIND_ADM_PROP_MATRICULA, String(n));
  return 'Contador definido. Próxima matrícula: ' + sindAdm_fmtMatricula_(n + 1);
}

// ============================================================================
// PDF — LAYOUT OFICIAL
// ============================================================================

/**
 * Gera o PDF da ficha no layout do formulário oficial, com a assinatura
 * eletrônica no rodapé. Salva na pasta do Drive e retorna a URL.
 */
function gerarPDFFichaSindicalizacao(idFicha) {
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) throw new Error('Ficha não encontrada: ' + idFicha);

  var assinatura = r.OTP_VALIDADO === 'SIM' ?
    ('Assinado eletronicamente por ' + r.NOME_COMPLETO +
     ' em ' + sindAdm_fmtDataHora_(r.DATA_HORA_ASSINATURA) +
     (r.IP_ASSINATURA ? ' · IP ' + r.IP_ASSINATURA : '') +
     ' · Código OTP validado · Hash ' + String(r.HASH_FICHA).substring(0, 16) + '…') :
    'Pendente de assinatura eletrônica';

  var logoUri = sindAdm_logoDataUri_();
  var marcaHtml = logoUri ?
    '<img src="' + logoUri + '" style="max-width:100%;max-height:40px;">' :
    '<span class="marca">Sind<span style="color:#C9A84C;">Educação</span>-ES</span>';

  var html =
    '<html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:22px;}' +
    '.moldura{border:3px solid #000;padding:10px;}' +
    '.topo{display:table;width:100%;border-bottom:3px solid #000;padding-bottom:6px;margin-bottom:6px;}' +
    '.topo > div{display:table-cell;vertical-align:middle;}' +
    '.titulo{font-size:17px;font-weight:bold;text-align:center;line-height:1.15;}' +
    '.marca{color:#002f6c;font-weight:bold;font-size:13px;}' +
    '.faixa{background:#000;color:#fff;font-weight:bold;padding:2px 6px;' +
    'display:inline-block;margin:8px 0 4px 0;font-size:10px;}' +
    '.secao{background:#333;color:#fff;font-weight:bold;text-align:center;' +
    'padding:3px;margin:8px 0 4px 0;font-size:12px;border:2px solid #000;}' +
    'table.campos{width:100%;border-collapse:collapse;margin-bottom:2px;}' +
    'table.campos td{border:1px solid #444;padding:3px 5px;vertical-align:top;}' +
    '.rotulo{font-size:8px;font-weight:bold;color:#333;display:block;}' +
    '.valor{font-size:11px;letter-spacing:.4px;display:block;min-height:13px;}' +
    '.caixa-tipo{font-size:9.5px;line-height:1.6;}' +
    '.caixa-matricula{border:1px solid #444;padding:3px 6px;text-align:center;}' +
    '.aut{border:3px solid #000;padding:9px;margin-top:10px;}' +
    '.aut-titulo{display:block;text-align:center;font-weight:bold;margin-bottom:6px;}' +
    '.aut-texto{text-align:justify;line-height:1.45;font-size:10.5px;}' +
    '.assinatura{margin-top:14px;border-top:1px solid #000;padding-top:4px;' +
    'text-align:center;font-size:9px;}' +
    '.controle{margin-top:10px;font-size:8px;color:#555;text-align:center;}' +
    '</style></head><body><div class="moldura">' +

    '<div class="topo">' +
    '<div style="width:26%;">' + marcaHtml + '<br>' +
    '<span style="font-size:6.5px;line-height:1.2;display:block;margin-top:2px;">' +
    'Sindicato dos educadores técnico-administrativos em estabelecimentos ' +
    'de ensino particular no Estado do Espírito Santo</span></div>' +
    '<div style="width:38%;" class="titulo">FORMULÁRIO<br>DE SINDICALIZAÇÃO</div>' +
    '<div style="width:19%;" class="caixa-tipo">' +
    sindAdm_marcador_(r.TIPO === 'CADASTRAMENTO') + ' CADASTRAMENTO<br>' +
    sindAdm_marcador_(r.TIPO === 'RECADASTRAMENTO') + ' RECADASTRAMENTO</div>' +
    '<div style="width:17%;"><div class="caixa-matricula">' +
    '<span class="rotulo">MATRÍCULA (SindEducação-ES)</span>' +
    '<span class="valor" style="font-size:13px;font-weight:bold;">' +
    sindAdm_esc_(r.MATRICULA || '—') + '</span></div></div>' +
    '</div>' +

    '<div class="secao">TRABALHADOR(A)</div>' +
    sindAdm_linhaCampos_([['NOME COMPLETO', r.NOME_COMPLETO, 100]]) +

    '<div class="faixa">IDENTIFICAÇÃO</div>' +
    sindAdm_linhaCampos_([
      ['SEXO', r.SEXO === 'F' ? '(X) F  ( ) M' : (r.SEXO === 'M' ? '( ) F  (X) M' : '( ) F  ( ) M'), 14],
      ['CPF (Obrigatório)', sindAdm_cpfNormalizado_(r.CPF), 26],
      ['RG (Obrigatório)', r.RG, 26],
      ['ÓRGÃO EXPEDIDOR', r.ORGAO_EXPEDIDOR, 20],
      ['UF', r.UF_RG, 14]
    ]) +
    sindAdm_linhaCampos_([
      ['TÍTULO DE ELEITOR(A)', r.TITULO_ELEITOR, 50],
      ['ZONA', r.ZONA, 25],
      ['SEÇÃO', r.SECAO, 25]
    ]) +

    '<div class="faixa">ENDEREÇO / CONTATOS</div>' +
    sindAdm_linhaCampos_([
      ['TELEFONE', sindAdm_fmtTel_(r.TELEFONE_1), 34],
      ['TELEFONE', sindAdm_fmtTel_(r.TELEFONE_2), 33],
      ['CELULAR', sindAdm_fmtTel_(r.CELULAR), 33]
    ]) +
    sindAdm_linhaCampos_([
      ['E-MAIL (' + (r.TIPO_EMAIL === 'INSTITUCIONAL' ? 'Institucional' : 'Pessoal') + ')', r.EMAIL, 60],
      ['CEP RESIDENCIAL', sindAdm_fmtCEP_(r.CEP_RESIDENCIAL), 40]
    ]) +
    sindAdm_linhaCampos_([
      ['ENDEREÇO RESIDENCIAL (' + (r.TIPO_LOGRADOURO || 'RUA') + ')', r.ENDERECO, 74],
      ['Nº', r.NUMERO, 26]
    ]) +
    sindAdm_linhaCampos_([
      ['COMPLEMENTO', r.COMPLEMENTO, 40],
      ['BAIRRO', r.BAIRRO, 60]
    ]) +
    sindAdm_linhaCampos_([
      ['UF', r.UF, 16],
      ['CIDADE', r.CIDADE, 84]
    ]) +

    '<div class="faixa">OUTRAS INFORMAÇÕES</div>' +
    sindAdm_linhaCampos_([
      ['DATA DE NASCIMENTO', sindAdm_fmtData_(r.DATA_NASCIMENTO), 34],
      ['GRAU DE INSTRUÇÃO / ESCOLARIDADE', r.ESCOLARIDADE, 66]
    ]) +

    '<div class="secao">DADOS DO EMPREGADOR</div>' +
    sindAdm_linhaCampos_([['ESTABELECIMENTO DE ENSINO ONDE TRABALHA', r.ESCOLA, 100]]) +
    sindAdm_linhaCampos_([
      ['DATA DE ADMISSÃO', sindAdm_fmtData_(r.DATA_ADMISSAO), 30],
      ['CARGO', r.CARGO, 70]
    ]) +
    sindAdm_linhaCampos_([
      ['CIDADE', r.CIDADE_ESCOLA, 70],
      ['CEP', sindAdm_fmtCEP_(r.CEP_ESCOLA), 30]
    ]) +

    '<div class="aut">' +
    '<span class="aut-titulo">AUTORIZAÇÃO PARA DESCONTO EM FOLHA DE PAGAMENTO</span>' +
    '<div class="aut-texto">' +
    'Neste ato, e nos termos do <b>Art. 545 da CLT</b> e da <b>Cláusula 56 da ' +
    'Convenção Coletiva de Trabalho 2026/2027</b>, autorizo expressamente o ' +
    'desconto mensal em folha de pagamento do percentual de <b>2% (dois por ' +
    'cento) sobre o meu salário-base</b>, em favor do Sindicato dos educadores ' +
    'técnico-administrativos em estabelecimentos de ensino particular no Estado ' +
    'do Espírito Santo — SindEducação-ES, conforme aprovado em Assembleia Geral ' +
    'Extraordinária da categoria, convocada por Edital publicado no Jornal A ' +
    'Tribuna, edição de 15 de novembro de 2025, autorizando o repasse pelo meu ' +
    'empregador ao SindEducação-ES até o 10º (décimo) dia subsequente ao mês ' +
    'vencido.' +
    '</div>' +
    '<div class="assinatura">' + sindAdm_esc_(assinatura) + '</div>' +
    '</div>' +

    '<div class="controle">Ficha ' + sindAdm_esc_(r.ID_FICHA) +
    ' · Origem: ' + sindAdm_esc_(r.ORIGEM || '—') +
    (r.ID_VISITA ? ' · Visita: ' + sindAdm_esc_(r.ID_VISITA) : '') +
    ' · Emitida pelo SISGEP em ' + sindAdm_fmtDataHora_(new Date()) + '</div>' +
    '</div></body></html>';

  var blob = Utilities.newBlob(html, 'text/html',
    'ficha_' + r.ID_FICHA + '.html').getAs('application/pdf');
  blob.setName('Ficha_Sindicalizacao_' +
    (r.MATRICULA || r.ID_FICHA) + '_' +
    String(r.NOME_COMPLETO).replace(/[^A-Za-z0-9]+/g, '_') + '.pdf');

  var pasta = sindAdm_pastaPDF_();
  var arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivo.getUrl();
}

/**
 * Carrega a logo do Drive como data URI base64 para embutir no PDF.
 * Base64 é mais confiável que URL externa na conversão HTML→PDF do GAS.
 * Cacheada por 6h; se a imagem passar do limite do CacheService, segue
 * sem cache. Retorna '' em caso de falha (o PDF cai no texto de fallback).
 */
function sindAdm_logoDataUri_() {
  var cache = CacheService.getScriptCache();
  var emCache = cache.get('SIND_ADM_LOGO_B64');
  if (emCache) return emCache;
  try {
    var blob = DriveApp.getFileById(SIND_ADM_LOGO_FILE_ID).getBlob();
    var uri = 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
    try {
      cache.put('SIND_ADM_LOGO_B64', uri, 21600);
    } catch (eCache) { /* imagem grande demais para o cache: segue direto */ }
    return uri;
  } catch (e) {
    Logger.log('Logo da ficha não carregada: ' + e.message);
    return '';
  }
}

// ============================================================================
// HELPERS INTERNOS (prefixados — sem colisão com o restante do SISGEP)
// ============================================================================

function sindAdm_aba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName(SIND_ADM_ABA);
  if (!aba) {
    throw new Error('Aba ' + SIND_ADM_ABA + ' não existe. Execute ' +
      'configurarAbaSindicalizacao() (Sindicalizacao.gs) primeiro.');
  }
  return aba;
}

function sindAdm_mapaColunas_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave) mapa[chave] = i;
  });
  SIND_ADM_COLUNAS.forEach(function (nome, i) {
    if (mapa[nome] === undefined) mapa[nome] = i;
  });
  return mapa;
}

function sindAdm_lerTodas_() {
  var aba = sindAdm_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  var mapa = sindAdm_mapaColunas_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  return dados.map(function (linha, idx) {
    var r = { _LINHA: idx + 2 };
    SIND_ADM_COLUNAS.forEach(function (c) {
      r[c] = linha[mapa[c]] !== undefined ? linha[mapa[c]] : '';
    });
    return r;
  });
}

function sindAdm_buscarPorId_(idFicha) {
  var alvo = String(idFicha).trim();
  var todas = sindAdm_lerTodas_();
  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].ID_FICHA).trim() === alvo) return todas[i];
  }
  return null;
}

function sindAdm_gravar_(registro) {
  var aba = sindAdm_aba_();
  var mapa = sindAdm_mapaColunas_(aba);
  var totalCols = Math.max(aba.getLastColumn(), SIND_ADM_COLUNAS.length);
  var linhaValores = new Array(totalCols).fill('');
  SIND_ADM_COLUNAS.forEach(function (c) {
    linhaValores[mapa[c]] = registro[c] !== undefined ? registro[c] : '';
  });
  var existente = sindAdm_buscarPorId_(registro.ID_FICHA);
  if (existente) {
    aba.getRange(existente._LINHA, 1, 1, totalCols).setValues([linhaValores]);
  } else {
    aba.appendRow(linhaValores);
  }
}

function sindAdm_gerarMatricula_() {
  var props = PropertiesService.getScriptProperties();
  var atual = props.getProperty(SIND_ADM_PROP_MATRICULA);
  if (atual === null) {
    var maior = 0;
    sindAdm_lerTodas_().forEach(function (r) {
      var n = parseInt(String(r.MATRICULA).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maior) maior = n;
    });
    atual = String(maior);
  }
  var proxima = parseInt(atual, 10) + 1;
  props.setProperty(SIND_ADM_PROP_MATRICULA, String(proxima));
  return sindAdm_fmtMatricula_(proxima);
}

function sindAdm_fmtMatricula_(n) {
  var s = String(n);
  while (s.length < 6) s = '0' + s;
  return s;
}

function sindAdm_resumir_(r) {
  return {
    ID_FICHA: r.ID_FICHA,
    TIPO: r.TIPO,
    MATRICULA: r.MATRICULA,
    NOME_COMPLETO: r.NOME_COMPLETO,
    CPF: sindAdm_cpfNormalizado_(r.CPF),
    CELULAR: sindAdm_fmtTel_(r.CELULAR),
    EMAIL: r.EMAIL,
    ESCOLA: r.ESCOLA,
    CARGO: r.CARGO,
    STATUS: r.STATUS,
    ORIGEM: r.ORIGEM,
    ID_VISITA: r.ID_VISITA,
    DIRETOR_BASE: r.DIRETOR_BASE,
    DATA_CRIACAO: sindAdm_fmtDataHora_(r.DATA_CRIACAO),
    DATA_HORA_ASSINATURA: sindAdm_fmtDataHora_(r.DATA_HORA_ASSINATURA),
    DATA_APROVACAO: sindAdm_fmtDataHora_(r.DATA_APROVACAO),
    LINK_PDF: r.LINK_PDF
  };
}

function sindAdm_kpis_(todas) {
  var kpi = {
    total: todas.length, preCadastro: 0, aguardandoAssinatura: 0,
    assinadas: 0, matriculadas: 0, rejeitadas: 0, matriculadasNoMes: 0
  };
  var agora = new Date();
  todas.forEach(function (r) {
    switch (r.STATUS) {
      case 'PRE_CADASTRO': kpi.preCadastro++; break;
      case 'AGUARDANDO_ASSINATURA': kpi.aguardandoAssinatura++; break;
      case 'ASSINADA': kpi.assinadas++; break;
      case 'MATRICULADA':
        kpi.matriculadas++;
        var d = r.DATA_APROVACAO instanceof Date ? r.DATA_APROVACAO : null;
        if (d && d.getMonth() === agora.getMonth() &&
            d.getFullYear() === agora.getFullYear()) {
          kpi.matriculadasNoMes++;
        }
        break;
      case 'REJEITADA': kpi.rejeitadas++; break;
    }
  });
  return kpi;
}

function sindAdm_pastaPDF_() {
  var it = DriveApp.getFoldersByName(SIND_ADM_PASTA_PDF);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(SIND_ADM_PASTA_PDF);
}

function sindAdm_limparCache_() {
  try {
    CacheService.getScriptCache().remove('SIND_ADM_LISTA');
  } catch (e) { /* silencioso */ }
}

function sindAdm_digitos_(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * CPF formatado, restaurando zeros à esquerda perdidos quando a célula
 * da planilha interpreta o valor como número
 * (ex.: "8538104780" → "085.381.047-80").
 */
function sindAdm_cpfNormalizado_(cpf) {
  var d = sindAdm_digitos_(cpf);
  if (!d) return '';
  while (d.length < 11) d = '0' + d;
  if (d.length !== 11) return d;
  return d.substring(0, 3) + '.' + d.substring(3, 6) + '.' +
    d.substring(6, 9) + '-' + d.substring(9);
}

function sindAdm_fmtCEP_(cep) {
  cep = sindAdm_digitos_(cep);
  if (cep.length !== 8) return cep;
  return cep.substring(0, 5) + '-' + cep.substring(5);
}

function sindAdm_fmtTel_(tel) {
  tel = sindAdm_digitos_(tel);
  if (tel.length === 11) {
    return '(' + tel.substring(0, 2) + ') ' + tel.substring(2, 7) +
      '-' + tel.substring(7);
  }
  if (tel.length === 10) {
    return '(' + tel.substring(0, 2) + ') ' + tel.substring(2, 6) +
      '-' + tel.substring(6);
  }
  return tel;
}

function sindAdm_fmtDataHora_(d) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm:ss');
}

/**
 * Formata datas para dd/MM/yyyy.
 * Aceita objeto Date (como o Sheets devolve), string ISO yyyy-MM-dd
 * (formato do <input type="date">) ou texto livre — neste último caso
 * devolve como veio, sem inventar conversão.
 */
function sindAdm_fmtData_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var s = String(v).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return s;
}

function sindAdm_esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sindAdm_marcador_(marcado) {
  return marcado ? '&#9746;' : '&#9744;';
}

/**
 * Monta uma linha de campos do formulário.
 * Campo vazio recebe espaço não-quebrável REAL (fora do escape), para
 * não imprimir "&nbsp;" como texto.
 */
function sindAdm_linhaCampos_(campos) {
  var tds = campos.map(function (c) {
    var valor = (c[1] === null || c[1] === undefined) ? '' : String(c[1]).trim();
    var conteudo = valor ? sindAdm_esc_(valor) : '\u00A0';
    return '<td style="width:' + c[2] + '%;">' +
      '<span class="rotulo">' + sindAdm_esc_(c[0]) + '</span>' +
      '<span class="valor">' + conteudo + '</span></td>';
  }).join('');
  return '<table class="campos"><tr>' + tds + '</tr></table>';
}

// ============================================================================
// UTILITÁRIOS DE MANUTENÇÃO (executar pelo editor, quando necessário)
// ============================================================================

/**
 * Prepara a aba Associados para receber filiações vindas do módulo de
 * Sindicalização. Rotula a coluna M (que já recebe data de atualização
 * pelo AprovacaoCadastro.gs, mas nunca teve cabeçalho) e cria as
 * colunas de matrícula, data de filiação e vínculo com a ficha.
 *
 * SEGURANÇA: escreve exclusivamente na linha 1 (cabeçalhos). Nenhum
 * dado de associado é lido, alterado ou movido. Idempotente.
 */
function prepararAbaAssociadosParaSindicalizacao() {
  var NOVOS = [
    [13, 'ULTIMA_ATUALIZACAO'],
    [14, 'MATRICULA'],
    [15, 'DATA_FILIACAO'],
    [16, 'ID_FICHA']
  ];

  var ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName('Associados');
  if (!aba) throw new Error('Aba Associados não encontrada.');

  var esperado = ['Nome fantasia', 'Nome', 'CPF', 'Filiado', 'Logradouro',
    'Número', 'Bairro', 'Cidade', 'CEP', 'Celular', 'CELULAR2', 'E-mail'];
  var atual = aba.getRange(1, 1, 1, 12).getValues()[0];
  for (var i = 0; i < esperado.length; i++) {
    if (String(atual[i]).trim() !== esperado[i]) {
      throw new Error('Cabeçalho inesperado na coluna ' + (i + 1) +
        ': encontrado "' + atual[i] + '", esperado "' + esperado[i] +
        '". Nada foi alterado — confira a aba antes de prosseguir.');
    }
  }

  var criadas = [];
  var jaExistiam = [];
  NOVOS.forEach(function (par) {
    var col = par[0];
    var nome = par[1];
    if (aba.getMaxColumns() < col) {
      aba.insertColumnsAfter(aba.getMaxColumns(), col - aba.getMaxColumns());
    }
    var atualCabecalho = String(aba.getRange(1, col).getValue()).trim();
    if (atualCabecalho === nome) {
      jaExistiam.push(nome);
      return;
    }
    if (atualCabecalho !== '') {
      throw new Error('A coluna ' + col + ' já contém o cabeçalho "' +
        atualCabecalho + '". Nada foi alterado para não sobrescrever.');
    }
    aba.getRange(1, col).setValue(nome);
    criadas.push(nome);
  });

  aba.getRange(1, 13, 1, 4)
     .setBackground('#002f6c')
     .setFontColor('#FFFFFF')
     .setFontWeight('bold')
     .setFontFamily('Plus Jakarta Sans');
  aba.getRange(2, 14, Math.max(aba.getMaxRows() - 1, 1), 1)
     .setNumberFormat('@');

  return 'Colunas criadas: ' + (criadas.join(', ') || 'nenhuma') +
    ' | já existiam: ' + (jaExistiam.join(', ') || 'nenhuma') +
    ' | total de colunas agora: ' + aba.getLastColumn();
}

/**
 * Diagnóstico: lista todas as abas da planilha de produção com o
 * número de linhas e os primeiros cabeçalhos de cada uma.
 * Somente leitura. Ver saída em Registro de execução.
 */
function listarAbasDaPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var abas = ss.getSheets();
  Logger.log('TOTAL DE ABAS: ' + abas.length);
  abas.forEach(function (aba) {
    var ultLinha = aba.getLastRow();
    var ultCol = aba.getLastColumn();
    var cab = '';
    if (ultLinha > 0 && ultCol > 0) {
      cab = aba.getRange(1, 1, 1, Math.min(ultCol, 8))
               .getValues()[0].join(' | ');
    }
    Logger.log('[' + aba.getName() + '] linhas=' + (ultLinha - 1) +
      ' colunas=' + ultCol + ' >> ' + cab);
  });
  return 'Ver Registro de execução.';
}

/**
 * Regera o PDF de uma ficha já existente, sem alterar status nem dados.
 * Útil para aplicar correções de layout em fichas antigas.
 * Ex.: regerarPDFFicha('FICHA-20260723114233-2658')
 */
function regerarPDFFicha(idFicha) {
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) throw new Error('Ficha não encontrada: ' + idFicha);
  r.LINK_PDF = gerarPDFFichaSindicalizacao(idFicha);
  sindAdm_gravar_(r);
  sindAdm_limparCache_();
  Logger.log('PDF regerado: ' + r.LINK_PDF);
  return r.LINK_PDF;
}
/** Atalho para regerar o PDF da ficha de teste pelo editor. */
function regerarPDFTeste() {
  return regerarPDFFicha('FICHA-20260723114233-2658');
}
/**
 * Diagnóstico da aba Escolas: descobre o que cada coluna realmente contém,
 * classificando o conteúdo por padrão (CNPJ, e-mail, telefone, CEP, data,
 * texto) em vez de confiar no cabeçalho — que está desalinhado.
 * Somente leitura. Ver saída em Registro de execução.
 */
function diagnosticarAbaEscolas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName('Escolas');
  if (!aba) throw new Error('Aba Escolas não encontrada.');

  var ultLinha = aba.getLastRow();
  var ultCol = aba.getLastColumn();
  var cab = aba.getRange(1, 1, 1, ultCol).getValues()[0];
  var amostraN = Math.min(ultLinha - 1, 200);
  var dados = aba.getRange(2, 1, amostraN, ultCol).getValues();

  function classificar(v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) return 'VAZIO';
    if (v instanceof Date) return 'DATA';
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(s)) return 'CNPJ';
    if (/^\d{14}$/.test(s)) return 'CNPJ';
    if (s.indexOf('@') > 0 && s.indexOf('.') > 0) return 'EMAIL';
    if (/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(s)) return 'TELEFONE';
    if (/^\d{5}-?\d{3}$/.test(s)) return 'CEP';
    if (/^[A-Z]{2}$/.test(s)) return 'UF';
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /GMT/.test(s)) return 'DATA';
    if (/^\d+$/.test(s)) return 'NUMERO';
    if (/^(ATIVA|BAIXADA|SUSPENSA|INAPTA|SEM ALTERAÇÃO|ATUALIZADA)/i.test(s)) return 'STATUS';
    return 'TEXTO';
  }

  Logger.log('ABA ESCOLAS · ' + (ultLinha - 1) + ' escolas · ' +
    ultCol + ' colunas · amostra de ' + amostraN + ' linhas');
  Logger.log('col | cabeçalho | preenchimento | conteúdo real | exemplo');
  Logger.log('----------------------------------------------------------');

  for (var c = 0; c < ultCol; c++) {
    var tipos = {};
    var preenchidos = 0;
    var exemplo = '';
    for (var i = 0; i < dados.length; i++) {
      var t = classificar(dados[i][c]);
      tipos[t] = (tipos[t] || 0) + 1;
      if (t !== 'VAZIO') {
        preenchidos++;
        if (!exemplo) exemplo = String(dados[i][c]).substring(0, 32);
      }
    }
    var dominante = '', maior = 0;
    Object.keys(tipos).forEach(function (t) {
      if (t !== 'VAZIO' && tipos[t] > maior) { maior = tipos[t]; dominante = t; }
    });
    var pct = Math.round(preenchidos * 100 / amostraN);
    Logger.log((c + 1) + ' | ' + String(cab[c] || '(sem cabeçalho)').substring(0, 24) +
      ' | ' + pct + '% | ' + (dominante || '—') +
      ' | ' + exemplo);
  }
  return 'Ver Registro de execução.';
}
/**
 * Conta quantas linhas da aba Escolas estão com dados deslocados,
 * testando o bloco operacional (colunas 1 a 14) contra o padrão esperado.
 * Somente leitura. Ver saída em Registro de execução.
 */
function contarEscolasDesalinhadas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
  var aba = ss.getSheetByName('Escolas');
  var ultLinha = aba.getLastRow();
  var dados = aba.getRange(2, 1, ultLinha - 1, 14).getValues();

  var ehEmail = function (s) { s = String(s || ''); return s.indexOf('@') > 0; };
  var ehCNPJ = function (s) {
    return String(s || '').replace(/\D/g, '').length === 14;
  };
  var ehTelefone = function (s) {
    var d = String(s || '').replace(/\D/g, '');
    return d.length >= 10 && d.length <= 11;
  };

  var problemas = { semCNPJ: [], emailInvalido: [], telefoneErrado: [], cidadeComCEP: [] };
  var ok = 0;

  dados.forEach(function (l, i) {
    var linha = i + 2;
    var bom = true;
    if (!ehCNPJ(l[2])) { problemas.semCNPJ.push(linha); bom = false; }
    if (l[3] && !ehEmail(l[3])) { problemas.emailInvalido.push(linha); bom = false; }
    if (l[5] && !ehTelefone(l[5]) && String(l[5]).trim() !== '') {
      problemas.telefoneErrado.push(linha); bom = false;
    }
    if (/^\d{5}-?\d{3}$/.test(String(l[7] || '').trim())) {
      problemas.cidadeComCEP.push(linha); bom = false;
    }
    if (bom) ok++;
  });

  Logger.log('Total de escolas: ' + dados.length);
  Logger.log('Linhas íntegras (colunas 1-14): ' + ok);
  Object.keys(problemas).forEach(function (k) {
    var lista = problemas[k];
    Logger.log(k + ': ' + lista.length +
      (lista.length ? '  → linhas ' + lista.slice(0, 25).join(', ') +
        (lista.length > 25 ? ' …' : '') : ''));
  });
  return 'Ver Registro de execução.';
}
/** Atalho para definir o contador de matrícula pelo editor. */
function definirMatriculaInicialAgora() {
  return definirMatriculaInicialSindicalizacao(4587);  // ← trocar pelo número real
}