// ================================
// ARQUIVO: RHRubricas.gs
// MÓDULO: RH — Motor de rubricas (eventos de folha configuráveis)
//
// Origem: comparação entre o holerite real do sindicato (modelo .odg
// enviado pelo usuário) e o que o SISGEP já gerava. O holerite real tem
// uma tabela de itens (Código | Descrição | Referência | Vencimentos |
// Descontos) — ex.: "13 SALARIO ADIANTADO", "TROCO DO ADIANTAMENTO 13o",
// "MEDIA VALOR 13o ADIANTADO" — além do salário-base. O SISGEP só tinha
// salário/benefícios/descontos fixos por colaborador, sem espaço para um
// evento avulso (hora extra, adicional noturno, adiantamento etc.) sem
// reeditar o cadastro permanente do colaborador.
//
// Este arquivo resolve isso com um catálogo de rubricas reutilizável
// (RH_RUBRICAS) e um snapshot por lançamento de folha (RH_FOLHA_RUBRICAS)
// — quem gera a folha escolhe rubricas do catálogo e digita o valor na
// hora (mesmo padrão de "dias trabalhados" em prepararFolhaRH/gerarFolhaRH:
// o sistema não tenta adivinhar regra trabalhista, só registra o que foi
// informado).
//
// IMPORTANTE — simplificação deliberada e avisada ao usuário: rubricas
// extras somam/subtraem do BRUTO e do LÍQUIDO, mas NÃO alteram a base de
// cálculo de INSS/IRRF/FGTS nesta fase — esses continuam calculados só
// sobre o salário pró-rata, como já era. Cada tipo de rubrica (hora
// extra, adicional noturno etc.) tem regra própria de incidência
// tributária que não deve ser adivinhada; se isso for necessário no
// futuro, é um projeto à parte com validação do contador do sindicato.
//
// Exclusão do catálogo é sempre lógica (ATIVO=false), nunca physical
// delete — apagar uma rubrica de verdade órfãozaria as linhas já
// gravadas em RH_FOLHA_RUBRICAS de competências passadas.
// ================================

var ABA_RH_RUBRICAS = "RH_RUBRICAS";
var ABA_RH_FOLHA_RUBRICAS = "RH_FOLHA_RUBRICAS";

var RH_RUBRICAS_SEED_ = [
  { codigo: "HE50", descricao: "Hora Extra 50%", tipo: "Provento" },
  { codigo: "HE100", descricao: "Hora Extra 100%", tipo: "Provento" },
  { codigo: "ADNOT", descricao: "Adicional Noturno", tipo: "Provento" },
  { codigo: "INSAL", descricao: "Insalubridade", tipo: "Provento" },
  { codigo: "PERIC", descricao: "Periculosidade", tipo: "Provento" },
  { codigo: "COMIS", descricao: "Comissão", tipo: "Provento" },
  { codigo: "GRATIF", descricao: "Gratificação", tipo: "Provento" },
  { codigo: "ADIANT", descricao: "Adiantamento", tipo: "Provento" },
  { codigo: "VT", descricao: "Vale Transporte", tipo: "Desconto" },
  { codigo: "VA", descricao: "Vale Alimentação", tipo: "Desconto" },
  { codigo: "PLSAU", descricao: "Plano de Saúde", tipo: "Desconto" },
  { codigo: "PLODO", descricao: "Plano Odontológico", tipo: "Desconto" },
  { codigo: "EMPREST", descricao: "Empréstimo Consignado", tipo: "Desconto" },
  { codigo: "PENSAO", descricao: "Pensão Alimentícia", tipo: "Desconto" },
  { codigo: "DESCDIV", descricao: "Desconto Diverso", tipo: "Desconto" }
];

// Rubricas reais em uso na folha de verdade do sindicato — extraídas do
// Extrato Mensal (contabilidade, competência 06/2026). Códigos numéricos
// iguais aos do sistema da contabilidade (IMPACTO CONSULTORIA), para
// manter rastreabilidade entre o que o SISGEP lança e o que aparece no
// extrato oficial que a contabilidade já usa.
var RH_RUBRICAS_REAIS_EXTRATO_ = [
  { codigo: "19", descricao: "Diferença Salarial", tipo: "Provento" },
  { codigo: "20", descricao: "Prêmio Mérito", tipo: "Provento" },
  { codigo: "292", descricao: "Quinquênio", tipo: "Provento" },
  { codigo: "355", descricao: "Decênio", tipo: "Provento" },
  { codigo: "504", descricao: "Insalubridade 10% Piso Salarial", tipo: "Provento" },
  { codigo: "518", descricao: "Abono CCT", tipo: "Provento" },
  { codigo: "992", descricao: "Arredondamento do Mês", tipo: "Provento" },
  { codigo: "993", descricao: "Troco Mês Anterior", tipo: "Desconto" }
];

