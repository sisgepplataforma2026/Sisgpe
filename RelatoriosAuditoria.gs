// ============================================================================
// ARQUIVO: RelatoriosAuditoria.gs
// RELATÓRIOS DE AUDITORIA — item 16.11 do PROMPT-MESTRE.
//
// Seis relatórios prontos, sem construtor de consulta. A escolha é
// deliberada: construtor de consulta genérico parece poderoso e na prática
// ninguém usa — quem precisa do relatório está com pressa e não vai montar
// filtro. Seis perguntas concretas, respondidas em um clique, servem mais.
//
// O SEXTO É O QUE FECHA O MÓDULO
// "Conformidade LGPD" não é lista: é a resposta a "estamos em dia?". Ele
// atravessa os sete submódulos construídos e devolve o que está pendente,
// com o motivo. É o relatório que se leva para uma reunião de diretoria.
//
// TODA EXPORTAÇÃO DAQUI SE REGISTRA
// Passa por aud_deExportacao_, como qualquer outra. Seria contraditório o
// relatório de auditoria ser a única coisa que sai do sistema sem deixar
// rastro — inclusive porque alguns deles levam nome de pessoa.
// ============================================================================

var RELAUD_MODULO = "auditoria";

var RELAUD_CATALOGO = {
  ATIVIDADE_USUARIO: {
    titulo: "Atividade por usuário",
    descricao: "Quantas ações cada pessoa fez no período, e quantas foram críticas.",
    dadoPessoal: true
  },
  ACOES_CRITICAS: {
    titulo: "Ações críticas do período",
    descricao: "Tudo que mexeu em dinheiro, desfez algo ou alterou permissão.",
    dadoPessoal: true
  },
  ACESSOS: {
    titulo: "Acessos e tentativas",
    descricao: "Entradas, saídas, senhas incorretas e bloqueios.",
    dadoPessoal: true
  },
  EXPORTACOES_PESSOAIS: {
    titulo: "Exportações com dado pessoal",
    descricao: "O que saiu do sistema levando dado que identifica alguém.",
    dadoPessoal: true
  },
  CONFORMIDADE_LGPD: {
    titulo: "Conformidade LGPD",
    descricao: "O que está pendente hoje, atravessando todos os submódulos.",
    dadoPessoal: false
  },
  VIDA_DO_REGISTRO: {
    titulo: "Trilha completa de um registro",
    descricao: "Tudo que aconteceu com um ofício, despesa ou ficha, do começo ao fim.",
    dadoPessoal: false
  }
};

function relAudCatalogo(tokenSessao) {
  exigirModulo_(tokenSessao, RELAUD_MODULO, false);
  return { ok: true, relatorios: RELAUD_CATALOGO };
}

/* ==========================================================================
 * OS SEIS
 * ========================================================================== */

/**
 * Gera o relatório. Devolve { colunas, linhas, resumo } — a tela desenha e
 * a exportação usa a mesma coisa, para não haver risco de a tela mostrar
 * uma coisa e o arquivo levar outra.
 */
function relAudGerar(tipo, filtros, tokenSessao) {
  exigirModulo_(tokenSessao, RELAUD_MODULO, false);
  tipo = String(tipo || "").toUpperCase();
  filtros = filtros || {};

  var cfg = RELAUD_CATALOGO[tipo];
  if (!cfg) return { ok: false, mensagem: "Relatório desconhecido." };

  var base = { ok: true, tipo: tipo, titulo: cfg.titulo, dadoPessoal: cfg.dadoPessoal,
               periodo: { de: filtros.de || "", ate: filtros.ate || "" } };

  if (tipo === "ATIVIDADE_USUARIO")     return Object.assign(base, relAud_atividade_(filtros, tokenSessao));
  if (tipo === "ACOES_CRITICAS")        return Object.assign(base, relAud_criticas_(filtros, tokenSessao));
  if (tipo === "ACESSOS")               return Object.assign(base, relAud_acessos_(filtros, tokenSessao));
  if (tipo === "EXPORTACOES_PESSOAIS")  return Object.assign(base, relAud_exportacoes_(filtros, tokenSessao));
  if (tipo === "CONFORMIDADE_LGPD")     return Object.assign(base, relAud_conformidade_(tokenSessao));
  if (tipo === "VIDA_DO_REGISTRO")      return Object.assign(base, relAud_vidaRegistro_(filtros, tokenSessao));

  return { ok: false, mensagem: "Relatório não implementado." };
}

