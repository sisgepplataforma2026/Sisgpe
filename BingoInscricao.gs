/**
 * BINGO ONLINE — INSCRIÇÃO PÚBLICA
 * Subfuncionalidade do módulo Eventos.
 *
 * O QUE ORIGINOU ESTE ARQUIVO
 *
 * 20/08/2026. O módulo Bingo estava completo do meio para a frente: gerava
 * cartelas em lote, sorteava, detectava bingo, pausava para manifestação e
 * encerrava. Mas o começo não existia — não havia como uma pessoa se
 * inscrever.
 *
 * Medindo, apareceu o gancho vazio: `bingo_listarParticipantesEvento` procura
 * primeiro na coleção `evento_participantes` e, não achando nada, cai para
 * `ingressos`. E NENHUM arquivo do sistema escreve em `evento_participantes`.
 * O lugar da inscrição estava reservado e vazio desde o início.
 *
 * POR QUE PÁGINA PRÓPRIA, E NÃO GOOGLE FORMS
 *
 * Decisão do usuário em 20/08/2026, com o teto de 300 inscritos na mesa:
 *
 *   - Forms não trava em 300. Aceita o 301º e o sindicato descobre depois.
 *     Aqui o teto é conferido dentro de LockService, e o 301º é RECUSADO na
 *     hora, com a vaga contada de verdade.
 *   - Forms não sabe quem é associado. Aqui o CPF é conferido na base dos
 *     ~8.000 e os campos voltam preenchidos (REGRA Nº 0.6).
 *   - Forms entrega a cartela DEPOIS, por e-mail, e a pessoa fica sem nada na
 *     tela. Aqui ela se inscreve e JÁ VÊ a cartela; o e-mail é a cópia de
 *     segurança, não o único caminho.
 *
 * O TERMO DE COMPROMISSO É DECLARAÇÃO, NÃO CHECKBOX DECORATIVO
 *
 * O texto veio do formulário real do sindicato. A cláusula 3 diz que quem não
 * estiver online no momento do sorteio é desclassificado e o sorteio é
 * refeito — que é exatamente o que o fluxo de manifestação já faz
 * (BingoValidacao/BingoFechamento). O termo e o código dizem a mesma coisa.
 *
 * Por ser declaração, o aceite é GRAVADO com data, versão do texto e hash do
 * conteúdo aceito. Guardar só `true` não prova o que a pessoa concordou —
 * e o texto muda de evento para evento.
 *
 * ORDEM DE CARGA: chame só de dentro do corpo de funções (ver AmbienteRecursos.gs).
 */

/** Teto de inscritos por evento. Informado pelo usuário em 20/08/2026. */
var BINGO_LIMITE_INSCRITOS_PADRAO = 300;

/**
 * Versão do termo. MUDE junto com o texto — o aceite guarda esta versão, e é
 * por ela que se sabe, meses depois, com o que a pessoa concordou.
 */
var BINGO_TERMO_VERSAO = '2026.08';

var BINGO_TERMO_TEXTO =
  'Declaro, na qualidade de associado(a) do SindEducação-ES, que estou ciente ' +
  'e de acordo com as regras do sorteio, conforme disposto abaixo:\n\n' +
  '1. Requisito para contemplação\n' +
  'Para ser contemplado(a), o(a) associado(a) deverá estar online e ' +
  'acompanhando a transmissão ao vivo no momento da realização do sorteio.\n\n' +
  '2. Compromisso de participação\n' +
  'Declaro estar ciente da data e horário do sorteio e comprometo-me a ' +
  'acompanhar o evento conforme cronograma divulgado.\n\n' +
  '3. Desclassificação por ausência\n' +
  'Estou ciente de que, caso não esteja online no momento do sorteio, serei ' +
  'automaticamente desclassificado(a), sendo realizado novo sorteio para ' +
  'definição de outro contemplado(a).';

/* ══════════════════════════════════════════════════════════════════════════
   LEITURA PÚBLICA — o que a tela precisa antes de alguém digitar
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado da inscrição de um evento. SEM SESSÃO — é página pública.
 *
 * Devolve só o que a tela precisa mostrar. Nada de lista de inscritos, nada
 * de dado de terceiro: a página é aberta, e o que sai por ela sai para
 * qualquer um.
 */
