// ============================================================================
// ARQUIVO: CarteirinhaAdmin.gs
// Emissão e gestão de carteirinhas digitais — lado administrativo.
//
// O associado envia a foto pela atualização de cadastro no Portal Público
// (aprovFotoParaCarteirinha_, em AprovacaoCadastro.gs), que grava na aba
// "Carteirinhas" com Status "Aprovada". Este arquivo cuida do passo
// seguinte, que faltava: emitir a carteirinha de fato (gerar um código de
// validação imprevisível e uma validade), gravando na aba
// "Carteirinhas_Emitidas" — a mesma aba que o projeto do Portal Público
// (repositório separado, mesma planilha) já lê para decidir se mostra o
// QR Code da credencial e para onde ele aponta.
// ============================================================================

var CARTAD_ABA_CARTEIRINHAS = 'Carteirinhas';
var CARTAD_ABA_EMITIDAS = 'Carteirinhas_Emitidas';
var CARTAD_CABECALHO_EMITIDAS = ['CPF', 'Nome', 'Codigo_Validacao', 'Status', 'Validade', 'Data_Emissao', 'Emitido_Por'];

function cartAd_obterAbaEmitidas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CARTAD_ABA_EMITIDAS);
  if (!sh) {
    sh = ss.insertSheet(CARTAD_ABA_EMITIDAS);
    sh.appendRow(CARTAD_CABECALHO_EMITIDAS);
  }
  return sh;
}

// Código imprevisível — o QR Code da credencial aponta pra ele publicamente,
// por isso não pode ser algo dedutível a partir do CPF (achado de segurança
// já registrado no código do Portal Público).
function cartAd_gerarCodigoValidacao_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

// Sugestão de validade padrão: 28/02 do próximo ciclo de filiação (mesmo
// padrão já usado no cartão da credencial). Só uma sugestão — o atendente
// pode ajustar antes de confirmar a emissão.
function cartAd_sugerirValidade_() {
  var hoje = new Date();
  var ano = hoje.getMonth() >= 1 ? hoje.getFullYear() + 1 : hoje.getFullYear(); // mês 1 = fevereiro (0-index)
  return '28/02/' + ano;
}

// Mapa CPF -> emissão mais recente (percorre de baixo pra cima, igual à
// leitura feita no Portal Público, pra pegar sempre a última emissão).
function cartAd_mapaEmitidasPorCpf_() {
  var sh = cartAd_obterAbaEmitidas_();
  var mapa = {};
  if (sh.getLastRow() < 2) return mapa;

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    var cpf = String(dados[i][0] || '').replace(/\D/g, '');
    if (!cpf) continue;
    mapa[cpf] = {
      linha: i + 2,
      nome: dados[i][1] || '',
      codigo: dados[i][2] || '',
      status: dados[i][3] || '',
      validade: dados[i][4] || ''
    };
  }
  return mapa;
}

/**
 * Lista as carteirinhas com foto aprovada (aba "Carteirinhas"), já
 * indicando se cada uma tem emissão ativa, revogada, ou nenhuma ainda.
 */
function listarCarteirinhasParaEmissao(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    if (!sh || sh.getLastRow() < 2) return [];

    var dados = sh.getDataRange().getValues();
    var emitidas = cartAd_mapaEmitidasPorCpf_();
    var lista = [];

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var cpf = String(linha[0] || '').replace(/\D/g, '');
      if (!cpf) continue;

      var emissao = emitidas[cpf];

      lista.push({
        cpf: cpf,
        nome: linha[1] || '',
        urlFoto: linha[2] || '',
        statusFoto: linha[3] || '',
        dataEnvio: linha[4] instanceof Date ? Utilities.formatDate(linha[4], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(linha[4] || ''),
        dataAprovacao: linha[5] instanceof Date ? Utilities.formatDate(linha[5], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(linha[5] || ''),
        aprovadoPor: linha[6] || '',
        origem: linha[7] || '',
        motivoRejeicao: linha[8] || '',
        emitida: !!emissao,
        emissaoStatus: emissao ? String(emissao.status || '').toUpperCase() : '',
        emissaoValidade: emissao ? emissao.validade : '',
        emissaoCodigo: emissao ? emissao.codigo : ''
      });
    }

    lista.reverse(); // mais recentes primeiro
    return lista;
  } catch (e) {
    Logger.log('listarCarteirinhasParaEmissao: ' + e);
    return [];
  }
}

