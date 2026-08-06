/**
 * ============================================================
 * SISGEP — Módulo de Sindicalização Digital
 * Arquivo: Sindicalizacao.gs (lado PÚBLICO do fluxo)
 * ============================================================
 * Ficha digital fiel ao Formulário de Sindicalização oficial
 * (SindEducação-ES), com fluxo:
 *   PRE_CADASTRO → AGUARDANDO_ASSINATURA → ASSINADA → MATRICULADA
 *   (ou REJEITADA em qualquer etapa de análise)
 *
 * ATENÇÃO — DIVISÃO DE RESPONSABILIDADES NO MESMO PROJETO:
 * Este arquivo contém APENAS o lado público do fluxo (formulário,
 * OTP, assinatura, CEP). O lado administrativo (listar, aprovar/
 * matricular, rejeitar, PDF, contador de matrícula) vive no
 * arquivo SindicalizacaoAdmin.gs. NÃO recriar aqui funções com
 * os mesmos nomes — no GAS a última definição carregada
 * sobrescreve a outra silenciosamente.
 *
 * Padrões SISGEP: LockService em toda escrita, CacheService em
 * leituras pesadas, lookup de colunas por nome com fallback.
 * ============================================================
 */

var SINDICALIZACAO_ABA = 'SISGEP_Sindicalizacao';
var SINDICALIZACAO_OTP_VALIDADE_SEG = 600; // 10 minutos
var SINDICALIZACAO_OTP_MAX_TENTATIVAS = 5; // achado #4: sem isso, o código de 6 dígitos podia ser forçado por script dentro da janela de validade

