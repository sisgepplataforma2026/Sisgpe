// ============================================================================
// 🗑️ ARQUIVO: Lixeira.gs
// 🏷️  SISGEP — Excluir registro é MOVER, não apagar
// ============================================================================
//
// O QUE ORIGINOU
//
// 20/08/2026. Uma varredura achou 36 chamadas de `deleteRow`/`deleteRows` em
// 20 arquivos. Classificadas, 21 delas apagavam CADASTRO ou REGISTRO DE
// NEGÓCIO — escola (679 reais na base), contato, colaborador, folha de
// pagamento, recibo emitido, lançamento de receita, solicitação de bolsa.
//
// As outras 15 apagam fila, rascunho, cache e expurgo por idade, onde apagar
// é o comportamento certo. Essas NÃO passam por aqui — ver a lista no fim.
//
// POR QUE ISTO NÃO É PRECIOSISMO
//
// A razão está escrita no cabeçalho de VoucherLixeira.gs, que resolveu o
// mesmo problema em 13/08/2026, por decisão do usuário ("vai para lixeira"):
//
//     "Uma linha apagada some com o rastro de um papel que existe no mundo —
//      e o buraco só aparece meses depois, quando a escola liga perguntando
//      de um certificado que o sindicato não tem mais registro de ter
//      emitido."
//
// Vale igual para as outras 21. O sindicato emite documento que vai para
// gente de fora; o registro interno é a única prova de que aquilo existiu.
//
// POR QUE MOVER A LINHA, E NÃO MARCAR "EXCLUIDO = true"
//
// Foi a decisão de desenho, e ela é sobre onde o erro pode nascer.
//
// Marcando com flag, a linha CONTINUA na aba principal. Aí toda listagem,
// toda contagem, todo relatório e toda exportação do sistema precisaria
// filtrar `EXCLUIDO != true` — dezenas de lugares, e cada um esquecido é um
// registro excluído reaparecendo num relatório para a diretoria.
//
// Movendo, a linha SAI da aba. Nenhum código de leitura muda, porque não há
// o que filtrar. O caminho com menos lugar para errar.
//
// A ORDEM DAS OPERAÇÕES NÃO É INTERCAMBIÁVEL
//
// Copia → CONFERE que copiou → só então apaga. Invertido, ou sem a
// conferência no meio, uma falha entre as duas etapas deixa a linha fora dos
// dois lugares: sumiu da origem e não chegou na lixeira. É o único jeito de
// esta função piorar o problema que veio resolver.
//
// O LIMITE DE LOTE
//
// Pedido do usuário em 20/08/2026 — "Exclusão Com limite!" — ao decidir sobre
// `excluirEscolasEmLote`, que podia mandar centenas de escolas de uma vez.
// O teto está em REGRAS_NEGOCIO.LIMITE_EXCLUSAO_POR_LOTE e segue a convenção
// que o projeto já tinha para LIMITE_ASSOCIADOS_POR_LOTE.
//
// Acima do teto a operação RECUSA e diz quantas foram pedidas — não corta em
// silêncio. Excluir 300 e avisar que excluiu 50 é pior do que não excluir:
// quem pediu segue achando que as 300 saíram.
//
// ORDEM DE CARGA: chame só de dentro do corpo de outras funções, nunca em
// `var X = ...` no topo de outro arquivo (ver AmbienteRecursos.gs).
// ============================================================================

/** Sufixo da aba de lixeira. "Escolas" → "Escolas_LIXEIRA". */
var LIXEIRA_SUFIXO = "_LIXEIRA";

/** Colunas de metadado acrescentadas à direita do cabeçalho de origem. */
function lixeiraColunas_() {
  return ["_LIXEIRA_ID", "_EXCLUIDO_EM", "_EXCLUIDO_POR", "_MOTIVO", "_ABA_ORIGEM"];
}

/** Teto de exclusão em lote, com padrão se REGRAS_NEGOCIO não estiver carregado. */
function lixeiraLimiteLote_() {
  try {
    if (typeof REGRAS_NEGOCIO === "object" && REGRAS_NEGOCIO &&
        REGRAS_NEGOCIO.LIMITE_EXCLUSAO_POR_LOTE) {
      return Number(REGRAS_NEGOCIO.LIMITE_EXCLUSAO_POR_LOTE);
    }
  } catch (e) {}
  return 50;
}

/**
 * Garante a aba de lixeira correspondente a uma aba de origem.
 * O cabeçalho é o da origem mais as colunas de metadado.
 */