function sugerirValidadeCarteirinha(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return cartAd_sugerirValidade_();
}

/**
 * Emite (ou reemite) a carteirinha de um associado: gera um novo código de
 * validação e grava a validade escolhida na aba "Carteirinhas_Emitidas".
 * Uma nova linha é sempre adicionada (histórico completo); a leitura no
 * Portal Público já considera só a mais recente por CPF.
 */
function emitirCarteirinha(cpf, validade, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (!validade || !String(validade).trim()) return { sucesso: false, mensagem: 'Informe a validade da carteirinha.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var shCarteirinhas = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var nome = '';
    if (shCarteirinhas && shCarteirinhas.getLastRow() > 1) {
      var dados = shCarteirinhas.getDataRange().getValues();
      for (var i = 1; i < dados.length; i++) {
        if (String(dados[i][0] || '').replace(/\D/g, '') === cpfLimpo) {
          nome = dados[i][1] || '';
          break;
        }
      }
    }
    if (!nome) return { sucesso: false, mensagem: 'CPF não encontrado na lista de fotos aprovadas.' };

    var statusAssociado = consultarAssociadoPorCPF(cpfLimpo, tokenSessao);
    if (!statusAssociado || !statusAssociado.existe) {
      return { sucesso: false, mensagem: 'Este CPF não consta na base de associados — verifique antes de emitir.' };
    }
    if (!statusAssociado.filiado) {
      return { sucesso: false, mensagem: 'Este associado consta como NÃO filiado na base — a carteirinha não pode ser emitida.' };
    }

    var codigo = cartAd_gerarCodigoValidacao_();
    var sh = cartAd_obterAbaEmitidas_();
    sh.appendRow([
      cpfLimpo,
      nome,
      codigo,
      'ATIVA',
      String(validade).trim(),
      new Date(),
      sessao.email || sessao.usuario || 'SISGEP'
    ]);

    return {
      sucesso: true,
      codigo: codigo,
      mensagem: 'Carteirinha emitida com sucesso. O QR Code já fica ativo no Portal do Associado.'
    };
  } catch (e) {
    Logger.log('emitirCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao emitir: ' + e.message };
  }
}

/**
 * Localiza a linha mais recente de um CPF na aba "Carteirinhas".
 * Retorna 0 se não encontrar.
 */
function cartAd_linhaPorCpf_(sh, cpfLimpo) {
  if (!sh || sh.getLastRow() < 2) return 0;
  var cpfs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var linha = 0;
  for (var i = 0; i < cpfs.length; i++) {
    if (String(cpfs[i][0] || '').replace(/\D/g, '') === cpfLimpo) linha = i + 2;
  }
  return linha;
}

/**
 * Garante que a aba "Carteirinhas" tem a 9ª coluna "Motivo Rejeição"
 * (abas criadas antes dessa função só tinham 8). Idempotente.
 */
function cartAd_garantirColunaMotivo_(sh) {
  if (sh.getLastColumn() < 9) sh.getRange(1, 9).setValue('Motivo Rejeição');
}

/**
 * E-mail do associado pelo CPF, buscando na aba Associados (a aba
 * Carteirinhas não guarda e-mail). Reaproveita os helpers já globais do
 * módulo de Sindicalização (sindAss_aba_, sindAss_mapaCabecalho_,
 * SIND_ASS_COLUNAS, sindAss_digitos_) em vez de duplicar a leitura.
 */
function cartAd_emailAssociado_(cpfLimpo) {
  try {
    var aba = sindAss_aba_();
    var mapa = sindAss_mapaCabecalho_(aba);
    var idx = function (nome) {
      var i = mapa[String(nome).toUpperCase()];
      return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
    };
    var ultima = aba.getLastRow();
    if (ultima < 2) return '';
    var cpfs = aba.getRange(2, idx('CPF'), ultima - 1, 1).getValues();
    for (var i = 0; i < cpfs.length; i++) {
      if (sindAss_digitos_(cpfs[i][0]) === cpfLimpo) {
        return String(aba.getRange(i + 2, idx('E-mail')).getValue() || '').trim();
      }
    }
    return '';
  } catch (e) {
    Logger.log('cartAd_emailAssociado_: ' + e);
    return '';
  }
}

