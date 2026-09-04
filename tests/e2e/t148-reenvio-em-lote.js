/**
 * TESTE — O REENVIO EM LOTE: o sistema decide, a pessoa confere e confirma
 *
 * O QUE ORIGINOU, 04/09/2026. Depois de a reconciliação de status virar
 * automática, o usuário perguntou: *"ele não reenvia sozinho? E eu só iria
 * conferir?"*.
 *
 * Ele estava certo. O `ofDest_preverReenvio_` já fazia o julgamento inteiro —
 * juntava as duas origens de endereço, consultava o histórico de cada um,
 * recusava quem quicou, preferia o cadastro de hoje, reunia os anexos — e
 * depois devolvia UM clique. Quinze ofícios em falha viravam quinze aberturas
 * de modal para reconfirmar quinze decisões já tomadas.
 *
 * O QUE ESTE TESTE PROTEGE, e cada item existe por um risco concreto:
 *
 *   1. As duas telas usam a MESMA regra de marcação. Se divergirem, o lote
 *      manda para um endereço que o modal individual recusaria — e ninguém
 *      descobre, porque as duas telas parecem concordar.
 *   2. Ofício sem endereço bom NÃO entra na pilha que sai. Inventar destino é
 *      exatamente o que a conferência existe para impedir.
 *   3. O envio manda a lista APROVADA, não uma recalculada. Trocar o endereço
 *      embaixo da pessoa transformaria a confirmação em teatro.
 *   4. Item que chega sem destinatário é ignorado, nunca adivinhado.
 *   5. A cota do Gmail conta DESTINATÁRIOS, e o corte é nomeado item a item.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA. O emulador não entrega e-mail nem renderiza
 * tela: ele prova a separação das pilhas, a escolha do destino e o caminho do
 * envio. Se o lote real sai com a ficha certa, só um reenvio em produção
 * responde — o `Anexos: N` de cada linha do resultado.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const MORTO = "thalia.ferreira@faesa.br";
const VIVO  = "karolina.caldeira@faesa.br";
const SEB   = "financeiro@seb.com.br";

/* ── cenário ─────────────────────────────────────────────────────────────
   FAESA: endereço do ofício morto, cadastro corrigido → DÁ para reenviar.
   SEB:   único endereço conhecido, e ele quicou → NÃO dá.
   999:   está na fila em falha e não existe no Registro → NÃO dá.
   Mais duas linhas que NÃO são falha, para provar que o lote não as pega. */
