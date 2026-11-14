/**
 * EMITE NO TICKONE OS INGRESSOS PEDIDOS NO SISGEP (14/11/2026). CRIA INGRESSO DE VERDADE.
 * O usuário: "faz um ingresso de teste". Travas:
 *  - só emite o que está na FILA (emissoes-fila.json, escrita pelo SISGEP depois da confirmação
 *    "cria ingresso de verdade" e da pesquisa "já tem ingresso?"); no máximo 5 por execução;
 *  - PESQUISA ANTES de novo: se o CPF já tem ingresso na lista do TickOne, não emite (FALHOU);
 *  - abre UM lugar livre da grade, confere que o pop-up está VAZIO (lugar novo), preenche e
 *    clica só em "Emitir Ingresso" (nunca em Salvar Dados, Excluir nem WhatsApp/e-mail);
 *  - depois recarrega e confere que apareceu EXATAMENTE uma linha nova com aquele CPF e lê o
 *    código; qualquer coisa inesperada PARA a execução (não tenta de novo: evita emitir em dobro);
 *  - nada pessoal no log: só o id do pedido, o resultado e o código do ingresso.
 * Segredos: INGRESSOS_USUARIO, INGRESSOS_SENHA, CLASPRC_JSON. Teste (sem Drive): FILA_LOCAL e
 * RESULTADO_LOCAL; INGRESSOS_URL aponta para um TickOne falso.
 */
const { chromium } = require("playwright");
const { dig, cpf11, cpfValido, lerJson, gravarJson, entrar, ler } = require("./comum");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const ARQ_FILA = "emissoes-fila.json", ARQ_RES = "emissoes-resultado.json", MAXIMO = 5;
const CATEGORIAS = ["pago", "cortesia", "convite", "associado", "acompanhante"];
const p = (...a) => console.log(...a);

