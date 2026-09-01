// ============================================================================
// ARQUIVO: Assembleias.gs
// MÓDULO: Assembleias Gerais — o Estatuto como motor de regra.
//
// FONTE: Estatuto SindEducação-ES 2026 (VERSÃO FINAL 10.06.2026), Título III,
// Capítulo I, arts. 59 a 73. O texto está no Drive do sindicato, NÃO no
// projeto Apps Script — por isso os artigos estão transcritos aqui, com o
// número do artigo ao lado de cada regra. Quem for conferir consegue abrir o
// Estatuto e bater linha por linha.
//
// POR QUE ISTO É UM MÓDULO E NÃO UMA PLANILHA
// Assembleia é o órgão soberano do sindicato (art. 59). Uma assembleia
// convocada errado é uma assembleia anulável — e o que se deliberou nela cai
// junto: destituição de diretor, alteração de Estatuto, aprovação de contas.
// As regras que decidem isso são poucas, exatas, e ninguém consegue aplicar
// de cabeça no meio de uma convocação:
//
//   art. 67 — o tipo (Ordinária/Extraordinária) NÃO é escolha de quem
//             convoca: decorre da matéria. Contas, Orçamento e Eleições são
//             Ordinárias; todo o resto é Extraordinária.
//   art. 72 — a convocação exige edital afixado na sede E publicação em
//             jornal de grande circulação ou no Diário Oficial do ES.
//             Faltando uma, a convocação é irregular.
//   art. 62 — três matérias EXIGEM escrutínio secreto. Não é opcional.
//   art. 63 §único — é vedado deliberar sobre matéria fora da ordem do dia.
//             Esta é a regra que mais se viola na prática, porque a pauta
//             "surge" no meio da reunião.
//   art. 65 — alteração de Estatuto tem quórum de APROVAÇÃO próprio:
//             2/3 dos presentes em 1ª convocação, maioria simples na 2ª.
//   art. 73 — quórum de INSTALAÇÃO: 2/3 em 1ª convocação, qualquer número
//             em 2ª e última.
//   art. 70 — 1/3 dos associados em dia pode convocar AGE. Protocolada na
//             Secretaria Geral, a Diretoria tem 10 DIAS ÚTEIS para convocar,
//             "sob pena de grave violação do presente Estatuto".
//
// DUAS COISAS QUE O CÓDIGO NÃO DECIDE SOZINHO
//
// 1. AMBIGUIDADE REAL DO DOCUMENTO. O art. 73 diz que "o quórum das
//    Assembleias Gerais será sempre de 2/3", sem dizer 2/3 DE QUÊ. A leitura
//    natural de quórum de assembleia é 2/3 dos associados aptos, e é essa que
//    está implementada — mas ela está isolada em ASSEMB_BASE_QUORUM_INSTALACAO
//    e sinalizada no retorno de cada cálculo. NÃO trate isso como resolvido:
//    leve ao Jurídico antes da primeira assembleia de verdade.
//
// 2. O QUE O ESTATUTO 2026 JÁ REGE E O QUE SÓ VALE DEPOIS. O Estatuto 2026
//    está aprovado, e é dele que saem as regras de assembleia deste arquivo.
//    Mas nem tudo nele se aplica hoje: a regra de mandato de 10 anos
//    (art. 23) vale para a PRÓXIMA gestão. A atual foi empossada sob o
//    estatuto anterior, com 5 anos, e termina em 10/08/2027 — ver
//    Governanca.gs, GOV_GESTOES.
//
//    Para assembleia isso não muda quórum nem convocação. Fica registrado
//    porque a confusão entre "estatuto aprovado" e "regra já aplicável" é
//    exatamente o tipo de coisa que faz alguém calcular a próxima eleição
//    para 2032.
//
// O QUE ESTE MÓDULO NÃO FAZ: não convoca, não publica edital, não conta voto
// em urna. Ele registra, classifica, valida e alerta. A assembleia continua
// acontecendo com gente numa sala.
// ============================================================================

var ASSEMB_MODULO = "assembleias";
var ASSEMB_ABA = "SISGEP_Assembleias";

