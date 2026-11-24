/* ================================================================
   PAINEL DO DIA — SÓ RESUMO, LIDO DA CAIXA DE E-MAILS (03/11/2026)
   ================================================================
   Decisão de 30/10/2026: "Painel do Dia fica só como resumo". Até aqui ele
   usava o motor da Central antiga (getCockpit / sisgepListarEmailsIA, em
   CentralEmailIA.gs), com categorias e IA próprias, e não refletia nada da
   Caixa. O usuário aprovou o desenho (03/11/2026, "Aprovo"): os números
   saem das MESMAS funções da Caixa, com a mesma trava de "cada um com a sua
   caixa" — então os dois sempre batem. Sem IA própria aqui.
     - cards = os mesmos da Caixa (clicar abre a Caixa filtrada);
     - "precisa de você hoje" = os novos mais antigos sem resposta;
     - vouchers (quem vê a secretaria@);
     - o robô: taxa de acerto por tarefa (o "Medir" da diretriz do robô).
   CentralEmailIA.gs e CockpitInteligente.html ficam (REGRA 1).
   ================================================================ */

var PDD_TAREFAS = {
  "categoria-email": "Categoria do e-mail",
  "resposta-email": "Resposta enviada sem mudança",
  "voucher-falta": "Documentos que faltam (voucher)",
  "voucher-texto": "Texto do voucher sem mudança",
  "comprovante-conferido": "Leitura de comprovante",
  "oficio-email": "Ofício preparado do e-mail sem mudança",
  "atalho-email": "Atalho sugerido no e-mail",
  "recibo-email": "Recibo diverso preenchido sem mudança",
  "diretor-visita": "Diretor da visita sugerido certo"
};
var PDD_DIAS_ROBO = 90;

function pddRobo_(caixa) {
  var out = [];
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
    if (!sh || sh.getLastRow() < 2) return out;
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var c = v[0].map(String), iE = c.indexOf("EM"), iT = c.indexOf("TAREFA"), iO = c.indexOf("ORIGEM"),
        iS = c.indexOf("SUGERIDO"), iA = c.indexOf("ACERTOU");
    var desde = Date.now() - PDD_DIAS_ROBO * 86400000, cont = {};
    v.slice(1).forEach(function (l) {
      var t = String(l[iT] || "");
      if (!PDD_TAREFAS[t] || !String(l[iS] || "")) return;          // só onde o robô sugeriu algo
      if (caixa && l[iO] && String(l[iO]) !== caixa) return;
      var em = l[iE] instanceof Date ? l[iE].getTime() : new Date(l[iE]).getTime();
      if (em && em < desde) return;
      cont[t] = cont[t] || { n: 0, ok: 0 };
      cont[t].n++;
      if (String(l[iA]) === "SIM") cont[t].ok++;
    });
    Object.keys(PDD_TAREFAS).forEach(function (t) {
      if (cont[t]) out.push({ tarefa: t, rotulo: PDD_TAREFAS[t], n: cont[t].n, pct: Math.round(100 * cont[t].ok / cont[t].n) });
    });
  } catch (e) {}
  return out;
}

function pddHa_(ts) {
  var min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return "há " + min + " min";
  var h = Math.round(min / 60);
  if (h < 48) return "há " + h + "h";
  return "há " + Math.round(h / 24) + " dias";
}

/** O resumo do dia, para quem está logado, tirado da Caixa de E-mails. */
function caixaResumoDoDia(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var p = caixaSecretariaPainel(tokenSessao);
    if (!p.ok) return p;
    var itens = (p.itens || []).slice();
    var erroFin = "";
    if (p.veFinanceiro !== false) {
      var f = caixaFinanceiroItens(tokenSessao);
      if (f.ok) itens = itens.concat(f.itens || []); else erroFin = f.mensagem;
    }
    /* "a tratar" = o que espera a equipe: respondido sai (03/11/2026). */
    var emails = itens.filter(function (i) { return i.fonte === "EMAIL" && i.estado === "NOVO"; });
    var inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    var porTipo = {};
    emails.forEach(function (i) { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1; });
    var cards = (p.tipos || []).filter(function (t) { return t.chave !== "VOUCHER" && porTipo[t.chave]; })
      .map(function (t) { return { chave: t.chave, rotulo: (p.veSecretaria === false && t.rotuloFin) || t.curto || t.rotulo, icone: t.icone, n: porTipo[t.chave] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var precisa = emails.filter(function (i) { return i.estado === "NOVO"; })
      .sort(function (a, b) { return (a.recebidoTs || 0) - (b.recebidoTs || 0); })
      .slice(0, 5).map(function (i) {
        return { id: i.id, nome: i.nome || i.de, assunto: i.assunto, icone: i.icone, ha: i.recebidoTs ? pddHa_(i.recebidoTs) : "" };
      });
    var papel = p.meuPapel;
    var caixaRotulo = papel === "FINANCEIRO" ? "financeiro@sindeducacao.com" : papel === "SECRETARIA" ? "secretaria@sindeducacao.com" :
      "secretaria@ e financeiro@";
    var v = p.voucher || {}, vc = v.cont || {};
    var propostas = 0;
    if (p.veFinanceiro !== false) {
      /* Só a proposta já feita hoje: o Painel nunca chama a IA. */
      var pg = vpeJson_(PropertiesService.getScriptProperties().getProperty("CXC_PROPOSTA_FIN"), null);
      var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
      if (pg && pg.dia === hoje) { var pr = caixaPropostasCards(tokenSessao); propostas = pr.ok ? pr.propostas.length : 0; }
    }
    return {
      ok: true, caixa: caixaRotulo, nome: String(sessao.nome || sessao.usuario || "").split(/\s+/)[0],
      aTratar: emails.length,
      novosHoje: emails.filter(function (i) { return i.estado === "NOVO" && (i.recebidoTs || 0) >= inicioDia.getTime(); }).length,
      cards: cards, precisa: precisa, propostas: propostas,
      voucher: v.pode ? { aConferir: p.voucherAConferir || 0, emitidos: vc.EMITIDO || 0 } : null,
      robo: pddRobo_(papel || ""), erroFinanceiro: erroFin || p.erroFinanceiro || ""
    };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** A medição do robô no rodapé da Caixa (03/11/2026: o Painel do Dia saiu do
    menu e o "Medir" da diretriz precisava de lugar). Só lê Robo_Memoria. */
function caixaRoboMedicao(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    return { ok: true, robo: pddRobo_(cxsMeuPapel_(sessao) || "") };
  } catch (err) {
    return { ok: false, mensagem: err.message, robo: [] };
  }
}
