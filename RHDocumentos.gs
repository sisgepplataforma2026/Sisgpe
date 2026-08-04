// ================================
// ARQUIVO: RHDocumentos.gs
// MÓDULO: RH — Documentos por colaborador + Holerite individual (Fase 3)
//
// Achados da auditoria resolvidos aqui:
//   - "Card Documentos não conta documento nenhum — reaproveita a mesma
//     data de férias. Não existe upload nem lista de documentos."
//   - "Sem holerite individual — só exportação CSV consolidada de todos
//     os colaboradores juntos."
//
// Upload segue o mesmo padrão já usado em Jurídico/Despesas: base64
// vindo do cliente vira arquivo real no Drive (pasta própria do RH,
// criada na primeira vez), só o link/ID ficam na planilha.
//
// O holerite é diferente do padrão de Ofícios/Voucher: NÃO é salvo no
// Drive nem recebe link "qualquer um com o link" — contém salário e
// dado de IRRF, então o PDF é gerado e devolvido em base64 direto para
// download no navegador, sem deixar um arquivo público-por-link para
// trás (mesmo cuidado que motivou a auditoria a marcar "sem trilha de
// auditoria, sem criptografia" como achado Alta em RH).
// ================================

var ABA_RH_DOCUMENTOS = "RH_DOCUMENTOS";
var RH_DOC_TIPOS_ACEITOS_ = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
var RH_DOC_TAMANHO_MAX_ = 10 * 1024 * 1024; // 10MB

function rh_garantirDocumentos_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_DOCUMENTOS);
  if (!sh) sh = ss.insertSheet(ABA_RH_DOCUMENTOS);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "COLABORADOR_ID", "CATEGORIA", "NOME_ARQUIVO", "TIPO",
      "LINK", "FILE_ID", "ENVIADO_POR", "ENVIADO_EM"
    ]);
    sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Pasta do Drive dedicada aos documentos de RH — mesmo padrão de
// jurObterPastaAnexos_ (Juridico.gs): cria na primeira vez, guarda o ID
// no cofre, reaproveita depois. Sem pasta-mãe fixa pré-existente para
// RH, então cria uma pasta raiz própria.
function rh_obterPastaDocumentos_() {
  var props = PropertiesService.getScriptProperties();
  var pastaId = (props.getProperty("PASTA_RH_DOCUMENTOS_ID") || "").trim();

  if (pastaId) {
    try {
      return obterOuCriarSubpastaAno(pastaId);
    } catch (e) {
      Logger.log("rh_obterPastaDocumentos_: PASTA_RH_DOCUMENTOS_ID configurado (" + pastaId + ") inválido — recriando. " + e.message);
    }
  }

  var pastas = DriveApp.getRootFolder().getFoldersByName("SISGEP - RH - Documentos");
  var pastaRh = pastas.hasNext() ? pastas.next() : DriveApp.createFolder("SISGEP - RH - Documentos");
  props.setProperty("PASTA_RH_DOCUMENTOS_ID", pastaRh.getId());

  return obterOuCriarSubpastaAno(pastaRh.getId());
}

/* =========================================
 * DOCUMENTOS DO COLABORADOR
 * ========================================= */
function uploadDocumentoRH(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};
    var colaboradorId = String(dados.colaboradorId || "").trim();
    var base64 = String(dados.base64 || "").trim();
    var nomeArq = String(dados.nome || "documento").trim();
    var tipoArq = String(dados.tipo || "application/pdf").trim();
    var categoria = String(dados.categoria || "Outro").trim();

    if (!colaboradorId) return { ok: false, mensagem: "Colaborador não informado." };
    if (!base64) return { ok: false, mensagem: "Nenhum arquivo recebido." };
    if (RH_DOC_TIPOS_ACEITOS_.indexOf(tipoArq) === -1) {
      return { ok: false, mensagem: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." };
    }

    var bytes = Utilities.base64Decode(base64);
    if (bytes.length > RH_DOC_TAMANHO_MAX_) {
      return { ok: false, mensagem: "Arquivo maior que 10MB." };
    }

    var nomeFinal = "RH_" + colaboradorId + "_" + nomeArq.replace(/[^a-zA-Z0-9._À-ÿ-]/g, "_");
    var blob = Utilities.newBlob(bytes, tipoArq, nomeFinal);
    var pasta = rh_obterPastaDocumentos_();
    var arquivo = pasta.createFile(blob);
    try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eShare) {}

    var link = "https://drive.google.com/file/d/" + arquivo.getId() + "/view";
    var quem = sessao.nome || sessao.usuario || "SISGEP";

    var sh = rh_garantirDocumentos_();
    var novoId = rh_gerarId_("DOC");
    sh.appendRow([novoId, colaboradorId, categoria, nomeArq, tipoArq, link, arquivo.getId(), quem, new Date()]);

    return { ok: true, id: novoId, link: link, nome: nomeArq, mensagem: "Documento enviado com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar documento: " + e.message };
  }
}

