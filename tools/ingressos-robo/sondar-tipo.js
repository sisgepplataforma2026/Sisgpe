/**
 * SONDA SÓ DE LEITURA: por que a categoria "Associado" pedida saiu "Pago" no 1º ingresso real (15/11/2026).
 * Abre um lugar livre, escolhe a categoria, preenche campos FICTÍCIOS e LÊ o que o pop-up guarda a cada passo.
 * NUNCA clica em "Emitir Ingresso", "Salvar Dados", "Excluir", WhatsApp ou e-mail; ao fim recarrega a página.
 * Log: só estrutura (valores de opção, nomes de função), nada pessoal.
 */
const { chromium } = require("playwright");
const { entrar } = require("./comum");
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const p = (...a) => console.log(...a);
(async () => {
  if (!USUARIO || !SENHA) { p("Sem segredos: nada feito."); return; }
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const pedidos = []; pg.on("request", r => { if (r.method() !== "GET") pedidos.push(r.method() + " " + new URL(r.url()).pathname + new URL(r.url()).search.slice(0, 60)); });
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou."); process.exitCode = 1; return; }
    await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => {});
    const abriu = await pg.evaluate(() => { const b = [...document.querySelectorAll("button[onclick*='abrirPopUpAssentoAdmin']")].find(x => /text-emerald-400/.test(x.className || "") && !/rose-/.test(x.className || "")); if (!b) return false; b.scrollIntoView(); b.click(); return true; });
    p("lugar livre aberto:", abriu); if (!abriu) return;
    await pg.waitForSelector("#popup-buyer-nome", { state: "visible", timeout: 6000 }).catch(() => null);
    const sel = "#popup-tipo-ingresso";
    const info = await pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; return { tag: e.tagName, tipoInput: e.type, onchange: (e.getAttribute("onchange") || "").slice(0, 200), nome: e.name || "", valorInicial: e.value, opcoes: [...e.options].map(o => ({ v: o.value, t: (o.textContent || "").trim(), sel: o.selected, dis: o.disabled })) }; }, sel);
    p("SELETOR:", JSON.stringify(info));
    const ler = async (rot) => p("  valor depois de", rot + ":", await pg.$eval(sel, e => e.value + " | texto: " + (e.options[e.selectedIndex] || {}).textContent).catch(() => "?"));
    await ler("abrir");
    await pg.selectOption(sel, "associado"); await ler("selectOption('associado')");
    await pg.fill("#popup-buyer-nome", "Teste Sonda"); await ler("preencher nome");
    await pg.fill("#popup-buyer-email", "sonda@exemplo.com"); await ler("preencher e-mail");
    await pg.fill("#popup-buyer-cpf", "16899535009"); await ler("preencher CPF");
    await pg.fill("#popup-buyer-telefone", "27999451089"); await ler("preencher telefone");
    await pg.fill("#popup-buyer-cidade", "Cidade"); await ler("preencher cidade");
    await pg.fill("#popup-buyer-observacao", "Escola"); await ler("preencher observação");
    await pg.waitForTimeout(1500); await ler("esperar 1,5 s");
    const resto = await pg.evaluate(() => {
      const nome = document.getElementById("popup-buyer-nome"); let x = nome; let pop = null; while (x && !pop) { x = x.parentElement; if (x && [...x.querySelectorAll("button")].some(b => /Emitir Ingresso/i.test(b.innerText || ""))) pop = x; }
      const bts = pop ? [...pop.querySelectorAll("button")].map(b => ({ txt: (b.innerText || "").trim().slice(0, 30), onclick: (b.getAttribute("onclick") || "").slice(0, 160) })) : [];
      const campos = pop ? [...pop.querySelectorAll("input,select,textarea")].map(e => ({ id: e.id, name: e.name, tipo: e.type, req: e.required, vis: e.offsetParent !== null })) : [];
      const fnTexto = [...document.scripts].map(s => s.textContent || "").join("\n");
      const nomesFn = (fnTexto.match(/function\s+(\w*(?:emit|ticket|ingresso|venda|popup)\w*)\s*\(/gi) || []).slice(0, 20);
      const usos = []; const re = /popup-tipo-ingresso/g; let m; while ((m = re.exec(fnTexto)) && usos.length < 6) usos.push(fnTexto.slice(Math.max(0, m.index - 90), m.index + 110).replace(/\s+/g, " "));
      return { bts, campos, nomesFn, usos };
    });
    p("BOTÕES DO POP-UP:", JSON.stringify(resto.bts)); p("CAMPOS:", JSON.stringify(resto.campos)); p("FUNÇÕES com emit/ticket/popup:", JSON.stringify(resto.nomesFn));
    p("TRECHOS QUE USAM O SELETOR DE TIPO:"); resto.usos.forEach(u => p("   …" + u.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "CPF") + "…"));
  } catch (e) { p("erro:", String(e.message).slice(0, 160)); process.exitCode = 1; }
  p("pedidos de escrita feitos pela sonda (deve ser nenhum):", JSON.stringify(pedidos.filter(x => !/^POST .*login/i.test(x))));
  await br.close();
})();
