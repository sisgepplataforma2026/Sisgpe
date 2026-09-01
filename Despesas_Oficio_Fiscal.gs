// =============================================================================
// ARQUIVO: Despesas_Oficio_Fiscal.gs
// ADICIONAR ao projeto SISGEP — Módulo Despesas
// =============================================================================

/* ─────────────────────────────────────────────────────────────
   HELPER: Numeração segura — mesma sequência e mesmo lock dos demais ofícios
   (Oficios.gs / gerarProximoNumeroSeguro_). Antes esta função lia só a última
   linha não vazia da coluna B da aba Controle, o que podia colidir com um
   número já usado se essa linha não fosse a de maior número (reordenação,
   exclusão manual fora de ordem). Agora reaproveita a mesma função que já
   varre todas as linhas do ano e usa lock — mantém o nome e a assinatura
   para não exigir mudança no chamador (linha ~479 deste arquivo).
   ───────────────────────────────────────────────────────────── */
function gerarProximoNumeroOficioFiscal_() {
  return gerarProximoNumeroSeguro_();
}

/* ─────────────────────────────────────────────────────────────
   HELPER: Registra o ofício fiscal na aba Controle
   ───────────────────────────────────────────────────────────── */
function registrarOficioFiscalNoControle_(params) {
  try {
    params = params || {};
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName("Controle");
    if (!aba) { Logger.log("⚠ Aba Controle não encontrada."); return; }

    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });

    var novaLinha = new Array(headers.length).fill("");

    function set(nomeCol, valor) {
      var c = headers.indexOf(nomeCol);
      if (c > -1) novaLinha[c] = valor || "";
    }

    var fornecedores = Array.isArray(params.fornecedores) ? params.fornecedores : [];
    var nomesForn    = fornecedores.length ? fornecedores.join(", ") : "Documentação Fiscal";
    var emailsStr    = params.emails     || "";
    var dataHoje     = params.dataHoje   || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    set("Número do Ofício",    params.numero     || "");
    set("CONFIG",              "DESPESAS");
    set("Log_Sistema",         "SISGEP · Módulo Despesas · Envio à Contabilidade");
    set("Sistema_Versão",      "2.1.0000");
    set("Data envio ofício",   dataHoje);
    set("TIPO",                "Despesas");
    set("Escola (Razão Social)", nomesForn);
    set("E-mail (principal)",  emailsStr.split(",")[0] || "");
    set("E-mails (todos)",     emailsStr);
    set("Observações",         params.observacoes || ("Documentação fiscal encaminhada à contabilidade. Fornecedores: " + nomesForn));
    set("Link PDF (Drive)",    params.linkOficio  || "");

    aba.appendRow(novaLinha);
    Logger.log("✅ Ofício fiscal registrado no Controle: " + params.numero);

  } catch(e) {
    Logger.log("⚠ registrarOficioFiscalNoControle_: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: Monta descrição inteligente por fornecedores
   ───────────────────────────────────────────────────────────── */
function montarDescricaoOficioFiscal_(fornecedores) {
  fornecedores = Array.isArray(fornecedores) ? fornecedores.filter(Boolean) : [];
  if (!fornecedores.length) return "Documentação fiscal referente às despesas encaminhadas para processamento contábil.";

  var unicos = [];
  fornecedores.forEach(function(n) {
    n = String(n || "").trim();
    if (n && unicos.indexOf(n) === -1) unicos.push(n);
  });

  var nomes;
  if (unicos.length === 1) {
    nomes = "às despesas de " + unicos[0] + ".";
  } else if (unicos.length === 2) {
    nomes = "às despesas de " + unicos[0] + " e " + unicos[1] + ".";
  } else if (unicos.length === 3) {
    nomes = "às despesas de " + unicos[0] + ", " + unicos[1] + " e " + unicos[2] + ".";
  } else if (unicos.length <= 5) {
    var ult = unicos.pop();
    nomes = "às despesas de " + unicos.join(", ") + " e " + ult + ".";
  } else {
    nomes = "às despesas de " + unicos[0] + ", " + unicos[1] + ", " + unicos[2] + " e outros " + (unicos.length - 3) + " fornecedores.";
  }

  return "Documentação fiscal referente " + nomes;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: Nome do arquivo do ofício fiscal
   ───────────────────────────────────────────────────────────── */
function montarNomeArquivoOficioFiscal_(numero, fornecedores) {
  fornecedores = Array.isArray(fornecedores) ? fornecedores.filter(Boolean) : [];

  function limpar(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  }

  var mesAno = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM yyyy");
  mesAno = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

  var nomesForn;
  if (!fornecedores.length) {
    nomesForn = "Lote";
  } else if (fornecedores.length === 1) {
    nomesForn = limpar(fornecedores[0]);
  } else if (fornecedores.length <= 3) {
    nomesForn = fornecedores.map(limpar).join(" + ");
  } else {
    nomesForn = fornecedores.slice(0, 3).map(limpar).join(" + ") + " e outros " + (fornecedores.length - 3);
  }

  return "Documentacao Fiscal - " + nomesForn + " - " + mesAno;
}

/* ─────────────────────────────────────────────────────────────
   HTML COMPLETO DO OFÍCIO DE DOCUMENTAÇÃO FISCAL
   isPreview: true  → marca d'água PRÉVIA + aviso
   isPreview: false → documento oficial numerado
   ───────────────────────────────────────────────────────────── */
function gerarHtmlOficioDocumentacaoFiscal_(params, isPreview) {
  params = params || {};

  var assBase64 = "";
  var assMime   = "image/jpeg";
  try {
    var ab    = DriveApp.getFileById("1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe").getBlob();
    assBase64 = Utilities.base64Encode(ab.getBytes());
    assMime   = ab.getContentType() || "image/jpeg";
  } catch(e) { Logger.log("⚠ Assinatura não carregada: " + e.message); }

  var assTag = assBase64
    ? '<img src="data:' + assMime + ';base64,' + assBase64 + '" style="height:52px;width:auto;object-fit:contain;display:block;margin:0 auto 2px;">'
    : '';

  function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  var numero       = isPreview ? "PRÉVIA" : esc(params.numero || "PRÉVIA");
  var dataHoje     = params.dataHoje   || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  var despesas     = Array.isArray(params.despesas)     ? params.despesas     : [];
  var anexos       = Array.isArray(params.anexos)       ? params.anexos       : [];
  var fornecedores = Array.isArray(params.fornecedores) ? params.fornecedores : [];
  var descricao    = params.descricao  || montarDescricaoOficioFiscal_(fornecedores);
  var totalValor   = typeof params.totalValor === "string" ? params.totalValor : ("R$ " + Number(params.totalValorNum || 0).toFixed(2).replace(".", ","));
  var lote         = params.lote || "";

  var watermark = isPreview
    ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(0,31,77,.025);pointer-events:none;user-select:none;white-space:nowrap;z-index:0;">PRÉVIA</div>'
    : '';

  var actionBar = isPreview
    ? '<div class="no-print" style="position:fixed;top:0;left:0;right:0;height:56px;background:#001f4d;display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.3);">'
      + '<div style="display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;font-weight:700;">📄 Ofício Documentação Fiscal<span style="background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">PRÉ-VISUALIZAÇÃO</span></div>'
      + '<div style="display:flex;gap:10px;"><button onclick="window.print()" style="height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">🖨 Imprimir</button></div></div>'
    : '';

  var aviso = isPreview
    ? '<div class="no-print" style="max-width:780px;margin:0 auto 16px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12.5px;color:#92400e;line-height:1.5;">'
      + '<span style="font-size:18px;flex-shrink:0;">⚠️</span>'
      + '<div><strong style="display:block;font-size:13px;color:#78350f;margin-bottom:2px;">Documento não emitido oficialmente</strong>'
      + 'Esta é apenas uma pré-visualização. Nenhum número foi gerado e nenhum dado foi gravado.</div></div>'
    : '';

  var topPad = isPreview ? '76px 24px 48px' : '0';

  var linhasDespesas = despesas.map(function(d, i) {
    var bg = i % 2 === 0 ? "#f8fafc" : "#ffffff";
    return '<tr style="background:' + bg + ';border-bottom:1px solid #f1f5f9;">'
      + '<td style="padding:9px 12px;font-weight:700;font-size:12px;white-space:nowrap;">' + esc(d.numero || (i+1).toString()) + '</td>'
      + '<td style="padding:9px 12px;font-size:13px;font-weight:600;color:#0f172a;">' + esc(d.nome || "") + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;color:#475569;">' + esc(d.categoria || "") + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;color:#475569;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(d.descricao || "") + '">' + esc(d.descricao || "") + '</td>'
      + '<td style="padding:9px 12px;font-weight:700;font-size:12.5px;white-space:nowrap;">' + esc(d.valor || "—") + '</td>'
      + '<td style="padding:9px 12px;font-size:12px;white-space:nowrap;color:#475569;">' + esc(d.vencimento || "—") + '</td>'
      + '</tr>';
  }).join("");

  var linhasAnexos = "";
  if (anexos.length) {
    linhasAnexos = anexos.map(function(a, i) {
      return '<tr style="background:' + (i % 2 === 0 ? "#f8fafc" : "#fff") + ';border-bottom:1px solid #f1f5f9;">'
        + '<td style="padding:8px 12px;font-size:12px;font-weight:700;color:#001f4d;">📄 ' + esc(a.nome || "") + '</td>'
        + '<td style="padding:8px 12px;font-size:11.5px;color:#64748b;">' + esc(a.tipo || "") + '</td>'
        + '<td style="padding:8px 12px;font-size:11.5px;color:#64748b;">' + esc(a.fornecedor || "") + '</td>'
        + '</tr>';
    }).join("");
  }

  var blocoAnexos = "";
  if (linhasAnexos) {
    blocoAnexos = '<div style="margin:0 28px 20px;">'
      + '<div style="background:linear-gradient(135deg,#001f4d,#002f6c);padding:10px 14px;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;">'
      + '<span style="font-size:14px;">📎</span>'
      + '<span style="font-size:11px;font-weight:900;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.08em;">Documentos Anexados</span>'
      + '<span style="margin-left:auto;background:#C9A84C;color:#001f4d;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">' + anexos.length + '</span>'
      + '</div>'
      + '<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr style="background:#f1f5f9;">'
      + '<th style="padding:8px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;">Documento</th>'
      + '<th style="padding:8px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;">Tipo</th>'
      + '<th style="padding:8px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;">Fornecedor</th>'
      + '</tr></thead>'
      + '<tbody>' + linhasAnexos + '</tbody>'
      + '</table></div></div>';
  }

  var refLote = lote ? '<div style="font-size:10.5px;color:#94a3b8;margin-top:4px;">Lote: ' + esc(lote) + '</div>' : '';

  var resumoCards = '<div style="margin:14px 28px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">'
    + '<div style="background:#f0f4f8;border-radius:10px;padding:12px 14px;text-align:center;">'
    + '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Documentos</div>'
    + '<div style="font-size:22px;font-weight:900;color:#001f4d;">' + despesas.length + '</div></div>'
    + '<div style="background:#f0f4f8;border-radius:10px;padding:12px 14px;text-align:center;">'
    + '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Fornecedores</div>'
    + '<div style="font-size:22px;font-weight:900;color:#001f4d;">' + (function(){var u=[];fornecedores.forEach(function(f){if(f&&u.indexOf(f)===-1)u.push(f);});return u.length;}()) + '</div></div>'
    + '<div style="background:#f0f4f8;border-radius:10px;padding:12px 14px;text-align:center;">'
    + '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Valor Total</div>'
    + '<div style="font-size:16px;font-weight:900;color:#C9A84C;">' + esc(totalValor) + '</div></div>'
    + '</div>';

  var textoOficio = "Prezados(as) Senhores(as),\n\n"
    + "O SindEducação/ES — Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos de Ensino Particular "
    + "no Estado do Espírito Santo — encaminha, para fins de conferência, registro e processamento contábil, "
    + descricao.replace(/\.$/, "") + " devidamente registradas nos controles internos desta entidade.\n\n"
    + "Solicitamos a conferência dos documentos relacionados e sua incorporação aos registros contábeis do período correspondente.\n\n"
    + "Permanecemos à disposição para quaisquer esclarecimentos que se façam necessários.\n\nAtenciosamente,";

  var paragrafos = textoOficio.replace(/\r/g,"").replace(/\n{3,}/g,"\n\n").trim().split(/\n\s*\n/);
  var corpoHTML = paragrafos.map(function(par, idx) {
    var texto = esc(par.trim()).replace(/\n/g,"<br>");
    if (idx === 0) return '<p style="font-size:13.5px;line-height:1.9;color:#111827;font-weight:500;margin:0 0 14px 0;">' + texto + '</p>';
    return '<p style="font-size:13.5px;line-height:1.9;color:#111827;text-align:justify;text-indent:1.25cm;margin:0 0 14px 0;">' + texto + '</p>';
  }).join("");

  var rodapeEncaminhamento = '<div style="margin:16px 28px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;">'
    + '<div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Responsável pelo Encaminhamento</div>'
    + '<div style="font-size:13px;font-weight:700;color:#0f172a;">Marcelha Aline Pinto Gomes</div>'
    + '<div style="font-size:11.5px;color:#475569;margin-top:2px;">Administrativo / Secretaria · SindEducação-ES</div>'
    + '<div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap;">'
    + '<span style="font-size:11px;color:#64748b;">📱 (27) 99735-8900</span>'
    + '<span style="font-size:11px;color:#64748b;">📧 secretaria@sindeducacao.com</span>'
    + '</div></div>';

  var docGeradoTxt = isPreview
    ? "Documento gerado pelo SISGEP · PRÉVIA"
    : "Documento gerado pelo SISGEP · " + esc(numero);

  return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>Ofício Documentação Fiscal ' + numero + ' — SindEducação-ES</title>\n'
    + '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">\n'
    + '<style>\n'
    + '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}\n'
    + 'html,body{width:100%;min-height:100%;font-family:"Plus Jakarta Sans",Arial,sans-serif;background:#eef2f7;color:#0f172a;}\n'
    + 'body{padding:' + topPad + ';}\n'
    + '@page{size:A4 portrait;margin:0.3cm;}\n'
    + '.pw{width:100%;display:flex;justify-content:center;}\n'
    + '.rec{width:100%;max-width:780px;background:#fff;overflow:hidden;border-radius:8px;box-shadow:0 6px 30px rgba(0,20,60,.12);position:relative;}\n'
    + '@media print{\n'
    + '  @page{size:A4 portrait;margin:0.3cm;}\n'
    + '  html,body{width:210mm!important;min-height:auto!important;background:#fff!important;}\n'
    + '  body{padding:0!important;}\n'
    + '  .no-print{display:none!important;}\n'
    + '  .pw{width:100%;display:flex;justify-content:center;padding:16px;}\n'
    + '  .rec{width:100%!important;max-width:200mm!important;margin:0 auto!important;border-radius:0!important;box-shadow:none!important;}\n'
    + '}\n'
    + '</style>\n</head>\n<body>\n'
    + watermark + actionBar + aviso
    + '<div class="pw"><div class="rec">\n'
    + '<div style="background:linear-gradient(135deg,#001f4d,#003b82);padding:18px 28px 16px;border-bottom:4px solid #C9A84C;">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">'
    + '<div style="border-left:4px solid #C9A84C;padding-left:18px;flex:1;">'
    + '<div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.3px;line-height:1;">SINDEDUCAÇÃO-ES</div>'
    + '<div style="font-size:11.5px;color:rgba(255,255,255,.75);margin-top:6px;line-height:1.55;">Sindicato dos Educadores Técnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do ES</div>'
    + '<div style="font-size:11px;font-weight:900;color:#C9A84C;margin-top:8px;">CNPJ: 31.815.780/0001-51</div>'
    + '</div>'
    + '<div style="width:1px;height:64px;background:rgba(255,255,255,.15);flex-shrink:0;margin-top:2px;"></div>'
    + '<div style="text-align:right;flex-shrink:0;">'
    + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px;">Ofício Nº</div>'
    + '<div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1;letter-spacing:-0.5px;">' + numero + '</div>'
    + refLote
    + '</div></div></div>'
    + '<div style="padding:14px 28px 0;">'
    + '<div style="display:inline-flex;align-items:center;gap:6px;background:#0f766e;color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em;">DOCUMENTAÇÃO FISCAL</div>'
    + '</div>'
    + resumoCards
    + '<div style="margin:14px 28px 0;border:1px solid #cfd8e3;border-left:4px solid #001f4d;border-radius:14px;overflow:hidden;">'
    + '<div style="padding:14px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    + '<div style="display:flex;align-items:center;gap:10px;">'
    + '<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#001f4d,#1565C0);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#C9A84C;flex-shrink:0;">DF</div>'
    + '<div><div style="font-size:14px;font-weight:900;color:#001f4d;">Documentação Fiscal</div>'
    + '<div style="font-size:11.5px;color:#475569;margin-top:2px;">' + esc(descricao) + '</div></div>'
    + '</div>'
    + '<div style="text-align:right;">'
    + '<div style="font-size:10px;font-weight:900;color:#001f4d;text-transform:uppercase;letter-spacing:.10em;margin-bottom:4px;">Referência</div>'
    + '<div style="font-size:13px;font-weight:700;color:#0f172a;">Prestação de Contas</div>'
    + '</div></div></div>'
    + '<div style="padding:20px 28px 4px;">' + corpoHTML + '</div>'
    + '<div style="margin:0 28px 20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">'
    + '<div style="background:linear-gradient(135deg,#001f4d,#002f6c);padding:10px 14px;display:flex;align-items:center;gap:8px;">'
    + '<span style="font-size:14px;">📋</span>'
    + '<span style="font-size:11px;font-weight:900;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.08em;">Despesas Encaminhadas</span>'
    + '<span style="margin-left:auto;background:#C9A84C;color:#001f4d;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">' + despesas.length + '</span>'
    + '</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
    + '<thead><tr style="background:#f8fafc;">'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Nº Desp.</th>'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Fornecedor</th>'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Categoria</th>'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Descrição</th>'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Valor</th>'
    + '<th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Vencimento</th>'
    + '</tr></thead>'
    + '<tbody>' + linhasDespesas + '</tbody>'
    + '</table></div></div>'
    + blocoAnexos
    + rodapeEncaminhamento
    + '<div style="padding:24px 28px 24px;border-top:1px solid #e2e8f0;margin-top:20px;text-align:center;">'
    + '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:12px;">'
    + '<div style="flex:1;max-width:100px;height:2px;background:#C9A84C;border-radius:999px;"></div>'
    + '<span style="font-size:11px;font-weight:800;color:#C9A84C;text-transform:uppercase;letter-spacing:.10em;">Local e Data</span>'
    + '<div style="flex:1;max-width:100px;height:2px;background:#C9A84C;border-radius:999px;"></div>'
    + '</div>'
    + '<div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:40px;">Vitória/ES, <strong>' + esc(dataHoje) + '.</strong></div>'
    + '<div style="max-width:260px;margin:0 auto;text-align:center;">'
    + '<div style="height:70px;display:flex;align-items:flex-end;justify-content:center;">' + assTag + '</div>'
    + '<div style="height:2px;background:#111827;width:100%;margin-bottom:10px;"></div>'
    + '<div style="font-size:14px;font-weight:900;color:#0f172a;">LEONIL DIAS DA SILVA</div>'
    + '<div style="font-size:12px;color:#475569;margin-top:4px;">Presidente — SindEducação-ES</div>'
    + '</div></div>'
    + '<div style="background:#001f4d;padding:18px 28px 14px;">'
    + '<div style="font-size:14px;font-weight:900;color:#fff;text-align:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.1);">SINDEDUCAÇÃO-ES</div>'
    + '<div style="text-align:center;display:flex;flex-direction:column;gap:7px;">'
    + '<div style="font-size:11px;color:rgba(255,255,255,.7);line-height:1.5;">Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 — Enseada do Suá · Vitória/ES · CEP 29.050-355</div>'
    + '<div style="display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap;">'
    + '<span style="font-size:11px;color:rgba(255,255,255,.7);">(27) 99735-8900</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.3);">·</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.7);">secretaria@sindeducacao.com</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.3);">·</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.7);">sindeducacao.com.br</span>'
    + '</div></div>'
    + '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);text-align:center;">'
    + '<span style="font-size:10px;color:rgba(255,255,255,.3);">' + docGeradoTxt + '</span>'
    + '</div></div>'
    + '</div></div>\n</body>\n</html>';
}

/* ─────────────────────────────────────────────────────────────
   FUNÇÃO PÚBLICA: Gerar prévia do Ofício de Documentação Fiscal
   ───────────────────────────────────────────────────────────── */
function obterPreviewOficioFiscalDesp(idsDespesas, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    if (!Array.isArray(idsDespesas) || !idsDespesas.length) {
      return { ok: false, mensagem: "Nenhuma despesa selecionada." };
    }

    var despesasOk    = [];
    var fornecedores  = [];
    var totalValorNum = 0;
    var anexos        = [];

    idsDespesas.forEach(function(idDesp) {
      var despInfo = localizarLinhaDespesaPorId_(idDesp);
      if (!despInfo) return;

      var row = despInfo.row;
      var headerMap = despInfo.headerMap;
      function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

      var nome      = get("PRESTADOR_NOME");
      var valor     = get("VALOR");
      var venc      = get("DATA_VENCIMENTO");
      var descricao = get("DESCRICAO") || nome;
      var numero    = get("NUMERO_DESPESA");
      var categoria = get("CATEGORIA");
      var nomeArq   = get("NOME_ARQUIVO");
      var tipoDoc   = get("TIPO_DOC") || "Documento";

      var vNum = parseFloat(String(valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      totalValorNum += vNum;

      if (nome && fornecedores.indexOf(nome) === -1) fornecedores.push(nome);

      despesasOk.push({ id: idDesp, nome: nome, valor: valor, vencimento: formatarDataBRDesp_(venc), descricao: descricao, numero: numero, categoria: categoria });

      if (nomeArq) anexos.push({ nome: nomeArq, tipo: tipoDoc, fornecedor: nome });
    });

    if (!despesasOk.length) return { ok: false, mensagem: "Nenhuma despesa válida encontrada." };

    var dataHoje   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    var totalValor = "R$ " + totalValorNum.toFixed(2).replace(".", ",");
    var descricao  = montarDescricaoOficioFiscal_(fornecedores);
    var lote       = "LC-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 99999)).padStart(5, "0");

    var params = { dataHoje: dataHoje, despesas: despesasOk, fornecedores: fornecedores, totalValor: totalValor, totalValorNum: totalValorNum, descricao: descricao, lote: lote, anexos: anexos };
    var htmlPrevia = gerarHtmlOficioDocumentacaoFiscal_(params, true);

    var emailsResp = listarEmailsEnvioDespesas_interno_();
    var emails     = emailsResp.lista || [];
    var paraPadrao = emails.filter(function(e){ return e.tipo === "PARA" && e.padrao; }).map(function(e){ return e.email; });
    var ccPadrao   = emails.filter(function(e){ return e.tipo === "CC"   && e.padrao; }).map(function(e){ return e.email; });

    return {
      ok:           true,
      htmlPrevia:   htmlPrevia,
      emails:       emails,
      para:         paraPadrao.join(","),
      cc:           ccPadrao.join(","),
      assunto:      montarAssuntoDocumentacaoFiscalDesp_(fornecedores),
      fornecedores: fornecedores,
      total:        despesasOk.length,
      totalValor:   totalValor,
      descricao:    descricao,
      lote:         lote,
      dataHoje:     dataHoje,
      despesas:     despesasOk,
      anexos:       anexos,
      htmlEmail:    montarHtmlEnvioContabilidadeDesp_(despesasOk, totalValorNum,
                      (function(){ try{ return Session.getActiveUser().getEmail(); }catch(e){ return "secretaria@sindeducacao.com"; } }()))
    };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao gerar prévia: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   FUNÇÃO PÚBLICA: Enviar lote COM ofício de documentação fiscal
   ───────────────────────────────────────────────────────────── */
function enviarLoteDespesasComOficio(payload, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    payload = payload || {};
    var idsDespesas = Array.isArray(payload.idsDespesas) ? payload.idsDespesas : [];
    if (!idsDespesas.length) return { ok: false, mensagem: "Nenhuma despesa selecionada." };

    var emailUsuario = "";
    try { emailUsuario = Session.getActiveUser().getEmail() || "secretaria@sindeducacao.com"; } catch(e) { emailUsuario = "secretaria@sindeducacao.com"; }

    var paraEmails = String(payload.para    || EMAILS_CONTABILIDADE_DESPESAS.join(",")).trim();
    var ccEmails   = String(payload.cc      || emailUsuario).trim();
    var assunto    = String(payload.assunto || "📤 Documentação Fiscal — SindEducação-ES").trim();
    var lote       = String(payload.lote    || "").trim();

    var numeroOficio  = gerarProximoNumeroOficioFiscal_();
    var urlBase       = ScriptApp.getService().getUrl();
    var despesasOk    = [];
    var fornecedores  = [];
    var totalValorNum = 0;
    var anexos        = [];
    var blobsAnexo    = [];
    var despesasErr   = [];

    idsDespesas.forEach(function(idDesp) {
      try {
        var despInfo = localizarLinhaDespesaPorId_(idDesp);
        if (!despInfo) { despesasErr.push({ id: idDesp, erro: "Não encontrada." }); return; }

        var row = despInfo.row;
        var headerMap = despInfo.headerMap;
        function get(col) { return String(row[(headerMap[col] || 0) - 1] || "").trim(); }

        var nome      = get("PRESTADOR_NOME");
        var valor     = get("VALOR");
        var venc      = get("DATA_VENCIMENTO");
        var descricao = get("DESCRICAO") || nome;
        var numero    = get("NUMERO_DESPESA");
        var categoria = get("CATEGORIA");
        var fileId    = get("FILE_ID_DOCUMENTO");
        var nomeArq   = get("NOME_ARQUIVO");
        var tipoDoc   = get("TIPO_DOC") || "Documento";

        var vNum = parseFloat(String(valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
        totalValorNum += vNum;

        if (nome && fornecedores.indexOf(nome) === -1) fornecedores.push(nome);

        var tokenCont   = gerarTokenContabilidadeDespesa_(idDesp);
        var linkConfirm = urlBase + "?page=pub-contabil-despesa&token=" + tokenCont;

        despesasOk.push({ id: idDesp, nome: nome, valor: valor, vencimento: formatarDataBRDesp_(venc), descricao: descricao, numero: numero, categoria: categoria, tipoLanc: get("TIPO_LANCAMENTO"), linkConfirm: linkConfirm });

        if (fileId) {
          try {
            var blob = DriveApp.getFileById(fileId).getBlob();
            var nomeBlob = (nomeArq || (tipoDoc + " - " + nome)).replace(/[\/\\:*?"<>|]/g, "_") + ".pdf";
            blob.setName(nomeBlob);
            blobsAnexo.push(blob);
            anexos.push({ nome: nomeBlob, tipo: tipoDoc, fornecedor: nome });
          } catch(eAnexo) { Logger.log("⚠ Não foi possível anexar doc de " + nome + ": " + eAnexo.message); }
        }

        atualizarCamposDespesa_(idDesp, {
          "STATUS":                   STATUS_DESPESA.ENVIADO_CONTABILIDADE,
          "TOKEN_CONTABILIDADE":      tokenCont,
          "DATA_ENVIO_CONTABILIDADE": agoraFormatadoDesp_()
        });

      } catch(eDep) { despesasErr.push({ id: idDesp, erro: eDep.message }); }
    });

    if (!despesasOk.length) return { ok: false, mensagem: "Nenhuma despesa processada.", erros: despesasErr };

    var dataHoje   = payload.dataHoje || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    var descricao  = payload.descricao || montarDescricaoOficioFiscal_(fornecedores);
    var totalValor = "R$ " + totalValorNum.toFixed(2).replace(".", ",");

    var paramsOficio = { numero: numeroOficio, dataHoje: dataHoje, despesas: despesasOk, fornecedores: fornecedores, totalValor: totalValor, totalValorNum: totalValorNum, descricao: descricao, lote: lote, anexos: anexos };
    var htmlOficio   = gerarHtmlOficioDocumentacaoFiscal_(paramsOficio, false);

    // Salva ofício HTML no Drive
    var nomeArquivoOficio = montarNomeArquivoOficioFiscal_(numeroOficio, fornecedores);
    var pastaOficio = null;
    try {
      var pastaId = (PropertiesService.getScriptProperties().getProperty("PASTA_DESPESAS_ID") || "").trim();
      /* Antes caía em PASTA_RECIBO_ID, que vale PRODUÇÃO em qualquer ambiente.
         getRecursoId_ troca por ambiente e trava se a homologação apontar
         para produção — ver AmbienteRecursos.gs. */
      if (!pastaId) pastaId = getRecursoId_("RECIBOS");
      if (pastaId) {
        var pastaRaiz = DriveApp.getFolderById(pastaId);
        var anoStr    = new Date().getFullYear().toString();
        var itAno     = pastaRaiz.getFoldersByName(anoStr);
        var pastaAno  = itAno.hasNext() ? itAno.next() : pastaRaiz.createFolder(anoStr);
        var mesStr    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM - MMMM");
        var itMes     = pastaAno.getFoldersByName(mesStr);
        var pastaMes  = itMes.hasNext() ? itMes.next() : pastaAno.createFolder(mesStr);
        var subNome   = "Oficios Contabilidade";
        var itSub     = pastaMes.getFoldersByName(subNome);
        pastaOficio   = itSub.hasNext() ? itSub.next() : pastaMes.createFolder(subNome);
      }
    } catch(ePasta) { Logger.log("⚠ Pasta ofício: " + ePasta.message); }

    var linkOficio   = "";
    var fileIdOficio = "";
    if (pastaOficio) {
      try {
        var htmlBlob   = Utilities.newBlob(htmlOficio, "text/html", nomeArquivoOficio + ".html");
        var fileOficio = pastaOficio.createFile(htmlBlob);
        arquivoAplicarPolitica_(fileOficio, "Despesas_Oficio_Fiscal.gs");
        linkOficio   = fileOficio.getUrl();
        fileIdOficio = fileOficio.getId();
        Logger.log("✅ Ofício fiscal salvo: " + nomeArquivoOficio);
      } catch(eSave) { Logger.log("⚠ Erro ao salvar ofício: " + eSave.message); }
    }

    // Registra na aba Controle
    registrarOficioFiscalNoControle_({
      numero:       numeroOficio,
      dataHoje:     dataHoje,
      fornecedores: fornecedores,
      emails:       paraEmails + (ccEmails ? "," + ccEmails : ""),
      linkOficio:   linkOficio,
      observacoes:  "Lote: " + lote + " · " + despesasOk.length + " despesa(s) · " + totalValor
    });

    // Envia e-mail
    var htmlEmail = montarHtmlEnvioContabilidadeDesp_(despesasOk, totalValorNum, emailUsuario);

    var listaAnexosHtml = anexos.length
      ? '<div style="margin-top:16px;padding:12px 16px;background:#f0f4f8;border-radius:10px;border:1px solid #e2e8f0;">'
        + '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">📎 Documentos Anexados</div>'
        + anexos.map(function(a){ return '<div style="font-size:12.5px;font-weight:600;color:#334155;margin-bottom:4px;">📄 ' + a.nome + '</div>'; }).join("")
        + '</div>'
      : "";

    var htmlEmailFinal = htmlEmail.replace('</div>\n    </div>', listaAnexosHtml + '</div>\n    </div>');

    MailApp.sendEmail({
      to:          paraEmails,
      cc:          ccEmails,
      subject:     assunto,
      htmlBody:    htmlEmailFinal,
      attachments: blobsAnexo,
      name:        "SindEducação-ES",
      replyTo:     emailUsuario
    });

    return {
      ok:            true,
      numeroOficio:  numeroOficio,
      nomeArquivo:   nomeArquivoOficio,
      linkOficio:    linkOficio,
      fileIdOficio:  fileIdOficio,
      totalEnviadas: despesasOk.length,
      totalErros:    despesasErr.length,
      totalValor:    totalValor,
      erros:         despesasErr,
      mensagem:      despesasOk.length + " despesa(s) enviada(s) com sucesso. Ofício Nº " + numeroOficio + " gerado."
    };

  } catch(e) {
    Logger.log("❌ enviarLoteDespesasComOficio: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar: " + e.message };
  }
}