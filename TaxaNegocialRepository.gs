// ============================================================================
// SISGEP · TaxaNegocialRepository.gs
// Persistência e consultas — HOMOLOGAÇÃO SOMENTE
// ============================================================================

function tnHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) throw new Error('Aba sem cabeçalho: ' + sheet.getName());
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var map = {};
  headers.forEach(function(h, i) { var k = String(h || '').trim(); if (k) map[k] = i; });
  return { headers: headers, map: map };
}

function tnLinhaParaObjeto_(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { if (h) obj[h] = row[i]; });
  return obj;
}

function tnLerRegistros_(nomeAba) {
  var sh = tnGetSheet_(nomeAba);
  var hm = tnHeaderMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues().map(function(row, idx) {
    var obj = tnLinhaParaObjeto_(hm.headers, row); obj.__row = idx + 2; return obj;
  });
}

function tnAppendObjeto_(nomeAba, obj) {
  var sh = tnGetSheet_(nomeAba);
  var hm = tnHeaderMap_(sh);
  sh.appendRow(hm.headers.map(function(h) { return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''; }));
  return sh.getLastRow();
}

function tnAtualizarObjetoPorLinha_(nomeAba, rowNumber, patch) {
  var sh = tnGetSheet_(nomeAba);
  var hm = tnHeaderMap_(sh);
  if (rowNumber < 2 || rowNumber > sh.getLastRow()) throw new Error('Linha inválida.');
  var range = sh.getRange(rowNumber, 1, 1, hm.headers.length);
  var row = range.getValues()[0];
  Object.keys(patch || {}).forEach(function(k) {
    if (hm.map[k] == null) throw new Error('Coluna inexistente em ' + nomeAba + ': ' + k);
    row[hm.map[k]] = patch[k];
  });
  range.setValues([row]);
  return tnLinhaParaObjeto_(hm.headers, row);
}

function tnRepoBuscarCampanhaPorId_(idCampanha) {
  var id = tnNormalizarTexto_(idCampanha);
  if (!id) return null;
  var itens = tnLerRegistros_(TN_CONFIG.ABAS.CAMPANHAS);
  for (var i = 0; i < itens.length; i++) if (String(itens[i].ID_CAMPANHA || '') === id) return itens[i];
  return null;
}

function tnRepoListarCampanhas_() { return tnLerRegistros_(TN_CONFIG.ABAS.CAMPANHAS); }

function tnRepoBuscarCampanhaAtiva_() {
  var agora = new Date();
  var ativas = tnRepoListarCampanhas_().filter(function(c) {
    if (String(c.STATUS || '').toUpperCase() !== 'ATIVA') return false;
    var ini = c.INICIO_OPOSICAO ? new Date(c.INICIO_OPOSICAO) : null;
    var fim = c.FIM_OPOSICAO ? new Date(c.FIM_OPOSICAO) : null;
    return (!ini || agora >= ini) && (!fim || agora <= fim);
  });
  if (ativas.length > 1) throw new Error('Existem múltiplas campanhas ATIVAS simultaneamente. Corrija a configuração.');
  return ativas[0] || null;
}

function tnRepoBuscarTrabalhadorPorCpf_(cpf) {
  var cpfN = tnNormalizarCpf_(cpf);
  if (!cpfN) return null;
  var sh = tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES);
  var hm = tnHeaderMap_(sh);
  var colCpf = hm.map.CPF;
  if (colCpf == null) throw new Error('Coluna CPF não encontrada na aba Associados.');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (tnNormalizarCpf_(values[i][colCpf]) === cpfN) {
      var obj = tnLinhaParaObjeto_(hm.headers, values[i]); obj.__row = i + 2; obj.CPF_NORMALIZADO = cpfN; return obj;
    }
  }
  return null;
}

