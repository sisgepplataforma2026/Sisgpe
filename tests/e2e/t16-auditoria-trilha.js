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
b.ok(lixo.acoes.length === 4, "entrada inválida é ignorada, não estreita o resultado",
  lixo.acoes.length + " de 4 ações");

/* ══════════ 2. TRUNCAMENTO — O PASSO QUE MAIS IMPORTA ══════════ */
b.fluxo("TRILHA · Aviso de resultado cortado");

b.passo("5. Quando cabe tudo, não avisa nada");
const completo = g.auditoriaConsultar({}, ADM);
b.ok(completo.truncado === false && completo.total === 4,
  "sem aviso e com o total certo", completo.total + " ações, truncado=" + completo.truncado);

b.passo("6. Quando corta, DIZ que cortou e quanto existe");
const cortado = g.auditoriaConsultar({ limite: 2 }, ADM);
b.ok(cortado.acoes.length === 2 && cortado.truncado === true && cortado.total === 4,
  "devolve 2, informa que existem 4",
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

b.naoTestavel("A tela AuditoriaTrilha.html",
  "sem DOM no emulador — roteiro manual: abrir Auditoria e Compliance › Trilha, " +
  "conferir a faixa âmbar de 'planilha de reserva', filtrar por um módulo, " +
  "clicar numa linha e ver os 14 campos no modal");
b.naoTestavel("Leitura vinda do Firestore",
  "o emulador não faz rede — o caminho testado aqui é sempre o da reserva");

b.resumo();
process.exit(0);
