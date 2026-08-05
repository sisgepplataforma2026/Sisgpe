// ================================
// ARQUIVO: RHColaboradores.gs
// MÓDULO: RH — Colaboradores do próprio sindicato
//
// Fase 1 da auditoria: RHAdmin.html gravava cadastro de colaboradores e
// folha de pagamento inteiramente em localStorage do navegador — trocar
// de computador, navegador ou limpar o cache apagava tudo, e não havia
// nenhum arquivo .gs de backend para o módulo. Isso foi resolvido com
// abas centralizadas na planilha, sessão obrigatória em toda operação,
// e trilha de quem criou/atualizou cada colaborador.
//
// Fase 2 da auditoria (este arquivo, ampliado): cálculo trabalhista
// real — INSS progressivo, FGTS patronal, IRRF com dedução por
// dependente — em vez do percentual único digitado à mão. A folha
// grava um lançamento por colaborador POR COMPETÊNCIA, sem sobrescrever
// meses anteriores.
//
// IMPORTANTE — tabelas de INSS/IRRF mudam todo ano por lei. Elas ficam
// configuráveis (rhObterConfigTributaria/rhSalvarConfigTributaria,
// PropertiesService) em vez de fixas no código, mas os valores
// pré-carregados (RH_INSS_PADRAO_/RH_IRRF_PADRAO_) são só a última
// tabela conhecida no momento da implementação — CONFERIR com o
// contador do sindicato antes de gerar uma folha oficial.
//
// Pró-rata de férias/afastamento: em vez de tentar modelar regra
// trabalhista (férias e afastamento por INSS têm tratamentos de
// pagamento diferentes), quem gera a folha informa manualmente os
// "dias trabalhados no mês" de cada colaborador em prepararFolhaRH/
// gerarFolhaRH — o sistema só faz a proporção aritmética.
// ================================

var ABA_RH_COLABORADORES = "RH_COLABORADORES";
var ABA_RH_FOLHA = "RH_FOLHA_PAGAMENTO";

var CHAVE_CONFIG_RH_INSS_ = "SISGEP_RH_TABELA_INSS";
var CHAVE_CONFIG_RH_IRRF_ = "SISGEP_RH_TABELA_IRRF";
var CHAVE_CONFIG_RH_IRRF_DEDUCAO_DEP_ = "SISGEP_RH_IRRF_DEDUCAO_DEPENDENTE";
var CHAVE_CONFIG_RH_FGTS_PCT_ = "SISGEP_RH_FGTS_PATRONAL_PCT";

// Última tabela conhecida no momento da implementação (2025/2026) — CONFERIR antes de usar.
var RH_INSS_PADRAO_ = [
  { ate: 1518.00, aliquota: 7.5 },
  { ate: 2793.88, aliquota: 9 },
  { ate: 4190.83, aliquota: 12 },
  { ate: 8157.41, aliquota: 14 }
];
var RH_IRRF_PADRAO_ = [
  { ate: 2259.20, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 7.5, deducao: 169.44 },
  { ate: 3751.05, aliquota: 15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 22.5, deducao: 662.77 },
  { ate: Infinity, aliquota: 27.5, deducao: 896.00 }
];
var RH_IRRF_DEDUCAO_DEPENDENTE_PADRAO_ = 189.59;
var RH_FGTS_PATRONAL_PCT_PADRAO_ = 8;

function rh_garantirColaboradores_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_COLABORADORES);
  if (!sh) sh = ss.insertSheet(ABA_RH_COLABORADORES);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "NOME", "CARGO", "SETOR", "STATUS", "VENCIMENTO",
      "SALARIO", "BENEFICIOS", "DESCONTOS", "DEPENDENTES", "ANIVERSARIO", "EMAIL",
      "MATRICULA", "CBO", "CENTRO_CUSTO", "FILIAL", "ADMISSAO", "CPF", "DEPARTAMENTO",
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 22).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ["DEPENDENTES", "ANIVERSARIO", "EMAIL", "MATRICULA", "CBO", "CENTRO_CUSTO", "FILIAL", "ADMISSAO", "CPF", "DEPARTAMENTO"].forEach(function (nomeCol) {
      var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      if (cab.indexOf(nomeCol) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(nomeCol).setFontWeight("bold");
      }
    });
  }
  return sh;
}

