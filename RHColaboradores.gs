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
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 16).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ["DEPENDENTES", "ANIVERSARIO", "EMAIL"].forEach(function (nomeCol) {
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
      "OBSERVACAO", "GERADO_POR", "GERADO_EM"
    ]);
    sh.getRange(1, 1, 1, 21).setFontWeight("bold");
    sh.setFrozenRows(1);
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
  exigirSessaoDocumentos_(tokenSessao, false);
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
  exigirSessaoDocumentos_(tokenSessao, true);
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
  exigirSessaoDocumentos_(tokenSessao, false);
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
          email: String(obj.EMAIL || "")
        };
      })
      .filter(function (x) { return !!x.id; });
  } catch (e) {
    Logger.log("listarColaboradoresRH_interno_ erro: " + e.message);
    return [];
  }
}

function salvarColaboradorRH(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
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
      EMAIL: String(dados.email || "").trim()
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

// Exclusão exige administrador — dado sensível (salário) sem trilha de
// recuperação, mesmo padrão de excluirReceita/excluirEscolasEmLote.
function excluirColaboradorRH(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
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
  exigirSessaoDocumentos_(tokenSessao, false);
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
          diasTrabalhadosSugerido: diasMes
        };
      })
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao preparar folha: " + e.message };
  }
}

// Passo 2: grava de fato. itens = [{ colaboradorId, diasTrabalhados }],
// vindos da revisão do passo 1 (com eventual ajuste manual de dias).
function gerarFolhaRH(competencia, itens, observacao, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência." };
    if (!Array.isArray(itens) || !itens.length) return { ok: false, mensagem: "Nenhum colaborador para gerar a folha." };

    var diasMes = rh_diasNoMes_(competencia);
    var cfg = rh_obterConfigTributaria_();
    var colaboradores = listarColaboradoresRH_interno_();
    var mapaColab = {};
    colaboradores.forEach(function (c) { mapaColab[c.id] = c; });

    var sh = rh_garantirFolha_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();

    if (sh.getLastRow() > 1) {
      var existentes = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = existentes.length - 1; i >= 0; i--) {
        if (String(existentes[i][1]) === competencia) sh.deleteRow(i + 2);
      }
    }

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

      var bruto = salarioProrata + c.beneficios;
      var liquido = bruto - c.descontos - inss - irrf;

      linhas.push([
        rh_gerarId_("FOLHA"), competencia, c.id, c.nome, c.cargo, c.dependentes,
        c.salario, c.beneficios, c.descontos,
        diasTrabalhados, diasMes, salarioProrata,
        inss, baseIrrf, irrf, fgtsPatronal,
        bruto, liquido,
        observacao || "", quem, agora
      ]);
    });

    if (linhas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    }

    var linhasObj = linhas.map(rh_linhaFolhaParaObjeto_);

    // Fecha o ciclo com o Financeiro: registra o custo total da folha como
    // despesa (Fase 4). Best-effort — a folha já está gravada nesse ponto,
    // uma falha aqui não pode desfazer o que já foi confirmado. Reprocessar
    // a mesma competência gera uma NOVA despesa (não substitui a anterior);
    // se isso acontecer, cancele/estorne a duplicada na tela de Despesas.
    if (linhasObj.length) {
      try {
        rh_registrarDespesaFolha_(competencia, linhasObj, tokenSessao);
      } catch (eDesp) {
        Logger.log("[RH] falha ao registrar despesa da folha (" + competencia + "): " + eDesp.message);
      }
    }

    return {
      ok: true,
      competencia: competencia,
      linhas: linhasObj,
      mensagem: "Folha de " + competencia + " gerada com " + linhas.length + " colaborador(es)."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar folha: " + e.message };
  }
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
    observacao: String(l[18] || ""), geradoPor: String(l[19] || ""), geradoEm: rh_formatarData_(l[20])
  };
}

function listarFolhaRH(competencia, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
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
