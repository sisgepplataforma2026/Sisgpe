/**
 * A DECISÃO DE COMPARTILHAR ARQUIVO MORA NUM LUGAR SÓ
 *
 * O QUE ORIGINOU
 *
 * 20/08/2026. Uma varredura nos 136 `.gs` achou 23 chamadas de
 *
 *     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
 *
 * em 14 arquivos. Cada uma tornava um PDF — com CPF, valor, nome de
 * associado, holerite, documento jurídico — acessível a qualquer pessoa com a
 * URL: sem login, sem expiração, para sempre.
 *
 * Não era descuido de uma pessoa. Era a MESMA LINHA copiada de arquivo em
 * arquivo: um módulo novo nascia copiando o anterior e herdava a exposição.
 *
 * POR QUE ESTE TESTE OLHA `setSharing` E NÃO `ANYONE_WITH_LINK`
 *
 * Proibir só o valor perigoso resolveria a ocorrência e não a causa. Ficariam
 * 17 cópias da regra espalhadas, e a 18ª nasceria junto do próximo módulo —
 * talvez com outro valor errado que ninguém previu.
 *
 * O que este teste exige é mais forte: NENHUM `.gs` além de ArquivoDrive.gs
 * pode chamar `setSharing`. Quem precisa gravar arquivo chama o helper e
 * herda a política; quem tentar decidir por conta própria, o CI barra.
 *
 * MUTAÇÕES MATADAS (20/08/2026)
 *
 *   1. reintroduzir ANYONE_WITH_LINK em Recibo.gs ............... 2 falhas
 *   2. setSharing cru, mesmo com valor CORRETO (PRIVATE) ........ 1 falha
 *      — é o ponto do teste: a forma certa escrita no lugar errado
 *        também reprova, senão a política volta a se espalhar
 *   3. trocar a política de PRIVATE para ANYONE_WITH_LINK ....... 2 falhas
 *   4. apagar a chamada do helper em Comprovantes.gs ............ 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const DONO = "ArquivoDrive.gs";

const gs = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs")).sort();

/** Tira comentários de linha e de bloco, para não acusar texto explicativo. */
function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

fluxo("DRIVE · A política de compartilhamento mora num lugar só");

/* ─── 1. o dono existe e declara a política ─── */
passo("o arquivo dono");

ok(gs.indexOf(DONO) !== -1, DONO + " existe no projeto",
   gs.length + " arquivos .gs varridos");

const fonteDono = fs.readFileSync(path.join(RAIZ, DONO), "utf8");

ok(/function\s+arquivoAplicarPolitica_/.test(fonteDono),
   "e expõe arquivoAplicarPolitica_, que é o que os módulos chamam");

ok(/ARQUIVO_POLITICA\s*=\s*\{[\s\S]*?acesso:\s*"PRIVATE"/.test(fonteDono),
   "a política declarada é PRIVATE",
   "é o único lugar do sistema que decide isso");

ok(/permissao:\s*"NONE"/.test(fonteDono),
   "com permissão NONE");

/* ─── 2. ninguém mais chama setSharing ─── */
passo("nenhum outro .gs decide sozinho");

const infratores = [];
gs.forEach(function (f) {
  if (f === DONO) return;
  const src = semComentarios(fs.readFileSync(path.join(RAIZ, f), "utf8"));
  const re = /\.setSharing\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const linha = src.slice(0, m.index).split("\n").length;
    infratores.push(f + ":" + linha);
  }
});

igual(infratores, [],
      "nenhum .gs além de " + DONO + " chama setSharing");

/* ─── 3. e o valor perigoso não voltou ─── */
passo("o valor perigoso");

const publicos = [];
gs.forEach(function (f) {
  const src = semComentarios(fs.readFileSync(path.join(RAIZ, f), "utf8"));
  if (/DriveApp\.Access\.ANYONE/.test(src)) publicos.push(f);
});

igual(publicos, [],
      "nenhum .gs menciona DriveApp.Access.ANYONE em código",
      "23 ocorrências em 14 arquivos, em 20/08/2026");

/* Drive API pela via REST também abre arquivo — o padrão { type: "anyone" }.
   Fechar só o DriveApp deixaria essa porta aberta. */
const restAnyone = [];
gs.forEach(function (f) {
  const src = semComentarios(fs.readFileSync(path.join(RAIZ, f), "utf8"));
  if (/["']type["']\s*:\s*["']anyone["']|type\s*:\s*["']anyone["']/i.test(src)) {
    restAnyone.push(f);
  }
});
igual(restAnyone, [],
      "nem a via REST da Drive API, com type: \"anyone\"");

/* ─── 4. quem gravava público agora chama o helper ─── */
passo("os módulos que foram migrados");

const MIGRADOS = [
  "Comprovantes.gs", "Despesas.gs", "Despesas_Oficio_Fiscal.gs",
  "IA_DocumentosSindicalizacao.gs", "Juridico.gs", "PagamentosControle.gs",
  "Portalassociado.gs", "RHDocumentos.gs", "Recibo.gs", "ReciboDiversos.gs",
  "RelatoriosOficios.gs", "Sindicalizacaoadmin.gs", "Voucher.gs",
  "VoucherPdf.gs"
];

const semHelper = MIGRADOS.filter(function (f) {
  if (gs.indexOf(f) === -1) return false;
  return !/arquivoAplicarPolitica_\s*\(/.test(fs.readFileSync(path.join(RAIZ, f), "utf8"));
});

igual(semHelper, [],
      "os 14 arquivos que gravavam público agora chamam o helper",
      "sem esta asserção, apagar a chamada não derrubaria nada");

/* ─── 5. Ofícios não foi tocado ─── */
passo("a única operação viva");

const OFICIOS = ["Oficios.gs", "FilaOficios.gs", "EmailOficios.gs"];
const oficiosTocados = OFICIOS.filter(function (f) {
  if (gs.indexOf(f) === -1) return false;
  const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
  return /setSharing|arquivoAplicarPolitica_/.test(src);
});

igual(oficiosTocados, [],
      "Ofícios não compartilhava arquivo e continua sem compartilhar",
      "é o único módulo em operação — não entrou nesta mudança");

/* ─── o que este teste não alcança ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que os arquivos JÁ gravados no Drive deixaram de ser públicos",
      "isto varre CÓDIGO. Todo PDF gravado antes de 20/08/2026 continua " +
      "como foi gravado — a varredura do acervo é item à parte");

aviso("que setSharing de fato aplica a permissão no Drive real",
      "o DriveApp do emulador é apenas registrado; prova só no ambiente no ar");

resumo();
