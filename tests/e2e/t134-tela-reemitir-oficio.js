/**
 * t134 — MÓDULO 04 · A TELA QUE FALTAVA PARA O "REEMITIR OFÍCIO"
 *
 * 01/09/2026, item 54.1. Fecha o achado da sétima rodada: quando o ofício
 * falhava depois da matrícula, o sistema mandava *"Use 'Reemitir ofício'"* —
 * e esse botão não existia em tela nenhuma. A função existia, tinha porta e
 * funcionava; faltava a porta de entrada.
 *
 * O DESENHO, e por que não é "um botão a mais"
 *
 * O estado MATRICULADA escondia dois estados que se comportam de forma
 * diferente: com ofício (escola comunicada) e sem ofício (matrícula emitida,
 * que não se desfaz, e escola nunca avisada). A tela passa a nomear os dois.
 *
 * TRÊS AÇÕES, e a diferença entre elas decide se um número oficial é queimado:
 *
 *   Emitir   — não existe ofício. Primeira emissão, número novo.
 *   Reenviar — existe, MESMA escola, não chegou. MESMO número.
 *   Reemitir — existe, escola errada. Número novo, e os dois ficam válidos.
 *
 * A regra que separa: mudou o destinatário, mudou o documento. Foi o usuário
 * quem apontou isto — a primeira versão do desenho tinha só duas ações e
 * teria feito o reenvio queimar número à toa.
 *
 * O QUE ESTE TESTE PODE E O QUE NÃO PODE
 *
 * O emulador não roda o navegador: o que se prova aqui é o CONTRATO entre a
 * tela e o backend — que os seletores existem, que as funções chamadas
 * existem com a assinatura certa, e que a lógica de estado está escrita como
 * desenhada. Clique, foco e render continuam "não testado".
 */

const b = require("./base");
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const { g } = b.subir({});
b.seedUsuarios(g);

const TELA = fs.readFileSync(path.join(RAIZ, "FichasSindicaisAdmin.html"), "utf8");

b.fluxo("MÓDULO 04 · o estado que a tela passou a nomear");

b.passo("1. o chip SEM OFÍCIO existe e nasce escondido");
/* Chip de exceção cravado em zero vira parte do cenário e para de ser lido. */
b.ok(/id="fsaKpiSemOficioBtn"/.test(TELA), "o chip existe");
b.ok(/id="fsaKpiSemOficioBtn"[^>]*style="display:none"/.test(TELA),
  "e começa escondido, para só aparecer quando houver o que mostrar");
b.ok(/fsa-kpi-alerta/.test(TELA), "com o estilo de alerta, não o de contagem normal");

b.passo("2. e o alerta é ÂMBAR, não dourado");
/* O dourado é identidade institucional do sindicato, não status — usá-lo para
   alerta confunde as duas coisas (Design System, CLAUDE.md). */
