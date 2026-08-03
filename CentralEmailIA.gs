// ================================================================
// ARQUIVO: CentralEmailIA.gs
// Central de E-mails com IA — SISGEP / SindEducação-ES
//
// Fluxo:
//   1. sisgepListarEmailsIA()           → lista inbox (30d)
//   2. sisgepAnalisarEmailIA(messageId) → categoriza + contexto SISGEP + resposta
//   3. sisgepCriarRascunhoRespostaIA()  → cria rascunho no Gmail
//   4. sisgepArquivarEmailIA()          → marca lido + arquiva
// ================================================================

/* ─────────────────────────────────────────────────────────────────
   CATEGORIAS
   Separadas em dois grupos:
   - RECEBIDAS: e-mails que chegam das escolas/associados
   - ENVIOS SISGEP: confirmações de retorno a ofícios emitidos
───────────────────────────────────────────────────────────────── */
var EMAIL_IA_CATEGORIAS_RECEBIDAS = [
  "Marketing / Convite externo",
  "Comercial não relacionado",
  "Irrelevante / Spam operacional",
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

var EMAIL_IA_CATEGORIAS_ENVIOS = [
  "Filiação",
  "Desfiliação",
  "Mensalidade Sindical",
  "Taxa Assistencial",
  "Taxa Negocial",
  "Voucher / Certificado"
];

var EMAIL_IA_TODAS_CATEGORIAS = EMAIL_IA_CATEGORIAS_RECEBIDAS.concat(EMAIL_IA_CATEGORIAS_ENVIOS);

/* ─────────────────────────────────────────────────────────────────
   PRIORIDADE POR CATEGORIA
───────────────────────────────────────────────────────────────── */
var EMAIL_IA_PRIORIDADE_MAP = {
  "Jurídico / Notificação":        "Urgente",
  "Solicitação de Baixa":          "Alta",
  "Resposta de Cobrança":          "Alta",
  "Comprovante de Desconto em Folha": "Alta",
  "Confirmação de Ofício":         "Normal",
  "Nota Fiscal (NF)":              "Normal",
  "Recibo de Pagamento":           "Normal",
  "Dúvida do Associado":           "Normal",
  "Atualização Cadastral":         "Baixa",
  "Convenção Coletiva (CCT)":      "Baixa",
  "Filiação":                      "Normal",
  "Desfiliação":                   "Alta",
  "Mensalidade Sindical":          "Alta",
  "Taxa Assistencial":             "Normal",
  "Taxa Negocial":                 "Normal",
  "Voucher / Certificado":         "Baixa",
  "Outros":                        "Baixa"
  ,
  "Marketing / Convite externo":    "Baixa",
  "Comercial não relacionado":      "Baixa",
  "Irrelevante / Spam operacional": "Baixa"
};

/* ─────────────────────────────────────────────────────────────────
   RESPOSTAS-PADRÃO POR CATEGORIA
   Usadas como base para a IA personalizar
───────────────────────────────────────────────────────────────── */
var EMAIL_IA_RESPOSTA_BASE = {
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
  ,
  "Marketing / Convite externo":
    "Olá!\n\nAgradecemos pelo contato e pelo convite. No momento, a mensagem será registrada para avaliação interna, sem ação administrativa imediata.\n\nAtenciosamente,",
  "Comercial não relacionado":
    "Olá!\n\nAgradecemos pelo contato. No momento, a proposta não está relacionada às rotinas administrativas ou sindicais acompanhadas por este canal.\n\nAtenciosamente,",
  "Irrelevante / Spam operacional":
    "Olá!\n\nAgradecemos pelo contato. Esta mensagem não demanda providência administrativa do SindEducação-ES neste momento.\n\nAtenciosamente,"
};
/* ─────────────────────────────────────────────────────────────────
   ASSINATURAS POR USUÁRIO
   Mapeia o e-mail de login (Session.getActiveUser().getEmail()) para
   os dados de assinatura de cada pessoa que usa a Central IA. Quando
   alguém novo começar a usar (ex: Rogério), basta adicionar uma nova
   entrada aqui — nenhuma outra função precisa mudar.
───────────────────────────────────────────────────────────────── */
var EMAIL_IA_ASSINATURAS_USUARIOS = {
  "financeiro@sindeducacao.com": {
    nome: "Wanderson N Castelo",
    cargo: "Financeiro & Cobrança",
    telefone: "(27) 99813-5965",
    email: "financeiro@sindeducacao.com"
  },
  "secretaria@sindeducacao.com": {
    nome: "Marcelha Aline",
    cargo: "Administrativo / Secretaria",
    telefone: "(27) 99735-8900",
    email: "secretaria@sindeducacao.com"
  }
};

// Usado quando o e-mail logado não está no mapa acima
var EMAIL_IA_ASSINATURA_PADRAO = EMAIL_IA_ASSINATURAS_USUARIOS["financeiro@sindeducacao.com"];
function sisgepListarEmailsIA_CentralLegacy(parametros, opcoes) {
  if (!eiaAcessoAutorizado_()) {
    throw new Error("Acesso não autorizado à Central de E-mails. E-mail: " + eiaEmailUsuarioAtivo_());
  }
  try {
    var cfg = {};
    if (typeof parametros === "object" && parametros !== null) {
      cfg = parametros;
    } else {
      cfg = opcoes || {};
      cfg.caixa = parametros || cfg.caixa || "inbox";
    }

    var caixa = String(cfg.caixa || "inbox").toLowerCase();
    if (caixa === "meusadiados") return sisgepListarAdiadosEmailIA_CentralLegacy();
    var pagina = Math.max(1, parseInt(cfg.pagina || 1, 10));
    var porPagina = Math.max(1, Math.min(250, parseInt(cfg.porPagina || 25, 10)));
    var inicio = (pagina - 1) * porPagina;
    var busca = String(cfg.busca || "").trim();
    var status = String(cfg.status || "").trim();
    var ordenacao = String(cfg.ordenacao || "recentes").trim();
    var tz = Session.getScriptTimeZone();

    var partes = [];
    if (caixa === "inbox" || caixa === "entrada") partes.push("in:inbox");
    else if (caixa === "sent" || caixa === "enviados") partes.push("in:sent");
    else if (caixa === "spam") partes.push("in:spam");
    else if (caixa === "trash" || caixa === "lixeira") partes.push("in:trash");
    else if (caixa === "drafts" || caixa === "rascunhos") partes.push("in:drafts");
    else if (caixa === "starred" || caixa === "favoritos") partes.push("is:starred");
    else if (caixa === "unread" || caixa === "nao_lidos") partes.push("is:unread");
    else if (caixa === "attachments" || caixa === "anexos") partes.push("has:attachment");
    else if (caixa === "archived" || caixa === "arquivados") partes.push("-in:inbox -in:sent -in:drafts -in:trash -in:spam");
    else if (caixa === "snoozed" || caixa === "adiados") partes.push("in:snoozed");
    else partes.push("-in:trash");

    if (status === "nao_lido") partes.push("is:unread");
    if (status === "lido") partes.push("is:read");
    if (busca) partes.push('("' + busca.replace(/"/g, "") + '")');

    var query = partes.join(" ").replace(/\s+/g, " ").trim();
    var total = contarThreadsGmail_(query, 5000);
    var threads = GmailApp.search(query, inicio, porPagina);
    var emails = threads.map(function(thread) {
      var msgs = thread.getMessages();
      var msg = msgs[msgs.length - 1];
      var corpo = msg.getPlainBody() || "";
      var dataMsg = msg.getDate();
      var dataStr = dataMsg ? Utilities.formatDate(new Date(dataMsg), tz, "dd/MM/yyyy HH:mm") : "";
      var dataTs = dataMsg ? new Date(dataMsg).getTime() : 0;
      var remetenteRaw = msg.getFrom() || "";
      var destinatario = msg.getTo() || "";
      var remetenteNome = remetenteRaw.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || remetenteRaw;
      var anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [];

      return {
        threadId: thread.getId(),
        messageId: msg.getId(),
        assunto: msg.getSubject() || "(sem assunto)",
        remetente: remetenteRaw,
        remetenteNome: remetenteNome,
        destinatario: destinatario,
        dataStr: dataStr,
        dataTs: dataTs,
        lido: !msg.isUnread(),
        estrelado: msg.isStarred(),
        caixa: caixa,
        temAnexo: anexos.length > 0,
        qtdAnexos: anexos.length,
        corpo: corpo.substring(0, 2500),
        corpoPreview: corpo.substring(0, 220).replace(/\s+/g, " ").trim()
      };
    });

    if (ordenacao === "antigos") emails.sort(function(a, b) { return (a.dataTs || 0) - (b.dataTs || 0); });
    if (ordenacao === "remetente") emails.sort(function(a, b) { return String(a.remetenteNome || a.remetente).localeCompare(String(b.remetenteNome || b.remetente)); });
    if (ordenacao === "assunto") emails.sort(function(a, b) { return String(a.assunto).localeCompare(String(b.assunto)); });

    return {
      ok: true,
      emails: emails,
      pagina: pagina,
      porPagina: porPagina,
      total: total,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
      query: query
    };

  } catch (e) {
    Logger.log("[sisgepListarEmailsIA] erro: " + e.message);
    throw new Error("Erro ao listar e-mails: " + e.message);
  }
}

/**
 * Conta quantos threads uma query do Gmail retorna, com cache de 3
 * minutos via CacheService. Sem isso, toda tecla digitada na busca,
 * todo clique de filtro e toda paginação disparava até 10 chamadas
 * GmailApp.search() SÓ para contar — antes mesmo da busca real
 * acontecer. Como o total de e-mails muda pouco em poucos minutos,
 * cachear é seguro e reduz bastante o consumo de cota do Gmail.
 *
 * A chave do cache inclui a query inteira, então filtros diferentes
 * (busca, categoria, prioridade, caixa) têm contagens cacheadas
 * separadamente — não há risco de misturar resultados de buscas
 * diferentes.
 */
function contarThreadsGmail_(query, limite) {
  limite = limite || 5000;

  var cache = CacheService.getScriptCache();
  var chaveCache = "eia_contagem_" + Utilities.base64Encode(query).substring(0, 200);

  var cacheado = cache.get(chaveCache);
  if (cacheado !== null) {
    return Number(cacheado);
  }

  var total = 0;
  var lote = 500;
  for (var inicio = 0; inicio < limite; inicio += lote) {
    var threads = GmailApp.search(query, inicio, lote);
    total += threads.length;
    if (threads.length < lote) break;
  }

  try {
    cache.put(chaveCache, String(total), 180); // 3 minutos
  } catch (e) {
    Logger.log("[contarThreadsGmail_] erro ao gravar cache: " + e.message);
  }

  return total;
}

function sisgepListarEmailsIA(parametros, opcoes) {
  if (!eiaAcessoAutorizado_()) {
    throw new Error("Acesso não autorizado à Central de E-mails. E-mail: " + eiaEmailUsuarioAtivo_());
  }
  return sisgepListarEmailsIA_CentralLegacy(parametros, opcoes);
}
function sisgepObterEmailIA(messageId) {
  try {
    if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
    if (!messageId) throw new Error("ID da mensagem não informado.");
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");
    var anexos = msg.getAttachments({ includeInlineImages: true, includeAttachments: true }) || [];
    return {
      ok: true,
      messageId: msg.getId(),
      assunto: msg.getSubject() || "(sem assunto)",
      remetente: msg.getFrom() || "",
      destinatario: msg.getTo() || "",
      data: msg.getDate(),
      corpo: msg.getPlainBody() || "",
      html: msg.getBody() || "",
      anexos: anexos.map(function(blob, idx) {
        var tipo = blob.getContentType() || "";
        return {
          indice: idx,
          nome: blob.getName() || ("anexo-" + (idx + 1)),
          tipo: tipo,
          imagem: /^image\//i.test(tipo),
          pdf: /pdf/i.test(tipo)
        };
      })
    };
  } catch (e) {
    Logger.log("[sisgepObterEmailIA] erro: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function sisgepObterAnexoEmailIA(messageId, indice) {
  try {
    if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
    if (!messageId) throw new Error("ID da mensagem não informado.");
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");
    var anexos = msg.getAttachments({ includeInlineImages: true, includeAttachments: true }) || [];
    var idx = Number(indice || 0);
    var blob = anexos[idx];
    if (!blob) throw new Error("Anexo não encontrado.");
    var tipo = blob.getContentType() || "application/octet-stream";
    var base64 = Utilities.base64Encode(blob.getBytes());
    return {
      ok: true,
      indice: idx,
      nome: blob.getName() || ("anexo-" + (idx + 1)),
      tipo: tipo,
      imagem: /^image\//i.test(tipo),
      pdf: /pdf/i.test(tipo),
      dataUrl: "data:" + tipo + ";base64," + base64
    };
  } catch (e) {
    Logger.log("[sisgepObterAnexoEmailIA] erro: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}
/* ─────────────────────────────────────────────────────────────────
   2. ANALISAR E-MAIL COM IA
   - Categoriza
   - Busca contexto da escola no SISGEP
   - Gera resposta personalizada
───────────────────────────────────────────────────────────────── */
function sisgepAnalisarEmailIA_CentralLegacy(messageId) {
  if (!eiaAcessoAutorizado_()) {
    throw new Error("Acesso não autorizado à Central de E-mails. E-mail: " + eiaEmailUsuarioAtivo_());
  }
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada: " + messageId);

    var assunto   = msg.getSubject()    || "";
    var remetente = msg.getFrom()       || "";
    var corpo     = msg.getPlainBody()  || "";
    var data      = msg.getDate()       || "";

    var textoEmail = [
      "ASSUNTO: "   + assunto,
      "REMETENTE: " + remetente,
      "DATA: "      + data,
      "",
      "CONTEÚDO:",
      corpo.substring(0, 4000)
    ].join("\n");

    // ── Passo 1: Classificar ────────────────────────────────────
var blocoMemoria = eiaMontarBlocoMemoriaSofia_("", remetente);

    var promptClassificar = [
      "Você é o assistente de triagem do SindEducação-ES.",
      "",
      blocoMemoria,
      "Classifique o e-mail abaixo em UMA das categorias:",
      EMAIL_IA_TODAS_CATEGORIAS.join(", "),
      "",
      "Regras importantes:",
      "- Convites para podcast, webinar, cursos, eventos comerciais, marketing, newsletter, vendas ou propostas B2B sem relação com escola, associado, ofício, mensalidade ou processo sindical devem ser classificados como Marketing / Convite externo ou Comercial não relacionado.",
      "- Spam, promoção genérica ou mensagem sem ação administrativa deve ser Irrelevante / Spam operacional.",
      "- Use Outros apenas quando o e-mail tiver conteúdo real, mas não se encaixar nas demais categorias.",
      "",
      "Identifique também:",
      "- O nome da escola ou instituição remetente (se houver)",
      "- O número do ofício mencionado (ex: 234/2026) (se houver)",
      "- O nome do associado mencionado (se houver)",
      "- O CPF mencionado (se houver)",
      "",
      "Retorne APENAS JSON válido, sem markdown, sem crases, sem explicação.",
      "",
      "Formato obrigatório:",
      "{",
      '  "categoria": "",',
      '  "subcategoria": "",',
      '  "escola_identificada": "",',
      '  "numero_oficio": "",',
      '  "nome_associado": "",',
      '  "cpf_associado": "",',
      '  "tipo_remetente": "Escola|Contabilidade|Associado|Jurídico|Fornecedor|Outro",',
      '  "resumo": ""',
      "}",
      "",
      "E-MAIL:",
      textoEmail
    ].join("\n");

    var respostaClassif = chamarClaude_SISGEP(promptClassificar);
    var classif = {};
    try {
      classif = JSON.parse(limparJsonIA_(respostaClassif));
    } catch (eParse) {
      classif = { categoria: "Outros", resumo: "Não foi possível classificar automaticamente." };
    }

    classif = normalizarClassificacaoEmailIA_(classif, assunto, remetente, corpo);

    var categoria       = classif.categoria        || "Outros";
    var escolaNome      = classif.escola_identificada || "";
    var numeroOficio    = classif.numero_oficio     || "";
    var nomeAssociado   = classif.nome_associado    || "";
    var cpfAssociado    = classif.cpf_associado     || "";
    var prioridade      = EMAIL_IA_PRIORIDADE_MAP[categoria] || "Normal";

    // ── Passo 2: Buscar contexto SISGEP ─────────────────────────
    var contextoSisgep = "";
    try {
      contextoSisgep = buscarContextoEscolaSisgep_(escolaNome, numeroOficio, cpfAssociado);
    } catch (eCtx) {
      Logger.log("[sisgepAnalisarEmailIA] contexto SISGEP: " + eCtx.message);
      contextoSisgep = "Não foi possível buscar contexto no SISGEP.";
    }

    // ── Passo 3: Gerar resposta personalizada ───────────────────
    var respostaBase = EMAIL_IA_RESPOSTA_BASE[categoria] || EMAIL_IA_RESPOSTA_BASE["Outros"];

    var saudacaoAtual = eiaSaudacaoPorHorario_();

    var promptResponder = [
      "Você é o assistente de comunicação do SindEducação-ES.",
      "Redija uma resposta profissional ao e-mail abaixo.",
      "",
      "CATEGORIA IDENTIFICADA: " + categoria,
      "PRIORIDADE: " + prioridade,
      escolaNome    ? "ESCOLA: "           + escolaNome    : "",
      numeroOficio  ? "OFÍCIO: "           + numeroOficio  : "",
      nomeAssociado ? "ASSOCIADO: "        + nomeAssociado : "",
      cpfAssociado  ? "CPF: "              + cpfAssociado  : "",
      "",
      contextoSisgep ? "CONTEXTO DO SISGEP:\n" + contextoSisgep : "",
      "",
      "MODELO BASE DE RESPOSTA (adapte e personalize):",
      respostaBase,
      "",
      "E-MAIL RECEBIDO:",
      textoEmail,
      "",
      "INSTRUÇÕES:",
      "- Comece EXATAMENTE com '" + saudacaoAtual + "' (é o horário atual em Vitória/ES — use esta saudação exata, não escolha outra).",
      "- Se houver escola identificada, mencione-a pelo nome.",
      "- Se houver número de ofício, mencione-o.",
      "- Se houver associado, mencione-o pelo nome.",
      "- Use os dados do contexto SISGEP para personalizar (ex: confirmar registro, mencionar status).",
      "- Seja direto, cordial e institucional.",
      "- Encerre com 'Atenciosamente,' (sem assinatura — será adicionada pelo sistema).",
      "- Não use markdown, asteriscos ou negrito.",
      "- Não invente dados que não estejam no e-mail ou no contexto SISGEP.",
      "- Retorne apenas o texto da resposta, sem explicações.",
    ].filter(Boolean).join("\n");

    var respostaSugerida = chamarClaude_SISGEP(promptResponder);

    return {
      // Classificação
      categoria:          categoria,
      subcategoria:       classif.subcategoria    || "",
      prioridade:         prioridade,
      tipo_remetente:     classif.tipo_remetente  || "Outro",
      resumo:             classif.resumo          || "",

      // Entidades identificadas
      escola_identificada: escolaNome,
      numero_oficio:       numeroOficio,
      nome_associado:      nomeAssociado,
      cpf_associado:       cpfAssociado,

      // Contexto SISGEP
      contexto_sisgep:    contextoSisgep,

      // Resposta
      resposta_sugerida:  String(respostaSugerida || "").trim(),

      // Ação recomendada
      acao_recomendada:   gerarAcaoRecomendada_(categoria, contextoSisgep)
    };

  } catch (e) {
    Logger.log("[sisgepAnalisarEmailIA] erro: " + e.message);
    throw new Error("Erro ao analisar e-mail: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   3. CRIAR RASCUNHO NO GMAIL
───────────────────────────────────────────────────────────────── */
function sisgepCriarRascunhoRespostaIA_CentralLegacy(messageId, respostaSugerida, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var corpoTexto = String(respostaSugerida || "").trim();
    var textoFinal = corpoTexto + "\n\n" + obterAssinaturaEmailIA_();
    var htmlFinal  = eiaTextoParaHtml_(corpoTexto) + "<br><br>" + obterAssinaturaEmailIA_Html_();
    var blobs = converterAnexosEmailIA_(anexos);

    var assuntoOriginal = msg.getSubject() || "";
    var assuntoLimpo = eiaLimparEmojiTexto_(assuntoOriginal);
    var assuntoFinal = /^re:/i.test(assuntoLimpo) ? assuntoLimpo : ("Re: " + assuntoLimpo);

    var opcoes = { htmlBody: htmlFinal, name: eiaObterNomeRemetente_(), subject: assuntoFinal };
    if (blobs.length) opcoes.attachments = blobs;
    if (cc && String(cc).trim()) opcoes.cc = String(cc).trim();

    msg.createDraftReply(textoFinal, opcoes);

    return {
      ok: true,
      mensagem: "✅ Rascunho criado no Gmail. Acesse o Gmail para revisar e enviar."
    };

  } catch (e) {
    Logger.log("[sisgepCriarRascunhoRespostaIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao criar rascunho: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────────
   4. ARQUIVAR E-MAIL (marcar como lido + arquivar)
───────────────────────────────────────────────────────────────── */
function sisgepArquivarEmailIA_CentralLegacy(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    // Marca como lido
    msg.markRead();

    // Arquiva (remove do inbox) via thread
    var thread = msg.getThread();
    if (thread) {
      thread.moveToArchive();
    }

    return { ok: true, mensagem: "E-mail marcado como lido e arquivado." };

  } catch (e) {
    Logger.log("[sisgepArquivarEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao arquivar: " + e.message };
  }
}
function sisgepAlternarEstrelaEmailIA_CentralLegacy(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var estrelado = msg.isStarred();
    if (estrelado) {
      msg.unstar();
    } else {
      msg.star();
    }

    return { ok: true, estrelado: !estrelado, mensagem: !estrelado ? "E-mail marcado com estrela." : "Estrela removida." };

  } catch (e) {
    Logger.log("[sisgepAlternarEstrelaEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

function sisgepAlternarEstrelaEmailIA(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepAlternarEstrelaEmailIA_CentralLegacy(messageId);
}
/* ─────────────────────────────────────────────────────────────────
   HELPERS INTERNOS
───────────────────────────────────────────────────────────────── */
/**
 * Busca a(s) escola(s) cujo nome corresponde ao termo buscado, dentro
 * de uma lista de escolas (cada item com um campo de nome, indicado
 * por camposNome). Substitui a lógica antiga de truncar em 10
 * caracteres (nomeItem.indexOf(alvoNorm.substring(0,10))), que podia
 * casar erroneamente duas escolas com prefixo parecido (ex: "Escola
 * Municipal A" e "Escola Municipal B").
 *
 * Estratégia:
 * 1. Compara o NOME COMPLETO normalizado (sem cortar), em ambas as
 *    direções (item contém o termo OU termo contém o item).
 * 2. Exige um tamanho mínimo (4 caracteres) para evitar match trivial
 *    por acidente com termos muito curtos.
 * 3. Se houver mais de uma escola compatível, retorna ambiguidade
 *    (ambiguo: true) em vez de escolher a primeira "no escuro".
 *
 * Retorna: { match: item|null, ambiguo: bool, candidatos: [item,...] }
 */
function eiaMelhorCorrespondenciaEscola_(lista, termoBusca, camposNome) {
  var termoNorm = String(termoBusca || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (!termoNorm || termoNorm.length < 4) {
    return { match: null, ambiguo: false, candidatos: [] };
  }

  var candidatos = [];

  for (var i = 0; i < (lista || []).length; i++) {
    var item = lista[i];
    var nomeItem = "";
    for (var c = 0; c < camposNome.length; c++) {
      if (item[camposNome[c]]) { nomeItem = String(item[camposNome[c]]); break; }
    }
    var nomeNorm = nomeItem.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!nomeNorm) continue;

    // Match exato tem prioridade absoluta
    if (nomeNorm === termoNorm) {
      return { match: item, ambiguo: false, candidatos: [item] };
    }

    // Correspondência por conteúdo — nome completo, sem truncar
    if (nomeNorm.indexOf(termoNorm) >= 0 || termoNorm.indexOf(nomeNorm) >= 0) {
      candidatos.push(item);
    }
  }

  if (candidatos.length === 0) return { match: null, ambiguo: false, candidatos: [] };
  if (candidatos.length === 1) return { match: candidatos[0], ambiguo: false, candidatos: candidatos };
  return { match: null, ambiguo: true, candidatos: candidatos.slice(0, 5) };
}
/**
 * Remove emojis e símbolos pictográficos de um texto (ex: assunto de
 * e-mail), preservando acentuação normal do português (á, ç, ã, é etc).
 * Usada para evitar que a Central IA repita, na resposta, um assunto
 * com emoji quebrado vindo de e-mails externos (ex: e-mails de
 * marketing que usam emoji no assunto e que "viram" quadrado tofu
 * em certos ambientes/fontes).
 *
 * A faixa de caracteres removida cobre os principais blocos Unicode
 * de emoji (emoticons, símbolos diversos, pictogramas, transporte,
 * bandeiras, símbolos suplementares) sem tocar em letras acentuadas
 * latinas, que ficam em uma faixa Unicode totalmente diferente.
 */
function eiaLimparEmojiTexto_(texto) {
  return String(texto || "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")   // emoji principais (símbolos, pictogramas, transporte etc)
    .replace(/[\u2600-\u27BF]/gu, "")          // símbolos diversos e dingbats (☀☎✂️ etc)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")    // bandeiras (pares de letras regionais)
    .replace(/\uFE0F/g, "")                    // seletor de variação (força emoji colorido)
    .replace(/\u200D/g, "")                    // zero-width joiner (usado em emoji combinados)
    .replace(/\s{2,}/g, " ")
    .trim();
}
/**
 * Retorna os dados de assinatura (nome, cargo, telefone, e-mail) da
 * pessoa atualmente logada no Google/SISGEP, buscando em
 * EMAIL_IA_ASSINATURAS_USUARIOS pelo e-mail ativo da sessão. Se o
 * e-mail não estiver cadastrado no mapa, cai no fallback padrão
 * (Wanderson), para nunca deixar a assinatura vazia.
 */
function eiaObterDadosUsuarioAtual_() {
  var emailAtivo = "";
  try {
    emailAtivo = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  } catch (e) {
    emailAtivo = "";
  }

  var usuarios = eiaObterUsuariosCentralIA_();

  if (emailAtivo && usuarios[emailAtivo]) {
    return usuarios[emailAtivo];
  }

  return EMAIL_IA_ASSINATURA_PADRAO;
}
/**
 * Monta o nome de exibição (campo "From") do remetente, a partir dos
 * dados da pessoa logada. Usado por todas as funções de envio da
 * Central IA para manter consistência entre o nome mostrado no
 * cabeçalho do e-mail e a assinatura no corpo (ambos vêm da mesma
 * fonte: eiaObterDadosUsuarioAtual_()).
 */
function eiaObterNomeRemetente_() {
  var dados = eiaObterDadosUsuarioAtual_();
  return dados.nome + " — SindEducação-ES";
}
/**
 * Retorna o e-mail da pessoa atualmente logada, tentando primeiro o
 * helper padrão do SISGEP (obterEmailUsuarioAtual_, de SistemaConfig.gs)
 * e caindo para Session.getActiveUser() como fallback.
 */
function eiaEmailUsuarioAtivo_() {
  try {
    if (typeof obterEmailUsuarioAtual_ === "function") {
      var email = obterEmailUsuarioAtual_();
      if (email) return email;
    }
  } catch (e) {}
  try {
    return String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  } catch (e) {
    return "";
  }
}

/**
 * Verifica se a pessoa logada está autorizada a usar a Central de
 * E-mails, reaproveitando a MESMA lista de usuários autorizados já
 * usada em outros módulos do SISGEP (SEGURANCA.USUARIOS_AUTORIZADOS,
 * em SistemaConfig.gs, via a função usuarioAutorizado()).
 *
 * Se por algum motivo a função usuarioAutorizado() não existir no
 * projeto (ex: SistemaConfig.gs não carregado), não bloqueia o acesso
 * — evita que um problema de outro arquivo derrube este módulo.
 */
function eiaAcessoAutorizado_() {
  if (typeof usuarioAutorizado !== "function") return true;
  return usuarioAutorizado(eiaEmailUsuarioAtivo_());
}
/**
 * Busca contexto da escola e ofício no SISGEP para enriquecer a análise
 */
function buscarContextoEscolaSisgep_(escolaNome, numeroOficio, cpf) {
  var partes = [];

  // Busca escola na base
  if (escolaNome && escolaNome.length >= 3) {
    try {
      var lista = listarEscolas() || [];
      var resultado = eiaMelhorCorrespondenciaEscola_(lista, escolaNome, ["escola", "NomeEscola", "nome"]);

      if (resultado.ambiguo) {
        var nomesAmbiguos = resultado.candidatos.map(function(e) {
          return e.escola || e.NomeEscola || e.nome || "(sem nome)";
        });
        partes.push("MÚLTIPLAS ESCOLAS ENCONTRADAS para '" + escolaNome + "': " + nomesAmbiguos.join(", ") + " — não foi possível identificar uma única escola com certeza.");
      } else if (resultado.match) {
        var encontrada = resultado.match;
        partes.push("ESCOLA ENCONTRADA NA BASE:");
        partes.push("  Nome: "   + (encontrada.escola || encontrada.NomeEscola || ""));
        partes.push("  CNPJ: "   + (encontrada.cnpj   || "não informado"));
        partes.push("  E-mail: " + (encontrada.email   || "não informado"));
        partes.push("  Cidade: " + (encontrada.cidade  || encontrada.municipio || ""));
      } else {
        partes.push("ESCOLA '" + escolaNome + "' NÃO ENCONTRADA na base do SISGEP.");
      }
    } catch (e) {
      partes.push("Não foi possível consultar a base de escolas: " + e.message);
    }
  }

  // Busca ofício pelo número
  if (numeroOficio) {
    try {
      var filtros = { numero: numeroOficio };
      var hist    = listarHistoricoOficios(filtros);
      var itens   = (hist && hist.itens) ? hist.itens : (Array.isArray(hist) ? hist : []);

      if (itens.length > 0) {
        var of = itens[0];
        partes.push("");
        partes.push("OFÍCIO " + numeroOficio + " ENCONTRADO:");
        partes.push("  Tipo: "   + (of.tipo   || of.Tipo   || ""));
        partes.push("  Status: " + (of.status || of.Status || ""));
        partes.push("  Escola: " + (of.escola || of.Escola || ""));
        partes.push("  Data: "   + (of.data   || of.Data   || ""));
      } else {
        partes.push("");
        partes.push("OFÍCIO " + numeroOficio + " NÃO ENCONTRADO no histórico.");
      }
    } catch (e) {
      partes.push("Não foi possível consultar histórico de ofícios: " + e.message);
    }
  }

  // Busca associado por CPF na mensalidade
  if (cpf) {
    try {
      var cpfLimpo = cpf.replace(/\D/g, "");
      if (cpfLimpo.length === 11) {
        var mens = listarMensalidadeStatus({ cpf: cpfLimpo });
        var itensMens = (mens && mens.itens) ? mens.itens : [];
        if (itensMens.length > 0) {
          var m = itensMens[0];
          partes.push("");
          partes.push("ASSOCIADO CPF " + cpf + ":");
          partes.push("  Nome: "   + (m.nome         || ""));
          partes.push("  Escola: " + (m.escola        || ""));
          partes.push("  Status mensalidade: " + (m.status || ""));
          partes.push("  Ofício: " + (m.numeroOficio  || ""));
          partes.push("  Dias sem confirmação: " + (m.diasSemConfirm || ""));
        }
      }
    } catch (e) {
      // mensalidade pode não existir — não quebra o fluxo
    }
  }

  return partes.length > 0 ? partes.join("\n") : "Nenhum contexto encontrado no SISGEP para este e-mail.";
}
/**
 * Assinatura em TEXTO PURO — usada como corpo "body" (fallback) nos
 * e-mails enviados pela Central IA, para clientes de e-mail muito
 * antigos que não renderizam HTML. Resolve automaticamente os dados
 * da pessoa logada (Wanderson, Marcelha etc.) via
 * eiaObterDadosUsuarioAtual_(). Sem emoji aqui de propósito: em texto
 * puro alguns emojis viram quadrados "tofu" em certas visualizações.
 */
function obterAssinaturaEmailIA_() {
  var dados = eiaObterDadosUsuarioAtual_();
  return [
    dados.nome + " — " + dados.cargo,
    "SindEducação-ES",
    "Tel/WhatsApp: " + dados.telefone + "  |  E-mail: " + dados.email + "  |  Fone: (27) 3222-2706"
  ].join("\n");
}
/**
 * Assinatura em HTML, enviada como htmlBody nas funções de envio/
 * rascunho/encaminhamento/envio direto da Central IA. Resolve
 * automaticamente os dados da pessoa logada via
 * eiaObterDadosUsuarioAtual_(). Sem emoji (📱📧📞) de propósito: mesmo
 * em HTML, alguns ambientes exibem esses caracteres como quadrados
 * "tofu" por falta de fonte de emoji colorido — texto puro garante
 * consistência em qualquer computador.
 */
function obterAssinaturaEmailIA_Html_() {
  var dados = eiaObterDadosUsuarioAtual_();
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.6;">'
    + '<strong>' + eiaEscapeHtml_(dados.nome) + ' &mdash; ' + eiaEscapeHtml_(dados.cargo) + '</strong><br>'
    + 'SindEduca&ccedil;&atilde;o-ES<br>'
    + 'Tel/WhatsApp: ' + eiaEscapeHtml_(dados.telefone) + ' &nbsp;|&nbsp; E-mail: ' + eiaEscapeHtml_(dados.email) + ' &nbsp;|&nbsp; Fone: (27) 3222-2706'
    + '</div>';
}
/**
 * Escapa caracteres especiais de HTML para evitar quebra de layout
 * ou injeção de tags quando o texto do e-mail (digitado pelo usuário
 * ou gerado pela IA) contiver < > & " etc.
 */
function eiaEscapeHtml_(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converte um texto simples (com quebras de linha \n) em HTML seguro,
 * trocando \n por <br>. Usado para montar o corpo HTML dos e-mails
 * enviados pela Central IA.
 */
function eiaTextoParaHtml_(texto) {
  return eiaEscapeHtml_(texto).replace(/\n/g, "<br>");
}
/**
 * Converte anexos recebidos do front-end (base64) em Blobs do Apps Script.
 * anexos: [{ nome, tipo, base64 }]
 */
function converterAnexosEmailIA_(anexos) {
  if (!anexos || !Array.isArray(anexos) || !anexos.length) return [];
  var LIMITE_TOTAL = 24 * 1024 * 1024; // ~24MB, dentro do limite do Gmail (25MB)
  var totalBytes = 0;
  var blobs = anexos.map(function(a) {
    var bytes = Utilities.base64Decode(a.base64 || "");
    totalBytes += bytes.length;
    return Utilities.newBlob(bytes, a.tipo || "application/octet-stream", a.nome || "anexo");
  });
  if (totalBytes > LIMITE_TOTAL) {
    throw new Error("Anexos excedem o limite de tamanho do Gmail (~24MB no total).");
  }
  return blobs;
}
/**
 * Gera ação recomendada baseada na categoria
 */
function gerarAcaoRecomendada_(categoria, contexto) {
  var acoes = {
    "Confirmação de Ofício":
      "Registrar confirmação no SISGEP → módulo Mensalidades → confirmar desconto do associado.",
    "Comprovante de Desconto em Folha":
      "Verificar valor e mês do desconto → confirmar no módulo Mensalidades → arquivar e-mail.",
    "Nota Fiscal (NF)":
      "Encaminhar ao setor financeiro → registrar no módulo Despesas → arquivar.",
    "Recibo de Pagamento":
      "Registrar quitação no sistema → arquivar e-mail.",
    "Solicitação de Baixa":
      "Emitir ofício de Desfiliação → atualizar status do associado → responder com confirmação.",
    "Resposta de Cobrança":
      "Verificar status da mensalidade → atualizar para CONFIRMADO ou REGULARIZADO conforme resposta.",
    "Dúvida do Associado":
      "Responder com informações corretas → se necessário escalar para a diretoria.",
    "Atualização Cadastral":
      "Atualizar dados no módulo Escolas → confirmar atualização por e-mail.",
    "Jurídico / Notificação":
      "🔴 URGENTE — Encaminhar imediatamente ao setor jurídico e à diretoria.",
      "Convenção Coletiva (CCT)":
      "Encaminhar à diretoria para análise → arquivar cópia no sistema.",
    "Marketing / Convite externo":
      "Sem relação direta com rotinas sindicais. Arquivar, marcar como irrelevante ou encaminhar apenas se houver interesse institucional.",
    "Comercial não relacionado":
      "Baixa prioridade. Avaliar se há interesse institucional; caso contrário, arquivar.",
    "Irrelevante / Spam operacional":
      "Arquivar para manter a caixa limpa. Não exige resposta, salvo decisão administrativa.",
    "Outros":
      "Analisar conteúdo manualmente e encaminhar ao setor responsável."
  };

  return acoes[categoria] || acoes["Outros"];
}

function normalizarClassificacaoEmailIA_(classif, assunto, remetente, corpo) {
  classif = classif || {};
  var texto = String([assunto, remetente, corpo, classif.resumo, classif.categoria].join(" ")).toLowerCase();
  var temSinalMarketing = /(podcast|webinar|newsletter|marketing|b2b|curso|palestra|evento|convite|comercial|venda|proposta comercial|demo|demonstração|parceria comercial)/i.test(texto);
  var temSinalSisgep = /(sindeduca|sindicato|escola|associad|cpf|cnpj|of[ií]cio|mensalidade|taxa assistencial|taxa negocial|desconto em folha|comprovante|recibo|nota fiscal|jur[ií]dico|cct|filia[cç][aã]o|desfilia[cç][aã]o)/i.test(texto);

  if (temSinalMarketing && !temSinalSisgep) {
    classif.categoria = "Marketing / Convite externo";
    classif.subcategoria = classif.subcategoria || "Convite ou prospecção externa";
    classif.tipo_remetente = classif.tipo_remetente || "Fornecedor";
    classif.escola_identificada = "";
    classif.numero_oficio = "";
    classif.nome_associado = "";
    classif.cpf_associado = "";
    classif.resumo = classif.resumo || "E-mail de marketing, convite ou prospecção externa sem vínculo direto com rotinas do SISGEP.";
  }

  if (EMAIL_IA_TODAS_CATEGORIAS.indexOf(classif.categoria) < 0) {
    classif.categoria = "Outros";
  }

  return classif;
}

/**
 * Remove marcação markdown do JSON retornado pela IA
 */
function limparJsonIA_(texto) {
  texto = String(texto || "").trim()
    .replace(/^```json/i, "")
    .replace(/^```/i,     "")
    .replace(/```$/i,     "")
    .trim();

  var inicio = texto.indexOf("{");
  var fim    = texto.lastIndexOf("}");
  if (inicio >= 0 && fim >= 0) return texto.substring(inicio, fim + 1);
  return texto;
}

/**
 * Chama a API da Anthropic — função central compartilhada com IACore.gs
 * (mantida aqui para caso CentralEmailIA.gs seja carregado isolado)
 */
function chamarClaude_SISGEP(prompt, tokenSessao) {
  // COM-B: aceita QUALQUER uma das duas provas de autorização já usadas no
  // projeto — conta autorizada da Central de E-mails (eiaAcessoAutorizado_)
  // ou sessão SISGEP válida (exigirSessaoDocumentos_) — porque esta função
  // é compartilhada por dois sistemas de login diferentes (CentralEmailIA.gs
  // e IACore.gs/Escolas). Sem nenhuma das duas, era um proxy aberto para a
  // API paga da Anthropic, alcançável direto via google.script.run.
  var autorizado = false;
  try { autorizado = eiaAcessoAutorizado_(); } catch (eAuth) { autorizado = false; }
  if (!autorizado) {
    try { exigirSessaoDocumentos_(tokenSessao, false); autorizado = true; } catch (eSessao) { autorizado = false; }
  }
  if (!autorizado) throw new Error("Acesso não autorizado.");

  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada nas Propriedades do Script.");

var payload = {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages:   [{ role: "user", content: String(prompt) }]
  };

  var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method:          "post",
    contentType:     "application/json",
    headers: {
      "x-api-key":          apiKey,
      "anthropic-version":  "2023-06-01"
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json.content[0].text;
}
function sisgepPreCategorizarEmailsIA_CentralLegacy(emails) {
  if (!eiaAcessoAutorizado_()) return {};
  try {
    if (!Array.isArray(emails) || !emails.length) return {};
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return {};

    var linhas = emails.map(function(e, i) {
      return i + ". ASSUNTO: " + String(e.assunto || "").substring(0, 80)
        + " | REMETENTE: " + String(e.remetente || "").substring(0, 60)
        + " | PREVIEW: " + String(e.corpoPreview || "").substring(0, 120);
    }).join("\n");

    var prompt = [
      "Classifique cada e-mail abaixo em UMA das categorias:",
      EMAIL_IA_TODAS_CATEGORIAS.join(", "),
      "",
      "Regras importantes:",
      "- Convites para podcast, webinar, cursos, eventos comerciais, marketing, newsletter, vendas ou propostas B2B sem relação com escola, associado, ofício, mensalidade ou processo sindical devem ser classificados como Marketing / Convite externo ou Comercial não relacionado.",
      "- Spam, promoção genérica ou mensagem sem ação administrativa deve ser Irrelevante / Spam operacional.",
      "- Use Outros apenas quando o e-mail tiver conteúdo real, mas não se encaixar nas demais categorias.",
      "",
      "Retorne APENAS JSON válido, sem markdown, sem crases, sem explicação, no formato:",
      '{"resultados": [{"indice": 0, "categoria": "...", "escola": "..."}]}',
      "",
      "E-MAILS:",
      linhas
    ].join("\n");

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
    var inicio = texto.indexOf("{");
    var fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim < 0) return {};
    var parsed = JSON.parse(texto.substring(inicio, fim + 1));
    var resultados = parsed.resultados || [];

    var mapa = {};
    resultados.forEach(function(r) {
      var idx = r.indice;
      if (idx >= 0 && idx < emails.length) {
        var cat = (EMAIL_IA_TODAS_CATEGORIAS.indexOf(r.categoria) >= 0) ? r.categoria : "Outros";
        var prio = EMAIL_IA_PRIORIDADE_MAP[cat] || "Normal";
        mapa[emails[idx].messageId] = {
          categoria: cat,
          prioridade: prio,
          escola_identificada: r.escola || "",
          pre_categorizado: true
        };
      }
    });

    return mapa;

  } catch (e) {
    Logger.log("[sisgepPreCategorizarEmailsIA] erro: " + e.message);
    return {};
  }
}
function sisgepEncaminharEmailIA_CentralLegacy(messageId, para, notaAdicional, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");
    if (!para || !String(para).trim()) throw new Error("Informe ao menos um destinatário.");

    var blobs = converterAnexosEmailIA_(anexos);

    var assuntoOriginal = msg.getSubject() || "";
    var assuntoLimpo = eiaLimparEmojiTexto_(assuntoOriginal);
    var assuntoFinal = /^(fwd|fw|enc):/i.test(assuntoLimpo) ? assuntoLimpo : ("Fwd: " + assuntoLimpo);

    var opcoes = { name: eiaObterNomeRemetente_(), subject: assuntoFinal };
    if (blobs.length) opcoes.attachments = blobs;
    if (cc && String(cc).trim()) opcoes.cc = String(cc).trim();

    var notaFinal = String(notaAdicional || "").trim();
    if (notaFinal) {
      opcoes.body = notaFinal + "\n\n" + obterAssinaturaEmailIA_() + "\n\n---------- Mensagem encaminhada ----------\n";
      opcoes.htmlBody = eiaTextoParaHtml_(notaFinal) + "<br><br>" + obterAssinaturaEmailIA_Html_()
        + "<br><br>---------- Mensagem encaminhada ----------<br>";
    }

    msg.forward(String(para).trim(), opcoes);

    return { ok: true, mensagem: "✅ E-mail encaminhado com sucesso!" };

  } catch (e) {
    Logger.log("[sisgepEncaminharEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao encaminhar: " + e.message };
  }
}

function sisgepEncaminharEmailIA(messageId, para, notaAdicional, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepEncaminharEmailIA_CentralLegacy(messageId, para, notaAdicional, anexos, cc);
}

function sisgepEnviarRespostaIA_CentralLegacy(messageId, textoResposta, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var corpoTexto = String(textoResposta || "").trim();
    var textoFinal = corpoTexto + "\n\n" + obterAssinaturaEmailIA_();
    var htmlFinal  = eiaTextoParaHtml_(corpoTexto) + "<br><br>" + obterAssinaturaEmailIA_Html_();
    var blobs = converterAnexosEmailIA_(anexos);

    var assuntoOriginal = msg.getSubject() || "";
    var assuntoLimpo = eiaLimparEmojiTexto_(assuntoOriginal);
    var assuntoFinal = /^re:/i.test(assuntoLimpo) ? assuntoLimpo : ("Re: " + assuntoLimpo);

    var opcoes = { htmlBody: htmlFinal, name: eiaObterNomeRemetente_(), subject: assuntoFinal };
    if (blobs.length) opcoes.attachments = blobs;
    if (cc && String(cc).trim()) opcoes.cc = String(cc).trim();

    msg.reply(textoFinal, opcoes);
    msg.markRead();

    return { ok: true, mensagem: "✅ Resposta enviada com sucesso pelo Gmail!" };

  } catch (e) {
    Logger.log("[sisgepEnviarRespostaIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar: " + e.message };
  }
}
function sisgepParsearComprovanteMensalidade(messageId) {
  try {
    if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };

    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var corpo  = msg.getPlainBody() || "";
    var assunto = msg.getSubject()  || "";
    var apiKey  = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

    var prompt = [
      "Você é um assistente de RH sindical. Extraia os dados do comprovante de mensalidade sindical abaixo.",
      "",
      "Retorne APENAS JSON válido, sem markdown:",
      "{",
      '  "escola": "",',
      '  "cnpj": "",',
      '  "mes_referencia": "",',
      '  "ano_referencia": "",',
      '  "valor_total": "",',
      '  "quantidade_associados": "",',
      '  "associados": [{"nome":"","cpf":"","valor":""}],',
      '  "data_pagamento": "",',
      '  "banco": "",',
      '  "observacoes": ""',
      "}",
      "",
      "ASSUNTO: " + assunto,
      "CONTEÚDO:",
      corpo.substring(0, 4000)
    ].join("\n");

    var payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
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
    if (json.error) throw new Error(json.error.message);

    var texto  = json.content[0].text;
    var inicio = texto.indexOf("{");
    var fim    = texto.lastIndexOf("}");
    if (inicio < 0 || fim < 0) throw new Error("JSON inválido retornado pela IA.");

    var dados = JSON.parse(texto.substring(inicio, fim + 1));
    dados.messageId = messageId;
    dados.assunto   = assunto;
    return { ok: true, dados: dados };

  } catch (e) {
    Logger.log("[sisgepParsearComprovanteMensalidade] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao parsear comprovante: " + e.message };
  }
}

function sisgepEnviarEmailDireto_CentralLegacy(dados) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    dados = dados || {};
    var para    = String(dados.para    || "").trim();
    var assunto = String(dados.assunto || "").trim();
    var corpo   = String(dados.corpo   || "").trim();
    var cc      = String(dados.cc      || "").trim();
    var bcc     = String(dados.bcc     || "").trim();
    var anexos  = dados.anexos || [];

    if (!para || !corpo) return { ok: false, mensagem: "Destinatário ou corpo vazio." };
    if (para.indexOf("@") < 0) return { ok: false, mensagem: "Destinatário inválido: '" + para + "' não parece ser um e-mail." };

    var corpoFinal = corpo + "\n\n" + obterAssinaturaEmailIA_();
    var htmlFinal  = eiaTextoParaHtml_(corpo) + "<br><br>" + obterAssinaturaEmailIA_Html_();
    var blobs = converterAnexosEmailIA_(anexos);

    var opcoes = {
      name: eiaObterNomeRemetente_(),
      htmlBody: htmlFinal
    };
    if (cc)  opcoes.cc  = cc;
    if (bcc) opcoes.bcc = bcc;
    if (blobs.length) opcoes.attachments = blobs;

    GmailApp.sendEmail(para, assunto, corpoFinal, opcoes);

    return { ok: true, mensagem: "✅ E-mail enviado para " + para + (cc ? " (com cópia para: " + cc + ")" : "") };
  } catch(e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}
/* ─────────────────────────────────────────────────────────────────
   PONTES (nomes limpos chamados pelo front-end via google.script.run)
   Cada ponte agora verifica eiaAcessoAutorizado_() antes de repassar
   para a função de implementação (_CentralLegacy), bloqueando o uso
   por qualquer conta Google que não esteja na lista de autorizados
   do SISGEP (SEGURANCA.USUARIOS_AUTORIZADOS, em SistemaConfig.gs).
───────────────────────────────────────────────────────────────── */
function sisgepAnalisarEmailIA(messageId) {
  if (!eiaAcessoAutorizado_()) {
    throw new Error("Acesso não autorizado à Central de E-mails. E-mail: " + eiaEmailUsuarioAtivo_());
  }
  return sisgepAnalisarEmailIA_CentralLegacy(messageId);
}

function sisgepCriarRascunhoRespostaIA(messageId, respostaSugerida, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepCriarRascunhoRespostaIA_CentralLegacy(messageId, respostaSugerida, anexos, cc);
}

function sisgepArquivarEmailIA(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepArquivarEmailIA_CentralLegacy(messageId);
}

function sisgepPreCategorizarEmailsIA(emails) {
  if (!eiaAcessoAutorizado_()) return {};
  return sisgepPreCategorizarEmailsIA_CentralLegacy(emails);
}

function sisgepEnviarRespostaIA(messageId, textoResposta, anexos, cc) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepEnviarRespostaIA_CentralLegacy(messageId, textoResposta, anexos, cc);
}

function sisgepEnviarEmailDireto(dados) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepEnviarEmailDireto_CentralLegacy(dados);
}
/* ─────────────────────────────────────────────────────────────────
   ADIADOS (snooze simulado com persistencia em planilha + trigger)
   O Gmail nao expoe snooze via Apps Script, entao simulamos:
   - Ao adiar: arquiva o e-mail e registra na aba SISGEP_Adiados
   - Um gatilho por tempo roda sozinho e devolve o e-mail na hora certa,
     mesmo que ninguem esteja com a Central de E-mails aberta
   - A listagem tambem faz uma checagem na hora, como reforco
───────────────────────────────────────────────────────────────── */

var EIA_ADIADOS_ABA = "SISGEP_Adiados";
var EIA_ADIADOS_COLS = { messageId: 1, threadId: 2, assunto: 3, remetente: 4, dataAdiado: 5, dataVolta: 6, status: 7, usuario: 8 };
var EIA_USUARIOS_ABA = "SISGEP_UsuariosCentralIA";

function obterPlanilhaSISGEP_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById("1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E");
}

function obterAbaAdiadosEmailIA_() {
  var ss = obterPlanilhaSISGEP_();
  var aba = ss.getSheetByName(EIA_ADIADOS_ABA);
  if (!aba) {
    aba = ss.insertSheet(EIA_ADIADOS_ABA);
    aba.appendRow(["MessageId", "ThreadId", "Assunto", "Remetente", "DataAdiado", "DataVolta", "Status", "UsuarioEmail"]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function eiaAdiadosUsuarioAtual_() {
  try { return Session.getActiveUser().getEmail() || ""; } catch (e) { return ""; }
}

function sisgepAdiarEmailIA_CentralLegacy(messageId, dataVoltaISO) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    if (!messageId) throw new Error("ID da mensagem não informado.");
    var dataVolta = new Date(dataVoltaISO);
    if (isNaN(dataVolta.getTime())) throw new Error("Data de retorno inválida.");
    if (dataVolta.getTime() <= new Date().getTime()) throw new Error("A data de retorno precisa ser no futuro.");

    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");
    var thread = msg.getThread();
    thread.moveToArchive();

    var aba = obterAbaAdiadosEmailIA_();
    aba.appendRow([
      messageId,
      thread.getId(),
      msg.getSubject() || "",
      msg.getFrom() || "",
      new Date().toISOString(),
      dataVolta.toISOString(),
      "Pendente",
      eiaAdiadosUsuarioAtual_()
    ]);

    var tz = Session.getScriptTimeZone();
    var dataFormatada = Utilities.formatDate(dataVolta, tz, "dd/MM/yyyy 'às' HH:mm");
    return { ok: true, mensagem: "✅ E-mail adiado até " + dataFormatada + "." };

  } catch (e) {
    Logger.log("[sisgepAdiarEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao adiar: " + e.message };
  }
}

function sisgepCancelarAdiamentoEmailIA_CentralLegacy(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var aba = obterAbaAdiadosEmailIA_();
    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      if (linha[EIA_ADIADOS_COLS.messageId - 1] === messageId && linha[EIA_ADIADOS_COLS.status - 1] === "Pendente") {
        var threadId = linha[EIA_ADIADOS_COLS.threadId - 1];
        var thread = GmailApp.getThreadById(threadId);
        if (thread) thread.moveToInbox();
        aba.getRange(i + 1, EIA_ADIADOS_COLS.status).setValue("Cancelado");
        return { ok: true, mensagem: "E-mail retornado para a Entrada." };
      }
    }
    throw new Error("Este e-mail não está na lista de adiados.");

  } catch (e) {
    Logger.log("[sisgepCancelarAdiamentoEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/**
 * Chamada pelo GATILHO POR TEMPO (rodando sozinha, sem depender de ninguem
 * abrir a tela). Tambem chamada como reforço sempre que a aba Adiados é
 * listada. Devolve para a Entrada qualquer e-mail cuja data ja passou.
 */
function processarAdiadosVencidosEmailIA_() {
  try {
    var aba = obterAbaAdiadosEmailIA_();
    var dados = aba.getDataRange().getValues();
    var agora = new Date().getTime();

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      if (linha[EIA_ADIADOS_COLS.status - 1] !== "Pendente") continue;
      var dataVoltaTs = new Date(linha[EIA_ADIADOS_COLS.dataVolta - 1]).getTime();
      if (isNaN(dataVoltaTs) || dataVoltaTs > agora) continue;

      try {
        var threadId = linha[EIA_ADIADOS_COLS.threadId - 1];
        var thread = GmailApp.getThreadById(threadId);
        if (thread) thread.moveToInbox();
        aba.getRange(i + 1, EIA_ADIADOS_COLS.status).setValue("Retornado");
      } catch (eThread) {
        aba.getRange(i + 1, EIA_ADIADOS_COLS.status).setValue("Erro");
        Logger.log("[processarAdiadosVencidosEmailIA_] erro na linha " + (i + 1) + ": " + eThread.message);
      }
    }
  } catch (e) {
    Logger.log("[processarAdiadosVencidosEmailIA_] erro geral: " + e.message);
  }

  eiaLimparAdiadosAntigos_();
}
/**
 * Remove da aba SISGEP_Adiados as linhas com status finalizado
 * (Cancelado, Retornado ou Erro) há mais de 30 dias. Sem isso, a aba
 * cresce para sempre — toda linha adiada um dia fica ali de novo,
 * mesmo depois de resolvida — deixando cada vez mais lenta a leitura
 * feita pelo trigger a cada 15 min e pela listagem da aba "Adiados".
 *
 * Roda automaticamente dentro de processarAdiadosVencidosEmailIA_,
 * então não precisa de nenhum gatilho novo — já está "de carona" no
 * trigger de 15 em 15 minutos que já existe.
 */
function eiaLimparAdiadosAntigos_() {
  try {
    var DIAS_RETENCAO = 30;
    var aba = obterAbaAdiadosEmailIA_();
    var dados = aba.getDataRange().getValues();
    var agora = new Date().getTime();
    var limiteMs = DIAS_RETENCAO * 24 * 60 * 60 * 1000;
    var statusFinalizados = ["Cancelado", "Retornado", "Erro"];

    // Percorre de baixo para cima para poder deletar linhas sem
    // bagunçar os índices das linhas ainda não visitadas
    for (var i = dados.length - 1; i >= 1; i--) {
      var linha = dados[i];
      var status = linha[EIA_ADIADOS_COLS.status - 1];
      if (statusFinalizados.indexOf(status) < 0) continue;

      var dataAdiadoTs = new Date(linha[EIA_ADIADOS_COLS.dataAdiado - 1]).getTime();
      if (isNaN(dataAdiadoTs)) continue;

      if ((agora - dataAdiadoTs) > limiteMs) {
        aba.deleteRow(i + 1);
      }
    }
  } catch (e) {
    Logger.log("[eiaLimparAdiadosAntigos_] erro: " + e.message);
  }
}
function sisgepListarAdiadosEmailIA_CentralLegacy() {
  if (!eiaAcessoAutorizado_()) return { ok: false, emails: [], pagina: 1, porPagina: 25, total: 0 };
  try {
    processarAdiadosVencidosEmailIA_();

    var aba = obterAbaAdiadosEmailIA_();
    var dados = aba.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();
    var emails = [];

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      if (linha[EIA_ADIADOS_COLS.status - 1] !== "Pendente") continue;

      var messageId = linha[EIA_ADIADOS_COLS.messageId - 1];
      try {
        var msg = GmailApp.getMessageById(messageId);
        if (!msg) {
          aba.getRange(i + 1, EIA_ADIADOS_COLS.status).setValue("Erro");
          continue;
        }
        var corpo = msg.getPlainBody() || "";
        var dataMsg = msg.getDate();
        var anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [];
        var dataVolta = linha[EIA_ADIADOS_COLS.dataVolta - 1];

        emails.push({
          threadId: linha[EIA_ADIADOS_COLS.threadId - 1],
          messageId: messageId,
          assunto: msg.getSubject() || linha[EIA_ADIADOS_COLS.assunto - 1] || "(sem assunto)",
          remetente: msg.getFrom() || linha[EIA_ADIADOS_COLS.remetente - 1] || "",
          remetenteNome: (msg.getFrom() || "").replace(/<[^>]+>/g, "").replace(/"/g, "").trim(),
          destinatario: msg.getTo() || "",
          dataStr: dataMsg ? Utilities.formatDate(new Date(dataMsg), tz, "dd/MM/yyyy HH:mm") : "",
          dataTs: dataMsg ? new Date(dataMsg).getTime() : 0,
          lido: !msg.isUnread(),
          estrelado: msg.isStarred(),
          caixa: "meusadiados",
          temAnexo: anexos.length > 0,
          qtdAnexos: anexos.length,
          corpo: corpo.substring(0, 2500),
          corpoPreview: corpo.substring(0, 220).replace(/\s+/g, " ").trim(),
          dataVolta: new Date(dataVolta).toISOString(),
          dataVoltaFormatada: Utilities.formatDate(new Date(dataVolta), tz, "dd/MM/yyyy 'às' HH:mm")
        });
      } catch (eMsg) {
        aba.getRange(i + 1, EIA_ADIADOS_COLS.status).setValue("Erro");
      }
    }

    emails.sort(function(a, b) { return new Date(a.dataVolta) - new Date(b.dataVolta); });

    return { ok: true, emails: emails, pagina: 1, porPagina: emails.length || 25, total: emails.length };

  } catch (e) {
    Logger.log("[sisgepListarAdiadosEmailIA] erro: " + e.message);
    return { ok: false, emails: [], pagina: 1, porPagina: 25, total: 0 };
  }
}

/**
 * RODAR MANUALMENTE UMA VEZ SO, direto no editor do GAS (selecionar essa
 * funcao no dropdown e clicar em Executar). Isso autoriza e instala o
 * gatilho que roda sozinho a cada 15 minutos, devolvendo e-mails adiados
 * na hora certa mesmo sem ninguem com a tela aberta.
 */
function instalarTriggerAdiadosEmailIA() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processarAdiadosVencidosEmailIA_") {
      Logger.log("Gatilho já existe, nada a fazer.");
      return "Gatilho já estava instalado.";
    }
  }
  ScriptApp.newTrigger("processarAdiadosVencidosEmailIA_")
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log("Gatilho instalado com sucesso.");
  return "Gatilho instalado com sucesso.";
}

function sisgepAdiarEmailIA(messageId, dataVoltaISO) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepAdiarEmailIA_CentralLegacy(messageId, dataVoltaISO);
}

function sisgepCancelarAdiamentoEmailIA(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepCancelarAdiamentoEmailIA_CentralLegacy(messageId);
}

function sisgepListarAdiadosEmailIA() {
  if (!eiaAcessoAutorizado_()) return { ok: false, emails: [], pagina: 1, porPagina: 25, total: 0 };
  return sisgepListarAdiadosEmailIA_CentralLegacy();
}
/**
 * Cria um RASCUNHO no Gmail para um e-mail NOVO (não é resposta a
 * nenhuma thread existente). Usado pelo botão "Escrever" da Central IA.
 * Diferente de sisgepCriarRascunhoRespostaIA (que responde uma thread
 * já existente via msg.createDraftReply), esta função usa
 * GmailApp.createDraft() para gerar uma mensagem totalmente nova.
 */
function sisgepCriarRascunhoDireto_CentralLegacy(dados) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    dados = dados || {};
    var para    = String(dados.para    || "").trim();
    var assunto = String(dados.assunto || "").trim();
    var corpo   = String(dados.corpo   || "").trim();
    var cc      = String(dados.cc      || "").trim();
    var bcc     = String(dados.bcc     || "").trim();
    var anexos  = dados.anexos || [];

    if (!para) return { ok: false, mensagem: "Informe ao menos um destinatário." };
    if (!corpo) return { ok: false, mensagem: "Escreva o corpo do e-mail." };
    if (para.indexOf("@") < 0) return { ok: false, mensagem: "Destinatário inválido: '" + para + "' não parece ser um e-mail." };

    var corpoFinal = corpo + "\n\n" + obterAssinaturaEmailIA_();
    var htmlFinal  = eiaTextoParaHtml_(corpo) + "<br><br>" + obterAssinaturaEmailIA_Html_();
    var blobs = converterAnexosEmailIA_(anexos);

    var opcoes = { htmlBody: htmlFinal };
    if (blobs.length) opcoes.attachments = blobs;
    if (cc)  opcoes.cc  = cc;
    if (bcc) opcoes.bcc = bcc;

    GmailApp.createDraft(para, assunto || "(sem assunto)", corpoFinal, opcoes);

    return { ok: true, mensagem: "✅ Rascunho criado no Gmail. Acesse o Gmail para revisar e enviar." };

  } catch (e) {
    Logger.log("[sisgepCriarRascunhoDireto] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao criar rascunho: " + e.message };
  }
}

function sisgepCriarRascunhoDireto(dados) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepCriarRascunhoDireto_CentralLegacy(dados);
}
/**
 * Gera um e-mail (assunto + corpo) a partir de uma instrução curta do
 * usuário, usando a mesma IA (Claude) que já roda na análise/resposta
 * de e-mails da Central. Se um nome de escola for identificado na
 * instrução ou no campo "para", busca contexto no SISGEP para
 * personalizar (igual já acontece em sisgepAnalisarEmailIA_CentralLegacy).
 */
function sisgepGerarEmailComIA_CentralLegacy(instrucao, paraTexto) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    instrucao = String(instrucao || "").trim();
    paraTexto = String(paraTexto || "").trim();
    if (!instrucao) throw new Error("Descreva o que você quer que a IA escreva.");

    // Tenta identificar nome de escola no texto da instrução ou no campo Para
    // para enriquecer com contexto do SISGEP (reaproveita helper já existente)
    var contextoSisgep = "";
    try {
      var pistaEscola = "";
      var mEscola = instrucao.match(/(?:escola|col[eé]gio|institui[cç][aã]o)\s+([A-ZÀ-Úa-zà-ú0-9\s]{3,60})/i);
      if (mEscola && mEscola[1]) pistaEscola = mEscola[1].trim();
      else if (paraTexto && paraTexto.indexOf("@") < 0) pistaEscola = paraTexto;

      if (pistaEscola) {
        contextoSisgep = buscarContextoEscolaSisgep_(pistaEscola, "", "");
      }
    } catch (eCtx) {
      contextoSisgep = "";
    }

var saudacaoAtual = eiaSaudacaoPorHorario_();

    var prompt = [
      "Você é o assistente de comunicação do SindEducação-ES.",
      "Redija um e-mail profissional em português, com base na instrução abaixo.",
      "",
      "INSTRUÇÃO DO USUÁRIO:",
      instrucao,
      "",
      contextoSisgep ? "CONTEXTO DO SISGEP (use se for relevante para personalizar):\n" + contextoSisgep : "",
      "",
      "INSTRUÇÕES DE ESCRITA:",
      "- Comece EXATAMENTE com '" + saudacaoAtual + "' (é o horário atual em Vitória/ES — use esta saudação exata, não escolha outra).",
      "- Seja direto, cordial e institucional.",
      "- Encerre com 'Atenciosamente,' (sem assinatura — será adicionada pelo sistema).",
      "- Não use markdown, asteriscos ou negrito.",
      "- Não invente dados que não estejam na instrução ou no contexto SISGEP.",
      "",
      "Retorne APENAS JSON válido, sem markdown, sem crases, sem explicação, no formato:",
      '{"assunto": "", "corpo": ""}'
    ].filter(Boolean).join("\n");

    var respostaIA = chamarClaude_SISGEP(prompt);
    var json = {};
    try {
      json = JSON.parse(limparJsonIA_(respostaIA));
    } catch (eParse) {
      // fallback: se a IA não retornou JSON válido, usa o texto bruto como corpo
      json = { assunto: "", corpo: String(respostaIA || "").trim() };
    }

    return {
      ok: true,
      assunto: String(json.assunto || "").trim(),
      corpo: String(json.corpo || "").trim()
    };

  } catch (e) {
    Logger.log("[sisgepGerarEmailComIA] erro: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function sisgepGerarEmailComIA(instrucao, paraTexto) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepGerarEmailComIA_CentralLegacy(instrucao, paraTexto);
}
/**
 * Resolve um nome de escola digitado no campo "Para" da Central IA
 * para o e-mail cadastrado dela no SISGEP. Usado pelo botão "Buscar
 * e-mail" do modal Escrever, quando o usuário digita o nome da escola
 * em vez do e-mail direto.
 */
function sisgepResolverEmailDestinatario_CentralLegacy(nomeOuTexto) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    nomeOuTexto = String(nomeOuTexto || "").trim();
    if (!nomeOuTexto) return { ok: false, mensagem: "Digite um nome para buscar." };
    if (nomeOuTexto.indexOf("@") >= 0) return { ok: true, email: nomeOuTexto, jaEraEmail: true };

    var lista = listarEscolasCadastro() || [];
    var resultado = eiaMelhorCorrespondenciaEscola_(lista, nomeOuTexto, ["escola", "NomeEscola"]);

    if (resultado.ambiguo) {
      var nomes = resultado.candidatos.map(function(e) {
        return e.escola || e.NomeEscola || "(sem nome)";
      });
      return {
        ok: false,
        ambiguo: true,
        mensagem: "Encontrei " + resultado.candidatos.length + " escolas parecidas com '" + nomeOuTexto + "': "
          + nomes.join(", ") + ". Digite um nome mais específico ou o e-mail diretamente."
      };
    }

    if (!resultado.match) {
      return { ok: false, mensagem: "Nenhum e-mail encontrado para '" + nomeOuTexto + "' na base de escolas." };
    }

    var encontrada = resultado.match;
    var email = encontrada.email || encontrada.Email || "";
    if (!email) return { ok: false, mensagem: "Escola '" + (encontrada.escola || encontrada.NomeEscola) + "' encontrada, mas sem e-mail cadastrado." };

    return { ok: true, email: email, escola: encontrada.escola || encontrada.NomeEscola || nomeOuTexto };

  } catch (e) {
    Logger.log("[sisgepResolverEmailDestinatario] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao buscar: " + e.message };
  }
}
function sisgepResolverEmailDestinatario(nomeOuTexto) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepResolverEmailDestinatario_CentralLegacy(nomeOuTexto);
}

/**
 * Restaura um e-mail que está na Lixeira, devolvendo-o para a Entrada.
 * Usado pelo botão "Restaurar" quando o usuário está navegando na
 * aba Lixeira da Central IA.
 *
 * OBS: o Apps Script não expõe uma API para excluir permanentemente
 * um e-mail da lixeira — isso só é possível pela interface do Gmail.
 * O próprio Gmail já limpa a lixeira automaticamente após 30 dias,
 * então não há necessidade de um botão "excluir para sempre" aqui.
 */
function sisgepRestaurarEmailIA_CentralLegacy(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    var msg = GmailApp.getMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada.");

    var thread = msg.getThread();
    if (thread) thread.moveToInbox();

    return { ok: true, mensagem: "✅ E-mail restaurado para a Entrada." };

  } catch (e) {
    Logger.log("[sisgepRestaurarEmailIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao restaurar: " + e.message };
  }
}
/**
 * Executa uma ação (arquivar, marcar como lido, marcar como spam ou
 * mover para a lixeira) sobre uma LISTA de e-mails de uma só vez —
 * usado pela barra de ações em lote da Central IA. Processa tudo no
 * servidor numa única chamada RPC, em vez de uma chamada por e-mail
 * (mais rápido e evita estourar cota de chamadas).
 *
 * acao: "arquivar" | "marcar_lido" | "spam" | "lixeira"
 */
function sisgepAcaoEmLoteEmailIA_CentralLegacy(messageIds, acao) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado.", sucesso: 0, falha: 0 };

  messageIds = Array.isArray(messageIds) ? messageIds : [];
  var acoesValidas = ["arquivar", "marcar_lido", "spam", "lixeira"];
  if (acoesValidas.indexOf(acao) < 0) {
    return { ok: false, mensagem: "Ação inválida: " + acao, sucesso: 0, falha: 0 };
  }
  if (!messageIds.length) {
    return { ok: false, mensagem: "Nenhum e-mail selecionado.", sucesso: 0, falha: 0 };
  }

  var sucesso = 0, falha = 0, erros = [];

  messageIds.forEach(function(messageId) {
    try {
      var msg = GmailApp.getMessageById(messageId);
      if (!msg) { falha++; return; }
      var thread = msg.getThread();

      if (acao === "arquivar") {
        msg.markRead();
        if (thread) thread.moveToArchive();
      } else if (acao === "marcar_lido") {
        msg.markRead();
      } else if (acao === "spam") {
        if (thread) thread.moveToSpam();
      } else if (acao === "lixeira") {
        if (thread) thread.moveToTrash();
      }
      sucesso++;
    } catch (e) {
      falha++;
      erros.push(messageId + ": " + e.message);
    }
  });

  if (erros.length) Logger.log("[sisgepAcaoEmLoteEmailIA] erros: " + erros.join(" | "));

  var nomesAcao = {
    arquivar: "arquivados",
    marcar_lido: "marcados como lidos",
    spam: "movidos para spam",
    lixeira: "movidos para a lixeira"
  };

  return {
    ok: falha === 0,
    sucesso: sucesso,
    falha: falha,
    mensagem: sucesso + " e-mail(s) " + nomesAcao[acao] + (falha ? " (" + falha + " falharam)" : "") + "."
  };
}

function sisgepAcaoEmLoteEmailIA(messageIds, acao) {
  return sisgepAcaoEmLoteEmailIA_CentralLegacy(messageIds, acao);
}
function sisgepRestaurarEmailIA(messageId) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepRestaurarEmailIA_CentralLegacy(messageId);
}
/**
 * Retorna a saudação correta (Bom dia! / Boa tarde! / Boa noite!) com
 * base no horário atual no fuso de Vitória/ES (America/Sao_Paulo).
 * Usada para instruir a IA de forma explícita e determinística, em
 * vez de deixar a IA "adivinhar" o horário — isso garante 100% de
 * acerto independente de quando o e-mail for gerado.
 *
 * Faixas: Bom dia (05h-11h59), Boa tarde (12h-17h59), Boa noite (18h-04h59)
 */
function eiaSaudacaoPorHorario_() {
  var tz = "America/Sao_Paulo";
  var hora = Number(Utilities.formatDate(new Date(), tz, "H"));

  if (hora >= 5 && hora < 12)  return "Bom dia!";
  if (hora >= 12 && hora < 18) return "Boa tarde!";
  return "Boa noite!";
}
/**
 * Wrapper temporário só para testar processarAdiadosVencidosEmailIA_
 * manualmente pelo editor (funções com _ no final ficam escondidas
 * do dropdown "Executar"). Pode apagar depois de confirmar que funciona.
 */
function testeManual_ProcessarAdiados() {
  processarAdiadosVencidosEmailIA_();
  Logger.log("Executado com sucesso.");
}
/**
 * Garante que a aba SISGEP_UsuariosCentralIA existe. Se ainda não
 * existir, cria e já popula com os dados que hoje estão fixos no
 * código (EMAIL_IA_ASSINATURAS_USUARIOS), como migração automática —
 * assim ninguém perde a configuração já feita, e dali em diante
 * qualquer pessoa nova pode ser adicionada direto na planilha, sem
 * precisar editar o .gs.
 */
function obterAbaUsuariosCentralIA_() {
  var ss = obterPlanilhaSISGEP_();
  var aba = ss.getSheetByName(EIA_USUARIOS_ABA);
  if (!aba) {
    aba = ss.insertSheet(EIA_USUARIOS_ABA);
    aba.appendRow(["Email", "Nome", "Cargo", "Telefone"]);
    aba.setFrozenRows(1);

    // Migração automática: popula com o que já estava fixo no código
    Object.keys(EMAIL_IA_ASSINATURAS_USUARIOS).forEach(function(email) {
      var dados = EMAIL_IA_ASSINATURAS_USUARIOS[email];
      aba.appendRow([dados.email, dados.nome, dados.cargo, dados.telefone]);
    });
  }
  return aba;
}

/**
 * Lê todos os usuários cadastrados na aba SISGEP_UsuariosCentralIA e
 * devolve como um mapa { email: {nome, cargo, telefone, email} },
 * igual ao formato de EMAIL_IA_ASSINATURAS_USUARIOS. Cacheado por 5
 * minutos via CacheService, já que essa função é chamada toda vez
 * que um e-mail é enviado/analisado — não faz sentido ler a planilha
 * a cada chamada.
 */
function eiaObterUsuariosCentralIA_() {
  var cache = CacheService.getScriptCache();
  var CHAVE_CACHE = "eia_usuarios_central_ia";

  var cacheado = cache.get(CHAVE_CACHE);
  if (cacheado !== null) {
    try { return JSON.parse(cacheado); } catch (e) {}
  }

  var mapa = {};
  try {
    var aba = obterAbaUsuariosCentralIA_();
    var dados = aba.getDataRange().getValues();

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var email = String(linha[0] || "").trim().toLowerCase();
      if (!email) continue;
      mapa[email] = {
        nome: String(linha[1] || "").trim(),
        cargo: String(linha[2] || "").trim(),
        telefone: String(linha[3] || "").trim(),
        email: email
      };
    }
  } catch (e) {
    Logger.log("[eiaObterUsuariosCentralIA_] erro ao ler planilha, usando fallback fixo: " + e.message);
    return EMAIL_IA_ASSINATURAS_USUARIOS;
  }

  if (Object.keys(mapa).length === 0) {
    // Aba existe mas está vazia por algum motivo — não deixa a Central
    // sem assinatura nenhuma, cai no mapa fixo como rede de segurança
    return EMAIL_IA_ASSINATURAS_USUARIOS;
  }

  try {
    cache.put(CHAVE_CACHE, JSON.stringify(mapa), 300); // 5 minutos
  } catch (e) {
    Logger.log("[eiaObterUsuariosCentralIA_] erro ao gravar cache: " + e.message);
  }

  return mapa;
}
/**
 * Limpa o cache de usuários da Central IA, forçando a próxima leitura
 * a vir direto da planilha. Rode manualmente pelo editor do Apps
 * Script depois de adicionar/editar alguém na aba
 * SISGEP_UsuariosCentralIA, se não quiser esperar até 5 minutos pela
 * expiração natural do cache.
 */
function eiaLimparCacheUsuariosCentralIA() {
  CacheService.getScriptCache().remove("eia_usuarios_central_ia");
  Logger.log("Cache de usuários da Central IA limpo.");
}
/* ─────────────────────────────────────────────────────────────────
   MEMÓRIA EVOLUTIVA DA SOFIA (Central de E-mails IA)
   Reaproveita a Memória Organizacional já existente (MemoriaCore.gs,
   aba Memoria_Organizacional, função salvarMemoria_) em vez de criar
   uma segunda estrutura de armazenamento paralela. Categoria usada
   aqui: CORRECAO_CATEGORIA_IA — subcategoria é a escola ou o e-mail
   do remetente, conteudo é o texto da correção.
───────────────────────────────────────────────────────────────── */

var EIA_MEMORIA_CATEGORIA = "CORRECAO_CATEGORIA_IA";

/**
 * Registra uma correção manual de categoria feita no painel da
 * Central IA, gravando na MESMA aba usada por toda a Memória
 * Organizacional do SISGEP (salvarMemoria_, de MemoriaCore.gs).
 */
function sisgepRegistrarCorrecaoCategoriaIA_CentralLegacy(chaveEntidade, categoriaOriginal, categoriaCorrigida) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  try {
    chaveEntidade = String(chaveEntidade || "").trim();
    categoriaCorrigida = String(categoriaCorrigida || "").trim();
    if (!chaveEntidade || !categoriaCorrigida) return { ok: false, mensagem: "Dados insuficientes para registrar correção." };
    if (categoriaOriginal === categoriaCorrigida) return { ok: true, mensagem: "Sem alteração." };

    salvarMemoria_(
      EIA_MEMORIA_CATEGORIA,
      chaveEntidade,
      "Categoria original: '" + (categoriaOriginal || "-") + "' → corrigida para: '" + categoriaCorrigida + "'",
      "CentralEmailIA"
    );

    CacheService.getScriptCache().remove(eiaChaveCacheMemoria_(chaveEntidade));

    return { ok: true, mensagem: "Correção registrada. A SOFIA vai considerar isso em e-mails parecidos." };
  } catch (e) {
    Logger.log("[sisgepRegistrarCorrecaoCategoriaIA] erro: " + e.message);
    return { ok: false, mensagem: "Erro ao registrar: " + e.message };
  }
}

function sisgepRegistrarCorrecaoCategoriaIA(chaveEntidade, categoriaOriginal, categoriaCorrigida) {
  if (!eiaAcessoAutorizado_()) return { ok: false, mensagem: "Acesso não autorizado." };
  return sisgepRegistrarCorrecaoCategoriaIA_CentralLegacy(chaveEntidade, categoriaOriginal, categoriaCorrigida);
}

function eiaChaveCacheMemoria_(chaveEntidade) {
  return "eia_memoria_org_" + Utilities.base64Encode(String(chaveEntidade || "").toLowerCase()).substring(0, 200);
}

/**
 * Busca até 5 correções de categoria mais recentes para uma
 * escola/remetente, filtrando a mesma aba Memoria_Organizacional
 * (categoria CORRECAO_CATEGORIA_IA, subcategoria = chave da
 * entidade). Cacheada por 5 minutos, já que essa leitura roda a
 * cada classificação de e-mail — sem cache, seria uma leitura de
 * planilha inteira em toda análise.
 */
function eiaBuscarCorrecoesMemoriaOrganizacional_(chaveEntidade) {
  chaveEntidade = String(chaveEntidade || "").trim();
  if (!chaveEntidade || chaveEntidade.length < 3) return [];

  var cache = CacheService.getScriptCache();
  var chaveCache = eiaChaveCacheMemoria_(chaveEntidade);
  var cacheado = cache.get(chaveCache);
  if (cacheado !== null) {
    try { return JSON.parse(cacheado); } catch (e) {}
  }

  var resultado = [];
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_MEMORIA);
    if (!aba || aba.getLastRow() < 2) return [];

    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues();
    var chaveNorm = chaveEntidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    for (var i = dados.length - 1; i >= 0; i--) {
      var linha = dados[i];
      var categoria = String(linha[0] || "").trim();
      if (categoria !== EIA_MEMORIA_CATEGORIA) continue;

      var subcategoria = String(linha[1] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (!subcategoria) continue;
      if (subcategoria === chaveNorm || subcategoria.indexOf(chaveNorm) >= 0 || chaveNorm.indexOf(subcategoria) >= 0) {
        resultado.push(String(linha[2] || ""));
      }
      if (resultado.length >= 5) break;
    }
  } catch (e) {
    Logger.log("[eiaBuscarCorrecoesMemoriaOrganizacional_] erro: " + e.message);
    return [];
  }

  try {
    cache.put(chaveCache, JSON.stringify(resultado), 300);
  } catch (e) {}

  return resultado;
}

/**
 * Monta o bloco de texto de memória evolutiva a ser injetado no
 * prompt de classificação. String vazia se não houver correções
 * relevantes — nesse caso, nada muda no prompt.
 */
function eiaMontarBlocoMemoriaSofia_(escolaNome, remetenteEmail) {
  var chave = escolaNome && escolaNome.length >= 3 ? escolaNome : remetenteEmail;
  var correcoes = eiaBuscarCorrecoesMemoriaOrganizacional_(chave);
  if (!correcoes.length) return "";

  var linhas = correcoes.map(function(c) { return "- " + c; });
  return "MEMÓRIA DE CORREÇÕES ANTERIORES para este remetente/escola (considere isso na classificação):\n" + linhas.join("\n");
}