// Folha de pagamento com cálculo trabalhista real (Fase 2). Se a aba já
// existe no formato antigo (Fase 1, sem coluna INSS), ela é preservada
// intacta sob outro nome — nada é apagado — e uma aba nova é criada.
function rh_garantirFolha_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_FOLHA);

  if (sh && sh.getLastRow() > 0) {
    var cabAtual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (cabAtual.indexOf("INSS") === -1) {
      var novoNome = ABA_RH_FOLHA + "_LEGADO_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
      sh.setName(novoNome);
      Logger.log("[RH] Aba de folha no formato antigo preservada como " + novoNome + ".");
      sh = null;
    }
  }

  if (!sh) sh = ss.getSheetByName(ABA_RH_FOLHA);
  if (!sh) sh = ss.insertSheet(ABA_RH_FOLHA);

  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "COMPETENCIA", "COLABORADOR_ID", "NOME", "CARGO", "DEPENDENTES",
      "SALARIO", "BENEFICIOS", "DESCONTOS",
      "DIAS_TRABALHADOS", "DIAS_MES", "SALARIO_PRORATA",
      "INSS", "BASE_IRRF", "IRRF", "FGTS_PATRONAL",
      "BRUTO", "LIQUIDO",
      "OBSERVACAO", "GERADO_POR", "GERADO_EM",
      "PROVENTOS_EXTRA", "DESCONTOS_EXTRA"
    ]);
    sh.getRange(1, 1, 1, 23).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ["PROVENTOS_EXTRA", "DESCONTOS_EXTRA"].forEach(function (nomeCol) {
      var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      if (cab.indexOf(nomeCol) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(nomeCol).setFontWeight("bold");
      }
    });
  }
  return sh;
}

function rh_gerarId_(prefixo) {
  return prefixo + "-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function rh_formatarData_(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v);
}

function rh_mapaCabecalho_(sh) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) { if (nome) mapa[String(nome).trim().toUpperCase()] = i + 1; });
  return mapa;
}

/* =========================================
 * CONFIGURAÇÃO TRIBUTÁRIA (INSS/IRRF/FGTS) — PropertiesService
 * ========================================= */
function rh_obterConfigTributaria_() {
  var props = PropertiesService.getScriptProperties();
  var inss = null, irrf = null;

  try {
    var inssRaw = JSON.parse(props.getProperty(CHAVE_CONFIG_RH_INSS_) || "null");
    if (Array.isArray(inssRaw) && inssRaw.length) inss = inssRaw;
  } catch (e) { /* mantém padrão */ }

  try {
    var irrfRaw = JSON.parse(props.getProperty(CHAVE_CONFIG_RH_IRRF_) || "null");
    if (Array.isArray(irrfRaw) && irrfRaw.length) {
      irrf = irrfRaw.map(function (f) {
        return { ate: f.ate === "__INF__" ? Infinity : Number(f.ate), aliquota: Number(f.aliquota), deducao: Number(f.deducao) };
      });
    }
  } catch (e) { /* mantém padrão */ }

  return {
    inss: inss || RH_INSS_PADRAO_,
    irrf: irrf || RH_IRRF_PADRAO_,
    deducaoDependente: Number(props.getProperty(CHAVE_CONFIG_RH_IRRF_DEDUCAO_DEP_) || RH_IRRF_DEDUCAO_DEPENDENTE_PADRAO_),
    fgtsPatronalPct: Number(props.getProperty(CHAVE_CONFIG_RH_FGTS_PCT_) || RH_FGTS_PATRONAL_PCT_PADRAO_)
  };
}

function rhObterConfigTributaria(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  var cfg = rh_obterConfigTributaria_();
  return {
    ok: true,
    inss: cfg.inss,
    irrf: cfg.irrf.map(function (f) { return { ate: f.ate === Infinity ? "" : f.ate, aliquota: f.aliquota, deducao: f.deducao }; }),
    deducaoDependente: cfg.deducaoDependente,
    fgtsPatronalPct: cfg.fgtsPatronalPct
  };
}