const bloco = (TELA.match(/\.fsa-kpi\.fsa-kpi-alerta\{[^}]*\}/) || [""])[0];
b.ok(/amber|#d97706/.test(bloco), "usa o token de alerta", bloco.substring(0, 58));
b.ok(!/C9A84C|--gold/.test(bloco), "e não usa o dourado institucional");

b.passo("3. o chip é um RECORTE de matriculada, não um status inventado");
/* Não existe STATUS "SEM_OFICIO" na planilha. Criar um aqui faria a tela
   afirmar algo que não está gravado em lugar nenhum. */
b.ok(/__SEM_OFICIO__/.test(TELA), "o marcador do filtro existe");
b.ok(/data-fsa-filtro="__SEM_OFICIO__"[^>]*onclick="fsaFiltrar\('MATRICULADA'/.test(TELA),
  "e ele filtra MATRICULADA, aplicando o corte por cima");
b.ok(/FSA_SOMENTE_SEM_OFICIO && fsaOficioDa\(f\)/.test(TELA),
  "o corte usa a situação do ofício, não um status novo");

b.fluxo("MÓDULO 04 · as três ações e o contrato com o backend");

b.passo("4. as três funções que a tela chama existem no servidor");
[["sindOf_situacaoOficioDasFichas", "descobre qual ofício é de qual ficha"],
 ["reemitirOficioFicha", "emitir e reemitir"],
 ["reenviarOficio", "reenviar com o mesmo número"]
].forEach(function (par) {
  b.ok(typeof g[par[0]] === "function", "existe: " + par[0], par[1]);
  b.ok(new RegExp("\\." + par[0] + "\\(").test(TELA),
    "e a tela a chama: " + par[0]);
});

b.passo("5. TODA chamada da tela leva o token — é o defeito de hoje de manhã");
/* Nove chamadas internas sem token foram achadas hoje (item 53), e uma delas
   era regressão minha. A tela é onde o erro é mais fácil de cometer. */
const chamadas = TELA.match(/\.(sindOf_situacaoOficioDasFichas|reemitirOficioFicha|reenviarOficio|aprovarEEncaminharFicha|atualizarEmailEscola|previewOficioFiliacao)\([^;]*?\);/g) || [];
b.ok(chamadas.length >= 5, "há chamadas ao backend para conferir",
  chamadas.length + " chamadas");
const semToken = chamadas.filter(c => c.indexOf("SISGEP_TOKEN_SESSAO") === -1);
b.igual(semToken.length, 0, "nenhuma esqueceu o token",
  semToken.map(c => c.substring(0, 40)).join(" | "));

b.passo("6. reenviar manda o MESMO número — não gera outro");
/* Se o reenvio chamasse reemitirOficioFicha, cada e-mail que não chegou
   queimaria um número da numeração oficial do sindicato. */
const reenv = (TELA.match(/function fsaReenviarOficio[\s\S]*?\n\}/) || [""])[0];
b.ok(/\.reenviarOficio\(/.test(reenv), "fsaReenviarOficio chama reenviarOficio");
b.ok(!/reemitirOficioFicha/.test(reenv),
  "e NÃO chama reemitirOficioFicha", "senão queimaria número a cada reenvio");
b.ok(/numero:\s*of\.numero/.test(reenv), "passando o número do ofício existente");
b.ok(/emailsExtras/.test(reenv),
  "e deixa acrescentar outro endereço — o caso da FAESA, de hoje de manhã");

b.passo("7. reemitir avisa que queima número e que o anterior continua valendo");
/* O usuário decidiu em 01/09/2026: os dois ficam válidos. Quem aperta precisa
   saber disso ANTES, não depois. */
b.ok(/N[ÚU]MERO NOVO/i.test(TELA), "o aviso diz que gera número novo");
b.ok(/continua v[áa]lido/i.test(TELA), "e que o anterior continua válido");
b.ok(/use\s*<b>Reenviar<\/b>|use <b>Reenviar/i.test(TELA) || /cancele e use Reenviar/i.test(TELA),
  "e aponta o Reenviar como o caminho certo quando a escola está certa");

b.passo("8. o rótulo do botão diz PARA OUTRA ESCOLA");
/* É o que justifica queimar um número. Um botão só "Reemitir" faria a pessoa
   usá-lo para reenviar. */
b.ok(/Reemitir p\/ outra escola/.test(TELA),
  "o rótulo nomeia a razão de existir da ação");

b.fluxo("MÓDULO 04 · o que a tela NÃO pode afirmar cedo demais");

b.passo("9. enquanto não sabe, não diz que está sem ofício");
/* Afirmar "sem ofício" antes da resposta chegar faria a secretaria emitir
   ofício duplicado. O undefined é deliberado e diferente de null. */
b.ok(/FSA_OFICIOS_LIDO/.test(TELA), "há um estado explícito de 'ainda não sei'");
b.ok(/if\(!FSA_OFICIOS_LIDO\) return undefined;/.test(TELA),
  "e fsaOficioDa devolve undefined nesse caso, não null");
b.ok(/conferindo of[íi]cio/.test(TELA),
  "o card mostra 'conferindo ofício…' em vez de acusar falta");

b.passo("10. E SE O CRUZAMENTO FALHAR, a tela continua sem afirmar");
/* Este é o pior caso: o backend não conseguiu cruzar. Dizer "ninguém tem
   ofício" mandaria emitir duplicado para a base inteira. */
const carrega = (TELA.match(/function fsaCarregarSituacaoOficios[\s\S]*?\n\}/) || [""])[0];
b.ok(/FSA_OFICIOS_LIDO=false/.test(carrega),
  "no erro, o estado continua 'não sei'");
