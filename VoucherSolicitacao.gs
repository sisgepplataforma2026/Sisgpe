// =============================================================================
// ARQUIVO: VoucherSolicitacao.gs
// Solicitação, validação, protocolo e gravação do Portal Voucher
// =============================================================================

function salvarCadastroESolicitacaoVoucher(payload) {
  try {
    /* UMA PORTA SÓ PARA OS DOIS CASOS — 16/09/2026.
     *
     * O envio com vários dependentes começou como função global própria, e o
     * t6-exposicao reprovou na hora: o teto de superfície pública subiria de
     * 204 para 205, e o exposicao-teto.json diz que ele só DESCE.
     *
     * O teste estava certo e a saída era melhor do que subir o teto. Esta
     * função já é a porta pública do portal; quando o payload traz
     * `dependentes`, ela delega para o laço. Mesma porta, mesma validação de
     * entrada, nenhuma superfície nova — e o portal continua chamando o que
     * já chamava.
     *
     * Sem risco de recursão: o laço monta cada payload SEM a chave
     * `dependentes`, então a chamada de volta cai no caminho de sempre. */
    if (payload && Array.isArray(payload.dependentes) && payload.dependentes.length) {
      return salvarSolicitacoesDependentesVoucher_(payload);
    }

    validarPayloadPortalVoucher_(payload);
    setupVoucherModuleFase1();

    const cpf              = normalizarCPF_(payload.cpf);
    const nome             = valorSeguroVoucher_(payload.nome);
    const tipoBeneficiario = String(payload.tipoBeneficiario || "").trim().toUpperCase();
    const nomeBeneficiario = valorSeguroVoucher_(payload.nomeBeneficiario || (tipoBeneficiario === "TITULAR" ? nome : ""));
    const parentesco       = valorSeguroVoucher_(payload.parentesco || tipoBeneficiario).toUpperCase();
    const escolaAtual      = valorSeguroVoucher_(payload.escolaAtual || payload.escola);
    const tipoDocVinculo   = inferirTipoDocumentoVinculo_(payload);

    /* PELO PORTAL, O NÃO ASSOCIADO NÃO FAZ A SOLICITAÇÃO.
     *
     * Regra dita pelo usuário em 14/08/2026: "quem não é associado não pode
     * fazer a solicitação pelo site... portal". Ele vem à sede e entrega em
     * papel.
     *
     * ISTO CONVIVE COM O "não pode bloquear" dito minutos antes, e a leitura
     * das duas frases juntas é o que define este código: o que não pode é o
     * bloqueio MUDO — a tela que recusa e não diz nada, deixando a pessoa
     * sem saber o que fazer. A recusa em si é a regra. Por isso a resposta
     * não é um erro seco: ela carrega `naoAssociado` e `avisoPresencial`,
     * para a tela mostrar uma faixa que EXPLICA o caminho, e não um alerta
     * vermelho de falha.
     *
     * A CONSULTA VEM ANTES DE QUALQUER GRAVAÇÃO. Recusar depois de gravar
     * deixaria no sistema o cadastro de quem não pode usar o portal — dado
     * pessoal guardado sem finalidade, que é o que a LGPD manda evitar.
     *
     * RECUSA SÓ QUEM A BASE CONFIRMA COMO NÃO FILIADO. Quem não está na base
     * não é recusado: pode ser associado novo, ainda não lançado, e barrá-lo
     * seria negar direito por atraso de cadastro. Esse caso segue para a
     * fila de validação cadastral, que é pedir conferência humana — não
     * conceder nada. */
    const resultadoBase = consultarAssociadoNaBase_(cpf);
    const naoAssociadoConfirmado = resultadoBase.encontrado && !resultadoBase.filiado;

    if (naoAssociadoConfirmado) {
      return {
        ok: false,
        naoAssociado: true,
        /* Sem "erro", sem "não foi possível": a frase abre pelo que ele TEM,
         * não pelo que ele deixa de poder. O benefício existe para ele. */
        mensagem:
          "O pedido de bolsa pelo portal é exclusivo para associados. " +
          "O benefício é o mesmo — muda só a forma: escreva para " +
          VOUCHER_EMAIL_SECRETARIA_ + " para receber as orientações e " +
          "fazer a solicitação presencialmente, na sede do SindEducação-ES.",
        emailContato: VOUCHER_EMAIL_SECRETARIA_,
        avisoPresencial:
          "A solicitação é entregue em papel e o voucher é retirado na sede. " +
          "Se você já se associou recentemente e este aviso apareceu, " +
          "escreva para " + VOUCHER_EMAIL_SECRETARIA_ + " para atualizarmos " +
          "seu cadastro."
      };
    }

    registrarOuAtualizarCadastroVoucher({
      cpf: cpf,
      nome: nome,
      dataNascimento: payload.dataNascimento,
      telefone: payload.telefone,
      email: payload.email,
      endereco: payload.endereco,
      escolaAtual: escolaAtual,
      cargoFuncao: payload.cargoFuncao,
      situacaoVinculo: payload.situacaoVinculo,
      origemCadastro: "PORTAL_VOUCHER",
      observacoes: "Cadastro/atualização realizada pelo Portal Voucher."
    });

    const situacaoSindicalFinal = resultadoBase.filiado
      ? "ASSOCIADO"
      : (naoAssociadoConfirmado ? "NAO_ASSOCIADO" : "PENDENTE_VALIDACAO");

    atualizarSituacaoSindicalCadastro_(cpf, situacaoSindicalFinal);

    const idadeBeneficiario = calcularIdade_(payload.dataNascimentoBeneficiario);
    const regra             = calcularRegraVoucher_(payload, idadeBeneficiario);

    /* A chave é PESSOA × CURSO × JANELA, e por isso o beneficiário e o curso
     * vão junto: sem eles, dois filhos do mesmo associado em cursos
     * diferentes no mesmo ano se bloqueavam entre si. Ver VoucherPeriodo.gs. */
    const dupCheck = verificarDuplicidadeVoucher_({
      cpf: cpf,
      nome: nome,
      beneficiario: nomeBeneficiario || nome,
      modalidade: payload.modalidade,
      curso: payload.curso,
      periodo: payload.periodoReferencia,
      regime: regra.regime
    });

    if (dupCheck.duplicado) {
      return { ok: false, mensagem: dupCheck.mensagem };
    }

    const escolaInfo    = buscarEscolaPorNome_(escolaAtual);
    const idSolicitacao = gerarIdPadrao_("SOL");
    const protocolo     = gerarNumeroProtocolo_();
    const usuario       = obterUsuarioAtualVoucher_();
    const agora         = new Date();

    const escolaNaoCadastrada = !escolaInfo.cnpj && !escolaInfo.unidade ? "SIM" : "NAO";
    const funcionarioNovo     = !resultadoBase.encontrado ? "SIM" : "NAO";

    let statusValidacaoSindical = "PENDENTE_VALIDACAO_SINDICAL";
    let statusSolicitacao       = "AGUARDANDO_VALIDACAO_CADASTRAL";

    /* O TETO DE TRÊS É POR ASSOCIADO, NO ANO — 16/09/2026.
     *
     * "Respeita o quantitativo por associado, é até três." Não são três
     * filhos: são três VOUCHERS do mesmo associado, em qualquer combinação de
     * nível — dois no Infantil a 100% e um na Graduação a 70% já fecham.
     *
     * NÃO RECUSA: grava com BLOQUEADA_POR_REGRA e manda para a fila da
     * Secretaria, que é a postura do módulo inteiro. Quem pede o quarto pode
     * ter um caso que a regra não prevê — uma bolsa cancelada que não baixou,
     * um dependente que mudou de escola — e barrar em silêncio faz o
     * sindicato perder o registro de que a pessoa procurou. */
    var jaTem = { total: 0, itens: [], ano: "" };
    try {
      jaTem = voucherContarAtivosDoAssociado_(cpf, payload.periodoReferencia);
    } catch (eConta) {
      Logger.log("voucherContarAtivosDoAssociado_ falhou: " + eConta.message);
    }
    var estouraTeto = jaTem.total >= VOUCHER_MAX_DEPENDENTES_;

    if (!regra.apto || estouraTeto) {
      statusSolicitacao = "BLOQUEADA_POR_REGRA";
      statusValidacaoSindical = "NAO_ANALISADO";
    } else if (resultadoBase.filiado) {
      statusSolicitacao = "PENDENTE";
      statusValidacaoSindical = "VALIDADO";
    } else if (naoAssociadoConfirmado) {
      /* O PEDIDO ENTRA NA FILA DO PRESENCIAL — não é recusa, é outro
       * caminho. Ele fica visível para a secretaria, que sabe que alguém
       * procurou e vai aparecer na sede com o papel. Bloquear aqui faria o
       * sindicato perder o registro de que a pessoa existiu. */
      statusSolicitacao = "AGUARDANDO_ATENDIMENTO_PRESENCIAL";
      statusValidacaoSindical = "NAO_ASSOCIADO";
    }

    const docsResult       = registrarDocumentosPayloadVoucher_(idSolicitacao, cpf, payload);
    const linkContracheque = docsResult.find(function(d) { return d && d.tipoDocumento !== "DOCUMENTO_PESSOAL"; });
    const linkDocPessoal   = docsResult.find(function(d) { return d && d.tipoDocumento === "DOCUMENTO_PESSOAL"; });

    const ss  = SpreadsheetApp.openById(PLANILHA_ID);
    const sh  = ss.getSheetByName("Voucher_Solicitacoes");
    const shP = ss.getSheetByName("Voucher_Protocolos");

    const headers = obterHeaders_(sh);
    const linha   = new Array(headers.length).fill("");

    function setCol(colName, valor) {
      const i = headers.indexOf(colName);
      if (i > -1) linha[i] = valor;
    }

    setCol("ID_SOLICITACAO", idSolicitacao);
    setCol("DATA_SOLICITACAO", agora);
    setCol("DATA_SOLICITACAO_TEXTO", formatarDataBrVoucher_(agora));

    setCol("CPF_SOLICITANTE", cpf);
    setCol("NOME_SOLICITANTE", nome);
    setCol("EMAIL", valorSeguroVoucher_(payload.email));
    setCol("TELEFONE", valorSeguroVoucher_(payload.telefone));

    setCol("ESCOLA_SELECIONADA", escolaInfo.escola || escolaAtual);
    setCol("UNIDADE_ESCOLA", escolaInfo.unidade || "");
    setCol("CNPJ_ESCOLA", escolaInfo.cnpj || "");
    setCol("CIDADE_ESCOLA", escolaInfo.cidade || "");

    setCol("SITUACAO_SINDICAL", situacaoSindicalFinal);
    setCol("STATUS_VALIDACAO_SINDICAL", statusValidacaoSindical);

    setCol("TIPO_BENEFICIARIO", tipoBeneficiario);
    setCol("NOME_BENEFICIARIO", nomeBeneficiario);
    setCol("DATA_NASCIMENTO_BENEFICIARIO", valorSeguroVoucher_(payload.dataNascimentoBeneficiario));
    setCol("IDADE_BENEFICIARIO", idadeBeneficiario);
    setCol("NOME_TITULAR_ASSOCIADO", valorSeguroVoucher_(payload.nomeTitularAssociado || nome));
    setCol("PARENTESCO", parentesco);
    setCol("ENTEADO_DECLARADO_IR", valorSeguroVoucher_(payload.enteadoDeclaradoIR || "NAO").toUpperCase());

    /* Instituição de ensino — onde a pessoa ESTUDA, diferente da escola onde
     * trabalha. Opcional na gravação para não quebrar solicitações que já
     * existem nem o portal atual, que ainda não coleta estes campos. */
    setCol("INSTITUICAO_ENSINO", valorSeguroVoucher_(payload.instituicaoEnsino));
    setCol("CNPJ_INSTITUICAO",   valorSeguroVoucher_(payload.cnpjInstituicao));
    setCol("EMAIL_INSTITUICAO",  String(payload.emailInstituicao || "").trim().toLowerCase());
    setCol("MODALIDADE", String(payload.modalidade || "").toUpperCase());
    setCol("CURSO", valorSeguroVoucher_(payload.curso));
    setCol("AREA_CURSO", String(payload.areaCurso || "").toUpperCase());
    setCol("ORDEM_FILHO", valorSeguroVoucher_(payload.ordemFilho));
    setCol("REGIME", regra.regime);
    setCol("PERIODO_REFERENCIA", (typeof voucherPeriodoParaGravar_ === "function"
      ? voucherPeriodoParaGravar_(payload.periodoReferencia)
      : valorSeguroVoucher_(payload.periodoReferencia)));
    setCol("PERCENTUAL_APLICADO", regra.percentual);

    setCol("TIPO_DOCUMENTO_VINCULO", tipoDocVinculo);
    setCol("LINK_CONTRACHEQUE", linkContracheque ? linkContracheque.linkArquivo : "");
    setCol("LINK_DOC_PESSOAL", linkDocPessoal ? linkDocPessoal.linkArquivo : "");

    setCol("STATUS_SOLICITACAO", statusSolicitacao);
    setCol("CANAL_ENTRADA", "PORTAL");
    setCol("USUARIO_CADASTRO", usuario);
    /* O MOTIVO VIAJA JUNTO. A Secretaria abre a solicitação e precisa saber,
       sem investigar, por que ela caiu na fila: idade, ordem, ou o quarto
       voucher do ano. O teto vem primeiro porque é o único que a regra da
       convenção não explica sozinha. */
    setCol("OBSERVACOES",
      (estouraTeto
        ? "LIMITE POR ASSOCIADO: já existem " + jaTem.total + " voucher(s) ativos em " +
          (jaTem.ano || "no ano") + " e a convenção permite " + VOUCHER_MAX_DEPENDENTES_ + ". " +
          "Constam: " + jaTem.itens.map(function (x) {
            return (x.beneficiario || "?") + " — " + (x.modalidade || "?") + " (" + x.status + ")";
          }).join("; ") + ". "
        : "") +
      montarObservacaoSolicitacaoVoucher_(regra, {
        escolaNaoCadastrada: escolaNaoCadastrada,
        funcionarioNovo: funcionarioNovo,
        situacaoSindicalFinal: situacaoSindicalFinal
      }));
    setCol("NUMERO_PROTOCOLO", protocolo);

    sh.appendRow(linha);

    if (shP) {
      shP.appendRow([
        protocolo,
        agora,
        idSolicitacao,
        cpf,
        nome,
        escolaInfo.escola || escolaAtual,
        escolaInfo.unidade || "",
        escolaInfo.cnpj || "",
        escolaInfo.cidade || "",
        statusSolicitacao,
        usuario,
        regra.observacao || ""
      ]);
    }

    registrarHistoricoVoucher_(
      idSolicitacao,
      cpf,
      "SOLICITACAO_CRIADA",
      usuario,
      "Solicitação criada via portal. Status: " + statusSolicitacao +
        " | Situação sindical: " + situacaoSindicalFinal +
        " | Escola não cadastrada: " + escolaNaoCadastrada +
        " | Funcionário novo: " + funcionarioNovo,
      protocolo
    );

    enviarEmailConfirmacaoSolicitacaoVoucher_({
      email: valorSeguroVoucher_(payload.email),
      nome: nome,
      protocolo: protocolo,
      nomeBeneficiario: nomeBeneficiario,
      modalidade: payload.modalidade,
      curso: payload.curso,
      escola: escolaInfo.escola || escolaAtual,
      percentual: regra.percentual,
      situacaoSindicalFinal: situacaoSindicalFinal,
      statusSolicitacao: statusSolicitacao
    });

    enviarEmailInternoNovaSolicitacaoVoucher_({
      protocolo: protocolo,
      nome: nome,
      cpf: cpf,
      escola: escolaInfo.escola || escolaAtual,
      modalidade: payload.modalidade,
      curso: payload.curso,
      periodoReferencia: payload.periodoReferencia,
      percentual: regra.percentual,
      statusSolicitacao: statusSolicitacao,
      situacaoSindicalFinal: situacaoSindicalFinal,
      escolaNaoCadastrada: escolaNaoCadastrada,
      funcionarioNovo: funcionarioNovo
    });

    return {
      ok: true,
      /* A MENSAGEM DE SUCESSO DIZ O QUE VEM DEPOIS.
       *
       * Para o não associado, "registrada com sucesso" sozinho é meia
       * verdade que vira frustração: ele fecharia a tela esperando um
       * e-mail com o voucher. O aviso vai junto do sucesso, não no lugar
       * dele — o pedido foi aceito mesmo, e o que muda é por onde termina. */
      mensagem: naoAssociadoConfirmado
        ? "Solicitação registrada! Como você ainda não é associado, o " +
          "atendimento é presencial: compareça à sede do SindEducação-ES " +
          "para entregar a solicitação em papel e retirar o voucher."
        : "Solicitação registrada com sucesso!",
      avisoPresencial: naoAssociadoConfirmado
        ? "O benefício é o mesmo do associado — muda só a forma de retirar. " +
          "Traga um documento com foto e o comprovante de matrícula. " +
          "O voucher não será enviado por e-mail."
        : "",
      protocolo: { numeroProtocolo: protocolo },
      solicitacao: { idSolicitacao: idSolicitacao },
      percentual: regra.percentual,
      apto: regra.apto,
      status: statusSolicitacao,
      naoAssociado: naoAssociadoConfirmado,
      situacaoSindical: situacaoSindicalFinal
    };

  } catch(e) {
    Logger.log("salvarCadastroESolicitacaoVoucher erro: " + e.message);
    return {
      ok: false,
      mensagem: "Erro ao salvar solicitação: " + e.message
    };
  }
}

