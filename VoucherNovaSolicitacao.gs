// ============================================================================
// ARQUIVO: VoucherNovaSolicitacao.gs
// CRIAR SOLICITAÇÃO PELO ADMINISTRATIVO — hoje o único caminho que existe.
//
// COMO A SOLICITAÇÃO CHEGA HOJE, e é isto que desenha a tela
//
// O usuário descreveu assim, em 12/08/2026: "hoje o associado faz a
// solicitação por e-mail e nós que geramos o voucher", "a solicitação é
// feita pelo associado", "ele que solicita, raro a escola pedir".
//
// Ou seja: a SECRETARIA TRANSCREVE. O e-mail do associado é o documento de
// origem, os anexos dele são a comprovação, e quem digita já leu tudo antes
// de começar. Por isso `CANAL_ENTRADA` é EMAIL, e não PORTAL — o campo vinha
// gravando PORTAL numa solicitação que nunca passou por portal nenhum.
//
// POR QUE NÃO EXISTE FILA "NOVAS"
//
// Numa operação com portal, "Novas" é o que entrou e ninguém olhou. Aqui o
// ato de cadastrar É o ato de analisar: ninguém digita sem ter lido o
// e-mail. Uma aba "Novas" ficaria sempre vazia — e card que nunca enche é o
// "dashboard decorativo" que o PROMPT-MESTRE proíbe. Ela volta quando o
// portal público entrar no ar.
//
// O MESMO MODELO SERVE OS DOIS CANAIS
//
// Quando o portal entrar, o associado preenche a MESMA solicitação, com os
// mesmos campos; só muda o CANAL_ENTRADA. Se esta tela gravasse um formato
// "só da secretaria", o portal não conseguiria alimentar a mesma fila
// depois — e seriam duas verdades sobre a mesma coisa.
// ============================================================================

/**
 * Cria a solicitação. Dois destinos possíveis, e a diferença é quem decidiu.
 *
 * `aprovar = true` grava APROVADO com usuário e data de validação — é o
 * caminho de quando o e-mail do associado veio completo, que deve ser a
 * maioria. `aprovar = false` grava ANALISE, para o que falta documento.
 *
 * Aprovar direto economiza dois cliques por certificado SEM perder o
 * registro de quem aprovou: é isso que separa "pular etapa" de "pular
 * burocracia".
 */
