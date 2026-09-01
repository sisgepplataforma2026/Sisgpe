// ================================
// ARQUIVO: RHTempoServico.gs
// MÓDULO: RH — Elegibilidade a adicional por tempo de serviço (Quinquênio/Decênio e além)
//
// Regra confirmada pelo usuário: soma 5% do salário a cada 5 anos
// ININTERRUPTOS de admissão, até um teto de 35 anos (ou seja, no máximo
// 7 quinquênios = 35%). Cláusula 11 da CCT (CCTCore.gs) diz "5% a cada
// 5 anos ininterruptos na mesma empresa" — a base bate com o que já foi
// observado nos dados reais (Quinquênio = 5% do salário para quem tem
// de 5 a 9 anos; Decênio = 10% para 10 a 14 anos, sem somar com
// quinquênio) — o usuário confirmou que o acúmulo continua além disso,
// até 35 anos.
//
// Só existem códigos REAIS da contabilidade (IMPACTO CONSULTORIA) para
// Quinquênio (292) e Decênio (355), porque nenhum dos 7 colaboradores
// reais passou de ~17 anos ainda. Para as faixas de 15/20/25/30/35 anos
// — que ainda não apareceram em nenhum extrato real — o catálogo usa
// códigos internos provisórios (TS15/TS20/TS25/TS30/TS35, "TS" = Tempo
// de Serviço), criados automaticamente na primeira vez que alguém
// alcançar a faixa. Se um dia a contabilidade usar um código numérico
// diferente pra isso, é só atualizar o RH_TEMPO_SERVICO_TIERS_ abaixo —
// os valores/percentuais continuam corretos, só muda o código.
//
// Gratificação de Caixa (Cláusula 09 da CCT, 10% do salário) NÃO entra
// aqui — usuário confirmou que nenhum dos 7 colaboradores exerce função
// de caixa hoje. Fica de fora até que alguém passe a exercer.
// ================================

var RH_TEMPO_SERVICO_TETO_ANOS_ = 35;

var RH_TEMPO_SERVICO_TIERS_ = [
  { anos: 5, codigo: "292", descricao: "Quinquênio", percentual: 5 },
  { anos: 10, codigo: "355", descricao: "Decênio", percentual: 10 },
  { anos: 15, codigo: "TS15", descricao: "Adicional Tempo de Serviço 15 anos", percentual: 15 },
  { anos: 20, codigo: "TS20", descricao: "Adicional Tempo de Serviço 20 anos", percentual: 20 },
  { anos: 25, codigo: "TS25", descricao: "Adicional Tempo de Serviço 25 anos", percentual: 25 },
  { anos: 30, codigo: "TS30", descricao: "Adicional Tempo de Serviço 30 anos", percentual: 30 },
  { anos: 35, codigo: "TS35", descricao: "Adicional Tempo de Serviço 35 anos", percentual: 35 }
];

function rh_anosServicoCompletos_(admissaoISO, dataRef) {
  if (!admissaoISO) return null;
  var admissao = new Date(admissaoISO + "T00:00:00");
  if (isNaN(admissao.getTime())) return null;
  var ref = dataRef || new Date();
  var anos = ref.getFullYear() - admissao.getFullYear();
  var aniversarioEsteAno = new Date(ref.getFullYear(), admissao.getMonth(), admissao.getDate());
  if (ref < aniversarioEsteAno) anos--;
  return Math.max(0, anos);
}

// Devolve a faixa (tier) vigente para X anos de serviço — a última cujo
// "anos" mínimo já foi atingido, nunca passando do teto de 35 anos.
// null quando ainda não completou nem o primeiro quinquênio (5 anos).
function rh_faixaTempoServico_(anos) {
  if (anos === null || anos < 5) return null;
  var anosLimitados = Math.min(anos, RH_TEMPO_SERVICO_TETO_ANOS_);
  var faixa = null;
  RH_TEMPO_SERVICO_TIERS_.forEach(function (tier) {
    if (anosLimitados >= tier.anos) faixa = tier;
  });
  return faixa;
}

// Garante que a rubrica da faixa existe no catálogo (RH_RUBRICAS) —
// cria na primeira vez que alguém alcançar aquela faixa, sem exigir
// sessão de usuário (usado também pela rotina automática).
function rh_garantirRubricaFaixaTempoServico_(tier) {
  var existentes = rh_listarRubricas_interno_();
  var achada = existentes.filter(function (r) { return r.codigo === tier.codigo; })[0];
  if (achada) return achada;

  var sh = rh_garantirRubricasCatalogo_();
  var novoId = rh_gerarId_("RUB");
  sh.appendRow([novoId, tier.codigo, tier.descricao, "Provento", true, "SISGEP (tempo de serviço)", new Date()]);
  return { id: novoId, codigo: tier.codigo, descricao: tier.descricao, tipo: "Provento", ativo: true };
}

