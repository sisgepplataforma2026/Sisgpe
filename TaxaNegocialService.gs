// ============================================================================
// SISGEP · TaxaNegocialService.gs
// Regras de negócio — HML SOMENTE
// ============================================================================

function tnSessao_(token) {
  if (typeof getSessaoUsuario !== 'function') {
    throw new Error('Infraestrutura de sessão SISGEP não encontrada.');
  }

  // Compatibilidade controlada:
  // - versões novas: getSessaoUsuario(token)
  // - versões antigas: getSessaoUsuario()
  // Na promoção definitiva, remover o fallback antigo e exigir token no servidor.
  let sessao = null;
  if (getSessaoUsuario.length >= 1) {
    if (!token) throw new Error('Token de sessão obrigatório.');
    sessao = getSessaoUsuario(token);
  } else {
    sessao = getSessaoUsuario();
  }

  if (!sessao) throw new Error('Sessão inválida ou expirada.');
  if (Object.prototype.hasOwnProperty.call(sessao, 'logado') && sessao.logado !== true) {
    throw new Error('Sessão inválida ou expirada.');
  }
  return sessao;
}

function tnUsuarioSessao_(sessao) {
  return {
    nome: sessao.nome || sessao.NOME || sessao.usuario || sessao.USUARIO || '',
    email: sessao.email || sessao.EMAIL || '',
    perfil: sessao.perfil || sessao.PERFIL || '',
    setor: sessao.setor || sessao.SETOR || ''
  };
}

function tnValidarCampanhaAberta_(campanha) {
  if (!campanha) throw new Error('Campanha não encontrada.');
  if (String(campanha.STATUS || '').toUpperCase() !== 'ATIVA') {
    throw new Error('A campanha não está ativa.');
  }
  const agora = new Date();
  if (campanha.INICIO_OPOSICAO && agora < new Date(campanha.INICIO_OPOSICAO)) {
    throw new Error('O período de oposição ainda não começou.');
  }
  if (campanha.FIM_OPOSICAO && agora > new Date(campanha.FIM_OPOSICAO)) {
    throw new Error('O período de oposição já foi encerrado.');
  }
  return true;
}

function tnChaveUnica_(idCampanha, cpf, escolaId) {
  const base = [
    tnNormalizarTexto_(idCampanha),
    tnNormalizarCpf_(cpf),
    tnNormalizarTexto_(escolaId)
  ].join('|');
  return tnHashHex_(base);
}

function tnGerarProtocoloSemLock_(ano) {
  const a = String(ano || Utilities.formatDate(new Date(), TN_CONFIG.FUSO_HORARIO, 'yyyy'));
  const props = PropertiesService.getScriptProperties();
  const key = 'TN_PROTOCOLO_SEQ_' + a;
  const atual = Number(props.getProperty(key) || '0');
  const prox = atual + 1;
  props.setProperty(key, String(prox));
  return 'OP-' + a + '-' + String(prox).padStart(6, '0');
}

function tnGerarProtocolo_(ano) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return tnGerarProtocoloSemLock_(ano);
  } finally {
    lock.releaseLock();
  }
}

function taxaNegocialObterCampanhaAtiva(token) {
  tnSessao_(token);
  const campanha = tnRepoBuscarCampanhaAtiva_();
  return { ok: true, dados: campanha || null };
}

