// ============================================================================
// ARQUIVO: SindicalizacaoOficio.gs
// Ponte entre a Sindicalização Digital e o módulo de Ofícios.
//
// Fluxo "Aprovar e Encaminhar":
//   ficha ASSINADA → seleção da escola destinatária → preview do ofício →
//   aprovação (matrícula + associado) → ofício de filiação na numeração
//   oficial → fila de envio à escola → protocolo no histórico.
//
// REAPROVEITA o módulo de Ofícios existente — não cria numeração paralela:
//   gerarOficioWeb()  → numeração NNN/AAAA, PDF, fila, Controle, log e
//                       registro automático na Mensalidade_Controle
//   previewOficioWeb() → HTML da prévia
//
// O PDF da ficha assinada vira o anexo obrigatório do ofício, dispensando
// digitalização de papel.
//
// POR QUE A ESCOLA É ESCOLHIDA NA APROVAÇÃO: o ofício exige CNPJ válido e
// e-mail da escola, que vivem na aba Escolas (indexada por razão social).
// A ficha grava o nome no vocabulário da aba Associados. Medição de
// 23/07/2026: apenas 4,1% dos nomes casam entre as duas bases. Enquanto
// não houver De-Para consolidado, a secretaria confirma o destinatário —
// e cada confirmação alimenta o De-Para automaticamente.
// ============================================================================

var SINDOF_ABA_DEPARA = 'SISGEP_DePara_Escolas';
var SINDOF_CACHE_SEG = 600;

/* ==========================================================================
 * SELEÇÃO DA ESCOLA DESTINATÁRIA
 * ========================================================================== */

/**
 * Busca escolas na aba Escolas para o seletor do modal.
 * Retorna nome, CNPJ e e-mails — o que o ofício exige.
 * Se houver De-Para registrado para o nome da ficha, a escola vinculada
 * vem primeiro, já sugerida.
 *
 * @param {string} termo       Texto digitado pela secretaria
 * @param {string} nomeNaFicha Nome da escola como veio na ficha
 */
function buscarEscolasParaOficio(termo, nomeNaFicha) {
  var aba = sindOf_abaEscolas_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return { sucesso: true, escolas: [], sugerida: null };

  var mapa = sindOf_mapaCabecalho_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, Math.min(aba.getLastColumn(), 14)).getValues();

  var col = function (linha, nome, padrao) {
    var i = mapa[String(nome).toUpperCase()];
    i = (i === undefined ? padrao : i);
    return String(linha[i - 1] === null ? '' : linha[i - 1]).trim();
  };

  var lista = [];
  dados.forEach(function (linha) {
    var nome = col(linha, 'ESCOLA (RAZÃO SOCIAL)', 2);
    var cnpj = sindOf_digitos_(col(linha, 'CNPJ', 3));
    if (!nome || cnpj.length !== 14) return;
    lista.push({
      nome: nome,
      cnpj: cnpj,
      cnpjFormatado: sindOf_fmtCNPJ_(cnpj),
      unidade: col(linha, 'UNIDADE', 1),
      emailPrincipal: col(linha, 'E-MAIL (PRINCIPAL)', 4),
      emailsTodos: col(linha, 'E-MAILS (TODOS)', 5),
      cidade: col(linha, 'CIDADE', 8)
    });
  });

  // Sugestão a partir do De-Para já confirmado antes
  var sugerida = null;
  var vinculo = sindOf_buscarDePara_(nomeNaFicha);
  if (vinculo) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].cnpj === vinculo.cnpj) { sugerida = lista[i]; break; }
    }
  }

  var t = sindOf_normalizar_(termo);
  var filtrada = !t ? lista : lista.filter(function (e) {
    return sindOf_normalizar_(e.nome + ' ' + e.cidade + ' ' + e.cnpj).indexOf(t) >= 0;
  });

  filtrada.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

  return {
    sucesso: true,
    total: filtrada.length,
    escolas: filtrada.slice(0, 60),
    sugerida: sugerida
  };
}

/**
 * Registra o vínculo entre o nome usado na ficha/Associados e o CNPJ da
 * escola real. Chamado automaticamente a cada encaminhamento — com o
 * tempo, o De-Para se completa sozinho, sem trabalho de planilha.
 */
