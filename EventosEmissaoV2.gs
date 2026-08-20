/** COMPASSO 2026 — Emissão segura V2. */
function compasso_emitirIngressoV2(payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cat = String(payload.categoria || '').toLowerCase();
    if (['associado','convidado','acompanhante'].indexOf(cat) < 0) return {ok:false,erro:'Categoria inválida.'};
    if (!String(payload.nome || '').trim()) return {ok:false,erro:'Nome é obrigatório.'};

    // Associado somente após conferência humana obrigatória.
    if (cat === 'associado' && payload.validacaoStatus !== COMPASSO_STATUS.VALIDADA)
      return {ok:false,erro:'Inscrição ainda não foi validada administrativamente.'};
    // Convidado e acompanhante são exclusivamente administrativos.
    if ((cat === 'convidado' || cat === 'acompanhante') && payload.origem !== 'ADMIN')
      return {ok:false,erro:'Convidado/acompanhante somente pode ser incluído administrativamente.'};

    if (!emissao_modoTeste_()) {
      var hoje = new Date();
      if (cat === 'associado' && (hoje < EMISSAO_CFG.PERIODO_INICIO || hoje > EMISSAO_CFG.PERIODO_FIM))
        return {ok:false,erro:'Fora do período de inscrições dos associados.'};
    }

    var c = emissao_lerContador_();
    if (c.vagasUsadas >= c.limite) return {ok:false,erro:'Vagas esgotadas ('+c.limite+'/'+c.limite+').'};

    var ingressoId = compasso_uuid_();
    var identidade = compasso_reservarIdentidade_(payload, ingressoId);
    if (!identidade.ok) return identidade;

    var novoNumero = c.ultimoNumero + 1;
    var numero = emissao_formatarNumero_(novoNumero);
    var qrToken = Utilities.getUuid() + Utilities.getUuid();
    var qrTokenHash = compasso_hash_(qrToken);
    var agora = new Date();
    var valor = cat === 'acompanhante' ? EMISSAO_CFG.VALOR_ACOMPANHANTE : 0;
    var pagamentoStatus = cat === 'acompanhante' ? String(payload.pagamentoStatus || 'PENDENTE') : '';
    if (cat === 'acompanhante' && pagamentoStatus !== 'PAGO') {
      // desfaz reserva de identidade; nenhuma vaga foi consumida ainda.
      fs_set_('eventoIdentidades', identidade.chave, {eventoId:EMISSAO_CFG.EVENTO_ID,status:'CANCELADA',canceladaEm:agora});
      return {ok:false,erro:'Acompanhante somente pode ter ingresso emitido após confirmação do pagamento.'};
    }

    var ingresso = {
      ingressoId: ingressoId,
      numero: numero,
      eventoId: EMISSAO_CFG.EVENTO_ID,
      pessoaId: String(payload.pessoaId || ''),
      inscricaoId: String(payload.inscricaoId || ''),
      nome: String(payload.nome || '').trim(),
      escola: String(payload.escola || '').trim(),
      categoria: cat,
      cpf: String(payload.cpf || '').trim(),
      email: String(payload.email || '').trim(),
      whatsapp: String(payload.whatsapp || '').trim(),
      matricula: String(payload.matricula || '').trim(),
      status: 'EMITIDO',
      valor: valor,
      pagamentoForma: String(payload.pagamentoForma || ''),
      pagamentoStatus: pagamentoStatus,
      emitidoPor: compasso_emailUsuario_(),
      emitidoEm: agora,
      origem: String(payload.origem || 'ADMIN'),
      qrTokenHash: qrTokenHash
    };

    try {
      fs_set_('ingressos', ingressoId, ingresso);
      fs_set_('qrTokens', qrTokenHash, {eventoId:EMISSAO_CFG.EVENTO_ID,ingressoId:ingressoId,status:'ATIVO',criadoEm:agora});
      fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, {limite:c.limite,vagasUsadas:c.vagasUsadas+1,ultimoNumero:novoNumero});
    } catch(e) {
      try { fs_set_('eventoIdentidades', identidade.chave, {eventoId:EMISSAO_CFG.EVENTO_ID,status:'CANCELADA',canceladaEm:new Date()}); } catch(ignore) {}
      return {ok:false,erro:'Falha na emissão segura: '+e.message};
    }

    compasso_auditar_('EMISSAO_INGRESSO','ingresso',ingressoId,{numero:numero,categoria:cat,inscricaoId:payload.inscricaoId||''});
    // Token é retornado somente no ato da emissão para geração do QR. Não deve ser exibido em relatórios/logs.
    return {ok:true,id:ingressoId,numero:numero,nome:ingresso.nome,categoria:cat,qrToken:qrToken,restantes:c.limite-(c.vagasUsadas+1)};
  } finally { lock.releaseLock(); }
}

function compasso_cancelarIngressoV2(ingressoId, motivo) {
  motivo = String(motivo || '').trim();
  if (!motivo) throw new Error('Motivo do cancelamento é obrigatório.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ing = fs_get_('ingressos', ingressoId);
    if (!ing) return {ok:false,erro:'Ingresso não encontrado.'};
    if (ing.status === 'CANCELADO') return {ok:false,erro:'Ingresso já cancelado.'};
    var jaUsado = ing.status === 'UTILIZADO';
    ing.status='CANCELADO'; ing.canceladoEm=new Date(); ing.canceladoPor=compasso_emailUsuario_(); ing.canceladoMotivo=motivo;
    fs_set_('ingressos', ingressoId, ing);
    if (ing.qrTokenHash) fs_set_('qrTokens', ing.qrTokenHash, {eventoId:ing.eventoId,ingressoId:ingressoId,status:'CANCELADO',canceladoEm:new Date()});
    compasso_liberarIdentidade_(ing);
    if (!jaUsado) {
      var c=emissao_lerContador_();
      fs_set_('contadores',EMISSAO_CFG.EVENTO_ID,{limite:c.limite,vagasUsadas:Math.max(0,c.vagasUsadas-1),ultimoNumero:c.ultimoNumero});
    }
    compasso_auditar_('CANCELAMENTO_INGRESSO','ingresso',ingressoId,{motivo:motivo,jaUsado:jaUsado});
    return {ok:true,id:ingressoId,avisoJaEntrou:jaUsado};
  } finally { lock.releaseLock(); }
}
