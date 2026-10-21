/**
 * TAXA NEGOCIAL · Interface modular no Módulo de Ofícios
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, resumo } = require("./base");
const RAIZ = path.resolve(__dirname, "..", "..");
function ler(nome) { return fs.readFileSync(path.join(RAIZ, nome), "utf8"); }

const loader = ler("Taxaprogressoenvio.html");
const ui = ler("TaxaNegocialUI.html");
const scripts = ler("TaxaNegocialScripts.html");
const styles = ler("TaxaNegocialStyles.html");
const progresso = ler("TaxaProgressoEnvioCore.html");

fluxo("TAXA NEGOCIAL · interface modular");

passo("arquitetura isolada");
ok(loader.includes("include('TaxaProgressoEnvioCore')"), "progresso da Taxa Assistencial foi preservado em parcial próprio");
ok(loader.includes("include('TaxaNegocialStyles')"), "loader inclui estilos próprios da Taxa Negocial");
ok(loader.includes("include('TaxaNegocialUI')"), "loader inclui markup próprio da Taxa Negocial");
ok(loader.includes("include('TaxaNegocialScripts')"), "loader inclui scripts próprios da Taxa Negocial");
ok(progresso.includes("obterStatusFilaTaxaAssistencial"), "funcionalidade anterior de progresso continua preservada");

passo("fluxo da tela");
ok(ui.includes('id="blocoTaxaNegocial"'), "submódulo possui bloco próprio");
ok(ui.includes("Registrar Oposição"), "tela oferece registro de oposição");
ok(ui.includes("Histórico do Trabalhador"), "tela oferece histórico do trabalhador");
ok(ui.includes('id="tnOtpCodigo"'), "etapa de OTP existe na interface");
ok(ui.includes('id="tnProtocolo"'), "conclusão exibe protocolo");
ok(styles.includes("#blocoTaxaNegocial"), "estilos ficam fora do OficiosScripts.html");

passo("integração segura");
ok(scripts.includes(".taxaNegocialApi(token(),acao,payload||{})"), "frontend usa o gateway autenticado único");
ok(!/\.taxaNegocial(?:Solicitar|Confirmar|Registrar|Cancelar|Gerar|Obter)[A-Za-z0-9_]*\s*\(/.test(scripts), "frontend não chama funções internas da Taxa Negocial diretamente");
ok(scripts.includes("listarEscolas(token())"), "seleção de empregador reutiliza o cadastro central de escolas");
ok(scripts.includes("abaTaxaNegocialFluxo"), "aba da Taxa Negocial é injetada modularmente no Módulo de Ofícios");
ok(scripts.includes("docSubOficios"), "bloco é anexado ao container existente de Ofícios");
ok(scripts.includes("documentoConferido"), "fluxo envia evidência da conferência presencial do documento");
ok(scripts.includes("confirmarOtp"), "registro definitivo passa pela confirmação OTP do servidor");

passo("não regressão estrutural");
ok(!scripts.includes("ANYONE_WITH_LINK"), "interface não cria compartilhamento público de comprovante");
ok(!ui.includes("secretaria@sindeducacao.com"), "e-mail de teste não foi hardcoded na interface");
ok(!scripts.includes("52998224725"), "CPF de teste não foi hardcoded na interface");

resumo();