var ASSEMB_ESTATUTO = {
  versao: "Estatuto SindEducação-ES 2026",
  arquivo: "Estatuto Sindeducação ES novo 2026_VERSÃO FINAL 10.06.2026.docx",
  aprovado: true,
  // Regras de assembleia (arts. 59-73) valem. Mandato de 10 anos (art. 23)
  // só a partir da próxima gestão — ver nota 2 do cabeçalho.
  observacaoTransicao: "As regras de assembleia deste Estatuto se aplicam. " +
    "A regra de mandato de 10 anos (art. 23) vale a partir da próxima gestão; " +
    "a atual vai até 10/08/2027."
};

// Ver nota 1 do cabeçalho: interpretação, não certeza.
var ASSEMB_BASE_QUORUM_INSTALACAO = "ASSOCIADOS_APTOS";

var ASSEMB_COLUNAS = [
  "ID", "TIPO", "MATERIA", "TITULO", "DATA_HORA_1A", "DATA_HORA_2A", "LOCAL",
  "ORDEM_DO_DIA", "CONVOCADA_POR", "ORIGEM_CONVOCACAO", "PROTOCOLO_ASSOCIADOS",
  "EDITAL_SEDE", "EDITAL_PUBLICACAO", "EDITAL_LOCAL_TRABALHO",
  "ASSOCIADOS_APTOS", "PRESENTES", "CONVOCACAO_APLICADA",
  "VOTOS_SIM", "VOTOS_NAO", "ABSTENCOES", "ESCRUTINIO",
  "STATUS", "RESULTADO", "ATA_URL", "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_EM"
];

/**
 * As matérias que uma assembleia pode ter. Cada uma carrega a sua regra —
 * o tipo NÃO é escolhido por quem convoca (art. 67).
 *
 *   ordinaria        art. 67
 *   escrutinioSecreto art. 62 (obrigatório, não opcional)
 *   aprovacao        como se conta a aprovação
 *   fimEspecifico    art. 63: exige convocação com fins especificados
 */
var ASSEMB_MATERIAS = {
  CONTAS: {
    rotulo: "Apreciação de Contas / Balanço Financeiro",
    ordinaria: true, escrutinioSecreto: true, fimEspecifico: true,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "arts. 60 III, 62 II, 67"
  },
  ORCAMENTO: {
    rotulo: "Aprovação do Orçamento",
    ordinaria: true, escrutinioSecreto: false, fimEspecifico: false,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "art. 67"
  },
  ELEICOES: {
    rotulo: "Assembleia Geral Eleitoral",
    ordinaria: true, escrutinioSecreto: true, fimEspecifico: true,
    aprovacao: "REGULAMENTO_PROPRIO",
    artigos: "arts. 62 I, 66, 67, 68 — processa-se pelo Título IV"
  },
  ALTERACAO_ESTATUTO: {
    rotulo: "Alteração do Estatuto",
    ordinaria: false, escrutinioSecreto: false, fimEspecifico: true,
    aprovacao: "DOIS_TERCOS_PRESENTES_1A",
    artigos: "arts. 60 II, 65"
  },
  DESTITUICAO_DIRETOR: {
    rotulo: "Destituição de Diretor",
    ordinaria: false, escrutinioSecreto: false, fimEspecifico: true,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "arts. 60 I, 48"
  },
  JULGAMENTO_PENALIDADE: {
    rotulo: "Julgamento de atos da Diretoria sobre penalidades a associados",
    ordinaria: false, escrutinioSecreto: true, fimEspecifico: true,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "art. 62 III"
  },
  GREVE: {
    rotulo: "Deflagração de Greve",
    ordinaria: false, escrutinioSecreto: false, fimEspecifico: true,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "arts. 64, 73 — edital também no local de trabalho (art. 72 III)"
  },
  ALIENACAO_IMOVEL: {
    rotulo: "Alienação de bem imóvel",
    ordinaria: false, escrutinioSecreto: false, fimEspecifico: true,
    aprovacao: "REGULAMENTO_PROPRIO",
    artigos: "art. 66 — regulamentação própria"
  },
  ASSUNTOS_GERAIS: {
    rotulo: "Assuntos gerais",
    ordinaria: false, escrutinioSecreto: false, fimEspecifico: false,
    aprovacao: "MAIORIA_SIMPLES",
    artigos: "art. 61"
  }
};

