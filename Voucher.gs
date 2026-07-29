// =============================================================================
// ARQUIVO: Voucher.gs
// Núcleo do módulo de Bolsas/Voucher
// Mantém helpers, setup, regras, escolas, documentos, listagens e dashboard
// =============================================================================

/* ================= CONFIG ================= */
const PASTA_VOUCHER_DOCUMENTOS_ID = "1PyMA0bm0FZuyYONlY4dNNo3pgJRiI63n";

const LOGO_VOUCHER        = "https://lh3.googleusercontent.com/d/1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7";
const PRESIDENTE_VOUCHER  = "Leonil Dias da Silva";
const CARGO_PRESIDENTE_V  = "Presidente Sindeducação-ES";
const ENDERECO_SIND_V     = "AV. NOSSA SENHORA DOS NAVEGANTES, 755, ED PALÁCIO DA PRAIA S 707, ENSEADA DO SUÁ, VITÓRIA, ES";
const TELEFONE_SIND_V     = "Tel.: 27 3222-2706 / 27 3223-8866";
const SITE_SIND_V         = "www.sindeducacao.com · secretaria@sindeducacao.com";
const CCT_TEXTO_V         = "Convenção Coletiva de Trabalho 2026/2027";
const CCT_CLAUSULA_V      = "Cláusula 5ª, § 4º";

/* ================= HELPERS GERAIS ================= */

function normalizarCPF_(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

function formatarCpfVoucher_(cpf) {
  const d = normalizarCPF_(cpf);
  if (d.length !== 11) return String(cpf || "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizarTextoVoucher_(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function calcularIdade_(dataNascimento) {
  if (!dataNascimento) return "";

  const data = new Date(dataNascimento);
  if (isNaN(data.getTime())) return "";

  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const mes = hoje.getMonth() - data.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < data.getDate())) {
    idade--;
  }

  return idade;
}

function gerarIdPadrao_(prefixo) {
  const data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const aleatorio = Math.floor(Math.random() * 900 + 100);
  return prefixo + "_" + data + "_" + aleatorio;
}

function gerarNumeroProtocolo_() {
  const ano = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
  const aleatorio = Math.floor(Math.random() * 900000 + 100000);
  return "BOLSA-" + ano + "-" + aleatorio;
}

function gerarCodigoValidacaoVoucher_() {
  return "VAL-" +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss") +
    "-" +
    Math.floor(Math.random() * 9000 + 1000);
}

function formatDateInput_(valor) {
  if (!valor) return "";

  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const txt = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const p = txt.split("/");
    return p[2] + "-" + p[1] + "-" + p[0];
  }

  const data = new Date(txt);
  if (isNaN(data.getTime())) return "";

  return Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatarDataBrVoucher_(data) {
  if (!data) return "";

  const dt = Object.prototype.toString.call(data) === "[object Date]" ? data : new Date(data);
  if (isNaN(dt.getTime())) return "";

  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarDataHoraBrVoucher_(data) {
  if (!data) return "";

  const dt = Object.prototype.toString.call(data) === "[object Date]" ? data : new Date(data);
  if (isNaN(dt.getTime())) return "";

  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}

function timestampSeguroVoucher_(valor) {
  if (!valor) return 0;

  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return isNaN(valor.getTime()) ? 0 : valor.getTime();
  }

  const dt = new Date(valor);
  return isNaN(dt.getTime()) ? 0 : dt.getTime();
}

function valorSeguroVoucher_(valor) {
  return String(valor || "").trim();
}

function inferirTipoDocumentoVinculo_(payload) {
  const informado = String(payload && payload.tipoDocumentoVinculo || "").trim().toUpperCase();

  if (informado) return informado;
  if (payload && payload.contracheque && payload.contracheque.base64) return "CONTRACHEQUE";

  return "DECLARACAO_RH";
}

