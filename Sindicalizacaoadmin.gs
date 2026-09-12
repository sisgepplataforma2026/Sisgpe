// ============================================================================
// ARQUIVO: SindicalizacaoAdmin.gs
// Módulo SISGEP: lado ADMINISTRATIVO da Sindicalização Digital.
// O lado público do fluxo (formulário, OTP, assinatura, CEP) vive no
// arquivo Sindicalizacao.gs, NESTE MESMO projeto (SISGEP-OFICIOS).
// A aba SISGEP_Sindicalizacao na planilha de produção é a fonte única.
//
// IMPORTANTE: o contador de matrícula sequencial (PropertiesService) e as
// funções de aprovação vivem SOMENTE neste arquivo. Se um dia o fluxo
// público for movido para outro projeto (ex.: Portal do Associado), as
// aprovações devem continuar acontecendo apenas por aqui, pois
// LockService/PropertiesService são por projeto.
//
// DEPENDÊNCIAS (mesmo projeto):
//   SindicalizacaoAssociados.gs → sindAss_gravarDaFicha_
//   SindicalizacaoEmails.gs     → sind_enviarEmailBoasVindas_,
//                                 sind_enviarEmailRejeicao_
//
// Helpers internos prefixados com sindAdm_ para não colidir com funções já
// existentes no SISGEP. Funções públicas mantêm os nomes chamados pela tela
// de Aprovações: listarFichasSindicalizacao, obterFichaSindicalizacao,
// aprovarFichaSindicalizacao, rejeitarFichaSindicalizacao.
// ============================================================================

var SIND_ADM_ABA = 'SISGEP_Sindicalizacao';
var SIND_ADM_PROP_MATRICULA = 'SINDICALIZACAO_ULTIMA_MATRICULA';
var SIND_ADM_PASTA_PDF = 'SISGEP_Fichas_Sindicalizacao';
var SIND_ADM_CACHE_SEG = 120;

// Logo oficial usada no cabeçalho da ficha (mesma arte do index.html).
// Trocar pelo ID do arquivo no Drive caso a arte da ficha seja outra.
var SIND_ADM_LOGO_FILE_ID = '1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7';

var SIND_ADM_COLUNAS = [
  'ID_FICHA', 'TIPO', 'MATRICULA',
  'NOME_COMPLETO', 'SEXO', 'CPF', 'RG', 'ORGAO_EXPEDIDOR', 'UF_RG',
  'TITULO_ELEITOR', 'ZONA', 'SECAO',
  'TELEFONE_1', 'TELEFONE_2', 'CELULAR', 'EMAIL', 'TIPO_EMAIL',
  'CEP_RESIDENCIAL', 'TIPO_LOGRADOURO', 'ENDERECO', 'NUMERO',
  'COMPLEMENTO', 'BAIRRO', 'UF', 'CIDADE',
  'DATA_NASCIMENTO', 'ESCOLARIDADE',
  'ESCOLA', 'DATA_ADMISSAO', 'CARGO', 'CIDADE_ESCOLA', 'CEP_ESCOLA',
  'STATUS', 'ORIGEM', 'ID_VISITA', 'DIRETOR_BASE',
  'DATA_CRIACAO', 'DATA_HORA_ASSINATURA', 'IP_ASSINATURA',
  'OTP_VALIDADO', 'HASH_FICHA', 'LINK_PDF',
  'MOTIVO_REJEICAO', 'APROVADO_POR', 'DATA_APROVACAO'
];

// ============================================================================
// FUNÇÕES PÚBLICAS (chamadas pela tela de Fichas Sindicais)
// ============================================================================

/**
 * Lista fichas para o painel, com filtros opcionais:
 * { status, escola, origem, diretorBase, texto }.
 */
// Público — exige sessão E o módulo Sindicalização.
function listarFichasSindicalizacao(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "sindicalizacao", false);
  return listarFichasSindicalizacao_interno_(filtros);
}

/**
 * Núcleo sem checagem — chamado pelo módulo ESCOLAS (Visitas.gs), que
 * mostra as fichas originadas em cada visita e no histórico da escola.
 *
 * Isto conserta um problema que já existia antes do controle de acesso:
 * Visitas.gs chamava listarFichasSindicalizacao({}) SEM token, o que
 * fazia a checagem de sessão lançar erro. Como as duas chamadas estão
 * dentro de try/catch que só grava no log, a falha era silenciosa e a
 * tela simplesmente mostrava zero fichas — parecia que a escola não
 * tinha nenhuma. Agora a leitura funciona, e sem obrigar o diretor de
 * base a ter o módulo Sindicalização só para ver o próprio resultado.
 *
 * Nunca exponha esta função a google.script.run.
 */
function listarFichasSindicalizacao_interno_(filtros) {
  filtros = filtros || {};
  var semFiltros = !filtros.status && !filtros.escola &&
    !filtros.origem && !filtros.diretorBase && !filtros.texto;

  var cache = CacheService.getScriptCache();
  if (semFiltros) {
    var emCache = cache.get('SIND_ADM_LISTA');
    if (emCache) return JSON.parse(emCache);
  }
  var todas = sindAdm_lerTodas_();
  var fichas = todas.filter(function (r) {
    if (filtros.status && r.STATUS !== filtros.status) return false;
    if (filtros.escola && String(r.ESCOLA).toUpperCase()
        .indexOf(String(filtros.escola).toUpperCase()) < 0) return false;
    if (filtros.origem && r.ORIGEM !== filtros.origem) return false;
    if (filtros.diretorBase && r.DIRETOR_BASE !== filtros.diretorBase) return false;
    if (filtros.texto) {
      var t = String(filtros.texto).toUpperCase();
      var alvo = (r.NOME_COMPLETO + ' ' + r.CPF + ' ' + r.MATRICULA +
        ' ' + r.ESCOLA).toUpperCase();
      if (alvo.indexOf(t) < 0) return false;
    }
    return true;
  }).map(sindAdm_resumir_);

  var resposta = {
    sucesso: true,
    total: fichas.length,
    kpis: sindAdm_kpis_(todas),
    fichas: fichas
  };
  if (semFiltros) {
    try {
      cache.put('SIND_ADM_LISTA', JSON.stringify(resposta), SIND_ADM_CACHE_SEG);
    } catch (e) { /* payload grande: segue sem cache */ }
  }
  return resposta;
}

/**
 * Detalhe completo de uma ficha.
 */
