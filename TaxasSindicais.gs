// ============================================================================
// ARQUIVO: TaxasSindicais.gs
//
// Controle de recebimento da Taxa Negocial (CCT cl. 57) e da Taxa Assistencial
// (CCT cl. 58) — as duas fontes de receita do sindicato que tinham cobrança
// mas nenhum controle de quem pagou.
//
// Achado da auditoria: o sistema sabia EMITIR o ofício das duas taxas
// (TaxaAssistencial.gs, HelperOficios.gs), mas não havia onde registrar o
// recebimento. Toda referência a "taxa negocial" no código era sobre o
// documento, nunca sobre o dinheiro. Das 5 receitas do sindicato, essas duas
// eram as únicas sem controle de entrada.
//
// COMO AS DUAS SE CALCULAM (são diferentes — não unificar):
//   NEGOCIAL (cl. 57)     6% do salário, em 3 parcelas de 2%.
//                         ISENTOS os filiados ao SindEducação-ES.
//                         Base = soma dos salários dos NÃO filiados.
//                         Descontado do trabalhador, repassado pela escola.
//   ASSISTENCIAL (cl. 58) 4% da folha bruta, em 2 parcelas de 2%.
//                         Educação Infantil exclusiva: 2% em 2 parcelas de 1%.
//                         Base = folha bruta da escola. Pago pela escola.
//
// Alíquota e nº de parcelas ficam em PropertiesService, não no código: a CCT é
// renegociada todo ano e mudar percentual não pode exigir alterar programação.
// Os valores abaixo são os da CCT 2026/2027.
//
// O valor devido é calculado pelo sindicato a partir da base informada — a
// escola não define quanto repassa. Ao registrar o recebimento de uma parcela,
// o valor é espelhado em RECEITAS (cadastrarReceita), fechando o ciclo: com
// isto, as 5 fontes de receita do sindicato passam a chegar ao Financeiro.
// ============================================================================

var ABA_TAXAS = "TAXAS_SINDICAIS";

var TAXA_CABECALHO = [
  "ID", "ESCOLA", "CNPJ", "COMPETENCIA", "TIPO", "MODALIDADE",
  "BASE_CALCULO", "ALIQUOTA_TOTAL_PCT", "VALOR_TOTAL",
  "PARCELA", "TOTAL_PARCELAS", "VALOR_PARCELA", "VENCIMENTO",
  "VALOR_RECEBIDO", "STATUS", "DATA_RECEBIMENTO", "FORMA_RECEBIMENTO",
  "OBSERVACAO", "CRIADO_POR", "DATA_CRIACAO"
];

var TAXA_TIPO = { NEGOCIAL: "NEGOCIAL", ASSISTENCIAL: "ASSISTENCIAL" };

var TAXA_STATUS = {
  ABERTA:   "ABERTA",
  PARCIAL:  "PARCIAL",
  PAGA:     "PAGA",
  CANCELADA:"CANCELADA"
};

// Chaves de configuração (PropertiesService) e padrões da CCT 2026/2027.
var TAXA_CFG_CHAVE = "SISGEP_TAXAS_CONFIG";

var TAXA_CFG_PADRAO = {
  NEGOCIAL:          { aliquota: 6, parcelas: 3, rotulo: "Taxa Negocial — CCT cl. 57" },
  ASSISTENCIAL:      { aliquota: 4, parcelas: 2, rotulo: "Taxa Assistencial — CCT cl. 58" },
  ASSISTENCIAL_INF:  { aliquota: 2, parcelas: 2, rotulo: "Taxa Assistencial — Ed. Infantil exclusiva" }
};

/* ================= INFRA ================= */

function taxa_aba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_TAXAS);
  if (!sh) {
    sh = ss.insertSheet(ABA_TAXAS);
    sh.appendRow(TAXA_CABECALHO);
    sh.getRange(1, 1, 1, TAXA_CABECALHO.length)
      .setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

function taxa_mapa_(sh) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var m = {};
  cab.forEach(function (c, i) { m[String(c || "").trim()] = i; });
  return m;
}

