// ============================================================================
// ARQUIVO: IncidentesCore.gs
// INCIDENTES DE SEGURANÇA — item 16.7 do PROMPT-MESTRE.
//
// A DIFERENÇA DESTE MÓDULO PARA OS OUTROS DA AUDITORIA
// Os anteriores registram o que já aconteceu. Este tem RELÓGIO CORRENDO: a
// LGPD manda comunicar a ANPD e os titulares, e o prazo conta da CIÊNCIA do
// incidente, não da data em que ele ocorreu. Um incidente descoberto hoje
// sobre um vazamento de março tem o prazo começando hoje.
//
// SOBRE O PRAZO — LEIA ANTES DE CONFIAR NO CONTADOR
// A LGPD (art. 48) fala em "prazo razoável"; quem fixou o número foi a ANPD,
// por resolução, e esse número mudou nos últimos anos. O padrão aqui é 3
// DIAS ÚTEIS, mas fica CONFIGURÁVEL na aba CONFIG (chave
// LGPD_PRAZO_ANPD_DIAS_UTEIS) justamente porque a norma muda mais rápido que
// o código. A tela mostra de onde o número veio.
//
// Não tratar isto como certeza jurídica: confirmar com o jurídico do
// sindicato. O sistema conta os dias; quem responde pelo prazo é o sindicato.
//
// QUEM PODE O QUÊ — TUDO EXIGE ADMINISTRADOR
// Decisão do usuário em 11/08/2026: "Administrador por enquanto".
//
// Eu havia proposto liberar o REGISTRO para qualquer pessoa com o módulo,
// pelo argumento de que incidente costuma ser descoberto por quem está na
// ponta e o relógio já está correndo. O usuário decidiu diferente, e é
// decisão dele — o sindicato é pequeno e o administrador está por perto.
//
// A contrapartida fica registrada aqui para quando se quiser rever: se
// alguém sem perfil de administrador descobrir um incidente, precisa
// avisar um administrador para que o registro exista. O prazo da ANPD
// conta da CIÊNCIA do sindicato, não da hora em que alguém conseguiu
// registrar — então esse intervalo consome prazo sem aparecer no sistema.
//
// Trocar depois é uma linha: o terceiro argumento de exigirModulo_ em
// incRegistrar e no ramo não-administrativo de incAvancar.
// ============================================================================

var INC_ABA = "SISGEP_Incidentes";
var INC_MODULO = "auditoria";
var INC_PRAZO_PADRAO_DIAS_UTEIS = 3;

var INC_COLUNAS = [
  "ID", "DETECTADO_EM", "REGISTRADO_EM", "REGISTRADO_POR", "TIPO", "GRAVIDADE",
  "DADOS_ATINGIDOS", "NUM_TITULARES", "DESCRICAO", "MEDIDAS", "ESTADO",
  "ANPD_DATA", "TITULARES_DATA", "DISPENSA_MOTIVO",
  "RELATORIO_FINAL", "ENCERRADO_EM", "ENCERRADO_POR"
];

var INC_TIPOS = {
  VAZAMENTO:        "Vazamento de dados",
  ACESSO_INDEVIDO:  "Acesso indevido",
  PERDA:            "Perda de dados",
  INDISPONIBILIDADE:"Indisponibilidade"
};

var INC_GRAVIDADES = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };

/* Transições permitidas. Estado que não está aqui não é alcançável — o
 * fluxo não se conserta com força bruta pela tela. */
var INC_TRANSICOES = {
  ABERTO:     ["EM_ANALISE"],
  EM_ANALISE: ["CONTIDO"],
  CONTIDO:    ["COMUNICADO", "DISPENSADO"],
  COMUNICADO: ["ENCERRADO"],
  DISPENSADO: ["ENCERRADO"],
  ENCERRADO:  []
};

var INC_ROTULO_ESTADO = {
  ABERTO: "Aberto", EM_ANALISE: "Em análise", CONTIDO: "Contido",
  COMUNICADO: "Comunicado", DISPENSADO: "Comunicação dispensada", ENCERRADO: "Encerrado"
};

function inc_aba_() { return abaSisgep_(INC_ABA, INC_COLUNAS); }

