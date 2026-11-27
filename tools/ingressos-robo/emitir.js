/**
 * EMITE NO TICKONE OS INGRESSOS PEDIDOS NO SISGEP (14/11/2026). CRIA INGRESSO DE VERDADE.
 * O usuário: "faz um ingresso de teste". Travas:
 *  - só emite o que está na FILA (emissoes-fila.json, escrita pelo SISGEP depois da confirmação
 *    "cria ingresso de verdade" e da pesquisa "já tem ingresso?"); no máximo 60 por execução (lote de 20-40 num toque);
 *  - PESQUISA ANTES de novo: se o CPF já tem ingresso na lista do TickOne, não emite (FALHOU);
 *  - abre UM lugar livre da grade, confere que o pop-up está VAZIO (lugar novo), preenche e
 *    clica só em "Emitir Ingresso" (nunca em Salvar Dados, Excluir nem WhatsApp/e-mail);
 *  - depois recarrega e confere que apareceu EXATAMENTE uma linha nova com aquele CPF e lê o
 *    código; qualquer coisa inesperada PARA a execução (não tenta de novo: evita emitir em dobro);
 *  - nada pessoal no log: só o id do pedido, o resultado e o código do ingresso.
 * Segredos: INGRESSOS_USUARIO, INGRESSOS_SENHA, CLASPRC_JSON. Teste (sem Drive): FILA_LOCAL e
 * RESULTADO_LOCAL; INGRESSOS_URL aponta para um TickOne falso.
 */
const { chromium } = require("playwright");
const { dig, cpf11, cpfValido, lerJson, gravarJson, entrar, ler } = require("./comum");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const ARQ_FILA = "emissoes-fila.json", ARQ_RES = "emissoes-resultado.json", MAXIMO = 60;   // 60 por execução: a lista já foi conferida e confirmada pelo usuário na tela
const CATEGORIAS = ["pago", "cortesia", "convite", "associado", "acompanhante"];
const p = (...a) => console.log(...a);

