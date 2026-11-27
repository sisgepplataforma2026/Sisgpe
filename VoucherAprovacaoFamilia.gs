/* ================================================================
   VoucherAprovacaoFamilia.gs — APROVAR VÁRIOS DEPENDENTES, UM E-MAIL SÓ (24/11/2026)

   Pedido do usuário: "quando tiver mais dependentes deve sair um único e-mail
   para o solicitante" — vale também para a APROVAÇÃO (resposta dele: "certificado
   e aprovação juntos").

   COMO: aprova cada protocolo pelo caminho de sempre (aprovarSolicitacaoVoucher,
   com todas as suas travas), SEM o e-mail individual, e depois manda um e-mail
   por grupo (mesmo titular e mesmo destino). Um protocolo só no grupo sai pelo
   e-mail de sempre (enviarEmailAprovacaoVoucher_).

   A aprovação continua protocolo a protocolo: uma recusada não derruba as
   outras, e o resultado traz um item por protocolo.
   ================================================================ */

/**
 * @param {string[]} protocolos
 * @param {string} obs
 * @param {string} tokenSessao
 * @param {Object=} percentuais  { protocolo: percentual } — ajuste opcional por protocolo
 */
function aprovarSolicitacoesCertBolsaEmLote(protocolos, obs, tokenSessao, percentuais) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var lista = (Array.isArray(protocolos) ? protocolos : [])
      .map(function (p) { return String(p || "").trim(); })
      .filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    if (!lista.length) return { ok: false, mensagem: "Nenhuma solicitação marcada." };
    percentuais = percentuais || {};

    var resultados = [], aprovados = [];
    lista.forEach(function (p) {
      var r;
      try {
        r = aprovarSolicitacaoVoucher(p, obs, tokenSessao, percentuais[p], { semEmail: true, devolverRegistro: true });
      } catch (e) {
        r = { ok: false, mensagem: "Erro ao aprovar: " + e.message };
      }
      resultados.push({ protocolo: p, ok: !!(r && r.ok), mensagem: (r && r.mensagem) || "" });
      if (r && r.ok && r.registro) aprovados.push({ protocolo: p, registro: r.registro });
    });

    /* Um e-mail por grupo: mesmo titular (CPF) e mesmo destino. */
    var grupos = {}, ordem = [];
    aprovados.forEach(function (a) {
      var reg = a.registro;
      var chave = voucherCpf11_(reg.CPF_SOLICITANTE) + "|" + String(reg.EMAIL || "").trim().toLowerCase();
      if (!grupos[chave]) { grupos[chave] = []; ordem.push(chave); }
      grupos[chave].push(a);
    });
    var emails = 0;
    ordem.forEach(function (chave) {
      var g = grupos[chave];
      if (g.length === 1) enviarEmailAprovacaoVoucher_(g[0].registro, g[0].protocolo);
      else enviarEmailAprovacaoFamiliaVoucher_(g);
      emails++;
    });

    var ok = resultados.filter(function (r) { return r.ok; }).length;
    return {
      ok: ok > 0, aprovados: ok, total: lista.length, emails: emails, resultados: resultados,
      mensagem: ok === lista.length
        ? ok + " solicitação(ões) aprovada(s); " + emails + " e-mail(s) enviado(s) ao(s) solicitante(s)."
        : ok + " de " + lista.length + " aprovadas. As demais estão com o motivo."
    };
  } catch (e) {
    Logger.log("aprovarSolicitacoesCertBolsaEmLote: " + e.message);
    return { ok: false, mensagem: "Erro ao aprovar em lote: " + e.message };
  }
}

/** O e-mail único de aprovação: uma tabela com cada beneficiário. Nunca lança. */
function enviarEmailAprovacaoFamiliaVoucher_(aprovados) {
  try {
    var primeiro = aprovados[0].registro;
    var email = valorSeguroVoucher_(primeiro.EMAIL);
    if (!email) return;

    var presencial = voucherEhNaoAssociado_(primeiro.SITUACAO_SINDICAL);
    var th = "padding:7px 8px;font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:left;border-bottom:1px solid #cbd5e1;";
    var td = "padding:9px 8px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0;vertical-align:top;";
    var linhas = aprovados.map(function (a) {
      var r = a.registro;
      return "<tr><td style='" + td + "font-weight:800;'>" + escHtmlVoucher_(r.NOME_BENEFICIARIO || r.NOME_SOLICITANTE) + "</td>" +
             "<td style='" + td + "'>" + escHtmlVoucher_(r.CURSO) + "</td>" +
             "<td style='" + td + "white-space:nowrap;'>" + escHtmlVoucher_(valorSeguroVoucher_(r.PERCENTUAL_APLICADO) || "—") + "%</td>" +
             "<td style='" + td + "white-space:nowrap;font-weight:700;'>" + escHtmlVoucher_(a.protocolo) + "</td></tr>";
    }).join("");
    var protocolos = aprovados.map(function (a) { return a.protocolo; });

    voucherEnviarMsg_({
      to: email,
      subject: "Bolsas aprovadas — protocolos " + protocolos.join(", ") + " · SindEducação-ES",
      htmlBody:
        voucherEmailHtml_("Bolsas aprovadas",
          sisgepSaudacaoEmail_(primeiro.NOME_SOLICITANTE) +
          "<p>As solicitações de bolsa de <strong>" + aprovados.length + " beneficiários</strong> foram aprovadas.</p>" +
          "<table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;border-collapse:collapse;margin:14px 0;'>" +
          "<tr><th style='" + th + "'>Beneficiário</th><th style='" + th + "'>Curso</th><th style='" + th + "'>Desconto</th><th style='" + th + "'>Protocolo</th></tr>" +
          linhas + "</table>" +
          (presencial
            ? "<p><strong>A retirada é presencial.</strong> Compareça à sede do SindEducação-ES com um documento com foto e os " +
              "números de protocolo acima para retirar os vouchers. Eles não serão enviados por e-mail.</p>"
            : "<p>Os vouchers serão emitidos e encaminhados, num e-mail só, após a geração dos documentos oficiais.</p>") +
          "<p>Atenciosamente,<br><strong>Secretaria — SindEducação-ES</strong></p>",
          { protocolo: protocolos.length > 2 ? protocolos[0] + " +" + (protocolos.length - 1) : protocolos.join(" · "), badge: "Bolsas aprovadas" })
    });
  } catch (e) {
    Logger.log("enviarEmailAprovacaoFamiliaVoucher_ erro: " + e.message);
  }
}
