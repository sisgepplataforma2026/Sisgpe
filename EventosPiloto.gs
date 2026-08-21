// ============================================================================
// 🧪 ARQUIVO: EventosPiloto.gs
// 🏷️  COMPASSO DA VIDA 2026 — Piloto ponta a ponta, em homologação
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. Depois de construir inscrição, validação, pagamento, emissão e
// entrega, o usuário disse: "primeiro, preciso fazer um piloto de teste que
// teste."
//
// Está certo, e é a REGRA Nº -1 em ação: nada do que foi entregue hoje rodou.
// O que existe são testes de código — eles provam que a lógica está lá, não
// que o e-mail chega, que o PDF sai legível, que o QR lê no celular.
//
// DUAS FUNÇÕES, E A ORDEM IMPORTA
//
// 1. `diagnosticoPilotoCompasso_()` — só LÊ. Diz o que já está configurado e
//    o que falta, e imprime os dois links. Rodar isto ANTES economiza a
//    descoberta no meio do caminho de que o Firestore nem estava ligado.
//
// 2. `compasso_pilotoExecutar(...)` — roda a cadeia inteira com o SEU contato:
//    inscrição → validação → emissão → e-mail com PDF → link do ingresso.
//    Devolve o relatório de cada etapa e o link para você abrir no celular.
//
// POR QUE O PILOTO USA O SEU E-MAIL DE VERDADE
//
// Porque é a única forma de provar as três coisas que nenhum teste de código
// alcança: que o e-mail SAI, que o PDF vem anexo, e que o QR dentro do PDF é
// LEGÍVEL pela câmera. Um piloto que manda para um endereço inventado prova
// menos do que parece.
//
// TRAVAS
//
// Homologação e administrador, as duas. Este arquivo cria inscrição e emite
// ingresso de verdade — em produção isso consumiria vaga das 2.000 e geraria
// número de ingresso que ninguém pediu.
// ============================================================================

/**
 * ESTE é o nome que se escolhe no editor do Apps Script.
 *
 * O Apps Script trata função terminada em `_` como privada: ela não aparece
 * no seletor de execução do editor. `diagnosticoPilotoCompasso_()` era, na
 * prática, impossível de rodar pelo botão — e o plano de testes mandava
 * começar por ela. Descoberto em 21/08/2026, quando o usuário perguntou em
 * que arquivo a função estava.
 *
 * A trava é a porta dupla, e é necessária: sem o `_` no fim, toda função
 * global fica alcançável por `google.script.run` a partir de QUALQUER página
 * do projeto, inclusive das públicas — e este diagnóstico conta o projeto do
 * Firestore, o tamanho da base de associados e os links do evento.
 *
 * Rodando pelo editor não existe token de sessão, então a checagem cai no
 * segundo caminho: dono do projeto ou ADMINISTRADOR ATIVO pela conta Google.
 * É o que faz funcionar para você e recusar para o resto.
 */
function compassoDiagnostico() {
  exigirAdminOuSessao_('', 'eventos', 'Compasso — diagnóstico do piloto', true);
  return diagnosticoPilotoCompasso_();
}

/**
 * O que precisa estar de pé antes do piloto. Só lê; não escreve nada.
 * Pelo editor, chame por `compassoDiagnostico()` — ver a nota acima.
 */
