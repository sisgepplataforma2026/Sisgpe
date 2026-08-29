// ============================================================================
// SISGEP · TaxaNegocialRepository.gs
// Persistência e consultas — HML SOMENTE
// ============================================================================

function tnHeaderMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (!lastCol) throw new Error('Aba sem cabeçalho: ' + sheet.getName());
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const map = {};
  headers.forEach(function(h, i) {
    const chave = String(h || '').trim();
    if (chave) map[chave] = i;
  });
  return { headers: headers, map: map };
}

function tnLinhaParaObjeto_(headers, row) {
  const obj = {};
  headers.forEach(function(h, i) {
    if (h) obj[h] = row[i];
  });
  return obj;
}

function tnLerRegistros_(nomeAba) {
  const sh = tnGetSheet_(nomeAba);
  const lastRow = sh.getLastRow();
  const hm = tnHeaderMap_(sh);
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues();
  return values.map(function(row, idx) {
    const obj = tnLinhaParaObjeto_(hm.headers, row);
    obj.__row = idx + 2;
    return obj;
  });
}

function tnAppendObjeto_(nomeAba, obj) {
  const sh = tnGetSheet_(nomeAba);
  const hm = tnHeaderMap_(sh);
  const row = hm.headers.map(function(h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
  sh.appendRow(row);
  return sh.getLastRow();
}

function tnAtualizarObjetoPorLinha_(nomeAba, rowNumber, patch) {
  const sh = tnGetSheet_(nomeAba);
  const hm = tnHeaderMap_(sh);
  if (rowNumber < 2 || rowNumber > sh.getLastRow()) throw new Error('Linha inválida.');
  const range = sh.getRange(rowNumber, 1, 1, hm.headers.length);
  const row = range.getValues()[0];
  Object.keys(patch || {}).forEach(function(k) {
    if (hm.map[k] == null) throw new Error('Coluna inexistente em ' + nomeAba + ': ' + k);
    row[hm.map[k]] = patch[k];
  });
  range.setValues([row]);
  return tnLinhaParaObjeto_(hm.headers, row);
}

function tnRepoBuscarCampanhaPorId_(idCampanha) {
  const id = tnNormalizarTexto_(idCampanha);
  if (!id) return null;
  const itens = tnLerRegistros_(TN_CONFIG.ABAS.CAMPANHAS);
  for (let i = 0; i < itens.length; i++) {
    if (String(itens[i].ID_CAMPANHA || '') === id) return itens[i];
  }
  return null;
}

function tnRepoListarCampanhas_() {
  return tnLerRegistros_(TN_CONFIG.ABAS.CAMPANHAS);
}

function tnRepoBuscarCampanhaAtiva_() {
  const agora = new Date();
  const itens = tnRepoListarCampanhas_();
  const ativas = itens.filter(function(c) {
    if (String(c.STATUS || '').toUpperCase() !== 'ATIVA') return false;
    const ini = c.INICIO_OPOSICAO ? new Date(c.INICIO_OPOSICAO) : null;
    const fim = c.FIM_OPOSICAO ? new Date(c.FIM_OPOSICAO) : null;
    return (!ini || agora >= ini) && (!fim || agora <= fim);
  });
  if (ativas.length > 1) {
    throw new Error('Existem múltiplas campanhas ATIVAS simultaneamente. Corrija a configuração.');
  }
  return ativas[0] || null;
}

function tnRepoBuscarTrabalhadorPorCpf_(cpf) {
  const cpfN = tnNormalizarCpf_(cpf);
  if (!cpfN) return null;
  const sh = tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES);
  const hm = tnHeaderMap_(sh);
  const colCpf = hm.map.CPF;
  if (colCpf == null) throw new Error('Coluna CPF não encontrada na aba Associados.');
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const values = sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowCpf = tnNormalizarCpf_(values[i][colCpf]);
    if (rowCpf === cpfN) {
      const obj = tnLinhaParaObjeto_(hm.headers, values[i]);
      obj.__row = i + 2;
      obj.CPF_NORMALIZADO = cpfN;
      return obj;
    }
  }
  return null;
}

