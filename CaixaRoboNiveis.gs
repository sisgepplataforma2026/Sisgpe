/* ================================================================
   O ROBÔ SOBE DE NÍVEL — "E-MAIL QUE NÃO PEDE NADA" (09/11/2026)
   ================================================================
   O usuário: "Preciso que comece a entender e a fazer as tarefas";
   "automatizar o serviço"; "que ele aprende e vai fazendo sozinho quando
   tiver alta [taxa] de aprovação"; e, sobre o que sai: "eu aprovo sempre
   antes de sair, assim vou vendo se está fazendo certo".

   Diretriz do projeto (CLAUDE.md, "O ROBÔ É UM FUNCIONÁRIO QUE APRENDE"):
     1. Registrar  2. Usar  3. Medir  4. Subir de nível só com o usuário.

   O que este arquivo faz:
     A. MEDIÇÃO DA CATEGORIA CERTA — antes, só a CORREÇÃO de card era
        anotada (o acerto nunca aparecia). Agora, quando a pessoa trata o
        e-mail sem mudar o card (responde, encaminha, emite, resolve), conta
        como acerto (tarefa "categoria-email", uma vez por conversa).
     B. "NÃO PEDE NADA" — "Obrigado!", "Recebido", resposta automática de
        férias. O robô aponta; quando a pessoa resolve sem responder, é
        acerto; quando responde/encaminha, é erro (tarefa "nada-a-fazer").
        Com 50 decisões, 95% de acerto e as últimas 20 certas, ele PROPÕE
        resolver sozinho. Só administrador liga, por caixa. Ligado, ele
        marca como resolvido com "🤖 Resolvido pelo robô · Desfazer".
        Desfazer conta como erro; abaixo de 90% nas últimas 20, ele se
        desliga sozinho e avisa.
   O que ele NUNCA faz: responder, encaminhar, emitir, apagar, mover no
   Gmail. Só muda a situação do e-mail dentro do SISGEP (dá para desfazer).
   ================================================================ */

var CRN_QUEM = "ROBÔ";
var CRN_TAREFA = "nada-a-fazer";
var CRN_PROP = "CRN_NIVEIS";
var CRN_MIN = 50;          // decisões para propor
var CRN_PCT = 95;          // acerto para propor
var CRN_SEQ = 20;          // as últimas N sem erro
var CRN_DESLIGA = 90;      // abaixo disto (últimas 20), desliga sozinho
var CRN_DIAS = 90;
var CRN_TAREFAS = { "nada-a-fazer": "E-mail que não pede nada" };

var CRN_AUTO = /(resposta autom[aá]tica|automatic reply|auto[- ]?reply|out of office|fora do escrit[oó]rio|estarei ausente|estou ausente|estarei de f[eé]rias|estou de f[eé]rias|aus[eê]ncia tempor)/i;
var CRN_CURTO = /^(ol[aá][,!.\s]*|oi[,!.\s]*|bom dia[,!.\s]*|boa tarde[,!.\s]*|boa noite[,!.\s]*)*(muit[oa]s?\s+)?(obrigad[oa]s?|grat[oa]s?|agrade[cç]o|agradecemos|ok|okay|recebid[oa]s?|recebi|recebemos|ciente|de acordo|perfeito|certo|beleza|valeu|combinado|tudo certo)\b/i;
var CRN_PEDE = /\?|por favor|favor\b|poderi|preciso|precisamos|gostari|segue|anexo|quando\b|como\b|qual\b|porém|porem|\bmas\b|aguardo|pendente|urgente|d[uú]vida/i;

/** O e-mail não pede nada? Devolve o motivo ("" quando pede). Olha só a
    última mensagem de fora; anexo nela = pede (pode ser documento). */
function crnNadaAFazer_(p) {
  try {
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var ultima = msgs[msgs.length - 1];
    if (!ultima || CXS_NOSSOS.indexOf(cxsEmail_(ultima.de)) > -1) return "";
    var anexos = vpeJson_(p.ANEXOS_JSON, []);
    if (anexos.some(function (a) { return !a.msgId || String(a.msgId) === String(ultima.id); })) return "";
    var assunto = String(ultima.assunto || "");
    var corpo = String(ultima.corpo || "");
    if (typeof vpeSemCitacao_ === "function") corpo = vpeSemCitacao_(corpo);
    if (CRN_AUTO.test(assunto) || CRN_AUTO.test(corpo.substring(0, 400))) return "resposta automática";
    var t = corpo.replace(/\s+/g, " ").trim();
    /* tira a assinatura comum ("--", "Att", "Atenciosamente") */
    t = t.split(/\s(--|att\.?|atenciosamente|abra[cç]os?|cordialmente)\b/i)[0].trim();
    if (!t || t.length > 160) return "";
    if (!CRN_CURTO.test(t) || CRN_PEDE.test(t)) return "";
    return "só agradecimento ou confirmação";
  } catch (e) { return ""; }
}