/* O teto de dependentes por envio. Regra do usuário em 16/09/2026: "ele pode
   ter até três dependentes", para os ensinos Infantil ao Médio, na escola em
   que o associado trabalha. */
var VOUCHER_MAX_DEPENDENTES_ = 3;

/**
 * ATÉ TRÊS DEPENDENTES NUM ENVIO SÓ.
 *
 * Pedido do usuário em 16/09/2026: "se for dependente, poderia ter um botão
 * para adicionar até três dependentes", "para os ensinos Infantil até o
 * Médio", "se for na mesma escola, por associado", e "se for dependente tem
 * que ter os documentos de cada dependente".
 *
 * UMA SOLICITAÇÃO POR DEPENDENTE, e esta é a decisão de arquitetura.
 * O percentual, a aprovação, o indeferimento e o certificado são todos POR
 * BENEFICIÁRIO — a convenção dá 100% ao 1º e ao 2º filho e 60% ao 3º, e o
 * certificado sai no nome de quem estuda. Numa linha só, aprovar o 1º filho e
 * indeferir o 2º exigiria inventar sub-status, e o certificado não teria como
 * sair por pessoa.
 *
 * Com três linhas, NADA do que já funciona muda: painel, fila, cálculo,
 * emissão e certificado seguem iguais. Esta função é um laço em volta do
 * caminho que já existe, não um segundo caminho.
 *
 * CADA SOLICITAÇÃO CARREGA AS DUAS PROVAS: o comprovante de vínculo do
 * ASSOCIADO (é o emprego dele que dá o direito) e o documento daquele
 * DEPENDENTE. O contracheque acaba gravado uma vez por dependente, e isso é
 * de propósito — cada solicitação é aprovada sozinha, e aprovar sem ter a
 * prova anexada seria aprovar às cegas.
 *
* O RECUSADO NÃO SOME — decisão do usuário em 16/09/2026: "ele deve ter uma
 * informação e a Marcelha verifica e responde pelo SISGEP". Um dependente
 * fora da regra (idade acima de 24, ordem já usada) é GRAVADO com status
 * BLOQUEADA_POR_REGRA, e vai para a fila de quem analisa. Não é recusa muda:
 * a pessoa é avisada na hora, no portal, e ainda assim fica o registro para a
 * Secretaria responder.
 *
 * É a mesma postura do resto do módulo: o não associado também não é barrado,
 * vai para a fila do presencial. Bloquear em silêncio faz o sindicato perder
 * o registro de que a pessoa procurou.
 */
