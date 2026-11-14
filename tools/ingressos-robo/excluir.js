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
const { dig, lerJson, gravarJson, entrar, ler } = require("./comum");
const BASE = process.env.INGRESSOS_URL || "https://ingressos.sindeducacao.com.br/index.php?page=admin&evt_id=17";
const USUARIO = (process.env.INGRESSOS_USUARIO || "").trim(), SENHA = (process.env.INGRESSOS_SENHA || "").trim();
const ARQ_FILA = "exclusoes-fila.json", ARQ_RES = "exclusoes-resultado.json", MAXIMO = 5;
const p = (...a) => console.log(...a);

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
    if (!(await entrar(pg, BASE, USUARIO, SENHA))) { p("FALHA: o login não entrou. Nada foi excluído."); process.exitCode = 1; return; }
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
