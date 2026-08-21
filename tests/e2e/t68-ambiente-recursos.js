/**
 * ISOLAMENTO DAS PASTAS DO DRIVE ENTRE PRODUÇÃO E HOMOLOGAÇÃO
 *
 * O QUE ORIGINOU
 *
 * 20/08/2026. O projeto de homologação recebeu os 219 arquivos do repositório
 * e passou a rodar com os MESMOS IDs de pasta do Drive que a produção — o de
 * Comprovantes era byte a byte igual nos dois branches. Testar Comprovantes,
 * Recibos, Relatórios ou Voucher na homologação gravava dentro do acervo real
 * do sindicato, e gravava público, porque esses fluxos chamam setSharing.
 *
 * O defeito era SILENCIOSO: nada quebrava, nada avisava.
 *
 * O QUE ESTE TESTE PROVA
 *
 *   1. a resolução por ambiente devolve a pasta certa nos dois lados;
 *   2. a TRAVA impede gravação quando a homologação cai no ID de produção —
 *      esta é a asserção central, porque é o defeito original;
 *   3. os gargalos de gravação de verdade (Comprovantes, Voucher, Relatórios)
 *      pedem ao Drive o ID do ambiente corrente, e não a constante crua;
 *   4. nenhum .gs voltou a gravar lendo PASTA_*_ID direto.
 *
 * O QUE ELE NÃO PROVA
 *
 * Que a Script Property SISGEP_AMBIENTE está setada no projeto de homologação
 * que está no ar. Isso não vive no repositório e nenhum teste daqui alcança —
 * roda diagnosticoAmbienteRecursos_() lá dentro para saber. Enquanto não for
 * conferido, o veredito sobre o ambiente real é "NÃO TESTADO".
 *
 * MUTAÇÕES QUE ESTE TESTE MATOU (rodadas em 20/08/2026, uma a uma)
 *
 *   1. tirar a trava de getRecursoId_ ............................. MORTA
 *   2. trava comparando cfg[ambiente] em vez de cfg.producao ...... MORTA
 *   3. voltar Comprovantes a ler PASTA_COMPROVANTES_ID ............ MORTA
 *   4. Script Property perdendo para a tabela (ordem invertida) ... MORTA
 *   5. semTrava passando a valer sempre ........................... MORTA
 *
 * E UM DEFEITO QUE A PRÓPRIA MUTAÇÃO DESCOBRIU
 *
 * Na primeira rodada, 4 das 5 mutações "sobreviveram". Não tinham sobrevivido:
 * o t68 reprovava certo, em vermelho na tela — mas saía do processo com código
 * 0, porque base.js:resumo() imprimia as falhas e não marcava o exit code.
 * Só 9 dos 69 testes capturavam o retorno e decidiam o exit; os outros 60
 * reprovavam na tela e passavam no CI.
 *
 * Ou seja: a suíte enxergava processo que ESTOURA e era cega a asserção que
 * REPROVA. Corrigido em base.js — resumo() agora marca process.exitCode = 1
 * quando há falha. Com o relator consertado, as 5 mutações morreram.
 *
 * A lição é a mesma de 19/08, invertida: naquele dia eu li o TEXTO em vez do
 * código de saída; neste, o código de saída é que não estava ligado ao que o
 * teste tinha concluído. Medir exige checar as duas pontas.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");

b.fluxo("AMBIENTE · Isolamento das pastas do Drive (produção × homologação)");

const { g } = b.subir();

/* Trocar o ambiente exige invalidar o cache de getAmbienteAtual — ele guarda o
   valor na própria função (SistemaConfig.gs:286). Passar `true` força releitura
   E regrava o cache, que é o que o sistema faz em definirAmbiente(). */
function ambiente(env) {
  g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", env);
  g.getAmbienteAtual(true);
}

/** Executa `fn` e devolve a mensagem de erro, ou "" se não estourou. */
function erroDe(fn) {
  try { fn(); return ""; } catch (e) { return String((e && e.message) || e); }
}

/** Registra todo ID pedido ao Drive enquanto `fn` roda. */
function idsPedidosAoDrive(fn) {
  const original = g.DriveApp.getFolderById;
  const pedidos = [];
  g.DriveApp.getFolderById = function (id) { pedidos.push(String(id)); return original(id); };
  try { fn(); } finally { g.DriveApp.getFolderById = original; }
  return pedidos;
}

const CHAVES = ["COMPROVANTES", "RECIBOS", "RELATORIOS", "VOUCHER_DOCUMENTOS"];

/* ── 1. A tabela ────────────────────────────────────────────────────────── */
b.passo("1. Tabela de recursos");

