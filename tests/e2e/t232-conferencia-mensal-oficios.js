/**
 * CONFERÊNCIA MENSAL — OFÍCIO ENVIADO × LISTA DA ESCOLA (03/11/2026, etapa
 * 2 do robô das fichas). O usuário: "no próximo mês, ele deve conferir se
 * aquela pessoa está na lista de contribuição. Se não estiver, ... me propor
 * um e-mail ou ... me mostrar".
 *
 * Prova (backend real, tela real em jsdom, dados FICTÍCIOS):
 *   - a lista da escola entra quando a Caixa lê o comprovante (e não duplica);
 *   - filiação: quem não consta aparece; desfiliação: quem ainda é
 *     descontado aparece; oposição: compara com a lista da taxa negocial;
 *   - só vale lista de mês DEPOIS do ofício; ofício velho sem lista aparece
 *     em "sem lista";
 *   - o e-mail proposto cita o ofício, as pessoas e a CCT pelo MTE; nada sai;
 *   - "Já tratei" tira da conferência;
 *   - na tela: a aba, o Propor e-mail e o Abrir no Novo e-mail (a Caixa abre
 *     com o e-mail escrito).
 *
 * NÃO PROVA: a leitura da lista de verdade (comprovante real), a entrega.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

/* ── os ofícios enviados (planilha de registro) ── */
let reg = ss.getSheetByName(g.PLANILHA_REGISTRO);
const CAB = ["Status", "Número do Ofício", "Data envio ofício", "TIPO", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "Colaborador(es)"];
if (!reg) { reg = ss.insertSheet(g.PLANILHA_REGISTRO); reg.getRange(1, 1, 1, CAB.length).setValues([CAB]); }
else if (reg.getLastRow() < 1) reg.getRange(1, 1, 1, CAB.length).setValues([CAB]);
const cabReg = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0].map(String);
CAB.forEach(c => { if (cabReg.indexOf(c) === -1) { reg.getRange(1, cabReg.length + 1).setValue(c); cabReg.push(c); } });
function oficio(o) { reg.appendRow(cabReg.map(c => o[c] !== undefined ? o[c] : "")); }
const set20 = new Date(2026, 8, 20), out05 = new Date(2026, 9, 5), ago10 = new Date(2026, 7, 10);
oficio({ "Status": "ENVIADO", "Número do Ofício": "120/2026", "Data envio ofício": out05, "TIPO": "Filiação", "Escola (Razão Social)": "SOCIEDADE EDUCACIONAL ALFA LTDA",
  "CNPJ": "11.222.333/0001-81", "E-mail (principal)": "rh@alfa.exemplo.com", "Colaborador(es)": "1. MARIA SOUZA\n2. CAIO REIS\n3. ANA LIMA" });
oficio({ "Status": "ENVIADO", "Número do Ofício": "098/2026", "Data envio ofício": set20, "TIPO": "Desfiliação", "Escola (Razão Social)": "ESCOLA BETA LTDA",
  "CNPJ": "22.333.444/0001-55", "E-mail (principal)": "beta@exemplo.com", "Colaborador(es)": "1. JOÃO LIMA" });
oficio({ "Status": "ENVIADO", "Número do Ofício": "101/2026", "Data envio ofício": set20, "TIPO": "Oposição à Taxa Negocial", "Escola (Razão Social)": "ESCOLA BETA LTDA",
  "CNPJ": "22.333.444/0001-55", "E-mail (principal)": "beta@exemplo.com", "Colaborador(es)": "1. RUI COSTA" });
oficio({ "Status": "ENVIADO", "Número do Ofício": "077/2026", "Data envio ofício": ago10, "TIPO": "Filiação", "Escola (Razão Social)": "ESCOLA GAMA",
  "CNPJ": "44.555.666/0001-00", "E-mail (principal)": "gama@exemplo.com", "Colaborador(es)": "1. BIA MELO" });
oficio({ "Status": "ENVIADO", "Número do Ofício": "130/2026", "Data envio ofício": out05, "TIPO": "Taxa Negocial", "Escola (Razão Social)": "OUTRA",
  "CNPJ": "99.999.999/0001-99", "Colaborador(es)": "" });
