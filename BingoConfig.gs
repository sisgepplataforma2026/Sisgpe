/**
 * BINGO ONLINE — CONFIGURAÇÃO E REPOSITÓRIO BASE
 * Subfuncionalidade do módulo Eventos do SISGEP.
 *
 * Princípios:
 * - eventoId é a raiz funcional;
 * - nada de CPF como identificador principal;
 * - dados críticos ficam no servidor;
 * - homologação e produção usam namespaces lógicos separados;
 * - Firestore atual do módulo Eventos é reutilizado.
 */

var BINGO_MODULO = 'eventos';
var BINGO_VERSAO = '1.0.0';
var BINGO_TIPO_PADRAO = '75_BOLAS';

var BINGO_STATUS_EVENTO = {
  RASCUNHO: 'RASCUNHO',
  PRONTO: 'PRONTO',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  PAUSADO: 'PAUSADO',
  ENCERRADO: 'ENCERRADO',
  CANCELADO: 'CANCELADO'
};

var BINGO_STATUS_RODADA = {
  RASCUNHO: 'RASCUNHO',
  PRONTA: 'PRONTA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  PAUSADA: 'PAUSADA',
  AGUARDANDO_MANIFESTACAO: 'AGUARDANDO_MANIFESTACAO',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA'
};

var BINGO_MODALIDADES = [
  'LINHA_HORIZONTAL',
  'COLUNA',
  'DIAGONAL',
  'QUATRO_CANTOS',
  'X',
  'CARTELA_CHEIA'
];

function bingo_ambiente_() {
  try {
    return typeof getAmbienteAtual === 'function' ? String(getAmbienteAtual() || 'producao').toLowerCase() : 'producao';
  } catch (e) {
    return 'producao';
  }
}

function bingo_colecao_(nome) {
  var env = bingo_ambiente_() === 'homologacao' ? 'hml' : 'prd';
  return 'bingo_' + env + '_' + String(nome || '').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
}

function bingo_uuid_(prefixo) {
  return String(prefixo || 'BINGO') + '-' + Utilities.getUuid().toUpperCase();
}

function bingo_agoraIso_() {
  return new Date().toISOString();
}

function bingo_json_(valor) {
  return JSON.stringify(valor === undefined ? null : valor);
}

function bingo_parseJson_(valor, fallback) {
  if (valor === null || valor === undefined || valor === '') return fallback;
  if (typeof valor !== 'string') return valor;
  try { return JSON.parse(valor); } catch (e) { return fallback; }
}

function bingo_exigirAdmin_(tokenSessao) {
  return exigirModulo_(tokenSessao, BINGO_MODULO, false);
}

function bingo_hash_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto || ''), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function bingo_tokenSeguro_() {
  var bruto = Utilities.getUuid() + '-' + Utilities.getUuid() + '-' + new Date().getTime();
  return Utilities.base64EncodeWebSafe(bruto, Utilities.Charset.UTF_8).replace(/=+$/g, '');
}

function bingo_configPadrao_(eventoId) {
  return {
    eventoId: String(eventoId || ''),
    versao: BINGO_VERSAO,
    tipo: BINGO_TIPO_PADRAO,
    status: BINGO_STATUS_EVENTO.RASCUNHO,
    cartelasPorParticipante: 1,
    casaLivre: true,
    marcacaoAutomatica: true,
    avisoFaltaUmNumero: false,
    pausarAoDetectarBingo: true,
    prazoManifestacaoSegundos: 180,
    politicaEmpate: 'MULTIPLOS_VENCEDORES',
    youtubeUrl: '',
    criadoEm: bingo_agoraIso_(),
    atualizadoEm: bingo_agoraIso_()
  };
}

