/**
 * EXCLUIR CADASTRO É MOVER, NÃO APAGAR
 *
 * O QUE ORIGINOU
 *
 * 20/08/2026. Varredura achou 36 chamadas de deleteRow/deleteRows em 20
 * arquivos. Classificadas uma a uma, 21 apagavam CADASTRO ou REGISTRO DE
 * NEGÓCIO — escola (679 reais), contato, colaborador, folha de pagamento,
 * recibo emitido, receita, solicitação de bolsa, agendamento.
 *
 * As outras 15 apagam fila, rascunho, cache e expurgo por idade, e ali apagar
 * é o comportamento certo.
 *
 * POR QUE ESTE TESTE É UMA LISTA, E NÃO UMA PROIBIÇÃO
 *
 * "Nenhum .gs pode chamar deleteRow" seria simples e ERRADO: quebraria os 15
 * pontos legítimos e empurraria alguém a burlar a regra. O que este teste faz
 * é fixar a CLASSIFICAÇÃO: cada deleteRow que sobrou está na lista de
 * exceções, com o motivo; e qualquer deleteRow NOVO, fora dela, reprova até
 * alguém decidir de que tipo ele é.
 *
 * É a diferença entre proibir e obrigar a decidir.
 *
 * MUTAÇÕES MATADAS (20/08/2026)
 *
 *   1. voltar deleteRow em excluirEscolasEmLote .............. 2 falhas
 *   2. acrescentar deleteRow novo num arquivo qualquer ....... 1 falha
 *   3. tirar o teto de lote de Escolas ....................... 1 falha
 *   4. teto que CORTA em vez de recusar ...................... 1 falha
 *      — excluir 50 de 300 e responder "50 excluídas" deixa quem
 *        pediu achando que as 300 saíram
 *   5. lixeiraMover_ apagando ANTES de conferir a cópia ...... 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const gs = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs")).sort();

/* ════════════════════════════════════════════════════════════════════════════
   AS 15 EXCEÇÕES LEGÍTIMAS — cada uma com o motivo de continuar apagando.
   Mexer aqui é decisão consciente, não ajuste de teste.
   ════════════════════════════════════════════════════════════════════════════ */
const LEGITIMAS = {
  "Oficios.gs":              [4, "FILA_ENVIO_OFICIOS — fila de envio; único módulo em operação"],
  "Recibo.gs":               [2, "rascunho de beneficiários e deduplicação"],
  "MemoriaCore.gs":          [2, "cache da memória, repopulado a cada execução"],
  "VoucherLixeira.gs":       [2, "JÁ É a lixeira — apagar de lá é o ato final"],
  "CentralEmailIA.gs":       [1, "expurgo de adiados antigos, por idade"],
  "EscolasReceita.gs":       [1, "expurgo de dados antigos, por idade"],
  "Visitas.gs":              [1, "limpeza de dados de TESTE"],
  "RHColaboradores.gs":      [1, "regerar folha da competência (substituição)"],
  "CobrancaRelacaoAnexos.gs":[1, "reimportação idempotente da mesma escola+competência"],
  "contatos.gs":             [1, "apara sobra de linha após a reescrita — não é a exclusão"]
};

function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

fluxo("EXCLUSÃO · Cadastro vai para a lixeira, fila continua sendo apagada");

/* ─── 1. o módulo da lixeira ─── */
passo("Lixeira.gs");

ok(gs.indexOf("Lixeira.gs") !== -1, "Lixeira.gs existe");

const lix = fs.readFileSync(path.join(RAIZ, "Lixeira.gs"), "utf8");

["lixeiraMover_", "lixeiraMoverVarias_", "lixeiraListar_", "lixeiraRestaurar_"]
  .forEach(fn => ok(new RegExp("function\\s+" + fn).test(lix), "expõe " + fn));

/* A ordem copia → confere → apaga é o que impede a linha de sumir dos dois
   lados. Sem esta asserção, alguém "simplifica" tirando a conferência. */
const corpoMover = lix.slice(lix.indexOf("function lixeiraMover_"),
                             lix.indexOf("function lixeiraMoverVarias_"));
const posGrava   = corpoMover.indexOf(".setValues([valores.concat(meta)])");
const posConfere = corpoMover.indexOf("!== id");
const posApaga   = corpoMover.indexOf("aba.deleteRow(linha)");

ok(posGrava > -1 && posConfere > posGrava && posApaga > posConfere,
   "lixeiraMover_ copia, CONFERE a cópia, e só então apaga",
   "invertido, uma falha no meio deixa a linha fora dos dois lugares");

