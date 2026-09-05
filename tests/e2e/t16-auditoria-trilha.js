/**
 * TESTE — TRILHA DE ALTERAÇÕES (tela 16.3)
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * Ele prova o backend que a tela consome. A TELA em si — se o filtro
 * preenche, se o modal abre, se o card do dashboard cai na lista filtrada —
 * é **NÃO TESTADA** aqui, porque o emulador não tem DOM. O roteiro manual
 * vai junto no fim.
 *
 * O que ele prova por execução: o filtro por período pega o dia inteiro nas
 * duas pontas, a lista avisa quando esconde registro, os seletores só
 * oferecem o que existe na trilha, e a permissão nega quem não tem o módulo.
 *
 * A parte que mais importa é o passo 6. Uma trilha que corta o resultado em
 * silêncio faz alguém concluir "não teve movimento nesse dia" olhando para
 * uma lista truncada. Numa fiscalização isso é pior que não ter tela.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* Semeia a trilha com datas conhecidas. auditar_ aceita dataHora explícita —
   sem isso não dá para testar filtro de período com fidelidade. */
function semear(quando, dados) {
  return g.auditar_(Object.assign({ dataHora: quando }, dados));
}

/* Linha de base ANTES de semear.
 *
 * Desde que o login passou a ser auditado (t19), entrar no sistema já
 * escreve na trilha — e b.logar() acima entrou duas vezes. Contar a trilha
 * inteira supondo que só existe o que este arquivo semeou passou a ser
 * falso. Comparar contra a base é o que sobrevive ao próximo ponto de log
 * que for ligado. */
const BASE = g.auditoriaConsultar({}, ADM).acoes.length;

const DIA_1 = new Date(2026, 6, 10, 9, 30, 0);    // 10/07/2026 09:30
const DIA_2_CEDO = new Date(2026, 6, 15, 0, 5, 0); // 15/07/2026 00:05
const DIA_2_TARDE = new Date(2026, 6, 15, 23, 50, 0); // 15/07/2026 23:50
const DIA_3 = new Date(2026, 6, 20, 14, 0, 0);    // 20/07/2026 14:00

semear(DIA_1, { registroId: "OF-100", modulo: "Documentos", submodulo: "Ofícios",
  acao: "EMITIR", usuario: "marcelha@sindeducacao.com" });
semear(DIA_2_CEDO, { registroId: "DESP-200", modulo: "Financeiro", submodulo: "Pagamentos",
  acao: "LANCAR_NO_BANCO", usuario: "rogerio@sindeducacao.com",
  valorAnterior: { status: "APROVADA", valor: 1250 },
  valorNovo: { status: "LANCADA", valor: 1250 } });
semear(DIA_2_TARDE, { registroId: "DESP-201", modulo: "Financeiro",
  acao: "CANCELAR", usuario: "rogerio@sindeducacao.com", resultado: "FALHA" });
semear(DIA_3, { registroId: "AG-300", modulo: "Assembleias",
  acao: "DELIBERAR", usuario: "wanderson@sindeducacao.com" });

/* ══════════ 1. PERÍODO ══════════ */
b.fluxo("TRILHA · Filtro por período");

b.passo("1. O dia inicial entra desde 00:00");
// Um registro das 00:05 do dia 15 tem que aparecer quando se filtra "de 15".
const de15 = g.auditoriaConsultar({ de: "2026-07-15" }, ADM);
const temCedo = (de15.acoes || []).some(a => a.registroId === "DESP-200");
b.ok(temCedo, "registro de 00:05 do dia inicial aparece",
  de15.acoes.length + " ação(ões) de 15/07 em diante");

b.passo("2. O dia final entra até 23:59");
// Esta é a que quebra na maioria dos sistemas: "até 15/07" vira 15/07 00:00
// e some tudo que foi feito naquele dia. O registro das 23:50 é a prova.
const ate15 = g.auditoriaConsultar({ ate: "2026-07-15" }, ADM);
const temTarde = (ate15.acoes || []).some(a => a.registroId === "DESP-201");
b.ok(temTarde, "registro de 23:50 do dia final aparece", "DESP-201 presente");

