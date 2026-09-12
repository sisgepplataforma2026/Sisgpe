/**
 * TESTE — A ABERTURA DA INSCRIÇÃO, O LINK QUE CHEGA, E O ENSAIO QUE NÃO SUJA
 *
 * O QUE ORIGINOU, 05/09/2026. O usuário pediu auditoria do módulo da festa e,
 * no meio dela, disse: *"vamos abrir as inscrições na próxima semana"*. Três
 * coisas medidas no código impediriam isso de dar certo:
 *
 *   1. `PERIODO_INICIO` estava cravado em 21/09/2026. A semana seguinte caía
 *      ANTES disso — a página pública responderia "As inscrições ainda não
 *      abriram" e o `compasso_inscrever` recusaria tudo. E o ensaio NÃO
 *      pegaria: em homologação a trava de período é pulada, então o teste
 *      passaria e só a produção recusaria.
 *
 *   2. O link do ingresso podia sair em `/dev`, que só abre para quem tem
 *      acesso de edição ao script. Havia aviso, mas dentro de um diagnóstico
 *      que alguém precisa lembrar de rodar — e quem envia nunca vê o defeito,
 *      porque para o dono do projeto o link abre normal.
 *
 *   3. Homologação e produção gravavam nas MESMAS coleções do Firestore.
 *      Ensaiar queimava vaga real das 2.000 e, pior, ocupava a chave de
 *      duplicidade: ensaiar com um CPF real BLOQUEIA aquela pessoa de se
 *      inscrever de verdade depois.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA. O emulador não fala com o Firestore de
 * verdade nem entrega e-mail. Ele prova a REGRA — qual data vale, quando a
 * entrega recusa, e qual nome de coleção sai. Se o projeto Firebase de
 * homologação é o mesmo da produção, e se `SISGEP_URL_BASE` está declarada,
 * são Propriedades do script: só o diagnóstico no editor responde.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const props = g.PropertiesService.getScriptProperties();
function limpar() {
  ["COMPASSO_INSCRICAO_INICIO", "COMPASSO_INSCRICAO_FIM", "SISGEP_AMBIENTE"]
    .forEach(k => props.setProperty(k, ""));
}
const dia = d => d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();

fluxo("COMPASSO · a data de abrir inscrição sai da planilha de propriedades");
passo("sem declarar nada, vale a constante");

limpar();
igual(dia(g.compasso_periodoInicio_()), "21/9/2026",
      "sem propriedade, o início é o do EMISSAO_CFG",
      "quem não mexer não vê diferença nenhuma");
igual(dia(g.compasso_periodoFim_()), "11/11/2026", "e o fim também");

passo("declarada, ela manda");

props.setProperty("COMPASSO_INSCRICAO_INICIO", "2026-09-08");
igual(dia(g.compasso_periodoInicio_()), "8/9/2026",
      "a abertura passa a ser 08/09 sem publicar versão nova",
      "era o bloqueio: a data estava no código e a semana que vem cai antes dela");

passo("a armadilha do fuso");

/* `new Date('2026-09-08')` é lido como MEIA-NOITE EM UTC, que em Brasília é
   21h do dia 7 — a inscrição abriria um dia antes do que está escrito, e
   ninguém entenderia por quê. O parse tem que montar por componentes. */
const abertura = g.compasso_periodoInicio_();
igual(abertura.getDate(), 8, "o dia é 8, não 7");
igual(abertura.getHours(), 0, "e começa à meia-noite LOCAL, não às 21h do dia anterior");

const fecha = (props.setProperty("COMPASSO_INSCRICAO_FIM", "2026-11-11"),
               g.compasso_periodoFim_());
igual(fecha.getHours(), 23, "o fim é no FIM do dia declarado");
igual(fecha.getMinutes(), 59, "23:59 — senão fecharia à meia-noite e perderia o último dia");

passo("data errada não abre nem fecha por acidente");

props.setProperty("COMPASSO_INSCRICAO_INICIO", "08/09/2026");
igual(dia(g.compasso_periodoInicio_()), "21/9/2026",
      "formato errado cai no padrão, não vira data maluca");

props.setProperty("COMPASSO_INSCRICAO_INICIO", "2026-02-31");
igual(dia(g.compasso_periodoInicio_()), "21/9/2026",
      "31 de fevereiro cai no padrão",
      "sem conferir os componentes de volta, o JavaScript rolaria para 03/03 calado");

props.setProperty("COMPASSO_INSCRICAO_INICIO", "2026-13-01");
igual(dia(g.compasso_periodoInicio_()), "21/9/2026", "mês 13 idem");

passo("os TRÊS caminhos de inscrição usam o mesmo resolvedor");

/* Três arquivos decidem "está no período?". Se um ler a constante direto, ele
   diverge dos outros no dia em que a propriedade mudar — e a divergência
   aparece como "abriu num lugar e não no outro". */
