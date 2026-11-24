/* ================================================================
   ATALHOS NO E-MAIL — FASE 1 (10/11/2026)
   ================================================================
   O usuário: "tudo que a gente oferece no sindicato, seja ofício, filiação,
   desfiliação, taxa negocial, taxa assistencial, voucher, a gente deveria
   ter esses atalhos direto"; "se a NF a gente encaminha para a
   contabilidade"; opção "B" (barra inteligente: 1–2 sugeridos + "Mais
   ações"), "começa pela fase 1". Recibo de mensalidade NÃO entra ("não tem
   recibo de mensalidade"). Recibo diverso (processo, compras avulsas…) é a
   Fase 2.

   Fase 1 = os atalhos para o que JÁ existe, em QUALQUER e-mail (antes só
   apareciam no card certo):
     - os 4 ofícios + taxa assistencial → a MESMA preparação/emissão de
       Ofícios (caixaOficioComTipo / caixaOficioEmitir em CaixaOficioEmail.gs);
     - Voucher → o mesmo "virar voucher" da recategorização;
     - NF → contabilidade → o mesmo de CaixaNotaFiscal.gs (Despesas);
     - Encaminhar.
   Nada sai sem o clique e o "Conferi"/"Sim" de cada fluxo.

   Robô que aprende: o atalho que a pessoa usou em cada tipo de e-mail fica
   na memória (tarefa "atalho-email"); o mais usado no tipo volta como
   sugestão; o acerto da sugestão aparece no rodapé da Caixa.
   ================================================================ */

var CXA_ACOES = {
  OF_FILIACAO:    { rotulo: "Fazer ofício de filiação", icone: "📄", grupo: "Ofício", card: "OFICIO_FILIACAO", caixa: "" },
  OF_DESFILIACAO: { rotulo: "Fazer ofício de desfiliação", icone: "📄", grupo: "Ofício", card: "OFICIO_DESFILIACAO", caixa: "" },
  OF_OPOSICAO:    { rotulo: "Fazer ofício de oposição à taxa negocial", icone: "📄", grupo: "Ofício", card: "OFICIO_OPOSICAO", caixa: "" },
  OF_TAXA:        { rotulo: "Fazer ofício de taxa negocial", icone: "📄", grupo: "Ofício", card: "OFICIO_TAXA", caixa: "" },
  OF_ASSISTENCIAL:{ rotulo: "Fazer ofício de taxa assistencial", icone: "📄", grupo: "Ofício", card: "OFICIO_TAXA_ASSISTENCIAL", caixa: "" },
  VOUCHER:        { rotulo: "Tratar como pedido de voucher", icone: "🎓", grupo: "Benefícios", modulo: "beneficios", caixa: "" },
  NF_CONTAB:      { rotulo: "Enviar NF à contabilidade", icone: "🧾", grupo: "Financeiro", modulo: "financeiro", caixa: "", precisaAnexo: true },
  RECIBO:         { rotulo: "Fazer recibo diverso", icone: "🧾", grupo: "Recibos", modulo: "documentos", caixa: "" },
  RECIBO_ASSINADO:{ rotulo: "Recibo assinado → contabilidade", icone: "✍", grupo: "Recibos", modulo: "documentos", caixa: "", precisaAnexo: true },
  ENCAMINHAR:     { rotulo: "Encaminhar", icone: "↪", grupo: "E-mail", caixa: "" },
  /* 12/11/2026 (CaixaDiretorVisita.gs): a sindicalização é presencial. */
  AVISAR_DIRETOR: { rotulo: "Avisar o diretor da visita (WhatsApp)", icone: "📱", grupo: "Sindicalização", caixa: "" }
};
var CXA_ORDEM = ["OF_FILIACAO", "OF_DESFILIACAO", "OF_OPOSICAO", "OF_TAXA", "OF_ASSISTENCIAL", "VOUCHER", "NF_CONTAB", "RECIBO", "RECIBO_ASSINADO", "AVISAR_DIRETOR", "ENCAMINHAR"];
var CXA_CARD_ACAO = { OFICIO_FILIACAO: "OF_FILIACAO", OFICIO_DESFILIACAO: "OF_DESFILIACAO", OFICIO_OPOSICAO: "OF_OPOSICAO",
  OFICIO_TAXA: "OF_TAXA", NOTA_FISCAL: "NF_CONTAB", VOUCHER: "VOUCHER" };

function cxaPode_(sessao, a) {
  return !a.modulo || sessaoPodeModulo_(sessao, a.modulo);
}

