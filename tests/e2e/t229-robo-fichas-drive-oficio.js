/**
 * ROBÔ DAS FICHAS DO DRIVE → OFÍCIO (03/11/2026). Desenho aprovado:
 * docs/mock-robo-fichas-oficio.png.
 *
 * Prova (backend real, Drive e IA FALSOS, dados FICTÍCIOS):
 *   - acha as 3 pastas do ano pelo nome (e acha sozinho o ano novo);
 *   - fichas que já estavam lá na 1ª vez contam como feitas;
 *   - o tipo vem da pasta; a "Oficio de Filiação" não é lida;
 *   - um PDF com várias fichas vira várias pessoas, cada uma conferida:
 *     CPF pelo dígito, na base de associados, escola pelo associado / pelo
 *     que a equipe corrigiu antes / pelo nome parecido; sem certeza, pede;
 *   - preparar exige uma escola por ofício e CPF válido, guarda o que foi
 *     corrigido (o robô aprende) e devolve o que o Novo Ofício precisa;
 *   - na tela, o Novo Ofício real (OficiosFormulario/OficiosScripts) se
 *     preenche: tipo, escola, trabalhadores e a ficha do Drive anexada;
 *   - nada é emitido nem enviado.
 *
 * NÃO PROVA: a leitura de letra de mão de verdade (precisa das fichas reais
 * em HML), o Drive de verdade, a emissão (é a de sempre, não mudou).
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* ── Drive falso: a árvore da pasta-mãe ── */
let seqF = 0;
const agora = Date.now();
function arquivo(nome, mime, criadoMs) {
  const id = "ARQ" + (++seqF) + "xxxxxxxxxxxxxxxxxxxxxxxx";
  return { getId: () => id, getName: () => nome, getMimeType: () => mime, getDateCreated: () => new Date(criadoMs),
    getSize: () => 2048, getBlob: () => ({ getBytes: () => [37, 80, 68, 70], getName: () => nome }), getUrl: () => "https://drive.google.com/file/d/" + id };
}
function pasta(nome, filhas, arquivos) {
  const p = { nome, filhas: filhas || [], arquivos: arquivos || [] };
  p.obj = { getName: () => nome, getId: () => "P_" + nome,
    getFolders: () => { let i = 0; return { hasNext: () => i < p.filhas.length, next: () => p.filhas[i++].obj }; },
    getFiles: () => { let i = 0; return { hasNext: () => i < p.arquivos.length, next: () => p.arquivos[i++] }; } };
  return p;
}
const antiga = arquivo("ficha-antiga.pdf", "application/pdf", agora - 30 * 864e5);
const fichaFil = pasta("Ficha de Filiação", [], [antiga]);
const oficiosGerados = pasta("Oficio de Filiação", [], [arquivo("OFICIO 120.pdf", "application/pdf", agora + 1000)]);
const fil2026 = pasta("FILIAÇÕES 2026", [fichaFil, oficiosGerados]);
const desf2026 = pasta("DESFILIAÇÃO 2026");
const taxa2026 = pasta("TAXA NEGOCIAL 2026");
const mae = pasta("MAE", [pasta("FILIAÇÕES", [pasta("FILIAÇÕES 2025"), fil2026]), pasta("DESFILIAÇÕES", [pasta("DESFILIAÇÃO 2025"), desf2026, taxa2026])]);
const arquivosPorId = () => { const m = {}; [fichaFil, oficiosGerados, desf2026, taxa2026].forEach(p => p.arquivos.forEach(a => { m[a.getId()] = a; })); return m; };
g.DriveApp.getFolderById = id => id === g.OFD_PASTA_MAE ? mae.obj : null;
const getFileOrig = g.DriveApp.getFileById;
g.DriveApp.getFileById = id => arquivosPorId()[id] || getFileOrig(id);

