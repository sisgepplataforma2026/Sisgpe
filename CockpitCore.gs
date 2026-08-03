// ================================================================
// ARQUIVO: CockpitCore.gs
// Cockpit Inteligente — SISGEP Platform / SindEducação-ES
//
// Arquitetura: ADR-006
//   getCockpit() → retorna tudo em uma chamada
//   {usuario, emails, resumoDia, indicadores, sugestoes, cache}
//
// Sprint 1.1 — 2026-06-26
// ================================================================

/* ─────────────────────────────────────────────────────────────────
   FUNÇÃO PRINCIPAL — uma chamada, contexto completo
───────────────────────────────────────────────────────────────── */
function getCockpit(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var inicio = new Date().getTime();

    // 1. Dados do usuário
    var usuario = getCockpitUsuario_();

    // 2. E-mails (inbox, últimos 30 dias)
    var emails = getCockpitEmails_();

    // 3. Resumo do dia (contagens por categoria)
    var resumoDia = getCockpitResumoDia_(emails);

    // 4. Indicadores KPI
    var indicadores = getCockpitIndicadores_(emails, resumoDia);

    // 5. Sugestões de ação baseadas nos e-mails
    var sugestoes = getCockpitSugestoes_(emails, resumoDia);

    // 6. Greeting inteligente
    var greeting = getCockpitGreeting_(usuario, resumoDia);

    var duracao = new Date().getTime() - inicio;

    return {
      ok:          true,
      duracao_ms:  duracao,
      ts:          new Date().toISOString(),
      usuario:     usuario,
      emails:      emails,
      resumoDia:   resumoDia,
      indicadores: indicadores,
      sugestoes:   sugestoes,
      greeting:    greeting
    };

  } catch (e) {
    Logger.log("[getCockpit] erro: " + e.message);
    return {
      ok:       false,
      mensagem: "Erro ao carregar Cockpit: " + e.message
    };
  }
}

/* ─────────────────────────────────────────────────────────────────
   USUÁRIO
───────────────────────────────────────────────────────────────── */
function getCockpitUsuario_() {
  try {
    var sessao = getSessaoUsuario ? getSessaoUsuario() : null;
    if (sessao) return sessao;
  } catch(e) {}

  // fallback: dados do script
  return {
    nome:    Session.getActiveUser().getEmail().split("@")[0] || "Wanderson",
    email:   Session.getActiveUser().getEmail(),
    perfil:  "Administrador",
    sindicato: "SindEducação-ES"
  };
}

/* ─────────────────────────────────────────────────────────────────
   E-MAILS — usa cache ScriptCache (30s TTL)
───────────────────────────────────────────────────────────────── */
function getCockpitEmails_() {
  var CACHE_KEY = "cockpit_emails_inbox_v1";

  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY);
    if (cached) {
      var dados = JSON.parse(cached);
      dados.forEach(function(e) { e._fromCache = true; });
      return dados;
    }
  } catch(e) {}

  // Busca real no Gmail — reaproveita o mesmo leitor da Caixa de E-mails
  // (eiaBuscarEmailsGmail_, em CentralEmailIA.gs) em vez de manter uma
  // segunda implementação independente do mapeamento thread → e-mail.
  var emails = [];
  try {
    emails = eiaBuscarEmailsGmail_("in:inbox newer_than:30d", 0, 30);

    // Salva no cache por 30 segundos
    try {
      CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(emails), 30);
    } catch(e) {}

  } catch(e) {
    Logger.log("[getCockpitEmails_] erro: " + e.message);
  }

  return emails;
}

/* ─────────────────────────────────────────────────────────────────
   RESUMO DO DIA
   Conta e-mails novos desde a última visita (últimas 8h)
───────────────────────────────────────────────────────────────── */
function getCockpitResumoDia_(emails) {
  var agora    = new Date().getTime();
  var oitoHoras = 8 * 60 * 60 * 1000;
  var limite   = agora - oitoHoras;

  var total       = emails.length;
  var novos       = 0;
  var naoLidos    = 0;
  var urgentes    = 0;
  var cobr        = 0;
  var confirmacoes = 0;
  var juridicos   = 0;

  emails.forEach(function(e) {
    if (!e.lido) naoLidos++;
    if (e.dataTs && e.dataTs >= limite) novos++;

    // Classificação rápida por palavras-chave no assunto/preview
    var txt = (e.assunto + " " + e.corpoPreview).toLowerCase();

    if (txt.match(/urgent|urgen|notific|jurídic|juridic|advog|processo judicial/)) urgentes++;
    if (txt.match(/cobrança|cobran|boleto|débito|inadimpl|pagamento|mensalidade|taxa/)) cobr++;
    if (txt.match(/confirmação|confirma|recebimento|acuso|acusamos/)) confirmacoes++;
    if (txt.match(/jurídic|juridic|notific|advog|processo/)) juridicos++;
  });

  return {
    total:        total,
    novos:        novos,
    naoLidos:     naoLidos,
    urgentes:     urgentes,
    cobracas:     cobr,
    confirmacoes: confirmacoes,
    juridicos:    juridicos,
    atualizadoEm: new Date().toISOString()
  };
}

