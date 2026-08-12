/**
 * TESTE — ensureHeaders_ NÃO PODE RENOMEAR COLUNA DE ABA COM DADO
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * Em 12/08/2026 eu mandei o usuário rodar `inicializarModuloCertBolsa()` e
 * disse, com estas palavras, que era idempotente e que podia rodar sem medo.
 * Não era. `ensureHeaders_` fazia isto:
 *
 *     if (existingHeaders.indexOf(header) === -1) {
 *       sheet.getRange(1, idx + 1).setValue(header);   // posição CANÔNICA
 *     }
 *
 * Achou um nome faltando e escreveu ele na posição que ele ocupa NA LISTA,
 * por cima do nome que já estava naquela coluna. O dado embaixo não se move.
 * Três colunas perderam o nome e passaram a ser lidas com rótulo alheio.
 *
 * O sintoma no certificado real: a data de nascimento do beneficiário saiu
 * impressa como "Instituição de ensino", e a idade — 11 — como "CNPJ".
 *
 * E PIORAVA A CADA RODADA, porque os nomes atropelados sumiam e viravam os
 * "faltando" da vez seguinte. Como setupVoucherModuleFase1() é chamada de
 * nove lugares, vários em caminho de LEITURA, bastava abrir a prévia para
 * rodar mais uma volta.
 *
 * O passo 3 é o que importa: ele roda a versão ANTIGA e exige que ela
 * destrua. Sem isso o teste não prova nada — provaria só que a versão nova
 * passa, o que é verdade para qualquer função que não faça nada.
 */
const b = require("./base");
const { g } = b.subir({});

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* O layout ANTERIOR: o canônico de hoje menos as três colunas novas. */
const CANONICO = g.VOUCHER_COLUNAS_SOLICITACOES_();
const NOVAS = ["INSTITUICAO_ENSINO", "CNPJ_INSTITUICAO", "EMAIL_INSTITUICAO"];
const ANTIGO = CANONICO.filter(h => NOVAS.indexOf(h) === -1);

function abaComDado(nome) {
  const velha = ss.getSheetByName(nome);
  if (velha) ss.deleteSheet(velha);
  const sh = ss.insertSheet(nome);
  sh.getRange(1, 1, 1, ANTIGO.length).setValues([ANTIGO]);
  // Cada célula carrega o nome da coluna a que pertence. Assim, se o rótulo
  // escorregar, o próprio dado denuncia de onde ele veio.
  sh.getRange(2, 1, 1, ANTIGO.length).setValues([ANTIGO.map(h => "valor-" + h)]);
  return sh;
}

function cabecalho(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || "").trim());
}
function linha(sh) {
  return sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || "").trim());
}
/** Toda coluna com nome tem que carregar o dado daquela mesma coluna. */
function desalinhadas(sh) {
  const cab = cabecalho(sh), dado = linha(sh);
  const fora = [];
  cab.forEach((nome, i) => {
    if (!nome || !dado[i]) return;
    if (dado[i] !== "valor-" + nome) fora.push(nome + " carrega " + dado[i]);
  });
  return fora;
}

b.fluxo("VOUCHER · ensureHeaders_ não pode mexer em coluna que já existe");

b.passo("1. Aba nova recebe a lista canônica inteira, na ordem");
const nova = ss.insertSheet("Teste_Aba_Nova");
g.ensureHeaders_(nova, CANONICO);
b.igual(cabecalho(nova), CANONICO, "aba vazia é criada com a ordem canônica");

b.passo("2. Aba com dado: as 3 colunas novas entram, e NADA se desalinha");
const sh = abaComDado("Voucher_Solicitacoes");
g.ensureHeaders_(sh, CANONICO);

const fora = desalinhadas(sh);
b.ok(fora.length === 0, "nenhuma coluna existente trocou de nome",
  fora.length ? fora.slice(0, 3).join(" · ") : "");

const cab2 = cabecalho(sh);
b.ok(ANTIGO.every(h => cab2.indexOf(h) > -1),
  "todos os nomes antigos continuam na aba",
  ANTIGO.filter(h => cab2.indexOf(h) === -1).join(", "));
b.ok(NOVAS.every(h => cab2.indexOf(h) > -1),
  "as 3 colunas novas foram acrescentadas",
  NOVAS.filter(h => cab2.indexOf(h) === -1).join(", "));

