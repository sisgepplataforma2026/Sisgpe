/**
 * t126 — MÓDULO 03 · AS FUNÇÕES QUE ERAM ENDPOINT POR ACIDENTE
 *
 * Frente A, quarta rodada, 01/09/2026.
 *
 * O QUE SOBROU depois das rodadas anteriores: oito funções públicas sem porta
 * que NENHUMA tela chama. São helpers internos — públicas por descuido, não
 * por desenho. E no Apps Script isso não é detalhe: toda função global é
 * endpoint para qualquer página do projeto, inclusive as anônimas.
 *
 * A PIOR DELAS
 *
 * `getTemplateConteudo(templateId)` abria QUALQUER Google Doc por ID e
 * devolvia o texto inteiro. A conta que executa o script tem acesso ao Drive
 * do sindicato — então era leitura de documento arbitrário para quem soubesse
 * um ID. Pior que o cadastro de escolas da rodada anterior, porque não se
 * limita a um cadastro: alcança qualquer documento.
 *
 * TRÊS TRATAMENTOS DIFERENTES, e a diferença é o ponto deste teste
 *
 * 1. PORTA DE MÓDULO — `getTemplateConteudo`. Lê dado; quem lê precisa ter o
 *    módulo.
 *
 * 2. PORTA DUPLA — `sincronizarStatusOficiosEnviados` e
 *    `invalidarCacheTemplatesOficios`. São ferramentas que se rodam do EDITOR,
 *    onde não existe token. Fechar só com token tiraria o único jeito de
 *    usá-las — trocaria um buraco por uma ferramenta inalcançável.
 *
 * 3. PRIVADAS — o caminho legado de PDF por template e as duplicatas do
 *    painel. Não são chamadas por ninguém e não precisam ser endpoint. Virar
 *    privada fecha a porta SEM remover código: é rename, reversível trocando
 *    o sufixo.
 *
 * SOBRE NÃO REMOVER: os cinco passos da REGRA Nº 1 foram rodados — cabeçalho,
 * Code.gs e rotas, gatilhos, git log e grep no projeto inteiro. Todos deram
 * "sem chamador". Mesmo assim ficam: a regra manda, na dúvida entre remover e
 * manter, manter e documentar como legado. Remoção só com pedido explícito, em
 * commit separado.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const COM_DOCS = b.logar(g, "wanderson");
const SEM_DOCS = b.logar(g, "rogerio");

function tentar(fn) {
  try { fn(); return { passou: true, msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

b.fluxo("MÓDULO 03 · ler documento arbitrário exige o módulo");

b.passo("1. A PIOR — getTemplateConteudo abria qualquer Doc por ID");
/* A conta do script alcança o Drive inteiro do sindicato. Sem porta, bastava
   saber um ID para ler o texto de qualquer documento. */
const semSessao = tentar(() => g.getTemplateConteudo("qualquer-id", ""));
b.ok(!semSessao.passou, "sem sessão é barrado",
  semSessao.passou ? "PASSOU — leitura de documento arbitrário aberta"
                   : semSessao.msg.substring(0, 44));

const semModulo = tentar(() => g.getTemplateConteudo("qualquer-id", SEM_DOCS));
b.ok(!semModulo.passou, "e quem não tem o módulo Documentos também");

b.passo("2. quem tem o módulo passa da porta");
/* Passa da PORTA — o que acontece depois é problema do ID, não da permissão.
   A distinção importa: se o teste exigisse sucesso, mediria o DocumentApp do
   emulador em vez da trava. */
const comModulo = tentar(() => g.getTemplateConteudo("id-inexistente", COM_DOCS));
b.ok(
  comModulo.passou || !/acesso ao m[óo]dulo|sess[ãa]o/i.test(comModulo.msg),
  "a recusa deixa de ser de permissão",
  comModulo.passou ? "passou" : comModulo.msg.substring(0, 44)
);

b.fluxo("MÓDULO 03 · ferramenta de editor precisa de porta DUPLA");

