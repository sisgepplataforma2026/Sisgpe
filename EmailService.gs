// ================================================================
// ARQUIVO: EmailService.gs
// DESATIVADO em 11/07/2026: essas funções tinham o MESMO NOME das
// funções corrigidas em CentralEmailIA.gs, causando conflito silencioso
// (o Apps Script escolhia uma versão aleatoriamente dependendo da função).
// Foi a causa raiz do bug em que "Adiados" e "Com estrela" mostravam
// e-mails da Entrada misturados. Renomeadas com prefixo OLD_ para
// desativar sem apagar o histórico. Ideia do "Cockpit" não está mais em uso.
// ================================================================

/* ─────────────────────────────────────────────────────────────────
   CONSTANTES — categorias e prioridades
───────────────────────────────────────────────────────────────── */
var ES_CATEGORIAS_RECEBIDAS = [
  "Confirmação de Ofício",
  "Comprovante de Desconto em Folha",
  "Nota Fiscal (NF)",
  "Recibo de Pagamento",
  "Solicitação de Baixa",
  "Resposta de Cobrança",
  "Dúvida do Associado",
  "Atualização Cadastral",
  "Jurídico / Notificação",
  "Convenção Coletiva (CCT)",
  "Outros"
];

var ES_CATEGORIAS_ENVIOS = [
  "Filiação",
  "Desfiliação",
  "Mensalidade Sindical",
  "Taxa Assistencial",
  "Taxa Negocial",
  "Voucher / Certificado"
];

var ES_TODAS_CATEGORIAS = ES_CATEGORIAS_RECEBIDAS.concat(ES_CATEGORIAS_ENVIOS);

var ES_PRIORIDADE_MAP = {
  "Jurídico / Notificação":           "Urgente",
  "Solicitação de Baixa":             "Alta",
  "Resposta de Cobrança":             "Alta",
  "Comprovante de Desconto em Folha": "Alta",
  "Desfiliação":                      "Alta",
  "Mensalidade Sindical":             "Alta",
  "Confirmação de Ofício":            "Normal",
  "Nota Fiscal (NF)":                 "Normal",
  "Recibo de Pagamento":              "Normal",
  "Dúvida do Associado":              "Normal",
  "Filiação":                         "Normal",
  "Taxa Assistencial":                "Normal",
  "Taxa Negocial":                    "Normal",
  "Atualização Cadastral":            "Baixa",
  "Convenção Coletiva (CCT)":         "Baixa",
  "Voucher / Certificado":            "Baixa",
  "Outros":                           "Baixa"
};

var ES_RESPOSTA_BASE = {
  "Confirmação de Ofício":
    "Bom dia!\n\nAgradecemos pela confirmação do recebimento do ofício. Registramos a confirmação em nosso sistema.\n\nFicamos à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,",
  "Comprovante de Desconto em Folha":
    "Bom dia!\n\nAgradecemos pelo envio do comprovante de desconto em folha. Iremos registrar a confirmação no sistema SISGEP.\n\nCaso haja qualquer divergência, entraremos em contato.\n\nAtenciosamente,",
  "Nota Fiscal (NF)":
    "Bom dia!\n\nRecebemos a Nota Fiscal encaminhada. Encaminharemos ao setor financeiro para processamento.\n\nAtenciosamente,",
  "Recibo de Pagamento":
    "Bom dia!\n\nRecebemos o recibo de pagamento. Registraremos a quitação em nosso sistema.\n\nAtenciosamente,",
  "Solicitação de Baixa":
    "Bom dia!\n\nRecebemos a solicitação de baixa. Verificaremos a situação e retornaremos em breve com a confirmação do processamento.\n\nAtenciosamente,",
  "Resposta de Cobrança":
    "Bom dia!\n\nAgradecemos pelo retorno referente à cobrança. Verificaremos a situação em nosso sistema e daremos o devido encaminhamento.\n\nAtenciosamente,",
  "Dúvida do Associado":
    "Bom dia!\n\nAgradecemos pelo contato. Esclarecemos abaixo sua dúvida e ficamos à disposição para demais informações.\n\nAtenciosamente,",
  "Atualização Cadastral":
    "Bom dia!\n\nRecebemos as informações para atualização cadastral. Realizaremos a atualização em nosso sistema e confirmaremos em breve.\n\nAtenciosamente,",
  "Jurídico / Notificação":
    "Bom dia!\n\nRecebemos a notificação encaminhada. O assunto será direcionado ao nosso setor jurídico para análise e providências cabíveis.\n\nAtenciosamente,",
  "Convenção Coletiva (CCT)":
    "Bom dia!\n\nAgradecemos pelo envio. O documento será analisado pela diretoria e, se necessário, entraremos em contato.\n\nAtenciosamente,",
  "Outros":
    "Bom dia!\n\nAgradecemos pelo contato. Analisaremos sua mensagem e retornaremos em breve.\n\nAtenciosamente,"
};

