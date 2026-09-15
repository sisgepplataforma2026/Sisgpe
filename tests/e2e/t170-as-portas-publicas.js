/**
 * TESTE — QUEM PRECISA ENTRAR, ENTRA; QUEM NÃO PRECISA, NÃO
 *
 * O QUE ORIGINOU, 15/09/2026. Ele abriu o link do ingresso pelo WhatsApp e
 * recebeu uma tela do Google Drive: "Não foi possível abrir o arquivo.
 * Verifique o endereço e tente novamente."
 *
 * Não era bug no ingresso. Era o manifesto, que trazia o acesso do web app
 * restrito ao dono do projeto. Só ele conseguia abrir; todo o resto do mundo
 * recebia aquela tela. Por isso o ingresso abria no computador dele, logado na
 * conta dona, e não abria pelo celular.
 *
 * E isso não derrubava só o ingresso: derrubava TODA porta pública de uma vez
 * — a inscrição da festa, a cartela do bingo, o portal do associado, o pixel
 * dos ofícios, a confirmação de pagamento. Nenhum associado conseguiria abrir
 * nada. A abertura das inscrições teria falhado inteira, com o link já na
 * lista de transmissão.
 *
 * O QUE ESTE TESTE GUARDA, e por que ele existe: acesso restrito ao dono é o
 * valor PADRÃO de um projeto Apps Script. Ou seja, ninguém fechou esta porta —
 * ninguém a abriu, e não se percebeu porque quem testava era o dono. Um
 * manifesto reescrito pelo editor, um merge, uma restauração de backup, e o
 * padrão volta em silêncio. Aqui reprova.
 *
 * A OUTRA METADE, e ela importa tanto quanto: atender a internet só é
 * aceitável porque as rotas administrativas continuam exigindo sessão. Este
 * teste confere isso rota por rota — se alguém acrescentar um painel novo sem
 * a trava, reprova junto.
 */
const fs = require("fs");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const manifesto = JSON.parse(fs.readFileSync(RAIZ + "/appsscript.json", "utf8"));
const code = fs.readFileSync(RAIZ + "/Code.gs", "utf8");
const doGet = (code.match(/function doGet\(e\) \{[\s\S]*?\n\}/) || [""])[0];
const doPost = (code.match(/function doPost\(e\) \{[\s\S]*?\n\}/) || [""])[0];

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A porta da rua está aberta — é o que faz o link chegar a quem recebe");

passo("o web app atende quem não tem conta");
igual(manifesto.webapp.access, "ANYONE_ANONYMOUS",
      "o acesso é o aberto, não o restrito ao dono",
      "no valor padrão do Apps Script só o dono abre, e todo associado recebe " +
      "a tela do Drive: 'não foi possível abrir o arquivo'");

passo("e roda com a identidade de quem publicou");
igual(manifesto.webapp.executeAs, "USER_DEPLOYING",
      "executeAs = USER_DEPLOYING",
      "o visitante anônimo não tem acesso à planilha nem ao Drive do " +
      "sindicato: quem lê a base é o dono, não ele");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("As portas de dentro continuam trancadas");

/* Atender a internet só é aceitável porque cada painel administrativo exige
   sessão e cai no Login sem ela. Se um painel novo nascer sem essa linha, ele
   nasce público — e este bloco reprova antes de isso ir ao ar. */
passo("todo painel pede sessão antes de desenhar qualquer coisa");
const PAINEIS = ["emissao", "portaria", "checkin", "compasso",
                 "compasso-importar", "bingo", "bingo-telao"];
PAINEIS.forEach(function (nome) {
  const i = doGet.indexOf('p.painel === "' + nome + '"');
  ok(i > -1, "  painel '" + nome + "' existe na rota");
  const trecho = doGet.slice(i, i + 700);
  ok(/getSessaoUsuario/.test(trecho), "    exige sessão");
  ok(/HtmlService\.createHtmlOutputFromFile\("Login"\)/.test(trecho),
     "    e devolve o Login quando não há");
});

passo("e o portal administrativo, que é o destino padrão, idem");
const cauda = doGet.slice(doGet.indexOf("SISTEMA ADMINISTRATIVO"));
ok(/getSessaoUsuario/.test(cauda) && /"Login"/.test(cauda),
   "sem sessão, ninguém chega ao index",
   "é a rota que atende quando nenhuma outra casou — a mais fácil de esquecer");

passo("o doPost só abre sessão com senha conferida");
ok(/autenticarUsuario/.test(doPost), "login direto passa por autenticarUsuario");
ok(/getSessaoUsuario/.test(doPost), "e o resto exige sessão válida");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A página de erro não conta a intimidade do sistema");

/* Enquanto só o dono abria, imprimir o rastro do erro era diagnóstico
   conveniente. Atendendo a internet, é um mapa do sistema entregue a quem
   precisou apenas provocar um erro: arquivo, função, linha. */
const captura = code.slice(code.indexOf("Erro no doGet SISGEP") - 900,
                           code.indexOf("Erro no doGet SISGEP") + 1400);

passo("o rastro saiu da tela");
ok(!/erro\.stack \? erro\.stack : \(erro && erro\.message/.test(captura),
   "a tela não imprime mais o rastro do erro");
ok(!/<pre/.test(captura), "  nem o bloco de texto cru que o exibia");

passo("mas o log continua recebendo tudo");
ok(/Logger\.log[\s\S]{0,120}erro\.stack/.test(captura),
   "o rastro vai inteiro para o registro de execução",
   "esconder do log não protegeria ninguém — só cegaria quem conserta");

passo("e a pessoa sai com um código para citar");
ok(/var codigo =/.test(captura), "a tela mostra um código curto");
ok(/Logger\.log\("Erro no doGet SISGEP \[" \+ codigo/.test(captura),
   "o MESMO código vai para o log",
   "código que não aparece nos dois lados não liga uma ponta na outra");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O que cada página pública deixa fazer depois de aberta",
  "aqui se prova quem ENTRA. O que um visitante anônimo consegue pedir ao " +
  "servidor depois de entrar é outra conta, e quem a mede é o t6-exposicao — " +
  "o teto de 204 funções globais. Ele não piorou com esta mudança, mas deixou " +
  "de ser teórico: antes só o dono alcançava essas funções.");
naoTestavel("A implantação de fato aceitar o manifesto",
  "o acesso só passa a valer quando o clasp publica uma versão nova com ele. " +
  "Que o link abra numa conta que não é a dona, só o ensaio responde — e é " +
  "exatamente o que ele tentou fazer pelo WhatsApp.");

resumo();