b.passo("3. anônimo é barrado nas duas");
g.__usuarioAtivoEmail = "";
[["sincronizarStatusOficiosEnviados", () => g.sincronizarStatusOficiosEnviados("")],
 ["invalidarCacheTemplatesOficios",   () => g.invalidarCacheTemplatesOficios("x", "")]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(!r.passou, "anônimo não roda: " + par[0],
    r.passou ? "PASSOU — escreve na planilha sem checagem" : r.msg.substring(0, 40));
});

b.passo("4. E A METADE QUE IMPORTA — o dono roda do editor, sem token");
/* Sem esta metade a correção viraria ferramenta inalcançável: estas funções
   não têm tela, só o editor as executa, e lá não existe token de sessão. */
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
[["sincronizarStatusOficiosEnviados", () => g.sincronizarStatusOficiosEnviados("")],
 ["invalidarCacheTemplatesOficios",   () => g.invalidarCacheTemplatesOficios("x", "")]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(r.passou, "o dono roda pelo editor: " + par[0], r.msg.substring(0, 40));
});
g.__usuarioAtivoEmail = "";

b.fluxo("MÓDULO 03 · o caminho legado de PDF saiu da superfície");

b.passo("5. as legadas viraram privadas — não são mais endpoint");
/* Rename, não remoção: o código continua ali e volta trocando o sufixo. */
["gerarPDFOficio", "gerarPDFOficioLivre", "gerarPDFUniversal",
 "dashboardResumo", "dashboardGraficos"].forEach(function (nome) {
  b.ok(typeof g[nome] !== "function",
    "não existe mais como global pública: " + nome,
    typeof g[nome] === "function" ? "AINDA É ENDPOINT" : "privada");
});

b.passo("6. mas o código continua lá, com o sufixo");
["gerarPDFOficio_", "gerarPDFOficioLivre_", "gerarPDFUniversal_",
 "dashboardResumo_", "dashboardGraficos_"].forEach(function (nome) {
  b.ok(typeof g[nome] === "function", "existe: " + nome);
});

b.passo("7. E O QUE NÃO PODIA QUEBRAR — quem usava gerarPDFUniversal");
/* Ela NÃO é legado: o TaxaAssistencial.gs a chama em dois pontos. Renomear
   sem atualizar os chamadores deixaria a taxa assistencial sem gerar PDF —
   trocaria um risco de segurança por uma função quebrada. */
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const taxa = fs.readFileSync(path.join(RAIZ, "TaxaAssistencial.gs"), "utf8");
b.igual((taxa.match(/gerarPDFUniversal_\(/g) || []).length, 2,
  "as duas chamadas do TaxaAssistencial foram atualizadas");
b.igual((taxa.match(/[^_]gerarPDFUniversal\(/g) || []).length, 0,
  "e nenhuma chamada antiga sobrou");

b.passo("8. nenhuma chamada órfã no projeto inteiro");
["gerarPDFOficio", "gerarPDFOficioLivre", "gerarPDFUniversal",
 "dashboardResumo", "dashboardGraficos"].forEach(function (nome) {
  const arquivos = fs.readdirSync(RAIZ).filter(f => /\.(gs|html)$/.test(f));
  const orfas = arquivos.filter(function (arq) {
    const src = fs.readFileSync(path.join(RAIZ, arq), "utf8");
    /* Chamada é `nome(`; a versão privada tem `_` antes do parêntese. Comentário
       não conta — por isso a linha é ignorada quando começa com // ou tem o
       texto dentro de bloco de nota. */
    return src.split("\n").some(function (linha) {
      const t = linha.trim();
      if (t.indexOf("//") === 0 || t.indexOf("*") === 0) return false;
      return new RegExp("[^_a-zA-Z]" + nome + "\\(").test(linha);
    });
  });
  b.igual(orfas.length, 0, "sem chamada antiga de " + nome, orfas.join(", "));
});

b.naoTestavel(
  "se as legadas devem ser REMOVIDAS",
  "os cinco passos da REGRA Nº 1 deram 'sem chamador', mas a regra manda " +
  "manter e documentar na dúvida. Remoção só com pedido explícito do " +
  "usuário, em commit separado — e o cabeçalho de Oficios.gs agora explica " +
  "o que são e por que ficaram"
);

b.resumo();
