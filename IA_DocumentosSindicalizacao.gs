// ============================================================================
// ARQUIVO: IA_DocumentosSindicalizacao.gs
// IA aplicada à leitura de documentos recebidos em papel/foto:
//  - Carta de desfiliação (manuscrita ou digitada, sem formulário fixo)
//  - Formulário de Sindicalização impresso e preenchido à mão (filiação)
//
// REGRA DE OURO: nada é gravado, aprovado ou enviado sem confirmação humana.
// As funções "analisar*" só LEEM o documento e SUGEREM dados — não gravam
// nada. As funções "confirmar*" só agem depois que um atendente revisou e
// confirmou os dados na tela de revisão.
//
// Depende de (mesmo projeto):
// - chamarIA_SISGEP(prompt)                   IA_SISGEP.gs
// - exigirSessaoDocumentos_(token, admin)      Sessao.gs
// - limparDigitos_, formatarCPF_,
//   validarCPFSindicalizacao_, buscarFichaAtivaPorCPF_,
//   novoRegistroVazio_, gerarIdFicha_, gravarRegistroSindicalizacao_,
//   notificarSecretariaNovaFicha_, calcularHashFicha_,
//   limparCacheListaSindicalizacao_               Sindicalizacao.gs
// - consultarAssociadoPorCPF, listarEscolasParaFicha,
//   sindAss_normalizarNomeEscola_, sindAss_desfiliar_  SindicalizacaoAssociados.gs
// - buscarEscolasParaOficio, sindOf_registrarDePara_   SindicalizacaoOficio.gs
// - gerarOficioWeb                                     Oficios.gs
// - listarMensalidadeStatus                            MensalidadeCore.gs
// - sindAdm_pastaPDF_                                  Sindicalizacaoadmin.gs
// ============================================================================

/* ============================================================
 * OCR — COMPARTILHADO PELOS DOIS FLUXOS
 * ============================================================ */

/**
 * Extrai o texto de um documento escaneado (PDF ou foto) usando o OCR do
 * Drive — mesmo padrão já usado em Recibo.gs (importação de alvará) e
 * ChatIACore.gs (anexos da Sofia). Cria um Google Doc temporário e sempre
 * apaga (joga na lixeira) em seguida, mesmo se a leitura falhar.
 *
 * @param {string} base64      Conteúdo do arquivo em base64
 * @param {string} nomeArquivo Nome original (só para referência no título temporário)
 * @param {string} mimeType    Mime type real do arquivo (application/pdf, image/jpeg, image/png)
 * @return {string} texto reconhecido (pode vir vazio se o OCR não conseguir ler nada)
 */
function docIA_ocrParaTexto_(base64, nomeArquivo, mimeType) {
  if (!base64) throw new Error('Nenhum arquivo recebido.');
  var tipo = String(mimeType || 'application/pdf').trim();
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, tipo, nomeArquivo || 'documento');

  var arq = Drive.Files.insert(
    { title: 'TMP_OCR_SINDICALIZACAO_' + new Date().getTime() },
    blob,
    { ocr: true, ocrLanguage: 'pt', convert: true }
  );

  try {
    if (!arq.id) throw new Error('O Drive não conseguiu processar o documento.');
    return DocumentApp.openById(arq.id).getBody().getText() || '';
  } finally {
    try { DriveApp.getFileById(arq.id).setTrashed(true); } catch (eTrash) { /* silencioso */ }
  }
}

/**
 * Chama a IA pedindo um JSON estruturado e faz o parse com segurança,
 * tolerando blocos ```json que o modelo às vezes devolve mesmo quando
 * instruído a não fazer isso.
 */
function docIA_extrairJSON_(prompt) {
  var resposta = chamarIA_SISGEP(prompt);
  var limpo = String(resposta || '').trim()
    .replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(limpo);
  } catch (e) {
    throw new Error('A IA não retornou um JSON válido. Resposta recebida: ' + limpo.substring(0, 300));
  }
}

/* ============================================================
 * DESFILIAÇÃO — ANÁLISE (só leitura; nada é gravado aqui)
 * ============================================================ */

