// ================================
// ARQUIVO: RHEventos.gs
// MÓDULO: RH — Eventos trabalhistas fora da folha mensal
//         (13º salário, férias e rescisão)
//
// POR QUE ESTE ARQUIVO EXISTE
// A auditoria do módulo RH encontrou a folha MENSAL bem construída
// (INSS progressivo real, IRRF com dedução por dependente, FGTS
// patronal, motor de rubricas, holerite em PDF, despesa automática no
// Financeiro) — e nada além dela. Os três eventos que representam o
// maior desembolso do ano e o maior risco de erro trabalhista não
// existiam em lugar nenhum do sistema:
//
//   • 13º salário  — maior pagamento isolado do ano, em 2 parcelas,
//                    com INSS/IRRF de tributação EXCLUSIVA na 2ª;
//   • Férias       — 1/3 constitucional e abono pecuniário (venda de
//                    até 1/3 dos dias), com incidências diferentes;
//   • Rescisão     — a conta mais cara de errar: aviso prévio
//                    proporcional, saldo de salário, férias vencidas e
//                    proporcionais, 13º proporcional e multa de 40%.
//
// Sem isso, esses três cálculos eram feitos à mão fora do sistema —
// que é exatamente onde erro de folha nasce.
//
// 🚨 LIMITE DECLARADO — ISTO É UMA CALCULADORA, NÃO É O CONTADOR
// O SISGEP calcula, documenta e guarda a memória de cálculo. Ele NÃO
// substitui a conferência do contador nem gera eSocial/FGTS Digital.
// Todo evento gravado aqui deve ser conferido antes do pagamento. As
// tabelas de INSS/IRRF vêm de rh_obterConfigTributaria_() (as mesmas da
// folha mensal, configuráveis em tela) — se estiverem desatualizadas,
// o resultado sai errado aqui também.
//
// REGRAS APLICADAS (e as escolhas feitas onde a lei admite leitura)
//  · Avos: conta o mês em que houve 15 dias ou mais trabalhados
//    (art. 1º, §1º da Lei 4.090/62 para o 13º; art. 146, parágrafo
//    único da CLT para férias proporcionais).
//  · 13º — 1ª parcela: 50% do valor integral, SEM INSS e SEM IRRF.
//    2ª parcela: valor integral menos o adiantamento, menos INSS
//    calculado sobre o valor INTEGRAL e IRRF de tributação exclusiva
//    (base própria, não soma com o salário do mês).
//  · Férias — o 1/3 constitucional das férias GOZADAS entra na base de
//    INSS (STF, RE 1.072.485, Tema 985). Já o abono pecuniário e o 1/3
//    sobre ele são indenizatórios: não sofrem INSS nem IRRF (art. 28,
//    §9º "e" 6 da Lei 8.212/91).
//  · Rescisão — aviso prévio indenizado NÃO sofre INSS (STJ, REsp
//    1.230.957, repetitivo) nem IRRF (Súmula 386 do STJ), mas SOFRE
//    FGTS (Súmula 305 do TST). Férias indenizadas (vencidas e
//    proporcionais) e seu 1/3 não sofrem INSS/IRRF/FGTS. Saldo de
//    salário e 13º proporcional sofrem os três, com bases de INSS e de
//    IRRF SEPARADAS entre si.
//  · Rescisão por justa causa: perde férias proporcionais e 13º
//    proporcional; férias VENCIDAS continuam devidas (Súmula 171 do
//    TST).
//  · Aviso prévio proporcional: 30 dias + 3 por ano completo de casa,
//    limitado a 90 (Lei 12.506/2011).
//
// O QUE NÃO ESTÁ MODELADO (deliberadamente, para não fingir precisão)
//  · Médias de horas extras/comissões/adicionais variáveis na base do
//    13º e das férias — quem lança informa a "base de cálculo", que vem
//    sugerida com o salário-base + rubricas fixas ativas e pode ser
//    ajustada à mão.
//  · Faltas injustificadas reduzindo o direito de férias (art. 130 da
//    CLT) — quem lança informa os dias de direito.
//  · Saldo da conta de FGTS: o sistema não tem acesso ao extrato da
//    Caixa. A base da multa de 40% é informada por quem lança (e o
//    sistema soma o FGTS da própria rescisão).
//
// INTEGRAÇÃO — o evento gravado vira automaticamente uma Despesa no
// Financeiro (mesma ponte já usada por rh_registrarDespesaFolha_), para
// que o desembolso apareça no fluxo de caixa sem digitação dupla.
// ================================

var ABA_RH_EVENTOS = "RH_EVENTOS";

var RH_EV_TIPOS = {
  DECIMO_1: "13_1PARCELA",
  DECIMO_2: "13_2PARCELA",
  FERIAS: "FERIAS",
  RESCISAO: "RESCISAO"
};

var RH_EV_ROTULOS = {
  "13_1PARCELA": "13º salário — 1ª parcela (adiantamento)",
  "13_2PARCELA": "13º salário — 2ª parcela",
  "FERIAS": "Férias",
  "RESCISAO": "Rescisão de contrato"
};

var RH_EV_MOTIVOS_RESCISAO = {
  SEM_JUSTA_CAUSA: "sem_justa_causa",
  PEDIDO_DEMISSAO: "pedido_demissao",
  JUSTA_CAUSA: "justa_causa",
  TERMINO_CONTRATO: "termino_contrato"
};

var RH_EV_ROTULO_MOTIVO = {
  "sem_justa_causa": "Dispensa sem justa causa",
  "pedido_demissao": "Pedido de demissão",
  "justa_causa": "Dispensa por justa causa",
  "termino_contrato": "Término de contrato por prazo determinado"
};

/* =========================================
 * PLANILHA
 * ========================================= */

