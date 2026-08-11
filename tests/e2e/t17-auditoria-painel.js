/**
 * TESTE — DASHBOARD DE AUDITORIA (tela 16.1)
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * O clique. Sem DOM, não dá para clicar num card e ver a trilha abrir
 * filtrada. O que dá para provar por execução é o que sustenta o clique:
 * que cada filtro que um card carrega devolve exatamente a contagem que
 * aquele card exibe.
 *
 * É essa a verificação que importa aqui. A DIRETRIZ DE DASHBOARDS do
 * PROMPT-MESTRE manda os cards serem clicáveis e proíbe dashboard
 * decorativo — e a pior forma de decoração não é o card que não clica, é o
 * card que clica e abre uma lista com outro número. Aí a pessoa para de
 * confiar na tela inteira, e com razão.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

const AGORA = new Date();
const ONTEM = new Date(AGORA.getTime() - 24 * 3600 * 1000);

// 3 de hoje (2 críticas, 1 falha), 2 de ontem.
g.auditar_({ dataHora: AGORA, registroId: "D-1", modulo: "Financeiro", submodulo: "Pagamentos",
  acao: "LANCAR_NO_BANCO", usuario: "rogerio@sindeducacao.com" });
g.auditar_({ dataHora: AGORA, registroId: "D-2", modulo: "Financeiro",
  acao: "CANCELAR", usuario: "rogerio@sindeducacao.com", resultado: "FALHA" });
g.auditar_({ dataHora: AGORA, registroId: "D-3", modulo: "Documentos", submodulo: "Ofícios",
  acao: "EMITIR", usuario: "marcelha@sindeducacao.com" });
g.auditar_({ dataHora: ONTEM, registroId: "D-4", modulo: "Documentos",
  acao: "EMITIR", usuario: "marcelha@sindeducacao.com" });
g.auditar_({ dataHora: ONTEM, registroId: "D-5", modulo: "Assembleias",
  acao: "DELIBERAR", usuario: "wanderson@sindeducacao.com" });

const p = g.auditoriaPainel(ADM);

/* ══════════ 1. OS NÚMEROS ══════════ */
b.fluxo("PAINEL · Contagens");

b.passo("1. O painel responde com tudo que a tela desenha");
const campos = ["ok","fonte","total","hoje","criticas","falhas","porModulo","ultimas","dataHoje"];
const falta = campos.filter(c => !(c in p));
b.ok(falta.length === 0, "nada que a tela lê vem indefinido",
  falta.length ? "FALTOU: " + falta.join(", ") : campos.length + " campos");

b.passo("2. Total");
b.ok(p.total === 5, "conta a trilha inteira", p.total + " ações");

b.passo("3. Hoje separa de ontem");
b.ok(p.hoje === 3, "só as de hoje", p.hoje + " de " + p.total);

b.passo("4. Críticas");
// LANCAR_NO_BANCO, CANCELAR e DELIBERAR? Não — DELIBERAR não está no
// catálogo de ações críticas. As críticas são as duas primeiras.
b.ok(p.criticas === 2, "só as que mexem em dinheiro ou desfazem", p.criticas + " críticas");

b.passo("5. Falhas");
b.ok(p.falhas === 1, "só o que não se concluiu", p.falhas + " falha(s)");

b.passo("6. Por módulo");
b.ok(p.porModulo.Financeiro === 2 && p.porModulo.Documentos === 2 && p.porModulo.Assembleias === 1,
  "agrupamento certo", JSON.stringify(p.porModulo));

b.passo("7. Últimas ações, no máximo dez e da mais nova para a mais velha");
b.ok(p.ultimas.length === 5 && p.ultimas[0].registroId === "D-5",
  "ordem decrescente", p.ultimas.map(a => a.registroId).join(" → "));

/* ══════════ 2. O QUE FAZ O CARD NÃO SER DECORATIVO ══════════ */
b.fluxo("PAINEL · Cada card leva à lista com o mesmo número (DIRETRIZ DE DASHBOARDS)");

// A tela monta cada card com um filtro embutido. Aqui se aplica o MESMO
// filtro na consulta e confere que a contagem bate. Se divergir, o card
// mente — e num painel de auditoria isso é grave, porque o número é o que
// leva alguém a investigar ou não.

b.passo("8. Card HOJE → trilha filtrada por hoje");
const doCardHoje = g.auditoriaConsultar({ de: p.dataHoje, ate: p.dataHoje }, ADM);
b.ok(doCardHoje.acoes.length === p.hoje,
  "o card diz " + p.hoje + " e a lista abre com " + doCardHoje.acoes.length, "");

b.passo("9. Card AÇÕES CRÍTICAS → trilha filtrada por críticas");
const doCardCrit = g.auditoriaConsultar({ apenasCriticas: true }, ADM);
b.ok(doCardCrit.acoes.length === p.criticas,
  "o card diz " + p.criticas + " e a lista abre com " + doCardCrit.acoes.length, "");

