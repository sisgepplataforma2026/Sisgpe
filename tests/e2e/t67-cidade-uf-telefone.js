/**
 * TESTE — CIDADE, UF E TELEFONE DEPOIS DA PADRONIZAÇÃO DAS 679 ESCOLAS
 *
 * O QUE ORIGINOU
 *
 * A Etapa C da padronização (11/08/2026) rodou na base real e mexeu em 1760
 * células: 648 UFs preenchidas a partir da cidade, 99 telefones
 * normalizados, 29 CEPs. A decisão do usuário foi a opção A — `Alegre - ES`
 * vira `Cidade="Alegre"` + `UF="ES"`, cada dado no seu campo.
 *
 * Ficou aberto em docs/PENDENTE-VERIFICACAO.md, desde então, este item:
 *
 *     "Formulário de ofício — CIDADE/UF deve mostrar cidade e UF separados,
 *      telefone no formato novo"
 *
 * UMA CORREÇÃO NO PRÓPRIO ITEM, que a medição mostrou. Ele mistura duas
 * telas. O formulário de ofício **não tem campo de telefone** — nem o
 * backend que o alimenta (`listarEscolasOficio_interno_`) devolve telefone.
 * Quem mostra telefone é o Cadastro de Escolas. Então o item se separa:
 *
 *     CIDADE / UF  → formulário de ofício   (parte 2 deste teste)
 *     TELEFONE     → cadastro de escolas    (parte 3 deste teste)
 *
 * Deixar escrito importa: item que pede para conferir um campo inexistente
 * nunca fecha, e fica dando a impressão de pendência viva.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO — a cadeia inteira, da célula à tela:
 *
 *     planilha Escolas → listarEscolas / listarEscolasOficio_interno_
 *                      → normalizarEscola → o campo preenchido na tela
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: como isso
 * aparece com os 679 cadastros reais. Aqui a base é semeada — a forma do
 * dado é a real (mesmos nomes de coluna, vindos das constantes de
 * Escolas.gs), o volume não é. E aparência não se mede em jsdom.
 *
 * MUTAÇÕES QUE ESTE TESTE MATA (rodadas em 19/08/2026, uma a uma):
 *
 *   1. `join(" / ")` → `join("")` em BuscaEscola.gs .............. 2 falhas
 *   2. tirar `.filter(Boolean)` da mesma junção ................... 1 falha
 *      (é a que produz "Serra / " — a contraprova do passo 4)
 *   3. alias `obj.cidade` apontando para a coluna Bairro .......... 3 falhas
 *   4. `preencherForm` lendo chave inexistente de telefone ........ 1 falha
 *   5. apagar a 3ª `normalizarEscola` (a 2ª passa a vencer) ....... 3 falhas
 *
 * A mutação 5 ensinou algo que vale escrito: mesmo com a normalização
 * quebrada, `#cidadeUfReceita` continuou preenchido — porque
 * `preencherCompat` tem uma reserva, `escola.cidadeUf || [cidade,uf].join(" / ")`.
 * Quem denunciou a quebra foi a LISTA A-Z, que não tem reserva. Duas
 * asserções sobre o mesmo dado em lugares diferentes não é redundância.
 *
 * E uma nota de método: a primeira tentativa da mutação 5 recortou o bloco
 * pelas linhas erradas e deixou um `}` órfão. O teste não reprovou — ele
 * ESTOUROU com erro de sintaxe, escondendo todo o resto. Mutação que quebra
 * o arquivo não prova nada sobre o teste; foi refeita no lugar certo.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("ESCOLAS · Cidade e UF separadas, telefone no formato novo");

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* Os nomes das colunas NÃO são inventados: são os mesmos das constantes de
   Escolas.gs (COL_NOME_ESCOLA, COL_CIDADE, COL_UF, COL_TELEFONE...). Meu
   primeiro probe usou nomes aproximados, a leitura devolveu 0 escolas e eu
   quase reportei o código como quebrado — quando o errado era o seed. */
