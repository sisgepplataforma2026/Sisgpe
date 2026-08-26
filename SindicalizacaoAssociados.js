// ============================================================================
// ARQUIVO: SindicalizacaoAssociados.gs
// Módulo SISGEP — elo entre a Sindicalização Digital e a base de Associados.
//
// É ESTE arquivo que faz o trabalhador aprovado "passar a existir" para o
// resto do sistema: Portal do Associado, Carteirinha, China Park, Vouchers
// e Certificados leem a aba Associados, não a SISGEP_Sindicalizacao.
//
// Estrutura real da aba Associados (16 colunas, ~8.000 registros):
//  A Nome fantasia | B Nome | C CPF | D Filiado | E Logradouro | F Número
//  G Bairro | H Cidade | I CEP | J Celular | K CELULAR2 | L E-mail
//  M ULTIMA_ATUALIZACAO | N MATRICULA | O DATA_FILIACAO | P ID_FICHA
//
// Aba Escolas: 681 escolas, usada para padronizar o nome do empregador
// (coluna A da Associados) e alimentar a lista suspensa da ficha.
//
// Helpers prefixados sindAss_ para não colidir com o restante do SISGEP.
// ============================================================================

var SIND_ASS_ABA = 'Associados';
var SIND_ASS_ABA_ESCOLAS = 'Escolas';
var SIND_ASS_CACHE_ESCOLAS_SEG = 3600; // 1h

// Ordem canônica da aba Associados. O lookup é feito por NOME de coluna,
// com fallback para estas posições caso o cabeçalho esteja diferente.
var SIND_ASS_COLUNAS = [
  'Nome fantasia', 'Nome', 'CPF', 'Filiado', 'Logradouro', 'Número',
  'Bairro', 'Cidade', 'CEP', 'Celular', 'CELULAR2', 'E-mail',
  'ULTIMA_ATUALIZACAO', 'MATRICULA', 'DATA_FILIACAO', 'ID_FICHA'
];

/**
 * Lista de estabelecimentos para o campo "Estabelecimento de ensino" da
 * ficha, montada a partir do vocabulário que a própria base de Associados
 * já utiliza (coluna "Nome fantasia").
 *
 * POR QUE NÃO USAR A ABA ESCOLAS: os dois cadastros usam vocabulários
 * diferentes. A aba Escolas guarda razões sociais vindas de CNPJ
 * (destinatários de ofícios); a Associados usa nomes institucionais
 * ("UVV - VILA VELHA"). Medição feita em 23/07/2026: a melhor coluna da
 * aba Escolas cobre apenas 4,1% dos associados. Alimentar a ficha pela
 * própria Associados garante vínculo correto desde o cadastro.
 *
 * Retorna { sucesso, total, escolas:[{ nome, associados }] } ordenado
 * pelos estabelecimentos com mais associados primeiro (os mais prováveis
 * aparecem no topo da lista), e alfabeticamente em caso de empate.
 */
