// ============================================================================
// ARQUIVO: SindicalizacaoEmails.gs
// Módulo SISGEP — padronização visual e de remetente dos e-mails da
// Sindicalização Digital.
//
// REMETENTE: o GmailApp envia sempre pela conta que executa o script. Para
// sair como financeiro@sindeducacao.com, esse endereço precisa estar
// cadastrado como ALIAS na conta que roda o SISGEP (Gmail > Configurações >
// Contas e importação > "Enviar e-mail como"). Rode
// listarRemetentesDisponiveis() para conferir. Se o alias não existir, os
// e-mails continuam saindo normalmente pelo endereço padrão — nada quebra.
//
// DEPOIS DE COLAR ESTE ARQUIVO, substituir no Sindicalizacao.gs a função
// enviarOTPSindicalizacao pela versão daqui, e no SindicalizacaoAdmin.gs os
// blocos de envio de boas-vindas e rejeição (instruções no fim do arquivo).
// ============================================================================

var SIND_EMAIL_REMETENTE = 'financeiro@sindeducacao.com';
var SIND_EMAIL_NOME_REMETENTE = 'SindEducação-ES';
var SIND_ENTIDADE_NOME =
  'Sindicato dos Educadores Técnico-Administrativos em Estabelecimentos ' +
  'de Ensino Particular no Estado do Espírito Santo';
var SIND_ENTIDADE_SIGLA = 'SindEducação-ES';
var SIND_ENTIDADE_CONTATO = '(27) 99813-5965 | (27) 3222-2706';

/**
 * Diagnóstico: lista os endereços que esta conta pode usar como remetente.
 * Executar pelo editor e ver o Registro de execução. Se
 * financeiro@sindeducacao.com não aparecer, é preciso cadastrá-lo como
 * alias no Gmail da conta que roda o SISGEP.
 */
function listarRemetentesDisponiveis() {
  var padrao = Session.getActiveUser().getEmail();
  var aliases = GmailApp.getAliases();
  Logger.log('Remetente padrão (conta do script): ' + padrao);
  Logger.log('Aliases disponíveis: ' + (aliases.length ? aliases.join(', ') : 'nenhum'));
  var alvo = SIND_EMAIL_REMETENTE;
  Logger.log('Alias desejado (' + alvo + '): ' +
    (aliases.indexOf(alvo) >= 0 ? 'DISPONÍVEL ✓' :
     (padrao === alvo ? 'é a própria conta ✓' :
      'NÃO CADASTRADO — os e-mails sairão como ' + padrao)));
  return 'Ver Registro de execução.';
}

/**
 * Monta as opções de envio do GmailApp com o remetente institucional,
 * usando o alias apenas quando ele realmente existe na conta.
 * Aceita opções extras (htmlBody, attachments, etc).
 */
function sind_opcoesEmail_(extras) {
  var opcoes = extras || {};
  opcoes.name = SIND_EMAIL_NOME_REMETENTE;
  try {
    var padrao = Session.getActiveUser().getEmail();
    if (padrao !== SIND_EMAIL_REMETENTE) {
      var aliases = GmailApp.getAliases();
      if (aliases.indexOf(SIND_EMAIL_REMETENTE) >= 0) {
        opcoes.from = SIND_EMAIL_REMETENTE;
      }
    }
  } catch (e) {
    Logger.log('Remetente institucional indisponível: ' + e.message);
  }
  return opcoes;
}

/**
 * Template HTML padrão SISGEP (navy #002f6c, dourado #C9A84C).
 * Usado por todos os e-mails da Sindicalização para manter identidade
 * única com o restante do sistema.
 *
 * @param {string} titulo   Faixa superior do e-mail
 * @param {string} corpoHtml Conteúdo (já em HTML)
 * @param {string} destaque  Bloco em evidência (opcional): código, matrícula…
 */