function listarDocumentosRH(colaboradorId, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    colaboradorId = String(colaboradorId || "").trim();
    var sh = rh_garantirDocumentos_();
    if (sh.getLastRow() < 2) return [];

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    return dados
      .filter(function (l) { return !colaboradorId || String(l[1]) === colaboradorId; })
      .map(function (l) {
        return {
          id: l[0], colaboradorId: l[1], categoria: l[2], nome: l[3], tipo: l[4],
          link: l[5], fileId: l[6], enviadoPor: l[7], enviadoEm: rh_formatarData_(l[8])
        };
      })
      .sort(function (a, b) { return new Date(b.enviadoEm) - new Date(a.enviadoEm); });
  } catch (e) {
    Logger.log("listarDocumentosRH erro: " + e.message);
    return [];
  }
}

// Exclusão exige administrador — mesmo critério do cadastro de
// colaborador (dado sensível de RH).
function excluirDocumentoRH(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Documento não informado." };

    var sh = rh_garantirDocumentos_();
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Documento não encontrado." };

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = dados.length - 1; i >= 0; i--) {
      if (String(dados[i][0]) === id) {
        var fileId = String(dados[i][6] || "").trim();
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); }
          catch (eTrash) { Logger.log("excluirDocumentoRH: não consegui mover pra lixeira (" + fileId + "): " + eTrash.message); }
        }
        sh.deleteRow(i + 2);
        return { ok: true, mensagem: "Documento excluído com sucesso." };
      }
    }
    return { ok: false, mensagem: "Documento não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao excluir documento: " + e.message };
  }
}

// Contagem real para o card "Documentos" do dashboard — antes reaproveitava
// a data de vencimento de férias e não contava documento nenhum.
function contarDocumentosRH(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var sh = rh_garantirDocumentos_();
    return Math.max(0, sh.getLastRow() - 1);
  } catch (e) {
    return 0;
  }
}

/* =========================================
 * HOLERITE INDIVIDUAL (PDF)
 * ========================================= */