function salvarSolicitacoesDependentesVoucher_(payload) {
  try {
    if (!payload) throw new Error("Dados da solicitação não informados.");

    var dependentes = Array.isArray(payload.dependentes) ? payload.dependentes : [];
    if (!dependentes.length) throw new Error("Informe ao menos um dependente.");
    if (dependentes.length > VOUCHER_MAX_DEPENDENTES_) {
      throw new Error("São permitidos até " + VOUCHER_MAX_DEPENDENTES_ +
                      " dependentes por solicitação. Você informou " + dependentes.length + ".");
    }

    /* ORDEM REPETIDA NO MESMO ENVIO é erro de digitação, e barra ANTES de
       gravar qualquer coisa: dois "1º filho" produziriam dois certificados de
       100% para a mesma posição, e o segundo não teria como ser desfeito sem
       cancelar o voucher já emitido. */
    var ordens = {};
    for (var i = 0; i < dependentes.length; i++) {
      var o = String((dependentes[i] || {}).ordemFilho || "").trim();
      if (o && ordens[o]) {
        throw new Error("Dois dependentes foram informados como " + o +
                        "º filho. Cada ordem só pode aparecer uma vez.");
      }
      if (o) ordens[o] = true;
    }

    var resultados = [];
    var gravadas = 0;

    dependentes.forEach(function (dep, indice) {
      dep = dep || {};
      var rotulo = valorSeguroVoucher_(dep.nomeBeneficiario) || ("Dependente " + (indice + 1));

      /* Monta o payload de UMA solicitação a partir dos dados do associado
         mais os daquele dependente. A escola NÃO vem do dependente: a regra
         vale na escola onde o associado trabalha, que o cadastro já tem. */
      var umaVez = {};
      Object.keys(payload).forEach(function (k) {
        if (k !== "dependentes" && k !== "docPessoal") umaVez[k] = payload[k];
      });
      umaVez.tipoBeneficiario          = dep.tipoBeneficiario || "FILHO";
      umaVez.parentesco                = dep.parentesco || dep.tipoBeneficiario || "FILHO";
      umaVez.nomeBeneficiario          = dep.nomeBeneficiario;
      umaVez.dataNascimentoBeneficiario = dep.dataNascimentoBeneficiario;
      umaVez.ordemFilho                = dep.ordemFilho;
      umaVez.modalidade                = dep.modalidade;
      umaVez.curso                     = dep.curso;
      umaVez.areaCurso                 = dep.areaCurso || "";
      umaVez.enteadoDeclaradoIR        = dep.enteadoDeclaradoIR || "";
      /* O documento pessoal de cada solicitação é o DO DEPENDENTE; o
         contracheque do associado vai em todas, herdado do payload. */
      umaVez.docPessoal                = dep.docPessoal || null;

      var r;
      try {
        r = salvarCadastroESolicitacaoVoucher(umaVez);
      } catch (eDep) {
        r = { ok: false, mensagem: eDep.message };
      }

      if (r && r.ok) gravadas++;

      resultados.push({
        nome: rotulo,
        ordemFilho: String(dep.ordemFilho || ""),
        ok: !!(r && r.ok),
        mensagem: (r && r.mensagem) || "",
        protocolo: (r && r.protocolo && r.protocolo.numeroProtocolo) || "",
        percentual: (r && r.percentual) || "",
        apto: !!(r && r.apto),
        status: (r && r.status) || ""
      });
    });

    return {
      ok: gravadas > 0,
      gravadas: gravadas,
      total: dependentes.length,
      resultados: resultados,
      protocolos: resultados.filter(function (x) { return x.ok; })
                            .map(function (x) { return x.protocolo; }),
      mensagem: gravadas === dependentes.length
        ? (gravadas === 1 ? "Solicitação registrada com sucesso!"
                          : gravadas + " solicitações registradas com sucesso!")
        : (gravadas === 0
            ? "Nenhuma solicitação pôde ser registrada. Veja o motivo de cada dependente."
            : gravadas + " de " + dependentes.length +
              " solicitações registradas. Veja o motivo das demais.")
    };

  } catch (e) {
    Logger.log("salvarSolicitacoesDependentesVoucher_ erro: " + e.message);
    return { ok: false, gravadas: 0, resultados: [], mensagem: e.message };
  }
}

