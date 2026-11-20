/**
 * CAIXA DA SECRETARIA COM OS CARDS DE OFÍCIOS (03/11/2026). Desenho aprovado:
 * docs/mock-caixa-secretaria-oficios.png. O usuário: "2 - Inicia".
 *
 * Backend real, leitor da Secretaria REAL (vpe-simulador), tela real (jsdom),
 * IA FALSA e dados FICTÍCIOS.
 *
 * Prova:
 *   - e-mail de ficha de filiação / desfiliação / oposição vai para o card de
 *     ofício certo (regra no SISGEP; o leitor não muda); dúvida de filiação
 *     sem ficha fica em Filiação; comprovante continua em Contribuições;
 *   - os cards de ofício são só da secretaria@ (nem aparecem, nem se aceitam
 *     na financeiro@); arrastar ensina o robô (e o exemplo que vai ao leitor
 *     usa o tipo que ele conhece);
 *   - "Ver ofício": tipo, escola (pelo e-mail de quem escreveu), para, a
 *     pessoa lida do anexo com CPF conferido, situação (filiado? já tem ofício?);
 *   - "Abrir em Ofícios" valida (uma escola, CPF), guarda o que mudou na
 *     memória do robô e entrega ao Novo Ofício o tipo, a escola, as pessoas e
 *     a ficha anexa. NADA é emitido.
 *
 * NÃO PROVA: a IA de verdade (letra à mão), o Novo Ofício de verdade se
 * preenchendo (coberto pelo t229 no caminho das fichas), a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "OPERADOR", "ATIVO", "NAO", "comunicacao"]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
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
SIM.ciclo();
const painel = () => g.caixaSecretariaPainel(T_SEC);
const item = assunto => painel().itens.find(i => i.assunto === assunto);

b.fluxo("CARDS DE OFÍCIOS · o servidor");
b.passo("1. Cada e-mail no card certo");
b.igual([item("Ficha de filiação — Maria Souza").tipo, item("Pedido de desfiliação").tipo, item("Carta de oposição").tipo],
  ["OFICIO_FILIACAO", "OFICIO_DESFILIACAO", "OFICIO_OPOSICAO"], "ficha → filiação; carta → desfiliação; oposição → oposição");
b.igual(item("Dúvida sobre filiação").tipo, "FILIACAO", "dúvida sem ficha continua em Filiação");
b.igual(item("ENC: Documentos para a sindicalização | Pessoa Exemplo").tipo, "OFICIO_FILIACAO", "o leitor disse Outros, mas fala em sindicalização e tem a ficha: card de ofício de filiação (06/11/2026)");
b.igual(item("Documentos do funcionário").tipo, "OUTRO", "documentos sem ficha nem sindicalização continuam em Outros");
b.igual(item("Comprovante de outubro").tipo, "FINANCEIRO", "comprovante continua em Contribuições");
b.ok(item("Ficha de filiação — Maria Souza").grupo === "OFICIOS", "o item sabe que é de ofício (para o botão Ver ofício)");
const p0 = painel();
b.ok(p0.tipos.filter(t => t.grupo === "OFICIOS").length === 4 && p0.tipos.filter(t => t.grupo === "OFICIOS").every(t => t.caixa === "SECRETARIA"),
  "4 cards de ofício (as duas taxas num só), todos da secretaria@");
b.ok(g.crcCandidatos_().every(c => JSON.parse(c.p.MENSAGENS_JSON)[0].assunto !== "Carta de oposição"), "o robô dos comprovantes não lê a carta de oposição");

b.passo("1b. Taxa junto com a mensalidade (\"geralmente pede junto\"): fica em Contribuições, com o aviso");
const iTN = item("Mensalidade e taxa negocial de outubro"), iTA = item("Mensalidade e contribuição assistencial");
b.ok(iTN.tipo === "FINANCEIRO" && iTN.oficioJunto === "OFICIO_TAXA" && /Taxa negocial \/ assistencial/.test(iTN.oficioJuntoRotulo), "fica em Contribuições e avisa: também pede ofício de taxa");
b.ok(!item("Comprovante de outubro").oficioJunto && !item("Carta de oposição").oficioJunto, "comprovante sem taxa e oposição: sem aviso");
b.ok(g.crcCandidatos_().some(c => JSON.parse(c.p.MENSAGENS_JSON)[0].assunto === "Mensalidade e taxa negocial de outubro"), "o robô dos comprovantes continua lendo este e-mail");
const ofTN = g.caixaOficioJuntoDoEmail(iTN.id, T_SEC).oficio, ofTA = g.caixaOficioJuntoDoEmail(iTA.id, T_SEC).oficio;
b.igual([ofTN.tipo, ofTA.tipo, ofTN.escola && ofTN.escola.cnpj], ["Taxa Negocial", "Taxa Assistencial", "11.222.333/0001-81"], "o ofício de taxa: negocial ou assistencial pelo texto, escola pelo e-mail");
b.ok(g.caixaOficioDoEmail(iTN.id, T_SEC).oficio === null, "e o e-mail em si não vira card de ofício (fica num lugar só)");
const prTN = g.caixaOficioPreparar(iTN.id, { tipo: "Taxa Negocial", escolaCnpj: "11222333000181", card: "OFICIO_TAXA", pessoas: [{ nome: "Maria Souza", cpf: "11144477735" }] }, T_SEC);
b.ok(prTN.ok && prTN.oficio.tipo === "Taxa Negocial", "prepara para o Novo Ofício", prTN.mensagem);
b.ok(g.caixaSecretariaReclassificar(iTA.id, "OFICIO_TAXA_ASSISTENCIAL", T_SEC).ok && item("Mensalidade e contribuição assistencial").tipo === "OFICIO_TAXA", "o nome antigo do card vai para o card único");
g.caixaSecretariaReclassificar(iTA.id, "FINANCEIRO", T_SEC);

b.passo("2. Só da secretaria@");
const idDuv = item("Dúvida sobre filiação").id;
b.ok(!g.caixaSecretariaReclassificar("F:t1", "OFICIO_FILIACAO", TOKEN).ok, "na financeiro@, card de ofício não se aceita");
const det = g.caixaSecretariaDetalhe(item("Comprovante de outubro").id, T_SEC);
b.ok(det.tipos.some(t => t.chave === "OFICIO_TAXA"), "na secretaria@, os cards de ofício estão no Mudar o tipo");

b.passo("3. Arrastar ensina; o leitor recebe o tipo que conhece");
const rc = g.caixaSecretariaReclassificar(idDuv, "OFICIO_FILIACAO", T_SEC);
b.ok(rc.ok, "mudou para Ofício de filiação", rc.mensagem);
const mem = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues(), cab = mem[0].map(String);
const ult = mem[mem.length - 1];
b.igual([ult[cab.indexOf("SUGERIDO")], ult[cab.indexOf("DECIDIDO")]], ["FILIACAO", "OFICIO_FILIACAO"], "a memória: o card que estava × o que a equipe escolheu");
const exPonte = SIM.aba("Robo_Exemplos") || SIM.ponte.getSheets().find(s => /Exemplo|Memoria/i.test(s.getName()));
const exLinhas = exPonte ? exPonte.getDataRange().getValues() : [[]];
b.ok(!JSON.stringify(exLinhas).includes("OFICIO_"), "nenhum exemplo com OFICIO_ vai para a IA do leitor (ele não conhece)");
g.caixaSecretariaReclassificar(idDuv, "FILIACAO", T_SEC);

b.passo("4. Ver ofício: o que o robô preparou");
const idF = item("Ficha de filiação — Maria Souza").id;
const of1 = g.caixaOficioDoEmail(idF, T_SEC);
b.ok(of1.ok && of1.oficio, "preparou", of1.mensagem);
const o = of1.oficio;
b.igual([o.tipo, o.escola && o.escola.cnpj, o.para], ["Filiação", "11.222.333/0001-81", "rh@colegioalfa.exemplo.com"], "tipo, escola, para");
b.ok(/pelo e-mail de quem escreveu/.test(o.escolaOrigem), "a escola diz de onde veio", o.escolaOrigem);
b.igual([o.pessoas[0].nome, o.pessoas[0].cpf, o.pessoas[0].cpfOk], ["Maria Souza", "11144477735", true], "a pessoa lida da ficha, CPF conferido");
b.ok(o.pessoas[0].situacao.some(x => /não é filiad/.test(x)) && o.pessoas[0].situacao.some(x => /nenhum ofício de filiação/.test(x)), "situação: não é filiada, nenhum ofício", o.pessoas[0].situacao.join(" · "));
b.ok(chamadas[chamadas.length - 1].blocos === 1, "mandou a ficha anexa para a IA");
const n1 = chamadas.length;
g.caixaOficioDoEmail(idF, T_SEC);
b.igual(chamadas.length, n1, "abrir de novo não gasta IA");
const of2 = g.caixaOficioDoEmail(item("Pedido de desfiliação").id, T_SEC).oficio;
b.ok(of2.tipo === "Desfiliação" && of2.escola && /cadastro do associado/.test(of2.escolaOrigem) && of2.pessoas[0].nome === "JOAO LIMA",
  "desfiliação pelo próprio trabalhador: escola pelo CPF na base, nome da base", of2.escolaOrigem);
const of3 = g.caixaOficioDoEmail(item("Carta de oposição").id, T_SEC).oficio;
b.ok(of3.pessoas[0].alertas.some(x => /CPF não confere/.test(x)), "CPF errado: avisa");

b.passo("5. Abrir em Ofícios: valida, aprende e entrega ao Novo Ofício (sem emitir)");
b.ok(!g.caixaOficioPreparar(idF, { tipo: "Filiação", escolaCnpj: "", pessoas: [{ nome: "Maria Souza", cpf: "11144477735" }] }, T_SEC).ok, "sem escola: recusa");
b.ok(!g.caixaOficioPreparar(idF, { tipo: "Filiação", escolaCnpj: "11222333000181", pessoas: [{ nome: "Maria Souza", cpf: "11144477700" }] }, T_SEC).ok, "CPF inválido: recusa");
const linhasOficioAntes = (ss.getSheetByName(g.PLANILHA_REGISTRO) || { getLastRow: () => 0 }).getLastRow();
const pr = g.caixaOficioPreparar(idF, { tipo: "Filiação", escolaCnpj: "11.222.333/0001-81", pessoas: [{ nome: "MARIA SOUZA DA SILVA", cpf: "111.444.777-35" }] }, T_SEC);
b.ok(pr.ok, "preparou para o Novo Ofício", pr.mensagem);
b.igual([pr.oficio.tipo, pr.oficio.escola.cnpj, pr.oficio.pessoas[0].nome, pr.oficio.pessoas[0].cpf], ["Filiação", "11.222.333/0001-81", "MARIA SOUZA DA SILVA", "11144477735"], "tipo, escola, pessoa");
b.ok(pr.oficio.ficha && /ficha-filiacao\.pdf/.test(pr.oficio.ficha.nome), "com a ficha anexa do e-mail", JSON.stringify(pr.oficio.ficha));
b.igual((ss.getSheetByName(g.PLANILHA_REGISTRO) || { getLastRow: () => 0 }).getLastRow(), linhasOficioAntes, "nenhum ofício emitido");
const mem2 = ss.getSheetByName(g.ROBO_MEM_ABA).getDataRange().getValues();
const oe = mem2.filter(l => l[cab.indexOf("TAREFA")] === "oficio-email" && String(l[cab.indexOf("CHAVE")]) === idF);
b.ok(oe.length === 1 && oe[0][cab.indexOf("ACERTOU")] === "NAO", "a memória: o nome foi corrigido (o robô errou)");
b.ok(g.pddRobo_("SECRETARIA").some(t => t.tarefa === "oficio-email"), "e entra na medição do robô");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: T_SEC });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
g.listarEscolas = () => ESCOLAS.map(e => ({ nome: e.Fantasia, cnpj: e.documentoMascarado }));
(async function () {
  b.fluxo("CARDS DE OFÍCIOS · a tela");
  const recebido = [];
  win.ofdPreencherNovoOficio = o => recebido.push(o);
  win.ofdFormularioComDados = () => false;
  let foiPara = null;
  win.spIr = (m, x, op) => { foiPara = [m, op && op.sub]; };
  const sel = doc.createElement("select"); sel.id = "escola"; sel.innerHTML = "<option></option><option>Alfa</option>"; doc.body.appendChild(sel);
  win.cxsIniciar(); await t.assentar(300);
  const txt = t.texto("#cxsTipos");
  b.ok(/Ofícios/.test(txt) && /Ofício de filiação/.test(txt) && /Taxa negocial \/ assistencial/.test(txt) && !/📄 Taxa assistencial/.test(txt), "a linha Ofícios com os 4 cards (as duas taxas num só)", txt.slice(0, 200));
  b.ok(/Certificados e demais/.test(txt), "e a linha dos demais");
  el("cxsFEstado").value = ""; el("cxsFEstado").dispatchEvent(new win.Event("change", { bubbles: true })); await t.assentar(30);
  const bt = doc.querySelector("[data-cxs='abrir'][data-arg='" + idF + "']");
  b.ok(bt && bt.textContent === "Ver ofício", "o botão da linha é Ver ofício");
  t.clicar("[data-cxs='abrir'][data-arg='" + idF + "']"); await t.assentar(350);
  const painelOf = t.texto("#cxsMOficio");
  b.ok(/O ofício que o robô preparou/.test(painelOf) && /rh@colegioalfa/.test(painelOf) && /não é filiad/.test(painelOf), "o painel do ofício", painelOf.slice(0, 220));
  b.igual(el("cxsOfTipo").value, "Filiação", "tipo já escolhido");
  b.ok(/Colégio Alfa — 11\.222\.333\/0001-81/.test(el("cxsOfEscola").value), "escola já preenchida", el("cxsOfEscola").value);
  doc.querySelector("#cxsMOficio .cxs-of-cpf").value = "111.444.777-00";
  t.clicar("[data-cxs='ofAbrir']"); await t.assentar(200);
  b.ok(/CPF que não confere/.test(t.texto("#cxsOfConf")) && el("cxsModal").classList.contains("aberto"), "CPF errado: o aviso fica na janela");
  doc.querySelector("#cxsMOficio .cxs-of-cpf").value = "111.444.777-35";
  t.clicar("[data-cxs='ofAbrir']"); await t.assentar(400);
  b.ok(foiPara && foiPara[0] === "documentos" && foiPara[1] === "oficios", "foi para Documentos › Ofícios");
  b.ok(recebido.length === 1 && recebido[0].tipo === "Filiação" && recebido[0].pessoas[0].cpf === "11144477735" && recebido[0].ficha, "o Novo Ofício recebeu tipo, pessoa e ficha");
  b.ok(!el("cxsModal").classList.contains("aberto"), "a janela da Caixa fechou");
  b.naoTestavel("o Novo Ofício de verdade se preenchendo a partir da Caixa", "ver em HML (o preenchimento é o mesmo do t229)");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
