/**
 * CANHOTOS DA URNA — da planilha de respostas à folha da gráfica
 *
 * O QUE ORIGINOU
 *
 * 01/10/2026. Em 21/09 o canhoto saiu do ingresso da festa e ficou registrado
 * que o sorteio precisava de outro caminho. O usuário descreveu a entrada: a
 * outra plataforma lê o QR, a moça confere a identidade, acha o nome na
 * relação, destaca o canhoto, a pessoa põe na urna — "Somente isso".
 *
 * A planilha real (respostas do formulário até 01/10/2026, 357 linhas) tinha
 * três armadilhas, e este teste reproduz as três com dado FICTÍCIO — nenhum
 * nome real entra no repositório:
 *   - o cabeçalho colado de novo no meio das respostas;
 *   - uma linha "vazia" no fim, só com um espaço no nome;
 *   - gente que marcou "❌ Não concordo com os termos".
 *
 * O QUE ESTE TESTE GUARDA
 *
 *   1. a regra (servidor): número = ordem de inscrição pelo carimbo, não a
 *      ordem da linha; repetido por CPF ou por nome fica de fora; quem
 *      recusou o termo fica de fora; nada disso some sem aviso;
 *   2. LGPD: CPF, e-mail e telefone NÃO saem do servidor;
 *   3. permissão: sem o módulo Eventos, não lê;
 *   4. a tela (DOM real + backend real): carregar, avisar, dividir em faixas,
 *      recusar faixa manual que deixa gente sem canhoto;
 *   5. a folha: cada pessoa aparece UMA vez na relação e UMA vez no canhoto,
 *      na MESMA linha, com a faixa certa, e a faixa repetida em toda folha.
 *
 * O QUE CONTINUA "NÃO TESTADO" (REGRA Nº -1)
 *
 *   - a leitura do .xlsx pelo Drive (compassoImp_abrir_) — aqui é injetada;
 *     o caminho real já é o do importador, mas só o Apps Script o executa;
 *   - a aparência impressa: se o texto cai dentro das caixas da arte e se a
 *     impressora respeita as cores. Isso se confere na prévia, no navegador.
 *
 * MUTAÇÕES MATADAS (01/10/2026)
 *
 *   1. numerar pela linha em vez do carimbo ................... 2 falhas
 *   2. não descartar quem recusou o termo ..................... 6 falhas
 *   3. devolver o CPF para a tela ............................. 2 falhas
 *   4. faixa automática por letras fixas (sem olhar contagem) . 3 falhas
 *   5. canhoto de uma pessoa na linha de outra ................ 1 falha
 */
const b = require("./base");
const dom = require("./dom");
const fs = require("fs");
const path = require("path");

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_SEM_EVENTOS = b.logar(g, "joscimar");

const CAB = ["Carimbo de data/hora", "  1️⃣ E-mail do associado(a):",
  "  2️⃣ Nome completo do associado(a):", "  3️⃣ CPF (Cadastro de Pessoa Física):",
  "  4️⃣ Escola / Instituição onde trabalha:", "  5️⃣ Cidade onde trabalha:",
  "  6️⃣ Telefone (WhatsApp) do associado(a):",
  "📜 TERMO DE COMPROMISSO DIGITAL\nInscrição – Festa dos Educadores…"];
const SIM = "✅ Sim, li, compreendi e concordo.";
const NAO = "❌ Não concordo com os termos.";
const d = (dia, h, m) => new Date(2026, 8, dia, h, m, 0);
const L = (data, nome, cpf, escola, termo) =>
  [data, nome.toLowerCase().replace(/\s/g, ".") + "@x.com", nome, cpf, escola, "Vitória", "27999990000", termo];