(async () => {
  const fila = await lerJson(ARQ_FILA, process.env.FILA_LOCAL, true);
  const itens = ((fila && fila.itens) || []).slice(0, MAXIMO);
  if (!itens.length) { p("Fila vazia: nada a emitir."); return; }
  if (!USUARIO || !SENHA) { p("Sem INGRESSOS_USUARIO/INGRESSOS_SENHA: nada feito."); return; }
  p("Pedidos na fila:", itens.length);
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const resultado = (await lerJson(ARQ_RES, process.env.RESULTADO_LOCAL)) || { itens: [] };
  const registrar = async (pedido, status, detalhe, codigo) => {
    resultado.itens = (resultado.itens || []).filter(r => r.pedido !== pedido).concat([{ pedido, status, detalhe, codigo: codigo || "", em: new Date().toISOString() }]);
    resultado.atualizadoEm = new Date().toISOString(); await gravarJson(ARQ_RES, resultado, process.env.RESULTADO_LOCAL);
    p("pedido", pedido, "→", status, codigo ? "· código " + codigo : "", detalhe ? "(" + detalhe + ")" : "");
  };
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou. Nada foi emitido."); process.exitCode = 1; return; }
    const jaNaRodada = {};
    for (const it of itens) {
      const cpf = cpf11(it.cpf), nome = String(it.nome || "").trim(), cat = String(it.categoria || "");
      if (!nome || !cpfValido(cpf) || CATEGORIAS.indexOf(cat) < 0) { await registrar(it.pedido, "FALHOU", "pedido sem nome, sem CPF válido (11 dígitos com dígito verificador) ou com categoria que o TickOne não tem: NÃO emiti"); continue; }
      if (jaNaRodada[cpf]) { await registrar(it.pedido, "FALHOU", "CPF repetido nesta fila: NÃO emiti"); continue; }
      const antes = await ler(pg);
      if (!antes) { await registrar(it.pedido, "FALHOU", "não achei a tabela de ingressos"); process.exitCode = 1; break; }
      const ja = antes.linhas.find(l => l.cpf === cpf);
      if (ja) { await registrar(it.pedido, "FALHOU", "este CPF já tem ingresso (código " + ja.codigo + "): NÃO emiti de novo"); continue; }
      /* um lugar LIVRE da grade */
      const abriu = await pg.evaluate(() => {
        const b = [...document.querySelectorAll("button[onclick*='abrirPopUpAssentoAdmin']")].find(x => /text-emerald-400/.test(x.className || "") && !/rose-/.test(x.className || ""));
        if (!b) return false; b.scrollIntoView(); b.click(); return true;
      });
      if (!abriu) { await registrar(it.pedido, "FALHOU", "não achei lugar livre na grade: NÃO emiti"); process.exitCode = 1; break; }
      await pg.waitForSelector("#popup-buyer-nome", { state: "visible", timeout: 6000 }).catch(() => null);
      const vazio = await pg.evaluate(() => ["popup-buyer-nome", "popup-buyer-cpf"].every(id => { const e = document.getElementById(id); return e && e.offsetParent !== null && !(e.value || "").trim(); }));
      if (!vazio) { await registrar(it.pedido, "FALHOU", "o pop-up do lugar não estava vazio (lugar já usado?): NÃO emiti"); process.exitCode = 1; break; }
      await pg.screenshot({ path: "/tmp/popup-vazio.png" }).catch(() => {});
      await pg.selectOption("#popup-tipo-ingresso", cat);
      await pg.fill("#popup-buyer-nome", nome);
      if (it.email) await pg.fill("#popup-buyer-email", String(it.email));
      await pg.fill("#popup-buyer-cpf", cpf);
      if (it.telefone) await pg.fill("#popup-buyer-telefone", String(it.telefone));
      if (it.cidade) await pg.fill("#popup-buyer-cidade", String(it.cidade));
      if (it.escola) await pg.fill("#popup-buyer-observacao", String(it.escola));
      /* o botão "Emitir Ingresso" DO MESMO pop-up do campo de nome (sobe a árvore a partir do nome) */
      const emitir = await pg.evaluateHandle(() => {
        let x = document.getElementById("popup-buyer-nome");
        while (x && x !== document.body) { x = x.parentElement; if (!x) break;
          const bs = [...x.querySelectorAll("button")].filter(b => (b.innerText || "").trim() === "Emitir Ingresso");
          if (bs.length) return bs.find(b => b.offsetParent !== null) || bs[0]; }
        return null;
      });
      const el = emitir.asElement();
      if (!el) { await registrar(it.pedido, "FALHOU", "não achei o botão Emitir Ingresso: NÃO emiti"); process.exitCode = 1; break; }
      jaNaRodada[cpf] = true;
      /* A lista do TickOne numa ABA SEPARADA: é a prova de que o CPF já foi emitido (evita emitir em dobro). */
      const jaTemNaLista = async () => { const aux = await ctx.newPage(); try { await aux.goto(BASE, { waitUntil: "domcontentloaded" }); await aux.waitForTimeout(1200); const e2 = await ler(aux); return !!(e2 && e2.linhas.some(l => l.cpf === cpf)); } finally { await aux.close().catch(() => {}); } };
      try { await el.scrollIntoViewIfNeeded({ timeout: 5000 }); await el.click({ timeout: 10000 }); }
      catch (eClique) {
        /* Se a página recarregou/navegou durante o clique, o elemento se desconecta: isso quer dizer que o clique VALEU; a
           conferência (exatamente 1 linha nova) decide. Só se o botão continua na tela é que foi falha de clique de verdade. */
        const conectado = await el.evaluate(b => b.isConnected).catch(() => false);
        if (conectado) {
          const diag = await el.evaluate(b => { const out = []; let x = b; for (let i = 0; i < 5 && x; i++, x = x.parentElement) { const s = getComputedStyle(x), r = x.getBoundingClientRect();
            out.push((x.id ? "#" + x.id : x.tagName.toLowerCase()) + "{d:" + s.display + ",v:" + s.visibility + ",o:" + s.opacity + ",pos:" + s.position + ",ov:" + s.overflow + ",z:" + s.zIndex + ",w:" + Math.round(r.width) + ",h:" + Math.round(r.height) + ",x:" + Math.round(r.x) + ",y:" + Math.round(r.y) + "}"); }
            return out.join(" < "); }).catch(() => "(sem diagnóstico)");
          p("clique normal falhou:", String(eClique.message).split("\n")[0].slice(0, 90), "· viewport:", JSON.stringify(pg.viewportSize()), "· botão:", diag);
          await pg.evaluate(() => document.querySelectorAll("input,textarea").forEach(i => { i.value = ""; })).catch(() => {});
          await pg.screenshot({ path: "/tmp/popup-erro.png" }).catch(() => {});
          if (await jaTemNaLista()) p("o CPF já está na lista do TickOne: NÃO clico de novo");
          else { p("o CPF ainda não está na lista: tento UMA vez o clique do próprio navegador"); await el.evaluate(b => b.click()); }
        } else p("a página navegou durante o clique (normal depois de emitir): a conferência decide");
      }
      const sim = await pg.waitForSelector("#custom-confirm-yes-btn", { state: "visible", timeout: 3000 }).catch(() => null);
      if (sim) await sim.click().catch(() => {});
      await pg.waitForTimeout(3500);
      await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1500);
      const depois = await ler(pg);
      const novas = depois ? depois.linhas.filter(l => l.cpf === cpf) : [];
      if (!depois || novas.length !== 1 || depois.linhas.length !== antes.linhas.length + 1) {
        await registrar(it.pedido, "FALHOU", "cliquei em Emitir, mas não apareceu exatamente uma linha nova com este CPF (" + novas.length + " linha(s)): a execução parou e NÃO tentei de novo");
        process.exitCode = 1; break;
      }
      await registrar(it.pedido, "EMITIDO", "conferido: apareceu 1 linha nova na lista do TickOne", novas[0].codigo);
    }
  } catch (e) { p("ERRO:", String(e.message).slice(0, 120), "— a execução parou."); process.exitCode = 1; }
  await br.close();
})();