function bingo_inscricaoEstado(eventoId) {
  try {
    eventoId = String(eventoId || '').trim();
    if (!eventoId) return { ok: false, mensagem: 'Evento não informado.' };

    var cfg = fs_get_(bingo_colecao_('config'), eventoId) || bingo_configPadrao_(eventoId);
    var fechado = bingo_inscricaoFechada_(cfg);
    if (fechado) return { ok: false, encerrada: true, mensagem: fechado };

    var limite = Number(cfg.limiteInscritos || BINGO_LIMITE_INSCRITOS_PADRAO);
    var usadas = bingo_contarInscritos_(eventoId);

    return {
      ok: true,
      eventoId: eventoId,
      selo:         String(cfg.selo || ''),
      titulo:       String(cfg.tituloInscricao || 'Bingo Online — SindEducação-ES'),
      conviteTexto: String(cfg.conviteTexto || ''),
      premios:      cfg.premios || [],
      inscricoesAte: String(cfg.inscricoesAte || ''),
      sorteioEm:     String(cfg.sorteioEm || ''),
      youtubeCanal:  String(cfg.youtubeCanal || ''),
      youtubeUrl:    String(cfg.youtubeUrl || ''),
      limite: limite,
      inscritos: usadas,
      vagas: Math.max(limite - usadas, 0),
      esgotado: usadas >= limite,
      termoVersao: BINGO_TERMO_VERSAO,
      termoTexto: BINGO_TERMO_TEXTO
    };
  } catch (e) {
    return { ok: false, mensagem: 'Não foi possível abrir a inscrição: ' + e.message };
  }
}

/**
 * Procura o associado pelo CPF e devolve os campos que o sistema JÁ SABE.
 *
 * REGRA Nº 0.6: campo que o sindicato já tem não se redigita. A tela mostra
 * de onde veio o dado, para não passar impressão de conferido.
 *
 * NÃO diz se a pessoa é filiada ou não — isso é resposta de "existe cadastro
 * com este CPF?", e a página é pública. Quem decide o que fazer com o
 * cadastro é a inscrição, no servidor.
 */
