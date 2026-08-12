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
/**
 * DOIS CAMINHOS DE ENTRADA, UMA TRAVA EM CADA.
 *
 * COM token: é a tela chamando. Trava normal — sessão do SISGEP, módulo
 * Escolas, perfil administrador.
 *
 * SEM token: é o editor do Apps Script. Precisa existir porque a migração tem
 * de rodar UMA vez antes de haver botão (a tela é da Fase 2), e pelo editor
 * não há sessão do SISGEP para apresentar.
 *
 * A primeira tentativa foi uma função separada terminada em underscore, que
 * `google.script.run` não alcança. Não serve: o seletor de funções do editor
 * também não lista função com underscore final — ela existe e não tem como ser
 * executada dali. Por isso a trava mudou de lugar.
 *
 * O QUE SEGURA O CAMINHO SEM TOKEN
 *
 * A identidade Google de quem executa, cruzada com a aba USUARIOS:
 *
 *   - `Session.getActiveUser().getEmail()` devolve o e-mail de verdade quando
 *     se roda pelo editor. Numa chamada de `google.script.run` vinda do app
 *     publicado "executar como eu / qualquer pessoa", devolve string VAZIA —
 *     e string vazia é recusa aqui. Ou seja: falha fechado.
 *   - Mesmo com e-mail, só passa quem estiver cadastrado como
 *     ADMINISTRADOR ATIVO no SISGEP. Ter conta Google não basta.
 *
 * Quem roda pelo editor já tem acesso de edição ao projeto — pode reescrever
 * qualquer regra e abrir a planilha inteira. Não há privilégio novo sendo
 * concedido; só um caminho para quem já é dono, com o registro de quem foi.
 */
function escolaMigrarIds(tokenSessao) {
  var comToken = String(tokenSessao || "").trim();

  if (comToken) {
    var sessao = exigirModulo_(comToken, "escolas", true);
    return escolaMigrarIds_interno_(
      String((sessao && (sessao.nome || sessao.usuario || sessao.email)) || "").trim() || "—"
    );
  }

  var email = "";
  try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  if (!email) {
    throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
  }

  /* Dono do projeto Apps Script.
   *
   * Este é o caminho que realmente resolve o caso do editor, e a razão é
   * concreta: a conta Google que roda o editor deste projeto é uma conta
   * pessoal (@gmail.com), enquanto a aba de usuários guarda os e-mails
   * institucionais (@sindeducacao.com). São identidades diferentes — exigir
   * que batessem obrigaria a criar uma conta de login no SISGEP só para rodar
   * uma migração, o que é pior: conta de acesso a uma base com 8.000 pessoas
   * não se cria como efeito colateral de tarefa técnica.
   *
   * Session.getEffectiveUser() é sob qual identidade o script executa — o dono
   * do projeto. Quando quem executa É o dono, estamos no editor (ou é o
   * próprio dono no navegador, que já podia abrir o editor de qualquer jeito).
   * Nenhum privilégio novo: quem é dono do projeto já pode reescrever qualquer
   * regra deste código.
   *
   * No app publicado "executar como eu / qualquer pessoa", o visitante anônimo
   * tem getActiveUser() vazio e já foi recusado acima; um visitante
   * identificado tem e-mail DIFERENTE do dono e cai na checagem de
   * administrador logo abaixo. Falha fechado nos dois casos. */
  var dono = "";
  try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
  var ehDonoDoProjeto = !!dono && dono === email;

  if (!ehDonoDoProjeto && !escolaEhAdministradorPorEmail_(email)) {
    // A mensagem diz QUAL conta foi vista e o que se procurou. "Ação permitida
    // somente para administradores", sozinha, não deixa ninguém consertar nada:
    // a causa quase sempre é o e-mail da conta Google ser diferente do que está
    // na coluna EMAIL da aba USUARIOS, e sem ver os dois lado a lado não há
    // como perceber. Mostrar ao usuário o próprio e-mail não vaza nada.
    throw new Error(
      "Ação permitida somente para administradores. A conta " + email +
      " não é a dona deste projeto Apps Script (" + (dono || "desconhecida") +
      ") nem foi encontrada na aba " + ABA_USUARIOS_LOGIN +
      " com EMAIL igual a esse, PERFIL = ADMINISTRADOR e STATUS = ATIVO."
    );
  }
  Logger.log("escolaMigrarIds — execução " +
    (ehDonoDoProjeto ? "pelo dono do projeto" : "por administrador cadastrado") + ": " + email);
  var r = escolaMigrarIds_interno_(email);
  Logger.log(JSON.stringify(r));
  return r;
}

/** Administrador ATIVO na aba USUARIOS, procurado pelo e-mail da conta Google. */
function escolaEhAdministradorPorEmail_(email) {
  try {
    var alvo = String(email || "").trim().toLowerCase();
    if (!alvo) return false;
    var aba = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_USUARIOS_LOGIN);
    if (!aba || aba.getLastRow() < 2) return false;

    var dados = aba.getDataRange().getValues();
    var cab = dados[0].map(function (h) { return String(h || "").trim().toUpperCase(); });
    var iEmail  = cab.indexOf("EMAIL");
    var iPerfil = cab.indexOf("PERFIL");
    var iStatus = cab.indexOf("STATUS");
    if (iEmail === -1 || iPerfil === -1) return false;

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][iEmail] || "").trim().toLowerCase() !== alvo) continue;
      var perfil = String(dados[i][iPerfil] || "").trim().toUpperCase();
      var status = iStatus === -1 ? "ATIVO" : String(dados[i][iStatus] || "").trim().toUpperCase();
      return perfil === "ADMINISTRADOR" && status === "ATIVO";
    }
    return false;
  } catch (e) {
    // Falhar aqui é recusar. Erro de leitura não pode virar permissão.
    Logger.log("escolaEhAdministradorPorEmail_ falhou: " + e);
    return false;
  }
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

/* =============================================================== */
/* DIAGNÓSTICO DE COLUNAS — só leitura                             */
/* =============================================================== */
/*
 * Conta o que existe em cada coluna da aba Escolas, sem escrever nada.
 *
 * Por que existe: a aba tem 37 colunas e o cadastro mexe em 20. Para decidir
 * quais das outras 17 são dado vivo, quais são resíduo de funcionalidade
 * antiga e quais estão duplicando outra, é preciso saber quantas linhas cada
 * uma tem preenchida — e isso ninguém consegue olhando a planilha na tela com
 * 679 linhas.
 *
 * Tentei responder isso exportando a planilha por fora e não deu: a exportação
 * junta todas as abas sem separador e trunca, e me devolveu telefone dentro da
 * coluna de razão social. Contagem tirada dali seria invenção. Esta função lê a
 * aba de verdade, que é a única fonte que vale.
 *
 * NÃO ESCREVE NADA. Pode rodar quantas vezes quiser, a qualquer hora.
 */
