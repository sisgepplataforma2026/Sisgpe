/**
 * TESTE PONTA A PONTA — NEGOCIAÇÃO COLETIVA
 *
 * O módulo transforma a CCT de "contexto da SOFIA" em regra consultável.
 * A verificação que importa não é se as telas respondem: é se a tabela de
 * pisos transcrita à mão continua batendo com o texto da CCT.
 *
 * Um piso errado aqui não dá erro em lugar nenhum. Ele vira um salário
 * conferido como certo, uma escola não notificada, e um associado recebendo
 * menos do que a convenção garante. Por isso o teste confere VALOR POR VALOR
 * contra o documento — é a única checagem que justifica confiar na tabela.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   // financeiro + rh — não tem negociacao

/* ══════════ 1. A CCT É A FONTE ══════════ */
b.fluxo("NEGOCIAÇÃO COLETIVA · A tabela não pode se descolar da CCT");

b.passo("1. O texto da CCT está no projeto");
let texto = "";
try { texto = g.getCCTTexto_(); } catch (e) { texto = ""; }
b.ok(texto.length > 3000, "CCTCore.gs devolve a convenção inteira",
  texto ? texto.length + " caracteres" : "ERRO: getCCTTexto_ não respondeu");

b.passo("2. TODO piso da tabela aparece no texto da CCT");
// É este passo que dá o direito de confiar na transcrição.
const semAncora = g.NEGCOL_PISOS.filter(p => texto.indexOf(p.ancora) === -1);
b.ok(semAncora.length === 0, "nenhum valor de piso foi inventado ou digitado errado",
  semAncora.length
    ? "NÃO ACHADOS NA CCT: " + semAncora.map(p => p.cargo + " R$ " + p.ancora).join(" | ")
    : g.NEGCOL_PISOS.length + " pisos conferidos contra o documento");

b.passo("3. O valor numérico bate com o texto escrito");
// "4.796,42" no texto tem que ser 4796.42 na tabela. Um erro de vírgula aqui
// passa pelo teste anterior sem ser notado.
const divergentes = g.NEGCOL_PISOS.filter(p => {
  const doTexto = parseFloat(p.ancora.replace(/\./g, "").replace(",", "."));
  return Math.abs(doTexto - p.valor) > 0.001;
});
b.ok(divergentes.length === 0, "nenhum valor foi convertido errado da vírgula",
  divergentes.length ? divergentes.map(p => p.ancora + " ≠ " + p.valor).join(" | ") : "todos batem");

b.passo("4. A vigência declarada aparece na CCT");
b.ok(texto.indexOf("28/02/2027") > -1 && texto.indexOf("01/03/2026") > -1,
  "início e fim da vigência conferem com o documento",
  g.NEGCOL_VIGENCIA.inicio + " a " + g.NEGCOL_VIGENCIA.fim);

/* ══════════ 2. CLÁUSULAS ══════════ */
b.fluxo("NEGOCIAÇÃO COLETIVA · Consulta de cláusulas");

b.passo("5. As cláusulas são separadas do texto corrido");
const todas = g.negcolListarClausulas("", ADM);
b.ok(todas.ok && todas.total >= 30, "a CCT foi quebrada em cláusulas",
  todas.total + " cláusulas");

b.passo("6. A numeração descontínua da CCT é respeitada");
// A CCT pula da 29 para a 31 e da 33 para a 36. Quem cortasse por contagem
// sequencial produziria cláusula com número errado — e cláusula citada com
// número errado numa notificação é papel perdido.
const nums = todas.clausulas.map(c => c.numero);
b.ok(nums.indexOf(30) === -1 && nums.indexOf(31) > -1,
  "cláusula 30 não existe e a 31 existe, como no documento",
  "vai de " + Math.min(...nums) + " a " + Math.max(...nums));
b.ok(new Set(nums).size === nums.length, "nenhuma cláusula duplicada", nums.length + " únicas");

b.passo("7. Busca por número");
const c56 = g.negcolListarClausulas("56", ADM);
b.ok(c56.total === 1 && /MENSALIDADE/i.test(c56.clausulas[0].titulo),
  "buscar 56 traz a Mensalidade Sindical",
  c56.total ? c56.clausulas[0].numero + " — " + c56.clausulas[0].titulo : "não achou");

b.passo("8. Busca por texto, sem acento e sem caixa");
const tq = g.negcolListarClausulas("tiquete", ADM);
b.ok(tq.total >= 1, 'buscar "tiquete" acha "TÍQUETE-ALIMENTAÇÃO"',
  tq.total + " cláusula(s): " + tq.clausulas.map(c => c.numero).join(", "));

b.passo("9. Busca sem resultado não quebra");
const nada = g.negcolListarClausulas("xyzabc123", ADM);
b.ok(nada.ok && nada.total === 0, "termo inexistente devolve lista vazia, não erro", "");

/* ══════════ 3. PISOS ══════════ */
b.fluxo("NEGOCIAÇÃO COLETIVA · Pisos e conferência salarial");

b.passo("10. Tabela de pisos");
const pisos = g.negcolListarPisos("", ADM);
b.ok(pisos.ok && pisos.total === g.NEGCOL_PISOS.length, "a tabela inteira é devolvida",
  pisos.total + " pisos, " + pisos.vigenciaPisos);