/**
 * Lê uma carta de desfiliação (foto ou PDF escaneado, manuscrita ou não),
 * extrai os dados com IA e devolve tudo pronto para revisão humana — CPF,
 * associado e escola já conferidos contra o cadastro. NENHUM dado é
 * gravado e NENHUM ofício é gerado aqui — isso só acontece em
 * confirmarDesfiliacaoIA, depois que o atendente revisar/corrigir os
 * campos na tela.
 *
 * @return {Object} { sucesso, dados, associado, pendencia, sugestaoEscolas, alertas, textoOcr }
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function analisarCartaDesfiliacaoIA(base64, nomeArquivo, mimeType, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var texto = docIA_ocrParaTexto_(base64, nomeArquivo, mimeType);
    if (!texto.trim()) {
      return { sucesso: false, mensagem: 'Não foi possível ler nenhum texto no documento. Tente uma foto mais nítida ou um PDF de melhor qualidade.' };
    }

    var prompt = [
      'Você está lendo o texto (extraído por OCR, pode ter erros de leitura) de uma carta de',
      'desfiliação sindical. A carta pode ser manuscrita e informal, sem campos fixos — às',
      'vezes é só um parágrafo corrido pedindo o cancelamento do desconto sindical.',
      '',
      'TEXTO EXTRAÍDO:',
      '"""',
      texto,
      '"""',
      '',
      'Extraia os dados em um JSON com exatamente estas chaves (use "" quando não encontrar,',
      'NUNCA invente um valor que não está no texto):',
      '{',
      '  "nome": "",',
      '  "cpf": "",',
      '  "escola": "",',
      '  "motivo": "",',
      '  "dataCarta": "",',
      '  "telefone": "",',
      '  "email": "",',
      '  "temAssinatura": true,',
      '  "observacoesLeitura": ""',
      '}',
      '',
      'Regras:',
      '- "cpf": só dígitos, sem pontuação.',
      '- "dataCarta": formato dd/mm/aaaa se identificar.',
      '- "escola": o nome do estabelecimento como está escrito no documento, sem tentar',
      '  corrigir ou formalizar — a correspondência com o cadastro é feita depois.',
      '- "temAssinatura": true se parecer haver uma assinatura manuscrita no documento.',
      '- "observacoesLeitura": qualquer trecho que ficou ilegível ou ambíguo no OCR — isso é',
      '  importante para o atendente saber o que conferir com atenção.',
      '- Responda APENAS com o JSON, sem texto antes ou depois, sem markdown.'
    ].join('\n');

    var extraido = docIA_extrairJSON_(prompt);

    var alertas = [];
    var cpfDigitos = limparDigitos_(extraido.cpf || '');
    if (!cpfDigitos) {
      alertas.push('CPF não identificado na carta — preencha manualmente.');
    } else if (!validarCPFSindicalizacao_(cpfDigitos)) {
      alertas.push('CPF identificado (' + extraido.cpf + ') não é válido — confira os dígitos.');
    }

    var associado = null;
    if (cpfDigitos.length === 11) {
      associado = consultarAssociadoPorCPF(cpfDigitos, tokenSessao);
      if (!associado || !associado.existe) {
        alertas.push('Não foi encontrado nenhum associado com este CPF — confirme antes de prosseguir.');
      } else if (!associado.filiado) {
        alertas.push('Este CPF já consta como NÃO filiado na base — pode já ter sido desfiliado antes.');
      }
    }

    var pendencia = null;
    if (cpfDigitos.length === 11) {
      try {
        var statusMensalidade = listarMensalidadeStatus({});
        var itemPendente = (statusMensalidade.itens || []).filter(function (i) {
          return limparDigitos_(i.cpf) === cpfDigitos &&
            (i.status === 'PENDENTE_30D' || i.status === 'COBRANCA_ENVIADA');
        })[0];
        if (itemPendente) {
          pendencia = itemPendente;
          alertas.push('Há pendência financeira em aberto para este associado (status: ' +
            itemPendente.status + ') — avalie antes de desfiliar.');
        }
      } catch (ePend) {
        Logger.log('analisarCartaDesfiliacaoIA — checagem de pendência falhou: ' + ePend.message);
      }
    }

    if (!extraido.temAssinatura) {
      alertas.push('Não identifiquei assinatura no documento — confirme visualmente antes de prosseguir.');
    }

    var sugestaoEscolas = [];
    try {
      var resultadoEscolas = buscarEscolasParaOficio('', extraido.escola || '');
      sugestaoEscolas = resultadoEscolas.escolas || [];
      if (resultadoEscolas.sugerida) {
        sugestaoEscolas = [resultadoEscolas.sugerida].concat(
          sugestaoEscolas.filter(function (e) { return e.cnpj !== resultadoEscolas.sugerida.cnpj; })
        );
      }
    } catch (eEsc) {
      Logger.log('analisarCartaDesfiliacaoIA — busca de escola falhou: ' + eEsc.message);
    }
    if (!sugestaoEscolas.length) {
      alertas.push('Nenhuma escola sugerida automaticamente — busque manualmente pelo nome.');
    }

    return {
      sucesso: true,
      dados: {
        nome: extraido.nome || (associado ? associado.nome : ''),
        cpf: cpfDigitos,
        cpfFormatado: formatarCPF_(cpfDigitos),
        escolaTexto: extraido.escola || '',
        motivo: extraido.motivo || '',
        dataCarta: extraido.dataCarta || '',
        telefone: extraido.telefone || '',
        email: extraido.email || '',
        observacoesLeitura: extraido.observacoesLeitura || ''
      },
      associado: associado,
      pendencia: pendencia,
      sugestaoEscolas: sugestaoEscolas,
      alertas: alertas,
      textoOcr: texto
    };

  } catch (e) {
    Logger.log('analisarCartaDesfiliacaoIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro ao analisar a carta: ' + e.message };
  }
}

/* ============================================================
 * DESFILIAÇÃO — CONFIRMAÇÃO (só executa após revisão humana)
 * ============================================================ */

