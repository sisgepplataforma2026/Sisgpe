// ============================================================================
// SISGEP · TaxaNegocialApi.gs
// ÚNICA fachada pública do submódulo — HOMOLOGAÇÃO SOMENTE
// ============================================================================

/**
 * Gateway único chamado pelo frontend via google.script.run.
 * Toda ação é allowlisted; não há invocação dinâmica por nome de função.
 */
function taxaNegocialApi(token, acao, payload) {
  var sessao = tnSessao_(token);
  tnExigirHomologacaoSegura_();

  var nome = String(acao || '').trim();
  var dados = payload || {};
  var rotas = {
    campanhaAtiva: function() {
      return taxaNegocialObterCampanhaAtiva_(sessao);
    },
    buscarContexto: function() {
      return taxaNegocialBuscarContextoPorCpf_(sessao, dados.cpf, dados.escolaId, dados.cnpj);
    },
    cadastrarNaoFiliado: function() {
      return taxaNegocialCadastrarNaoFiliado_(sessao, dados);
    },
    validarPreRegistro: function() {
      return taxaNegocialValidarPreRegistro_(sessao, dados);
    },
    solicitarOtp: function() {
      return taxaNegocialSolicitarOTP_(sessao, dados);
    },
    confirmarOtp: function() {
      return taxaNegocialConfirmarOTP_(sessao, dados.challengeId, dados.codigo);
    },
    cancelarOposicao: function() {
      return taxaNegocialCancelarOposicao_(sessao, dados.idOposicao, dados.motivo);
    }
  };

  if (!Object.prototype.hasOwnProperty.call(rotas, nome)) {
    return { ok: false, codigo: 'ACAO_INVALIDA', mensagem: 'Ação da Taxa Negocial não reconhecida.' };
  }

  return rotas[nome]();
}
