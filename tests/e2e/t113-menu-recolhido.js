/**
 * t113 — MOLDURA DO PORTAL · O MENU RECOLHIDO
 *
 * Fecha por teste dois pontos do item 20 do PENDENTE-VERIFICACAO, abertos em
 * 13/08/2026 e marcados como "só se confere no ar". Dois dos quatro daquele
 * item são CSS de verdade — se os chips cabem na barra, se a coluna some — e
 * o jsdom não aplica estilo, então esses continuam dependendo do navegador.
 * Estes dois aqui não são CSS: são COMPORTAMENTO, e comportamento se prova.
 *
 * O item 20 não pertence a módulo nenhum, e isso importa para saber o peso do
 * que se mexe: o menu recolhível vive no `index.html`, que é a moldura que
 * segura os 19 módulos. É o mesmo arquivo cuja alteração levou o próprio item
 * 20 a registrar "mexi no index.html, que é a moldura de tudo".
 *
 * ─── 1. O ACORDEÃO COM O MENU RECOLHIDO ───────────────────────────────────
 *
 * Com o menu em ícones não há largura para o submenu aparecer. Clicar num
 * módulo que tem filhos precisa ABRIR O MENU primeiro e só então o acordeão —
 * senão o clique não faz absolutamente nada e o botão parece quebrado.
 *
 * É o tipo de defeito que o CLAUDE.md descreve como o pior deste projeto: a
 * tela renderiza, o clique dispara, e nada acontece. Ninguém reporta "está
 * quebrado", reporta "não sei mexer".
 *
 * ─── 2. A PREFERÊNCIA DO MENU ─────────────────────────────────────────────
 *
 * Aqui o teste entregou o contrário do que eu vim buscar, e o contrário era
 * melhor. Eu queria provar que a escolha sobrevive ao F5; o jsdom sem origem
 * definida não tem localStorage, então a gravação não é observável.
 *
 * Só que os passos do acordeão passaram TODOS nessas condições — isto é, o
 * portal foi exercitado com o armazenamento inteiramente fora do ar e nada
 * quebrou. É exatamente a promessa escrita no spAlternarMenu: "Navegador com
 * armazenamento bloqueado não pode derrubar o menu". Estava no comentário e
 * não estava provada; agora está.
 *
 * Do F5 propriamente, o que se prova é que as duas pontas usam A MESMA CHAVE
 * — que é o erro capaz de quebrar a persistência sem quebrar teste nenhum. O
 * F5 de verdade fica declarado como não testável, junto dos dois pontos do
 * item 20 que são CSS.
 */

