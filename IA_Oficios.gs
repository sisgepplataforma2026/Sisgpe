// ============================================================================
// ARQUIVO: IA_Oficios.gs
// IA aplicada ao módulo de Ofícios do SISGEP
// Depende de:
// - chamarIA_SISGEP(promptUsuario)
// - buscarEscola(query)
// - listarHistoricoOficios(filtros)
// ============================================================================

function analisarEscolaIA(cnpjOuNome) {
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

  var resumoHistorico = itensHistorico.slice(0, 10).map(function(item, i) {
    return [
      (i + 1) + ".",
      "Data: " + (item.data || "-"),
      "Número: " + (item.numero || "-"),
      "Tipo: " + (item.tipo || "-"),
      "Status: " + (item.status || "-")
    ].join(" ");
  }).join("\n");

  if (!resumoHistorico) {
    resumoHistorico = "Nenhum histórico de ofícios localizado.";
  }

  var prompt = [
    "Analise a escola abaixo com base nos dados do SISGEP.",
    "",
    "DADOS DA ESCOLA:",
    "Nome: " + (escola.escola || escola.nome || ""),
    "CNPJ: " + (escola.cnpj || ""),
    "E-mail principal: " + (escola.email || ""),
    "E-mails todos: " + (escola.emailsTodos || ""),
    "Cidade: " + (escola.cidade || ""),
    "UF: " + (escola.uf || ""),
    "Endereço: " + (escola.endereco || ""),
    "",
    "HISTÓRICO DE OFÍCIOS:",
    resumoHistorico,
    "",
    "Responda em formato objetivo:",
    "1. Resumo da situação da escola",
    "2. Pontos de atenção",
    "3. Próxima ação recomendada",
    "4. Tipo de ofício sugerido, se aplicável",
    "",
    "Regras:",
    "- Não invente informações.",
    "- Se não houver histórico, diga claramente.",
    "- Não diga que há débito se isso não estiver nos dados.",
    "- Use linguagem profissional e direta."
  ].join("\n");

  var resposta = chamarIA_SISGEP(prompt);

  return {
    erro: false,
    escola: escola,
    totalHistorico: itensHistorico.length,
    resposta: resposta
  };
}
function analisarEscolaIA_HTML(cnpjOuNome) {
  var r = analisarEscolaIA(cnpjOuNome);

  if (r.erro) {
    return '<div style="color:#991b1b;font-weight:700;">' + r.mensagem + '</div>';
  }

  return String(r.resposta || "")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}