/** O que o robô sugere para este e-mail, com o motivo à vista (até 2). */
function cxaSugestoes_(p, est, disponiveis) {
  var out = [], vistos = {};
  var add = function (acao, motivo) {
    if (!acao || vistos[acao] || disponiveis.indexOf(acao) === -1 || out.length >= 2) return;
    vistos[acao] = 1; out.push({ acao: acao, motivo: motivo });
  };
  var card = cxsTipoDoEmail_(p, est);
  var msgs = vpeJson_(p.MENSAGENS_JSON, []), anexos = vpeJson_(p.ANEXOS_JSON, []);
  var texto = cxsSemAcento_(msgs.map(function (m) { return (m.assunto || "") + " " + (m.corpo || ""); }).join(" "));
  var nomes = cxsSemAcento_(anexos.map(function (a) { return a.nome || ""; }).join(" "));
  /* 0. pedido de sindicalização → a visita é presencial (12/11/2026) */
  try { if (cxfPedeSindicalizacao_(cxfConversaDe_(p))) add("AVISAR_DIRETOR", "pedido de sindicalização — a visita do diretor é presencial"); } catch (eS) {}
  /* 1. pelo card */
  add(CXA_CARD_ACAO[card], "pelo card do e-mail (" + ((CXS_TIPOS[card] || {}).rotulo || card) + ")");
  var junto = cxsOficioJunto_(p, card);
  if (junto) add(/(taxa|contribuicao) assistencial/.test(texto) ? "OF_ASSISTENCIAL" : "OF_TAXA", "o e-mail também pede ofício de taxa");
  /* 2. pelo que a equipe mais faz neste tipo de e-mail (memória) */
  var top = cxaMaisUsado_(card, String(p.CAIXA || "SECRETARIA"));
  if (top) add(top.acao, "é o que vocês mais fazem neste tipo de e-mail (" + top.n + "×)");
  /* 3. pelo conteúdo */
  if (/desfilia|cancelar (a )?filia|cancelamento (da )?filia/.test(texto + " " + nomes)) add("OF_DESFILIACAO", "o e-mail fala de desfiliação");
  else if (/oposi/.test(texto + " " + nomes)) add("OF_OPOSICAO", "o e-mail fala de oposição à taxa");
  else if (/ficha|sindicaliz|filia/.test(nomes) || /(ficha|pedido) de (filiacao|sindicalizacao)/.test(texto)) add("OF_FILIACAO", "tem ficha de filiação anexa");
  if (anexos.length && (/\bnf\b|nfs-?e|nota fiscal|danfe|\.xml/.test(nomes) || /nota fiscal|\bnfs?-?e?\b/.test(texto))) add("NF_CONTAB", "tem nota fiscal anexa");
  if (/voucher|bolsa de estudo|desconto (na|da) (faculdade|mensalidade escolar)/.test(texto)) add("VOUCHER", "o e-mail fala de voucher/bolsa");
  /* Fase 2 (10/11/2026): recibo diverso — processo, compra avulsa, serviço pago pelo sindicato. */
  if (/recibo/.test(nomes) && /assinad/.test(nomes + " " + texto)) add("RECIBO_ASSINADO", "tem recibo assinado anexo");
  else if (/\brecibo\b/.test(texto) || /(chave )?pix|dados bancarios|(segue|seguem) (os )?dados para (o )?pagamento/.test(texto)) add("RECIBO", "o e-mail fala de pagamento/recibo");
  return out;
}

/** O atalho mais usado pela equipe em e-mails deste card, na mesma caixa. */
function cxaMaisUsado_(card, caixa) {
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
    if (!sh || sh.getLastRow() < 2) return null;
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), c = v[0].map(String);
    var iT = c.indexOf("TAREFA"), iO = c.indexOf("ORIGEM"), iD = c.indexOf("DECIDIDO"), iE = c.indexOf("TIPO_EMAIL");
    var cont = {};
    v.slice(1).forEach(function (l) {
      if (String(l[iT]) !== "atalho-email" || String(l[iE]) !== card || String(l[iO]) !== caixa) return;
      var a = String(l[iD]); if (!CXA_ACOES[a]) return;
      cont[a] = (cont[a] || 0) + 1;
    });
    var melhor = null;
    Object.keys(cont).forEach(function (a) { if (cont[a] >= 2 && (!melhor || cont[a] > melhor.n)) melhor = { acao: a, n: cont[a] }; });
    return melhor;
  } catch (e) { return null; }
}

/** A barra de atalhos do e-mail aberto. */
function caixaAtalhos(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    cxsExigirCaixaDe_(sessao, id);
    var p = cxsLinhaPonte_(id);
    if (!p) return { ok: false, mensagem: "Conversa não encontrada na Caixa." };
    var est = cxsEstados_()[String(id)];
    var temAnexo = vpeJson_(p.ANEXOS_JSON, []).length > 0;
    var todas = CXA_ORDEM.filter(function (k) {
      var a = CXA_ACOES[k];
      return cxaPode_(sessao, a) && !(a.precisaAnexo && !temAnexo);
    });
    var sug = cxaSugestoes_(p, est, todas);
    return { ok: true, sugeridos: sug.map(function (s) { var a = CXA_ACOES[s.acao];
               return { acao: s.acao, rotulo: a.rotulo, icone: a.icone, motivo: s.motivo, card: a.card || "" }; }),
             todas: todas.map(function (k) { var a = CXA_ACOES[k];
               return { acao: k, rotulo: a.rotulo, icone: a.icone, grupo: a.grupo, card: a.card || "" }; }),
             semAnexo: !temAnexo };
  } catch (e) {
    return { ok: false, mensagem: e.message, sugeridos: [], todas: [] };
  }
}

/** A pessoa clicou num atalho: fica na memória do robô (o que ele sugeriu × o que ela usou). */
function caixaAtalhoUsado(id, acao, sugerido, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    cxsExigirCaixaDe_(sessao, id);
    if (!CXA_ACOES[acao]) return { ok: false, mensagem: "Atalho inválido." };
    var p = cxsLinhaPonte_(id);
    var est = cxsEstados_()[String(id)];
    var msgs = p ? vpeJson_(p.MENSAGENS_JSON, []) : [];
    var de = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; })[0] || msgs[0] || {};
    roboMemoriaRegistrar_({ tarefa: "atalho-email", origem: String((p && p.CAIXA) || "SECRETARIA"), chave: String(id),
      remetente: "", assunto: de.assunto, sugerido: CXA_ACOES[sugerido] ? sugerido : "", decidido: acao,
      quem: sessao.email || sessao.usuario || "", tipoEmail: p ? cxsTipoDoEmail_(p, est) : "" });
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
