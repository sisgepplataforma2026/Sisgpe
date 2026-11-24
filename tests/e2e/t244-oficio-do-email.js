/**
 * OFÍCIO EMITIDO DO PRÓPRIO E-MAIL (06/11/2026). O usuário: "quando chega
 * ofício de sindicalização, eu tenho que ter ali no corpo do e-mail ... a
 * opção de enviar o ofício"; usar a MESMA emissão do módulo de Ofícios: "pode
 * sim"; desenho docs/mock-acoes-no-email.png com os 4 ajustes ("sim").
 *
 * Backend real (inclusive gerarOficioWeb, a emissão do módulo), leitor da
 * Secretaria REAL (vpe-simulador), tela real (jsdom), IA FALSA, dados FICTÍCIOS.
 * Prova: travas (conferi, escola, caixa de cada um); emite pela mesma
 * emissão (registro, fila de envio); só a ficha marcada vai junto; o e-mail
 * fica resolvido; a duplicata do módulo pergunta antes; a tela pede o
 * "Conferi" e o Sim.
 * NÃO PROVA: o PDF e a entrega do e-mail de verdade (no ar).
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "OPERADOR", "ATIVO", "NAO", "comunicacao,documentos"]);
const TOKEN = b.logar(g, "wanderson"), T_W = TOKEN, T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);
const getFileOrig = g.DriveApp.getFileById;
g.DriveApp.getFileById = id => { try { return getFileOrig(id); } catch (e) { return SIM.leitor.DriveApp.getFileById(id); } };

const ESCOLAS = [{ escola: "COLEGIO ALFA LTDA", Fantasia: "Colégio Alfa", cnpj: "11.222.333/0001-81", documentoMascarado: "11.222.333/0001-81",
  email: "rh@colegioalfa.exemplo.com", EmailsTodos: "", situacao: "ATIVA", EscolaID: "ESC-1" }];
g.listarEscolasCadastro_interno_ = () => ESCOLAS;
g.listarMensalidadeStatus = () => ({ ok: true, itens: [] });
g.consultarAssociadoPorCPF = cpf => cpf === "52998224725" ? { existe: true, filiado: true, nome: "JOAO LIMA", escola: "COLEGIO ALFA LTDA" } : { existe: false };
g.cfmOficios_ = () => [{ numero: "077/2026", tipo: "Desfiliação", cnpj: "11222333000181", pessoas: [{ nome: "PEDRO ANTIGO", cpf: "" }] }];
const chamadas = [];
g.vpeChamarIA_ = (prompt, blocos) => {
  chamadas.push({ prompt, blocos: (blocos || []).length });
  if (/pedido de Filiação/.test(prompt)) return { pessoas: [{ nome: "Maria Souza", cpf: "111.444.777-35", escola_escrita: "Colegio Alfa", tem_assinatura: true }] };
  if (/pedido de Desfiliação/.test(prompt)) return { pessoas: [{ nome: "Joao Lima", cpf: "52998224725", escola_escrita: "", tem_assinatura: true }] };
  if (/pedido de Oposição/.test(prompt)) return { pessoas: [{ nome: "Ana Reis", cpf: "123", escola_escrita: "Alfa" }] };
  return { resultados: [] };
};

SIM.novaThread("Ficha de filiação — Maria Souza", "RH Colégio Alfa <rh@colegioalfa.exemplo.com>", "Segue a ficha de filiação da colaboradora Maria Souza. TIPO:FILIACAO", [SIM.pdf("ficha-filiacao.pdf")]);
SIM.novaThread("Pedido de desfiliação", "João Lima <joao@exemplo.com>", "Venho solicitar minha desfiliação do sindicato. TIPO:FILIACAO", [SIM.pdf("carta-desfiliacao.pdf")]);
SIM.novaThread("Carta de oposição", "Ana Reis <ana@exemplo.com>", "Manifesto minha oposição à taxa negocial. TIPO:FINANCEIRO", [SIM.pdf("oposicao.pdf")]);
SIM.novaThread("Dúvida sobre filiação", "Bia <bia@exemplo.com>", "Como faço para saber se sou filiada? TIPO:FILIACAO", []);
SIM.novaThread("Comprovante de outubro", "RH Colégio Alfa <rh@colegioalfa.exemplo.com>", "Segue o comprovante de desconto. TIPO:FINANCEIRO", [SIM.pdf("comp.pdf")]);
SIM.novaThread("Mensalidade e taxa negocial de outubro", "RH Colégio Alfa <rh@colegioalfa.exemplo.com>", "Segue a relação da mensalidade sindical e da taxa negocial de outubro. TIPO:FINANCEIRO", [SIM.pdf("relacao.pdf")]);
SIM.novaThread("Mensalidade e contribuição assistencial", "RH Colégio Alfa <rh@colegioalfa.exemplo.com>", "Segue a mensalidade sindical e a contribuição assistencial. TIPO:FINANCEIRO", []);
SIM.novaThread("ENC: Documentos para a sindicalização | Pessoa Exemplo", "RH Escola <rh@escola.exemplo.com>", "Colaborador preencheu a ficha. TIPO:OUTRO", [SIM.pdf("contracheque.pdf"), SIM.pdf("Ficha sindicato.pdf")]);
SIM.novaThread("Documentos do funcionário", "RH Escola <rh@escola.exemplo.com>", "Seguem os documentos pedidos. TIPO:OUTRO", [SIM.pdf("contracheque.pdf")]);
SIM.novaThread("ENC: Documentos para a sindicalização | Pessoa Exemplo", "RH Colégio Alfa <rh@colegioalfa.exemplo.com>",
  "Colaboradora preencheu a ficha. TIPO:OUTRO", [SIM.pdf("contracheque.pdf"), SIM.pdf("Carteira de identidade.pdf"), SIM.pdf("Ficha sindicato.pdf")]);
SIM.ciclo();
/* A aba de registro dos ofícios (onde o gerarOficioWeb escreve), como no t129. */
let abaCtrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!abaCtrl) abaCtrl = ss.insertSheet(g.PLANILHA_REGISTRO);
abaCtrl.getRange(1, 1, 1, 12).setValues([["Número do Ofício", "Data envio ofício", "TIPO", "Escola (Razão Social)", "CNPJ", "E-mail (principal)",
  "Status", "CONFIG", "Observações", "Link PDF (Drive)", "Colaborador(es)", "E-mails (todos)"]]);