function escolaDiagnosticoColunas(tokenSessao) {
  // Mesma porta dupla da migração: token da tela, ou dono/administrador no editor.
  if (String(tokenSessao || "").trim()) {
    exigirModulo_(tokenSessao, "escolas", true);
  } else {
    var email = "";
    try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
    var dono = "";
    try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
    if (!email) throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
    if (email !== dono && !escolaEhAdministradorPorEmail_(email)) {
      throw new Error("Ação permitida somente para administradores.");
    }
  }

  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };

    var ultimaLinha = sh.getLastRow();
    var ultimaCol   = sh.getLastColumn();
    if (ultimaLinha < 2) return { ok: true, total: 0, colunas: [], mensagem: "Nenhuma escola na base." };

    var tudo = sh.getRange(1, 1, ultimaLinha, ultimaCol).getValues();
    var cab  = tudo[0].map(function (c) { return String(c || "").trim(); });
    var total = ultimaLinha - 1;

    var colunas = cab.map(function (nome, i) {
      var preenchidas = 0;
      var amostra = [];
      for (var l = 1; l < tudo.length; l++) {
        var v = tudo[l][i];
        var t = (v instanceof Date) ? "[data] " + Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
                                    : String(v == null ? "" : v).trim();
        if (!t) continue;
        preenchidas++;
        if (amostra.length < 3 && amostra.indexOf(t) === -1) amostra.push(t.slice(0, 40));
      }
      return {
        posicao: i + 1,
        nome: nome || "(sem nome no cabeçalho)",
        preenchidas: preenchidas,
        vazias: total - preenchidas,
        percentual: total ? Math.round((preenchidas / total) * 100) : 0,
        amostra: amostra
      };
    });

    // O caso que motivou tudo: duas colunas para o mesmo dado.
    var iNome  = cab.indexOf(COL_NOME_ESCOLA);
    var iRazao = cab.indexOf("RAZAO_SOCIAL");
    var duplicidade = null;
    if (iNome > -1 && iRazao > -1) {
      var iguais = 0, diferentes = 0, soRazao = 0, exemplos = [];
      for (var r = 1; r < tudo.length; r++) {
        var a = String(tudo[r][iNome]  || "").trim();
        var b = String(tudo[r][iRazao] || "").trim();
        if (!b) continue;
        if (!a) { soRazao++; continue; }
        if (a.toLowerCase() === b.toLowerCase()) iguais++;
        else {
          diferentes++;
          if (exemplos.length < 5) exemplos.push({ linha: r + 1, coluna2: a.slice(0, 45), razaoSocial: b.slice(0, 45) });
        }
      }
      duplicidade = {
        colunaNome: COL_NOME_ESCOLA, colunaRazao: "RAZAO_SOCIAL",
        iguais: iguais, diferentes: diferentes, soEmRazaoSocial: soRazao, exemplos: exemplos
      };
    }

    var resultado = { ok: true, total: total, totalColunas: ultimaCol, colunas: colunas, duplicidade: duplicidade };
    escolaImprimirDiagnostico_(resultado);
    return resultado;
  } catch (e) {
    Logger.log("Erro no diagnóstico: " + e.message);
    return { ok: false, mensagem: "Erro no diagnóstico: " + e.message };
  }
}

/*
 * Escreve o diagnóstico no Registro de execução, em tabela.
 *
 * Existe porque rodar a função pelo editor não mostra nada: o editor não
 * imprime o valor de retorno, só o que passou por Logger.log. Sem isto, a
 * execução termina com "Execução concluída" e nenhuma informação — foi o que
 * aconteceu na primeira tentativa.
 *
 * Devolver JSON cru de 37 colunas também não resolveria: ninguém lê. Vai em
 * tabela, ordenada da coluna mais vazia para a mais cheia, que é a ordem em
 * que a decisão interessa — coluna vazia é candidata a sair, coluna cheia é
 * dado que alguém precisa ver na tela.
 */
function escolaImprimirDiagnostico_(r) {
  try {
    var L = [];
    L.push("═══ DIAGNÓSTICO DA ABA ESCOLAS ═══");
    L.push(r.total + " escolas · " + r.totalColunas + " colunas");
    L.push("");
    L.push("COLUNA                          PREENCHIDAS        AMOSTRA");
    L.push("──────────────────────────────────────────────────────────────────────");

    var ordenadas = r.colunas.slice().sort(function (a, b) {
      if (a.preenchidas !== b.preenchidas) return a.preenchidas - b.preenchidas;
      return a.posicao - b.posicao;
    });
    ordenadas.forEach(function (c) {
      var nome = (c.posicao + ". " + c.nome);
      while (nome.length < 32) nome += " ";
      var cont = (c.preenchidas + "/" + r.total + " (" + c.percentual + "%)");
      while (cont.length < 19) cont += " ";
      L.push(nome + cont + (c.amostra.join(" · ") || "— vazia —"));
    });

    if (r.duplicidade) {
      var d = r.duplicidade;
      L.push("");
      L.push("═══ DUPLICIDADE: \"" + d.colunaNome + "\" × \"" + d.colunaRazao + "\" ═══");
      L.push("  iguais ................. " + d.iguais);
      L.push("  DIFERENTES ............. " + d.diferentes + "   <<< são estas que precisam de decisão");
      L.push("  só em RAZAO_SOCIAL ..... " + d.soEmRazaoSocial);
      if (d.exemplos.length) {
        L.push("  exemplos:");
        d.exemplos.forEach(function (e) {
          L.push("    linha " + e.linha);
          L.push("      col.2  = " + e.coluna2);
          L.push("      RAZAO  = " + e.razaoSocial);
        });
      }
    }
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("escolaImprimirDiagnostico_ falhou: " + e + " | dados: " + JSON.stringify(r).slice(0, 500));
  }
}

/* =============================================================== */
/* VALIDADOR LINHA A LINHA — só leitura                            */
/* =============================================================== */
/*
 * Confere, célula a célula, se o conteúdo tem a cara do que a coluna promete.
 *
 * POR QUE ESTA FUNÇÃO EXISTE
 *
 * O diagnóstico de colunas (escolaDiagnosticoColunas) mostrou que a aba tem
 * dado fora de lugar: telefone dentro de RAZAO_SOCIAL, e-mail dentro de UF,
 * data dentro de SITUACAO_CADASTRAL, CEP dentro de STATUS_SINCRO. Não é um
 * deslocamento uniforme — cada faixa de linhas quebrou de um jeito.
 *
 * Enquanto o padrão de quebra não estiver mapeado, QUALQUER correção em massa
 * é chute. E chute em 679 linhas de cadastro institucional não tem volta:
 * trocar o nome de uma escola por um telefone é irreversível sem backup, e
 * ninguém percebe até um ofício sair com o nome errado.
 *
 * Foi o que quase aconteceu: a decisão de "sempre razão social" faria a
 * consolidação usar a coluna 15 como fonte — que não tem razão social em
 * nenhuma das linhas divergentes.
 *
 * O QUE ELA FAZ
 *
 * Para cada célula, deduz o TIPO APARENTE do conteúdo (data, e-mail, telefone,
 * CEP, CNPJ, CNAE, UF, situação, número, texto) e compara com o tipo que a
 * coluna espera. Depois agrupa as linhas por "assinatura de quebra" — o
 * conjunto de colunas erradas — porque linhas que quebraram juntas quebraram
 * pelo mesmo motivo, e é isso que permite corrigir por padrão em vez de uma a
 * uma.
 *
 * NÃO ESCREVE NADA.
 */

/** Tipos que a coluna espera. Coluna fora desta lista não é avaliada. */
var ESC_TIPO_ESPERADO = {
  "CNPJ": "CNPJ",
  "E-mail (principal)": "EMAIL",
  "E-mails (todos)": "EMAIL",
  "EMAIL_EXTERNO": "EMAIL",
  "Telefone 1": "TELEFONE",
  "Telefone 2": "TELEFONE",
  "UF": "UF",
  "CEP": "CEP",
  "CNAE_PRINCIPAL": "CNAE",
  "SITUACAO_CADASTRAL": "SITUACAO",
  "ULTIMA_VERIFICACAO": "DATA",
  "ULTIMA_VISITA": "DATA",
  "PROXIMA_VISITA": "DATA",
  "Escola (Razão Social)": "TEXTO_NOME",
  "RAZAO_SOCIAL": "TEXTO_NOME",
  "NOME_FANTASIA": "TEXTO_NOME",
  "Cidade": "TEXTO_NOME",
  "EscolaID": "ESCOLAID"
};

var ESC_UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
               "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
var ESC_SITUACOES = ["ATIVA","INATIVA","PENDENTE","BAIXADA","INAPTA","SUSPENSA","NULA"];