// Alterar as tabelas tributárias exige administrador — impacta o valor
// líquido pago a todos os colaboradores.
function rhSalvarConfigTributaria(inss, irrf, deducaoDependente, fgtsPatronalPct, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", true);
  try {
    if (!Array.isArray(inss) || !inss.length) return { ok: false, mensagem: "Tabela de INSS inválida." };
    if (!Array.isArray(irrf) || !irrf.length) return { ok: false, mensagem: "Tabela de IRRF inválida." };

    var inssNorm = inss.map(function (f) { return { ate: Number(f.ate), aliquota: Number(f.aliquota) }; });
    var irrfNorm = irrf.map(function (f) {
      var ateVal = (f.ate === "" || f.ate === null || f.ate === undefined) ? "__INF__" : Number(f.ate);
      return { ate: ateVal, aliquota: Number(f.aliquota), deducao: Number(f.deducao) };
    });

    var props = PropertiesService.getScriptProperties();
    props.setProperty(CHAVE_CONFIG_RH_INSS_, JSON.stringify(inssNorm));
    props.setProperty(CHAVE_CONFIG_RH_IRRF_, JSON.stringify(irrfNorm));
    props.setProperty(CHAVE_CONFIG_RH_IRRF_DEDUCAO_DEP_, String(Number(deducaoDependente || 0)));
    props.setProperty(CHAVE_CONFIG_RH_FGTS_PCT_, String(Number(fgtsPatronalPct || RH_FGTS_PATRONAL_PCT_PADRAO_)));

    return { ok: true, mensagem: "Tabelas tributárias salvas. Confira os valores com o contador antes de gerar a folha oficial." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar configuração: " + e.message };
  }
}

/* =========================================
 * CÁLCULO TRABALHISTA
 * ========================================= */

// INSS progressivo "de verdade": soma o valor de cada faixa até o
// salário de contribuição, não aplica a alíquota da faixa final sobre
// o total (isso superestimaria o desconto).
function rh_calcularInss_(baseSalario, tabelaInss) {
  var total = 0;
  var faixaAnterior = 0;
  for (var i = 0; i < tabelaInss.length; i++) {
    var faixa = tabelaInss[i];
    var tetoFaixa = Math.min(baseSalario, faixa.ate);
    if (tetoFaixa > faixaAnterior) {
      total += (tetoFaixa - faixaAnterior) * (faixa.aliquota / 100);
    }
    faixaAnterior = faixa.ate;
    if (baseSalario <= faixa.ate) break;
  }
  return Math.round(total * 100) / 100;
}

// IRRF: alíquota efetiva da faixa em que a base cai, com parcela a
// deduzir da própria tabela (modelo oficial da Receita Federal).
function rh_calcularIrrf_(baseCalculo, tabelaIrrf) {
  if (baseCalculo <= 0) return 0;
  for (var i = 0; i < tabelaIrrf.length; i++) {
    var faixa = tabelaIrrf[i];
    if (baseCalculo <= faixa.ate) {
      var valor = baseCalculo * (faixa.aliquota / 100) - faixa.deducao;
      return Math.max(0, Math.round(valor * 100) / 100);
    }
  }
  var ultima = tabelaIrrf[tabelaIrrf.length - 1];
  return Math.max(0, Math.round((baseCalculo * (ultima.aliquota / 100) - ultima.deducao) * 100) / 100);
}

function rh_diasNoMes_(competencia) {
  var partes = String(competencia || "").split("-");
  var ano = Number(partes[0]) || new Date().getFullYear();
  var mes = Number(partes[1]) || (new Date().getMonth() + 1);
  return new Date(ano, mes, 0).getDate();
}

/* =========================================
 * COLABORADORES
 * ========================================= */
// Público — exige sessão. Nunca chamar isto de dentro de uma rotina
// disparada por trigger (sem usuário logado); use a versão _interno_.
function listarColaboradoresRH(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  return listarColaboradoresRH_interno_();
}

// Núcleo sem checagem de sessão — usado por gerarFolhaRH/prepararFolhaRH
// (que já validam o token na entrada) e pela rotina de aniversariantes
// disparada por trigger (verificarAniversariantesRH em RHAniversarios.gs,
// sem usuário logado). Nunca exponha esta função diretamente a
// google.script.run.
function listarColaboradoresRH_interno_() {
  try {
    var sh = rh_garantirColaboradores_();
    if (sh.getLastRow() < 2) return [];

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    return dados
      .map(function (linha) {
        var obj = {};
        cab.forEach(function (col, i) { obj[col] = linha[i]; });
        return {
          id: String(obj.ID || ""),
          nome: String(obj.NOME || ""),
          cargo: String(obj.CARGO || ""),
          setor: String(obj.SETOR || "Administrativo"),
          status: String(obj.STATUS || "Ativo"),
          vencimento: rh_formatarData_(obj.VENCIMENTO),
          salario: Number(obj.SALARIO || 0),
          beneficios: Number(obj.BENEFICIOS || 0),
          descontos: Number(obj.DESCONTOS || 0),
          dependentes: Number(obj.DEPENDENTES || 0),
          aniversario: rh_formatarData_(obj.ANIVERSARIO),
          email: String(obj.EMAIL || ""),
          matricula: String(obj.MATRICULA || ""),
          cbo: String(obj.CBO || ""),
          centroCusto: String(obj.CENTRO_CUSTO || ""),
          filial: String(obj.FILIAL || ""),
          admissao: rh_formatarData_(obj.ADMISSAO),
          cpf: String(obj.CPF || ""),
          departamento: String(obj.DEPARTAMENTO || "")
        };
      })
      .filter(function (x) { return !!x.id; });
  } catch (e) {
    Logger.log("listarColaboradoresRH_interno_ erro: " + e.message);
    return [];
  }
}

function salvarColaboradorRH(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", false);
  try {
    dados = dados || {};
    var nome = String(dados.nome || "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o nome do colaborador." };

    var sh = rh_garantirColaboradores_();
    var mapa = rh_mapaCabecalho_(sh);
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();
    var idAlvo = String(dados.id || "").trim();

    var campos = {
      NOME: nome,
      CARGO: String(dados.cargo || "").trim(),
      SETOR: String(dados.setor || "Administrativo"),
      STATUS: String(dados.status || "Ativo"),
      VENCIMENTO: dados.vencimento || "",
      SALARIO: Number(dados.salario || 0),
      BENEFICIOS: Number(dados.beneficios || 0),
      DESCONTOS: Number(dados.descontos || 0),
      DEPENDENTES: Number(dados.dependentes || 0),
      ANIVERSARIO: dados.aniversario || "",
      EMAIL: String(dados.email || "").trim(),
      MATRICULA: String(dados.matricula || "").trim(),
      CBO: String(dados.cbo || "").trim(),
      CENTRO_CUSTO: String(dados.centroCusto || "").trim(),
      FILIAL: String(dados.filial || "").trim(),
      ADMISSAO: dados.admissao || "",
      DEPARTAMENTO: String(dados.departamento || "").trim(),
      CPF: String(dados.cpf || "").trim()
    };

    function escreverCampos(linha) {
      Object.keys(campos).forEach(function (chave) {
        if (mapa[chave]) sh.getRange(linha, mapa[chave]).setValue(campos[chave]);
      });
    }

    if (idAlvo) {
      var idCol = mapa["ID"] || 1;
      var idsCol = sh.getLastRow() > 1 ? sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues() : [];
      for (var i = 0; i < idsCol.length; i++) {
        if (String(idsCol[i][0]) === idAlvo) {
          var linha = i + 2;
          escreverCampos(linha);
          if (mapa["ATUALIZADO_POR"]) sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
          if (mapa["ATUALIZADO_EM"]) sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(agora);
          return { ok: true, id: idAlvo, mensagem: "Colaborador atualizado com sucesso." };
        }
      }
      // ID informado não existe mais (linha removida por outra pessoa) — cadastra como novo.
    }

    var novoId = rh_gerarId_("COL");
    var novaLinha = sh.getLastRow() + 1;
    sh.getRange(novaLinha, mapa["ID"] || 1).setValue(novoId);
    escreverCampos(novaLinha);
    if (mapa["CRIADO_POR"]) sh.getRange(novaLinha, mapa["CRIADO_POR"]).setValue(quem);
    if (mapa["CRIADO_EM"]) sh.getRange(novaLinha, mapa["CRIADO_EM"]).setValue(agora);
    if (mapa["ATUALIZADO_POR"]) sh.getRange(novaLinha, mapa["ATUALIZADO_POR"]).setValue(quem);
    if (mapa["ATUALIZADO_EM"]) sh.getRange(novaLinha, mapa["ATUALIZADO_EM"]).setValue(agora);
    return { ok: true, id: novoId, mensagem: "Colaborador cadastrado com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar colaborador: " + e.message };
  }
}

/* =========================================
 * REAJUSTE SALARIAL (convenção coletiva / dissídio) — aplica um
 * percentual único sobre o salário-base de todos os colaboradores
 * ATIVOS (mesmo filtro de "quem entra na folha" usado em
 * prepararFolhaRH — desligado não recebe reajuste). O sistema calcula
 * o novo salário sozinho (salário atual × (1 + percentual/100),
 * arredondado a 2 casas) — quem aplica só informa o percentual e uma
 * referência (ex.: "CCT 2026", "Dissídio 08/2026"). Cada reajuste fica
 * registrado em RH_HISTORICO_REAJUSTES (salário antes/depois, quem
 * aplicou, quando) — nunca sobrescreve sem deixar rastro.
 * ========================================= */

var ABA_RH_HISTORICO_REAJUSTES = "RH_HISTORICO_REAJUSTES";

function rh_garantirHistoricoReajustes_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_HISTORICO_REAJUSTES);
  if (!sh) sh = ss.insertSheet(ABA_RH_HISTORICO_REAJUSTES);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "COLABORADOR_ID", "NOME", "SALARIO_ANTERIOR", "SALARIO_NOVO",
      "PERCENTUAL", "REFERENCIA", "APLICADO_POR", "APLICADO_EM"
    ]);
    sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Público — exige administrador (reajusta salário de todo mundo de uma vez).
