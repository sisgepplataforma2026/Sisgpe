// ============================================================================
// ARQUIVO: EscolasIdentidade.gs
// IDENTIDADE ÚNICA DA ESCOLA — Fase 1 do item 8 do PROMPT-MESTRE.
//
// A regra do item 8, literal: "Deve existir uma única entidade Escola. Os
// demais módulos devem guardar escolaId, evitando duplicidade de CNPJ, nome e
// contatos."
//
// O QUE EXISTIA ANTES DESTE ARQUIVO
//
// Nada. `escolaId` não aparecia em nenhum lugar do projeto. Os três módulos
// que dependem de Escolas não referenciavam a escola — COPIAVAM os dados dela:
//
//   Ofícios     grava `escola` (texto) + `cnpj` em cada linha do log
//   Cobrança    copia ESCOLA_CNPJ, ESCOLA_NOME e ESCOLA_EMAIL para dentro da
//               própria aba, e cruza com Sindicalização "best-effort por nome"
//               (o comentário é nosso, CobrancaRelacaoNominal.gs:117)
//   Associados  guarda `escola` como texto livre, em ~8.000 registros
//
// Consequência prática, e é por isso que este arquivo veio antes de qualquer
// tela nova: renomear uma escola, ou fundir duas duplicatas, QUEBRAVA em
// silêncio todo vínculo que apontava para o nome antigo. Ninguém era avisado.
// A deduplicação — que é uma funcionalidade oferecida na tela — era o caminho
// mais rápido para o estrago.
//
// POR QUE UMA COLUNA NOVA, E NÃO O CNPJ
//
// CNPJ não serve como identidade nesta base, por três motivos medidos:
//   - escola pode ser cadastrada SEM CNPJ (o cadastro permite, e há 31 assim);
//   - matriz e filial dividem a raiz;
//   - a base tem duplicatas com o mesmo CNPJ — existe uma tela só para achá-las.
//
// Número de linha também não serve: desliza a cada exclusão, e a deduplicação
// reescreve a aba inteira.
//
// GARANTIAS QUE ESTE ARQUIVO PRECISA DAR
//
//   1. Id nunca muda depois de atribuído.
//   2. Id nunca é reaproveitado — nem depois de a linha ser excluída, nem
//      depois de ser absorvida numa fusão. Reaproveitar id faria uma
//      referência antiga apontar para a escola ERRADA, que é pior que apontar
//      para nada.
//   3. A migração é idempotente: rodar dez vezes é igual a rodar uma.
//   4. Fusão de duplicatas não perde o rastro: o id absorvido continua
//      resolvendo para o sobrevivente, via SISGEP_Escolas_Merges.
// ============================================================================

var ESC_COL_ID          = "EscolaID";
var ESC_PREFIXO_ID      = "ESC-";
var ESC_DIGITOS_ID      = 6;
var ESC_ABA_MERGES      = "SISGEP_Escolas_Merges";
// Piso do contador, guardado fora da planilha. É o que garante a garantia nº 2
// mesmo no cenário extremo de alguém apagar todas as linhas da aba: sem este
// piso, o próximo cadastro voltaria a ESC-000001 e herdaria as referências da
// escola apagada.
var ESC_PROP_ULTIMO_ID  = "SISGEP_ESCOLAS_ULTIMO_ID";

/* =============================================================== */
/* FORMATO                                                          */
/* =============================================================== */

function escolaFormatarId_(n) {
  var s = String(Math.max(0, Math.floor(Number(n) || 0)));
  while (s.length < ESC_DIGITOS_ID) s = "0" + s;
  return ESC_PREFIXO_ID + s;
}

