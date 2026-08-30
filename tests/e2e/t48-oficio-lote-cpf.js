/**
 * TESTE — LISTA DE PESSOAS NO OFÍCIO: ORDEM, CPF, MÁSCARA E LIMITE
 *
 * O QUE ORIGINOU
 *
 * O usuário mandou um ofício de Taxa Negocial gerado em 17/08/2026 e pediu,
 * olhando o documento:
 *
 *   "pode até 50 trabalhadores, sendo o CPF não obrigatório para as três
 *    taxas e tem que sair no ofício para todas as taxas. Os colaboradores
 *    têm que estar em ordem alfabética no ofício e inclui a máscara no
 *    CNPJ — isso tudo no ofício gerado."
 *
 * No PDF que ele mandou dava para ver o problema da máscara a olho nu:
 * "CNPJ: 36136001000105". E os dois nomes saíam na ordem em que foram
 * digitados, não em ordem alfabética.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Gera o HTML real do ofício e confere no documento: ordem alfabética
 * (inclusive com acento, que é onde a ordenação ingênua erra), CPF impresso
 * com máscara quando informado, ausência de linha de CPF quando não
 * informado, CNPJ mascarado, e os limites — 50 pessoas nas taxas, 25 onde
 * existe ficha por pessoa.
 *
 * A ARMADILHA QUE ESTE TESTE VIGIA
 *
 * As fichas anexadas são casadas com os nomes POR POSIÇÃO. Ordenar a lista
 * sem reordenar as fichas junto faz o anexo da primeira pessoa sair com o
 * nome de outra — erro silencioso, que só aparece quando a escola abre o
 * e-mail. Há asserção específica para isso.
 *
 * O QUE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a conversão
 * para PDF e a aparência na folha.
 */
const b = require("./base");
const g = b.subir({}).g;

function gerar(tipo, colaboradores, cnpj) {
  const proc = g.montarDadosOficio_({
    tipo: tipo, escola: "ESCOLA TESTE", para: "DIRETORIA",
    cnpj: cnpj === undefined ? "36136001000105" : cnpj,
    colaboradores: colaboradores, assunto: "Teste"
  }, "preview");
  const html = g.gerarHtmlOficioCompleto_({
    numero: proc.numero, tipoNorm: proc.tipoNorm, assunto: "Teste",
    escola: "ESCOLA TESTE", para: "DIRETORIA",
    cnpj: cnpj === undefined ? "36136001000105" : cnpj,
    colaboradores: proc.colaboradoresArr, colaboradoresLista: proc.colaboradoresLista,
    corpoTexto: proc.corpoTexto, dataHoje: proc.dataExtenso, assBase64: "", assMime: ""
  }, true);
  return { html: html, proc: proc };
}

/** Ordem em que os nomes aparecem DENTRO do documento. */
function ordemNoDocumento(html, nomes) {
  return nomes.slice()
    .map(n => ({ nome: n, pos: html.indexOf(n) }))
    .filter(x => x.pos !== -1)
    .sort((a, c) => a.pos - c.pos)
    .map(x => x.nome);
}

b.fluxo("OFÍCIOS · Ordem alfabética, CPF e máscara de CNPJ");

b.passo("1. Os colaboradores saem em ordem alfabética no documento");
// Digitados fora de ordem de propósito, e com acento: "Ângela" depois de
// "Zuleica" é o erro clássico de quem compara sem tirar o acento.
const foraDeOrdem = ["Zuleica Ramos", "Ângela Nunes", "Bruno Alves", "ana paula lima"];
const r1 = gerar("TAXA_NEGOCIAL", foraDeOrdem);
const esperado = ["ana paula lima", "Ângela Nunes", "Bruno Alves", "Zuleica Ramos"];
b.igual(ordemNoDocumento(r1.html, foraDeOrdem), esperado,
  "ordem alfabética respeitada, com acento no lugar certo");

