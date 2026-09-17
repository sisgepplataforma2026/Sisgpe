// ===============================
// ARQUIVO: Relatorios.gs
// SISGEP - Relatórios Gerais
// ===============================

function obterResumoRelatorios(filtros) {
  filtros = filtros || {};

  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const abaControle = ss.getSheetByName(ABA_CONTROLE || "Controle");

    if (!abaControle || abaControle.getLastRow() < 2) {
      return {
        ok: true,
        total: 0,
        filiacoes: 0,
        desfiliacoes: 0,
        outros: 0
      };
    }

    const dados = abaControle.getDataRange().getValues();
    const cab = dados[0].map(function(h) {
      return String(h || "").trim().toUpperCase();
    });

    const idxTipo = cab.indexOf("TIPO");
    const idxData = cab.indexOf("DATA");
    const idxEscola = cab.indexOf("ESCOLA");

    let total = 0;
    let filiacoes = 0;
    let desfiliacoes = 0;
    let outros = 0;

    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];

      const tipo = idxTipo > -1
        ? String(linha[idxTipo] || "").trim().toUpperCase()
        : "";

      const escola = idxEscola > -1
        ? String(linha[idxEscola] || "").trim()
        : "";

      const data = idxData > -1 ? linha[idxData] : "";

      if (!_relatorioLinhaPassaFiltros_(tipo, escola, data, filtros)) {
        continue;
      }

      total++;

      if (tipo.indexOf("FILIA") > -1 && tipo.indexOf("DES") === -1) {
        filiacoes++;
      } else if (tipo.indexOf("DESFILIA") > -1) {
        desfiliacoes++;
      } else {
        outros++;
      }
    }

    return {
      ok: true,
      total: total,
      filiacoes: filiacoes,
      desfiliacoes: desfiliacoes,
      outros: outros
    };

  } catch (e) {
    return {
      ok: false,
      erro: true,
      mensagem: "Erro ao obter resumo de relatórios: " + e.message
    };
  }
}

function exportarControleGeralRelatorio(filtros, formato) {
  filtros = filtros || {};
  formato = String(formato || "excel").toLowerCase();

  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const abaControle = ss.getSheetByName(ABA_CONTROLE || "Controle");

    if (!abaControle || abaControle.getLastRow() < 2) {
      return {
        ok: false,
        erro: true,
        mensagem: "Nenhum dado encontrado na aba Controle."
      };
    }

    const dados = abaControle.getDataRange().getValues();
    const cab = dados[0].map(function(h) {
      return String(h || "").trim().toUpperCase();
    });

    const idxTipo = cab.indexOf("TIPO");
    const idxData = cab.indexOf("DATA");
    const idxEscola = cab.indexOf("ESCOLA");

    const linhas = [dados[0]];

    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];

      const tipo = idxTipo > -1
        ? String(linha[idxTipo] || "").trim().toUpperCase()
        : "";

      const escola = idxEscola > -1
        ? String(linha[idxEscola] || "").trim()
        : "";

      const data = idxData > -1 ? linha[idxData] : "";

      if (_relatorioLinhaPassaFiltros_(tipo, escola, data, filtros)) {
        linhas.push(linha);
      }
    }

    if (linhas.length < 2) {
      return {
        ok: false,
        erro: true,
        mensagem: "Nenhum registro encontrado para os filtros informados."
      };
    }

    const pasta = _obterPastaRelatorios_();
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd_HHmmss"
    );

    if (formato === "pdf") {
      return _gerarRelatorioPdf_(pasta, "Controle_Geral_" + timestamp, linhas);
    }

    return _gerarRelatorioCsv_(pasta, "Controle_Geral_" + timestamp, linhas);

  } catch (e) {
    return {
      ok: false,
      erro: true,
      mensagem: "Erro ao exportar Controle Geral: " + e.message
    };
  }
}

function exportarAuditoriaRelatorio(filtros, formato) {
  filtros = filtros || {};
  formato = String(formato || "excel").toLowerCase();

  try {
    const logs = typeof getLogsRecentes === "function"
      ? getLogsRecentes({})
      : [];

    const linhas = [[
      "DATA/HORA",
      "NIVEL",
      "MODULO",
      "MENSAGEM",
      "USUARIO",
      "AMBIENTE"
    ]];

    (logs || []).forEach(function(item) {
      linhas.push([
        item.timestamp || "",
        item.nivel || "",
        item.modulo || "",
        item.mensagem || "",
        item.usuario || "",
        item.ambiente || ""
      ]);
    });

    if (linhas.length < 2) {
      return {
        ok: false,
        erro: true,
        mensagem: "Nenhum log de auditoria encontrado na sessão atual."
      };
    }

    const pasta = _obterPastaRelatorios_();

    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd_HHmmss"
    );

    if (formato === "pdf") {
      return _gerarRelatorioPdf_(pasta, "Auditoria_Log_" + timestamp, linhas);
    }

    return _gerarRelatorioCsv_(pasta, "Auditoria_Log_" + timestamp, linhas);

  } catch (e) {
    return {
      ok: false,
      erro: true,
      mensagem: "Erro ao exportar Auditoria: " + e.message
    };
  }
}