/* ── níveis (por tarefa e caixa), guardados nas propriedades do script ── */
function crnNiveis_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CRN_PROP) || "{}"); } catch (e) { return {}; }
}
function crnGravarNiveis_(m) { PropertiesService.getScriptProperties().setProperty(CRN_PROP, JSON.stringify(m)); }
function crnLigado_(tarefa, caixa) { var n = crnNiveis_()[tarefa + "|" + caixa]; return !!(n && n.ligado); }

/* ── a memória ── */
var CRN_CACHE = null;
function crnLinhas_() {
  if (CRN_CACHE) return CRN_CACHE;
  var out = [];
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), c = v[0].map(String);
    for (var l = 1; l < v.length; l++) {
      out.push({ linha: l + 1, em: v[l][c.indexOf("EM")], tarefa: String(v[l][c.indexOf("TAREFA")]), origem: String(v[l][c.indexOf("ORIGEM")]),
                 chave: String(v[l][c.indexOf("CHAVE")]), sugerido: String(v[l][c.indexOf("SUGERIDO")]),
                 acertou: String(v[l][c.indexOf("ACERTOU")]), quem: String(v[l][c.indexOf("QUEM")]) });
    }
  }
  CRN_CACHE = out;
  return out;
}
function crnRegistrar_(o) { CRN_CACHE = null; return roboMemoriaRegistrar_(o); }
function crnJa_(tarefa, chave) { return crnLinhas_().some(function (r) { return r.tarefa === tarefa && r.chave === chave; }); }

/** Números de uma tarefa numa caixa (90 dias, só onde o robô sugeriu). */
function crnNumeros_(tarefa, caixa) {
  var desde = Date.now() - CRN_DIAS * 86400000;
  var rs = crnLinhas_().filter(function (r) {
    var em = r.em instanceof Date ? r.em.getTime() : new Date(r.em).getTime();
    return r.tarefa === tarefa && r.origem === caixa && r.sugerido && (!em || em >= desde);
  });
  var n = rs.length, ok = rs.filter(function (r) { return r.acertou === "SIM"; }).length;
  var seq = 0;
  for (var i = rs.length - 1; i >= 0 && rs[i].acertou === "SIM"; i--) seq++;
  var ult = rs.slice(-CRN_SEQ), ok20 = ult.filter(function (r) { return r.acertou === "SIM"; }).length;
  return { n: n, pct: n ? Math.round(100 * ok / n) : 0, seq: seq, pct20: ult.length ? Math.round(100 * ok20 / ult.length) : 0, n20: ult.length };
}
function crnPodePropor_(x) { return x.n >= CRN_MIN && x.pct >= CRN_PCT && x.seq >= CRN_SEQ; }

/** A pessoa tratou o e-mail (acao "RESOLVER" = resolveu sem responder;
    "TRATAR" = respondeu, encaminhou, emitiu). Nunca derruba a ação. */
function crnTratou_(id, p, acao, sessao) {
  try {
    if (!p || !id) return;
    var est = cxsEstados_()[String(id)] || {};
    var caixa = String(p.CAIXA || "SECRETARIA");
    var quem = (sessao && (sessao.email || sessao.usuario)) || "";
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var de = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; })[0] || msgs[0] || {};
    /* A. a categoria estava certa (sem remetente: não vira "regra" do remetente) */
    if (!est.TIPO_CORRIGIDO && !crnJa_("categoria-email", String(id))) {
      var tipo = cxsTipoDoEmail_(p, null);
      crnRegistrar_({ tarefa: "categoria-email", origem: caixa, chave: String(id), remetente: "", assunto: de.assunto,
        sugerido: tipo, decidido: tipo, quem: quem });
    }
    /* B. o "não pede nada" */
    var motivo = crnNadaAFazer_(p);
    var chave = String(id) + "|" + String(p.ULTIMA_MENSAGEM_ID || "");
    if (motivo && !crnJa_(CRN_TAREFA, chave)) {
      crnRegistrar_({ tarefa: CRN_TAREFA, origem: caixa, chave: chave, remetente: cxsEmail_(de.replyTo || de.de), assunto: de.assunto,
        trecho: motivo, sugerido: "RESOLVER", decidido: acao === "RESOLVER" ? "RESOLVER" : "TRATAR", quem: quem });
    }
  } catch (e) { Logger.log("Robô (tratou): " + e.message); }
}

