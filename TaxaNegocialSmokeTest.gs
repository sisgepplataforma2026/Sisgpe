// ============================================================================
// SISGEP · TaxaNegocialSmokeTest.gs
// Testes SOMENTE LEITURA para a fundação da Taxa Negocial
// Função interna: executável no editor, não exposta ao google.script.run.
// ============================================================================

function tnSmokeTestSomenteLeitura_() {
  var resultado = { ok: true, timestamp: tnFormatarDataHora_(new Date()), fusoEsperado: TN_CONFIG.FUSO_HORARIO, verificacoes: [] };

  function check(nome, fn) {
    try { resultado.verificacoes.push({ nome: nome, ok: true, valor: fn() }); }
    catch (e) { resultado.ok = false; resultado.verificacoes.push({ nome: nome, ok: false, erro: e.message }); }
  }

  check('Guard-rail de homologação', function() {
    var alvo = tnExigirHomologacaoSegura_();
    if (alvo.planilhaId !== TN_CONFIG.PLANILHA_HML_ESPERADA_ID) throw new Error('ID HML divergente.');
    return alvo.ambiente + ' · ' + alvo.planilhaNome;
  });

  check('Infraestrutura central', function() {
    var exigidas = [
      ['documentosExigirHomologacaoSegura_', typeof documentosExigirHomologacaoSegura_],
      ['exigirModulo_', typeof exigirModulo_],
      ['getSessaoUsuario', typeof getSessaoUsuario],
      ['travarSisgep_', typeof travarSisgep_],
      ['auditar_', typeof auditar_],
      ['enviarEmailSISGEP_', typeof enviarEmailSISGEP_]
    ];
    exigidas.forEach(function(item) { if (item[1] !== 'function') throw new Error('Função ausente: ' + item[0]); });
    return 'OK';
  });

  check('Aba TN_CAMPANHAS', function() { return tnGetSheet_(TN_CONFIG.ABAS.CAMPANHAS).getName(); });
  check('Aba TN_OPOSICOES', function() { return tnGetSheet_(TN_CONFIG.ABAS.OPOSICOES).getName(); });
  check('Aba TN_LOTES', function() { return tnGetSheet_(TN_CONFIG.ABAS.LOTES).getName(); });

  check('Cadastro Associados', function() {
    var hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES));
    ['Nome','CPF','Filiado'].forEach(function(h) { if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h); });
    return 'OK';
  });

  check('Cadastro Escolas', function() {
    var hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.ESCOLAS));
    ['EscolaID','CNPJ','Escola (Razão Social)'].forEach(function(h) { if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h); });
    return 'OK';
  });

  check('Cabeçalhos TN_CAMPANHAS', function() {
    var hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.CAMPANHAS));
    ['ID_CAMPANHA','EXERCICIO','INICIO_OPOSICAO','FIM_OPOSICAO','STATUS'].forEach(function(h) { if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h); });
    return hm.headers.length;
  });

  check('Cabeçalhos TN_OPOSICOES', function() {
    var hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.OPOSICOES));
    ['ID_OPOSICAO','PROTOCOLO','ID_CAMPANHA','CPF_NORMALIZADO','ESCOLA_ID','CHAVE_UNICA','STATUS_OPOSICAO','STATUS_COMUNICACAO','OTP_VALIDADO'].forEach(function(h) { if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h); });
    return hm.headers.length;
  });

  check('Cabeçalhos TN_LOTES', function() {
    var hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.LOTES));
    ['ID_LOTE','ID_CAMPANHA','ESCOLA_ID','STATUS','QUANTIDADE_OPOSICOES'].forEach(function(h) { if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h); });
    return hm.headers.length;
  });

  check('Chave única determinística', function() {
    var a = tnChaveUnica_('TN-TESTE','07067932777','ESC-000001');
    var b = tnChaveUnica_('TN-TESTE','070.679.327-77','ESC-000001');
    if (a !== b) throw new Error('Normalização da chave única falhou.');
    return a.slice(0,12) + '…';
  });

  check('Política OTP', function() {
    if (TN_CONFIG.OTP.VALIDADE_SEG !== 600) throw new Error('Validade OTP inesperada.');
    if (TN_CONFIG.OTP.MAX_TENTATIVAS !== 5) throw new Error('Limite de tentativas inesperado.');
    return '600s · 5 tentativas';
  });

  return resultado;
}
