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

function rh_gerarHtmlHolerite_(lancamento) {
  return "" +
    "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>" +
    "<style>" +
    "@page{size:A4;margin:18mm 16mm;}" +
    "body{font-family:Arial,sans-serif;color:#111827;margin:0;}" +
    ".doc{border:2px solid #002f6c;padding:24px 28px;}" +
    ".cab{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C9A84C;padding-bottom:12px;margin-bottom:16px;}" +
    ".cab h1{font-size:16px;color:#002f6c;margin:0;}" +
    ".cab .sub{font-size:11px;color:#555;margin-top:2px;}" +
    ".cab .comp{font-size:13px;font-weight:bold;color:#002f6c;text-align:right;}" +
    "table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;}" +
    "td{padding:6px 4px;border-bottom:1px solid #e5e7eb;}" +
    "td.lbl{color:#555;}" +
    "td.val{text-align:right;font-weight:bold;}" +
    ".tot{background:#f4f6fa;font-size:13px;}" +
    ".tot td{border-bottom:none;padding:10px 4px;}" +
    ".liq{background:#002f6c;color:#fff;font-size:15px;font-weight:bold;}" +
    ".liq td{border-bottom:none;padding:12px 4px;}" +
    ".rodape{margin-top:20px;font-size:9.5px;color:#888;}" +
    "</style></head><body><div class='doc'>" +
    "<div class='cab'><div><h1>Holerite — SindEducação-ES</h1><div class='sub'>" + rh_esc_(lancamento.nome) + " · " + rh_esc_(lancamento.cargo) + "</div></div>" +
    "<div class='comp'>Competência<br>" + rh_esc_(lancamento.competencia) + "</div></div>" +
    "<table>" +
    "<tr><td class='lbl'>Dias trabalhados</td><td class='val'>" + lancamento.diasTrabalhados + " / " + lancamento.diasMes + "</td></tr>" +
    "<tr><td class='lbl'>Dependentes (IRRF)</td><td class='val'>" + lancamento.dependentes + "</td></tr>" +
    "<tr><td class='lbl'>Salário (proporcional)</td><td class='val'>" + rh_moeda_(lancamento.salarioProrata) + "</td></tr>" +
    "<tr><td class='lbl'>Benefícios</td><td class='val'>" + rh_moeda_(lancamento.beneficios) + "</td></tr>" +
    "<tr class='tot'><td class='lbl'>Bruto</td><td class='val'>" + rh_moeda_(lancamento.bruto) + "</td></tr>" +
    "<tr><td class='lbl'>(–) INSS</td><td class='val'>" + rh_moeda_(lancamento.inss) + "</td></tr>" +
    "<tr><td class='lbl'>(–) IRRF</td><td class='val'>" + rh_moeda_(lancamento.irrf) + "</td></tr>" +
    "<tr><td class='lbl'>(–) Descontos</td><td class='val'>" + rh_moeda_(lancamento.descontos) + "</td></tr>" +
    "<tr class='liq'><td>Líquido a receber</td><td class='val'>" + rh_moeda_(lancamento.liquido) + "</td></tr>" +
    "</table>" +
    "<div style='font-size:11px;color:#555;'>FGTS patronal do período (informativo, não descontado do líquido): " + rh_moeda_(lancamento.fgtsPatronal) + "</div>" +
    (lancamento.observacao ? "<div style='font-size:11px;color:#555;margin-top:8px;'>Observação: " + rh_esc_(lancamento.observacao) + "</div>" : "") +
    "<div class='rodape'>Documento gerado eletronicamente pelo SISGEP em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + ".</div>" +
    "</div></body></html>";
}

// Gera o PDF e devolve em base64 — sem salvar no Drive, sem link público.
// Quem gerou fica só no log (dado sensível: salário líquido, IRRF).
function gerarHoleritePDF(idLancamento, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var lancamento = rh_buscarLancamentoFolhaPorId_(idLancamento);
    if (!lancamento) return { ok: false, mensagem: "Lançamento de folha não encontrado." };

    var html = rh_gerarHtmlHolerite_(lancamento);
    var nomeArquivo = "Holerite_" + lancamento.competencia + "_" + lancamento.nome.replace(/[^a-zA-Z0-9À-ÿ-]/g, "_") + ".pdf";
    var blobPdf = Utilities.newBlob(html, "text/html", nomeArquivo).getAs("application/pdf");

    Logger.log("[RH] Holerite gerado: " + lancamento.competencia + " / " + lancamento.nome + " por " + (sessao.nome || sessao.usuario));

    return {
      ok: true,
      nomeArquivo: nomeArquivo,
      base64: Utilities.base64Encode(blobPdf.getBytes())
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar holerite: " + e.message };
  }
}
