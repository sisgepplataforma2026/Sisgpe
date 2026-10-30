// ================================================================
// ARQUIVO: CaixaSecretaria.gs
// CAIXA DA SECRETARIA NO SISGEP — 29/10/2026
//
// O usuário, em 29/10/2026: "Posso trabalhar os e-mails dentro do SISGEP?",
// "Tudo no mesmo lugar", "todos categorizados". A regra de 21/10 ("os
// e-mails da secretaria não devem ser acessados pelo financeiro") foi
// MUDADA por ele: em 29/10 só Secretaria e administrador; em 30/10, também
// o Financeiro. Ver CLAUDE.md, "E-MAILS DA SECRETARIA NO SISGEP".
//
// De onde vem: o leitor (leitor-secretaria/LeitorSecretaria.gs.txt), na
// conta da Secretaria, copia para a aba "Caixa" da ponte cada e-mail que não
// é voucher nem propaganda/notificação, com o TIPO que a IA deu. Voucher
// continua no módulo de Voucher (VoucherPedidosEmail.gs).
//
// Para onde vai: a resposta entra na fila "Saida" da ponte, e o leitor a
// envia como RESPOSTA na conversa, pela caixa da Secretaria. Nada sai sem o
// clique de uma pessoa (CLAUDE.md, "NADA SAI SOZINHO").
//
// QUEM ABRE (30/10/2026, o usuário mudou de novo: "tanto secretaria quanto
// financeiro podem olhar tudo. Se tiver categorizado, não tem problema"):
// administrador, o usuário secretaria@, e quem tem o módulo Comunicação,
// Financeiro ou Caixa da Secretaria. Quem só tem outros módulos (RH,
// Jurídico…) não abre.
// ================================================================

var CXS_ABA = "Caixa_Secretaria";
var CXS_COLUNAS = ["THREAD_ID", "ESTADO", "ULTIMA_VISTA", "TIPO_CORRIGIDO", "NOTA", "DECIDIDO_POR", "DECIDIDO_EM",
                   "CORRECOES_JSON"];
var CXS_TIPOS = {
  FILIACAO: { rotulo: "Filiação ou desfiliação", icone: "🪪", modulo: "sindicalizacao" },
  OFICIO_ESCOLA: { rotulo: "Escola — ofício, relação, desconto em folha", icone: "🏫", modulo: "documentos" },
  CONVENCAO: { rotulo: "Convenção e direitos trabalhistas", icone: "📜", modulo: "negociacao" },
  FINANCEIRO: { rotulo: "Financeiro — guia, boleto, pagamento", icone: "💰", modulo: "financeiro" },
  JURIDICO: { rotulo: "Jurídico — homologação, rescisão, processo", icone: "⚖", modulo: "juridico" },
  EVENTO: { rotulo: "Evento ou assembleia", icone: "📅", modulo: "eventos" },
  OUTRO: { rotulo: "Outro assunto", icone: "❓", modulo: "" },
  /* 30/10/2026: mudar um e-mail para Voucher faz dele um pedido de voucher
     (e o "Ver" abre a conferência). */
  VOUCHER: { rotulo: "Voucher — bolsa de estudo", icone: "🎓", modulo: "beneficios" }
};
var CXS_ESTADOS = { NOVO: "NOVO", RESPONDIDO: "RESPONDIDO", RESOLVIDO: "RESOLVIDO" };

/* ── a trava ── */
function cxsPode_(sessao) {
  if (!sessao || sessao.logado !== true) return false;
  if (String(sessao.perfil || "").toUpperCase().indexOf("ADMIN") > -1) return true;
  if (String(sessao.email || "").trim().toLowerCase() === "secretaria@sindeducacao.com") return true;
  /* 30/10/2026, o usuário: "tanto secretaria quanto financeiro podem olhar
     tudo. Se tiver categorizado, não tem problema." Abre para quem usa a
     Comunicação ou o Financeiro (e quem tem a Caixa liberada pelo nome). */
  return ["comunicacao", "financeiro", "caixaSecretaria"].some(function (m) { return sessaoPodeModulo_(sessao, m); });
}
function cxsExigir_(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  if (!cxsPode_(sessao)) {
    throw new Error("A Caixa da Secretaria abre para quem usa a Comunicação ou o Financeiro. " +
      "Peça ao administrador para liberar um desses módulos no seu usuário.");
  }
  return sessao;
}

/* ── a planilha de estado (do lado do SISGEP) ── */
function cxsAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CXS_ABA);
  if (!sh) {
    sh = ss.insertSheet(CXS_ABA);
    sh.getRange(1, 1, 1, CXS_COLUNAS.length).setValues([CXS_COLUNAS]);
  }
  return sh;
}
function cxsEstados_() {
  var m = {};
  vpeLinhas_(cxsAba_()).forEach(function (r) { m[String(r.THREAD_ID)] = r; });
  return m;
}
function cxsLinhasPonte_() {
  var sh = vpePonte_().getSheetByName("Caixa");
  if (!sh) return [];
  var naEntrada = cxsIdsDaEntrada_();
  return vpeLinhas_(sh).filter(function (p) { return !naEntrada[String(p.THREAD_ID)]; });
}
/* As conversas que viraram voucher (estão na Entrada da ponte) — só a
   coluna, sem ler os JSONs. */
