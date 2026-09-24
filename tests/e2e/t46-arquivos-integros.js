/**
 * TESTE — INTEGRIDADE ESTRUTURAL DE TODO ARQUIVO DO PROJETO
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * O usuário cobrou, em 17/08/2026, uma coisa que ele já tinha cobrado antes:
 * "você vem me mandando o arquivo, que eu sempre pergunto". Toda vez que eu
 * entrego um .gs ou um .html para ele colar no Apps Script, ele pergunta se
 * está testado — e a resposta honesta, até aqui, era que ninguém tinha olhado
 * a integridade do arquivo. Só o que ele fazia. Não se ele ABRE.
 *
 * Num projeto Apps Script isso é grave por um motivo específico: os .html são
 * colados uns dentro dos outros pelo include(), e todos os <script> viram um
 * escopo global só. Um único arquivo com <script> desbalanceado, um </script>
 * literal dentro de uma string ou um erro de sintaxe DERRUBA O JAVASCRIPT DA
 * PÁGINA INTEIRA. O sintoma não aponta para o culpado: todos os módulos param
 * de responder ao mesmo tempo, os contadores ficam no valor estático do HTML,
 * e não aparece erro nenhum em lugar nenhum.
 *
 * É por isso que este teste roda sobre TODOS os arquivos, e não só sobre os
 * que mudaram: o arquivo quebrado pode ter sido colado semanas atrás.
 *
 * O QUE ELE PROVA, POR EXECUÇÃO
 *
 *   1. Todo .gs tem sintaxe JavaScript válida (parseado de verdade).
 *   2. Todo bloco <script> dos .html tem sintaxe válida (idem).
 *   3. As tags <script> abrem e fecham na conta certa.
 *   4. Nenhum </script> literal dentro de string — fecha o bloco no meio.
 *   5. Nenhum scriptlet do Apps Script dentro de comentário HTML (REGRA Nº 0):
 *      o template engine avalia scriptlet em qualquer posição, inclusive
 *      dentro de <!-- -->, e um include comentado vira recursão infinita.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: que a
 * função faz a coisa certa. Sintaxe válida não é comportamento correto. Este
 * teste é o piso — o arquivo ABRE — não o teto.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "../..");
const todos = fs.readdirSync(RAIZ);
const arquivosGs = todos.filter(f => f.endsWith(".gs")).sort();
const arquivosHtml = todos.filter(f => f.endsWith(".html")).sort();

/* O Apps Script resolve os scriptlets ANTES de o JavaScript existir. Para
   checar sintaxe, trocamos cada <?= ... ?> por um identificador nu.
   NU, sem aspas, de propósito: o uso mais comum no projeto é DENTRO de uma
   string — `var t = "<?!= tokenSessao ?>";` — e substituir por um literal
   com aspas produz `""SCRIPTLET""`, um erro de sintaxe que não existe no
   arquivo. Identificador nu funciona nas duas posições: vira "SCRIPTLET"
   dentro da string e uma referência válida fora dela. */
function semScriptlet(js) {
  return js.replace(/<\?[!=]?[\s\S]*?\?>/g, "SCRIPTLET");
}

/** Parseia sem executar. Devolve null se estiver ok, ou a mensagem do erro. */
function erroDeSintaxe(codigo) {
  try { new Function(codigo); return null; }
  catch (e) { return String(e.message).slice(0, 140); }
}

/** Posição legível (linha) de um índice dentro do texto. */
function linhaDe(txt, idx) { return txt.slice(0, idx).split("\n").length; }

b.fluxo("ARQUIVOS · Integridade estrutural de todo o projeto");

/* ─── 1. Sintaxe dos .gs ─────────────────────────────────────────────── */
b.passo("1. Todo arquivo .gs tem sintaxe JavaScript válida");
const gsQuebrados = [];
arquivosGs.forEach(f => {
  const erro = erroDeSintaxe(fs.readFileSync(path.join(RAIZ, f), "utf8"));
  if (erro) gsQuebrados.push(f + ": " + erro);
});
b.ok(gsQuebrados.length === 0, "os " + arquivosGs.length + " arquivos .gs parseiam",
  gsQuebrados.length ? "QUEBRADOS: " + gsQuebrados.join(" | ") : arquivosGs.length + " arquivos");


