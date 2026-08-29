// ============================================================================
// SISGEP · TaxaNegocialService.gs
// Regras de negócio — HOMOLOGAÇÃO SOMENTE
// ============================================================================

function tnSessao_(token) {
  if (typeof exigirModulo_ !== 'function') throw new Error('Infraestrutura de autorização do SISGEP indisponível.');
  return exigirModulo_(token, 'documentos', false);
}

function tnValidarCampanhaAberta_(campanha) {
  if (!campanha) throw new Error('Campanha não encontrada.');
  if (String(campanha.STATUS || '').toUpperCase() !== 'ATIVA') throw new Error('A campanha não está ativa.');
  var agora = new Date();
  if (campanha.INICIO_OPOSICAO && agora < new Date(campanha.INICIO_OPOSICAO)) throw new Error('O período de oposição ainda não começou.');
  if (campanha.FIM_OPOSICAO && agora > new Date(campanha.FIM_OPOSICAO)) throw new Error('O período de oposição já foi encerrado.');
  return true;
}

function tnChaveUnica_(idCampanha, cpf, escolaId) {
  return tnHashHex_([tnNormalizarTexto_(idCampanha), tnNormalizarCpf_(cpf), tnNormalizarTexto_(escolaId)].join('|'));
}

function tnHashManifestacao_(campanha, cpf, escolaId) {
  return tnHashHex_([String(campanha.ID_CAMPANHA || ''), String(campanha.VERSAO_MANIFESTACAO || ''), tnNormalizarCpf_(cpf), String(escolaId || ''), String(campanha.TEXTO_MANIFESTACAO || '')].join('|'));
}

function tnGerarProtocoloSemLock_(ano) {
  var a = String(ano || Utilities.formatDate(new Date(), TN_CONFIG.FUSO_HORARIO, 'yyyy'));
  var props = PropertiesService.getScriptProperties();
  var key = 'TN_PROTOCOLO_SEQ_' + a;
  var prox = Number(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(prox));
  return 'OP-' + a + '-' + String(prox).padStart(6, '0');
}

function tnGerarProtocolo_(ano) {
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava indisponível.');
  var trava = travarSisgep_(20000);
  try { return tnGerarProtocoloSemLock_(ano); } finally { trava.liberar(); }
}

function tnValidarPreRegistroInterno_(payload) {
  payload = payload || {};
  tnExigirHomologacaoSegura_();
  var campanha = tnRepoBuscarCampanhaPorId_(payload.idCampanha) || tnRepoBuscarCampanhaAtiva_();
  tnValidarCampanhaAberta_(campanha);

  var cpfN = tnNormalizarCpf_(payload.cpf);
  if (!tnValidarCpfBasico_(cpfN)) return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };

  var trabalhador = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (!trabalhador) return { ok: false, codigo: 'TRABALHADOR_NAO_ENCONTRADO', mensagem: 'Trabalhador não cadastrado.' };
  if (String(trabalhador.Filiado || '').toUpperCase() === 'S') {
    return { ok: false, codigo: 'TRABALHADOR_FILIADO', mensagem: 'Este trabalhador consta como filiado. A situação cadastral deve ser verificada antes de continuar.' };
  }

  var escola = tnRepoBuscarEscola_(payload.escolaId, payload.cnpj);
  if (!escola) return { ok: false, codigo: 'ESCOLA_NAO_ENCONTRADA', mensagem: 'Escola não encontrada.' };
  var escolaId = String(escola.EscolaID || '').trim();
  if (!escolaId) return { ok: false, codigo: 'ESCOLA_SEM_ID', mensagem: 'A escola não possui EscolaID e precisa ser saneada antes do registro.' };

  var chave = tnChaveUnica_(campanha.ID_CAMPANHA, cpfN, escolaId);
  var duplicada = tnRepoBuscarOposicaoPorChave_(chave);
  if (duplicada) {
    return { ok: false, codigo: 'OPOSICAO_DUPLICADA', mensagem: 'Já existe oposição válida para este trabalhador, campanha e escola.', dados: { protocolo: duplicada.PROTOCOLO || '', idOposicao: duplicada.ID_OPOSICAO || '' } };
  }

  var nomeEscola = escola['Escola (Razão Social)'] || escola.NOME_FANTASIA || escola['Nome fantasia'] || '';
  var email = trabalhador['E-mail'] || trabalhador.EMAIL || '';
  return {
    ok: true, campanha: campanha, trabalhador: trabalhador, escola: escola, cpf: cpfN,
    escolaId: escolaId, escolaNome: nomeEscola, cnpj: escola.CNPJ || '', chaveUnica: chave,
    hashManifestacao: tnHashManifestacao_(campanha, cpfN, escolaId),
    email: tnNormalizarTexto_(email), celular: tnNormalizarTexto_(trabalhador.Celular || trabalhador.CELULAR2 || '')
  };
}