/* ==========================================================================
 * PRAZO
 * ========================================================================== */

/**
 * Prazo em dias úteis: da aba CONFIG se houver, do padrão se não.
 *
 * Lê a CONFIG direto, no formato CHAVE/VALOR que o resto do sistema usa.
 * Para mudar o prazo, basta acrescentar a linha:
 *     LGPD_PRAZO_ANPD_DIAS_UTEIS | 5
 * Sem tocar em código — que é o ponto, porque a norma da ANPD muda mais
 * rápido que o sistema.
 */
function inc_prazoDiasUteis_() {
  try {
    var aba = planilhaSisgep_().getSheetByName("CONFIG");
    if (aba && aba.getLastRow() >= 2) {
      var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]).trim().toUpperCase() === "LGPD_PRAZO_ANPD_DIAS_UTEIS") {
          var v = parseInt(dados[i][1], 10);
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }
  } catch (e) {
    Logger.log("inc_prazoDiasUteis_ — usando o padrão: " + e.message);
  }
  return INC_PRAZO_PADRAO_DIAS_UTEIS;
}

/**
 * Soma dias ÚTEIS. Sábado e domingo não contam.
 *
 * Feriado não é tratado, e isso é uma limitação real: o contador pode
 * apontar um dia a mais do que a ANPD consideraria. Erra para o lado de
 * apertar o prazo, não de afrouxar — o que é o lado certo para errar aqui.
 * A tela diz isso por escrito.
 */
function inc_somarDiasUteis_(data, dias) {
  var d = new Date(data.getTime());
  var restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    var dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return d;
}

/**
 * Situação do prazo de um incidente.
 * Só corre enquanto a comunicação não foi decidida — depois de COMUNICADO ou
 * DISPENSADO o relógio para, porque a obrigação foi cumprida ou afastada.
 */
function inc_prazo_(detectadoEm, estado) {
  var parado = (estado === "COMUNICADO" || estado === "DISPENSADO" || estado === "ENCERRADO");
  var d = (detectadoEm instanceof Date) ? detectadoEm : new Date(detectadoEm);
  if (isNaN(d.getTime())) return { conhecido: false };

  var limite = inc_somarDiasUteis_(d, inc_prazoDiasUteis_());
  var hoje = new Date();
  var diasRestantes = Math.ceil((limite.getTime() - hoje.getTime()) / (24 * 3600 * 1000));

  return {
    conhecido: true, parado: parado, limite: limite,
    diasRestantes: diasRestantes,
    vencido: !parado && diasRestantes < 0,
    vencendo: !parado && diasRestantes >= 0 && diasRestantes <= 1,
    diasUteisConfigurados: inc_prazoDiasUteis_()
  };
}

/* ==========================================================================
 * REGISTRO E FLUXO
 * ========================================================================== */

function incRegistrar(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, INC_MODULO, true);
  dados = dados || {};

  var detectado = dados.detectadoEm ? new Date(dados.detectadoEm) : new Date();
  if (isNaN(detectado.getTime())) return { ok: false, mensagem: "Data de detecção inválida." };
  // Detecção no futuro faria o prazo nascer com folga inventada.
  if (detectado.getTime() > new Date().getTime() + 60000) {
    return { ok: false, mensagem: "A data de detecção não pode estar no futuro." };
  }
  var descricao = String(dados.descricao || "").trim();
  if (descricao.length < 10) {
    return { ok: false, mensagem: "Descreva o que aconteceu (mínimo 10 caracteres)." };
  }

  var aba = inc_aba_();
  var ano = detectado.getFullYear();
  var seq = 0;
  if (aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues().forEach(function (l) {
      var m = String(l[0]).match(/^INC-(\d{4})-(\d+)$/);
      if (m && Number(m[1]) === ano) seq = Math.max(seq, Number(m[2]));
    });
  }
  var id = "INC-" + ano + "-" + String(seq + 1).padStart(3, "0");

  aba.appendRow([
    id, detectado, new Date(), sessao.email || sessao.usuario || "—",
    "", "", "", "", descricao, "", "ABERTO", "", "", "", "", "", ""
  ]);

  auditar_({
    registroId: id, modulo: "Auditoria e Compliance", submodulo: "Incidentes",
    acao: "REGISTRAR_INCIDENTE", sessao: sessao,
    valorNovo: { estado: "ABERTO", detectadoEm: detectado },
    justificativa: descricao.slice(0, 200)
  });

  return { ok: true, id: id, mensagem: "Incidente " + id + " registrado. O prazo começa a contar da data de detecção." };
}

