const fs = require("fs");
const path = require("path");
const assert = require("assert");

const raiz = path.resolve(__dirname, "..", "..");
const taxa = fs.readFileSync(path.join(raiz, "TaxaAssistencial.gs"), "utf8");
const fila = fs.readFileSync(path.join(raiz, "FilaOficios.gs"), "utf8");
const email = fs.readFileSync(path.join(raiz, "EmailOficios.gs"), "utf8");
const tela = fs.readFileSync(path.join(raiz, "OficiosFormulario.html"), "utf8");
const progresso = fs.readFileSync(path.join(raiz, "TaxaProgressoEnvioCore.html"), "utf8");
const utils = fs.readFileSync(path.join(raiz, "Utils.gs"), "utf8");
const busca = fs.readFileSync(path.join(raiz, "BuscaEscola.gs"), "utf8");
const scripts = fs.readFileSync(path.join(raiz, "OficiosScripts.html"), "utf8");
const b = require("./base");

assert(!taxa.includes("financeiro@sindeducacao.com"), "Taxa Assistencial ainda referencia o financeiro");
assert(!fila.includes("financeiro@sindeducacao.com"), "Fila de Ofícios ainda referencia o financeiro");
assert(!email.includes("financeiro@sindeducacao.com"), "Política central ainda referencia o financeiro");
assert(taxa.includes('exigirModulo_(tokenSessao, "documentos", !!exigirAdministrador)'), "Taxa Assistencial não exige o módulo Documentos");
assert(taxa.includes("function enviarOficioTaxaAssistencialPRO_(params)"), "núcleo interno do gatilho não foi separado do gateway web");
assert(taxa.includes("enviarEmailOficio_("), "Taxa Assistencial não usa o gateway central de e-mail");
assert(!taxa.includes("GmailApp.sendEmail("), "Taxa Assistencial ainda envia diretamente pelo Gmail");
assert(!fila.includes("GmailApp.sendEmail("), "Fila ainda duplica o envio direto pelo Gmail");
assert(!fila.includes("bloqueado: ambiente de homologação"), "fila automática continua desativada em HML");
assert(tela.includes(".obterStatusFilaTaxaAssistencial(\n        typeof SISGEP_TOKEN_SESSAO"), "status da Taxa Assistencial não recebe token na tela de Ofícios");
assert(progresso.includes(".obterStatusFilaTaxaAssistencial(\n        typeof SISGEP_TOKEN_SESSAO"), "status da Taxa Assistencial não recebe token no componente de progresso");
assert(utils.includes("function obterArquivoDriveBase64(fileId, tokenSessao)"), "leitura do Drive ainda não recebe token");
assert(utils.includes('exigirModulo_(tokenSessao, "documentos", false)'), "acessos utilitários não exigem Documentos");
assert(utils.includes("arquivoPertencePastasDocumentos_"), "arquivo não é confinado às pastas do módulo");
assert(!utils.includes('getRecursoId_("RECIBOS", { semTrava: true })'), "busca ainda pode cair silenciosamente na pasta de produção");
assert(busca.includes("function buscarEscolasOficioSmart(termo, tokenSessao)"), "busca inteligente ainda não recebe token");
assert(scripts.includes(".obterArquivoDriveBase64(f.driveId, SISGEP_TOKEN_SESSAO)"), "frontend não envia token ao ler arquivo");
assert(scripts.includes(".buscarFichasDrive(termo, SISGEP_TOKEN_SESSAO)"), "frontend não envia token ao buscar fichas");
assert(scripts.includes(".buscarEscolasOficioSmart(termo, SISGEP_TOKEN_SESSAO)"), "frontend não envia token ao buscar escola");

const semAlias = b.subir({ gmailAliases: [] });
semAlias.g.__donoDoProjetoEmail = "financeirosindecucacao@gmail.com";
const opcoesSemAlias = semAlias.g.enviarEmailOficio_(
  "wanderson@sindeducacao.com", "<p>Teste</p>", [], "Teste controlado",
  "secretaria@sindeducacao.com", "Teste"
);
assert.strictEqual(opcoesSemAlias.to, "secretaria@sindeducacao.com", "destino deve continuar exclusivamente na Secretaria");
assert.strictEqual(opcoesSemAlias.replyTo, "secretaria@sindeducacao.com", "reply-to deve continuar na Secretaria");
assert(!Object.prototype.hasOwnProperty.call(opcoesSemAlias, "from"), "sem alias, o gateway deve omitir from e usar a conta executora");
const emailSemAlias = semAlias.amb.outbox[semAlias.amb.outbox.length - 1];
assert(emailSemAlias && emailSemAlias.to === "secretaria@sindeducacao.com", "envio sem alias deve chegar à Secretaria");
assert(!emailSemAlias.bcc && !emailSemAlias.cc, "envio de ofício não deve criar cópia automática");

const comAlias = b.subir({ gmailAliases: ["secretaria@sindeducacao.com"] });
const opcoesComAlias = comAlias.g.montarOpcoesEmailSISGEP_("", "<p>Teste</p>", [], "Teste", "secretaria@sindeducacao.com");
assert.strictEqual(opcoesComAlias.from, "secretaria@sindeducacao.com", "quando autorizado, o alias institucional deve ser usado como remetente");

console.log("OK: segurança e política única de e-mail de Documentos validadas.");
