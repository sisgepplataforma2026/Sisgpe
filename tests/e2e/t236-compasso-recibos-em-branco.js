/**
 * RECIBOS EM BRANCO DA FESTA (04/11/2026). O usuário: "Preciso gerar vários
 * recibos para festa"; "Nome, CPF, Valor e serviço serão preenchidos na hora
 * da festa"; "Data será impressa, numeração é necessário"; "A - aprovado".
 *
 * Backend real, tela real (jsdom), dados FICTÍCIOS.
 *
 * Prova:
 *   - numeração contínua e sem repetir entre lotes; reimprimir usa os MESMOS
 *     números; prévia não reserva número;
 *   - validações: quantidade, festa, dia;
 *   - permissão: sem o módulo Eventos, não gera;
 *   - a folha: um recibo por página, com o número, a festa, o dia e a data
 *     por extenso impressos, e nome/CPF/valor/serviço em branco; com o
 *     timbrado (cabeçalho, marca d'água, rodapé);
 *   - a tela: carrega os padrões, gera, lista o lote, reimprime.
 * NÃO PROVA: a impressão de verdade (margens da impressora, cores).
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_SEM = b.logar(g, "joscimar");

b.fluxo("RECIBOS DA FESTA · o servidor");
b.passo("1. O estado inicial");
const e0 = g.compassoRecibos_estado(TOKEN);
b.ok(e0.ok && e0.proximo === 1 && e0.lotes.length === 0, "começa no Nº 1, sem lotes");
b.igual([e0.padrao.festa, e0.padrao.dia, e0.padrao.cidade], ["Festa dos Educadores — No Compasso da Vida 2026", "19/12/2026", "Vitória"], "os padrões da festa");

b.passo("2. Numeração sem repetir");
const base = { festa: e0.padrao.festa, dia: "19/12/2026", cidade: "Vitória" };
const l1 = g.compassoRecibos_gerar(Object.assign({ quantidade: 30 }, base), TOKEN);
b.ok(l1.ok && l1.inicio === 1 && l1.fim === 30, "1º lote: Nº 1 a 30", l1.mensagem);
b.igual(l1.dataExtenso, "19 de dezembro de 2026", "a data por extenso");
b.ok(l1.arte && /^data:image/.test(l1.arte.cab) && /^data:image/.test(l1.arte.rod) && /^data:image/.test(l1.arte.md), "com o timbrado (cabeçalho, rodapé, marca d'água)");
const l2 = g.compassoRecibos_gerar(Object.assign({ quantidade: 5 }, base), TOKEN);
b.ok(l2.ok && l2.inicio === 31 && l2.fim === 35, "2º lote continua: Nº 31 a 35");
const pv = g.compassoRecibos_previa(base, TOKEN);
b.ok(pv.ok && pv.previa && g.compassoRecibos_estado(TOKEN).proximo === 36, "a prévia não reserva número (próximo continua 36)");
const re = g.compassoRecibos_reimprimir(l1.lote, TOKEN);
b.ok(re.ok && re.inicio === 1 && re.fim === 30 && g.compassoRecibos_estado(TOKEN).proximo === 36, "reimprimir o 1º lote: os mesmos Nº 1 a 30, nada novo reservado");
g.PropertiesService.getScriptProperties().deleteProperty("COMPASSO_RECIBOS_PROXIMO");
b.igual(g.compassoRecibos_estado(TOKEN).proximo, 36, "se a propriedade sumir, continua depois do maior número já reservado");
const e1 = g.compassoRecibos_estado(TOKEN);
b.ok(e1.lotes.length === 2 && e1.lotes[0].inicio === 31, "os lotes listados, o mais recente primeiro");

b.passo("3. Validações e permissão");
b.ok(!g.compassoRecibos_gerar(Object.assign({ quantidade: 0 }, base), TOKEN).ok, "quantidade 0: recusa");
b.ok(!g.compassoRecibos_gerar(Object.assign({ quantidade: 301 }, base), TOKEN).ok, "mais de 300: recusa");
b.ok(!g.compassoRecibos_gerar({ quantidade: 2, festa: "", dia: "19/12/2026" }, TOKEN).ok, "sem festa: recusa");
b.ok(!g.compassoRecibos_gerar({ quantidade: 2, festa: "X", dia: "31/02/2026" }, TOKEN).ok, "dia inválido: recusa");
let barrou = false;
try { const r = g.compassoRecibos_gerar(Object.assign({ quantidade: 2 }, base), TOKEN_SEM); barrou = !r || r.ok === false; } catch (e) { barrou = true; }
b.ok(barrou, "sem o módulo Eventos: não gera");
b.igual(g.compassoRecibos_estado(TOKEN).proximo, 36, "e nenhuma recusa gastou número");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["CompassoRecibos.html"], { token: TOKEN });
const janelas = [];
t.win.open = function () { const j = { html: "", document: { write(s) { j.html += s; }, open() { j.html = ""; }, close() {} }, close() {} }; janelas.push(j); return j; };
const el = id => t.doc.getElementById(id);
(async function () {
  b.fluxo("RECIBOS DA FESTA · a tela");
  t.win.crecCarregar(); await t.assentar(120);
  b.ok(el("crecFesta").value === "Festa dos Educadores — No Compasso da Vida 2026" && el("crecDia").value === "19/12/2026", "a festa e o dia já vêm preenchidos");
  b.ok(/Nº 036/.test(t.texto("#crecProx")), "mostra o próximo número", t.texto("#crecProx"));
  el("crecQtd").value = "3";
  t.clicar("#crecBtGerar"); await t.assentar(150);
  const doc = (janelas[0] || {}).html || "";
  const folhas = doc.split('<section class="folha">').slice(1);
  b.igual(folhas.length, 3, "3 recibos, um por folha");
  b.ok(/Nº <b>036<\/b>/.test(folhas[0]) && /Nº <b>038<\/b>/.test(folhas[2]), "numerados 036 a 038");
  b.ok(folhas.every(f => /Festa dos Educadores — No Compasso da Vida 2026/.test(f) && /no dia <b>19\/12\/2026<\/b>/.test(f) && /Vitória, <b>19 de dezembro de 2026<\/b>/.test(f)),
    "a festa, o dia e a data impressos em todos");
  b.ok(folhas.every(f => /nome completo/.test(f) && /valor por extenso/.test(f) && /serviço prestado/.test(f) && (f.match(/<i><\/i>/g) || []).length === 11),
    "nome, valor, extenso e serviço em branco; CPF com 11 caixinhas");
  b.ok(/size:A4 portrait/.test(doc) && /window\.print\(\)/.test(doc), "A4 em pé, pronta para imprimir");
  b.ok(/Nº 039/.test(t.texto("#crecProx")) && /036 a 038/.test(t.texto("#crecLotes")), "a tela atualiza: próximo 039 e o lote na lista");
  t.clicar("[data-crec-reimp]"); await t.assentar(150);
  const re2 = (janelas[1] || {}).html || "";
  b.ok(/Nº <b>036<\/b>/.test(re2) && re2.split('<section class="folha">').length - 1 === 3 && /Nº 039/.test(t.texto("#crecProx")), "reimprimir pela tela: os mesmos números");
  t.clicar("#crecBtPrevia"); await t.assentar(120);
  b.ok(/Nº <b>PRÉVIA<\/b>/.test((janelas[2] || {}).html || ""), "a prévia sai sem número");
  b.naoTestavel("a impressão de verdade", "imprimir 1 recibo em HML antes da festa");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
