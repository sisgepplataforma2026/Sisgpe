/* ================================================================
   ATALHOS NO E-MAIL — FASE 2: RECIBO DIVERSO (10/11/2026)
   ================================================================
   O usuário: "vamos para a fase 2, recibo diverso"; o recibo "pode ser de
   processo, compras avulsas e etc."; quem recebe o recibo é "quem recebeu
   do sindicato" (o beneficiário, que assina); "2 - sim" (dois botões: só
   gerar / gerar e enviar ao beneficiário); vale para a secretaria@ "e
   financeiro".

   Dois atalhos, pelo MESMO módulo de Recibos Diversos (ReciboDiversos.gs):
     1. "Fazer recibo diverso" — o robô lê o e-mail e preenche nome,
        CPF/CNPJ, valor, descrição, forma, chave PIX e e-mail, cada um com a
        ORIGEM à vista; o que não achar fica vazio (não inventa). A pessoa
        confere e: "Só gerar" (gerarReciboDiverso SEM e-mail — o módulo manda
        sozinho quando tem e-mail) ou "Gerar e enviar ao beneficiário".
     2. "Recibo assinado → contabilidade" — o e-mail traz o recibo assinado:
        o robô acha o recibo PENDENTE de assinatura (pelo e-mail de quem
        mandou ou pelo número citado; sem certeza, a pessoa escolhe);
        "Só anexar" (salvarAnexoAssinadoDiverso + marcar assinado) ou
        "Anexar e enviar à contabilidade" (enviarReciboDiversoContabilidade,
        para a mesma contabilidade das Despesas).
   Nada sai sem o "Conferi" e o clique. Memória do robô: "recibo-email"
   (o que ele preencheu × o que foi gerado) e "recibo-assinado".
   Pede o módulo Documentos (as funções do módulo já exigem).
   ================================================================ */

function cxrDig_(s) { return String(s || "").replace(/\D/g, ""); }
function cxrValorBR_(v) {
  var s = String(v == null ? "" : v).replace(/[^\d,.\-]/g, "");
  if (!s) return "";
  if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
  var n = Number(s);
  return isFinite(n) && n > 0 ? n.toFixed(2).replace(".", ",") : "";
}
function cxrDocValido_(d) {
  d = cxrDig_(d);
  if (d.length === 11) return typeof validarCPFSindicalizacao_ === "function" ? validarCPFSindicalizacao_(d) : true;
  return d.length === 14;
}
function cxrAssinatura_(o) {
  return [cxrDig_(o.pagadorDoc), cxrValorBR_(o.valor), String(o.formaPgto || "").toUpperCase()].join("|");
}

/** O que o robô preparou do e-mail para o recibo diverso. */
function caixaReciboDoEmail(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "documentos", false);
    var conv = cxfConversa_(id, sessao);
    var de = conv.ultimo || {};
    var deFora = conv.msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; });
    var base = deFora[deFora.length - 1] || de;
    var texto = deFora.map(function (m) { return "Assunto: " + (m.assunto || "") + "\n" + String(m.corpo || "").substring(0, 3000); }).join("\n---\n");
    var lido = {};
    try {
      lido = vpeChamarIA_("Um sindicato vai emitir um RECIBO para a pessoa (ou empresa) que RECEBEU um pagamento dele (processo, compra avulsa, serviço). " +
        "Do e-mail abaixo, tire SÓ o que estiver escrito; não invente. Responda SOMENTE com JSON: " +
        "{\"nome\":\"\",\"documento\":\"CPF ou CNPJ, só dígitos\",\"valor\":\"número\",\"descricao\":\"a que se refere, curto\"," +
        "\"forma\":\"PIX|DINHEIRO|CHEQUE|TRANSFERENCIA ou vazio\",\"pix\":\"chave PIX ou vazio\"}\n\nE-MAIL:\n" + texto.substring(0, 6000), [], "recibo-email") || {};
    } catch (eIA) { lido = {}; }
    var campo = function (v, origem) { return { valor: String(v || ""), origem: v ? origem : "não achei no e-mail — preencha" }; };
    var nome = String(lido.nome || "").trim(), nomeOrig = "lido no e-mail";
    if (!nome) { nome = cxsNome_(base.de) || ""; nomeOrig = "do remetente do e-mail"; }
    var doc = cxrDig_(lido.documento);
    var valor = cxrValorBR_(lido.valor);
    var desc = String(lido.descricao || "").trim(), descOrig = "lido no e-mail";
    if (!desc) { desc = String(conv.primeiro.assunto || "").replace(/^(re|enc|fwd?|res)\s*:\s*/i, "").substring(0, 120); descOrig = "do assunto do e-mail"; }
    var forma = String(lido.forma || "").toUpperCase();
    if (["PIX", "DINHEIRO", "CHEQUE", "TRANSFERENCIA"].indexOf(forma) === -1) forma = lido.pix ? "PIX" : "";
    var email = cxsEmail_(base.replyTo || base.de);
    var recibo = {
      pagadorNome: campo(nome, nomeOrig),
      pagadorDoc: { valor: doc, origem: doc ? (cxrDocValido_(doc) ? "lido no e-mail" : "lido no e-mail — o número NÃO confere, corrija") : "não achei no e-mail — preencha" },
      valor: campo(valor, "lido no e-mail"),
      descricao: campo(desc, descOrig),
      formaPgto: campo(forma, "lido no e-mail"),
      pixChave: campo(String(lido.pix || "").trim(), "lido no e-mail"),
      email: campo(email, "do remetente do e-mail")
    };
    try {
      CacheService.getScriptCache().put("cxr_" + String(id).replace(/[^\w]/g, ""), JSON.stringify({
        pagadorDoc: doc, valor: valor, formaPgto: forma }), 21600);
    } catch (eC) {}
    return { ok: true, recibo: recibo };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Gera o recibo pelo módulo. dados = { pagadorNome, pagadorDoc, valor, descricao,
    formaPgto, pixChave, email, conferi:true, enviar:true|false }. */
