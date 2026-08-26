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

passo('nenhuma das telas do Compasso pergunta pelo navegador');
/* 26/08/2026, print do usuário: "Uma página incorporada em n-hlio7e77srckp…
   googleusercontent.com diz — Importar 201 linha(s)?". Isso é o confirm()
   nativo, que o CLAUDE.md proíbe e que anuncia o endereço cru do host num
   momento em que a pessoa está prestes a criar 201 inscrições de verdade. */
/* COMENTÁRIO NÃO É CÓDIGO. A primeira versão desta varredura reprovou a
   Central por três ocorrências que eram todas texto explicando que os nativos
   foram removidos — inclusive a citação literal do CLAUDE.md. Guarda que
   acusa a documentação da própria correção é guarda que vai ser desligada. */
function semComentarios(corpo){
  return corpo.replace(/<!--[\s\S]*?-->/g, '')
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

['CompassoImportacao.html', 'CompassoInscricoes.html'].forEach(arq => {
  const corpo = semComentarios(ler(arq));
  /* Só o que é CHAMADA — `prompt:` como nome de propriedade não conta. */
  const nativos = (corpo.match(/(?<![\w$.])(confirm|alert|prompt)\s*\(/g) || []);
  ok(nativos.length === 0, arq + ' não usa confirm/alert/prompt nativo',
     nativos.length ? 'ainda tem: ' + nativos.join(', ') : 'usa o diálogo do sistema');
});

passo('o diálogo é um componente só, com um dono só');
/* Quando a Importação precisou perguntar, havia duas saídas ruins: copiar o
   diálogo para o segundo arquivo, ou deixar o confirm() nativo. Extrair para
   arquivo próprio é a terceira. Esta guarda existe para a cópia não voltar. */
const dono = ['CompassoInscricoes.html', 'CompassoImportacao.html', 'EventosAdmin.html']
  .filter(arq => /function\s+perguntar\s*\(/.test(ler(arq)));
ok(dono.length === 0,
   'nenhuma tela define `perguntar` por conta própria',
   dono.length ? 'redefinem: ' + dono.join(', ') : 'a definição mora em DialogoSISGEP.html');
const dlg = ler('DialogoSISGEP.html');
ok(/function perguntar\(/.test(dlg) && /function dgFechar\(/.test(dlg) &&
   /function dgConfirmar\(/.test(dlg),
   'o componente traz as três funções do diálogo');
/* `fechadoEmIife`, não a regex de abertura sozinha: `setTimeout(function(){…})`
   também casa com "(function(){" e não fecha arquivo nenhum. */
ok(!fechadoEmIife(dlg),
   '  e NÃO está fechado em IIFE',
   'ele existe para ser chamado de fora — os onclick dos próprios botões são globais');
ok(/\.dg-pe \.b\{/.test(dlg),
   '  e traz o desenho dos próprios botões',
   'usava `.b` do Compasso, que não existe na rota que serve a Importação sozinha');

passo('quem usa o diálogo o inclui — e uma vez só');
const inclui = f => (ler(f).match(/include\('DialogoSISGEP'\)/g) || []).length;
ok(inclui('CompassoInscricoes.html') === 1,
   'a Central inclui o diálogo exatamente uma vez',
   'incluir duas vezes duplica os IDs e getElementById passa a pegar o errado');
ok(/include\('DialogoSISGEP'\)/.test(ler('Code.gs')),
   'a rota que serve a Importação sozinha também o inclui',
   'sem isso as três perguntas voltariam ao confirm() nativo fora da Central');

passo('a Importação não empilha um segundo cabeçalho de módulo');
ok(/id="impCabecalho"/.test(imp),
   'o cabeçalho próprio tem identidade para poder ser escondido');
ok(/getElementById\('compassoInscricoes'\)/.test(imp) && /cab\.hidden = true/.test(imp),
   '  e some quando a Central está na página',
   'como aba, ela repetia o título de módulo embaixo do da Festa');
ok(/#compassoImportacao \.b\{/.test(imp),
   'os botões da Importação têm desenho próprio',
   'antes funcionavam por acidente, herdando `.b` da Central pelo escopo comum');
ok(!/class="selo s-er"[^>]*>HOMOLOGA/.test(imp) && /selo-ambiente/.test(imp),
   'HOMOLOGAÇÃO deixou de usar o selo vermelho de erro',
   'era a mesma cor que a tela usa para "coluna não encontrada"');

passo('o diálogo do sistema segue o padrão visual do SISGEP');
/* 26/08/2026: "Tem que ajustar para o padrão Sisgep". A caixa do link público
   era branca inteira, com ícone quadrado claro — enquanto todo modal do
   sistema abre com a faixa navy de `.of-modal-head`. */
ok(/\.dg-topo\{[^}]*color:#fff/.test(dlg.replace(/\s*\n\s*/g, '')),
   'o topo do diálogo é a faixa escura do design system, não fundo branco');
ok(/linear-gradient\(135deg, var\(--navy,#001f4d\) 0%, var\(--navy2/.test(dlg),
   '  usando o gradiente navy → navy2 dos tokens, não hex solto');
ok(/border-radius:var\(--rad-xl,28px\)/.test(dlg),
   '  e o raio do card vem do token --rad-xl');
ok(/DG_EL\('dgCancelar'\)\.hidden\s*=\s*!!opcoes\.semCancelar/.test(dlg),
   'diálogo que só informa esconde o botão Cancelar',
   'o link público mostrava "Cancelar" e "Fechar" fazendo a mesma coisa');
const insc = ler('CompassoInscricoes.html');
ok(/semCancelar:\s*true/.test(insc) && /icone:\s*'🔗'/.test(insc),
   '  e o link público usa isso, com ícone de link em vez de interrogação');
ok(/perigo:\s*true/.test(imp),
   'apagar tudo que veio da importação abre o diálogo vermelho',
   'é ação em massa sem desfazer — o mesmo tratamento da exclusão na Central');

resumo();
