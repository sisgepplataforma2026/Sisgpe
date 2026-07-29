// =========================
// ARQUIVO: GuiasPagamento.gs
// ✅ EMAILS_CONTABILIDADE_GS centralizado — fonte única
// ✅ Validação de IDs obrigatórios antes de gerar PDF
// ✅ pdfBlob removido do retorno (não é serializável via google.script.run)
// ✅ salvarGuiaPagamento desacopla falha do histórico do registro principal
// ✅ statusVencimento recalculado dinamicamente na leitura
// ✅ cadastrarNovoPrestador usa ABA_PRESTADORES_SERVICOS (aba correta)
// ✅ LockService com tratamento de timeout explícito
// ✅ obterResumoGuiasPagamento limita leitura a 90 dias por padrão
// ✅ buscarPrestadorGuiaPagamento com limite de linhas para evitar timeout
// =========================


const ABA_GUIAS_PAGAMENTO = "Guias_Pagamento";
const ABA_HISTORICO_GUIAS = "Historico_Guias";

const TEMPLATE_GUIA_PAGAMENTO_ID = "COLE_AQUI_O_ID_DO_TEMPLATE_DA_GUIA";
const PASTA_GUIAS_PAGAMENTO_ID   = "COLE_AQUI_O_ID_DA_PASTA_DE_DESTINO";

// ✅ Fonte única de e-mails da contabilidade — usado em todo o arquivo
const EMAILS_CONTABILIDADE_GS = [
   "financeiro@sindeducacao.com"
];

// Limite de linhas varridas na busca de prestadores (evita timeout)
const MAX_ROWS_BUSCA_PRESTADOR = 2000;

const CABECALHO_GUIAS_PAGAMENTO = [
  "ID","DataHora","Data","Hora","Timestamp",
  "Prestador","Documento","DocumentoLimpo","TipoDocumento",
  "EmailPrestador","EmailContabilidade","Valor","Vencimento","StatusVencimento",
  "Descricao","TipoEnvio","Assunto","Destino",
  "Usuario","Status","Observacao","TextoGuia",
  "NumeroGuia","UrlPDF","FileIdPDF","DataEnvio","DataPagamento","UltimaAtualizacao"
];

const CABECALHO_HISTORICO_GUIAS = [
  "ID","IdGuia","DataHora","Data","Hora","Timestamp",
  "Usuario","Acao","TipoEnvio","Prestador","Documento",
  "EmailPrestador","EmailContabilidade","Valor","Vencimento",
  "Descricao","Assunto","DestinoFinal","Status","TextoGuia",
  "NumeroGuia","UrlPDF","Observacao"
];

const STATUS_GUIA = {
  PENDENTE:               "PENDENTE",
  REGISTRADO:             "REGISTRADO",
  PDF_GERADO:             "PDF_GERADO",
  ENVIADO_PRESTADOR:      "ENVIADO_PRESTADOR",
  ENVIADO_CONTABILIDADE:  "ENVIADO_CONTABILIDADE",
  AGUARDANDO_NF:          "AGUARDANDO_NF",
  PAGO:                   "PAGO",
  CANCELADO:              "CANCELADO",
  ERRO:                   "ERRO"
};

const TIPO_ENVIO_GUIA = {
  SOLICITAR_NF:         "solicitar_nf",
  ENVIAR_CONTABILIDADE: "enviar_contabilidade"
};

/* ================= HELPERS ================= */

function normalizarTextoGuia_(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigitsGuia_(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarDataHoraGuia_(data) {
  const tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  const d  = data || new Date();
  return {
    dataHora:  Utilities.formatDate(d, tz, "dd/MM/yyyy HH:mm:ss"),
    data:      Utilities.formatDate(d, tz, "dd/MM/yyyy"),
    hora:      Utilities.formatDate(d, tz, "HH:mm:ss"),
    timestamp: d.getTime()
  };
}

function formatarDataHistorico_(data) {
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarHoraHistorico_(data) {
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "HH:mm:ss");
}

function formatarDataHoraHistorico_(data) {
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function identificarTipoDocumentoGuia_(documento) {
  const doc = onlyDigitsGuia_(documento);
  if (doc.length === 11) return "CPF";
  if (doc.length === 14) return "CNPJ";
  return "CPF / CNPJ";
}

function obterUsuarioSessaoGuia_() {
  try {
    if (typeof getSessaoUsuario === "function") {
      const sessao = getSessaoUsuario();
      if (sessao && sessao.logado) {
        return sessao.nome || sessao.usuario || Session.getActiveUser().getEmail() || "Usuário";
      }
    }
  } catch (e) {}
  try {
    return Session.getActiveUser().getEmail() || "Usuário";
  } catch (e2) {
    return "Usuário";
  }
}

function gerarIdHistoricoGuia_() {
  return "HIST_GUIA_" + new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function converterISODateInicio_(iso) {
  if (!iso) return new Date("1900-01-01T00:00:00");
  return new Date(iso + "T00:00:00");
}

function converterISODateFim_(iso) {
  if (!iso) return new Date("2999-12-31T23:59:59");
  return new Date(iso + "T23:59:59");
}

function converterDataBRouISOEmDate_(valor) {
  const txt = String(valor || "").trim();
  if (!txt) return new Date("1900-01-01T00:00:00");

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const p = txt.split("/");
    return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 12, 0, 0);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    return new Date(txt + "T12:00:00");
  }

  return new Date(txt);
}

function obterTextoGuiaSeguro_(dados) {
  return String((dados && dados.textoGuia) || "").trim();
}

function appendTextoMultilinhaAoBody_(body, texto) {
  texto = String(texto || "").replace(/\r/g, "");
  if (!texto) return;
  const linhas = texto.split("\n");
  body.appendParagraph("");
  linhas.forEach(function(linha) {
    body.appendParagraph(String(linha || ""));
  });
}

function normalizarValorNumeroGuia_(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;

  const txt = String(valor)
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const num = parseFloat(txt);
  return isNaN(num) ? 0 : num;
}

function formatarValorBRGuia_(valor) {
  return normalizarValorNumeroGuia_(valor).toFixed(2).replace(".", ",");
}

function calcularStatusVencimento_(vencimento) {
  const venc = converterDataBRouISOEmDate_(vencimento);
  if (!(venc instanceof Date) || isNaN(venc.getTime())) return "";

  const hoje = new Date();
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
  const vencZero = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate(), 0, 0, 0);

  const diffDias = Math.floor((vencZero.getTime() - hojeZero.getTime()) / 86400000);

  if (diffDias < 0) return "VENCIDO";
  if (diffDias <= 3) return "URGENTE";
  return "OK";
}

function statusEnvioPorTipo_(tipoEnvio) {
  return tipoEnvio === TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE
    ? STATUS_GUIA.ENVIADO_CONTABILIDADE
    : STATUS_GUIA.ENVIADO_PRESTADOR;
}

/* ================= VALIDAÇÃO DOCUMENTAL ================= */

function validarCPF_(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i], 10) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9], 10)) return false;

  soma = 0;
  for (let j = 0; j < 10; j++) soma += parseInt(c[j], 10) * (11 - j);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;

  return r === parseInt(c[10], 10);
}

function validarCNPJ_(cnpj) {
  const c = String(cnpj || "").replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;

  const calc = function(valor, n) {
    let soma = 0;
    let pos = n - 7;
    for (let i = 0; i < n; i++) {
      soma += parseInt(valor[i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };

  return calc(c, 12) === parseInt(c[12], 10) && calc(c, 13) === parseInt(c[13], 10);
}

function validarDocumentoGuia_(documento) {
  const digitos = onlyDigitsGuia_(documento);
  if (!digitos) return { ok: false, mensagem: "Documento não informado." };

  if (digitos.length === 11) {
    if (!validarCPF_(digitos)) return { ok: false, mensagem: "CPF inválido: " + documento };
    return { ok: true };
  }

  if (digitos.length === 14) {
    if (!validarCNPJ_(digitos)) return { ok: false, mensagem: "CNPJ inválido: " + documento };
    return { ok: true };
  }

  return { ok: false, mensagem: "Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)." };
}

function validarDadosGuia_(dados) {
  dados = dados || {};

  const nome       = String(dados.nome       || "").trim();
  const documento  = String(dados.documento  || "").trim();
  const valor      = String(dados.valor      || "").trim();
  const vencimento = String(dados.vencimento || "").trim();
  const tipoEnvio  = String(dados.tipoEnvio  || "").trim();
  const assunto    = String(dados.assunto    || "").trim();
  const fixo       = dados.fixo === true || dados.fixo === "true";

  if (!nome)       throw new Error("Nome do prestador não informado.");
  if (!documento && !fixo) throw new Error("Documento do prestador não informado.");
  if (!valor)      throw new Error("Valor não informado.");
  if (!vencimento) throw new Error("Vencimento não informado.");
  if (!tipoEnvio)  throw new Error("Tipo de envio não informado.");
  if (!assunto)    throw new Error("Assunto do e-mail não informado.");

  if (documento && !fixo) {
    const valDoc = validarDocumentoGuia_(documento);
    if (!valDoc.ok) throw new Error(valDoc.mensagem);
  }
}


/* ================= ESTRUTURA HISTÓRICO ================= */

function garantirEstruturaHistoricoGuias_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  let sh = ss.getSheetByName(ABA_HISTORICO_GUIAS);
  if (!sh) sh = ss.insertSheet(ABA_HISTORICO_GUIAS);

  const primeiraLinha = sh.getRange(1, 1, 1, CABECALHO_HISTORICO_GUIAS.length).getValues()[0];
  let precisaAtualizar = false;

  for (let i = 0; i < CABECALHO_HISTORICO_GUIAS.length; i++) {
    if (String(primeiraLinha[i] || "").trim() !== CABECALHO_HISTORICO_GUIAS[i]) {
      precisaAtualizar = true;
      break;
    }
  }

  if (precisaAtualizar) {
    sh.getRange(1, 1, 1, CABECALHO_HISTORICO_GUIAS.length).setValues([CABECALHO_HISTORICO_GUIAS]);
    sh.getRange(1, 1, 1, CABECALHO_HISTORICO_GUIAS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  return sh;
}

function getHeaderMapHistoricoGuias_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(header, index) {
    map[String(header || "").trim()] = index + 1;
  });
  return map;
}

/* ================= DUPLICIDADE E UPDATE ================= */

function existeGuiaDuplicada_(dados) {
  try {
    const sh = garantirAbaGuiasPagamento_();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return false;

    const headerMap = mapearCabecalhoGuia_(sh);
    const linhas = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    const nomeRef       = normalizarTextoGuia_(dados.nome || "");
    const documentoRef  = onlyDigitsGuia_(dados.documento || "");
    const valorRef      = formatarValorBRGuia_(dados.valor || "");
    const vencimentoRef = formatarDataBRGuia_(dados.vencimento || "");
    const tipoRef       = String(dados.tipoEnvio || "").trim();
    const ignorarId     = String(dados.id || "").trim();

    for (let i = 0; i < linhas.length; i++) {
      const row = linhas[i];
      const rowId         = String(row[headerMap["ID"]] || "").trim();
      const rowNome       = normalizarTextoGuia_(row[headerMap["Prestador"]] || "");
      const rowDocumento  = onlyDigitsGuia_(row[headerMap["Documento"]] || "");
      const rowValor      = formatarValorBRGuia_(row[headerMap["Valor"]] || "");
      const rowVencimento = formatarDataBRGuia_(row[headerMap["Vencimento"]] || "");
      const rowTipo       = String(row[headerMap["TipoEnvio"]] || "").trim();
      const rowStatus     = String(row[headerMap["Status"]] || "").trim();

      if (ignorarId && rowId === ignorarId) continue;
      if (rowStatus === STATUS_GUIA.CANCELADO) continue;

      if (
        rowNome === nomeRef &&
        rowDocumento === documentoRef &&
        rowValor === valorRef &&
        rowVencimento === vencimentoRef &&
        rowTipo === tipoRef
      ) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

function localizarLinhaGuiaPorId_(id) {
  const guiaId = String(id || "").trim();
  if (!guiaId) return null;

  const sh = garantirAbaGuiasPagamento_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const headerMap = mapearCabecalhoGuia_(sh);
  const idxId = headerMap["ID"];
  if (idxId === undefined) return null;

  const dados = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idxId] || "").trim() === guiaId) {
      return {
        sh: sh,
        rowNumber: i + 2,
        headerMap: headerMap,
        row: dados[i]
      };
    }
  }

  return null;
}

function atualizarCamposGuia_(id, campos) {
  const info = localizarLinhaGuiaPorId_(id);
  if (!info) return { ok: false, mensagem: "Guia não encontrada para atualização." };

  const sh = info.sh;
  const rowNumber = info.rowNumber;
  const headerMap = info.headerMap;
  const fmt = formatarDataHoraGuia_(new Date());

  Object.keys(campos || {}).forEach(function(chave) {
    if (headerMap[chave] === undefined) return;
    sh.getRange(rowNumber, headerMap[chave] + 1).setValue(campos[chave]);
  });

  if (headerMap["UltimaAtualizacao"] !== undefined) {
    sh.getRange(rowNumber, headerMap["UltimaAtualizacao"] + 1).setValue(fmt.dataHora);
  }

  return { ok: true, mensagem: "Guia atualizada com sucesso." };
}

function atualizarStatusGuia_(id, novoStatus, observacao, extras) {
  extras = extras || {};
  const payload = {
    "Status": String(novoStatus || "").trim()
  };

  if (observacao && String(observacao).trim()) {
    payload["Observacao"] = String(observacao).trim();
  }

  Object.keys(extras).forEach(function(k) {
    payload[k] = extras[k];
  });

  return atualizarCamposGuia_(id, payload);
}

/* ================= REGISTRO PRINCIPAL ================= */

function registrarEnvioGuiaPagamento(dados) {
  try {
    dados = dados || {};

    const nome               = String(dados.nome               || "").trim();
    const documento          = String(dados.documento          || "").trim();
    const documentoLimpo     = onlyDigitsGuia_(documento);
    const tipoDocumento      = identificarTipoDocumentoGuia_(documento);
    const emailPrestador     = String(dados.emailPrestador     || "").trim();
    const emailContabilidade = String(dados.emailContabilidade || "").trim();
    const valor              = String(dados.valor              || "").trim();
    const vencimento         = String(dados.vencimento         || "").trim();
    const statusVencimento   = calcularStatusVencimento_(vencimento);
    const descricao          = String(dados.descricao          || "").trim();
    const tipoEnvio          = String(dados.tipoEnvio          || "").trim();
    const assunto            = String(dados.assunto            || "").trim();
    const destino            = String(dados.destino            || "").trim();
    const status             = String(dados.status             || STATUS_GUIA.REGISTRADO).trim();
    const observacao         = String(dados.observacao         || "").trim();
    const textoGuia          = obterTextoGuiaSeguro_(dados);
    const numeroGuia         = String(dados.numeroGuia         || "").trim();
    const urlPdf             = String(dados.urlPdf             || "").trim();
    const fileIdPdf          = String(dados.fileIdPdf          || "").trim();
    const dataEnvio          = String(dados.dataEnvio          || "").trim();
    const dataPagamento      = String(dados.dataPagamento      || "").trim();
    const prestadorFixo      = dados.fixo === true || dados.fixo === "true";

    if (!nome)                             throw new Error("Nome do prestador não informado.");
    if (!documentoLimpo && !prestadorFixo) throw new Error("Documento do prestador não informado.");
    if (!valor)                            throw new Error("Valor não informado.");
    if (!vencimento)                       throw new Error("Vencimento não informado.");
    if (!tipoEnvio)                        throw new Error("Tipo de envio não informado.");

    const agora = new Date();
    const fmt = formatarDataHoraGuia_(agora);
    const usuario = obterUsuarioSessaoGuia_();
    const id = "GUIA_" + fmt.timestamp;

    const sh = garantirAbaGuiasPagamento_();

    sh.appendRow([
      id, fmt.dataHora, fmt.data, fmt.hora, fmt.timestamp,
      nome, documento, documentoLimpo, tipoDocumento,
      emailPrestador, emailContabilidade, valor, vencimento, statusVencimento,
      descricao, tipoEnvio, assunto, destino,
      usuario, status, observacao, textoGuia,
      numeroGuia, urlPdf, fileIdPdf, dataEnvio, dataPagamento, fmt.dataHora
    ]);

    return { ok: true, id: id, mensagem: "Registro da guia salvo com sucesso." };

  } catch (e) {
    return { ok: false, erro: true, mensagem: e.message || "Erro ao registrar guia de pagamento." };
  }
}

function salvarHistoricoGuia(dados) {
  try {
    dados = dados || {};

    const idGuia             = String(dados.idGuia             || "").trim();
    const nome               = String(dados.nome               || "").trim();
    const documento          = String(dados.documento          || "").trim();
    const emailPrestador     = String(dados.emailPrestador     || "").trim();
    const emailContabilidade = String(dados.emailContabilidade || "").trim();
    const valor              = String(dados.valor              || "").trim();
    const vencimento         = String(dados.vencimento         || "").trim();
    const descricao          = String(dados.descricao          || "").trim();
    const tipoEnvio          = String(dados.tipoEnvio          || "").trim();
    const assunto            = String(dados.assunto            || "").trim();
    const destinoFinal       = String(dados.destinoFinal       || "").trim();
    const status             = String(dados.status             || STATUS_GUIA.REGISTRADO).trim();
    const textoGuia          = obterTextoGuiaSeguro_(dados);
    const acao               = String(dados.acao               || "REGISTRO").trim();
    const numeroGuia         = String(dados.numeroGuia         || "").trim();
    const urlPdf             = String(dados.urlPdf             || "").trim();
    const observacao         = String(dados.observacao         || "").trim();
    const prestadorFixo      = dados.fixo === true || dados.fixo === "true";

    if (!nome) return { ok: false, erro: true, mensagem: "Nome do prestador não informado." };
    if (!documento && !prestadorFixo) return { ok: false, erro: true, mensagem: "Documento do prestador não informado." };

    const sh = garantirEstruturaHistoricoGuias_();
    const agora = new Date();

    sh.appendRow([
      gerarIdHistoricoGuia_(),
      idGuia,
      formatarDataHoraHistorico_(agora),
      formatarDataHistorico_(agora),
      formatarHoraHistorico_(agora),
      agora.getTime(),
      obterUsuarioSessaoGuia_(),
      acao,
      tipoEnvio,
      nome,
      documento,
      emailPrestador,
      emailContabilidade,
      valor,
      vencimento,
      descricao,
      assunto,
      destinoFinal,
      status,
      textoGuia,
      numeroGuia,
      urlPdf,
      observacao
    ]);

    return { ok: true, erro: false, mensagem: "Histórico da guia salvo com sucesso." };

  } catch (e) {
    return { ok: false, erro: true, mensagem: "Erro ao salvar histórico da guia: " + e.message };
  }
}

/* ================= PDF GUIA DE PAGAMENTO ================= */

function gerarNumeroGuiaPagamento_() {
  // ✅ Timeout explícito com mensagem clara em vez de erro genérico
  const lock = LockService.getScriptLock();
  const lockObtido = lock.tryLock(30000);

  if (!lockObtido) {
    throw new Error("Não foi possível obter o bloqueio para gerar o número da guia. Outro processo está em execução. Tente novamente em instantes.");
  }

  try {
    const ss     = SpreadsheetApp.openById(PLANILHA_ID);
    const config = ss.getSheetByName("CONFIG");
    if (!config) throw new Error("Aba CONFIG não encontrada no SISGEP.");

    const anoAtual  = new Date().getFullYear().toString();
    const rotuloAno = "ANO_GUIA_PAGAMENTO";
    const rotuloSeq = "SEQ_GUIA_PAGAMENTO";

    const dados  = config.getDataRange().getValues();
    let linhaAno = -1;
    let linhaSeq = -1;

    for (let i = 0; i < dados.length; i++) {
      const chave = String(dados[i][0] || "").trim().toUpperCase();
      if (chave === rotuloAno) linhaAno = i + 1;
      if (chave === rotuloSeq) linhaSeq = i + 1;
    }

    if (linhaAno === -1) {
      linhaAno = config.getLastRow() + 1;
      config.getRange(linhaAno, 1).setValue(rotuloAno);
      config.getRange(linhaAno, 2).setValue(anoAtual);
    }

    if (linhaSeq === -1) {
      linhaSeq = config.getLastRow() + 1;
      config.getRange(linhaSeq, 1).setValue(rotuloSeq);
      config.getRange(linhaSeq, 2).setValue(0);
    }

    const anoConfig = String(config.getRange(linhaAno, 2).getValue() || "").trim();
    let ultimo = Number(config.getRange(linhaSeq, 2).getValue() || 0);

    if (anoConfig !== anoAtual) {
      config.getRange(linhaAno, 2).setValue(anoAtual);
      config.getRange(linhaSeq, 2).setValue(0);
      ultimo = 0;
    }

    const proximo = ultimo + 1;
    config.getRange(linhaSeq, 2).setValue(proximo);

    return "GP-" + String(proximo).padStart(4, "0") + "/" + anoAtual;

  } finally {
    lock.releaseLock();
  }
}

function obterOuCriarSubpastaGuiasAno_() {
  const pastaRaiz = DriveApp.getFolderById(PASTA_GUIAS_PAGAMENTO_ID);
  const ano = String(new Date().getFullYear());
  const pastas = pastaRaiz.getFoldersByName(ano);
  if (pastas.hasNext()) return pastas.next();
  return pastaRaiz.createFolder(ano);
}

function formatarDataBRGuia_(valor) {
  const txt = String(valor || "").trim();
  if (!txt) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    const p = txt.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) return txt;

  const d = new Date(txt);
  if (isNaN(d.getTime())) return txt;

  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarValorGuiaPDF_(valor) {
  const txt = String(valor || "").trim();
  if (!txt) return "0,00";

  const num = parseFloat(
    txt.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".")
  );

  if (isNaN(num)) return txt;
  return num.toFixed(2).replace(".", ",");
}