/** Deduz o que o conteúdo PARECE ser, independente de onde está. */
function escolaTipoAparente_(v) {
  if (v instanceof Date) return "DATA";
  var t = String(v == null ? "" : v).trim();
  if (!t) return "VAZIO";
  if (/^ESC-\d+$/i.test(t)) return "ESCOLAID";
  if (t.indexOf("@") > -1) return "EMAIL";

  var d = t.replace(/\D/g, "");
  // Telefone antes de CEP: "(27) 3256-6107" tem 10 dígitos, CEP tem 8.
  if (/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(t)) return "TELEFONE";
  if (d.length === 14 && /[.\/-]/.test(t)) return "CNPJ";
  if (d.length === 14) return "CNPJ";
  /* CPF — escola de pessoa física.
   *
   * O validador acusava esses três como TEXTO dentro da coluna CNPJ, e eu
   * cheguei a reportá-los ao usuário como problema. Não são: ele confirmou que
   * "tem alguns colaboradores que pagam pelo CPF e não CNPJ", e o cadastro já
   * foi corrigido para aceitar. Faltava o validador saber disso.
   *
   * Exige dígito verificador válido de propósito: sem isso, qualquer sequência
   * de 11 dígitos — inclusive celular escrito sem pontuação — viraria "CPF" e
   * o validador deixaria de acusar telefone fora do lugar. A checagem de
   * TELEFONE vem antes, e esta fecha o resto. */
  if (d.length === 11 && typeof validarDigitosCpf_ === "function" && validarDigitosCpf_(d)) return "CPF";
  // CEP aparece em três grafias na base: 29190062, 29190-062 e 29.190-062.
  // A terceira me escapou na primeira versão e o teste pegou — ela cairia em
  // TEXTO, e uma coluna de CEP cheia de "TEXTO" seria acusada de troca sem ter
  // troca nenhuma. Falso positivo em validador é pior que falha: manda corrigir
  // o que está certo.
  if (d.length === 8 && /^[\d.\s-]+$/.test(t)) return "CEP";
  if (/^\d{7}$/.test(d) && d === t.replace(/\D/g, "") && t.length <= 9) return "CNAE";
  if (/^[A-Za-z]{2}$/.test(t) && ESC_UFS.indexOf(t.toUpperCase()) > -1) return "UF";
  if (ESC_SITUACOES.indexOf(t.toUpperCase()) > -1) return "SITUACAO";
  if (/^\d+$/.test(t)) return "NUMERO";
  return "TEXTO";
}

/** O tipo aparente serve para a coluna? */
function escolaTipoServe_(esperado, aparente) {
  if (aparente === "VAZIO") return true;          // vazio é falta, não erro de lugar
  if (esperado === aparente) return true;
  switch (esperado) {
    // Nome aceita texto comum e número solto (escola com nome numérico existe).
    case "TEXTO_NOME": return aparente === "TEXTO" || aparente === "NUMERO";
    // Cidade às vezes vem "Alegre - ES"; continua texto.
    case "CNAE":       return aparente === "NUMERO";
    case "CEP":        return aparente === "NUMERO";
    case "TELEFONE":   return aparente === "NUMERO";
    // A coluna se chama CNPJ mas guarda o DOCUMENTO da escola, que pode ser
    // CPF quando ela é de pessoa física. Ver escolaAnalisarDocumento_.
    case "CNPJ":       return aparente === "CPF";
    case "SITUACAO":   return false;              // catálogo fechado, sem tolerância
    case "UF":         return false;
    case "DATA":       return false;
    case "EMAIL":      return false;
    case "ESCOLAID":   return false;
    default:           return true;
  }
}

function escolaValidarColunas(tokenSessao) {
  if (String(tokenSessao || "").trim()) {
    exigirModulo_(tokenSessao, "escolas", true);
  } else {
    var email = "";
    try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
    var dono = "";
    try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
    if (!email) throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
    if (email !== dono && !escolaEhAdministradorPorEmail_(email)) {
      throw new Error("Ação permitida somente para administradores.");
    }
  }

  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: true, total: 0, mensagem: "Nenhuma escola na base." };

    var tudo = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    var total = ultimaLinha - 1;

    // Só as colunas que sabemos avaliar.
    var avaliadas = [];
    cab.forEach(function (nome, i) {
      if (ESC_TIPO_ESPERADO[nome]) avaliadas.push({ i: i, nome: nome, esperado: ESC_TIPO_ESPERADO[nome] });
    });

    var porColuna = {};
    avaliadas.forEach(function (c) {
      porColuna[c.nome] = { nome: c.nome, posicao: c.i + 1, esperado: c.esperado,
                            ok: 0, vazias: 0, trocadas: 0, tiposEncontrados: {}, exemplos: [] };
    });

    var assinaturas = {};
    var linhasSadias = 0;

    for (var l = 1; l < tudo.length; l++) {
      var erradasDaLinha = [];
      for (var k = 0; k < avaliadas.length; k++) {
        var c = avaliadas[k];
        var valor = tudo[l][c.i];
        var aparente = escolaTipoAparente_(valor);
        var reg = porColuna[c.nome];

        if (aparente === "VAZIO") { reg.vazias++; continue; }
        if (escolaTipoServe_(c.esperado, aparente)) { reg.ok++; continue; }

        reg.trocadas++;
        reg.tiposEncontrados[aparente] = (reg.tiposEncontrados[aparente] || 0) + 1;
        if (reg.exemplos.length < 3) {
          var amostra = (valor instanceof Date)
            ? Utilities.formatDate(valor, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
            : String(valor).slice(0, 35);
          reg.exemplos.push({ linha: l + 1, valor: amostra, pareceSer: aparente });
        }
        erradasDaLinha.push(c.nome + "→" + aparente);
      }

      if (!erradasDaLinha.length) { linhasSadias++; continue; }
      var chave = erradasDaLinha.join(" | ");
      if (!assinaturas[chave]) assinaturas[chave] = { padrao: chave, linhas: 0, exemplosLinha: [] };
      assinaturas[chave].linhas++;
      if (assinaturas[chave].exemplosLinha.length < 5) assinaturas[chave].exemplosLinha.push(l + 1);
    }

    var listaAssin = Object.keys(assinaturas).map(function (k) { return assinaturas[k]; })
      .sort(function (a, b) { return b.linhas - a.linhas; });

    var resultado = {
      ok: true, total: total, linhasSadias: linhasSadias,
      linhasComProblema: total - linhasSadias,
      colunas: avaliadas.map(function (c) { return porColuna[c.nome]; }),
      padroes: listaAssin
    };
    escolaImprimirValidacao_(resultado);
    return resultado;
  } catch (e) {
    Logger.log("Erro na validação: " + e.message);
    return { ok: false, mensagem: "Erro na validação: " + e.message };
  }
}

function escolaImprimirValidacao_(r) {
  try {
    var L = [];
    L.push("═══ VALIDAÇÃO DA ABA ESCOLAS ═══");
    L.push(r.total + " escolas");
    L.push("  linhas 100% coerentes ....... " + r.linhasSadias);
    L.push("  linhas com dado fora do lugar " + r.linhasComProblema);
    L.push("");
    L.push("POR COLUNA");
    L.push("─────────────────────────────────────────────────────────────────");
    r.colunas.forEach(function (c) {
      var nome = c.posicao + ". " + c.nome;
      while (nome.length < 30) nome += " ";
      var tipos = Object.keys(c.tiposEncontrados).map(function (t) {
        return t + "(" + c.tiposEncontrados[t] + ")";
      }).join(" ");
      L.push(nome + "espera " + c.esperado);
      L.push("    ok " + c.ok + " · vazias " + c.vazias + " · TROCADAS " + c.trocadas +
             (tipos ? "  → tem: " + tipos : ""));
      c.exemplos.forEach(function (e) {
        L.push("      linha " + e.linha + ": " + e.valor + "   (parece " + e.pareceSer + ")");
      });
    });

    L.push("");
    L.push("═══ PADRÕES DE QUEBRA ═══");
    L.push("Linhas que quebraram igual, quebraram pelo mesmo motivo.");
    L.push("É por padrão que a correção se faz — nunca linha a linha.");
    L.push("");
    r.padroes.slice(0, 12).forEach(function (p, n) {
      L.push((n + 1) + ") " + p.linhas + " linha(s)   ex.: " + p.exemplosLinha.join(", "));
      L.push("    " + p.padrao.slice(0, 220));
    });
    if (r.padroes.length > 12) L.push("... e mais " + (r.padroes.length - 12) + " padrão(ões) menor(es).");
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("escolaImprimirValidacao_ falhou: " + e);
  }
}

