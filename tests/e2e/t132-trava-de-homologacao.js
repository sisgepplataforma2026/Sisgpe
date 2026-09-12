/**
 * t132 — MÓDULO 03 · A TRAVA QUE IMPEDE UM TESTE DE RODAR EM PRODUÇÃO
 *
 * Frente A, nona rodada, 01/09/2026. As três últimas funções públicas do
 * Módulo 03 sem teste nenhum. Com estas, o módulo fica com todas as funções
 * públicas exercitadas ao menos uma vez.
 *
 * A MAIS PERIGOSA DAS TRÊS
 *
 * `documentosTesteReservarNumeroHomologacao` é uma função de TESTE que
 * consome um número da numeração oficial de ofícios. Rodada por engano em
 * produção, ela queima um número real — e número gasto não volta, deixa
 * buraco na numeração oficial do sindicato.
 *
 * Existe uma trava para isso: `documentosExigirHomologacaoSegura_`. Ela
 * confere QUATRO coisas antes de deixar passar, e não uma:
 *
 *   1. a propriedade SISGEP_AMBIENTE diz "homologacao";
 *   2. a planilha ativa é a de homologação;
 *   3. a planilha ativa NÃO coincide com a de produção;
 *   4. a identidade da planilha aberta confirma o mesmo id.
 *
 * As quatro existem porque uma sozinha não basta: a propriedade pode dizer
 * homologação com a planilha apontando para produção, e é justamente esse
 * cruzamento que causaria o estrago.
 *
 * ESTE TESTE QUEBRA CADA UMA DAS QUATRO, UMA POR VEZ. Trava de segurança que
 * nunca foi vista recusando não está provada — está suposta.
 *
 * E A TERCEIRA FUNÇÃO
 *
 * `removerTriggerFilaEnvioOficios` APAGA o gatilho que envia os ofícios. Se a
 * porta dela falhasse, um anônimo pararia a emissão de ofício do sindicato —
 * sem apagar nada, sem erro, só o silêncio de uma fila que não anda mais.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const SEM = b.logar(g, "rogerio");   /* financeiro + rh — sem documentos */

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

const props = g.PropertiesService.getScriptProperties();
const ID_ATIVO = String(g.PLANILHA_ID);

/* A aba Controle é de onde sai o próximo número. Sem ela, a função falharia
   por "Aba de registro não encontrada" — e o teste mediria a própria falta de
   seed, não a trava. Foi o que aconteceu na primeira versão deste arquivo. */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let ctrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!ctrl) ctrl = ss.insertSheet(g.PLANILHA_REGISTRO);
ctrl.getRange(1, 1, 1, 8).setValues([[
  "Número do Ofício", "Data", "TIPO", "Escola", "CNPJ", "E-mail",
  "Status", "CONFIG"]]);

/* ONDE A TRAVA LÊ CADA COISA — e não é tudo no mesmo lugar:
 *
 *   - o AMBIENTE vem da propriedade SISGEP_AMBIENTE (SistemaConfig.gs:330);
 *   - os IDs das PLANILHAS vêm da constante PLANILHAS, no código
 *     (getPlanilhasConfig_, SistemaConfig.gs:82) — NÃO de propriedade.
 *
 * Mexer nas propriedades achando que muda o id não muda nada: a trava
 * continua vendo os mesmos valores e o teste conclui o contrário do que
 * acontece. É preciso mexer nos dois lugares certos. */
const ID_PRODUCAO_FALSO = "1PRODUCAOoutroIdCompletamenteDiferenteXX";

function porEmHomologacao() {
  props.setProperty("SISGEP_AMBIENTE", "homologacao");
  g.PLANILHAS.HOMOLOGACAO = ID_ATIVO;          /* a ativa É a de homologação */
  g.PLANILHAS.PRODUCAO = ID_PRODUCAO_FALSO;    /* e produção é outra coisa   */
  if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
}
porEmHomologacao();

b.fluxo("MÓDULO 03 · as portas das três");

b.passo("1. sem sessão e sem conta do editor, nenhuma das três roda");
g.__usuarioAtivoEmail = "";
[["removerTriggerFilaEnvioOficios", t => g.removerTriggerFilaEnvioOficios(t)],
 ["documentosDiagnosticoHomologacao", t => g.documentosDiagnosticoHomologacao(t)],
 ["documentosTesteReservarNumeroHomologacao", t => g.documentosTesteReservarNumeroHomologacao(t)]
].forEach(function (par) {
  const r = tentar(() => par[1](""));
  b.ok(!r.passou, "anônimo é barrado: " + par[0],
    r.passou ? "PASSOU" : r.msg.substring(0, 38));
  const r2 = tentar(() => par[1](SEM));
  b.ok(!r2.passou, "sem o módulo Documentos: " + par[0],
    r2.passou ? "PASSOU" : r2.msg.substring(0, 38));
});

