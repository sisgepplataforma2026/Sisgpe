// ============================================================================
// ARQUIVO: VoucherLote.gs
// EMITIR EM LOTE, E A DATA DO DOCUMENTO SER A DO DIA EM QUE ELE SAI
// ============================================================================
//
// DE ONDE VEIO, 29/10/2026. O usuário:
//
//   "preciso emitir todos e quando forem enviar ele deve sair com a data de
//    envio, preciso enviar pelo email que solicitou"
//
// e, nas respostas: retirada presencial sai com a data em que é IMPRESSO
// para entregar; a cópia para a instituição é opcional, "mas tem que ter o
// email".
//
// O PROBLEMA QUE ISTO RESOLVE. Até aqui o certificado nascia com a data da
// emissão e nunca mais mudava — `gerarDocumentoVoucher` devolve o PDF já
// guardado quando o protocolo é emitido de novo. Emitir o semestre inteiro
// numa segunda-feira e enviar ao longo da semana faria o associado receber,
// na sexta, um documento datado de segunda.
//
// A SAÍDA: o documento é REFEITO no dia em que sai (envio ou impressão), com
// o MESMO protocolo e o MESMO código de validação. O QR continua apontando
// para o mesmo registro, então nada do que a escola confere muda — só a data
// impressa. O PDF antigo fica na pasta (não se apaga documento emitido); a
// linha de Voucher_Emitidos passa a apontar para o novo, e DATA_DOCUMENTO diz
// a data que está no papel. DATA_EMISSAO continua sendo quando se emitiu.
// ============================================================================

var VOUCHER_LOTE_LIMITE_MS = 240000;   // folga para o teto de 6 min do Apps Script

/* UM LOTE POR VEZ — SEM LockService. A emissão e o envio pegam a trava do
   script por dentro (voucherAnotarEnvioNaObservacao_, a atualização de
   status...), e no Apps Script pedir a mesma trava de novo na mesma execução
   FALHA: com o lote segurando-a, cada envio esperaria 10 s e perderia a
   anotação calado. O emulador reproduz isso (tests/e2e/gas.js). Aqui basta
   uma marca com validade: o que se evita é dois lotes ao mesmo tempo. */
var VOUCHER_LOTE_MARCA = "VOUCHER_LOTE_EM_ANDAMENTO";
function voucherLoteTravar_() {
  var c = CacheService.getScriptCache();
  if (c.get(VOUCHER_LOTE_MARCA)) return false;
  c.put(VOUCHER_LOTE_MARCA, String(Date.now()), 330);
  return true;
}
function voucherLoteSoltar_() {
  try { CacheService.getScriptCache().remove(VOUCHER_LOTE_MARCA); } catch (e) {}
}

/** "yyyy-MM-dd" no fuso do sindicato — o que decide se é "o mesmo dia". */
function voucherDiaDe_(d) {
  if (Object.prototype.toString.call(d) !== "[object Date]" || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd");
}

/** Linha de Voucher_Emitidos do protocolo, com o número da linha e os cabeçalhos. */
function voucherLinhaEmitido_(protocolo) {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Voucher_Emitidos");
  if (!sh || sh.getLastRow() < 2) return null;
  var dados = sh.getDataRange().getValues();
  var cab = dados[0].map(function (h) { return String(h || "").trim(); });
  var iProt = cab.indexOf("PROTOCOLO");
  if (iProt < 0) return null;
  /* De baixo para cima, como buscarVoucherEmitidoPorProtocolo_: se houver
     duas linhas do mesmo protocolo, vale a mais recente. */
  for (var i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][iProt] || "").trim() === protocolo) {
      var obj = {};
      cab.forEach(function (h, j) { obj[h] = dados[i][j]; });
      return { sh: sh, linha: i + 1, cab: cab, reg: obj };
    }
  }
  return null;
}

