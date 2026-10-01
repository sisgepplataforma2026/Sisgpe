// ============================================================================
// 📁 ARQUIVO: ArquivoDrive.gs
// 🏷️  SISGEP — Política única de compartilhamento de arquivo no Drive
// ============================================================================
//
// O QUE ORIGINOU ESTE ARQUIVO
//
// 20/08/2026. Uma varredura nos 136 `.gs` do projeto achou 23 chamadas de
//
//     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
//
// espalhadas por 14 arquivos. Cada uma tornava um PDF acessível a QUALQUER
// PESSOA que tivesse a URL — sem login, sem expiração, para sempre. E esses
// PDFs carregam CPF, valor, nome de associado, holerite, documento jurídico.
//
// Não era descuido de uma pessoa: era a mesma linha copiada de arquivo em
// arquivo. Um módulo novo nascia copiando o anterior e herdava a exposição.
//
// POR QUE UM ARQUIVO EM VEZ DE 17 CORREÇÕES
//
// Trocar as 17 linhas restantes uma a uma resolveria hoje e não impediria
// nada amanhã: seguiriam 17 cópias da regra, e a 18ª nasceria errada junto
// com o próximo módulo. Decisão do usuário em 20/08/2026, ao pedir "o cenário
// com menos erro, e que automatize":
//
//     hoje                              depois
//     17 cópias da regra                1
//     mudar a política = 17 edições     1
//     copiar de outro módulo = herdar   herdar a regra certa
//       a linha errada
//     nada impede a reincidência        o CI reprova
//
// A trava está em tests/e2e/t71-compartilhamento-drive.js: nenhum `.gs` que
// não seja este pode chamar `setSharing`. Não é só sobre ANYONE_WITH_LINK —
// é sobre a decisão morar num lugar só.
//
// UM FATO QUE IMPORTA PARA ENTENDER O RISCO REAL
//
// Arquivo criado por `pasta.createFile(blob)` já nasce PRIVADO no Drive. O
// código antigo não deixava de proteger: ele ABRIA, ativamente. Portanto
// falhar em reaplicar PRIVATE não é, por si, um vazamento — e é por isso que
// `arquivoAplicarPolitica_` REGISTRA a falha em vez de derrubar o fluxo
// inteiro. Derrubar a emissão de um recibo porque uma chamada de permissão
// deu timeout seria trocar um risco por outro maior.
//
// A exceção é pasta com permissão herdada: aí o PRIVATE explícito é o que
// segura. Por isso ele continua sendo aplicado sempre.
//
// O QUE ESTE ARQUIVO NÃO RESOLVE
//
// O acervo que já está no Drive. Todo PDF gravado antes de 20/08/2026
// continua público até alguém varrer as pastas e revogar. Isto aqui estanca
// o vazamento NOVO. A varredura do passado é item à parte, registrado em
// docs/PENDENTE-VERIFICACAO.md.
//
// ORDEM DE CARGA: como em AmbienteRecursos.gs, chame estas funções apenas de
// DENTRO do corpo de outras funções — nunca em `var X = ...` no topo de outro
// arquivo, porque no Apps Script os `.gs` são avaliados em sequência.
// ============================================================================

/* ════════════════════════════════════════════════════════════════════════════
   A POLÍTICA — o único lugar do sistema que decide isto

   Mudar aqui muda o comportamento de todos os módulos de uma vez. É esse o
   ponto do arquivo.
   ════════════════════════════════════════════════════════════════════════════ */
var ARQUIVO_POLITICA = {
  acesso:    "PRIVATE",
  permissao: "NONE",
  motivo:    "PDFs do SISGEP carregam CPF, valor e nome de associado. " +
             "Link público não expira e não deixa rastro de quem abriu."
};

/**
 * Aplica a política de compartilhamento a um arquivo já criado.
 *
 * Substitui, nos módulos, a chamada crua de setSharing. Não estoura: registra
 * a falha e segue, pelo motivo explicado no cabeçalho (arquivo novo já nasce
 * privado; derrubar o fluxo custaria mais do que a falha).
 *
 * @param {DriveApp.File} file    O arquivo recém-criado.
 * @param {string=} contexto      De onde veio, para o log ("Recibo 123").
 * @return {DriveApp.File} O mesmo arquivo, para encadear.
 */
function arquivoAplicarPolitica_(file) {
  var contexto = arguments.length > 1 ? String(arguments[1] || "") : "";
  if (!file) return file;

  try {
    file.setSharing(
      DriveApp.Access[ARQUIVO_POLITICA.acesso],
      DriveApp.Permission[ARQUIVO_POLITICA.permissao]
    );
  } catch (e) {
    /* Falhar aqui não abre o arquivo — ele já nasceu privado. Mas precisa
       ficar visível, senão vira o tipo de silêncio que originou o problema. */
    var aviso = "ArquivoDrive: não consegui aplicar a política em " +
                (contexto || "arquivo sem contexto") + " — " + e.message;
    Logger.log(aviso);
    try {
      if (typeof registrarAuditoria === "function") {
        registrarAuditoria("ARQUIVO_POLITICA_FALHOU", aviso);
      }
    } catch (e2) {}
  }

  return file;
}

/**
 * Grava um blob numa pasta e já devolve o arquivo com a política aplicada.
 *
 * É o caminho preferido para código NOVO: uma chamada, sem chance de esquecer
 * o compartilhamento.
 *
 * @param {Blob} blob         Conteúdo a gravar.
 * @param {string} pastaId    Pasta de destino. Use getRecursoId_() para obter
 *                            o id certo do ambiente (ver AmbienteRecursos.gs).
 * @param {Object=} opcoes    { nome, contexto }
 * @return {{ id: string, url: string, nome: string, file: Object }}
 */
function arquivoSalvarPrivado_(blob, pastaId, opcoes) {
  opcoes = opcoes || {};

  if (!blob)    throw new Error("ArquivoDrive: blob não informado.");
  if (!pastaId) throw new Error("ArquivoDrive: pasta de destino não informada.");

  if (opcoes.nome) blob = blob.setName(String(opcoes.nome));

  var pasta = DriveApp.getFolderById(String(pastaId));
  var file  = pasta.createFile(blob);

  arquivoAplicarPolitica_(file, opcoes.contexto || blob.getName());

  return {
    id:   file.getId(),
    url:  file.getUrl(),
    nome: file.getName(),
    file: file
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO

   Sufixo `_` de propósito: o editor do Apps Script roda função com underscore,
   mas o google.script.run não a alcança — diagnostica sem abrir porta na web.
   Mesmo padrão de diagnosticoAmbienteRecursos_.
   ════════════════════════════════════════════════════════════════════════════ */
function diagnosticoPoliticaArquivo_() {
  var linhas = [];
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  POLÍTICA DE COMPARTILHAMENTO — SISGEP");
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  Acesso    : " + ARQUIVO_POLITICA.acesso);
  linhas.push("  Permissão : " + ARQUIVO_POLITICA.permissao);
  linhas.push("  Motivo    : " + ARQUIVO_POLITICA.motivo);
  linhas.push("");
  linhas.push("  Vale para todo arquivo gravado por qualquer módulo a partir");
  linhas.push("  de 20/08/2026. NÃO alcança o que já estava no Drive antes —");
  linhas.push("  esses continuam como foram gravados, e precisam de varredura.");
  linhas.push("═══════════════════════════════════════════════════════════");

  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
