/**
 * t142 — A TROCA DE E-MAIL DAS ESCOLAS, CONFERIDA ANTES DE ESCREVER
 *
 * O Monitoramento da produção mostrou 42 falhas de entrega em 23 endereços, e
 * QUINZE delas eram dois endereços que não existem mais. O usuário mandou os
 * substitutos em 02/09/2026 — e um deles explicou a causa: o SEB não trocou de
 * pessoa, trocou de DOMÍNIO. `carolina.ferreira@seb.com.br` virou
 * `carolina.ferreira@sebeducation.com`.
 *
 * O QUE ESTE TESTE PROTEGE. O script escreve na base de escolas da produção —
 * 679 cadastros, na mesma planilha dos ~8.000 associados. Um erro aqui não é
 * uma tela quebrada: é contato de escola perdido, sem de onde recuperar.
 *
 * As três asserções que mais importam são a 3 (não apaga os outros
 * endereços da linha), a 5 (conferir não escreve nada) e a 7 (endereço
 * inválido não chega a tocar a planilha).
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const b = require("./base");

const { g } = b.subir({});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "fixtures", "producao", "TrocarEmailEscola.gs.txt"), "utf8"),
  g, { filename: "TrocarEmailEscola.gs" });

/* ── a base de escolas, no formato da produção ─────────────────────────── */
const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
let esc = ss.getSheetByName(g.PLANILHA_ESCOLAS) || ss.insertSheet(g.PLANILHA_ESCOLAS);
esc.getRange(1, 1, 1, 3).setValues([["Nome", "E-mail (principal)", "E-mails (todos)"]]);
const LINHAS = [
  ["FUNDACAO DE ASSISTENCIA E EDUCACAO - FAESA", "thalia.ferreira@faesa.br", "thalia.ferreira@faesa.br"],
  /* Mesma rede, outra unidade: a troca tem que pegar as duas. */
  ["ASSOCIACAO EDUCACIONAL DE VITORIA - AEV",    "thalia.ferreira@faesa.br", "thalia.ferreira@faesa.br; diretoria@aev.br"],
  ["SEB ESCOLAS DE ALTA PERFORMANCE S.A.",       "eni.neves@seb.com.br",     "eni.neves@seb.com.br"],
  /* Não pode ser tocada por nenhuma das trocas. */
  ["CRECHE PING PONG LTDA",                     "dp1@tellescontabilidade.cnt.br", "dp1@tellescontabilidade.cnt.br"],
  ["COLEGIO ADVENTISTA DE VITORIA",              "edileia.kuhl@adventistas.org", "edileia.kuhl@adventistas.org"]
];
esc.getRange(2, 1, LINHAS.length, 3).setValues(LINHAS);
g._headerCache = {};

function linha(n) {
  return esc.getRange(n, 1, 1, 3).getValues()[0];
}

b.fluxo("ESCOLAS · conferir não escreve; aplicar escreve");

b.passo("1. conferir acha as linhas das duas trocas");
const conf = g.escolasConferirTroca();
b.ok(/thalia\.ferreira@faesa\.br/.test(conf), "acha a da FAESA");
b.ok(/eni\.neves@seb\.com\.br/.test(conf), "e a do SEB");
b.ok(/karolina\.caldeira@faesa\.br/.test(conf), "mostra os substitutos da FAESA");
b.ok(/carolina\.ferreira@sebeducation\.com/.test(conf), "e o do SEB, no domínio novo");

b.passo("2. e diz quantas linhas achou — a FAESA aparece em DUAS");
/* A mesma rede tem várias unidades na base. Trocar só a primeira deixaria a
   outra quicando, e ninguém saberia por quê. */
b.ok(/linhas encontradas: 2/.test(conf), "duas linhas com o endereço da FAESA");

b.passo("3. CONFERIR NÃO ESCREVEU NADA");
/* É o que autoriza rodar isso numa base com 679 escolas e 8.000 associados. */
b.igual(linha(2)[1], "thalia.ferreira@faesa.br", "a linha da FAESA está intacta");
b.igual(linha(4)[1], "eni.neves@seb.com.br", "a do SEB também");
b.ok(/NADA FOI ESCRITO/.test(conf), "e o relatório diz isso em letras");

b.fluxo("ESCOLAS · aplicar troca sem apagar o que funciona");

