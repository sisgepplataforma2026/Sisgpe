/**
 * CHINA PARK (parte administrativa) — FLUXO PONTA A PONTA (auditoria de
 * 20/11/2026: 25 das 31 funções da tela admin não eram citadas em teste).
 * Permissão (módulo benefícios E administrador) → solicitação pública →
 * aprovação (suíte obrigatória) → conflito de suíte → pagamento (parcial,
 * total, acima do total) → check-in exige ofício → recusa/cancelamento/no-show
 * exigem motivo → duplo clique. Não cobre: PDF/e-mail do ofício e das
 * confirmações (emulador só registra) — NÃO TESTÁVEL.
 */
const b = require("./base");
const { g } = b.subir({});
const aba = b.seedUsuarios(g);
/* usuário com o módulo benefícios, mas NÃO administrador */
const hash = g.gerarHashSenha_("Senha@2026");
aba.getRange(5, 1, 1, 8).setValues([["carla", hash, "Carla", "carla@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios"]]);
const ADM = b.logar(g, "wanderson");
const BEN = b.logar(g, "carla");
const SEM = b.logar(g, "rogerio");
const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const sol = (cpf, n, sufixo, ini, fim, suite) => g.solicitarReservaParqueChina({
  nomeSolicitante: n, cpf, telefone: "(27) 99999-12" + sufixo, email: "x" + sufixo + "@exemplo.com",
  chaleSolicitado: suite || "QUALQUER_DISPONIVEL", dataEntrada: dias(ini), dataSaida: dias(fim),
  tipoReserva: "FIM_DE_SEMANA", quantidadePessoas: "3", solicitouColchaoExtra: "NAO" });

b.fluxo("CHINA PARK — permissão");
b.passo("1. módulo e administrador");
const s0 = sol("111.444.777-35", "Maria Souza", "34", 30, 32);
b.ok(s0.ok && s0.idReserva && s0.status === "PENDENTE", "solicitação pública entra como PENDENTE", JSON.stringify(s0).slice(0, 100));
b.bloqueia(() => g.aprovarReservaParqueChina(s0.idReserva, { suiteDefinida: "501" }, SEM), "sem o módulo benefícios não aprova");
b.bloqueia(() => g.aprovarReservaParqueChina(s0.idReserva, { suiteDefinida: "501" }, BEN), "com o módulo, mas sem ser administrador, não aprova");
b.bloqueia(() => g.registrarPagamentoParqueChina(s0.idReserva, { valorRecebido: 10 }, BEN), "não-administrador não registra pagamento");
b.bloqueia(() => g.cancelarReservaParqueChina(s0.idReserva, "x", BEN), "não-administrador não cancela");
b.bloqueia(() => g.getDashboardChinaPark({}, ""), "sem sessão não vê o painel");

b.fluxo("CHINA PARK — solicitação");
b.passo("2. validação e idempotência");
const inv = g.solicitarReservaParqueChina({ nomeSolicitante: "", cpf: "000.000.000-00", dataEntrada: dias(20), dataSaida: dias(19) });
b.ok(inv.ok === false, "dados inválidos (sem nome, CPF inválido, saída antes da entrada) são recusados", (inv.mensagem || "") + " " + JSON.stringify(inv.erros || []).slice(0, 80));
const s0b = sol("111.444.777-35", "Maria Souza", "34", 30, 32);
b.ok(s0b.ok && s0b.idReserva === s0.idReserva, "duplo clique: a mesma solicitação não cria reserva nova", s0b.idReserva + " vs " + s0.idReserva);