/* =============================================================== */
/* COMPARAÇÃO DOS DESLOCADOS — só leitura                          */
/* =============================================================== */
/*
 * Para cada dado que está na coluna errada, pergunta: ele já existe, igual, na
 * coluna certa?
 *
 * É a pergunta que decide a correção inteira. Três respostas possíveis, e cada
 * uma pede um tratamento diferente:
 *
 *   CÓPIA        o valor deslocado é idêntico ao que já está no lugar certo.
 *                Nada se perde apagando. É limpeza.
 *   RECUPERAVEL  a coluna certa está VAZIA e a errada tem conteúdo. Esse dado
 *                só existe ali. Apagar seria perder — tem que MOVER.
 *   DIVERGENTE   as duas têm conteúdo e são diferentes. Ninguém pode escolher
 *                por dedução qual é o certo: vai para Pendências, para alguém
 *                decidir com o cadastro na mão.
 *
 * Sem esta medição, a correção seria um chute entre "apagar" e "mover" — e o
 * chute errado em 642 linhas ou perde telefone de escola, ou deixa lixo que
 * volta a confundir na próxima leitura.
 *
 * NÃO ESCREVE NADA.
 */

/*
 * Onde cada dado deslocado mora de verdade.
 *
 * Deduzido do padrão medido em 11/08/2026: uma rotina antiga gravou o bloco de
 * contato e sincronização na ordem DELA, não na ordem do cabeçalho. Lido em
 * sequência a partir da coluna 13, o que ela escreveu foi:
 *   status · telefone1 · telefone2 · email · emails · … · situação · … · data
 */
var ESC_DESLOCADOS = [
  { origem: "ULTIMA_VERIFICACAO", destino: "Telefone 1",         tipo: "TELEFONE",
    nota: "coluna de data contém telefone" },
  { origem: "RAZAO_SOCIAL",       destino: "Telefone 2",         tipo: "TELEFONE",
    nota: "coluna de razão social contém telefone" },
  { origem: "NOME_FANTASIA",      destino: "E-mail (principal)", tipo: "EMAIL",
    nota: "coluna de nome fantasia contém e-mail" },
  { origem: "CNAE_PRINCIPAL",     destino: "SITUACAO_CADASTRAL", tipo: "SITUACAO",
    nota: "a situação real está na coluna de CNAE" },
  { origem: "SITUACAO_CADASTRAL", destino: "ULTIMA_VERIFICACAO", tipo: "DATA",
    nota: "a data de verificação está na coluna de situação" }
];

/** Compara dois valores pelo que eles SÃO, não pelo texto cru. */
function escolaMesmoValor_(a, b, tipo) {
  if (a instanceof Date || b instanceof Date) {
    if (!(a instanceof Date) || !(b instanceof Date)) return false;
    return a.getTime() === b.getTime();
  }
  var x = String(a == null ? "" : a).trim();
  var y = String(b == null ? "" : b).trim();
  if (!x || !y) return false;
  switch (tipo) {
    // "(27) 3256-6107" e "2732566107" são o mesmo telefone.
    case "TELEFONE": return x.replace(/\D/g, "") === y.replace(/\D/g, "");
    // Maiúscula e espaço não fazem e-mail diferente.
    case "EMAIL":    return x.toLowerCase().replace(/\s/g, "") === y.toLowerCase().replace(/\s/g, "");
    default:         return x.toUpperCase() === y.toUpperCase();
  }
}

function escolaCompararDeslocados(tokenSessao) {
  if (String(tokenSessao || "").trim()) {
    exigirModulo_(tokenSessao, "escolas", true);
  } else {
    var email = "";
    try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
    var dono = "";
    try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
    if (!email) throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
    if (email !== dono && !escolaEhAdministradorPorEmail_(email)) {
      throw new Error("Ação permitida somente para administradores.");
    }
  }

  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: true, total: 0, mensagem: "Nenhuma escola na base." };

    var tudo = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    var total = ultimaLinha - 1;

    var pares = ESC_DESLOCADOS.map(function (d) {
      return {
        origem: d.origem, destino: d.destino, tipo: d.tipo, nota: d.nota,
        iOrigem: cab.indexOf(d.origem), iDestino: cab.indexOf(d.destino),
        copia: 0, recuperavel: 0, divergente: 0, semNada: 0,
        exemplosDivergente: [], exemplosRecuperavel: []
      };
    }).filter(function (p) { return p.iOrigem > -1 && p.iDestino > -1; });

    for (var l = 1; l < tudo.length; l++) {
      for (var k = 0; k < pares.length; k++) {
        var p = pares[k];
        var vOrigem  = tudo[l][p.iOrigem];
        var vDestino = tudo[l][p.iDestino];

        // Só interessa o que está DESLOCADO: valor na origem cujo tipo aparente
        // é o do destino. Valor legítimo na própria coluna não entra na conta.
        var aparente = escolaTipoAparente_(vOrigem);
        if (aparente === "VAZIO" || aparente !== p.tipo) { p.semNada++; continue; }

        var destinoVazio = escolaTipoAparente_(vDestino) === "VAZIO";
        if (destinoVazio) {
          p.recuperavel++;
          if (p.exemplosRecuperavel.length < 3) {
            p.exemplosRecuperavel.push({ linha: l + 1, valor: escolaTexto_(vOrigem) });
          }
          continue;
        }
        if (escolaMesmoValor_(vOrigem, vDestino, p.tipo)) { p.copia++; continue; }

        p.divergente++;
        if (p.exemplosDivergente.length < 5) {
          p.exemplosDivergente.push({
            linha: l + 1,
            naColunaErrada: escolaTexto_(vOrigem),
            naColunaCerta:  escolaTexto_(vDestino)
          });
        }
      }
    }

    var resultado = { ok: true, total: total, pares: pares };
    escolaImprimirComparacao_(resultado);
    return resultado;
  } catch (e) {
    Logger.log("Erro na comparação: " + e.message);
    return { ok: false, mensagem: "Erro na comparação: " + e.message };
  }
}

function escolaTexto_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  return String(v == null ? "" : v).trim().slice(0, 40);
}

function escolaImprimirComparacao_(r) {
  try {
    var L = [];
    L.push("═══ DESLOCADOS: o dado já existe no lugar certo? ═══");
    L.push(r.total + " escolas");
    L.push("");
    L.push("CÓPIA        idêntico ao que já está no lugar certo → apagar não perde nada");
    L.push("RECUPERÁVEL  a coluna certa está VAZIA → tem que MOVER, senão perde");
    L.push("DIVERGENTE   as duas têm conteúdo e diferem → ninguém decide por dedução");
    L.push("");

    var totalMover = 0, totalDecidir = 0;
    r.pares.forEach(function (p) {
      L.push("─────────────────────────────────────────────────────────────");
      L.push(p.origem + "  →  " + p.destino + "   (" + p.nota + ")");
      L.push("   cópia ......... " + p.copia);
      L.push("   RECUPERÁVEL ... " + p.recuperavel);
      L.push("   DIVERGENTE .... " + p.divergente);
      totalMover += p.recuperavel;
      totalDecidir += p.divergente;
      if (p.exemplosRecuperavel.length) {
        L.push("   exemplos a mover:");
        p.exemplosRecuperavel.forEach(function (e) {
          L.push("     linha " + e.linha + ": " + e.valor);
        });
      }
      if (p.exemplosDivergente.length) {
        L.push("   exemplos que DIVERGEM (vão para Pendências):");
        p.exemplosDivergente.forEach(function (e) {
          L.push("     linha " + e.linha);
          L.push("       na coluna errada: " + e.naColunaErrada);
          L.push("       na coluna certa : " + e.naColunaCerta);
        });
      }
    });

    L.push("");
    L.push("═══ RESUMO PARA A MIGRAÇÃO ═══");
    L.push("  mover (dado que só existe no lugar errado) ... " + totalMover);
    L.push("  decidir a mão (divergentes) .................. " + totalDecidir);
    L.push("  o resto é cópia — limpeza pura.");
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("escolaImprimirComparacao_ falhou: " + e);
  }
}

