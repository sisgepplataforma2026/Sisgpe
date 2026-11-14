/**
 * LÊ A BASE DE INGRESSOS DO TICKONE E ENTREGA AO SISGEP (14/11/2026).
 * O usuário: "se a pessoa está na base do ingresso, se já foi feito" e "quando for
 * solicitar, sempre pesquisar antes". Este robô SÓ LÊ: entra com o login dos Secrets,
 * copia a tabela do evento (nome, CPF, telefone, código, tipo, escola, cidade, ref,
 * quantos envios de WhatsApp) e grava um arquivo JSON numa pasta PRIVADA do Drive da
 * conta do Financeiro (a mesma onde o SISGEP roda). NADA pessoal vai para o log: só
 * contagens. Não clica em WhatsApp, e-mail, editar, excluir nem em Reemitir.
 * Segredos: INGRESSOS_USUARIO, INGRESSOS_SENHA, CLASPRC_JSON (o mesmo da KingHost).
 */
const { chromium } = require("playwright");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const PASTA = "SISGEP — Ingressos (robô)", ARQUIVO = "ingressos-base.json";
const p = (...a) => console.log(...a);

async function tokenGoogle() {
  const rc = JSON.parse(process.env.CLASPRC_JSON || "{}");
  const toks = rc.tokens || {}; const t = toks.default || Object.values(toks)[0] || rc.token || {};
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id || "", client_secret: t.client_secret || "", refresh_token: t.refresh_token || "", grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) throw new Error("token Google: " + (j.error || r.status)); return j.access_token;
}
async function drive(tk, metodo, url, corpo, tipo) {
  const r = await fetch(url, { method: metodo, headers: { Authorization: "Bearer " + tk, ...(tipo ? { "Content-Type": tipo } : {}) }, body: corpo });
  const txt = await r.text(); if (!r.ok) throw new Error("Drive " + r.status + " " + txt.slice(0, 120)); return txt ? JSON.parse(txt) : {};
}
async function gravar(tk, texto) {
  const q = (s) => encodeURIComponent(s);
  let pasta = (await drive(tk, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q(`name = '${PASTA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`) + "&fields=files(id)")).files[0];
  if (!pasta) pasta = await drive(tk, "POST", "https://www.googleapis.com/drive/v3/files", JSON.stringify({ name: PASTA, mimeType: "application/vnd.google-apps.folder" }), "application/json");
  const ex = (await drive(tk, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q(`name = '${ARQUIVO}' and '${pasta.id}' in parents and trashed = false`) + "&fields=files(id)")).files[0];
  if (ex) { await drive(tk, "PATCH", "https://www.googleapis.com/upload/drive/v3/files/" + ex.id + "?uploadType=media", texto, "application/json"); return ex.id; }
  const lim = "x" + Date.now();
  const meta = JSON.stringify({ name: ARQUIVO, parents: [pasta.id], mimeType: "application/json" });
  const corpo = `--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${lim}\r\nContent-Type: application/json\r\n\r\n${texto}\r\n--${lim}--`;
  return (await drive(tk, "POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", corpo, "multipart/related; boundary=" + lim)).id;
}

(async () => {
  if (!USUARIO || !SENHA) { p("Sem INGRESSOS_USUARIO/INGRESSOS_SENHA: nada a fazer."); return; }
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  const senha = await pg.$("input[name=password]");
  if (senha) {
    await (await pg.$("input[name=username]")).fill(USUARIO); await senha.fill(SENHA);
    const btn = (await senha.evaluateHandle(e => e.form && e.form.querySelector("button[type=submit]"))).asElement();
    await Promise.all([pg.waitForLoadState("domcontentloaded").catch(() => {}), btn.click()]); await pg.waitForTimeout(3500);
    if (await pg.$("input[name=password]")) { p("FALHA: o login não entrou."); process.exitCode = 1; await br.close(); return; }
  }
  if (!/page=admin/.test(pg.url()) || !/evt_id=/.test(pg.url())) { await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(2000); }
  const linhas = await pg.evaluate(() => {
    const t = [...document.querySelectorAll("table")].find(x => /Cliente/.test(x.innerText) && /Código/.test(x.innerText));
    if (!t) return null;
    const cab = [...t.querySelectorAll("thead th, tr:first-child th")].map(h => (h.innerText || "").trim());
    const ix = n => cab.findIndex(c => c.toLowerCase() === n);
    const col = { nome: ix("cliente"), cpf: ix("cpf"), tel: ix("telefone"), codigo: ix("código"), tipo: ix("tipo"), escola: ix("escola"), cidade: ix("cidade") };
    return [...t.querySelectorAll("tbody tr")].map(tr => {
      const td = [...tr.children].map(c => (c.innerText || "").trim());
      const rm = tr.querySelector("a[href*='page=ticket']"); const zap = tr.querySelector("button[title*='WhatsApp']");
      const ref = rm ? (new URL(rm.href, location.href).searchParams.get("ref") || "") : "";
      const env = zap ? ((zap.title.match(/enviado (\d+)x/) || [])[1] || "0") : "0";
      const g = k => (col[k] >= 0 ? td[col[k]] || "" : "");
      return { nome: g("nome"), cpf: g("cpf"), tel: g("tel"), codigo: g("codigo"), tipo: g("tipo"), escola: g("escola"), cidade: g("cidade"), ref, zap: Number(env) };
    }).filter(l => l.nome || l.cpf);
  });
  await br.close();
  if (!linhas) { p("FALHA: não achei a tabela de ingressos."); process.exitCode = 1; return; }
  const porTipo = {}; linhas.forEach(l => { porTipo[l.tipo] = (porTipo[l.tipo] || 0) + 1; });
  const doc = { lidoEm: new Date().toISOString(), evento: "No Compasso da Vida", total: linhas.length, linhas };
  if (process.env.BASE_LOCAL) { require("fs").writeFileSync(process.env.BASE_LOCAL, JSON.stringify(doc)); p("OK: lidas", linhas.length, "linhas (saída local de teste)"); return; }
  const id = await gravar(await tokenGoogle(), JSON.stringify(doc));
  p("OK: lidas", linhas.length, "linhas · por tipo:", porTipo, "· com ref:", linhas.filter(l => l.ref).length, "· arquivo no Drive gravado (id", id.slice(0, 6) + "…)");
})().catch(e => { p("ERRO:", String(e.message).replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "<CPF>").slice(0, 160)); process.exitCode = 1; });
