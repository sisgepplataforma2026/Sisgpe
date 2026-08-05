// ================================
// ARQUIVO: RHEventosRecibo.gs
// MÓDULO: RH — Recibo em PDF dos eventos trabalhistas (13º, férias,
//         rescisão) e envio por e-mail ao colaborador
//
// Separado de RHEventos.gs de propósito: lá fica a REGRA (quanto se
// paga e por quê), aqui fica a APRESENTAÇÃO (o papel que o colaborador
// assina). Mexer no layout do recibo nunca deve exigir abrir o arquivo
// que calcula dinheiro.
//
// O documento é a memória de cálculo: mostra cada verba com a
// referência que a originou (avos, dias, percentual), os totais, as
// bases de INSS/IRRF/FGTS e os avisos que o motor levantou. Isso é o
// que o contador precisa para conferir, e o que o sindicato precisa
// guardar se o cálculo for questionado depois.
//
// Reaproveita os helpers já existentes em RHDocumentos.gs (rh_esc_,
// rh_moeda_, rh_carregarLogo_) — mesmo cabeçalho institucional e mesma
// logo do holerite, para o colaborador reconhecer o documento.
//
// LIMITE: isto NÃO é o TRCT (Termo de Rescisão do Contrato de
// Trabalho) homologado nem substitui o eSocial. É o recibo interno do
// sindicato com a memória de cálculo.
// ================================