b.fluxo("CHINA PARK — aprovação");
b.passo("3. suíte obrigatória e específica");
const ap0 = g.aprovarReservaParqueChina(s0.idReserva, {}, ADM);
b.ok(ap0.ok === false && /su[ií]te/i.test(ap0.mensagem), "aprovar sem escolher suíte é recusado (não existe disponibilidade automática)", ap0.mensagem);
b.ok(g.aprovarReservaParqueChina(s0.idReserva, { suiteDefinida: "QUALQUER_DISPONIVEL" }, ADM).ok === false, "'qualquer disponível' não vale para aprovar");
b.ok(g.aprovarReservaParqueChina(s0.idReserva, { suiteDefinida: "999" }, ADM).ok === false, "suíte que não existe é recusada");
b.ok(g.aprovarReservaParqueChina("RES-NAO-EXISTE", { suiteDefinida: "501" }, ADM).ok === false, "reserva inexistente é recusada");
const ap = g.aprovarReservaParqueChina(s0.idReserva, { suiteDefinida: "501" }, ADM);
b.ok(ap.ok && ap.status === "APROVADA" && ap.suite === "501", "aprovada na suíte 501", ap.mensagem || "");
b.passo("4. conflito de suíte no mesmo período");
const s1 = sol("529.982.247-25", "José Lima", "56", 29, 31);
const ap1 = g.aprovarReservaParqueChina(s1.idReserva, { suiteDefinida: "501" }, ADM);
b.ok(s1.ok && ap1.ok === false && /ocupad|dispon/i.test(ap1.mensagem || ""), "aprovar OUTRA reserva na mesma suíte, em datas que se sobrepõem, é recusado", ap1.mensagem || "(aprovou — suíte dupla!)");
const man = g.criarAgendamentoManualParqueChina({ nomeSolicitante: "Balcão", cpf: "529.982.247-25", telefone: "(27) 99999-0000", email: "b@exemplo.com", suite: "501", dataEntrada: dias(30), dataSaida: dias(32), tipoReserva: "FIM_DE_SEMANA", quantidadePessoas: "2", solicitouColchaoExtra: "NAO" }, ADM);
b.ok(man.ok === false && /ocupada/i.test(man.mensagem || ""), "agendamento manual na suíte ocupada é recusado", man.mensagem || "");
const ap2 = g.aprovarReservaParqueChina(s1.idReserva, { suiteDefinida: "502" }, ADM);
b.ok(ap2.ok, "em suíte livre (502) a mesma reserva é aprovada");
b.passo("5. recusa e cancelamento exigem motivo");
const s2 = sol("390.533.447-05", "Paulo Reis", "78", 20, 22);
b.ok(g.recusarReservaParqueChina(s2.idReserva, "  ", ADM).ok === false, "recusar sem motivo é recusado");
b.ok(g.recusarReservaParqueChina(s2.idReserva, "sem vaga na data", ADM).ok, "recusar com motivo");
b.ok(g.aprovarReservaParqueChina(s2.idReserva, { suiteDefinida: "503" }, ADM).ok === false, "reserva recusada não pode ser aprovada depois");
b.ok(g.cancelarReservaParqueChina(s1.idReserva, "", ADM).ok === false, "cancelar sem motivo é recusado");
b.ok(g.cancelarReservaParqueChina(s1.idReserva, "desistência", ADM).ok, "cancelar com motivo");
b.ok(g.cancelarReservaParqueChina(s1.idReserva, "de novo", ADM).ok === false, "duplo clique: segundo cancelamento é recusado");
const ap3 = g.aprovarReservaParqueChina(sol("111.444.777-35", "Reaproveita Suite", "90", 29, 31).idReserva, { suiteDefinida: "502" }, ADM);
b.ok(ap3.ok, "suíte liberada pelo cancelamento volta a ficar disponível");

b.fluxo("CHINA PARK — pagamento");
b.passo("6. parcial, total, acima do total");
b.ok(g.registrarPagamentoParqueChina(s0.idReserva, { valorRecebido: -5 }, ADM).ok === false, "valor negativo é recusado");
const total = Number(ap.valorTotal);
b.ok(total > 0, "a reserva tem valor calculado", String(total));
b.ok(g.registrarPagamentoParqueChina(s0.idReserva, { valorRecebido: total + 1 }, ADM).ok === false, "valor acima do total é recusado");
const pp = g.registrarPagamentoParqueChina(s0.idReserva, { valorRecebido: total / 2, formaPagamento: "PIX" }, ADM);
b.ok(pp.ok && pp.statusPagamento === "PARCIAL" && Math.abs(pp.valorPendente - total / 2) < 0.01, "metade paga = PARCIAL, com o saldo certo", JSON.stringify(pp).slice(0, 110));
const pt = g.registrarPagamentoParqueChina(s0.idReserva, { valorRecebido: total, formaPagamento: "PIX" }, ADM);
b.ok(pt.ok && pt.statusPagamento === "PAGO" && pt.valorPendente === 0, "valor total = PAGO", JSON.stringify(pt).slice(0, 110));
b.ok(g.registrarPagamentoParqueChina(s2.idReserva, { valorRecebido: 10 }, ADM).ok === false, "reserva recusada não recebe pagamento");

b.fluxo("CHINA PARK — operação (check-in, check-out, no-show)");
b.passo("7. check-in exige o ofício de autorização");
const ci = g.registrarCheckinParqueChina(s0.idReserva, {}, ADM);
b.ok(ci.ok === false && ci.codigo === "OFICIO_PENDENTE", "check-in sem ofício emitido é barrado", ci.mensagem || "");
b.ok(g.registrarNoShowParqueChina(s0.idReserva, "", ADM).ok === false, "no-show sem motivo é recusado");
b.naoTestavel("emissão do ofício de autorização, PDF e e-mail de confirmação aos hóspedes", "PDF e e-mail só no ar; sem o ofício o check-in não tem como ser exercitado aqui");
b.passo("8. painel e relatório respondem");
const dash = g.getDashboardChinaPark({}, ADM);
b.ok(dash && dash.ok !== false, "painel do China Park responde", JSON.stringify(dash).slice(0, 90));
const rel = g.obterRelatorioParqueChina({}, ADM);
b.ok(rel && rel.ok !== false, "relatório responde", JSON.stringify(rel).slice(0, 90));
b.resumo();
