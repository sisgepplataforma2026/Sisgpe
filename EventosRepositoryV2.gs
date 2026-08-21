// ============================================================================
// 📝 ARQUIVO: EventosRepositoryV2.gs
// 🏷️  SISGEP — Persistência de Eventos V2 (HOMOLOGAÇÃO)
// ============================================================================
//
// Responsabilidade exclusiva: acesso aos dados da entidade Evento V2.
// Não contém regra de negócio, autorização de usuário ou endpoint público.
//
// SEGURANÇA DE AMBIENTE
// Toda operação de leitura/escrita deste repository exige que o ambiente atual
// seja HOMOLOGAÇÃO. Se SISGEP_AMBIENTE estiver ausente, inválido ou apontando
// para produção, a operação é recusada antes de abrir a planilha.
//
// As abas são criadas sob demanda somente quando uma operação autorizada da
// camada Service for executada. A simples presença deste arquivo não altera
// nenhuma planilha.
// ============================================================================

var EVENTOS_V2_ABA = 'EVENTOS_V2';
var EVENTOS_V2_ABA_AUDITORIA = 'EVENTOS_V2_AUDITORIA';

var EVENTOS_V2_CABECALHOS = [
  'eventoId', 'tipo', 'eventoVinculadoId', 'nome', 'edicao', 'ano',
  'logoUrl', 'imagemCapaUrl', 'descricao', 'dataEvento',
  'horaAbertura', 'horaInicio', 'horaEncerramento',
  'localNome', 'endereco', 'orientacoes', 'informacoesImportantes',
  'status', 'criadoEm', 'atualizadoEm', 'criadoPor', 'atualizadoPor'
];

var EVENTOS_V2_AUDITORIA_CABECALHOS = [
  'auditoriaId', 'eventoId', 'acao', 'executadoEm', 'executadoPor',
  'estadoAnteriorJson', 'estadoNovoJson'
];

/** Abre exclusivamente a planilha de homologação. */
function eventosV2Repo_planilha_() {
  eventosV2Repo_exigirHomologacao_();

  if (typeof getPlanilhaId !== 'function') {
    throw new Error('Eventos V2: getPlanilhaId() indisponível. Persistência bloqueada.');
  }

  var id = String(getPlanilhaId('homologacao') || '').trim();
  if (!id) {
    throw new Error('Eventos V2: ID da planilha de homologação não configurado.');
  }

  return SpreadsheetApp.openById(id);
}

/**
 * Trava contra contaminação da produção.
 * Falha fechada: qualquer dúvida sobre o ambiente impede a operação.
 */
function eventosV2Repo_exigirHomologacao_() {
  var ambiente = '';

  if (typeof getAmbienteAtual === 'function') {
    ambiente = String(getAmbienteAtual() || '').trim().toLowerCase();
  } else if (typeof recursos_ambienteAtual_ === 'function') {
    ambiente = String(recursos_ambienteAtual_() || '').trim().toLowerCase();
  }

  if (ambiente !== 'homologacao') {
    throw new Error(
      'Eventos V2: operação bloqueada. Esta camada de persistência está ' +
      'habilitada somente em HOMOLOGAÇÃO. Ambiente resolvido: ' +
      (ambiente || '(não identificado)') + '.'
    );
  }
}

/** Retorna a aba canônica de Eventos V2, criando-a se necessário. */
function eventosV2Repo_abaEventos_() {
  return eventosV2Repo_garantirAba_(
    eventosV2Repo_planilha_(),
    EVENTOS_V2_ABA,
    EVENTOS_V2_CABECALHOS
  );
}

/** Retorna a aba de trilha de auditoria, criando-a se necessário. */
function eventosV2Repo_abaAuditoria_() {
  return eventosV2Repo_garantirAba_(
    eventosV2Repo_planilha_(),
    EVENTOS_V2_ABA_AUDITORIA,
    EVENTOS_V2_AUDITORIA_CABECALHOS
  );
}