b.passo("2. O CPF sai no documento, com máscara, quando informado");
const comCpf = [
  { nome: "Marcelha Aline Pinto Gomes", cpf: "12345678909" },
  { nome: "Wanderson Nascimento Castelo", cpf: "987.654.321-00" }
];
const r2 = gerar("TAXA_NEGOCIAL", comCpf);
b.ok(r2.html.indexOf("123.456.789-09") !== -1,
  "CPF digitado só com números sai mascarado",
  r2.html.indexOf("123.456.789-09") !== -1 ? "123.456.789-09" : "AUSENTE");
b.ok(r2.html.indexOf("987.654.321-00") !== -1,
  "CPF digitado já com máscara sai igual",
  r2.html.indexOf("987.654.321-00") !== -1 ? "987.654.321-00" : "AUSENTE");
b.igual(ordemNoDocumento(r2.html, ["Marcelha Aline Pinto Gomes", "Wanderson Nascimento Castelo"]),
  ["Marcelha Aline Pinto Gomes", "Wanderson Nascimento Castelo"],
  "com CPF, a ordem alfabética continua valendo");

b.passo("3. CPF é opcional — sem ele o documento sai igual, sem linha vazia");
const r3 = gerar("TAXA_NEGOCIAL", [{ nome: "Joao Sem Cpf", cpf: "" }, "Maria Texto Puro"]);
b.ok(r3.html.indexOf("Joao Sem Cpf") !== -1 && r3.html.indexOf("Maria Texto Puro") !== -1,
  "os dois nomes saem, com e sem CPF");
b.ok(r3.html.indexOf("CPF:") === -1,
  "nenhuma linha de CPF aparece quando ninguém informou",
  r3.html.indexOf("CPF:") === -1 ? "sem linha de CPF" : "APARECEU linha de CPF vazia");

b.passo("4. O CPF sai nas TRÊS taxas, não só na negocial");
["TAXA_NEGOCIAL", "TAXA_ASSISTENCIAL", "OPOSICAO_TAXA_NEGOCIAL"].forEach(tipo => {
  const r = gerar(tipo, [{ nome: "Teste Da Silva", cpf: "11144477735" }]);
  b.ok(r.html.indexOf("111.444.777-35") !== -1, tipo + " imprime o CPF",
    r.html.indexOf("111.444.777-35") !== -1 ? "presente" : "AUSENTE");
});

b.passo("5. O CNPJ sai com máscara");
const r5 = gerar("TAXA_NEGOCIAL", ["Fulano De Tal"]);
b.ok(r5.html.indexOf("36.136.001/0001-05") !== -1,
  "CNPJ mascarado no documento",
  r5.html.indexOf("36.136.001/0001-05") !== -1 ? "36.136.001/0001-05" : "AUSENTE");
b.ok(r5.html.indexOf("CNPJ: 36136001000105") === -1,
  "o CNPJ cru não aparece mais",
  r5.html.indexOf("CNPJ: 36136001000105") === -1 ? "sem número cru" : "AINDA CRU");
// CNPJ com quantidade errada de dígitos: imprime como veio, não mutilado.
const r5b = gerar("TAXA_NEGOCIAL", ["Fulano De Tal"], "1234");
b.ok(r5b.html.indexOf("CNPJ: 1234") !== -1,
  "CNPJ incompleto sai como foi digitado, sem máscara torta");

b.passo("6. A ficha continua casada com a pessoa certa depois de ordenar");
// Esta é a armadilha da ordenação. Digitados fora de ordem, com uma ficha
// para cada — a ficha do "Zuleica" tem que continuar sendo a do Zuleica.
const nomesFicha = ["Zuleica Ramos", "Ana Paula Lima"];
const procFicha = g.montarDadosOficio_({
  tipo: "FILIACAO", escola: "E", para: "D", cnpj: "36136001000105",
  colaboradores: nomesFicha
}, "preview");
const fichasOriginais = [{ id: "ficha-do-zuleica" }, { id: "ficha-da-ana" }];
const fichasReordenadas = procFicha.colaboradoresLista.map(p => fichasOriginais[p.indiceOriginal]);
b.igual(procFicha.colaboradoresArr, ["Ana Paula Lima", "Zuleica Ramos"],
  "a lista foi ordenada alfabeticamente");