function taxaNegocialBuscarContextoPorCpf(token, cpf, escolaId, cnpj) {
  tnSessao_(token);
  const cpfN = tnNormalizarCpf_(cpf);
  if (!tnValidarCpfBasico_(cpfN)) return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };

  const trabalhador = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  const escola = tnRepoBuscarEscola_(escolaId, cnpj);
  const campanha = tnRepoBuscarCampanhaAtiva_();

  return {
    ok: true,
    dados: {
      campanha: campanha,
      trabalhador: trabalhador ? {
        nome: trabalhador.Nome || '',
        cpf: cpfN,
        filiado: String(trabalhador.Filiado || '').toUpperCase() === 'S',
        situacaoFiliacao: trabalhador.Filiado || '',
        matricula: trabalhador.MATRICULA || '',
        celular: trabalhador.Celular || trabalhador.CELULAR2 || '',
        email: trabalhador['E-mail'] || ''
      } : null,
      escola: escola ? {
        id: escola.EscolaID || '',
        nome: escola['Escola (Razão Social)'] || escola.NOME_FANTASIA || '',
        cnpj: escola.CNPJ || '',
        cidade: escola.Cidade || '',
        emailPrincipal: escola['E-mail (principal)'] || ''
      } : null
    }
  };
}

function taxaNegocialCadastrarNaoFiliado(token, dados) {
  const sessao = tnSessao_(token);
  dados = dados || {};
  const cpfN = tnNormalizarCpf_(dados.cpf);
  if (!tnValidarCpfBasico_(cpfN)) return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };
  if (!tnNormalizarTexto_(dados.nome)) return { ok: false, codigo: 'NOME_OBRIGATORIO', mensagem: 'Nome obrigatório.' };

  const existente = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (existente) {
    return { ok: true, codigo: 'JA_EXISTE', dados: { existente: true, filiado: String(existente.Filiado || '').toUpperCase() === 'S' } };
  }

  const criado = tnRepoCriarTrabalhadorNaoFiliado_(dados);
  const u = tnUsuarioSessao_(sessao);
  tnRepoAuditar_({
    registroId: cpfN.slice(-4),
    acao: 'TRABALHADOR_NAO_FILIADO_CADASTRADO',
    usuario: u.email || u.nome,
    perfil: u.perfil,
    setor: u.setor,
    sessao: tnHashHex_(String(token || '')).slice(0, 12),
    valorNovo: { filiado: 'N', origem: 'TAXA_NEGOCIAL' },
    destino: 'Associados'
  });

  return {
    ok: true,
    dados: {
      nome: criado.Nome || '',
      cpf: cpfN,
      filiado: false
    }
  };
}

function taxaNegocialValidarPreRegistro(token, payload) {
  tnSessao_(token);
  payload = payload || {};

  const campanha = tnRepoBuscarCampanhaPorId_(payload.idCampanha) || tnRepoBuscarCampanhaAtiva_();
  tnValidarCampanhaAberta_(campanha);

  const cpfN = tnNormalizarCpf_(payload.cpf);
  if (!tnValidarCpfBasico_(cpfN)) {
    return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };
  }

  const trabalhador = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (!trabalhador) {
    return { ok: false, codigo: 'TRABALHADOR_NAO_ENCONTRADO', mensagem: 'Trabalhador não cadastrado.' };
  }

  if (String(trabalhador.Filiado || '').toUpperCase() === 'S') {
    return {
      ok: false,
      codigo: 'TRABALHADOR_FILIADO',
      mensagem: 'Este trabalhador consta como filiado. A situação cadastral deve ser verificada antes de continuar.'
    };
  }

  const escola = tnRepoBuscarEscola_(payload.escolaId, payload.cnpj);
  if (!escola) {
    return { ok: false, codigo: 'ESCOLA_NAO_ENCONTRADA', mensagem: 'Escola não encontrada.' };
  }

  const escolaId = escola.EscolaID || '';
  if (!escolaId) {
    return { ok: false, codigo: 'ESCOLA_SEM_ID', mensagem: 'A escola não possui EscolaID e precisa ser saneada antes do registro.' };
  }

  const chave = tnChaveUnica_(campanha.ID_CAMPANHA, cpfN, escolaId);
  const duplicada = tnRepoBuscarOposicaoPorChave_(chave);
  if (duplicada) {
    return {
      ok: false,
      codigo: 'OPOSICAO_DUPLICADA',
      mensagem: 'Já existe oposição válida para este trabalhador, campanha e escola.',
      dados: { protocolo: duplicada.PROTOCOLO || '', idOposicao: duplicada.ID_OPOSICAO || '' }
    };
  }

  return {
    ok: true,
    dados: {
      campanha: {
        id: campanha.ID_CAMPANHA,
        titulo: campanha.TITULO,
        exercicio: campanha.EXERCICIO,
        textoManifestacao: campanha.TEXTO_MANIFESTACAO,
        versaoManifestacao: campanha.VERSAO_MANIFESTACAO
      },
      trabalhador: {
        nome: trabalhador.Nome || '',
        cpf: cpfN,
        filiado: false
      },
      escola: {
        id: escolaId,
        nome: escola['Escola (Razão Social)'] || '',
        cnpj: escola.CNPJ || ''
      },
      chaveUnica: chave
    }
  };
}