function rh_garantirRubricasCatalogo_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_RUBRICAS);
  if (!sh) sh = ss.insertSheet(ABA_RH_RUBRICAS);
  var catalogoCompleto = RH_RUBRICAS_SEED_.concat(RH_RUBRICAS_REAIS_EXTRATO_);

  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "CODIGO", "DESCRICAO", "TIPO", "ATIVO", "CRIADO_POR", "CRIADO_EM"]);
    sh.getRange(1, 1, 1, 7).setFontWeight("bold");
    sh.setFrozenRows(1);

    var agora = new Date();
    var linhas = catalogoCompleto.map(function (r) {
      return [rh_gerarId_("RUB"), r.codigo, r.descricao, r.tipo, true, "SISGEP", agora];
    });
    sh.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  } else {
    // Migração idempotente: quem já tinha o catálogo criado antes só
    // ganha as rubricas que ainda não existem (por CODIGO) — nada é
    // sobrescrito nem duplicado.
    var codigosExistentes = {};
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (l) {
        codigosExistentes[String(l[0]).trim()] = true;
      });
    }
    var faltantes = catalogoCompleto.filter(function (r) { return !codigosExistentes[r.codigo]; });
    if (faltantes.length) {
      var agoraM = new Date();
      var linhasNovas = faltantes.map(function (r) {
        return [rh_gerarId_("RUB"), r.codigo, r.descricao, r.tipo, true, "SISGEP", agoraM];
      });
      sh.getRange(sh.getLastRow() + 1, 1, linhasNovas.length, linhasNovas[0].length).setValues(linhasNovas);
    }
  }
  return sh;
}

function rh_garantirFolhaRubricas_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_FOLHA_RUBRICAS);
  if (!sh) sh = ss.insertSheet(ABA_RH_FOLHA_RUBRICAS);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "FOLHA_ID", "COMPETENCIA", "COLABORADOR_ID", "RUBRICA_ID",
      "CODIGO", "DESCRICAO", "TIPO", "REFERENCIA", "VALOR", "CRIADO_EM"
    ]);
    sh.getRange(1, 1, 1, 11).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

/* =========================================
 * CATÁLOGO — leitura pública, escrita exige administrador
 * ========================================= */
function listarRubricasRH(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  return rh_listarRubricas_interno_();
}

// Núcleo sem checagem de sessão — usado por gerarFolhaRH (já validou o
// token na entrada) para resolver rubricaId -> {codigo,descricao,tipo}
// sem confiar no que o cliente mandou para esses três campos.
function rh_listarRubricas_interno_() {
  try {
    var sh = rh_garantirRubricasCatalogo_();
    if (sh.getLastRow() < 2) return [];
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    return dados.map(function (l) {
      return { id: String(l[0]), codigo: String(l[1] || ""), descricao: String(l[2] || ""), tipo: String(l[3] || "Provento"), ativo: l[4] !== false };
    }).filter(function (r) { return !!r.id; });
  } catch (e) {
    Logger.log("rh_listarRubricas_interno_ erro: " + e.message);
    return [];
  }
}

// Cria ou atualiza (dados.id presente) uma rubrica do catálogo.
function salvarRubricaRH(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", true);
  try {
    dados = dados || {};
    var codigo = String(dados.codigo || "").trim();
    var descricao = String(dados.descricao || "").trim();
    var tipo = (String(dados.tipo || "Provento") === "Desconto") ? "Desconto" : "Provento";
    if (!codigo || !descricao) return { ok: false, mensagem: "Informe código e descrição da rubrica." };

    var sh = rh_garantirRubricasCatalogo_();
    var idAlvo = String(dados.id || "").trim();
    var quem = sessao.nome || sessao.usuario || "SISGEP";

    if (idAlvo && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === idAlvo) {
          var linha = i + 2;
          sh.getRange(linha, 2, 1, 3).setValues([[codigo, descricao, tipo]]);
          return { ok: true, id: idAlvo, mensagem: "Rubrica atualizada." };
        }
      }
    }

    var novoId = rh_gerarId_("RUB");
    sh.appendRow([novoId, codigo, descricao, tipo, true, quem, new Date()]);
    return { ok: true, id: novoId, mensagem: "Rubrica cadastrada." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar rubrica: " + e.message };
  }
}

