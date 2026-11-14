/**
 * A SAUDAÇÃO É DE QUEM ENTROU — 21/10/2026.
 *
 * Pedido do usuário: "quando entrar com a conta da Marcela deve aparecer
 * bem vinda Marcelha, e não o Wanderson". A Home tinha "Bom dia, Wanderson!"
 * escrito fixo no HTML; o chat da SOFIA, "Olá, Wanderson."; e o Cockpit
 * buscava a sessão SEM o token e caía no nome da conta do Financeiro.
 *
 * DOM real (jsdom), backend real (gas.js), login real das duas contas.
 * NÃO prova a aparência — só que o nome certo está no lugar certo.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("SAUDAÇÃO · quem entrou");
  b.naoTestavel("saudação da Home", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const aba = g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName(g.ABA_USUARIOS_LOGIN);
aba.appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline", "secretaria@sindeducacao.com",
               "USUARIO", "ATIVO", "NAO", "documentos,beneficios"]);
const T_MAR = b.logar(g, "marcelha");
const T_WAN = b.logar(g, "wanderson");
const esperar = ms => new Promise(r => setTimeout(r, ms));

function abrirHome(token) {
  const tela = dom.montar(g, ["index.html"], { token });
  tela.win.SISGEP_TOKEN_SESSAO = token;
  return tela;
}

(async function () {
  b.fluxo("SAUDAÇÃO · a Home cumprimenta quem entrou");

  b.passo("1. Marcelha entra pela conta da Secretaria");
  const m = abrirHome(T_MAR);
  await esperar(1600);
  const greetM = m.texto("#spGreet");
  b.ok(/Marcelha!/.test(greetM), "a Home diz Marcelha", greetM);
  b.ok(!/Wanderson/.test(greetM), "e não diz Wanderson");
  b.ok(/^(Bom dia|Boa tarde|Boa noite), /.test(greetM), "com a saudação da hora");
  b.igual(m.texto("#spNm"), "Marcelha Aline", "o nome no topo também é o dela");
  const chatM = m.texto("#chatSaudacaoNome");
  b.ok(chatM === null || /Marcelha/.test(chatM), "o chat da SOFIA abre falando com ela", String(chatM));

  b.passo("2. Wanderson entra pela dele");
  const w = abrirHome(T_WAN);
  await esperar(1600);
  b.ok(/Wanderson!/.test(w.texto("#spGreet")), "a Home diz Wanderson", w.texto("#spGreet"));

  b.fluxo("SAUDAÇÃO · o Cockpit também");
  b.passo("3. getCockpit com o token da Marcelha");
  const ck = g.getCockpit(T_MAR);
  const nomeCk = ck && ck.greeting && ck.greeting.nome;
  b.igual(nomeCk, "Marcelha", "o Cockpit cumprimenta a Marcelha");

  b.naoTestavel("a aparência da saudação", "jsdom não desenha — conferir no navegador");
  b.resumo();
  /* A Home deixa timers vivos (rádio, relógio): sem sair à força o Node não
     termina. Sai preservando o código que o resumo() definiu. */
  process.exit(process.exitCode || 0);
})();