b.ok(/withFailureHandler\(function\(\)\{\s*FSA_OFICIOS_LIDO=false/.test(carrega.replace(/\n\s*/g, "")),
  "inclusive quando a chamada falha de vez");

b.passo("11. e o backend também recusa em vez de mentir");
/* Provado no t133 passo 11: sem a coluna Observações, devolve ok:false. */
b.ok(/N[ãa]o foi poss[íi]vel cruzar fichas e of[íi]cios/.test(
     fs.readFileSync(path.join(RAIZ, "SindicalizacaoOficio.gs"), "utf8")),
  "a recusa do servidor está escrita e nomeia a coluna que falta");

b.fluxo("MÓDULO 04 · o modal é o mesmo, em três modos");

b.passo("12. nenhuma tela nova — o modal de aprovar foi reaproveitado");
/* Modal novo para o mesmo fluxo seria duas telas para manter em vez de uma. */
b.ok(/function fsaAplicarModoOficio/.test(TELA), "há um seletor de modo");
b.ok(/FSA_MODO_OFICIO/.test(TELA), "guardado em estado próprio");
["aprovar", "emitir", "reemitir"].forEach(function (modo) {
  b.ok(new RegExp("'" + modo + "'").test(TELA), "o modo existe: " + modo);
});
b.igual((TELA.match(/id="fsaModalOverlay"|class="fsa-modal-caixa"/g) || []).length <= 4,
  true, "e não foi criado um segundo modal do mesmo tipo");

b.passo("13. o modo troca título, aviso e botão — e volta ao normal no aprovar");
const aplicar = (TELA.match(/function fsaAplicarModoOficio[\s\S]*?\n\}/) || [""])[0];
b.ok(/fsaModalTitulo/.test(aplicar) && /fsaAvisoOficio/.test(aplicar) &&
     /fsaBtnConfirmar/.test(aplicar),
  "os três elementos são trocados");
b.ok(/aviso\.style\.display='none'/.test(aplicar),
  "e no modo aprovar o aviso some — senão sobraria da ação anterior");
b.ok(/id="fsaModalTitulo"/.test(TELA) && /id="fsaAvisoOficio"/.test(TELA),
  "os elementos existem no HTML, não só no script");

b.passo("14. e o backend certo é chamado em cada modo");
const confirmar = (TELA.match(/function fsaConfirmarEncaminhar[\s\S]*?\n\}\n/) || [""])[0];
b.ok(/ehAprovar[\s\S]*aprovarEEncaminharFicha/.test(confirmar),
  "aprovar → aprovarEEncaminharFicha");
b.ok(/else\s*\{[\s\S]*reemitirOficioFicha/.test(confirmar),
  "emitir e reemitir → reemitirOficioFicha");

b.naoTestavel(
  "se a tela RENDERIZA e os botões respondem ao clique",
  "o emulador não abre navegador. O que se prova aqui é o contrato: " +
  "seletores existem, funções existem com a assinatura certa, e a lógica de " +
  "estado está escrita como desenhada. O roteiro em homologação é abrir " +
  "Fichas Sindicais, filtrar MATRICULADA e conferir se o chip SEM OFÍCIO " +
  "aparece com a contagem certa"
);

b.resumo();
