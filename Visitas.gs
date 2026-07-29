// ============================================================================
// ARQUIVO: Visitas.gs
// Modulo SISGEP - Visitas as Escolas (CRM de relacionamento)
//
// Fase 1: base de escolas, equipes, agenda, check-in com GPS, checklist,
// check-out, QR Code de sindicalizacao e historico por escola.
//
// ARQUITETURA:
//   Aba Escolas (existente, 681 escolas) = cadastro mestre. O modulo usa as
//     colunas 1-14 (integras) e as colunas 24-29, que ja existiam vazias.
//     Acrescenta colunas de acompanhamento ao final.
//   Aba SISGEP_Visitas = registro de cada visita (evento).
//
// INTEGRACAO: cada visita gera um QR Code que leva a Ficha de Sindicalizacao
// ja carimbada com ID_VISITA e DIRETOR_BASE - e isso que permite medir
// conversao por escola e por diretor de base.
//
// ACESSO: decidido que o diretor de base entra pelo SISGEP com login, ja que
// a tela de campo (VisitasCampo) e um modulo do index. Toda funcao publica
// exige token de sessao via visitas_exigirSessao_.
//
// CAMADAS: funcoes publicas (chamadas pelo front) validam sessao e delegam
// para funcoes internas com sufixo _. As funcoes de teste e diagnostico
// rodadas pelo editor chamam as internas, onde nao ha sessao para validar.
// ============================================================================

var VIS_ABA_VISITAS = 'SISGEP_Visitas';
var VIS_ABA_ESCOLAS = 'Escolas';
var VIS_PROP_URL_FICHA = 'URL_WEBAPP_SISGEP';
var VIS_CACHE_SEG = 120;

var VIS_COLUNAS = [
  'ID_VISITA', 'DATA_AGENDADA', 'HORA_AGENDADA', 'STATUS',
  'ESCOLA', 'CNPJ', 'UNIDADE', 'CIDADE', 'EQUIPE',
  'DIRETOR_BASE', 'CHECKIN_DATA_HORA', 'CHECKIN_LAT', 'CHECKIN_LNG',
  'CHECKOUT_DATA_HORA', 'DURACAO_MIN',
  'FALOU_DIRETOR', 'FALOU_RH', 'ENTREGOU_MATERIAL', 'EXPLICOU_BENEFICIOS',
  'ATUALIZOU_CADASTRO', 'COLETOU_FICHA', 'RECEBEU_DUVIDAS', 'SOLICITOU_RETORNO',
  'RESPONSAVEL_ATENDEU', 'CARGO_RESPONSAVEL', 'TELEFONE_CONTATO',
  'MATERIAIS_ENTREGUES', 'OBSERVACOES', 'PROXIMA_VISITA',
  'FICHAS_GERADAS', 'CRIADA_EM', 'CRIADA_POR', 'ATUALIZADA_EM'
];

// Acompanhamento acrescentado a aba Escolas (apos a coluna 29).
var VIS_COLUNAS_ESCOLA = [
  'EQUIPE', 'STATUS_VISITA', 'ULTIMA_VISITA', 'PROXIMA_VISITA',
  'TOTAL_VISITAS', 'TOTAL_SINDICALIZACOES', 'DIRETOR_RESPONSAVEL'
];

var VIS_STATUS = {
  PENDENTE: 'PENDENTE',
  AGENDADA: 'AGENDADA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  VISITADA: 'VISITADA',
  RETORNAR: 'RETORNAR',
  SEM_CONTATO: 'SEM_CONTATO',
  MUDOU_ENDERECO: 'MUDOU_ENDERECO',
  CANCELADA: 'CANCELADA'
};

// Status que encerram uma visita, em qualquer resultado.
var VIS_STATUS_FINAIS = [
  VIS_STATUS.VISITADA, VIS_STATUS.RETORNAR,
  VIS_STATUS.SEM_CONTATO, VIS_STATUS.MUDOU_ENDERECO
];

// Municipios da Grande Vitoria -> Equipe A. Demais -> Equipe B (Interior).
var VIS_GRANDE_VITORIA = [
  'VITORIA', 'VILA VELHA', 'SERRA', 'CARIACICA', 'VIANA',
  'GUARAPARI', 'FUNDAO'
];

// Os 78 municipios do Espirito Santo, para conferir a coluna CIDADE.
var VIS_MUNICIPIOS_ES = [
  'AFONSO CLAUDIO','AGUA DOCE DO NORTE','AGUIA BRANCA','ALEGRE',
  'ALFREDO CHAVES','ALTO RIO NOVO','ANCHIETA','APIACA','ARACRUZ',
  'ATILIO VIVACQUA','BAIXO GUANDU','BARRA DE SAO FRANCISCO','BOA ESPERANCA',
  'BOM JESUS DO NORTE','BREJETUBA','CACHOEIRO DE ITAPEMIRIM','CARIACICA',
  'CASTELO','COLATINA','CONCEICAO DA BARRA','CONCEICAO DO CASTELO',
  'DIVINO DE SAO LOURENCO','DOMINGOS MARTINS','DORES DO RIO PRETO',
  'ECOPORANGA','FUNDAO','GOVERNADOR LINDENBERG','GUACUI','GUARAPARI',
  'IBATIBA','IBIRACU','IBITIRAMA','ICONHA','IRUPI','ITAGUACU','ITAPEMIRIM',
  'ITARANA','IUNA','JAGUARE','JERONIMO MONTEIRO','JOAO NEIVA',
  'LARANJA DA TERRA','LINHARES','MANTENOPOLIS','MARATAIZES',
  'MARECHAL FLORIANO','MARILANDIA','MIMOSO DO SUL','MONTANHA','MUCURICI',
  'MUNIZ FREIRE','MUQUI','NOVA VENECIA','PANCAS','PEDRO CANARIO',
  'PINHEIROS','PIUMA','PONTO BELO','PRESIDENTE KENNEDY','RIO BANANAL',
  'RIO NOVO DO SUL','SANTA LEOPOLDINA','SANTA MARIA DE JETIBA',
  'SANTA TERESA','SAO DOMINGOS DO NORTE','SAO GABRIEL DA PALHA',
  'SAO JOSE DO CALCADO','SAO MATEUS','SAO ROQUE DO CANAA','SERRA',
  'SOORETAMA','VARGEM ALTA','VENDA NOVA DO IMIGRANTE','VIANA','VILA PAVAO',
  'VILA VALERIO','VILA VELHA','VITORIA'
];

var VIS_CHECKLIST = [
  ['FALOU_DIRETOR', 'Falou com o diretor'],
  ['FALOU_RH', 'Falou com o RH'],
  ['ENTREGOU_MATERIAL', 'Entregou material'],
  ['EXPLICOU_BENEFICIOS', 'Explicou os beneficios'],
  ['ATUALIZOU_CADASTRO', 'Atualizou cadastro'],
  ['COLETOU_FICHA', 'Coletou ficha'],
  ['RECEBEU_DUVIDAS', 'Recebeu duvidas'],
  ['SOLICITOU_RETORNO', 'Solicitou retorno']
];

/* ==========================================================================
 * SETUP - executar uma vez pelo editor
 * ========================================================================== */

/**
 * Cria a aba SISGEP_Visitas e acrescenta as colunas de acompanhamento a
 * aba Escolas. Idempotente: rodar de novo nao duplica nem sobrescreve.
 * Nao altera nenhum dado existente das 681 escolas.
 */