/**
 * "Retorno para o associado": avisa por e-mail quando a carteirinha é
 * aprovada/emitida ou quando a foto é rejeitada — mesmo padrão visual dos
 * e-mails de Sindicalização (sind_emailHtml_/sind_opcoesEmail_), pra
 * manter uma identidade única de comunicação em todo o SISGEP.
 */
function cartAd_enviarEmailAprovacao_(email, nome, validade) {
  if (!email) return { ok: false, mensagem: 'Associado sem e-mail cadastrado — notificação não enviada.' };
  var corpo = '<p>Olá, <b>' + sindAdm_esc_(nome) + '</b>!</p>' +
    '<p>Sua carteirinha digital foi <b>aprovada e emitida</b>. Já está disponível no Portal do Associado para você visualizar, baixar ou imprimir.</p>';
  var destaque =
    '<div style="margin:18px 0;text-align:center;background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:16px;">' +
      '<div style="font-size:10px;font-weight:bold;color:#6b7385;letter-spacing:1px;text-transform:uppercase;">Validade</div>' +
      '<div style="font-size:22px;font-weight:bold;color:#166534;margin-top:6px;">' + sindAdm_esc_(validade) + '</div>' +
    '</div>';
  var textoSimples = 'Olá, ' + nome + '!\n\nSua carteirinha digital foi aprovada e emitida. Validade: ' + validade +
    '.\n\nAcesse o Portal do Associado para visualizar, baixar ou imprimir.\n\n' + SIND_ENTIDADE_SIGLA;
  var envio = enviarEmailSISGEP_(email, 'Sua carteirinha está pronta — ' + SIND_ENTIDADE_SIGLA, textoSimples, {
    origem: 'Carteirinhas',
    htmlBody: sind_emailHtml_('Carteirinha aprovada', corpo, destaque)
  });
  if (!envio.ok) {
    Logger.log('cartAd_enviarEmailAprovacao_: ' + envio.mensagem);
    return { ok: false, mensagem: 'Falha ao enviar e-mail de notificação: ' + envio.mensagem };
  }
  return { ok: true };
}

/**
 * Envia por e-mail o link do Portal do Associado — pra quando o pedido
 * chegou por WhatsApp/e-mail direto com a equipe, em vez de pelo portal.
 * A URL fica numa Propriedade do Script (nunca fixa no código): configure
 * uma vez em Propriedades do Projeto → Propriedades do Script →
 * CARTAD_URL_PORTAL_PUBLICO = https://.../exec (a URL publicada do
 * repositório sisgep-portal-publico).
 */
function cartAd_enviarLinkPortal(cpf, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };

    var urlPortal = PropertiesService.getScriptProperties().getProperty('CARTAD_URL_PORTAL_PUBLICO');
    if (!urlPortal) {
      return { sucesso: false, mensagem: 'Configure a URL do Portal Público em Propriedades do Script (CARTAD_URL_PORTAL_PUBLICO) antes de usar esta ação.' };
    }

    var email = cartAd_emailAssociado_(cpfLimpo);
    if (!email) return { sucesso: false, mensagem: 'Este associado não tem e-mail cadastrado.' };

    var associado = consultarAssociadoPorCPF(cpfLimpo, tokenSessao);
    var nome = (associado && associado.existe) ? associado.nome : '';

    var corpo = '<p>Olá, <b>' + sindAdm_esc_(nome) + '</b>!</p>' +
      '<p>Você pode acessar o Portal do Associado para atualizar seu cadastro, ver sua carteirinha digital, solicitar benefícios e muito mais.</p>' +
      '<p style="text-align:center;margin:22px 0;">' +
        '<a href="' + urlPortal + '" style="display:inline-block;background:#002f6c;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar o Portal do Associado</a>' +
      '</p>' +
      '<p style="font-size:12px;color:#6b7385;">Faça login com o seu CPF — você recebe um código de acesso por e-mail.</p>';
    var textoSimples = 'Olá, ' + nome + '!\n\nAcesse o Portal do Associado: ' + urlPortal +
      '\n\nFaça login com o seu CPF — você recebe um código de acesso por e-mail.\n\n' + SIND_ENTIDADE_SIGLA;

    var envio = enviarEmailSISGEP_(email, 'Acesse o Portal do Associado — ' + SIND_ENTIDADE_SIGLA, textoSimples, {
      origem: 'Carteirinhas',
      htmlBody: sind_emailHtml_('Portal do Associado', corpo)
    });
    if (!envio.ok) return { sucesso: false, mensagem: 'Erro ao enviar: ' + envio.mensagem };

    return { sucesso: true, mensagem: 'Link enviado por e-mail para ' + email + '.' };
  } catch (e) {
    Logger.log('cartAd_enviarLinkPortal: ' + e);
    return { sucesso: false, mensagem: 'Erro ao enviar: ' + e.message };
  }
}