function montarDescricaoTipoEnvioGuia_(tipo) {
  const t = String(tipo || "").trim();
  if (t === TIPO_ENVIO_GUIA.SOLICITAR_NF)         return "Solicitar NF ao prestador";
  if (t === TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE) return "Enviar à contabilidade";
  return t || "";
}

function gerarPDFGuiaPagamento(dados) {
  let copia = null;
  try {
    dados = dados || {};

    // ✅ Validação explícita dos IDs obrigatórios antes de qualquer operação Drive
    if (!TEMPLATE_GUIA_PAGAMENTO_ID || TEMPLATE_GUIA_PAGAMENTO_ID === "COLE_AQUI_O_ID_DO_TEMPLATE_DA_GUIA") {
      throw new Error("Configure TEMPLATE_GUIA_PAGAMENTO_ID no arquivo GuiasPagamento.gs antes de gerar PDFs.");
    }
    if (!PASTA_GUIAS_PAGAMENTO_ID || PASTA_GUIAS_PAGAMENTO_ID === "COLE_AQUI_O_ID_DA_PASTA_DE_DESTINO") {
      throw new Error("Configure PASTA_GUIAS_PAGAMENTO_ID no arquivo GuiasPagamento.gs antes de gerar PDFs.");
    }

    const nome               = String(dados.nome               || "").trim();
    const documento          = String(dados.documento          || "").trim();
    const emailPrestador     = String(dados.emailPrestador     || "").trim();
    const emailContabilidade = String(dados.emailContabilidade || "").trim();
    const valor              = formatarValorGuiaPDF_(dados.valor || "");
    const vencimento         = formatarDataBRGuia_(dados.vencimento || "");
    const descricao          = String(dados.descricao          || "").trim();
    const tipoEnvio          = String(dados.tipoEnvio          || "").trim();
    const assunto            = String(dados.assunto            || "").trim();
    const destino            = String(dados.destino            || "").trim();
    const usuario            = obterUsuarioSessaoGuia_();
    const tipoDocumento      = identificarTipoDocumentoGuia_(documento);
    const dataEmissao        = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    const numeroGuia         = String(dados.numeroGuia || "").trim() || gerarNumeroGuiaPagamento_();
    const textoGuia          = obterTextoGuiaSeguro_(dados);
    const prestadorFixo      = dados.fixo === true || dados.fixo === "true";

    if (!nome) throw new Error("Nome do prestador não informado.");
    if (!documento && !prestadorFixo) throw new Error("Documento não informado.");
    if (!valor) throw new Error("Valor não informado.");
    if (!vencimento) throw new Error("Vencimento não informado.");

    const pastaAno = obterOuCriarSubpastaGuiasAno_();
    copia = DriveApp.getFileById(TEMPLATE_GUIA_PAGAMENTO_ID).makeCopy("Guia de Pagamento - " + numeroGuia, pastaAno);

    Utilities.sleep(500);

    const doc = DocumentApp.openById(copia.getId());
    const body = doc.getBody();

    const substituicoes = [
      ["\\$\\{numeroGuia\\}",         numeroGuia],
      ["\\$\\{dataEmissao\\}",        dataEmissao],
      ["\\$\\{prestador\\}",          nome],
      ["\\$\\{documento\\}",          documento],
      ["\\$\\{tipoDocumento\\}",      tipoDocumento],
      ["\\$\\{emailPrestador\\}",     emailPrestador],
      ["\\$\\{emailContabilidade\\}", emailContabilidade],
      ["\\$\\{valor\\}",              valor],
      ["\\$\\{vencimento\\}",         vencimento],
      ["\\$\\{descricao\\}",          descricao],
      ["\\$\\{tipoEnvio\\}",          montarDescricaoTipoEnvioGuia_(tipoEnvio)],
      ["\\$\\{assunto\\}",            assunto],
      ["\\$\\{destino\\}",            destino],
      ["\\$\\{usuario\\}",            usuario]
    ];

    substituicoes.forEach(function(item) {
      body.replaceText(item[0], String(item[1] || ""));
    });

    if (body.getText().indexOf("${textoGuia}") > -1) {
      body.replaceText("\\$\\{textoGuia\\}", textoGuia || "");
    } else if (textoGuia) {
      appendTextoMultilinhaAoBody_(body, textoGuia);
    }

    doc.saveAndClose();

    const pdfBlob = copia.getAs(MimeType.PDF).setName("Guia de Pagamento - " + numeroGuia + ".pdf");
    const pdfFile = pastaAno.createFile(pdfBlob);

    // ✅ pdfBlob removido do retorno — não é serializável via google.script.run
    return {
      ok: true,
      erro: false,
      numeroGuia: numeroGuia,
      nomeArquivo: pdfFile.getName(),
      urlPdf: pdfFile.getUrl(),
      fileId: pdfFile.getId(),
      docId: copia.getId(),
      mensagem: "Guia gerada com sucesso."
    };

  } catch (e) {
    return { ok: false, erro: true, mensagem: "Erro ao gerar PDF da guia: " + e.message };
  } finally {
    if (copia) {
      try {
        DriveApp.getFileById(copia.getId()).setTrashed(true);
      } catch (e2) {}
    }
  }
}

/* ================= SALVAR GUIA ================= */

function salvarGuiaPagamento(dados) {
  try {
    dados = dados || {};

    const nome               = String(dados.nome               || "").trim();
    const documento          = String(dados.documento          || "").trim();
    const emailPrestador     = String(dados.emailPrestador     || "").trim();
    const emailContabilidade = String(dados.emailContabilidade || "").trim();
    const valor              = String(dados.valor              || "").trim();
    const vencimento         = String(dados.vencimento         || "").trim();
    const descricao          = String(dados.descricao          || "").trim();
    const tipoEnvio          = String(dados.tipoEnvio          || "").trim();
    const assunto            = String(dados.assunto            || "").trim();
    const destino            = String(dados.destino            || "").trim();
    const destinoFinal       = String(dados.destinoFinal       || destino).trim();
    const status             = String(dados.status             || STATUS_GUIA.REGISTRADO).trim();
    const observacao         = String(dados.observacao         || "").trim();
    const textoGuia          = obterTextoGuiaSeguro_(dados);
    const fixo               = dados.fixo === true || dados.fixo === "true";

    validarDadosGuia_({ nome, documento, valor, vencimento, tipoEnvio, assunto, fixo });

    if (existeGuiaDuplicada_({
      nome: nome,
      documento: documento,
      valor: valor,
      vencimento: vencimento,
      tipoEnvio: tipoEnvio,
      id: dados.id || ""
    })) {
      return { ok: false, erro: true, mensagem: "Já existe uma guia semelhante cadastrada para este prestador, valor, vencimento e tipo de envio." };
    }

    const registro = registrarEnvioGuiaPagamento({
      nome, documento, emailPrestador, emailContabilidade,
      valor, vencimento, descricao, tipoEnvio, assunto,
      destino, status, observacao, textoGuia, fixo
    });

    if (!registro || registro.ok !== true) {
      return { ok: false, erro: true, mensagem: (registro && registro.mensagem) || "Erro ao registrar a guia de pagamento." };
    }

    // ✅ Falha no histórico NÃO cancela o registro — retorna aviso em vez de erro
    const historico = salvarHistoricoGuia({
      idGuia: registro.id,
      nome, documento, emailPrestador, emailContabilidade,
      valor, vencimento, descricao, tipoEnvio, assunto,
      destinoFinal, status, textoGuia,
      acao: "REGISTRO", observacao, fixo
    });

    const avisoHistorico = (!historico || historico.ok !== true)
      ? "Guia registrada, mas houve falha ao salvar o histórico: " + ((historico && historico.mensagem) || "erro desconhecido")
      : null;

    return {
      ok: true,
      erro: false,
      id: registro.id || "",
      mensagem: "Guia de pagamento registrada com sucesso.",
      avisoHistorico: avisoHistorico
    };

  } catch (e) {
    return { ok: false, erro: true, mensagem: "Erro ao salvar guia de pagamento: " + e.message };
  }
}

function salvarEGerarGuiaPagamento(dados) {
  try {
    dados = dados || {};

    const salvo = salvarGuiaPagamento(dados);
    if (!salvo || salvo.ok !== true) {
      return { ok: false, erro: true, mensagem: (salvo && salvo.mensagem) || "Erro ao salvar guia." };
    }

    const pdf = gerarPDFGuiaPagamento(dados);
    if (!pdf || pdf.ok !== true) {
      atualizarStatusGuia_(salvo.id, STATUS_GUIA.ERRO, "Erro ao gerar PDF.");
      salvarHistoricoGuia({
        idGuia: salvo.id, nome: dados.nome, documento: dados.documento,
        emailPrestador: dados.emailPrestador, emailContabilidade: dados.emailContabilidade,
        valor: dados.valor, vencimento: dados.vencimento, descricao: dados.descricao,
        tipoEnvio: dados.tipoEnvio, assunto: dados.assunto, destinoFinal: dados.destino || "",
        status: STATUS_GUIA.ERRO, textoGuia: obterTextoGuiaSeguro_(dados),
        acao: "ERRO_PDF", observacao: (pdf && pdf.mensagem) || "Falha ao gerar PDF."
      });

      return {
        ok: false, erro: true,
        mensagem: (pdf && pdf.mensagem) || "Guia salva, mas houve erro ao gerar o PDF."
      };
    }

    atualizarCamposGuia_(salvo.id, {
      "Status": STATUS_GUIA.PDF_GERADO,
      "NumeroGuia": pdf.numeroGuia || "",
      "UrlPDF": pdf.urlPdf || "",
      "FileIdPDF": pdf.fileId || ""
    });

    salvarHistoricoGuia({
      idGuia: salvo.id, nome: dados.nome, documento: dados.documento,
      emailPrestador: dados.emailPrestador, emailContabilidade: dados.emailContabilidade,
      valor: dados.valor, vencimento: dados.vencimento, descricao: dados.descricao,
      tipoEnvio: dados.tipoEnvio, assunto: dados.assunto, destinoFinal: dados.destino || "",
      status: STATUS_GUIA.PDF_GERADO, textoGuia: obterTextoGuiaSeguro_(dados),
      acao: "PDF_GERADO", numeroGuia: pdf.numeroGuia || "", urlPdf: pdf.urlPdf || "",
      observacao: "PDF gerado com sucesso."
    });

    return {
      ok: true, erro: false,
      id: salvo.id || "",
      numeroGuia: pdf.numeroGuia || "",
      nomeArquivo: pdf.nomeArquivo || "",
      urlPdf: pdf.urlPdf || "",
      fileId: pdf.fileId || "",
      mensagem: "Guia salva e PDF gerado com sucesso.",
      avisoHistorico: salvo.avisoHistorico || null
    };

  } catch (e) {
    return { ok: false, erro: true, mensagem: "Erro ao salvar e gerar guia: " + e.message };
  }
}

/* ================= ENVIO REAL POR MAILAPP ================= */

