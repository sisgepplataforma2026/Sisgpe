/** COMPASSO 2026 — Pilar 1: inscrições V2. */
function compasso_inscricaoChave_(pessoaId, cpf) {
  return compasso_chavePessoaEvento_(EMISSAO_CFG.EVENTO_ID,pessoaId,cpf);
}

function compasso_lerReservaVagas_() {
  var r=fs_get_('reservasEventos',EMISSAO_CFG.EVENTO_ID);
  if(!r) r={eventoId:EMISSAO_CFG.EVENTO_ID,limite:EMISSAO_CFG.LIMITE_VAGAS,reservadas:0};
  return r;
}

function compasso_reservarVagaInscricao_() {
  var r=compasso_lerReservaVagas_();
  if(Number(r.reservadas||0)>=Number(r.limite||EMISSAO_CFG.LIMITE_VAGAS)) return {ok:false,erro:'Vagas de inscrição esgotadas.'};
  r.reservadas=Number(r.reservadas||0)+1;r.atualizadoEm=new Date();fs_set_('reservasEventos',EMISSAO_CFG.EVENTO_ID,r);return {ok:true,reserva:r};
}

function compasso_liberarVagaInscricao_(inscricaoId) {
  var ins=fs_get_('inscricoesEventos',inscricaoId); if(!ins || !ins.vagaReservada) return;
  var r=compasso_lerReservaVagas_();r.reservadas=Math.max(0,Number(r.reservadas||0)-1);r.atualizadoEm=new Date();fs_set_('reservasEventos',EMISSAO_CFG.EVENTO_ID,r);
  ins.vagaReservada=false;ins.vagaLiberadaEm=new Date();fs_set_('inscricoesEventos',inscricaoId,ins);
}

/* NOTA DE DESENHO (21/08/2026): a origem padrão é 'PORTAL_ASSOCIADO', mas hoje
   nenhuma tela chama esta função — o portal público do associado ainda não tem
   a tela de inscrição do Compasso. Enquanto não tiver, a trava é a do módulo
   "eventos", que é o que a secretaria usa. Quando a tela pública existir, ela
   precisa de decisão própria (token do portal x sessão SISGEP); não dá para
   herdar esta trava, porque o associado não tem acesso ao módulo. */
function compasso_criarInscricaoAssociado(payload, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — criar inscrição', false);
  payload=payload||{}; var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    if(!String(payload.nome||'').trim()) return {ok:false,erro:'Nome é obrigatório.'};
    var cpf=compasso_cpfNormalizado_(payload.cpf); if(!payload.pessoaId && !cpf) return {ok:false,erro:'CPF ou pessoaId é obrigatório para identificar a inscrição.'};
    if(!emissao_modoTeste_()) {var agora=new Date();if(agora<EMISSAO_CFG.PERIODO_INICIO||agora>EMISSAO_CFG.PERIODO_FIM)return {ok:false,erro:'Fora do período de inscrições.'};}
    var chave=compasso_inscricaoChave_(payload.pessoaId,cpf), indice=fs_get_('inscricaoUnicaEventos',chave);
    if(indice && indice.status!=='CANCELADA' && indice.status!=='REPROVADA') return {ok:false,erro:'Esta pessoa já possui inscrição neste evento.',inscricaoId:indice.inscricaoId};
    var vaga=compasso_reservarVagaInscricao_(); if(!vaga.ok) return vaga;
    var id='INS-'+Utilities.getUuid(), agora2=new Date();
    var ins={inscricaoId:id,eventoId:EMISSAO_CFG.EVENTO_ID,pessoaId:String(payload.pessoaId||''),nome:String(payload.nome||'').trim(),cpf:String(payload.cpf||'').trim(),escola:String(payload.escola||'').trim(),cidade:String(payload.cidade||'').trim(),regiao:String(payload.regiao||'').trim(),email:String(payload.email||'').trim(),whatsapp:String(payload.whatsapp||'').trim(),matricula:String(payload.matricula||'').trim(),categoria:'associado',origem:String(payload.origem||'PORTAL_ASSOCIADO'),status:COMPASSO_STATUS.RECEBIDA,vagaReservada:true,criadoEm:agora2,criadoPor:compasso_emailUsuario_()};
    try {fs_set_('inscricoesEventos',id,ins);fs_set_('inscricaoUnicaEventos',chave,{eventoId:EMISSAO_CFG.EVENTO_ID,inscricaoId:id,pessoaId:ins.pessoaId,cpfHash:compasso_hash_(cpf),status:'ATIVA',criadoEm:agora2});}
    catch(e){var rr=compasso_lerReservaVagas_();rr.reservadas=Math.max(0,Number(rr.reservadas||0)-1);fs_set_('reservasEventos',EMISSAO_CFG.EVENTO_ID,rr);return {ok:false,erro:'Falha ao registrar inscrição: '+e.message};}
    compasso_auditar_('CRIACAO_INSCRICAO','inscricao',id,{origem:ins.origem,categoria:'associado'});return {ok:true,inscricaoId:id,status:ins.status,reservadas:vaga.reserva.reservadas,restantes:vaga.reserva.limite-vaga.reserva.reservadas};
  } finally {lock.releaseLock();}
}