/* ─── 2. nenhum deleteRow fora da classificação ─── */
passo("cada deleteRow que sobrou está classificado");

const contagem = {};
gs.forEach(function (f) {
  if (f === "Lixeira.gs") return;
  const src = semComentarios(fs.readFileSync(path.join(RAIZ, f), "utf8"));
  const n = (src.match(/\.deleteRows?\s*\(/g) || []).length;
  if (n) contagem[f] = n;
});

const naoClassificados = Object.keys(contagem).filter(f => !LEGITIMAS[f]);
igual(naoClassificados, [],
      "nenhum arquivo apaga linha sem estar na lista de exceções",
      "deleteRow novo reprova até alguém decidir se é cadastro ou fila");

const divergentes = Object.keys(LEGITIMAS)
  .filter(f => (contagem[f] || 0) !== LEGITIMAS[f][0])
  .map(f => f + ": esperava " + LEGITIMAS[f][0] + ", achei " + (contagem[f] || 0));
igual(divergentes, [],
      "e a quantidade em cada um bate com a classificação",
      "um deleteRow a mais num arquivo já legítimo também precisa de decisão");

/* ─── 3. quem excluía cadastro agora usa a lixeira ─── */
passo("os 21 pontos migrados");

const MIGRADOS = [
  "AgendOftalm.gs", "Comprovantes.gs", "Escolas.gs", "EventosAgenda.gs",
  "Juridico.gs", "RHColaboradores.gs", "RHDocumentos.gs", "Receita.gs",
  "Recibo.gs", "ReciboDiversos.gs", "RecibosHistorico.gs", "Voucher.gs",
  "contatos.gs"
];
const semLixeira = MIGRADOS.filter(f =>
  !/lixeira(Mover_|MoverVarias_|Aba_)/.test(fs.readFileSync(path.join(RAIZ, f), "utf8")));
igual(semLixeira, [], "os 13 arquivos com exclusão de cadastro chamam a lixeira");

/* ─── 4. o teto de lote ─── */
passo("o limite pedido em 20/08/2026");

const cfg = fs.readFileSync(path.join(RAIZ, "SistemaConfig.gs"), "utf8");
ok(/LIMITE_EXCLUSAO_POR_LOTE:\s*\d+/.test(cfg),
   "REGRAS_NEGOCIO.LIMITE_EXCLUSAO_POR_LOTE existe");

const escolas = fs.readFileSync(path.join(RAIZ, "Escolas.gs"), "utf8");
ok(/linhasParaExcluir\.length\s*>\s*tetoLote/.test(escolas),
   "excluirEscolasEmLote confere o teto");

/* O teto tem de RECUSAR, não cortar. Um teto que fatia o lote e responde
   "50 excluídas" é pior do que não ter teto: some com 250 do pedido sem
   ninguém perceber. */
const trechoTeto = escolas.slice(escolas.indexOf("tetoLote"), escolas.indexOf("Backup automático"));
ok(/excluidas:\s*0/.test(trechoTeto) && /NADA foi excluído/.test(trechoTeto),
   "e RECUSA o lote inteiro em vez de cortar",
   "cortar em silêncio é o modo de falhar que este teto existe para evitar");

/* A checagem vem antes do backup — senão uma exclusão recusada deixa aba de
   lixo na planilha. */
ok(escolas.indexOf("tetoLote") < escolas.indexOf("escolaNomeBackupLivre_"),
   "e o teto é conferido ANTES de criar a aba de backup");

const cont = fs.readFileSync(path.join(RAIZ, "contatos.gs"), "utf8");
ok(/removidos\.length\s*>\s*teto/.test(cont),
   "excluirContatos também respeita o teto",
   "é o caso que não usa deleteRow e quase passou despercebido");

/* ─── 5. Ofícios intacto ─── */
passo("a única operação viva");

const ofc = fs.readFileSync(path.join(RAIZ, "Oficios.gs"), "utf8");
ok(!/lixeiraMover/.test(ofc),
   "Oficios.gs não passou a usar lixeira",
   "os 4 deleteRow dele são fila de envio — apagar ali é o certo");
ok((semComentarios(ofc).match(/\.deleteRows?\s*\(/g) || []).length === 4,
   "e continua com os mesmos 4 deleteRow de antes");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que a lixeira funciona contra uma planilha real",
      "isto varre CÓDIGO. O comportamento de lixeiraMover_ com SpreadsheetApp " +
      "de verdade só se prova no ambiente no ar");

aviso("que os registros já apagados voltam",
      "o que foi apagado antes de 20/08/2026 não tem de onde ser recuperado");

resumo();
