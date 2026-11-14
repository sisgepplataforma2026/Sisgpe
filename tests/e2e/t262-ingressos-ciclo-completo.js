/**
 * INGRESSOS — O CICLO COMPLETO, DO INÍCIO AO FIM (14/11/2026).
 * Usuário: "tem que testar tudo antes, a função do início ao fim do que foi proposto".
 * As duas pontas LIGADAS: o SISGEP (backend real + tela real em jsdom, Drive FALSO) e os 4 ROBÔS
 * REAIS (ler-base, emitir, excluir, em Chromium) contra um TICKONE FALSO. Os arquivos que no mundo
 * real passam pelo Drive (base, filas, resultados) passam aqui por uma "ponte" que copia o que o
 * SISGEP gravou para o robô e o que o robô gravou de volta para o SISGEP.
 *
 * A vida de um ingresso: ler a base → pesquisar antes → pedir a emissão → o robô emite → aparece na
 * base ("já tem", com código) → enviar no WhatsApp e confirmar → pedir a exclusão → o robô exclui →
 * some da base → a pesquisa volta a dar "novo". E o TickOne falso prova o que o robô tocou.
 * NÃO PROVA: o TickOne de verdade, o Drive de verdade (permissões), o WhatsApp, nem o celular.
 */
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const b = require("./base");
const dom = require("./dom");
const tickone = require("./tickone-falso");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* ---- Drive falso (a pasta do robô) ---- */
const arquivos = {};
g.cingPastaRobo_ = () => ({
  getFilesByName: n => { const tem = n in arquivos; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { setContent: t => { arquivos[n] = t; }, getBlob: () => ({ getDataAsString: () => arquivos[n] }) }; } }; },
  createFile: (n, t) => { arquivos[n] = t; }
});
g.cingPdfs_ = () => ({});
g.compasso_dadosDaFesta_ = () => ({ data: "2026-12-19", horaInicio: "20h", local: "Patrick Ribeiro", endereco: "Aeroporto de Vitória" });
g.compasso_dataPorExtenso_ = () => "sábado, 19 de dezembro de 2026";

