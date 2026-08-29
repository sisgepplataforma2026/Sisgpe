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

fluxo("TAXA NEGOCIAL · fundação segura e OTP no servidor");

passo("ambiente");
ok(config.includes("documentosExigirHomologacaoSegura_"), "usa o guard-rail central de homologação de Documentos");
ok(config.includes("PLANILHA_HML_ESPERADA_ID"), "mantém segunda conferência explícita da identidade da HML");
ok(!config.includes("PLANILHA_PRODUCAO") && !config.includes("PLANILHA_PRODUÇÃO"), "não contém atalho de escrita para produção");

passo("sessão e autorização");
ok(service.includes("exigirModulo_(token, 'documentos', false)"), "entradas partem da permissão do módulo Documentos");
ok(!/getSessaoUsuario\s*\(\s*\)/.test(service), "não existe fallback de sessão sem token");

passo("concorrência e auditoria");
ok(service.includes("travarSisgep_(") && repo.includes("travarSisgep_("), "usa a trava reentrante oficial do SISGEP");
ok(repo.includes("return auditar_({"), "delega a trilha para AuditoriaCore, sem log paralelo");

passo("confirmação eletrônica");
ok(confirmacao.includes("otpHash:") && confirmacao.includes("salt:"), "o desafio guarda hash e salt do OTP");
ok(!/desafio\.(codigo|otp)\s*=/.test(confirmacao) && !/(codigo|otp)\s*:\s*codigo\b/.test(confirmacao), "o código OTP bruto não é persistido no desafio");
ok(confirmacao.includes("enviarEmailSISGEP_("), "o envio usa a infraestrutura institucional de e-mail");
ok(!confirmacao.includes("GmailApp.sendEmail") && !confirmacao.includes("MailApp.sendEmail"), "não existe atalho de envio fora do EmailCore");
ok(confirmacao.includes("MAX_TENTATIVAS") && confirmacao.includes("VALIDADE_SEG"), "o OTP tem expiração e limite de tentativas");

passo("servidor é a autoridade");
ok(service.includes("CONFIRMACAO_SERVIDOR_OBRIGATORIA"), "o contrato antigo de confirmação pelo navegador é recusado");
ok(!service.includes("payload.confirmacaoEletronica.confirmada"), "o backend não aceita boolean do navegador como prova de vontade");
ok(!service.includes("payload.confirmacaoEletronica.otpValidado"), "o backend não aceita boolean do navegador como prova de OTP");
ok(confirmacao.includes("validadaNoServidor: true") && service.includes("evidencia.validadaNoServidor !== true"), "somente confirmação validada no servidor alcança o registro definitivo");

resumo();