// Ativa/desativa — nunca exclui de verdade (linhas históricas em
// RH_FOLHA_RUBRICAS apontam para o ID da rubrica).
function alternarRubricaRH(id, ativo, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", true);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Rubrica não informada." };
    var sh = rh_garantirRubricasCatalogo_();
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Rubrica não encontrada." };
    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        sh.getRange(i + 2, 5).setValue(!!ativo);
        return { ok: true, mensagem: ativo ? "Rubrica ativada." : "Rubrica desativada." };
      }
    }
    return { ok: false, mensagem: "Rubrica não encontrada." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao atualizar rubrica: " + e.message };
  }
}

/* =========================================
 * SNAPSHOT POR LANÇAMENTO DE FOLHA
 * ========================================= */

// Grava as rubricas extras aplicadas a UM lançamento de folha já criado
// (chamado de dentro de gerarFolhaRH, depois que a linha em
// RH_FOLHA_PAGAMENTO já tem ID). rubricasExtras = [{rubricaId, referencia, valor}],
// vindo do cliente — só valor/referência são confiança do cliente (é
// digitação manual no momento da folha, igual "dias trabalhados");
// código/descrição/tipo SEMPRE vêm do catálogo no servidor.
function rh_gravarFolhaRubricas_(folhaId, competencia, colaboradorId, rubricasExtras, mapaCatalogo) {
  if (!Array.isArray(rubricasExtras) || !rubricasExtras.length) return [];
  var sh = rh_garantirFolhaRubricas_();
  var agora = new Date();
  var linhas = [];
  var aplicadas = [];

  rubricasExtras.forEach(function (r) {
    var rubricaId = String((r && r.rubricaId) || "").trim();
    var catalogo = mapaCatalogo[rubricaId];
    if (!catalogo || !catalogo.ativo) return; // rubrica inexistente/inativa — ignora silenciosamente

    var valor = Math.round(Number((r && r.valor) || 0) * 100) / 100;
    if (!valor) return;
    var referencia = String((r && r.referencia) || "").trim();

    var item = {
      id: rh_gerarId_("FREG"), rubricaId: rubricaId, codigo: catalogo.codigo,
      descricao: catalogo.descricao, tipo: catalogo.tipo, referencia: referencia, valor: valor
    };
    aplicadas.push(item);
    linhas.push([item.id, folhaId, competencia, colaboradorId, rubricaId, catalogo.codigo, catalogo.descricao, catalogo.tipo, referencia, valor, agora]);
  });

  if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  return aplicadas;
}

// Usado pelo gerador de holerite — busca as rubricas extras de UM
// lançamento específico direto na planilha.
function rh_listarFolhaRubricasPorFolhaId_(folhaId) {
  var sh = rh_garantirFolhaRubricas_();
  if (sh.getLastRow() < 2) return [];
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return dados
    .filter(function (l) { return String(l[1]) === String(folhaId); })
    .map(function (l) {
      return { id: l[0], folhaId: l[1], competencia: l[2], colaboradorId: l[3], rubricaId: l[4], codigo: l[5], descricao: l[6], tipo: l[7], referencia: l[8], valor: Number(l[9] || 0) };
    });
}

/* =========================================
 * RUBRICAS FIXAS POR COLABORADOR
 *
 * Diferente das rubricas extras de RH_FOLHA_RUBRICAS (digitadas na hora,
 * uma vez por lançamento — hora extra, adiantamento etc.), algumas
 * rubricas do extrato real são recorrentes: o mesmo valor todo mês até
 * mudar (ex.: Abono CCT — ~14,2% do salário em todos os 7 colaboradores
 * reais —, Quinquênio, Decênio, Insalubridade 10%, Prêmio Mérito).
 * Confirmado pelo usuário: "os prêmios são fixos". Diferença Salarial
 * NÃO entra aqui — foi um ajuste retroativo de um mês específico
 * (competência 06/2026), não recorrente.
 *
 * gerarFolhaRH aplica automaticamente as rubricas fixas ativas de cada
 * colaborador em toda folha nova, junto com as rubricas extras variáveis
 * digitadas manualmente naquele lançamento — se o cliente já mandar uma
 * rubricaId que também é fixa (ajuste pontual daquele mês), o valor
 * digitado na hora prevalece sobre o valor fixo cadastrado.
 * ========================================= */

var ABA_RH_RUBRICAS_FIXAS = "RH_RUBRICAS_FIXAS_COLABORADOR";

