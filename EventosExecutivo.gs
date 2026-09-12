/**
 * EVENTOS — PAINEL EXECUTIVO DO MÓDULO
 * ============================================================================
 *
 * Nível 2 dos três que o PROMPT-MESTRE define (Geral → MÓDULO → Processo). O
 * painel operacional já existia e mostra as filas da Festa; este responde o
 * que aquele não responde, e a regra central é a mesma:
 *
 *     "o dashboard deve mostrar o que o usuário precisa fazer AGORA"
 *
 * O QUE ELE MOSTRA, E POR QUÊ CADA COISA
 *
 * 1. O RELÓGIO. Dias até 19/12. Pedido do usuário em 25/08/2026, e é a
 *    pergunta de diretoria: quanto tempo ainda há.
 *
 * 2. O QUE PODE PARAR O DIA DA FESTA. Duas contas que existiam no código e
 *    nunca apareceram em tela nenhuma:
 *
 *    · Firestore — `compasso_estimarDiaFesta` projeta leituras e gravações do
 *      dia 19/12 contra a faixa gratuita. Estourar significa portaria parada
 *      com fila na porta.
 *
 *    · RITMO DE ENTREGA. O usuário contou em 25/08 que os ingressos vão
 *      prioritariamente por WHATSAPP, raramente por e-mail — e que o envio em
 *      lote existe SOMENTE para e-mail (`compasso_enviarLoteEmail`). O
 *      WhatsApp é um a um.
 *
 *      Eu errei duas vezes aqui, e as duas correções vieram dele:
 *
 *        1. pus a cota de e-mail como risco principal. Não é: quase não se
 *           usa e-mail.
 *        2. somei as 2.000 entregas e anunciei "14 horas de trabalho". Ele
 *           corrigiu: *"os ingressos eram enviados de forma unitária, um por
 *           um, e não tudo ao mesmo tempo"*. Estava certo — eles saem
 *           conforme as validações, ao longo de semanas, e o total nunca é
 *           feito de uma vez.
 *
 *      O que ficou é o que decide alguma coisa: o RITMO da fila de hoje nos
 *      dias que faltam. Fila em dia, painel quieto; fila acumulada, aviso
 *      antes de virar mutirão de véspera. O risco nunca foi o total — é o
 *      acúmulo.
 *
 * 3. A AGENDA E O BINGO. O Bingo existe, nunca rodou, e não aparecia em
 *    número nenhum.
 *
 * O QUE NÃO ENTRA: número que não leva a decisão. Card bonito sem ação é o
 * que o próprio PROMPT-MESTRE chama de dashboard decorativo.
 */

/** Segundos por envio manual de WhatsApp. Abrir, conferir, enviar, voltar,
    confirmar. É estimativa declarada, não medição — e está aqui, num lugar
    só, para poder ser corrigida quando a primeira leva real for cronometrada. */
var COMPASSO_SEGUNDOS_POR_WHATSAPP = 25;

