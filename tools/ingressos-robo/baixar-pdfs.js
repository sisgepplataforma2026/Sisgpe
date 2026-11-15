/**
 * BAIXA O PDF DE CADA INGRESSO DO TICKONE (15/11/2026). SÓ LEITURA no TickOne.
 * O usuário emite no TickOne (1 ou 100) e quer só abrir o SISGEP e enviar. O robô lê a lista, vê quais ingressos ainda não
 * têm PDF (estado em pdfs-estado.json, na pasta privada do robô) e baixa o PDF de cada um — o mesmo "Reemitir (PDF)" que a
 * pessoa clica, aberto pelo endereço da própria linha — e guarda como "TickOne - Nome.pdf" na pasta privada do robô.
 * O SISGEP copia os novos para a pasta INGRESSOS FESTA COMPASSO 2026 (CompassoIngressosDados.gs).
 * NUNCA clica em WhatsApp, e-mail, editar, salvar, excluir ou emitir. Nada pessoal no log: só códigos e contagens.
 * Teste (sem Drive): ESTADO_LOCAL (arquivo) e PDF_LOCAL_DIR (pasta); INGRESSOS_URL aponta para um TickOne falso.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const { lerJson, gravarJson, gravarBinario, entrar, ler } = require("./comum");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const ARQ_EST = "pdfs-estado.json", MAXIMO = Number(process.env.PDF_MAXIMO || 150), LIMITE_MS = Number(process.env.PDF_LIMITE_MS || 11 * 60 * 1000);
const p = (...a) => console.log(...a);
const limpar = s => String(s || "").replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  if (!USUARIO || !SENHA) { p("Sem INGRESSOS_USUARIO/INGRESSOS_SENHA: nada feito."); return; }
  const t0 = Date.now();
  const est = (await lerJson(ARQ_EST, process.env.ESTADO_LOCAL, true)) || {}; est.feitos = est.feitos || {}; est.falhas = est.falhas || {};
  const br = await chromium.launch(); const ctx = await br.newContext({ acceptDownloads: true }); const pg = await ctx.newPage();
  const salvarEstado = async () => { est.atualizadoEm = new Date().toISOString(); await gravarJson(ARQ_EST, est, process.env.ESTADO_LOCAL); };
  try {
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou."); process.exitCode = 1; return; }
    const lista = await ler(pg);
    if (!lista) { p("FALHA: não achei a tabela de ingressos."); process.exitCode = 1; return; }
    const usados = new Set(Object.values(est.feitos).map(x => x.arquivo));
    const faltam = lista.linhas.filter(l => l.ref && !est.feitos[l.codigo]);
    p("Ingressos na lista:", lista.linhas.length, "· já com PDF:", Object.keys(est.feitos).length, "· faltam:", faltam.length);
    let ok = 0, falhou = 0;
    for (const l of faltam.slice(0, MAXIMO)) {
      if (Date.now() - t0 > LIMITE_MS) { p("Limite de tempo da execução: o resto fica para a próxima."); break; }
      const aba = await ctx.newPage();
      try {
        const url = new URL("index.php?page=ticket&ref=" + encodeURIComponent(l.ref), BASE).href;
        const espera = aba.waitForEvent("download", { timeout: 25000 });
        aba.goto(url, { waitUntil: "commit" }).catch(() => {});   // a navegação vira download: o goto "falha" por isso
        const d = await espera;
        const buf = fs.readFileSync(await d.path());
        if (buf.length < 500 || buf.slice(0, 4).toString() !== "%PDF") throw new Error("o arquivo baixado não é um PDF válido (" + buf.length + " bytes)");
        let nome = limpar(d.suggestedFilename());
        if (!/^TickOne - .+\.pdf$/i.test(nome)) nome = "TickOne - " + limpar(l.nome || l.codigo) + ".pdf";
        if (usados.has(nome)) nome = nome.replace(/\.pdf$/i, "") + " (" + l.codigo + ").pdf";   // dois ingressos com o mesmo nome não se sobrescrevem
        usados.add(nome);
        await gravarBinario(nome, buf, process.env.PDF_LOCAL_DIR);
        est.feitos[l.codigo] = { arquivo: nome, bytes: buf.length, em: new Date().toISOString() }; delete est.falhas[l.codigo]; ok++;
        if (ok % 10 === 0) await salvarEstado();
      } catch (e) {
        falhou++; est.falhas[l.codigo] = { motivo: String(e.message).split("\n")[0].slice(0, 100), em: new Date().toISOString() };
        p("falhou o PDF do ingresso", l.codigo + ":", String(e.message).split("\n")[0].slice(0, 100));
      } finally { await aba.close().catch(() => {}); }
    }
    await salvarEstado();
    p("RESUMO: PDFs baixados", ok, "· falharam", falhou, "· ainda faltam", Math.max(0, faltam.length - ok - falhou), "· em", Math.round((Date.now() - t0) / 1000), "s");
    if (falhou) process.exitCode = 1;
  } catch (e) { p("ERRO:", String(e.message).slice(0, 140)); await salvarEstado().catch(() => {}); process.exitCode = 1; }
  await br.close();
})();