function obterFichaSindicalizacao(idFicha, tokenSessao) {
  exigirModulo_(tokenSessao, "sindicalizacao", false);
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
  r.CPF_FORMATADO = sindAdm_cpfNormalizado_(r.CPF);
  return { sucesso: true, ficha: r };
}

/**
 * Aprova ficha ASSINADA e ENCAMINHA: emite matrícula sequencial atômica,
 * grava o trabalhador na base de Associados (é isto que o torna visível
 * para Portal, Carteirinha, China Park e Vouchers), regenera o PDF com a
 * matrícula e envia o e-mail de boas-vindas.
 */
function aprovarFichaSindicalizacao(idFicha, aprovadoPor, tokenSessao) {
  exigirModulo_(tokenSessao, "sindicalizacao", false);
  var usuario = String(aprovadoPor || '').trim() || 'SISGEP';
  // travarSisgep_ e não LockService: esta função chama sindAss_gravarDaFicha_,
  // que também trava. Ver TravaSisgep.gs.
  var trava = travarSisgep_(30000);
  try {
    var r = sindAdm_buscarPorId_(idFicha);
    if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    if (r.STATUS !== 'ASSINADA') {
      return {
        sucesso: false,
        mensagem: 'Só é possível aprovar fichas com status ASSINADA. ' +
          'Status atual: ' + r.STATUS + '.'
      };
    }

    r.MATRICULA = sindAdm_gerarMatricula_();
    r.STATUS = 'MATRICULADA';
    r.APROVADO_POR = usuario;
    r.DATA_APROVACAO = new Date();
    sindAdm_gravar_(r);

    // Grava na base de Associados — passo que integra com todo o SISGEP.
    var assoc = null;
    var avisos = [];
    try {
      assoc = sindAss_gravarDaFicha_(r);
      if (assoc.avisos && assoc.avisos.length) avisos = avisos.concat(assoc.avisos);
    } catch (eAssoc) {
      Logger.log('Gravação em Associados falhou (' + idFicha + '): ' + eAssoc.message);
      avisos.push('ATENÇÃO: a matrícula foi emitida, mas a gravação na base ' +
        'de Associados falhou (' + eAssoc.message + '). O trabalhador ainda ' +
        'não tem acesso ao Portal e aos benefícios — avise o suporte.');
    }

    try {
      r.LINK_PDF = gerarPDFFichaSindicalizacao(r.ID_FICHA);
      sindAdm_gravar_(r);
    } catch (ePdf) {
      Logger.log('PDF pós-aprovação falhou (' + idFicha + '): ' + ePdf.message);
    }
    sindAdm_limparCache_();

    sind_enviarEmailBoasVindas_(r);

    var msg = 'Ficha aprovada. Matrícula ' + r.MATRICULA + ' emitida';
    if (assoc) {
      msg += assoc.criado ?
        ' e associado cadastrado na base.' :
        ' e cadastro do associado atualizado (linha ' + assoc.linha + ').';
    } else {
      msg += '.';
    }
    if (avisos.length) msg += ' ⚠ ' + avisos.join(' ');

    return {
      sucesso: true,
      matricula: r.MATRICULA,
      associado: assoc,
      avisos: avisos,
      mensagem: msg
    };
  } finally {
    trava.liberar();
  }
}

/**
 * Rejeita ficha não finalizada, registrando motivo (obrigatório) e
 * notificando o trabalhador quando houver e-mail.
 */
function rejeitarFichaSindicalizacao(idFicha, motivo, aprovadoPor, tokenSessao) {
  exigirModulo_(tokenSessao, "sindicalizacao", false);
  if (!motivo || !String(motivo).trim()) {
    return { sucesso: false, mensagem: 'Informe o motivo da rejeição.' };
  }
  var usuario = String(aprovadoPor || '').trim() || 'SISGEP';
  var trava = travarSisgep_(20000);
  try {
    var r = sindAdm_buscarPorId_(idFicha);
    if (!r) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    if (r.STATUS === 'MATRICULADA') {
      return { sucesso: false, mensagem: 'Ficha já matriculada não pode ser rejeitada por aqui.' };
    }
    r.STATUS = 'REJEITADA';
    r.MOTIVO_REJEICAO = String(motivo).trim();
    r.APROVADO_POR = usuario;
    r.DATA_APROVACAO = new Date();
    sindAdm_gravar_(r);
    sindAdm_limparCache_();

    sind_enviarEmailRejeicao_(r);

    return { sucesso: true, mensagem: 'Ficha rejeitada e trabalhador notificado.' };
  } finally {
    trava.liberar();
  }
}

/**
 * Define manualmente o ponto de partida do contador de matrícula neste
 * projeto (ex.: última matrícula física já emitida). Executar UMA vez
 * pelo editor: definirMatriculaInicialSindicalizacao(4587)
 * → próxima matrícula emitida será 004588.
 */
function definirMatriculaInicialSindicalizacao(ultimaMatriculaUsada) {
  var n = parseInt(ultimaMatriculaUsada, 10);
  if (isNaN(n) || n < 0) {
    throw new Error('Informe um número válido (última matrícula já usada).');
  }
  PropertiesService.getScriptProperties()
    .setProperty(SIND_ADM_PROP_MATRICULA, String(n));
  return 'Contador definido. Próxima matrícula: ' + sindAdm_fmtMatricula_(n + 1);
}

// ============================================================================
// PDF — LAYOUT OFICIAL
// ============================================================================

/**
 * Gera o PDF da ficha no layout do formulário oficial, com a assinatura
 * eletrônica no rodapé. Salva na pasta do Drive e retorna a URL.
 */