b.passo("4. aplicar substitui o endereço morto");
const apl = g.escolasAplicarTroca();
b.ok(linha(2)[2].indexOf("karolina.caldeira@faesa.br") > -1, "entrou a karolina");
b.ok(linha(2)[2].indexOf("luiza.stefani@faesa.br") > -1, "e a luiza");
b.ok(linha(2)[2].indexOf("thalia.ferreira") === -1, "e a thalia saiu");

b.passo("5. E PRESERVA OS OUTROS ENDEREÇOS DA LINHA");
/* A asserção que impede o estrago silencioso: a AEV tinha diretoria@aev.br
   junto. Trocar a lista inteira apagaria um contato que funciona, e ninguém
   perceberia até um ofício não chegar. */
b.ok(linha(3)[2].indexOf("diretoria@aev.br") > -1,
  "o contato que já funcionava continua lá",
  linha(3)[2]);
b.ok(linha(3)[2].indexOf("thalia.ferreira") === -1, "e o morto saiu dessa linha também");

b.passo("6. o SEB volta para a carolina, no domínio novo");
b.ok(linha(4)[2].indexOf("carolina.ferreira@sebeducation.com") > -1,
  "entrou o sebeducation.com",
  "o SEB não trocou de pessoa, trocou de domínio — é a causa das 8 quicadas");
b.ok(linha(4)[2].indexOf("eni.neves") === -1, "e a eni saiu");

b.passo("7. a Ping Pong GANHA o novo e MANTÉM o antigo");
/* Contraria o que eu recomendei, e é decisão do usuário: o dp1 quicou 3 vezes.
   Mantido, a Ping Pong deve continuar aparecendo como FALHA_ENTREGA — porque
   UM endereço que quica marca o ofício inteiro, mesmo que o outro receba. */
b.ok(linha(5)[2].indexOf("contato@cevolucao.com.br") > -1, "entrou o cevolucao");
b.ok(linha(5)[2].indexOf("dp1@tellescontabilidade.cnt.br") > -1,
  "e o dp1 continua, como pedido");

b.passo("8. e a escola que não estava em nenhuma troca NÃO foi tocada");
b.igual(linha(6)[1], "edileia.kuhl@adventistas.org", "o Adventista está intacto");
b.igual(linha(6)[2], "edileia.kuhl@adventistas.org", "nas duas colunas");

b.fluxo("ESCOLAS · o que impede o estrago");

b.passo("9. e-mail inválido não chega a tocar a planilha");
/* Um ponto-e-vírgula a mais, um espaço no lugar errado, e a base ficaria com
   endereço quebrado em cadastro que ninguém revisa. */
const antesInv = linha(2)[2];
g.TROCAS = [{ de: "karolina.caldeira@faesa.br", para: "isso nao e email" }];
const inval = g.escolasAplicarTroca();
b.ok(/invalido/i.test(inval), "recusa e diz por quê");
b.igual(linha(2)[2], antesInv, "e a planilha ficou intacta");

b.passo("10. endereço que não existe na base não gera escrita nenhuma");
g.TROCAS = [{ de: "ninguem@lugar-nenhum.com", para: "outro@lugar.com" }];
const nada = g.escolasAplicarTroca();
b.ok(/linhas encontradas: 0/.test(nada), "nenhuma linha encontrada");
b.igual(linha(2)[2], antesInv, "nada foi escrito");

b.naoTestavel(
  "os endereços novos funcionarem de verdade",
  "o emulador não entrega e-mail. `karolina.caldeira@faesa.br` e " +
  "`carolina.ferreira@sebeducation.com` vieram do usuário e ainda não têm " +
  "histórico no sistema. A prova é o próximo ofício para essas escolas não " +
  "voltar como FALHA_ENTREGA"
);
b.aviso(
  "o dp1 da Ping Pong quicou 3 vezes e foi MANTIDO a pedido",
  "ofícios 296, 315 e 365, o último em 26/08. Um endereço que quica marca o " +
  "ofício inteiro como FALHA_ENTREGA, mesmo que o contato@cevolucao.com.br " +
  "receba — então a Ping Pong deve continuar aparecendo como falha"
);
b.aviso(
  "folhapagamento@sebsa.com.br já quicou uma vez",
  "o ofício 465/2026, em 31/08, foi só para esse endereço e voltou como falha " +
  "de entrega. Pode ter sido corrigido desde então — mas vale saber antes de " +
  "contar com ele"
);

b.resumo();
