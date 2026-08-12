// ============================================================================
// ARQUIVO: VoucherReparoColunas.gs
// REPARO DO CABEÇALHO DESALINHADO DE Voucher_Solicitacoes — 12/08/2026
//
// O QUE ACONTECEU
//
// O `ensureHeaders_` antigo (Voucher.gs) escrevia o nome de uma coluna que
// faltava NA POSIÇÃO QUE ELA OCUPA NA LISTA CANÔNICA, por cima do nome que já
// estava ali. O dado embaixo não se move. Resultado: `mapRowToObject_`, que
// resolve por nome, passa a devolver o valor de uma coluna sob o nome de
// outra — e a data de nascimento de um beneficiário sai impressa num
// certificado como "Instituição de ensino".
//
// O `ensureHeaders_` já foi corrigido: coluna nova entra no fim, nenhuma
// existente é tocada. Este arquivo trata do que ficou torto ANTES disso.
//
// COMO O MAPA ABAIXO FOI OBTIDO — E POR QUE ELE NÃO É PALPITE
//
// Não dá para deduzir a ordem original a partir da lista canônica: a aba de
// produção nunca teve a ordem do `setupVoucherModuleFase1`. Então a leitura
// foi pelo outro lado — pelo DADO. Cada célula da única solicitação diz o que
// ela é: uma data de 2015 sob "INSTITUICAO_ENSINO" é data de nascimento; um
// "11" sob "CNPJ_INSTITUICAO" é idade; "CENTRO EDUCACIONAL INFANTIL - ABC DO
// SABER" sob "IDADE_BENEFICIARIO" é o nome da escola.
//
// A reconstrução fecha sozinha, e é isso que dá confiança nela:
//   - 38 nomes, exatamente o número de colunas da aba;
//   - todos pertencem à lista canônica;
//   - nenhum repetido;
//   - o que sobra do canônico são exatamente as 3 colunas novas.
//
// Se qualquer um dos quatro não batesse, o mapa estaria errado.
//
// A TRAVA QUE IMPORTA
//
// `VOUCHER_REPARO_CABECALHO_ESPERADO` guarda a linha 1 exatamente como ela
// estava quando o diagnóstico rodou. Se a aba tiver mudado desde então — mais
// uma execução do setup antigo, alguém mexendo à mão, uma coluna acrescentada
// — o mapa não vale mais, e escrever com ele destruiria o que ainda está de
// pé. Nesse caso a função RECUSA e manda rodar o diagnóstico de novo.
//
// Não conseguir verificar é recusar.
// ============================================================================

var VOUCHER_REPARO_ABA = "Voucher_Solicitacoes";
var VOUCHER_REPARO_PROP = "VOUCHER_REPARO_CONSENT";
var VOUCHER_REPARO_MINUTOS = 15;

/** A linha 1 como está hoje. Serve de impressão digital da aba. */
var VOUCHER_REPARO_CABECALHO_ESPERADO = [
  "ID_SOLICITACAO", "DATA_SOLICITACAO", "DATA_SOLICITACAO_TEXTO", "CPF_SOLICITANTE",
  "NOME_SOLICITANTE", "EMAIL", "TELEFONE", "ESCOLA_SELECIONADA",
  "STATUS_VALIDACAO_SINDICAL", "TIPO_BENEFICIARIO", "NOME_BENEFICIARIO",
  "INSTITUICAO_ENSINO", "CNPJ_INSTITUICAO", "EMAIL_INSTITUICAO", "SITUACAO_SINDICAL",
  "DATA_NASCIMENTO_BENEFICIARIO", "IDADE_BENEFICIARIO", "UNIDADE_ESCOLA",
  "CNPJ_ESCOLA", "CIDADE_ESCOLA", "NOME_TITULAR_ASSOCIADO", "PARENTESCO",
  "ENTEADO_DECLARADO_IR", "MODALIDADE", "REGIME", "AREA_CURSO", "PERCENTUAL_APLICADO",
  "TIPO_DOCUMENTO_VINCULO", "PERIODO_REFERENCIA", "LINK_DOC_PESSOAL",
  "STATUS_SOLICITACAO", "CANAL_ENTRADA", "USUARIO_CADASTRO", "USUARIO_VALIDACAO",
  "DATA_VALIDACAO", "DATA_EMISSAO", "OBSERVACOES", "NUMERO_PROTOCOLO"
];