/** Quem pode convocar (art. 69) e a via dos associados (art. 70). */
var ASSEMB_ORIGENS = {
  PRESIDENTE: { rotulo: "Presidente do sindicato", artigo: "art. 69" },
  DIRETORIA_EXECUTIVA: { rotulo: "Maioria da Diretoria Executiva", artigo: "art. 69" },
  SISTEMA_DIRETIVO: { rotulo: "Maioria do Sistema Diretivo e Administrativo", artigo: "art. 69" },
  ASSOCIADOS: { rotulo: "1/3 dos associados em dia (protocolo na Secretaria Geral)", artigo: "art. 70" }
};

var ASSEMB_PRAZO_CONVOCAR_APOS_PROTOCOLO_DIAS_UTEIS = 10;  // art. 70 §único

/* ==========================================================================
 * REGRAS — funções puras, sem planilha. São elas que o teste exercita.
 * ========================================================================== */

/**
 * Classifica a assembleia a partir da matéria (art. 67).
 * Não aceita "tipo" de quem convoca: o tipo decorre do assunto.
 */
function assemb_classificar_(materia) {
  var m = ASSEMB_MATERIAS[String(materia || "").toUpperCase()];
  if (!m) return null;
  return {
    materia: String(materia).toUpperCase(),
    rotulo: m.rotulo,
    tipo: m.ordinaria ? "ORDINARIA" : "EXTRAORDINARIA",
    escrutinioSecreto: m.escrutinioSecreto,
    fimEspecifico: m.fimEspecifico,
    aprovacao: m.aprovacao,
    artigos: m.artigos
  };
}

/**
 * Confere a convocação contra o art. 72 e devolve as pendências.
 * Não devolve booleano: devolve O QUE FALTA, porque quem está convocando
 * precisa saber o que providenciar, não que "está inválido".
 */
function assemb_validarConvocacao_(dados) {
  var regra = assemb_classificar_(dados.materia);
  var falhas = [];

  if (!regra) {
    return { valida: false, falhas: ["Matéria não prevista no Estatuto."], regra: null };
  }

  // art. 72 I — edital afixado na sede. Sempre.
  if (!dados.editalSede) {
    falhas.push("Falta o edital afixado na sede do sindicato (art. 72, I).");
  }

  // art. 72 II — publicação em jornal de grande circulação OU no DIO-ES.
  if (!dados.editalPublicacao) {
    falhas.push("Falta a publicação do edital em jornal de grande circulação " +
      "ou no Diário Oficial do ES (art. 72, II).");
  }

  // art. 72 III — greve por empresa exige edital também no local de trabalho.
  if (regra.materia === "GREVE" && !dados.editalLocalTrabalho) {
    falhas.push("Greve localizada por empresa exige edital também no local " +
      "de trabalho (art. 72, III).");
  }

  // art. 63 — matéria de fim específico precisa de ordem do dia declarada.
  if (regra.fimEspecifico && !String(dados.ordemDoDia || "").trim()) {
    falhas.push("Esta matéria exige convocação com fins especificados: " +
      "declare a ordem do dia (art. 63).");
  }

  // art. 69/70 — quem convocou.
  var origem = ASSEMB_ORIGENS[String(dados.origemConvocacao || "").toUpperCase()];
  if (!origem) {
    falhas.push("Informe quem convocou a assembleia (arts. 69 e 70).");
  } else if (String(dados.origemConvocacao).toUpperCase() === "ASSOCIADOS" &&
             !String(dados.protocoloAssociados || "").trim()) {
    falhas.push("Convocação por associados exige o número do protocolo " +
      "entregue na Secretaria Geral (art. 70).");
  }

  // Segunda convocação: sem ela, uma assembleia sem quórum de 2/3 morre na
  // porta. O art. 73 pressupõe a segunda; não declará-la é erro de quem
  // convoca, não escolha.
  if (!dados.dataHora2a) {
    falhas.push("Declare a data e hora da segunda convocação — sem ela, não " +
      "havendo 2/3 na primeira, a assembleia não se instala (art. 73).");
  }

  return { valida: falhas.length === 0, falhas: falhas, regra: regra };
}