function sind_emailHtml_(titulo, corpoHtml, destaque) {
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6fa;' +
  'padding:24px 12px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;' +
    'border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,47,108,.10);">' +

      '<div style="background:#002f6c;padding:20px 24px;">' +
        '<div style="color:#fff;font-size:17px;font-weight:bold;">' +
          'Sind<span style="color:#C9A84C;">Educação</span>-ES' +
        '</div>' +
        '<div style="color:rgba(255,255,255,.78);font-size:10.5px;' +
        'line-height:1.35;margin-top:4px;">' + SIND_ENTIDADE_NOME + '</div>' +
      '</div>' +

      '<div style="height:3px;background:#C9A84C;"></div>' +

      '<div style="padding:24px;">' +
        '<div style="font-size:15px;font-weight:bold;color:#002f6c;' +
        'margin-bottom:14px;">' + titulo + '</div>' +
        '<div style="font-size:14px;color:#1d2433;line-height:1.6;">' +
          corpoHtml +
        '</div>' +
        (destaque ? destaque : '') +
      '</div>' +

      '<div style="background:#f4f6fa;padding:16px 24px;border-top:1px solid #e2e8f0;">' +
        '<div style="font-size:11px;color:#6b7385;line-height:1.5;">' +
          '<b>' + SIND_ENTIDADE_SIGLA + '</b><br>' +
          SIND_ENTIDADE_CONTATO + '<br>' +
          SIND_EMAIL_REMETENTE +
        '</div>' +
        '<div style="font-size:9.5px;color:#9aa3b2;margin-top:10px;">' +
          'Mensagem automática enviada pelo SISGEP — Sistema de Gestão de ' +
          'Processos do ' + SIND_ENTIDADE_SIGLA + '.' +
        '</div>' +
      '</div>' +

    '</div>' +
  '</div>';
}

/* ==========================================================================
 * SUBSTITUIR no Sindicalizacao.gs
 * ========================================================================== */

/**
 * Gera e envia o código OTP de 6 dígitos para assinatura da ficha.
 * Canal: e-mail informado na ficha. Validade: 10 minutos.
 * Pode ser chamado novamente para reenvio.
 */
