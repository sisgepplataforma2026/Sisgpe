/**
 * TESTE — INTEGRIDADE DO MENU DO PORTAL ADMINISTRATIVO
 *
 * O QUE ESTE TESTE PODE E O QUE NÃO PODE DIZER
 *
 * Ele NÃO abre o navegador. Não prova que a tela aparece bonita, que o
 * acordeão anima, que o clique responde nem que o módulo carrega. Isso
 * continua "não testado" e depende de você abrir o portal.
 *
 * O que ele prova, por execução: que nenhum botão do menu aponta para o
 * vazio. Todo destino existe no MODS, todo MODS tem o seu <div>, todo
 * acordeão referenciado existe, e a hierarquia do PROMPT-MESTRE (item 4)
 * — no máximo Módulo → Submódulo no menu lateral — é respeitada.
 *
 * Botão que aponta para módulo inexistente cai no console.warn do spIr e
 * joga o usuário de volta para o Início sem explicação. É o tipo de defeito
 * que passa despercebido em revisão de código e aparece em produção como
 * "cliquei e não foi".
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");

/* ── Recorta só a barra lateral: o resto do arquivo tem spIr() em cards,
      atalhos e comandos da SOFIA, que não são itens de menu. ── */
const iniNav = html.indexOf('<div class="spNavArea">');
const fimNav = html.indexOf("</nav>", iniNav);
const nav = html.slice(iniNav, fimNav);

/* ── MODS: registro módulo → [divId, título, subtítulo] ── */
const blocoMods = html.slice(html.indexOf("var MODS={"));
const mods = {};
const reMod = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/gm;
let m;
while ((m = reMod.exec(blocoMods))) {
  mods[m[1]] = { div: m[2], titulo: m[3], sub: m[4] };
  if (m.index > blocoMods.indexOf("};")) break;
}

const idsNoHtml = new Set();
const reId = /id="([^"]+)"/g;
while ((m = reId.exec(html))) idsNoHtml.add(m[1]);

b.fluxo("MENU · Integridade dos destinos");

b.passo("1. O registro de módulos foi lido");
b.ok(Object.keys(mods).length >= 20, "MODS carregado",
  Object.keys(mods).length + " módulos registrados");

b.passo("2. Todo destino do menu existe no MODS");
const destinos = [];
const reIr = /spIr\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
while ((m = reIr.exec(nav))) destinos.push(m[1]);
const semRegistro = [...new Set(destinos)].filter(d => !mods[d]);
b.ok(semRegistro.length === 0, "nenhum botão aponta para módulo não registrado",
  semRegistro.length ? "ÓRFÃOS: " + semRegistro.join(", ")
                     : [...new Set(destinos)].length + " destinos distintos, todos no MODS");

b.passo("3. Todo módulo do MODS tem o seu <div> no index");
const semDiv = Object.keys(mods).filter(k => !idsNoHtml.has(mods[k].div));
b.ok(semDiv.length === 0, "nenhum módulo aponta para um div inexistente",
  semDiv.length ? "SEM DIV: " + semDiv.map(k => k + "→" + mods[k].div).join(", ")
                : Object.keys(mods).length + " divs conferidos");

b.fluxo("MENU · Hierarquia Módulo → Submódulo (PROMPT-MESTRE item 4)");

b.passo("4. Todo data-acordeao aponta para um bloco que existe");
const acordeoes = [];
const reAcc = /data-acordeao="([^"]+)"/g;
while ((m = reAcc.exec(nav))) acordeoes.push(m[1]);
const accInexistentes = acordeoes.filter(id => !new RegExp('id="' + id + '"').test(nav));
b.ok(accInexistentes.length === 0, "todo botão-pai abre um bloco existente",
  accInexistentes.length ? "SEM BLOCO: " + accInexistentes.join(", ")
                         : acordeoes.length + " acordeões");