(async function () {
  const raizGlobal = (() => { try { return cp.execSync("npm root -g", { encoding: "utf8" }).trim(); } catch (e) { return ""; } })();
  const NODE_PATH = [process.env.NODE_PATH || "", raizGlobal].filter(Boolean).join(path.delimiter);
  try { require(require.resolve("playwright", { paths: NODE_PATH.split(path.delimiter) })); } catch (e) { b.naoTestavel("o ciclo completo", "playwright/Chromium não disponível aqui — rode onde houver"); b.resumo(); return; }

  const T = await tickone.iniciar([
    { nome: "Maria Existente Fictícia", cpf: "52998224725", tel: "(27) 99999-0001", cod: "TK-0001", tipo: "Associado", escola: "Escola Modelo", cidade: "Vitória" },
    { nome: "João Existente Fictício", cpf: "11144477735", tel: "(27) 99999-0002", cod: "TK-0002", tipo: "Associado", escola: "Colégio Fictício", cidade: "Serra" }]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ciclo-"));
  const F = n => path.join(tmp, n);
  function robo(script, env) {
    return new Promise(ok => {
      const f = cp.spawn("node", [path.join(__dirname, "..", "..", "tools", "ingressos-robo", script)],
        { env: { ...process.env, NODE_PATH, INGRESSOS_URL: T.url, INGRESSOS_USUARIO: "teste", INGRESSOS_SENHA: "senha-certa", ...env } });
      let saida = ""; f.stdout.on("data", d => saida += d); f.stderr.on("data", d => saida += d);
      const tm = setTimeout(() => f.kill(), 150000);
      f.on("close", codigo => { clearTimeout(tm); ok({ saida, codigo }); });
    });
  }
  /* ponte Drive: SISGEP → robô (fila) e robô → SISGEP (base / resultado) */
  async function lerBase() { try { fs.unlinkSync(F("base.json")); } catch (e) {} const r = await robo("ler-base.js", { BASE_LOCAL: F("base.json") }); arquivos["ingressos-base.json"] = fs.readFileSync(F("base.json"), "utf8"); return r; }
  async function rodarFila(script, filaNome, resNome, filaLocal, resLocal) {
    fs.writeFileSync(F(filaLocal), arquivos[filaNome]); try { fs.unlinkSync(F(resLocal)); } catch (e) {}
    const r = await robo(script, { FILA_LOCAL: F(filaLocal), RESULTADO_LOCAL: F(resLocal) });
    if (fs.existsSync(F(resLocal))) arquivos[resNome] = fs.readFileSync(F(resLocal), "utf8");
    return r;
  }
  arquivos["emissoes-fila.json"] = JSON.stringify({ itens: [] });     // o robô cria a fila vazia na 1ª execução
  arquivos["exclusoes-fila.json"] = JSON.stringify({ itens: [] });

  const PESSOA = { nome: "TESTE Fictício da Silva", cpf: "168.995.350-09", email: "teste@exemplo.com", telefone: "(27) 97777-0099", escola: "UVV", cidade: "Cariacica", categoria: "Acompanhante Associado" };

  b.fluxo("CICLO · 1. ler a base e pesquisar antes");
  let r = await lerBase();
  b.ok(r.codigo === 0 && /lidas 2 linhas/.test(r.saida), "o robô leu a base do TickOne (2 ingressos)", r.saida.trim().split("\n").pop());
  const est = g.compassoIngressos_estado(TOKEN);
  b.ok(est.ok && est.existe && est.total === 2 && est.porTipo.associado === 2, "o SISGEP vê a base que o robô entregou");
  let cf = g.compassoIngressos_conferir([PESSOA], TOKEN);
  b.ok(cf.ok && cf.resultados[0].situacao === "novo" && cf.emissaoLiberada === true, "pesquisa antes: a pessoa é NOVA e a emissão é liberada (base recente)");

  b.fluxo("CICLO · 2. pedir a emissão e o robô emitir");
  const pe = g.compassoIngressos_pedirEmissao([PESSOA], true, TOKEN);
  b.ok(pe.ok && pe.pedidos === 1, "pedido de emissão registrado", pe.mensagem);
  r = await rodarFila("emitir.js", "emissoes-fila.json", "emissoes-resultado.json", "efila.json", "eres.json");
  b.ok(r.codigo === 0 && /EMITIDO/.test(r.saida) && !/Fulano|TESTE|168\.995|16899535009/.test(r.saida), "o robô emitiu, sem nome nem CPF no log", r.saida.trim().split("\n").slice(-2).join(" | "));
  b.ok(T.pedidosEmissao.length === 1 && T.pedidosEmissao[0].tipo === "acompanhante" && T.pedidosEmissao[0].escola === "UVV" && T.pedidosEmissao[0].cidade === "Cariacica" && T.pedidosEmissao[0].email === "teste@exemplo.com" && T.ocupados.has(Number(T.pedidosEmissao[0].seat)), "o TickOne recebeu UM pedido, com categoria, escola, cidade e e-mail, num lugar livre");
  const em = g.compassoIngressos_emissoes(TOKEN).emissoes[0];
  b.ok(em.status === "EMITIDO" && em.codigo === "TK-0003", "o resultado do robô voltou: SISGEP mostra EMITIDO com o código", em.status + " " + em.codigo);

  b.fluxo("CICLO · 3. aparece na base como 'já tem' (e não dá para emitir de novo)");
  await lerBase();
  cf = g.compassoIngressos_conferir([PESSOA], TOKEN);
  b.ok(cf.resultados[0].situacao === "ja_tem" && cf.resultados[0].codigo === "TK-0003", "a mesma pessoa agora é 'já tem', com o código", cf.resultados[0].situacao);
  b.ok(g.compassoIngressos_pedirEmissao([PESSOA], true, TOKEN).ok === false, "e o SISGEP recusa pedir de novo (nada novo para emitir)");
  const lista = g.compassoIngressos_lista(TOKEN).linhas, minha = lista.find(l => l.codigo === "TK-0003");
  b.ok(lista.length === 3 && minha && minha.categoria === "acompanhante" && minha.escola === "UVV" && minha.foneOk === true, "a lista de enviar mostra o novo ingresso (acompanhante, UVV, telefone ok)");

  b.fluxo("CICLO · 4. tela real: o 'já tem' agora oferece enviar e abrir (o defeito do print)");
  if (dom.jsdomDisponivel()) {
    const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
    const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
    const abertos = []; win.open = u => { abertos.push(u); return null; };
    win.cingCarregar(); await t.assentar(300);
    t.clicar("[data-ci='aba'][data-arg='solicitar']");
    const card = doc.querySelectorAll("#ciPessoas .ci-pessoa")[0];
    [["nome", PESSOA.nome], ["cpf", PESSOA.cpf], ["telefone", PESSOA.telefone], ["escola", PESSOA.escola], ["cidade", PESSOA.cidade], ["categoria", "acompanhante"]].forEach(([k, v]) => { const f = card.querySelector("[data-k=" + k + "]"); f.value = v; f.dispatchEvent(new win.Event(f.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
    t.clicar("[data-ci='conferir']"); await t.assentar(500);
    const c0 = doc.querySelectorAll("#ciPessoas .ci-pessoa")[0];
    b.ok(/Já tem ingresso · TK-0003/.test(c0.textContent) && !!c0.querySelector("[data-ci='zap'][data-arg='TK-0003']") && !!c0.querySelector("a[href*='ref=REF-TK-0003']"), "o cartão diz 'já tem ingresso' e oferece 📱 Enviar no WhatsApp e 🎟️ abrir/baixar");
    t.clicar("#ciPessoas [data-ci='zap'][data-arg='TK-0003']"); await t.assentar(400);
    b.ok(abertos.length === 1 && /^https:\/\/wa\.me\/5527977770099\?text=/.test(abertos[0]) && /TK-0003/.test(decodeURIComponent(abertos[0])), "o WhatsApp abre no número certo, com a mensagem e o código");
    b.ok(g.compassoIngressos_estado(TOKEN).enviados === 0, "abrir o WhatsApp ainda NÃO marca enviado");
    t.clicar("#ciPessoas [data-ci='confirmar'][data-arg='TK-0003']"); await t.assentar(400);
    b.ok(g.compassoIngressos_estado(TOKEN).enviados === 1 && g.compassoIngressos_lista(TOKEN).linhas.find(l => l.codigo === "TK-0003").enviado.quem !== "", "depois do 'Confirmar envio': registrado, com quem enviou");
  } else b.naoTestavel("a tela do ciclo", "jsdom não instalado");

  b.fluxo("CICLO · 5. pedir a exclusão e o robô excluir");
  const px = g.compassoIngressos_pedirExclusao("TK-0003", "não vai mais", true, TOKEN);
  b.ok(px.ok, "pedido de exclusão registrado", px.mensagem);
  r = await rodarFila("excluir.js", "exclusoes-fila.json", "exclusoes-resultado.json", "xfila.json", "xres.json");
  b.ok(r.codigo === 0 && /EXCLUIDO/.test(r.saida), "o robô excluiu e conferiu que a linha saiu", r.saida.trim().split("\n").pop());
  const ex = g.compassoIngressos_lista(TOKEN).linhas.find(l => l.codigo === "TK-0003");
  b.ok(ex && ex.exclusao && ex.exclusao.status === "EXCLUIDO", "o SISGEP mostra 'excluído' (o resultado do robô voltou)");
  await lerBase();
  b.ok(g.compassoIngressos_lista(TOKEN).linhas.length === 2 && !g.compassoIngressos_lista(TOKEN).linhas.some(l => l.codigo === "TK-0003"), "na próxima leitura a pessoa SUMIU da base");
  cf = g.compassoIngressos_conferir([PESSOA], TOKEN);
  b.ok(cf.resultados[0].situacao === "novo", "e a pesquisa volta a dar 'novo' (o ciclo fecha)");

  b.fluxo("CICLO · 6. o que o robô tocou no TickOne");
  b.ok(T.chamadas.join(",") === "emitir,excluir:3", "UMA emissão e UMA exclusão; nenhum WhatsApp, e-mail, editar nem 'salvar'", T.chamadas.join(","));
  b.ok(T.linhas.length === 2 && T.linhas.every(l => ["TK-0001", "TK-0002"].indexOf(l.cod) >= 0), "os 2 ingressos que já existiam continuam intactos");
  T.fechar(); fs.rmSync(tmp, { recursive: true, force: true });
  b.resumo();
})();
