/**
 * A FRASE DA PÁGINA INICIAL (10/11/2026). "263 pendências" assustava (somava
 * tudo o que está aberto); o usuário aprovou ("sim") falar do que pede ação:
 * os urgentes e quantos ASSUNTOS há para olhar. Página real (jsdom), painel FALSO.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("HOME · a frase"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const casos = [
  ["com urgentes e outros assuntos", [["URGENTE", 3], ["ATENCAO", 79], ["ATENCAO", 59], ["ATENCAO", 4]], /^Hoje há 3 urgentes e 3 assuntos para olhar\./],
  ["sem urgentes", [["ATENCAO", 79], ["ATENCAO", 2]], /^Nada urgente hoje\. Há 2 assuntos para olhar/],
  ["tudo em dia", [], /^Nada esperando você agora — tudo em dia\./],
  ["só urgentes", [["URGENTE", 2]], /^Hoje há 2 urgentes\. Separei/]
];
(async () => {
  b.fluxo("HOME · a frase fala do que pede ação, não do total");
  for (const [nome, tar, re] of casos) {
    const { g } = b.subir({}); b.seedUsuarios(g); const T = b.logar(g, "wanderson");
    g.getPainelExecutivoSISGEP = (tok, grupo) => ({ ok: true, tarefas: grupo === "oficios" ? tar.map(([sev, n]) => ({ sev, n, tag: "X", texto: "x" })) : [], kpis: [], areas: [], chegou: [] });
    const t = dom.montar(g, ["index.html"], { token: T }); await t.assentar(1500);
    const f = t.doc.getElementById("spResumoDia").textContent;
    b.ok(re.test(f) && !/pendências/.test(f), nome, f);
  }
  b.resumo();
  process.exit(process.exitCode || 0);
})();