b.passo("3. E o que está fora do período fica fora");
const soDia15 = g.auditoriaConsultar({ de: "2026-07-15", ate: "2026-07-15" }, ADM);
const ids = (soDia15.acoes || []).map(a => a.registroId).sort();
b.ok(ids.length === 2 && ids.indexOf("OF-100") === -1 && ids.indexOf("AG-300") === -1,
  "só as ações do dia pedido", ids.join(", "));

b.passo("4. Data inválida não vira filtro silencioso");
// "abacaxi" como data não pode ser interpretado como hoje, nem como 1970 —
// nos dois casos o resultado sairia errado sem ninguém perceber.
const lixo = g.auditoriaConsultar({ de: "abacaxi" }, ADM);
b.ok(lixo.acoes.length === BASE + 4, "entrada inválida é ignorada, não estreita o resultado",
  lixo.acoes.length + " de " + (BASE + 4) + " ações");

/* ══════════ 2. TRUNCAMENTO — O PASSO QUE MAIS IMPORTA ══════════ */
b.fluxo("TRILHA · Aviso de resultado cortado");

b.passo("5. Quando cabe tudo, não avisa nada");
const completo = g.auditoriaConsultar({}, ADM);
b.ok(completo.truncado === false && completo.total === BASE + 4,
  "sem aviso e com o total certo", completo.total + " ações, truncado=" + completo.truncado);

b.passo("6. Quando corta, DIZ que cortou e quanto existe");
const cortado = g.auditoriaConsultar({ limite: 2 }, ADM);
b.ok(cortado.acoes.length === 2 && cortado.truncado === true && cortado.total === BASE + 4,
  "devolve 2, informa quantas existem",
  cortado.acoes.length + " exibidas de " + cortado.total + " · truncado=" + cortado.truncado);

b.passo("7. E o que ficou são os mais recentes, não os primeiros");
// Cortar pelos mais antigos esconderia justamente o que acabou de acontecer.
b.ok(cortado.acoes[0].registroId === "AG-300",
  "a mais nova vem primeiro", cortado.acoes.map(a => a.registroId).join(" → "));

/* ══════════ 3. OPÇÕES DOS FILTROS ══════════ */
b.fluxo("TRILHA · Seletores da tela");

b.passo("8. Oferece os módulos que existem na trilha");
const f = g.auditoriaFiltros(ADM);
b.ok(f.ok && f.modulos.indexOf("Financeiro") > -1 && f.modulos.indexOf("Documentos") > -1,
  "módulos vindos dos registros", f.modulos.join(", "));

b.passo("9. NÃO oferece módulo que nunca gravou nada");
// Se o filtro listasse "Patrimônio" e a trilha não tem uma ação de
// Patrimônio, quem consulta conclui que o módulo é limpo — quando na verdade
// ele nunca registrou nada. São coisas opostas.
b.ok(f.modulos.indexOf("Patrimônio") === -1,
  "módulo sem registro não aparece no filtro", "Patrimônio ausente, correto");

b.passo("10. Usuários e ações também saem da trilha");
b.ok(f.usuarios.length === 3 && f.acoes.indexOf("LANCAR_NO_BANCO") > -1,
  "3 usuários e as ações reais", f.usuarios.length + " usuários · " + f.acoes.length + " ações");

b.passo("11. Não repete e não devolve o marcador de vazio");
const semVazio = f.usuarios.indexOf("—") === -1 && f.modulos.indexOf("—") === -1;
const semRepetir = f.usuarios.length === new Set(f.usuarios).size;
b.ok(semVazio && semRepetir, "lista limpa e sem duplicata", f.usuarios.join(", "));

/* ══════════ 4. FILTROS COMBINADOS ══════════ */
b.fluxo("TRILHA · Filtros combinados");

b.passo("12. Módulo + período ao mesmo tempo");
const comb = g.auditoriaConsultar(
  { modulo: "Financeiro", de: "2026-07-15", ate: "2026-07-15" }, ADM);