/**
 * Executa a desfiliação DEPOIS que o atendente revisou/corrigiu os dados
 * extraídos pela IA e escolheu a escola certa na busca. Faz exatamente o
 * que o atendente faria manualmente:
 *   1. gera o ofício de desfiliação pelo MESMO caminho de sempre
 *      (gerarOficioWeb — mesma numeração, mesmo template, mesma fila,
 *      mesmo aviso de duplicidade);
 *   2. marca o associado como não-filiado na base (sindAss_desfiliar_);
 *   3. registra o vínculo escola↔CNPJ no De-Para, se ainda não existir.
 *
 * @param {Object} dados { nome, cpf, escolaTexto, escolaNome, escolaCnpj,
 *   escolaEmail, escolaUnidade, motivo, cartaBase64, cartaTipo,
 *   confirmarDuplicata }
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function confirmarDesfiliacaoIA(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  dados = dados || {};
  try {
    var nome = String(dados.nome || '').trim();
    var cpfDigitos = limparDigitos_(dados.cpf || '');
    var cnpj = limparDigitos_(dados.escolaCnpj || '');

    if (!nome) return { sucesso: false, mensagem: 'Nome é obrigatório.' };
    if (!validarCPFSindicalizacao_(cpfDigitos)) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (cnpj.length !== 14) return { sucesso: false, mensagem: 'Selecione uma escola válida (com CNPJ) antes de confirmar.' };
    if (!dados.escolaEmail) return { sucesso: false, mensagem: 'A escola selecionada não tem e-mail cadastrado.' };

    var anexoCarta = null;
    if (dados.cartaBase64) {
      anexoCarta = {
        nome: 'Carta_Desfiliacao_' + nome.replace(/[^A-Za-z0-9]+/g, '_') + '.pdf',
        tipo: dados.cartaTipo || 'application/pdf',
        base64: dados.cartaBase64
      };
    }

    var retorno = gerarOficioWeb({
      tipo: 'DESFILIACAO',
      escola: dados.escolaNome || '',
      cnpj: cnpj,
      email: dados.escolaEmail,
      unidade: dados.escolaUnidade || '',
      colaboradores: [nome],
      cpfs: [cpfDigitos],
      fichas: anexoCarta ? [anexoCarta] : [],
      observacoes: 'Desfiliação processada com apoio de IA (leitura de carta) · ' + (dados.motivo || ''),
      confirmarDuplicata: !!dados.confirmarDuplicata
    });

    if (retorno && retorno.duplicataDetectada) {
      return retorno; // devolve pro cliente perguntar/confirmar, igual ao fluxo manual
    }
    if (!retorno || retorno.erro) {
      return { sucesso: false, mensagem: (retorno && retorno.mensagem) || 'Falha ao gerar o ofício de desfiliação.' };
    }

    // gerarOficioWeb já atualiza o cadastro do associado (Filiado=N) quando
    // recebe cpfs — não repete a chamada aqui, só herda os avisos dela.
    var avisos = (retorno.dados && retorno.dados.avisosDesfiliacao) || [];

    try {
      if (dados.escolaNome && cnpj) {
        sindOf_registrarDePara_(dados.escolaTexto || dados.escolaNome, {
          nome: dados.escolaNome, cnpj: cnpj, emailPrincipal: dados.escolaEmail
        }, sessao.email || sessao.usuario || 'SISGEP');
      }
    } catch (eDepara) {
      Logger.log('confirmarDesfiliacaoIA — De-Para não registrado: ' + eDepara.message);
    }

    return {
      sucesso: true,
      numeroOficio: retorno.dados.numero,
      urlOficio: retorno.dados.url,
      avisos: avisos,
      mensagem: 'Ofício de desfiliação ' + retorno.dados.numero + ' gerado e associado atualizado.'
    };

  } catch (e) {
    Logger.log('confirmarDesfiliacaoIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro: ' + e.message };
  }
}

/* ============================================================
 * FILIAÇÃO EM PAPEL — ANÁLISE (só leitura; nada é gravado aqui)
 * ============================================================ */

