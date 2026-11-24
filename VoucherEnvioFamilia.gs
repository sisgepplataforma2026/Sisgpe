/* ================================================================
   VoucherEnvioFamilia.gs — UM E-MAIL SÓ PARA O SOLICITANTE (24/11/2026)

   Pedido do usuário: "quando tiver mais dependentes deve sair um único e-mail
   para o solicitante". Hoje cada protocolo sai num e-mail (o botão do modal e
   o lote): com três filhos são três mensagens, e a conta tem 100 e-mails por
   dia (medido em 23/11: restavam 67).

   O QUE FAZ: junta os certificados do MESMO titular (CPF) e do MESMO destino
   num e-mail só — uma tabela com cada beneficiário e todos os PDFs anexados.

   A CÓPIA PARA A INSTITUIÇÃO CONTINUA OPCIONAL (decisão do usuário: "não é
   obrigatório envio à escola"). Ligada, o desenho é o que protege os dados:

     - se TODOS os certificados vão para a MESMA instituição, ela entra em cópia
       no e-mail único, como sempre foi;
     - se são instituições diferentes, cada uma recebe um e-mail À PARTE, só com
       o certificado do dependente dela. Cópia no e-mail único mostraria o
       certificado de um filho para a escola de outro (LGPD).

   O HISTÓRICO CONTINUA POR PROTOCOLO: cada certificado ganha a sua linha de
   envio, para a auditoria não perder rastro de qual protocolo saiu quando.
   ================================================================ */

function voucherAnexoDoCertificado_(item) {
  var id = voucherIdDoLink_(item.linkPdf);
  return id ? DriveApp.getFileById(id).getBlob() : null;
}

/**
 * Envia UM e-mail com os certificados de vários protocolos do mesmo titular.
 * Com um protocolo só, é o envio de sempre (voucherEnviarPorEmail_).
 *
 * opcoes: { para, enviarInstituicao (true|false|undefined), copias: {protocolo: email},
 *           anexarPdf, campanhaCota }
 * Devolve { ok, mensagem, enviados:[{protocolo,para,copia}], pulados:[{protocolo,motivo}],
 *           comAnexo, emails }
 */