function caixaReciboGerar(id, dados, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "documentos", false);
    dados = dados || {};
    if (dados.conferi !== true) return { ok: false, mensagem: "Marque que conferiu os dados do recibo antes." };
    var conv = cxfConversa_(id, sessao);
    var doc = cxrDig_(dados.pagadorDoc);
    if (!cxrDocValido_(doc)) return { ok: false, mensagem: "O CPF/CNPJ não confere. Corrija antes de gerar." };
    var valor = cxrValorBR_(dados.valor);
    if (!valor) return { ok: false, mensagem: "Informe o valor." };
    var enviar = dados.enviar === true;
    var email = String(dados.email || "").trim();
    if (enviar && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, mensagem: "Para enviar ao beneficiário, informe o e-mail dele." };
    if (enviar) vpeChecarDestinoAmbiente_(email);
    var paraModulo = { pagadorNome: String(dados.pagadorNome || "").trim(), pagadorDoc: doc, valor: valor,
      descricao: String(dados.descricao || "").trim(), formaPgto: String(dados.formaPgto || "PIX"), pixChave: String(dados.pixChave || "").trim(),
      /* O módulo manda o recibo sozinho quando tem e-mail: só vai se a pessoa escolheu enviar. */
      email: enviar ? email : "", obs: "Pela Caixa de E-mails: " + String(conv.primeiro.assunto || "").substring(0, 120) };
    var r = gerarReciboDiverso(paraModulo, tokenSessao);   // O MESMO gerador do módulo de Recibos Diversos
    if (!r || !r.ok) return { ok: false, mensagem: (r && r.mensagem) || "O módulo não gerou o recibo." };
    var quem = sessao.email || sessao.usuario || "";
    var oque = "Recibo diverso nº " + r.numero + " (" + paraModulo.pagadorNome + ", R$ " + valor + ")" + (enviar ? " gerado e enviado ao beneficiário para assinar" : " gerado");
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO, NOTA: oque + " pela Caixa." }, quem);
    cxsAuditar_("RECIBO_DIVERSO", id, oque, sessao);
    var prop = null;
    try { var c = CacheService.getScriptCache().get("cxr_" + String(id).replace(/[^\w]/g, "")); prop = c ? JSON.parse(c) : null; } catch (e0) {}
    roboMemoriaRegistrar_({ tarefa: "recibo-email", origem: String(conv.p.CAIXA || ""), chave: String(id), remetente: cxsEmail_(conv.ultimo.de),
      assunto: conv.primeiro.assunto, sugerido: prop ? cxrAssinatura_(prop) : "", decidido: cxrAssinatura_(paraModulo), quem: quem });
    if (typeof crnTratou_ === "function") crnTratou_(id, conv.p, "TRATAR", sessao);
    return { ok: true, numero: r.numero, url: r.url, enviado: enviar && r.statusEmail === "ENVIADO",
             mensagem: oque + "." + (enviar && r.statusEmail === "FALHA" ? " O e-mail ao beneficiário FALHOU — reenvie pelo módulo." : "") };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** O recibo assinado que chegou: as candidatas (recibos pendentes de assinatura) e os anexos. */