function configurarModuloVisitas() {
  var ss = visitas_planilha_();
  var resultado = [];

  var aba = ss.getSheetByName(VIS_ABA_VISITAS);
  if (!aba) {
    aba = ss.insertSheet(VIS_ABA_VISITAS);
    resultado.push('aba ' + VIS_ABA_VISITAS + ' criada');
  } else {
    resultado.push('aba ' + VIS_ABA_VISITAS + ' ja existia');
  }
  aba.getRange(1, 1, 1, VIS_COLUNAS.length)
     .setValues([VIS_COLUNAS])
     .setBackground('#002f6c').setFontColor('#FFFFFF')
     .setFontWeight('bold').setFontFamily('Plus Jakarta Sans');
  aba.setFrozenRows(1);
  ['CNPJ', 'TELEFONE_CONTATO'].forEach(function (nome) {
    var i = VIS_COLUNAS.indexOf(nome);
    if (i >= 0) aba.getRange(2, i + 1, aba.getMaxRows() - 1, 1).setNumberFormat('@');
  });

  var abaE = ss.getSheetByName(VIS_ABA_ESCOLAS);
  if (!abaE) throw new Error('Aba ' + VIS_ABA_ESCOLAS + ' nao encontrada.');
  var cabE = abaE.getRange(1, 1, 1, abaE.getLastColumn()).getValues()[0]
    .map(function (v) { return String(v).trim().toUpperCase(); });

  var criadas = [];
  VIS_COLUNAS_ESCOLA.forEach(function (nome) {
    if (cabE.indexOf(nome) >= 0) return;
    var novaCol = abaE.getLastColumn() + 1;
    if (abaE.getMaxColumns() < novaCol) {
      abaE.insertColumnsAfter(abaE.getMaxColumns(), 1);
    }
    abaE.getRange(1, novaCol).setValue(nome)
        .setBackground('#002f6c').setFontColor('#FFFFFF')
        .setFontWeight('bold').setFontFamily('Plus Jakarta Sans');
    cabE.push(nome);
    criadas.push(nome);
  });
  resultado.push('colunas novas em Escolas: ' + (criadas.join(', ') || 'nenhuma'));

  return resultado.join(' | ');
}

/**
 * Classifica todas as escolas em Equipe A (Grande Vitoria) ou Equipe B
 * (Interior) a partir da cidade, e marca como PENDENTE quem ainda nao
 * tem status de visita. Nao sobrescreve classificacoes ja feitas a mao.
 * Executar uma vez apos configurarModuloVisitas().
 */
function classificarEquipesEscolas() {
  var abaE = visitas_abaEscolas_();
  var ultima = abaE.getLastRow();
  if (ultima < 2) return 'Aba Escolas vazia.';

  var mapa = visitas_mapaCabecalho_(abaE);
  var colCidade = visitas_idxCol_(mapa, 'CIDADE', 8);
  var colEquipe = visitas_idxCol_(mapa, 'EQUIPE', 0);
  var colStatus = visitas_idxCol_(mapa, 'STATUS_VISITA', 0);
  if (!colEquipe || !colStatus) {
    throw new Error('Colunas de acompanhamento ausentes. Execute ' +
      'configurarModuloVisitas() primeiro.');
  }

  var n = ultima - 1;
  var cidades = abaE.getRange(2, colCidade, n, 1).getValues();
  var equipes = abaE.getRange(2, colEquipe, n, 1).getValues();
  var status = abaE.getRange(2, colStatus, n, 1).getValues();

  var contA = 0, contB = 0, jaTinha = 0;
  for (var i = 0; i < n; i++) {
    if (String(equipes[i][0]).trim()) { jaTinha++; }
    else {
      var cidade = visitas_normalizarTexto_(cidades[i][0]);
      var eGV = false;
      for (var k = 0; k < VIS_GRANDE_VITORIA.length; k++) {
        if (cidade.indexOf(VIS_GRANDE_VITORIA[k]) >= 0) { eGV = true; break; }
      }
      equipes[i][0] = eGV ? 'A' : 'B';
      if (eGV) contA++; else contB++;
    }
    if (!String(status[i][0]).trim()) status[i][0] = VIS_STATUS.PENDENTE;
  }

  abaE.getRange(2, colEquipe, n, 1).setValues(equipes);
  abaE.getRange(2, colStatus, n, 1).setValues(status);
  visitas_limparCache_();

  return 'Equipe A (Grande Vitoria): ' + contA + ' | Equipe B (Interior): ' +
    contB + ' | ja classificadas antes: ' + jaTinha + ' | total: ' + n;
}

/**
 * Define a URL do web app usada para montar os QR Codes das visitas.
 */
function definirURLWebAppVisitas(url) {
  var u = String(url || '').trim();
  if (u.indexOf('https://') !== 0) {
    throw new Error('Informe a URL completa do web app, comecando com https://');
  }
  PropertiesService.getScriptProperties().setProperty(VIS_PROP_URL_FICHA, u);
  return 'URL registrada: ' + u;
}

/* ==========================================================================
 * ESCOLAS - consulta e visao 360
 * ========================================================================== */

/**
 * Lista escolas para o painel de visitas.
 * filtros: { equipe, cidade, status, texto, semVisita }
 */
function listarEscolasVisitas(filtros, tokenSessao) {
  visitas_exigirSessao_(tokenSessao); // achado #8: era condicional (bypassável omitindo o argumento)
  return visitas_listarEscolas_(filtros);
}

function visitas_listarEscolas_(filtros) {
  filtros = filtros || {};
  var abaE = visitas_abaEscolas_();
  var ultima = abaE.getLastRow();
  if (ultima < 2) return { sucesso: true, total: 0, kpis: {}, escolas: [] };

  var mapa = visitas_mapaCabecalho_(abaE);
  var dados = abaE.getRange(2, 1, ultima - 1, abaE.getLastColumn()).getValues();
  var v = function (linha, nome, padrao) {
    var i = visitas_idxCol_(mapa, nome, padrao);
    return i ? String(linha[i - 1] === null ? '' : linha[i - 1]).trim() : '';
  };

  var todas = dados.map(function (linha, idx) {
    return {
      _LINHA: idx + 2,
      unidade: v(linha, 'UNIDADE', 1),
      nome: v(linha, 'ESCOLA (RAZÃO SOCIAL)', 2),
      cnpj: v(linha, 'CNPJ', 3),
      email: v(linha, 'E-MAIL (PRINCIPAL)', 4),
      telefone: v(linha, 'TELEFONE 1', 6),
      cidade: v(linha, 'CIDADE', 8),
      endereco: v(linha, 'ENDEREÇO', 9),
      numero: v(linha, 'NÚMERO', 10),
      bairro: v(linha, 'BAIRRO', 11),
      responsavel: v(linha, 'RESPONSAVEL', 25),
      cargoResponsavel: v(linha, 'CARGORESPONSAVEL', 26),
      equipe: v(linha, 'EQUIPE', 0),
      statusVisita: v(linha, 'STATUS_VISITA', 0) || VIS_STATUS.PENDENTE,
      ultimaVisita: visitas_fmtData_(v(linha, 'ULTIMA_VISITA', 0)),
      proximaVisita: visitas_fmtData_(v(linha, 'PROXIMA_VISITA', 0)),
      totalVisitas: parseInt(v(linha, 'TOTAL_VISITAS', 0), 10) || 0,
      totalSindicalizacoes: parseInt(v(linha, 'TOTAL_SINDICALIZACOES', 0), 10) || 0,
      diretorResponsavel: v(linha, 'DIRETOR_RESPONSAVEL', 0)
    };
  });

  var kpis = visitas_kpisEscolas_(todas);

  var lista = todas.filter(function (e) {
    if (filtros.equipe && e.equipe !== filtros.equipe) return false;
    if (filtros.status && e.statusVisita !== filtros.status) return false;
    if (filtros.cidade && visitas_normalizarTexto_(e.cidade)
        .indexOf(visitas_normalizarTexto_(filtros.cidade)) < 0) return false;
    if (filtros.semVisita && e.totalVisitas > 0) return false;
    if (filtros.texto) {
      var t = visitas_normalizarTexto_(filtros.texto);
      var alvo = visitas_normalizarTexto_(
        e.nome + ' ' + e.cidade + ' ' + e.bairro + ' ' + e.cnpj);
      if (alvo.indexOf(t) < 0) return false;
    }
    return true;
  });

  return { sucesso: true, total: lista.length, kpis: kpis, escolas: lista };
}

/**
 * Visao 360 de uma escola: cadastro, historico de visitas e
 * sindicalizacoes originadas nela.
 */
