/* ================================================================
   CAIXA — CARDS DINÂMICOS: O ROBÔ PROPÕE, A PESSOA CRIA (03/11/2026)
   ================================================================
   O usuário: "os cards deveriam ser dinâmicos. Ele iria ler ... ia
   entender o conceito do e-mail e ia alterando. Desde que esteja vazio."
   Combinado (mockup docs/mock-caixa-pastas-financeiro.png):
     - o robô PROPÕE um card novo quando vê vários e-mails de um mesmo
       assunto que hoje estão misturados; quem cria é a pessoa (clique);
     - criar o card leva esses e-mails para ele, e o robô passa a usar a
       categoria nova (vai na lista que a IA recebe);
     - apagar ou renomear um card só quando ele está vazio;
     - cada caixa tem os seus cards. Por enquanto, só a financeiro@ (a
       secretaria@ é classificada pelo leitor, na conta dela).
   A proposta custa uma chamada à IA e sai no máximo uma vez por dia.
   ================================================================ */

var CXC_ABA = "Caixa_Categorias";
var CXC_COLUNAS = ["CHAVE", "CAIXA", "ROTULO", "ICONE", "DESCRICAO", "SITUACAO", "CRIADO_POR", "CRIADO_EM", "EXEMPLOS"];
var CXC_MIN_EMAILS = 4;
var CXC_CARREGADAS = false;

function cxcAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CXC_ABA);
  if (!sh) { sh = ss.insertSheet(CXC_ABA); sh.getRange(1, 1, 1, CXC_COLUNAS.length).setValues([CXC_COLUNAS]); }
  return sh;
}
function cxcLinhas_() {
  try {
    var sh = cxcAba_();
    if (sh.getLastRow() < 2) return [];
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = v[0].map(function (c) { return String(c || "").trim(); });
    return v.slice(1).map(function (l, i) {
      var o = { __linha: i + 2 };
      cab.forEach(function (n, j) { if (n) o[n] = l[j]; });
      return o;
    }).filter(function (o) { return o.CHAVE; });
  } catch (e) { return []; }
}

/* As categorias criadas pela equipe entram no mapa de tipos (CXS_TIPOS) e
   na descrição que a IA recebe. Uma vez por execução. */
/* Cards do sistema (03/11/2026: "renomear, excluir e criar outros cards"):
   o nome e a exclusão valem só na financeiro@ — a secretaria@ não muda.
   Nunca se excluem VOUCHER (fluxo próprio) e OUTRO (onde cai o resto). */
var CXC_SISTEMA_FIXOS = ["VOUCHER", "OUTRO"];
var CXC_ORIGINAIS = null;
function cxcCarregar_() {
  if (CXC_CARREGADAS) return;
  CXC_CARREGADAS = true;
  if (!CXC_ORIGINAIS) {
    CXC_ORIGINAIS = {};
    Object.keys(CXS_TIPOS).forEach(function (k) { if (!CXS_TIPOS[k].criada) CXC_ORIGINAIS[k] = true; });
  }
  Object.keys(CXC_ORIGINAIS).forEach(function (k) { if (CXS_TIPOS[k]) { delete CXS_TIPOS[k].rotuloFin; delete CXS_TIPOS[k].ocultoFin; } });
  cxcLinhas_().forEach(function (r) {
    var k = String(r.CHAVE || "");
    if (!k) return;
    var sit = String(r.SITUACAO);
    if (CXC_ORIGINAIS[k]) {
      if (sit === "RENOMEADA") CXS_TIPOS[k].rotuloFin = String(r.ROTULO);
      else if (sit === "OCULTA") CXS_TIPOS[k].ocultoFin = true;
      else if (sit === "RESTAURADA") { delete CXS_TIPOS[k].ocultoFin; }
      return;
    }
    if (sit === "ATIVA") {
      CXS_TIPOS[k] = { rotulo: cxcNomeLegivel_(r.ROTULO), curto: cxcNomeLegivel_(r.ROTULO), icone: String(r.ICONE || "📁"), modulo: "", caixa: String(r.CAIXA || "FINANCEIRO"), criada: true };
      CXS_TIPOS_DESC[k] = String(r.DESCRICAO || r.ROTULO);
    } else if (CXS_TIPOS[k] && CXS_TIPOS[k].criada) {
      delete CXS_TIPOS[k]; delete CXS_TIPOS_DESC[k];
    }
  });
}
function cxcRecarregar_() { CXC_CARREGADAS = false; cxcCarregar_(); }