b.ok(typeof g.getRecursoId_ === "function",
  "getRecursoId_ existe e foi carregada no escopo global");

b.ok(typeof g.RECURSOS_AMBIENTE === "object" && g.RECURSOS_AMBIENTE,
  "RECURSOS_AMBIENTE existe");

CHAVES.forEach(k => {
  const cfg = g.RECURSOS_AMBIENTE[k];
  b.ok(!!(cfg && cfg.producao && cfg.homologacao),
    k + " tem os dois ambientes preenchidos",
    cfg ? "" : "faltando na tabela");
  b.ok(!!(cfg && cfg.producao !== cfg.homologacao),
    k + " aponta para pastas DIFERENTES nos dois ambientes",
    cfg && cfg.producao === cfg.homologacao ? "MESMO ID — é o defeito original" : "");
});

/* ── 2. Produção resolve para produção ──────────────────────────────────── */
b.passo("2. Ambiente = produção");

ambiente("producao");
b.igual(g.getAmbienteAtual(), "producao", "getAmbienteAtual devolve produção");

CHAVES.forEach(k => {
  b.igual(g.getRecursoId_(k), g.RECURSOS_AMBIENTE[k].producao,
    k + " resolve para a pasta de produção");
});

b.ok(erroDe(() => CHAVES.forEach(k => g.getRecursoId_(k))) === "",
  "em produção a trava NUNCA dispara",
  "produção usar o ID de produção é o certo, não a contaminação");

/* ── 3. Homologação resolve para homologação ────────────────────────────── */
b.passo("3. Ambiente = homologação");

ambiente("homologacao");
b.igual(g.getAmbienteAtual(), "homologacao", "getAmbienteAtual devolve homologação");

CHAVES.forEach(k => {
  b.igual(g.getRecursoId_(k), g.RECURSOS_AMBIENTE[k].homologacao,
    k + " resolve para a pasta de homologação");
});

/* ── 4. A TRAVA — o coração do teste ────────────────────────────────────── */
b.passo("4. Trava de contaminação");

/* Simula exatamente o estado de 20/08/2026: homologação apontando para a
   pasta de produção. Antes desta mudança isso gravava calado. */
const guardado = g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao;
g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao = g.RECURSOS_AMBIENTE.COMPROVANTES.producao;

const msgTrava = erroDe(() => g.getRecursoId_("COMPROVANTES"));
b.ok(msgTrava !== "",
  "homologação apontando para a pasta de PRODUÇÃO é BLOQUEADA",
  msgTrava ? "" : "NÃO estourou — a contaminação passaria em silêncio");
b.ok(/BLOQUEADO/.test(msgTrava),
  "a mensagem diz BLOQUEADO", msgTrava);
b.ok(/COMPROVANTES/.test(msgTrava),
  "a mensagem nomeia a chave que falta configurar", msgTrava);

/* Contraprova: o mesmo estado em PRODUÇÃO não pode bloquear nada. */
ambiente("producao");
b.ok(erroDe(() => g.getRecursoId_("COMPROVANTES")) === "",
  "o mesmo estado, em produção, NÃO bloqueia",
  "trava que dispara em produção pararia o sindicato");

ambiente("homologacao");

/* semTrava: diagnóstico tem de conseguir relatar a pasta errada. */
b.ok(erroDe(() => g.getRecursoId_("COMPROVANTES", { semTrava: true })) === "",
  "semTrava:true relata em vez de estourar (uso de diagnóstico)");
b.igual(g.getRecursoId_("COMPROVANTES", { semTrava: true }),
  g.RECURSOS_AMBIENTE.COMPROVANTES.producao,
  "e devolve o ID que estava configurado, para o diagnóstico mostrar");

g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao = guardado;

/* ── 5. Script Property vence a tabela ──────────────────────────────────── */
b.passo("5. Sobreposição por Script Property");

const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_PASTA_RECIBOS", "PASTA_DESCARTAVEL_DO_TESTE");
b.igual(g.getRecursoId_("RECIBOS"), "PASTA_DESCARTAVEL_DO_TESTE",
  "SISGEP_PASTA_RECIBOS vence a tabela");
props.deleteProperty("SISGEP_PASTA_RECIBOS");
b.igual(g.getRecursoId_("RECIBOS"), g.RECURSOS_AMBIENTE.RECIBOS.homologacao,
  "removida a propriedade, volta a valer a tabela");

/* A sobreposição não pode virar porta dos fundos para a pasta de produção. */
props.setProperty("SISGEP_PASTA_RECIBOS", g.RECURSOS_AMBIENTE.RECIBOS.producao);
b.ok(/BLOQUEADO/.test(erroDe(() => g.getRecursoId_("RECIBOS"))),
  "propriedade apontando para produção também é BLOQUEADA",
  "senão a sobreposição seria um jeito de burlar a trava");