function tnRepoCriarTrabalhadorNaoFiliado_(dados) {
  const sh = tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES);
  const hm = tnHeaderMap_(sh);
  const cpfN = tnNormalizarCpf_(dados.cpf);
  if (!tnValidarCpfBasico_(cpfN)) throw new Error('CPF inválido.');

  const existente = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (existente) return existente;

  const obj = {};
  if (hm.map['Nome fantasia'] != null) obj['Nome fantasia'] = tnNormalizarTexto_(dados.escolaNome);
  if (hm.map.Nome != null) obj.Nome = tnNormalizarTexto_(dados.nome);
  if (hm.map.CPF != null) obj.CPF = cpfN;
  if (hm.map.Filiado != null) obj.Filiado = 'N';
  if (hm.map.Celular != null) obj.Celular = tnNormalizarTexto_(dados.celular);
  if (hm.map['E-mail'] != null) obj['E-mail'] = tnNormalizarTexto_(dados.email);
  if (hm.map.ULTIMA_ATUALIZACAO != null) obj.ULTIMA_ATUALIZACAO = new Date();

  const row = hm.headers.map(function(h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
  sh.appendRow(row);
  return tnRepoBuscarTrabalhadorPorCpf_(cpfN);
}

function tnRepoBuscarEscola_(escolaId, cnpj) {
  const id = tnNormalizarTexto_(escolaId);
  const cnpjN = tnNormalizarCnpj_(cnpj);
  const sh = tnGetSheet_(TN_CONFIG.ABAS.ESCOLAS);
  const hm = tnHeaderMap_(sh);
  const idxId = hm.map.EscolaID;
  const idxCnpj = hm.map.CNPJ;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const values = sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues();

  for (let i = 0; i < values.length; i++) {
    const byId = id && idxId != null && String(values[i][idxId] || '').trim() === id;
    const byCnpj = cnpjN && idxCnpj != null && tnNormalizarCnpj_(values[i][idxCnpj]) === cnpjN;
    if (byId || byCnpj) {
      const obj = tnLinhaParaObjeto_(hm.headers, values[i]);
      obj.__row = i + 2;
      obj.CNPJ_NORMALIZADO = tnNormalizarCnpj_(obj.CNPJ);
      return obj;
    }
  }
  return null;
}

function tnRepoBuscarOposicaoPorId_(idOposicao) {
  const id = tnNormalizarTexto_(idOposicao);
  const itens = tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES);
  for (let i = 0; i < itens.length; i++) {
    if (String(itens[i].ID_OPOSICAO || '') === id) return itens[i];
  }
  return null;
}

function tnRepoBuscarOposicaoPorChave_(chaveUnica) {
  const chave = tnNormalizarTexto_(chaveUnica);
  if (!chave) return null;
  const itens = tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES);
  for (let i = 0; i < itens.length; i++) {
    if (String(itens[i].CHAVE_UNICA || '') === chave &&
        ['CANCELADA', 'INVALIDADA'].indexOf(String(itens[i].STATUS_OPOSICAO || '').toUpperCase()) === -1) {
      return itens[i];
    }
  }
  return null;
}

function tnRepoInserirOposicao_(obj) {
  const row = tnAppendObjeto_(TN_CONFIG.ABAS.OPOSICOES, obj);
  const criado = tnRepoBuscarOposicaoPorId_(obj.ID_OPOSICAO);
  if (!criado) throw new Error('Falha ao confirmar persistência da oposição.');
  criado.__row = row;
  return criado;
}

function tnRepoAtualizarOposicao_(idOposicao, patch) {
  const atual = tnRepoBuscarOposicaoPorId_(idOposicao);
  if (!atual) throw new Error('Oposição não encontrada.');
  return tnAtualizarObjetoPorLinha_(TN_CONFIG.ABAS.OPOSICOES, atual.__row, patch);
}

function tnRepoBuscarLoteAberto_(idCampanha, escolaId) {
  const itens = tnLerRegistros_(TN_CONFIG.ABAS.LOTES);
  for (let i = 0; i < itens.length; i++) {
    if (String(itens[i].ID_CAMPANHA || '') === String(idCampanha || '') &&
        String(itens[i].ESCOLA_ID || '') === String(escolaId || '') &&
        String(itens[i].STATUS || '').toUpperCase() === 'ABERTO') {
      return itens[i];
    }
  }
  return null;
}

function tnRepoAuditar_(evento) {
  const sh = tnGetSheet_(TN_CONFIG.ABAS.AUDITORIA);
  const hm = tnHeaderMap_(sh);
  const rowObj = {
    DATA_HORA: new Date(),
    REGISTRO_ID: evento.registroId || '',
    MODULO: TN_CONFIG.MODULO,
    SUBMODULO: evento.submodulo || TN_CONFIG.SUBMODULO,
    ACAO: evento.acao || '',
    USUARIO: evento.usuario || '',
    PERFIL: evento.perfil || '',
    SETOR: evento.setor || '',
    ORIGEM: evento.origem || 'SISGEP',
    SESSAO: evento.sessao || '',
    VALOR_ANTERIOR: evento.valorAnterior ? JSON.stringify(tnSanitizarParaLog_(evento.valorAnterior)) : '',
    VALOR_NOVO: evento.valorNovo ? JSON.stringify(tnSanitizarParaLog_(evento.valorNovo)) : '',
    JUSTIFICATIVA: evento.justificativa || '',
    DOCUMENTO: evento.documento || '',
    RESULTADO: evento.resultado || 'SUCESSO',
    DESTINO: evento.destino || 'TN_OPOSICOES'
  };
  const row = hm.headers.map(function(h) {
    return Object.prototype.hasOwnProperty.call(rowObj, h) ? rowObj[h] : '';
  });
  sh.appendRow(row);
}
