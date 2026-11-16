/**
 * TELEFONE SEM DDD: O DDD SAI DA CIDADE (16/11/2026). Caso real: o ingresso da Elisa (Vitória) veio do TickOne com
 * "99606-9084" e o botão do WhatsApp ficou travado. O usuário: "tem que verificar a cidade" e "se for sul é 028".
 * Só se deduz quando a CIDADE é do ES e o DDD é certo (27 Grande Vitória/centro/norte, 28 sul); cidade de outro estado, em
 * branco ou de DDD duvidoso NÃO é deduzida. A dedução aparece na linha ("DDD 27 assumido pela cidade") e o WhatsApp abre
 * no número com 55 + DDD. Dados FICTÍCIOS. NÃO PROVA: o WhatsApp receber a mensagem.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
b.fluxo("DDD pela cidade · regra");
const D = (c) => g.cingDddPorCidade_(c);
b.ok(D("Vitória") === "27" && D("VILA VELHA") === "27" && D("Serra") === "27" && D("  Cariacica ") === "27", "Grande Vitória: 27 (com acento, caixa alta e espaços)");
b.ok(D("Vitória - ES") === "27" && D("Linhares/ES") === "27" && D("Colatina, ES") === "27", "'cidade - ES' também vale");
b.ok(D("Cachoeiro de Itapemirim") === "28" && D("Guaçuí") === "28" && D("Marataízes") === "28" && D("Piúma") === "28", "sul do estado: 28 (o 028 do usuário; no WhatsApp vai sem o zero)");
b.ok(D("Belo Horizonte") === "" && D("São Paulo") === "" && D("") === "" && D(null) === "", "fora do ES ou em branco: NÃO deduz");
b.ok(D("Ibatiba") === "" && D("Venda Nova do Imigrante") === "", "cidade do ES de DDD duvidoso: NÃO deduz (melhor travar do que errar o número)");
const A = (t, c) => g.cingFoneAssumido_(t, c);
b.ok(A("99606-9084", "Vitória").fone === "5527996069084" && A("99606-9084", "Guaçuí").fone === "5528996069084", "9 dígitos + cidade: 55 + DDD + número (27 e 28)");
b.ok(A("99606-9084", "Salvador") === null && A("3333-4444", "Vitória") === null && A("(27) 99606-9084", "Vitória") === null && A("99606908", "Vitória") === null, "não mexe em telefone que já tem DDD, fixo de 8 dígitos ou número incompleto");
b.fluxo("DDD pela cidade · lista e tela");
const agora = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm: agora, evento: "x", total: 3, linhas: [
  { nome: "Elisa Fictícia de Oliveira", cpf: "52998224725", tel: "99606-9084", codigo: "ELI-0001", tipo: "Associado", escola: "Escola A", cidade: "Vitória", ref: "R1", zap: 0 },
  { nome: "Sul Fictício", cpf: "11144477735", tel: "99606-9085", codigo: "SUL-0002", tipo: "Associado", escola: "Escola B", cidade: "Cachoeiro de Itapemirim", ref: "R2", zap: 0 },
  { nome: "Mineira Fictícia", cpf: "39053344705", tel: "99606-9086", codigo: "MG-0003", tipo: "Associado", escola: "Escola C", cidade: "Belo Horizonte", ref: "R3", zap: 0 }] });
g.cingPdfs_ = () => ({});
g.compasso_dadosDaFesta_ = () => ({}); g.compasso_dataPorExtenso_ = () => "";
const li = g.compassoIngressos_lista(TOKEN).linhas;
b.ok(li[0].foneOk && li[0].fone === "5527996069084" && li[0].foneAssumido === "27" && !li[0].faltando.some(x => /telefone/.test(x)), "Vitória: o botão libera, com DDD 27 assumido, e não acusa mais 'falta telefone com DDD'");
b.ok(li[1].foneOk && li[1].fone === "5528996069085" && li[1].foneAssumido === "28", "Cachoeiro (sul): DDD 28");
b.ok(!li[2].foneOk && li[2].foneAssumido === "" && li[2].faltando.some(x => /telefone com DDD/.test(x)), "Belo Horizonte: continua travado e acusando a falta do DDD");
const m1 = g.compassoIngressos_mensagem("ELI-0001", TOKEN);
b.ok(m1.ok && /^https:\/\/wa\.me\/5527996069084\?text=/.test(m1.url), "o link do WhatsApp usa 55 + 27 + número");
b.ok(g.compassoIngressos_mensagem("MG-0003", TOKEN).ok === false && /Belo Horizonte/.test(g.compassoIngressos_mensagem("MG-0003", TOKEN).mensagem), "cidade que não serve: a mensagem diz que a cidade não permite deduzir o DDD");
if (dom.jsdomDisponivel()) {
  const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
  const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
  const abertos = []; win.open = u => { const w = { closed: false, close() { this.closed = true; } }; Object.defineProperty(w, "location", { value: { set href(v) { abertos.push(v); } } }); if (u && u !== "about:blank") abertos.push(u); return w; };
  (async function () {
    win.cingCarregar(); await t.assentar(400);
    const txt = el("ciLista").textContent;
    b.ok(/DDD 27 assumido pela cidade \(Vitória\)/.test(txt) && /DDD 28 assumido pela cidade \(Cachoeiro/.test(txt) && !/DDD \d+ assumido pela cidade \(Belo/.test(txt), "a linha mostra de onde veio o DDD (e só nas que foram deduzidas)");
    t.clicar("[data-ci='zap'][data-arg='ELI-0001']"); await t.assentar(500);
    b.ok(abertos.length === 1 && /^https:\/\/wa\.me\/5527996069084\?text=/.test(abertos[0]), "tocar em Enviar abre o WhatsApp no número com DDD deduzido");
    t.clicar("[data-ci='zap'][data-arg='MG-0003']"); await t.assentar(100);
    b.ok(abertos.length === 1 && /não permite deduzir o DDD/.test(el("ciErro").textContent), "Belo Horizonte: não abre nada e explica o motivo na faixa vermelha");
    b.resumo(); process.exit(process.exitCode || 0);
  })();
} else { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); }