/**
 * Lê um Formulário de Sindicalização impresso e preenchido à mão (a versão
 * em papel da mesma ficha que o Portal do Associado recebe digitalmente),
 * extrai os dados com IA e devolve tudo pronto para revisão humana.
 * NENHUM dado é gravado aqui — só em confirmarFiliacaoPapelIA, depois que
 * o atendente revisar/corrigir os campos na tela.
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function analisarFormularioFiliacaoIA(base64, nomeArquivo, mimeType, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var texto = docIA_ocrParaTexto_(base64, nomeArquivo, mimeType);
    if (!texto.trim()) {
      return { sucesso: false, mensagem: 'Não foi possível ler nenhum texto no documento. Tente uma foto mais nítida ou um PDF de melhor qualidade.' };
    }

    var prompt = [
      'Você está lendo o texto (extraído por OCR, pode ter erros) do "Formulário de',
      'Sindicalização" oficial do SindEducação-ES, impresso e preenchido à mão. O formulário',
      'tem campos fixos: Trabalhador(a), Identificação, Endereço Residencial, Contatos,',
      'Escolaridade, Empresa onde trabalha, e uma autorização de desconto assinada no rodapé.',
      '',
      'TEXTO EXTRAÍDO:',
      '"""',
      texto,
      '"""',
      '',
      'Extraia os dados em um JSON com exatamente estas chaves (use "" quando não encontrar,',
      'NUNCA invente um valor que não está no texto):',
      '{',
      '  "tipo": "CADASTRAMENTO ou RECADASTRAMENTO",',
      '  "nome": "",',
      '  "sexo": "M ou F ou vazio",',
      '  "cpf": "",',
      '  "rg": "",',
      '  "orgaoExpedidor": "",',
      '  "ufRg": "",',
      '  "dataNascimento": "",',
      '  "cepResidencial": "",',
      '  "tipoLogradouro": "RUA, AVENIDA ou PRACA",',
      '  "endereco": "",',
      '  "numero": "",',
      '  "complemento": "",',
      '  "bairro": "",',
      '  "uf": "",',
      '  "cidade": "",',
      '  "celular": "",',
      '  "telefone1": "",',
      '  "email": "",',
      '  "escolaridade": "",',
      '  "escola": "",',
      '  "dataAdmissao": "",',
      '  "cargo": "",',
      '  "cidadeEscola": "",',
      '  "cepEscola": "",',
      '  "dataAssinatura": "",',
      '  "temAssinatura": true,',
      '  "observacoesLeitura": ""',
      '}',
      '',
      'Regras:',
      '- CPF, RG, CEP, telefones: só dígitos, sem pontuação.',
      '- Datas no formato dd/mm/aaaa.',
      '- "escola": o nome como está escrito no formulário, sem tentar corrigir — a',
      '  correspondência com o cadastro é feita depois.',
      '- "observacoesLeitura": qualquer trecho ilegível ou ambíguo — importante para o',
      '  atendente conferir com atenção antes de aprovar.',
      '- Responda APENAS com o JSON, sem texto antes ou depois, sem markdown.'
    ].join('\n');

    var extraido = docIA_extrairJSON_(prompt);

    var alertas = [];
    var cpfDigitos = limparDigitos_(extraido.cpf || '');
    if (!cpfDigitos) {
      alertas.push('CPF não identificado no formulário — preencha manualmente.');
    } else if (!validarCPFSindicalizacao_(cpfDigitos)) {
      alertas.push('CPF identificado (' + extraido.cpf + ') não é válido — confira os dígitos.');
    } else {
      var fichaExistente = buscarFichaAtivaPorCPF_(cpfDigitos);
      if (fichaExistente) {
        alertas.push('Já existe uma ficha ativa para este CPF (status: ' + fichaExistente.STATUS +
          ', ID ' + fichaExistente.ID_FICHA + ') — confira antes de criar outra.');
      }
      var jaAssociado = consultarAssociadoPorCPF(cpfDigitos, tokenSessao);
      if (jaAssociado && jaAssociado.existe && jaAssociado.filiado) {
        alertas.push('Este CPF já consta como filiado na base (matrícula ' + jaAssociado.matricula +
          ') — confirme se não é recadastramento.');
      }
    }

    if (!extraido.temAssinatura) {
      alertas.push('Não identifiquei assinatura no documento — confirme visualmente antes de prosseguir.');
    }

    var escolaSugerida = '';
    try {
      escolaSugerida = sindAss_normalizarNomeEscola_(extraido.escola || '');
    } catch (eEsc) {
      Logger.log('analisarFormularioFiliacaoIA — busca de escola falhou: ' + eEsc.message);
    }
    if (!escolaSugerida) {
      alertas.push('Não encontrei correspondência exata para a escola "' + (extraido.escola || '') +
        '" na base — selecione manualmente na lista.');
    }

    return {
      sucesso: true,
      dados: extraido,
      cpfDigitos: cpfDigitos,
      escolaSugerida: escolaSugerida,
      listaEscolas: (listarEscolasParaFicha().escolas || []),
      alertas: alertas,
      textoOcr: texto
    };

  } catch (e) {
    Logger.log('analisarFormularioFiliacaoIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro ao analisar o formulário: ' + e.message };
  }
}

/* ============================================================
 * FILIAÇÃO EM PAPEL — CONFIRMAÇÃO (só executa após revisão humana)
 * ============================================================ */

