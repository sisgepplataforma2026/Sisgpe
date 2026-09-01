// =========================
// ARQUIVO: Recibo.gs
// ✅ Estrutura do módulo de Recibos
// ✅ Helpers operacionais
// ✅ Numeração segura
// ✅ Geração de PDF
// ✅ Registro de beneficiários
// ✅ Salvar / abrir lote
// ✅ Sem histórico/relatório neste arquivo
// =========================

/* ================= ESTRUTURA ================= */
function garantirEstruturaModuloRecibos_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  let shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);
  if (!shProc) shProc = ss.insertSheet(ABA_RECIBO_PROCESSOS);

  if (shProc.getLastRow() === 0) {
    shProc.appendRow([
      "ID_PROCESSO",
      "DATA_CADASTRO",
      "PROCESSO",
      "EMPRESA",
      "OBSERVACOES",
      "STATUS",
      "USUARIO",
      "TOTAL_BENEFICIARIOS",
      "VALOR_TOTAL",
      "TIPO_REGISTRO",
      "LINK_REFERENCIA"
    ]);
  }

  let shBen = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);
  if (!shBen) shBen = ss.insertSheet(ABA_RECIBO_BENEFICIARIOS);

  if (shBen.getLastRow() === 0) {
    shBen.appendRow([
      "ID_PROCESSO",
      "NUMERO_RECIBO",
      "CODIGO_VALIDACAO",
      "DATA_GERACAO",
      "NOME",
      "CPF",
      "VALOR",
      "VALOR_EXTENSO",
      "PIX",
      "TIPO_PIX",
      "EMAIL",
      "WHATSAPP",
      "SINDICALIZADO",
      "STATUS_ENVIO_EMAIL",
      "STATUS_ENVIO_WHATSAPP",
      "LINK_PDF",
      "USUARIO_GERADOR",
      "OBSERVACOES",
      "FORMA_PAGAMENTO",
      "CHEQUE_NUMERO",
      "CHEQUE_DATA",
      "STATUS_ASSINATURA",
      "DATA_RETORNO_ASSINADO",
      "OBS_RETORNO_ASSINADO"
    ]);
  } else {
    [
      "FORMA_PAGAMENTO",
      "CHEQUE_NUMERO",
      "CHEQUE_DATA",
      "STATUS_ASSINATURA",
      "DATA_RETORNO_ASSINADO",
      "OBS_RETORNO_ASSINADO"
    ].forEach(function(col){
      garantirColunaReciboSeNaoExistir_(shBen, col);
    });
  }
}

function garantirColunaReciboSeNaoExistir_(sheet, nomeColuna) {
  if (!sheet || !nomeColuna) return;

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  if (headers.indexOf(nomeColuna) > -1) return;

  sheet
    .getRange(1, sheet.getLastColumn() + 1)
    .setValue(nomeColuna);
}

function gerarIdProcessoRecibo_() {
  return "PROC-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}
function registrarProcessoRecibo_(dados) {
  garantirEstruturaModuloRecibos_();

  dados = dados || {};

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

  if (!sh) {
    throw new Error("Aba de processos de recibo não encontrada.");
  }

  const idProcesso = dados.idProcesso || gerarIdProcessoRecibo_();

  const linha = [
    idProcesso,
    new Date(),
    String(dados.processo || "").trim(),
    String(dados.empresa || "").trim(),
    String(dados.observacoes || "").trim(),
    String(dados.status || "CADASTRADO").trim(),
    String(dados.usuario || "").trim(),
    dados.totalBeneficiarios || 0,
    String(dados.valorTotal || "").trim(),
    String(dados.tipoRegistro || "PROCESSO").trim(),
    String(dados.linkReferencia || "").trim()
  ];

  sh.appendRow(linha);

  return idProcesso;
}

/* ================= HELPERS ================= */
function normalizarBooleanoSN_(valor) {
  const v = String(valor || "").trim().toLowerCase();

  if (["sim", "s", "true", "1", "yes"].includes(v)) return "SIM";
  if (["nao", "não", "n", "false", "0", "no"].includes(v)) return "NÃO";

  return "";
}

function normalizarTipoPix_(tipo, pix) {
  const t = String(tipo || "").trim().toLowerCase();
  const p = String(pix || "").trim();

  if (t) return t.toUpperCase();
  if (!p) return "";

  if (emailValido(p)) return "EMAIL";

  const dig = p.replace(/\D/g, "");

  if (dig.length === 11) return "CPF";
  if (dig.length >= 10 && dig.length <= 13) return "TELEFONE";

  return "ALEATÓRIA";
}

function normalizarValorMonetario_(valor) {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor).trim();
  if (!texto) return "";

  const limpo = texto
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const num = parseFloat(limpo);
  if (isNaN(num)) return "";

  return num.toFixed(2).replace(".", ",");
}

function somarValoresBeneficiarios_(beneficiarios) {
  let total = 0;

  (beneficiarios || []).forEach(function(b) {
    const v = String((b && b.valor) || "")
      .replace(/\./g, "")
      .replace(",", ".");

    const n = parseFloat(v);

    if (!isNaN(n)) total += n;
  });

  return total.toFixed(2).replace(".", ",");
}

function normalizarTelefoneBR_(telefone) {
  let fone = String(telefone || "").replace(/\D/g, "");

  if (fone.startsWith("55") && fone.length > 11) {
    fone = fone.substring(2);
  }

  if (fone.length === 8 || fone.length === 9) {
    fone = "27" + fone;
  }

  if (fone.length > 11) {
    fone = fone.slice(-11);
  }

  if (fone.length < 10 || fone.length > 11) return "";

  return fone;
}

function formatarTelefoneBR_(telefone) {
  const fone = normalizarTelefoneBR_(telefone);

  if (!fone) return "";

  if (fone.length === 11) {
    return "(" +
      fone.substring(0, 2) +
      ") " +
      fone.substring(2, 7) +
      "-" +
      fone.substring(7);
  }

  return "(" +
    fone.substring(0, 2) +
    ") " +
    fone.substring(2, 6) +
    "-" +
    fone.substring(6);
}

function gerarLinkWhatsAppRecibo_(telefone, nome, numero, empresa, processo, urlPdf) {
  const numeroLimpo = normalizarTelefoneBR_(telefone || "");
  if (!numeroLimpo) return "";

  const mensagem =
    "Olá, " + (nome || "beneficiário(a)") + ". Tudo bem?\n\n" +
    "Estamos enviando o link do seu recibo referente ao processo nº " + (processo || "") +
    " (" + (empresa || "") + ").\n\n" +
    "📄 Recibo: " + (numero || "") + "\n\n" +
    "👉 Acesse seu recibo no link abaixo:\n" + (urlPdf || "") + "\n\n" +
    "📌 Para finalizar, siga os passos abaixo:\n\n" +
    "1. Abra o recibo no link acima\n" +
    "2. Imprima o documento\n" +
    "3. Assine o recibo\n" +
    "4. Tire uma foto ou escaneie\n" +
    "5. Envie para nós por este WhatsApp ou por e-mail\n\n" +
    "✅ Você também pode assinar digitalmente, se preferir.\n\n" +
    "⚠️ Importante: O recibo só será considerado válido após o envio assinado.\n\n" +
    "Se tiver qualquer dúvida, pode nos chamar.\n\n" +
    "Atenciosamente,\n" +
    "SINDEDUCAÇÃO-ES";

  return "https://wa.me/55" + numeroLimpo + "?text=" + encodeURIComponent(mensagem);
}

function normalizarNomeReciboBusca_(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/* ================= NUMERAÇÃO ================= */
function gerarNumeroReciboSeguro() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const config = ss.getSheetByName("CONFIG");

    if (!config) {
      throw new Error("Aba CONFIG não encontrada no SISGEP.");
    }

    const anoAtual = new Date().getFullYear().toString();
    const rotuloAno = "ANO_RECIBO";
    const rotuloSeq = "SEQ_RECIBO";

    const dados = config.getDataRange().getValues();

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

    return "REC-" + String(proximo).padStart(3, "0") + "/" + anoAtual;

  } catch (e) {
    throw new Error(
      "Não foi possível gerar o número do recibo. Detalhe: " + e.message
    );
  } finally {
    lock.releaseLock();
  }
}

/* ================= CONFIG RECIBO ================= */
function buscarConfigRecibo(tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  const sheet = SpreadsheetApp
    .openById(PLANILHA_ID)
    .getSheetByName("CONFIG");

  if (!sheet) {
    throw new Error("Aba CONFIG não encontrada.");
  }

  const dados = sheet.getDataRange().getValues();

  const retorno = {
    processo: "",
    empresa: "",
    pix: ""
  };

  const norm = function(v) {
    return String(v || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "");
  };

  dados.forEach(function(linha) {
    const chave = norm(linha[0]);
    const valor = String(linha[1] || "").trim();

    if (chave === "processo" || chave.includes("processo")) {
      retorno.processo = retorno.processo || valor;
    }

    if (chave === "empresa" || chave.includes("empresa") || chave.includes("razao social")) {
      retorno.empresa = retorno.empresa || valor;
    }

    if (chave === "pix" || chave.includes("pix") || chave.includes("chave pix")) {
      retorno.pix = retorno.pix || valor;
    }
  });

  return retorno;
}

function gerarCodigoVerificacao(numero) {
  try {
    var base = String(numero || "") + "_" + new Date().getTime();

    var hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      base
    );

    var codigo = hash.map(function(b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return ("0" + v).slice(-2);
    }).join("");

    return codigo.substring(0, 12).toUpperCase();

  } catch (e) {
    return "COD" + Math.floor(Math.random() * 99999999);
  }
}


function formatarValorMonetarioBR_(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "0,00";
  }

  var texto = String(valor)
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "");

  if (texto.indexOf(",") > -1 && texto.indexOf(".") > -1) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.indexOf(",") > -1) {
    texto = texto.replace(",", ".");
  }

  var numero = parseFloat(texto);
  if (isNaN(numero)) numero = 0;

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ================= PDF ================= */
function gerarPDFRecibo(dados) {
  dados = dados || {};

  const numero   = gerarNumeroReciboSeguro();
  const codigo   = gerarCodigoVerificacao(numero);
  /* getRecursoId_ no lugar de PASTA_RECIBO_ID: aquela constante vale PRODUÇÃO
     em qualquer ambiente. Ver AmbienteRecursos.gs. */
  const pastaAno = obterOuCriarSubpastaAno(getRecursoId_("RECIBOS"));

  const nome = String(dados.nome || "").trim().toUpperCase();

  // ✅ Três tiers de tamanho para nomes longos
  const nomeTier = nome.length > 40 ? "xs"
                 : nome.length > 26 ? "sm"
                 : "";

  const cpf  = formatarCPF(String(dados.cpf || "").trim());

  const processo = String(dados.processo || "").trim();
  const empresa  = String(dados.empresa  || "").trim();

  const forma = String(dados.formaPagamento || "PIX").toUpperCase() === "CHEQUE"
    ? "CHEQUE"
    : "PIX";

  const tipoPix = String(dados.tipoPix || "").trim().toUpperCase();

  const pix = formatarPix(
    String(dados.pix || "").trim(),
    tipoPix
  );

  const chequeBanco   = String(dados.chequeBanco   || "Sicoob").trim();
  const chequeAgencia = String(dados.chequeAgencia || "3010").trim();
  const chequeSerie   = String(dados.chequeSerie   || "001").trim();
  const chequeNum     = String(dados.chequeNumero  || "").trim();

  const chequeData = dados.chequeData
    ? formatarDataExtensoBR(new Date(dados.chequeData))
    : "";

  const obs = String(dados.observacao || "").trim();

  const tipoPixTexto = {
    CPF: "CPF",
    TELEFONE: "Telefone",
    EMAIL: "E-mail",
    ALEATORIA: "Aleatória"
  };

  const rotuloPagamento = forma === "CHEQUE"
    ? "🏦 PAGAMENTO VIA CHEQUE"
    : "⚡ PAGAMENTO VIA PIX";

// ← DEPOIS (nas duas funções):
const textoPgto = forma === "CHEQUE"
    ? "<strong>Banco:</strong> " + chequeBanco +
      "<br><strong>Agência:</strong> " + chequeAgencia +
      "<br><strong>Série:</strong> " + chequeSerie +
      "<br><strong>Cheque Nº:</strong> " + chequeNum
    : "<strong>Chave:</strong> " + pix;

  const textoPgtoCorpo = forma === "CHEQUE"
    ? "mediante emissão de cheque nº " + chequeNum +
      ", Banco " + chequeBanco +
      ", Agência " + chequeAgencia +
      ", Série " + chequeSerie +
      (chequeData ? ", com vencimento em " + chequeData : "")
    : "via chave Pix (" + (tipoPixTexto[tipoPix] || "PIX") + "): " + pix;

  const imgs = carregarImagensRecibo_();

  const iniciais = nome
    .split(" ")
    .filter(function(p) { return p && p.length > 2; })
    .slice(0, 3)
    .map(function(p) { return p[0].toUpperCase(); })
    .join("");

  var html = gerarHtmlReciboCompleto_({
    nome:            nome,
    nomeTier:        nomeTier,        // ✅ substitui nomeGrande
    cpf:             cpf,
    valorFmt:        formatarValorMonetarioBR_(dados.valor || "0"),
    valorExt:        valorPorExtenso(dados.valor || "0").toLowerCase(),
    processo:        processo,
    empresa:         empresa,
    formaPagamento:  forma,
    rotuloPagamento: rotuloPagamento,
    textoPgto:       textoPgto,
    textoPgtoCorpo:  textoPgtoCorpo,
    obs:             obs,
    obsTexto:        obs ? "Observações: " + obs + ". " : "",
    dataHoje:        formatarDataExtensoBR(new Date()),
    numero:          numero,
    codigo:          codigo,
    iniciais:        iniciais,
    logoBase64:      imgs.logoBase64,
    logoMime:        imgs.logoMime,
    assBase64:       imgs.assBase64,
    assMime:         imgs.assMime
  }, false);

  var nomeArquivo = (
    "Recibo " +
    String(numero || "").replace(/\//g, "-") +
    " - " +
    nome +
    " - Em face de " +
    empresa +
    " - Proc " +
    processo
  )
  .replace(/[\\/:*?"<>|]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

  var pdfFile = recibo_converterHtmlParaPdf_(html, nomeArquivo, pastaAno);

  try {
    arquivoAplicarPolitica_(pdfFile, "Recibo.gs");
  } catch(e) {}

  const fileId = pdfFile.getId();

  return {
    pdf:      pdfFile,
    numero:   numero,
    codigo:   codigo,
    url:      "https://drive.google.com/file/d/" + fileId + "/preview",
    download: "https://drive.google.com/uc?export=download&id=" + fileId
  };
}

/* ================= REGISTRAR ================= */
function registrarBeneficiarioRecibo_(dados) {
  garantirEstruturaModuloRecibos_();

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

  const headers = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  const idx = function(nomeColuna) {
    return headers.indexOf(nomeColuna);
  };

  const linha = new Array(headers.length).fill("");

  function setCol(nomeColuna, valor) {
    var i = idx(nomeColuna);
    if (i > -1) linha[i] = valor;
  }

  setCol("ID_PROCESSO", dados.idProcesso || "");
  setCol("NUMERO_RECIBO", dados.numeroRecibo || "");
  setCol("CODIGO_VALIDACAO", dados.codigo || "");
  setCol("DATA_GERACAO", new Date());
  setCol("NOME", dados.nome || "");
  setCol("CPF", dados.cpf || "");
  setCol("VALOR", dados.valor || "");
  setCol("VALOR_EXTENSO", valorPorExtenso(dados.valor || "0"));
  setCol("PIX", dados.pix || "");
  setCol("TIPO_PIX", dados.tipoPix || "");
  setCol("EMAIL", dados.email || "");
  setCol("WHATSAPP", dados.whatsapp || "");
  setCol("SINDICALIZADO", dados.sindicalizado || "");
  setCol("STATUS_ENVIO_EMAIL", dados.statusEmail || "");
  setCol("STATUS_ENVIO_WHATSAPP", dados.statusWhatsapp || "");
  setCol("LINK_PDF", dados.linkPdf || "");
  setCol("USUARIO_GERADOR", dados.usuario || "");
  setCol("OBSERVACOES", dados.observacoes || "");

  setCol("FORMA_PAGAMENTO", dados.formaPagamento || "PIX");
  setCol("CHEQUE_NUMERO", dados.chequeNumero || "");
  setCol("CHEQUE_DATA", dados.chequeData || "");

  setCol("STATUS_ASSINATURA", dados.statusAssinatura || "");
  setCol("DATA_RETORNO_ASSINADO", dados.dataRetornoAssinado || "");
  setCol("OBS_RETORNO_ASSINADO", dados.obsRetornoAssinado || "");

  sh.appendRow(linha);
}

function atualizarResumoProcessoRecibo_(idProcesso) {
  garantirEstruturaModuloRecibos_();

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);
  const beneficiarios = listarBeneficiariosPorProcessoRecibo(idProcesso);

  if (!shProc || shProc.getLastRow() < 2) return;

  const dados = shProc.getDataRange().getValues();
  const cab = dados[0].map(function(h) {
    return String(h || "").trim();
  });

  const idxId     = cab.indexOf("ID_PROCESSO");
  const idxTotal  = cab.indexOf("TOTAL_BENEFICIARIOS");
  const idxValor  = cab.indexOf("VALOR_TOTAL");
  const idxStatus = cab.indexOf("STATUS");
  const idxLink   = cab.indexOf("LINK_REFERENCIA");

  const totalBenef = beneficiarios.length;
  const valorTotal = somarValoresBeneficiarios_(beneficiarios);
  const linkRef = totalBenef > 0 ? (beneficiarios[0].linkPdf || "") : "";

  for (var i = 1; i < dados.length; i++) {
    if (
      String(dados[i][idxId] || "").trim() !==
      String(idProcesso || "").trim()
    ) {
      continue;
    }

    var linhaAtual = shProc.getRange(i + 1, 1, 1, cab.length).getValues()[0];

    if (idxTotal  > -1) linhaAtual[idxTotal]  = totalBenef;
    if (idxValor  > -1) linhaAtual[idxValor]  = valorTotal;
    if (idxLink   > -1) linhaAtual[idxLink]   = linkRef;

    if (idxStatus > -1) {
      const statusAtual = String(dados[i][idxStatus] || "").trim().toUpperCase();

      if (!statusAtual || statusAtual === "CADASTRADO") {
        linhaAtual[idxStatus] = totalBenef > 0 ? "GERADO" : "CADASTRADO";
      }
    }

    shProc.getRange(i + 1, 1, 1, cab.length).setValues([linhaAtual]);
    break;
  }
}
/* ================= LOTE ================= */
function atualizarCabecalhoProcessoRecibo_(idProcesso, dadosCabecalho) {
  garantirEstruturaModuloRecibos_();

  const alvo = String(idProcesso || "").trim();

  if (!alvo) {
    throw new Error("ID do processo não informado.");
  }

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

  if (!sh || sh.getLastRow() < 2) {
    throw new Error("Aba de processos não encontrada.");
  }

  const dados = sh.getDataRange().getValues();
  const cab = dados[0].map(function(h) {
    return String(h || "").trim();
  });

  const idxId      = cab.indexOf("ID_PROCESSO");
  const idxProc    = cab.indexOf("PROCESSO");
  const idxEmp     = cab.indexOf("EMPRESA");
  const idxObs     = cab.indexOf("OBSERVACOES");
  const idxStatus  = cab.indexOf("STATUS");
  const idxUsuario = cab.indexOf("USUARIO");
  const idxTotal   = cab.indexOf("TOTAL_BENEFICIARIOS");
  const idxValor   = cab.indexOf("VALOR_TOTAL");
  const idxTipo    = cab.indexOf("TIPO_REGISTRO");

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId] || "").trim() !== alvo) {
      continue;
    }

    // Lê a linha inteira, atualiza em memória, grava de uma vez
    var linhaAtual = sh.getRange(i + 1, 1, 1, cab.length).getValues()[0];

    if (idxProc    > -1) linhaAtual[idxProc]    = dadosCabecalho.processo          || "";
    if (idxEmp     > -1) linhaAtual[idxEmp]     = dadosCabecalho.empresa           || "";
    if (idxObs     > -1) linhaAtual[idxObs]     = dadosCabecalho.observacoes       || "";
    if (idxStatus  > -1) linhaAtual[idxStatus]  = dadosCabecalho.status            || "RASCUNHO";
    if (idxUsuario > -1) linhaAtual[idxUsuario] = dadosCabecalho.usuario           || "";
    if (idxTotal   > -1) linhaAtual[idxTotal]   = dadosCabecalho.totalBeneficiarios || 0;
    if (idxValor   > -1) linhaAtual[idxValor]   = dadosCabecalho.valorTotal        || "";
    if (idxTipo    > -1) linhaAtual[idxTipo]    = dadosCabecalho.tipoRegistro      || "PROCESSO";

    sh.getRange(i + 1, 1, 1, cab.length).setValues([linhaAtual]);
    return;
  }

  throw new Error("Processo não encontrado para atualização.");
}