function bingo_salvarConfig(dados, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  dados = dados || {};
  var eventoId = String(dados.eventoId || '').trim();
  if (!eventoId) return { ok: false, mensagem: 'eventoId é obrigatório.' };

  var atual = fs_get_(bingo_colecao_('config'), eventoId) || bingo_configPadrao_(eventoId);
  var cfg = {
    eventoId: eventoId,
    versao: BINGO_VERSAO,
    tipo: String(dados.tipo || atual.tipo || BINGO_TIPO_PADRAO),
    status: String(dados.status || atual.status || BINGO_STATUS_EVENTO.RASCUNHO),
    cartelasPorParticipante: Math.max(1, parseInt(dados.cartelasPorParticipante || atual.cartelasPorParticipante || 1, 10)),
    casaLivre: dados.casaLivre === undefined ? !!atual.casaLivre : !!dados.casaLivre,
    marcacaoAutomatica: dados.marcacaoAutomatica === undefined ? true : !!dados.marcacaoAutomatica,
    avisoFaltaUmNumero: dados.avisoFaltaUmNumero === undefined ? !!atual.avisoFaltaUmNumero : !!dados.avisoFaltaUmNumero,
    pausarAoDetectarBingo: dados.pausarAoDetectarBingo === undefined ? true : !!dados.pausarAoDetectarBingo,
    prazoManifestacaoSegundos: Math.max(30, parseInt(dados.prazoManifestacaoSegundos || atual.prazoManifestacaoSegundos || 180, 10)),
    politicaEmpate: String(dados.politicaEmpate || atual.politicaEmpate || 'MULTIPLOS_VENCEDORES'),
    youtubeUrl: String(dados.youtubeUrl || atual.youtubeUrl || '').trim(),
    criadoEm: atual.criadoEm || bingo_agoraIso_(),
    atualizadoEm: bingo_agoraIso_(),
    atualizadoPor: sessao.nome || sessao.usuario || sessao.email || 'SISGEP'
  };

  fs_set_(bingo_colecao_('config'), eventoId, cfg);
  bingo_auditar_('CONFIGURACAO_SALVA', eventoId, sessao, atual, cfg);
  return { ok: true, config: cfg };
}

function bingo_obterConfig(eventoId, tokenSessao) {
  bingo_exigirAdmin_(tokenSessao);
  eventoId = String(eventoId || '').trim();
  if (!eventoId) return null;
  return fs_get_(bingo_colecao_('config'), eventoId) || bingo_configPadrao_(eventoId);
}

function bingo_criarRodada(dados, tokenSessao) {
  var sessao = bingo_exigirAdmin_(tokenSessao);
  dados = dados || {};
  var eventoId = String(dados.eventoId || '').trim();
  if (!eventoId) return { ok: false, mensagem: 'eventoId é obrigatório.' };

  var modalidade = String(dados.modalidade || 'CARTELA_CHEIA').toUpperCase();
  if (BINGO_MODALIDADES.indexOf(modalidade) < 0) return { ok: false, mensagem: 'Modalidade inválida.' };

  var rodadaId = bingo_uuid_('ROD');
  var rodada = {
    rodadaId: rodadaId,
    eventoId: eventoId,
    nome: String(dados.nome || 'Rodada').trim(),
    descricao: String(dados.descricao || '').trim(),
    modalidade: modalidade,
    premioId: String(dados.premioId || '').trim(),
    premioDescricao: String(dados.premioDescricao || '').trim(),
    status: BINGO_STATUS_RODADA.RASCUNHO,
    usaCasaLivre: dados.usaCasaLivre === undefined ? true : !!dados.usaCasaLivre,
    prazoManifestacaoSegundos: Math.max(30, parseInt(dados.prazoManifestacaoSegundos || 180, 10)),
    politicaEmpate: String(dados.politicaEmpate || 'MULTIPLOS_VENCEDORES'),
    sequenciaAtual: 0,
    versaoEstado: 1,
    criadoEm: bingo_agoraIso_(),
    criadoPor: sessao.nome || sessao.usuario || sessao.email || 'SISGEP'
  };

  fs_set_(bingo_colecao_('rodadas'), rodadaId, rodada);
  bingo_auditar_('RODADA_CRIADA', rodadaId, sessao, null, rodada);
  return { ok: true, rodada: rodada };
}

function bingo_obterRodada_(rodadaId) {
  return fs_get_(bingo_colecao_('rodadas'), String(rodadaId || '').trim());
}

function bingo_salvarRodada_(rodada) {
  if (!rodada || !rodada.rodadaId) throw new Error('Rodada inválida.');
  var salvo = fs_set_(bingo_colecao_('rodadas'), rodada.rodadaId, rodada);
  if (typeof bingo_publicarEstadoRodada_ === 'function') bingo_publicarEstadoRodada_(rodada);
  return salvo;
}
