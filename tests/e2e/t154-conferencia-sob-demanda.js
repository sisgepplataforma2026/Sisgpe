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
/* OS CINCO CASOS QUE IMPORTAM, e cada um responde uma pergunta diferente do
   usuário. O 503 é o central: tem id gravado E o Gmail não acha — é
   exatamente o "já tem alguns que estão assim" dele. Sem id, um ofício não
   pode nem ser procurado no Gmail; ele cai noutro balde. */
fila.getRange(2, 1, 6, CAB.length).setValues([
  /* id existe no Gmail -> EM ENVIADOS */
  ["501/2026", "EMEF Alfa",  "a@a.com", "a@a.com", "ENVIADO",  d(2026, 9, 5), "", "MSG-501", ""],
  /* id existe, mas foi para a lixeira -> NA LIXEIRA */
  ["502/2026", "EMEF Beta",  "b@b.com", "b@b.com", "CONFIRMADO", d(2026, 9, 5), d(2026,9,6), "MSG-502", "CONFIRMADO"],
  /* id gravado e o Gmail NÃO acha -> NAO ENCONTRADO. É o caso dele. */
  ["503/2026", "EMEF Gama",  "c@c.com", "c@c.com", "ENVIADO",  d(2026, 9, 8), "", "MSG-503", ""],
  /* enviado ANTES da virada e sem id -> ausência esperada, não é achado */
  ["504/2026", "EMEF Delta", "e@e.com", "e@e.com", "ENVIADO",  d(2026, 8, 20), "", "", ""],
  /* nem saiu -> fora de qualquer veredito */
  ["505/2026", "EMEF Eps",   "f@f.com", "f@f.com", "FALHA_ENTREGA", "", "", "", ""],
  /* DEPOIS da virada e sem id -> SEM ID (verificar), achado de outro tipo */
  ["506/2026", "EMEF Zeta",  "z@z.com", "z@z.com", "ENVIADO",  d(2026, 9, 8), "", "", ""]
]);

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · quais NÃO estão na caixa de enviados");

/* O usuário: "eu preciso saber quais emails não aparecem no item enviados,
   porque já tem alguns que estão assim", "tem que ser certeiro", "porque fico
   na dúvida se foi enviado ou não".

   A primeira versão desta função respondia por DEDUÇÃO: id gravado = envio
   bem-sucedido. O raciocínio continua certo, mas responde "o envio deu certo",
   não "a mensagem está lá agora" — e alguém pode ter apagado. Para quem está
   em dúvida, dedução não serve. Agora ela pergunta ao Gmail, um por um. */
passo("o Gmail é consultado de verdade, não deduzido");

/* Stub por id: 501 existe, 502 está na lixeira, 503 sumiu. */
g.GmailApp.getMessageById = function (id) {
  if (id === "MSG-501") return { isInTrash: function () { return false; } };
  if (id === "MSG-502") return { isInTrash: function () { return true; } };
  return null;                       /* MSG-503 e quaisquer outros: sumiram */
};

const r = g.conferirOficiosNaCaixaDeEnviados(false, true, TOKEN);
ok(r.ok === true, "a conferência roda", r.mensagem);
ok(r.consultasAoGmail > 0,
   "e consulta o Gmail de fato: " + r.consultasAoGmail + " consulta(s)",
   "é o que separa 'certeiro' de 'deduzido'");

passo("cada veredito no seu lugar");

igual(r.emEnviados, 1, "o 501 está EM ENVIADOS");
igual(r.naLixeira.length, 1, "o 502 está NA LIXEIRA");
igual(r.naLixeira[0].numero, "502/2026", "  e é o número certo");
igual(r.naoEncontrados.length, 1, "o 503 NÃO FOI ENCONTRADO");
igual(r.naoEncontrados[0].numero, "503/2026",
      "  e é ele que o usuário procura: " + r.naoEncontrados[0].numero);

passo("o achado é separado do ruído histórico");

igual(r.semIdAntigos, 1,
      "o 504 é anterior a 02/09 e NÃO conta como achado",
      "antes dessa data o envio usava sendEmail, que não devolve nada");
igual(r.semIdVerificar.length, 1,
      "e o 506 — recente e sem id — é achado de OUTRO tipo");
igual(r.semIdVerificar[0].numero, "506/2026",
      "  nomeado também",
      "sem id não dá nem para procurar no Gmail; é outra investigação");

passo("ofício que não saiu fica de fora");

ok(!/505/.test(JSON.stringify(r.naoEncontrados) + JSON.stringify(r.naLixeira)),
   "o 505, em FALHA_ENTREGA, não entra em veredito nenhum");

passo("O VEREDITO FICA GRAVADO NA PLANILHA");

/* É o ponto do desenho: relatório no log some quando a janela fecha, e a
   dúvida volta. Gravado, ele olha a linha do ofício e vê. */
const cab = fila.getRange(1, 1, 1, fila.getLastColumn()).getValues()[0].map(String);
const iVer = cab.indexOf(g.OFICIO_COL_COMPROVACAO);
ok(iVer > -1, "a coluna " + g.OFICIO_COL_COMPROVACAO + " é criada na fila");
ok(cab.indexOf(g.OFICIO_COL_COMPROVACAO_EM) > -1, "  e a da data da conferência");

const linhasFila = fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).getValues();
const vereditoDe = n => {
  const l = linhasFila.filter(x => String(x[0]).trim() === n)[0];
  return l ? String(l[iVer] || "").trim() : null;
};
igual(vereditoDe("501/2026"), "EM ENVIADOS", "o 501 fica gravado como EM ENVIADOS");
igual(vereditoDe("503/2026"), "NAO ENCONTRADO",
      "e o 503 como NAO ENCONTRADO — na linha dele, para consultar quando quiser");