const CAB = ["EscolaID", "Unidade", "Escola (Razão Social)", "CNPJ",
             "E-mail (principal)", "E-mails (todos)", "Telefone 1", "Telefone 2",
             "Cidade", "UF", "Endereço", "Número", "Bairro", "Complemento", "CEP",
             "NOME_FANTASIA", "SITUACAO_CADASTRAL"];
let sh = ss.getSheetByName("Escolas");
if (sh) ss.deleteSheet(sh);
sh = ss.insertSheet("Escolas");
sh.getRange(1, 1, 1, CAB.length).setValues([CAB]);

function add(v) {
  const l = CAB.map(c => (v[c] !== undefined ? v[c] : ""));
  sh.getRange(sh.getLastRow() + 1, 1, 1, l.length).setValues([l]);
}

/* A escola no estado DEPOIS da padronização: cidade e UF em colunas
   separadas, telefone com máscara. */
add({ "EscolaID": "ESC-0001", "Escola (Razão Social)": "COLEGIO EXEMPLO LTDA",
      "CNPJ": "36136001000105", "E-mail (principal)": "diretoria@exemplo.com",
      "Telefone 1": "(27) 3222-1010", "Telefone 2": "(27) 99999-8888",
      "Cidade": "Vitória", "UF": "ES", "Endereço": "Rua das Palmeiras",
      "Número": "100", "Bairro": "Centro", "CEP": "29010-000",
      "SITUACAO_CADASTRAL": "ATIVA" });

/* A escola que a padronização deixou de propósito sem UF — é 1 das 679, e
   o relatório da Etapa C registrou por quê: extrair daria UF inventada.
   Serve de contraprova: a tela não pode inventar UF nem escrever " / ". */
add({ "EscolaID": "ESC-0002", "Escola (Razão Social)": "ESCOLA SEM UF",
      "CNPJ": "11222333000181", "Cidade": "Serra", "UF": "",
      "Telefone 1": "27999998888", "SITUACAO_CADASTRAL": "ATIVA" });

/* ═══════════════════════════════════════════════════════════
   1. O BACKEND — cada dado no seu campo
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const lista = g.listarEscolas(TOKEN);
b.igual(lista.length, 2, "a listagem lê as duas escolas da base");

const exemplo = lista.filter(e => e.NomeEscola === "COLEGIO EXEMPLO LTDA")[0] || {};
b.igual(exemplo.cidade, "Vitória", "a cidade vem sozinha, sem sufixo de UF",
  "era esse o estado anterior: 'Alegre - ES' tudo numa célula só");
b.igual(exemplo.uf, "ES", "e a UF vem no campo dela");
b.ok(String(exemplo.cidade).indexOf("/") === -1 && String(exemplo.cidade).indexOf("-") === -1,
  "a cidade não carrega separador nenhum", String(exemplo.cidade));
b.igual(exemplo.telefone, "(27) 3222-1010",
  "o telefone chega no formato novo, com máscara");

b.passo("2");
/* Os apelidos existem porque as telas leem com nomes diferentes. Se um
   sumir, uma tela para de mostrar cidade sem ninguém perceber. */
b.igual(exemplo.Municipio, "Vitória", "o apelido Municipio aponta para a mesma cidade");
b.igual(exemplo.UF, "ES", "e o apelido UF para a mesma UF");
b.igual(exemplo.Telefone, "(27) 3222-1010", "idem o apelido Telefone");

b.passo("3");
/* A junção para exibição — feita na leitura de ofício, não gravada. */
g.CacheService.getScriptCache().remove("sisgep_escolas_v1");
const paraOficio = g.listarEscolasOficio_interno_();
const oExemplo = paraOficio.filter(e => e.escola === "COLEGIO EXEMPLO LTDA")[0] || {};
b.igual(oExemplo.cidadeUf, "Vitória / ES",
  "a leitura de ofício monta 'Cidade / UF' para exibir",
  "junta na hora de mostrar; na planilha continuam separadas");
b.igual(oExemplo.cidade, "Vitória", "e continua entregando a cidade separada");
b.igual(oExemplo.uf, "ES", "e a UF separada");
b.ok(oExemplo.enderecoCompleto.indexOf("Vitória / ES") > -1,
  "o endereço completo usa a mesma junção", oExemplo.enderecoCompleto);