props.deleteProperty("SISGEP_PASTA_RECIBOS");

/* ── 6. Chave desconhecida ──────────────────────────────────────────────── */
b.passo("6. Erro de programação");

const msgChave = erroDe(() => g.getRecursoId_("PASTA_QUE_NAO_EXISTE"));
b.ok(msgChave !== "" && /desconhecido/i.test(msgChave),
  "chave inexistente estoura dizendo que é desconhecida", msgChave);
b.ok(/COMPROVANTES/.test(msgChave) && /RECIBOS/.test(msgChave),
  "e lista as chaves válidas, para quem errou o nome se achar");

/* ── 7. INTEGRAÇÃO: o que os gargalos de gravação pedem ao Drive ────────── */
b.passo("7. Gargalos de gravação, em homologação");

ambiente("homologacao");

const pedidosComprovantes = idsPedidosAoDrive(() => g.obterOuCriarPastaMesComprovantes_());
b.ok(pedidosComprovantes.indexOf(g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao) >= 0,
  "Comprovantes pede ao Drive a pasta de HOMOLOGAÇÃO",
  "pediu: " + JSON.stringify(pedidosComprovantes));
b.ok(pedidosComprovantes.indexOf(g.RECURSOS_AMBIENTE.COMPROVANTES.producao) < 0,
  "Comprovantes NÃO toca na pasta de produção",
  "pediu: " + JSON.stringify(pedidosComprovantes));

const pedidosVoucher = idsPedidosAoDrive(() => g.obterPastaVoucherDocumentos_());
b.ok(pedidosVoucher.indexOf(g.RECURSOS_AMBIENTE.VOUCHER_DOCUMENTOS.homologacao) >= 0,
  "Voucher pede ao Drive a pasta de HOMOLOGAÇÃO",
  "pediu: " + JSON.stringify(pedidosVoucher));
b.ok(pedidosVoucher.indexOf(g.RECURSOS_AMBIENTE.VOUCHER_DOCUMENTOS.producao) < 0,
  "Voucher NÃO toca na pasta de produção",
  "pediu: " + JSON.stringify(pedidosVoucher));

const pedidosRelatorios = idsPedidosAoDrive(() => g._obterPastaRelatorios_());
b.ok(pedidosRelatorios.indexOf(g.RECURSOS_AMBIENTE.RELATORIOS.homologacao) >= 0,
  "Relatórios pede ao Drive a pasta de HOMOLOGAÇÃO",
  "pediu: " + JSON.stringify(pedidosRelatorios));
b.ok(pedidosRelatorios.indexOf(g.RECURSOS_AMBIENTE.RELATORIOS.producao) < 0,
  "Relatórios NÃO toca na pasta de produção — nem pelo caminho de último recurso",
  "pediu: " + JSON.stringify(pedidosRelatorios));

/* Contraprova em produção: os mesmos gargalos têm de usar a pasta real. */
ambiente("producao");
const prodComprovantes = idsPedidosAoDrive(() => g.obterOuCriarPastaMesComprovantes_());
b.ok(prodComprovantes.indexOf(g.RECURSOS_AMBIENTE.COMPROVANTES.producao) >= 0,
  "em produção, Comprovantes volta a usar a pasta de produção",
  "pediu: " + JSON.stringify(prodComprovantes));

/* ── 8. INTEGRAÇÃO: gravação bloqueada quando falta configurar ──────────── */
b.passo("8. Homologação mal configurada não grava");

ambiente("homologacao");
const guardado2 = g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao;
g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao = g.RECURSOS_AMBIENTE.COMPROVANTES.producao;

const msgGrav = erroDe(() => g.obterOuCriarPastaMesComprovantes_());
b.ok(/BLOQUEADO/.test(msgGrav),
  "a gravação de Comprovantes PARA em vez de escrever no acervo real",
  msgGrav || "não estourou — gravaria em produção");

g.RECURSOS_AMBIENTE.COMPROVANTES.homologacao = guardado2;
ambiente("producao");

/* ── 9. Varredura estática: ninguém voltou a ler a constante crua ───────── */
b.passo("9. Nenhum .gs grava lendo PASTA_*_ID direto");

const arquivosGs = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs"));
const proibidos = [];

/* Padrões que significam GRAVAR usando a constante de produção. Comentário
   citando o nome da constante é legítimo e não pode ser confundido com uso —
   por isso a busca é pelas chamadas, não pela palavra solta.

   A varredura é dos QUATRO nomes que esta mudança passou a resolver por
   ambiente. Não vale para PASTA_*_ID em geral: existe pelo menos um alheio ao
   assunto (ver o passo 9b logo abaixo), e alargar o padrão a ponto de pegá-lo
   transformaria o teste num alarme que se aprende a ignorar. */
