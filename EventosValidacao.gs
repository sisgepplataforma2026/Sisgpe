/** COMPASSO 2026 — Central administrativa de validação. */
var COMPASSO_MOTIVOS_LABELS = {
  NAO_LOCALIZADO_ASSOCIADO:'Não localizado como associado',
  NAO_E_ASSOCIADO:'Não é associado',
  VINCULO_NAO_CONFIRMADO:'Vínculo não confirmado',
  INSCRICAO_DUPLICADA:'Inscrição duplicada',
  DADOS_INCONSISTENTES:'Dados inconsistentes',
  NAO_ATENDE_REGRAS_EVENTO:'Não atende às regras do evento',
  INSCRICAO_INDEVIDA:'Inscrição realizada indevidamente',
  SOLICITACAO_ASSOCIADO:'Solicitação do próprio associado',
  AGUARDANDO_CONFIRMACAO_VINCULO:'Aguardando confirmação de vínculo',
  ASSOCIADO_RECENTE:'Associado recente',
  DADOS_DIVERGENTES:'Dados divergentes',
  AGUARDANDO_CONTATO_ASSOCIADO:'Aguardando contato com o associado',
  AGUARDANDO_CONFIRMACAO_ESCOLA:'Aguardando confirmação da escola',
  AGUARDANDO_DOCUMENTO_COMPROVACAO:'Aguardando documento/comprovação',
  OUTRO:'Outro'
};

function compasso_validacaoListar(filtros) {
  filtros=filtros||{};
  var busca=String(filtros.busca||'').toLowerCase().trim();
  var status=String(filtros.status||'').trim();
  var escola=String(filtros.escola||'').toLowerCase().trim();
  var cidade=String(filtros.cidade||'').toLowerCase().trim();
  var docs=fs_list_('inscricoesEventos',1000).filter(function(x){return x.eventoId===EMISSAO_CFG.EVENTO_ID;});
  docs=docs.filter(function(x){
    if(status && x.status!==status) return false;
    if(escola && String(x.escola||'').toLowerCase().indexOf(escola)<0) return false;
    if(cidade && String(x.cidade||'').toLowerCase().indexOf(cidade)<0) return false;
    if(busca){
      var hay=[x.nome,x.cpf,x.escola,x.cidade,x.regiao,x.inscricaoId].join(' ').toLowerCase();
      if(hay.indexOf(busca)<0) return false;
    }
    return true;
  });
  docs.sort(function(a,b){return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');});
  return docs.map(function(x){
    return {inscricaoId:x.inscricaoId||x._docId,nome:x.nome||'',cpf:x.cpf||'',escola:x.escola||'',cidade:x.cidade||'',regiao:x.regiao||'',status:x.status||'',analisadoPor:x.analisadoPor||'',analisadoEm:x.analisadoEm||'',motivoCodigo:x.motivoCodigo||'',observacaoAnalise:x.observacaoAnalise||'',pessoaId:x.pessoaId||'',email:x.email||'',whatsapp:x.whatsapp||'',matricula:x.matricula||''};
  });
}

function compasso_validacaoResumo() {
  var docs=compasso_validacaoListar({});
  var r={total:docs.length,naoAnalisadas:0,validadas:0,pendentes:0,reprovadas:0};
  docs.forEach(function(x){
    if(x.status===COMPASSO_STATUS.VALIDADA) r.validadas++;
    else if(x.status===COMPASSO_STATUS.PENDENTE) r.pendentes++;
    else if(x.status===COMPASSO_STATUS.REPROVADA) r.reprovadas++;
    else r.naoAnalisadas++;
  });
  return r;
}

function compasso_validacaoSalvarDados(inscricaoId, patch, atualizarCadastroMestre) {
  var ins=fs_get_('inscricoesEventos',inscricaoId); if(!ins) throw new Error('Inscrição não encontrada.');
  var permitido=['nome','cpf','escola','cidade','regiao','email','whatsapp','matricula'];
  var alteracoes={}; patch=patch||{};
  permitido.forEach(function(k){ if(Object.prototype.hasOwnProperty.call(patch,k) && String(ins[k]||'')!==String(patch[k]||'')){alteracoes[k]={de:ins[k]||'',para:patch[k]||''};ins[k]=String(patch[k]||'').trim();}});
  if(!Object.keys(alteracoes).length) return {ok:true,semAlteracoes:true};
  ins.atualizadoPor=compasso_emailUsuario_(); ins.atualizadoEm=new Date();
  fs_set_('inscricoesEventos',inscricaoId,ins);
  compasso_auditar_('ALTERACAO_DADOS_INSCRICAO','inscricao',inscricaoId,{alteracoes:alteracoes,atualizarCadastroMestre:!!atualizarCadastroMestre});
  return {ok:true,alteracoes:alteracoes,aviso:atualizarCadastroMestre?'Atualização do cadastro mestre deve ser executada pelo serviço cadastral oficial.':''};
}

function compasso_validacaoOpcoes() {
  function opts(arr){return arr.map(function(c){return {codigo:c,label:COMPASSO_MOTIVOS_LABELS[c]||c};});}
  return {reprovacao:opts(COMPASSO_MOTIVOS_REPROVACAO),pendencia:opts(COMPASSO_MOTIVOS_PENDENCIA),usuario:compasso_emailUsuario_()};
}

function compasso_validacaoDuplicidades() {
  var docs=compasso_validacaoListar({}), mapa={}, out=[];
  docs.forEach(function(x){
    if(x.status===COMPASSO_STATUS.REPROVADA) return;
    var cpf=compasso_cpfNormalizado_(x.cpf), key=x.pessoaId?('P:'+x.pessoaId):(cpf?('C:'+cpf):('N:'+String(x.nome||'').toLowerCase()+'|'+String(x.escola||'').toLowerCase()));
    if(!mapa[key]) mapa[key]=[]; mapa[key].push(x);
  });
  Object.keys(mapa).forEach(function(k){if(mapa[k].length>1) out.push({chave:k,itens:mapa[k]});});
  return out;
}

function abrirCentralValidacaoCompasso() {
  var html=HtmlService.createHtmlOutputFromFile('EventosValidacaoAdmin').setWidth(1200).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html,'Compasso 2026 — Central de Validação');
}
