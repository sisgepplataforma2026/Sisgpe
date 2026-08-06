// ============================================================================
// ARQUIVO: TravaSisgep.gs
//
// UMA TRAVA QUE PODE SER PEDIDA DUAS VEZES NA MESMA EXECUÇÃO.
//
// O PROBLEMA QUE ISTO RESOLVE
// O projeto usa LockService.getScriptLock() em 65 lugares, em 30 arquivos.
// Só existe UM lock de script — o mesmo objeto lógico para o projeto inteiro.
// Quando uma função que já segurava a trava chama outra que também pede a
// trava, a de dentro fica esperando por algo que só quem chamou pode soltar.
//
// Foi exatamente isso que quebrou a aprovação de ficha (comprovado por
// execução em 2026-08-06, tests/e2e/t8-sindicalizacao.js):
//
//   aprovarFichaSindicalizacao  → pega a trava (Sindicalizacaoadmin.gs)
//     └── sindAss_gravarDaFicha_ → pede a trava de novo → Lock timeout
//
// Resultado em produção: a matrícula era emitida e gravada na ficha, mas o
// trabalhador NUNCA aparecia na aba Associados. Sem linha em Associados ele
// não tem Portal, carteirinha, China Park nem voucher. O sistema até avisava
// ("a gravação na base de Associados falhou"), mas como aviso dentro de uma
// mensagem de sucesso — a secretaria via "Ficha aprovada" e seguia em frente.
//
// POR QUE NÃO USEI lock.hasLock()
// getScriptLock() devolve um objeto novo a cada chamada. Não tenho como
// confirmar, sem rodar no Apps Script real, se o hasLock() de um objeto novo
// enxerga a trava que outro objeto pegou na mesma execução. Se não enxergar,
// a guarda por hasLock() não protege nada. O contador global abaixo não
// depende dessa dúvida: ele conta quantas vezes ESTA execução pediu a trava,
// e isso é observável aqui mesmo.
//
// Variável global em Apps Script é reinicializada a cada execução, então o
// contador nunca vaza de uma requisição para outra.
//
// COMO USAR (substitui o par waitLock/releaseLock)
//
//     var trava = travarSisgep_(30000);
//     try {
//       ... trabalho ...
//     } finally {
//       trava.liberar();
//     }
//
// Quem chegou primeiro segura a trava de verdade. Quem chegou aninhado só
// incrementa o contador e segue — e o liberar() dele NÃO solta a trava de
// quem chamou. Soltar a trava alheia faria o resto daquela função rodar sem
// proteção nenhuma, o que é pior que o travamento.
//
// MIGRAÇÃO: os 65 pontos não foram convertidos de uma vez, de propósito —
// trocar trava em módulo que ninguém testou é trocar um defeito conhecido por
// um desconhecido. Convertidos até agora: a cadeia de Sindicalização e
// Ofícios (a que tem nesting comprovado). Os demais continuam com
// LockService direto e seguem funcionando; converta cada um quando o módulo
// dele entrar em teste.
// ============================================================================

/** Quantas vezes esta execução pediu a trava. Zera a cada execução. */
var TRAVA_SISGEP_NIVEL_ = 0;

/** O objeto de lock de quem pegou a trava primeiro nesta execução. */
var TRAVA_SISGEP_LOCK_ = null;

/**
 * Pede a trava do script. Devolve um objeto com liberar().
 * @param {number} timeoutMs Espera máxima. Padrão 20s.
 * @return {{aninhada: boolean, liberar: function()}}
 */
function travarSisgep_(timeoutMs) {
  var espera = timeoutMs || 20000;
  var solto = false;

  // Já estamos dentro de uma trava desta mesma execução: não peça de novo.
  if (TRAVA_SISGEP_NIVEL_ > 0) {
    TRAVA_SISGEP_NIVEL_++;
    return {
      aninhada: true,
      liberar: function () {
        if (solto) return;
        solto = true;
        TRAVA_SISGEP_NIVEL_--;
      }
    };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(espera);   // se estourar, a exceção sobe sem alterar o contador
  TRAVA_SISGEP_NIVEL_ = 1;
  TRAVA_SISGEP_LOCK_ = lock;

  return {
    aninhada: false,
    liberar: function () {
      if (solto) return;
      solto = true;
      TRAVA_SISGEP_NIVEL_ = 0;
      TRAVA_SISGEP_LOCK_ = null;
      try {
        lock.releaseLock();
      } catch (e) {
        Logger.log("travarSisgep_ — releaseLock falhou: " + e);
      }
    }
  };
}
