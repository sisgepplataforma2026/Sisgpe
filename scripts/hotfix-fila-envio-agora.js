const fs = require("fs");

const arquivoFila = "FilaOficios.gs";
const arquivoTela = "OficiosScripts.html";
let fila = fs.readFileSync(arquivoFila, "utf8");
let tela = fs.readFileSync(arquivoTela, "utf8");
let alterouFila = false;
let alterouTela = false;

function substituir(texto, antigo, novo, descricao, alvo) {
  if (texto.indexOf(antigo) === -1) {
    throw new Error("Não encontrei o trecho esperado para: " + descricao);
  }
  console.log("OK - " + descricao);
  return texto.replace(antigo, novo);
}

// ---------------------------------------------------------------------------
// 1) Correções anteriores: número duplicado + tolerância a concorrência
// ---------------------------------------------------------------------------
if (!fila.includes("var linhaIdxFallback = -1;")) {
  const antigo = `  var linhaIdx = -1;\n\n  for (var i = dados.length - 1; i >= 0; i--) {\n    if (String(dados[i][colNumero - 1] || "").trim() === String(numero).trim()) {\n      linhaIdx = i;\n      break;\n    }\n  }`;
  const novo = `  var linhaIdx = -1;\n  var linhaIdxFallback = -1;\n  var numeroBuscado = String(numero).trim();\n\n  // Havendo números repetidos (comum em cópia de Produção para HML),\n  // prioriza o registro mais recente que ainda pode ser enviado. Só usa um\n  // ENVIADO/CONFIRMADO como fallback quando não existe linha acionável.\n  for (var i = dados.length - 1; i >= 0; i--) {\n    if (String(dados[i][colNumero - 1] || "").trim() !== numeroBuscado) continue;\n\n    var statusCandidato = String(dados[i][colStatus - 1] || "").trim().toUpperCase();\n    if (statusCandidato === "PENDENTE" || statusCandidato === "ERRO" || statusCandidato === "PROCESSANDO") {\n      linhaIdx = i;\n      break;\n    }\n\n    if (linhaIdxFallback === -1) linhaIdxFallback = i;\n  }\n\n  if (linhaIdx === -1) linhaIdx = linhaIdxFallback;`;
  fila = substituir(fila, antigo, novo, "priorizar a linha acionável mais recente", arquivoFila);
  alterouFila = true;
}

if (!fila.includes("lockEnvioAgora.tryLock(15000)")) {
  const antigo = `  var valoresLinha;\n  var lockEnvioAgora = LockService.getScriptLock();\n  if (!lockEnvioAgora.tryLock(5000)) {\n    return { ok: false, mensagem: "Fila ocupada. Tente novamente em alguns segundos." };\n  }`;
  const novo = `  var valoresLinha;\n  var lockEnvioAgora = LockService.getScriptLock();\n  var lockObtido = false;\n\n  // O SISGEP possui vários módulos no mesmo projeto. Um lock global curto de\n  // 5 s fazia o botão "Enviar agora" desistir durante operações paralelas,\n  // sem sequer registrar uma tentativa. Aguarda um pouco mais, mantendo a\n  // proteção contra envio duplicado.\n  try {\n    lockObtido = lockEnvioAgora.tryLock(15000);\n  } catch (eLock) {\n    Logger.log("[ENVIO_AGORA] Falha ao obter lock para o ofício " + numero + ": " + (eLock.message || eLock));\n  }\n\n  if (!lockObtido) {\n    Logger.log("[ENVIO_AGORA] Fila permaneceu ocupada para o ofício " + numero + " após 15 s.");\n    return { ok: false, mensagem: "Fila ocupada. Aguarde alguns segundos e tente novamente." };\n  }`;
  fila = substituir(fila, antigo, novo, "aumentar a tolerância ao lock do envio imediato", arquivoFila);
  alterouFila = true;
}