function sanitizarNomeArquivoVoucher_(nome) {
  return String(nome || "arquivo")
    .replace(/[\\\/:*?"<>|#%{}~]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function obterUsuarioAtualVoucher_() {
  try {
    if (typeof getSessaoUsuario === "function") {
      const sessao = getSessaoUsuario();
      if (sessao && (sessao.nome || sessao.usuario)) {
        return sessao.nome || sessao.usuario;
      }
    }
  } catch(e) {}

  try {
    return Session.getActiveUser().getEmail() || "SISTEMA";
  } catch(e) {
    return "SISTEMA";
  }
}

function percentualPorExtensoVoucher_(n) {
  const mapa = {
    100: "cem por cento",
    90: "noventa por cento",
    80: "oitenta por cento",
    70: "setenta por cento",
    60: "sessenta por cento",
    50: "cinquenta por cento",
    40: "quarenta por cento",
    30: "trinta por cento"
  };

  return mapa[n] || n + " por cento";
}

function dataExtensoVoucher_(data) {
  if (!data) data = new Date();

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const dt = data instanceof Date ? data : new Date(data);

  return "Vitória/ES, " +
    String(dt.getDate()).padStart(2, "0") +
    " de " +
    meses[dt.getMonth()] +
    " de " +
    dt.getFullYear() +
    ".";
}

function escHtmlVoucher_(t) {
  return String(t || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* ================= HELPERS SHEETS ================= */

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeaders_(sheet, headers) {
  const currentLastCol = Math.max(sheet.getLastColumn(), headers.length, 1);
  const existing = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0];
  const hasContent = existing.some(function(v) {
    return String(v).trim() !== "";
  });

  if (!hasContent) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const existingHeaders = existing.map(function(v) {
    return String(v).trim();
  });

  headers.forEach(function(header, idx) {
    if (existingHeaders.indexOf(header) === -1) {
      sheet.getRange(1, idx + 1).setValue(header);
    }
  });
}

function formatHeader_(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight("bold")
    .setBackground("#d9eaf7")
    .setHorizontalAlignment("center");
}

function autoResizeSafe_(sheet, numCols) {
  for (let i = 1; i <= numCols; i++) {
    try {
      sheet.autoResizeColumn(i);
    } catch(e) {}
  }
}

function obterHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function mapRowToObject_(headers, row) {
  const obj = {};

  headers.forEach(function(h, i) {
    obj[h] = row[i];
  });

  return obj;
}

/* ================= SETUP ================= */

function setupVoucherModuleFase1() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  const sheets = [
    {
      name: "Voucher_Cadastros",
      headers: [
        "ID_CADASTRO",
        "DATA_CADASTRO",
        "DATA_ULTIMA_ATUALIZACAO",
        "CPF",
        "NOME",
        "DATA_NASCIMENTO",
        "IDADE",
        "TELEFONE",
        "EMAIL",
        "ENDERECO",
        "ESCOLA_ATUAL",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        "CARGO_FUNCAO",
        "SITUACAO_VINCULO",
        "SITUACAO_SINDICAL",
        "ORIGEM_CADASTRO",
        "STATUS_CADASTRO",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Solicitacoes",
      headers: [
        "ID_SOLICITACAO",
        "DATA_SOLICITACAO",
        "DATA_SOLICITACAO_TEXTO",
        "CPF_SOLICITANTE",
        "NOME_SOLICITANTE",
        "EMAIL",
        "TELEFONE",
        "ESCOLA_SELECIONADA",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        "SITUACAO_SINDICAL",
        "STATUS_VALIDACAO_SINDICAL",
        "TIPO_BENEFICIARIO",
        "NOME_BENEFICIARIO",
        "DATA_NASCIMENTO_BENEFICIARIO",
        "IDADE_BENEFICIARIO",
        "NOME_TITULAR_ASSOCIADO",
        "PARENTESCO",
        "ENTEADO_DECLARADO_IR",
        "MODALIDADE",
        "CURSO",
        "AREA_CURSO",
        "ORDEM_FILHO",
        "REGIME",
        "PERIODO_REFERENCIA",
        "PERCENTUAL_APLICADO",
        "TIPO_DOCUMENTO_VINCULO",
        "LINK_CONTRACHEQUE",
        "LINK_DOC_PESSOAL",
        "STATUS_SOLICITACAO",
        "CANAL_ENTRADA",
        "USUARIO_CADASTRO",
        "USUARIO_VALIDACAO",
        "DATA_VALIDACAO",
        "DATA_EMISSAO",
        "OBSERVACOES",
        "NUMERO_PROTOCOLO"
      ]
    },
    {
      name: "Voucher_Protocolos",
      headers: [
        "NUMERO_PROTOCOLO",
        "DATA_GERACAO",
        "ID_SOLICITACAO",
        "CPF",
        "NOME",
        "ESCOLA",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        "STATUS_PROTOCOLO",
        "RESPONSAVEL",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Emitidos",
      headers: [
        "ID_EMISSAO",
        "DATA_EMISSAO",
        "PROTOCOLO",
        "ID_SOLICITACAO",
        "NOME_SOLICITANTE",
        "CPF",
        "ESCOLA",
        "TIPO_DOCUMENTO",
        "CODIGO_VALIDACAO",
        "LINK_ARQUIVO",
        "PERCENTUAL",
        "USUARIO"
      ]
    },
    {
      name: "Voucher_Historico",
      headers: [
        "ID_EVENTO",
        "DATA_HORA",
        "ID_SOLICITACAO",
        "NUMERO_PROTOCOLO",
        "CPF",
        "NOME",
        "ACAO",
        "USUARIO_RESPONSAVEL",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Documentos",
      headers: [
        "ID_DOCUMENTO",
        "ID_SOLICITACAO",
        "CPF",
        "TIPO_DOCUMENTO",
        "NOME_ARQUIVO",
        "LINK_ARQUIVO",
        "ID_ARQUIVO_DRIVE",
        "DATA_ENVIO",
        "VALIDADO",
        "VALIDADOR",
        "DATA_VALIDACAO",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Regras",
      headers: [
        "ID_REGRA",
        "TIPO_REGRA",
        "MODALIDADE",
        "AREA_CURSO",
        "ORDEM_FILHO",
        "TIPO_BENEFICIARIO",
        "IDADE_MAXIMA",
        "PERCENTUAL",
        "REGIME",
        "ATIVO",
        "OBSERVACOES"
      ]
    }
  ];

  sheets.forEach(function(def) {
    const sh = getOrCreateSheet_(ss, def.name);
    ensureHeaders_(sh, def.headers);
    formatHeader_(sh, def.headers.length);
    sh.setFrozenRows(1);
    autoResizeSafe_(sh, def.headers.length);
  });

  seedVoucherRules_();

  Logger.log("Estrutura do módulo Voucher criada com sucesso!");

  return {
    ok: true,
    mensagem: "Módulo Voucher inicializado."
  };
}

/* ================= REGRAS BASE ================= */

function seedVoucherRules_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Regras");

  if (!sh) return;

  const existingData = sh.getDataRange().getValues();

  if (existingData.length > 1) return;

  const rows = [
    ["REG001","PERCENTUAL_POR_ORDEM","EDUCACAO_INFANTIL","","1","FILHO","24","100","ANUAL","SIM","1º filho"],
    ["REG002","PERCENTUAL_POR_ORDEM","EDUCACAO_INFANTIL","","2","FILHO","24","100","ANUAL","SIM","2º filho"],
    ["REG003","PERCENTUAL_POR_ORDEM","EDUCACAO_INFANTIL","","3","FILHO","24","60","ANUAL","SIM","3º filho"],
    ["REG004","PERCENTUAL_POR_ORDEM","CRECHE","","1","FILHO","24","100","ANUAL","SIM","1º filho"],
    ["REG005","PERCENTUAL_POR_ORDEM","CRECHE","","2","FILHO","24","100","ANUAL","SIM","2º filho"],
    ["REG006","PERCENTUAL_POR_ORDEM","CRECHE","","3","FILHO","24","60","ANUAL","SIM","3º filho"],
    ["REG007","PERCENTUAL_POR_ORDEM","ENSINO_FUNDAMENTAL","","1","FILHO","24","100","ANUAL","SIM","1º filho"],
    ["REG008","PERCENTUAL_POR_ORDEM","ENSINO_FUNDAMENTAL","","2","FILHO","24","100","ANUAL","SIM","2º filho"],
    ["REG009","PERCENTUAL_POR_ORDEM","ENSINO_FUNDAMENTAL","","3","FILHO","24","60","ANUAL","SIM","3º filho"],
    ["REG010","PERCENTUAL_POR_ORDEM","TECNICO","","1","FILHO","24","100","ANUAL","SIM","1º filho"],
    ["REG011","PERCENTUAL_POR_ORDEM","TECNICO","","2","FILHO","24","100","ANUAL","SIM","2º filho"],
    ["REG012","PERCENTUAL_POR_ORDEM","TECNICO","","3","FILHO","24","60","ANUAL","SIM","3º filho"],
    ["REG013","PERCENTUAL_POR_AREA","GRADUACAO","ENGENHARIA","","TITULAR","","60","SEMESTRAL","SIM","Graduação Engenharia"],
    ["REG014","PERCENTUAL_POR_AREA","GRADUACAO","HUMANAS","","TITULAR","","70","SEMESTRAL","SIM","Graduação Humanas"],
    ["REG015","PERCENTUAL_POR_AREA","GRADUACAO","SAUDE","","TITULAR","","50","SEMESTRAL","SIM","Graduação Saúde"],
    ["REG016","PERCENTUAL_POR_AREA","GRADUACAO","ENGENHARIA","","CONJUGE","","60","SEMESTRAL","SIM","Graduação Engenharia"],
    ["REG017","PERCENTUAL_POR_AREA","GRADUACAO","HUMANAS","","CONJUGE","","70","SEMESTRAL","SIM","Graduação Humanas"],
    ["REG018","PERCENTUAL_POR_AREA","GRADUACAO","SAUDE","","CONJUGE","","50","SEMESTRAL","SIM","Graduação Saúde"],
    ["REG019","PERCENTUAL_POR_AREA","GRADUACAO","ENGENHARIA","","ENTEADO","24","60","SEMESTRAL","SIM","Graduação Engenharia"],
    ["REG020","PERCENTUAL_POR_AREA","GRADUACAO","HUMANAS","","ENTEADO","24","70","SEMESTRAL","SIM","Graduação Humanas"],
    ["REG021","PERCENTUAL_POR_AREA","GRADUACAO","SAUDE","","ENTEADO","24","50","SEMESTRAL","SIM","Graduação Saúde"],
    ["REG022","PERCENTUAL_FIXO","POS_GRADUACAO","","","TITULAR","","70","ANUAL","SIM","Pós-graduação"],
    ["REG023","PERCENTUAL_FIXO","POS_GRADUACAO","","","CONJUGE","","70","ANUAL","SIM","Pós-graduação"],
    ["REG024","PERCENTUAL_FIXO","POS_GRADUACAO","","","FILHO","24","70","ANUAL","SIM","Pós-graduação"],
    ["REG025","PERCENTUAL_FIXO","POS_GRADUACAO","","","ENTEADO","24","70","ANUAL","SIM","Pós-graduação"]
  ];

  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  autoResizeSafe_(sh, sh.getLastColumn());
}

/* ================= REGRAS DE NEGÓCIO ================= */

function calcularRegraVoucher_(dados, idadeBeneficiario) {
  const modalidade       = String(dados.modalidade || "").trim().toUpperCase();
  const areaCurso        = String(dados.areaCurso || "").trim().toUpperCase();
  const tipoBeneficiario = String(dados.tipoBeneficiario || "").trim().toUpperCase();
  const ordemFilho       = String(dados.ordemFilho || "").trim();
  const enteadoIR        = String(dados.enteadoDeclaradoIR || "").trim().toUpperCase();

  if (tipoBeneficiario === "FILHO" && (idadeBeneficiario === "" || Number(idadeBeneficiario) >= 24)) {
    return {
      apto: false,
      percentual: "",
      regime: "",
      observacao: "Beneficiário filho não atende ao limite etário (até 24 anos)."
    };
  }

  if (tipoBeneficiario === "ENTEADO") {
    if (idadeBeneficiario === "" || Number(idadeBeneficiario) >= 24) {
      return {
        apto: false,
        percentual: "",
        regime: "",
        observacao: "Beneficiário enteado não atende ao limite etário (até 24 anos)."
      };
    }

    if (enteadoIR !== "SIM") {
      return {
        apto: false,
        percentual: "",
        regime: "",
        observacao: "Enteado exige comprovação em declaração de Imposto de Renda."
      };
    }
  }

  if (["EDUCACAO_INFANTIL", "CRECHE", "ENSINO_FUNDAMENTAL", "TECNICO"].indexOf(modalidade) > -1) {
    let percentual = "";

    if (ordemFilho === "1" || ordemFilho === "2") percentual = "100";
    if (ordemFilho === "3") percentual = "60";

    if (!percentual) {
      return {
        apto: false,
        percentual: "",
        regime: "ANUAL",
        observacao: "Ordem do filho inválida para a modalidade informada."
      };
    }

    return {
      apto: true,
      percentual: percentual,
      regime: "ANUAL",
      observacao: "Solicitação enquadrada por ordem do filho."
    };
  }

  if (modalidade === "GRADUACAO") {
    let percentualGrad = "";

    if (areaCurso === "ENGENHARIA") percentualGrad = "60";
    if (areaCurso === "HUMANAS")    percentualGrad = "70";
    if (areaCurso === "SAUDE")      percentualGrad = "50";

    if (!percentualGrad) {
      return {
        apto: false,
        percentual: "",
        regime: "SEMESTRAL",
        observacao: "Área do curso inválida para graduação."
      };
    }

    return {
      apto: true,
      percentual: percentualGrad,
      regime: "SEMESTRAL",
      observacao: "Solicitação enquadrada por área do curso."
    };
  }

  if (modalidade === "POS_GRADUACAO") {
    return {
      apto: true,
      percentual: "70",
      regime: "ANUAL",
      observacao: "Solicitação enquadrada como pós-graduação."
    };
  }

  if (tipoBeneficiario === "TITULAR") {
    return {
      apto: true,
      percentual: "100",
      regime: "ANUAL",
      observacao: "Titular — desconto integral."
    };
  }

  return {
    apto: false,
    percentual: "",
    regime: "",
    observacao: "Modalidade não reconhecida nas regras do voucher."
  };
}

/* ================= ESCOLAS ================= */

function buscarEscolaPorNome_(nomeEscola) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Escolas");

    if (!sh || !nomeEscola) {
      return {
        unidade: "",
        escola: nomeEscola || "",
        cnpj: "",
        cidade: ""
      };
    }

    const dados = sh.getDataRange().getValues();

    if (dados.length < 2) {
      return {
        unidade: "",
        escola: nomeEscola,
        cnpj: "",
        cidade: ""
      };
    }

    const headers = dados[0].map(function(h) {
      return String(h).trim();
    });

    function findCol() {
      for (let i = 0; i < arguments.length; i++) {
        const idx = headers.indexOf(arguments[i]);
        if (idx > -1) return idx;
      }
      return -1;
    }

    const idxUnidade = findCol("Unidade", "CodigoInterno", "Campus");
    const idxEscola  = findCol("NomeEscola", "Escola (Razão Social)", "Escola");
    const idxCnpj    = findCol("CNPJ");
    const idxCidade  = findCol("Municipio", "Município", "Cidade");

    if (idxEscola === -1) {
      return {
        unidade: "",
        escola: nomeEscola,
        cnpj: "",
        cidade: ""
      };
    }

    const busca = normalizarTextoVoucher_(nomeEscola);

    for (let i = 1; i < dados.length; i++) {
      const nome = normalizarTextoVoucher_(dados[i][idxEscola]);

      if (nome === busca || nome.indexOf(busca) > -1 || busca.indexOf(nome) > -1) {
        return {
          escola:  String(dados[i][idxEscola] || "").trim(),
          unidade: idxUnidade > -1 ? String(dados[i][idxUnidade] || "") : "",
          cnpj:    idxCnpj > -1 ? String(dados[i][idxCnpj] || "") : "",
          cidade:  idxCidade > -1 ? String(dados[i][idxCidade] || "") : ""
        };
      }
    }

    return {
      unidade: "",
      escola: nomeEscola,
      cnpj: "",
      cidade: ""
    };

  } catch(e) {
    return {
      unidade: "",
      escola: nomeEscola || "",
      cnpj: "",
      cidade: ""
    };
  }
}

function listarEscolasVoucher_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Escolas");

  if (!sh || sh.getLastRow() < 2) return [];

  const dados = sh.getDataRange().getValues();
  const headers = dados[0].map(function(h) {
    return String(h).trim();
  });

  function findCol() {
    for (let i = 0; i < arguments.length; i++) {
      const idx = headers.indexOf(arguments[i]);
      if (idx > -1) return idx;
    }
    return -1;
  }

  const idxEscola  = findCol("NomeEscola", "Escola (Razão Social)", "Escola");
  const idxUnidade = findCol("Unidade", "CodigoInterno");
  const idxCnpj    = findCol("CNPJ");
  const idxCidade  = findCol("Municipio", "Município", "Cidade");

  if (idxEscola === -1) return [];

  const vistas = new Set();

  return dados.slice(1)
    .map(function(linha) {
      return {
        escola:  String(linha[idxEscola] || "").trim(),
        unidade: idxUnidade > -1 ? String(linha[idxUnidade] || "").trim() : "",
        cnpj:    idxCnpj > -1 ? String(linha[idxCnpj] || "").trim() : "",
        cidade:  idxCidade > -1 ? String(linha[idxCidade] || "").trim() : ""
      };
    })
    .filter(function(item) {
      if (!item.escola || vistas.has(item.escola)) return false;
      vistas.add(item.escola);
      return true;
    })
    .sort(function(a, b) {
      return a.escola.localeCompare(b.escola, "pt-BR");
    });
}

/* ================= HISTÓRICO ================= */

function registrarHistoricoVoucher_(idSolicitacao, cpf, acao, usuario, observacoes, protocolo) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Historico");

    if (!sh) return;

    sh.appendRow([
      gerarIdPadrao_("HIS"),
      new Date(),
      idSolicitacao || "",
      protocolo || "",
      cpf || "",
      "",
      acao || "",
      usuario || obterUsuarioAtualVoucher_(),
      observacoes || ""
    ]);

  } catch(e) {
    Logger.log("registrarHistoricoVoucher_ erro: " + e.message);
  }
}

