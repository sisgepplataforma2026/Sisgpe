// ================================================================
// 🧠 FinanceiroIA.gs
// SISGEP · Motor de Classificação Financeira IA
// ================================================================

function finClassificarDespesaIA(dados) {
  dados = dados || {};

  var texto = [
    dados.fornecedor,
    dados.descricao,
    dados.categoria,
    dados.tipoDoc,
    dados.observacoes,
    dados.nomeArquivo
  ].join(" ").toLowerCase();

  var resultado = {
    ok: true,
    tipoDespesa: "Outros",
    categoria: "Outros",
    centroCusto: "Administrativo",
    projetoSugerido: "Funcionamento da Sede",
    confianca: 60,
    resumo: "",
    motivo: "",
    acaoSugerida: "Revisar manualmente"
  };

  if (finContem_(texto, ["voucher", "parque do china", "oftalmo", "oftalmologia", "agenda de oftalmo", "beneficio", "beneficios"])) {
    resultado.tipoDespesa = "Compra Avulsa";
    resultado.categoria = "Beneficios";
    resultado.centroCusto = "Beneficios";
    resultado.projetoSugerido = "Beneficios aos associados";
    resultado.confianca = 96;
    resultado.motivo = "Texto indica recibo ou voucher de beneficio.";
  }

  else if (finContem_(texto, ["edp", "energia", "luz", "eletrica", "elétrica"])) {
    resultado.tipoDespesa = "Conta Mensal";
    resultado.categoria = "Energia";
    resultado.centroCusto = "Administrativo";
    resultado.projetoSugerido = "Funcionamento da Sede";
    resultado.confianca = 98;
    resultado.motivo = "Fornecedor ou descrição indica despesa de energia elétrica.";
  }

  else if (finContem_(texto, ["cesan", "água", "agua", "esgoto"])) {
    resultado.tipoDespesa = "Conta Mensal";
    resultado.categoria = "Água";
    resultado.centroCusto = "Administrativo";
    resultado.projetoSugerido = "Funcionamento da Sede";
    resultado.confianca = 98;
    resultado.motivo = "Fornecedor ou descrição indica despesa de água/esgoto.";
  }

  else if (finContem_(texto, ["internet", "telefonia", "telefone", "vivo", "claro", "tim", "oi"])) {
    resultado.tipoDespesa = "Conta Mensal";
    resultado.categoria = "Internet / Telefonia";
    resultado.centroCusto = "Administrativo";
    resultado.projetoSugerido = "Funcionamento da Sede";
    resultado.confianca = 92;
    resultado.motivo = "Texto indica serviço de internet ou telefonia.";
  }

  else if (finContem_(texto, ["pão", "pao", "café", "cafe", "lanche", "padaria", "supermercado"])) {
    resultado.tipoDespesa = "Compra Avulsa";
    resultado.categoria = "Alimentação / Copa";
    resultado.centroCusto = "Administrativo";
    resultado.projetoSugerido = "Funcionamento da Sede";
    resultado.confianca = 88;
    resultado.motivo = "Texto indica compra avulsa de alimentação/copa.";
  }

  else if (finContem_(texto, ["limpeza", "detergente", "desinfetante", "papel toalha", "água sanitária", "agua sanitaria"])) {
    resultado.tipoDespesa = "Compra Avulsa";
    resultado.categoria = "Material de Limpeza";
    resultado.centroCusto = "Administrativo";
    resultado.projetoSugerido = "Funcionamento da Sede";
    resultado.confianca = 90;
    resultado.motivo = "Texto indica material de limpeza.";
  }

  else if (finContem_(texto, ["banda", "show", "palco", "som", "sonorização", "sonorizacao", "fotografia", "festa"])) {
    resultado.tipoDespesa = "Evento";
    resultado.categoria = "Evento / Festa";
    resultado.centroCusto = "Eventos";
    resultado.projetoSugerido = "Festa 2026";
    resultado.confianca = 94;
    resultado.motivo = "Texto indica despesa relacionada a evento/festa.";
  }

  else if (finContem_(texto, ["campanha", "brinde", "divulgação", "divulgacao", "facebook", "meta", "instagram", "impulsionamento"])) {
    resultado.tipoDespesa = "Campanha";
    resultado.categoria = "Comunicação / Divulgação";
    resultado.centroCusto = "Campanhas";
    resultado.projetoSugerido = "Campanha Institucional";
    resultado.confianca = 91;
    resultado.motivo = "Texto indica despesa de campanha, comunicação ou divulgação.";
  }

  else if (finContem_(texto, ["manutenção", "manutencao", "reparo", "conserto", "obra", "reforma"])) {
    resultado.tipoDespesa = "Manutenção";
    resultado.categoria = "Manutenção Predial";
    resultado.centroCusto = "Sede";
    resultado.projetoSugerido = "Manutenção da Sede";
    resultado.confianca = 89;
    resultado.motivo = "Texto indica manutenção, reparo ou reforma.";
  }

  if (resultado.confianca >= 90) {
    resultado.acaoSugerida = "Classificar automaticamente";
  } else if (resultado.confianca >= 70) {
    resultado.acaoSugerida = "Sugerir e pedir confirmação";
  }

  resultado.resumo =
    "Despesa classificada como " + resultado.tipoDespesa +
    ", categoria " + resultado.categoria +
    ", centro de custo " + resultado.centroCusto +
    ". Confiança: " + resultado.confianca + "%.";

  finRegistrarEventoIA_({
    tipoEvento: "CLASSIFICACAO_DESPESA",
    origem: "FinanceiroIA",
    entidade: "DESPESA",
    entidadeId: dados.id || "",
    status: "SUGERIDO",
    mensagem: resultado.resumo,
    sugestaoIA: resultado.motivo
  });

  return resultado;
}

