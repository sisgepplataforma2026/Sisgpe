// ============================================================================
// ARQUIVO: Governanca.gs
// MÓDULO: Governança — quem dirige o sindicato, com que mandato e até quando.
//
// FONTE: "ATA DE POSSE DAS ELEIÇÕES SINDICAIS — GESTÃO 2022/2027", lavrada em
// 11 de agosto de 2022 no espaço Patrick Ribeiro, Vitória/ES, registrada em
// cartório (Tabelionato de Notas do Juízo de Vitória, autenticação 05/01/2023).
// Presidente da Comissão Eleitoral: Robson Luiz D'Andrea.
// Regras de mandato e eleição: Estatuto 2026, arts. 23, 33-35, 68, 74 e 79.
//
// POR QUE ESTE MÓDULO EXISTE
// O SISGEP sabia quem tem LOGIN, mas não sabia quem tem MANDATO. São coisas
// diferentes e a confusão entre elas é o que faz um sistema sindical furar:
// permissão é operacional (quem mexe na tela), mandato é institucional (quem
// responde pelo ato). Rogério lança pagamento porque tem o módulo Financeiro;
// ele ASSINA pelo sindicato porque é Diretor Secretário de Finanças eleito.
//
// O QUE ESTE MÓDULO GUARDA — E O QUE NÃO GUARDA (LGPD)
// A ata traz, de 24 pessoas: nome, RG, CPF, PIS/PASEP, CTPS e ENDEREÇO
// RESIDENCIAL completo. Aqui ficam apenas NOME, CARGO, ÓRGÃO e CONDIÇÃO
// (efetivo/suplente) — que são públicos por natureza: constam de ata
// registrada em cartório e o sindicato os divulga.
//
// CPF, RG, PIS, CTPS e endereço NÃO entram neste arquivo, e não é descuido.
// Este código vai para um repositório Git; dado pessoal em repositório não se
// apaga, fica no histórico para sempre. Quem precisar cruzar dirigente com
// associado usa o cadastro de Associados, que é onde CPF já vive e onde já
// existe controle de acesso.
//
// DUAS GESTÕES, DOIS REGIMES — NÃO É DIVERGÊNCIA, É TRANSIÇÃO
// A gestão de hoje foi empossada sob o estatuto anterior: mandato de 5 anos,
// de 11/08/2022 a 10/08/2027, como diz a Ata de Posse.
//
// O Estatuto 2026, art. 23, estabelece mandato de 10 anos (arts. 68 e 74:
// eleição "decenalmente"), e essa regra vale para a PRÓXIMA gestão — a que
// for eleita para suceder esta.
//
// Isto está escrito porque a leitura ingênua do código produziria o erro
// oposto: quem abrisse o Estatuto novo e visse "10 anos" concluiria que a
// gestão atual vai até 2032. Vai até 2027. O regime de cada gestão está em
// GOV_GESTOES, e o mandato vigente é sempre o que a ata daquela posse fixou.
// ============================================================================

var GOV_MODULO = "governanca";

/**
 * Uma linha por gestão, cada uma com o estatuto que a rege. Quando a próxima
 * for empossada, acrescente a linha dela aqui com a data da ata de posse —
 * não altere a anterior. O histórico de quem dirigiu o sindicato e sob que
 * regra é parte do acervo institucional.
 */
var GOV_GESTOES = [
  {
    gestao: "2022/2027",
    posse: "2022-08-11",
    termino: "2027-08-10",
    duracaoAnos: 5,
    estatutoAplicavel: "Estatuto anterior (vigente à época da posse)",
    fonte: "Ata de Posse das Eleições Sindicais, lavrada em 11/08/2022, " +
      "registrada em cartório",
    comissaoEleitoral: "Robson Luiz D'Andrea (presidente)",
    secretariaDaSessao: "Marcelha Aline Pinto Gomes",
    atual: true
  },
  {
    gestao: "2027/2037",
    posse: "",           // definida na posse
    termino: "",
    duracaoAnos: 10,
    estatutoAplicavel: "Estatuto SindEducação-ES 2026, art. 23 " +
      "(eleição decenal — arts. 68 e 74)",
    fonte: "Estatuto 2026, aprovado para vigorar a partir da próxima gestão",
    atual: false,
    observacao: "Mandato de 10 anos passa a valer com esta gestão. A eleição " +
      "que a elege é convocada ainda sob o calendário da gestão atual (art. 79)."
  }
];

