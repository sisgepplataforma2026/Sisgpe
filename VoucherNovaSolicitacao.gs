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
    /* O PERÍODO É OBRIGATÓRIO — e a falta dele não era um campo em branco a
     * mais, era a trava de duplicidade desligada.
     *
     * Achado em 13/08/2026, na tela do usuário: duas solicitações com a
     * coluna PERÍODO vazia. Reproduzido no emulador — sem período, a mesma
     * pessoa, no mesmo curso, passa DUAS VEZES: a janela que o
     * voucherPeriodoHistorico_ compara é o período, e comparar vazio com
     * vazio não delimita janela nenhuma. "Não pode gerar duas vezes para a
     * mesma pessoa" (decisão de 13/08) deixava de valer sem ninguém ver.
     *
     * A porta pública já exigia (VoucherSolicitacao.gs, "Informe o período de
     * referência"); a administrativa não. Mesma divergência de portas que o
     * STATUS_SOLICITACAO teve, e mesma correção: alinhar pela mais estrita. */
    if (!String(dados.periodo || "").trim()) faltando.push("período de referência");
    if (faltando.length) {
      return { ok: false, mensagem: "Falta preencher: " + faltando.join(", ") + "." };
    }

    /* ATÉ O 3º FILHO — a convenção não prevê o quarto.
     *
     * A regra já existia, mas só no CÁLCULO DO PERCENTUAL (Voucher.gs): quem
     * pedisse para o 4º filho recebia percentual vazio e uma observação
     * explicando. A CRIAÇÃO não olhava a ordem — e gravava a solicitação
     * assim mesmo. Testado em 13/08/2026: 1º, 2º, 3º e 4º filhos, todos os
     * quatro criados com protocolo.
     *
     * Pela tela isso não acontecia, porque o seletor só oferece três. Mas o
     * portal público e qualquer chamada direta passam por aqui, e "a tela não
     * deixa" nunca foi trava — é aparência. Uma solicitação de 4º filho na
     * fila é trabalho de análise que termina em recusa, depois de alguém já
     * ter conferido documento.
     *
     * A mensagem é a mesma que o cálculo já dava, para o sindicato dizer a
     * mesma coisa nos dois lugares. */
    var ordem = String(dados.ordemFilho || "").trim();
    var tipoBenef = String(dados.tipoBeneficiario || "").toUpperCase();
    var ehDependente = !!tipoBenef && tipoBenef !== "TITULAR";
    /* EXCETO GRADUAÇÃO E PÓS — regra dita pelo usuário em 13/08/2026:
     * "máximo são três dependentes ao mesmo tempo (menos graduação e
     * pós-graduação)".
     *
     * O teto de três é do ensino básico, onde a convenção escalona 1º e 2º
     * filho em 100% e o 3º em 60%. No superior o benefício não é contado por
     * ordem de filho dessa forma, e aplicar o teto ali recusaria pedido
     * legítimo — que é pior do que aceitar um que depois se analisa. */
    var modalidadeSuperior =
      ["GRADUACAO", "POS_GRADUACAO"].indexOf(modalidade.toUpperCase()) > -1;
    if ((tipoBenef === "FILHO" || tipoBenef === "ENTEADO") && ordem && !modalidadeSuperior) {
      var n = parseInt(ordem, 10);
      if (isNaN(n) || n < 1 || n > 3) {
        return {
          ok: false,
          mensagem: "A convenção prevê desconto até o 3º dependente no ensino básico. " +
                    "Informado: " + ordem + "º."
        };
      }
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
      /* Razão social em ESCOLA_SELECIONADA, fantasia aqui: é assim que o
       * certificado consegue dizer "instituição X, mantida pela Y". */
      ESCOLA_FANTASIA: String(dados.escolaFantasia || "").trim(),
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
      PERIODO_REFERENCIA: (typeof voucherPeriodoParaGravar_ === "function"
        ? voucherPeriodoParaGravar_(dados.periodo)
        : String(dados.periodo || "").trim()),
      PERCENTUAL_APLICADO: dados.percentual === undefined || dados.percentual === ""
        ? "" : Number(dados.percentual),
      /* Comprovação e trilha */
      TIPO_DOCUMENTO_VINCULO: String(dados.tipoDocumentoVinculo || "").trim(),
      LINK_CONTRACHEQUE: String(dados.linkContracheque || "").trim(),
      LINK_DOC_PESSOAL: String(dados.linkDocPessoal || "").trim(),
      /* NASCE PENDENTE — decisão do usuário em 13/08/2026.
       *
       * Era "ANALISE" fixo, e isso desalinhava as duas portas de entrada: o
       * portal público (VoucherSolicitacao.gs) escolhe entre
       * AGUARDANDO_VALIDACAO_CADASTRAL, PENDENTE e
       * AGUARDANDO_ATENDIMENTO_PRESENCIAL conforme o que se sabe do
       * associado; a tela administrativa gravava ANALISE sempre.
       *
       * ANALISE, na própria tela, é o card rotulado "Complementação
       * solicitada". Uma solicitação recém-criada nascia dizendo que já
       * tinha sido analisada e que faltava documento — e o card "PENDENTES ·
       * Aguardando análise" nunca saía de zero pela porta administrativa.
       * Quem coloca em ANALISE é quem pede complementação
       * (VoucherAdmin.gs:81), que é o único momento em que isso é verdade.
       *
       * A trava do período não muda: PENDENTE e ANALISE ocupam a janela do
       * mesmo jeito (VOUCHER_STATUS_OCUPA_PERIODO_). */
      STATUS_SOLICITACAO: aprovar ? "APROVADO" : "PENDENTE",
      /* EMAIL, não PORTAL. Ver o cabeçalho deste arquivo.
       *
       * EXCETO NO PRESENCIAL, que entra como PAPEL — e isso não é rótulo
       * bonito, é o dado verdadeiro. Regra de 14/08/2026: o não associado
       * "virá presencial e fará a solicitação em papel". Quem for contar
       * depois por onde os pedidos chegaram precisa ver o papel separado do
       * e-mail, senão o balcão fica invisível na estatística. */
      CANAL_ENTRADA: voucherEhNaoAssociado_(dados.situacaoSindical)
        ? "PAPEL"
        : String(dados.canal || "EMAIL").trim().toUpperCase(),
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
    /* O TETO DE TRÊS DEPENDENTES, contado dentro do lock e com a aba na mão.
     *
     * Fica aqui e não junto das validações de cima porque precisa da planilha
     * — é contagem do que já existe, não conferência do que foi digitado. E
     * fica ANTES da trava de duplicidade porque as duas recusas são
     * diferentes: "este dependente já tem bolsa" e "este associado já tem
     * três" pedem coisas opostas de quem atende. */
    if (ehDependente && typeof voucherPeriodoDependentesNaJanela_ === "function") {
      var jaTem = voucherPeriodoDependentesNaJanela_({
        cpf: cpf, regime: valores.REGIME, periodo: valores.PERIODO_REFERENCIA
      }, sh);
      var esteNome = String(valores.NOME_BENEFICIARIO || "").trim().toUpperCase();
      var jaEsta = jaTem.nomes.some(function (n) {
        return String(n || "").trim().toUpperCase() === esteNome;
      });
      /* Quem JÁ ESTÁ na lista não ocupa uma vaga nova — a recusa dele é a de
       * duplicidade, logo abaixo, que diz o protocolo. Barrar aqui daria a
       * mensagem errada para quem só está repetindo um pedido. */
      if (!jaEsta && jaTem.total >= VOUCHER_MAX_DEPENDENTES_) {
        return {
          ok: false,
          tetoDependentes: true,
          mensagem: "Este associado já tem " + jaTem.total + " dependentes com bolsa " +
                    "neste período (" + jaTem.nomes.join(", ") + "). O máximo é " +
                    VOUCHER_MAX_DEPENDENTES_ + "."
        };
      }
    }

    var hist = { anteriores: [] };
    var excecaoAplicada = null;
    if (typeof voucherPeriodoHistorico_ === "function") {
      hist = voucherPeriodoHistorico_({
        cpf: cpf, nome: nome, beneficiario: valores.NOME_BENEFICIARIO,
        modalidade: modalidade, curso: valores.CURSO,
        regime: valores.REGIME, periodo: valores.PERIODO_REFERENCIA
      }, sh);

      if (hist.bloqueado) {
        /* A ÚNICA saída da trava, e ela é estreita: administrador, com o
         * motivo escrito. Quem valida é aqui, nunca a tela — ver o bloco da
         * exceção em VoucherPeriodo.gs. */
        var exc = voucherPeriodoValidarExcecao_(dados.excecao, sessao);

        if (!exc.vale) {
          return {
            ok: false,
            duplicado: true,
            bloqueio: hist.bloqueio,
            /* Quando a exceção foi PEDIDA e recusada, a mensagem é a dela —
             * "só administrador" e "faltou o motivo" pedem ações opostas de
             * quem está do outro lado, e a recusa genérica não diria nem
             * uma nem outra. */
            mensagem: exc.mensagem || voucherPeriodoMensagemBloqueio_(hist.bloqueio, {
              regime: valores.REGIME, periodo: valores.PERIODO_REFERENCIA
            })
          };
        }

        /* Autorizada: grava com rastro em três lugares. O que sai da regra é
         * justamente o que mais precisa ser encontrável depois. */
        excecaoAplicada = exc;
        valores.EXCECAO_DUPLICIDADE = String((hist.bloqueio && hist.bloqueio.protocolo) || "SIM");
        var carimbo = voucherPeriodoCarimboExcecao_(hist.bloqueio, exc.justificativa, quem);
        valores.OBSERVACOES = valores.OBSERVACOES
          ? valores.OBSERVACOES + "\n" + carimbo : carimbo;
      }
      /* Deduzido do que já existe, nunca perguntado a quem digita. A coluna
       * só é gravada se a aba tiver ela — não invento coluna aqui. */
      valores.TIPO_SOLICITACAO = voucherTipoSolicitacao_(hist);
    }

    sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length).setValues([
      cab.map(function (c) { return valores[c] !== undefined ? valores[c] : ""; })
    ]);

    /* QUANDO E POR QUEM O PAPEL FOI RECEBIDO — no histórico, não em coluna.
     *
     * A faixa do atendimento presencial pergunta as duas coisas, e elas
     * precisam sobreviver: é o que responde "quem atendeu essa pessoa?" seis
     * meses depois, quando o papel físico já está numa pasta e ninguém lembra.
     *
     * Vai para o HISTÓRICO porque ele é append-only. OBSERVACOES seria o
     * lugar óbvio e seria errado: `atualizarStatusSolicitacao_` sobrescreve
     * essa coluna, então a primeira aprovação apagaria o registro — o mesmo
     * defeito que a correção de período teve em 13/08, e que só apareceu
     * porque o teste leu DEPOIS da emissão em vez de antes.
     *
     * Não lança: a solicitação já está gravada quando isto roda, e perder o
     * atendimento inteiro por causa de uma anotação seria trocar o problema
     * grande pelo pequeno. */
    if (voucherEhNaoAssociado_(dados.situacaoSindical)) {
      try {
        var papelData = String(dados.papelRecebidoEm || "").trim();
        var papelQuem = String(dados.papelRecebidoPor || "").trim();
        if (typeof registrarHistoricoVoucher_ === "function") {
          registrarHistoricoVoucher_(
            valores.ID_SOLICITACAO, cpf, "SOLICITACAO_EM_PAPEL", quem,
            "Atendimento presencial: solicitação recebida em papel" +
            (papelData ? " em " + papelData : "") +
            (papelQuem ? ", por " + papelQuem : "") +
            ". Retirada na sede, sem envio por e-mail.",
            protocolo
          );
        }
      } catch (e) {
        Logger.log("Rastro do papel não gravado (a solicitação foi): " + e.message);
      }
    }

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

      /* A EXCEÇÃO GANHA REGISTRO PRÓPRIO na trilha, e não uma linha a mais na
       * observação da criação. Quem for auditar depois procura pelo ATO
       * ("quantas exceções foram autorizadas, por quem"), não pela
       * solicitação — e ação diluída dentro de outra não se encontra por
       * filtro nenhum. */
      if (excecaoAplicada) {
        auditar_({
          modulo: "Benefícios", submodulo: "Certificado de Bolsa",
          acao: "AUTORIZAR_EXCECAO_DUPLICIDADE",
          registroId: protocolo, documento: protocolo,
          valorAnterior: String(valores.EXCECAO_DUPLICIDADE || ""),
          valorNovo: protocolo,
          justificativa: excecaoAplicada.justificativa,
          sessao: sessao || {}
        });
      }
    }

    return {
      ok: true, protocolo: protocolo, status: valores.STATUS_SOLICITACAO,
      tipo: valores.TIPO_SOLICITACAO || "",
      renovacao: valores.TIPO_SOLICITACAO === "RENOVACAO",
      excecao: !!excecaoAplicada,
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

    /* BUSCA APROXIMADA — o segundo caminho, quando o texto exato não acha.
     *
     * Pedido do usuário em 13/08/2026, depois de "UVV - VILA VELHA" (como
     * está na base de Associados) não encontrar "SEGEX UVV" (como está no
     * cadastro de Escolas). A busca normal casa por PEDAÇO DE TEXTO: serve
     * para abreviação e para nome escrito pela metade, e não serve quando as
     * duas grafias divergem de verdade — e elas divergem, porque uma foi
     * digitada pela escola e a outra pelo sindicato, anos diferentes.
     *
     * Só roda quando a exata não achou NADA. Rodar sempre encheria a lista
     * de parecidos ao lado do resultado certo, e o parecido só ajuda quando
     * o certo não existe.
     *
     * As aproximadas voltam MARCADAS. A tela precisa saber que aquilo é
     * palpite: nome parecido não é a mesma escola, e o CNPJ errado num
     * certificado não é conferido por ninguém depois — o campo está
     * preenchido, e campo preenchido não se relê. */
    var aproximada = false;
    if (!achadas.length) {
      achadas = voucherEscolasParecidas_(termo);
      aproximada = achadas.length > 0;
    }

    return {
      ok: true,
      aproximada: aproximada,
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

/* ══════════════════════════════════════════════════════════════════════════
   BUSCA APROXIMADA DE ESCOLA — o segundo caminho, e só quando o primeiro
   falha por completo.

   O PROBLEMA REAL, que não é de digitação. A base de Associados diz
   "UVV - VILA VELHA"; o cadastro de Escolas diz "SEGEX UVV". Nenhuma das duas
   está errada — uma foi escrita pelo sindicato, a outra pela escola, em anos
   diferentes. A busca por pedaço de texto não casa as duas, porque o que
   sobra em comum é uma sigla no meio de palavras que não se repetem.

   COMO A SEMELHANÇA É MEDIDA, em duas camadas:

     1. PALAVRA EM COMUM vale muito. "UVV" aparecendo dos dois lados é
        evidência forte, mesmo com todo o resto diferente. Palavras que não
        distinguem nada ("ESCOLA", "CENTRO", "LTDA") são descartadas antes —
        senão metade do cadastro pareceria semelhante a metade do cadastro.
     2. DISTÂNCIA DE EDIÇÃO cobre o erro de digitação e a variação de grafia
        ("MULTIVIX" × "MULTVIX"). Ela só entra quando não há palavra em comum,
        porque é mais cara e mais frouxa.

   O corte é deliberadamente ALTO. Devolver muitos parecidos é pior que
   devolver nenhum: quem atende escolheria da lista sem conferir, e o CNPJ
   errado num certificado não é conferido por ninguém depois — o campo está
   preenchido, e campo preenchido não se relê.
   ══════════════════════════════════════════════════════════════════════════ */

var VOUCHER_ESCOLA_RUIDO_ = [
  "ESCOLA", "COLEGIO", "CENTRO", "EDUCACIONAL", "EDUCACAO", "ENSINO",
  "INSTITUTO", "FACULDADE", "UNIDADE", "MUNICIPAL", "ESTADUAL", "PARTICULAR",
  "LTDA", "EIRELI", "EPP", "ME", "SA", "DE", "DA", "DO", "DOS", "DAS", "E",
  "INFANTIL", "FUNDAMENTAL", "MEDIO", "CRECHE", "PRE", "PROFESSOR",
  "PROFESSORA", "SANTA", "SANTO", "SAO", "DOUTOR", "DOUTORA"
];

function voucherEscolaPalavras_(texto) {
  var t = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!t) return [];
  return t.split(" ").filter(function (p) {
    return p.length >= 3 && VOUCHER_ESCOLA_RUIDO_.indexOf(p) === -1;
  });
}

/** Distância de edição entre duas palavras curtas. Barata o bastante para
 *  rodar sobre as ~679 do cadastro, e só é chamada quando precisa. */
function voucherDistanciaEdicao_(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  var linha = [];
  for (var j = 0; j <= b.length; j++) linha[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var anterior = linha[0];
    linha[0] = i;
    for (var k = 1; k <= b.length; k++) {
      var guardado = linha[k];
      linha[k] = Math.min(
        linha[k] + 1,
        linha[k - 1] + 1,
        anterior + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1)
      );
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/** Quão parecidos, de 0 a 1. Ver o bloco acima para o critério. */
function voucherSemelhancaEscola_(palavrasA, palavrasB) {
  if (!palavrasA.length || !palavrasB.length) return 0;

  var comuns = palavrasA.filter(function (p) { return palavrasB.indexOf(p) > -1; });
  if (comuns.length) {
    /* Uma palavra distintiva em comum já vale 0,75; cada palavra a mais
     * aproxima de 1. Uma sigla igual dos dois lados é evidência forte. */
    return Math.min(1, 0.75 + (comuns.length - 1) * 0.15);
  }

  /* Sem palavra em comum: o melhor par por distância de edição. Só conta
   * quando a diferença é pequena perto do tamanho da palavra — "MULTIVIX" e
   * "MULTVIX" sim; "ANCHIETA" e "ARACRUZ" não. */
  var melhor = 0;
  palavrasA.forEach(function (a) {
    palavrasB.forEach(function (b) {
      var maior = Math.max(a.length, b.length);
      if (maior < 4) return;
      var d = voucherDistanciaEdicao_(a, b);
      if (d > 2) return;
      var s = 1 - (d / maior);
      if (s > melhor) melhor = s;
    });
  });
  /* Pesa menos que palavra idêntica, mas não tão pouco que o erro de uma
   * letra caia abaixo do corte: "ANCHETA" × "ANCHIETA" tem que achar. Com
   * 0,85, uma letra a menos em palavra de 8 passa; duas, não. */
  return melhor >= 0.75 ? melhor * 0.85 : 0;
}

function voucherEscolasParecidas_(termo) {
  try {
    var palavrasTermo = voucherEscolaPalavras_(termo);
    if (!palavrasTermo.length) return [];

    var lista = (typeof listarEscolasCadastro_interno_ === "function"
      ? listarEscolasCadastro_interno_() : []) || [];
    if (!lista.length) return [];

    var pontuadas = [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      var nome = e.escola || e.NomeEscola || e.nome || e["Escola (Razão Social)"] || "";
      var fantasia = e.fantasia || e.Fantasia || e.NOME_FANTASIA || "";
      var s = Math.max(
        voucherSemelhancaEscola_(palavrasTermo, voucherEscolaPalavras_(nome)),
        voucherSemelhancaEscola_(palavrasTermo, voucherEscolaPalavras_(fantasia))
      );
      if (s >= 0.7) pontuadas.push({ escola: e, pontos: s });
    }

    pontuadas.sort(function (a, b) { return b.pontos - a.pontos; });
    /* No máximo 8. Lista longa de "parecidas" convida a escolher sem ler. */
    return pontuadas.slice(0, 8).map(function (p) { return p.escola; });
  } catch (e) {
    Logger.log("voucherEscolasParecidas_: " + e.message);
    return [];
  }
}

/**
 * VÁRIOS BENEFICIÁRIOS NUM PEDIDO SÓ — o titular e até três dependentes.
 *
 * Pedido do usuário em 13/08/2026: *"eu consigo fazer os três num único
 * pedido?"*. Hoje não dava: cada beneficiário é uma solicitação, com
 * protocolo e certificado próprios, e quem atende abria o modal três vezes
 * redigitando o associado, a escola e o período em cada uma.
 *
 * ESTA FUNÇÃO NÃO TEM REGRA NENHUMA DENTRO DELA, e é o ponto principal do
 * desenho. Ela monta o payload de cada beneficiário juntando o que é comum
 * com o que é dele, e chama `voucherCriarSolicitacao` uma vez por pessoa. A
 * trava de período, o teto de três dependentes, a obrigatoriedade do
 * período, a validação de CPF — tudo continua num lugar só. Uma segunda
 * implementação das mesmas regras é a forma mais confiável de elas
 * divergirem em seis meses.
 *
 * SEM LOCK AQUI. `voucherCriarSolicitacao` já pega o lock do script a cada
 * chamada; embrulhar o lote num segundo lock seria lock aninhado, que neste
 * projeto já causou bug real na folha de pagamento.
 *
 * O RESULTADO É PARCIAL DE PROPÓSITO. Se o segundo beneficiário for
 * recusado, o primeiro e o terceiro FICAM gravados. Desfazer tudo por causa
 * de um obrigaria a redigitar a família inteira por causa de uma criança que
 * já tinha bolsa — e quem opera corrige o card recusado e clica de novo. A
 * resposta traz um resultado por beneficiário, na ordem em que vieram, para
 * a tela marcar cada card com o protocolo ou com o motivo.
 */
function voucherCriarSolicitacoesEmLote(pedido, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  pedido = pedido || {};

  var comuns = pedido.comuns || {};
  var lista = pedido.beneficiarios || [];

  if (!lista.length) {
    return { ok: false, mensagem: "Nenhum beneficiário informado." };
  }
  /* O teto vale para o LOTE também, e antes de gravar qualquer linha: mandar
   * cinco e gravar três, recusando dois, entrega meio pedido feito e deixa
   * quem atende sem saber o que aconteceu com o resto. */
  var quantosDependentes = 0;
  for (var d = 0; d < lista.length; d++) {
    var t = String(lista[d].tipoBeneficiario || "").toUpperCase();
    if (t && t !== "TITULAR") quantosDependentes++;
  }
  var teto = (typeof VOUCHER_MAX_DEPENDENTES_ !== "undefined") ? VOUCHER_MAX_DEPENDENTES_ : 3;
  if (quantosDependentes > teto) {
    return {
      ok: false,
      mensagem: "São " + quantosDependentes + " dependentes no mesmo pedido, e o " +
                "máximo é " + teto + ". Tire " + (quantosDependentes - teto) +
                " do pedido antes de salvar."
    };
  }

  var resultados = [];
  var criados = 0;

  for (var i = 0; i < lista.length; i++) {
    var b = lista[i] || {};

    /* O que é do PEDIDO vem primeiro; o que é do BENEFICIÁRIO sobrescreve.
     * Dois filhos podem estudar em instituições e modalidades diferentes —
     * é o motivo de o curso morar no card e não no cabeçalho. */
    var dados = {};
    Object.keys(comuns).forEach(function (k) { dados[k] = comuns[k]; });
    Object.keys(b).forEach(function (k) {
      if (b[k] !== "" && b[k] !== null && b[k] !== undefined) dados[k] = b[k];
    });

    /* O período é do pedido, um só para todos — com a exceção de o card
     * trazer o dele, que é o caso raro previsto no desenho. */
    if (!dados.periodo) dados.periodo = comuns.periodo;

    var r;
    try {
      r = voucherCriarSolicitacao(dados, tokenSessao);
    } catch (e) {
      /* Um beneficiário que explode não pode derrubar os outros: o lote
       * continua e o card dele mostra o erro. */
      Logger.log("voucherCriarSolicitacoesEmLote [" + i + "]: " + e.message);
      r = { ok: false, mensagem: "Erro ao gravar: " + e.message };
    }

    if (r && r.ok) criados++;
    resultados.push({
      indice: i,
      nome: String(dados.beneficiario || dados.nome || "").trim(),
      ok: !!(r && r.ok),
      protocolo: (r && r.protocolo) || "",
      duplicado: !!(r && r.duplicado),
      tetoDependentes: !!(r && r.tetoDependentes),
      mensagem: (r && r.mensagem) || ""
    });
  }

  return {
    ok: criados > 0,
    criados: criados,
    total: lista.length,
    /* `parcial` existe para a tela não precisar comparar números para saber
     * se mostra o resumo verde ou o resumo misto. */
    parcial: criados > 0 && criados < lista.length,
    resultados: resultados,
    mensagem: criados === lista.length
      ? (criados === 1 ? "Solicitação criada." : criados + " solicitações criadas.")
      : (criados === 0
          ? "Nenhuma solicitação foi criada — veja o motivo em cada beneficiário."
          : criados + " de " + lista.length + " criadas. As demais estão marcadas com o motivo.")
  };
}