/* ================= DOCUMENTOS NO DRIVE ================= */

function obterPastaVoucherDocumentos_() {
  const pastaId = String(PASTA_VOUCHER_DOCUMENTOS_ID || "").trim();

  if (!pastaId) {
    throw new Error("Pasta de documentos do Voucher não configurada.");
  }

  return DriveApp.getFolderById(pastaId);
}

function salvarDocumentoVoucher_(idSolicitacao, cpf, arquivo, tipoDocumento, observacoes, nomeSolicitante) {
  if (!arquivo || !arquivo.base64) return null;

  try {
    const pasta = obterPastaVoucherDocumentos_();
    const nomeOriginal = sanitizarNomeArquivoVoucher_(arquivo.nome || (tipoDocumento + ".bin"));
    const nomePessoa = sanitizarNomeArquivoVoucher_(nomeSolicitante || cpf);
    const nomeFinal = [
      "Voucher",
      nomePessoa,
      String(tipoDocumento || "").toUpperCase(),
      cpf,
      idSolicitacao,
      nomeOriginal
    ].join(" - ");

    const bytes = Utilities.base64Decode(arquivo.base64);
    const blob = Utilities.newBlob(bytes, arquivo.tipo || MimeType.PDF, nomeFinal);
    const file = pasta.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Documentos");

    if (sh) {
      sh.appendRow([
        gerarIdPadrao_("DOC"),
        idSolicitacao,
        cpf,
        String(tipoDocumento || "").toUpperCase(),
        nomeOriginal,
        file.getUrl(),
        file.getId(),
        new Date(),
        "NAO",
        "",
        "",
        observacoes || ""
      ]);
    }

    registrarHistoricoVoucher_(
      idSolicitacao,
      cpf,
      "DOCUMENTO_ENVIADO",
      "SISTEMA",
      "Documento: " + String(tipoDocumento || "").toUpperCase()
    );

    return {
      idArquivo: file.getId(),
      nomeArquivo: nomeOriginal,
      linkArquivo: file.getUrl(),
      tipoDocumento: String(tipoDocumento || "").toUpperCase()
    };

  } catch(e) {
    Logger.log("salvarDocumentoVoucher_ erro: " + e.message);
    return null;
  }
}