function limparBeneficiariosRascunhoDoProcessoRecibo_(idProcesso) {
  garantirEstruturaModuloRecibos_();

  const alvo = String(idProcesso || "").trim();
  if (!alvo) return;

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

  if (!sh || sh.getLastRow() < 2) return;

  const dados = sh.getDataRange().getValues();
  const cab = dados[0].map(function(h) {
    return String(h || "").trim();
  });

  const idxId = cab.indexOf("ID_PROCESSO");
  const idxNr = cab.indexOf("NUMERO_RECIBO");

  if (idxId === -1 || idxNr === -1) return;

  for (let i = dados.length - 1; i >= 1; i--) {
    const idLinha = String(dados[i][idxId] || "").trim();
    const numeroRecibo = String(dados[i][idxNr] || "").trim();

    if (idLinha === alvo && !numeroRecibo) {
      sh.deleteRow(i + 1);
    }
  }
}

function normalizarBeneficiarioEntradaRecibo_(b, idx, exigirPagamento) {

  const nome = String((b && b.nome) || "").trim();

  const cpf = String((b && b.cpf) || "")
    .replace(/\D/g, "")
    .trim();

  const pix = String((b && b.pix) || "").trim();

  const valor = normalizarValorMonetario_(
    (b && b.valor) || ""
  );

  const emailBenef = String((b && b.email) || "").trim();

  const whatsapp = String((b && b.whatsapp) || "").trim();

  const sindicalizado = normalizarBooleanoSN_(
    (b && b.sindicalizado) || ""
  );

  const observacoes = String(
    (b && (b.observacao || b.observacoes)) || ""
  ).trim();

  let formaPagamento = String(
    (b && b.formaPagamento) || ""
  ).trim().toUpperCase();

  const chequeBanco = String(
    (b && b.chequeBanco) || "Sicoob"
  ).trim();

  const chequeAgencia = String(
    (b && b.chequeAgencia) || "3010"
  ).trim();

  const chequeSerie = String(
    (b && b.chequeSerie) || "001"
  ).trim();

  const chequeNumero = String(
    (b && b.chequeNumero) || ""
  ).trim();

  const chequeData = String(
    (b && b.chequeData) || ""
  ).trim();

  if (!formaPagamento) {
    formaPagamento = chequeNumero ? "CHEQUE" : "PIX";
  }

  if (formaPagamento !== "CHEQUE") {
    formaPagamento = "PIX";
  }

  // ── Validações obrigatórias ──────────────────────────────────────

  if (!nome) {
    throw new Error(
      "Beneficiário inválido na linha " + (idx + 1) + ": nome não informado."
    );
  }

  if (!cpf) {
    throw new Error(
      "Beneficiário inválido na linha " + (idx + 1) + ": CPF não informado."
    );
  }

  // ✅ Valida dígitos verificadores do CPF
  var cpfCheck = validarCpfComFeedback(cpf);
  if (!cpfCheck.valido) {
    throw new Error(
      "Beneficiário inválido na linha " + (idx + 1) +
      " (" + nome + "): " + cpfCheck.mensagem
    );
  }

  if (!valor) {
    throw new Error(
      "Beneficiário inválido na linha " + (idx + 1) + ": valor não informado."
    );
  }

  if (exigirPagamento) {

    if (formaPagamento === "PIX" && !pix) {
      throw new Error(
        "Beneficiário inválido na linha " + (idx + 1) + ": chave PIX não informada."
      );
    }

    if (formaPagamento === "CHEQUE" && !chequeNumero) {
      throw new Error(
        "Beneficiário inválido na linha " + (idx + 1) + ": número do cheque não informado."
      );
    }
  }

  return {
    nome: nome,

    cpf: cpf,

    pix: formaPagamento === "PIX" ? pix : "",

    valor: valor,

    email: emailBenef,

    whatsapp: whatsapp,

    sindicalizado: sindicalizado,

    observacoes: observacoes,

    formaPagamento: formaPagamento,

    chequeBanco: formaPagamento === "CHEQUE" ? chequeBanco : "",

    chequeAgencia: formaPagamento === "CHEQUE" ? chequeAgencia : "",

    chequeSerie: formaPagamento === "CHEQUE" ? chequeSerie : "",

    chequeNumero: formaPagamento === "CHEQUE" ? chequeNumero : "",

    chequeData: formaPagamento === "CHEQUE" ? chequeData : "",

    tipoPix: normalizarTipoPix_(
      (b && b.tipoPix) || "",
      pix
    ),

    emailOk: emailBenef ? emailValido(emailBenef) : true
  };
}
/* ================= SALVAR / ABRIR LOTE ================= */
function salvarLoteRecibo(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    const emailUsuario = obterEmailUsuarioAtual_() || "usuario@sisgep.local";

    garantirEstruturaModuloRecibos_();

    dados = dados || {};

    const processo = String(dados.processo || "").trim();
    const empresa = String(dados.empresa || "").trim();
    const observacoesGerais = String(dados.observacoes || "").trim();
    const idProcessoRecebido = String(dados.idProcesso || "").trim();
    const beneficiariosEntrada = Array.isArray(dados.trabalhadores)
      ? dados.trabalhadores
      : [];

    if (!processo) throw new Error("Informe o processo.");
    if (!empresa) throw new Error("Informe a empresa.");
    if (!beneficiariosEntrada.length) throw new Error("Adicione pelo menos 1 beneficiário.");
    if (beneficiariosEntrada.length > 25) throw new Error("Limite máximo: 25 beneficiários.");

    const beneficiariosNormalizados = beneficiariosEntrada.map(function(b, idx) {
      return normalizarBeneficiarioEntradaRecibo_(b, idx, true);
    });

    let idProcesso = idProcessoRecebido;

    if (!idProcesso) {
      idProcesso = registrarProcessoRecibo_({
        processo: processo,
        empresa: empresa,
        observacoes: observacoesGerais,
        status: "RASCUNHO",
        usuario: emailUsuario,
        totalBeneficiarios: beneficiariosNormalizados.length,
        valorTotal: somarValoresBeneficiarios_(beneficiariosNormalizados),
        tipoRegistro: "PROCESSO"
      });
    } else {
      atualizarCabecalhoProcessoRecibo_(idProcesso, {
        processo: processo,
        empresa: empresa,
        observacoes: observacoesGerais,
        status: "RASCUNHO",
        usuario: emailUsuario,
        totalBeneficiarios: beneficiariosNormalizados.length,
        valorTotal: somarValoresBeneficiarios_(beneficiariosNormalizados),
        tipoRegistro: "PROCESSO"
      });
    }

    limparBeneficiariosRascunhoDoProcessoRecibo_(idProcesso);

    beneficiariosNormalizados.forEach(function(benef) {
      registrarBeneficiarioRecibo_({
        idProcesso: idProcesso,
        numeroRecibo: "",
        codigo: "",
        nome: benef.nome,
        cpf: benef.cpf,
        valor: benef.valor,
        pix: benef.pix,
        tipoPix: benef.tipoPix,
        email: benef.email,
        whatsapp: benef.whatsapp,
        sindicalizado: benef.sindicalizado,
        statusEmail: benef.email ? (benef.emailOk ? "PENDENTE" : "INVALIDO") : "",
        statusWhatsapp: benef.whatsapp ? "PREPARADO" : "",
        linkPdf: "",
        usuario: emailUsuario,
        observacoes: benef.observacoes,
        formaPagamento: benef.formaPagamento,
        chequeNumero: benef.chequeNumero,
        chequeData: benef.chequeData
      });
    });

    atualizarResumoProcessoRecibo_(idProcesso);

    return {
      erro: false,
      idProcesso: idProcesso,
      processo: processo,
      empresa: empresa,
      totalBeneficiarios: beneficiariosNormalizados.length,
      valorTotal: somarValoresBeneficiarios_(beneficiariosNormalizados),
      mensagem: "Lote salvo com sucesso. Você pode continuar depois."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

function abrirLoteRecibo(idProcessoOuProcesso, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    const retorno = buscarDadosProcessoRecibo(idProcessoOuProcesso, tokenSessao);

    if (!retorno || retorno.erro) {
      return retorno || {
        erro: true,
        mensagem: "Lote não encontrado."
      };
    }

    return {
      erro: false,
      idProcesso: retorno.idProcesso || "",
      processo: retorno.processo || "",
      empresa: retorno.empresa || "",
      email: retorno.email || "",
      valorTotal: retorno.valorTotal || "0,00",
      beneficiarios: retorno.beneficiarios || [],
      mensagem: "Lote carregado com sucesso."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

function buscarCadastroBeneficiarioRecibo(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    garantirEstruturaModuloRecibos_();

    dados = dados || {};

    var cpf = String(dados.cpf || "")
      .replace(/\D/g, "")
      .trim();

    var nome = normalizarNomeReciboBusca_(dados.nome || "");

    if (!cpf && !nome) {
      return {
        ok: false,
        mensagem: "CPF ou nome não informado."
      };
    }

    // ✅ Se CPF foi informado, valida dígitos verificadores antes de buscar
    if (cpf) {
      var cpfCheckBusca = validarCpfComFeedback(cpf);
      if (!cpfCheckBusca.valido) {
        return {
          ok: false,
          mensagem: cpfCheckBusca.mensagem
        };
      }
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: false,
        mensagem: "Nenhum histórico encontrado."
      };
    }

    var dadosPlanilha = sh.getDataRange().getValues();

    var cab = dadosPlanilha[0].map(function(h) {
      return String(h || "").trim();
    });

    var idx = function(nomeColuna) {
      return cab.indexOf(nomeColuna);
    };

    var idxNome    = idx("NOME");
    var idxCpf     = idx("CPF");
    var idxPix     = idx("PIX");
    var idxTipoPix = idx("TIPO_PIX");
    var idxEmail   = idx("EMAIL");
    var idxWhats   = idx("WHATSAPP");
    var idxSind    = idx("SINDICALIZADO");
    var idxObs     = idx("OBSERVACOES");
    var idxData    = idx("DATA_GERACAO");

    var melhor = null;

    for (var i = dadosPlanilha.length - 1; i >= 1; i--) {
      var linha = dadosPlanilha[i];

      var cpfLinha = String(idxCpf > -1 ? linha[idxCpf] : "")
        .replace(/\D/g, "")
        .trim();

      var nomeLinha = normalizarNomeReciboBusca_(
        idxNome > -1 ? linha[idxNome] : ""
      );

      var bateCpf  = cpf  && cpfLinha  && cpf  === cpfLinha;
      var bateNome = !cpf && nome && nomeLinha && nome === nomeLinha;

      if (!bateCpf && !bateNome) continue;

      melhor = {
        ok:           true,
        nome:         idxNome    > -1 ? String(linha[idxNome]    || "").trim() : "",
        cpf:          idxCpf     > -1 ? String(linha[idxCpf]     || "").trim() : "",
        pix:          idxPix     > -1 ? String(linha[idxPix]     || "").trim() : "",
        tipoPix:      idxTipoPix > -1 ? String(linha[idxTipoPix] || "").trim() : "",
        email:        idxEmail   > -1 ? String(linha[idxEmail]   || "").trim() : "",
        whatsapp:     idxWhats   > -1 ? String(linha[idxWhats]   || "").trim() : "",
        sindicalizado:idxSind    > -1 ? String(linha[idxSind]    || "").trim() : "",
        observacao:   idxObs     > -1 ? String(linha[idxObs]     || "").trim() : "",
        dataGeracao:  idxData    > -1 && linha[idxData]
          ? Utilities.formatDate(
              new Date(linha[idxData]),
              Session.getScriptTimeZone(),
              "dd/MM/yyyy HH:mm"
            )
          : ""
      };

      break;
    }

    if (!melhor) {
      return {
        ok: false,
        mensagem: "Nenhum cadastro anterior encontrado."
      };
    }

    return melhor;

  } catch (e) {
    return {
      ok: false,
      mensagem: "Erro ao buscar cadastro do beneficiário: " + e.message
    };
  }
}
/* ================= LISTAR ================= */
function listarProcessosRecibo(tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    const emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    garantirEstruturaModuloRecibos_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

    if (!sh || sh.getLastRow() < 2) return [];

    const valores = sh.getDataRange().getValues();
    const cab = valores[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxId           = cab.indexOf("ID_PROCESSO");
    const idxData         = cab.indexOf("DATA_CADASTRO");
    const idxProcesso     = cab.indexOf("PROCESSO");
    const idxEmpresa      = cab.indexOf("EMPRESA");
    const idxObs          = cab.indexOf("OBSERVACOES");
    const idxValorTotal   = cab.indexOf("VALOR_TOTAL");
    const idxTipoRegistro = cab.indexOf("TIPO_REGISTRO");

    if (idxProcesso === -1 || idxEmpresa === -1) {
      throw new Error("Colunas PROCESSO e/ou EMPRESA não encontradas.");
    }

    const norm = function(v) {
      return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    };

    const mapa = new Map();

    for (let i = 1; i < valores.length; i++) {
      const linha = valores[i];

      const tipoRegistro = idxTipoRegistro > -1
        ? String(linha[idxTipoRegistro] || "").trim().toUpperCase()
        : "PROCESSO";

      if (tipoRegistro && tipoRegistro !== "PROCESSO" && tipoRegistro !== "RECIBO") {
        continue;
      }

      const idProcesso = idxId > -1 ? String(linha[idxId] || "").trim() : "";
      const dataCadastro = idxData > -1 ? linha[idxData] : "";
      const processo = String(linha[idxProcesso] || "").trim().replace(/\s+/g, " ");
      const empresa = String(linha[idxEmpresa] || "").trim().replace(/\s+/g, " ");
      const observacoes = idxObs > -1 ? String(linha[idxObs] || "").trim() : "";
      const valorTotal = idxValorTotal > -1 ? String(linha[idxValorTotal] || "").trim() : "";

      if (!processo || !empresa) continue;

      const chave = norm(processo) + "||" + norm(empresa);

      const atual = {
        idProcesso: idProcesso,
        processo: processo,
        empresa: empresa,
        observacoes: observacoes,
        valorTotal: valorTotal,
        dataCadastro: dataCadastro
      };

      if (!mapa.has(chave)) {
        mapa.set(chave, atual);
      } else {
        const existente = mapa.get(chave);
        const dataExistente = existente.dataCadastro
          ? new Date(existente.dataCadastro).getTime()
          : 0;

        const dataAtual = dataCadastro
          ? new Date(dataCadastro).getTime()
          : 0;

        if (dataAtual >= dataExistente) {
          mapa.set(chave, atual);
        }
      }
    }

    return Array.from(mapa.values())
      .sort(function(a, b) {
        return a.processo.localeCompare(
          b.processo,
          "pt-BR",
          {
            numeric: true,
            sensitivity: "base"
          }
        );
      })
      .map(function(item) {
        return {
          idProcesso: item.idProcesso,
          processo: item.processo,
          empresa: item.empresa,
          observacoes: item.observacoes,
          valorTotal: item.valorTotal || ""
        };
      });

  } catch (e) {
    Logger.log("❌ ERRO listarProcessosRecibo: " + e.message);
    throw new Error("Erro ao listar processos: " + e.message);
  }
}

function listarBeneficiariosPorProcessoRecibo(idProcesso) {
  garantirEstruturaModuloRecibos_();

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

  if (!sh || sh.getLastRow() < 2) return [];

  const alvo = String(idProcesso || "").trim();
  if (!alvo) return [];

  const dados = sh.getDataRange().getValues();
  const cab = dados[0].map(function(h) {
    return String(h || "").trim();
  });

  const idx = function(name) {
    return cab.indexOf(name);
  };

  return dados.slice(1)
    .filter(function(l) {
      return String(idx("ID_PROCESSO") > -1 ? l[idx("ID_PROCESSO")] : "").trim() === alvo;
    })
    .map(function(l) {
      return {
        idProcesso:       idx("ID_PROCESSO") > -1 ? l[idx("ID_PROCESSO")] || "" : "",
        numeroRecibo:     idx("NUMERO_RECIBO") > -1 ? l[idx("NUMERO_RECIBO")] || "" : "",
        codigo:           idx("CODIGO_VALIDACAO") > -1 ? l[idx("CODIGO_VALIDACAO")] || "" : "",
        dataGeracao:      idx("DATA_GERACAO") > -1 && l[idx("DATA_GERACAO")]
          ? Utilities.formatDate(new Date(l[idx("DATA_GERACAO")]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
          : "",
        nome:             idx("NOME") > -1 ? l[idx("NOME")] || "" : "",
        cpf:              idx("CPF") > -1 ? l[idx("CPF")] || "" : "",
        valor:            idx("VALOR") > -1 ? l[idx("VALOR")] || "" : "",
        valorExtenso:     idx("VALOR_EXTENSO") > -1 ? l[idx("VALOR_EXTENSO")] || "" : "",
        pix:              idx("PIX") > -1 ? l[idx("PIX")] || "" : "",
        tipoPix:          idx("TIPO_PIX") > -1 ? l[idx("TIPO_PIX")] || "" : "",
        email:            idx("EMAIL") > -1 ? l[idx("EMAIL")] || "" : "",
        whatsapp:         idx("WHATSAPP") > -1 ? l[idx("WHATSAPP")] || "" : "",
        sindicalizado:    idx("SINDICALIZADO") > -1 ? l[idx("SINDICALIZADO")] || "" : "",
        statusEmail:      idx("STATUS_ENVIO_EMAIL") > -1 ? l[idx("STATUS_ENVIO_EMAIL")] || "" : "",
        statusWhatsapp:   idx("STATUS_ENVIO_WHATSAPP") > -1 ? l[idx("STATUS_ENVIO_WHATSAPP")] || "" : "",
        linkPdf:          idx("LINK_PDF") > -1 ? l[idx("LINK_PDF")] || "" : "",
        usuario:          idx("USUARIO_GERADOR") > -1 ? l[idx("USUARIO_GERADOR")] || "" : "",
        observacoes:      idx("OBSERVACOES") > -1 ? l[idx("OBSERVACOES")] || "" : "",
        formaPagamento:   idx("FORMA_PAGAMENTO") > -1 ? l[idx("FORMA_PAGAMENTO")] || "PIX" : "PIX",
        chequeNumero:     idx("CHEQUE_NUMERO") > -1 ? l[idx("CHEQUE_NUMERO")] || "" : "",
        chequeData:       idx("CHEQUE_DATA") > -1 ? l[idx("CHEQUE_DATA")] || "" : "",
        statusAssinatura: idx("STATUS_ASSINATURA") > -1 ? l[idx("STATUS_ASSINATURA")] || "" : ""
      };
    });
}

/* ================= CADASTRAR PROCESSO ================= */
function cadastrarNovoProcessoRecibo(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  const emailUsuario = obterEmailUsuarioAtual_();

  if (!emailUsuario) {
    return {
      erro: true,
      mensagem: "Não foi possível identificar seu e-mail corporativo."
    };
  }

  if (!usuarioAutorizado(emailUsuario)) {
    return {
      erro: true,
      mensagem: "Acesso negado."
    };
  }

  garantirEstruturaModuloRecibos_();

  dados = dados || {};

  const norm = function(v) {
    return String(v || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  };

  const processo = String(dados.processo || "").trim().replace(/\s+/g, " ");
  const empresa = String(dados.empresa || "").trim().replace(/\s+/g, " ");
  const observacoes = String(dados.observacoes || "").trim();
  const valorTotal = String(dados.valorTotal || "").trim();

  if (!processo) {
    return {
      erro: true,
      mensagem: "Informe o número do processo."
    };
  }

  if (!empresa) {
    return {
      erro: true,
      mensagem: "Informe a empresa."
    };
  }

  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

  if (sh && sh.getLastRow() >= 2) {
    const dadosPlanilha = sh.getDataRange().getValues();

    const cab = dadosPlanilha[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxId = cab.indexOf("ID_PROCESSO");
    const idxProcesso = cab.indexOf("PROCESSO");
    const idxEmpresa = cab.indexOf("EMPRESA");
    const idxTipo = cab.indexOf("TIPO_REGISTRO");

    if (idxProcesso === -1 || idxEmpresa === -1) {
      return {
        erro: true,
        mensagem: "Colunas não encontradas."
      };
    }

    for (let i = 1; i < dadosPlanilha.length; i++) {
      const tipo = idxTipo > -1
        ? String(dadosPlanilha[i][idxTipo] || "").trim().toUpperCase()
        : "PROCESSO";

      if (tipo && tipo !== "PROCESSO") continue;

      if (
        norm(dadosPlanilha[i][idxProcesso]) === norm(processo) &&
        norm(dadosPlanilha[i][idxEmpresa]) === norm(empresa)
      ) {
        return {
          erro: true,
          mensagem: "Processo já cadastrado para esta empresa.",
          idProcesso: idxId > -1 ? String(dadosPlanilha[i][idxId] || "") : ""
        };
      }
    }
  }

  const idProcesso = registrarProcessoRecibo_({
    processo: processo,
    empresa: empresa,
    observacoes: observacoes,
    status: "CADASTRADO",
    usuario: emailUsuario,
    totalBeneficiarios: 0,
    valorTotal: valorTotal,
    tipoRegistro: "PROCESSO"
  });

  return {
    erro: false,
    idProcesso: idProcesso,
    mensagem: "Processo cadastrado com sucesso."
  };
}

/* ================= EXCLUIR PROCESSO ================= */
function excluirProcessoRecibo(idProcesso, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", true);
  try {
    garantirEstruturaModuloRecibos_();

    const alvo = String(idProcesso || "").trim();

    if (!alvo) {
      return {
        erro: true,
        mensagem: "ID do processo não informado."
      };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);
    const shBen = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!shProc || shProc.getLastRow() < 2) {
      return {
        erro: true,
        mensagem: "Nenhum processo encontrado."
      };
    }

    const dadosProc = shProc.getDataRange().getValues();

    const cabProc = dadosProc[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxIdProc = cabProc.indexOf("ID_PROCESSO");

    if (idxIdProc === -1) {
      return {
        erro: true,
        mensagem: "Coluna ID_PROCESSO não encontrada."
      };
    }

    let linhaProcesso = -1;

    for (let i = 1; i < dadosProc.length; i++) {
      if (String(dadosProc[i][idxIdProc] || "").trim() === alvo) {
        linhaProcesso = i + 1;
        break;
      }
    }

    if (linhaProcesso === -1) {
      return {
        erro: true,
        mensagem: "Processo não encontrado."
      };
    }

    if (shBen && shBen.getLastRow() >= 2) {
      const dadosBen = shBen.getDataRange().getValues();

      const cabBen = dadosBen[0].map(function(h) {
        return String(h || "").trim();
      });

      const idxIdBen = cabBen.indexOf("ID_PROCESSO");

      if (idxIdBen > -1) {
        for (let i = dadosBen.length - 1; i >= 1; i--) {
          if (String(dadosBen[i][idxIdBen] || "").trim() === alvo) {
            lixeiraMover_(shBen, i + 1, { origem: "excluirProcessoRecibo" });
          }
        }
      }
    }

    lixeiraMover_(shProc, linhaProcesso, { origem: "excluirProcessoRecibo" });

    return {
      erro: false,
      mensagem: "Processo excluído com sucesso."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

function limparProcessosReciboDuplicados() {
  try {
    garantirEstruturaModuloRecibos_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

    if (!sh || sh.getLastRow() < 2) {
      return {
        erro: false,
        mensagem: "Nenhum processo encontrado.",
        totalLidos: 0,
        duplicadosRemovidos: 0
      };
    }

    const dados = sh.getDataRange().getValues();

    const cab = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxProcesso = cab.indexOf("PROCESSO");
    const idxEmpresa = cab.indexOf("EMPRESA");

    if (idxProcesso === -1 || idxEmpresa === -1) {
      return {
        erro: true,
        mensagem: "Colunas não encontradas."
      };
    }

    const vistos = {};
    const excluir = [];

    for (let i = 1; i < dados.length; i++) {
      const processo = String(dados[i][idxProcesso] || "").trim().toLowerCase();
      const empresa = String(dados[i][idxEmpresa] || "").trim().toLowerCase();
      const chave = processo + "||" + empresa;

      if (!processo && !empresa) continue;

      if (vistos[chave]) {
        excluir.push(i + 1);
      } else {
        vistos[chave] = true;
      }
    }

    for (let i = excluir.length - 1; i >= 0; i--) {
      sh.deleteRow(excluir[i]);
    }

    return {
      erro: false,
      mensagem: excluir.length ? "Limpeza concluída." : "Nenhum duplicado encontrado.",
      totalLidos: dados.length - 1,
      duplicadosRemovidos: excluir.length
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

/* ================= E-MAIL RECIBO ================= */
function tentarEnviarEmailRecibo_(destino, empresa, processo, valor, arquivos, anexos) {
  try {
    arquivos = Array.isArray(arquivos) ? arquivos : [];

    var listaRecibos = "";

    arquivos.forEach(function(a) {
      listaRecibos +=
        "<li style='margin-bottom:6px;'>" +
          "<strong>" + (a.numero || "") + "</strong>" +
          (a.nome ? " - " + a.nome : "") +
          (a.url ? " (<a href='" + a.url + "' target='_blank'>abrir recibo</a>)" : "") +
        "</li>";
    });

    var htmlBody =
      "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6;'>" +
        "<p>Olá. Tudo bem?</p>" +

        "<p>" +
          "Estamos enviando os recibos referentes ao processo nº " +
          "<strong>" + (processo || "") + "</strong> (" + (empresa || "") + ")." +
        "</p>" +

        "<p><strong>📄 Total de recibos enviados:</strong> " + arquivos.length + "</p>" +
        "<p><strong>💰 Valor total informado:</strong> R$ " + (valor || "0,00") + "</p>" +

        (arquivos.length
          ? "<p><strong>Recibos do lote:</strong></p><ul style='padding-left:18px;'>" + listaRecibos + "</ul>"
          : "") +

        "<p><strong>📌 Para finalizar, siga os passos abaixo:</strong></p>" +

        "<ol style='padding-left:18px;'>" +
          "<li>Abrir o(s) recibo(s)</li>" +
          "<li>Imprimir o(s) documento(s)</li>" +
          "<li>Assinar o(s) recibo(s)</li>" +
          "<li>Tirar uma foto ou escanear</li>" +
          "<li>Enviar para nós por este e-mail ou WhatsApp</li>" +
        "</ol>" +

        "<p>✅ Você também pode assinar digitalmente, se preferir.</p>" +

        "<p style='color:#b91c1c;'><strong>⚠️ Importante:</strong> O recibo só será considerado válido após o envio assinado.</p>" +

        "<p>Se tiver qualquer dúvida, pode nos chamar.</p>" +

        "<p><strong>Atenciosamente,</strong><br>" +
        "SINDEDUCAÇÃO-ES</p>" +
      "</div>";

    const emailUsuario = obterEmailUsuarioAtual_();

    MailApp.sendEmail(
      montarOpcoesEmailSISGEP_(
        emailUsuario,
        htmlBody,
        anexos || [],
        "Recibos disponíveis para assinatura - Processo " + processo,
        destino
      )
    );

    return {
      ok: true
    };

  } catch (err) {
    return {
      ok: false,
      erro: (err && err.message) ? err.message : String(err)
    };
  }
}

function tentarEnviarEmailReciboIndividual_(destino, empresa, processo, valor, numero, urlPdf, anexoBlob, nomeBeneficiario) {
  try {
    var htmlBody = montarMensagemEmailReciboSimples_({
      nome: nomeBeneficiario || "",
      processo: processo || "",
      empresa: empresa || "",
      recibo: numero || "",
      link: urlPdf || ""
    });

    const emailUsuario = obterEmailUsuarioAtual_();

    MailApp.sendEmail(
      montarOpcoesEmailSISGEP_(
        emailUsuario,
        htmlBody,
        anexoBlob ? [anexoBlob] : [],
        "Seu recibo está disponível - " + numero,
        destino
      )
    );

    return {
      ok: true
    };

  } catch (err) {
    return {
      ok: false,
      erro: (err && err.message) ? err.message : String(err)
    };
  }
}

function montarMensagemEmailReciboSimples_(dados) {
  dados = dados || {};

  var nome = String(dados.nome || "").trim();
  var processo = String(dados.processo || "").trim();
  var empresa = String(dados.empresa || "").trim();
  var recibo = String(dados.recibo || "").trim();
  var link = String(dados.link || "").trim();

  return (
    "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6;'>" +
      "<p>Olá, <strong>" + nome + "</strong>. Tudo bem?</p>" +

      "<p>" +
        "Estamos enviando o link do seu recibo referente ao processo nº " +
        "<strong>" + processo + "</strong> (" + empresa + ")." +
      "</p>" +

      "<p><strong>📄 Recibo:</strong> " + recibo + "</p>" +

      /* O PDF JÁ VAI ANEXADO (attachments: anexos, mais abaixo). O link
         apontava para o arquivo no Drive, que era público para quem tivesse
         a URL — 20/08/2026. Fechado o compartilhamento, ele deixaria de
         abrir; e era redundante, porque o documento vem no anexo. */
      "<p>📄 O recibo segue <strong>em anexo</strong> neste e-mail.</p>" +

      "<p><strong>📌 Para finalizar, siga os passos abaixo:</strong></p>" +

      "<ol style='padding-left:18px;'>" +
        "<li>Abrir o recibo em anexo</li>" +
        "<li>Imprimir o documento</li>" +
        "<li>Assinar o recibo</li>" +
        "<li>Tirar uma foto ou escanear</li>" +
        "<li>Enviar para nós por este e-mail ou WhatsApp</li>" +
      "</ol>" +

      "<p>✅ Você também pode assinar digitalmente, se preferir.</p>" +

      "<p style='color:#b91c1c;'><strong>⚠️ Importante:</strong> O recibo só será considerado válido após o envio assinado.</p>" +

      "<p>Se tiver qualquer dúvida, pode nos chamar.</p>" +

      "<p><strong>Atenciosamente,</strong><br>" +
      "SINDEDUCAÇÃO-ES</p>" +
    "</div>"
  );
}

function enviarReciboManualPorEmail(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    const destino = String(dados.destino || "").trim();
    const empresa = String(dados.empresa || "").trim();
    const processo = String(dados.processo || "").trim();
    const valorTotal = String(dados.valorTotal || "").trim();
    const arquivos = Array.isArray(dados.arquivos) ? dados.arquivos : [];

    const assuntoCustom = String(dados.assunto || "").trim();
    const corpoHtmlCustom = String(dados.corpoHtml || "").trim();

    if (!destino) {
      return {
        erro: true,
        mensagem: "Destino de e-mail não informado."
      };
    }

    if (!emailValido(destino)) {
      return {
        erro: true,
        mensagem: "E-mail de destino inválido."
      };
    }

    if (!arquivos.length) {
      return {
        erro: true,
        mensagem: "Nenhum recibo disponível para envio."
      };
    }

    const anexos = [];

    arquivos.forEach(function(arq) {
      const url = String(arq.url || "").trim();
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);

      if (!match || !match[1]) return;

      try {
        anexos.push(
          DriveApp
            .getFileById(match[1])
            .getBlob()
            .setName("Recibo " + String(arq.numero || "") + ".pdf")
        );
      } catch (e) {
        Logger.log("Erro ao anexar recibo: " + e.message);
      }
    });

    if (!anexos.length) {
      return {
        erro: true,
        mensagem: "Não foi possível montar os anexos."
      };
    }

    const emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    if (corpoHtmlCustom) {
      MailApp.sendEmail({
        to: destino,
        subject: assuntoCustom || ("Recibo - Processo " + processo),
        htmlBody: corpoHtmlCustom,
        attachments: anexos,
        replyTo: emailUsuario
      });

      return {
        erro: false,
        mensagem: "E-mail enviado com sucesso para " + destino + "."
      };
    }

    const retorno = tentarEnviarEmailRecibo_(
      destino,
      empresa,
      processo,
      valorTotal,
      arquivos,
      anexos
    );

    if (!retorno || retorno.ok !== true) {
      return {
        erro: true,
        mensagem: (retorno && retorno.erro) || "Falha ao enviar e-mail."
      };
    }

    return {
      erro: false,
      mensagem: "E-mail enviado com sucesso para " + destino + "."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: "Erro ao enviar recibo manualmente: " + e.message
    };
  }
}

function gerarReciboWeb(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    const emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();
    garantirEstruturaModuloRecibos_();

    dados = dados || {};

    const processo = String(dados.processo || "").trim();
    const empresa = String(dados.empresa || "").trim();
    const recEmail = String(dados.recEmail || "").trim();
    const observacoesGerais = String(dados.observacoes || "").trim();
    const idProcessoRecebido = String(dados.idProcesso || "").trim();

    if (!processo) throw new Error("Informe o processo do recibo.");
    if (!empresa) throw new Error("Informe a empresa do recibo.");

    if (recEmail && typeof emailValido === "function" && !emailValido(recEmail)) {
      throw new Error("O e-mail do lote é inválido.");
    }

    const beneficiariosEntrada = Array.isArray(dados.trabalhadores)
      ? dados.trabalhadores
      : [];

    if (!beneficiariosEntrada.length) throw new Error("Adicione pelo menos 1 beneficiário.");
    if (beneficiariosEntrada.length > 25) throw new Error("Limite máximo: 25 beneficiários.");

    const beneficiariosNormalizados = beneficiariosEntrada.map(function(b, idx) {
      return normalizarBeneficiarioEntradaRecibo_(b, idx, true);
    });

    var somaBeneficiarios = beneficiariosNormalizados.reduce(function(total, b) {
      return total + parseValorTexto_(b.valor);
    }, 0);

    var valorTotalAlvara = parseValorTexto_(dados.valorTotal);
    var diferenca = Math.abs(somaBeneficiarios - valorTotalAlvara);
    var tolerancia = 0.01;

    var divergenciaDemonstrativo = false;
    var mensagemDivergencia = "";

    if (dados.valorTotal && valorTotalAlvara > 0 && diferenca > tolerancia) {
      divergenciaDemonstrativo = true;

      mensagemDivergencia =
        "Diferença detectada no demonstrativo. " +
        "Total do Processo/Alvará: R$ " + formatarValorBR_(valorTotalAlvara) +
        " | Soma dos Beneficiários: R$ " + formatarValorBR_(somaBeneficiarios) +
        " | Diferença: R$ " + formatarValorBR_(diferenca) + ".";

      if (dados.confirmarDivergencia !== true) {
        return {
          erro: false,
          precisaConfirmarDivergencia: true,
          divergenciaDemonstrativo: true,
          valorTotalAlvara: formatarValorBR_(valorTotalAlvara),
          valorTotalSolicitado: formatarValorBR_(somaBeneficiarios),
          diferencaDemonstrativo: formatarValorBR_(diferenca),
          mensagem: mensagemDivergencia,
          arquivos: [],
          erros: [],
          resumoLote: {
            processo: processo,
            empresa: empresa,
            totalSolicitado: beneficiariosNormalizados.length,
            valorTotalSolicitado: formatarValorBR_(somaBeneficiarios),
            valorTotalAlvara: formatarValorBR_(valorTotalAlvara),
            diferencaDemonstrativo: formatarValorBR_(diferenca),
            divergenciaDemonstrativo: true
          }
        };
      }
    }

    const idProcesso = idProcessoRecebido || registrarProcessoRecibo_({
      processo: processo,
      empresa: empresa,
      observacoes: observacoesGerais,
      status: "EM_PROCESSAMENTO",
      usuario: emailUsuario,
      totalBeneficiarios: beneficiariosNormalizados.length,
      valorTotal: somarValoresBeneficiarios_(beneficiariosNormalizados),
      tipoRegistro: "RECIBO"
    });

    limparBeneficiariosRascunhoDoProcessoRecibo_(idProcesso);

    const arquivos = [];
    const erros = [];
    const anexosLote = [];
    const bufferBeneficiarios = [];

    let valorTotalGeradoNumero = 0;
    const inicioLote = new Date();

    // ← NOVO: registra início do lote
    registrarProgressoGeracao_({
      status: "iniciando",
      atual: 0,
      total: beneficiariosNormalizados.length,
      ultimo: "",
      concluido: false
    });

    beneficiariosNormalizados.forEach(function(benef, idx) {

      // ← NOVO: atualiza progresso a cada beneficiário
      registrarProgressoGeracao_({
        status: "gerando",
        atual: idx,
        total: beneficiariosNormalizados.length,
        ultimo: benef.nome,
        concluido: false
      });

      try {
const gerado = gerarPDFRecibo({
  nome: benef.nome,
  cpf: benef.cpf,
  valor: benef.valor,

  processo: processo,
  empresa: empresa,

  pix: benef.pix,
  tipoPix: benef.tipoPix,

  formaPagamento: benef.formaPagamento,

  // ✅ DADOS DO CHEQUE
  chequeBanco: benef.chequeBanco || "Sicoob",
  chequeAgencia: benef.chequeAgencia || "3010",
  chequeSerie: benef.chequeSerie || "001",

  chequeNumero: benef.chequeNumero,
  chequeData: benef.chequeData,

  observacao: benef.observacoes || ""
});

        if (!gerado || !gerado.pdf || !gerado.numero || !gerado.url) {
          throw new Error("A geração do PDF retornou dados incompletos.");
        }

        const blobPdf = gerado.pdf
          .getBlob()
          .setName("Recibo " + gerado.numero + ".pdf");

        anexosLote.push(blobPdf);

        let emailInfo = null;

        if (benef.email) {
          if (!benef.emailOk) {
            emailInfo = { ok: false, erro: "E-mail inválido" };
          } else {
            emailInfo = tentarEnviarEmailReciboIndividual_(
              benef.email,
              empresa,
              processo,
              benef.valor,
              gerado.numero,
              gerado.url,
              blobPdf,
              benef.nome
            );
          }
        }

        const linkWhats = gerarLinkWhatsAppRecibo_(
          benef.whatsapp,
          benef.nome,
          gerado.numero,
          empresa,
          processo,
          gerado.url
        );

        const statusEmail = benef.email
          ? (benef.emailOk ? ((emailInfo && emailInfo.ok) ? "ENVIADO" : "FALHA") : "INVALIDO")
          : "";

        bufferBeneficiarios.push({
          idProcesso: idProcesso,
          numeroRecibo: gerado.numero,
          codigo: gerado.codigo || "",
          nome: benef.nome,
          cpf: benef.cpf,
          valor: benef.valor,
          pix: benef.pix,
          tipoPix: benef.tipoPix,
          email: benef.email,
          whatsapp: benef.whatsapp,
          sindicalizado: benef.sindicalizado,
          statusEmail: statusEmail,
          statusWhatsapp: benef.whatsapp ? "PREPARADO" : "",
          linkPdf: gerado.url,
          usuario: emailUsuario,
          observacoes: benef.observacoes,
          formaPagamento: benef.formaPagamento,
          chequeNumero: benef.chequeNumero,
          chequeData: benef.chequeData,
          valorExtenso: valorPorExtenso(benef.valor)
        });

        valorTotalGeradoNumero += parseValorTexto_(benef.valor);

        arquivos.push({
          indice: idx + 1,
          nome: benef.nome,
          cpf: benef.cpf,
          valor: benef.valor,
          pix: benef.pix,
          tipoPix: benef.tipoPix,
          email: benef.email,
          whatsapp: benef.whatsapp,
          sindicalizado: benef.sindicalizado,
          numero: gerado.numero,
          codigo: gerado.codigo || "",
          url: gerado.url,
          download: gerado.download || "",
          whatsappLink: linkWhats,
          statusEmail: statusEmail,
          observacoes: benef.observacoes,
          formaPagamento: benef.formaPagamento,
          chequeNumero: benef.chequeNumero,
          chequeData: benef.chequeData
        });

      } catch (eBenef) {
        var detalheErro = (eBenef && eBenef.stack)
          ? eBenef.stack
          : ((eBenef && eBenef.message) ? eBenef.message : String(eBenef));

        Logger.log(
          "Erro no beneficiário " + (idx + 1) +
          " (" + benef.nome + "): " + detalheErro
        );

        erros.push({
          indice: idx + 1,
          nome: benef.nome,
          cpf: benef.cpf,
          valor: benef.valor,
          erro: detalheErro
        });
      }
    });

    // ← NOVO: registra conclusão do lote
    registrarProgressoGeracao_({
      status: "concluido",
      atual: beneficiariosNormalizados.length,
      total: beneficiariosNormalizados.length,
      ultimo: "",
      concluido: true
    });

    if (bufferBeneficiarios.length > 0) {
      registrarBeneficiariosEmLote_(bufferBeneficiarios);
    }

    atualizarResumoProcessoRecibo_(idProcesso);

    let emailLoteInfo = null;

    if (recEmail && arquivos.length > 0) {
      emailLoteInfo = tentarEnviarEmailRecibo_(
        recEmail,
        empresa,
        processo,
        formatarValorBR_(valorTotalGeradoNumero),
        arquivos,
        anexosLote
      );
    }

    try {
      const ss = SpreadsheetApp.openById(PLANILHA_ID);
      const shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

      if (shProc && shProc.getLastRow() >= 2) {
        const dadosProc = shProc.getDataRange().getValues();

        const cab = dadosProc[0].map(function(h) {
          return String(h || "").trim();
        });

        const idxId     = cab.indexOf("ID_PROCESSO");
        const idxStatus = cab.indexOf("STATUS");
        const idxTotal  = cab.indexOf("TOTAL_BENEFICIARIOS");
        const idxValor  = cab.indexOf("VALOR_TOTAL");

        for (let i = 1; i < dadosProc.length; i++) {
          if (String(dadosProc[i][idxId] || "").trim() !== String(idProcesso || "").trim()) {
            continue;
          }

          var linhaAtual = shProc.getRange(i + 1, 1, 1, cab.length).getValues()[0];

          if (idxStatus > -1) {
            if (arquivos.length > 0 && erros.length === 0) {
              linhaAtual[idxStatus] = divergenciaDemonstrativo
                ? "GERADO_COM_DIVERGENCIA" : "GERADO";
            } else if (arquivos.length > 0 && erros.length > 0) {
              linhaAtual[idxStatus] = divergenciaDemonstrativo
                ? "GERADO_COM_RESSALVAS_E_DIVERGENCIA" : "GERADO_COM_RESSALVAS";
            } else {
              linhaAtual[idxStatus] = "ERRO";
            }
          }

          if (idxTotal > -1) linhaAtual[idxTotal] = arquivos.length;
          if (idxValor > -1) linhaAtual[idxValor] = formatarValorBR_(valorTotalGeradoNumero);

          shProc.getRange(i + 1, 1, 1, cab.length).setValues([linhaAtual]);
          break;
        }
      }

    } catch (eStatus) {
      Logger.log("Erro ao atualizar status final do processo: " + eStatus.message);
    }

    const fimLote = new Date();
    const duracaoSegundos = Math.max(1, Math.round((fimLote - inicioLote) / 1000));

    var mensagemFinal = arquivos.length + " recibo(s) gerado(s) com sucesso";
    if (erros.length > 0) mensagemFinal += ", " + erros.length + " com falha.";
    if (divergenciaDemonstrativo) mensagemFinal += " " + mensagemDivergencia;

    return {
      erro: arquivos.length === 0,
      idProcesso: idProcesso,
      processo: processo,
      empresa: empresa,
      totalSolicitado: beneficiariosNormalizados.length,
      totalGerado: arquivos.length,
      totalErros: erros.length,
      valorTotal: formatarValorBR_(valorTotalGeradoNumero),
      valorTotalGerado: formatarValorBR_(valorTotalGeradoNumero),
      valorTotalSolicitado: formatarValorBR_(somaBeneficiarios),
      valorTotalAlvara: dados.valorTotal && valorTotalAlvara > 0
        ? formatarValorBR_(valorTotalAlvara) : "",
      divergenciaDemonstrativo: divergenciaDemonstrativo,
      diferencaDemonstrativo: divergenciaDemonstrativo
        ? formatarValorBR_(diferenca) : "0,00",
      mensagemDivergencia: mensagemDivergencia,
      duracaoSegundos: duracaoSegundos,
      arquivos: arquivos,
      erros: erros,
      email: emailLoteInfo,
      resumoLote: {
        processo: processo,
        empresa: empresa,
        totalSolicitado: beneficiariosNormalizados.length,
        totalGerado: arquivos.length,
        totalErros: erros.length,
        valorTotalSolicitado: formatarValorBR_(somaBeneficiarios),
        valorTotalGerado: formatarValorBR_(valorTotalGeradoNumero),
        valorTotalAlvara: dados.valorTotal && valorTotalAlvara > 0
          ? formatarValorBR_(valorTotalAlvara) : "",
        divergenciaDemonstrativo: divergenciaDemonstrativo,
        diferencaDemonstrativo: divergenciaDemonstrativo
          ? formatarValorBR_(diferenca) : "0,00",
        duracaoSegundos: duracaoSegundos
      },
      mensagem: mensagemFinal
    };

  } catch (e) {
    Logger.log("Erro geral em gerarReciboWeb: " +
      ((e && e.stack) ? e.stack : e.message));

    return {
      erro: true,
      mensagem: "Erro ao gerar recibo: " + e.message,
      arquivos: [],
      erros: [{ indice: 1, nome: "", cpf: "", valor: "", erro: e.message }]
    };
  }
}
function previewReciboWeb(dados, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  dados = dados || {};
  const cfg = buscarConfigRecibo(tokenSessao);

  const nome = String(dados.nome || "").trim().toUpperCase();

  const nomeTier = nome.length > 40 ? "xs"
                 : nome.length > 26 ? "sm"
                 : "";

  const cpf = formatarCPF(String(dados.cpf || "").trim());

  const valorRaw = dados.valor || "";
  const processo = String(dados.processo || cfg.processo || "").trim();
  const empresa  = String(dados.empresa  || cfg.empresa  || "").trim();

  const forma = String(dados.formaPagamento || "PIX").toUpperCase() === "CHEQUE"
    ? "CHEQUE"
    : "PIX";

  const tipoPix = normalizarTipoPix_(
    String(dados.tipoPix || "").trim(),
    String(dados.pix || cfg.pix || "").trim()
  );

  const pix = formatarPix(
    String(dados.pix || cfg.pix || "").trim(),
    tipoPix
  );

  const chequeBanco   = String(dados.chequeBanco   || "Sicoob").trim();
  const chequeAgencia = String(dados.chequeAgencia || "3010").trim();
  const chequeSerie   = String(dados.chequeSerie   || "001").trim();
  const chequeNum     = String(dados.chequeNumero  || "").trim();

  const chequeData = dados.chequeData
    ? formatarDataExtensoBR(new Date(dados.chequeData))
    : "";

  const obs = String(dados.observacao || "").trim();

  // ── Validações ────────────────────────────────────────────────────

  if (!nome)     throw new Error("Preencha o Nome.");
  if (!cpf)      throw new Error("Preencha o CPF.");
  if (!valorRaw) throw new Error("Preencha o Valor.");

  // ✅ Valida dígitos verificadores antes de gerar a prévia
  var cpfCheckPreview = validarCpfComFeedback(cpf);
  if (!cpfCheckPreview.valido) {
    throw new Error("CPF inválido: " + cpfCheckPreview.mensagem);
  }

  if (!processo || !empresa)        throw new Error("Informe Processo e Empresa.");
  if (forma === "PIX"    && !pix)        throw new Error("Informe a chave PIX.");
  if (forma === "CHEQUE" && !chequeNum)  throw new Error("Informe o número do cheque.");

  // ── Textos de pagamento ───────────────────────────────────────────

  const tipoPixTexto = {
    CPF:      "CPF",
    TELEFONE: "Telefone",
    EMAIL:    "E-mail",
    ALEATORIA:"Aleatória"
  };

  const rotuloPagamento = forma === "CHEQUE"
    ? "🏦 PAGAMENTO VIA CHEQUE"
    : "⚡ PAGAMENTO VIA PIX";

// ← DEPOIS (nas duas funções):
const textoPgto = forma === "CHEQUE"
    ? "<strong>Banco:</strong> " + chequeBanco +
      "<br><strong>Agência:</strong> " + chequeAgencia +
      "<br><strong>Série:</strong> " + chequeSerie +
      "<br><strong>Cheque Nº:</strong> " + chequeNum
    : "<strong>Chave:</strong> " + pix;

  const textoPgtoCorpo = forma === "CHEQUE"
    ? "mediante emissão de cheque nº " + chequeNum +
      ", Banco " + chequeBanco +
      ", Agência " + chequeAgencia +
      ", Série " + chequeSerie +
      (chequeData ? ", com vencimento em " + chequeData : "")
    : "via chave Pix (" + (tipoPixTexto[tipoPix] || "PIX") + "): " + pix;

  const imgs = carregarImagensRecibo_();

  const numero =
    "PRÉVIA-" +
    Utilities.getUuid().slice(0, 6).toUpperCase() +
    "/" +
    new Date().getFullYear();

  const iniciais = nome
    .split(" ")
    .filter(function(p) { return p && p.length > 2; })
    .slice(0, 3)
    .map(function(p) { return p[0].toUpperCase(); })
    .join("");

  return gerarHtmlReciboCompleto_({
    nome:            nome,
    nomeTier:        nomeTier,
    cpf:             cpf,
    valorFmt:        formatarValorMonetarioBR_(valorRaw),
    valorExt:        valorPorExtenso(valorRaw).toLowerCase(),
    processo:        processo,
    empresa:         empresa,
    formaPagamento:  forma,
    rotuloPagamento: rotuloPagamento,
    textoPgto:       textoPgto,
    textoPgtoCorpo:  textoPgtoCorpo,
    obs:             obs,
    obsTexto:        obs ? "Observações: " + obs + ". " : "",
    dataHoje:        formatarDataExtensoBR(new Date()),
    numero:          numero,
    codigo:          "",
    iniciais:        iniciais,
    logoBase64:      imgs.logoBase64,
    logoMime:        imgs.logoMime,
    assBase64:       imgs.assBase64,
    assMime:         imgs.assMime
  }, true);
}
/* ================= BUSCAR PROCESSO ================= */
function buscarProcessoReciboPorNumero(processo, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  garantirEstruturaModuloRecibos_();

  const alvo = String(processo || "").trim();

  if (!alvo) return null;

  return listarProcessosRecibo(tokenSessao).find(function(p) {
    return String(p.processo || "").trim() === alvo;
  }) || null;
}

/* ================= BUSCAR DADOS PROCESSO ================= */
function buscarDadosProcessoRecibo(processoOuId, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    const emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    garantirEstruturaModuloRecibos_();

    const alvo = String(processoOuId || "").trim();

    if (!alvo) {
      return {
        erro: true,
        mensagem: "Processo não informado."
      };
    }

    const norm = function(v) {
      return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    // ✅ normalizarValorNumero_ e formatarValorBR_ removidas daqui —
    //    agora resolvidas pelas globais em Utils.gs

    const ss = SpreadsheetApp.openById(PLANILHA_ID);

    const processos = listarProcessosRecibo(tokenSessao) || [];

    let processoEncontrado = processos.find(function(p) {
      return String(p.idProcesso || "").trim() === alvo || norm(p.processo) === norm(alvo);
    }) || null;

    if (processoEncontrado) {
      const beneficiariosModulo = listarBeneficiariosPorProcessoRecibo(
        processoEncontrado.idProcesso
      ) || [];

      if (beneficiariosModulo.length > 0) {
        let valorTotalModulo = 0;

        beneficiariosModulo.forEach(function(b) {
          valorTotalModulo += normalizarValorNumero_(b.valor);
        });

        return {
          erro: false,
          origem: "MODULO_RECIBOS",
          idProcesso: processoEncontrado.idProcesso || "",
          processo: processoEncontrado.processo || "",
          empresa: processoEncontrado.empresa || "",
          email: "",
          valorTotal: formatarValorBR_(valorTotalModulo),
          valorTotalNumero: valorTotalModulo,
          beneficiarios: beneficiariosModulo.map(function(b) {
            return {
              nome: b.nome || "",
              cpf: b.cpf || "",
              valor: String(b.valor || ""),
              pix: b.pix || "",
              tipoPix: b.tipoPix || "",
              email: b.email || "",
              whatsapp: b.whatsapp || "",
              sindicalizado: b.sindicalizado || "",
              observacao: b.observacoes || b.observacao || "",
              formaPagamento: b.formaPagamento || "PIX",
              chequeNumero: b.chequeNumero || "",
              chequeData: b.chequeData || ""
            };
          })
        };
      }
    }

    const abaBaseConfig = String(
      PropertiesService
        .getScriptProperties()
        .getProperty("ABA_BASE_RECIBOS") || ""
    ).trim();

    const nomesAbasCandidatas = [
      abaBaseConfig,
      "IMPORTAR_RECIBOS",
      "Controle_Filiacao_Escolas_SindEducacao_secretaria",
      "Controle_Filiacao_Escolas_SindEducacao_secretaria (1)",
      "Controle",
      PLANILHA_REGISTRO
    ].filter(Boolean);

    let shBase = null;

    for (let i = 0; i < nomesAbasCandidatas.length; i++) {
      const aba = ss.getSheetByName(nomesAbasCandidatas[i]);

      if (aba && aba.getLastRow() >= 2) {
        shBase = aba;
        break;
      }
    }

    if (!shBase) {
      if (processoEncontrado) {
        return {
          erro: false,
          origem: "MODULO_RECIBOS",
          idProcesso: processoEncontrado.idProcesso || "",
          processo: processoEncontrado.processo || "",
          empresa: processoEncontrado.empresa || "",
          email: "",
          valorTotal: "",
          valorTotalNumero: 0,
          beneficiarios: []
        };
      }

      return {
        erro: true,
        mensagem: "Nenhuma planilha base de recibos encontrada."
      };
    }

    const dados = shBase.getDataRange().getValues();

    const cab = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    const encontrarIndice = function(possibilidades) {
      for (var i = 0; i < possibilidades.length; i++) {
        var idx = cab.findIndex(function(col) {
          return String(col || "").trim().toLowerCase() ===
            String(possibilidades[i]).trim().toLowerCase();
        });

        if (idx > -1) return idx;
      }

      return -1;
    };

    const idxProcesso = encontrarIndice([
      "Processo",
      "PROCESSO",
      "Número do Processo",
      "NUMERO DO PROCESSO",
      "NÚMERO DO PROCESSO"
    ]);

    const idxEmpresa = encontrarIndice([
      "Empresa",
      "EMPRESA",
      "Razão Social",
      "RAZÃO SOCIAL"
    ]);

    const idxNome = encontrarIndice([
      "Nome",
      "NOME",
      "Beneficiário",
      "BENEFICIÁRIO"
    ]);

    const idxCpf     = encontrarIndice(["CPF"]);
    const idxValor   = encontrarIndice(["Valor", "VALOR"]);
    const idxPix     = encontrarIndice(["PIX", "Pix", "Chave PIX", "CHAVE PIX"]);
    const idxTipoPix = encontrarIndice(["Tipo PIX", "TIPO PIX", "TipoPix"]);
    const idxEmail   = encontrarIndice(["E-mail", "EMAIL", "Email"]);
    const idxWhats   = encontrarIndice(["WhatsApp", "WHATSAPP", "Whatsapp"]);
    const idxSind    = encontrarIndice(["Sindicalizado", "SINDICALIZADO"]);

    const idxObs = encontrarIndice([
      "Observação",
      "OBSERVAÇÃO",
      "Observacoes",
      "Observações",
      "OBSERVACOES"
    ]);

    const idxTotal = encontrarIndice(["Total", "TOTAL"]);

    if (idxProcesso === -1) {
      throw new Error("Coluna 'Processo' não encontrada na planilha base.");
    }

    const filtro = processoEncontrado
      ? norm(processoEncontrado.processo)
      : norm(alvo);

    let linhaInicial = -1;

    for (let i = 1; i < dados.length; i++) {
      const processoLinha = norm(dados[i][idxProcesso]);

      if (processoLinha && processoLinha === filtro) {
        linhaInicial = i;
        break;
      }
    }

    if (linhaInicial === -1) {
      if (processoEncontrado) {
        return {
          erro: false,
          origem: "MODULO_RECIBOS",
          idProcesso: processoEncontrado.idProcesso || "",
          processo: processoEncontrado.processo || "",
          empresa: processoEncontrado.empresa || "",
          email: "",
          valorTotal: "",
          valorTotalNumero: 0,
          beneficiarios: []
        };
      }

      return {
        erro: true,
        mensagem: "Processo não encontrado."
      };
    }

    let processoBase = String(dados[linhaInicial][idxProcesso] || "").trim();

    let empresaBase = idxEmpresa > -1
      ? String(dados[linhaInicial][idxEmpresa] || "").trim()
      : "";

    let emailBase = idxEmail > -1
      ? String(dados[linhaInicial][idxEmail] || "").trim()
      : "";

    let valorTotalBase = idxTotal > -1
      ? normalizarValorNumero_(dados[linhaInicial][idxTotal])
      : 0;

    const beneficiariosBase = [];

    for (let j = linhaInicial; j < dados.length; j++) {
      const linha = dados[j];

      const processoAtualBruto = idxProcesso > -1
        ? String(linha[idxProcesso] || "").trim()
        : "";

      const processoAtualNorm = norm(processoAtualBruto);

      if (j > linhaInicial && processoAtualNorm && processoAtualNorm !== filtro) {
        break;
      }

      if (idxEmpresa > -1 && String(linha[idxEmpresa] || "").trim()) {
        empresaBase = String(linha[idxEmpresa] || "").trim();
      }

      if (idxEmail > -1 && String(linha[idxEmail] || "").trim()) {
        emailBase = String(linha[idxEmail] || "").trim();
      }

      if (idxTotal > -1) {
        const totalLinha = normalizarValorNumero_(linha[idxTotal]);

        if (totalLinha > 0) {
          valorTotalBase = totalLinha;
        }
      }

      const nome       = idxNome  > -1 ? String(linha[idxNome]  || "").trim() : "";
      const cpf        = idxCpf   > -1 ? String(linha[idxCpf]   || "").trim() : "";
      const valorNumero= idxValor > -1 ? normalizarValorNumero_(linha[idxValor]) : 0;
      const pix        = idxPix   > -1 ? String(linha[idxPix]   || "").trim() : "";
      const email      = idxEmail > -1 ? String(linha[idxEmail]  || "").trim() : "";
      const whatsapp   = idxWhats > -1 ? String(linha[idxWhats]  || "").trim() : "";
      const observacao = idxObs   > -1 ? String(linha[idxObs]    || "").trim() : "";

      if (nome || cpf || valorNumero || pix || email || whatsapp || observacao) {
        beneficiariosBase.push({
          nome:          nome,
          cpf:           cpf,
          valor:         formatarValorBR_(valorNumero),
          pix:           pix,
          tipoPix:       idxTipoPix > -1 ? String(linha[idxTipoPix] || "").trim() : "",
          email:         email,
          whatsapp:      whatsapp,
          sindicalizado: idxSind > -1 ? normalizarBooleanoSN_(linha[idxSind]) : "",
          observacao:    observacao
        });
      }
    }

    return {
      erro: false,
      origem: "PLANILHA_BASE",
      idProcesso: processoEncontrado ? (processoEncontrado.idProcesso || "") : "",
      processo:   processoEncontrado ? (processoEncontrado.processo || processoBase) : processoBase,
      empresa:    processoEncontrado ? (processoEncontrado.empresa  || empresaBase)  : empresaBase,
      email:           emailBase,
      valorTotal:      valorTotalBase > 0 ? formatarValorBR_(valorTotalBase) : "",
      valorTotalNumero: valorTotalBase,
      beneficiarios:   beneficiariosBase
    };

  } catch (e) {
    Logger.log("❌ ERRO buscarDadosProcessoRecibo: " + e.message);

    return {
      erro: true,
      mensagem: e.message
    };
  }
}

/* ================= BUSCAR BENEFICIÁRIOS POR EMPRESA ================= */
function buscarBeneficiariosPorEmpresa(empresaBusca) {
  try {
    if (!empresaBusca) {
      return {
        erro: true,
        mensagem: "Empresa não informada."
      };
    }

    const normalizar = function(txt) {
      return String(txt || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const empresaNorm = normalizar(empresaBusca);

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("IMPORTAR_RECIBOS");

    if (!sh || sh.getLastRow() < 2) {
      return {
        erro: true,
        mensagem: "Aba IMPORTAR_RECIBOS vazia ou não encontrada."
      };
    }

    const dados = sh.getDataRange().getValues();

    const cab = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    const idx = function(nome) {
      return cab.findIndex(function(col) {
        return String(col || "").toLowerCase() === String(nome).toLowerCase();
      });
    };

    const idxProcesso = idx("Processo");
    const idxEmpresa = idx("Empresa");
    const idxNome = idx("Nome");
    const idxCpf = idx("CPF");
    const idxValor = idx("Valor");
    const idxPix = idx("PIX");
    const idxTipoPix = idx("Tipo PIX");
    const idxWhats = idx("WhatsApp");
    const idxTotal = idx("Total");

    if (idxEmpresa === -1 || idxNome === -1) {
      return {
        erro: true,
        mensagem: "Colunas obrigatórias não encontradas na planilha."
      };
    }

    const beneficiarios = [];
    let valorTotalAlvara = 0;
    let processo = "";
    let empresa = "";

    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];

      const empresaLinha = normalizar(linha[idxEmpresa]);

      if (empresaLinha !== empresaNorm) continue;

      const nome = String(linha[idxNome] || "").trim();

      if (!nome) continue;

      if (!processo && idxProcesso > -1) {
        processo = String(linha[idxProcesso] || "").trim();
      }

      if (!empresa) {
        empresa = String(linha[idxEmpresa] || "").trim();
      }

      const valor = normalizarValorMonetario_(linha[idxValor] || "");

      if (idxTotal > -1) {
        const totalLinha = normalizarValorMonetario_(linha[idxTotal] || "");

        if (!valorTotalAlvara && totalLinha) {
          valorTotalAlvara = totalLinha;
        }
      }

      beneficiarios.push({
        nome: nome,
        cpf: String(linha[idxCpf] || "").trim(),
        valor: valor,
        pix: String(linha[idxPix] || "").trim(),
        tipoPix: String(linha[idxTipoPix] || "").trim(),
        whatsapp: String(linha[idxWhats] || "").trim(),
        email: "",
        sindicalizado: "",
        observacao: ""
      });
    }

    if (!beneficiarios.length) {
      return {
        erro: true,
        mensagem: "Nenhum beneficiário encontrado para essa empresa."
      };
    }

    return {
      erro: false,
      processo: processo,
      empresa: empresa,
      valorTotal: valorTotalAlvara || "",
      quantidade: beneficiarios.length,
      beneficiarios: beneficiarios
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: "Erro ao buscar beneficiários por empresa: " + e.message
    };
  }
}

/* ================= TESTES OPERACIONAIS ================= */
function testeGerarPDFRecibo() {
  return gerarPDFRecibo({
    nome: "WANDERSON NASCIMENTO CASTELO",
    cpf: "085.381.047-80",
    valor: "3,00",
    pix: "08538104780",
    processo: "0000547.55.2025.5.17.0005",
    empresa: "Centro Educacional Primeiro Mundo"
  });
}

function testePreviewReciboWeb() {
  return previewReciboWeb({
    nome: "WANDERSON NASCIMENTO CASTELO",
    cpf: "085.381.047-80",
    valor: "3,00",
    pix: "08538104780",
    processo: "0000547.55.2025.5.17.0005",
    empresa: "Centro Educacional Primeiro Mundo"
  });
}

function testeGerarReciboWeb() {
  return gerarReciboWeb({
    processo: "0000547.55.2025.5.17.0005",
    empresa: "Centro Educacional Primeiro Mundo",
    valorTotal: "3,00",
    recEmail: "wanderson.castelo@hotmail.com",
    trabalhadores: [{
      nome: "WANDERSON NASCIMENTO CASTELO",
      cpf: "085.381.047-80",
      valor: "3,00",
      pix: "08538104780",
      observacao: "Teste manual"
    }]
  });
}

function importarBeneficiariosReciboPadrao() {
  return importarBeneficiariosReciboDaPlanilha(
    PLANILHA_ID,
    "IMPORTAR_RECIBOS"
  );
}

/* ================= IMPORTAR BENEFICIÁRIOS ================= */
function importarBeneficiariosReciboDaPlanilha(planilhaId, nomeAba, processoFiltro) {
  try {
    const emailUsuario = obterEmailUsuarioAtual_();

    if (!emailUsuario) {
      return {
        erro: true,
        mensagem: "Não foi possível identificar o e-mail do usuário logado."
      };
    }

    if (!usuarioAutorizado(emailUsuario)) {
      return {
        erro: true,
        mensagem: "Usuário não autorizado: " + emailUsuario
      };
    }

    const ss = SpreadsheetApp.openById(planilhaId || PLANILHA_ID);
    const aba = ss.getSheetByName(nomeAba || "IMPORTAR_RECIBOS");

    if (!aba) {
      return {
        erro: true,
        mensagem: "Aba '" + (nomeAba || "IMPORTAR_RECIBOS") + "' não encontrada."
      };
    }

    const dados = aba.getDataRange().getValues();

    if (!dados || dados.length < 2) {
      return {
        erro: true,
        mensagem: "A aba de importação está vazia."
      };
    }

    const cab = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    // ✅ normalizarValorNumero_ e formatarValorBR_ removidas daqui —
    //    agora resolvidas pelas globais em Utils.gs

    function encontrarIndice(possibilidades) {
      for (var i = 0; i < possibilidades.length; i++) {
        var idx = cab.findIndex(function(col) {
          return String(col || "").trim().toLowerCase() ===
            String(possibilidades[i]).trim().toLowerCase();
        });

        if (idx > -1) return idx;
      }

      return -1;
    }

    function normalizarTexto(v) {
      return String(v || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
    }

    const idxProcesso = encontrarIndice([
      "Processo",
      "PROCESSO",
      "Número do Processo",
      "NUMERO DO PROCESSO",
      "NÚMERO DO PROCESSO"
    ]);

    const idxEmpresa = encontrarIndice([
      "Empresa",
      "EMPRESA",
      "Razão Social",
      "RAZÃO SOCIAL"
    ]);

    const idxNome = encontrarIndice([
      "Nome",
      "NOME",
      "Beneficiário",
      "BENEFICIÁRIO"
    ]);

    const idxCpf     = encontrarIndice(["CPF"]);
    const idxValor   = encontrarIndice(["Valor", "VALOR"]);
    const idxPix     = encontrarIndice(["PIX", "Pix", "Chave PIX", "CHAVE PIX"]);
    const idxTipoPix = encontrarIndice(["Tipo PIX", "TIPO PIX", "TipoPix"]);
    const idxEmail   = encontrarIndice(["E-mail", "EMAIL", "Email"]);
    const idxWhats   = encontrarIndice(["WhatsApp", "WHATSAPP", "Whatsapp"]);
    const idxSind    = encontrarIndice(["Sindicalizado", "SINDICALIZADO"]);

    const idxObs = encontrarIndice([
      "Observação",
      "OBSERVAÇÃO",
      "Observacoes",
      "Observações",
      "OBSERVACOES"
    ]);

    const idxTotal = encontrarIndice(["Total", "TOTAL"]);

    if (idxProcesso === -1) {
      return {
        erro: true,
        mensagem: "Coluna 'Processo' não encontrada na aba IMPORTAR_RECIBOS."
      };
    }

    const filtro = normalizarTexto(processoFiltro || "");

    if (!filtro) {
      return {
        erro: true,
        mensagem: "Processo não informado para importação."
      };
    }

    var linhaInicial = -1;

    for (var i = 1; i < dados.length; i++) {
      var processoLinha = normalizarTexto(dados[i][idxProcesso]);

      if (processoLinha && processoLinha === filtro) {
        linhaInicial = i;
        break;
      }
    }

    if (linhaInicial === -1) {
      return {
        erro: true,
        mensagem: "Processo não encontrado na aba IMPORTAR_RECIBOS."
      };
    }

    var processo = String(dados[linhaInicial][idxProcesso] || "").trim();

    var empresa = idxEmpresa > -1
      ? String(dados[linhaInicial][idxEmpresa] || "").trim()
      : "";

    var valorTotal = idxTotal > -1
      ? normalizarValorNumero_(dados[linhaInicial][idxTotal])
      : 0;

    var beneficiarios = [];

    for (var j = linhaInicial; j < dados.length; j++) {
      var linha = dados[j];

      var processoAtualBruto = idxProcesso > -1
        ? String(linha[idxProcesso] || "").trim()
        : "";

      var processoAtualNorm = normalizarTexto(processoAtualBruto);

      if (j > linhaInicial && processoAtualNorm && processoAtualNorm !== filtro) {
        break;
      }

      if (idxEmpresa > -1 && String(linha[idxEmpresa] || "").trim()) {
        empresa = String(linha[idxEmpresa] || "").trim();
      }

      if (idxTotal > -1) {
        var totalLinha = normalizarValorNumero_(linha[idxTotal]);

        if (totalLinha > 0) {
          valorTotal = totalLinha;
        }
      }

      var nome       = idxNome  > -1 ? String(linha[idxNome]  || "").trim() : "";
      var cpf        = idxCpf   > -1 ? String(linha[idxCpf]   || "").trim() : "";
      var valorBruto = idxValor > -1 ? linha[idxValor] : "";
      var pix        = idxPix   > -1 ? String(linha[idxPix]   || "").trim() : "";
      var email      = idxEmail > -1 ? String(linha[idxEmail]  || "").trim() : "";
      var whatsapp   = idxWhats > -1 ? String(linha[idxWhats]  || "").trim() : "";
      var observacao = idxObs   > -1 ? String(linha[idxObs]    || "").trim() : "";

      if (nome || cpf || valorBruto || pix || email || whatsapp || observacao) {
        var valorNumero = normalizarValorNumero_(valorBruto);

        beneficiarios.push({
          nome:          nome,
          cpf:           cpf,
          valor:         formatarValorBR_(valorNumero),
          pix:           pix,
          tipoPix:       idxTipoPix > -1
            ? String(linha[idxTipoPix] || "").trim()
            : normalizarTipoPix_("", pix),
          email:         email,
          whatsapp:      whatsapp,
          sindicalizado: idxSind > -1 ? normalizarBooleanoSN_(linha[idxSind]) : "",
          observacao:    observacao
        });
      }
    }

    if (!beneficiarios.length) {
      return {
        erro: true,
        mensagem: "O processo foi encontrado, mas nenhum beneficiário válido foi localizado no bloco."
      };
    }

    return {
      erro: false,
      origem: "IMPORTAR_RECIBOS",
      processo: processo,
      empresa: empresa,
      valorTotal: valorTotal > 0 ? formatarValorBR_(valorTotal) : "",
      quantidadeBeneficiarios: beneficiarios.length,
      beneficiarios: beneficiarios,
      mensagem: beneficiarios.length + " beneficiário(s) importado(s) da aba IMPORTAR_RECIBOS."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: "Erro ao importar beneficiários da planilha: " + e.message
    };
  }
}

function importarBeneficiariosReciboDaAbaImportacao(processoFiltro, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  return importarBeneficiariosReciboDaPlanilha(
    PLANILHA_ID,
    "IMPORTAR_RECIBOS",
    processoFiltro
  );
}
/* ================= E-MAIL INDIVIDUAL SIMPLES ================= */
function enviarReciboIndividual(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    var email = String(dados.email || "").trim();

    if (!email) {
      throw new Error("E-mail não informado.");
    }

    if (!emailValido(email)) {
      throw new Error("E-mail inválido.");
    }

    MailApp.sendEmail({
      to: email,
      subject: "Recibo - Processo " + (dados.processo || ""),
      htmlBody:
        "<p>Olá, " + (dados.nome || "beneficiário(a)") + ".</p>" +
        "<p>Segue seu recibo referente ao processo " + (dados.processo || "") + ".</p>"
    });

    return {
      ok: true
    };

  } catch (e) {
    throw new Error(e.message);
  }
}

/* ================= PJe-CALC ================= */
function interpretarTextoPjeCalcRecibo_(texto, nomeArquivo) {
  texto = String(texto || "").replace(/\r/g, "\n");

  var processo = "";
  var empresa = "";
  var nomeBeneficiario = "";
  var valorLiquido = "";

  var mProc = texto.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/);
  if (mProc) {
    processo = String(mProc[0] || "").trim();
  }

  var mReclamante = texto.match(/Reclamante[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?:\n|Reclamado|$)/im);
  if (mReclamante) {
    nomeBeneficiario = String(mReclamante[1] || "")
      .trim()
      .replace(/\s{2,}/g, " ");
  }

  var mReclamado = texto.match(/Reclamado[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s,.\-&]+?)(?:\n|Per[ií]odo|$)/im);
  if (mReclamado) {
    empresa = String(mReclamado[1] || "")
      .trim()
      .replace(/\s{2,}/g, " ");
  }

  var mLiquido = texto.match(/L[IÍ]QUIDO\s+DEVIDO\s+AO\s+RECLAMANTE[\s|]+(\d{1,3}(?:\.\d{3})*,\d{2})/i);

  if (mLiquido) {
    valorLiquido = String(mLiquido[1] || "").trim();
  } else {
    var idxLiq = texto.search(/L[IÍ]QUIDO\s+DEVIDO\s+AO\s+RECLAMANTE/i);

    if (idxLiq > -1) {
      var trecho = texto.substring(idxLiq, idxLiq + 200);
      var mVal = trecho.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);

      if (mVal) {
        valorLiquido = String(mVal[1] || "").trim();
      }
    }
  }

  var beneficiarios = [];

  if (nomeBeneficiario && valorLiquido) {
    beneficiarios.push({
      nome: nomeBeneficiario,
      cpf: "",
      valor: valorLiquido,
      pix: "",
      email: "",
      whatsapp: "",
      sindicalizado: "",
      observacao: "Importado do PJe-Calc",
      banco: ""
    });
  }

  return {
    erro: false,
    ok: true,
    formato: "PJE_CALC",
    nomeArquivo: nomeArquivo || "",
    processo: {
      numeroProcesso: processo,
      empresa: empresa,
      valorTotal: valorLiquido
    },
    quantidadeBeneficiarios: beneficiarios.length,
    beneficiarios: beneficiarios,
    mensagem: beneficiarios.length
      ? "PJe-Calc importado: " + nomeBeneficiario + " — R$ " + valorLiquido
      : "PDF PJe-Calc lido, mas não foi possível identificar os dados automaticamente."
  };
}

/* ================= IMPORTAÇÃO DE ALVARÁS / PJe-CALC ================= */
function extrairTextoDePdfBase64ParaImportacao_(base64, nomeArquivo) {
  try {
    var bytes = Utilities.base64Decode(base64);

    var blob = Utilities.newBlob(
      bytes,
      "application/pdf",
      nomeArquivo || "alvara.pdf"
    );

    var arq = Drive.Files.insert(
      {
        title: "TMP_EXTRACAO_" + new Date().getTime()
      },
      blob,
      {
        ocr: true,
        ocrLanguage: "pt",
        convert: true
      }
    );

    try {
      if (!arq.id) {
        throw new Error("Documento não identificado.");
      }

      return DocumentApp.openById(arq.id).getBody().getText() || "";

    } finally {
      try {
        DriveApp.getFileById(arq.id).setTrashed(true);
      } catch (_) {}
    }

  } catch (e) {
    throw new Error("Falha ao extrair texto do PDF: " + e.message);
  }
}

function interpretarTextoListaFuncionariosRecibo_(texto, nomeArquivo) {
  texto = String(texto || "").replace(/\r/g, "\n");

  var linhas = texto
    .split("\n")
    .map(function(l) {
      return String(l || "").trim();
    })
    .filter(Boolean);

  var beneficiarios = [];

  linhas.forEach(function(linha) {
    if (/^(sindicato|nome reclamante|l[ií]quido por reclamante|valores individualizados|total|p[áa]gina)$/i.test(linha)) {
      return;
    }

    var m = linha.match(/^(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/);

    if (!m) return;

    var nome = String(m[1] || "").trim();
    var valor = String(m[2] || "").trim();

    if (nome && valor) {
      beneficiarios.push({
        nome: nome,
        cpf: "",
        valor: valor,
        pix: "",
        email: "",
        whatsapp: "",
        sindicalizado: "",
        observacao: "Importado da lista PDF",
        banco: ""
      });
    }
  });

  return {
    erro: false,
    ok: true,
    nomeArquivo: nomeArquivo || "",
    quantidadeBeneficiarios: beneficiarios.length,
    beneficiarios: beneficiarios
  };
}

function interpretarTextoAlvaraRecibo_(texto, nomeArquivo) {
  texto = String(texto || "").replace(/\r/g, "\n");

  var linhas = texto
    .split("\n")
    .map(function(l) {
      return String(l || "").trim();
    })
    .filter(Boolean);

  var processo = "";
  var empresa = "";
  var valorTotal = "";
  var beneficiarios = [];

  var mProc = texto.match(/\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/);
  if (mProc) {
    processo = String(mProc[0] || "").trim();
  }

  var vals = texto.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];

  if (vals.length) {
    var maiorN = 0;
    var maiorT = "";

    vals.forEach(function(v) {
      var vl = String(v || "")
        .replace(/^R\$\s*/i, "")
        .trim();

      var n = parseFloat(
        vl.replace(/\./g, "").replace(",", ".")
      );

      if (!isNaN(n) && n > maiorN) {
        maiorN = n;
        maiorT = vl;
      }
    });

    valorTotal = maiorT;
  }

  var mEmp =
    texto.match(/em\s+face\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .\-&]+)/i) ||
    texto.match(/face\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .\-&]+)/i);

  if (mEmp) {
    empresa = String(mEmp[1] || "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  linhas.forEach(function(linha) {
    var tCpf = linha.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    var tVal = linha.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);

    if (tCpf && tVal) {
      var cpf = String(tCpf[0] || "").trim();
      var val = String(tVal[0] || "").trim();

      var nome = linha
        .replace(cpf, "")
        .replace(val, "")
        .replace(/R\$/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (nome) {
        beneficiarios.push({
          nome: nome,
          cpf: cpf,
          valor: val,
          banco: ""
        });
      }
    }
  });

  if (!beneficiarios.length) {
    var mC = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    var cpfP = mC ? String(mC[0] || "").trim() : "";
    var nomeP = "";

    for (var j = 0; j < linhas.length; j++) {
      var ln = linhas[j];

      if (
        ln &&
        ln.length > 8 &&
        /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(ln) &&
        !/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(ln) &&
        !/R\$\s*\d/.test(ln)
      ) {
        nomeP = ln.replace(/\s{2,}/g, " ").trim();
        break;
      }
    }

    if (nomeP || cpfP || valorTotal) {
      beneficiarios.push({
        nome: nomeP,
        cpf: cpfP,
        valor: valorTotal,
        banco: ""
      });
    }
  }

  return {
    erro: false,
    ok: true,
    nomeArquivo: nomeArquivo || "",
    processo: {
      numeroProcesso: processo,
      empresa: empresa,
      valorTotal: valorTotal
    },
    quantidadeBeneficiarios: beneficiarios.length,
    beneficiarios: beneficiarios,
    mensagem: beneficiarios.length
      ? "Importação concluída."
      : "PDF lido, mas nenhum beneficiário identificado."
  };
}

function gerarPlanilhaAlvaraCompleta_(dados) {
  dados = dados || {};

  var beneficiarios = Array.isArray(dados.beneficiarios)
    ? dados.beneficiarios
    : [];

  if (!beneficiarios.length) {
    throw new Error("Nenhum beneficiário para gerar planilha.");
  }

  var ss = SpreadsheetApp.create("REPASSE_ALVARA_" + new Date().getTime());
  var aba = ss.getActiveSheet();

  aba.setName("Beneficiários");

  aba.getRange(1, 1).setValue("Processo");
  aba.getRange(1, 2).setValue(dados.processo || "");

  aba.getRange(2, 1).setValue("Empresa");
  aba.getRange(2, 2).setValue(dados.empresa || "");

  aba.getRange(3, 1).setValue("Valor Total");
  aba.getRange(3, 2).setValue(dados.valorTotal || "");

  aba.getRange(4, 1).setValue("Arquivos de Origem");
  aba.getRange(4, 2).setValue((dados.arquivosOrigem || []).join(" | "));

  aba.getRange(6, 1, 1, 8).setValues([[
    "Nome",
    "CPF",
    "Valor",
    "Pix",
    "E-mail",
    "WhatsApp",
    "Sindicalizado",
    "Observação"
  ]]);

  var linhas = beneficiarios.map(function(b) {
    return [
      b.nome || "",
      b.cpf || "",
      b.valor || "",
      b.pix || "",
      b.email || "",
      b.whatsapp || "",
      b.sindicalizado || "",
      b.observacao || ""
    ];
  });

  aba.getRange(7, 1, linhas.length, 8).setValues(linhas);

  aba.getRange("A1:B4").setFontWeight("bold");
  aba.getRange(6, 1, 1, 8).setFontWeight("bold");
  aba.autoResizeColumns(1, 8);

  return {
    ok: true,
    url: ss.getUrl(),
    id: ss.getId(),
    mensagem: "Planilha gerada com sucesso."
  };
}

function gerarPlanilhaAlvara(dados) {
  try {
    dados = dados || {};

    var beneficiarios = dados.beneficiarios || [];

    if (!beneficiarios.length) {
      throw new Error("Nenhum beneficiário.");
    }

    var ss = SpreadsheetApp.create("ALVARA_" + new Date().getTime());
    var aba = ss.getActiveSheet();

    aba.setName("Beneficiários");

    aba.getRange(1, 1, 1, 3).setValues([[
      "Nome",
      "CPF",
      "Valor"
    ]]);

    aba.getRange(2, 1, beneficiarios.length, 3).setValues(
      beneficiarios.map(function(b) {
        return [
          b.nome || "",
          b.cpf || "",
          b.valor || ""
        ];
      })
    );

    aba.getRange("A1:C1").setFontWeight("bold");
    aba.autoResizeColumns(1, 3);

    return {
      ok: true,
      url: ss.getUrl(),
      mensagem: "Planilha gerada!"
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: "Erro: " + e.message
    };
  }
}

function validarSomaBeneficiarios_(beneficiarios, valorTotalAlvara) {
  beneficiarios = Array.isArray(beneficiarios) ? beneficiarios : [];

  var soma = beneficiarios.reduce(function(t, b) {
    return t + parseValorTexto_(b.valor);
  }, 0);

  var total = parseValorTexto_(valorTotalAlvara);
  var dif = Math.abs(soma - total);

  return {
    ok: dif <= 0.01,
    soma: soma,
    totalAlvara: total,
    diferenca: dif
  };
}

/* ================= IMPORTAÇÃO AUTOMÁTICA ================= */
function importarDocumentosEGerarPlanilha(payload, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    payload = payload || {};

    var arquivos = Array.isArray(payload.arquivos)
      ? payload.arquivos
      : [];

    if (!arquivos.length) {
      return {
        erro: true,
        mensagem: "Nenhum arquivo enviado."
      };
    }

    if (arquivos.length > 3) {
      return { erro: true, mensagem: "Envie no máximo 3 PDFs por importação." };
    }

    var arquivosValidados = [];
    for (var a = 0; a < arquivos.length; a++) {
      var validacaoPdf = validarPdfBase64Documento_(arquivos[a], { limiteMb: 10 });
      if (!validacaoPdf.ok) {
        return { erro: true, mensagem: "Arquivo " + (a + 1) + ": " + validacaoPdf.mensagem };
      }
      arquivosValidados.push({
        nomeArquivo: validacaoPdf.nomeArquivo,
        mimeType: validacaoPdf.mimeType,
        base64: validacaoPdf.base64
      });
    }
    arquivos = arquivosValidados;

    var beneficiarios = [];
    var processo = "";
    var empresa = "";
    var valorTotal = "";
    var nomesArquivos = [];

    arquivos.forEach(function(arq) {
      var nomeArquivo = String(arq.nomeArquivo || "").trim();
      var mimeType = String(arq.mimeType || "").trim();
      var base64 = String(arq.base64 || "").trim();

      if (!base64 || (mimeType && mimeType !== "application/pdf")) {
        return;
      }

      nomesArquivos.push(nomeArquivo);

      var texto = extrairTextoDePdfBase64ParaImportacao_(base64, nomeArquivo);

      if (!texto) return;

      var ehPjeCalc =
        /l[ií]quido\s+devido\s+ao\s+reclamante/i.test(texto) ||
        /planilha\s+de\s+c[aá]lculo/i.test(texto) ||
        /sistema\s+de\s+c[aá]lculos\s+trabalhistas/i.test(texto);

      var ehLista =
        /valores individualizados/i.test(texto) ||
        /l[ií]quido por reclamante/i.test(texto);

      var ehAlvara =
        /alvar[aá]\s+eletr[oô]nico/i.test(texto) ||
        (/poder judici[aá]rio/i.test(texto) && !ehPjeCalc);

      if (ehPjeCalc) {
        var dadosPje = interpretarTextoPjeCalcRecibo_(texto, nomeArquivo);

        if (dadosPje && dadosPje.beneficiarios && dadosPje.beneficiarios.length) {
          beneficiarios = beneficiarios.concat(dadosPje.beneficiarios);

          if (!processo && dadosPje.processo) {
            processo = String(dadosPje.processo.numeroProcesso || "").trim();
          }

          if (!empresa && dadosPje.processo) {
            empresa = String(dadosPje.processo.empresa || "").trim();
          }
        }

        return;
      }

      if (ehLista) {
        var dL = interpretarTextoListaFuncionariosRecibo_(texto, nomeArquivo);

        if (dL && dL.beneficiarios && dL.beneficiarios.length) {
          beneficiarios = beneficiarios.concat(dL.beneficiarios);
        }
      }

      if (ehAlvara) {
        var dA = interpretarTextoAlvaraRecibo_(texto, nomeArquivo);

        if (dA && dA.processo) {
          processo = processo || String(dA.processo.numeroProcesso || "").trim();
          empresa = empresa || String(dA.processo.empresa || "").trim();
          valorTotal = valorTotal || String(dA.processo.valorTotal || "").trim();
        }
      }
    });

    if (!valorTotal && beneficiarios.length) {
      var soma = beneficiarios.reduce(function(t, b) {
        return t + parseValorTexto_(b.valor);
      }, 0);

      valorTotal = Number(soma).toFixed(2).replace(".", ",");
    }

    var mapa = {};

    beneficiarios = beneficiarios.filter(function(b) {
      var chave =
        String(b.nome || "").trim().toUpperCase() +
        "||" +
        String(b.valor || "").trim();

      if (!chave.replace(/\|/g, "")) {
        return false;
      }

      if (mapa[chave]) {
        return false;
      }

      mapa[chave] = true;
      return true;
    });

    if (!beneficiarios.length) {
      return {
        erro: true,
        mensagem: "Nenhum beneficiário identificado nos PDFs enviados."
      };
    }

    var planilha = gerarPlanilhaAlvaraCompleta_({
      processo: processo,
      empresa: empresa,
      valorTotal: valorTotal,
      arquivosOrigem: nomesArquivos,
      beneficiarios: beneficiarios
    });

    return {
      erro: false,
      ok: true,
      mensagem: "Planilha gerada com sucesso.",
      url: planilha.url,
      processo: processo,
      empresa: empresa,
      valorTotal: valorTotal,
      totalBeneficiarios: beneficiarios.length,
      beneficiarios: beneficiarios
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: "Erro ao processar documentos: " + e.message
    };
  }
}

function importarAlvaraPDF(payload, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    payload = payload || {};

    var base64 = String(payload.base64 || "").trim();
    var nomeArquivo = String(payload.nomeArquivo || "").trim();
    var mimeType = String(payload.mimeType || "").trim();

    if (!base64) {
      return {
        erro: true,
        mensagem: "Arquivo PDF não recebido."
      };
    }

    if (mimeType && mimeType !== "application/pdf") {
      return {
        erro: true,
        mensagem: "O arquivo não é um PDF válido."
      };
    }

    var texto = extrairTextoDePdfBase64ParaImportacao_(base64, nomeArquivo);

    if (!texto) {
      return {
        erro: true,
        mensagem: "Não foi possível extrair o texto do PDF."
      };
    }

    if (
      /l[ií]quido\s+devido\s+ao\s+reclamante/i.test(texto) ||
      /planilha\s+de\s+c[aá]lculo/i.test(texto)
    ) {
      return interpretarTextoPjeCalcRecibo_(texto, nomeArquivo);
    }

    return interpretarTextoAlvaraRecibo_(texto, nomeArquivo);

  } catch (e) {
    var msg = String(e && e.message ? e.message : e);

    if (/rate limit|quota|ocr/i.test(msg)) {
      return {
        erro: true,
        mensagem: "Limite de OCR atingido. Aguarde alguns minutos e tente novamente."
      };
    }

    return {
      erro: true,
      mensagem: "Erro ao importar PDF: " + msg
    };
  }
}