b.ok(comb.acoes.length === 2 && comb.acoes.every(a => a.modulo === "Financeiro"),
  "as duas condições valem juntas", comb.acoes.length + " registro(s)");

b.passo("13. Busca por registro específico");
const porId = g.auditoriaConsultar({ registroId: "DESP-200" }, ADM);
b.ok(porId.acoes.length === 1 && porId.acoes[0].acao === "LANCAR_NO_BANCO",
  "a vida de um registro só", porId.acoes[0].modulo + " · " + porId.acoes[0].acao);

b.passo("14. Só críticas");
const crit = g.auditoriaConsultar({ apenasCriticas: true }, ADM);
b.ok(crit.acoes.length >= 2 && crit.acoes.every(a => a.critica === true),
  "nenhuma não-crítica passa", crit.acoes.map(a => a.acao).join(", "));

b.passo("15. Filtro sem resultado devolve lista vazia, não erro");
const nada = g.auditoriaConsultar({ registroId: "NAO-EXISTE-999" }, ADM);
b.ok(nada.ok === true && nada.acoes.length === 0,
  "a tela mostra 'nenhuma ação' em vez de quebrar", "ok=" + nada.ok);

/* ══════════ 5. O QUE A TELA PRECISA PARA DESENHAR ══════════ */
b.fluxo("TRILHA · Campos que a tela consome");

b.passo("16. Cada registro traz os campos da lista e do detalhe");
const um = g.auditoriaConsultar({ registroId: "DESP-200" }, ADM).acoes[0];
const precisa = ["dataHora","modulo","submodulo","acao","usuario","perfil","setor",
                 "origem","sessao","valorAnterior","valorNovo","justificativa",
                 "documento","resultado","critica"];
const falta = precisa.filter(c => !(c in um));
b.ok(falta.length === 0, "nada que a tela lê vem indefinido",
  falta.length ? "FALTOU: " + falta.join(", ") : precisa.length + " campos");

b.passo("17. A comparação antes/depois chega utilizável");
// A planilha guarda como texto; a tela faz JSON.parse. Se o que foi gravado
// não voltar parseável, o quadro "o que mudou" fica vazio na tela sem erro
// nenhum aparecer — falha silenciosa, a pior espécie.
let antes = um.valorAnterior;
if (typeof antes === "string") { try { antes = JSON.parse(antes); } catch (e) { antes = null; } }
b.ok(antes && antes.status === "APROVADA",
  "valorAnterior volta como objeto legível", JSON.stringify(antes));

b.passo("18. A fonte da leitura vem junto");
b.ok(completo.fonte === "PLANILHA",
  "a tela sabe dizer se está lendo a reserva ou o Firestore", completo.fonte);

b.passo("19. Resultado FALHA sobrevive à ida e volta");
const falhou = g.auditoriaConsultar({ registroId: "DESP-201" }, ADM).acoes[0];
b.ok(String(falhou.resultado).toUpperCase() === "FALHA",
  "a linha vermelha da tela tem em que se apoiar", falhou.resultado);

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("TRILHA · Permissão");

b.passo("20. Quem não tem o módulo não lê nem os filtros");
// O nome dos usuários e das ações já é informação sensível: revela quem
// trabalha em quê. Negar a consulta e liberar o filtro seria meia trava.
b.bloqueia(() => g.auditoriaConsultar({}, FIN), "auditoriaConsultar nega");
b.bloqueia(() => g.auditoriaFiltros(FIN), "auditoriaFiltros nega");

b.passo("21. Sem sessão");
b.bloqueia(() => g.auditoriaConsultar({}, ""), "nega token vazio");
b.bloqueia(() => g.auditoriaFiltros(""), "nega token vazio nos filtros");

/* ══════════ 7. A REGRESSÃO DE 06/08 — TELA TRAVADA EM SILÊNCIO ══════════ */
b.fluxo("TRILHA · Arranque da tela (regressão 06/08/2026)");