function compasso_executivoResumo(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — painel executivo', false);

  var hoje = new Date();
  var data = EMISSAO_CFG.DATA_EVENTO;
  var dias = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);

  var resumo = compasso_validacaoResumo(tokenSessao) || {};
  var total       = Number(resumo.total || 0);
  var comIngresso = total - Number(resumo.semIngresso || 0);
  var aEnviar     = Number(resumo.aEnviar || 0);

  /* A projeção do dia é feita sobre a LOTAÇÃO, não sobre quem já se inscreveu:
     o que interessa saber em agosto é se o dia 19/12 cabe na cota quando a
     festa estiver cheia. Projetar sobre 124 inscritos daria um "tudo bem" que
     não vale nada. */
  var firestore = {};
  try { firestore = compasso_estimarDiaFesta(EMISSAO_CFG.LIMITE_VAGAS, 100, tokenSessao) || {}; }
  catch (e) { firestore = { erro: e.message }; }

  var email = {};
  try { email = compasso_capacidadeEnvio(tokenSessao) || {}; } catch (e) { email = {}; }

  /* O esforço é sobre a FILA DE HOJE, distribuída nos dias que faltam. */
  var entrega = compasso_esforcoEntrega_(aEnviar, dias);

  return {
    evento: {
      nome: 'Festa Compasso da Vida 2026',
      data: data,
      dias: dias,
      vagas: compasso_limiteVagas_(),
      vagasRestantes: Math.max(0, compasso_limiteVagas_() - comIngresso)
    },
    inscricoes: {
      total: total, aAnalisar: Number(resumo.naoAnalisadas || 0),
      validadas: Number(resumo.validadas || 0), comIngresso: comIngresso,
      aEnviar: aEnviar
    },
    firestore: firestore,
    email: email,
    entrega: entrega,
    chegada: compasso_ritmoDeChegada_(resumo),
    riscos: compasso_riscosDoEvento_(dias, firestore, entrega)
  };
}

/**
 * O ESFORÇO DE ENTREGA, MEDIDO EM RITMO — NÃO EM TOTAL.
 *
 * A primeira versão desta função somava as 2.000 entregas e anunciava "14
 * horas de trabalho". O usuário corrigiu na hora: *"os ingressos eram
 * enviados de forma unitária, um por um, e não tudo ao mesmo tempo"*.
 *
 * Ele está certo, e a correção importa. Ninguém senta um dia para despachar
 * 2.000 ingressos: eles saem conforme as inscrições vão sendo validadas, ao
 * longo de semanas. Somar tudo num número só produz um susto falso — e um
 * painel que assusta à toa é um painel que se aprende a ignorar.
 *
 * O número que decide alguma coisa é o RITMO: quantos por dia, e quantos
 * minutos por dia isso custa daqui até a festa. Nesse formato:
 *
 *   · a fila em dia é confortável e o painel fica quieto;
 *   · a fila acumulada aparece ANTES de virar mutirão de véspera.
 *
 * O risco nunca foi o total. É o acúmulo.
 */
function compasso_esforcoEntrega_(quantidade, diasRestantes) {
  var n = Math.max(0, Number(quantidade || 0));
  var dias = Math.max(1, Number(diasRestantes || 1));
  var segundos = n * COMPASSO_SEGUNDOS_POR_WHATSAPP;

  var porDia = n / dias;
  var minutosPorDia = (porDia * COMPASSO_SEGUNDOS_POR_WHATSAPP) / 60;

  return {
    quantidade: n,
    diasRestantes: dias,
    segundosPorEnvio: COMPASSO_SEGUNDOS_POR_WHATSAPP,
    horasTotais: Math.round((segundos / 3600) * 10) / 10,
    porDia: Math.ceil(porDia),
    minutosPorDia: Math.round(minutosPorDia),
    /* Acima de uma hora por dia deixa de ser tarefa de rotina e vira projeto —
       é aí que vale avisar, e não antes. */
    apertado: minutosPorDia > 60,
    temLote: false,
    canal: 'WhatsApp'
  };
}

/**
 * O que ainda pode dar errado no dia 19/12.
 *
 * Cada risco tem um TESTE que o resolve — não é lista de preocupações, é
 * lista de coisas que alguém precisa ir fazer. Risco sem próximo passo é
 * ansiedade em forma de card.
 */