/** Devolve 0 para qualquer coisa que não seja um id no formato. */
function escolaNumeroDoId_(id) {
  var m = String(id || "").trim().toUpperCase().match(/^ESC-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function escolaIdValido_(id) {
  return escolaNumeroDoId_(id) > 0;
}

/* =============================================================== */
/* COLUNA                                                           */
/* =============================================================== */

/**
 * Garante a coluna EscolaID no cabeçalho e devolve o índice (1-based).
 *
 * A coluna nasce no FIM da aba, de propósito: inserir no meio deslocaria todas
 * as outras e qualquer código que ainda leia por posição fixa passaria a ler a
 * coluna errada. No fim, nada se move.
 */
function escolaGarantirColunaId_(sh) {
  var hMap = getHeaderMapEscolas_(sh);
  if (hMap[ESC_COL_ID]) return hMap[ESC_COL_ID];
  var col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue(ESC_COL_ID).setFontWeight("bold");
  SpreadsheetApp.flush();
  return col;
}

/* =============================================================== */
/* ALOCAÇÃO                                                         */
/* =============================================================== */

/**
 * Maior número já usado, considerando as TRÊS fontes.
 *
 * Olhar só a coluna da planilha seria suficiente num mundo sem exclusão. Como
 * exclusão e fusão existem, o maior id vivo pode ser menor que o maior id já
 * distribuído — e aí o próximo cadastro reaproveitaria um número. Por isso o
 * cálculo cruza planilha, tabela de fusões e o piso em ScriptProperties.
 */
function escolaMaiorNumeroId_(sh, colId) {
  var maior = 0;

  var ultimaLinha = sh.getLastRow();
  if (ultimaLinha >= 2) {
    var col = sh.getRange(2, colId, ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      var n = escolaNumeroDoId_(col[i][0]);
      if (n > maior) maior = n;
    }
  }

  try {
    var shM = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ESC_ABA_MERGES);
    if (shM && shM.getLastRow() >= 2) {
      var m = shM.getRange(2, 1, shM.getLastRow() - 1, 3).getValues();
      for (var j = 0; j < m.length; j++) {
        var a = escolaNumeroDoId_(m[j][1]);   // absorvido
        var b = escolaNumeroDoId_(m[j][2]);   // sobrevivente
        if (a > maior) maior = a;
        if (b > maior) maior = b;
      }
    }
  } catch (e) {
    Logger.log("escolaMaiorNumeroId_ — merges indisponível: " + e);
  }

  try {
    var piso = parseInt(PropertiesService.getScriptProperties().getProperty(ESC_PROP_ULTIMO_ID) || "0", 10);
    if (piso > maior) maior = piso;
  } catch (e2) {
    Logger.log("escolaMaiorNumeroId_ — piso indisponível: " + e2);
  }

  return maior;
}

function escolaGravarPiso_(n) {
  try {
    PropertiesService.getScriptProperties().setProperty(ESC_PROP_ULTIMO_ID, String(n));
  } catch (e) {
    Logger.log("escolaGravarPiso_ falhou: " + e);
  }
}

/**
 * Reserva `quantidade` ids em sequência e devolve o array.
 *
 * Sob LockService: dois cadastros simultâneos lendo o mesmo "maior + 1" dariam
 * o MESMO id a escolas diferentes, que é o cenário que este arquivo inteiro
 * existe para impedir. Lock de script, sem aninhamento — nenhuma função que
 * chama esta segura lock (conferido em Escolas.gs, EscolasReceita.gs e
 * BuscaEscola.gs).
 */
function escolaAlocarIds_(sh, colId, quantidade) {
  quantidade = Math.max(1, Math.floor(Number(quantidade) || 1));
  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    travou = lock.tryLock(15000);
    var base = escolaMaiorNumeroId_(sh, colId);
    var ids = [];
    for (var i = 1; i <= quantidade; i++) ids.push(escolaFormatarId_(base + i));
    escolaGravarPiso_(base + quantidade);
    return ids;
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (e) {} }
  }
}

/**
 * Id da linha: devolve o que já existe, ou aloca um.
 * Idempotente por construção — chamar de novo na mesma linha devolve o mesmo.
 */
function escolaIdDaLinha_(sh, rowNum) {
  var colId = escolaGarantirColunaId_(sh);
  var atual = String(sh.getRange(rowNum, colId).getValue() || "").trim();
  if (escolaIdValido_(atual)) return atual.toUpperCase();
  var novo = escolaAlocarIds_(sh, colId, 1)[0];
  sh.getRange(rowNum, colId).setValue(novo);
  return novo;
}

/* =============================================================== */
/* MIGRAÇÃO — a rotina que toca as 681 linhas reais                */
/* =============================================================== */

/**
 * Preenche EscolaID em toda linha que ainda não tem.
 *
 * Idempotente e conservadora:
 *   - só ESCREVE em célula vazia da coluna nova; jamais reescreve id existente;
 *   - jamais toca em qualquer outra coluna;
 *   - se não houver nada a fazer, não cria backup nem escreve nada;
 *   - linha sem nome também recebe id. Ela é cadastro incompleto, não lixo —
 *     e sem id continuaria invisível para exclusão e para o lote, que é
 *     exatamente o defeito que esta fase existe para fechar.
 */
function escolaMigrarIds(tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "escolas", true);
  return escolaMigrarIds_interno_(
    String((sessao && (sessao.nome || sessao.usuario || sessao.email)) || "").trim() || "—"
  );
}

