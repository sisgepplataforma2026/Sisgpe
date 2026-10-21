// ============================================================================
// SISGEP · TaxaNegocialHistorico.gs
// Histórico operacional do trabalhador — HOMOLOGAÇÃO SOMENTE
// ============================================================================

/**
 * O cadastro Associados não possui coluna de histórico. A fonte oficial do
 * histórico de oposição é TN_OPOSICOES; esta função apenas monta uma visão
 * humana sem duplicar ou sobrescrever o cadastro mestre.
 */
function taxaNegocialHistoricoTrabalhador_(sessao, cpf) {
  tnExigirHomologacaoSegura_();
  var cpfN = tnNormalizarCpf_(cpf);
  if (!tnValidarCpfBasico_(cpfN)) {
    return { ok: false, codigo: 'CPF_INVALIDO', mensagem: 'CPF inválido.' };
  }

  var trabalhador = tnRepoBuscarTrabalhadorPorCpf_(cpfN);
  if (!trabalhador) {
    return { ok: false, codigo: 'TRABALHADOR_NAO_ENCONTRADO', mensagem: 'Trabalhador não cadastrado.' };
  }

  var itens = tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES)
    .filter(function(o) { return tnNormalizarCpf_(o.CPF_NORMALIZADO) === cpfN; })
    .sort(function(a, b) {
      var da = a.DATA_HORA_OPOSICAO ? new Date(a.DATA_HORA_OPOSICAO).getTime() : 0;
      var db = b.DATA_HORA_OPOSICAO ? new Date(b.DATA_HORA_OPOSICAO).getTime() : 0;
      return db - da;
    })
    .map(function(o) {
      return {
        idOposicao: o.ID_OPOSICAO || '',
        protocolo: o.PROTOCOLO || '',
        campanha: o.ID_CAMPANHA || '',
        escolaId: o.ESCOLA_ID || '',
        escola: o.ESCOLA_SNAPSHOT || '',
        cnpj: o.CNPJ_SNAPSHOT || '',
        dataHora: tnComprovanteDataHora_(o.DATA_HORA_OPOSICAO),
        statusOposicao: o.STATUS_OPOSICAO || '',
        statusComunicacao: o.STATUS_COMUNICACAO || '',
        comprovanteGerado: !!(o.HASH_PDF && o.LINK_PDF),
        codigoAutenticidade: tnComprovanteCodigoFormatado_(o.CODIGO_AUTENTICIDADE || ''),
        numeroOficio: o.NUMERO_OFICIO || ''
      };
    });

  tnRepoAuditar_({
    registroId: 'CPF-…' + cpfN.slice(-4),
    acao: 'HISTORICO_OPOSICOES_CONSULTADO',
    sessao: sessao,
    valorNovo: { quantidade: itens.length }
  });

  return {
    ok: true,
    dados: {
      trabalhador: {
        nome: trabalhador.Nome || '',
        cpfMascarado: '***.***.' + cpfN.slice(6, 9) + '-' + cpfN.slice(9),
        filiado: String(trabalhador.Filiado || '').toUpperCase() === 'S'
      },
      total: itens.length,
      oposicoes: itens
    }
  };
}