/**
 * Deixa o documento datado de `quando`, refazendo o PDF se a data no papel
 * for de outro dia. Devolve o link que vale e o HTML desse documento.
 *
 * NUNCA gera código novo e nunca muda o percentual: os dois saem do registro
 * da emissão. O HTML do certificado só lê protocolo, código, percentual, RG,
 * data e a linha da solicitação — então o documento refeito é o mesmo papel
 * com outra data, não uma emissão nova.
 */
function voucherRedatarDocumento_(protocolo, quando, motivo, usuario) {
  protocolo = String(protocolo || "").trim();
  var emi = voucherLinhaEmitido_(protocolo);
  if (!emi) return { ok: false, mensagem: "O protocolo " + protocolo + " ainda não foi emitido." };

  var item = buscarSolicitacaoPorProtocolo_(protocolo);
  if (!item) return { ok: false, mensagem: "Solicitação " + protocolo + " não encontrada." };
  var reg = item.registro;

  var percentual = Number(String(emi.reg.PERCENTUAL !== "" && emi.reg.PERCENTUAL !== undefined
    ? emi.reg.PERCENTUAL : reg.PERCENTUAL_APLICADO).replace("%", "").replace(",", "."));
  var dadosDoc = {
    protocolo: protocolo,
    codigo: String(emi.reg.CODIGO_VALIDACAO || ""),
    tipoDocumento: "VOUCHER",
    dataEmissao: quando,
    usuario: usuario,
    rg: valorSeguroVoucher_(reg.RG_SOLICITANTE || ""),
    percentual: percentual,
    documentos: [],
    observacao: "",
    reg: reg
  };
  var html = gerarHtmlDocumentoVoucher_(dadosDoc);

  var dataNoPapel = emi.reg.DATA_DOCUMENTO || emi.reg.DATA_EMISSAO;
  if (voucherDiaDe_(dataNoPapel) === voucherDiaDe_(quando)) {
    return { ok: true, redatado: false, linkPdf: String(emi.reg.LINK_ARQUIVO || ""), html: html };
  }

  /* Mesmo nome que a emissão dá ao arquivo — data primeiro, depois para
     quem — para a pasta continuar em ordem e a busca pelo nome achar os dois. */
  var benef = String(reg.NOME_BENEFICIARIO || "").trim();
  var titular = String(reg.NOME_SOLICITANTE || "").trim();
  var paraQuem = benef && benef.toUpperCase() !== titular.toUpperCase()
    ? benef + " (dependente de " + titular + ")" : titular;
  var pdf = salvarHtmlComoPdfVoucher_(html,
    voucherDiaDe_(quando) + " - Voucher Bolsa - " + protocolo + " - " + paraQuem);

  var iLink = emi.cab.indexOf("LINK_ARQUIVO");
  var iData = emi.cab.indexOf("DATA_DOCUMENTO");
  if (iLink > -1) emi.sh.getRange(emi.linha, iLink + 1).setValue(pdf.url);
  if (iData > -1) emi.sh.getRange(emi.linha, iData + 1).setValue(quando);

  var dataTexto = Utilities.formatDate(quando, "America/Sao_Paulo", "dd/MM/yyyy");
  registrarHistoricoVoucher_(reg.ID_SOLICITACAO, reg.CPF_SOLICITANTE, "VOUCHER_REDATADO", usuario,
    "Documento datado de " + dataTexto + " para " + motivo + ". Mesmo protocolo e mesmo código (" +
    dadosDoc.codigo + "); o PDF anterior continua na pasta.", protocolo);

  return { ok: true, redatado: true, linkPdf: pdf.url, html: html };
}

/**
 * O certificado já emitido, datado de hoje, para imprimir e entregar.
 * Retirada presencial: "a data é a do dia em que imprimir para entregar".
 */
function voucherDocumentoParaImpressao(protocolo, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "beneficios", false);
    var quem = (sessao && (sessao.email || sessao.usuario)) || obterUsuarioAtualVoucher_();
    var r = voucherRedatarDocumento_(protocolo, new Date(), "impressão e entrega", quem);
    if (!r.ok) return r;
    return { ok: true, html: r.html, linkPdf: r.linkPdf, redatado: r.redatado,
             dataDocumento: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy") };
  } catch (e) {
    Logger.log("voucherDocumentoParaImpressao: " + e.message);
    return { ok: false, mensagem: "Erro ao preparar a impressão: " + e.message };
  }
}