/* =============================================================== */
/* SANEAMENTO: separar o dado da Receita do dado operacional        */
/* =============================================================== */
/*
 * O QUE ESTA MIGRAÇÃO ARRUMA
 *
 * As colunas 13–23 da aba Escolas não são cópia deslocada do cadastro: são um
 * SEGUNDO conjunto de dados, vindo da consulta à Receita, gravado em colunas
 * com o rótulo errado. A comparação de 11/08/2026 provou isso — os "iguais"
 * eram raríssimos e os "divergentes" eram sistematicamente dados DIFERENTES,
 * não variações de formato:
 *
 *   NOME_FANTASIA contém "contato@x.com.br; fiscal@y" enquanto
 *   E-mail (principal) contém "servicaped@gmail.com"     → e-mails distintos
 *
 * POR QUE NÃO É SÓ RENOMEAR CABEÇALHO
 *
 * Renomear seria a correção mais barata, e foi minha primeira ideia. Não
 * serve para duas dessas colunas:
 *
 *   NOME_FANTASIA é COL_FANTASIA — o cadastro escreve nela. Renomear faria
 *   todo campo "nome fantasia" da tela cair no vazio, em silêncio, porque
 *   setIfColEscola_ só loga quando não acha a coluna.
 *
 *   E as colunas são MISTAS: ULTIMA_VERIFICACAO tem 381 datas legítimas e 268
 *   telefones. Renomear a coluna inteira resolveria metade e estragaria a
 *   outra.
 *
 * A REGRA, ENTÃO, É UMA SÓ: cada valor vai para a coluna do TIPO dele.
 * O que está no tipo certo fica onde está. O que não está, muda de coluna —
 * nunca é apagado.
 *
 * GARANTIAS
 *   - backup da aba inteira antes de escrever;
 *   - nada é apagado: todo valor movido chega ao destino antes de sair da
 *     origem, e valor que já existe no destino é preservado ao lado (" | ");
 *   - idempotente por construção: depois da primeira passada não sobra valor
 *     de tipo errado, então a segunda move zero;
 *   - sob lock, e registrada na trilha.
 */

/* Cada regra: "nesta coluna, valor deste tipo não pertence — mande para lá". */
var ESC_SANEAMENTO = [
  { origem: "ULTIMA_VERIFICACAO", tipoErrado: "TELEFONE", destino: "TELEFONE_RECEITA" },
  { origem: "RAZAO_SOCIAL",       tipoErrado: "TELEFONE", destino: "TELEFONE_RECEITA" },
  { origem: "RAZAO_SOCIAL",       tipoErrado: "SITUACAO", destino: "SITUACAO_RECEITA" },
  { origem: "NOME_FANTASIA",      tipoErrado: "EMAIL",    destino: "EMAILS_RECEITA" },
  { origem: "CNAE_PRINCIPAL",     tipoErrado: "SITUACAO", destino: "SITUACAO_RECEITA" },
  { origem: "SITUACAO_CADASTRAL", tipoErrado: "DATA",     destino: "DATA_CONSULTA_RECEITA" },
  { origem: "EMAIL_EXTERNO",      tipoErrado: "DATA",     destino: "DATA_CONSULTA_RECEITA" },
  { origem: "UF",                 tipoErrado: "EMAIL",    destino: "EMAILS_RECEITA" },
  { origem: "STATUS_SINCRO",      tipoErrado: "CEP",      destino: "CEP_RECEITA" }
];

var ESC_COLUNAS_RECEITA = ["TELEFONE_RECEITA", "EMAILS_RECEITA", "SITUACAO_RECEITA",
                           "DATA_CONSULTA_RECEITA", "CEP_RECEITA"];

/**
 * Junta dois valores sem perder nenhum.
 * Usado quando o destino já tem conteúdo: escola pode ter mais de um telefone
 * e mais de um e-mail, e escolher um deles seria decidir por dedução.
 */
function escolaJuntarValores_(atual, novo) {
  var a = String(atual == null ? "" : atual).trim();
  var n = String(novo == null ? "" : novo).trim();
  if (!a) return n;
  if (!n) return a;
  // Não duplica o que já está lá.
  var partes = a.split(/\s*\|\s*/);
  for (var i = 0; i < partes.length; i++) {
    if (partes[i].replace(/\D/g, "") && partes[i].replace(/\D/g, "") === n.replace(/\D/g, "")) return a;
    if (partes[i].toLowerCase() === n.toLowerCase()) return a;
  }
  return a + " | " + n;
}

/* ─── O par de duas etapas, para rodar pelo editor ─────────────── */

var ESC_PROP_CONSENTIMENTO = "SISGEP_ESCOLAS_SANEAR_OK";
var ESC_CONSENTIMENTO_MINUTOS = 15;

/* A chave separa as operações: preparar o saneamento NÃO pode autorizar a
 * padronização, e vice-versa. Sem isso, uma prévia liberaria a outra
 * migração — que o usuário nunca viu. */
function escolaConsentimentoValido_(chave) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(ESC_PROP_CONSENTIMENTO + (chave || ""));
    if (!v) return false;
    var quando = parseInt(v, 10);
    if (!quando) return false;
    return (new Date().getTime() - quando) <= ESC_CONSENTIMENTO_MINUTOS * 60 * 1000;
  } catch (e) { return false; }
}

function escolaConsumirConsentimento_(chave) {
  try { PropertiesService.getScriptProperties().deleteProperty(ESC_PROP_CONSENTIMENTO + (chave || "")); } catch (e) {}
}

function escolaLiberarConsentimento_(chave) {
  PropertiesService.getScriptProperties()
    .setProperty(ESC_PROP_CONSENTIMENTO + (chave || ""), String(new Date().getTime()));
}

/**
 * PASSO 1 — mostra o que vai mudar e libera a aplicação por 15 minutos.
 * Não escreve nada na aba Escolas.
 */
function escolaSanearPreparar() {
  /* A prévia roda O MESMO CÓDIGO da aplicação, em modo simulação.
   *
   * A primeira versão chamava escolaCompararDeslocados() — que responde outra
   * pergunta. Ela dizia "ULTIMA_VERIFICACAO → Telefone 1", enquanto o
   * saneamento move para TELEFONE_RECEITA, coluna nova. O usuário aprovaria
   * uma coisa e aconteceria outra.
   *
   * Consentimento em cima de relatório que descreve outra operação não vale
   * nada. Compartilhar o código é o que garante que a prévia não possa
   * divergir da aplicação nem hoje nem depois de qualquer manutenção. */
  var r = escolaSanearReceita("", "", true);   // true = simular
  if (r && r.ok === false) return r;
  try {
    escolaLiberarConsentimento_("SANEAR");
  } catch (e) {
    Logger.log("Não consegui registrar o consentimento: " + e);
    return { ok: false, mensagem: "Falha ao liberar a aplicação: " + e.message };
  }
  Logger.log("\n═══════════════════════════════════════════════\n" +
             "PRÉVIA ACIMA. Nada foi alterado ainda.\n" +
             "Se concorda, rode  escolaSanearAplicar  nos próximos " +
             ESC_CONSENTIMENTO_MINUTOS + " minutos.\n" +
             "═══════════════════════════════════════════════");
  return { ok: true, preparado: true, validoPorMinutos: ESC_CONSENTIMENTO_MINUTOS };
}

