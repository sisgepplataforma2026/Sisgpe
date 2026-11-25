/**
 * TESTE (TELA) — REENVIO DE OFÍCIO: "+ INCLUIR" E-MAIL E AVISO QUANDO TODOS OS ENDEREÇOS FALHARAM
 *
 * Pedido do usuário (25/11/2026), desenho docs/mock-reenvio-incluir-email.png. REGRA Nº -3: o recurso mora num ARQUIVO NOVO
 * (OficiosReenvioIncluir.html) que envolve dois métodos e não edita as funções vivas; este teste prova o recurso E que o que já
 * funcionava continua igual (e-mail digitado direto no campo, envio, lista de pessoas).
 * PROVA: DOM + o que a tela manda ao servidor (jsdom). NÃO PROVA: a aparência.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("REENVIO · incluir e-mail"); b.naoTestavel("tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* A prévia do servidor, controlada: escola em que TODOS os endereços já falharam (nenhum nasce marcado) — o caso do desenho A. */
let CENARIO = "todos-falharam";
g.preverReenvioOficio = function () {
  const falhou = e => ({ email: e, origem: "cadastro atual da escola", falhas: 1, confirmacoes: 0, marcado: false });
  const bom = e => ({ email: e, origem: "cadastro atual da escola", falhas: 0, confirmacoes: 2, marcado: true });
  return { ok: true, numero: "232/2026", tipo: "Filiação", escola: "MULTIVIX",
    destinatarios: CENARIO === "todos-falharam"
      ? [falhou("contabilidade@multivix.edu.br"), { email: "kristielle@multivix.edu.br", origem: "cadastro atual da escola", falhas: 0, confirmacoes: 0, marcado: false }, falhou("dp@multivix.edu.br")]
      : [bom("rh@multivix.edu.br"), falhou("dp@multivix.edu.br")],
    anexos: { itens: [{ nome: "Oficio_232.pdf", origem: "pacote original" }], temFicha: true, exigeFicha: false, erro: "" },
    motivo: { modelos: { ALGUNS: "…{PESSOAS}…", TODOS: "…", OUTRO: "" }, pessoas: [{ nome: "MARIA SOUZA" }, { nome: "ANA REIS" }] } };
};
let ultimoEnvio = null;
g.reenviarOficio = function (dados) { ultimoEnvio = dados; return { ok: true, mensagem: "Reenviado." }; };

