/**
 * TESTE — O CADASTRO DE ESCOLAS VIVE NA ABA "Controle"
 *
 * 23/09/2026, você: "acho que deve buscar da aba Controle". Estava certo, e
 * isso explica um sintoma que eu vinha atribuindo a dado faltando.
 *
 * O QUE ACONTECIA. Na planilha de produção o cadastro das escolas está na aba
 * **Controle**, com as colunas "Escola (Razão Social)", "CNPJ", "Unidade" e
 * "Cidade" — os mesmos nomes que o módulo de Bolsas já procura. Só que ele
 * procurava exclusivamente numa aba chamada "Escolas". Sem ela, a busca
 * devolve vazio SEMPRE: a solicitação nasce sem CNPJ, a observação recebe
 * "Escola não localizada no cadastro de escolas" e o certificado sai sem a
 * mantenedora e sem o CNPJ. Nenhum erro em lugar nenhum — "não achei" é
 * resposta válida, e é isso que torna a falha difícil de ver.
 *
 * Foi exatamente o que apareceu na prévia do Bernardo: a frase pulava de
 * "empregado da instituição UVV - VILA VELHA" direto para "encontra-se".
 *
 * Outros módulos (TaxaAssistencial, BuscaEscola, RelatoriosOficios) já caíam
 * para "Controle". O de Bolsas ficou de fora.
 *
 * NÃO TESTADO pela REGRA Nº -1: quais abas existem na planilha de produção.
 * Isso só o usuário confirma — aqui se prova que, existindo só a Controle, o
 * cadastro é encontrado.
 */
const b = require("./base");

const { g } = b.subir({});
b.seedUsuarios(g);
b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

b.fluxo("BOLSAS · O cadastro de escolas, quando só existe a aba Controle");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* A aba Controle com os cabeçalhos REAIS da planilha de produção, lidos do
   metadado do Drive em 23/09/2026 — não inventados. */
const CAB_CONTROLE = [
  "Status", "Número do Ofício", "TIPO", "Unidade", "Escola (Razão Social)",
  "CNPJ", "E-mail (principal)", "E-mails (todos)", "Telefone 1", "Cidade"
];
let shCtrl = ss.getSheetByName("Controle");
if (!shCtrl) {
  shCtrl = ss.insertSheet("Controle");
  shCtrl.appendRow(CAB_CONTROLE);
}
shCtrl.appendRow([
  "OK", "001", "ESCOLA", "MONTE ALVO", "DAMASIO CAMPANA EDUCACAO LTDA",
  "56.169.513/0001-85", "rh@monte.com", "rh@monte.com", "(27) 3065-2526", "Vitória - ES"
]);

b.passo("1. sem a aba 'Escolas', o cadastro é achado na Controle");
b.ok(!ss.getSheetByName("Escolas"),
  "a aba 'Escolas' não existe nesta planilha — é o caso da produção");

const achada = g.buscarEscolaPorNome_("DAMASIO CAMPANA EDUCACAO LTDA");
b.ok(!!achada, "a busca respondeu");
b.igual(String(achada.cnpj || "").replace(/\D/g, ""), "56169513000185",
  "com o CNPJ da escola — antes vinha vazio, sempre",
  JSON.stringify(achada));
b.igual(String(achada.unidade || ""), "MONTE ALVO",
  "e a unidade, que é o nome fantasia no papel");

b.passo("2. o certificado deixa de sair sem a mantenedora e sem o CNPJ");
/* É este o efeito que você viu na prévia do Bernardo. */
const html = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-2026-1", codigo: "VAL-1", percentual: 100,
  dataEmissao: new Date(2026, 8, 23),
  reg: {
    NOME_SOLICITANTE: "JOANA DA SILVA VELTEN MARQUES",
    NOME_BENEFICIARIO: "ANA CECILIA MARQUES VELTEN",
    TIPO_BENEFICIARIO: "FILHO", CPF_SOLICITANTE: "52998224725",
    ESCOLA_SELECIONADA: "DAMASIO CAMPANA EDUCACAO LTDA",
    MODALIDADE: "EDUCACAO_INFANTIL", CURSO: "Infantil",
    PERIODO_REFERENCIA: "2026"
  }
});
b.ok(html.indexOf("56.169.513/0001-85") > -1,
  "o CNPJ aparece no documento, formatado",
  (html.match(/CNPJ[^<]*/) || ["(não achou)"])[0]);
b.ok(html.indexOf("inscrita no CNPJ: sob nº") > -1,
  "com a oração inteira, como no papel do sindicato");

b.passo("3. a lista de escolas do portal também enxerga a Controle");
/* Sem isto, o campo de escola do formulário público nasce vazio — e a pessoa
   digita o nome à mão, que é como a solicitação acaba sem CNPJ. */
const lista = g.listarEscolasVoucher_();
b.ok(Array.isArray(lista) && lista.length > 0,
  "a lista vem preenchida", (lista || []).length + " escola(s)");
b.ok(lista.some(function (e) { return /DAMASIO CAMPANA/.test(String(e.escola || "")); }),
  "com a escola da Controle entre elas",
  lista.map(function (e) { return e.escola; }).slice(0, 3).join(" | "));

b.passo("4. onde existir aba dedicada, ela ganha da Controle");
/* CONTRAPROVA. Se a Controle vencesse, uma planilha que tem as duas passaria
   a ler o cadastro errado — e o defeito trocaria de lado em vez de sumir. */
const shEsc = ss.insertSheet("Escolas");
shEsc.appendRow(["NomeEscola", "Unidade", "CNPJ", "Municipio"]);
shEsc.appendRow(["DAMASIO CAMPANA EDUCACAO LTDA", "OUTRA UNIDADE", "01936248000121", "Serra"]);

const daAbaDedicada = g.buscarEscolaPorNome_("DAMASIO CAMPANA EDUCACAO LTDA");
b.igual(String(daAbaDedicada.cnpj || "").replace(/\D/g, ""), "01936248000121",
  "com as duas abas, vale a 'Escolas'",
  JSON.stringify(daAbaDedicada));
b.igual(String(daAbaDedicada.unidade || ""), "OUTRA UNIDADE",
  "e todos os campos vêm dela, não misturados");

b.naoTestavel("quais abas existem na planilha de produção",
  "o conector do Drive não lê o conteúdo dessa planilha de forma confiável — " +
  "roteiro: abrir a SISGEP - ATIVA e conferir se há uma aba 'Escolas' além da 'Controle'");
b.resumo();
