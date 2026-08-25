/**
 * COMPASSO 2026 — Central administrativa de validação.
 *
 * TRAVA DE SESSÃO (21/08/2026)
 *
 * Toda função global sem "_" no fim é alcançável por google.script.run a
 * partir de QUALQUER página do projeto, inclusive as públicas. A auditoria de
 * hoje encontrou 32 funções da camada Compasso nessa condição — entre elas
 * `compasso_validarDecisaoAdmin`, que aprova inscrição, e
 * `compasso_validacaoListar`, que devolve nome, CPF e escola de todo mundo.
 *
 * A trava usada é `exigirAdminOuSessao_` (AcessoModulos.gs), a porta dupla:
 *   - com token   → vale a permissão do módulo "eventos" no SISGEP;
 *   - sem token   → só passa o dono do projeto ou ADMINISTRADOR ATIVO,
 *                   identificado pela conta Google (é o caso do diálogo
 *                   aberto pela planilha, que não tem como ter token);
 *   - anônimo     → recusa.
 *
 * Foi escolhida em vez de `exigirModulo_` justamente porque estas telas ainda
 * abrem por `showModalDialog` — ali não existe tokenSessao, e uma trava que
 * exigisse token deixaria a Central de Validação inutilizável.
 */
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

function compasso_validacaoListar(filtros, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — listar inscrições', false);
  return compasso_validacaoListar_interno_(filtros);
}

/* Sem trava de propósito: só é alcançável de dentro deste arquivo, e quem
   chama já checou. Repetir a checagem aqui faria o resumo pagar duas vezes. */