function cxsIdsDaEntrada_() {
  var ids = {};
  try {
    var sh = vpePonteAba_("Entrada");
    if (sh.getLastRow() < 2) return ids;
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var col = cab.indexOf("THREAD_ID");
    if (col === -1) return ids;
    sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues().forEach(function (l) { ids[String(l[0])] = true; });
  } catch (e) {}
  return ids;
}
function cxsLinhaPonte_(id) {
  if (cxsEhFinanceiro_(id)) return cxsLinhaFinanceiro_(id);
  var sh = vpePonte_().getSheetByName("Caixa");
  return sh ? vpeLinhaPor_(sh, "THREAD_ID", id) : null;
}

/* ── A CAIXA DO FINANCEIRO NA MESMA LISTA (30/10/2026) ──
   O usuário: tudo num lugar só — havia três telas de e-mail (Painel do Dia,
   Caixa de E-mails e Caixa da Secretaria) para duas caixas. A financeiro@
   é a conta onde o SISGEP roda: o Gmail dela é lido direto (como a Central
   de E-mails já fazia). Cada conversa vira uma "linha" com o mesmo formato
   da ponte da Secretaria, para o resto da Caixa funcionar igual. O id leva
   o prefixo "F:" para nunca se confundir com conversa da Secretaria.
   Nada é mudado no Gmail (nem lido, nem arquivado): situação, tipo e nota
   ficam no SISGEP, como na Secretaria. */
var CXS_PREFIXO_FIN = "F:";
var CXS_FIN_BUSCA = "in:inbox newer_than:30d -category:promotions -category:social -category:forums";
var CXS_FIN_MAX = 40;
var CXS_NOSSOS = ["financeiro@sindeducacao.com", "secretaria@sindeducacao.com"];
var CXS_AUTOMATICO = /^(no-?reply|nao-?responda|naoresponda|mailer|bounce|news|newsletter|marketing|notifica)/i;

function cxsEhFinanceiro_(id) { return String(id || "").indexOf(CXS_PREFIXO_FIN) === 0; }
/* O Gmail da conta do projeto. Separado para o teste poder trocar. */
function cxsGmailFinanceiro_() { return GmailApp; }

/* Tipo por regra, sem gastar IA a cada abertura da tela. Quem discordar
   corrige na conversa (fica registrado, como na Secretaria). */
function cxsTipoPorRegra_(assunto, corpo) {
  var t = (String(assunto || "") + " " + String(corpo || "").substring(0, 600)).toLowerCase();
  if (/filia[cç][aã]o|desfilia|desligamento do sindicato/.test(t)) return "FILIACAO";
  if (/homologa|rescis|processo|advogad|jur[ií]dic|notifica[cç][aã]o extrajudicial/.test(t)) return "JURIDICO";
  if (/boleto|guia|comprovante|recibo|pagamento|cobran|desconto em folha|mensalidade|taxa negocial|nota fiscal|\bnf\b|nfs-?e|inadimpl|d[eé]bito|pix/.test(t)) return "FINANCEIRO";
  if (/of[ií]cio|rela[cç][aã]o nominal|movimenta[cç][aã]o|admiss|demiss|funcion[aá]rios/.test(t)) return "OFICIO_ESCOLA";
  if (/conven[cç][aã]o|\bcct\b|reajuste|piso salarial|cl[aá]usula/.test(t)) return "CONVENCAO";
  if (/assembleia|evento|convite|reuni[aã]o|palestra/.test(t)) return "EVENTO";
  return "OUTRO";
}

function cxsMensagemFin_(m) {
  var de = String(m.getFrom() || "");
  var rt = "";
  try { rt = String(m.getReplyTo() || ""); } catch (e) {}
  return { id: m.getId(), de: de, replyTo: rt, para: String(m.getTo() || ""), cc: "",
           assunto: String(m.getSubject() || ""), data: new Date(m.getDate()).toISOString(),
           corpo: vpeSemCitacao_(String(m.getPlainBody() || "")).substring(0, 4000) };
}

