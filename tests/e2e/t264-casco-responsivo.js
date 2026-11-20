/**
 * CASCO RESPONSIVO: O PORTAL SE ADAPTA AO CELULAR E AO COMPUTADOR (14/11/2026).
 * Usuário: "se eu abro o link pelo celular, ela tem que se adaptar à tela do celular. Se eu abro o
 * computador, da mesma forma, e com todas as funções funcionando".
 * Antes: o menu lateral (240–260px fixos) comia o celular e o conteúdo ficava numa faixa de ~150px.
 * Agora, até 900px, o menu é uma GAVETA (☰). Este teste renderiza o index.html REAL (templates
 * resolvidos) no Chromium em 390px (celular) e 1366px (computador), com o servidor falso.
 * NÃO PROVA: o Apps Script de verdade (o viewport vem do Code.gs, travado no t263), nem iPhone/Android
 * reais; é o Chromium emulando o tamanho e o toque.
 */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const b = require("./base");
const RAIZ = path.join(__dirname, "..", "..");

function ler(n) { try { return fs.readFileSync(path.join(RAIZ, n + ".html"), "utf8"); } catch (e) { return "<!-- falta " + n + " -->"; } }
function avaliar(html, nivel) {
  if (nivel > 8) return "";
  html = html.replace(/<\?!=\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g, (_, n) => avaliar(ler(n), nivel + 1));
  html = html.replace(/<\?=\s*([\s\S]*?)\?>/g, (_, ex) => /token/i.test(ex) ? "tok" : "");
  return html.replace(/<\?[\s\S]*?\?>/g, "");
}

