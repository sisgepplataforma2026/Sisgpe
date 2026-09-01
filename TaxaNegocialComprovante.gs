// ============================================================================
// SISGEP · TaxaNegocialComprovante.gs
// Comprovante eletrônico privado da oposição — HOMOLOGAÇÃO SOMENTE
// ============================================================================

var TN_COMPROVANTE_COLUNAS = [
  'TEXTO_MANIFESTACAO_SNAPSHOT',
  'VERSAO_MANIFESTACAO_SNAPSHOT',
  'CODIGO_AUTENTICIDADE',
  'ID_ARQUIVO_PDF',
  'PDF_GERADO_EM'
];

/**
 * Acrescenta apenas as colunas da Fase 3 que ainda não existirem.
 * Idempotente; nunca renomeia nem remove coluna existente.
 */
function tnComprovanteGarantirColunas_() {
  var sh = tnGetSheet_(TN_CONFIG.ABAS.OPOSICOES);
  var hm = tnHeaderMap_(sh);
  var faltantes = TN_COMPROVANTE_COLUNAS.filter(function(nome) {
    return hm.map[nome] == null;
  });
  if (!faltantes.length) return hm;

  var inicio = sh.getLastColumn() + 1;
  sh.getRange(1, inicio, 1, faltantes.length).setValues([faltantes]);
  return tnHeaderMap_(sh);
}

