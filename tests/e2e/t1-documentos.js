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

/* ══════════ PONTE COM A TRILHA ÚNICA (item 16) ══════════ */
b.fluxo("DOCUMENTOS · Ofício alimenta a trilha de auditoria");

// Primeiro dos 28 pontos de log ligado à trilha. Ofícios é a única operação
// em uso diário do sindicato, então é a única que enche a trilha com
// movimento real. O que se prova aqui é que emitir ofício grava nos DOIS
// lugares — o LOG_SISTEMA de sempre e a trilha nova — e que a auditoria não
// tem como derrubar a emissão.

b.passo("A0. O caminho REAL de emissão já alimentou a trilha");
// Isto vale mais que a chamada direta do passo seguinte: os ofícios gerados
// lá em cima por gerarOficioWeb — sem ninguém mencionar auditoria — já
// deixaram rastro. É a integração de verdade, não uma simulação.
const daEmissaoReal = g.auditoriaConsultar({ modulo: "Documentos" }, TOKEN).acoes;
b.ok(daEmissaoReal.length >= 1,
  "gerarOficioWeb produz registro de auditoria sem pedir nada a ninguém",
  daEmissaoReal.length + " registro(s) · " +
  (daEmissaoReal[0] ? daEmissaoReal[0].submodulo + " · " + daEmissaoReal[0].acao : ""));

b.passo("A. Emitir ofício grava também na trilha");
const antesTrilha = g.auditoriaConsultar({}, TOKEN).acoes.length;
g.registrarLogSistema({
  usuario: "marcelha@sindeducacao.com", numero: "099/2026", tipo: "FILIACAO",
  escola: "Escola Modelo", cnpj: "12.345.678/0001-90",
  email: "escola@exemplo.com", codigo: "ABC999"
});
const depoisTrilha = g.auditoriaConsultar({}, TOKEN).acoes;
b.ok(depoisTrilha.length === antesTrilha + 1,
  "um registro novo na trilha por ofício emitido",
  antesTrilha + " → " + depoisTrilha.length);

b.passo("B. E chega classificado como Documentos › Ofícios");
const naTrilha = g.auditoriaConsultar({ registroId: "099/2026" }, TOKEN).acoes[0];
b.ok(naTrilha && naTrilha.modulo === "Documentos" && naTrilha.submodulo === "Ofícios"
     && naTrilha.usuario === "marcelha@sindeducacao.com",
  "módulo, submódulo e autor corretos",
  naTrilha ? naTrilha.modulo + " › " + naTrilha.submodulo + " · " + naTrilha.acao : "não achou");

b.passo("C. O LOG_SISTEMA de sempre continua gravando");
// A ponte é aditiva. Se ela tivesse substituído o log antigo, o relatório de
// auditoria de ofícios (RelatoriosOficios.gs, que lê LOG_SISTEMA) pararia de
// funcionar sem ninguém perceber.
const logAntigo = ss.getSheetByName("LOG_SISTEMA");
const achouNoAntigo = logAntigo && logAntigo.getRange(1, 1, logAntigo.getLastRow(), 9)
  .getValues().some(l => String(l[2]) === "099/2026");
b.ok(achouNoAntigo === true, "os dois destinos gravam, não um no lugar do outro",
  "LOG_SISTEMA com " + (logAntigo ? logAntigo.getLastRow() - 1 : 0) + " linha(s)");

b.passo("D. Auditoria quebrada não derruba a emissão do ofício");
// A garantia que torna isto aceitável em produção. Ofícios é o que a
// secretaria usa todo dia; parar a emissão por causa de log seria trocar um
// problema pequeno por um grande.
const guardada = g.aud_deLogSistema_;
g.aud_deLogSistema_ = function () { throw new Error("falha simulada da auditoria"); };
let derrubou = false;
try {
  g.registrarLogSistema({ usuario: "marcelha@sindeducacao.com", numero: "100/2026",
    tipo: "LIVRE", escola: "Escola B", cnpj: "", email: "", codigo: "XYZ" });
} catch (e) { derrubou = true; }
g.aud_deLogSistema_ = guardada;
b.ok(derrubou === false, "o ofício é registrado mesmo com a auditoria falhando",
  "exceção da auditoria contida");

b.naoTestavel("Conteúdo do PDF do ofício e do recibo", "depende de template do Google Docs — só verificável abrindo o arquivo gerado");
b.naoTestavel("Entrega real do e-mail e rastreio de abertura", "depende do Gmail e do pixel em navegador real");

const c = b.resumo();