function lixeiraAba_(aba) {
  var ss     = aba.getParent();
  var nome   = aba.getName() + LIXEIRA_SUFIXO;
  var sh     = ss.getSheetByName(nome);
  var extras = lixeiraColunas_();

  if (!sh) {
    var largura = Math.max(aba.getLastColumn(), 1);
    var cabec   = aba.getRange(1, 1, 1, largura).getValues()[0];
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cabec.length + extras.length)
      .setValues([cabec.concat(extras)]);
    sh.getRange(1, 1, 1, cabec.length + extras.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Quem está excluindo — sessão se houver, senão o usuário do Apps Script. */
function lixeiraQuem_(opcoes) {
  var s = opcoes && opcoes.sessao;
  if (s) {
    var q = String(s.nome || s.usuario || s.email || "").trim();
    if (q) return q;
  }
  if (opcoes && opcoes.quem) return String(opcoes.quem).trim();
  try { return Session.getActiveUser().getEmail() || "SISGEP"; } catch (e) {}
  return "SISGEP";
}

/**
 * Move UMA linha para a lixeira da própria aba.
 *
 * Substitui `aba.deleteRow(linha)` nos pontos que apagam cadastro ou registro
 * de negócio. A assinatura foi feita para ser trocável linha a linha.
 *
 * @param {Sheet} aba        Aba de origem.
 * @param {number} linha     Índice da linha (1-based, como no deleteRow).
 * @param {Object=} opcoes   { motivo, sessao, quem, origem }
 * @return {{ ok: boolean, id: string, mensagem: string }}
 */
function lixeiraMover_(aba, linha, opcoes) {
  opcoes = opcoes || {};

  if (!aba)   throw new Error("Lixeira: aba não informada.");
  linha = Number(linha);
  if (!linha || linha < 2) {
    throw new Error("Lixeira: linha inválida (" + linha + "). A linha 1 é o cabeçalho.");
  }

  var largura = Math.max(aba.getLastColumn(), 1);
  var valores = aba.getRange(linha, 1, 1, largura).getValues()[0];

  var id = Utilities.getUuid();
  var meta = [
    id,
    new Date(),
    lixeiraQuem_(opcoes),
    String(opcoes.motivo || "").slice(0, 500),
    aba.getName() + (opcoes.origem ? " · " + opcoes.origem : "")
  ];

  var shLix = lixeiraAba_(aba);

  /* ── 1. COPIA ────────────────────────────────────────────────────────── */
  var destino = shLix.getLastRow() + 1;
  shLix.getRange(destino, 1, 1, valores.length + meta.length)
       .setValues([valores.concat(meta)]);

  /* ── 2. CONFERE QUE COPIOU ───────────────────────────────────────────
     Sem esta etapa, uma falha entre copiar e apagar deixa a linha fora dos
     DOIS lugares. É a única forma de esta função piorar o problema que veio
     resolver — por isso ela existe, e por isso o flush vem antes.          */
  SpreadsheetApp.flush();
  var gravado = shLix.getRange(destino, valores.length + 1).getValue();
  if (String(gravado) !== id) {
    throw new Error(
      "Lixeira: a cópia não foi confirmada na aba " + shLix.getName() +
      ". NADA foi apagado da origem — o registro continua em " +
      aba.getName() + ", linha " + linha + "."
    );
  }

  /* ── 3. SÓ AGORA APAGA DA ORIGEM ─────────────────────────────────────── */
  aba.deleteRow(linha);

  return {
    ok: true,
    id: id,
    mensagem: "Movido para " + shLix.getName() + "."
  };
}

/**
 * Move VÁRIAS linhas, respeitando o teto de lote.
 *
 * Apaga de baixo para cima: apagar de cima desloca os índices das linhas
 * seguintes e faria a segunda exclusão pegar a linha errada.
 *
 * @param {Sheet} aba
 * @param {number[]} linhas  Índices 1-based, em qualquer ordem.
 * @param {Object=} opcoes
 * @return {{ ok: boolean, movidas: number, ids: string[], mensagem: string }}
 */
function lixeiraMoverVarias_(aba, linhas, opcoes) {
  opcoes = opcoes || {};
  linhas = (linhas || []).map(Number).filter(function (n) { return n >= 2; });

  if (!linhas.length) {
    return { ok: false, movidas: 0, ids: [], mensagem: "Nenhuma linha para excluir." };
  }

  /* O TETO RECUSA, NÃO CORTA — pedido do usuário em 20/08/2026.
     Excluir 50 de 300 e avisar "50 excluídas" deixa quem pediu achando que
     as 300 saíram. Recusar é o comportamento honesto. */
  var teto = lixeiraLimiteLote_();
  if (linhas.length > teto) {
    return {
      ok: false,
      movidas: 0,
      ids: [],
      mensagem: "Foram pedidas " + linhas.length + " exclusões, e o limite por " +
                "lote é " + teto + ". NADA foi excluído. Faça em lotes menores " +
                "ou ajuste REGRAS_NEGOCIO.LIMITE_EXCLUSAO_POR_LOTE."
    };
  }

  var ordenadas = linhas.slice().sort(function (a, b) { return b - a; });
  var ids = [];

  ordenadas.forEach(function (n) {
    var r = lixeiraMover_(aba, n, opcoes);
    ids.push(r.id);
  });

  return {
    ok: true,
    movidas: ids.length,
    ids: ids,
    mensagem: ids.length + " registro(s) movido(s) para a lixeira."
  };
}

/**
 * Lista o que está na lixeira de uma aba. Leitura, não altera nada.
 * @param {Sheet|string} abaOuNome
 */
function lixeiraListar_(aba) {
  var shLix = aba.getParent().getSheetByName(aba.getName() + LIXEIRA_SUFIXO);
  if (!shLix || shLix.getLastRow() < 2) return [];

  var largura = shLix.getLastColumn();
  var cabec   = shLix.getRange(1, 1, 1, largura).getValues()[0];
  var dados   = shLix.getRange(2, 1, shLix.getLastRow() - 1, largura).getValues();

  return dados.map(function (linha) {
    var obj = {};
    cabec.forEach(function (c, i) { obj[String(c)] = linha[i]; });
    return obj;
  });
}

/**
 * Devolve uma linha da lixeira para a aba de origem.
 * Mesma ordem cuidadosa: grava na origem, confere, e só então tira da lixeira.
 */
function lixeiraRestaurar_(aba, id) {
  id = String(id || "").trim();
  if (!id) throw new Error("Lixeira: id não informado.");

  var shLix = aba.getParent().getSheetByName(aba.getName() + LIXEIRA_SUFIXO);
  if (!shLix || shLix.getLastRow() < 2) {
    return { ok: false, mensagem: "A lixeira de " + aba.getName() + " está vazia." };
  }

  var extras   = lixeiraColunas_().length;
  var largura  = shLix.getLastColumn();
  var colId    = largura - extras + 1;
  var dados    = shLix.getRange(2, 1, shLix.getLastRow() - 1, largura).getValues();

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][colId - 1]) !== id) continue;

    var original = dados[i].slice(0, largura - extras);
    var destino  = aba.getLastRow() + 1;
    aba.getRange(destino, 1, 1, original.length).setValues([original]);

    SpreadsheetApp.flush();
    if (aba.getLastRow() < destino) {
      return { ok: false, mensagem: "Não consegui gravar de volta em " + aba.getName() +
                                    ". Nada foi tirado da lixeira." };
    }

    shLix.deleteRow(i + 2);
    return { ok: true, linha: destino, mensagem: "Restaurado em " + aba.getName() + "." };
  }

  return { ok: false, mensagem: "Registro " + id + " não está na lixeira." };
}

