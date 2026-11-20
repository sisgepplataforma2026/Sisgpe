/* ================================================================
   HISTÓRICO DE ENVIO DO VOUCHER — 31/10/2026
   ================================================================
   O usuário: "tem que registrar, a partir do momento que foi enviado para o
   e-mail ... voucher enviado ... em face da fulana, do beneficiário XYZ,
   dependente ABC ... quando que foi enviado, por quem, qual usuário ... um
   dia, se tiver uma denúncia no Ministério Público, a gente tem de onde tirar
   a informação." E: "não quero que tenha bastante módulo" — por isso NÃO há
   tela nova: o histórico aparece na ficha do voucher e na lista de
   Solicitações que já existem (mockup docs/mock-historico-envio-voucher.png,
   aprovado em 31/10/2026).

   O registro é a aba Voucher_Historico, que já existia e é só de acréscimo
   (registrarHistoricoVoucher_): aqui só se ACRESCENTA linha — nunca se edita
   nem apaga. Os eventos de envio:
     EMAIL_NA_FILA   — alguém clicou para enviar; a resposta entrou na fila da
                       caixa da Secretaria (ref = ID da fila na ponte).
     EMAIL_SAIU      — o leitor confirmou que a mensagem saiu da caixa
                       (data/hora = a da saída, não a do clique).
     EMAIL_ERRO      — o leitor não conseguiu enviar (com o motivo).
     ENVIO_EMAIL     — envio direto pelo módulo Voucher (sem fila).
     ENVIO_WHATSAPP_ABERTO — o WhatsApp foi aberto com a mensagem.
   ================================================================ */

var VOUCHER_HIST_ENVIO_ACOES = ["EMAIL_NA_FILA", "EMAIL_SAIU", "EMAIL_ERRO", "ENVIO_EMAIL", "ENVIO_WHATSAPP_ABERTO"];

/* Acrescenta uma linha no Voucher_Historico, com a data/hora que se quiser
   (a da saída real, quando vem do leitor). Puxa id, CPF e nome da
   solicitação para a linha se bastar sozinha numa exportação. Nunca lança. */
function voucherHistoricoAnotar_(protocolo, acao, usuario, obs, quando) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("Voucher_Historico");
    if (!sh) return false;
    var sol = voucherLinhaPorProtocolo_(ss, VOUCHER_ABA_SOLICITACOES, protocolo) || {};
    var nome = String(sol.NOME_BENEFICIARIO || sol.NOME_SOLICITANTE || sol.NOME || "");
    sh.appendRow([gerarIdPadrao_("HIS"), quando || new Date(), String(sol.ID_SOLICITACAO || ""), String(protocolo || ""),
                  String(sol.CPF_SOLICITANTE || sol.CPF || ""), nome, String(acao || ""), String(usuario || ""), String(obs || "")]);
    return true;
  } catch (e) {
    Logger.log("Histórico de envio não gravado (" + protocolo + "): " + e.message);
    return false;
  }
}

function voucherHistoricoLinhas_() {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Voucher_Historico");
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = v[0].map(String);
  return v.slice(1).map(function (l) {
    var o = {};
    cab.forEach(function (c, i) { o[c] = l[i]; });
    return o;
  });
}

/**
 * Confere na fila da ponte o que o leitor já enviou (ou não conseguiu) e
 * acrescenta EMAIL_SAIU / EMAIL_ERRO uma vez só por envio. Chamado ao abrir
 * a ficha, a lista e no ciclo de leitura — o registro chega sozinho.
 */
function voucherHistoricoConfirmarSaidas_() {
  try {
    var hist = voucherHistoricoLinhas_();
    var naFila = {}, fechado = {};
    hist.forEach(function (h) {
      var ref = (String(h.OBSERVACOES || "").match(/ref (ENV_[A-Z0-9]+)/) || [])[1];
      if (!ref) return;
      if (h.ACAO === "EMAIL_NA_FILA") naFila[ref] = h;
      if (h.ACAO === "EMAIL_SAIU" || h.ACAO === "EMAIL_ERRO") fechado[ref] = true;
    });
    var abertos = Object.keys(naFila).filter(function (r) { return !fechado[r]; });
    if (!abertos.length || !vpePonteId_()) return 0;
    var porId = {};
    vpeLinhas_(vpePonteAba_("Saida")).forEach(function (s) { porId[String(s.ID)] = s; });
    var n = 0;
    abertos.forEach(function (ref) {
      var s = porId[ref], h = naFila[ref];
      if (!s) return;
      var st = String(s.STATUS || "").toUpperCase();
      if (st === "ENVIADO") {
        voucherHistoricoAnotar_(h.NUMERO_PROTOCOLO, "EMAIL_SAIU", "leitor da caixa (secretaria@)",
          "Saiu da caixa da Secretaria para " + (String(h.OBSERVACOES).split(" · ")[0] || "") + " · ref " + ref,
          s.PROCESSADO_EM ? new Date(s.PROCESSADO_EM) : new Date());
        n++;
      } else if (st === "ERRO" || st === "RECUSADO") {
        voucherHistoricoAnotar_(h.NUMERO_PROTOCOLO, "EMAIL_ERRO", "leitor da caixa (secretaria@)",
          "Não saiu: " + String(s.DETALHE || st) + " · ref " + ref, s.PROCESSADO_EM ? new Date(s.PROCESSADO_EM) : new Date());
        n++;
      }
    });
    return n;
  } catch (e) {
    Logger.log("Confirmação de saídas do voucher: " + e.message);
    return 0;
  }
}