function sindOf_registrarDePara_(nomeNaFicha, escola, usuario) {
  try {
    var nome = String(nomeNaFicha || '').trim();
    if (!nome || !escola || !escola.cnpj) return;

    var ss = sindOf_planilha_();
    var aba = ss.getSheetByName(SINDOF_ABA_DEPARA);
    if (!aba) {
      aba = ss.insertSheet(SINDOF_ABA_DEPARA);
      aba.getRange(1, 1, 1, 6)
         .setValues([['NOME_NA_FICHA', 'ESCOLA_RAZAO_SOCIAL', 'CNPJ',
                      'EMAIL_PRINCIPAL', 'CONFIRMADO_POR', 'DATA']])
         .setBackground('#002f6c').setFontColor('#FFFFFF')
         .setFontWeight('bold').setFontFamily('Plus Jakarta Sans');
      aba.setFrozenRows(1);
      aba.getRange(2, 3, aba.getMaxRows() - 1, 1).setNumberFormat('@');
    }

    var ultima = aba.getLastRow();
    if (ultima >= 2) {
      var nomes = aba.getRange(2, 1, ultima - 1, 1).getValues();
      var alvo = sindOf_normalizar_(nome);
      for (var i = 0; i < nomes.length; i++) {
        if (sindOf_normalizar_(nomes[i][0]) === alvo) return; // já registrado
      }
    }
    aba.appendRow([nome, escola.nome, escola.cnpj,
      escola.emailPrincipal || '', usuario || '', new Date()]);
    try { CacheService.getScriptCache().remove('SINDOF_DEPARA'); } catch (e) {}
  } catch (e) {
    Logger.log('De-Para não registrado: ' + e.message);
  }
}

function sindOf_buscarDePara_(nomeNaFicha) {
  var nome = String(nomeNaFicha || '').trim();
  if (!nome) return null;
  try {
    var aba = sindOf_planilha_().getSheetByName(SINDOF_ABA_DEPARA);
    if (!aba || aba.getLastRow() < 2) return null;
    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues();
    var alvo = sindOf_normalizar_(nome);
    for (var i = 0; i < dados.length; i++) {
      if (sindOf_normalizar_(dados[i][0]) === alvo) {
        return {
          nome: String(dados[i][1] || ''),
          cnpj: sindOf_digitos_(dados[i][2]),
          emailPrincipal: String(dados[i][3] || '')
        };
      }
    }
  } catch (e) {
    Logger.log('Consulta De-Para falhou: ' + e.message);
  }
  return null;
}

/* ==========================================================================
 * PREVIEW DO OFÍCIO
 * ========================================================================== */

/**
 * Devolve o HTML da prévia do ofício de filiação para exibir no modal,
 * antes de qualquer gravação. Nenhum número é consumido nesta etapa.
 *
 * @param {string} idFicha
 * @param {Object} escola   { nome, cnpj, emailPrincipal, emailsTodos }
 */
function previewOficioFiliacao(idFicha, escola) {
  try {
    var f = sindAdm_buscarPorId_(idFicha);
    if (!f) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
    if (!escola || !escola.cnpj) {
      return { sucesso: false, mensagem: 'Selecione a escola destinatária.' };
    }

    var html = previewOficioWeb({
      tipo: 'FILIACAO',
      escola: escola.nome,
      cnpj: escola.cnpj,
      email: escola.emailPrincipal || '',
      colaboradores: [String(f.NOME_COMPLETO || '').trim()]
    });

    return {
      sucesso: true,
      html: html,
      proximoNumero: preverProximoNumeroOficio(),
      trabalhador: f.NOME_COMPLETO,
      escola: escola.nome,
      emailDestino: escola.emailsTodos || escola.emailPrincipal || ''
    };
  } catch (e) {
    Logger.log('previewOficioFiliacao: ' + e.message);
    return { sucesso: false, mensagem: 'Erro ao gerar a prévia: ' + e.message };
  }
}

/* ==========================================================================
 * APROVAR E ENCAMINHAR
 * ========================================================================== */