function finContem_(texto, palavras) {
  texto = String(texto || "").toLowerCase();

  return palavras.some(function(p) {
    return texto.indexOf(String(p).toLowerCase()) > -1;
  });
}

function finRegistrarEventoIA_(params) {
  try {
    params = params || {};

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName("FIN_EVENTOS_IA");

    if (!aba) return;

    var id = "EVT-" + new Date().getTime();

    aba.appendRow([
      id,
      new Date(),
      params.tipoEvento || "",
      params.origem || "",
      params.entidade || "",
      params.entidadeId || "",
      params.status || "",
      params.mensagem || "",
      params.sugestaoIA || "",
      new Date()
    ]);

  } catch (e) {
    Logger.log("Erro ao registrar evento IA: " + e.message);
  }
}
// ================================================================
// 🧠 FinanceiroIA.gs — PATCH: adicionar funções Claude
// SISGEP · Motor de Classificação Financeira IA
//
// INSTRUÇÃO: Cole ESTE BLOCO no final do FinanceiroIA.gs existente,
// ANTES da última chave de fechamento (se houver) ou simplesmente
// ao final do arquivo.
// ================================================================

/* ─────────────────────────────────────────────────────────────────
   finClassificarHibridoIA(dados)
   Motor híbrido: tenta palavras-chave primeiro (rápido, sem custo),
   e só chama Claude se a confiança for baixa (< 75%).
   Parâmetro: dados = { fornecedor, descricao, categoria, tipoDoc, observacoes, valor }
   Retorna: resultado enriquecido com campo usouClaude:true/false
─────────────────────────────────────────────────────────────────── */
function finClassificarHibridoIA(dados) {
  dados = dados || {};

  // 1. Tenta classificação por palavras-chave
  var resultado = finClassificarDespesaIA(dados);

  // 2. Se confiança >= 75, retorna diretamente
  if (resultado.ok && resultado.confianca >= 75) {
    resultado.usouClaude = false;
    return resultado;
  }

  // 3. Confiança baixa: chama Claude para enriquecer
  try {
    var claude = finAnalisarComClaude(dados);
    if (claude && claude.ok) {
      // Mescla: Claude prevalece em campos de classificação
      resultado.tipoDespesa    = claude.tipoDespesa    || resultado.tipoDespesa;
      resultado.categoria      = claude.categoria      || resultado.categoria;
      resultado.centroCusto    = claude.centroCusto    || resultado.centroCusto;
      resultado.projetoSugerido= claude.projetoSugerido|| resultado.projetoSugerido;
      resultado.confianca      = claude.confianca      || resultado.confianca;
      resultado.resumo         = claude.resumo         || resultado.resumo;
      resultado.motivo         = claude.motivo         || resultado.motivo;
      resultado.acaoSugerida   = claude.acaoSugerida   || resultado.acaoSugerida;
      resultado.alertas        = claude.alertas        || [];
      resultado.usouClaude     = true;
    } else {
      resultado.usouClaude = false;
    }
  } catch (e) {
    Logger.log("[finClassificarHibridoIA] erro Claude: " + e.message);
    resultado.usouClaude = false;
  }

  return resultado;
}


