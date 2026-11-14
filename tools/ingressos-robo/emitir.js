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
const { dig, lerJson, gravarJson, entrar, ler } = require("./comum");
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
      const cpf = dig(it.cpf), nome = String(it.nome || "").trim(), cat = String(it.categoria || "");
      if (!nome || cpf.length !== 11 || CATEGORIAS.indexOf(cat) < 0) { await registrar(it.pedido, "FALHOU", "pedido sem nome, CPF válido ou categoria do TickOne: NÃO emiti"); continue; }
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
      await pg.selectOption("#popup-tipo-ingresso", cat);
      await pg.fill("#popup-buyer-nome", nome);
      if (it.email) await pg.fill("#popup-buyer-email", String(it.email));
      await pg.fill("#popup-buyer-cpf", cpf);
      if (it.telefone) await pg.fill("#popup-buyer-telefone", String(it.telefone));
      if (it.cidade) await pg.fill("#popup-buyer-cidade", String(it.cidade));
      if (it.escola) await pg.fill("#popup-buyer-observacao", String(it.escola));
      const emitir = await pg.evaluateHandle(() => [...document.querySelectorAll("button")].filter(b => b.offsetParent !== null && (b.innerText || "").trim() === "Emitir Ingresso")[0] || null);
      const el = emitir.asElement();
      if (!el) { await registrar(it.pedido, "FALHOU", "não achei o botão Emitir Ingresso: NÃO emiti"); process.exitCode = 1; break; }
      jaNaRodada[cpf] = true;
      await el.click();
      const sim = await pg.waitForSelector("#custom-confirm-yes-btn", { state: "visible", timeout: 3000 }).catch(() => null);
      if (sim) await sim.click();
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
