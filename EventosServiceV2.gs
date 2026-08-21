// ============================================================================
// 📝 ARQUIVO: EventosServiceV2.gs
// 🏷️  SISGEP — Serviço administrativo de Eventos V2
// ============================================================================
//
// Orquestra autorização, validação de domínio, concorrência, auditoria e
// persistência. Nesta etapa todas as funções permanecem privadas (`_`): não há
// Controller nem endpoint acessível pelo frontend/publico.
// ============================================================================

/**
 * Salva um rascunho/registro de Evento V2.
 * Exige administrador com acesso ao módulo Eventos e ambiente homologação.
 */
function eventosV2Service_salvar_(tokenSessao, dados) {
  var sessao = eventosV2Service_exigirAdmin_(tokenSessao, 'Salvar Evento V2');
  var validacao = eventosV2_validarEvento_(dados);

  if (!validacao.ok) {
    var erro = new Error('Evento V2 inválido: ' + validacao.erros.map(function (e) {
      return e.mensagem;
    }).join(' '));
    erro.errosValidacao = validacao.erros;
    throw erro;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // Repository possui uma segunda trava de ambiente; defesa em profundidade.
    eventosV2Repo_exigirHomologacao_();

    var evento = validacao.evento;
    var agora = new Date();
    var autor = eventosV2Service_identificarAutor_(sessao);
    var anterior = evento.eventoId ? eventosV2Repo_buscarPorId_(evento.eventoId) : null;

    if (!evento.eventoId) {
      evento.eventoId = 'EVT-' + Utilities.getUuid();
    }

    // Rebusca após eventual geração de ID, preservando createdAt/createdBy.
    if (!anterior && evento.eventoId) {
      anterior = eventosV2Repo_buscarPorId_(evento.eventoId);
    }

    if (anterior) {
      evento.criadoEm = anterior.criadoEm || agora;
      evento.criadoPor = anterior.criadoPor || autor;
    } else {
      evento.criadoEm = agora;
      evento.criadoPor = autor;
    }

    evento.atualizadoEm = agora;
    evento.atualizadoPor = autor;

    var resultado = eventosV2Repo_salvar_(evento);

    eventosV2Repo_registrarAuditoria_({
      auditoriaId: 'AUD-EVT-' + Utilities.getUuid(),
      eventoId: evento.eventoId,
      acao: resultado.criado ? 'CRIAR' : 'ATUALIZAR',
      executadoEm: agora,
      executadoPor: autor,
      estadoAnterior: anterior,
      estadoNovo: resultado.evento
    });

    return {
      ok: true,
      criado: resultado.criado,
      evento: resultado.evento
    };
  } finally {
    lock.releaseLock();
  }
}

/** Busca um evento por ID para uso administrativo interno. */
function eventosV2Service_buscarPorId_(tokenSessao, eventoId) {
  eventosV2Service_exigirAdmin_(tokenSessao, 'Consultar Evento V2');
  eventosV2Repo_exigirHomologacao_();

  return {
    ok: true,
    evento: eventosV2Repo_buscarPorId_(eventoId)
  };
}

/** Lista eventos V2 para uso administrativo interno. */
function eventosV2Service_listar_(tokenSessao) {
  eventosV2Service_exigirAdmin_(tokenSessao, 'Listar Eventos V2');
  eventosV2Repo_exigirHomologacao_();

  return {
    ok: true,
    eventos: eventosV2Repo_listar_()
  };
}

/**
 * Usa a trava oficial do SISGEP. Não existe fallback permissivo.
 * `exigirAdministrador=true` porque a área V2 ainda é exclusivamente admin.
 */
function eventosV2Service_exigirAdmin_(tokenSessao, operacao) {
  if (typeof exigirModulo_ !== 'function') {
    throw new Error('Eventos V2: controle de acesso oficial do SISGEP indisponível. Operação bloqueada.');
  }

  var sessao = exigirModulo_(tokenSessao, 'eventos', true);
  if (!sessao || sessao.logado !== true) {
    throw new Error('Eventos V2: sessão administrativa inválida.');
  }

  Logger.log('Eventos V2 — ' + String(operacao || 'operação administrativa') + ' autorizada.');
  return sessao;
}

/**
 * Resolve uma identificação de auditoria sem exigir um formato específico da
 * sessão. Na ausência de e-mail/ID explícito, usa um identificador seguro e
 * não inventa identidade pessoal.
 */
function eventosV2Service_identificarAutor_(sessao) {
  sessao = sessao || {};

  var candidatos = [
    sessao.email,
    sessao.usuarioEmail,
    sessao.usuarioId,
    sessao.usuario,
    sessao.nome
  ];

  for (var i = 0; i < candidatos.length; i++) {
    var valor = String(candidatos[i] || '').trim();
    if (valor) return valor;
  }

  try {
    var emailGoogle = String(Session.getActiveUser().getEmail() || '').trim();
    if (emailGoogle) return emailGoogle;
  } catch (e) {}

  return 'SESSAO_SISGEP_AUTORIZADA';
}