function bingo_inscricaoPreencher(cpf) {
  try {
    var limpo = String(cpf || '').replace(/\D/g, '');
    if (limpo.length !== 11) return { ok: false };

    if (typeof buscarAssociadoPorCPF_ !== 'function') return { ok: false };
    var a = buscarAssociadoPorCPF_(limpo);
    if (!a || !a.encontrado) return { ok: false };

    return {
      ok: true,
      nome: String(a.nome || '').trim(),
      email: String(a.email || '').trim(),
      cidade: String(a.cidade || '').trim(),
      whatsapp: String(a.celular || a.celular2 || '').trim(),
      origem: 'cadastro'
    };
  } catch (e) {
    return { ok: false };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   A INSCRIÇÃO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inscreve uma pessoa, gera a cartela e devolve o link — tudo numa chamada.
 *
 * SEM SESSÃO: é o ponto público do fluxo. Toda validação é aqui, no servidor;
 * a tela não decide nada.
 *
 * @param {Object} dados { eventoId, rodadaId, cpf, nome, email, escola,
 *                         cidade, whatsapp, aceiteTermo }
 */
function bingo_inscrever(dados) {
  dados = dados || {};

  var eventoId = String(dados.eventoId || '').trim();
  var cpf      = String(dados.cpf || '').replace(/\D/g, '');
  var nome     = String(dados.nome || '').trim();
  var email    = String(dados.email || '').trim().toLowerCase();
  var escola   = String(dados.escola || '').trim();
  var cidade   = String(dados.cidade || '').trim();
  var whatsapp = String(dados.whatsapp || '').replace(/\D/g, '');

  /* ── Validação de forma. Mensagem por campo, não um "dados inválidos". ── */
  if (!eventoId)            return { ok: false, campo: '',         mensagem: 'Evento não informado.' };
  if (!bingo_cpfValido_(cpf)) return { ok: false, campo: 'cpf',    mensagem: 'CPF inválido. Confira os números.' };
  if (nome.length < 5 || nome.indexOf(' ') < 0)
                            return { ok: false, campo: 'nome',     mensagem: 'Informe o nome completo.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
                            return { ok: false, campo: 'email',    mensagem: 'E-mail inválido.' };
  if (!escola)              return { ok: false, campo: 'escola',   mensagem: 'Informe a escola ou instituição.' };
  if (!cidade)              return { ok: false, campo: 'cidade',   mensagem: 'Informe a cidade onde trabalha.' };
  if (whatsapp.length < 10) return { ok: false, campo: 'whatsapp', mensagem: 'Informe o WhatsApp com DDD.' };
  if (!dados.aceiteTermo)   return { ok: false, campo: 'termo',    mensagem: 'É preciso aceitar o termo de compromisso.' };

  /* ── TUDO O QUE DECIDE VAGA ACONTECE DENTRO DO LOCK ──────────────────────
     Sem isto, duas pessoas clicando no mesmo segundo leem "299 inscritos" e
     as duas entram: o evento fecha com 301. É a razão de o teto existir. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (eLock) {
    return { ok: false, mensagem: 'Sistema ocupado. Tente novamente em alguns segundos.' };
  }

  try {
    var cfg = fs_get_(bingo_colecao_('config'), eventoId) || bingo_configPadrao_(eventoId);
    /* Reconferido DENTRO do lock: o prazo pode ter virado entre a pessoa
       abrir a página e clicar em enviar. Conferir só na abertura deixaria
       passar quem ficou com a tela aberta desde antes do encerramento. */
    var fechado = bingo_inscricaoFechada_(cfg);
    if (fechado) return { ok: false, encerrada: true, mensagem: fechado };

    /* Já inscrito? Não é erro — devolve a cartela que já existe. Quem clica
       duas vezes, ou perde o e-mail e volta pelo link, precisa reencontrar a
       própria cartela, não levar um "CPF já cadastrado" e ficar sem nada. */
    var jaTem = bingo_inscritoPorCpf_(eventoId, cpf);
    if (jaTem) {
      return bingo_inscricaoResposta_(jaTem, cfg, true);
    }

    var limite = Number(cfg.limiteInscritos || BINGO_LIMITE_INSCRITOS_PADRAO);
    var usadas = bingo_contarInscritos_(eventoId);
    if (usadas >= limite) {
      return {
        ok: false,
        esgotado: true,
        mensagem: 'As ' + limite + ' vagas deste sorteio já foram preenchidas.'
      };
    }

    /* ── Grava o participante no gancho que estava vazio ── */
    var participanteId = bingo_uuid_('PART');
    var agora = bingo_agoraIso_();

    var participante = {
      participanteId: participanteId,
      eventoId:       eventoId,
      nome:           nome,
      cpfHash:        bingo_hash_(cpf),   /* CPF não fica em claro: só o hash,
                                             que basta para achar duplicata. */
      cpfMascarado:   bingo_mascararCpf_(cpf),
      email:          email,
      escola:         escola,
      cidade:         cidade,
      whatsapp:       whatsapp,
      categoria:      'associado',
      status:         'ATIVO',
      origem:         'INSCRICAO_PUBLICA',
      inscritoEm:     agora,
      /* O aceite guarda COM O QUE a pessoa concordou, não só que concordou. */
      termoVersao:    BINGO_TERMO_VERSAO,
      termoHash:      bingo_hash_(BINGO_TERMO_TEXTO),
      termoAceitoEm:  agora
    };

    fs_set_(bingo_colecao_('evento_participantes'), participanteId, participante);

    if (typeof bingo_auditar_ === 'function') {
      bingo_auditar_('INSCRICAO_PUBLICA', participanteId,
        { nome: nome, usuario: email }, null,
        { eventoId: eventoId, escola: escola, termoVersao: BINGO_TERMO_VERSAO });
    }

    return bingo_inscricaoResposta_(participante, cfg, false);

  } catch (e) {
    return { ok: false, mensagem: 'Não foi possível concluir a inscrição: ' + e.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   APOIO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Monta a resposta com a cartela e dispara o e-mail.
 *
 * O E-MAIL NÃO É O CAMINHO CRÍTICO. Se falhar, a pessoa JÁ TEM a cartela na
 * tela — então a falha vira aviso, nunca erro de inscrição. Derrubar uma
 * inscrição válida porque o e-mail não saiu seria trocar um problema pequeno
 * por um grande.
 */
function bingo_inscricaoResposta_(participante, cfg, jaExistia) {
  var cartela = null, url = '';

  try {
    var r = bingo_cartelaDoParticipante_(participante);
    if (r && r.ok) { cartela = r.cartela; url = r.url; }
  } catch (e) {
    Logger.log('bingo_inscricaoResposta_: cartela — ' + e.message);
  }

  var emailEnviado = false, avisoEmail = '';
  if (url) {
    try {
      bingo_enviarEmailInscricao_(participante, url, cfg);
      emailEnviado = true;
    } catch (eMail) {
      avisoEmail = 'Não conseguimos enviar o e-mail agora. Guarde o link desta página.';
      Logger.log('bingo_enviarEmailInscricao_: ' + eMail.message);
    }
  }

  return {
    ok: true,
    jaExistia: !!jaExistia,
    participanteId: participante.participanteId,
    nome: participante.nome,
    urlCartela: url,
    temCartela: !!url,
    youtubeUrl: String(cfg.youtubeUrl || ''),
    emailEnviado: emailEnviado,
    avisoEmail: avisoEmail,
    mensagem: jaExistia
      ? 'Você já estava inscrito neste sorteio. Sua cartela continua a mesma.'
      : 'Inscrição confirmada!'
  };
}

/**
 * Cartela do participante na rodada de inscrição do evento.
 *
 * Se ainda não há rodada aberta, a inscrição VALE assim mesmo — a cartela é
 * gerada depois, em lote, pelo painel. Por isso a ausência de rodada devolve
 * `ok:false` sem estourar: não é erro da pessoa que se inscreveu.
 */
function bingo_cartelaDoParticipante_(participante) {
  var rodadas = bingo_queryEquals_(bingo_colecao_('rodadas'), 'eventoId', participante.eventoId, 50);
  var aberta = null;

  rodadas.forEach(function (r) {
    var d = r.data || {};
    var st = String(d.status || '').toUpperCase();
    if (st === BINGO_STATUS_RODADA.RASCUNHO || st === BINGO_STATUS_RODADA.PRONTA) {
      if (!aberta) aberta = d;
    }
  });

  if (!aberta) return { ok: false, motivo: 'sem-rodada-aberta' };

  var docId = bingo_cartelaDocId_(aberta.rodadaId, participante.participanteId);
  var cartela = fs_get_(bingo_colecao_('cartelas'), docId);

  if (!cartela) {
    var numeros = bingo_gerarNumeros75_(aberta.usaCasaLivre !== false);
    cartela = {
      cartelaId:      bingo_uuid_('CART'),
      eventoId:       participante.eventoId,
      rodadaId:       aberta.rodadaId,
      participanteId: participante.participanteId,
      numerosJson:    bingo_json_(numeros),
      combinacaoHash: bingo_hashCombinacao_(aberta.rodadaId, numeros),
      criadaEm:       bingo_agoraIso_(),
      origem:         'INSCRICAO_PUBLICA'
    };
  }

  /* Token novo a cada emissão de link; só o hash fica gravado. */
  var token = bingo_tokenSeguro_();
  cartela.tokenHash = bingo_hash_(token);
  cartela.linkAtualizadoEm = bingo_agoraIso_();
  cartela.linkAtualizadoPor = 'INSCRICAO_PUBLICA';

  fs_set_(bingo_colecao_('cartelas'), docId, cartela);

  return { ok: true, cartela: cartela, url: bingo_linkPublico_(token) };
}

/** E-mail com o link da cartela. Passa pelo EmailCore, que é a camada central. */
function bingo_enviarEmailInscricao_(participante, url, cfg) {
  var live = String(cfg.youtubeUrl || '');
  var titulo = String(cfg.tituloInscricao || 'Bingo Online — SindEducação-ES');

  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;">' +
      '<p>Olá, <strong>' + bingo_escaparHtml_(participante.nome) + '</strong>!</p>' +
      '<p>Sua inscrição em <strong>' + bingo_escaparHtml_(titulo) + '</strong> está confirmada.</p>' +
      '<p><a href="' + url + '" style="background:#001f4d;color:#fff;padding:12px 22px;' +
        'text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">' +
        '🎲 Abrir minha cartela</a></p>' +
      (live
        ? '<p><a href="' + live + '">🔴 Assistir à transmissão ao vivo</a></p>'
        : '') +
      '<p style="background:#fff7ed;border-left:4px solid #d97706;padding:10px 14px;">' +
        '<strong>Importante:</strong> para ser contemplado(a), é preciso estar ' +
        'online acompanhando a transmissão no momento do sorteio.</p>' +
      '<p>Guarde este e-mail: o link acima é a sua cartela.</p>' +
      '<p><strong>Atenciosamente,</strong><br>SindEducação-ES</p>' +
    '</div>';

  if (typeof emailCore_enviar_ === 'function') {
    emailCore_enviar_(participante.email, 'Sua cartela do Bingo — SindEducação-ES', {
      origem: 'BingoInscricao', htmlBody: html
    });
    return;
  }

  MailApp.sendEmail({
    to: participante.email,
    subject: 'Sua cartela do Bingo — SindEducação-ES',
    htmlBody: html,
    name: 'SindEducação-ES | SISGEP'
  });
}

/**
 * Diz POR QUE a inscrição está fechada, ou string vazia se está aberta.
 *
 * Duas causas, e a diferença importa para quem lê a mensagem: desligada no
 * painel, ou prazo vencido. O prazo fecha SOZINHO — ninguém precisa lembrar
 * de desmarcar nada às 12h de uma quarta-feira (REGRA Nº 0.6).
 */
function bingo_inscricaoFechada_(cfg) {
  if (cfg.inscricaoAberta === false) {
    return 'As inscrições para este evento estão encerradas.';
  }

  var ate = String(cfg.inscricoesAte || '').trim();
  if (ate) {
    var limite = new Date(ate);
    if (!isNaN(limite.getTime()) && Date.now() > limite.getTime()) {
      return 'O prazo de inscrição encerrou em ' +
             Utilities.formatDate(limite, Session.getScriptTimeZone(),
                                  "dd/MM/yyyy 'às' HH'h'mm") + '.';
    }
  }
  return '';
}

/** Quantos já se inscreveram neste evento. */
function bingo_contarInscritos_(eventoId) {
  try {
    return bingo_queryEquals_(bingo_colecao_('evento_participantes'), 'eventoId', eventoId, 1000).length;
  } catch (e) {
    return 0;
  }
}

/** Acha o inscrito pelo hash do CPF — o CPF em claro nunca é gravado. */
function bingo_inscritoPorCpf_(eventoId, cpf) {
  try {
    var hash = bingo_hash_(cpf);
    var itens = bingo_queryEquals_(bingo_colecao_('evento_participantes'), 'eventoId', eventoId, 1000);
    for (var i = 0; i < itens.length; i++) {
      var d = itens[i].data || {};
      if (String(d.cpfHash || '') === hash) return d;
    }
  } catch (e) {}
  return null;
}

/** CPF com dígito verificador de verdade — não só contagem de dígitos. */
function bingo_cpfValido_(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  var soma = 0, i;
  for (i = 0; i < 9; i++) soma += Number(cpf.charAt(i)) * (10 - i);
  var d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf.charAt(9))) return false;

  soma = 0;
  for (i = 0; i < 10; i++) soma += Number(cpf.charAt(i)) * (11 - i);
  var d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf.charAt(10));
}

/** 123.***.***-45 — o bastante para a pessoa se reconhecer, sem expor. */
function bingo_mascararCpf_(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return '';
  return cpf.slice(0, 3) + '.***.***-' + cpf.slice(9);
}

function bingo_escaparHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Diagnóstico. Underscore de propósito: roda no editor, não pela web. */
function diagnosticoBingoInscricao_(eventoId) {
  var e = bingo_inscricaoEstado(eventoId || 'TESTE');
  var texto = [
    '═══════════════════════════════════════════════════════════',
    '  INSCRIÇÃO DO BINGO — ' + (eventoId || 'TESTE'),
    '═══════════════════════════════════════════════════════════',
    '  ok        : ' + e.ok,
    '  limite    : ' + (e.limite || '—'),
    '  inscritos : ' + (e.inscritos != null ? e.inscritos : '—'),
    '  vagas     : ' + (e.vagas != null ? e.vagas : '—'),
    '  termo     : versão ' + BINGO_TERMO_VERSAO,
    '  mensagem  : ' + (e.mensagem || '—'),
    '═══════════════════════════════════════════════════════════'
  ].join('\n');
  Logger.log(texto);
  return texto;
}
