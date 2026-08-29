// ============================================================================
// SISGEP · TaxaNegocialConfirmacao.gs
// Confirmação eletrônica por OTP de e-mail — HOMOLOGAÇÃO SOMENTE
// ============================================================================

function tnOtpCacheKey_(challengeId) {
  return 'TN_OTP_' + String(challengeId || '');
}

function tnOtpMascararEmail_(email) {
  var e = String(email || '').trim().toLowerCase();
  var p = e.split('@');
  if (p.length !== 2) return '***';
  var nome = p[0];
  var visivel = nome.length <= 2 ? nome.charAt(0) : nome.slice(0, 2);
  return visivel + '***@' + p[1];
}

function tnOtpEmailValido_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function tnOtpGerarCodigo_() {
  var seed = Utilities.getUuid() + '|' + new Date().getTime() + '|' + Utilities.getUuid();
  var hex = tnHashHex_(seed);
  var numero = parseInt(hex.slice(0, 12), 16) % 1000000;
  return String(numero).padStart(6, '0');
}

function tnOtpHashCodigo_(challengeId, salt, codigo) {
  return tnHashHex_([String(challengeId || ''), String(salt || ''), String(codigo || '')].join('|'));
}

function tnOtpLerDesafio_(challengeId) {
  var raw = CacheService.getScriptCache().get(tnOtpCacheKey_(challengeId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function tnOtpSalvarDesafio_(desafio, ttlSeg) {
  var validade = (typeof TN_CONFIG !== 'undefined' && TN_CONFIG.OTP) ? TN_CONFIG.OTP.VALIDADE_SEG : 600;
  var ttl = Math.max(1, Math.min(Number(ttlSeg || validade), validade));
  CacheService.getScriptCache().put(tnOtpCacheKey_(desafio.challengeId), JSON.stringify(desafio), ttl);
}

function tnOtpApagarDesafio_(challengeId) {
  CacheService.getScriptCache().remove(tnOtpCacheKey_(challengeId));
}

function tnOtpSegundosRestantes_(desafio) {
  return Math.max(0, Math.floor((Number(desafio.expiraEm || 0) - new Date().getTime()) / 1000));
}

function tnOtpCorpoEmail_(pre, codigo) {
  return [
    'Código de confirmação — Oposição à Taxa Negocial', '',
    'Foi iniciada presencialmente no SISGEP uma manifestação de oposição à Taxa Negocial.', '',
    'Código de confirmação: ' + codigo, '',
    'Campanha: ' + String(pre.campanha.EXERCICIO || pre.campanha.TITULO || ''),
    'Instituição: ' + String(pre.escolaNome || ''), '',
    'O código é válido por 10 minutos e deve ser informado somente no atendimento em andamento.',
    'Se você não estiver realizando este procedimento, não informe o código.', '',
    'SINDEDUCAÇÃO-ES'
  ].join('\n');
}

function taxaNegocialSolicitarOTP(token, payload) {
  var sessao = tnSessao_(token);
  if (typeof tnExigirHomologacaoSegura_ === 'function') tnExigirHomologacaoSegura_();

  var pre = tnValidarPreRegistroInterno_(payload);
  if (!pre.ok) return pre;
  if (!pre.email || !tnOtpEmailValido_(pre.email)) {
    return { ok: false, codigo: 'SEM_EMAIL', mensagem: 'O trabalhador não possui e-mail válido cadastrado. Atualize o cadastro ou utilize o fluxo de contingência autorizado.' };
  }
  if (typeof enviarEmailSISGEP_ !== 'function') throw new Error('Infraestrutura institucional de e-mail indisponível.');

  var validade = (TN_CONFIG.OTP && TN_CONFIG.OTP.VALIDADE_SEG) || 600;
  var maxTentativas = (TN_CONFIG.OTP && TN_CONFIG.OTP.MAX_TENTATIVAS) || 5;
  var challengeId = 'TN-CH-' + Utilities.getUuid();
  var codigo = tnOtpGerarCodigo_();
  var salt = Utilities.getUuid();
  var agoraMs = new Date().getTime();
  var desafio = {
    versao: 1,
    challengeId: challengeId,
    criadoEm: agoraMs,
    expiraEm: agoraMs + (validade * 1000),
    tentativas: 0,
    otpHash: tnOtpHashCodigo_(challengeId, salt, codigo),
    salt: salt,
    idCampanha: pre.campanha.ID_CAMPANHA,
    cpf: pre.cpf,
    escolaId: pre.escolaId,
    cnpj: pre.cnpj,
    chaveUnica: pre.chaveUnica,
    hashManifestacao: pre.hashManifestacao,
    documentoConferido: payload && payload.documentoConferido === true,
    tipoDocumentoConferido: String(payload && payload.tipoDocumentoConferido || '').trim(),
    email: pre.email
  };

  tnOtpSalvarDesafio_(desafio, validade);
  try {
    enviarEmailSISGEP_(pre.email, '[SISGEP] Código de confirmação — Oposição à Taxa Negocial', tnOtpCorpoEmail_(pre, codigo), { nomeDestinatario: pre.trabalhador.Nome || '' });
  } catch (e) {
    tnOtpApagarDesafio_(challengeId);
    if (typeof tnRepoAuditar_ === 'function') tnRepoAuditar_({ registroId: challengeId, acao: 'OTP_ENVIO_FALHOU', sessao: sessao, valorNovo: { destino: tnOtpMascararEmail_(pre.email) }, resultado: 'ERRO', justificativa: e.message || String(e) });
    return { ok: false, codigo: 'FALHA_ENVIO_OTP', mensagem: 'Não foi possível enviar o código de confirmação. Tente novamente.' };
  }

  if (typeof tnRepoAuditar_ === 'function') tnRepoAuditar_({ registroId: challengeId, acao: 'OTP_SOLICITADO', sessao: sessao, valorNovo: { idCampanha: pre.campanha.ID_CAMPANHA, escolaId: pre.escolaId, destino: tnOtpMascararEmail_(pre.email), validadeSegundos: validade } });

  return { ok: true, mensagem: 'Código de confirmação enviado.', dados: { challengeId: challengeId, destinoMascarado: tnOtpMascararEmail_(pre.email), expiraEmSegundos: validade, maxTentativas: maxTentativas } };
}

function taxaNegocialConfirmarOTP(token, challengeId, codigo) {
  var sessao = tnSessao_(token);
  if (typeof tnExigirHomologacaoSegura_ === 'function') tnExigirHomologacaoSegura_();
  var id = String(challengeId || '').trim();
  var cod = String(codigo || '').replace(/\D/g, '');
  if (!id || cod.length !== 6) return { ok: false, codigo: 'OTP_INVALIDO', mensagem: 'Informe o código de 6 dígitos.' };
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava indisponível.');

  var maxTentativas = (TN_CONFIG.OTP && TN_CONFIG.OTP.MAX_TENTATIVAS) || 5;
  var trava = travarSisgep_(30000);
  try {
    var desafio = tnOtpLerDesafio_(id);
    if (!desafio) return { ok: false, codigo: 'OTP_EXPIRADO', mensagem: 'Código expirado ou inexistente. Solicite um novo código.' };
    var restante = tnOtpSegundosRestantes_(desafio);
    if (restante <= 0) { tnOtpApagarDesafio_(id); return { ok: false, codigo: 'OTP_EXPIRADO', mensagem: 'Código expirado. Solicite um novo código.' }; }
    if (Number(desafio.tentativas || 0) >= maxTentativas) { tnOtpApagarDesafio_(id); return { ok: false, codigo: 'OTP_BLOQUEADO', mensagem: 'Número máximo de tentativas atingido. Solicite um novo código.' }; }

    if (tnOtpHashCodigo_(id, desafio.salt, cod) !== desafio.otpHash) {
      desafio.tentativas = Number(desafio.tentativas || 0) + 1;
      var restantes = maxTentativas - desafio.tentativas;
      if (restantes <= 0) {
        tnOtpApagarDesafio_(id);
        if (typeof tnRepoAuditar_ === 'function') tnRepoAuditar_({ registroId: id, acao: 'OTP_BLOQUEADO', sessao: sessao, valorNovo: { tentativas: desafio.tentativas }, resultado: 'NEGADO' });
        return { ok: false, codigo: 'OTP_BLOQUEADO', mensagem: 'Número máximo de tentativas atingido. Solicite um novo código.' };
      }
      tnOtpSalvarDesafio_(desafio, restante);
      return { ok: false, codigo: 'OTP_INCORRETO', mensagem: 'Código incorreto.', dados: { tentativasRestantes: restantes } };
    }

    var pre = tnValidarPreRegistroInterno_({ idCampanha: desafio.idCampanha, cpf: desafio.cpf, escolaId: desafio.escolaId, cnpj: desafio.cnpj });
    if (!pre.ok) { tnOtpApagarDesafio_(id); return pre; }
    if (String(pre.chaveUnica) !== String(desafio.chaveUnica) || String(pre.hashManifestacao) !== String(desafio.hashManifestacao)) {
      tnOtpApagarDesafio_(id);
      return { ok: false, codigo: 'DESAFIO_DESATUALIZADO', mensagem: 'Os dados ou o texto da manifestação foram alterados. Solicite um novo código.' };
    }

    var registro = tnRegistrarOposicaoConfirmada_(sessao, pre, { validadaNoServidor: true, metodo: 'OTP_EMAIL', otpValidado: true, challengeId: id, documentoConferido: desafio.documentoConferido === true, tipoDocumentoConferido: desafio.tipoDocumentoConferido || '' });
    if (!registro || !registro.ok) { if (registro && registro.codigo === 'OPOSICAO_DUPLICADA') tnOtpApagarDesafio_(id); return registro; }

    tnOtpApagarDesafio_(id);
    if (typeof tnRepoAuditar_ === 'function') tnRepoAuditar_({ registroId: registro.dados.idOposicao, acao: 'OTP_VALIDADO', sessao: sessao, valorNovo: { challengeId: id, metodo: 'OTP_EMAIL', protocolo: registro.dados.protocolo }, documento: registro.dados.protocolo });
    return registro;
  } finally {
    trava.liberar();
  }
}
