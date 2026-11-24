/**
 * TESTE — A FERRAMENTA QUE ENXUGA O PROJETO PARA O APPS SCRIPT (scripts/enxugar-para-deploy.js)
 *
 * O QUE ORIGINOU (24/11/2026): o projeto passou de 7,3 MB e o editor do Apps
 * Script não consegue salvá-lo. Comentário é 23% do código, mas é a MEMÓRIA do
 * projeto — então o repositório não perde nada; só a cópia que vai ao Apps
 * Script sai enxuta.
 *
 * PROVA: roda a ferramenta de verdade sobre o repositório e confere
 *   1. nenhum arquivo ficou de fora da prova de árvore sintática;
 *   2. mesma lista de arquivos (nada apagado, renomeado ou acrescentado);
 *   3. todo .gs de saída compila e a redução é real;
 *   4. o repositório não foi tocado.
 * A equivalência do CÓDIGO é provada DENTRO da ferramenta (árvore idêntica,
 * arquivo por arquivo). Este teste prova que a ferramenta roda e entrega.
 *
 * NÃO PROVA: que o Apps Script aceita salvar o pacote — só o editor diz.
 * AVISO: os testes que leem o TEXTO do código (t53, t74, t76, t81, t82, t85,
 * t89, t90, t101, t104, t127, t134) pertencem ao repositório completo e NÃO
 * devem ser rodados sobre o pacote enxuto: eles cobram comentário e
 * indentação, que o pacote não tem de propósito.
 */
const b = require("./base");
const fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm");
const { spawnSync } = require("child_process");
const RAIZ = path.resolve(__dirname, "..", "..");

b.fluxo("ENXUGAR PARA DEPLOY · a ferramenta roda e entrega");
const saida = fs.mkdtempSync(path.join(os.tmpdir(), "sisgep-enxuto-"));
const antes = spawnSync("git", ["status", "--porcelain"], { cwd: RAIZ, encoding: "utf8" }).stdout;

b.passo("1. roda inteira, sem arquivo fora da prova");
const r = spawnSync("node", [path.join(RAIZ, "scripts", "enxugar-para-deploy.js"), saida], { encoding: "utf8" });
b.ok(r.status === 0, "termina com sucesso", String(r.stderr).slice(0, 200));
b.ok(/rvore: 0\s*$/m.test(r.stdout), "0 arquivos reprovados na prova de árvore sintática", r.stdout.split("\n").slice(-3).join(" | "));

b.passo("2. mesma lista de arquivos");
const quer = f => /\.(gs|html)$/.test(f) || f === "appsscript.json";
const origem = fs.readdirSync(RAIZ).filter(quer).sort(), gerados = fs.readdirSync(saida).sort();
b.igual(gerados.join(","), origem.join(","), "nada apagado, renomeado ou acrescentado");

b.passo("3. todo .gs de saída compila e a redução é real");
let falhaCompila = [];
gerados.filter(f => f.endsWith(".gs")).forEach(f => { try { new vm.Script(fs.readFileSync(path.join(saida, f), "utf8"), { filename: f }); } catch (e) { falhaCompila.push(f); } });
b.igual(falhaCompila.join(","), "", "todos os .gs compilam");
const soma = d => gerados.filter(f => /\.(gs|html)$/.test(f)).reduce((a, f) => a + fs.statSync(path.join(d, f)).size, 0);
const antesB = soma(RAIZ), depoisB = soma(saida);
b.ok(depoisB < antesB * 0.85, "o pacote é pelo menos 15% menor", ((1 - depoisB / antesB) * 100).toFixed(1) + "%");
b.ok(!/\/\*\*|\/\/ ARQUIVO/.test(fs.readFileSync(path.join(saida, "Voucher.gs"), "utf8")), "o comentário de cabeçalho saiu do pacote");

b.passo("4. o repositório não foi tocado");
const depois = spawnSync("git", ["status", "--porcelain"], { cwd: RAIZ, encoding: "utf8" }).stdout;
b.igual(depois, antes, "git status igual antes e depois");
fs.rmSync(saida, { recursive: true, force: true });
b.resumo();