/* CPF da filiação: o Controle de Mensalidade (NOME, CPF, ESCOLA, FILIADO, Nº OFÍCIO…) */
let men = ss.getSheetByName("Mensalidade_Controle");
if (!men) { men = ss.insertSheet("Mensalidade_Controle"); men.appendRow(["NOME", "CPF", "ESCOLA", "FILIADO", "NUMERO_OFICIO", "DATA_OFICIO", "STATUS", "DATA_ULTIMA_COB", "OBS"]); }
men.appendRow(["MARIA SOUZA", "11144477735", "SOCIEDADE EDUCACIONAL ALFA LTDA", "S", "120/2026", "05/10/2026", "AGUARDANDO", "", ""]);

b.fluxo("CONFERÊNCIA MENSAL · o servidor");
b.passo("1. A lista da escola entra quando a Caixa lê o comprovante");
g.listarEscolasCadastro_interno_ = () => [
  { escola: "SOCIEDADE EDUCACIONAL ALFA LTDA", Fantasia: "COLÉGIO ALFA", cnpj: "11.222.333/0001-81", email: "rh@alfa.exemplo.com" },
  { escola: "ESCOLA BETA LTDA", Fantasia: "ESCOLA BETA", cnpj: "22.333.444/0001-55", email: "beta@exemplo.com" }];
g.listarMensalidadeStatus = () => ({ ok: true, itens: [] });
const m = { getId: () => "CM1", getFrom: () => "RH Alfa <rh@alfa.exemplo.com>", getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
  getSubject: () => "Relação de mensalidade outubro", getDate: () => new Date(), getPlainBody: () => "Segue a relação.",
  getAttachments: () => [{ getName: () => "rel.pdf", getContentType: () => "application/pdf", getSize: () => 10, getBytes: () => [37, 80] }] };
g.cxsGmailFinanceiro_ = () => ({
  search: q => (/^in:inbox/.test(q) && !/has:attachment/.test(q) ? [{ getId: () => "t1", getMessages: () => [m] }] : []),
  getThreadById: id => id === "t1" ? { getId: () => "t1", getMessages: () => [m] } : null, getMessageById: () => m,
  getUserLabels: () => [], getUserLabelByName: () => null });
g.vpeChamarIA_ = p => /comprovantes de desconto/.test(p)
  ? { e_comprovante: true, tipo: "MENSALIDADE", mes: "11", ano: "2026", valor: "R$ 100", quantidade: 2, pessoas: [{ nome: "Maria Souza", cpf: "111.444.777-35" }, { nome: "ANA LIMA", cpf: "" }] }
  : { resultados: [] };
g.caixaFinanceiroItens(TOKEN);
b.ok(g.caixaLerComprovante("F:t1", TOKEN).ok, "a Caixa leu o comprovante");
g.caixaLerComprovante("F:t1", TOKEN);
b.igual(ss.getSheetByName("Contribuicao_Listas").getLastRow() - 1, 1, "a lista foi guardada uma vez (abrir de novo não duplica)");
/* A escola Beta mandou as listas de outubro (mensalidade e taxa). */
g.cfmGuardarLista_("22333444000155", "ESCOLA BETA", "MENSALIDADE", "10/2026", [{ nome: "João Lima" }, { nome: "Outra Pessoa" }], "x1", "teste");
g.cfmGuardarLista_("22333444000155", "ESCOLA BETA", "TAXA_NEGOCIAL", "10/2026", [{ nome: "Fulano" }], "x2", "teste");
/* Lista do MESMO mês do ofício não vale ("no próximo mês"). */
g.cfmGuardarLista_("11222333000181", "COLÉGIO ALFA", "MENSALIDADE", "10/2026", [{ nome: "Ninguém" }], "x0", "teste");
/* Lista antiga (do mesmo mês do ofício) não vale. */
g.cfmGuardarLista_("44555666000100", "ESCOLA GAMA", "MENSALIDADE", "08/2026", [{ nome: "Ninguém" }], "x3", "teste");

