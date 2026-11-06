/* ================================================================
   InicioExecutivo.gs — O DASHBOARD EXECUTIVO DA PÁGINA INICIAL (fase 1)

   Pedido e decisões do usuário (05–06/11/2026):
   - "Eu preciso de uma imagem do sistema que quem olhe fique impactado,
     que seja funcional ... me mostra tudo o que eu preciso saber: o que
     está pendente, chegou e-mail, tem ofício pendente, tem nota fiscal
     pendente, tem guias sindicais ... você precisa resolver isso."
   - "Esse painel deveria cobrir o sindicato inteiro."
   - Só 2 usuários, Wanderson e Marcela, os dois administradores. A única
     diferença é a caixa de e-mail de cada um (regra de 31/10).
   - O SISGEP não trabalha com boleto: só prepara as guias sindicais (a guia
     é gerada no Condomob). O pagamento do China Park também não passa pelo
     sistema. Nada disso aparece aqui.
   - Sem sino ("não tem necessidade").
   - Sem a festa: o controle do Compasso da Vida não é feito pelo SISGEP
     este ano (06/11/2026).
   Desenho e fontes: docs/PRODUTO-DASHBOARD-EXECUTIVO.md.

   REGRAS DESTE ARQUIVO
   - Cada fonte roda isolada (iex_fonte_). Fonte que falha vira
     "indisponível" e o item SOME da tela — nunca vira zero, nunca vira
     número inventado (mesmo contrato de InicioResumo.gs).
   - Só leitura. Nada aqui envia, grava ou muda estado.
   - Cada número leva a uma ação: `acao` = { mod, opts, aba } — a tela abre
     o módulo e, se houver `aba`, a aba certa dentro dele.
   ================================================================ */

/** Fonte isolada: { ok:true, v } ou { ok:false, erro }. */
function iex_fonte_(nome, fn, falhas) {
  try { return { ok: true, v: fn() }; }
  catch (e) { falhas.push(nome); Logger.log("[Painel] fonte " + nome + " falhou: " + e.message); return { ok: false, erro: e.message }; }
}

function iex_inteiro_(n) { n = Number(n); return isFinite(n) && n > 0 ? Math.round(n) : 0; }

/* POR PARTES — 06/11/2026. Na homologação a Home ficou em "Carregando…": numa
   chamada só, as fontes rodavam uma depois da outra (a leitura da caixa de
   e-mail entre elas) e o painel inteiro esperava a mais lenta. Agora a tela
   pede os grupos AO MESMO TEMPO e desenha cada um quando ele chega. Sem
   `grupo`, roda tudo (é o que o teste usa). */
var IEX_GRUPOS = ["caixa", "oficios", "financeiro", "cadastros"];

/* GUARDA DE 3 MINUTOS (06/11/2026): na HML cada parte levou minutos. O
   resultado de cada grupo fica 3 min no CacheService, por pessoa; a tela diz
   o horário da leitura e tem "Atualizar" (forcar=true) para ler de novo. */
var IEX_CACHE_SEG = 180;

/** O painel (ou um grupo dele: "caixa" · "oficios" · "financeiro" · "cadastros"). */
function getPainelExecutivoSISGEP(tokenSessao, grupo, forcar) {
  var t0 = Date.now();
  var sessaoC = exigirSessaoDocumentos_(tokenSessao, false);
  var gC = IEX_GRUPOS.indexOf(String(grupo || "")) > -1 ? String(grupo) : "";
  /* A guarda é por LOGIN (usuário), não por e-mail: dois logins com o mesmo
     e-mail no cadastro não podem ver o painel um do outro (06/11/2026). */
  var chave = "iex_" + String(sessaoC.usuario || sessaoC.email || "").replace(/[^\w]/g, "").slice(0, 60) + "_" + (gC || "todos");
  var cache = null;
  try { cache = CacheService.getScriptCache(); if (!forcar) { var c0 = cache.get(chave); if (c0) { var r0 = JSON.parse(c0); r0.doCache = true; return r0; } } } catch (e0) {}
  var r = iex_montar_(tokenSessao, gC);
  r.ms = Date.now() - t0;
  try { if (cache) cache.put(chave, JSON.stringify(r), IEX_CACHE_SEG); } catch (e1) {}
  return r;
}