function validarPayloadPortalVoucher_(payload) {
  if (!payload) throw new Error("Dados da solicitação não informados.");
  if (!normalizarCPF_(payload.cpf)) throw new Error("CPF inválido.");
  if (!payload.dataNascimento) throw new Error("Informe a data de nascimento.");
  if (!valorSeguroVoucher_(payload.nome)) throw new Error("Informe o nome do solicitante.");
  if (!valorSeguroVoucher_(payload.escolaAtual || payload.escola)) throw new Error("Selecione ou informe a escola.");
  if (!payload.situacaoSindicalDeclarada) throw new Error("Informe a situação sindical.");
  if (!payload.tipoBeneficiario) throw new Error("Informe o tipo de beneficiário.");
  if (!payload.dataNascimentoBeneficiario) throw new Error("Informe a data de nascimento do beneficiário.");
  if (!payload.modalidade) throw new Error("Informe a modalidade.");
  if (!valorSeguroVoucher_(payload.curso)) throw new Error("Informe o curso.");
  if (!valorSeguroVoucher_(payload.periodoReferencia)) throw new Error("Informe o período de referência.");

  const tipoBenef  = String(payload.tipoBeneficiario || "").trim().toUpperCase();
  const modalidade = String(payload.modalidade || "").trim().toUpperCase();

  if (tipoBenef !== "TITULAR" && !valorSeguroVoucher_(payload.nomeBeneficiario)) {
    throw new Error("Informe o nome do beneficiário.");
  }

  if (
    ["EDUCACAO_INFANTIL", "CRECHE", "ENSINO_FUNDAMENTAL", "TECNICO"].indexOf(modalidade) > -1 &&
    tipoBenef !== "TITULAR" &&
    !valorSeguroVoucher_(payload.ordemFilho)
  ) {
    throw new Error("Informe a ordem do filho para a modalidade selecionada.");
  }

  if (modalidade === "GRADUACAO" && !valorSeguroVoucher_(payload.areaCurso)) {
    throw new Error("Informe a área do curso para graduação.");
  }
}