/* ─── 1b. Os .gs que vão para OUTRO projeto Apps Script ──────────────────
   `tests/fixtures/producao/` guarda arquivos que não fazem parte deste
   projeto: são os que se colam no Apps Script DA PRODUÇÃO, que diverge do
   repositório (o `registrarLogSistema_` do repositório, por exemplo, não
   existe lá — ver o t136).

   Eles ficavam fora desta varredura porque ela só lê a raiz. Um arquivo
   quebrado ali é exatamente o que a REGRA Nº -2 existe para impedir, e com
   agravante: a produção é o ambiente onde não se testa depois.

   TERMINAM EM `.gs.txt`, NÃO EM `.gs`, DE PROPÓSITO. O `.claspignore` ignora
   tudo e reabre com `!*.gs`; se essa negação casar caminho aninhado em alguma
   versão de clasp, existiriam DOIS `MonitoramentoOficios` no projeto — e o
   Apps Script recusa o push inteiro, com a mensagem aparecendo só no deploy.
   A extensão diferente torna isso impossível; a linha `tests/**` no
   .claspignore é a segunda trava. */
const DIR_PRODUCAO = path.join(__dirname, "..", "fixtures", "producao");
const gsProducao = fs.existsSync(DIR_PRODUCAO)
  ? fs.readdirSync(DIR_PRODUCAO).filter(f => f.endsWith(".gs.txt")).sort()
  : [];

b.passo("1b. Todo arquivo destinado à PRODUÇÃO tem sintaxe válida");
const producaoQuebrados = [];
gsProducao.forEach(f => {
  const erro = erroDeSintaxe(fs.readFileSync(path.join(DIR_PRODUCAO, f), "utf8"));
  if (erro) producaoQuebrados.push(f + ": " + erro);
});
b.ok(producaoQuebrados.length === 0,
  "os " + gsProducao.length + " arquivos de tests/fixtures/producao parseiam",
  producaoQuebrados.length ? "QUEBRADOS: " + producaoQuebrados.join(" | ")
                           : (gsProducao.join(", ") || "nenhum arquivo pendente de entrega"));

/* ─── 2 a 5. Estrutura dos .html ─────────────────────────────────────── */
const semBalanco = [];
const scriptQuebrado = [];
const fechaNaString = [];
const scriptletComentado = [];
const scriptletNoJs = [];

/* COMENTÁRIOS DE JAVASCRIPT, ACHADOS SEM CAIR EM STRING.
   Um `//` dentro de "https://..." não é comentário, e um /* dentro de uma
   string também não. Varrer com expressão regular acusaria os dois. Então
   este pedaço anda caractere a caractere sabendo em que estado está: fora,
   dentro de aspas, dentro de crase. É pouco código e evita falso positivo,
   que num teste de bloqueio custa mais caro que o defeito. */
function comentariosJs(corpo) {
  const achados = [];
  let i = 0;
  while (i < corpo.length) {
    const c = corpo[i], d = corpo[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      const aspa = c; i++;
      while (i < corpo.length && corpo[i] !== aspa) { if (corpo[i] === "\\") i++; i++; }
      i++; continue;
    }
    if (c === "/" && d === "*") {
      const ini = i; const fim = corpo.indexOf("*/", i + 2);
      const ate = fim < 0 ? corpo.length : fim + 2;
      achados.push({ texto: corpo.slice(ini, ate), index: ini });
      i = ate; continue;
    }
    if (c === "/" && d === "/") {
      const ini = i; let fim = corpo.indexOf("\n", i);
      if (fim < 0) fim = corpo.length;
      achados.push({ texto: corpo.slice(ini, fim), index: ini });
      i = fim; continue;
    }
    i++;
  }
  return achados;
}