/* Uma conversa do Gmail com a cara de uma linha da ponte. */
function cxsLinhaDeThreadFin_(th, comAnexos, msgsProntas) {
  var msgs = msgsProntas || th.getMessages() || [];
  if (!msgs.length) return null;
  /* Na lista bastam as últimas mensagens; a conversa inteira só ao abrir. */
  var lista = (comAnexos ? msgs : msgs.slice(-4)).map(cxsMensagemFin_);
  if (!comAnexos) msgs = msgs.slice(-4);
  var anexos = [];
  if (comAnexos) {
    msgs.forEach(function (m) {
      (m.getAttachments({ includeInlineImages: false, includeAttachments: true }) || []).forEach(function (a, pos) {
        anexos.push({ msgId: m.getId(), pos: pos, nome: a.getName(), tipo: a.getContentType(), tamanho: a.getSize(), gmail: true });
      });
    });
  }
  var entrantes = lista.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; });
  var base = entrantes[0] || lista[0];
  /* O que a equipe já decidiu para este remetente vale mais que a regra
     (a memória do robô — RoboMemoria.gs). */
  var aprendido = roboMemoriaUltimaDecisao_("categoria-email", cxsEmail_(base.replyTo || base.de));
  return { THREAD_ID: CXS_PREFIXO_FIN + th.getId(), ULTIMA_MENSAGEM_ID: lista[lista.length - 1].id, CAIXA: "FINANCEIRO",
           TIPO: aprendido && CXS_TIPOS[aprendido] ? aprendido : cxsTipoPorRegra_(base.assunto, base.corpo), PEDIDO: "",
           MENSAGENS_JSON: JSON.stringify(lista), ANEXOS_JSON: JSON.stringify(anexos),
           __qtdAnexos: comAnexos ? anexos.length : -1 };
}

function cxsLinhaFinanceiro_(id) {
  var th = cxsGmailFinanceiro_().getThreadById(String(id).substring(CXS_PREFIXO_FIN.length));
  return th ? cxsLinhaDeThreadFin_(th, true) : null;
}

/* As conversas da caixa de entrada da financeiro@ (30 dias). Cache curto:
   abrir e voltar para a lista não relê o Gmail. */
