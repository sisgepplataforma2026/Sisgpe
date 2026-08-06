// ============================================================================
// ARQUIVO: PlanilhaSisgep.gs
//
// UM ÚNICO LUGAR PARA ABRIR A PLANILHA DO SISGEP.
//
// O PROBLEMA QUE ISTO RESOLVE
// O projeto tinha 14 ocorrências do ID da planilha de produção escritas
// direto no código, em 9 arquivos, e 12 arquivos chamando
// getActiveSpreadsheet(). Consequências:
//
//   1. A chave de ambiente (producao/homologacao) do SistemaConfig era
//      ignorada por esses trechos. Trocar para homologação fazia parte do
//      sistema escrever na planilha de teste e outra parte continuar lendo a
//      de produção — o pior tipo de defeito, porque cada tela parece certa
//      sozinha e o conjunto está errado.
//
//   2. getActiveSpreadsheet() devolve null em web app não vinculado a
//      planilha. Onde havia "getActiveSpreadsheet() || openById(fixo)",
//      funcionava por acidente; onde havia só getActiveSpreadsheet(),
//      dependia de o projeto estar vinculado.
//
// A REGRA DAQUI PARA A FRENTE
// Nenhum arquivo abre planilha por conta própria. Todos chamam
// planilhaSisgep_(). Se um dia a planilha mudar, muda aqui.
//
// POR QUE A ORDEM É ESTA
// PLANILHA_ID primeiro, porque é ele que respeita o ambiente escolhido.
// getActiveSpreadsheet() só como reserva, para o caso de o projeto estar
// vinculado a uma planilha e o SistemaConfig não ter carregado.
// ============================================================================

/** A planilha do SISGEP, respeitando o ambiente configurado. */
function planilhaSisgep_() {
  var id = "";
  try {
    if (typeof PLANILHA_ID === "string" && PLANILHA_ID) id = PLANILHA_ID;
    else if (typeof getPlanilhaId === "function") id = String(getPlanilhaId() || "");
  } catch (e) {
    Logger.log("planilhaSisgep_ — SistemaConfig indisponível: " + e);
  }

  if (id) return SpreadsheetApp.openById(id);

  var ativa = null;
  try { ativa = SpreadsheetApp.getActiveSpreadsheet(); } catch (e2) {}
  if (ativa) return ativa;

  throw new Error("Não foi possível localizar a planilha do SISGEP. " +
    "Verifique a configuração de ambiente em SistemaConfig.");
}

/**
 * Aba pelo nome, criando se não existir e se um cabeçalho for informado.
 * Sem cabeçalho, devolve null quando a aba não existe — quem chama decide se
 * isso é erro ou não. Criar aba em silêncio, sem cabeçalho, produz planilha
 * com aba vazia que ninguém sabe de onde veio.
 */
function abaSisgep_(nome, cabecalho) {
  var ss = planilhaSisgep_();
  var aba = ss.getSheetByName(nome);
  if (aba) return aba;
  if (!cabecalho || !cabecalho.length) return null;

  aba = ss.insertSheet(nome);
  aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  aba.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold");
  aba.setFrozenRows(1);
  return aba;
}