function listarEscolasParaFicha() {
  var cache = CacheService.getScriptCache();
  var emCache = cache.get('SIND_ASS_ESCOLAS');
  if (emCache) {
    try { return JSON.parse(emCache); } catch (e) { /* segue e relê */ }
  }

  var aba = sindAss_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return { sucesso: true, total: 0, escolas: [] };

  var mapa = sindAss_mapaCabecalho_(aba);
  var colEscola = (mapa['NOME FANTASIA'] === undefined ? 0 : mapa['NOME FANTASIA']) + 1;
  var nomes = aba.getRange(2, colEscola, ultima - 1, 1).getValues();

  var contagem = {};
  var original = {};
  nomes.forEach(function (l) {
    var bruto = String(l[0] || '').trim();
    if (!bruto) return;
    var chave = bruto.toUpperCase().replace(/\s+/g, ' ');
    contagem[chave] = (contagem[chave] || 0) + 1;
    // guarda a primeira grafia encontrada como rótulo oficial
    if (!original[chave]) original[chave] = bruto;
  });

  var escolas = Object.keys(contagem).map(function (chave) {
    return { nome: original[chave], associados: contagem[chave] };
  });

  escolas.sort(function (a, b) {
    if (b.associados !== a.associados) return b.associados - a.associados;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  var resposta = { sucesso: true, total: escolas.length, escolas: escolas };
  try {
    cache.put('SIND_ASS_ESCOLAS', JSON.stringify(resposta),
      SIND_ASS_CACHE_ESCOLAS_SEG);
  } catch (e) { /* payload grande: segue sem cache */ }
  return resposta;
}
/**
 * Força a releitura da lista de escolas (usar após cadastrar escola nova).
 */
function limparCacheEscolasFicha() {
  try { CacheService.getScriptCache().remove('SIND_ASS_ESCOLAS'); } catch (e) {}
  return 'Cache da lista de escolas limpo.';
}

/**
 * Procura o nome canônico de uma escola a partir de um texto livre.
 * Usado quando a ficha vem com escola digitada à mão (fichas antigas ou
 * cadastro rápido do diretor). Estratégia: match exato → prefixo →
 * contido. Retorna o nome canônico ou '' se não houver correspondência
 * segura (nunca "chuta" para não criar vínculo errado).
 */
function sindAss_normalizarNomeEscola_(textoLivre) {
  var alvo = String(textoLivre || '').trim().toUpperCase();
  if (!alvo) return '';
  var lista = listarEscolasParaFicha().escolas || [];

  var i;
  for (i = 0; i < lista.length; i++) {
    if (lista[i].nome.toUpperCase() === alvo) return lista[i].nome;
  }
  var candidatos = [];
  for (i = 0; i < lista.length; i++) {
    var n = lista[i].nome.toUpperCase();
    if (n.indexOf(alvo) === 0 || alvo.indexOf(n) === 0) {
      candidatos.push(lista[i].nome);
    }
  }
  if (candidatos.length === 1) return candidatos[0];

  candidatos = [];
  for (i = 0; i < lista.length; i++) {
    if (lista[i].nome.toUpperCase().indexOf(alvo) >= 0) {
      candidatos.push(lista[i].nome);
    }
  }
  return candidatos.length === 1 ? candidatos[0] : '';
}

/* ==========================================================================
 * GRAVAÇÃO NA BASE DE ASSOCIADOS
 * ========================================================================== */

/**
 * Grava (ou atualiza) o associado a partir de uma ficha aprovada.
 * Chamado por aprovarFichaSindicalizacao — não usar isoladamente.
 *
 * Regras:
 *  - Busca por CPF (comparação por dígitos, tolerante à formatação).
 *  - Se já existe: atualiza contatos/endereço, marca Filiado = S e
 *    grava matrícula/data de filiação/ID da ficha. NÃO apaga campos
 *    que a ficha não traz.
 *  - Se não existe: cria linha nova ao final.
 *  - Nome da escola é normalizado contra a aba Escolas; se não houver
 *    correspondência segura, grava o texto da ficha (para não perder
 *    o dado) e sinaliza no retorno para conferência humana.
 *
 * Retorna { linha, criado, escolaVinculada, avisos: [] }
 */
function sindAss_gravarDaFicha_(ficha) {
  // travarSisgep_ e não LockService direto: quem chama isto é
  // aprovarFichaSindicalizacao (Sindicalizacaoadmin.gs:160), que JÁ está
  // segurando a trava. Com LockService direto, esta linha esperava 30s por
  // uma trava que só quem chamou podia soltar, estourava, e o trabalhador
  // aprovado nunca chegava à aba Associados. Ver TravaSisgep.gs.
  var trava = travarSisgep_(30000);
  try {
    var aba = sindAss_aba_();
    var mapa = sindAss_mapaCabecalho_(aba);
    var idx = function (nome) {
      var i = mapa[String(nome).toUpperCase()];
      return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
    };

    var avisos = [];
    var cpfDigitos = sindAss_digitos_(ficha.CPF);
    if (cpfDigitos.length !== 11) {
      throw new Error('CPF inválido na ficha ' + ficha.ID_FICHA + '.');
    }

    // Escola: normaliza contra o cadastro para preservar o vínculo.
    var escolaCanonica = sindAss_normalizarNomeEscola_(ficha.ESCOLA);
    var escolaVinculada = !!escolaCanonica;
    if (!escolaVinculada) {
      escolaCanonica = String(ficha.ESCOLA || '').trim();
      avisos.push('A escola "' + escolaCanonica + '" não tem correspondência ' +
        'exata na aba Escolas. O nome foi gravado como veio na ficha — ' +
        'confira o vínculo manualmente.');
    }

    // Localiza o associado pelo CPF (lê apenas a coluna do CPF: rápido
    // mesmo com milhares de linhas).
    var ultima = aba.getLastRow();
    var linhaAlvo = 0;
    if (ultima >= 2) {
      var colCpf = idx('CPF');
      var cpfs = aba.getRange(2, colCpf, ultima - 1, 1).getValues();
      for (var i = 0; i < cpfs.length; i++) {
        if (sindAss_digitos_(cpfs[i][0]) === cpfDigitos) {
          linhaAlvo = i + 2;
          break;
        }
      }
    }

    var criado = false;
    if (!linhaAlvo) {
      linhaAlvo = Math.max(ultima + 1, 2);
      criado = true;
    }

    // Monta apenas os campos que a ficha realmente fornece.
    var valores = [
      ['Nome fantasia', escolaCanonica],
      ['Nome', String(ficha.NOME_COMPLETO || '').trim()],
      ['CPF', sindAss_fmtCPF_(cpfDigitos)],
      ['Filiado', 'S'],
      ['Logradouro', sindAss_montarLogradouro_(ficha)],
      ['Número', String(ficha.NUMERO || '').trim()],
      ['Bairro', String(ficha.BAIRRO || '').trim()],
      ['Cidade', String(ficha.CIDADE || '').trim()],
      ['CEP', sindAss_fmtCEP_(ficha.CEP_RESIDENCIAL)],
      ['Celular', sindAss_fmtTelefone_(ficha.CELULAR)],
      ['E-mail', String(ficha.EMAIL || '').trim().toLowerCase()],
      ['ULTIMA_ATUALIZACAO', new Date()],
      ['MATRICULA', String(ficha.MATRICULA || '')],
      ['DATA_FILIACAO', new Date()],
      ['ID_FICHA', String(ficha.ID_FICHA || '')]
    ];

    // Telefone secundário: só grava se a ficha trouxer e não sobrescreve
    // um valor já existente com vazio.
    var tel2 = sindAss_fmtTelefone_(ficha.TELEFONE_1 || ficha.TELEFONE_2);
    if (tel2) valores.push(['CELULAR2', tel2]);

    valores.forEach(function (par) {
      var valor = par[1];
      // Em atualização, campo vazio não apaga o que já existe.
      if (!criado && (valor === '' || valor === null || valor === undefined)) {
        return;
      }
      aba.getRange(linhaAlvo, idx(par[0])).setValue(valor);
    });

    return {
      linha: linhaAlvo,
      criado: criado,
      escolaVinculada: escolaVinculada,
      escola: escolaCanonica,
      avisos: avisos
    };
  } finally {
    trava.liberar();
  }
}

/**
 * Monta o logradouro no padrão da base (tipo + nome da via), já que a
 * aba Associados tem um único campo "Logradouro".
 */
function sindAss_montarLogradouro_(ficha) {
  var endereco = String(ficha.ENDERECO || '').trim();
  if (!endereco) return '';
  var tipo = String(ficha.TIPO_LOGRADOURO || '').toUpperCase();
  var prefixo = tipo === 'AVENIDA' ? 'AVENIDA' :
                (tipo === 'PRACA' ? 'PRAÇA' : 'RUA');
  // Evita duplicar quando o próprio endereço já começa com o tipo.
  var e = endereco.toUpperCase();
  if (e.indexOf('RUA ') === 0 || e.indexOf('AV') === 0 ||
      e.indexOf('AVENIDA ') === 0 || e.indexOf('PRAÇA ') === 0 ||
      e.indexOf('PRACA ') === 0 || e.indexOf('R. ') === 0) {
    return endereco;
  }
  return prefixo + ' ' + endereco;
}

/**
 * Marca o associado como NÃO filiado (Filiado = 'N') a partir do CPF.
 * Usado pela Desfiliação via IA (confirmarDesfiliacaoIA, em
 * IA_DocumentosSindicalizacao.gs) — só roda depois que o atendente já
 * confirmou os dados na revisão humana. NÃO apaga a linha nem outros
 * dados do associado, só atualiza o status de filiação e a data de
 * atualização — mesmo padrão de "não apagar o que a ficha não traz" de
 * sindAss_gravarDaFicha_.
 *
 * Retorna { encontrado, linha }
 */
// SEM trava de módulo, de propósito: quem chama isto é gerarOficioWeb
// (Oficios.gs:671), no fluxo do ofício de DESFILIAÇÃO. Exigir o módulo
// Sindicalização aqui quebraria a emissão de ofício para quem só tem
// Documentos — e a desfiliação é consequência do ofício, não uma
// operação avulsa no cadastro de associados. A sessão continua exigida.
function sindAss_desfiliar_(cpf, usuario, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  // travarSisgep_: gerarOficioWeb (Oficios.gs:683) chama isto no meio da
  // emissão do ofício de desfiliação, e aquele fluxo também trava.
  var trava = travarSisgep_(30000);
  try {
    var cpfDigitos = sindAss_digitos_(cpf);
    if (cpfDigitos.length !== 11) throw new Error('CPF inválido.');

    var aba = sindAss_aba_();
    var mapa = sindAss_mapaCabecalho_(aba);
    var idx = function (nome) {
      var i = mapa[String(nome).toUpperCase()];
      return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
    };

    var ultima = aba.getLastRow();
    if (ultima < 2) return { encontrado: false };

    var cpfs = aba.getRange(2, idx('CPF'), ultima - 1, 1).getValues();
    for (var i = 0; i < cpfs.length; i++) {
      if (sindAss_digitos_(cpfs[i][0]) === cpfDigitos) {
        var linha = i + 2;
        aba.getRange(linha, idx('Filiado')).setValue('N');
        aba.getRange(linha, idx('ULTIMA_ATUALIZACAO')).setValue(new Date());
        Logger.log('sindAss_desfiliar_: CPF ' + cpfDigitos + ' desfiliado por ' + (usuario || '—'));
        if (typeof cartAd_revogarPorDesfiliacao_ === 'function') {
          cartAd_revogarPorDesfiliacao_(cpfDigitos, usuario);
        }
        return { encontrado: true, linha: linha };
      }
    }
    return { encontrado: false };
  } finally {
    trava.liberar();
  }
}

/**
 * Preenche a coluna MATRICULA de todo associado que ainda não tem uma —
 * usando o MESMO contador sequencial (SIND_ADM_PROP_MATRICULA, definido
 * em Sindicalizacaoadmin.gs) que já é usado quando uma Ficha de
 * Sindicalização é aprovada. Por isso não há risco de colisão: as
 * matrículas geradas aqui continuam exatamente de onde o contador parou,
 * e qualquer aprovação de ficha feita DEPOIS continua a partir daqui.
 *
 * Só preenche células vazias — nunca sobrescreve uma matrícula já
 * existente (idempotente: rodar de novo não gera duplicata nem pula
 * ninguém que já ficou sem matrícula por engano).
 *
 * Não chama sindAdm_gerarMatricula_() em loop (uma chamada por associado,
 * ~8.000 vezes, cada uma lendo/gravando PropertiesService, estouraria o
 * tempo de execução) — lê o contador uma vez, soma em memória, grava uma
 * vez no fim.
 *
 * COMO RODAR: no editor do Apps Script, selecione esta função no menu
 * suspenso ao lado de "Executar" e rode manualmente. Confira o resultado
 * em "Execuções" (View → Execution log).
 */
function gerarMatriculasEmLote() {
  var trava = travarSisgep_(30000);
  try {
    var aba = sindAss_aba_();
    var mapa = sindAss_mapaCabecalho_(aba);
    var idx = function (nome) {
      var i = mapa[String(nome).toUpperCase()];
      return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
    };
    var colMatricula = idx('MATRICULA');

    var ultima = aba.getLastRow();
    if (ultima < 2) {
      var vazio = { totalAssociados: 0, matriculasGeradas: 0 };
      Logger.log(JSON.stringify(vazio));
      return vazio;
    }

    var range = aba.getRange(2, colMatricula, ultima - 1, 1);
    var valores = range.getValues();

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
    var proximo = parseInt(atual, 10);

    var geradas = 0;
    for (var i = 0; i < valores.length; i++) {
      var jaTem = String(valores[i][0] || '').trim();
      if (!jaTem) {
        proximo++;
        valores[i][0] = sindAdm_fmtMatricula_(proximo);
        geradas++;
      }
    }

    range.setValues(valores);
    props.setProperty(SIND_ADM_PROP_MATRICULA, String(proximo));

    var resultado = {
      totalAssociados: valores.length,
      matriculasGeradas: geradas,
      ultimaMatricula: sindAdm_fmtMatricula_(proximo)
    };
    Logger.log(JSON.stringify(resultado));
    return resultado;
  } finally {
    trava.liberar();
  }
}

/**
 * Consulta rápida: verifica se um CPF já consta como associado e qual a
 * situação. Útil na ficha (avisar quem já é filiado) e no painel.
 * Retorna { existe, filiado, nome, matricula, escola, linha }
 */
function consultarAssociadoPorCPF(cpf, tokenSessao) {
  exigirModulo_(tokenSessao, "sindicalizacao", false);
  var cpfDigitos = sindAss_digitos_(cpf);
  if (cpfDigitos.length !== 11) {
    return { existe: false, mensagem: 'CPF inválido.' };
  }
  var aba = sindAss_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return { existe: false };

  var mapa = sindAss_mapaCabecalho_(aba);
  var idx = function (nome) {
    var i = mapa[String(nome).toUpperCase()];
    return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
  };

  var cpfs = aba.getRange(2, idx('CPF'), ultima - 1, 1).getValues();
  for (var i = 0; i < cpfs.length; i++) {
    if (sindAss_digitos_(cpfs[i][0]) === cpfDigitos) {
      var linha = i + 2;
      var dados = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
      var v = function (nome) {
        var j = mapa[String(nome).toUpperCase()];
        if (j === undefined) j = SIND_ASS_COLUNAS.indexOf(nome);
        return dados[j] !== undefined ? dados[j] : '';
      };
      return {
        existe: true,
        linha: linha,
        nome: v('Nome'),
        filiado: String(v('Filiado')).trim().toUpperCase() === 'S',
        matricula: String(v('MATRICULA') || ''),
        escola: v('Nome fantasia')
      };
    }
  }
  return { existe: false };
}

/* ==========================================================================
 * DIAGNÓSTICO
 * ========================================================================== */

/**
 * Confere quantos associados têm nome de escola que NÃO bate com a aba
 * Escolas — indicador de saúde do vínculo escola↔associado, que sustenta
 * todos os relatórios de conversão por escola.
 * Somente leitura. Ver saída em Registro de execução.
 */
function diagnosticarVinculoEscolasAssociados() {
  var lista = listarEscolasParaFicha().escolas || [];
  var validos = {};
  lista.forEach(function (e) { validos[e.nome.toUpperCase()] = true; });

  var aba = sindAss_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return 'Aba Associados vazia.';

  var mapa = sindAss_mapaCabecalho_(aba);
  var colEscola = (mapa['NOME FANTASIA'] === undefined ? 0 : mapa['NOME FANTASIA']) + 1;
  var nomes = aba.getRange(2, colEscola, ultima - 1, 1).getValues();

  var semVinculo = {};
  var vazios = 0, ok = 0;
  nomes.forEach(function (l) {
    var n = String(l[0] || '').trim();
    if (!n) { vazios++; return; }
    if (validos[n.toUpperCase()]) { ok++; return; }
    semVinculo[n] = (semVinculo[n] || 0) + 1;
  });

  var chaves = Object.keys(semVinculo).sort(function (a, b) {
    return semVinculo[b] - semVinculo[a];
  });
  Logger.log('Escolas cadastradas: ' + lista.length);
  Logger.log('Associados com vínculo OK: ' + ok);
  Logger.log('Associados sem escola preenchida: ' + vazios);
  Logger.log('Nomes de escola SEM correspondência: ' + chaves.length);
  chaves.slice(0, 40).forEach(function (k) {
    Logger.log('   ' + semVinculo[k] + 'x  "' + k + '"');
  });
  if (chaves.length > 40) Logger.log('   ... e mais ' + (chaves.length - 40));
  return 'Ver Registro de execução.';
}

/* ==========================================================================
 * HELPERS
 * ========================================================================== */

function sindAss_planilha_() {
  return planilhaSisgep_();
}

function sindAss_aba_() {
  var aba = sindAss_planilha_().getSheetByName(SIND_ASS_ABA);
  if (!aba) throw new Error('Aba ' + SIND_ASS_ABA + ' não encontrada.');
  return aba;
}

function sindAss_abaEscolas_() {
  var aba = sindAss_planilha_().getSheetByName(SIND_ASS_ABA_ESCOLAS);
  if (!aba) throw new Error('Aba ' + SIND_ASS_ABA_ESCOLAS + ' não encontrada.');
  return aba;
}

/**
 * Mapa cabeçalho→índice (0-based), com chaves em maiúsculas.
 * Tolera acentuação e variações de caixa.
 */
function sindAss_mapaCabecalho_(aba) {
  var ultCol = aba.getLastColumn();
  if (ultCol < 1) return {};
  var cab = aba.getRange(1, 1, 1, ultCol).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) {
    var chave = String(nome).trim().toUpperCase();
    if (chave && mapa[chave] === undefined) mapa[chave] = i;
    // variante sem underscore, para tolerar "Nome fantasia" x "NOME_FANTASIA"
    var alt = chave.replace(/_/g, ' ');
    if (alt && mapa[alt] === undefined) mapa[alt] = i;
  });
  return mapa;
}

