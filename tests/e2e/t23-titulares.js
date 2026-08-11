/**
 * TESTE — LGPD: INVENTÁRIO E DIREITOS DO TITULAR (tela 16.8)
 *
 * DUAS COISAS QUE ESTE TESTE EXISTE PARA IMPEDIR
 *
 * 1. Que o inventário minta. Ele é um documento que se APRESENTA numa
 *    fiscalização. Se disser "8.014 associados" quando a base tem outro
 *    número, ou declarar expurgo automático onde não há, o documento passa a
 *    trabalhar contra o sindicato.
 *
 * 2. Que alguém marque um pedido de exclusão como respondido achando que o
 *    sistema apagou. Esta tela REGISTRA o atendimento; executar o direito é
 *    ato humano. O passo 14 trava que a tela diz isso por escrito.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* Semeia a base com o cabeçalho REAL, para o inventário ter o que contar. */
(function semear() {
  const cols = g.SIND_ASS_COLUNAS;
  let a = ss.getSheetByName(g.SIND_ASS_ABA) || ss.insertSheet(g.SIND_ASS_ABA);
  a.getRange(1, 1, 1, cols.length).setValues([cols]);
  const linha = (nome) => {
    const l = cols.map(() => "");
    l[cols.indexOf("Nome")] = nome;
    l[cols.indexOf("CPF")] = "12345678901";
    l[cols.indexOf("Filiado")] = "S";
    return l;
  };
  a.getRange(2, 1, 3, cols.length).setValues([linha("A"), linha("B"), linha("C")]);
})();

function porId(id) {
  return g.titPainel(ADM).pedidos.filter(x => x.id === id)[0];
}

/* ══════════ 1. INVENTÁRIO ══════════ */
b.fluxo("LGPD · Inventário — o documento que se apresenta");

const p0 = g.titPainel(ADM);

b.passo("1. O inventário lista onde há dado pessoal");
b.ok(p0.inventario.length >= 5 &&
     p0.inventario.every(x => x.onde && x.dados && x.base && x.guarda),
  "cada linha diz onde, o quê, por que base e por quanto tempo",
  p0.inventario.length + " origens · " + p0.inventario.map(x => x.onde).join(", "));

b.passo("2. O volume é CONTADO, não escrito à mão");
// Número escrito à mão envelhece e vira mentira num documento que se
// apresenta. Semeei 3 associados; o inventário tem que dizer 3.
const assoc = p0.inventario.filter(x => x.onde === "Base de Associados")[0];
b.ok(assoc.volume === 3, "conta as linhas reais da base",
  "declarou " + assoc.volume + ", a base tem 3");

b.passo("3. Volume desconhecido vira 'n/d', não zero");
// Zero afirma que não há dado. n/d afirma que não se contou. São coisas
// opostas, e num documento de compliance a diferença importa.
const visitas = p0.inventario.filter(x => x.onde === "Visitas")[0];
b.ok(visitas.volume === null, "não inventa número nem finge ausência", String(visitas.volume));

b.passo("4. Só declara expurgo automático onde ele existe de fato");
// Declarar expurgo que não roda é a pior linha possível deste documento.
// Ancorado no início de propósito: /Autom/i casa também com "NÃO
// automático", e a primeira versão deste passo contou 4 onde há 2 — a
// negação passou despercebida dentro da palavra que ela nega.
const comExpurgo = p0.inventario.filter(x => /^Autom/i.test(String(x.expurgo).trim()));
const semExpurgo = p0.inventario.filter(x => !/^Autom/i.test(String(x.expurgo).trim()));
b.ok(comExpurgo.length === 2 &&
     comExpurgo.every(x => /Visitas|Receita/.test(x.onde)) &&
     semExpurgo.some(x => x.onde === "Base de Associados"),
  "só Visitas e Receita, que são as que o LgpdRetencao.gs realmente apaga",
  comExpurgo.map(x => x.onde).join(" e "));

b.passo("5. O prazo de guarda das visitas vem da constante real");
b.ok(String(visitas.guarda).indexOf(String(g.VIS_LGPD_RETENCAO_ANOS_)) > -1,
  "o inventário e o expurgo dizem o mesmo número",
  visitas.guarda + " · código=" + g.VIS_LGPD_RETENCAO_ANOS_);

/* ══════════ 2. PEDIDOS ══════════ */
b.fluxo("LGPD · Pedidos do titular");