/**
 * Executa o ciclo completo:
 *   1. aprova a ficha (matrícula + gravação na base de Associados)
 *   2. emite o ofício de filiação na numeração oficial
 *   3. anexa o PDF da ficha assinada
 *   4. coloca na fila de envio à escola
 *   5. registra o De-Para escola↔CNPJ para as próximas
 *
 * A aprovação acontece ANTES do ofício: se a emissão falhar, o trabalhador
 * já é associado (o que importa para ele) e o ofício pode ser reemitido
 * depois, sem perder a matrícula.
 *
 * @param {string} idFicha
 * @param {Object} escola      { nome, cnpj, emailPrincipal, emailsTodos }
 * @param {string} aprovadoPor Nome do usuário do SISGEP
 */
function aprovarEEncaminharFicha(idFicha, escola, aprovadoPor) {
  if (!escola || !escola.cnpj || sindOf_digitos_(escola.cnpj).length !== 14) {
    return { sucesso: false, mensagem: 'Selecione uma escola com CNPJ válido.' };
  }
  var emailDestino = String(escola.emailsTodos || escola.emailPrincipal || '').trim();
  if (!emailDestino) {
    return {
      sucesso: false,
      mensagem: 'A escola selecionada não tem e-mail cadastrado. ' +
        'Atualize o cadastro dela antes de encaminhar.'
    };
  }

  var f = sindAdm_buscarPorId_(idFicha);
  if (!f) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
  if (f.STATUS !== 'ASSINADA') {
    return {
      sucesso: false,
      mensagem: 'Só é possível encaminhar fichas ASSINADAS. Status atual: ' +
        f.STATUS + '.'
    };
  }
  var nomeNaFicha = String(f.ESCOLA || '').trim();

  // 1. Aprovação (matrícula + associado + PDF + e-mail de boas-vindas)
  var aprovacao = aprovarFichaSindicalizacao(idFicha, aprovadoPor);
  if (!aprovacao.sucesso) return aprovacao;

  // 2. Anexo: o PDF da ficha assinada
  var atualizada = sindAdm_buscarPorId_(idFicha);
  var anexoFicha = null;
  try {
    anexoFicha = sindOf_fichaComoAnexo_(atualizada);
  } catch (eAnexo) {
    Logger.log('Anexo da ficha indisponível: ' + eAnexo.message);
  }
  if (!anexoFicha) {
    return {
      sucesso: true,
      parcial: true,
      matricula: aprovacao.matricula,
      mensagem: 'Ficha aprovada e matrícula ' + aprovacao.matricula +
        ' emitida, mas o PDF da ficha não pôde ser anexado — o ofício não ' +
        'foi gerado. Use "Reemitir ofício" depois de verificar o arquivo.'
    };
  }

  // 3. Ofício na numeração oficial (reaproveita o módulo de Ofícios)
  var retorno;
  try {
    retorno = gerarOficioWeb({
      tipo: 'FILIACAO',
      escola: escola.nome,
      cnpj: sindOf_digitos_(escola.cnpj),
      email: emailDestino,
      unidade: escola.unidade || '',
      colaboradores: [String(atualizada.NOME_COMPLETO || '').trim()],
      cpfs: [sindOf_digitos_(atualizada.CPF)],
      fichas: [anexoFicha],
      observacoes: 'Matrícula ' + aprovacao.matricula +
        ' · Ficha ' + atualizada.ID_FICHA +
        (atualizada.ID_VISITA ? ' · Visita ' + atualizada.ID_VISITA : '')
    });
  } catch (eOf) {
    Logger.log('gerarOficioWeb falhou: ' + eOf.message);
    return {
      sucesso: true,
      parcial: true,
      matricula: aprovacao.matricula,
      mensagem: 'Ficha aprovada e matrícula ' + aprovacao.matricula +
        ' emitida, mas o ofício falhou: ' + eOf.message
    };
  }

  if (!retorno || retorno.erro) {
    return {
      sucesso: true,
      parcial: true,
      matricula: aprovacao.matricula,
      mensagem: 'Ficha aprovada e matrícula ' + aprovacao.matricula +
        ' emitida, mas o ofício não foi gerado: ' +
        ((retorno && retorno.mensagem) || 'erro desconhecido')
    };
  }

  // 4. Guarda o vínculo escola↔CNPJ para as próximas fichas
  sindOf_registrarDePara_(nomeNaFicha, escola, aprovadoPor);

  // 5. Anota o ofício na própria ficha
  try {
    atualizada.MOTIVO_REJEICAO = '';
    atualizada.OBSERVACOES_OFICIO = retorno.dados.numero;
    sindAdm_gravar_(atualizada);
    sindAdm_limparCache_();
  } catch (e) { /* campo opcional */ }

  return {
    sucesso: true,
    matricula: aprovacao.matricula,
    numeroOficio: retorno.dados.numero,
    codigoVerificacao: retorno.dados.codigoVerificacao,
    urlOficio: retorno.dados.url,
    urlFicha: atualizada.LINK_PDF || '',
    emailDestino: emailDestino,
    avisos: aprovacao.avisos || [],
    mensagem: 'Matrícula ' + aprovacao.matricula + ' emitida e Ofício ' +
      retorno.dados.numero + ' gerado. O envio à escola está na fila.'
  };
}