function cartAd_enviarEmailRejeicao_(email, nome, motivo) {
  if (!email) return { ok: false, mensagem: 'Associado sem e-mail cadastrado — notificação não enviada.' };
  var corpo = '<p>Olá, <b>' + sindAdm_esc_(nome) + '</b>!</p>' +
    '<p>Sua solicitação de carteirinha digital foi analisada e a foto enviada não pôde ser aprovada.</p>';
  var destaque =
    '<div style="margin:18px 0;background:#fff8f0;border-left:4px solid #C9A84C;border-radius:6px;padding:14px 16px;">' +
      '<div style="font-size:10px;font-weight:bold;color:#6b7385;letter-spacing:1px;text-transform:uppercase;">Motivo</div>' +
      '<div style="font-size:14px;color:#1d2433;margin-top:6px;line-height:1.5;">' + sindAdm_esc_(motivo) + '</div>' +
    '</div>';
  var extra = '<p style="font-size:12.5px;color:#6b7385;line-height:1.55;">Acesse o Portal do Associado e envie uma nova foto em "Minha Credencial".</p>';
  var textoSimples = 'Olá, ' + nome + '!\n\nSua solicitação de carteirinha precisa de uma nova foto:\n\n' + motivo +
    '\n\nAcesse o Portal do Associado e envie uma nova foto em "Minha Credencial".\n\n' + SIND_ENTIDADE_SIGLA;
  var envio = enviarEmailSISGEP_(email, 'Sua carteirinha precisa de uma nova foto — ' + SIND_ENTIDADE_SIGLA, textoSimples, {
    origem: 'Carteirinhas',
    htmlBody: sind_emailHtml_('Foto não aprovada', corpo + extra, destaque)
  });
  if (!envio.ok) {
    Logger.log('cartAd_enviarEmailRejeicao_: ' + envio.mensagem);
    return { ok: false, mensagem: 'Falha ao enviar e-mail de notificação: ' + envio.mensagem };
  }
  return { ok: true };
}

/**
 * Aprova a foto de uma solicitação de carteirinha (feita pelo associado
 * no Portal Público, Status "Pendente" na aba "Carteirinhas") E já emite
 * a credencial no mesmo passo — antes eram duas ferramentas separadas,
 * agora Marcela faz tudo numa ação só: confere se é sindicalizado, se a
 * foto está adequada, confirma a validade e pronto.
 */
function aprovarEEmitirCarteirinha(cpf, validade, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { sucesso: false, mensagem: 'Solicitação não encontrada.' };

    var nomeAssociado = String(sh.getRange(linha, 2).getValue() || '');
    sh.getRange(linha, 4).setValue('Aprovada'); // Status
    sh.getRange(linha, 6).setValue(new Date()); // Data Aprovação
    sh.getRange(linha, 7).setValue(sessao.email || sessao.usuario || 'SISGEP'); // Aprovado Por
    cartAd_garantirColunaMotivo_(sh);
    sh.getRange(linha, 9).setValue(''); // limpa motivo de rejeição anterior, se houver

    var resultado = emitirCarteirinha(cpfLimpo, validade, tokenSessao);
    if (resultado && resultado.sucesso) {
      var envioEmail = cartAd_enviarEmailAprovacao_(cartAd_emailAssociado_(cpfLimpo), nomeAssociado, validade);
      if (envioEmail && !envioEmail.ok) {
        resultado.avisoEmail = envioEmail.mensagem;
        resultado.mensagem = (resultado.mensagem || 'Carteirinha aprovada e emitida.') + ' Atenção: ' + envioEmail.mensagem;
      }
    }
    return resultado;
  } catch (e) {
    Logger.log('aprovarEEmitirCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao aprovar e emitir: ' + e.message };
  }
}

/**
 * Emissão ATIVA mais recente de um CPF (código + validade), para uso no
 * Portal do Associado — gerar o QR Code e mostrar a validade real, em vez
 * de dados fixos. Retorna null se não houver emissão ativa.
 */