/**
 * PASSO 2 — aplica. Só funciona depois de escolaSanearPreparar.
 * NÃO passa confirmação: a trava do caminho do editor é o consentimento, e
 * mandar a palavra aqui pularia justamente a checagem que este par existe
 * para fazer.
 */
function escolaSanearAplicar() {
  return escolaSanearReceita("", "");
}

function escolaSanearReceita(tokenSessao, confirmacao, simular) {
  simular = (simular === true);
  var quem;
  if (String(tokenSessao || "").trim()) {
    var s = exigirModulo_(tokenSessao, "escolas", true);
    quem = String((s && (s.nome || s.usuario || s.email)) || "").trim() || "—";
  } else {
    var email = "";
    try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
    var dono = "";
    try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
    if (!email) throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
    if (email !== dono && !escolaEhAdministradorPorEmail_(email)) {
      throw new Error("Ação permitida somente para administradores.");
    }
    quem = email;
  }

  /* TRAVA DE MÃO — duas etapas deliberadas.
   *
   * A primeira versão exigia a palavra "SANEAR" como argumento. Não funciona:
   * o botão Executar do editor do Apps Script chama a função SEM ARGUMENTOS.
   * Na prática a migração ficava impossível de rodar pelo único caminho que
   * existe hoje — e recusava em silêncio, porque eu também não loguei a
   * recusa. O usuário viu "Execução concluída" e nada mais.
   *
   * A trava agora é de estado, não de argumento: só aplica quem acabou de
   * rodar a PRÉVIA. Vale mais que a palavra digitada, porque obriga a olhar
   * antes de escrever — e funciona com execução sem argumento.
   *
   * O consentimento vale 15 minutos e é de uso único: aplicar consome. Rodar
   * duas vezes seguidas exige preparar duas vezes. */
  /* Cada porta tem a SUA trava, e nenhuma abre a outra.
   *
   * A primeira versão aceitava "ou a palavra, ou o consentimento". Como
   * escolaSanearAplicar passava a palavra, ela pulava o consentimento — e a
   * trava de duas etapas virava decoração. O teste do uso único pegou: dava
   * para aplicar duas vezes preparando uma só.
   *
   * pela TELA (com token)  → confirmação explícita, que a tela manda depois
   *                          do seu próprio "tem certeza?";
   * pelo EDITOR (sem token) → prévia recente, porque no editor não há diálogo
   *                          de confirmação nenhum: executar é um clique. */
  // Simulação não escreve: não precisa de trava, e exigir uma impediria a
  // própria prévia de rodar.
  if (simular) {
    /* segue direto */
  } else if (String(tokenSessao || "").trim()) {
    if (String(confirmacao || "").trim().toUpperCase() !== "SANEAR") {
      var recusaTela = { ok: false, mensagem: 'Confirmação obrigatória para sanear a base.' };
      Logger.log(recusaTela.mensagem);
      return recusaTela;
    }
  } else {
    if (!escolaConsentimentoValido_("SANEAR")) {
      var recusa = {
        ok: false,
        mensagem: "Saneamento NÃO executado — falta a prévia.\n\n" +
                  "1) rode  escolaSanearPreparar   (mostra o que vai mudar, não escreve nada)\n" +
                  "2) rode  escolaSanearAplicar    (dentro de 15 minutos)"
      };
      Logger.log(recusa.mensagem);
      return recusa;
    }
    escolaConsumirConsentimento_("SANEAR");
  }

  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    travou = lock.tryLock(30000);
    if (!travou) return { ok: false, mensagem: "Outra operação de Escolas está em andamento." };

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: true, movidos: 0, mensagem: "Nenhuma escola na base." };

    var antes = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    // Backup ANTES de qualquer escrita. Simulação não cria aba nenhuma.
    var nomeBackup = "";
    if (!simular) {
      nomeBackup = escolaNomeBackupLivre_(ss, "BACKUP_ESCOLAS_SANEAMENTO_");
      var shBackup = ss.insertSheet(nomeBackup);
      shBackup.getRange(1, 1, antes.length, antes[0].length).setValues(antes);
      shBackup.getRange(1, 1, 1, antes[0].length).setFontWeight("bold");
      shBackup.setFrozenRows(1);
    }

    // Colunas de destino, criadas no fim para não deslocar nada.
    var cab = antes[0].map(function (c) { return String(c || "").trim(); });
    var colunasNovas = [];
    ESC_COLUNAS_RECEITA.forEach(function (nome) {
      if (cab.indexOf(nome) === -1) { cab.push(nome); colunasNovas.push(nome); }
    });

    // Matriz de trabalho, já com as colunas novas.
    var dados = antes.map(function (linha, i) {
      var l = linha.slice();
      while (l.length < cab.length) l.push("");
      if (i === 0) return cab.slice();
      return l;
    });

    function idx(nome) { return cab.indexOf(nome); }
    var regras = ESC_SANEAMENTO
      .map(function (r) { return { origem: idx(r.origem), destino: idx(r.destino), tipo: r.tipoErrado,
                                   nomeOrigem: r.origem, nomeDestino: r.destino, movidos: 0 }; })
      .filter(function (r) { return r.origem > -1 && r.destino > -1; });

    var totalMovidos = 0;
    for (var l = 1; l < dados.length; l++) {
      for (var k = 0; k < regras.length; k++) {
        var r = regras[k];
        var v = dados[l][r.origem];
        if (escolaTipoAparente_(v) !== r.tipo) continue;
        // O valor já está em `v`, uma cópia local — a ordem entre gravar e
        // limpar não muda nada. O que garante que nada se perde é outra coisa:
        // toda a movimentação acontece na matriz em memória, e a planilha só é
        // escrita no fim, de uma vez. Se algo explodir no meio, a planilha
        // continua exatamente como estava.
        dados[l][r.destino] = (r.tipo === "DATA" && !String(dados[l][r.destino] || "").trim())
          ? v
          : escolaJuntarValores_(dados[l][r.destino], escolaTexto_(v));
        dados[l][r.origem] = "";
        r.movidos++;
        totalMovidos++;
      }
    }

    // A situação operacional volta para a coluna dela, onde ficou vazia.
    var iSit = idx(COL_SITUACAO), iSitRec = idx("SITUACAO_RECEITA");
    var situacoesRestauradas = 0;
    if (iSit > -1 && iSitRec > -1) {
      for (var m = 1; m < dados.length; m++) {
        if (String(dados[m][iSit] || "").trim()) continue;
        var sr = String(dados[m][iSitRec] || "").trim();
        if (!sr) continue;
        dados[m][iSit] = sr.toUpperCase();
        situacoesRestauradas++;
      }
    }

    if (!simular) {
      sh.getRange(1, 1, dados.length, cab.length).setValues(dados);
      sh.getRange(1, 1, 1, cab.length).setFontWeight("bold");
      SpreadsheetApp.flush();
      invalidarCacheEscolasInterno_();
    }

    if (!simular) escolaAuditar_("SANEAR_BASE", "", "",
      "Saneamento da base de Escolas: " + totalMovidos + " valor(es) movidos para as colunas da Receita, " +
      situacoesRestauradas + " situação(ões) restaurada(s). Backup: " + nomeBackup + ".", quem);

    var resultado = {
      ok: true, simulacao: simular,
      movidos: totalMovidos, situacoesRestauradas: situacoesRestauradas,
      colunasCriadas: colunasNovas, backup: nomeBackup,
      porRegra: regras.map(function (r) {
        return { de: r.nomeOrigem, para: r.nomeDestino, tipo: r.tipo, movidos: r.movidos };
      })
    };
    escolaImprimirSaneamento_(resultado);
    return resultado;
  } catch (e) {
    Logger.log("Erro no saneamento: " + e.message);
    return { ok: false, mensagem: "Erro no saneamento: " + e.message };
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (e3) {} }
  }
}