function compasso_validacaoListar_interno_(filtros) {
  filtros=filtros||{};
  var busca=String(filtros.busca||'').toLowerCase().trim();
  var status=String(filtros.status||'').trim();
  var escola=String(filtros.escola||'').toLowerCase().trim();
  var cidade=String(filtros.cidade||'').toLowerCase().trim();
  var regiao=String(filtros.regiao||'').toLowerCase().trim();
  var categoria=String(filtros.categoria||'').toLowerCase().trim();
  var assoc=String(filtros.situacaoAssociado||'').trim();
  var entrega=String(filtros.entrega||'').trim();
  /* Excluída sai de TODA listagem, e antes de qualquer filtro. O documento
     continua no Firestore com quem excluiu e por quê — é exclusão lógica —,
     mas para a tela e para os cards ela deixou de existir. Se esta linha
     ficasse depois dos filtros, o card "total" contaria gente excluída. */
  var docs=fs_list_('inscricoesEventos',1000).filter(function(x){
    return x.eventoId===EMISSAO_CFG.EVENTO_ID && !x.excluida;
  });
  docs=docs.filter(function(x){
    /* 'NAO_ANALISADA' é sentinela do painel para "ainda sem status gravado".
       Precisa existir porque status vazio não dá para pedir por igualdade —
       string vazia é indistinguível de "não filtrar". */
    if(status==='NAO_ANALISADA'){ if(String(x.status||'')) return false; }
    else if(status && x.status!==status) return false;
    if(escola && String(x.escola||'').toLowerCase().indexOf(escola)<0) return false;
    if(cidade && String(x.cidade||'').toLowerCase().indexOf(cidade)<0) return false;
    if(regiao && String(x.regiao||'').toLowerCase().indexOf(regiao)<0) return false;
    if(categoria && String(x.categoria||'').toLowerCase()!==categoria) return false;
    if(assoc && String(x.situacaoAssociado||'')!==assoc) return false;
    /* Entrega é derivada, não é campo: 'A_ENVIAR' é ter ingresso e não ter
       saído ainda. É o filtro que o usuário vai usar todo dia. */
    if(entrega==='A_ENVIAR' && !(x.ingressoId && !(x.entregaCanais||''))) return false;
    if(entrega==='ENVIADA'  && !String(x.entregaCanais||'')) return false;
    if(entrega==='SEM_INGRESSO' && x.ingressoId) return false;
    /* COM_INGRESSO é o complemento de SEM_INGRESSO, e é o que a aba
       "Participantes" pede: quem já tem ingresso emitido, tendo saído ou não.
       Sem ele, "participante" só existiria como a soma de dois cards. */
    if(entrega==='COM_INGRESSO' && !x.ingressoId) return false;
    if(busca){
      var hay=[x.nome,x.cpf,x.escola,x.cidade,x.regiao,x.inscricaoId].join(' ').toLowerCase();
      if(hay.indexOf(busca)<0) return false;
    }
    return true;
  });
  docs.sort(function(a,b){return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');});
  return docs.map(function(x){
    /* categoria e pagamento entram aqui em 21/08/2026: sem eles a Central não
       tem como decidir se mostra o bloco de pagamento nem o que exibir nele.
       ingressoId vai junto porque o estorno é recusado depois de emitido. */
    return {inscricaoId:x.inscricaoId||x._docId,nome:x.nome||'',cpf:x.cpf||'',escola:x.escola||'',cidade:x.cidade||'',regiao:x.regiao||'',status:x.status||'',analisadoPor:x.analisadoPor||'',analisadoEm:x.analisadoEm||'',motivoCodigo:x.motivoCodigo||'',observacaoAnalise:x.observacaoAnalise||'',pessoaId:x.pessoaId||'',email:x.email||'',whatsapp:x.whatsapp||'',matricula:x.matricula||'',categoria:String(x.categoria||'').toLowerCase(),ingressoId:x.ingressoId||'',numeroIngresso:x.numeroIngresso||'',pagamento:compasso_pagamentoDaInscricao_(x),/* o comprovante da INSCRIÇÃO — não confundir com a entrega do ingresso.
       A gaveta precisa saber se ele já saiu e por onde, para não mandar a
       secretaria enviar de novo o que a pessoa já recebeu. */protocolo:String(x.protocolo||''),confirmacaoEnviadaEm:x.confirmacaoEnviadaEm||'',confirmacaoVia:String(x.confirmacaoVia||''),confirmacaoErro:String(x.confirmacaoErro||''),/* o selo do painel: ASSOCIADO / NAO_FILIADO / NAO_ENCONTRADO */situacaoAssociado:String(x.situacaoAssociado||''),entrega:compasso_entregaDaInscricao_(x),origem:String(x.origem||'')};
  });
}

/**
 * Os números dos cards do painel.
 *
 * Contam ESTADO, não assunto — é o item 4 do PROMPT-MESTRE. Cada card vira um
 * filtro clicável, e o que a pessoa precisa saber ao abrir a tela é: quanta
 * fila tem para analisar, e quanto já validado ainda não foi entregue.
 * "A ENVIAR" é o card que gera trabalho; sem ele, ingresso emitido fica
 * parado sem ninguém perceber.
 */
function compasso_validacaoResumo(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — resumo da validação', false);
  var docs=compasso_validacaoListar_interno_({});
  var r={total:docs.length,naoAnalisadas:0,validadas:0,pendentes:0,reprovadas:0,
         aEnviar:0,enviadas:0,semIngresso:0,naoAssociados:0};
  docs.forEach(function(x){
    if(x.status===COMPASSO_STATUS.VALIDADA) r.validadas++;
    else if(x.status===COMPASSO_STATUS.PENDENTE) r.pendentes++;
    else if(x.status===COMPASSO_STATUS.REPROVADA) r.reprovadas++;
    else r.naoAnalisadas++;

    var entregue = !!(x.entrega && x.entrega.enviado);
    if (x.ingressoId && entregue) r.enviadas++;
    if (x.ingressoId && !entregue) r.aEnviar++;
    if (x.status===COMPASSO_STATUS.VALIDADA && !x.ingressoId) r.semIngresso++;
    if (x.situacaoAssociado && x.situacaoAssociado !== 'ASSOCIADO') r.naoAssociados++;
  });
  return r;
}

function compasso_validacaoSalvarDados(inscricaoId, patch, atualizarCadastroMestre, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — alterar dados da inscrição', false);
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

function compasso_validacaoOpcoes(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — opções de motivo', false);
  function opts(arr){return arr.map(function(c){return {codigo:c,label:COMPASSO_MOTIVOS_LABELS[c]||c};});}
  /* `admin` viaja aqui em vez de numa função pública própria: a tela precisa
     dele para decidir se desenha "Excluir", e abrir mais uma porta global só
     para responder true/false custaria uma linha na conta do t6-exposicao sem
     entregar nada em troca. */
  return {reprovacao:opts(COMPASSO_MOTIVOS_REPROVACAO),pendencia:opts(COMPASSO_MOTIVOS_PENDENCIA),usuario:compasso_emailUsuario_(),admin:compasso_ehAdministrador_(tokenSessao)};
}

function compasso_validacaoDuplicidades(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — duplicidades', false);
  var docs=compasso_validacaoListar_interno_({}), mapa={}, out=[];
  docs.forEach(function(x){
    if(x.status===COMPASSO_STATUS.REPROVADA) return;
    var cpf=compasso_cpfNormalizado_(x.cpf), key=x.pessoaId?('P:'+x.pessoaId):(cpf?('C:'+cpf):('N:'+String(x.nome||'').toLowerCase()+'|'+String(x.escola||'').toLowerCase()));
    if(!mapa[key]) mapa[key]=[]; mapa[key].push(x);
  });
  Object.keys(mapa).forEach(function(k){if(mapa[k].length>1) out.push({chave:k,itens:mapa[k]});});
  return out;
}

/**
 * LEGADO — mantida de propósito, sem caminho na tela (24/08/2026).
 *
 * A Central de Validação era a segunda tela: para analisar uma inscrição a
 * pessoa saía do Painel de Inscrições, abria esta e procurava o mesmo nome de
 * novo. O usuário pediu o contrário — "tudo em um único painel" —, e tudo o
 * que esta tela fazia passou a existir na gaveta de CompassoInscricoes.html:
 * editar dados, pagamento, validar, pendência, reprovar com motivo.
 *
 * O card que apontava para cá saiu de EventosAdmin.html. Isto aqui FICA, com
 * o arquivo EventosValidacaoAdmin.html, para o caso de algo ter escapado da
 * migração — voltar é um card de HTML, e apagar seria irreversível.
 *
 * DE QUEBRA, UM ACHADO: o aviso que a tela de Eventos dava mandava abrir esta
 * Central pelo menu "🎫 Eventos › Central de Validação" da planilha. Esse item
 * de menu NUNCA EXISTIU — `criarMenuEventos` (EventosPainel.gs) só cadastra
 * "Emissão de Ingressos". Quem seguisse a instrução não encontraria nada.
 */
function abrirCentralValidacaoCompasso(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — abrir Central de Validação', false);
  var html=HtmlService.createHtmlOutputFromFile('EventosValidacaoAdmin').setWidth(1200).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html,'Compasso 2026 — Central de Validação');
}
