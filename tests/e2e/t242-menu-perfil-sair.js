/**
 * MENU DO PERFIL E SAIR + PAINEL POR LOGIN (06/11/2026). O usuário, em
 * produção: "Quando clico deveria ter a opção de sair, mas não acontece
 * nada" e "quando acesso o perfil da Marcelha está indo para o Wanderson".
 *
 * Prova (backend real, tela real em jsdom, dados FICTÍCIOS):
 *   - o menu do perfil tem "Sair do sistema", e clicar encerra a sessão no
 *     servidor (com a confirmação de sempre);
 *   - o topo fica numa camada acima do conteúdo (o menu abria por baixo);
 *   - o painel da Home é guardado por LOGIN: dois logins com o mesmo e-mail
 *     no cadastro não veem o painel um do outro.
 * NÃO PROVA: a camada na tela de verdade (conferido com navegador real à
 * parte; no ar, ver em produção).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
// a Marcela cadastrada com o MESMO e-mail do Wanderson (o caso que mistura)
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcela", g.gerarHashSenha_("Senha@2026"), "Marcela Exemplo",
  "wanderson@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TW = b.logar(g, "wanderson"), TM = b.logar(g, "marcela");

b.fluxo("PAINEL · cada login com o seu");
g.caixaResumoDoDia = tk => ({ ok: true, aTratar: tk === TW ? 55 : 7, caixa: tk === TW ? "financeiro@" : "secretaria@", precisa: [] });
const rw = g.getPainelExecutivoSISGEP(TW, "caixa"), rm = g.getPainelExecutivoSISGEP(TM, "caixa");
b.ok(rw.nome === "Wanderson" && rw.kpis[0].n === 55, "o Wanderson vê o dele", rw.nome + " " + rw.kpis[0].n);
b.ok(rm.nome === "Marcela" && rm.kpis[0].n === 7 && !rm.doCache, "a Marcela vê o dela, não o guardado do Wanderson", rm.nome + " " + rm.kpis[0].n);

b.passo("O topo fica acima do conteúdo");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
b.ok(/#spTopbar\{position:relative;z-index:60;/.test(html), "#spTopbar com camada própria (z-index 60)");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
(async function () {
  b.fluxo("MENU DO PERFIL · Sair");
  const t = dom.montar(g, ["index.html"], { token: TW });
  await t.assentar(1500);
  const w = t.win, d = t.doc;
  w.confirm = () => true;
  try { w.location.reload = () => { w.__recarregou = true; }; } catch (e) {}
  w.eval(d.getElementById("spUserBtn").getAttribute("onclick"));
  b.ok(d.getElementById("spUserDropdown").classList.contains("show"), "clicar no perfil abre o menu");
  const sair = d.getElementById("spMenuSair");
  b.ok(sair && /Sair do sistema/.test(sair.textContent), "o menu tem 'Sair do sistema'");
  const antes = t.chamadas.length;
  w.eval(sair.getAttribute("onclick"));
  await t.assentar(300);
  const enc = t.chamadas.slice(antes).find(c => c.fn === "encerrarSessaoUsuario");
  b.ok(enc && enc.args[0] === TW, "Sair encerra a sessão no servidor", JSON.stringify(t.chamadas.slice(antes).map(c => c.fn)));
  b.ok(!d.getElementById("spUserDropdown").classList.contains("show"), "e o menu fecha");
  let s = null; try { s = g.getSessaoUsuario(TW); } catch (e) {}
  b.ok(!s || s.logado !== true, "a sessão do Wanderson não vale mais");
  b.naoTestavel("a camada na tela de verdade", "em produção: clicar no nome, lá no alto, e ver o menu por cima dos cards");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
