/**
 * TELA — Pedidos de voucher por e-mail (VoucherPedidosEmailUI.html).
 *
 * DOM real (jsdom), backend real (gas.js), cliques reais. A caixa e a IA são
 * as simuladas de vpe-simulador.js.
 *
 * O QUE ESTE ARQUIVO PROVA, em ordem de importância:
 *   1. Que "Validar e enviar" manda o que está NO CAMPO, com o token.
 *   2. Que validar COM pendência não sai no primeiro clique: pede a
 *      justificativa, e só o segundo clique envia — com ela junto.
 *   3. Que o pedido de complemento envia o texto EDITADO, não o sugerido.
 *   4. Que cada estado mostra só os botões que fazem sentido (não associado
 *      não tem "Validar"; concluído não tem ação nenhuma).
 *   5. Que a origem de cada campo aparece ao lado dele.
 *
 * NÃO PROVA, e continua "não testado" pela REGRA Nº -1: aparência, CSS (o
 * jsdom não aplica folha de estilo), a prévia do PDF no iframe e o
 * Apps Script de verdade.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("PEDIDOS POR E-MAIL · Tela");
  b.naoTestavel("tela de pedidos por e-mail", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
shA.appendRow(["11144477735", "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow(["52998224725", "BEATRIZ LIMA COSTA", "SIM", "bia@exemplo.com", "27999990002", "ESCOLA BETA"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { EXTRACOES, novaThread, CC, RG, base } = SIM;

EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: "" },
  anexos: [CC("ANA MARIA SOUZA", "11144477735", "09/2026", "COLEGIO ALFA LTDA"), RG(2, "ANA MARIA SOUZA", "11144477735")] });
novaThread("Voucher", "ana@exemplo.com", "Voucher de Pedagogia 2027/1. CASO:ANA", [SIM.pdf("cc.pdf"), SIM.jpg("rg.jpg")]);
EXTRACOES.BIA = base({ titular: { nome: "Beatriz Lima Costa", cpf: "52998224725" }, curso: "Enfermagem", area: "SAUDE",
  anexos: [RG(1, "BEATRIZ LIMA COSTA", "52998224725")] });
novaThread("Bolsa", "bia@exemplo.com", "Voucher 2027/1 Enfermagem. CASO:BIA", [SIM.jpg("rg.jpg")]);
EXTRACOES.FORA = base({ titular: { nome: "Fulano Fora", cpf: "15350946056" },
  anexos: [CC("FULANO FORA", "15350946056", "09/2026", "ESCOLA Z"), RG(2, "FULANO FORA", "15350946056")] });
novaThread("voucher", "fulano@exemplo.com", "Voucher da faculdade. CASO:FORA", [SIM.pdf("a.pdf"), SIM.pdf("b.pdf")]);
SIM.ciclo();                       // o leitor, na conta da Secretaria, copia para a ponte
g.voucherPedidosLerAgora(TOKEN);
const idDe = email => g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === email).ID_PEDIDO;

const t = dom.montar(g, ["VoucherPedidosEmailUI.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
const el = id => doc.getElementById(id);
const botao = rot => Array.from(doc.querySelectorAll("#vpeMAcoes button")).find(x => x.textContent.trim() === rot);
const rotulos = () => Array.from(doc.querySelectorAll("#vpeMAcoes button")).map(x => x.textContent.trim());

(async function () {
  b.fluxo("PEDIDOS POR E-MAIL · Tela · 1. O painel");
  win.VPE.carregar();
  await t.assentar(60);

  b.passo("1. Os cards mostram a fila");
  const cards = Array.from(doc.querySelectorAll("#vpeCards .vpe-card")).map(c => c.textContent.replace(/\s+/g, " ").trim());
  b.ok(cards.some(c => /^1\D.*Prontos para validar/.test(c)), "1 pronto", cards.join(" | "));
  b.ok(cards.some(c => /^1\D.*Falta documento/.test(c)), "1 com falta de documento");
  b.ok(cards.some(c => /^1\D.*Não encontrado/.test(c)), "1 não encontrado");
  b.igual(doc.querySelectorAll("#vpeLista .vpe-item").length, 3, "e a lista traz os 3");
  b.ok(/2026\/2 e 2027\/1/.test(t.texto("#vpeSub")), "o topo diz os semestres abertos");
  b.ok(t.chamadas.some(c => c.fn === "voucherPedidosPainel" && c.args[c.args.length - 1] === TOKEN), "com o token de sessão");

  b.passo("1b. Leitura automática desligada: o administrador liga pela tela");
  const btnG = el("vpeBtnGatilho");
  b.ok(btnG && btnG.style.display !== "none", "o botão 'Ligar leitura automática' aparece para o administrador");
  t.clicar(btnG);
  await t.assentar(80);
  const lig = t.chamadas.filter(c => c.fn === "instalarGatilhoVoucherPedidosEmail").pop();
  b.ok(lig && lig.args[lig.args.length - 1] === TOKEN, "chama o instalador com o token de sessão");
  b.igual(amb.triggers.filter(x => x.fn === "voucherPedidosLerCaixaAgendado").length, 1, "e o gatilho foi criado");
  b.ok(el("vpeBtnGatilho").style.display === "none", "e o botão some depois de ligado");

  b.passo("2. Clicar num card filtra; clicar de novo desfaz");
  t.clicar(Array.from(doc.querySelectorAll("#vpeCards .vpe-card")).find(c => /Falta documento/.test(c.textContent)));
  b.igual(doc.querySelectorAll("#vpeLista .vpe-item").length, 1, "só o de falta de documento");
  t.clicar(Array.from(doc.querySelectorAll("#vpeCards .vpe-card")).find(c => /Falta documento/.test(c.textContent)));
  b.igual(doc.querySelectorAll("#vpeLista .vpe-item").length, 3, "e volta aos 3");

  b.fluxo("PEDIDOS POR E-MAIL · Tela · 2. O pedido pronto");
  b.passo("3. Abrir mostra a conversa, os anexos e a origem de cada campo");
  win.VPE.abrir(idDe("ana@exemplo.com"));
  await t.assentar(60);
  b.ok(el("vpeModal").classList.contains("aberto"), "o modal abriu");
  b.ok(/Pedagogia 2027\/1/.test(t.texto("#vpeMMensagens")), "a mensagem da associada aparece");
  b.igual(doc.querySelectorAll("#vpeMAnexos .vpe-anexo").length, 2, "os 2 anexos listados");
  b.ok(/contracheque/.test(t.texto("#vpeMAnexos")), "com o tipo que a IA identificou");
  const cpfCampo = doc.querySelector("#vpeMCampos [data-k='cpf']");
  b.igual(cpfCampo.value, "11144477735", "CPF preenchido");
  b.ok(/lido no documento anexo/.test(cpfCampo.parentNode.textContent), "com a origem ao lado");
  b.ok(/70%/.test(t.texto("#vpeMPct")), "percentual pela regra da convenção");
  b.ok(/Tudo conferido/.test(t.texto("#vpeMPend")), "sem pendência, diz que está tudo conferido");
  b.ok(botao("Validar e enviar certificado"), "botão de validar e enviar", rotulos().join(", "));
  b.ok(!botao("Encaminhar à sede"), "sem botão de sede num associado");

  b.passo("4. Validar manda o que está NO CAMPO");
  t.digitar(doc.querySelector("#vpeMCampos [data-k='rg']"), "9.999.999");
  t.clicar(botao("Validar e enviar certificado"));
  await t.assentar(80);
  const val = t.chamadas.filter(c => c.fn === "voucherPedidosValidarEnviar").pop();
  b.ok(val, "a tela chamou voucherPedidosValidarEnviar");
  b.igual(val && val.args[1].rg, "9.999.999", "com o RG corrigido na tela");
  b.ok(val && val.args[3] === TOKEN, "e o token");
  b.igual(g.vpeLinhas_().find(r => r.REMETENTE_EMAIL === "ana@exemplo.com").ESTADO, "CONCLUIDO", "o pedido foi concluído");
  b.ok(!el("vpeModal").classList.contains("aberto"), "e o modal fechou");

  b.fluxo("PEDIDOS POR E-MAIL · Tela · 3. Falta documento");
  b.passo("5. A resposta sugerida aparece e pode ser editada");
  win.VPE.abrir(idDe("bia@exemplo.com"));
  await t.assentar(60);
  b.ok(/último contracheque/.test(el("vpeMResposta").value), "a resposta pede o contracheque");
  b.ok(/Último contracheque não anexado/.test(t.texto("#vpeMPend")), "a pendência aparece");
  b.ok(botao("Enviar pedido de complemento") && botao("Validar mesmo assim"), "os dois caminhos", rotulos().join(", "));

  b.passo("6. Validar com pendência pede justificativa antes");
  const antes = t.chamadas.filter(c => c.fn === "voucherPedidosValidarEnviar").length;
  t.clicar(botao("Validar mesmo assim"));
  await t.assentar(30);
  b.igual(t.chamadas.filter(c => c.fn === "voucherPedidosValidarEnviar").length, antes, "o primeiro clique NÃO envia");
  b.ok(el("vpeMJustBox").style.display !== "none", "mostra o campo de justificativa");
  b.ok(/validar com pendência/.test(t.texto("#vpeMJustTitulo")), "perguntando por que validar");

  b.passo("7. O complemento envia o texto EDITADO");
  el("vpeMResposta").value = "Olá, Beatriz! Falta só o contracheque de setembro. Obrigada!";
  t.clicar(botao("Enviar pedido de complemento"));
  await t.assentar(80);
  const resp = t.chamadas.filter(c => c.fn === "voucherPedidosResponder").pop();
  b.igual(resp && resp.args[1], "COMPLEMENTO", "tipo complemento");
  b.igual(resp && resp.args[2], "Olá, Beatriz! Falta só o contracheque de setembro. Obrigada!", "com o texto editado");
  SIM.ciclo();                     // e o leitor envia o que ficou na fila
  const saiu = amb.outbox.filter(m => m.via === "reply" && m.to === "bia@exemplo.com").pop();
  b.ok(saiu && /contracheque de setembro/.test(saiu.htmlBody), "e foi isso que saiu no e-mail");

  b.fluxo("PEDIDOS POR E-MAIL · Tela · 4. Não encontrado");
  b.passo("8. Sem Validar; com sede e confirmar associado");
  win.VPE.abrir(idDe("fulano@exemplo.com"));
  await t.assentar(60);
  b.ok(!botao("Validar e enviar certificado") && !botao("Validar mesmo assim"), "não há botão de validar",
    rotulos().join(", "));
  b.ok(botao("Encaminhar à sede") && botao("Confirmar que é associado"), "há sede e confirmar associado");
  b.ok(/9h às 10h/.test(el("vpeMResposta").value), "a resposta traz o horário da sede");

  b.passo("9. Descartar pede o motivo antes");
  const nDesc = t.chamadas.filter(c => c.fn === "voucherPedidosDescartar").length;
  t.clicar(botao("Descartar"));
  await t.assentar(30);
  b.igual(t.chamadas.filter(c => c.fn === "voucherPedidosDescartar").length, nDesc, "o primeiro clique não descarta");
  b.ok(/descartar/i.test(t.texto("#vpeMJustTitulo")), "pergunta o motivo do descarte");
  el("vpeMJust").value = "e-mail duplicado";
  t.clicar(botao("Descartar"));
  await t.assentar(60);
  const desc = t.chamadas.filter(c => c.fn === "voucherPedidosDescartar").pop();
  b.igual(desc && desc.args[1], "e-mail duplicado", "o segundo clique descarta com o motivo");

  b.fluxo("PEDIDOS POR E-MAIL · Tela · 5. Concluído");
  b.passo("10. Pedido concluído não tem ação, e os campos ficam travados");
  win.VPE.abrir(idDe("ana@exemplo.com"));
  await t.assentar(60);
  b.igual(rotulos(), ["Fechar"], "só o botão de fechar");
  b.ok(doc.querySelector("#vpeMCampos [data-k='cpf']").disabled, "campos travados");

  b.naoTestavel("aparência, CSS e a prévia do PDF no iframe", "jsdom não desenha — conferir no navegador");
  b.resumo();
})();
