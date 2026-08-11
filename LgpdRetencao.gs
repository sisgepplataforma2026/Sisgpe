// ================================================================
// ARQUIVO: LgpdRetencao.gs
// Orquestra o expurgo periódico de dados sensíveis com prazo de
// guarda definido: geolocalização de check-in (Visitas.gs) e dados
// brutos de consulta à Receita Federal (EscolasReceita.gs).
//
// Prazo de retenção: 5 anos, decisão registrada em 2026-08-04.
//
// INSTALAÇÃO (uma vez, pelo editor do Apps Script):
//   instalarTriggerExpurgoLGPD()
// ================================================================

/**
 * Função chamada pelo gatilho diário. Sem sessão — assim como os
 * demais gatilhos de horário do SISGEP (ex.: processarEmailsMensalidade),
 * roda sem usuário logado.
 */
function verificarEExpurgarDadosLGPD() {
  var resultado = { visitas: null, receita: null };

  try {
    resultado.visitas = visitas_expurgarGeolocalizacaoAntiga_();
    Logger.log('[LGPD] Expurgo de geolocalização (Visitas): ' + JSON.stringify(resultado.visitas));
  } catch (e) {
    Logger.log('[LGPD] Erro no expurgo de geolocalização: ' + e.message);
  }

  try {
    resultado.receita = escolasReceitaExpurgarDadosAntigos_();
    Logger.log('[LGPD] Expurgo de dados da Receita Federal: ' + JSON.stringify(resultado.receita));
  } catch (e) {
    Logger.log('[LGPD] Erro no expurgo de dados da Receita: ' + e.message);
  }

  /* Guarda quando rodou e o que apagou.
   *
   * O Logger some em dias e ninguém abre. Sem este registro, a pergunta
   * "quando foi a última vez que o expurgo rodou?" — que é a pergunta de uma
   * fiscalização de LGPD — não tinha resposta em lugar nenhum.
   *
   * Envolto em try porque isto é registro, não a operação: falhar aqui não
   * pode desfazer um expurgo que já aconteceu. */
  try {
    PropertiesService.getScriptProperties().setProperty(LGPD_CHAVE_ULTIMO_,
      JSON.stringify({
        quando: new Date().toISOString(),
        visitas: resultado.visitas, receita: resultado.receita
      }));
  } catch (e) {
    Logger.log('[LGPD] Não consegui registrar a data do expurgo: ' + e.message);
  }

  try {
    if (typeof auditar_ === "function") {
      auditar_({
        modulo: "Auditoria e Compliance", submodulo: "Retenção e Descarte",
        acao: "EXCLUIR_DADOS_VENCIDOS", origem: "GATILHO",
        valorNovo: resultado,
        justificativa: "Expurgo automático por prazo de guarda"
      });
    }
  } catch (e) {
    Logger.log('[LGPD] Ponte de auditoria falhou (expurgo seguiu): ' + e.message);
  }

  return resultado;
}

/**
 * Execução manual sob demanda, para um administrador confirmar o
 * expurgo fora do horário do gatilho (ex.: auditoria de compliance).
 */
function executarExpurgoLGPDAgora(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  return verificarEExpurgarDadosLGPD();
}

/* ================= TRIGGER: INSTALAR / REMOVER ================= */

function instalarTriggerExpurgoLGPD() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarEExpurgarDadosLGPD') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('verificarEExpurgarDadosLGPD').timeBased().everyDays(1).atHour(3).create();
  Logger.log('✅ Trigger de expurgo LGPD instalado — executa diariamente às 3h.');
  return { ok: true, mensagem: 'Trigger de expurgo LGPD instalado com sucesso — executa diariamente às 3h.' };
}

function removerTriggerExpurgoLGPD() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarEExpurgarDadosLGPD') {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  return { ok: true, mensagem: removidos + ' trigger(s) removido(s).' };
}

