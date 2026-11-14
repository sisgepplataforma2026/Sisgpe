/**
 * RECONHECIMENTO DO SITE DE INGRESSOS (13/11/2026) — só estrutura, nenhum dado pessoal.
 *
 * O usuário: os ingressos da festa são emitidos por https://ingressos.sindeducacao.com.br
 * (painel "Relatório de Vendas e Emissão de Ingressos": Cliente, CPF, Telefone, Código,
 * Tipo, Escola, Cidade; ações: WhatsApp, e-mail, editar, PDF, excluir; botões PDF e CSV).
 * "Reemitir não muda o código, só baixa o PDF". Ideia dele: o robô entra, baixa os
 * ingressos e prepara o envio pelo WhatsApp.
 *
 * ESTA RODADA SÓ OLHA: entra, descreve como a página é montada e testa UM download de
 * PDF e a exportação CSV, sem salvar nada. O registro mostra nomes de colunas, tipos de
 * botão e o formato dos endereços — com CPF, telefone, e-mail, código de ingresso e
 * valores de endereço MASCARADOS. NÃO CLICA em e-mail, editar nem excluir.
 *
 * Usuário e senha vêm dos segredos do GitHub (INGRESSOS_USUARIO / INGRESSOS_SENHA);
 * nunca são impressos. Sem eles, o robô sai sem fazer nada.
 */
const { chromium } = require("playwright");

const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO_BRUTO = process.env.INGRESSOS_USUARIO || "", SENHA_BRUTA = process.env.INGRESSOS_SENHA || "";
const USUARIO = USUARIO_BRUTO.trim(), SENHA = SENHA_BRUTA.trim();

