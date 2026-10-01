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

    /* CAPACIDADE — 26/08/2026, e isto REVISA a nota de privacidade do topo.
     *
     * O cabeçalho deste arquivo dizia que capacidade não pertence à entidade,
     * junto com vagas restantes, inscritos, aprovados e check-ins. A distinção
     * que faltava: aqueles são INDICADORES — mudam a cada inscrição e revelam
     * a operação. Capacidade é PROPRIEDADE do evento, tão estática quanto o
     * endereço: o salão comporta 2.000 pessoas hoje, amanhã e em dezembro.
     *
     * Sem ela aqui, a lotação continua sendo constante no código, e o módulo
     * não comporta um segundo evento — a assembleia de 300 lugares aceitaria
     * 2.000 inscrições, e o erro só apareceria na porta do salão. Medido em
     * `tests/e2e/t96-evento-manda.js` antes da mudança.
     *
     * A nota de privacidade continua valendo para o que ela realmente
     * protegia: o payload PÚBLICO não expõe capacidade nem contagem. Quem
     * decide o que sai para fora é `eventosV2Admin_payloadInformacoes_`, não
     * esta entidade. */
    capacidade: eventosV2_numeroInteiro_(dados.capacidade),

    // Ciclo de vida
    status: eventosV2_texto_(dados.status || EVENTOS_V2_STATUS.RASCUNHO).toUpperCase(),
    /* Motivo da última mudança de situação. Obrigatório no cancelamento — é o
       que responde, meses depois, por que a festa não aconteceu. */
    motivoSituacao: eventosV2_texto_(dados.motivoSituacao),

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

/* ════════════════════════════════════════════════════════════════════════════
   O CICLO DE VIDA PASSA A TER REGRA — 26/08/2026

   Os sete status existiam desde o começo; o que NÃO existia era dizer qual
   pode virar qual. Sem isso o botão "Publicar evento" ficou desligado desde
   21/08 com o aviso de que a transição não estava validada — e o usuário
   perguntou, com razão: "Ele não deixa eu publicar, é assim mesmo?".

   Enum sem máquina de estados é enum decorativo: `status` seria só um texto
   que qualquer gravação sobrescreve. O caso que dói: um evento ENCERRADO
   voltar para INSCRICOES_ABERTAS depois da festa, e o formulário público
   passar a aceitar inscrição para uma coisa que já aconteceu.

   O DESENHO, aprovado pelo usuário antes de virar código:

     RASCUNHO → PROGRAMADO → INSCRICOES_ABERTAS → INSCRICOES_ENCERRADAS
                     └──────────────┬───────────────────────┘
                                    ↓
                             EM_ANDAMENTO → ENCERRADO

     Qualquer um, menos ENCERRADO, pode ir para CANCELADO.

   DUAS DECISÕES QUE PARECEM DETALHE E NÃO SÃO:

   1. INSCRICOES_ABERTAS volta para PROGRAMADO. Abrir inscrição cedo demais é
      erro que acontece, e sem a volta a única saída seria cancelar o evento —
      o que devolveria todas as vagas e mandaria a operação para o lixo.

   2. ENCERRADO é terminal, inclusive para CANCELADO. Depois que a festa
      aconteceu, cancelá-la não descreve nada do mundo real; quem precisa
      corrigir um encerramento indevido faz pelo caminho de quem gravou
      errado, não fingindo que o evento não ocorreu.
   ════════════════════════════════════════════════════════════════════════════ */
var EVENTOS_V2_TRANSICOES = Object.freeze({
  RASCUNHO:              ['PROGRAMADO', 'CANCELADO'],
  PROGRAMADO:            ['INSCRICOES_ABERTAS', 'EM_ANDAMENTO', 'RASCUNHO', 'CANCELADO'],
  INSCRICOES_ABERTAS:    ['INSCRICOES_ENCERRADAS', 'PROGRAMADO', 'CANCELADO'],
  INSCRICOES_ENCERRADAS: ['EM_ANDAMENTO', 'INSCRICOES_ABERTAS', 'CANCELADO'],
  EM_ANDAMENTO:          ['ENCERRADO', 'CANCELADO'],
  ENCERRADO:             [],
  CANCELADO:             ['RASCUNHO']
});

/** Rótulos em português, num lugar só — tela e auditoria dizendo o mesmo. */
var EVENTOS_V2_STATUS_ROTULO = Object.freeze({
  RASCUNHO:              'Rascunho',
  PROGRAMADO:            'Programado',
  INSCRICOES_ABERTAS:    'Inscrições abertas',
  INSCRICOES_ENCERRADAS: 'Inscrições encerradas',
  EM_ANDAMENTO:          'Em andamento',
  ENCERRADO:             'Encerrado',
  CANCELADO:             'Cancelado'
});

/**
 * A transição é permitida? Devolve {ok} ou {ok:false, mensagem} — mensagem que
 * serve para mostrar à pessoa, não código de erro para o log.
 */
function eventosV2_transicaoPermitida_(de, para) {
  de = eventosV2_texto_(de || EVENTOS_V2_STATUS.RASCUNHO).toUpperCase();
  para = eventosV2_texto_(para).toUpperCase();

  if (!eventosV2_valorEnum_(para, EVENTOS_V2_STATUS))
    return { ok: false, mensagem: 'Situação desconhecida: ' + para + '.' };
  if (de === para)
    return { ok: false, mensagem: 'O evento já está em "' + (EVENTOS_V2_STATUS_ROTULO[para] || para) + '".' };

  var permitidos = EVENTOS_V2_TRANSICOES[de] || [];
  if (permitidos.indexOf(para) < 0) {
    var rotDe = EVENTOS_V2_STATUS_ROTULO[de] || de;
    var rotPara = EVENTOS_V2_STATUS_ROTULO[para] || para;
    /* Terminal merece frase própria: "não pode ir para X" faria a pessoa
       procurar outro caminho que também não existe. */
    if (!permitidos.length)
      return { ok: false, mensagem: 'Evento ' + rotDe.toLowerCase() + ' não muda mais de situação.' };
    return { ok: false, mensagem: 'De "' + rotDe + '" não dá para ir direto para "' + rotPara + '".' };
  }
  return { ok: true };
}

/**
 * O que ainda falta para o evento poder ser publicado.
 *
 * Devolve LISTA de pendências, não um booleano: um botão que só recusa deixa a
 * pessoa procurando o que está errado numa tela de vinte campos. Estes quatro
 * são o mínimo que um evento publicado precisa responder a quem lê a página —
 * o que é, quando, onde, e para quantos.
 */
function eventosV2_pendenciasParaPublicar_(evento) {
  evento = evento || {};
  var faltam = [];
  /* Os nomes são os do DOMÍNIO — `dataEvento` e `localNome`, não `data` e
     `local`. Escrever o nome que a tela usa faria a checagem sempre dizer que
     falta um campo que está preenchido, e o botão nunca publicaria nada. */
  if (!eventosV2_texto_(evento.nome))       faltam.push('nome do evento');
  if (!eventosV2_texto_(evento.dataEvento)) faltam.push('data');
  if (!eventosV2_texto_(evento.localNome))  faltam.push('local');
  if (!(Number(evento.capacidade) > 0))     faltam.push('capacidade (lotação)');
  return faltam;
}