function semear() {
  const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
  reg.getRange(1, 1, 1, 7).setValues([[
    "Número do Ofício", "Tipo", "Escola", "E-mail (principal)",
    "E-mails (todos)", "Link Ficha", "Status"
  ]]);
  reg.getRange(2, 1, 6, 7).setValues([
    ["144/2026", "Filiação", "FAESA", MORTO, MORTO, "", "FALHA_ENTREGA"],
    ["168/2026", "Filiação", "FAESA", MORTO, MORTO, "", "FALHA_ENTREGA"],
    ["397/2026", "Filiação", "SEB",   SEB,   SEB,   "", "FALHA_ENTREGA"],
    ["500/2026", "Filiação", "FAESA", MORTO, MORTO, "", "FALHA_ENTREGA"],
    ["250/2026", "Filiação", "FAESA", VIVO,  VIVO,  "", "CONFIRMADO"],
    ["286/2026", "Filiação", "FAESA", VIVO,  VIVO,  "", "CONFIRMADO"]
  ]);

  const esc = ss.insertSheet("Escolas");
  esc.getRange(1, 1, 1, 3).setValues([[
    "Escola (Razão Social)", "E-mail (principal)", "E-mails (todos)"
  ]]);
  esc.getRange(2, 1, 2, 3).setValues([
    ["FAESA", VIVO, VIVO],
    /* O cadastro do SEB só tem o mesmo endereço que já quicou. */
    ["SEB", SEB, SEB]
  ]);

  const fila = ss.insertSheet(g.ABA_FILA_OFICIOS);
  fila.getRange(1, 1, 1, 6).setValues([[
    "ID", "NUMERO_OFICIO", "TIPO", "ESCOLA", "STATUS", "ANEXOS_JSON"
  ]]);
  const anexo = n => JSON.stringify([{ fileId: "ARQ-" + n, mimeType: "application/pdf" }]);
  fila.getRange(2, 1, 8, 6).setValues([
    ["f1", "144/2026", "Filiação", "FAESA", "FALHA_ENTREGA", anexo("144")],
    ["f2", "168/2026", "Filiação", "FAESA", "FALHA_ENTREGA", anexo("168")],
    ["f3", "397/2026", "Filiação", "SEB",   "FALHA_ENTREGA", anexo("397")],
    ["f4", "999/2026", "Filiação", "ORFA",  "FALHA_ENTREGA", anexo("999")],
    /* A MESMA tentativa do 144, gravada de novo — a fila guarda tentativas, e
       um ofício que quicou aparece mais de uma vez em falha. */
    ["f5", "144/2026", "Filiação", "FAESA", "FALHA_ENTREGA", anexo("144")],
    /* Em falha, mas sem anexo de onde tirar o PDF. */
    ["f6", "500/2026", "Filiação", "FAESA", "FALHA_ENTREGA", "[]"],
    ["f7", "250/2026", "Filiação", "FAESA", "CONFIRMADO",    anexo("250")],
    ["f8", "286/2026", "Filiação", "FAESA", "ENVIADO",       anexo("286")]
  ]);
}
semear();

function limparCaches() {
  g.ofDest_cacheHistorico_ = null;
  g.ofDest_cacheCadastro_  = null;
  g.ofDest_cacheRegistro_  = null;
}

fluxo("LOTE · a preparação separa o que sai do que precisa de gente");
passo("preparar");

limparCaches();
const p = g.prepararReenvioLoteOficios(TOKEN);

ok(p && p.ok, "a preparação responde", p && p.mensagem);
igual(p.total, 5, "conta cinco ofícios distintos em FALHA_ENTREGA",
      "são seis linhas na fila; o 144 aparece duas vezes e vale uma");

const prontos = {}; (p.prontos || []).forEach(x => prontos[x.numero] = x);
const pend    = {}; (p.pendentes || []).forEach(x => pend[x.numero] = x);

ok(!!prontos["144/2026"], "o 144 entra na pilha que SAI",
   "o cadastro da FAESA tem endereço que nunca quicou");
ok(!!prontos["168/2026"], "e o 168 também");

igual((prontos["144/2026"].destinatarios || [])[0], VIVO,
      "e vai para o endereço do cadastro de HOJE");
ok((prontos["144/2026"].destinatarios || []).indexOf(MORTO) === -1,
   "nunca para o que quicou",
   "é o defeito que originou toda esta frente, em 01/09");

ok(!!pend["397/2026"], "o 397 do SEB fica de fora — todos os endereços quicaram");
ok(String(pend["397/2026"].motivo).indexOf("quicaram") > -1,
   "e o motivo é dito em palavras", pend["397/2026"].motivo);
ok((pend["397/2026"].enderecos || []).length >= 1,
   "com os endereços nomeados, para a pessoa saber o que procurar");

ok(!!pend["999/2026"], "ofício que a fila conhece e o Registro não também fica de fora",
   "sem a linha do Registro não há e-mail gravado nem data que resgate a ficha");

ok(!prontos["250/2026"] && !pend["250/2026"],
   "e o que NÃO está em falha não entra no lote de jeito nenhum");
ok(!prontos["286/2026"] && !pend["286/2026"], "nem o que já foi enviado");

passo("o mesmo ofício não sai duas vezes");