(async () => {
  const fila = await lerJson(ARQ_FILA, process.env.FILA_LOCAL, true);
  const itens = ((fila && fila.itens) || []).slice(0, MAXIMO);
  if (!itens.length) { p("Fila vazia: nada a emitir."); return; }
  if (!USUARIO || !SENHA) { p("Sem INGRESSOS_USUARIO/INGRESSOS_SENHA: nada feito."); return; }
  const t0 = Date.now(); p("Pedidos na fila:", itens.length);
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage();
  const resultado = (await lerJson(ARQ_RES, process.env.RESULTADO_LOCAL)) || { itens: [] };
  const registrar = async (pedido, status, detalhe, codigo) => {
    resultado.itens = (resultado.itens || []).filter(r => r.pedido !== pedido).concat([{ pedido, status, detalhe, codigo: codigo || "", em: new Date().toISOString() }]);
    resultado.atualizadoEm = new Date().toISOString(); await gravarJson(ARQ_RES, resultado, process.env.RESULTADO_LOCAL);
    p("pedido", pedido, "→", status, codigo ? "· código " + codigo : "", detalhe ? "(" + detalhe + ")" : "");
  };
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou. Nada foi emitido."); process.exitCode = 1; return; }
    const jaNaRodada = {};
    for (const it of itens) {
      const cpf = cpf11(it.cpf), nome = String(it.nome || "").trim(), cat = String(it.categoria || "");
      /* CONVITE e ACOMPANHANTE não precisam de CPF (usuário, 27/11/2026). Sem CPF, a identidade do ingresso é o NOME (sem acento,
         sem maiúsculas): a pesquisa "já tem?" e a conferência "apareceu 1 linha nova" passam a usar o nome. Se vier CPF, ele manda. */
      const semCpfOk = cat === "convite" || cat === "acompanhante";
      const chaveNome = String(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const usaNome = !cpf && semCpfOk;
      if (!nome || CATEGORIAS.indexOf(cat) < 0 || (cpf ? !cpfValido(cpf) : !semCpfOk)) { await registrar(it.pedido, "FALHOU", "pedido sem nome, com CPF inválido (ou sem CPF numa categoria que exige) ou com categoria que o TickOne não tem: NÃO emiti"); continue; }
      const chaveRodada = usaNome ? "N:" + chaveNome : cpf;
      if (jaNaRodada[chaveRodada]) { await registrar(it.pedido, "FALHOU", (usaNome ? "nome repetido nesta fila (sem CPF)" : "CPF repetido nesta fila") + ": NÃO emiti"); continue; }
      const antes = await ler(pg);
      if (!antes) { await registrar(it.pedido, "FALHOU", "não achei a tabela de ingressos"); process.exitCode = 1; break; }
      const norm = x => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const mesma = l => usaNome ? norm(l.nome) === chaveNome : l.cpf === cpf;
      const ja = antes.linhas.find(mesma);
      if (ja) { await registrar(it.pedido, "FALHOU", (usaNome ? "já existe ingresso com este nome (código " : "este CPF já tem ingresso (código ") + ja.codigo + "): NÃO emiti de novo"); continue; }
      /* SEM CPF (convite e acompanhante): o formulário "Emitir ingresso" do TickOne EXIGE CPF para qualquer tipo ("Na emissão pelo painel só nome e CPF são obrigatórios",
         lido no script da página em 27/11/2026). A IMPORTAÇÃO por planilha aceita pessoa sem CPF — o modelo oficial do TickOne traz "Convidado Exemplo;;;;Serra - ES;;Convidado".
         Então estes vão por uma planilha CSV de UMA linha pelo formulário de importação (admin_import_tickets), aceitando só a confirmação "emitir um ingresso para cada linha". */
      if (usaNome && (await pg.$("form[action*='admin_import_tickets'] input[type=file]"))) {
        const tipoTxt = cat === "acompanhante" ? "Acompanhante do Associado" : "Convidado";
        let f = dig(it.telefone || ""); if (f.length >= 12 && f.slice(0, 2) === "55") f = f.slice(2);   /* local: o "fone" do formulário só é declarado mais abaixo (erro de 27/11) */
        const fmt = f.length === 11 ? "(" + f.slice(0, 2) + ") " + f.slice(2, 7) + "-" + f.slice(7) : f.length === 10 ? "(" + f.slice(0, 2) + ") " + f.slice(2, 6) + "-" + f.slice(6) : "";
        const limpo = x => String(x || "").replace(/[;\r\n"]/g, " ").replace(/\s+/g, " ").trim();
        const csv = "\uFEFFNome;Email;CPF;Telefone;Cidade;Escola;Tipo\n" + [limpo(nome), "", "", fmt, limpo(it.cidade), limpo(it.escola), tipoTxt].join(";") + "\n";
        const form = await pg.$("form[action*='admin_import_tickets']"), arq = await form.$("input[type=file]"), btn = await form.$("button[type=submit]");
        if (!btn) { await registrar(it.pedido, "FALHOU", "não achei o botão Importar: NÃO emiti"); process.exitCode = 1; break; }
        await arq.setInputFiles({ name: "importacao.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
        let confirmou = false; const aoConfirmar = d => { if (/emitir um ingresso para cada linha/i.test(d.message())) { confirmou = true; d.accept().catch(() => {}); } else d.dismiss().catch(() => {}); };
        pg.on("dialog", aoConfirmar);
        jaNaRodada[chaveRodada] = true;
        await Promise.all([pg.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null), btn.click()]);
        pg.off("dialog", aoConfirmar);
        await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForSelector("table tbody tr", { timeout: 8000 }).catch(() => {});
        const depoisI = await ler(pg), novasI = depoisI ? depoisI.linhas.filter(mesma) : [];
        if (!confirmou || !depoisI || novasI.length !== 1 || depoisI.linhas.length !== antes.linhas.length + 1) {
          await registrar(it.pedido, "FALHOU", "importei a planilha, mas não apareceu exatamente uma linha nova com este nome (" + novasI.length + " linha(s); confirmação " + (confirmou ? "aceita" : "NÃO apareceu") + "): a execução parou e NÃO tentei de novo");
          process.exitCode = 1; break;
        }
        await registrar(it.pedido, "EMITIDO", "conferido: apareceu 1 linha nova na lista do TickOne (importação de 1 linha)", novasI[0].codigo);
        continue;
      }
      /* ABRE O FORMULÁRIO. 27/11/2026: o TickOne tirou a grade de lugares (a de 16/11 tinha 2.994; hoje só há os botões de editar dos já emitidos)
         e ganhou o botão "Emitir ingresso" (emitirNovoIngressoAdmin), que abre o MESMO formulário, vazio, sem escolher lugar. Sonda de 27/11 provou.
         Usa o botão novo; só se ele não existir cai no jeito antigo (um lugar LIVRE da grade). */
      const abriu = await pg.evaluate(() => {
        const novo = [...document.querySelectorAll("button")].find(x => /emitirNovoIngressoAdmin/.test(x.getAttribute("onclick") || ""));
        if (novo) { novo.scrollIntoView(); novo.click(); return "botao"; }
        const b = [...document.querySelectorAll("button[onclick*='abrirPopUpAssentoAdmin']")].find(x => /text-emerald-400/.test(x.className || "") && !/rose-/.test(x.className || ""));
        if (!b) return false; b.scrollIntoView(); b.click(); return "grade";
      });
      if (!abriu) { await registrar(it.pedido, "FALHOU", "não achei o botão 'Emitir ingresso' nem lugar livre na grade: NÃO emiti"); process.exitCode = 1; break; }
      await pg.waitForSelector("#popup-buyer-nome", { state: "visible", timeout: 6000 }).catch(() => null);
      const vazio = await pg.evaluate(() => ["popup-buyer-nome", "popup-buyer-cpf"].every(id => { const e = document.getElementById(id); return e && e.offsetParent !== null && !(e.value || "").trim(); }));
      if (!vazio) { await registrar(it.pedido, "FALHOU", "o pop-up do lugar não estava vazio (lugar já usado?): NÃO emiti"); process.exitCode = 1; break; }
      await pg.screenshot({ path: "/tmp/popup-vazio.png" }).catch(() => {});
      /* PREENCHER, CONFERIR E EMITIR NO MESMO PASSO DO NAVEGADOR. Sonda de 15/11/2026: ao preencher o CPF o TickOne busca o
         cliente e, ~1,5 s depois, a resposta ZERA o formulário (todos os campos e o tipo volta a "Pago"). Por isso nenhuma
         ordem de preenchimento funcionava (o tipo voltava a Pago; o telefone sumia). Tudo roda dentro de UM evaluate, sem
         pausa: os valores entram (só o evento "input", que as máscaras usam — nada de blur/change, que disparam a busca),
         são CONFERIDOS campo a campo e só então o botão Emitir é clicado; o TickOne lê os campos na hora do clique. Se
         qualquer campo não bater, NÃO clica e nada é emitido. */
      let fone = dig(it.telefone || "");   // máscara do campo: DDD + número (11 dígitos); o "55" virava DDD e cortava o fim
      if (fone.length >= 12 && fone.slice(0, 2) === "55") fone = fone.slice(2);
      jaNaRodada[chaveRodada] = true;
      const respostas = []; const ouvir = async r => { try { const rq = r.request(); if (rq.method() === "GET" && !/emitir|ticket|salvar/i.test(r.url())) return; const t = (await r.text()).replace(/\s+/g, " ").slice(0, 140); respostas.push(rq.method() + " " + new URL(r.url()).pathname.split("/").pop() + new URL(r.url()).search.slice(0, 40) + " → " + r.status() + " " + t); } catch (e) {} };
      pg.on("response", ouvir);
      const consolas = []; const aoConsole = m => { if (/error|warn/.test(m.type())) consolas.push(m.type() + ": " + String(m.text()).replace(/\s+/g, " ").slice(0, 140)); }; const aoErro = e => consolas.push("pageerror: " + String(e.message).slice(0, 140));
      pg.on("console", aoConsole); pg.on("pageerror", aoErro);
      const textoAntes = await pg.evaluate(() => document.body.innerText).catch(() => "");
      const dialogos = []; const aoDialogo = d => { dialogos.push(d.type() + ": " + String(d.message()).replace(/\s+/g, " ").slice(0, 140)); d.dismiss().catch(() => {}); };   // só REGISTRA; segue recusando como antes
      pg.on("dialog", aoDialogo);
      const feito = await pg.evaluate((d) => {
        const g = id => document.getElementById(id), dg = x => String(x || "").replace(/\D/g, "");
        const set = (id, v) => { const e = g(id); if (!e) return false; e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); return true; };
        /* 27/11/2026 — TIPO PRIMEIRO, COM O EVENTO "change". O formulário ajusta as regras (CPF obrigatório ou não) quando o tipo muda pelo seletor; o robô trocava o
           valor por código, sem avisar a página, e ela seguia com a regra do tipo padrão: "Informe o CPF do comprador". Escolher o tipo ANTES dos campos (a busca por CPF
           é que zera o formulário) e disparar o "change" faz a página aplicar a regra do tipo, como numa pessoa. */
        const sel0 = g("popup-tipo-ingresso"); if (sel0) { sel0.value = d.cat; sel0.dispatchEvent(new Event("input", { bubbles: true })); sel0.dispatchEvent(new Event("change", { bubbles: true })); }
        set("popup-buyer-nome", d.nome); if (d.email) set("popup-buyer-email", d.email); if (d.cpf) set("popup-buyer-cpf", d.cpf);
        if (d.fone) set("popup-buyer-telefone", d.fone); if (d.cidade) set("popup-buyer-cidade", d.cidade); if (d.escola) set("popup-buyer-observacao", d.escola);
        const sel = g("popup-tipo-ingresso"); if (sel) sel.value = d.cat;
        const falhas = [];
        if (!g("popup-buyer-nome") || g("popup-buyer-nome").value.trim() !== d.nome) falhas.push("nome");
        if (d.email && g("popup-buyer-email").value !== d.email) falhas.push("e-mail");
        if (d.cpf && dg(g("popup-buyer-cpf").value) !== d.cpf) falhas.push("CPF");
        if (d.fone && dg(g("popup-buyer-telefone").value) !== d.fone) falhas.push("telefone");
        if (d.cidade && g("popup-buyer-cidade").value !== d.cidade) falhas.push("cidade");
        if (d.escola && g("popup-buyer-observacao").value !== d.escola) falhas.push("observação");
        if (!sel || sel.value !== d.cat) falhas.push("categoria");
        let botao = null, x = g("popup-buyer-nome");
        while (x && x !== document.body && !botao) { x = x.parentElement; if (!x) break; const bs = [...x.querySelectorAll("button")].filter(b => (b.innerText || "").trim() === "Emitir Ingresso"); if (bs.length) botao = bs.find(b => b.offsetParent !== null) || bs[0]; }
        if (!botao) falhas.push("botão Emitir Ingresso");
        if (falhas.length) return { ok: false, falhas };
        botao.click();   // sem nenhuma pausa entre a conferência e o clique
        return { ok: true, falhas: [] };
      }, { nome, email: String(it.email || ""), cpf, fone, cidade: String(it.cidade || ""), escola: String(it.escola || ""), cat });
      if (!feito.ok) { await registrar(it.pedido, "FALHOU", "o pop-up não ficou como pedido (" + feito.falhas.join(", ") + "): NÃO emiti"); process.exitCode = 1; break; }
      /* DIAGNÓSTICO (27/11/2026): o TickOne não emitiu e não disse por quê. Lê o que ele mostra na tela (aviso, caixa de erro) e as respostas de rede do clique. Sem dado pessoal. */
      await pg.waitForTimeout(2500);
      const avisosTela = await pg.evaluate(() => [...document.querySelectorAll("[role=alert],[role=dialog],.swal2-popup,.swal2-html-container,#toast,.toast,.alert,[class*=toast],[class*=error],[class*=erro]")].filter(e => e.offsetParent !== null).map(e => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160)).filter(Boolean).slice(0, 4)).catch(() => []);
      const obrig = await pg.evaluate(() => ["popup-buyer-nome", "popup-buyer-email", "popup-buyer-cpf", "popup-buyer-telefone", "popup-buyer-cidade"].map(i => { const e = document.getElementById(i); return i.replace("popup-buyer-", "") + ":" + (e ? (e.required ? "obrigatório" : "livre") + (e.validationMessage ? "(" + e.validationMessage.slice(0, 40) + ")" : "") : "ausente"); })).catch(() => []);
      const sobrepostos = await pg.evaluate(() => [...document.querySelectorAll("div,section,dialog")].filter(e => e.offsetParent !== null && /fixed|z-50|z-\[/.test(String(e.className || "")) && (e.innerText || "").trim().length > 0 && (e.innerText || "").length < 400).map(e => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 140)).slice(0, 4)).catch(() => []);
      const textoDepois = await pg.evaluate(() => document.body.innerText).catch(() => "");
      const antesSet = new Set(String(textoAntes).split("\n").map(x => x.trim()).filter(Boolean));
      const novasLinhas = String(textoDepois).split("\n").map(x => x.trim()).filter(x => x && !antesSet.has(x)).slice(0, 6).map(x => x.slice(0, 120));
      pg.off("console", aoConsole); pg.off("pageerror", aoErro);
      p("DIAGNÓSTICO · linhas de texto novas na tela depois do clique:", novasLinhas.length, "(conteúdo não é impresso: tem nome e CPF) · erros de JS:", JSON.stringify(consolas.slice(0, 4)));
      pg.off("response", ouvir); pg.off("dialog", aoDialogo);
      const infoTipo = await pg.evaluate(() => { const e = document.getElementById("popup-tipo-ingresso"); return e ? { valor: e.value, onchange: String(e.getAttribute("onchange") || "").slice(0, 80), opcoes: [...e.options].map(o => o.value).join("|") } : null; }).catch(() => null);
      p("DIAGNÓSTICO · seletor de tipo:", JSON.stringify(infoTipo));
      p("DIAGNÓSTICO · caixas do navegador:", JSON.stringify(dialogos), "· camadas na tela:", JSON.stringify(sobrepostos));
      p("DIAGNÓSTICO · avisos na tela:", JSON.stringify(avisosTela), "· campos:", obrig.join(" "), "· respostas:", JSON.stringify(respostas.slice(0, 4)));
      await pg.screenshot({ path: "/tmp/popup-erro.png" }).catch(() => {});
      await pg.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
      await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForSelector("table tbody tr", { timeout: 8000 }).catch(() => {});
      const depois = await ler(pg);
      const novas = depois ? depois.linhas.filter(mesma) : [];
      if (!depois || novas.length !== 1 || depois.linhas.length !== antes.linhas.length + 1) {
        await registrar(it.pedido, "FALHOU", "cliquei em Emitir, mas não apareceu exatamente uma linha nova com este "+(usaNome ? "nome" : "CPF")+" (" + novas.length + " linha(s)): a execução parou e NÃO tentei de novo");
        process.exitCode = 1; break;
      }
      const nv = novas[0], avisos = [];
      if (nv.tipo && cat && nv.tipo.toLowerCase().indexOf(({ pago: "pago", cortesia: "cortesia", convite: "convite", associado: "associado", acompanhante: "acompanhante" })[cat]) < 0) avisos.push("categoria na lista: " + nv.tipo);
      if (fone && nv.tel && dig(nv.tel) !== fone && dig(nv.tel) !== "55" + fone) avisos.push("telefone na lista com " + dig(nv.tel).length + " dígitos");
      await registrar(it.pedido, "EMITIDO", "conferido: apareceu 1 linha nova na lista do TickOne" + (avisos.length ? " · ATENÇÃO: " + avisos.join("; ") : ""), nv.codigo);
    }
  } catch (e) { p("ERRO:", String(e.message).slice(0, 120), "— a execução parou."); process.exitCode = 1; }
  const feitos = (resultado.itens || []).filter(r => itens.some(i => i.pedido === r.pedido));
  p("RESUMO: emitidos", feitos.filter(r => r.status === "EMITIDO").length, "· falharam", feitos.filter(r => r.status === "FALHOU").length, "· de", itens.length, "pedido(s) em", Math.round((Date.now() - t0) / 1000), "s");
  await br.close();
})();