function relAud_trilha_(filtros, tokenSessao, extras) {
  var f = Object.assign({ limite: 1000 }, extras || {});
  if (filtros.de) f.de = filtros.de;
  if (filtros.ate) f.ate = filtros.ate;
  return auditoriaConsultar(f, tokenSessao);
}

function relAud_atividade_(filtros, tokenSessao) {
  var r = relAud_trilha_(filtros, tokenSessao);
  var porPessoa = {};
  (r.acoes || []).forEach(function (a) {
    var k = a.usuario || "—";
    if (!porPessoa[k]) porPessoa[k] = { total: 0, criticas: 0, falhas: 0, modulos: {} };
    porPessoa[k].total++;
    if (a.critica) porPessoa[k].criticas++;
    if (String(a.resultado) === "FALHA") porPessoa[k].falhas++;
    porPessoa[k].modulos[a.modulo || "—"] = true;
  });

  var linhas = Object.keys(porPessoa).map(function (k) {
    var p = porPessoa[k];
    return [k, p.total, p.criticas, p.falhas, Object.keys(p.modulos).sort().join(", ")];
  }).sort(function (a, b) { return b[1] - a[1]; });

  return {
    colunas: ["Usuário", "Ações", "Críticas", "Falhas", "Módulos"],
    linhas: linhas,
    resumo: linhas.length + " pessoa(s) · " + (r.acoes || []).length + " ação(ões) no período",
    truncado: r.truncado === true
  };
}

function relAud_criticas_(filtros, tokenSessao) {
  var r = relAud_trilha_(filtros, tokenSessao, { apenasCriticas: true });
  var linhas = (r.acoes || []).map(function (a) {
    return [relAud_data_(a.dataHora), a.modulo || "—", a.submodulo || "",
            a.acao || "", a.usuario || "—", a.registroId || "",
            a.resultado || "", a.justificativa || ""];
  });
  return {
    colunas: ["Data/hora", "Módulo", "Submódulo", "Ação", "Quem", "Registro", "Resultado", "Justificativa"],
    linhas: linhas,
    resumo: linhas.length + " ação(ões) crítica(s) no período",
    truncado: r.truncado === true
  };
}

function relAud_acessos_(filtros, tokenSessao) {
  var r = relAud_trilha_(filtros, tokenSessao, { modulo: "Segurança" });
  var rotulo = {
    ENTRAR: "Entrou", SAIR: "Saiu",
    SENHA_INCORRETA: "Senha incorreta", BLOQUEIO_POR_TENTATIVAS: "Bloqueado"
  };
  var linhas = (r.acoes || []).map(function (a) {
    return [relAud_data_(a.dataHora), rotulo[a.acao] || a.acao, a.usuario || "—",
            a.justificativa || "", a.origem || ""];
  });
  var falhas = (r.acoes || []).filter(function (a) { return a.acao === "SENHA_INCORRETA"; }).length;
  var bloqueios = (r.acoes || []).filter(function (a) { return a.acao === "BLOQUEIO_POR_TENTATIVAS"; }).length;
  return {
    colunas: ["Data/hora", "O que houve", "Quem", "Detalhe", "Origem"],
    linhas: linhas,
    resumo: linhas.length + " evento(s) · " + falhas + " senha(s) incorreta(s) · " + bloqueios + " bloqueio(s)",
    // Repetido aqui de propósito: quem lê o relatório de acesso está quase
    // sempre atrás do endereço, e precisa saber que não vai encontrar.
    aviso: "O Apps Script não informa o endereço de rede de quem acessa. A coluna Origem diz por " +
           "onde a ação entrou, não de qual máquina.",
    truncado: r.truncado === true
  };
}