/* A fila guarda TENTATIVAS. Um ofício que quicou pode ter duas linhas em
   falha, e sem trava o lote mandaria o mesmo documento oficial duas vezes
   para a mesma escola — a segunda cópia sem como ser desfeita. */
igual((p.prontos || []).filter(x => x.numero === "144/2026").length, 1,
      "o 144 tem duas linhas na fila e entra UMA vez no lote");

passo("sem PDF não há reenvio, e a tela não promete que há");

ok(!prontos["500/2026"], "ofício sem PDF identificável não entra em 'prontos para sair'");
ok(!!pend["500/2026"], "ele vai para a pilha de quem precisa de gente");
ok(String(pend["500/2026"].motivo).indexOf("PDF") > -1,
   "com o motivo dito", pend["500/2026"].motivo);

passo("as duas telas concordam");

/* Se a regra da marcação se duplicar, o lote e o modal divergem no primeiro
   ajuste — e divergir aqui significa o lote mandar para um endereço que o
   modal recusaria. Por isso a regra mora numa função só. */
limparCaches();
const individual = g.preverReenvioOficio(
  { numero: "144/2026", escola: "FAESA", tipo: "Filiação" }, TOKEN);
const marcadosNoModal = (individual.destinatarios || [])
  .filter(d => d.marcado).map(d => d.email).sort();

igual(JSON.stringify(marcadosNoModal),
      JSON.stringify((prontos["144/2026"].destinatarios || []).slice().sort()),
      "o lote escolhe EXATAMENTE o que o modal individual marcaria");

