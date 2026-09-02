/**
 * t141 — A CONFERÊNCIA DE DESTINATÁRIOS, ENTRE EMITIR E ENVIAR
 *
 * Pedido do usuário em 02/09/2026: "deveria ter um seletor após a emissão e
 * antes do envio para excluir ou incluir email". Perguntado se valia sempre ou
 * só quando houvesse pendência, respondeu: **sempre**.
 *
 * O QUE MOTIVOU. O Monitoramento da produção mostrou 42 falhas de entrega em
 * 23 endereços — e quinze delas eram DOIS endereços mortos, para os quais o
 * sistema mandou de março a setembro sem nada parar. O contato certo estava na
 * própria base, em ofícios confirmados da mesma escola.
 *
 * A ASSERÇÃO QUE MAIS IMPORTA É A DO PASSO 2. Se a fila passar a pegar o que
 * ainda não foi conferido, a funcionalidade inteira vira decoração e o ofício
 * sai pelo endereço errado como antes — sem ninguém perceber, porque tudo o
 * mais continua funcionando.
 */

const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

/* ── um Registro com histórico real, no formato da produção ───────────── */
const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
let reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 4).setValues([["Número do Ofício", "Escola", "E-mails (todos)", "Status"]]);
const FAESA = "FUNDACAO DE ASSISTENCIA E EDUCACAO - FAESA";
reg.getRange(2, 1, 6, 4).setValues([
  ["144/2026", FAESA, "thalia.ferreira@faesa.br", "FALHA_ENTREGA"],
  ["236/2026", FAESA, "thalia.ferreira@faesa.br", "FALHA_ENTREGA"],
  ["242/2026", FAESA, "thalia.ferreira@faesa.br", "FALHA_ENTREGA"],
  ["286/2026", FAESA, "luiza.stefani@faesa.br",   "CONFIRMADO"],
  ["471/2026", FAESA, "luiza.stefani@faesa.br",   "CONFIRMADO"],
  ["999/2026", "OUTRA ESCOLA", "x@outra.br",      "CONFIRMADO"]
]);
g._headerCache = {};
g.ofDest_cacheHistorico_ = null;

/* ── um ofício emitido, como a emissão o deixa ────────────────────────── */
const criado = g.criarFilaEnvioOficio_({
  numeroOficio: "489/2026", tipo: "Filiação", escola: FAESA, cnpj: "",
  emailPrincipal: "thalia.ferreira@faesa.br",
  emailsTodos: "thalia.ferreira@faesa.br;luiza.stefani@faesa.br",
  assunto: "Ofício 489/2026", htmlBody: "<p>corpo</p>", anexos: []
});
const FILA_ID = criado.id;

b.fluxo("DESTINATÁRIOS · o ofício nasce parado, esperando conferência");

b.passo("1. emitido, ele NÃO entra na fila de envio");
const fila = g.obterOuCriarAbaFilaOficios_();
const hmF = g.getHeaderMap_(fila);
function statusNaFila() {
  const d = fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).getValues();
  for (let i = 0; i < d.length; i++) {
    if (String(d[i][hmF["ID"] - 1]) === FILA_ID) return String(d[i][hmF["STATUS"] - 1]).toUpperCase();
  }
  return "(não achado)";
}
b.igual(statusNaFila(), "AGUARDANDO_DESTINATARIOS",
  "nasce aguardando conferência, não PENDENTE");

b.passo("2. E O MOTOR DE ENVIO NÃO O PEGA — é a asserção que sustenta tudo");
/* Se esta cair, a conferência vira decoração: o ofício sai pelo endereço
   errado exatamente como antes, e nada mais falha para avisar. */
amb.reset();
const rodada = g.processarFilaEnvioOficios();
b.igual(amb.outbox.length, 0, "nenhum e-mail saiu");
b.igual(rodada.enviados, 0, "a fila processou zero envios");
b.igual(statusNaFila(), "AGUARDANDO_DESTINATARIOS", "e a linha continua parada");

b.fluxo("DESTINATÁRIOS · a tela mostra o que o sistema já sabe");

b.passo("3. o ofício aparece na lista de aguardando");
const lista = g.oficiosAguardandoDestinatarios(token);
b.ok(lista.ok === true, "a lista responde");
b.igual(lista.itens.length, 1, "um ofício aguardando");
b.igual(lista.itens[0].numero, "489/2026", "e é o 489");
b.igual(lista.itens[0].comAlerta, 1, "com um destinatário sinalizado");

b.passo("4. cada endereço vem com o histórico AO LADO");
/* É o item 62 resolvido no lugar certo: o sistema já tinha os dois dados e não
   os cruzava — descobrir isso exigia ler 347 linhas do Monitoramento. */