function obterEscola360(cnpjOuNome, tokenSessao) {
  visitas_exigirSessao_(tokenSessao); // achado #8: era condicional (bypassável omitindo o argumento)

  var alvo = String(cnpjOuNome || '').trim();
  var alvoDigitos = alvo.replace(/\D/g, '');
  var lista = visitas_listarEscolas_({}).escolas;

  var escola = null;
  for (var i = 0; i < lista.length; i++) {
    if (alvoDigitos && lista[i].cnpj.replace(/\D/g, '') === alvoDigitos) {
      escola = lista[i]; break;
    }
    if (visitas_normalizarTexto_(lista[i].nome) === visitas_normalizarTexto_(alvo)) {
      escola = lista[i]; break;
    }
  }
  if (!escola) return { sucesso: false, mensagem: 'Escola nao encontrada.' };

  var visitas = visitas_lerTodas_().filter(function (v) {
    return visitas_normalizarTexto_(v.ESCOLA) === visitas_normalizarTexto_(escola.nome);
  }).map(visitas_resumir_);
  visitas.sort(function (a, b) {
    return String(b.DATA_AGENDADA).localeCompare(String(a.DATA_AGENDADA));
  });

  var fichas = [];
  try {
    var todasFichas = listarFichasSindicalizacao({}).fichas || [];
    fichas = todasFichas.filter(function (f) {
      return visitas_normalizarTexto_(f.ESCOLA) === visitas_normalizarTexto_(escola.nome);
    });
  } catch (e) {
    Logger.log('Fichas da escola indisponiveis: ' + e.message);
  }

  return {
    sucesso: true,
    escola: escola,
    visitas: visitas,
    totalVisitas: visitas.length,
    fichas: fichas,
    totalFichas: fichas.length
  };
}

/* ==========================================================================
 * VISITAS - agenda, check-in, checklist, check-out
 * ========================================================================== */

/**
 * Agenda uma visita.
 * dados: { escola, cnpj, unidade, cidade, equipe, diretorBase,
 *          dataAgendada (yyyy-MM-dd), horaAgendada (HH:mm), observacoes }
 */
function agendarVisita(dados, tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);
  return visitas_agendar_(dados, sessao.nome);
}