var ES_ASSINATURA = [
  "",
  "Wanderson N Castelo — Financeiro & Cobrança",
  "SindEducação-ES",
  "📱 (27) 99813-5965  |  ✉️ financeiro@sindeducacao.com  |  📞 (27) 3222-2706"
].join("\n");

/* ─────────────────────────────────────────────────────────────────
   1. LISTAR E-MAILS
───────────────────────────────────────────────────────────────── */
function OLD_sisgepListarEmailsIA(caixa) {
  try {
    caixa = caixa || "inbox";
    var query = "";
    var tz = Session.getScriptTimeZone();

    if (caixa === "inbox")     query = "in:inbox newer_than:30d";
    else if (caixa === "sent") query = "in:sent newer_than:30d";
    else if (caixa === "spam") query = "in:spam newer_than:15d";
    else if (caixa === "all")  query = "-in:trash newer_than:30d";

    var threads = GmailApp.search(query, 0, 30);

    return threads.map(function(thread) {
      var msgs   = thread.getMessages();
      var msg    = msgs[msgs.length - 1];
      var corpo  = msg.getPlainBody() || "";
      var dataMsg = msg.getDate();
      var dataStr = dataMsg ? Utilities.formatDate(new Date(dataMsg), tz, "dd/MM/yyyy HH:mm") : "";
      var dataTs  = dataMsg ? new Date(dataMsg).getTime() : 0;
      var remetente = msg.getFrom() || "";

      return {
        threadId:      thread.getId(),
        messageId:     msg.getId(),
        assunto:       msg.getSubject() || "(sem assunto)",
        remetente:     remetente,
        remetenteNome: remetente.replace(/<[^>]+>/g,"").replace(/"/g,"").trim() || remetente,
        destinatario:  msg.getTo() || "",
        dataStr:       dataStr,
        dataTs:        dataTs,
        lido:          !msg.isUnread(),
        caixa:         caixa,
        corpo:         corpo.substring(0, 2500),
        corpoPreview:  corpo.substring(0, 200).replace(/\s+/g, " ").trim()
      };
    });

  } catch (e) {
    Logger.log("[sisgepListarEmailsIA] erro: " + e.message);
    throw new Error("Erro ao listar e-mails: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   2. ANALISAR E-MAIL COM IA
───────────────────────────────────────────────────────────────── */
function OLD_sisgepAnalisarEmailIA(messageId) {
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada: " + messageId);

    var assunto   = msg.getSubject()   || "";
    var remetente = msg.getFrom()      || "";
    var corpo     = msg.getPlainBody() || "";
    var data      = msg.getDate()      || "";

    var textoEmail = [
      "ASSUNTO: "   + assunto,
      "REMETENTE: " + remetente,
      "DATA: "      + data,
      "",
      "CONTEÚDO:",
      corpo.substring(0, 4000)
    ].join("\n");

    // Passo 1: Classificar
    var promptClassificar = [
      "Você é o assistente de triagem do SindEducação-ES.",
      "",
      "Classifique o e-mail abaixo em UMA das categorias:",
      ES_TODAS_CATEGORIAS.join(", "),
      "",
      "Identifique também:",
      "- O nome da escola ou instituição remetente (se houver)",
      "- O número do ofício mencionado (ex: 234/2026) (se houver)",
      "- O nome do associado mencionado (se houver)",
      "- O CPF mencionado (se houver)",
      "",
      "Retorne APENAS JSON válido, sem markdown, sem crases, sem explicação.",
      "",
      "Formato:",
      '{"categoria":"","subcategoria":"","escola_identificada":"","numero_oficio":"","nome_associado":"","cpf_associado":"","tipo_remetente":"Escola|Contabilidade|Associado|Jurídico|Fornecedor|Outro","resumo":""}',
      "",
      "E-MAIL:",
      textoEmail
    ].join("\n");

    var respostaClassif = es_chamarIA_(promptClassificar);
    var classif = {};
    try {
      classif = JSON.parse(es_limparJson_(respostaClassif));
    } catch (e) {
      classif = { categoria: "Outros", resumo: "Não foi possível classificar." };
    }

    var categoria    = classif.categoria             || "Outros";
    var escolaNome   = classif.escola_identificada   || "";
    var numeroOficio = classif.numero_oficio          || "";
    var nomeAssoc    = classif.nome_associado         || "";
    var cpfAssoc     = classif.cpf_associado          || "";
    var prioridade   = ES_PRIORIDADE_MAP[categoria]   || "Normal";

    // Passo 2: Contexto SISGEP
    var contextoSisgep = "";
    try {
      contextoSisgep = es_buscarContextoSisgep_(escolaNome, numeroOficio, cpfAssoc);
    } catch (e) {
      contextoSisgep = "Contexto SISGEP indisponível.";
    }

    // Passo 3: Gerar resposta
    var respostaBase = ES_RESPOSTA_BASE[categoria] || ES_RESPOSTA_BASE["Outros"];

    var promptResponder = [
      "Você é o assistente de comunicação do SindEducação-ES.",
      "Redija uma resposta profissional ao e-mail abaixo.",
      "",
      "CATEGORIA: " + categoria,
      "PRIORIDADE: " + prioridade,
      escolaNome    ? "ESCOLA: " + escolaNome    : "",
      numeroOficio  ? "OFÍCIO: " + numeroOficio  : "",
      nomeAssoc     ? "ASSOCIADO: " + nomeAssoc  : "",
      "",
      contextoSisgep ? "CONTEXTO SISGEP:\n" + contextoSisgep : "",
      "",
      "MODELO BASE:",
      respostaBase,
      "",
      "E-MAIL:",
      textoEmail,
      "",
      "INSTRUÇÕES: Comece com Bom dia/Boa tarde. Mencione escola/ofício/associado se identificados. Encerre com Atenciosamente, — sem assinatura. Sem markdown. Retorne apenas o texto."
    ].filter(Boolean).join("\n");

    var respostaSugerida = es_chamarIA_(promptResponder);

    return {
      categoria:          categoria,
      subcategoria:       classif.subcategoria   || "",
      prioridade:         prioridade,
      tipo_remetente:     classif.tipo_remetente || "Outro",
      resumo:             classif.resumo         || "",
      escola_identificada: escolaNome,
      numero_oficio:      numeroOficio,
      nome_associado:     nomeAssoc,
      cpf_associado:      cpfAssoc,
      contexto_sisgep:    contextoSisgep,
      resposta_sugerida:  String(respostaSugerida || "").trim(),
      acao_recomendada:   es_acaoRecomendada_(categoria)
    };

  } catch (e) {
    Logger.log("[sisgepAnalisarEmailIA] erro: " + e.message);
    throw new Error("Erro ao analisar e-mail: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   3. PRÉ-CATEGORIZAR EM LOTE (cache inteligente)
───────────────────────────────────────────────────────────────── */
function OLD_sisgepPreCategorizarEmailsIA(emails) {
  try {
    if (!Array.isArray(emails) || !emails.length) return {};
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return {};

    var linhas = emails.map(function(e, i) {
      return i + ". ASSUNTO: " + String(e.assunto || "").substring(0, 80)
        + " | REMETENTE: " + String(e.remetente || "").substring(0, 60)
        + " | PREVIEW: " + String(e.corpoPreview || "").substring(0, 120);
    }).join("\n");

    var prompt = "Classifique cada e-mail em uma das categorias: " + ES_TODAS_CATEGORIAS.join(", ")
      + "\n\nRetorne APENAS JSON:\n{\"resultados\": [{\"indice\": 0, \"categoria\": \"...\", \"escola\": \"...\"}]}"
      + "\n\nE-MAILS:\n" + linhas;

    var payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    };

    var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var json = JSON.parse(resp.getContentText());
    if (json.error) return {};

    var texto = json.content[0].text;
    var inicio = texto.indexOf("{"), fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim < 0) return {};

    var parsed = JSON.parse(texto.substring(inicio, fim + 1));
    var mapa = {};

    (parsed.resultados || []).forEach(function(r) {
      var idx = r.indice;
      if (idx >= 0 && idx < emails.length) {
        var cat  = r.categoria || "Outros";
        var prio = ES_PRIORIDADE_MAP[cat] || "Normal";
        mapa[emails[idx].messageId] = {
          categoria:          cat,
          prioridade:         prio,
          escola_identificada: r.escola || "",
          pre_categorizado:   true
        };
      }
    });

    return mapa;

  } catch (e) {
    Logger.log("[sisgepPreCategorizarEmailsIA] erro: " + e.message);
    return {};
  }
}

/* ─────────────────────────────────────────────────────────────────
   4. ENVIAR RESPOSTA
───────────────────────────────────────────────────────────────── */
function OLD_sisgepEnviarRespostaIA(messageId, textoResposta) {
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var textoFinal = String(textoResposta || "").trim() + ES_ASSINATURA;
    msg.reply(textoFinal);
    msg.markRead();

    // Invalida cache do Cockpit
    try { cockpitInvalidarCache(); } catch(e) {}

    return { ok: true, mensagem: "✅ Resposta enviada com sucesso!" };

  } catch (e) {
    Logger.log("[sisgepEnviarRespostaIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────
   5. CRIAR RASCUNHO
───────────────────────────────────────────────────────────────── */
function OLD_sisgepCriarRascunhoRespostaIA(messageId, respostaSugerida) {
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var textoFinal = String(respostaSugerida || "").trim() + ES_ASSINATURA;
    msg.createDraftReply(textoFinal);

    return { ok: true, mensagem: "✅ Rascunho criado no Gmail." };

  } catch (e) {
    Logger.log("[sisgepCriarRascunhoRespostaIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao criar rascunho: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────
   6. ARQUIVAR
───────────────────────────────────────────────────────────────── */
function OLD_sisgepArquivarEmailIA(messageId) {
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    msg.markRead();
    var thread = msg.getThread();
    if (thread) thread.moveToArchive();

    // Invalida cache do Cockpit
    try { cockpitInvalidarCache(); } catch(e) {}

    return { ok: true, mensagem: "E-mail arquivado." };

  } catch (e) {
    Logger.log("[sisgepArquivarEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao arquivar: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────
   7. ENVIAR E-MAIL DIRETO
───────────────────────────────────────────────────────────────── */
function OLD_sisgepEnviarEmailDireto(dados) {
  try {
    var para    = String(dados.para    || "").trim();
    var assunto = String(dados.assunto || "").trim();
    var corpo   = String(dados.corpo   || "").trim();

    if (!para || !corpo) return { ok: false, mensagem: "Destinatário ou corpo vazio." };

    GmailApp.sendEmail(para, assunto, corpo, { name: "SindEducação-ES — Financeiro" });
    return { ok: true, mensagem: "✅ E-mail enviado para " + para };

  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────
   HELPERS INTERNOS
───────────────────────────────────────────────────────────────── */
function es_chamarIA_(prompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
   model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: String(prompt) }]
    }),
    muteHttpExceptions: true
  });

  var json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json.content[0].text;
}

function es_limparJson_(texto) {
  texto = String(texto || "").trim()
    .replace(/^```json/i,"").replace(/^```/i,"").replace(/```$/i,"").trim();
  var i = texto.indexOf("{"), f = texto.lastIndexOf("}");
  if (i >= 0 && f >= 0) return texto.substring(i, f + 1);
  return texto;
}

function es_buscarContextoSisgep_(escolaNome, numeroOficio, cpf) {
  var partes = [];

  if (escolaNome && escolaNome.length >= 3) {
    try {
      var lista = listarEscolas() || [];
      var nomeNorm = escolaNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      var encontrada = lista.find(function(item) {
        var nomeItem = String(item.escola || item.NomeEscola || item.nome || "")
          .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nomeItem.indexOf(nomeNorm) >= 0 || nomeNorm.indexOf(nomeItem) >= 0;
      });
      if (encontrada) {
        partes.push("ESCOLA: " + (encontrada.escola || encontrada.NomeEscola || ""));
        partes.push("CNPJ: "  + (encontrada.cnpj   || "não informado"));
        partes.push("E-MAIL: "+ (encontrada.email   || "não informado"));
      } else {
        partes.push("ESCOLA '" + escolaNome + "' não encontrada na base.");
      }
    } catch(e) {}
  }

  if (numeroOficio) {
    try {
      var hist  = listarHistoricoOficios({ numero: numeroOficio });
      var itens = (hist && hist.itens) ? hist.itens : (Array.isArray(hist) ? hist : []);
      if (itens.length > 0) {
        var of = itens[0];
        partes.push("OFÍCIO " + numeroOficio + " — Tipo: " + (of.tipo||"") + " | Status: " + (of.status||"") + " | Data: " + (of.data||""));
      }
    } catch(e) {}
  }

  if (cpf) {
    try {
      var cpfLimpo = cpf.replace(/\D/g, "");
      if (cpfLimpo.length === 11) {
        var mens = listarMensalidadeStatus({ cpf: cpfLimpo });
        var itensMens = (mens && mens.itens) ? mens.itens : [];
        if (itensMens.length > 0) {
          var m = itensMens[0];
          partes.push("ASSOCIADO: " + (m.nome||"") + " | Status: " + (m.status||"") + " | Escola: " + (m.escola||""));
        }
      }
    } catch(e) {}
  }

  return partes.length > 0 ? partes.join("\n") : "Nenhum contexto encontrado no SISGEP.";
}

function es_acaoRecomendada_(categoria) {
  var acoes = {
    "Confirmação de Ofício":            "Registrar confirmação no SISGEP → módulo Mensalidades.",
    "Comprovante de Desconto em Folha": "Verificar valor e mês → confirmar no módulo Mensalidades → arquivar.",
    "Nota Fiscal (NF)":                 "Encaminhar ao setor financeiro → registrar no módulo Despesas.",
    "Recibo de Pagamento":              "Registrar quitação no sistema → arquivar e-mail.",
    "Solicitação de Baixa":             "Emitir ofício de Desfiliação → atualizar status do associado.",
    "Resposta de Cobrança":             "Verificar status da mensalidade → atualizar para CONFIRMADO ou REGULARIZADO.",
    "Dúvida do Associado":              "Responder com informações corretas → escalar à diretoria se necessário.",
    "Atualização Cadastral":            "Atualizar dados no módulo Escolas → confirmar por e-mail.",
    "Jurídico / Notificação":           "🔴 URGENTE — Encaminhar ao setor jurídico e à diretoria imediatamente.",
    "Convenção Coletiva (CCT)":         "Encaminhar à diretoria para análise.",
    "Outros":                           "Analisar manualmente e encaminhar ao setor responsável."
  };
  return acoes[categoria] || acoes["Outros"];
}