/* ── o cadastro (fictício) ── */
g.listarEscolasCadastro_interno_ = () => [
  { escola: "SOCIEDADE EDUCACIONAL ALFA LTDA", Fantasia: "COLÉGIO ALFA", cnpj: "11.222.333/0001-81", documentoMascarado: "11.222.333/0001-81", email: "rh@alfa.exemplo.com", EscolaID: "E1" },
  { escola: "ESCOLA PEQUENO PRÍNCIPE LTDA", Fantasia: "ESCOLA PEQUENO PRÍNCIPE", cnpj: "44.555.666/0001-00", documentoMascarado: "44.555.666/0001-00", email: "pp@exemplo.com", EscolaID: "E2" },
  { escola: "CENTRO EDUCACIONAL PEQUENO PRÍNCIPE", Fantasia: "CEI PEQUENO PRINCIPE SERRA", cnpj: "77.888.999/0001-11", documentoMascarado: "77.888.999/0001-11", email: "pps@exemplo.com", EscolaID: "E3" },
  { escola: "ESCOLA BETA LTDA", Fantasia: "ESCOLA BETA", cnpj: "22.333.444/0001-55", documentoMascarado: "22.333.444/0001-55", email: "beta@exemplo.com", EscolaID: "E4" }
];
const BASE = { "39053344705": { existe: true, nome: "JOÃO LIMA", filiado: true, escola: "ESCOLA BETA", matricula: "M1" } };
g.consultarAssociadoPorCPF = cpf => BASE[String(cpf)] || { existe: false };
let respostaIA = null, pedidosIA = 0;
g.vpeChamarIA_ = function (prompt, blocos) { pedidosIA++; g.__ultimoBloco = blocos && blocos[0]; return respostaIA; };

b.fluxo("FICHAS DO DRIVE · o servidor");
b.passo("1. Primeira vez: o que já estava nas pastas conta como feito");
const l0 = g.oficiosFichasListar(TOKEN);
b.ok(l0.ok && l0.itens.length === 0 && !l0.avisos.length, "nenhuma ficha (a antiga não aparece), as 3 pastas achadas", JSON.stringify(l0.avisos || l0.mensagem));
b.passo("2. Fichas novas aparecem, com o tipo da pasta");
const pdf4 = arquivo("fichas-colegio-alfa.pdf", "application/pdf", agora + 5000);
const pdf1 = arquivo("ficha-0311.jpg", "image/jpeg", agora + 6000);
fichaFil.arquivos.push(pdf4, pdf1);
desf2026.arquivos.push(arquivo("desfiliacao-joao.pdf", "application/pdf", agora + 7000));
taxa2026.arquivos.push(arquivo("oposicao-ana.pdf", "application/pdf", agora + 8000), arquivo("planilha.xlsx", "application/vnd.ms-excel", agora + 8000));
const l1 = g.oficiosFichasListar(TOKEN);
b.igual(l1.itens.map(i => i.tipo).sort(), ["Desfiliação", "Filiação", "Filiação", "Oposição à Taxa Negocial"], "4 fichas, tipo pela pasta (planilha fica de fora)");
b.ok(!l1.itens.some(i => /OFICIO 120/.test(i.nome)), "a pasta dos ofícios gerados não é lida");
b.igual(g.oficiosFichasListar(TOKEN).itens.length, 4, "abrir de novo não duplica");

b.passo("3. Um PDF com 4 fichas: cada pessoa conferida");
respostaIA = { fichas: [
  { pagina: 1, nome: "Maria Souza", cpf: "111.444.777-35", escola_escrita: "Col. Alfa", tem_assinatura: true },
  { pagina: 2, nome: "Caio Reis", cpf: "52998224725", escola_escrita: "colegio alfa", tem_assinatura: true },
  { pagina: 3, nome: "Ana Lima", cpf: "15350946056", escola_escrita: "Colégio Alfa", tem_assinatura: true },
  { pagina: 4, nome: "J?ão Pereira", cpf: "12345678900", escola_escrita: "Col Alfa", duvidas: "CPF borrado", tem_assinatura: true } ] };