const det = g.destinatariosDoOficio(FILA_ID, token);
const porEmail = {};
det.destinatarios.forEach(function (d) { porEmail[d.email] = d; });

b.igual(porEmail["thalia.ferreira@faesa.br"].falhas, 3, "o morto mostra 3 falhas");
b.igual(porEmail["luiza.stefani@faesa.br"].confirmacoes, 2, "o vivo mostra 2 confirmações");

b.passo("5. quem já quicou vem DESMARCADO — mas não some da lista");
/* Sumir seria decidir pela pessoa. Desmarcado com o motivo à vista é informar. */
b.igual(porEmail["thalia.ferreira@faesa.br"].marcado, false, "o que quicou vem desmarcado");
b.igual(porEmail["luiza.stefani@faesa.br"].marcado, true, "o que confirmou vem marcado");
b.igual(det.destinatarios.length, 2, "e os dois continuam visíveis");

b.passo("6. e sugere o endereço vivo da MESMA escola");
const outro = g.criarFilaEnvioOficio_({
  numeroOficio: "490/2026", tipo: "Filiação", escola: FAESA, cnpj: "",
  emailPrincipal: "thalia.ferreira@faesa.br", emailsTodos: "thalia.ferreira@faesa.br",
  assunto: "Ofício 490/2026", htmlBody: "<p>x</p>", anexos: []
});
const det2 = g.destinatariosDoOficio(outro.id, token);
b.ok(det2.sugestoes.some(function (s) { return s.email === "luiza.stefani@faesa.br"; }),
  "sugere luiza.stefani@faesa.br, que confirmou 2 ofícios da FAESA");
b.ok(!det2.sugestoes.some(function (s) { return s.email === "x@outra.br"; }),
  "e NÃO sugere endereço de outra escola");

b.fluxo("DESTINATÁRIOS · liberar é o que coloca na fila");

b.passo("7. liberado com um endereço só, o ofício entra na fila");
const lib = g.liberarEnvioOficio(FILA_ID, ["luiza.stefani@faesa.br"], false, token);
b.ok(lib.ok === true, "liberou", lib.mensagem);
b.igual(statusNaFila(), "PENDENTE", "agora sim está PENDENTE");

b.passo("8. e o destinatário gravado é SÓ o escolhido");
/* O endereço morto foi excluído desta emissão — é o ponto todo. */
const d2 = fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).getValues();
let linha489 = null;
d2.forEach(function (l) { if (String(l[hmF["ID"] - 1]) === FILA_ID) linha489 = l; });
b.ok(String(linha489[hmF["EMAILS_TODOS"] - 1]).indexOf("luiza.stefani@faesa.br") > -1,
  "o escolhido está lá");
b.ok(String(linha489[hmF["EMAILS_TODOS"] - 1]).indexOf("thalia.ferreira") === -1,
  "e o excluído NÃO está");

b.passo("9. agora a fila envia — e para o endereço certo");
amb.reset();
g.processarFilaEnvioOficios();
b.igual(amb.outbox.length, 1, "um e-mail saiu");
b.ok(String(amb.outbox[0].to).indexOf("luiza.stefani@faesa.br") > -1,
  "para o endereço vivo", String(amb.outbox[0].to));

b.fluxo("DESTINATÁRIOS · as recusas que evitam estrago");

b.passo("10. sem nenhum endereço, recusa — em vez de falhar na fila depois");
const semNinguem = g.liberarEnvioOficio(outro.id, [], false, token);
b.igual(semNinguem.ok, false, "recusa liberar sem destinatário");
b.ok(/Sem destinat/i.test(semNinguem.mensagem), "e diz por quê", semNinguem.mensagem);

b.passo("11. liberar duas vezes não duplica o envio");
/* Duas abas abertas colocariam o mesmo ofício na fila duas vezes. */
const denovo = g.liberarEnvioOficio(FILA_ID, ["luiza.stefani@faesa.br"], false, token);
b.igual(denovo.ok, false, "a segunda liberação é recusada");
b.ok(/não está aguardando/i.test(denovo.mensagem), "dizendo o status atual", denovo.mensagem);

b.passo("12. cancelar tira da fila sem reaproveitar o número");
const canc = g.cancelarOficioAguardando(outro.id, "endereço não confere", token);
b.ok(canc.ok === true, "cancelou", canc.mensagem);
b.ok(/não é reaproveitado/i.test(canc.mensagem),
  "e avisa que o número emitido não volta",
  "numeração de ofício é sequencial — buraco é melhor que número repetido");

b.fluxo("DESTINATÁRIOS · as quatro funções têm porta");

b.passo("13. sem sessão, nenhuma delas responde");
/* São funções que LEEM dado de escola e ESCREVEM na fila. Sem porta, entrariam
   na contagem de exposição, que está no teto. */
