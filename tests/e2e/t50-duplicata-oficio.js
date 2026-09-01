/**
 * TESTE — O AVISO DE OFÍCIO DUPLICADO TEM QUE FALAR DO OFÍCIO CERTO
 *
 * O QUE ORIGINOU ESTE TESTE
 *
 * Em 18/08/2026 o usuário mandou a foto do aviso na tela:
 *
 *     "Já existe um ofício de Taxa Negocial para Teste (nº 276/2026),
 *      gerado em 17/08/2026 às 19:38 nas últimas 24h."
 *
 * e, logo depois, a foto do ofício que saiu: nº 279/2026. A frase dele foi
 * "Quando gera é o 279 tem erro nessa mensagem acima". Estava certo. A
 * numeração é maior-da-planilha + 1, então se o próximo é 279 é porque 277 e
 * 278 já existem — e o aviso citou 276, o MAIS ANTIGO da janela de 24h, não
 * o mais recente. Quem lê o aviso precisa reconhecer o ofício que acabou de
 * emitir; citar um de três emissões atrás faz a pessoa achar que é outro
 * caso e confirmar sem pensar.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Ele monta a aba de registro com ofícios reais dentro e fora da janela de
 * 24h e chama verificarDuplicata() de verdade, medindo:
 *
 *   1. qual ofício ela devolve quando há vários na janela (tem que ser o
 *      MAIS RECENTE, e tem que dizer quantos são);
 *   2. se Filiação para de casar com Desfiliação — "desfiliação" contém
 *      "filiação" como texto, e a comparação era por substring;
 *   3. se Taxa Negocial para de casar com Oposição à Taxa Negocial;
 *   4. se duas escolas diferentes com nome parecido deixam de ser
 *      confundidas quando o CNPJ de cada uma está na planilha;
 *   5. se ofício fora das 24h continua não disparando aviso.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência do modal na tela real e o clique do atendente em "Gerar mesmo
 * assim". Isso se prova emitindo um ofício repetido no sistema no ar.
 */
const b = require("./base");
const g = b.subir({}).g;

const CAB = ["Número do Ofício", "Escola (Razão Social)", "CNPJ", "TIPO",
             "Data envio ofício", "Status"];

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/** Refaz a aba de registro do zero com as linhas passadas. */
function semear(linhas) {
  let aba = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (aba) ss.deleteSheet(aba);
  aba = ss.insertSheet(g.PLANILHA_REGISTRO);
  aba.getRange(1, 1, 1, CAB.length).setValues([CAB]);
  linhas.forEach((l, i) => aba.getRange(2 + i, 1, 1, CAB.length).setValues([l]));
  return aba;
}