function rhEv_garantir_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_EVENTOS);
  if (!sh) sh = ss.insertSheet(ABA_RH_EVENTOS);
  if (sh.getLastRow() === 0) {
    var cab = [
      "ID", "TIPO", "COLABORADOR_ID", "NOME", "CARGO", "CPF", "MATRICULA",
      "REFERENCIA", "DATA_EVENTO", "BASE_CALCULO", "AVOS",
      "TOTAL_PROVENTOS", "TOTAL_DESCONTOS", "INSS", "IRRF", "FGTS", "MULTA_FGTS", "LIQUIDO",
      "PARAMETROS_JSON", "DETALHE_JSON", "AVISOS",
      "OBSERVACAO", "STATUS", "GERADO_POR", "GERADO_EM",
      "ESTORNADO_POR", "ESTORNADO_EM", "MOTIVO_ESTORNO"
    ];
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/* =========================================
 * HELPERS DE DATA E ARREDONDAMENTO
 * ========================================= */

// Meio-dia evita que o fuso empurre a data para o dia anterior — o
// mesmo cuidado já tomado no resto do sistema ao ler campos <input type=date>.
function rhEv_data_(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate(), 12, 0, 0);
  var m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function rhEv_iso_(d) {
  if (!d) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function rhEv_br_(d) {
  var dt = (d instanceof Date) ? d : rhEv_data_(d);
  if (!dt) return "—";
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function rhEv_ar_(v) {
  var n = Number(v || 0);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function rhEv_somaDias_(d, dias) {
  var r = new Date(d.getTime());
  r.setDate(r.getDate() + Number(dias || 0));
  return r;
}

// Avos = meses do período com 15 dias ou mais trabalhados. É a mesma
// contagem para 13º (Lei 4.090/62) e para férias proporcionais (art.
// 146 da CLT), por isso uma função só.
function rhEv_contarAvos_(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;
  if (dataFim.getTime() < dataInicio.getTime()) return 0;

  var avos = 0;
  var cursor = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1, 12, 0, 0);
  var limite = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1, 12, 0, 0);

  while (cursor.getTime() <= limite.getTime()) {
    var primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12, 0, 0);
    var ultimo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12, 0, 0);
    var ini = dataInicio.getTime() > primeiro.getTime() ? dataInicio : primeiro;
    var fim = dataFim.getTime() < ultimo.getTime() ? dataFim : ultimo;
    var dias = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
    if (dias >= 15) avos++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12, 0, 0);
  }
  return Math.min(12, avos);
}

// Anos completos entre admissão e desligamento — usado no aviso prévio
// proporcional (3 dias por ano completo, Lei 12.506/2011).
function rhEv_anosCompletos_(admissao, ate) {
  if (!admissao || !ate) return 0;
  var anos = ate.getFullYear() - admissao.getFullYear();
  var aniversarioNoAno = new Date(ate.getFullYear(), admissao.getMonth(), admissao.getDate(), 12, 0, 0);
  if (ate.getTime() < aniversarioNoAno.getTime()) anos--;
  return Math.max(0, anos);
}

/* =========================================
 * BASE DE CÁLCULO SUGERIDA
 * ========================================= */

// Salário-base + rubricas FIXAS ativas do colaborador (Abono CCT,
// Quinquênio, Insalubridade etc.). É só uma SUGESTÃO: quem lança pode
// ajustar, porque médias de variáveis (hora extra, comissão) não estão
// modeladas — ver cabeçalho.
function rhEv_baseSugerida_(colaborador) {
  var base = Number(colaborador.salario || 0);
  var composicao = [{ descricao: "Salário-base", valor: base }];
  try {
    rh_listarRubricasFixasColaborador_interno_(colaborador.id).forEach(function (f) {
      if (!f.ativo) return;
      var valor = Number(f.valor || 0);
      if (!valor) return;
      // Desconto fixo (ex.: plano de saúde) não compõe base de 13º/férias.
      if (String(f.tipo || "") === "Desconto") return;
      base += valor;
      composicao.push({ descricao: f.descricao || f.codigo || "Rubrica fixa", valor: valor });
    });
  } catch (e) {
    Logger.log("[RH] rhEv_baseSugerida_ (usando só o salário-base): " + e.message);
  }
  return { base: rhEv_ar_(base), composicao: composicao };
}

/* =========================================
 * MOTOR 1 — 13º SALÁRIO
 * ========================================= */

/**
 * params: {
 *   colaboradorId, ano, base, avos (opcional — se vazio, calcula),
 *   parcela: 1|2, adiantamentoPago (só na 2ª), dataPagamento,
 *   dependentes (opcional — default o do cadastro)
 * }
 */
function rhEv_calcularDecimoTerceiro_(params, colaborador, cfg) {
  var avisos = [];
  var ano = Number(params.ano) || new Date().getFullYear();
  var parcela = Number(params.parcela) === 2 ? 2 : 1;

  var admissao = rhEv_data_(colaborador.admissao);
  var inicioAno = new Date(ano, 0, 1, 12, 0, 0);
  var fimAno = new Date(ano, 11, 31, 12, 0, 0);
  var inicio = (admissao && admissao.getTime() > inicioAno.getTime()) ? admissao : inicioAno;

  if (!admissao) avisos.push("Colaborador sem data de admissão no cadastro — os avos foram contados como ano inteiro (12/12). Confira.");

  var avos = params.avos === "" || params.avos === null || params.avos === undefined
    ? (admissao ? rhEv_contarAvos_(inicio, fimAno) : 12)
    : Math.max(0, Math.min(12, Number(params.avos)));

  var base = rhEv_ar_(params.base);
  if (base <= 0) return { ok: false, mensagem: "Informe a base de cálculo do 13º." };

  var dependentes = params.dependentes === "" || params.dependentes === null || params.dependentes === undefined
    ? Number(colaborador.dependentes || 0)
    : Math.max(0, Number(params.dependentes));

  var valorIntegral = rhEv_ar_(base / 12 * avos);
  var linhas = [];
  var inss = 0, irrf = 0, baseIrrf = 0, totalProventos = 0, totalDescontos = 0, baseFgts = 0;

  if (parcela === 1) {
    // 1ª parcela: metade do integral, sem nenhum desconto (art. 2º da
    // Lei 4.749/65). O INSS e o IRRF do 13º inteiro só saem na 2ª.
    var primeira = rhEv_ar_(valorIntegral / 2);
    linhas.push({
      codigo: "13-1", descricao: "13º salário — adiantamento (1ª parcela)",
      referencia: avos + "/12 avos · 50% de " + rhEv_ar_(valorIntegral),
      provento: primeira, desconto: 0
    });
    totalProventos = primeira;
    baseFgts = primeira;
    avisos.push("A 1ª parcela não sofre INSS nem IRRF — os dois incidem integralmente na 2ª parcela, sobre o valor cheio do 13º.");
  } else {
    var adiantamento = rhEv_ar_(params.adiantamentoPago);
    if (adiantamento > valorIntegral) {
      return { ok: false, mensagem: "O adiantamento informado (" + adiantamento + ") é maior que o 13º integral (" + valorIntegral + ")." };
    }
    if (!adiantamento) avisos.push("Nenhum adiantamento informado — a 2ª parcela está sendo calculada como se a 1ª não tivesse sido paga.");

    // INSS e IRRF do 13º são calculados sobre o valor INTEGRAL, em base
    // própria (tributação exclusiva na fonte) — não somam com o salário
    // do mês nem com as férias.
    inss = rh_calcularInss_(valorIntegral, cfg.inss);
    baseIrrf = Math.max(0, rhEv_ar_(valorIntegral - inss - (dependentes * cfg.deducaoDependente)));
    irrf = rh_calcularIrrf_(baseIrrf, cfg.irrf);

    var segunda = rhEv_ar_(valorIntegral - adiantamento);
    linhas.push({
      codigo: "13-2", descricao: "13º salário — 2ª parcela",
      referencia: avos + "/12 avos · integral " + rhEv_ar_(valorIntegral),
      provento: segunda, desconto: 0
    });
    if (adiantamento) {
      linhas.push({
        codigo: "13-AD", descricao: "(-) Adiantamento pago na 1ª parcela",
        referencia: "", provento: 0, desconto: 0, informativo: true, valorInformativo: adiantamento
      });
    }
    linhas.push({ codigo: "INSS13", descricao: "INSS sobre o 13º (base: valor integral)", referencia: rhEv_ar_(valorIntegral), provento: 0, desconto: inss });
    if (irrf) linhas.push({ codigo: "IRRF13", descricao: "IRRF sobre o 13º (tributação exclusiva)", referencia: baseIrrf, provento: 0, desconto: irrf });

    totalProventos = segunda;
    totalDescontos = rhEv_ar_(inss + irrf);
    baseFgts = segunda;
  }

  var fgts = rhEv_ar_(baseFgts * (cfg.fgtsPatronalPct / 100));

  return {
    ok: true,
    tipo: parcela === 1 ? RH_EV_TIPOS.DECIMO_1 : RH_EV_TIPOS.DECIMO_2,
    referencia: String(ano),
    dataEvento: params.dataPagamento || rhEv_iso_(new Date()),
    base: base, avos: avos, valorIntegral: valorIntegral,
    linhas: linhas,
    totalProventos: rhEv_ar_(totalProventos),
    totalDescontos: rhEv_ar_(totalDescontos),
    inss: inss, irrf: irrf, baseIrrf: baseIrrf, fgts: fgts,
    liquido: rhEv_ar_(totalProventos - totalDescontos),
    avisos: avisos
  };
}