if (!fila.includes("if (lockObtido) lockEnvioAgora.releaseLock();")) {
  const antigo = `  } finally {\n    lockEnvioAgora.releaseLock();\n  }\n\n  try {\n\n    var anexos = [];`;
  const novo = `  } finally {\n    if (lockObtido) lockEnvioAgora.releaseLock();\n  }\n\n  try {\n\n    var anexos = [];`;
  fila = substituir(fila, antigo, novo, "liberar o lock somente quando ele foi obtido", arquivoFila);
  alterouFila = true;
}

if (!fila.includes("[ENVIO_AGORA] Selecionado")) {
  const antigo = `  var status = String(linha[colStatus - 1] || "").trim().toUpperCase();`;
  const novo = `  var status = String(linha[colStatus - 1] || "").trim().toUpperCase();\n  Logger.log("[ENVIO_AGORA] Selecionado ofício " + numero + " na linha " + linhaPlanilha + " com status " + status + ".");`;
  fila = substituir(fila, antigo, novo, "registrar qual linha foi selecionada", arquivoFila);
  alterouFila = true;
}

// ---------------------------------------------------------------------------
// 2) Correção definitiva: o botão passa o ID único da fila
// ---------------------------------------------------------------------------
if (!fila.includes("function enviarOficioDaFilaAgora(numero, tokenSessao, filaId)")) {
  fila = substituir(
    fila,
    `function enviarOficioDaFilaAgora(numero, tokenSessao) {`,
    `function enviarOficioDaFilaAgora(numero, tokenSessao, filaId) {`,
    "aceitar filaId no backend",
    arquivoFila
  );
  alterouFila = true;
}

if (!fila.includes('var colId                  = headerMap["ID"]')) {
  fila = substituir(
    fila,
    `  var colNumero              = headerMap["NUMERO_OFICIO"];`,
    `  var colId                  = headerMap["ID"];\n  var colNumero              = headerMap["NUMERO_OFICIO"];`,
    "mapear a coluna ID da fila",
    arquivoFila
  );
  alterouFila = true;
}

if (!fila.includes("ID: colId,")) {
  fila = substituir(
    fila,
    `  var obrigatorias = {\n    NUMERO_OFICIO: colNumero,`,
    `  var obrigatorias = {\n    ID: colId,\n    NUMERO_OFICIO: colNumero,`,
    "tornar ID obrigatório no envio imediato",
    arquivoFila
  );
  alterouFila = true;
}

