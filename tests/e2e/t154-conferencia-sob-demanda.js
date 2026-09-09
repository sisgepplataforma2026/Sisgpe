/**
 * TESTE — CONFERIR RECEBIMENTO É BOTÃO, E "ESTÁ EM ENVIADOS?" CUSTA ZERO
 *
 * O QUE ORIGINOU, 09/09/2026. Duas falas do usuário no mesmo fio.
 *
 * A primeira, sobre a conferência automática:
 *
 *   "se ficar puxando automático toda vez ele vai bater na cota de emails"
 *   "quem envia é você, quem confere é você"
 *
 * Ele estava certo, e a medida provava: verificarConfirmacoesRecebimento faz
 * UMA busca no Gmail POR OFÍCIO PENDENTE, sem teto, e rodava 12x por dia. Ler
 * e enviar saem do mesmo orçamento — a conferência comia a cota do envio. Foi
 * o que derrubou o reenvio do ofício 407.
 *
 * A segunda, depois de não achar o e-mail em caixa nenhuma:
 *
 *   "consegue verificar se todos os emails que foram enviados estão na caixa
 *    de enviados?"
 *
 * Consegue — e SEM perguntar ao Gmail. `enviarEmailOficio_` usa
 * createDraft().send(), e o send() só devolve um GmailMessage quando o envio
 * deu certo. O MENSAGEM_ID gravado JÁ É a prova. Perguntar ao Gmail seria
 * perguntar duas vezes a mesma coisa, gastando a cota que passamos o dia
 * tentando economizar.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: se a mensagem está de fato na caixa. O
 * emulador não fala com o Gmail. O que se prova aqui é a REGRA — quem é
 * conferido, quanto custa, e o que o sistema chama de comprovação.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const TOKEN = b.logar(g, "wanderson");
const SEM_MODULO = b.logar(g, "rogerio");   // financeiro,rh — não tem documentos

/* ─── A fila, com os quatro casos que importam ────────────────────────────── */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const fila = ss.insertSheet("FILA_ENVIO_OFICIOS");
const CAB = ["NUMERO_OFICIO", "ESCOLA", "EMAIL_PRINCIPAL", "EMAILS_TODOS",
             "STATUS", "DATA_ENVIO", "DATA_CONFIRMACAO", "MENSAGEM_ID",
             "STATUS_RECEBIMENTO"];
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const d = (a, m, dia) => new Date(a, m - 1, dia);
fila.getRange(2, 1, 5, CAB.length).setValues([
  /* tem id  -> comprovado, custo zero */
  ["501/2026", "EMEF Alfa",  "a@a.com", "a@a.com", "ENVIADO",  d(2026, 9, 5), "", "MSG-501", ""],
  ["502/2026", "EMEF Beta",  "b@b.com", "b@b.com", "CONFIRMADO", d(2026, 9, 5), d(2026,9,6), "MSG-502", "CONFIRMADO"],
  /* enviado DEPOIS da virada e sem id -> achado de verdade */
  ["503/2026", "EMEF Gama",  "c@c.com", "c@c.com", "ENVIADO",  d(2026, 9, 8), "", "", ""],
  /* enviado ANTES da virada -> ausência esperada, não é achado */
  ["504/2026", "EMEF Delta", "e@e.com", "e@e.com", "ENVIADO",  d(2026, 8, 20), "", "", ""],
  /* nem saiu */
  ["505/2026", "EMEF Eps",   "f@f.com", "f@f.com", "FALHA_ENTREGA", "", "", "", ""]
]);

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · \"está na caixa de enviados?\" sem gastar cota");
passo("o ID gravado é a comprovação");

const r = g.conferirOficiosNaCaixaDeEnviados(false, TOKEN);
ok(r.ok === true, "a conferência roda", r.mensagem);
igual(r.consultasAoGmail, 0,
      "e custa ZERO consulta ao Gmail",
      "o send() só devolve id quando deu certo — perguntar ao Gmail seria perguntar duas vezes");
igual(r.comProva, 2, "2 ofícios têm comprovação de envio (501 e 502)");

passo("separa o achado de verdade do ruído histórico");

igual(r.semProvaRecentes.length, 1,
      "só 1 ofício sem id é achado: o 503, enviado depois de 02/09");
igual(r.semProvaRecentes[0].numero, "503/2026", "  e é o número certo");
igual(r.semProvaAntigos, 1,
      "o 504 é anterior a 02/09 e NÃO conta como achado",
      "antes dessa data o envio usava sendEmail, que não devolve nada — a ausência é esperada");

ok(/503\/2026/.test(r.mensagem), "a mensagem NOMEIA o ofício que merece olhar");
ok(/Custo desta confer[êe]ncia: 0/.test(r.mensagem),
   "e diz o custo na cara",
   "número que não aparece é número que ninguém controla");

passo("ofício que não saiu não entra na conta");

igual(r.naoEnviados, 1, "o 505, em FALHA_ENTREGA, fica de fora");

passo("a conferência no Gmail é opcional, e aí sim custa");

const rGmail = g.conferirOficiosNaCaixaDeEnviados(true, TOKEN);
ok(rGmail.consultasAoGmail > 0,
   "pedindo explicitamente, ela consulta: " + rGmail.consultasAoGmail,
   "existe para quem desconfiar do próprio id — fora disso não se usa");
