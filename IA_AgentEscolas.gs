// ============================================================================
// ARQUIVO: IA_AgentEscolas.gs
// AGENTE DE ESCOLAS — Piloto v0.1 (READ_ONLY)
//
// Objetivo:
//   Criar a primeira camada de agente especializado da SOFIA sobre o cadastro
//   mestre de Escolas, usando EscolaID como identidade canonica.
//
// Regras deste piloto:
//   - SOMENTE LEITURA: este arquivo nao altera planilhas nem dispara efeitos.
//   - A entrada publica exige permissao de leitura do modulo Escolas.
//   - Escola e resolvida exclusivamente por EscolaID (incluindo fusoes).
//   - Nao faz casamento por nome, CNPJ, razao social ou texto aproximado.
//   - Pendencias sao detectadas pelo codigo canonico de EscolasPendencias.gs;
//     este arquivo nao duplica as regras de validacao.
//   - Fontes que ainda nao possuem consulta canonica por EscolaID ficam
//     explicitamente como NAO_INTEGRADO — nunca sao adivinhadas.
//   - Nao chama modelo de IA nesta versao. A analise e deterministica para
//     provar identidade, permissoes, evidencias e ausencia de alucinacao.
//
// Endpoint para a futura UI:
//   analisarEscolaComSofia(escolaId, tokenSessao)
//
// Endpoint tecnico:
//   agenteEscolasAnalisar(escolaId, tokenSessao)
// ============================================================================

var AGENTE_ESCOLAS_NOME_ = "AgentEscolas";
var AGENTE_ESCOLAS_VERSAO_ = "0.1.0";
var AGENTE_ESCOLAS_MODO_ = "READ_ONLY";
var AGENTE_ESCOLAS_NAO_LOCALIZADO_ = "Informação não localizada nos dados disponíveis.";

/**
 * Alias intencional para a UI da SOFIA.
 * Mantem o nome tecnico do agente separado do texto do botao.
 */
function analisarEscolaComSofia(escolaId, tokenSessao) {
  return agenteEscolasAnalisar(escolaId, tokenSessao);
}

/**
 * Analisa UMA escola, identificada somente por EscolaID.
 *
 * @param {string} escolaId     Identidade canonica ESC-xxxxxx.
 * @param {string} tokenSessao  Sessao do SISGEP.
 * @return {Object} analise estruturada, sem efeitos colaterais.
 */