function gerarPDFFichaSindicalizacao(idFicha) {
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) throw new Error('Ficha não encontrada: ' + idFicha);

  var assinatura = r.OTP_VALIDADO === 'SIM' ?
    ('Assinado eletronicamente por ' + r.NOME_COMPLETO +
     ' em ' + sindAdm_fmtDataHora_(r.DATA_HORA_ASSINATURA) +
     (r.IP_ASSINATURA ? ' · IP ' + r.IP_ASSINATURA : '') +
     ' · Código OTP validado · Hash ' + String(r.HASH_FICHA).substring(0, 16) + '…') :
    'Pendente de assinatura eletrônica';

  /* LOGO AJUSTADA EM 01/09/2026.

     Tres problemas de uma vez:

     1. TAMANHO. O limite era de altura, travado em 40px. A arte tem 466x247
        (proporcao 1,9:1), entao 40px de altura davam so ~75px de largura numa
        coluna de ~180px:
        a logo saia pequena e perdida no canto. Agora manda pela LARGURA, que
        e o que a coluna define, e a altura acompanha.

     2. TAGLINE DUPLICADA. A arte JA TRAZ "Somos todos educadores" dentro
        dela. O cabecalho novo acrescentava a frase de novo por baixo — ficava
        escrita duas vezes.

     3. FALLBACK COM A COR ERRADA. Quando a logo nao carrega, o texto usava
        dourado (#C9A84C), que e a cor institucional do SISGEP, nao da marca
        do sindicato. A marca e rosa e azul. */
  var logoUri = sindAdm_logoDataUri_();
  var marcaHtml = logoUri ?
    '<img src="' + logoUri + '" style="width:100%;max-width:150px;height:auto;">' :
    '<span class="marca">Sind<i>Educação</i>ES</span>' +
    '<div style="font-size:6px;color:#555;letter-spacing:.4px;margin-top:1px;">' +
    'SOMOS TODOS EDUCADORES</div>';

  /* ══════════════════════════════════════════════════════════════════════
     LAYOUT REESCRITO EM 01/09/2026 para reproduzir o FORMULARIO DE PAPEL
     oficial que o sindicato usa. Antes o PDF tinha layout proprio, preto e
     branco, com campos e rotulos que nao batiam com o impresso.

     Decisoes do usuario nesta data:
       - titulo de eleitor, zona e secao SAEM (nao existem no papel);
       - escolaridade vira caixa de marcar com NOVE opcoes;
       - contatos viram WhatsApp / telefonico / recado;
       - o texto da autorizacao fica o COMPLETO (Art. 545 + Clausula 56 +
         Assembleia + Edital) — o do papel e mais curto, e encurtar texto de
         documento com valor legal nao se faz por questao de layout.

     REGRA DAS CAIXINHAS: quando o valor nao cabe, o campo vira linha
     continua em vez de cortar. Truncar dado de documento assinado para caber
     numa decoracao seria trocar a informacao pelo enfeite.
     ══════════════════════════════════════════════════════════════════════ */
  var html =
    '<html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:14px;}' +
    '.folha{border:2.5px solid #1E56B8;padding:7px;}' +
    '.folha-int{border:1.5px solid #1E56B8;padding:10px 12px;}' +
    '.cab{display:table;width:100%;margin-bottom:8px;}' +
    '.cab > div{display:table-cell;vertical-align:middle;}' +
    '.tit{font-size:18px;font-weight:bold;text-align:center;color:#123f8f;line-height:1.12;}' +
    '.marca{color:#1E56B8;font-weight:bold;font-size:15px;}' +
    '.marca i{color:#E4467E;font-style:italic;}' +
    '.barra{background:#9EC6EE;color:#123f8f;text-align:center;font-weight:bold;' +
    'font-size:10px;letter-spacing:.8px;padding:2px;margin:8px 0 4px 0;}' +
    '.rot{font-size:7px;font-weight:bold;color:#333;display:block;margin-bottom:1px;}' +
    'table.lin{width:100%;border-collapse:collapse;margin-bottom:4px;}' +
    'table.lin td{vertical-align:bottom;padding:0 4px 0 0;}' +
    '.cx{border-collapse:collapse;}' +
    '.cx td{border:1px solid #8FB8E0;width:12px;height:15px;text-align:center;' +
    'font-size:10px;font-family:monospace;padding:0;}' +
    '.cont{border:1px solid #8FB8E0;min-height:15px;padding:1px 4px;font-size:10px;}' +
    '.mkr{font-size:9px;}' +
    '.opts{font-size:8.5px;margin:2px 0 4px 0;line-height:1.7;}' +
    '.opts span{margin-right:12px;}' +
    '.aut{display:table;width:100%;margin-top:10px;}' +
    '.aut > div{display:table-cell;vertical-align:bottom;}' +
    '.aut-txt{font-size:8px;line-height:1.4;text-align:justify;padding-right:14px;}' +
    '.ass-l{border-bottom:1px solid #111;height:17px;}' +
    '.ass-r{font-size:7.5px;color:#333;text-align:center;padding-top:2px;}' +
    '.versic{text-align:center;font-style:italic;font-size:10px;color:#123f8f;margin-top:9px;}' +
    '.ctrl{text-align:center;font-size:6.5px;color:#666;margin-top:6px;}' +
    '</style></head><body><div class="folha"><div class="folha-int">' +

    '<div class="cab">' +
    '<div style="width:23%;text-align:center;">' + marcaHtml + '</div>' +
    '<div style="width:38%;" class="tit">FORMULÁRIO<br>DE SINDICALIZAÇÃO</div>' +
    '<div style="width:22%;" class="mkr">' +
    sindAdm_marcador_(r.TIPO !== 'RECADASTRAMENTO') + ' CADASTRAMENTO<br>' +
    sindAdm_marcador_(r.TIPO === 'RECADASTRAMENTO') + ' ATUALIZAÇÃO CADASTRAL</div>' +
    '<div style="width:17%;"><span class="rot">MATRÍCULA</span>' +
    sindAdm_caixinhas_(r.MATRICULA, 8) + '</div>' +
    '</div>' +

    '<div class="barra">TRABALHADOR (A)</div>' +
    '<span class="rot">NOME COMPLETO</span>' +
    sindAdm_caixinhas_(r.NOME_COMPLETO, 44) +

    '<div class="barra">IDENTIFICAÇÃO</div>' +
    '<table class="lin"><tr>' +
    '<td style="width:13%;"><span class="rot">SEXO</span><span class="mkr">' +
    sindAdm_marcador_(r.SEXO === 'F') + ' F &nbsp; ' +
    sindAdm_marcador_(r.SEXO === 'M') + ' M</span></td>' +
    '<td style="width:24%;"><span class="rot">CPF (OBRIGATÓRIO)</span>' +
    sindAdm_caixinhas_(sindAdm_cpfNormalizado_(r.CPF), 14) + '</td>' +
    '<td style="width:20%;"><span class="rot">RG (OBRIGATÓRIO)</span>' +
    sindAdm_caixinhas_(r.RG, 12) + '</td>' +
    '<td style="width:15%;"><span class="rot">ORGÃO EMISSOR</span>' +
    sindAdm_caixinhas_(r.ORGAO_EXPEDIDOR, 7) + '</td>' +
    '<td style="width:8%;"><span class="rot">UF</span>' +
    sindAdm_caixinhas_(r.UF_RG, 2) + '</td>' +
    '<td style="width:20%;"><span class="rot">DATA DE NASCIMENTO</span>' +
    sindAdm_caixinhas_(sindAdm_fmtData_(r.DATA_NASCIMENTO), 10) + '</td>' +
    '</tr></table>' +

    '<div class="barra">ENDEREÇO RESIDENCIAL</div>' +
    '<div class="opts">' +
    sindAdm_opcoesLogradouro_(r.TIPO_LOGRADOURO) + '</div>' +
    '<table class="lin"><tr>' +
    '<td style="width:80%;">' + sindAdm_caixinhas_(r.ENDERECO, 40) + '</td>' +
    '<td style="width:20%;"><span class="rot">Nº</span>' +
    sindAdm_caixinhas_(r.NUMERO, 6) + '</td>' +
    '</tr></table>' +
    '<table class="lin"><tr>' +
    '<td style="width:55%;"><span class="rot">BAIRRO</span>' +
    sindAdm_caixinhas_(r.BAIRRO, 26) + '</td>' +
    '<td style="width:45%;"><span class="rot">COMPLEMENTO</span>' +
    sindAdm_caixinhas_(r.COMPLEMENTO, 20) + '</td>' +
    '</tr></table>' +
    '<table class="lin"><tr>' +
    '<td style="width:58%;"><span class="rot">CIDADE</span>' +
    sindAdm_caixinhas_(r.CIDADE, 26) + '</td>' +
    '<td style="width:12%;"><span class="rot">UF</span>' +
    sindAdm_caixinhas_(r.UF, 2) + '</td>' +
    '<td style="width:30%;"><span class="rot">CEP</span>' +
    sindAdm_caixinhas_(sindAdm_fmtCEP_(r.CEP_RESIDENCIAL), 9) + '</td>' +
    '</tr></table>' +

    /* CONTATOS — mapeamento confirmado pelo usuario em 01/09/2026:
       CELULAR -> WhatsApp, TELEFONE_1 -> telefonico, TELEFONE_2 -> recado. */
    '<div class="barra">CONTATOS</div>' +
    '<table class="lin"><tr>' +
    '<td style="width:34%;"><span class="rot">CONTATO WHATSAPP</span>' +
    sindAdm_caixinhas_(sindAdm_fmtTel_(r.CELULAR), 15) + '</td>' +
    '<td style="width:33%;"><span class="rot">CONTATO TELEFÔNICO</span>' +
    sindAdm_caixinhas_(sindAdm_fmtTel_(r.TELEFONE_1), 15) + '</td>' +
    '<td style="width:33%;"><span class="rot">CONTATO PARA RECADO</span>' +
    sindAdm_caixinhas_(sindAdm_fmtTel_(r.TELEFONE_2), 15) + '</td>' +
    '</tr></table>' +
    '<span class="rot">E-MAIL</span>' +
    sindAdm_caixinhas_(r.EMAIL, 44) +

    '<div class="barra">ESCOLARIDADE</div>' +
    '<div class="opts">' + sindAdm_opcoesEscolaridade_(r.ESCOLARIDADE) + '</div>' +

    '<div class="barra">EMPRESA ONDE TRABALHA ' +
    '(CRECHE, COLÉGIO, ESCOLA, FACULDADE, UNIVERSIDADE)</div>' +
    sindAdm_caixinhas_(r.ESCOLA, 44) +
    '<table class="lin" style="margin-top:4px;"><tr>' +
    '<td style="width:28%;"><span class="rot">DATA DE ADMISSÃO</span>' +
    sindAdm_caixinhas_(sindAdm_fmtData_(r.DATA_ADMISSAO), 10) + '</td>' +
    '<td style="width:72%;"><span class="rot">CARGO</span>' +
    sindAdm_caixinhas_(r.CARGO, 28) + '</td>' +
    '</tr></table>' +
    '<table class="lin"><tr>' +
    '<td style="width:70%;"><span class="rot">CIDADE</span>' +
    sindAdm_caixinhas_(r.CIDADE_ESCOLA, 30) + '</td>' +
    '<td style="width:30%;"><span class="rot">CEP</span>' +
    sindAdm_caixinhas_(sindAdm_fmtCEP_(r.CEP_ESCOLA), 9) + '</td>' +
    '</tr></table>' +

    '<div class="aut">' +
    '<div class="aut-txt" style="width:55%;">' +
    'Neste ato e nos termos do <b>Art. 545 da CLT</b> e da <b>Cláusula 56 da ' +
    'Convenção Coletiva de Trabalho 2026/2027</b>, autorizo o desconto mensal ' +
    'em folha de pagamento, no percentual de <b>2% (dois por cento)</b> sobre ' +
    'meu salário-base, em favor do Sindicato dos Educadores Técnico-' +
    'Administrativos em Estabelecimentos de Ensino Particular no Estado do ' +
    'Espírito Santo (SindEducação-ES), conforme aprovado em Assembleia Geral ' +
    'Extraordinária da categoria, convocada por Edital publicado no Jornal A ' +
    'Tribuna, edição de 15 de novembro de 2025, autorizando o repasse pelo meu ' +
    'empregador ao SindEducação-ES até o 10º (décimo) dia subsequente ao mês ' +
    'vencido.' +
    '</div>' +
    '<div style="width:45%;">' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><tr>' +
    '<td style="border-bottom:1px solid #111;height:14px;width:62%;"></td>' +
    '<td style="width:4%;"></td>' +
    '<td style="border-bottom:1px solid #111;height:14px;width:34%;"></td>' +
    '</tr></table>' +
    '<div class="ass-l"></div>' +
    '<div class="ass-r">ASSINATURA DO ASSOCIADO</div>' +
    '<div style="font-size:7px;color:#444;text-align:center;margin-top:4px;line-height:1.3;">' +
    sindAdm_esc_(assinatura) + '</div>' +
    '</div></div>' +

    '<div class="versic">Tudo o que fizerem, façam de todo o coração, como para ' +
    'o Senhor, e não para os homens. <span style="font-size:7.5px;">Colossenses 3:23</span></div>' +

    '<div class="ctrl">Ficha ' + sindAdm_esc_(r.ID_FICHA) +
    ' · Origem: ' + sindAdm_esc_(r.ORIGEM || '—') +
    (r.ID_VISITA ? ' · Visita: ' + sindAdm_esc_(r.ID_VISITA) : '') +
    ' · Emitida pelo SISGEP em ' + sindAdm_fmtDataHora_(new Date()) + '</div>' +
    '</div></div></body></html>';


  var blob = Utilities.newBlob(html, 'text/html',
    'ficha_' + r.ID_FICHA + '.html').getAs('application/pdf');
  blob.setName('Ficha_Sindicalizacao_' +
    (r.MATRICULA || r.ID_FICHA) + '_' +
    String(r.NOME_COMPLETO).replace(/[^A-Za-z0-9]+/g, '_') + '.pdf');

  var pasta = sindAdm_pastaPDF_();
  var arquivo = pasta.createFile(blob);
  arquivoAplicarPolitica_(arquivo, "Sindicalizacaoadmin.gs");
  return arquivo.getUrl();
}