/** Data a N horas atrás — a janela do verificador é de 24h. */
function horasAtras(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

const CNPJ_TESTE = "36136001000105";
const CNPJ_OUTRA = "31815780000151";

/* ═══════════════════════════════════════════════════════════════════
   FLUXO 1 — vários ofícios na janela: o aviso fala do mais recente
   ═══════════════════════════════════════════════════════════════════ */
b.fluxo("DUPLICATA · Com três ofícios em 24h, o aviso cita o último");

b.passo("1");
semear([
  ["276/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(20), "ENVIADO"],
  ["277/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(6),  "ENVIADO"],
  ["278/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(1),  "ENVIADO"]
]);

const varios = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });

b.ok(varios && varios.duplicata === true, "acusa duplicata quando ela existe");
b.igual(varios.numeroExistente, "278/2026",
  "cita o ofício MAIS RECENTE da janela, não o mais antigo");
b.igual(varios.quantidade, 3,
  "informa quantos ofícios do mesmo tipo saíram nas últimas 24h");

/* A ordem das linhas na planilha não pode mandar no resultado: se o mais
   recente estiver na primeira linha, a resposta é a mesma. Sem esta
   asserção, um verificador que devolve "a última linha da planilha" passaria
   no teste acima por acidente. */
b.passo("2");
semear([
  ["278/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(1),  "ENVIADO"],
  ["276/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(20), "ENVIADO"],
  ["277/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(6),  "ENVIADO"]
]);
const fora = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.igual(fora.numeroExistente, "278/2026",
  "acha o mais recente mesmo fora de ordem na planilha");

/* ═══════════════════════════════════════════════════════════════════
   FLUXO 2 — tipo parecido não é o mesmo tipo
   ═══════════════════════════════════════════════════════════════════ */
b.fluxo("DUPLICATA · Tipo com nome parecido não conta como repetição");

b.passo("3");
semear([
  ["300/2026", "Teste", CNPJ_TESTE, "Desfiliação", horasAtras(2), "ENVIADO"]
]);
const filVsDesf = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Filiação" });
b.ok(filVsDesf && filVsDesf.duplicata === false,
  "Filiação não acusa duplicata por causa de uma Desfiliação",
  '"desfiliação" contém "filiação" — a comparação por substring casava os dois');

b.passo("4");
semear([
  ["301/2026", "Teste", CNPJ_TESTE, "Oposição à Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const taxaVsOpos = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.ok(taxaVsOpos && taxaVsOpos.duplicata === false,
  "Taxa Negocial não acusa duplicata por causa de uma Oposição à Taxa Negocial");

/* Contraprova: o tipo IGUAL continua sendo pego. Sem isto, desligar o
   verificador inteiro passaria nos dois testes acima. */
b.passo("5");
const mesmoTipo = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Oposição à Taxa Negocial" });
b.ok(mesmoTipo && mesmoTipo.duplicata === true,
  "o MESMO tipo continua sendo acusado (contraprova)");

/* ═══════════════════════════════════════════════════════════════════
   FLUXO 3 — escola errada não vira duplicata
   ═══════════════════════════════════════════════════════════════════ */
b.fluxo("DUPLICATA · Escola de nome parecido, CNPJ diferente");

b.passo("6");
semear([
  ["310/2026", "Colégio Teste Vitória", CNPJ_OUTRA, "Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const outraEscola = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.ok(outraEscola && outraEscola.duplicata === false,
  "escola com nome parecido e CNPJ diferente não acusa duplicata",
  "o CNPJ manda quando as duas linhas têm CNPJ");

/* A asserção acima, sozinha, NÃO prova que o CNPJ manda: "teste" tem 5
   letras e já era barrado pelo piso de tamanho da comparação por nome.
   Descobri isso mutando o código (voltei o OU entre nome e CNPJ) e vendo o
   teste passar mesmo assim. Este caso fecha o furo: o nome de uma escola
   está inteiro dentro do nome da outra — a comparação por nome casaria — e
   só o CNPJ diferente separa as duas. */
b.passo("6b");
semear([
  ["313/2026", "Colégio Municipal Teste Vitória", CNPJ_OUTRA, "Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const nomeContido = g.verificarDuplicata({
  escola: "Colégio Municipal Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial"
});
b.ok(nomeContido && nomeContido.duplicata === false,
  "nome de uma escola contido no da outra não vence o CNPJ diferente",
  '"colegio municipal teste" está inteiro dentro de "colegio municipal teste vitoria"');

/* Contraprova: mesmo CNPJ, razão social escrita diferente — é a MESMA
   escola e tem que acusar. */
b.passo("7");
semear([
  ["311/2026", "TESTE LTDA", CNPJ_TESTE, "Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const mesmoCnpj = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.ok(mesmoCnpj && mesmoCnpj.duplicata === true,
  "mesmo CNPJ com razão social escrita diferente continua sendo a mesma escola");

/* Sem CNPJ na planilha (registro antigo), o nome ainda serve de âncora. */
b.passo("8");
semear([
  ["312/2026", "Teste", "", "Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const semCnpj = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.ok(semCnpj && semCnpj.duplicata === true,
  "linha antiga sem CNPJ ainda casa pelo nome da escola");

/* ═══════════════════════════════════════════════════════════════════
   FLUXO 4 — a janela de 24h é de verdade
   ═══════════════════════════════════════════════════════════════════ */
b.fluxo("DUPLICATA · Fora das 24h não é duplicata");

b.passo("9");
semear([
  ["320/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(30), "ENVIADO"]
]);
const antigo = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.ok(antigo && antigo.duplicata === false,
  "ofício de 30h atrás não dispara aviso");

b.passo("10");
semear([
  ["321/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(30), "ENVIADO"],
  ["322/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(3),  "ENVIADO"]
]);
const mistura = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });
b.igual(mistura.quantidade, 1,
  "a contagem ignora o que está fora da janela");
b.igual(mistura.numeroExistente, "322/2026",
  "e cita o que está dentro dela");

/* ═══════════════════════════════════════════════════════════════════
   FLUXO 5 — o aviso chega à tela com os campos separados
   ═══════════════════════════════════════════════════════════════════ */
b.fluxo("DUPLICATA · O que a tela recebe para montar o modal");

b.passo("11");
semear([
  ["330/2026", "Teste", CNPJ_TESTE, "Taxa Negocial", horasAtras(2), "ENVIADO"]
]);
const p = g.verificarDuplicata({ escola: "Teste", cnpj: CNPJ_TESTE, tipo: "Taxa Negocial" });

/* O modal mostra escola, número, data e tipo em linhas separadas — não dá
   para o front ter que recortar isso de dentro de uma frase pronta. */
b.ok(!!p.escola,        "devolve a escola em campo próprio");
b.ok(!!p.numeroExistente, "devolve o número em campo próprio");
b.ok(!!p.dataExistente,  "devolve a data em campo próprio");
b.ok(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/.test(p.dataExistente),
  "a data vem formatada para leitura humana", p.dataExistente);
b.igual(p.tipo, "Taxa Negocial",
  "devolve o tipo do ofício encontrado, para o modal não repetir o que o usuário escolheu");

b.resumo();