const lr = g.oficiosFichasLer(pdf4.getId(), TOKEN);
b.ok(lr.ok, "leu", lr.mensagem);
b.ok(g.__ultimoBloco && g.__ultimoBloco.type === "document", "mandou o PDF para a IA");
const ps = lr.item.leitura.pessoas;
b.igual(ps.length, 4, "4 pessoas");
b.ok(ps.slice(0, 3).every(p => p.ok && p.escola && p.escola.cnpj === "11.222.333/0001-81"), "3 certas, escola COLÉGIO ALFA pelo nome escrito", JSON.stringify(ps.map(p => [p.ok, p.alertas])));
b.ok(/pelo nome escrito na ficha/.test(ps[0].escolaOrigem), "com a origem à vista", ps[0].escolaOrigem);
b.ok(!ps[3].ok && ps[3].alertas.some(a => /CPF não confere/.test(a)), "a 4ª: CPF não confere — pede para olhar", JSON.stringify(ps[3].alertas));
b.passo("4. Escola que não dá para saber: não escolhe sozinho");
respostaIA = { fichas: [{ pagina: 1, nome: "Bia Melo", cpf: "11144477735", escola_escrita: "Esc. Peq. Prínc." }] };
const lb = g.oficiosFichasLer(pdf1.getId(), TOKEN);
const bia = lb.item.leitura.pessoas[0];
b.ok(!bia.escola && bia.candidatos.length === 2 && /2 parecida/.test(bia.escolaOrigem), "duas parecidas: mostra as duas e pede para escolher", JSON.stringify([bia.escolaOrigem, bia.candidatos.map(c => c.nome)]));
b.passo("5. Desfiliação: a escola vem do cadastro do associado (pelo CPF)");
const idDesf = l1.itens.find(i => i.tipo === "Desfiliação").id;
respostaIA = { fichas: [{ pagina: 1, nome: "Joao Lima", cpf: "39053344705", escola_escrita: "" }] };
const ld = g.oficiosFichasLer(idDesf, TOKEN);
const joao = ld.item.leitura.pessoas[0];
b.ok(joao.ok && joao.escola.cnpj === "22.333.444/0001-55" && /do cadastro do associado/.test(joao.escolaOrigem) && joao.nome === "JOÃO LIMA", "escola e nome da base", JSON.stringify(joao));
const idOpos = l1.itens.find(i => i.tipo === "Oposição à Taxa Negocial").id;
respostaIA = { fichas: [{ pagina: 1, nome: "Fulano Sem Base", cpf: "52998224725", escola_escrita: "Escola Beta" }] };
b.ok(g.oficiosFichasLer(idOpos, TOKEN).ok, "oposição lida");

b.passo("6. Preparar: uma escola por ofício, CPF válido, e o robô aprende");
const sem = g.oficiosFichasPreparar(pdf1.getId(), { pessoas: [{ pagina: 1, nome: "Bia Melo", cpf: "11144477735", escolaCnpj: "" }] }, TOKEN);
b.ok(!sem.ok && /UMA escola/.test(sem.mensagem), "sem escola escolhida: não prepara", sem.mensagem);
const cpfRuim = g.oficiosFichasPreparar(pdf4.getId(), { pessoas: [{ pagina: 4, nome: "João Pereira", cpf: "12345678900", escolaCnpj: "11222333000181" }] }, TOKEN);
b.ok(!cpfRuim.ok && /CPF que não confere/.test(cpfRuim.mensagem), "CPF errado: não prepara");
const prep = g.oficiosFichasPreparar(pdf1.getId(), { pessoas: [{ pagina: 1, nome: "Bia Melo", cpf: "111.444.777-35", escolaCnpj: "44555666000100" }] }, TOKEN);
b.ok(prep.ok && prep.oficio.tipo === "Filiação" && prep.oficio.escola.cnpj === "44.555.666/0001-00" && prep.oficio.ficha.id === pdf1.getId(),
  "preparou: tipo, escola, pessoas e a ficha do Drive", prep.mensagem);
b.ok(!g.oficiosFichasListar(TOKEN).itens.some(i => i.id === pdf1.getId()), "sai da lista de novas (fica em Preparadas)");
fichaFil.arquivos.push(arquivo("ficha-0411.pdf", "application/pdf", agora + 9000));
const nova = g.oficiosFichasListar(TOKEN).itens.find(i => i.nome === "ficha-0411.pdf");
respostaIA = { fichas: [{ pagina: 1, nome: "Rui Costa", cpf: "15350946056", escola_escrita: "Esc. Peq. Prínc." }] };
const aprendeu = g.oficiosFichasLer(nova.id, TOKEN).item.leitura.pessoas[0];
b.ok(aprendeu.escola && aprendeu.escola.cnpj === "44.555.666/0001-00" && /a equipe corrigiu/.test(aprendeu.escolaOrigem),
  "da próxima vez, 'Esc. Peq. Prínc.' já é a escola que a equipe escolheu", aprendeu.escolaOrigem);