ok(rGmail.consultasAoGmail <= 20, "  e tem teto de 20 por chamada");

passo("porta");

let recusou = false;
try {
  const x = g.conferirOficiosNaCaixaDeEnviados(false, SEM_MODULO);
  recusou = !!(x && x.ok === false);
} catch (e) { recusou = /sess|permiss|autoriza|acesso ao m/i.test(e.message); }
ok(recusou, "quem não tem o módulo documentos é recusado",
   "ela lista número e escola da fila inteira");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · conferir recebimento é botão, não relógio");
passo("confere só o que foi escolhido");

/* O núcleo é o MESMO do gatilho. Se o botão tivesse cópia própria, as duas
   divergiriam — e o sistema teria duas respostas diferentes para "esse ofício
   foi confirmado?", dependendo de quem perguntou. */
const monSrc = fs.readFileSync(path.join(RAIZ, "MonitoramentoOficios.gs"), "utf8");

ok(/function MON_OFICIOS_verificarConfirmacoes_\(filtroNumeros\)/.test(monSrc),
   "existe um núcleo único, com filtro");
ok(/function verificarConfirmacoesRecebimento\(\)\s*\{\s*return MON_OFICIOS_verificarConfirmacoes_\(null\)/.test(
     monSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
   "  o gatilho chama o núcleo sem filtro — varre tudo, como sempre fez");
ok(/return MON_OFICIOS_verificarConfirmacoes_\(lista\)/.test(monSrc),
   "  e o botão chama o MESMO núcleo, com a lista escolhida",
   "uma regra só: cópia paralela divergiria");

passo("o filtro corta ANTES de gastar");

const nucleo = monSrc.slice(monSrc.indexOf("function MON_OFICIOS_verificarConfirmacoes_"));
const posFiltro = nucleo.indexOf("somenteEstes[numero]");
const posBusca  = nucleo.indexOf("GmailApp.search");
ok(posFiltro > -1 && posFiltro < posBusca,
   "o filtro é aplicado antes da busca no Gmail",
   "depois dela, o gasto já aconteceu — filtrar tarde não economiza nada");

passo("teto por clique");

const semSel = g.conferirRecebimentoOficios([], TOKEN);
igual(semSel.ok, false, "sem seleção, recusa");

const demais = [];
for (let i = 0; i < g.MON_OFICIOS_MAX_CONFERENCIA + 1; i++) demais.push("X" + i);
const estourou = g.conferirRecebimentoOficios(demais, TOKEN);
igual(estourou.ok, false,
      "acima de " + g.MON_OFICIOS_MAX_CONFERENCIA + " por vez, recusa",
      "um clique em 500 recriaria de uma vez o gasto que desligar o gatilho evitou");
ok(/consulta ao Gmail/.test(estourou.mensagem),
   "  e a recusa explica POR QUE tem teto");

passo("o resultado diz quanto custou");

const conf = g.conferirRecebimentoOficios(["501/2026"], TOKEN);
ok(conf.ok === true, "conferir um ofício funciona", conf.mensagem);
ok(typeof conf.consultas === "number",
   "o retorno traz o número de consultas ao Gmail",
   "sem isso o botão é um relógio disfarçado de botão");

passo("a porta do botão");

let recusou2 = false;
try {
  const y = g.conferirRecebimentoOficios(["501/2026"], SEM_MODULO);
  recusou2 = !!(y && y.ok === false);
} catch (e) { recusou2 = /sess|permiss|autoriza|acesso ao m/i.test(e.message); }
ok(recusou2, "quem não tem o módulo documentos não confere nada");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · a tela mostra o custo antes e depois do clique");

const tela = fs.readFileSync(path.join(RAIZ, "OficiosFormulario.html"), "utf8");
const js   = fs.readFileSync(path.join(RAIZ, "OficiosScripts.html"), "utf8");

ok(/id="btnHistConf"/.test(tela), "o botão existe na tela do Histórico");
ok(/id="histConfBarra"/.test(tela) && /display:none/.test(tela),
   "  numa barra própria, escondida até haver seleção",
   "barra vazia é convite para clicar e varrer tudo");
ok(/consulta\(s\) ao Gmail/.test(js),
   "  e o rótulo diz o custo ANTES do clique");
ok(/conferirRecebimentoOficios\(numeros, SISGEP_TOKEN_SESSAO\)/.test(js),
   "  chamando com o token certo",
   "o nome errado da variável viraria recusa silenciosa de sessão");

/* ══════════════════════════════════════════════════════════════════════════ */
naoTestavel("se a mensagem está mesmo na caixa de Enviados",
  "o emulador não fala com o Gmail. O que se prova aqui é a regra: id gravado " +
  "= envio bem-sucedido, porque o send() não devolve nada quando falha. " +
  "Quem responde de fato é abrir a caixa da conta que executa o script.");

naoTestavel("quanto o botão economiza na prática",
  "depende de quantos ofícios ficam pendentes por vez. O gatilho fazia " +
  "12 rodadas/dia sobre TODOS; o botão faz uma sobre os escolhidos. A conta " +
  "só fecha com o uso real de uma semana.");

resumo();
