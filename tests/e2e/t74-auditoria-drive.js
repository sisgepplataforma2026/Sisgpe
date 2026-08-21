/**
 * O CONTADOR DE ARQUIVOS PÚBLICOS NÃO PODE ALTERAR NADA
 *
 * O QUE ORIGINOU
 *
 * 20/08/2026. O ArquivoDrive.gs fechou o compartilhamento no código, mas todo
 * PDF gravado ANTES continua público no Drive — recibos, comprovantes,
 * holerites, com CPF e valor. É o item 28, e é exposição que existe agora.
 *
 * O passo 1 acordado com o usuário foi MEDIR: contar quantos são, sem alterar
 * nada. Revogar em massa é irreversível na prática (o Drive não guarda
 * histórico de permissão) e a decisão de COMO revogar — tudo de uma vez, por
 * pasta, por tipo — muda conforme o número ser 40 ou 12.000.
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * "Não altera nada" escrito no cabeçalho é uma promessa. A tentação de
 * acrescentar `setSharing(PRIVATE)` "já que estamos passando por cada arquivo
 * mesmo" é enorme, e quem fizer isso vai achar que está ajudando — vai revogar
 * milhares de acessos numa execução que o usuário autorizou como CONTAGEM.
 *
 * Este teste transforma a promessa em trava.
 *
 * MUTAÇÕES MATADAS (20/08/2026)
 *
 *   1. acrescentar setSharing no laço do contador ............... 1 falha
 *   2. acrescentar setTrashed .................................. 1 falha
 *   3. tirar o orçamento de tempo (laço morre e devolve parcial
 *      sem avisar) ............................................. 1 falha
 *   4. não devolver a pasta à fila ao estourar o tempo .......... 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ARQ = "AuditoriaDrive.gs";
const src = fs.readFileSync(path.join(RAIZ, ARQ), "utf8");

/* Comentário é intenção; o teste olha o que EXECUTA. Lição das mutações 3 e 6
   do t73, onde asserções passaram provando o comentário e não o código. */
const codigo = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

fluxo("AUDITORIA DO DRIVE · Conta, e só conta");

/* ─── 1. existe e é diagnóstico ─── */
passo("o arquivo");

ok(/function\s+auditoriaDrive_contar_/.test(codigo), "auditoriaDrive_contar_ existe");
ok(/function\s+auditoriaDrive_status_/.test(codigo), "auditoriaDrive_status_ existe");
ok(/function\s+auditoriaDrive_reiniciar_/.test(codigo), "auditoriaDrive_reiniciar_ existe");

/* Underscore no fim = o editor roda, o google.script.run não alcança.
   Contar o acervo é operação de quem administra, não endpoint da web. */
const expostas = (codigo.match(/^function\s+([A-Za-z0-9_]+)/gm) || [])
  .map(m => m.replace(/^function\s+/, ""))
  .filter(n => !/_$/.test(n));
igual(expostas, [],
      "nenhuma função é exposta ao google.script.run",
      "todas terminam com _ — o editor roda, a web não");

/* ─── 2. A TRAVA: nada de escrita ─── */
passo("o que este arquivo NÃO pode fazer");

const ESCRITA = [
  "setSharing", "setTrashed", "removeFile", "addFile", "setOwner",
  "addEditor", "addViewer", "removeEditor", "removeViewer",
  "createFile", "createFolder", "setContent", "setName", "moveTo",
  "setValue", "setValues", "deleteRow", "appendRow"
];

const achados = ESCRITA.filter(m => new RegExp("\\." + m + "\\s*\\(").test(codigo));
igual(achados, [],
      "nenhuma chamada de escrita no Drive ou na planilha",
      "o usuário autorizou CONTAR; revogar é decisão separada, com o número na mão");

/* Contraprova: a leitura que ele PRECISA fazer está lá. Sem isto, um arquivo
   vazio também passaria na asserção acima. */
ok(/\.getSharingAccess\s*\(/.test(codigo),
   "e a leitura de permissão está presente",
   "getSharingAccess é o que responde a pergunta");

/* A única escrita legítima é a Script Property do progresso — e ela é do
   contador, não do acervo. */
ok(/setProperty\s*\(\s*AUDITORIA_DRIVE_PROP/.test(codigo),
   "a única gravação é o progresso, numa Script Property");

/* ─── 3. retomável de verdade ─── */
passo("o limite de 6 minutos do Apps Script");

ok(/AUDITORIA_DRIVE_SEGUNDOS\s*=\s*\d+/.test(codigo),
   "há orçamento de tempo declarado");

const orcamento = Number((codigo.match(/AUDITORIA_DRIVE_SEGUNDOS\s*=\s*(\d+)/) || [])[1] || 0);
ok(orcamento > 0 && orcamento <= 300,
   "e cabe folgado nos 6 minutos (" + orcamento + "s)",
   "sem folga, a execução morre no meio e devolve nada");

ok(/Date\.now\(\)\s*-\s*inicio\s*>\s*AUDITORIA_DRIVE_SEGUNDOS/.test(codigo),
   "o laço confere o tempo a cada arquivo");

/* O ponto mais fácil de errar: ao estourar o tempo no meio de uma pasta, ela
   TEM de voltar para a fila. Sem isso, os arquivos restantes dela nunca são
   contados — e o relatório final diz um número MENOR que o real, que é o pior
   erro possível num relatório de exposição. */
ok(/estado\.feitas\[atual\.id\]\s*=\s*false/.test(codigo) &&
   /estado\.fila\.unshift\(atual\)/.test(codigo),
   "pasta interrompida volta para a fila",
   "sem isto o total sairia menor que o real");

ok(/estado\.concluido/.test(codigo),
   "e o relatório distingue CONCLUÍDO de PARCIAL",
   "parcial que se apresenta como final é pior do que não medir");

/* ─── 4. audita as pastas certas ─── */
passo("o alvo da contagem");

ok(/RECURSOS_AMBIENTE\[k\]\.producao/.test(codigo),
   "usa os IDs de PRODUÇÃO de AmbienteRecursos.gs",
   "é onde está o acervo — homologação nasceu limpa hoje");

ok(/typeof PASTAS === 'object'/.test(codigo),
   "e também as pastas de ofício e relatório de SistemaConfig.gs");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("quantos arquivos públicos existem de fato",
      "isto varre CÓDIGO. O número só sai rodando auditoriaDrive_contar_() " +
      "no projeto de PRODUÇÃO, e é justamente o que o item 28 pede");

aviso("que a conta que roda o script enxerga todos os arquivos",
      "o que ela não alcançar entra como erro e NÃO no total — " +
      "o número real de públicos pode ser maior que o relatado");

resumo();