/* ─────────────────────────────────────────────────────────────────
   finAnalisarComClaude(dados)
   Chama a API Claude para classificação inteligente de despesas.
   Parâmetro: dados = { fornecedor, descricao, categoria, tipoDoc, observacoes, valor }
   Retorna: { ok, tipoDespesa, categoria, centroCusto, projetoSugerido,
               confianca, resumo, motivo, acaoSugerida, alertas }
─────────────────────────────────────────────────────────────────── */
function finAnalisarComClaude(dados) {
  try {
    dados = dados || {};

    var fornecedor  = String(dados.fornecedor   || "").trim();
    var descricao   = String(dados.descricao    || "").trim();
    var categoria   = String(dados.categoria    || "").trim();
    var tipoDoc     = String(dados.tipoDoc      || "").trim();
    var observacoes = String(dados.observacoes  || "").trim();
    var valor       = String(dados.valor        || "").trim();

    if (!fornecedor && !descricao) {
      return { ok: false, mensagem: "Informe ao menos o fornecedor ou a descrição." };
    }

    var categorias = [
      "Energia", "Água", "Internet / Telefonia", "Aluguel", "Alimentação / Copa",
      "Material de Limpeza", "Material de Escritório", "Evento / Festa",
      "Comunicação / Divulgação", "Manutenção Predial", "Serviço Contábil",
      "Serviço Jurídico", "Serviço de TI", "Transporte / Frete",
      "Impostos / Taxas / Alvará", "Salários / Encargos", "Beneficios", "Outros"
    ];

    var centros = [
      "Administrativo", "Sede", "Eventos", "Campanhas",
      "Jurídico", "TI", "Financeiro", "Presidência"
    ];

    var prompt = [
      "Você é o assistente financeiro do SindEducação-ES (sindicato de trabalhadores em educação do Espírito Santo).",
      "Analise os dados da despesa abaixo e classifique-a de forma objetiva.",
      "",
      "DADOS DA DESPESA:",
      fornecedor  ? "Fornecedor: "  + fornecedor  : "",
      descricao   ? "Descrição: "   + descricao   : "",
      categoria   ? "Categoria informada: " + categoria : "",
      tipoDoc     ? "Tipo de documento: "  + tipoDoc   : "",
      valor       ? "Valor: "       + valor       : "",
      observacoes ? "Observações: " + observacoes : "",
      "",
      "Retorne APENAS um JSON válido com EXATAMENTE estas chaves (sem markdown, sem explicação extra):",
      "{",
      '  "tipoDespesa": "Conta Mensal" | "Compra Avulsa" | "Evento" | "Campanha" | "Manutencao" | "Servico" | "Imposto" | "Beneficios" | "Outros",',
      '  "categoria": uma das opções: ' + categorias.join(", "),
      '  "centroCusto": uma das opções: ' + centros.join(", "),
      '  "projetoSugerido": string curta (ex: "Funcionamento da Sede", "Festa 2026", "Campanha Institucional")',
      '  "confianca": número inteiro entre 60 e 99 (sua confiança na classificação)',
      '  "resumo": string de 1 linha descrevendo a despesa de forma contábil',
      '  "motivo": string curta explicando a classificação',
      '  "acaoSugerida": "Classificar automaticamente" | "Sugerir e pedir confirmação" | "Revisar manualmente"',
      '  "alertas": array de strings com alertas (ex: ["Valor não informado", "Fornecedor sem CNPJ"]) ou []',
      "}"
    ].filter(Boolean).join("\n");

    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return { ok: false, mensagem: "ANTHROPIC_API_KEY não configurada." };
    }

    var payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }]
    };

    var options = {
      method:  "post",
      contentType: "application/json",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload:       JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var body = JSON.parse(resp.getContentText());

    if (!body || !body.content || !body.content[0]) {
      return { ok: false, mensagem: "Resposta inválida da API." };
    }

    var texto = String(body.content[0].text || "").trim();
    // Remove markdown se presente
    texto = texto.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

    var parsed = JSON.parse(texto);

    finRegistrarEventoIA_({
      tipoEvento: "CLASSIFICACAO_CLAUDE",
      origem:     "FinanceiroIA",
      entidade:   "DESPESA",
      entidadeId: dados.id || "",
      status:     "SUGERIDO",
      mensagem:   parsed.resumo     || "",
      sugestaoIA: parsed.motivo     || ""
    });

    return {
      ok:             true,
      tipoDespesa:    parsed.tipoDespesa     || "Outros",
      categoria:      parsed.categoria       || "Outros",
      centroCusto:    parsed.centroCusto     || "Administrativo",
      projetoSugerido:parsed.projetoSugerido || "Funcionamento da Sede",
      confianca:      Number(parsed.confianca) || 70,
      resumo:         parsed.resumo          || "",
      motivo:         parsed.motivo          || "",
      acaoSugerida:   parsed.acaoSugerida    || "Revisar manualmente",
      alertas:        parsed.alertas         || []
    };

  } catch (e) {
    Logger.log("[finAnalisarComClaude] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao consultar IA: " + e.message };
  }
}


