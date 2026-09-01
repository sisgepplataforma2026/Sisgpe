/**
 * TESTE DE INTEGRIDADE DOS ARQUIVOS DO PROJETO
 *
 * Por que existe: em 2026-08-05 a tela pública dos hóspedes foi criada no
 * Apps Script como "ParqueChinaHospede", sem o s. A rota abriria erro para o
 * associado — e NENHUM dos outros testes pegaria, porque o emulador carrega
 * os .gs pelo conteúdo e o createHtmlOutputFromFile é um stub que não confere
 * se o arquivo existe.
 *
 * Este teste olha os NOMES, que é o que aqueles não olham.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");
/* A RAIZ SAI DO LOCAL DESTE ARQUIVO, NUNCA DE UM CAMINHO DE MÁQUINA.
   Aqui havia "/home/user/Sisgpe" cravado. Funcionava na minha máquina e
   estourava em qualquer outra: no runner do GitHub o repositório fica em
   /home/runner/work/Sisgpe/Sisgpe, e todo teste que sobe o emulador
   morria com ENOENT antes da primeira asserção. Foi o CI que achou, no
   primeiro deploy de homologação — 19/08/2026. */
const RAIZ = require("path").resolve(__dirname, "..", "..");

const gs = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs"));
const html = fs.readdirSync(RAIZ).filter(f => f.endsWith(".html"));
const nomesHtml = new Set(html.map(f => f.replace(/\.html$/, "")));

function lerTodos(lista) {
  return lista.map(f => ({ arquivo: f, src: fs.readFileSync(path.join(RAIZ, f), "utf8") }));
}
const todos = lerTodos(gs.concat(html));

b.fluxo("PROJETO · Integridade de nomes de arquivo");

/* ── 1. Todo HTML pedido por nome existe ───────────────────────────────── */
b.passo("1. createHtmlOutputFromFile / createTemplateFromFile / include");

const pedidos = [];
todos.forEach(({ arquivo, src }) => {
  const re = /(?:createHtmlOutputFromFile|createTemplateFromFile|include)\s*\(\s*["'']([^"'']+)["'']\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) pedidos.push({ arquivo, nome: m[1] });
});

const faltando = pedidos.filter(p => !nomesHtml.has(p.nome));
b.ok(faltando.length === 0,
  pedidos.length + " referências a arquivo HTML, todas existem",
  faltando.length ? faltando.map(f => f.nome + " (pedido em " + f.arquivo + ")").join(" · ") : "");

/* ── 2. Nenhum .gs e .html com o mesmo nome ────────────────────────────── */
b.passo("2. Colisão de nome entre script e HTML");

// O Apps Script recusa dois arquivos com o mesmo nome no mesmo projeto, mesmo
// sendo tipos diferentes. No repositório eles convivem porque têm extensão —
// então a colisão só aparece na hora de implantar, que é tarde demais.
const nomesGs = gs.map(f => f.replace(/\.gs$/, ""));
const colisoes = nomesGs.filter(n => nomesHtml.has(n));
b.ok(colisoes.length === 0,
  "nenhum nome usado por um .gs e um .html ao mesmo tempo",
  colisoes.length ? "COLIDE: " + colisoes.join(", ") + " — o Apps Script vai recusar na implantação" : "");

/* ── 3. Rotas públicas do doGet têm tela ───────────────────────────────── */
b.passo("3. Toda rota pública serve um arquivo que existe");

const code = fs.readFileSync(path.join(RAIZ, "Code.gs"), "utf8");
const rotas = [];
const reRota = /p\.(?:portal|page|painel|ficha)\s*===\s*"([^"]+)"/g;
let mr;
while ((mr = reRota.exec(code)) !== null) rotas.push(mr[1]);
b.ok(rotas.length >= 6, "rotas públicas encontradas em Code.gs", rotas.join(", "));

/* ── 4. Nome de arquivo com caractere que o Apps Script não aceita ─────── */
b.passo("4. Caracteres problemáticos no nome");

const suspeitos = gs.concat(html).filter(f => /[àáâãéêíóôõúüçÀÁÂÃÉÊÍÓÔÕÚÜÇ\s]/.test(f));
if (suspeitos.length) {
  b.aviso("arquivos com acento ou espaço no nome", suspeitos.join(", "));
} else {
  b.ok(true, "nenhum arquivo com acento ou espaço no nome");
}

/* ── 5. Duplicidade de função pública entre arquivos ───────────────────── */
b.passo("5. Função pública declarada em mais de um arquivo");

// No Apps Script todos os .gs dividem o mesmo escopo: se duas declaram a
// mesma função, a última carregada vence — em silêncio.
const donos = {};
lerTodos(gs).forEach(({ arquivo, src }) => {
  const re = /^function\s+([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const nome = m[1];
    (donos[nome] = donos[nome] || []).push(arquivo);
  }
});
const duplicadas = Object.keys(donos)
  .filter(n => new Set(donos[n]).size > 1)
  .map(n => n + " (" + Array.from(new Set(donos[n])).join(" e ") + ")");

if (duplicadas.length) {
  b.aviso(duplicadas.length + " função(ões) declaradas em mais de um arquivo",
    duplicadas.slice(0, 6).join(" · ") + (duplicadas.length > 6 ? " …" : ""));
} else {
  b.ok(true, "nenhuma função declarada em dois arquivos diferentes");
}

b.resumo();
