/**
 * DASHBOARD EXECUTIVO — FASE 1 (06/11/2026). O usuário: "me mostra tudo o
 * que eu preciso saber: o que está pendente ... você precisa resolver isso";
 * "pode iniciar pela fase 1". Desenho: docs/PRODUTO-DASHBOARD-EXECUTIVO.md.
 *
 * Backend real (InicioExecutivo.gs), dados FICTÍCIOS.
 * Prova:
 *   - com o sistema vazio, nada quebra e nada aparece inventado;
 *   - cada número sai da fonte certa (fontes encenadas com valores conhecidos);
 *   - "Precisa de você agora" só traz o que é > 0, urgente primeiro;
 *   - fonte que FALHA some da tela e é listada como indisponível — nunca zero;
 *   - toda ação aponta para um módulo que existe no menu (MODS do index.html);
 *   - não tem boleto nem pagamento do China Park (decisão de 06/11).
 * NÃO PROVA: os números reais de produção (só no ar).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const T = b.logar(g, "wanderson");

const MODS = (() => {
  const s = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const i = s.indexOf("var MODS"); const j = s.indexOf("};", i);
  return new Set([...s.slice(i, j).matchAll(/^\s*([A-Za-z]\w*)\s*:\s*\[/gm)].map(m => m[1]));
})();

b.fluxo("PAINEL EXECUTIVO · servidor");
b.passo("1. Sistema vazio");
let r = g.getPainelExecutivoSISGEP(T);
b.ok(r.ok && r.tarefas.length === 0, "sem pendência, a lista 'Precisa de você agora' fica vazia", JSON.stringify(r.tarefas));
b.ok(r.resumo.assuntos === 0 && r.resumo.urgentes === 0, "resumo zerado de verdade");
b.ok(!JSON.stringify(r).match(/boleto|vencend|pagamento a confirmar/i), "nada de boleto nem pagamento do China Park");

b.passo("2. Com pendências (fontes encenadas)");
const orig = {};
const encenar = (nome, fn) => { orig[nome] = g[nome]; g[nome] = fn; };
encenar("caixaResumoDoDia", () => ({ ok: true, aTratar: 55, novosHoje: 12, caixa: "financeiro@", voucher: { aConferir: 5 },
  precisa: [{ assunto: "Pedido de voucher", nome: "Maria Exemplo", ha: "há 10 min", icone: "🎓" }] }));
encenar("getDashboardOficiosData", () => ({ resumo: { pendentes: 3, erros: 2, falhas: 15 } }));
encenar("oficiosConferenciaMensal", () => ({ ok: true, problemas: [{}, {}, {}, {}, {}, {}, {}] }));
encenar("ofdLinhas_", () => [{ ESTADO: "NOVA" }, { ESTADO: "LIDA" }, { ESTADO: "PREPARADA" }]);
const hoje = new Date(); const em3 = new Date(hoje.getTime() + 3 * 864e5).toISOString().slice(0, 10);
encenar("listarReservasParqueChina", () => [
  { status: "PENDENTE", dataSolicitacao: new Date().toISOString(), nomeSolicitante: "João Exemplo" },
  { status: "PENDENTE", dataSolicitacao: "2026-01-01" }, { status: "APROVADA", dataEntrada: em3 }, { status: "RECUSADA" }]);
encenar("cob_listarPainel", () => ({ ok: true, total: 10, recebidas: 4, pendentes: 6, competenciaLabel: "11/2026",
  linhas: [{ proximaAcao: "LEMBRETE_1" }, { proximaAcao: "SOLICITADA" }, { proximaAcao: null }] }));
encenar("inicio_contarNotasFiscaisAguardando_", () => 3);
encenar("inicio_contarEscolasCadastroIncompleto_", () => 6);
encenar("crcMapa_", () => ({ a: { CONFERIDO: "" }, b: { CONFERIDO: "CERTO" }, c: { STATUS: "FALHOU" } }));
r = g.getPainelExecutivoSISGEP(T);
const k = Object.fromEntries(r.kpis.map(x => [x.chave, x.n]));
b.igual(k, { urgente: 2, emails: 55, oficios: 20, guias: 6, notas: 3, beneficios: 7 }, "os 6 indicadores com os números das fontes");
b.igual(r.tarefas[0].sev + "|" + r.tarefas[0].area + "|" + r.tarefas[0].n, "URGENTE|OFÍCIOS|2", "o urgente vem primeiro: ofícios com erro");
const porArea = r.tarefas.map(x => x.area + ":" + x.n).join(" ");
b.ok(/E-MAILS:55/.test(porArea) && /BOLSAS:5/.test(porArea) && /CHINA PARK:2/.test(porArea) && /GUIAS:2/.test(porArea) && /GUIAS:6/.test(porArea)
  && /CONFERÊNCIA:7/.test(porArea) && /FICHAS:2/.test(porArea) && /NOTAS:3/.test(porArea) && /COMPROVANTES:1/.test(porArea) && /ESCOLAS:6/.test(porArea),
  "cada área com a sua pendência", porArea);
b.igual(r.resumo, { assuntos: r.tarefas.reduce((s, x) => s + x.n, 0), urgentes: 2 }, "o resumo é a soma da lista (não um número à parte)");
b.ok(r.areas.length === 7 && !r.areas.some(a => /Festa/.test(a.nome)), "7 áreas — sem a festa (o SISGEP não controla a festa este ano)", r.areas.map(a => a.nome).join(", "));
b.igual(r.indisponiveis, [], "nenhuma fonte indisponível (a festa não é mais lida)");
b.ok(r.areas.find(a => a.nome === "China Park").sub === "1 hospedagem na semana", "China Park: hospedagem aprovada nos próximos 7 dias");
b.ok(r.chegou.length === 2 && r.chegou.some(c => /Maria Exemplo/.test(c.de)) && r.chegou.some(c => /João Exemplo/.test(c.titulo)), "chegou agora: o e-mail e a reserva nova (só a de hoje)");

b.passo("3. Toda ação abre um módulo que existe");
const acoes = [].concat(r.tarefas, r.kpis, r.areas, r.chegou).map(x => x.acao).filter(Boolean);
const ruins = acoes.filter(a => !MODS.has(a.mod)).map(a => a.mod);
b.igual(ruins, [], "nenhuma ação aponta para módulo inexistente (" + acoes.length + " ações)");
b.ok(!acoes.some(a => a.mod === "comunicacao"), "e-mail abre a Caixa de E-mails, não o Painel do Dia antigo");

b.passo("4. Fonte que falha some — não vira zero");
encenar("getDashboardOficiosData", () => { throw new Error("planilha fora do ar"); });
r = g.getPainelExecutivoSISGEP(T);
b.ok(r.indisponiveis.includes("ofícios"), "ofícios listado como indisponível");
b.ok(r.kpis.find(x => x.chave === "oficios").n === null, "o indicador de ofícios fica sem número (a tela mostra '—')");
b.ok(!r.tarefas.some(x => x.area === "OFÍCIOS") && !r.areas.some(a => a.nome === "Ofícios"), "e nenhuma linha de ofício aparece com zero");
b.ok(r.kpis.find(x => x.chave === "emails").n === 55, "as outras fontes continuam");

Object.keys(orig).forEach(n => { g[n] = orig[n]; });
b.passo("5. Sessão inválida");
let barrou = false; try { g.getPainelExecutivoSISGEP("token-falso"); } catch (e) { barrou = true; }
b.ok(barrou, "sem sessão, não devolve nada");

b.naoTestavel("os números de produção", "abrir a Home em HML e conferir cada número com a tela do módulo");
b.resumo();
