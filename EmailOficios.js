// ============================================================================
// ARQUIVO: EmailOficios.gs
// Montagem e envio de e-mails de ofícios
// ============================================================================

function montarOpcoesEmailSISGEP_(emailUsuario, htmlBody, anexos, assunto, destino) {
  return {
    to:          destino,
    subject:     assunto,
    htmlBody:    htmlBody,
    attachments: anexos || [],
    name:        "SindEducação-ES",
    from:        "financeiro@sindeducacao.com",
    replyTo:     "secretaria@sindeducacao.com",
    bcc:         "financeiro@sindeducacao.com"
  };
}

function montarEmailHTML(tipo, numero, assuntoTipo, quantidade, textoPrincipalCustom) {
  var textoPrincipal = textoPrincipalCustom || "";

  if (!textoPrincipal) {
    if (assuntoTipo === "Filiação") {
      textoPrincipal = quantidade === 1
        ? "Encaminhamos, em anexo, o <strong>Ofício de Filiação nº " + numero + "</strong> acompanhado da ficha de filiação do(a) colaborador(a).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos a realização do desconto mensal de <strong>2% (dois por cento)</strong> sobre o salário-base do(a) trabalhador(a), a título de Mensalidade Sindical.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail."
        : "Encaminhamos, em anexo, o <strong>Ofício de Filiação nº " + numero + "</strong> acompanhado das fichas de filiação dos(as) colaboradores(as) relacionados(as).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos a realização dos descontos mensais de <strong>2% (dois por cento)</strong> sobre o salário-base de cada trabalhador(a), a título de Mensalidade Sindical.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Desfiliação") {
      textoPrincipal = quantidade === 1
        ? "Encaminhamos, em anexo, o <strong>Ofício de Desfiliação nº " + numero + "</strong> acompanhado da carta de desfiliação do(a) colaborador(a).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos que seja <strong>cessado imediatamente o desconto de 2% (dois por cento)</strong> sobre o salário-base.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail."
        : "Encaminhamos, em anexo, o <strong>Ofício de Desfiliação nº " + numero + "</strong> acompanhado das cartas de desfiliação dos(as) colaboradores(as) relacionados(as).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos que sejam <strong>cessados imediatamente os descontos de 2% (dois por cento)</strong> sobre os salários-base.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Taxa Assistencial") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> referente à <strong>Taxa Assistencial – Assistência Médica</strong>, conforme previsto na CCT 2026.\n\n" +
        "O repasse deverá ser realizado em <strong>duas parcelas de 2% (dois por cento)</strong> sobre o salário-base bruto dos colaboradores técnico-administrativos.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Taxa Negocial") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> referente à <strong>Taxa Negocial</strong>, em conformidade com a <strong>Cláusula 57ª da CCT 2026/2027</strong>.\n\n" +
        "Solicitamos que os descontos sejam realizados e o repasse efetuado até o <strong>10º dia útil do mês subsequente</strong>.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Ofício Livre") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> conforme descrito no documento.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    }
  }

  var textoPrincipalHtml = formatarCorpoEmailHTML_(textoPrincipal);
  var saudacao = saudacaoHoraBR_();

  var badgeCor = "rgba(201,168,76,.15)", badgeBorda = "rgba(201,168,76,.35)", badgeTexto = "#C9A84C";
  if (assuntoTipo === "Filiação")          { badgeCor="rgba(217,119,6,.15)";  badgeBorda="rgba(217,119,6,.4)";   badgeTexto="#fbbf24"; }
  if (assuntoTipo === "Desfiliação")       { badgeCor="rgba(185,28,28,.2)";   badgeBorda="rgba(220,38,38,.4)";   badgeTexto="#fca5a5"; }
  if (assuntoTipo === "Taxa Assistencial") { badgeCor="rgba(22,101,52,.2)";   badgeBorda="rgba(34,197,94,.35)";  badgeTexto="#86efac"; }
  if (assuntoTipo === "Taxa Negocial")     { badgeCor="rgba(3,105,161,.2)";   badgeBorda="rgba(14,165,233,.35)"; badgeTexto="#7dd3fc"; }

  return (
    "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:680px;color:#0f172a;'>" +
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 55%,#003b82 100%);padding:22px 28px 20px;border-radius:8px 8px 0 0;'>" +
    "<div style='display:flex;align-items:flex-start;justify-content:space-between;gap:20px;'>" +
    "<div style='border-left:4px solid #C9A84C;padding-left:16px;'>" +
    "<div style='font-size:21px;font-weight:900;color:#fff;'>SINDEDUCAÇÃO-ES</div>" +
    "<div style='font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;'>Sindicato dos Educadores Técnico-Administrativos<br>em Estabelecimentos de Ensino Particular no Estado do Espírito Santo</div>" +
    "<div style='font-size:10.5px;font-weight:800;color:#C9A84C;margin-top:6px;'>CNPJ: 31.815.780/0001-51</div></div>" +
    "<div style='text-align:right;'><div style='font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;'>Ofício Nº</div>" +
    "<div style='font-size:26px;font-weight:900;color:#C9A84C;'>" + numero + "</div></div></div>" +
    "<div style='height:1px;background:rgba(201,168,76,.25);margin:16px 0 14px;'></div>" +
    "<div style='display:inline-flex;align-items:center;background:" + badgeCor + ";border:1px solid " + badgeBorda + ";color:" + badgeTexto + ";font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;text-transform:uppercase;'>" + assuntoTipo + "</div>" +
    "</div>" +

    "<div style='background:#fff;padding:28px 28px 24px;border:1px solid #e2e8f0;border-top:none;'>" +
    "<p style='margin:0 0 18px 0;font-size:14px;color:#334155;'>" + saudacao + "! Tudo bem?</p>" +
    "<div style='text-align:justify;line-height:1.7;font-size:13.5px;color:#1a2233;'>" + textoPrincipalHtml + "</div>" +
    "<div style='margin:20px 0 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;font-size:13px;font-weight:700;color:#1e3a8a;'>" +
    "⚠️ Solicitamos, por gentileza, a confirmação do recebimento respondendo a este e-mail.</div></div>" +

    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 60%,#002f6c 100%);border-radius:0 0 8px 8px;padding:22px 28px;text-align:center;'>" +
    "<div style='height:3px;background:linear-gradient(90deg,#C9A84C,#f0c843,#C9A84C);margin-bottom:18px;'></div>" +
"<div style='font-size:16px;font-weight:900;color:#fff;'>MARCELHA ALINE PINTO GOMES</div>" +
"<div style='font-size:12px;color:#C9A84C;font-weight:700;margin-top:3px;'>Administrativo & Secretaria — SindEducação-ES</div>" +
    "<div style='margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.75);line-height:1.7;'>" +
    "Av. Nossa Senhora dos Navegantes, 755 - Salas 707/708<br>" +
    "Enseada do Suá - Vitória/ES - CEP 29.050-355<br>" +
    "(27) 99735-8900 • secretaria@sindeducacao.com • www.sindeducacao.com.br" +
    "</div>" +
    "<div style='margin-top:12px;font-size:10px;color:rgba(255,255,255,.25);'>Documento gerado pelo SISGEP · SindEducação-ES</div>" +
    "</div></div>"
  );
}
function reenviarOficio(registro, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    var numero = String(registro.numero || "").trim();
    var escola = String(registro.escola || "").trim();
    var tipo   = String(registro.tipo   || "").trim();
    var url    = String(registro.url    || "").trim();

    if (!numero) return { erro: true, mensagem: "Número do ofício não informado." };
    if (!url)    return { erro: true, mensagem: "PDF não encontrado para este ofício." };

    var ss    = SpreadsheetApp.openById(PLANILHA_ID);
    var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet) return { erro: true, mensagem: "Aba de registro não encontrada." };

    var h              = getHeaderMap_(sheet);
    var colNumero      = h["Número do Ofício"];
    var colEmail       = h["E-mail (principal)"];
    var colEmailsTodos = h["E-mails (todos)"];
    var colLinkFicha   = h["Link Ficha"];

    if (!colNumero || (!colEmail && !colEmailsTodos)) {
      return { erro: true, mensagem: "Colunas necessárias não encontradas." };
    }

    var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var emailDestino = "", linkFicha = "";

    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][colNumero - 1] || "").trim() !== numero) continue;
      emailDestino = colEmailsTodos ? String(dados[i][colEmailsTodos - 1] || "").trim() : "";
      if (!emailDestino && colEmail) emailDestino = String(dados[i][colEmail - 1] || "").trim();
      if (colLinkFicha) linkFicha = String(dados[i][colLinkFicha - 1] || "").trim();
      break;
    }

    if (!emailDestino) return { erro: true, mensagem: "E-mail do destinatário não encontrado." };

    var validacaoEmails = validarListaEmails_(emailDestino);
    if (!validacaoEmails.ok) {
      return { erro: true, mensagem: "Há e-mail inválido salvo neste ofício: " + (validacaoEmails.invalido || "") };
    }

    function extrairIdDrive_(link) {
      link = String(link || "").trim();
      if (!link) return "";
      var m = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      m = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      if (/^[a-zA-Z0-9_-]{20,}$/.test(link)) return link;
      return "";
    }

    var idOficio = extrairIdDrive_(url);
    if (!idOficio) return { erro: true, mensagem: "Não foi possível identificar o arquivo PDF na URL informada." };

    var arqOficio = DriveApp.getFileById(idOficio);
    var anexos    = [arqOficio.getBlob().setName(arqOficio.getName())];

    if (linkFicha) {
      var idFicha = extrairIdDrive_(linkFicha);
      if (idFicha) {
        try {
          var arqFicha = DriveApp.getFileById(idFicha);
          anexos.push(arqFicha.getBlob().setName(arqFicha.getName()));
        } catch (eFicha) { Logger.log("⚠ Não foi possível anexar a ficha: " + eFicha.message); }
      }
    }

    var htmlBody = montarEmailHTML(
      "Reenvio — " + tipo, numero, obterLabelTipoOficio_(tipo), 0,
      "Reenviamos, em anexo, o ofício Nº " + numero + " referente a " + escola + ", conforme solicitado."
    );

    var opcoes = montarOpcoesEmailSISGEP_(
      emailUsuario, htmlBody, anexos,
      "Reenvio: " + tipo + " Nº " + numero,
      validacaoEmails.todos
    );

    GmailApp.sendEmail(opcoes.to, opcoes.subject, "Segue reenvio do ofício em anexo.", {
      htmlBody:    opcoes.htmlBody,
      attachments: opcoes.attachments || [],
      name:        opcoes.name,
      from:        opcoes.from,
      replyTo:     opcoes.replyTo,
      bcc:         opcoes.bcc
    });

    registrarLogSistema({
      usuario: emailUsuario,
      numero:  numero + " (REENVIO)",
      tipo, escola, cnpj: "",
      email:   validacaoEmails.todos,
      codigo:  ""
    });

    // O reenvio precisa tirar o ofício de FALHA_ENTREGA e reposicionar a data de
    // envio. Falhar aqui não invalida o e-mail, que já saiu: só registra.
    var avisoStatus = "";
    try {
      MON_OFICIOS_registrarReenvio_(ss, numero, emailUsuario);
    } catch (eStatus) {
      avisoStatus = " (atenção: o status não pôde ser atualizado — " + eStatus.message + ")";
      Logger.log("⚠ Reenvio concluído, mas o status não foi atualizado: " + eStatus.message);
    }

    return {
      erro: false,
      mensagem: "Ofício " + numero + " reenviado com sucesso para " + validacaoEmails.todos + ". Anexos: " + anexos.length + "." + avisoStatus
    };

  } catch(e) {
    return { erro: true, mensagem: "Erro ao reenviar: " + e.message };
  }
}

/* ── Helpers de formatação de corpo ── */

function normalizarTextoParagrafosEmail_(texto) {
  return String(texto || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function removerFrasesIndesejadas_(texto) {
  return String(texto || "")
    .replace(/Ressaltamos que o referido repasse possui finalidade específica[\s\S]*?partes\./gi, "")
    .replace(/\n{2,}/g, "\n\n").trim();
}

function formatarCorpoEmailHTML_(texto) {
  texto = removerFrasesIndesejadas_(texto);
  var conteudo = normalizarTextoParagrafosEmail_(texto);
  if (!conteudo) return "<p style='margin:0 0 12px 0;text-align:justify;line-height:1.7;'> </p>";

return conteudo.split(/\n\s*\n/).map(function(paragrafo) {
    var html = String(paragrafo).replace(/\n/g,"<br>");
    return "<p style='margin:0 0 14px 0;text-align:justify;line-height:1.7;'>" + html + "</p>";
  }).join("");
}