const CONSTANTES = "(?:PASTA_COMPROVANTES_ID|PASTA_RECIBO_ID|PASTA_RELATORIOS_ID|PASTA_VOUCHER_DOCUMENTOS_ID)";
const PADROES = [
  new RegExp("getFolderById\\s*\\(\\s*" + CONSTANTES + "\\s*\\)", "g"),
  new RegExp("obterOuCriarSubpastaAno\\s*\\(\\s*" + CONSTANTES + "\\s*\\)", "g")
];

arquivosGs.forEach(arq => {
  /* AmbienteRecursos.gs é o dono do assunto; SistemaConfig.gs declara os
     padrões de produção. Nenhum dos dois grava. */
  if (arq === "AmbienteRecursos.gs") return;
  const src = fs.readFileSync(path.join(RAIZ, arq), "utf8");
  PADROES.forEach(re => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      proibidos.push(arq + ": " + m[0]);
    }
  });
});

b.ok(proibidos.length === 0,
  arquivosGs.length + " arquivos .gs varridos, nenhum grava lendo a constante crua",
  proibidos.length ? proibidos.join(" · ") : "");

/* ── 9b. O caso alheio, registrado em vez de escondido ──────────────────── */
b.passo("9b. GuiasPagamento.gs — pasta nunca configurada");

/* A varredura acima achou getFolderById(PASTA_GUIAS_PAGAMENTO_ID) em
   GuiasPagamento.gs. NÃO é contaminação: aquele ID nunca foi preenchido, é o
   texto "COLE_AQUI_...", e o arquivo estoura de propósito antes de tocar no
   Drive. Não existe pasta de produção por trás dele para contaminar.
   GuiasPagamento.gs é legado mantido de propósito (commit 3394040) porque a
   rota pública ?page=pub-pixel-nf ainda o chama — REGRA Nº 1.

   Fica esta asserção para o dia em que alguém preencher o placeholder: aí o
   arquivo passa a gravar de verdade, e este teste avisa que ele precisa entrar
   em RECURSOS_AMBIENTE antes. */
const srcGuias = fs.readFileSync(path.join(RAIZ, "GuiasPagamento.gs"), "utf8");
const idGuias = (/PASTA_GUIAS_PAGAMENTO_ID\s*=\s*"([^"]*)"/.exec(srcGuias) || [])[1];

b.igual(idGuias, "COLE_AQUI_O_ID_DA_PASTA_DE_DESTINO",
  "PASTA_GUIAS_PAGAMENTO_ID continua sendo placeholder, não uma pasta real");
b.ok(/PASTA_GUIAS_PAGAMENTO_ID === "COLE_AQUI_O_ID_DA_PASTA_DE_DESTINO"/.test(srcGuias),
  "e a guarda que estoura antes de qualquer operação no Drive continua lá",
  "se alguém preencher o ID, este arquivo precisa entrar em RECURSOS_AMBIENTE");

/* ── 10. O diagnóstico responde a pergunta que o repositório não responde ── */
b.passo("10. Diagnóstico");

b.ok(typeof g.diagnosticoAmbienteRecursos_ === "function",
  "diagnosticoAmbienteRecursos_ existe (rodável pelo editor, fora do google.script.run)");

ambiente("homologacao");
const relatorio = String(g.diagnosticoAmbienteRecursos_() || "");
b.ok(/HOMOLOGACAO/.test(relatorio),
  "o diagnóstico diz em que ambiente está");
CHAVES.forEach(k => {
  b.ok(relatorio.indexOf(k) >= 0, "o diagnóstico lista " + k);
});

/* E, no estado mal configurado, ele APONTA o problema em vez de estourar. */
const guardado3 = g.RECURSOS_AMBIENTE.RECIBOS.homologacao;
g.RECURSOS_AMBIENTE.RECIBOS.homologacao = g.RECURSOS_AMBIENTE.RECIBOS.producao;
const relatorio2 = String(g.diagnosticoAmbienteRecursos_() || "");
b.ok(/APONTA PARA PRODU/.test(relatorio2),
  "com a pasta errada, o diagnóstico acusa em vez de quebrar",
  "é o que transforma o defeito silencioso em defeito visível");
g.RECURSOS_AMBIENTE.RECIBOS.homologacao = guardado3;

b.ok(typeof g.diagnosticoAmbienteRecursos === "undefined",
  "o diagnóstico NÃO está exposto ao google.script.run (nome termina em _)");

b.resumo();
