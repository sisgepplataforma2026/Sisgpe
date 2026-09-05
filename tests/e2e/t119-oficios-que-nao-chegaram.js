/**
 * t119 — MÓDULO 03 · QUAIS OFÍCIOS NÃO CHEGARAM
 *
 * O t118 fez a Home parar de esconder o ofício que falhou. Isto resolve o
 * painel — mas quem opera precisa de outra coisa: saber QUAL ofício, de que
 * escola, para que e-mail e por qual erro.
 *
 * A taxa de 0,26% que a produção mostra no acionador não serve para ninguém
 * ligar para uma escola. Esta função troca a porcentagem por nomes.
 *
 * O QUE ELA NÃO FAZ, e é de propósito: não reenvia, não muda status, não
 * apaga. Reenviar é decisão de quem opera, depois de corrigir o e-mail, e tem
 * função própria (`enviarOficioDaFilaAgora`). Um diagnóstico que conserta
 * sozinho é um diagnóstico em que ninguém confia para rodar.
 *
 * A SEPARAÇÃO QUE O RELATÓRIO FAZ, e que é a razão dele existir:
 *
 *   PENDENTE         sai sozinho no próximo gatilho     — não é problema
 *   ERRO             ainda vai tentar de novo           — não é problema HOJE
 *   ERRO_PERMANENTE  a fila DESISTIU                    — precisa de gente
 *   FALHA_ENTREGA    voltou do servidor de e-mail       — precisa de gente
 *
 * Sem essa separação o operador olha "12 com problema" e não sabe em quais
 * mexer. Com ela, olha dois nomes e resolve dois.
 */

const b = require("./base");
const { g } = b.subir({});

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const HOJE = new Date();
const ONTEM = new Date(HOJE.getTime() - 3 * 86400000);

(function semear() {
  /* Controle: a base antiga. Número tem de ser NNN/AAAA — o resto é linha de
     cadastro de escola e é ignorado de propósito. */
  let c = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (!c) c = ss.insertSheet(g.PLANILHA_REGISTRO);
  c.getRange(1, 1, 1, 4).setValues([["Número do Ofício", "Escola", "E-mail", "Status"]]);
  c.getRange(2, 1, 3, 4).setValues([
    ["010/2026", "Escola Antiga",  "antiga@teste.com", "ENVIADO"],
    ["011/2026", "Escola Parada",  "parada@teste.com", "ERRO_PERMANENTE"],
    ["7", "Linha de cadastro de escola", "", "SEJA IGNORADA"]
  ]);

  /* Fila: o envio automatizado. Vence o Controle quando o número coincide. */
  let f = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!f) f = ss.insertSheet("FILA_ENVIO_OFICIOS");
  const cab = ["NUMERO_OFICIO", "ESCOLA", "EMAIL_DESTINO", "STATUS",
               "TENTATIVAS", "ULTIMO_ERRO", "DATA_ULTIMA_TENTATIVA"];
  f.getRange(1, 1, 1, cab.length).setValues([cab]);
  f.getRange(2, 1, 5, cab.length).setValues([
    ["020/2026", "Escola Boa",     "boa@teste.com",     "ENVIADO",         1, "",                  HOJE],
    ["021/2026", "Escola Espera",  "espera@teste.com",  "PENDENTE",        0, "",                  ""],
    ["022/2026", "Escola Errada",  "naoexiste@x.com",   "ERRO_PERMANENTE", 3, "Invalid email",     ONTEM],
    ["023/2026", "Escola Voltou",  "cheia@teste.com",   "FALHA_ENTREGA",   1, "Mailbox full",      HOJE],
    ["024/2026", "Escola Tentando","lento@teste.com",   "ERRO",            1, "Timeout temporário", HOJE]
  ]);
})();

/* PORTA ACRESCENTADA EM 01/09/2026 (t127): o relatório devolve NOME DE
   ESCOLA e E-MAIL de destino, então deixou de ser endpoint anônimo. Todas
   as chamadas daqui em diante passam token. */
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

b.fluxo("MÓDULO 03 · a porta do relatório");

b.passo("0. sem sessão e sem conta do editor, não roda");
/* O que sairia por aqui é o cadastro de contatos das escolas. */
g.__usuarioAtivoEmail = "";
let recusou = false, msgRecusa = "";
try { g.oficiosQueNaoChegaram(""); }
catch (e) { recusou = true; msgRecusa = String(e.message || e); }
b.ok(recusou, "anônimo é barrado",
  recusou ? msgRecusa.substring(0, 44) : "PASSOU — escola e e-mail abertos");

b.fluxo("MÓDULO 03 · o relatório troca a porcentagem por nomes");