/**
 * Emite várias solicitações de uma vez.
 *
 * Cada uma passa pela MESMA emissão do botão "Gerar certificado" — com as
 * mesmas travas (período, percentual, situação) — e uma que recusa não
 * derruba as outras. Para no limite de tempo e devolve as `restantes`, que a
 * tela manda de novo: lote grande vira duas ou três chamadas, não um erro de
 * tempo esgotado no meio.
 */
function voucherEmitirEmLote(protocolos, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    if (!lista.length) return { ok: false, mensagem: "Nenhuma solicitação selecionada." };

    if (!voucherLoteTravar_()) {
      return { ok: false, mensagem: "Outro lote de vouchers está rodando. Tente de novo em um minuto." };
    }
    var inicio = Date.now();
    var emitidas = [], jaEmitidas = [], recusadas = [], restantes = [];
    try {
      for (var i = 0; i < lista.length; i++) {
        if (Date.now() - inicio > VOUCHER_LOTE_LIMITE_MS) { restantes = lista.slice(i); break; }
        var p = lista[i];
        var r;
        try { r = gerarDocumentoVoucher(p, "CERTIFICADO", {}); }
        catch (e) { r = { ok: false, mensagem: e.message }; }
        if (r && r.ok && r.reemitido) jaEmitidas.push(p);
        else if (r && r.ok) emitidas.push({ protocolo: p, presencial: !!r.retiradaPresencial });
        else recusadas.push({ protocolo: p, mensagem: (r && r.mensagem) || "Não emitiu." });
      }
    } finally {
      voucherLoteSoltar_();
    }
    return { ok: true, emitidas: emitidas, jaEmitidas: jaEmitidas,
             recusadas: recusadas, restantes: restantes };
  } catch (e) {
    Logger.log("voucherEmitirEmLote: " + e.message);
    return { ok: false, mensagem: "Erro na emissão em lote: " + e.message };
  }
}

// ============================================================================
// ENVIO EM LOTE — conferência antes, cota do dia, o resto continua amanhã
// ============================================================================
//
// Aprovado pelo usuário em 29/10/2026 com três ajustes:
//   1. respeitar a cota do dia SEM tirar e-mail dos ofícios: o lote usa o
//      governador de CotaEmail.gs (campanha "VOUCHER"), que deixa a reserva
//      para o resto do sistema; o que não couber continua amanhã sozinho;
//   2. quem já recebeu vem DESMARCADO — reenviar é decisão, não acidente;
//   3. nada sai sem a conferência: a tela sempre passa pelo preparo.

var VOUCHER_LOTE_CAMPANHA = "VOUCHER";
var VOUCHER_LOTE_PROP_FILA = "VOUCHER_LOTE_FILA";
var VOUCHER_LOTE_HANDLER = "voucherEnvioLoteContinuar";

/** A situação de um protocolo para o envio em lote, com o motivo legível. */
function voucherSituacaoEnvio_(d) {
  if (!d.ok) return { situacao: "NAO_EMITIDO", motivo: "Ainda não emitido", marcado: false };
  if (d.presencial) return { situacao: "PRESENCIAL", motivo: "Retirada presencial — não envia", marcado: false };
  if (!d.emailAssociado) return { situacao: "SEM_EMAIL", motivo: "Sem e-mail — abrir e preencher", marcado: false };
  var porEmail = (d.envios || []).filter(function (e) { return /ENVIAR_EMAIL/.test(String(e.canal || "")); });
  if (porEmail.length) {
    return { situacao: "JA_ENVIADO", motivo: "Já enviado em " + porEmail[0].quando + " — marque para reenviar",
             marcado: false };
  }
  return { situacao: "PRONTO", motivo: "Pronto", marcado: true };
}