/** Agendamento sem validacao de sessao - uso interno e do editor. */
function visitas_agendar_(dados, usuario) {
  if (!dados || !String(dados.escola || '').trim()) {
    return { sucesso: false, mensagem: 'Informe a escola.' };
  }
  if (!String(dados.dataAgendada || '').trim()) {
    return { sucesso: false, mensagem: 'Informe a data da visita.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = visitas_montarRegistroAgenda_(dados, usuario, 0);
    visitas_gravar_(r);
    visitas_atualizarEscola_(r.ESCOLA, {
      STATUS_VISITA: VIS_STATUS.AGENDADA,
      PROXIMA_VISITA: r.DATA_AGENDADA,
      DIRETOR_RESPONSAVEL: r.DIRETOR_BASE
    });
    visitas_limparCache_();

    return {
      sucesso: true,
      idVisita: r.ID_VISITA,
      mensagem: 'Visita agendada para ' + visitas_fmtData_(r.DATA_AGENDADA) +
        (r.HORA_AGENDADA ? ' as ' + r.HORA_AGENDADA : '') + '.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Monta o registro de uma visita agendada. Extraido para que o lote
 * reaproveite sem repetir a montagem campo a campo. O sufixo de sequencia
 * evita colisao de ID quando varias visitas nascem no mesmo segundo.
 */
function visitas_montarRegistroAgenda_(dados, usuario, sequencia) {
  var r = visitas_registroVazio_();
  r.ID_VISITA = visitas_gerarId_() + (sequencia ? '-' + sequencia : '');
  r.DATA_AGENDADA = String(dados.dataAgendada).trim();
  r.HORA_AGENDADA = String(dados.horaAgendada || '').trim();
  r.STATUS = VIS_STATUS.AGENDADA;
  r.ESCOLA = String(dados.escola).trim();
  r.CNPJ = String(dados.cnpj || '').trim();
  r.UNIDADE = String(dados.unidade || '').trim();
  r.CIDADE = String(dados.cidade || '').trim();
  r.EQUIPE = String(dados.equipe || '').trim();
  r.DIRETOR_BASE = String(dados.diretorBase || usuario).trim();
  r.OBSERVACOES = String(dados.observacoes || '').trim();
  r.FICHAS_GERADAS = 0;
  r.CRIADA_EM = new Date();
  r.CRIADA_POR = usuario;
  r.ATUALIZADA_EM = new Date();
  return r;
}

/**
 * Agenda varias visitas de uma vez (montagem da rota do dia).
 * escolas: [{ escola, cnpj, unidade, cidade, equipe, horaAgendada }]
 *
 * Operacao atomica: um unico lock, um unico append e uma unica passada na
 * aba Escolas. A versao anterior chamava agendarVisita em laco, o que relia
 * a planilha inteira a cada item e podia estourar o tempo do GAS.
 */
function agendarVisitasEmLote(escolas, dataAgendada, diretorBase, tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);
  if (!escolas || !escolas.length) {
    return { sucesso: false, mensagem: 'Nenhuma escola informada.' };
  }
  var data = String(dataAgendada || '').trim();
  if (!data) return { sucesso: false, mensagem: 'Informe a data da rota.' };

  var diretor = String(diretorBase || sessao.nome).trim();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = visitas_aba_();
    var mapa = visitas_mapaCabecalho_(aba);
    var totalCols = Math.max(aba.getLastColumn(), VIS_COLUNAS.length);

    var linhas = [], criadas = [], falhas = [], atualizacoes = {};

    escolas.forEach(function (e, i) {
      var nome = String(e.escola || '').trim();
      if (!nome) {
        falhas.push('Item ' + (i + 1) + ': escola sem nome.');
        return;
      }
      var r = visitas_montarRegistroAgenda_({
        escola: nome, cnpj: e.cnpj, unidade: e.unidade,
        cidade: e.cidade, equipe: e.equipe,
        dataAgendada: data, horaAgendada: e.horaAgendada,
        diretorBase: diretor
      }, sessao.nome, i + 1);

      var linha = new Array(totalCols).fill('');
      VIS_COLUNAS.forEach(function (c, k) {
        var col = visitas_idxCol_(mapa, c, k + 1);
        linha[col - 1] = r[c] !== undefined ? r[c] : '';
      });
      linhas.push(linha);
      criadas.push(r.ID_VISITA);
      atualizacoes[nome] = {
        STATUS_VISITA: VIS_STATUS.AGENDADA,
        PROXIMA_VISITA: r.DATA_AGENDADA,
        DIRETOR_RESPONSAVEL: r.DIRETOR_BASE
      };
    });

    if (!linhas.length) {
      return { sucesso: false, mensagem: 'Nenhuma visita valida no lote.',
               falhas: falhas };
    }

    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, totalCols)
       .setValues(linhas);

    visitas_atualizarEscolasEmLote_(atualizacoes);
    visitas_limparCache_();

    return {
      sucesso: true,
      total: criadas.length,
      idsVisitas: criadas,
      falhas: falhas,
      mensagem: criadas.length + ' visita(s) agendada(s) para ' + diretor +
        ' em ' + visitas_fmtData_(data) +
        (falhas.length ? ' - ' + falhas.length + ' falha(s)' : '') + '.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra a chegada do diretor na escola. Guarda GPS e horario -
 * e o que comprova a visita presencial.
 */
function registrarCheckin(idVisita, latitude, longitude, tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = visitas_buscarPorId_(idVisita);
    if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };
    if (r.STATUS === VIS_STATUS.CANCELADA) {
      return { sucesso: false, mensagem: 'Esta visita foi cancelada.' };
    }
    if (r.CHECKIN_DATA_HORA) {
      return { sucesso: false, mensagem: 'Check-in ja registrado as ' +
        visitas_fmtDataHora_(r.CHECKIN_DATA_HORA) + '.' };
    }
    r.CHECKIN_DATA_HORA = new Date();
    r.CHECKIN_LAT = latitude === undefined || latitude === null ? '' : String(latitude);
    r.CHECKIN_LNG = longitude === undefined || longitude === null ? '' : String(longitude);
    r.STATUS = VIS_STATUS.EM_ANDAMENTO;
    if (!String(r.DIRETOR_BASE || '').trim()) r.DIRETOR_BASE = sessao.nome;
    r.ATUALIZADA_EM = new Date();
    visitas_gravar_(r);
    visitas_atualizarEscola_(r.ESCOLA, { STATUS_VISITA: VIS_STATUS.EM_ANDAMENTO });
    visitas_limparCache_();

    var link = '';
    try { link = visitas_linkFicha_(r).url || ''; }
    catch (e) { Logger.log('Link do QR indisponivel: ' + e.message); }

    return {
      sucesso: true,
      horario: visitas_fmtDataHora_(r.CHECKIN_DATA_HORA),
      linkQRCode: link,
      mensagem: 'Check-in registrado. Bom trabalho!'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Salva o checklist e os dados coletados durante a visita.
 */
function salvarDadosVisita(idVisita, dados, tokenSessao) {
  visitas_exigirSessao_(tokenSessao);
  dados = dados || {};

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = visitas_buscarPorId_(idVisita);
    if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };

    var check = dados.checklist || {};
    VIS_CHECKLIST.forEach(function (par) {
      r[par[0]] = check[par[0]] ? 'SIM' : '';
    });
    if (dados.responsavelAtendeu !== undefined) {
      r.RESPONSAVEL_ATENDEU = String(dados.responsavelAtendeu).trim();
    }
    if (dados.cargoResponsavel !== undefined) {
      r.CARGO_RESPONSAVEL = String(dados.cargoResponsavel).trim();
    }
    if (dados.telefoneContato !== undefined) {
      r.TELEFONE_CONTATO = String(dados.telefoneContato).replace(/\D/g, '');
    }
    if (dados.materiaisEntregues !== undefined) {
      r.MATERIAIS_ENTREGUES = String(dados.materiaisEntregues).trim();
    }
    if (dados.observacoes !== undefined) {
      r.OBSERVACOES = String(dados.observacoes).trim();
    }
    r.ATUALIZADA_EM = new Date();
    visitas_gravar_(r);
    visitas_limparCache_();
    return { sucesso: true, mensagem: 'Dados da visita salvos.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Encerra a visita: calcula duracao, define o status final, conta as
 * fichas geradas e atualiza o cadastro da escola.
 */
function finalizarVisita(idVisita, statusFinal, proximaVisita, observacoes, tokenSessao) {
  visitas_exigirSessao_(tokenSessao);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = visitas_buscarPorId_(idVisita);
    if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };
    if (!r.CHECKIN_DATA_HORA) {
      return { sucesso: false,
        mensagem: 'Registre a chegada antes de finalizar a visita.' };
    }

    /* Whitelist explicita: a verificacao anterior aceitava CANCELADA como
       resultado, porque a chave existe em VIS_STATUS. */
    var status = String(statusFinal || '').toUpperCase();
    if (VIS_STATUS_FINAIS.indexOf(status) < 0) status = VIS_STATUS.VISITADA;

    r.CHECKOUT_DATA_HORA = new Date();
    if (r.CHECKIN_DATA_HORA instanceof Date) {
      r.DURACAO_MIN = Math.max(1, Math.round(
        (r.CHECKOUT_DATA_HORA - r.CHECKIN_DATA_HORA) / 60000));
    }
    r.STATUS = status;
    if (proximaVisita) r.PROXIMA_VISITA = String(proximaVisita).trim();
    if (observacoes) r.OBSERVACOES = String(observacoes).trim();
    r.FICHAS_GERADAS = visitas_contarFichas_(r.ID_VISITA);
    r.ATUALIZADA_EM = new Date();
    visitas_gravar_(r);

    var totais = visitas_totaisDaEscola_(r.ESCOLA);
    visitas_atualizarEscola_(r.ESCOLA, {
      STATUS_VISITA: status,
      ULTIMA_VISITA: r.CHECKOUT_DATA_HORA,
      PROXIMA_VISITA: r.PROXIMA_VISITA || '',
      TOTAL_VISITAS: totais.visitas,
      TOTAL_SINDICALIZACOES: totais.fichas,
      DIRETOR_RESPONSAVEL: r.DIRETOR_BASE
    });
    visitas_limparCache_();

    return {
      sucesso: true,
      duracaoMin: r.DURACAO_MIN,
      fichasGeradas: r.FICHAS_GERADAS,
      mensagem: 'Visita finalizada' +
        (r.DURACAO_MIN ? ' - ' + r.DURACAO_MIN + ' min' : '') +
        ' - ' + r.FICHAS_GERADAS + ' ficha(s) gerada(s).'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cancela uma visita agendada, devolvendo a escola ao status anterior.
 */
function cancelarVisita(idVisita, motivo, tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = visitas_buscarPorId_(idVisita);
    if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };
    if (VIS_STATUS_FINAIS.indexOf(r.STATUS) >= 0) {
      return { sucesso: false, mensagem: 'Visita ja concluida nao pode ser cancelada.' };
    }
    r.STATUS = VIS_STATUS.CANCELADA;
    r.OBSERVACOES = (r.OBSERVACOES ? r.OBSERVACOES + ' | ' : '') +
      'Cancelada por ' + sessao.nome + ': ' +
      String(motivo || 'sem motivo informado');
    r.ATUALIZADA_EM = new Date();
    visitas_gravar_(r);

    var totais = visitas_totaisDaEscola_(r.ESCOLA);
    visitas_atualizarEscola_(r.ESCOLA, {
      STATUS_VISITA: totais.visitas > 0 ? VIS_STATUS.VISITADA : VIS_STATUS.PENDENTE,
      PROXIMA_VISITA: ''
    });
    visitas_limparCache_();
    return { sucesso: true, mensagem: 'Visita cancelada.' };
  } finally {
    lock.releaseLock();
  }
}

/* ==========================================================================
 * AGENDA E ROTA
 * ========================================================================== */

/**
 * Agenda de um dia. Sem data, devolve a agenda de hoje.
 *
 * Escopo: quem nao e gestor so enxerga a propria agenda, mesmo pedindo
 * outro diretor. Antes, obterAgendaDoDia(null, null) devolvia as visitas
 * de todos os diretores para qualquer um.
 */
function obterAgendaDoDia(data, diretorBase, tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);
  var gestor = visitas_ehGestor_(sessao);
  var filtro = gestor ? String(diretorBase || '').trim() : sessao.nome;
  var r = visitas_agendaDoDia_(data, filtro);
  r.escopo = gestor ? 'TODOS' : 'PROPRIO';
  return r;
}

/** Agenda sem validacao de sessao - uso interno e do editor. */
function visitas_agendaDoDia_(data, diretorBase) {
  var alvo = String(data || Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')).trim();

  var visitas = visitas_lerTodas_().filter(function (v) {
    if (visitas_dataISO_(v.DATA_AGENDADA) !== alvo) return false;
    if (v.STATUS === VIS_STATUS.CANCELADA) return false;
    if (diretorBase && visitas_normalizarTexto_(v.DIRETOR_BASE) !==
        visitas_normalizarTexto_(diretorBase)) return false;
    return true;
  }).map(visitas_resumir_);

  visitas.sort(function (a, b) {
    return String(a.HORA_AGENDADA || '99:99').localeCompare(
      String(b.HORA_AGENDADA || '99:99'));
  });

  var concluidas = visitas.filter(function (v) {
    return VIS_STATUS_FINAIS.indexOf(v.STATUS) >= 0;
  }).length;

  return {
    sucesso: true,
    data: alvo,
    diretor: diretorBase || 'todos',
    total: visitas.length,
    concluidas: concluidas,
    pendentes: visitas.length - concluidas,
    visitas: visitas
  };
}

/**
 * Monta o link do Google Maps com a rota do dia, na ordem dos horarios.
 */
function gerarLinkRotaDoDia(data, diretorBase, tokenSessao) {
  var agenda = obterAgendaDoDia(data, diretorBase, tokenSessao);
  if (!agenda.visitas.length) {
    return { sucesso: false, mensagem: 'Nenhuma visita agendada para esta data.' };
  }
  var escolasInfo = visitas_listarEscolas_({}).escolas;
  var enderecos = [];
  agenda.visitas.forEach(function (v) {
    for (var i = 0; i < escolasInfo.length; i++) {
      if (visitas_normalizarTexto_(escolasInfo[i].nome) ===
          visitas_normalizarTexto_(v.ESCOLA)) {
        var e = escolasInfo[i];
        var end = [e.endereco, e.numero, e.bairro, e.cidade, 'ES']
          .filter(function (x) { return x; }).join(', ');
        if (end) enderecos.push(end);
        return;
      }
    }
  });
  if (!enderecos.length) {
    return { sucesso: false, mensagem: 'Escolas sem endereco cadastrado.' };
  }
  var destino = enderecos.pop();
  var url = 'https://www.google.com/maps/dir/?api=1' +
    '&destination=' + encodeURIComponent(destino) +
    (enderecos.length ? '&waypoints=' +
      enderecos.map(encodeURIComponent).join('%7C') : '') +
    '&travelmode=driving';
  return { sucesso: true, url: url, paradas: enderecos.length + 1 };
}

/* ==========================================================================
 * QR CODE - ponte com a Sindicalizacao
 * ========================================================================== */

/**
 * Monta o link da Ficha de Sindicalizacao carimbado com esta visita.
 * O QR Code e desenhado no navegador a partir desta URL.
 */
function gerarLinkFichaDaVisita(idVisita, tokenSessao) {
  visitas_exigirSessao_(tokenSessao); // achado #8: era condicional (bypassável omitindo o argumento)
  var r = visitas_buscarPorId_(idVisita);
  if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };
  return visitas_linkFicha_(r);
}

function visitas_linkFicha_(r) {
  var base = PropertiesService.getScriptProperties()
    .getProperty(VIS_PROP_URL_FICHA);
  if (!base) {
    return {
      sucesso: false,
      mensagem: 'URL do web app nao configurada. Execute ' +
        'definirURLWebAppVisitas(url) uma vez pelo editor.'
    };
  }
  var url = base + '?ficha=sindicalizacao' +
    '&idVisita=' + encodeURIComponent(r.ID_VISITA) +
    '&diretorBase=' + encodeURIComponent(r.DIRETOR_BASE || '') +
    '&escola=' + encodeURIComponent(r.ESCOLA || '');

  return {
    sucesso: true,
    url: url,
    escola: r.ESCOLA,
    diretorBase: r.DIRETOR_BASE,
    idVisita: r.ID_VISITA
  };
}

/**
 * Pre-cadastro rapido durante a visita: repassa ao modulo de
 * Sindicalizacao ja carimbando visita e diretor de base.
 */
function cadastroRapidoNaVisita(idVisita, dados, tokenSessao) {
  visitas_exigirSessao_(tokenSessao);
  var r = visitas_buscarPorId_(idVisita);
  if (!r) return { sucesso: false, mensagem: 'Visita nao encontrada.' };
  dados = dados || {};
  dados.idVisita = r.ID_VISITA;
  dados.diretorBase = r.DIRETOR_BASE;
  dados.escola = dados.escola || r.ESCOLA;
  dados.origem = 'CADASTRO_RAPIDO_VISITA';
  return criarPreCadastroSindicalizacao(dados);
}

/* ==========================================================================
 * INDICADORES
 * ========================================================================== */

/**
 * Painel de indicadores do modulo (dashboard).
 */
function obterIndicadoresVisitas(tokenSessao) {
  visitas_exigirSessao_(tokenSessao); // achado #8: era condicional (bypassável omitindo o argumento)
  return visitas_indicadores_();
}

function visitas_indicadores_() {
  var escolas = visitas_listarEscolas_({});
  var visitas = visitas_lerTodas_();
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var agora = new Date();

  var visitadasHoje = 0, visitadasMes = 0, somaDuracao = 0, comDuracao = 0;
  var fichasMes = 0;
  visitas.forEach(function (v) {
    if (VIS_STATUS_FINAIS.indexOf(v.STATUS) < 0) return;
    var d = v.CHECKOUT_DATA_HORA instanceof Date ? v.CHECKOUT_DATA_HORA : null;
    if (d) {
      if (Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') === hoje) {
        visitadasHoje++;
      }
      if (d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()) {
        visitadasMes++;
        fichasMes += parseInt(v.FICHAS_GERADAS, 10) || 0;
      }
    }
    var dur = parseInt(v.DURACAO_MIN, 10);
    if (dur) { somaDuracao += dur; comDuracao++; }
  });

  return {
    sucesso: true,
    totalEscolas: escolas.kpis.total,
    equipeA: escolas.kpis.equipeA,
    equipeB: escolas.kpis.equipeB,
    visitadas: escolas.kpis.visitadas,
    pendentes: escolas.kpis.pendentes,
    emAndamento: escolas.kpis.emAndamento,
    nuncaVisitadas: escolas.kpis.nuncaVisitadas,
    retornar: escolas.kpis.retornar,
    semContato: escolas.kpis.semContato,
    agendadas: escolas.kpis.agendadas,
    visitadasHoje: visitadasHoje,
    visitadasMes: visitadasMes,
    sindicalizacoes: escolas.kpis.sindicalizacoes,
    sindicalizacoesMes: fichasMes,
    tempoMedioMin: comDuracao ? Math.round(somaDuracao / comDuracao) : 0,
    coberturaPct: escolas.kpis.total ?
      Math.round(escolas.kpis.visitadas * 1000 / escolas.kpis.total) / 10 : 0
  };
}

/**
 * Desempenho dos diretores de base por visitas e conversao.
 * Restrito a perfis de gestao - e dado sensivel de desempenho individual.
 */
function obterRankingDiretores(tokenSessao) {
  var sessao = visitas_exigirSessao_(tokenSessao);
  if (!visitas_ehGestor_(sessao)) {
    return { sucesso: false,
      mensagem: 'Somente a diretoria acessa os dados de desempenho.' };
  }
  return visitas_ranking_();
}

function visitas_ranking_() {
  var visitas = visitas_lerTodas_();
  var por = {};
  visitas.forEach(function (v) {
    var d = String(v.DIRETOR_BASE || '').trim();
    if (!d) return;
    if (!por[d]) por[d] = { diretor: d, visitas: 0, fichas: 0, duracao: 0,
      comDuracao: 0, agendadas: 0 };
    if (v.STATUS === VIS_STATUS.AGENDADA || v.STATUS === VIS_STATUS.EM_ANDAMENTO) {
      por[d].agendadas++;
      return;
    }
    if (VIS_STATUS_FINAIS.indexOf(v.STATUS) < 0) return;
    por[d].visitas++;
    por[d].fichas += parseInt(v.FICHAS_GERADAS, 10) || 0;
    var dur = parseInt(v.DURACAO_MIN, 10);
    if (dur) { por[d].duracao += dur; por[d].comDuracao++; }
  });

  var lista = Object.keys(por).map(function (k) {
    var x = por[k];
    x.conversao = x.visitas ? Math.round(x.fichas * 100 / x.visitas) / 100 : 0;
    x.tempoMedio = x.comDuracao ? Math.round(x.duracao / x.comDuracao) : 0;
    delete x.duracao; delete x.comDuracao;
    return x;
  });
  lista.sort(function (a, b) {
    if (b.fichas !== a.fichas) return b.fichas - a.fichas;
    return b.visitas - a.visitas;
  });
  return { sucesso: true, total: lista.length, diretores: lista };
}

/**
 * Cobertura por municipio - mostra onde faltam visitas.
 * Agrupa pelo nome normalizado (sem acento) para nao separar "VITORIA"
 * de "VITÓRIA", que sao o mesmo municipio no cadastro.
 */
function obterCoberturaPorMunicipio(tokenSessao) {
  visitas_exigirSessao_(tokenSessao); // achado #8: era condicional (bypassável omitindo o argumento)

  var escolas = visitas_listarEscolas_({}).escolas;
  var por = {};
  escolas.forEach(function (e) {
    var bruto = String(e.cidade || 'SEM CIDADE').trim();
    var chave = visitas_normalizarTexto_(bruto) || 'SEM CIDADE';
    if (!por[chave]) {
      por[chave] = { municipio: chave, total: 0, visitadas: 0,
        pendentes: 0, sindicalizacoes: 0, equipe: e.equipe };
    }
    por[chave].total++;
    if (e.totalVisitas > 0) por[chave].visitadas++;
    else por[chave].pendentes++;
    por[chave].sindicalizacoes += e.totalSindicalizacoes;
  });
  var lista = Object.keys(por).map(function (k) {
    var x = por[k];
    x.coberturaPct = x.total ? Math.round(x.visitadas * 1000 / x.total) / 10 : 0;
    return x;
  });
  lista.sort(function (a, b) { return b.total - a.total; });
  return { sucesso: true, total: lista.length, municipios: lista };
}

/* ==========================================================================
 * HELPERS INTERNOS
 * ========================================================================== */

/**
 * Exige sessao valida do SISGEP e devolve a identidade de quem opera.
 * LANCA quando a sessao nao resolve - e o guard das funcoes publicas.
 *
 * NOTA (levantamento de 29/07/2026): este comentario mencionava antes uma
 * flag "BYPASS_LOGIN_TEMPORARIO" como suposta primeira camada de protecao.
 * Essa flag nao existe em nenhum arquivo do projeto hoje - confirmado que
 * o login do SISGEP ja funciona normalmente, sem bypass. Removida a
 * mencao para nao confundir quem ler este arquivo depois.
 */
function visitas_exigirSessao_(tokenSessao) {
  var token = String(tokenSessao || '').trim();
  if (!token) {
    throw new Error('Sessao nao informada. Recarregue o SISGEP e faca login.');
  }
  if (typeof getSessaoUsuario !== 'function') {
    throw new Error('Validacao de sessao indisponivel neste projeto.');
  }
  var s = null;
  try {
    s = getSessaoUsuario(token);
  } catch (e) {
    Logger.log('Falha ao resolver sessao no modulo Visitas: ' + e.message);
  }
  if (!s || !(s.nome || s.usuario)) {
    throw new Error('Sessao invalida ou expirada. Faca login novamente.');
  }
  return {
    nome: String(s.nome || s.usuario).trim(),
    email: String(s.email || s.usuario || '').trim(),
    perfil: String(s.perfil || '').trim().toUpperCase()
  };
}

/** Perfis que enxergam a operacao inteira, nao so a propria agenda. */
function visitas_ehGestor_(sessao) {
  var p = sessao && sessao.perfil ? sessao.perfil : '';
  return p === 'ADMINISTRADOR' || p === 'DIRETORIA' || p === 'PRESIDENTE';
}

/**
 * Identidade de quem opera, sem bloquear. Usada pelas funcoes rodadas
 * pelo editor, onde nao existe token de sessao.
 */
function visitas_usuarioAtual_(tokenSessao) {
  if (tokenSessao && typeof getSessaoUsuario === 'function') {
    try {
      var s = getSessaoUsuario(String(tokenSessao).trim());
      if (s && (s.nome || s.usuario)) return s.nome || s.usuario;
    } catch (e) {
      Logger.log('Sessao nao resolvida no modulo Visitas: ' + e.message);
    }
  }
  try {
    return Session.getActiveUser().getEmail() || 'SISGEP';
  } catch (e) {
    return 'SISGEP';
  }
}

function visitas_planilha_() {
  return SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
}

function visitas_aba_() {
  var aba = visitas_planilha_().getSheetByName(VIS_ABA_VISITAS);
  if (!aba) {
    throw new Error('Aba ' + VIS_ABA_VISITAS +
      ' nao existe. Execute configurarModuloVisitas().');
  }
  return aba;
}

function visitas_abaEscolas_() {
  var aba = visitas_planilha_().getSheetByName(VIS_ABA_ESCOLAS);
  if (!aba) throw new Error('Aba ' + VIS_ABA_ESCOLAS + ' nao encontrada.');
  return aba;
}

function visitas_mapaCabecalho_(aba) {
  var ultCol = aba.getLastColumn();
  if (ultCol < 1) return {};
  var cab = aba.getRange(1, 1, 1, ultCol).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave && mapa[chave] === undefined) mapa[chave] = i + 1;
  });
  return mapa;
}

/** Indice 1-based da coluna pelo nome, com fallback posicional. */
function visitas_idxCol_(mapa, nome, padrao) {
  var i = mapa[String(nome).toUpperCase()];
  return i === undefined ? (padrao || 0) : i;
}

function visitas_registroVazio_() {
  var r = {};
  VIS_COLUNAS.forEach(function (c) { r[c] = ''; });
  return r;
}

function visitas_lerTodas_() {
  var aba = visitas_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  var mapa = visitas_mapaCabecalho_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  return dados.map(function (linha, idx) {
    var r = { _LINHA: idx + 2 };
    VIS_COLUNAS.forEach(function (c, i) {
      var col = visitas_idxCol_(mapa, c, i + 1);
      r[c] = linha[col - 1] !== undefined ? linha[col - 1] : '';
    });
    return r;
  });
}

function visitas_buscarPorId_(idVisita) {
  var alvo = String(idVisita || '').trim();
  if (!alvo) return null;
  var todas = visitas_lerTodas_();
  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].ID_VISITA).trim() === alvo) return todas[i];
  }
  return null;
}