/* ==========================================================================
 * TELA — Auditoria e Compliance › Retenção e Descarte (item 16.10)
 *
 * As três funções abaixo são o que a tela chama. As duas de escrita são
 * embrulhos com sessão sobre instalarTriggerExpurgoLGPD e
 * removerTriggerExpurgoLGPD, que continuam existindo sem sessão porque são
 * rodadas pelo editor do Apps Script — onde não há usuário logado.
 * ========================================================================== */

var LGPD_HANDLER_ = "verificarEExpurgarDadosLGPD";
var LGPD_CHAVE_ULTIMO_ = "LGPD_ULTIMO_EXPURGO";

/**
 * Estado da retenção: o que é apagado, com que prazo, se o gatilho existe e
 * quando rodou pela última vez.
 *
 * O gatilho é o ponto todo desta tela. Ele não avisa quando não está
 * instalado — simplesmente nada é apagado, e o sindicato guarda
 * geolocalização de gente por tempo indeterminado sem saber. É o tipo de
 * descumprimento de LGPD que só aparece quando alguém pergunta.
 */
function lgpdPainelRetencao(tokenSessao) {
  exigirModulo_(tokenSessao, "auditoria", false);

  var gatilho = null;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === LGPD_HANDLER_) gatilho = t;
    });
  } catch (e) {
    // Sem permissão de ler triggers, o honesto é dizer que não sabe — não
    // afirmar que está instalado nem que não está.
    return {
      ok: true, gatilhoConhecido: false,
      mensagemGatilho: "Não consegui verificar o gatilho: " + e.message,
      politicas: lgpd_politicas_(), ultimoExpurgo: lgpd_ultimoExpurgo_()
    };
  }

  return {
    ok: true,
    gatilhoConhecido: true,
    gatilhoInstalado: !!gatilho,
    horaGatilho: "03:00",
    politicas: lgpd_politicas_(),
    ultimoExpurgo: lgpd_ultimoExpurgo_()
  };
}

/**
 * O que o sistema apaga e com que prazo. Sai daqui, do código, e não de uma
 * tabela editável: política que se edita à mão envelhece e passa a mentir
 * numa fiscalização, enquanto o expurgo real continua obedecendo o código.
 */
function lgpd_politicas_() {
  var anosVisitas = (typeof VIS_LGPD_RETENCAO_ANOS_ === "number") ? VIS_LGPD_RETENCAO_ANOS_ : 5;
  return [
    { dado: "Geolocalização de check-in em visita", onde: "Visitas",
      anos: anosVisitas, base: "Decisão registrada em 04/08/2026" },
    { dado: "Dados brutos de consulta à Receita Federal", onde: "Escolas",
      anos: 5, base: "Decisão registrada em 04/08/2026" }
  ];
}

function lgpd_ultimoExpurgo_() {
  try {
    var bruto = PropertiesService.getScriptProperties().getProperty(LGPD_CHAVE_ULTIMO_);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) { return null; }
}

function lgpdInstalarTrigger(tokenSessao) {
  exigirModulo_(tokenSessao, "auditoria", true);
  var r = instalarTriggerExpurgoLGPD();
  auditar_({
    modulo: "Auditoria e Compliance", submodulo: "Retenção e Descarte",
    acao: "INSTALAR_GATILHO_EXPURGO", sessao: { token: tokenSessao },
    justificativa: "Expurgo diário às 03:00"
  });
  return r;
}

function lgpdRemoverTrigger(tokenSessao) {
  exigirModulo_(tokenSessao, "auditoria", true);
  var r = removerTriggerExpurgoLGPD();
  // Crítica de propósito: desligar o expurgo faz o sindicato voltar a
  // guardar dado vencido, e ninguém percebe pela tela do dia a dia.
  auditar_({
    modulo: "Auditoria e Compliance", submodulo: "Retenção e Descarte",
    acao: "CANCELAR_GATILHO_EXPURGO", sessao: { token: tokenSessao },
    justificativa: r && r.mensagem ? r.mensagem : ""
  });
  return r;
}