/* =========================================
 * VERIFICAÇÃO — só leitura, compara o que já está aplicado (rubricas
 * fixas) contra o que o tempo de serviço calcula agora.
 * ========================================= */

function verificarQuinquenioDecenioRH_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return rh_verificarQuinquenioDecenio_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao verificar: " + e.message };
  }
}

function rh_codigosDeFaixas_() {
  return RH_TEMPO_SERVICO_TIERS_.map(function (t) { return t.codigo; });
}

function rh_verificarQuinquenioDecenio_() {
  var colaboradores = listarColaboradoresRH_interno_().filter(function (c) { return c.status !== "Desligado"; });
  var hoje = new Date();
  var codigosFaixas = rh_codigosDeFaixas_();

  var itens = colaboradores.map(function (c) {
    var anos = rh_anosServicoCompletos_(c.admissao, hoje);
    var faixaCalculada = anos === null ? null : rh_faixaTempoServico_(anos);

    var fixas = rh_listarRubricasFixasColaborador_interno_(c.id).filter(function (f) { return f.ativo; });
    var fixaAtual = fixas.filter(function (f) { return codigosFaixas.indexOf(f.codigo) !== -1; })[0] || null;

    var codigoCalculado = faixaCalculada ? faixaCalculada.codigo : "NENHUM";
    var codigoAtual = fixaAtual ? fixaAtual.codigo : "NENHUM";
    var semAdmissao = anos === null;

    return {
      colaboradorId: c.id, nome: c.nome, admissao: c.admissao, anosServico: anos,
      semAdmissao: semAdmissao,
      elegibilidadeCalculada: semAdmissao ? "SEM_ADMISSAO" : codigoCalculado,
      elegibilidadeLabel: semAdmissao ? "(sem data de admissão)" : (faixaCalculada ? faixaCalculada.descricao + " (" + faixaCalculada.percentual + "%)" : "nenhum"),
      situacaoAtual: codigoAtual,
      situacaoAtualLabel: fixaAtual ? fixaAtual.descricao : "nenhum",
      divergente: !semAdmissao && codigoAtual !== codigoCalculado
    };
  });

  return { ok: true, itens: itens, divergentes: itens.filter(function (i) { return i.divergente; }).length };
}

/* =========================================
 * APLICAÇÃO — só mexe em quem está divergente. Ativa a rubrica da
 * faixa certa (valor = salário × percentual da faixa) e desativa
 * qualquer outra faixa que estivesse ativa (as faixas não acumulam
 * entre si — a mais alta substitui as anteriores, mesmo comportamento
 * já observado nos dados reais entre Quinquênio e Decênio).
 * ========================================= */

function aplicarQuinquenioDecenioRH_publico(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return rh_aplicarQuinquenioDecenio_(sessao.nome || sessao.usuario || "SISGEP");
  } catch (e) {
    return { ok: false, mensagem: "Erro ao aplicar: " + e.message };
  }
}

// Núcleo sem sessão — usado pelo wrapper público (acima) e pela rotina
// automática do trigger (abaixo), que não tem tokenSessao de usuário.
function rh_aplicarQuinquenioDecenio_(quem) {
  var verificacao = rh_verificarQuinquenioDecenio_();
  var codigosFaixas = rh_codigosDeFaixas_();

  var colaboradoresPorId = {};
  listarColaboradoresRH_interno_().forEach(function (c) { colaboradoresPorId[c.id] = c; });

  var aplicados = [];

  verificacao.itens.forEach(function (item) {
    if (!item.divergente) return;
    var colaborador = colaboradoresPorId[item.colaboradorId];
    if (!colaborador) return;
    var salario = Number(colaborador.salario || 0);
    var anos = item.anosServico;

    var fixasAtuais = rh_listarRubricasFixasColaborador_interno_(item.colaboradorId);
    var fixasDeFaixaAtivas = fixasAtuais.filter(function (f) { return f.ativo && codigosFaixas.indexOf(f.codigo) !== -1; });

    var faixaNova = rh_faixaTempoServico_(anos);

    if (faixaNova) {
      var rubricaCatalogo = rh_garantirRubricaFaixaTempoServico_(faixaNova);
      var valor = Math.round(salario * faixaNova.percentual / 100 * 100) / 100;
      rh_salvarRubricaFixaColaborador_(item.colaboradorId, rubricaCatalogo.id, valor, quem);
      fixasDeFaixaAtivas.forEach(function (f) {
        if (f.codigo !== faixaNova.codigo) rh_desativarRubricaFixaColaborador_(f.id, quem);
      });
    } else {
      // Menos de 5 anos — não deveria ter faixa nenhuma ativa.
      fixasDeFaixaAtivas.forEach(function (f) { rh_desativarRubricaFixaColaborador_(f.id, quem); });
    }

    aplicados.push(item.nome + " → " + item.elegibilidadeLabel + " (" + anos + " anos de admissão)");
  });

  Logger.log("[RH] Tempo de serviço — aplicados: " + (aplicados.join(", ") || "nenhum"));
  return {
    ok: true,
    aplicados: aplicados,
    mensagem: aplicados.length
      ? "Atualizado(s): " + aplicados.length + " colaborador(es)."
      : "Nenhuma divergência encontrada — já está tudo de acordo com o tempo de serviço."
  };
}

