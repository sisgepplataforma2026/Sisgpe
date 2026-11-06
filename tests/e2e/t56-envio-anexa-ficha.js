/**
 * TESTE — O ENVIO REAL LEVA A FICHA ANEXADA
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 18/08/2026: "a ficha não está indo junto ao ofício no
 * e-mail" e, na sequência, "tem que ir obrigatoriamente".
 *
 * O t55 já provava que a ficha entra na FILA de envio (ANEXOS_JSON). Mas
 * parava ali. O trajeto tem duas pontas e eu só tinha medido a primeira:
 *
 *     emitir  →  grava PDF + ficha no Drive  →  enfileira ANEXOS_JSON
 *     enviar  →  lê ANEXOS_JSON  →  busca cada arquivo  →  anexa  →  Gmail
 *                └──────────── ESTE PEDAÇO NUNCA FOI MEDIDO ────────────┘
 *
 * "A ficha está na fila" não é o mesmo que "a escola recebeu a ficha". Este
 * teste percorre a segunda ponta: chama enviarOficioDaFilaAgora — a mesma
 * função que o botão "Enviar e-mail agora" aciona — e inspeciona a caixa de
 * saída do emulador para contar o que foi realmente anexado.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a entrega
 * pelo Gmail de verdade. O emulador REGISTRA a chamada de envio com os
 * anexos; quem entrega é o Google.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;
const outbox = r.amb.outbox;

b.fluxo("ENVIO · A ficha vai anexada no e-mail que sai");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const CAB = ["Item", "Nome", "CPF", "Ficha / Arquivo", "TIPO", "Número do Ofício",
             "Escola (Razão Social)", "CNPJ", "Data envio ofício", "Status",
             "Link PDF", "Link Ficha", "E-mail (principal)", "E-mails (todos)", "CONFIG"];
let abaReg = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (abaReg) ss.deleteSheet(abaReg);
abaReg = ss.insertSheet(g.PLANILHA_REGISTRO);
abaReg.getRange(1, 1, 1, CAB.length).setValues([CAB]);

b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

function arquivo(nome, texto) {
  return { nome: nome, tipo: "application/pdf", base64: g.Utilities.base64Encode(texto) };
}

function emitir(tipo, pessoas, anexos) {
  return g.gerarOficioWeb({
    tipo: tipo, escola: "COLEGIO EXEMPLO LTDA", cnpj: "36136001000105",
    email: "diretoria@colegioexemplo.com.br",
    colaboradores: pessoas, fichas: anexos, confirmarDuplicata: true
  }, token);
}

/** Nomes dos anexos que o e-mail REALMENTE levou. */
function anexosEnviados(msg) {
  return ((msg && msg.attachments) || []).map(a => {
    try { return String(a.getName ? a.getName() : (a.nome || a.name || "")); }
    catch (e) { return "(ilegível)"; }
  });
}

/* ═══════════════════════════════════════════════════════════
   1. O caminho inteiro: emitir e depois enviar
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const res = emitir("Oposição à Taxa Negocial",
  [{ nome: "CLARA GOMES" }],
  [arquivo("carta_escaneada.pdf", "CARTA DE OPOSICAO")]);
b.ok(res && !res.erro, "o ofício é emitido",
  res && res.erro ? String(res.mensagem).slice(0, 140) : "");

const numero = res && res.dados && res.dados.numero;

b.passo("2");
outbox.length = 0;
/* A MESMA função que o botão "Enviar e-mail agora" aciona
   (OficiosScripts.html → enviarOficioDaFilaAgora). */
const envio = g.enviarOficioDaFilaAgora(numero, token);
b.ok(envio && envio.ok !== false, "o envio é aceito",
  envio ? String(envio.mensagem || "").slice(0, 140) : "sem retorno");

b.passo("3");
b.igual(outbox.length, 1, "um e-mail saiu de verdade");

const msg = outbox[0] || {};
const anexos = anexosEnviados(msg);
b.igual(anexos.length, 2,
  "o e-mail leva DOIS anexos: o PDF do ofício e a ficha",
  anexos.join(" · ") || "(nenhum)");

b.passo("4");
b.ok(anexos.some(n => /^Ficha_Oposicao_CLARA_GOMES/.test(n)),
  "a FICHA está entre os anexos enviados", anexos.join(" · "));
b.ok(anexos.some(n => /^Of[ií]cio/i.test(n)),
  "e o PDF do ofício também", anexos.join(" · "));

b.passo("5");
b.ok(String(msg.to || "").indexOf("colegioexemplo") > -1,
  "foi para a escola", String(msg.to || ""));

/* ═══════════════════════════════════════════════════════════
   2. Lote: um PDF único com várias fichas
   ═══════════════════════════════════════════════════════════ */
b.passo("6");
const resLote = emitir("Oposição à Taxa Negocial",
  [{ nome: "A A" }, { nome: "B B" }, { nome: "C C" }],
  [arquivo("scan_unico.pdf", "TRES CARTAS")]);