function cartAd_emissaoAtivaPorCpf_(cpfLimpo) {
  var emissao = cartAd_mapaEmitidasPorCpf_()[cpfLimpo];
  if (!emissao || String(emissao.status || '').toUpperCase() !== 'ATIVA' || !emissao.codigo) return null;
  return emissao;
}

/**
 * Revoga qualquer carteirinha ATIVA de um CPF. Chamada a partir da
 * desfiliação (sindAss_desfiliar_) pra manter o QR Code coerente com o
 * cadastro: uma vez desfiliado, a credencial para de validar no scanner
 * público, em vez de continuar mostrando "válida" indefinidamente.
 */
function cartAd_revogarPorDesfiliacao_(cpfLimpo, usuario) {
  try {
    var sh = cartAd_obterAbaEmitidas_();
    if (sh.getLastRow() < 2) return;
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][0] || '').replace(/\D/g, '') === cpfLimpo &&
          String(dados[i][3] || '').toUpperCase() === 'ATIVA') {
        sh.getRange(i + 2, 4).setValue('REVOGADA');
        Logger.log('cartAd_revogarPorDesfiliacao_: carteirinha revogada para ' + cpfLimpo +
          ' (desfiliação por ' + (usuario || '—') + ')');
      }
    }
  } catch (e) {
    Logger.log('cartAd_revogarPorDesfiliacao_: ' + e);
  }
}

/**
 * Consulta pública (sem sessão) de uma carteirinha pelo Codigo_Validacao
 * do QR Code — usada pela rota ?credencial=... em Code.gs. Só devolve
 * nome e validade, nunca CPF completo ou outro dado sensível.
 */
function cartAd_validarCodigoPublico_(codigo) {
  var cod = String(codigo || '').trim().toUpperCase();
  if (!cod) return { status: 'INVALIDO', mensagem: 'Código não informado.' };

  var sh = cartAd_obterAbaEmitidas_();
  if (sh.getLastRow() < 2) return { status: 'INVALIDO', mensagem: 'Código não encontrado.' };

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = dados.length - 1; i >= 0; i--) {
    if (String(dados[i][2] || '').trim().toUpperCase() === cod) {
      var status = String(dados[i][3] || '').toUpperCase();
      var validade = String(dados[i][4] || '');

      if (status === 'REVOGADA') {
        return { status: 'INVALIDO', mensagem: 'Esta carteirinha foi revogada.' };
      }
      if (status !== 'ATIVA') {
        return { status: 'INVALIDO', mensagem: 'Esta carteirinha não está ativa.' };
      }

      var partes = validade.split('/');
      if (partes.length === 3) {
        var venc = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), 23, 59, 59);
        if (!isNaN(venc.getTime()) && venc.getTime() < Date.now()) {
          return { status: 'INVALIDO', mensagem: 'Carteirinha vencida em ' + validade + '.' };
        }
      }

      return { status: 'VALIDO', nome: String(dados[i][1] || ''), validade: validade };
    }
  }
  return { status: 'INVALIDO', mensagem: 'Código não encontrado.' };
}

/**
 * Página pública servida pelo QR Code da credencial (rota ?credencial=
 * em Code.gs) — mesmo padrão visual de validarPublico (Oficios.gs), pra
 * manter uma única identidade de "página de validação" no SISGEP.
 */
function validarCarteirinhaPublico(codigo) {
  var resultado = cartAd_validarCodigoPublico_(codigo) || {};
  var esc = function (valor) { return escapeHtml_(String(valor == null ? '' : valor)); };

  var html = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Validação de Carteirinha — SISGEP</title>"
    + "<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}"
    + ".card{max-width:420px;width:100%;background:#fff;border-radius:20px;padding:36px;box-shadow:0 10px 40px rgba(10,22,40,.1);text-align:center;}"
    + ".icon{font-size:48px;margin-bottom:16px;}h2{font-size:22px;margin-bottom:16px;}"
    + ".field{text-align:left;margin-bottom:12px;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #dbe5f0;}"
    + ".field-lbl{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px;}"
    + ".field-val{font-size:14px;font-weight:600;color:#0a1628;}"
    + "</style></head><body><div class='card'>";

  if (resultado.status === 'VALIDO') {
    html += "<div class='icon'>&#x2705;</div><h2 style='color:#166534;'>Carteirinha Válida</h2>"
      + "<div class='field'><div class='field-lbl'>Associado</div><div class='field-val'>" + esc(resultado.nome) + "</div></div>"
      + "<div class='field'><div class='field-lbl'>Válida até</div><div class='field-val'>" + esc(resultado.validade) + "</div></div>";
  } else {
    html += "<div class='icon'>&#x274C;</div><h2 style='color:#991b1b;'>Carteirinha Inválida</h2>"
      + "<p style='color:#64748b;font-size:14px;line-height:1.6;'>" + esc(resultado.mensagem || 'Código não encontrado.') + "</p>";
  }

  html += "</div></body></html>";
  return HtmlService.createHtmlOutput(html);
}

