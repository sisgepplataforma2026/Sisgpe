/**
 * PESO DA PÁGINA DO PORTAL — quanto HTML/JS o servidor monta e o navegador
 * baixa e interpreta ao entrar no SISGEP (doPost → index.html + include()).
 * Resolve os include() de forma transitiva, como o template engine faz.
 */
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const tam = {}, vistos = new Set();
function resolver(nome, pai) {
  const arq = path.join(RAIZ, nome + ".html");
  if (!fs.existsSync(arq)) return;
  if (vistos.has(nome)) return; vistos.add(nome);
  const src = fs.readFileSync(arq, "utf8");
  tam[nome] = Buffer.byteLength(src);
  const re = /include\(\s*['"]([^'"]+)['"]\s*\)/g; let m;
  /* ignora include citado dentro de comentário HTML (REGRA Nº 0 do projeto) */
  const semComentario = src.replace(/<!--[\s\S]*?-->/g, "");
  while ((m = re.exec(semComentario))) resolver(m[1], nome);
}
resolver("index");
const total = Object.values(tam).reduce((a, b) => a + b, 0);
const todos = fs.readdirSync(RAIZ).filter(f => f.endsWith(".html"));
const totalTodos = todos.reduce((a, f) => a + fs.statSync(path.join(RAIZ, f)).size, 0);
console.log("HTML no projeto: " + todos.length + " arquivos, " + (totalTodos / 1048576).toFixed(2) + " MB");
console.log("Montado em UMA resposta ao entrar (index + includes): " + Object.keys(tam).length + " arquivos, " + (total / 1048576).toFixed(2) + " MB");
console.log("\nMaiores contribuintes:");
Object.entries(tam).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([n, t]) => console.log("  " + (t / 1024).toFixed(0).padStart(6) + " KB  " + n));