function montarHtmlEmailGuia_(dados, tipo) {
  const nome      = String(dados.nome || "").trim();
  const valor     = String(dados.valor || "").trim();
  const vencBr    = formatarDataBRGuia_(dados.vencimento || "");
  const descricao = String(dados.descricao || "").trim() || "-";
  const documento = String(dados.documento || "").trim() || "[não informado]";
  const saudacao  = (typeof saudacaoHoraBR_ === "function") ? saudacaoHoraBR_() : "Olá";

  if (tipo === TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE) {
    return (
      "<div style='font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a;max-width:680px;'>" +
        "<h2 style='color:#003366;margin:0 0 6px 0;'>Encaminhamento de Nota Fiscal</h2>" +
        "<p style='margin:0 0 16px 0;'>" + saudacao + "! Tudo bem?</p>" +
        "<p style='margin:0 0 14px 0;'>Encaminho, em anexo, a nota fiscal e a documentação referente ao prestador abaixo, para as providências necessárias quanto à programação do pagamento.</p>" +
        "<div style='background:#f0f4f8;border-radius:10px;padding:14px 18px;margin-bottom:16px;'>" +
          "<p style='margin:0 0 6px 0;'><strong>Prestador:</strong> " + nome + "</p>" +
          "<p style='margin:0 0 6px 0;'><strong>CPF / CNPJ:</strong> " + documento + "</p>" +
          "<p style='margin:0 0 6px 0;'><strong>Valor:</strong> " + valor + "</p>" +
          "<p style='margin:0 0 6px 0;'><strong>Vencimento:</strong> " + vencBr + "</p>" +
          "<p style='margin:0;'><strong>Descrição:</strong> " + descricao + "</p>" +
        "</div>" +
        "<p style='margin:14px 0 0 0;'><strong>Solicitamos, por gentileza, a confirmação do recebimento.</strong></p>" +
        "<hr style='margin:20px 0;border:none;border-top:1px solid #e2e8f0;'>" +
        "<p style='line-height:1.8;margin:0;'><strong>Financeiro &amp; Cobrança</strong><br>SindEducação-ES<br>(27) 99813-5965 | (27) 3222-2706<br>financeiro@sindeducacao.com</p>" +
      "</div>"
    );
  }

  return (
    "<div style='font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a;max-width:680px;'>" +
      "<h2 style='color:#003366;margin:0 0 6px 0;'>Solicitação de Nota Fiscal</h2>" +
      "<p style='margin:0 0 16px 0;'>" + saudacao + (nome ? " " + nome : "") + "! Tudo bem?</p>" +
      "<p style='margin:0 0 14px 0;'>Solicitamos o envio da nota fiscal referente ao serviço abaixo:</p>" +
      "<div style='background:#f0f4f8;border-radius:10px;padding:14px 18px;margin-bottom:16px;'>" +
        "<p style='margin:0 0 6px 0;'><strong>Valor:</strong> " + valor + "</p>" +
        "<p style='margin:0 0 6px 0;'><strong>Vencimento:</strong> " + vencBr + "</p>" +
        "<p style='margin:0;'><strong>Descrição:</strong> " + descricao + "</p>" +
      "</div>" +
      "<p style='margin:14px 0 0 0;'><strong>Solicitamos, por gentileza, a confirmação do recebimento.</strong></p>" +
      "<hr style='margin:20px 0;border:none;border-top:1px solid #e2e8f0;'>" +
      "<p style='line-height:1.8;margin:0;'><strong>Financeiro &amp; Cobrança</strong><br>SindEducação-ES<br>(27) 99813-5965 | (27) 3222-2706<br>financeiro@sindeducacao.com</p>" +
    "</div>"
  );
}

function enviarGuiaPorEmailSISGEP(dados) {
  try {
    dados = dados || {};

    const emailUsuario = (typeof obterEmailUsuarioAtual_ === "function")
      ? String(obterEmailUsuarioAtual_() || "").trim().toLowerCase()
      : String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();

    if (!emailUsuario) return { ok: false, mensagem: "Não foi possível identificar o usuário logado." };
    if (typeof usuarioAutorizado === "function" && !usuarioAutorizado(emailUsuario)) {
      return { ok: false, mensagem: "Acesso negado." };
    }

    const idGuia    = String(dados.id || "").trim();
    const tipoEnvio = String(dados.tipoEnvio || "").trim();
    const assunto   = String(dados.assunto || "").trim();

    if (!assunto) return { ok: false, mensagem: "Informe o assunto do e-mail antes de enviar." };
    if (!idGuia)  return { ok: false, mensagem: "ID da guia não informado." };

    // ✅ Usa constante centralizada EMAILS_CONTABILIDADE_GS
    let destino = "";
    if (tipoEnvio === TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE) {
      destino = EMAILS_CONTABILIDADE_GS.join(", ");
    } else {
      destino = String(dados.emailPrestador || dados.destino || "").trim();
    }

    if (!destino) return { ok: false, mensagem: "Nenhum e-mail de destino identificado." };

    const validacao = (typeof validarListaEmails_ === "function")
      ? validarListaEmails_(destino)
      : { ok: true, todos: destino, principal: destino };

    if (!validacao.ok) {
      return { ok: false, mensagem: "E-mail de destino inválido: " + (validacao.invalido || destino) };
    }

    let numeroGuia  = String(dados.numeroGuia  || "").trim();
    let urlPdf      = String(dados.urlPdf      || "").trim();
    let fileIdPdf   = String(dados.fileIdPdf   || "").trim();
    let nomeArquivo = "";

    if (!numeroGuia || !fileIdPdf) {
      const pdf = gerarPDFGuiaPagamento(dados);
      if (!pdf || pdf.ok !== true) {
        atualizarStatusGuia_(idGuia, STATUS_GUIA.ERRO, "Erro ao gerar PDF para envio.");
        salvarHistoricoGuia({
          idGuia, nome: dados.nome, documento: dados.documento,
          emailPrestador: dados.emailPrestador, emailContabilidade: dados.emailContabilidade,
          valor: dados.valor, vencimento: dados.vencimento, descricao: dados.descricao,
          tipoEnvio: dados.tipoEnvio, assunto,
          destinoFinal: validacao.todos,
          status: STATUS_GUIA.ERRO, textoGuia: obterTextoGuiaSeguro_(dados),
          acao: "ERRO_ENVIO",
          observacao: "Erro ao gerar PDF: " + ((pdf && pdf.mensagem) || "")
        });
        return { ok: false, mensagem: "Erro ao gerar PDF: " + (pdf && pdf.mensagem) };
      }

      numeroGuia  = pdf.numeroGuia  || "";
      urlPdf      = pdf.urlPdf      || "";
      fileIdPdf   = pdf.fileId      || "";
      nomeArquivo = pdf.nomeArquivo || "Guia.pdf";

      atualizarCamposGuia_(idGuia, {
        "Status": STATUS_GUIA.PDF_GERADO,
        "NumeroGuia": numeroGuia,
        "UrlPDF": urlPdf,
        "FileIdPDF": fileIdPdf
      });

      salvarHistoricoGuia({
        idGuia, nome: dados.nome, documento: dados.documento,
        emailPrestador: dados.emailPrestador, emailContabilidade: dados.emailContabilidade,
        valor: dados.valor, vencimento: dados.vencimento, descricao: dados.descricao,
        tipoEnvio: dados.tipoEnvio, assunto,
        destinoFinal: validacao.todos,
        status: STATUS_GUIA.PDF_GERADO, textoGuia: obterTextoGuiaSeguro_(dados),
        acao: "PDF_GERADO", numeroGuia, urlPdf,
        observacao: "PDF gerado automaticamente antes do envio."
      });
    } else {
      try {
        nomeArquivo = DriveApp.getFileById(fileIdPdf).getName();
      } catch (eName) {
        nomeArquivo = "Guia.pdf";
      }
    }

    const htmlBody = montarHtmlEmailGuia_(dados, tipoEnvio);
    const pdfBlob  = DriveApp.getFileById(fileIdPdf).getBlob().setName(nomeArquivo || "Guia.pdf");

    MailApp.sendEmail({
      to:          validacao.todos,
      subject:     assunto,
      htmlBody:    htmlBody,
      attachments: [pdfBlob],
      name:        "SindEducação-ES",
      replyTo:     emailUsuario,
      bcc:         "financeiro@sindeducacao.com"
    });

    const fmt        = formatarDataHoraGuia_(new Date());
    const statusEnvio = statusEnvioPorTipo_(tipoEnvio);

    atualizarCamposGuia_(idGuia, {
      "Status":     statusEnvio,
      "Destino":    validacao.todos,
      "NumeroGuia": numeroGuia,
      "UrlPDF":     urlPdf,
      "FileIdPDF":  fileIdPdf,
      "DataEnvio":  fmt.dataHora
    });

    salvarHistoricoGuia({
      idGuia, nome: dados.nome, documento: dados.documento,
      emailPrestador: dados.emailPrestador, emailContabilidade: dados.emailContabilidade,
      valor: dados.valor, vencimento: dados.vencimento, descricao: dados.descricao,
      tipoEnvio, assunto,
      destinoFinal: validacao.todos,
      status: statusEnvio, textoGuia: obterTextoGuiaSeguro_(dados),
      acao: "ENVIO_EMAIL", numeroGuia, urlPdf,
      observacao: "Guia enviada por e-mail com sucesso."
    });

    try {
      if (typeof criarFilaEnvioOficio_ === "function") {
        criarFilaEnvioOficio_({
          numeroOficio:      numeroGuia,
          tipo:              "Guia de Pagamento",
          escola:            String(dados.nome || ""),
          cnpj:              String(dados.documento || ""),
          emailPrincipal:    validacao.principal || validacao.todos,
          emailsTodos:       validacao.todos,
          assunto,
          htmlBody,
          anexos:            [{ nome: nomeArquivo || "Guia.pdf", mimeType: MimeType.PDF, fileId: fileIdPdf }],
          usuario:           emailUsuario,
          codigoVerificacao: numeroGuia
        });
      }
    } catch (eFila) {
      Logger.log("⚠ Não foi possível registrar guia na fila: " + eFila.message);
    }

    return {
      ok:         true,
      numeroGuia: numeroGuia,
      urlPdf:     urlPdf,
      destino:    validacao.todos,
      mensagem:   "Guia enviada com sucesso para " + validacao.todos + "."
    };

  } catch (e) {
    Logger.log("❌ Erro em enviarGuiaPorEmailSISGEP: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar guia: " + e.message };
  }
}

/* ================= BUSCA DE PRESTADOR ================= */

function buscarPrestadorGuiaPagamento(termo) {
  try {
    termo = String(termo || "").trim();
    if (!termo) return { ok: true, lista: [] };

    const termoNorm   = normalizarTextoGuia_(termo);
    const termoDigits = onlyDigitsGuia_(termo);
    const mapaPrestadores = new Map();

    function adicionarPrestador_(origem, dados) {
      const nome               = String(dados.nome               || "").trim();
      const documento          = String(dados.documento          || "").trim();
      const documentoLimpo     = String(dados.documentoLimpo     || onlyDigitsGuia_(documento)).trim();
      const emailPrestador     = String(dados.emailPrestador     || "").trim();
      const emailContabilidade = String(dados.emailContabilidade || "").trim();
      const valor              = String(dados.valor              || "").trim();
      const vencimento         = String(dados.vencimento         || "").trim();
      const descricao          = String(dados.descricao          || "").trim();
      const tipoEnvio          = String(dados.tipoEnvio          || "").trim();
      const ultimaMovimentacao = String(dados.ultimaMovimentacao || "").trim();
      const valorVariavel      = dados.valorVariavel === true;
      const fixo               = dados.fixo === true;

      const chaveBase = documentoLimpo || normalizarTextoGuia_(nome);
      if (!chaveBase) return;

      const novoRegistro = {
        nome, documento, documentoLimpo, emailPrestador, emailContabilidade,
        valor, valorVariavel, vencimento, descricao, tipoEnvio,
        ultimaMovimentacao, fixo, origem
      };

      if (!mapaPrestadores.has(chaveBase)) {
        mapaPrestadores.set(chaveBase, novoRegistro);
        return;
      }

      const atual = mapaPrestadores.get(chaveBase);
      const prioridade = { "CAD": 3, "FIXO": 2, "HIST": 1 };

      if ((prioridade[origem] || 0) > (prioridade[atual.origem] || 0)) {
        mapaPrestadores.set(chaveBase, novoRegistro);
        return;
      }

      atual.nome               = atual.nome               || novoRegistro.nome;
      atual.documento          = atual.documento          || novoRegistro.documento;
      atual.documentoLimpo     = atual.documentoLimpo     || novoRegistro.documentoLimpo;
      atual.emailPrestador     = atual.emailPrestador     || novoRegistro.emailPrestador;
      atual.emailContabilidade = atual.emailContabilidade || novoRegistro.emailContabilidade;
      atual.valor              = atual.valor              || novoRegistro.valor;
      atual.vencimento         = atual.vencimento         || novoRegistro.vencimento;
      atual.descricao          = atual.descricao          || novoRegistro.descricao;
      atual.tipoEnvio          = atual.tipoEnvio          || novoRegistro.tipoEnvio;
      atual.ultimaMovimentacao = atual.ultimaMovimentacao || novoRegistro.ultimaMovimentacao;
      atual.valorVariavel      = atual.valorVariavel === true || novoRegistro.valorVariavel === true;
      atual.fixo               = atual.fixo === true || novoRegistro.fixo === true;

      mapaPrestadores.set(chaveBase, atual);
    }

    // 1) Histórico da aba principal — limitado a MAX_ROWS_BUSCA_PRESTADOR
    const sh = garantirAbaGuiasPagamento_();
    const lastRow = sh.getLastRow();

    if (lastRow >= 2) {
      // ✅ Limita linhas lidas para evitar timeout em planilhas grandes
      const startRow  = Math.max(2, lastRow - MAX_ROWS_BUSCA_PRESTADOR + 1);
      const numRows   = lastRow - startRow + 1;
      const dados     = sh.getRange(startRow, 1, numRows, sh.getLastColumn()).getValues();
      const headerMap = mapearCabecalhoGuia_(sh);

      for (let i = dados.length - 1; i >= 0; i--) {
        const row = dados[i];
        const nome           = String(row[headerMap["Prestador"]]       || "").trim();
        const documento      = String(row[headerMap["Documento"]]       || "").trim();
        const documentoLimpo = String(row[headerMap["DocumentoLimpo"]]  || "").trim();
        const emailPrestador = String(row[headerMap["EmailPrestador"]]  || "").trim();
        const emailCont      = String(row[headerMap["EmailContabilidade"]] || "").trim();
        const valor          = String(row[headerMap["Valor"]]           || "").trim();
        const vencimento     = String(row[headerMap["Vencimento"]]      || "").trim();
        const descricao      = String(row[headerMap["Descricao"]]       || "").trim();
        const tipoEnvio      = String(row[headerMap["TipoEnvio"]]       || "").trim();
        const dataHora       = String(row[headerMap["DataHora"]]        || "").trim();

        const textoBusca = normalizarTextoGuia_([nome, documento, documentoLimpo, emailPrestador, emailCont, descricao].join(" "));
        const encontrou  = (termoNorm && textoBusca.indexOf(termoNorm) > -1) ||
                           (termoDigits && documentoLimpo.indexOf(termoDigits) > -1);
        if (!encontrou) continue;

        adicionarPrestador_("HIST", {
          nome, documento, documentoLimpo, emailPrestador,
          emailContabilidade: emailCont, valor, vencimento, descricao,
          tipoEnvio, ultimaMovimentacao: dataHora, fixo: false
        });
      }
    }

    // 2) Prestadores fixos
    const fixos = listarPrestadoresFixos();
    fixos.forEach(function(p) {
      const nome           = String(p.nome || "").trim();
      const documento      = String(p.documento || "").trim();
      const documentoLimpo = onlyDigitsGuia_(documento);
      const emailPrestador = String(p.emailPrestador || "").trim();

      const textoBusca = normalizarTextoGuia_([nome, documento, documentoLimpo, emailPrestador].join(" "));
      const encontrou  = (termoNorm && textoBusca.indexOf(termoNorm) > -1) ||
                         (termoDigits && documentoLimpo.indexOf(termoDigits) > -1);
      if (!encontrou) return;

      adicionarPrestador_("FIXO", {
        nome, documento, documentoLimpo, emailPrestador,
        emailContabilidade: String(p.emailContabilidade || "").trim(),
        valor: p.valor || "", valorVariavel: p.valorVariavel === true,
        vencimento: p.vencimento || "", descricao: p.descricao || "",
        tipoEnvio: p.tipoEnvio || "", ultimaMovimentacao: "Prestador fixo", fixo: true
      });
    });

    // 3) Aba Prestadores_Serviços — limitada a MAX_ROWS_BUSCA_PRESTADOR
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const shPrestadores = ss.getSheetByName(ABA_PRESTADORES_SERVICOS);

    if (shPrestadores && shPrestadores.getLastRow() >= 2) {
      const totalPrest  = shPrestadores.getLastRow();
      const startPrest  = Math.max(2, totalPrest - MAX_ROWS_BUSCA_PRESTADOR + 1);
      const numPrest    = totalPrest - startPrest + 1;
      const dadosPrest  = shPrestadores.getRange(startPrest, 1, numPrest, shPrestadores.getLastColumn()).getValues();
      const cab         = shPrestadores.getRange(1, 1, 1, shPrestadores.getLastColumn()).getValues()[0];
      const idxCab      = {};
      cab.forEach(function(nomeColuna, i) {
        idxCab[String(nomeColuna || "").trim()] = i;
      });

      for (let j = dadosPrest.length - 1; j >= 0; j--) {
        const row = dadosPrest[j];

        const nome           = String(row[idxCab["Nome"]] || row[idxCab["Prestador"]] || row[idxCab["Nome / Razão Social"]] || "").trim();
        const documento      = String(row[idxCab["Documento"]] || row[idxCab["CPF / CNPJ"]] || row[idxCab["CPF/CNPJ"]] || "").trim();
        const documentoLimpo = onlyDigitsGuia_(documento);
        const emailPrestador = String(row[idxCab["EmailPrestador"]] || row[idxCab["E-mail do Prestador"]] || row[idxCab["E-mail"]] || "").trim();
        const emailCont      = String(row[idxCab["EmailContabilidade"]] || row[idxCab["E-mail da Contabilidade"]] || "").trim();
        const dataHora       = String(row[idxCab["DataHora"]] || row[idxCab["Data/Hora"]] || "").trim();

        const textoBusca = normalizarTextoGuia_([nome, documento, documentoLimpo, emailPrestador, emailCont].join(" "));
        const encontrou  = (termoNorm && textoBusca.indexOf(termoNorm) > -1) ||
                           (termoDigits && documentoLimpo.indexOf(termoDigits) > -1);
        if (!encontrou) continue;

        adicionarPrestador_("CAD", {
          nome, documento, documentoLimpo, emailPrestador,
          emailContabilidade: emailCont, valor: "", vencimento: "",
          descricao: "", tipoEnvio: "",
          ultimaMovimentacao: dataHora || "Cadastro manual", fixo: false
        });
      }
    }

    const lista = Array.from(mapaPrestadores.values())
      .sort(function(a, b) {
        const nA = normalizarTextoGuia_(a.nome || "");
        const nB = normalizarTextoGuia_(b.nome || "");
        return nA < nB ? -1 : nA > nB ? 1 : 0;
      })
      .slice(0, 20)
      .map(function(item) {
        return {
          nome: item.nome || "", documento: item.documento || "",
          documentoLimpo: item.documentoLimpo || "",
          emailPrestador: item.emailPrestador || "",
          emailContabilidade: item.emailContabilidade || "",
          valor: item.valor || "", valorVariavel: item.valorVariavel === true,
          vencimento: item.vencimento || "", descricao: item.descricao || "",
          tipoEnvio: item.tipoEnvio || "",
          ultimaMovimentacao: item.ultimaMovimentacao || "",
          fixo: item.fixo === true
        };
      });

    return { ok: true, lista: lista };

  } catch (e) {
    return { ok: false, erro: true, mensagem: e.message || "Erro ao buscar prestador." };
  }
}

