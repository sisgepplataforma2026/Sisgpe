/**
 * EXCLUI NO TICKONE OS INGRESSOS PEDIDOS NO SISGEP (14/11/2026).
 * O usuário: "o cara não vai, quero excluir ... pesquiso no SISGEP o nome dele, vou em
 * exclusão e você faz toda a operação por trás". Exclusão NÃO tem volta, então:
 *  - só exclui o que está na FILA (exclusoes-fila.json, escrita pelo SISGEP depois da
 *    confirmação "não tem volta"); no máximo 5 por execução;
 *  - confere código E CPF da MESMA linha; se não houver exatamente 1 linha, não faz nada;
 *  - não exclui quem já passou na portaria (check-in);
 *  - só clica na lixeira daquela linha e no "Confirmar" do pop-up; depois recarrega e confere
 *    que a linha sumiu; qualquer coisa inesperada PARA a execução;
 *  - nunca clica em WhatsApp, e-mail, editar nem em outra linha;
 *  - nada pessoal no log: só o id do pedido e o resultado. O PDF do Drive NÃO é apagado.
 * Segredos: INGRESSOS_USUARIO, INGRESSOS_SENHA, CLASPRC_JSON. Para teste (sem Drive):
 * FILA_LOCAL e RESULTADO_LOCAL apontam para arquivos; INGRESSOS_URL aponta para um TickOne falso.
 */
const fs = require("fs");
const { chromium } = require("playwright");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const PASTA = "SISGEP — Ingressos (robô)", ARQ_FILA = "exclusoes-fila.json", ARQ_RES = "exclusoes-resultado.json", MAXIMO = 5;
const p = (...a) => console.log(...a);
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

/* As linhas da tabela de ingressos (cpf e código) e os check-ins, lidos na própria página. */
async function ler(pg) {
  return pg.evaluate(() => {
    const dg = s => String(s || "").replace(/\D/g, "");
    const tabs = [...document.querySelectorAll("table")];
    const t = tabs.find(x => /Cliente/.test(x.innerText) && /Código/.test(x.innerText));
    const c = tabs.find(x => /Check-in/.test(x.innerText));
    if (!t) return null;
    const cab = [...t.querySelectorAll("thead th, tr:first-child th")].map(h => (h.innerText || "").trim().toLowerCase());
    const iCpf = cab.indexOf("cpf"), iCod = cab.indexOf("código");
    const linhas = [...t.querySelectorAll("tbody tr")].map((tr, i) => { const td = [...tr.children].map(x => (x.innerText || "").trim()); return { i, cpf: dg(td[iCpf]), codigo: (td[iCod] || "").trim() }; });
    const checkins = c ? [...c.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(x => (x.innerText || "").trim())) : [];
    return { linhas, checkins: checkins.map(r => ({ cpf: dg(r[1]), ingresso: (r[2] || "").trim() })) };
  });
}

(async () => {
  const fila = await lerJson(ARQ_FILA, process.env.FILA_LOCAL);
  const itens = ((fila && fila.itens) || []).slice(0, MAXIMO);
  if (!itens.length) { p("Fila vazia: nada a excluir."); return; }
  if (!USUARIO || !SENHA) { p("Sem INGRESSOS_USUARIO/INGRESSOS_SENHA: nada feito."); return; }
  p("Pedidos na fila:", itens.length);
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const resultado = (await lerJson(ARQ_RES, process.env.RESULTADO_LOCAL)) || { itens: [] };
  const registrar = async (pedido, status, detalhe) => {
    resultado.itens = (resultado.itens || []).filter(r => r.pedido !== pedido).concat([{ pedido, status, detalhe, em: new Date().toISOString() }]);
    resultado.atualizadoEm = new Date().toISOString(); await gravarJson(ARQ_RES, resultado, process.env.RESULTADO_LOCAL);
    p("pedido", pedido, "→", status, detalhe ? "(" + detalhe + ")" : "");
  };
  try {
    await pg.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    const senha = await pg.$("input[name=password]");
    if (senha) {
      await (await pg.$("input[name=username]")).fill(USUARIO); await senha.fill(SENHA);
      const btn = (await senha.evaluateHandle(e => e.form && e.form.querySelector("button[type=submit]"))).asElement();
      await Promise.all([pg.waitForLoadState("domcontentloaded").catch(() => {}), btn.click()]); await pg.waitForTimeout(2500);
      if (await pg.$("input[name=password]")) { p("FALHA: o login não entrou. Nada foi excluído."); process.exitCode = 1; return; }
    }
    if (!/evt_id=/.test(pg.url())) { await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1500); }
    for (const it of itens) {
      const cpf = dig(it.cpf), cod = String(it.codigo || "").trim();
      if (!cpf || !cod) { await registrar(it.pedido, "FALHOU", "pedido sem código ou CPF"); continue; }
      const est = await ler(pg);
      if (!est) { await registrar(it.pedido, "FALHOU", "não achei a tabela de ingressos"); process.exitCode = 1; break; }
      const achadas = est.linhas.filter(l => l.codigo.toLowerCase() === cod.toLowerCase() && l.cpf === cpf);
      const mesmoCodigo = est.linhas.filter(l => l.codigo.toLowerCase() === cod.toLowerCase());
      if (!achadas.length) { await registrar(it.pedido, "FALHOU", mesmoCodigo.length ? "o código existe, mas com outro CPF: NÃO excluí" : "ingresso não encontrado (já excluído?)"); continue; }
      if (achadas.length > 1) { await registrar(it.pedido, "FALHOU", "mais de uma linha com o mesmo código e CPF: NÃO excluí"); continue; }
      if (est.checkins.some(c => (c.cpf && c.cpf === cpf) || (c.ingresso && c.ingresso.toLowerCase() === cod.toLowerCase()))) { await registrar(it.pedido, "JA_ENTROU", "já passou na portaria: não excluí"); continue; }
      const lixeira = await pg.evaluateHandle((i) => {
        const t = [...document.querySelectorAll("table")].find(x => /Cliente/.test(x.innerText) && /Código/.test(x.innerText));
        const tr = t && t.querySelectorAll("tbody tr")[i]; const bs = tr ? [...tr.querySelectorAll("button")].filter(b => /excluir/i.test(b.title || "")) : [];
        return bs.length === 1 ? bs[0] : null;
      }, achadas[0].i);
      const el = lixeira.asElement();
      if (!el) { await registrar(it.pedido, "FALHOU", "não achei a lixeira desta linha: NÃO excluí"); continue; }
      await el.click();
      const sim = await pg.waitForSelector("#custom-confirm-yes-btn", { state: "visible", timeout: 6000 }).catch(() => null);
      if (!sim) { await registrar(it.pedido, "FALHOU", "a confirmação do TickOne não apareceu: NÃO excluí"); process.exitCode = 1; break; }
      await sim.click(); await pg.waitForTimeout(3000);
      await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1500);
      const depois = await ler(pg);
      const aindaLa = depois && depois.linhas.some(l => l.codigo.toLowerCase() === cod.toLowerCase() && l.cpf === cpf);
      if (aindaLa) { await registrar(it.pedido, "FALHOU", "cliquei em excluir e confirmar, mas a linha continua na lista"); process.exitCode = 1; break; }
      await registrar(it.pedido, "EXCLUIDO", "conferido: a linha saiu da lista do TickOne");
    }
  } catch (e) { p("ERRO:", String(e.message).slice(0, 120), "— a execução parou."); process.exitCode = 1; }
  await br.close();
})();
