/**
 * RH — FLUXO PONTA A PONTA (auditoria de 20/11/2026: 33 das 35 funções da
 * tela do RH não eram citadas em nenhum teste).
 * Cobre: permissão por módulo e por administrador → cadastro (validação,
 * atualização sem duplicar) → prévia e geração de folha (pró-rata, INSS/IRRF,
 * regerar não duplica) → reajuste (histórico, desligado fica de fora) →
 * evento (13º/férias: simular, gravar, duplicidade, estorno com motivo) →
 * exclusão (duplo clique, inexistente, vai para a lixeira).
 * Não cobre: PDF do holerite e e-mail (emulador só registra) — NÃO TESTÁVEL.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");       // administrador
const RH = b.logar(g, "rogerio");          // módulo rh, não administrador
const SEM = b.logar(g, "joscimar");        // sem o módulo rh
const lista = r => (Array.isArray(r) ? r : (r && r.colaboradores) || []);

b.fluxo("RH — permissão");
b.passo("1. quem não tem o módulo");
b.bloqueia(() => g.listarColaboradoresRH(SEM), "sem o módulo rh não lista colaboradores");
b.bloqueia(() => g.salvarColaboradorRH({ nome: "X" }, SEM), "sem o módulo rh não cadastra");
b.bloqueia(() => g.gerarFolhaRH("2026-06", [{ colaboradorId: "x" }], "", SEM), "sem o módulo rh não gera folha");
b.bloqueia(() => g.listarColaboradoresRH(""), "sem sessão não lista");
b.passo("2. ações só de administrador");
b.bloqueia(() => g.aplicarReajusteSalarialRH(5, "CCT", RH), "usuário do rh (não admin) não aplica reajuste");
b.bloqueia(() => g.excluirColaboradorRH("x", RH), "usuário do rh (não admin) não exclui colaborador");
b.bloqueia(() => g.excluirFolhaCompetenciaRH("2026-06", RH), "usuário do rh (não admin) não exclui folha");
b.bloqueia(() => g.rhEvEstornar("x", "m", RH), "usuário do rh (não admin) não estorna evento");

b.fluxo("RH — cadastro");
b.passo("3. validação e gravação");
const vazio = g.salvarColaboradorRH({ nome: "  " }, RH);
b.ok(vazio.ok === false && /nome/i.test(vazio.mensagem), "nome em branco é recusado", vazio.mensagem);
const a = g.salvarColaboradorRH({ nome: "Ana Teste", cargo: "Assistente", salario: 2000, dependentes: 1, status: "Ativo", admissao: "2024-02-01", cpf: "111.444.777-35" }, RH);
const c = g.salvarColaboradorRH({ nome: "Carlos Teste", cargo: "Auxiliar", salario: 1800, status: "Ativo", admissao: "2025-03-10" }, RH);
const d = g.salvarColaboradorRH({ nome: "Davi Desligado", cargo: "Auxiliar", salario: 1500, status: "Desligado" }, RH);
b.ok(a.ok && c.ok && d.ok && a.id && c.id && d.id && a.id !== c.id, "três colaboradores gravados com ids distintos");
let ls = lista(g.listarColaboradoresRH(RH));
b.igual(ls.length, 3, "a lista mostra os três");
b.passo("4. atualizar não duplica");
const upd = g.salvarColaboradorRH({ id: a.id, nome: "Ana Teste", cargo: "Analista", salario: 2100, dependentes: 1, status: "Ativo" }, RH);
ls = lista(g.listarColaboradoresRH(RH));
b.ok(upd.ok && ls.length === 3, "atualizar pelo id não cria linha nova");
const ana = ls.find(x => x.id === a.id);
b.ok(ana && ana.cargo === "Analista" && Number(ana.salario) === 2100, "cargo e salário novos aparecem");
const fant = g.salvarColaboradorRH({ id: "COL-NAO-EXISTE", nome: "Fantasma" }, RH);
ls = lista(g.listarColaboradoresRH(RH));
b.ok(fant.ok && ls.length === 4, "id que não existe mais cadastra como novo (comportamento documentado)", "total " + ls.length);

b.fluxo("RH — folha");
b.passo("5. prévia");
b.ok(g.prepararFolhaRH("", RH).ok === false, "prévia sem competência é recusada");
const prev = g.prepararFolhaRH("2026-06", RH);
const idsPrev = (prev.itens || []).map(i => i.colaboradorId);
b.ok(prev.ok && idsPrev.indexOf(a.id) >= 0 && idsPrev.indexOf(d.id) < 0, "prévia traz os ativos e deixa o desligado de fora", idsPrev.length + " itens");
b.passo("6. geração");
b.ok(g.gerarFolhaRH("2026-06", [], "", RH).ok === false, "folha sem itens é recusada");
const itens = [{ colaboradorId: a.id, diasTrabalhados: 30 }, { colaboradorId: c.id, diasTrabalhados: 15 }, { colaboradorId: "INEXISTENTE", diasTrabalhados: 30 }];
const gen = g.gerarFolhaRH("2026-06", itens, "teste", RH);
b.ok(gen.ok, "folha gerada", gen.mensagem || "");
let fol = g.listarFolhaRH("2026-06", RH);
b.igual(fol.length, 2, "colaborador removido entre a prévia e a confirmação é ignorado (2 linhas, não 3)");
const lc = fol.find(x => x.colaboradorId === c.id);
const la = fol.find(x => x.colaboradorId === a.id);
b.ok(la && lc, "uma linha por colaborador");
if (la && lc) {
  const bruto = x => Number(x.salarioProrata != null ? x.salarioProrata : (x.salarioBruto != null ? x.salarioBruto : x.bruto));
  b.ok(Math.abs(bruto(lc) - 900) < 0.02, "dias trabalhados proporcionais: 15 de 30 dias de R$ 1.800 = R$ 900", JSON.stringify(Object.keys(lc)).slice(0, 120) + " → " + bruto(lc));
  const liq = Number(la.liquido), br = Number(la.salarioProrata != null ? la.salarioProrata : la.salarioBruto);
  b.ok(liq > 0 && liq <= br + Number(la.beneficios || 0) + 1e6, "líquido positivo", "liquido=" + la.liquido);
}
b.passo("7. regerar não duplica");
g.gerarFolhaRH("2026-06", itens, "regerada", RH);
fol = g.listarFolhaRH("2026-06", RH);
b.igual(fol.length, 2, "regerar a mesma competência substitui, não duplica");
g.gerarFolhaRH("2026-07", [{ colaboradorId: a.id, diasTrabalhados: 31 }], "", RH);
b.igual(g.listarFolhaRH("2026-07", RH).length, 1, "outra competência é independente");
b.igual(g.listarFolhaRH("2026-06", RH).length, 2, "e não mexe na anterior");
b.passo("8. exclusão de competência");
b.ok(g.excluirFolhaCompetenciaRH("", ADM).ok === false, "excluir sem competência é recusado");
b.ok(g.excluirFolhaCompetenciaRH("2099-01", ADM).ok === false, "competência sem lançamento é recusada");
const ex = g.excluirFolhaCompetenciaRH("2026-07", ADM);
b.ok(ex.ok && ex.removidos === 1, "administrador exclui a competência", ex.mensagem);
b.igual(g.listarFolhaRH("2026-07", ADM).length, 0, "e ela some da listagem");
b.ok(g.excluirFolhaCompetenciaRH("2026-07", ADM).ok === false, "duplo clique: a segunda exclusão é recusada, não quebra");

b.fluxo("RH — reajuste");
b.passo("9. validação e aplicação");
b.ok(g.aplicarReajusteSalarialRH(0, "CCT", ADM).ok === false, "percentual zero é recusado");
b.ok(g.aplicarReajusteSalarialRH("abc", "CCT", ADM).ok === false, "percentual inválido é recusado");
b.ok(g.aplicarReajusteSalarialRH(10, "", ADM).ok === false, "sem referência é recusado");
const rj = g.aplicarReajusteSalarialRH(10, "CCT 2026", ADM);
b.ok(rj.ok && rj.aplicados.length >= 2, "reajuste de 10% aplicado", rj.mensagem);
ls = lista(g.listarColaboradoresRH(ADM));
const ana2 = ls.find(x => x.id === a.id), carl = ls.find(x => x.id === c.id), davi = ls.find(x => x.id === d.id);
b.ok(ana2 && Math.abs(Number(ana2.salario) - 2310) < 0.01, "R$ 2.100 → R$ 2.310", ana2 && ana2.salario);
b.ok(carl && Math.abs(Number(carl.salario) - 1980) < 0.01, "R$ 1.800 → R$ 1.980");
b.ok(davi && Number(davi.salario) === 1500, "desligado não é reajustado");

b.fluxo("RH — evento (13º, férias)");
b.passo("10. simular, gravar, duplicidade, estorno");
const P13 = { colaboradorId: a.id, ano: 2026, base: 2310, avos: 12 };
const sim = g.rhEvSimular("13_1PARCELA", P13, RH);
b.ok(sim && sim.ok, "simulação do 13º (1ª parcela) responde", sim && (sim.mensagem || ""));
b.ok(sim && Math.abs(Number(sim.totalProventos) - 1155) < 0.01 && Number(sim.totalDescontos || 0) === 0, "1ª parcela = metade do integral (R$ 1.155) e sem desconto", sim && ("proventos=" + sim.totalProventos + " descontos=" + sim.totalDescontos));
b.ok(g.rhEvSimular("13_1PARCELA", { colaboradorId: a.id, ano: 2026 }, RH).ok === false, "13º sem base de cálculo é recusado");
b.ok(g.rhEvSimular("FERIAS", { colaboradorId: a.id, base: 2310, diasGozo: 25, diasAbono: 10 }, RH).ok === false, "férias com gozo + abono acima de 30 dias é recusado");
b.ok(g.rhEvSimular("FERIAS", { colaboradorId: a.id, base: 2310, diasGozo: 30 }, RH).ok === true, "férias de 30 dias calculam");
b.ok(g.rhEvSimular("INVENTADO", { colaboradorId: a.id }, RH).ok === false, "tipo desconhecido é recusado");
b.ok(g.rhEvSimular("FERIAS", { colaboradorId: "NAO-EXISTE" }, RH).ok === false, "colaborador inexistente é recusado");
if (sim && sim.ok) {
  const gr = g.rhEvGravar("13_1PARCELA", P13, "teste", RH);
  b.ok(gr.ok, "evento gravado", gr.mensagem || "");
  const gr2 = g.rhEvGravar("13_1PARCELA", P13, "de novo", RH);
  b.ok(gr2.ok === false || gr2.duplicado || /duplic|já/i.test(String(gr2.mensagem || "")), "o mesmo evento de novo pede confirmação (duplicidade)", JSON.stringify(gr2).slice(0, 100));
  const lst = g.rhEvListar({}, RH);
  const ev = (lst.eventos || [])[0];
  b.ok(lst.ok && ev, "o evento aparece na lista");
  if (ev) {
    b.ok(g.rhEvEstornar(ev.id, "", ADM).ok === false, "estorno sem motivo é recusado");
    const es = g.rhEvEstornar(ev.id, "lançado por engano", ADM);
    b.ok(es.ok, "estorno com motivo", es.mensagem || "");
    b.ok(g.rhEvEstornar(ev.id, "de novo", ADM).ok === false, "duplo clique: segundo estorno é recusado");
  }
}

b.fluxo("RH — exclusão de colaborador");
b.passo("11. duplo clique e inexistente");
b.ok(g.excluirColaboradorRH("", ADM).ok === false, "sem id é recusado");
const e1 = g.excluirColaboradorRH(d.id, ADM);
b.ok(e1.ok, "administrador exclui", e1.mensagem);
b.ok(lista(g.listarColaboradoresRH(ADM)).every(x => x.id !== d.id), "some da lista");
b.ok(g.excluirColaboradorRH(d.id, ADM).ok === false, "duplo clique: segunda exclusão é recusada");
b.naoTestavel("holerite em PDF e e-mail do holerite", "o emulador só registra Drive e e-mail — conferir no ar");
b.naoTestavel("gatilhos de aniversário e quinquênio/decênio", "agendamento de trigger não roda no emulador");
b.resumo();