/**
 * Reemite o ofício de uma ficha já matriculada (uso quando a emissão
 * falhou na aprovação ou quando é preciso reenviar a outra escola).
 */
function reemitirOficioFicha(idFicha, escola, usuario) {
  var f = sindAdm_buscarPorId_(idFicha);
  if (!f) return { sucesso: false, mensagem: 'Ficha não encontrada.' };
  if (f.STATUS !== 'MATRICULADA') {
    return { sucesso: false, mensagem: 'Só fichas MATRICULADAS podem ter ofício reemitido.' };
  }
  if (!escola || sindOf_digitos_(escola.cnpj).length !== 14) {
    return { sucesso: false, mensagem: 'Selecione uma escola com CNPJ válido.' };
  }
  var emailDestino = String(escola.emailsTodos || escola.emailPrincipal || '').trim();
  if (!emailDestino) {
    return { sucesso: false, mensagem: 'A escola selecionada não tem e-mail cadastrado.' };
  }

  var anexo = sindOf_fichaComoAnexo_(f);
  if (!anexo) return { sucesso: false, mensagem: 'PDF da ficha não encontrado.' };

  var retorno = gerarOficioWeb({
    tipo: 'FILIACAO',
    escola: escola.nome,
    cnpj: sindOf_digitos_(escola.cnpj),
    email: emailDestino,
    unidade: escola.unidade || '',
    colaboradores: [String(f.NOME_COMPLETO || '').trim()],
    cpfs: [sindOf_digitos_(f.CPF)],
    fichas: [anexo],
    observacoes: 'Reemissão · Matrícula ' + f.MATRICULA + ' · Ficha ' + f.ID_FICHA
  });

  if (!retorno || retorno.erro) {
    return { sucesso: false, mensagem: (retorno && retorno.mensagem) || 'Falha ao gerar o ofício.' };
  }
  sindOf_registrarDePara_(f.ESCOLA, escola, usuario);
  return {
    sucesso: true,
    numeroOficio: retorno.dados.numero,
    urlOficio: retorno.dados.url,
    mensagem: 'Ofício ' + retorno.dados.numero + ' reemitido e na fila de envio.'
  };
}

/* ==========================================================================
 * HELPERS
 * ========================================================================== */

/**
 * Converte o PDF da ficha assinada no formato de anexo que o módulo de
 * Ofícios espera: { nome, tipo, base64 }.
 */
function sindOf_fichaComoAnexo_(ficha) {
  var link = String(ficha.LINK_PDF || '').trim();
  if (!link) return null;
  var m = link.match(/[-\w]{25,}/);
  if (!m) return null;
  try {
    var blob = DriveApp.getFileById(m[0]).getBlob();
    return {
      nome: blob.getName(),
      tipo: 'application/pdf',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (e) {
    Logger.log('Ficha em PDF não lida (' + m[0] + '): ' + e.message);
    return null;
  }
}

function sindOf_planilha_() {
  return SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E');
}

function sindOf_abaEscolas_() {
  var aba = sindOf_planilha_().getSheetByName('Escolas');
  if (!aba) throw new Error('Aba Escolas não encontrada.');
  return aba;
}

function sindOf_mapaCabecalho_(aba) {
  var ultCol = aba.getLastColumn();
  if (ultCol < 1) return {};
  var cab = aba.getRange(1, 1, 1, ultCol).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave && mapa[chave] === undefined) mapa[chave] = i + 1;
  });
  return mapa;
}