/**
 * Carrega a logo do Drive como data URI base64 para embutir no PDF.
 * Base64 é mais confiável que URL externa na conversão HTML→PDF do GAS.
 * Cacheada por 6h; se a imagem passar do limite do CacheService, segue
 * sem cache. Retorna '' em caso de falha (o PDF cai no texto de fallback).
 */
function sindAdm_logoDataUri_() {
  var cache = CacheService.getScriptCache();
  var emCache = cache.get('SIND_ADM_LOGO_B64');
  if (emCache) return emCache;
  try {
    var blob = DriveApp.getFileById(SIND_ADM_LOGO_FILE_ID).getBlob();
    var uri = 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
    try {
      cache.put('SIND_ADM_LOGO_B64', uri, 21600);
    } catch (eCache) { /* imagem grande demais para o cache: segue direto */ }
    return uri;
  } catch (e) {
    Logger.log('Logo da ficha não carregada: ' + e.message);
    return '';
  }
}

// ============================================================================
// HELPERS INTERNOS (prefixados — sem colisão com o restante do SISGEP)
// ============================================================================

function sindAdm_aba_() {
  var ss = planilhaSisgep_();
  var aba = ss.getSheetByName(SIND_ADM_ABA);
  if (!aba) {
    throw new Error('Aba ' + SIND_ADM_ABA + ' não existe. Execute ' +
      'configurarAbaSindicalizacao() (Sindicalizacao.gs) primeiro.');
  }
  return aba;
}