[["oficiosAguardandoDestinatarios", []],
 ["destinatariosDoOficio", [FILA_ID]],
 ["liberarEnvioOficio", [FILA_ID, ["a@b.com"], false]],
 ["cancelarOficioAguardando", [FILA_ID, "motivo"]]
].forEach(function (par) {
  let recusou = false, msg = "";
  try { g[par[0]].apply(null, par[1].concat([""])); }
  catch (e) { recusou = true; msg = String(e.message || e); }
  b.ok(recusou && /sess|permiss|acesso|autoriz|login/i.test(msg),
    par[0] + " recusa sem sessão", msg);
});

b.fluxo("DESTINATÁRIOS · a tela existe e chama o backend certo");

const fs141 = require("fs");
const path141 = require("path");
const RAIZ141 = path141.resolve(__dirname, "..", "..");
function lerSemComentario(arq) {
  return fs141.readFileSync(path141.join(RAIZ141, arq), "utf8")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}
const TELA = lerSemComentario("OficiosConferencia.html");

b.passo("14. a tela chama as quatro funções, com o token");
["oficiosAguardandoDestinatarios(token())",
 "destinatariosDoOficio(filaId, token())",
 "liberarEnvioOficio(atual.id, lista, corrigir, token())",
 "cancelarOficioAguardando(atual.id, motivo, token())"
].forEach(function (chamada) {
  b.ok(TELA.indexOf("." + chamada) > -1, "chama " + chamada.split("(")[0]);
});

b.passo("15. e desabilita o botão quando ninguém está marcado");
/* Sem isto a pessoa libera, o backend recusa, e ela descobre o problema depois
   de clicar — em vez de ver antes. */
b.ok(/b\.disabled\s*=\s*n === 0/.test(TELA), "o botão desabilita com zero escolhidos");
b.ok(/Escolha ao menos um e-mail/.test(TELA), "e diz o que fazer");

b.passo("16. a aba está ligada ao bloco, nos dois pontos que importam");
/* Bloco que não entra no esconderTodos fica visível por cima de outra tela —
   defeito clássico deste arquivo. */
const SCRIPTS = lerSemComentario("OficiosScripts.html");
b.ok(/"blocoConferencia"/.test(SCRIPTS), "blocoConferencia está no esconderTodos");
b.ok(/"abaConferencia"/.test(SCRIPTS), "abaConferencia também");
b.ok(/abaConferencia"\)\.onclick=mostrarConferencia/.test(SCRIPTS), "e o clique está ligado");
b.ok(/include\('OficiosConferencia'\)/.test(lerSemComentario("index.html")),
  "e o arquivo é incluído na página");

b.fluxo("DESTINATÁRIOS · o seletor no modal que JÁ existia");

b.passo("17. o campo de e-mail do modal deixou de ser só leitura");
/* O usuário apontou que a parada entre emitir e enviar já existia — o modal
   "Confirmar envio do ofício" — e que o seletor pertencia ali, não numa aba
   separada. A aba fica como rede para o que foi emitido e não enviado; o
   caminho normal é este. */
const FORM = lerSemComentario("OficiosFormulario.html");
b.ok(/id="modalEnvioSeletor"/.test(FORM), "o modal tem o container do seletor");
b.ok(/modalEnvioMontarSeletor\(dados\.filaId, dados\.email\)/.test(FORM),
  "e monta o seletor ao abrir, com o filaId");

b.passo("18. e o que a pessoa escolheu vence o que veio do cadastro");
b.ok(/modalEnvioDestinatariosEscolhidos\(\)/.test(FORM),
  "ao enviar, lê os escolhidos");
b.ok(/_modalPayload\.email\s*=\s*escolhidos\.join/.test(FORM),
  "e substitui o destino pelo que foi marcado");

b.passo("19. mas o envio NÃO depende do seletor ter carregado");
/* Se o seletor falhar, o ofício ainda tem que sair com o endereço do cadastro.
   Tela auxiliar não pode derrubar a operação viva. */
b.ok(/if\(escolhidos&&escolhidos\.length\)/.test(FORM),
  "só substitui se houver escolha — senão mantém o do cadastro");
b.ok(/try\{ window\.modalEnvioMontarSeletor/.test(FORM),
  "e a montagem vai em try, para não impedir o modal de abrir");

b.passo("20. o filaId chega ao modal — é o que traz o histórico");
b.ok(/filaId: filaId/.test(lerSemComentario("OficiosScripts.html")),
  "quem abre o modal passa o filaId");

b.naoTestavel(
  "a tela vista por olho humano",
  "o emulador não renderiza. Prova-se aqui que ela chama o backend certo e " +
  "que está ligada às abas; se ficou legível, se o alerta vermelho aparece e " +
  "se o fluxo é confortável, só abrindo em homologação"
);

b.resumo();