b.passo("6. Registrar cria o pedido em RECEBIDO");
const r1 = g.titRegistrar({
  tipo: "ACESSO", titularNome: "Maria Silva", titularContato: "maria@escola.com",
  descricao: "Quer saber quais dados o sindicato tem sobre ela"
}, ADM);
b.ok(r1.ok && /^TIT-\d{4}-\d{3}$/.test(r1.id), "ID sequencial por ano", r1.id);
b.ok(porId(r1.id).estado === "RECEBIDO", "nasce recebido", porId(r1.id).estado);

b.passo("7. Sem contato, não registra");
// Sem contato não há como responder — e não responder é o que gera a multa,
// mesmo com o pedido registrado direitinho.
const semContato = g.titRegistrar({ tipo: "ACESSO", titularNome: "João" }, ADM);
b.ok(semContato.ok === false, "exige por onde responder", semContato.mensagem);

b.passo("8. Tipo tem que ser um dos direitos do art. 18");
const tipoInvalido = g.titRegistrar({
  tipo: "QUALQUER_COISA", titularNome: "João", titularContato: "j@x.com"
}, ADM);
b.ok(tipoInvalido.ok === false, "não aceita direito inventado", tipoInvalido.mensagem);

b.passo("9. Data no futuro é recusada");
const futuro = g.titRegistrar({
  recebidoEm: new Date(Date.now() + 48*3600*1000),
  tipo: "ACESSO", titularNome: "João", titularContato: "j@x.com"
}, ADM);
b.ok(futuro.ok === false, "não dá para comprar prazo", futuro.mensagem);

/* ══════════ 3. O PRAZO DE 15 DIAS ══════════ */
b.fluxo("LGPD · O relógio do art. 19");

b.passo("10. Pedido antigo aparece como VENCIDO");
const antigo = g.titRegistrar({
  recebidoEm: new Date(Date.now() - 40 * 24 * 3600 * 1000),
  tipo: "ELIMINACAO", titularNome: "Carlos", titularContato: "carlos@x.com",
  descricao: "Pediu exclusão dos dados há mais de um mês"
}, ADM);
const inc = porId(antigo.id);
b.ok(inc.prazo.vencido === true, "o contador acusa o atraso",
  inc.prazo.diasRestantes + " dias");

b.passo("11. E entra na lista do que exige ação agora");
b.ok(g.titPainel(ADM).vencendo.some(x => x.id === antigo.id),
  "o alerta vermelho tem em que se apoiar", "");

b.passo("12. O prazo é em dias CORRIDOS, não úteis");
// O art. 19, II fala em 15 dias sem qualificar. Contar dias úteis daria
// mais folga do que a lei concede — e na dúvida sobre prazo, o lado seguro
// é o mais apertado.
const recente = g.titRegistrar({
  recebidoEm: new Date(Date.now() - 10 * 24 * 3600 * 1000),
  tipo: "CORRECAO", titularNome: "Ana", titularContato: "ana@x.com"
}, ADM);
const pr = porId(recente.id).prazo;
b.ok(pr.diasRestantes >= 4 && pr.diasRestantes <= 5,
  "10 dias corridos gastos de 15 deixam ~5", pr.diasRestantes + " dias restantes");

b.passo("13. Configurável pela CONFIG");
const cfg = ss.getSheetByName("CONFIG");
cfg.appendRow(["LGPD_PRAZO_TITULAR_DIAS", 30]);
b.ok(g.tit_prazoDias_() === 30, "a CONFIG manda", g.tit_prazoDias_() + " dias");
cfg.getRange(cfg.getLastRow(), 2).setValue(15);

/* ══════════ 4. A TELA NÃO PODE PROMETER EXECUÇÃO ══════════ */
b.fluxo("LGPD · Registrar não é executar");

b.passo("14. A tela diz por escrito que marcar como respondido não apaga nada");
// Sem esse aviso, alguém marca um pedido de exclusão como respondido
// achando que o sistema apagou — e o dado continua lá, com o registro
// dizendo que foi atendido. É a pior combinação possível.
const fs = require("fs");
const tela = fs.readFileSync(__dirname + "/../../AuditoriaLgpd.html", "utf8");
b.ok(/n[ãa]o executa nada/i.test(tela) && /ato humano/i.test(tela),
  "o aviso está na tela, não só no meu commit", "texto presente");

b.passo("15. Responder exige dizer o que foi respondido e por onde");
g.titAvancar(r1.id, "EM_ATENDIMENTO", {}, ADM);
const semTexto = g.titAvancar(r1.id, "RESPONDIDO", { resposta: "ok", canal: "e-mail" }, ADM);
b.ok(semTexto.ok === false, "'ok' não é resposta ao titular", semTexto.mensagem);