/** A gestão empossada hoje. */
function gov_gestaoAtual_() {
  for (var i = 0; i < GOV_GESTOES.length; i++) {
    if (GOV_GESTOES[i].atual) return GOV_GESTOES[i];
  }
  return GOV_GESTOES[0];
}

var GOV_MANDATO = gov_gestaoAtual_();

// Art. 79: edital com antecedência MÁXIMA de 24 meses e MÍNIMA de 30 dias do
// término do mandato. A mínima é a que cria risco: perdê-la trava a eleição.
var GOV_EDITAL_ANTECEDENCIA_MAXIMA_MESES = 24;
var GOV_EDITAL_ANTECEDENCIA_MINIMA_DIAS = 30;

// Art. 35, parágrafo único: o Conselho Fiscal reúne-se em sessão ordinária
// pelo menos uma vez por semestre.
var GOV_CONSELHO_FISCAL_REUNIOES_POR_ANO = 2;

/**
 * Composição empossada. Só nome, cargo, órgão e condição — ver nota LGPD.
 *
 * "moduloSisgep" liga o cargo estatutário ao módulo do sistema que ele
 * naturalmente responde. Não concede acesso: quem concede é AcessoModulos.gs.
 * Serve para a tela mostrar quem responde por quê, e para a auditoria
 * perguntar por que o responsável pelo Financeiro não é o Secretário de
 * Finanças.
 */
