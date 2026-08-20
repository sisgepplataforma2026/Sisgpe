/**
 * COMPASSO 2026 — Identidade, validação e auditoria
 * Camada transversal dos quatro pilares.
 */
var COMPASSO_STATUS = {
  RECEBIDA: 'RECEBIDA',
  PRE_VALIDADA: 'PRE_VALIDADA',
  EM_ANALISE: 'EM_ANALISE',
  PENDENTE: 'PENDENTE',
  VALIDADA: 'VALIDADA_ADMINISTRATIVAMENTE',
  REPROVADA: 'REPROVADA'
};

var COMPASSO_MOTIVOS_REPROVACAO = [
  'NAO_LOCALIZADO_ASSOCIADO', 'NAO_E_ASSOCIADO', 'VINCULO_NAO_CONFIRMADO',
  'INSCRICAO_DUPLICADA', 'DADOS_INCONSISTENTES', 'NAO_ATENDE_REGRAS_EVENTO',
  'INSCRICAO_INDEVIDA', 'SOLICITACAO_ASSOCIADO', 'OUTRO'
];

var COMPASSO_MOTIVOS_PENDENCIA = [
  'AGUARDANDO_CONFIRMACAO_VINCULO', 'ASSOCIADO_RECENTE', 'DADOS_DIVERGENTES',
  'AGUARDANDO_CONTATO_ASSOCIADO', 'AGUARDANDO_CONFIRMACAO_ESCOLA',
  'AGUARDANDO_DOCUMENTO_COMPROVACAO', 'OUTRO'
];

function compasso_uuid_() { return Utilities.getUuid(); }
function compasso_cpfNormalizado_(cpf) { return String(cpf || '').replace(/\D/g, ''); }
function compasso_emailUsuario_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'usuario-nao-identificado';
}
function compasso_hash_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto));
  return bytes.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
}
function compasso_chavePessoaEvento_(eventoId, pessoaId, cpf) {
  var identidade = pessoaId || compasso_cpfNormalizado_(cpf);
  if (!identidade) throw new Error('Pessoa sem identificador confiável (pessoaId/CPF).');
  return compasso_hash_(eventoId + '|' + identidade);
}

function compasso_auditar_(acao, entidadeTipo, entidadeId, detalhes) {
  var id = compasso_uuid_();
  fs_set_('auditoriaEventos', id, {
    auditoriaId: id,
    eventoId: EMISSAO_CFG.EVENTO_ID,
    acao: acao,
    entidadeTipo: entidadeTipo,
    entidadeId: entidadeId || '',
    usuario: compasso_emailUsuario_(),
    em: new Date(),
    detalhesJson: JSON.stringify(detalhes || {})
  });
  return id;
}

/** Reserva identidade única por evento. Deve ser chamada dentro de ScriptLock. */
function compasso_reservarIdentidade_(payload, ingressoId) {
  var chave = compasso_chavePessoaEvento_(EMISSAO_CFG.EVENTO_ID, payload.pessoaId, payload.cpf);
  var atual = fs_get_('eventoIdentidades', chave);
  if (atual && atual.status !== 'CANCELADA') {
    return { ok:false, erro:'Esta pessoa já possui inscrição/ingresso válido neste evento.', existente:atual };
  }
  fs_set_('eventoIdentidades', chave, {
    eventoId: EMISSAO_CFG.EVENTO_ID,
    pessoaId: payload.pessoaId || '',
    cpfHash: compasso_hash_(compasso_cpfNormalizado_(payload.cpf)),
    ingressoId: ingressoId,
    status: 'ATIVA',
    criadoEm: new Date()
  });
  return { ok:true, chave:chave };
}

function compasso_liberarIdentidade_(ingresso) {
  try {
    var chave = compasso_chavePessoaEvento_(ingresso.eventoId, ingresso.pessoaId, ingresso.cpf);
    var ident = fs_get_('eventoIdentidades', chave);
    if (ident) {
      ident.status = 'CANCELADA';
      ident.canceladaEm = new Date();
      fs_set_('eventoIdentidades', chave, ident);
    }
  } catch(e) { Logger.log('Falha ao liberar identidade: '+e.message); }
}

function compasso_validarDecisaoAdmin(inscricaoId, novoStatus, motivoCodigo, observacao) {
  var permitidos = [COMPASSO_STATUS.VALIDADA, COMPASSO_STATUS.PENDENTE, COMPASSO_STATUS.REPROVADA];
  if (permitidos.indexOf(novoStatus) < 0) throw new Error('Status administrativo inválido.');
  if (novoStatus === COMPASSO_STATUS.REPROVADA && COMPASSO_MOTIVOS_REPROVACAO.indexOf(motivoCodigo) < 0)
    throw new Error('Selecione um motivo de reprovação válido.');
  if (novoStatus === COMPASSO_STATUS.PENDENTE && COMPASSO_MOTIVOS_PENDENCIA.indexOf(motivoCodigo) < 0)
    throw new Error('Selecione um motivo de pendência válido.');
  if (motivoCodigo === 'OUTRO' && !String(observacao || '').trim())
    throw new Error('Descreva o motivo quando selecionar Outro.');

  var ins = fs_get_('inscricoesEventos', inscricaoId);
  if (!ins) throw new Error('Inscrição não encontrada.');
  var anterior = ins.status || '';
  ins.status = novoStatus;
  ins.analisadoPor = compasso_emailUsuario_();
  ins.analisadoEm = new Date();
  ins.motivoCodigo = motivoCodigo || '';
  ins.observacaoAnalise = String(observacao || '').trim();
  fs_set_('inscricoesEventos', inscricaoId, ins);
  compasso_auditar_('VALIDACAO_ADMINISTRATIVA','inscricao',inscricaoId,{de:anterior,para:novoStatus,motivo:motivoCodigo,observacao:observacao||''});
  return {ok:true, inscricaoId:inscricaoId, status:novoStatus};
}