/* ─────────────────────────────────────────────────────────────────
   finGerarInsightsFinanceirosIA()
   Gera análise executiva das despesas do mês com Claude.
   Chamada pelo botão "🤖 Analisar com IA" no módulo Financeiro.
   Retorna: { ok, analise: "texto formatado" }
─────────────────────────────────────────────────────────────────── */
function finGerarInsightsFinanceirosIA(tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    // Obtém resumo do período atual
    var resumoResp = obterResumoDespesas_interno_();
    if (!resumoResp.ok) {
      return { ok: false, mensagem: "Erro ao obter resumo: " + resumoResp.mensagem };
    }

    var resumo = resumoResp.resumo || {};

    // Lista despesas urgentes/vencidas
    var listaResp = listarDespesas_interno_({ ocultarPagos: true, ocultarCancelados: true });
    var lista     = (listaResp.lista || []).slice(0, 30); // máx 30 para não explodir o contexto

    var linhasDespesas = lista.map(function(d) {
      return "- " + d.prestadorNome + " | " + d.valor + " | venc " + d.dataVencimentoBR + " | status: " + d.status + " | sv: " + d.statusVencimento;
    }).join("\n");

    var prompt = [
      "Você é o consultor financeiro interno do SindEducação-ES.",
      "Analise a situação financeira atual do sindicato e produza um relatório executivo.",
      "",
      "RESUMO DO PERÍODO:",
      "Total de despesas: " + resumo.total,
      "Pendentes: "        + resumo.totalPendentes,
      "Aguardando doc: "   + resumo.totalAguardandoDoc,
      "Doc recebido: "     + resumo.totalDocRecebido,
      "Enviadas contab: "  + resumo.totalEnviadosContab,
      "Pagas: "            + resumo.totalPagos,
      "Vencidas: "         + resumo.totalVencidas,
      "Urgentes (≤5d): "   + resumo.totalUrgentes,
      "Valor total: "      + resumo.valorTotalFmt,
      "Valor pago: "       + resumo.valorPagoFmt,
      "Valor pendente: "   + resumo.valorPendenteFmt,
      "",
      "DESPESAS ABERTAS (até 30):",
      linhasDespesas || "Nenhuma despesa aberta.",
      "",
      "Produza um relatório com as seguintes seções:",
      "1. SITUAÇÃO ATUAL — resumo executivo da saúde financeira",
      "2. ALERTAS CRÍTICOS — o que requer ação imediata (vencidas, urgentes)",
      "3. AÇÕES RECOMENDADAS — máximo 4 ações concretas e priorizadas",
      "4. OBSERVAÇÕES — tendências ou padrões relevantes",
      "",
      "Regras:",
      "- Responda em português do Brasil",
      "- Use linguagem direta, administrativa e objetiva",
      "- Não use markdown, asteriscos ou #",
      "- Separe seções pelo título em maiúsculas e linha em branco",
      "- Não invente dados que não estejam no resumo fornecido"
    ].join("\n");

    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, mensagem: "ANTHROPIC_API_KEY não configurada." };

    var payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    };

    var options = {
      method:      "post",
      contentType: "application/json",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var body = JSON.parse(resp.getContentText());

    if (!body || !body.content || !body.content[0]) {
      return { ok: false, mensagem: "Resposta inválida da API." };
    }

    var analise = String(body.content[0].text || "").trim();

    return { ok: true, analise: analise };

  } catch (e) {
    Logger.log("[finGerarInsightsFinanceirosIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao gerar análise: " + e.message };
  }
}