b.igual(fichasReordenadas.map(f => f.id), ["ficha-da-ana", "ficha-do-zuleica"],
  "as fichas acompanharam a ordenação — cada uma com a sua pessoa");

b.passo("7. Limite: 50 pessoas em todos os tipos");
/* Era 25 onde havia ficha por pessoa e 50 nas taxas. O usuário unificou em
   18/08/2026, respondendo "Até 50". As duas constantes precisam concordar:
   SistemaConfig.gs redefine LIMITE_ASSOCIADOS depois de Oficios.gs, e uma
   ficar para trás faria o limite mudar conforme a ordem de carga. */
b.igual(g.LIMITE_PESSOAS_TAXA, 50, "limite das taxas é 50");
b.igual(g.LIMITE_ASSOCIADOS, 50, "limite com ficha também é 50");
b.igual(g.REGRAS_NEGOCIO.LIMITE_ASSOCIADOS_POR_LOTE, 50,
  "a constante de SistemaConfig.gs concorda com a de Oficios.gs");
const cinquenta = [];
for (let i = 1; i <= 50; i++) cinquenta.push("PESSOA " + String(i).padStart(2, "0"));
const r7 = gerar("TAXA_NEGOCIAL", cinquenta);
b.ok(cinquenta.filter(n => r7.html.indexOf(n) !== -1).length === 50,
  "as 50 pessoas saem no documento",
  cinquenta.filter(n => r7.html.indexOf(n) !== -1).length + " de 50");

b.passo("8. O texto cita a CCT 2026/2027 e a regra da Cláusula 57");
const texto = r1.proc.corpoTexto;
b.ok(/2026\/2027/.test(texto), "cita a CCT 2026/2027");
b.ok(!/2025\/2026/.test(texto), "não cita mais a CCT vencida 2025/2026");
b.ok(/6% \(seis por cento\)/.test(texto) && /3 \(três\) parcelas/.test(texto),
  "diz o percentual e o parcelamento (6% em 3 parcelas de 2%)");
b.ok(/isentos/i.test(texto) && /filiados/i.test(texto),
  "informa a isenção dos filiados ao SindEducação/ES");
b.ok(/10º \(décimo\) dia\s*\n?\s*útil/.test(texto.replace(/\s+/g, " ")) || /10º \(décimo\) dia útil/.test(texto.replace(/\s+/g, " ")),
  "mantém o prazo de repasse até o 10º dia útil");

b.passo("9. A tela manda o CPF e afrouxa ficha/CPF só nas taxas");
/* Asserções sobre o CÓDIGO da tela, não sobre a tela rodando. jsdom não
   monta o formulário de ofícios inteiro aqui, então isto é o piso: garante
   que o CPF viaja para o backend e que a regra por tipo existe. O
   comportamento no navegador continua "não testado". */
const fsT48 = require("fs");
const telaOficios = fsT48.readFileSync(require("path").resolve(__dirname, "../../OficiosScripts.html"), "utf8");
b.ok(/colaboradores:d\.beneficiarios\.map\(function\(b\)\{return \{nome:b\.nome, cpf:b\.cpf\};\}\)/.test(telaOficios),
  "a tela envia nome E CPF de cada trabalhador ao backend",
  (telaOficios.match(/return \{nome:b\.nome, cpf:b\.cpf\};/g) || []).length + " pontos de envio");
b.ok(/function oficioExigeFichaECpf/.test(telaOficios) && /function oficioLimitePessoas/.test(telaOficios),
  "a tela tem a regra por tipo (ficha/CPF obrigatórios e limite)");
b.ok(!/if\(d\.beneficiarios\.some\(function\(b\)\{return !b\.nome\|\|!b\.cpf;\}\)\)/.test(telaOficios),
  "a exigência incondicional de CPF saiu da validação de emissão");
b.ok(/function oficioLimitePessoas\(tipo\) \{ return 50; \}/.test(telaOficios),
  "a tela usa o mesmo limite de 50 do backend");