/* =========================================
 * MOTOR 2 — FÉRIAS
 * ========================================= */

/**
 * params: {
 *   colaboradorId, base, periodoInicio, periodoFim (aquisitivo),
 *   inicioGozo, diasGozo, diasAbono, adiantar13 (bool),
 *   dependentes (opcional)
 * }
 */
function rhEv_calcularFerias_(params, colaborador, cfg) {
  var avisos = [];
  var base = rhEv_ar_(params.base);
  if (base <= 0) return { ok: false, mensagem: "Informe a base de cálculo das férias." };

  var diasGozo = Math.max(0, Math.min(30, Number(params.diasGozo || 0)));
  var diasAbono = Math.max(0, Math.min(10, Number(params.diasAbono || 0)));
  if (diasGozo + diasAbono === 0) return { ok: false, mensagem: "Informe os dias de gozo e/ou os dias de abono pecuniário." };
  if (diasGozo + diasAbono > 30) {
    return { ok: false, mensagem: "Dias de gozo (" + diasGozo + ") + dias de abono (" + diasAbono + ") passam de 30. Corrija antes de continuar." };
  }
  if (diasAbono > 10) avisos.push("O abono pecuniário é limitado a 1/3 do período (10 dias) — art. 143 da CLT.");
  if (diasGozo + diasAbono < 30) {
    avisos.push("Foram informados " + (diasGozo + diasAbono) + " dias de 30. Se o colaborador teve faltas que reduzem o direito (art. 130 da CLT), está correto; se não, confira.");
  }

  var dependentes = params.dependentes === "" || params.dependentes === null || params.dependentes === undefined
    ? Number(colaborador.dependentes || 0)
    : Math.max(0, Number(params.dependentes));

  var diario = base / 30;

  var remFerias = rhEv_ar_(diario * diasGozo);
  var tercoFerias = rhEv_ar_(remFerias / 3);
  var abono = rhEv_ar_(diario * diasAbono);
  var tercoAbono = rhEv_ar_(abono / 3);

  // Adiantamento de 13º pedido junto com as férias (art. 2º, §2º da
  // Lei 4.749/65): 50% do 13º do ano, calculado sobre a mesma base.
  var adiant13 = 0;
  if (params.adiantar13) {
    var admissao = rhEv_data_(colaborador.admissao);
    var anoRef = (rhEv_data_(params.inicioGozo) || new Date()).getFullYear();
    var iniAno = new Date(anoRef, 0, 1, 12, 0, 0);
    var fimAno = new Date(anoRef, 11, 31, 12, 0, 0);
    var ini13 = (admissao && admissao.getTime() > iniAno.getTime()) ? admissao : iniAno;
    var avos13 = admissao ? rhEv_contarAvos_(ini13, fimAno) : 12;
    adiant13 = rhEv_ar_(base / 12 * avos13 / 2);
    avisos.push("Adiantamento de 13º incluído (" + avos13 + "/12 avos do ano " + anoRef + "). Ele NÃO sofre INSS/IRRF agora — os dois saem na 2ª parcela do 13º, e este valor deve ser informado lá como adiantamento pago.");
  }

  // Base de INSS/IRRF: férias gozadas + o 1/3 sobre elas. O abono
  // pecuniário e o 1/3 dele são indenizatórios e ficam de fora, assim
  // como o adiantamento de 13º (que é tributado no próprio 13º).
  var baseInss = rhEv_ar_(remFerias + tercoFerias);
  var inss = rh_calcularInss_(baseInss, cfg.inss);
  var baseIrrf = Math.max(0, rhEv_ar_(baseInss - inss - (dependentes * cfg.deducaoDependente)));
  var irrf = rh_calcularIrrf_(baseIrrf, cfg.irrf);
  var fgts = rhEv_ar_(baseInss * (cfg.fgtsPatronalPct / 100));

  var linhas = [];
  if (remFerias) linhas.push({ codigo: "FER", descricao: "Férias — " + diasGozo + " dias de gozo", referencia: diasGozo + "/30", provento: remFerias, desconto: 0 });
  if (tercoFerias) linhas.push({ codigo: "FER13", descricao: "1/3 constitucional sobre as férias", referencia: "33,33%", provento: tercoFerias, desconto: 0 });
  if (abono) linhas.push({ codigo: "ABON", descricao: "Abono pecuniário — venda de " + diasAbono + " dias", referencia: diasAbono + "/30", provento: abono, desconto: 0 });
  if (tercoAbono) linhas.push({ codigo: "ABON13", descricao: "1/3 constitucional sobre o abono", referencia: "33,33%", provento: tercoAbono, desconto: 0 });
  if (adiant13) linhas.push({ codigo: "AD13", descricao: "Adiantamento do 13º salário (1ª parcela)", referencia: "50%", provento: adiant13, desconto: 0 });
  if (inss) linhas.push({ codigo: "INSS", descricao: "INSS sobre férias + 1/3", referencia: baseInss, provento: 0, desconto: inss });
  if (irrf) linhas.push({ codigo: "IRRF", descricao: "IRRF sobre férias + 1/3", referencia: baseIrrf, provento: 0, desconto: irrf });

  var totalProventos = rhEv_ar_(remFerias + tercoFerias + abono + tercoAbono + adiant13);
  var totalDescontos = rhEv_ar_(inss + irrf);

  var inicioGozo = rhEv_data_(params.inicioGozo);
  var fimGozo = inicioGozo && diasGozo ? rhEv_somaDias_(inicioGozo, diasGozo - 1) : null;
  var retorno = fimGozo ? rhEv_somaDias_(fimGozo, 1) : null;

  var referencia = (params.periodoInicio && params.periodoFim)
    ? rhEv_br_(params.periodoInicio) + " a " + rhEv_br_(params.periodoFim)
    : (inicioGozo ? "Gozo a partir de " + rhEv_br_(inicioGozo) : "—");

  return {
    ok: true,
    tipo: RH_EV_TIPOS.FERIAS,
    referencia: referencia,
    dataEvento: params.inicioGozo || rhEv_iso_(new Date()),
    base: base, avos: "",
    diasGozo: diasGozo, diasAbono: diasAbono,
    inicioGozo: rhEv_iso_(inicioGozo), fimGozo: rhEv_iso_(fimGozo), retorno: rhEv_iso_(retorno),
    linhas: linhas,
    totalProventos: totalProventos, totalDescontos: totalDescontos,
    inss: inss, irrf: irrf, baseIrrf: baseIrrf, baseInss: baseInss, fgts: fgts,
    liquido: rhEv_ar_(totalProventos - totalDescontos),
    avisos: avisos
  };
}