arquivosHtml.forEach(f => {
  const txt = fs.readFileSync(path.join(RAIZ, f), "utf8");

  /* Balanço das tags. Contar `<script` no arquivo inteiro dá falso positivo:
     a palavra aparece dentro de comentário e de string ("no final do
     <script>"), e o contador acusa abertura que não existe. Então primeiro
     retiramos os blocos COMPLETOS — o que sobrar são tags sem par de
     verdade, e essas o navegador trata como código solto, engolindo o resto
     do arquivo ou fechando um bloco que não era para fechar. */
  const sobra = txt.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script\s*>/gi, "");
  const abreSolta = (sobra.match(/<script(?:\s[^>]*)?>/gi) || []).length;
  const fechaSolta = (sobra.match(/<\/script\s*>/gi) || []).length;
  if (abreSolta || fechaSolta) {
    semBalanco.push(f + " (" + abreSolta + " abertura sem fecho, " + fechaSolta + " fecho sem abertura)");
  }

  /* Sintaxe de cada bloco. */
  const r = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi;
  let m, n = 0;
  while ((m = r.exec(txt))) {
    n++;
    const tag = m[0].slice(0, m[0].indexOf(">") + 1);
    if (/type\s*=\s*["'](?!text\/javascript|module|application\/javascript)/i.test(tag)) continue;
    const erro = erroDeSintaxe(semScriptlet(m[1]));
    if (erro) scriptQuebrado.push(f + " · bloco " + n + " (linha " + linhaDe(txt, m.index) + "): " + erro);
  }

  /* `</script>` escrito dentro de uma string JavaScript. O navegador não
     entende de strings quando procura o fim do bloco: ele fecha ali, e o
     resto do JavaScript vira texto solto na página. A forma segura é
     quebrar a sequência ("<\/script>" ou "</scr"+"ipt>"). */
  const rBloco = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi;
  while ((m = rBloco.exec(txt))) {
    const corpo = m[1];
    const rStr = /(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g;
    let s;
    while ((s = rStr.exec(corpo))) {
      if (/<\/script/i.test(s[0])) {
        fechaNaString.push(f + " (linha " + linhaDe(txt, m.index + s.index) + ")");
      }
    }
  }

  /* REGRA Nº 0: scriptlet dentro de comentário HTML. */
  const rCom = /<!--[\s\S]*?-->/g;
  let c;
  while ((c = rCom.exec(txt))) {
    if (/<\?[!=]?[\s\S]*?\?>/.test(c[0])) {
      scriptletComentado.push(f + " (linha " + linhaDe(txt, c.index) + "): " +
        c[0].replace(/\s+/g, " ").slice(0, 90));
    }
  }

  /* REGRA Nº 0, A METADE QUE FALTAVA — 25/08/2026.
     O passo 5 olhava só comentário HTML. Mas o template engine não conhece
     comentário nenhum: ele avalia scriptlet em QUALQUER posição do arquivo,
     e comentário de JavaScript dentro de <script> é posição como outra
     qualquer.

     Foi assim que a Central de Inscrições ficou em branco: um comentário meu
     documentava a ordem de carregamento citando a chamada de include com a
     sintaxe real. O Apps Script executou a citação, a tela passou a incluir a
     tela que a inclui, a recursão estourou, e `include()` devolveu o comentário
     de falha que ele devolve quando falha. Resultado na tela do usuário:
     "Inscrições e ingressos não abrem, fica tela branca" — sem erro nenhum,
     porque include() engole a exceção e segue.

     Note que scriptlet FORA de comentário continua legítimo: PortalAssociado
     e EventosIngressoTemplate montam valores assim, de propósito. O defeito é
     ele estar escondido onde quem escreveu achava que estava desligado. */
  const rBlocoJs = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi;
  let bj;
  while ((bj = rBlocoJs.exec(txt))) {
    const base = bj.index + bj[0].indexOf(">") + 1;
    comentariosJs(bj[1]).forEach(function (com) {
      if (/<\?[!=]?[\s\S]*?\?>/.test(com.texto)) {
        scriptletNoJs.push(f + " (linha " + linhaDe(txt, base + com.index) + "): " +
          com.texto.replace(/\s+/g, " ").slice(0, 90));
      }
    });
  }
});

b.passo("2. Todo bloco <script> dos .html tem sintaxe válida");
b.ok(scriptQuebrado.length === 0,
  "os blocos de script dos " + arquivosHtml.length + " arquivos .html parseiam",
  scriptQuebrado.length ? "QUEBRADOS: " + scriptQuebrado.join(" | ") : arquivosHtml.length + " arquivos varridos");

b.passo("3. As tags <script> abrem e fecham na conta certa");
b.ok(semBalanco.length === 0, "nenhuma tag <script> sem par",
  semBalanco.length ? "DESBALANCEADOS: " + semBalanco.join(", ") : "balanço correto em todos");

b.passo("4. Nenhum </script> literal dentro de string");
b.ok(fechaNaString.length === 0, "nenhum bloco se fecha por engano dentro de uma string",
  fechaNaString.length ? "ACHADOS: " + fechaNaString.join(", ") : "nenhuma ocorrência");

b.passo("5. Nenhum scriptlet dentro de comentário HTML (REGRA Nº 0)");
// O template engine roda ANTES do navegador ver o HTML: comentar um
// scriptlet não o desliga. Um include comentado se auto-inclui em recursão
// infinita e corrompe a página inteira, sem erro nenhum.
b.ok(scriptletComentado.length === 0, "nenhum scriptlet escondido em comentário",
  scriptletComentado.length ? "ACHADOS: " + scriptletComentado.join(" | ") : "comentários limpos");

b.passo("5b. Nem dentro de comentário de JavaScript (REGRA Nº 0)");
// O caso de 25/08: um comentário dentro de <script> citando um include com a
// sintaxe real. O engine executou a citação, a tela passou a se incluir, e a
// Central de Inscrições ficou em branco — sem erro visível em lugar nenhum.
b.ok(scriptletNoJs.length === 0, "nenhum scriptlet dentro de comentário de script",
  scriptletNoJs.length ? "ACHADOS: " + scriptletNoJs.join(" | ")
                       : "comentários de JavaScript limpos nos " + arquivosHtml.length + " arquivos");

/* ═══════════════════════════════════════════════════════════
   6. Os elementos HTML fecham — a tag que faltava e derrubou um módulo
   ═══════════════════════════════════════════════════════════

   ACHADO EM 19/08/2026. O usuário: "por que o módulo de sindicalização
   está todo azul, não abre nada?".

   Não era JavaScript morto nem erro de backend. Scripts_Certificado.html
   abria `<div id="secCertificadoAdmin">` e NUNCA fechava. Como o include()
   cola todos os arquivos num HTML só, e o Certificado entra em index.html
   ANTES de Aprovacaocadastro, FichasSindicaisAdmin e Carteirinhaadmin,
   esses três módulos ficavam DENTRO da seção do Certificado — escondida
   quando ela não está ativa, e com fundo navy. Daí "todo azul".

   O defeito viveu mais de 30 commits. Os passos 1 a 5 acima passavam
   inteiros o tempo todo: sintaxe de .gs, sintaxe de <script>, balanço de
   <script>, </script> em string e scriptlet em comentário — nenhum deles
   olha para o balanço dos ELEMENTOS. Este passo existe por isso.

   Duas armadilhas que a primeira versão desta varredura caiu, e que a
   contagem abaixo evita:
     - tag dentro de <script>, <style> ou comentário não conta;
     - `<div` escrito dentro de um ATRIBUTO (o onerror de
       Fichasindicalizacao.html monta um <div> em string) daria falso
       positivo — por isso a contagem casa `<div` com `</div>` em vez de
       empilhar tag a tag.
   ═══════════════════════════════════════════════════════════ */
b.passo("6. Os elementos HTML de bloco abrem e fecham na conta certa");

/** Zera script/style/comentário preservando as quebras de linha. */
function soMarcacao(html) {
  const branco = (m) => m.replace(/[^\n]/g, " ");
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, branco)
    .replace(/<style[\s\S]*?<\/style>/gi, branco)
    .replace(/<!--[\s\S]*?-->/g, branco);
}

/* Só as tags que, sem fechar, engolem o resto da página. Um <span> ou <b>
   solto é feio; um <div> solto derruba módulo. */
const TAGS_DE_BLOCO = ["div", "section", "main", "table", "tbody", "form"];
const desbalanceados = [];

arquivosHtml.forEach(function (arq) {
  const marcacao = soMarcacao(fs.readFileSync(path.join(RAIZ, arq), "utf8"));
  TAGS_DE_BLOCO.forEach(function (tag) {
    const abre = (marcacao.match(new RegExp("<" + tag + "\\b", "gi")) || []).length;
    const fecha = (marcacao.match(new RegExp("</" + tag + ">", "gi")) || []).length;
    if (abre !== fecha) {
      desbalanceados.push(arq + ": <" + tag + "> abre " + abre + " e fecha " + fecha +
        " (sobra " + (abre - fecha) + ")");
    }
  });
});

b.ok(desbalanceados.length === 0,
  "nenhum elemento de bloco fica aberto num .html",
  desbalanceados.length
    ? "ACHADOS: " + desbalanceados.join(" | ")
    : "balanço correto em " + arquivosHtml.length + " arquivos, para " +
      TAGS_DE_BLOCO.join("/"));

b.naoTestavel("Se a função faz a coisa certa",
  "sintaxe válida é o piso, não o teto — comportamento se prova nos testes de fluxo");

/* ═══════════════════════════════════════════════════════════════════════════
   NENHUM .gs PODE TER O MESMO NOME-BASE DE UM .html

   O QUE ORIGINOU, em 20/08/2026: o deploy da homologação reprovou com

       A file with this name already exists in the current project: BingoInscricao

   Eu tinha criado BingoInscricao.gs E BingoInscricao.html. No Apps Script o
   nome do arquivo é único DENTRO DO PROJETO, independente do tipo — o `.gs` e
   o `.html` são só como o clasp representa o tipo no disco, não parte do nome.

   POR QUE ISTO ENTRA NO t46, e não noutro teste: a REGRA Nº -2 diz que o t46 é
   o portão antes de qualquer arquivo sair daqui. Este defeito passou por ele
   porque a checagem não existia — a sintaxe estava perfeita nos dois arquivos,
   isolados. Só o PROJETO INTEIRO revela o choque, e é exatamente o tipo de
   propriedade que este arquivo existe para guardar.

   Medido na hora da correção: em 223 arquivos, nenhum par jamais conviveu.
   O único choque da história do projeto foi o que eu acabara de criar.
   ═══════════════════════════════════════════════════════════════════════════ */
b.passo("nome de arquivo único no projeto");

const basesGs = new Set(arquivosGs.map(f => f.slice(0, -3)));
/* O parâmetro NÃO pode se chamar `b`: sombrearia o módulo de asserções e a
   linha seguinte quebraria com "b.ok is not a function". */
const chocam = arquivosHtml.map(f => f.slice(0, -5))
                           .filter(base => basesGs.has(base));

b.ok(chocam.length === 0,
     chocam.length === 0
       ? "nenhum .html tem o mesmo nome-base de um .gs"
       : "CHOQUE DE NOME: " + chocam.join(", ") + " existe como .gs e como .html",
     "o Apps Script recusa o push inteiro — e a mensagem só aparece no deploy");

/* ═══════════════════════════════════════════════════════════════════════════
   FRAGMENTO NÃO CARREGA TAG DE PÁGINA — 26/08/2026

   Este projeto tem dois tipos de .html: PÁGINA (abre com <!DOCTYPE>/<html> e
   é servida inteira) e FRAGMENTO (um pedaço colado dentro de outra por
   include). Converter uma página em fragmento é operação comum aqui, e o que
   sobra dela é sempre a mesma coisa: um `</head>` e um `<body>` órfãos no
   meio do arquivo.

   Foi o que aconteceu com CompassoImportacao.html. O navegador não reclama —
   ele descarta as tags e segue renderizando — então o defeito não aparece
   como erro, aparece como layout estranho que ninguém sabe explicar. Pior:
   `</head>` no meio de um documento já aberto pode fazer o parser fechar
   seções que estavam abertas, e aí o CSS escopado deixa de alcançar o que
   deveria.

   A regra: se o arquivo NÃO declara <html>, ele é fragmento — e fragmento não
   tem cabeça, corpo nem raiz próprios.
   ═══════════════════════════════════════════════════════════════════════════ */
b.passo("fragmento não carrega tag de página");

const TAGS_DE_PAGINA = [/<\/head>/i, /<body[\s>]/i, /<\/body>/i, /<\/html>/i];
const fragmentosSujos = [];

arquivosHtml.forEach(arq => {
  const corpo = fs.readFileSync(path.join(RAIZ, arq), "utf8");
  /* Página de verdade declara a raiz. Só o que não declara é fragmento. */
  if (/<html[\s>]/i.test(corpo)) return;
  const achadas = TAGS_DE_PAGINA
    .filter(rx => rx.test(corpo))
    .map(rx => String(rx).replace(/[/\\]|\[\\s>\]|i$/g, ""));
  if (achadas.length) fragmentosSujos.push(arq + " (" + achadas.join(", ") + ")");
});

b.ok(fragmentosSujos.length === 0,
     fragmentosSujos.length === 0
       ? "nenhum fragmento tem </head>, <body> ou </html> sobrando"
       : "SOBRA DE CONVERSÃO: " + fragmentosSujos.join(" | "),
     "sobra de quando o arquivo era página inteira; o navegador descarta em silêncio");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
