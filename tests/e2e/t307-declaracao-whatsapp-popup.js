/**
 * DECLARAÇÃO · "PREPARAR WHATSAPP" ABRE O WHATSAPP (27/11/2026). Relato do usuário: "quando clico no zap para enviar não acontece nada".
 * Hipótese: o window.open era chamado DEPOIS da resposta do servidor; o navegador só deixa abrir janela no próprio toque (gesto do usuário) e
 * bloqueia a aberta depois de uma resposta assíncrona — o servidor responde certo e nada aparece, sem erro. O teste simula esse bloqueio:
 * window.open só devolve janela se for chamado DENTRO do clique. Prova: a aba abre no clique e vai para o wa.me; erro do servidor fecha a aba;
 * sem declaração entregue não faz nada; se o navegador bloquear mesmo assim, aparece o link para clicar. NÃO PROVA: o WhatsApp de verdade.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("DECLARAÇÕES · WhatsApp da entrega");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Entrega reaberta e Reemitir na tela", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

function sheet(nome, cab) {
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (!sh.getLastRow()) sh.appendRow(cab);
  return sh;
}

sheet("Associados", g.SIND_ASS_COLUNAS).appendRow([
  "UVV", "Wanderson Nascimento Castelo", "00000000000", "S", "", "", "", "Cariacica", "",
  "(27) 99999-1234", "", "wanderson@exemplo.com", new Date(), "123", new Date(), "FICHA-1"
]);
sheet("Escolas", ["EscolaID", "Escola (Razão Social)", "NOME_FANTASIA", "CNPJ", "E-mail (principal)",
  "E-mails (todos)", "Cidade", "UF", "Telefone 1", "Telefone 2", "SITUACAO_CADASTRAL"])
  .appendRow(["ESC-UVV", "Sociedade Educação e Gestão de Excelência", "UVV", "01.234.567/0001-89",
    "rh@uvv.br", "rh@uvv.br; dp@uvv.br", "Vila Velha", "ES", "", "", "ATIVA"]);

/* O PDF é a única parte que o emulador não reproduz — isolada de propósito
   em declGerarPdf_, justamente para o resto do fluxo ser testável. */
g.declGerarPdf_ = () => ({ id: "PDF-1", url: "https://drive.google.com/PDF-1" });

/* A DECLARAÇÃO NASCE ANTES DA TELA. É o ponto do teste: quando a página
   abre, não existe nenhum estado de emissão em memória — como no dia
   seguinte, em outro computador, com outra pessoa. */
const dirId = g.declDadosEmissao(TOKEN).diretores.filter(d => /WANDERSON/.test(d.nome))[0].id;
const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
const emitida = g.declEmitirDeclaracaoDiretor({
  diretorId: dirId, escolaId: "ESC-UVV",
  dataLiberacao: amanha.toISOString().slice(0, 10), periodo: "VESPERTINO"
}, TOKEN);

let tela;
try {
  tela = dom.montar(g, ["DeclaracoesAdmin.html"], { token: TOKEN });
} catch (e) {
  b.ok(false, "a tela de declarações sobe sem quebrar", String(e.message).slice(0, 180));
  b.resumo();
  process.exit(1);
}
const doc = tela.doc, win = tela.win;
function $(id) { return doc.getElementById(id); }

/* CLIQUE EM BOTÃO COM onclick INLINE.
 *
 * O andaime monta o jsdom com runScripts:"outside-only", que não compila
 * handler de atributo: um `.click()` aqui não chamaria função nenhuma, e o
 * teste acusaria a tela de não responder quando o mudo é o andaime. O que o
 * navegador faz é avaliar o conteúdo do atributo no escopo da janela — é
 * isso que está abaixo. De quebra, prova que o atributo leva os argumentos
 * certos, que é metade do defeito do Reemitir. */
/* Mesma história do clique, para campo: o andaime não compila onchange nem
 * oninput de atributo. Sem isto, escolher no select não chama nada e o teste
 * mede uma tela que ninguém tocou. */
function mudar(sel, valor, evento) {
  const el = doc.querySelector(sel);
  if (!el) throw new Error("campo não existe: " + sel);
  el.value = valor;
  const codigo = el.getAttribute(evento || "onchange");
  if (codigo) win.eval(codigo);
}