outbox.length = 0;
g.enviarOficioDaFilaAgora(resLote.dados.numero, token);
const anexosLote = anexosEnviados(outbox[0]);
b.igual(anexosLote.length, 2,
  "no lote também vão dois: ofício + PDF único das fichas",
  anexosLote.join(" · "));
b.ok(anexosLote.some(n => /^Fichas_Oposicao_/.test(n)),
  "o PDF único vai com nome de escola e data", anexosLote.join(" · "));

/* ═══════════════════════════════════════════════════════════
   3. Três fichas separadas: nenhuma pode se perder
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
const resTres = emitir("Filiação",
  [{ nome: "X X" }, { nome: "Y Y" }, { nome: "Z Z" }],
  [arquivo("f1.pdf", "1"), arquivo("f2.pdf", "2"), arquivo("f3.pdf", "3")]);
outbox.length = 0;
g.enviarOficioDaFilaAgora(resTres.dados.numero, token);
const anexosTres = anexosEnviados(outbox[0]);
b.igual(anexosTres.length, 4,
  "vão 4 anexos: o ofício e as 3 fichas", anexosTres.join(" · "));

/* ═══════════════════════════════════════════════════════════
   4. Contraprova: sem ficha, vai só o ofício
   ═══════════════════════════════════════════════════════════

   Sem isto, um envio que anexasse arquivos fixos passaria em tudo acima.
   ═══════════════════════════════════════════════════════════ */
b.passo("8");
const resSem = emitir("Taxa Negocial", [{ nome: "PEDRO ALVES" }], []);
outbox.length = 0;
g.enviarOficioDaFilaAgora(resSem.dados.numero, token);
b.igual(anexosEnviados(outbox[0]).length, 1,
  "sem ficha anexada, sai só o PDF do ofício");

/* ═══════════════════════════════════════════════════════════
   5. A TELA precisa mandar o PDF do ofício, não só os dos cartões
   ═══════════════════════════════════════════════════════════

   Aqui estava o defeito que o usuário relatou. Tudo acima mede o BACKEND —
   e o backend sempre esteve certo. O que faltava era o arquivo sair do
   navegador: a emissão varria só os cartões dos trabalhadores e ignorava
   #fichasOficioLote, o campo "Fichas do ofício" onde ele anexa o escaneado
   de todas as cartas da escola.

   getFichasPayload() lia esse campo, mas só alimenta o painel de revisão.
   Duas leituras do mesmo campo, uma delas sem consumidor — e o e-mail saía
   com o ofício sozinho, sem erro nenhum.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("TELA · O PDF do ofício sai do navegador");

const dom = require("./dom");
if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("A tela envia o PDF do ofício", "jsdom não instalado");
} else {
  const tela = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html"], { token: token });
  const doc = tela.doc, win = tela.win;
  doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

  b.passo("9");
  /* O código de emissão tem que LER o campo do ofício. Medir pelo texto da
     função é feio, mas é o que separa "existe o campo" de "alguém usa o
     campo" — e foi justamente essa diferença que passou despercebida. */
  const fonte = require("fs").readFileSync(
    require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
  const trechoEmissao = fonte.slice(fonte.indexOf("var todosArquivos = []"),
                                    fonte.indexOf("Promise.all(todosArquivos"));
  /* Sem os comentários. Minha primeira versão procurava "fichasOficioLote"
     no trecho cru e PASSOU na mutação: eu tinha citado o id dentro do
     comentário que explica a correção, então apagar o código não mudava
     nada. Asserção que lê comentário mede documentação, não comportamento. */
  const semComentario = trechoEmissao
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  b.ok(/\$\(\s*["']fichasOficioLote["']\s*\)/.test(semComentario),
    "a emissão LÊ o campo 'Fichas do ofício' ao montar os anexos",
    "sem isto o PDF escaneado nunca sai do navegador");
  b.ok(/todosArquivos\.push/.test(semComentario.slice(0,
        semComentario.indexOf("listaTrabalhadores"))),
    "e empilha esse arquivo ANTES de varrer os cartões",
    "o PDF da escola tem que ser o primeiro anexo depois do ofício");

  b.passo("10");
  b.ok(!!doc.getElementById("fichasOficioLote"),
    "e o campo existe na tela para ser preenchido");

  /* Contraprova: os cartões continuam sendo lidos — a correção não pode ter
     trocado uma fonte de arquivos pela outra. */
  b.passo("11");
  b.ok(semComentario.indexOf("input-ficha-trabalhador") > -1,
    "os cartões dos trabalhadores continuam sendo lidos também");
}

b.naoTestavel("Entrega pelo Gmail e como o anexo chega na caixa da escola",
  "o emulador registra a chamada de envio com os anexos; quem entrega é o Google");

b.resumo();