if (!fila.includes('var filaIdBuscado = String(filaId || "").trim();')) {
  const antigo = `  var totalCols = sh.getLastColumn();\n  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();\n  var linhaIdx = -1;\n  var linhaIdxFallback = -1;\n  var numeroBuscado = String(numero).trim();\n\n  // Havendo números repetidos (comum em cópia de Produção para HML),\n  // prioriza o registro mais recente que ainda pode ser enviado. Só usa um\n  // ENVIADO/CONFIRMADO como fallback quando não existe linha acionável.\n  for (var i = dados.length - 1; i >= 0; i--) {\n    if (String(dados[i][colNumero - 1] || "").trim() !== numeroBuscado) continue;\n\n    var statusCandidato = String(dados[i][colStatus - 1] || "").trim().toUpperCase();\n    if (statusCandidato === "PENDENTE" || statusCandidato === "ERRO" || statusCandidato === "PROCESSANDO") {\n      linhaIdx = i;\n      break;\n    }\n\n    if (linhaIdxFallback === -1) linhaIdxFallback = i;\n  }\n\n  if (linhaIdx === -1) linhaIdx = linhaIdxFallback;\n\n  if (linhaIdx === -1) {\n    return { ok: false, mensagem: "Ofício " + numero + " não encontrado na fila." };\n  }`;

  const novo = `  var totalCols = sh.getLastColumn();\n  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();\n  var linhaIdx = -1;\n  var linhaIdxFallback = -1;\n  var numeroBuscado = String(numero).trim();\n  var filaIdBuscado = String(filaId || "").trim();\n\n  // Caminho principal: o ID é único e identifica exatamente a linha criada\n  // nesta emissão. Isso elimina ambiguidades quando dois ambientes possuem o\n  // mesmo NUMERO_OFICIO (ex.: histórico de Produção copiado para HML).\n  if (filaIdBuscado) {\n    for (var i = dados.length - 1; i >= 0; i--) {\n      if (String(dados[i][colId - 1] || "").trim() === filaIdBuscado) {\n        linhaIdx = i;\n        break;\n      }\n    }\n\n    if (linhaIdx === -1) {\n      return { ok: false, mensagem: "Registro da fila não encontrado para o ID informado." };\n    }\n\n    var numeroDoId = String(dados[linhaIdx][colNumero - 1] || "").trim();\n    if (numeroBuscado && numeroDoId !== numeroBuscado) {\n      return { ok: false, mensagem: "O ID da fila não corresponde ao número do ofício informado." };\n    }\n  } else {\n    // Compatibilidade com chamadas antigas: sem filaId, usa o número e\n    // prioriza o registro acionável mais recente.\n    for (var j = dados.length - 1; j >= 0; j--) {\n      if (String(dados[j][colNumero - 1] || "").trim() !== numeroBuscado) continue;\n\n      var statusCandidato = String(dados[j][colStatus - 1] || "").trim().toUpperCase();\n      if (statusCandidato === "PENDENTE" || statusCandidato === "ERRO" || statusCandidato === "PROCESSANDO") {\n        linhaIdx = j;\n        break;\n      }\n\n      if (linhaIdxFallback === -1) linhaIdxFallback = j;\n    }\n\n    if (linhaIdx === -1) linhaIdx = linhaIdxFallback;\n\n    if (linhaIdx === -1) {\n      return { ok: false, mensagem: "Ofício " + numero + " não encontrado na fila." };\n    }\n  }`;

  fila = substituir(fila, antigo, novo, "selecionar primeiro pelo filaId", arquivoFila);
  alterouFila = true;
}

if (!tela.includes("var filaId = dadosGerados.filaId || \"\";")) {
  tela = substituir(
    tela,
    `    var numero = dadosGerados.numero || "";`,
    `    var numero = dadosGerados.numero || "";\n    var filaId = dadosGerados.filaId || "";`,
    "ler filaId retornado pela geração",
    arquivoTela
  );
  alterouTela = true;
}

if (!tela.includes("enviarEmailOficioAgora('" + "\" + numero + \"" + "','" + "\" + filaId + \"" + "')")) {
  const antigo = `onclick=\\\"enviarEmailOficioAgora('" + numero + "')\\\"`;
  const novo = `onclick=\\\"enviarEmailOficioAgora('" + numero + "','" + filaId + "')\\\"`;
  tela = substituir(tela, antigo, novo, "passar filaId no botão Enviar agora", arquivoTela);
  alterouTela = true;
}

if (!tela.includes("function enviarEmailOficioAgora(numero, filaId)")) {
  tela = substituir(
    tela,
    `function enviarEmailOficioAgora(numero) {`,
    `function enviarEmailOficioAgora(numero, filaId) {`,
    "aceitar filaId na função da tela",
    arquivoTela
  );
  alterouTela = true;
}

if (!tela.includes(".enviarOficioDaFilaAgora(numero, SISGEP_TOKEN_SESSAO, filaId || \"\");")) {
  tela = substituir(
    tela,
    `      .enviarOficioDaFilaAgora(numero, SISGEP_TOKEN_SESSAO);`,
    `      .enviarOficioDaFilaAgora(numero, SISGEP_TOKEN_SESSAO, filaId || "");`,
    "enviar filaId ao backend",
    arquivoTela
  );
  alterouTela = true;
}

if (alterouFila) fs.writeFileSync(arquivoFila, fila, "utf8");
if (alterouTela) fs.writeFileSync(arquivoTela, tela, "utf8");

if (!alterouFila && !alterouTela) {
  console.log("Hotfix já estava aplicado; nenhuma alteração necessária.");
} else {
  console.log("Hotfix aplicado em: " + [alterouFila && arquivoFila, alterouTela && arquivoTela].filter(Boolean).join(", "));
}