/**
 * Quórum de INSTALAÇÃO (art. 73) — não confundir com quórum de aprovação.
 * 1ª convocação: 2/3. 2ª e última: qualquer número.
 */
function assemb_quorumInstalacao_(convocacao, associadosAptos, presentes) {
  var aptos = Number(associadosAptos) || 0;
  var pres = Number(presentes) || 0;
  var seg = Number(convocacao) === 2;

  if (seg) {
    return {
      convocacao: 2, instalada: pres > 0, exigido: 1,
      base: ASSEMB_BASE_QUORUM_INSTALACAO,
      explicacao: "Segunda e última convocação instala com qualquer número de " +
        "presentes (art. 73)." + (pres > 0 ? "" : " Nenhum presente registrado."),
      interpretacaoPendente: false
    };
  }

  var exigido = Math.ceil((2 / 3) * aptos);
  return {
    convocacao: 1, instalada: aptos > 0 && pres >= exigido, exigido: exigido,
    base: ASSEMB_BASE_QUORUM_INSTALACAO,
    explicacao: "Primeira convocação exige 2/3 (art. 73): " + exigido +
      " de " + aptos + " associados aptos. Presentes: " + pres + ".",
    // Ver nota 1 do cabeçalho — o art. 73 não diz 2/3 de quê.
    interpretacaoPendente: true,
    avisoInterpretacao: "O art. 73 não especifica a base dos 2/3. Aqui está " +
      "aplicado sobre os associados aptos. Confirme com o Jurídico antes de " +
      "usar este número para instalar ou não uma assembleia."
  };
}

/**
 * Quórum de APROVAÇÃO da matéria. Alteração de Estatuto (art. 65) tem regra
 * própria e diferente por convocação; o resto é maioria simples (art. 61).
 */
function assemb_quorumAprovacao_(materia, convocacao, votos) {
  var regra = assemb_classificar_(materia);
  if (!regra) return { ok: false, mensagem: "Matéria não prevista no Estatuto." };

  var sim = Number(votos && votos.sim) || 0;
  var nao = Number(votos && votos.nao) || 0;
  var abst = Number(votos && votos.abstencoes) || 0;
  var presentes = sim + nao + abst;
  var seg = Number(convocacao) === 2;

  if (regra.aprovacao === "REGULAMENTO_PROPRIO") {
    return {
      ok: true, aprovado: null, exigeAnaliseHumana: true,
      materia: regra.rotulo,
      explicacao: regra.rotulo + " se processa por regulamentação própria (" +
        regra.artigos + "). O sistema não apura este resultado."
    };
  }

  if (regra.aprovacao === "DOIS_TERCOS_PRESENTES_1A") {
    if (!seg) {
      var exigido = Math.ceil((2 / 3) * presentes);
      return {
        ok: true, aprovado: presentes > 0 && sim >= exigido,
        exigido: exigido, favoraveis: sim, presentes: presentes,
        materia: regra.rotulo,
        explicacao: "Alteração de Estatuto em primeira convocação exige 2/3 " +
          "dos presentes (art. 65 §1º): " + exigido + " de " + presentes +
          ". Votos a favor: " + sim + "."
      };
    }
    return {
      ok: true, aprovado: presentes > 0 && sim > (presentes / 2),
      exigido: Math.floor(presentes / 2) + 1, favoraveis: sim, presentes: presentes,
      materia: regra.rotulo,
      explicacao: "Alteração de Estatuto em segunda convocação é aprovada por " +
        "maioria simples dos presentes (art. 65 §2º). Votos a favor: " + sim +
        " de " + presentes + "."
    };
  }

  // art. 61 — maioria simples dos presentes.
  return {
    ok: true, aprovado: presentes > 0 && sim > (presentes / 2),
    exigido: Math.floor(presentes / 2) + 1, favoraveis: sim, presentes: presentes,
    materia: regra.rotulo,
    explicacao: "Maioria simples dos presentes (art. 61). Votos a favor: " +
      sim + " de " + presentes + " votantes."
  };
}