function agenteEscolasAnalisar(escolaId, tokenSessao) {
  var inicio = new Date().getTime();
  var sessao = exigirModulo_(tokenSessao, "escolas", false);
  var idInformado = String(escolaId || "").trim().toUpperCase();

  try {
    if (!idInformado) {
      return agenteEscolasFalha_("", "Informe o EscolaID para realizar a análise.", inicio, sessao);
    }

    // Falha fechado: se a camada de identidade canonica nao estiver disponivel,
    // o agente nao tenta compensar procurando por nome ou documento.
    if (typeof escolaResolverIdentidade !== "function" || typeof escolaPorId !== "function") {
      return agenteEscolasFalha_(
        idInformado,
        "A identidade canônica de Escolas não está disponível nesta versão do SISGEP.",
        inicio,
        sessao
      );
    }

    var identidade = escolaResolverIdentidade(idInformado, tokenSessao);
    if (!identidade || !identidade.ok || !identidade.idAtual) {
      return agenteEscolasFalha_(
        idInformado,
        "EscolaID inválido ou não reconhecido. " + AGENTE_ESCOLAS_NAO_LOCALIZADO_,
        inicio,
        sessao
      );
    }

    var idAtual = String(identidade.idAtual || "").trim().toUpperCase();
    var fonteCadastro = agenteEscolasFonteSegura_("cadastro", function() {
      return escolaPorId(idAtual, tokenSessao);
    });

    if (!fonteCadastro.ok) {
      return agenteEscolasFalha_(
        idAtual,
        "Não foi possível consultar o cadastro da escola: " + fonteCadastro.erro,
        inicio,
        sessao
      );
    }

    var escola = fonteCadastro.dados;
    if (!escola) {
      return agenteEscolasFalha_(
        idAtual,
        AGENTE_ESCOLAS_NAO_LOCALIZADO_,
        inicio,
        sessao
      );
    }

    var cadastro = agenteEscolasCadastroSeguro_(escola, idAtual);

    // Reusa o calculo canonico de pendencias. Como o endpoint ja validou o
    // modulo, chamamos o nucleo interno e depois exigimos casamento EXATO do id.
    var fontePendencias = agenteEscolasFonteSegura_("pendencias", function() {
      if (typeof escolasPendenciasCalcular_ !== "function") {
        throw new Error("Fonte de pendências indisponível.");
      }
      var resultado = escolasPendenciasCalcular_({
        busca: idAtual,
        pagina: 1,
        porPagina: 200,
        ordem: "GRAVIDADE"
      });
      if (!resultado || resultado.ok === false) {
        throw new Error((resultado && resultado.mensagem) || "Falha ao calcular pendências.");
      }
      var lista = Array.isArray(resultado.escolas) ? resultado.escolas : [];
      for (var i = 0; i < lista.length; i++) {
        if (String(lista[i].escolaId || "").trim().toUpperCase() === idAtual) return lista[i];
      }
      return null; // null aqui significa: nenhuma pendencia detectada para este id.
    });

    var pendencias = [];
    if (fontePendencias.ok && fontePendencias.dados && Array.isArray(fontePendencias.dados.pendencias)) {
      pendencias = fontePendencias.dados.pendencias;
    }

    var achados = [];
    var evidencias = [];
    var dadosAusentes = [];
    var prioridades = [];
    var recomendacoes = [];

    // Pendencias formais: a deteccao vem de EscolasPendencias.gs.
    for (var p = 0; p < pendencias.length; p++) {
      var pend = pendencias[p] || {};
      var tipo = String(pend.tipo || "").trim().toUpperCase();
      if (!tipo) continue;

      var meta = agenteEscolasMetaPendencia_(tipo);
      achados.push({
        tipo: tipo,
        titulo: meta.rotulo || tipo,
        gravidade: meta.gravidade,
        descricao: meta.impacto || AGENTE_ESCOLAS_NAO_LOCALIZADO_
      });
      evidencias.push({
        fonte: "EscolasPendencias",
        entidade: "Escola",
        entidadeId: idAtual,
        campo: "pendencias",
        valor: tipo
      });

      var rec = agenteEscolasRecomendacaoPendencia_(tipo);
      if (rec && recomendacoes.indexOf(rec) === -1) recomendacoes.push(rec);
    }

    // Lacunas cadastrais de apresentacao. Nao criam uma segunda regra de
    // pendencia; apenas explicitam quais dados estao vazios no registro lido.
    agenteEscolasRegistrarAusencia_(dadosAusentes, evidencias, idAtual,
      "documento", cadastro.documentoMascarado,
      cadastro.documentoTipo === "CPF" ? "CPF/CNPJ" : "CNPJ/CPF");
    agenteEscolasRegistrarAusencia_(dadosAusentes, evidencias, idAtual,
      "email", cadastro.email, "E-mail principal");
    if (!cadastro.telefone && !cadastro.whatsapp) {
      dadosAusentes.push("Telefone/WhatsApp");
      evidencias.push({
        fonte: "Escolas",
        entidade: "Escola",
        entidadeId: idAtual,
        campo: "Telefone 1 / Telefone 2",
        status: "AUSENTE"
      });
    }
    agenteEscolasRegistrarAusencia_(dadosAusentes, evidencias, idAtual,
      "situacao", cadastro.situacao, "Situação cadastral");
    agenteEscolasRegistrarAusencia_(dadosAusentes, evidencias, idAtual,
      "uf", cadastro.uf, "UF");

    // Responsavel nao e uma pendencia estrutural oficial, mas e util para CRM.
    if (!cadastro.responsavel) {
      dadosAusentes.push("Responsável institucional");
      recomendacoes.push("Confirmar e registrar o responsável institucional da escola para facilitar os próximos contatos.");
      evidencias.push({
        fonte: "Escolas",
        entidade: "Escola",
        entidadeId: idAtual,
        campo: "Responsavel",
        status: "AUSENTE"
      });
    }

    var nivelPrioridade = agenteEscolasNivelPrioridade_(pendencias, fontePendencias);
    prioridades.push({
      nivel: nivelPrioridade,
      motivo: agenteEscolasMotivoPrioridade_(nivelPrioridade, pendencias, fontePendencias)
    });

    if (!recomendacoes.length) {
      recomendacoes.push("Manter o cadastro atualizado e acompanhar as próximas interações registradas no SISGEP.");
    }

    if (!achados.length && fontePendencias.ok) {
      achados.push({
        tipo: "SEM_PENDENCIA_CADASTRAL_DETECTADA",
        titulo: "Cadastro sem pendências formais detectadas",
        gravidade: 0,
        descricao: "A fonte canônica de pendências não identificou irregularidades cadastrais para esta escola."
      });
      evidencias.push({
        fonte: "EscolasPendencias",
        entidade: "Escola",
        entidadeId: idAtual,
        campo: "pendencias",
        valor: "0"
      });
    }

    var fontes = {
      cadastro: {
        status: fonteCadastro.ok ? "OK" : "ERRO",
        integracao: "escolaPorId",
        identidade: "EscolaID"
      },
      pendencias: {
        status: fontePendencias.ok ? "OK" : "ERRO",
        integracao: "escolasPendenciasCalcular_",
        identidade: "EscolaID",
        erro: fontePendencias.ok ? "" : fontePendencias.erro
      },
      associados: {
        status: "NAO_INTEGRADO",
        motivo: "A leitura atual de associados ainda não expõe vínculo canônico por EscolaID para este agente."
      },
      financeiro: {
        status: "NAO_INTEGRADO",
        motivo: "O piloto não usa cruzamento financeiro enquanto não houver contrato de leitura por EscolaID com permissão própria."
      },
      historicoOficios: {
        status: "NAO_INTEGRADO",
        motivo: "A análise antiga filtra ofícios por nome. O AgentEscolas v0.1 não usa casamento textual."
      },
      visitas: {
        status: "NAO_INTEGRADO",
        motivo: "A fonte será conectada somente quando a consulta por EscolaID estiver validada para leitura."
      }
    };

    var totalPendencias = pendencias.length;
    var resposta = {
      ok: true,
      agente: AGENTE_ESCOLAS_NOME_,
      versao: AGENTE_ESCOLAS_VERSAO_,
      modo: AGENTE_ESCOLAS_MODO_,
      escolaId: idAtual,
      identidade: {
        idOriginal: String(identidade.idOriginal || idInformado).trim().toUpperCase(),
        idAtual: idAtual,
        fundida: identidade.fundida === true
      },
      resumo: {
        escola: cadastro.nome || AGENTE_ESCOLAS_NAO_LOCALIZADO_,
        fantasia: cadastro.fantasia || AGENTE_ESCOLAS_NAO_LOCALIZADO_,
        situacao: cadastro.situacao || AGENTE_ESCOLAS_NAO_LOCALIZADO_,
        prioridade: nivelPrioridade,
        totalPendencias: totalPendencias,
        mensagem: agenteEscolasResumo_(cadastro, nivelPrioridade, totalPendencias, fontePendencias)
      },
      cadastro: cadastro,
      achados: achados,
      evidencias: evidencias,
      prioridades: prioridades,
      recomendacoes: recomendacoes,
      dadosAusentes: agenteEscolasUnicos_(dadosAusentes),
      fontes: fontes,
      geradoEm: new Date().toISOString()
    };

    agenteEscolasAuditar_(sessao, idAtual, resposta, inicio, true);
    return resposta;

  } catch (e) {
    return agenteEscolasFalha_(
      idInformado,
      "Erro ao analisar escola: " + String((e && e.message) || e),
      inicio,
      sessao
    );
  }
}

