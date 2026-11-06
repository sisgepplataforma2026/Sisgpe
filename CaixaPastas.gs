/* ================================================================
   CAIXA DE E-MAILS — AS PASTAS DO GMAIL DA FINANCEIRO@ (03/11/2026)
   ================================================================
   O usuário: "Eu quero trabalhar dentro do SISGEP com o meu e-mail. Então
   o e-mail tem que aparecer todas as pastas de e-mail. Caixa de entrada,
   itens enviados, lixeira, etc." — e "são contas distintas que têm que
   trabalhar de forma diferente": isto é SÓ da financeiro@ (Gmail da conta
   do projeto). A secretaria@ continua com Entrada + CERTIFICADO 2027-1.
   Mockup aprovado: docs/mock-caixa-pastas-financeiro.png (+ card "Todos").

   - cada pasta carrega quando é clicada (a Entrada continua pelo caminho
     de sempre, caixaFinanceiroItens, com a categorização do robô);
   - ações em lote, sempre por clique: resolver, estrela, mover para
     marcador/Entrada, lixeira (vai para a lixeira do Gmail também; o
     servidor exige a confirmação), restaurar, não é spam;
   - abrir, responder e encaminhar usam as funções de sempre: elas já
     abrem qualquer conversa do Gmail pelo id.
   Nada aqui apaga de vez: a lixeira do Gmail guarda por 30 dias.
   ================================================================ */

var CXP_PASTAS = [
  { chave: "INBOX", rotulo: "Caixa de entrada", icone: "📥", robo: true },
  { chave: "STARRED", rotulo: "Com estrela", icone: "⭐", busca: "is:starred" },
  { chave: "SENT", rotulo: "Itens enviados", icone: "📤", busca: "in:sent", robo: true },
  { chave: "DRAFTS", rotulo: "Rascunhos", icone: "📝", busca: "in:drafts" },
  { chave: "ALL", rotulo: "Todos os e-mails", icone: "📚", busca: "-in:spam -in:trash" },
  { chave: "SPAM", rotulo: "Spam", icone: "🚫", busca: "in:spam" },
  { chave: "TRASH", rotulo: "Lixeira", icone: "🗑", busca: "in:trash" }
];
var CXP_POR_PAGINA = 50;
var CXP_CONTAR_ATE = 100;
var CXP_LABEL = "LABEL:";

function cxpExigirFinanceiro_(tokenSessao) {
  var sessao = cxsExigir_(tokenSessao);
  if (!cxsPodeCaixa_(sessao, "FINANCEIRO")) throw new Error("As pastas são da caixa financeiro@sindeducacao.com — cada um vê só a sua.");
  return sessao;
}
function cxpPasta_(chave) {
  return CXP_PASTAS.filter(function (p) { return p.chave === chave; })[0] || null;
}
function cxpThreads_(chave, inicio, max) {
  var gm = cxsGmailFinanceiro_();
  if (String(chave).indexOf(CXP_LABEL) === 0) {
    var lab = gm.getUserLabelByName(String(chave).substring(CXP_LABEL.length));
    if (!lab) throw new Error("O marcador não existe mais no Gmail.");
    return lab.getThreads(inicio, max) || [];
  }
  var p = cxpPasta_(chave);
  if (!p || !p.busca) throw new Error("Pasta desconhecida.");
  return gm.search(p.busca, inicio, max) || [];
}
function cxpLimparCache_() {
  try { var c = CacheService.getScriptCache(); c.remove("cxs_fin_lista_v1"); c.remove("cxp_pastas_v1"); } catch (e) {}
}