// Igual a alternarRubricaFixaColaboradorRH, mas sem exigir sessão de
// usuário — só para uso interno (wrapper público de RHRubricas.gs já
// cobre o caso com sessão; esta é a versão usada pela rotina automática).
function rh_desativarRubricaFixaColaborador_(id, quem) {
  var sh = rh_garantirRubricasFixas_();
  var mapa = rh_mapaCabecalho_(sh);
  if (sh.getLastRow() < 2) return;
  var ids = sh.getRange(2, mapa["ID"], sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      var linha = i + 2;
      sh.getRange(linha, mapa["ATIVO"]).setValue(false);
      sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
      sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(new Date());
      return;
    }
  }
}

/* =========================================
 * ROTINA AUTOMÁTICA — verifica e aplica sozinha, uma vez por dia, e
 * avisa por e-mail quando encontra alguém que mudou de faixa (só envia
 * e-mail quando HÁ mudança — silenciosa quando não há nada novo).
 * ========================================= */

var RH_EMAIL_NOTIFICACAO_TEMPO_SERVICO_ = "financeiro@sindeducacao.com";

function rh_rotinaQuinquenioDecenioTrigger_() {
  try {
    var resultado = rh_aplicarQuinquenioDecenio_("SISGEP (verificação automática diária)");
    if (resultado.ok && resultado.aplicados && resultado.aplicados.length) {
      rh_notificarMudancaTempoServico_(resultado.aplicados);
    }
  } catch (e) {
    Logger.log("[RH] ERRO na rotina automática de tempo de serviço: " + e.message);
  }
}

function rh_notificarMudancaTempoServico_(aplicados) {
  var corpo = "A verificação automática diária de tempo de serviço (RH) encontrou " + aplicados.length +
    " colaborador(es) com mudança de faixa (Quinquênio/Decênio/etc.):\n\n• " + aplicados.join("\n• ") +
    "\n\nAs rubricas fixas já foram atualizadas automaticamente na folha de pagamento.";
  try {
    enviarEmailSISGEP_(RH_EMAIL_NOTIFICACAO_TEMPO_SERVICO_, "RH — Tempo de serviço atualizado automaticamente", corpo, { origem: "RH" });
  } catch (e) {
    Logger.log("[RH] falha ao notificar mudança de tempo de serviço: " + e.message);
  }
}

// Público — exige administrador. Instala o trigger diário (~9h) que
// roda rh_rotinaQuinquenioDecenioTrigger_ sozinha, mesmo padrão já
// usado na Cobrança de Relação Nominal (cob_instalarTriggerDiario_publico).
function rh_instalarTriggerQuinquenioDecenio_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === "rh_rotinaQuinquenioDecenioTrigger_") ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger("rh_rotinaQuinquenioDecenioTrigger_").timeBased().everyDays(1).atHour(9).create();
    return { ok: true, mensagem: "Verificação automática ativada — roda todo dia por volta das 9h, e avisa por e-mail (" + RH_EMAIL_NOTIFICACAO_TEMPO_SERVICO_ + ") só quando encontra alguém que mudou de faixa." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao instalar verificação automática: " + e.message };
  }
}

function rh_removerTriggerQuinquenioDecenio_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var removidos = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === "rh_rotinaQuinquenioDecenioTrigger_") { ScriptApp.deleteTrigger(t); removidos++; }
    });
    return { ok: true, mensagem: removidos ? "Verificação automática desativada." : "Não estava ativa." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao desativar: " + e.message };
  }
}

function rh_statusTriggerQuinquenioDecenio_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var instalado = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "rh_rotinaQuinquenioDecenioTrigger_";
  });
  return { ok: true, instalado: instalado };
}
