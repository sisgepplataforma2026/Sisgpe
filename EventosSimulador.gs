/** COMPASSO 2026 — Simulador de homologação. NUNCA executar em produção. */
function compasso_assertHomologacao_() {
  var amb=String(PropertiesService.getScriptProperties().getProperty('SISGEP_AMBIENTE')||'').toUpperCase();
  if (!emissao_modoTeste_() || amb !== 'HOMOLOGACAO') throw new Error('SIMULADOR BLOQUEADO: exige EVENTO_MODO_TESTE=true e SISGEP_AMBIENTE=HOMOLOGACAO.');
}

function compasso_simulacaoIniciar(quantidade) {
  compasso_assertHomologacao_();
  var permitidas=[10,50,200,1000,2000,2500];quantidade=Number(quantidade);
  if(permitidas.indexOf(quantidade)<0)throw new Error('Quantidade de teste não permitida.');
  var loteId='SIM-'+new Date().getTime();
  fs_set_('simulacoesEventos',loteId,{loteId:loteId,eventoId:EMISSAO_CFG.EVENTO_ID,tentativas:quantidade,proximo:1,inscritos:0,validados:0,emitidos:0,bloqueados:0,erros:0,status:'EM_EXECUCAO',inicio:new Date()});
  compasso_auditar_('SIMULACAO_INICIADA','evento',EMISSAO_CFG.EVENTO_ID,{loteId:loteId,tentativas:quantidade});
  return {ok:true,loteId:loteId,tentativas:quantidade,aviso:'Execute compasso_simulacaoExecutarLote(loteId) até status CONCLUIDA.'};
}

function compasso_simulacaoExecutarLote(loteId,tamanhoLote) {
  compasso_assertHomologacao_();tamanhoLote=Math.min(Math.max(Number(tamanhoLote||25),1),50);
  var s=fs_get_('simulacoesEventos',loteId);if(!s)throw new Error('Simulação não encontrada.');if(s.status==='CONCLUIDA')return s;
  var fim=Math.min(Number(s.tentativas),Number(s.proximo)+tamanhoLote-1);
  for(var i=Number(s.proximo);i<=fim;i++){
    var cpf=String(90000000000+i).slice(-11),pessoaId=loteId+'-P-'+i;
    var ri=compasso_criarInscricaoAssociado({nome:'SIMULADO '+String(i).padStart(4,'0'),cpf:cpf,pessoaId:pessoaId,escola:'ESCOLA SIMULADA '+((i%20)+1),cidade:'CIDADE '+((i%5)+1),origem:'SIMULADOR'});
    if(!ri.ok){if(String(ri.erro||'').toLowerCase().indexOf('vagas')>=0)s.bloqueados=Number(s.bloqueados||0)+1;else s.erros=Number(s.erros||0)+1;continue;}
    s.inscritos=Number(s.inscritos||0)+1;
    try{compasso_validarDecisaoAdmin(ri.inscricaoId,COMPASSO_STATUS.VALIDADA,'','');s.validados=Number(s.validados||0)+1;var re=compasso_emitirIngressoV2({inscricaoId:ri.inscricaoId});if(re.ok)s.emitidos=Number(s.emitidos||0)+1;else s.erros=Number(s.erros||0)+1;}catch(e){s.erros=Number(s.erros||0)+1;}
  }
  s.proximo=fim+1;s.atualizadoEm=new Date();
  if(Number(s.proximo)>Number(s.tentativas)){s.status='CONCLUIDA';s.fim=new Date();s.aprovado=(Number(s.erros||0)===0 && Number(s.emitidos||0)<=EMISSAO_CFG.LIMITE_VAGAS && (Number(s.tentativas)<=EMISSAO_CFG.LIMITE_VAGAS || Number(s.bloqueados||0)===Number(s.tentativas)-EMISSAO_CFG.LIMITE_VAGAS));compasso_auditar_('SIMULACAO_CONCLUIDA','evento',EMISSAO_CFG.EVENTO_ID,s);}
  fs_set_('simulacoesEventos',loteId,s);return s;
}

function compasso_simularMassa(quantidade) {
  quantidade=Number(quantidade);var ini=compasso_simulacaoIniciar(quantidade);
  if(quantidade<=50)return compasso_simulacaoExecutarLote(ini.loteId,50);
  return ini;
}

function compasso_testeDuplicidade(cpf) {
  compasso_assertHomologacao_();cpf=cpf||String(Date.now()).slice(-11);var pessoaId='TEST-DUP-'+cpf;
  var a=compasso_criarInscricaoAssociado({nome:'TESTE DUPLICIDADE',cpf:cpf,pessoaId:pessoaId,origem:'SIMULADOR'});
  var b=compasso_criarInscricaoAssociado({nome:'TESTE DUPLICIDADE',cpf:cpf,pessoaId:pessoaId,origem:'SIMULADOR'});
  return {primeira:a,segunda:b,aprovado:!!a.ok&&!b.ok,erroEsperado:b.erro||''};
}

function compasso_testeQrReutilizado(qrToken,dispositivoA,dispositivoB) {
  compasso_assertHomologacao_();var a=compasso_checkin(qrToken,dispositivoA||'CEL-A'),b=compasso_checkin(qrToken,dispositivoB||'CEL-B');
  return {primeira:a,segunda:b,aprovado:a.ok&&!b.ok&&b.codigo==='JA_UTILIZADO'};
}
