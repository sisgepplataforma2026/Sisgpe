/** COMPASSO 2026 — painel mobile da portaria. */
function abrirPainelCheckinCompasso(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — abrir portaria', false);
  var html=HtmlService.createHtmlOutputFromFile('EventosPortaria').setWidth(480).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html,'Compasso 2026 — Check-in');
}

function compasso_checkinValidarToken(token, dispositivoId, tokenSessao) { exigirAdminOuSessao_(tokenSessao,'eventos','Compasso — check-in por QR',false); return compasso_checkin_interno_(token,dispositivoId); }

/** O formato de saída da busca, num lugar só. */
function compasso_checkinResumo_(x) {
  return {ingressoId:x.ingressoId||x._docId,numero:x.numero||'',nome:x.nome||'',cpf:x.cpf||'',escola:x.escola||'',categoria:x.categoria||'',status:x.status||'',utilizadoEm:x.utilizadoEm||'',utilizadoPor:x.utilizadoPor||''};
}

/**
 * "123" ou "000123" ou "FCV-2026-000123" → o número canônico do ingresso.
 * Devolve '' quando o termo não tem cara de número de ingresso.
 */
function compasso_checkinNumeroCanonico_(termo, nums) {
  var t = String(termo || '').toUpperCase().replace(/\s/g, '');
  var prefixo = (typeof EMISSAO_CFG === 'object' && EMISSAO_CFG.PREFIXO) ? EMISSAO_CFG.PREFIXO : 'FCV-2026-';
  if (t.indexOf(prefixo) === 0) return t;
  /* Só dígitos, e poucos: é número de ingresso, não CPF (11) nem telefone. */
  if (nums && nums.length >= 1 && nums.length <= 6 && nums === String(termo || '').replace(/\D/g, '') &&
      !/[a-z]/i.test(String(termo || ''))) {
    return prefixo + String(parseInt(nums, 10)).padStart(6, '0');
  }
  return '';
}

/**
 * BUSCA MANUAL DA PORTARIA — o caminho de contingência.
 *
 * O CUSTO, QUE É O MOTIVO DESTA FUNÇÃO TER SIDO REESCRITA
 *
 * Até 21/08/2026 ela chamava `fs_list_('ingressos', 1000)` e filtrava em
 * memória. O Firestore cobra por DOCUMENTO LIDO, não por chamada: cada busca
 * custava a coleção inteira. Com 2.000 ingressos, dez buscas manuais na noite
 * do evento = 20.000 leituras, ~40% da faixa gratuita diária — e a busca
 * manual é justamente o que se usa quando a fila já está travada (celular
 * descarregado, QR danificado).
 *
 * A ORDEM, E POR QUE ELA PRESERVA O COMPORTAMENTO
 *
 *   1. CPF completo (11 dígitos) → consulta com filtro, custa o que devolve;
 *   2. número do ingresso        → idem;
 *   3. qualquer outra coisa      → a listagem de antes, intacta.
 *
 * Os dois atalhos cobrem o que a portaria mais faz (a pessoa dita o CPF ou
 * mostra o número no papel) e não tiram nada: busca por nome, por escola e
 * por CPF PARCIAL continuam caindo no passo 3 e funcionando igual. Se um
 * atalho não achar, o passo 3 roda mesmo assim — atalho que devolve vazio
 * seria pior que atalho nenhum.
 */
function compasso_checkinBuscarManual(termo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — busca manual na portaria', false);
  termo=String(termo||'').toLowerCase().trim();
  if(termo.length<2) return [];
  var nums=termo.replace(/\D/g,'');

  var doEvento = function (lista) {
    return (lista || []).filter(function (x) { return x && x.eventoId === EMISSAO_CFG.EVENTO_ID; });
  };

  /* 1. CPF completo. */
  if (nums.length === 11) {
    var porCpf = doEvento(fs_queryEquals_('ingressos', 'cpf', nums));
    if (porCpf.length) return porCpf.slice(0, 20).map(compasso_checkinResumo_);
  }

  /* 2. Número do ingresso. */
  var numero = compasso_checkinNumeroCanonico_(termo, nums);
  if (numero) {
    var porNumero = doEvento(fs_queryEquals_('ingressos', 'numero', numero));
    if (porNumero.length) return porNumero.slice(0, 20).map(compasso_checkinResumo_);
  }

  /* 3. Nome, escola, CPF parcial — o caminho de antes, sem mudança. */
  return fs_list_('ingressos',1000).filter(function(x){
    if(x.eventoId!==EMISSAO_CFG.EVENTO_ID) return false;
    var hay=[x.nome,x.numero,x.escola,x.cpf].join(' ').toLowerCase();
    return hay.indexOf(termo)>=0 || (nums && String(x.cpf||'').replace(/\D/g,'').indexOf(nums)>=0);
  }).slice(0,20).map(compasso_checkinResumo_);
}

function compasso_checkinManual(ingressoId, dispositivoId, motivo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — check-in manual', false);
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