var SINDICALIZACAO_COLUNAS = [
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

var SINDICALIZACAO_STATUS = {
  PRE_CADASTRO: 'PRE_CADASTRO',
  AGUARDANDO_ASSINATURA: 'AGUARDANDO_ASSINATURA',
  ASSINADA: 'ASSINADA',
  MATRICULADA: 'MATRICULADA',
  REJEITADA: 'REJEITADA'
};

/* ============================================================
 * SETUP
 * ============================================================ */

/**
 * Cria a aba SISGEP_Sindicalizacao com cabeçalhos, formatação
 * do padrão SISGEP e congela a primeira linha. Idempotente.
 * Executar uma única vez pelo editor do GAS.
 */
function configurarAbaSindicalizacao() {
  var ss = SpreadsheetApp.openById(obterIdPlanilhaSindicalizacao_());
  var aba = ss.getSheetByName(SINDICALIZACAO_ABA);
  if (!aba) {
    aba = ss.insertSheet(SINDICALIZACAO_ABA);
  }
  var faixa = aba.getRange(1, 1, 1, SINDICALIZACAO_COLUNAS.length);
  faixa.setValues([SINDICALIZACAO_COLUNAS]);
  faixa.setBackground('#002f6c')
       .setFontColor('#FFFFFF')
       .setFontWeight('bold')
       .setFontFamily('Plus Jakarta Sans');
  aba.setFrozenRows(1);
  // Colunas de CPF, telefones, CEPs e título como texto puro
  // para não perder zeros à esquerda:
  var colunasTexto = ['CPF', 'RG', 'TITULO_ELEITOR', 'ZONA', 'SECAO',
    'TELEFONE_1', 'TELEFONE_2', 'CELULAR',
    'CEP_RESIDENCIAL', 'CEP_ESCOLA', 'MATRICULA'];
  colunasTexto.forEach(function (nome) {
    var idx = SINDICALIZACAO_COLUNAS.indexOf(nome);
    if (idx >= 0) {
      aba.getRange(2, idx + 1, aba.getMaxRows() - 1, 1)
         .setNumberFormat('@');
    }
  });
  return 'Aba ' + SINDICALIZACAO_ABA + ' configurada com ' +
    SINDICALIZACAO_COLUNAS.length + ' colunas.';
}

/* ============================================================
 * CRIAÇÃO DE FICHAS
 * ============================================================ */

/**
 * Pré-cadastro rápido feito pelo diretor de base durante a
 * visita (mini-formulário do painel de visitas).
 * Campos mínimos: nome, CPF, celular, cargo, escola.
 * Dispara automaticamente o link de conclusão por e-mail
 * quando houver e-mail informado.
 */
// SEM trava de módulo, de propósito: o pré-cadastro é feito pelo diretor
// de base DURANTE a visita à escola (Visitas.gs:889), que é do módulo
// Escolas. Exigir Sindicalização aqui tiraria do diretor de base
// justamente a função que ele usa em campo. A sessão continua exigida.
function criarPreCadastroSindicalizacao(dados, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var cpf = limparDigitos_(dados.cpf);
  if (!validarCPFSindicalizacao_(cpf)) {
    return { sucesso: false, mensagem: 'CPF inválido.' };
  }
  if (!dados.nome || !String(dados.nome).trim()) {
    return { sucesso: false, mensagem: 'Nome é obrigatório.' };
  }
  var duplicada = buscarFichaAtivaPorCPF_(cpf);
  if (duplicada) {
    return {
      sucesso: false,
      mensagem: 'Já existe ficha ativa para este CPF (status: ' +
        duplicada.STATUS + ', ID ' + duplicada.ID_FICHA + ').'
    };
  }
  var registro = novoRegistroVazio_();
  registro.ID_FICHA = gerarIdFicha_();
  registro.TIPO = dados.tipo === 'RECADASTRAMENTO' ?
    'RECADASTRAMENTO' : 'CADASTRAMENTO';
  registro.NOME_COMPLETO = String(dados.nome).trim().toUpperCase();
  registro.CPF = cpf;
  registro.CELULAR = limparDigitos_(dados.celular || '');
  registro.EMAIL = String(dados.email || '').trim().toLowerCase();
  registro.CARGO = String(dados.cargo || '').trim();
  registro.ESCOLA = String(dados.escola || '').trim();
  registro.STATUS = SINDICALIZACAO_STATUS.PRE_CADASTRO;
  registro.ORIGEM = dados.origem || 'CADASTRO_RAPIDO_VISITA';
  registro.ID_VISITA = dados.idVisita || '';
  registro.DIRETOR_BASE = dados.diretorBase || '';
  registro.DATA_CRIACAO = new Date();

  gravarRegistroSindicalizacao_(registro);
  limparCacheListaSindicalizacao_();

  if (registro.EMAIL) {
    enviarLinkConclusaoFicha_(registro);
  }
  return {
    sucesso: true,
    idFicha: registro.ID_FICHA,
    mensagem: 'Pré-cadastro criado. ' +
      (registro.EMAIL ? 'Link de conclusão enviado por e-mail.' :
        'Sem e-mail informado — conclua pelo QR Code da visita.')
  };
}

/**
 * Submissão da ficha completa pelo Portal do Associado
 * (QR Code da visita ou acesso espontâneo).
 * Grava/atualiza todos os campos da ficha oficial e envia OTP
 * para assinatura. Se já houver PRE_CADASTRO para o CPF,
 * completa o registro existente em vez de duplicar.
 */
function submeterFichaSindicalizacao(dados) {
  var cpf = limparDigitos_(dados.cpf);
  if (!validarCPFSindicalizacao_(cpf)) {
    return { sucesso: false, mensagem: 'CPF inválido. Confira os dígitos.' };
  }
  var obrigatorios = [
    ['nome', 'Nome completo'], ['rg', 'RG'], ['celular', 'Celular'],
    ['cepResidencial', 'CEP residencial'], ['endereco', 'Endereço'],
    ['cidade', 'Cidade'], ['uf', 'UF'],
    ['dataNascimento', 'Data de nascimento'],
    ['escola', 'Estabelecimento de ensino'], ['cargo', 'Cargo']
  ];
  for (var i = 0; i < obrigatorios.length; i++) {
    var v = dados[obrigatorios[i][0]];
    if (!v || !String(v).trim()) {
      return { sucesso: false, mensagem: 'Campo obrigatório: ' + obrigatorios[i][1] + '.' };
    }
  }

  var existente = buscarFichaAtivaPorCPF_(cpf);
  if (existente && existente.STATUS !== SINDICALIZACAO_STATUS.PRE_CADASTRO &&
      existente.STATUS !== SINDICALIZACAO_STATUS.AGUARDANDO_ASSINATURA) {
    return {
      sucesso: false,
      mensagem: 'Já existe ficha em andamento ou aprovada para este CPF. ' +
        'Em caso de dúvida, procure o SindEducação-ES.'
    };
  }

  var registro = existente || novoRegistroVazio_();
  if (!existente) {
    registro.ID_FICHA = gerarIdFicha_();
    registro.DATA_CRIACAO = new Date();
    registro.ORIGEM = dados.origem || 'PORTAL';
  }
  registro.TIPO = dados.tipo === 'RECADASTRAMENTO' ?
    'RECADASTRAMENTO' : 'CADASTRAMENTO';
  registro.NOME_COMPLETO = String(dados.nome).trim().toUpperCase();
  registro.SEXO = dados.sexo === 'M' ? 'M' : (dados.sexo === 'F' ? 'F' : '');
  registro.CPF = cpf;
  registro.RG = limparDigitos_(dados.rg);
  registro.ORGAO_EXPEDIDOR = String(dados.orgaoExpedidor || '').trim().toUpperCase();
  registro.UF_RG = String(dados.ufRg || '').trim().toUpperCase();
  registro.TITULO_ELEITOR = limparDigitos_(dados.tituloEleitor || '');
  registro.ZONA = limparDigitos_(dados.zona || '');
  registro.SECAO = limparDigitos_(dados.secao || '');
  registro.TELEFONE_1 = limparDigitos_(dados.telefone1 || '');
  registro.TELEFONE_2 = limparDigitos_(dados.telefone2 || '');
  registro.CELULAR = limparDigitos_(dados.celular);
  registro.EMAIL = String(dados.email || '').trim().toLowerCase();
  registro.TIPO_EMAIL = dados.tipoEmail === 'INSTITUCIONAL' ?
    'INSTITUCIONAL' : 'PESSOAL';
  registro.CEP_RESIDENCIAL = limparDigitos_(dados.cepResidencial);
  registro.TIPO_LOGRADOURO = ['AVENIDA', 'PRACA', 'RUA']
    .indexOf(String(dados.tipoLogradouro || '').toUpperCase()) >= 0 ?
    String(dados.tipoLogradouro).toUpperCase() : 'RUA';
  registro.ENDERECO = String(dados.endereco).trim();
  registro.NUMERO = String(dados.numero || '').trim();
  registro.COMPLEMENTO = String(dados.complemento || '').trim();
  registro.BAIRRO = String(dados.bairro || '').trim();
  registro.UF = String(dados.uf).trim().toUpperCase();
  registro.CIDADE = String(dados.cidade).trim();
  registro.DATA_NASCIMENTO = String(dados.dataNascimento).trim();
  registro.ESCOLARIDADE = String(dados.escolaridade || '').trim();
  registro.ESCOLA = String(dados.escola).trim();
  registro.DATA_ADMISSAO = String(dados.dataAdmissao || '').trim();
  registro.CARGO = String(dados.cargo).trim();
  registro.CIDADE_ESCOLA = String(dados.cidadeEscola || '').trim();
  registro.CEP_ESCOLA = limparDigitos_(dados.cepEscola || '');
  registro.STATUS = SINDICALIZACAO_STATUS.AGUARDANDO_ASSINATURA;
  if (dados.idVisita) registro.ID_VISITA = dados.idVisita;
  if (dados.diretorBase) registro.DIRETOR_BASE = dados.diretorBase;

  gravarRegistroSindicalizacao_(registro);
  limparCacheListaSindicalizacao_();

  var envio = enviarOTPSindicalizacao(registro.ID_FICHA);
  return {
    sucesso: true,
    idFicha: registro.ID_FICHA,
    otpEnviado: envio.sucesso,
    canalOTP: envio.canal || '',
    mensagem: envio.sucesso ?
      'Ficha registrada. Código de assinatura enviado.' :
      'Ficha registrada, mas houve falha no envio do código: ' + envio.mensagem
  };
}

/* ============================================================
 * ASSINATURA (OTP)
 * ============================================================ */

// enviarOTPSindicalizacao(idFicha) — implementação real fica em
// SindicalizacaoEmails.gs (versão com template HTML da marca). Havia uma
// segunda definição aqui, mais antiga (texto puro) — GAS roda tudo em um
// único escopo global, então as duas brigavam por qual "vencia", sem
// nenhuma forma confiável de saber qual estava ativa. Removida por ser a
// desatualizada; o próprio cabeçalho de SindicalizacaoEmails.gs já
// instruía essa remoção e nunca tinha sido feita.

/**
 * Valida o OTP e efetiva a assinatura eletrônica: grava data/
 * hora, IP, marca OTP_VALIDADO, calcula o hash de integridade
 * e gera o PDF no layout oficial (via gerarPDFFichaSindicalizacao
 * do SindicalizacaoAdmin.gs). Notifica a secretaria.
 */
function validarOTPEAssinarFicha(idFicha, otpInformado, ipCliente) {
  var trava = travarSisgep_(20000);
  try {
    var registro = buscarFichaPorId_(idFicha);
    if (!registro) {
      return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    }
    if (registro.STATUS !== SINDICALIZACAO_STATUS.AGUARDANDO_ASSINATURA) {
      return { sucesso: false, mensagem: 'Ficha não está aguardando assinatura.' };
    }
    var cache = CacheService.getScriptCache();
    var chaveTentativas = 'SIND_OTP_TENTATIVAS_' + idFicha;
    var otpArmazenado = cache.get('SIND_OTP_' + idFicha);
    if (!otpArmazenado) {
      return {
        sucesso: false, expirado: true,
        mensagem: 'Código expirado. Solicite um novo código.'
      };
    }
    if (String(otpInformado).trim() !== otpArmazenado) {
      var tentativas = (parseInt(cache.get(chaveTentativas), 10) || 0) + 1;
      if (tentativas >= SINDICALIZACAO_OTP_MAX_TENTATIVAS) {
        cache.remove('SIND_OTP_' + idFicha);
        cache.remove(chaveTentativas);
        return {
          sucesso: false, expirado: true,
          mensagem: 'Muitas tentativas incorretas. Por segurança, solicite um novo código.'
        };
      }
      cache.put(chaveTentativas, String(tentativas), SINDICALIZACAO_OTP_VALIDADE_SEG);
      return { sucesso: false, mensagem: 'Código incorreto. Confira e tente novamente.' };
    }
    cache.remove('SIND_OTP_' + idFicha);
    cache.remove(chaveTentativas);

    registro.STATUS = SINDICALIZACAO_STATUS.ASSINADA;
    registro.DATA_HORA_ASSINATURA = new Date();
    registro.IP_ASSINATURA = String(ipCliente || '').trim();
    registro.OTP_VALIDADO = 'SIM';
    registro.HASH_FICHA = calcularHashFicha_(registro);

    gravarRegistroSindicalizacao_(registro);

    try {
      // Implementada no SindicalizacaoAdmin.gs (mesmo projeto):
      registro.LINK_PDF = gerarPDFFichaSindicalizacao(registro.ID_FICHA);
      gravarRegistroSindicalizacao_(registro);
    } catch (ePdf) {
      Logger.log('PDF pós-assinatura falhou (' + idFicha + '): ' + ePdf.message);
    }
    limparCacheListaSindicalizacao_();
    notificarSecretariaNovaFicha_(registro);

    return {
      sucesso: true,
      mensagem: 'Ficha assinada com sucesso! Ela será analisada pela ' +
        'secretaria do SindEducação-ES e você receberá a confirmação ' +
        'da matrícula por e-mail.',
      linkPdf: registro.LINK_PDF || ''
    };
  } finally {
    trava.liberar();
  }
}

/* ============================================================
 * BRASILAPI — CEP
 * ============================================================ */

/**
 * Busca endereço por CEP na BrasilAPI (server-side, evita CORS
 * no formulário). Retorna { sucesso, logradouro, bairro,
 * cidade, uf }.
 */
function buscarEnderecoPorCEP(cep) {
  var limpo = limparDigitos_(cep);
  if (limpo.length !== 8) {
    return { sucesso: false, mensagem: 'CEP deve ter 8 dígitos.' };
  }
  try {
    var resp = UrlFetchApp.fetch(
      'https://brasilapi.com.br/api/cep/v1/' + limpo,
      { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      return { sucesso: false, mensagem: 'CEP não encontrado.' };
    }
    var d = JSON.parse(resp.getContentText());
    return {
      sucesso: true,
      logradouro: d.street || '',
      bairro: d.neighborhood || '',
      cidade: d.city || '',
      uf: d.state || ''
    };
  } catch (e) {
    return { sucesso: false, mensagem: 'Falha na consulta: ' + e.message };
  }
}

/* ============================================================
 * INTERNOS — PERSISTÊNCIA E APOIO
 * ============================================================ */

function gerarIdFicha_() {
  return 'FICHA-' + Utilities.formatDate(new Date(),
    Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' +
    Math.floor(1000 + Math.random() * 9000);
}

function calcularHashFicha_(r) {
  var base = [r.ID_FICHA, r.CPF, r.NOME_COMPLETO, r.ESCOLA, r.CARGO,
    r.DATA_HORA_ASSINATURA, r.IP_ASSINATURA].join('|');
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, base, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

// Mantida porque outras funções deste arquivo chamam pelo ID. Passou a
// perguntar ao acessador único (PlanilhaSisgep.gs) em vez de trazer o ID de
// produção escrito aqui — era isso que fazia a escrita e a leitura poderem
// cair em planilhas diferentes quando o ambiente mudava.
function obterIdPlanilhaSindicalizacao_() {
  return planilhaSisgep_().getId();
}

function obterAbaSindicalizacao_() {
  var ss = SpreadsheetApp.openById(obterIdPlanilhaSindicalizacao_());
  var aba = ss.getSheetByName(SINDICALIZACAO_ABA);
  if (!aba) {
    throw new Error('Aba ' + SINDICALIZACAO_ABA +
      ' não existe. Execute configurarAbaSindicalizacao().');
  }
  return aba;
}

/**
 * Mapa de colunas por nome com fallback à ordem padrão,
 * tolerante a inserções manuais de colunas na planilha.
 */
function mapaColunasSindicalizacao_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave) mapa[chave] = i;
  });
  SINDICALIZACAO_COLUNAS.forEach(function (nome, i) {
    if (mapa[nome] === undefined) mapa[nome] = i;
  });
  return mapa;
}