/* ================= WHATSAPP ================= */
function atualizarStatusWhatsappRecibo(numeroRecibo, novoStatus, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    garantirEstruturaModuloRecibos_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!sh || sh.getLastRow() < 2) {
      return {
        erro: true,
        mensagem: "Aba de beneficiários não encontrada."
      };
    }

    const dados = sh.getDataRange().getValues();

    const cab = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxNumero = cab.indexOf("NUMERO_RECIBO");
    const idxStatusWhats = cab.indexOf("STATUS_ENVIO_WHATSAPP");

    if (idxNumero === -1 || idxStatusWhats === -1) {
      return {
        erro: true,
        mensagem: "Colunas obrigatórias não encontradas."
      };
    }

    const alvoNumero = String(numeroRecibo || "").trim();
    const status = String(novoStatus || "").trim();

    if (!alvoNumero) {
      return {
        erro: true,
        mensagem: "Número do recibo não informado."
      };
    }

    if (!status) {
      return {
        erro: true,
        mensagem: "Novo status não informado."
      };
    }

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][idxNumero] || "").trim() === alvoNumero) {
        sh.getRange(i + 1, idxStatusWhats + 1).setValue(status);

        return {
          erro: false,
          mensagem: "Status do WhatsApp atualizado com sucesso."
        };
      }
    }

    return {
      erro: true,
      mensagem: "Recibo não encontrado."
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

/* ================= RESUMO FINANCEIRO ================= */
function obterResumoFinanceiroProcesso(idProcesso, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    garantirEstruturaModuloRecibos_();

    const alvo = String(idProcesso || "").trim();

    if (!alvo) {
      return {
        erro: true,
        mensagem: "ID do processo não informado."
      };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);
    const shBen = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!shProc || shProc.getLastRow() < 2) {
      return {
        erro: true,
        mensagem: "Aba de processos não encontrada."
      };
    }

    if (!shBen || shBen.getLastRow() < 2) {
      return {
        erro: false,
        totalProcesso: 0,
        totalPago: 0,
        saldo: 0,
        percentualPago: 0
      };
    }

    const procDados = shProc.getDataRange().getValues();
    const benDados = shBen.getDataRange().getValues();

    const cabProc = procDados[0].map(function(h) {
      return String(h || "").trim();
    });

    const cabBen = benDados[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxProcId = cabProc.indexOf("ID_PROCESSO");
    const idxProcValor = cabProc.indexOf("VALOR_TOTAL");

    const idxBenId = cabBen.indexOf("ID_PROCESSO");
    const idxBenValor = cabBen.indexOf("VALOR");

    if (idxProcId === -1 || idxProcValor === -1) {
      return {
        erro: true,
        mensagem: "Colunas do processo não encontradas."
      };
    }

    if (idxBenId === -1 || idxBenValor === -1) {
      return {
        erro: true,
        mensagem: "Colunas dos beneficiários não encontradas."
      };
    }

    function normalizarNumero_(valor) {
      if (valor === null || valor === undefined || valor === "") return 0;
      if (typeof valor === "number") return valor;

      var texto = String(valor)
        .trim()
        .replace(/\s/g, "")
        .replace(/^R\$/i, "");

      if (texto.indexOf(",") > -1 && texto.indexOf(".") > -1) {
        texto = texto.replace(/\./g, "").replace(",", ".");
      } else if (texto.indexOf(",") > -1) {
        texto = texto.replace(",", ".");
      }

      var n = parseFloat(texto);

      return isNaN(n) ? 0 : n;
    }

    let totalProcesso = 0;

    for (let i = 1; i < procDados.length; i++) {
      if (String(procDados[i][idxProcId] || "").trim() === alvo) {
        totalProcesso = normalizarNumero_(procDados[i][idxProcValor]);
        break;
      }
    }

    let totalPago = 0;

    for (let i = 1; i < benDados.length; i++) {
      if (String(benDados[i][idxBenId] || "").trim() === alvo) {
        totalPago += normalizarNumero_(benDados[i][idxBenValor]);
      }
    }

    const saldo = totalProcesso - totalPago;

    const percentualPago = totalProcesso > 0
      ? Number(((totalPago / totalProcesso) * 100).toFixed(1))
      : 0;

    return {
      erro: false,
      totalProcesso: totalProcesso,
      totalPago: totalPago,
      saldo: saldo,
      percentualPago: percentualPago
    };

  } catch (e) {
    return {
      erro: true,
      mensagem: e.message
    };
  }
}