function voucherEnviarFamiliaPorEmail_(protocolos, opcoes, sessao) {
  opcoes = opcoes || {};
  try {
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    if (!lista.length) return { ok: false, mensagem: "Nenhum protocolo informado." };
    if (lista.length === 1) {
      var unico = voucherEnviarPorEmail_(lista[0], {
        para: opcoes.para, enviarInstituicao: opcoes.enviarInstituicao,
        copia: opcoes.copias ? opcoes.copias[lista[0]] : undefined,
        anexarPdf: opcoes.anexarPdf, campanhaCota: opcoes.campanhaCota
      }, sessao);
      unico.enviados = unico.ok ? [{ protocolo: lista[0], para: unico.para, copia: unico.copia }] : [];
      unico.pulados = unico.ok ? [] : [{ protocolo: lista[0], motivo: unico.mensagem }];
      unico.emails = unico.ok ? 1 : 0;
      return unico;
    }

    var pulados = [], itens = [];
    lista.forEach(function (p) {
      var d = voucherDadosEnvio_(p);
      if (!d.ok) { pulados.push({ protocolo: p, motivo: d.mensagem }); return; }
      itens.push(d);
    });
    if (!itens.length) return { ok: false, mensagem: pulados[0].motivo, enviados: [], pulados: pulados, emails: 0 };

    var cpfs = {};
    itens.forEach(function (i) { cpfs[i.cpf || "?"] = true; });
    if (Object.keys(cpfs).length > 1) {
      return { ok: false, mensagem: "Estes certificados são de associados diferentes. O e-mail único é de um associado só.",
               enviados: [], pulados: pulados, emails: 0 };
    }

    var para = String(opcoes.para || itens[0].emailAssociado || "").trim();
    if (!para) return { ok: false, mensagem: "Sem e-mail do associado. Preencha o destinatário.", enviados: [], pulados: pulados, emails: 0 };

    /* A cópia à instituição: opcional, editável, e MARCADA TEM QUE TER E-MAIL (29/10/2026). */
    var copiaDe = {};
    if (opcoes.enviarInstituicao !== false) {
      for (var k = 0; k < itens.length; k++) {
        var it = itens[k];
        var em = String(opcoes.copias && opcoes.copias[it.protocolo] != null ? opcoes.copias[it.protocolo] : (it.emailInstituicao || "")).trim();
        if (em && em.indexOf("@") < 1) {
          return { ok: false, mensagem: "O e-mail da instituição não parece válido: " + em + " (protocolo " + it.protocolo + ").", enviados: [], pulados: pulados, emails: 0 };
        }
        if (opcoes.enviarInstituicao === true && !em) {
          return { ok: false, semEmailInstituicao: true, enviados: [], pulados: pulados, emails: 0,
                   mensagem: "A cópia para a instituição está marcada, mas o protocolo " + it.protocolo +
                             " não tem e-mail da instituição. Preencha o e-mail ou desmarque a cópia." };
        }
        if (em) copiaDe[it.protocolo] = em;
      }
    }

    /* Cada documento sai com a data do envio (29/10/2026) e vira anexo. */
    var quemEnvia = (sessao && (sessao.email || sessao.usuario)) || "";
    var incluidos = [], blobs = {}, falhouAnexo = false;
    itens.forEach(function (it) {
      var red = voucherRedatarDocumento_(it.protocolo, new Date(), "o envio por e-mail", quemEnvia);
      if (!red.ok) { pulados.push({ protocolo: it.protocolo, motivo: red.mensagem || "Não foi possível refazer o documento." }); return; }
      it.linkPdf = red.linkPdf;
      incluidos.push(it);
      if (opcoes.anexarPdf !== false) {
        try { var b = voucherAnexoDoCertificado_(it); if (b) blobs[it.protocolo] = b; else falhouAnexo = true; }
        catch (e) { falhouAnexo = true; Logger.log("Anexo falhou (" + it.protocolo + "): " + e.message); }
      }
    });
    if (!incluidos.length) return { ok: false, mensagem: pulados.length ? pulados[0].motivo : "Nada a enviar.", enviados: [], pulados: pulados, emails: 0 };
    var comAnexo = !falhouAnexo && opcoes.anexarPdf !== false && Object.keys(blobs).length === incluidos.length;

    /* Uma instituição só e para todos → cópia no e-mail único. Senão, e-mail à parte por instituição. */
    var emailsInst = {};
    incluidos.forEach(function (it) { if (copiaDe[it.protocolo]) (emailsInst[copiaDe[it.protocolo]] = emailsInst[copiaDe[it.protocolo]] || []).push(it); });
    var distintos = Object.keys(emailsInst);
    var ccNoUnico = (distintos.length === 1 && emailsInst[distintos[0]].length === incluidos.length) ? distintos[0] : "";

    var msg = {
      to: para,
      subject: "Certificados de Bolsa de Estudo — protocolos " + incluidos.map(function (i) { return i.protocolo; }).join(", "),
      htmlBody: voucherCorpoEmailFamilia_(incluidos, comAnexo),
      name: "SindEducação-ES"
    };
    if (ccNoUnico) msg.cc = ccNoUnico;
    var anexosTodos = incluidos.map(function (i) { return blobs[i.protocolo]; }).filter(function (x) { return !!x; });
    if (anexosTodos.length) msg.attachments = anexosTodos;
    voucherEnviarMsg_(msg);
    var emails = 1;

    if (!ccNoUnico) {
      distintos.forEach(function (em) {
        var grupo = emailsInst[em];
        var m = {
          to: em,
          subject: grupo.length === 1
            ? "Certificado de Bolsa de Estudo — protocolo " + grupo[0].protocolo
            : "Certificados de Bolsa de Estudo — protocolos " + grupo.map(function (i) { return i.protocolo; }).join(", "),
          htmlBody: grupo.length === 1 ? voucherCorpoEmail_(grupo[0], !!blobs[grupo[0].protocolo]) : voucherCorpoEmailFamilia_(grupo, grupo.every(function (i) { return !!blobs[i.protocolo]; })),
          name: "SindEducação-ES"
        };
        var a = grupo.map(function (i) { return blobs[i.protocolo]; }).filter(function (x) { return !!x; });
        if (a.length) m.attachments = a;
        voucherEnviarMsg_(m);
        emails++;
      });
    }

    if (opcoes.campanhaCota && typeof cotaEmail_registrarEnvio_ === "function") {
      cotaEmail_registrarEnvio_(opcoes.campanhaCota, emails + (ccNoUnico ? 1 : 0));
    }

    var enviados = [];
    incluidos.forEach(function (it) {
      var cp = copiaDe[it.protocolo] || "";
      voucherRegistrarEnvio_(it.protocolo, "EMAIL",
        para + (cp ? (ccNoUnico ? " (cc " + cp + ")" : " (instituição " + cp + " em e-mail à parte)") : "") +
        " · e-mail único com " + incluidos.length + " certificados", sessao);
      enviados.push({ protocolo: it.protocolo, para: para, copia: cp });
      try {
        if (cp && typeof voucherInstLembrar_ === "function") {
          voucherInstLembrar_({ nome: it.instituicao, cnpj: it.cnpjInstituicao || "", email: cp, percentual: it.percentual, quem: quemEnvia });
        }
      } catch (eM) {}
    });

    return {
      ok: true, enviados: enviados, pulados: pulados, comAnexo: comAnexo, emails: emails, para: para,
      mensagem: "E-mail único enviado para " + para + " com " + incluidos.length + " certificados" +
                (distintos.length ? (ccNoUnico ? ", com cópia para a instituição." : "; " + distintos.length + " instituição(ões) receberam e-mail à parte.") : ".") +
                (comAnexo ? "" : " ATENÇÃO: nem todos os PDFs foram anexados — o associado pode ter ficado sem algum documento.") +
                (pulados.length ? " " + pulados.length + " ficou(aram) de fora (motivo na lista)." : "")
    };
  } catch (e) {
    Logger.log("voucherEnviarFamiliaPorEmail_: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar o e-mail: " + e.message, enviados: [], pulados: [], emails: 0 };
  }
}