function taxa_id_() {
  return "TXA-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function taxa_num_(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var s = String(v || "").trim().replace(/\s/g, "").replace("R$", "");
  if (!s) return 0;
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Arredonda para centavo — evita somar 0,004 mil vezes e fechar errado. */
function taxa_cent_(v) { return Math.round(Number(v || 0) * 100) / 100; }

/* ================= CONFIGURAÇÃO ================= */

function taxa_config_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(TAXA_CFG_CHAVE);
    if (raw) {
      var cfg = JSON.parse(raw);
      // Completa chave nova sem exigir reconfiguração manual.
      Object.keys(TAXA_CFG_PADRAO).forEach(function (k) {
        if (!cfg[k]) cfg[k] = TAXA_CFG_PADRAO[k];
      });
      return cfg;
    }
  } catch (e) {
    Logger.log("taxa_config_ (usando padrão da CCT): " + e);
  }
  return TAXA_CFG_PADRAO;
}

function taxa_obterConfig(tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  return taxa_config_();
}

function taxa_salvarConfig(config, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", true); // alterar alíquota é ato de administrador
  try {
    config = config || {};
    var novo = taxa_config_();
    ["NEGOCIAL", "ASSISTENCIAL", "ASSISTENCIAL_INF"].forEach(function (k) {
      if (!config[k]) return;
      var a = Number(config[k].aliquota), p = Number(config[k].parcelas);
      if (!(a > 0) || !(p > 0)) throw new Error("Alíquota e número de parcelas devem ser maiores que zero em " + k + ".");
      novo[k] = { aliquota: a, parcelas: Math.round(p), rotulo: String(config[k].rotulo || novo[k].rotulo || k) };
    });
    PropertiesService.getScriptProperties().setProperty(TAXA_CFG_CHAVE, JSON.stringify(novo));
    return { ok: true, mensagem: "Configuração salva.", config: novo };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ================= GERAÇÃO DE PARCELAS ================= */

/**
 * Gera as parcelas de uma taxa para uma escola/competência.
 *
 * A base vem do relatório que a escola envia: para a NEGOCIAL, a soma dos
 * salários apenas dos NÃO filiados (os filiados são isentos pela cl. 57);
 * para a ASSISTENCIAL, a folha bruta.
 *
 * A última parcela absorve a diferença de arredondamento, para a soma das
 * parcelas bater exatamente com o valor total — sem isso, R$ 100,00 em 3
 * parcelas fecharia R$ 99,99.
 *
 * Idempotente por escola+competência+tipo: não gera duas vezes a mesma cobrança.
 */
function taxa_gerarParcelas(payload, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };

  try {
    payload = payload || {};
    var escola      = String(payload.escola || "").trim();
    var cnpj        = String(payload.cnpj || "").trim();
    var competencia = String(payload.competencia || "").trim();   // "MM/AAAA"
    var tipo        = String(payload.tipo || "").trim().toUpperCase();
    var edInfantil  = !!payload.educacaoInfantilExclusiva;
    var base        = taxa_num_(payload.baseCalculo);
    var vencimentos = Array.isArray(payload.vencimentos) ? payload.vencimentos : [];

    if (!escola)      return { ok: false, mensagem: "Informe a escola." };
    if (!competencia) return { ok: false, mensagem: "Informe a competência (MM/AAAA)." };
    if (tipo !== TAXA_TIPO.NEGOCIAL && tipo !== TAXA_TIPO.ASSISTENCIAL) {
      return { ok: false, mensagem: "Tipo inválido. Use NEGOCIAL ou ASSISTENCIAL." };
    }
    if (!(base > 0)) {
      return { ok: false, mensagem: tipo === TAXA_TIPO.NEGOCIAL
        ? "Informe a base de cálculo: soma dos salários dos empregados NÃO filiados (os filiados são isentos pela cláusula 57)."
        : "Informe a base de cálculo: folha bruta da escola." };
    }

    var cfg   = taxa_config_();
    var chave = (tipo === TAXA_TIPO.ASSISTENCIAL && edInfantil) ? "ASSISTENCIAL_INF" : tipo;
    var regra = cfg[chave] || TAXA_CFG_PADRAO[chave];

    var sh = taxa_aba_(), mapa = taxa_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];

    var jaExiste = dados.some(function (l) {
      return String(l[mapa["ESCOLA"]]).trim().toLowerCase() === escola.toLowerCase()
          && String(l[mapa["COMPETENCIA"]]).trim() === competencia
          && String(l[mapa["TIPO"]]).trim().toUpperCase() === tipo
          && String(l[mapa["STATUS"]]).trim() !== TAXA_STATUS.CANCELADA;
    });
    if (jaExiste) {
      return { ok: false, mensagem: "Já existem parcelas de " + tipo + " para " + escola +
               " na competência " + competencia + ". Cancele as anteriores antes de gerar de novo." };
    }

    var valorTotal = taxa_cent_(base * (regra.aliquota / 100));
    var nParc      = regra.parcelas;
    var valorParc  = taxa_cent_(valorTotal / nParc);

    var usuario = "";
    try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e) {}

    var linhas = [], acumulado = 0;
    for (var i = 1; i <= nParc; i++) {
      // Última parcela fecha a conta, absorvendo o arredondamento.
      var vp = (i === nParc) ? taxa_cent_(valorTotal - acumulado) : valorParc;
      acumulado = taxa_cent_(acumulado + vp);

      linhas.push([
        taxa_id_(), escola, cnpj, competencia, tipo,
        (chave === "ASSISTENCIAL_INF" ? "ED_INFANTIL_EXCLUSIVA" : "PADRAO"),
        base, regra.aliquota, valorTotal,
        i, nParc, vp, String(vencimentos[i - 1] || ""),
        0, TAXA_STATUS.ABERTA, "", "", "",
        usuario, new Date()
      ]);
    }

    sh.getRange(sh.getLastRow() + 1, 1, linhas.length, TAXA_CABECALHO.length).setValues(linhas);

    return {
      ok: true,
      mensagem: nParc + " parcela(s) gerada(s) para " + escola + " — " + regra.rotulo +
                ". Total: R$ " + valorTotal.toFixed(2).replace(".", ","),
      valorTotal: valorTotal, parcelas: nParc, aliquota: regra.aliquota
    };
  } catch (e) {
    Logger.log("taxa_gerarParcelas: " + e);
    return { ok: false, mensagem: "Erro ao gerar parcelas: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ================= LEITURA ================= */

function taxa_listar(tokenSessao, filtros) {
  exigirModulo_(tokenSessao, "financeiro", false);
  filtros = filtros || {};

  var sh = taxa_aba_();
  if (sh.getLastRow() < 2) return { ok: true, itens: [], resumo: taxa_resumoVazio_() };

  var mapa = taxa_mapa_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var itens = dados.map(function (l, i) {
    var devido   = taxa_num_(l[mapa["VALOR_PARCELA"]]);
    var recebido = taxa_num_(l[mapa["VALOR_RECEBIDO"]]);
    return {
      linha: i + 2,
      id: String(l[mapa["ID"]] || ""),
      escola: String(l[mapa["ESCOLA"]] || ""),
      cnpj: String(l[mapa["CNPJ"]] || ""),
      competencia: String(l[mapa["COMPETENCIA"]] || ""),
      tipo: String(l[mapa["TIPO"]] || ""),
      modalidade: String(l[mapa["MODALIDADE"]] || ""),
      baseCalculo: taxa_num_(l[mapa["BASE_CALCULO"]]),
      aliquota: taxa_num_(l[mapa["ALIQUOTA_TOTAL_PCT"]]),
      valorTotal: taxa_num_(l[mapa["VALOR_TOTAL"]]),
      parcela: Number(l[mapa["PARCELA"]] || 0),
      totalParcelas: Number(l[mapa["TOTAL_PARCELAS"]] || 0),
      valorParcela: devido,
      vencimento: String(l[mapa["VENCIMENTO"]] || ""),
      valorRecebido: recebido,
      saldo: taxa_cent_(devido - recebido),
      status: String(l[mapa["STATUS"]] || TAXA_STATUS.ABERTA),
      dataRecebimento: l[mapa["DATA_RECEBIMENTO"]] instanceof Date
        ? Utilities.formatDate(l[mapa["DATA_RECEBIMENTO"]], Session.getScriptTimeZone(), "dd/MM/yyyy")
        : String(l[mapa["DATA_RECEBIMENTO"]] || ""),
      formaRecebimento: String(l[mapa["FORMA_RECEBIMENTO"]] || ""),
      observacao: String(l[mapa["OBSERVACAO"]] || "")
    };
  }).filter(function (x) {
    if (filtros.tipo && x.tipo !== filtros.tipo) return false;
    if (filtros.competencia && x.competencia !== filtros.competencia) return false;
    if (filtros.escola && x.escola.toLowerCase().indexOf(String(filtros.escola).toLowerCase()) < 0) return false;
    return true;
  }).reverse();

  var r = taxa_resumoVazio_();
  itens.forEach(function (x) {
    if (x.status === TAXA_STATUS.CANCELADA) { r.canceladas++; return; }
    r.total++;
    r.devido   = taxa_cent_(r.devido + x.valorParcela);
    r.recebido = taxa_cent_(r.recebido + x.valorRecebido);
    if (x.status === TAXA_STATUS.PAGA) r.pagas++;
    else {
      r.abertas++;
      if (x.tipo === TAXA_TIPO.NEGOCIAL) r.abertasNegocial++; else r.abertasAssistencial++;
    }
  });
  r.aReceber = taxa_cent_(r.devido - r.recebido);

  return { ok: true, itens: itens, resumo: r };
}

function taxa_resumoVazio_() {
  return { total:0, pagas:0, abertas:0, canceladas:0, devido:0, recebido:0, aReceber:0,
           abertasNegocial:0, abertasAssistencial:0 };
}

/* ================= RECEBIMENTO ================= */

/**
 * Registra o recebimento de uma parcela. O valor é ABSOLUTO (total já recebido
 * naquela parcela), não incremento — mesmo contrato do Parque do China. Só a
 * diferença vira receita, para correção de valor não duplicar lançamento.
 *
 * O espelhamento em RECEITAS nunca derruba o registro do recebimento: se o
 * Financeiro falhar, o recebimento fica gravado e o erro vai para o log.
 */
function taxa_registrarRecebimento(payload, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };

  try {
    payload = payload || {};
    var id    = String(payload.id || "").trim();
    var valor = taxa_num_(payload.valorRecebido);
    if (!id) return { ok: false, mensagem: "Parcela não informada." };
    if (valor < 0) return { ok: false, mensagem: "O valor recebido não pode ser negativo." };

    var sh = taxa_aba_(), mapa = taxa_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var linha = -1;
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["ID"]]) === id) { linha = i + 2; break; }
    }
    if (linha < 0) return { ok: false, mensagem: "Parcela não encontrada." };

    var reg = dados[linha - 2];
    if (String(reg[mapa["STATUS"]]) === TAXA_STATUS.CANCELADA) {
      return { ok: false, mensagem: "Esta parcela está cancelada." };
    }

    var devido    = taxa_num_(reg[mapa["VALOR_PARCELA"]]);
    var anterior  = taxa_num_(reg[mapa["VALOR_RECEBIDO"]]);
    if (valor > devido + 0.009) {
      return { ok: false, mensagem: "O valor recebido (R$ " + valor.toFixed(2) +
               ") não pode ser maior que o valor da parcela (R$ " + devido.toFixed(2) + ")." };
    }

    var delta  = taxa_cent_(valor - anterior);
    var status = (valor >= devido - 0.009 && devido > 0) ? TAXA_STATUS.PAGA
               : (valor > 0 ? TAXA_STATUS.PARCIAL : TAXA_STATUS.ABERTA);

    sh.getRange(linha, mapa["VALOR_RECEBIDO"] + 1).setValue(valor);
    sh.getRange(linha, mapa["STATUS"] + 1).setValue(status);
    sh.getRange(linha, mapa["DATA_RECEBIMENTO"] + 1).setValue(
      payload.dataRecebimento ? String(payload.dataRecebimento) : (valor > 0 ? new Date() : ""));
    if (payload.formaRecebimento) sh.getRange(linha, mapa["FORMA_RECEBIMENTO"] + 1).setValue(String(payload.formaRecebimento));
    if (payload.observacao)       sh.getRange(linha, mapa["OBSERVACAO"] + 1).setValue(String(payload.observacao));

    // Espelha no Financeiro — só o que entrou a mais.
    if (delta > 0.009) {
      try {
        cadastrarReceita({
          tipo: (String(reg[mapa["TIPO"]]) === TAXA_TIPO.NEGOCIAL) ? "Taxa Negocial" : "Taxa Assistencial",
          categoria: "Contribuição sindical (CCT)",
          descricao: (String(reg[mapa["TIPO"]]) === TAXA_TIPO.NEGOCIAL ? "Taxa Negocial" : "Taxa Assistencial") +
                     " — parcela " + reg[mapa["PARCELA"]] + "/" + reg[mapa["TOTAL_PARCELAS"]] +
                     " — " + String(reg[mapa["ESCOLA"]] || ""),
          empresa: String(reg[mapa["ESCOLA"]] || ""),
          cnpj: String(reg[mapa["CNPJ"]] || ""),
          valor: delta,
          formaRecebimento: String(payload.formaRecebimento || ""),
          dataRecebimento: String(payload.dataRecebimento || ""),
          competencia: String(reg[mapa["COMPETENCIA"]] || ""),
          status: "RECEBIDO",
          observacoes: "Lançado automaticamente ao registrar o recebimento da parcela " + id +
                       " (base de cálculo R$ " + taxa_num_(reg[mapa["BASE_CALCULO"]]).toFixed(2) +
                       ", alíquota " + taxa_num_(reg[mapa["ALIQUOTA_TOTAL_PCT"]]) + "%)."
        }, tokenSessao);
      } catch (e) {
        Logger.log("taxa_registrarRecebimento/receita (não bloqueia o recebimento): " + e);
      }
    }

    return { ok: true, status: status, saldo: taxa_cent_(devido - valor),
             mensagem: status === TAXA_STATUS.PAGA ? "Parcela quitada." : "Recebimento registrado." };
  } catch (e) {
    Logger.log("taxa_registrarRecebimento: " + e);
    return { ok: false, mensagem: "Erro ao registrar: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Cancela uma parcela (erro de lançamento, escola isenta, renegociação). */
function taxa_cancelarParcela(payload, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", true); // cancelar cobrança é ato de administrador
  try {
    payload = payload || {};
    var id     = String(payload.id || "").trim();
    var motivo = String(payload.motivo || "").trim();
    if (!id)     return { ok: false, mensagem: "Parcela não informada." };
    if (!motivo) return { ok: false, mensagem: "Informe o motivo do cancelamento." };

    var sh = taxa_aba_(), mapa = taxa_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["ID"]]) !== id) continue;
      if (taxa_num_(dados[i][mapa["VALOR_RECEBIDO"]]) > 0) {
        return { ok: false, mensagem: "Esta parcela já teve recebimento registrado. Estorne o valor antes de cancelar." };
      }
      var usuario = "";
      try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e) {}
      sh.getRange(i + 2, mapa["STATUS"] + 1).setValue(TAXA_STATUS.CANCELADA);
      sh.getRange(i + 2, mapa["OBSERVACAO"] + 1).setValue("Cancelada por " + usuario + ": " + motivo);
      return { ok: true, mensagem: "Parcela cancelada." };
    }
    return { ok: false, mensagem: "Parcela não encontrada." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/** Competências distintas já lançadas, para o filtro da tela. */
function taxa_competencias(tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  var sh = taxa_aba_();
  if (sh.getLastRow() < 2) return [];
  var mapa = taxa_mapa_(sh);
  var col = sh.getRange(2, mapa["COMPETENCIA"] + 1, sh.getLastRow() - 1, 1).getValues();
  var vistos = {}, out = [];
  col.forEach(function (l) {
    var c = String(l[0] || "").trim();
    if (c && !vistos[c]) { vistos[c] = true; out.push(c); }
  });
  return out.sort().reverse();
}
