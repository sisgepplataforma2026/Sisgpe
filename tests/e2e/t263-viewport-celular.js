/**
 * CELULAR: A TELA DE LOGIN E O PORTAL PRECISAM DECLARAR O VIEWPORT (14/11/2026).
 * O usuário: "toda vez que eu tento entrar pelo link, onde ele coloca o usuário e senha, para o
 * celular ele está meio desfocado, está meio fora do padrão". Causa: o Apps Script só aplica o
 * ajuste de celular se o SERVIDOR mandar o viewport (addMetaTag) — a tag dentro do .html fica presa
 * no iframe e é ignorada. Sem ele o celular monta a página com ~980 px, a regra de celular do
 * Login.html (max-width:900px) nunca dispara e a página aparece encolhida e borrada.
 * Este teste trava que TODA resposta de Login, de recuperar senha e do Portal (index) leva o viewport.
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const code = fs.readFileSync(path.join(__dirname, "..", "..", "Code.gs"), "utf8");
b.fluxo("CELULAR · viewport nas respostas de Login e do Portal");
b.passo("1. Cada resposta que serve Login, recuperar senha ou o Portal declara o viewport");
const TITULOS = ['"SISGEP — Login"', '"SISGEP — Recuperar senha"', '"Portal Administrativo — SindEducação-ES"'];
TITULOS.forEach(t => {
  const pat = ".setTitle(" + t + ")"; const partes = code.split(pat);
  const sem = partes.slice(1).filter(p => !p.replace(/^\s+/, "").startsWith('.addMetaTag("viewport", "width=device-width'));
  b.ok(partes.length > 1 && sem.length === 0, t + ": " + (partes.length - 1) + " resposta(s), todas com viewport", sem.length + " sem");
});
b.passo("2. Nenhuma resposta de Login/Portal ficou de fora (procura por createHtmlOutputFromFile('Login') e evaluate do index)");
const logins = (code.match(/createHtmlOutputFromFile\("Login"\)/g) || []).length;
const comTitulo = (code.match(/createHtmlOutputFromFile\("Login"\)\s*\.setTitle\("SISGEP — (Login|Recuperar senha)"\)\.addMetaTag\("viewport"/g) || []).length;
b.ok(logins > 0 && logins === comTitulo, "todas as " + logins + " respostas de Login passam por setTitle + viewport", logins + " vs " + comTitulo);
const portais = (code.match(/template\.evaluate\(\)\s*\.setTitle\("Portal Administrativo — SindEducação-ES"\)\.addMetaTag\("viewport"/g) || []).length;
b.ok(portais >= 2, "as respostas do Portal (doGet e doPost) também", String(portais));
b.passo("3. O Login.html tem a regra de celular que o viewport destrava");
const login = fs.readFileSync(path.join(__dirname, "..", "..", "Login.html"), "utf8");
b.ok(/@media \(max-width: ?900px\)/.test(login), "Login.html tem @media (max-width:900px) — só dispara com o viewport declarado");
b.resumo();
