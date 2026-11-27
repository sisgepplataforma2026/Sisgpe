/**
 * TESTE DE PONTA A PONTA DA ÁREA DA PRESIDÊNCIA, NA PRODUÇÃO (27/11/2026). Roda no GitHub Actions (tem internet).
 * Abre a página como o presidente abriria — SEM login do Google — e conduz o fluxo na tela, como uma pessoa.
 * O link (k) vem do ambiente (PRES_K) e NUNCA é escrito no log. Nada pessoal no log: só estados.
 *   MODO=abrir    → só abre e confere (logo, saudação, botões). Não grava nada.
 *   MODO=emitir   → adiciona UMA pessoa de teste (nome claramente de teste), Conferir, Gerar, e espera "pronto" ou "falhou" (até 12 min).
 *   MODO=cancelar → cancela o ingresso de teste (o que tem o nome de teste e estado "pronto").
 */
const { chromium } = require("playwright");
const BASE = "https://script.google.com/macros/s/AKfycbzgPBSSF3D2OimoEJ-qMfDNp_Dsmc95THSNdUvFgqoX7NXWcmn7ZDMzF9L-OyUbEMw_ew/exec";
const K = String(process.env.PRES_K || "").trim(), MODO = String(process.env.MODO || "abrir");
const NOME_TESTE = "TESTE SISGEP APAGAR PRESIDENCIA";
const p = (...a) => console.log(...a);
if (!/^[0-9a-f]{64}$/.test(K)) { p("FALHA: o link (k) não veio ou não tem 64 caracteres."); process.exit(1); }

(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const pg = await ctx.newPage();
  const erros = []; pg.on("pageerror", e => erros.push(String(e.message).slice(0, 120)));
  try {
    await pg.goto(BASE + "?page=presidencia&k=" + K, { waitUntil: "domcontentloaded", timeout: 60000 });
    // a página roda num iframe dentro de outro: procura o quadro que tem o botão
    let fr = null;
    for (let i = 0; i < 40 && !fr; i++) {
      for (const f of pg.frames()) { try { if (await f.$("#bAdd")) { fr = f; break; } } catch (e) {} }
      if (!fr) await pg.waitForTimeout(1000);
    }
    if (!fr) {
      const txt = (await Promise.all(pg.frames().map(async f => { try { return await f.evaluate(() => document.body.innerText.slice(0, 160)); } catch (e) { return ""; } }))).join(" | ").replace(/\s+/g, " ");
      p("FALHA: a página da Presidência não abriu. Texto visto:", txt.slice(0, 200)); await pg.screenshot({ path: "/tmp/pres-falha.png" }).catch(() => {}); process.exitCode = 1; return;
    }
    await pg.waitForTimeout(1500);
    const ola = await fr.evaluate(() => document.getElementById("oi").textContent.trim());
    const logo = await fr.evaluate(() => { const f = document.getElementById("faixaLogo"); return !!f && /ok/.test(f.className); });
    p("ABRIU. Saudação:", ola, "· logo:", logo ? "sim" : "não", "· totais escondidos:", await fr.evaluate(() => !document.getElementById("kEmit")));
    await pg.screenshot({ path: "/tmp/pres-inicio.png" });
    if (MODO === "abrir") return;

    if (MODO === "emitir") {
      await fr.click("#bAdd"); await fr.fill("#aNome", NOME_TESTE); await fr.click("#aAdd");
      p("na lista:", await fr.evaluate(() => document.getElementById("aQtd").textContent));
      await fr.click("#aConf"); await fr.waitForSelector("#tConf.on", { timeout: 30000 });
      p("conferência:", await fr.evaluate(() => document.getElementById("cTit").textContent.trim()), "·", await fr.evaluate(() => document.getElementById("cGerar").textContent.trim()));
      await fr.click("#cGerar"); await fr.waitForSelector("#ov.on", { timeout: 10000 }); await fr.click("#ovSim");
      await fr.waitForSelector("#tMeus.on", { timeout: 60000 });
      p("pedido enviado; acompanhando em Meus ingressos…");
      const t0 = Date.now(); let estado = "";
      while (Date.now() - t0 < 12 * 60 * 1000) {
        await pg.waitForTimeout(20000);
        await fr.evaluate(() => { document.querySelector('.nav [data-t="tInicio"]').click(); document.querySelector('.nav [data-t="tMeus"]').click(); });
        await pg.waitForTimeout(6000);
        estado = await fr.evaluate((n) => { const l = [...document.querySelectorAll("#mLista > div")].find(d => d.textContent.indexOf(n) >= 0); return l ? (l.querySelector(".tag") || {}).textContent || "" : "(sem linha)"; }, NOME_TESTE);
        p(Math.round((Date.now() - t0) / 1000) + "s · estado:", estado);
        if (/pronto|falhou/.test(estado)) break;
      }
      const det = await fr.evaluate((n) => { const l = [...document.querySelectorAll("#mLista > div")].find(d => d.textContent.indexOf(n) >= 0); return l ? l.textContent.replace(/\s+/g, " ").slice(0, 200).replace(n, "[nome de teste]") : ""; }, NOME_TESTE);
      p("RESULTADO:", estado, "·", det);
      await pg.screenshot({ path: "/tmp/pres-meus.png" });
      if (!/pronto/.test(estado)) process.exitCode = 1;
    }

    if (MODO === "cancelar") {
      await fr.click("#bMeus"); await pg.waitForTimeout(8000);
      const achou = await fr.evaluate((n) => { const l = [...document.querySelectorAll("#mLista > div")].find(d => d.textContent.indexOf(n) >= 0 && d.querySelector('[data-a="cancela"]')); if (!l) return false; l.querySelector('[data-a="cancela"]').click(); return true; }, NOME_TESTE);
      if (!achou) { p("FALHA: não achei o ingresso de teste pronto para cancelar."); process.exitCode = 1; return; }
      await fr.waitForSelector("#ov.on", { timeout: 10000 }); await fr.click("#ovSim"); await pg.waitForTimeout(6000);
      p("cancelamento pedido. Estado na lista:", await fr.evaluate((n) => { const l = [...document.querySelectorAll("#mLista > div")].find(d => d.textContent.indexOf(n) >= 0); return l ? (l.querySelector(".tag") || {}).textContent : "(sem linha)"; }, NOME_TESTE));
    }
  } catch (e) { p("ERRO:", String(e.message).slice(0, 200)); process.exitCode = 1; }
  finally { if (erros.length) p("erros de JavaScript na página:", erros.slice(0, 3).join(" | ")); await br.close(); }
})();