b.passo("3. E entram NO FIM — nunca no meio, empurrando dado alheio");
b.igual(cab2.slice(0, ANTIGO.length), ANTIGO, "as colunas antigas ficam onde estavam");
b.igual(cab2.slice(ANTIGO.length).filter(Boolean).sort(), NOVAS.slice().sort(),
  "as novas ficam depois da última coluna que já existia");

b.passo("4. Rodar de novo não muda mais nada — ISSO é ser idempotente");
const antesDaRepeticao = cabecalho(sh).join("|");
for (let i = 0; i < 4; i++) g.ensureHeaders_(sh, CANONICO);
b.igual(cabecalho(sh).join("|"), antesDaRepeticao, "4 execuções seguidas: cabeçalho intacto");
b.igual(desalinhadas(sh), [], "e nenhum dado mudou de rótulo");

b.passo("5. Coluna extra que a lista canônica não conhece sobrevive");
/* Planilha de sindicato ganha coluna manual — alguém abre e digita. Um
 * "ensure" que apaga o que não está na lista dele destrói trabalho humano. */
const sh5 = abaComDado("Teste_Coluna_Manual");
sh5.getRange(1, ANTIGO.length + 1).setValue("ANOTACAO_DA_SECRETARIA");
sh5.getRange(2, ANTIGO.length + 1).setValue("combinado por telefone");
g.ensureHeaders_(sh5, CANONICO);
const cab5 = cabecalho(sh5);
b.ok(cab5.indexOf("ANOTACAO_DA_SECRETARIA") > -1, "coluna manual não é apagada");
b.igual(sh5.getRange(2, cab5.indexOf("ANOTACAO_DA_SECRETARIA") + 1).getValue(),
  "combinado por telefone", "e o conteúdo dela continua embaixo do nome dela");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · A versão antiga destruía — prova de que o teste morde");

b.passo("6. Reproduz o ensureHeaders_ de antes e exige que ele estrague");
/* Se este passo PASSAR sem detectar destruição, o teste acima não está
 * medindo nada: qualquer implementação passaria. */
function ensureHeadersAntigo(sheet, headers) {
  const currentLastCol = Math.max(sheet.getLastColumn(), headers.length, 1);
  const existing = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0];
  const hasContent = existing.some(v => String(v).trim() !== "");
  if (!hasContent) { sheet.getRange(1, 1, 1, headers.length).setValues([headers]); return; }
  const existingHeaders = existing.map(v => String(v).trim());
  headers.forEach(function (header, idx) {
    if (existingHeaders.indexOf(header) === -1) sheet.getRange(1, idx + 1).setValue(header);
  });
}

const velha = abaComDado("Teste_Versao_Antiga");
ensureHeadersAntigo(velha, CANONICO);
const estrago = desalinhadas(velha);
b.ok(estrago.length > 0,
  "a versão antiga DESALINHA colunas — é o defeito que originou este teste",
  estrago.length ? estrago.slice(0, 3).join(" · ") : "não desalinhou nada (teste sem valor)");

const cabVelha = cabecalho(velha);
const perdidos = ANTIGO.filter(h => cabVelha.indexOf(h) === -1);
b.ok(perdidos.length > 0, "e faz nomes de coluna SUMIREM da aba",
  perdidos.join(", "));

b.passo("7. E piorava a cada execução — o dano era progressivo");
const perdaPorRodada = [];
for (let r = 0; r < 3; r++) {
  ensureHeadersAntigo(velha, CANONICO);
  const c = cabecalho(velha);
  perdaPorRodada.push(ANTIGO.filter(h => c.indexOf(h) === -1).length);
}
b.ok(desalinhadas(velha).length > estrago.length,
  "rodar de novo espalha o desalinhamento em vez de estabilizar",
  "colunas fora do lugar: " + estrago.length + " → " + desalinhadas(velha).length);

b.passo("8. A versão nova, no mesmo cenário, não perde nada");
const boa = abaComDado("Teste_Versao_Nova");
for (let r = 0; r < 4; r++) g.ensureHeaders_(boa, CANONICO);
const cabBoa = cabecalho(boa);
b.igual(ANTIGO.filter(h => cabBoa.indexOf(h) === -1), [], "nenhum nome perdido em 4 rodadas");
b.igual(desalinhadas(boa), [], "nenhuma coluna fora do lugar em 4 rodadas");

b.resumo();
process.exit(0);