/**
 * Prazo do art. 70 §único: protocolada a convocação por 1/3 dos associados,
 * a Diretoria tem 10 DIAS ÚTEIS para convocar. Dias úteis, não corridos —
 * contar corrido aqui encurta o prazo e cria violação onde não há.
 */
function assemb_prazoConvocacaoPorAssociados_(dataProtocolo, hoje) {
  var ini = assemb_data_(dataProtocolo);
  if (!ini) return null;
  var ref = hoje ? assemb_data_(hoje) : assemb_hoje_();

  var limite = new Date(ini.getTime());
  var uteis = 0;
  while (uteis < ASSEMB_PRAZO_CONVOCAR_APOS_PROTOCOLO_DIAS_UTEIS) {
    limite.setDate(limite.getDate() + 1);
    var d = limite.getDay();
    if (d !== 0 && d !== 6) uteis++;
  }

  var dia = 24 * 60 * 60 * 1000;
  var restantes = Math.round((limite.getTime() - ref.getTime()) / dia);

  return {
    protocolo: assemb_iso_(ini),
    limite: assemb_iso_(limite),
    diasCorridosRestantes: restantes,
    vencido: restantes < 0,
    artigo: "art. 70, parágrafo único",
    alerta: restantes < 0
      ? "PRAZO VENCIDO há " + Math.abs(restantes) + " dia(s). O Estatuto trata a " +
        "omissão como grave violação — a Diretoria não pode se opor à realização."
      : (restantes <= 3
        ? "Faltam " + restantes + " dia(s) para o limite de convocação."
        : "")
  };
}

function assemb_hoje_() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function assemb_data_(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var s = String(v || "").trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function assemb_iso_(d) {
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/* ==========================================================================
 * PERSISTÊNCIA
 * ========================================================================== */

function assemb_aba_() {
  return abaSisgep_(ASSEMB_ABA, ASSEMB_COLUNAS);
}

function assemb_mapa_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (n, i) { mapa[String(n).trim().toUpperCase()] = i; });
  return mapa;
}

function assemb_lerTodas_() {
  var aba = assemb_aba_();
  if (!aba || aba.getLastRow() < 2) return [];
  var mapa = assemb_mapa_(aba);
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
  return dados.map(function (linha, i) {
    var r = { _LINHA: i + 2 };
    ASSEMB_COLUNAS.forEach(function (c) {
      var j = mapa[c];
      r[c] = (j === undefined) ? "" : linha[j];
    });
    return r;
  });
}

function assemb_novoId_() {
  return "AG-" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss");
}

/* ==========================================================================
 * ENDPOINTS
 * ========================================================================== */

/** Catálogo de matérias e origens — a tela monta os seletores a partir daqui. */
function assembCatalogo(tokenSessao) {
  exigirModulo_(tokenSessao, ASSEMB_MODULO, false);
  var materias = Object.keys(ASSEMB_MATERIAS).map(function (k) {
    var c = assemb_classificar_(k);
    c.chave = k;
    return c;
  });
  var origens = Object.keys(ASSEMB_ORIGENS).map(function (k) {
    return { chave: k, rotulo: ASSEMB_ORIGENS[k].rotulo, artigo: ASSEMB_ORIGENS[k].artigo };
  });
  return { ok: true, estatuto: ASSEMB_ESTATUTO, materias: materias, origens: origens };
}

/**
 * Confere a convocação SEM gravar nada — para a pessoa ver o que falta antes
 * de registrar. Convocação irregular anula a assembleia inteira; descobrir
 * isso depois custa a deliberação toda.
 */
function assembConferirConvocacao(dados, tokenSessao) {
  exigirModulo_(tokenSessao, ASSEMB_MODULO, false);
  var r = assemb_validarConvocacao_(dados || {});
  return {
    ok: true, valida: r.valida, falhas: r.falhas, regra: r.regra,
    estatuto: ASSEMB_ESTATUTO
  };
}