const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosDestinatarios.gs"), "utf8");
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
igual((semComentarios.match(/ofDest_montarListaDestinos_\s*\(/g) || []).length, 3,
      "uma definição e dois chamadores — a regra não foi copiada",
      "definir + preverReenvio + prepararLote");

passo("a cota é medida em destinatários, não em ofícios");

ok(typeof p.destinatariosTotais === "number",
   "a preparação diz quantos destinatários o lote vai consumir",
   p.destinatariosTotais + " destinatário(s) para " + p.prontos.length + " ofício(s)");
ok(/MailApp\.getRemainingDailyQuota/.test(fonte),
   "e consulta a cota real do Gmail",
   "o Gmail conta destinatários por dia; comparar com o número de ofícios daria falsa folga");

fluxo("LOTE · o envio manda o que foi aprovado, e só isso");
passo("enviar");

amb.outbox.length = 0;
limparCaches();
const env = g.executarReenvioLoteOficios({
  itens: (p.prontos || []).map(x => ({
    numero: x.numero, url: x.url, escola: x.escola, tipo: x.tipo,
    destinatarios: x.destinatarios
  }))
}, TOKEN);

ok(env && env.ok, "o lote responde", env && env.mensagem);
igual(env.enviados, 2, "os dois ofícios prontos saíram");
igual(env.falharam, 0, "nenhum com erro");
igual((env.resultados || []).length, 2, "e o resultado vem item a item, não como total");

const destinos = amb.outbox.map(m => String(m.to || "").toLowerCase()).join(" ");
ok(destinos.indexOf(VIVO) > -1, "foi para o endereço vivo");
ok(destinos.indexOf(MORTO) === -1, "e nenhuma cópia para o morto");
ok(destinos.indexOf(SEB) === -1,
   "o do SEB não saiu — ele nunca esteve na lista aprovada");

passo("item sem destinatário é ignorado, nunca adivinhado");

const cego = g.executarReenvioLoteOficios({
  itens: [{ numero: "144/2026", url: "x", escola: "FAESA", tipo: "Filiação", destinatarios: [] }]
}, TOKEN);
igual(cego.ignorados, 1, "o item vazio é ignorado");
igual(cego.enviados, 0, "e nada é enviado por dedução");
ok(String((cego.resultados || [])[0].mensagem).indexOf("Ignorado") > -1,
   "com o motivo dito, não em silêncio");

passo("o lote vazio não é sucesso silencioso");

const nada = g.executarReenvioLoteOficios({ itens: [] }, TOKEN);
ok(nada && nada.ok === false, "lote sem itens é recusado, não tratado como enviado");

passo("a cota corta com nome");

const cotaOriginal = g.MailApp.getRemainingDailyQuota;
g.MailApp.getRemainingDailyQuota = () => 0;
amb.outbox.length = 0;
const semCota = g.executarReenvioLoteOficios({
  itens: [{ numero: "144/2026", url: "https://drive.google.com/file/d/ARQ-144/view",
            escola: "FAESA", tipo: "Filiação", destinatarios: [VIVO] }]
}, TOKEN);
g.MailApp.getRemainingDailyQuota = cotaOriginal;

igual(semCota.enviados, 0, "com a cota esgotada nada sai");
igual(semCota.interrompidoPorCota, true, "e o lote diz que foi a cota");
ok(String((semCota.resultados || [])[0].mensagem).indexOf("cota") > -1,
   "cada ofício não enviado carrega o motivo",
   "sem isso viraria 'erro' genérico, indistinguível de endereço inválido");

fluxo("LOTE · as leituras da planilha não se multiplicam por ofício");
passo("índices");

ok(typeof g.ofDest_mapaRegistroOficios_ === "function",
   "o Registro é indexado uma vez por execução");
ok(typeof g.ofDest_mapaCadastroEscolas_ === "function",
   "e a aba Escolas também",
   "antes cada ofício revarria as 679 escolas e o Registro inteiro");

limparCaches();
const vazioReg = g.ofDest_lerRegistroOficio_("000/2026");
ok(vazioReg && vazioReg.ok === false, "ofício inexistente continua respondendo 'não encontrado'");
ok(String(vazioReg.mensagem).indexOf("não encontrado") > -1,
   "com a mesma mensagem de antes",
   "trocar por mapa vazio faria erro de estrutura virar 'ofício não existe'");

fluxo("LOTE · a tela");
passo("faixa e modal");

const tela = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
const marcacao = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosFormulario.html"), "utf8");

ok(marcacao.indexOf("histLoteBarra") > -1, "a faixa existe na tela");
ok(marcacao.indexOf("histLoteOverlay") > -1, "e o modal de conferência também");
ok(tela.indexOf("prepararReenvioLoteOficios") > -1, "a tela chama a preparação");
ok(tela.indexOf("executarReenvioLoteOficios") > -1, "e o envio");

ok(tela.indexOf("loteAtualizarBarra(lista)") > -1,
   "a faixa conta sobre a lista inteira, não sobre a filtrada",
   "um contador que obedecesse ao filtro prometeria menos do que o botão faz");

ok(/histLoteOk[\s\S]{0,200}disabled/.test(marcacao),
   "o botão de enviar nasce desabilitado",
   "ele só liga depois de a conferência voltar com o que sai");

ok(tela.indexOf("ctx.ciente") > -1,
   "enviar sem a ficha exige um segundo clique consciente, como no individual");

ok(tela.indexOf("SEM ENDEREÇO BOM") > -1,
   "a pilha que precisa de gente aparece na tela, nomeada",
   "esconder o que o sistema não resolveu é o jeito mais rápido de a pessoa achar que resolveu tudo");

passo("a confirmação continua sendo da pessoa");

ok(!/ScriptApp\.newTrigger\([^)]*executarReenvioLoteOficios/.test(fonte),
   "nenhum gatilho dispara o lote sozinho",
   "decidido com o usuário em 04/09: 'confirmação manual' — documento oficial não sai sem alguém ver");

naoTestavel("se o e-mail do lote chega com a ficha certa",
  "o emulador registra o envio e não entrega. Só o 'Anexos: N' de cada linha " +
  "do resultado, num reenvio real, responde.");

resumo();
