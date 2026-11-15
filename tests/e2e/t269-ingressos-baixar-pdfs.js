/**
 * ROBÔ QUE BAIXA OS PDFs DOS INGRESSOS (15/11/2026). O usuário emite 1 ou 100 no TickOne e só quer abrir o SISGEP e enviar.
 * Robô REAL (baixar-pdfs.js, Chromium) contra o TickOne FALSO com 100 ingressos já emitidos: baixa todos, não baixa de novo,
 * pega SÓ o ingresso novo na rodada seguinte, não tem nome no log e nunca toca em WhatsApp/e-mail/editar/salvar/excluir.
 * NÃO PROVA: o PDF do TickOne de verdade (QR Code e visual) — o falso entrega um PDF mínimo; o 1º lote real é a prova.
 */
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const b = require("./base");
process.env.FALSO_LUGARES = "300";
const tk = require("./tickone-falso.js");
const RAIZ = path.join(__dirname, "..", "..", "tools", "ingressos-robo");
function cpfValido(n) { const d = String(n).padStart(9, "0").split("").map(Number); for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push((s * 10) % 11 % 10); } return d.join(""); }
function rodar(script, env) { return new Promise(res => { const f = cp.spawn("node", [path.join(RAIZ, script)], { env: { ...process.env, ...env } }); let s = ""; f.stdout.on("data", d => s += d); f.stderr.on("data", d => s += d); f.on("close", c => res({ codigo: c, saida: s })); }); }
(async function () {
  try { require("playwright"); } catch (e) { b.naoTestavel("o robô", "playwright não disponível aqui"); b.resumo(); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t269-")), PDFS = path.join(dir, "pdfs"), EST = path.join(dir, "estado.json");
  const linhas = []; for (let i = 1; i <= 100; i++) linhas.push({ nome: "Pessoa Ficticia " + i, cpf: cpfValido(100000000 + i * 7919), tel: "(27) 99999-" + String(1000 + i), cod: "TK-" + String(i).padStart(4, "0"), tipo: "Associado", escola: "E", cidade: "C" });
  const T = await tk.iniciar(linhas);
  const env = { INGRESSOS_URL: T.url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: "senha-certa", ESTADO_LOCAL: EST, PDF_LOCAL_DIR: PDFS };
  b.fluxo("PDFs · 100 ingressos emitidos direto no TickOne");
  const t0 = Date.now(); const r1 = await rodar("baixar-pdfs.js", env); const seg = Math.round((Date.now() - t0) / 1000);
  const arqs = fs.existsSync(PDFS) ? fs.readdirSync(PDFS) : [];
  b.ok(r1.codigo === 0 && arqs.length === 100, "baixou os 100 PDFs", "arquivos " + arqs.length + " · " + seg + " s · " + (r1.saida.split("\n").filter(l => /RESUMO|FALHA|falhou/.test(l)).slice(0, 2).join(" | ")));
  b.ok(arqs.every(n => /^TickOne - Pessoa Ficticia \d+\.pdf$/.test(n)) && fs.readFileSync(path.join(PDFS, arqs[0])).slice(0, 4).toString() === "%PDF", "nomes no padrão 'TickOne - Nome.pdf' e conteúdo PDF");
  const est = JSON.parse(fs.readFileSync(EST, "utf8"));
  b.ok(Object.keys(est.feitos).length === 100 && est.feitos["TK-0001"].arquivo === "TickOne - Pessoa Ficticia 1.pdf", "o estado guarda o PDF de cada código");
  b.ok(!/Pessoa Ficticia/.test(r1.saida) && !/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(r1.saida), "o log não tem nome nem CPF");
  b.ok(T.chamadas.filter(c => /^pdf:/.test(c)).length === 100 && !T.chamadas.some(c => /whats|email|editar|salvar|excluir|emitir/.test(c)), "só abriu o PDF de cada um: nenhum WhatsApp, e-mail, edição, salvar, excluir nem emissão", T.chamadas.filter(c => !/^pdf:/.test(c)).join(","));
  b.passo("2ª rodada: nada novo, nada baixado de novo");
  const antes = T.chamadas.length; const r2 = await rodar("baixar-pdfs.js", env);
  b.ok(r2.codigo === 0 && T.chamadas.length === antes && /faltam: 0/.test(r2.saida), "não baixa de novo o que já tem", r2.saida.split("\n").filter(l => /Ingressos na lista|RESUMO/.test(l)).join(" | "));
  b.passo("3ª: um ingresso novo emitido no TickOne");
  const FILA = path.join(dir, "fila.json"), RES = path.join(dir, "res.json");
  fs.writeFileSync(FILA, JSON.stringify({ itens: [{ pedido: "N1", nome: "Novo Ficticio", cpf: "16899535009", telefone: "27999451089", categoria: "convite" }] }));
  const e1 = await rodar("emitir.js", { ...env, FILA_LOCAL: FILA, RESULTADO_LOCAL: RES });
  const pdfsAntes = T.chamadas.filter(c => /^pdf:/.test(c)).length;
  const r3 = await rodar("baixar-pdfs.js", env);
  b.ok(r3.codigo === 0 && T.chamadas.filter(c => /^pdf:/.test(c)).length === pdfsAntes + 1 && fs.existsSync(path.join(PDFS, "TickOne - Novo Ficticio.pdf")) && Object.keys(JSON.parse(fs.readFileSync(EST, "utf8")).feitos).length === 101, "baixou SÓ o ingresso novo", r3.saida.split("\n").filter(l => /faltam|RESUMO/.test(l)).join(" | "));
  T.fechar(); fs.rmSync(dir, { recursive: true, force: true });
  b.resumo();
})();