const t = dom.montar(g, ["Helpers.html", "OficiosStyles.html", "OficiosFormulario.html", "OficiosScripts.html", "OficiosReenvioIncluir.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const dest = () => Array.from(doc.querySelectorAll(".hist-reenv-dest"));
const marcadosEmails = () => dest().filter(c => c.checked).map(c => c.getAttribute("data-email"));
function digitar(v) { el("histReenvExtra").value = v; el("histReenvExtra").dispatchEvent(new win.Event("input", { bubbles: true })); }
function incluir() { el("histReenvIncluirBtn").click(); }

(async function () {
  b.fluxo("REENVIO · incluir e-mail");
  const tr = doc.createElement("tr"); tr.setAttribute("data-numero", "232/2026"); tr.dataset.url = "https://drive.google.com/file/d/ARQ-232/view";
  tr.innerHTML = "<td></td><td>232/2026</td><td>Filiação</td><td>MULTIVIX</td>"; doc.body.appendChild(tr);

  b.passo("1. Caso A — todos os endereços falharam: aviso, nada marcado, Reenviar desativado");
  win.Historico.reenviar("232/2026"); await t.assentar(250);
  b.ok(el("histReenvOverlay").classList.contains("aberto"), "a janela abriu");
  b.igual(dest().length, 3, "os 3 endereços da escola, com o histórico");
  b.ok(/falha\(s\) de entrega/.test(t.texto("#histReenvDestinos")) && /sem histórico/.test(t.texto("#histReenvDestinos")), "cada um com a falha ou 'sem histórico' à vista");
  b.igual(marcadosEmails().length, 0, "nenhum nasce marcado");
  b.ok(el("histReenvAvisoTodos").style.display === "block" && /Todos os endereços desta escola já falharam/.test(t.texto("#histReenvAvisoTodos")), "aviso amarelo");
  b.ok(el("histReenvOk").disabled === true, "Reenviar desativado sem destino");
  b.ok(!!el("histReenvIncluirBtn") && /\+ Incluir/.test(el("histReenvIncluirBtn").textContent), "botão '+ Incluir'");
  b.ok(/Inclua um endereço que receba, ou desmarque a falha só se tiver certeza\./.test(t.texto("#histReenvAvisoTodos")), "o texto do aviso é o do desenho, palavra por palavra");
  b.ok(/digite o e-mail \(vários: separe por vírgula\)/.test(el("histReenvExtra").placeholder), "placeholder do desenho");
  b.ok(el("histReenvExtra").style.borderColor !== "", "campo com a borda laranja do desenho A");
  b.ok(el("histReenvNovos").compareDocumentPosition(el("histReenvDestinos")) & win.Node.DOCUMENT_POSITION_FOLLOWING, "o espaço dos e-mails incluídos fica ACIMA da lista (desenho B)");

  b.passo("2. E-mail com formato errado: recusa, com a mensagem, e NÃO entra na lista");
  digitar("natalia.souza@"); incluir(); await t.assentar(30);
  b.ok(/não é um e-mail válido/.test(t.texto("#histReenvIncluirMsg")) && /natalia\.souza@/.test(t.texto("#histReenvIncluirMsg")), "mensagem de erro", t.texto("#histReenvIncluirMsg"));
  b.igual(dest().length, 3, "a lista não ganhou nada");
  b.igual(el("histReenvExtra").value, "natalia.souza@", "o texto fica no campo para corrigir");
  b.ok(/E-mail já na lista não é incluído de novo; ele só é recusado se estiver com o formato errado\./.test(t.texto("#histReenvIncluirNota")) && el("histReenvIncluirNota").style.display === "block", "a nota cinza do desenho B aparece sob o erro");
  b.ok(el("histReenvOk").disabled === true, "continua sem destino válido");

  b.passo("3. E-mail certo: entra marcado, com NOVO e 'remover'; o aviso some; Reenviar ativa");
  digitar("natalia.souza@multivix.edu.br"); incluir(); await t.assentar(30);
  b.ok(marcadosEmails().indexOf("natalia.souza@multivix.edu.br") > -1, "entrou MARCADO");
  b.ok(/NOVO/.test(t.texto("#histReenvNovos")) && /digitado agora por você/.test(t.texto("#histReenvNovos")) && /remover/.test(t.texto("#histReenvNovos")), "com NOVO, 'digitado agora por você' e 'remover'");
  b.igual(el("histReenvExtra").value, "", "o campo esvaziou");
  b.ok(el("histReenvAvisoTodos").style.display === "none", "o aviso sumiu");
  b.ok(el("histReenvOk").disabled === false, "Reenviar ativo");

  b.passo("4. Repetido não duplica (e marca o que já estava); vários separados por vírgula");
  digitar("dp@multivix.edu.br"); incluir(); await t.assentar(30);
  b.igual(dest().filter(c => c.getAttribute("data-email") === "dp@multivix.edu.br").length, 1, "não duplicou");
  b.ok(marcadosEmails().indexOf("dp@multivix.edu.br") > -1 && /já estava na lista/.test(t.texto("#histReenvIncluirMsg")), "marcou o que já existia e disse isso");
  digitar("a@x.com, b@x.com , isso-nao"); incluir(); await t.assentar(30);
  b.ok(marcadosEmails().indexOf("a@x.com") > -1 && marcadosEmails().indexOf("b@x.com") > -1, "os dois certos entraram");
  b.igual(el("histReenvExtra").value, "isso-nao", "o errado ficou no campo");

  b.passo("5. 'remover' tira o NOVO; sem destino o botão desativa de novo");
  Array.from(doc.querySelectorAll(".hist-reenv-remover")).forEach(x => x.click()); await t.assentar(20);
  dest().forEach(c => { c.checked = false; }); el("histReenvExtra").value = ""; dest()[0].dispatchEvent(new win.Event("change", { bubbles: true }));
  b.igual(doc.querySelectorAll(".hist-reenv-remover").length, 0, "os NOVOs saíram");
  b.ok(el("histReenvOk").disabled === true && el("histReenvAvisoTodos").style.display === "block", "sem destino: Reenviar desativado e o aviso volta");

  b.passo("6. O ENVIO leva o que foi marcado + o NOVO (o envio existente não mudou)");
  digitar("natalia.souza@multivix.edu.br"); incluir(); await t.assentar(30);
  dest().filter(c => c.getAttribute("data-email") === "kristielle@multivix.edu.br")[0].checked = true;
  win.Historico.reenvioConfirmar(); await t.assentar(300);
  b.ok(ultimoEnvio && ultimoEnvio.numero === "232/2026", "chamou reenviarOficio do ofício certo");
  b.igual(JSON.stringify((ultimoEnvio.destinatarios || []).slice().sort()), JSON.stringify(["kristielle@multivix.edu.br", "natalia.souza@multivix.edu.br"]), "destinatários = o marcado da lista + o NOVO", JSON.stringify(ultimoEnvio.destinatarios));

  b.passo("7. NADA do que existia muda: digitar no campo e clicar direto em Reenviar (sem '+ Incluir') funciona como antes");
  ultimoEnvio = null;
  win.Historico.reenviar("232/2026"); await t.assentar(250);
  dest().filter(c => c.getAttribute("data-email") === "kristielle@multivix.edu.br")[0].checked = true;
  digitar("direto@escola.com");
  b.ok(el("histReenvOk").disabled === false, "Reenviar ativo");
  win.Historico.reenvioConfirmar(); await t.assentar(300);
  b.igual(JSON.stringify((ultimoEnvio.destinatarios || []).slice().sort()), JSON.stringify(["direto@escola.com", "kristielle@multivix.edu.br"]), "o e-mail digitado direto também vai", JSON.stringify(ultimoEnvio && ultimoEnvio.destinatarios));

  b.passo("8. Reabrir limpa o que a janela anterior acrescentou");
  win.Historico.reenviar("232/2026"); await t.assentar(250);
  b.ok(doc.querySelectorAll("#histReenvNovos label").length === 0 && el("histReenvIncluirMsg").style.display === "none", "sem NOVOs nem mensagem antiga");

  b.passo("9. Caso B — escola com endereço bom: sem aviso, já marcado, Reenviar ativo");
  CENARIO = "bom";
  win.Historico.reenviar("232/2026"); await t.assentar(250);
  b.ok(el("histReenvAvisoTodos").style.display === "none" && marcadosEmails().length === 1 && el("histReenvOk").disabled === false, "tudo como antes: sem aviso, marcado o que recebe, Reenviar ativo");

  b.passo("10. A lista das pessoas (motivo) segue intacta");
  doc.querySelector("input[name='histReenvMotivo'][value='ALGUNS']").checked = true; win.Historico.motivoMudou(); await t.assentar(20);
  b.ok(doc.querySelectorAll(".hist-reenv-pessoa").length === 2, "as 2 pessoas continuam para marcar");
  b.resumo();
})();
