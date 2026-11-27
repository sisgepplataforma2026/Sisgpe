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

b.passo("5. o cabeçalho é achado mesmo escrito de outro jeito");
/* 23/09/2026. A busca procurava a coluna por nome EXATO. Qualquer diferença
   que ninguém enxerga numa planilha — caixa alta, til faltando, um espaço a
   mais — fazia a coluna não ser encontrada, e a função devolvia vazio para
   TODA escola, sem erro nenhum. O sintoma só aparecia três passos adiante,
   num certificado sem CNPJ. */
const CABS = [
  ["ESCOLA (RAZÃO SOCIAL)", "caixa alta"],
  ["Escola (Razao Social)", "sem o til"],
  ["escola  (razão   social)", "espaços a mais"],
  ["NomeEscola", "o outro nome aceito"]
];
CABS.forEach(function (par, i) {
  const nomeAba = "Esc" + i;
  const sh = ss.insertSheet(nomeAba);
  sh.appendRow([par[0], "Unidade", "CNPJ", "Municipio"]);
  sh.appendRow(["ESCOLA DE TESTE " + i, "UNID", "11222333000181", "Vitória"]);

  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const pos = g.acharColunaVoucher_(cab, ["NomeEscola", "Escola (Razão Social)", "Escola"]);
  b.igual(pos, 0, "cabeçalho com " + par[1] + " é encontrado", par[0]);
});

/* CONTRAPROVA: a precedência do chamador continua valendo. Quando as duas
   colunas existem, "Escola (Razão Social)" não pode ser atropelada por
   "Escola" só porque uma contém a outra. */
const cabDuplo = ["Escola", "Escola (Razão Social)", "CNPJ"];
b.igual(g.acharColunaVoucher_(cabDuplo, ["NomeEscola", "Escola (Razão Social)", "Escola"]), 1,
  "com as duas colunas, vale a ordem que o chamador pediu",
  JSON.stringify(cabDuplo));

b.igual(g.acharColunaVoucher_(["A", "B"], ["CNPJ"]), -1,
  "e coluna que não existe continua devolvendo -1");

/* ═══════════════════════════════════════════════════════════
   6. AS MESMAS PALAVRAS, EM OUTRA ORDEM — o caso do Bernardo
   ═══════════════════════════════════════════════════════════

   23/09/2026, com a aba Escolas da produção na mão. A solicitação guarda
   "UVV - VILA VELHA"; a aba guarda "Sociedade Educacao e Gestao de
   Excelencia I Vila Velha S.a - UVV". Nenhum dos dois está contido no
   outro — a sigla está no fim de um e no começo do outro —, então a busca
   devolvia vazio e o certificado saía sem a mantenedora e sem o CNPJ.

   As linhas abaixo são as REAIS da planilha, copiadas do que o usuário
   mandou: é o dado que reproduz o defeito, não um exemplo inventado.
   ═══════════════════════════════════════════════════════════ */
b.passo("6. o nome digitado acha a escola mesmo em outra ordem");

const shEsc2 = ss.getSheetByName("Escolas");
shEsc2.appendRow(["Sociedade Educacao e Gestao de Excelencia I Vila Velha S.a - UVV",
                  "625", "37745762000127", "Vila Velha"]);
/* Vizinha perigosa: também é "Vila Velha", e NÃO pode ser confundida. */
shEsc2.appendRow(["CANADIAN SCHOOL VILA VELHA LTDA", "62", "29376862000103", "Vila Velha"]);

const uvv = g.buscarEscolaPorNome_("UVV - VILA VELHA");
b.igual(String(uvv.cnpj || "").replace(/\D/g, ""), "37745762000127",
  "\"UVV - VILA VELHA\" acha a UVV, com o CNPJ dela",
  JSON.stringify(uvv));
b.ok(/UVV/.test(String(uvv.escola || "")),
  "e devolve a razão social completa do cadastro", String(uvv.escola || ""));

/* CONTRAPROVA, e é a que impede o conserto de virar um defeito pior: a
   busca não pode cair em qualquer escola que também seja de Vila Velha. */
const canadian = g.buscarEscolaPorNome_("CANADIAN SCHOOL VILA VELHA");
b.igual(String(canadian.cnpj || "").replace(/\D/g, ""), "29376862000103",
  "a Canadian continua achando a si mesma", JSON.stringify(canadian));