/** Porta do modal: guarda de sessão dentro do try, como voucherEnviarPorEmail. */
function voucherEnviarFamiliaPorEmail(protocolos, opcoes, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "beneficios", false);
    return voucherEnviarFamiliaPorEmail_(protocolos, opcoes, sessao);
  } catch (e) {
    Logger.log("voucherEnviarFamiliaPorEmail: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar o e-mail: " + e.message };
  }
}

/** Os OUTROS certificados prontos do mesmo titular, para o modal oferecer "incluir no mesmo e-mail". Só lê. */
function voucherIrmaosProntosParaEnvio(protocolo, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var d = voucherDadosEnvio_(protocolo);
    if (!d.ok || !d.cpf) return { ok: true, irmaos: [] };
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_EMITIDOS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, irmaos: [] };
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (c) { return String(c || "").trim(); });
    var iP = cab.indexOf("PROTOCOLO");
    if (iP === -1) return { ok: true, irmaos: [] };
    var protos = sh.getRange(2, iP + 1, sh.getLastRow() - 1, 1).getValues()
      .map(function (r) { return String(r[0] || "").trim(); })
      .filter(function (p, i, a) { return p && p !== String(protocolo).trim() && a.indexOf(p) === i; });
    var irmaos = [];
    protos.forEach(function (p) {
      var x = voucherDadosEnvio_(p);
      if (!x.ok || x.cpf !== d.cpf || x.presencial) return;
      var s = voucherSituacaoEnvio_(x);
      if (s.situacao !== "PRONTO") return;          // só os que ainda não foram enviados
      irmaos.push({ protocolo: p, beneficiario: x.beneficiario || x.nome, curso: x.curso, periodo: x.periodo,
                    periodoRotulo: x.periodoRotulo, mesmoEmail: x.emailAssociado === d.emailAssociado });
    });
    return { ok: true, irmaos: irmaos };
  } catch (e) {
    Logger.log("voucherIrmaosProntosParaEnvio: " + e.message);
    return { ok: false, mensagem: e.message, irmaos: [] };
  }
}