function aplicarReajusteSalarialRH(percentual, referencia, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", true);
  return rh_comLock_(function () {
  try {
    percentual = Number(percentual);
    if (!isFinite(percentual) || percentual === 0) return { ok: false, mensagem: "Informe um percentual válido (diferente de zero)." };
    referencia = String(referencia || "").trim();
    if (!referencia) return { ok: false, mensagem: "Informe a referência do reajuste (ex.: CCT 2026)." };

    var sh = rh_garantirColaboradores_();
    var mapa = rh_mapaCabecalho_(sh);
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: false, mensagem: "Nenhum colaborador cadastrado ainda." };

    var dados = sh.getRange(2, 1, ultimaLinha - 1, sh.getLastColumn()).getValues();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();

    var shHist = rh_garantirHistoricoReajustes_();
    var linhasHist = [];
    var aplicados = [];

    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      var status = String(linha[mapa["STATUS"] - 1] || "Ativo");
      if (status === "Desligado") continue;

      var salarioAtual = Number(linha[mapa["SALARIO"] - 1] || 0);
      if (!salarioAtual) continue; // sem salário cadastrado — nada pra reajustar

      var salarioNovo = Math.round(salarioAtual * (1 + percentual / 100) * 100) / 100;
      var numLinha = i + 2;
      var colaboradorId = String(linha[mapa["ID"] - 1] || "");
      var nome = String(linha[mapa["NOME"] - 1] || "");

      sh.getRange(numLinha, mapa["SALARIO"]).setValue(salarioNovo);
      if (mapa["ATUALIZADO_POR"]) sh.getRange(numLinha, mapa["ATUALIZADO_POR"]).setValue(quem);
      if (mapa["ATUALIZADO_EM"]) sh.getRange(numLinha, mapa["ATUALIZADO_EM"]).setValue(agora);

      linhasHist.push([
        rh_gerarId_("REAJ"), colaboradorId, nome, salarioAtual, salarioNovo,
        percentual, referencia, quem, agora
      ]);
      aplicados.push(nome + " (R$ " + salarioAtual.toFixed(2) + " → R$ " + salarioNovo.toFixed(2) + ")");
    }

    if (linhasHist.length) {
      shHist.getRange(shHist.getLastRow() + 1, 1, linhasHist.length, linhasHist[0].length).setValues(linhasHist);
    }

    Logger.log("[RH] Reajuste salarial " + percentual + "% (" + referencia + ") — aplicados: " + (aplicados.join(", ") || "nenhum"));
    return {
      ok: true,
      aplicados: aplicados,
      mensagem: aplicados.length
        ? "Reajuste de " + percentual + "% aplicado a " + aplicados.length + " colaborador(es)."
        : "Nenhum colaborador ativo com salário cadastrado para reajustar."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao aplicar reajuste salarial: " + e.message };
  }
  });
}