/** O que o DADO de cada coluna realmente é, na mesma ordem da linha acima. */
var VOUCHER_REPARO_MAPA_REAL = [
  "ID_SOLICITACAO", "DATA_SOLICITACAO", "DATA_SOLICITACAO_TEXTO", "CPF_SOLICITANTE",
  "NOME_SOLICITANTE", "EMAIL", "TELEFONE", "SITUACAO_SINDICAL",
  "STATUS_VALIDACAO_SINDICAL", "TIPO_BENEFICIARIO", "NOME_BENEFICIARIO",
  "DATA_NASCIMENTO_BENEFICIARIO", "IDADE_BENEFICIARIO", "NOME_TITULAR_ASSOCIADO",
  "PARENTESCO", "ENTEADO_DECLARADO_IR", "ESCOLA_SELECIONADA", "UNIDADE_ESCOLA",
  "CNPJ_ESCOLA", "CIDADE_ESCOLA", "MODALIDADE", "CURSO", "AREA_CURSO", "ORDEM_FILHO",
  "REGIME", "PERIODO_REFERENCIA", "PERCENTUAL_APLICADO", "TIPO_DOCUMENTO_VINCULO",
  "LINK_CONTRACHEQUE", "LINK_DOC_PESSOAL", "STATUS_SOLICITACAO", "CANAL_ENTRADA",
  "USUARIO_CADASTRO", "USUARIO_VALIDACAO", "DATA_VALIDACAO", "DATA_EMISSAO",
  "OBSERVACOES", "NUMERO_PROTOCOLO"
];

/* ══════════════════════════════════════════════════════════════════════
   PRÉVIA — não escreve nada
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Mostra, coluna a coluna, o que o reparo faria. NÃO GRAVA.
 *
 * Ao terminar, libera o consentimento que `voucherRepararColunasAplicar`
 * exige — válido por 15 minutos e de uso único. É o que impede alguém de
 * rodar o "aplicar" direto pelo editor sem nunca ter olhado o que ele muda.
 */
function voucherRepararColunasPrevia(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "Prévia do reparo de colunas do Voucher", true);

  var checagem = voucherReparoConferirAba_();
  if (!checagem.ok) { Logger.log("✗ " + checagem.mensagem); return checagem; }

  var sh = checagem.aba;
  var linhas = Math.max(sh.getLastRow() - 1, 0);

  Logger.log("═══ PRÉVIA DO REPARO — NADA FOI GRAVADO ═══");
  Logger.log("aba: " + VOUCHER_REPARO_ABA + " · " + linhas + " solicitação(ões)");
  Logger.log("");
  Logger.log("col  RÓTULO DE HOJE                     PASSA A SER");
  Logger.log("──────────────────────────────────────────────────────────────────");

  var trocam = 0;
  for (var i = 0; i < VOUCHER_REPARO_CABECALHO_ESPERADO.length; i++) {
    var de = VOUCHER_REPARO_CABECALHO_ESPERADO[i];
    var para = VOUCHER_REPARO_MAPA_REAL[i];
    if (de === para) continue;
    trocam++;
    Logger.log(("" + (i + 1)).padStart(3) + "  " + (de + "                                   ").slice(0, 35) + para);
  }

  var canon = VOUCHER_COLUNAS_SOLICITACOES_();
  var acrescenta = canon.filter(function (h) { return VOUCHER_REPARO_MAPA_REAL.indexOf(h) === -1; });

  Logger.log("");
  Logger.log("colunas que trocam de rótulo ..... " + trocam);
  Logger.log("colunas acrescentadas no fim ..... " + (acrescenta.length ? acrescenta.join(", ") : "nenhuma"));
  Logger.log("");
  Logger.log("O DADO NÃO SE MEXE. Só a linha 1 é reescrita, para cada coluna");
  Logger.log("passar a se chamar pelo que ela de fato guarda.");
  Logger.log("Antes de gravar, uma cópia integral da aba é salva como BACKUP_.");
  Logger.log("");
  Logger.log("Confira a lista acima contra o que você sabe da operação.");
  Logger.log("Se estiver certa, rode voucherRepararColunasAplicar nos próximos " +
             VOUCHER_REPARO_MINUTOS + " minutos.");

  PropertiesService.getScriptProperties().setProperty(
    VOUCHER_REPARO_PROP, JSON.stringify({ quando: new Date().getTime() }));

  return { ok: true, trocam: trocam, acrescenta: acrescenta, linhas: linhas };
}

/* ══════════════════════════════════════════════════════════════════════
   APLICAR — escreve, depois do backup
   ══════════════════════════════════════════════════════════════════════ */

