/**
 * PRÉVIA DE ANEXO NA TELA — 30/10/2026.
 *
 * O usuário mandou o print do teste em HML: o PDF do anexo aparecia como
 * ícone de arquivo quebrado (o leitor de PDF do navegador não abre dentro
 * do iframe do Google). Agora o PDF é desenhado pelo pdf.js e, se isso
 * falhar, ficam "Abrir em nova aba" e "Abrir no Google Drive".
 *
 * Prova (jsdom, pdf.js substituído por um dublê): imagem aparece direto;
 * PDF vira páginas desenhadas; PDF com defeito ou pdf.js fora do ar mostra
 * o aviso com os dois links; o link do Drive só aparece quando existe.
 *
 * NÃO PROVA: o pdf.js de verdade baixando do cdnjs e desenhando dentro do
 * iframe do Apps Script — isso só se vê no navegador, em HML.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a prévia de anexo", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}
const t = dom.montar(g, ["VoucherPedidosEmailUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win;
win.URL.createObjectURL = () => "blob:teste";
const PDF64 = Buffer.from("%PDF-1.4 teste").toString("base64");
const caixa = () => { const d = doc.createElement("div"); doc.body.appendChild(d); return d; };
const links = c => Array.from(c.querySelectorAll("a")).map(a => a.textContent + "|" + a.getAttribute("href"));

(async function () {
  b.fluxo("PRÉVIA DE ANEXO");
  b.passo("1. Imagem aparece direto, com 'Abrir em nova aba'");
  const c1 = caixa();
  win.sisgepPreviaAnexo(c1, { nome: "rg.jpg", tipo: "image/jpeg", dataUrl: "data:image/jpeg;base64,AAAA", driveUrl: "" });
  b.ok(c1.querySelector("img"), "a imagem está na tela");
  b.ok(links(c1).some(l => /nova aba\|blob:/.test(l)), "com 'Abrir em nova aba'", links(c1).join(" ; "));
  b.ok(!links(c1).some(l => /Drive/.test(l)), "sem link do Drive quando não há");

  b.passo("2. PDF é desenhado na página (pdf.js)");
  let renderizadas = 0;
  win.HTMLCanvasElement.prototype.getContext = () => ({});
  win.pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({ numPages: 7,
    getPage: () => Promise.resolve({ getViewport: () => ({ width: 100, height: 140 }),
      render: () => { renderizadas++; return { promise: Promise.resolve() }; } }) }) }) };
  const c2 = caixa();
  win.sisgepPreviaAnexo(c2, { nome: "cnh.pdf", tipo: "application/pdf", dataUrl: "data:application/pdf;base64," + PDF64,
    driveUrl: "https://drive.google.com/file/d/ABC/view" });
  await t.assentar(80);
  b.igual(c2.querySelectorAll("canvas").length, 5, "até 5 páginas desenhadas");
  b.igual(renderizadas, 5, "cada uma renderizada");
  b.ok(/Mostrando 5 de 7/.test(c2.textContent), "e avisa que tem mais páginas");
  b.ok(links(c2).some(l => /Google Drive\|https:\/\/drive\.google\.com\/file\/d\/ABC\/view/.test(l)), "com 'Abrir no Google Drive'");

  b.passo("3. PDF com defeito: aviso e os dois links, nada de ícone quebrado");
  win.pdfjsLib = { getDocument: () => ({ promise: Promise.reject(new Error("corrompido")) }) };
  const c3 = caixa();
  win.sisgepPreviaAnexo(c3, { nome: "x.pdf", tipo: "application/pdf", dataUrl: "data:application/pdf;base64," + PDF64,
    driveUrl: "https://drive.google.com/file/d/XYZ/view" });
  await t.assentar(80);
  b.ok(/Não deu para desenhar este PDF/.test(c3.textContent), "avisa");
  b.igual(links(c3).length, 2, "e oferece nova aba e Drive");
  b.ok(!c3.querySelector("iframe,embed,object"), "sem iframe/embed (o que quebrava)");

  b.passo("4. pdf.js fora do ar: aviso com os links");
  delete win.pdfjsLib;
  const origAppend = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = n => { const r = origAppend(n); if (n.tagName === "SCRIPT") setTimeout(() => n.onerror && n.onerror(), 0); return r; };
  const c4 = caixa();
  win.sisgepPreviaAnexo(c4, { nome: "y.pdf", tipo: "application/pdf", dataUrl: "data:application/pdf;base64," + PDF64, driveUrl: "" });
  await t.assentar(80);
  b.ok(/A prévia de PDF não carregou/.test(c4.textContent), "avisa que a prévia não carregou");
  b.ok(links(c4).some(l => /nova aba/.test(l)), "e deixa abrir em nova aba");

  b.passo("4b. Pedido aberto chama o pdf.js várias vezes: baixa uma vez só");
  let scripts = 0;
  doc.head.appendChild = n => { if (n.tagName === "SCRIPT") { scripts++; setTimeout(() => { win.pdfjsLib = { GlobalWorkerOptions: {} }; n.onload(); }, 0); } return n; };
  let prontos = 0;
  win.sisgepCarregarPdfJs_(); win.sisgepCarregarPdfJs_(() => prontos++); win.sisgepCarregarPdfJs_(() => prontos++);
  await t.assentar(40);
  b.igual(scripts, 1, "um download só");
  b.igual(prontos, 2, "e todos que esperavam foram atendidos");
  win.sisgepCarregarPdfJs_(() => prontos++);
  b.igual(scripts, 1, "depois de carregado, não baixa de novo");

  b.passo("5. Outro formato: diz que não tem prévia, mas deixa abrir");
  const c5 = caixa();
  win.sisgepPreviaAnexo(c5, { nome: "a.docx", tipo: "application/msword", dataUrl: "data:application/msword;base64,AAAA", driveUrl: "" });
  b.ok(/Formato sem prévia/.test(c5.textContent) && links(c5).length === 1, "aviso e link");

  b.naoTestavel("o pdf.js real dentro do iframe do Apps Script", "só no navegador, em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