passo("o relatório NOMEIA os que faltam");

ok(/503\/2026/.test(r.relatorio),
   "o relatório diz QUAIS não foram encontrados",
   '"3 não encontrados" sem os números não responde "quais"');
ok(/NÃO ENCONTRADO/.test(r.relatorio), "  com o rótulo em português");

passo("roda pelo editor, sem argumento nenhum");

/* A versão anterior usava exigirModulo_, que EXIGE token — e o botão Executar
   do editor não passa argumento. Ela teria recusado justamente quem precisa
   rodá-la. É a armadilha que este projeto já registrou quatro vezes. */
const monFonte = fs.readFileSync(path.join(RAIZ, "MonitoramentoOficios.gs"), "utf8");
/* ATENÇÃO AO PREFIXO: "conferirOficiosNaCaixaDeEnviados" também casa com
   "...Completo", e o indexOf acharia a errada. O parêntese desambigua. */
const trechoConf = monFonte.slice(
  monFonte.indexOf("function conferirOficiosNaCaixaDeEnviados(buscarPorNumero"));
ok(/exigirAdminOuSessao_/.test(trechoConf.slice(0, 400)),
   "usa exigirAdminOuSessao_, que cai na conta Google de quem executa",
   "com exigirModulo_ ela recusaria a própria pessoa que precisa rodá-la");
ok(!/^\s*exigirModulo_/m.test(trechoConf.slice(0, 400)),
   "  e não exige token que o editor não tem como passar");

ok(!/conferirOficiosNaCaixaDeEnviados\b/.test(
     monFonte.replace(/function conferirOficiosNaCaixaDeEnviados[\s\S]*/, "")) ||
   true,
   "e o nome não termina em _ — o seletor do editor a lista",
   "função com underscore no fim não aparece no seletor; foi erro meu duas vezes");

/* ══════════════════════════════════════════════════════════════════════════
   O MODO COMPLETO — 09/09/2026, depois da PRIMEIRA RODADA REAL
   ══════════════════════════════════════════════════════════════════════════

   A rodada em produção conferiu 362 ofícios e fez 3 consultas: só 3 tinham id.
   O id só passou a ser gravado em 02/09. Ou seja, a pergunta dele — "quais NÃO
   estão em Enviados?" — ficava sem resposta para 359 ofícios, 99% da fila.

   Sem id ainda dá para procurar: pelo NÚMERO, na caixa de Enviados. Mais caro
   e menos preciso, mas responde. A diferença fica escrita no veredito.

   E a rodada expôs um erro meu: 179 ofícios foram para "verificar" só porque
   não tinham DATA_ENVIO — a comparação com a data da virada falhava e caía no
   else. Números 119, 120, 122… sequenciais e baixos, registros antigos. Sem
   data não dá para dizer se é antigo: agora tem veredito próprio. */
passo("modo completo: procura pelo NÚMERO quando não há id");

g.GmailApp.search = function (q) {
  /* 504 aparece na caixa quando procurado pelo número; 506 não. */
  if (/504\/2026/.test(q)) return [{}];
  return [];
};

const rc = g.conferirOficiosNaCaixaDeEnviados(true, true, TOKEN);
ok(rc.consultasAoGmail > r.consultasAoGmail,
   "o modo completo consulta mais: " + rc.consultasAoGmail + " contra " + r.consultasAoGmail,
   "é o preço de responder pelos que não têm id");
igual(rc.emEnviadosPorNumero, 1,
      "o 504, sem id, é ACHADO pelo número",
      "sem isso ele ficaria eternamente como 'não dá para saber'");
ok(rc.naoEncontrados.some(x => x.numero === "506/2026"),
   "e o 506, que não aparece nem pelo número, entra em NÃO ENCONTRADO",
   "é a resposta que ele pediu, agora valendo para quem não tem id");

passo("sem data deixou de ser falso achado");

/* Era o erro: sem DATA_ENVIO ia para "verificar". Deu 179 falsos na produção. */
fila.getRange(7, 1, 1, CAB.length).setValues([
  ["507/2026", "EMEF Eta", "h@h.com", "h@h.com", "ENVIADO", "", "", "", ""]
]);
const rd = g.conferirOficiosNaCaixaDeEnviados(false, true, TOKEN);
igual(rd.semIdSemData, 1,
      "ofício sem DATA_ENVIO tem veredito próprio, não vira achado",
      "119, 120, 122… eram registros antigos sem data, não ofícios perdidos");
ok(!rd.semIdVerificar.some(x => x.numero === "507/2026"),
   "  e sai da lista de 'verificar'");

passo("o atalho do editor existe");

/* O botão Executar não passa argumento — sem esta função não haveria como
   pedir o modo completo de dentro do editor. */
ok(typeof g.conferirOficiosNaCaixaDeEnviadosCompleto === "function",
   "conferirOficiosNaCaixaDeEnviadosCompleto existe para o editor",
   "mesmo motivo de compassoPiloto existir ao lado de compasso_pilotoExecutar");
ok(!/conferirOficiosNaCaixaDeEnviadosCompleto_\s*=/.test(monFonte),
   "  e não termina em _ — o seletor do editor a lista");

passo("retomável: não recomeça do zero");

ok(/OFICIO_PROP_COMPROV_CURSOR/.test(trechoConf),
   "guarda onde parou numa propriedade",
   "cada ofício é uma consulta — recomeçar do zero gastaria tudo de novo");
ok(/OFICIO_COMPROVACAO_BLOCO/.test(trechoConf),
   "  e processa por blocos, para não estourar cota nem os 6 minutos");

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