function montarObservacaoSolicitacaoVoucher_(regra, flags) {
  const partes = [];

  if (regra && regra.observacao) partes.push(regra.observacao);

  if (flags && flags.funcionarioNovo === "SIM") {
    partes.push("Possível funcionário novo: CPF não localizado na base de Associados.");
  }

  if (flags && flags.escolaNaoCadastrada === "SIM") {
    partes.push("Escola não localizada no cadastro de escolas.");
  }

  /* ALCANÇÁVEL, e é bom que seja.
   *
   * Cheguei a marcar esta linha como inalcançável em 14/08/2026, quando o
   * portal recusava o não associado. No mesmo dia o usuário corrigiu — o
   * portal avisa, não bloqueia — e o caso voltou a passar por aqui. Fica o
   * registro porque "código morto" declarado cedo demais é como se apaga
   * coisa viva por engano (REGRA Nº 1): a leitura estava certa para o código
   * daquele minuto e errada meia hora depois. */
  if (flags && flags.situacaoSindicalFinal === "NAO_ASSOCIADO") {
    partes.push("Cadastro identificado como não associado. Orientar atendimento presencial.");
  }

  return partes.join(" | ");
}

/**
 * A trava de duplicidade do portal — hoje só a porta, a regra mora em
 * VoucherPeriodo.gs.
 *
 * ESTA FUNÇÃO TINHA A PRÓPRIA IMPLEMENTAÇÃO, e ela chaveava por CPF DO
 * SOLICITANTE + MODALIDADE. Errava dos dois lados ao mesmo tempo: bloqueava
 * dois filhos do mesmo associado em cursos diferentes no mesmo ano (que é o
 * caso normal de uma família), e deixava passar a mesma pessoa em dois
 * cursos diferentes no mesmo semestre (porque a modalidade não muda). Ver o
 * cabeçalho de VoucherPeriodo.gs.
 *
 * O corpo saiu daqui em vez de ser corrigido em duas cópias porque as duas
 * portas de entrada — a secretaria hoje, o portal quando existir — têm que
 * recusar pelo mesmo critério e com as mesmas palavras. Duas implementações
 * da mesma regra dariam respostas diferentes para a mesma pergunta,
 * dependendo de onde a pessoa clicou.
 *
 * Aceita a forma antiga (4 argumentos posicionais) porque ela é a assinatura
 * que já estava publicada; sem beneficiário e sem curso, porém, a chave cai
 * para o nome do titular e para a modalidade — que é o comportamento antigo,
 * com os defeitos antigos. Quem chama deve passar o objeto.
 */