function visitas_gravar_(registro) {
  var aba = visitas_aba_();
  var mapa = visitas_mapaCabecalho_(aba);
  var totalCols = Math.max(aba.getLastColumn(), VIS_COLUNAS.length);
  var linha = new Array(totalCols).fill('');
  VIS_COLUNAS.forEach(function (c, i) {
    var col = visitas_idxCol_(mapa, c, i + 1);
    linha[col - 1] = registro[c] !== undefined ? registro[c] : '';
  });
  var existente = visitas_buscarPorId_(registro.ID_VISITA);
  if (existente) {
    aba.getRange(existente._LINHA, 1, 1, totalCols).setValues([linha]);
  } else {
    aba.appendRow(linha);
  }
}

/** Atualiza campos de acompanhamento da escola, sem tocar no cadastro. */
function visitas_atualizarEscola_(nomeEscola, campos) {
  try {
    var abaE = visitas_abaEscolas_();
    var ultima = abaE.getLastRow();
    if (ultima < 2) return;
    var mapa = visitas_mapaCabecalho_(abaE);
    var colNome = visitas_idxCol_(mapa, 'ESCOLA (RAZÃO SOCIAL)', 2);
    var nomes = abaE.getRange(2, colNome, ultima - 1, 1).getValues();
    var alvo = visitas_normalizarTexto_(nomeEscola);
    for (var i = 0; i < nomes.length; i++) {
      if (visitas_normalizarTexto_(nomes[i][0]) === alvo) {
        var linha = i + 2;
        Object.keys(campos).forEach(function (k) {
          var col = visitas_idxCol_(mapa, k, 0);
          if (col) abaE.getRange(linha, col).setValue(campos[k]);
        });
        return;
      }
    }
  } catch (e) {
    Logger.log('Atualizacao da escola falhou (' + nomeEscola + '): ' + e.message);
  }
}