b.fluxo("CASCO RESPONSIVO · estático");
b.passo("1. O casco tem a gaveta e o botão ☰");
const idx = ler("index");
b.ok(/id="spHamb"/.test(idx) && /id="spOverlay"/.test(idx), "index.html tem o botão ☰ (#spHamb) e o fundo da gaveta (#spOverlay)");
b.ok(/@media\(max-width:900px\)\{[\s\S]*?#spSidebar\{position:fixed/.test(idx), "até 900px o menu lateral vira gaveta (position:fixed, fora da tela)");
b.ok(/#spHamb,#spOverlay\{display:none;\}/.test(idx), "no computador o ☰ e o fundo ficam escondidos");

(async function () {
  const raizGlobal = (() => { try { return cp.execSync("npm root -g", { encoding: "utf8" }).trim(); } catch (e) { return ""; } })();
  let chromium;
  try { chromium = require(require.resolve("playwright", { paths: [process.env.NODE_PATH || "", raizGlobal].filter(Boolean).join(path.delimiter).split(path.delimiter) })).chromium; }
  catch (e) { b.naoTestavel("o casco no navegador", "playwright/Chromium não disponível aqui — rode onde houver"); b.resumo(); return; }

  const stub = `<script>var SISGEP_TOKEN_SESSAO='tok';window.google={script:{run:(function(){function mk(ok,f){var o={withSuccessHandler:function(x){return mk(x,f)},withFailureHandler:function(x){return mk(ok,x)}};return new Proxy(o,{get:function(t,k){if(k in t)return t[k];return function(){setTimeout(function(){try{ok&&ok({ok:false,mensagem:'(sem servidor)'})}catch(e){}},20)}}})}return mk(null,null)})()}};</script>`;
  const html = avaliar(idx, 0).replace(/<head[^>]*>/i, m => m + stub);
  const arq = path.join(require("os").tmpdir(), "t264-portal.html"); fs.writeFileSync(arq, html);
  const br = await chromium.launch();

  b.fluxo("CASCO RESPONSIVO · celular (390px)");
  let ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let p = await ctx.newPage(); await p.goto("file://" + arq); await p.waitForTimeout(1500);
  const m = await p.evaluate(() => { const sb = document.getElementById("spSidebar").getBoundingClientRect(), h = document.getElementById("spHamb");
    return { larg: document.documentElement.scrollWidth, janela: window.innerWidth, sbDireita: Math.round(sb.right), hambVisivel: !!h && getComputedStyle(h).display !== "none", conteudoX: Math.round(document.getElementById("spMain").getBoundingClientRect().x), conteudoW: Math.round(document.getElementById("spMain").getBoundingClientRect().width) }; });
  b.ok(m.larg <= m.janela, "a página não rola para o lado (largura " + m.larg + " ≤ " + m.janela + ")");
  b.ok(m.sbDireita <= 0, "o menu lateral está FORA da tela (gaveta fechada)", "borda direita " + m.sbDireita);
  b.ok(m.conteudoX === 0 && m.conteudoW >= 380, "o conteúdo usa a largura toda do celular", m.conteudoW + "px");
  b.ok(m.hambVisivel, "o botão ☰ aparece");
  await p.tap("#spHamb"); await p.waitForTimeout(350);
  let aberta = await p.evaluate(() => ({ cls: document.getElementById("spApp").classList.contains("sp-menu-aberto"), x: Math.round(document.getElementById("spSidebar").getBoundingClientRect().x) }));
  b.ok(aberta.cls && aberta.x >= 0, "tocar no ☰ abre a gaveta");
  await p.evaluate(() => { const ac = document.querySelector(".spN[data-acordeao]"); if (ac) ac.click(); }); await p.waitForTimeout(300);
  b.ok(await p.evaluate(() => document.getElementById("spApp").classList.contains("sp-menu-aberto")), "expandir um módulo (acordeão) NÃO fecha a gaveta — dá tempo de escolher o submódulo");
  await p.evaluate(() => { document.querySelector('.spN[data-mod="inicio"]').click(); }); await p.waitForTimeout(400);
  b.ok(await p.evaluate(() => !document.getElementById("spApp").classList.contains("sp-menu-aberto")), "escolher uma tela fecha a gaveta");
  await p.tap("#spHamb"); await p.waitForTimeout(300); await p.tap("#spOverlay", { position: { x: 370, y: 500 } }); await p.waitForTimeout(350);
  b.ok(await p.evaluate(() => !document.getElementById("spApp").classList.contains("sp-menu-aberto")), "tocar no fundo escuro fecha a gaveta");
  await p.tap("#spHamb"); await p.waitForTimeout(250); await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  b.ok(await p.evaluate(() => !document.getElementById("spApp").classList.contains("sp-menu-aberto")), "Esc também fecha");
  /* nenhum módulo estoura a largura do celular (a página não ganha rolagem lateral) */
  const mods = await p.evaluate(() => [...document.querySelectorAll(".spN[data-mod]")].map(e => e.getAttribute("data-mod")));
  const largos = [];
  for (const mod of mods) { await p.evaluate(x => { try { spIr(x); } catch (e) {} }, mod); await p.waitForTimeout(350); const l = await p.evaluate(() => document.documentElement.scrollWidth); if (l > 392) largos.push(mod + ":" + l); }
  b.ok(largos.length === 0, "nenhum dos " + mods.length + " módulos do menu gera rolagem lateral na página", largos.join(", "));
  await ctx.close();

  b.fluxo("CASCO RESPONSIVO · computador (1366px)");
  ctx = await br.newContext({ viewport: { width: 1366, height: 768 } });
  p = await ctx.newPage(); await p.goto("file://" + arq); await p.waitForTimeout(1500);
  const d = await p.evaluate(() => { const sb = document.getElementById("spSidebar").getBoundingClientRect(), h = document.getElementById("spHamb");
    return { sbX: Math.round(sb.x), sbW: Math.round(sb.width), hamb: getComputedStyle(h).display, overlay: getComputedStyle(document.getElementById("spOverlay")).display, larg: document.documentElement.scrollWidth, janela: window.innerWidth, recolher: !!document.getElementById("spMenuToggle") && getComputedStyle(document.querySelector(".spMenuBarra")).display !== "none" }; });
  b.ok(d.sbX === 0 && d.sbW >= 240, "o menu lateral fica visível à esquerda, como sempre", d.sbW + "px");
  b.ok(d.hamb === "none" && d.overlay === "none", "o ☰ e o fundo da gaveta não aparecem");
  b.ok(d.recolher, "o botão 'Recolher' do computador continua lá");
  b.ok(d.larg <= d.janela, "sem rolagem lateral");
  await ctx.close(); await br.close(); fs.unlinkSync(arq);
  b.resumo();
})();