function voucherRepararColunasAplicar(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "Reparo de colunas do Voucher", true);

  var props = PropertiesService.getScriptProperties();
  var bruto = props.getProperty(VOUCHER_REPARO_PROP);
  var quando = 0;
  try { quando = bruto ? (JSON.parse(bruto).quando || 0) : 0; } catch (e) {}
  if (!quando || (new Date().getTime() - quando) > VOUCHER_REPARO_MINUTOS * 60 * 1000) {
    Logger.log("✗ Sem prévia recente. Rode voucherRepararColunasPrevia primeiro, " +
               "leia a lista e só então aplique.");
    return { ok: false, mensagem: "Rode a prévia antes — o consentimento expirou ou nunca existiu." };
  }
  // Uso único: consumido aqui, antes de escrever. Se algo explodir no meio,
  // ninguém repete a operação sem passar pela prévia de novo.
  props.deleteProperty(VOUCHER_REPARO_PROP);

  var checagem = voucherReparoConferirAba_();
  if (!checagem.ok) { Logger.log("✗ " + checagem.mensagem); return checagem; }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { ok: false, mensagem: "Outra operação está usando a planilha. Tente de novo em instantes." };
  }

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = checagem.aba;
    var nCols = sh.getLastColumn();
    var nLinhas = sh.getLastRow();

    // ── backup ANTES de qualquer escrita ──
    var carimbo = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd_HHmmss");
    var nomeBackup = "BACKUP_VOUCHER_SOLIC_" + carimbo;
    var tudo = sh.getRange(1, 1, nLinhas, nCols).getValues();
    var bk = ss.insertSheet(nomeBackup);
    bk.getRange(1, 1, nLinhas, nCols).setValues(tudo);
    Logger.log("backup salvo em: " + nomeBackup + " (" + nLinhas + " linhas × " + nCols + " colunas)");

    // ── só a linha 1 é reescrita ──
    sh.getRange(1, 1, 1, VOUCHER_REPARO_MAPA_REAL.length).setValues([VOUCHER_REPARO_MAPA_REAL]);

    // ── as colunas que o canônico tem e a aba não, acrescentadas no fim ──
    var canon = VOUCHER_COLUNAS_SOLICITACOES_();
    var faltando = canon.filter(function (h) { return VOUCHER_REPARO_MAPA_REAL.indexOf(h) === -1; });
    if (faltando.length) {
      sh.getRange(1, VOUCHER_REPARO_MAPA_REAL.length + 1, 1, faltando.length).setValues([faltando]);
    }

    Logger.log("✓ Linha 1 reescrita. " + VOUCHER_REPARO_MAPA_REAL.length +
               " colunas renomeadas para o que elas guardam" +
               (faltando.length ? ", e " + faltando.length + " acrescentadas no fim" : "") + ".");
    Logger.log("");
    Logger.log("Rode voucherDiagnosticoColunas para conferir: todo rótulo deve");
    Logger.log("bater com o valor embaixo dele, e não deve sobrar nome ausente.");

    if (typeof auditar_ === "function") {
      auditar_({
        modulo: "Benefícios", submodulo: "Certificado de Bolsa",
        acao: "REPARAR_COLUNAS", registroId: VOUCHER_REPARO_ABA,
        valorAnterior: VOUCHER_REPARO_CABECALHO_ESPERADO.join(","),
        valorNovo: VOUCHER_REPARO_MAPA_REAL.join(","),
        justificativa: "Cabeçalho desalinhado pelo ensureHeaders_ antigo. Backup: " + nomeBackup
      });
    }

    return { ok: true, backup: nomeBackup, renomeadas: VOUCHER_REPARO_MAPA_REAL.length,
             acrescentadas: faltando };
  } catch (e) {
    Logger.log("✗ Reparo falhou: " + e.message);
    return { ok: false, mensagem: "Reparo falhou: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════════════
   APOIO
   ══════════════════════════════════════════════════════════════════════ */

/**
 * A aba ainda é aquela que o mapa descreve?
 *
 * Compara a linha 1 inteira com a impressão digital. Diferença de UMA célula
 * já invalida o mapa — porque o mapa é posicional, e uma coluna a mais no
 * meio desloca tudo o que vem depois. Aqui é melhor recusar cem vezes à toa
 * do que aceitar uma vez errado: gravar com mapa vencido trocaria o rótulo de
 * colunas que estavam certas.
 */
function voucherReparoConferirAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(VOUCHER_REPARO_ABA);
  if (!sh) return { ok: false, mensagem: "Aba " + VOUCHER_REPARO_ABA + " não encontrada." };

  var nCols = sh.getLastColumn();
  if (nCols !== VOUCHER_REPARO_CABECALHO_ESPERADO.length) {
    return { ok: false, mensagem:
      "A aba tem " + nCols + " colunas; o mapa foi feito para " +
      VOUCHER_REPARO_CABECALHO_ESPERADO.length + ". Alguém mexeu na aba depois do " +
      "diagnóstico. Rode voucherDiagnosticoColunas de novo e me mande o resultado — " +
      "aplicar este mapa agora estragaria o que ainda está certo." };
  }

  var atual = sh.getRange(1, 1, 1, nCols).getValues()[0].map(function (v) {
    return String(v || "").trim();
  });
  for (var i = 0; i < atual.length; i++) {
    if (atual[i] !== VOUCHER_REPARO_CABECALHO_ESPERADO[i]) {
      return { ok: false, mensagem:
        "A coluna " + (i + 1) + " hoje se chama \"" + atual[i] + "\", e o mapa esperava \"" +
        VOUCHER_REPARO_CABECALHO_ESPERADO[i] + "\". A aba mudou desde o diagnóstico. " +
        "Rode voucherDiagnosticoColunas de novo — não vou gravar com mapa vencido." };
    }
  }
  return { ok: true, aba: sh };
}