function caixaReciboAssinadoDoEmail(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "documentos", false);
    var conv = cxfConversa_(id, sessao);
    var h = listarHistoricoReciboDiversos({ porPagina: 1000 }, tokenSessao);
    var lista = (h && h.dados) || [];
    var de = cxsEmail_(conv.ultimo.replyTo || conv.ultimo.de);
    var texto = conv.msgs.map(function (m) { return (m.assunto || "") + " " + (m.corpo || ""); }).join(" ");
    var cands = lista.filter(function (r) { return String(r.statusAssinatura) !== "ASSINADO"; }).map(function (r) {
      var pontos = 0, motivo = "";
      var num = String(r.numero || ""), numCurto = num.split("/")[0];
      if (num && (texto.indexOf(num) > -1 || (numCurto.length >= 3 && new RegExp("\\b" + numCurto.replace(/[^\w]/g, "") + "\\b").test(texto)))) { pontos = 3; motivo = "o número do recibo está no e-mail"; }
      else if (de && String(r.email || "").toLowerCase() === de) { pontos = 2; motivo = "o recibo foi enviado para este e-mail"; }
      return { numero: num, nome: r.pagadorNome, valor: r.valor, descricao: r.descricao, data: r.data, pontos: pontos, motivo: motivo };
    }).filter(function (c) { return c.pontos > 0; }).sort(function (a, b) { return b.pontos - a.pontos; });
    var topo = cands.filter(function (c) { return c.pontos === (cands[0] || {}).pontos; });
    var anexos = vpeJson_(conv.p.ANEXOS_JSON, []).map(function (a, i) {
      var pdf = /pdf/i.test(String(a.tipo || "")) || /\.pdf$/i.test(String(a.nome || ""));
      return { indice: i, nome: String(a.nome || ""), pdf: pdf, sugerido: pdf && /recibo|assinad/i.test(String(a.nome || "")) };
    });
    if (anexos.filter(function (a) { return a.pdf; }).length === 1) anexos.forEach(function (a) { if (a.pdf) a.sugerido = true; });
    return { ok: true, assinado: { candidatas: cands.slice(0, 8), escolhida: topo.length === 1 ? topo[0].numero : "", anexos: anexos,
             contabilidade: (typeof EMAILS_CONTABILIDADE_DESPESAS !== "undefined" ? EMAILS_CONTABILIDADE_DESPESAS : []).join(", ") } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Anexa o recibo assinado (e, se pedido, envia à contabilidade). dados = { numero, anexo, enviar, conferi }. */
function caixaReciboAssinadoAnexar(id, dados, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "documentos", false);
    dados = dados || {};
    if (dados.conferi !== true) return { ok: false, mensagem: "Marque que conferiu o recibo e a assinatura antes." };
    var conv = cxfConversa_(id, sessao);
    var numero = String(dados.numero || "").trim();
    var h = listarHistoricoReciboDiversos({ porPagina: 1000 }, tokenSessao);
    var rec = (((h && h.dados) || []).filter(function (r) { return String(r.numero) === numero; }))[0];
    if (!rec) return { ok: false, mensagem: "Escolha o recibo (pendente de assinatura) deste e-mail." };
    if (String(rec.statusAssinatura) === "ASSINADO") return { ok: false, mensagem: "Este recibo já está assinado." };
    var ax = cxsAnexoInterno_(conv.p, Number(dados.anexo));
    if (!ax || !ax.ok) return { ok: false, mensagem: "Marque o anexo com o recibo assinado." };
    if (!/pdf/i.test(String(ax.tipo || ""))) return { ok: false, mensagem: "O recibo assinado precisa ser PDF." };
    var sv = salvarAnexoAssinadoDiverso({ numero: numero, base64: String(ax.dataUrl).split(",")[1] || "", nomeArq: ax.nome, mimeType: ax.tipo }, tokenSessao);
    if (!sv || !sv.ok) return { ok: false, mensagem: (sv && sv.mensagem) || "Não anexou." };
    marcarReciboDiversoAssinado({ numero: numero, tipo: "FOTO_SCAN" }, tokenSessao);
    var env = null;
    if (dados.enviar === true) {
      var para = (typeof EMAILS_CONTABILIDADE_DESPESAS !== "undefined" ? EMAILS_CONTABILIDADE_DESPESAS : []).join(",");
      if (!para) return { ok: false, anexou: true, mensagem: "O recibo foi anexado, mas não achei o e-mail da contabilidade. Envie pelo módulo de Recibos Diversos." };
      env = enviarReciboDiversoContabilidade({ emailTo: para, numero: numero, nome: rec.pagadorNome, valor: rec.valor, descricao: rec.descricao,
        linkAssinado: sv.link }, tokenSessao);
      if (!env || !env.ok) return { ok: false, anexou: true, mensagem: "O recibo foi anexado, mas o envio à contabilidade não saiu: " + ((env && env.mensagem) || "erro") + "." };
    }
    var quem = sessao.email || sessao.usuario || "";
    var oque = "Recibo diverso nº " + numero + " assinado e anexado" + (env ? " e enviado à contabilidade" : "");
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO, NOTA: oque + " pela Caixa." }, quem);
    cxsAuditar_("RECIBO_ASSINADO", id, oque, sessao);
    roboMemoriaRegistrar_({ tarefa: "recibo-assinado", origem: String(conv.p.CAIXA || ""), chave: String(id), remetente: cxsEmail_(conv.ultimo.de),
      assunto: conv.primeiro.assunto, sugerido: String(dados.sugerido || ""), decidido: numero, quem: quem });
    if (typeof crnTratou_ === "function") crnTratou_(id, conv.p, "TRATAR", sessao);
    return { ok: true, enviado: !!env, mensagem: oque + "." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
