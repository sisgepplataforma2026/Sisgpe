/**
 * TESTE DE EXPOSIÇÃO — o que um anônimo alcança sem login?
 *
 * Por que existe: o relatório de arquitetura dizia "425 funções sem checagem
 * de sessão no corpo". Aquilo era contagem de texto, não de comportamento —
 * parte dessas funções delega para uma interna que valida. A pergunta que
 * importa é outra: CHAMANDO de fato, sem token, quantas devolvem dado real?
 *
 * O teste chama cada função pública do projeto sem sessão e classifica o que
 * volta. Roda contra a planilha em memória, com dados semeados, para que
 * "devolveu dado" signifique alguma coisa.
 *
 * No Apps Script não existe rota para google.script.run: toda função global
 * é endpoint para QUALQUER página do projeto — inclusive as 14 páginas
 * anônimas que o Code.gs serve. Por isso esta medição é a superfície real.
 */
const fs = require("fs");
/* A RAIZ SAI DO LOCAL DESTE ARQUIVO, NUNCA DE UM CAMINHO DE MÁQUINA.
   Aqui havia "/home/user/Sisgpe" cravado. Funcionava na minha máquina e
   estourava em qualquer outra: no runner do GitHub o repositório fica em
   /home/runner/work/Sisgpe/Sisgpe, e todo teste que sobe o emulador
   morria com ENOENT antes da primeira asserção. Foi o CI que achou, no
   primeiro deploy de homologação — 19/08/2026. */
const RAIZ_T6 = require("path").resolve(__dirname, "..", "..");
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

/* ── semeia dado real para "devolveu dado" ter significado ── */
const TOKEN = b.logar(g, "wanderson");
const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
g.solicitarReservaParqueChina({
  nomeSolicitante: "Maria Aparecida Souza", cpf: "111.444.777-35",
  telefone: "(27) 99999-1234", email: "maria@exemplo.com",
  chaleSolicitado: "QUALQUER_DISPONIVEL", dataEntrada: dias(10), dataSaida: dias(12),
  tipoReserva: "FIM_DE_SEMANA", quantidadePessoas: "3", solicitouColchaoExtra: "NAO"
});