/** Linha do incidente, ou null. */
function inc_linha_(id) {
  var aba = inc_aba_();
  if (aba.getLastRow() < 2) return null;
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, INC_COLUNAS.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === String(id)) return { linha: i + 2, valores: dados[i], aba: aba };
  }
  return null;
}

function inc_podeIr_(de, para) {
  return (INC_TRANSICOES[de] || []).indexOf(para) > -1;
}

/**
 * Avança o incidente. Cada passo exige o que aquele passo precisa — não dá
 * para chegar em CONTIDO sem dizer o que foi feito para conter.
 */
function incAvancar(id, para, dados, tokenSessao) {
  para = String(para || "").toUpperCase();
  // Comunicar, dispensar e encerrar são decisões que respondem por elas
  // perante a ANPD; classificar e conter são trabalho de apuração.
  // Todo o fluxo exige administrador, por decisão do usuário. A variável
  // permanece para deixar visível onde estava a distinção, caso se queira
  // reabrir classificar/conter para quem só tem o módulo.
  var exigeAdmin = true;
  var sessao = exigirModulo_(tokenSessao, INC_MODULO, exigeAdmin);
  dados = dados || {};

  var r = inc_linha_(id);
  if (!r) return { ok: false, mensagem: "Incidente não encontrado." };

  var estadoAtual = String(r.valores[10]).toUpperCase();
  if (!inc_podeIr_(estadoAtual, para)) {
    return { ok: false, mensagem: "De " + (INC_ROTULO_ESTADO[estadoAtual] || estadoAtual) +
      " não se vai direto para " + (INC_ROTULO_ESTADO[para] || para) + "." };
  }

  if (para === "EM_ANALISE") {
    if (!INC_TIPOS[String(dados.tipo || "").toUpperCase()]) {
      return { ok: false, mensagem: "Escolha o tipo do incidente." };
    }
    if (!INC_GRAVIDADES[String(dados.gravidade || "").toUpperCase()]) {
      return { ok: false, mensagem: "Escolha a gravidade." };
    }
    var nTit = parseInt(dados.numTitulares, 10);
    if (isNaN(nTit) || nTit < 0) {
      return { ok: false, mensagem: "Informe quantas pessoas foram atingidas (0 se ainda não se sabe)." };
    }
    r.aba.getRange(r.linha, 5).setValue(String(dados.tipo).toUpperCase());
    r.aba.getRange(r.linha, 6).setValue(String(dados.gravidade).toUpperCase());
    r.aba.getRange(r.linha, 7).setValue(String(dados.dadosAtingidos || "").trim());
    r.aba.getRange(r.linha, 8).setValue(nTit);

  } else if (para === "CONTIDO") {
    var medidas = String(dados.medidas || "").trim();
    if (medidas.length < 10) {
      return { ok: false, mensagem: "Descreva as medidas de contenção (mínimo 10 caracteres)." };
    }
    r.aba.getRange(r.linha, 10).setValue(medidas);

  } else if (para === "COMUNICADO") {
    // Pelo menos uma comunicação tem que ter acontecido — senão o estado
    // mente, e mentir aqui é o pior lugar possível para mentir.
    var dAnpd = dados.anpdData ? new Date(dados.anpdData) : null;
    var dTit = dados.titularesData ? new Date(dados.titularesData) : null;
    if ((!dAnpd || isNaN(dAnpd.getTime())) && (!dTit || isNaN(dTit.getTime()))) {
      return { ok: false, mensagem: "Informe a data da comunicação à ANPD, aos titulares, ou às duas." };
    }
    if (dAnpd && !isNaN(dAnpd.getTime())) r.aba.getRange(r.linha, 12).setValue(dAnpd);
    if (dTit && !isNaN(dTit.getTime())) r.aba.getRange(r.linha, 13).setValue(dTit);

  } else if (para === "DISPENSADO") {
    // Decidir NÃO comunicar é decisão de risco, e é ela que vai ser cobrada
    // se a ANPD discordar depois. Sem justificativa escrita, não passa.
    var motivo = String(dados.motivo || "").trim();
    if (motivo.length < 20) {
      return { ok: false, mensagem: "Justifique por que a comunicação foi dispensada " +
        "(mínimo 20 caracteres). Esta é a decisão que a ANPD questiona." };
    }
    r.aba.getRange(r.linha, 14).setValue(motivo);

  } else if (para === "ENCERRADO") {
    var rel = String(dados.relatorio || "").trim();
    if (rel.length < 20) {
      return { ok: false, mensagem: "Escreva o relatório final (mínimo 20 caracteres)." };
    }
    r.aba.getRange(r.linha, 15).setValue(rel);
    r.aba.getRange(r.linha, 16).setValue(new Date());
    r.aba.getRange(r.linha, 17).setValue(sessao.email || sessao.usuario || "—");
  }

  r.aba.getRange(r.linha, 11).setValue(para);

  auditar_({
    registroId: id, modulo: "Auditoria e Compliance", submodulo: "Incidentes",
    acao: (para === "DISPENSADO") ? "DISPENSAR_COMUNICACAO_INCIDENTE" : ("INCIDENTE_" + para),
    sessao: sessao,
    valorAnterior: { estado: estadoAtual }, valorNovo: { estado: para },
    justificativa: String(dados.motivo || dados.medidas || dados.relatorio || "").slice(0, 200)
  });

  return { ok: true, mensagem: "Incidente movido para " + (INC_ROTULO_ESTADO[para] || para) + "." };
}

