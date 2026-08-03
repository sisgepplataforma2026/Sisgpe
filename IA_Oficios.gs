// ============================================================================
// ARQUIVO: IA_Oficios.gs
// IA aplicada ao módulo de Ofícios do SISGEP
// Depende de:
// - chamarIA_SISGEP(promptUsuario)
// - buscarEscola(query)
// - listarHistoricoOficios(filtros)
// ============================================================================

function analisarEscolaIA_Oficios_(cnpjOuNome, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  cnpjOuNome = String(cnpjOuNome || "").trim();

  if (!cnpjOuNome) {
    return {
      erro: true,
      mensagem: "Informe o nome ou CNPJ da escola."
    };
  }

  var escolas = buscarEscola(cnpjOuNome);

  if (!escolas || !escolas.length) {
    return {
      erro: true,
      mensagem: "Nenhuma escola encontrada para: " + cnpjOuNome
    };
  }

  var escola = escolas[0];

  var historico = listarHistoricoOficios({
    escola: escola.escola || escola.nome || "",
    cnpj: escola.cnpj || ""
  });

  var itensHistorico = historico && historico.itens ? historico.itens : [];

  // ESC-H: reaproveita analisarEscolaIA (IACore.gs) — mesma análise por IA
  // que o botão "Analisar Escola" de CadastroEscolas.html já usa — em vez
  // de manter um segundo prompt e um segundo caminho de LLM
  // (chamarIA_SISGEP) fazendo essencialmente a mesma coisa. Já registra a
  // própria auditoria em Sofia_Auditoria.
  var analise = analisarEscolaIA(escola.cnpj || cnpjOuNome, tokenSessao);

  return {
    erro: false,
    escola: escola,
    totalHistorico: itensHistorico.length,
    resposta: analise.resposta
  };
}
function analisarEscolaIA_HTML(cnpjOuNome, tokenSessao) {
  var r = analisarEscolaIA_Oficios_(cnpjOuNome, tokenSessao);

  if (r.erro) {
    return '<div style="color:#991b1b;font-weight:700;">' + r.mensagem + '</div>';
  }

  return String(r.resposta || "")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}