const semCanal = g.titAvancar(r1.id, "RESPONDIDO",
  { resposta: "Enviada a relação completa dos dados que o sindicato mantém" }, ADM);
b.ok(semCanal.ok === false, "sem canal, não fecha", semCanal.mensagem);

const respondeu = g.titAvancar(r1.id, "RESPONDIDO",
  { resposta: "Enviada a relação completa dos dados que o sindicato mantém", canal: "e-mail" }, ADM);
b.ok(respondeu.ok === true && porId(r1.id).estado === "RESPONDIDO" && !!porId(r1.id).respondidoPor,
  "com tudo, fecha e grava quem respondeu", porId(r1.id).respondidoPor);

b.passo("16. Negar exige justificativa mais longa que responder");
// O titular pode acionar a ANPD. A justificativa é o que o sindicato terá.
g.titAvancar(recente.id, "EM_ATENDIMENTO", {}, ADM);
const negaCurto = g.titAvancar(recente.id, "NEGADO", { resposta: "não cabe", canal: "e-mail" }, ADM);
b.ok(negaCurto.ok === false, "'não cabe' não é justificativa", negaCurto.mensagem);

/* ══════════ 5. ATRASO FICA REGISTRADO ══════════ */
b.fluxo("LGPD · O atraso não some do registro");

b.passo("17. Atender fora do prazo é anotado na trilha");
// Ninguém gosta de gravar isso. Mas é o que sustenta a defesa quando o
// atendimento foi de boa-fé com atraso justificável — e esconder o atraso
// seria falsear o próprio registro que existe para provar conformidade.
g.titAvancar(antigo.id, "EM_ATENDIMENTO", {}, ADM);
g.titAvancar(antigo.id, "RESPONDIDO",
  { resposta: "Dados eliminados conforme solicitado, com atraso por falha de triagem", canal: "e-mail" }, ADM);
const naTrilha = g.auditoriaConsultar({ registroId: antigo.id }, ADM).acoes;
const comAtraso = naTrilha.filter(a => String(a.justificativa).indexOf("FORA DO PRAZO") > -1);
b.ok(comAtraso.length >= 1, "o atraso fica escrito, não some",
  comAtraso.length ? comAtraso[0].justificativa : "não registrou o atraso");

b.passo("18. O nome do titular NÃO vai para a justificativa da trilha");
// A trilha é lida por mais gente e exportada com mais frequência que a aba
// de pedidos. O nome fica na aba; a trilha guarda o tipo do pedido.
const doRegistro = g.auditoriaConsultar({ acao: "REGISTRAR_PEDIDO_TITULAR" }, ADM).acoes;
const vazouNome = doRegistro.some(a => String(a.justificativa).indexOf("Maria Silva") > -1);
b.ok(vazouNome === false, "a trilha guarda o tipo do pedido, não quem pediu",
  doRegistro.length ? doRegistro[0].justificativa : "");

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("LGPD · Permissão");

b.passo("19. Registrar e atender exigem administrador");
b.bloqueia(() => g.titRegistrar({ tipo: "ACESSO", titularNome: "X", titularContato: "x@x.com" }, FIN),
  "titRegistrar nega não-admin");
b.bloqueia(() => g.titAvancar(r1.id, "RESPONDIDO", { resposta: "texto qualquer aqui", canal: "e-mail" }, FIN),
  "titAvancar nega não-admin");

b.passo("20. E quem não tem o módulo não vê o inventário");
// O inventário é o mapa de onde estão os dados pessoais do sindicato.
b.bloqueia(() => g.titPainel(FIN), "titPainel nega");
b.bloqueia(() => g.titPainel(""), "nega token vazio");

b.naoTestavel("A execução do direito em si",
  "esta tela registra o atendimento; apagar, corrigir ou exportar o dado é " +
  "ato humano nas telas dos módulos");
b.naoTestavel("O prazo de 15 dias",
  "art. 19, II — configurável em LGPD_PRAZO_TITULAR_DIAS; confirmar com o jurídico");
b.naoTestavel("A busca da trilha por titular",
  "a trilha indexa por registroId (nº de ofício, ID de ficha), não por CPF. " +
  "O botão 'ver trilha' só acha o que os módulos gravaram — hoje, ofícios");

b.resumo();
process.exit(0);