/* =========================================
 * MOTOR 3 — RESCISÃO
 * ========================================= */

/**
 * params: {
 *   colaboradorId, base, dataDesligamento, motivo,
 *   avisoPrevio: "indenizado" | "trabalhado" | "dispensado",
 *   feriasVencidasPeriodos (0,1,2...), saldoFgts (extrato, para a multa),
 *   dependentes (opcional)
 * }
 */
function rhEv_calcularRescisao_(params, colaborador, cfg) {
  var avisos = [];
  var base = rhEv_ar_(params.base);
  if (base <= 0) return { ok: false, mensagem: "Informe a base de cálculo da rescisão." };

  var desligamento = rhEv_data_(params.dataDesligamento);
  if (!desligamento) return { ok: false, mensagem: "Informe a data do desligamento." };

  var admissao = rhEv_data_(colaborador.admissao);
  if (!admissao) {
    return { ok: false, mensagem: "Este colaborador não tem data de admissão no cadastro. Sem ela não dá para calcular aviso prévio, férias proporcionais nem 13º proporcional — cadastre a admissão antes de rescindir." };
  }
  if (desligamento.getTime() < admissao.getTime()) {
    return { ok: false, mensagem: "A data do desligamento é anterior à admissão." };
  }

  var motivo = String(params.motivo || RH_EV_MOTIVOS_RESCISAO.SEM_JUSTA_CAUSA);
  if (!RH_EV_ROTULO_MOTIVO[motivo]) return { ok: false, mensagem: "Motivo de rescisão inválido." };

  var semJustaCausa = motivo === RH_EV_MOTIVOS_RESCISAO.SEM_JUSTA_CAUSA;
  var justaCausa = motivo === RH_EV_MOTIVOS_RESCISAO.JUSTA_CAUSA;
  var pedidoDemissao = motivo === RH_EV_MOTIVOS_RESCISAO.PEDIDO_DEMISSAO;

  var dependentes = params.dependentes === "" || params.dependentes === null || params.dependentes === undefined
    ? Number(colaborador.dependentes || 0)
    : Math.max(0, Number(params.dependentes));

  var diario = base / 30;
  var linhas = [];

  /* --- Saldo de salário --- */
  var diasSaldo = desligamento.getDate();
  var saldoSalario = rhEv_ar_(diario * diasSaldo);
  linhas.push({ codigo: "SALDO", descricao: "Saldo de salário", referencia: diasSaldo + "/30 dias", provento: saldoSalario, desconto: 0 });

  /* --- Aviso prévio (Lei 12.506/2011) --- */
  var anos = rhEv_anosCompletos_(admissao, desligamento);
  var avisoDias = Math.min(90, 30 + (anos * 3));
  var modoAviso = String(params.avisoPrevio || (semJustaCausa ? "indenizado" : "dispensado"));
  var avisoIndenizado = 0, avisoDescontado = 0;
  var dataProjetada = desligamento;

  if (semJustaCausa && modoAviso === "indenizado") {
    avisoIndenizado = rhEv_ar_(diario * avisoDias);
    // O aviso indenizado projeta o contrato: os avos de 13º e de férias
    // proporcionais contam até o fim do aviso (OJ 82 da SDI-1 do TST).
    dataProjetada = rhEv_somaDias_(desligamento, avisoDias);
    linhas.push({
      codigo: "AVISO", descricao: "Aviso prévio indenizado",
      referencia: avisoDias + " dias (30 + 3 × " + anos + " ano(s))",
      provento: avisoIndenizado, desconto: 0
    });
    avisos.push("O aviso indenizado projeta o contrato até " + rhEv_br_(dataProjetada) + " — os avos de 13º e de férias proporcionais já contam essa projeção.");
  } else if (semJustaCausa && modoAviso === "trabalhado") {
    avisos.push("Aviso prévio trabalhado (" + avisoDias + " dias): os dias trabalhados no aviso entram na folha mensal normalmente, não aqui.");
  } else if (semJustaCausa && modoAviso === "dispensado") {
    // Guarda deliberada: numa dispensa sem justa causa o empregador
    // pode liberar o empregado de cumprir o aviso, mas continua
    // OBRIGADO a pagá-lo (art. 487, §1º da CLT). Deixar passar como
    // "dispensado = não paga" seria a conta errada mais cara do módulo.
    return {
      ok: false,
      mensagem: "Numa dispensa SEM justa causa o aviso prévio é sempre devido: se o colaborador não vai cumpri-lo, ele é INDENIZADO (art. 487, §1º da CLT). Escolha \"Indenizado\" ou \"Trabalhado\"."
    };
  } else if (pedidoDemissao && modoAviso === "indenizado") {
    // Pedido de demissão sem cumprir o aviso: o empregador pode
    // descontar 30 dias de salário (art. 487, §2º da CLT). O acréscimo
    // proporcional da Lei 12.506/2011 é benefício do empregado e não se
    // desconta dele — por isso 30 dias fixos, não avisoDias.
    avisoDescontado = rhEv_ar_(diario * 30);
    linhas.push({ codigo: "AVISO-D", descricao: "Aviso prévio não cumprido (desconto)", referencia: "30 dias", provento: 0, desconto: avisoDescontado });
    avisos.push("Desconto de aviso prévio no pedido de demissão: 30 dias (art. 487, §2º da CLT). A proporcionalidade da Lei 12.506/2011 é benefício do empregado e não se desconta dele.");
  }

  /* --- 13º proporcional --- */
  var inicio13 = new Date(dataProjetada.getFullYear(), 0, 1, 12, 0, 0);
  if (admissao.getTime() > inicio13.getTime()) inicio13 = admissao;
  var avos13 = rhEv_contarAvos_(inicio13, dataProjetada);
  var decimoProporcional = 0;
  if (!justaCausa) {
    decimoProporcional = rhEv_ar_(base / 12 * avos13);
    if (decimoProporcional) {
      linhas.push({ codigo: "13PROP", descricao: "13º salário proporcional", referencia: avos13 + "/12 avos", provento: decimoProporcional, desconto: 0 });
    }
  } else {
    avisos.push("Justa causa: 13º proporcional e férias proporcionais não são devidos (Súmula 171 do TST). Férias VENCIDAS continuam devidas.");
  }

  /* --- Férias vencidas (períodos aquisitivos completos não gozados) --- */
  var periodosVencidos = Math.max(0, Number(params.feriasVencidasPeriodos || 0));
  var feriasVencidas = 0, tercoVencidas = 0;
  if (periodosVencidos > 0) {
    feriasVencidas = rhEv_ar_(base * periodosVencidos);
    tercoVencidas = rhEv_ar_(feriasVencidas / 3);
    linhas.push({ codigo: "FERV", descricao: "Férias vencidas (" + periodosVencidos + " período(s))", referencia: periodosVencidos + " × 30 dias", provento: feriasVencidas, desconto: 0 });
    linhas.push({ codigo: "FERV13", descricao: "1/3 constitucional sobre férias vencidas", referencia: "33,33%", provento: tercoVencidas, desconto: 0 });
  }

  /* --- Férias proporcionais --- */
  // Avos contados desde o último aniversário de admissão (início do
  // período aquisitivo em curso) até o desligamento/projeção.
  var feriasProp = 0, tercoProp = 0, avosFerias = 0;
  if (!justaCausa) {
    var inicioAquisitivo = new Date(dataProjetada.getFullYear(), admissao.getMonth(), admissao.getDate(), 12, 0, 0);
    if (inicioAquisitivo.getTime() > dataProjetada.getTime()) {
      inicioAquisitivo = new Date(dataProjetada.getFullYear() - 1, admissao.getMonth(), admissao.getDate(), 12, 0, 0);
    }
    if (inicioAquisitivo.getTime() < admissao.getTime()) inicioAquisitivo = admissao;
    avosFerias = rhEv_contarAvos_(inicioAquisitivo, dataProjetada);
    if (avosFerias > 0) {
      feriasProp = rhEv_ar_(base / 12 * avosFerias);
      tercoProp = rhEv_ar_(feriasProp / 3);
      linhas.push({ codigo: "FERP", descricao: "Férias proporcionais", referencia: avosFerias + "/12 avos", provento: feriasProp, desconto: 0 });
      linhas.push({ codigo: "FERP13", descricao: "1/3 constitucional sobre férias proporcionais", referencia: "33,33%", provento: tercoProp, desconto: 0 });
    }
  }

  /* --- FGTS da rescisão e multa de 40% --- */
  // FGTS incide sobre saldo de salário, 13º proporcional e aviso prévio
  // indenizado (Súmula 305 do TST). Não incide sobre férias indenizadas.
  var baseFgts = rhEv_ar_(saldoSalario + decimoProporcional + avisoIndenizado);
  var fgtsRescisao = rhEv_ar_(baseFgts * (cfg.fgtsPatronalPct / 100));

  var saldoFgtsInformado = rhEv_ar_(params.saldoFgts);
  var multaFgts = 0, baseMulta = 0;
  if (semJustaCausa) {
    baseMulta = rhEv_ar_(saldoFgtsInformado + fgtsRescisao);
    multaFgts = rhEv_ar_(baseMulta * 0.4);
    if (!saldoFgtsInformado) {
      avisos.push("Saldo do FGTS não informado — a multa de 40% saiu calculada só sobre o FGTS da própria rescisão. Pegue o saldo no extrato da Caixa e informe para o valor ficar correto.");
    }
    // A multa NÃO entra no total de proventos de propósito: ela é
    // depositada na conta vinculada do FGTS, não paga em dinheiro ao
    // colaborador. Somar aqui inflaria o "líquido a receber" e faria o
    // sindicato pagar duas vezes. Ela aparece separada no recibo e
    // entra no CUSTO da rescisão (rhEv_registrarDespesa_).
    linhas.push({
      codigo: "MULTA40", descricao: "Multa de 40% do FGTS (depósito na conta vinculada — não é dinheiro em mãos)",
      referencia: "40% de " + baseMulta + " (saldo informado + FGTS da rescisão)",
      provento: 0, desconto: 0, informativo: true, valorInformativo: multaFgts
    });
    avisos.push("A multa de 40% (" + multaFgts + ") NÃO entra no líquido a receber: ela é depositada na conta vinculada do FGTS, não paga em dinheiro. Ela entra no custo da rescisão registrado no Financeiro.");
  }

  /* --- INSS e IRRF --- */
  // Bases SEPARADAS: o 13º tem tributação exclusiva e não soma com o
  // saldo de salário. Férias indenizadas e aviso indenizado ficam fora
  // das duas (ver cabeçalho do arquivo).
  var inssSaldo = rh_calcularInss_(saldoSalario, cfg.inss);
  var inss13 = decimoProporcional ? rh_calcularInss_(decimoProporcional, cfg.inss) : 0;

  var baseIrrfSaldo = Math.max(0, rhEv_ar_(saldoSalario - inssSaldo - (dependentes * cfg.deducaoDependente)));
  var irrfSaldo = rh_calcularIrrf_(baseIrrfSaldo, cfg.irrf);
  var baseIrrf13 = decimoProporcional ? Math.max(0, rhEv_ar_(decimoProporcional - inss13 - (dependentes * cfg.deducaoDependente))) : 0;
  var irrf13 = baseIrrf13 ? rh_calcularIrrf_(baseIrrf13, cfg.irrf) : 0;

  if (inssSaldo) linhas.push({ codigo: "INSS", descricao: "INSS sobre o saldo de salário", referencia: saldoSalario, provento: 0, desconto: inssSaldo });
  if (inss13) linhas.push({ codigo: "INSS13", descricao: "INSS sobre o 13º proporcional", referencia: decimoProporcional, provento: 0, desconto: inss13 });
  if (irrfSaldo) linhas.push({ codigo: "IRRF", descricao: "IRRF sobre o saldo de salário", referencia: baseIrrfSaldo, provento: 0, desconto: irrfSaldo });
  if (irrf13) linhas.push({ codigo: "IRRF13", descricao: "IRRF sobre o 13º (exclusivo)", referencia: baseIrrf13, provento: 0, desconto: irrf13 });

  var inss = rhEv_ar_(inssSaldo + inss13);
  var irrf = rhEv_ar_(irrfSaldo + irrf13);

  var totalProventos = 0, totalDescontos = 0;
  linhas.forEach(function (l) {
    if (l.informativo) return;
    totalProventos += Number(l.provento || 0);
    totalDescontos += Number(l.desconto || 0);
  });
  totalProventos = rhEv_ar_(totalProventos);
  totalDescontos = rhEv_ar_(totalDescontos);

  avisos.push("Confira com o contador antes de pagar. O SISGEP não emite TRCT nem transmite eSocial/FGTS Digital — esta é a memória de cálculo, não a homologação.");

  return {
    ok: true,
    tipo: RH_EV_TIPOS.RESCISAO,
    referencia: RH_EV_ROTULO_MOTIVO[motivo] + " · " + rhEv_br_(desligamento),
    dataEvento: rhEv_iso_(desligamento),
    base: base, avos: avos13,
    motivo: motivo, motivoRotulo: RH_EV_ROTULO_MOTIVO[motivo],
    admissao: rhEv_iso_(admissao), desligamento: rhEv_iso_(desligamento),
    anosCasa: anos, avisoDias: avisoDias, avisoModo: modoAviso,
    dataProjetada: rhEv_iso_(dataProjetada),
    avosFerias: avosFerias, avos13: avos13,
    linhas: linhas,
    totalProventos: totalProventos, totalDescontos: totalDescontos,
    inss: inss, irrf: irrf, fgts: fgtsRescisao, multaFgts: multaFgts,
    liquido: rhEv_ar_(totalProventos - totalDescontos),
    avisos: avisos
  };
}