/* ================= RELATÓRIO ================= */

function listarRelatorioGuiasPagamento(filtros) {
  try {
    filtros = filtros || {};

    const prestador  = normalizarTextoGuia_(filtros.prestador || "");
    const documento  = onlyDigitsGuia_(filtros.documento || "");
    const tipoEnvio  = String(filtros.tipoEnvio || "").trim();
    const status     = normalizarTextoGuia_(filtros.status || "");
    const dataInicio = String(filtros.dataInicio || "").trim();
    const dataFim    = String(filtros.dataFim || "").trim();

    const sh = garantirAbaGuiasPagamento_();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, lista: [] };

    const dados     = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    const headerMap = mapearCabecalhoGuia_(sh);

    let lista = dados.map(function(row) {
      const vencimento = String(row[headerMap["Vencimento"]] || "");
      const statusRow  = String(row[headerMap["Status"]] || "");

      // ✅ statusVencimento recalculado dinamicamente — nunca fica desatualizado
      const statusVencimentoAtual = (statusRow === STATUS_GUIA.PAGO || statusRow === STATUS_GUIA.CANCELADO)
        ? (String(row[headerMap["StatusVencimento"]] || ""))
        : calcularStatusVencimento_(vencimento);

      return {
        id:                row[headerMap["ID"]]                || "",
        dataHora:          row[headerMap["DataHora"]]          || "",
        data:              row[headerMap["Data"]]              || "",
        hora:              row[headerMap["Hora"]]              || "",
        timestamp:         Number(row[headerMap["Timestamp"]]  || 0),
        prestador:         row[headerMap["Prestador"]]         || "",
        documento:         row[headerMap["Documento"]]         || "",
        documentoLimpo:    row[headerMap["DocumentoLimpo"]]    || "",
        tipoDocumento:     row[headerMap["TipoDocumento"]]     || "",
        emailPrestador:    row[headerMap["EmailPrestador"]]    || "",
        emailContabilidade:row[headerMap["EmailContabilidade"]]|| "",
        valor:             row[headerMap["Valor"]]             || "",
        vencimento:        vencimento,
        statusVencimento:  statusVencimentoAtual,
        descricao:         row[headerMap["Descricao"]]         || "",
        tipoEnvio:         row[headerMap["TipoEnvio"]]         || "",
        assunto:           row[headerMap["Assunto"]]           || "",
        destino:           row[headerMap["Destino"]]           || "",
        usuario:           row[headerMap["Usuario"]]           || "",
        status:            statusRow,
        observacao:        row[headerMap["Observacao"]]        || "",
        textoGuia:         row[headerMap["TextoGuia"]]         || "",
        numeroGuia:        row[headerMap["NumeroGuia"]]        || "",
        urlPdf:            row[headerMap["UrlPDF"]]            || "",
        fileIdPdf:         row[headerMap["FileIdPDF"]]         || "",
        dataEnvio:         row[headerMap["DataEnvio"]]         || "",
        dataPagamento:     row[headerMap["DataPagamento"]]     || "",
        ultimaAtualizacao: row[headerMap["UltimaAtualizacao"]] || ""
      };
    });

    lista = lista.filter(function(item) {
      let ok = true;
      if (prestador)   ok = ok && normalizarTextoGuia_(item.prestador).indexOf(prestador) > -1;
      if (documento)   ok = ok && String(item.documentoLimpo || "").indexOf(documento) > -1;
      if (tipoEnvio)   ok = ok && String(item.tipoEnvio || "") === tipoEnvio;
      if (status)      ok = ok && normalizarTextoGuia_(item.status).indexOf(status) > -1;
      if (dataInicio)  ok = ok && converterDataBRouISOEmDate_(item.data) >= converterISODateInicio_(dataInicio);
      if (dataFim)     ok = ok && converterDataBRouISOEmDate_(item.data) <= converterISODateFim_(dataFim);
      return ok;
    });

    lista.sort(function(a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    return { ok: true, lista: lista };

  } catch (e) {
    return { ok: false, erro: true, mensagem: e.message || "Erro ao listar relatório de guias." };
  }
}

/* ================= HISTÓRICO ================= */

function listarHistoricoGuias(filtros) {
  try {
    filtros = filtros || {};

    const limite = Number(filtros.limite || 50);
    const offset = Number(filtros.offset || 0);

    const sh = garantirEstruturaHistoricoGuias_();
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    if (lastRow < 2) {
      return { total: 0, pagina: [], temMais: false, offset: offset, limite: limite };
    }

    const map   = getHeaderMapHistoricoGuias_(sh);
    const dados = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const dataInicio = String(filtros.dataInicio || "").trim();
    const dataFim    = String(filtros.dataFim    || "").trim();
    const tipoEnvio  = normalizarTextoGuia_(filtros.tipoEnvio || "");
    const prestador  = normalizarTextoGuia_(filtros.prestador || "");
    const documento  = onlyDigitsGuia_(filtros.documento || "");
    const status     = normalizarTextoGuia_(filtros.status   || "");
    const acao       = normalizarTextoGuia_(filtros.acao     || "");

    const inicioTs = dataInicio ? new Date(dataInicio + "T00:00:00").getTime() : null;
    const fimTs    = dataFim    ? new Date(dataFim    + "T23:59:59").getTime() : null;

    let lista = dados.filter(function(linha) {
      const rowTs        = Number(linha[map["Timestamp"]  - 1] || 0);
      const rowTipoEnvio = normalizarTextoGuia_(linha[map["TipoEnvio"]  - 1] || "");
      const rowPrestador = normalizarTextoGuia_(linha[map["Prestador"]  - 1] || "");
      const rowDocumento = onlyDigitsGuia_(linha[map["Documento"]       - 1] || "");
      const rowStatus    = normalizarTextoGuia_(linha[map["Status"]     - 1] || "");
      const rowAcao      = normalizarTextoGuia_(linha[map["Acao"]       - 1] || "");

      if (inicioTs !== null && rowTs < inicioTs) return false;
      if (fimTs    !== null && rowTs > fimTs)    return false;
      if (tipoEnvio && rowTipoEnvio.indexOf(tipoEnvio) === -1) return false;
      if (prestador && rowPrestador.indexOf(prestador) === -1) return false;
      if (documento && rowDocumento.indexOf(documento) === -1) return false;
      if (status    && rowStatus.indexOf(status)       === -1) return false;
      if (acao      && rowAcao.indexOf(acao)           === -1) return false;

      return true;
    }).map(function(linha) {
      var idGuia = map["IdGuia"] ? String(linha[map["IdGuia"] - 1] || "") : "";

      // ✅ Verifica se o email foi aberto via pixel de rastreamento
      var emailAberto = false;
      try {
        if (idGuia) {
          var props    = PropertiesService.getScriptProperties();
          var allKeys  = props.getKeys();
          // Busca qualquer token de leitura vinculado a esta guia
          for (var k = 0; k < allKeys.length; k++) {
            if (allKeys[k].indexOf("LEITURA_NF_") === 0) {
              var rawLeitura = props.getProperty(allKeys[k]);
              if (rawLeitura) {
                try {
                  var dadosLeitura = JSON.parse(rawLeitura);
                  if (dadosLeitura && dadosLeitura.acessos && dadosLeitura.acessos > 0) {
                    // Confirma que pertence a esta guia via token de NF
                    var tokenNF = allKeys[k].replace("LEITURA_NF_", "");
                    var infoNF  = buscarTokenEnvioNF_(tokenNF);
                    if (infoNF && infoNF.idGuia === idGuia) {
                      emailAberto = true;
                      break;
                    }
                  }
                } catch(ep) {}
              }
            }
          }
        }
      } catch(el) {
        Logger.log("⚠ listarHistoricoGuias emailAberto: " + el.message);
      }

      return {
        id:                linha[map["ID"]                - 1] || "",
        idGuia:            idGuia,
        dataHora:          linha[map["DataHora"]          - 1] || "",
        data:              linha[map["Data"]              - 1] || "",
        hora:              linha[map["Hora"]              - 1] || "",
        usuario:           linha[map["Usuario"]           - 1] || "",
        acao:              linha[map["Acao"]              - 1] || "",
        tipoEnvio:         linha[map["TipoEnvio"]         - 1] || "",
        prestador:         linha[map["Prestador"]         - 1] || "",
        documento:         linha[map["Documento"]         - 1] || "",
        emailPrestador:    linha[map["EmailPrestador"]    - 1] || "",
        emailContabilidade:linha[map["EmailContabilidade"]- 1] || "",
        valor:             linha[map["Valor"]             - 1] || "",
        vencimento:        linha[map["Vencimento"]        - 1] || "",
        descricao:         linha[map["Descricao"]         - 1] || "",
        assunto:           linha[map["Assunto"]           - 1] || "",
        destinoFinal:      linha[map["DestinoFinal"]      - 1] || "",
        status:            linha[map["Status"]            - 1] || "",
        timestamp:         linha[map["Timestamp"]         - 1] || 0,
        textoGuia:         map["TextoGuia"]  ? (linha[map["TextoGuia"]  - 1] || "") : "",
        numeroGuia:        map["NumeroGuia"] ? (linha[map["NumeroGuia"] - 1] || "") : "",
        urlPdf:            map["UrlPDF"]     ? (linha[map["UrlPDF"]     - 1] || "") : "",
        observacao:        map["Observacao"] ? (linha[map["Observacao"] - 1] || "") : "",
        emailAberto:       emailAberto   // ✅ novo
      };
    });

    lista.sort(function(a, b) {
      return Number(b.timestamp || 0) - Number(a.timestamp || 0);
    });

    const total   = lista.length;
    const pagina  = lista.slice(offset, offset + limite);
    const temMais = (offset + limite) < total;

    return { total, pagina, temMais, offset, limite };

  } catch (e) {
    return { total: 0, pagina: [], temMais: false, erro: true, mensagem: "Erro ao listar histórico de guias: " + e.message };
  }
}
function listarUltimosPrestadoresGuia(qtd) {
  try {
    qtd = Number(qtd || 10);
    if (qtd <= 0) qtd = 10;

    const historico = listarHistoricoGuias({ limite: 500, offset: 0 });
    const pagina    = Array.isArray(historico.pagina) ? historico.pagina : [];
    const mapa      = {};
    const lista     = [];

    pagina.forEach(function(item) {
      const chave = onlyDigitsGuia_(item.documento) + "||" + normalizarTextoGuia_(item.prestador);
      if (mapa[chave]) return;
      mapa[chave] = true;

      lista.push({
        prestador:         item.prestador || "",
        documento:         item.documento || "",
        emailPrestador:    item.emailPrestador || "",
        emailContabilidade:item.emailContabilidade || "",
        valor:             item.valor || "",
        vencimento:        item.vencimento || "",
        descricao:         item.descricao || "",
        assunto:           item.assunto || "",
        tipoEnvio:         item.tipoEnvio || "",
        ultimaDataHora:    item.dataHora || "",
        ultimoTimestamp:   item.timestamp || 0,
        textoGuia:         item.textoGuia || ""
      });
    });

    return lista.slice(0, qtd);

  } catch (e) {
    return [{ erro: true, mensagem: "Erro ao listar últimos prestadores: " + e.message }];
  }
}

/* ================= PRESTADORES FIXOS COM CACHE ================= */

function listarPrestadoresFixos() {
  try {
    const CACHE_KEY      = "sisgep_prestadores_fixos";
    const CACHE_SEGUNDOS = 300;

    const cache  = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (eCache) {}
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_PRESTADORES_SERVICOS);
    if (!sh || sh.getLastRow() < 2) {
      Logger.log("listarPrestadoresFixos: aba não encontrada ou sem dados -> " + ABA_PRESTADORES_SERVICOS);
      return [];
    }

    const dados   = sh.getDataRange().getValues();
    const headers = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    function normalizarHeader_(txt) {
      return String(txt || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function encontrarIndiceColuna_(headers, aliases) {
      const normalizados = headers.map(normalizarHeader_);
      for (var i = 0; i < aliases.length; i++) {
        var alvo = normalizarHeader_(aliases[i]);
        var idx  = normalizados.indexOf(alvo);
        if (idx !== -1) return idx;
      }
      for (var j = 0; j < normalizados.length; j++) {
        for (var k = 0; k < aliases.length; k++) {
          var alias = normalizarHeader_(aliases[k]);
          if (normalizados[j].indexOf(alias) !== -1) return j;
        }
      }
      return -1;
    }

    const idxNome = encontrarIndiceColuna_(headers, [
      "Nome do Prestador","Nome","Prestador","Nome / Razão Social","Razão Social"
    ]);
    const idxDia = encontrarIndiceColuna_(headers, [
      "Data de Vencimento","Vencimento","Dia do Vencimento","Data Vencimento","Dia"
    ]);
    const idxValor = encontrarIndiceColuna_(headers, [
      "Valor","Valor Mensal","Valor Padrão","Valor Base"
    ]);
    const idxDocumento = encontrarIndiceColuna_(headers, [
      "Documento","CPF / CNPJ","CPF/CNPJ","CNPJ","CPF"
    ]);
    const idxEmailPrestador = encontrarIndiceColuna_(headers, [
      "E-mail do Prestador","EmailPrestador","E-mail","Email"
    ]);
    const idxEmailContabilidade = encontrarIndiceColuna_(headers, [
      "E-mail da Contabilidade","EmailContabilidade","Contabilidade"
    ]);
    const idxDescricao = encontrarIndiceColuna_(headers, [
      "Descricao","Descrição","Observacao","Observação"
    ]);
    const idxAssunto  = encontrarIndiceColuna_(headers, ["Assunto"]);
    const idxTipoEnvio = encontrarIndiceColuna_(headers, [
      "TipoEnvio","Tipo de Envio","Envio"
    ]);

    if (idxNome === -1 || idxDia === -1 || idxValor === -1) {
      Logger.log("listarPrestadoresFixos: cabeçalhos obrigatórios não encontrados. Colunas: " + headers.join(", "));
      return [];
    }

    const hoje = new Date();
    const ano  = hoje.getFullYear();
    const mes  = hoje.getMonth();

    const resultado = dados.slice(1).map(function(linha) {
      const nome = String(linha[idxNome] || "").trim();
      if (!nome) return null;

      const diaBruto     = String(linha[idxDia] || "").trim();
      const valorBruto   = linha[idxValor];
      const documento    = idxDocumento          > -1 ? String(linha[idxDocumento]          || "").trim() : "";
      const emailPrest   = idxEmailPrestador     > -1 ? String(linha[idxEmailPrestador]     || "").trim() : "";
      const emailCont    = idxEmailContabilidade > -1 ? String(linha[idxEmailContabilidade] || "").trim() : "";
      const descricao    = idxDescricao          > -1 ? String(linha[idxDescricao]          || "").trim() : "";
      const assunto      = idxAssunto            > -1 ? String(linha[idxAssunto]            || "").trim() : "";
      const tipoEnvio    = idxTipoEnvio          > -1 ? String(linha[idxTipoEnvio]          || "").trim() : "";

      let valor         = "";
      let valorVariavel = false;
      const txtValor    = String(valorBruto || "").toLowerCase().trim();

      if (
        txtValor.includes("variavel") || txtValor.includes("variável") ||
        txtValor.includes("cartão")   || txtValor === ""
      ) {
        valorVariavel = true;
      } else {
        valor = typeof valorBruto === "number"
          ? "R$ " + valorBruto.toFixed(2).replace(".", ",")
          : String(valorBruto).trim();
      }

      let vencimento = "";

      if (Object.prototype.toString.call(linha[idxDia]) === "[object Date]" && !isNaN(linha[idxDia].getTime())) {
        vencimento = Utilities.formatDate(linha[idxDia], Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        const diaNumero = parseInt(diaBruto.replace(/\D/g, ""), 10);
        if (!isNaN(diaNumero)) {
          const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
          const dia          = Math.min(diaNumero, ultimoDiaMes);
          vencimento = Utilities.formatDate(
            new Date(ano, mes, dia),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd"
          );
        }
      }

      return {
        nome, documento,
        emailPrestador: emailPrest, emailContabilidade: emailCont,
        valor, valorVariavel, vencimento, descricao, assunto, tipoEnvio,
        fixo: true
      };
    }).filter(Boolean);

    try {
      cache.put(CACHE_KEY, JSON.stringify(resultado), CACHE_SEGUNDOS);
    } catch (ePut) {}

    Logger.log("listarPrestadoresFixos: total retornado = " + resultado.length);
    return resultado;

  } catch (e) {
    Logger.log("Erro listarPrestadoresFixos: " + e.message);
    return [];
  }
}

function limparCachePrestadoresFixos() {
  try {
    CacheService.getScriptCache().remove("sisgep_prestadores_fixos");
    return { ok: true, mensagem: "Cache de prestadores fixos limpo." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ================= CADASTRAR NOVO PRESTADOR ================= */

function cadastrarNovoPrestador(payload) {
  try {
    payload = payload || {};

    const nome               = String(payload.nome               || "").trim();
    const documento          = String(payload.documento          || "").trim();
    const emailPrestador     = String(payload.emailPrestador     || "").trim();
    const emailContabilidade = String(payload.emailContabilidade || "").trim();
    const telefone           = String(payload.telefone           || "").trim();
    const valor              = String(payload.valor              || "").trim();
    const vencimento         = String(payload.vencimento         || "").trim();

    if (!nome)      return { ok: false, mensagem: "Informe o nome do prestador." };
    if (!documento) return { ok: false, mensagem: "Informe o CPF/CNPJ do prestador." };

    const valDoc = validarDocumentoGuia_(documento);
    if (!valDoc.ok) return { ok: false, mensagem: valDoc.mensagem };

    const ss = SpreadsheetApp.openById(PLANILHA_ID);

    // ✅ Usa ABA_PRESTADORES_SERVICOS (mesma aba que listarPrestadoresFixos lê)
    let aba = ss.getSheetByName(ABA_PRESTADORES_SERVICOS);

    if (!aba) {
      aba = ss.insertSheet(ABA_PRESTADORES_SERVICOS);
      aba.appendRow([
        "DataHora","Nome do Prestador","Documento","E-mail do Prestador",
        "E-mail da Contabilidade","Telefone","Valor","Data de Vencimento"
      ]);
      aba.getRange(1, 1, 1, 8).setFontWeight("bold");
      aba.setFrozenRows(1);
    } else if (aba.getLastRow() === 0) {
      aba.appendRow([
        "DataHora","Nome do Prestador","Documento","E-mail do Prestador",
        "E-mail da Contabilidade","Telefone","Valor","Data de Vencimento"
      ]);
      aba.getRange(1, 1, 1, 8).setFontWeight("bold");
      aba.setFrozenRows(1);
    }

    aba.appendRow([
      new Date(), nome, documento, emailPrestador,
      emailContabilidade, telefone, valor, vencimento
    ]);

    // Limpa cache para que a nova entrada apareça na próxima busca
    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch (eCache) {}

    return {
      ok: true,
      mensagem: "Prestador cadastrado com sucesso.",
      prestador: { nome, documento, emailPrestador, emailContabilidade, telefone, valor, vencimento }
    };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao cadastrar prestador: " + e.message };
  }
}

/* ================= AÇÕES OPERACIONAIS ================= */

function marcarGuiaComoPaga(payload) {
  try {
    payload = payload || {};
    const id            = String(payload.id          || "").trim();
    const observacao    = String(payload.observacao  || "").trim();
    const dataPagamento = String(payload.dataPagamento || "").trim() || formatarDataHoraGuia_(new Date()).dataHora;

    if (!id) return { ok: false, mensagem: "ID da guia não informado." };

    const info = localizarLinhaGuiaPorId_(id);
    if (!info) return { ok: false, mensagem: "Guia não encontrada." };

    atualizarCamposGuia_(id, {
      "Status":        STATUS_GUIA.PAGO,
      "DataPagamento": dataPagamento,
      "Observacao":    observacao || "Pagamento registrado."
    });

    salvarHistoricoGuia({
      idGuia:             id,
      nome:               info.row[info.headerMap["Prestador"]]          || "",
      documento:          info.row[info.headerMap["Documento"]]          || "",
      emailPrestador:     info.row[info.headerMap["EmailPrestador"]]     || "",
      emailContabilidade: info.row[info.headerMap["EmailContabilidade"]] || "",
      valor:              info.row[info.headerMap["Valor"]]              || "",
      vencimento:         info.row[info.headerMap["Vencimento"]]         || "",
      descricao:          info.row[info.headerMap["Descricao"]]          || "",
      tipoEnvio:          info.row[info.headerMap["TipoEnvio"]]          || "",
      assunto:            info.row[info.headerMap["Assunto"]]            || "",
      destinoFinal:       info.row[info.headerMap["Destino"]]            || "",
      status:             STATUS_GUIA.PAGO,
      textoGuia:          info.row[info.headerMap["TextoGuia"]]          || "",
      acao:               "MARCAR_PAGO",
      numeroGuia:         info.headerMap["NumeroGuia"] !== undefined ? (info.row[info.headerMap["NumeroGuia"]] || "") : "",
      urlPdf:             info.headerMap["UrlPDF"]     !== undefined ? (info.row[info.headerMap["UrlPDF"]]     || "") : "",
      observacao:         observacao || "Guia marcada como paga."
    });

    return { ok: true, mensagem: "Guia marcada como paga com sucesso." };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao marcar guia como paga: " + e.message };
  }
}

function cancelarGuiaPagamento(payload) {
  try {
    payload = payload || {};
    const id         = String(payload.id         || "").trim();
    const observacao = String(payload.observacao || "").trim() || "Guia cancelada.";

    if (!id) return { ok: false, mensagem: "ID da guia não informado." };

    const info = localizarLinhaGuiaPorId_(id);
    if (!info) return { ok: false, mensagem: "Guia não encontrada." };

    atualizarCamposGuia_(id, {
      "Status":     STATUS_GUIA.CANCELADO,
      "Observacao": observacao
    });

    salvarHistoricoGuia({
      idGuia:             id,
      nome:               info.row[info.headerMap["Prestador"]]          || "",
      documento:          info.row[info.headerMap["Documento"]]          || "",
      emailPrestador:     info.row[info.headerMap["EmailPrestador"]]     || "",
      emailContabilidade: info.row[info.headerMap["EmailContabilidade"]] || "",
      valor:              info.row[info.headerMap["Valor"]]              || "",
      vencimento:         info.row[info.headerMap["Vencimento"]]         || "",
      descricao:          info.row[info.headerMap["Descricao"]]          || "",
      tipoEnvio:          info.row[info.headerMap["TipoEnvio"]]          || "",
      assunto:            info.row[info.headerMap["Assunto"]]            || "",
      destinoFinal:       info.row[info.headerMap["Destino"]]            || "",
      status:             STATUS_GUIA.CANCELADO,
      textoGuia:          info.row[info.headerMap["TextoGuia"]]          || "",
      acao:               "CANCELAMENTO",
      numeroGuia:         info.headerMap["NumeroGuia"] !== undefined ? (info.row[info.headerMap["NumeroGuia"]] || "") : "",
      urlPdf:             info.headerMap["UrlPDF"]     !== undefined ? (info.row[info.headerMap["UrlPDF"]]     || "") : "",
      observacao:         observacao
    });

    return { ok: true, mensagem: "Guia cancelada com sucesso." };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao cancelar guia: " + e.message };
  }
}

function obterResumoGuiasPagamento(filtros) {
  try {
    filtros = filtros || {};

    // ✅ Aplica janela de 90 dias quando nenhum filtro de data for informado,
    //    evitando varrer a planilha inteira em bases grandes
    if (!filtros.dataInicio && !filtros.dataFim) {
      const hoje = new Date();
      const h90  = new Date(hoje);
      h90.setDate(h90.getDate() - 90);
      filtros.dataInicio = Utilities.formatDate(h90, Session.getScriptTimeZone(), "yyyy-MM-dd");
      filtros.dataFim    = Utilities.formatDate(hoje, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }

    const rel   = listarRelatorioGuiasPagamento(filtros);
    const lista = rel && rel.ok && Array.isArray(rel.lista) ? rel.lista : [];

    const resumo = {
      totalGuias:    lista.length,
      totalValor:    0,
      totalPago:     0,
      totalPendente: 0,
      qtdVencidas:   0,
      qtdUrgentes:   0,
      qtdPagas:      0,
      qtdCanceladas: 0
    };

    lista.forEach(function(item) {
      const valor = normalizarValorNumeroGuia_(item.valor);
      resumo.totalValor += valor;

      if (item.status === STATUS_GUIA.PAGO) {
        resumo.totalPago += valor;
        resumo.qtdPagas++;
      } else if (item.status !== STATUS_GUIA.CANCELADO) {
        resumo.totalPendente += valor;
      }

      if (item.status === STATUS_GUIA.CANCELADO) resumo.qtdCanceladas++;
      if (item.statusVencimento === "VENCIDO" && item.status !== STATUS_GUIA.PAGO && item.status !== STATUS_GUIA.CANCELADO) resumo.qtdVencidas++;
      if (item.statusVencimento === "URGENTE" && item.status !== STATUS_GUIA.PAGO && item.status !== STATUS_GUIA.CANCELADO) resumo.qtdUrgentes++;
    });

    resumo.totalValor    = "R$ " + formatarValorBRGuia_(resumo.totalValor);
    resumo.totalPago     = "R$ " + formatarValorBRGuia_(resumo.totalPago);
    resumo.totalPendente = "R$ " + formatarValorBRGuia_(resumo.totalPendente);

    return { ok: true, resumo: resumo };

  } catch (e) {
    return { ok: false, mensagem: "Erro ao obter resumo das guias: " + e.message };
  }
}
/* ================= CADASTRO DE PRESTADORES — CRUD ================= */

const CABECALHO_PRESTADORES = [
  "ID", "DataHora", "Nome do Prestador", "Documento",
  "Contato", "Categoria",
  "E-mail do Prestador", "Telefone",
  "Valor", "Valor Variável", "Data de Vencimento", "Recorrencia",
  "Tipo de Envio", "Tipo de Documento", "Assunto",
  "Data Inicio", "Descricao", "Observacoes", "Ativo"
];

function garantirAbaPrestadores_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_PRESTADORES_SERVICOS);
  if (!aba) {
    aba = ss.insertSheet(ABA_PRESTADORES_SERVICOS);
    aba.appendRow(CABECALHO_PRESTADORES);
    aba.getRange(1, 1, 1, CABECALHO_PRESTADORES.length).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  return aba;
}

function listarTodosPrestadores(filtros) {
  try {
    filtros = filtros || {};
    var aba = garantirAbaPrestadores_();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return { ok: true, lista: [] };

    var dados = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h) { return String(h || "").trim(); });
    function idx(nome) { return headers.indexOf(nome); }

    var lista = [];
    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];
      var ativo = String(row[idx("Ativo")] || "").trim();
      if (ativo === "INATIVO") continue;

      var item = {
        rowIndex:           i + 1,
        id:                 String(row[idx("ID")]                  || "").trim(),
        dataHora:           String(row[idx("DataHora")]            || "").trim(),
        nome:               String(row[idx("Nome do Prestador")]   || "").trim(),
        documento:          String(row[idx("Documento")]           || "").trim(),
        contato:            String(row[idx("Contato")]             || "").trim(),
        categoria:          String(row[idx("Categoria")]           || "").trim(),
        emailPrestador:     String(row[idx("E-mail do Prestador")] || "").trim(),
        telefone:           String(row[idx("Telefone")]            || "").trim(),
        valor:              String(row[idx("Valor")]               || "").trim(),
        valorVariavel:      String(row[idx("Valor Variável")]      || "").trim() === "SIM",
        vencimento:         String(row[idx("Data de Vencimento")]  || "").trim(),
        recorrencia:        String(row[idx("Recorrencia")]         || "Mensal").trim(),
        tipoEnvio:          String(row[idx("Tipo de Envio")]       || "").trim(),
        tipoDoc:            String(row[idx("Tipo de Documento")]   || "").trim(),
        assunto:            String(row[idx("Assunto")]             || "").trim(),
        dataInicio:         String(row[idx("Data Inicio")]         || "").trim(),
        descricao:          String(row[idx("Descricao")]           || "").trim(),
        observacoes:        String(row[idx("Observacoes")]         || "").trim(),
        ativo:              ativo || "ATIVO"
      };

      if (!item.nome) continue;

      if (filtros.busca) {
        var busca = normalizarTextoGuia_(filtros.busca);
        var texto = normalizarTextoGuia_([item.nome, item.documento, item.emailPrestador, item.categoria].join(" "));
        if (texto.indexOf(busca) === -1) continue;
      }

      lista.push(item);
    }

    lista.sort(function(a, b) {
      return normalizarTextoGuia_(a.nome) < normalizarTextoGuia_(b.nome) ? -1 : 1;
    });

    return { ok: true, lista: lista, total: lista.length };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
function salvarPrestador(payload) {
  try {
    payload = payload || {};
    var nome      = String(payload.nome      || "").trim();
    var documento = String(payload.documento || "").trim();
    if (!nome)      return { ok: false, mensagem: "Informe o nome do fornecedor." };
    if (!documento) return { ok: false, mensagem: "Informe o CPF/CNPJ." };

    var valDoc = validarDocumentoGuia_(documento);
    if (!valDoc.ok) return { ok: false, mensagem: valDoc.mensagem };

    var aba     = garantirAbaPrestadores_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h){ return String(h || "").trim(); });

    function col(nomeCol) { return headers.indexOf(nomeCol) + 1; }

    // EDITAR
    if (payload.rowIndex && payload.rowIndex > 1) {
      var r = payload.rowIndex;
      if (col("Nome do Prestador")   > 0) aba.getRange(r, col("Nome do Prestador")).setValue(nome);
      if (col("Documento")           > 0) aba.getRange(r, col("Documento")).setValue(documento);
      if (col("Contato")             > 0) aba.getRange(r, col("Contato")).setValue(payload.contato            || "");
      if (col("Categoria")           > 0) aba.getRange(r, col("Categoria")).setValue(payload.categoria        || "");
      if (col("E-mail do Prestador") > 0) aba.getRange(r, col("E-mail do Prestador")).setValue(payload.emailPrestador || "");
      if (col("Telefone")            > 0) aba.getRange(r, col("Telefone")).setValue(payload.telefone          || "");
      if (col("Valor")               > 0) aba.getRange(r, col("Valor")).setValue(payload.valor               || "");
      if (col("Valor Variável")      > 0) aba.getRange(r, col("Valor Variável")).setValue(payload.valorVariavel === true || payload.valorVariavel === "true" ? "SIM" : "NÃO");
      if (col("Data de Vencimento")  > 0) aba.getRange(r, col("Data de Vencimento")).setValue(payload.vencimento     || "");
      if (col("Recorrencia")         > 0) aba.getRange(r, col("Recorrencia")).setValue(payload.recorrencia    || "Mensal");
      if (col("Tipo de Envio")       > 0) aba.getRange(r, col("Tipo de Envio")).setValue(payload.tipoEnvio    || "");
      if (col("Tipo de Documento")   > 0) aba.getRange(r, col("Tipo de Documento")).setValue(payload.tipoDoc  || "");
      if (col("Assunto")             > 0) aba.getRange(r, col("Assunto")).setValue(payload.assunto            || "");
      if (col("Data Inicio")         > 0) aba.getRange(r, col("Data Inicio")).setValue(payload.dataInicio     || "");
      if (col("Descricao")           > 0) aba.getRange(r, col("Descricao")).setValue(payload.descricao        || "");
      if (col("Observacoes")         > 0) aba.getRange(r, col("Observacoes")).setValue(payload.observacoes    || "");
      if (col("Ativo")               > 0) aba.getRange(r, col("Ativo")).setValue("ATIVO");
      try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
      return { ok: true, mensagem: "Fornecedor atualizado com sucesso." };
    }

    // NOVO
    var id        = "PREST_" + new Date().getTime();
    var novaLinha = new Array(headers.length).fill("");

    function set(nomeCol, valor) {
      var c = headers.indexOf(nomeCol);
      if (c > -1) novaLinha[c] = valor;
    }

    set("ID",                  id);
    set("DataHora",            new Date());
    set("Nome do Prestador",   nome);
    set("Documento",           documento);
    set("Contato",             payload.contato         || "");
    set("Categoria",           payload.categoria       || "");
    set("E-mail do Prestador", payload.emailPrestador  || "");
    set("Telefone",            payload.telefone        || "");
    set("Valor",               payload.valor           || "");
    set("Valor Variável",      payload.valorVariavel === true || payload.valorVariavel === "true" ? "SIM" : "NÃO");
    set("Data de Vencimento",  payload.vencimento      || "");
    set("Recorrencia",         payload.recorrencia     || "Mensal");
    set("Tipo de Envio",       payload.tipoEnvio       || "");
    set("Tipo de Documento",   payload.tipoDoc         || "");
    set("Assunto",             payload.assunto         || "");
    set("Data Inicio",         payload.dataInicio      || "");
    set("Descricao",           payload.descricao       || "");
    set("Observacoes",         payload.observacoes     || "");
    set("Ativo",               "ATIVO");

    aba.appendRow(novaLinha);
    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
    return { ok: true, mensagem: "Fornecedor cadastrado com sucesso.", id: id };

  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}
function excluirPrestador(rowIndex) {
  try {
    if (!rowIndex || rowIndex < 2) return { ok: false, mensagem: "Linha inválida." };
    var aba = garantirAbaPrestadores_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });
    var idxAtivo = headers.indexOf("Ativo");
    if (idxAtivo === -1) return { ok: false, mensagem: "Coluna Ativo não encontrada." };
    aba.getRange(rowIndex, idxAtivo + 1).setValue("INATIVO");
    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
    return { ok: true, mensagem: "Prestador removido com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function importarPrestadoresDoHistorico() {
  try {
    var sh = garantirAbaGuiasPagamento_();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, importados: 0, mensagem: "Nenhum registro no histórico." };

    var dados = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var headerMap = mapearCabecalhoGuia_(sh);

    var mapa = {};
    dados.forEach(function(row) {
      var nome = String(row[headerMap["Prestador"]] || "").trim();
      var doc  = onlyDigitsGuia_(row[headerMap["Documento"]] || "");
      if (!nome || !doc) return;
      var chave = doc || normalizarTextoGuia_(nome);
      if (mapa[chave]) return;
      mapa[chave] = {
        nome:               nome,
        documento:          String(row[headerMap["Documento"]]          || "").trim(),
        emailPrestador:     String(row[headerMap["EmailPrestador"]]      || "").trim(),
        emailContabilidade: String(row[headerMap["EmailContabilidade"]]  || "").trim(),
        valor:              String(row[headerMap["Valor"]]               || "").trim(),
        vencimento:         String(row[headerMap["Vencimento"]]          || "").trim(),
        descricao:          String(row[headerMap["Descricao"]]           || "").trim(),
        assunto:            String(row[headerMap["Assunto"]]             || "").trim(),
        tipoEnvio:          String(row[headerMap["TipoEnvio"]]           || "").trim()
      };
    });

    // Checa quais já existem na aba de prestadores
    var aba = garantirAbaPrestadores_();
    var existentes = aba.getLastRow() > 1
      ? aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues()
      : [];
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || "").trim(); });
    function idx(n) { return headers.indexOf(n); }

    var docExistentes = {};
    existentes.forEach(function(r) {
      var d = onlyDigitsGuia_(r[idx("Documento")] || "");
      if (d) docExistentes[d] = true;
    });

    var importados = 0;
    Object.values(mapa).forEach(function(p) {
      var docLimpo = onlyDigitsGuia_(p.documento);
      if (docExistentes[docLimpo]) return;
      var id = "PREST_IMP_" + new Date().getTime() + "_" + importados;
      var linha = new Array(CABECALHO_PRESTADORES.length).fill("");
      linha[idx("ID")]                        = id;
      linha[idx("DataHora")]                  = new Date();
      linha[idx("Nome do Prestador")]         = p.nome;
      linha[idx("Documento")]                 = p.documento;
      linha[idx("E-mail do Prestador")]       = p.emailPrestador;
      linha[idx("E-mail da Contabilidade")]   = p.emailContabilidade;
      linha[idx("Valor")]                     = p.valor;
      linha[idx("Data de Vencimento")]        = p.vencimento;
      linha[idx("Descricao")]                 = p.descricao;
      linha[idx("Assunto")]                   = p.assunto;
      linha[idx("TipoEnvio")]                 = p.tipoEnvio;
      linha[idx("Ativo")]                     = "ATIVO";
      aba.appendRow(linha);
      docExistentes[docLimpo] = true;
      importados++;
    });

    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
    return { ok: true, importados: importados, mensagem: importados + " prestador(es) importado(s) com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
/* ═══════════════════════════════════════════════════════════════
   LEMBRETES E CONFIRMAÇÃO DE PAGAMENTO
   ═══════════════════════════════════════════════════════════════ */

var DIAS_LEMBRETE_PRE_VENCIMENTO  = 3;
var EMAILS_NOTIFICACAO_FINANCEIRO = ["financeiro@sindeducacao.com"];

/* ---------------------------------------------------------------
   TOKENS DE CONFIRMAÇÃO (PropertiesService)
--------------------------------------------------------------- */
function gerarTokenConfirmacaoGuia_(idGuia) {
  var token = Utilities.getUuid().replace(/-/g, "");
  var props = PropertiesService.getScriptProperties();
  props.setProperty("TOKEN_GUIA_" + token, JSON.stringify({
    idGuia: idGuia,
    criado: new Date().getTime(),
    expira: new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
  }));
  return token;
}

function buscarGuiaPorToken_(token) {
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty("TOKEN_GUIA_" + token);
    if (!raw) return null;
    var dados = JSON.parse(raw);
    if (new Date().getTime() > dados.expira) return null;
    return dados;
  } catch(e) { return null; }
}

function invalidarTokenGuia_(token) {
  try {
    PropertiesService.getScriptProperties()
      .deleteProperty("TOKEN_GUIA_" + token);
  } catch(e) {}
}

/* ---------------------------------------------------------------
   CONFIRMAR PAGAMENTO (chamado pela página pública)
--------------------------------------------------------------- */
function confirmarPagamentoPublico(token, dados) {
  try {
    var info = buscarGuiaPorToken_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado. Solicite um novo envio." };

    dados = dados || {};
    var dataPagamento = String(dados.dataPagamento || "").trim();
    var observacao    = String(dados.observacao    || "").trim();
    var banco         = String(dados.banco         || "").trim();

    if (!dataPagamento) return { ok: false, mensagem: "Informe a data do pagamento." };

    var idGuia   = info.idGuia;
    var guiaInfo = localizarLinhaGuiaPorId_(idGuia);
    if (!guiaInfo) return { ok: false, mensagem: "Guia não encontrada no sistema." };

    var row       = guiaInfo.row;
    var headerMap = guiaInfo.headerMap;
    var nome      = String(row[headerMap["Prestador"]]  || "");
    var valor     = String(row[headerMap["Valor"]]       || "");
    var vencimento= String(row[headerMap["Vencimento"]] || "");
    var descricao = String(row[headerMap["Descricao"]]  || "");
    var numeroGuia= String(row[headerMap["NumeroGuia"]] || "");
    var statusAtual = String(row[headerMap["Status"]]   || "");

    if (statusAtual === STATUS_GUIA.PAGO) {
      return { ok: false, mensagem: "Este pagamento já foi confirmado anteriormente." };
    }

    var obsCompleta = "✅ Confirmado pela contabilidade em " + dataPagamento +
      (banco ? " | Banco/Forma: " + banco : "") +
      (observacao ? " | Obs: " + observacao : "");

    atualizarCamposGuia_(idGuia, {
      "Status":        STATUS_GUIA.PAGO,
      "DataPagamento": dataPagamento,
      "Observacao":    obsCompleta
    });

    salvarHistoricoGuia({
      idGuia: idGuia, nome: nome, documento: String(row[headerMap["Documento"]] || ""),
      emailPrestador: "", emailContabilidade: EMAILS_CONTABILIDADE_GS.join(", "),
      valor: valor, vencimento: vencimento, descricao: descricao,
      tipoEnvio: TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE,
      assunto: "Confirmação de pagamento", destinoFinal: "Contabilidade",
      status: STATUS_GUIA.PAGO, acao: "CONFIRMACAO_CONTABILIDADE",
      numeroGuia: numeroGuia, observacao: obsCompleta
    });

    // Notifica o financeiro
    try {
      MailApp.sendEmail({
        to:       EMAILS_NOTIFICACAO_FINANCEIRO.join(","),
        subject:  "✅ Pagamento confirmado — " + nome + (numeroGuia ? " (" + numeroGuia + ")" : ""),
        htmlBody: montarHtmlNotificacaoConfirmacao_(nome, valor, vencimento, dataPagamento, banco, observacao, numeroGuia),
        name:     "SISGEP · SindEducação-ES"
      });
    } catch(eEmail) {
      Logger.log("⚠ Falha ao notificar financeiro: " + eEmail.message);
    }

    invalidarTokenGuia_(token);

    return {
      ok: true,
      mensagem: "Pagamento confirmado com sucesso! O financeiro do SindEducação-ES foi notificado.",
      nome: nome, valor: valor, numeroGuia: numeroGuia
    };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao confirmar pagamento: " + e.message };
  }
}

function obterDadosGuiaPorToken(token) {
  try {
    var info = buscarGuiaPorToken_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado." };

    var guiaInfo = localizarLinhaGuiaPorId_(info.idGuia);
    if (!guiaInfo) return { ok: false, mensagem: "Guia não encontrada." };

    var row       = guiaInfo.row;
    var headerMap = guiaInfo.headerMap;
    var status    = String(row[headerMap["Status"]] || "");

    return {
      ok: true,
      jaConfirmado: status === STATUS_GUIA.PAGO,
      nome:         String(row[headerMap["Prestador"]]  || ""),
      valor:        String(row[headerMap["Valor"]]       || ""),
      vencimento:   formatarDataBRGuia_(String(row[headerMap["Vencimento"]] || "")),
      descricao:    String(row[headerMap["Descricao"]]  || ""),
      numeroGuia:   String(row[headerMap["NumeroGuia"]] || ""),
      status:       status
    };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ---------------------------------------------------------------
   LEMBRETES AUTOMÁTICOS (disparado por trigger)
--------------------------------------------------------------- */
function verificarEEnviarLembretesNF() {
  try {
    var sh      = garantirAbaGuiasPagamento_();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    var dados     = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var headerMap = mapearCabecalhoGuia_(sh);
    var hoje      = new Date(); hoje.setHours(0, 0, 0, 0);

    dados.forEach(function(row) {
      var id        = String(row[headerMap["ID"]]              || "").trim();
      var status    = String(row[headerMap["Status"]]          || "").trim();
      var tipoEnvio = String(row[headerMap["TipoEnvio"]]       || "").trim();
      var vencimento= String(row[headerMap["Vencimento"]]      || "").trim();
      var emailPrest= String(row[headerMap["EmailPrestador"]]  || "").trim();

      if (!id || !vencimento || !emailPrest) return;
      if (status === STATUS_GUIA.PAGO || status === "NF_RECEBIDA" ||
          status === STATUS_GUIA.CANCELADO) return;
      if (tipoEnvio !== TIPO_ENVIO_GUIA.SOLICITAR_NF) return;

      var dataVenc = converterDataBRouISOEmDate_(vencimento);
      if (isNaN(dataVenc.getTime())) return;
      dataVenc.setHours(0, 0, 0, 0);

      var diffDias = Math.floor((dataVenc - hoje) / 86400000);

      // Lembretes D-5 até D-1
      if (DIAS_LEMBRETE_NF_ANTES.indexOf(diffDias) > -1) {
        enviarLembreteNF_(id, row, headerMap, "antes", diffDias);
        return;
      }

      // Lembrete D+0
      if (diffDias === 0) {
        enviarLembreteNF_(id, row, headerMap, "hoje", 0);
        return;
      }

      // Lembretes D+1 até D+5
      if (DIAS_LEMBRETE_NF_DEPOIS.indexOf(-diffDias) > -1) {
        enviarLembreteNF_(id, row, headerMap, "vencido", Math.abs(diffDias));
        return;
      }

      // ✅ REENVIO AUTOMÁTICO — após D+5, reenvia link a cada 15 dias
      // enquanto a NF não chegar (máximo 90 dias após vencimento)
      var diasAposVenc = Math.abs(diffDias);
      if (diasAposVenc > 5 && diasAposVenc <= 90) {
        if (diasAposVenc % 15 === 0) {
          enviarLembreteNF_(id, row, headerMap, "reenvio", diasAposVenc);
        }
      }
    });

    Logger.log("✅ Verificação de lembretes de NF concluída.");
  } catch(e) {
    Logger.log("❌ Erro em verificarEEnviarLembretesNF: " + e.message);
  }
}
function enviarLembreteGuia_(idGuia, row, headerMap, tipo, dias) {
  try {
    var nome      = String(row[headerMap["Prestador"]]  || "").trim();
    var valor     = String(row[headerMap["Valor"]]       || "").trim();
    var vencimento= String(row[headerMap["Vencimento"]] || "").trim();
    var descricao = String(row[headerMap["Descricao"]]  || "").trim();
    var numeroGuia= String(row[headerMap["NumeroGuia"]] || "").trim();
    var vencBr    = formatarDataBRGuia_(vencimento);

    var token           = gerarTokenConfirmacaoGuia_(idGuia);
    var urlBase         = ScriptApp.getService().getUrl();
    var linkConfirmacao = urlBase + "?page=pub-confirmar-guia&token=" + token;

    var assunto;
    if (tipo === "pre_vencimento") {
      assunto = "\u23F0 Lembrete: Pagamento em " + dias + " dia(s) \u2014 " + nome;
    } else if (tipo === "vencendo_hoje") {
      assunto = "\uD83D\uDD14 HOJE: Vencimento de pagamento \u2014 " + nome;
    } else {
      assunto = "\u26A0\uFE0F ATRASADO " + dias + " dia(s) \u2014 " + nome;
    }

    var htmlBody = montarHtmlLembreteGuia_(
      nome, valor, vencBr, descricao, tipo, dias, linkConfirmacao, numeroGuia
    );

    MailApp.sendEmail({
      to:      EMAILS_CONTABILIDADE_GS.join(","),
      subject: assunto,
      htmlBody: htmlBody,
      name:    "SindEduca\u00e7\u00e3o-ES",
      bcc:     EMAILS_NOTIFICACAO_FINANCEIRO.join(",")
    });

    Logger.log("Lembrete [" + tipo + "] enviado para guia " + idGuia);
  } catch(e) {
    Logger.log("\u26A0 Erro ao enviar lembrete guia " + idGuia + ": " + e.message);
  }
}

/* ---------------------------------------------------------------
   HTML DOS EMAILS
--------------------------------------------------------------- */
function montarHtmlLembreteGuia_(nome, valor, vencBr, descricao, tipo, dias, linkConfirmacao, numeroGuia) {
  var corBarra, emoji, titulo, subtitulo;

  if (tipo === "pre_vencimento") {
    corBarra = "#1565C0"; emoji = "\u23F0";
    titulo   = "Lembrete de Pagamento Pendente";
    subtitulo= "O pagamento abaixo vence em <strong>" + dias + " dia(s)</strong>.";
  } else if (tipo === "vencendo_hoje") {
    corBarra = "#d97706"; emoji = "\uD83D\uDD14";
    titulo   = "Pagamento com Vencimento HOJE";
    subtitulo= "O pagamento abaixo vence <strong>hoje</strong>. Por favor, efetue o pagamento.";
  } else {
    corBarra = "#dc2626"; emoji = "\u26A0\uFE0F";
    titulo   = "Pagamento ATRASADO \u2014 " + dias + " dia(s)";
    subtitulo= "O pagamento abaixo est\u00e1 em atraso h\u00e1 <strong>" + dias + " dia(s)</strong>.";
  }

  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">' +
    '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid ' + corBarra + ';">' +
      '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gest\u00e3o de Processos \u2014 SISGEP</div>' +
    '</div>' +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
      '<h2 style="color:#001f4d;margin:0 0 8px;">' + emoji + ' ' + titulo + '</h2>' +
      '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">' + subtitulo + '</p>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ' + corBarra + ';border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
          (numeroGuia ? '<tr><td style="padding:5px 0;font-weight:700;width:120px;">N\u00ba Guia:</td><td>' + numeroGuia + '</td></tr>' : '') +
          '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td>' + nome + '</td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong style="font-size:16px;">' + valor + '</strong></td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
          (descricao ? '<tr><td style="padding:5px 0;font-weight:700;">Descri\u00e7\u00e3o:</td><td>' + descricao + '</td></tr>' : '') +
        '</table>' +
      '</div>' +
      '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">Ap\u00f3s efetuar o pagamento, por favor <strong>clique no bot\u00e3o abaixo</strong> para confirmar e notificar o financeiro do SindEduca\u00e7\u00e3o-ES.</p>' +
      '<div style="text-align:center;margin:24px 0;">' +
        '<a href="' + linkConfirmacao + '" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#fff;font-weight:800;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(5,150,105,.35);">✅ Confirmar Pagamento</a>' +
      '</div>' +
      '<p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;">Se n\u00e3o conseguir clicar no bot\u00e3o, copie e cole este link:<br><span style="color:#1565C0;">' + linkConfirmacao + '</span></p>' +
    '</div>' +
    '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
      '<div style="font-size:11px;color:rgba(255,255,255,.5);">Gerado automaticamente pelo SISGEP \u00b7 SindEduca\u00e7\u00e3o-ES</div>' +
    '</div>' +
  '</div>';
}

function montarHtmlNotificacaoConfirmacao_(nome, valor, vencimento, dataPagamento, banco, observacao, numeroGuia) {
  var vencBr = formatarDataBRGuia_(vencimento);
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;color:#0f172a;">' +
    '<div style="background:#001f4d;padding:20px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #059669;">' +
      '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">SISGEP \u2014 Notifica\u00e7\u00e3o de Pagamento</div>' +
    '</div>' +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
      '<h2 style="color:#059669;margin:0 0 16px;">✅ Pagamento Confirmado!</h2>' +
      '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">A contabilidade confirmou o pagamento abaixo:</p>' +
      '<div style="background:#f0fdf4;border:1px solid #6ee7b7;border-left:4px solid #059669;border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
          (numeroGuia ? '<tr><td style="padding:5px 0;font-weight:700;width:140px;">N\u00ba Guia:</td><td>' + numeroGuia + '</td></tr>' : '') +
          '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td>' + nome + '</td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong>' + valor + '</strong></td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Data Pgto:</td><td><strong>' + dataPagamento + '</strong></td></tr>' +
          (banco ? '<tr><td style="padding:5px 0;font-weight:700;">Banco/Forma:</td><td>' + banco + '</td></tr>' : '') +
          (observacao ? '<tr><td style="padding:5px 0;font-weight:700;">Observa\u00e7\u00e3o:</td><td>' + observacao + '</td></tr>' : '') +
        '</table>' +
      '</div>' +
      '<p style="color:#475569;font-size:13px;margin:0;">A guia foi atualizada automaticamente no SISGEP com status <strong>PAGO</strong>.</p>' +
    '</div>' +
    '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
      '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP \u00b7 SindEduca\u00e7\u00e3o-ES</div>' +
    '</div>' +
  '</div>';
}

/* ---------------------------------------------------------------
   TRIGGER
--------------------------------------------------------------- */
function instalarTriggerLembretesGuias() {
  // Remove trigger existente se houver
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarEEnviarLembretesGuias") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Instala trigger diário às 8h
  ScriptApp.newTrigger("verificarEEnviarLembretesGuias")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log("✅ Trigger de lembretes instalado — executa diariamente às 8h.");
}

function removerTriggerLembretesGuias() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarEEnviarLembretesGuias") {
      ScriptApp.deleteTrigger(t);
      Logger.log("Trigger removido.");
    }
  });
}
/* ═══════════════════════════════════════════════════════════════
   COBRANÇA DE NF — LEMBRETES E PORTAL DE UPLOAD
   ═══════════════════════════════════════════════════════════════ */

