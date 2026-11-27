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
b.ok(/Corrija/.test(g.compassoIngressos_pedirEmissao([NOVO, { nome: "Sem CPF", cpf: "", categoria: "Cortesia" }], true, TOKEN).mensagem), "com uma linha em 'Conferir', nada é pedido");
b.ok(/Corrija/.test(g.compassoIngressos_pedirEmissao([{ nome: "Assoc Incompleto", cpf: "390.533.447-05", categoria: "Associado" }], true, TOKEN).mensagem), "Associado com campo faltando não passa");
lidoEm = new Date(Date.now() - 40 * 60000).toISOString();
b.ok(!/mais de 15 minutos/.test(g.compassoIngressos_pedirEmissao([NOVO], true, TOKEN).mensagem), "base com 40 min: NÃO barra mais o pedido (o robô confere ao vivo na hora de emitir)");
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
b.passo("2b. CPF que começa com ZERO sobrevive à planilha (o Sheets trata como número e come o zero)");
{
  const z = g.compassoIngressos_pedirEmissao([{ nome: "Zero Inicial Fictício", cpf: "012.345.678-90", categoria: "Convite" }], true, TOKEN);
  b.ok(z.ok, "pedido com CPF 012.345.678-90 registrado", z.mensagem);
  const sh = g.cingAbaEmis_(), ult = sh.getLastRow();
  sh.getRange(ult, 3).setValue(1234567890);   // o que o Sheets faz com o texto "01234567890": vira número
  g.cingPublicarFilaEmissao_();
  const f = JSON.parse(arquivos["emissoes-fila.json"]).itens.find(x => x.nome === "Zero Inicial Fictício");
  b.ok(f && f.cpf === "01234567890", "mesmo com a célula virando número, a fila leva o CPF com 11 dígitos e o zero da frente", f && f.cpf);
  sh.getRange(ult, 11).setValue("CANCELADO"); g.cingPublicarFilaEmissao_();
}
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
    const card = doc.querySelectorAll("#ciPessoas .ci-pessoa")[0];
    [["nome", "Teste Fictício da Silva"], ["cpf", "168.995.350-09"], ["escola", "UVV"], ["cidade", "Cariacica"], ["categoria", "acompanhante"]].forEach(([k, v]) => { const f = card.querySelector("[data-k=" + k + "]"); f.value = v; f.dispatchEvent(new win.Event(f.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
    t.clicar("[data-ci='conferir']"); await t.assentar(400);
    b.ok(!!doc.querySelector("[data-ci='emisPedir']") && /Gerar o ingresso/.test(el("ciRes").textContent), "pesquisa limpa: aparece o botão 'Gerar o ingresso' (sem passo de confirmação)");
    t.clicar("[data-ci='emisPedir']"); await t.assentar(500);
    b.ok(g.compassoIngressos_emissoes(TOKEN).emissoes.length === 1 && el("ciEmis").hidden === true, "um toque em Gerar: o pedido é registrado (sem caixa 'entendo que cria ingresso')");
    b.ok(/aguardando o robô/.test(el("ciEmisLista").textContent) && !!doc.querySelector("[data-ci='cancEmis']"), "a lista de pedidos mostra 'aguardando o robô' e 'Cancelar pedido'");
  } else b.naoTestavel("a tela de emissão", "jsdom não instalado");

  /* ---------- o ROBÔ real contra um TickOne falso ---------- */
  const raizGlobal = (() => { try { return cp.execSync("npm root -g", { encoding: "utf8" }).trim(); } catch (e) { return ""; } })();
  const NODE_PATH = [process.env.NODE_PATH || "", raizGlobal].filter(Boolean).join(path.delimiter);
  try { require(require.resolve("playwright", { paths: NODE_PATH.split(path.delimiter) })); } catch (e) { b.naoTestavel("o robô de emissão", "playwright/Chromium não disponível aqui"); b.resumo(); return; }
  b.fluxo("EMISSÃO · o robô contra um TickOne FALSO");
  let modoBotaoNovo = false;   /* 27/11/2026: o TickOne tirou a grade de lugares e ganhou o botão "Emitir ingresso" */
  let linhas = [{ nome: "Ja Existe Fictícia", cpf: "529.982.247-25", cod: "EXI-0001" }];
  let ocupados = new Set([1, 2]); const LIVRES = [3, 4, 5, 6, 7]; const emissoes = []; const importacoes = []; const outras = []; let seq = 0;
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), logado = /sid=ok/.test(req.headers.cookie || "");
    if (req.method === "POST" && u.searchParams.get("action") === "admin_login") {
      let d = ""; req.on("data", c => d += c); req.on("end", () => { const ok = /username=teste/.test(d) && /password=senha-certa/.test(d); res.writeHead(302, { Location: "/index.php?page=admin", ...(ok ? { "Set-Cookie": "sid=ok; Path=/" } : {}) }); res.end(); }); return;
    }
    if (req.method === "POST" && u.searchParams.get("action") === "emitir") {
      let d = ""; req.on("data", c => d += c); req.on("end", () => {
        const j = JSON.parse(d); emissoes.push(j);
        if (/FALHA-SERVIDOR/.test(j.nome) || !j.nome || (!j.cpf && !/^(convite|acompanhante)$/.test(j.tipo))) {   /* o TickOne FALSO aceita convite/acompanhante sem CPF — HIPÓTESE a confirmar no TickOne de verdade */ res.statusCode = 400; res.end("erro"); return; }
        ocupados.add(Number(j.seat)); seq++; linhas.push({ nome: j.nome, cpf: String(j.cpf || "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"), cod: "TST-000" + seq }); res.end("ok");
      }); return;
    }
    if (req.method === "POST" && u.searchParams.get("action") === "admin_import_tickets") {   /* 27/11/2026: o formulário de importação do TickOne (multipart, input file "arquivo") */
      const partes = []; req.on("data", c => partes.push(c)); req.on("end", () => {
        const corpoTxt = Buffer.concat(partes).toString("utf8"), m = corpoTxt.match(/name="arquivo"[^\r\n]*\r\n(?:Content-Type:[^\r\n]*\r\n)?\r\n([\s\S]*?)\r\n--/);
        const csv = (m ? m[1] : "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
        importacoes.push({ cabecalho: csv[0], linhas: csv.slice(1), temCsrf: /name="csrf"/.test(corpoTxt), evento: (corpoTxt.match(/name="evento_id"\r\n\r\n(\d+)/) || [])[1] });
        csv.slice(1).forEach(l => { const c = l.split(";"); seq++; emissoes.push({ via: "import", nome: c[0], telefone: c[3], tipo: c[6] }); linhas.push({ nome: c[0], cpf: "", cod: "TST-000" + seq }); });
        res.writeHead(302, { Location: "/index.php?page=admin&evt_id=17" }); res.end();
      }); return;
    }
    if (u.searchParams.get("action")) { outras.push(u.searchParams.get("action")); res.end("ok"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!logado) { res.end('<form method="post" action="/index.php?action=admin_login"><input name="username"><input type="password" name="password"><button type="submit">Entrar</button></form>'); return; }
    const livre = "seat-fluid bg-slate-850 border border-slate-700/80 text-emerald-400 hover:x", ocup = "seat-fluid bg-rose-500/20 text-rose-400 border border-rose-500/40";
    res.end('<h1>Gestão</h1><table><thead><tr><th></th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Código</th><th>Tipo</th><th>Escola</th><th>Cidade</th><th>Ações</th></tr></thead><tbody>' +
      linhas.map(l => `<tr><td></td><td>${l.nome}</td><td>${l.cpf}</td><td>t</td><td>${l.cod}</td><td>Associado</td><td>E</td><td>C</td><td><button title="Enviar o ingresso (PDF) pelo WhatsApp" onclick="fetch('/index.php?action=whats')">w</button><a title="Reemitir (PDF)" href="index.php?page=ticket&ref=REF-${l.cod}">p</a><button title="Excluir ingresso" onclick="fetch('/index.php?action=excluir')">x</button></td></tr>`).join("") + '</tbody></table>' +
      (modoBotaoNovo ? '<button onclick="emitirNovoIngressoAdmin(17)">Emitir ingresso</button><form method="post" action="index.php?action=admin_import_tickets" enctype="multipart/form-data" onsubmit="return confirm(\'Isso vai emitir um ingresso para cada linha do arquivo, ocupando os ingressos disponíveis. Confirmar importação?\')"><input type="hidden" name="csrf" value="tok"><input type="hidden" name="evento_id" value="17"><input type="file" name="arquivo" accept=".csv,.xlsx"><button type="submit">Importar</button></form>' : [1, 2].concat(LIVRES).map(n => `<button class="${ocupados.has(n) ? ocup : livre}" onclick="abrirPopUpAssentoAdmin(${n})">${n}</button>`).join("")) +
      '<div id="pop" style="display:none"><select id="popup-tipo-ingresso"><option value="pago">Pago</option><option value="cortesia">Cortesia</option><option value="convite">Convite</option><option value="associado">Associado</option><option value="acompanhante">Acompanhante Associado</option></select>' +
      '<input id="popup-buyer-nome"><input id="popup-buyer-email"><input id="popup-buyer-cpf"><input id="popup-buyer-telefone"><input id="popup-buyer-cidade"><textarea id="popup-buyer-observacao"></textarea>' +
      '<button onclick="fetch(\'/index.php?action=salvar\')">Salvar Dados</button><button onclick="fetch(\'/index.php?action=excluir\')">Excluir</button><button id="emit" onclick="emitir()">Emitir Ingresso</button></div>' +
      '<script>var seat=0;function emitirNovoIngressoAdmin(){abrirPopUpAssentoAdmin(0)}function abrirPopUpAssentoAdmin(n){seat=n;["popup-buyer-nome","popup-buyer-email","popup-buyer-cpf","popup-buyer-telefone","popup-buyer-cidade","popup-buyer-observacao"].forEach(function(i){document.getElementById(i).value=""});document.getElementById("pop").style.display="block"}' +
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
    { pedido: "P1b", nome: "Zero Inicial Fictício", cpf: "1234567890", categoria: "convite" },
    { pedido: "P2", nome: "Ja Existe Fictícia", cpf: "52998224725", categoria: "associado" },
    { pedido: "P3", nome: "Categoria Errada", cpf: "39053344705", categoria: "vip" },
    { pedido: "P3b", nome: "Cpf Curto Inválido", cpf: "1111111111", categoria: "convite" },
    { pedido: "P4", nome: "Segundo Teste Fictício", cpf: "45317828791", categoria: "convite", escola: "UVV" },
    { pedido: "P5", nome: "FALHA-SERVIDOR", cpf: "11144477735", categoria: "convite" },
    { pedido: "P6", nome: "Nunca Chega Fictício", cpf: "11122233396", categoria: "convite" }
  ];
  b.passo("5. Fila vazia e login errado: nada é emitido");
  let r = await rodar([]); b.ok(/Fila vazia/.test(r.saida) && emissoes.length === 0, "fila vazia: não faz nada");
  r = await rodar([P[0]], "senha-errada"); b.ok(r.codigo === 1 && /login não entrou/.test(r.saida) && emissoes.length === 0, "login errado: para e não emite nada");
  b.passo("6. As travas");
  /* o robô processa no máximo 5 por execução: 1ª rodada com os 5 primeiros, 2ª com o resto (como no mundo real) */
  const r1 = await rodar(P.slice(0, 5));
  const r2 = await rodar(P.slice(5));
  r = { saida: r1.saida + "\n" + r2.saida, codigo: r2.codigo, resultado: r1.resultado.concat(r2.resultado) };
  const st = {}; r.resultado.forEach(x => { st[x.pedido] = x; });
  b.ok(st.P1 && st.P1.status === "EMITIDO" && st.P1.codigo === "TST-0001", "P1: emitido e conferido, com o código lido da lista", JSON.stringify(st.P1));
  const e1 = emissoes[0];
  b.ok(e1.tipo === "acompanhante" && e1.nome === "Teste Fictício da Silva" && e1.cpf === "16899535009" && e1.email === "teste@exemplo.com" && e1.cidade === "Cariacica" && e1.escola === "UVV" && e1.seat === 3, "preencheu categoria, nome, CPF, e-mail, cidade e escola, num lugar LIVRE (o 3; 1 e 2 são ocupados)", JSON.stringify(e1));
  b.ok(st.P1b && st.P1b.status === "EMITIDO" && emissoes.find(x => x.nome === "Zero Inicial Fictício").cpf === "01234567890", "P1b (CPF veio com 10 dígitos, o zero da frente se perdeu): o robô completa para 01234567890 e emite", JSON.stringify(st.P1b));
  b.ok(st.P2 && st.P2.status === "FALHOU" && /já tem ingresso/.test(st.P2.detalhe) && !emissoes.some(x => x.cpf === "52998224725"), "P2 (CPF já na lista): pesquisa antes, NÃO emitiu de novo");
  b.ok(st.P3b && st.P3b.status === "FALHOU" && /CPF inválido/.test(st.P3b.detalhe) && !emissoes.some(x => /1111111111/.test(x.cpf)), "P3b (CPF que não fecha o dígito verificador, nem completando o zero): NÃO emite");
  b.ok(st.P3 && st.P3.status === "FALHOU" && /categoria/.test(st.P3.detalhe), "P3 (categoria que o TickOne não tem): não emite");
  b.ok(st.P4 && st.P4.status === "EMITIDO" && st.P4.codigo === "TST-0003" && emissoes.find(x => x.cpf === "45317828791").seat === 5, "P4: emitido no PRÓXIMO lugar livre (5), pois o 3 e o 4 foram usados");
  b.ok(st.P5 && st.P5.status === "FALHOU" && /NÃO tentei de novo/.test(st.P5.detalhe) && r.codigo === 1, "P5 (TickOne recusou): para e NÃO tenta de novo");
  b.ok(st.P6 === undefined && !emissoes.some(x => x.cpf === "11122233396"), "P6: depois da falha a execução parou");
  b.ok(emissoes.length === 4 && linhas.length === 4, "o TickOne recebeu 4 pedidos de emissão (P1, P1b, P4 e o P5 recusado) e ganhou 3 linhas");
  b.ok(outras.length === 0, "nenhum WhatsApp, e-mail, salvar nem excluir foi tocado", outras.join(","));
  b.ok(!/Teste Fictício|16899535009|168\.995/.test(r.saida), "o log não tem nome nem CPF");
  modoBotaoNovo = true;   // daqui em diante a página é a NOVA: sem grade de lugares, só o botão "Emitir ingresso"
  b.passo("7. CONVITE e ACOMPANHANTE sem CPF (27/11/2026): a identidade é o NOME");
  const antes7 = emissoes.length;
  const r3 = await rodar([
    { pedido: "S1", nome: "Sem Cpf Fictício", telefone: "27999990001", categoria: "convite" },
    { pedido: "S1b", nome: "SEM CPF FICTICIO", categoria: "convite" },
    { pedido: "S2", nome: "Cortesia Sem Cpf", categoria: "cortesia" },
    { pedido: "S3", nome: "Acompanhante Sem Cpf", categoria: "acompanhante" }
  ]);
  const st3 = {}; r3.resultado.forEach(x => { st3[x.pedido] = x; });
  b.ok(st3.S1 && st3.S1.status === "EMITIDO", "S1 (convite sem CPF): emitido", JSON.stringify(st3.S1));
  b.ok(st3.S1b && st3.S1b.status === "FALHOU" && /nome/.test(st3.S1b.detalhe), "S1b (mesmo nome, sem acento/maiúscula): NÃO emite de novo", JSON.stringify(st3.S1b));
  b.ok(st3.S2 && st3.S2.status === "FALHOU" && /CPF/.test(st3.S2.detalhe), "S2 (cortesia sem CPF): continua exigindo CPF", JSON.stringify(st3.S2));
  b.ok(st3.S3 && st3.S3.status === "EMITIDO", "S3 (acompanhante sem CPF): emitido", JSON.stringify(st3.S3));
  b.ok(emissoes.length === antes7 + 2, "o TickOne recebeu só os 2 emitidos", String(emissoes.length - antes7));
  b.ok(importacoes.length === 2 && importacoes.every(i => i.cabecalho === "Nome;Email;CPF;Telefone;Cidade;Escola;Tipo" && i.linhas.length === 1 && i.temCsrf && i.evento === "17"), "sem CPF vai pela IMPORTAÇÃO: uma planilha de UMA linha cada, com o cabeçalho do modelo oficial, o csrf e o evento", JSON.stringify(importacoes));
  b.ok(importacoes[0] && /^Sem Cpf Fictício;;;\(27\) 99999-0001;;;Convidado$/.test(importacoes[0].linhas[0]) && importacoes[1] && /^Acompanhante Sem Cpf;;;;;;Acompanhante do Associado$/.test(importacoes[1].linhas[0]), "a linha sai no formato do modelo (Tipo 'Convidado' / 'Acompanhante do Associado', telefone com máscara)", JSON.stringify(importacoes.map(i => i.linhas[0])));
  b.ok(!emissoes.slice(antes7).some(x => x.via !== "import"), "e nada passou pelo formulário comum (que exige CPF)");
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  b.resumo();
  process.exit(process.exitCode || 0);   // a tela acompanha o pedido por timer; o teste termina por aqui
})();