// Exclusão exige administrador — dado sensível (salário) sem trilha de
// recuperação, mesmo padrão de excluirReceita/excluirEscolasEmLote.
function excluirColaboradorRH(id, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", true);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Informe o colaborador a excluir." };

    var sh = rh_garantirColaboradores_();
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Colaborador não encontrado." };

    var idsCol = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = idsCol.length - 1; i >= 0; i--) {
      if (String(idsCol[i][0]) === id) {
        sh.deleteRow(i + 2);
        return { ok: true, mensagem: "Colaborador excluído com sucesso." };
      }
    }
    return { ok: false, mensagem: "Colaborador não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao excluir colaborador: " + e.message };
  }
}

/* =========================================
 * FOLHA DE PAGAMENTO — um lançamento por colaborador por competência.
 * Reprocessar uma competência substitui só os lançamentos DAQUELA
 * competência, preservando o histórico dos meses anteriores.
 * ========================================= */

// Passo 1: monta a prévia para revisão — inclui dias do mês da
// competência e sugestão de dias trabalhados (mês cheio), que quem
// gera a folha pode ajustar antes de confirmar (férias/afastamento).
function prepararFolhaRH(competencia, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência." };

    var diasMes = rh_diasNoMes_(competencia);
    var colaboradores = listarColaboradoresRH_interno_().filter(function (c) { return c.status !== "Desligado"; });

    return {
      ok: true,
      competencia: competencia,
      diasMes: diasMes,
      itens: colaboradores.map(function (c) {
        return {
          colaboradorId: c.id, nome: c.nome, cargo: c.cargo, status: c.status,
          salario: c.salario, beneficios: c.beneficios, descontos: c.descontos, dependentes: c.dependentes,
          diasTrabalhadosSugerido: diasMes,
          rubricasFixas: rh_listarRubricasFixasColaborador_interno_(c.id).filter(function (f) { return f.ativo; })
        };
      })
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao preparar folha: " + e.message };
  }
}

// Passo 2: grava de fato. itens = [{ colaboradorId, diasTrabalhados }],
// vindos da revisão do passo 1 (com eventual ajuste manual de dias).
/**
 * Trava de concorrência para as operações que reescrevem folha ou salário.
 *
 * Achado da auditoria do módulo RH: nenhum arquivo do RH usava LockService,
 * enquanto Despesas, Conciliação, Taxas e Parque do China já usavam. Sem trava,
 * duas pessoas gerando a folha da mesma competência ao mesmo tempo podem
 * intercalar apagar-e-gravar, produzindo folha com colaborador faltando ou
 * duplicado — erro que só aparece quando alguém reclama que não recebeu.
 */
function rh_comLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return { ok: false, mensagem: "Outra operação de folha está em andamento. Aguarde alguns segundos e tente novamente." };
  }
  try { return fn(); } finally { lock.releaseLock(); }
}

var ABA_RH_FOLHA_HISTORICO = "RH_FOLHA_HISTORICO";