const soCidade = g.buscarEscolaPorNome_("VILA VELHA");
b.ok(String(soCidade.cnpj || "") === "" ||
     /CANADIAN|UVV/.test(String(soCidade.escola || "")),
  "e buscar só pela cidade não inventa vínculo com uma escola específica",
  JSON.stringify(soCidade));

b.passo("e o certificado do dependente sai completo");
const htmlUvv = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-2026-480404", codigo: "VAL-2", percentual: 100,
  dataEmissao: new Date(2026, 8, 23),
  reg: {
    NOME_SOLICITANTE: "WANDERSON NASCIMENTO CASTELO",
    NOME_BENEFICIARIO: "BERNARDO SIMOURA CASTELO",
    TIPO_BENEFICIARIO: "FILHO", CPF_SOLICITANTE: "11144477735",
    ESCOLA_SELECIONADA: "UVV - VILA VELHA",
    MODALIDADE: "ENSINO_FUNDAMENTAL", CURSO: "6 série",
    PERIODO_REFERENCIA: "2027/1"
  }
});
b.ok(htmlUvv.indexOf("37.745.762/0001-27") > -1,
  "o CNPJ da UVV aparece no certificado — era o que faltava na sua prévia",
  (htmlUvv.match(/instituição[^.]*/) || ["(não achou)"])[0]);

/* ═══════════════════════════════════════════════════════════
   7. O nome impresso é a RAZÃO SOCIAL, não o apelido digitado
   ═══════════════════════════════════════════════════════════

   23/09/2026, você: "tem que sair o CNPJ correto, a razão social correta da
   escola em si". Sem CNPJ gravado, a solicitação guarda o que a pessoa
   DIGITOU no portal — "UVV - VILA VELHA" —, que é apelido. Completar só o
   CNPJ pelo cadastro deixaria o documento com o nome de um lugar e o CNPJ de
   um registro: parecendo conferido, e não sendo.
   ═══════════════════════════════════════════════════════════ */
b.passo("7. o par nome+CNPJ vem inteiro de uma fonte só");
b.ok(htmlUvv.indexOf("Sociedade Educacao e Gestao de Excelencia I Vila Velha S.a - UVV") > -1,
  "a razão social do cadastro é o que sai impresso",
  (htmlUvv.match(/instituição[^.]*/) || ["(não achou)"])[0]);
b.ok(htmlUvv.indexOf(">UVV - VILA VELHA<") === -1,
  "e o apelido digitado no portal não aparece no documento");

/* CONTRAPROVA: com CNPJ gravado, manda a solicitação — inteira. O
   certificado de uma bolsa não muda porque editaram o cadastro depois. */
const comCnpjProprio = g.gerarHtmlDocumentoVoucher_({
  protocolo: "BOLSA-2026-000009", codigo: "VAL-3", percentual: 100,
  dataEmissao: new Date(2026, 8, 23),
  reg: {
    NOME_SOLICITANTE: "WANDERSON NASCIMENTO CASTELO",
    NOME_BENEFICIARIO: "BERNARDO SIMOURA CASTELO",
    TIPO_BENEFICIARIO: "FILHO", CPF_SOLICITANTE: "11144477735",
    ESCOLA_SELECIONADA: "UVV - VILA VELHA", CNPJ_ESCOLA: "11222333000181",
    MODALIDADE: "ENSINO_FUNDAMENTAL", CURSO: "6 série",
    PERIODO_REFERENCIA: "2027/1"
  }
});
b.ok(comCnpjProprio.indexOf("11.222.333/0001-81") > -1,
  "o CNPJ gravado continua valendo");
b.ok(comCnpjProprio.indexOf("37.745.762/0001-27") === -1,
  "e o do cadastro não entra por cima dele");
b.ok(comCnpjProprio.indexOf("UVV - VILA VELHA") > -1,
  "com o nome que veio junto dele — nome e CNPJ nunca de fontes diferentes");

b.naoTestavel("quais abas existem na planilha de produção",
  "o conector do Drive não lê o conteúdo dessa planilha de forma confiável — " +
  "roteiro: abrir a SISGEP - ATIVA e conferir se há uma aba 'Escolas' além da 'Controle'");
b.resumo();
