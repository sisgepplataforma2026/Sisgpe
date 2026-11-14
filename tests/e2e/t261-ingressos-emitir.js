/**
 * EMITIR INGRESSO NO TICKONE — pedido no SISGEP + robô (14/11/2026).
 * Usuário: "faz um ingresso de teste"; "quando for solicitar, sempre pesquisar antes". Emitir cria
 * ingresso de verdade: este teste trava as travas. SISGEP (backend + tela jsdom, Drive FALSO) e o
 * ROBÔ REAL (emitir.js, Chromium) contra um TICKONE FALSO local (grade de lugares + pop-up).
 * Dados FICTÍCIOS. NÃO PROVA: que o TickOne de verdade se comporta como o falso — o pop-up e a grade
 * foram vistos no reconhecimento, mas nenhuma emissão real foi rodada (o 1º uso é UM ingresso de teste).
 */
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), cp = require("child_process");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const arquivos = {};
g.cingPastaRobo_ = () => ({
  getFilesByName: n => { const tem = n in arquivos; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { setContent: t => { arquivos[n] = t; }, getBlob: () => ({ getDataAsString: () => arquivos[n] }) }; } }; },
  createFile: (n, t) => { arquivos[n] = t; }
});
let lidoEm = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm, evento: "x", total: 1, linhas: [{ nome: "Maria Existente Fictícia", cpf: "52998224725", tel: "(27) 99999-0001", codigo: "AAAA-0001", tipo: "Associado", escola: "E", cidade: "C", ref: "R1", zap: 0 }] });
g.cingPdfs_ = () => ({}); g.compasso_dadosDaFesta_ = () => ({}); g.compasso_dataPorExtenso_ = () => "";

const NOVO = { nome: "Teste Fictício da Silva", cpf: "168.995.350-09", email: "teste@exemplo.com", cidade: "Cariacica", escola: "UVV", categoria: "Acompanhante Associado" };

b.fluxo("EMISSÃO · pedido no SISGEP");
b.passo("1. Só com confirmação, só com pesquisa limpa e base recente");
b.ok(g.compassoIngressos_pedirEmissao([NOVO], false, TOKEN).ok === false, "sem confirmar 'cria ingresso de verdade', não pede");
b.ok(g.compassoIngressos_pedirEmissao([NOVO], true, "token-invalido").ok === false, "sem sessão válida, não pede");
b.ok(/Ninguém novo/.test(g.compassoIngressos_pedirEmissao([{ nome: "Maria Existente Fictícia", cpf: "529.982.247-25", categoria: "Associado" }], true, TOKEN).mensagem), "quem já tem ingresso não é pedido de novo");
b.ok(/Corrija/.test(g.compassoIngressos_pedirEmissao([NOVO, { nome: "Sem CPF", cpf: "", categoria: "Convite" }], true, TOKEN).mensagem), "com uma linha em 'Conferir', nada é pedido");
b.ok(/Corrija/.test(g.compassoIngressos_pedirEmissao([{ nome: "Assoc Incompleto", cpf: "390.533.447-05", categoria: "Associado" }], true, TOKEN).mensagem), "Associado com campo faltando não passa");
lidoEm = new Date(Date.now() - 40 * 60000).toISOString();
b.ok(/mais de 15 minutos/.test(g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN).mensagem), "base com 40 min: não pede (pesquisar antes precisa ser recente)");
lidoEm = new Date().toISOString();
b.ok(Object.keys(arquivos).length === 0, "nada foi escrito para o robô até aqui");
b.ok(/ainda não foi preparada/.test(g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN).mensagem) && Object.keys(arquivos).length === 0 && g.cingAbaEmis_().getLastRow() < 2,
  "sem a fila criada pelo robô (ele só lê o que criou), o pedido é recusado e NADA é gravado");