var GOV_COMPOSICAO = [
  // ── DIRETORIA EXECUTIVA ──
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 1,
    cargo: "Presidente", nome: "Leonil Dias da Silva", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 2,
    cargo: "Vice-Presidente", nome: "Almir Pacheco Scheidegger", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 3,
    cargo: "Secretário Geral", nome: "Marcelo Martins", moduloSisgep: "documentos" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 4,
    cargo: "Secretário de Finanças", nome: "Rogério José Erler", moduloSisgep: "financeiro" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 5,
    cargo: "Secretária de Organização, de Informática e de Patrimônio",
    nome: "Marcilene da Silva Mageske", moduloSisgep: "patrimonio" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 6,
    cargo: "Secretária de Imprensa e Comunicação Social",
    nome: "Zenair da Silva Borges Gonçalves", moduloSisgep: "comunicacao" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 7,
    cargo: "Secretário de Assuntos Jurídicos", nome: "Lindolpho Gadelha Sobrinho",
    moduloSisgep: "juridico" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "EFETIVO", ordem: 8,
    cargo: "Secretário de Formação Sindical, Estudos Socioeconômicos e Ação Social",
    nome: "Jocimar Samuel da Costa Vila Real", moduloSisgep: "sindicalizacao" },

  // ── SUPLENTES DA DIRETORIA EXECUTIVA ──
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 1, cargo: "Suplente", nome: "Marcos Antônio Simões", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 2, cargo: "Suplente", nome: "Gleicimar Gomes Soares da Silva", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 3, cargo: "Suplente", nome: "Luziane Pereira Mageske Riquieri", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 4, cargo: "Suplente", nome: "Hararrija Diório Duque", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 5, cargo: "Suplente", nome: "Regina Malta Leite", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 6, cargo: "Suplente", nome: "Janayna Correa Martins da Costa Dias", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 7, cargo: "Suplente", nome: "Hellen Lúcia Paoli da Silva", moduloSisgep: "" },
  { orgao: "DIRETORIA_EXECUTIVA", condicao: "SUPLENTE", ordem: 8, cargo: "Suplente", nome: "Eduardo da Silva Nunes", moduloSisgep: "" },

  // ── CONSELHO FISCAL (art. 33: 3 efetivos e 3 suplentes) ──
  { orgao: "CONSELHO_FISCAL", condicao: "EFETIVO", ordem: 1, cargo: "Conselheiro Fiscal", nome: "Wanderson Nascimento Castelo", moduloSisgep: "auditoriaFin" },
  { orgao: "CONSELHO_FISCAL", condicao: "EFETIVO", ordem: 2, cargo: "Conselheiro Fiscal", nome: "João Batista Alves de Almeida", moduloSisgep: "auditoriaFin" },
  { orgao: "CONSELHO_FISCAL", condicao: "EFETIVO", ordem: 3, cargo: "Conselheiro Fiscal", nome: "Robson Martins Dutra Nani", moduloSisgep: "auditoriaFin" },
  { orgao: "CONSELHO_FISCAL", condicao: "SUPLENTE", ordem: 1, cargo: "Suplente", nome: "Adriana Barcellos Soneghet", moduloSisgep: "" },
  { orgao: "CONSELHO_FISCAL", condicao: "SUPLENTE", ordem: 2, cargo: "Suplente", nome: "Gustavo Fernandes Siqueira", moduloSisgep: "" },
  { orgao: "CONSELHO_FISCAL", condicao: "SUPLENTE", ordem: 3, cargo: "Suplente", nome: "Maria Conceição Veloso Poeys", moduloSisgep: "" },

  // ── DELEGADOS REPRESENTANTES JUNTO À FEDERAÇÃO ──
  { orgao: "DELEGADOS_FEDERACAO", condicao: "EFETIVO", ordem: 1, cargo: "Delegado Representante", nome: "Claudio Hilário", moduloSisgep: "" },
  { orgao: "DELEGADOS_FEDERACAO", condicao: "EFETIVO", ordem: 2, cargo: "Delegado Representante", nome: "Paulo Henrique dos Santos Loureiro Muniz", moduloSisgep: "" },
  { orgao: "DELEGADOS_FEDERACAO", condicao: "SUPLENTE", ordem: 1, cargo: "Suplente", nome: "Euclides dos Santos", moduloSisgep: "" },
  { orgao: "DELEGADOS_FEDERACAO", condicao: "SUPLENTE", ordem: 2, cargo: "Suplente", nome: "Ediane da Silva Moreira", moduloSisgep: "" }
];

var GOV_ORGAOS = {
  DIRETORIA_EXECUTIVA: { rotulo: "Diretoria Executiva", artigo: "Estatuto, arts. 21 a 32" },
  CONSELHO_FISCAL: { rotulo: "Conselho Fiscal", artigo: "Estatuto, arts. 33 a 35" },
  DELEGADOS_FEDERACAO: { rotulo: "Delegados Representantes junto à Federação", artigo: "Estatuto, arts. 36 a 38" }
};

/* ==========================================================================
 * REGRAS DE MANDATO
 * ========================================================================== */