function rh_garantirRubricasFixas_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_RUBRICAS_FIXAS);
  if (!sh) sh = ss.insertSheet(ABA_RH_RUBRICAS_FIXAS);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "COLABORADOR_ID", "RUBRICA_ID", "CODIGO", "DESCRICAO", "TIPO", "VALOR", "ATIVO",
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 12).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rh_listarRubricasFixasColaborador_interno_(colaboradorId) {
  var sh = rh_garantirRubricasFixas_();
  if (sh.getLastRow() < 2) return [];
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return dados
    .filter(function (l) { return String(l[1]) === String(colaboradorId); })
    .map(function (l) {
      return {
        id: String(l[0]), colaboradorId: String(l[1]), rubricaId: String(l[2]),
        codigo: String(l[3] || ""), descricao: String(l[4] || ""), tipo: String(l[5] || "Provento"),
        valor: Number(l[6] || 0), ativo: l[7] !== false
      };
    });
}

// Público — leitura (usado pelo passo de prévia da folha e por uma
// eventual tela de gestão das fixas do colaborador).
function listarRubricasFixasColaboradorRH(colaboradorId, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  return rh_listarRubricasFixasColaborador_interno_(colaboradorId);
}

// Núcleo — upsert por (colaboradorId + rubricaId): nunca duplica a mesma
// rubrica fixa pro mesmo colaborador, só atualiza o valor se já existir.
function rh_salvarRubricaFixaColaborador_(colaboradorId, rubricaId, valor, quem) {
  var sh = rh_garantirRubricasFixas_();
  var mapa = rh_mapaCabecalho_(sh);
  var catalogo = rh_listarRubricas_interno_().filter(function (r) { return r.id === rubricaId; })[0];
  if (!catalogo) throw new Error("Rubrica não encontrada no catálogo: " + rubricaId);

  var agora = new Date();
  valor = Math.round(Number(valor || 0) * 100) / 100;

  var ultimaLinha = sh.getLastRow();
  if (ultimaLinha > 1) {
    var dados = sh.getRange(2, 1, ultimaLinha - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["COLABORADOR_ID"] - 1]) === String(colaboradorId) &&
        String(dados[i][mapa["RUBRICA_ID"] - 1]) === String(rubricaId)) {
        var linha = i + 2;
        sh.getRange(linha, mapa["VALOR"]).setValue(valor);
        sh.getRange(linha, mapa["ATIVO"]).setValue(true);
        sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
        sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(agora);
        return { id: String(dados[i][mapa["ID"] - 1]), atualizado: true };
      }
    }
  }

  var novoId = rh_gerarId_("RUBFIX");
  sh.appendRow([
    novoId, colaboradorId, rubricaId, catalogo.codigo, catalogo.descricao, catalogo.tipo, valor, true,
    quem, agora, quem, agora
  ]);
  return { id: novoId, atualizado: false };
}

// Público — exige administrador (grava valor recorrente de RH em lote).
function salvarRubricaFixaColaboradorRH(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", true);
  try {
    dados = dados || {};
    var colaboradorId = String(dados.colaboradorId || "").trim();
    var rubricaId = String(dados.rubricaId || "").trim();
    if (!colaboradorId || !rubricaId) return { ok: false, mensagem: "Informe colaborador e rubrica." };
    if (!Number(dados.valor)) return { ok: false, mensagem: "Informe um valor maior que zero." };

    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var resultado = rh_salvarRubricaFixaColaborador_(colaboradorId, rubricaId, dados.valor, quem);
    return { ok: true, id: resultado.id, mensagem: resultado.atualizado ? "Rubrica fixa atualizada." : "Rubrica fixa cadastrada." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar rubrica fixa: " + e.message };
  }
}

// Público — exige administrador. Nunca exclui de verdade (ATIVO=false),
// mesmo padrão de alternarRubricaRH — preserva rastreabilidade.
function alternarRubricaFixaColaboradorRH(id, ativo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", true);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Rubrica fixa não informada." };
    var sh = rh_garantirRubricasFixas_();
    var mapa = rh_mapaCabecalho_(sh);
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Rubrica fixa não encontrada." };

    var ids = sh.getRange(2, mapa["ID"], sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        var linha = i + 2;
        var quem = sessao.nome || sessao.usuario || "SISGEP";
        sh.getRange(linha, mapa["ATIVO"]).setValue(!!ativo);
        sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
        sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(new Date());
        return { ok: true, mensagem: ativo ? "Rubrica fixa reativada." : "Rubrica fixa desativada." };
      }
    }
    return { ok: false, mensagem: "Rubrica fixa não encontrada." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao atualizar rubrica fixa: " + e.message };
  }
}