/** O corpo do e-mail único: uma tabela com cada beneficiário. Mesmo casco e mesma assinatura do e-mail individual. */
function voucherCorpoEmailFamilia_(itens, comAnexo) {
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var th = "padding:7px 8px;font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;text-align:left;border-bottom:1px solid #cbd5e1;";
  var td = "padding:9px 8px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0;vertical-align:top;";
  var linhas = itens.map(function (d) {
    return "<tr>" +
      "<td style='" + td + "font-weight:800;'>" + esc(d.beneficiario || d.nome) + "</td>" +
      "<td style='" + td + "'>" + esc(d.curso) + "</td>" +
      "<td style='" + td + "white-space:nowrap;'>" + esc(d.periodo ? (d.periodoRotulo || "Período") + " " + d.periodo : "") + "</td>" +
      "<td style='" + td + "white-space:nowrap;'>" + esc(d.percentual ? d.percentual + "%" : "") + "</td>" +
      "<td style='" + td + "white-space:nowrap;font-weight:700;'>" + esc(d.protocolo) + "</td></tr>";
  }).join("");

  var protocolos = itens.map(function (d) { return d.protocolo; });
  return sisgepEmailHtml_({
    numero: protocolos.length > 2 ? protocolos[0] + " +" + (protocolos.length - 1) : protocolos.join(" · "),
    rotuloNumero: "Protocolos",
    badge: "Bolsa de Estudo",
    badgeTom: "sucesso",
    assinatura: { nome: "MARCELHA ALINE PINTO GOMES", cargo: "Administrativo & Secretaria — SindEducação-ES" },
    corpo:
      sisgepSaudacaoEmail_(itens[0].nome) +
      "<div style='text-align:justify;line-height:1.7;font-size:13.5px;color:#1a2233;'>" +
        "Informamos que os <strong>Certificados de Bolsa de Estudo</strong> de " + itens.length +
        " beneficiários foram emitidos pelo <strong>SindEducação-ES</strong>, conforme as disposições da " +
        "Convenção Coletiva de Trabalho vigente, e " +
        (comAnexo ? "seguem anexos a este e-mail, um para cada beneficiário." : "estão disponíveis para retirada na sede do sindicato.") +
      "</div>" +
      "<p style='margin:20px 0 6px;font-size:13.5px;font-weight:800;color:#0f172a;'>Dados dos certificados:</p>" +
      "<table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;background:#f8fafc;border:1px solid #cbd5e1;" +
        "border-radius:10px;margin:0 0 20px;border-collapse:separate;'>" +
        "<tr><th style='" + th + "'>Beneficiário</th><th style='" + th + "'>Curso</th><th style='" + th + "'>Período</th>" +
        "<th style='" + th + "'>Desconto</th><th style='" + th + "'>Protocolo</th></tr>" + linhas +
      "</table>" +
      "<div style='text-align:justify;line-height:1.7;font-size:13.5px;color:#1a2233;'>" +
        "<p style='margin:0 0 14px;'>Solicitamos que apresente cada certificado à respectiva instituição de ensino para que o " +
        "desconto seja aplicado à matrícula, rematrícula e mensalidades, conforme as condições previstas na " +
        "Convenção Coletiva de Trabalho.</p>" +
        "<p style='margin:0 0 14px;'>Pedimos, por gentileza, que confirme o recebimento deste e-mail" +
        (comAnexo ? " e dos certificados anexos" : "") + ".</p>" +
        "<p style='margin:0 0 14px;'>Permanecemos à disposição para quaisquer esclarecimentos.</p>" +
        "<p style='margin:0 0 14px;'>Desejamos um excelente e abençoado dia!</p>" +
        "<p style='margin:0 0 4px;'>Atenciosamente,</p>" +
        "<p style='margin:14px 0 0;font-size:12px;color:#64748b;'><em>Provérbios 16:3 — Consagre ao Senhor tudo o que você faz, " +
        "e os seus planos serão bem-sucedidos.</em></p>" +
      "</div>"
  });
}