/** Na lista: aponta o que não pede nada e, se ligado, resolve sozinho. */
function crnAplicar_(pares) {
  var niveis = crnNiveis_();
  pares.forEach(function (x) {
    var p = x.p, r = x.r, est = x.est || {};
    try {
      if (est.DECIDIDO_POR === CRN_QUEM && r.estado === CXS_ESTADOS.RESOLVIDO) {
        r.roboResolveu = String(est.NOTA || "").replace(/^🤖 Resolvido pelo robô:\s*/, "") || "não pede nada";
        return;
      }
      if (r.estado !== CXS_ESTADOS.NOVO) return;
      var motivo = crnNadaAFazer_(p);
      if (!motivo) return;
      r.roboNada = motivo;
      var n = niveis[CRN_TAREFA + "|" + r.caixa];
      if (!(n && n.ligado)) return;
      var id = String(p.THREAD_ID);
      /* Já decidido para esta mensagem (uma pessoa desfez, ou já tratou):
         o robô não mexe de novo — só a mensagem nova seguinte é dele. */
      if (crnJa_(CRN_TAREFA, id + "|" + String(p.ULTIMA_MENSAGEM_ID || ""))) return;
      cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID),
        NOTA: "🤖 Resolvido pelo robô: " + motivo }, CRN_QUEM);
      cxsAuditar_("ROBO_RESOLVEU", id, motivo, { usuario: CRN_QUEM, email: CRN_QUEM });
      var msgs = vpeJson_(p.MENSAGENS_JSON, []), u = msgs[msgs.length - 1] || {};
      crnRegistrar_({ tarefa: CRN_TAREFA, origem: r.caixa, chave: id + "|" + String(p.ULTIMA_MENSAGEM_ID || ""),
        remetente: cxsEmail_(u.replyTo || u.de), assunto: u.assunto, trecho: motivo, sugerido: "RESOLVER", decidido: "RESOLVER", quem: CRN_QUEM });
      r.estado = CXS_ESTADOS.RESOLVIDO; r.decididoPor = CRN_QUEM; r.roboResolveu = motivo; delete r.roboNada;
    } catch (e) { Logger.log("Robô (aplicar): " + e.message); }
  });
}

/** O que o robô resolveu e alguém voltou: conta como erro e confere se desliga. */
function crnDesfeito_(id, p, sessao) {
  var caixa = String((p && p.CAIXA) || "SECRETARIA");
  try {
    var prefixo = String(id) + "|";
    var alvo = crnLinhas_().filter(function (r) { return r.tarefa === CRN_TAREFA && r.quem === CRN_QUEM && r.chave.indexOf(prefixo) === 0; }).pop();
    if (alvo) {
      var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
      var c = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      sh.getRange(alvo.linha, c.indexOf("DECIDIDO") + 1).setValue("TRATAR");
      sh.getRange(alvo.linha, c.indexOf("ACERTOU") + 1).setValue("NAO");
      CRN_CACHE = null;
    }
  } catch (e) { Logger.log("Robô (desfeito): " + e.message); }
  return crnTalvezDesligar_(CRN_TAREFA, caixa);
}
function crnTalvezDesligar_(tarefa, caixa) {
  var m = crnNiveis_(), k = tarefa + "|" + caixa;
  if (!(m[k] && m[k].ligado)) return "";
  var x = crnNumeros_(tarefa, caixa);
  if (x.n20 >= 5 && x.pct20 < CRN_DESLIGA) {
    var errou = Math.round(x.n20 * (100 - x.pct20) / 100);
    m[k] = { ligado: false, aviso: "Voltei a só sugerir em \"" + CRN_TAREFAS[tarefa] + "\": errei " + errou + " das últimas " + x.n20 + ".",
             em: new Date().toISOString(), por: CRN_QUEM };
    crnGravarNiveis_(m);
    return m[k].aviso;
  }
  return "";
}

/* ═══════════════ O QUE A TELA CHAMA ═══════════════ */

