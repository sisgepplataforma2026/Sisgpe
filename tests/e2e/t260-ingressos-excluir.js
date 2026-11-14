/**
 * EXCLUIR INGRESSO NO TICKONE — fila no SISGEP + robô (14/11/2026).
 * Usuário: "o cara não vai, quero excluir ... pesquiso no SISGEP o nome dele, vou em exclusão e
 * você faz toda a operação por trás"; "você não pode mexer nos ingressos emitidos". Exclusão NÃO
 * tem volta: este teste trava as travas. SISGEP (backend + tela jsdom, Drive FALSO) e o ROBÔ
 * REAL (excluir.js, Chromium) contra um TICKONE FALSO local. Dados FICTÍCIOS.
 * NÃO PROVA: que o TickOne de verdade se comporta como o falso (o pop-up de confirmação e a
 * lixeira foram vistos no reconhecimento, mas a exclusão real NUNCA foi rodada: o primeiro uso
 * é com um ingresso de TESTE).
 */
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), cp = require("child_process");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* ---------- Drive falso (a pasta do robô) ---------- */
const arquivos = {};
g.cingPastaRobo_ = () => ({
  getFilesByName: n => { const tem = n in arquivos; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { setContent: t => { arquivos[n] = t; }, getBlob: () => ({ getDataAsString: () => arquivos[n] }) }; } }; },
  createFile: (n, t) => { arquivos[n] = t; }
});
const BASE = { lidoEm: new Date().toISOString(), evento: "No Compasso da Vida", total: 2, linhas: [
  { nome: "Maria Exemplo da Silva", cpf: "52998224725", tel: "(27) 99999-0001", codigo: "AAAA-0001", tipo: "Associado", escola: "Escola Modelo", cidade: "Vitória", ref: "REF1", zap: 0 },
  { nome: "João Teste Souza", cpf: "11144477735", tel: "(27) 99999-0002", codigo: "AAAA-0002", tipo: "Acompanhante Associado", escola: "", cidade: "", ref: "REF2", zap: 0 }] };
g.cingLerBase_ = () => JSON.parse(JSON.stringify(BASE));
g.cingPdfs_ = () => ({});
g.compasso_dadosDaFesta_ = () => ({}); g.compasso_dataPorExtenso_ = () => "";

b.fluxo("EXCLUSÃO · fila no SISGEP");
b.passo("1. Só com a confirmação 'não tem volta'");
b.ok(g.compassoIngressos_pedirExclusao("AAAA-0001", "não vai", false, TOKEN).ok === false, "sem confirmar, não pede");
b.ok(g.compassoIngressos_pedirExclusao("AAAA-0001", "não vai", true, "token-invalido").ok === false, "sem sessão válida, não pede");
b.ok(g.compassoIngressos_pedirExclusao("NAO-EXISTE", "x", true, TOKEN).ok === false, "ingresso que não está na base: recusa");
b.ok(Object.keys(arquivos).length === 0, "nada foi escrito para o robô até aqui");
b.passo("2. Pedido registrado, com cópia dos dados, e a fila do robô");
const pe = g.compassoIngressos_pedirExclusao("AAAA-0001", "não vai mais", true, TOKEN);
b.ok(pe.ok && pe.abertos === 1, "pedido registrado", JSON.stringify(pe));
const fila = JSON.parse(arquivos["exclusoes-fila.json"]);
b.ok(fila.itens.length === 1 && fila.itens[0].codigo === "AAAA-0001" && fila.itens[0].cpf === "52998224725" && fila.itens[0].pedido === pe.pedido, "a fila tem só esse ingresso, com código e CPF");
const ex1 = g.compassoIngressos_exclusoes(TOKEN).exclusoes[0];
b.ok(ex1.status === "PEDIDO" && ex1.motivo === "não vai mais" && ex1.pedidoPor !== "", "quem pediu, quando e o motivo ficam guardados");
b.ok(g.compassoIngressos_pedirExclusao("AAAA-0001", "", true, TOKEN).ok === false, "pedido duplicado é recusado");
b.passo("3. Cancelar antes do robô: nada é excluído");
b.ok(g.compassoIngressos_cancelarPedidoExclusao(pe.pedido, TOKEN).ok && JSON.parse(arquivos["exclusoes-fila.json"]).itens.length === 0, "cancelou e a fila esvaziou");
b.ok(g.compassoIngressos_exclusoes(TOKEN).exclusoes[0].status === "CANCELADO", "ficou registrado como cancelado");
const pe2 = g.compassoIngressos_pedirExclusao("AAAA-0001", "de novo", true, TOKEN);
b.ok(pe2.ok, "depois de cancelar dá para pedir de novo");
b.passo("4. O que o robô devolve volta para o SISGEP");
arquivos["exclusoes-resultado.json"] = JSON.stringify({ itens: [{ pedido: pe2.pedido, status: "EXCLUIDO", detalhe: "conferido: a linha saiu da lista do TickOne", em: new Date().toISOString() }] });
const lis = g.compassoIngressos_lista(TOKEN).linhas;
b.ok(lis[0].exclusao && lis[0].exclusao.status === "EXCLUIDO" && /conferido/.test(lis[0].exclusao.resultado) && lis[1].exclusao === null, "a linha mostra 'excluído'; a outra não é tocada");
b.ok(g.compassoIngressos_cancelarPedidoExclusao(pe2.pedido, TOKEN).ok === false, "depois de excluído não dá para 'cancelar'");
b.ok(g.compassoIngressos_pedirExclusao("AAAA-0001", "", true, TOKEN).ok === false, "e não dá para pedir de novo o que já foi excluído");