function verificarDuplicidadeVoucher_(dadosOuCpf, modalidade, periodoReferencia, regime) {
  try {
    var dados = (dadosOuCpf && typeof dadosOuCpf === "object")
      ? dadosOuCpf
      : { cpf: dadosOuCpf, modalidade: modalidade, periodo: periodoReferencia, regime: regime };

    var hist = voucherPeriodoHistorico_(dados);
    if (!hist.bloqueado) return { duplicado: false, tipo: voucherTipoSolicitacao_(hist) };

    return {
      duplicado: true,
      protocolo: hist.bloqueio.protocolo,
      periodo: hist.bloqueio.periodo,
      bloqueio: hist.bloqueio,
      mensagem: voucherPeriodoMensagemBloqueio_(hist.bloqueio, dados)
    };

  } catch(e) {
    Logger.log("verificarDuplicidadeVoucher_ erro: " + e.message);
    /* NÃO devolve "pode emitir" em cima de erro de leitura: quem chama grava
     * logo em seguida, e um erro transitório de planilha viraria o segundo
     * voucher emitido em silêncio. Recusar é reversível; emitir duas vezes
     * não é. */
    return {
      duplicado: true,
      protocolo: "",
      periodo: "",
      mensagem: "Não foi possível conferir se já existe voucher para este " +
                "período (" + e.message + "). Tente de novo em instantes."
    };
  }
}

