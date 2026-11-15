/**
 * EXCLUSÃO COM A LIXEIRA "NÃO VISÍVEL" E O CONFIRMAR ANIMADO (15/11/2026). A 1ª exclusão real parou com "elementHandle.click: Timeout 30000ms"
 * (o Playwright achou a lixeira, mas não a considerou clicável) e nada foi apagado. O TickOne FALSO esconde a lixeira
 * (visibility:hidden) e o robô REAL (excluir.js) tem que excluir SÓ o pedido — o clique normal falha, o clique por script
 * no mesmo botão vale, a confirmação aparece e a lista é relida. NÃO PROVA: o TickOne de verdade (a causa lá ainda é
 * deduzida; o log novo traz o diagnóstico do botão).
 */
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const b = require("./base");
process.env.TICKONE_LIXEIRA_OCULTA = "1"; process.env.TICKONE_CONFIRMA_TROCA = "1";   // lixeira "invisível" E botão Confirmar que não para quieto (animação)
const tk = require("./tickone-falso.js");
(async function () {
  try { require("playwright"); } catch (e) { b.naoTestavel("o robô", "playwright não disponível aqui"); b.resumo(); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t268-"));
  const T = await tk.iniciar([
    { nome: "Maria Exemplo", cpf: "52998224725", tel: "(27) 99999-0001", cod: "TK-0001", tipo: "Associado", escola: "E", cidade: "C" },
    { nome: "Ana Teste", cpf: "39053344705", tel: "(27) 99999-0002", cod: "TK-0002", tipo: "Associado", escola: "E", cidade: "C" }]);
  const FILA = path.join(dir, "fila.json"), RES = path.join(dir, "res.json");
  fs.writeFileSync(FILA, JSON.stringify({ itens: [{ pedido: "X1", codigo: "TK-0001", cpf: "52998224725", nome: "Maria Exemplo" }] }));
  const t0 = Date.now();
  const out = await new Promise(res => { const f = cp.spawn("node", [path.join(__dirname, "..", "..", "tools", "ingressos-robo", "excluir.js")], { env: { ...process.env, INGRESSOS_URL: T.url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: "senha-certa", FILA_LOCAL: FILA, RESULTADO_LOCAL: RES } }); let s = ""; f.stdout.on("data", d => s += d); f.stderr.on("data", d => s += d); f.on("close", () => res(s)); });
  b.fluxo("EXCLUSÃO · lixeira não visível para o clique normal");
  const r = JSON.parse(fs.readFileSync(RES, "utf8")).itens || [];
  b.ok(r.length === 1 && r[0].pedido === "X1" && r[0].status === "EXCLUIDO", "o pedido foi EXCLUÍDO mesmo com a lixeira 'invisível'", out.split("\n").slice(0, 8).join(" | "));
  b.ok(/clique normal na lixeira falhou/.test(out), "o log traz o diagnóstico do clique normal (estrutura, sem dado pessoal)");
  b.ok(T.chamadas.filter(c => /^excluir:/.test(c)).length === 1, "o TickOne recebeu UMA exclusão", T.chamadas.join(","));
  b.ok(!T.chamadas.some(c => /whats|email|editar|salvar/.test(c)), "nenhum WhatsApp, e-mail, edição ou 'salvar' foi tocado");
  b.ok(!/Maria Exemplo|529\.982|Ana Teste/.test(out), "o log não tem nome nem CPF");
  b.ok(Date.now() - t0 < 60000, "levou menos de 1 minuto", Math.round((Date.now() - t0) / 1000) + "s");
  T.fechar(); fs.rmSync(dir, { recursive: true, force: true });
  b.resumo();
})();