function rhEv_htmlRecibo_(ev, colaborador, logo) {
  logo = logo || {};
  colaborador = colaborador || {};

  var linhas = ev.detalhe || [];
  var temInformativo = linhas.some(function (l) { return l.informativo; });

  var linhasHtml = linhas.map(function (l) {
    if (l.informativo) {
      return "<tr class='info'><td>" + rh_esc_(l.codigo) + "</td><td>" + rh_esc_(l.descricao) + "</td>" +
        "<td class='ref'>" + rh_esc_(l.referencia) + "</td>" +
        "<td class='val' colspan='2'>" + rh_moeda_(l.valorInformativo) + " <span class='tag'>informativo</span></td></tr>";
    }
    return "<tr><td>" + rh_esc_(l.codigo) + "</td><td>" + rh_esc_(l.descricao) + "</td>" +
      "<td class='ref'>" + rh_esc_(l.referencia) + "</td>" +
      "<td class='val'>" + (Number(l.provento || 0) ? rh_moeda_(l.provento) : "") + "</td>" +
      "<td class='val'>" + (Number(l.desconto || 0) ? rh_moeda_(l.desconto) : "") + "</td></tr>";
  }).join("");

  var avisosHtml = "";
  var avisos = String(ev.avisos || "").split(" | ").filter(function (a) { return a.trim(); });
  if (avisos.length) {
    avisosHtml = "<div class='avisos'><b>Observações do cálculo</b><ul>" +
      avisos.map(function (a) { return "<li>" + rh_esc_(a) + "</li>"; }).join("") +
      "</ul></div>";
  }

  var basesHtml =
    "<div><b>Base de cálculo</b><span>" + rh_moeda_(ev.base) + "</span></div>" +
    (ev.avos !== "" && ev.avos !== null && ev.avos !== undefined ? "<div><b>Avos</b><span>" + rh_esc_(ev.avos) + "/12</span></div>" : "") +
    "<div><b>INSS</b><span>" + rh_moeda_(ev.inss) + "</span></div>" +
    "<div><b>IRRF</b><span>" + rh_moeda_(ev.irrf) + "</span></div>" +
    "<div><b>FGTS do evento</b><span>" + rh_moeda_(ev.fgts) + "</span></div>" +
    (Number(ev.multaFgts || 0) ? "<div><b>Multa 40% FGTS</b><span>" + rh_moeda_(ev.multaFgts) + "</span></div>" : "");

  return "" +
    "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>" +
    "<style>" +
    "@page{size:A4;margin:14mm 14mm;}" +
    "body{font-family:Arial,sans-serif;color:#111827;margin:0;font-size:11.5px;}" +
    ".doc{border:2px solid #001f4d;padding:18px 22px;}" +
    ".topo{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C9A84C;padding-bottom:10px;margin-bottom:12px;}" +
    ".topo .marca{display:flex;align-items:center;gap:10px;}" +
    ".topo .marca img{height:40px;width:40px;object-fit:contain;flex-shrink:0;}" +
    ".topo h1{font-size:14px;color:#001f4d;margin:0;}" +
    ".topo .sub{font-size:10px;color:#555;margin-top:2px;}" +
    ".topo .comp{font-size:12px;font-weight:bold;color:#001f4d;text-align:right;}" +
    ".ident{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;font-size:10px;margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#f8fafc;}" +
    ".ident div b{display:block;color:#94a3b8;font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;font-weight:900;}" +
    ".ident div span{font-weight:700;color:#0f172a;}" +
    ".ident .nome{grid-column:1/-1;}" +
    "table.rub{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:10px;}" +
    "table.rub th{background:#001f4d;color:#fff;text-align:left;padding:6px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;}" +
    "table.rub td{padding:5px 6px;border-bottom:1px solid #e5e7eb;}" +
    "table.rub td.ref{color:#64748b;}" +
    "table.rub td.val{text-align:right;font-weight:700;}" +
    "table.rub tr.info td{background:#fffbeb;color:#92400e;}" +
    ".tag{font-size:8px;text-transform:uppercase;letter-spacing:.05em;background:#fde68a;color:#92400e;padding:1px 5px;border-radius:6px;font-weight:900;}" +
    ".tot-linha{display:flex;justify-content:flex-end;gap:22px;font-size:11px;padding:8px 6px;background:#f4f6fa;border-radius:6px;margin-bottom:10px;}" +
    ".tot-linha b{color:#001f4d;}" +
    ".liq{background:#001f4d;color:#fff;font-size:14px;font-weight:900;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;margin-bottom:12px;}" +
    ".bases{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:9.5px;border-top:1px solid #e5e7eb;padding-top:10px;}" +
    ".bases div b{display:block;color:#94a3b8;font-size:8.5px;text-transform:uppercase;margin-bottom:2px;font-weight:900;}" +
    ".bases div span{font-weight:700;color:#0f172a;}" +
    ".avisos{margin-top:12px;font-size:9.5px;color:#334155;background:#f8fafc;border-left:3px solid #C9A84C;padding:8px 12px;border-radius:0 6px 6px 0;}" +
    ".avisos b{color:#001f4d;display:block;margin-bottom:4px;}" +
    ".avisos ul{margin:0;padding-left:16px;}" +
    ".avisos li{margin-bottom:3px;}" +
    ".rodape{margin-top:16px;font-size:9px;color:#888;}" +
    ".recibo{margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:9.5px;color:#555;}" +
    ".estornado{background:#fef2f2;color:#991b1b;border:2px solid #dc2626;padding:8px 12px;border-radius:8px;font-weight:900;margin-bottom:12px;text-align:center;}" +
    "</style></head><body><div class='doc'>" +
    "<div class='topo'><div class='marca'>" +
    (logo.base64 ? "<img src='data:" + logo.mime + ";base64," + logo.base64 + "' alt='SindEducação-ES'>" : "") +
    "<div><h1>SINDEDUCAÇÃO-ES</h1><div class='sub'>Sindicato dos Educadores Técnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do Espírito Santo<br>CNPJ: 31.815.780/0001-51</div></div>" +
    "</div>" +
    "<div class='comp'>" + rh_esc_(ev.rotulo) + "<br>" + rh_esc_(ev.referencia) + "</div></div>" +
    (ev.status === "ESTORNADO"
      ? "<div class='estornado'>DOCUMENTO ESTORNADO — " + rh_esc_(ev.motivoEstorno || "sem motivo registrado") + "</div>"
      : "") +
    "<div class='ident'>" +
    "<div class='nome'><b>Colaborador</b><span>" + rh_esc_(ev.matricula || "-") + " · " + rh_esc_(ev.nome) +
    (ev.cargo ? " — " + rh_esc_(ev.cargo) : "") + (ev.cpf ? " · CPF: " + rh_esc_(ev.cpf) : "") + "</span></div>" +
    "<div><b>Admissão</b><span>" + rh_esc_(colaborador.admissao || "-") + "</span></div>" +
    "<div><b>Centro de Custo</b><span>" + rh_esc_(colaborador.centroCusto || "-") + "</span></div>" +
    "<div><b>Departamento</b><span>" + rh_esc_(colaborador.departamento || "-") + "</span></div>" +
    "<div><b>Data do evento</b><span>" + rh_esc_(rhEv_br_(ev.dataEvento)) + "</span></div>" +
    "<div><b>Lançamento</b><span>" + rh_esc_(ev.id) + "</span></div>" +
    "</div>" +
    "<table class='rub'><thead><tr><th>Código</th><th>Descrição</th><th>Referência</th><th>Proventos</th><th>Descontos</th></tr></thead>" +
    "<tbody>" + linhasHtml + "</tbody></table>" +
    (temInformativo ? "<div style='font-size:9px;color:#92400e;margin:-4px 0 8px;'>Linhas marcadas como <b>informativo</b> não entram no total a receber — são valores recolhidos/depositados fora da folha (ex.: multa de 40% do FGTS, adiantamento já pago).</div>" : "") +
    "<div class='tot-linha'><span>Total de Proventos: <b>" + rh_moeda_(ev.totalProventos) + "</b></span><span>Total de Descontos: <b>" + rh_moeda_(ev.totalDescontos) + "</b></span></div>" +
    "<div class='liq'><span>Valor Líquido a Receber</span><span>" + rh_moeda_(ev.liquido) + "</span></div>" +
    "<div class='bases'>" + basesHtml + "</div>" +
    (ev.observacao ? "<div style='font-size:10px;color:#555;margin-top:8px;'>Observação: " + rh_esc_(ev.observacao) + "</div>" : "") +
    avisosHtml +
    "<div class='recibo'>Declaro ter recebido a importância líquida discriminada neste recibo.<br><br>____/____/_______ &nbsp;&nbsp;&nbsp;&nbsp; Assinatura do Funcionário: ______________________________________</div>" +
    "<div class='rodape'>Documento gerado eletronicamente pelo SISGEP em " +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") +
    " por " + rh_esc_(ev.geradoPor) + ". Memória de cálculo interna — não substitui o TRCT homologado nem o eSocial.</div>" +
    "</div></body></html>";
}