arquivos["emissoes-fila.json"] = JSON.stringify({ itens: [] });   // o robô cria a fila vazia na 1ª execução
b.passo("2. Pedido registrado com a fila do robô");
const pe = g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN);
b.ok(pe.ok && pe.pedidos === 1 && pe.naFila === 1, "pedido registrado", JSON.stringify(pe));
const fila = JSON.parse(arquivos["emissoes-fila.json"]).itens;
b.ok(fila.length === 1 && fila[0].cpf === "16899535009" && fila[0].categoria === "acompanhante" && fila[0].escola === "UVV" && fila[0].cidade === "Cariacica" && fila[0].email === "teste@exemplo.com", "a fila tem os dados do TickOne (categoria no valor do seletor)");
b.ok(/já estão na fila/.test(g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN).mensagem), "pedir o mesmo CPF duas vezes é recusado");
const em = g.compassoIngressos_emissoes(TOKEN).emissoes[0];
b.ok(em.status === "PEDIDO" && em.pedidoPor !== "", "ficou registrado quem pediu e quando");
b.passo("3. Cancelar antes do robô");
b.ok(g.compassoIngressos_cancelarPedidoEmissao(em.pedido, TOKEN).ok && JSON.parse(arquivos["emissoes-fila.json"]).itens.length === 0, "cancelou e a fila esvaziou");
const pe2 = g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN);
b.ok(pe2.ok, "depois de cancelar dá para pedir de novo");
b.passo("4. O resultado do robô volta");
const ped = g.compassoIngressos_emissoes(TOKEN).emissoes.find(x => x.status === "PEDIDO").pedido;
arquivos["emissoes-resultado.json"] = JSON.stringify({ itens: [{ pedido: ped, status: "EMITIDO", detalhe: "conferido", codigo: "TST-0001", em: new Date().toISOString() }] });
const e2 = g.compassoIngressos_emissoes(TOKEN).emissoes.find(x => x.pedido === ped);
b.ok(e2.status === "EMITIDO" && e2.codigo === "TST-0001", "o SISGEP mostra 'emitido' com o código");
b.ok(g.compassoIngressos_cancelarPedidoEmissao(ped, TOKEN).ok === false, "depois de emitido não dá para cancelar");