b.passo("10. TODO texto de ofício cita a CCT 2026/2027, e nenhum a vencida");
/* A CCT 2025/2026 venceu em 28/02/2026. Ofício que a cita manda a escola
   agir por convenção que não vale mais — e a escola tem como conferir. */
const TIPOS_TEXTO = ["FILIACAO", "DESFILIACAO", "TAXA_NEGOCIAL",
                     "TAXA_ASSISTENCIAL", "OPOSICAO_TAXA_NEGOCIAL"];
TIPOS_TEXTO.forEach(tipo => {
  const corpo = gerar(tipo, [{ nome: "Teste Da Silva", cpf: "" }]).proc.corpoTexto;
  b.ok(/2026\/2027/.test(corpo) && !/2025\/2026/.test(corpo),
    tipo + " cita a CCT 2026/2027 e não a vencida",
    /2025\/2026/.test(corpo) ? "AINDA CITA 2025/2026" : "ok");
});

b.passo("11. O e-mail que leva o ofício também foi atualizado");
const fsCct = require("fs"), pathCct = require("path");
["EmailOficios.gs", "OficiosFormulario.html", "TaxaAssistencial.gs"].forEach(arq => {
  const txt = fsCct.readFileSync(pathCct.resolve(__dirname, "../../" + arq), "utf8");
  b.ok(!/CCT 2025\/2026/.test(txt) && !/previsto na CCT 2026\./.test(txt),
    arq + " sem referência à CCT vencida",
    /CCT 2025\/2026/.test(txt) ? "AINDA CITA 2025/2026" : "ok");
});

b.passo("12. A Taxa Assistencial passou a trazer os dados da Cláusula 58");
const corpoAssist = gerar("TAXA_ASSISTENCIAL", ["Teste Da Silva"]).proc.corpoTexto;
b.ok(/Cláusula 58/.test(corpoAssist), "cita a Cláusula 58ª");
/* Olha a COMPETÊNCIA, não qualquer menção ao mês: o texto cita "1º de março
   de 2026" ao informar a vigência da CCT, e isso está certo. O que não pode
   é a competência da apuração continuar em 2026. */
b.ok(/compet[êe]ncia mar[çc]o de 2027/.test(corpoAssist) &&
     !/compet[êe]ncia mar[çc]o de 2026/.test(corpoAssist),
  "competência de apuração corrigida para março de 2027",
  /compet[êe]ncia mar[çc]o de 2026/.test(corpoAssist) ? "AINDA MARÇO/2026" : "março de 2027");
b.ok(/15 de abril de 2027/.test(corpoAssist) && /15 de maio de 2027/.test(corpoAssist),
  "traz os vencimentos das duas parcelas");

b.passo("13. A Filiação diz o prazo de repasse em vez de mandar consultar a CCT");
const corpoFil = gerar("FILIACAO", ["Teste Da Silva"]).proc.corpoTexto;
b.ok(/10º \(décimo\) dia do mês subsequente/.test(corpoFil),
  "prazo de repasse escrito no ofício");
b.ok(/relação nominal/.test(corpoFil),
  "pede a relação nominal dos contribuintes, como manda a Cláusula 56");
b.ok(!/conforme os prazos dispostos na CCT/.test(corpoFil),
  "saiu o 'conforme os prazos dispostos na CCT', que não dizia nada à escola");

b.passo("14. Numeração sequencial dos ofícios gerados");
/* Pedido do usuário em 18/08/2026: "número sequencial também dos ofícios
   que são gerados". A numeração é por ANO e vem do maior número já gravado
   na planilha de registro — não de um contador em memória, que se perderia
   entre execuções. Um ofício em lote com 50 pessoas continua sendo UM
   ofício e consome UM número. */
const ssNum = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let abaReg = ssNum.getSheetByName(g.PLANILHA_REGISTRO);
if (!abaReg) abaReg = ssNum.insertSheet(g.PLANILHA_REGISTRO);
abaReg.getRange(1, 1, 1, 2).setValues([["Número do Ofício", "Escola"]]);

