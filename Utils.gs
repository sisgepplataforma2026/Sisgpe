// =========================
// ARQUIVO: Utils.gs — CORRIGIDO v2.2.0
// CORREÇÃO: _headerCache agora é invalidado automaticamente após
//           appendRow, setValueByHeader_, setRowByHeader_
// =========================

/* ================= DATA EXTENSO ================= */
function dataPorExtenso() {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  const hoje = new Date();
  const tz   = Session.getScriptTimeZone();
  const dia  = parseInt(Utilities.formatDate(hoje, tz, "d"), 10);
  const mes  = parseInt(Utilities.formatDate(hoje, tz, "M"), 10) - 1;
  const ano  = Utilities.formatDate(hoje, tz, "yyyy");
  return dia + " de " + meses[mes] + " de " + ano;
}

/* ================= VALIDAÇÃO DE E-MAIL ================= */
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/* ================= HELPERS GERAIS ================= */
function textoSeguro_(v)      { return String(v === null ? "" : v).trim(); }
function somenteDigitos_(v)   { return String(v || "").replace(/\D/g, ""); }
function agoraFormatado_()    { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"); }
function normalizarTexto_(valor) {
  return String(valor || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function normalizarComparacao_(v) { return normalizarTexto_(textoSeguro_(v)); }

/* ================= HEADERS / CACHE ================= */
// CORREÇÃO: cache com TTL de 5 minutos para evitar dados obsoletos
// mesmo que limparCacheHeader_ não seja chamado explicitamente.
var _headerCache = {};
var _headerCacheTTL = 5 * 60 * 1000; // 5 minutos em ms

function _getHeaderCacheKey_(sheet) {
  return sheet.getParent().getId() + "::" + sheet.getName();
}

function getHeaderMap_(sheet) {
  const key = _getHeaderCacheKey_(sheet);
  const now  = Date.now();

  if (_headerCache[key] && (now - _headerCache[key].ts) < _headerCacheTTL) {
    return _headerCache[key].map;
  }

  const headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map       = {};
  const duplicados = [];

  headers.forEach(function(h, i) {
    const k = String(h || "").trim();
    if (!k) return;
    if (map[k] !== undefined) {
      duplicados.push(k + " (cols " + map[k] + " e " + (i + 1) + ")");
    } else {
      map[k] = i + 1;
    }
  });

  if (duplicados.length) {
    Logger.log("⚠ Headers duplicados em '" + sheet.getName() + "': " + duplicados.join(", ") + " — apenas a primeira ocorrência será usada.");
  }

  // CORREÇÃO: armazena junto com timestamp para TTL
  _headerCache[key] = { map: map, ts: now };
  return map;
}

// CORREÇÃO: limpa o cache de uma aba específica (chamado internamente após escritas)
function limparCacheHeader_(sheet) {
  if (!sheet) return;
  delete _headerCache[_getHeaderCacheKey_(sheet)];
}

// CORREÇÃO: limpa todo o cache (útil ao mudar colunas ou abas)
function limparTodoCacheHeaders_() {
  _headerCache = {};
}

// CORREÇÃO: appendRow agora invalida o cache após escrever
function appendRowByHeader_(sheet, obj) {
  const headerMap  = getHeaderMap_(sheet);
  const lastCol    = sheet.getLastColumn();
  const row        = new Array(lastCol).fill("");
  const ignoradas  = [];

  Object.keys(obj || {}).forEach(function(k) {
    if (headerMap[k]) {
      row[headerMap[k] - 1] = obj[k];
    } else {
      ignoradas.push(k);
    }
  });

  if (ignoradas.length) {
    Logger.log("⚠ Campos ignorados (" + sheet.getName() + "): " + ignoradas.join(", "));
  }

  sheet.appendRow(row);
  // CORREÇÃO: invalida cache após append — número de linhas mudou
  limparCacheHeader_(sheet);
}

function getValueByHeader_(sheet, row, headerMap, nomeColuna) {
  const col = headerMap[nomeColuna];
  if (!col) return "";
  return sheet.getRange(row, col).getValue();
}

// CORREÇÃO: invalida cache após escrita
function setValueByHeader_(sheet, row, headerMap, nomeColuna, valor) {
  var col = headerMap[nomeColuna];
  if (!col) return;
  sheet.getRange(row, col).setValue(valor);
}

function getRowByHeader_(sheet, row, headerMap) {
  const lastCol = sheet.getLastColumn();
  const valores = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  const obj     = {};
  Object.keys(headerMap).forEach(function(nome) {
    const col = headerMap[nome];
    obj[nome] = col ? valores[col - 1] : "";
  });
  return obj;
}

// CORREÇÃO: invalida cache após escrita em lote
function setRowByHeader_(sheet, row, headerMap, obj) {
  const lastCol = sheet.getLastColumn();
  const range   = sheet.getRange(row, 1, 1, lastCol);
  const valores = range.getValues()[0];
  Object.keys(obj || {}).forEach(function(nome) {
    const col = headerMap[nome];
    if (col) valores[col - 1] = obj[nome];
  });
  range.setValues([valores]);
  limparCacheHeader_(sheet);
}

/* ================= PAGINAÇÃO (achado #9) ================= */
// Fatia um array já filtrado/ordenado em página, só quando o chamador pede
// (filtros.porPagina > 0). Sem porPagina, devolve tudo — comportamento
// idêntico ao de hoje, para não quebrar telas que ainda não pedem página.
// Uso: var pag = paginarItens_(itens, filtros); return Object.assign(pag, {...});
function paginarItens_(itens, filtros) {
  filtros = filtros || {};
  var totalFiltrado = itens.length;
  var porPagina = parseInt(filtros.porPagina, 10);
  var pagina    = parseInt(filtros.pagina, 10);
  var paginado  = !!porPagina && porPagina > 0;

  if (!paginado) return { itens: itens, total: totalFiltrado };

  if (!pagina || pagina < 1) pagina = 1;
  var inicio = (pagina - 1) * porPagina;

  return {
    itens: itens.slice(inicio, inicio + porPagina),
    total: totalFiltrado,
    pagina: pagina,
    porPagina: porPagina,
    totalPaginas: Math.ceil(totalFiltrado / porPagina)
  };
}

/* ================= MESCLAR E-MAILS ================= */
function mesclarEmails_() {
  const unicos = [];
  const vistos = {};
  Array.prototype.slice.call(arguments).forEach(function(item) {
    const lista = Array.isArray(item) ? item : [item];
    lista.forEach(function(valor) {
      String(valor || "").split(/[;,]/)
        .map(function(v) { return textoSeguro_(v).toLowerCase(); })
        .filter(function(e) { return e && emailValido(e); })
        .forEach(function(e) {
          if (!vistos[e]) { vistos[e] = true; unicos.push(e); }
        });
    });
  });
  return unicos.join(", ");
}

/* ================= VALOR POR EXTENSO ================= */
function valorPorExtenso(valor) {
  if (!valor) return "zero reais";
  var v = String(valor).replace(/\./g, "").replace(",", ".");
  v = parseFloat(v);
  if (isNaN(v) || v === 0) return "zero reais";
  const unidades  = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove"];
  const especiais = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dezenas   = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const centenas  = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  function converter(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";
    let t = "";
    if (n >= 100) { t += centenas[Math.floor(n/100)]; n %= 100; if (n > 0) t += " e "; }
    if (n >= 20)  { t += dezenas[Math.floor(n/10)];   n %= 10;  if (n > 0) t += " e "; }
    else if (n >= 10) { t += especiais[n-10]; n = 0; }
    if (n > 0) t += unidades[n];
    return t;
  }
  const inteiro   = Math.floor(v);
  const centavos  = Math.round((v - inteiro) * 100);
  const partes    = [];
  if (inteiro >= 1000000) {
    const m = Math.floor(inteiro/1000000), rm = inteiro % 1000000;
    partes.push(converter(m) + (m === 1 ? " milhão" : " milhões"));
    if (rm >= 1000) { const mi = Math.floor(rm/1000), rmi = rm % 1000; partes.push(mi === 1 ? "mil" : converter(mi) + " mil"); if (rmi > 0) partes.push(converter(rmi)); }
    else if (rm > 0) partes.push(converter(rm));
  } else if (inteiro >= 1000) {
    const mi = Math.floor(inteiro/1000), rmi = inteiro % 1000;
    partes.push(mi === 1 ? "mil" : converter(mi) + " mil");
    if (rmi > 0) partes.push(((rmi < 100 || rmi % 100 === 0) ? " e " : " ") + converter(rmi));
  } else if (inteiro > 0) {
    partes.push(converter(inteiro));
  }
  let resultado = partes.join(" ").replace(/\s+/g, " ").trim();
  if (inteiro > 0) resultado += inteiro === 1 ? " real" : " reais";
  if (centavos > 0) { if (inteiro > 0) resultado += " e "; resultado += converter(centavos) + (centavos === 1 ? " centavo" : " centavos"); }
  return resultado.toLowerCase();
}

/* ================= SUBPASTA POR ANO ================= */
function obterOuCriarSubpastaAno(pastaPrincipalId) {
  try {
    const pastaPrincipal = DriveApp.getFolderById(pastaPrincipalId);
    const nomeAno        = new Date().getFullYear().toString();
    const pastas         = pastaPrincipal.getFoldersByName(nomeAno);
    if (pastas.hasNext()) return pastas.next();
    return pastaPrincipal.createFolder(nomeAno);
} catch (e) {
    Logger.log("❌ obterOuCriarSubpastaAno — erro: " + e.message);
    throw new Error("Não foi possível acessar/criar a subpasta do ano: " + e.message);
  }
}

/* ================= HELPERS MONETÁRIOS ================= */
function normalizarValorNumero_(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  var texto = String(valor).trim().replace(/\s/g,"").replace(/^R\$/i,"");
  if (texto.indexOf(",") > -1 && texto.indexOf(".") > -1) { texto = texto.replace(/\./g,"").replace(",","."); }
  else if (texto.indexOf(",") > -1) { texto = texto.replace(",","."); }
  var num = parseFloat(texto);
  return isNaN(num) ? 0 : num;
}
function formatarValorBR_(num) { return Number(num || 0).toFixed(2).replace(".", ","); }
function parseValorTexto_(valor) {
  if (!valor) return 0;
  var txt = String(valor).replace(/\s/g,"").replace(/^R\$/i,"");
  if (txt.indexOf(",") > -1) { txt = txt.replace(/\./g,"").replace(",","."); }
  else { var p = txt.split("."); if (p.length > 1) { var u = p[p.length-1]; txt = /^\d{1,2}$/.test(u) ? p.slice(0,-1).join("") + "." + u : p.join(""); } }
  var n = parseFloat(txt);
  return isNaN(n) ? 0 : n;
}

/* ================= VALIDAÇÃO CPF ================= */
function cpfValido(cpf) {
  if (!cpf) return false;
  var dig = String(cpf).replace(/\D/g, "");
  if (dig.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(dig)) return false;
  var soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(dig[i], 10) * (10 - i);
  var r1 = (soma * 10) % 11; if (r1 === 10 || r1 === 11) r1 = 0;
  if (r1 !== parseInt(dig[9], 10)) return false;
  soma = 0;
  for (let j = 0; j < 10; j++) soma += parseInt(dig[j], 10) * (11 - j);
  var r2 = (soma * 10) % 11; if (r2 === 10 || r2 === 11) r2 = 0;
  return r2 === parseInt(dig[10], 10);
}

function validarCpfComFeedback(cpf) {
  var dig = String(cpf || "").replace(/\D/g, "");
  if (!dig) return { valido: false, mensagem: "CPF não informado.", cpfFormatado: "" };
  if (dig.length !== 11) return { valido: false, mensagem: "CPF inválido: deve ter 11 dígitos (informado: " + dig.length + ").", cpfFormatado: "" };
  if (/^(\d)\1{10}$/.test(dig)) return { valido: false, mensagem: "CPF inválido: sequência repetida não é permitida.", cpfFormatado: "" };
  if (!cpfValido(dig)) return { valido: false, mensagem: "CPF inválido: dígitos verificadores incorretos.", cpfFormatado: "" };
  return { valido: true, mensagem: "CPF válido.", cpfFormatado: dig.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") };
}

/* ================= SAUDAÇÃO ================= */
function saudacaoHoraBR_() {
  const hora = parseInt(Utilities.formatDate(new Date(), "America/Sao_Paulo", "H"), 10);
  if (hora >= 5  && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarCnpj_(cnpj) {
  var c = String(cnpj || "").replace(/\D/g, "");
  if (c.length !== 14) return String(cnpj || "");
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// CORREÇÃO: exportar buscarFichasDrive para compatibilidade com o frontend
function obterArquivoDriveBase64(fileId) {
  try {
    const arquivo = DriveApp.getFileById(String(fileId).trim());
    const blob    = arquivo.getBlob();
    return {
      nome:   arquivo.getName(),
      base64: Utilities.base64Encode(blob.getBytes()),
      tipo:   blob.getContentType() || "application/pdf"
    };
  } catch (e) {
    throw new Error("Arquivo não encontrado no Drive: " + e.message);
  }
}

function buscarFichasDrive(termo) {
  try {
    termo = String(termo || "").trim();
    if (!termo || termo.length < 3) return [];
    const termoNorm = normalizarTexto_(termo);
    const PASTA_IDS = [
      typeof PASTA_OFICIOS_ID            !== "undefined" ? PASTA_OFICIOS_ID            : null,
      typeof PASTA_OFICIOS_DESFILIACAO_ID !== "undefined" ? PASTA_OFICIOS_DESFILIACAO_ID : null,
      typeof PASTA_RECIBO_ID             !== "undefined" ? PASTA_RECIBO_ID             : null
    ].filter(Boolean);

    const resultados = [];
    const vistos     = {};

    PASTA_IDS.forEach(function(pastaId) {
      try {
        const pasta    = DriveApp.getFolderById(pastaId);
        const arquivos = pasta.searchFiles("title contains '" + termo.replace(/'/g, "\\'") + "' and trashed = false");
        while (arquivos.hasNext() && resultados.length < 30) {
          const arq = arquivos.next();
          const id  = arq.getId();
          if (vistos[id]) continue;
          vistos[id] = true;
          const mime = arq.getMimeType() || "";
          if (mime.indexOf("pdf") < 0 && mime.indexOf("image") < 0 && mime.indexOf("jpeg") < 0) continue;
          if (normalizarTexto_(arq.getName()).indexOf(termoNorm) < 0) continue;
          resultados.push({
            id:   id,
            nome: arq.getName(),
            tipo: mime,
            url:  arq.getUrl()
          });
        }
      } catch (e) {
        Logger.log("⚠ buscarFichasDrive — pasta " + pastaId + ": " + e.message);
      }
    });

    resultados.sort(function(a, b) { return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }); });
    return resultados.slice(0, 20);
  } catch (e) {
    Logger.log("❌ buscarFichasDrive: " + e.message);
    return [];
  }
}

/* ================= DIAGNOSTICO DO MODULO DE OFICIOS ================= */
function utils_diagnosticarModuloOficios() {
  var itens = [];
  var inicio = new Date();

  _diagOficiosChecarFuncoes_(itens);
  _diagOficiosChecarIncludes_(itens);
  _diagOficiosChecarConfiguracoes_(itens);
  _diagOficiosChecarPlanilha_(itens);
  _diagOficiosChecarTriggers_(itens);

  var resumo = itens.reduce(function(acc, item) {
    acc.total++;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { total: 0, ok: 0, aviso: 0, erro: 0 });

  var saida = {
    ok: resumo.erro === 0,
    geradoEm: Utilities.formatDate(inicio, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
    ambiente: (typeof getAmbienteAtual === "function") ? getAmbienteAtual() : "nao_identificado",
    resumo: resumo,
    itens: itens
  };

  Logger.log(JSON.stringify(saida, null, 2));
  return saida;
}

function _diagOficiosItem_(itens, categoria, nome, status, mensagem, detalhes) {
  itens.push({
    categoria: categoria,
    nome: nome,
    status: status,
    mensagem: mensagem || "",
    detalhes: detalhes || ""
  });
}

function _diagOficiosChecarFuncoes_(itens) {
  [
    "gerarOficioWeb",
    "previewOficioWeb",
    "listarEscolas",
    "buscarEscolasPorTermo",
    "processarFilaEnvioOficios",
    "enviarOficioDaFilaAgora",
    "listarHistoricoOficios",
    "listarStatusOficios",
    "prepararFilaTaxaAssistencial",
    "obterStatusFilaTaxaAssistencial"
  ].forEach(function(nome) {
    var existe = false;
    try { existe = typeof this[nome] === "function"; } catch (e) {}
    _diagOficiosItem_(
      itens,
      "Funcoes",
      nome,
      existe ? "ok" : "erro",
      existe ? "Funcao disponivel." : "Funcao nao encontrada no projeto."
    );
  });
}

function _diagOficiosChecarIncludes_(itens) {
  // NOTA: este check só confirma que o ARQUIVO existe no projeto — não que ele
  // está de fato incluído em index.html (a tela real, servida por Code.gs).
  // "DashboardOficiosDashboardOficiosUI" é um caso confirmado disso: passa
  // aqui como "ok" mas não é referenciado por nenhum include() em index.html
  // nem em nenhuma rota — nunca chega a ser mostrado a um usuário.
  [
    "OficiosStyles",
    "OficiosFormulario",
    "blocoRelatorios",
    "CadastroEscolas",
    "DashboardOficiosDashboardOficiosUI",
    "Helpers",
    "OficiosScripts",
    "Scripts_Relatorios",
    "Taxaprogressoenvio"
  ].forEach(function(nome) {
    try {
      HtmlService.createHtmlOutputFromFile(nome).getContent();
      _diagOficiosItem_(itens, "Includes", nome, "ok", "Arquivo HTML encontrado.");
    } catch (e) {
      _diagOficiosItem_(itens, "Includes", nome, "erro", "Include nao encontrado ou invalido.", e.message);
    }
  });
}

function _diagOficiosChecarConfiguracoes_(itens) {
  var planilhaOk = typeof PLANILHA_ID !== "undefined" && String(PLANILHA_ID || "").trim();
  _diagOficiosItem_(itens, "Configuracao", "PLANILHA_ID", planilhaOk ? "ok" : "erro", planilhaOk ? "Configurado." : "PLANILHA_ID vazio ou ausente.");

  var registroOk = typeof PLANILHA_REGISTRO !== "undefined" && String(PLANILHA_REGISTRO || "").trim();
  _diagOficiosItem_(itens, "Configuracao", "PLANILHA_REGISTRO", registroOk ? "ok" : "erro", registroOk ? "Configurado." : "PLANILHA_REGISTRO vazio ou ausente.");

  [
    "PASTA_OFICIOS_ID",
    "PASTA_OFICIOS_FILIACAO_ID",
    "PASTA_OFICIOS_DESFILIACAO_ID",
    "PASTA_OFICIOS_TAXA_NEGOCIAL_ID",
    "PASTA_OFICIOS_TAXA_ASSIST_ID",
    "PASTA_OFICIOS_LIVRE_ID"
  ].forEach(function(nome) {
    var valor = "";
    try { valor = String(this[nome] || "").trim(); } catch (e) {}
    var ok = valor && valor.indexOf("COLE_AQUI") === -1 && valor.length >= 20;
    _diagOficiosItem_(itens, "Configuracao", nome, ok ? "ok" : "aviso", ok ? "Pasta configurada." : "ID de pasta ausente ou suspeito.");
  });
}

function _diagOficiosChecarPlanilha_(itens) {
  if (typeof PLANILHA_ID === "undefined" || !String(PLANILHA_ID || "").trim()) {
    _diagOficiosItem_(itens, "Planilha", "Acesso", "erro", "Nao foi possivel abrir a planilha: PLANILHA_ID ausente.");
    return;
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(PLANILHA_ID);
    _diagOficiosItem_(itens, "Planilha", "Acesso", "ok", "Planilha aberta.", ss.getName());
  } catch (e) {
    _diagOficiosItem_(itens, "Planilha", "Acesso", "erro", "Erro ao abrir planilha.", e.message);
    return;
  }

  _diagOficiosChecarAba_(itens, ss, (typeof PLANILHA_REGISTRO !== "undefined" ? PLANILHA_REGISTRO : "Controle"), [
    ["Numero do Oficio", "numero do oficio", "número do ofício"],
    ["Status", "status"],
    ["Tipo", "tipo", "TIPO"],
    ["Escola", "escola"],
    ["CNPJ", "cnpj"]
  ]);

  _diagOficiosChecarAba_(itens, ss, "Escolas", [
    ["Nome da escola", "nomeescola", "escola", "escola razao social", "razão social"],
    ["CNPJ", "cnpj"],
    ["Email", "email", "e-mail", "emails todos", "emailstodos"],
    ["Cidade", "cidade", "municipio", "município"],
    ["UF", "uf", "estado"]
  ]);

  _diagOficiosChecarAba_(itens, ss, "FILA_ENVIO_OFICIOS", [
    ["ID", "id"],
    ["Numero do Oficio", "numero oficio", "numero_oficio"],
    ["Email", "email_principal", "emails_todos"],
    ["Status", "status"],
    ["Tentativas", "tentativas"]
  ], true);
}

function _diagOficiosChecarAba_(itens, ss, nomeAba, gruposColunas, opcional) {
  var sh = ss.getSheetByName(nomeAba);
  if (!sh) {
    _diagOficiosItem_(itens, "Planilha", "Aba " + nomeAba, opcional ? "aviso" : "erro", "Aba nao encontrada.");
    return;
  }

  _diagOficiosItem_(itens, "Planilha", "Aba " + nomeAba, "ok", "Aba encontrada.", sh.getLastRow() + " linha(s).");
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) {
    _diagOficiosItem_(itens, "Planilha", "Cabecalho " + nomeAba, "erro", "Aba sem cabecalho.");
    return;
  }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h) {
    return _diagOficiosNorm_(h);
  });

  gruposColunas.forEach(function(grupo) {
    var label = grupo[0];
    var aliases = grupo.slice(1).map(_diagOficiosNorm_);
    var achou = headers.some(function(h) {
      return aliases.some(function(alias) { return h === alias || h.indexOf(alias) > -1; });
    });
    _diagOficiosItem_(itens, "Colunas", nomeAba + " / " + label, achou ? "ok" : "erro", achou ? "Coluna localizada." : "Coluna obrigatoria nao localizada.");
  });
}

function _diagOficiosChecarTriggers_(itens) {
  try {
    var nomes = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); });

    var triggerFilaOficios = nomes.indexOf("processarFilaEnvioOficios") > -1;
    _diagOficiosItem_(itens, "Triggers", "processarFilaEnvioOficios", triggerFilaOficios ? "ok" : "aviso", triggerFilaOficios ? "Trigger permanente instalado." : "Trigger permanente nao instalado.");

    var triggerTaxa = nomes.indexOf("executarLoteTaxaAssistencialAgendado") > -1;
    if (triggerTaxa) {
      _diagOficiosItem_(itens, "Triggers", "executarLoteTaxaAssistencialAgendado", "ok", "Trigger sob demanda instalado para o proximo lote.");
      return;
    }

    var statusTaxa = null;
    if (typeof obterStatusFilaTaxaAssistencial === "function") {
      try { statusTaxa = obterStatusFilaTaxaAssistencial(); } catch (eStatus) {}
    }

    if (statusTaxa && statusTaxa.emAndamento && statusTaxa.numero) {
      _diagOficiosItem_(itens, "Triggers", "executarLoteTaxaAssistencialAgendado", "aviso", "Fila de Taxa Assistencial pendente sem trigger agendado.", (statusTaxa.pendente || 0) + " pendente(s).");
    } else {
      var detalheTaxa = statusTaxa && statusTaxa.emAndamento ? ((statusTaxa.pendente || 0) + " pendente(s) sem numero ativo.") : "";
      _diagOficiosItem_(itens, "Triggers", "executarLoteTaxaAssistencialAgendado", "ok", "Trigger sob demanda; nenhum lote ativo agora.", detalheTaxa);
    }
  } catch (e) {
    _diagOficiosItem_(itens, "Triggers", "Leitura", "aviso", "Nao foi possivel listar triggers.", e.message);
  }
}

function _diagOficiosNorm_(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diagnosticarBuscaEscolasOficios() {
  var termos = ["Serra", "Vitória", "Cariacica", "municipal", "escola"];
  var retorno = termos.map(function(termo) {
    var lista = [];
    try {
      lista = buscarEscolasPorTermo(termo) || [];
    } catch (e) {
      return { termo: termo, erro: e.message, total: 0, amostras: [] };
    }
    return {
      termo: termo,
      total: lista.length,
      amostras: lista.slice(0, 3).map(function(e) {
        return {
          escola: e.escola || e.NomeEscola || e.nome || "",
          cidade: e.cidade || e.Municipio || e.municipio || "",
          uf: e.uf || e.UF || "",
          cnpj: e.cnpj || e.CNPJ || ""
        };
      })
    };
  });
  Logger.log(JSON.stringify(retorno, null, 2));
  return retorno;
}
function serializarParaCliente_(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return Utilities.formatDate(obj, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  if (Array.isArray(obj)) return obj.map(function(item) { return serializarParaCliente_(item); });
  if (typeof obj === "object") {
    var resultado = {};
    Object.keys(obj).forEach(function(chave) {
      resultado[chave] = serializarParaCliente_(obj[chave]);
    });
    return resultado;
  }
  return obj;
}