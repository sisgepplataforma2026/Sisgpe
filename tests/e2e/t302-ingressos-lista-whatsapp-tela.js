/**
 * INGRESSOS · TELA "COLAR DO WHATSAPP" (27/11/2026) — CompassoIngressos.html em jsdom, backend real, base do TickOne FALSA.
 * Prova: o botão existe e abre a caixa; colar + escolher categoria + Organizar põe cada pessoa no cartão, com telefone e
 * categoria; quem já tem ingresso é achado pelo nome; sem telefone fica avisado; nada é emitido. NÃO PROVA o visual real nem o TickOne.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
if (!dom.jsdomDisponivel()) { b.fluxo("LISTA DO WHATSAPP · tela"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const agora = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm: agora, evento: "x", total: 1, linhas: [{ nome: "Francisco Primo", cpf: "", tel: "", codigo: "AAAA-0001", tipo: "Convite", escola: "", cidade: "", ref: "R1", zap: 0 }] });
g.cingPdfs_ = () => ({});
const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("LISTA DO WHATSAPP · tela");
  win.cingCarregar(); await t.assentar(300);
  t.clicar("[data-ci='aba'][data-arg='solicitar']");
  b.ok(!!doc.querySelector("[data-ci='togZap']") && el("ciBoxZap").hidden === true, "o botão 'Colar do WhatsApp' existe e a caixa começa fechada");
  t.clicar("[data-ci='togZap']");
  b.ok(el("ciBoxZap").hidden === false, "o botão abre a caixa");
  b.ok(/só o nome/.test(doc.getElementById("ciPSolicitar").textContent), "o aviso diz que Convidado e Acompanhante pedem só o nome");
  el("ciZapTxt").value = "Ademir Carlos Pin 27 99913-9936\nZenair: Zenaide Borges, Claudimar Matheus 27999154910\nFrancisco Primo 27999161454\nJuliana Simão (sem telefone)";
  el("ciZapCat").value = "convite";
  t.clicar("[data-ci='lerZap']"); await t.assentar(300);
  const cartoes = doc.querySelectorAll("#ciPessoas .ci-pessoa");
  b.igual(cartoes.length, 5, "cinco pessoas nos cartões (o grupo do Zenair virou duas)");
  const campo = (i, k) => doc.querySelector('#ciPessoas .ci-f[data-i="' + i + '"][data-k="' + k + '"]');
  b.igual(campo(0, "nome").value, "Ademir Carlos Pin", "nome separado");
  b.ok(/99913/.test(campo(0, "telefone").value), "telefone separado e com máscara", campo(0, "telefone").value);
  b.igual(campo(0, "categoria").value, "convite", "categoria da lista aplicada");
  b.ok(el("ciBoxZap").hidden === true && el("ciZapTxt").value === "", "a caixa fecha e limpa depois de organizar");
  t.clicar("[data-ci='conferir']"); await t.assentar(500);
  const txt = el("ciPessoas").textContent;
  b.ok(/Conferir/.test(txt) && /Já existe ingresso com este nome/.test(txt), "quem tem o MESMO NOME na base vai para Conferir (sem CPF, homônimo é possível; a pessoa decide)");
  b.ok(/Nova pessoa/.test(txt), "os outros aparecem como nova pessoa — sem CPF, sem bloquear");
  b.ok(/Sem telefone/.test(txt), "quem está sem telefone ganha o aviso");
  b.ok(g.compassoIngressos_emissoes(TOKEN).emissoes.length === 0, "nada foi emitido");
  b.resumo(); process.exit(process.exitCode || 0);
})();