/** Metadados publicos do piloto; nao consulta dados de escola. */
function agenteEscolasVersao() {
  return {
    agente: AGENTE_ESCOLAS_NOME_,
    versao: AGENTE_ESCOLAS_VERSAO_,
    modo: AGENTE_ESCOLAS_MODO_
  };
}

/* ========================================================================== */
/* HELPERS INTERNOS                                                           */
/* ========================================================================== */

function agenteEscolasFonteSegura_(nome, fn) {
  try {
    return { ok: true, nome: nome, dados: fn(), erro: "" };
  } catch (e) {
    return {
      ok: false,
      nome: nome,
      dados: null,
      erro: String((e && e.message) || e || "Erro desconhecido")
    };
  }
}

function agenteEscolasPrimeiro_(obj, chaves) {
  obj = obj || {};
  for (var i = 0; i < chaves.length; i++) {
    var v = obj[chaves[i]];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * Whitelist de campos enviados ao agente/UI.
 * Documento usa a versao mascarada produzida pelo proprio modulo de Escolas.
 */
function agenteEscolasCadastroSeguro_(escola, escolaId) {
  var documentoTipo = agenteEscolasPrimeiro_(escola, ["documentoTipo"]);
  var documentoMascarado = agenteEscolasPrimeiro_(escola, ["documentoMascarado"]);

  // Compatibilidade: CNPJ institucional pode ser mostrado; CPF nunca deve sair
  // cru daqui. Se a serializacao antiga nao trouxe documentoMascarado, mascara
  // pelo helper canonico quando disponivel.
  if (!documentoMascarado) {
    var docBruto = agenteEscolasPrimeiro_(escola, ["CNPJ", "cnpj"]);
    if (docBruto && typeof escolaDocMascarado_ === "function") {
      documentoMascarado = String(escolaDocMascarado_(docBruto) || "").trim();
    } else if (documentoTipo !== "CPF") {
      documentoMascarado = docBruto;
    }
  }

  return {
    escolaId: escolaId,
    nome: agenteEscolasPrimeiro_(escola, ["NomeEscola", "escola", "Escola (Razão Social)", "nome"]),
    fantasia: agenteEscolasPrimeiro_(escola, ["Fantasia", "fantasia", "NOME_FANTASIA"]),
    documentoTipo: documentoTipo,
    documentoMascarado: documentoMascarado,
    email: agenteEscolasPrimeiro_(escola, ["Email", "email", "E-mail (principal)"]),
    emailsTodos: agenteEscolasPrimeiro_(escola, ["EmailsTodos", "emailsTodos", "E-mails (todos)"]),
    telefone: agenteEscolasPrimeiro_(escola, ["Telefone", "telefone", "Telefone 1"]),
    whatsapp: agenteEscolasPrimeiro_(escola, ["Whatsapp", "whatsapp", "Telefone 2"]),
    municipio: agenteEscolasPrimeiro_(escola, ["Municipio", "municipio", "cidade", "Cidade"]),
    uf: agenteEscolasPrimeiro_(escola, ["UF", "uf"]),
    situacao: agenteEscolasPrimeiro_(escola, ["Situacao", "situacao", "SITUACAO_CADASTRAL"]),
    responsavel: agenteEscolasPrimeiro_(escola, ["Responsavel", "responsavel"]),
    cargoResponsavel: agenteEscolasPrimeiro_(escola, ["CargoResponsavel", "cargoResponsavel"]),
    rede: agenteEscolasPrimeiro_(escola, ["Rede", "rede"]),
    codigoInterno: agenteEscolasPrimeiro_(escola, ["CodigoInterno", "codigoInterno", "Unidade"])
  };
}

function agenteEscolasMetaPendencia_(tipo) {
  try {
    if (typeof ESC_PENDENCIAS !== "undefined" && Array.isArray(ESC_PENDENCIAS)) {
      for (var i = 0; i < ESC_PENDENCIAS.length; i++) {
        if (String(ESC_PENDENCIAS[i].chave || "").trim().toUpperCase() === tipo) {
          return {
            rotulo: ESC_PENDENCIAS[i].rotulo || tipo,
            impacto: ESC_PENDENCIAS[i].impacto || "",
            gravidade: Number(ESC_PENDENCIAS[i].gravidade) || 3
          };
        }
      }
    }
  } catch (e) {}
  return { rotulo: tipo, impacto: "", gravidade: 3 };
}

function agenteEscolasRecomendacaoPendencia_(tipo) {
  var mapa = {
    DADO_FORA_DO_LUGAR: "Revisar os campos sinalizados como dado fora do lugar antes de usar o cadastro em outros módulos.",
    SEM_DOCUMENTO: "Atualizar o CPF/CNPJ da escola pelo fluxo normal de Cadastro de Escolas.",
    SEM_EMAIL: "Cadastrar um e-mail institucional válido antes de preparar comunicações para esta escola.",
    SEM_TELEFONE: "Registrar telefone ou WhatsApp institucional como canal alternativo de contato.",
    SEM_SITUACAO: "Confirmar e registrar a situação cadastral da escola.",
    SEM_UF: "Completar a UF para permitir filtros e recortes territoriais corretos.",
    SEM_NOME: "Corrigir a razão social antes de prosseguir com outros fluxos vinculados à escola."
  };
  return mapa[tipo] || "Revisar a pendência " + tipo + " no Cadastro de Escolas.";
}

function agenteEscolasNivelPrioridade_(pendencias, fontePendencias) {
  if (!fontePendencias.ok) return "ATENCAO";
  if (!pendencias.length) return "NORMAL";

  var menor = 99;
  for (var i = 0; i < pendencias.length; i++) {
    var meta = agenteEscolasMetaPendencia_(String((pendencias[i] || {}).tipo || "").toUpperCase());
    if (meta.gravidade < menor) menor = meta.gravidade;
  }
  if (menor <= 1) return "ALTA";
  if (menor === 2) return "MEDIA";
  return "BAIXA";
}

function agenteEscolasMotivoPrioridade_(nivel, pendencias, fontePendencias) {
  if (!fontePendencias.ok) {
    return "A fonte canônica de pendências não pôde ser consultada; a análise deve ser tratada com atenção.";
  }
  if (!pendencias.length) return "Nenhuma pendência cadastral formal foi detectada pela fonte canônica.";
  return pendencias.length + " pendência(s) cadastral(is) detectada(s); prioridade calculada pela maior gravidade encontrada.";
}

function agenteEscolasResumo_(cadastro, prioridade, totalPendencias, fontePendencias) {
  var nome = cadastro.nome || "Esta escola";
  if (!fontePendencias.ok) {
    return nome + " foi localizada pelo EscolaID, mas a fonte de pendências está indisponível nesta análise.";
  }
  if (!totalPendencias) {
    return nome + " foi localizada pelo EscolaID e não possui pendências cadastrais formais detectadas nesta análise.";
  }
  return nome + " possui " + totalPendencias + " pendência(s) cadastral(is) detectada(s), com prioridade " + prioridade + ".";
}

function agenteEscolasRegistrarAusencia_(dadosAusentes, evidencias, escolaId, campo, valor, rotulo) {
  if (String(valor || "").trim()) return;
  dadosAusentes.push(rotulo);
  evidencias.push({
    fonte: "Escolas",
    entidade: "Escola",
    entidadeId: escolaId,
    campo: campo,
    status: "AUSENTE"
  });
}

function agenteEscolasUnicos_(lista) {
  var vistos = {};
  var saida = [];
  (lista || []).forEach(function(item) {
    var k = String(item || "").trim();
    if (!k || vistos[k]) return;
    vistos[k] = true;
    saida.push(k);
  });
  return saida;
}

function agenteEscolasFalha_(escolaId, mensagem, inicio, sessao) {
  var resposta = {
    ok: false,
    agente: AGENTE_ESCOLAS_NOME_,
    versao: AGENTE_ESCOLAS_VERSAO_,
    modo: AGENTE_ESCOLAS_MODO_,
    escolaId: String(escolaId || "").trim().toUpperCase(),
    resumo: {
      escola: AGENTE_ESCOLAS_NAO_LOCALIZADO_,
      situacao: AGENTE_ESCOLAS_NAO_LOCALIZADO_,
      prioridade: "ATENCAO",
      totalPendencias: 0,
      mensagem: String(mensagem || AGENTE_ESCOLAS_NAO_LOCALIZADO_)
    },
    achados: [],
    evidencias: [],
    prioridades: [{ nivel: "ATENCAO", motivo: String(mensagem || AGENTE_ESCOLAS_NAO_LOCALIZADO_) }],
    recomendacoes: ["Verificar o EscolaID e a disponibilidade das fontes antes de repetir a análise."],
    dadosAusentes: ["Cadastro da escola"],
    fontes: {},
    geradoEm: new Date().toISOString()
  };
  agenteEscolasAuditar_(sessao, resposta.escolaId, resposta, inicio, false);
  return resposta;
}

/**
 * Auditoria de alto nivel: registra id, modo, resultado e tempo.
 * Nao grava o payload completo, documento, contatos ou outros dados da escola.
 */
function agenteEscolasAuditar_(sessao, escolaId, resposta, inicio, sucesso) {
  try {
    var duracao = Math.max(0, new Date().getTime() - Number(inicio || 0));
    var total = resposta && resposta.resumo ? Number(resposta.resumo.totalPendencias || 0) : 0;
    var prioridade = resposta && resposta.resumo ? String(resposta.resumo.prioridade || "") : "";
    var detalhe = AGENTE_ESCOLAS_MODO_ +
      " | escolaId=" + String(escolaId || "") +
      " | pendencias=" + total +
      " | prioridade=" + prioridade +
      " | duracaoMs=" + duracao;

    if (typeof registrarAuditoriaSofia_ === "function") {
      registrarAuditoriaSofia_(
        sessao,
        "Escolas",
        AGENTE_ESCOLAS_NOME_ + " v" + AGENTE_ESCOLAS_VERSAO_ + ": " + String(escolaId || ""),
        detalhe,
        sucesso === true
      );
      return;
    }

    Logger.log("[" + AGENTE_ESCOLAS_NOME_ + "] " + detalhe + " | sucesso=" + (sucesso === true));
  } catch (e) {
    // Auditoria nunca deve derrubar uma consulta de leitura.
    Logger.log("[" + AGENTE_ESCOLAS_NOME_ + "] auditoria falhou: " + String((e && e.message) || e));
  }
}
