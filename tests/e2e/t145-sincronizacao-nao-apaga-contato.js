/**
 * TESTE — A SINCRONIZAÇÃO POR CNPJ NÃO APAGA O CONTATO DA ESCOLA
 *
 * O QUE ORIGINOU, 04/09/2026
 *
 * Investigando por que o cadastro da FAESA ainda tinha o endereço morto da
 * Thalia, encontrei em BuscaEscola.gs:372-375:
 *
 *     if (colEmail  && externo.email) valoresLinha[colEmail  - 1] = externo.email;
 *     if (colEmails && externo.email) valoresLinha[colEmails - 1] = ...
 *
 * `externo.email` é o endereço registrado na RECEITA FEDERAL. Em escola,
 * costuma ser o do contador. E `sincronizarTodasEscolas` roda isso para as
 * 679 de uma vez.
 *
 * Ou seja: um clique trocava a base inteira de contatos — luiza, karolina,
 * cada endereço que a secretaria levou meses achando — pelo cadastro da
 * Receita. Sem aviso, sem desfazer, e com o sintoma aparecendo só semanas
 * depois em ofício quicando.
 *
 * É a REGRA Nº 1 no formato dado: destruição irreversível de informação que
 * não se recupera de lugar nenhum.
 *
 * O QUE ESTE TESTE MEDE. Que o contato preenchido sobrevive, que o vazio é
 * preenchido, e que o dado da Receita fica na coluna dele.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CNPJ_COM_CONTATO = "27.014.042/0001-38";
const CNPJ_SEM_CONTATO = "11.222.333/0001-44";

const esc = ss.insertSheet("Escolas");
esc.getRange(1, 1, 1, 5).setValues([[
  "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "E-mails (todos)", "EMAILS_RECEITA"
]]);
esc.getRange(2, 1, 2, 5).setValues([
  ["FUNDACAO DE ASSISTENCIA E EDUCACAO - FAESA", CNPJ_COM_CONTATO,
   "luiza.stefani@faesa.br", "luiza.stefani@faesa.br; karolina.caldeira@faesa.br", ""],
  ["ESCOLA SEM CONTATO", CNPJ_SEM_CONTATO, "", "", ""]
]);

/* A consulta externa é substituída: o teste é sobre o que se ESCREVE com a
   resposta, não sobre a API da Receita. */
g.consultarCNPJExterno = function () {
  return { email: "contabilidade@escritoriodocontador.com.br",
           razaoSocial: "", fantasia: "", endereco: "", numero: "",
           complemento: "", cidade: "", uf: "", bairro: "", cep: "" };
};

function linha(n) {
  return esc.getRange(n, 1, 1, 5).getValues()[0];
}

fluxo("ESCOLAS · o contato que a secretaria achou não se perde numa sincronização");
passo("escola COM contato");

g.sincronizarEscolaPorCnpj(CNPJ_COM_CONTATO, false, TOKEN);
const faesa = linha(2);

igual(faesa[2], "luiza.stefani@faesa.br",
      "o E-mail (principal) continua sendo o contato real");
ok(String(faesa[3]).indexOf("karolina.caldeira@faesa.br") > -1,
   "e o E-mails (todos) também",
   "meses de trabalho da secretaria não podem sair num clique");
ok(String(faesa[2]).indexOf("contabilidade@") === -1 &&
   String(faesa[3]).indexOf("contabilidade@") === -1,
   "o e-mail do contador NÃO entrou no lugar do contato");
igual(faesa[4], "contabilidade@escritoriodocontador.com.br",
      "mas ficou registrado na coluna da Receita — o dado não se perde, muda de lugar");

passo("escola SEM contato nenhum");

g.sincronizarEscolaPorCnpj(CNPJ_SEM_CONTATO, false, TOKEN);
const vazia = linha(3);

igual(vazia[2], "contabilidade@escritoriodocontador.com.br",
      "coluna vazia É preenchida — melhor um ponto de partida que nada");
ok(String(vazia[3]).indexOf("contabilidade@") > -1, "nas duas colunas de contato");
igual(vazia[4], "contabilidade@escritoriodocontador.com.br",
      "e a origem fica registrada também");

passo("a regra escrita no código");

const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "BuscaEscola.gs"), "utf8");
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

/* Olhar só a atribuição não distingue guardada de cega — a primeira versão
   desta asserção reprovou justamente por isso. O que importa é o que vem
   ANTES dela. */
const compacto = semComentarios.replace(/\s+/g, " ");
const alvo = "valoresLinha[colEmail - 1] = externo.email;";
const ocorrencias = compacto.split(alvo).length - 1;
igual(ocorrencias, 1, "existe uma única escrita no E-mail (principal)");
const antes = compacto.slice(Math.max(0, compacto.indexOf(alvo) - 120), compacto.indexOf(alvo));
ok(antes.indexOf('.trim()') > -1,
   "e ela só acontece se a coluna estiver vazia",
   "atribuição cega era o que apagava o contato da secretaria");

ok(/!String\(valoresLinha\[colEmail\s*-\s*1\]\s*\|\|\s*""\)\.trim\(\)/.test(semComentarios),
   "a escrita passou a exigir que a coluna esteja vazia");

ok(/colEmailReceita/.test(semComentarios),
   "e o dado da Receita tem coluna própria");

naoTestavel(
  "quantas escolas já tiveram o contato trocado antes deste conserto",
  "só a planilha de produção responde, e o histórico de versões dela é o " +
  "único lugar onde o contato antigo ainda existe. Se `sincronizarTodasEscolas` " +
  "já rodou alguma vez, a base atual pode ter e-mail de contador no lugar do RH");

resumo();