var VOUCHER_HIST_ROTULOS = {
  SOLICITACAO_CRIADA: "Solicitação registrada", PEDIDO_POR_EMAIL: "Pedido por e-mail registrado",
  SOLICITACAO_APROVADA: "Aprovada", ASSOCIACAO_CONFIRMADA: "Filiação confirmada",
  CADASTRO_CONFIRMADO: "Cadastro confirmado", COMPLEMENTACAO_SOLICITADA: "Documento pedido",
  PERCENTUAL_AJUSTADO: "Percentual ajustado", VOUCHER_EMITIDO: "Conferido e emitido",
  VOUCHER_REDATADO: "Voucher refeito com a data do envio",
  EMAIL_NA_FILA: "Entrou na fila de envio", EMAIL_SAIU: "Saiu da caixa", EMAIL_ERRO: "Erro no envio",
  ENVIO_EMAIL: "Enviado por e-mail", ENVIO_WHATSAPP_ABERTO: "WhatsApp aberto com a mensagem",
  DOCUMENTO_ENVIADO: "Documento enviado", SOLICITACAO_INDEFERIDA: "Indeferida",
  SOLICITACAO_EXCLUIDA: "Excluída", EMAIL_ESCOLA_ENVIADO: "Ofício enviado à escola"
};

/** A linha do tempo de um voucher, para a ficha (Caixa de E-mails ou Voucher). */
function voucherHistoricoProtocolo(protocolo, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    protocolo = String(protocolo || "").trim();
    if (!protocolo) return { ok: true, eventos: [] };
    voucherHistoricoConfirmarSaidas_();
    var tz = "America/Sao_Paulo";
    var ev = [];
    /* O pedido que chegou por e-mail: quando e de quem. */
    try {
      var ped = vpeLinhaPor_(vpeAba_(), "PROTOCOLO", protocolo);
      if (ped && ped.RECEBIDO_EM) {
        ev.push({ ts: new Date(ped.RECEBIDO_EM).getTime(), acao: "PEDIDO_RECEBIDO", rotulo: "Pedido recebido",
                  quem: String(ped.REMETENTE_EMAIL || ""), detalhe: "e-mail de " + String(ped.REMETENTE_EMAIL || "") });
      }
    } catch (eP) {}
    voucherHistoricoLinhas_().forEach(function (h) {
      if (String(h.NUMERO_PROTOCOLO) !== protocolo) return;
      var d = h.DATA_HORA instanceof Date ? h.DATA_HORA : new Date(h.DATA_HORA);
      ev.push({ ts: d.getTime() || 0, acao: String(h.ACAO || ""),
                rotulo: VOUCHER_HIST_ROTULOS[h.ACAO] || String(h.ACAO || "").replace(/_/g, " ").toLowerCase(),
                quem: String(h.USUARIO_RESPONSAVEL || ""), detalhe: String(h.OBSERVACOES || "").replace(/ · ref ENV_[A-Z0-9]+/, "") });
    });
    ev.sort(function (a, b) { return a.ts - b.ts; });
    ev.forEach(function (e) { e.quando = e.ts ? Utilities.formatDate(new Date(e.ts), tz, "dd/MM/yyyy HH:mm") : ""; });
    return { ok: true, eventos: ev };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* O último envio de cada protocolo, para a coluna "Enviado em / por" da
   lista de Solicitações: situação (ENVIADO, NA_FILA, ERRO, WHATSAPP), quando,
   quem e para onde. */
function voucherUltimosEnvios_() {
  var tz = "America/Sao_Paulo", m = {};
  voucherHistoricoLinhas_().forEach(function (h) {
    if (VOUCHER_HIST_ENVIO_ACOES.indexOf(String(h.ACAO)) === -1) return;
    var d = h.DATA_HORA instanceof Date ? h.DATA_HORA : new Date(h.DATA_HORA);
    var p = String(h.NUMERO_PROTOCOLO || ""), atual = m[p];
    var sit = { EMAIL_NA_FILA: "NA_FILA", EMAIL_SAIU: "ENVIADO", EMAIL_ERRO: "ERRO", ENVIO_EMAIL: "ENVIADO",
                ENVIO_WHATSAPP_ABERTO: "WHATSAPP" }[h.ACAO];
    var obs = String(h.OBSERVACOES || "");
    var para = (obs.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [""])[0];
    var quem = String(h.USUARIO_RESPONSAVEL || "");
    /* O "por" é de quem clicou (a saída é do leitor): guarda o da fila. */
    if (atual && h.ACAO === "EMAIL_SAIU") { atual.situacao = "ENVIADO"; atual.ts = d.getTime(); return; }
    if (atual && h.ACAO === "EMAIL_ERRO") { atual.situacao = "ERRO"; atual.erro = obs.replace(/ · ref ENV_[A-Z0-9]+/, ""); return; }
    m[p] = { situacao: sit, ts: d.getTime(), por: quem, para: para || (atual && atual.para) || "" };
  });
  Object.keys(m).forEach(function (p) { m[p].em = m[p].ts ? Utilities.formatDate(new Date(m[p].ts), tz, "dd/MM/yyyy HH:mm") : ""; });
  return m;
}