/** A lista da conferência. Não envia nada, não grava nada. */
function voucherEnvioLotePreparar(protocolos, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    var linhas = lista.map(function (p) {
      var d = voucherDadosEnvio_(p);
      var s = voucherSituacaoEnvio_(d);
      return {
        protocolo: p,
        nome: d.ok ? d.nome : "",
        para: d.ok ? d.emailAssociado : "",
        emailInstituicao: d.ok ? d.emailInstituicao : "",
        origemEmailInstituicao: d.ok ? d.origemEmailInstituicao : "",
        situacao: s.situacao, motivo: s.motivo, marcado: s.marcado,
        podeEnviar: s.situacao === "PRONTO" || s.situacao === "JA_ENVIADO"
      };
    });
    var orc = cotaEmail_orcamentoDoDia_(VOUCHER_LOTE_CAMPANHA);
    return { ok: true, linhas: linhas,
             dataDoEnvio: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy"),
             cota: { disponivel: orc.disponivel, reserva: orc.reserva, mensagem: orc.mensagem },
             filaPendente: voucherFilaLer_().itens.length };
  } catch (e) {
    Logger.log("voucherEnvioLotePreparar: " + e.message);
    return { ok: false, mensagem: "Erro ao preparar o envio em lote: " + e.message };
  }
}

/** Envia os marcados. O que não couber na cota de hoje fica na fila e sai amanhã. */
function voucherEnvioLoteExecutar(protocolos, opcoes, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "beneficios", false);
    opcoes = opcoes || {};
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    if (!lista.length) return { ok: false, mensagem: "Nenhum certificado marcado para enviar." };
    var quem = (sessao && (sessao.email || sessao.usuario)) || "";

    if (!voucherLoteTravar_()) return { ok: false, mensagem: "Outro lote de vouchers está rodando. Tente de novo em um minuto." };
    try {
      var r = voucherEnvioLoteProcessar_(lista, !!opcoes.copiaInstituicao, quem);
      if (r.restantes.length) voucherFilaAcrescentar_(r.restantes, !!opcoes.copiaInstituicao, quem, r.porCota);
      return voucherEnvioLoteResumo_(r);
    } finally {
      voucherLoteSoltar_();
    }
  } catch (e) {
    Logger.log("voucherEnvioLoteExecutar: " + e.message);
    return { ok: false, mensagem: "Erro no envio em lote: " + e.message };
  }
}

/** O laço. Para na cota (PARE: não gasta tentativa de ninguém) ou no tempo. */
function voucherEnvioLoteProcessar_(lista, copiaInstituicao, quem) {
  var inicio = Date.now();
  var enviados = [], pulados = [], restantes = [], porCota = false;
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    if (Date.now() - inicio > VOUCHER_LOTE_LIMITE_MS) { restantes = lista.slice(i); break; }
    var d = voucherDadosEnvio_(p);
    var s = voucherSituacaoEnvio_(d);
    if (s.situacao !== "PRONTO" && s.situacao !== "JA_ENVIADO") {
      pulados.push({ protocolo: p, motivo: s.motivo }); continue;
    }
    if (copiaInstituicao && !d.emailInstituicao) {
      pulados.push({ protocolo: p, motivo: "Cópia marcada, mas sem e-mail da instituição — abrir e preencher" });
      continue;
    }
    var precisa = copiaInstituicao ? 2 : 1;
    if (cotaEmail_quantosCabem_(VOUCHER_LOTE_CAMPANHA, precisa).cabem < precisa) {
      restantes = lista.slice(i); porCota = true; break;
    }
    var r = voucherEnviarPorEmail_(p, {
      enviarInstituicao: copiaInstituicao,
      copia: copiaInstituicao ? d.emailInstituicao : "",
      campanhaCota: VOUCHER_LOTE_CAMPANHA
    }, { email: quem, usuario: quem });
    if (r && r.ok) enviados.push({ protocolo: p, para: r.para, copia: r.copia });
    else pulados.push({ protocolo: p, motivo: (r && r.mensagem) || "Não enviou." });
  }
  return { enviados: enviados, pulados: pulados, restantes: restantes, porCota: porCota };
}