function registrarDocumentosPayloadVoucher_(idSolicitacao, cpf, payload) {
  const documentos = [];
  const tipoVinculo = inferirTipoDocumentoVinculo_(payload);
  const nomeSolicitante = valorSeguroVoucher_(payload && payload.nome);

  if (payload && payload.contracheque && payload.contracheque.base64) {
    const doc = salvarDocumentoVoucher_(
      idSolicitacao,
      cpf,
      payload.contracheque,
      tipoVinculo,
      "Documento de vínculo.",
      nomeSolicitante
    );

    if (doc) documentos.push(doc);
  }

  if (payload && payload.docPessoal && payload.docPessoal.base64) {
    const doc = salvarDocumentoVoucher_(
      idSolicitacao,
      cpf,
      payload.docPessoal,
      "DOCUMENTO_PESSOAL",
      "Documento pessoal.",
      nomeSolicitante
    );

    if (doc) documentos.push(doc);
  }

  return documentos;
}

/* ================= BUSCA INTERNA ================= */

function buscarSolicitacaoPorId_(idSolicitacao) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");

  if (!sh || sh.getLastRow() < 2) return null;

  const headers = obterHeaders_(sh);
  const idxId = headers.indexOf("ID_SOLICITACAO");
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idxId] || "") === String(idSolicitacao || "")) {
      return {
        linha: i + 2,
        headers: headers,
        registro: mapRowToObject_(headers, dados[i])
      };
    }
  }

  return null;
}