var EMAILS_DESTINO_NF = [
  "secretaria@sindeducacao.com",
  "financeiro@sindeducacao.com"
];

var DIAS_LEMBRETE_NF_ANTES  = [5, 4, 3, 2, 1];
var DIAS_LEMBRETE_NF_DEPOIS = [1, 2, 3, 4, 5];

/* ---------------------------------------------------------------
   TOKEN DO PRESTADOR
--------------------------------------------------------------- */
function gerarTokenEnvioNF_(idGuia) {
  var token = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(
    "TOKEN_NF_" + token,
    JSON.stringify({
      idGuia:  idGuia,
      criado:  new Date().getTime(),
      expira:  new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
    })
  );
  return token;
}

function buscarTokenEnvioNF_(token) {
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty("TOKEN_NF_" + token);
    if (!raw) return null;
    var dados = JSON.parse(raw);
    if (new Date().getTime() > dados.expira) return null;
    return dados;
  } catch(e) { return null; }
}

function invalidarTokenEnvioNF_(token) {
  try {
    PropertiesService.getScriptProperties()
      .deleteProperty("TOKEN_NF_" + token);
  } catch(e) {}
}

/* ---------------------------------------------------------------
   OBTER DADOS DA GUIA PELO TOKEN (chamado pelo portal)
--------------------------------------------------------------- */
function obterDadosGuiaPorTokenNF(token) {
  try {
    var info = buscarTokenEnvioNF_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado." };

    var guiaInfo = localizarLinhaGuiaPorId_(info.idGuia);
    if (!guiaInfo) return { ok: false, mensagem: "Guia não encontrada." };

    var row       = guiaInfo.row;
    var headerMap = guiaInfo.headerMap;
    var status    = String(row[headerMap["Status"]] || "");

    if (status === STATUS_GUIA.PAGO || status === "NF_RECEBIDA") {
      return { ok: false, jaEnviado: true, mensagem: "Nota fiscal já recebida para esta guia." };
    }

    return {
      ok:         true,
      nome:       String(row[headerMap["Prestador"]]  || ""),
      valor:      String(row[headerMap["Valor"]]       || ""),
      vencimento: formatarDataBRGuia_(String(row[headerMap["Vencimento"]] || "")),
      descricao:  String(row[headerMap["Descricao"]]  || ""),
      numeroGuia: String(row[headerMap["NumeroGuia"]] || "")
    };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ---------------------------------------------------------------
   RECEBER UPLOAD DA NF (chamado pelo portal)
--------------------------------------------------------------- */
function receberUploadNF(token, dadosNF) {
  try {
    var info = buscarTokenEnvioNF_(token);
    if (!info) return { ok: false, mensagem: "Link inválido ou expirado." };

    dadosNF = dadosNF || {};
    var arquivos = dadosNF.arquivos || [];
    var texto    = String(dadosNF.texto || "").trim();

    if (!arquivos.length) return { ok: false, mensagem: "Nenhum arquivo recebido." };

    var idGuia   = info.idGuia;
    var guiaInfo = localizarLinhaGuiaPorId_(idGuia);
    if (!guiaInfo) return { ok: false, mensagem: "Guia não encontrada." };

    var row       = guiaInfo.row;
    var headerMap = guiaInfo.headerMap;
    var nome      = String(row[headerMap["Prestador"]]      || "");
    var valor     = String(row[headerMap["Valor"]]           || "");
    var vencimento= String(row[headerMap["Vencimento"]]     || "");
    var descricao = String(row[headerMap["Descricao"]]      || "");
    var numeroGuia= String(row[headerMap["NumeroGuia"]]     || "");

    var pasta       = obterOuCriarSubpastaAno(PASTA_RECIBOS_ID || PASTA_OFICIOS_ID);
    var anexosEmail = [];
    var nomesArquivos = [];

    arquivos.forEach(function(arq, i) {
      var base64  = String(arq.base64 || "").trim();
      var nomeArq = String(arq.nome   || ("NF_" + (i+1) + ".pdf")).trim();
      var tipoArq = String(arq.tipo   || "application/pdf").trim();
      if (!base64) return;

      var nomeFormatado = "NF_" + nome.replace(/\s+/g,"_") +
        "_" + (numeroGuia || idGuia) + "_" + (i+1) + "_" + nomeArq;

      var blob    = Utilities.newBlob(Utilities.base64Decode(base64), tipoArq, nomeFormatado);
      var arquivo = pasta.createFile(blob);
      anexosEmail.push(blob.setName(arquivo.getName()));
      nomesArquivos.push(arquivo.getName());
    });

    if (!anexosEmail.length) return { ok: false, mensagem: "Nenhum arquivo válido recebido." };

    var obsCompleta = "NF recebida via portal em " +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") +
      " | Arquivos: " + nomesArquivos.join(", ") +
      (texto ? " | Obs: " + texto : "");

    atualizarCamposGuia_(idGuia, {
      "Status":     "NF_RECEBIDA",
      "Observacao": obsCompleta
    });

    salvarHistoricoGuia({
      idGuia: idGuia, nome: nome,
      documento:          String(row[headerMap["Documento"]]      || ""),
      emailPrestador:     String(row[headerMap["EmailPrestador"]] || ""),
      emailContabilidade: EMAILS_DESTINO_NF.join(", "),
      valor: valor, vencimento: vencimento, descricao: descricao,
      tipoEnvio:   TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE,
      assunto:     "NF recebida via portal",
      destinoFinal: EMAILS_DESTINO_NF.join(", "),
      status:      "NF_RECEBIDA",
      acao:        "NF_RECEBIDA_PORTAL",
      numeroGuia:  numeroGuia,
      observacao:  obsCompleta
    });

    var htmlEncaminhamento = montarHtmlEncaminhamentoNF_(
      nome, valor, formatarDataBRGuia_(vencimento),
      descricao, numeroGuia, "", texto, nomesArquivos
    );

    MailApp.sendEmail({
      to:          EMAILS_DESTINO_NF.join(","),
      subject:     "\uD83D\uDCCB NF Recebida \u2014 " + nome +
                   (numeroGuia ? " (" + numeroGuia + ")" : "") +
                   " \u2014 " + anexosEmail.length + " arquivo(s)",
      htmlBody:    htmlEncaminhamento,
      attachments: anexosEmail,
      name:        "SISGEP \u00b7 SindEduca\u00e7\u00e3o-ES"
    });

    invalidarTokenEnvioNF_(token);

    return {
      ok: true,
      mensagem: "Nota(s) fiscal(is) enviada(s) com sucesso! Nossa equipe foi notificada."
    };

  } catch(e) {
    return { ok: false, mensagem: "Erro ao processar: " + e.message };
  }
}
function enviarLembreteNF_(idGuia, row, headerMap, tipo, dias) {
  try {
    var nome       = String(row[headerMap["Prestador"]]      || "").trim();
    var valor      = String(row[headerMap["Valor"]]           || "").trim();
    var vencimento = String(row[headerMap["Vencimento"]]     || "").trim();
    var descricao  = String(row[headerMap["Descricao"]]      || "").trim();
    var numeroGuia = String(row[headerMap["NumeroGuia"]]     || "").trim();
    var emailPrest = String(row[headerMap["EmailPrestador"]] || "").trim();
    var telefone   = String(row[headerMap["Telefone"]]       || "").trim();
    var vencBr     = formatarDataBRGuia_(vencimento);

    var token       = gerarTokenEnvioNF_(idGuia);
    var urlBase     = ScriptApp.getService().getUrl();
    var linkEnvioNF = urlBase + "?page=pub-envio-nf&token=" + token;

    // ✅ Pixel de rastreamento
    var urlPixel = urlBase + "?page=pub-pixel-nf&t=" + token;

    // Link WhatsApp
    var telLimpo     = String(telefone).replace(/\D/g, "");
    var linkWhatsApp = "";
    if (telLimpo.length >= 10) {
      var telFull = (telLimpo.length === 10 || telLimpo.length === 11)
        ? "55" + telLimpo : telLimpo;
      var textoWpp = encodeURIComponent(
        "Olá " + nome + "! 👋\n\n" +
        "Este é um lembrete do SindEducação-ES.\n\n" +
        "📋 Sua nota fiscal referente ao serviço abaixo ainda não foi recebida:\n" +
        "💰 Valor: " + valor + "\n" +
        "📅 Vencimento: " + vencBr + "\n" +
        (descricao ? "📝 Descrição: " + descricao + "\n" : "") +
        "\n🔗 Envie sua NF pelo link:\n" + linkEnvioNF
      );
      linkWhatsApp = "https://wa.me/" + telFull + "?text=" + textoWpp;
    }

    var corBarra, emoji, titulo, subtitulo, assunto;

    if (tipo === "antes") {
      emoji     = "⏰";
      corBarra  = "#1565C0";
      assunto   = emoji + " Lembrete: Envie sua NF — vence em " + dias + " dia(s)";
      titulo    = "Lembrete de Envio de Nota Fiscal";
      subtitulo = "Seu pagamento vence em <strong>" + dias + " dia(s)</strong> (" + vencBr + "). " +
                  "Por favor, envie sua nota fiscal clicando no botão abaixo.";
    } else if (tipo === "hoje") {
      emoji     = "🔔";
      corBarra  = "#d97706";
      assunto   = emoji + " HOJE: Envie sua NF — vencimento hoje!";
      titulo    = "Vencimento HOJE — Envie sua Nota Fiscal";
      subtitulo = "O pagamento vence <strong>hoje</strong> (" + vencBr + "). " +
                  "Envie sua nota fiscal agora clicando no botão abaixo.";
    } else if (tipo === "vencido") {
      emoji     = "⚠️";
      corBarra  = "#dc2626";
      assunto   = emoji + " NF ATRASADA " + dias + " dia(s) — " + nome;
      titulo    = "Nota Fiscal ATRASADA — " + dias + " dia(s)";
      subtitulo = "Não identificamos o envio da sua nota fiscal. " +
                  "O vencimento era <strong>" + vencBr + "</strong> (" + dias + " dia(s) atrás). " +
                  "Por favor, regularize o quanto antes.";
    } else {
      emoji     = "🔁";
      corBarra  = "#7c3aed";
      assunto   = emoji + " Reenvio: Nota fiscal pendente — " + nome;
      titulo    = "Nota Fiscal ainda pendente";
      subtitulo = "Ainda não recebemos sua nota fiscal. " +
                  "O vencimento era <strong>" + vencBr + "</strong>. " +
                  "Por favor, regularize o quanto antes.";
    }

    // Botão WhatsApp
    var botaoWhatsApp = linkWhatsApp
      ? '<div style="text-align:center;margin-top:12px;">' +
          '<a href="' + linkWhatsApp + '" target="_blank" ' +
          'style="display:inline-block;background:linear-gradient(135deg,#25d366,#128c7e);' +
          'color:#fff;font-weight:800;font-size:14px;padding:12px 28px;border-radius:999px;' +
          'text-decoration:none;box-shadow:0 6px 20px rgba(37,211,102,.35);">📱 Enviar pelo WhatsApp</a>' +
        '</div>'
      : '';

    var htmlBody =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">' +
        '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid ' + corBarra + ';">' +
          '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gestão de Processos — SISGEP</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
          '<h2 style="color:#001f4d;margin:0 0 8px;">' + emoji + ' ' + titulo + '</h2>' +
          '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">' + subtitulo + '</p>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ' + corBarra + ';border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
              (numeroGuia ? '<tr><td style="padding:5px 0;font-weight:700;width:120px;">Nº Guia:</td><td>' + numeroGuia + '</td></tr>' : '') +
              '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong style="font-size:16px;">' + valor + '</strong></td></tr>' +
              '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
              (descricao ? '<tr><td style="padding:5px 0;font-weight:700;">Descrição:</td><td>' + descricao + '</td></tr>' : '') +
            '</table>' +
          '</div>' +
          '<p style="color:#475569;margin:0 0 16px;line-height:1.7;">Clique no botão abaixo para enviar sua nota fiscal pelo nosso portal seguro:</p>' +
          '<div style="text-align:center;margin:0 0 8px;">' +
            '<a href="' + linkEnvioNF + '" target="_blank" ' +
            'style="display:inline-block;background:linear-gradient(135deg,#1565C0,#003b82);' +
            'color:#fff;font-weight:800;font-size:15px;padding:14px 36px;border-radius:999px;' +
            'text-decoration:none;box-shadow:0 6px 20px rgba(21,101,192,.35);">📋 Enviar Nota Fiscal</a>' +
          '</div>' +
          botaoWhatsApp +
          '<p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;">Ou copie e cole este link:<br>' +
            '<span style="color:#1565C0;">' + linkEnvioNF + '</span></p>' +
        '</div>' +
        '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
          '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES · financeiro@sindeducacao.com</div>' +
        '</div>' +
        // ✅ Pixel de rastreamento invisível
        '<img src="' + urlPixel + '" width="1" height="1" style="display:none;" alt="">' +
      '</div>';

    MailApp.sendEmail({
      to:       emailPrest,
      subject:  assunto,
      htmlBody: htmlBody,
      name:     "SindEducação-ES",
      bcc:      "financeiro@sindeducacao.com"
    });

    // ✅ Registra no histórico de lembretes
    registrarLembreteEnviado_(idGuia, tipo, emailPrest, "EMAIL");
    if (linkWhatsApp) registrarLembreteEnviado_(idGuia, tipo, telefone, "WHATSAPP_LINK");

    Logger.log("Lembrete NF [" + tipo + " " + dias + "d] enviado para " + emailPrest + " — Guia " + idGuia);
  } catch(e) {
    Logger.log("⚠ Erro ao enviar lembrete NF " + idGuia + ": " + e.message);
  }
}
/* ---------------------------------------------------------------
   HTML ENCAMINHAMENTO DA NF PARA SECRETARIA/FINANCEIRO
--------------------------------------------------------------- */
function montarHtmlEncaminhamentoNF_(nome, valor, vencBr, descricao, numeroGuia, urlNF, texto, nomesArquivos) {
  var listaArquivos = "";
  if (Array.isArray(nomesArquivos) && nomesArquivos.length) {
    listaArquivos = nomesArquivos.map(function(n, i) {
      return '<div style="padding:6px 10px;background:#eff6ff;border-radius:8px;font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:6px;">' +
        '\uD83D\uDCCB ' + (i+1) + '. ' + n +
      '</div>';
    }).join("");
  }

  var blocoTexto = texto
    ? '<div style="margin-top:16px;padding:14px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#78350f;line-height:1.6;">' +
        '<strong style="display:block;margin-bottom:6px;">Observa\u00e7\u00f5es do prestador:</strong>' +
        texto +
      '</div>'
    : '';

  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;color:#0f172a;">' +
    '<div style="background:#001f4d;padding:20px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #1565C0;">' +
      '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDU\u00c7\u00c3O-ES</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">SISGEP \u2014 Nota(s) Fiscal(is) Recebida(s)</div>' +
    '</div>' +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
      '<h2 style="color:#1565C0;margin:0 0 16px;">\uD83D\uDCCB Nota(s) Fiscal(is) Recebida(s)!</h2>' +
      '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">O prestador enviou ' +
        (Array.isArray(nomesArquivos) ? nomesArquivos.length : 1) +
        ' arquivo(s) via portal. Os arquivos est\u00e3o em anexo.</p>' +
      '<div style="background:#eff6ff;border:1px solid #93c5fd;border-left:4px solid #1565C0;border-radius:10px;padding:16px 18px;margin-bottom:16px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
          (numeroGuia ? '<tr><td style="padding:5px 0;font-weight:700;width:140px;">N\u00ba Guia:</td><td>' + numeroGuia + '</td></tr>' : '') +
          '<tr><td style="padding:5px 0;font-weight:700;">Prestador:</td><td><strong>' + nome + '</strong></td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Valor:</td><td><strong>' + valor + '</strong></td></tr>' +
          '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td>' + vencBr + '</td></tr>' +
          (descricao ? '<tr><td style="padding:5px 0;font-weight:700;">Descri\u00e7\u00e3o:</td><td>' + descricao + '</td></tr>' : '') +
        '</table>' +
      '</div>' +
      (listaArquivos ? '<div style="margin-bottom:16px;"><strong style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Arquivos anexados</strong><div style="margin-top:8px;">' + listaArquivos + '</div></div>' : '') +
      blocoTexto +
      '<p style="color:#475569;font-size:13px;margin-top:16px;">A guia foi atualizada automaticamente para <strong>NF_RECEBIDA</strong> no SISGEP.</p>' +
    '</div>' +
    '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
      '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP \u00b7 SindEduca\u00e7\u00e3o-ES</div>' +
    '</div>' +
  '</div>';
}

/* ---------------------------------------------------------------
   INSTALAR TRIGGER
--------------------------------------------------------------- */
function instalarTriggerLembretesNF() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarEEnviarLembretesNF") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("verificarEEnviarLembretesNF")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  Logger.log("\u2705 Trigger de lembretes NF instalado \u2014 executa diariamente \u00e0s 8h.");
}
/* ═══════════════════════════════════════════════════════════════
   DASHBOARD DE PENDÊNCIAS
   ═══════════════════════════════════════════════════════════════ */
function obterDashboardPendencias() {
  try {
    var sh      = garantirAbaGuiasPagamento_();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, nfPendentes: [], pagamentoPendente: [], resumo: { nf: 0, pagamento: 0, total: 0 } };

    var dados     = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var headerMap = mapearCabecalhoGuia_(sh);
    var hoje      = new Date(); hoje.setHours(0, 0, 0, 0);

    var nfPendentes      = [];
    var pagamentoPendente = [];

    dados.forEach(function(row) {
      var id        = String(row[headerMap["ID"]]          || "").trim();
      var status    = String(row[headerMap["Status"]]      || "").trim().toUpperCase();
      var tipoEnvio = String(row[headerMap["TipoEnvio"]]   || "").trim();
      var vencimento= String(row[headerMap["Vencimento"]]  || "").trim();
      var nome      = String(row[headerMap["Prestador"]]   || "").trim();
      var valor     = String(row[headerMap["Valor"]]        || "").trim();
      var numero    = String(row[headerMap["NumeroGuia"]]  || "").trim();
      var email     = String(row[headerMap["EmailPrestador"]] || "").trim();

      if (!id || !vencimento) return;
      if (status === STATUS_GUIA.CANCELADO) return;

      var dataVenc = converterDataBRouISOEmDate_(vencimento);
      if (isNaN(dataVenc.getTime())) return;
      dataVenc.setHours(0, 0, 0, 0);

      var diffDias = Math.floor((dataVenc - hoje) / 86400000);
      var vencBr   = formatarDataBRGuia_(vencimento);

      // NF pendente — tipo solicitar_nf e ainda não recebida
      if (tipoEnvio === TIPO_ENVIO_GUIA.SOLICITAR_NF &&
          status !== "NF_RECEBIDA" && status !== STATUS_GUIA.PAGO) {
        nfPendentes.push({
          id: id, nome: nome, valor: valor, vencimento: vencBr,
          numero: numero, email: email, diffDias: diffDias,
          urgencia: diffDias < 0 ? "vencida" : diffDias <= 3 ? "urgente" : "normal"
        });
      }

      // Pagamento pendente — tipo enviar_contabilidade e não pago
      if (tipoEnvio === TIPO_ENVIO_GUIA.ENVIAR_CONTABILIDADE &&
          status !== STATUS_GUIA.PAGO && status !== STATUS_GUIA.CANCELADO) {
        pagamentoPendente.push({
          id: id, nome: nome, valor: valor, vencimento: vencBr,
          numero: numero, diffDias: diffDias,
          urgencia: diffDias < 0 ? "vencida" : diffDias <= 3 ? "urgente" : "normal"
        });
      }
    });

    // Ordena: vencidas primeiro, depois urgentes, depois normais
    function ordenar(lista) {
      return lista.sort(function(a, b) { return a.diffDias - b.diffDias; });
    }

    nfPendentes       = ordenar(nfPendentes);
    pagamentoPendente = ordenar(pagamentoPendente);

    return {
      ok: true,
      nfPendentes:      nfPendentes,
      pagamentoPendente: pagamentoPendente,
      resumo: {
        nf:       nfPendentes.length,
        pagamento: pagamentoPendente.length,
        total:    nfPendentes.length + pagamentoPendente.length
      }
    };

  } catch(e) {
    return { ok: false, mensagem: e.message, nfPendentes: [], pagamentoPendente: [], resumo: { nf: 0, pagamento: 0, total: 0 } };
  }
}
/* ═══════════════════════════════════════════════════════════════
   HISTÓRICO DE LEMBRETES
   ═══════════════════════════════════════════════════════════════ */