function diagnosticoPilotoCompasso_() {
  var L = [], falta = [];
  var props = PropertiesService.getScriptProperties();

  function linha(rot, valor, ok, dica) {
    L.push('  ' + (rot + ' ...........................').slice(0, 30) + ' ' +
           (ok ? '✅ ' : '❌ ') + valor);
    if (!ok && dica) falta.push(dica);
  }

  L.push('═══════════════════════════════════════════════════════════');
  L.push('  PILOTO — FESTA COMPASSO DA VIDA 2026');
  L.push('  O que precisa estar de pé antes de rodar');
  L.push('═══════════════════════════════════════════════════════════');
  L.push('');

  /* 1. ambiente — o piloto não pode rodar em produção */
  var amb = String(props.getProperty('SISGEP_AMBIENTE') || '(não declarado)');
  linha('Ambiente', amb, amb.toUpperCase() === 'HOMOLOGACAO',
        'Declare SISGEP_AMBIENTE = homologacao nas Propriedades do script.');

  /* 2. modo teste — deriva do ambiente desde 21/08 */
  var teste = emissao_modoTeste_();
  linha('Modo teste', (teste ? 'LIGADO' : 'desligado') + ' — ' +
        emissao_modoTesteOrigem_(), teste,
        'Sem modo teste, o período 21/09–11/11 é exigido e a emissão recusa.');

  /* 3. Firestore — TUDO do Compasso mora lá. Sem isto, nada funciona. */
  var fbOk = false, fbMsg = 'não configurado';
  try {
    if (typeof fb_config_ === 'function' && fb_config_()) {
      fb_config_(); fs_getAccessToken_(); fbOk = true;
      fbMsg = 'conectado (' + fs_getConfig_().projectId + ')';
    }
  } catch (e) { fbMsg = e.message; }
  linha('Firestore', fbMsg, fbOk,
        'Configure FIREBASE_PROJETO, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY. ' +
        'SEM ISSO NADA DO COMPASSO FUNCIONA — inscrição, ingresso e check-in vivem lá.');

  /* 4. base de associados do AMBIENTE */
  var qtd = -1, planilha = '';
  try {
    planilha = getPlanilhaId();
    var sh = SpreadsheetApp.openById(planilha).getSheetByName(EMISSAO_CFG.ABA_ASSOCIADOS);
    qtd = sh ? Math.max(0, sh.getLastRow() - 1) : -1;
  } catch (e) { qtd = -1; }
  linha('Base de associados', qtd >= 0 ? qtd + ' linha(s)' : 'não foi possível ler', qtd > 0,
        'A aba ' + EMISSAO_CFG.ABA_ASSOCIADOS + ' da planilha de homologação está vazia. ' +
        'O piloto ainda roda — só não vai preencher pelo CPF.');

  /* 5. cota de e-mail — o piloto manda um de verdade */
  var cota = -1;
  try { cota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  linha('Cota de e-mail', cota >= 0 ? cota + ' restante(s) hoje' : 'não foi possível ler',
        cota > 0, 'A cota diária de e-mail acabou. O piloto roda, mas o e-mail não sai.');

  /* 6. arte do ingresso — opcional em modo teste */
  var arte = compasso_statusArteBase();
  linha('Arte do ingresso', arte.configurada ? arte.nome : 'não configurada',
        !!arte.configurada,
        'Sem a arte, a tela do ingresso sai sem fundo. O PDF NÃO depende dela — ' +
        'ele tem layout próprio. Em produção a emissão visual é bloqueada sem arte.');

  /* 7. vagas */
  var cfg = compasso_inscricaoConfig_();
  linha('Inscrições', cfg.aberta ? 'ABERTAS · ' + cfg.vagas.restantes + ' vagas'
                                 : 'fechadas — ' + cfg.motivoFechada, cfg.aberta,
        'Inscrições fechadas: a tela pública vai mostrar o aviso em vez do formulário.');

  var base = '';
  try { base = getSistemaUrlBase() || ScriptApp.getService().getUrl(); }
  catch (e) { base = ScriptApp.getService().getUrl(); }

  L.push('');
  L.push('───────────────────────────────────────────────────────────');
  L.push('  OS DOIS LINKS');
  L.push('───────────────────────────────────────────────────────────');
  L.push('  Inscrição (é o que vai na lista de transmissão):');
  L.push('  ' + base + '?page=compasso-inscricao');
  L.push('');
  L.push('  Ingresso: gerado pelo sistema, um por pessoa.');
  L.push('  ' + base + '?page=ingresso&t=<token>');
  L.push('');
  compasso_avisoUrlDev_(base).forEach(function (l) { L.push(l); });

  if (falta.length) {
    L.push('───────────────────────────────────────────────────────────');
    L.push('  ⚠️  O QUE FALTA, na ordem de importância');
    L.push('───────────────────────────────────────────────────────────');
    falta.forEach(function (f, i) { L.push('  ' + (i + 1) + '. ' + f); });
  } else {
    L.push('  ✅ Tudo pronto. Rode o piloto:');
    L.push('     compasso_pilotoExecutar("seu@email.com", "27999999999")');
  }
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}

/**
 * Roda a cadeia inteira com o SEU contato e devolve o relatório de cada etapa.
 *
 * inscrição → validação → emissão → e-mail (link + PDF) → link do ingresso
 *
 * @param {string} email     seu e-mail — o de verdade, para conferir o PDF
 * @param {string=} whatsapp seu WhatsApp, opcional
 * @param {string=} tokenSessao
 */
/**
 * ESTE é o nome que se escolhe no editor para rodar o piloto.
 *
 * O botão Executar do Apps Script chama a função SEM argumentos — não existe
 * onde digitar `compasso_pilotoExecutar("seu@email.com", "27999999999")`. Em
 * 21/08/2026 isso fez o piloto terminar em menos de um segundo, calado.
 *
 * O e-mail não precisa ser digitado: o sistema já sabe quem está executando.
 * Ele nasce preenchido com a sua conta e o registro diz de onde veio — mesmo
 * princípio das telas (REGRA Nº 0.6). Para mandar a outro endereço, ou para
 * incluir o WhatsApp, declare nas Propriedades do script:
 *
 *     COMPASSO_PILOTO_EMAIL      (opcional — o padrão é quem executa)
 *     COMPASSO_PILOTO_WHATSAPP   (opcional — só dígitos, ex.: 27999999999)
 */
function compassoPiloto() {
  /* A trava vem ANTES de qualquer leitura ou retorno. A checagem de dentro do
     compasso_pilotoExecutar não bastaria: as mensagens de recusa daqui saem
     antes de chegar lá, e sem o `_` no fim esta função é alcançável por
     google.script.run a partir de qualquer página, inclusive das públicas. */
  exigirAdminOuSessao_('', 'eventos', 'Compasso — piloto pelo editor', true);

  var props = PropertiesService.getScriptProperties();

  var doDono = '';
  try { doDono = String(Session.getEffectiveUser().getEmail() || '').trim(); } catch (e) {}

  var declarado = String(props.getProperty('COMPASSO_PILOTO_EMAIL') || '').trim();
  var email = declarado || doDono;
  var origem = declarado ? 'COMPASSO_PILOTO_EMAIL' : 'conta que está executando';

  if (email.indexOf('@') < 1) {
    var semEmail = 'PILOTO NÃO RODOU: não consegui descobrir seu e-mail.\n' +
      'Declare COMPASSO_PILOTO_EMAIL nas Propriedades do script.';
    Logger.log(semEmail);
    return semEmail;
  }

  var zap = String(props.getProperty('COMPASSO_PILOTO_WHATSAPP') || '').replace(/\D/g, '');
  Logger.log('Piloto vai usar ' + email + ' (' + origem + ')' +
             (zap ? ' · WhatsApp ' + zap : ' · sem WhatsApp'));

  return compasso_pilotoExecutar(email, zap);
}

function compasso_pilotoExecutar(email, whatsapp, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — piloto ponta a ponta', true);
  compasso_assertHomologacao_();

  email = String(email || '').trim();
  if (email.indexOf('@') < 1) {
    /* LOGAR, não só devolver. O editor do Apps Script não mostra valor de
       retorno: em 21/08/2026 esta recusa fez a execução terminar em menos de
       um segundo, sem uma linha no registro — silêncio indistinguível de
       sucesso. Quem rodou não tinha como saber que faltava o e-mail. */
    var recusa = 'PILOTO NÃO RODOU: falta o e-mail.\n\n' +
      'Pelo botão Executar do editor não dá para passar argumentos — a função\n' +
      'recebe tudo vazio. Use o atalho compassoPiloto(), que usa o e-mail de\n' +
      'quem está executando.';
    Logger.log(recusa);
    return { ok: false, erro: recusa };
  }

  var etapas = [];
  function etapa(nome, r, detalhe) {
    etapas.push({ etapa: nome, ok: !!(r && r.ok !== false), detalhe: detalhe || '' });
    return r;
  }

  /* CPF de teste único por execução: dois pilotos seguidos não podem esbarrar
     na trava de duplicidade e parecer defeito. */
  var sufixo = String(new Date().getTime()).slice(-9);
  var cpf = compasso_cpfDeTesteValido_(sufixo);

  /* 1. inscrição — pelo MESMO caminho da tela pública, sem atalho.
        Usar outra porta aqui provaria outra coisa. */
  var insc = compasso_inscrever({
    nome: 'PILOTO COMPASSO ' + sufixo,
    cpf: cpf,
    rg: '',
    escola: 'ESCOLA DE TESTE — PILOTO',
    cidade: 'Vitória',
    email: email,
    whatsapp: String(whatsapp || '').replace(/\D/g, ''),
    termoAceito: true
  });
  etapa('1. Inscrição pública', insc, insc.erro || insc.inscricaoId);
  if (!insc.ok) return compasso_pilotoRelatorio_(etapas, null);

  /* 2. validação administrativa */
  var val = compasso_validarDecisaoAdmin(insc.inscricaoId, COMPASSO_STATUS.VALIDADA,
                                         '', 'Piloto automatizado', tokenSessao);
  etapa('2. Validação', val, val.erro || val.status);
  if (!val.ok) return compasso_pilotoRelatorio_(etapas, null);

  /* 3. emissão V2 — a segura, com QR assinado */
  var emi = compasso_emitirIngressoV2({ inscricaoId: insc.inscricaoId }, tokenSessao);
  etapa('3. Emissão do ingresso', emi, emi.erro || emi.numero);
  if (!emi.ok) return compasso_pilotoRelatorio_(etapas, null);

  /* 4. entrega por e-mail — link no corpo e PDF anexo */
  var env = compasso_enviarIngressoEmail(insc.inscricaoId, tokenSessao);
  etapa('4. E-mail com PDF', env, env.erro || env.aviso || env.mensagem);

  /* 5. o link, para abrir no celular */
  var url = compasso_ingressoUrlPublica_(emi.qrToken);
  etapa('5. Link do ingresso', { ok: true }, url);

  return compasso_pilotoRelatorio_(etapas, {
    inscricaoId: insc.inscricaoId, ingressoId: emi.id,
    numero: emi.numero, qrToken: emi.qrToken, url: url, email: email
  });
}

/**
 * CPF de teste com dígito verificador CORRETO.
 * A inscrição valida o dígito de verdade — um CPF inventado seria recusado, e
 * o piloto pareceria quebrado quando na verdade estava funcionando.
 */
function compasso_cpfDeTesteValido_(base9) {
  var n = String(base9 || '').replace(/\D/g, '');
  while (n.length < 9) n = '0' + n;
  n = n.slice(0, 9);
  if (/^(\d)\1{8}$/.test(n)) n = '1' + n.slice(1);   /* evita 111111111 */

  var soma = 0, i;
  for (i = 0; i < 9; i++) soma += Number(n.charAt(i)) * (10 - i);
  var d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
  var comD1 = n + d1;
  soma = 0;
  for (i = 0; i < 10; i++) soma += Number(comD1.charAt(i)) * (11 - i);
  var d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
  return comD1 + d2;
}

/**
 * Avisa quando os links estão saindo em /dev.
 *
 * /dev é o endereço do EDITOR: só abre para quem tem acesso de edição ao
 * script. Um associado clicando recebe tela de permissão do Google. O
 * problema é que quem envia não vê — para o dono do projeto abre normal.
 *
 * Aconteceu duas vezes em 21/08/2026 antes de virar este aviso, e a segunda
 * foi logo depois de eu explicar a primeira. Defeito que depende de alguém
 * lembrar é defeito que volta: quem tem de lembrar é o sistema.
 */
function compasso_avisoUrlDev_(base) {
  if (String(base || '').indexOf('/dev') < 0) return [];
  return [
    '⚠️  ATENÇÃO: estes links terminam em /dev — o endereço do EDITOR.',
    '',
    '    /dev só abre para quem tem acesso de EDIÇÃO ao script. Para o',
    '    associado é tela de permissão do Google. Você não percebe isso',
    '    sozinho, porque para VOCÊ ele abre normalmente.',
    '',
    '    Para corrigir, declare nas Propriedades do script:',
    '        SISGEP_URL_BASE = <a URL /exec da implantação>',
    '',
    '    A URL /exec está em Implantar → Gerenciar implantações. Não adianta',
    '    trocar a palavra "dev" por "exec": os dois endereços têm IDs',
    '    DIFERENTES.',
    ''
  ];
}

function compasso_pilotoRelatorio_(etapas, resultado) {
  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  PILOTO PONTA A PONTA — COMPASSO 2026');
  L.push('═══════════════════════════════════════════════════════════');
  etapas.forEach(function (e) {
    L.push('  ' + (e.ok ? '✅' : '❌') + ' ' + e.etapa);
    if (e.detalhe) L.push('        ' + e.detalhe);
  });
  L.push('');

  if (resultado) {
    L.push('───────────────────────────────────────────────────────────');
    L.push('  AGORA, O QUE SÓ VOCÊ PODE CONFERIR');
    L.push('───────────────────────────────────────────────────────────');
    L.push('  1. Abra o e-mail em ' + resultado.email);
    L.push('     Tem de chegar com o botão "Abrir meu ingresso" E o PDF anexo.');
    L.push('');
    L.push('  2. 🔴 ABRA O PDF E LEIA O QR COM A CÂMERA DO CELULAR.');
    L.push('     É o ponto mais provável de falha de toda a entrega: o template');
    L.push('     da tela gera QR por script de CDN, que NÃO roda na conversão');
    L.push('     para PDF. Fiz um caminho separado que embute a imagem — mas');
    L.push('     isso só se prova lendo.');
    L.push('');
    L.push('  3. Abra este link numa aba anônima (sem login):');
    L.push('     ' + resultado.url);
    L.push('     Tem de MOSTRAR o ingresso e NÃO marcar entrada.');
    if (String(resultado.url || '').indexOf('/dev') >= 0) {
      L.push('');
      L.push('     🔴 ESTE TESTE VAI FALHAR ASSIM, e não por defeito: a URL');
      L.push('        acima é /dev, que em aba anônima pede login. Veja o');
      L.push('        aviso no fim deste relatório.');
      L.push('        O MESMO vale para o botão dentro do e-mail que acabou');
      L.push('        de ser enviado: ele aponta para /dev e não abriria');
      L.push('        para um associado.');
    }
    L.push('');
    L.push('  4. Leia o QR na portaria. Depois leia DE NOVO:');
    L.push('     a segunda leitura tem de RECUSAR.');
    L.push('');
    L.push('  Ingresso ' + resultado.numero + ' · inscrição ' + resultado.inscricaoId);
    L.push('');
    L.push('  Para limpar depois:');
    L.push('    compasso_cancelarIngressoV2("' + resultado.ingressoId + '", "piloto")');
  } else {
    L.push('  O piloto parou na etapa marcada com ❌. O detalhe acima diz por quê.');
  }

  if (resultado && resultado.url) {
    var alerta = compasso_avisoUrlDev_(resultado.url);
    if (alerta.length) {
      L.push('───────────────────────────────────────────────────────────');
      alerta.forEach(function (l) { L.push(l); });
    }
  }
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
