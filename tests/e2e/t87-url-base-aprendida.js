/**
 * A URL /exec SE DESCOBRE SOZINHA — NINGUÉM DIGITA O QUE O SISTEMA SABE
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. Eu coloquei "declarar SISGEP_URL_BASE" na lista de pendências do
 * usuário, e ele perguntou: *"Porque não foi feito?"*.
 *
 * A resposta que eu tinha dado era metade da verdade. É certo que eu não tenho
 * acesso ao projeto Apps Script — só ao repositório. Mas o SISTEMA tem, e eu
 * não tinha usado isso: estava pedindo que uma pessoa digitasse à mão um dado
 * que o próprio código sabe dizer. É a REGRA Nº 0.6 aplicada ao contrário.
 *
 * COMO O SISTEMA SABE
 *
 * `ScriptApp.getService().getUrl()` responde coisas diferentes conforme quem
 * pergunta: `/exec` de dentro do web app publicado, `/dev` de dentro do
 * editor. O `doGet` só roda dentro do web app — então a primeira pessoa que
 * abrir qualquer página do SISGEP faz a URL certa passar por ali.
 *
 * POR QUE ISSO IMPORTA MAIS DO QUE PARECE
 *
 * `/dev` só abre para quem tem acesso de EDIÇÃO ao script. Um link `/dev`
 * dentro do e-mail do ingresso é uma porta fechada para o associado — e o
 * pior tipo de defeito, porque quem envia não vê: para o dono do projeto ele
 * abre normalmente.
 *
 * AS TRÊS TRAVAS, E POR QUE CADA UMA
 *
 *   1. só grava `/exec`. Abrir a página pelo `/dev` durante um teste não pode
 *      contaminar a configuração de todo mundo;
 *   2. nunca sobrescreve. Se alguém declarou à mão, essa decisão vale;
 *   3. falha em silêncio. Isto roda no caminho de TODA página do sistema — um
 *      erro de propriedade aqui derrubaria o SISGEP inteiro.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. gravar também quando a URL é /dev ...................... 1 falha
 *   2. sobrescrever o que foi declarado à mão ................. 1 falha
 *   3. deixar a exceção subir (derruba toda página) ........... 1 falha
 *   4. parar de chamar a função no doGet ...................... 1 falha
 *   5. não atualizar o cache em memória ....................... 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");
const cfg = ler("SistemaConfig.gs");
const code = ler("Code.gs");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return codigo.slice(m.index + m[0].length, i - 1);
}

const EXEC = "https://script.google.com/macros/s/AKfyDEPLOY/exec";
const DEV  = "https://script.google.com/macros/s/AKfySCRIPT/dev";

/** Roda a aprendizagem com um estado de propriedades controlado. */
function aprender(urlDoServico, jaDeclarada, quebrar) {
  const props = { SISGEP_URL_BASE: jaDeclarada || "" };
  const escrito = [];
  let memoria = null;
  const deps = {
    PropertiesService: {
      getScriptProperties: () => {
        if (quebrar === "props") throw new Error("propriedades indisponíveis");
        return {
          getProperty: k => props[k] || null,
          setProperty: (k, v) => { props[k] = v; escrito.push([k, v]); }
        };
      }
    },
    ScriptApp: { getService: () => ({ getUrl: () => {
      if (quebrar === "url") throw new Error("serviço indisponível");
      return urlDoServico;
    } }) },
    Logger: { log: () => {} },
    SISTEMA_URL_BASE: null
  };
  const nomes = Object.keys(deps);
  /* SISTEMA_URL_BASE é atribuída dentro da função; para observar isso, o corpo
     é embrulhado num retorno do valor final. */
  const corpo = corpoDe(cfg, "sisgep_aprenderUrlBase_") + "\n; return SISTEMA_URL_BASE;";
  let erro = null;
  try {
    memoria = new Function(...nomes, corpo)(...nomes.map(n => deps[n]));
  } catch (e) { erro = e.message; }
  return { props, escrito, memoria, erro };
}

fluxo("URL BASE · o sistema aprende sozinho o endereço que ele mesmo publica");

passo("o caminho que resolve tudo");

const bom = aprender(EXEC, "");
igual(bom.escrito.length, 1,
      "abrindo qualquer página pelo /exec, a URL fica gravada",
      "a primeira pessoa que usar o sistema já configura para todas as outras");
igual(bom.escrito[0][0], "SISGEP_URL_BASE", "  na propriedade certa");
igual(bom.escrito[0][1], EXEC, "  com a URL /exec: " + EXEC);

/* MUTAÇÃO 5: sem isto, o mesmo pedido ainda montaria links com /dev, porque a
   variável em memória já teria sido preenchida antes. */
igual(bom.memoria, EXEC,
      "e o cache em memória é atualizado no mesmo instante",
      "senão o próprio pedido que aprendeu ainda geraria link errado");

passo("as três travas");

/* MUTAÇÃO 1 */
const pelaDev = aprender(DEV, "");
igual(pelaDev.escrito.length, 0,
      "abrir a página pelo /dev NÃO grava nada",
      "um teste seu pelo /dev contaminaria o link de todo mundo");

/* MUTAÇÃO 2 */
const jaTinha = aprender(EXEC, "https://declarada-a-mao/exec");
igual(jaTinha.escrito.length, 0,
      "não sobrescreve o que foi declarado à mão");
igual(jaTinha.props.SISGEP_URL_BASE, "https://declarada-a-mao/exec",
      "  a decisão de quem declarou continua valendo");

/* MUTAÇÃO 3 — a mais grave: isto roda em TODA página do sistema. */
["props", "url"].forEach(onde => {
  const quebrado = aprender(EXEC, "", onde);
  igual(quebrado.erro, null,
        "falha em " + onde + " não derruba a página",
        "esta função está no caminho de todo acesso ao SISGEP");
});

passo("a ligação com o doGet");

/* MUTAÇÃO 4 — e o motivo de os comentários saírem antes.
 *
 * Na primeira rodada esta asserção sobreviveu: apagar a CHAMADA e deixar o
 * comentário que a cita mantinha a regex satisfeita. Comentário não executa;
 * medir código lendo texto exige tirar o texto que não é código. */
const semComentario = code
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

ok(/sisgep_aprenderUrlBase_\(\)/.test(semComentario),
   "o doGet chama a aprendizagem — a chamada, não o comentário sobre ela");

/* Tem de vir ANTES das rotas: uma rota que devolve página e sai antes disso
   nunca aprenderia. */
const dentro = semComentario.slice(semComentario.indexOf("function doGet"));
const posAprende = dentro.indexOf("sisgep_aprenderUrlBase_()");
const posPrimeiraRota = dentro.indexOf('if (p.portal');
ok(posAprende > 0 && posPrimeiraRota > 0 && posAprende < posPrimeiraRota,
   "e chama ANTES da primeira rota",
   "rota que devolve página e sai antes disso nunca aprenderia");

passo("quem consome");

const usa = corpoDe(cfg, "getSistemaUrlBase");
ok(/SISGEP_URL_BASE/.test(usa),
   "getSistemaUrlBase lê a propriedade antes de perguntar ao ScriptApp",
   "é o que faz o valor aprendido valer para trigger e rotina do editor");
ok(usa.indexOf("SISGEP_URL_BASE") < usa.indexOf("ScriptApp.getService"),
   "  e nessa ordem: propriedade primeiro, serviço como último recurso");

resumo();