var ABA_HISTORICO_LEMBRETES = "HISTORICO_LEMBRETES";

function registrarLembreteEnviado_(idGuia, tipo, emailDestino, canal) {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_HISTORICO_LEMBRETES);

    if (!aba) {
      aba = ss.insertSheet(ABA_HISTORICO_LEMBRETES);
      aba.appendRow([
        "ID_GUIA", "DATA_HORA", "TIPO", "CANAL",
        "EMAIL_DESTINO", "PRESTADOR", "VALOR",
        "VENCIMENTO", "NUMERO_GUIA"
      ]);
      aba.getRange(1, 1, 1, 9).setFontWeight("bold");
      aba.setFrozenRows(1);
    }

    aba.appendRow([
      idGuia,
      new Date(),
      tipo,
      canal || "EMAIL",
      emailDestino || "",
      "", "", "", ""
    ]);
  } catch(e) {
    Logger.log("⚠ registrarLembreteEnviado_: " + e.message);
  }
}

function contarLembretesEnviados_(idGuia) {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_HISTORICO_LEMBRETES);
    if (!aba || aba.getLastRow() < 2) return 0;

    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues();
    return dados.filter(function(r) {
      return String(r[0] || "").trim() === idGuia;
    }).length;
  } catch(e) { return 0; }
}

