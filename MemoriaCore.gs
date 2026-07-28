// ================================================================
// ARQUIVO: MemoriaCore.gs
// Memória Organizacional do SISGEP — SindEducação-ES
// Aprende com e-mails enviados, ofícios e padrões do sindicato
// ================================================================

var ABA_MEMORIA = "Memoria_Organizacional";

/* ═══════════════════════════════════════════════════════
   INICIALIZAR ABA DE MEMÓRIA
═══════════════════════════════════════════════════════ */
function inicializarMemoriaOrganizacional() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_MEMORIA);

  if (!aba) {
    aba = ss.insertSheet(ABA_MEMORIA);
    var cab = [
      "Categoria", "Subcategoria", "Conteudo",
      "Fonte", "DataCaptura", "Aprovado"
    ];
    aba.appendRow(cab);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, cab.length)
      .setFontWeight("bold")
      .setBackground("#002f6c")
      .setFontColor("#ffffff");
    aba.setColumnWidth(3, 600);
    aba.autoResizeColumns(1, 2);
    aba.autoResizeColumns(4, 6);
    Logger.log("Aba Memoria_Organizacional criada.");
  }

  return { ok: true, mensagem: "Aba de memória pronta." };
}

/* ═══════════════════════════════════════════════════════
   SALVAR MEMÓRIA
═══════════════════════════════════════════════════════ */
function salvarMemoria_(categoria, subcategoria, conteudo, fonte) {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);
    if (!aba) inicializarMemoriaOrganizacional();
    aba = ss.getSheetByName(ABA_MEMORIA);

    var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
    aba.appendRow([categoria, subcategoria, conteudo, fonte, hoje, "SIM"]);
  } catch (e) {
    Logger.log("salvarMemoria_ erro: " + e.message);
  }
}

/* ═══════════════════════════════════════════════════════
   CARREGAR MEMÓRIA (para o Chat)
═══════════════════════════════════════════════════════ */
function carregarMemoriaOrganizacional() {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);
    if (!aba || aba.getLastRow() < 2) return "";

    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues();
    var memoria = {};

    dados.forEach(function(linha) {
      var cat    = String(linha[0] || "").trim();
      var subcat = String(linha[1] || "").trim();
      var cont   = String(linha[2] || "").trim();
      var aprov  = String(linha[5] || "").trim().toUpperCase();

      if (!cat || !cont || aprov !== "SIM") return;

      if (!memoria[cat]) memoria[cat] = {};
      if (!memoria[cat][subcat]) memoria[cat][subcat] = [];
      memoria[cat][subcat].push(cont);
    });

    // Monta texto compacto para o system prompt
    var texto = "━━━ MEMÓRIA ORGANIZACIONAL ━━━\n\n";
    Object.keys(memoria).forEach(function(cat) {
      texto += "【" + cat + "】\n";
      Object.keys(memoria[cat]).forEach(function(sub) {
        if (sub) texto += sub + ":\n";
        memoria[cat][sub].forEach(function(item) {
          texto += "• " + item + "\n";
        });
        texto += "\n";
      });
    });
    texto += "━━━ FIM DA MEMÓRIA ━━━\n\n";

    return texto;
  } catch (e) {
    Logger.log("carregarMemoriaOrganizacional erro: " + e.message);
    return "";
  }
}