/* Fora de ordem de propósito: a linha 2 se inscreveu DEPOIS da linha 3. */
const GRID = [CAB,
  L(d(22, 10, 0), "Bruna Teixeira", "111.111.111-11", "EMEF Exemplo Um", SIM),
  L(d(21, 9, 0),  "Ana Paula Lima", "222.222.222-22", "emef exemplo dois", SIM),
  L(d(23, 8, 0),  "Carlos Souza", "333.333.333-33", "CMEI Exemplo Três", NAO),
  L(d(23, 9, 0),  "Ângela Ramos", "444.444.444-44", "", SIM),
  CAB.slice(),                                   /* cabeçalho colado no meio */
  L(d(24, 9, 0),  "Bruna  Teixeira", "555.555.555-55", "EMEF Exemplo Um", SIM), /* mesmo nome */
  L(d(24, 10, 0), "Marcos Vieira", "444.444.444-44", "EEEFM Exemplo", SIM),    /* mesmo CPF */
  L(d(25, 9, 0),  "Zélia Prado", "666.666.666-66", "EMEF Exemplo Um", SIM),
  L(d(25, 10, 0), "Jorge Mattos", "777.777.777-77", "EMEF Exemplo Dois", SIM),
  L(d(25, 11, 0), "Luana Costa", "888.888.888-88", "CMEI Exemplo Três", SIM),
  [null, null, " ", null, null, null, null, null]  /* a "vazia" do fim */
];

/* ─────────────────────────────────────────────────────────────────────── */
b.fluxo("CANHOTOS — a regra, no servidor");
b.passo("1. lista, número e avisos");
const r = g.compassoCanhotos_montar_(GRID);
b.ok(r.ok, "lê a planilha de respostas do formulário", r.erro);
b.igual(r.participantes.length, 6, "6 vão para a urna (10 linhas − recusa − 2 repetidos − cabeçalho)");
const porNome = {};
r.participantes.forEach(p => { porNome[p.nome] = p; });
b.igual(porNome["ANA PAULA LIMA"] && porNome["ANA PAULA LIMA"].numero, "0001",
  "o número é a ORDEM DE INSCRIÇÃO: quem se inscreveu primeiro é 0001, mesmo estando na 2ª linha");
b.igual(porNome["BRUNA TEIXEIRA"] && porNome["BRUNA TEIXEIRA"].numero, "0002", "e a seguinte é 0002");
b.ok(!porNome["CARLOS SOUZA"], "quem marcou \"Não concordo\" fica FORA dos canhotos");
b.ok(!porNome["MARCOS VIEIRA"], "CPF repetido: vale a primeira inscrição");
b.igual(porNome["ANA PAULA LIMA"].escola, "Emef Exemplo Dois",
  "escola digitada toda em minúscula ganha iniciais maiúsculas");
b.igual(porNome["ÂNGELA RAMOS"] && porNome["ÂNGELA RAMOS"].escola, "", "sem escola: entra, com a escola em branco");
const tipos = r.avisos.map(a => a.tipo).sort().join(",");
b.igual(tipos, "cabecalho,recusou_termo,repetido,sem_escola",
  "avisos devolvidos — a linha em branco do fim some sem aviso, é só sobra da exportação");
b.ok(["recusou_termo", "repetido", "sem_escola", "cabecalho"].every(t => r.avisos.some(a => a.tipo === t)),
  "nada some em silêncio: recusa, repetido, sem escola e cabeçalho repetido viram aviso");
const recusa = r.avisos.find(a => a.tipo === "recusou_termo");
b.ok(recusa && recusa.itens.length === 1 && recusa.itens[0].nome === "CARLOS SOUZA",
  "o aviso de recusa diz QUEM, para a secretaria conferir", recusa && JSON.stringify(recusa.itens));

b.passo("2. LGPD: o que sai do servidor");
const json = JSON.stringify(r);
b.ok(!/111\.111|11111111111|@x\.com|27999990000/.test(json),
  "CPF, e-mail e telefone NÃO saem para a tela — só nome, escola e número");
b.igual(Object.keys(r.participantes[0]).sort().join(","), "escola,nome,numero",
  "cada participante leva exatamente nome, escola e número");