/* ════════════════════════════════════════════════════════════════════════════
   O QUE **NÃO** PASSA POR AQUI, E POR QUÊ

   Estes 15 pontos continuam apagando de verdade, porque apagar é o
   comportamento correto neles. Estão listados para que ninguém "conserte" o
   que não está quebrado:

     Oficios.gs  ×4   FILA_ENVIO_OFICIOS — fila de envio, some ao processar.
                      É também o ÚNICO módulo em operação: não se mexe.
     Recibo.gs   ×2   rascunho de beneficiários e deduplicação
     MemoriaCore ×2   cache da memória, repopulado a cada execução
     CentralEmailIA   expurgo de adiados antigos, por idade
     EscolasReceita   expurgo de dados antigos, por idade
     Visitas.gs       limpeza de dados de TESTE
     RHColaboradores  regerar folha da competência (substituição)
     CobrancaRelacaoAnexos  reimportação idempotente da mesma escola+competência
     VoucherLixeira ×2  JÁ É a lixeira — apagar de lá é o ato final

   A asserção que fixa isso está em tests/e2e/t72-exclusao-logica.js.
   ════════════════════════════════════════════════════════════════════════════ */

/** Diagnóstico. Underscore de propósito: roda no editor, não pela web. */
function diagnosticoLixeira_() {
  var linhas = [];
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  LIXEIRA — SISGEP");
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  Limite por lote : " + lixeiraLimiteLote_());
  linhas.push("");

  try {
    var ss = SpreadsheetApp.openById(
      typeof PLANILHA_ID !== "undefined" ? PLANILHA_ID : getPlanilhaId()
    );
    var achou = 0;
    ss.getSheets().forEach(function (sh) {
      var nome = sh.getName();
      if (nome.slice(-LIXEIRA_SUFIXO.length) !== LIXEIRA_SUFIXO) return;
      achou++;
      linhas.push("  " + nome + " : " + Math.max(sh.getLastRow() - 1, 0) + " registro(s)");
    });
    if (!achou) linhas.push("  (nenhuma aba de lixeira criada ainda)");
  } catch (e) {
    linhas.push("  ERRO ao ler a planilha: " + e.message);
  }

  linhas.push("═══════════════════════════════════════════════════════════");
  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