const painel = () => g.caixaSecretariaPainel(T_SEC);
const item = assunto => painel().itens.find(i => i.assunto === assunto);
const reg = () => (ss.getSheetByName(g.PLANILHA_REGISTRO) || { getLastRow: () => 1 }).getLastRow();
const fila = () => { const sh = ss.getSheetByName(g.ABA_FILA_ENVIO_OFICIOS || "FILA_ENVIO_OFICIOS"); return sh ? sh.getDataRange().getValues() : [[]]; };

b.fluxo("OFÍCIO · EMITIR E ENVIAR DO PRÓPRIO E-MAIL");
const idR = item("ENC: Documentos para a sindicalização | Pessoa Exemplo").id;
const of = g.caixaOficioDoEmail(idR, T_SEC);
b.ok(of.ok && of.oficio && of.oficio.tipo === "Filiação", "o e-mail de sindicalização (que o leitor chamou de Outros) prepara o ofício de filiação", of.mensagem);
const ax = of.oficio.anexosOficio || [];
b.igual(ax.filter(a => a.sugerido).map(a => a.nome), ["Ficha sindicato.pdf"], "o robô pré-marca só a ficha (contracheque e identidade não)");

b.passo("1. Travas antes de emitir");
const base = { tipo: "Filiação", escolaCnpj: "11.222.333/0001-81", card: of.oficio.card, pessoas: [{ nome: "Maria Souza", cpf: "111.444.777-35" }], anexos: ax.filter(a => a.sugerido).map(a => a.indice) };
const r0 = reg();
let r = g.caixaOficioEmitir(idR, Object.assign({}, base), T_SEC);
b.ok(!r.ok && /conferiu/.test(r.mensagem) && reg() === r0, "sem marcar 'conferi': não emite", r.mensagem);
r = g.caixaOficioEmitir(idR, Object.assign({}, base, { conferi: true, escolaCnpj: "" }), T_SEC);
b.ok(!r.ok && /escola/i.test(r.mensagem) && reg() === r0, "sem escola: não emite");
r = g.caixaOficioEmitir(idR, Object.assign({}, base, { conferi: true }), T_W);
b.ok(!r.ok && reg() === r0, "o Wanderson (financeiro@) não emite pela caixa da secretaria@");

