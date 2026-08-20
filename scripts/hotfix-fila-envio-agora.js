const fs = require("fs");

const arquivo = "FilaOficios.gs";
let src = fs.readFileSync(arquivo, "utf8");
let alterou = false;

function substituirUmaVez(regex, novo, descricao) {
  if (!regex.test(src)) {
    throw new Error("Não encontrei o trecho esperado para: " + descricao);
  }
  src = src.replace(regex, novo);
  alterou = true;
  console.log("OK - " + descricao);
}

if (!src.includes("var linhaIdxFallback = -1;")) {
  substituirUmaVez(
    /  var linhaIdx = -1;\r?\n\r?\n  for \(var i = dados\.length - 1; i >= 0; i--\) \{\r?\n    if \(String\(dados\[i\]\[colNumero - 1\] \|\| \"\"\)\.trim\(\) === String\(numero\)\.trim\(\)\) \{\r?\n      linhaIdx = i;\r?\n      break;\r?\n    \}\r?\n  \}/,
    `  var linhaIdx = -1;\n  var linhaIdxFallback = -1;\n  var numeroBuscado = String(numero).trim();\n\n  // Havendo números repetidos (comum em cópia de Produção para HML),\n  // prioriza o registro mais recente que ainda pode ser enviado. Só usa um\n  // ENVIADO/CONFIRMADO como fallback quando não existe linha acionável.\n  for (var i = dados.length - 1; i >= 0; i--) {\n    if (String(dados[i][colNumero - 1] || \"\").trim() !== numeroBuscado) continue;\n\n    var statusCandidato = String(dados[i][colStatus - 1] || \"\").trim().toUpperCase();\n    if (statusCandidato === \"PENDENTE\" || statusCandidato === \"ERRO\" || statusCandidato === \"PROCESSANDO\") {\n      linhaIdx = i;\n      break;\n    }\n\n    if (linhaIdxFallback === -1) linhaIdxFallback = i;\n  }\n\n  if (linhaIdx === -1) linhaIdx = linhaIdxFallback;`,
    "priorizar a linha acionável mais recente"
  );
}

if (!src.includes("lockEnvioAgora.tryLock(15000)")) {
  substituirUmaVez(
    /  var valoresLinha;\r?\n  var lockEnvioAgora = LockService\.getScriptLock\(\);\r?\n  if \(!lockEnvioAgora\.tryLock\(5000\)\) \{\r?\n    return \{ ok: false, mensagem: \"Fila ocupada\. Tente novamente em alguns segundos\.\" \};\r?\n  \}/,
    `  var valoresLinha;\n  var lockEnvioAgora = LockService.getScriptLock();\n  var lockObtido = false;\n\n  // O SISGEP possui vários módulos no mesmo projeto. Um lock global curto de\n  // 5 s fazia o botão \"Enviar agora\" desistir durante operações paralelas,\n  // sem sequer registrar uma tentativa. Aguarda um pouco mais, mantendo a\n  // proteção contra envio duplicado.\n  try {\n    lockObtido = lockEnvioAgora.tryLock(15000);\n  } catch (eLock) {\n    Logger.log(\"[ENVIO_AGORA] Falha ao obter lock para o ofício \" + numero + \": \" + (eLock.message || eLock));\n  }\n\n  if (!lockObtido) {\n    Logger.log(\"[ENVIO_AGORA] Fila permaneceu ocupada para o ofício \" + numero + \" após 15 s.\");\n    return { ok: false, mensagem: \"Fila ocupada. Aguarde alguns segundos e tente novamente.\" };\n  }`,
    "aumentar a tolerância ao lock do envio imediato"
  );
}

if (!src.includes("if (lockObtido) lockEnvioAgora.releaseLock();")) {
  substituirUmaVez(
    /  \} finally \{\r?\n    lockEnvioAgora\.releaseLock\(\);\r?\n  \}\r?\n\r?\n  try \{\r?\n\r?\n    var anexos = \[\];/,
    `  } finally {\n    if (lockObtido) lockEnvioAgora.releaseLock();\n  }\n\n  try {\n\n    var anexos = [];`,
    "liberar o lock somente quando ele foi obtido"
  );
}

if (!src.includes("[ENVIO_AGORA] Selecionado")) {
  substituirUmaVez(
    /  var status = String\(linha\[colStatus - 1\] \|\| \"\"\)\.trim\(\)\.toUpperCase\(\);/,
    `  var status = String(linha[colStatus - 1] || \"\").trim().toUpperCase();\n  Logger.log(\"[ENVIO_AGORA] Selecionado ofício \" + numero + \" na linha \" + linhaPlanilha + \" com status \" + status + \".\");`,
    "registrar qual linha foi selecionada"
  );
}

if (alterou) {
  fs.writeFileSync(arquivo, src, "utf8");
  console.log("Hotfix aplicado em " + arquivo + ".");
} else {
  console.log("Hotfix já estava aplicado; nenhuma alteração necessária.");
}
