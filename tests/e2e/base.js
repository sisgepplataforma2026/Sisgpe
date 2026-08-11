/** Infra comum dos testes ponta a ponta: sobe o sistema, cria usuários reais e loga de verdade. */
const { carregar } = require("./load");

const RESULTADOS = [];

function subir(opts) {
  const r = carregar(opts || {});
  if (r.falhas.length) throw new Error("Arquivos .gs falharam ao carregar: " + JSON.stringify(r.falhas));
  return r;
}

/** Cria a aba de usuários e as contas do teste, com senha passada pelo hash real do sistema. */
function seedUsuarios(g) {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let aba = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
  if (!aba) aba = ss.insertSheet(g.ABA_USUARIOS_LOGIN);
  const cab = ["USUARIO", "SENHA", "NOME", "EMAIL", "PERFIL", "STATUS", "PRIMEIRO_ACESSO", "MODULOS"];
  aba.getRange(1, 1, 1, cab.length).setValues([cab]);

  const hash = s => g.gerarHashSenha_(s);
  const contas = [
    ["wanderson", hash("Senha@2026"), "Wanderson Castelo", "wanderson@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""],
    ["rogerio",   hash("Senha@2026"), "Rogério",           "rogerio@sindeducacao.com",   "USUARIO",       "ATIVO", "NAO", "financeiro,rh"],
    ["joscimar",  hash("Senha@2026"), "Joscimar",          "joscimar@sindeducacao.com",  "USUARIO",       "ATIVO", "NAO", "escolas,sindicalizacao"]
  ];
  contas.forEach((c, i) => aba.getRange(2 + i, 1, 1, c.length).setValues([c]));
  return aba;
}

/** Login de verdade, pelo mesmo caminho da tela. Devolve o token de sessão. */
function logar(g, login, senha) {
  const r = g.autenticarUsuario(login, senha || "Senha@2026");
  if (!r || !r.ok) throw new Error("Login falhou para " + login + ": " + (r && r.mensagem));
  return String(r.token || "").trim();
}

/* ─── asserções ─── */
let _fluxoAtual = "(sem fluxo)";
let _passoAtual = "";

function fluxo(nome) { _fluxoAtual = nome; console.log("\n\x1b[1m━━━ " + nome + " ━━━\x1b[0m"); }
function passo(n) { _passoAtual = n; }

function registrar(status, descricao, detalhe) {
  RESULTADOS.push({ fluxo: _fluxoAtual, passo: _passoAtual, descricao, status, detalhe: detalhe || "" });
  const cor = status === "PASSOU" ? "\x1b[32m✓" : status === "FALHOU" ? "\x1b[31m✗" : "\x1b[33m!";
  console.log("  " + cor + "\x1b[0m " + descricao + (detalhe ? "  \x1b[90m" + detalhe + "\x1b[0m" : ""));
}

function ok(cond, descricao, detalhe) { registrar(cond ? "PASSOU" : "FALHOU", descricao, detalhe); return !!cond; }
function igual(obtido, esperado, descricao) {
  const bate = JSON.stringify(obtido) === JSON.stringify(esperado);
  registrar(bate ? "PASSOU" : "FALHOU", descricao, bate ? "" : "esperado " + JSON.stringify(esperado) + ", obtido " + JSON.stringify(obtido));
  return bate;
}
function aviso(descricao, detalhe) { registrar("ATENÇÃO", descricao, detalhe); }
function naoTestavel(descricao, motivo) { registrar("NÃO TESTÁVEL", descricao, motivo); }

/** Espera que a chamada exploda (usado para testes de permissão). */
/* Uma recusa só conta como trava de segurança se ela FOR sobre segurança.
 *
 * Até 11/08/2026 esta função dava PASSOU para qualquer exceção. Uma função
 * sem trava nenhuma, que quebrasse por motivo alheio — "is not a function",
 * planilha ausente, Drive indisponível — era contada como protegida. Foi
 * assim que uma exposição real passou despercebida em t20: remover a
 * verificação de sessão não derrubou o teste, porque a função continuava
 * lançando por outro motivo.
 *
 * Agora a mensagem precisa parecer recusa de acesso. Erro de outra natureza
 * é FALHOU, com o texto à vista — é informação, não ruído. */
const BLOQUEIO_ESPERADO = /sess[ãa]o|permiss|acesso|administrador|autoriza|n[ãa]o tem|negad/i;

function bloqueia(fn, descricao) {
  try {
    const r = fn();
    if (r && r.ok === false) { registrar("PASSOU", descricao, "recusado: " + (r.mensagem || "").slice(0, 80)); return true; }
    registrar("FALHOU", descricao, "não bloqueou — retornou " + JSON.stringify(r).slice(0, 120)); return false;
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (BLOQUEIO_ESPERADO.test(msg)) {
      registrar("PASSOU", descricao, "bloqueado: " + msg.slice(0, 80));
      return true;
    }
    registrar("FALHOU", descricao,
      "lançou, mas NÃO por sessão/permissão — a trava pode não existir: " + msg.slice(0, 90));
    return false;
  }
}

function resumo() {
  const c = { PASSOU: 0, FALHOU: 0, "ATENÇÃO": 0, "NÃO TESTÁVEL": 0 };
  RESULTADOS.forEach(r => c[r.status]++);
  console.log("\n\x1b[1m═══ RESUMO ═══\x1b[0m");
  console.log("  \x1b[32mPassou:\x1b[0m " + c.PASSOU + "   \x1b[31mFalhou:\x1b[0m " + c.FALHOU +
              "   \x1b[33mAtenção:\x1b[0m " + c["ATENÇÃO"] + "   Não testável: " + c["NÃO TESTÁVEL"]);
  if (c.FALHOU) {
    console.log("\n\x1b[31mFALHAS:\x1b[0m");
    RESULTADOS.filter(r => r.status === "FALHOU").forEach(r =>
      console.log("  • [" + r.fluxo + "] " + r.descricao + (r.detalhe ? " — " + r.detalhe : "")));
  }
  return c;
}

module.exports = { subir, seedUsuarios, logar, fluxo, passo, ok, igual, aviso, naoTestavel, bloqueia, resumo, RESULTADOS };