// Não dá para clicar sem DOM, mas dá para conferir a estrutura do arquivo —
// que é onde o defeito morava. A tela abriu, ficou em "Carregando…" para
// sempre e não emitiu erro nenhum: aCarregarFiltros() rodava primeiro,
// morria ao chamar uma função ausente no servidor (google.script.run lança
// SÍNCRONO nesse caso, sem passar pelo withFailureHandler) e aConsultar()
// nunca chegava a rodar.
const fs = require("fs");
const tela = fs.readFileSync(__dirname + "/../../AuditoriaTrilha.html", "utf8");
const init = tela.slice(tela.indexOf("window.initAuditoriaTrilha"));

// O arranque é o que vem DEPOIS das amarrações de evento. Medir o início da
// função pegaria a linha do botão "Atualizar", que também chama as duas — e
// foi assim que a primeira versão deste teste passou pelo motivo errado.
// Comentários fora antes de medir: o comentário que documenta este próprio
// defeito cita as duas funções pelo nome e inverteria o resultado.
function semComentarios(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
const arranque = semComentarios(
  init.slice(init.lastIndexOf("onclick"), init.indexOf("})();")));

b.passo("22. A trilha é buscada ANTES dos seletores, no arranque");
const posConsulta = arranque.indexOf("aConsultar()");
const posFiltros = arranque.indexOf("aCarregarFiltros()");
b.ok(posConsulta > -1 && posFiltros > -1 && posConsulta < posFiltros,
  "conteúdo antes do enfeite — quebrar o seletor não pode cegar a tela",
  "aConsultar em " + posConsulta + ", aCarregarFiltros em " + posFiltros);

b.passo("23. As duas chamadas do arranque são isoladas uma da outra");
const tries = (arranque.match(/try\s*\{/g) || []).length;
b.ok(tries >= 2, "cada uma no seu try — uma falhando não derruba a outra",
  tries + " blocos try no arranque");

b.passo("24. O texto de 'buscando' é diferente do texto estático do HTML");
// É o que permite ler um print: parado em "Carregando…" significa que a
// função nunca rodou; "Consultando o servidor…" significa que rodou e a
// resposta é que não veio. São dois defeitos diferentes.
b.ok(tela.indexOf(">Carregando…<") > -1 && tela.indexOf("Consultando o servidor") > -1,
  "os dois estados são distinguíveis num print", "estático ≠ em andamento");

b.passo("25. Existe cão de guarda para resposta que nunca chega");
b.ok(/setTimeout\([\s\S]{0,400}?aFalhaDura/.test(tela),
  "a tela desiste e explica, em vez de girar para sempre",
  "watchdog presente");

b.passo("26. Exceção dentro do handler de sucesso vira mensagem, não congelamento");
// withFailureHandler NÃO pega erro lançado dentro do withSuccessHandler.
// Sem este try, um campo inesperado na trilha congela a tela no texto
// anterior — exatamente o sintoma que se quer nunca mais ver.
// Buscar ".withFailureHandler" com o ponto: a palavra solta aparece dentro de
// um comentário logo acima e cortaria o trecho antes da hora.
const sucesso = tela.slice(tela.indexOf("withSuccessHandler"),
                           tela.indexOf(".withFailureHandler"));
b.ok(sucesso.indexOf("try {") > -1 && sucesso.indexOf("aFalhaDura") > -1,
  "handler de sucesso protegido", "try + aFalhaDura presentes");

b.passo("27. Toda falha escreve NA tela, não só no toast");
// Toast some em 5 segundos e nem aparece se a aba estiver em segundo plano.
const falhaDura = tela.slice(tela.indexOf("function aFalhaDura"));
b.ok(falhaDura.indexOf('aEl("audLista").innerHTML') > -1,
  "o motivo fica escrito na área da lista", "aFalhaDura escreve na tela");

b.naoTestavel("A tela AuditoriaTrilha.html",
  "sem DOM no emulador — roteiro manual: abrir Auditoria e Compliance › Trilha, " +
  "conferir a faixa âmbar de 'planilha de reserva', filtrar por um módulo, " +
  "clicar numa linha e ver os 14 campos no modal");
b.naoTestavel("Leitura vinda do Firestore",
  "o emulador não faz rede — o caminho testado aqui é sempre o da reserva");

b.resumo();