/**
 * Registra somente oposição JÁ CONFIRMADA.
 * OTP/assinatura será conectado na Fase seguinte.
 * Por segurança, exige confirmacaoEletronica.confirmada === true.
 */
function taxaNegocialRegistrarOposicaoConfirmada(token, payload) {
  const sessao = tnSessao_(token);
  payload = payload || {};

  if (!payload.confirmacaoEletronica || payload.confirmacaoEletronica.confirmada !== true) {
    return { ok: false, codigo: 'CONFIRMACAO_OBRIGATORIA', mensagem: 'A manifestação ainda não foi confirmada eletronicamente.' };
  }

  const pre = taxaNegocialValidarPreRegistro(token, payload);
  if (!pre.ok) return pre;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Revalidação sob lock: impede dupla gravação concorrente.
    const existente = tnRepoBuscarOposicaoPorChave_(pre.dados.chaveUnica);
    if (existente) {
      return {
        ok: false,
        codigo: 'OPOSICAO_DUPLICADA',
        mensagem: 'Já existe oposição válida para este trabalhador, campanha e escola.',
        dados: { protocolo: existente.PROTOCOLO || '', idOposicao: existente.ID_OPOSICAO || '' }
      };
    }

    const campanha = tnRepoBuscarCampanhaPorId_(pre.dados.campanha.id);
    tnValidarCampanhaAberta_(campanha);

    const agora = new Date();
    const ano = Utilities.formatDate(agora, TN_CONFIG.FUSO_HORARIO, 'yyyy');
    const protocolo = tnGerarProtocoloSemLock_(ano);
    const idOposicao = tnGerarId_('OPOS');
    const u = tnUsuarioSessao_(sessao);

    const textoAceito = String(campanha.TEXTO_MANIFESTACAO || '');
    const hashManifestacao = tnHashHex_([
      campanha.ID_CAMPANHA,
      String(campanha.VERSAO_MANIFESTACAO || ''),
      pre.dados.trabalhador.cpf,
      pre.dados.escola.id,
      textoAceito
    ].join('|'));

    const registro = {
      ID_OPOSICAO: idOposicao,
      PROTOCOLO: protocolo,
      ID_CAMPANHA: campanha.ID_CAMPANHA,
      CPF_NORMALIZADO: pre.dados.trabalhador.cpf,
      NOME_SNAPSHOT: pre.dados.trabalhador.nome,
      FILIADO_SNAPSHOT: 'N',
      ESCOLA_ID: pre.dados.escola.id,
      CNPJ_SNAPSHOT: pre.dados.escola.cnpj,
      ESCOLA_SNAPSHOT: pre.dados.escola.nome,
      CHAVE_UNICA: pre.dados.chaveUnica,
      DATA_HORA_OPOSICAO: agora,
      STATUS_OPOSICAO: 'REGISTRADA',
      STATUS_COMUNICACAO: 'NAO_AGRUPADA',
      FORMA_CONFIRMACAO: payload.confirmacaoEletronica.metodo || 'ELETRONICA',
      DOCUMENTO_CONFERIDO: payload.documentoConferido === true ? 'SIM' : 'NAO',
      TIPO_DOCUMENTO_CONFERIDO: tnNormalizarTexto_(payload.tipoDocumentoConferido),
      OTP_VALIDADO: payload.confirmacaoEletronica.otpValidado === true ? 'SIM' : 'NAO',
      HASH_MANIFESTACAO: hashManifestacao,
      HASH_PDF: '',
      LINK_PDF: '',
      ID_LOTE: '',
      NUMERO_OFICIO: '',
      ID_FILA_OFICIO: '',
      REGISTRADO_POR: u.email || u.nome,
      REGISTRADO_EM: agora,
      ATUALIZADO_POR: u.email || u.nome,
      ATUALIZADO_EM: agora,
      CANCELADO_POR: '',
      CANCELADO_EM: '',
      MOTIVO_CANCELAMENTO: '',
      OBSERVACAO: 'Registro eletrônico — aguardando geração do comprovante PDF.'
    };

    const criado = tnRepoInserirOposicao_(registro);

    tnRepoAuditar_({
      registroId: idOposicao,
      acao: 'OPOSICAO_CONFIRMADA',
      usuario: u.email || u.nome,
      perfil: u.perfil,
      setor: u.setor,
      sessao: tnHashHex_(String(token || '')).slice(0, 12),
      valorNovo: {
        idCampanha: campanha.ID_CAMPANHA,
        protocolo: protocolo,
        escolaId: pre.dados.escola.id,
        statusOposicao: 'REGISTRADA',
        statusComunicacao: 'NAO_AGRUPADA'
      },
      documento: protocolo,
      destino: 'TN_OPOSICOES'
    });

    return {
      ok: true,
      mensagem: 'Oposição registrada com sucesso.',
      dados: {
        idOposicao: criado.ID_OPOSICAO,
        protocolo: criado.PROTOCOLO,
        dataHora: tnFormatarDataHora_(agora),
        statusOposicao: criado.STATUS_OPOSICAO,
        statusComunicacao: criado.STATUS_COMUNICACAO
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function taxaNegocialCancelarOposicao(token, idOposicao, motivo) {
  const sessao = tnSessao_(token);
  const justificativa = tnNormalizarTexto_(motivo);
  if (justificativa.length < 10) {
    return { ok: false, codigo: 'MOTIVO_OBRIGATORIO', mensagem: 'Informe uma justificativa de cancelamento com pelo menos 10 caracteres.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const atual = tnRepoBuscarOposicaoPorId_(idOposicao);
    if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADA', mensagem: 'Oposição não encontrada.' };
    if (String(atual.STATUS_OPOSICAO || '').toUpperCase() === 'CANCELADA') {
      return { ok: true, codigo: 'JA_CANCELADA', mensagem: 'A oposição já está cancelada.' };
    }

    const agora = new Date();
    const u = tnUsuarioSessao_(sessao);
    const depois = tnRepoAtualizarOposicao_(idOposicao, {
      STATUS_OPOSICAO: 'CANCELADA',
      CANCELADO_POR: u.email || u.nome,
      CANCELADO_EM: agora,
      MOTIVO_CANCELAMENTO: justificativa,
      ATUALIZADO_POR: u.email || u.nome,
      ATUALIZADO_EM: agora
    });

    tnRepoAuditar_({
      registroId: idOposicao,
      acao: 'OPOSICAO_CANCELADA',
      usuario: u.email || u.nome,
      perfil: u.perfil,
      setor: u.setor,
      sessao: tnHashHex_(String(token || '')).slice(0, 12),
      valorAnterior: { statusOposicao: atual.STATUS_OPOSICAO },
      valorNovo: { statusOposicao: 'CANCELADA' },
      justificativa: justificativa,
      documento: atual.PROTOCOLO || '',
      destino: 'TN_OPOSICOES'
    });

    return { ok: true, mensagem: 'Oposição cancelada mantendo a trilha de auditoria.', dados: { protocolo: depois.PROTOCOLO } };
  } finally {
    lock.releaseLock();
  }
}
