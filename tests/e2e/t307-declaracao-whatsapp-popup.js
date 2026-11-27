/**
 * DECLARAÇÃO · "PREPARAR WHATSAPP" (27/11/2026). Relato: "quando clico no zap para enviar não acontece nada". Duas tentativas falharam no navegador
 * real: window.open depois da resposta (bloqueado) e aba em branco redirecionada depois (ficava em about:blank, quadro isolado do Apps Script).
 * Agora a tela não abre janela por código: mostra um link 'Abrir WhatsApp' (clique do usuário). NÃO PROVA: o WhatsApp de verdade nem o quadro
 * isolado do Apps Script — por isso vale tocar no botão em produção e confirmar.
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

  b.passo("1. Preparar mostra o botão 'Abrir WhatsApp' — sem abrir janela por código");
  aberturas.length = 0; janelas.length = 0;
  tocar(zap, "zap"); await tela.assentar(80);
  b.igual(aberturas.length, 0, "a tela NÃO chama window.open (a aba em branco ficava em about:blank no navegador real)");
  const link = $("declWhatsLink");
  b.ok(!!link && /^https:\/\/wa\.me\/55279999\d{5}\?text=/.test(link.getAttribute("href") || ""), "aparece o botão com o wa.me do diretor (o celular vem do cadastro)", link ? link.getAttribute("href").slice(0, 40) : "sem botão");
  b.ok(link && link.getAttribute("target") === "_blank" && /Abrir WhatsApp/.test(link.textContent), "é um link de verdade (clique do usuário), em nova aba, com o texto 'Abrir WhatsApp'");
  b.ok(/%0A/.test(link.getAttribute("href")) && /SindEduca%C3%A7%C3%A3o-ES/.test(link.getAttribute("href")), "a mensagem pronta vai dentro do link");
  b.ok(/Marcar WhatsApp como enviado/.test(Array.from($("declModalEntrega").querySelectorAll("button")).filter(x => x.style.display !== "none").map(x => x.textContent).join("|")), "aparece o botão 'Marcar WhatsApp como enviado'");
  b.ok(aviso.some(t => /Mensagem pronta/.test(t)), "e um aviso diz o que fazer", aviso.join(" | "));

  b.passo("2. Tocar de novo reaproveita o mesmo botão (sem duplicar)");
  tocar(zap, "zap"); await tela.assentar(80);
  b.igual(doc.querySelectorAll("#declWhatsLink").length, 1, "continua um botão só");

  b.passo("3. Erro do servidor: mostra o motivo e nenhuma janela abre");
  aviso.length = 0; const preparar = g.declPrepararWhatsapp;
  g.declPrepararWhatsapp = () => ({ ok: false, mensagem: "O diretor não possui celular válido em Associados." });
  tocar(zap, "zap"); await tela.assentar(80);
  b.ok(aviso.some(t => /celular válido/.test(t)) && aberturas.length === 0, "aparece o motivo, sem janela", aviso.join(" | "));
  g.declPrepararWhatsapp = preparar;

  b.resumo(); process.exit(process.exitCode || 0);
})();
