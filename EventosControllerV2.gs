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

    /* SEM ID, ADOTA A FESTA QUE JÁ EXISTE — 26/08/2026.
     *
     * Até aqui, salvar sem `eventoId` criava registro NOVO. A tela sempre
     * manda o id, então no uso normal não aparecia; mas qualquer chamada sem
     * ele — outra tela, um teste, uma rotina — passava a existir uma SEGUNDA
     * Festa 2026 na base. E aí `obterFesta2026` devolve a primeira que
     * encontrar: a tela mostra uma, a lotação vem da outra, e nada acusa.
     *
     * Achado ao escrever o teste do caminho da lotação, que salvou sem id e
     * recebeu "criado com sucesso" onde deveria vir "atualizado".
     *
     * A busca é a MESMA regra do carregamento — tipo FESTA e ano 2026 —,
     * porque as duas pontas precisam concordar sobre qual registro é a Festa. */
    if (!eventoId) {
      var lista = eventosV2Service_listar_(tokenSessao);
      var todos = (lista && Array.isArray(lista.eventos)) ? lista.eventos : [];
      for (var f = 0; f < todos.length; f++) {
        var cand = todos[f] || {};
        if (String(cand.tipo || '').toUpperCase() === 'FESTA' && Number(cand.ano) === 2026) {
          eventoId = String(cand.eventoId || '').trim();
          atual = cand;
          break;
        }
      }
    }

    if (eventoId && !atual) {
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
      /* Campo em branco NÃO apaga a lotação já gravada — 26/08/2026.
         A tela manda string vazia quando o administrador não digitou nada, e
         zerar por omissão devolveria o evento à constante sem ninguém pedir.
         Só um número explícito muda a lotação. */
      capacidade: (String(dados.capacidade || '').trim() === '' && atual)
                    ? atual.capacidade
                    : dados.capacidade,
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
    /* Capacidade entra AQUI e não no payload público — 26/08/2026.
       Esta tela é administrativa: exige sessão de administrador com acesso ao
       módulo. A nota de privacidade do domínio continua valendo para a página
       pública do evento, que é outra superfície e não usa este payload. */
    capacidade: Number(evento.capacidade) || 0,
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

/* ════════════════════════════════════════════════════════════════════════════
   A SITUAÇÃO DO EVENTO — porta administrativa, 26/08/2026

   O botão "Publicar evento" estava na tela desde 21/08, desligado, com o
   aviso de que a transição não fora validada. O usuário: "Ele não deixa eu
   publicar, é assim mesmo?". Era — e agora deixa.

   O QUE NÃO ENTROU, e é decisão registrada do usuário: a trava do link
   público. Hoje o formulário de inscrição não consulta o status do evento, e
   perguntado se a trava deveria entrar junto, ele respondeu: "Como estou em
   período de teste, deve estar aberto para testes". Então a transição grava e
   governa a tela administrativa; o link continua aceitando inscrição em
   qualquer situação. O lugar onde essa trava entraria, quando ele pedir, é
   `compasso_criarInscricaoAssociado` — que já lê o registro V2 para pegar data
   e capacidade, e passaria a ler `status` também.
   ════════════════════════════════════════════════════════════════════════════ */

/** Situação atual + para onde dá para ir + o que falta para publicar. */
function eventosV2Admin_situacaoFesta2026(tokenSessao) {
  var evento = eventosV2Admin_festaAtual_(tokenSessao);
  if (!evento) return { ok: false, erro: 'A Festa 2026 ainda não foi criada.' };

  var atual = String(evento.status || EVENTOS_V2_STATUS.RASCUNHO).toUpperCase();
  return {
    ok: true,
    eventoId: String(evento.eventoId || ''),
    status: atual,
    rotulo: EVENTOS_V2_STATUS_ROTULO[atual] || atual,
    /* Só os destinos ALCANÇÁVEIS daqui — a tela desenha um botão por destino,
       e oferecer o que o Service vai recusar é convite ao clique inútil. */
    proximos: (EVENTOS_V2_TRANSICOES[atual] || []).map(function (s) {
      return { status: s, rotulo: EVENTOS_V2_STATUS_ROTULO[s] || s };
    }),
    pendenciasParaPublicar: eventosV2_pendenciasParaPublicar_(evento),
    motivoSituacao: String(evento.motivoSituacao || '')
  };
}

/** Muda a situação da Festa 2026. `motivo` é obrigatório no cancelamento. */
function eventosV2Admin_mudarSituacaoFesta2026(tokenSessao, novoStatus, motivo) {
  var evento = eventosV2Admin_festaAtual_(tokenSessao);
  if (!evento) return { ok: false, erro: 'A Festa 2026 ainda não foi criada.' };
  try {
    return eventosV2Service_mudarStatus_(tokenSessao, evento.eventoId, novoStatus, motivo);
  } catch (e) {
    return { ok: false, erro: eventosV2Admin_mensagemErro_(e) };
  }
}

/** O registro da Festa 2026, num lugar só — as duas funções acima precisam. */
function eventosV2Admin_festaAtual_(tokenSessao) {
  /* `eventosV2Service_listar_` devolve {ok, eventos}, NÃO um array. Tratá-lo
     como array não estoura: `undefined || []` vira lista vazia e a função
     responde "a Festa ainda não foi criada" sobre uma Festa que existe. Falha
     silenciosa, do tipo que só o teste acha — foi o t99 que achou esta. */
  var resposta = eventosV2Service_listar_(tokenSessao) || {};
  var lista = resposta.eventos || [];
  for (var i = 0; i < lista.length; i++) {
    var e = lista[i];
    if (String(e.tipo) === String(EVENTOS_V2_TIPOS.FESTA) && Number(e.ano) === 2026) return e;
  }
  return null;
}