function escolaImprimirSaneamento_(r) {
  try {
    var L = [];
    L.push(r.simulacao ? "═══ PRÉVIA DO SANEAMENTO (nada foi alterado) ═══"
                       : "═══ SANEAMENTO DA BASE DE ESCOLAS ═══");
    if (r.backup) L.push("backup: " + r.backup);
    if (r.colunasCriadas.length) {
      L.push((r.simulacao ? "colunas que serão criadas: " : "colunas criadas: ") + r.colunasCriadas.join(", "));
    }
    L.push("");
    r.porRegra.forEach(function (x) {
      if (!x.movidos) return;
      L.push("  " + x.movidos + " × " + x.tipo + "   " + x.de + " → " + x.para);
    });
    L.push("");
    L.push((r.simulacao ? "  total A MOVER ............... " : "  total movido ................ ") + r.movidos);
    L.push((r.simulacao ? "  situações A RESTAURAR ....... " : "  situações restauradas ....... ") + r.situacoesRestauradas);
    L.push("");
    if (r.simulacao) {
      L.push("Nada foi alterado. Este é exatamente o que escolaSanearAplicar fará.");
    } else {
      L.push("Nada foi apagado: todo valor movido está na coluna de destino.");
      L.push("Para desfazer, a aba " + r.backup + " tem a base como estava.");
    }
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("escolaImprimirSaneamento_ falhou: " + e);
  }
}

/* =============================================================== */
/* ETAPA C — PADRONIZAR FORMATO                                     */
/* =============================================================== */
/*
 * Um mesmo dado escrito de cinco jeitos é cinco dados diferentes para quem
 * filtra, agrupa ou compara. A base tem telefone como "(028) 73521-8042",
 * "2732566107" e "(61) 9210-5761"; CEP como "29190062" e "29.190-062";
 * e-mails separados ora por ";" ora por ",".
 *
 * E o caso que mais rende: UF está VAZIA em 649 das 679 linhas — mas
 * `Cidade` guarda "Alegre - ES". A UF sempre esteve lá, grudada. Dá para
 * preencher as 649 sem consultar nada.
 *
 * DECISÃO DO USUÁRIO (11/08/2026), opção A: a cidade fica só com o nome.
 * "Alegre - ES" vira Cidade="Alegre" + UF="ES". Cada dado no seu campo — é
 * para isso que a coluna UF existe. Manter a UF nos dois lugares seria a
 * mesma duplicidade que o item 8 do PROMPT-MESTRE manda evitar: dois lugares
 * divergem com o tempo.
 *
 * REGRA DE OURO DESTA ETAPA: na dúvida, não mexe. Valor que não casa com o
 * padrão fica exatamente como está e vai para Pendências. Padronizador que
 * "adivinha" estraga dado — "(028) 73521-8042" tem 12 dígitos e não há como
 * saber qual é o número certo.
 */

/** Telefone brasileiro: 10 ou 11 dígitos. Fora disso, devolve null. */
function escolaFormatarTelefone_(v) {
  var d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return null;   // 12 dígitos, 8 dígitos, letras — não se inventa
}

/** CEP: 8 dígitos → 29190-062. */
function escolaFormatarCep_(v) {
  var d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.length !== 8) return null;
  return d.slice(0, 5) + "-" + d.slice(5);
}

/**
 * Lista de e-mails: minúsculo, sem espaço, separador único, sem repetido.
 * Só devolve valor se TODAS as partes parecerem e-mail — uma lista com lixo
 * dentro é caso de Pendências, não de formatação.
 */
function escolaFormatarEmails_(v) {
  var t = String(v == null ? "" : v).trim();
  if (!t) return null;
  var partes = t.split(/[;,]/).map(function (x) { return x.trim().toLowerCase(); })
                .filter(function (x) { return x; });
  if (!partes.length) return null;
  for (var i = 0; i < partes.length; i++) {
    if (partes[i].indexOf("@") === -1 || /\s/.test(partes[i])) return null;
  }
  var vistos = {}, limpos = [];
  partes.forEach(function (p) { if (!vistos[p]) { vistos[p] = true; limpos.push(p); } });
  return limpos.join("; ");
}

/**
 * Separa "Alegre - ES" em { cidade: "Alegre", uf: "ES" }.
 * Devolve null quando não há sufixo de UF — "São Paulo" tem que continuar
 * "São Paulo", e não virar cidade "São Pau" com UF "LO".
 */
function escolaSepararCidadeUf_(v) {
  var t = String(v == null ? "" : v).trim();
  if (!t) return null;
  var m = t.match(/^(.+?)\s*[-–—\/]\s*([A-Za-z]{2})$/);
  if (!m) return null;
  var uf = m[2].toUpperCase();
  if (ESC_UFS.indexOf(uf) === -1) return null;      // "Rio - do Sul" não vira UF
  var cidade = m[1].trim();
  if (!cidade) return null;
  return { cidade: cidade, uf: uf };
}

var ESC_PADRONIZACAO = [
  { coluna: "Telefone 1",         fn: escolaFormatarTelefone_, rotulo: "telefone" },
  { coluna: "Telefone 2",         fn: escolaFormatarTelefone_, rotulo: "telefone" },
  { coluna: "CEP",                fn: escolaFormatarCep_,      rotulo: "CEP" },
  { coluna: "E-mail (principal)", fn: escolaFormatarEmails_,   rotulo: "e-mail" },
  { coluna: "E-mails (todos)",    fn: escolaFormatarEmails_,   rotulo: "e-mails" },
  { coluna: "EMAIL_EXTERNO",      fn: escolaFormatarEmails_,   rotulo: "e-mails" }
];