/* Tudo que for impresso passa por aqui. */
function mascarar(t) {
  return String(t == null ? "" : t)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "<CPF>")
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "<TEL>")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<EMAIL>")
    .replace(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, "XXXX-XXXX")
    .replace(/([?&][\w\[\]%-]+=)[^&#\s'")]*/g, "$1<v>")
    .replace(/\b\d{5,}\b/g, "<n>");
}
const p = (...a) => console.log(...a.map(x => (typeof x === "string" ? x : JSON.stringify(x))));

(async () => {
  if (!USUARIO || !SENHA) { console.log("Sem os segredos INGRESSOS_USUARIO/INGRESSOS_SENHA: nada a fazer."); return; }
  const br = await chromium.launch();
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const pedidos = [];
  pg.on("response", r => { try { const u = new URL(r.url()); if (u.hostname.endsWith("sindeducacao.com.br")) pedidos.push(r.request().method() + " " + u.pathname + (u.search ? "?" + mascarar(u.search.slice(1)) : "") + " → " + r.status() + " " + (r.headers()["content-type"] || "").split(";")[0]); } catch (e) {} });

  p("━━ 1. ABRIR O ENDEREÇO DO PAINEL");
  let resp;
  try { resp = await pg.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 }); }
  catch (e) { p("NÃO ABRIU:", mascarar(e.message).slice(0, 200)); await br.close(); return; }
  p("status:", resp && resp.status(), "· caminho:", mascarar(new URL(pg.url()).pathname + new URL(pg.url()).search), "· título:", mascarar(await pg.title()));

  p("━━ 2. A TELA DE ENTRADA");
  const campos = await pg.$$eval("input,select,textarea,button", els => els.filter(e => e.offsetParent !== null).map(e => ({ tag: e.tagName.toLowerCase(), type: e.type || "", name: e.name || "", id: e.id || "", ph: e.placeholder || "", txt: (e.innerText || e.value || "").trim().slice(0, 30) })));
  p("campos visíveis:", campos.map(c => ({ ...c, ph: mascarar(c.ph) })));
  const html = (await pg.content()).toLowerCase();
  p("verificação extra? recaptcha:", /recaptcha/.test(html), "· hcaptcha:", /hcaptcha/.test(html), "· código por sms/e-mail:", /c[oó]digo de (verifica|confirma|acesso)|2fa|autentica[cç][aã]o em dois/.test(html));

  p("tamanho dos Secrets (só o número de caracteres): usuário", USUARIO_BRUTO.length, "→", USUARIO.length, "depois de tirar espaço/quebra de linha · senha", SENHA_BRUTA.length, "→", SENHA.length);
  const senha = await pg.$("input[name=password]") || await pg.$("input[type=password]");
  if (!senha) { p("Não achei campo de senha — talvez já esteja dentro, ou a tela é diferente. Seguindo."); }
  else {
    const user = await pg.$("input[name=username]") || await pg.$("input[type=email], input[name*=user i], input[name*=login i], input[name*=email i]");
    if (user) await user.fill(USUARIO);
    await senha.fill(SENHA);
    const btn = await senha.evaluateHandle(e => e.form && e.form.querySelector("button[type=submit], input[type=submit]"));
    const el = btn && btn.asElement();
    await Promise.all([pg.waitForLoadState("domcontentloaded").catch(() => {}), el ? el.click() : senha.press("Enter")]);
    await pg.waitForTimeout(3500);
    p("depois de entrar → caminho:", mascarar(new URL(pg.url()).pathname + new URL(pg.url()).search), "· título:", mascarar(await pg.title()));
    if (await pg.$("input[name=password]")) {
      const aviso = await pg.$$eval("[role=alert], .alert, .erro, .error, .text-red-500, .text-red-600, .toast, [class*=erro], [class*=error]", els => els.filter(e => e.offsetParent !== null).map(e => (e.innerText || "").trim().slice(0, 120)).filter(Boolean).slice(0, 4)).catch(() => []);
      p("AINDA NA TELA DE SENHA: o login não entrou. Aviso na tela:", aviso.map(mascarar));
      await br.close(); return;
    }
  }
  if (!/page=admin/.test(pg.url())) { await pg.goto(BASE, { waitUntil: "domcontentloaded" }).catch(() => {}); await pg.waitForTimeout(2000); }

  p("━━ 3. O RELATÓRIO");
  p("título da página:", mascarar(await pg.title()), "· cabeçalhos h1-h3:", (await pg.$$eval("h1,h2,h3", e => e.map(x => x.innerText.trim()).slice(0, 5))).map(mascarar));
  const tabelas = await pg.$$eval("table", ts => ts.map(t => ({ colunas: [...t.querySelectorAll("thead th, tr:first-child th")].map(h => h.innerText.trim()), linhas: t.querySelectorAll("tbody tr").length })));
  p("tabelas:", tabelas);
  const topo = await pg.$$eval("button,a,select,input[type=search],input[type=text]", els => els.filter(e => e.offsetParent !== null && !e.closest("tbody")).map(e => ({ tag: e.tagName.toLowerCase(), txt: (e.innerText || e.value || e.placeholder || "").trim().slice(0, 25), href: e.getAttribute("href") || "", onclick: (e.getAttribute("onclick") || "").slice(0, 80), id: e.id || "", cls: (e.className || "").toString().slice(0, 40) })).slice(0, 25));
  p("controles do topo:", topo.map(t => ({ ...t, href: mascarar(t.href), onclick: mascarar(t.onclick) })));

  p("━━ 4. AS AÇÕES DE UMA LINHA (sem ler os dados dela)");
  const linha = await pg.$("table tbody tr");
  if (!linha) { p("nenhuma linha de dados achada"); }
  else {
    const acoes = await linha.$$eval("a,button", els => els.map(e => ({ tag: e.tagName.toLowerCase(), title: e.title || e.getAttribute("aria-label") || "", cls: (e.className || "").toString().slice(0, 50), icone: (e.querySelector("i,svg,img") ? (e.querySelector("i,svg,img").className.baseVal || e.querySelector("i,svg,img").className || e.querySelector("img").src || "") : "").toString().slice(0, 40), href: e.getAttribute("href") || "", onclick: (e.getAttribute("onclick") || "").slice(0, 120), dados: [...e.attributes].filter(a => /^data-/.test(a.name)).map(a => a.name + "=" + a.value.slice(0, 30)) })));
    p("ações:", acoes.map(a => ({ ...a, href: mascarar(a.href), onclick: mascarar(a.onclick), dados: a.dados.map(mascarar) })));

    p("━━ 5. TESTE DE UM PDF (não é salvo; só o tamanho e o tipo)");
    const idx = acoes.findIndex(a => /pdf|ingresso|ticket|download|baixar|emitir/i.test(a.title + a.icone + a.cls + a.href + a.onclick));
    if (idx < 0) p("não identifiquei o botão do PDF pelo nome — veja a lista de ações acima");
    else {
      const el = (await linha.$$("a,button"))[idx];
      const antes = pedidos.length;
      try {
        const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 20000 }), el.click()]);
        const caminho = await dl.path(); const fs = require("fs");
        p("DOWNLOAD:", "nome:", mascarar(dl.suggestedFilename()), "· tamanho:", fs.statSync(caminho).size, "bytes · começa com %PDF:", fs.readFileSync(caminho).slice(0, 4).toString() === "%PDF");
      } catch (e) { p("sem download direto (", mascarar(e.message).slice(0, 80), ") — olhando as abas e os pedidos"); }
      p("pedidos feitos pelo clique:", pedidos.slice(antes).slice(0, 8));
      for (const a of ctx.pages()) if (a !== pg) p("abriu outra aba:", mascarar(new URL(a.url()).pathname + new URL(a.url()).search));
    }
  }

  p("━━ 6. A EXPORTAÇÃO CSV (só o cabeçalho)");
  try {
    const csv = await pg.$("button:has-text('CSV'), a:has-text('CSV')");
    if (!csv) p("não achei o botão CSV");
    else {
      const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 25000 }), csv.click()]);
      const txt = require("fs").readFileSync(await dl.path(), "utf8").replace(/^﻿/, "");
      const ls = txt.split(/\r?\n/).filter(Boolean);
      p("CSV:", "arquivo:", mascarar(dl.suggestedFilename()), "· linhas (com cabeçalho):", ls.length, "· separador:", JSON.stringify((ls[0].match(/[;,\t]/) || [""])[0]), "· CABEÇALHO:", mascarar(ls[0]));
    }
  } catch (e) { p("CSV não baixou:", mascarar(e.message).slice(0, 120)); }

  p("━━ PEDIDOS DE REDE (resumo)");
  p([...new Set(pedidos.filter(x => !/\.(css|js|png|jpg|svg|woff2?|ico)/.test(x)))].slice(0, 25));
  await br.close();
})().catch(e => { console.log("ERRO:", String(e && e.message).slice(0, 200)); process.exit(0); });