// Núcleo compartilhado por download e envio por e-mail — monta o PDF
// uma única vez para não duplicar a lógica entre os dois caminhos.
function rhEv_montarBlobRecibo_(idEvento) {
  var ev = rhEv_buscarPorId_(idEvento);
  if (!ev) return null;

  var colaborador = null;
  listarColaboradoresRH_interno_().forEach(function (c) { if (c.id === ev.colaboradorId) colaborador = c; });

  var html = rhEv_htmlRecibo_(ev, colaborador, rh_carregarLogo_());
  var nomeArquivo = "Recibo_" + String(ev.tipo).replace(/[^A-Za-z0-9]/g, "") + "_" +
    String(ev.nome || "").replace(/[^a-zA-Z0-9À-ÿ-]/g, "_") + "_" + String(ev.dataEvento || "").replace(/-/g, "") + ".pdf";
  var blobPdf = Utilities.newBlob(html, "text/html", nomeArquivo).getAs("application/pdf");

  return { evento: ev, colaborador: colaborador, nomeArquivo: nomeArquivo, blobPdf: blobPdf };
}

// Devolve o PDF em base64 — sem salvar no Drive e sem link público.
// Mesma decisão do holerite: valor líquido e IRRF são dado sensível.
function rhEvGerarReciboPDF(idEvento, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var m = rhEv_montarBlobRecibo_(idEvento);
    if (!m) return { ok: false, mensagem: "Lançamento não encontrado." };

    Logger.log("[RH] Recibo de evento gerado: " + m.evento.tipo + " / " + m.evento.nome +
      " por " + (sessao.nome || sessao.usuario));

    return { ok: true, nomeArquivo: m.nomeArquivo, base64: Utilities.base64Encode(m.blobPdf.getBytes()) };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar recibo: " + e.message };
  }
}

function rhEvEnviarReciboPorEmail(idEvento, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var m = rhEv_montarBlobRecibo_(idEvento);
    if (!m) return { ok: false, mensagem: "Lançamento não encontrado." };

    var email = m.colaborador && String(m.colaborador.email || "").trim();
    if (!email) return { ok: false, mensagem: "O colaborador não tem e-mail cadastrado." };

    var corpo = "<p>Olá, " + rh_esc_(m.evento.nome) + "!</p>" +
      "<p>Segue em anexo o recibo de <strong>" + rh_esc_(m.evento.rotulo) + "</strong> (" + rh_esc_(m.evento.referencia) + ").</p>" +
      "<p>Valor líquido: <strong>" + rh_moeda_(m.evento.liquido) + "</strong></p>";
    var htmlBody = sind_emailHtml_("📄 " + m.evento.rotulo, corpo, "");
    var corpoTexto = m.evento.rotulo + " (" + m.evento.referencia + ") em anexo. Valor líquido: " + rh_moeda_(m.evento.liquido) + ".";

    var resultado = enviarEmailSISGEP_(email, m.evento.rotulo + " — " + m.evento.referencia, corpoTexto, {
      htmlBody: htmlBody,
      origem: "RH",
      attachments: [m.blobPdf]
    });

    if (!resultado || !resultado.ok) {
      return { ok: false, mensagem: "Erro ao enviar: " + ((resultado && resultado.mensagem) || "falha desconhecida") };
    }

    Logger.log("[RH] Recibo de evento enviado: " + m.evento.id + " -> " + email + " por " + (sessao.nome || sessao.usuario));
    return { ok: true, mensagem: "Recibo enviado para " + email + "." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar recibo: " + e.message };
  }
}