function tnPreRegistroDto_(pre) {
  if (!pre || !pre.ok) return pre;
  return { ok: true, dados: {
    campanha: { id: pre.campanha.ID_CAMPANHA, titulo: pre.campanha.TITULO, exercicio: pre.campanha.EXERCICIO, textoManifestacao: pre.campanha.TEXTO_MANIFESTACAO, versaoManifestacao: pre.campanha.VERSAO_MANIFESTACAO },
    trabalhador: { nome: pre.trabalhador.Nome || '', cpf: pre.cpf, filiado: false, temEmail: !!pre.email, temCelular: !!pre.celular },
    escola: { id: pre.escolaId, nome: pre.escolaNome, cnpj: pre.cnpj },
    chaveUnica: pre.chaveUnica, hashManifestacao: pre.hashManifestacao
  } };
}

function taxaNegocialObterCampanhaAtiva(token) {
  tnSessao_(token); tnExigirHomologacaoSegura_();
  return { ok: true, dados: tnRepoBuscarCampanhaAtiva_() || null };
}

function taxaNegocialBuscarContextoPorCpf(token, cpf, escolaId, cnpj) {
  tnSessao_(token); tnExigirHomologacaoSegura_();
  var cpfN = tnNormalizarCpf_(cpf);
  if (!tnValidarCpfBasico_(cpfN)) return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };
  var trabalhador = tnRepoBuscarTrabalhadorPorCpf_(cpfN), escola = tnRepoBuscarEscola_(escolaId, cnpj), campanha = tnRepoBuscarCampanhaAtiva_();
  return { ok: true, dados: {
    campanha: campanha,
    trabalhador: trabalhador ? { nome: trabalhador.Nome || '', cpf: cpfN, filiado: String(trabalhador.Filiado || '').toUpperCase() === 'S', situacaoFiliacao: trabalhador.Filiado || '', matricula: trabalhador.MATRICULA || '', temCelular: !!tnNormalizarTexto_(trabalhador.Celular || trabalhador.CELULAR2 || ''), temEmail: !!tnNormalizarTexto_(trabalhador['E-mail'] || trabalhador.EMAIL || '') } : null,
    escola: escola ? { id: escola.EscolaID || '', nome: escola['Escola (Razão Social)'] || escola.NOME_FANTASIA || '', cnpj: escola.CNPJ || '', cidade: escola.Cidade || '', emailPrincipal: escola['E-mail (principal)'] || '' } : null
  } };
}

function taxaNegocialCadastrarNaoFiliado(token, dados) {
  var sessao = tnSessao_(token); tnExigirHomologacaoSegura_(); dados = dados || {};
  var cpfN = tnNormalizarCpf_(dados.cpf);
  if (!tnValidarCpfBasico_(cpfN)) return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };
  if (!tnNormalizarTexto_(dados.nome)) return { ok: false, codigo: 'NOME_OBRIGATORIO', mensagem: 'Nome obrigatório.' };
  var existente = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (existente) return { ok: true, codigo: 'JA_EXISTE', dados: { existente: true, filiado: String(existente.Filiado || '').toUpperCase() === 'S' } };
  var criado = tnRepoCriarTrabalhadorNaoFiliado_(dados);
  tnRepoAuditar_({ registroId: 'CPF-…' + cpfN.slice(-4), acao: 'TRABALHADOR_NAO_FILIADO_CADASTRADO', sessao: sessao, valorNovo: { filiado: 'N', origem: 'TAXA_NEGOCIAL' } });
  return { ok: true, dados: { nome: criado.Nome || '', cpf: cpfN, filiado: false } };
}

function taxaNegocialValidarPreRegistro(token, payload) {
  tnSessao_(token);
  return tnPreRegistroDto_(tnValidarPreRegistroInterno_(payload));
}

