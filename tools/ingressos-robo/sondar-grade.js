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
    /* 2) O BOTÃO NOVO "Emitir ingresso" (emitirNovoIngressoAdmin): abre o formulário SEM escolher lugar? Só abre e mede; NUNCA clica em "Emitir Ingresso" do formulário. */
    const clicou = await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /emitirNovoIngressoAdmin/.test(x.getAttribute("onclick") || "")); if (!b) return false; b.click(); return true; });
    p("botão 'Emitir ingresso' encontrado e clicado:", clicou);
    await pg.waitForTimeout(2500);
    const pop = await pg.evaluate(() => {
      const vis = e => e && e.offsetParent !== null;
      const campos = ["popup-tipo-ingresso", "popup-buyer-nome", "popup-buyer-email", "popup-buyer-cpf", "popup-buyer-telefone", "popup-buyer-cidade", "popup-buyer-observacao"].map(i => i + ":" + (vis(document.getElementById(i)) ? "visível" : (document.getElementById(i) ? "oculto" : "ausente")));
      const botoes = [...document.querySelectorAll("button")].filter(vis).map(b => (b.innerText || "").trim()).filter(Boolean).slice(-12);
      const tipo = document.getElementById("popup-tipo-ingresso"); const opcoes = tipo ? [...tipo.options].map(o => o.value + "=" + o.textContent.trim()) : [];
      const vazio = ["popup-buyer-nome", "popup-buyer-cpf", "popup-buyer-telefone"].map(i => { const e = document.getElementById(i); return i.replace("popup-buyer-", "") + ":" + (e && (e.value || "").trim() ? "preenchido" : "vazio"); });
      const titulo = [...document.querySelectorAll("h1,h2,h3,h4")].filter(vis).map(h => (h.innerText || "").trim().slice(0, 50)).slice(-3);
      return { campos, vazio, botoes, opcoes, titulo };
    });
    p("formulário aberto pelo botão novo:", JSON.stringify(pop));
    /* 3) O CÓDIGO DA PÁGINA sobre o tipo e o CPF (só LEITURA do texto dos scripts; nada pessoal). 27/11/2026: o tipo volta para "associado" e o CPF vira obrigatório. */
    const trechos = await pg.evaluate(() => {
      const out = [];
      const fontes = [...document.querySelectorAll("script")].map(x => x.textContent || "").filter(t => /popup-tipo-ingresso|Informe o CPF/.test(t));
      fontes.forEach(t => {
        [/FileReader/g, /split\(\s*[\x27"];[\x27"]\s*\)/g, /admin_import\w*|action=admin_\w*import\w*/gi, /Tipo.{0,30}(convid|convite)/gi].forEach(re => {
          let m, n = 0; while ((m = re.exec(t)) && n < 3) { out.push(re.source.slice(0, 20) + " @" + m.index + ": " + t.slice(Math.max(0, m.index - 300), m.index + 420).replace(/\s+/g, " ")); n++; }
        });
      });
      return out.slice(0, 12);
    }).catch(() => []);
    trechos.forEach(t => p("TRECHO", t.slice(0, 560)));
    /* 4) O BOTÃO "Importar" e o campo de arquivo ao redor: como o TickOne recebe a planilha (só estrutura, sem dado). */
    const imp = await pg.evaluate(() => {
      const b = [...document.querySelectorAll("button,label,a")].find(x => /^\s*Importar\s*$/i.test(x.innerText || ""));
      const arquivos = [...document.querySelectorAll("input[type=file]")].map(i => ({ id: i.id, accept: i.accept, onchange: String(i.getAttribute("onchange") || "").slice(0, 80), pai: String((i.closest("form") || {}).action || "").slice(0, 80), enc: String((i.closest("form") || {}).enctype || "") }));
      const raiz = b ? (b.closest("div,form,section") || b.parentElement) : null;
      return { botao: b ? b.outerHTML.replace(/\s+/g, " ").slice(0, 260) : null, arquivos, vizinhanca: raiz ? raiz.outerHTML.replace(/\s+/g, " ").slice(0, 500) : null };
    }).catch(() => ({}));
    p("TRECHO importar:", JSON.stringify(imp).slice(0, 1400));
    await pg.evaluate(() => { if (typeof fecharPopUpAssentoAdmin === "function") fecharPopUpAssentoAdmin(); });
  } catch (e) { p("ERRO:", String(e.message).slice(0, 160)); process.exitCode = 1; }
  finally { await br.close(); }
})();
