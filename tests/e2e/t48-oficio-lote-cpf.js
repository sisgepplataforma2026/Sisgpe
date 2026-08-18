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

b.passo("7. Limite: 50 nas taxas, 25 onde existe ficha por pessoa");
b.ok(typeof g.LIMITE_PESSOAS_TAXA === "number" && g.LIMITE_PESSOAS_TAXA === 50,
  "limite das taxas é 50", "LIMITE_PESSOAS_TAXA = " + g.LIMITE_PESSOAS_TAXA);
b.ok(g.LIMITE_ASSOCIADOS === 25,
  "limite com ficha continua 25", "LIMITE_ASSOCIADOS = " + g.LIMITE_ASSOCIADOS);
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
b.ok(/oficioLimitePessoas\(tipo\) \? 25 : 50|\? 25 : 50/.test(telaOficios),
  "limite 50 para taxas e 25 onde há ficha por pessoa");

b.naoTestavel("A conversão para PDF e a aparência da lista na folha",
  "o emulador não converte HTML em PDF — exige gerar um ofício no sistema no ar");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
