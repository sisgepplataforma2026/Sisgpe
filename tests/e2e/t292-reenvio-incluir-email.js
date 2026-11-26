/**
 * REENVIO DE OFÍCIO · "+ Incluir" e o aviso de "nenhum endereço marcado" (desenho aprovado em 25/11/2026).
 * Antes: o e-mail digitado só entrava no envio ao clicar em Reenviar, sem aparecer na lista nem ser conferido.
 * Agora: botão Incluir valida (formato, repetido), o endereço entra na lista marcado e com a etiqueta NOVO,
 * dá para remover, sobrevive à prévia refeita, e o que ficou digitado passa pela mesma conferência ao enviar.
 * jsdom prova a LÓGICA da tela; aparência (cor, posição) NÃO TESTÁVEL aqui.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 8).setValues([["Número do Ofício", "Tipo", "Escola", "E-mail (principal)", "E-mails (todos)", "Link Ficha", "Status", "Colaborador(es)"]]);
reg.getRange(2, 1, 1, 8).setValues([["232/2026", "Filiação", "COLEGIO ALFA", "rh@alfa.exemplo.com", "rh@alfa.exemplo.com, dp@alfa.exemplo.com", "", "ENVIADO", "1. MARIA SOUZA"]]);
if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["Helpers.html", "OficiosStyles.html", "OficiosFormulario.html", "OficiosScripts.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const caixas = () => Array.from(doc.querySelectorAll(".hist-reenv-dest"));
const emails = () => caixas().map(c => c.dataset.email);
const marcados = () => caixas().filter(c => c.checked).map(c => c.dataset.email);
const enviados = () => t.chamadas.filter(c => c.fn === "reenviarOficio");

(async function () {
  b.fluxo("REENVIO · Incluir e-mail");
  const tr = doc.createElement("tr"); tr.setAttribute("data-numero", "232/2026"); tr.dataset.url = "https://drive.google.com/file/d/x/view";
  tr.innerHTML = "<td></td><td>232/2026</td><td>Filiação</td><td>COLEGIO ALFA</td>"; doc.body.appendChild(tr);
  win.Historico.reenviar("232/2026"); await t.assentar(300);
  b.passo("1. a janela abre com os endereços do ofício");
  b.ok(el("histReenvOverlay").classList.contains("aberto"), "a janela de reenvio abriu");
  b.ok(emails().indexOf("rh@alfa.exemplo.com") >= 0 && emails().indexOf("dp@alfa.exemplo.com") >= 0, "mostra os endereços do ofício", emails().join(", "));
  const base = emails().length;
  b.ok(marcados().length === base && el("histReenvSemEndereco").style.display === "none", "sem falha de entrega, vêm marcados e sem aviso");

  b.passo("2. aviso quando nenhum endereço está marcado");
  caixas().forEach(c => { c.checked = false; }); win.Historico.destMudou();
  b.ok(el("histReenvSemEndereco").style.display === "block" && /Nenhum endereço marcado/.test(el("histReenvSemEndereco").textContent), "desmarcar todos mostra o aviso", el("histReenvSemEndereco").textContent.slice(0, 80));
  b.ok(el("histReenvExtra").style.borderColor && Number(el("histReenvOk").style.opacity) === 0.45, "o campo de incluir fica destacado e o Reenviar apagado");
  caixas().forEach(c => { c.dataset.falhas = "1"; }); win.Historico.destMudou();
  b.ok(/Todos os endereços desta escola já falharam/.test(el("histReenvSemEndereco").textContent), "com todos em falha, o aviso diz que todos já falharam");
  caixas()[0].checked = true; win.Historico.destMudou();
  b.ok(el("histReenvSemEndereco").style.display === "none" && el("histReenvOk").style.opacity === "", "marcar um tira o aviso e acende o botão");
  caixas()[0].checked = false; win.Historico.destMudou();

  b.passo("3. Incluir: validação");
  el("histReenvExtra").value = ""; win.Historico.incluirEmail();
  b.ok(/Digite o e-mail/.test(el("histReenvExtraErro").textContent), "campo vazio pede o e-mail");
  el("histReenvExtra").value = "natalia.souza@"; const okInv = win.Historico.incluirEmail();
  b.ok(okInv === false && emails().indexOf("natalia.souza@") < 0 && /não é um e-mail válido/.test(el("histReenvExtraErro").textContent), "e-mail com formato errado é recusado, com a mensagem", el("histReenvExtraErro").textContent);
  b.ok(el("histReenvExtra").value === "natalia.souza@", "e o texto fica no campo para corrigir");
  b.passo("4. Incluir: entra na lista");
  el("histReenvExtra").value = "natalia.souza@multivix.edu.br"; const okVal = win.Historico.incluirEmail();
  b.ok(okVal === true && emails()[0] === "natalia.souza@multivix.edu.br", "e-mail válido entra no TOPO da lista");
  b.ok(marcados().indexOf("natalia.souza@multivix.edu.br") >= 0, "já entra marcado");
  b.ok(/NOVO/.test(doc.querySelector(".hist-reenv-novo").textContent) && /digitado agora/.test(doc.querySelector(".hist-reenv-novo").textContent), "com a etiqueta NOVO e a origem 'digitado agora'");
  b.ok(el("histReenvExtra").value === "" && el("histReenvExtraErro").style.display === "none", "o campo esvazia e o erro some");
  b.ok(el("histReenvSemEndereco").style.display === "none", "e o aviso de 'nenhum marcado' some");
  el("histReenvExtra").value = "NATALIA.souza@multivix.edu.br"; win.Historico.incluirEmail();
  b.igual(emails().filter(e => e.toLowerCase() === "natalia.souza@multivix.edu.br").length, 1, "repetido (mesmo com outra caixa) não entra duas vezes");
  b.ok(/já está na lista/.test(el("histReenvExtraErro").textContent), "e a tela diz que já estava", el("histReenvExtraErro").textContent);
  el("histReenvExtra").value = "dp@alfa.exemplo.com"; caixas().find(c => c.dataset.email === "dp@alfa.exemplo.com").checked = false; win.Historico.incluirEmail();
  b.ok(caixas().find(c => c.dataset.email === "dp@alfa.exemplo.com").checked, "digitar um que já está na lista, desmarcado, o MARCA");
  el("histReenvExtra").value = "a@x.com; b@x.com, c@x.com"; win.Historico.incluirEmail();
  b.ok(["a@x.com", "b@x.com", "c@x.com"].every(e => emails().indexOf(e) >= 0), "vários de uma vez, separados por vírgula, ponto e vírgula ou espaço");

  b.passo("5. remover e refazer a prévia");
  win.Historico.removerDigitado("c@x.com");
  b.ok(emails().indexOf("c@x.com") < 0, "'remover' tira da lista");
  win.Historico._reenvioPrever(); await t.assentar(300);
  b.ok(emails().indexOf("natalia.souza@multivix.edu.br") >= 0 && emails().indexOf("a@x.com") >= 0 && emails().indexOf("c@x.com") < 0, "refazer a prévia (ex.: ao anexar documento) não perde os incluídos");

  b.passo("6. o envio leva o que a lista mostra");
  const antes = enviados().length;
  el("histReenvExtra").value = "ficou.digitado@x.com";
  /* a regra da ficha faltando (segundo clique consciente) é de outro teste (t144); aqui o foco é o endereço */
  win.Historico._reenvioCtx.anexosOk = true;
  win.Historico.reenvioConfirmar(); await t.assentar(400);
  const u = enviados().pop();
  b.ok(enviados().length >= 1 && u, "o reenvio foi pedido ao servidor");
  const dest = (u && u.args[0].destinatarios) || [];
  b.ok(dest.indexOf("natalia.souza@multivix.edu.br") >= 0 && dest.indexOf("a@x.com") >= 0 && dest.indexOf("b@x.com") >= 0, "vão os marcados, inclusive os incluídos", dest.join(", "));
  b.ok(dest.indexOf("ficou.digitado@x.com") >= 0, "o que ficou digitado e não foi incluído passa pela mesma conferência e vai também");
  b.ok(dest.indexOf("c@x.com") < 0, "o removido não vai");

  b.passo("7. texto inválido no campo bloqueia o envio");
  win.Historico.reenviar("232/2026"); await t.assentar(300);
  const n0 = enviados().length;
  el("histReenvExtra").value = "isso-nao-e-email";
  win.Historico._reenvioCtx.anexosOk = true;
  win.Historico.reenvioConfirmar(); await t.assentar(300);
  b.igual(enviados().length, n0, "e-mail inválido ainda no campo impede o envio");
  b.ok(/não é um e-mail válido/.test(el("histReenvExtraErro").textContent), "e a tela explica por quê");
  b.passo("8. reabrir não herda o que foi incluído antes");
  win.Historico.reenvioFechar(); win.Historico.reenviar("232/2026"); await t.assentar(300);
  b.ok(emails().indexOf("natalia.souza@multivix.edu.br") < 0 && el("histReenvExtra").value === "" && el("histReenvExtraErro").style.display === "none", "nova abertura começa limpa");
  b.naoTestavel("aparência (cor do aviso âmbar, posição do botão, etiqueta NOVO)", "jsdom não desenha — conferir em HML");
  b.naoTestavel("entrega do e-mail ao endereço incluído", "só no ar");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
