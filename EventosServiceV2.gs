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

/**
 * MUDA A SITUAÇÃO DO EVENTO — 26/08/2026.
 *
 * Não passa por `eventosV2Service_salvar_` de propósito, e o motivo importa:
 * salvar reescreve o evento inteiro a partir do que a tela mandou. Mudar
 * situação precisa tocar UM campo sobre o que está gravado agora. Fossem a
 * mesma porta, publicar um evento com a tela desatualizada apagaria em
 * silêncio a edição que outra pessoa acabou de fazer.
 *
 * A trava de transição vive no domínio (EVENTOS_V2_TRANSICOES) e é reconferida
 * aqui DENTRO do lock, contra o estado relido do repositório — nunca contra o
 * que o navegador achava que era o status. Sem isso, dois cliques quase
 * simultâneos em "Publicar" passariam os dois pela mesma checagem.
 */
function eventosV2Service_mudarStatus_(tokenSessao, eventoId, novoStatus, motivo) {
  var sessao = eventosV2Service_exigirAdmin_(tokenSessao, 'Mudar situação do Evento V2');

  eventoId = eventosV2_texto_(eventoId);
  if (!eventoId) throw new Error('Informe o evento cuja situação vai mudar.');
  novoStatus = eventosV2_texto_(novoStatus).toUpperCase();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    eventosV2Repo_exigirHomologacao_();

    var evento = eventosV2Repo_buscarPorId_(eventoId);
    if (!evento) throw new Error('Evento não encontrado.');

    var atual = eventosV2_texto_(evento.status || EVENTOS_V2_STATUS.RASCUNHO).toUpperCase();
    var permitida = eventosV2_transicaoPermitida_(atual, novoStatus);
    if (!permitida.ok) return { ok: false, erro: permitida.mensagem, status: atual };

    /* Publicar é a única transição com exigência de conteúdo: sair do rascunho
       é o momento em que o evento passa a ser lido por gente de fora. */
    if (novoStatus === EVENTOS_V2_STATUS.PROGRAMADO) {
      var faltam = eventosV2_pendenciasParaPublicar_(evento);
      if (faltam.length) {
        return { ok: false, status: atual, pendencias: faltam,
                 erro: 'Antes de publicar, preencha: ' + faltam.join(', ') + '.' };
      }
    }

    /* Cancelar sem motivo escrito é o registro que ninguém consegue explicar
       depois — e cancelamento é exatamente o que se pergunta meses depois. */
    motivo = eventosV2_texto_(motivo);
    if (novoStatus === EVENTOS_V2_STATUS.CANCELADO && !motivo)
      return { ok: false, status: atual, erro: 'Escreva o motivo do cancelamento.' };

    var agora = new Date();
    var autor = eventosV2Service_identificarAutor_(sessao);
    var anterior = JSON.parse(JSON.stringify(evento));

    evento.status = novoStatus;
    evento.atualizadoEm = agora;
    evento.atualizadoPor = autor;
    if (motivo) evento.motivoSituacao = motivo;

    var resultado = eventosV2Repo_salvar_(evento);

    eventosV2Repo_registrarAuditoria_({
      auditoriaId: 'AUD-EVT-' + Utilities.getUuid(),
      eventoId: evento.eventoId,
      acao: 'MUDAR_STATUS',
      executadoEm: agora,
      executadoPor: autor,
      estadoAnterior: anterior,
      estadoNovo: resultado.evento
    });

    return { ok: true, status: novoStatus, de: atual, evento: resultado.evento };
  } finally {
    lock.releaseLock();
  }
}