function relAud_exportacoes_(filtros, tokenSessao) {
  var r = relAud_trilha_(filtros, tokenSessao, { acao: "EXPORTAR" });
  var linhas = [];
  (r.acoes || []).forEach(function (a) {
    var v = a.valorNovo;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    v = v || {};
    if (v.dadoPessoal !== true) return;   // só as que levaram dado pessoal
    linhas.push([relAud_data_(a.dataHora), a.modulo || "—", a.submodulo || "",
                 v.total === undefined ? "" : v.total, v.formato || "",
                 a.usuario || "—", a.justificativa || ""]);
  });
  return {
    colunas: ["Data/hora", "Módulo", "Submódulo", "Registros", "Formato", "Quem", "Detalhe"],
    linhas: linhas,
    resumo: linhas.length + " exportação(ões) com dado pessoal no período",
    aviso: "Não alcança o que sai por fora do SISGEP — planilha aberta direto, cópia de tela, " +
           "print ou anexo de e-mail.",
    truncado: r.truncado === true
  };
}

/**
 * O relatório que responde "estamos em dia?".
 *
 * Atravessa os submódulos e devolve o que está PENDENTE, com o motivo. Cada
 * item traz a situação e o que fazer — relatório de conformidade que só diz
 * "não conforme" obriga a pessoa a descobrir sozinha o que fazer, e aí
 * ninguém usa.
 *
 * Item que não pôde ser verificado sai como INDETERMINADO, nunca como
 * conforme. Painel de compliance que erra para o lado otimista cria a
 * impressão de conformidade sem a conformidade.
 */
function relAud_conformidade_(tokenSessao) {
  var itens = [];

  function item(area, situacao, detalhe, acao) {
    itens.push([area, situacao, detalhe, acao || ""]);
  }

  // 1. Expurgo automático
  try {
    var ret = lgpdPainelRetencao(tokenSessao);
    if (ret.gatilhoConhecido === false) {
      item("Retenção e descarte", "INDETERMINADO",
        "Não consegui verificar o gatilho de expurgo", "Abrir Retenção e Descarte");
    } else if (ret.gatilhoInstalado) {
      item("Retenção e descarte", "EM DIA",
        "Expurgo automático ativo, diário às " + ret.horaGatilho, "");
    } else {
      item("Retenção e descarte", "PENDENTE",
        "Expurgo automático NÃO instalado — nenhum dado vencido está sendo apagado",
        "Instalar em Auditoria › Retenção e Descarte");
    }
    if (!ret.ultimoExpurgo) {
      item("Retenção e descarte", "PENDENTE",
        "Não há registro de nenhum expurgo executado",
        "Executar uma vez para haver o que apresentar");
    }
  } catch (e) {
    item("Retenção e descarte", "INDETERMINADO", "Falha ao consultar: " + e.message, "");
  }

  // 2. Incidentes com prazo correndo
  try {
    var inc = incListar({}, tokenSessao);
    if (inc.vencendo && inc.vencendo.length) {
      item("Incidentes", "PENDENTE",
        inc.vencendo.length + " incidente(s) com prazo de comunicação vencido ou vencendo",
        "Abrir Auditoria › Incidentes");
    } else {
      item("Incidentes", "EM DIA",
        (inc.total || 0) + " incidente(s) registrado(s), nenhum com prazo aberto", "");
    }
  } catch (e) {
    item("Incidentes", "INDETERMINADO", "Falha ao consultar: " + e.message, "");
  }

  // 3. Pedidos de titular
  try {
    var tit = titPainel(tokenSessao);
    if (tit.vencendo && tit.vencendo.length) {
      item("Direitos do titular", "PENDENTE",
        tit.vencendo.length + " pedido(s) com prazo vencido ou vencendo",
        "Abrir Auditoria › LGPD e Direitos");
    } else {
      item("Direitos do titular", "EM DIA",
        (tit.total || 0) + " pedido(s) registrado(s), nenhum com prazo aberto", "");
    }
  } catch (e) {
    item("Direitos do titular", "INDETERMINADO", "Falha ao consultar: " + e.message, "");
  }

  // 4. Links públicos ativos
  try {
    var lnk = compartListar({}, tokenSessao);
    var ativos = (lnk.resumo && lnk.resumo.ATIVO) || 0;
    item("Compartilhamentos",
      ativos ? "ATENÇÃO" : "EM DIA",
      ativos + " link(s) público(s) ativo(s) — abrem sem login",
      ativos ? "Revisar em Auditoria › Compartilhamentos" : "");
  } catch (e) {
    item("Compartilhamentos", "INDETERMINADO", "Falha ao consultar: " + e.message, "");
  }

  // 5. Onde a trilha está gravando
  try {
    var painel = auditoriaPainel(tokenSessao);
    if (painel.fonte === "FIRESTORE") {
      item("Trilha de auditoria", "EM DIA",
        painel.total + " registro(s) no Firestore, imutáveis", "");
    } else {
      item("Trilha de auditoria", "PENDENTE",
        "Trilha na planilha de reserva — quem tem acesso à planilha pode alterar o registro",
        "Configurar o Firestore (ver FirebaseCore.gs)");
    }
  } catch (e) {
    item("Trilha de auditoria", "INDETERMINADO", "Falha ao consultar: " + e.message, "");
  }

  // 6. Consentimentos — honestidade sobre o que não existe
  item("Consentimentos", "NÃO IMPLEMENTADO",
    "O sindicato não coleta consentimento em nenhum ponto do sistema",
    "Decidir se a ficha de filiação passa a coletar");

  var pendentes = itens.filter(function (i) { return i[1] === "PENDENTE"; }).length;
  var indeterminados = itens.filter(function (i) { return i[1] === "INDETERMINADO"; }).length;

  return {
    colunas: ["Área", "Situação", "O que foi verificado", "O que fazer"],
    linhas: itens,
    resumo: pendentes + " pendência(s) · " + indeterminados + " item(ns) não verificável(is) · " +
            itens.filter(function (i) { return i[1] === "EM DIA"; }).length + " em dia",
    pendentes: pendentes,
    indeterminados: indeterminados
  };
}

