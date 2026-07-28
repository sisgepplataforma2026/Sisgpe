// ============================================================================
// ARQUIVO: HelperOficios.gs
// Funções utilitárias compartilhadas do módulo de ofícios
// ============================================================================

/* ── Formatação de datas ── */

function formatarDataHoraBR_(data) {
  if (!data) return "";
  try {
    return Utilities.formatDate(new Date(data), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  } catch (e) {
    return String(data || "");
  }
}

function formatarDataHoraBRSegundos_(data) {
  if (!data) return "";
  try {
    return Utilities.formatDate(new Date(data), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    return String(data || "");
  }
}

function anoAtual_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
}

/* ── Normalização de tipo de ofício ── */

function normalizarTipoOficio_(tipo) {
  const t = normalizarTexto_(tipo);
  if (t.indexOf("desfili") > -1)      return "DESFILIACAO";
  if (t.indexOf("fili") > -1)         return "FILIACAO";
  if (t.indexOf("assistencial") > -1) return "TAXA_ASSISTENCIAL";
  if (t.indexOf("negocial") > -1)     return "TAXA_NEGOCIAL";
  if (t.indexOf("livre") > -1)        return "OFICIO_LIVRE";
  return "DESCONHECIDO";
}

function obterLabelTipoOficio_(tipo) {
  const tipoNorm = normalizarTipoOficio_(tipo);
  if (tipoNorm === "DESFILIACAO")       return "Desfiliação";
  if (tipoNorm === "FILIACAO")          return "Filiação";
  if (tipoNorm === "TAXA_NEGOCIAL")     return "Taxa Negocial";
  if (tipoNorm === "TAXA_ASSISTENCIAL") return "Taxa Assistencial";
  if (tipoNorm === "OFICIO_LIVRE")      return "Ofício Livre";
  return String(tipo || "").trim() || "Desconhecido";
}

function resolverConfigTipoOficio_(tipo) {
  const tipoNorm = normalizarTipoOficio_(tipo);
  const TEMPLATE_PADRAO_TAXA_ASSISTENCIAL = "1Awpat0OhOSadMYni7696JVLGXU40dP6mCwBpWXoqJgs";

  if (tipoNorm === "DESFILIACAO")   return { templateId: TEMPLATE_DESFILIACAO_ID,    assuntoTipo: "Desfiliação",      tituloEmail: "Ofício de Desfiliação",      isLivre: false };
  if (tipoNorm === "FILIACAO")      return { templateId: TEMPLATE_FILIACAO_ID,        assuntoTipo: "Filiação",          tituloEmail: "Ofício de Filiação",          isLivre: false };
  if (tipoNorm === "TAXA_NEGOCIAL") return { templateId: TEMPLATE_TAXA_ID,            assuntoTipo: "Taxa Negocial",     tituloEmail: "Ofício de Taxa Negocial",     isLivre: false };

  if (tipoNorm === "TAXA_ASSISTENCIAL") {
    const templateId = (typeof TEMPLATE_TAXA_ASSISTENCIAL_ID !== "undefined" && String(TEMPLATE_TAXA_ASSISTENCIAL_ID || "").trim())
      ? String(TEMPLATE_TAXA_ASSISTENCIAL_ID).trim()
      : TEMPLATE_PADRAO_TAXA_ASSISTENCIAL;
    return { templateId, assuntoTipo: "Taxa Assistencial", tituloEmail: "Ofício de Taxa Assistencial", isLivre: false };
  }

  if (tipoNorm === "OFICIO_LIVRE") {
    return { templateId: obterTemplateOficioLivreId_(), assuntoTipo: "Ofício Livre", tituloEmail: "Ofício", isLivre: true };
  }

  throw new Error("Tipo de documento inválido.");
}

/* ── Helpers de template livre ── */

function obterTemplateOficioLivreId_() {
  if (typeof TEMPLATE_OFICIO_PADRAO_ID !== "undefined" && String(TEMPLATE_OFICIO_PADRAO_ID || "").trim()) return String(TEMPLATE_OFICIO_PADRAO_ID).trim();
  if (typeof TEMPLATE_LIVRE_ID         !== "undefined" && String(TEMPLATE_LIVRE_ID         || "").trim()) return String(TEMPLATE_LIVRE_ID).trim();
  throw new Error("Template do Ofício Livre não configurado.");
}

function substituirMarcadoresContainerDocumento_(container, substituicoes) {
  if (!container || !substituicoes) return;
  Object.keys(substituicoes).forEach(function(chave) {
    const valor       = substituicoes[chave] != null ? String(substituicoes[chave]) : "";
    const chaveEscapada = String(chave).replace(/([\\^$.*+?()[\]{}|])/g, "\\$1");
    container.replaceText(chaveEscapada, valor);
  });
}

function substituirMarcadoresDocumentoOficioLivre_(doc, substituicoes) {
  substituirMarcadoresContainerDocumento_(doc.getBody(), substituicoes);
  const header = doc.getHeader(); if (header) substituirMarcadoresContainerDocumento_(header, substituicoes);
  const footer = doc.getFooter(); if (footer) substituirMarcadoresContainerDocumento_(footer, substituicoes);
}

/* ── Helpers de e-mail ── */

function normalizarListaEmails_(valor) {
  return String(valor || "")
    .split(/[\n,;]+/)
    .map(function(e){ return String(e || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(e, i, arr){ return arr.indexOf(e) === i; });
}

function validarListaEmails_(valor) {
  const emails = normalizarListaEmails_(valor);
  if (!emails.length) return { ok: false, emails: [], principal: "", todos: "", invalido: "" };
  for (let i = 0; i < emails.length; i++) {
    if (!emailValido(emails[i])) return { ok: false, emails, principal: emails[0] || "", todos: emails.join(", "), invalido: emails[i] };
  }
  return { ok: true, emails, principal: emails[0] || "", todos: emails.join(", ") };
}

/* ── Helpers de nome de arquivo ── */

function montarNomeArquivoOficio_(numero, escola, colaboradores, dataEnvio) {
  let nomes = Array.isArray(colaboradores)
    ? colaboradores.map(function(s){ return String(s || "").trim(); }).filter(Boolean)
    : String(colaboradores || "").split(",").map(function(s){ return s.trim(); }).filter(Boolean);

  function limpar(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function limitar(s, max) { return s.length > max ? s.slice(0, max).trim() : s; }

  function dataArquivo(d) {
    try { return Utilities.formatDate(d ? new Date(d) : new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy"); }
    catch (e) { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy"); }
  }

  const ate3     = nomes.slice(0, 3).map(limpar);
  const temMais  = nomes.length > 3;
  let parteNomes = ate3.join(", ");
  if (temMais) parteNomes += " E OUTROS";

  const n    = limpar(numero);
  const e    = limitar(limpar(escola), 60);
  const t    = limitar(parteNomes, 80);
  const data = dataArquivo(dataEnvio);

  let nome = "Ofício " + n;
  if (e) nome += " - " + e;
  if (t) nome += " - " + t;
  nome += " - Enviado em " + data + ".pdf";

  return nome;
}

function limparNomeArquivoOficioLivre_(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

/* ── Montagem de lista de colaboradores ── */

function montarListaColaboradoresOficio_(colaboradoresArr, marcador) {
  marcador       = marcador || "numerado";
  colaboradoresArr = Array.isArray(colaboradoresArr) ? colaboradoresArr : [];

  if (!colaboradoresArr.length) return "(nenhum colaborador informado)";

  return colaboradoresArr.map(function(nome, i) {
    nome = String(nome || "").trim().toUpperCase();
    return marcador === "hifen" ? "- " + nome : (i + 1) + ". " + nome;
  }).join("\n");
}

/* ── Montagem de textos de ofício por tipo ── */

function montarTextoFiliacao_(dados, colaboradoresArr) {
  var qtd = colaboradoresArr.length;
  return (
    "Prezados(as) Senhores(as),\n\n" +
    "O SindEducação/ES — Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos " +
    "de Ensino Particular no Estado do Espírito Santo — vem, por meio deste, comunicar que " +
    (qtd === 1
      ? "o(a) colaborador(a) abaixo identificado(a) passou a integrar"
      : "os(as) colaboradores(as) abaixo identificados(as) passaram a integrar") +
    " nosso quadro de associados, a partir da presente data.\n\n" +
    "Nos termos da Cláusula 56ª da Convenção Coletiva de Trabalho 2025/2026, solicitamos " +
    "a realização do desconto mensal de 2% (dois por cento) sobre o salário-base " +
    (qtd === 1 ? "do(a) trabalhador(a)" : "de cada trabalhador(a)") +
    ", a título de Mensalidade Sindical, com repasse a este Sindicato conforme os prazos dispostos na CCT.\n\n" +
    "Colocamo-nos à disposição para quaisquer esclarecimentos que se façam necessários.\n\n" +
    "Atenciosamente,"
  );
}

function montarTextoDesfiliacao_(dados, colaboradoresArr) {
  var qtd = colaboradoresArr.length;
  return (
    "Prezado(a) Senhor(a),\n\n" +
    "Por meio deste, comunicamos que " +
    (qtd === 1
      ? "o(a) colaborador(a) acima identificado(a) exerceu seu direito de desfiliação"
      : "os(as) colaboradores(as) acima identificados(as) exerceram seu direito de desfiliação") +
    " do quadro de associados do SindEducação/ES, conforme carta" +
    (qtd === 1 ? "" : "s") + " em anexo.\n\n" +
    "Solicitamos, portanto, que seja" + (qtd === 1 ? "" : "m") +
    " cessado" + (qtd === 1 ? "" : "s") + " imediatamente o" + (qtd === 1 ? "" : "s") +
    " desconto" + (qtd === 1 ? "" : "s") +
    " da contribuição sindical de 2% (dois por cento) sobre o salário-base, " +
    "em conformidade com a Cláusula 56ª da Convenção Coletiva de Trabalho 2025/2026.\n\n" +
    "Colocamo-nos à disposição para quaisquer esclarecimentos que se façam necessários.\n\n" +
    "Atenciosamente,"
  );
}

function montarTextoTaxaNegocial_(dados, colaboradoresArr) {
  return (
    "Prezados(as) Senhores(as),\n\n" +
    "O SindEducação/ES, no exercício de suas atribuições legais e em conformidade com a " +
    "Convenção Coletiva de Trabalho 2025/2026, vem solicitar o cumprimento das disposições " +
    "relativas à Taxa Negocial.\n\n" +
    "Nos termos da Cláusula 57ª da referida CCT, os estabelecimentos de ensino deverão " +
    "efetuar os descontos nos salários dos colaboradores técnico-administrativos e repassá-los " +
    "a este Sindicato até o 10º (décimo) dia útil do mês subsequente ao desconto.\n\n" +
    "Solicitamos a observância dos prazos e percentuais previstos, bem como a confirmação " +
    "de recebimento deste ofício, respondendo a este e-mail.\n\n" +
    "Renovamos nossos protestos de elevada estima e consideração.\n\n" +
    "Atenciosamente,"
  );
}

function montarTextoTaxaAssistencial_(dados, colaboradoresArr) {
  return (
    "Prezados(as) Senhores(as),\n\n" +
    "O SindEducação/ES, em conformidade com a Convenção Coletiva de Trabalho 2025/2026, " +
    "vem orientar e solicitar o cumprimento do repasse da Taxa Assistencial destinada à " +
    "Assistência Médica dos trabalhadores técnico-administrativos.\n\n" +
    "Nos termos da cláusula específica da CCT, as instituições de ensino deverão proceder " +
    "ao recolhimento de 4% (quatro por cento) sobre o salário-base bruto dos colaboradores, " +
    "apurado na competência março de 2026.\n\n" +
    "O valor deverá ser recolhido em duas parcelas de 2% (dois por cento). " +
    "Para instituições exclusivamente de educação infantil, o recolhimento será de " +
    "2% (dois por cento), dividido em duas parcelas de 1% (um por cento).\n\n" +
    "Solicitamos a confirmação do recebimento deste ofício, respondendo a este e-mail, " +
    "e o atendimento às orientações dentro dos prazos estabelecidos.\n\n" +
    "Sem mais para o momento, renovamos nossos protestos de elevada estima e consideração.\n\n" +
    "Atenciosamente,"
  );
}

function montarTextoOficioPadrao_(tipoNorm, dados, colaboradoresArr) {
  if (tipoNorm === "FILIACAO")          return montarTextoFiliacao_(dados, colaboradoresArr);
  if (tipoNorm === "DESFILIACAO")       return montarTextoDesfiliacao_(dados, colaboradoresArr);
  if (tipoNorm === "TAXA_NEGOCIAL")     return montarTextoTaxaNegocial_(dados, colaboradoresArr);
  if (tipoNorm === "TAXA_ASSISTENCIAL") return montarTextoTaxaAssistencial_(dados, colaboradoresArr);
  throw new Error("Tipo de ofício padrão não reconhecido: " + tipoNorm);
}

/* ── Helpers de HTML ── */

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatarTextoOficioHTML_(texto) {
  if (typeof formatarCorpoEmailHTML_ === "function") return formatarCorpoEmailHTML_(texto);
  texto = String(texto || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!texto) return "<p></p>";
  return texto.split(/\n\s*\n/).map(function(paragrafo) {
    var html = escapeHtml_(paragrafo).replace(/\n/g, "<br>");
    return "<p>" + html + "</p>";
  }).join("");
}

/* ── Helpers de substituição de placeholders ── */

function substituirPlaceholdersOficio_(texto, mapa) {
  texto = String(texto || "");
  Object.keys(mapa || {}).forEach(function(chave) {
    var re = new RegExp(String(chave).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    texto  = texto.replace(re, mapa[chave] != null ? String(mapa[chave]) : "");
  });
  return texto;
}

/* ── Obter extensão de arquivo ── */

function obterExtensaoArquivo_(nomeArquivo, mimeType) {
  const nome = String(nomeArquivo || "").trim();
  const mime = String(mimeType   || "").toLowerCase().trim();
if (nome && nome.indexOf(".") > -1) {
    var ext = nome.split(".").pop().toLowerCase().trim();
    if (ext && ext.length > 0 && ext.length <= 5) return ext;
  }
  if (mime.indexOf("pdf") > -1)                               return "pdf";
  if (mime.indexOf("jpeg") > -1 || mime.indexOf("jpg") > -1) return "jpg";
  if (mime.indexOf("png") > -1)                               return "png";
  if (mime.indexOf("msword") > -1)                            return "doc";
  if (mime.indexOf("wordprocessingml") > -1)                  return "docx";
  return "pdf";
}

/* ── Carrega assinatura do ofício como base64 ── */

var _cacheImagensOficio_ = null;

function carregarImagensOficio_() {
  if (_cacheImagensOficio_) return _cacheImagensOficio_;
  var assBase64 = "", assMime = "image/jpeg";
  try {
    var ab    = DriveApp.getFileById("1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe").getBlob();
    assBase64 = Utilities.base64Encode(ab.getBytes());
    assMime   = ab.getContentType() || "image/jpeg";
  } catch(e) {
    Logger.log("⚠ carregarImagensOficio_: " + e.message);
  }
  _cacheImagensOficio_ = { assBase64: assBase64, assMime: assMime };
  return _cacheImagensOficio_;
}

/* ── Invalida cache de templates ── */

function invalidarCacheTemplatesOficios(templateId) {
  Logger.log("ℹ Sistema utiliza templates internos em código.");
  return { ok: true, mensagem: "Sistema utilizando templates internos. Nenhum cache necessário." };
}