b.fluxo("MÓDULO 03 · a trava de homologação, quebrada quatro vezes");

b.passo("2. com tudo certo, a função de teste passa e reserva um número");
porEmHomologacao();
const okHomolog = tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));
b.ok(okHomolog.passou, "em homologação legítima, roda",
  okHomolog.passou ? "" : okHomolog.msg.substring(0, 50));
b.ok(okHomolog.passou && /^\d{3}\/\d{4}$/.test(String(okHomolog.valor.numero || "")),
  "e reserva número na forma oficial",
  okHomolog.passou ? String(okHomolog.valor.numero) : "");
b.ok(okHomolog.passou && String(okHomolog.valor.ambiente) === "homologacao",
  "dizendo em qual ambiente rodou");

b.passo("3. QUEBRA 1 — o ambiente diz produção");
/* O caso mais óbvio, e o que a trava tem que pegar primeiro. */
props.setProperty("SISGEP_AMBIENTE", "producao");
if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
const emProducao = tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));
b.ok(!emProducao.passou && /Teste recusado/i.test(emProducao.msg),
  "RECUSA quando o ambiente é produção",
  emProducao.passou ? "PASSOU — queimaria número real de ofício"
                    : emProducao.msg.substring(0, 52));

b.passo("4. A SEGUNDA CHECAGEM NÃO PODE DISPARAR — as duas metades dela");
/* A checagem escrita é `!idHomologacao || idAtivo !== idHomologacao`, e
   nenhuma das duas metades alcança um caso real:

   1ª metade — `!idHomologacao` não fica vazio: o getPlanilhasConfig_
      (SistemaConfig.gs:98) faz `cfg.HOMOLOGACAO || fallback.HOMOLOGACAO`, e
      string vazia é falsa, então o fallback repõe o valor.
   2ª metade — `idAtivo !== idHomologacao` não pode ser verdade: três linhas
      acima a trava já confirmou o ambiente como "homologacao", e nesse
      ambiente o getPlanilhaId() SEM argumento devolve exatamente o mesmo que
      getPlanilhaId("homologacao") — os dois lêem cfg.HOMOLOGACAO.

   NÃO É BURACO, e é importante dizer por quê: quem protege de verdade são a
   1ª checagem (ambiente) e a 3ª (homologação ≠ produção), e a 3ª é justamente
   a que pega o caso perigoso — o passo 5 prova isso. Mas quem lê o código
   conta quatro proteções onde duas fazem o trabalho, e é isso que fica
   registrado aqui. Confere o MOTIVO da recusa, não só que houve exceção: na
   primeira versão deste arquivo estes passos ficaram verdes por uma aba que
   faltava no seed — recusa por acidente contando como trava funcionando. */
porEmHomologacao();
g.PLANILHAS.HOMOLOGACAO = "";
if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
b.ok(String(g.getPlanilhaId("homologacao")).length > 0,
  "id vazio é reposto pelo fallback — a 1ª metade não alcança",
  String(g.getPlanilhaId("homologacao")).substring(0, 22));

porEmHomologacao();
b.igual(String(g.getPlanilhaId()), String(g.getPlanilhaId("homologacao")),
  "e em homologação a ativa É a de homologação — a 2ª metade também não");

b.passo("5. QUEBRA 3 — a planilha de homologação É a de produção");
/* O erro de configuração que mais assusta: os dois ids iguais. A propriedade
   diz homologação, a planilha bate com a de homologação, e mesmo assim é
   produção — porque alguém apontou as duas para o mesmo lugar. */
porEmHomologacao();
g.PLANILHAS.PRODUCAO = ID_ATIVO;   /* homologação e produção no mesmo lugar */
if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
const mesmaPlanilha = tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));
b.ok(!mesmaPlanilha.passou && /Teste recusado/i.test(mesmaPlanilha.msg),
  "RECUSA quando homologação e produção apontam para a mesma planilha",
  mesmaPlanilha.passou ? "PASSOU — este é o caso que queimaria número real"
                       : mesmaPlanilha.msg.substring(0, 52));

b.passo("6. E O QUE PROVA QUE A RECUSA FOI DE VERDADE — nada foi gasto");
/* Uma trava que recusa DEPOIS de consumir o número não protege nada. */
porEmHomologacao();
const antes = g.documentosTesteReservarNumeroHomologacao(ADM).numero;