(async function () {
  if (dom.jsdomDisponivel()) {
    const sh = g.cingAbaEmis_(); if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    Object.keys(arquivos).forEach(k => delete arquivos[k]); arquivos["emissoes-fila.json"] = JSON.stringify({ itens: [] });
    const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
    const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
    b.fluxo("EMISSÃO · tela");
    win.cingCarregar(); await t.assentar(300);
    t.clicar("[data-ci='aba'][data-arg='solicitar']");
    el("ciFNome").value = "Teste Fictício da Silva"; el("ciFCpf").value = "168.995.350-09"; el("ciFEsc").value = "UVV"; el("ciFCid").value = "Cariacica"; el("ciFCat").value = "acompanhante";
    t.clicar("[data-ci='addUm']"); t.clicar("[data-ci='conferir']"); await t.assentar(400);
    b.ok(!!doc.querySelector("[data-ci='emisAbrir']") && /Pedir emissão dos 1 novos/.test(el("ciRes").textContent), "pesquisa limpa: aparece 'Pedir emissão'");
    t.clicar("[data-ci='emisAbrir']"); await t.assentar(20);
    b.ok(el("ciEmis").hidden === false && /Teste Fictício da Silva/.test(el("ciEmisQuem").textContent) && /cria ingresso de verdade/.test(el("ciEmis").textContent), "abre a confirmação com quem vai ser emitido e o aviso");
    t.clicar("[data-ci='emisPedir']"); await t.assentar(300);
    b.ok(g.compassoIngressos_emissoes(TOKEN).emissoes.length === 0, "sem marcar 'entendo', não pede");
    el("ciEmisOk").checked = true; t.clicar("[data-ci='emisPedir']"); await t.assentar(400);
    b.ok(g.compassoIngressos_emissoes(TOKEN).emissoes.length === 1 && el("ciEmis").hidden === true, "marcando, o pedido é registrado");
    b.ok(/aguardando o robô/.test(el("ciEmisLista").textContent) && !!doc.querySelector("[data-ci='cancEmis']"), "a lista de pedidos mostra 'aguardando o robô' e 'Cancelar pedido'");
  } else b.naoTestavel("a tela de emissão", "jsdom não instalado");

  /* ---------- o ROBÔ real contra um TickOne falso ---------- */
  const raizGlobal = (() => { try { return cp.execSync("npm root -g", { encoding: "utf8" }).trim(); } catch (e) { return ""; } })();
  const NODE_PATH = [process.env.NODE_PATH || "", raizGlobal].filter(Boolean).join(path.delimiter);
  try { require(require.resolve("playwright", { paths: NODE_PATH.split(path.delimiter) })); } catch (e) { b.naoTestavel("o robô de emissão", "playwright/Chromium não disponível aqui"); b.resumo(); return; }
  b.fluxo("EMISSÃO · o robô contra um TickOne FALSO");
  let linhas = [{ nome: "Ja Existe Fictícia", cpf: "529.982.247-25", cod: "EXI-0001" }];
  let ocupados = new Set([1, 2]); const LIVRES = [3, 4, 5, 6, 7]; const emissoes = []; const outras = []; let seq = 0;
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), logado = /sid=ok/.test(req.headers.cookie || "");
    if (req.method === "POST" && u.searchParams.get("action") === "admin_login") {
      let d = ""; req.on("data", c => d += c); req.on("end", () => { const ok = /username=teste/.test(d) && /password=senha-certa/.test(d); res.writeHead(302, { Location: "/index.php?page=admin", ...(ok ? { "Set-Cookie": "sid=ok; Path=/" } : {}) }); res.end(); }); return;
    }
    if (req.method === "POST" && u.searchParams.get("action") === "emitir") {
      let d = ""; req.on("data", c => d += c); req.on("end", () => {
        const j = JSON.parse(d); emissoes.push(j);
        if (/FALHA-SERVIDOR/.test(j.nome) || !j.nome || !j.cpf) { res.statusCode = 400; res.end("erro"); return; }
        ocupados.add(Number(j.seat)); seq++; linhas.push({ nome: j.nome, cpf: j.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"), cod: "TST-000" + seq }); res.end("ok");
      }); return;
    }
    if (u.searchParams.get("action")) { outras.push(u.searchParams.get("action")); res.end("ok"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!logado) { res.end('<form method="post" action="/index.php?action=admin_login"><input name="username"><input type="password" name="password"><button type="submit">Entrar</button></form>'); return; }
    const livre = "seat-fluid bg-slate-850 border border-slate-700/80 text-emerald-400 hover:x", ocup = "seat-fluid bg-rose-500/20 text-rose-400 border border-rose-500/40";
    res.end('<h1>Gestão</h1><table><thead><tr><th></th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Código</th><th>Tipo</th><th>Escola</th><th>Cidade</th><th>Ações</th></tr></thead><tbody>' +
      linhas.map(l => `<tr><td></td><td>${l.nome}</td><td>${l.cpf}</td><td>t</td><td>${l.cod}</td><td>Associado</td><td>E</td><td>C</td><td><button title="Enviar o ingresso (PDF) pelo WhatsApp" onclick="fetch('/index.php?action=whats')">w</button><a title="Reemitir (PDF)" href="index.php?page=ticket&ref=REF-${l.cod}">p</a><button title="Excluir ingresso" onclick="fetch('/index.php?action=excluir')">x</button></td></tr>`).join("") + '</tbody></table>' +
      [1, 2].concat(LIVRES).map(n => `<button class="${ocupados.has(n) ? ocup : livre}" onclick="abrirPopUpAssentoAdmin(${n})">${n}</button>`).join("") +
      '<div id="pop" style="display:none"><select id="popup-tipo-ingresso"><option value="pago">Pago</option><option value="cortesia">Cortesia</option><option value="convite">Convite</option><option value="associado">Associado</option><option value="acompanhante">Acompanhante Associado</option></select>' +
      '<input id="popup-buyer-nome"><input id="popup-buyer-email"><input id="popup-buyer-cpf"><input id="popup-buyer-telefone"><input id="popup-buyer-cidade"><textarea id="popup-buyer-observacao"></textarea>' +
      '<button onclick="fetch(\'/index.php?action=salvar\')">Salvar Dados</button><button onclick="fetch(\'/index.php?action=excluir\')">Excluir</button><button id="emit" onclick="emitir()">Emitir Ingresso</button></div>' +
      '<script>var seat=0;function abrirPopUpAssentoAdmin(n){seat=n;["popup-buyer-nome","popup-buyer-email","popup-buyer-cpf","popup-buyer-telefone","popup-buyer-cidade","popup-buyer-observacao"].forEach(function(i){document.getElementById(i).value=""});document.getElementById("pop").style.display="block"}' +
      'function emitir(){var v=function(i){return document.getElementById(i).value};fetch("/index.php?action=emitir",{method:"POST",body:JSON.stringify({seat:seat,tipo:v("popup-tipo-ingresso"),nome:v("popup-buyer-nome"),email:v("popup-buyer-email"),cpf:v("popup-buyer-cpf"),telefone:v("popup-buyer-telefone"),cidade:v("popup-buyer-cidade"),escola:v("popup-buyer-observacao")})}).then(function(r){if(r.ok)location.reload()})}<\/script>');
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/index.php?page=admin&evt_id=17";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "emit-")), filaF = path.join(tmp, "fila.json"), resF = path.join(tmp, "res.json");
  function rodar(itens, senha) {
    fs.writeFileSync(filaF, JSON.stringify({ itens })); try { fs.unlinkSync(resF); } catch (e) {}
    return new Promise(ok => {
      const f = cp.spawn("node", [path.join(__dirname, "..", "..", "tools", "ingressos-robo", "emitir.js")],
        { env: { ...process.env, NODE_PATH, INGRESSOS_URL: url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: senha || "senha-certa", FILA_LOCAL: filaF, RESULTADO_LOCAL: resF } });
      let saida = ""; f.stdout.on("data", d => saida += d); f.stderr.on("data", d => saida += d);
      const tm = setTimeout(() => f.kill(), 150000);
      f.on("close", codigo => { clearTimeout(tm); ok({ saida, codigo, resultado: fs.existsSync(resF) ? JSON.parse(fs.readFileSync(resF, "utf8")).itens : [] }); });
    });
  }
  const P = [
    { pedido: "P1", nome: "Teste Fictício da Silva", cpf: "16899535009", email: "teste@exemplo.com", telefone: "", cidade: "Cariacica", escola: "UVV", categoria: "acompanhante" },
    { pedido: "P2", nome: "Ja Existe Fictícia", cpf: "52998224725", categoria: "associado" },
    { pedido: "P3", nome: "Categoria Errada", cpf: "39053344705", categoria: "vip" },
    { pedido: "P4", nome: "Segundo Teste Fictício", cpf: "45317828791", categoria: "convite", escola: "UVV" },
    { pedido: "P5", nome: "FALHA-SERVIDOR", cpf: "11144477735", categoria: "convite" },
    { pedido: "P6", nome: "Nunca Chega Fictício", cpf: "11122233396", categoria: "convite" }
  ];
  b.passo("5. Fila vazia e login errado: nada é emitido");
  let r = await rodar([]); b.ok(/Fila vazia/.test(r.saida) && emissoes.length === 0, "fila vazia: não faz nada");
  r = await rodar([P[0]], "senha-errada"); b.ok(r.codigo === 1 && /login não entrou/.test(r.saida) && emissoes.length === 0, "login errado: para e não emite nada");
  b.passo("6. As travas");
  r = await rodar(P);
  const st = {}; r.resultado.forEach(x => { st[x.pedido] = x; });
  b.ok(st.P1 && st.P1.status === "EMITIDO" && st.P1.codigo === "TST-0001", "P1: emitido e conferido, com o código lido da lista", JSON.stringify(st.P1));
  const e1 = emissoes[0];
  b.ok(e1.tipo === "acompanhante" && e1.nome === "Teste Fictício da Silva" && e1.cpf === "16899535009" && e1.email === "teste@exemplo.com" && e1.cidade === "Cariacica" && e1.escola === "UVV" && e1.seat === 3, "preencheu categoria, nome, CPF, e-mail, cidade e escola, num lugar LIVRE (o 3; 1 e 2 são ocupados)", JSON.stringify(e1));
  b.ok(st.P2 && st.P2.status === "FALHOU" && /já tem ingresso/.test(st.P2.detalhe) && !emissoes.some(x => x.cpf === "52998224725"), "P2 (CPF já na lista): pesquisa antes, NÃO emitiu de novo");
  b.ok(st.P3 && st.P3.status === "FALHOU" && /categoria/.test(st.P3.detalhe), "P3 (categoria que o TickOne não tem): não emite");
  b.ok(st.P4 && st.P4.status === "EMITIDO" && st.P4.codigo === "TST-0002" && emissoes.find(x => x.cpf === "45317828791").seat === 4, "P4: emitido no PRÓXIMO lugar livre (4), pois o 3 foi usado");
  b.ok(st.P5 && st.P5.status === "FALHOU" && /NÃO tentei de novo/.test(st.P5.detalhe) && r.codigo === 1, "P5 (TickOne recusou): para e NÃO tenta de novo");
  b.ok(st.P6 === undefined && !emissoes.some(x => x.cpf === "11122233396"), "P6: depois da falha a execução parou");
  b.ok(emissoes.length === 3 && linhas.length === 3, "o TickOne recebeu 3 pedidos de emissão (P1, P4 e o P5 recusado) e ganhou 2 linhas");
  b.ok(outras.length === 0, "nenhum WhatsApp, e-mail, salvar nem excluir foi tocado", outras.join(","));
  b.ok(!/Teste Fictício|16899535009|168\.995/.test(r.saida), "o log não tem nome nem CPF");
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  b.resumo();
})();