function sindOf_digitos_(v) {
  return String(v || '').replace(/\D/g, '');
}

function sindOf_fmtCNPJ_(cnpj) {
  var d = sindOf_digitos_(cnpj);
  if (d.length !== 14) return d;
  return d.substring(0, 2) + '.' + d.substring(2, 5) + '.' + d.substring(5, 8) +
    '/' + d.substring(8, 12) + '-' + d.substring(12);
}

function sindOf_normalizar_(v) {
  return String(v || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/* ==========================================================================
 * DIAGNÓSTICO
 * ========================================================================== */

/**
 * Situação do De-Para escola↔CNPJ. Somente leitura.
 */
function diagnosticarDeParaEscolas() {
  var aba = sindOf_planilha_().getSheetByName(SINDOF_ABA_DEPARA);
  if (!aba || aba.getLastRow() < 2) {
    Logger.log('Nenhum vínculo registrado ainda. A tabela é preenchida ' +
      'automaticamente a cada ofício de filiação encaminhado.');
    return 'Ver Registro de execução.';
  }
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues();
  Logger.log('Vínculos registrados: ' + dados.length);
  dados.slice(0, 40).forEach(function (l) {
    Logger.log('  "' + l[0] + '"  →  ' + l[1] + '  (' + l[2] + ')');
  });
  return 'Ver Registro de execução.';
}
/**
 * Atualiza o e-mail de uma escola no cadastro, a partir do modal de
 * aprovação. Aceita vários e-mails separados por vírgula ou ponto e
 * vírgula. Grava o primeiro em "E-mail (principal)" e todos em
 * "E-mails (todos)".
 */
function atualizarEmailEscola(cnpj, emails, usuario) {
  var alvo = sindOf_digitos_(cnpj);
  if (alvo.length !== 14) return { sucesso: false, mensagem: 'CNPJ inválido.' };

  var lista = String(emails || '').split(/[;,]/)
    .map(function (e) { return e.trim().toLowerCase(); })
    .filter(Boolean);
  if (!lista.length) return { sucesso: false, mensagem: 'Informe ao menos um e-mail.' };

  var invalido = null;
  lista.forEach(function (e) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !invalido) invalido = e;
  });
  if (invalido) return { sucesso: false, mensagem: 'E-mail inválido: ' + invalido };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var aba = sindOf_abaEscolas_();
    var ultima = aba.getLastRow();
    if (ultima < 2) return { sucesso: false, mensagem: 'Cadastro de escolas vazio.' };

    var mapa = sindOf_mapaCabecalho_(aba);
    var colCnpj = mapa['CNPJ'] || 3;
    var colPrinc = mapa['E-MAIL (PRINCIPAL)'] || 4;
    var colTodos = mapa['E-MAILS (TODOS)'] || 5;

    var cnpjs = aba.getRange(2, colCnpj, ultima - 1, 1).getValues();
    for (var i = 0; i < cnpjs.length; i++) {
      if (sindOf_digitos_(cnpjs[i][0]) === alvo) {
        var linha = i + 2;
        aba.getRange(linha, colPrinc).setValue(lista[0]);
        aba.getRange(linha, colTodos).setValue(lista.join(', '));
        Logger.log('E-mail da escola ' + alvo + ' atualizado por ' +
          (usuario || '—') + ': ' + lista.join(', '));
        return {
          sucesso: true,
          emailPrincipal: lista[0],
          emailsTodos: lista.join(', '),
          mensagem: 'E-mail atualizado no cadastro da escola.'
        };
      }
    }
    return { sucesso: false, mensagem: 'Escola não encontrada pelo CNPJ.' };
  } finally {
    lock.releaseLock();
  }
}