/**
 * Cria a ficha de sindicalização a partir de um formulário em papel já
 * revisado/corrigido pelo atendente. Diferente do fluxo digital, aqui a
 * assinatura já existe fisicamente no papel — por isso a ficha entra
 * direto como ASSINADA, sem OTP (que é só para assinatura remota). O
 * PDF/foto ORIGINAL do formulário escaneado é salvo como LINK_PDF — não
 * usamos o gerador de PDF eletrônico (gerarPDFFichaSindicalizacao), porque
 * ele descreve a ficha como "assinada eletronicamente", o que seria
 * incorreto aqui; a prova real é o documento físico digitalizado.
 *
 * A ficha AINDA precisa passar por aprovarFichaSindicalizacao (o mesmo
 * botão de sempre, no painel de Fichas Sindicais) antes de virar
 * matrícula — esta função não aprova nada, só registra a ficha.
 *
 * @param {Object} dados Mesmos campos de SINDICALIZACAO_COLUNAS já revisados
 *   pelo atendente, + arquivoBase64/arquivoTipo/arquivoExtensao (o
 *   documento original) + confirmadoPeloAtendente (obrigatório, true).
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function confirmarFiliacaoPapelIA(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  dados = dados || {};
  try {
    if (!dados.confirmadoPeloAtendente) {
      return { sucesso: false, mensagem: 'Confirme que revisou os dados contra o documento original antes de prosseguir.' };
    }

    var cpf = limparDigitos_(dados.cpf || '');
    if (!dados.nome || !String(dados.nome).trim()) return { sucesso: false, mensagem: 'Nome é obrigatório.' };
    if (!validarCPFSindicalizacao_(cpf)) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (!dados.escola || !String(dados.escola).trim()) return { sucesso: false, mensagem: 'Escola é obrigatória.' };

    var existente = buscarFichaAtivaPorCPF_(cpf);
    var registro = existente || novoRegistroVazio_();
    if (!existente) {
      registro.ID_FICHA = gerarIdFicha_();
      registro.DATA_CRIACAO = new Date();
      registro.ORIGEM = 'PAPEL_IA';
    }

    registro.TIPO = dados.tipo === 'RECADASTRAMENTO' ? 'RECADASTRAMENTO' : 'CADASTRAMENTO';
    registro.NOME_COMPLETO = String(dados.nome).trim().toUpperCase();
    registro.SEXO = dados.sexo === 'M' ? 'M' : (dados.sexo === 'F' ? 'F' : '');
    registro.CPF = cpf;
    registro.RG = limparDigitos_(dados.rg || '');
    registro.ORGAO_EXPEDIDOR = String(dados.orgaoExpedidor || '').trim().toUpperCase();
    registro.UF_RG = String(dados.ufRg || '').trim().toUpperCase();
    registro.TELEFONE_1 = limparDigitos_(dados.telefone1 || '');
    registro.CELULAR = limparDigitos_(dados.celular || dados.telefone1 || '');
    registro.EMAIL = String(dados.email || '').trim().toLowerCase();
    registro.TIPO_EMAIL = 'PESSOAL';
    registro.CEP_RESIDENCIAL = limparDigitos_(dados.cepResidencial || '');
    registro.TIPO_LOGRADOURO = ['AVENIDA', 'PRACA', 'RUA']
      .indexOf(String(dados.tipoLogradouro || '').toUpperCase()) >= 0 ?
      String(dados.tipoLogradouro).toUpperCase() : 'RUA';
    registro.ENDERECO = String(dados.endereco || '').trim();
    registro.NUMERO = String(dados.numero || '').trim();
    registro.COMPLEMENTO = String(dados.complemento || '').trim();
    registro.BAIRRO = String(dados.bairro || '').trim();
    registro.UF = String(dados.uf || '').trim().toUpperCase();
    registro.CIDADE = String(dados.cidade || '').trim();
    registro.DATA_NASCIMENTO = String(dados.dataNascimento || '').trim();
    registro.ESCOLARIDADE = String(dados.escolaridade || '').trim();
    registro.ESCOLA = String(dados.escola).trim();
    registro.DATA_ADMISSAO = String(dados.dataAdmissao || '').trim();
    registro.CARGO = String(dados.cargo || '').trim();
    registro.CIDADE_ESCOLA = String(dados.cidadeEscola || '').trim();
    registro.CEP_ESCOLA = limparDigitos_(dados.cepEscola || '');

    // Assinatura física — não passa por OTP. OTP_VALIDADO = 'PAPEL' (não
    // 'SIM') marca claramente a origem para quem for auditar depois.
    registro.STATUS = SINDICALIZACAO_STATUS.ASSINADA;
    registro.DATA_HORA_ASSINATURA = new Date();
    registro.IP_ASSINATURA = 'PAPEL — digitalizado por ' + (sessao.email || sessao.usuario || 'SISGEP');
    registro.OTP_VALIDADO = 'PAPEL';
    registro.HASH_FICHA = calcularHashFicha_(registro);

    gravarRegistroSindicalizacao_(registro);

    var linkOriginal = '';
    try {
      if (dados.arquivoBase64) {
        var bytesOriginal = Utilities.base64Decode(dados.arquivoBase64);
        var nomeOriginal = 'Formulario_Papel_' +
          registro.NOME_COMPLETO.replace(/[^A-Za-z0-9]+/g, '_') + '_' + registro.ID_FICHA +
          (dados.arquivoExtensao || '.pdf');
        var blobOriginal = Utilities.newBlob(bytesOriginal, dados.arquivoTipo || 'application/pdf', nomeOriginal);
        var pasta = sindAdm_pastaPDF_();
        var arquivoOriginal = pasta.createFile(blobOriginal);
        arquivoOriginal.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        linkOriginal = arquivoOriginal.getUrl();
      }
    } catch (eUpload) {
      Logger.log('confirmarFiliacaoPapelIA — upload do original falhou: ' + eUpload.message);
    }

    if (linkOriginal) {
      registro.LINK_PDF = linkOriginal;
      gravarRegistroSindicalizacao_(registro);
    }

    limparCacheListaSindicalizacao_();
    notificarSecretariaNovaFicha_(registro);

    return {
      sucesso: true,
      idFicha: registro.ID_FICHA,
      linkDocumentoOriginal: linkOriginal,
      mensagem: 'Ficha registrada como ASSINADA (documento físico) e pronta para aprovação — ' +
        'nada foi matriculado ainda. Use o painel de Fichas Sindicais para aprovar.'
    };

  } catch (e) {
    Logger.log('confirmarFiliacaoPapelIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro: ' + e.message };
  }
}

/* ============================================================
 * OPOSIÇÃO À TAXA NEGOCIAL — ANÁLISE (só leitura; nada é gravado aqui)
 * ============================================================ */

