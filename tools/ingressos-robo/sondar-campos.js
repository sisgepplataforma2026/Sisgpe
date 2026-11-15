/**
 * SONDA SÓ DE LEITURA: como o pop-up de emissão reage a cada campo (15/11/2026).
 * A emissão real parou na conferência: com a categoria escolhida por último, o telefone ficou VAZIO; com a categoria
 * primeiro, o tipo voltava para "Pago" ao preencher o telefone. Aqui: preenche campos FICTÍCIOS e, depois de cada passo,
 * mede o TAMANHO de cada campo (nunca o conteúdo) e o valor do tipo. Lê também os manipuladores do telefone e do tipo.
 * NUNCA clica em Emitir/Salvar/Excluir/WhatsApp/e-mail; recarrega a página no fim.
 */
const { chromium } = require("playwright");
const { entrar } = require("./comum");
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const p = (...a) => console.log(...a);
const IDS = ["popup-buyer-nome", "popup-buyer-email", "popup-buyer-cpf", "popup-buyer-telefone", "popup-buyer-cidade", "popup-buyer-observacao"];
(async () => {
  if (!USUARIO || !SENHA) { p("Sem segredos: nada feito."); return; }
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const escritas = []; pg.on("request", r => { if (r.method() !== "GET") escritas.push(r.method() + " " + new URL(r.url()).pathname + new URL(r.url()).search.slice(0, 50)); });
  const abrir = async () => {
    await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => {});
    const ok = await pg.evaluate(() => { const b = [...document.querySelectorAll("button[onclick*='abrirPopUpAssentoAdmin']")].find(x => /text-emerald-400/.test(x.className || "") && !/rose-/.test(x.className || "")); if (!b) return false; b.scrollIntoView(); b.click(); return true; });
    await pg.waitForSelector("#popup-buyer-nome", { state: "visible", timeout: 6000 }).catch(() => null); return ok;
  };
  const medir = async (rot) => p("  " + rot.padEnd(34), await pg.evaluate((ids) => { const o = ["tipo=" + (document.getElementById("popup-tipo-ingresso") || {}).value]; ids.forEach(i => { const e = document.getElementById(i); o.push(i.replace("popup-buyer-", "") + ":" + (e ? (e.value || "").length : "?")); }); return o.join("  "); }, IDS));
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou."); process.exitCode = 1; return; }
    p("━━ A) ORDEM DO ROBÔ ATUAL: nome, e-mail, CPF, telefone, cidade, observação, e por último o tipo");
    if (!(await abrir())) { p("sem lugar livre"); return; }
    await medir("ao abrir");
    await pg.fill("#popup-buyer-nome", "Teste Sonda"); await medir("depois de preencher nome");
    await pg.fill("#popup-buyer-email", "sonda@exemplo.com"); await medir("depois de preencher e-mail");
    await pg.fill("#popup-buyer-cpf", "16899535009"); await medir("depois de preencher CPF");
    await pg.fill("#popup-buyer-telefone", "27999451089"); await medir("depois de preencher telefone");
    await pg.fill("#popup-buyer-cidade", "Cidade"); await medir("depois de preencher cidade");
    await pg.fill("#popup-buyer-observacao", "Escola"); await medir("depois de preencher observação");
    await pg.selectOption("#popup-tipo-ingresso", "associado"); await medir("depois de escolher o tipo (imediato)");
    await pg.waitForTimeout(1500); await medir("1,5 s depois");
    p("━━ B) TIPO PRIMEIRO, depois todos os campos, e o telefone por ÚLTIMO");
    if (!(await abrir())) return;
    await pg.selectOption("#popup-tipo-ingresso", "associado"); await medir("tipo escolhido primeiro");
    await pg.fill("#popup-buyer-nome", "Teste Sonda"); await pg.fill("#popup-buyer-email", "sonda@exemplo.com"); await pg.fill("#popup-buyer-cpf", "16899535009"); await pg.fill("#popup-buyer-cidade", "Cidade"); await pg.fill("#popup-buyer-observacao", "Escola");
    await medir("tudo, menos o telefone");
    await pg.fill("#popup-buyer-telefone", "27999451089"); await medir("depois do telefone (último)");
    await pg.waitForTimeout(1500); await medir("1,5 s depois");
    p("━━ C) TELEFONE DIGITADO TECLA A TECLA (pressSequentially) e tipo depois");
    if (!(await abrir())) return;
    await pg.click("#popup-buyer-telefone"); await pg.locator("#popup-buyer-telefone").pressSequentially("27999451089", { delay: 30 }); await medir("telefone digitado");
    await pg.selectOption("#popup-tipo-ingresso", "associado"); await medir("tipo depois do telefone");
    await pg.waitForTimeout(1500); await medir("1,5 s depois");
    p("━━ D) MANIPULADORES E CÓDIGO");
    const info = await pg.evaluate(() => {
      const at = (id) => { const e = document.getElementById(id); if (!e) return "(não existe)"; return ["oninput", "onchange", "onblur", "onkeyup", "onkeydown", "onfocus"].map(a => e.getAttribute(a) ? a + "=" + e.getAttribute(a).slice(0, 140) : "").filter(Boolean).join(" | ") || "(sem atributos on*)"; };
      const todas = [...document.scripts].map(s => s.textContent || "").join("\n");
      const trechos = (re, n) => { const o = []; let m; while ((m = re.exec(todas)) && o.length < n) o.push(todas.slice(Math.max(0, m.index - 140), m.index + 260).replace(/\s+/g, " ")); return o; };
      return { telefone: at("popup-buyer-telefone"), tipo: at("popup-tipo-ingresso"), nome: at("popup-buyer-nome"), cpf: at("popup-buyer-cpf"),
        refTel: trechos(/popup-buyer-telefone/g, 6), listeners: trechos(/addEventListener\(['"](?:input|change|blur)['"]/g, 6), atualizar: (typeof window.atualizarBotaoWhatsAppPopup === "function" ? String(window.atualizarBotaoWhatsAppPopup).replace(/\s+/g, " ").slice(0, 600) : "(não existe)") };
    });
    p("telefone:", info.telefone); p("tipo:", info.tipo); p("nome:", info.nome); p("cpf:", info.cpf);
    info.refTel.forEach((t, i) => p("REF telefone " + (i + 1) + ":", t.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "CPF")));
    info.listeners.forEach((t, i) => p("LISTENER " + (i + 1) + ":", t)); p("atualizarBotaoWhatsAppPopup:", info.atualizar);
  } catch (e) { p("erro:", String(e.message).slice(0, 200)); process.exitCode = 1; }
  p("pedidos de escrita feitos pela sonda (deve ser nenhum):", JSON.stringify(escritas.filter(x => !/login/i.test(x))));
  await br.close();
})();