/* ── inventário das funções públicas ── */
const publicas = [];
fs.readdirSync(RAIZ_T6).filter(f => f.endsWith(".gs")).forEach(arq => {
  const src = fs.readFileSync(require("path").join(RAIZ_T6, arq), "utf8");
  const re = /^function\s+([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (!m[1].endsWith("_")) publicas.push({ nome: m[1], arquivo: arq });
  }
});

/* ── mensagens que provam que a trava agiu ── */
const BLOQUEIO = /sess[ãa]o|expirad|permiss[ãa]o|autoriza|acesso ao m[óo]dulo|n[ãa]o tem acesso|login|administrador/i;

const resultado = { protegida: [], exposta: [], inconclusiva: [] };

// Algumas funções devolvem objeto do próprio Apps Script (Spreadsheet, Sheet),
// que tem referência circular. Serializar com cuidado.
function amostrar(r) {
  try { return JSON.stringify(r).slice(0, 90); }
  catch (e) { return "[objeto " + (r && r.constructor ? r.constructor.name : typeof r) + "]"; }
}

publicas.forEach(fn => {
  if (typeof g[fn.nome] !== "function") return;
  let r, erro = null;
  try {
    r = g[fn.nome]();               // sem token nenhum — é o que o anônimo faz
  } catch (e) {
    erro = String(e && e.message || e);
  }

  if (erro) {
    if (BLOQUEIO.test(erro)) resultado.protegida.push(fn);
    else resultado.inconclusiva.push(Object.assign({ motivo: erro.slice(0, 60) }, fn));
    return;
  }
  if (r && typeof r === "object" && r.ok === false && BLOQUEIO.test(String(r.mensagem || ""))) {
    resultado.protegida.push(fn); return;
  }
  // Devolveu algo sem reclamar de sessão. Só conta como exposta se veio
  // conteúdo — função que devolve vazio ou undefined não entrega informação.
  const temConteudo = r !== undefined && r !== null && r !== "" &&
    !(Array.isArray(r) && r.length === 0) &&
    !(typeof r === "object" && !Array.isArray(r) && Object.keys(r).length === 0);
  if (temConteudo) resultado.exposta.push(Object.assign({ amostra: amostrar(r) }, fn));
  else resultado.inconclusiva.push(Object.assign({ motivo: "devolveu vazio" }, fn));
});

b.fluxo("SEGURANÇA · O que um anônimo alcança sem login");

b.passo("1. Tamanho da superfície");
b.ok(true, publicas.length + " funções públicas no projeto — todas são endpoint de google.script.run");

b.passo("2. Chamada sem sessão, uma por uma");
console.log("     protegidas (recusaram citando sessão/permissão): " + resultado.protegida.length);
console.log("     \x1b[31mEXPOSTAS (devolveram conteúdo sem login):      " + resultado.exposta.length + "\x1b[0m");
console.log("     inconclusivas (erro de argumento, vazio, etc.):  " + resultado.inconclusiva.length);

b.passo("3. Amostra do que sai sem login");
resultado.exposta.slice(0, 25).forEach(f => {
  console.log("     \x1b[31m•\x1b[0m " + (f.nome + " ".repeat(42)).slice(0, 42) + " \x1b[90m" + f.arquivo + " → " + f.amostra + "\x1b[0m");
});
if (resultado.exposta.length > 25) console.log("     … e mais " + (resultado.exposta.length - 25));

/* ── o limite que trava a regressão ──
   Não é zero, e mentir sobre isso não ajudaria: existem funções que PRECISAM
   responder sem login — o formulário público do China Park, a validação de
   carteirinha por QR, o pixel de rastreio. O número abaixo é o teto aceito
   conscientemente. Se subir, alguém expôs algo novo e o teste acusa na hora. */
// O teto vem do arquivo, NÃO da medição atual. Escrito assim na primeira
// versão — TETO = resultado.exposta.length — o teste passava sempre, porque
// comparava o número consigo mesmo. Teste que não pode falhar não é teste.
const ARQ_TETO = __dirname + "/exposicao-teto.json";
let teto = null;
try { teto = JSON.parse(fs.readFileSync(ARQ_TETO, "utf8")).teto; } catch (e) {}
if (teto === null) {
  teto = resultado.exposta.length;
  fs.writeFileSync(ARQ_TETO, JSON.stringify({
    teto: teto, medidoEm: new Date().toISOString().slice(0, 10),
    observacao: "Teto aceito conscientemente. Baixar conforme a separação de projetos avança; nunca subir sem decisão registrada."
  }, null, 2));
  console.log("     (primeira medição — teto gravado em " + teto + ")");
}

b.passo("4. Teto de regressão");
b.ok(resultado.exposta.length <= teto,
  "nenhuma função nova exposta desde a última medição",
  "hoje " + resultado.exposta.length + " · teto " + teto);

/* ── classificação por risco ── */
b.passo("5. Das expostas, quantas ESCREVEM?");
/* 'inscrev' entrou em 21/08/2026: bingo_inscrever e compasso_inscrever GRAVAM
   registro novo a partir de rota pública, e a lista os classificava como
   leitura só porque o nome não batia com nenhum prefixo daqui. O relatório
   subestimava justo as duas que escrevem sem login. */
const ESCRITA = /^(salvar|gravar|criar|cadastr|inscrev|excluir|deletar|remover|atualizar|editar|aprovar|rejeitar|recusar|cancelar|registrar|enviar|emitir|gerar|instalar|setup|configurar|migrar|importar|processar|marcar|confirmar|desfazer|reabrir|estornar|lancar|lançar|inserir|adicionar|definir|limpar|resetar)/i;
const escrevem = resultado.exposta.filter(f => ESCRITA.test(f.nome));
console.log("     \x1b[31m" + escrevem.length + " das " + resultado.exposta.length + " têm nome de ação que ESCREVE\x1b[0m");
escrevem.slice(0, 20).forEach(f =>
  console.log("     \x1b[31m!\x1b[0m " + (f.nome + " ".repeat(40)).slice(0, 40) + " \x1b[90m" + f.arquivo + "\x1b[0m"));
if (escrevem.length > 20) console.log("     … e mais " + (escrevem.length - 20));

fs.writeFileSync(__dirname + "/exposicao-detalhe.json", JSON.stringify({
  medidoEm: new Date().toISOString().slice(0, 10),
  totalPublicas: publicas.length,
  protegidas: resultado.protegida.length,
  expostas: resultado.exposta.map(f => ({ nome: f.nome, arquivo: f.arquivo, escreve: ESCRITA.test(f.nome) })),
  inconclusivas: resultado.inconclusiva.length
}, null, 2));

b.aviso("Este teto NÃO é meta — é o retrato de hoje", "a meta é derrubá-lo com a separação dos projetos");

/* SAIR COM 0 NA MARRA ERA O QUE CEGAVA A SUÍTE.
 *
 * 21/08/2026. Este arquivo terminava com `process.exit(0)`, escrito de volta
 * quando resumo() ainda não decidia código de saída. Depois que o base.js
 * passou a marcar `process.exitCode = 1` na falha (20/08), este exit(0)
 * continuou aqui e PASSOU POR CIMA da marcação.
 *
 * O efeito: o teste de segurança imprimia ✗ na tela e devolvia 0 ao sistema.
 * O tests/run-suite.js lê o código de saída — então a suíte dizia VERDE com o
 * teto estourado. E estava estourado havia dias: 215 → 217 → 220 → 229 → 230
 * → 221 → 224, sem ninguém ser avisado uma única vez.
 *
 * É o mesmo defeito que o base.js documenta ter corrigido, sobrevivendo justo
 * no teste que guarda o que um anônimo alcança sem login.
 *
 * Agora quem decide é o resumo(). */
b.resumo();
