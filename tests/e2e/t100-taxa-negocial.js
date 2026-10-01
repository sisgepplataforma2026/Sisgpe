/**
 * TAXA NEGOCIAL · Segurança da fundação e da confirmação eletrônica
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, resumo } = require("./base");
const RAIZ = path.resolve(__dirname, "..", "..");
function ler(nome) { return fs.readFileSync(path.join(RAIZ, nome), "utf8"); }

const config = ler("TaxaNegocialConfig.gs");
const repo = ler("TaxaNegocialRepository.gs");
const service = ler("TaxaNegocialService.gs");
const confirmacao = ler("TaxaNegocialConfirmacao.gs");
const comprovante = ler("TaxaNegocialComprovante.gs");
const historico = ler("TaxaNegocialHistorico.gs");
const api = ler("TaxaNegocialApi.gs");
const smoke = ler("TaxaNegocialSmokeTest.gs");

fluxo("TAXA NEGOCIAL · fundação segura, gateway único e OTP no servidor");

passo("ambiente");
ok(config.includes("documentosExigirHomologacaoSegura_"), "usa o guard-rail central de homologação de Documentos");
ok(config.includes("PLANILHA_HML_ESPERADA_ID"), "mantém segunda conferência explícita da identidade da HML");
ok(!config.includes("PLANILHA_PRODUCAO") && !config.includes("PLANILHA_PRODUÇÃO"), "não contém atalho de escrita para produção");

passo("sessão e autorização");
ok(service.includes("exigirModulo_(token, 'documentos', false)"), "gateway parte da permissão do módulo Documentos");
ok(!/getSessaoUsuario\s*\(\s*\)/.test(service), "não existe fallback de sessão sem token");

passo("superfície pública");
ok(/function\s+taxaNegocialApi\s*\(/.test(api), "existe uma única fachada pública para o frontend");
const fontesTaxa = [api, service, confirmacao, comprovante, historico, smoke].join("\n");
const funcoesTaxa = [...fontesTaxa.matchAll(/^function\s+(taxaNegocial[A-Za-z0-9_]*|tnSmokeTestSomenteLeitura_?)\s*\(/gm)].map(m => m[1]);
const publicasTaxa = funcoesTaxa.filter(n => !n.endsWith("_"));
ok(publicasTaxa.length === 1 && publicasTaxa[0] === "taxaNegocialApi", "somente taxaNegocialApi fica exposta ao google.script.run", publicasTaxa.join(", "));
ok(api.includes("Object.prototype.hasOwnProperty.call(rotas, nome)"), "gateway usa allowlist explícita de ações");
ok(!api.includes("globalThis[") && !api.includes("this[nome]"), "gateway não faz invocação dinâmica por nome");

passo("concorrência e auditoria");
ok(service.includes("travarSisgep_(") && repo.includes("travarSisgep_("), "usa a trava reentrante oficial do SISGEP");
ok(repo.includes("return auditar_({"), "delega a trilha para AuditoriaCore, sem log paralelo");

passo("confirmação eletrônica");
ok(confirmacao.includes("otpHash:") && confirmacao.includes("salt:"), "o desafio guarda hash e salt do OTP");
ok(!/desafio\.(codigo|otp)\s*=/.test(confirmacao) && !/(codigo|otp)\s*:\s*codigo\b/.test(confirmacao), "o código OTP bruto não é persistido no desafio");
ok(!/desafio\s*=\s*\{[\s\S]*?email\s*:\s*pre\.email[\s\S]*?\};/.test(confirmacao), "o e-mail bruto não é persistido no desafio OTP");
ok(confirmacao.includes("enviarEmailSISGEP_("), "o envio usa a infraestrutura institucional de e-mail");
ok(!confirmacao.includes("GmailApp.sendEmail") && !confirmacao.includes("MailApp.sendEmail"), "não existe atalho de envio fora do EmailCore");
ok(confirmacao.includes("MAX_TENTATIVAS") && confirmacao.includes("VALIDADE_SEG"), "o OTP tem expiração e limite de tentativas");
ok(confirmacao.includes("OTP_LIMITE_SOLICITACOES") && confirmacao.includes("OTP_AGUARDE"), "solicitação de OTP tem rate limit e intervalo mínimo");

passo("servidor é a autoridade");
ok(!service.includes("payload.confirmacaoEletronica.confirmada"), "o backend não aceita boolean do navegador como prova de vontade");
ok(!service.includes("payload.confirmacaoEletronica.otpValidado"), "o backend não aceita boolean do navegador como prova de OTP");
ok(confirmacao.includes("validadaNoServidor: true") && service.includes("evidencia.validadaNoServidor !== true"), "somente confirmação validada no servidor alcança o registro definitivo");

resumo();
