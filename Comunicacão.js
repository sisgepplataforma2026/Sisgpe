function listarEscolasParaComunicacao() {
  try {
    var escolas = listarEscolas() || [];

    return escolas.map(function(e, i) {
      return {
        escola: e.escola || e.NomeEscola || e.nomeEscola || "",
        fantasia: e.fantasia || e.Fantasia || "",
        cnpj: e.cnpj || e.CNPJ || "",
        email: e.email || e.Email || e.emailsTodos || e.EmailsTodos || "",
        cidade: e.cidade || e.Municipio || e.municipio || "",
        uf: e.uf || e.UF || "",
        situacao: e.situacao || e.Situacao || "ATIVA",
        __idx: i
      };
    }).filter(function(e) {
      return String(e.escola || "").trim();
    });

  } catch (e) {
    Logger.log("listarEscolasParaComunicacao erro: " + e.message);
    return [];
  }
}