function novoRegistroVazio_() {
  var r = {};
  SINDICALIZACAO_COLUNAS.forEach(function (c) { r[c] = ''; });
  return r;
}

function lerTodasFichas_() {
  var aba = obterAbaSindicalizacao_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  var mapa = mapaColunasSindicalizacao_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  return dados.map(function (linha, idx) {
    var r = { _LINHA: idx + 2 };
    SINDICALIZACAO_COLUNAS.forEach(function (c) {
      r[c] = linha[mapa[c]] !== undefined ? linha[mapa[c]] : '';
    });
    return r;
  });
}

function buscarFichaPorId_(idFicha) {
  var alvo = String(idFicha).trim();
  var todas = lerTodasFichas_();
  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].ID_FICHA).trim() === alvo) return todas[i];
  }
  return null;
}

function buscarFichaAtivaPorCPF_(cpf) {
  var todas = lerTodasFichas_();
  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].CPF) === cpf &&
        todas[i].STATUS !== SINDICALIZACAO_STATUS.REJEITADA) {
      return todas[i];
    }
  }
  return null;
}

/**
 * Grava (insere ou atualiza) o registro completo sob
 * LockService. Atualização localiza a linha pelo ID_FICHA.
 */
function gravarRegistroSindicalizacao_(registro) {
  // ⚠️ LOCK ANINHADO — não volte a usar LockService direto aqui.
  //
  // validarOTPEAssinarFicha (linha ~266) já segura a trava do script quando
  // chama esta função. Pedir de novo com LockService faz a execução esperar
  // os 20 segundos e morrer — o associado que acabou de digitar o código de
  // assinatura vê erro depois de uma tela travada.
  //
  // travarSisgep_ (TravaSisgep.gs) conta os níveis desta execução: quem
  // chegou aninhado não pede a trava de novo nem solta a de quem chamou.
  //
  // Mesma família do bug de gerarFolhaRH corrigido em 2026-08-05.
  var trava = travarSisgep_(20000);
  try {
    var aba = obterAbaSindicalizacao_();
    var mapa = mapaColunasSindicalizacao_(aba);
    var totalCols = Math.max(aba.getLastColumn(), SINDICALIZACAO_COLUNAS.length);
    var linhaValores = new Array(totalCols).fill('');
    SINDICALIZACAO_COLUNAS.forEach(function (c) {
      linhaValores[mapa[c]] = registro[c] !== undefined ? registro[c] : '';
    });

    var existente = buscarFichaPorId_(registro.ID_FICHA);
    if (existente) {
      aba.getRange(existente._LINHA, 1, 1, totalCols).setValues([linhaValores]);
    } else {
      aba.appendRow(linhaValores);
    }
  } finally {
    // Só solta o que esta função pegou. Soltar a trava de quem chamou faria
    // o resto daquela função rodar sem proteção nenhuma — pior que o problema.
    trava.liberar();
  }
}

