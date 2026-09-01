/** COMPASSO 2026 — Pilar 1: inscrições V2. */
function compasso_inscricaoChave_(pessoaId, cpf) {
  return compasso_chavePessoaEvento_(EMISSAO_CFG.EVENTO_ID,pessoaId,cpf);
}

function compasso_lerReservaVagas_() {
  var r=fs_get_('reservasEventos',EMISSAO_CFG.EVENTO_ID);
  if(!r) r={eventoId:EMISSAO_CFG.EVENTO_ID,limite:compasso_limiteVagas_(),reservadas:0};
  /* O limite gravado é cache do registro do evento, não verdade própria: se a
     lotação foi corrigida no cadastro, é ela que vale a partir de agora. */
  r.limite = compasso_limiteVagas_();
  return r;
}

function compasso_reservarVagaInscricao_() {
  var r=compasso_lerReservaVagas_();
  if(Number(r.reservadas||0)>=Number(r.limite||compasso_limiteVagas_())) return {ok:false,erro:'Vagas de inscrição esgotadas.'};
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
    /* Mesma liberação de homologação da porta pública: as três travas de
       unicidade afrouxam juntas, senão o teste morre na primeira que sobrar. */
    if(indice && indice.status!=='CANCELADA' && indice.status!=='REPROVADA' && !compasso_repeticaoLiberada_()) return {ok:false,erro:'Esta pessoa já possui inscrição neste evento.',inscricaoId:indice.inscricaoId};
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
/* ══════════════════════════════════════════════════════════════════════════
   AS DUAS CATEGORIAS QUE NÃO NASCEM DE INSCRIÇÃO PÚBLICA

   Regra confirmada pelo usuário em 26/08/2026:
     • ingresso próprio é só para ASSOCIADO;
     • CONVIDADO é gratuito e entra por indicação da diretoria;
     • ACOMPANHANTE é avulso, paga R$ 500, e NÃO precisa estar vinculado a um
       associado titular — pode ser qualquer pessoa.

   Por isso a função recusa `associado`: essa categoria tem porta própria (o
   formulário público). Aqui é a porta da equipe.

   ESTA FUNÇÃO FICOU SEM TELA DE 21/08 A 26/08. Entrou no commit e086213 e
   nenhum `.html` a chamava — conferido pelos 5 passos da REGRA Nº 1: não está
   em Code.gs, não está em rota doGet, não está em trigger, não aparece em
   nenhum `.html`. O motor existia e a equipe não tinha como cadastrar
   acompanhante nem convidado. A tela entrou junto com esta revisão.

   `indicadoPor` nasceu aqui, e não é enfeite: se a diretoria indica o
   convidado, o nome de quem indicou é a única resposta possível para a
   pergunta que alguém faz em dezembro, na porta do salão, sobre por que
   fulano está na lista. `titularId` continua aceito por compatibilidade —
   acompanhante avulso não usa, mas apagar o campo quebraria registro antigo.
   ══════════════════════════════════════════════════════════════════════════ */
function compasso_criarInclusaoAdministrativa(payload, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — inclusão administrativa', true);
  payload=payload||{};var cat=String(payload.categoria||'').toLowerCase();if(['convidado','acompanhante'].indexOf(cat)<0)return {ok:false,erro:'Inclusão administrativa deve ser convidado ou acompanhante.'};
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    if(!String(payload.nome||'').trim()) return {ok:false,erro:'Nome é obrigatório.'};
    /* Convidado sem quem indicou é convidado que ninguém sabe explicar. */
    var indicadoPor = String(payload.indicadoPor||'').trim();
    if (cat === 'convidado' && !indicadoPor)
      return {ok:false, erro:'Convidado é por indicação da diretoria — informe quem indicou.'};
    var vaga=compasso_reservarVagaInscricao_();if(!vaga.ok)return vaga;
    var id='INS-'+Utilities.getUuid(),agora=new Date();
    var ins={inscricaoId:id,eventoId:EMISSAO_CFG.EVENTO_ID,pessoaId:String(payload.pessoaId||compasso_uuid_()),nome:String(payload.nome||'').trim(),cpf:String(payload.cpf||'').trim(),escola:String(payload.escola||'').trim(),cidade:String(payload.cidade||'').trim(),regiao:String(payload.regiao||'').trim(),email:String(payload.email||'').trim(),whatsapp:String(payload.whatsapp||'').trim(),categoria:cat,origem:cat==='convidado'?'ADMIN_CONVIDADO':'ADMIN_ACOMPANHANTE',titularId:String(payload.titularId||''),indicadoPor:indicadoPor,status:COMPASSO_STATUS.VALIDADA,vagaReservada:true,criadoEm:agora,criadoPor:compasso_emailUsuario_(),analisadoPor:compasso_emailUsuario_(),analisadoEm:agora};
    fs_set_('inscricoesEventos',id,ins);compasso_auditar_('INCLUSAO_ADMINISTRATIVA','inscricao',id,{categoria:cat,indicadoPor:indicadoPor,titularId:ins.titularId});return {ok:true,inscricaoId:id,status:ins.status};
  } finally {lock.releaseLock();}
}