function _relatorioLinhaPassaFiltros_(tipo, escola, data, filtros) {
  filtros = filtros || {};

  const filtroTipo = String(filtros.tipo || "").trim().toUpperCase();
  const filtroEscola = String(filtros.escola || "").trim().toLowerCase();

  if (filtroTipo && tipo !== filtroTipo) {
    return false;
  }

  if (
    filtroEscola &&
    String(escola || "").toLowerCase().indexOf(filtroEscola) === -1
  ) {
    return false;
  }

  if (filtros.dataInicio || filtros.dataFim) {
    const dataLinha = _converterDataRelatorio_(data);

    if (!dataLinha) {
      return false;
    }

    if (filtros.dataInicio) {
      const inicio = new Date(String(filtros.dataInicio) + "T00:00:00");

      if (dataLinha < inicio) {
        return false;
      }
    }

    if (filtros.dataFim) {
      const fim = new Date(String(filtros.dataFim) + "T23:59:59");

      if (dataLinha > fim) {
        return false;
      }
    }
  }

  return true;
}

function _converterDataRelatorio_(valor) {
  if (!valor) return null;

  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return valor;
  }

  const txt = String(valor || "").trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
    return new Date(txt);
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(txt)) {
    const p = txt.substring(0, 10).split("/");
    return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  }

  const d = new Date(txt);
  return isNaN(d.getTime()) ? null : d;
}

function _obterPastaRelatorios_() {
  /* A pasta sai de getRecursoId_ (AmbienteRecursos.gs), que troca por ambiente
     e trava a gravação se a homologação cair na pasta de produção.

     PASTAS.RELATORIOS e PASTA_RELATORIOS_ID eram lidos direto aqui e ambos
     valem PRODUÇÃO em qualquer ambiente — era por este caminho que a
     homologação escrevia relatório no acervo real. Ficam como último recurso,
     só para o caso de AmbienteRecursos.gs não estar no projeto. */
  let pastaId = "";

  try {
    pastaId = getRecursoId_("RELATORIOS");
  } catch (e) {
    if (/BLOQUEADO/.test(String(e && e.message))) throw e;

    if (typeof PASTAS !== "undefined" && PASTAS.RELATORIOS) {
      pastaId = PASTAS.RELATORIOS;
    }
    if (!pastaId && typeof PASTA_RELATORIOS_ID !== "undefined") {
      pastaId = PASTA_RELATORIOS_ID;
    }
  }

  if (!pastaId) {
    throw new Error("Pasta de relatórios não configurada.");
  }

  return DriveApp.getFolderById(pastaId);
}

function _gerarRelatorioCsv_(pasta, nomeBase, linhas) {
  const csv = linhas.map(function(linha) {
    return linha.map(function(celula) {
      const valor = String(celula == null ? "" : celula);

      if (/[;"\n]/.test(valor)) {
        return '"' + valor.replace(/"/g, '""') + '"';
      }

      return valor;
    }).join(";");
  }).join("\n");

  const blob = Utilities.newBlob(
    csv,
    "text/csv;charset=utf-8",
    nomeBase + ".csv"
  );

  const file = pasta.createFile(blob);

  return {
    ok: true,
    nomeArquivo: file.getName(),
    url: file.getUrl(),
    formato: "excel",
    registros: Math.max(0, linhas.length - 1)
  };
}

function _gerarRelatorioPdf_(pasta, nomeBase, linhas) {
  const html = _montarHtmlRelatorio_(nomeBase, linhas);

  const blob = Utilities
    .newBlob(html, "text/html", nomeBase + ".html")
    .getAs("application/pdf")
    .setName(nomeBase + ".pdf");

  const file = pasta.createFile(blob);

  return {
    ok: true,
    nomeArquivo: file.getName(),
    url: file.getUrl(),
    formato: "pdf",
    registros: Math.max(0, linhas.length - 1)
  };
}

function _montarHtmlRelatorio_(titulo, linhas) {
  let html =
    "<html><head><meta charset='UTF-8'>" +
    "<style>" +
    "body{font-family:Arial,sans-serif;font-size:11px;color:#111;}" +
    "h1{font-size:18px;color:#123b6d;}" +
    "table{width:100%;border-collapse:collapse;}" +
    "th,td{border:1px solid #ddd;padding:5px;text-align:left;vertical-align:top;}" +
    "th{background:#eef3fc;font-weight:bold;}" +
    "</style></head><body>";

  html += "<h1>" + titulo + "</h1>";
  html += "<p>Gerado em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") + "</p>";
  html += "<table>";

  linhas.forEach(function(linha, idx) {
    html += "<tr>";

    linha.forEach(function(celula) {
      const tag = idx === 0 ? "th" : "td";
      html += "<" + tag + ">" + _escapeHtmlRelatorio_(celula) + "</" + tag + ">";
    });

    html += "</tr>";
  });

  html += "</table></body></html>";

  return html;
}

function _escapeHtmlRelatorio_(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
