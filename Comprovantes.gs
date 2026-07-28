// ================================================================
// 📄 ARQUIVO: Comprovantes.gs
// Módulo de Comprovantes e Despesas Avulsas
// ================================================================

var ABA_COMPROVANTES       = "COMPROVANTES";
var PASTA_COMPROVANTES_ID = "1IsHNsqHJCiMkjZiqmY3rOor_g7IoUgcv";
var EMAIL_CONTABILIDADE_TO = "operacional02@impactocondominios.com";
var EMAIL_CONTABILIDADE_CC = "operacional03.impactocond@gmail.com";
var EMAIL_COPIA_INTERNO    = "secretaria@sindeducacao.com";
var TIPOS_COMPROVANTE      = ["Compra Avulsa", "Alvará", "Recibo Diverso", "Outros"];

var CABECALHO_COMPROVANTES = [
  "ID","DATA_LANCAMENTO","CATEGORIA","DESCRICAO",
  "VALOR","RESPONSAVEL","FILE_ID","FILE_NOME",
  "MIME_TYPE","STATUS_ENVIO","DATA_ENVIO","OBSERVACOES",
  "PDF_ID","PDF_URL","NUMERO_DOC"
];

TIPOS_COMPROVANTE = (TIPOS_COMPROVANTE || []).concat([
  "Beneficios",
  "Voucher",
  "Parque do China",
  "Agenda de Oftalmo"
]).filter(function(item, idx, lista) {
  return lista.indexOf(item) === idx;
});

/* ================= HELPERS ================= */

function escapeHtmlComprovante_(txt) {
  return String(txt || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizarNomeArquivoComprovante_(txt) {
  // ✅ CORREÇÃO 4 — normaliza e limita preservando início (data fica no começo)
  return String(txt || "Comprovante")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);  // aumentado para 120 para não cortar nome do responsável
}

function converterHtmlParaPdfComprovante_(html, nomeArquivo, pastaDestino) {
  if (!html) throw new Error("HTML vazio para conversão em PDF.");
  if (!pastaDestino) throw new Error("Pasta de destino não informada.");

  var nome = sanitizarNomeArquivoComprovante_(nomeArquivo || "Comprovante") + ".pdf";

  var blobHtml = Utilities.newBlob(html, "text/html", nome.replace(/\.pdf$/i, ".html"));
  var blobPdf  = blobHtml.getAs(MimeType.PDF).setName(nome);

  return pastaDestino.createFile(blobPdf);
}
/* ================= SALVAR ANEXOS ================= */

function salvarAnexosComprovante_(dados, pastaMes) {

  var ids   = [];
  var nomes = [];
  var mimes = [];

  if (dados.arquivos && dados.arquivos.length) {

    dados.arquivos.forEach(function(arq) {

      if (!arq || !arq.base64) return;

      var blob = Utilities.newBlob(
        Utilities.base64Decode(arq.base64),
        arq.tipo || "application/octet-stream",
        arq.nome || "anexo"
      );
var tzAnexo  = Session.getScriptTimeZone();
var mesesPtA = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
var agoraA   = new Date();
var mesNumA  = parseInt(Utilities.formatDate(agoraA, tzAnexo, "MM"), 10);
var mesAbrA  = mesesPtA[mesNumA - 1];

var nomeAnexo = sanitizarNomeArquivoComprovante_(
  Utilities.formatDate(agoraA, tzAnexo, "dd") + "-"
  + Utilities.formatDate(agoraA, tzAnexo, "MM") + "-"
  + Utilities.formatDate(agoraA, tzAnexo, "yyyy")
  + " " + mesAbrA
  + " - " + (dados.categoria || "Comprovante")
  + " - " + String(dados.descricao || "").slice(0, 40)
  + " - " + String(arq.nome || "anexo")
);
blob.setName(nomeAnexo);
var salvo = pastaMes.createFile(blob);
salvo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // ✅

      ids.push(salvo.getId());
      nomes.push(salvo.getName());
      mimes.push(salvo.getMimeType());

    });

  }

  return {
    ids: ids.join(","),
    nomes: nomes.join(" | "),
    mimes: mimes.join(" | ")
  };

}
/* ================= ABA ================= */

function garantirAbaComprovantes_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_COMPROVANTES);

  if (!sh) {
    sh = ss.insertSheet(ABA_COMPROVANTES);
    sh.appendRow(CABECALHO_COMPROVANTES);
    sh.getRange(1, 1, 1, CABECALHO_COMPROVANTES.length).setFontWeight("bold");
    sh.setFrozenRows(1);
    return sh;
  }

  var lastCol = Math.max(sh.getLastColumn(), CABECALHO_COMPROVANTES.length);
  var atual = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  var precisaAtualizar = false;
  CABECALHO_COMPROVANTES.forEach(function(h, i) {
    if (String(atual[i] || "").trim() !== h) precisaAtualizar = true;
  });

  if (precisaAtualizar) {
    sh.getRange(1, 1, 1, CABECALHO_COMPROVANTES.length).setValues([CABECALHO_COMPROVANTES]);
    sh.getRange(1, 1, 1, CABECALHO_COMPROVANTES.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  return sh;
}
/* ================= ABAS DO MÓDULO COMPROVANTES ================= */

function criarAbasModuloComprovantes() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);

  var abasCriadas = [];

  var abaLotes = garantirAbaComprovantes_();
  abasCriadas.push(abaLotes.getName());

  var abaItens = ss.getSheetByName("COMPROVANTES_ITENS");

  var cabecalhoItens = [
    "LOTE_ID",
    "NUMERO_LOTE",
    "ITEM",
    "DATA",
    "CATEGORIA",
    "DESCRICAO",
    "VALOR",
    "ARQUIVO_ID",
    "ARQUIVO_NOME",
    "MIME_TYPE",
    "STATUS",
    "DATA_ENVIO",
    "OBSERVACOES"
  ];

  if (!abaItens) {
    abaItens = ss.insertSheet("COMPROVANTES_ITENS");
    abaItens.appendRow(cabecalhoItens);
    abaItens.getRange(1, 1, 1, cabecalhoItens.length).setFontWeight("bold");
    abaItens.setFrozenRows(1);
  } else {
    abaItens.getRange(1, 1, 1, cabecalhoItens.length).setValues([cabecalhoItens]);
    abaItens.getRange(1, 1, 1, cabecalhoItens.length).setFontWeight("bold");
    abaItens.setFrozenRows(1);
  }

  abasCriadas.push(abaItens.getName());

  return {
    ok: true,
    mensagem: "Abas do módulo de comprovantes verificadas/criadas com sucesso.",
    abas: abasCriadas
  };
}
/* ================= PASTA DO MÊS ================= */

function obterOuCriarPastaMesComprovantes_() {
  var pastaRaiz = DriveApp.getFolderById(PASTA_COMPROVANTES_ID);
  var hoje = new Date();
  var tz = Session.getScriptTimeZone();

  var nomeAno = Utilities.formatDate(hoje, tz, "yyyy");
  var meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var nomeMes = Utilities.formatDate(hoje, tz, "MM") + " - " + meses[hoje.getMonth()];

  // Pasta do ano
  var pastasAno = pastaRaiz.getFoldersByName(nomeAno);
  var pastaAno = pastasAno.hasNext() ? pastasAno.next() : pastaRaiz.createFolder(nomeAno);

  // Pasta do mês dentro do ano
  var pastasMes = pastaAno.getFoldersByName(nomeMes);
  return pastasMes.hasNext() ? pastasMes.next() : pastaAno.createFolder(nomeMes);
}

/* ================= NUMERAÇÃO ================= */