/* Repassa o token adiante em vez de deixar compasso_validarDecisaoAdmin cair
   no caminho da conta Google: sem o repasse, uma chamada legítima com token
   seria checada como se viesse do editor. */
function compasso_reprovarInscricaoLiberandoVaga(inscricaoId,motivoCodigo,observacao,tokenSessao){exigirAdminOuSessao_(tokenSessao,'eventos','Compasso — reprovar liberando vaga',false);var r=compasso_validarDecisaoAdmin(inscricaoId,COMPASSO_STATUS.REPROVADA,motivoCodigo,observacao,tokenSessao);if(r.ok)compasso_liberarVagaInscricao_(inscricaoId);return r;}

/* ============================================================================
 * EXCLUIR INSCRIÇÃO — só administrador
 * ============================================================================
 *
 * Pedido do usuário em 24/08/2026: "deve ter sim, podendo ser excluído pelo
 * administrador". A tela ganha o botão; aqui ficam as três travas que ele
 * pediu sem pedir, porque são o que separa "excluir" de "perder".
 *
 * 1. É ADMINISTRADOR, não o módulo. Reprovar qualquer pessoa do módulo eventos
 *    faz; excluir, não. É a única ação da tela que tira o registro de vista.
 *
 * 2. É EXCLUSÃO LÓGICA. O documento fica, marcado `excluida`, e some da
 *    listagem. Não é meio-termo tímido: apagar de verdade levaria junto o
 *    rastro de que a inscrição existiu, quem a excluiu e por quê — e é
 *    exatamente esse rastro que alguém vai procurar quando a pessoa aparecer
 *    na portaria dizendo que se inscreveu. O efeito na tela é o mesmo, e o
 *    erro é reversível.
 *
 * 3. INGRESSO EMITIDO BARRA. Excluir com ingresso vivo deixaria um QR válido
 *    apontando para uma inscrição que não existe mais — a portaria deixaria
 *    entrar. Cancele o ingresso primeiro; são dois cliques, e o segundo é
 *    consciente.
 *
 * A vaga volta para as 2.000, e o índice de inscrição única é liberado: sem
 * isso a pessoa excluída não conseguiria se inscrever de novo, e ninguém
 * entenderia por quê.
 */