/* ================= EDITAR PROCESSO ================= */
function editarProcessoRecibo(dados, tokenSessao) {
  var sessaoEdicao = exigirModulo_(tokenSessao, "documentos", false);
  try {
    dados = dados || {};

    const idProcesso  = String(dados.idProcesso  || "").trim();
    const processo    = String(dados.processo     || "").trim();
    const empresa     = String(dados.empresa      || "").trim();
    const observacoes = String(dados.observacoes  || "").trim();
    const valorTotal  = String(dados.valorTotal   || "").trim();

    if (!idProcesso) return { erro: true, mensagem: "ID do processo não informado." };
    if (!processo)   return { erro: true, mensagem: "Processo não informado." };
    if (!empresa)    return { erro: true, mensagem: "Empresa não informada." };

    garantirEstruturaModuloRecibos_();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

    if (!sh || sh.getLastRow() < 2) {
      return { erro: true, mensagem: "Aba de processos não encontrada." };
    }

    const dadosPlanilha = sh.getDataRange().getValues();
    const cab = dadosPlanilha[0].map(function(h) {
      return String(h || "").trim();
    });

    const idxId         = cab.indexOf("ID_PROCESSO");
    const idxProcesso   = cab.indexOf("PROCESSO");
    const idxEmpresa    = cab.indexOf("EMPRESA");
    const idxObs        = cab.indexOf("OBSERVACOES");
    const idxValorTotal = cab.indexOf("VALOR_TOTAL");

    if (idxId === -1 || idxProcesso === -1 || idxEmpresa === -1) {
      return { erro: true, mensagem: "Colunas obrigatórias não encontradas." };
    }

    for (var i = 1; i < dadosPlanilha.length; i++) {
      if (String(dadosPlanilha[i][idxId] || "").trim() !== idProcesso) {
        continue;
      }

      var linhaAtual = sh.getRange(i + 1, 1, 1, cab.length).getValues()[0];
      var valorAnteriorTotal = idxValorTotal > -1 ? String(linhaAtual[idxValorTotal] || "").trim() : "";

      linhaAtual[idxProcesso] = processo;
      linhaAtual[idxEmpresa]  = empresa;

      if (idxObs        > -1) linhaAtual[idxObs]        = observacoes;
      if (idxValorTotal > -1) linhaAtual[idxValorTotal]  = valorTotal;

      sh.getRange(i + 1, 1, 1, cab.length).setValues([linhaAtual]);

      if (idxValorTotal > -1 && valorTotal) {
        finAudRegistrarAlteracaoValor_("RECIBOS", idProcesso, valorAnteriorTotal, valorTotal,
          (sessaoEdicao && (sessaoEdicao.email || sessaoEdicao.usuario)) || "SISGEP", dados.motivoAlteracaoValor || "");
      }

      return {
        erro: false,
        mensagem: "Processo atualizado com sucesso.",
        idProcesso: idProcesso
      };
    }

    return { erro: true, mensagem: "Processo não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: e.message };
  }
}
/* ================= HELPERS FINAIS ================= */

function testarPermissaoDriveRecibo() {
  var resultado = {
    ok: true,
    etapa: "iniciando"
  };

  try {
    /* Esta função CRIA subpasta, então é gravação: resolve por ambiente e
       respeita a trava. Ver AmbienteRecursos.gs. */
    var idPastaRecibos = getRecursoId_("RECIBOS");
    if (!idPastaRecibos) {
      throw new Error("Pasta de recibos não informada.");
    }

    resultado.etapa = "acessando pasta principal";
    var pastaPai = DriveApp.getFolderById(idPastaRecibos);

    resultado.etapa = "lendo nome da pasta";
    var nomePasta = pastaPai.getName();

    resultado.etapa = "procurando/criando subpasta do ano";
    var ano = String(new Date().getFullYear());
    var pastasAno = pastaPai.getFoldersByName(ano);
    var pastaAno = pastasAno.hasNext()
      ? pastasAno.next()
      : pastaPai.createFolder(ano);

    resultado.etapa = "criando documento temporário";
    var doc = DocumentApp.create("TESTE_RECIBO_PERMISSAO_" + Date.now());

    doc.getBody().setText("Teste de permissão do módulo de recibos.");
    doc.saveAndClose();

    resultado.etapa = "convertendo para PDF";
    var arquivoDoc = DriveApp.getFileById(doc.getId());
    var pdfBlob = arquivoDoc
      .getBlob()
      .getAs(MimeType.PDF)
      .setName("teste_permissao_recibo.pdf");

    resultado.etapa = "gravando PDF na pasta do ano";
    var pdfFile = pastaAno.createFile(pdfBlob);

    resultado.etapa = "definindo compartilhamento";

    try {
      arquivoAplicarPolitica_(pdfFile, "Recibo.gs");
    } catch (eShare) {
      Logger.log("⚠ Não foi possível liberar compartilhamento: " + eShare.message);
    }

    var url = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";

    try {
      arquivoDoc.setTrashed(true);
    } catch (e1) {}

    try {
      pdfFile.setTrashed(true);
    } catch (e2) {}

    return {
      ok: true,
      mensagem: "Permissões do Drive OK.",
      pastaPrincipal: nomePasta,
      pastaAno: pastaAno.getName(),
      urlTeste: url
    };

  } catch (e) {
    return {
      ok: false,
      mensagem: "Falha no teste de Drive: " + e.message,
      etapa: resultado.etapa || "desconhecida"
    };
  }
}
/**
 * Grava beneficiários em lote (Otimização de Performance)
 * @param {Array} listaDeDados Array de objetos com os dados
 */
/**
 * 🔥 OTIMIZAÇÃO: Grava beneficiários em lote (Batch Write)
 * Substitui múltiplas chamadas de appendRow por uma única chamada setValues
 */
function registrarBeneficiariosEmLote_(listaDeDados) {
  if (!listaDeDados || listaDeDados.length === 0) return;
  
  garantirEstruturaModuloRecibos_();
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);
  
  // Garante que os cabeçalhos existem para mapear as colunas
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  
  // Cria a matriz 2D para o setValues
  const matriz = listaDeDados.map(dados => {
    const linha = new Array(headers.length).fill("");
    
    function set(col, val) { const i = headers.indexOf(col); if(i > -1) linha[i] = val; }
    
    set("ID_PROCESSO", dados.idProcesso);
    set("NUMERO_RECIBO", dados.numeroRecibo);
    set("CODIGO_VALIDACAO", dados.codigo);
    set("DATA_GERACAO", new Date()); // Data atual do servidor
    set("NOME", dados.nome);
    set("CPF", dados.cpf);
    set("VALOR", dados.valor);
    set("VALOR_EXTENSO", dados.valorExtenso || "");
    set("PIX", dados.pix);
    set("TIPO_PIX", dados.tipoPix);
    set("EMAIL", dados.email);
    set("WHATSAPP", dados.whatsapp);
    set("SINDICALIZADO", dados.sindicalizado);
    set("STATUS_ENVIO_EMAIL", dados.statusEmail);
    set("STATUS_ENVIO_WHATSAPP", dados.statusWhatsapp);
    set("LINK_PDF", dados.linkPdf);
    set("USUARIO_GERADOR", dados.usuario);
    set("OBSERVACOES", dados.observacoes);
    set("FORMA_PAGAMENTO", dados.formaPagamento);
    set("CHEQUE_NUMERO", dados.chequeNumero);
    set("CHEQUE_DATA", dados.chequeData);
    set("STATUS_ASSINATURA", dados.statusAssinatura || "");
    
    return linha;
  });
  
  // ✅ Escreve TODOS os dados de uma única vez (Performance máxima)
  sh.getRange(sh.getLastRow() + 1, 1, matriz.length, headers.length).setValues(matriz);
}
function buscarBeneficiariosReciboPorEmpresa(empresaBusca, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  return buscarBeneficiariosPorEmpresa(empresaBusca);
}
function testarListarProcessos() {
  try {
    var resultado = listarProcessosRecibo();
    Logger.log("Total retornado: " + resultado.length);
    Logger.log(JSON.stringify(resultado.slice(0, 3)));
  } catch (e) {
    Logger.log("ERRO: " + e.message);
    Logger.log(e.stack);
  }
}
function testarIncludeScripts() {
  try {
    var conteudo = HtmlService.createHtmlOutputFromFile("Scripts_Recibos").getContent();
    Logger.log("OK - tamanho: " + conteudo.length + " chars");
    Logger.log("Início: " + conteudo.substring(0, 100));
  } catch(e) {
    Logger.log("ERRO: " + e.message);
  }
}
// ─── UTILITÁRIO: carrega logo e assinatura como base64 ───
function carregarImagensRecibo_() {
  var logoBase64 = "", logoMime = "image/jpeg";
  var assBase64  = "", assMime  = "image/jpeg";

  try {
    var lb = DriveApp.getFileById("1F1yULzB9yUJnjtD3VnRuZYRZuUK1cZ62").getBlob();
    logoBase64 = Utilities.base64Encode(lb.getBytes());
    logoMime   = lb.getContentType() || "image/jpeg";
  } catch(e) { Logger.log("Logo: " + e.message); }

  try {
    var ab = DriveApp.getFileById("1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe").getBlob();
    assBase64 = Utilities.base64Encode(ab.getBytes());
    assMime   = ab.getContentType() || "image/jpeg";
  } catch(e) { Logger.log("Assinatura: " + e.message); }

  return { logoBase64:logoBase64, logoMime:logoMime, assBase64:assBase64, assMime:assMime };
}

