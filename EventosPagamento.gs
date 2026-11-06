// ============================================================================
// 💳 ARQUIVO: EventosPagamento.gs
// 🏷️  COMPASSO DA VIDA 2026 — Recebimento do ingresso de acompanhante
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. A verificação de completude do módulo de festas achou um beco
// sem saída: `compasso_emitirIngressoV2` recusa acompanhante cujo
// `pagamentoStatus` não seja 'PAGO' (EventosEmissaoV2.gs:36) — e a varredura
// do projeto inteiro não encontrou UMA linha que escreva 'PAGO'.
//
// A condição existia e nunca podia ser satisfeita. Na prática: acompanhante
// jamais conseguiria ingresso pela V2, e os R$ 500 não tinham caminho.
//
// O usuário confirmou como o dinheiro entra: "recebeu através de Pix e cartão".
//
// O SEGUNDO BURACO, QUE ESTE ARQUIVO TAMBÉM FECHA
//
// A V1 lança a receita no Financeiro (emissao_registrarReceitaAcompanhante_).
// A V2 não lança nada. Dinheiro que entrasse por ela não chegaria na Central
// Financeira. Aqui a receita é lançada no momento em que o pagamento é
// confirmado — que é o momento certo, e não na emissão.
//
// POR QUE O RESULTADO DA RECEITA VOLTA PARA A TELA
//
// `cadastrarReceita` exige o módulo "financeiro" (Receita.gs:83), e quem opera
// a Central de Validação tem "eventos". A V1 resolveu isso engolindo a
// exceção num catch e escrevendo no Logger — ou seja, a receita some e
// ninguém fica sabendo. Este projeto já pagou caro por falha silenciosa.
//
// Aqui o lançamento também é tolerante (não derruba a confirmação do
// pagamento), mas o resultado VOLTA no retorno e a tela mostra. Se não
// lançou, a pessoa lê o motivo e lança à mão. Falhar é aceitável; falhar em
// silêncio não.
//
// POR QUE CONFIRMAR PAGAMENTO NÃO EMITE O INGRESSO
//
// Emitir consome vaga das 2.000, gera o QR assinado e grava a identidade
// única da pessoa no evento — é irreversível na prática. Juntar as duas
// coisas tiraria da secretaria a chance de conferir entre uma e outra.
// A tela avisa que já pode emitir; quem emite é gente.
//
// PERMISSÃO
//
//   confirmar → módulo "eventos"   (é a operadora da Central que faz isso)
//   estornar  → ADMINISTRADOR      (é desfazer registro de dinheiro)
//
// Tudo passa por compasso_auditar_, com o valor anterior junto.
// ============================================================================

/** Situações possíveis. PENDENTE é o estado em que a inscrição nasce. */
var COMPASSO_PAGAMENTO_STATUS = {
  PENDENTE:  'PENDENTE',
  PAGO:      'PAGO',
  ESTORNADO: 'ESTORNADO'
};

/**
 * Formas aceitas. Pix e Cartão são as que o sindicato usa de fato (confirmado
 * pelo usuário em 21/08/2026). PicPay e Depósito vêm de EMISSAO_CFG e ficam:
 * a V1 já valida contra aquela lista, e tirar de lá quebraria emissão antiga.
 */
function compasso_formasPagamento_() {
  var base = (typeof EMISSAO_CFG === 'object' && EMISSAO_CFG.FORMAS_PAGAMENTO)
    ? EMISSAO_CFG.FORMAS_PAGAMENTO.slice() : [];
  if (base.indexOf('Pix') < 0) base.unshift('Pix');
  return base;
}

/**
 * O que a tela precisa para montar o bloco de pagamento.
 * Devolve também o valor SUGERIDO — REGRA Nº 0.6: campo que o sistema já sabe
 * nasce preenchido, com a origem à vista, e continua editável.
 */
function compasso_pagamentoOpcoes(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — opções de pagamento', false);
  return {
    formas: compasso_formasPagamento_(),
    valorSugerido: (typeof EMISSAO_CFG === 'object' ? Number(EMISSAO_CFG.VALOR_ACOMPANHANTE || 0) : 0),
    origemValor: 'valor de acompanhante definido para o evento',
    status: COMPASSO_PAGAMENTO_STATUS
  };
}