function tnRegistrarOposicaoConfirmada_(sessao, pre, evidencia) {
  if (!pre || !pre.ok) throw new Error('Pré-registro inválido.');
  if (!evidencia || evidencia.validadaNoServidor !== true) throw new Error('Confirmação eletrônica do servidor ausente.');
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava indisponível.');
  var trava = travarSisgep_(30000);
  try {
    var atual = tnValidarPreRegistroInterno_({ idCampanha: pre.campanha.ID_CAMPANHA, cpf: pre.cpf, escolaId: pre.escolaId });
    if (!atual.ok) return atual;
    if (String(atual.chaveUnica) !== String(pre.chaveUnica) || String(atual.hashManifestacao) !== String(pre.hashManifestacao)) {
      return { ok: false, codigo: 'MANIFESTACAO_ALTERADA', mensagem: 'Os dados da manifestação mudaram. Gere uma nova confirmação.' };
    }

    var agora = new Date(), ano = Utilities.formatDate(agora, TN_CONFIG.FUSO_HORARIO, 'yyyy');
    var protocolo = tnGerarProtocoloSemLock_(ano), idOposicao = tnGerarId_('OPOS');
    var usuario = sessao.email || sessao.usuario || '';
    var registro = {
      ID_OPOSICAO: idOposicao, PROTOCOLO: protocolo, ID_CAMPANHA: atual.campanha.ID_CAMPANHA,
      CPF_NORMALIZADO: atual.cpf, NOME_SNAPSHOT: atual.trabalhador.Nome || '', FILIADO_SNAPSHOT: 'N',
      ESCOLA_ID: atual.escolaId, CNPJ_SNAPSHOT: atual.cnpj, ESCOLA_SNAPSHOT: atual.escolaNome,
      CHAVE_UNICA: atual.chaveUnica, DATA_HORA_OPOSICAO: agora, STATUS_OPOSICAO: 'REGISTRADA',
      STATUS_COMUNICACAO: 'NAO_AGRUPADA', FORMA_CONFIRMACAO: evidencia.metodo || 'ELETRONICA',
      DOCUMENTO_CONFERIDO: evidencia.documentoConferido === true ? 'SIM' : 'NAO',
      TIPO_DOCUMENTO_CONFERIDO: tnNormalizarTexto_(evidencia.tipoDocumentoConferido),
      OTP_VALIDADO: evidencia.otpValidado === true ? 'SIM' : 'NAO', HASH_MANIFESTACAO: atual.hashManifestacao,
      HASH_PDF: '', LINK_PDF: '', ID_LOTE: '', NUMERO_OFICIO: '', ID_FILA_OFICIO: '',
      REGISTRADO_POR: usuario, REGISTRADO_EM: agora, ATUALIZADO_POR: usuario, ATUALIZADO_EM: agora,
      CANCELADO_POR: '', CANCELADO_EM: '', MOTIVO_CANCELAMENTO: '',
      OBSERVACAO: 'Registro eletrônico — aguardando geração do comprovante PDF.'
    };
    var criado = tnRepoInserirOposicao_(registro);
    tnRepoAuditar_({ registroId: idOposicao, acao: 'OPOSICAO_CONFIRMADA', sessao: sessao, valorNovo: { idCampanha: atual.campanha.ID_CAMPANHA, protocolo: protocolo, escolaId: atual.escolaId, statusOposicao: 'REGISTRADA', statusComunicacao: 'NAO_AGRUPADA', metodoConfirmacao: evidencia.metodo || 'ELETRONICA' }, documento: protocolo });
    return { ok: true, mensagem: 'Oposição registrada com sucesso.', dados: { idOposicao: criado.ID_OPOSICAO, protocolo: criado.PROTOCOLO, dataHora: tnFormatarDataHora_(agora), statusOposicao: criado.STATUS_OPOSICAO, statusComunicacao: criado.STATUS_COMUNICACAO } };
  } finally { trava.liberar(); }
}

function taxaNegocialRegistrarOposicaoConfirmada(token, payload) {
  tnSessao_(token);
  return { ok: false, codigo: 'CONFIRMACAO_SERVIDOR_OBRIGATORIA', mensagem: 'Use o fluxo de confirmação eletrônica do servidor antes de registrar a oposição.' };
}

function taxaNegocialCancelarOposicao(token, idOposicao, motivo) {
  var sessao = tnSessao_(token); tnExigirHomologacaoSegura_();
  var justificativa = tnNormalizarTexto_(motivo);
  if (justificativa.length < 10) return { ok: false, codigo: 'MOTIVO_OBRIGATORIO', mensagem: 'Informe uma justificativa de cancelamento com pelo menos 10 caracteres.' };
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava indisponível.');
  var trava = travarSisgep_(20000);
  try {
    var atual = tnRepoBuscarOposicaoPorId_(idOposicao);
    if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADA', mensagem: 'Oposição não encontrada.' };
    if (String(atual.STATUS_OPOSICAO || '').toUpperCase() === 'CANCELADA') return { ok: true, codigo: 'JA_CANCELADA', mensagem: 'A oposição já está cancelada.' };
    var agora = new Date(), usuario = sessao.email || sessao.usuario || '';
    var depois = tnRepoAtualizarOposicao_(idOposicao, { STATUS_OPOSICAO: 'CANCELADA', CANCELADO_POR: usuario, CANCELADO_EM: agora, MOTIVO_CANCELAMENTO: justificativa, ATUALIZADO_POR: usuario, ATUALIZADO_EM: agora });
    tnRepoAuditar_({ registroId: idOposicao, acao: 'OPOSICAO_CANCELADA', sessao: sessao, valorAnterior: { statusOposicao: atual.STATUS_OPOSICAO }, valorNovo: { statusOposicao: 'CANCELADA' }, justificativa: justificativa, documento: atual.PROTOCOLO || '' });
    return { ok: true, mensagem: 'Oposição cancelada mantendo a trilha de auditoria.', dados: { protocolo: depois.PROTOCOLO } };
  } finally { trava.liberar(); }
}