/**
 * A MESMA migração, para rodar pelo editor do Apps Script.
 *
 * Por que existe: pelo editor não há sessão do SISGEP — `escolaMigrarIds()`
 * sem token bate em exigirModulo_ e recusa, que é a trava fazendo o trabalho
 * dela. Mas a migração precisa rodar UMA vez antes de existir botão (a tela é
 * da Fase 2), e é isso que esta função resolve.
 *
 * POR QUE ISTO NÃO É UM FURO DE SEGURANÇA — e por que o underscore no fim
 * não é estilo:
 *
 * Neste projeto todo top-level SEM underscore final é endpoint de
 * `google.script.run`, alcançável de QUALQUER tela por quem estiver no
 * navegador. Uma função que pula a checagem de sessão e fosse alcançável dali
 * seria exatamente um bypass de autorização. O underscore final é o que impede
 * `google.script.run` de chamá-la — ela só roda pelo editor.
 *
 * E rodar pelo editor já exige acesso de edição ao projeto Apps Script: quem
 * tem isso pode reescrever qualquer regra e abrir a planilha inteira. Não há
 * privilégio novo a conceder aqui — só um caminho para quem já é dono.
 *
 * NÃO REMOVER O UNDERSCORE. Sem ele, esta função vira uma porta aberta.
 */
function escolaMigrarIdsPeloEditor_() {
  var quem = "editor";
  try { quem = Session.getEffectiveUser().getEmail() || "editor"; } catch (e) {}
  Logger.log("escolaMigrarIdsPeloEditor_ — executando como " + quem);
  var r = escolaMigrarIds_interno_(quem);
  Logger.log(JSON.stringify(r));
  return r;
}

function escolaMigrarIds_interno_(quemExecutou) {
  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    travou = lock.tryLock(30000);
    if (!travou) {
      return { ok: false, mensagem: "Outra operação de Escolas está em andamento. Tente de novo em instantes." };
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    var colId = escolaGarantirColunaId_(sh);
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) {
      return { ok: true, criados: 0, jaTinham: 0, total: 0, mensagem: "Nenhuma escola na base." };
    }

    var valores = sh.getRange(2, colId, ultimaLinha - 1, 1).getValues();
    var semId = [];
    var jaTinham = 0;
    for (var i = 0; i < valores.length; i++) {
      if (escolaIdValido_(valores[i][0])) { jaTinham++; continue; }
      semId.push(i);
    }

    if (!semId.length) {
      return {
        ok: true, criados: 0, jaTinham: jaTinham, total: valores.length,
        mensagem: "Todas as " + jaTinham + " escolas já têm identidade. Nada a fazer."
      };
    }

    // Backup só quando de fato vai escrever.
    var nomeBackup = escolaNomeBackupLivre_(ss, "BACKUP_ESCOLAS_ID_");
    var dadosCompletos = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    var shBackup = ss.insertSheet(nomeBackup);
    shBackup.getRange(1, 1, dadosCompletos.length, dadosCompletos[0].length).setValues(dadosCompletos);
    shBackup.getRange(1, 1, 1, dadosCompletos[0].length).setFontWeight("bold");
    shBackup.setFrozenRows(1);

    // Aloca de uma vez só e grava a coluna inteira — uma escrita, não 681.
    var base = escolaMaiorNumeroId_(sh, colId);
    for (var k = 0; k < semId.length; k++) {
      valores[semId[k]][0] = escolaFormatarId_(base + k + 1);
    }
    escolaGravarPiso_(base + semId.length);
    sh.getRange(2, colId, valores.length, 1).setValues(valores);
    SpreadsheetApp.flush();
    invalidarCacheEscolasInterno_();

    escolaAuditar_("MIGRAR_IDENTIDADE", "", "",
      "Identidade única atribuída a " + semId.length + " escola(s). Backup: " + nomeBackup + ".",
      String(quemExecutou || "—"));

    return {
      ok: true,
      criados: semId.length,
      jaTinham: jaTinham,
      total: valores.length,
      backup: nomeBackup,
      mensagem: semId.length + " escola(s) receberam identidade. " +
                jaTinham + " já tinham. Backup: " + nomeBackup + "."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao migrar identidades: " + e.message };
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (e2) {} }
  }
}

/* =============================================================== */
/* FUSÕES — para o id absorvido nunca virar referência órfã         */
/* =============================================================== */

function escolaGarantirAbaMerges_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ESC_ABA_MERGES);
  if (sh) return sh;
  sh = ss.insertSheet(ESC_ABA_MERGES);
  sh.getRange(1, 1, 1, 5)
    .setValues([["DATA_HORA", "ID_ABSORVIDO", "ID_SOBREVIVENTE", "MOTIVO", "USUARIO"]])
    .setFontWeight("bold");
  sh.setFrozenRows(1);
  return sh;
}