/* =========================================
 * DESPACHO
 * ========================================= */

function rhEv_calcular_(tipo, params) {
  var colaboradores = listarColaboradoresRH_interno_();
  var colaborador = null;
  for (var i = 0; i < colaboradores.length; i++) {
    if (colaboradores[i].id === String(params.colaboradorId || "")) { colaborador = colaboradores[i]; break; }
  }
  if (!colaborador) return { ok: false, mensagem: "Colaborador não encontrado." };

  var cfg = rh_obterConfigTributaria_();
  var r;

  if (tipo === RH_EV_TIPOS.DECIMO_1) { params.parcela = 1; r = rhEv_calcularDecimoTerceiro_(params, colaborador, cfg); }
  else if (tipo === RH_EV_TIPOS.DECIMO_2) { params.parcela = 2; r = rhEv_calcularDecimoTerceiro_(params, colaborador, cfg); }
  else if (tipo === RH_EV_TIPOS.FERIAS) { r = rhEv_calcularFerias_(params, colaborador, cfg); }
  else if (tipo === RH_EV_TIPOS.RESCISAO) { r = rhEv_calcularRescisao_(params, colaborador, cfg); }
  else return { ok: false, mensagem: "Tipo de evento desconhecido: " + tipo };

  if (!r.ok) return r;

  r.colaborador = {
    id: colaborador.id, nome: colaborador.nome, cargo: colaborador.cargo,
    cpf: colaborador.cpf, matricula: colaborador.matricula, email: colaborador.email,
    admissao: colaborador.admissao, dependentes: colaborador.dependentes,
    centroCusto: colaborador.centroCusto, departamento: colaborador.departamento,
    filial: colaborador.filial, cbo: colaborador.cbo
  };
  r.rotulo = RH_EV_ROTULOS[r.tipo] || r.tipo;
  return r;
}

