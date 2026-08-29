// ============================================================================
// SISGEP · TaxaNegocialSmokeTest.gs
// Testes SOMENTE LEITURA para a fundação da Taxa Negocial
// ============================================================================

function tnSmokeTestSomenteLeitura() {
  const resultado = {
    ok: true,
    timestamp: tnFormatarDataHora_(new Date()),
    planilha: TN_CONFIG.PLANILHA_HML_ID,
    fusoEsperado: TN_CONFIG.FUSO_HORARIO,
    verificacoes: []
  };

  function check(nome, fn) {
    try {
      const valor = fn();
      resultado.verificacoes.push({ nome: nome, ok: true, valor: valor });
    } catch (e) {
      resultado.ok = false;
      resultado.verificacoes.push({ nome: nome, ok: false, erro: e.message });
    }
  }

  check('Aba TN_CAMPANHAS', function() {
    return tnGetSheet_(TN_CONFIG.ABAS.CAMPANHAS).getName();
  });

  check('Aba TN_OPOSICOES', function() {
    return tnGetSheet_(TN_CONFIG.ABAS.OPOSICOES).getName();
  });

  check('Aba TN_LOTES', function() {
    return tnGetSheet_(TN_CONFIG.ABAS.LOTES).getName();
  });

  check('Cadastro Associados', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.TRABALHADORES));
    ['Nome', 'CPF', 'Filiado'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return 'OK';
  });

  check('Cadastro Escolas', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.ESCOLAS));
    ['EscolaID', 'CNPJ', 'Escola (Razão Social)'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return 'OK';
  });

  check('Auditoria central', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.AUDITORIA));
    ['DATA_HORA', 'REGISTRO_ID', 'MODULO', 'ACAO', 'USUARIO', 'RESULTADO'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return 'OK';
  });

  check('Cabeçalhos TN_CAMPANHAS', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.CAMPANHAS));
    ['ID_CAMPANHA', 'EXERCICIO', 'INICIO_OPOSICAO', 'FIM_OPOSICAO', 'STATUS'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return hm.headers.length;
  });

  check('Cabeçalhos TN_OPOSICOES', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.OPOSICOES));
    ['ID_OPOSICAO', 'PROTOCOLO', 'ID_CAMPANHA', 'CPF_NORMALIZADO', 'ESCOLA_ID',
     'CHAVE_UNICA', 'STATUS_OPOSICAO', 'STATUS_COMUNICACAO'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return hm.headers.length;
  });

  check('Cabeçalhos TN_LOTES', function() {
    const hm = tnHeaderMap_(tnGetSheet_(TN_CONFIG.ABAS.LOTES));
    ['ID_LOTE', 'ID_CAMPANHA', 'ESCOLA_ID', 'STATUS', 'QUANTIDADE_OPOSICOES'].forEach(function(h) {
      if (hm.map[h] == null) throw new Error('Coluna ausente: ' + h);
    });
    return hm.headers.length;
  });

  check('Chave única determinística', function() {
    const a = tnChaveUnica_('TN-TESTE', '07067932777', 'ESC-000001');
    const b = tnChaveUnica_('TN-TESTE', '070.679.327-77', 'ESC-000001');
    if (a !== b) throw new Error('Normalização da chave única falhou.');
    return a.slice(0, 12) + '…';
  });

  // Não cria registro, não altera planilha, não envia e-mail.
  return resultado;
}
