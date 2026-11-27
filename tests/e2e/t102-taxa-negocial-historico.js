/**
 * TAXA NEGOCIAL · Histórico do trabalhador
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, resumo } = require("./base");
const RAIZ = path.resolve(__dirname, "..", "..");
function ler(nome) { return fs.readFileSync(path.join(RAIZ, nome), "utf8"); }

const historico = ler("TaxaNegocialHistorico.gs");
const api = ler("TaxaNegocialApi.gs");

fluxo("TAXA NEGOCIAL · histórico derivado da fonte oficial");

passo("fonte de verdade");
ok(historico.includes("tnLerRegistros_(TN_CONFIG.ABAS.OPOSICOES)"), "histórico é derivado de TN_OPOSICOES");
ok(!historico.includes("appendRow(") && !historico.includes("setValue("), "consulta não cria segunda base nem grava observação paralela");
ok(historico.includes("HISTORICO_OPOSICOES_CONSULTADO"), "consulta de histórico fica auditada");

passo("privacidade");
ok(historico.includes("cpfMascarado"), "retorno usa CPF mascarado");
ok(!historico.includes("LINK_PDF") || historico.includes("comprovanteGerado"), "histórico expõe estado do comprovante, não URL privada");

passo("integração");
ok(api.includes("historicoTrabalhador"), "gateway autenticado oferece histórico ao frontend");
ok(/function\s+taxaNegocialHistoricoTrabalhador_\s*\(/.test(historico), "implementação interna não cria novo endpoint público");

resumo();