function enviarLinkConclusaoFicha_(registro) {
  try {
    var urlPortal = PropertiesService.getScriptProperties()
      .getProperty('URL_PORTAL_ASSOCIADO') || '';
    var link = urlPortal ?
      (urlPortal + '?pagina=ficha&idFicha=' +
        encodeURIComponent(registro.ID_FICHA)) :
      '(link do Portal não configurado — defina URL_PORTAL_ASSOCIADO nas propriedades do script)';
    GmailApp.sendEmail(registro.EMAIL,
      'Conclua sua sindicalização — SindEducação-ES',
      'Olá, ' + registro.NOME_COMPLETO + '!\n\n' +
      'Seu pré-cadastro foi iniciado durante a visita do SindEducação-ES ' +
      'à sua escola. Para concluir a sindicalização, preencha a ficha ' +
      'completa e assine eletronicamente pelo link:\n\n' + link + '\n\n' +
      'Leva menos de 5 minutos.\n\nSindEducação-ES');
  } catch (e) {
    Logger.log('Link de conclusão falhou (' + registro.ID_FICHA + '): ' + e.message);
  }
}

function notificarSecretariaNovaFicha_(registro) {
  try {
    var destino = PropertiesService.getScriptProperties()
      .getProperty('EMAIL_SECRETARIA_SINDICALIZACAO');
    if (!destino) return;
    GmailApp.sendEmail(destino,
      'Nova ficha assinada aguardando aprovação — ' + registro.NOME_COMPLETO,
      'Uma nova Ficha de Sindicalização foi assinada eletronicamente ' +
      'e aguarda análise:\n\n' +
      'Nome: ' + registro.NOME_COMPLETO + '\n' +
      'CPF: ' + formatarCPF_(registro.CPF) + '\n' +
      'Escola: ' + registro.ESCOLA + '\n' +
      'Cargo: ' + registro.CARGO + '\n' +
      'Origem: ' + (registro.ORIGEM || '—') +
      (registro.ID_VISITA ? ' (visita ' + registro.ID_VISITA + ')' : '') + '\n' +
      'Assinada em: ' + formatarDataHora_(registro.DATA_HORA_ASSINATURA) + '\n\n' +
      (registro.LINK_PDF ? 'PDF: ' + registro.LINK_PDF + '\n\n' : '') +
      'Acesse o SISGEP para aprovar e emitir a matrícula.');
  } catch (e) {
    Logger.log('Notificação secretaria falhou: ' + e.message);
  }
}