b.passo("2. Emitir: a MESMA emissão do módulo de Ofícios");
r = g.caixaOficioEmitir(idR, Object.assign({}, base, { conferi: true }), T_SEC);
b.ok(r.ok && r.numero, "emitiu, com número", r.mensagem);
b.ok(reg() === r0 + 1, "1 linha nova no registro de ofícios (o mesmo do módulo)");
const sh = ss.getSheetByName(g.PLANILHA_REGISTRO), cabR = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
const ln = sh.getRange(sh.getLastRow(), 1, 1, cabR.length).getValues()[0];
const v = c => String(ln[cabR.indexOf(c)]);
b.ok(/Filia/.test(v("TIPO")) && v("CNPJ") === "11222333000181" && /Maria Souza/i.test(v("Colaborador(es)")) && v("E-mail (principal)") === "rh@colegioalfa.exemplo.com",
  "tipo, escola, pessoa e e-mail da escola", [v("TIPO"), v("CNPJ"), v("Colaborador(es)"), v("E-mail (principal)")].join(" | "));
const fl = JSON.stringify(fila());
b.ok(fl.indexOf(String(r.numero)) > -1, "foi para a fila de envio dos ofícios (quem envia é a fila de sempre)");
b.ok(/Ficha/.test(fl) && fl.indexOf("contracheque") === -1 && fl.indexOf("identidade") === -1, "vai junto só a ficha marcada — contracheque e identidade não vão para a escola");
const det = g.caixaSecretariaDetalhe(idR, T_SEC);
b.ok(det.item.estado === "RESOLVIDO" && /Ofício nº/.test(det.nota), "o e-mail fica resolvido, com a nota do número", det.nota);
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), cab = mem[0].map(String);
b.ok(mem.some(l => l[cab.indexOf("TAREFA")] === "oficio-email-emitido" && String(l[cab.indexOf("CHAVE")]) === idR), "o robô guarda o que propôs × o que foi");

b.passo("3. De novo para a mesma pessoa: o aviso de duplicata do módulo aparece");
r = g.caixaOficioEmitir(idR, Object.assign({}, base, { conferi: true }), T_SEC);
b.ok(!r.ok && r.duplicata && reg() === r0 + 1, "pergunta antes (como no Novo ofício)", r.mensagem);
r = g.caixaOficioEmitir(idR, Object.assign({}, base, { conferi: true, confirmarDuplicata: true }), T_SEC);
b.ok(r.ok && reg() === r0 + 2, "confirmado, emite");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: T_SEC });
(async function () {
  b.fluxo("OFÍCIO · NA TELA");
  t.win.cxsIniciar(); await t.assentar(200);
  const idD = item("Pedido de desfiliação").id;
  t.win.eval("void 0"); t.clicar("[data-cxs='abrir'][data-arg='" + idD + "']"); await t.assentar(300);
  const box = () => t.texto("#cxsMOficio");
  b.ok(/Emitir e enviar à escola/.test(box()) && /Ver e editar antes/.test(box()) && /Conferi a escola/.test(box()), "o quadro do ofício tem Emitir e enviar, Ver e editar e o 'Conferi'", box().slice(0, 200));
  const antes = reg();
  t.clicar("[data-cxs='ofEmitir']"); await t.assentar(50);
  b.ok(/Marque que conferiu/.test(box()) && reg() === antes, "sem o 'Conferi': pede para conferir");
  t.doc.getElementById("cxsOfConferi").checked = true;
  t.clicar("[data-cxs='ofEmitir']"); await t.assentar(50);
  b.ok(/Sim, emitir e enviar/.test(box()) && /enviar para/.test(box()) && reg() === antes, "mostra o que vai e para quem, e espera o Sim");
  t.clicar("[data-cxs='ofEmitir'][data-arg='sim']"); await t.assentar(300);
  b.ok(/emitido/.test(box()) && reg() === antes + 1, "Sim: emitido pela mesma emissão", box().slice(0, 160));
  b.naoTestavel("o PDF e o e-mail de verdade", "em HML: abrir um e-mail de sindicalização, Emitir e enviar, e conferir no Monitoramento de Ofícios");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