/**
 * Rejeita a foto de uma solicitação (não emite nada) — o associado vê o
 * motivo no Portal Público e pode enviar uma foto nova.
 */
function rejeitarSolicitacaoCarteirinha(cpf, motivo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (!motivo || !String(motivo).trim()) return { sucesso: false, mensagem: 'Informe o motivo da rejeição.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { sucesso: false, mensagem: 'Solicitação não encontrada.' };

    var nomeAssociado = String(sh.getRange(linha, 2).getValue() || '');
    sh.getRange(linha, 4).setValue('Rejeitada'); // Status
    sh.getRange(linha, 6).setValue(new Date()); // Data Aprovação (aqui, data da decisão)
    sh.getRange(linha, 7).setValue(sessao.email || sessao.usuario || 'SISGEP'); // Aprovado Por
    cartAd_garantirColunaMotivo_(sh);
    sh.getRange(linha, 9).setValue(String(motivo).trim());

    var envioEmail = cartAd_enviarEmailRejeicao_(cartAd_emailAssociado_(cpfLimpo), nomeAssociado, String(motivo).trim());
    if (envioEmail && envioEmail.ok) {
      return { sucesso: true, mensagem: 'Solicitação rejeitada. O associado vai receber um e-mail com o motivo e pode enviar outra foto.' };
    }
    return {
      sucesso: true,
      mensagem: 'Solicitação rejeitada. Atenção: ' + (envioEmail ? envioEmail.mensagem : 'não foi possível notificar o associado por e-mail.'),
      avisoEmail: envioEmail ? envioEmail.mensagem : null
    };
  } catch (e) {
    Logger.log('rejeitarSolicitacaoCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao rejeitar: ' + e.message };
  }
}

/**
 * Devolve a foto da solicitação como data URI, pra revisão da equipe
 * antes de aprovar/rejeitar. Mesma lógica de acesso do Portal Público
 * (arquivo fica PRIVADO no Drive; só a execução do Apps Script, que
 * roda como quem implantou, consegue ler — não expõe link público).
 */
function obterFotoCarteirinhaParaRevisao(cpf, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(CARTAD_ABA_CARTEIRINHAS);
    var linha = cartAd_linhaPorCpf_(sh, cpfLimpo);
    if (!linha) return { ok: false };
    var fotoId = String(sh.getRange(linha, 3).getValue() || '');
    if (!fotoId) return { ok: false };
    var blob = DriveApp.getFileById(fotoId).getBlob();
    return { ok: true, dataUri: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    Logger.log('obterFotoCarteirinhaParaRevisao: ' + e);
    return { ok: false, mensagem: 'Não foi possível carregar a foto.' };
  }
}

/**
 * Revoga a emissão ativa mais recente de um CPF (ex: carteirinha perdida,
 * cadastro cancelado). Não apaga o histórico — grava uma nova linha com
 * status REVOGADA, mesma lógica de sempre pegar a mais recente por CPF.
 */
function revogarCarteirinha(cpf, motivo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var cpfLimpo = String(cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return { sucesso: false, mensagem: 'CPF inválido.' };

    var emitidas = cartAd_mapaEmitidasPorCpf_();
    var emissao = emitidas[cpfLimpo];
    if (!emissao) return { sucesso: false, mensagem: 'Este CPF não tem nenhuma carteirinha emitida.' };

    var sh = cartAd_obterAbaEmitidas_();
    sh.appendRow([
      cpfLimpo,
      emissao.nome,
      emissao.codigo,
      'REVOGADA',
      emissao.validade,
      new Date(),
      sessao.email || sessao.usuario || 'SISGEP'
    ]);

    return { sucesso: true, mensagem: 'Carteirinha revogada. O QR Code deixa de validar imediatamente.' };
  } catch (e) {
    Logger.log('revogarCarteirinha: ' + e);
    return { sucesso: false, mensagem: 'Erro ao revogar: ' + e.message };
  }
}