// ─── UTILITÁRIO: converte HTML para PDF preservando layout ───
function recibo_converterHtmlParaPdf_(html, titulo, pasta) {

  titulo = titulo || "Documento";

  var blob = HtmlService
    .createHtmlOutput(html)
    .getBlob()
    .getAs("application/pdf")
    .setName(titulo + ".pdf");

  var pdfFile = pasta.createFile(blob);

  return pdfFile;
}
// ─── GERADOR DE HTML COMPARTILHADO (preview e PDF) ───
function gerarHtmlReciboCompleto_(p, isPreview) {
  p = p || {};

  var assTag = p.assBase64
    ? '<img src="data:' + p.assMime + ';base64,' + p.assBase64 + '" style="height:52px;width:auto;object-fit:contain;display:block;margin:0 auto 2px;">'
    : '';

  var textoCorpoPagamento = p.textoPgtoCorpo || p.textoPgto || "";
  var rotuloPagamento = p.rotuloPagamento || (
    p.formaPagamento === "CHEQUE"
      ? "🏦 PAGAMENTO VIA CHEQUE"
      : "⚡ PAGAMENTO VIA PIX"
  );

  // ✅ Detecta cheque e compacta TODOS os espaçamentos automaticamente
  var temCheque = (p.formaPagamento === "CHEQUE");
  var thPad    = temCheque ? "16px 34px 14px" : "22px 34px 18px";
  var tvPad    = temCheque ? "12px 34px 0"    : "20px 34px 0";
  var bfMargin = temCheque ? "12px 34px 8px"  : "20px 34px 14px";
  var corpPad  = temCheque ? "0 34px 4px"     : "0 34px 8px";
  var rodPad   = temCheque ? "14px 34px 12px" : "26px 34px 18px";
  var txtSize  = temCheque ? "13px"           : "14px";
  var txtLine  = temCheque ? "1.55"           : "1.65";
  var thNome   = temCheque ? "26px"           : "30px";
  var thSub    = temCheque ? "13px"           : "14px";
  var thMb     = temCheque ? "10px"           : "14px";
  var thMt     = temCheque ? "12px"           : "16px";

  var watermark = isPreview
    ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(0,31,77,.025);pointer-events:none;user-select:none;white-space:nowrap;z-index:0;">PRÉVIA</div>'
    : '';

  var actionBar = isPreview ? `
    <div class="no-print" style="position:fixed;top:0;left:0;right:0;height:56px;background:#001f4d;display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;font-weight:700;">
        🧾 Recibo
        <span style="background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#C9A84C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">PRÉVIA</span>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="window.print()" style="height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          🖨 Imprimir
        </button>
        <button onclick="window.location.reload()" style="height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          🔄 Atualizar
        </button>
      </div>
    </div>
  ` : '';

  var codigoHtml = (!isPreview && p.codigo)
    ? '<div class="codigo-verificacao">Código de verificação: <strong>' + p.codigo + '</strong></div>'
    : '';

  var obsHtml = p.obs
    ? '<div class="obs-box">📝 ' + p.obs + '</div>'
    : '';

  var topPad = isPreview ? '76px 24px 48px' : '0';

  // ✅ Classe do nome baseada no tier
  var nomeClass = "bf-n" + (p.nomeTier ? " bf-n-" + p.nomeTier : "");

  // ✅ CORRIGIDO: parágrafo do corpo diferente para recibo diverso vs processo judicial
  var corpoParagrafo;

  if (p.isReciboDiverso) {
    // Recibo avulso/diverso — sem linguagem de processo judicial
    corpoParagrafo =
      "<strong>" + p.nome + "</strong>" +
      (p.cpf ? ", inscrito(a) no CPF sob nº <strong>" + p.cpf + "</strong>" : "") +
      ", declaro que recebi do <strong>SINDEDUCAÇÃO-ES</strong> – " +
      "Sindicato dos Educadores Técnico-Administrativos em " +
      "Estabelecimentos de Ensino Particular no Estado do Espírito Santo, " +
      "a importância de: <strong>R$ " + p.valorFmt + "</strong> " +
      "(<em>" + p.valorExt + "</em>), " +
      textoCorpoPagamento +
      ", dando plena e geral quitação. " +
      (p.obsTexto || "");
  } else {
    // Recibo de processo judicial — texto original
    corpoParagrafo =
      "<strong>" + p.nome + "</strong>, inscrito(a) no CPF sob nº <strong>" + p.cpf + "</strong>, " +
      "declaro que recebi do <strong>SINDEDUCAÇÃO-ES</strong> – Sindicato dos Educadores " +
      "Técnico-Administrativos em Estabelecimentos de Ensino Particular no Estado do Espírito Santo, " +
      "a importância de: <strong>R$ " + p.valorFmt + "</strong> (<em>" + p.valorExt + "</em>), " +
      textoCorpoPagamento + ", valor referente ao Proc. nº <strong>" + p.processo + "</strong> " +
      "(Processo de Insalubridade), dando quitação total ao mesmo, processo que tramita em esfera " +
      "trabalhista, em face de <strong>" + p.empresa + "</strong>, na qualidade de reclamante, sendo " +
      "representado por <strong>Sipolati &amp; Bezerra Advogados Associados / SINDEDUCAÇÃO-ES</strong>. " +
      (p.obsTexto || "");
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recibo ${p.numero}</title>

<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

<style>
*,*::before,*::after{
  box-sizing:border-box;
  margin:0;
  padding:0;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important;
}

html,body{
  width:100%;
  min-height:100%;
  font-family:'Plus Jakarta Sans',Arial,sans-serif;
  background:#eef2f7;
  color:#0f172a;
}

body{
  padding:${topPad};
}

@page{
  size:A4 portrait;
  margin:0.3cm;
}

.pw{
  width:100%;
  display:flex;
  justify-content:center;
}

.rec{
  width:100%;
  max-width:780px;
  background:#fff;
  overflow:hidden;
  border-radius:8px;
  box-shadow:0 6px 30px rgba(0,20,60,.12);
  position:relative;
  page-break-inside:avoid;
}

/* ✅ Cabeçalho compactado no cheque */
.th{
  padding:${thPad};
  background:linear-gradient(135deg,#001f4d,#003b82);
  color:#fff;
  border-bottom:4px solid #C9A84C;
}

.th-inner{
  border-left:4px solid #C9A84C;
  padding-left:22px;
}

.th-nome{
  font-size:${thNome};
  font-weight:900;
  line-height:1;
  margin-bottom:${thMb};
}

.th-sub{
  font-size:${thSub};
  line-height:1.45;
  font-weight:600;
  color:rgba(255,255,255,.94);
}

.th-cnpj{
  margin-top:${thMt};
  font-size:13px;
  font-weight:900;
}

/* ✅ Padding dinâmico: menor no cheque */
.tv{
  padding:${tvPad};
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:28px;
}

.tv-t{
  font-size:48px;
  font-weight:900;
  color:#001f4d;
  line-height:1;
  letter-spacing:-2px;
}

.tv-n{
  font-size:17px;
  color:#001f4d;
  font-weight:900;
  margin-top:12px;
}

.tv-line{
  width:54px;
  height:4px;
  background:#C9A84C;
  border-radius:999px;
  margin-top:18px;
}

.vb{
  min-width:280px;
  overflow:hidden;
  border-radius:13px;
  border:1px solid rgba(0,31,77,.7);
  background:linear-gradient(135deg,#001f4d,#002f6c);
}

.vb-top{
  padding:14px 22px 12px;
  text-align:center;
}

.vb-l{
  font-size:14px;
  font-weight:900;
  color:#fff;
  letter-spacing:.08em;
  margin-bottom:8px;
}

.vb-v{
  font-size:34px;
  font-weight:900;
  color:#C9A84C;
  letter-spacing:-1px;
}

.vb-e{
  background:#fff1c7;
  color:#0f172a;
  text-align:center;
  padding:10px 14px;
  font-size:11px;
  line-height:1.35;
}

/* ✅ Card cresce pelo conteúdo — sem max-height */
/* ✅ Margem dinâmica: menor no cheque */
.bf{
  margin:${bfMargin};
  border:1px solid #cfd8e3;
  border-radius:16px;
  display:grid;
  grid-template-columns:58% 42%;
  align-items:stretch;
  overflow:hidden;
  background:#fff;
}

.bf-l{
  display:flex;
  align-items:center;
  gap:14px;
  padding:12px 14px;
  border-right:2px solid #d8e0ec;
  min-width:0;
}

.bf-r{
  padding:12px 16px;
  min-width:0;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

.bf-av{
  width:62px;
  height:62px;
  border-radius:12px;
  background:linear-gradient(135deg,#001f4d,#1565C0);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:23px;
  font-weight:900;
  color:#fff;
  flex-shrink:0;
}

/* ✅ Três tiers de tamanho para nomes longos */
.bf-n{
  font-size:20px;
  font-weight:900;
  color:#001f4d;
  margin-bottom:10px;
  line-height:1.15;
  word-break:break-word;
}

.bf-n-sm{
  font-size:16px!important;
  line-height:1.10!important;
}

.bf-n-xs{
  font-size:13px!important;
  line-height:1.08!important;
  letter-spacing:-0.01em!important;
}

.bf-c{
  font-size:16px;
  color:#475569;
  font-weight:600;
}

.bf-pl{
  font-size:17px;
  color:#334155;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.02em;
  margin-bottom:12px;
}

.bf-pv{
  font-size:18px;
  font-weight:900;
  line-height:1.4;
  color:#001f4d;
  word-break:break-word;
}

/* ✅ Corpo compactado no cheque */
.corp{
  padding:${corpPad};
}

/* ✅ Fonte e entrelinha menores no cheque */
.txt{
  font-size:${txtSize};
  line-height:${txtLine};
  text-align:justify;
  color:#111827;
  font-weight:500;
}

.txt strong{
  font-weight:900;
}

.txt em{
  font-style:normal;
  font-weight:700;
}

.obs-box{
  margin-top:12px;
  padding:10px 12px;
  border-radius:8px;
  background:#f0f9ff;
  border-left:3px solid #0891b2;
  font-size:12px;
}

/* ✅ Rodapé compactado no cheque */
.rod{
  padding:${rodPad};
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:42px;
}

.dl{
  grid-column:1 / -1;
  text-align:center;
}

.dl strong{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:18px;
  width:100%;
  color:#C9A84C;
  font-size:17px;
  font-weight:900;
  margin-bottom:16px;
}

.dl strong::before,
.dl strong::after{
  content:'';
  flex:1;
  max-width:150px;
  height:2px;
  background:#C9A84C;
}

.dl span{
  font-size:18px;
  font-weight:900;
  color:#0f172a;
}

.as{
  text-align:center;
}

.as-img{
  height:52px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  margin-bottom:8px;
}

.as-ln{
  height:2px;
  background:#111827;
  margin-bottom:10px;
}

.as-nm{
  font-size:14px;
  font-weight:900;
}

.as-cg{
  font-size:13px;
  color:#334155;
  margin-top:4px;
}

.codigo-verificacao{
  padding:12px 40px 8px;
  text-align:center;
  font-size:14px;
  color:#334155;
  font-weight:600;
}

.tf{
  padding:0 0 4px;
  border-top:4px solid #001f4d;
  background:#f8fafc;
  text-align:center;
}

.tf-s{
  padding:10px 20px 2px;
  font-size:15px;
  line-height:1.55;
  color:#334155;
}

.tf-s strong{
  display:block;
  color:#001f4d;
  font-size:22px;
  font-weight:900;
  margin-bottom:8px;
}

.tf-c{
  margin:4px 30px 0;
  background:#001f4d;
  color:#fff;
  border-radius:10px;
  padding:8px 12px;
  font-size:16px;
  font-weight:700;
}

.tf-c strong{
  color:#C9A84C;
}

@media print{
  @page{
    size:A4 portrait;
    margin:0.3cm;
  }

  html,body{
    width:210mm!important;
    min-height:auto!important;
    background:#fff!important;
    -webkit-print-color-adjust:exact!important;
    print-color-adjust:exact!important;
  }

  body{
    padding:0!important;
  }

  .no-print{
    display:none!important;
  }

  .pw{
    width:100%;
    display:flex;
    justify-content:center;
    padding:24px;
  }

  .rec{
    width:100%!important;
    max-width:200mm!important;
    margin:0 auto!important;
    border-radius:0!important;
    box-shadow:none!important;
    overflow:hidden!important;
    page-break-inside:avoid!important;
  }
}
</style></head>

<body>
${watermark}
${actionBar}

<div class="pw">
<div class="rec">

  <div class="th">
    <div class="th-inner">
      <div class="th-nome">SINDEDUCAÇÃO-ES</div>
      <div class="th-sub">
        Sindicato dos Educadores Técnico-Administrativos em<br>
        Estabelecimentos de Ensino Particular no Estado do Espírito Santo
      </div>
      <div class="th-cnpj">CNPJ: 31.815.780/0001-51</div>
    </div>
  </div>

  <div class="tv">
    <div>
      <div class="tv-t">RECIBO</div>
      <div class="tv-n">${p.numero}</div>
      <div class="tv-line"></div>
    </div>

    <div class="vb">
      <div class="vb-top">
        <div class="vb-l">VALOR TOTAL</div>
        <div class="vb-v">R$ ${p.valorFmt}</div>
      </div>
      <div class="vb-e">${p.valorExt}</div>
    </div>
  </div>

  <div class="bf">
    <div class="bf-l">
      <div class="bf-av">${p.iniciais}</div>
      <div style="flex:1;min-width:0;">
        <div class="${nomeClass}">${p.nome}</div>
        <div class="bf-c">CPF: ${p.cpf}</div>
      </div>
    </div>

    <div class="bf-r">
      <div class="bf-pl">${rotuloPagamento}</div>
      <div class="bf-pv">${p.textoPgto}</div>
    </div>
  </div>

  <div class="corp">
    <p class="txt">${corpoParagrafo}</p>
    ${obsHtml}
  </div>

  <div class="rod">
    <div class="dl">
      <strong>Local e Data</strong>
      <span>Vitória/ES, ${p.dataHoje}.</span>
    </div>

    <div class="as">
      <div class="as-img">${assTag}</div>
      <div class="as-ln"></div>
      <div class="as-nm">LEONIL DIAS DA SILVA</div>
      <div class="as-cg">Presidente – SindEducação-ES</div>
    </div>

    <div class="as">
      <div class="as-img"></div>
      <div class="as-ln"></div>
      <div class="as-nm">${p.nome}</div>
      <div class="as-cg">CPF: ${p.cpf} · Beneficiário(a)</div>
    </div>
  </div>

  ${codigoHtml}

  <div class="tf">
    <div class="tf-s">
      <strong>SINDEDUCAÇÃO-ES</strong>
      Avenida Nossa Senhora dos Navegantes, 755, Salas 707/708 – Enseada do Suá - Vitória/ES · CEP 29.050-355<br>
      (27) 99735-8900 · secretaria@sindeducacao.com
    </div>

    <div class="tf-c">
      Documento gerado pelo <strong>SISGEP</strong> · Nº <strong>${p.numero}</strong>
    </div>
  </div>

</div>
</div>
</body>
</html>`;
}
function registrarProgressoGeracao_(progresso) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      'sisgep_progresso_recibo',
      JSON.stringify(progresso)
    );
  } catch(e) { Logger.log("Progresso: " + e.message); }
}

function obterProgressoGeracao(tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    var val = PropertiesService.getScriptProperties().getProperty('sisgep_progresso_recibo');
    if (!val) return { status:"idle", atual:0, total:0, ultimo:"", concluido:false };
    return JSON.parse(val);
  } catch(e) {
    return { status:"idle", atual:0, total:0, ultimo:"", concluido:false };
  }
}

/**
 * Valida PDF recebido em Base64 antes de processar ou salvar no Drive.
 * O MIME informado pelo navegador é apenas um indício; a assinatura %PDF-
 * e o tamanho decodificado são verificados no servidor.
 */
function validarPdfBase64Documento_(dados, opcoes) {
  dados = dados || {};
  opcoes = opcoes || {};

  var limiteMb = Number(opcoes.limiteMb || 10);
  var limiteBytes = limiteMb * 1024 * 1024;
  var nome = String(dados.nomeArquivo || dados.nomeArq || "documento.pdf").trim();
  var mimeType = String(dados.mimeType || "").trim().toLowerCase();
  var base64 = String(dados.base64 || "").trim();

  if (!base64) return { ok: false, mensagem: "Arquivo PDF não recebido." };
  if (mimeType && mimeType !== "application/pdf") {
    return { ok: false, mensagem: "Tipo de arquivo inválido. Envie somente PDF." };
  }

  base64 = base64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+\/=]+$/.test(base64)) {
    return { ok: false, mensagem: "Conteúdo Base64 inválido." };
  }

  var tamanhoEstimado = Math.floor(base64.length * 3 / 4);
  if (tamanhoEstimado > limiteBytes) {
    return { ok: false, mensagem: "O PDF excede o limite de " + limiteMb + " MB." };
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (e) {
    return { ok: false, mensagem: "Não foi possível decodificar o PDF." };
  }

  if (!bytes || bytes.length < 5 || bytes.length > limiteBytes) {
    return { ok: false, mensagem: bytes && bytes.length > limiteBytes ? "O PDF excede o limite de " + limiteMb + " MB." : "Arquivo PDF vazio ou inválido." };
  }

  if (bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45) {
    return { ok: false, mensagem: "O conteúdo enviado não possui uma assinatura PDF válida." };
  }

  nome = nome.replace(/[\\/:*?"<>|\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!/\.pdf$/i.test(nome)) nome += ".pdf";

  return { ok: true, nomeArquivo: nome, mimeType: "application/pdf", base64: base64, bytes: bytes, tamanho: bytes.length };
}
