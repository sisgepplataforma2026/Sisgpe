/** TESTE PONTA A PONTA — MÓDULO BENEFÍCIOS (China Park, reserva simples, oftalmo) */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_FIN = b.logar(g, "rogerio");   // financeiro+rh, SEM benefícios

const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/* ════════ CHINA PARK — do formulário público ao pagamento ════════ */
b.fluxo("BENEFÍCIOS · China Park — solicitação pública → aprovação → pagamento");

const pedido = {
  nomeSolicitante: "Maria Aparecida Souza", cpf: "111.444.777-35",
  telefone: "(27) 99999-1234", email: "maria@exemplo.com", escola: "Escola Modelo",
  chaleSolicitado: "QUALQUER_DISPONIVEL", dataEntrada: dias(10), dataSaida: dias(12),
  tipoReserva: "FIM_DE_SEMANA", quantidadePessoas: "3", solicitouColchaoExtra: "NAO",
  observacaoSolicitante: "Teste ponta a ponta"
};

b.passo("1. Solicitação pelo formulário público (sem login)");
const sol = g.solicitarReservaParqueChina(pedido);
b.ok(sol && sol.ok, "solicitarReservaParqueChina registra a solicitação",
  sol && sol.ok ? "ID " + sol.idReserva + " · status " + sol.status + " · R$ " + sol.valorTotal
                : "ERRO: " + (sol && sol.mensagem) + " " + JSON.stringify((sol || {}).erros || []));
const ID = sol && sol.idReserva;
b.ok(sol && sol.status === "PENDENTE", "nasce com status PENDENTE");

b.passo("2. Registro na planilha — ID, data, origem, valor");
const lin = ID && g.buscarReservaParqueChinaPorId_(ID);
b.ok(!!lin, "reserva encontrada na aba ReservasParqueChina");
if (lin) {
  const o = g.mapearLinhaParaObjetoParqueChina_(lin.valores);
  b.ok(!!o.dataSolicitacao, "grava data da solicitação", String(o.dataSolicitacao));
  b.ok(o.origem === "PORTAL_ASSOCIADO", "grava a origem", "origem: " + o.origem);
  b.ok(Number(o.valorTotal) > 0, "calcula valor total", "R$ " + o.valorTotal);
  b.ok(o.statusPagamento === "PENDENTE", "situação financeira inicial PENDENTE");
}

b.passo("3. Idempotência — clicar duas vezes em Enviar");
const sol2 = g.solicitarReservaParqueChina(pedido);
b.ok(sol2 && sol2.ok && sol2.reutilizada === true && sol2.idReserva === ID,
  "segundo envio idêntico NÃO cria reserva duplicada",
  sol2 ? "id devolvido: " + sol2.idReserva + " reutilizada=" + !!sol2.reutilizada : "");

b.passo("4. Notificação e confirmação por e-mail");
b.ok(amb.outbox.length >= 1, "sistema disparou e-mail ao registrar a solicitação",
  amb.outbox.map(m => m.to).join(" · ") || "nenhum e-mail");

b.passo("5. Bloqueio de antecedência (regra ANTECEDENCIA_MAXIMA_DIAS)");
const longe = Object.assign({}, pedido, { cpf: "529.982.247-25", dataEntrada: dias(75), dataSaida: dias(77) });
const solLonge = g.solicitarReservaParqueChina(longe);
if (solLonge && solLonge.ok) b.ok(true, "pedido para daqui a 75 dias é ACEITO");
else b.aviso("pedido para daqui a 75 dias é RECUSADO", (solLonge.erros || []).join(" | "));

b.passo("6. Disponibilidade — a suíte fica ocupada depois de aprovada?");
const antes = g.listarSuitesLivresParqueChina_(pedido.dataEntrada, pedido.dataSaida);
const apr = g.aprovarReservaParqueChina(ID, { suiteDefinida: "501", observacaoAdmin: "ok" }, TOKEN);
b.ok(apr && apr.ok, "aprovarReservaParqueChina aprova e define a suíte", apr && !apr.ok ? "ERRO: " + apr.mensagem : "suíte 501");
const depois = g.listarSuitesLivresParqueChina_(pedido.dataEntrada, pedido.dataSaida);
b.ok((antes || []).length - (depois || []).length === 1,
  "suíte aprovada some da lista de disponíveis", "antes " + (antes || []).length + " → depois " + (depois || []).length);

b.passo("7. Status após aprovação");
const o2 = g.mapearLinhaParaObjetoParqueChina_(g.buscarReservaParqueChinaPorId_(ID).valores);
b.ok(o2.status === "APROVADA", "status vira APROVADA", "status: " + o2.status);
b.ok(!!o2.responsavelAprovacao, "grava quem aprovou", "por: " + o2.responsavelAprovacao);
b.ok(!!o2.dataAprovacao, "grava a data da aprovação");

