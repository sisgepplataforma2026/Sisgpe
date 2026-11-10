/**
 * OFTALMO · AS FUNÇÕES DA TELA QUE NUNCA EXISTIRAM (10/11/2026, auditoria
 * "toda função chamada existe?"). Sair do campo e-mail e digitar o nome do
 * titular davam erro (validarEmailOftalmo, buscarAssociadoPorNome,
 * renderizarSugestoesAssociados). Tela real (jsdom), servidor FALSO.
 */
const b = require("./base");
const dom = require("./dom");
if (!dom.jsdomDisponivel()) { b.fluxo("OFTALMO · busca do titular"); b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const { g } = b.subir({}); b.seedUsuarios(g); const T = b.logar(g, "wanderson");
g.buscarAssociadosOftalmo = termo => ({ ok: true, associados: /mar/i.test(termo) ? [{ nome: "Maria Souza", cpf: "52998224725", telefone: "(27) 99999-0000", email: "maria@exemplo.com", escola: "Colégio Alfa", situacao: "ATIVO" }] : [] });
(async () => {
  b.fluxo("OFTALMO · busca do titular e e-mail");
  const t = dom.montar(g, ["AgendOftalmo.html", "Scripts_AgendOftalmo.html"], { token: T });
  await t.assentar(300);
  const w = t.win, d = t.doc;
  let erros = [];
  w.addEventListener("error", e => erros.push(String(e.message)));
  try { w.AgendOftalmo.init(); } catch (e) { erros.push("init: " + e.message); }
  await t.assentar(300);
  const em = d.getElementById("oftalmoEmail");
  em.value = "sem-arroba"; em.dispatchEvent(new w.Event("blur"));
  b.ok(em.title === "E-mail inválido" && !erros.length, "sair do e-mail errado marca o campo (antes: erro)", erros.join(" | "));
  em.value = "ok@exemplo.com"; em.dispatchEvent(new w.Event("blur"));
  b.ok(em.title === "", "e-mail certo limpa o aviso");
  const nome = d.getElementById("oftalmoNomeTitular");
  nome.value = "Mar"; nome.dispatchEvent(new w.Event("input")); await t.assentar(700);
  const box = d.getElementById("oftalmoSugestoesAssoc");
  b.ok(box && box.style.display !== "none" && /Maria Souza/.test(box.textContent) && !erros.length, "digitar o nome mostra o associado (antes: erro)", (box && box.textContent) + " " + erros.join(" | "));
  box.querySelector("button").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
  b.ok(nome.value === "Maria Souza" && em.value === "maria@exemplo.com" && d.getElementById("oftalmoEscola").value === "Colégio Alfa" &&
    /529/.test(d.getElementById("oftalmoCpfTitular").value), "escolher preenche nome, CPF, e-mail e escola",
    [nome.value, em.value, d.getElementById("oftalmoCpfTitular").value].join(" · "));
  b.resumo();
  process.exit(process.exitCode || 0);
})();