function sindAdm_mapaColunas_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave) mapa[chave] = i;
  });
  SIND_ADM_COLUNAS.forEach(function (nome, i) {
    if (mapa[nome] === undefined) mapa[nome] = i;
  });
  return mapa;
}

function sindAdm_lerTodas_() {
  var aba = sindAdm_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  var mapa = sindAdm_mapaColunas_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  return dados.map(function (linha, idx) {
    var r = { _LINHA: idx + 2 };
    SIND_ADM_COLUNAS.forEach(function (c) {
      r[c] = linha[mapa[c]] !== undefined ? linha[mapa[c]] : '';
    });
    return r;
  });
}

function sindAdm_buscarPorId_(idFicha) {
  var alvo = String(idFicha).trim();
  var todas = sindAdm_lerTodas_();
  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].ID_FICHA).trim() === alvo) return todas[i];
  }
  return null;
}

function sindAdm_gravar_(registro) {
  var aba = sindAdm_aba_();
  var mapa = sindAdm_mapaColunas_(aba);
  var totalCols = Math.max(aba.getLastColumn(), SIND_ADM_COLUNAS.length);
  var linhaValores = new Array(totalCols).fill('');
  SIND_ADM_COLUNAS.forEach(function (c) {
    linhaValores[mapa[c]] = registro[c] !== undefined ? registro[c] : '';
  });
  var existente = sindAdm_buscarPorId_(registro.ID_FICHA);
  if (existente) {
    aba.getRange(existente._LINHA, 1, 1, totalCols).setValues([linhaValores]);
  } else {
    aba.appendRow(linhaValores);
  }

  /* AVISO DE CAMPO DESCARTADO — 01/09/2026, item 54.3 do PENDENTE-VERIFICACAO.
   *
   * O laco acima percorre SIND_ADM_COLUNAS, nao as chaves do registro: campo
   * que nao tem coluna simplesmente nunca e olhado. Nao lanca, nao avisa,
   * some.
   *
   * Foi assim que o numero do oficio se perdeu. O aprovarEEncaminharFicha
   * grava registro.OBSERVACOES_OFICIO com o numero que comunicou a filiacao a
   * escola, dentro de um try cujo catch esta marcado "campo opcional" — e
   * esse catch NUNCA disparou, porque nao havia excecao para capturar. O
   * vinculo entre a ficha e o oficio sumia em silencio, e depois nao havia
   * como saber qual oficio falou de qual trabalhador.
   *
   * Isto aqui NAO acrescenta coluna nenhuma e nao mexe no esquema: so faz o
   * descarte aparecer no log. Acrescentar coluna e mudanca de esquema numa
   * aba com dado real, e o configurarAbaSindicalizacao reescreve a linha 1
   * inteira — decisao do usuario, nao minha (REGRA Nº 1).
   *
   * Chaves com "_" na frente sao internas (_LINHA vem do buscarPorId_) e nao
   * contam como descarte. */
  try {
    var descartados = Object.keys(registro).filter(function (chave) {
      if (chave.charAt(0) === "_") return false;
      if (SIND_ADM_COLUNAS.indexOf(chave) > -1) return false;
      var valor = registro[chave];
      return valor !== undefined && valor !== null && String(valor).trim() !== "";
    });
    if (descartados.length) {
      Logger.log(
        "\u26a0 SIND_ADM_CAMPO_SEM_COLUNA — a ficha " +
        (registro.ID_FICHA || "(sem id)") + " foi gravada, mas " +
        descartados.length + " campo(s) foram DESCARTADOS por nao terem " +
        "coluna na aba: " + descartados.join(", ") + ". O dado nao foi " +
        "salvo. Se algum deles importa, a coluna precisa ser criada."
      );
    }
  } catch (eAviso) {
    /* O aviso nunca pode derrubar a gravacao: a ficha ja foi salva acima. */
    Logger.log("sindAdm_gravar_: falha ao conferir campos descartados — " +
      eAviso.message);
  }
}

function sindAdm_gerarMatricula_() {
  var props = PropertiesService.getScriptProperties();
  var atual = props.getProperty(SIND_ADM_PROP_MATRICULA);
  if (atual === null) {
    var maior = 0;
    sindAdm_lerTodas_().forEach(function (r) {
      var n = parseInt(String(r.MATRICULA).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maior) maior = n;
    });
    atual = String(maior);
  }
  var proxima = parseInt(atual, 10) + 1;
  props.setProperty(SIND_ADM_PROP_MATRICULA, String(proxima));
  return sindAdm_fmtMatricula_(proxima);
}