b.passo("1. roda e conta tudo");
const r = g.oficiosQueNaoChegaram(TOKEN);
b.ok(r && r.ok === true, "oficiosQueNaoChegaram responde");
b.igual(r.total, 7, "conta os 7 ofícios das duas bases",
  "2 do Controle + 5 da fila — a linha '7' de cadastro de escola fica de fora");

b.passo("2. a linha que não é ofício é ignorada");
/* O Controle guarda cadastro de escola com numeração sequencial. Contá-la
   como ofício inflaria todo o painel. */
b.ok(
  r.relatorio.indexOf("Linha de cadastro de escola") === -1,
  "o cadastro de escola não entra no relatório",
  "só NNN/AAAA é ofício"
);

b.passo("3. A SEPARAÇÃO QUE IMPORTA — quem precisa de gente e quem não");
b.igual(r.precisamDeGente, 3,
  "3 precisam de gente: 2 erros permanentes e 1 falha de entrega",
  "o PENDENTE e o ERRO ficam de fora — esses o gatilho resolve sozinho");
b.igual(r.porGrupo.PENDENTE, 1, "o pendente é contado, mas não cobrado");
b.igual(r.porGrupo.ERRO, 1, "o erro temporário também");
b.igual(r.porGrupo.ERRO_PERMANENTE, 2, "os permanentes");
b.igual(r.porGrupo.FALHA_ENTREGA, 1, "e a falha de entrega");

b.passo("4. o relatório diz o que fazer com cada grupo");
b.ok(/sai sozinho no pr[óo]ximo gatilho/.test(r.relatorio),
  "avisa que o pendente sai sozinho — para ninguém mexer nele");
b.ok(/A FILA DESISTIU/.test(r.relatorio),
  "e que no erro permanente a fila desistiu",
  "é a diferença entre esperar e agir");

b.passo("5. E OS NOMES — é para isso que a função existe");
["022/2026", "Escola Errada", "naoexiste@x.com", "Invalid email"].forEach(function (t) {
  b.ok(r.relatorio.indexOf(t) >= 0, "o relatório traz: " + t);
});
b.ok(/3 dia\(s\) parado/.test(r.relatorio),
  "e há quantos dias está parado",
  "'parado desde ontem' e 'parado há 3 semanas' pedem urgências diferentes");

b.passo("6. o que vem do Controle aparece junto");
b.ok(r.relatorio.indexOf("011/2026") >= 0 && r.relatorio.indexOf("Escola Parada") >= 0,
  "ofício parado na base antiga também é cobrado",
  "olhar só a fila esconderia o que ficou para trás na migração");

b.passo("7. a fila VENCE o Controle no mesmo número");
/* Regra do dashboard: a fila reflete o estado mais recente do envio. */
const cc = ss.getSheetByName(g.PLANILHA_REGISTRO);
cc.getRange(4, 1, 1, 4).setValues([["022/2026", "Escola Errada", "naoexiste@x.com", "ENVIADO"]]);
const r2 = g.oficiosQueNaoChegaram(TOKEN);
b.igual(r2.porGrupo.ERRO_PERMANENTE, 2,
  "o 022 continua em erro — a fila manda, não o Controle desatualizado");

b.passo("8. SÓ LÊ — nenhuma linha muda");
/* Um diagnóstico que conserta sozinho é um diagnóstico em que ninguém confia
   para rodar. Reenviar é decisão de quem opera. */
const antes = ss.getSheetByName("FILA_ENVIO_OFICIOS")
  .getRange(2, 1, 5, 7).getValues().map(l => l.join("|")).join("\n");
g.oficiosQueNaoChegaram(TOKEN);
const depois = ss.getSheetByName("FILA_ENVIO_OFICIOS")
  .getRange(2, 1, 5, 7).getValues().map(l => l.join("|")).join("\n");
b.igual(depois, antes, "a fila está exatamente como estava antes de rodar");

b.passo("9. fila limpa diz isso com todas as letras");
const f2 = ss.getSheetByName("FILA_ENVIO_OFICIOS");
f2.getRange(2, 4, 5, 1).setValues([["ENVIADO"], ["ENVIADO"], ["ENVIADO"], ["ENVIADO"], ["ENVIADO"]]);
cc.getRange(3, 4).setValue("ENVIADO");
const r3 = g.oficiosQueNaoChegaram(TOKEN);
b.igual(r3.precisamDeGente, 0, "nada parado");
b.ok(/Nenhum of[íi]cio parado/.test(r3.relatorio),
  "e o relatório afirma isso, em vez de devolver lista vazia",
  "lista vazia se confunde com 'não consegui ler'");

b.naoTestavel(
  "quantos ofícios estão parados HOJE na produção",
  "esta função existe justamente para responder isso, e a resposta só sai " +
  "rodando lá. O que se prova aqui é que ela conta certo e não altera nada"
);

b.resumo();