/* =========================================
 * API PÚBLICA
 * ========================================= */

// Contexto para a tela pré-preencher os campos: base sugerida, avos já
// contados, dias de aviso prévio. Só leitura — não grava nada.
function rhEvContexto(colaboradorId, tipo, referencia, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var colaboradores = listarColaboradoresRH_interno_();
    var c = null;
    for (var i = 0; i < colaboradores.length; i++) {
      if (colaboradores[i].id === String(colaboradorId || "")) { c = colaboradores[i]; break; }
    }
    if (!c) return { ok: false, mensagem: "Colaborador não encontrado." };

    var sug = rhEv_baseSugerida_(c);
    var admissao = rhEv_data_(c.admissao);
    var hoje = new Date();
    var ano = Number(referencia) || hoje.getFullYear();

    var iniAno = new Date(ano, 0, 1, 12, 0, 0);
    var fimAno = new Date(ano, 11, 31, 12, 0, 0);
    var ini = (admissao && admissao.getTime() > iniAno.getTime()) ? admissao : iniAno;

    return {
      ok: true,
      colaborador: {
        id: c.id, nome: c.nome, cargo: c.cargo, cpf: c.cpf, matricula: c.matricula,
        email: c.email, admissao: c.admissao, salario: c.salario, dependentes: c.dependentes
      },
      baseSugerida: sug.base,
      composicaoBase: sug.composicao,
      avos13: admissao ? rhEv_contarAvos_(ini, fimAno) : 12,
      anosCasa: admissao ? rhEv_anosCompletos_(admissao, hoje) : 0,
      avisoPrevioDias: admissao ? Math.min(90, 30 + (rhEv_anosCompletos_(admissao, hoje) * 3)) : 30,
      semAdmissao: !admissao,
      // 1ª parcela já lançada no ano — a tela usa para sugerir o
      // adiantamento na 2ª sem a pessoa ter que procurar o valor.
      adiantamento13Lancado: rhEv_somaAdiantamento13_(c.id, String(ano))
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar contexto: " + e.message };
  }
}