/* ==========================================================================
 * LEITURA
 * ========================================================================== */

function incListar(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, INC_MODULO, false);
  filtros = filtros || {};

  var aba = inc_aba_();
  if (aba.getLastRow() < 2) {
    return { ok: true, total: 0, incidentes: [], resumo: {}, prazoDiasUteis: inc_prazoDiasUteis_() };
  }

  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, INC_COLUNAS.length).getValues();
  var lista = dados.map(function (l) {
    var estado = String(l[10]).toUpperCase();
    return {
      id: l[0], detectadoEm: l[1], registradoEm: l[2], registradoPor: l[3],
      tipo: l[4], tipoRotulo: INC_TIPOS[String(l[4]).toUpperCase()] || "",
      gravidade: l[5], gravidadeRotulo: INC_GRAVIDADES[String(l[5]).toUpperCase()] || "",
      dadosAtingidos: l[6], numTitulares: l[7], descricao: l[8], medidas: l[9],
      estado: estado, estadoRotulo: INC_ROTULO_ESTADO[estado] || estado,
      anpdData: l[11], titularesData: l[12], dispensaMotivo: l[13],
      relatorioFinal: l[14], encerradoEm: l[15], encerradoPor: l[16],
      prazo: inc_prazo_(l[1], estado),
      proximos: INC_TRANSICOES[estado] || []
    };
  });

  if (filtros.estado) {
    lista = lista.filter(function (x) { return x.estado === String(filtros.estado).toUpperCase(); });
  }
  lista.reverse();

  return {
    ok: true, total: lista.length, incidentes: lista,
    prazoDiasUteis: inc_prazoDiasUteis_(),
    resumo: lista.reduce(function (m, x) { m[x.estado] = (m[x.estado] || 0) + 1; return m; }, {}),
    // O que exige ação agora — é o que o card vermelho mostra.
    vencendo: lista.filter(function (x) { return x.prazo.conhecido && (x.prazo.vencido || x.prazo.vencendo); })
  };
}

/** Catálogos para os seletores da tela. */
function incCatalogos(tokenSessao) {
  exigirModulo_(tokenSessao, INC_MODULO, false);
  return {
    ok: true, tipos: INC_TIPOS, gravidades: INC_GRAVIDADES,
    estados: INC_ROTULO_ESTADO, transicoes: INC_TRANSICOES,
    prazoDiasUteis: inc_prazoDiasUteis_()
  };
}
