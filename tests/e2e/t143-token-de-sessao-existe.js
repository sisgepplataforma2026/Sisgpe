/**
 * O TOKEN DE SESSÃO QUE A TELA MANDA TEM DE EXISTIR
 *
 * O QUE ORIGINOU (produção, 03/09/2026, 12h48)
 *
 * A aba "Conferir envio" abriu e mostrou, para um administrador logado:
 *
 *     Error: Sessão inválida ou expirada. Entre novamente no SISGEP.
 *
 * A sessão estava boa. O que estava errado era o NOME da variável: dois dos
 * três resolvedores de token de `OficiosConferencia.html` procuravam
 * `TOKEN_SESSAO` e `window.SISGEP.token`. Nenhum dos dois existe em lugar
 * algum do projeto — a página declara `SISGEP_TOKEN_SESSAO`
 * (`index.html:1363`, do scriptlet do template).
 *
 * POR QUE PASSOU PELOS TESTES. O t141 asserta que a tela CHAMA
 * `oficiosAguardandoDestinatarios`. Ela chamava. Só chamava com string
 * vazia — e `exigirModulo_` recusa string vazia exatamente como recusaria
 * um token falsificado. O teste mediu a chamada; ninguém mediu o argumento.
 *
 * POR QUE ESSA CLASSE DE ERRO É SILENCIOSA. `typeof X !== "undefined"` é o
 * jeito certo de checar variável que pode não existir — e é justamente por
 * ser à prova de erro que ele engole o nome errado. Não há exceção, não há
 * log: o `||` cai para o próximo, chega no `""` e o backend responde com uma
 * mensagem de autenticação. O sintoma acusa a sessão do usuário, e o defeito
 * está a três arquivos de distância.
 *
 * O QUE ESTE TESTE FAZ. Varre os `.html` atrás de todo identificador com
 * forma de token de sessão e exige que ele seja ATRIBUÍDO em algum lugar do
 * projeto. Nome fantasma reprova, esteja ou não atrás de um `typeof`.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");

const HTMLS = fs.readdirSync(RAIZ)
  .filter(function (n) { return /\.html$/.test(n); })
  .map(function (n) { return { nome: n, txt: fs.readFileSync(path.join(RAIZ, n), "utf8") }; });

const GSS = fs.readdirSync(RAIZ)
  .filter(function (n) { return /\.gs$/.test(n); })
  .map(function (n) { return { nome: n, txt: fs.readFileSync(path.join(RAIZ, n), "utf8") }; });

const TODOS = HTMLS.concat(GSS);

/* Forma de um identificador de token de sessão neste projeto. */

/* O `\w*` PRECISA aceitar ZERO caracteres. A primeira versao desta forma era
   `[A-Za-z_][A-Za-z0-9_]*TOKEN_SESSAO`, que exige ao menos um caractere de
   prefixo — e por isso NUNCA casava com `TOKEN_SESSAO` puro, que e exatamente
   o nome fantasma que derrubou a producao. O detector passava verde contra o
   defeito que ele existe para pegar. Erro achado rodando o teste contra o
   arquivo com defeito e estranhando uma assercao verde. */
const FORMA = /\b\w*TOKEN_SESSAO\b/g;

fluxo("SESSÃO · o token que a tela manda tem de existir");

/* ─── qual é o nome canônico, medido e não digitado ─── */
passo("o nome canônico");

const declarados = {};
TODOS.forEach(function (a) {
  /* `var X = ...`, `X = ...` e `window.X = ...` — as três formas de nascer. */
  const re = /(?:var\s+|window\.)?\b(\w*TOKEN_SESSAO)\b\s*=[^=]/g;
  let m;
  while ((m = re.exec(a.txt)) !== null) {
    if (!declarados[m[1]]) declarados[m[1]] = [];
    declarados[m[1]].push(a.nome);
  }
});

const nomesDeclarados = Object.keys(declarados).sort();

ok(nomesDeclarados.indexOf("SISGEP_TOKEN_SESSAO") > -1,
   "SISGEP_TOKEN_SESSAO é declarado no projeto",
   nomesDeclarados.length
     ? nomesDeclarados.map(function (n) {
         return n + " (" + declarados[n].slice(0, 2).join(", ") + ")";
       }).join(" · ")
     : "(nenhum token de sessão declarado — a varredura mudou de forma?)");

/* ─── nenhum .html pode LER um nome que ninguém escreve ─── */
passo("nomes fantasma");

const fantasmas = [];
HTMLS.forEach(function (a) {
  const linhas = a.txt.split("\n");
  linhas.forEach(function (linha, i) {
    /* Linha de atribuição não é leitura: é ela que cria o nome. */
    const achados = linha.match(FORMA);
    if (!achados) return;
    achados.forEach(function (nome) {
      if (declarados[nome]) return;
      fantasmas.push(a.nome + ":" + (i + 1) + " lê " + nome +
                     ", que ninguém declara");
    });
  });
});

igual(fantasmas, [],
      "nenhum .html lê um token de sessão que o projeto não declara");

/* ─── todo resolvedor de token tem de citar o nome canônico ─────────────
   A asserção acima pega o nome inventado. Esta pega o caso pior: um
   `function token()` que devolve outra coisa sem citar token nenhum — por
   exemplo `window.SISGEP && window.SISGEP.token`, o segundo fallback que
   existia no arquivo da produção e que também nunca resolveu. */
passo("os resolvedores");

const resolvedoresRuins = [];
HTMLS.forEach(function (a) {
  const re = /function\s+token\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\n\s*\}/g;
  let m, n = 0;
  while ((m = re.exec(a.txt)) !== null) {
    n++;
    if (m[1].indexOf("SISGEP_TOKEN_SESSAO") === -1) {
      resolvedoresRuins.push(a.nome + ": resolvedor nº " + n +
                             " não cita SISGEP_TOKEN_SESSAO");
    }
  }
});

igual(resolvedoresRuins, [],
      "todo function token() de tela resolve pelo nome canônico");

/* ─── a tela da conferência, especificamente ───────────────────────────
   É onde o defeito apareceu, e ela tem TRÊS resolvedores em três blocos
   <script> separados. Dois estavam errados e um certo: contar é o que pega
   a correção feita pela metade. */
passo("OficiosConferencia.html");

const conf = HTMLS.filter(function (a) { return a.nome === "OficiosConferencia.html"; })[0];

if (!conf) {
  ok(false, "OficiosConferencia.html existe", "arquivo não encontrado na raiz");
} else {
  const resolvedores = conf.txt.match(/function\s+token\s*\(/g) || [];
  const citam = conf.txt.match(/typeof SISGEP_TOKEN_SESSAO !== "undefined"/g) || [];

  ok(resolvedores.length > 0, "a tela tem resolvedor de token",
     resolvedores.length + " resolvedor(es)");

  ok(resolvedores.length === citam.length,
     "e CADA um deles resolve pelo nome canônico",
     citam.length + " de " + resolvedores.length +
     (resolvedores.length === citam.length ? " — nenhum ficou para trás"
                                           : " — correção feita pela metade"));

  ok(conf.txt.indexOf("window.SISGEP") === -1,
     "e o fallback fantasma window.SISGEP saiu do arquivo",
     conf.txt.indexOf("window.SISGEP") === -1
       ? "nenhuma ocorrência" : "ainda presente");
}

resumo();
