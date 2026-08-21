// ============================================================================
// 📝 ARQUIVO: EventosDominioV2.gs
// 🏷️  SISGEP — Domínio base de Eventos V2
// ============================================================================
//
// OBJETIVO
//
// Define a entidade canônica de Evento/Festa que será usada pela evolução do
// módulo de Eventos. Este arquivo nasce EM PARALELO ao fluxo atual do Compasso
// da Vida e, nesta etapa, NÃO substitui rotas, telas, inscrições, ingressos,
// QR Code, reservas de vagas ou qualquer persistência já existente.
//
// A primeira aplicação da entidade será a área administrativa
// "Identidade e Informações Gerais" da Festa, concentrando em um único lugar
// os dados institucionais que depois poderão ser reutilizados por inscrição,
// ingresso, credenciamento, comunicação, documentos e relatórios.
//
// IMPORTANTE — PRIVACIDADE
//
// Capacidade, vagas restantes, quantidade de inscritos, aprovados, pendentes,
// acompanhantes, check-ins e demais indicadores gerenciais NÃO pertencem a
// esta entidade de informações institucionais. Esses dados são administrativos
// e devem permanecer em serviços/payloads protegidos.
//
// IMPORTANTE — COMPATIBILIDADE
//
// As funções deste arquivo terminam com "_" para não criarem novos endpoints
// chamáveis diretamente pelo frontend nesta etapa. Persistência, Controller e
// UI serão ligados somente depois de validado o padrão administrativo atual.
// ============================================================================

var EVENTOS_V2_TIPOS = Object.freeze({
  FESTA: 'FESTA',
  BINGO: 'BINGO',
  OUTRO: 'OUTRO'
});

var EVENTOS_V2_STATUS = Object.freeze({
  RASCUNHO: 'RASCUNHO',
  PROGRAMADO: 'PROGRAMADO',
  INSCRICOES_ABERTAS: 'INSCRICOES_ABERTAS',
  INSCRICOES_ENCERRADAS: 'INSCRICOES_ENCERRADAS',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  ENCERRADO: 'ENCERRADO',
  CANCELADO: 'CANCELADO'
});

/**
 * Cria a representação normalizada da entidade Evento V2.
 *
 * `eventoVinculadoId` é opcional e prepara o domínio para atividades que podem
 * existir sozinhas ou vinculadas a outro evento (ex.: um bingo especial da
 * Festa), sem transformar Bingo em parte fixa da Festa.
 */
function eventosV2_normalizarEvento_(dados) {
  dados = dados || {};

  return {
    eventoId: eventosV2_texto_(dados.eventoId),
    tipo: eventosV2_texto_(dados.tipo || EVENTOS_V2_TIPOS.FESTA).toUpperCase(),
    eventoVinculadoId: eventosV2_texto_(dados.eventoVinculadoId),

    // Identidade
    nome: eventosV2_texto_(dados.nome),
    edicao: eventosV2_texto_(dados.edicao),
    ano: eventosV2_numeroInteiro_(dados.ano),
    logoUrl: eventosV2_texto_(dados.logoUrl),
    imagemCapaUrl: eventosV2_texto_(dados.imagemCapaUrl),

    // Informações gerais
    descricao: eventosV2_texto_(dados.descricao),
    dataEvento: eventosV2_texto_(dados.dataEvento),
    horaAbertura: eventosV2_texto_(dados.horaAbertura),
    horaInicio: eventosV2_texto_(dados.horaInicio),
    horaEncerramento: eventosV2_texto_(dados.horaEncerramento),
    localNome: eventosV2_texto_(dados.localNome),
    endereco: eventosV2_texto_(dados.endereco),
    orientacoes: eventosV2_texto_(dados.orientacoes),
    informacoesImportantes: eventosV2_texto_(dados.informacoesImportantes),

    // Ciclo de vida
    status: eventosV2_texto_(dados.status || EVENTOS_V2_STATUS.RASCUNHO).toUpperCase(),

    // Auditoria — preenchida pela camada administrativa/persistência.
    criadoEm: dados.criadoEm || null,
    atualizadoEm: dados.atualizadoEm || null,
    criadoPor: eventosV2_texto_(dados.criadoPor),
    atualizadoPor: eventosV2_texto_(dados.atualizadoPor)
  };
}

/**
 * Valida somente regras do domínio da entidade.
 * Não valida permissão de usuário nem grava dados — essas responsabilidades
 * ficam para Controller/Service/Repository quando a V2 for ligada ao módulo.
 */
function eventosV2_validarEvento_(dados) {
  var evento = eventosV2_normalizarEvento_(dados);
  var erros = [];

  if (!evento.nome)
    erros.push({ campo: 'nome', codigo: 'OBRIGATORIO', mensagem: 'Informe o nome do evento.' });

  if (!eventosV2_valorEnum_(evento.tipo, EVENTOS_V2_TIPOS))
    erros.push({ campo: 'tipo', codigo: 'TIPO_INVALIDO', mensagem: 'Tipo de evento inválido.' });

  if (!eventosV2_valorEnum_(evento.status, EVENTOS_V2_STATUS))
    erros.push({ campo: 'status', codigo: 'STATUS_INVALIDO', mensagem: 'Status do evento inválido.' });

  if (evento.ano && (evento.ano < 2000 || evento.ano > 2100))
    erros.push({ campo: 'ano', codigo: 'ANO_INVALIDO', mensagem: 'Ano do evento inválido.' });

  ['horaAbertura', 'horaInicio', 'horaEncerramento'].forEach(function (campo) {
    if (evento[campo] && !eventosV2_horaValida_(evento[campo])) {
      erros.push({
        campo: campo,
        codigo: 'HORA_INVALIDA',
        mensagem: 'Informe o horário no formato HH:mm.'
      });
    }
  });

  if (evento.dataEvento && !eventosV2_dataValida_(evento.dataEvento))
    erros.push({
      campo: 'dataEvento',
      codigo: 'DATA_INVALIDA',
      mensagem: 'Informe a data no formato AAAA-MM-DD.'
    });

  return {
    ok: erros.length === 0,
    erros: erros,
    evento: evento
  };
}

/** Retorna true quando `valor` pertence ao mapa de constantes informado. */
function eventosV2_valorEnum_(valor, mapa) {
  var valores = Object.keys(mapa || {}).map(function (chave) { return mapa[chave]; });
  return valores.indexOf(valor) >= 0;
}

/** Normaliza texto sem converter null/undefined para as palavras correspondentes. */
function eventosV2_texto_(valor) {
  return valor == null ? '' : String(valor).trim();
}

/** Retorna inteiro positivo/zero; valores ausentes ou inválidos viram 0. */
function eventosV2_numeroInteiro_(valor) {
  if (valor == null || valor === '') return 0;
  var n = Number(valor);
  return isFinite(n) && Math.floor(n) === n ? n : 0;
}

/** Validação simples e determinística de HH:mm (00:00–23:59). */
function eventosV2_horaValida_(valor) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(eventosV2_texto_(valor));
}

/**
 * Valida AAAA-MM-DD sem aceitar datas impossíveis como 2026-02-31.
 * A entidade guarda a data civil como texto para evitar deslocamento por fuso.
 */
function eventosV2_dataValida_(valor) {
  var texto = eventosV2_texto_(valor);
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;

  var ano = Number(m[1]);
  var mes = Number(m[2]);
  var dia = Number(m[3]);
  var d = new Date(Date.UTC(ano, mes - 1, dia));

  return d.getUTCFullYear() === ano &&
         d.getUTCMonth() === mes - 1 &&
         d.getUTCDate() === dia;
}