/**
 * Lê uma carta de oposição à Taxa Negocial (foto ou PDF escaneado, o
 * trabalhador exercendo seu direito de não ter a Taxa Negocial descontada),
 * extrai os dados com IA e devolve tudo pronto para revisão humana. NENHUM
 * dado é gravado e NENHUM ofício é gerado aqui — isso só acontece em
 * confirmarOposicaoTaxaNegocialIA, depois que o atendente revisar/corrigir
 * os campos na tela.
 *
 * @return {Object} { sucesso, dados, associado, sugestaoEscolas, alertas, textoOcr }
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function analisarCartaOposicaoTaxaNegocialIA(base64, nomeArquivo, mimeType, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var texto = docIA_ocrParaTexto_(base64, nomeArquivo, mimeType);
    if (!texto.trim()) {
      return { sucesso: false, mensagem: 'Não foi possível ler nenhum texto no documento. Tente uma foto mais nítida ou um PDF de melhor qualidade.' };
    }

    var prompt = [
      'Você está lendo o texto (extraído por OCR, pode ter erros de leitura) de uma carta de',
      'oposição à Taxa Negocial. É o trabalhador exercendo o direito de não ter a Taxa Negocial',
      '(desconto sindical previsto em Convenção Coletiva) descontada do seu salário. A carta pode',
      'ser manuscrita e informal, sem campos fixos.',
      '',
      'TEXTO EXTRAÍDO:',
      '"""',
      texto,
      '"""',
      '',
      'Extraia os dados em um JSON com exatamente estas chaves (use "" quando não encontrar,',
      'NUNCA invente um valor que não está no texto):',
      '{',
      '  "nome": "",',
      '  "cpf": "",',
      '  "escola": "",',
      '  "motivo": "",',
      '  "dataCarta": "",',
      '  "telefone": "",',
      '  "email": "",',
      '  "temAssinatura": true,',
      '  "observacoesLeitura": ""',
      '}',
      '',
      'Regras:',
      '- "cpf": só dígitos, sem pontuação.',
      '- "dataCarta": formato dd/mm/aaaa se identificar.',
      '- "escola": o nome do estabelecimento como está escrito no documento, sem tentar',
      '  corrigir ou formalizar — a correspondência com o cadastro é feita depois.',
      '- "temAssinatura": true se parecer haver uma assinatura manuscrita no documento.',
      '- "observacoesLeitura": qualquer trecho que ficou ilegível ou ambíguo no OCR — isso é',
      '  importante para o atendente saber o que conferir com atenção.',
      '- Responda APENAS com o JSON, sem texto antes ou depois, sem markdown.'
    ].join('\n');

    var extraido = docIA_extrairJSON_(prompt);

    var alertas = [];
    var cpfDigitos = limparDigitos_(extraido.cpf || '');
    if (!cpfDigitos) {
      alertas.push('CPF não identificado na carta — preencha manualmente.');
    } else if (!validarCPFSindicalizacao_(cpfDigitos)) {
      alertas.push('CPF identificado (' + extraido.cpf + ') não é válido — confira os dígitos.');
    }

    var associado = null;
    if (cpfDigitos.length === 11) {
      associado = consultarAssociadoPorCPF(cpfDigitos, tokenSessao);
      if (associado && associado.existe && associado.filiado) {
        alertas.push('Este CPF já consta como ASSOCIADO FILIADO na base — confirme se a oposição à Taxa Negocial se aplica mesmo assim antes de prosseguir.');
      }
    }

    if (!extraido.temAssinatura) {
      alertas.push('Não identifiquei assinatura no documento — confirme visualmente antes de prosseguir.');
    }

    var sugestaoEscolas = [];
    try {
      var resultadoEscolas = buscarEscolasParaOficio('', extraido.escola || '');
      sugestaoEscolas = resultadoEscolas.escolas || [];
      if (resultadoEscolas.sugerida) {
        sugestaoEscolas = [resultadoEscolas.sugerida].concat(
          sugestaoEscolas.filter(function (e) { return e.cnpj !== resultadoEscolas.sugerida.cnpj; })
        );
      }
    } catch (eEsc) {
      Logger.log('analisarCartaOposicaoTaxaNegocialIA — busca de escola falhou: ' + eEsc.message);
    }
    if (!sugestaoEscolas.length) {
      alertas.push('Nenhuma escola sugerida automaticamente — busque manualmente pelo nome.');
    }

    return {
      sucesso: true,
      dados: {
        nome: extraido.nome || (associado ? associado.nome : ''),
        cpf: cpfDigitos,
        cpfFormatado: formatarCPF_(cpfDigitos),
        escolaTexto: extraido.escola || '',
        motivo: extraido.motivo || '',
        dataCarta: extraido.dataCarta || '',
        telefone: extraido.telefone || '',
        email: extraido.email || '',
        observacoesLeitura: extraido.observacoesLeitura || ''
      },
      associado: associado,
      sugestaoEscolas: sugestaoEscolas,
      alertas: alertas,
      textoOcr: texto
    };

  } catch (e) {
    Logger.log('analisarCartaOposicaoTaxaNegocialIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro ao analisar a carta: ' + e.message };
  }
}

/* ============================================================
 * OPOSIÇÃO À TAXA NEGOCIAL — CONFIRMAÇÃO (só executa após revisão humana)
 * ============================================================ */

