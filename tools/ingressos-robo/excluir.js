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
const { chromium } = require("playwright");
const { dig, cpf11, lerJson, gravarJson, entrar, ler } = require("./comum");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const ARQ_FILA = "exclusoes-fila.json", ARQ_RES = "exclusoes-resultado.json", MAXIMO = 5;
const p = (...a) => console.log(...a);

(async () => {
  const fila = await lerJson(ARQ_FILA, process.env.FILA_LOCAL, true);
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
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou. Nada foi excluído."); process.exitCode = 1; return; }
    for (const it of itens) {
      const cpf = cpf11(it.cpf), cod = String(it.codigo || "").trim();
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
      /* COMO A EXCLUSÃO FUNCIONA NO TICKONE REAL (sonda de 15/11/2026): a lixeira chama excluirVendaUnica(id), que faz
         `confirm("Excluir este ingresso? ...")` — um DIÁLOGO DO NAVEGADOR, não o pop-up da página — e só então faz o POST
         admin_delete_tickets e recarrega. O pop-up "Você tem certeza?" da página existe, mas fica escondido e não é usado aqui.
         O Playwright RECUSA diálogos sozinho; por isso as 3 primeiras tentativas clicavam na lixeira e nada era excluído.
         Agora: só o diálogo cujo texto é "Excluir este ingresso" é ACEITO, e só durante este clique; qualquer outro é recusado. */
      let dialogoAceito = false, dialogoOutro = "";
      const aoDialogo = async d => {
        if (/Excluir este ingresso/i.test(d.message())) { dialogoAceito = true; await d.accept().catch(() => {}); }
        else { dialogoOutro = d.message().slice(0, 60); await d.dismiss().catch(() => {}); }
      };
      pg.on("dialog", aoDialogo);
      try {
        try { await el.scrollIntoViewIfNeeded({ timeout: 4000 }); await el.click({ timeout: 6000 }); }
        catch (eClique) {
          const diag = await el.evaluate(b => { const out = []; let x = b; for (let i = 0; i < 5 && x; i++, x = x.parentElement) { const s = getComputedStyle(x), r = x.getBoundingClientRect();
            out.push((x.id ? "#" + x.id : x.tagName.toLowerCase()) + "{d:" + s.display + ",v:" + s.visibility + ",o:" + s.opacity + ",ov:" + s.overflow + ",w:" + Math.round(r.width) + "}"); }
            return out.join(" < "); }).catch(() => "(sem diagnóstico)");
          p("clique normal na lixeira falhou:", String(eClique.message).split("\n")[0].slice(0, 80), "· botão:", diag);
          const aindaLa2 = await el.evaluate(b => b.isConnected && /excluir/i.test(b.title || "")).catch(() => false);
          if (!aindaLa2) { await registrar(it.pedido, "FALHOU", "a lixeira sumiu durante o clique: NÃO sei se excluiu — confira a lista"); process.exitCode = 1; break; }
          await el.evaluate(b => b.click());
        }
        /* o aceite do diálogo dispara o POST e o recarregamento da página: espera isso assentar */
        await pg.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(800);
      } finally { pg.off("dialog", aoDialogo); }
      if (!dialogoAceito) { await registrar(it.pedido, "FALHOU", dialogoOutro ? "o TickOne perguntou outra coisa ('" + dialogoOutro + "'): NÃO excluí" : "o TickOne não pediu a confirmação esperada ('Excluir este ingresso'): NÃO excluí"); process.exitCode = 1; break; }
      await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1500);
      const depois = await ler(pg);
      const aindaLa = depois && depois.linhas.some(l => l.codigo.toLowerCase() === cod.toLowerCase() && l.cpf === cpf);
      if (aindaLa) { await registrar(it.pedido, "FALHOU", "cliquei em excluir e confirmar, mas a linha continua na lista"); process.exitCode = 1; break; }
      await registrar(it.pedido, "EXCLUIDO", "conferido: a linha saiu da lista do TickOne");
    }
  } catch (e) { p("ERRO:", String(e.message).slice(0, 120), "— a execução parou."); process.exitCode = 1; }
  await br.close();
})();