function gov_hoje_() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function gov_data_(iso) {
  var p = String(iso).split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function gov_iso_(d) {
  function z(n) { return (n < 10 ? "0" : "") + n; }
  return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
}
function gov_dias_(de, ate) {
  return Math.round((ate.getTime() - de.getTime()) / 86400000);
}

/**
 * Situação do mandato hoje, e a janela do edital de eleição (art. 79).
 *
 * A janela tem duas bordas e elas fazem coisas diferentes:
 *   - a máxima (24 meses antes) apenas ABRE a possibilidade de convocar;
 *   - a mínima (30 dias antes) é o ponto sem volta. Passou dela sem edital
 *     publicado, o sindicato entra no fim do mandato sem eleição convocada.
 */
function gov_situacaoMandato_(hoje) {
  var ref = hoje ? gov_data_(hoje) : gov_hoje_();
  var posse = gov_data_(GOV_MANDATO.posse);
  var fim = gov_data_(GOV_MANDATO.termino);

  var diasParaFim = gov_dias_(ref, fim);

  var abreEdital = new Date(fim.getTime());
  abreEdital.setMonth(abreEdital.getMonth() - GOV_EDITAL_ANTECEDENCIA_MAXIMA_MESES);

  var limiteEdital = new Date(fim.getTime());
  limiteEdital.setDate(limiteEdital.getDate() - GOV_EDITAL_ANTECEDENCIA_MINIMA_DIAS);

  var situacao;
  if (ref.getTime() < posse.getTime()) situacao = "FUTURO";
  else if (diasParaFim < 0) situacao = "ENCERRADO";
  else situacao = "VIGENTE";

  var janela;
  if (ref.getTime() < abreEdital.getTime()) {
    janela = {
      estado: "AINDA_NAO_ABRIU",
      mensagem: "A janela para o edital de eleição abre em " +
        gov_brasil_(gov_iso_(abreEdital)) + " (24 meses antes do fim do mandato, art. 79)."
    };
  } else if (ref.getTime() <= limiteEdital.getTime()) {
    janela = {
      estado: "ABERTA",
      mensagem: "Janela do edital ABERTA. Prazo final para publicar: " +
        gov_brasil_(gov_iso_(limiteEdital)) + " — faltam " +
        gov_dias_(ref, limiteEdital) + " dia(s). Depois disso o mandato termina " +
        "sem eleição convocada (art. 79)."
    };
  } else if (diasParaFim >= 0) {
    janela = {
      estado: "PRAZO_PERDIDO",
      mensagem: "PRAZO DO EDITAL PERDIDO. A antecedência mínima de 30 dias " +
        "venceu em " + gov_brasil_(gov_iso_(limiteEdital)) + " e o mandato " +
        "termina em " + gov_brasil_(GOV_MANDATO.termino) + ". Situação para o " +
        "Jurídico com urgência (art. 79)."
    };
  } else {
    janela = { estado: "MANDATO_ENCERRADO",
      mensagem: "Mandato encerrado em " + gov_brasil_(GOV_MANDATO.termino) + "." };
  }

  var proxima = GOV_GESTOES.filter(function (g) { return !g.atual; })[0] || null;

  return {
    gestao: GOV_MANDATO.gestao,
    situacao: situacao,
    posse: GOV_MANDATO.posse,
    termino: GOV_MANDATO.termino,
    duracaoAnos: GOV_MANDATO.duracaoAnos,
    estatutoAplicavel: GOV_MANDATO.estatutoAplicavel,
    diasParaFim: diasParaFim,
    editalAbreEm: gov_iso_(abreEdital),
    editalPrazoFinal: gov_iso_(limiteEdital),
    janelaEdital: janela,
    fonte: GOV_MANDATO.fonte,
    // A eleição desta janela elege a gestão que já entra no regime novo.
    // Quem convoca precisa saber disso ao redigir o edital.
    proximaGestao: proxima ? {
      duracaoAnos: proxima.duracaoAnos,
      estatutoAplicavel: proxima.estatutoAplicavel,
      observacao: proxima.observacao
    } : null
  };
}

function gov_brasil_(iso) {
  var p = String(iso).split("-");
  return p.length === 3 ? (p[2] + "/" + p[1] + "/" + p[0]) : iso;
}

/**
 * Reuniões do Conselho Fiscal exigidas no ano (art. 35 §único: ao menos uma
 * por semestre). Devolve o que falta, não um "ok/não ok" — quem preside
 * precisa saber qual semestre está descoberto.
 */
function gov_conselhoFiscalPendencias_(ano, reunioesRealizadas) {
  var alvo = Number(ano) || gov_hoje_().getFullYear();
  var feitas = (reunioesRealizadas || []).map(function (d) { return gov_data_(d); })
    .filter(function (d) { return d.getFullYear() === alvo; });

  var s1 = feitas.filter(function (d) { return d.getMonth() <= 5; }).length;
  var s2 = feitas.filter(function (d) { return d.getMonth() >= 6; }).length;

  var pendencias = [];
  if (s1 < 1) pendencias.push("1º semestre de " + alvo + " sem reunião ordinária registrada.");
  if (s2 < 1) pendencias.push("2º semestre de " + alvo + " sem reunião ordinária registrada.");

  return {
    ano: alvo, exigidasNoAno: GOV_CONSELHO_FISCAL_REUNIOES_POR_ANO,
    realizadas: feitas.length, primeiroSemestre: s1, segundoSemestre: s2,
    emDia: pendencias.length === 0, pendencias: pendencias,
    artigo: "Estatuto, art. 35, parágrafo único"
  };
}

/* ==========================================================================
 * ENDPOINTS
 * ========================================================================== */

/** Composição empossada, agrupada por órgão. */
function govComposicao(tokenSessao) {
  exigirModulo_(tokenSessao, GOV_MODULO, false);

  var porOrgao = {};
  Object.keys(GOV_ORGAOS).forEach(function (o) {
    porOrgao[o] = { rotulo: GOV_ORGAOS[o].rotulo, artigo: GOV_ORGAOS[o].artigo,
      efetivos: [], suplentes: [] };
  });

  GOV_COMPOSICAO.forEach(function (p) {
    var g = porOrgao[p.orgao];
    if (!g) return;
    var item = { nome: p.nome, cargo: p.cargo, ordem: p.ordem, moduloSisgep: p.moduloSisgep || "" };
    (p.condicao === "SUPLENTE" ? g.suplentes : g.efetivos).push(item);
  });

  return {
    ok: true, mandato: gov_situacaoMandato_(), orgaos: porOrgao,
    total: GOV_COMPOSICAO.length,
    aviso: "Esta composição não concede acesso a módulo nenhum. Permissão de " +
      "sistema é definida em Configurações › Acessos."
  };
}

/** Situação do mandato e a janela do edital de eleição. */
function govMandato(tokenSessao) {
  exigirModulo_(tokenSessao, GOV_MODULO, false);
  return { ok: true, mandato: gov_situacaoMandato_() };
}

/** Quem responde estatutariamente por um módulo do SISGEP. */
function govResponsavelPorModulo(modulo, tokenSessao) {
  exigirModulo_(tokenSessao, GOV_MODULO, false);
  var alvo = String(modulo || "").trim();
  if (!alvo) return { ok: false, mensagem: "Informe o módulo." };

  var achados = GOV_COMPOSICAO.filter(function (p) {
    return p.moduloSisgep === alvo && p.condicao === "EFETIVO";
  }).map(function (p) {
    return { nome: p.nome, cargo: p.cargo, orgao: GOV_ORGAOS[p.orgao].rotulo };
  });

  if (!achados.length) {
    return { ok: true, total: 0, responsaveis: [],
      mensagem: "Nenhum cargo da gestão " + GOV_MANDATO.gestao + " responde " +
        "diretamente pelo módulo \"" + alvo + "\". Isso não é erro: nem todo " +
        "módulo do sistema corresponde a uma secretaria." };
  }
  return { ok: true, total: achados.length, responsaveis: achados };
}

/** Pendências de reunião do Conselho Fiscal (art. 35 §único). */
function govConselhoFiscal(ano, reunioesRealizadas, tokenSessao) {
  exigirModulo_(tokenSessao, GOV_MODULO, false);
  var conselho = GOV_COMPOSICAO.filter(function (p) {
    return p.orgao === "CONSELHO_FISCAL";
  });
  return {
    ok: true,
    composicao: conselho.map(function (p) {
      return { nome: p.nome, condicao: p.condicao, ordem: p.ordem };
    }),
    competencia: "Fiscalização da gestão financeira e patrimonial (art. 34). " +
      "O parecer sobre o Plano Orçamentário e sobre os balanços é apreciado " +
      "pela Diretoria Executiva e deliberado pela Assembleia Geral (art. 35).",
    calendario: gov_conselhoFiscalPendencias_(ano, reunioesRealizadas)
  };
}