b.passo("4");
/* CONTRAPROVA — sem UF, nada de barra solta. "Serra / " num ofício é erro
   visível para quem recebe. */
const semUf = paraOficio.filter(e => e.escola === "ESCOLA SEM UF")[0] || {};
b.igual(semUf.cidadeUf, "Serra",
  "escola sem UF sai só com a cidade, sem barra pendurada",
  "'Serra / ' sairia impresso no ofício");
b.igual(semUf.uf, "", "e a UF continua vazia, sem ser inventada");

b.passo("5");
/* O telefone NÃO é campo da leitura de ofício. Isto é a asserção que
   corrige o item pendente: não é defeito, é escopo. */
b.igual(oExemplo.telefone, undefined,
  "a leitura de ofício não devolve telefone — e não deve",
  "o formulário de ofício não tem campo de telefone; quem mostra é o Cadastro de Escolas");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("As duas telas", "jsdom não instalado");
  b.resumo();
  process.exit(0);
}

/* ═══════════════════════════════════════════════════════════
   2. O FORMULÁRIO DE OFÍCIO — o campo CIDADE / UF
   ═══════════════════════════════════════════════════════════ */
(async function () {
  b.fluxo("OFÍCIO · Escolher a escola preenche CIDADE / UF");

  const tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
  const doc = tela.doc, win = tela.win;
  doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));
  await tela.assentar(150);

  b.passo("6");
  const campo = doc.getElementById("cidadeUfReceita");
  b.ok(!!campo, "o campo CIDADE / UF existe no formulário");
  b.igual(campo.value, "", "e começa vazio");

  b.passo("7");
  b.ok(typeof win.carregarEscolas === "function", "a tela sabe carregar a base");
  win.carregarEscolas();
  await tela.assentar(150);

  const caixa = doc.getElementById("listaEscolasRecentesOficio");
  b.ok(!!caixa, "a lista A-Z de escolas existe");
  const botoes = caixa.querySelectorAll(".escola-recente-btn");
  b.igual(botoes.length, 2, "e desenhou as duas escolas",
    (caixa.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120));
  b.ok((caixa.textContent || "").indexOf("Vitória / ES") > -1,
    "já mostrando cidade e UF na própria lista",
    (caixa.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120));

  b.passo("8");
  /* Clica pelo mesmo caminho da pessoa: o botão da lista. Não chamando a
     função por dentro — o que se quer medir é a tela inteira respondendo. */
  const alvo = Array.from(botoes).filter(function (bt) {
    return (bt.textContent || "").indexOf("COLEGIO EXEMPLO") > -1;
  })[0];
  b.ok(!!alvo, "o botão da escola do teste está na lista");
  if (alvo) { alvo.click(); await tela.assentar(120); }

  b.igual(campo.value, "Vitória / ES",
    "clicar na escola PREENCHE o campo com cidade e UF separadas por barra",
    "é a asserção que o item pendente pedia desde 11/08");
  b.igual((doc.getElementById("cnpj") || {}).value, "36136001000105",
    "e o CNPJ junto, provando que foi a escola certa");

  b.passo("9");
  /* CONTRAPROVA na tela: a escola sem UF não pode terminar com barra. */
  const outro = Array.from(botoes).filter(function (bt) {
    return (bt.textContent || "").indexOf("ESCOLA SEM UF") > -1;
  })[0];
  if (outro) { outro.click(); await tela.assentar(120); }
  b.igual(campo.value, "Serra",
    "escola sem UF preenche só a cidade, sem barra sobrando",
    "'Serra / ' no campo viraria 'Serra / ' no ofício");

  b.passo("10");
  /* A DUPLICAÇÃO QUE PODE DESFAZER TUDO ISTO, deixada registrada.
   *
   * `normalizarEscola` está declarada TRÊS vezes no mesmo escopo de
   * OficiosScripts.html (linhas 122, 133 e 146). Declaração de função
   * sobe e a ÚLTIMA vence — e só a última entende `Municipio`, `cidadeUf`
   * e sabe separar cidade de UF. As duas primeiras são inalcançáveis.
   *
   * Não removo aqui: pela REGRA Nº 1, remoção é decisão do usuário e vai
   * em commit separado. Mas fica a trava — apagar a cópia errada
   * reprova este passo em vez de quebrar a tela em silêncio. */
  const fonte = require("fs").readFileSync(
    require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
  const decls = (fonte.match(/^\s*function normalizarEscola\s*\(/gm) || []).length;
  b.ok(decls >= 1, "normalizarEscola existe", decls + " declaração(ões) no arquivo");
  const ultima = fonte.slice(fonte.lastIndexOf("function normalizarEscola"));
  const corpoUltima = ultima.slice(0, ultima.indexOf("\n  }") + 4);
  b.ok(/cidadeUf/.test(corpoUltima),
    "e a ÚLTIMA declaração — a que vale — entende cidadeUf",
    decls + " cópias no mesmo escopo; a última vence por hoisting");
  b.ok(/Municipio/.test(corpoUltima),
    "e entende o apelido Municipio que o backend devolve",
    "sem isto, cidade chega vazia do servidor");

  /* ═══════════════════════════════════════════════════════════
     3. O CADASTRO DE ESCOLAS — onde o telefone realmente aparece
     ═══════════════════════════════════════════════════════════ */
  b.fluxo("CADASTRO · Cidade, UF e telefone em campos próprios");

  const ce = dom.montar(g, ["CadastroEscolas.html"], { token: TOKEN });
  const cdoc = ce.doc, cwin = ce.win;
  cdoc.dispatchEvent(new cwin.Event("DOMContentLoaded", { bubbles: true }));

  b.passo("11");
  b.ok(typeof cwin.initCadastroEscolas === "function",
    "o cadastro tem função de início exposta",
    "sem isto a tela abre e nada responde — REGRA Nº 0");
  cwin.initCadastroEscolas();
  await ce.assentar(200);

  const corpo = cdoc.getElementById("ceTabelaBody");
  b.ok(!!corpo, "a tabela do cadastro existe");
  const textoLista = (corpo.textContent || "").replace(/\s+/g, " ").trim();
  b.ok(textoLista.indexOf("Vitória / ES") > -1,
    "a lista mostra cidade e UF juntas para leitura", textoLista.slice(0, 120));
  b.ok(textoLista.indexOf("Serra / ") === -1,
    "e a escola sem UF aparece sem barra pendurada",
    "aqui a junção é outra função — precisa da mesma contraprova");

  b.passo("12");
  b.ok(typeof cwin.ceAbrirEscolaPorChave === "function",
    "dá para abrir a ficha pelo EscolaID");
  cwin.ceAbrirEscolaPorChave("ESC-0001");
  await ce.assentar(150);

  b.igual((cdoc.getElementById("ceNomeEscola") || {}).value, "COLEGIO EXEMPLO LTDA",
    "abriu a ficha da escola certa");
  b.igual((cdoc.getElementById("ceMunicipio") || {}).value, "Vitória",
    "a cidade no campo de cidade");
  b.igual((cdoc.getElementById("ceUf") || {}).value, "ES",
    "e a UF no campo de UF — separadas, como a Etapa C decidiu");
  b.igual((cdoc.getElementById("ceTelefone") || {}).value, "(27) 3222-1010",
    "o TELEFONE no formato novo",
    "esta é a outra metade do item pendente — e ela mora nesta tela, não no ofício");
  b.igual((cdoc.getElementById("ceWhatsapp") || {}).value, "(27) 99999-8888",
    "e o segundo telefone no campo dele");
  b.igual((cdoc.getElementById("ceCep") || {}).value, "29010-000",
    "com o CEP normalizado junto");

  b.naoTestavel("Como isso aparece com os 679 cadastros reais",
    "a base aqui é semeada — a forma do dado é a real, o volume não; e jsdom não aplica CSS");

  b.resumo();
})();