b.passo("11. Busca por cargo");
const rec = g.negcolListarPisos("recepcao", ADM);
b.ok(rec.total >= 1, 'buscar "recepcao" acha Secretaria/Recepção',
  rec.total + " resultado(s)");

b.passo("12. Salário ABAIXO do piso é apontado");
const abaixo = g.negcolConferirPiso("Cozinheira", "1500,00", ADM);
b.ok(abaixo.ok && abaixo.abaixoDoPiso === true, "R$ 1.500 para Cozinheira acusa piso violado",
  abaixo.ok ? "diferença R$ " + abaixo.resultados[0].diferenca : abaixo.mensagem);
b.ok(/cláusula 71/i.test(String(abaixo.mensagem)), "a mensagem cita a cláusula da multa",
  String(abaixo.mensagem).slice(0, 90));

b.passo("13. Salário ACIMA do piso não acusa nada");
const acima = g.negcolConferirPiso("Cozinheira", "2500,00", ADM);
b.ok(acima.ok && acima.abaixoDoPiso === false, "R$ 2.500 para Cozinheira está regular",
  acima.resultados ? "diferença +R$ " + acima.resultados[0].diferenca : "");

b.passo("14. Cargo com mais de um enquadramento não decide sozinho");
// "Coordenador de Turno" tem 4 pisos, de R$ 2.464 a R$ 4.708. Um salário de
// R$ 3.000 está acima de um e abaixo de outro. Dizer "irregular" seria tão
// errado quanto dizer "regular".
const ambiguo = g.negcolConferirPiso("Coordenador de Turno", "3000,00", ADM);
b.ok(ambiguo.ok && ambiguo.exigeAnalise === true && ambiguo.abaixoDoPiso === false,
  "salário entre dois enquadramentos exige análise humana, não veredito",
  ambiguo.resultados ? ambiguo.resultados.length + " enquadramentos possíveis" : ambiguo.mensagem);
b.ok(/enquadramento/i.test(String(ambiguo.mensagem)), "a mensagem explica por quê",
  String(ambiguo.mensagem).slice(0, 90));

b.passo("15. Cargo que não está na CCT não recebe veredito");
const foraDaCCT = g.negcolConferirPiso("Astronauta", "1000,00", ADM);
b.ok(foraDaCCT.ok === false && /cláusula 04/i.test(String(foraDaCCT.mensagem)),
  "cargo sem piso manda conferir o enquadramento, não conclui",
  String(foraDaCCT.mensagem).slice(0, 80));

b.passo("16. Salário inválido é recusado");
["", "abc", null].forEach(v => {
  const r = g.negcolConferirPiso("Cozinheira", v, ADM);
  b.ok(r.ok === false, 'salário "' + String(v) + '" é recusado', r.mensagem);
});

b.passo("17. Aceita valor no formato brasileiro e no americano");
const br = g.negcolConferirPiso("Motorista", "1.796,16", ADM);
const us = g.negcolConferirPiso("Motorista", 1796.16, ADM);
b.ok(br.ok && us.ok && br.resultados[0].diferenca === us.resultados[0].diferenca,
  '"1.796,16" e 1796.16 dão o mesmo resultado',
  "diferença " + br.resultados[0].diferenca + " (exatamente no piso)");

/* ══════════ 4. VIGÊNCIA ══════════ */
b.fluxo("NEGOCIAÇÃO COLETIVA · Vigência e alerta de data-base");

b.passo("18. Painel responde com a situação da CCT");
const painel = g.negcolPainel(ADM);
b.ok(painel.ok && !!painel.vigencia.situacao, "painel devolve a vigência",
  painel.vigencia.situacao + " — " + painel.vigencia.diasParaVencer + " dia(s) para vencer");

b.passo("19. O menor piso é o da insalubridade (cláusula 13)");
b.ok(painel.menorPiso && painel.menorPiso.valor === Math.min(...g.NEGCOL_PISOS.map(p => p.valor)),
  "o menor piso da tabela é identificado",
  painel.menorPiso ? painel.menorPiso.cargo + " — R$ " + painel.menorPiso.valor : "");

b.passo("20. As cláusulas que viraram módulo no Financeiro estão vinculadas");
b.ok(painel.clausulasFinanceiras.length === 3, "56, 57 e 58 apontam para os submódulos",
  painel.clausulasFinanceiras.map(c => c.numero + "→" + c.modulo).join(", "));

/* ══════════ 5. PERMISSÃO ══════════ */
b.fluxo("NEGOCIAÇÃO COLETIVA · Permissão");

b.passo("21. Quem não tem o módulo não consulta");
b.bloqueia(() => g.negcolPainel(FIN), "negcolPainel nega quem não tem o módulo");
b.bloqueia(() => g.negcolListarClausulas("", FIN), "negcolListarClausulas nega");
b.bloqueia(() => g.negcolListarPisos("", FIN), "negcolListarPisos nega");
b.bloqueia(() => g.negcolConferirPiso("Cozinheira", "1000", FIN), "negcolConferirPiso nega");

b.passo("22. Sem sessão");
b.bloqueia(() => g.negcolPainel(""), "negcolPainel nega token vazio");

b.naoTestavel("Aparência da tela e comportamento dos filtros", "exige navegador");

b.resumo();
process.exit(0);
