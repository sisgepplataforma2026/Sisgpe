// ============================================================================
// ARQUIVO: EmailCore.gs
// Camada central de envio de e-mail do SISGEP.
//
// Achado da auditoria do módulo Comunicação: 24 arquivos do projeto chamam
// GmailApp.sendEmail diretamente, cada um com seu próprio try/catch — quando
// o envio falha, o mais comum é só um Logger.log (ninguém nunca vê), sem
// nenhum registro auditável de quais e-mails saíram, para quem e quando.
//
// enviarEmailSISGEP_ centraliza: remetente institucional (via
// sind_opcoesEmail_, SindicalizacaoEmails.gs), status estruturado de
// sucesso/falha (em vez de void) e log em planilha (aba
// Log_Emails_Enviados) com origem, destinatário, assunto, status e usuário.
//
// Adoção incremental: migrados os 3 arquivos que já usavam os helpers
// visuais compartilhados de e-mail (sind_opcoesEmail_/sind_emailHtml_) —
// SindicalizacaoEmails.gs, BeneficiosReservaSimples.gs, CarteirinhaAdmin.gs.
// Os demais ~18 arquivos que chamam GmailApp.sendEmail diretamente ficam
// fora do escopo desta etapa (migração completa é tarefa separada).
// ============================================================================

var EMAILCORE_ABA_LOG = 'Log_Emails_Enviados';

/**
 * Envia um e-mail em nome do SISGEP com remetente institucional padronizado,
 * status estruturado de retorno e registro em log — em vez de cada módulo
 * chamar GmailApp.sendEmail diretamente e engolir a falha num Logger.log.
 *
 * @param {string} destino      E-mail do destinatário.
 * @param {string} assunto      Assunto do e-mail.
 * @param {string} corpoTexto   Corpo em texto simples (fallback).
 * @param {Object} opcoes       { origem, htmlBody, cc, bcc, attachments, replyTo }
 *                               origem identifica o módulo chamador no log
 *                               (ex.: "Sindicalização", "Benefícios", "Carteirinhas").
 * @return {{ok:boolean, mensagem:(string|undefined)}}
 */
function enviarEmailSISGEP_(destino, assunto, corpoTexto, opcoes) {
  opcoes = opcoes || {};
  var origem = opcoes.origem || 'Não informado';
  var status = 'ENVIADO';
  var erro = '';

  try {
    if (!destino) throw new Error('Destinatário não informado.');

    var opcoesEnvio = sind_opcoesEmail_({
      htmlBody: opcoes.htmlBody,
      cc: opcoes.cc,
      bcc: opcoes.bcc,
      attachments: opcoes.attachments,
      replyTo: opcoes.replyTo
    });

    GmailApp.sendEmail(destino, assunto, corpoTexto || '', opcoesEnvio);
  } catch (e) {
    status = 'FALHA';
    erro = e.message;
    Logger.log('[enviarEmailSISGEP_] ' + origem + ': ' + erro);
  }

  try {
    emailCore_registrarLog_(origem, destino, assunto, status, erro);
  } catch (eLog) {
    Logger.log('[enviarEmailSISGEP_] erro ao registrar log: ' + eLog.message);
  }

  return status === 'ENVIADO' ? { ok: true } : { ok: false, mensagem: erro };
}

/**
 * Grava uma linha no log de e-mails enviados. Cria a aba com cabeçalho na
 * primeira chamada, se ainda não existir.
 */
function emailCore_registrarLog_(origem, destino, assunto, status, erro) {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(EMAILCORE_ABA_LOG);
  if (!sh) {
    sh = ss.insertSheet(EMAILCORE_ABA_LOG);
    sh.appendRow(['Data/Hora', 'Módulo', 'Destinatário', 'Assunto', 'Status', 'Erro', 'Usuário']);
    sh.setFrozenRows(1);
  }

  var usuario = '';
  try {
    usuario = (typeof eiaEmailUsuarioAtivo_ === 'function')
      ? eiaEmailUsuarioAtivo_()
      : Session.getActiveUser().getEmail();
  } catch (e) {}

  sh.appendRow([new Date(), origem, destino || '', assunto || '', status, erro || '', usuario]);
}