/**
 * Atualiza o acompanhamento de varias escolas numa so passada.
 * atualizacoes: { 'NOME DA ESCOLA': { COLUNA: valor, ... }, ... }
 *
 * Le a aba Escolas uma vez e escreve uma vez por coluna afetada, em vez
 * de um setValue por campo por escola.
 */
function visitas_atualizarEscolasEmLote_(atualizacoes) {
  try {
    var nomesAlvo = Object.keys(atualizacoes || {});
    if (!nomesAlvo.length) return;

    var abaE = visitas_abaEscolas_();
    var ultima = abaE.getLastRow();
    if (ultima < 2) return;

    var mapa = visitas_mapaCabecalho_(abaE);
    var colNome = visitas_idxCol_(mapa, 'ESCOLA (RAZÃO SOCIAL)', 2);
    var n = ultima - 1;
    var nomes = abaE.getRange(2, colNome, n, 1).getValues();

    /* Indice normalizado nome -> primeira linha. Escolas com a mesma razao
       social em unidades diferentes casam na primeira; e limitacao do
       cadastro, nao deste laco. */
    var indice = {};
    for (var i = 0; i < n; i++) {
      var chave = visitas_normalizarTexto_(nomes[i][0]);
      if (chave && indice[chave] === undefined) indice[chave] = i;
    }

    var colunas = {};
    nomesAlvo.forEach(function (nome) {
      Object.keys(atualizacoes[nome]).forEach(function (c) { colunas[c] = true; });
    });

    Object.keys(colunas).forEach(function (nomeCol) {
      var col = visitas_idxCol_(mapa, nomeCol, 0);
      if (!col) return;
      var valores = abaE.getRange(2, col, n, 1).getValues();
      var mexeu = false;
      nomesAlvo.forEach(function (nome) {
        var idx = indice[visitas_normalizarTexto_(nome)];
        if (idx === undefined) return;
        var novo = atualizacoes[nome][nomeCol];
        if (novo === undefined) return;
        valores[idx][0] = novo;
        mexeu = true;
      });
      if (mexeu) abaE.getRange(2, col, n, 1).setValues(valores);
    });
  } catch (e) {
    Logger.log('Atualizacao em lote das escolas falhou: ' + e.message);
  }
}