/**
 * Limpa os caches de listagem dos DOIS lados do módulo:
 * a chave antiga deste arquivo e a chave SIND_ADM_LISTA usada
 * pelo painel administrativo (SindicalizacaoAdmin.gs), para a
 * lista da secretaria refletir assinaturas imediatamente.
 */
function limparCacheListaSindicalizacao_() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('SIND_LISTA_COMPLETA');
    cache.remove('SIND_ADM_LISTA');
  } catch (e) { /* silencioso */ }
}

/* ============================================================
 * UTILITÁRIOS DE FORMATAÇÃO E VALIDAÇÃO
 * ============================================================ */

function limparDigitos_(v) {
  return String(v || '').replace(/\D/g, '');
}

function validarCPFSindicalizacao_(cpf) {
  cpf = limparDigitos_(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  var soma = 0, resto, i;
  for (i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10), 10)) return false;
  soma = 0;
  for (i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i), 10) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.substring(10, 11), 10);
}

function formatarCPF_(cpf) {
  cpf = limparDigitos_(cpf);
  if (cpf.length !== 11) return cpf;
  return cpf.substring(0, 3) + '.' + cpf.substring(3, 6) + '.' +
    cpf.substring(6, 9) + '-' + cpf.substring(9);
}

function formatarDataHora_(d) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm:ss');
}