/* ─────────────────────────────────────────────────────────────────
   INDICADORES KPI
───────────────────────────────────────────────────────────────── */
function getCockpitIndicadores_(emails, resumoDia) {
  // Busca dados do módulo de mensalidades para enriquecer os KPIs
  var totalMensalidades  = 0;
  var inadimplentes      = 0;
  var oficiosPendentes   = 0;

  try {
    var planilha = SpreadsheetApp.openById(PLANILHA_ID);

    // Conta mensalidades PENDENTES
    try {
      var abaMens = planilha.getSheetByName("Mensalidade_Controle");
      if (abaMens) {
        var dadosMens = abaMens.getDataRange().getValues();
        dadosMens.slice(1).forEach(function(row) {
          var status = String(row[7] || "").toUpperCase();
          totalMensalidades++;
          if (status === "PENDENTE" || status === "AGUARDANDO" || status === "PENDENTE_30D") inadimplentes++;
        });
      }
    } catch(e) {}

    // Conta ofícios PENDENTES / ENVIADOS (sem confirmação)
    try {
      var abaOficios = planilha.getSheetByName("Controle_Oficios") || planilha.getSheetByName("Ofícios");
      if (abaOficios) {
        var dadosOf = abaOficios.getDataRange().getValues();
        dadosOf.slice(1).forEach(function(row) {
          var status = String(row[5] || row[4] || "").toUpperCase();
          if (status === "ENVIADO" || status === "PENDENTE") oficiosPendentes++;
        });
      }
    } catch(e) {}

  } catch(e) {
    Logger.log("[getCockpitIndicadores_] planilha: " + e.message);
  }

  return {
    emails:           resumoDia.total,
    emailsNovos:      resumoDia.novos,
    emailsNaoLidos:   resumoDia.naoLidos,
    urgentes:         resumoDia.urgentes,
    cobracas:         resumoDia.cobracas,
    confirmacoes:     resumoDia.confirmacoes,
    inadimplentes:    inadimplentes,
    oficiosPendentes: oficiosPendentes,
    decisoes:         resumoDia.urgentes + resumoDia.cobracas
  };
}

/* ─────────────────────────────────────────────────────────────────
   SUGESTÕES DE AÇÃO
   Baseadas nos e-mails e KPIs — aparecem na coluna central
───────────────────────────────────────────────────────────────── */
function getCockpitSugestoes_(emails, resumoDia) {
  var sugestoes = [];

  // Sugestão 1: cobranças pendentes
  if (resumoDia.cobracas > 0) {
    sugestoes.push({
      emoji:    "💰",
      titulo:   "Cobranças pendentes detectadas",
      descricao: resumoDia.cobracas + " e-mail(s) com tema de cobrança ou inadimplência",
      filtro:   "cobranca",
      prioridade: 1
    });
  }

  // Sugestão 2: urgentes
  if (resumoDia.urgentes > 0) {
    sugestoes.push({
      emoji:    "🔴",
      titulo:   "E-mails urgentes para resolver",
      descricao: resumoDia.urgentes + " e-mail(s) requerem atenção imediata",
      filtro:   "Urgente",
      prioridade: 0
    });
  }

  // Sugestão 3: confirmações aguardando retorno
  if (resumoDia.confirmacoes > 0) {
    sugestoes.push({
      emoji:    "📩",
      titulo:   "Confirmações aguardando retorno",
      descricao: resumoDia.confirmacoes + " e-mail(s) com confirmação de recebimento",
      filtro:   "Normal",
      prioridade: 2
    });
  }

  // Sugestão 4: não lidos
  if (resumoDia.naoLidos > 3) {
    sugestoes.push({
      emoji:    "📬",
      titulo:   "E-mails não lidos",
      descricao: resumoDia.naoLidos + " e-mail(s) aguardando leitura",
      filtro:   "todos",
      prioridade: 3
    });
  }

  // Ordena por prioridade e limita a 4
  sugestoes.sort(function(a, b) { return a.prioridade - b.prioridade; });
  return sugestoes.slice(0, 4);
}

/* ─────────────────────────────────────────────────────────────────
   GREETING INTELIGENTE
   "Bom dia, Wanderson! Enquanto você estava fora..."
───────────────────────────────────────────────────────────────── */
function getCockpitGreeting_(usuario, resumoDia) {
  var hora = new Date().getHours();
  var saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  var nome = (usuario && (usuario.nome || usuario.usuario) || "").split(" ")[0] || "Wanderson";

  // Monta o subtítulo inteligente
  var acoes = [];
  if (resumoDia.novos > 0)       acoes.push("✔ " + resumoDia.novos + " e-mail(s) recebidos");
  if (resumoDia.cobracas > 0)    acoes.push("✔ " + resumoDia.cobracas + " cobrança(s) detectada(s)");
  if (resumoDia.urgentes > 0)    acoes.push("⚠ " + resumoDia.urgentes + " urgente(s) aguardando");
  if (resumoDia.confirmacoes > 0) acoes.push("✔ " + resumoDia.confirmacoes + " confirmação(ões)");

  var decisoes = resumoDia.urgentes + resumoDia.cobracas;

  var subtitulo = acoes.length > 0
    ? "Enquanto você estava fora: " + acoes.join(" · ")
    : "A IA preparou sua operação de hoje.";

  var chamada = decisoes > 0
    ? "Restam " + decisoes + " decisão(ões) para você."
    : "Tudo em ordem. Bom trabalho!";

  return {
    saudacao:  saudacao,
    nome:      nome,
    subtitulo: subtitulo,
    chamada:   chamada,
    acoes:     acoes,
    decisoes:  decisoes
  };
}

/* ─────────────────────────────────────────────────────────────────
   INVALIDAR CACHE (chamado após arquivar/responder e-mail)
───────────────────────────────────────────────────────────────── */
function cockpitInvalidarCache(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    CacheService.getScriptCache().remove("cockpit_emails_inbox_v1");
    return { ok: true };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}