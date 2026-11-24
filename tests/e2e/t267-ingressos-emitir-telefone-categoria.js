/**
 * EMISSÃO: TELEFONE E CATEGORIA CHEGAM CERTOS NO TICKONE (15/11/2026).
 * O 1º ingresso real saiu com telefone "(55) 27999-4510" (o 55 virou DDD na máscara do campo e o fim foi cortado)
 * e a categoria conferida pelo usuário não era a pedida. Aqui o TickOne FALSO tem a MESMA máscara de 11 dígitos do
 * telefone; o robô REAL (emitir.js, Chromium) emite um pedido com telefone no formato do SISGEP (55 + DDD + número).
 * NÃO PROVA: a categoria no TickOne de verdade (o falso usa os mesmos valores do reconhecimento).
 */
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const b = require("./base");
const tk = require("./tickone-falso.js");
(async function () {
  let chromium; try { chromium = require("playwright"); } catch (e) { b.naoTestavel("o robô", "playwright não disponível aqui"); b.resumo(); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t267-"));
  const T = await tk.iniciar([{ nome: "Existente Fictícia", cpf: "52998224725", tel: "(27) 99999-0001", cod: "TK-0001", tipo: "Associado", escola: "E", cidade: "C" }]);
  const FILA = path.join(dir, "fila.json"), RES = path.join(dir, "res.json");
  fs.writeFileSync(FILA, JSON.stringify({ itens: [
    { pedido: "A1", nome: "Associado Fictício", cpf: "16899535009", email: "a@exemplo.com", telefone: "5527999451089", cidade: "Vila Velha", escola: "UVV", categoria: "associado" },
    { pedido: "A2", nome: "Convite Fictício", cpf: "45317828791", telefone: "27999451089", categoria: "convite" }] }));
  const out = await new Promise(res => { const f = cp.spawn("node", [path.join(__dirname, "..", "..", "tools", "ingressos-robo", "emitir.js")], { env: { ...process.env, INGRESSOS_URL: T.url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: "senha-certa", FILA_LOCAL: FILA, RESULTADO_LOCAL: RES } }); let s = ""; f.stdout.on("data", d => s += d); f.stderr.on("data", d => s += d); f.on("close", () => res(s)); });
  b.fluxo("EMISSÃO · telefone e categoria");
  const E = T.pedidosEmissao;
  b.ok(E.length === 2, "o TickOne falso recebeu 2 emissões", out.split("\n").slice(0, 6).join(" | "));
  b.ok(E[0] && E[0].telefone === "(27) 99945-1089", "telefone com 55 na frente chega como (27) 99945-1089 (antes virava (55) 27999-4510)", E[0] && E[0].telefone);
  b.ok(E[1] && E[1].telefone === "(27) 99945-1089", "telefone sem o 55 também chega certo", E[1] && E[1].telefone);
  b.ok(E[0] && E[0].tipo === "associado" && E[1] && E[1].tipo === "convite", "a categoria pedida é a que chegou", E.map(x => x.tipo).join(","));
  b.ok(!/Associado Fict|Convite Fict|168\.995|453\.178/.test(out), "o log não tem nome nem CPF");
  T.fechar(); fs.rmSync(dir, { recursive: true, force: true });
  b.resumo();
})();