/* ---------- tela ---------- */
const sem = { ...arquivos }; Object.keys(arquivos).forEach(k => delete arquivos[k]);
const abas = g.SpreadsheetApp && null;
(async function () {
  if (dom.jsdomDisponivel()) {
    // zera as exclusões anteriores para a tela começar limpa
    const sh = g.cingAbaExcl_(); if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
    const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
    b.fluxo("EXCLUSÃO · tela");
    win.cingCarregar(); await t.assentar(300);
    b.ok(!!doc.querySelector("[data-ci='excl'][data-arg='AAAA-0002']"), "cada linha tem o botão 🗑 Excluir");
    t.clicar("[data-ci='excl'][data-arg='AAAA-0002']"); await t.assentar(20);
    b.ok(el("ciExcl").hidden === false && /João Teste Souza/.test(el("ciExclQuem").textContent) && /não tem volta/.test(el("ciExcl").textContent), "abre a confirmação com nome, CPF e código, e avisa que não tem volta");
    t.clicar("[data-ci='exclPedir']"); await t.assentar(200);
    b.ok(g.compassoIngressos_exclusoes(TOKEN).exclusoes.length === 0, "sem marcar 'entendo que não tem volta', não pede");
    el("ciExclMotivo").value = "não vai mais"; el("ciExclOk").checked = true;
    t.clicar("[data-ci='exclPedir']"); await t.assentar(400);
    b.ok(g.compassoIngressos_exclusoes(TOKEN).exclusoes.length === 1 && el("ciExcl").hidden === true, "marcando, o pedido é registrado e a caixa fecha");
    const linha = [...doc.querySelectorAll("#ciLista .ci-linha")].find(x => /João Teste/.test(x.textContent));
    b.ok(/Exclusão pedida/.test(linha.textContent) && /Cancelar pedido/.test(linha.textContent), "a linha mostra 'Exclusão pedida' e 'Cancelar pedido'");
    b.ok(linha.querySelector("[data-ci='zap']").disabled === true && !linha.querySelector("[data-ci='excl']"), "o WhatsApp trava e o Excluir some enquanto o pedido está aberto");
    t.clicar("[data-ci='cancExcl']"); await t.assentar(400);
    b.ok(g.compassoIngressos_exclusoes(TOKEN).exclusoes[0].status === "CANCELADO" && !!doc.querySelector("[data-ci='excl'][data-arg='AAAA-0002']"), "cancelar devolve o botão Excluir");
  } else b.naoTestavel("a tela de exclusão", "jsdom não instalado");

  /* ---------- o ROBÔ real contra um TickOne falso ---------- */
  let playwrightOk = true;
  const raizGlobal = (() => { try { return cp.execSync("npm root -g", { encoding: "utf8" }).trim(); } catch (e) { return ""; } })();
  const NODE_PATH = [process.env.NODE_PATH || "", raizGlobal].filter(Boolean).join(path.delimiter);
  try { require(require.resolve("playwright", { paths: NODE_PATH.split(path.delimiter) })); } catch (e) { playwrightOk = false; }
  if (!playwrightOk) { b.naoTestavel("o robô de exclusão", "playwright/Chromium não disponível aqui — rode onde houver"); b.resumo(); return; }

  b.fluxo("EXCLUSÃO · o robô contra um TickOne FALSO");
  let linhas = [
    { id: 1, nome: "Alvo Certo Fictício", cpf: "529.982.247-25", cod: "AAA-0001" },
    { id: 2, nome: "Ja Entrou Fictício", cpf: "111.444.777-35", cod: "BBB-0002" },
    { id: 3, nome: "Outro Cpf Fictício", cpf: "390.533.447-05", cod: "CCC-0003" },
    { id: 4, nome: "Duplicado Um", cpf: "168.995.350-09", cod: "DDD-0004" },
    { id: 5, nome: "Duplicado Dois", cpf: "168.995.350-09", cod: "DDD-0004" },
    { id: 6, nome: "Intocado Fictício", cpf: "453.178.287-91", cod: "EEE-0005" }
  ];
  const chamadas = []; let logins = 0;
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), logado = /sid=ok/.test(req.headers.cookie || "");
    if (req.method === "POST" && u.searchParams.get("action") === "admin_login") {
      let d = ""; req.on("data", c => d += c); req.on("end", () => { logins++; const ok = /username=teste/.test(d) && /password=senha-certa/.test(d);
        res.writeHead(302, { Location: "/index.php?page=admin", ...(ok ? { "Set-Cookie": "sid=ok; Path=/" } : {}) }); res.end(); }); return;
    }
    if (req.method === "POST" && u.searchParams.get("action") === "excluir") { chamadas.push("excluir:" + u.searchParams.get("id")); linhas = linhas.filter(l => String(l.id) !== u.searchParams.get("id")); res.end("ok"); return; }
    if (u.searchParams.get("action")) { chamadas.push(u.searchParams.get("action")); res.end("ok"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!logado) { res.end('<form method="post" action="/index.php?action=admin_login"><input name="username"><input type="password" name="password"><button type="submit">Entrar</button></form>'); return; }
    res.end('<h1>Gestão</h1><table><thead><tr><th></th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Código</th><th>Tipo</th><th>Escola</th><th>Cidade</th><th>Ações</th></tr></thead><tbody>' +
      linhas.map(l => `<tr><td></td><td>${l.nome}</td><td>${l.cpf}</td><td>(27) 90000-0000</td><td>${l.cod}</td><td>Associado</td><td>E</td><td>C</td><td><button title="Enviar o ingresso (PDF) pelo WhatsApp (já enviado 1x)" onclick="fetch('/index.php?action=whats')">w</button><button title="Enviar o ingresso por e-mail" onclick="fetch('/index.php?action=email')">e</button><button title="Editar" onclick="fetch('/index.php?action=editar')">ed</button><button title="Excluir ingresso" onclick="excluirVendaUnica(${l.id})">x</button></td></tr>`).join("") +
      '</tbody></table><table><thead><tr><th>Cliente</th><th>CPF</th><th>Ingresso</th><th>Horário Check-in</th><th>Ação</th></tr></thead><tbody><tr><td>Ja Entrou Fictício</td><td>111.444.777-35</td><td>BBB-0002</td><td>19:40</td><td></td></tr></tbody></table>' +
      '<div id="m" style="display:none"><button id="custom-confirm-yes-btn" type="submit" onclick="var a=window.alvo;fetch(\'/index.php?action=excluir&id=\'+a,{method:\'POST\'}).then(function(){location.reload()})">Confirmar</button></div>' +
      '<script>function excluirVendaUnica(id){window.alvo=id;document.getElementById("m").style.display="block"}<\/script>');
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/index.php?page=admin&evt_id=17";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "excl-")), filaF = path.join(tmp, "fila.json"), resF = path.join(tmp, "res.json");
  function rodar(itens, senha) {   // ASSÍNCRONO: o TickOne falso roda neste mesmo processo e precisa responder
    fs.writeFileSync(filaF, JSON.stringify({ itens })); try { fs.unlinkSync(resF); } catch (e) {}
    return new Promise(ok => {
      const f = cp.spawn("node", [path.join(__dirname, "..", "..", "tools", "ingressos-robo", "excluir.js")],
        { env: { ...process.env, NODE_PATH, INGRESSOS_URL: url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: senha || "senha-certa", FILA_LOCAL: filaF, RESULTADO_LOCAL: resF } });
      let saida = ""; f.stdout.on("data", d => saida += d); f.stderr.on("data", d => saida += d);
      const t = setTimeout(() => f.kill(), 120000);
      f.on("close", codigo => { clearTimeout(t); ok({ saida, codigo, resultado: fs.existsSync(resF) ? JSON.parse(fs.readFileSync(resF, "utf8")).itens : [] }); });
    });
  }
  const pedidos = [
    { pedido: "P1", codigo: "AAA-0001", cpf: "52998224725", nome: "x" },
    { pedido: "P2", codigo: "BBB-0002", cpf: "11144477735", nome: "x" },
    { pedido: "P3", codigo: "CCC-0003", cpf: "00000000000", nome: "x" },
    { pedido: "P4", codigo: "ZZZ-9999", cpf: "52998224725", nome: "x" },
    { pedido: "P5", codigo: "DDD-0004", cpf: "16899535009", nome: "x" },
    { pedido: "P6", codigo: "EEE-0005", cpf: "45317828791", nome: "x" }
  ];
  b.passo("5. Fila vazia e login errado: nada é excluído");
  let r = await rodar([]); b.ok(/Fila vazia/.test(r.saida) && chamadas.length === 0, "fila vazia: não faz nada");
  r = await rodar([pedidos[0]], "senha-errada"); b.ok(r.codigo === 1 && /login não entrou/.test(r.saida) && chamadas.length === 0 && linhas.length === 6, "login errado: para e não exclui nada");
  b.passo("6. As travas (6 pedidos; o limite é 5 por execução)");
  r = await rodar(pedidos);
  const st = {}; r.resultado.forEach(x => { st[x.pedido] = x.status; });
  b.ok(st.P1 === "EXCLUIDO" && linhas.every(l => l.id !== 1), "P1 (código e CPF batem): excluído e conferido");
  b.ok(st.P2 === "JA_ENTROU" && linhas.some(l => l.id === 2), "P2 (já passou na portaria): NÃO excluído");
  b.ok(st.P3 === "FALHOU" && /outro CPF/.test(r.resultado.find(x => x.pedido === "P3").detalhe) && linhas.some(l => l.id === 3), "P3 (código existe com outro CPF): NÃO excluído");
  b.ok(st.P4 === "FALHOU" && /não encontrado/.test(r.resultado.find(x => x.pedido === "P4").detalhe), "P4 (não existe): não faz nada");
  b.ok(st.P5 === "FALHOU" && /mais de uma linha/.test(r.resultado.find(x => x.pedido === "P5").detalhe) && linhas.some(l => l.id === 4) && linhas.some(l => l.id === 5), "P5 (duas linhas iguais): NÃO excluiu nenhuma");
  b.ok(st.P6 === undefined && linhas.some(l => l.id === 6), "P6 (o 6º): fora do limite de 5, não foi tocado");
  b.ok(chamadas.join(",") === "excluir:1", "o TickOne recebeu UMA exclusão (a do P1) e nenhum WhatsApp, e-mail ou edição", chamadas.join(","));
  b.ok(!/Alvo Certo|529\.982|52998224725/.test(r.saida), "o log não tem nome nem CPF");
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  b.resumo();
})();