/** Registra a assembleia. Só grava se a convocação estiver regular. */
function assembRegistrar(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, ASSEMB_MODULO, false);
  dados = dados || {};

  var v = assemb_validarConvocacao_(dados);
  if (!v.valida) {
    return { ok: false, falhas: v.falhas,
      mensagem: "Convocação irregular — corrija antes de registrar: " + v.falhas.join(" ") };
  }
  if (!String(dados.titulo || "").trim()) {
    return { ok: false, mensagem: "Informe o título da assembleia." };
  }
  if (!dados.dataHora1a) {
    return { ok: false, mensagem: "Informe a data e hora da primeira convocação." };
  }

  var trava = travarSisgep_(20000);
  try {
    var aba = assemb_aba_();
    var mapa = assemb_mapa_(aba);
    var id = assemb_novoId_();
    var agora = new Date();

    var valores = new Array(Math.max(aba.getLastColumn(), ASSEMB_COLUNAS.length)).fill("");
    function set(col, val) {
      var j = mapa[col];
      if (j !== undefined) valores[j] = val;
    }
    set("ID", id);
    set("TIPO", v.regra.tipo);
    set("MATERIA", v.regra.materia);
    set("TITULO", String(dados.titulo).trim());
    set("DATA_HORA_1A", dados.dataHora1a);
    set("DATA_HORA_2A", dados.dataHora2a || "");
    set("LOCAL", String(dados.local || "").trim());
    set("ORDEM_DO_DIA", String(dados.ordemDoDia || "").trim());
    set("CONVOCADA_POR", String(dados.convocadaPor || "").trim());
    set("ORIGEM_CONVOCACAO", String(dados.origemConvocacao || "").toUpperCase());
    set("PROTOCOLO_ASSOCIADOS", String(dados.protocoloAssociados || "").trim());
    set("EDITAL_SEDE", dados.editalSede ? "SIM" : "NAO");
    set("EDITAL_PUBLICACAO", dados.editalPublicacao ? "SIM" : "NAO");
    set("EDITAL_LOCAL_TRABALHO", dados.editalLocalTrabalho ? "SIM" : "NAO");
    set("ASSOCIADOS_APTOS", Number(dados.associadosAptos) || 0);
    set("ESCRUTINIO", v.regra.escrutinioSecreto ? "SECRETO" : "ABERTO");
    set("STATUS", "CONVOCADA");
    set("CRIADO_POR", sessao.email || sessao.usuario || "SISGEP");
    set("CRIADO_EM", agora);
    set("ATUALIZADO_EM", agora);

    aba.appendRow(valores);

    return {
      ok: true, id: id, tipo: v.regra.tipo, escrutinio: v.regra.escrutinioSecreto ? "SECRETO" : "ABERTO",
      mensagem: "Assembleia registrada como " + v.regra.tipo + " (" + v.regra.artigos + ")." +
        (v.regra.escrutinioSecreto
          ? " Atenção: esta matéria exige escrutínio SECRETO (art. 62)."
          : "")
    };
  } finally {
    trava.liberar();
  }
}

/** Lista as assembleias, da mais recente para a mais antiga. */
function assembListar(filtro, tokenSessao) {
  exigirModulo_(tokenSessao, ASSEMB_MODULO, false);
  filtro = filtro || {};
  var lista = assemb_lerTodas_();
  if (filtro.status) {
    lista = lista.filter(function (a) { return String(a.STATUS) === String(filtro.status); });
  }
  if (filtro.tipo) {
    lista = lista.filter(function (a) { return String(a.TIPO) === String(filtro.tipo); });
  }
  lista.reverse();
  return { ok: true, total: lista.length, assembleias: lista, estatuto: ASSEMB_ESTATUTO };
}

/**
 * Instala a assembleia: registra presentes e diz se o quórum foi atingido.
 * NÃO instala sozinha quando o quórum de 2/3 depende da interpretação
 * pendente do art. 73 — devolve o número e quem preside decide.
 */
