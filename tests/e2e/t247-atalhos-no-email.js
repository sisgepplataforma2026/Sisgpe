/**
 * ATALHOS NO E-MAIL — FASE 1 (10/11/2026). O usuário: "tudo que a gente
 * oferece no sindicato ... a gente deveria ter esses atalhos direto"; "B,
 * começa pela fase 1".
 *
 * Backend real (a preparação e a EMISSÃO do módulo de Ofícios), leitor REAL
 * (vpe-simulador), tela real (jsdom), IA FALSA, dados FICTÍCIOS.
 * Prova: o robô sugere com o motivo (pelo card, pelo anexo, pelo que a
 * equipe mais faz) e não chuta ofício numa dúvida; os atalhos aparecem em
 * QUALQUER e-mail (também nos que não estão no card de ofício); o ofício do
 * tipo escolhido sai pela MESMA emissão (registro); taxa assistencial;
 * quem não tem o módulo não vê voucher/NF; a memória guarda o atalho e a
 * medição aparece; na tela, "Mais ações" e o atalho abrem o quadro do ofício.
 * NÃO PROVA: o PDF e a entrega do e-mail (no ar).
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


const sug = id => g.caixaAtalhos(id, T_SEC);
b.fluxo("ATALHOS · o robô sugere, com o motivo");
const idFicha = item("Ficha de filiação — Maria Souza").id;
let a = sug(idFicha);
b.ok(a.ok && a.sugeridos[0] && a.sugeridos[0].acao === "OF_FILIACAO" && /card/.test(a.sugeridos[0].motivo), "ficha de filiação: sugere o ofício de filiação, pelo card", JSON.stringify(a.sugeridos));
a = sug(item("Carta de oposição").id);
b.ok(a.sugeridos.some(s => s.acao === "OF_OPOSICAO"), "carta de oposição: sugere o ofício de oposição", JSON.stringify(a.sugeridos));
a = sug(item("Dúvida sobre filiação").id);
b.ok(!a.sugeridos.some(s => /^OF_/.test(s.acao)), "dúvida sobre filiação: NÃO chuta ofício", JSON.stringify(a.sugeridos));
const idDocs = item("Documentos do funcionário").id;
a = sug(idDocs);
b.ok(["OF_FILIACAO", "OF_DESFILIACAO", "OF_OPOSICAO", "OF_TAXA", "OF_ASSISTENCIAL", "ENCAMINHAR"].every(k => a.todas.some(x => x.acao === k)),
  "e-mail em Outros: todos os atalhos de ofício estão em Mais ações", a.todas.map(x => x.acao).join(","));
b.ok(!a.todas.some(x => x.acao === "VOUCHER" || x.acao === "NF_CONTAB"), "sem o módulo Benefícios/Financeiro: voucher e NF não aparecem para ela");

b.fluxo("ATALHOS · o ofício do tipo escolhido, pela mesma emissão");
let of2 = g.caixaOficioComTipo(idDocs, "OFICIO_DESFILIACAO", false, T_SEC);
b.ok(of2.ok && of2.oficio.tipo === "Desfiliação" && /atalho/.test(of2.oficio.tipoOrigem), "Desfiliação, com a origem 'pelo atalho'", of2.mensagem || of2.oficio.tipoOrigem);
of2 = g.caixaOficioComTipo(idDocs, "OFICIO_TAXA_ASSISTENCIAL", false, T_SEC);
b.ok(of2.ok && of2.oficio.tipo === "Taxa Assistencial", "Taxa assistencial", of2.oficio && of2.oficio.tipo);
b.ok(!g.caixaOficioComTipo(idDocs, "VOUCHER", false, T_SEC).ok, "tipo inválido é recusado");
const idDesf = item("Pedido de desfiliação").id;
of2 = g.caixaOficioComTipo(idDesf, "OFICIO_DESFILIACAO", false, T_SEC);
const r1 = reg();
const em = g.caixaOficioEmitir(idDesf, { tipo: "Desfiliação", escolaCnpj: "11.222.333/0001-81", card: of2.oficio.card, conferi: true,
  pessoas: [{ nome: "Joao Lima", cpf: "52998224725" }], anexos: [0] }, T_SEC);
b.ok(em.ok && reg() === r1 + 1, "emitiu pelo mesmo caminho do módulo de Ofícios (registro +1)", em.mensagem);

b.fluxo("ATALHOS · o robô aprende");
g.caixaAtalhoUsado(idDocs, "OF_DESFILIACAO", "", T_SEC);
g.caixaAtalhoUsado(idDocs, "OF_DESFILIACAO", "", T_SEC);
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), cab = mem[0].map(String);
b.ok(mem.filter(l => l[cab.indexOf("TAREFA")] === "atalho-email" && l[cab.indexOf("DECIDIDO")] === "OF_DESFILIACAO").length === 2, "a memória guarda o atalho usado");
a = sug(item("Documentos do funcionário").id);
b.ok(a.sugeridos.some(s => s.acao === "OF_DESFILIACAO" && /mais fazem/.test(s.motivo)), "o mais usado neste tipo de e-mail volta como sugestão", JSON.stringify(a.sugeridos));
g.caixaAtalhoUsado(idFicha, "OF_FILIACAO", "OF_FILIACAO", T_SEC);
b.ok(g.caixaRoboMedicao(T_SEC).robo.some(x => x.tarefa === "atalho-email"), "a medição do atalho aparece no rodapé");
b.ok(!g.caixaAtalhoUsado(idDocs, "APAGAR_TUDO", "", T_SEC).ok, "atalho inválido é recusado");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: T_SEC });
(async function () {
  b.fluxo("ATALHOS · na tela");
  t.win.cxsIniciar(); await t.assentar(400);
  t.clicar("[data-cxs='abrir'][data-arg='" + item("Dúvida sobre filiação").id + "']"); await t.assentar(300);
  const box = () => t.texto("#cxsMAtalhos");
  b.ok(/Atalhos/.test(box()) && /Mais ações/.test(box()), "o e-mail aberto tem a barra de atalhos", box().slice(0, 160));
  t.clicar("[data-cxs='atalhoMais']"); await t.assentar(20);
  b.ok(t.doc.getElementById("cxsMAtalhosMais").style.display !== "none", "Mais ações abre a lista");
  t.clicar("#cxsMAtalhosMais [data-cxs='atalho'][data-arg='OF_DESFILIACAO']"); await t.assentar(400);
  b.ok(/Desfiliação/.test(t.texto("#cxsMOficio")), "o atalho abre o quadro do ofício de desfiliação", t.texto("#cxsMOficio").slice(0, 160));
  b.ok(t.chamadas.some(c => c.fn === "caixaAtalhoUsado" && c.args[1] === "OF_DESFILIACAO"), "e a tela avisa o robô qual atalho foi usado");
  b.naoTestavel("o PDF e a entrega do e-mail do ofício", "em HML: abrir um e-mail em Outros, Mais ações › Fazer ofício, conferir e emitir");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