function tnComprovanteEsc_(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tnComprovanteCpf_(cpf) {
  var d = tnNormalizarCpf_(cpf);
  if (d.length !== 11) return d;
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

function tnComprovanteCnpj_(cnpj) {
  var d = tnNormalizarCnpj_(cnpj);
  if (d.length !== 14) return String(cnpj || '');
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

function tnComprovanteData_(valor) {
  if (!valor) return '';
  var d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return Utilities.formatDate(d, TN_CONFIG.FUSO_HORARIO, 'dd/MM/yyyy');
}

function tnComprovanteDataHora_(valor) {
  if (!valor) return '';
  var d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return Utilities.formatDate(d, TN_CONFIG.FUSO_HORARIO, 'dd/MM/yyyy HH:mm:ss');
}

function tnComprovanteHashBytes_(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function(b) {
    var n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');
}

/**
 * Código impresso no PDF. Não é o HASH_PDF: um PDF não pode conter o hash
 * de si próprio sem alterar os próprios bytes. O hash real do arquivo é
 * calculado somente depois que o blob final está pronto e fica no banco.
 */
function tnComprovanteCodigoAutenticidade_(oposicao) {
  return tnHashHex_([
    String(oposicao.ID_OPOSICAO || ''),
    String(oposicao.PROTOCOLO || ''),
    String(oposicao.HASH_MANIFESTACAO || ''),
    String(oposicao.CHAVE_UNICA || '')
  ].join('|')).toUpperCase().slice(0, 24);
}

function tnComprovanteCodigoFormatado_(codigo) {
  return String(codigo || '').replace(/(.{4})/g, '$1 ').trim();
}

function tnComprovantePastaFilha_(pai, nome) {
  var it = pai.getFoldersByName(String(nome));
  return it.hasNext() ? it.next() : pai.createFolder(String(nome));
}

function tnComprovantePastaDestino_(exercicio) {
  if (typeof getRecursoId_ !== 'function') {
    throw new Error('Resolvedor de recursos por ambiente indisponível.');
  }
  var raizId = getRecursoId_('COMPROVANTES');
  var raiz = DriveApp.getFolderById(String(raizId));
  var modulo = tnComprovantePastaFilha_(raiz, 'Taxa Negocial');
  var ano = String(exercicio || Utilities.formatDate(new Date(), TN_CONFIG.FUSO_HORARIO, 'yyyy'))
    .replace(/[^0-9A-Za-z._-]+/g, '-');
  return tnComprovantePastaFilha_(modulo, ano || 'Sem-exercicio');
}

function tnComprovanteExtrairIdDrive_(url) {
  var m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

function tnComprovanteSnapshot_(oposicao, pre) {
  tnComprovanteGarantirColunas_();
  var atual = tnRepoBuscarOposicaoPorId_(oposicao.ID_OPOSICAO);
  if (!atual) throw new Error('Oposição não encontrada ao preparar o comprovante.');

  var texto = String(atual.TEXTO_MANIFESTACAO_SNAPSHOT || '');
  var versao = String(atual.VERSAO_MANIFESTACAO_SNAPSHOT || '');
  var campanha = null;

  if (!texto && pre && pre.ok && pre.campanha) {
    texto = String(pre.campanha.TEXTO_MANIFESTACAO || '');
    versao = String(pre.campanha.VERSAO_MANIFESTACAO || '');
    campanha = pre.campanha;
  }

  if (!texto) {
    campanha = tnRepoBuscarCampanhaPorId_(atual.ID_CAMPANHA);
    if (!campanha) throw new Error('Campanha da oposição não encontrada.');

    var hashAtual = tnHashManifestacao_(campanha, atual.CPF_NORMALIZADO, atual.ESCOLA_ID);
    if (String(hashAtual) !== String(atual.HASH_MANIFESTACAO || '')) {
      throw new Error(
        'O texto atual da campanha difere do texto aceito pelo trabalhador e não existe snapshot recuperável. ' +
        'O comprovante não será recriado com conteúdo diferente.'
      );
    }
    texto = String(campanha.TEXTO_MANIFESTACAO || '');
    versao = String(campanha.VERSAO_MANIFESTACAO || '');
  }

  if (!campanha) campanha = tnRepoBuscarCampanhaPorId_(atual.ID_CAMPANHA);
  var codigo = String(atual.CODIGO_AUTENTICIDADE || '') || tnComprovanteCodigoAutenticidade_(atual);

  var precisaAtualizar = !atual.TEXTO_MANIFESTACAO_SNAPSHOT ||
    !atual.VERSAO_MANIFESTACAO_SNAPSHOT || !atual.CODIGO_AUTENTICIDADE;
  if (precisaAtualizar) {
    atual = tnRepoAtualizarOposicao_(atual.ID_OPOSICAO, {
      TEXTO_MANIFESTACAO_SNAPSHOT: texto,
      VERSAO_MANIFESTACAO_SNAPSHOT: versao,
      CODIGO_AUTENTICIDADE: codigo,
      ATUALIZADO_EM: new Date()
    });
  }

  return { oposicao: atual, campanha: campanha, texto: texto, versao: versao, codigo: codigo };
}

function tnComprovanteHtml_(ctx) {
  var o = ctx.oposicao;
  var c = ctx.campanha || {};
  var periodo = '';
  if (c.INICIO_OPOSICAO || c.FIM_OPOSICAO) {
    periodo = tnComprovanteData_(c.INICIO_OPOSICAO) + ' a ' + tnComprovanteData_(c.FIM_OPOSICAO);
  }

  var metodo = String(o.FORMA_CONFIRMACAO || 'ELETRONICA').replace(/_/g, ' ');
  var autenticidade = tnComprovanteCodigoFormatado_(ctx.codigo);

  return '<!doctype html><html><head><meta charset="UTF-8"><style>' +
    '@page{size:A4;margin:18mm 16mm;}*{box-sizing:border-box;}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#182230;font-size:11px;line-height:1.45;margin:0;}' +
    '.topo{border-bottom:3px solid #173f7a;padding-bottom:12px;margin-bottom:18px;}' +
    '.marca{font-size:20px;font-weight:700;color:#173f7a;}.sub{font-size:10px;color:#5c6775;margin-top:2px;}' +
    'h1{font-size:16px;text-align:center;margin:18px 0 6px;color:#182230;}' +
    '.protocolo{text-align:center;font-size:12px;font-weight:700;color:#173f7a;margin-bottom:18px;}' +
    '.secao{font-weight:700;background:#eef3f9;border-left:4px solid #173f7a;padding:6px 8px;margin:14px 0 7px;}' +
    'table{width:100%;border-collapse:collapse;}td{border:1px solid #d9dee6;padding:7px;vertical-align:top;}' +
    'td.rotulo{width:26%;font-weight:700;background:#f7f9fb;color:#344054;}' +
    '.manifestacao{border:1px solid #cfd6df;padding:14px;text-align:justify;white-space:pre-wrap;min-height:110px;}' +
    '.confirmacao{margin-top:16px;border:1px solid #b9c7da;background:#f7fafe;padding:12px;}' +
    '.aut{font-family:monospace;font-size:11px;font-weight:700;letter-spacing:.3px;}' +
    '.rodape{margin-top:24px;padding-top:10px;border-top:1px solid #d9dee6;font-size:9px;color:#667085;text-align:center;}' +
    '</style></head><body>' +
    '<div class="topo"><div class="marca">SINDEDUCAÇÃO-ES</div>' +
    '<div class="sub">Sistema Integrado de Gestão Sindical — SISGEP</div></div>' +
    '<h1>MANIFESTAÇÃO DE OPOSIÇÃO À CONTRIBUIÇÃO NEGOCIAL</h1>' +
    '<div class="protocolo">Protocolo ' + tnComprovanteEsc_(o.PROTOCOLO) + '</div>' +

    '<div class="secao">Identificação do trabalhador</div><table>' +
    '<tr><td class="rotulo">Nome</td><td>' + tnComprovanteEsc_(o.NOME_SNAPSHOT) + '</td></tr>' +
    '<tr><td class="rotulo">CPF</td><td>' + tnComprovanteEsc_(tnComprovanteCpf_(o.CPF_NORMALIZADO)) + '</td></tr>' +
    '</table>' +

    '<div class="secao">Instituição empregadora</div><table>' +
    '<tr><td class="rotulo">Instituição</td><td>' + tnComprovanteEsc_(o.ESCOLA_SNAPSHOT) + '</td></tr>' +
    '<tr><td class="rotulo">CNPJ</td><td>' + tnComprovanteEsc_(tnComprovanteCnpj_(o.CNPJ_SNAPSHOT)) + '</td></tr>' +
    '</table>' +

    '<div class="secao">Campanha</div><table>' +
    '<tr><td class="rotulo">Campanha / exercício</td><td>' + tnComprovanteEsc_(c.TITULO || c.EXERCICIO || o.ID_CAMPANHA) + '</td></tr>' +
    '<tr><td class="rotulo">Período de oposição</td><td>' + tnComprovanteEsc_(periodo || 'Conforme campanha registrada no SISGEP') + '</td></tr>' +
    '<tr><td class="rotulo">Versão da manifestação</td><td>' + tnComprovanteEsc_(ctx.versao || '1') + '</td></tr>' +
    '</table>' +

    '<div class="secao">Manifestação</div>' +
    '<div class="manifestacao">' + tnComprovanteEsc_(ctx.texto) + '</div>' +

    '<div class="secao">Confirmação eletrônica</div><div class="confirmacao">' +
    '<strong>Data e hora:</strong> ' + tnComprovanteEsc_(tnComprovanteDataHora_(o.DATA_HORA_OPOSICAO)) + '<br>' +
    '<strong>Método:</strong> ' + tnComprovanteEsc_(metodo) + '<br>' +
    '<strong>OTP validado:</strong> ' + tnComprovanteEsc_(o.OTP_VALIDADO || 'NÃO') + '<br>' +
    '<strong>Documento conferido presencialmente:</strong> ' + tnComprovanteEsc_(o.DOCUMENTO_CONFERIDO || 'NÃO') +
    (o.TIPO_DOCUMENTO_CONFERIDO ? ' — ' + tnComprovanteEsc_(o.TIPO_DOCUMENTO_CONFERIDO) : '') + '<br>' +
    '<strong>Código de autenticidade:</strong> <span class="aut">' + tnComprovanteEsc_(autenticidade) + '</span>' +
    '</div>' +

    '<div class="rodape">Documento eletrônico original gerado pelo SISGEP. ' +
    'A integridade do arquivo PDF é registrada separadamente por hash SHA-256 no sistema. ' +
    'Emissão: ' + tnComprovanteEsc_(tnComprovanteDataHora_(new Date())) + '.</div>' +
    '</body></html>';
}

function tnComprovanteDto_(oposicao, jaExistia) {
  return {
    idOposicao: oposicao.ID_OPOSICAO || '',
    protocolo: oposicao.PROTOCOLO || '',
    gerado: !!(oposicao.HASH_PDF && oposicao.LINK_PDF),
    jaExistia: jaExistia === true,
    codigoAutenticidade: tnComprovanteCodigoFormatado_(oposicao.CODIGO_AUTENTICIDADE || ''),
    hashPdf: oposicao.HASH_PDF || '',
    hashPdfCurto: oposicao.HASH_PDF ? String(oposicao.HASH_PDF).slice(0, 16) + '…' : '',
    geradoEm: tnComprovanteDataHora_(oposicao.PDF_GERADO_EM || ''),
    arquivoId: oposicao.ID_ARQUIVO_PDF || ''
  };
}

/**
 * Geração idempotente. O URL do Drive fica no registro para uso interno,
 * mas NÃO é devolvido ao frontend: arquivo é privado e acesso deve passar
 * pelo SISGEP, não por link público.
 */
function tnGerarComprovanteOposicao_(sessao, idOposicao, pre) {
  tnExigirHomologacaoSegura_();
  if (typeof arquivoSalvarPrivado_ !== 'function') throw new Error('Política central de arquivos privados indisponível.');
  if (typeof travarSisgep_ !== 'function') throw new Error('Infraestrutura de trava indisponível.');

  var trava = travarSisgep_(30000);
  try {
    tnComprovanteGarantirColunas_();
    var o = tnRepoBuscarOposicaoPorId_(idOposicao);
    if (!o) throw new Error('Oposição não encontrada.');
    if (String(o.STATUS_OPOSICAO || '').toUpperCase() !== 'REGISTRADA') {
      throw new Error('Somente oposição REGISTRADA pode gerar comprovante. Status atual: ' + o.STATUS_OPOSICAO + '.');
    }

    if (o.LINK_PDF && o.HASH_PDF) return { ok: true, dados: tnComprovanteDto_(o, true) };

    // Se uma versão anterior salvou a URL, mas falhou antes de persistir o hash,
    // recupera o mesmo arquivo em vez de criar duplicata.
    if (o.LINK_PDF && !o.HASH_PDF) {
      var idExistente = o.ID_ARQUIVO_PDF || tnComprovanteExtrairIdDrive_(o.LINK_PDF);
      if (!idExistente) throw new Error('Registro possui LINK_PDF sem identificador recuperável.');
      var existente = DriveApp.getFileById(idExistente);
      var hashExistente = tnComprovanteHashBytes_(existente.getBlob().getBytes());
      o = tnRepoAtualizarOposicao_(o.ID_OPOSICAO, {
        ID_ARQUIVO_PDF: idExistente,
        HASH_PDF: hashExistente,
        PDF_GERADO_EM: o.PDF_GERADO_EM || new Date(),
        ATUALIZADO_EM: new Date()
      });
      return { ok: true, dados: tnComprovanteDto_(o, true) };
    }

    var ctx = tnComprovanteSnapshot_(o, pre);
    o = ctx.oposicao;
    var html = tnComprovanteHtml_(ctx);
    var blob = Utilities.newBlob(html, 'text/html', 'oposicao_' + o.PROTOCOLO + '.html')
      .getAs('application/pdf');
    var nomeSeguro = String(o.PROTOCOLO || o.ID_OPOSICAO).replace(/[^0-9A-Za-z._-]+/g, '_');
    blob.setName('Oposicao_Taxa_Negocial_' + nomeSeguro + '.pdf');

    var hashPdf = tnComprovanteHashBytes_(blob.getBytes());
    var pasta = tnComprovantePastaDestino_(ctx.campanha && (ctx.campanha.EXERCICIO || ctx.campanha.TITULO));
    var salvo = arquivoSalvarPrivado_(blob, pasta.getId(), {
      nome: blob.getName(),
      contexto: 'Taxa Negocial · ' + String(o.PROTOCOLO || o.ID_OPOSICAO)
    });

    o = tnRepoAtualizarOposicao_(o.ID_OPOSICAO, {
      HASH_PDF: hashPdf,
      LINK_PDF: salvo.url,
      ID_ARQUIVO_PDF: salvo.id,
      PDF_GERADO_EM: new Date(),
      CODIGO_AUTENTICIDADE: ctx.codigo,
      OBSERVACAO: 'Registro eletrônico com comprovante PDF privado gerado.',
      ATUALIZADO_POR: (sessao && (sessao.email || sessao.usuario)) || '',
      ATUALIZADO_EM: new Date()
    });

    tnRepoAuditar_({
      registroId: o.ID_OPOSICAO,
      acao: 'COMPROVANTE_PDF_GERADO',
      sessao: sessao,
      valorNovo: {
        protocolo: o.PROTOCOLO,
        arquivoId: salvo.id,
        hashPdf: hashPdf,
        codigoAutenticidade: ctx.codigo,
        politicaArquivo: 'PRIVATE'
      },
      documento: o.PROTOCOLO
    });

    return { ok: true, mensagem: 'Comprovante eletrônico gerado.', dados: tnComprovanteDto_(o, false) };
  } finally {
    trava.liberar();
  }
}

function tnTentarGerarComprovante_(sessao, idOposicao, pre) {
  try {
    return tnGerarComprovanteOposicao_(sessao, idOposicao, pre);
  } catch (e) {
    tnRepoAuditar_({
      registroId: idOposicao || '',
      acao: 'COMPROVANTE_PDF_FALHOU',
      sessao: sessao,
      resultado: 'ERRO',
      justificativa: e && e.message ? e.message : String(e)
    });
    return {
      ok: false,
      codigo: 'COMPROVANTE_PENDENTE',
      mensagem: 'A oposição foi preservada, mas o comprovante PDF ainda não pôde ser gerado.',
      detalheTecnico: e && e.message ? e.message : String(e)
    };
  }
}

function taxaNegocialGerarComprovante_(sessao, idOposicao) {
  return tnTentarGerarComprovante_(sessao, String(idOposicao || '').trim(), null);
}

function taxaNegocialObterComprovante_(sessao, idOposicao) {
  tnExigirHomologacaoSegura_();
  tnComprovanteGarantirColunas_();
  var o = tnRepoBuscarOposicaoPorId_(idOposicao);
  if (!o) return { ok: false, codigo: 'NAO_ENCONTRADA', mensagem: 'Oposição não encontrada.' };
  return { ok: true, dados: tnComprovanteDto_(o, true) };
}