function voucherCriarSolicitacao(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  dados = dados || {};

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, mensagem: "Outra gravação está em andamento. Tente de novo em instantes." };
  }

  try {
    var cpf = String(dados.cpf || "").replace(/\D/g, "");
    var nome = String(dados.nome || "").trim();
    var modalidade = String(dados.modalidade || "").trim();

    /* O MÍNIMO PARA A SOLICITAÇÃO EXISTIR.
     * Sem CPF não há como reencontrar o associado nem alimentar a memória
     * dele; sem nome ninguém sabe de quem é; sem modalidade não há regra
     * que calcule percentual. Faltando qualquer um, é rascunho, não
     * solicitação — e rascunho na fila polui a contagem de todo mundo. */
    var faltando = [];
    if (cpf.length !== 11) faltando.push("CPF válido");
    if (!nome) faltando.push("nome do associado");
    if (!modalidade) faltando.push("modalidade");
    if (faltando.length) {
      return { ok: false, mensagem: "Falta preencher: " + faltando.join(", ") + "." };
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!sh) {
      setupVoucherModuleFase1();
      sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    }
    if (!sh) return { ok: false, mensagem: "Aba de solicitações não encontrada." };

    var aprovar = dados.aprovar === true;
    var agora = new Date();
    var protocolo = gerarNumeroProtocolo_();
    var quem = (sessao && (sessao.email || sessao.usuario || sessao.nome)) || "";

    /* Escrito POR NOME DE COLUNA, nunca por posição.
     * A aba de produção não tem a ordem do setupVoucherModuleFase1 — foi
     * exatamente confiar em posição que desalinhou 13 colunas em 12/08. */
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });

    var valores = {
      ID_SOLICITACAO: gerarIdPadrao_("SOL"),
      DATA_SOLICITACAO: agora,
      DATA_SOLICITACAO_TEXTO: Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
      CPF_SOLICITANTE: cpf,
      NOME_SOLICITANTE: nome,
      EMAIL: String(dados.email || "").trim(),
      TELEFONE: String(dados.telefone || "").trim(),
      SITUACAO_SINDICAL: String(dados.situacaoSindical || "ASSOCIADO").trim(),
      STATUS_VALIDACAO_SINDICAL: aprovar ? "VALIDADO" : "PENDENTE",
      /* Onde TRABALHA */
      ESCOLA_SELECIONADA: String(dados.escola || "").trim(),
      UNIDADE_ESCOLA: String(dados.unidadeEscola || "").trim(),
      CNPJ_ESCOLA: String(dados.cnpjEscola || "").replace(/\D/g, ""),
      CIDADE_ESCOLA: String(dados.cidadeEscola || "").trim(),
      /* O escolaId vem da busca e amarra a solicitacao a escola de verdade.
       * Sem ele sobraria um nome digitado que ninguem casa depois — que e o
       * que a Fase 4 existe para acabar. A coluna so e gravada se a aba ja
       * tiver ela; nao invento coluna aqui. */
      ESCOLA_ID: String(dados.escolaId || "").trim(),
      /* Onde ESTUDA — outra empresa, e é isto que faltava no cadastro */
      INSTITUICAO_ENSINO: String(dados.instituicao || "").trim(),
      CNPJ_INSTITUICAO: String(dados.cnpjInstituicao || "").replace(/\D/g, ""),
      EMAIL_INSTITUICAO: String(dados.emailInstituicao || "").trim(),
      /* O beneficiário */
      TIPO_BENEFICIARIO: String(dados.tipoBeneficiario || "TITULAR").trim(),
      NOME_BENEFICIARIO: String(dados.beneficiario || nome).trim(),
      DATA_NASCIMENTO_BENEFICIARIO: dados.dataNascimento || "",
      IDADE_BENEFICIARIO: dados.idadeBeneficiario === undefined ? "" : dados.idadeBeneficiario,
      NOME_TITULAR_ASSOCIADO: nome,
      PARENTESCO: String(dados.parentesco || "").trim(),
      ENTEADO_DECLARADO_IR: String(dados.enteadoDeclaradoIR || "").trim(),
      ORDEM_FILHO: String(dados.ordemFilho || "").trim(),
      /* O curso */
      MODALIDADE: modalidade,
      AREA_CURSO: String(dados.area || "").trim(),
      CURSO: String(dados.curso || "").trim(),
      REGIME: String(dados.regime || "").trim(),
      PERIODO_REFERENCIA: String(dados.periodo || "").trim(),
      PERCENTUAL_APLICADO: dados.percentual === undefined || dados.percentual === ""
        ? "" : Number(dados.percentual),
      /* Comprovação e trilha */
      TIPO_DOCUMENTO_VINCULO: String(dados.tipoDocumentoVinculo || "").trim(),
      LINK_CONTRACHEQUE: String(dados.linkContracheque || "").trim(),
      LINK_DOC_PESSOAL: String(dados.linkDocPessoal || "").trim(),
      STATUS_SOLICITACAO: aprovar ? "APROVADO" : "ANALISE",
      /* EMAIL, não PORTAL. Ver o cabeçalho deste arquivo. */
      CANAL_ENTRADA: String(dados.canal || "EMAIL").trim().toUpperCase(),
      USUARIO_CADASTRO: quem,
      USUARIO_VALIDACAO: aprovar ? quem : "",
      DATA_VALIDACAO: aprovar ? agora : "",
      DATA_EMISSAO: "",
      OBSERVACOES: String(dados.observacoes || "").trim(),
      NUMERO_PROTOCOLO: protocolo
    };

    /* UM VOUCHER POR PESSOA, POR CURSO, POR JANELA — e esta é a checagem que
     * VALE, não a da tela.
     *
     * A tela já avisa enquanto a pessoa preenche, mas aquilo é conveniência:
     * ela pode estar aberta há vinte minutos, ou pode haver duas abas do
     * mesmo formulário. Aqui é dentro do lock, com a aba na mão e um
     * instante antes de escrever a linha — é o único ponto onde a resposta
     * ainda é verdade quando a gravação acontece.
     *
     * Sem escapatória, por decisão do usuário em 13/08/2026: "não pode gerar
     * duas vezes para a mesma pessoa". Quem cai aqui quase sempre quer
     * REENVIAR o que já existe, e é isso que a mensagem oferece. */
    var hist = { anteriores: [] };
    if (typeof voucherPeriodoHistorico_ === "function") {
      hist = voucherPeriodoHistorico_({
        cpf: cpf, nome: nome, beneficiario: valores.NOME_BENEFICIARIO,
        modalidade: modalidade, curso: valores.CURSO,
        regime: valores.REGIME, periodo: valores.PERIODO_REFERENCIA
      }, sh);

      if (hist.bloqueado) {
        return {
          ok: false,
          duplicado: true,
          bloqueio: hist.bloqueio,
          mensagem: voucherPeriodoMensagemBloqueio_(hist.bloqueio, {
            regime: valores.REGIME, periodo: valores.PERIODO_REFERENCIA
          })
        };
      }
      /* Deduzido do que já existe, nunca perguntado a quem digita. A coluna
       * só é gravada se a aba tiver ela — não invento coluna aqui. */
      valores.TIPO_SOLICITACAO = voucherTipoSolicitacao_(hist);
    }

    sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([
      cab.map(function (c) { return valores[c] !== undefined ? valores[c] : ""; })
    ]);

    /* A MEMÓRIA APRENDE NO CADASTRO, não só na emissão.
     *
     * É aqui que o exemplo do Marcelo se fecha: a instituição digitada nesta
     * solicitação é a que vai aparecer preenchida na próxima. Esperar a
     * emissão para aprender atrasaria a memória em um passo inteiro — e
     * solicitação que fica em análise nunca ensinaria nada.
     *
     * O PERCENTUAL só vai para o padrão quando a solicitação foi APROVADA.
     * O que está em análise ainda pode ser recusado ou alterado; contá-lo
     * como concessão inflaria a estatística com o que não aconteceu. */
    try {
      if (typeof voucherInstLembrar_ === "function" && valores.INSTITUICAO_ENSINO) {
        voucherInstLembrar_({
          nome: valores.INSTITUICAO_ENSINO, cnpj: valores.CNPJ_INSTITUICAO,
          email: valores.EMAIL_INSTITUICAO,
          percentual: aprovar ? valores.PERCENTUAL_APLICADO : "", quem: quem
        });
      }
      if (aprovar && typeof voucherPadraoLembrar_ === "function") {
        voucherPadraoLembrar_({
          modalidade: valores.MODALIDADE, area: valores.AREA_CURSO,
          curso: valores.CURSO, percentual: valores.PERCENTUAL_APLICADO
        });
      }
    } catch (e) {
      Logger.log("Memória não aprendeu (a solicitação foi gravada): " + e.message);
    }

    if (typeof auditar_ === "function") {
      auditar_({
        modulo: "Benefícios", submodulo: "Certificado de Bolsa",
        acao: aprovar ? "APROVAR_SOLICITACAO" : "CRIAR_SOLICITACAO",
        registroId: protocolo, documento: protocolo,
        valorNovo: nome + " · " + modalidade + " · " +
                   (valores.PERCENTUAL_APLICADO || "sem percentual") + "%",
        justificativa: valores.OBSERVACOES, sessao: sessao || {}
      });
    }

    return {
      ok: true, protocolo: protocolo, status: valores.STATUS_SOLICITACAO,
      tipo: valores.TIPO_SOLICITACAO || "",
      renovacao: valores.TIPO_SOLICITACAO === "RENOVACAO",
      mensagem: aprovar
        ? "Solicitação criada e aprovada. Protocolo " + protocolo + "."
        : "Solicitação criada em análise. Protocolo " + protocolo + "."
    };
  } catch (e) {
    Logger.log("voucherCriarSolicitacao: " + e.message);
    return { ok: false, mensagem: "Erro ao criar a solicitação: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Busca o associado na base de ~8.000 para preencher o cabeçalho do formulário.
 *
 * Devolve no máximo 10. A tela é de digitar depressa: uma lista de 300 nomes
 * não ajuda ninguém a escolher, e a pessoa que atende sabe o nome de quem
 * está do outro lado do telefone.
 */
function voucherBuscarAssociado(termo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var busca = voucherInstNormalizar_(termo);
    var digitos = String(termo || "").replace(/\D/g, "");
    if (busca.length < 3 && digitos.length < 3) {
      return { ok: true, associados: [], mensagem: "Digite ao menos 3 caracteres." };
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName("Associados");
    if (!sh || sh.getLastRow() < 2) return { ok: true, associados: [] };

    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    function idx(nomes) {
      for (var i = 0; i < nomes.length; i++) {
        var p = cab.indexOf(nomes[i]);
        if (p > -1) return p;
      }
      return -1;
    }
    var iNome = idx(["Nome", "NOME", "Nome completo", "NOME_COMPLETO"]);
    var iCpf  = idx(["CPF", "Cpf", "CPF_ASSOCIADO"]);
    var iMail = idx(["E-mail", "EMAIL", "Email", "E-mail (principal)"]);
    var iTel  = idx(["Telefone", "TELEFONE", "Celular", "TELEFONE 1"]);
    var iEsc  = idx(["Nome fantasia", "ESCOLA", "Escola", "Empresa"]);
    if (iNome === -1 && iCpf === -1) return { ok: true, associados: [] };

    var achados = [];
    for (var l = 1; l < tudo.length && achados.length < 10; l++) {
      var nome = iNome === -1 ? "" : String(tudo[l][iNome] || "");
      var cpf = iCpf === -1 ? "" : String(tudo[l][iCpf] || "").replace(/\D/g, "");
      var casaNome = busca.length >= 3 && voucherInstNormalizar_(nome).indexOf(busca) > -1;
      /* O CPF DA BASE PODE ESTAR SEM O ZERO À ESQUERDA.
       *
       * Mesmo defeito que fez o certificado sair com "8538104780" cru: a
       * planilha guarda a coluna como NÚMERO, e número não tem zero à
       * esquerda. Quem digita o CPF completo — com o zero, como está no
       * documento da pessoa — não achava ninguém, e concluía que o associado
       * não estava cadastrado.
       *
       * Os dois lados são comparados completados até 11. Assim "08538104780"
       * digitado casa com "8538104780" guardado, e vice-versa. */
      var cpfCheio = cpf.length && cpf.length < 11 ? ("00" + cpf).slice(-11) : cpf;
      var buscaCheia = digitos.length > 8 && digitos.length < 11
        ? ("00" + digitos).slice(-11) : digitos;
      var casaCpf  = digitos.length >= 3 &&
        (cpf.indexOf(digitos) > -1 || cpfCheio.indexOf(buscaCheia) > -1);
      if (!casaNome && !casaCpf) continue;
      achados.push({
        nome: nome,
        /* O CPF sai MASCARADO na lista. Ele aparece inteiro só depois de a
         * pessoa escolher um nome — uma busca por "maria" não precisa
         * despejar o CPF de quarenta associadas na tela. */
        cpfMascarado: cpfCheio ? cpfCheio.replace(/\d(?=\d{2})/g, "*") : "",
        /* Devolve o CPF COMPLETO, com o zero recuperado: é ele que vai para
         * o formulário e para a memória, e um CPF de 10 dígitos gravado numa
         * solicitação nova propagaria o defeito adiante. */
        cpf: cpfCheio || cpf,
        email: iMail === -1 ? "" : String(tudo[l][iMail] || "").trim(),
        telefone: iTel === -1 ? "" : String(tudo[l][iTel] || "").trim(),
        escola: iEsc === -1 ? "" : String(tudo[l][iEsc] || "").trim()
      });
    }
    return { ok: true, associados: achados };
  } catch (e) {
    Logger.log("voucherBuscarAssociado: " + e.message);
    return { ok: false, mensagem: e.message, associados: [] };
  }
}

/**
 * Busca nas 679 escolas para o campo "onde trabalha".
 *
 * REUSA `buscarEscolasPorTermo_interno_` (BuscaEscola.gs) — não é uma busca
 * nova. Aquela já procura por nome, nome fantasia, CNPJ, e-mail, endereço,
 * bairro, cidade e UF, e foi amadurecendo com o uso do módulo de Ofícios.
 * Escrever uma terceira daria resultados diferentes para a mesma escola
 * dependendo da tela, que é exatamente o que o item 8 do PROMPT-MESTRE
 * manda evitar: uma única entidade Escola.
 *
 * A FUNÇÃO PÚBLICA `buscarEscolasPorTermo` NÃO SERVE AQUI porque exige o
 * módulo ESCOLAS, e quem emite certificado tem BENEFÍCIOS. Daí este
 * invólucro: mesma busca, porta própria. O `_interno_` existe justamente
 * para isto — quem chama é responsável pela própria checagem, e ela está
 * na primeira linha.
 *
 * O ESCOLA_ID VAI JUNTO na resposta. É ele que a Fase 4 usa para amarrar a
 * solicitação à escola de verdade em vez de guardar um nome digitado que
 * ninguém consegue casar depois.
 */
function voucherBuscarEscola(termo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    if (String(termo || "").trim().length < 2) {
      return { ok: true, escolas: [], mensagem: "Digite ao menos 2 caracteres." };
    }
    if (typeof buscarEscolasPorTermo_interno_ !== "function") {
      return { ok: false, mensagem: "Busca de escolas indisponível.", escolas: [] };
    }

    var achadas = buscarEscolasPorTermo_interno_(termo) || [];
    return {
      ok: true,
      escolas: achadas.slice(0, 10).map(function (e) {
        return {
          nome: String(e.escola || e.NomeEscola || e.nome || e["Escola (Razão Social)"] || "").trim(),
          fantasia: String(e.fantasia || e.Fantasia || e.NOME_FANTASIA || "").trim(),
          cnpj: String(e.cnpjLimpo || e.cnpj || e.CNPJ || "").replace(/\D/g, ""),
          cidade: String(e.cidade || e.municipio || e.Cidade || "").trim(),
          uf: String(e.uf || e.UF || "").trim(),
          escolaId: String(e.EscolaID || e.escolaId || (typeof ESC_COL_ID !== "undefined" ? e[ESC_COL_ID] : "") || "").trim()
        };
      })
    };
  } catch (e) {
    Logger.log("voucherBuscarEscola: " + e.message);
    return { ok: false, mensagem: e.message, escolas: [] };
  }
}