/**
 * Registra que `absorvido` passou a ser `sobrevivente`.
 * Sem isto, toda referência gravada antes da fusão viraria ponteiro para o
 * nada — e o usuário não teria como saber que perdeu o vínculo.
 */
function escolaRegistrarFusao_(idAbsorvido, idSobrevivente, motivo, usuario) {
  try {
    if (!escolaIdValido_(idAbsorvido) || !escolaIdValido_(idSobrevivente)) return false;
    if (String(idAbsorvido).toUpperCase() === String(idSobrevivente).toUpperCase()) return false;
    var sh = escolaGarantirAbaMerges_();
    sh.appendRow([
      agoraFormatadoEscolas_(),
      String(idAbsorvido).toUpperCase(),
      String(idSobrevivente).toUpperCase(),
      String(motivo || ""),
      String(usuario || "")
    ]);
    return true;
  } catch (e) {
    Logger.log("escolaRegistrarFusao_ falhou: " + e);
    return false;
  }
}

/**
 * Segue a cadeia de fusões até o id atual.
 *
 * A cadeia pode ter mais de um salto (A virou B, depois B virou C), e uma
 * planilha editada à mão pode produzir ciclo. O limite de saltos existe para
 * o ciclo virar resposta honesta em vez de laço infinito.
 */
function escolaResolverId_(id) {
  var atual = String(id || "").trim().toUpperCase();
  if (!escolaIdValido_(atual)) return "";
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ESC_ABA_MERGES);
    if (!sh || sh.getLastRow() < 2) return atual;
    var linhas = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
    var mapa = {};
    linhas.forEach(function (l) {
      var de = String(l[1] || "").trim().toUpperCase();
      var para = String(l[2] || "").trim().toUpperCase();
      if (de && para) mapa[de] = para;
    });
    var vistos = {};
    for (var saltos = 0; saltos < 50; saltos++) {
      if (!mapa[atual]) return atual;
      if (vistos[atual]) {
        Logger.log("escolaResolverId_ — ciclo de fusões detectado em " + atual);
        return atual;
      }
      vistos[atual] = true;
      atual = mapa[atual];
    }
    Logger.log("escolaResolverId_ — cadeia longa demais a partir de " + id);
    return atual;
  } catch (e) {
    Logger.log("escolaResolverId_ falhou: " + e);
    return atual;
  }
}

/* =============================================================== */
/* API PARA AS TELAS                                                */
/* =============================================================== */

/** Resolve um id (seguindo fusões) e devolve a escola atual, ou null. */
function escolaPorId(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var alvo = escolaResolverId_(id);
  if (!alvo) return null;
  var lista = listarEscolasCadastro_interno_();
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i][ESC_COL_ID] || lista[i].EscolaID || "").trim().toUpperCase() === alvo) {
      return lista[i];
    }
  }
  return null;
}

/** Diz para onde um id antigo aponta hoje. Usado por quem guardou referência. */
function escolaResolverIdentidade(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var original = String(id || "").trim().toUpperCase();
  var atual = escolaResolverId_(original);
  return {
    ok: !!atual,
    idOriginal: original,
    idAtual: atual,
    fundida: !!atual && atual !== original
  };
}

/** Estado da migração — alimenta o card do dashboard e o botão de migrar. */
function escolaStatusIdentidade(tokenSessao) {
  exigirModulo_(tokenSessao, "escolas", false);
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    var hMap = getHeaderMapEscolas_(sh);
    var colId = hMap[ESC_COL_ID];
    var ultimaLinha = sh.getLastRow();
    var total = Math.max(0, ultimaLinha - 1);

    if (!colId) {
      return { ok: true, colunaExiste: false, total: total, comId: 0, semId: total,
               mensagem: "A coluna " + ESC_COL_ID + " ainda não existe. Nenhuma escola tem identidade." };
    }
    if (total === 0) {
      return { ok: true, colunaExiste: true, total: 0, comId: 0, semId: 0, mensagem: "Nenhuma escola na base." };
    }

    var col = sh.getRange(2, colId, total, 1).getValues();
    var comId = 0;
    for (var i = 0; i < col.length; i++) if (escolaIdValido_(col[i][0])) comId++;

    var shM = ss.getSheetByName(ESC_ABA_MERGES);
    var fusoes = shM && shM.getLastRow() > 1 ? shM.getLastRow() - 1 : 0;

    return {
      ok: true, colunaExiste: true, total: total, comId: comId, semId: total - comId, fusoes: fusoes,
      mensagem: comId === total
        ? "Todas as " + total + " escolas têm identidade única."
        : (total - comId) + " de " + total + " escolas ainda sem identidade."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ler status da identidade: " + e.message };
  }
}