/** Cria uma aba com cabeçalho determinístico ou valida a estrutura existente. */
function eventosV2Repo_garantirAba_(ss, nome, cabecalhos) {
  var aba = ss.getSheetByName(nome);

  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos])
      .setFontWeight('bold');
    aba.setFrozenRows(1);
    return aba;
  }

  var ultimaColuna = aba.getLastColumn();
  if (ultimaColuna === 0) {
    aba.getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos])
      .setFontWeight('bold');
    aba.setFrozenRows(1);
    return aba;
  }

  if (ultimaColuna < cabecalhos.length) {
    throw new Error(
      'Eventos V2: estrutura da aba ' + nome +
      ' é incompatível com o schema esperado. Nenhuma gravação foi realizada.'
    );
  }

  var atuais = aba.getRange(1, 1, 1, cabecalhos.length).getValues()[0]
    .map(function (v) { return String(v || '').trim(); });

  for (var i = 0; i < cabecalhos.length; i++) {
    if (atuais[i] !== cabecalhos[i]) {
      throw new Error(
        'Eventos V2: cabeçalho incompatível na aba ' + nome +
        ', coluna ' + (i + 1) + '. Esperado "' + cabecalhos[i] +
        '", encontrado "' + atuais[i] + '". Gravação bloqueada.'
      );
    }
  }

  return aba;
}

/** Busca um evento por ID. Retorna null quando não encontrado. */
function eventosV2Repo_buscarPorId_(eventoId) {
  var id = String(eventoId || '').trim();
  if (!id) return null;

  var aba = eventosV2Repo_abaEventos_();
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;

  var valores = aba.getRange(2, 1, ultimaLinha - 1, EVENTOS_V2_CABECALHOS.length).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0] || '').trim() === id) {
      return eventosV2Repo_linhaParaObjeto_(valores[i]);
    }
  }
  return null;
}

/** Lista todos os eventos persistidos na V2. */
function eventosV2Repo_listar_() {
  var aba = eventosV2Repo_abaEventos_();
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  return aba
    .getRange(2, 1, ultimaLinha - 1, EVENTOS_V2_CABECALHOS.length)
    .getValues()
    .filter(function (linha) { return !!String(linha[0] || '').trim(); })
    .map(eventosV2Repo_linhaParaObjeto_);
}

/**
 * Upsert por eventoId.
 * Retorna { criado, evento } e não registra auditoria por conta própria.
 */
function eventosV2Repo_salvar_(evento) {
  if (!evento || !String(evento.eventoId || '').trim()) {
    throw new Error('Eventos V2: eventoId é obrigatório para persistência.');
  }

  var aba = eventosV2Repo_abaEventos_();
  var linhaNova = eventosV2Repo_objetoParaLinha_(evento);
  var ultimaLinha = aba.getLastRow();

  if (ultimaLinha >= 2) {
    var ids = aba.getRange(2, 1, ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim() === String(evento.eventoId).trim()) {
        aba.getRange(i + 2, 1, 1, linhaNova.length).setValues([linhaNova]);
        return { criado: false, evento: eventosV2Repo_linhaParaObjeto_(linhaNova) };
      }
    }
  }

  aba.appendRow(linhaNova);
  return { criado: true, evento: eventosV2Repo_linhaParaObjeto_(linhaNova) };
}

/** Registra uma entrada imutável de auditoria administrativa. */
function eventosV2Repo_registrarAuditoria_(registro) {
  registro = registro || {};
  var aba = eventosV2Repo_abaAuditoria_();

  aba.appendRow([
    String(registro.auditoriaId || '').trim(),
    String(registro.eventoId || '').trim(),
    String(registro.acao || '').trim(),
    registro.executadoEm || new Date(),
    String(registro.executadoPor || '').trim(),
    JSON.stringify(registro.estadoAnterior || null),
    JSON.stringify(registro.estadoNovo || null)
  ]);
}

function eventosV2Repo_objetoParaLinha_(evento) {
  return EVENTOS_V2_CABECALHOS.map(function (campo) {
    var valor = evento[campo];
    return valor == null ? '' : valor;
  });
}

function eventosV2Repo_linhaParaObjeto_(linha) {
  var obj = {};
  EVENTOS_V2_CABECALHOS.forEach(function (campo, i) {
    obj[campo] = linha[i] == null ? '' : linha[i];
  });
  return obj;
}