b.passo("8. Pagamento");
const pag = g.registrarPagamentoParqueChina(ID, { valorRecebido: o2.valorTotal, formaPagamento: "PIX" }, TOKEN);
b.ok(pag && pag.ok && pag.statusPagamento === "PAGO", "registrarPagamentoParqueChina quita a reserva",
  pag && !pag.ok ? "ERRO: " + pag.mensagem : "situação: " + (pag || {}).statusPagamento);

b.passo("9. Pagamento a maior deve ser recusado");
const maior = g.registrarPagamentoParqueChina(ID, { valorRecebido: Number(o2.valorTotal) + 500 }, TOKEN);
b.ok(maior && maior.ok === false, "pagamento acima do valor total é recusado", maior && maior.mensagem);

b.passo("10. Integração com o Financeiro — a receita aparece?");
const abaRec = g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("RECEITAS");
const nRec = abaRec ? abaRec.getLastRow() - 1 : 0;
b.ok(abaRec && nRec >= 1, "pagamento do benefício gera lançamento em RECEITAS", "linhas em RECEITAS: " + nRec);

b.passo("11. Auditoria — a trilha registrou cada passo?");
const abaAud = g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheets().find(s => /audit|historico/i.test(s.getName()) && /china|parque/i.test(s.getName()));
if (abaAud) b.ok(abaAud.getLastRow() - 1 >= 3, "trilha de auditoria com solicitação, aprovação e pagamento", abaAud.getName() + ": " + (abaAud.getLastRow() - 1) + " eventos");
else b.ok(false, "aba de auditoria do China Park existe", "não encontrada");

b.passo("12. Permissão — Rogério (Financeiro/RH) aprovando reserva de benefício");
b.bloqueia(() => g.aprovarReservaParqueChina(ID, { suiteDefinida: "502" }, TOKEN_FIN), "aprovação negada a usuário sem o módulo");

b.passo("13. Dados inválidos no formulário público");
const ruim = g.solicitarReservaParqueChina(Object.assign({}, pedido, { cpf: "000.000.000-00", nomeSolicitante: "" }));
b.ok(ruim && ruim.ok === false, "CPF inválido e nome vazio são recusados", (ruim.erros || []).join(" | ").slice(0, 110));

b.passo("14. Painel público expõe números internos?");
const dash = g.dashboardReservaParqueChina();
b.ok(dash && typeof dash.totalReservas !== "undefined", "dashboardReservaParqueChina responde SEM sessão",
  "total: " + dash.totalReservas + " · pendentes: " + dash.pendentes + " · aprovadas: " + dash.aprovadas);
b.aviso("Esses números são servidos ao formulário público, sem login", "qualquer um com o link vê o movimento do benefício");

/* ════════ RESERVA SIMPLES (Guriri / Assefaz) ════════ */
b.fluxo("BENEFÍCIOS · Reserva simples (Guriri Beach / Assefaz)");
b.passo("1. Criar reserva");
let rs; try { rs = g.criarReservaBeneficioSimples("GURIRI_BEACH", { nomeSolicitante: "João Teste", nome: "João Teste", cpf: "529.982.247-25", telefone: "27999990000", data: dias(15), dataEntrada: dias(15), dataSaida: dias(17), quantidade: 2, quantidadePessoas: 2 }, TOKEN); }
catch (e) { rs = { ok: false, mensagem: e.message }; }
b.ok(rs && rs.ok, "criarReservaBeneficioSimples registra", rs && !rs.ok ? "ERRO: " + rs.mensagem : JSON.stringify(rs).slice(0, 90));

b.passo("2. Listar");
let ls; try { ls = g.listarReservasBeneficioSimples("GURIRI_BEACH", {}, TOKEN); } catch (e) { ls = { erro: e.message }; }
b.ok(ls && !ls.erro, "listarReservasBeneficioSimples responde", ls && ls.erro ? "ERRO: " + ls.erro : JSON.stringify(ls).slice(0, 90));

/* ════════ OFTALMOLOGIA ════════ */
b.fluxo("BENEFÍCIOS · Agenda de oftalmologia");
["listarAgendamentosOftalmo", "obterConfigAgendaOftalmo", "oft_listarAgendamentos"].forEach(nome => {
  if (typeof g[nome] !== "function") return;
  b.passo(nome);
  try { const r = g[nome]({}, TOKEN); b.ok(r && !r.erro, nome + " responde", JSON.stringify(r).slice(0, 80)); }
  catch (e) { b.ok(false, nome + " responde sem exceção", "EXCEÇÃO: " + e.message); }
});

b.naoTestavel("Ofício de autorização de entrada no China Park (PDF)", "depende de template do Google Docs");
b.naoTestavel("Entrega dos e-mails ao hóspede e ao parque", "Gmail real");

b.resumo();
process.exit(0);