function cxsLinhasFinanceiro_() {
  var cache = null, chave = "cxs_fin_lista_v1";
  try { cache = CacheService.getScriptCache(); var c = cache.get(chave); if (c) return JSON.parse(c); } catch (e) {}
  var gm = cxsGmailFinanceiro_();
  var threads = gm.search(CXS_FIN_BUSCA, 0, CXS_FIN_MAX) || [];
  /* Quem tem anexo: UMA busca a mais, em vez de abrir os anexos de cada
     mensagem (era o que deixava a Caixa lenta — usuário, 30/10/2026). */
  var comAnexo = {};
  try { (gm.search(CXS_FIN_BUSCA + " has:attachment", 0, CXS_FIN_MAX) || []).forEach(function (t) { comAnexo[String(t.getId())] = true; }); } catch (eA) {}
  var linhas = [];
  threads.forEach(function (th) {
    var l = cxsLinhaDeThreadFin_(th, false);
    if (!l) return;
    var m = vpeJson_(l.MENSAGENS_JSON, []);
    var primeira = m[0] || {}, ultima = m[m.length - 1] || {};
    if (CXS_CONFIRMACAO_LEITURA.test(String(primeira.assunto || ""))) return;
    if (CXS_AUTOMATICO.test(cxsEmail_(ultima.de))) return;
    l.__qtdAnexos = comAnexo[String(th.getId())] ? 1 : 0;
    l.MENSAGENS_JSON = JSON.stringify(m.map(function (x) { x.corpo = String(x.corpo || "").substring(0, 300); return x; }));
    linhas.push(l);
  });
  try { cache.put(chave, JSON.stringify(linhas), 300); } catch (e) {}
  return linhas;
}
function cxsEmail_(s) {
  var m = String(s || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : "";
}
function cxsNome_(s) {
  var t = String(s || "").replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return t && t.indexOf("@") === -1 ? t : "";
}

/** Situação de uma conversa: mensagem nova depois de resolvida volta a NOVO. */
function cxsSituacao_(p, est) {
  var estado = est ? String(est.ESTADO || CXS_ESTADOS.NOVO) : CXS_ESTADOS.NOVO;
  var nova = !!(est && String(est.ULTIMA_VISTA || "") && String(est.ULTIMA_VISTA) !== String(p.ULTIMA_MENSAGEM_ID));
  if (nova) estado = CXS_ESTADOS.NOVO;
  return { estado: estado, mensagemNova: nova };
}

function cxsResumo_(p, est, envios) {
  var msgs = vpeJson_(p.MENSAGENS_JSON, []);
  var primeira = msgs[0] || {}, ultima = msgs[msgs.length - 1] || {};
  var tipo = String((est && est.TIPO_CORRIGIDO) || p.TIPO || "OUTRO");
  var sit = cxsSituacao_(p, est);
  var meus = (envios[String(p.THREAD_ID)] || []);
  return {
    id: String(p.THREAD_ID), tipo: tipo, tipoRotulo: (CXS_TIPOS[tipo] || CXS_TIPOS.OUTRO).rotulo,
    icone: (CXS_TIPOS[tipo] || CXS_TIPOS.OUTRO).icone,
    de: cxsEmail_(ultima.replyTo || ultima.de), nome: cxsNome_(ultima.de) || cxsEmail_(ultima.de),
    assunto: String(primeira.assunto || "(sem assunto)"), pedido: String(p.PEDIDO || ""),
    trecho: String(ultima.corpo || "").replace(/\s+/g, " ").substring(0, 160),
    mensagens: msgs.length, anexos: p.__qtdAnexos >= 0 && p.__qtdAnexos !== undefined ? p.__qtdAnexos : vpeJson_(p.ANEXOS_JSON, []).length,
    caixa: String(p.CAIXA || "SECRETARIA"),
    recebidoTs: ultima.data ? new Date(ultima.data).getTime() : 0,
    recebidoEm: ultima.data ? Utilities.formatDate(new Date(ultima.data), "America/Sao_Paulo", "dd/MM HH:mm") : "",
    estado: sit.estado, mensagemNova: sit.mensagemNova,
    ultimaResposta: meus.length ? vpeRotuloEnvio_(meus[meus.length - 1].STATUS) : "",
    decididoPor: est ? String(est.DECIDIDO_POR || "") : ""
  };
}

/* ── TELA ÚNICA (30/10/2026) ──
   O usuário: "preciso que fique tudo no mesmo lugar ... assim não preciso
   abrir várias telas". Os pedidos de voucher por e-mail e as solicitações
   presenciais/portal entram na MESMA lista da Caixa. Quem não tem o módulo
   Benefícios continua sem ver voucher — a trava é aqui, no servidor. Abrir
   um voucher usa as telas e as funções de sempre (voucherPedidos*,
   Voucher.gs), com as travas delas. */
var CXS_VPE_ABERTOS = ["PRONTO", "FALTA_DOC", "NAO_ENCONTRADO", "PRECISA_VOCE"];
var CXS_SOL_ABERTAS = ["PENDENTE", "ANALISE", "AGUARDANDO_VALIDACAO_CADASTRAL", "BLOQUEADA_POR_REGRA", "APROVADO"];
var CXS_SELO_VPE = {
  PRONTO: ["🟢 Pronto", "pronto"], FALTA_DOC: ["🟡 Falta documento", "falta"],
  NAO_ENCONTRADO: ["🔴 Não encontrado na relação", "erro"], PRECISA_VOCE: ["⚪ Precisa de você", "voce"],
  AGUARDANDO: ["⏳ Aguardando o associado", "espera"], EMITIDO: ["📤 Emitido · aguardando envio", "emitido"],
  CONCLUIDO: ["✔ Concluído", "ok"]
};
var CXS_SELO_SOL = {
  PENDENTE: "🏢 Presencial · pendente", ANALISE: "🏢 Presencial · em análise",
  AGUARDANDO_VALIDACAO_CADASTRAL: "🏢 Presencial · validação cadastral",
  BLOQUEADA_POR_REGRA: "🏢 Presencial · bloqueada por regra", APROVADO: "🏢 Presencial · aprovada, emitir"
};
/* Confirmação de leitura não é pedido (o leitor já deixa de fora; isto
   esconde as que entraram antes da correção). */
var CXS_CONFIRMACAO_LEITURA = /^\s*(lida|lido|read|le[ií]do|lu|gelesen)\s*:/i;

function cxsVouchers_(sessao) {
  var out = { itens: [], cont: { PRONTO: 0, FALTA_DOC: 0, NAO_ENCONTRADO: 0, PRECISA_VOCE: 0, AGUARDANDO: 0, EMITIDO: 0, PRESENCIAL: 0 },
              pode: false };
  if (!sessaoPodeModulo_(sessao, "beneficios")) return out;
  out.pode = true;
  var podeSecretaria = vpeCaixasDoUsuario_(sessao).indexOf("SECRETARIA") > -1;
  var limite = Date.now() - 30 * 86400000;
  var protocolosDeEmail = {};
  try {
    var envios = vpePonteId_() ? vpeEnviosPorConversa_() : {};
    vpeLinhas_().forEach(function (r) {
      if (r.PROTOCOLO) protocolosDeEmail[String(r.PROTOCOLO)] = true;
      if (!podeSecretaria || String(r.CAIXA || "") !== "SECRETARIA") return;
      var e = String(r.ESTADO || "");
      if (e === VPE_ESTADOS.IGNORADO) return;
      if (e === VPE_ESTADOS.CONCLUIDO && !(r.DECIDIDO_EM && new Date(r.DECIDIDO_EM).getTime() >= limite)) return;
      if (out.cont[e] !== undefined) out.cont[e]++;
      var v = vpeResumoItem_(r, envios);
      var selo = CXS_SELO_VPE[e] || [e, ""];
      var falta = v.pendencias.filter(function (x) { return /^FALTA\|/.test(x); })
        .map(function (x) { return x.split("|").slice(1).join("|"); });
      out.itens.push({
        fonte: "VOUCHER", id: v.id, tipo: "VOUCHER", tipoRotulo: "Voucher", icone: "🎓",
        nome: v.nome || v.remetente, de: v.remetente, assunto: String(r.ASSUNTO || "Pedido de voucher"),
        pedido: [v.curso, v.periodo, v.escola].filter(function (x) { return x; }).join(" · "),
        trecho: falta.length ? "Falta: " + falta.join("; ") : (v.beneficiario ? "Para " + v.beneficiario : ""),
        anexos: vpeJson_(r.ANEXOS_JSON, []).length, mensagens: 0,
        recebidoTs: v.recebidoTs, recebidoEm: v.recebidoEm,
        estado: CXS_VPE_ABERTOS.indexOf(e) > -1 ? CXS_ESTADOS.NOVO : e === VPE_ESTADOS.CONCLUIDO ? CXS_ESTADOS.RESOLVIDO : CXS_ESTADOS.RESPONDIDO,
        selo: selo[0], seloCls: selo[1], periodo: v.periodo, escola: v.escola, mensagemNova: false, ultimaResposta: ""
      });
    });
  } catch (eV) { out.erro = "Pedidos por e-mail: " + eV.message; }
  try {
    listarSolicitacoesVoucher().forEach(function (sol) {
      var st = String(sol.status || "").toUpperCase();
      if (CXS_SOL_ABERTAS.indexOf(st) === -1 || protocolosDeEmail[String(sol.protocolo)]) return;
      out.cont.PRESENCIAL++;
      out.itens.push({
        fonte: "PRESENCIAL", id: String(sol.protocolo), tipo: "VOUCHER", tipoRotulo: "Voucher", icone: "🏢",
        nome: String(sol.nome || ""), de: String(sol.email || ""), assunto: "Solicitação de voucher · " + sol.protocolo,
        pedido: [sol.curso, sol.periodoReferencia, sol.escola].filter(function (x) { return x; }).join(" · "),
        trecho: sol.nomeBeneficiario && String(sol.tipoBeneficiario || "").toUpperCase() !== "TITULAR"
          ? "Para " + sol.tipoBeneficiario + " · " + sol.nomeBeneficiario : "",
        anexos: 0, mensagens: 0, recebidoTs: Number(sol._ts || 0), recebidoEm: String(sol.data || ""),
        estado: CXS_ESTADOS.NOVO, selo: CXS_SELO_SOL[st] || st, seloCls: st === "APROVADO" ? "pronto" : "presencial",
        periodo: String(sol.periodoReferencia || ""), escola: String(sol.escola || ""), mensagemNova: false, ultimaResposta: "",
        sol: sol
      });
    });
  } catch (eS) { out.erro = (out.erro ? out.erro + " · " : "") + "Solicitações presenciais: " + eS.message; }
  return out;
}

/* ═══════════════ O QUE A TELA CHAMA ═══════════════ */

function caixaSecretariaPainel(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var est = cxsEstados_();
    var envios = vpeEnviosPorConversa_();
    var itens = cxsLinhasPonte_().filter(function (p) {
      var m = vpeJson_(p.MENSAGENS_JSON, [])[0] || {};
      return !CXS_CONFIRMACAO_LEITURA.test(String(m.assunto || ""));
    }).map(function (p) {
      var r = cxsResumo_(p, est[String(p.THREAD_ID)], envios);
      r.fonte = "EMAIL";
      return r;
    });
    var v = cxsVouchers_(sessao);
    v.itens.forEach(function (i) { i.caixa = "SECRETARIA"; });
    itens = itens.concat(v.itens);
    /* A financeiro@ vem numa chamada separada (caixaFinanceiroItens): a
       tela desenha a Secretaria na hora e junta o Financeiro quando chegar. */
    var erroFin = "";
    var porCaixa = { SECRETARIA: 0, FINANCEIRO: 0 };
    itens.forEach(function (i) { if (i.estado !== CXS_ESTADOS.RESOLVIDO) porCaixa[i.caixa] = (porCaixa[i.caixa] || 0) + 1; });
    itens.sort(function (a, b) { return b.recebidoTs - a.recebidoTs; });
    var porTipo = {}, porEstado = { NOVO: 0, RESPONDIDO: 0, RESOLVIDO: 0 };
    itens.forEach(function (i) {
      if (i.estado !== CXS_ESTADOS.RESOLVIDO) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
      porEstado[i.estado] = (porEstado[i.estado] || 0) + 1;
    });
    var voucher = v.cont.PRONTO + v.cont.FALTA_DOC + v.cont.NAO_ENCONTRADO + v.cont.PRECISA_VOCE + v.cont.PRESENCIAL;
    return { ok: true, itens: itens, porTipo: porTipo, porEstado: porEstado, voucherAConferir: voucher,
             voucher: { pode: v.pode, cont: v.cont, erro: v.erro || "" }, porCaixa: porCaixa, erroFinanceiro: erroFin,
             tipos: Object.keys(CXS_TIPOS).map(function (k) {
               return { chave: k, rotulo: CXS_TIPOS[k].rotulo, icone: CXS_TIPOS[k].icone, modulo: CXS_TIPOS[k].modulo };
             }) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* A MEMÓRIA DO ROBÔ guarda a resposta: o que ele sugeriu e o que saiu. */
function cxsMemoriaResposta_(id, texto, meta, sessao) {
  try {
    var p = cxsLinhaPonte_(id);
    var msgs = p ? vpeJson_(p.MENSAGENS_JSON, []) : [];
    var de = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; }).pop() || {};
    var est = cxsEstados_()[String(id)] || {};
    roboMemoriaRegistrar_({ tarefa: "resposta-email", origem: String((p && p.CAIXA) || "SECRETARIA"), chave: id,
      remetente: cxsEmail_(de.replyTo || de.de), assunto: de.assunto, trecho: de.corpo,
      sugerido: String((meta && meta.sugerido) || "").trim().substring(0, 2000),
      decidido: String(texto).substring(0, 2000), quem: sessao.email || sessao.usuario || "",
      tipoEmail: String(est.TIPO_CORRIGIDO || (p && p.TIPO) || "") });
  } catch (e) {}
}

/** Os e-mails da financeiro@, à parte (o Gmail é a parte lenta). */
function caixaFinanceiroItens(tokenSessao) {
  try {
    cxsExigir_(tokenSessao);
    var est = cxsEstados_();
    var itens = cxsLinhasFinanceiro_().map(function (p) {
      var r = cxsResumo_(p, est[String(p.THREAD_ID)], {});
      r.fonte = "EMAIL";
      return r;
    });
    return { ok: true, itens: itens };
  } catch (e) {
    return { ok: false, mensagem: "Caixa do Financeiro: " + e.message };
  }
}

function caixaSecretariaDetalhe(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var est = cxsEstados_()[String(id)];
    var envios = vpeEnviosPorConversa_();
    var resumo = cxsResumo_(p, est, envios);
    var msgs = vpeJson_(p.MENSAGENS_JSON, []).map(function (m) {
      var d = new Date(m.data);
      return { de: m.de || "", nossa: CXS_NOSSOS.indexOf(cxsEmail_(m.de)) > -1, ts: d.getTime(), assunto: m.assunto || "",
               data: Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"), corpo: m.corpo || "", id: m.id };
    });
    (envios[String(id)] || []).forEach(function (e) {
      var q = new Date(e.PROCESSADO_EM || e.CRIADO_EM);
      msgs.push({ de: "Secretaria (" + vpeRotuloEnvio_(e.STATUS) + ")", nossa: true, ts: q.getTime(), assunto: "",
        data: Utilities.formatDate(q, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
        corpo: String(e.HTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").substring(0, 4000) });
    });
    msgs.sort(function (a, b) { return a.ts - b.ts; });
    var anexos = vpeJson_(p.ANEXOS_JSON, []).map(function (a, i) {
      return { indice: i, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, disponivel: !!(a.fileId || a.gmail) };
    });
    var primeiro = (resumo.nome || "").split(/\s+/)[0] || "";
    primeiro = primeiro && primeiro.indexOf("@") === -1 ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
    var sugestao = "Olá" + (primeiro ? ", " + primeiro : "") + "!\nTudo bem?\n\n\n\nEstamos à disposição para esclarecer qualquer dúvida!\n\n" +
      vpeAssinaturaTexto_(sessao);   // de quem está logado (30/10/2026)
    return { ok: true, item: resumo, mensagens: msgs, anexos: anexos, sugestao: sugestao,
             nota: est ? String(est.NOTA || "") : "",
             tipos: Object.keys(CXS_TIPOS).map(function (k) { return { chave: k, rotulo: CXS_TIPOS[k].rotulo, modulo: CXS_TIPOS[k].modulo }; }) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function caixaSecretariaAnexo(id, indice, tokenSessao) {
  try {
    cxsExigir_(tokenSessao);
    var p = cxsLinhaPonte_(id);
    var a = p ? vpeJson_(p.ANEXOS_JSON, [])[Number(indice)] : null;
    if (a && a.gmail) {
      var msg = cxsGmailFinanceiro_().getMessageById(String(a.msgId));
      var bg = msg ? (msg.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [])[Number(a.pos)] : null;
      if (!bg) return { ok: false, mensagem: "O anexo não está mais na caixa." };
      var tg = bg.getContentType() || a.tipo || "application/octet-stream";
      return { ok: true, nome: a.nome, tipo: tg, driveUrl: "",
               dataUrl: "data:" + tg + ";base64," + Utilities.base64Encode(bg.getBytes()) };
    }
    if (!a || !a.fileId) return { ok: false, mensagem: "Anexo não disponível." };
    var blob = DriveApp.getFileById(String(a.fileId)).getBlob();
    var tipo = blob.getContentType() || a.tipo || "application/octet-stream";
    return { ok: true, nome: a.nome, tipo: tipo, driveUrl: "https://drive.google.com/file/d/" + a.fileId + "/view",
             dataUrl: "data:" + tipo + ";base64," + Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Responder — só com o clique, só como resposta, para quem escreveu. */
/* meta (opcional) = { sugerido: o texto que o sistema propôs } — para a
   memória do robô comparar com o que a pessoa enviou. */
function caixaSecretariaResponder(id, texto, a3, a4) {
  var meta = (a4 === undefined) ? {} : (a3 || {});
  var tokenSessao = (a4 === undefined) ? a3 : a4;
  try {
    var sessao = cxsExigir_(tokenSessao);
    texto = String(texto || "").trim();
    if (texto.length < 10) return { ok: false, mensagem: "Escreva a resposta antes de enviar." };
    cxsMemoriaResposta_(id, texto, meta, sessao);
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var ultima = msgs[msgs.length - 1] || {};
    var quem = sessao.email || sessao.usuario || "";
    if (cxsEhFinanceiro_(id)) {
      /* A financeiro@ é a própria conta do SISGEP: responde direto, na
         conversa, para quem escreveu por último (de fora). Só com o clique;
         em homologação, só para a equipe. */
      var entr = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; });
      var alvo = entr[entr.length - 1];
      if (!alvo) return { ok: false, mensagem: "Não há mensagem de fora nesta conversa para responder." };
      var paraF = cxsEmail_(alvo.replyTo || alvo.de);
      vpeChecarDestinoAmbiente_(paraF);
      var mOrig = cxsGmailFinanceiro_().getMessageById(String(alvo.id));
      if (!mOrig) return { ok: false, mensagem: "A mensagem não está mais na caixa do Financeiro." };
      var html = vpeTextoParaHtml_(texto) + (/Atenciosamente/i.test(texto) ? "" : vpeAssinaturaHtml_("FINANCEIRO", sessao));
      mOrig.reply("", { htmlBody: html, replyTo: "financeiro@sindeducacao.com" });
      cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESPONDIDO, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID) }, quem);
      cxsAuditar_("RESPONDER", id, "Resposta (financeiro@) para " + paraF, sessao);
      try { CacheService.getScriptCache().remove("cxs_fin_lista_v1"); } catch (eC) {}
      return { ok: true, mensagem: "Resposta enviada para " + paraF + " pela financeiro@." };
    }
    var para = vpeResponderThread_({ REMETENTE_EMAIL: cxsEmail_(ultima.replyTo || ultima.de), CAIXA: "SECRETARIA",
      THREAD_ID: String(p.THREAD_ID), ULTIMA_MENSAGEM_ID: String(p.ULTIMA_MENSAGEM_ID) }, vpeTextoParaHtml_(texto), [], quem,
      /Atenciosamente/i.test(texto) ? "" : vpeAssinaturaHtml_("SECRETARIA", sessao));
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESPONDIDO, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID) }, quem);
    cxsAuditar_("RESPONDER", id, "Resposta para " + para, sessao);
    return { ok: true, mensagem: "Resposta para " + para + " na fila da Secretaria — sai em até 15 minutos." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Resolvido (com nota opcional) ou de volta para novo. */
function caixaSecretariaMarcar(id, estado, nota, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    estado = String(estado || "").toUpperCase();
    if (!CXS_ESTADOS[estado]) return { ok: false, mensagem: "Situação inválida." };
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var quem = sessao.email || sessao.usuario || "";
    var mud = { ESTADO: estado, ULTIMA_VISTA: String(p.ULTIMA_MENSAGEM_ID) };
    if (nota !== undefined && nota !== null) mud.NOTA = String(nota).substring(0, 1000);
    cxsGravarEstado_(id, mud, quem);
    cxsAuditar_("MARCAR_" + estado, id, nota || "", sessao);
    roboMemoriaRegistrar_({ tarefa: "situacao-email", origem: String(p.CAIXA || "SECRETARIA"), chave: id,
      sugerido: "", decidido: estado + (nota ? " · " + String(nota).substring(0, 200) : ""), quem: quem });
    return { ok: true, mensagem: estado === "RESOLVIDO" ? "Marcado como resolvido." : "Voltou para os novos." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** A IA errou o tipo: a pessoa corrige — e fica registrado (para aprender). */
function caixaSecretariaReclassificar(id, tipo, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    tipo = String(tipo || "").toUpperCase();
    if (!CXS_TIPOS[tipo]) return { ok: false, mensagem: "Tipo inválido." };
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var quem = sessao.email || sessao.usuario || "";
    var est = cxsEstados_()[String(id)] || {};
    var tipoAntes = String(est.TIPO_CORRIGIDO || p.TIPO || "");
    var corr = vpeJson_(est.CORRECOES_JSON, []);
    corr.push({ em: Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm"), por: quem,
                deTipo: tipoAntes, paraTipo: tipo });
    cxsGravarEstado_(id, { TIPO_CORRIGIDO: tipo, CORRECOES_JSON: JSON.stringify(corr) }, quem);
    cxsAuditar_("RECLASSIFICAR", id, (p.TIPO || "") + " → " + tipo, sessao);
    /* A MEMÓRIA DO ROBÔ: o que a IA (ou a regra) disse e o que a pessoa
       decidiu. É daqui que ele aprende. */
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var de = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; })[0] || msgs[0] || {};
    roboMemoriaRegistrar_({ tarefa: "categoria-email", origem: String(p.CAIXA || "SECRETARIA"), chave: id,
      remetente: cxsEmail_(de.replyTo || de.de), assunto: de.assunto, trecho: de.corpo,
      sugerido: String(p.TIPO || ""), decidido: tipo, quem: quem });
    if (tipo === "VOUCHER") return cxsVirarVoucher_(id, p, sessao);
    return { ok: true, mensagem: "Tipo corrigido para " + CXS_TIPOS[tipo].rotulo + ". O robô guardou o exemplo." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/**
 * MUDOU PARA VOUCHER (30/10/2026). O usuário: "tudo que for voucher, quando
 * eu clicar ver, ele tem que ir para aquela tela do voucher".
 *  - Secretaria: a conversa sai da Caixa e entra na Entrada da ponte (onde
 *    os pedidos de voucher moram); é lida na hora como pedido — a pessoa já
 *    disse que é voucher, então a peneira de palavras não barra. Mensagem
 *    nova nessa conversa passa a ir para o pedido (o leitor segue a Entrada).
 *  - Financeiro: o pedido de voucher é da Secretaria — vai encaminhado para
 *    a secretaria@ (só com este clique) e lá entra como pedido.
 */
function cxsVirarVoucher_(id, p, sessao) {
  var quem = sessao.email || sessao.usuario || "";
  if (!sessaoPodeModulo_(sessao, "beneficios")) {
    return { ok: false, mensagem: "Mudar para Voucher pede o módulo Benefícios. O tipo ficou anotado." };
  }
  if (cxsEhFinanceiro_(id)) {
    var msgs = vpeJson_(p.MENSAGENS_JSON, []);
    var entr = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; });
    var alvo = entr[entr.length - 1] || msgs[msgs.length - 1];
    var mOrig = alvo ? cxsGmailFinanceiro_().getMessageById(String(alvo.id)) : null;
    if (!mOrig) return { ok: false, mensagem: "A mensagem não está mais na caixa do Financeiro." };
    vpeChecarDestinoAmbiente_("secretaria@sindeducacao.com");
    mOrig.forward("secretaria@sindeducacao.com", {
      htmlBody: "<p>Pedido de voucher que chegou no Financeiro — encaminhado pelo SISGEP por " +
        escHtmlVoucher_(quem) + ".</p>" });
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO, NOTA: "Encaminhado à Secretaria como pedido de voucher." }, quem);
    cxsAuditar_("VIROU_VOUCHER", id, "Encaminhado à secretaria@", sessao);
    return { ok: true, mensagem: "Encaminhado à Secretaria: entra lá como pedido de voucher no próximo ciclo da leitura." };
  }
  var shE = vpePonteAba_("Entrada");
  if (!vpeLinhaPor_(shE, "THREAD_ID", id)) {
    vpeGravar_({ THREAD_ID: String(p.THREAD_ID), ULTIMA_MENSAGEM_ID: String(p.ULTIMA_MENSAGEM_ID), CAIXA: String(p.CAIXA || "SECRETARIA"),
                 ATUALIZADO_EM: new Date(), MENSAGENS_JSON: p.MENSAGENS_JSON, ANEXOS_JSON: p.ANEXOS_JSON }, shE);
  }
  /* A linha da Caixa NÃO é apagada (REGRA Nº 1: nada se apaga): a conversa
     está agora na Entrada, e o painel não mostra na Caixa o que já é
     voucher (cxsIdsDaEntrada_). O leitor também passa a seguir a Entrada. */
  var r = vpeLerCaixa_({ soThread: String(id), forcarVoucher: true, maxProcessar: 1 });
  var reg = vpeLinhaPor_(vpeAba_(), "THREAD_ID", id);
  cxsAuditar_("VIROU_VOUCHER", id, reg ? "Pedido " + reg.ID_PEDIDO : "aguardando leitura", sessao);
  if (!reg) {
    return { ok: true, mensagem: "Virou pedido de voucher; a leitura dos documentos termina no próximo ciclo." +
      (r && r.ocupado ? " (A leitura estava ocupada.)" : "") };
  }
  return { ok: true, pedidoId: String(reg.ID_PEDIDO), mensagem: "Virou pedido de voucher — abrindo a conferência." };
}

/** A tela pergunta antes de desenhar: mostra o aviso certo, sem expor nada. */
function caixaSecretariaPodeAbrir(tokenSessao) {
  try { return { ok: true, pode: cxsPode_(exigirSessaoDocumentos_(tokenSessao, false)) }; }
  catch (e) { return { ok: false, pode: false, mensagem: e.message }; }
}

function cxsGravarEstado_(id, mud, quem) {
  var sh = cxsAba_();
  var reg = cxsEstados_()[String(id)] || { THREAD_ID: String(id), ESTADO: CXS_ESTADOS.NOVO };
  Object.keys(mud).forEach(function (k) { reg[k] = mud[k]; });
  reg.DECIDIDO_POR = quem;
  reg.DECIDIDO_EM = new Date();
  vpeGravar_(reg, sh);
}

function cxsAuditar_(acao, id, texto, sessao) {
  try {
    if (typeof auditar_ !== "function") return;
    auditar_({ modulo: "Comunicação", submodulo: "Caixa da Secretaria", acao: acao,
               registroId: String(id), valorNovo: String(texto || "").substring(0, 500), sessao: sessao || {} });
  } catch (e) { Logger.log("Auditoria da Caixa falhou: " + e.message); }
}