b.passo("5. Todo bloco de submenu declara data-subs e tem um pai");
const blocos = [];
const reBloco = /<div id="([^"]+)" class="docSubMenuSidebar"([^>]*)>/g;
while ((m = reBloco.exec(nav))) blocos.push({ id: m[1], attrs: m[2] });
const semSubs = blocos.filter(x => !/data-subs="/.test(x.attrs));
b.ok(semSubs.length === 0, "todo bloco declara os módulos que moram nele",
  semSubs.length ? "SEM data-subs: " + semSubs.map(x => x.id).join(", ") : blocos.length + " blocos");
const semPai = blocos.filter(x => acordeoes.indexOf(x.id) === -1);
b.ok(semPai.length === 0, "nenhum bloco fica órfão, sem botão que o abra",
  semPai.length ? "ÓRFÃOS: " + semPai.map(x => x.id).join(", ") : "todos com pai");

b.passo("6. Todo módulo listado em data-subs existe no MODS");
const declarados = [];
blocos.forEach(x => {
  const d = /data-subs="([^"]*)"/.exec(x.attrs);
  if (d) d[1].split(",").filter(Boolean).forEach(s => declarados.push({ bloco: x.id, mod: s.trim() }));
});
const subsInvalidos = declarados.filter(d => !mods[d.mod]);
b.ok(subsInvalidos.length === 0, "data-subs só cita módulo registrado",
  subsInvalidos.length ? "INVÁLIDOS: " + subsInvalidos.map(d => d.mod).join(", ")
                       : declarados.length + " vínculos módulo↔acordeão");