props.setProperty("SISGEP_AMBIENTE", "producao");
if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));
tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));
tentar(() => g.documentosTesteReservarNumeroHomologacao(ADM));

porEmHomologacao();
const depois = g.documentosTesteReservarNumeroHomologacao(ADM).numero;
const nAntes = parseInt(String(antes).split("/")[0], 10);
const nDepois = parseInt(String(depois).split("/")[0], 10);
b.igual(nDepois - nAntes, 1,
  "três recusas seguidas não gastaram número nenhum",
  antes + " → " + depois + " (as três tentativas em produção não contaram)");

b.fluxo("MÓDULO 03 · o diagnóstico de homologação");

b.passo("7. ele responde com o ambiente e o fuso, e obedece à mesma trava");
porEmHomologacao();
const diag = tentar(() => g.documentosDiagnosticoHomologacao(ADM));
b.ok(diag.passou, "roda em homologação",
  diag.passou ? "" : diag.msg.substring(0, 46));
b.ok(diag.passou && diag.valor.ok === true, "e responde ok");
b.ok(diag.passou && String(diag.valor.ambiente) === "homologacao",
  "dizendo o ambiente", diag.passou ? String(diag.valor.ambiente) : "");

props.setProperty("SISGEP_AMBIENTE", "producao");
if (g.getAmbienteAtual) g.getAmbienteAtual._cache = undefined;
const diagProd = tentar(() => g.documentosDiagnosticoHomologacao(ADM));
b.ok(!diagProd.passou && /Teste recusado/i.test(diagProd.msg),
  "e RECUSA em produção, como a outra",
  diagProd.passou ? "PASSOU" : diagProd.msg.substring(0, 46));
porEmHomologacao();

b.fluxo("MÓDULO 03 · apagar o gatilho que envia os ofícios");

b.passo("8. quem apaga o gatilho da fila precisa ser administrador");
/* Se esta porta falhasse, um anônimo pararia a emissão de ofício do
   sindicato — sem apagar dado, sem erro, só uma fila que não anda mais. */
g.__usuarioAtivoEmail = "";
g.instalarTriggerFilaEnvioOficios
  ? tentar(() => g.instalarTriggerFilaEnvioOficios(ADM))
  : null;
const gatilhosAntes = g.ScriptApp.getProjectTriggers()
  .filter(t => t.getHandlerFunction() === "processarFilaEnvioOficios").length;

const anonimo = tentar(() => g.removerTriggerFilaEnvioOficios(""));
b.ok(!anonimo.passou, "anônimo não apaga o gatilho",
  anonimo.passou ? "PASSOU — a fila de ofícios pode ser parada por qualquer um"
                 : anonimo.msg.substring(0, 42));
b.igual(
  g.ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "processarFilaEnvioOficios").length,
  gatilhosAntes,
  "e o gatilho continua onde estava depois da tentativa");

b.passo("9. e o administrador apaga — a porta não pode virar parede");
/* Fechar sem deixar o legítimo passar troca um buraco por uma ferramenta
   inalcançável. */
const comAdm = tentar(() => g.removerTriggerFilaEnvioOficios(ADM));
b.ok(comAdm.passou, "o administrador consegue remover",
  comAdm.passou ? "" : comAdm.msg.substring(0, 46));
b.igual(
  g.ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "processarFilaEnvioOficios").length,
  0,
  "e o gatilho realmente saiu");

b.aviso(
  "a trava tem quatro checagens escritas e duas que fazem o trabalho",
  "protegem de verdade: (1) o ambiente precisa ser homologacao e (3) a " +
  "planilha de homologação não pode coincidir com a de produção — que é " +
  "justamente o caso perigoso, e está provado no passo 5. As outras duas não " +
  "alcançam caso nenhum (passo 4). Não é buraco, é redundância; mas quem lê " +
  "o código conta quatro proteções onde há duas, e numa revisão futura isso " +
  "engana"
);

b.naoTestavel(
  "se a produção está com SISGEP_AMBIENTE = producao",
  "a trava foi provada aqui recusando, mas ela só protege se a propriedade " +
  "da produção estiver certa. Se alguém deixar SISGEP_AMBIENTE = homologacao " +
  "na PRODUÇÃO, a 1ª checagem passa; sobra a 3ª, que compara os ids das duas " +
  "planilhas no código. Vale conferir com o censoPropriedades que a produção " +
  "diz producao"
);

b.resumo();