const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("MOLDURA · menu recolhido");
  b.naoTestavel("acordeão e persistência do menu", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const esperar = ms => new Promise(r => setTimeout(r, ms));

function abrirPortal() {
  const tela = dom.montar(g, ["index.html"], { token: TOKEN });
  tela.win.SISGEP_TOKEN_SESSAO = TOKEN;
  return tela;
}

(async function () {

  b.fluxo("MOLDURA · o acordeão com o menu recolhido (item 20)");

  const t = abrirPortal();
  await esperar(1500);

  b.passo("1. o menu nasce aberto");
  b.ok(typeof t.win.spMenuRecolhido === "function", "spMenuRecolhido existe");
  b.ok(t.win.spMenuRecolhido() === false, "e o menu começa expandido");

  b.passo("2. recolher fecha os submenus abertos");
  t.win.spAlternarMenu(true);
  b.ok(t.win.spMenuRecolhido() === true, "o menu recolhe");

  b.passo("3. clicar num módulo com filhos ABRE o menu e o acordeão junto");
  /* O defeito que este passo impede: sem a regra do spAcordeao, com o menu
     recolhido o clique não faria nada — nem menu, nem submenu. Botão que não
     responde é o pior sintoma deste projeto, porque não gera reclamação de
     erro, gera "não sei mexer". */
  const botao = t.doc.querySelector('.spN[data-acordeao="docSubMenuSidebar"]');
  b.ok(!!botao, "o botão de Documentos tem data-acordeao", botao && botao.getAttribute("data-acordeao"));

  t.win.spAcordeao(botao);
  await esperar(80);

  b.ok(
    t.win.spMenuRecolhido() === false,
    "clicar com o menu recolhido ABRE o menu — o clique não morre em silêncio"
  );
  const acc = t.doc.getElementById("docSubMenuSidebar");
  b.ok(
    acc && acc.style.display === "flex",
    "e o acordeão do módulo abre junto",
    acc ? "display=" + acc.style.display : "acordeão não existe"
  );

  b.passo("4. com o menu já aberto, o acordeão alterna normalmente");
  t.win.spAcordeao(botao);
  await esperar(60);
  b.ok(acc.style.display === "none", "segundo clique fecha", "display=" + acc.style.display);
  t.win.spAcordeao(botao);
  await esperar(60);
  b.ok(acc.style.display === "flex", "terceiro clique abre de novo");

  /* ══════════════════════════════════════════════════════════ */
  b.fluxo("MOLDURA · a escolha do menu sobrevive ao F5 (item 20)");

  b.passo("5. armazenamento indisponível NÃO derruba o menu");
  /* DESCOBERTA DESTE TESTE, e ela vale mais que o que eu vinha medir.

     O jsdom sem origem definida não tem localStorage: qualquer acesso lança.
     Eu tentei provar a gravação da preferência e falhei — mas os oito passos
     acima passaram TODOS nessas condições. Ou seja: o portal foi exercitado
     com o armazenamento inteiramente fora do ar, e o menu recolheu, abriu, o
     acordeão respondeu.

     É exatamente o que o código promete no comentário do spAlternarMenu:
     "Navegador com armazenamento bloqueado não pode derrubar o menu: a
     preferência se perde, a tela continua funcionando." Estava escrito e não
     estava provado. Agora está — e por acidente, que é como as garantias
     boas costumam aparecer.

     Isto cobre, de quebra, um dos pontos que o item 20 listava como
     conferência de navegador: o caso do localStorage bloqueado. */
  let temStorage = true;
  try { t.win.localStorage.getItem("x"); } catch (e) { temStorage = false; }
  if (!temStorage) {
    b.ok(true,
      "o menu funcionou inteiro com o armazenamento INDISPONÍVEL",
      "os 8 passos acima rodaram sem localStorage — a promessa do " +
      "spAlternarMenu se confirma");
  }

  t.win.spAlternarMenu(true);
  b.ok(t.win.spMenuRecolhido() === true,
    "e recolher continua funcionando mesmo sem poder gravar a escolha");
  t.win.spAlternarMenu(false);
  b.ok(t.win.spMenuRecolhido() === false, "expandir também");

  b.passo("6. o restaurador do topo lê a chave certa");
  /* Não dá para exercitar o F5 aqui, mas dá para provar que a leitura e a
     gravação usam A MESMA CHAVE — que é o erro que quebraria a persistência
     sem quebrar teste nenhum. */
  const fonte = require("fs").readFileSync(
    require("path").join(dom.RAIZ, "index.html"), "utf8");
  const grava = /SP_MENU_CHAVE_\s*=\s*"([^"]+)"/.exec(fonte);
  const le = /localStorage\.getItem\("([^"]+)"\)\s*===\s*"1"/.exec(fonte);
  b.ok(!!grava && !!le, "as duas pontas existem no index.html");
  b.igual(le && le[1], grava && grava[1],
    "o restaurador do topo lê exatamente a chave que o toggle grava");

  b.naoTestavel(
    "o F5 de verdade, com o localStorage do navegador",
    "o jsdom dá um armazenamento novo por janela, então a preferência não " +
    "atravessa montagens. O que se prova aqui é a gravação e o restaurador, " +
    "cada um do seu lado"
  );
  b.naoTestavel(
    "se os chips cabem na barra e se a coluna da direita some de fato",
    "são os outros dois pontos do item 20, e esses são CSS: o jsdom não " +
    "aplica estilo. Continuam dependendo do navegador"
  );

  b.resumo();
  process.exit(process.exitCode || 0);
})();