b.passo("7. Nada emitido nem enviado");
b.igual(amb.outbox.length, 0, "nenhum e-mail");
b.ok(!g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("FILA_ENVIO_OFICIOS") ||
  g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("FILA_ENVIO_OFICIOS").getLastRow() <= 1, "nada na fila de ofícios");
b.passo("8. Ano novo: acha a pasta do ano sozinho");
const RealDate = Date;
fil2026.nome = "x";
const fil2027 = pasta("FILIAÇÕES 2027", [pasta("Ficha de Filiação")]);
mae.filhas[0].filhas.push(fil2027);
global.__ano = 2027;
const pastasAno = (function () { const D = g.Date; g.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [2027, 0, 5])); } static now() { return new RealDate(2027, 0, 5).getTime(); } };
  try { return g.ofdPastas_(); } finally { g.Date = D; } })();
b.ok(pastasAno[0].pasta && /FILIAÇÕES 2027/.test(pastasAno[0].caminho), "em 2027 olha FILIAÇÕES 2027", pastasAno[0].caminho);
b.ok(!pastasAno[1].pasta, "e avisa quando a do ano ainda não foi criada (DESFILIAÇÃO 2027)");

/* ── a tela: o Novo Ofício real se preenche ── */
if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
let t;
try { t = dom.montar(g, ["OficiosFormulario.html", "OficiosScripts.html", "OficiosFichasDriveUI.html"], { token: TOKEN }); }
catch (e) { b.naoTestavel("a tela do Novo Ofício no jsdom", e.message); b.resumo(); process.exit(process.exitCode || 0); }
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("FICHAS DO DRIVE · a tela");
  await t.assentar(300);
  b.passo("9. A aba e a lista");
  b.ok(el("abaFichasDrive"), "a aba 🤖 Fichas do Drive existe");
  el("abaFichasDrive").click(); await t.assentar(200);
  b.ok(el("blocoFichasDrive").style.display === "block", "abre");
  b.ok(/fichas-colegio-alfa\.pdf/.test(t.texto("#ofdLista")) && /Preparar ofício/.test(t.texto("#ofdLista")), "a ficha lida aparece com Preparar", t.texto("#ofdLista").slice(0, 160));
  b.passo("10. Preparar → Abrir no Novo ofício: o formulário real se preenche");
  t.clicar("[data-ofd='preparar'][data-arg='" + pdf4.getId() + "']"); await t.assentar(200);
  b.ok(el("ofdPrepBox").style.display !== "none" && doc.querySelectorAll("#ofdPrepBox .ofd-pess").length === 4, "4 pessoas para conferir");
  const quarta = doc.querySelector("#ofdPrepBox .ofd-pess[data-k='3']");
  quarta.querySelector("[data-campo='cpf']").value = "390.533.447-05";      // corrigiu o CPF olhando a ficha
  t.clicar("[data-ofd='abrirNovo']"); await t.assentar(300);
  b.ok(el("blocoOficioNovo").style.display !== "none", "foi para o Novo ofício");
  b.igual(el("tipo").value, "Filiação", "tipo preenchido");
  b.ok(/ALFA/.test(el("escolaBusca").value), "escola selecionada", el("escolaBusca").value);
  const nomes = Array.from(doc.querySelectorAll("#listaTrabalhadores .input-nome-trabalhador")).map(i => i.value);
  b.igual(nomes, ["Maria Souza", "Caio Reis", "Ana Lima", "J?ão Pereira"], "os 4 trabalhadores");
  const card1 = doc.querySelector("#listaTrabalhadores .trabalhador-card");
  b.ok(card1._fichasDrive && card1._fichasDrive[0].id === pdf4.getId(), "a ficha do Drive anexada (uma vez)");
  b.igual(amb.outbox.length, 0, "nada saiu");
  b.naoTestavel("a letra de mão de verdade, o Drive de verdade, a emissão", "ver em HML com fichas reais");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