function rh_esc_(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function rh_moeda_(v) {
  return "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
}

// Faixa de IRRF aplicada à base do lançamento — só para exibição no
// "bases de cálculo" do holerite (o valor de IRRF em si já foi calculado
// e gravado na hora de gerar a folha; isto não recalcula nada, só
// localiza qual alíquota da tabela ATUAL bate com a base gravada).
function rh_faixaIrrfAliquota_(baseIrrf, tabelaIrrf) {
  if (!baseIrrf) return 0;
  for (var i = 0; i < tabelaIrrf.length; i++) {
    if (baseIrrf <= tabelaIrrf[i].ate) return tabelaIrrf[i].aliquota;
  }
  return tabelaIrrf.length ? tabelaIrrf[tabelaIrrf.length - 1].aliquota : 0;
}

// Layout inspirado no holerite real do sindicato (modelo .odg fornecido
// pelo usuário): identificação completa do colaborador, tabela
// itemizada de rubricas (base + extras do motor de rubricas) e bases de
// cálculo no rodapé — via única (não duplica o documento na mesma
// página como o modelo original, que existe só para caber 2 vias
// físicas por folha impressa; aqui o holerite é baixado individualmente
// por colaborador, então isso não se aplica).
function rh_gerarHtmlHolerite_(lancamento, colaborador, rubricasExtras, faixaIrrfPct) {
  colaborador = colaborador || {};
  rubricasExtras = rubricasExtras || [];

  var linhasRubrica = [];
  linhasRubrica.push({ codigo: "SAL", descricao: "Salário (" + lancamento.diasTrabalhados + "/" + lancamento.diasMes + " dias)", referencia: lancamento.diasTrabalhados + "/" + lancamento.diasMes, vencimento: lancamento.salarioProrata, desconto: 0 });
  if (lancamento.beneficios) linhasRubrica.push({ codigo: "BEN", descricao: "Benefícios", referencia: "", vencimento: lancamento.beneficios, desconto: 0 });
  rubricasExtras.forEach(function (r) {
    linhasRubrica.push({
      codigo: r.codigo, descricao: r.descricao, referencia: r.referencia || "",
      vencimento: r.tipo === "Provento" ? r.valor : 0, desconto: r.tipo === "Desconto" ? r.valor : 0
    });
  });
  if (lancamento.descontos) linhasRubrica.push({ codigo: "DESC", descricao: "Descontos diversos", referencia: "", vencimento: 0, desconto: lancamento.descontos });
  if (lancamento.inss) linhasRubrica.push({ codigo: "INSS", descricao: "INSS", referencia: "", vencimento: 0, desconto: lancamento.inss });
  if (lancamento.irrf) linhasRubrica.push({ codigo: "IRRF", descricao: "IRRF", referencia: "", vencimento: 0, desconto: lancamento.irrf });

  var totalVencimentos = linhasRubrica.reduce(function (s, r) { return s + r.vencimento; }, 0);
  var totalDescontos = linhasRubrica.reduce(function (s, r) { return s + r.desconto; }, 0);

  var linhasHtml = linhasRubrica.map(function (r) {
    return "<tr><td>" + rh_esc_(r.codigo) + "</td><td>" + rh_esc_(r.descricao) + "</td><td class='ref'>" + rh_esc_(r.referencia) + "</td>" +
      "<td class='val'>" + (r.vencimento ? rh_moeda_(r.vencimento) : "") + "</td>" +
      "<td class='val'>" + (r.desconto ? rh_moeda_(r.desconto) : "") + "</td></tr>";
  }).join("");

  return "" +
    "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>" +
    "<style>" +
    "@page{size:A4;margin:14mm 14mm;}" +
    "body{font-family:Arial,sans-serif;color:#111827;margin:0;font-size:11.5px;}" +
    ".doc{border:2px solid #001f4d;padding:18px 22px;}" +
    ".topo{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C9A84C;padding-bottom:10px;margin-bottom:12px;}" +
    ".topo h1{font-size:14px;color:#001f4d;margin:0;}" +
    ".topo .sub{font-size:10px;color:#555;margin-top:2px;}" +
    ".topo .comp{font-size:12px;font-weight:bold;color:#001f4d;text-align:right;}" +
    ".ident{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:10px;margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#f8fafc;}" +
    ".ident div b{display:block;color:#94a3b8;font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;font-weight:900;}" +
    ".ident div span{font-weight:700;color:#0f172a;}" +
    ".ident .nome{grid-column:1/-1;}" +
    "table.rub{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:10px;}" +
    "table.rub th{background:#001f4d;color:#fff;text-align:left;padding:6px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;}" +
    "table.rub td{padding:5px 6px;border-bottom:1px solid #e5e7eb;}" +
    "table.rub td.ref{color:#64748b;}" +
    "table.rub td.val{text-align:right;font-weight:700;}" +
    ".tot-linha{display:flex;justify-content:flex-end;gap:22px;font-size:11px;padding:8px 6px;background:#f4f6fa;border-radius:6px;margin-bottom:10px;}" +
    ".tot-linha b{color:#001f4d;}" +
    ".liq{background:#001f4d;color:#fff;font-size:14px;font-weight:900;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;margin-bottom:12px;}" +
    ".bases{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:9.5px;border-top:1px solid #e5e7eb;padding-top:10px;}" +
    ".bases div b{display:block;color:#94a3b8;font-size:8.5px;text-transform:uppercase;margin-bottom:2px;font-weight:900;}" +
    ".bases div span{font-weight:700;color:#0f172a;}" +
    ".rodape{margin-top:16px;font-size:9px;color:#888;}" +
    ".recibo{margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:9.5px;color:#555;}" +
    "</style></head><body><div class='doc'>" +
    "<div class='topo'><div><h1>SINDEDUCAÇÃO-ES</h1><div class='sub'>SINDICATO DOS AUXILIARES DE ADM ESCOLAR DO ESTADO DO ES · CNPJ: 31.815.780/0001-51</div></div>" +
    "<div class='comp'>Recibo de Pagamento<br>Competência " + rh_esc_(lancamento.competencia) + "</div></div>" +
    "<div class='ident'>" +
    "<div class='nome'><b>Colaborador</b><span>" + rh_esc_(colaborador.matricula || "-") + " · " + rh_esc_(lancamento.nome) + " — " + rh_esc_(lancamento.cargo) + "</span></div>" +
    "<div><b>CBO</b><span>" + rh_esc_(colaborador.cbo || "-") + "</span></div>" +
    "<div><b>Centro de Custo</b><span>" + rh_esc_(colaborador.centroCusto || "-") + "</span></div>" +
    "<div><b>Filial</b><span>" + rh_esc_(colaborador.filial || "-") + "</span></div>" +
    "<div><b>Admissão</b><span>" + rh_esc_(colaborador.admissao || "-") + "</span></div>" +
    "<div><b>Dependentes (IRRF)</b><span>" + lancamento.dependentes + "</span></div>" +
    "</div>" +
    "<table class='rub'><thead><tr><th>Código</th><th>Descrição</th><th>Referência</th><th>Vencimentos</th><th>Descontos</th></tr></thead>" +
    "<tbody>" + linhasHtml + "</tbody></table>" +
    "<div class='tot-linha'><span>Total de Vencimentos: <b>" + rh_moeda_(totalVencimentos) + "</b></span><span>Total de Descontos: <b>" + rh_moeda_(totalDescontos) + "</b></span></div>" +
    "<div class='liq'><span>Valor Líquido</span><span>" + rh_moeda_(lancamento.liquido) + "</span></div>" +
    "<div class='bases'>" +
    "<div><b>Salário Base</b><span>" + rh_moeda_(lancamento.salario) + "</span></div>" +
    "<div><b>Sal. Contr. INSS</b><span>" + rh_moeda_(lancamento.salarioProrata) + "</span></div>" +
    "<div><b>Base Cálc. FGTS</b><span>" + rh_moeda_(lancamento.salarioProrata) + "</span></div>" +
    "<div><b>F.G.T.S. do Mês</b><span>" + rh_moeda_(lancamento.fgtsPatronal) + "</span></div>" +
    "<div><b>Base Cálc. IRRF</b><span>" + rh_moeda_(lancamento.baseIrrf) + " (" + Number(faixaIrrfPct || 0) + "%)</span></div>" +
    "</div>" +
    (lancamento.observacao ? "<div style='font-size:10px;color:#555;margin-top:8px;'>Observação: " + rh_esc_(lancamento.observacao) + "</div>" : "") +
    "<div class='recibo'>Declaro ter recebido a importância líquida discriminada neste recibo.<br><br>____/____/_______ &nbsp;&nbsp;&nbsp;&nbsp; Assinatura do Funcionário: ______________________________________</div>" +
    "<div class='rodape'>Documento gerado eletronicamente pelo SISGEP em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + ".</div>" +
    "</div></body></html>";
}

// Núcleo compartilhado por gerarHoleritePDF (download) e
// enviarHoleritePorEmail (anexo) — busca o lançamento, o colaborador e
// monta o PDF uma única vez, pra não duplicar a lógica entre os dois.
function rh_montarBlobHolerite_(idLancamento) {
  var lancamento = rh_buscarLancamentoFolhaPorId_(idLancamento);
  if (!lancamento) return null;

  var colaborador = listarColaboradoresRH_interno_().filter(function (c) { return c.id === lancamento.colaboradorId; })[0] || null;
  var rubricasExtras = rh_listarFolhaRubricasPorFolhaId_(idLancamento);
  var cfg = rh_obterConfigTributaria_();
  var faixaIrrfPct = rh_faixaIrrfAliquota_(lancamento.baseIrrf, cfg.irrf);

  var html = rh_gerarHtmlHolerite_(lancamento, colaborador, rubricasExtras, faixaIrrfPct);
  var nomeArquivo = "Holerite_" + lancamento.competencia + "_" + lancamento.nome.replace(/[^a-zA-Z0-9À-ÿ-]/g, "_") + ".pdf";
  var blobPdf = Utilities.newBlob(html, "text/html", nomeArquivo).getAs("application/pdf");

  return { lancamento: lancamento, colaborador: colaborador, nomeArquivo: nomeArquivo, blobPdf: blobPdf };
}

// Gera o PDF e devolve em base64 — sem salvar no Drive, sem link público.
// Quem gerou fica só no log (dado sensível: salário líquido, IRRF).
function gerarHoleritePDF(idLancamento, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var m = rh_montarBlobHolerite_(idLancamento);
    if (!m) return { ok: false, mensagem: "Lançamento de folha não encontrado." };

    Logger.log("[RH] Holerite gerado: " + m.lancamento.competencia + " / " + m.lancamento.nome + " por " + (sessao.nome || sessao.usuario));

    return {
      ok: true,
      nomeArquivo: m.nomeArquivo,
      base64: Utilities.base64Encode(m.blobPdf.getBytes())
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar holerite: " + e.message };
  }
}

// Núcleo sem checagem de sessão — usado tanto por enviarHoleritePorEmail
// (1 clique = 1 pessoa) quanto por enviarTodosHoleritesPorEmail_interno_
// (loop em massa), que já validam o token uma única vez antes de chamar
// isto em sequência.
function rh_enviarHoleritePorEmail_(idLancamento, quem) {
  var m = rh_montarBlobHolerite_(idLancamento);
  if (!m) return { ok: false, mensagem: "Lançamento de folha não encontrado.", nome: "" };

  var email = m.colaborador && String(m.colaborador.email || "").trim();
  if (!email) return { ok: false, mensagem: "sem e-mail cadastrado", nome: m.lancamento.nome };

  var corpo = "<p>Olá, " + rh_esc_(m.lancamento.nome) + "!</p>" +
    "<p>Segue em anexo o holerite referente à competência <strong>" + rh_esc_(m.lancamento.competencia) + "</strong>.</p>" +
    "<p>Valor líquido: <strong>" + rh_moeda_(m.lancamento.liquido) + "</strong></p>";
  var htmlBody = sind_emailHtml_("💰 Holerite — " + m.lancamento.competencia, corpo, "");
  var corpoTexto = "Holerite de " + m.lancamento.competencia + " em anexo. Valor líquido: " + rh_moeda_(m.lancamento.liquido) + ".";

  var resultado = enviarEmailSISGEP_(email, "Holerite — " + m.lancamento.competencia, corpoTexto, {
    htmlBody: htmlBody,
    origem: "RH",
    attachments: [m.blobPdf]
  });

  if (!resultado || !resultado.ok) {
    return { ok: false, mensagem: (resultado && resultado.mensagem) || "falha desconhecida", nome: m.lancamento.nome };
  }

  Logger.log("[RH] Holerite enviado por e-mail: " + m.lancamento.competencia + " / " + m.lancamento.nome + " -> " + email + " por " + quem);
  return { ok: true, nome: m.lancamento.nome, email: email };
}

// Envia o holerite em PDF por e-mail para o endereço cadastrado do
// colaborador — mesma camada central de envio já usada pelo resto do
// SISGEP (EmailCore.gs/enviarEmailSISGEP_), com o PDF como anexo. Não
// existe fila/histórico de reenvio nesta fase: cada clique dispara um
// envio imediato, best-effort (falha não desfaz nada, só devolve erro).
function enviarHoleritePorEmail(idLancamento, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var r = rh_enviarHoleritePorEmail_(idLancamento, sessao.nome || sessao.usuario);
    if (!r.ok) return { ok: false, mensagem: "Erro ao enviar e-mail" + (r.nome ? " (" + r.nome + ")" : "") + ": " + r.mensagem };
    return { ok: true, mensagem: "Holerite enviado para " + r.email + "." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar holerite: " + e.message };
  }
}

// Envia o holerite de TODOS os lançamentos de uma competência de uma
// vez — best-effort por pessoa: quem não tem e-mail cadastrado ou dá
// erro no envio é reportado separadamente, não trava os demais.
function enviarTodosHoleritesPorEmail(competencia, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência." };

    var linhas = listarFolhaRH(competencia, tokenSessao);
    if (!linhas.length) return { ok: false, mensagem: "Nenhum lançamento encontrado para " + competencia + "." };

    var quem = sessao.nome || sessao.usuario;
    var enviados = [], falhas = [];

    linhas.forEach(function (l) {
      try {
        var r = rh_enviarHoleritePorEmail_(l.id, quem);
        if (r.ok) enviados.push(r.nome); else falhas.push(r.nome + ": " + r.mensagem);
      } catch (e) {
        falhas.push(l.nome + ": " + e.message);
      }
    });

    return {
      ok: true,
      enviados: enviados,
      falhas: falhas,
      mensagem: enviados.length + " holerite(s) enviado(s)" + (falhas.length ? ", " + falhas.length + " não enviado(s)" : "") + "."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao enviar holerites: " + e.message };
  }
}