function enviarEmailConfirmacaoSolicitacaoVoucher_(dados) {
  try {
    if (!dados || !dados.email) return;

    const isAssociado = String(dados.situacaoSindicalFinal || "").toUpperCase() === "ASSOCIADO";
    const status = String(dados.statusSolicitacao || "").toUpperCase();

    let aviso = "";

    if (!isAssociado || status === "AGUARDANDO_ATENDIMENTO_PRESENCIAL") {
      aviso =
        "<p style='background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;'>" +
        "⚠️ <strong>Atenção:</strong> cadastro identificado como <strong>não associado</strong> ou pendente de validação. " +
        "Guarde este protocolo e compareça à sede do SindEducação-ES em até <strong>15 dias úteis</strong> com sua documentação." +
        "</p>";
    } else {
      aviso =
        "<p style='background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;'>" +
        "✅ Sua solicitação será analisada pela equipe do SindEducação-ES. Após aprovação, o voucher será emitido eletronicamente." +
        "</p>";
    }

    voucherEnviarMsg_({
      to: dados.email,
      subject: "Protocolo de Solicitação de Bolsa — SindEducação-ES · " + dados.protocolo,
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>" +
          "<div style='background:#002f6c;padding:24px;border-radius:12px 12px 0 0;text-align:center;'>" +
            "<h1 style='color:#C9A84C;margin:0;font-size:22px;'>SindEducação-ES</h1>" +
            "<p style='color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px;'>Solicitação de Bolsa de Estudo</p>" +
          "</div>" +
          "<div style='background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;'>" +
            "<p>Olá <strong>" + escHtmlVoucher_(dados.nome) + "</strong>,</p>" +
            "<p>Sua solicitação foi registrada com sucesso.</p>" +
            "<div style='background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:20px 0;text-align:center;'>" +
              "<p style='font-size:11px;color:#64748b;margin-bottom:4px;'>Número do Protocolo</p>" +
              "<p style='font-size:22px;font-weight:700;color:#166534;letter-spacing:.04em;'>" + escHtmlVoucher_(dados.protocolo) + "</p>" +
            "</div>" +
            "<table style='width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;'>" +
              "<tr><td style='color:#64748b;padding:6px 0;width:40%;'>Beneficiário:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.nomeBeneficiario) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Modalidade:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.modalidade) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Curso:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.curso) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:6px 0;'>Escola:</td><td style='font-weight:600;'>" + escHtmlVoucher_(dados.escola) + "</td></tr>" +
              (dados.percentual ? "<tr><td style='color:#64748b;padding:6px 0;'>Desconto previsto:</td><td style='font-weight:700;color:#059669;'>" + dados.percentual + "%</td></tr>" : "") +
            "</table>" +
            aviso +
            "<p style='font-size:13px;color:#64748b;'>Prazo de análise: até <strong>15 dias úteis</strong>.</p>" +
          "</div>" +
          "<div style='background:#f8fafc;padding:14px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;'>" +
            "<p style='font-size:11px;color:#94a3b8;'>SindEducação-ES · " + escHtmlVoucher_(SITE_SIND_V) + "</p>" +
          "</div>" +
        "</div>"
    });

  } catch(e) {
    Logger.log("E-mail de confirmação não enviado: " + e.message);
  }
}