function gerarNumeroComprovante_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sh  = garantirAbaComprovantes_();
    var ano = new Date().getFullYear().toString();
    var max = 0;

    if (sh.getLastRow() > 1) {
      var valores = sh.getRange(2, 15, sh.getLastRow() - 1, 1).getValues();

      valores.forEach(function(row) {
        var txt = String(row[0] || "").trim();
        if (txt.indexOf("/" + ano) === -1) return;

        var num = parseInt(txt.split("/")[0], 10);
        if (!isNaN(num) && num > max) max = num;
      });
    }

    return String(max + 1).padStart(3, "0") + "/" + ano;

  } finally {
    lock.releaseLock();
  }
}

/* ================= LISTAR ================= */

function listarComprovantes(filtros) {
  filtros = filtros || {};

  try {
    var sh = garantirAbaComprovantes_();
    if (sh.getLastRow() < 2) return { ok: true, lista: [] };

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
    var lista = [];

    var catFiltro = String(filtros.categoria || "").trim();
    var mesFiltro = String(filtros.mes || "").trim();
    var stFiltro  = String(filtros.status || "").trim().toUpperCase();

    dados.forEach(function(row, i) {
      var id = String(row[0] || "").trim();
      if (!id) return;

      var dataLanc  = row[1] ? new Date(row[1]) : null;
      var dataEnvio = row[10] ? new Date(row[10]) : null;

      var categoria = String(row[2] || "").trim();
      var status    = String(row[9] || "PENDENTE").trim().toUpperCase();

      if (catFiltro && categoria !== catFiltro) return;
      if (stFiltro && status !== stFiltro) return;

      if (mesFiltro && dataLanc) {
        var mesItem = Utilities.formatDate(dataLanc, Session.getScriptTimeZone(), "yyyy-MM");
        if (mesItem !== mesFiltro) return;
      }

      lista.push({
        rowIndex:    i + 2,
        id:          id,
        data:        dataLanc ? Utilities.formatDate(dataLanc, Session.getScriptTimeZone(), "dd/MM/yyyy") : "",
        dataEnvio:   dataEnvio ? Utilities.formatDate(dataEnvio, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : "",
        categoria:   categoria,
        descricao:   String(row[3] || "").trim(),
        valor:       String(row[4] || "").trim(),
        responsavel: String(row[5] || "").trim(),
        fileId:      String(row[6] || "").trim(),
        fileNome:    String(row[7] || "").trim(),
        mimeType:    String(row[8] || "").trim(),
        status:      status,
        obs:         String(row[11] || "").trim(),
        pdfId:       String(row[12] || "").trim(),
        pdfUrl:      String(row[13] || "").trim(),
        numeroDoc:   String(row[14] || "").trim()
      });
    });

    lista.sort(function(a, b) {
      return b.rowIndex - a.rowIndex;
    });

    return { ok: true, lista: lista };

  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ================= HTML DO DOCUMENTO ================= */

function gerarHtmlComprovanteCompleto_(p, isPreview) {
  p = p || {};

  var numero      = escapeHtmlComprovante_(p.numero || "PRÉVIA");
  var categoria   = escapeHtmlComprovante_(p.categoria || "Comprovante");
  var descricao   = escapeHtmlComprovante_(p.descricao || "—");
  var valor       = escapeHtmlComprovante_(p.valor || "—");
  var responsavel = escapeHtmlComprovante_(p.responsavel || "—");
  var obs         = escapeHtmlComprovante_(p.obs || "");
  var dataHoje    = escapeHtmlComprovante_(p.dataHoje || "");

  var assBase64 = "";
  var assMime   = "image/jpeg";
  try {
    var ab = DriveApp.getFileById("1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe").getBlob();
    assBase64 = Utilities.base64Encode(ab.getBytes());
    assMime   = ab.getContentType() || "image/jpeg";
  } catch(e) {}

  var assTag = assBase64
    ? '<img src="data:' + assMime + ';base64,' + assBase64 + '" style="height:56px;width:auto;object-fit:contain;display:block;margin:0 auto 4px;">'
    : '';

  var watermark = isPreview
    ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:rgba(0,31,77,.04);pointer-events:none;user-select:none;white-space:nowrap;z-index:0;">PRÉVIA</div>'
    : '';

  var topPad = isPreview ? 'padding-top:0;' : '';

  return '<!DOCTYPE html><html lang="pt-BR"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Comprovante ' + numero + ' — SindEducação-ES</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">'
    + '<style>'
    + '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}'
    + 'html,body{font-family:"Plus Jakarta Sans",sans-serif;background:#f0f4f8;color:#0f172a;min-height:100%;}'
    + '.pw{display:flex;justify-content:center;padding:32px 20px 48px;}'
    + '.doc{width:100%;max-width:700px;}'
    + '@page{size:A4 portrait;margin:1.4cm;}'
    + '@media print{html,body{background:#fff!important;}.no-print{display:none!important;}.pw{padding:0;}.doc{max-width:100%;}}'
    + '</style></head><body>'
    + watermark

    // Barra de prévia
    + (isPreview
        ? '<div class="no-print" style="background:linear-gradient(135deg,#001f4d,#002f6c);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<span style="color:#fff;font-size:13px;font-weight:700;font-family:Plus Jakarta Sans,sans-serif;">Comprovante</span>'
          + '<span style="background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:.1em;">PRÉ-VISUALIZAÇÃO</span>'
          + '</div>'
          + '<button onclick="window.print()" style="height:32px;padding:0 14px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:Plus Jakarta Sans,sans-serif;">🖨 Imprimir</button>'
          + '</div>'
          + '<div class="no-print" style="max-width:700px;margin:12px auto 0;padding:0 20px;">'
          + '<div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400e;font-family:Plus Jakarta Sans,sans-serif;">'
          + '<strong style="display:block;margin-bottom:2px;">⚠️ Documento não emitido oficialmente</strong>'
          + 'Esta é apenas uma pré-visualização. Nenhum número foi gerado e nenhum dado foi gravado.'
          + '</div></div>'
        : '')

    + '<div class="pw"><div class="doc">'

    // ── Cabeçalho ──
    + '<div style="background:linear-gradient(135deg,#001f4d 0%,#002f6c 55%,#0a47a0 80%,#1565C0 100%);border-radius:18px 18px 0 0;padding:24px 28px;position:relative;overflow:hidden;">'
    + '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 85% 0%,rgba(201,168,76,.16) 0%,transparent 55%);pointer-events:none;"></div>'
    + '<div style="position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
    // Logo / nome
    + '<div style="border-left:4px solid #C9A84C;padding-left:14px;">'
    + '<div style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-.3px;line-height:1.1;">SINDEDUCAÇÃO-ES</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:4px;line-height:1.55;">Sindicato dos Educadores Técnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do ES</div>'
    + '<div style="font-size:10.5px;font-weight:900;color:#C9A84C;margin-top:6px;">CNPJ: 31.815.780/0001-51</div>'
    + '</div>'
    // Número
    + '<div style="text-align:right;flex-shrink:0;">'
    + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px;">Comprovante Nº</div>'
    + '<div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1;">' + numero + '</div>'
    + '</div>'
    + '</div></div>'

    // ── Badge categoria ──
    + '<div style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:14px 28px 0;">'
    + '<span style="display:inline-flex;align-items:center;gap:6px;background:#001f4d;color:#C9A84C;font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;">📎 ' + categoria + '</span>'
    + '</div>'

    // ── Grid de dados ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:16px 28px;">'
    + '<div style="border:1px solid #e2e8f0;border-left:4px solid #001f4d;border-radius:12px;overflow:hidden;">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e2e8f0;">'
    + '<div style="padding:14px 16px;border-right:1px solid #e2e8f0;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Data</div>'
    + '<div style="font-size:13px;font-weight:800;color:#0f172a;">' + dataHoje + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;border-right:1px solid #e2e8f0;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Valor Total</div>'
    + '<div style="font-size:13px;font-weight:800;color:#0f172a;">' + valor + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Solicitante</div>'
    + '<div style="font-size:12.5px;font-weight:700;color:#0f172a;">' + responsavel + '</div>'
    + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;background:#f8fafc;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Descrição</div>'
    + '<div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.5;">' + descricao + '</div>'
    + (obs ? '<div style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.5;">' + obs + '</div>' : '')
    + '</div>'
    + '</div></div>'

    // ── Corpo ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 28px;">'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Prezados(as) Senhores(as),</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Encaminhamos, para fins de registro e controle contábil, o comprovante referente à despesa acima identificada, devidamente registrada nos controles internos do SindEducação-ES.</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Solicitamos a confirmação do recebimento e a incorporação deste documento aos registros contábeis do período correspondente.</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;">Permanecemos à disposição para quaisquer esclarecimentos.</p>'
    + '</div>'

    // ── Assinatura ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 28px 28px;text-align:center;">'
    + '<p style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:32px;">Vitória/ES, <strong>' + dataHoje + '.</strong></p>'
    + '<div style="max-width:240px;margin:0 auto;text-align:center;">'
    + '<div style="height:64px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:6px;">' + assTag + '</div>'
    + '<div style="height:2px;background:#0f172a;width:100%;margin-bottom:8px;"></div>'
    + '<div style="font-size:13px;font-weight:900;color:#0f172a;">LEONIL DIAS DA SILVA</div>'
    + '<div style="font-size:11px;color:#475569;margin-top:3px;">Presidente — SindEducação-ES</div>'
    + '</div></div>'

    // ── Rodapé ──
    + '<div style="background:linear-gradient(135deg,#001f4d,#002f6c);border-radius:0 0 18px 18px;padding:16px 28px;">'
    + '<div style="font-size:13px;font-weight:900;color:#fff;text-align:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1);">SINDEDUCAÇÃO-ES</div>'
    + '<div style="text-align:center;font-size:11px;color:rgba(255,255,255,.65);line-height:1.7;">'
    + 'Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 — Enseada do Suá · Vitória/ES · CEP 29.050-355<br>'
    + '(27) 99735-8900 · secretaria@sindeducacao.com · sindeducacao.com.br'
    + '</div>'
    + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);text-align:center;">'
    + '<span style="font-size:10px;color:rgba(255,255,255,.3);">Documento gerado pelo SISGEP · ' + numero + '</span>'
    + '</div></div>'

    + '</div></div></body></html>';
}
/* ================= PREVIEW ================= */

function previewComprovante(dados) {
  try {
    dados = dados || {};

    var dataHoje = (typeof dataPorExtenso === "function")
      ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    var p = {
      numero:      "PRÉVIA",
      categoria:   String(dados.categoria || "").trim(),
      descricao:   String(dados.descricao || "").trim(),
      valor:       String(dados.valor || "").trim(),
      responsavel: String(dados.responsavel || "").trim(),
      obs:         String(dados.obs || "").trim(),
      dataHoje:    dataHoje
    };

    return gerarHtmlComprovanteCompleto_(p, true);

  } catch(e) {
    Logger.log("Erro em previewComprovante: " + e.message);
    return "<html><body><p>Erro: " + escapeHtmlComprovante_(e.message) + "</p></body></html>";
  }
}
/* ================= GERAR PDF ================= */

function gerarPdfComprovanteWeb(dados) {
  try {
    dados = dados || {};

    var emailUsr = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim()
      : String(Session.getActiveUser().getEmail() || "").trim();

    if (!dados.categoria) throw new Error("Categoria obrigatória.");
    if (!dados.descricao)  throw new Error("Descrição obrigatória.");

    var numero = gerarNumeroComprovante_();

    var dataHoje = (typeof dataPorExtenso === "function")
      ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    var p = {
      numero:      numero,
      categoria:   String(dados.categoria   || "").trim(),
      descricao:   String(dados.descricao   || "").trim(),
      valor:       String(dados.valor        || "").trim(),
      responsavel: String(dados.responsavel  || emailUsr).trim(),
      obs:         String(dados.obs          || "").trim(),
      dataHoje:    dataHoje
    };

    var htmlDoc  = gerarHtmlComprovanteCompleto_(p, false);
    var pastaMes = obterOuCriarPastaMesComprovantes_();

    // ✅ Nome do arquivo formatado
    var tzNome  = Session.getScriptTimeZone();
    var mesesPt = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var agora   = new Date();
    var diaStr  = Utilities.formatDate(agora, tzNome, "dd");
    var mesNum  = parseInt(Utilities.formatDate(agora, tzNome, "MM"), 10);
    var anoStr  = Utilities.formatDate(agora, tzNome, "yyyy");
    var mesAbr  = mesesPt[mesNum - 1];

    var nomeBase = sanitizarNomeArquivoComprovante_(
      diaStr + "-" + Utilities.formatDate(agora, tzNome, "MM") + "-" + anoStr
      + " " + mesAbr
      + " - Comprovante " + numero.replace("/", "-")
      + " - " + p.categoria
      + " - " + p.descricao.slice(0, 40)
      + " - " + p.responsavel.split(" ")[0]
    );

    var pdfFile = converterHtmlParaPdfComprovante_(htmlDoc, nomeBase, pastaMes);

    // ✅ Libera acesso público ao PDF
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var pdfUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";

    // ── Anexos ──
    var anexos          = salvarAnexosComprovante_(dados, pastaMes);
    var anexoOriginalId = anexos.ids;
    var anexoNome       = anexos.nomes;
    var anexoMime       = anexos.mimes;

    // ── Arquivo do Drive informado manualmente ──
    if (dados.driveFileId) {
      try {
        var arqDrive = DriveApp.getFileById(dados.driveFileId);
        anexoOriginalId = anexoOriginalId ? anexoOriginalId + "," + arqDrive.getId() : arqDrive.getId();
        anexoNome       = anexoNome       ? anexoNome       + " | " + arqDrive.getName()     : arqDrive.getName();
        anexoMime       = anexoMime       ? anexoMime       + " | " + arqDrive.getMimeType() : arqDrive.getMimeType();
      } catch(e) {}
    }

    var sh = garantirAbaComprovantes_();
    var id = "COMP-" + new Date().getTime();

    sh.appendRow([
      id,
      dados.data ? new Date(dados.data + "T12:00:00") : new Date(),
      p.categoria,
      p.descricao,
      p.valor,
      p.responsavel,
      anexoOriginalId,
      anexoNome,
      anexoMime,
      "PENDENTE",
      "",
      p.obs,
      pdfFile.getId(),
      pdfUrl,
      numero
    ]);

    var rowIndex = sh.getLastRow();

    return {
      ok:       true,
      rowIndex: rowIndex,
      numero:   numero,
      pdfId:    pdfFile.getId(),
      pdfUrl:   pdfUrl,
      mensagem: "PDF gerado com sucesso."
    };

  } catch(e) {
    Logger.log("Erro em gerarPdfComprovanteWeb: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}
/* ================= ENVIAR E-MAIL ================= */

function enviarComprovantePorEmail(payload) {
  try {
    payload = payload || {};

    var rowIndex = Number(payload.rowIndex || 0);
    if (!rowIndex || rowIndex <= 1) throw new Error("Linha do comprovante não informada.");

    var emailTo = String(payload.emailTo || EMAIL_CONTABILIDADE_TO || "").trim();
    var emailCc = String(payload.emailCc || "").trim();
    if (!emailTo) throw new Error("Informe o e-mail de destino.");

    var sh = garantirAbaComprovantes_();
    if (rowIndex > sh.getLastRow()) throw new Error("Comprovante não encontrado.");

    var row = sh.getRange(rowIndex, 1, 1, 15).getValues()[0];

    var categoria   = String(row[2]  || "").trim();
    var descricao   = String(row[3]  || "").trim();
    var valor       = String(row[4]  || "").trim();
    var solicitante = String(row[5]  || "").trim();
    var fileId      = String(row[6]  || "").trim();
    var numero      = String(row[14] || "").trim();
    var pdfId       = String(row[12] || "").trim();
    var pdfUrl      = String(row[13] || "").trim();
    var dataLanc    = row[1] ? new Date(row[1]) : new Date();

    if (!pdfId) throw new Error("PDF não encontrado para envio.");

    var tz      = Session.getScriptTimeZone();
    var meses   = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    var dataFmt = dataLanc.getDate() + " de " + meses[dataLanc.getMonth()] + " de " + dataLanc.getFullYear();
    var mesAno  = meses[dataLanc.getMonth()] + "/" + dataLanc.getFullYear();

    var saudacao = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Bom dia";

    // ── Assinante dinâmico ──────────────────────────────────────────
    var assinantes = {
      "Leonil Dias da Silva":        { cargo: "Presidente",              email: "presidencia@sindeducacao.com",  tel: "(27) 99735-8900" },
      "Marcelha Aline Pinto Gomes":  { cargo: "Administrativo/Secretaria", email: "secretaria@sindeducacao.com", tel: "(27) 99735-8900" },
      "Rogério José Erler":          { cargo: "Diretor Financeiro",       email: "financeiro@sindeducacao.com",   tel: "(27) 99813-5965" },
      "Wanderson Nascimento Castelo":{ cargo: "Financeiro/Cobrança",      email: "financeiro@sindeducacao.com",   tel: "(27) 99813-5965" }
    };
    var ass = assinantes[solicitante] || { cargo: "Equipe Administrativa", email: "secretaria@sindeducacao.com", tel: "(27) 99735-8900" };

    // ── Ícone da categoria ──────────────────────────────────────────
    var icones = {
      "Compra Avulsa":          "🛒",
      "Alvará":                 "📋",
      "Recibo Diverso":         "🧾",
      "Lote de Comprovantes":   "📦",
      "Outros":                 "📎"
    };
    var icone = icones[categoria] || "📎";

    // ── HTML do e-mail ──────────────────────────────────────────────
    var htmlEmail =
      "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;'>"

      // Cabeçalho
      + "<div style='background:linear-gradient(135deg,#001f4d,#002f6c);padding:24px 28px;border-radius:12px 12px 0 0;'>"
      + "<div style='font-size:18px;font-weight:900;color:#fff;letter-spacing:-.3px;'>SINDEDUCAÇÃO-ES</div>"
      + "<div style='font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;'>Sistema de Gestão de Processos — SISGEP</div>"
      + "<div style='margin-top:14px;display:inline-block;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:.1em;text-transform:uppercase;'>"
      + icone + " " + categoria + " · Nº " + escapeHtmlComprovante_(numero)
      + "</div>"
      + "</div>"

      // Corpo
      + "<div style='background:#fff;border:1px solid #e2e8f0;border-top:none;padding:28px;'>"

      // Saudação
      + "<p style='font-size:14px;color:#334155;margin:0 0 18px;'>"
      + escapeHtmlComprovante_(saudacao) + "! Esperamos que esteja bem.</p>"

      // Intro
      + "<p style='font-size:14px;line-height:1.8;color:#334155;margin:0 0 20px;'>"
      + "Encaminhamos em anexo o <strong>Comprovante Nº " + escapeHtmlComprovante_(numero) + "</strong>, "
      + "referente a <strong>" + escapeHtmlComprovante_(descricao) + "</strong>, "
      + "datado de <strong>" + dataFmt + "</strong>.</p>"

      // Card de dados
      + "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #001f4d;border-radius:10px;overflow:hidden;margin-bottom:24px;'>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0;'>"
      + "<div style='padding:12px 16px;border-right:1px solid #e2e8f0;'>"
      + "<div style='font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;'>Categoria</div>"
      + "<div style='font-size:13px;font-weight:800;color:#0f172a;'>" + icone + " " + escapeHtmlComprovante_(categoria) + "</div>"
      + "</div>"
      + "<div style='padding:12px 16px;'>"
      + "<div style='font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;'>Valor</div>"
      + "<div style='font-size:13px;font-weight:800;color:#0f172a;'>" + escapeHtmlComprovante_(valor || "Não informado") + "</div>"
      + "</div>"
      + "</div>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;'>"
      + "<div style='padding:12px 16px;border-right:1px solid #e2e8f0;'>"
      + "<div style='font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;'>Solicitante</div>"
      + "<div style='font-size:13px;font-weight:700;color:#0f172a;'>" + escapeHtmlComprovante_(solicitante) + "</div>"
      + "</div>"
      + "<div style='padding:12px 16px;'>"
      + "<div style='font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;'>Referência</div>"
      + "<div style='font-size:13px;font-weight:700;color:#0f172a;'>" + escapeHtmlComprovante_(mesAno) + "</div>"
      + "</div>"
      + "</div>"
      + "</div>"

      // Descrição
      + "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:24px;'>"
      + "<div style='font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;'>Descrição</div>"
      + "<div style='font-size:13px;font-weight:600;color:#1e293b;line-height:1.6;'>" + escapeHtmlComprovante_(descricao) + "</div>"
      + "</div>"

      // Botão PDF
      + "<div style='text-align:center;margin-bottom:24px;'>"
      + "<a href='" + pdfUrl + "' target='_blank' style='display:inline-block;background:linear-gradient(135deg,#001f4d,#1565C0);color:#fff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;letter-spacing:.04em;'>📄 Abrir / Baixar PDF</a>"
      + "</div>"

      // Aviso confirmação
      + "<div style='background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:12.5px;color:#92400e;line-height:1.6;'>"
      + "⚠️ <strong>Solicitamos a confirmação do recebimento</strong> respondendo a este e-mail, "
      + "para que possamos incorporar este documento aos registros contábeis do período."
      + "</div>"

      // Assinatura dinâmica
      + "<div style='border-top:1px solid #e2e8f0;padding-top:20px;'>"
      + "<div style='font-size:13px;font-weight:800;color:#0f172a;'>" + escapeHtmlComprovante_(solicitante) + "</div>"
      + "<div style='font-size:12px;color:#64748b;margin-top:2px;'>" + escapeHtmlComprovante_(ass.cargo) + " — SindEducação-ES</div>"
      + "<div style='font-size:12px;color:#64748b;margin-top:1px;'>" + escapeHtmlComprovante_(ass.tel) + " · " + escapeHtmlComprovante_(ass.email) + "</div>"
      + "</div>"
      + "</div>"

      // Rodapé
      + "<div style='background:#f1f5f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;text-align:center;'>"
      + "<div style='font-size:11px;color:#94a3b8;line-height:1.7;'>"
      + "SindEducação-ES · CNPJ 31.815.780/0001-51<br>"
      + "Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 — Enseada do Suá · Vitória/ES<br>"
      + "<span style='font-size:10px;color:#cbd5e1;'>Documento gerado automaticamente pelo SISGEP · Comprovante Nº " + escapeHtmlComprovante_(numero) + "</span>"
      + "</div>"
      + "</div>"

      + "</div>";

    // ── Anexos ──────────────────────────────────────────────────────
// ── Anexos ──────────────────────────────────────────────────────
var anexosEmail = [];

// 1. PDF gerado (comprovante oficial)
try {
  var blobPdf = DriveApp.getFileById(pdfId).getBlob();
  blobPdf.setName("Comprovante_" + numero.replace("/","-") + "_SindEducacao.pdf");
  anexosEmail.push(blobPdf);
} catch(e) {
  Logger.log("Erro ao anexar PDF: " + e.message);
}

// 2. Arquivo original (NF / comprovante enviado pelo usuário)
if (fileId) {
  fileId.split(",").forEach(function(id) {
    id = String(id || "").trim();
    if (!id) return;
    try {
      var arq = DriveApp.getFileById(id);
      var blob = arq.getBlob();
      blob.setName("NF_" + numero.replace("/","-") + "_" + arq.getName());
      anexosEmail.push(blob);
    } catch(e) {
      Logger.log("Erro ao anexar arquivo original: " + e.message);
    }
  });
}

    MailApp.sendEmail({
      to:          emailTo,
      cc:          emailCc,
      subject:     icone + " Comprovante Nº " + numero + " — " + categoria + " · " + dataFmt + " — SindEducação-ES",
      htmlBody:    htmlEmail,
      attachments: anexosEmail,
      name:        solicitante || "SindEducação-ES"
    });

    sh.getRange(rowIndex, 10).setValue("ENVIADO");
    sh.getRange(rowIndex, 11).setValue(new Date());

    return { ok: true, mensagem: "E-mail enviado com sucesso." };

  } catch(e) {
    Logger.log("Erro em enviarComprovantePorEmail: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}
/* ================= GERAR DOCUMENTO ================= */

function gerarComprovanteWeb(dados) {
  try {
    dados = dados || {};

    var emailUsr = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim()
      : String(Session.getActiveUser().getEmail() || "").trim();

    if (!dados.categoria) throw new Error("Categoria obrigatória.");
    if (!dados.descricao) throw new Error("Descrição obrigatória.");

    var numero = gerarNumeroComprovante_();

    var dataHoje = (typeof dataPorExtenso === "function")
      ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    var p = {
      numero:      numero,
      categoria:   String(dados.categoria || "").trim(),
      descricao:   String(dados.descricao || "").trim(),
      valor:       String(dados.valor || "").trim(),
      responsavel: String(dados.responsavel || emailUsr).trim(),
      obs:         String(dados.obs || "").trim(),
      dataHoje:    dataHoje
    };

    var htmlDoc  = gerarHtmlComprovanteCompleto_(p, false);
    var pastaMes = obterOuCriarPastaMesComprovantes_();

    var nomeBase = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
      + " - Comprovante " + numero.replace("/", "-")
      + " - " + p.categoria
      + " - " + p.descricao;

    nomeBase = sanitizarNomeArquivoComprovante_(nomeBase);

var pdfFile = converterHtmlParaPdfComprovante_(htmlDoc, nomeBase, pastaMes);

// ✅ Libera acesso para qualquer pessoa com o link
pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

var pdfUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";

    var anexoOriginalId = "";
    var anexoNome = "";
    var anexoMime = "";

    if (dados.arquivo && dados.arquivo.base64) {
      var blobAnexo = Utilities.newBlob(
        Utilities.base64Decode(dados.arquivo.base64),
        dados.arquivo.tipo || "application/pdf",
        dados.arquivo.nome || "comprovante_original"
      );

      var arqSalvo = pastaMes.createFile(blobAnexo);
      anexoOriginalId = arqSalvo.getId();
      anexoNome = arqSalvo.getName();
      anexoMime = arqSalvo.getMimeType();

    } else if (dados.driveFileId) {
      var arqDrive = DriveApp.getFileById(dados.driveFileId);
      var copiaDrive = arqDrive.makeCopy(nomeBase + "_original", pastaMes);

      anexoOriginalId = copiaDrive.getId();
      anexoNome = copiaDrive.getName();
      anexoMime = copiaDrive.getMimeType();
    }

    var saudacao = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Bom dia";
    var mesAnoRef = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");

    var htmlEmail =
      "<div style='font-family:Segoe UI,Arial,sans-serif;padding:30px;line-height:1.6;max-width:700px;color:#0f172a;'>"
      + "<h2 style='color:#003366;margin:0 0 6px 0;'>📎 Comprovante Nº " + escapeHtmlComprovante_(numero) + "</h2>"
      + "<p><strong>Referência:</strong> " + escapeHtmlComprovante_(mesAnoRef) + "</p>"
      + "<p>" + escapeHtmlComprovante_(saudacao) + "! Tudo bem?</p>"
      + "<p style='text-align:justify;'>Encaminhamos, em anexo, o comprovante Nº <strong>" + escapeHtmlComprovante_(numero) + "</strong> referente a <strong>" + escapeHtmlComprovante_(p.descricao) + "</strong>, categoria <strong>" + escapeHtmlComprovante_(p.categoria) + "</strong>, no valor de <strong>" + escapeHtmlComprovante_(p.valor || "não informado") + "</strong>, datado de <strong>" + escapeHtmlComprovante_(dataHoje) + "</strong>.</p>"
      + "<p style='text-align:justify;'>Solicitamos, por gentileza, a confirmação do recebimento e a incorporação deste documento aos registros contábeis do período correspondente.</p>"
      + "<p><strong>⚠️ Solicitamos a confirmação do recebimento respondendo a este e-mail.</strong></p>"
      + "<hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>"
      + "<p style='line-height:1.8;margin:0;'>"
      + "<strong>Financeiro &amp; Cobrança</strong><br>"
      + "SindEducação-ES<br>"
      + "(27) 99813-5965 | (27) 3222-2706<br>"
      + "financeiro@sindeducacao.com<br>"
      + "secretaria@sindeducacao.com"
      + "</p></div>";

    var anexosEmail = [pdfFile.getBlob()];

    if (anexoOriginalId) {
      try {
        anexosEmail.push(DriveApp.getFileById(anexoOriginalId).getBlob());
      } catch(e) {}
    }

    MailApp.sendEmail({
      to:          EMAIL_CONTABILIDADE_TO,
      cc:          EMAIL_CONTABILIDADE_CC + "," + EMAIL_COPIA_INTERNO,
      subject:     "Comprovante Nº " + numero + " — " + p.categoria + " — SindEducação-ES",
      htmlBody:    htmlEmail,
      attachments: anexosEmail,
      name:        "SindEducação-ES"
    });

    var sh = garantirAbaComprovantes_();
    var id = "COMP-" + new Date().getTime();

    sh.appendRow([
      id,
      dados.data ? new Date(dados.data + "T12:00:00") : new Date(),
      p.categoria,
      p.descricao,
      p.valor,
      p.responsavel,
      anexoOriginalId,
      anexoNome,
      anexoMime,
      "ENVIADO",
      new Date(),
      p.obs,
      pdfFile.getId(),
      pdfUrl,
      numero
    ]);

    return {
      ok: true,
      numero: numero,
      pdfUrl: pdfUrl,
      mensagem: "Comprovante gerado e enviado com sucesso."
    };

  } catch(e) {
    Logger.log("Erro em gerarComprovanteWeb: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/* ================= SALVAR RASCUNHO ================= */

/* ================= SALVAR RASCUNHO ================= */

function salvarComprovante(payload) {
  try {
    payload = payload || {};

    if (!payload.categoria) {
      return { ok: false, mensagem: "Categoria obrigatória." };
    }

    if (!payload.descricao) {
      return { ok: false, mensagem: "Descrição obrigatória." };
    }

    var sh = garantirAbaComprovantes_();
    var pastaMes = obterOuCriarPastaMesComprovantes_();

    var emailUsr = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim()
      : String(Session.getActiveUser().getEmail() || "").trim();

    /* ── ANEXOS MÚLTIPLOS ── */
    var anexos = salvarAnexosComprovante_(payload, pastaMes);

    var fileId   = anexos.ids;
    var fileNome = anexos.nomes;
    var mimeType = anexos.mimes;

    /* ── ARQUIVO DO DRIVE INFORMADO MANUALMENTE ── */
    if (payload.driveFileId) {
      try {
        var driveArq = DriveApp.getFileById(payload.driveFileId);

        fileId = fileId
          ? fileId + "," + driveArq.getId()
          : driveArq.getId();

        fileNome = fileNome
          ? fileNome + " | " + driveArq.getName()
          : driveArq.getName();

        mimeType = mimeType
          ? mimeType + " | " + driveArq.getMimeType()
          : driveArq.getMimeType();

      } catch(e) {}
    }

    var data = payload.data
      ? new Date(payload.data + "T12:00:00")
      : new Date();

    if (payload.rowIndex && Number(payload.rowIndex) > 1) {
      var rowIndex = Number(payload.rowIndex);

      if (rowIndex > sh.getLastRow()) {
        return { ok: false, mensagem: "Linha informada não existe." };
      }

      var rowAtual = sh.getRange(rowIndex, 1, 1, 15).getValues()[0];

      sh.getRange(rowIndex, 1, 1, 15).setValues([[
        rowAtual[0],
        data,
        payload.categoria,
        payload.descricao,
        payload.valor || "",
        payload.responsavel || emailUsr,
        fileId || rowAtual[6],
        fileNome || rowAtual[7],
        mimeType || rowAtual[8],
        rowAtual[9] || "PENDENTE",
        rowAtual[10] || "",
        payload.obs || "",
        rowAtual[12] || "",
        rowAtual[13] || "",
        rowAtual[14] || ""
      ]]);

      return {
        ok: true,
        mensagem: "Comprovante atualizado com sucesso."
      };
    }

    var id = "COMP-" + new Date().getTime();

    sh.appendRow([
      id,
      data,
      payload.categoria,
      payload.descricao,
      payload.valor || "",
      payload.responsavel || emailUsr,
      fileId,
      fileNome,
      mimeType,
      "PENDENTE",
      "",
      payload.obs || "",
      "",
      "",
      ""
    ]);

    return {
      ok: true,
      mensagem: "Comprovante salvo com sucesso.",
      id: id
    };

  } catch(e) {
    return {
      ok: false,
      mensagem: e.message
    };
  }
}
/* ================= EXCLUIR ================= */

function excluirComprovante(rowIndex) {
  try {
    rowIndex = Number(rowIndex);

    if (!rowIndex || rowIndex <= 1) {
      return { ok: false, mensagem: "Linha inválida para exclusão." };
    }

    var sh = garantirAbaComprovantes_();

    if (rowIndex > sh.getLastRow()) {
      return { ok: false, mensagem: "Linha não encontrada." };
    }

    sh.deleteRow(rowIndex);

    return { ok: true, mensagem: "Comprovante removido." };

  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ================= MÉTRICAS ================= */

function obterMetricasComprovantes() {
  try {
    var sh = garantirAbaComprovantes_();

    if (sh.getLastRow() < 2) {
      return { ok: true, total: 0, pendentes: 0, enviados: 0 };
    }

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();

    var total = 0;
    var pendentes = 0;
    var enviados = 0;

    dados.forEach(function(row) {
      if (!String(row[0] || "").trim()) return;

      total++;

      var st = String(row[9] || "PENDENTE").trim().toUpperCase();

      if (st === "PENDENTE") pendentes++;
      if (st === "ENVIADO") enviados++;
    });

    return {
      ok: true,
      total: total,
      pendentes: pendentes,
      enviados: enviados
    };

  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}
/* ================= CONFIGURAÇÕES GLOBAIS DE FALLBACK ================= */
/* Garante que variáveis do SISGEP existam (caso não estejam definidas globalmente) */

if (typeof PLANILHA_ID === 'undefined') {
  /** @type {string} */
  var PLANILHA_ID = (typeof getPlanilhaId === 'function')
    ? getPlanilhaId()
    : (PropertiesService.getScriptProperties().getProperty("PLANILHA_ID") || "");

  if (!PLANILHA_ID) {
    try {
      var ssAtivaComprovantes = SpreadsheetApp.getActiveSpreadsheet();
      PLANILHA_ID = ssAtivaComprovantes ? ssAtivaComprovantes.getId() : "";
    } catch (e) {}
  }

  if (!PLANILHA_ID) {
    throw new Error("PLANILHA_ID não configurado. Defina a propriedade de script PLANILHA_ID ou publique junto o arquivo SistemaConfig.js.");
  }
}

/* Fallback para funções auxiliares que podem estar em Code.gs */
if (typeof dataPorExtenso !== 'function') {
  function dataPorExtenso() {
    var d = new Date();
    var dias = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
    var meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    return dias[d.getDay()] + ", " + d.getDate() + " de " + meses[d.getMonth()] + " de " + d.getFullYear();
  }
}

if (typeof obterEmailUsuarioAtual_ !== 'function') {
  function obterEmailUsuarioAtual_() {
    return Session.getActiveUser().getEmail();
  }
}

if (typeof saudacaoHoraBR_ !== 'function') {
  function saudacaoHoraBR_() {
    var h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }
}

/* ================= FUNÇÃO DE ENTRADA DO MÓDULO ================= */
/**
 * Serve a interface HTML do módulo de Comprovantes
 * Esta função é chamada pelo menu do SISGEP ou via URL do Web App
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function incluirComprovantes() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Comprovantes - SISGEP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/* ================= FUNÇÃO PARA MENU DO SISGEP ================= */
/**
 * Adiciona item "Comprovantes" ao menu da planilha
 * Chame esta função dentro do onOpen() do Code.gs principal
 * @param {GoogleAppsScript.Base.Ui} ui - Interface do SpreadsheetApp
 */
function adicionarMenuComprovantes(ui) {
  if (ui && typeof ui.addItem === 'function') {
    ui.addItem('📎 Comprovantes', 'incluirComprovantes');
  }
}

/* ================= FUNÇÃO DE TESTE RÁPIDO ================= */
/**
 * Teste de conexão do módulo - execute manualmente no editor para validar
 * @return {Object} Status da conexão
 */
function testarModuloComprovantes() {
  try {
    return {
      ok: true,
      mensagem: "✅ Módulo Comprovantes respondendo!",
      planilhaId: PLANILHA_ID,
      pastaComprovantes: PASTA_COMPROVANTES_ID,
      dataTeste: new Date().toISOString(),
      timezone: Session.getScriptTimeZone()
    };
  } catch(e) {
    return {
      ok: false,
      mensagem: "❌ Erro: " + e.message
    };
  }
}
// ================================================================
// 📄 ADIÇÃO AO ARQUIVO: Comprovantes.gs
// Funções do Lote de Comprovantes
// Adicione estas funções ao final do Comprovantes.gs existente
// ================================================================

/* ──────────────────────────────────────────────────────────────
   HTML DO LOTE — gera o documento visual completo
   p = { numero, descricao, valor, responsavel, obs, dataHoje, itens[] }
   itens = [{ data, categoria, descricao, valor }]
────────────────────────────────────────────────────────────── */
function gerarHtmlLoteCompleto_(p, isPreview) {
  p = p || {};

  var numero      = escapeHtmlComprovante_(p.numero      || "PRÉVIA");
  var descricao   = escapeHtmlComprovante_(p.descricao   || "—");
  var valor       = escapeHtmlComprovante_(p.valor       || "—");
  var responsavel = escapeHtmlComprovante_(p.responsavel || "—");
  var obs         = escapeHtmlComprovante_(p.obs         || "");
  var dataHoje    = escapeHtmlComprovante_(p.dataHoje    || "");
  var itens       = p.itens || [];

  // Assinatura (mesma lógica do individual)
  var assBase64 = "";
  var assMime   = "image/jpeg";
  try {
    var ab = DriveApp.getFileById("1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe").getBlob();
    assBase64 = Utilities.base64Encode(ab.getBytes());
    assMime   = ab.getContentType() || "image/jpeg";
  } catch(e) {}

  var assTag = assBase64
    ? '<img src="data:' + assMime + ';base64,' + assBase64 + '" style="height:56px;width:auto;object-fit:contain;display:block;margin:0 auto 4px;">'
    : '';

  var watermark = isPreview
    ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:rgba(0,31,77,.04);pointer-events:none;user-select:none;white-space:nowrap;z-index:0;">PRÉVIA</div>'
    : '';

  // Linhas da tabela de itens
  var htmlItens = "";
  var totalSoma = 0;
  itens.forEach(function(item, idx) {
    var dataItem = escapeHtmlComprovante_(String(item.data || "").replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2/$1"));
    var cat      = escapeHtmlComprovante_(item.categoria || "—");
    var desc     = escapeHtmlComprovante_(item.descricao || "—");
    var val      = escapeHtmlComprovante_(item.valor || "—");

    // soma numérica
    var numVal = parseFloat(
      String(item.valor || "0")
        .replace(/R\$\s?/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );
    if (!isNaN(numVal)) totalSoma += numVal;

    var bgRow = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    htmlItens +=
      '<tr style="background:' + bgRow + ';">'
      + '<td style="padding:9px 12px;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;text-align:center;">'
      + String(idx + 1).padStart(2, "0")
      + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;">' + dataItem + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;">' + cat + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;color:#1e293b;font-weight:600;border-bottom:1px solid #e2e8f0;">' + desc + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;font-weight:800;color:#001f4d;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">' + val + '</td>'
      + '</tr>';
  });

  // Linha de total calculado
  var totalFmt = totalSoma.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return '<!DOCTYPE html><html lang="pt-BR"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Lote de Comprovantes ' + numero + ' — SindEducação-ES</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">'
    + '<style>'
    + '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}'
    + 'html,body{font-family:"Plus Jakarta Sans",sans-serif;background:#f0f4f8;color:#0f172a;min-height:100%;}'
    + '.pw{display:flex;justify-content:center;padding:32px 20px 48px;}'
    + '.doc{width:100%;max-width:700px;}'
    + '@page{size:A4 portrait;margin:1.4cm;}'
    + '@media print{html,body{background:#fff!important;}.no-print{display:none!important;}.pw{padding:0;}.doc{max-width:100%;}}'
    + '</style></head><body>'
    + watermark

    // Barra de prévia (igual ao individual)
    + (isPreview
        ? '<div class="no-print" style="background:linear-gradient(135deg,#001f4d,#002f6c);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<span style="color:#fff;font-size:13px;font-weight:700;font-family:Plus Jakarta Sans,sans-serif;">Lote de Comprovantes</span>'
          + '<span style="background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:.1em;">PRÉ-VISUALIZAÇÃO</span>'
          + '</div>'
          + '<button onclick="window.print()" style="height:32px;padding:0 14px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:Plus Jakarta Sans,sans-serif;">🖨 Imprimir</button>'
          + '</div>'
          + '<div class="no-print" style="max-width:700px;margin:12px auto 0;padding:0 20px;">'
          + '<div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400e;font-family:Plus Jakarta Sans,sans-serif;">'
          + '<strong style="display:block;margin-bottom:2px;">⚠️ Documento não emitido oficialmente</strong>'
          + 'Esta é apenas uma pré-visualização. Nenhum número foi gerado e nenhum dado foi gravado.'
          + '</div></div>'
        : '')

    + '<div class="pw"><div class="doc">'

    // ── Cabeçalho (idêntico ao individual) ──
    + '<div style="background:linear-gradient(135deg,#001f4d 0%,#002f6c 55%,#0a47a0 80%,#1565C0 100%);border-radius:18px 18px 0 0;padding:24px 28px;position:relative;overflow:hidden;">'
    + '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 85% 0%,rgba(201,168,76,.16) 0%,transparent 55%);pointer-events:none;"></div>'
    + '<div style="position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
    + '<div style="border-left:4px solid #C9A84C;padding-left:14px;">'
    + '<div style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-.3px;line-height:1.1;">SINDEDUCAÇÃO-ES</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:4px;line-height:1.55;">Sindicato dos Educadores Técnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do ES</div>'
    + '<div style="font-size:10.5px;font-weight:900;color:#C9A84C;margin-top:6px;">CNPJ: 31.815.780/0001-51</div>'
    + '</div>'
    + '<div style="text-align:right;flex-shrink:0;">'
    + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px;">Lote de Comprovantes Nº</div>'
    + '<div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1;">' + numero + '</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:4px;">' + itens.length + ' item(ns)</div>'
    + '</div>'
    + '</div></div>'

    // ── Badge ──
    + '<div style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:14px 28px 0;">'
    + '<span style="display:inline-flex;align-items:center;gap:6px;background:#001f4d;color:#C9A84C;font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;">📦 Lote de Comprovantes</span>'
    + '</div>'

    // ── Grid de dados ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:16px 28px;">'
    + '<div style="border:1px solid #e2e8f0;border-left:4px solid #001f4d;border-radius:12px;overflow:hidden;">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e2e8f0;">'
    + '<div style="padding:14px 16px;border-right:1px solid #e2e8f0;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Data</div>'
    + '<div style="font-size:13px;font-weight:800;color:#0f172a;">' + dataHoje + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;border-right:1px solid #e2e8f0;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Valor Total</div>'
    + '<div style="font-size:13px;font-weight:800;color:#0f172a;">' + valor + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Solicitante</div>'
    + '<div style="font-size:12.5px;font-weight:700;color:#0f172a;">' + responsavel + '</div>'
    + '</div>'
    + '</div>'
    + '<div style="padding:14px 16px;background:#f8fafc;">'
    + '<div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Descrição do Lote</div>'
    + '<div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.5;">' + descricao + '</div>'
    + (obs ? '<div style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.5;">' + obs + '</div>' : '')
    + '</div>'
    + '</div></div>'

    // ── Tabela de itens ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:16px 28px;">'
    + '<div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Comprovantes / NFs incluídos no lote</div>'
    + '<table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">'
    + '<thead>'
    + '<tr style="background:linear-gradient(135deg,#001f4d,#002f6c);">'
    + '<th style="padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;text-align:center;width:36px;">#</th>'
    + '<th style="padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;text-align:left;">Data</th>'
    + '<th style="padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;text-align:left;">Categoria</th>'
    + '<th style="padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;text-align:left;">Descrição</th>'
    + '<th style="padding:10px 12px;font-size:10px;font-weight:800;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;text-align:right;">Valor</th>'
    + '</tr>'
    + '</thead>'
    + '<tbody>' + htmlItens + '</tbody>'
    + '<tfoot>'
    + '<tr style="background:#f0f4f8;">'
    + '<td colspan="4" style="padding:12px 16px;font-size:12px;font-weight:900;color:#001f4d;text-align:right;text-transform:uppercase;letter-spacing:.08em;border-top:2px solid #001f4d;">Total do Lote</td>'
    + '<td style="padding:12px 16px;font-size:15px;font-weight:900;color:#001f4d;text-align:right;border-top:2px solid #001f4d;white-space:nowrap;">' + escapeHtmlComprovante_(totalFmt) + '</td>'
    + '</tr>'
    + '</tfoot>'
    + '</table>'
    + '</div>'

    // ── Corpo (mesmo texto do individual) ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 28px;">'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Prezados(as) Senhores(as),</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Encaminhamos, para fins de registro e controle contábil, o presente lote de comprovantes referente às despesas acima identificadas, devidamente registradas nos controles internos do SindEducação-ES.</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;margin-bottom:12px;">Solicitamos a confirmação do recebimento e a incorporação deste documento aos registros contábeis do período correspondente.</p>'
    + '<p style="font-size:13px;line-height:1.85;color:#1e293b;">Permanecemos à disposição para quaisquer esclarecimentos.</p>'
    + '</div>'

    // ── Assinatura (idêntica ao individual) ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 28px 28px;text-align:center;">'
    + '<p style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:32px;">Vitória/ES, <strong>' + dataHoje + '.</strong></p>'
    + '<div style="max-width:240px;margin:0 auto;text-align:center;">'
    + '<div style="height:64px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:6px;">' + assTag + '</div>'
    + '<div style="height:2px;background:#0f172a;width:100%;margin-bottom:8px;"></div>'
    + '<div style="font-size:13px;font-weight:900;color:#0f172a;">LEONIL DIAS DA SILVA</div>'
    + '<div style="font-size:11px;color:#475569;margin-top:3px;">Presidente — SindEducação-ES</div>'
    + '</div></div>'

    // ── Rodapé (idêntico ao individual) ──
    + '<div style="background:linear-gradient(135deg,#001f4d,#002f6c);border-radius:0 0 18px 18px;padding:16px 28px;">'
    + '<div style="font-size:13px;font-weight:900;color:#fff;text-align:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1);">SINDEDUCAÇÃO-ES</div>'
    + '<div style="text-align:center;font-size:11px;color:rgba(255,255,255,.65);line-height:1.7;">'
    + 'Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 — Enseada do Suá · Vitória/ES · CEP 29.050-355<br>'
    + '(27) 99735-8900 · secretaria@sindeducacao.com · sindeducacao.com.br'
    + '</div>'
    + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);text-align:center;">'
    + '<span style="font-size:10px;color:rgba(255,255,255,.3);">Documento gerado pelo SISGEP · Lote ' + numero + ' · ' + itens.length + ' item(ns)</span>'
    + '</div></div>'

    + '</div></div></body></html>';
}

/* ──────────────────────────────────────────────────────────────
   PREVIEW DO LOTE
────────────────────────────────────────────────────────────── */
function previewLoteComprovantes(dados) {
  try {
    dados = dados || {};

    var dataHoje = (typeof dataPorExtenso === "function")
      ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    var p = {
      numero:      "PRÉVIA",
      descricao:   String(dados.descricao   || "").trim(),
      valor:       String(dados.valor        || "").trim(),
      responsavel: String(dados.responsavel  || "").trim(),
      obs:         String(dados.obs          || "").trim(),
      dataHoje:    dataHoje,
      itens:       dados.itens || []
    };

    return gerarHtmlLoteCompleto_(p, true);

  } catch(e) {
    Logger.log("Erro em previewLoteComprovantes: " + e.message);
    return "<html><body><p>Erro: " + escapeHtmlComprovante_(e.message) + "</p></body></html>";
  }
}

/* ──────────────────────────────────────────────────────────────
   GERAR PDF DO LOTE
   Mesma lógica do gerarPdfComprovanteWeb, adaptada para lote
────────────────────────────────────────────────────────────── */
function gerarPdfLoteComprovantes(dados) {
  try {
    dados = dados || {};

    var emailUsr = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim()
      : String(Session.getActiveUser().getEmail() || "").trim();

    if (!dados.descricao)           throw new Error("Descrição do lote obrigatória.");
    if (!dados.itens || !dados.itens.length) throw new Error("Adicione ao menos um item ao lote.");

    var numero = gerarNumeroComprovante_();

    var dataHoje = (typeof dataPorExtenso === "function")
      ? dataPorExtenso()
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    // Recalcula total no backend para garantir consistência
    var totalSoma = 0;
    dados.itens.forEach(function(item) {
      var n = parseFloat(
        String(item.valor || "0")
          .replace(/R\$\s?/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
      );
      if (!isNaN(n)) totalSoma += n;
    });
    var totalFmt = totalSoma.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    var p = {
      numero:      numero,
      categoria:   "Lote de Comprovantes",
      descricao:   String(dados.descricao   || "").trim(),
      valor:       totalFmt,
      responsavel: String(dados.responsavel || emailUsr).trim(),
      obs:         String(dados.obs          || "").trim(),
      dataHoje:    dataHoje,
      itens:       dados.itens
    };

    var htmlDoc  = gerarHtmlLoteCompleto_(p, false);
    var pastaMes = obterOuCriarPastaMesComprovantes_();

    // Nome do arquivo
    var tz      = Session.getScriptTimeZone();
    var mesesPt = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var agora   = new Date();
    var diaStr  = Utilities.formatDate(agora, tz, "dd");
    var mesNum  = parseInt(Utilities.formatDate(agora, tz, "MM"), 10);
    var anoStr  = Utilities.formatDate(agora, tz, "yyyy");
    var mesAbr  = mesesPt[mesNum - 1];

    var nomeBase = sanitizarNomeArquivoComprovante_(
      diaStr + "-" + Utilities.formatDate(agora, tz, "MM") + "-" + anoStr
      + " " + mesAbr
      + " - Lote " + numero.replace("/", "-")
      + " - " + p.descricao.slice(0, 40)
      + " - " + p.responsavel.split(" ")[0]
      + " (" + dados.itens.length + " itens)"
    );

    var pdfFile = converterHtmlParaPdfComprovante_(htmlDoc, nomeBase, pastaMes);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var pdfUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";

    // ── Salva arquivos individuais dos itens e registra na aba COMPROVANTES_ITENS ──
    var ss        = SpreadsheetApp.openById(PLANILHA_ID);
    var shItens   = ss.getSheetByName("COMPROVANTES_ITENS");
    var loteId    = "LOTE-" + new Date().getTime();
    var idsAnexos = [];

    dados.itens.forEach(function(item, idx) {
      var arquivoId   = "";
      var arquivoNome = "";
      var mimeType    = "";

      // Salva o arquivo do item se existir
      if (item.arquivo && item.arquivo.base64) {
        try {
          var blobItem = Utilities.newBlob(
            Utilities.base64Decode(item.arquivo.base64),
            item.arquivo.tipo || "application/octet-stream",
            item.arquivo.nome || "anexo_item_" + (idx + 1)
          );
          var nomeItemArq = sanitizarNomeArquivoComprovante_(
            diaStr + "-" + Utilities.formatDate(agora, tz, "MM") + "-" + anoStr
            + " - Lote " + numero.replace("/", "-")
            + " - Item " + String(idx + 1).padStart(2, "0")
            + " - " + String(item.categoria || "").slice(0, 20)
            + " - " + String(item.descricao || "").slice(0, 30)
          );
          blobItem.setName(nomeItemArq);
          var arqSalvo = pastaMes.createFile(blobItem);
          arqSalvo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          arquivoId   = arqSalvo.getId();
          arquivoNome = arqSalvo.getName();
          mimeType    = arqSalvo.getMimeType();
          idsAnexos.push(arquivoId);
        } catch(e) {
          Logger.log("Erro ao salvar arquivo do item " + (idx+1) + ": " + e.message);
        }
      }

      // Registra na aba COMPROVANTES_ITENS
      if (shItens) {
        shItens.appendRow([
          loteId,
          numero,
          idx + 1,
          item.data ? new Date(item.data + "T12:00:00") : new Date(),
          item.categoria   || "",
          item.descricao   || "",
          item.valor       || "",
          arquivoId,
          arquivoNome,
          mimeType,
          "PENDENTE",
          "",
          ""
        ]);
      }
    });

    // ── Registra o lote na aba COMPROVANTES (cabeçalho) ──
    var sh = garantirAbaComprovantes_();
    var id = loteId;

    sh.appendRow([
      id,
      dados.data ? new Date(dados.data + "T12:00:00") : new Date(),
      p.categoria,
      p.descricao,
      p.valor,
      p.responsavel,
      idsAnexos.join(","),                  // FILE_ID: todos os anexos dos itens
      dados.itens.length + " arquivo(s)",   // FILE_NOME
      "mixed",                               // MIME_TYPE
      "PENDENTE",
      "",
      p.obs,
      pdfFile.getId(),
      pdfUrl,
      numero
    ]);

    var rowIndex = sh.getLastRow();

    return {
      ok:       true,
      rowIndex: rowIndex,
      numero:   numero,
      pdfId:    pdfFile.getId(),
      pdfUrl:   pdfUrl,
      valor:    p.valor,
      itens:    dados.itens.length,
      mensagem: "Lote gerado com sucesso. " + dados.itens.length + " item(ns) registrado(s)."
    };

  } catch(e) {
    Logger.log("Erro em gerarPdfLoteComprovantes: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/* ──────────────────────────────────────────────────────────────
   ENVIAR E-MAIL DO LOTE
   Reutiliza enviarComprovantePorEmail do individual — a função
   já funciona para lotes porque lê da mesma aba COMPROVANTES.
   Esta função complementar envia com identificação de lote.
────────────────────────────────────────────────────────────── */
function enviarEmailLoteComprovantes(payload) {
  // Delega diretamente para a função existente do individual.
  // O e-mail gerado já menciona categoria "Lote de Comprovantes"
  // e o HTML diferencia automaticamente pelo ícone 📦.
  return enviarComprovantePorEmail(payload);
}
