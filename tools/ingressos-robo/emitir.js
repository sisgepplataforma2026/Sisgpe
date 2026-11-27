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
      const feito = await pg.evaluate((d) => {
        const g = id => document.getElementById(id), dg = x => String(x || "").replace(/\D/g, "");
        const set = (id, v) => { const e = g(id); if (!e) return false; e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); return true; };
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