function enviarOTPSindicalizacao(idFicha) {
  var registro = buscarFichaPorId_(idFicha);
  if (!registro) {
    return { sucesso: false, mensagem: 'Ficha não encontrada.' };
  }
  if (registro.STATUS !== SINDICALIZACAO_STATUS.AGUARDANDO_ASSINATURA) {
    return { sucesso: false, mensagem: 'Ficha não está aguardando assinatura.' };
  }
  if (!registro.EMAIL) {
    return {
      sucesso: false,
      mensagem: 'Ficha sem e-mail. Informe um e-mail para receber o código.'
    };
  }
  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var cacheOtp = CacheService.getScriptCache();
  cacheOtp.put('SIND_OTP_' + idFicha, otp, SINDICALIZACAO_OTP_VALIDADE_SEG);
  // Novo código = nova chance: zera o contador de tentativas erradas
  // (achado #4) para não punir um reenvio legítimo com menos tentativas.
  cacheOtp.remove('SIND_OTP_TENTATIVAS_' + idFicha);

  var destaque =
    '<div style="margin:18px 0;text-align:center;background:#f8faff;' +
    'border:2px solid #002f6c;border-radius:10px;padding:16px;">' +
      '<div style="font-size:10px;font-weight:bold;color:#6b7385;' +
      'letter-spacing:1px;text-transform:uppercase;">Código de assinatura</div>' +
      '<div style="font-size:32px;font-weight:bold;color:#002f6c;' +
      'letter-spacing:8px;margin-top:6px;">' + otp + '</div>' +
      '<div style="font-size:11px;color:#6b7385;margin-top:6px;">' +
      'Válido por 10 minutos</div>' +
    '</div>';

  var corpo =
    '<p>Olá, <b>' + registro.NOME_COMPLETO + '</b>!</p>' +
    '<p>Use o código abaixo para concluir a assinatura eletrônica da sua ' +
    'Ficha de Sindicalização.</p>';

  var rodapeTexto =
    '<p style="font-size:12.5px;color:#6b7385;line-height:1.55;">' +
    'Ao informar este código no formulário, você assina eletronicamente a ' +
    'ficha e a autorização de desconto mensal de 2% (dois por cento) sobre o ' +
    'salário-base, nos termos do <b>Art. 545 da CLT</b> e da <b>Cláusula 56 ' +
    'da Convenção Coletiva de Trabalho 2026/2027</b>.</p>' +
    '<p style="font-size:12.5px;color:#6b7385;">Se você não solicitou este ' +
    'código, ignore esta mensagem — nenhuma ficha será registrada em seu nome.</p>';

  var textoSimples =
    'Olá, ' + registro.NOME_COMPLETO + '!\n\n' +
    'Seu código para assinatura eletrônica da Ficha de Sindicalização do ' +
    SIND_ENTIDADE_SIGLA + ' é: ' + otp + '\n\n' +
    'O código vale por 10 minutos. Ao informá-lo no formulário, você assina ' +
    'eletronicamente a ficha e a autorização de desconto mensal de 2% sobre o ' +
    'salário-base, nos termos do Art. 545 da CLT e da Cláusula 56 da ' +
    'Convenção Coletiva de Trabalho 2026/2027.\n\n' +
    'Se você não solicitou este código, ignore este e-mail.\n\n' +
    SIND_ENTIDADE_SIGLA;

  var envio = enviarEmailSISGEP_(
    registro.EMAIL,
    'Código de assinatura — Ficha de Sindicalização',
    textoSimples,
    {
      origem: 'Sindicalização',
      htmlBody: sind_emailHtml_('Assinatura da sua Ficha de Sindicalização',
        corpo + rodapeTexto, destaque)
    }
  );
  if (!envio.ok) return { sucesso: false, mensagem: 'Falha ao enviar e-mail: ' + envio.mensagem };
  return { sucesso: true, canal: 'EMAIL', mensagem: 'Código enviado.' };
}

/* ==========================================================================
 * E-MAILS DA APROVAÇÃO / REJEIÇÃO
 * Chamados pelo SindicalizacaoAdmin.gs — ver instruções no fim do arquivo.
 * ========================================================================== */

/**
 * E-mail de boas-vindas com o número da matrícula.
 */
function sind_enviarEmailBoasVindas_(registro) {
  if (!registro || !registro.EMAIL) return;

  var destaque =
    '<div style="margin:18px 0;text-align:center;background:#f8faff;' +
    'border:2px solid #C9A84C;border-radius:10px;padding:16px;">' +
      '<div style="font-size:10px;font-weight:bold;color:#6b7385;' +
      'letter-spacing:1px;text-transform:uppercase;">Sua matrícula</div>' +
      '<div style="font-size:30px;font-weight:bold;color:#002f6c;' +
      'letter-spacing:4px;margin-top:6px;">' + registro.MATRICULA + '</div>' +
    '</div>';

  var corpo =
    '<p>Olá, <b>' + registro.NOME_COMPLETO + '</b>!</p>' +
    '<p>Sua sindicalização foi <b>aprovada</b>. Seja bem-vindo(a) ao ' +
    SIND_ENTIDADE_SIGLA + '.</p>';

  var extra =
    '<p style="font-size:12.5px;color:#6b7385;line-height:1.55;">' +
    'Guarde este número: ele é a sua identificação no sindicato e dá acesso ' +
    'ao Portal do Associado, à carteirinha digital e aos convênios e ' +
    'benefícios da categoria.</p>' +
    (registro.LINK_PDF ?
      '<p style="font-size:12.5px;"><a href="' + registro.LINK_PDF +
      '" style="color:#002f6c;font-weight:bold;">Ver a minha ficha de ' +
      'sindicalização em PDF</a></p>' : '');

  var textoSimples =
    'Olá, ' + registro.NOME_COMPLETO + '!\n\n' +
    'Sua sindicalização foi aprovada. Sua matrícula no ' + SIND_ENTIDADE_SIGLA +
    ' é: ' + registro.MATRICULA + '\n\n' +
    'Guarde este número — ele é a sua identificação no sindicato e dá acesso ' +
    'ao Portal do Associado e aos benefícios.\n\n' +
    (registro.LINK_PDF ? 'Sua ficha em PDF: ' + registro.LINK_PDF + '\n\n' : '') +
    'Seja bem-vindo(a)!\n\n' + SIND_ENTIDADE_SIGLA;

  enviarEmailSISGEP_(
    registro.EMAIL,
    'Bem-vindo(a) ao ' + SIND_ENTIDADE_SIGLA + ' — Matrícula ' + registro.MATRICULA,
    textoSimples,
    {
      origem: 'Sindicalização',
      htmlBody: sind_emailHtml_('Sindicalização aprovada', corpo + extra, destaque)
    }
  );
}