/** Normaliza "500,00" / "R$ 500,00" / "500.00" para número. */
function compasso_valorNumero_(v) {
  if (typeof v === 'number') return v;
  var s = String(v || '').replace(/[^\d,.-]/g, '').trim();
  if (!s) return 0;
  /* Se tem vírgula, ela é o separador decimal (padrão brasileiro): o ponto
     que aparecer antes dela é separador de milhar e sai. */
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Confirma que o dinheiro entrou.
 *
 * @param {string} inscricaoId
 * @param {Object} dados  { forma, valor, referencia }
 * @param {string=} tokenSessao
 * @return {Object} { ok, pagamento, receita:{ok,motivo}, podeEmitir }
 */
function compasso_confirmarPagamento(inscricaoId, dados, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — confirmar pagamento', false);
  dados = dados || {};

  var forma = String(dados.forma || '').trim();
  if (compasso_formasPagamento_().indexOf(forma) < 0)
    return { ok: false, erro: 'Selecione a forma de recebimento (Pix, Cartão…).' };

  var valor = compasso_valorNumero_(dados.valor);
  if (!(valor > 0))
    return { ok: false, erro: 'Informe o valor recebido.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
    if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID)
      return { ok: false, erro: 'Inscrição não encontrada para este evento.' };

    /* Só acompanhante paga. Confirmar pagamento de um associado seria lançar
       receita que não existe — e o erro só apareceria na conciliação. */
    if (String(ins.categoria || '').toLowerCase() !== 'acompanhante')
      return { ok: false, erro: 'Somente acompanhante tem pagamento neste evento.' };

    if (String(ins.pagamentoStatus || '') === COMPASSO_PAGAMENTO_STATUS.PAGO)
      return { ok: false, erro: 'Este pagamento já está confirmado.',
               pagamento: compasso_pagamentoDaInscricao_(ins) };

    var anterior = String(ins.pagamentoStatus || COMPASSO_PAGAMENTO_STATUS.PENDENTE);
    var agora = new Date();

    ins.pagamentoStatus = COMPASSO_PAGAMENTO_STATUS.PAGO;
    ins.pagamentoForma  = forma;
    ins.pagamentoValor  = valor;
    ins.pagamentoRef    = String(dados.referencia || '').trim();
    ins.pagamentoEm     = agora;
    ins.pagamentoPor    = compasso_emailUsuario_();
    ins.pagamentoEstornadoEm = '';
    ins.pagamentoEstornoMotivo = '';

    fs_set_('inscricoesEventos', ins.inscricaoId || inscricaoId, ins);

    var receita = compasso_lancarReceita_(ins, tokenSessao);

    compasso_auditar_('CONFIRMACAO_PAGAMENTO', 'inscricao', inscricaoId, {
      de: anterior, para: COMPASSO_PAGAMENTO_STATUS.PAGO,
      forma: forma, valor: valor, referencia: ins.pagamentoRef,
      receitaLancada: !!receita.ok, receitaMotivo: receita.motivo || ''
    });

    return {
      ok: true,
      pagamento: compasso_pagamentoDaInscricao_(ins),
      receita: receita,
      /* A emissão continua exigindo inscrição VALIDADA com vaga reservada —
         pagar não aprova. A tela usa isto só para dizer o que falta. */
      podeEmitir: ins.status === COMPASSO_STATUS.VALIDADA && !!ins.vagaReservada && !ins.ingressoId,
      aviso: ins.status === COMPASSO_STATUS.VALIDADA
        ? 'Pagamento confirmado. O ingresso já pode ser emitido.'
        : 'Pagamento confirmado. Falta validar a inscrição antes de emitir.'
    };
  } finally { lock.releaseLock(); }
}

/**
 * Desfaz a confirmação. ADMIN: é apagar registro de dinheiro recebido.
 *
 * A receita já lançada NÃO é apagada daqui — estorno de receita é ato do
 * Financeiro, com a trilha dele. O que fica é o registro do estorno e o
 * aviso para a pessoa tratar do outro lado.
 */