function enviarEmailInternoNovaSolicitacaoVoucher_(dados) {
  try {
    const emailSecretaria = "secretaria@sindeducacao.com";

    voucherEnviarMsg_({
      to: emailSecretaria,
      cc: "financeiro@sindeducacao.com",
      subject: "📋 Nova solicitação de bolsa — " + dados.protocolo,
      htmlBody:
        "<div style='font-family:Arial,sans-serif;max-width:620px;'>" +
          "<div style='background:#002f6c;padding:20px;border-radius:10px 10px 0 0;'>" +
            "<h2 style='color:#C9A84C;margin:0;font-size:18px;'>Nova solicitação de bolsa</h2>" +
          "</div>" +
          "<div style='background:#fff;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;'>" +
            "<table style='width:100%;font-size:13px;border-collapse:collapse;'>" +
              "<tr><td style='color:#64748b;padding:5px 0;width:38%;'>Protocolo:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.protocolo) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Solicitante:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.nome) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>CPF:</td><td>" + escHtmlVoucher_(formatarCpfVoucher_(dados.cpf)) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Escola:</td><td>" + escHtmlVoucher_(dados.escola) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Modalidade:</td><td>" + escHtmlVoucher_(dados.modalidade) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Curso:</td><td>" + escHtmlVoucher_(dados.curso) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Período:</td><td>" + escHtmlVoucher_(dados.periodoReferencia) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Status:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.statusSolicitacao) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Situação sindical:</td><td style='font-weight:700;'>" + escHtmlVoucher_(dados.situacaoSindicalFinal) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Funcionário novo:</td><td>" + escHtmlVoucher_(dados.funcionarioNovo) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Escola não cadastrada:</td><td>" + escHtmlVoucher_(dados.escolaNaoCadastrada) + "</td></tr>" +
              "<tr><td style='color:#64748b;padding:5px 0;'>Desconto calculado:</td><td style='font-weight:700;color:#059669;'>" + (dados.percentual || "—") + "%</td></tr>" +
            "</table>" +
          "</div>" +
        "</div>"
    });

  } catch(e) {
    Logger.log("E-mail interno nova solicitação não enviado: " + e.message);
  }
}