b.passo("2. A conferência");
const r = g.oficiosConferenciaMensal(TOKEN);
b.ok(r.ok, "abre", r.mensagem);
const alfa = r.problemas.find(p => p.numero === "120/2026");
b.ok(alfa && alfa.situacao === "não consta" && alfa.problema.map(p => p.nome).join() === "CAIO REIS" && alfa.ok.length === 2,
  "filiação: Caio não consta; Maria (pelo CPF) e Ana (pelo nome) constam", JSON.stringify(alfa && [alfa.problema, alfa.ok]));
const beta = r.problemas.find(p => p.numero === "098/2026");
b.ok(beta && beta.situacao === "ainda descontado" && beta.problema[0].nome === "JOÃO LIMA", "desfiliação: João ainda descontado");
b.ok(!r.problemas.some(p => p.numero === "101/2026"), "oposição: Rui não está na lista da taxa — certo, sem pendência");
b.ok(r.semLista.some(x => x.numero === "077/2026"), "ofício velho sem lista de mês depois: aparece em 'sem lista'");
b.ok(!r.problemas.some(p => p.numero === "130/2026") && !r.semLista.some(x => x.numero === "130/2026"), "ofício de cobrança de taxa não entra");

b.passo("3. O e-mail proposto (não sai)");
const e = g.oficiosConferenciaEmail(alfa.chave, TOKEN);
b.ok(e.ok && e.email.para === "rh@alfa.exemplo.com", "para a escola", e.mensagem);
b.ok(/Ofício de Filiação nº 120\/2026/.test(e.email.texto) && /CAIO REIS/.test(e.email.texto) && !/MARIA/.test(e.email.texto), "cita o ofício e só quem falta");
b.ok(/38ª — registro MTE ES000256\/2026/.test(e.email.texto), "a CCT pela numeração do MTE");
const eb = g.oficiosConferenciaEmail(beta.chave, TOKEN);
b.ok(/cesse o desconto/.test(eb.email.texto), "desfiliação: pede para cessar o desconto");
b.igual(amb.outbox.length, 0, "nada saiu");
b.passo("4. Já tratei");
b.ok(g.oficiosConferenciaTratado(beta.chave, "liguei para a escola", TOKEN).ok, "marcou");
b.ok(!g.oficiosConferenciaMensal(TOKEN).problemas.some(p => p.numero === "098/2026"), "sai da conferência");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
let t;
try { t = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html", "OficiosFichasDriveUI.html", "VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN }); }
catch (err) { b.naoTestavel("a tela no jsdom", err.message); b.resumo(); process.exit(0); }
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
win.spIr = mod => { if (mod === "caixaSecretaria") win.cxsIniciar(); };
(async function () {
  b.fluxo("CONFERÊNCIA MENSAL · a tela");
  await t.assentar(300);
  el("abaConferenciaMensal").click(); await t.assentar(250);
  b.ok(el("blocoConferenciaMensal").style.display === "block", "a aba abre");
  b.ok(/SOCIEDADE EDUCACIONAL ALFA/.test(t.texto("#cfmLista")) && /não consta \(1\)/.test(t.texto("#cfmLista")) && /CAIO REIS/.test(t.texto("#cfmLista")), "a pendência da Alfa", t.texto("#cfmLista").slice(0, 200));
  b.ok(/ESCOLA GAMA/.test(t.texto("#cfmSemLista")), "e o ofício sem lista");
  t.clicar("[data-ofd='cfmEmail'][data-arg='" + alfa.chave + "']"); await t.assentar(250);
  b.ok(/CAIO REIS/.test(el("cfmTexto").value), "o e-mail proposto aparece, editável");
  t.clicar("[data-ofd='cfmAbrirNovo']"); await t.assentar(400);
  b.ok(el("cxsNovo").classList.contains("aberto"), "abriu o Novo e-mail da Caixa");
  b.ok(el("cxsNPara").value === "rh@alfa.exemplo.com" && /120\/2026/.test(el("cxsNAssunto").value) && /CAIO REIS/.test(el("cxsNTexto").value), "já escrito");
  b.igual(amb.outbox.length, 0, "e nada saiu sem o clique");
  b.naoTestavel("o comprovante real e a entrega", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