function compasso_estornarPagamento(inscricaoId, motivo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — estornar pagamento', true);
  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, erro: 'Motivo é obrigatório para estornar.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
    if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID)
      return { ok: false, erro: 'Inscrição não encontrada para este evento.' };
    if (String(ins.pagamentoStatus || '') !== COMPASSO_PAGAMENTO_STATUS.PAGO)
      return { ok: false, erro: 'Não há pagamento confirmado para estornar.' };

    /* Ingresso já emitido trava o estorno: o QR está na mão da pessoa e a
       vaga foi consumida. O caminho certo é cancelar o ingresso primeiro
       (compasso_cancelarIngressoV2), que devolve a vaga e invalida o QR. */
    if (ins.ingressoId)
      return { ok: false,
               erro: 'O ingresso ' + (ins.numeroIngresso || ins.ingressoId) +
                     ' já foi emitido com este pagamento. Cancele o ingresso antes de estornar.' };

    var registro = compasso_pagamentoDaInscricao_(ins);
    ins.pagamentoStatus = COMPASSO_PAGAMENTO_STATUS.ESTORNADO;
    ins.pagamentoEstornadoEm = new Date();
    ins.pagamentoEstornadoPor = compasso_emailUsuario_();
    ins.pagamentoEstornoMotivo = motivo;
    fs_set_('inscricoesEventos', ins.inscricaoId || inscricaoId, ins);

    compasso_auditar_('ESTORNO_PAGAMENTO', 'inscricao', inscricaoId,
                      { motivo: motivo, pagamentoAnterior: registro });

    return { ok: true, pagamento: compasso_pagamentoDaInscricao_(ins),
             aviso: 'Pagamento estornado aqui. Se a receita já foi lançada, ' +
                    'o estorno no Financeiro é feito por lá.' };
  } finally { lock.releaseLock(); }
}

/** Recorte do pagamento, para a tela e para a auditoria falarem a mesma língua. */
function compasso_pagamentoDaInscricao_(ins) {
  ins = ins || {};
  return {
    status:     String(ins.pagamentoStatus || COMPASSO_PAGAMENTO_STATUS.PENDENTE),
    forma:      String(ins.pagamentoForma || ''),
    valor:      Number(ins.pagamentoValor || 0),
    referencia: String(ins.pagamentoRef || ''),
    em:         ins.pagamentoEm || '',
    por:        String(ins.pagamentoPor || ''),
    estornadoEm:   ins.pagamentoEstornadoEm || '',
    estornoMotivo: String(ins.pagamentoEstornoMotivo || '')
  };
}

/**
 * Lança a receita no Financeiro. Tolerante, mas NUNCA silencioso — quem chama
 * recebe o motivo e mostra na tela.
 */
function compasso_lancarReceita_(ins, tokenSessao) {
  if (typeof cadastrarReceita !== 'function')
    return { ok: false, motivo: 'Receita.gs não está disponível no projeto.' };
  try {
    var r = cadastrarReceita({
      tipo: 'Evento',
      categoria: 'Ingresso Evento',
      descricao: 'Ingresso acompanhante — Festa Compasso da Vida 2026 — ' +
                 String(ins.nome || '') +
                 (ins.titularId ? ' (titular: ' + ins.titularId + ')' : ''),
      valor: Number(ins.pagamentoValor || 0),
      formaRecebimento: String(ins.pagamentoForma || ''),
      dataRecebimento: ins.pagamentoEm,
      status: 'RECEBIDO',
      observacoes: 'Inscrição ' + String(ins.inscricaoId || '') +
                   (ins.pagamentoRef ? ' · ref ' + ins.pagamentoRef : '') +
                   '. Lançada na confirmação do pagamento (Central de Validação).'
    }, tokenSessao);
    if (r && r.ok === false)
      return { ok: false, motivo: r.mensagem || 'o Financeiro recusou o lançamento' };
    return { ok: true, motivo: '' };
  } catch (e) {
    /* O caso mais comum e mais esperado: quem valida tem o módulo "eventos",
       não "financeiro", e o cadastrarReceita exige financeiro. Isso NÃO pode
       derrubar a confirmação do pagamento — mas tem de aparecer. */
    return { ok: false, motivo: e.message };
  }
}

/**
 * Diagnóstico para rodar pelo editor: mostra o beco sem saída que este
 * arquivo fechou, e se ele está mesmo fechado.
 */
function diagnosticoPagamentoCompasso_() {
  var L = [];
  L.push('═══════════════════════════════════════════════════');
  L.push('  PAGAMENTO DO ACOMPANHANTE — COMPASSO 2026');
  L.push('═══════════════════════════════════════════════════');
  L.push('  Formas aceitas : ' + compasso_formasPagamento_().join(', '));
  L.push('  Valor do evento: R$ ' +
         Number(EMISSAO_CFG.VALOR_ACOMPANHANTE || 0).toFixed(2).replace('.', ','));
  L.push('  Financeiro     : ' +
         (typeof cadastrarReceita === 'function' ? 'Receita.gs presente' : '⚠️ Receita.gs AUSENTE'));
  L.push('');
  L.push('  A emissão V2 exige pagamentoStatus === PAGO.');
  L.push('  Quem escreve PAGO: compasso_confirmarPagamento (este arquivo).');
  L.push('  Antes de 21/08/2026 não existia ninguém — era beco sem saída.');
  L.push('═══════════════════════════════════════════════════');
  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
