/** COMPASSO 2026 — painel mobile da portaria. */
function abrirPainelCheckinCompasso() {
  var html=HtmlService.createHtmlOutputFromFile('EventosPortaria').setWidth(480).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html,'Compasso 2026 — Check-in');
}

function compasso_checkinValidarToken(token, dispositivoId) { return compasso_checkin(token,dispositivoId); }

function compasso_checkinBuscarManual(termo) {
  termo=String(termo||'').toLowerCase().trim();
  if(termo.length<2) return [];
  var nums=termo.replace(/\D/g,'');
  return fs_list_('ingressos',1000).filter(function(x){
    if(x.eventoId!==EMISSAO_CFG.EVENTO_ID) return false;
    var hay=[x.nome,x.numero,x.escola,x.cpf].join(' ').toLowerCase();
    return hay.indexOf(termo)>=0 || (nums && String(x.cpf||'').replace(/\D/g,'').indexOf(nums)>=0);
  }).slice(0,20).map(function(x){return {ingressoId:x.ingressoId||x._docId,numero:x.numero||'',nome:x.nome||'',cpf:x.cpf||'',escola:x.escola||'',categoria:x.categoria||'',status:x.status||'',utilizadoEm:x.utilizadoEm||'',utilizadoPor:x.utilizadoPor||''};});
}

function compasso_checkinManual(ingressoId, dispositivoId, motivo) {
  motivo=String(motivo||'').trim();
  if(!motivo) throw new Error('Motivo obrigatório para check-in manual.');
  var ing=fs_get_('ingressos',ingressoId); if(!ing) throw new Error('Ingresso não encontrado.');
  if(!ing.qrTokenHash) throw new Error('Ingresso sem QR válido.');
  var indice=fs_get_('qrTokens',ing.qrTokenHash); if(!indice) throw new Error('Índice do QR não encontrado.');
  // O token original não é persistido por segurança; check-in manual executa a mesma trava/status sob lock.
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    ing=fs_get_('ingressos',ingressoId);
    if(ing.status==='CANCELADO') return {ok:false,codigo:'CANCELADO',mensagem:'Ingresso cancelado.'};
    if(ing.status==='UTILIZADO') return {ok:false,codigo:'JA_UTILIZADO',mensagem:'Ingresso já utilizado.',utilizadoEm:ing.utilizadoEm,utilizadoPor:ing.utilizadoPor};
    if(ing.status!=='EMITIDO') return {ok:false,codigo:'STATUS_INVALIDO',mensagem:'Ingresso não liberado.'};
    var agora=new Date(),operador=compasso_emailUsuario_(),checkinId=compasso_uuid_();
    ing.status='UTILIZADO';ing.utilizadoEm=agora;ing.utilizadoPor=operador;ing.dispositivoId=String(dispositivoId||'manual');
    fs_set_('ingressos',ingressoId,ing);
    fs_set_('checkinsEventos',checkinId,{checkinId:checkinId,eventoId:EMISSAO_CFG.EVENTO_ID,ingressoId:ingressoId,numero:ing.numero,pessoaId:ing.pessoaId||'',checkinEm:agora,checkinPor:operador,dispositivoId:String(dispositivoId||'manual'),status:'VALIDO_MANUAL',motivo:motivo});
    compasso_auditar_('CHECKIN_MANUAL','ingresso',ingressoId,{checkinId:checkinId,motivo:motivo,dispositivoId:dispositivoId||''});
    return {ok:true,codigo:'LIBERADO',mensagem:'Entrada liberada manualmente.',nome:ing.nome,escola:ing.escola,categoria:ing.categoria,numero:ing.numero,checkinEm:agora};
  } finally {lock.releaseLock();}
}
