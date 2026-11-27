/**
 * SONDA SÓ DE LEITURA: A GRADE DE LUGARES DO TICKONE (27/11/2026). O robô de emissão parou com "não achei lugar livre na grade" (teste real da Presidência).
 * Conta os botões de lugar por classe (cor), os números de lugar mais baixo e mais alto, e procura paginação/filtro. Só lê: não clica em nada que grave.
 * Nada pessoal no log: só contagens e nomes de classe.
 */
const { chromium } = require("playwright");
const { entrar } = require("./comum");
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const p = (...a) => console.log(...a);
(async () => {
  if (!USUARIO || !SENHA) { p("Sem segredos: nada feito."); return; }
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou."); process.exitCode = 1; return; }
    await pg.waitForSelector("table tbody tr", { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(3000);
    const r = await pg.evaluate(() => {
      const bs = [...document.querySelectorAll("button[onclick*='abrirPopUpAssentoAdmin']")];
      const grupos = {}; const nums = [];
      bs.forEach(b => {
        const cls = String(b.className || "").replace(/\s+/g, " ").trim();
        const cor = (cls.match(/(text|border|bg)-(emerald|rose|slate|amber|red|green|blue|yellow|gray)[-\w\/]*/g) || []).slice(0, 4).join(" ");
        grupos[cor || "(sem cor)"] = (grupos[cor || "(sem cor)"] || 0) + 1;
        const n = Number(((b.getAttribute("onclick") || "").match(/\((\d+)/) || [])[1]); if (n) nums.push(n);
      });
      const exemplos = {}; bs.slice(0, 2000).forEach(b => { const cls = String(b.className || "").replace(/\s+/g, " ").trim(); const k = cls.slice(0, 160); exemplos[k] = (exemplos[k] || 0) + 1; });
      const controles = [...document.querySelectorAll("button, select, a")].map(e => (e.innerText || e.title || "").trim().slice(0, 30)).filter(t => /mais|próxim|proxim|página|pagina|setor|filtro|todos|livres|ver /i.test(t)).slice(0, 15);
      return { total: bs.length, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null, grupos, nClasses: Object.keys(exemplos).length, exemplos: Object.entries(exemplos).sort((a, b) => b[1] - a[1]).slice(0, 6), controles,
               linhasTabela: document.querySelectorAll("table tbody tr").length };
    });
    p("botões de lugar:", r.total, "· menor nº:", r.min, "· maior nº:", r.max, "· linhas da tabela:", r.linhasTabela);
    p("por cor:", JSON.stringify(r.grupos));
    p("classes distintas:", r.nClasses);
    r.exemplos.forEach(([k, n]) => p("  ", n, "×", k));
    p("controles que parecem paginação/filtro:", JSON.stringify(r.controles));
  } catch (e) { p("ERRO:", String(e.message).slice(0, 160)); process.exitCode = 1; }
  finally { await br.close(); }
})();