// Soma o que já foi pago de 1ª parcela de 13º no ano (eventos ativos).
// Também conta o adiantamento embutido num evento de FÉRIAS, que é o
// caminho legal alternativo (art. 2º, §2º da Lei 4.749/65) — sem isso a
// 2ª parcela sairia calculada como se nada tivesse sido adiantado.
function rhEv_somaAdiantamento13_(colaboradorId, ano) {
  try {
    var eventos = rhEv_listar_interno_({ colaboradorId: colaboradorId });
    var total = 0;
    eventos.forEach(function (ev) {
      if (ev.status === "ESTORNADO") return;
      if (ev.colaboradorId !== colaboradorId) return;
      if (ev.tipo === RH_EV_TIPOS.DECIMO_1 && String(ev.referencia) === String(ano)) {
        total += Number(ev.totalProventos || 0);
      } else if (ev.tipo === RH_EV_TIPOS.FERIAS && String(ev.dataEvento || "").slice(0, 4) === String(ano)) {
        (ev.detalhe || []).forEach(function (l) {
          if (l.codigo === "AD13") total += Number(l.provento || 0);
        });
      }
    });
    return rhEv_ar_(total);
  } catch (e) {
    Logger.log("[RH] rhEv_somaAdiantamento13_: " + e.message);
    return 0;
  }
}

// Prévia — calcula e devolve tudo, sem gravar. É o passo 1 da tela.
function rhEvSimular(tipo, params, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    return rhEv_calcular_(String(tipo || ""), params || {});
  } catch (e) {
    return { ok: false, mensagem: "Erro ao calcular: " + e.message };
  }
}

// Passo 2 — grava. Recalcula do zero no servidor a partir dos mesmos
// parâmetros: nunca confia nos totais que voltaram da tela, porque
// quem manipula o cliente manipularia o valor a pagar.
function rhEvGravar(tipo, params, observacao, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  var resultado = rh_comLock_(function () {
    try {
      tipo = String(tipo || "");
      params = params || {};

      var r = rhEv_calcular_(tipo, params);
      if (!r.ok) return r;

      var duplicado = rhEv_encontrarDuplicado_(tipo, r, params);
      if (duplicado && !params.confirmarDuplicidade) {
        return {
          ok: false, duplicado: true,
          mensagem: "Já existe um lançamento ativo de \"" + (RH_EV_ROTULOS[tipo] || tipo) + "\" para " +
            r.colaborador.nome + " em " + r.referencia + " (" + duplicado.id + ", líquido " +
            rhEv_ar_(duplicado.liquido) + "). Estorne o anterior ou confirme que este é um lançamento complementar."
        };
      }

      var sh = rhEv_garantir_();
      var id = rh_gerarId_("EV");
      var quem = sessao.nome || sessao.usuario || "SISGEP";
      var agora = new Date();

      sh.appendRow([
        id, r.tipo, r.colaborador.id, r.colaborador.nome, r.colaborador.cargo,
        r.colaborador.cpf || "", r.colaborador.matricula || "",
        r.referencia, r.dataEvento, r.base, r.avos === "" ? "" : r.avos,
        r.totalProventos, r.totalDescontos, r.inss, r.irrf, r.fgts, Number(r.multaFgts || 0), r.liquido,
        JSON.stringify(params), JSON.stringify(r.linhas), (r.avisos || []).join(" | "),
        String(observacao || ""), "ATIVO", quem, agora,
        "", "", ""
      ]);

      r.id = id;
      r.mensagem = (RH_EV_ROTULOS[r.tipo] || r.tipo) + " de " + r.colaborador.nome +
        " gravado — líquido " + rhEv_ar_(r.liquido) + ". Confira com o contador antes de pagar.";
      return r;
    } catch (e) {
      return { ok: false, mensagem: "Erro ao gravar evento: " + e.message };
    }
  });

  // Fecha o ciclo com o Financeiro — FORA do rh_comLock_ acima, de
  // propósito: registrarLancamentoDespesa chama gerarNumeroDespesa_,
  // que pede o próprio LockService.getScriptLock(). Dentro do nosso
  // lock esse pedido esperaria 30s por um lock que só sai quando ele
  // mesmo terminar, e como a chamada é best-effort (try/catch com
  // Logger) o evento salvaria e a despesa sumiria em silêncio.
  if (resultado && resultado.ok && resultado.id) {
    try {
      rhEv_registrarDespesa_(resultado.id, resultado, tokenSessao);
    } catch (eDesp) {
      Logger.log("[RH] falha ao registrar despesa do evento " + resultado.id + ": " + eDesp.message);
    }
  }

  return resultado;
}

// Mesmo colaborador + mesmo tipo + mesma referência, ainda ativo.
// Pagar 13º duas vezes para a mesma pessoa é o erro caro que isto evita.
function rhEv_encontrarDuplicado_(tipo, calculo, params) {
  var eventos = rhEv_listar_interno_({ colaboradorId: calculo.colaborador.id });
  for (var i = 0; i < eventos.length; i++) {
    var ev = eventos[i];
    if (ev.status === "ESTORNADO") continue;
    if (ev.tipo !== tipo) continue;
    if (String(ev.referencia) === String(calculo.referencia)) return ev;
  }
  return null;
}

function rhEv_registrarDespesa_(id, r, tokenSessao) {
  // O custo real do sindicato é o bruto + o FGTS + (na rescisão) a
  // multa de 40%, não o líquido: o INSS/IRRF retidos também saem do
  // caixa (só que para a União), e a multa sai para a conta vinculada.
  var totalDespesa = rhEv_ar_(r.totalProventos + Number(r.fgts || 0) + Number(r.multaFgts || 0));
  if (totalDespesa <= 0) return;

  if (typeof registrarLancamentoDespesa !== "function") {
    Logger.log("[RH] registrarLancamentoDespesa não disponível — evento " + id + " sem despesa no Financeiro.");
    return;
  }

  var rotulo = RH_EV_ROTULOS[r.tipo] || r.tipo;
  registrarLancamentoDespesa({
    tipoLancamento: (typeof TIPO_LANCAMENTO_DESP !== "undefined" ? TIPO_LANCAMENTO_DESP.AVULSO : "avulso"),
    categoria: "Folha de Pagamento",
    prestadorNome: rotulo + " — " + r.colaborador.nome,
    descricao: rotulo + " de " + r.colaborador.nome + " (" + r.referencia + "). Bruto " +
      rhEv_ar_(r.totalProventos) + " + FGTS " + rhEv_ar_(r.fgts) +
      (Number(r.multaFgts || 0) ? " + multa 40% " + rhEv_ar_(r.multaFgts) : "") +
      ". Líquido a pagar ao colaborador: " + rhEv_ar_(r.liquido) + ".",
    valor: totalDespesa,
    dataVencimento: r.dataEvento,
    quemAgendou: "Automático",
    observacoes: "Gerado automaticamente pelo RH ao lançar o evento " + id +
      ". Estornar o evento no RH não cancela esta despesa — cancele na tela de Despesas se for o caso.",
    confirmarDuplicidade: true
  }, tokenSessao);
}