b.passo("3. permissão");
g.compassoImp_abrir_ = () => ({ grid: GRID, nomeAba: "Respostas ao formulário 1", abas: ["Respostas ao formulário 1"] });
b.bloqueia(() => g.compassoCanhotos_ler({ base64: "x", nome: "a.xlsx" }, "", TOKEN_SEM_EVENTOS),
  "quem não tem o módulo Eventos não lê a planilha");
const lido = g.compassoCanhotos_ler({ base64: "x", nome: "a.xlsx" }, "", TOKEN);
b.ok(lido.ok && lido.participantes.length === 6 && lido.aba === "Respostas ao formulário 1",
  "com o módulo, lê e diz de que aba leu");
b.bloqueia(() => g.compassoCanhotos_arte(TOKEN_SEM_EVENTOS), "a arte também exige o módulo");
b.ok(/CompassoCanhotosArte/.test(g.compassoCanhotos_arte(TOKEN)), "a arte vem do arquivo CompassoCanhotosArte");
const arte = fs.readFileSync(path.join(dom.RAIZ, "CompassoCanhotosArte.html"), "utf8");
b.ok(/\.canh-banner\{background-image:url\(data:image\/jpeg;base64,/.test(arte) &&
     /\.canh-arte\{background-image:url\(data:image\/jpeg;base64,/.test(arte),
  "o arquivo de arte traz o banner e o canhoto do modelo embutidos");
b.ok(!/<\?/.test(arte), "e nenhum scriptlet (é lido como conteúdo, mas não pode virar template por engano)");

/* ─────────────────────────────────────────────────────────────────────── */
b.fluxo("CANHOTOS — a tela e a folha");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a tela", "jsdom não instalado (npm install)");
  b.resumo();
} else (async function () {
  /* 60 pessoas fictícias com a distribuição de iniciais da planilha real
     (muito A, J, L, M; quase nada de H, O, U) + as 6 de cima. */
  const iniciais = "AAAAAAABBCCCCDDDDEEEEFFFGGGGHIJJJJJJKLLLLLLLMMMMMMMNPPRRRRRSSSTVWZ";
  const muitos = [CAB];
  for (let i = 0; i < 60; i++)
    muitos.push(L(d(26, 8, i), iniciais[i] + "essoa Teste " + "abcdefghij"[i % 10] + "abcdefghij"[Math.floor(i / 10)] + "son", "9" + String(i).padStart(10, "0"), "Escola " + (i % 7), SIM));
  g.compassoImp_abrir_ = () => ({ grid: muitos, nomeAba: "Respostas", abas: ["Respostas"] });

  const t = dom.montar(g, ["CompassoCanhotos.html"], { token: TOKEN });
  const janelas = [];
  t.win.open = function () {
    const j = { html: "", fechada: false,
      document: { write(s) { j.html += s; }, open() { j.html = ""; }, close() {} },
      close() { j.fechada = true; } };
    janelas.push(j); return j;
  };

  b.passo("4. carregar a planilha");
  const inp = t.doc.getElementById("canhArq");
  inp.files = [new t.win.File(["x"], "respostas.xlsx")];
  inp.dispatchEvent(new t.win.Event("change"));
  await t.assentar(120);
  b.igual(t.texto("#canhTotal"), "60", "mostra quantos vão para a urna");
  b.ok(t.chamadas.some(c => c.fn === "compassoCanhotos_ler"), "pediu a leitura ao servidor");
  b.ok(!t.doc.getElementById("canhEtapaFaixas").classList.contains("off"), "libera a etapa das faixas");

  b.passo("5. faixas automáticas pela contagem");
  t.digitar("#canhMesas", "5");
  const faixas = Array.from(t.doc.querySelectorAll("#canhFaixas .cn-fx")).map(el => ({
    rot: el.querySelector("b").textContent, n: parseInt(el.querySelector("span").textContent, 10) }));
  b.igual(faixas.length, 5, "5 mesas, 5 faixas: " + faixas.map(f => f.rot + "=" + f.n).join(" "));
  b.igual(faixas.reduce((s, f) => s + f.n, 0), 60, "ninguém fica sem faixa nem aparece em duas");
  const maior = Math.max(...faixas.map(f => f.n)), menor = Math.min(...faixas.map(f => f.n));
  b.ok(maior - menor <= 8, "as mesas ficam equilibradas (diferença ≤ 8 com 12 por mesa em média): " + menor + "–" + maior);
  b.ok(faixas[0].rot.startsWith("A") && /Z$/.test(faixas[faixas.length - 1].rot),
    "as faixas cobrem o alfabeto inteiro, de A a Z");

  b.passo("6. faixa manual que esquece letra é recusada");
  t.digitar("#canhManual", "A-F, G-L, M-R");
  b.ok(!t.doc.getElementById("canhFaixaErro").hidden, "avisa que gente ficaria sem canhoto");
  b.ok(t.doc.getElementById("canhBtGerar").disabled, "e não deixa gerar");
  t.digitar("#canhManual", "A-F, G-L, M-R, S-Z");
  b.ok(!t.doc.getElementById("canhBtGerar").disabled, "cobrindo tudo, libera");
  const manual = Array.from(t.doc.querySelectorAll("#canhFaixas .cn-fx b")).map(e => e.textContent).join(" ");
  b.igual(manual, "A–F G–L M–R S–Z", "usa as faixas digitadas");

  b.passo("7. a folha");
  t.clicar("#canhBtGerar");
  await t.assentar(120);
  b.ok(t.chamadas.some(c => c.fn === "compassoCanhotos_arte"), "busca a arte só na hora de gerar");
  const doc = (janelas[0] || {}).html || "";
  const folhas = doc.split('<section class="folha">').slice(1);
  b.ok(folhas.length >= 8, "gera as folhas (8 por folha): " + folhas.length);
  let alinhado = true, umaVez = true, faixaCerta = true, cabecalho = true;
  const vistos = {};
  folhas.forEach(f => {
    const rot = (f.match(/LETRAS <b>([^<]+)<\/b>/) || [])[1];
    if (!rot) cabecalho = false;
    const nomesTab = [...f.matchAll(/<td class="nm">([^<]*)<\/td>/g)].map(m => m[1]);
    const nomesCan = [...f.matchAll(/class="cv fit nome"[^>]*>([^<]*)</g)].map(m => m[1]);
    const faixasCan = [...f.matchAll(/class="cv fit faixa"[^>]*>([^<]*)</g)].map(m => m[1]);
    if (nomesTab.join("|") !== nomesCan.join("|")) alinhado = false;
    faixasCan.forEach(x => { if (x !== rot.replace("–", " - ")) faixaCerta = false; });
    nomesCan.forEach(n => { if (vistos[n]) umaVez = false; vistos[n] = true; });
  });
  b.ok(cabecalho, "TODA folha repete as letras da faixa no cabeçalho");
  b.ok(alinhado, "o canhoto de cada pessoa está na MESMA linha do nome dela na relação");
  b.ok(faixaCerta, "a faixa escrita no canhoto é a da folha");
  b.ok(umaVez && Object.keys(vistos).length === 60, "cada pessoa tem exatamente um canhoto: " + Object.keys(vistos).length);
  b.ok(!/@x\.com|9000000000/.test(doc), "a folha não traz e-mail nem CPF");
  b.ok(/border-left:1mm dashed/.test(doc), "a linha de corte é grossa (1 mm), não um fio");
  b.ok(/window\.print\(\)/.test(doc), "a janela já abre pronta para imprimir");

  b.passo("8. prévia: uma folha só, sem disparar a impressão");
  t.clicar("#canhBtPrevia");
  await t.assentar(60);
  const previa = (janelas[1] || {}).html || "";
  b.igual(previa.split('<section class="folha">').length - 1, 1, "a prévia mostra uma folha");
  b.ok(!/setTimeout\(function\(\)\{window\.print\(\);\},400\)/.test(previa), "e não abre a impressão sozinha");

  b.naoTestavel("aparência impressa (texto dentro das caixas da arte, cores)",
    "jsdom não desenha — conferir na prévia, no navegador, antes da gráfica");
  b.resumo();
})();