function assembInstalar(id, convocacao, presentes, tokenSessao) {
  exigirModulo_(tokenSessao, ASSEMB_MODULO, false);

  var lista = assemb_lerTodas_();
  var a = lista.filter(function (x) { return String(x.ID) === String(id); })[0];
  if (!a) return { ok: false, mensagem: "Assembleia não encontrada." };
  if (String(a.STATUS) === "ENCERRADA") {
    return { ok: false, mensagem: "Assembleia já encerrada." };
  }

  var q = assemb_quorumInstalacao_(convocacao, a.ASSOCIADOS_APTOS, presentes);

  var trava = travarSisgep_(20000);
  try {
    var aba = assemb_aba_();
    var mapa = assemb_mapa_(aba);
    function grava(col, val) {
      var j = mapa[col];
      if (j !== undefined) aba.getRange(a._LINHA, j + 1).setValue(val);
    }
    grava("PRESENTES", Number(presentes) || 0);
    grava("CONVOCACAO_APLICADA", Number(convocacao) || 1);
    grava("STATUS", q.instalada ? "INSTALADA" : "SEM_QUORUM");
    grava("ATUALIZADO_EM", new Date());
  } finally {
    trava.liberar();
  }

  return { ok: true, id: id, quorum: q, instalada: q.instalada, mensagem: q.explicacao };
}

/**
 * Apura a deliberação. Recusa quando a matéria não está na ordem do dia
 * (art. 63 §único) — é a regra que mais se viola, porque a pauta "surge" no
 * meio da reunião, e o que se deliberou fora dela é anulável.
 */
function assembDeliberar(id, materiaDeliberada, votos, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, ASSEMB_MODULO, false);

  var lista = assemb_lerTodas_();
  var a = lista.filter(function (x) { return String(x.ID) === String(id); })[0];
  if (!a) return { ok: false, mensagem: "Assembleia não encontrada." };

  if (String(a.STATUS) !== "INSTALADA") {
    return { ok: false,
      mensagem: "A assembleia precisa estar INSTALADA para deliberar. " +
        "Status atual: " + a.STATUS + "." };
  }

  // art. 63, parágrafo único.
  var mat = String(materiaDeliberada || a.MATERIA).toUpperCase();
  if (mat !== String(a.MATERIA).toUpperCase()) {
    return { ok: false, foraDaOrdemDoDia: true,
      mensagem: "Vedada deliberação sobre matéria não constante da ordem do dia " +
        "(art. 63, parágrafo único). A assembleia foi convocada para " +
        (assemb_classificar_(a.MATERIA) || {}).rotulo + ". Para deliberar sobre " +
        "outra matéria é preciso nova convocação." };
  }

  var r = assemb_quorumAprovacao_(mat, a.CONVOCACAO_APLICADA, votos || {});
  if (!r.ok) return { ok: false, mensagem: r.mensagem };

  if (r.exigeAnaliseHumana) {
    return { ok: true, apurado: false, exigeAnaliseHumana: true, mensagem: r.explicacao };
  }

  var trava = travarSisgep_(20000);
  try {
    var aba = assemb_aba_();
    var mapa = assemb_mapa_(aba);
    function grava(col, val) {
      var j = mapa[col];
      if (j !== undefined) aba.getRange(a._LINHA, j + 1).setValue(val);
    }
    grava("VOTOS_SIM", Number(votos && votos.sim) || 0);
    grava("VOTOS_NAO", Number(votos && votos.nao) || 0);
    grava("ABSTENCOES", Number(votos && votos.abstencoes) || 0);
    grava("RESULTADO", r.aprovado ? "APROVADO" : "REJEITADO");
    grava("STATUS", "ENCERRADA");
    grava("ATUALIZADO_EM", new Date());
  } finally {
    trava.liberar();
  }

  return {
    ok: true, apurado: true, aprovado: r.aprovado,
    exigido: r.exigido, favoraveis: r.favoraveis, presentes: r.presentes,
    escrutinioExigido: (assemb_classificar_(mat) || {}).escrutinioSecreto === true,
    registradoPor: sessao.email || sessao.usuario || "SISGEP",
    mensagem: r.explicacao + " Resultado: " + (r.aprovado ? "APROVADO" : "REJEITADO") + "."
  };
}

/** Prazo do art. 70 para uma convocação protocolada por associados. */
function assembPrazoProtocolo(dataProtocolo, tokenSessao) {
  exigirModulo_(tokenSessao, ASSEMB_MODULO, false);
  var p = assemb_prazoConvocacaoPorAssociados_(dataProtocolo);
  if (!p) return { ok: false, mensagem: "Informe uma data de protocolo válida." };
  return { ok: true, prazo: p };
}