/* ═══════════════════════════════════════════════════════
   EXTRAIR ESTILO DE COBRANÇAS DOS E-MAILS ENVIADOS
   Busca por assunto: "cobrança", "atraso", "mensalidade"
   Analisa padrões e salva na Memória Organizacional
═══════════════════════════════════════════════════════ */
function extrairEstiloCobrancas() {
  try {
    inicializarMemoriaOrganizacional();

    var termos = [
      "subject:cobrança",
      "subject:atraso",
      "subject:mensalidade sindical",
      "subject:SindEducação mensalidade",
      "subject:desconto folha"
    ];

    var emailsColetados = [];
    var vistos = {};

    termos.forEach(function(termo) {
      try {
        var threads = GmailApp.search("in:sent " + termo, 0, 10);
        threads.forEach(function(thread) {
          var msgs = thread.getMessages();
          msgs.forEach(function(msg) {
            var id = msg.getId();
            if (vistos[id]) return;
            vistos[id] = true;

            var assunto = msg.getSubject() || "";
            var corpo   = msg.getPlainBody() || "";
            var para    = msg.getTo() || "";
            var data    = msg.getDate();

            if (corpo.length < 50) return;

            emailsColetados.push({
              assunto: assunto,
              corpo:   corpo.substring(0, 2000),
              para:    para,
              data:    data
            });
          });
        });
      } catch (eSearch) {
        Logger.log("extrairEstiloCobrancas busca '" + termo + "': " + eSearch.message);
      }
    });

    if (!emailsColetados.length) {
      return { ok: false, mensagem: "Nenhum e-mail de cobrança encontrado nos enviados." };
    }

    Logger.log("E-mails encontrados: " + emailsColetados.length);

    // ── Analisa com Claude ──
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, mensagem: "ANTHROPIC_API_KEY não configurada." };

    var amostra = emailsColetados.slice(0, 8);
    var textoEmails = amostra.map(function(e, i) {
      return "=== E-MAIL " + (i + 1) + " ===\n" +
             "Assunto: " + e.assunto + "\n" +
             "Para: " + e.para + "\n" +
             "Corpo:\n" + e.corpo + "\n";
    }).join("\n\n");

    var prompt =
      "Analise estes e-mails de cobrança enviados pelo SindEducação-ES e extraia o padrão " +
      "de comunicação. Retorne um JSON com exatamente estas chaves:\n\n" +
      "{\n" +
      "  \"saudacao\": \"como começa os e-mails (ex: Prezados Senhores)\",\n" +
      "  \"tom\": \"descrição do tom geral (ex: formal, profissional, assertivo)\",\n" +
      "  \"estrutura\": [\"passo 1\", \"passo 2\", \"passo 3\"],\n" +
      "  \"argumentos_usados\": [\"argumento 1\", \"argumento 2\"],\n" +
      "  \"clausula_cct_citada\": \"qual cláusula da CCT é citada\",\n" +
      "  \"prazo_dado\": \"prazo típico dado para resposta\",\n" +
      "  \"assinatura\": \"como termina e assina\",\n" +
      "  \"expressoes_recorrentes\": [\"expressão 1\", \"expressão 2\"],\n" +
      "  \"exemplo_abertura\": \"primeiro parágrafo típico\",\n" +
      "  \"exemplo_fechamento\": \"último parágrafo típico\"\n" +
      "}\n\n" +
      "Retorne APENAS o JSON, sem texto adicional, sem markdown.\n\n" +
      "E-MAILS:\n\n" + textoEmails;

    var requestBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    if (response.getResponseCode() !== 200) {
      return { ok: false, mensagem: "Erro na API Claude: " + response.getResponseCode() };
    }

    var respJson = JSON.parse(response.getContentText());
    var textoResp = respJson.content && respJson.content[0] ? respJson.content[0].text : "";

    var padrao;
    try {
      padrao = JSON.parse(textoResp.replace(/```json|```/g, "").trim());
    } catch (e) {
      return { ok: false, mensagem: "Erro ao parsear resposta da IA: " + textoResp.substring(0, 200) };
    }

    // ── Salva na Memória Organizacional ──
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);

    // Remove entradas anteriores de cobrança para não duplicar
    var lastRow = aba.getLastRow();
    if (lastRow >= 2) {
      var dados = aba.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = dados.length - 1; i >= 0; i--) {
        if (String(dados[i][0]).trim() === "ESTILO_COBRANCA") {
          aba.deleteRow(i + 2);
        }
      }
    }

    // Salva novo padrão extraído
    salvarMemoria_("ESTILO_COBRANCA", "Saudação",           padrao.saudacao || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Tom",                padrao.tom || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Estrutura",          (padrao.estrutura || []).join(" → "), "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Argumentos",         (padrao.argumentos_usados || []).join(" | "), "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Cláusula CCT",       padrao.clausula_cct_citada || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Prazo típico",       padrao.prazo_dado || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Assinatura",         padrao.assinatura || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Expressões",         (padrao.expressoes_recorrentes || []).join(" | "), "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Exemplo abertura",   padrao.exemplo_abertura || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Exemplo fechamento", padrao.exemplo_fechamento || "", "Gmail/IA");
    salvarMemoria_("ESTILO_COBRANCA", "Total e-mails analisados", String(emailsColetados.length), "Gmail/IA");

    SpreadsheetApp.flush();

    Logger.log("Estilo de cobrança extraído e salvo com sucesso.");
    return {
      ok: true,
      mensagem: "Padrão extraído de " + emailsColetados.length + " e-mails e salvo na Memória Organizacional.",
      padrao: padrao,
      totalEmails: emailsColetados.length
    };

  } catch (e) {
    Logger.log("extrairEstiloCobrancas erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   ADICIONAR MEMÓRIA MANUAL (via Chat ou interface)
═══════════════════════════════════════════════════════ */
function adicionarMemoriaManual(categoria, subcategoria, conteudo) {
  try {
    inicializarMemoriaOrganizacional();
    salvarMemoria_(
      String(categoria || "GERAL").toUpperCase(),
      String(subcategoria || ""),
      String(conteudo || ""),
      "Manual"
    );
    return { ok: true, mensagem: "Memória salva com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   POPULAR MEMÓRIA COM DADOS CONHECIDOS DO SISGEP
   (estilo dos ofícios, assinatura, padrão institucional)
═══════════════════════════════════════════════════════ */
function popularMemoriaInstitucional() {
  try {
    inicializarMemoriaOrganizacional();

    // Remove entradas institucionais anteriores
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);
    var lastRow = aba.getLastRow();
    if (lastRow >= 2) {
      var dados = aba.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = dados.length - 1; i >= 0; i--) {
        var cat = String(dados[i][0]).trim();
        if (cat === "INSTITUCIONAL" || cat === "ESTILO_OFICIO" || cat === "ASSINATURA") {
          aba.deleteRow(i + 2);
        }
      }
    }

    // Identidade institucional
    salvarMemoria_("INSTITUCIONAL", "Nome completo",     "Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos de Ensino Particular no Estado do Espírito Santo", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Sigla",             "SindEducação-ES", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Presidente",        "Leonil Dias da Silva", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Diretor Financeiro","Rogério José Erler", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Responsável TI",    "Wanderson Nascimento Castelo", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Operadora",         "Marcelha Aline Pinto Gomes", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Email financeiro",  "financeiro@sindeducacao.com", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Email secretaria",  "secretaria@sindeducacao.com", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Telefones",         "(27) 99813-5965 | (27) 3222-2706", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Site",              "www.sindeducacao.com.br", "Sistema");
    salvarMemoria_("INSTITUCIONAL", "Sede",              "Cariacica/ES", "Sistema");

    // Estilo dos ofícios
    salvarMemoria_("ESTILO_OFICIO", "Abertura padrão",   "Prezada [Nome da Escola], Cumprimentando-os cordialmente,", "Sistema");
    salvarMemoria_("ESTILO_OFICIO", "Referência CCT",    "Conforme previsto na Cláusula 56ª da Convenção Coletiva de Trabalho (CCT) vigente", "Sistema");
    salvarMemoria_("ESTILO_OFICIO", "Tom",               "Formal, respeitoso, assertivo. Nunca agressivo. Sempre cita base legal.", "Sistema");
    salvarMemoria_("ESTILO_OFICIO", "Numeração",         "Formato NNN/AAAA (ex: 093/2026)", "Sistema");
    salvarMemoria_("ESTILO_OFICIO", "Cores",             "Navy #002f6c e Gold #C9A84C", "Sistema");
    salvarMemoria_("ESTILO_OFICIO", "Fonte",             "Plus Jakarta Sans", "Sistema");

    // Assinatura padrão
    salvarMemoria_("ASSINATURA", "Signatário",           "Leonil Dias da Silva", "Sistema");
    salvarMemoria_("ASSINATURA", "Cargo",                "Presidente — SindEducação-ES", "Sistema");
    salvarMemoria_("ASSINATURA", "Fechamento padrão",    "Atenciosamente,\n\nLeonil Dias da Silva\nPresidente\nSindEducação-ES", "Sistema");

    // Padrão de cobrança conhecido
    salvarMemoria_("ESTILO_COBRANCA", "Escalonamento",   "1º: Ofício de Filiação → 2º: E-mail de cobrança → 3º: Reiteração → 4º: Notificação formal com multa", "Sistema");
    salvarMemoria_("ESTILO_COBRANCA", "Percentual",      "2% sobre salário-base do associado (Cláusula 56 CCT)", "Sistema");
    salvarMemoria_("ESTILO_COBRANCA", "Prazo repasse",   "Até o 10º dia do mês subsequente", "Sistema");
    salvarMemoria_("ESTILO_COBRANCA", "Multa atraso",    "0,33% ao dia + INPC. Pode configurar apropriação indébita.", "Sistema");

    SpreadsheetApp.flush();

    Logger.log("Memória institucional populada com sucesso.");
    return { ok: true, mensagem: "Memória institucional salva com sucesso." };

  } catch (e) {
    Logger.log("popularMemoriaInstitucional erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   LISTAR MEMÓRIA (para o frontend/Chat)
═══════════════════════════════════════════════════════ */
function listarMemoriaOrganizacional() {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);
    if (!aba || aba.getLastRow() < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues();
    var itens = dados
      .filter(function(l) { return String(l[0] || "").trim(); })
      .map(function(l) {
        return {
          categoria:   String(l[0] || ""),
          subcategoria: String(l[1] || ""),
          conteudo:    String(l[2] || ""),
          fonte:       String(l[3] || ""),
          data:        String(l[4] || ""),
          aprovado:    String(l[5] || "")
        };
      });

    return { ok: true, itens: itens, total: itens.length };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message, itens: [] };
  }
}