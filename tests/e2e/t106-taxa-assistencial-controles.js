const fs = require("fs");
const path = require("path");
const b = require("./base");

const raiz = path.resolve(__dirname, "..", "..");
const scripts = fs.readFileSync(path.join(raiz, "OficiosScripts.html"), "utf8");

b.fluxo("DOCUMENTOS · Controles da Taxa Assistencial ligados ao backend");

[
  ["btnPreviewTaxa", "taxaPreview"],
  ["btnEnviarTesteTaxa", "taxaEnviarTeste"],
  ["btnPrepararFilaTaxa", "taxaPrepararFila"],
  ["btnIniciarEnvioTaxa", "taxaIniciarEnvio"],
  ["btnEnviarEscolaEspecifica", "taxaEnviarEscola"],
  ["btnAtualizarStatusFila", "taxaConsultarStatus"]
].forEach(([id, handler]) => {
  b.ok(scripts.includes(`blindarBotao("${id}", ${handler})`), `${id} está ligado a ${handler}`);
});

b.ok(scripts.includes(".enviarTesteTaxaAssistencial(payload, SISGEP_TOKEN_SESSAO)"), "teste envia payload e token da sessão");
b.ok(scripts.includes(".previewOficioTaxaAssistencial(payload, SISGEP_TOKEN_SESSAO)"), "prévia envia token da sessão");
b.ok(scripts.includes(".prepararFilaTaxaAssistencial(payload, SISGEP_TOKEN_SESSAO)"), "preparação da fila envia token da sessão");
b.ok(scripts.includes(".enviarOficioTaxaAssistencialPRO(payload, SISGEP_TOKEN_SESSAO)"), "envio PRO envia token da sessão");
b.ok(scripts.includes(".enviarTaxaEscolaEspecifica(payload, SISGEP_TOKEN_SESSAO)"), "envio específico envia token da sessão");
b.ok(scripts.includes(".buscarEscolaTaxa(termo, SISGEP_TOKEN_SESSAO)"), "busca de escola envia token da sessão");
b.ok(scripts.includes("window.confirm(\"Iniciar agora o envio da Taxa Assistencial"), "envio em massa exige confirmação explícita");
b.ok(scripts.includes("window.confirm(\"Enviar o ofício de Taxa Assistencial para"), "envio específico exige confirmação explícita");

b.resumo();