function listarLembretesGuia(idGuia) {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_HISTORICO_LEMBRETES);
    if (!aba || aba.getLastRow() < 2) return { ok: true, lista: [] };

    var dados   = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h){ return String(h||"").trim(); });
    var resultado = [];

    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];
      if (String(row[headers.indexOf("ID_GUIA")] || "").trim() !== idGuia) continue;
      resultado.push({
        dataHora:    formatarDataHoraBRGuia_(row[headers.indexOf("DATA_HORA")]),
        tipo:        String(row[headers.indexOf("TIPO")]         || ""),
        canal:       String(row[headers.indexOf("CANAL")]        || ""),
        emailDest:   String(row[headers.indexOf("EMAIL_DESTINO")]|| "")
      });
    }

    resultado.sort(function(a, b) {
      return b.dataHora.localeCompare(a.dataHora);
    });

    return { ok: true, lista: resultado, total: resultado.length };
  } catch(e) {
    return { ok: false, mensagem: e.message, lista: [] };
  }
}

function obterResumoLembretes() {
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName(ABA_HISTORICO_LEMBRETES);
    if (!aba || aba.getLastRow() < 2) {
      return { ok: true, total: 0, hoje: 0, semana: 0, porTipo: {} };
    }

    var dados   = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h){ return String(h||"").trim(); });
    var idxData = headers.indexOf("DATA_HORA");
    var idxTipo = headers.indexOf("TIPO");

    var hoje   = new Date(); hoje.setHours(0,0,0,0);
    var semana = new Date(hoje); semana.setDate(semana.getDate() - 7);

    var total = 0, qtdHoje = 0, qtdSemana = 0;
    var porTipo = {};

    for (var i = 1; i < dados.length; i++) {
      var dataVal = dados[i][idxData];
      var tipo    = String(dados[i][idxTipo] || "").trim();
      if (!dataVal) continue;

      var dataLembrete = new Date(dataVal);
      dataLembrete.setHours(0,0,0,0);

      total++;
      if (dataLembrete.getTime() === hoje.getTime())     qtdHoje++;
      if (dataLembrete.getTime() >= semana.getTime())    qtdSemana++;
      if (!porTipo[tipo]) porTipo[tipo] = 0;
      porTipo[tipo]++;
    }

    return { ok: true, total: total, hoje: qtdHoje, semana: qtdSemana, porTipo: porTipo };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}