/** O painel "o que o robô já sabe fazer" (rodapé da Caixa). */
function caixaRoboNiveis(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var m = crnNiveis_(), out = [];
    ["SECRETARIA", "FINANCEIRO"].forEach(function (caixa) {
      if (!cxsPodeCaixa_(sessao, caixa)) return;
      Object.keys(CRN_TAREFAS).forEach(function (t) {
        var x = crnNumeros_(t, caixa), n = m[t + "|" + caixa] || {};
        var falta = [];
        if (x.n < CRN_MIN) falta.push((CRN_MIN - x.n) + " decisões");
        if (x.pct < CRN_PCT) falta.push("acerto de " + CRN_PCT + "% (está em " + x.pct + "%)");
        if (x.seq < CRN_SEQ) falta.push(CRN_SEQ + " acertos seguidos (está em " + x.seq + ")");
        out.push({ tarefa: t, rotulo: CRN_TAREFAS[t], caixa: caixa, n: x.n, pct: x.pct, seq: x.seq, ligado: !!n.ligado,
                   podePropor: crnPodePropor_(x), falta: falta.join(", "), aviso: n.ligado ? "" : String(n.aviso || ""),
                   ligadoPor: n.ligado ? String(n.por || "") : "", podeLigar: crcPodeLigar_(sessao) });
      });
    });
    return { ok: true, tarefas: out, regra: { min: CRN_MIN, pct: CRN_PCT, seq: CRN_SEQ, desliga: CRN_DESLIGA } };
  } catch (e) {
    return { ok: false, mensagem: e.message, tarefas: [] };
  }
}

/** Ligar/desligar (só administrador, na caixa que ele vê). Ligar só depois
    de o robô cumprir a regra — quem decide é a pessoa, não o robô. */
function caixaRoboNivelLigar(tarefa, caixa, ligar, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    if (!crcPodeLigar_(sessao)) return { ok: false, mensagem: "Só administrador liga ou desliga o robô." };
    caixa = String(caixa || "").toUpperCase();
    if (!CRN_TAREFAS[tarefa] || ["SECRETARIA", "FINANCEIRO"].indexOf(caixa) === -1) return { ok: false, mensagem: "Tarefa inválida." };
    if (!cxsPodeCaixa_(sessao, caixa)) return { ok: false, mensagem: "Esta caixa não é a sua." };
    var x = crnNumeros_(tarefa, caixa);
    if (ligar === true && !crnPodePropor_(x)) {
      return { ok: false, mensagem: "Ainda não: o robô precisa de " + CRN_MIN + " decisões, " + CRN_PCT + "% de acerto e " + CRN_SEQ + " acertos seguidos." };
    }
    var m = crnNiveis_(), quem = sessao.email || sessao.usuario || "";
    m[tarefa + "|" + caixa] = { ligado: ligar === true, por: quem, em: new Date().toISOString(), aviso: "" };
    crnGravarNiveis_(m);
    cxsAuditar_(ligar === true ? "ROBO_LIGOU" : "ROBO_DESLIGOU", tarefa + "|" + caixa, CRN_TAREFAS[tarefa] + " · " + x.pct + "% em " + x.n, sessao);
    roboMemoriaRegistrar_({ tarefa: "robo-nivel", origem: caixa, chave: tarefa, sugerido: "", decidido: ligar === true ? "LIGOU" : "DESLIGOU", quem: quem });
    return { ok: true, mensagem: ligar === true ? "Ligado: o robô passa a resolver sozinho \"" + CRN_TAREFAS[tarefa] + "\" — sempre com Desfazer." :
      "Desligado: o robô volta a só sugerir." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** "Desfazer" no e-mail que o robô resolveu: volta para novos e ensina. */
function caixaRoboDesfazer(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    cxsExigirCaixaDe_(sessao, id);
    var est = cxsEstados_()[String(id)];
    if (!est || est.DECIDIDO_POR !== CRN_QUEM || String(est.ESTADO) !== CXS_ESTADOS.RESOLVIDO) {
      return { ok: false, mensagem: "Este e-mail não foi resolvido pelo robô." };
    }
    var p = cxsLinhaPonte_(id);
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.NOVO, NOTA: "" }, sessao.email || sessao.usuario || "");
    cxsAuditar_("ROBO_DESFEITO", id, "Voltou para novos", sessao);
    var aviso = crnDesfeito_(id, p || { CAIXA: cxsEhFinanceiro_(id) ? "FINANCEIRO" : "SECRETARIA" }, sessao);
    return { ok: true, mensagem: "Voltou para os novos. O robô anotou o erro." + (aviso ? " " + aviso : "") };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
