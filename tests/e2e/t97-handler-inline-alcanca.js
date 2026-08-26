/**
 * HANDLER INLINE ALCANÇA A FUNÇÃO
 *
 * Por que este teste existe — 26/08/2026, defeito real, relatado assim:
 * "Estou importando, anexei o arquivo / Mas não acontece nada".
 *
 * Um dia antes eu tinha fechado `CompassoImportacao.html` numa IIFE, para
 * parar de derramar `api`, `esc`, `g` e `aviso` no escopo global — que é
 * único no Apps Script e colidia com a Central. A IIFE resolveu a colisão e
 * criou outro problema: `onclick`/`onchange` inline são avaliados no escopo
 * GLOBAL. Toda função que ficou dentro da IIFE e continuou sendo chamada por
 * atributo inline virou um nome que não existe.
 *
 * O que torna isso perigoso não é o erro — é o SILÊNCIO dele. O navegador
 * lança ReferenceError dentro do handler, a página segue renderizando
 * normalmente, e o sintoma é "cliquei e não aconteceu nada". Nenhuma tela
 * fica em branco, nenhum erro sobe até o backend. Foram dois casos no mesmo
 * arquivo: `escolheu` (o <input type=file>) e `apontar` (o <select> gerado
 * por string dentro de `seletor()`) — este segundo nem aparece no HTML lido a
 * olho nu, o que é exatamente o motivo de a conferência ser feita por teste.
 *
 * O que esta guarda cobra: em todo arquivo cujo <script> está fechado em
 * IIFE, TODO nome chamado por atributo inline precisa existir no escopo
 * global — ou porque é `window.alguma coisa` exportada pelo próprio arquivo,
 * ou porque é função de outro arquivo do sistema, ou porque é built-in.
 * Vale para o HTML escrito à mão E para o HTML gerado por concatenação de
 * string dentro do script.
 */
const fs = require('fs');
const path = require('path');
const { fluxo, passo, ok, resumo } = require('./base');

const RAIZ = path.resolve(__dirname, '..', '..');
const ler = arq => fs.readFileSync(path.join(RAIZ, arq), 'utf8');

/* Built-ins e objetos do host que um handler inline pode chamar sem que nada
   precise exportá-los. Lista curta de propósito: é mais seguro um falso
   alarme aqui do que um botão morto em homologação. */
const GLOBAIS = [
  'document', 'window', 'console', 'alert', 'confirm', 'prompt',
  'google', 'this', 'event', 'Number', 'String', 'Boolean', 'Math',
  'JSON', 'Date', 'parseInt', 'parseFloat', 'setTimeout', 'encodeURIComponent'
];

/**
 * Nomes chamados por atributo inline. Pega os dois formatos que existem no
 * projeto: atributo literal no HTML (onclick="f()") e atributo montado em
 * string dentro do JS (onchange=\"f(...)\" com aspas escapadas).
 */
