/** TESTE PONTA A PONTA — MÓDULO DOCUMENTOS (Ofícios, Recibos, Histórico) */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);

const TOKEN = b.logar(g, "wanderson");
const TOKEN_ESC = b.logar(g, "joscimar"); // só escolas+sindicalizacao
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
function aba(nome, cab) {
  let s = ss.getSheetByName(nome);
  if (!s) { s = ss.insertSheet(nome); if (cab) s.getRange(1, 1, 1, cab.length).setValues([cab]); }
  return s;
}

/* ══════════ 1. GERAÇÃO DE OFÍCIO ══════════ */
b.fluxo("DOCUMENTOS · Ofício — gatilho → registro → fila → envio → rastreio");

aba("CONFIG", ["CHAVE","VALOR"]);
aba(g.PLANILHA_REGISTRO, ["Item","Nome","CPF","Ficha / Arquivo","Tipo do Ofício","Número do Ofício","Escola","CNPJ","Data","Status","Link PDF","E-mail"]);

b.passo("1. Gerar ofício (ação principal do módulo)");
const ger = g.gerarOficioWeb({ tipo: "LIVRE", para: "Escola Modelo", email: "escola@exemplo.com", assunto: "Comunicado", corpo: "Texto do ofício." }, TOKEN);
b.ok(ger && !ger.erro, "gerarOficioWeb conclui sem erro",
  ger && ger.erro ? "ERRO: " + ger.mensagem : "");

b.passo("2. Preview do ofício");
let prev; try { prev = g.previewOficioWeb({ tipo: "LIVRE", para: "Escola Modelo", email: "escola@exemplo.com", assunto: "X", corpo: "Y" }, TOKEN); }
catch (e) { prev = { erro: true, mensagem: e.message }; }
b.ok(prev && !prev.erro, "previewOficioWeb conclui sem erro", prev && prev.erro ? "ERRO: " + prev.mensagem : "");

// Regressão travada: gerarOficioWeb já devolveu "sessaoDocumentos is not
// defined" porque a declaração e a leitura usavam nomes diferentes. Se
// alguém reintroduzir isso, a linha abaixo acusa.
b.ok(!(ger && String(ger.mensagem || "").indexOf("is not defined") >= 0),
  "não devolve erro de variável indefinida (regressão de 2026-08-05)");

b.passo("2b. O ofício realmente entrou no registro?");
const abaReg = ss.getSheetByName(g.PLANILHA_REGISTRO);
b.ok(abaReg && abaReg.getLastRow() >= 2, "ofício gravado na aba de registro",
  "linhas: " + (abaReg ? abaReg.getLastRow() - 1 : 0));

b.passo("3. Fila de envio");
let fila; try { fila = g.processarFilaEnvioOficios(); } catch (e) { fila = { erro: e.message }; }
b.ok(fila && !fila.erro, "processarFilaEnvioOficios roda sem explodir", fila && fila.erro ? "ERRO: " + fila.erro : JSON.stringify(fila).slice(0, 90));

b.passo("4. Histórico");
let hist; try { hist = g.listarHistoricoOficios({}, TOKEN); } catch (e) { hist = { erro: true, mensagem: e.message }; }
b.ok(hist && !hist.erro, "listarHistoricoOficios responde", hist && hist.erro ? "ERRO: " + hist.mensagem : "itens: " + ((hist.itens || []).length));

b.passo("5. Permissão — usuário de Escolas tentando gerar ofício");
b.bloqueia(() => g.gerarOficioWebComFichas({ tipo: "LIVRE" }, TOKEN_ESC), "gerarOficioWebComFichas nega usuário sem módulo Documentos");

b.passo("6. Sessão inválida");
b.bloqueia(() => g.listarHistoricoOficios({}, "token-falso"), "listarHistoricoOficios nega token inválido");

/* ══════════ 2. RECIBOS ══════════ */
b.fluxo("DOCUMENTOS · Recibos");

const entradas = [
  ["buscarConfigRecibo", () => g.buscarConfigRecibo(TOKEN)],
  ["listarProcessosRecibo", () => g.listarProcessosRecibo(TOKEN)],
  ["listarHistoricoRecibos", () => g.listarHistoricoRecibos({}, TOKEN)],
  ["obterResumoHistoricoRecibos", () => g.obterResumoHistoricoRecibos(TOKEN)],
  ["listarHistoricoReciboDiversos", () => g.listarHistoricoReciboDiversos({}, TOKEN)]
];
entradas.forEach(([nome, fn]) => {
  b.passo(nome);
  let r, erro = null;
  try { r = fn(); } catch (e) { erro = e.message; }
  if (erro) b.ok(false, nome + " responde sem exceção", "EXCEÇÃO: " + erro);
  else if (r && r.erro) b.ok(false, nome + " responde sem erro", "ERRO: " + (r.mensagem || ""));
  else b.ok(true, nome + " responde", typeof r === "object" ? JSON.stringify(r).slice(0, 70) : String(r).slice(0, 70));
});

b.naoTestavel("Conteúdo do PDF do ofício e do recibo", "depende de template do Google Docs — só verificável abrindo o arquivo gerado");
b.naoTestavel("Entrega real do e-mail e rastreio de abertura", "depende do Gmail e do pixel em navegador real");

const c = b.resumo();
process.exit(0);