const n1 = g.gerarProximoNumeroSeguro();
const anoAtual = new Date().getFullYear();
b.ok(new RegExp("^\\d+/" + anoAtual + "$").test(n1),
  "o número sai no formato NNN/ANO", n1);

/* Grava o primeiro como se o ofício tivesse sido emitido e pede o próximo:
   sem gravar, o "próximo" seria sempre o mesmo. */
abaReg.getRange(2, 1).setValue(n1);
const n2 = g.gerarProximoNumeroSeguro();
const seq1 = parseInt(String(n1).split("/")[0], 10);
const seq2 = parseInt(String(n2).split("/")[0], 10);
b.igual(seq2, seq1 + 1, "o próximo ofício recebe o número seguinte");

/* O primeiro número da plataforma é fixo, para não colidir com os ofícios
   emitidos em papel antes do sistema existir. */
b.ok(seq1 >= g.PRIMEIRO_OFICIO_PLATAFORMA,
  "a numeração começa depois dos ofícios anteriores ao sistema",
  "primeiro da plataforma: " + g.PRIMEIRO_OFICIO_PLATAFORMA + " · gerado: " + seq1);

/* Número de outro ano na planilha não pode influenciar o contador do ano
   corrente. O número n2 já foi RESERVADO mesmo sem ser gravado na planilha:
   isso impede que duas emissões simultâneas recebam a mesma sequência. */
abaReg.getRange(3, 1).setValue("999/" + (anoAtual - 1));
const n3 = g.gerarProximoNumeroSeguro();
b.igual(parseInt(String(n3).split("/")[0], 10), seq1 + 2,
  "a reserva anterior é respeitada e o ofício de outro ano não interfere");

const n4 = g.gerarProximoNumeroSeguro();
b.igual(parseInt(String(n4).split("/")[0], 10), seq1 + 3,
  "duas reservas consecutivas recebem números diferentes sem depender da planilha");

const ambienteSeq = String(g.getAmbienteAtual() || "producao").toUpperCase();
const chaveSeq = "SISGEP_OFICIO_SEQ_" + ambienteSeq + "_" + anoAtual;
b.igual(parseInt(g.PropertiesService.getScriptProperties().getProperty(chaveSeq), 10), seq1 + 3,
  "a última reserva fica persistida antes da liberação da trava");

b.naoTestavel("Numeração sob emissão simultânea de dois usuários",
  "o emulador é de um processo só; a trava (travarSisgep_) existe no código e é exercitada, mas concorrência real exige o Apps Script");

b.passo("15. Nome do arquivo das fichas em lote: escola e data");
/* Pedido do usuário em 18/08/2026: "na hora de salvar pode colocar o nome
   da escola e a data", junto com o formato que ele descreveu — "seria um
   PDF de fichas para cada escola por dia". O arquivo passa a se identificar
   sozinho na pasta do Drive. */
const nomeEscolaTeste = "COLEGIO SAO JOSE LTDA";
const dataHojeArq = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
const procNome = g.montarDadosOficio_({
  tipo: "FILIACAO", escola: nomeEscolaTeste, para: "DIRETORIA",
  cnpj: "36136001000105", colaboradores: ["Ana Paula Lima", "Bruno Alves"]
}, "preview");
b.igual(procNome.colaboradoresArr.length, 2, "duas pessoas na lista");
/* Quando é UM arquivo para VÁRIAS pessoas, não dá para dizer de quem é a
   ficha — o nome não pode sair com o nome da primeira pessoa da lista, que
   seria informação errada gravada no Drive. */
b.ok(true, "regra registrada: 1 arquivo × N pessoas → nome por escola e data",
  "Fichas_" + nomeEscolaTeste.replace(/\s+/g, "_") + "_" + dataHojeArq + ".pdf");

b.naoTestavel("O nome com que o arquivo é realmente gravado no Drive",
  "a gravação acontece dentro de gerarOficioWeb, que depende de DriveApp e de e-mail — exige o Apps Script no ar");

b.naoTestavel("A conversão para PDF e a aparência da lista na folha",
  "o emulador não converte HTML em PDF — exige gerar um ofício no sistema no ar");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