/**
 * Gera o ofício de oposição à Taxa Negocial DEPOIS que o atendente
 * revisou/corrigiu os dados extraídos pela IA e escolheu a escola certa na
 * busca. Usa o MESMO caminho de sempre (gerarOficioWeb — mesma numeração,
 * mesma fila de envio, mesmo aviso de duplicidade) — só o texto do ofício é
 * diferente (pede que NÃO seja descontado, em vez de pedir o desconto).
 * Não altera nenhum cadastro — diferente da desfiliação, isso não tira o
 * trabalhador de nenhuma base, só instrui a escola sobre este desconto
 * específico.
 *
 * @param {Object} dados { nome, cpf, escolaTexto, escolaNome, escolaCnpj,
 *   escolaEmail, escolaUnidade, motivo, cartaBase64, cartaTipo,
 *   confirmarDuplicata }
 */
// SEM trava de modulo: o botao que dispara esta funcao fica na tela de
// OFICIOS (Documentos), onde a pessoa trabalha, embora o registro gravado
// seja de Sindicalizacao. Exigir o modulo aqui deixaria um botao visivel
// que da erro ao clicar. Sessao continua exigida.
function confirmarOposicaoTaxaNegocialIA(dados, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  dados = dados || {};
  try {
    var nome = String(dados.nome || '').trim();
    var cpfDigitos = limparDigitos_(dados.cpf || '');
    var cnpj = limparDigitos_(dados.escolaCnpj || '');

    if (!nome) return { sucesso: false, mensagem: 'Nome é obrigatório.' };
    if (!validarCPFSindicalizacao_(cpfDigitos)) return { sucesso: false, mensagem: 'CPF inválido.' };
    if (cnpj.length !== 14) return { sucesso: false, mensagem: 'Selecione uma escola válida (com CNPJ) antes de confirmar.' };
    if (!dados.escolaEmail) return { sucesso: false, mensagem: 'A escola selecionada não tem e-mail cadastrado.' };

    var anexoCarta = null;
    if (dados.cartaBase64) {
      anexoCarta = {
        nome: 'Carta_Oposicao_TaxaNegocial_' + nome.replace(/[^A-Za-z0-9]+/g, '_') + '.pdf',
        tipo: dados.cartaTipo || 'application/pdf',
        base64: dados.cartaBase64
      };
    }

    var retorno = gerarOficioWeb({
      tipo: 'Oposição Taxa Negocial',
      escola: dados.escolaNome || '',
      cnpj: cnpj,
      email: dados.escolaEmail,
      unidade: dados.escolaUnidade || '',
      colaboradores: [nome],
      cpfs: [cpfDigitos],
      fichas: anexoCarta ? [anexoCarta] : [],
      observacoes: 'Oposição à Taxa Negocial processada com apoio de IA (leitura de carta) · ' + (dados.motivo || ''),
      confirmarDuplicata: !!dados.confirmarDuplicata
    });

    if (retorno && retorno.duplicataDetectada) {
      return retorno; // devolve pro cliente perguntar/confirmar, igual ao fluxo manual
    }
    if (!retorno || retorno.erro) {
      return { sucesso: false, mensagem: (retorno && retorno.mensagem) || 'Falha ao gerar o ofício de oposição à Taxa Negocial.' };
    }

    try {
      if (dados.escolaNome && cnpj) {
        sindOf_registrarDePara_(dados.escolaTexto || dados.escolaNome, {
          nome: dados.escolaNome, cnpj: cnpj, emailPrincipal: dados.escolaEmail
        }, 'SISGEP');
      }
    } catch (eDepara) {
      Logger.log('confirmarOposicaoTaxaNegocialIA — De-Para não registrado: ' + eDepara.message);
    }

    return {
      sucesso: true,
      numeroOficio: retorno.dados.numero,
      urlOficio: retorno.dados.url,
      mensagem: 'Ofício de oposição à Taxa Negocial ' + retorno.dados.numero + ' gerado com sucesso.'
    };

  } catch (e) {
    Logger.log('confirmarOposicaoTaxaNegocialIA erro: ' + e.message);
    return { sucesso: false, mensagem: 'Erro: ' + e.message };
  }
}