const fs = require("fs"), path = require("path");
const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lerLimpo = f => semComentarios(
  fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8"));

["EventosInscricaoPublica.gs", "EventosInscricoesV2.gs"].forEach(f => {
  const src = lerLimpo(f);
  ok(src.indexOf("compasso_periodoInicio_()") > -1,
     f + " usa o resolvedor");
  ok(src.indexOf("EMISSAO_CFG.PERIODO_INICIO") === -1,
     f + " não lê mais a constante direto",
     "ler direto faria este caminho ignorar a propriedade");
});

const emissao = lerLimpo("EventosEmissao.gs");
igual((emissao.match(/EMISSAO_CFG\.PERIODO_(INICIO|FIM)/g) || []).length, 2,
      "em EventosEmissao.gs a constante só aparece DENTRO dos resolvedores",
      "duas ocorrências: o padrão do início e o do fim");

fluxo("COMPASSO · a entrega recusa mandar link que o associado não abre");
passo("com /dev, para");

const urlOriginal = g.ScriptApp.getService;
g.ScriptApp.getService = () => ({ getUrl: () => "https://script.google.com/macros/s/XYZ/dev" });
g.SISTEMA_URL_BASE = "";          // o resolvedor guarda cache
props.setProperty("SISGEP_URL_BASE", "");

let barrou = false, recado = "";
try { g.compasso_ingressoUrlPublica_("C26.abc"); }
catch (e) { barrou = true; recado = String(e && e.message || e); }

ok(barrou, "a entrega é BLOQUEADA quando o link sairia em /dev",
   "antes existia só um aviso, dentro de um diagnóstico que alguém tinha de lembrar de rodar");
ok(recado.indexOf("SISGEP_URL_BASE") > -1,
   "e o erro diz o nome da propriedade que resolve",
   "erro que não diz o conserto vira chamado para o suporte");
ok(recado.indexOf("já está emitido") > -1,
   "e diz que o ingresso não se perdeu",
   "senão a pessoa reemite e duplica");

passo("o diagnóstico ainda consegue perguntar");

/* O diagnóstico existe justamente para MOSTRAR a base, inclusive quando ela
   está errada. Explodir nele esconderia a resposta de quem foi procurá-la. */
let diag = "";
try { diag = g.compasso_ingressoUrlPublica_("EXEMPLO", true); }
catch (e) { diag = "EXPLODIU: " + e.message; }
ok(diag.indexOf("/dev") > -1 && diag.indexOf("EXPLODIU") === -1,
   "com permitirDev o diagnóstico recebe a URL em vez de um erro");

passo("com /exec, passa");

g.ScriptApp.getService = urlOriginal;
g.SISTEMA_URL_BASE = "";
const boa = g.compasso_ingressoUrlPublica_("C26.abc");
ok(boa.indexOf("/exec") > -1 && boa.indexOf("page=ingresso") > -1,
   "link normal é montado sem reclamação", boa);

fluxo("COMPASSO · o ensaio para de queimar vaga e de bloquear CPF real");
passo("produção intocada");

limpar();
igual(g.fs_colecao_("inscricoesEventos"), "inscricoesEventos",
      "em produção o nome da coleção NÃO muda",
      "prefixar produção órfãozaria, em silêncio, tudo o que já está gravado");
igual(g.fs_colecao_("reservasEventos"), "reservasEventos", "idem o contador das 2.000 vagas");

props.setProperty("SISGEP_AMBIENTE", "producao");
igual(g.fs_colecao_("ingressos"), "ingressos", "declarada produção, também não muda");

passo("homologação isolada");

props.setProperty("SISGEP_AMBIENTE", "homologacao");
igual(g.fs_colecao_("inscricoesEventos"), "hml_inscricoesEventos",
      "em homologação a coleção ganha prefixo");
igual(g.fs_colecao_("reservasEventos"), "hml_reservasEventos",
      "o contador de vagas do ensaio é OUTRO documento",
      "sem isso cada ensaio queimava uma das 2.000 vagas reais");
igual(g.fs_colecao_("inscricaoUnicaEventos"), "hml_inscricaoUnicaEventos",
      "e o índice de duplicidade também",
      "era o pior: ensaiar com CPF real impedia aquela pessoa de se inscrever de verdade");

passo("ambiente ilegível cai em produção, como o resto do sistema");

props.setProperty("SISGEP_AMBIENTE", "qualquer-coisa");
igual(g.fs_colecao_("ingressos"), "ingressos",
      "valor desconhecido = produção, mesma convenção do getAmbienteAtual()",
      "homologação declara o ambiente — provado pelo usuário em 21/08/2026");

passo("os quatro acessores passam pelo prefixo");

/* Um acessor sem prefixo vaza para a coleção de produção e ninguém percebe:
   a gravação funciona, só cai no lugar errado. */
const fsSrc = lerLimpo("EventosFirestore.gs") + lerLimpo("EventosFirestoreQuery.gs");
["fs_colecao_(collection)"].forEach(() => {});
igual((fsSrc.match(/fs_colecao_\(collection\)/g) || []).length, 4,
      "os quatro acessores (set, get, queryEquals, list) usam o prefixo",
      "fs_findByField_ vai junto porque chama fs_list_");

limpar();

naoTestavel("se o Firebase de homologação é o mesmo projeto da produção",
  "é a propriedade FIREBASE_PROJETO, que só o editor lê. O prefixo protege " +
  "mesmo quando for o mesmo projeto — que é o caso hoje.");
naoTestavel("se SISGEP_URL_BASE está declarada em produção",
  "só o diagnosticoEntregaCompasso_ no editor responde. A recusa criada aqui " +
  "garante que, se não estiver, ninguém recebe link quebrado em silêncio.");

resumo();