function iex_montar_(tokenSessao, grupo) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var falhas = [];
  var F = {};
  grupo = IEX_GRUPOS.indexOf(String(grupo || "")) > -1 ? String(grupo) : "";
  var quer = function (gr) { return !grupo || grupo === gr; };

  if (quer("caixa")) F.emails = iex_fonte_("e-mails", function () {
    var r = caixaResumoDoDia(tokenSessao);
    if (!r || !r.ok) throw new Error((r && r.mensagem) || "caixa indisponível");
    return { aTratar: iex_inteiro_(r.aTratar), novosHoje: iex_inteiro_(r.novosHoje), caixa: String(r.caixa || ""),
             bolsas: r.voucher ? iex_inteiro_(r.voucher.aConferir) : null,
             recentes: (r.precisa || []).slice(0, 3) };
  }, falhas);

  /* Bolsas: os pedidos de voucher chegam na secretaria@. Lidos direto da fila
     de pedidos (não da caixa de quem está logado), porque o painel é do
     sindicato inteiro — no Wanderson, pela caixa dele, não apareciam (HML,
     06/11/2026). */
  if (quer("caixa")) F.bolsas = iex_fonte_("certificados de bolsa", function () {
    var r = voucherPedidosPainel("SECRETARIA", tokenSessao);
    if (!r || !r.ok) throw new Error((r && r.mensagem) || "pedidos de voucher indisponíveis");
    var c = r.contagens || {};
    return { conferir: iex_inteiro_((c.PRONTO || 0) + (c.FALTA_DOC || 0) + (c.NAO_ENCONTRADO || 0) + (c.PRECISA_VOCE || 0) + (c.PRESENCIAL || 0)),
             faltaDoc: iex_inteiro_(c.FALTA_DOC) };
  }, falhas);

  if (quer("oficios")) F.oficios = iex_fonte_("ofícios", function () {
    var r = getDashboardOficiosData({}, tokenSessao);
    if (!r || !r.resumo) throw new Error("monitoramento de ofícios indisponível");
    return { fila: iex_inteiro_(r.resumo.pendentes), erro: iex_inteiro_(r.resumo.erros), voltou: iex_inteiro_(r.resumo.falhas) };
  }, falhas);

  if (quer("oficios")) F.conferencia = iex_fonte_("conferência mensal", function () {
    var r = oficiosConferenciaMensal(tokenSessao);
    if (!r || !r.ok) throw new Error((r && r.mensagem) || "conferência indisponível");
    return iex_inteiro_((r.problemas || []).length);
  }, falhas);

  if (quer("oficios")) F.fichas = iex_fonte_("fichas do Drive", function () {
    return iex_inteiro_(ofdLinhas_().filter(function (o) { return ["NOVA", "LIDA"].indexOf(String(o.ESTADO)) > -1; }).length);
  }, falhas);

  if (quer("cadastros")) F.chinaPark = iex_fonte_("China Park", function () {
    var lista = listarReservasParqueChina({}, tokenSessao) || [];
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var em7 = new Date(hoje.getTime() + 7 * 864e5), ontem = Date.now() - 864e5;
    var aguardando = lista.filter(function (r) { return r.status === "PENDENTE"; });
    var semana = lista.filter(function (r) {
      if (r.status !== "APROVADA") return false;
      var e = new Date(r.dataEntrada); return !isNaN(e) && e >= hoje && e <= em7;
    });
    var novas = aguardando.filter(function (r) { var d = new Date(r.dataSolicitacao); return !isNaN(d) && d.getTime() >= ontem; })
      .slice(0, 2).map(function (r) { return { titulo: "Nova reserva China Park — " + String(r.nomeSolicitante || r.idReserva || ""), quando: new Date(r.dataSolicitacao).getTime() }; });
    return { aguardando: aguardando.length, semana: semana.length, novas: novas };
  }, falhas);

  if (quer("financeiro")) F.guias = iex_fonte_("guias sindicais", function () {
    var r = cob_listarPainel(tokenSessao);
    if (!r || !r.ok) throw new Error("cobrança de relação nominal indisponível");
    var lembretes = (r.linhas || []).filter(function (l) { return ["SOLICITADA", "LEMBRETE_1", "LEMBRETE_2"].indexOf(l.proximaAcao) > -1; }).length;
    return { pendentes: iex_inteiro_(r.pendentes), recebidas: iex_inteiro_(r.recebidas), total: iex_inteiro_(r.total), lembretes: lembretes, competencia: String(r.competenciaLabel || "") };
  }, falhas);

  if (quer("financeiro")) F.notas = iex_fonte_("notas fiscais", function () { return iex_inteiro_(inicio_contarNotasFiscaisAguardando_()); }, falhas);
  if (quer("cadastros")) F.escolas = iex_fonte_("cadastro de escolas", function () { return iex_inteiro_(inicio_contarEscolasCadastroIncompleto_(tokenSessao)); }, falhas);

  /* Festa: FORA do painel (06/11/2026) — "por esse ano ainda não está sendo
     realizada pelo SISGEP todo o controle da festa do Compasso da Vida". O
     painel não mostra o que o sistema não controla. */

  if (quer("caixa")) F.comprovantes = iex_fonte_("comprovantes", function () {
    var mapa = crcMapa_(), n = 0;
    Object.keys(mapa).forEach(function (k) { var r = mapa[k]; if (!r.CONFERIDO && String(r.STATUS) !== "FALHOU") n++; });
    return n;
  }, falhas);

  var v = function (f, padrao) { return f && f.ok ? f.v : padrao; };
  var em = v(F.emails, null), of = v(F.oficios, null), cp = v(F.chinaPark, null), gu = v(F.guias, null);
  var conf = v(F.conferencia, null), fic = v(F.fichas, null), nf = v(F.notas, null), esc = v(F.escolas, null);
  var comp = v(F.comprovantes, null), bo = v(F.bolsas, null), bol = bo ? bo.conferir : null;

  /* ── PRECISA DE VOCÊ AGORA ─ só entra o que tem número > 0 e fonte viva. */
  var OF = { mod: "documentos", opts: { sub: "oficios", aba: "monitoramento" } };
  var tarefas = [];
  var t = function (sev, area, n, texto, detalhe, botao, acao) { if (n > 0) tarefas.push({ sev: sev, area: area, n: n, texto: texto, detalhe: detalhe || "", botao: botao, acao: acao }); };
  if (of) {
    t("URGENTE", "OFÍCIOS", of.erro, of.erro + (of.erro === 1 ? " ofício deu erro no envio" : " ofícios deram erro no envio"), "reenviar pelo monitoramento", "Reenviar", OF);
    t("ATENCAO", "OFÍCIOS", of.voltou, of.voltou + (of.voltou === 1 ? " e-mail de ofício voltou" : " e-mails de ofício voltaram"), "e-mail da escola com problema", "Ver", OF);
    t("INFO", "OFÍCIOS", of.fila, of.fila + (of.fila === 1 ? " ofício na fila para sair" : " ofícios na fila para sair"), "a fila envia sozinha", "Acompanhar", OF);
  }
  if (em) t("ATENCAO", "E-MAILS", em.aTratar, em.aTratar + " e-mails a tratar na sua caixa", "", "Abrir caixa", { mod: "caixaSecretaria" });
  if (bol != null) t("ATENCAO", "BOLSAS", bol, bol + (bol === 1 ? " pedido de certificado para conferir" : " pedidos de certificado para conferir"), bo && bo.faltaDoc ? bo.faltaDoc + " com documento faltando" : "pedidos de voucher", "Conferir", { mod: "caixaSecretaria" });
  if (cp) t("ATENCAO", "CHINA PARK", cp.aguardando, cp.aguardando + (cp.aguardando === 1 ? " reserva aguardando aprovação" : " reservas aguardando aprovação"), "", "Aprovar", { mod: "beneficios", opts: { sub: "parqueChina" } });
  if (gu) {
    t("ATENCAO", "GUIAS", gu.lembretes, gu.lembretes + (gu.lembretes === 1 ? " lembrete de relação nominal para aprovar" : " lembretes de relação nominal para aprovar"), "sem a relação, a guia sindical não sai", "Revisar", { mod: "cobranca" });
    t("INFO", "GUIAS", gu.pendentes, gu.pendentes + (gu.pendentes === 1 ? " escola ainda não mandou a relação nominal" : " escolas ainda não mandaram a relação nominal"), gu.competencia ? "competência " + gu.competencia : "", "Ver escolas", { mod: "cobranca" });
  }
  if (conf != null) t("ATENCAO", "CONFERÊNCIA", conf, conf + (conf === 1 ? " escola não descontou o ofício" : " escolas não descontaram o ofício"), "conferência mensal", "Ver escolas", { mod: "documentos", opts: { sub: "oficios" }, aba: "#abaConferenciaMensal" });
  if (fic != null) t("INFO", "FICHAS", fic, fic + (fic === 1 ? " ficha nova no Drive para virar ofício" : " fichas novas no Drive para virar ofício"), "o robô lê e prepara", "Abrir", { mod: "documentos", opts: { sub: "oficios" }, aba: "#abaFichasDrive" });
  if (nf != null) t("INFO", "NOTAS", nf, nf + (nf === 1 ? " nota fiscal aguardando envio" : " notas fiscais aguardando envio"), "à contabilidade", "Enviar", { mod: "financeiro", opts: { acao: "nf" } });
  if (comp != null) t("INFO", "COMPROVANTES", comp, comp + (comp === 1 ? " comprovante lido pelo robô para conferir" : " comprovantes lidos pelo robô para conferir"), "", "Conferir", { mod: "caixaSecretaria" });
  if (esc != null) t("INFO", "ESCOLAS", esc, esc + (esc === 1 ? " escola com cadastro incompleto" : " escolas com cadastro incompleto"), "sem CNPJ válido ou sem e-mail", "Completar", { mod: "escolasPendencias" });
  var ordem = { URGENTE: 0, ATENCAO: 1, INFO: 2 };
  tarefas.sort(function (a, b) { return ordem[a.sev] - ordem[b.sev]; });

  /* ── INDICADORES ─ fonte morta vira null (a tela mostra "—"). */
  var urg = tarefas.filter(function (x) { return x.sev === "URGENTE"; }).reduce(function (s, x) { return s + x.n; }, 0);
  var kpis = [
    { grupo: "oficios", chave: "urgente", rotulo: "Urgente hoje", n: urg, sub: urg ? "precisa de você hoje" : "nada urgente", cor: "#f87171" },
    { grupo: "caixa", chave: "emails", rotulo: "E-mails a tratar", n: em ? em.aTratar : null, sub: "na sua caixa", cor: "#f59e0b", acao: { mod: "caixaSecretaria" } },
    { grupo: "oficios", chave: "oficios", rotulo: "Ofícios pendentes", n: of ? of.fila + of.erro + of.voltou : null, sub: of ? of.fila + " fila · " + of.erro + " erro · " + of.voltou + " voltaram" : "", cor: "#eab308", acao: OF },
    { grupo: "financeiro", chave: "guias", rotulo: "Guias sindicais", n: gu ? gu.pendentes : null, sub: gu ? "escolas sem relação nominal" : "", cor: "#22c55e", acao: { mod: "cobranca" } },
    { grupo: "financeiro", chave: "notas", rotulo: "Notas fiscais", n: nf, sub: "aguardando envio", cor: "#60a5fa", acao: { mod: "financeiro", opts: { acao: "nf" } } },
    { grupo: "", chave: "beneficios", rotulo: "Benefícios", n: (bol == null && !cp) ? null : (bol || 0) + (cp ? cp.aguardando : 0),
      sub: (bol != null ? bol + " bolsas" : "") + (bol != null && cp ? " · " : "") + (cp ? cp.aguardando + " China Park" : ""), cor: "#a78bfa", acao: { mod: "beneficios" } }
  ];

  /* Por grupo: só os indicadores daquele grupo. "Benefícios" junta bolsas
     (caixa) e China Park (cadastros): por partes, a tela soma os dois. */
  if (grupo) kpis = kpis.filter(function (k) { return k.grupo === grupo; });

  /* ── O SINDICATO POR ÁREA ─ área sem fonte viva não aparece. */
  var areas = [];
  var a = function (ok, ic, nome, sub, n, cor, acao) { if (ok) areas.push({ icone: ic, nome: nome, sub: sub, n: n, cor: cor, acao: acao }); };
  a(!!of, "📄", "Ofícios", "fila · erro · voltaram", of ? of.fila + of.erro + of.voltou : 0, "#eab308", OF);
  a(!!em, "✉️", "E-mails", em ? (em.caixa || "sua caixa") : "", em ? em.aTratar : 0, "#f59e0b", { mod: "caixaSecretaria" });
  a(!!gu, "💵", "Guias sindicais", "relação nominal", gu ? gu.pendentes : 0, "#22c55e", { mod: "cobranca" });
  a(nf != null, "🧾", "Notas fiscais", "à contabilidade", nf || 0, "#60a5fa", { mod: "financeiro", opts: { acao: "nf" } });
  a(bol != null, "🎓", "Certificados", "bolsas de estudo", bol || 0, "#a78bfa", { mod: "caixaSecretaria" });
  a(!!cp, "🏨", "China Park", cp ? cp.semana + (cp.semana === 1 ? " hospedagem na semana" : " hospedagens na semana") : "", cp ? cp.aguardando : 0, "#10b981", { mod: "beneficios", opts: { sub: "parqueChina" } });
  a(esc != null, "🏫", "Escolas", "cadastros incompletos", esc || 0, "#3b82f6", { mod: "escolasPendencias" });

  /* ── CHEGOU AGORA ─ e-mails que esperam você + reservas novas (24 h). */
  var chegou = [];
  (em ? em.recentes : []).forEach(function (r) { chegou.push({ icone: r.icone || "✉️", titulo: String(r.assunto || r.nome || "(sem assunto)"), de: String(r.nome || ""), ha: String(r.ha || ""), acao: { mod: "caixaSecretaria" } }); });
  (cp ? cp.novas : []).forEach(function (r) { chegou.push({ icone: "🏨", titulo: r.titulo, de: "", ha: "", acao: { mod: "beneficios", opts: { sub: "parqueChina" } } }); });

  var total = tarefas.reduce(function (s, x) { return s + x.n; }, 0);
  return {
    ok: true,
    nome: String(sessao.nome || sessao.usuario || "").split(/\s+/)[0],
    atualizadoEm: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
    grupo: grupo || "todos",
    resumo: { assuntos: total, urgentes: urg },
    kpis: kpis, tarefas: tarefas, areas: areas, chegou: chegou.slice(0, 4),
    indisponiveis: falhas
  };
}