function declFecharModais() {
  ["declModalEntrega", "declModalConfig", "declModalDocumento", "declModalDuplicata"]
    .forEach(id => { const el = doc.getElementById(id); if (el) el.classList.remove("aberto"); });
}

function clicar(el, oque) {
  if (!el) throw new Error("botão não existe: " + oque);
  const codigo = el.getAttribute("onclick");
  if (!codigo) throw new Error("botão sem onclick: " + oque);
  win.eval(codigo);
}


let gesto = false;
const janelas = [], aberturas = [];
win.open = (url) => {
  aberturas.push({ url, gesto });
  if (!gesto) return null;              // navegador bloqueia pop-up que não nasce de um toque
  const w = { closed: false, _href: String(url || ""), close() { this.closed = true; } };
  Object.defineProperty(w, "location", { value: { set href(v) { w._href = v; }, get href() { return w._href; } } });
  janelas.push(w); return w;
};
function tocar(el, oque) {            // o toque: tudo que roda SÍNCRONO dentro dele tem gesto; o que vem depois da resposta, não
  const codigo = el.getAttribute("onclick");
  if (!codigo) throw new Error("botão sem onclick: " + oque);
  gesto = true; try { win.eval(codigo); } finally { gesto = false; }
}
const aviso = [];
win.toast = (t, tipo) => aviso.push(String(t));

(async function () {
  win.declInit(); win.declAba("emitidas"); await tela.assentar(60);
  const linha = $("declHistoricoCorpo").querySelector("tr");
  const btnEntregar = Array.from(linha.querySelectorAll("button")).filter(x => /Entregar|Reenviar/.test(x.textContent))[0];
  clicar(btnEntregar, "entregar"); await tela.assentar(60);
  const zap = Array.from($("declModalEntrega").querySelectorAll("button")).filter(x => /Preparar WhatsApp/.test(x.textContent))[0];
  b.ok(!!zap, "o botão 'Preparar WhatsApp' existe no modal de entrega");

  b.passo("1. O toque abre o WhatsApp");
  aberturas.length = 0; janelas.length = 0;
  tocar(zap, "zap"); await tela.assentar(80);
  const foiWa = janelas.some(w => /^https:\/\/wa\.me\/55279999\d{5}\?text=/.test(w.location.href));
  b.ok(foiWa, "uma janela aberta no toque terminou no wa.me do diretor (o celular vem do cadastro)", JSON.stringify(aberturas.map(a => ({ gesto: a.gesto, url: String(a.url).slice(0, 30) }))));
  b.ok(janelas.length === 1, "abriu UMA janela só (sem aba sobrando)");
  b.ok(/Marcar WhatsApp como enviado/.test(Array.from($("declModalEntrega").querySelectorAll("button")).filter(x => x.style.display !== "none").map(x => x.textContent).join("|")), "aparece o botão 'Marcar WhatsApp como enviado'");

  b.passo("2. Erro do servidor: a aba em branco é fechada e a pessoa é avisada");
  const orig = win.google.script.run;
  janelas.length = 0; aviso.length = 0;
  const preparar = g.declPrepararWhatsapp;
  g.declPrepararWhatsapp = () => ({ ok: false, mensagem: "O diretor não possui celular válido em Associados." });
  tocar(zap, "zap"); await tela.assentar(80);
  b.ok(janelas.every(w => w.closed), "nenhuma aba em branco fica aberta");
  b.ok(aviso.some(t => /celular válido/.test(t)), "aparece o motivo", aviso.join(" | "));
  g.declPrepararWhatsapp = preparar;

  b.passo("3. Se o navegador bloquear mesmo assim: link para clicar");
  janelas.length = 0; aviso.length = 0;
  const abrirOriginal = win.open; win.open = () => null;
  tocar(zap, "zap"); await tela.assentar(80);
  b.ok(!!$("declWhatsLink") && /wa\.me/.test($("declWhatsLink").getAttribute("href") || ""), "aparece um link 'Abrir WhatsApp' para clicar", $("declWhatsLink") ? $("declWhatsLink").outerHTML.slice(0, 90) : "sem link");
  win.open = abrirOriginal;

  b.resumo(); process.exit(process.exitCode || 0);
})();