/* ADMIN: cria convidado/acompanhante fora da fila de inscrição, consumindo
   vaga das 2.000. É concessão, não atendimento — exige administrador. */
function compasso_criarInclusaoAdministrativa(payload, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — inclusão administrativa', true);
  payload=payload||{};var cat=String(payload.categoria||'').toLowerCase();if(['convidado','acompanhante'].indexOf(cat)<0)return {ok:false,erro:'Inclusão administrativa deve ser convidado ou acompanhante.'};
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    if(!String(payload.nome||'').trim()) return {ok:false,erro:'Nome é obrigatório.'};
    var vaga=compasso_reservarVagaInscricao_();if(!vaga.ok)return vaga;
    var id='INS-'+Utilities.getUuid(),agora=new Date();
    var ins={inscricaoId:id,eventoId:EMISSAO_CFG.EVENTO_ID,pessoaId:String(payload.pessoaId||compasso_uuid_()),nome:String(payload.nome||'').trim(),cpf:String(payload.cpf||'').trim(),escola:String(payload.escola||'').trim(),cidade:String(payload.cidade||'').trim(),regiao:String(payload.regiao||'').trim(),email:String(payload.email||'').trim(),whatsapp:String(payload.whatsapp||'').trim(),categoria:cat,origem:cat==='convidado'?'ADMIN_CONVIDADO':'ADMIN_ACOMPANHANTE',titularId:String(payload.titularId||''),status:COMPASSO_STATUS.VALIDADA,vagaReservada:true,criadoEm:agora,criadoPor:compasso_emailUsuario_(),analisadoPor:compasso_emailUsuario_(),analisadoEm:agora};
    fs_set_('inscricoesEventos',id,ins);compasso_auditar_('INCLUSAO_ADMINISTRATIVA','inscricao',id,{categoria:cat,titularId:ins.titularId});return {ok:true,inscricaoId:id,status:ins.status};
  } finally {lock.releaseLock();}
}

/* Repassa o token adiante em vez de deixar compasso_validarDecisaoAdmin cair
   no caminho da conta Google: sem o repasse, uma chamada legítima com token
   seria checada como se viesse do editor. */
function compasso_reprovarInscricaoLiberandoVaga(inscricaoId,motivoCodigo,observacao,tokenSessao){exigirAdminOuSessao_(tokenSessao,'eventos','Compasso — reprovar liberando vaga',false);var r=compasso_validarDecisaoAdmin(inscricaoId,COMPASSO_STATUS.REPROVADA,motivoCodigo,observacao,tokenSessao);if(r.ok)compasso_liberarVagaInscricao_(inscricaoId);return r;}