/* Nome de card legível (03/11/2026: a IA devolveu "RELACAO_NOMINAL" e o
   card saiu com cara de código). Só mexe no que parece código. */
var CXC_ACENTOS = { relacao: "relação", funcionarios: "funcionários", contribuicao: "contribuição", contribuicoes: "contribuições",
  declaracao: "declaração", declaracoes: "declarações", negociacao: "negociação", notificacao: "notificação", filiacao: "filiação",
  rescisao: "rescisão", homologacao: "homologação", solicitacao: "solicitação", solicitacoes: "solicitações", guias: "guias" };
function cxcNomeLegivel_(rotulo) {
  var r = String(rotulo || "").trim();
  if (!/^[A-Z0-9_]+$/.test(r) || r.indexOf("_") === -1) return r;
  var p = r.toLowerCase().split("_").filter(String).map(function (w) { return CXC_ACENTOS[w] || w; }).join(" ");
  return p.charAt(0).toUpperCase() + p.slice(1);
}
function cxcChave_(rotulo) {
  var base = String(rotulo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return "C_" + (base || "CARD").substring(0, 30);
}
function cxcMesmoNome_(a, b) { return cxcChave_(a) === cxcChave_(b); }

/* Os e-mails da Entrada da financeiro@ com o tipo que vale hoje. */
function cxcItensFinanceiro_() {
  var est = cxsEstados_();
  return cxsLinhasFinanceiro_().map(function (p) {
    var r = cxsResumo_(p, est[String(p.THREAD_ID)], {});
    return { id: r.id, tipo: r.tipo, assunto: r.assunto, de: r.de, trecho: r.trecho };
  });
}

/** O que o robô propõe hoje (no máximo uma vez por dia; nunca cria sozinho). */
function caixaPropostasCards(tokenSessao) {
  try {
    cxpExigirFinanceiro_(tokenSessao);
    cxcCarregar_();
    var props = PropertiesService.getScriptProperties();
    var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
    var guardado = vpeJson_(props.getProperty("CXC_PROPOSTA_FIN"), null);
    var propostas;
    if (guardado && guardado.dia === hoje) propostas = guardado.propostas || [];
    else {
      propostas = cxcPerguntarIA_();
      props.setProperty("CXC_PROPOSTA_FIN", JSON.stringify({ dia: hoje, propostas: propostas }));
    }
    /* O que já foi criado ou recusado não volta. */
    var ja = cxcLinhas_().map(function (r) { return String(r.ROTULO); }).concat(Object.keys(CXS_TIPOS).map(function (k) { return CXS_TIPOS[k].rotulo; }));
    var itens = cxcItensFinanceiro_(), porId = {};
    itens.forEach(function (i) { porId[i.id] = i; });
    propostas = propostas.filter(function (p) { return !ja.some(function (n) { return cxcMesmoNome_(n, p.rotulo); }); })
      .map(function (p) {
        var ids = (p.ids || []).filter(function (id) { return porId[id] && porId[id].tipo !== cxcChave_(p.rotulo); });
        return { rotulo: p.rotulo, icone: p.icone || "📁", descricao: p.descricao || "", ids: ids,
                 exemplos: ids.slice(0, 3).map(function (id) { return porId[id].assunto; }) };
      })
      .filter(function (p) { return p.ids.length >= CXC_MIN_EMAILS; });
    return { ok: true, propostas: propostas.slice(0, 2) };
  } catch (err) {
    return { ok: false, mensagem: err.message, propostas: [] };
  }
}

function cxcPerguntarIA_() {
  var itens = cxcItensFinanceiro_();
  if (itens.length < CXC_MIN_EMAILS) return [];
  var lista = itens.slice(0, 120).map(function (i) {
    return i.id + " | CARD ATUAL: " + i.tipo + " | ASSUNTO: " + String(i.assunto).substring(0, 100) + " | " + String(i.trecho).substring(0, 120);
  }).join("\n");
  var prompt = "Você ajuda a organizar a caixa de e-mails do FINANCEIRO de um sindicato de trabalhadores da educação. " +
    "Os e-mails já estão em cards: " + Object.keys(CXS_TIPOS_DESC).filter(function (k) { return CXS_TIPOS[k] && !CXS_TIPOS[k].ocultoFin; })
      .map(function (k) { return k + " = " + CXS_TIPOS_DESC[k]; }).join("; ") + ".\n" +
    "Veja se existe um ASSUNTO QUE SE REPETE (pelo menos " + CXC_MIN_EMAILS + " e-mails do mesmo tipo de pedido) que hoje está " +
    "misturado num card maior ou em OUTRO, e que mereceria um card só dele. Não proponha o que já existe nem algo genérico. " +
    "Se não houver, devolva lista vazia. Proponha no máximo 2.\n" +
    "Responda SOMENTE com JSON: {\"propostas\":[{\"rotulo\":\"nome curto do card, em português com acentos, ex.: Relação nominal\",\"icone\":\"um emoji\"," +
    "\"descricao\":\"o que entra neste card, para classificar os próximos\",\"ids\":[\"F:...\"]}]}\n\nE-MAILS:\n" + lista;
  try {
    var r = vpeChamarIA_(prompt);
    return ((r && r.propostas) || []).filter(function (p) { return p && p.rotulo && Array.isArray(p.ids); }).map(function (p) {
      return { rotulo: cxcNomeLegivel_(String(p.rotulo)).substring(0, 40), icone: String(p.icone || "📁").substring(0, 4),
               descricao: String(p.descricao || "").substring(0, 300), ids: p.ids.map(String) };
    });
  } catch (e) { Logger.log("Cards: a IA não propôs agora — " + e.message); return []; }
}

/** A pessoa aceitou: cria o card e leva os e-mails da proposta para ele. */
function caixaCriarCard(proposta, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    cxcCarregar_();
    proposta = proposta || {};
    var rotulo = cxcNomeLegivel_(String(proposta.rotulo || "")).substring(0, 40);
    if (rotulo.length < 3) return { ok: false, mensagem: "Dê um nome ao card." };
    var chave = cxcChave_(rotulo);
    if (Object.keys(CXS_TIPOS).some(function (k) { return k === chave || cxcMesmoNome_(CXS_TIPOS[k].rotulo, rotulo); })) {
      return { ok: false, mensagem: "Já existe um card com esse nome." };
    }
    var quem = sessao.email || sessao.usuario || "";
    var sh = cxcAba_();
    var reg = { CHAVE: chave, CAIXA: "FINANCEIRO", ROTULO: rotulo, ICONE: String(proposta.icone || "📁").substring(0, 4),
                DESCRICAO: String(proposta.descricao || rotulo).substring(0, 300), SITUACAO: "ATIVA", CRIADO_POR: quem,
                CRIADO_EM: new Date(), EXEMPLOS: JSON.stringify((proposta.ids || []).slice(0, 20)) };
    /* Linha nova sempre (a última de cada chave é a que vale): o histórico
       de criado/recusado/apagado fica na aba. */
    sh.appendRow(CXC_COLUNAS.map(function (c) { return reg[c]; }));
    cxcRecarregar_();
    var levados = 0;
    (proposta.ids || []).map(String).filter(cxsEhFinanceiro_).forEach(function (id) {
      var r = caixaSecretariaReclassificar(id, chave, tokenSessao);
      if (r && r.ok) levados++;
    });
    cxsAuditar_("CARD_CRIADO", chave, "Card \"" + rotulo + "\" criado; " + levados + " e-mail(s) levados para ele", sessao);
    roboMemoriaRegistrar_({ tarefa: "card-proposto", origem: "FINANCEIRO", chave: chave, assunto: rotulo,
      sugerido: rotulo, decidido: rotulo, quem: quem });
    try { CacheService.getScriptCache().remove("cxs_fin_lista_v1"); } catch (e) {}
    return { ok: true, chave: chave, mensagem: "Card \"" + rotulo + "\" criado, com " + levados + " e-mail(s). O robô passa a usar." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** A pessoa disse "Não": não propõe de novo. */
function caixaRecusarCard(proposta, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    var rotulo = String((proposta && proposta.rotulo) || "").trim().substring(0, 40);
    if (!rotulo) return { ok: false, mensagem: "Proposta inválida." };
    cxcAba_().appendRow(CXC_COLUNAS.map(function (c) {
      return { CHAVE: cxcChave_(rotulo), CAIXA: "FINANCEIRO", ROTULO: rotulo, ICONE: "", DESCRICAO: "", SITUACAO: "RECUSADA",
               CRIADO_POR: sessao.email || sessao.usuario || "", CRIADO_EM: new Date(), EXEMPLOS: "" }[c];
    }));
    roboMemoriaRegistrar_({ tarefa: "card-proposto", origem: "FINANCEIRO", chave: cxcChave_(rotulo), assunto: rotulo,
      sugerido: rotulo, decidido: "RECUSADO", quem: sessao.email || "" });
    return { ok: true, mensagem: "Certo — o robô não propõe esse card de novo." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Os cards criados pela equipe, com quantos e-mails cada um tem. */
/** Todos os cards da financeiro@ (do sistema e criados), com quantos e-mails têm. */
function caixaCardsCriados(tokenSessao) {
  try {
    cxpExigirFinanceiro_(tokenSessao);
    cxcCarregar_();
    var itens = cxcItensFinanceiro_();
    var cards = Object.keys(CXS_TIPOS).filter(function (k) {
      return k !== "VOUCHER" && (!CXS_TIPOS[k].caixa || CXS_TIPOS[k].caixa === "FINANCEIRO");
    }).map(function (k) {
      return { chave: k, rotulo: CXS_TIPOS[k].rotuloFin || CXS_TIPOS[k].rotulo, icone: CXS_TIPOS[k].icone,
               sistema: !CXS_TIPOS[k].criada, excluido: !!CXS_TIPOS[k].ocultoFin, fixo: CXC_SISTEMA_FIXOS.indexOf(k) > -1,
               emails: itens.filter(function (i) { return i.tipo === k; }).length };
    });
    return { ok: true, cards: cards };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Renomear ou apagar um card criado — só quando ele está vazio. */
function caixaAlterarCard(chave, acao, novoNome, tokenSessao) {
  try {
    var sessao = cxpExigirFinanceiro_(tokenSessao);
    cxcCarregar_();
    chave = String(chave || "");
    acao = String(acao || "").toUpperCase();
    if (!CXS_TIPOS[chave] || chave === "VOUCHER") return { ok: false, mensagem: "Card não encontrado." };
    var t = CXS_TIPOS[chave], quem = sessao.email || sessao.usuario || "";
    var linhaSis = function (sit, rot) {
      cxcAba_().appendRow(CXC_COLUNAS.map(function (c) {
        return { CHAVE: chave, CAIXA: "FINANCEIRO", ROTULO: rot || "", ICONE: "", DESCRICAO: "", SITUACAO: sit,
                 CRIADO_POR: quem, CRIADO_EM: new Date(), EXEMPLOS: "" }[c];
      }));
      cxcRecarregar_();
    };
    if (!t.criada && acao === "RESTAURAR") {
      linhaSis("RESTAURADA", "");
      cxsAuditar_("CARD_RESTAURADO", chave, "Card \"" + t.rotulo + "\" de volta", sessao);
      return { ok: true, mensagem: "Card \"" + (t.rotuloFin || t.rotulo) + "\" de volta." };
    }
    if (acao === "APAGAR" || acao === "APAGAR_CONFIRMADO") {
      if (!t.criada && CXC_SISTEMA_FIXOS.indexOf(chave) > -1) return { ok: false, mensagem: "Este card não se exclui: é onde cai o que não tem outro lugar." };
      var n = cxcItensFinanceiro_().filter(function (i) { return i.tipo === chave; }).length;
      if (n > 0) return { ok: false, mensagem: "O card \"" + (t.rotuloFin || t.rotulo) + "\" tem " + n + " e-mail(s). Só dá para excluir com ele vazio — arraste os e-mails para outro card antes." };
      if (acao !== "APAGAR_CONFIRMADO") return { ok: false, precisaConfirmar: true,
        mensagem: "Excluir o card \"" + (t.rotuloFin || t.rotulo) + "\"? Ele está vazio. O robô deixa de usar esta categoria na financeiro@" +
          (t.criada ? "." : " (dá para trazer de volta em ⚙ Cards).") };
      if (!t.criada) {
        linhaSis("OCULTA", "");
        cxsAuditar_("CARD_EXCLUIDO", chave, "Card do sistema \"" + t.rotulo + "\" excluído da financeiro@ (estava vazio)", sessao);
        return { ok: true, mensagem: "Card \"" + (t.rotuloFin || t.rotulo) + "\" excluído." };
      }
    }
    if (acao === "RENOMEAR" && !t.criada) {
      var nm = String(novoNome || "").trim().substring(0, 40);
      if (nm.length < 3) return { ok: false, mensagem: "Dê um nome ao card." };
      linhaSis("RENOMEADA", nm);
      cxsAuditar_("CARD_RENOMEADO", chave, "\"" + (t.rotuloFin || t.rotulo) + "\" → \"" + nm + "\" (financeiro@)", sessao);
      return { ok: true, mensagem: "Card renomeado para \"" + nm + "\"." };
    }
    var linha = cxcLinhas_().filter(function (r) { return String(r.CHAVE) === chave && String(r.SITUACAO) === "ATIVA"; })[0];
    if (!linha) return { ok: false, mensagem: "Card não encontrado." };
    var sh = cxcAba_();
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var dados = sh.getDataRange().getValues();
    var nLinha = -1;
    for (var i = 1; i < dados.length; i++) if (String(dados[i][cab.indexOf("CHAVE")]) === chave && String(dados[i][cab.indexOf("SITUACAO")]) === "ATIVA") nLinha = i + 1;
    if (acao === "APAGAR_CONFIRMADO") {
      sh.getRange(nLinha, cab.indexOf("SITUACAO") + 1).setValue("APAGADA");
      cxsAuditar_("CARD_APAGADO", chave, "Card \"" + linha.ROTULO + "\" apagado (estava vazio)", sessao);
      cxcRecarregar_();
      return { ok: true, mensagem: "Card \"" + linha.ROTULO + "\" apagado." };
    }
    var nome = String(novoNome || "").trim().substring(0, 40);
    if (nome.length < 3) return { ok: false, mensagem: "Dê um nome ao card." };
    sh.getRange(nLinha, cab.indexOf("ROTULO") + 1).setValue(nome);
    cxsAuditar_("CARD_RENOMEADO", chave, "\"" + linha.ROTULO + "\" → \"" + nome + "\"", sessao);
    cxcRecarregar_();
    return { ok: true, mensagem: "Card renomeado para \"" + nome + "\"." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