function sindAdm_fmtMatricula_(n) {
  var s = String(n);
  while (s.length < 6) s = '0' + s;
  return s;
}

function sindAdm_resumir_(r) {
  return {
    ID_FICHA: r.ID_FICHA,
    TIPO: r.TIPO,
    MATRICULA: r.MATRICULA,
    NOME_COMPLETO: r.NOME_COMPLETO,
    CPF: sindAdm_cpfNormalizado_(r.CPF),
    CELULAR: sindAdm_fmtTel_(r.CELULAR),
    EMAIL: r.EMAIL,
    ESCOLA: r.ESCOLA,
    CARGO: r.CARGO,
    STATUS: r.STATUS,
    ORIGEM: r.ORIGEM,
    ID_VISITA: r.ID_VISITA,
    DIRETOR_BASE: r.DIRETOR_BASE,
    DATA_CRIACAO: sindAdm_fmtDataHora_(r.DATA_CRIACAO),
    DATA_HORA_ASSINATURA: sindAdm_fmtDataHora_(r.DATA_HORA_ASSINATURA),
    DATA_APROVACAO: sindAdm_fmtDataHora_(r.DATA_APROVACAO),
    LINK_PDF: r.LINK_PDF
  };
}

function sindAdm_kpis_(todas) {
  var kpi = {
    total: todas.length, preCadastro: 0, aguardandoAssinatura: 0,
    assinadas: 0, matriculadas: 0, rejeitadas: 0, matriculadasNoMes: 0
  };
  var agora = new Date();
  todas.forEach(function (r) {
    switch (r.STATUS) {
      case 'PRE_CADASTRO': kpi.preCadastro++; break;
      case 'AGUARDANDO_ASSINATURA': kpi.aguardandoAssinatura++; break;
      case 'ASSINADA': kpi.assinadas++; break;
      case 'MATRICULADA':
        kpi.matriculadas++;
        var d = r.DATA_APROVACAO instanceof Date ? r.DATA_APROVACAO : null;
        if (d && d.getMonth() === agora.getMonth() &&
            d.getFullYear() === agora.getFullYear()) {
          kpi.matriculadasNoMes++;
        }
        break;
      case 'REJEITADA': kpi.rejeitadas++; break;
    }
  });
  return kpi;
}

function sindAdm_pastaPDF_() {
  var it = DriveApp.getFoldersByName(SIND_ADM_PASTA_PDF);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(SIND_ADM_PASTA_PDF);
}

function sindAdm_limparCache_() {
  try {
    CacheService.getScriptCache().remove('SIND_ADM_LISTA');
  } catch (e) { /* silencioso */ }
}

function sindAdm_digitos_(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * CPF formatado, restaurando zeros à esquerda perdidos quando a célula
 * da planilha interpreta o valor como número
 * (ex.: "8538104780" → "085.381.047-80").
 */
function sindAdm_cpfNormalizado_(cpf) {
  var d = sindAdm_digitos_(cpf);
  if (!d) return '';
  while (d.length < 11) d = '0' + d;
  if (d.length !== 11) return d;
  return d.substring(0, 3) + '.' + d.substring(3, 6) + '.' +
    d.substring(6, 9) + '-' + d.substring(9);
}

function sindAdm_fmtCEP_(cep) {
  cep = sindAdm_digitos_(cep);
  if (cep.length !== 8) return cep;
  return cep.substring(0, 5) + '-' + cep.substring(5);
}

function sindAdm_fmtTel_(tel) {
  tel = sindAdm_digitos_(tel);
  if (tel.length === 11) {
    return '(' + tel.substring(0, 2) + ') ' + tel.substring(2, 7) +
      '-' + tel.substring(7);
  }
  if (tel.length === 10) {
    return '(' + tel.substring(0, 2) + ') ' + tel.substring(2, 6) +
      '-' + tel.substring(6);
  }
  return tel;
}

function sindAdm_fmtDataHora_(d) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm:ss');
}

/**
 * Formata datas para dd/MM/yyyy.
 * Aceita objeto Date (como o Sheets devolve), string ISO yyyy-MM-dd
 * (formato do <input type="date">) ou texto livre — neste último caso
 * devolve como veio, sem inventar conversão.
 */
function sindAdm_fmtData_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var s = String(v).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return s;
}

function sindAdm_esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sindAdm_marcador_(marcado) {
  return marcado ? '&#9746;' : '&#9744;';
}

/* ══════════════════════════════════════════════════════════════════════════
   CAIXINHAS — uma letra por celula, como no formulario de papel.
   Acrescentado em 01/09/2026 junto com a reescrita do layout.

   A REGRA QUE IMPORTA: se o valor nao cabe em `n` celulas, o campo vira uma
   LINHA CONTINUA em vez de cortar. Truncar dado de um documento assinado para
   caber numa decoracao seria trocar a informacao pelo enfeite — e num
   documento com valor legal (Art. 545 da CLT) isso nao e detalhe estetico.

   Tabela e nao div porque a conversao HTML→PDF do Apps Script nao aplica
   flexbox: com div as celulas empilham e o formulario sai desmontado.
   ══════════════════════════════════════════════════════════════════════════ */
function sindAdm_caixinhas_(valor, n) {
  var v = (valor === null || valor === undefined) ? '' : String(valor).trim();
  var total = n || 20;

  if (v.length > total) {
    return '<div class="cont">' + sindAdm_esc_(v) + '</div>';
  }

  var tds = '';
  for (var i = 0; i < total; i++) {
    var c = v.charAt(i);
    tds += '<td>' + (c ? sindAdm_esc_(c) : '\u00A0') + '</td>';
  }
  return '<table class="cx"><tr>' + tds + '</tr></table>';
}

/** As seis opcoes de logradouro do papel, com a do cadastro marcada. */
function sindAdm_opcoesLogradouro_(tipo) {
  var alvo = String(tipo || 'RUA').trim().toUpperCase();
  return ['ALAMEDA', 'AVENIDA', 'ESTRADA', 'PRAÇA', 'RUA', 'TRAVESSA']
    .map(function (op) {
      return '<span>' + sindAdm_marcador_(op === alvo) + ' ' + op + '</span>';
    }).join('');
}