/** As pastas da financeiro@ e os marcadores do Gmail, com quantos têm. */
function caixaFinanceiroPastas(tokenSessao) {
  try {
    cxpExigirFinanceiro_(tokenSessao);
    var cache = null;
    try { cache = CacheService.getScriptCache(); var c = cache.get("cxp_pastas_v1"); if (c) return JSON.parse(c); } catch (e) {}
    var gm = cxsGmailFinanceiro_();
    var pastas = CXP_PASTAS.map(function (p) {
      var n = null;
      if (p.chave === "STARRED" || p.chave === "DRAFTS" || p.chave === "SPAM" || p.chave === "TRASH") {
        try { n = (gm.search(p.busca, 0, CXP_CONTAR_ATE) || []).length; } catch (e) { n = null; }
      }
      return { chave: p.chave, rotulo: p.rotulo, icone: p.icone, robo: !!p.robo, total: n, mais: n === CXP_CONTAR_ATE };
    });
    var marcadores = [];
    try {
      marcadores = (gm.getUserLabels() || []).map(function (l) {
        var naoLidos = 0;
        try { naoLidos = l.getUnreadCount(); } catch (e) {}
        return { chave: CXP_LABEL + l.getName(), rotulo: l.getName(), naoLidos: naoLidos };
      }).sort(function (a, b) { return a.rotulo.localeCompare(b.rotulo); });
    } catch (eL) {}
    var r = { ok: true, pastas: pastas, marcadores: marcadores };
    try { cache.put("cxp_pastas_v1", JSON.stringify(r), 300); } catch (e) {}
    return r;
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Os e-mails de uma pasta (ou marcador), uma página por vez. */
function caixaFinanceiroPasta(chave, inicio, tokenSessao) {
  try {
    cxpExigirFinanceiro_(tokenSessao);
    inicio = Math.max(0, Number(inicio) || 0);
    if (chave === "DRAFTS") {
      /* Rascunho tem id próprio (para abrir e continuar a escrever). */
      var rs = cxnListarRascunhos_();
      return { ok: true, pasta: "DRAFTS", itens: rs.slice(inicio, inicio + CXP_POR_PAGINA), inicio: inicio,
               mais: rs.length > inicio + CXP_POR_PAGINA };
    }
    var threads = cxpThreads_(String(chave || ""), inicio, CXP_POR_PAGINA + 1);
    var mais = threads.length > CXP_POR_PAGINA;
    threads = threads.slice(0, CXP_POR_PAGINA);
    var est = cxsEstados_(), guardados = cxsFinTiposGuardados_();
    var itens = [];
    threads.forEach(function (th) {
      var l = cxsLinhaDeThreadFin_(th, false);
      if (!l) return;
      var g = guardados[l.THREAD_ID];
      if (!l.__aprendido && g) l.TIPO = String(g.TIPO);
      var r = cxsResumo_(l, est[String(l.THREAD_ID)], {});
      r.fonte = "EMAIL";
      r.pasta = String(chave);
      if (chave === "SENT" || chave === "DRAFTS") {
        /* No que nós mandamos, o que interessa é PARA QUEM. */
        var m = vpeJson_(l.MENSAGENS_JSON, []);
        var ult = m[m.length - 1] || {};
        r.nome = "Para: " + (cxsNome_(ult.para) || cxsEmail_(ult.para) || "(sem destinatário)");
        r.de = cxsEmail_(ult.para);
      }
      itens.push(r);
    });
    return { ok: true, pasta: String(chave), itens: itens, inicio: inicio, mais: mais };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

var CXP_ACOES = {
  RESOLVER: "resolvido", ESTRELA: "com estrela", TIRAR_ESTRELA: "sem estrela", LIXEIRA: "mandado(s) para a lixeira",
  RESTAURAR: "restaurado(s) para a Caixa de entrada", NAO_SPAM: "devolvido(s) para a Caixa de entrada", MOVER: "movido(s)",
  ARQUIVAR: "arquivado(s) — saíram da Caixa de entrada e continuam em Todos os e-mails"
};

/**
 * Uma ação em vários e-mails da financeiro@, por clique. extra = { para:
 * "INBOX" | "LABEL:nome" (MOVER), confirmado: true (LIXEIRA) }.
 */
function caixaFinanceiroAcao(ids, acao, extra, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    acao = String(acao || "").toUpperCase();
    extra = extra || {};
    if (!CXP_ACOES[acao]) return { ok: false, mensagem: "Ação desconhecida." };
    ids = (ids || []).map(String).filter(function (id) { return cxsEhFinanceiro_(id); });
    if (!ids.length) return { ok: false, mensagem: "Marque pelo menos um e-mail da financeiro@." };
    if (ids.length > 100) return { ok: false, mensagem: "No máximo 100 e-mails por vez." };
    if (acao === "LIXEIRA" && extra.confirmado !== true) return { ok: false, mensagem: "Confirme antes de mandar para a lixeira." };
    var gm = cxsGmailFinanceiro_(), quem = sessao.email || sessao.usuario || "";
    var lab = null;
    if (acao === "MOVER") {
      var para = String(extra.para || "");
      if (para.indexOf(CXP_LABEL) === 0) {
        lab = gm.getUserLabelByName(para.substring(CXP_LABEL.length));
        if (!lab) return { ok: false, mensagem: "O marcador não existe mais no Gmail." };
      } else if (para !== "INBOX") return { ok: false, mensagem: "Escolha para onde mover." };
    }
    var feitos = 0, erros = [], assuntos = [];
    ids.forEach(function (id) {
      try {
        cxsExigirCaixaDe_(sessao, id);
        var th = gm.getThreadById(id.substring(CXS_PREFIXO_FIN.length));
        if (!th) throw new Error("não está mais no Gmail");
        var msgs = th.getMessages() || [];
        assuntos.push(String((msgs[0] && msgs[0].getSubject()) || "(sem assunto)").substring(0, 60));
        if (acao === "RESOLVER") cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO }, quem);
        else if (acao === "ESTRELA") { if (msgs.length) msgs[msgs.length - 1].star(); }
        else if (acao === "TIRAR_ESTRELA") msgs.forEach(function (m) { if (!m.isStarred || m.isStarred()) m.unstar(); });
        else if (acao === "LIXEIRA") th.moveToTrash();
        else if (acao === "ARQUIVAR") th.moveToArchive();   /* 03/11/2026: "arquivar vários" — como no Gmail */
        else if (acao === "RESTAURAR" || acao === "NAO_SPAM") th.moveToInbox();
        else if (acao === "MOVER") { if (lab) { th.addLabel(lab); th.moveToArchive(); } else th.moveToInbox(); }
        feitos++;
      } catch (e) { erros.push(id + ": " + e.message); }
    });
    cxpLimparCache_();
    var destino = acao === "MOVER" ? (lab ? " para " + lab.getName() : " para a Caixa de entrada") : "";
    cxsAuditar_("PASTA_" + acao, ids.join(","), feitos + " " + CXP_ACOES[acao] + destino + ": " + assuntos.join(" | "), sessao);
    return { ok: feitos > 0, feitos: feitos, erros: erros,
             mensagem: feitos + " e-mail(s) " + CXP_ACOES[acao] + destino + "." + (erros.length ? " " + erros.length + " não deu: " + erros.join("; ") : "") };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Pasta nova no Gmail da financeiro@ (03/11/2026: "criar novas pastas também").
    É um marcador do Gmail — aparece lá também. Sub-pasta: "pai/filha". */
function caixaFinanceiroCriarPasta(nome, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    nome = String(nome || "").replace(/\s+/g, " ").trim().substring(0, 80);
    if (nome.length < 2) return { ok: false, mensagem: "Dê um nome à pasta." };
    if (/^(inbox|spam|trash|sent|drafts|caixa de entrada|lixeira)$/i.test(nome)) return { ok: false, mensagem: "Esse nome é de pasta do próprio Gmail." };
    var gm = cxsGmailFinanceiro_();
    var ja = gm.getUserLabelByName(nome);
    if (!ja) gm.createLabel(nome);
    cxpLimparCache_();
    cxsAuditar_("PASTA_CRIADA", "financeiro@", "Pasta \"" + nome + "\"" + (ja ? " (já existia)" : " criada"), sessao);
    return { ok: true, chave: CXP_LABEL + nome, mensagem: ja ? "A pasta \"" + nome + "\" já existia." : "Pasta \"" + nome + "\" criada (no Gmail também)." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* ================================================================
   AS PASTAS DA SECRETARIA@ (06/11/2026)
   ================================================================
   O usuário: a Marcela "vai trabalhar dentro do SISGEP junto ao e-mail" —
   "ler é uma coisa e aparecer é outra". As pastas aparecem como as da
   financeiro@; o robô continua lendo só a Entrada e a CERTIFICADO 2027-1.
   O Gmail é o da cópia da Secretaria, alcançado pelo leitor na hora
   (CaixaSecretariaGmail.gs). Ids das pastas: "S:<conversa>". A Entrada
   continua pela ponte, com a categorização de sempre; as ações em lote
   valem para ela também (o id da ponte é o da conversa neste Gmail).
   Etiquetas do robô ("SISGEP/…") não viram pasta: o tipo já está nos cards.
   ================================================================ */
var CXP_PASTAS_SEC = [
  { chave: "INBOX", rotulo: "Caixa de entrada", icone: "📥", robo: true },
  { chave: "STARRED", rotulo: "Com estrela", icone: "⭐", busca: "is:starred" },
  { chave: "SENT", rotulo: "Itens enviados", icone: "📤", busca: "in:sent" },
  { chave: "DRAFTS", rotulo: "Rascunhos", icone: "📝" },
  { chave: "ALL", rotulo: "Todos os e-mails", icone: "📚", busca: "-in:spam -in:trash" },
  { chave: "SPAM", rotulo: "Spam", icone: "🚫", busca: "in:spam" },
  { chave: "TRASH", rotulo: "Lixeira", icone: "🗑", busca: "in:trash" }
];
var CXP_ROBO_SEC = /CERTIFICADO\s*2027\s*[-\/.]?\s*1\b/i;

function cxpExigirSecretaria_(tokenSessao) {
  var sessao = cxsExigir_(tokenSessao);
  if (!cxsPodeCaixa_(sessao, "SECRETARIA")) throw new Error("As pastas são da caixa secretaria@sindeducacao.com — cada um vê só a sua.");
  return sessao;
}
function cxpIdConversaSec_(id) {
  id = String(id || "");
  return cxgEhSecretariaGmail_(id) ? id.substring(CXG_PREFIXO.length) : id;
}

/** As pastas da secretaria@ e as pastas criadas, com quantos têm. */
function caixaSecretariaPastas(tokenSessao) {
  try {
    cxpExigirSecretaria_(tokenSessao);
    if (!cxgLigada_()) return { ok: true, ligada: false, pastas: [], marcadores: [] };
    var cache = null;
    try { cache = CacheService.getScriptCache(); var c = cache.get("cxp_pastas_sec_v1"); if (c) return JSON.parse(c); } catch (e) {}
    var gm = cxgGmail_();
    var pastas = CXP_PASTAS_SEC.map(function (p) {
      var n = null;
      if (p.chave === "STARRED" || p.chave === "SPAM" || p.chave === "TRASH") {
        try { n = cxgApi_("contar", { q: p.busca, max: CXP_CONTAR_ATE }); } catch (e) { n = null; }
      } else if (p.chave === "DRAFTS") {
        try { n = (cxgApi_("rascunhos", {}) || []).length; } catch (e) { n = null; }
      }
      return { chave: p.chave, rotulo: p.rotulo, icone: p.icone, robo: !!p.robo, total: n, mais: n === CXP_CONTAR_ATE };
    });
    var marcadores = (gm.getUserLabels() || []).filter(function (l) { return !/^SISGEP(\/|$)/i.test(l.getName()); }).map(function (l) {
      return { chave: CXP_LABEL + l.getName(), rotulo: l.getName(), naoLidos: l.getUnreadCount(), robo: CXP_ROBO_SEC.test(l.getName()) };
    }).sort(function (a, b) { return a.rotulo.localeCompare(b.rotulo); });
    var r = { ok: true, ligada: true, pastas: pastas, marcadores: marcadores };
    try { cache.put("cxp_pastas_sec_v1", JSON.stringify(r), 300); } catch (e) {}
    return r;
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Os e-mails de uma pasta da secretaria@, uma página por vez. */
function caixaSecretariaPasta(chave, inicio, tokenSessao) {
  try {
    cxpExigirSecretaria_(tokenSessao);
    inicio = Math.max(0, Number(inicio) || 0);
    chave = String(chave || "");
    if (chave === "DRAFTS") {
      var rs = cxnRascunhosSec_().map(function (x) { delete x.__d; return x; });
      return { ok: true, pasta: "DRAFTS", itens: rs.slice(inicio, inicio + CXP_POR_PAGINA), inicio: inicio, mais: rs.length > inicio + CXP_POR_PAGINA };
    }
    var gm = cxgGmail_(), threads;
    if (chave.indexOf(CXP_LABEL) === 0) {
      var lab = gm.getUserLabelByName(chave.substring(CXP_LABEL.length));
      if (!lab) throw new Error("A pasta não existe mais.");
      threads = lab.getThreads(inicio, CXP_POR_PAGINA + 1) || [];
    } else {
      var p = CXP_PASTAS_SEC.filter(function (x) { return x.chave === chave; })[0];
      if (!p || !p.busca) throw new Error("Pasta desconhecida.");
      threads = gm.search(p.busca, inicio, CXP_POR_PAGINA + 1) || [];
    }
    var mais = threads.length > CXP_POR_PAGINA;
    threads = threads.slice(0, CXP_POR_PAGINA);
    var est = cxsEstados_(), itens = [];
    threads.forEach(function (th) {
      var l = cxsLinhaDeThreadFin_(th, false, null, "SECRETARIA");
      if (!l) return;
      var r = cxsResumo_(l, est[String(l.THREAD_ID)], {});
      r.fonte = "EMAIL";
      r.pasta = chave;
      if (chave === "SENT") {
        var m = vpeJson_(l.MENSAGENS_JSON, []), ult = m[m.length - 1] || {};
        r.nome = "Para: " + (cxsNome_(ult.para) || cxsEmail_(ult.para) || "(sem destinatário)");
        r.de = cxsEmail_(ult.para);
      }
      itens.push(r);
    });
    return { ok: true, pasta: chave, itens: itens, inicio: inicio, mais: mais };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Uma ação em vários e-mails da secretaria@, por clique, numa chamada só ao leitor. */
function caixaSecretariaAcao(ids, acao, extra, tokenSessao) {
  try {
    var sessao = cxpExigirSecretaria_(tokenSessao);
    acao = String(acao || "").toUpperCase();
    extra = extra || {};
    if (!CXP_ACOES[acao]) return { ok: false, mensagem: "Ação desconhecida." };
    ids = (ids || []).map(String).filter(function (id) { return id && !cxsEhFinanceiro_(id); });
    if (!ids.length) return { ok: false, mensagem: "Marque pelo menos um e-mail da secretaria@." };
    if (ids.length > 100) return { ok: false, mensagem: "No máximo 100 e-mails por vez." };
    if (acao === "LIXEIRA" && extra.confirmado !== true) return { ok: false, mensagem: "Confirme antes de mandar para a lixeira." };
    var quem = sessao.email || sessao.usuario || "", destino = "", nome = "";
    if (acao === "RESOLVER") {
      ids.forEach(function (id) { cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO }, quem); });
      cxsAuditar_("PASTA_RESOLVER", ids.join(","), ids.length + " resolvido(s)", sessao);
      return { ok: true, feitos: ids.length, erros: [], mensagem: ids.length + " e-mail(s) resolvido(s)." };
    }
    var faz = { ESTRELA: "ESTRELA", TIRAR_ESTRELA: "TIRAR_ESTRELA", LIXEIRA: "LIXEIRA", ARQUIVAR: "ARQUIVAR",
                RESTAURAR: "ENTRADA", NAO_SPAM: "ENTRADA" }[acao];
    if (acao === "MOVER") {
      var para = String(extra.para || "");
      if (para === "INBOX") { faz = "ENTRADA"; destino = " para a Caixa de entrada"; }
      else if (para.indexOf(CXP_LABEL) === 0) { faz = "MARCAR"; nome = para.substring(CXP_LABEL.length); destino = " para " + nome; }
      else return { ok: false, mensagem: "Escolha para onde mover." };
    }
    var res = cxgApi_("naConversas", { ids: ids.map(cxpIdConversaSec_), faz: faz, nome: nome }) || [];
    var feitos = res.filter(function (x) { return x.ok; });
    var erros = res.filter(function (x) { return !x.ok; }).map(function (x) { return x.id + ": " + x.erro; });
    try { var c = CacheService.getScriptCache(); c.remove("cxp_pastas_sec_v1"); } catch (e) {}
    cxsAuditar_("PASTA_" + acao, ids.join(","), feitos.length + " " + CXP_ACOES[acao] + destino + " (secretaria@): " +
      feitos.map(function (x) { return x.assunto; }).join(" | "), sessao);
    return { ok: feitos.length > 0, feitos: feitos.length, erros: erros,
             mensagem: feitos.length + " e-mail(s) " + CXP_ACOES[acao] + destino + "." + (erros.length ? " " + erros.length + " não deu: " + erros.join("; ") : "") };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Pasta nova no Gmail da Secretaria (aparece lá também). */
function caixaSecretariaCriarPasta(nome, tokenSessao) {
  try {
    var sessao = cxpExigirSecretaria_(tokenSessao);
    nome = String(nome || "").replace(/\s+/g, " ").trim().substring(0, 80);
    if (nome.length < 2) return { ok: false, mensagem: "Dê um nome à pasta." };
    if (/^(inbox|spam|trash|sent|drafts|caixa de entrada|lixeira)$/i.test(nome) || /^SISGEP(\/|$)/i.test(nome)) return { ok: false, mensagem: "Esse nome é reservado." };
    var r = cxgApi_("criarMarcador", { nome: nome });
    try { CacheService.getScriptCache().remove("cxp_pastas_sec_v1"); } catch (e) {}
    cxsAuditar_("PASTA_CRIADA", "secretaria@", "Pasta \"" + nome + "\"" + (r && r.criado ? " criada" : " (já existia)"), sessao);
    return { ok: true, chave: CXP_LABEL + nome, mensagem: r && r.criado ? "Pasta \"" + nome + "\" criada." : "A pasta \"" + nome + "\" já existia." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