b.passo("7. Todo item de submenu abre um acordeão que o contém");
// Sem isto, clicar no item navega mas o acordeão fecha na cara do usuário.
const itensSub = [];
const reItem = /<button[^>]*class="docSubMenuBtn[^"]*"[^>]*data-sub-mod="([^"]+)"[^>]*onclick="([^"]*)"/g;
while ((m = reItem.exec(nav))) itensSub.push({ chave: m[1], onclick: m[2] });
const foraDoPai = [];
itensSub.forEach(it => {
  const alvo = /spIr\(\s*['"]([A-Za-z0-9_]+)['"]/.exec(it.onclick);
  const modAlvo = alvo ? alvo[1] : (it.chave.split(":")[0]);
  const bloco = declarados.find(d => d.mod === modAlvo);
  if (!bloco) foraDoPai.push(it.chave + " → " + modAlvo);
});
b.ok(foraDoPai.length === 0, "nenhum item navega para fora do acordeão que o abriga",
  foraDoPai.length ? "SOLTOS: " + foraDoPai.join(" | ") : itensSub.length + " itens de submenu");

b.passo("8. Só existem dois níveis no menu lateral");
// Módulo (.spN) e submódulo (.docSubMenuBtn). Tela e ação vivem dentro do
// módulo. Um .docSubMenuBtn fora de um .docSubMenuSidebar seria um 3º nível.
const trechosBloco = nav.split(/<div id="[^"]+" class="docSubMenuSidebar"/);
const botoesForaDeBloco = (trechosBloco[0].match(/class="docSubMenuBtn/g) || []).length;
b.ok(botoesForaDeBloco === 0, "nenhum submódulo solto antes do primeiro bloco",
  botoesForaDeBloco + " encontrados");
const niveis = (nav.match(/docSubMenuSidebar/g) || []).length;
b.ok(!/docSubMenuSidebar[\s\S]{0,400}?docSubMenuSidebar[^"]*"[^>]*>\s*<div[^>]*docSubMenuSidebar/.test(nav),
  "nenhum acordeão dentro de outro acordeão", niveis + " blocos, todos no mesmo nível");

b.fluxo("MENU · Regressões conhecidas");

b.passo("9. REGRA Nº 0 — scriptlet dentro de comentário HTML");
const comentarios = html.match(/<!--[\s\S]*?-->/g) || [];
const comScriptlet = comentarios.filter(c => /<\?[=!]?/.test(c));
b.ok(comScriptlet.length === 0, "nenhum scriptlet do Apps Script dentro de comentário",
  comScriptlet.length ? comScriptlet[0].slice(0, 70) : comentarios.length + " comentários varridos");

b.passo("10. Funções de acordeão não voltaram a ser uma por módulo");
const toggles = (html.match(/window\.toggle\w*Accordion\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]{0,200}?getElementById/g) || []);
const comCorpoProprio = toggles.filter(t => !/spAcordeaoPorId_/.test(t));
b.ok(comCorpoProprio.length === 0, "as toggles antigas delegam, não reimplementam",
  comCorpoProprio.length ? comCorpoProprio.length + " ainda com corpo próprio" : "todas delegam a spAcordeaoPorId_");

b.passo("11. Os mapas *_SUBS escritos à mão sumiram do spIr");
b.ok(!/var (SIND|ESC|FIN|COM)_SUBS\s*=/.test(html), "spIr não tem mais mapa de submódulo hard-coded",
  "hierarquia lida do próprio HTML");

b.passo("12. O rodapé do menu ainda consegue abrir a Rádio");
// A Rádio deixou de ser módulo no menu (não é área administrativa), mas o
// player do rodapé chama spIr('radio') — o destino tem que continuar vivo.
b.ok(!!mods.radio && idsNoHtml.has(mods.radio.div), "spIr('radio') continua com destino",
  mods.radio ? "→ " + mods.radio.div : "MODS.radio sumiu");
b.ok(/spRadioToggle\(\)/.test(html), "controles do player seguem no rodapé", "");

b.passo("13. Nenhuma tela lê a sessão pelo nome errado");
// Regressão de 10/08/2026, cinco telas de uma vez. O helper procurava
// window.SISGEP_TOKEN (que não existe) e caía em window.tokenSessao — que é
// uma FUNÇÃO global declarada por nove outras telas. Função é truthy: o
// token enviado ao servidor era uma função, e o google.script.run recusava
// com "Failed due to illegal value in property", mensagem que não diz uma
// palavra sobre sessão. Quatro rodadas até achar.
// O nome do projeto é SISGEP_TOKEN_SESSAO, usado por mais de 20 telas.
const fsT9 = require("fs");
const raiz = __dirname + "/../..";
const telas = fsT9.readdirSync(raiz).filter(f => f.endsWith(".html"));

// Sem comentários. O comentário que documenta este próprio defeito cita os
// dois nomes errados e faria a varredura acusar as telas já corrigidas —
// terceira vez nesta sessão que um comentário engana uma medição.
function codigo(f) {
  return fsT9.readFileSync(raiz + "/" + f, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}
const comNomeErrado = telas.filter(f =>
  /window\.tokenSessao|window\.SISGEP_TOKEN\b(?!_)/.test(codigo(f)));
b.ok(comNomeErrado.length === 0,
  "todas leem SISGEP_TOKEN_SESSAO, não um nome que colide com função global",
  comNomeErrado.length ? "AINDA ERRADAS: " + comNomeErrado.join(", ")
                       : telas.length + " telas varridas");

b.passo("14. E o helper confere que o token é mesmo texto");
// Sem o teste de tipo, qualquer colisão futura volta a produzir o erro
// opaco em vez de "sessão inválida".
const helpers = telas.filter(f => /SISGEP_TOKEN_SESSAO/.test(fsT9.readFileSync(raiz + "/" + f, "utf8")) &&
                                   /function \w*[Tt]oken\w*\(\)/.test(fsT9.readFileSync(raiz + "/" + f, "utf8")));
const semGuarda = ["AssembleiasAdmin.html","AuditoriaTrilha.html","ConfigAdmin.html",
                   "GovernancaAdmin.html","NegociacaoAdmin.html"]
  .filter(f => !/typeof t === "string"/.test(fsT9.readFileSync(raiz + "/" + f, "utf8")));
b.ok(semGuarda.length === 0,
  "as cinco telas corrigidas checam o tipo antes de enviar",
  semGuarda.length ? "SEM GUARDA: " + semGuarda.join(", ") : "5 de 5 · " + helpers.length + " telas com helper");

b.naoTestavel("Aparência, animação do acordeão e clique real", "exige navegador");
b.naoTestavel("Carregamento do conteúdo de cada módulo", "depende do Apps Script servindo os includes");

b.resumo();
process.exit(0);