/* ═══════════════════════════════════════════════════════════════
   PRESTADORES SEM EMAIL
   ═══════════════════════════════════════════════════════════════ */

function listarPrestadoresSemEmail() {
  try {
    var aba     = garantirAbaPrestadores_();
    var lastRow = aba.getLastRow();
    if (lastRow < 2) return { ok: true, lista: [], total: 0 };

    var dados   = aba.getDataRange().getValues();
    var headers = dados[0].map(function(h){ return String(h||"").trim(); });

    function col(nome){ return headers.indexOf(nome); }

    var lista = [];
    for (var i = 1; i < dados.length; i++) {
      var row   = dados[i];
      var ativo = String(row[col("Ativo")] || "").trim();
      if (ativo === "INATIVO") continue;

      var email = String(row[col("E-mail do Prestador")] || "").trim();
      if (email) continue;

      var nome      = String(row[col("Nome do Prestador")] || "").trim();
      var documento = String(row[col("Documento")]          || "").trim();
      var telefone  = String(row[col("Telefone")]           || "").trim();
      var valor     = String(row[col("Valor")]              || "").trim();
      var tipoEnvio = String(row[col("TipoEnvio")]          || "").trim();

      if (!nome) continue;

      lista.push({
        rowIndex:    i + 1,
        nome:        nome,
        documento:   documento,
        telefone:    telefone,
        valor:       valor,
        tipoEnvio:   tipoEnvio,
        temTelefone: !!telefone
      });
    }

    lista.sort(function(a, b){
      return String(a.nome).localeCompare(String(b.nome), "pt-BR", { sensitivity: "base" });
    });

    return {
      ok:          true,
      lista:       lista,
      total:       lista.length,
      comTelefone: lista.filter(function(p){ return p.temTelefone;  }).length,
      semTelefone: lista.filter(function(p){ return !p.temTelefone; }).length
    };
  } catch(e) {
    return { ok: false, mensagem: e.message, lista: [] };
  }
}

function salvarEmailPrestadorRapido(rowIndex, email) {
  try {
    if (!rowIndex || rowIndex < 2) return { ok: false, mensagem: "Linha inválida." };
    if (!email || !emailValido(email)) return { ok: false, mensagem: "E-mail inválido." };

    var aba     = garantirAbaPrestadores_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h){ return String(h||"").trim(); });
    var idxEmail = headers.indexOf("E-mail do Prestador");
    if (idxEmail === -1) return { ok: false, mensagem: "Coluna de e-mail não encontrada." };

    aba.getRange(rowIndex, idxEmail + 1).setValue(email);
    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
    return { ok: true, mensagem: "E-mail salvo com sucesso." };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}
/* ═══════════════════════════════════════════════════════════════
   PIXEL DE RASTREAMENTO DE LEITURA
   ═══════════════════════════════════════════════════════════════ */

function guiasPagamento_registrarLeituraEmail(token) {
  try {
    if (!token) return;
    var props = PropertiesService.getScriptProperties();
    var chave = "LEITURA_NF_" + token;
    var raw   = props.getProperty(chave);

    if (raw) {
      // Já registrado — incrementa contador
      var dados = JSON.parse(raw);
      dados.acessos = (dados.acessos || 1) + 1;
      dados.ultimoAcesso = new Date().getTime();
      props.setProperty(chave, JSON.stringify(dados));
    } else {
      props.setProperty(chave, JSON.stringify({
        token:        token,
        primeiraLeitura: new Date().getTime(),
        ultimoAcesso: new Date().getTime(),
        acessos:      1
      }));
    }

    // Atualiza a guia correspondente
    var infoNF = buscarTokenEnvioNF_(token);
    if (infoNF && infoNF.idGuia) {
      var guiaInfo = localizarLinhaGuiaPorId_(infoNF.idGuia);
      if (guiaInfo) {
        var headerMap = guiaInfo.headerMap;
        var sh        = garantirAbaGuiasPagamento_();
        var dados2    = sh.getDataRange().getValues();
        for (var i = 1; i < dados2.length; i++) {
          var id = String(dados2[i][headerMap["ID"]] || "").trim();
          if (id !== infoNF.idGuia) continue;
          var obs = String(dados2[i][headerMap["Observacao"]] || "").trim();
          var dataLeitura = Utilities.formatDate(
            new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"
          );
          if (obs.indexOf("Email aberto") === -1) {
            sh.getRange(i + 1, headerMap["Observacao"] + 1)
              .setValue((obs ? obs + " | " : "") + "Email aberto em " + dataLeitura);
          }
          break;
        }
      }
    }
  } catch(e) {
    Logger.log("⚠ registrarLeituraEmail: " + e.message);
  }
}

function obterStatusLeituraEmail(token) {
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty("LEITURA_NF_" + token);
    if (!raw) return { lido: false };
    var dados = JSON.parse(raw);
    return {
      lido:           true,
      acessos:        dados.acessos || 1,
      primeiraLeitura: dados.primeiraLeitura
        ? Utilities.formatDate(new Date(dados.primeiraLeitura), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : "",
      ultimoAcesso: dados.ultimoAcesso
        ? Utilities.formatDate(new Date(dados.ultimoAcesso), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : ""
    };
  } catch(e) { return { lido: false }; }
}
function salvarEmailETelefonePrestadorRapido(rowIndex, email, telefone) {
  try {
    if (!rowIndex || rowIndex < 2) return { ok: false, mensagem: "Linha inválida." };
    if (!email || !emailValido(email)) return { ok: false, mensagem: "E-mail inválido." };

    var aba     = garantirAbaPrestadores_();
    var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      .map(function(h){ return String(h||"").trim(); });

    var idxEmail    = headers.indexOf("E-mail do Prestador");
    var idxTelefone = headers.indexOf("Telefone");

    if (idxEmail === -1) return { ok: false, mensagem: "Coluna de e-mail não encontrada." };

    aba.getRange(rowIndex, idxEmail + 1).setValue(email);
    if (idxTelefone > -1 && telefone) {
      aba.getRange(rowIndex, idxTelefone + 1).setValue(telefone);
    }

    try { CacheService.getScriptCache().remove("sisgep_prestadores_fixos"); } catch(e) {}
    return { ok: true, mensagem: "Dados salvos com sucesso." };
  } catch(e) {
    return { ok: false, mensagem: e.message };
  }
}