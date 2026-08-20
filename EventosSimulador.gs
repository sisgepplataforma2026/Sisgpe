/** COMPASSO 2026 — Simulador de homologação. NUNCA executar em produção. */
function compasso_assertHomologacao_() {
  if (!emissao_modoTeste_()) throw new Error('SIMULADOR BLOQUEADO: ambiente não está em modo teste.');
}
function compasso_simularMassa(quantidade) {
  compasso_assertHomologacao_();
  var permitidas=[10,50,200,1000,2000,2500];
  if (permitidas.indexOf(Number(quantidade))<0) throw new Error('Quantidade de teste não permitida.');
  var loteId='SIM-'+new Date().getTime();
  var resultado={loteId:loteId,tentativas:quantidade,emitidos:0,bloqueados:0,erros:0,inicio:new Date()};
  for(var i=1;i<=quantidade;i++){
    var cpf=String(90000000000+i).slice(-11);
    var r=compasso_emitirIngressoV2({
      categoria:'associado',nome:'SIMULADO '+String(i).padStart(4,'0'),cpf:cpf,
      pessoaId:loteId+'-'+i,escola:'ESCOLA SIMULADA '+((i%20)+1),
      validacaoStatus:COMPASSO_STATUS.VALIDADA,origem:'ADMIN',inscricaoId:loteId+'-INS-'+i
    });
    if(r.ok) resultado.emitidos++; else if(String(r.erro||'').indexOf('Vagas esgotadas')>=0) resultado.bloqueados++; else resultado.erros++;
  }
  resultado.fim=new Date();
  resultado.status=(resultado.erros===0 && resultado.emitidos<=EMISSAO_CFG.LIMITE_VAGAS)?'APROVADO':'REPROVADO';
  fs_set_('simulacoesEventos',loteId,{eventoId:EMISSAO_CFG.EVENTO_ID,tentativas:resultado.tentativas,emitidos:resultado.emitidos,bloqueados:resultado.bloqueados,erros:resultado.erros,status:resultado.status,inicio:resultado.inicio,fim:resultado.fim});
  compasso_auditar_('SIMULACAO_MASSA','evento',EMISSAO_CFG.EVENTO_ID,resultado);
  return resultado;
}

function compasso_testeDuplicidade(cpf) {
  compasso_assertHomologacao_();
  cpf=cpf||'99999999901';
  var base={categoria:'associado',nome:'TESTE DUPLICIDADE',cpf:cpf,pessoaId:'TEST-DUP-'+cpf,validacaoStatus:COMPASSO_STATUS.VALIDADA,origem:'ADMIN'};
  var primeiro=compasso_emitirIngressoV2(base);
  var segundo=compasso_emitirIngressoV2(base);
  return {primeiro:primeiro.ok,segundo:segundo.ok,aprovado:primeiro.ok && !segundo.ok,erroEsperado:segundo.erro||''};
}

function compasso_testeQrReutilizado(qrToken, dispositivoA, dispositivoB) {
  compasso_assertHomologacao_();
  var a=compasso_checkin(qrToken,dispositivoA||'CEL-A');
  var b=compasso_checkin(qrToken,dispositivoB||'CEL-B');
  return {primeira:a,segunda:b,aprovado:a.ok && !b.ok && b.codigo==='JA_UTILIZADO'};
}