function rhEv_linhaParaObjeto_(l, mapa) {
  function v(nome) { return mapa[nome] ? l[mapa[nome] - 1] : ""; }
  var detalhe = [];
  try { detalhe = JSON.parse(v("DETALHE_JSON") || "[]"); } catch (e) { detalhe = []; }
  var parametros = {};
  try { parametros = JSON.parse(v("PARAMETROS_JSON") || "{}"); } catch (e) { parametros = {}; }

  return {
    id: String(v("ID") || ""),
    tipo: String(v("TIPO") || ""),
    rotulo: RH_EV_ROTULOS[String(v("TIPO") || "")] || String(v("TIPO") || ""),
    colaboradorId: String(v("COLABORADOR_ID") || ""),
    nome: String(v("NOME") || ""),
    cargo: String(v("CARGO") || ""),
    cpf: String(v("CPF") || ""),
    matricula: String(v("MATRICULA") || ""),
    referencia: String(v("REFERENCIA") || ""),
    dataEvento: rh_formatarData_(v("DATA_EVENTO")),
    base: Number(v("BASE_CALCULO") || 0),
    avos: v("AVOS"),
    totalProventos: Number(v("TOTAL_PROVENTOS") || 0),
    totalDescontos: Number(v("TOTAL_DESCONTOS") || 0),
    inss: Number(v("INSS") || 0),
    irrf: Number(v("IRRF") || 0),
    fgts: Number(v("FGTS") || 0),
    multaFgts: Number(v("MULTA_FGTS") || 0),
    liquido: Number(v("LIQUIDO") || 0),
    parametros: parametros,
    detalhe: detalhe,
    avisos: String(v("AVISOS") || ""),
    observacao: String(v("OBSERVACAO") || ""),
    status: String(v("STATUS") || "ATIVO"),
    geradoPor: String(v("GERADO_POR") || ""),
    geradoEm: rh_formatarData_(v("GERADO_EM")),
    estornadoPor: String(v("ESTORNADO_POR") || ""),
    estornadoEm: rh_formatarData_(v("ESTORNADO_EM")),
    motivoEstorno: String(v("MOTIVO_ESTORNO") || "")
  };
}

function rhEv_listar_interno_(filtros) {
  filtros = filtros || {};
  var sh = rhEv_garantir_();
  if (sh.getLastRow() < 2) return [];
  var mapa = rh_mapaCabecalho_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  return dados
    .map(function (l) { return rhEv_linhaParaObjeto_(l, mapa); })
    .filter(function (ev) {
      if (!ev.id) return false;
      if (filtros.colaboradorId && ev.colaboradorId !== String(filtros.colaboradorId)) return false;
      if (filtros.tipo && ev.tipo !== String(filtros.tipo)) return false;
      if (filtros.ano && String(ev.dataEvento || "").slice(0, 4) !== String(filtros.ano)) return false;
      if (filtros.somenteAtivos && ev.status === "ESTORNADO") return false;
      return true;
    })
    .reverse();
}

function rhEvListar(filtros, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    return { ok: true, eventos: rhEv_listar_interno_(filtros || {}) };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar eventos: " + e.message, eventos: [] };
  }
}

function rhEv_buscarPorId_(id) {
  var eventos = rhEv_listar_interno_({});
  for (var i = 0; i < eventos.length; i++) {
    if (eventos[i].id === String(id || "")) return eventos[i];
  }
  return null;
}

// Estorno em vez de exclusão: dinheiro que já foi calculado (e talvez
// pago) nunca some da planilha — fica com STATUS ESTORNADO, quem
// estornou, quando e por quê. Mesma decisão já tomada em Despesas.
function rhEvEstornar(id, motivo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  return rh_comLock_(function () {
    try {
      id = String(id || "").trim();
      motivo = String(motivo || "").trim();
      if (!id) return { ok: false, mensagem: "Informe o evento a estornar." };
      if (!motivo) return { ok: false, mensagem: "Informe o motivo do estorno — é ele que explica o valor no fechamento." };

      var sh = rhEv_garantir_();
      if (sh.getLastRow() < 2) return { ok: false, mensagem: "Evento não encontrado." };
      var mapa = rh_mapaCabecalho_(sh);
      var idCol = mapa["ID"] || 1;
      var ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues();

      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) !== id) continue;
        var linha = i + 2;
        if (String(sh.getRange(linha, mapa["STATUS"]).getValue()) === "ESTORNADO") {
          return { ok: false, mensagem: "Este evento já está estornado." };
        }
        sh.getRange(linha, mapa["STATUS"]).setValue("ESTORNADO");
        sh.getRange(linha, mapa["ESTORNADO_POR"]).setValue(sessao.nome || sessao.usuario || "SISGEP");
        sh.getRange(linha, mapa["ESTORNADO_EM"]).setValue(new Date());
        sh.getRange(linha, mapa["MOTIVO_ESTORNO"]).setValue(motivo);
        return {
          ok: true,
          mensagem: "Evento estornado. Atenção: a despesa criada no Financeiro NÃO foi cancelada — cancele na tela de Despesas se ela não vai mais ser paga."
        };
      }
      return { ok: false, mensagem: "Evento não encontrado." };
    } catch (e) {
      return { ok: false, mensagem: "Erro ao estornar: " + e.message };
    }
  });
}

// Resumo para o topo da tela: quanto já foi lançado no ano, por tipo.
function rhEvResumo(ano, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    ano = String(ano || new Date().getFullYear());
    var eventos = rhEv_listar_interno_({ ano: ano, somenteAtivos: true });
    var porTipo = {};
    Object.keys(RH_EV_ROTULOS).forEach(function (t) { porTipo[t] = { qtd: 0, bruto: 0, liquido: 0 }; });

    var totalBruto = 0, totalLiquido = 0, totalFgts = 0, totalMulta = 0;
    eventos.forEach(function (ev) {
      if (!porTipo[ev.tipo]) porTipo[ev.tipo] = { qtd: 0, bruto: 0, liquido: 0 };
      porTipo[ev.tipo].qtd++;
      porTipo[ev.tipo].bruto = rhEv_ar_(porTipo[ev.tipo].bruto + ev.totalProventos);
      porTipo[ev.tipo].liquido = rhEv_ar_(porTipo[ev.tipo].liquido + ev.liquido);
      totalBruto += ev.totalProventos;
      totalLiquido += ev.liquido;
      totalFgts += ev.fgts;
      totalMulta += ev.multaFgts;
    });

    return {
      ok: true, ano: ano, quantidade: eventos.length,
      porTipo: porTipo,
      totalBruto: rhEv_ar_(totalBruto),
      totalLiquido: rhEv_ar_(totalLiquido),
      totalFgts: rhEv_ar_(totalFgts),
      totalMultaFgts: rhEv_ar_(totalMulta),
      custoTotal: rhEv_ar_(totalBruto + totalFgts + totalMulta)
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar resumo: " + e.message };
  }
}