function handlersInline(corpo){
  /* Duas armadilhas que este casamento precisa desviar, e ambas me pegaram
     antes de chegar nesta versão:

     1. O atributo do HTML gerado por string vem com aspas por dentro —
        onchange="impApontar(\'…\',this.value)" — então "conteúdo sem aspas"
        não serve: o que delimita é a aspa IGUAL à de abertura.
     2. `leitor.onload = function(){…}` casa com "on…=" e NÃO é handler
        inline: é atribuição de propriedade em JS, que enxerga o escopo do
        arquivo e está correta. O que separa os dois casos é o ponto antes do
        nome e o espaço em volta do "=". */
  const achados = [];
  const rx = /(?<![.\w$])on[a-z]+=(["'])((?:(?!\1)[\s\S])*)\1/g;
  let m;
  while ((m = rx.exec(corpo)) !== null){
    const conteudo = m[2];
    /* Nome invocado, ignorando `.metodo()` encadeado — quem precisa existir
       no escopo global é a raiz da expressão, não o método. */
    const chamadas = conteudo.match(/(?<![\w$.)\]])[A-Za-z_$][\w$.]*\s*\(/g) || [];
    chamadas.forEach(c => {
      const nome = c.replace(/\s*\($/, '').split('.')[0];
      achados.push({ nome, trecho: conteudo.slice(0, 80) });
    });
  }
  return achados;
}

/** Nomes que o arquivo publica no escopo global. */
function exportados(corpo){
  const nomes = [];
  const rx = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
  let m;
  while ((m = rx.exec(corpo)) !== null) nomes.push(m[1]);
  return nomes;
}

/** O script do arquivo está fechado numa IIFE? */
function fechadoEmIife(corpo){
  return /\(function\s*\(\s*\)\s*\{/.test(corpo) && /\}\s*\)\s*\(\s*\)\s*;?\s*<\/scr/i.test(corpo + '</scr');
}

fluxo('TELAS · handler inline alcança a função que chama');

/* Arquivos cujo script está (ou pode vir a ficar) em IIFE e que são incluídos
   dentro de outra tela — o cenário exato do defeito. */
const ALVOS = ['CompassoImportacao.html', 'CompassoInscricoes.html'];

/* Nomes que vêm de OUTROS arquivos do sistema e são legitimamente globais
   quando a tela roda incluída no portal. Cada um com a origem escrita. */
const DE_FORA = {
  'CompassoImportacao.html': ['compassoMostrarImportacao'],  /* CompassoInscricoes.html */
  'CompassoInscricoes.html': ['impEscolherArquivo', 'impLerLink', 'impRemoverArquivo',
                              'impUsarTodas', 'impImportar', 'impEmitir', 'impLimpar',
                              'impReconferir', 'impEscolheu', 'impApontar', 'toast']
};

ALVOS.forEach(arq => {
  passo(arq);
  const corpo = ler(arq);
  const iife = fechadoEmIife(corpo);
  const publica = exportados(corpo);
  const externos = DE_FORA[arq] || [];

  if (!iife){
    ok(true, arq + ' não está fechado em IIFE — handler inline enxerga o escopo do arquivo');
    return;
  }

  ok(true, arq + ' está fechado em IIFE',
     'então todo nome inline precisa estar exportado');

  const usados = handlersInline(corpo);
  ok(usados.length > 0, '  há handlers inline para conferir (' + usados.length + ')');

  const orfaos = [];
  usados.forEach(u => {
    const alcanca = publica.indexOf(u.nome) >= 0 ||
                    externos.indexOf(u.nome) >= 0 ||
                    GLOBAIS.indexOf(u.nome) >= 0;
    if (!alcanca) orfaos.push(u.nome + '  em  ' + u.trecho);
  });

  ok(orfaos.length === 0,
     '  todo nome chamado inline existe no escopo global',
     orfaos.length ? 'PRESO DENTRO DA IIFE: ' + orfaos.join(' | ') : '');
});

passo('as duas funções do defeito de 26/08 estão exportadas com prefixo');
const imp = ler('CompassoImportacao.html');
ok(/window\.impEscolheu\s*=\s*escolheu/.test(imp),
   'impEscolheu é publicada',
   'é o onchange do <input type="file"> — sem ela, anexar arquivo não faz nada');
ok(/window\.impApontar\s*=\s*apontar/.test(imp),
   'impApontar é publicada',
   'é o onchange do <select> gerado por string em seletor()');
ok(/onchange="impEscolheu\(this\.files\[0\]\)"/.test(imp),
   '  e o input aponta para o nome exportado, não para o nome interno');
ok(/onchange="impApontar\(/.test(imp),
   '  e o seletor de coluna também');
ok(!/onchange="escolheu\(/.test(imp) && !/onchange="apontar\(/.test(imp),
   '  nenhum resquício dos nomes internos no HTML');

passo('o diálogo do sistema segue o padrão visual do SISGEP');
/* 26/08/2026: "Tem que ajustar para o padrão Sisgep". A caixa do link público
   era branca inteira, com ícone quadrado claro — enquanto todo modal do
   sistema abre com a faixa navy de `.of-modal-head`. */
const insc = ler('CompassoInscricoes.html');
ok(/\.dg-topo\{[^}]*color:#fff/.test(insc.replace(/\s*\n\s*/g, '')),
   'o topo do diálogo é a faixa escura do design system, não fundo branco');
ok(/linear-gradient\(135deg, var\(--navy\) 0%, var\(--navy2\)/.test(insc),
   '  usando o gradiente navy → navy2 dos tokens, não hex solto');
ok(/border-radius:var\(--rad-xl\)/.test(insc),
   '  e o raio do card vem do token --rad-xl');
ok(/g\('dgCancelar'\)\.hidden\s*=\s*!!opcoes\.semCancelar/.test(insc),
   'diálogo que só informa esconde o botão Cancelar',
   'o link público mostrava "Cancelar" e "Fechar" fazendo a mesma coisa');
ok(/semCancelar:\s*true/.test(insc) && /icone:\s*'🔗'/.test(insc),
   '  e o link público usa isso, com ícone de link em vez de interrogação');

resumo();
