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
       secretaria enviar de novo o que a pessoa já recebeu. */criadoEm:x.criadoEm||'',protocolo:String(x.protocolo||''),confirmacaoEnviadaEm:x.confirmacaoEnviadaEm||'',confirmacaoVia:String(x.confirmacaoVia||''),confirmacaoErro:String(x.confirmacaoErro||''),/* o selo do painel: ASSOCIADO / NAO_FILIADO / NAO_ENCONTRADO */situacaoAssociado:String(x.situacaoAssociado||''),entrega:compasso_entregaDaInscricao_(x),origem:String(x.origem||'')};
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
  var hoje = new Date();
  /* `capacidade` sai daqui a partir de 26/08/2026 porque a tela precisa dizer
     "1.412 de 2.000" sem uma segunda ida ao servidor — e porque o número tem
     de vir do REGISTRO do evento, não de constante. É o resolvedor
     `compasso_limiteVagas_()` que decide, num lugar só. */
  var r={total:docs.length,naoAnalisadas:0,validadas:0,pendentes:0,reprovadas:0,
         aEnviar:0,enviadas:0,semIngresso:0,naoAssociados:0,
         capacidade:compasso_limiteVagas_(),
         chegada:compasso_chegadaVazia_()};
  for (var d7 = 0; d7 < 7; d7++) r.chegada.porDia.push(0);
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

    /* O RITMO DE CHEGADA sai da MESMA varredura, de propósito. Uma segunda
       listagem dobraria as leituras do Firestore só para contar data — e o
       consumo do dia 19/12 é justamente o que o executivo existe para vigiar. */
    compasso_contarChegada_(r.chegada, x.criadoEm, hoje);
  });
  return r;
}

/**
 * QUANTAS ENTRARAM, E QUANDO — 25/08/2026.
 *
 * O usuário decidiu mandar o link "aos poucos, não tudo de uma única vez".
 * Operar por levas exige um número que o painel não dava: quantas chegaram
 * desde a última leva. Sem ele, a decisão de mandar a próxima é no palpite.
 *
 * O que se conta e por quê:
 *   · últimas 24h — o tamanho da leva que acabou de entrar;
 *   · por dia, 7 dias — a curva, que mostra se o volume está subindo;
 *   · a última — se faz uma hora ou dois dias que ninguém se inscreve.
 */
function compasso_chegadaVazia_() {
  return { ultimas24h: 0, hoje: 0, porDia: [], ultimaEm: null };
}

function compasso_contarChegada_(chegada, criadoEm, hoje) {
  if (!chegada || !criadoEm) return;
  var d = (criadoEm instanceof Date) ? criadoEm : new Date(criadoEm);
  if (isNaN(d.getTime())) return;

  var agora = hoje.getTime();
  if (agora - d.getTime() <= 86400000) chegada.ultimas24h++;

  var meiaNoite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (d.getTime() >= meiaNoite.getTime()) chegada.hoje++;

  var diasAtras = Math.floor((meiaNoite.getTime() -
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diasAtras >= 0 && diasAtras <= 6) chegada.porDia[6 - diasAtras]++;

  if (!chegada.ultimaEm || d.getTime() > new Date(chegada.ultimaEm).getTime())
    chegada.ultimaEm = d;
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

/* ════════════════════════════════════════════════════════════════════════════
   CONFERÊNCIA DE VÍNCULO EM LOTE — 26/08/2026

   A REGRA DE NEGÓCIO, dita pelo usuário: ingresso próprio é só para associado;
   quem não é associado só entra como acompanhante pago, e esse cadastro é
   feito pela equipe, não por conversão de inscrição pública.

   Isso torna a análise da inscrição pública uma CONFERÊNCIA, não um
   julgamento: o CPF está na base de filiados ou não está. E conferência
   mecânica é trabalho que a REGRA Nº 0.6 manda o sistema fazer sozinho — a
   planilha do Sorteio trouxe 201 linhas, e três campos vezes 201 é meio dia
   de gente fazendo o que uma consulta faz.

   O QUE ESTA FUNÇÃO VALIDA SOZINHA, E SÓ ISSO: as inscrições ainda não
   analisadas cujo CPF está na base COM filiação ativa. Nada mais.

   O que ela deliberadamente NÃO faz, e o motivo de cada recusa:

   - NÃO reprova ninguém. Reprovar devolve a vaga e mexe no índice de inscrição
     única; feito em massa sobre uma leitura de base que pode estar
     desatualizada, apagaria inscrição legítima de quem se filiou semana
     passada. Reprovação continua sendo um a um, com motivo escrito.
   - NÃO mexe em quem consta na base sem filiação ativa (NAO_FILIADO). Esse é
     o caso que EXIGE julgamento — pode ser inadimplência, pode ser erro de
     cadastro, pode ser desfiliação recente.
   - NÃO toca em inscrição já analisada. Reanalisar em lote apagaria a decisão
     de uma pessoa sem ela saber.

   A situação do vínculo é RELIDA da base, não aproveitada do que ficou
   gravado na importação: o nome da função promete conferir contra a base, e
   uma conferência que lê o próprio palpite anterior não é conferência.
   ════════════════════════════════════════════════════════════════════════════ */
function compasso_conferirVinculoEmLote(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — conferência de vínculo em lote', true);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var docs = compasso_validacaoListar_interno_({});
    var r = { ok: true, validadas: 0, naoFiliados: 0, foraDaBase: 0, jaAnalisadas: 0, erros: [] };
    var quem = compasso_emailUsuario_(), agora = new Date();

    docs.forEach(function (x) {
      var status = String(x.status || '');
      /* Já analisada é decisão de gente: não se desfaz em lote. */
      if (status && status !== COMPASSO_STATUS.RECEBIDA) { r.jaAnalisadas++; return; }

      var situacao = compasso_situacaoAssociado_(
        compasso_buscarAssociado_(compasso_cpfNormalizado_(x.cpf)));

      if (situacao === 'NAO_FILIADO')    { r.naoFiliados++; }
      else if (situacao === 'NAO_ENCONTRADO') { r.foraDaBase++; }

      try {
        var ins = fs_get_('inscricoesEventos', x.inscricaoId);
        if (!ins) return;
        /* A releitura do vínculo é gravada mesmo quando não valida: é o dado
           que a tela usa para mostrar o veredito, e deixá-lo velho faria a
           tela contradizer a conferência que acabou de rodar. */
        ins.situacaoAssociado = situacao;
        if (situacao === 'ASSOCIADO') {
          ins.status = COMPASSO_STATUS.VALIDADA;
          ins.analisadoPor = quem;
          ins.analisadoEm = agora;
          ins.motivoCodigo = '';
          ins.observacaoAnalise = 'Validada em conferência de vínculo em lote.';
          r.validadas++;
        }
        fs_set_('inscricoesEventos', x.inscricaoId, ins);
      } catch (e) {
        r.erros.push({ inscricaoId: x.inscricaoId, nome: x.nome, erro: String(e && e.message || e) });
      }
    });

    compasso_auditar_('CONFERENCIA_VINCULO_LOTE', 'evento', EMISSAO_CFG.EVENTO_ID, {
      validadas: r.validadas, naoFiliados: r.naoFiliados,
      foraDaBase: r.foraDaBase, jaAnalisadas: r.jaAnalisadas, erros: r.erros.length
    });

    r.mensagem = r.validadas + ' validada(s) automaticamente. ' +
      'Continuam esperando decisão: ' + r.naoFiliados + ' não filiado(s) e ' +
      r.foraDaBase + ' fora da base.';
    return r;
  } finally {
    lock.releaseLock();
  }
}
