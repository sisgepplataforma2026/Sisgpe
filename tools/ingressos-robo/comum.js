/**
 * PEÇAS COMUNS DOS ROBÔS DE INGRESSOS (14/11/2026): Drive (pasta privada), arquivos JSON de
 * fila/resultado e leitura da tabela do TickOne. Usado por excluir.js e emitir.js.
 * Para teste (sem Drive): o chamador passa um arquivo local.
 */
const fs = require("fs");
const PASTA = "SISGEP — Ingressos (robô)";
const dig = s => String(s || "").replace(/\D/g, "");

async function tokenGoogle() {
  const rc = JSON.parse(process.env.CLASPRC_JSON || "{}"); const toks = rc.tokens || {}; const t = toks.default || Object.values(toks)[0] || rc.token || {};
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id || "", client_secret: t.client_secret || "", refresh_token: t.refresh_token || "", grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) throw new Error("token Google: " + (j.error || r.status)); return j.access_token;
}
async function drive(tk, metodo, url, corpo, tipo, bruto) {
  const r = await fetch(url, { method: metodo, headers: { Authorization: "Bearer " + tk, ...(tipo ? { "Content-Type": tipo } : {}) }, body: corpo });
  const txt = await r.text(); if (!r.ok) throw new Error("Drive " + r.status); return bruto ? txt : (txt ? JSON.parse(txt) : {});
}
const q = s => encodeURIComponent(s);
async function pastaId(tk) {
  const f = (await drive(tk, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q(`name = '${PASTA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`) + "&fields=files(id)")).files[0];
  if (!f) throw new Error("pasta do robô não existe no Drive"); return f.id;
}
async function arquivoId(tk, pid, nome) {
  return ((await drive(tk, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q(`name = '${nome}' and '${pid}' in parents and trashed = false`) + "&fields=files(id)")).files[0] || {}).id;
}
async function lerJson(nome, local) {
  if (local) return fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, "utf8")) : null;
  const tk = await tokenGoogle(), id = await arquivoId(tk, await pastaId(tk), nome);
  return id ? JSON.parse(await drive(tk, "GET", "https://www.googleapis.com/drive/v3/files/" + id + "?alt=media", null, null, true)) : null;
}
async function gravarJson(nome, obj, local) {
  const texto = JSON.stringify(obj);
  if (local) { fs.writeFileSync(local, texto); return; }
  const tk = await tokenGoogle(), pid = await pastaId(tk), id = await arquivoId(tk, pid, nome);
  if (id) { await drive(tk, "PATCH", "https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=media", texto, "application/json"); return; }
  const lim = "x" + Date.now();
  await drive(tk, "POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    `--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pid], mimeType: "application/json" })}\r\n--${lim}\r\nContent-Type: application/json\r\n\r\n${texto}\r\n--${lim}--`,
    "multipart/related; boundary=" + lim);
}

/** Entra no TickOne com o login dos Secrets. Devolve true se entrou. */
async function entrar(pg, base, usuario, senha) {
  await pg.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
  const campo = await pg.$("input[name=password]");
  if (campo) {
    await (await pg.$("input[name=username]")).fill(usuario); await campo.fill(senha);
    const btn = (await campo.evaluateHandle(e => e.form && e.form.querySelector("button[type=submit]"))).asElement();
    await Promise.all([pg.waitForLoadState("domcontentloaded").catch(() => {}), btn.click()]); await pg.waitForTimeout(2500);
    if (await pg.$("input[name=password]")) return false;
  }
  if (!/evt_id=/.test(pg.url())) { await pg.goto(base, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1500); }
  return true;
}

/* As linhas da tabela de ingressos (cpf, código, ref) e os check-ins, lidos na própria página. */
async function ler(pg) {
  return pg.evaluate(() => {
    const dg = s => String(s || "").replace(/\D/g, "");
    const tabs = [...document.querySelectorAll("table")];
    const t = tabs.find(x => /Cliente/.test(x.innerText) && /Código/.test(x.innerText));
    const c = tabs.find(x => /Check-in/.test(x.innerText));
    if (!t) return null;
    const cab = [...t.querySelectorAll("thead th, tr:first-child th")].map(h => (h.innerText || "").trim().toLowerCase());
    const iCpf = cab.indexOf("cpf"), iCod = cab.indexOf("código");
    const linhas = [...t.querySelectorAll("tbody tr")].map((tr, i) => { const td = [...tr.children].map(x => (x.innerText || "").trim()); const rm = tr.querySelector("a[href*='page=ticket']"); let ref = ""; try { ref = rm ? new URL(rm.href, location.href).searchParams.get("ref") || "" : ""; } catch (e) {} return { i, cpf: dg(td[iCpf]), codigo: (td[iCod] || "").trim(), ref }; });
    const checkins = c ? [...c.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(x => (x.innerText || "").trim())) : [];
    return { linhas, checkins: checkins.map(r => ({ cpf: dg(r[1]), ingresso: (r[2] || "").trim() })) };
  });
}


module.exports = { fs, dig, lerJson, gravarJson, entrar, ler };
