/**
 * SONDA SÓ DE LEITURA DO POP-UP DE CONFIRMAÇÃO DA EXCLUSÃO (15/11/2026).
 * A 3ª tentativa real mostrou o botão "Confirmar" com pointer-events:none e o clique por script não excluiu.
 * Aqui: abre o pop-up de UMA linha (a primeira), descreve o botão e o que o cerca, lê o código das funções e vê se o
 * botão "destrava" com o tempo. NUNCA clica em Confirmar: ao fim recarrega a página. Log só de estrutura.
 */
const { chromium } = require("playwright");
const { entrar } = require("./comum");
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const p = (...a) => console.log(...a);
const mask = s => String(s || "").replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "CPF").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "EMAIL");
(async () => {
  if (!USUARIO || !SENHA) { p("Sem segredos: nada feito."); return; }
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const escritas = []; pg.on("request", r => { if (r.method() !== "GET") escritas.push(r.method() + " " + new URL(r.url()).pathname + new URL(r.url()).search.slice(0, 50)); });
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou."); process.exitCode = 1; return; }
    await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => {});
    const abriu = await pg.evaluate(() => { const t = [...document.querySelectorAll("table")].find(x => /Cliente/.test(x.innerText) && /Código/.test(x.innerText)); const b = t && [...t.querySelectorAll("tbody tr")[0].querySelectorAll("button")].find(x => /excluir/i.test(x.title || "")); if (!b) return false; b.click(); return true; });
    p("pop-up aberto pelo clique por script na 1ª linha:", abriu); if (!abriu) return;
    const medir = async (rot) => p("  [" + rot + "]", await pg.evaluate(() => { const b = document.getElementById("custom-confirm-yes-btn"); if (!b) return "sem botão"; const out = []; let x = b; for (let i = 0; i < 6 && x; i++, x = x.parentElement) { const s = getComputedStyle(x); out.push((x.id ? "#" + x.id : x.tagName.toLowerCase()) + "." + String(x.className || "").split(/\s+/).slice(0, 3).join(".") + "{d:" + s.display + ",v:" + s.visibility + ",o:" + s.opacity + ",pe:" + s.pointerEvents + ",z:" + s.zIndex + "}"); } return out.join(" < "); }));
    await medir("0 s"); await pg.waitForTimeout(700); await medir("0,7 s"); await pg.waitForTimeout(1500); await medir("2,2 s"); await pg.waitForTimeout(3000); await medir("5,2 s");
    const info = await pg.evaluate(() => {
      const b = document.getElementById("custom-confirm-yes-btn"); let box = b; while (box && !/fixed|absolute/.test(getComputedStyle(box).position)) box = box.parentElement;
      const bts = box ? [...box.querySelectorAll("button")].map(x => ({ id: x.id, txt: (x.innerText || "").trim().slice(0, 30), onclick: (x.getAttribute("onclick") || "").slice(0, 120), tipo: x.type, pe: getComputedStyle(x).pointerEvents })) : [];
      const fn = (n) => (typeof window[n] === "function" ? String(window[n]).replace(/\s+/g, " ").slice(0, 700) : "(não existe)");
      const todas = [...document.scripts].map(s => s.textContent || "").join("\n");
      const conf = []; const re = /custom-confirm-yes-btn/g; let m; while ((m = re.exec(todas)) && conf.length < 4) conf.push(todas.slice(Math.max(0, m.index - 300), m.index + 500).replace(/\s+/g, " "));
      return { texto: box ? (box.innerText || "").replace(/\s+/g, " ").slice(0, 200) : "", bts, excluirVendaUnica: fn("excluirVendaUnica"), excluirIngressosPorIds: fn("excluirIngressosPorIds"), conf };
    });
    p("TEXTO DO POP-UP:", mask(info.texto)); p("BOTÕES:", JSON.stringify(info.bts));
    p("excluirVendaUnica:", mask(info.excluirVendaUnica)); p("excluirIngressosPorIds:", mask(info.excluirIngressosPorIds));
    info.conf.forEach((c, i) => p("TRECHO #custom-confirm-yes-btn " + (i + 1) + ":", mask(c)));
  } catch (e) { p("erro:", mask(String(e.message).slice(0, 200))); process.exitCode = 1; }
  p("pedidos de escrita feitos pela sonda (deve ser nenhum):", JSON.stringify(escritas.filter(x => !/login/i.test(x))));
  await br.close();
})();