function compasso_riscosDoEvento_(dias, firestore, esforco) {
  var out = [];

  /* 1º da lista desde 21/08, e nenhum código consegue provar. */
  out.push({
    grau: 'alto',
    titulo: 'O QR do ingresso nunca foi lido por câmera',
    texto: 'Decide se a portaria funciona no dia. O PDF sai, o QR é desenhado — ' +
           'mas ninguém apontou uma câmera para ele ainda.',
    acao: 'Abrir o PDF de um ingresso e ler o QR com a portaria no celular.'
  });

  /* O ALARME É SOBRE A FILA DE HOJE, não sobre as 2.000.
     Os ingressos saem um a um, conforme as validações — o usuário deixou isso
     claro em 25/08. Somar o total produziria um susto que não corresponde a
     nada, e painel que assusta à toa é painel que se aprende a ignorar.
     Só vira risco quando a fila acumulada exige mais de uma hora por dia. */
  if (esforco && esforco.apertado) {
    out.push({
      grau: 'medio',
      titulo: 'A fila de envio acumulou: ' + esforco.minutosPorDia +
              ' min/dia até a festa',
      texto: esforco.quantidade + ' ingresso(s) esperando envio e ' +
             esforco.diasRestantes + ' dia(s) pela frente — cerca de ' +
             esforco.porDia + ' por dia. Como o envio por WhatsApp é um a um, ' +
             'deixar acumular transforma rotina em mutirão de véspera.',
      acao: 'Enviar em ondas conforme valida, em vez de guardar para o fim.'
    });
  }

  if (firestore && firestore.aprovado === false) {
    out.push({
      grau: 'alto',
      titulo: 'A projeção do dia estoura a cota do Firestore',
      texto: 'Com a festa cheia, o dia 19/12 passa da faixa gratuita — ' +
             firestore.percentualLeituras + '% de leituras e ' +
             firestore.percentualGravacoes + '% de gravações. Estourar ' +
             'significa portaria parada com fila na porta.',
      acao: 'Revisar as buscas do check-in ou habilitar cobrança antes de dezembro.'
    });
  }

  if (dias <= 30) {
    out.push({
      grau: 'medio',
      titulo: 'Falta menos de um mês',
      texto: 'O que ainda não foi testado no ar dificilmente será testado com calma.',
      acao: 'Fechar a lista de pendências de verificação.'
    });
  }

  return out;
}

/**
 * O RITMO DE CHEGADA — para decidir a próxima leva. 25/08/2026.
 *
 * O usuário decidiu mandar o link "aos poucos, não tudo de uma única vez", e
 * essa é a medida que mais reduz o pico da inscrição — mais do que qualquer
 * ajuste de código. Mas operar por levas exige responder uma pergunta que o
 * painel não respondia: **já dá para mandar a próxima?**
 *
 * O QUE ESTE VEREDITO NÃO FAZ, e é o que o mantém honesto: ele não afirma
 * tendência. Eu tenho o tamanho da fila AGORA, não o histórico dela — dizer
 * "a fila está estabilizando" seria inventar uma leitura que o dado não
 * sustenta. Então o critério é o que dá para afirmar:
 *
 *   fila vazia  → a leva anterior foi absorvida, pode mandar a próxima
 *   fila com gente → ainda não foi, e o número diz quanto falta
 *
 * A curva de 7 dias vai junto porque ela mostra o que o número de hoje não
 * mostra: se o volume está subindo leva a leva.
 */
function compasso_ritmoDeChegada_(resumo) {
  var c = (resumo && resumo.chegada) || { ultimas24h: 0, hoje: 0, porDia: [], ultimaEm: null };
  var fila = Number((resumo || {}).naoAnalisadas || 0);

  var horas = null;
  if (c.ultimaEm) {
    var d = new Date(c.ultimaEm);
    if (!isNaN(d.getTime())) horas = Math.floor((Date.now() - d.getTime()) / 3600000);
  }

  return {
    ultimas24h: Number(c.ultimas24h || 0),
    hoje: Number(c.hoje || 0),
    porDia: c.porDia || [],
    horasDesdeAUltima: horas,
    filaDeAnalise: fila,
    liberado: fila === 0,
    recado: fila === 0
      ? 'Nada esperando análise. A leva anterior foi absorvida.'
      : fila + ' inscrição(ões) esperando análise — a leva anterior ainda não ' +
        'foi absorvida.'
  };
}
