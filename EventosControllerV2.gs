// ============================================================================
// 📝 ARQUIVO: EventosControllerV2.gs
// 🏷️  SISGEP — Controller administrativo de Eventos V2
// ============================================================================
//
// ÚNICO papel deste arquivo: expor ao frontend administrativo operações
// estritamente necessárias para a tela "Festa 2026 > Informações".
//
// SEGURANÇA
// - não existe endpoint público/associado neste arquivo;
// - toda leitura e gravação passa pelo EventosServiceV2, que exige sessão de
//   administrador + acesso ao módulo Eventos;
// - o Repository V2 continua bloqueado fora de HOMOLOGAÇÃO;
// - nenhum indicador gerencial (capacidade, vagas, inscritos, check-ins etc.)
//   integra o payload desta tela.
// ============================================================================

/**
 * Carrega a Festa 2026 para a tela administrativa de Informações.
 * Se ainda não existir registro V2, devolve somente um modelo em memória —
 * nada é gravado até o administrador clicar em Salvar rascunho.
 */
function eventosV2Admin_obterFesta2026(tokenSessao) {
  try {
    var resultado = eventosV2Service_listar_(tokenSessao);
    var eventos = (resultado && Array.isArray(resultado.eventos)) ? resultado.eventos : [];
    var festa = null;

    for (var i = 0; i < eventos.length; i++) {
      var item = eventos[i] || {};
      if (String(item.tipo || '').toUpperCase() === 'FESTA' && Number(item.ano) === 2026) {
        festa = item;
        break;
      }
    }

    if (!festa) {
      festa = eventosV2_normalizarEvento_({
        tipo: EVENTOS_V2_TIPOS.FESTA,
        nome: 'Festa Compasso da Vida 2026',
        edicao: '2026',
        ano: 2026,
        status: EVENTOS_V2_STATUS.RASCUNHO
      });
    }

    return {
      ok: true,
      persistido: !!String(festa.eventoId || '').trim(),
      evento: eventosV2Admin_payloadInformacoes_(festa)
    };
  } catch (e) {
    Logger.log('Eventos V2 — erro ao carregar Festa 2026: ' + e);
    return {
      ok: false,
      mensagem: eventosV2Admin_mensagemErro_(e)
    };
  }
}

/**
 * Salva as Informações da Festa 2026.
 * Para registro novo o status nasce RASCUNHO. Em registro já existente o
 * status atual é preservado: editar uma descrição nunca deve, sozinho,
 * republicar, cancelar ou rebaixar o ciclo de vida do evento.
 */
function eventosV2Admin_salvarInformacoesFesta2026(tokenSessao, dados) {
  try {
    dados = dados || {};

    // A consulta também aplica autorização e trava de ambiente.
    var atual = null;
    var eventoId = String(dados.eventoId || '').trim();
    if (eventoId) {
      var busca = eventosV2Service_buscarPorId_(tokenSessao, eventoId);
      atual = busca ? busca.evento : null;
      if (!atual) {
        throw new Error('O evento informado não foi encontrado na base V2 de homologação.');
      }
      if (String(atual.tipo || '').toUpperCase() !== 'FESTA' || Number(atual.ano) !== 2026) {
        throw new Error('O registro informado não corresponde à Festa 2026.');
      }
    }

    var entrada = {
      eventoId: eventoId,
      tipo: EVENTOS_V2_TIPOS.FESTA,
      eventoVinculadoId: '',
      nome: dados.nome,
      edicao: dados.edicao || '2026',
      ano: 2026,
      logoUrl: dados.logoUrl,
      imagemCapaUrl: dados.imagemCapaUrl,
      descricao: dados.descricao,
      dataEvento: dados.dataEvento,
      horaAbertura: dados.horaAbertura,
      horaInicio: dados.horaInicio,
      horaEncerramento: dados.horaEncerramento,
      localNome: dados.localNome,
      endereco: dados.endereco,
      orientacoes: dados.orientacoes,
      informacoesImportantes: dados.informacoesImportantes,
      status: atual && atual.status ? atual.status : EVENTOS_V2_STATUS.RASCUNHO
    };

    var salvo = eventosV2Service_salvar_(tokenSessao, entrada);
    return {
      ok: true,
      criado: !!(salvo && salvo.criado),
      mensagem: salvo && salvo.criado
        ? 'Rascunho da Festa 2026 criado com sucesso.'
        : 'Informações da Festa 2026 atualizadas com sucesso.',
      evento: eventosV2Admin_payloadInformacoes_(salvo.evento)
    };
  } catch (e) {
    Logger.log('Eventos V2 — erro ao salvar Festa 2026: ' + e);
    return {
      ok: false,
      mensagem: eventosV2Admin_mensagemErro_(e),
      errosValidacao: e && e.errosValidacao ? e.errosValidacao : []
    };
  }
}

/**
 * Whitelist explícita do que a tela de Informações pode receber.
 * Não retorne o objeto inteiro do Repository: novos campos administrativos
 * acrescentados no futuro não devem vazar automaticamente para o frontend.
 */
function eventosV2Admin_payloadInformacoes_(evento) {
  evento = evento || {};
  return {
    eventoId: String(evento.eventoId || ''),
    tipo: String(evento.tipo || 'FESTA'),
    nome: String(evento.nome || ''),
    edicao: String(evento.edicao || ''),
    ano: Number(evento.ano) || 2026,
    logoUrl: String(evento.logoUrl || ''),
    imagemCapaUrl: String(evento.imagemCapaUrl || ''),
    descricao: String(evento.descricao || ''),
    dataEvento: eventosV2Admin_dataCivil_(evento.dataEvento),
    horaAbertura: String(evento.horaAbertura || ''),
    horaInicio: String(evento.horaInicio || ''),
    horaEncerramento: String(evento.horaEncerramento || ''),
    localNome: String(evento.localNome || ''),
    endereco: String(evento.endereco || ''),
    orientacoes: String(evento.orientacoes || ''),
    informacoesImportantes: String(evento.informacoesImportantes || ''),
    status: String(evento.status || EVENTOS_V2_STATUS.RASCUNHO)
  };
}

/** Mantém YYYY-MM-DD estável mesmo quando Sheets devolver um Date. */
function eventosV2Admin_dataCivil_(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  return String(valor).trim();
}

/** Mensagem segura para o usuário administrativo, sem stack trace. */
function eventosV2Admin_mensagemErro_(erro) {
  var mensagem = erro && erro.message ? String(erro.message) : 'Não foi possível concluir a operação.';
  return mensagem.length > 420 ? mensagem.slice(0, 417) + '...' : mensagem;
}
