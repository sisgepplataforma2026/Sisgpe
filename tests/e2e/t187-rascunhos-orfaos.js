/**
 * TESTE — A VARREDURA DE RASCUNHOS ÓRFÃOS LISTA, E NÃO APAGA
 *
 * POR QUE A VARREDURA EXISTE. O envio do SISGEP cria um rascunho e manda em
 * seguida; se o `send()` falha, o `catch` apaga o rascunho. O que nenhum dos
 * dois caminhos cobre é a execução ser INTERROMPIDA entre uma coisa e outra —
 * o timeout de 6 minutos do Apps Script, ou a execução cancelada. Ali o
 * `catch` nunca roda, e sobra um rascunho que parece documento pendente.
 *
 * POR QUE ELA SÓ LISTA. A caixa do financeiro tem 31 rascunhos, vários
 * escritos à mão, alguns de junho, com assuntos de trabalho. Qualquer regra
 * para reconhecer "o que é do sistema" acertaria quase sempre e erraria um
 * dia — e apagar rascunho é irreversível. O problema real não é o rascunho
 * existir, é ninguém saber que existe.
 *
 * ESTE TESTE É, EM BOA PARTE, SOBRE O QUE ELA NÃO FAZ.
 */
const b = require("./base");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

b.fluxo("RASCUNHOS · A varredura que lista, e não apaga");

/* Um rascunho velho, do sistema, e um velho escrito à mão. O emulador guarda
   `criadoEm`; reescrevê-lo é como simular que o tempo passou — não há como
   esperar quinze minutos dentro de um teste. */
function envelhecer(horas) {
  (g.__rascunhosGmail || []).forEach(function (r) {
    r.criadoEm = new Date(Date.now() - horas * 3600000);
  });
}

b.passo("1. Um rascunho que ficou para trás aparece na lista");
g.GmailApp.createDraft("escola@exemplo.com", "Ofício de Filiação Nº 999/2026",
  "corpo", { attachments: [1, 2] });
envelhecer(3);

const r1 = g.oficiosRascunhosOrfaos(15, TOKEN);
b.ok(r1 && r1.ok === true, "a varredura roda", r1 && r1.mensagem);
b.igual(r1.total, 1, "achou o rascunho");
b.igual(r1.doSistema, 1, "e reconheceu o assunto como sendo do SISGEP");
b.igual(r1.rascunhos[0].anexos, 2, "com os anexos contados");
b.ok(r1.rascunhos[0].idadeHoras >= 3, "e a idade medida", r1.rascunhos[0].idadeHoras + "h");
b.ok(r1.relatorio.indexOf("[SISGEP?]") > -1, "o relatório marca o que parece do sistema");

/* A PALAVRA "PARECE" PRECISA ESTAR NA SAÍDA. Quem lê o relatório vai decidir
   apagar coisa do próprio Gmail — dar certeza que não existe seria pior do
   que não avisar. */
b.ok(r1.relatorio.indexOf("não é prova") > -1,
  "e avisa, com todas as letras, que 'parece' não é prova");
b.ok(r1.relatorio.indexOf("NÃO apaga") > -1, "e que nada foi apagado");

b.passo("2. O QUE ELA NÃO FAZ — e é o ponto principal");
/* Rodar de novo tem que achar o mesmo rascunho. Se a primeira passada tivesse
   apagado, a segunda viria vazia — e o teste que só olha a primeira não veria
   diferença nenhuma. */
const r2 = g.oficiosRascunhosOrfaos(15, TOKEN);
b.igual(r2.total, 1, "o rascunho CONTINUA lá depois da varredura");
b.igual((g.__rascunhosGmail || []).filter(function (x) { return !x.apagado; }).length, 1,
  "nenhum rascunho foi apagado, medido na própria caixa");

b.passo("3. Rascunho recém-criado não é acusado");
/* Entre createDraft e send passam segundos. Um rascunho de agora está a
   caminho, não órfão — acusá-lo faria a varredura gritar em todo envio. */
g.GmailApp.createDraft("outro@exemplo.com", "Certificado de Bolsa de Estudo", "corpo", {});
const r3 = g.oficiosRascunhosOrfaos(15, TOKEN);
b.igual(r3.total, 1, "o novo não entra na lista — só o velho");

b.passo("4. Rascunho escrito à mão é listado, mas NÃO marcado como do sistema");
/* É o caso que mais importa: a caixa real tem rascunhos de junho com assuntos
   de trabalho. Eles aparecem, para quem lê decidir — e aparecem marcados como
   provavelmente manuais, para ninguém apagar por engano. */
g.GmailApp.createDraft("joao@exemplo.com", "Relação de filiados atualizados", "corpo", {});
envelhecer(20);
const r4 = g.oficiosRascunhosOrfaos(15, TOKEN);
b.igual(r4.total, 3, "os três rascunhos velhos aparecem");
b.igual(r4.doSistema, 2, "e só dois são marcados como do SISGEP");
b.ok(r4.relatorio.indexOf("[manual?] ") > -1,
  "o escrito à mão sai marcado como provavelmente manual");

b.passo("5. Rascunho APAGADO pelo envio não aparece");
/* É a garantia de que a varredura não confunde o caminho normal com defeito:
   quando o send falha, o catch apaga, e o apagado não pode ser listado. */
const rasc = g.GmailApp.createDraft("x@exemplo.com", "Ofício de Desfiliação Nº 1/2026", "c", {});
rasc.deleteDraft();
envelhecer(20);
const r5 = g.oficiosRascunhosOrfaos(15, TOKEN);
b.igual(r5.total, 3, "o apagado não entra na conta");

b.passo("6. Sem sessão, ninguém varre a caixa do sindicato");
b.bloqueia(function () { g.oficiosRascunhosOrfaos(15, ""); },
  "a varredura exige sessão ou conta do dono do projeto");

b.passo("7. O piso de idade tem um padrão que não deixa brecha");
const rSemArg = g.oficiosRascunhosOrfaos(null, TOKEN);
b.igual(rSemArg.minutos, 15, "sem argumento, usa 15 minutos");
const rZero = g.oficiosRascunhosOrfaos(0, TOKEN);
b.igual(rZero.minutos, 15, "e zero não vira 'tudo', que acusaria envio em curso");
const rNeg = g.oficiosRascunhosOrfaos(-5, TOKEN);
b.igual(rNeg.minutos, 15, "nem número negativo");

b.naoTestavel("a caixa de Rascunhos real do financeiro",
  "o emulador não tem o Gmail do sindicato — roteiro manual: rodar " +
  "oficiosRascunhosOrfaos() pelo editor do Apps Script e ler o Logger");
b.resumo();