function escolaPadronizarBase(tokenSessao, confirmacao, simular) {
  simular = (simular === true);
  var quem;
  if (String(tokenSessao || "").trim()) {
    var s = exigirModulo_(tokenSessao, "escolas", true);
    quem = String((s && (s.nome || s.usuario || s.email)) || "").trim() || "—";
  } else {
    var email = "";
    try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
    var dono = "";
    try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
    if (!email) throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
    if (email !== dono && !escolaEhAdministradorPorEmail_(email)) {
      throw new Error("Ação permitida somente para administradores.");
    }
    quem = email;
  }

  // Mesma trava de duas etapas do saneamento — com chave PRÓPRIA, para que
  // preparar uma migração nunca autorize a outra.
  if (simular) {
    /* segue */
  } else if (String(tokenSessao || "").trim()) {
    if (String(confirmacao || "").trim().toUpperCase() !== "PADRONIZAR") {
      var rt = { ok: false, mensagem: "Confirmação obrigatória para padronizar a base." };
      Logger.log(rt.mensagem);
      return rt;
    }
  } else {
    if (!escolaConsentimentoValido_("PADRONIZAR")) {
      var r0 = {
        ok: false,
        mensagem: "Padronização NÃO executada — falta a prévia.\n\n" +
                  "1) rode  escolaPadronizarPreparar\n" +
                  "2) rode  escolaPadronizarAplicar   (dentro de 15 minutos)"
      };
      Logger.log(r0.mensagem);
      return r0;
    }
    escolaConsumirConsentimento_("PADRONIZAR");
  }

  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    travou = lock.tryLock(30000);
    if (!travou) return { ok: false, mensagem: "Outra operação de Escolas está em andamento." };

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: true, alterados: 0, mensagem: "Nenhuma escola na base." };

    var dados = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    var cab = dados[0].map(function (c) { return String(c || "").trim(); });
    function idx(n) { return cab.indexOf(n); }

    var nomeBackup = "";
    if (!simular) {
      nomeBackup = escolaNomeBackupLivre_(ss, "BACKUP_ESCOLAS_PADRAO_");
      var shB = ss.insertSheet(nomeBackup);
      shB.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
      shB.getRange(1, 1, 1, dados[0].length).setFontWeight("bold");
      shB.setFrozenRows(1);
    }

    var porColuna = {};
    ESC_PADRONIZACAO.forEach(function (p) {
      porColuna[p.coluna] = { coluna: p.coluna, rotulo: p.rotulo, i: idx(p.coluna),
                              alterados: 0, naoReconhecidos: 0, exemplos: [] };
    });

    var iCidade = idx("Cidade"), iUf = idx("UF");
    var ufsPreenchidas = 0, cidadesSemSufixo = 0, ufsDivergentes = 0;
    var exemplosCidade = [], exemplosDivergencia = [];
    var totalAlterados = 0;

    for (var l = 1; l < dados.length; l++) {
      // 1) formato coluna a coluna
      for (var k = 0; k < ESC_PADRONIZACAO.length; k++) {
        var p = ESC_PADRONIZACAO[k];
        var reg = porColuna[p.coluna];
        if (reg.i === -1) continue;
        var atual = dados[l][reg.i];
        if (atual instanceof Date) continue;
        var txt = String(atual == null ? "" : atual).trim();
        if (!txt) continue;
        var novo = p.fn(txt);
        if (novo === null) {
          // Não casou com o padrão: FICA COMO ESTÁ. Vai para Pendências.
          reg.naoReconhecidos++;
          if (reg.exemplos.length < 3) reg.exemplos.push({ linha: l + 1, valor: txt.slice(0, 35) });
          continue;
        }
        if (novo === txt) continue;      // já estava no padrão
        dados[l][reg.i] = novo;
        reg.alterados++;
        totalAlterados++;
      }

      // 2) separar "Alegre - ES" em Cidade + UF (decisão do usuário: opção A)
      if (iCidade > -1 && iUf > -1) {
        var sep = escolaSepararCidadeUf_(dados[l][iCidade]);
        if (!sep) {
          if (String(dados[l][iCidade] || "").trim()) cidadesSemSufixo++;
        } else {
          var ufAtual = String(dados[l][iUf] || "").trim().toUpperCase();
          if (ufAtual && ufAtual !== sep.uf) {
            // Duas fontes discordam. Não escolho por dedução — nada muda.
            ufsDivergentes++;
            if (exemplosDivergencia.length < 3) {
              exemplosDivergencia.push({ linha: l + 1, cidade: String(dados[l][iCidade]), ufColuna: ufAtual });
            }
          } else {
            if (dados[l][iCidade] !== sep.cidade) { dados[l][iCidade] = sep.cidade; totalAlterados++; }
            if (!ufAtual) { dados[l][iUf] = sep.uf; ufsPreenchidas++; totalAlterados++; }
            if (exemplosCidade.length < 3 && sep.cidade) {
              exemplosCidade.push({ linha: l + 1, cidade: sep.cidade, uf: sep.uf });
            }
          }
        }
      }
    }

    if (!simular && totalAlterados > 0) {
      sh.getRange(1, 1, dados.length, cab.length).setValues(dados);
      SpreadsheetApp.flush();
      invalidarCacheEscolasInterno_();
      escolaAuditar_("PADRONIZAR_BASE", "", "",
        "Padronização de formato: " + totalAlterados + " célula(s) ajustada(s), " +
        ufsPreenchidas + " UF(s) preenchida(s) a partir da cidade. Backup: " + nomeBackup + ".", quem);
    }

    var resultado = {
      ok: true, simulacao: simular, alterados: totalAlterados,
      ufsPreenchidas: ufsPreenchidas, cidadesSemSufixo: cidadesSemSufixo,
      ufsDivergentes: ufsDivergentes, exemplosCidade: exemplosCidade,
      exemplosDivergencia: exemplosDivergencia, backup: nomeBackup,
      colunas: ESC_PADRONIZACAO.map(function (p) { return porColuna[p.coluna]; })
    };
    escolaImprimirPadronizacao_(resultado);
    return resultado;
  } catch (e) {
    Logger.log("Erro na padronização: " + e.message);
    return { ok: false, mensagem: "Erro na padronização: " + e.message };
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (e3) {} }
  }
}

/** PASSO 1 — mostra o que vai mudar. Não escreve nada. */
function escolaPadronizarPreparar() {
  var r = escolaPadronizarBase("", "", true);
  if (r && r.ok === false) return r;
  try { escolaLiberarConsentimento_("PADRONIZAR"); }
  catch (e) { return { ok: false, mensagem: "Falha ao liberar: " + e.message }; }
  Logger.log("\n═══════════════════════════════════════════════\n" +
             "PRÉVIA ACIMA. Nada foi alterado ainda.\n" +
             "Se concorda, rode  escolaPadronizarAplicar  nos próximos " +
             ESC_CONSENTIMENTO_MINUTOS + " minutos.\n" +
             "═══════════════════════════════════════════════");
  return { ok: true, preparado: true, validoPorMinutos: ESC_CONSENTIMENTO_MINUTOS };
}

/** PASSO 2 — aplica. Só depois de escolaPadronizarPreparar. */
function escolaPadronizarAplicar() {
  return escolaPadronizarBase("", "");
}

function escolaImprimirPadronizacao_(r) {
  try {
    var L = [];
    L.push(r.simulacao ? "═══ PRÉVIA DA PADRONIZAÇÃO (nada foi alterado) ═══"
                       : "═══ PADRONIZAÇÃO DA BASE DE ESCOLAS ═══");
    if (r.backup) L.push("backup: " + r.backup);
    L.push("");
    L.push("FORMATO POR COLUNA");
    r.colunas.forEach(function (c) {
      if (c.i === -1) return;
      L.push("  " + c.coluna + "  (" + c.rotulo + ")");
      L.push("     " + (r.simulacao ? "a ajustar ....... " : "ajustados ....... ") + c.alterados);
      if (c.naoReconhecidos) {
        L.push("     NÃO reconhecidos  " + c.naoReconhecidos + "  ← ficam como estão, vão para Pendências");
        c.exemplos.forEach(function (e) { L.push("        linha " + e.linha + ": " + e.valor); });
      }
    });

    L.push("");
    L.push("CIDADE → CIDADE + UF");
    L.push("  " + (r.simulacao ? "UFs a preencher ..... " : "UFs preenchidas ..... ") + r.ufsPreenchidas);
    r.exemplosCidade.forEach(function (e) {
      L.push("     linha " + e.linha + ": Cidade=\"" + e.cidade + "\"  UF=\"" + e.uf + "\"");
    });
    if (r.cidadesSemSufixo) {
      L.push("  cidades sem sufixo de UF  " + r.cidadesSemSufixo + "  ← intocadas, de propósito");
    }
    if (r.ufsDivergentes) {
      L.push("  ⚠ UF da coluna DIVERGE da cidade  " + r.ufsDivergentes + "  ← intocadas");
      r.exemplosDivergencia.forEach(function (e) {
        L.push("     linha " + e.linha + ": cidade diz outra coisa, coluna UF diz " + e.ufColuna);
      });
    }

    L.push("");
    L.push((r.simulacao ? "  TOTAL a alterar ..... " : "  TOTAL alterado ...... ") + r.alterados + " célula(s)");
    L.push("");
    L.push(r.simulacao
      ? "Nada foi alterado. Este é exatamente o que escolaPadronizarAplicar fará."
      : "Para desfazer, a aba " + r.backup + " tem a base como estava.");
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("escolaImprimirPadronizacao_ falhou: " + e);
  }
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