/* NOVE opcoes de escolaridade — decisao do usuario em 01/09/2026.

   Nao sao as cinco do papel: o formulario publico separa "Fundamental
   incompleto" de "completo", e o papel nao. Seguir o papel deixaria quem
   marcou "incompleto" sem caixa correspondente — o mesmo defeito que a
   Pos-graduacao tinha, e que originou esta correcao. A lista impressa precisa
   cobrir TUDO que o formulario consegue gravar.

   O papel precisa ser reimpresso com as mesmas nove. */
var SIND_ADM_ESCOLARIDADE = [
  'Ensino Fundamental incompleto', 'Ensino Fundamental completo',
  'Ensino Médio incompleto', 'Ensino Médio completo',
  'Ensino Superior incompleto', 'Ensino Superior completo',
  'Pós-graduação', 'Mestrado', 'Doutorado'
];

function sindAdm_opcoesEscolaridade_(valor) {
  var alvo = sindAdm_normEscolaridade_(valor);
  var html = SIND_ADM_ESCOLARIDADE.map(function (op) {
    return '<span>' + sindAdm_marcador_(sindAdm_normEscolaridade_(op) === alvo) +
      ' ' + op.toUpperCase() + '</span>';
  }).join('');

  /* Valor gravado que nao casa com nenhuma das nove: mostra do lado em vez de
     imprimir a ficha com todas as caixas vazias, que faria o documento negar
     um dado que esta na base. */
  if (alvo && SIND_ADM_ESCOLARIDADE.every(function (op) {
        return sindAdm_normEscolaridade_(op) !== alvo;
      })) {
    html += '<span style="color:#123f8f;">&#9746; ' +
      sindAdm_esc_(String(valor).toUpperCase()) + '</span>';
  }
  return html;
}

/** Compara escolaridade sem acento, caixa nem "Ensino": o cadastro antigo
    guarda "Superior completo" e o novo "Ensino Superior completo". */
function sindAdm_normEscolaridade_(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\bensino\b/g, '').replace(/[^a-z]/g, '');
}

/**
 * Monta uma linha de campos do formulário.
 * Campo vazio recebe espaço não-quebrável REAL (fora do escape), para
 * não imprimir "&nbsp;" como texto.
 */
function sindAdm_linhaCampos_(campos) {
  var tds = campos.map(function (c) {
    var valor = (c[1] === null || c[1] === undefined) ? '' : String(c[1]).trim();
    var conteudo = valor ? sindAdm_esc_(valor) : '\u00A0';
    return '<td style="width:' + c[2] + '%;">' +
      '<span class="rotulo">' + sindAdm_esc_(c[0]) + '</span>' +
      '<span class="valor">' + conteudo + '</span></td>';
  }).join('');
  return '<table class="campos"><tr>' + tds + '</tr></table>';
}

// ============================================================================
// UTILITÁRIOS DE MANUTENÇÃO (executar pelo editor, quando necessário)
// ============================================================================

/**
 * Prepara a aba Associados para receber filiações vindas do módulo de
 * Sindicalização. Rotula a coluna M (que já recebe data de atualização
 * pelo AprovacaoCadastro.gs, mas nunca teve cabeçalho) e cria as
 * colunas de matrícula, data de filiação e vínculo com a ficha.
 *
 * SEGURANÇA: escreve exclusivamente na linha 1 (cabeçalhos). Nenhum
 * dado de associado é lido, alterado ou movido. Idempotente.
 */
function prepararAbaAssociadosParaSindicalizacao() {
  var NOVOS = [
    [13, 'ULTIMA_ATUALIZACAO'],
    [14, 'MATRICULA'],
    [15, 'DATA_FILIACAO'],
    [16, 'ID_FICHA']
  ];

  var ss = planilhaSisgep_();
  var aba = ss.getSheetByName('Associados');
  if (!aba) throw new Error('Aba Associados não encontrada.');

  var esperado = ['Nome fantasia', 'Nome', 'CPF', 'Filiado', 'Logradouro',
    'Número', 'Bairro', 'Cidade', 'CEP', 'Celular', 'CELULAR2', 'E-mail'];
  var atual = aba.getRange(1, 1, 1, 12).getValues()[0];
  for (var i = 0; i < esperado.length; i++) {
    if (String(atual[i]).trim() !== esperado[i]) {
      throw new Error('Cabeçalho inesperado na coluna ' + (i + 1) +
        ': encontrado "' + atual[i] + '", esperado "' + esperado[i] +
        '". Nada foi alterado — confira a aba antes de prosseguir.');
    }
  }

  var criadas = [];
  var jaExistiam = [];
  NOVOS.forEach(function (par) {
    var col = par[0];
    var nome = par[1];
    if (aba.getMaxColumns() < col) {
      aba.insertColumnsAfter(aba.getMaxColumns(), col - aba.getMaxColumns());
    }
    var atualCabecalho = String(aba.getRange(1, col).getValue()).trim();
    if (atualCabecalho === nome) {
      jaExistiam.push(nome);
      return;
    }
    if (atualCabecalho !== '') {
      throw new Error('A coluna ' + col + ' já contém o cabeçalho "' +
        atualCabecalho + '". Nada foi alterado para não sobrescrever.');
    }
    aba.getRange(1, col).setValue(nome);
    criadas.push(nome);
  });

  aba.getRange(1, 13, 1, 4)
     .setBackground('#002f6c')
     .setFontColor('#FFFFFF')
     .setFontWeight('bold')
     .setFontFamily('Plus Jakarta Sans');
  aba.getRange(2, 14, Math.max(aba.getMaxRows() - 1, 1), 1)
     .setNumberFormat('@');

  return 'Colunas criadas: ' + (criadas.join(', ') || 'nenhuma') +
    ' | já existiam: ' + (jaExistiam.join(', ') || 'nenhuma') +
    ' | total de colunas agora: ' + aba.getLastColumn();
}

/**
 * Diagnóstico: lista todas as abas da planilha de produção com o
 * número de linhas e os primeiros cabeçalhos de cada uma.
 * Somente leitura. Ver saída em Registro de execução.
 */
function listarAbasDaPlanilha() {
  var ss = planilhaSisgep_();
  var abas = ss.getSheets();
  Logger.log('TOTAL DE ABAS: ' + abas.length);
  abas.forEach(function (aba) {
    var ultLinha = aba.getLastRow();
    var ultCol = aba.getLastColumn();
    var cab = '';
    if (ultLinha > 0 && ultCol > 0) {
      cab = aba.getRange(1, 1, 1, Math.min(ultCol, 8))
               .getValues()[0].join(' | ');
    }
    Logger.log('[' + aba.getName() + '] linhas=' + (ultLinha - 1) +
      ' colunas=' + ultCol + ' >> ' + cab);
  });
  return 'Ver Registro de execução.';
}