function compasso_excluirInscricao(inscricaoId, motivo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — excluir inscrição', true);

  motivo = String(motivo || '').trim();
  if (!motivo) return { ok:false, erro:'Descreva o motivo da exclusão.' };

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ins = fs_get_('inscricoesEventos', inscricaoId);
    if (!ins) return { ok:false, erro:'Inscrição não encontrada.' };
    if (ins.excluida) return { ok:false, erro:'Esta inscrição já foi excluída.' };

    if (ins.ingressoId) return {
      ok:false, codigo:'INGRESSO_ATIVO',
      erro:'Esta inscrição tem ingresso emitido (' + (ins.numeroIngresso || ins.ingressoId) +
           '). Cancele o ingresso antes de excluir — senão o QR continuaria ' +
           'válido na portaria.'
    };

    /* A vaga volta antes de a inscrição sair de vista: se algo falhar depois,
       o pior caso é uma vaga livre a mais, não uma vaga presa para sempre. */
    compasso_liberarVagaInscricao_(inscricaoId);

    ins = fs_get_('inscricoesEventos', inscricaoId) || ins;
    ins.excluida = true;
    ins.excluidaEm = new Date();
    ins.excluidaPor = compasso_emailUsuario_();
    ins.motivoExclusao = motivo;
    fs_set_('inscricoesEventos', inscricaoId, ins);

    /* Libera o índice de inscrição única — senão a pessoa excluída não
       conseguiria se inscrever de novo, e a mensagem diria que ela já tem
       inscrição, sem nenhuma inscrição à vista. */
    try {
      var chave = compasso_chavePessoaEvento_(EMISSAO_CFG.EVENTO_ID, ins.pessoaId, ins.cpf);
      var idx = fs_get_('inscricaoUnicaEventos', chave);
      if (idx) { idx.status = 'CANCELADA'; idx.atualizadoEm = new Date();
                 fs_set_('inscricaoUnicaEventos', chave, idx); }
    } catch (ignore) {}

    compasso_auditar_('EXCLUSAO_INSCRICAO', 'inscricao', inscricaoId, {
      motivo: motivo, nome: ins.nome || '', cpf: ins.cpf || '', status: ins.status || ''
    });
    return { ok:true, inscricaoId:inscricaoId };
  } finally { lock.releaseLock(); }
}

/**
 * EXCLUIR VÁRIAS DE UMA VEZ.
 *
 * Pedido do usuário em 24/08/2026: "as inscrições importadas não têm opção de
 * excluir todos". Ele tinha 122 linhas erradas para apagar e o único caminho
 * era abrir uma a uma.
 *
 * Não reimplementa nada: chama `compasso_excluirInscricao` para cada id, e
 * portanto herda as três travas inteiras — administrador, motivo obrigatório
 * e recusa com ingresso emitido. Uma versão "em lote" com regra própria seria
 * a mesma armadilha das duas regras de nome de ontem.
 *
 * Devolve o que deu certo E o que não deu, com motivo. Um lote que diz apenas
 * "82 excluídas" esconde as 40 que ficaram, e a pessoa só descobre relendo a
 * lista.
 */
function compasso_excluirInscricoesEmLote(ids, motivo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — excluir em lote', true);
  ids = (ids || []).filter(function (x) { return String(x || '').trim(); });
  if (!ids.length) return { ok:false, erro:'Selecione ao menos uma inscrição.' };
  if (!String(motivo || '').trim()) return { ok:false, erro:'Descreva o motivo da exclusão.' };

  var excluidas = 0, recusadas = [];
  for (var i = 0; i < ids.length; i++) {
    var r;
    try { r = compasso_excluirInscricao(ids[i], motivo, tokenSessao); }
    catch (e) { r = { ok:false, erro:e.message }; }
    if (r && r.ok) excluidas++;
    else recusadas.push({ inscricaoId: ids[i], motivo: (r && r.erro) || 'recusada' });
  }

  compasso_auditar_('EXCLUSAO_INSCRICAO_LOTE', 'inscricao', '', {
    pedidas: ids.length, excluidas: excluidas, recusadas: recusadas.length, motivo: motivo
  });

  return {
    ok: true, excluidas: excluidas, recusadas: recusadas,
    mensagem: excluidas + ' inscrição(ões) excluída(s)' +
      (recusadas.length ? ' · ' + recusadas.length + ' não pôde(puderam) ser excluída(s)' : '') + '.'
  };
}

/**
 * A tela precisa saber se quem abriu é administrador, para não desenhar
 * "Excluir" para quem vai levar recusa.
 *
 * Isto é um helper PRIVADO de propósito. A resposta viaja dentro de
 * compasso_validacaoOpcoes, que a tela já chama e que já é protegida — uma
 * função pública nova só para responder true/false seria mais uma porta
 * aberta na conta do t6-exposicao, em troca de nada.
 *
 * Não reescreve a regra de quem é administrador: chama a mesma trava do
 * backend e olha se ela deixou passar. Duas cópias da regra é como uma delas
 * fica para trás.
 */
function compasso_ehAdministrador_(tokenSessao) {
  try {
    exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — checagem de administrador', true);
    return true;
  } catch (e) { return false; }
}
