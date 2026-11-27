/**
 * REENVIO DE OFÍCIO COM MOTIVO E ESCOLHA DE ASSOCIADOS (04/11/2026).
 * Desenho aprovado: "Aprovo". O usuário: "poderia ter a opção de escolher
 * quais associados eu preciso reenviar?" e "uma observação informando que o
 * reenvio é porque algum funcionário não está sendo descontado? Ou todos".
 *
 * Backend real (reenviarOficio, preverReenvioOficio), Gmail do emulador. As
 * fichas do ofício são simuladas na reunião de anexos (a reunião em si é
 * coberta por t123/t144/t162); o que se testa aqui é o filtro e o texto.
 *
 * Prova:
 *   - sem motivo: o reenvio é EXATAMENTE o de antes (mesmo texto, mesmos anexos);
 *   - a prévia traz as pessoas do Registro, a ficha de cada uma e os textos
 *     por tipo, com a cláusula pelo MTE (filiação "não identificamos";
 *     desfiliação/oposição "continua sendo feito");
 *   - ALGUNS: só as fichas dos marcados vão; o PDF do ofício vai sempre;
 *     ofício em lote: o PDF das fichas vai inteiro, com aviso;
 *   - a observação entra no e-mail; vazia ou sem ninguém marcado: recusa;
 *   - o log diz o motivo e quem; a memória do robô guarda proposto × enviado;
 *   - a tela (jsdom): motivo, quem, texto proposto que acompanha, envio.
 * NÃO PROVA: a entrega de verdade nem o PDF de verdade.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 8).setValues([["Número do Ofício", "Tipo", "Escola", "E-mail (principal)", "E-mails (todos)", "Link Ficha", "Status", "Colaborador(es)"]]);
reg.getRange(2, 1, 3, 8).setValues([
  ["144/2026", "Filiação", "COLEGIO ALFA", "rh@alfa.exemplo.com", "rh@alfa.exemplo.com", "", "ENVIADO", "1. MARIA SOUZA\n2. JOÃO LIMA\n3. ANA REIS"],
  ["150/2026", "Desfiliação", "COLEGIO ALFA", "rh@alfa.exemplo.com", "rh@alfa.exemplo.com", "", "ENVIADO", "1. PEDRO DIAS"],
  ["160/2026", "Filiação", "COLEGIO ALFA", "rh@alfa.exemplo.com", "rh@alfa.exemplo.com", "", "ENVIADO", "1. CARLA MELO\n2. BETO RAMOS"]
]);
const blob = n => g.Utilities.newBlob("x", "application/pdf", n);
const PACOTE = {
  "144/2026": ["Oficio_144_COLEGIO_ALFA.pdf", "Ficha_Filiacao_MARIA_SOUZA_COLEGIO_ALFA_01-10-2026.pdf",
               "Ficha_Filiacao_JOAO_LIMA_COLEGIO_ALFA_01-10-2026.pdf", "Ficha_Filiacao_ANA_REIS_COLEGIO_ALFA_01-10-2026.pdf"],
  "150/2026": ["Oficio_150_COLEGIO_ALFA.pdf", "Ficha_Desfiliacao_PEDRO_DIAS_COLEGIO_ALFA_01-10-2026.pdf"],
  "160/2026": ["Oficio_160_COLEGIO_ALFA.pdf", "Fichas_Filiacao_COLEGIO_ALFA_01-10-2026.pdf"]
};
g.reunirAnexosReenvioOficio_ = numero => ({
  blobs: PACOTE[numero].map(blob), itens: PACOTE[numero].map(n => ({ nome: n, origem: "pacote original da fila" })), reconstruido: true
});
const URL = n => "https://drive.google.com/file/d/ARQ-OFICIO-" + n.replace("/", "-") + "/view";
const enviar = o => { amb.outbox.length = 0; return g.reenviarOficio(Object.assign({ url: URL(o.numero), escola: "COLEGIO ALFA", destinatarios: ["rh@alfa.exemplo.com"] }, o), TOKEN); };
const nomesAnexos = () => ((amb.outbox[0] || {}).attachments || []).map(x => x.getName());
const corpo = () => String((amb.outbox[0] || {}).htmlBody || (amb.outbox[0] || {}).body || "");

b.fluxo("REENVIO COM MOTIVO · o servidor");
b.passo("1. Sem motivo: igual a antes");
const r0 = enviar({ numero: "144/2026", tipo: "Filiação" });
b.ok(r0 && !r0.erro, "reenviou", r0 && r0.mensagem);
b.igual(nomesAnexos().length, 4, "o ofício e as 3 fichas, como sempre");
b.ok(/Reenviamos, em anexo, o ofício Nº 144\/2026/.test(corpo()) && !/não identificamos/.test(corpo()), "o texto de sempre, sem observação");

b.passo("2. A prévia: as pessoas, a ficha de cada uma, os textos por tipo");
const pv = g.preverReenvioOficio({ numero: "144/2026", escola: "COLEGIO ALFA", tipo: "Filiação", url: URL("144/2026") }, TOKEN);
b.ok(pv.ok && pv.motivo, "a prévia traz o motivo", pv.mensagem);
b.igual(pv.motivo.pessoas.map(p => p.nome), ["MARIA SOUZA", "JOÃO LIMA", "ANA REIS"], "as 3 pessoas do Registro");
b.ok(/JOAO_LIMA/.test(pv.motivo.pessoas[1].ficha), "a ficha de cada uma (o JOÃO com acento casa com JOAO no arquivo)", pv.motivo.pessoas[1].ficha);
b.ok(/não identificamos o desconto da mensalidade sindical de: \{PESSOAS\}/.test(pv.motivo.modelos.ALGUNS) && /Cláusula 38ª .*ES000256\/2026/.test(pv.motivo.modelos.ALGUNS),
  "filiação: \"não identificamos\", cláusula 38ª pelo MTE");
const pvD = g.preverReenvioOficio({ numero: "150/2026", escola: "COLEGIO ALFA", tipo: "Desfiliação", url: URL("150/2026") }, TOKEN);
b.ok(/continua sendo feito/.test(pvD.motivo.modelos.ALGUNS), "desfiliação: \"continua sendo feito\"");
b.ok(/Cláusula 40ª/.test(g.ofrModelos_("Oposição à Taxa Negocial", "1").TODOS), "oposição: cláusula 40ª");
const pvL = g.preverReenvioOficio({ numero: "160/2026", escola: "COLEGIO ALFA", tipo: "Filiação", url: URL("160/2026") }, TOKEN);
b.ok(pvL.motivo.fichasEmLote === true, "ofício em lote: a prévia avisa que as fichas estão num PDF só");

const confOrig = g.oficiosConferenciaMensal;
g.oficiosConferenciaMensal = () => ({ ok: true, problemas: [{ numero: "144/2026", problema: [{ nome: "JOÃO LIMA" }] }] });
const pvC = g.preverReenvioOficio({ numero: "144/2026", escola: "COLEGIO ALFA", tipo: "Filiação", url: URL("144/2026") }, TOKEN);
b.ok(pvC.motivo.pessoas[1].sugerido && !pvC.motivo.pessoas[0].sugerido && /Conferência mensal/.test(pvC.motivo.sugeridosOrigem),
  "quem a Conferência mensal não achou na lista da escola vem sugerido, com a origem");
g.oficiosConferenciaMensal = confOrig;

b.passo("3. ALGUNS: só as fichas dos marcados, e a observação no e-mail");
const obs = "Reenviamos o Ofício nº 144/2026 porque, até o momento, não identificamos o desconto da mensalidade sindical de: MARIA SOUZA e ANA REIS.";
const r1 = enviar({ numero: "144/2026", tipo: "Filiação", motivo: "ALGUNS", pessoas: ["MARIA SOUZA", "ANA REIS"], observacao: obs, observacaoSugerida: obs + " Solicitamos." });
b.ok(r1 && !r1.erro, "reenviou", r1 && r1.mensagem);
const an = nomesAnexos();
b.ok(an.length === 3 && an.some(n => /^Oficio_144/.test(n)) && an.some(n => /MARIA_SOUZA/.test(n)) && an.some(n => /ANA_REIS/.test(n)) && !an.some(n => /JOAO_LIMA/.test(n)),
  "o ofício + as fichas da Maria e da Ana; a do João ficou de fora", an.join(" | "));
b.ok(/não identificamos o desconto da mensalidade sindical de: MARIA SOUZA e ANA REIS/.test(corpo()), "a observação está no e-mail");
b.ok(/Com a observação do motivo/.test(r1.mensagem) && /1 ficha\(s\) de quem não foi marcado ficaram de fora/.test(r1.mensagem), "a mensagem diz o que foi feito", r1.mensagem);
b.ok(!/<b>x<\/b>/.test((enviar({ numero: "144/2026", tipo: "Filiação", motivo: "OUTRO", observacao: "teste <b>x</b>" }), corpo())), "a observação vai escapada (sem HTML de quem digitou)");

b.passo("4. Recusas");
b.ok(enviar({ numero: "144/2026", tipo: "Filiação", motivo: "ALGUNS", pessoas: [], observacao: obs }).erro, "ALGUNS sem ninguém marcado: recusa");
b.ok(enviar({ numero: "144/2026", tipo: "Filiação", motivo: "TODOS", observacao: "  " }).erro, "observação vazia: recusa");
b.igual(amb.outbox.length, 0, "e nada saiu");

b.passo("5. Lote, todos e o registro");
const r2 = enviar({ numero: "160/2026", tipo: "Filiação", motivo: "ALGUNS", pessoas: ["CARLA MELO"], observacao: "Reenvio — falta o desconto da CARLA MELO." });
b.ok(nomesAnexos().length === 2 && /num PDF só/.test(r2.mensagem), "lote: o PDF das fichas vai inteiro, com aviso", r2.mensagem);
const r3 = enviar({ numero: "144/2026", tipo: "Filiação", motivo: "TODOS", observacao: g.ofrModelos_("Filiação", "144/2026").TODOS });
b.ok(!r3.erro && nomesAnexos().length === 4 && /nenhum\(a\) dos\(as\) trabalhadores/.test(corpo()), "TODOS: tudo vai, com a observação");
const log = JSON.stringify(ss.getSheets().filter(s => /LOG/i.test(s.getName())).map(s => s.getDataRange().getValues()));
b.ok(/MOTIVO: ALGUNS SEM DESCONTO — MARIA SOUZA, ANA REIS/.test(log) && /MOTIVO: TODOS SEM DESCONTO/.test(log), "o log do sistema diz o motivo e quem");
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), cab = mem[0].map(String);
const rm = mem.filter(l => l[cab.indexOf("TAREFA")] === "reenvio-oficio-texto");
b.ok(rm.length >= 3 && rm[0][cab.indexOf("ACERTOU")] === "NAO", "a memória do robô guarda o texto proposto × o enviado (editado = não acertou)");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["Helpers.html", "OficiosStyles.html", "OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("REENVIO COM MOTIVO · a tela");
  const tr = doc.createElement("tr"); tr.setAttribute("data-numero", "144/2026"); tr.dataset.url = URL("144/2026");
  tr.innerHTML = "<td></td><td>144/2026</td><td>Filiação</td><td>COLEGIO ALFA</td>"; doc.body.appendChild(tr);
  win.Historico.reenviar("144/2026"); await t.assentar(250);
  b.ok(el("histReenvOverlay").classList.contains("aberto"), "a janela de reenvio abriu");
  b.ok(doc.querySelector("input[name='histReenvMotivo'][value='']").checked && el("histReenvObsBox").style.display === "none", "começa em \"Só reenviar\" — igual a antes");
  doc.querySelector("input[name='histReenvMotivo'][value='ALGUNS']").checked = true; win.Historico.motivoMudou(); await t.assentar(20);
  const caixas = Array.from(doc.querySelectorAll(".hist-reenv-pessoa"));
  b.igual(caixas.length, 3, "as 3 pessoas para marcar");
  b.ok(/MARIA SOUZA, JOÃO LIMA e ANA REIS/.test(el("histReenvObs").value), "o texto proposto já com os nomes", el("histReenvObs").value.slice(0, 140));
  caixas[1].checked = false; win.Historico.pessoaMudou(); await t.assentar(10);
  b.ok(/MARIA SOUZA e ANA REIS/.test(el("histReenvObs").value), "desmarcar o João tira ele do texto");
  b.ok(/Não vão neste reenvio.*JOAO_LIMA/.test(t.texto("#histReenvAnexosFora")), "e a lista de anexos diz que a ficha dele fica de fora", t.texto("#histReenvAnexosFora"));
  amb.outbox.length = 0;
  win.Historico.reenvioConfirmar(); await t.assentar(300);
  const ult = t.chamadas.filter(c => c.fn === "reenviarOficio").pop();
  b.ok(ult && ult.args[0].motivo === "ALGUNS" && ult.args[0].pessoas.join(",") === "MARIA SOUZA,ANA REIS" && /MARIA SOUZA e ANA REIS/.test(ult.args[0].observacao),
    "a tela mandou o motivo, quem e a observação", JSON.stringify(ult && ult.args[0].pessoas));
  b.ok(nomesAnexos().length === 3, "e saiu com o ofício + 2 fichas");
  b.naoTestavel("a entrega de verdade e a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