/**
 * E-mail de pendência/rejeição, com o motivo informado pela secretaria.
 */
function sind_enviarEmailRejeicao_(registro) {
  if (!registro || !registro.EMAIL) return;

  var destaque =
    '<div style="margin:18px 0;background:#fff8f0;border-left:4px solid #C9A84C;' +
    'border-radius:6px;padding:14px 16px;">' +
      '<div style="font-size:10px;font-weight:bold;color:#6b7385;' +
      'letter-spacing:1px;text-transform:uppercase;">Pendência encontrada</div>' +
      '<div style="font-size:14px;color:#1d2433;margin-top:6px;line-height:1.5;">' +
      sindAdm_esc_(registro.MOTIVO_REJEICAO || '') + '</div>' +
    '</div>';

  var corpo =
    '<p>Olá, <b>' + registro.NOME_COMPLETO + '</b>!</p>' +
    '<p>Sua ficha de sindicalização foi analisada e precisa de ajustes antes ' +
    'de ser aprovada.</p>';

  var extra =
    '<p style="font-size:12.5px;color:#6b7385;line-height:1.55;">' +
    'Você pode preencher a ficha novamente pelo mesmo link ou procurar a ' +
    'secretaria do ' + SIND_ENTIDADE_SIGLA + ' para orientação.</p>';

  var textoSimples =
    'Olá, ' + registro.NOME_COMPLETO + '!\n\n' +
    'Sua ficha de sindicalização precisa de ajustes:\n\n' +
    (registro.MOTIVO_REJEICAO || '') + '\n\n' +
    'Você pode preencher novamente pelo mesmo link ou procurar a secretaria ' +
    'do ' + SIND_ENTIDADE_SIGLA + '.\n\n' + SIND_ENTIDADE_SIGLA;

  enviarEmailSISGEP_(
    registro.EMAIL,
    'Ficha de Sindicalização — pendência encontrada',
    textoSimples,
    {
      origem: 'Sindicalização',
      htmlBody: sind_emailHtml_('Sua ficha precisa de ajustes', corpo + extra, destaque)
    }
  );
}

// ============================================================================
// COMO LIGAR NO SindicalizacaoAdmin.gs
//
// 1) Em aprovarFichaSindicalizacao, substituir todo o bloco
//        if (r.EMAIL) { try { GmailApp.sendEmail( ... ); } catch ... }
//    por uma única linha:
//        sind_enviarEmailBoasVindas_(r);
//
// 2) Em rejeitarFichaSindicalizacao, substituir todo o bloco
//        if (r.EMAIL) { try { GmailApp.sendEmail( ... ); } catch ... }
//    por uma única linha:
//        sind_enviarEmailRejeicao_(r);
//
// Os e-mails internos (link de conclusão e aviso à secretaria) continuam
// funcionando como estão; se quiser padronizá-los também, é só me pedir.
// ============================================================================