function rh_garantirFolhaHistorico_(cabecalhoFolha) {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_FOLHA_HISTORICO);
  if (!sh) {
    sh = ss.insertSheet(ABA_RH_FOLHA_HISTORICO);
    var cab = ["DATA_SUBSTITUICAO", "SUBSTITUIDO_POR", "MOTIVO"].concat(cabecalhoFolha || []);
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Guarda as linhas que estão prestes a ser apagadas. Sem isto, regerar uma
 * folha já conferida descartava silenciosamente o trabalho anterior — sem
 * aviso, sem cópia e sem registro de quem regerou. Nunca lança erro: falha ao
 * arquivar não pode impedir a operação em si, mas fica no log.
 */
function rh_arquivarFolhaSubstituida_(linhas, cabecalho, quem, motivo) {
  try {
    if (!linhas || !linhas.length) return 0;
    var sh = rh_garantirFolhaHistorico_(cabecalho);
    var agora = new Date();
    var out = linhas.map(function (l) { return [agora, quem || "", motivo || ""].concat(l); });
    sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
    return out.length;
  } catch (e) {
    Logger.log("rh_arquivarFolhaSubstituida_ (não bloqueia a operação): " + e);
    return 0;
  }
}

/**
 * Quantos lançamentos já existem numa competência. A tela chama antes de gerar
 * para poder avisar que a folha será substituída.
 */
function contarFolhaCompetenciaRH(competencia, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: true, existentes: 0 };
    var sh = rh_garantirFolha_();
    if (sh.getLastRow() < 2) return { ok: true, existentes: 0 };
    var dados = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    var n = 0;
    dados.forEach(function (l) { if (String(l[0]) === competencia) n++; });
    return { ok: true, existentes: n, competencia: competencia };
  } catch (e) {
    return { ok: false, mensagem: e.message, existentes: 0 };
  }
}

function gerarFolhaRH(competencia, itens, observacao, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "rh", false);
  var resultado = rh_comLock_(function () {
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência." };
    if (!Array.isArray(itens) || !itens.length) return { ok: false, mensagem: "Nenhum colaborador para gerar a folha." };

    var diasMes = rh_diasNoMes_(competencia);
    var cfg = rh_obterConfigTributaria_();
    var colaboradores = listarColaboradoresRH_interno_();
    var mapaColab = {};
    colaboradores.forEach(function (c) { mapaColab[c.id] = c; });

    var mapaCatalogoRubricas = {};
    rh_listarRubricas_interno_().forEach(function (r) { mapaCatalogoRubricas[r.id] = r; });

    var sh = rh_garantirFolha_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();

    // Antes de apagar, guarda o que será substituído: regerar uma folha já
    // conferida não pode descartar o trabalho anterior sem deixar rastro.
    var substituidos = 0;
    if (sh.getLastRow() > 1) {
      var cabecalhoFolha = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var existentes = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      var aArquivar = existentes.filter(function (l) { return String(l[1]) === competencia; });
      if (aArquivar.length) {
        rh_arquivarFolhaSubstituida_(aArquivar, cabecalhoFolha, quem,
          "Folha regerada para a competência " + competencia);
      }
      for (var i = existentes.length - 1; i >= 0; i--) {
        if (String(existentes[i][1]) === competencia) { sh.deleteRow(i + 2); substituidos++; }
      }
    }

    // Rubricas extras de cada item só são gravadas em RH_FOLHA_RUBRICAS
    // depois que a linha da folha já existe (precisa do folhaId) —
    // por isso a lista fica pendente aqui e é processada após o append.
    var pendentesRubricas = [];

    var linhas = [];
    itens.forEach(function (item) {
      var c = mapaColab[item.colaboradorId];
      if (!c) return; // colaborador removido entre a prévia e a confirmação

      var diasTrabalhados = Math.max(0, Math.min(diasMes, Number(item.diasTrabalhados)));
      if (!isFinite(diasTrabalhados)) diasTrabalhados = diasMes;
      var fatorProrata = diasMes > 0 ? diasTrabalhados / diasMes : 0;

      var salarioProrata = Math.round(c.salario * fatorProrata * 100) / 100;
      var inss = rh_calcularInss_(salarioProrata, cfg.inss);
      var baseIrrf = Math.max(0, salarioProrata - inss - (c.dependentes * cfg.deducaoDependente));
      var irrf = rh_calcularIrrf_(baseIrrf, cfg.irrf);
      var fgtsPatronal = Math.round(salarioProrata * (cfg.fgtsPatronalPct / 100) * 100) / 100;

      // Rubricas fixas do colaborador (Abono CCT, Quinquênio, Decênio,
      // Insalubridade, Prêmio Mérito etc.) entram automaticamente em toda
      // folha nova — quem gera a folha só digita rubrica VARIÁVEL daquele
      // mês (hora extra, diferença salarial pontual etc.). Se a mesma
      // rubricaId também vier digitada manualmente neste lançamento, o
      // valor digitado agora prevalece sobre o valor fixo cadastrado.
      var rubricaIdsInformadosManualmente = {};
      (item.rubricasExtras || []).forEach(function (r) {
        if (r && r.rubricaId) rubricaIdsInformadosManualmente[String(r.rubricaId)] = true;
      });
      var rubricasFixasParaAplicar = rh_listarRubricasFixasColaborador_interno_(c.id)
        .filter(function (f) { return f.ativo && !rubricaIdsInformadosManualmente[f.rubricaId]; })
        .map(function (f) { return { rubricaId: f.rubricaId, referencia: "Fixo", valor: f.valor }; });
      item.rubricasExtras = rubricasFixasParaAplicar.concat(item.rubricasExtras || []);

      // Rubricas extras (motor de rubricas): somam/descontam do bruto e
      // do líquido, mas NÃO entram na base de INSS/IRRF/FGTS acima —
      // simplificação deliberada, ver cabeçalho de RHRubricas.gs.
      var proventosExtra = 0, descontosExtra = 0;
      if (Array.isArray(item.rubricasExtras) && item.rubricasExtras.length) {
        item.rubricasExtras.forEach(function (r) {
          var catalogo = mapaCatalogoRubricas[String((r && r.rubricaId) || "").trim()];
          if (!catalogo || !catalogo.ativo) return;
          var valor = Math.round(Number((r && r.valor) || 0) * 100) / 100;
          if (catalogo.tipo === "Desconto") descontosExtra += valor; else proventosExtra += valor;
        });
      }

      var folhaId = rh_gerarId_("FOLHA");
      var bruto = salarioProrata + c.beneficios + proventosExtra;
      var liquido = bruto - c.descontos - inss - irrf - descontosExtra;

      linhas.push([
        folhaId, competencia, c.id, c.nome, c.cargo, c.dependentes,
        c.salario, c.beneficios, c.descontos,
        diasTrabalhados, diasMes, salarioProrata,
        inss, baseIrrf, irrf, fgtsPatronal,
        bruto, liquido,
        observacao || "", quem, agora,
        proventosExtra, descontosExtra
      ]);

      if (Array.isArray(item.rubricasExtras) && item.rubricasExtras.length) {
        pendentesRubricas.push({ folhaId: folhaId, colaboradorId: c.id, rubricasExtras: item.rubricasExtras });
      }
    });

    if (linhas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    }

    pendentesRubricas.forEach(function (p) {
      try {
        rh_gravarFolhaRubricas_(p.folhaId, competencia, p.colaboradorId, p.rubricasExtras, mapaCatalogoRubricas);
      } catch (eRub) {
        Logger.log("[RH] falha ao gravar rubricas extras do lançamento " + p.folhaId + ": " + eRub.message);
      }
    });

    var linhasObj = linhas.map(rh_linhaFolhaParaObjeto_);

    return {
      ok: true,
      competencia: competencia,
      linhas: linhasObj,
      mensagem: "Folha de " + competencia + " gerada com " + linhas.length + " colaborador(es)."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar folha: " + e.message };
  }
  });

  // Fecha o ciclo com o Financeiro: registra o custo total da folha como
  // despesa (Fase 4).
  //
  // ⚠️ ISTO PRECISA ACONTECER FORA DO rh_comLock_ ACIMA. O caminho
  // registrarLancamentoDespesa -> registrarLancamentoDespesa_ ->
  // gerarNumeroDespesa_ pede o PRÓPRIO LockService.getScriptLock(). Se
  // esta chamada ficasse dentro do nosso lock, o pedido de dentro
  // esperaria 30s por um lock que só seria liberado quando ela mesma
  // terminasse — a despesa nunca seria criada. E como a chamada é
  // best-effort (try/catch com Logger), a folha salvaria normalmente e o
  // lançamento no Financeiro sumiria em silêncio. Mesmo cuidado já
  // tomado em ConciliacaoCore.gs.
  //
  // Best-effort de propósito: a folha já está gravada neste ponto, uma
  // falha aqui não pode desfazer o que já foi confirmado. Reprocessar a
  // mesma competência gera uma NOVA despesa (não substitui a anterior);
  // se isso acontecer, cancele/estorne a duplicada na tela de Despesas.
  if (resultado && resultado.ok && resultado.linhas && resultado.linhas.length) {
    try {
      rh_registrarDespesaFolha_(resultado.competencia, resultado.linhas, tokenSessao);
    } catch (eDesp) {
      Logger.log("[RH] falha ao registrar despesa da folha (" + resultado.competencia + "): " + eDesp.message);
    }
  }

  return resultado;
}