function sindAss_digitos_(v) {
  return String(v || '').replace(/\D/g, '');
}

function sindAss_fmtCPF_(cpf) {
  cpf = sindAss_digitos_(cpf);
  if (cpf.length !== 11) return cpf;
  return cpf.substring(0, 3) + '.' + cpf.substring(3, 6) + '.' +
    cpf.substring(6, 9) + '-' + cpf.substring(9);
}

function sindAss_fmtCEP_(cep) {
  cep = sindAss_digitos_(cep);
  if (cep.length !== 8) return cep;
  return cep.substring(0, 5) + '-' + cep.substring(5);
}

function sindAss_fmtTelefone_(tel) {
  tel = sindAss_digitos_(tel);
  if (tel.length < 10) return '';
  return tel;
}
/**
 * Descobre qual coluna da aba Escolas corresponde ao vocabulário usado na
 * coluna "Nome fantasia" da aba Associados. Testa TODAS as colunas e
 * mede a cobertura de cada uma (quantos dos ~8.000 associados casam).
 * Somente leitura. Ver saída em Registro de execução.
 */
function descobrirColunaEscolaCorreta() {
  var abaE = sindAss_abaEscolas_();
  var ultE = abaE.getLastRow();
  var colsE = abaE.getLastColumn();
  var cabE = abaE.getRange(1, 1, 1, colsE).getValues()[0];
  var dadosE = abaE.getRange(2, 1, ultE - 1, colsE).getValues();

  var abaA = sindAss_aba_();
  var ultA = abaA.getLastRow();
  var mapaA = sindAss_mapaCabecalho_(abaA);
  var colA = (mapaA['NOME FANTASIA'] === undefined ? 0 : mapaA['NOME FANTASIA']) + 1;
  var nomesA = abaA.getRange(2, colA, ultA - 1, 1).getValues();

  // Contagem de cada nome de escola usado pelos associados
  var usoAssociados = {};
  var totalA = 0;
  nomesA.forEach(function (l) {
    var n = String(l[0] || '').trim().toUpperCase();
    if (!n) return;
    usoAssociados[n] = (usoAssociados[n] || 0) + 1;
    totalA++;
  });

  Logger.log('Associados com escola preenchida: ' + totalA);
  Logger.log('Nomes distintos usados pelos associados: ' +
    Object.keys(usoAssociados).length);
  Logger.log('--- COBERTURA POR COLUNA DA ABA ESCOLAS ---');

  var ranking = [];
  for (var c = 0; c < colsE; c++) {
    var valores = {};
    var preenchidos = 0;
    for (var i = 0; i < dadosE.length; i++) {
      var v = String(dadosE[i][c] || '').trim().toUpperCase();
      if (!v) continue;
      valores[v] = true;
      preenchidos++;
    }
    var cobertos = 0, nomesCobertos = 0;
    Object.keys(usoAssociados).forEach(function (n) {
      if (valores[n]) {
        cobertos += usoAssociados[n];
        nomesCobertos++;
      }
    });
    ranking.push({
      col: c + 1,
      nome: String(cabE[c] || '(sem cabeçalho)'),
      preenchidos: preenchidos,
      distintos: Object.keys(valores).length,
      cobertos: cobertos,
      pct: totalA ? Math.round(cobertos * 1000 / totalA) / 10 : 0,
      nomesCobertos: nomesCobertos
    });
  }

  ranking.sort(function (a, b) { return b.cobertos - a.cobertos; });
  ranking.slice(0, 10).forEach(function (r) {
    Logger.log('col ' + r.col + ' [' + r.nome + '] cobre ' + r.cobertos +
      ' associados (' + r.pct + '%) · ' + r.nomesCobertos +
      ' nomes distintos · ' + r.distintos + ' valores únicos na Escolas');
  });

  Logger.log('--- AMOSTRA DAS 3 PRIMEIRAS LINHAS DA ABA ESCOLAS ---');
  for (var s = 0; s < Math.min(3, dadosE.length); s++) {
    var partes = [];
    for (var k = 0; k < colsE; k++) {
      var val = String(dadosE[s][k] || '').trim();
      if (val) partes.push((k + 1) + '.' + cabE[k] + '="' + val.substring(0, 45) + '"');
    }
    Logger.log('linha ' + (s + 2) + ': ' + partes.join(' | '));
  }
  return 'Ver Registro de execução.';
}
/**
 * Confere a lista de estabelecimentos que vai alimentar o campo escola
 * da ficha. Somente leitura. Ver saída em Registro de execução.
 */
function conferirListaEscolasFicha() {
  limparCacheEscolasFicha();
  var r = listarEscolasParaFicha();
  Logger.log('Estabelecimentos distintos: ' + r.total);
  var soma = 0;
  r.escolas.forEach(function (e) { soma += e.associados; });
  Logger.log('Associados cobertos: ' + soma);
  Logger.log('--- TOP 20 ---');
  r.escolas.slice(0, 20).forEach(function (e, i) {
    Logger.log((i + 1) + '. ' + e.associados + 'x  ' + e.nome);
  });
  Logger.log('--- 10 COM MENOS ASSOCIADOS (possíveis erros de digitação) ---');
  r.escolas.slice(-10).forEach(function (e) {
    Logger.log(e.associados + 'x  ' + e.nome);
  });
  return 'Ver Registro de execução.';
}