function voucherEnvioLoteResumo_(r) {
  var msg = r.enviados.length + " certificado(s) enviado(s).";
  if (r.pulados.length) msg += " " + r.pulados.length + " ficaram de fora (motivo na lista).";
  if (r.restantes.length) {
    msg += " " + r.restantes.length + (r.porCota
      ? " saem amanhã de manhã, sozinhos — a cota de e-mail de hoje chegou ao limite que preserva os ofícios."
      : " continuam em instantes, sozinhos.");
  }
  return { ok: true, mensagem: msg, enviados: r.enviados, pulados: r.pulados,
           agendados: r.restantes.length, porCota: r.porCota };
}

/* ── A fila do que ficou para depois ─────────────────────────────────────── */

function voucherFilaLer_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(VOUCHER_LOTE_PROP_FILA);
    var f = v ? JSON.parse(v) : null;
    return (f && Array.isArray(f.itens)) ? f : { itens: [] };
  } catch (e) { return { itens: [] }; }
}

function voucherFilaGravar_(fila) {
  var props = PropertiesService.getScriptProperties();
  if (!fila.itens.length) props.deleteProperty(VOUCHER_LOTE_PROP_FILA);
  else props.setProperty(VOUCHER_LOTE_PROP_FILA, JSON.stringify(fila));
}

/** Cada item guarda a própria escolha de cópia e quem mandou — dois lotes
    com escolhas diferentes não se misturam na fila. */
function voucherFilaAcrescentar_(protocolos, copiaInstituicao, quem, porCota) {
  var fila = voucherFilaLer_();
  var ja = fila.itens.map(function (i) { return i.p; });
  protocolos.forEach(function (p) {
    if (ja.indexOf(p) === -1) fila.itens.push({ p: p, c: copiaInstituicao, q: quem });
  });
  voucherFilaGravar_(fila);
  voucherAgendarContinuacao_(porCota);
}

/** Um gatilho só, de uma vez: amanhã 08h quando parou na cota, 1 minuto quando parou no tempo. */
function voucherAgendarContinuacao_(porCota) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === VOUCHER_LOTE_HANDLER) ScriptApp.deleteTrigger(t);
  });
  var quando;
  if (porCota) {
    quando = new Date();
    quando.setDate(quando.getDate() + 1);
    quando.setHours(8, 0, 0, 0);
  } else {
    quando = new Date(Date.now() + 60000);
  }
  ScriptApp.newTrigger(VOUCHER_LOTE_HANDLER).timeBased().at(quando).create();
}

/**
 * Continuação agendada. Sem sessão: roda pelo gatilho e só envia o que
 * alguém conferiu e mandou enviar na tela — a fila não aceita item de outro
 * lugar. Chamada à toa, com a fila vazia, não faz nada.
 */
function voucherEnvioLoteContinuar() {
  if (!voucherLoteTravar_()) { voucherAgendarContinuacao_(false); return; }
  try {
    var fila = voucherFilaLer_();
    if (!fila.itens.length) return;
    var inicio = Date.now(), processados = 0, porCota = false, k = 0;
    /* Um item por vez, na ordem da fila: cada um carrega a própria escolha de
       cópia e quem mandou. Para na cota (amanhã) ou no tempo (daqui a 1 min). */
    for (; k < fila.itens.length; k++) {
      if (Date.now() - inicio > VOUCHER_LOTE_LIMITE_MS) break;
      var it = fila.itens[k];
      var r = voucherEnvioLoteProcessar_([it.p], !!it.c, it.q || "gatilho");
      if (r.restantes.length) { porCota = r.porCota; break; }
      processados++;
    }
    fila.itens = fila.itens.slice(k);
    voucherFilaGravar_(fila);
    if (fila.itens.length) voucherAgendarContinuacao_(porCota);
    Logger.log("voucherEnvioLoteContinuar: " + processados + " processados, " + fila.itens.length + " na fila.");
  } catch (e) {
    Logger.log("voucherEnvioLoteContinuar: " + e.message);
  } finally {
    voucherLoteSoltar_();
  }
}