b.passo("10. Card FALHAS → trilha filtrada por resultado FALHA");
const doCardFalha = g.auditoriaConsultar({ resultado: "FALHA" }, ADM);
b.ok(doCardFalha.acoes.length === p.falhas,
  "o card diz " + p.falhas + " e a lista abre com " + doCardFalha.acoes.length, "");

b.passo("11. E as que a lista devolve são mesmo falhas");
b.ok(doCardFalha.acoes.every(a => String(a.resultado).toUpperCase() === "FALHA"),
  "o filtro de resultado não deixa passar sucesso",
  doCardFalha.acoes.map(a => a.registroId + ":" + a.resultado).join(", "));

b.passo("12. Card TOTAL → trilha sem filtro");
const doCardTotal = g.auditoriaConsultar({}, ADM);
b.ok(doCardTotal.acoes.length === p.total,
  "o card diz " + p.total + " e a lista abre com " + doCardTotal.acoes.length, "");

b.passo("13. Cada linha de MOVIMENTO POR MÓDULO leva ao seu módulo");
const divergentes = Object.keys(p.porModulo).filter(function (mod) {
  return g.auditoriaConsultar({ modulo: mod }, ADM).acoes.length !== p.porModulo[mod];
});
b.ok(divergentes.length === 0,
  "as três linhas batem com a lista que abrem",
  divergentes.length ? "DIVERGEM: " + divergentes.join(", ")
                     : Object.keys(p.porModulo).length + " módulo(s) conferido(s)");

/* ══════════ 3. HONESTIDADE DOS NÚMEROS ══════════ */
b.fluxo("PAINEL · O painel não finge");

b.passo("14. Diz de onde leu");
b.ok(p.fonte === "PLANILHA",
  "quem olha sabe se é o registro imutável ou a reserva editável", p.fonte);

b.passo("15. O dia de referência vem de QUEM CONTOU, não do navegador");
// Se a tela calculasse "hoje" por conta própria, o relógio do servidor e o
// do navegador discordariam perto da meia-noite: o card diria 3 e a lista
// abriria com 2.
//
// Comparar a data com um formatDate do emulador NÃO prova isto — o
// formatDate do emulador ignora o fuso e devolve o mesmo valor para São
// Paulo, Tóquio e GMT+14. A primeira versão deste passo fazia exatamente
// essa comparação e passava pelo motivo errado; trocar o fuso no .gs não
// derrubava nada.
//
// O que se verifica de fato: o painel devolve a data, e a tela usa ESSA,
// sem construir data nenhuma no cliente.
const fsP = require("fs");
const telaPainel = fsP.readFileSync(__dirname + "/../../AuditoriaPainel.html", "utf8");
const usaDoServidor = /de:\s*r\.dataHoje/.test(telaPainel) && /ate:\s*r\.dataHoje/.test(telaPainel);
const inventaData = /new Date\(\)[\s\S]{0,80}(toISOString|getFullYear)/.test(telaPainel);
b.ok(/^\d{4}-\d{2}-\d{2}$/.test(String(p.dataHoje)) && usaDoServidor && !inventaData,
  "o card filtra pela data que o servidor mandou",
  "dataHoje=" + p.dataHoje + " · usa r.dataHoje=" + usaDoServidor +
  " · monta data no cliente=" + inventaData);

b.passo("16. Trilha pequena não é marcada como truncada");
b.ok(p.truncado === false && p.contadas === p.total,
  "sem aviso falso de corte", "contadas=" + p.contadas + " total=" + p.total);

/* ══════════ 4. PERMISSÃO ══════════ */
b.fluxo("PAINEL · Permissão");

b.passo("17. Quem não tem o módulo não vê nem os números");
// O painel resume o que todo mundo fez no sindicato. Contagem por módulo já
// entrega quem trabalhou em quê.
b.bloqueia(() => g.auditoriaPainel(FIN), "auditoriaPainel nega");

b.passo("18. Sem sessão");
b.bloqueia(() => g.auditoriaPainel(""), "nega token vazio");

b.naoTestavel("Comportamento do fuso horário na virada do dia",
  "o formatDate do emulador ignora o argumento de fuso — devolve o mesmo valor " +
  "para São Paulo, Tóquio e GMT+14. Só o Apps Script real decide isto; " +
  "verificar abrindo o painel perto da meia-noite");
b.naoTestavel("O clique nos cards e nas linhas",
  "sem DOM no emulador — roteiro manual: abrir Auditoria e Compliance, clicar " +
  "no card 'Hoje' e conferir que a trilha abre com o mesmo número; repetir " +
  "para críticas, falhas e uma linha de módulo");

b.resumo();
process.exit(0);