function buscarSolicitacaoPorProtocolo_(protocolo) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");

  if (!sh || sh.getLastRow() < 2) return null;

  const headers = obterHeaders_(sh);
  const idxProt = headers.indexOf("NUMERO_PROTOCOLO");
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idxProt] || "") === String(protocolo || "")) {
      return {
        linha: i + 2,
        headers: headers,
        registro: mapRowToObject_(headers, dados[i])
      };
    }
  }

  return null;
}

/* ================= PORTAL — DADOS INICIAIS ================= */

function getPortalVoucherInitData() {
  return {
    escolas: listarEscolasVoucher_(),
    modalidades: [
      { value: "EDUCACAO_INFANTIL",  label: "Educação Infantil (4–5 anos)" },
      { value: "CRECHE",             label: "Creche (0–3 anos)" },
      { value: "ENSINO_FUNDAMENTAL", label: "Ensino Fundamental (6–14 anos)" },
      { value: "ENSINO_MEDIO",       label: "Ensino Médio (15–17 anos)" },
      { value: "TECNICO",            label: "Técnico (15–25 anos)" },
      { value: "GRADUACAO",          label: "Graduação" },
      { value: "POS_GRADUACAO",      label: "Pós-Graduação" }
    ],
    areas: [
      { value: "ENGENHARIA", label: "Engenharia e Tecnologia" },
      { value: "HUMANAS",    label: "Ciências Humanas e Sociais" },
      { value: "SAUDE",      label: "Ciências Biológicas e da Saúde" }
    ],
    beneficiarios: [
      { value: "TITULAR", label: "Titular (eu mesmo)" },
      { value: "CONJUGE", label: "Cônjuge / Companheiro(a)" },
      { value: "FILHO",   label: "Filho(a)" },
      { value: "ENTEADO", label: "Enteado(a)" }
    ],
    parentescos: [
      { value: "TITULAR",     label: "Titular" },
      { value: "CONJUGE",     label: "Cônjuge" },
      { value: "COMPANHEIRO", label: "Companheiro(a)" },
      { value: "FILHO",       label: "Filho(a)" },
      { value: "ENTEADO",     label: "Enteado(a)" }
    ]
  };
}