function visitas_totaisDaEscola_(nomeEscola) {
  var alvo = visitas_normalizarTexto_(nomeEscola);
  var visitas = 0, fichas = 0;
  visitas_lerTodas_().forEach(function (v) {
    if (visitas_normalizarTexto_(v.ESCOLA) !== alvo) return;
    if (VIS_STATUS_FINAIS.indexOf(v.STATUS) >= 0) {
      visitas++;
      fichas += parseInt(v.FICHAS_GERADAS, 10) || 0;
    }
  });
  return { visitas: visitas, fichas: fichas };
}

/** Conta fichas de sindicalizacao originadas nesta visita. */
function visitas_contarFichas_(idVisita) {
  try {
    var fichas = listarFichasSindicalizacao({}).fichas || [];
    var alvo = String(idVisita).trim();
    var n = 0;
    fichas.forEach(function (f) {
      if (String(f.ID_VISITA || '').trim() === alvo) n++;
    });
    return n;
  } catch (e) {
    Logger.log('Contagem de fichas indisponivel: ' + e.message);
    return 0;
  }
}

function visitas_kpisEscolas_(todas) {
  var k = {
    total: todas.length, equipeA: 0, equipeB: 0, semEquipe: 0,
    pendentes: 0, agendadas: 0, emAndamento: 0, visitadas: 0, retornar: 0,
    semContato: 0, mudouEndereco: 0, sindicalizacoes: 0, nuncaVisitadas: 0
  };
  todas.forEach(function (e) {
    if (e.equipe === 'A') k.equipeA++;
    else if (e.equipe === 'B') k.equipeB++;
    else k.semEquipe++;
    switch (e.statusVisita) {
      case VIS_STATUS.AGENDADA: k.agendadas++; break;
      case VIS_STATUS.EM_ANDAMENTO: k.emAndamento++; break;
      case VIS_STATUS.VISITADA: k.visitadas++; break;
      case VIS_STATUS.RETORNAR: k.retornar++; break;
      case VIS_STATUS.SEM_CONTATO: k.semContato++; break;
      case VIS_STATUS.MUDOU_ENDERECO: k.mudouEndereco++; break;
      default: k.pendentes++;
    }
    if (!e.totalVisitas) k.nuncaVisitadas++;
    k.sindicalizacoes += e.totalSindicalizacoes;
  });
  return k;
}

function visitas_resumir_(v) {
  return {
    ID_VISITA: v.ID_VISITA,
    DATA_AGENDADA: visitas_fmtData_(v.DATA_AGENDADA),
    HORA_AGENDADA: visitas_fmtHora_(v.HORA_AGENDADA),
    STATUS: String(v.STATUS || ''),
    ESCOLA: String(v.ESCOLA || ''),
    CIDADE: String(v.CIDADE || ''),
    EQUIPE: String(v.EQUIPE || ''),
    DIRETOR_BASE: String(v.DIRETOR_BASE || ''),
    CHECKIN: visitas_fmtDataHora_(v.CHECKIN_DATA_HORA),
    CHECKOUT: visitas_fmtDataHora_(v.CHECKOUT_DATA_HORA),
    DURACAO_MIN: parseInt(v.DURACAO_MIN, 10) || 0,
    RESPONSAVEL_ATENDEU: String(v.RESPONSAVEL_ATENDEU || ''),
    FICHAS_GERADAS: parseInt(v.FICHAS_GERADAS, 10) || 0,
    OBSERVACOES: String(v.OBSERVACOES || ''),
    PROXIMA_VISITA: visitas_fmtData_(v.PROXIMA_VISITA)
  };
}

function visitas_gerarId_() {
  return 'VIS-' + Utilities.formatDate(new Date(),
    Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' +
    Math.floor(100 + Math.random() * 900);
}

function visitas_normalizarTexto_(v) {
  return String(v || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function visitas_dataISO_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  var br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];
  return '';
}

function visitas_fmtData_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var iso = visitas_dataISO_(v);
  if (!iso) return String(v);
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

/**
 * Normaliza horas para HH:mm.
 * O Sheets converte "08:30" em Date na epoca 30/12/1899 quando a coluna
 * esta formatada como hora - este helper devolve o texto correto tanto
 * para Date quanto para string.
 */
function visitas_fmtHora_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];
  return s;
}

/**
 * Formata data/hora para dd/MM/yyyy HH:mm.
 * Tolera objeto Date, texto ISO e texto ja formatado - necessario porque
 * a coluna pode ter sido convertida para texto pela planilha.
 */
