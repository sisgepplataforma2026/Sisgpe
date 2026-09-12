/**
 * REVOGAR ACESSO PÚBLICO: CONFERE ANTES, PASSA PELA POLÍTICA, E DEIXA RASTRO
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026, 22:16. O contador rodou em PRODUÇÃO e deu o número que faltava:
 * 28 arquivos públicos em 497 — voucher de bolsa com nome de associado,
 * comprovante de despesa, boleto. Acessíveis por qualquer pessoa com a URL.
 *
 * 28 cabe numa execução só, então o revogador nasceu simples. O que ele NÃO
 * pode ser é descuidado: revogar é irreversível na prática — o Drive não
 * guarda histórico de permissão, e reabrir depois é arquivo por arquivo.
 *
 * AS TRÊS PROPRIEDADES QUE ESTE TESTE GUARDA
 *
 * 1. CONFERE ANTES. O padrão é 'conferir'; só altera com modo:'executar'
 *    explícito. Um revogador que já sai revogando transforma "deixa eu ver o
 *    que tem" em mudança irreversível.
 *
 * 2. PASSA PELA POLÍTICA. Não chama setSharing — chama
 *    arquivoAplicarPolitica_. É o mesmo motivo do t71: a decisão de
 *    compartilhamento mora num lugar só. Se este arquivo chamasse setSharing
 *    direto, o t71 já reprovaria; esta asserção existe para o caso de alguém
 *    "resolver" isso movendo a política para cá.
 *
 * 3. DEIXA RASTRO. Grava o que alterou, com o acesso ANTERIOR. Revogação em
 *    massa sem registro é mudança que ninguém consegue reconstruir depois.
 *
 * E UMA QUARTA, que só apareceu escrevendo: ele CONFERE depois de alterar, em
 * vez de confiar que deu certo. Sem isso, um setSharing que falha em silêncio
 * vira "✅ fechado" no relatório — o pior resultado possível num relatório de
 * exposição.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. inverter o padrão para já executar ....................... 1 falha
 *   2. trocar arquivoAplicarPolitica_ por setSharing direto ..... 2 falhas
 *      (esta e a do t71 — a política é guardada em dois lugares)
 *   3. tirar a reconferência pós-alteração ...................... 1 falha
 *   4. deixar de gravar o acesso anterior no registro ........... 1 falha
 *   5. mexer em arquivo DOMAIN, não só nos públicos ............. 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ARQ = "AuditoriaDriveRevogar.gs";
const src = fs.readFileSync(path.join(RAIZ, ARQ), "utf8");

/* Comentário é intenção; o teste olha o que EXECUTA. */
const codigo = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

fluxo("REVOGAR · Confere antes, e deixa rastro");

/* ─── 1. o padrão não altera nada ─── */
passo("conferir é o padrão");

ok(/String\(opcoes\.modo\s*\|\|\s*'conferir'\)/.test(codigo),
   "o modo padrão é 'conferir'",
   "um revogador que já sai revogando transforma 'deixa eu ver' em dano");

ok(/executar\s*=\s*String\(opcoes\.modo[^)]*\)\s*===\s*'executar'/.test(codigo),
   "e só executa com modo:'executar' explícito");

ok(/if\s*\(executar\)/.test(codigo),
   "a alteração está dentro de um if (executar)");

/* ─── 2. passa pela política central ─── */
passo("a política mora num lugar só");

ok(/arquivoAplicarPolitica_\s*\(/.test(codigo),
   "chama arquivoAplicarPolitica_ para fechar o arquivo");

const setSharing = (codigo.match(/\.setSharing\s*\(/g) || []).length;
igual(setSharing, 0,
      "e NÃO chama setSharing por conta própria",
      "mesma regra do t71 — a política é do ArquivoDrive.gs");

/* ─── 3. confere depois de alterar ─── */
passo("não confia que deu certo");

ok(/getSharingAccess\s*\(\s*\)[\s\S]{0,200}?FALHOU/.test(codigo) ||
   /var\s+depois\s*=\s*String\(\s*arq\.getSharingAccess/.test(codigo),
   "relê a permissão DEPOIS de alterar",
   "setSharing que falha em silêncio viraria '✅ fechado' no relatório");

ok(/FALHOU/.test(codigo),
   "e reporta FALHOU quando o arquivo continua aberto");

/* ─── 4. deixa rastro ─── */
passo("o registro do que mudou");

ok(/AUDITORIA_REVOGAR_ABA/.test(codigo),
   "grava numa aba de auditoria");

ok(/ACESSO_ANTERIOR/.test(codigo),
   "e o cabeçalho guarda o ACESSO ANTERIOR",
   "sem o valor anterior não dá para reconstruir o que foi mudado");

ok(/'QUANDO',\s*'PASTA',\s*'ARQUIVO',\s*'FILE_ID'/.test(codigo),
   "junto de quando, qual pasta, qual arquivo e o id");

ok(/if\s*\(executar\s*&&\s*achados\.length\)\s*auditoriaRevogar_registrar_/.test(codigo),
   "e só grava quando de fato executou",
   "conferir não pode sujar a aba de auditoria");

/* ─── 5. mexe só no que está aberto ─── */
passo("o que ele NÃO toca");

ok(/acesso\s*!==\s*'ANYONE'\s*&&\s*acesso\s*!==\s*'ANYONE_WITH_LINK'/.test(codigo),
   "só age em ANYONE e ANYONE_WITH_LINK",
   "DOMAIN foi configurado por alguém — mudar sem pedir seria decidir por essa pessoa");

/* ─── 6. o contador continua sem escrever ─── */
passo("a promessa do contador segue de pé");

const contador = fs.readFileSync(path.join(RAIZ, "AuditoriaDrive.gs"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

igual((contador.match(/arquivoAplicarPolitica_\s*\(|\.setSharing\s*\(/g) || []).length, 0,
      "AuditoriaDrive.gs não ganhou nenhuma escrita",
      "foi por isso que a revogação veio em arquivo separado");

/* ─── 7. é diagnóstico, não endpoint ─── */
passo("fora do alcance da web");

const expostas = (codigo.match(/^function\s+([A-Za-z0-9_]+)/gm) || [])
  .map(m => m.replace(/^function\s+/, ""))
  .filter(n => !/_$/.test(n));
igual(expostas, [],
      "nenhuma função é exposta ao google.script.run",
      "revogar acesso em massa não é endpoint de web");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que os 28 arquivos ficaram privados de fato",
      "isto varre CÓDIGO. Só se prova rodando em PRODUÇÃO e conferindo " +
      "a aba _AUDITORIA_DRIVE_REVOGACAO");

aviso("que não existe arquivo público fora das pastas auditadas",
      "a varredura alcança só o que está em RECURSOS_AMBIENTE e PASTAS");

resumo();