/* ================= PORTAL ANTIGO — COMPATIBILIDADE ================= */

function salvarSolicitacaoCertBolsa(dados) {
  dados = dados || {};

  function mapBeneficiario(v) {
    v = String(v || "").toLowerCase().trim();

    if (v === "filho") return "FILHO";
    if (v === "titular") return "TITULAR";
    if (v === "conjuge" || v === "cônjuge") return "CONJUGE";
    if (v === "enteado") return "ENTEADO";

    return String(v || "TITULAR").toUpperCase();
  }

  function mapModalidade(v) {
    v = String(v || "").toLowerCase().trim();

    const mapa = {
      creche: "CRECHE",
      infantil: "EDUCACAO_INFANTIL",
      fundamental: "ENSINO_FUNDAMENTAL",
      medio: "ENSINO_MEDIO",
      técnico: "TECNICO",
      tecnico: "TECNICO",
      prevestibular: "ENSINO_MEDIO",
      graduacao: "GRADUACAO",
      graduação: "GRADUACAO",
      posgraduacao: "POS_GRADUACAO",
      "pós-graduação": "POS_GRADUACAO",
      pos_graduacao: "POS_GRADUACAO"
    };

    return mapa[v] || String(v || "").toUpperCase();
  }

  function mapArea(v) {
    v = String(v || "").toLowerCase().trim();

    const mapa = {
      humanas: "HUMANAS",
      engenharia: "ENGENHARIA",
      saude: "SAUDE",
      saúde: "SAUDE"
    };

    return mapa[v] || String(v || "").toUpperCase();
  }

  const tipoBeneficiario = mapBeneficiario(dados.beneficiario || dados.tipoBeneficiario);
  const modalidade = mapModalidade(dados.nivel || dados.modalidade);

  const payload = {
    cpf: dados.cpf,
    nome: dados.nome,
    dataNascimento: dados.dataNascimento || "",
    email: dados.email,
    telefone: dados.telefone,
    cep: dados.cep,
    endereco: dados.endereco,

    escolaAtual: dados.escola || dados.escolaAtual,
    cargoFuncao: dados.cargoFuncao || "",
    situacaoVinculo: dados.situacaoVinculo || "",

    situacaoSindicalDeclarada: dados.situacaoSindicalDeclarada || "PENDENTE_VALIDACAO",

    tipoBeneficiario: tipoBeneficiario,
    nomeBeneficiario: tipoBeneficiario === "TITULAR"
      ? dados.nome
      : (dados.nomeFilho || dados.nomeBeneficiario || ""),

    dataNascimentoBeneficiario: dados.dataNascimentoBeneficiario || "",
    nomeTitularAssociado: dados.nome,
    parentesco: tipoBeneficiario,
    enteadoDeclaradoIR: "NAO",

    modalidade: modalidade,
    curso: dados.curso,
    areaCurso: mapArea(dados.area || dados.areaCurso),
    ordemFilho: dados.ordemFilho || "",
    periodoReferencia: dados.periodoReferencia || dados.data || "",

    contracheque: dados.contracheque,
    docPessoal: dados.docPessoal
  };

  const resp = salvarCadastroESolicitacaoVoucher(payload);

  if (resp && resp.ok && resp.protocolo && resp.protocolo.numeroProtocolo) {
    resp.protocolo = resp.protocolo.numeroProtocolo;
  }

  return resp;
}

/* ================= LISTAGEM (PAINEL ADMIN) ================= */

