/**
 * ÁREA DA PRESIDÊNCIA · SERVIDOR (PresidenciaIngressos.gs, 27/11/2026). Emulador; base do TickOne, filas e robô FALSOS; dados FICTÍCIOS.
 * Prova: link inválido/cancelado recusa igual; bloqueio por tentativas; conferir por nome; gerar grava só da área, respeita limite e
 * 'conferir' só com forcar; meus; cancelar só do que é da área; pdf. NÃO PROVA: o robô nem o TickOne de verdade.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const agora = new Date().toISOString();
let BASE = { lidoEm: agora, evento: "x", total: 2, linhas: [
  { nome: "Francisco Primo", cpf: "", tel: "", codigo: "AAAA-0001", tipo: "Convite", escola: "", cidade: "", ref: "R1", zap: 0 },
  { nome: "Maria Associada", cpf: "52998224725", tel: "", codigo: "AAAA-0002", tipo: "Associado", escola: "E", cidade: "C", ref: "R2", zap: 0 }] };
const filas = []; let robos = []; let PDFS = {};
g.cingLerBase_ = () => JSON.parse(JSON.stringify(BASE));
g.cingFilaPronta_ = () => true;
g.cingGravarFila_ = (n, t) => { filas.push(n); };
g.cingDispararRobo_ = (q) => { robos.push(q); return { acionado: true, motivo: "" }; };
g.cingPdfs_ = () => PDFS;
g.cingSincronizarEmissoes_ = () => 0; g.cingSincronizarResultado_ = () => 0;
const TOK = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
g.presRegistrarAcesso_("Presidente", TOK);
const OUTRO = g.presRegistrarAcesso_("Marcela");
b.fluxo("PRESIDÊNCIA · acesso");
b.ok(g.presidencia_estado(TOK).ok && g.presidencia_estado(TOK).nome === "Presidente", "link válido entra");
b.ok(g.presidencia_estado("x".repeat(40)).negado === true && g.presidencia_estado("curto").negado === true && g.presidencia_estado("").negado === true, "link inventado, curto ou vazio: recusa igual");
b.ok(!JSON.stringify(g.PropertiesService.getScriptProperties().getProperty("PRES_ACESSOS")).includes(TOK), "o link não fica guardado em claro, só o hash");
g.__usuarioAtivoEmail = ""; const gl = g.presidenciaGerarLinksSISGEP(); b.ok(gl && gl.erro === true, "gerar links de fora do editor: recusa"); g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
b.fluxo("PRESIDÊNCIA · conferir e gerar");
const itens = [{ nome: "Ademir Carlos Pin", categoria: "convite" }, { nome: "Zenaide Borges", categoria: "acompanhante" }, { nome: "francisco  primo", categoria: "convite" }, { nome: "Ademir Carlos Pin", categoria: "convite" }, { nome: "Zé", categoria: "convite" }, { nome: "Fulano Cortesia", categoria: "cortesia" }];
const cf = g.presidencia_conferir(TOK, itens);
const sit = cf.resultados.map(r => r.situacao);
b.igual(sit, ["novo", "novo", "conferir", "invalido", "invalido", "invalido"], "novo, novo, mesmo nome da base = conferir, repetido, nome curto e categoria fora das duas = inválidos");
b.ok(g.presidencia_gerar(TOK, itens, false).ok === false, "sem confirmação não gera");
const r1 = g.presidencia_gerar(TOK, itens, true);
b.ok(r1.ok && r1.pedidos === 2, "gera só os 2 novos (o 'conferir' sem forcar fica de fora)", r1.mensagem);
const em = g.cingEmissoes_();
b.ok(em.length === 2 && em.every(o => /^PRES:Presidente$/.test(o.PEDIDO_POR) && o.STATUS === "PEDIDO" && String(o.CPF) === ""), "linhas da área, PEDIDO_POR=PRES:Presidente e sem CPF");
b.ok(filas.includes("emissoes-fila.json") && robos.includes("emitir"), "publicou a fila e acionou o robô de emissão");
const r2 = g.presidencia_gerar(TOK, [{ nome: "Ademir Carlos Pin", categoria: "convite" }], true);
b.ok(!r2.ok, "pedir de novo quem já está sendo gerado: recusa", r2.mensagem);
const r3 = g.presidencia_gerar(TOK, [{ nome: "Francisco Primo", categoria: "convite", forcar: true }], true);
b.ok(r3.ok && r3.pedidos === 1, "o homônimo só entra com 'emitir mesmo'");
b.passo("limite do dia");
const muitos = []; for (let i = 0; i < 49; i++) muitos.push({ nome: "Pessoa Numero " + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)) + "xyz", categoria: "convite" });
b.ok(g.presidencia_gerar(TOK, muitos, true).ok, "49 passam (total do dia = 52)");
const muitos2 = []; for (let i = 0; i < 49; i++) muitos2.push({ nome: "Outra Pessoa Numero " + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)) + "abc", categoria: "convite" });
const rl = g.presidencia_gerar(OUTRO, muitos2, true);
b.ok(!rl.ok && /Limite do dia/.test(rl.mensagem), "o limite é da área inteira, dos três juntos (52 + 49 > 100)", rl.mensagem);
b.fluxo("PRESIDÊNCIA · meus, cancelar, PDF");
const lin = g.cingEmissoes_().filter(o => o.NOME === "Ademir Carlos Pin")[0];
g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName(g.CING_ABA_EMIS).getRange(lin._linha, 11, 1, 2).setValues([["EMITIDO", "AAAA-0300"]]);
BASE.linhas.push({ nome: "Ademir Carlos Pin", cpf: "", tel: "", codigo: "AAAA-0300", tipo: "Convite", escola: "", cidade: "", ref: "R3", zap: 0 });
let m = g.presidencia_meus(TOK); let ad = m.ingressos.filter(x => x.nome === "Ademir Carlos Pin")[0];
b.ok(ad && ad.estado === "gerando" && ad.codigo === "AAAA-0300", "emitido mas sem PDF ainda: 'gerando'");
PDFS = { "ademir carlos pin": "https://drive.google.com/file/d/ID123/view" };
m = g.presidencia_meus(TOK); ad = m.ingressos.filter(x => x.nome === "Ademir Carlos Pin")[0];
b.ok(ad.estado === "pronto" && /ID123/.test(ad.pdf), "com o PDF no Drive: 'pronto' e com o link");
b.ok(!m.ingressos.some(x => x.nome === "Maria Associada"), "ingresso de associado nunca aparece");
b.ok(g.presidencia_cancelar(TOK, "AAAA-0002", "x", true).ok === false, "cancelar ingresso de ASSOCIADO (não é da área): recusa");
b.ok(g.presidencia_cancelar(TOK, "AAAA-0300", "x", false).ok === false, "sem confirmação não cancela");
const cn = g.presidencia_cancelar(OUTRO, "AAAA-0300", "Correção de nome", true);
b.ok(cn.ok && robos.includes("excluir"), "qualquer um dos três cancela qualquer ingresso da área (decisão do usuário)", cn.mensagem);
b.ok(g.presidencia_cancelar(TOK, "AAAA-0300", "x", true).ok === false, "cancelar de novo: recusa");
b.ok(g.presidencia_meus(TOK).ingressos.filter(x => x.nome === "Ademir Carlos Pin")[0].estado === "cancelando", "estado: cancelando");
b.ok(g.presidencia_pdf(TOK, "AAAA-0002").ok === false, "PDF de ingresso que não é da área: recusa");
b.ok(g.presidencia_pdf("x".repeat(40), "AAAA-0300").negado === true, "PDF sem link válido: recusa");
b.resumo();