function visitas_fmtDataHora_(d) {
  if (d === null || d === undefined || d === '') return '';
  if (d instanceof Date) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  var s = String(d).trim();
  if (!s) return '';
  var tentativa = new Date(s);
  if (!isNaN(tentativa.getTime())) {
    return Utilities.formatDate(tentativa, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  return s;
}

function visitas_limparCache_() {
  try {
    CacheService.getScriptCache().remove('VIS_ESCOLAS');
  } catch (e) { /* silencioso */ }
}

/* ==========================================================================
 * DIAGNOSTICO E MANUTENCAO - rodar pelo editor
 * ========================================================================== */

/**
 * Situacao geral do modulo. Somente leitura.
 */
function diagnosticarModuloVisitas() {
  var i = visitas_indicadores_();
  Logger.log('ESCOLAS: ' + i.totalEscolas +
    ' | Equipe A: ' + i.equipeA + ' | Equipe B: ' + i.equipeB);
  Logger.log('STATUS: pendentes ' + i.pendentes + ' - agendadas ' + i.agendadas +
    ' - em andamento ' + i.emAndamento + ' - visitadas ' + i.visitadas +
    ' - retornar ' + i.retornar + ' - sem contato ' + i.semContato);
  Logger.log('NUNCA VISITADAS: ' + i.nuncaVisitadas);
  Logger.log('COBERTURA: ' + i.coberturaPct + '%');
  Logger.log('VISITAS: hoje ' + i.visitadasHoje + ' - no mes ' + i.visitadasMes +
    ' - tempo medio ' + i.tempoMedioMin + ' min');
  Logger.log('SINDICALIZACOES: total ' + i.sindicalizacoes +
    ' - no mes ' + i.sindicalizacoesMes);
  var url = PropertiesService.getScriptProperties().getProperty(VIS_PROP_URL_FICHA);
  Logger.log('URL do web app para QR Code: ' + (url || 'NAO CONFIGURADA'));
  Logger.log('FUSO do projeto: ' + Session.getScriptTimeZone());
  return 'Ver Registro de execucao.';
}

/**
 * SOMENTE LEITURA. Lista os valores da coluna CIDADE que nao correspondem
 * a nenhum municipio do ES - tipicamente bairros gravados no lugar da
 * cidade, o que joga escola da capital para a rota do Interior.
 */
function diagnosticarCidadesVisitas() {
  var escolas = visitas_listarEscolas_({}).escolas;
  var suspeitas = {};
  var okContagem = 0;

  escolas.forEach(function (e) {
    var bruto = String(e.cidade || '').trim();
    var rotulo = bruto || '(EM BRANCO)';
    if (bruto) {
      var limpo = visitas_normalizarTexto_(bruto).replace(/\s*-\s*ES$/, '').trim();
      if (VIS_MUNICIPIOS_ES.indexOf(limpo) >= 0) { okContagem++; return; }
    }
    if (!suspeitas[rotulo]) suspeitas[rotulo] = { qtd: 0, exemplos: [], equipes: {} };
    suspeitas[rotulo].qtd++;
    suspeitas[rotulo].equipes[e.equipe || '?'] =
      (suspeitas[rotulo].equipes[e.equipe || '?'] || 0) + 1;
    if (suspeitas[rotulo].exemplos.length < 3) suspeitas[rotulo].exemplos.push(e.nome);
  });

  var chaves = Object.keys(suspeitas).sort(function (a, b) {
    return suspeitas[b].qtd - suspeitas[a].qtd;
  });

  Logger.log('=== DIAGNOSTICO DA COLUNA CIDADE ===');
  Logger.log('Escolas com municipio valido: ' + okContagem + ' de ' + escolas.length);
  Logger.log('Valores suspeitos distintos: ' + chaves.length);
  Logger.log('');

  var totalSuspeitas = 0;
  chaves.forEach(function (k) {
    var s = suspeitas[k];
    totalSuspeitas += s.qtd;
    var eq = Object.keys(s.equipes).map(function (x) {
      return x + '=' + s.equipes[x];
    }).join(' ');
    Logger.log('"' + k + '" - ' + s.qtd + ' escola(s) - equipe ' + (eq || '?'));
    Logger.log('    ex.: ' + s.exemplos.join(' / '));
  });

  Logger.log('');
  Logger.log('TOTAL de escolas afetadas: ' + totalSuspeitas);
  Logger.log('Toda escola aqui listada foi para a Equipe B por padrao, ' +
    'inclusive as que ficam na Grande Vitoria.');

  return totalSuspeitas + ' escola(s) com cidade suspeita. Ver Registro de execucao.';
}

/**
 * LIMPEZA PRE-LANCAMENTO - apaga TODAS as linhas da aba SISGEP_Visitas e
 * devolve as escolas ao estado PENDENTE, preservando a classificacao de
 * equipe. Registra no log o que foi apagado, antes de apagar.
 *
 * Use apenas enquanto tudo que existe e dado de teste. Depois do inicio da
 * operacao, esta funcao destroi historico real.
 */
function limparVisitasDeTeste() {
  var aba = visitas_aba_();
  var ultima = aba.getLastRow();
  var apagadas = 0;

  if (ultima >= 2) {
    visitas_lerTodas_().forEach(function (v) {
      Logger.log('APAGANDO: ' + v.ID_VISITA + ' | ' + v.ESCOLA +
        ' | ' + v.DATA_AGENDADA + ' | ' + v.STATUS);
      apagadas++;
    });
    aba.deleteRows(2, ultima - 1);
  }

  var abaE = visitas_abaEscolas_();
  var ultimaE = abaE.getLastRow();
  var reset = 0;
  if (ultimaE >= 2) {
    var mapa = visitas_mapaCabecalho_(abaE);
    var n = ultimaE - 1;
    var campos = {
      STATUS_VISITA: VIS_STATUS.PENDENTE,
      ULTIMA_VISITA: '',
      PROXIMA_VISITA: '',
      TOTAL_VISITAS: 0,
      TOTAL_SINDICALIZACOES: 0,
      DIRETOR_RESPONSAVEL: ''
    };
    Object.keys(campos).forEach(function (nomeCol) {
      var col = visitas_idxCol_(mapa, nomeCol, 0);
      if (!col) return;
      var bloco = [];
      for (var i = 0; i < n; i++) bloco.push([campos[nomeCol]]);
      abaE.getRange(2, col, n, 1).setValues(bloco);
    });
    reset = n;
  }

  visitas_limparCache_();
  return apagadas + ' visita(s) apagada(s) | ' + reset +
    ' escola(s) devolvida(s) a PENDENTE. Equipes preservadas.';
}

/** Atalho para registrar a URL do web app pelo editor. */
function definirURLWebAppAgora() {
  return definirURLWebAppVisitas(
    'https://script.google.com/macros/s/AKfycbzgPBSSF3D2OimoEJ-qMfDNp_Dsmc95THSNdUvFgqoX7NXWcmn7ZDMzF9L-OyUbEMw_ew/exec'
  );
}

/**
 * Cria 3 visitas de teste para hoje, com escolas reais da base.
 * Apague as linhas depois com limparVisitasDeTeste().
 */
function criarVisitasDeTeste() {
  var escolas = visitas_listarEscolas_({ equipe: 'A' }).escolas.slice(0, 3);
  if (!escolas.length) throw new Error('Nenhuma escola encontrada.');

  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var diretor = visitas_usuarioAtual_();
  var horas = ['08:30', '10:00', '11:20'];

  var criadas = [];
  escolas.forEach(function (e, i) {
    var r = visitas_agendar_({
      escola: e.nome, cnpj: e.cnpj, unidade: e.unidade,
      cidade: e.cidade, equipe: e.equipe,
      dataAgendada: hoje, horaAgendada: horas[i],
      diretorBase: diretor
    }, diretor);
    Logger.log(r.mensagem + ' - ' + e.nome);
    if (r.sucesso) criadas.push(r.idVisita);
  });

  Logger.log('Diretor atribuido: "' + diretor + '"');
  Logger.log('IMPORTANTE: este nome precisa ser IGUAL ao exibido no topo do ' +
    'SISGEP, senao a agenda nao encontra as visitas.');
  return criadas.length + ' visita(s) de teste criada(s).';
}

/** Corrige o diretor das visitas de teste para o nome da sessao. */
function corrigirDiretorVisitasTeste() {
  var aba = visitas_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return 'Nenhuma visita.';
  var mapa = visitas_mapaCabecalho_(aba);
  var col = visitas_idxCol_(mapa, 'DIRETOR_BASE', 10);
  var n = ultima - 1;
  var valores = aba.getRange(2, col, n, 1).getValues();
  var nomeCorreto = 'Wanderson N. Castelo';
  var alterados = 0;
  for (var i = 0; i < n; i++) {
    if (String(valores[i][0]).indexOf('@') > 0) {
      valores[i][0] = nomeCorreto;
      alterados++;
    }
  }
  aba.getRange(2, col, n, 1).setValues(valores);
  visitas_limparCache_();
  return alterados + ' visita(s) atualizada(s) para "' + nomeCorreto + '".';
}

/** Testa a agenda de hoje direto pelo editor, com erro detalhado. */
function testarAgendaHoje() {
  try {
    var r = visitas_agendaDoDia_(null, 'Wanderson N. Castelo');
    Logger.log('sucesso: ' + r.sucesso);
    Logger.log('data: ' + r.data);
    Logger.log('total: ' + r.total + ' | concluidas: ' + r.concluidas);
    (r.visitas || []).forEach(function (v) {
      Logger.log('  ' + v.HORA_AGENDADA + ' - ' + v.ESCOLA + ' - ' + v.STATUS);
    });
    if (!r.total) {
      Logger.log('--- diagnostico: nenhuma visita casou o filtro ---');
      visitas_lerTodas_().forEach(function (v) {
        Logger.log('linha: data="' + v.DATA_AGENDADA + '" (ISO=' +
          visitas_dataISO_(v.DATA_AGENDADA) + ') diretor="' +
          v.DIRETOR_BASE + '" status=' + v.STATUS);
      });
      Logger.log('hoje ISO esperado: ' + Utilities.formatDate(
        new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    }
  } catch (e) {
    Logger.log('ERRO: ' + e.message);
    Logger.log(e.stack);
  }
  return 'Ver Registro de execucao.';
}

/**
 * Corrige a coluna HORA_AGENDADA: forca formato de texto e reescreve
 * as horas que o Sheets converteu em data-epoca (30/12/1899).
 */
function corrigirHorasVisitas() {
  var aba = visitas_aba_();
  var ultima = aba.getLastRow();
  var mapa = visitas_mapaCabecalho_(aba);
  var colHora = visitas_idxCol_(mapa, 'HORA_AGENDADA', 3);
  var colData = visitas_idxCol_(mapa, 'DATA_AGENDADA', 2);

  aba.getRange(2, colHora, aba.getMaxRows() - 1, 1).setNumberFormat('@');
  aba.getRange(2, colData, aba.getMaxRows() - 1, 1).setNumberFormat('@');
  if (ultima < 2) return 'Colunas formatadas. Nenhuma linha para corrigir.';

  var n = ultima - 1;
  var horas = aba.getRange(2, colHora, n, 1).getValues();
  var datas = aba.getRange(2, colData, n, 1).getValues();
  var corrigidas = 0;
  for (var i = 0; i < n; i++) {
    if (horas[i][0] instanceof Date) {
      horas[i][0] = visitas_fmtHora_(horas[i][0]);
      corrigidas++;
    }
    if (datas[i][0] instanceof Date) {
      datas[i][0] = Utilities.formatDate(
        datas[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }
  aba.getRange(2, colHora, n, 1).setValues(horas);
  aba.getRange(2, colData, n, 1).setValues(datas);
  visitas_limparCache_();
  return corrigidas + ' hora(s) corrigida(s). Colunas agora sao texto.';
}