function listarSolicitacoesVoucher() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Solicitacoes");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh).map(function(h) {
      return String(h || "").trim();
    });

    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx() {
      for (let i = 0; i < arguments.length; i++) {
        const nome = String(arguments[i] || "").trim();
        const pos = headers.indexOf(nome);

        if (pos > -1) return pos;
      }

      return -1;
    }

    function val(linha) {
      for (let i = 1; i < arguments.length; i++) {
        const pos = idx(arguments[i]);

        if (
          pos > -1 &&
          linha[pos] !== undefined &&
          linha[pos] !== null &&
          String(linha[pos]).trim() !== ""
        ) {
          return linha[pos];
        }
      }

      return "";
    }

    return dados.map(function(l) {
      const dataSolicitacao = val(l, "DATA_SOLICITACAO");
      const dataTexto = val(l, "DATA_SOLICITACAO_TEXTO");

      return {
        id: String(val(l, "ID_SOLICITACAO", "ID", "ID_SOL", "SOLICITACAO_ID") || ""),
        protocolo: String(val(l, "NUMERO_PROTOCOLO", "PROTOCOLO", "Nº PROTOCOLO", "NUMERO DO PROTOCOLO", "NÚMERO_PROTOCOLO") || ""),
        nome: String(val(l, "NOME_SOLICITANTE", "NOME", "NOME COMPLETO", "SOLICITANTE", "NOME_ASSOCIADO") || ""),
        cpf: String(val(l, "CPF_SOLICITANTE", "CPF", "CPF_ASSOCIADO", "DOCUMENTO") || ""),

        email: String(val(l, "EMAIL", "E-MAIL", "E_MAIL") || ""),
        telefone: String(val(l, "TELEFONE", "WHATSAPP", "CELULAR") || ""),
        escola: String(val(l, "ESCOLA_SELECIONADA", "ESCOLA", "ESCOLA_ATUAL", "INSTITUICAO") || ""),
        cnpjEscola: String(val(l, "CNPJ_ESCOLA", "CNPJ") || ""),

        situacaoSindicalDeclarada: String(val(l, "SITUACAO_SINDICAL", "SITUAÇÃO_SINDICAL", "SITUACAO SINDICAL") || ""),
        statusValidacaoSindical: String(val(l, "STATUS_VALIDACAO_SINDICAL", "STATUS_VALIDAÇÃO_SINDICAL", "VALIDACAO_SINDICAL") || ""),

        tipoBeneficiario: String(val(l, "TIPO_BENEFICIARIO", "BENEFICIARIO", "TIPO BENEFICIÁRIO") || ""),
        nomeBeneficiario: String(val(l, "NOME_BENEFICIARIO", "NOME DO BENEFICIARIO", "NOME_BENEF") || ""),

        nivel: String(val(l, "MODALIDADE", "NIVEL", "NÍVEL") || ""),
        modalidade: String(val(l, "MODALIDADE", "NIVEL", "NÍVEL") || ""),
        curso: String(val(l, "CURSO") || ""),
        areaCurso: String(val(l, "AREA_CURSO", "ÁREA_CURSO", "AREA", "ÁREA") || ""),
        ordemFilho: String(val(l, "ORDEM_FILHO", "ORDEM DO FILHO") || ""),
        periodoReferencia: String(val(l, "PERIODO_REFERENCIA", "PERÍODO_REFERENCIA", "PERIODO", "PERÍODO") || ""),
        percentual: String(val(l, "PERCENTUAL_APLICADO", "PERCENTUAL", "% DESCONTO", "DESCONTO") || ""),
        regime: String(val(l, "REGIME") || ""),

        status: String(val(l, "STATUS_SOLICITACAO", "STATUS_SOLICITAÇÃO", "STATUS") || "PENDENTE"),
        data: String(dataTexto || formatarDataBrVoucher_(dataSolicitacao) || ""),
        observacao: String(val(l, "OBSERVACOES", "OBSERVAÇÕES", "OBS") || ""),

        linkContracheque: String(val(l, "LINK_CONTRACHEQUE", "CONTRACHEQUE", "LINK DOCUMENTO VINCULO") || ""),
        linkDocPessoal: String(val(l, "LINK_DOC_PESSOAL", "DOC_PESSOAL", "DOCUMENTO_PESSOAL") || ""),

        _ts: timestampSeguroVoucher_(dataSolicitacao)
      };
    })
    .filter(function(item) {
      return item.id || item.protocolo || item.nome || item.cpf;
    })
    .sort(function(a, b) {
      return (b._ts || 0) - (a._ts || 0);
    })
    .map(function(item) {
      delete item._ts;
      return item;
    });

  } catch(e) {
    throw new Error("Erro ao listar solicitações: " + e.message);
  }
}

function listarSolicitacoesCertBolsa() {
  return listarSolicitacoesVoucher();
}

/* ================= DASHBOARD (PAINEL ADMIN) ================= */

function dashboardVoucher() {
  try {
    setupVoucherModuleFase1();

    const lista = listarSolicitacoesVoucher();

    let total = 0;
    let pendentes = 0;
    let analise = 0;
    let aprovadas = 0;
    let emitidos = 0;
    let bloqueadas = 0;
    let validacaoCadastral = 0;
    let naoAssociados = 0;

    lista.forEach(function(s) {
      total++;

      const st = String(s.status || "").toUpperCase();

      if (st === "PENDENTE") pendentes++;
      if (st === "ANALISE") analise++;
      if (st === "APROVADO") aprovadas++;
      if (st === "EMITIDO") emitidos++;
      if (st === "BLOQUEADA_POR_REGRA") bloqueadas++;
      if (st === "AGUARDANDO_VALIDACAO_CADASTRAL") validacaoCadastral++;

      if (
        st === "INDEFERIDO_NAO_ASSOCIADO" ||
        st === "NAO_ASSOCIADO" ||
        st === "AGUARDANDO_ATENDIMENTO_PRESENCIAL"
      ) {
        naoAssociados++;
      }
    });

    const recentes = lista.slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    const pendLista = lista.filter(function(s) {
      const st = String(s.status || "").toUpperCase();
      return st === "PENDENTE" || st === "ANALISE" || st === "AGUARDANDO_VALIDACAO_CADASTRAL";
    }).slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    const aprLista = lista.filter(function(s) {
      return String(s.status || "").toUpperCase() === "APROVADO";
    }).slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    return {
      total: total,
      pendentes: pendentes + analise + validacaoCadastral,
      aprovadas: aprovadas,
      emitidos: emitidos,
      bloqueadas: bloqueadas,
      validacaoCadastral: validacaoCadastral,
      naoAssociados: naoAssociados,
      resumoRecentes: recentes.length ? recentes.join(" | ") : "Nenhuma solicitação recente.",
      resumoPendencias: pendLista.length ? pendLista.join(" | ") : "Nenhuma pendência no momento.",
      resumoAprovacoes: aprLista.length ? aprLista.join(" | ") : "Nenhuma aprovação recente."
    };

  } catch(e) {
    throw new Error("Erro ao montar dashboard: " + e.message);
  }
}

function dashboardCertBolsa() {
  return dashboardVoucher();
}

/* ================= LISTAGENS AUXILIARES ================= */

function listarProtocolosCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Protocolos");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    return dados.map(function(l) {
      return {
        protocolo: String(l[idx("NUMERO_PROTOCOLO")] || ""),
        nome: String(l[idx("NOME")] || ""),
        escola: String(l[idx("ESCOLA")] || ""),
        data: formatarDataHoraBrVoucher_(l[idx("DATA_GERACAO")]),
        situacao: String(l[idx("STATUS_PROTOCOLO")] || "PENDENTE"),
        responsavel: String(l[idx("RESPONSAVEL")] || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar protocolos: " + e.message);
  }
}

function listarHistoricoCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Historico");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    return dados.map(function(l) {
      return {
        data: formatarDataHoraBrVoucher_(l[idx("DATA_HORA")]),
        protocolo: String(l[idx("NUMERO_PROTOCOLO")] || ""),
        nome: String(l[idx("NOME")] || ""),
        movimentacao: String(l[idx("ACAO")] || ""),
        usuario: String(l[idx("USUARIO_RESPONSAVEL")] || ""),
        observacao: String(l[idx("OBSERVACOES")] || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar histórico: " + e.message);
  }
}

function listarEmitidosCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Emitidos");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    function get(linha, nomes) {
      for (let i = 0; i < nomes.length; i++) {
        const pos = idx(nomes[i]);

        if (
          pos > -1 &&
          linha[pos] !== undefined &&
          linha[pos] !== null &&
          String(linha[pos]).trim() !== ""
        ) {
          return linha[pos];
        }
      }

      return "";
    }

    return dados.map(function(l) {
      return {
        data: formatarDataHoraBrVoucher_(get(l, ["DATA_EMISSAO"])),
        protocolo: String(get(l, ["PROTOCOLO", "NUMERO_PROTOCOLO"]) || ""),
        nome: String(get(l, ["NOME_SOLICITANTE", "NOME"]) || ""),
        tipoDocumento: String(get(l, ["TIPO_DOCUMENTO"]) || ""),
        codigoValidacao: String(get(l, ["CODIGO_VALIDACAO"]) || ""),
        linkArquivo: String(get(l, ["LINK_ARQUIVO"]) || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar emitidos: " + e.message);
  }
}

/* ================= EXCLUSÃO ================= */

function excluirSolicitacaoVoucher(idSolicitacao) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Solicitacoes");

    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: false,
        mensagem: "Nenhuma solicitação encontrada."
      };
    }

    const headers = obterHeaders_(sh);
    const idxId = headers.indexOf("ID_SOLICITACAO");
    const idxProt = headers.indexOf("NUMERO_PROTOCOLO");
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    for (let i = 0; i < dados.length; i++) {
      if (String(dados[i][idxId] || "") === String(idSolicitacao || "")) {
        const protocolo = String(dados[i][idxProt] || "");

        sh.deleteRow(i + 2);

        registrarHistoricoVoucher_(
          idSolicitacao,
          "",
          "SOLICITACAO_EXCLUIDA",
          obterUsuarioAtualVoucher_(),
          "Registro excluído manualmente.",
          protocolo
        );

        return {
          ok: true,
          mensagem: "Solicitação excluída."
        };
      }
    }

    return {
      ok: false,
      mensagem: "Solicitação não encontrada."
    };

  } catch(e) {
    return {
      ok: false,
      mensagem: "Erro ao excluir: " + e.message
    };
  }
}

/* ================= INICIALIZAÇÃO PÚBLICA ================= */

function inicializarModuloCertBolsa() {
  return setupVoucherModuleFase1();
}

function inicializarModuloCert() {
  return setupVoucherModuleFase1();
}

/* ================= TESTES ================= */

function testeSetupVoucher() {
  const res = setupVoucherModuleFase1();
  Logger.log(JSON.stringify(res));
}

function testeSalvarPortalVoucher() {
  const res = salvarCadastroESolicitacaoVoucher({
    cpf: "08538104780",
    dataNascimento: "1987-01-01",
    nome: "Wanderson Nascimento Castelo",
    telefone: "(27) 99999-9999",
    email: "wanderson@teste.com",
    endereco: "Vitória/ES",
    escolaAtual: "Centro Educacional Infantil - Abc do Saber LTDA",
    cargoFuncao: "Administrativo",
    situacaoVinculo: "ATIVO",
    situacaoSindicalDeclarada: "ASSOCIADO",
    tipoBeneficiario: "FILHO",
    nomeBeneficiario: "Fulano de Tal",
    dataNascimentoBeneficiario: "2015-02-10",
    nomeTitularAssociado: "Wanderson Nascimento Castelo",
    parentesco: "FILHO",
    enteadoDeclaradoIR: "NAO",
    modalidade: "EDUCACAO_INFANTIL",
    curso: "Educação Infantil",
    areaCurso: "",
    ordemFilho: "1",
    periodoReferencia: "2026"
  });

  Logger.log(JSON.stringify(res, null, 2));
}

function testeDashboardVoucher() {
  Logger.log(JSON.stringify(dashboardVoucher(), null, 2));
}

function testeListarSolicitacoes() {
  const lista = listarSolicitacoesVoucher();

  Logger.log("Total: " + lista.length);

  if (lista.length) {
    Logger.log(JSON.stringify(lista[0], null, 2));
  }
}

function testeAprovarVoucher() {
  const lista = listarSolicitacoesVoucher();

  if (!lista.length) {
    Logger.log("Sem solicitações.");
    return;
  }

  Logger.log(JSON.stringify(
    aprovarSolicitacaoVoucher(lista[0].protocolo, "Aprovado em teste."),
    null,
    2
  ));
}

function testeGerarDocumentoVoucher() {
  const lista = listarSolicitacoesVoucher().filter(function(s) {
    return String(s.status || "").toUpperCase() === "APROVADO";
  });

  if (!lista.length) {
    Logger.log("Nenhuma solicitação aprovada.");
    return;
  }

  const res = gerarDocumentoVoucher(lista[0].protocolo, "CERTIFICADO", {
    rg: "1234567",
    percentual: 70,
    documentos: ["Carteira de Identidade", "Contra - cheque"]
  });

  Logger.log("Ok: " + res.ok);
  Logger.log("Código: " + res.codigoValidacao);
  Logger.log("Link: " + res.linkPdf);
}
