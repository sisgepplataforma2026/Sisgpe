/** COMPASSO 2026 — Emissão segura V2. */
function compasso_emitirIngressoV2(payload, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — emitir ingresso V2', false);
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var inscricaoId = String(payload.inscricaoId || '').trim();
    if (!inscricaoId) return {ok:false,erro:'inscricaoId é obrigatório para emissão.'};
    var ins = fs_get_('inscricoesEventos', inscricaoId);
    if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID) return {ok:false,erro:'Inscrição não encontrada para este evento.'};
    if (ins.status !== COMPASSO_STATUS.VALIDADA) return {ok:false,erro:'Inscrição ainda não foi validada administrativamente.'};
    if (!ins.vagaReservada) return {ok:false,erro:'Inscrição não possui vaga reservada.'};
    if (ins.ingressoId) return {ok:false,erro:'Esta inscrição já possui ingresso emitido.',ingressoId:ins.ingressoId};

    var cat = String(ins.categoria || '').toLowerCase();
    if (['associado','convidado','acompanhante'].indexOf(cat) < 0) return {ok:false,erro:'Categoria inválida.'};
    if (!String(ins.nome || '').trim()) return {ok:false,erro:'Nome é obrigatório.'};
    if ((cat === 'convidado' || cat === 'acompanhante') && String(ins.origem||'').indexOf('ADMIN_') !== 0)
      return {ok:false,erro:'Convidado/acompanhante somente pode ser incluído administrativamente.'};

    var c = emissao_lerContador_();
    if (c.vagasUsadas >= c.limite) return {ok:false,erro:'Vagas esgotadas ('+c.limite+'/'+c.limite+').'};

    var ingressoId = compasso_uuid_();
    var identidade = compasso_reservarIdentidade_(ins, ingressoId);
    if (!identidade.ok) return identidade;

    var novoNumero = c.ultimoNumero + 1;
    var numero = emissao_formatarNumero_(novoNumero);
    var qrToken = compasso_gerarQrToken_(ingressoId);
    var qrTokenHash = compasso_hash_(qrToken);
    var agora = new Date();
    var valor = cat === 'acompanhante' ? EMISSAO_CFG.VALOR_ACOMPANHANTE : 0;
    var pagamentoStatus = cat === 'acompanhante' ? String(ins.pagamentoStatus || 'PENDENTE') : '';
    if (cat === 'acompanhante' && pagamentoStatus !== 'PAGO') {
      fs_set_('eventoIdentidades', identidade.chave, {eventoId:EMISSAO_CFG.EVENTO_ID,status:'CANCELADA',canceladaEm:agora});
      return {ok:false,erro:'Acompanhante somente pode ter ingresso emitido após confirmação do pagamento.'};
    }

    var ingresso = {
      ingressoId: ingressoId,
      numero: numero,
      eventoId: EMISSAO_CFG.EVENTO_ID,
      pessoaId: String(ins.pessoaId || ''),
      inscricaoId: inscricaoId,
      nome: String(ins.nome || '').trim(),
      escola: String(ins.escola || '').trim(),
      categoria: cat,
      cpf: String(ins.cpf || '').trim(),
      email: String(ins.email || '').trim(),
      whatsapp: String(ins.whatsapp || '').trim(),
      matricula: String(ins.matricula || '').trim(),
      status: 'EMITIDO',
      valor: valor,
      pagamentoForma: String(ins.pagamentoForma || ''),
      pagamentoStatus: pagamentoStatus,
      emitidoPor: compasso_emailUsuario_(),
      emitidoEm: agora,
      origem: String(ins.origem || ''),
      qrTokenHash: qrTokenHash
    };

    try {
      fs_set_('ingressos', ingressoId, ingresso);
      fs_set_('qrTokens', qrTokenHash, {eventoId:EMISSAO_CFG.EVENTO_ID,ingressoId:ingressoId,status:'ATIVO',criadoEm:agora});
      fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, {limite:c.limite,vagasUsadas:c.vagasUsadas+1,ultimoNumero:novoNumero});
      ins.ingressoId=ingressoId; ins.numeroIngresso=numero; ins.ingressoEmitidoEm=agora; ins.ingressoEmitidoPor=compasso_emailUsuario_();
      fs_set_('inscricoesEventos',inscricaoId,ins);
    } catch(e) {
      try { fs_set_('eventoIdentidades', identidade.chave, {eventoId:EMISSAO_CFG.EVENTO_ID,status:'CANCELADA',canceladaEm:new Date()}); } catch(ignore) {}
      return {ok:false,erro:'Falha na emissão segura: '+e.message};
    }

    compasso_auditar_('EMISSAO_INGRESSO','ingresso',ingressoId,{numero:numero,categoria:cat,inscricaoId:inscricaoId});
    return {ok:true,id:ingressoId,numero:numero,nome:ingresso.nome,categoria:cat,qrToken:qrToken,restantes:c.limite-(c.vagasUsadas+1)};
  } finally { lock.releaseLock(); }
}

/* ADMIN: cancelar devolve vaga ao contador e invalida o QR. É desfazer, e
   desfazer em massa é o caminho mais curto para zerar a festa. */
function compasso_cancelarIngressoV2(ingressoId, motivo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — cancelar ingresso V2', true);
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
    var ins=ing.inscricaoId?fs_get_('inscricoesEventos',ing.inscricaoId):null;
    if(ins){ins.ingressoStatus='CANCELADO';ins.ingressoCanceladoEm=new Date();fs_set_('inscricoesEventos',ing.inscricaoId,ins);}
    compasso_auditar_('CANCELAMENTO_INGRESSO','ingresso',ingressoId,{motivo:motivo,jaUsado:jaUsado});
    return {ok:true,id:ingressoId,avisoJaEntrou:jaUsado};
  } finally { lock.releaseLock(); }
}
