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

/* ═══ A PORTA QUE FALTAVA — 26/08/2026 ═════════════════════════════════════
   Até aqui este arquivo só sabia da Festa 2026: dois endpoints, ambos com
   "Festa2026" no nome. `eventosV2Service_listar_` existia e NINGUÉM o
   chamava — ou seja, o sistema guardava eventos e não tinha como mostrá-los
   nem como criar o segundo.

   Isso é o que impedia a tela de Eventos (a lista aprovada em 25/08) e o que
   trancava o módulo na Festa. Medido em `tests/e2e/t96-evento-manda.js`.

   As duas funções abaixo são a porta. A segurança não muda de lugar: quem
   exige administrador e sessão continua sendo o Service, e o Repository
   continua recusando operar fora de homologação. */

/**
 * Lista os eventos do sindicato para a tela de Eventos.
 * Devolve `{ ok, eventos: [...] }` — nunca lança para a tela.
 */
function eventosV2Admin_listarEventos(tokenSessao) {
  try {
    var resultado = eventosV2Service_listar_(tokenSessao);
    var eventos = (resultado && Array.isArray(resultado.eventos)) ? resultado.eventos : [];

    return {
      ok: true,
      eventos: eventos.map(eventosV2Admin_payloadLista_)
    };
  } catch (e) {
    Logger.log('Eventos V2 — erro ao listar eventos: ' + e);
    return { ok: false, eventos: [], mensagem: eventosV2Admin_mensagemErro_(e) };
  }
}

/**
 * Cria um evento novo — assembleia, curso, o que for.
 *
 * Nasce em RASCUNHO de propósito: evento recém-criado não pode aparecer como
 * "inscrições abertas" antes de alguém conferir data, local e lotação. Quem
 * abre as inscrições é uma decisão à parte, com auditoria própria.
 */
function eventosV2Admin_criarEvento(tokenSessao, dados) {
  dados = dados || {};
  try {
    var salvo = eventosV2Service_salvar_(tokenSessao, {
      /* Sem eventoId: o Service gera. Passar um id vindo da tela deixaria a
         criação virar edição silenciosa de outro evento. */
      tipo: dados.tipo || EVENTOS_V2_TIPOS.FESTA,
      nome: dados.nome,
      edicao: dados.edicao,
      ano: dados.ano,
      descricao: dados.descricao,
      dataEvento: dados.dataEvento,
      horaAbertura: dados.horaAbertura,
      horaInicio: dados.horaInicio,
      horaEncerramento: dados.horaEncerramento,
      localNome: dados.localNome,
      endereco: dados.endereco,
      capacidade: dados.capacidade,
      status: EVENTOS_V2_STATUS.RASCUNHO
    });

    return {
      ok: true,
      mensagem: 'Evento criado como rascunho.',
      evento: eventosV2Admin_payloadLista_(salvo.evento)
    };
  } catch (e) {
    Logger.log('Eventos V2 — erro ao criar evento: ' + e);
    return {
      ok: false,
      mensagem: eventosV2Admin_mensagemErro_(e),
      errosValidacao: e && e.errosValidacao ? e.errosValidacao : []
    };
  }
}

/**
 * O que a tela de LISTA precisa — e só isso.
 *
 * Separado do payload de Informações de propósito: aquele é a ficha pública
 * do evento e não expõe capacidade; este é administrativo, e a lotação é
 * justamente a coluna que a lista precisa mostrar.
 */
function eventosV2Admin_payloadLista_(evento) {
  evento = evento || {};
  return {
    eventoId: String(evento.eventoId || ''),
    tipo: String(evento.tipo || ''),
    nome: String(evento.nome || ''),
    ano: Number(evento.ano) || 0,
    dataEvento: eventosV2Admin_dataCivil_(evento.dataEvento),
    localNome: String(evento.localNome || ''),
    capacidade: Number(evento.capacidade) || 0,
    status: String(evento.status || EVENTOS_V2_STATUS.RASCUNHO)
  };
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