// Custo total da folha (Fase 4): bruto de todos os colaboradores + FGTS
// patronal — é o desembolso real do sindicato no período (líquido pago ao
// colaborador + INSS/IRRF retidos e recolhidos + FGTS depositado), não só
// o que cai na conta de cada um. Vira um único lançamento em Despesas.
function rh_registrarDespesaFolha_(competencia, linhasObj, tokenSessao) {
  var totalBruto = 0, totalFgts = 0;
  linhasObj.forEach(function (l) { totalBruto += l.bruto; totalFgts += l.fgtsPatronal; });
  var totalDespesa = Math.round((totalBruto + totalFgts) * 100) / 100;
  if (totalDespesa <= 0) return;

  var diasMes = rh_diasNoMes_(competencia);
  var dataVencimento = competencia + "-" + String(diasMes).padStart(2, "0");

  if (typeof registrarLancamentoDespesa !== "function") {
    Logger.log("[RH] registrarLancamentoDespesa não disponível — despesa da folha " + competencia + " não registrada.");
    return;
  }

  registrarLancamentoDespesa({
    tipoLancamento: (typeof TIPO_LANCAMENTO_DESP !== "undefined" ? TIPO_LANCAMENTO_DESP.AVULSO : "avulso"),
    categoria: "Folha de Pagamento",
    prestadorNome: "Folha de Pagamento — " + competencia,
    descricao: "Custo total da folha de pagamento dos colaboradores do sindicato — competência " + competencia +
      " (" + linhasObj.length + " colaborador(es); inclui FGTS patronal).",
    valor: totalDespesa,
    dataVencimento: dataVencimento,
    quemAgendou: "Automático",
    observacoes: "Gerado automaticamente ao fechar a folha de RH. Reprocessar a competência cria uma nova despesa — cancele a anterior se for o caso.",
    confirmarDuplicidade: true
  }, tokenSessao);
}

