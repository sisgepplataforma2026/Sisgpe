/**
 * TAXA NEGOCIAL · Comprovante eletrônico privado
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, resumo } = require("./base");
const RAIZ = path.resolve(__dirname, "..", "..");
function ler(nome) { return fs.readFileSync(path.join(RAIZ, nome), "utf8"); }

const comprovante = ler("TaxaNegocialComprovante.gs");
const confirmacao = ler("TaxaNegocialConfirmacao.gs");
const api = ler("TaxaNegocialApi.gs");
const arquivoDrive = ler("ArquivoDrive.gs");

fluxo("TAXA NEGOCIAL · comprovante eletrônico privado e recuperável");

passo("arquivo privado e ambiente isolado");
ok(comprovante.includes("getRecursoId_('COMPROVANTES')"), "resolve a pasta pelo ambiente em vez de ID hardcoded");
ok(comprovante.includes("arquivoSalvarPrivado_("), "salva pela política central de arquivos privados");
ok(!comprovante.includes("setSharing("), "não define compartilhamento fora do ArquivoDrive");
ok(!comprovante.includes("ANYONE_WITH_LINK"), "não cria link público");
ok(arquivoDrive.includes('acesso:    "PRIVATE"'), "política central continua PRIVATE");

passo("integridade documental");
ok(comprovante.includes("TEXTO_MANIFESTACAO_SNAPSHOT"), "preserva o texto exato aceito pelo trabalhador");
ok(comprovante.includes("VERSAO_MANIFESTACAO_SNAPSHOT"), "preserva a versão da manifestação");
ok(comprovante.includes("CODIGO_AUTENTICIDADE"), "gera código de autenticidade do registro");
ok(comprovante.includes("getBlob().getBytes()") || comprovante.includes("blob.getBytes()"), "hash usa bytes reais do PDF");
ok(comprovante.includes("Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)"), "hash do PDF usa SHA-256");
ok(comprovante.includes("HASH_PDF: hashPdf"), "hash final é persistido na oposição");
ok(!/HASH_PDF[^\n]*tnComprovanteHtml_/.test(comprovante), "não tenta inserir o hash do próprio PDF dentro do PDF");

passo("idempotência e recuperação");
ok(comprovante.includes("if (o.LINK_PDF && o.HASH_PDF)"), "segunda geração devolve o comprovante já existente");
ok(comprovante.includes("o.LINK_PDF && !o.HASH_PDF"), "recupera arquivo salvo quando faltou persistir o hash");
ok(comprovante.includes("DriveApp.getFileById(idExistente)"), "recuperação usa o mesmo arquivo em vez de duplicar");

passo("falha de PDF não desfaz oposição");
ok(confirmacao.includes("A oposição já está definitivamente registrada neste ponto"), "ordem explícita: registra oposição antes de gerar PDF");
ok(confirmacao.includes("tnTentarGerarComprovante_("), "geração do PDF é consequência recuperável do registro");
ok(confirmacao.includes("comprovantePendente = true"), "falha documental vira pendência, não cancelamento");
ok(!comprovante.includes("STATUS_OPOSICAO: 'CANCELADA'") && !comprovante.includes("STATUS_OPOSICAO: \"CANCELADA\""), "gerador de PDF não cancela oposição");

passo("gateway e privacidade");
ok(api.includes("gerarComprovante") && api.includes("comprovante"), "gateway possui consulta e reprocessamento do comprovante");
ok(!comprovante.includes("linkPdf:") && !comprovante.includes("url: oposicao.LINK_PDF"), "DTO do frontend não devolve URL privada do Drive");
ok(comprovante.includes("COMPROVANTE_PDF_GERADO") && comprovante.includes("COMPROVANTE_PDF_FALHOU"), "sucesso e falha entram na auditoria central");

resumo();