function relAud_vidaRegistro_(filtros, tokenSessao) {
  var id = String(filtros.registroId || "").trim();
  if (!id) {
    return { colunas: [], linhas: [], resumo: "",
      mensagem: "Informe o número do ofício, ID da despesa ou da ficha." };
  }
  var r = auditoriaConsultar({ registroId: id, limite: 1000 }, tokenSessao);
  var linhas = (r.acoes || []).slice().reverse().map(function (a) {
    return [relAud_data_(a.dataHora), a.modulo || "—", a.acao || "",
            a.usuario || "—", a.resultado || "", a.justificativa || ""];
  });
  return {
    colunas: ["Data/hora", "Módulo", "Ação", "Quem", "Resultado", "Detalhe"],
    linhas: linhas,
    // Do mais antigo para o mais novo: aqui se quer ler a história, não o
    // que aconteceu por último.
    resumo: linhas.length
      ? linhas.length + " ação(ões) registrada(s) para " + id + ", da mais antiga para a mais nova"
      : "Nenhuma ação registrada para " + id + ". Pode não ter havido movimento, ou o módulo " +
        "responsável ainda não estar ligado à trilha."
  };
}

function relAud_data_(v) {
  try {
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  } catch (e) { return ""; }
}

/* ==========================================================================
 * EXPORTAÇÃO
 * ========================================================================== */

/**
 * Devolve o relatório em linhas para a tela montar o CSV — e REGISTRA a
 * exportação.
 *
 * Registrar no servidor, e não no navegador, é o que impede o registro de
 * ser pulado: quem quisesse exportar sem deixar rastro só precisaria não
 * chamar a função de log, se ela morasse no cliente.
 */
function relAudExportar(tipo, filtros, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, RELAUD_MODULO, false);
  var r = relAudGerar(tipo, filtros, tokenSessao);
  if (!r.ok) return r;

  aud_deExportacao_({
    modulo: "Auditoria e Compliance", submodulo: "Relatórios",
    formato: "CSV", total: (r.linhas || []).length,
    dadoPessoal: r.dadoPessoal === true,
    filtros: { relatorio: r.titulo, de: filtros && filtros.de, ate: filtros && filtros.ate },
    sessao: sessao
  });

  return r;
}