/**
 * Regera o PDF de uma ficha já existente, sem alterar status nem dados.
 * Útil para aplicar correções de layout em fichas antigas.
 * Ex.: regerarPDFFicha('FICHA-20260723114233-2658')
 */
function regerarPDFFicha(idFicha) {
  var r = sindAdm_buscarPorId_(idFicha);
  if (!r) throw new Error('Ficha não encontrada: ' + idFicha);
  r.LINK_PDF = gerarPDFFichaSindicalizacao(idFicha);
  sindAdm_gravar_(r);
  sindAdm_limparCache_();
  Logger.log('PDF regerado: ' + r.LINK_PDF);
  return r.LINK_PDF;
}
/** Atalho para regerar o PDF da ficha de teste pelo editor. */
function regerarPDFTeste() {
  return regerarPDFFicha('FICHA-20260723114233-2658');
}
/**
 * Diagnóstico da aba Escolas: descobre o que cada coluna realmente contém,
 * classificando o conteúdo por padrão (CNPJ, e-mail, telefone, CEP, data,
 * texto) em vez de confiar no cabeçalho — que está desalinhado.
 * Somente leitura. Ver saída em Registro de execução.
 */
function diagnosticarAbaEscolas() {
  var ss = planilhaSisgep_();
  var aba = ss.getSheetByName('Escolas');
  if (!aba) throw new Error('Aba Escolas não encontrada.');

  var ultLinha = aba.getLastRow();
  var ultCol = aba.getLastColumn();
  var cab = aba.getRange(1, 1, 1, ultCol).getValues()[0];
  var amostraN = Math.min(ultLinha - 1, 200);
  var dados = aba.getRange(2, 1, amostraN, ultCol).getValues();

  function classificar(v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) return 'VAZIO';
    if (v instanceof Date) return 'DATA';
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(s)) return 'CNPJ';
    if (/^\d{14}$/.test(s)) return 'CNPJ';
    if (s.indexOf('@') > 0 && s.indexOf('.') > 0) return 'EMAIL';
    if (/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(s)) return 'TELEFONE';
    if (/^\d{5}-?\d{3}$/.test(s)) return 'CEP';
    if (/^[A-Z]{2}$/.test(s)) return 'UF';
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /GMT/.test(s)) return 'DATA';
    if (/^\d+$/.test(s)) return 'NUMERO';
    if (/^(ATIVA|BAIXADA|SUSPENSA|INAPTA|SEM ALTERAÇÃO|ATUALIZADA)/i.test(s)) return 'STATUS';
    return 'TEXTO';
  }

  Logger.log('ABA ESCOLAS · ' + (ultLinha - 1) + ' escolas · ' +
    ultCol + ' colunas · amostra de ' + amostraN + ' linhas');
  Logger.log('col | cabeçalho | preenchimento | conteúdo real | exemplo');
  Logger.log('----------------------------------------------------------');

  for (var c = 0; c < ultCol; c++) {
    var tipos = {};
    var preenchidos = 0;
    var exemplo = '';
    for (var i = 0; i < dados.length; i++) {
      var t = classificar(dados[i][c]);
      tipos[t] = (tipos[t] || 0) + 1;
      if (t !== 'VAZIO') {
        preenchidos++;
        if (!exemplo) exemplo = String(dados[i][c]).substring(0, 32);
      }
    }
    var dominante = '', maior = 0;
    Object.keys(tipos).forEach(function (t) {
      if (t !== 'VAZIO' && tipos[t] > maior) { maior = tipos[t]; dominante = t; }
    });
    var pct = Math.round(preenchidos * 100 / amostraN);
    Logger.log((c + 1) + ' | ' + String(cab[c] || '(sem cabeçalho)').substring(0, 24) +
      ' | ' + pct + '% | ' + (dominante || '—') +
      ' | ' + exemplo);
  }
  return 'Ver Registro de execução.';
}
/**
 * Conta quantas linhas da aba Escolas estão com dados deslocados,
 * testando o bloco operacional (colunas 1 a 14) contra o padrão esperado.
 * Somente leitura. Ver saída em Registro de execução.
 */
function contarEscolasDesalinhadas() {
  var ss = planilhaSisgep_();
  var aba = ss.getSheetByName('Escolas');
  var ultLinha = aba.getLastRow();
  var dados = aba.getRange(2, 1, ultLinha - 1, 14).getValues();

  var ehEmail = function (s) { s = String(s || ''); return s.indexOf('@') > 0; };
  var ehCNPJ = function (s) {
    return String(s || '').replace(/\D/g, '').length === 14;
  };
  var ehTelefone = function (s) {
    var d = String(s || '').replace(/\D/g, '');
    return d.length >= 10 && d.length <= 11;
  };

  var problemas = { semCNPJ: [], emailInvalido: [], telefoneErrado: [], cidadeComCEP: [] };
  var ok = 0;

  dados.forEach(function (l, i) {
    var linha = i + 2;
    var bom = true;
    if (!ehCNPJ(l[2])) { problemas.semCNPJ.push(linha); bom = false; }
    if (l[3] && !ehEmail(l[3])) { problemas.emailInvalido.push(linha); bom = false; }
    if (l[5] && !ehTelefone(l[5]) && String(l[5]).trim() !== '') {
      problemas.telefoneErrado.push(linha); bom = false;
    }
    if (/^\d{5}-?\d{3}$/.test(String(l[7] || '').trim())) {
      problemas.cidadeComCEP.push(linha); bom = false;
    }
    if (bom) ok++;
  });

  Logger.log('Total de escolas: ' + dados.length);
  Logger.log('Linhas íntegras (colunas 1-14): ' + ok);
  Object.keys(problemas).forEach(function (k) {
    var lista = problemas[k];
    Logger.log(k + ': ' + lista.length +
      (lista.length ? '  → linhas ' + lista.slice(0, 25).join(', ') +
        (lista.length > 25 ? ' …' : '') : ''));
  });
  return 'Ver Registro de execução.';
}
/** Atalho para definir o contador de matrícula pelo editor. */
function definirMatriculaInicialAgora() {
  return definirMatriculaInicialSindicalizacao(4587);  // ← trocar pelo número real
}