function rh_linhaFolhaParaObjeto_(l) {
  return {
    id: l[0], competencia: l[1], colaboradorId: l[2], nome: l[3], cargo: l[4], dependentes: Number(l[5] || 0),
    salario: Number(l[6] || 0), beneficios: Number(l[7] || 0), descontos: Number(l[8] || 0),
    diasTrabalhados: Number(l[9] || 0), diasMes: Number(l[10] || 0), salarioProrata: Number(l[11] || 0),
    inss: Number(l[12] || 0), baseIrrf: Number(l[13] || 0), irrf: Number(l[14] || 0), fgtsPatronal: Number(l[15] || 0),
    bruto: Number(l[16] || 0), liquido: Number(l[17] || 0),
    observacao: String(l[18] || ""), geradoPor: String(l[19] || ""), geradoEm: rh_formatarData_(l[20]),
    proventosExtra: Number(l[21] || 0), descontosExtra: Number(l[22] || 0)
  };
}

function listarFolhaRH(competencia, tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  try {
    competencia = String(competencia || "").trim();
    var sh = rh_garantirFolha_();
    if (sh.getLastRow() < 2) return [];

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    return dados
      .filter(function (l) { return !competencia || String(l[1]) === competencia; })
      .map(rh_linhaFolhaParaObjeto_);
  } catch (e) {
    Logger.log("listarFolhaRH erro: " + e.message);
    return [];
  }
}

// Exclui TODOS os lançamentos de uma competência (folha + rubricas
// extras associadas) — pensado para permitir testar o motor de
// rubricas/folha (ex.: competência fictícia "2099-01") sem deixar
// lixo permanente na planilha. Admin-only, mesmo critério de
// excluirColaboradorRH (dado financeiro sensível).
//
// IMPORTANTE: isto NÃO reverte a Despesa que gerarFolhaRH cria
// automaticamente para a competência (rh_registrarDespesaFolha_) — a
// exclusão de um lançamento financeiro exige revisão humana, não é
// seguro fazer em cascata sem confirmação. Se a competência excluída
// tinha uma despesa gerada, cancele/estorne manualmente na tela de
// Despesas.
function excluirFolhaCompetenciaRH(competencia, tokenSessao) {
  var sessaoExcl = exigirModulo_(tokenSessao, "rh", true);
  return rh_comLock_(function () {
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência a excluir." };

    var sh = rh_garantirFolha_();
    var removidos = 0;
    if (sh.getLastRow() > 1) {
      var cabExcl = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      // Excluir folha é irreversível pela tela: guarda cópia antes de apagar.
      var arquivar = dados.filter(function (l) { return String(l[1]) === competencia; });
      if (arquivar.length) {
        rh_arquivarFolhaSubstituida_(arquivar, cabExcl,
          (sessaoExcl && (sessaoExcl.nome || sessaoExcl.usuario)) || "SISGEP",
          "Folha excluída da competência " + competencia);
      }
      for (var i = dados.length - 1; i >= 0; i--) {
        if (String(dados[i][1]) === competencia) { sh.deleteRow(i + 2); removidos++; }
      }
    }

    if (!removidos) return { ok: false, mensagem: "Nenhum lançamento encontrado para a competência " + competencia + "." };

    if (typeof rh_garantirFolhaRubricas_ === "function") {
      var shRub = rh_garantirFolhaRubricas_();
      if (shRub.getLastRow() > 1) {
        var dadosRub = shRub.getRange(2, 1, shRub.getLastRow() - 1, shRub.getLastColumn()).getValues();
        for (var j = dadosRub.length - 1; j >= 0; j--) {
          if (String(dadosRub[j][2]) === competencia) shRub.deleteRow(j + 2);
        }
      }
    }

    return {
      ok: true,
      removidos: removidos,
      mensagem: removidos + " lançamento(s) da competência " + competencia + " excluído(s). " +
        "Se essa competência tinha gerado uma despesa automática, cancele/estorne manualmente na tela de Despesas — a exclusão da folha não reverte despesas já lançadas."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao excluir folha: " + e.message };
  }
  });
}

// Usado pelo gerador de holerite (RHDocumentos.gs) — busca um lançamento
// específico direto na planilha, não confia em valores vindos do cliente
// para montar um documento com dado financeiro.
function rh_buscarLancamentoFolhaPorId_(id) {
  var sh = rh_garantirFolha_();
  if (sh.getLastRow() < 2) return null;
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === String(id)) return rh_linhaFolhaParaObjeto_(dados[i]);
  }
  return null;
}