function tnRepoCriarTrabalhadorNaoFiliado_(dados) {
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava do SISGEP indisponível.');
  var trava = travarSisgep_(30000);
  try {
    var cpfN = tnNormalizarCpf_(dados && dados.cpf);
    if (!tnValidarCpfBasico_(cpfN)) throw new Error('CPF inválido.');
    var existente = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
    if (existente) return existente;

    var sh = tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES);
    var hm = tnHeaderMap_(sh);
    var escolaNome = tnNormalizarTexto_(dados.escolaNome);
    if (escolaNome && typeof sindAss_normalizarNomeEscola_ === 'function') {
      try { escolaNome = sindAss_normalizarNomeEscola_(escolaNome) || escolaNome; } catch (e) {}
    }
    var cpfGravado = cpfN;
    if (typeof sindAss_fmtCPF_ === 'function') { try { cpfGravado = sindAss_fmtCPF_(cpfN) || cpfN; } catch (e2) {} }

    var obj = {};
    if (hm.map['Nome fantasia'] != null) obj['Nome fantasia'] = escolaNome;
    if (hm.map.Nome != null) obj.Nome = tnNormalizarTexto_(dados.nome);
    if (hm.map.CPF != null) obj.CPF = cpfGravado;
    if (hm.map.Filiado != null) obj.Filiado = 'N';
    if (hm.map.Celular != null) obj.Celular = tnNormalizarTexto_(dados.celular);
    if (hm.map['E-mail'] != null) obj['E-mail'] = tnNormalizarTexto_(dados.email);
    if (hm.map.ULTIMA_ATUALIZACAO != null) obj.ULTIMA_ATUALIZACAO = new Date();
    sh.appendRow(hm.headers.map(function(h) { return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''; }));
    return tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  } finally { trava.liberar(); }
}

function tnRepoBuscarEscola_(escolaId, cnpj) {
  var id = tnNormalizarTexto_(escolaId), cnpjN = tnNormalizarCnpj_(cnpj);
  var sh = tnGetSheet_(TN_CONFIG.ABAS.ESCOLAS), hm = tnHeaderMap_(sh);
  var idxId = hm.map.EscolaID, idxCnpj = hm.map.CNPJ, lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, hm.headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var byId = id && idxId != null && String(values[i][idxId] || '').trim() === id;
    var byCnpj = cnpjN && idxCnpj != null && tnNormalizarCnpj_(values[i][idxCnpj]) === cnpjN;
    if (byId || byCnpj) { var obj = tnLinhaParaObjeto_(hm.headers, values[i]); obj.__row = i + 2; obj.CNPJ_NORMALIZADO = tnNormalizarCnpj_(obj.CNPJ); return obj; }
  }
  return null;
}

function tnRepoBuscarOposicaoPorId_(idOposicao) {
  var id = tnNormalizarTexto_(idOposicao), itens = tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES);
  for (var i = 0; i < itens.length; i++) if (String(itens[i].ID_OPOSICAO || '') === id) return itens[i];
  return null;
}

function tnRepoBuscarOposicaoPorChave_(chaveUnica) {
  var chave = tnNormalizarTexto_(chaveUnica); if (!chave) return null;
  var itens = tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES);
  for (var i = 0; i < itens.length; i++) {
    if (String(itens[i].CHAVE_UNICA || '') === chave && ['CANCELADA','INVALIDADA'].indexOf(String(itens[i].STATUS_OPOSICAO || '').toUpperCase()) === -1) return itens[i];
  }
  return null;
}

function tnRepoInserirOposicao_(obj) {
  tnAppendObjeto_(TN_CONFIG.ABAS.OPOSICOES, obj);
  var criado = tnRepoBuscarOposicaoPorId_(obj.ID_OPOSICAO);
  if (!criado) throw new Error('Falha ao confirmar persistência da oposição.');
  return criado;
}

function tnRepoAtualizarOposicao_(idOposicao, patch) {
  var atual = tnRepoBuscarOposicaoPorId_(idOposicao);
  if (!atual) throw new Error('Oposição não encontrada.');
  return tnAtualizarObjetoPorLinha_(TN_CONFIG.ABAS.OPOSICOES, atual.__row, patch);
}

function tnRepoBuscarLoteAberto_(idCampanha, escolaId) {
  var itens = tnLerRegistros_(TN_CONFIG.ABAS.LOTES);
  for (var i = 0; i < itens.length; i++) if (String(itens[i].ID_CAMPANHA || '') === String(idCampanha || '') && String(itens[i].ESCOLA_ID || '') === String(escolaId || '') && String(itens[i].STATUS || '').toUpperCase() === 'ABERTO') return itens[i];
  return null;
}

function tnRepoAuditar_(evento) {
  if (typeof auditar_ !== 'function') {
    Logger.log('Taxa Negocial: auditar_ indisponível para ' + String(evento && evento.acao || 'ação'));
    return { ok: false, destino: 'NENHUM' };
  }
  evento = evento || {};
  return auditar_({
    registroId: evento.registroId || '', modulo: TN_CONFIG.MODULO, submodulo: TN_CONFIG.SUBMODULO,
    acao: evento.acao || '', sessao: evento.sessao || {}, valorAnterior: evento.valorAnterior,
    valorNovo: tnSanitizarParaLog_(evento.valorNovo), justificativa: evento.justificativa || '',
    documento: evento.documento || '', resultado: evento.resultado || 'SUCESSO', origem: evento.origem || 'PORTAL_ADMIN'
  });
}
