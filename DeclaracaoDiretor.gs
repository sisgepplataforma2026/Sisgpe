// ============================================================================
// ARQUIVO: DeclaracaoDiretor.gs
// MÓDULO: Documentos › Declarações — Declaração de Diretor (art. 543 da CLT)
// ============================================================================
//
// O QUE É
//
// A declaração que o sindicato entrega à escola empregadora informando que um
// diretor estará à disposição da entidade em determinado dia, com fundamento
// no art. 543 da CLT. O modelo em papel que originou este arquivo é o
// "DECLARAÇÃO 03.09.2026", conferido linha a linha em 15/09/2026.
//
// 🚨 MODELO FIXO COM VARIÁVEIS — NÃO É EDITOR DE TEXTO. Decisão do usuário.
//
// Só quatro coisas variam: o diretor, o dia da liberação, o período e a data
// de emissão. Todo o resto — inclusive a citação literal do art. 543 e a
// redação dada pelo Decreto-lei nº 229/1967 — é texto fixo, e é fixo de
// propósito: é o trecho jurídico do documento. Um editor livre aqui
// significaria alguém alterar sem querer a citação da lei num documento
// assinado pelo presidente.
//
// SEM O CARGO DE CADA UM — decisão do usuário em 15/09/2026
//
// O texto dizia a função exata da pessoa ("conselheiro fiscal desta Entidade
// Sindical"). Passa a dizer só "diretor desta Entidade Sindical", como no
// modelo em papel. O que a declaração precisa afirmar é que existe mandato
// sindical — o art. 543 não distingue cargo —, e o cargo exato envelhece:
// numa remodelação de diretoria, o papel assinado passa a divergir da
// composição. O cargo continua gravado na coluna CARGO, para o histórico, e
// continua aparecendo na tela ao lado do nome.
//
// SEM HORÁRIO — decisão do usuário em 15/09/2026
//
// A primeira versão do desenho tinha horário inicial e final. Foram retirados
// a pedido dele, com razão concreta: declarar intervalo restringe a atuação
// sindical sem necessidade. A declaração diz o DIA, e no máximo o período.
//
// O TEXTO QUE SAI, nas três formas possíveis:
//
//   sem período   ...no dia 18 de setembro de 2026, estará à disposição...
//   integral      ...no dia 18 de setembro de 2026, em período integral, ...
//   turno         ...no dia 18 de setembro de 2026, no período vespertino, ...
//
// DUPLICATA AVISA, NÃO BLOQUEIA
//
// Emitir duas declarações para o mesmo diretor no mesmo dia é quase sempre
// engano — mas não sempre: a via se perde, a escola pede outra. Então o
// sistema avisa e pede confirmação, em vez de recusar. Recusar obrigaria a
// pessoa a resolver por fora, que é pior.
//
// O TEXTO EMITIDO FICA GRAVADO na coluna TEXTO, não só o PDF. Se um dia a
// redação mudar, a declaração de hoje continua reimprimível exatamente como
// foi assinada. Guardar só os campos e remontar depois produziria um
// documento diferente do que a escola recebeu.
//
// PASTA DO DRIVE — precisa ser configurada uma vez por ambiente.
// Ver `declPastaDestino_` logo abaixo e RECURSOS_AMBIENTE.DECLARACOES.
// ============================================================================

var ABA_DECLARACOES_DIRETOR = "DECLARACOES_DIRETOR";

var DECL_COLUNAS_EMISSAO = [
  "NUMERO", "DIRETOR_ID", "DIRETOR_NOME", "CARGO",
  "DATA_LIBERACAO", "PERIODO", "DATA_EMISSAO",
  "SIGNATARIO", "TEXTO", "PDF_ID", "PDF_URL",
  "EMITIDO_POR", "EMITIDO_EM", "GESTAO", "ORGAO", "CONDICAO",
  "ESCOLA_ID", "ESCOLA_NOME", "ESCOLA_DOCUMENTO", "VINCULO_ORIGEM", "CONTATOS_ORIGEM",
  "EMAILS_USADOS", "EMAIL_STATUS", "EMAIL_ENVIADO_EM", "EMAIL_ENVIADO_POR",
  "WHATSAPP_STATUS", "WHATSAPP_EM", "WHATSAPP_POR"
];

/* Rótulos e trechos de texto por período. Chave vazia = sem período. */
var DECL_PERIODOS = {
  "":           { rotulo: "Não informar", trecho: "" },
  "INTEGRAL":   { rotulo: "Integral",     trecho: ", em período integral" },
  "MATUTINO":   { rotulo: "Matutino",     trecho: ", no período matutino" },
  "VESPERTINO": { rotulo: "Vespertino",   trecho: ", no período vespertino" },
  "NOTURNO":    { rotulo: "Noturno",      trecho: ", no período noturno" }
};

/* Citação literal do art. 543, conferida contra o modelo em papel. */
var DECL_ART_543 =
  "Art. 543 – O empregado eleito para o cargo de administração sindical ou " +
  "representação profissional, inclusive junto a órgão de deliberação coletiva, " +
  "não poderá ser impedido do exercício de suas funções, nem transferido para " +
  "lugar ou mister que lhe dificulte ou torne impossível o desempenho das suas " +
  "atribuições sindicais. (Redação dada pelo Decreto-lei nº 229, 28.2.1967)";

var DECL_CIDADE = "Vitória";

/* =========================================
 * PLANILHA
 * ========================================= */

function declGarantirEmissoes_() {
  var ss = declPlanilha_();
  var sh = ss.getSheetByName(ABA_DECLARACOES_DIRETOR);
  if (!sh) sh = ss.insertSheet(ABA_DECLARACOES_DIRETOR);
  if (sh.getLastRow() === 0) {
    sh.appendRow(DECL_COLUNAS_EMISSAO);
    sh.getRange(1, 1, 1, DECL_COLUNAS_EMISSAO.length)
      .setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  var mapa = declCabecalho_(sh);
  DECL_COLUNAS_EMISSAO.forEach(function (nome) {
    if (!mapa[nome]) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(nome);
      mapa[nome] = col;
    }
  });
  return sh;
}

function declEmissoes_interno_() {
  var sh = declGarantirEmissoes_();
  if (sh.getLastRow() < 2) return [];

  var mapa = declCabecalho_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  function col(l, nome) { return mapa[nome] ? l[mapa[nome] - 1] : ""; }

  return dados.map(function (l) {
    var periodo = declTexto_(col(l, "PERIODO")).toUpperCase();
    return {
      numero:        declTexto_(col(l, "NUMERO")),
      diretorId:     declTexto_(col(l, "DIRETOR_ID")),
      diretorNome:   declTexto_(col(l, "DIRETOR_NOME")),
      cargo:         declTexto_(col(l, "CARGO")),
      dataLiberacao: declDataBR_(col(l, "DATA_LIBERACAO")),
      periodo:       periodo,
      periodoRotulo: (DECL_PERIODOS[periodo] || DECL_PERIODOS[""]).rotulo,
      dataEmissao:   declDataBR_(col(l, "DATA_EMISSAO")),
      signatario:    declTexto_(col(l, "SIGNATARIO")),
      texto:         declTexto_(col(l, "TEXTO")),
      pdfId:         declTexto_(col(l, "PDF_ID")),
      pdfUrl:        declTexto_(col(l, "PDF_URL")),
      emitidoPor:    declTexto_(col(l, "EMITIDO_POR")),
      emitidoEm:     declDataBR_(col(l, "EMITIDO_EM")),
      gestao:        declTexto_(col(l, "GESTAO")),
      escolaId:      declTexto_(col(l, "ESCOLA_ID")),
      escolaNome:    declTexto_(col(l, "ESCOLA_NOME")),
      vinculoOrigem: declTexto_(col(l, "VINCULO_ORIGEM")),
      emailsUsados:  declTexto_(col(l, "EMAILS_USADOS")),
      emailStatus:   declTexto_(col(l, "EMAIL_STATUS")),
      whatsappStatus: declTexto_(col(l, "WHATSAPP_STATUS"))
    };
  }).filter(function (d) { return !!d.numero; });
}

/**
 * Próximo número do ano, no formato 001/2026.
 *
 * Deriva das linhas já gravadas, não de um contador guardado à parte: linha
 * gravada é a única fonte que não dessincroniza. Só é chamada de dentro do
 * lock de `declEmitirDeclaracaoDiretor`.
 */
function declProximoNumero_(ano) {
  ano = Number(ano || new Date().getFullYear());
  var maior = 0;
  declEmissoes_interno_().forEach(function (e) {
    var m = String(e.numero).match(/^(\d+)\/(\d{4})$/);
    if (m && Number(m[2]) === ano) maior = Math.max(maior, Number(m[1]));
  });
  var proximo = maior + 1;
  return ("00" + proximo).slice(-3) + "/" + ano;
}

/* =========================================
 * PASTA DO DRIVE
 * ========================================= */

/**
 * Pasta onde o PDF é gravado, já com a subpasta do ano.
 *
 * O ID sai de `getRecursoId_("DECLARACOES")` (AmbienteRecursos.gs), que é o
 * único mecanismo do sistema que separa produção de homologação. A tabela
 * nasce SEM id justamente para não haver chance de a homologação gravar no
 * acervo real — quem instala configura a Script Property uma vez por
 * ambiente, e a mensagem abaixo diz exatamente qual é.
 */
function declPastaDestino_() {
  var idRaiz;
  try {
    idRaiz = getRecursoId_("DECLARACOES");
  } catch (e) {
    throw new Error(
      "A pasta das declarações ainda não foi configurada neste ambiente. " +
      "Crie a pasta no Drive e informe o ID na Script Property " +
      "SISGEP_PASTA_DECLARACOES (Apps Script › Configurações do projeto › " +
      "Propriedades do script). Detalhe técnico: " + e.message
    );
  }

  var pastaRaiz = DriveApp.getFolderById(idRaiz);
  var ano = String(new Date().getFullYear());
  var achadas = pastaRaiz.getFoldersByName(ano);
  return achadas.hasNext() ? achadas.next() : pastaRaiz.createFolder(ano);
}

/* =========================================
 * MONTAGEM DO TEXTO
 * ========================================= */

function declPeriodoValido_(p) {
  var chave = declTexto_(p).toUpperCase();
  return Object.prototype.hasOwnProperty.call(DECL_PERIODOS, chave) ? chave : null;
}

/**
 * O primeiro parágrafo da declaração — a única parte que varia.
 *
 * @param {{nome:string, dataLiberacao:*, periodo:string}} p
 * @return {string}
 */
function declMontarTexto_(p) {
  p = p || {};
  var nome = declTexto_(p.nome).toUpperCase();
  var periodo = declPeriodoValido_(p.periodo) || "";
  var trecho = DECL_PERIODOS[periodo].trecho;
  var dia = declDataExtenso_(p.dataLiberacao);

  /* "diretor", fixo — não o cargo da pessoa. Ver a nota do cabeçalho. */
  return "Declaramos, para os devidos fins e efeitos legais a que se destina, que " +
    nome + ", diretor desta Entidade Sindical, no dia " + dia + trecho +
    ", estará à disposição do SindEducação/ES para o exercício de atividades " +
    "inerentes ao seu mandato sindical.";
}

/* =========================================
 * VALIDAÇÃO COMPARTILHADA (prévia e emissão)
 * ========================================= */

function declValidarPedido_(dados) {
  dados = dados || {};

  var diretor = declDiretorPorId_(dados.diretorId);
  if (!diretor) return { ok: false, mensagem: "Selecione o diretor." };
  if (!diretor.ativo) return { ok: false, mensagem: "Este diretor está inativo no cadastro da Diretoria." };
  if (!diretor.mandatoVigente) {
    return {
      ok: false,
      mensagem: "O mandato de " + diretor.nome + " não está vigente (" +
                (diretor.mandatoInicio || "sem início") + " a " +
                (diretor.mandatoFim || "sem fim") + "). Corrija o cadastro antes de emitir."
    };
  }

  var dataLib = declSoData_(dados.dataLiberacao);
  if (!dataLib) return { ok: false, mensagem: "Informe a data da liberação." };

  /* O MANDATO SE CONFERE CONTRA O DIA DA LIBERAÇÃO, NÃO CONTRA HOJE.
   *
   * A checagem acima (`mandatoVigente`) pergunta se a gestão está de pé
   * agora — e é dela que sai a lista de quem pode receber. Não é a mesma
   * pergunta: uma liberação marcada para depois do término do mandato
   * passava sem aviso, e a declaração afirmaria que a pessoa estará à
   * disposição da entidade num dia em que já não é dirigente.
   *
   * É exatamente o erro que o módulo nasceu para impedir, e ele sobrevivia
   * porque as duas datas nunca eram comparadas entre si. Corrigido em
   * 15/09/2026. */
  var mandatoInicio = declSoData_(diretor.mandatoInicio);
  var mandatoFim    = declSoData_(diretor.mandatoFim);
  if (mandatoInicio && dataLib < mandatoInicio) {
    return {
      ok: false,
      mensagem: "A liberação está marcada para " + declDataBR_(dataLib) + ", antes da posse de " +
                diretor.nome + " em " + diretor.mandatoInicio + "."
    };
  }
  if (mandatoFim && dataLib > mandatoFim) {
    return {
      ok: false,
      mensagem: "A liberação está marcada para " + declDataBR_(dataLib) + ", depois do término do mandato de " +
                diretor.nome + " em " + diretor.mandatoFim + ". A declaração afirmaria algo que não será verdade naquele dia."
    };
  }

  var periodo = declPeriodoValido_(dados.periodo);
  if (periodo === null) return { ok: false, mensagem: "Período inválido." };

  var dataEmi = declSoData_(dados.dataEmissao) || declHoje_();

  var contexto = declContextoDiretor_interno_(diretor);
  var escolaId = declTexto_(dados.escolaId);
  var escola = contexto.vinculos.filter(function (v) { return v.escolaId === escolaId; })[0];

  /* ESCOLHA MANUAL — a saída para quem o vínculo não acha.
   *
   * O vínculo liga Governança a Associados por nome normalizado idêntico.
   * Basta um nome abreviado, um sobrenome faltando ou um nome social para
   * o dirigente ficar SEM NENHUMA escola — e, até 15/09/2026, sem nenhuma
   * forma de emitir. No Word sempre deu para fazer; o sistema não podia ser
   * o que passou a impedir.
   *
   * A escola escolhida à mão vale, e fica gravada dizendo que foi escolhida
   * à mão (coluna VINCULO_ORIGEM). É a REGRA Nº 0.6 nos dois sentidos: o
   * sistema sugere o que sabe, e não esconde o que não sabia. */
  if (!escola && escolaId) escola = declEscolaDoCadastro_(escolaId, diretor);
  if (!escola) return { ok: false, mensagem: "Selecione a escola empregadora do dirigente." };

  var signatario = declSignatario_();
  if (!signatario) {
    return {
      ok: false,
      mensagem: "Não há Presidente com mandato vigente na composição de Governança — e declaração sem assinatura não vale nada. Corrija a composição em Governança antes de emitir."
    };
  }

  return {
    ok: true,
    diretor: diretor,
    signatario: signatario,
    dataLiberacao: dataLib,
    dataEmissao: dataEmi,
    periodo: periodo,
    contexto: contexto,
    escola: escola,
    texto: declMontarTexto_({
      nome: diretor.nome,
      dataLiberacao: dataLib,
      periodo: periodo
    })
  };
}

/**
 * O que merece um alerta sem impedir a emissão.
 *
 * DATA PASSADA AVISA, NÃO BLOQUEIA — decisão do usuário em 15/09/2026, pelo
 * mesmo motivo da duplicata: regularizar uma liberação que já aconteceu e
 * ninguém documentou é caso real. Recusar obrigaria a resolver por fora do
 * sistema, que é pior do que um documento com data antiga e registro.
 *
 * O que ele evita é o outro caso, muito mais comum: o engano de digitação
 * que passaria despercebido.
 */
function declAvisos_(v) {
  var avisos = [];
  if (v.dataLiberacao < declHoje_()) {
    avisos.push("A data da liberação (" + declDataBR_(v.dataLiberacao) + ") já passou. " +
                "Confira se não foi engano de digitação — se for regularização, pode emitir.");
  }
  if (v.dataEmissao.getFullYear() !== new Date().getFullYear()) {
    avisos.push("A data de emissão é de " + v.dataEmissao.getFullYear() +
                ", então o número sairá na sequência daquele ano.");
  }
  return avisos;
}

/** Declarações já emitidas para o mesmo diretor no mesmo dia. */
function declDuplicatas_(diretorId, dataLiberacao) {
  var alvo = declDataBR_(dataLiberacao);
  return declEmissoes_interno_().filter(function (e) {
    return e.diretorId === declTexto_(diretorId) && e.dataLiberacao === alvo;
  });
}

/* =========================================
 * ENDPOINTS
 * ========================================= */

/** Dados de abertura da tela: quem pode receber declaração e quem assina. */
function declDadosEmissao(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var signatario = declSignatario_();
    return {
      ok: true,
      /* EM ORDEM ALFABÉTICA — pedido do usuário em 15/09/2026, com a tela no
         ar. A ordem de Governança é hierárquica (órgão, condição, ordem), que
         é a certa para ler a composição e a errada para achar uma pessoa numa
         lista de 26 nomes. Quem abre esta tela já sabe o nome de quem vai
         liberar; o cargo continua ao lado para desempatar homônimo. */
      diretores: declDiretoresHabilitados_().map(function (d) {
        return { id: d.id, nome: d.nome, cargo: d.cargo, mandatoFim: d.mandatoFim };
      }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), "pt-BR"); }),
      periodos: Object.keys(DECL_PERIODOS).map(function (k) {
        return { valor: k, rotulo: DECL_PERIODOS[k].rotulo };
      }),
      signatario: signatario ? { nome: signatario.nome, cargo: signatario.cargo } : null,
      gestao: (typeof GOV_MANDATO !== "undefined") ? GOV_MANDATO.gestao : "",
      hoje: declDataBR_(declHoje_())
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao carregar a tela: " + e.message, diretores: [] };
  }
}

/** Prévia do texto. Não grava nada e não gera PDF. */
function declPreviaDeclaracaoDiretor(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var v = declValidarPedido_(dados);
    if (!v.ok) return v;

    var dup = declDuplicatas_(v.diretor.id, v.dataLiberacao);
    return {
      ok: true,
      texto: v.texto,
      avisos: declAvisos_(v),
      cidadeData: DECL_CIDADE + ", " + declDataExtenso_(v.dataEmissao) + ".",
      signatario: { nome: v.signatario.nome, cargo: v.signatario.cargo },
      escola: v.escola,
      duplicatas: dup.map(function (d) { return d.numero; })
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar a prévia: " + e.message };
  }
}

/**
 * O documento montado, sem gravar nada e sem gerar PDF.
 *
 * Mesma função que produz o PDF (`declHtmlDeclaracao_`), para a prévia não
 * poder divergir do que sai assinado — prévia montada por outro caminho é
 * prévia que mente. O número sai como "PRÉVIA" porque número só se consome
 * na emissão, dentro do lock.
 */
function declPreviaDocumento(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var v = declValidarPedido_(dados);
    if (!v.ok) return v;
    return {
      ok: true,
      html: declHtmlDeclaracao_({
        numero: "PRÉVIA",
        texto: v.texto,
        dataEmissao: v.dataEmissao,
        signatario: v.signatario,
        diretor: v.diretor
      })
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar o documento: " + e.message };
  }
}

/**
 * Emite: gera o PDF, grava a linha e registra na trilha de auditoria.
 *
 * ORDEM PROPOSITAL — PDF primeiro, linha depois. Se o Drive falhar, nada é
 * gravado e nenhum número é consumido (o número deriva das linhas). O
 * contrário produziria declaração registrada sem documento, que é pior de
 * descobrir do que um erro na hora.
 */
function declEmitirDeclaracaoDiretor(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) {
      return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    }

    var v = declValidarPedido_(dados);
    if (!v.ok) return v;

    var dup = declDuplicatas_(v.diretor.id, v.dataLiberacao);
    if (dup.length && (dados || {}).confirmado !== true) {
      return {
        ok: false,
        precisaConfirmar: true,
        duplicatas: dup.map(function (d) { return d.numero; }),
        mensagem: "Já existe declaração para " + v.diretor.nome + " no dia " +
                  declDataBR_(v.dataLiberacao) + " (nº " +
                  dup.map(function (d) { return d.numero; }).join(", ") +
                  "). Confirme para emitir outra via."
      };
    }

    /* O NÚMERO SEGUE A DATA DE EMISSÃO, não o relógio.
     *
     * A data de emissão é editável — é ela que sai escrita no documento. Com
     * o número vindo do ano corrente, emitir com data de 2025 produzia
     * "00X/2026" num papel datado de 2025. Quem for conferir daqui a dois
     * anos vai olhar a data, não o dia em que alguém digitou. Decisão do
     * usuário em 15/09/2026. */
    var numero = declProximoNumero_(v.dataEmissao.getFullYear());

    var pdf = declGerarPdf_({
      numero: numero,
      texto: v.texto,
      dataEmissao: v.dataEmissao,
      signatario: v.signatario,
      diretor: v.diretor
    });

    var sh = declGarantirEmissoes_();
    var mapa = declCabecalho_(sh);
    var linha = sh.getLastRow() + 1;
    var quem = declQuem_(sessao);

    var valores = {
      NUMERO: numero,
      DIRETOR_ID: v.diretor.id,
      DIRETOR_NOME: v.diretor.nome,
      CARGO: v.diretor.cargo,
      DATA_LIBERACAO: v.dataLiberacao,
      PERIODO: v.periodo,
      DATA_EMISSAO: v.dataEmissao,
      SIGNATARIO: v.signatario.nome,
      TEXTO: v.texto,
      PDF_ID: pdf.id,
      PDF_URL: pdf.url,
      EMITIDO_POR: quem,
      EMITIDO_EM: new Date(),
      GESTAO: v.diretor.gestao || "",
      ORGAO: v.diretor.orgao || "",
      CONDICAO: v.diretor.condicao || "",
      ESCOLA_ID: v.escola.escolaId,
      ESCOLA_NOME: v.escola.nome,
      ESCOLA_DOCUMENTO: v.escola.documento || "",
      VINCULO_ORIGEM: v.escola.vinculoOrigem || "",
      CONTATOS_ORIGEM: JSON.stringify(v.escola.contatos || []),
      EMAIL_STATUS: "AGUARDANDO_CONFERENCIA",
      WHATSAPP_STATUS: "NAO_PREPARADO"
    };
    Object.keys(valores).forEach(function (k) {
      if (mapa[k]) sh.getRange(linha, mapa[k]).setValue(valores[k]);
    });

    declAuditar_({
      sessao: sessao,
      registroId: numero,
      acao: "DECLARACAO_DIRETOR_EMITIDA",
      documento: pdf.url,
      valorNovo: v.diretor.nome + " · " + declDataBR_(v.dataLiberacao) +
                 " · " + (DECL_PERIODOS[v.periodo] || DECL_PERIODOS[""]).rotulo
    });

    return {
      ok: true,
      numero: numero,
      url: pdf.url,
      texto: v.texto,
      escola: v.escola,
      emailStatus: "AGUARDANDO_CONFERENCIA",
      mensagem: "Declaração " + numero + " emitida."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao emitir: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (eRel) {}
  }
}

/* =========================================
 * VÍNCULO, ESCOLA E ENTREGA
 * ========================================= */

/* ════════════════════════════════════════════════════════════════════════
 * MEMÓRIA DE EXECUÇÃO — por que estas três variáveis existem
 *
 * O usuário relatou em 15/09/2026, com a tela no ar: "está demorando buscar
 * os empregadores". Estava, e dava para medir por leitura:
 *
 *   `declContatosEscola_` lia a aba Controle INTEIRA — todas as linhas, todas
 *   as colunas — UMA VEZ PARA CADA ESCOLA candidata. Um dirigente com três
 *   vínculos custava três varreduras completas da maior aba do sistema. E
 *   `ofDest_historico_` era consultado de novo a cada e-mail repetido.
 *
 * O escopo global do Apps Script morre no fim de cada execução, então isto
 * NÃO é cache entre chamadas — é memória de UMA chamada. Não há o que
 * invalidar e não há risco de servir dado velho: a próxima execução começa
 * com tudo vazio de novo.
 * ════════════════════════════════════════════════════════════════════════ */

var DECL_MEMO_CONTROLE = null;   /* índice escola normalizada -> e-mails      */
var DECL_MEMO_ESCOLAS  = null;   /* cadastro de Escolas já lido                */
var DECL_MEMO_HISTORICO = {};    /* e-mail -> falhas/confirmações dos Ofícios   */

/** O cadastro de Escolas, lido uma vez por execução. */
function declEscolas_() {
  if (DECL_MEMO_ESCOLAS) return DECL_MEMO_ESCOLAS;
  DECL_MEMO_ESCOLAS = (typeof listarEscolasCadastro_interno_ === "function")
    ? (listarEscolasCadastro_interno_() || []) : [];
  return DECL_MEMO_ESCOLAS;
}

/**
 * A aba Controle virada do avesso: de "linhas" para "escola → e-mails".
 *
 * Uma varredura só, na primeira escola que precisar. Da segunda em diante é
 * consulta em objeto.
 */
function declControleIndex_() {
  if (DECL_MEMO_CONTROLE) return DECL_MEMO_CONTROLE;
  DECL_MEMO_CONTROLE = {};
  try {
    var sh = declPlanilha_().getSheetByName(
      (typeof PLANILHA_REGISTRO !== "undefined" && PLANILHA_REGISTRO) || "Controle");
    if (!sh || sh.getLastRow() < 2) return DECL_MEMO_CONTROLE;

    var hm = declCabecalho_(sh);
    var cEscola = hm.ESCOLA || hm["ESCOLA (RAZÃO SOCIAL)"] || hm.UNIDADE;
    var cEmails = hm.EMAILS_TODOS || hm["E-MAILS (TODOS)"] || hm.EMAIL || hm["E-MAIL"];
    if (!cEscola || !cEmails) return DECL_MEMO_CONTROLE;

    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function (l) {
      var chave = declNormalizar_(l[cEscola - 1]);
      if (!chave) return;
      if (!DECL_MEMO_CONTROLE[chave]) DECL_MEMO_CONTROLE[chave] = [];
      DECL_MEMO_CONTROLE[chave].push(l[cEmails - 1]);
    });
  } catch (e) {
    Logger.log("Declaração: leitura da Controle indisponível — " + e.message);
  }
  return DECL_MEMO_CONTROLE;
}

/** Histórico de entrega do e-mail, perguntado uma vez por execução. */
function declHistoricoEmail_(email) {
  if (Object.prototype.hasOwnProperty.call(DECL_MEMO_HISTORICO, email)) return DECL_MEMO_HISTORICO[email];
  var h = { falhas: 0, confirmacoes: 0 };
  try {
    if (typeof ofDest_historico_ === "function") {
      var r = ofDest_historico_(email) || {};
      h = { falhas: r.falhas || 0, confirmacoes: r.confirmacoes || 0 };
    }
  } catch (e) {}
  DECL_MEMO_HISTORICO[email] = h;
  return h;
}

function declNormalizar_(v) {
  return String(v || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function declContextoDiretor_interno_(diretor) {
  if (typeof assoc_todos_ !== "function") throw new Error("A base de Associados não está disponível.");
  var chave = declNormalizar_(diretor && diretor.nome);
  var associados = assoc_todos_().filter(function (a) { return declNormalizar_(a.nome) === chave; });
  var escolas = declEscolas_();
  var porId = {};

  associados.forEach(function (a) {
    var esc = declNormalizar_(a.escola);
    if (!esc) return;
    var candidatas = escolas.filter(function (e) {
      return [e.NomeEscola, e.Fantasia, e.escola, e.CodigoInterno]
        .some(function (n) { return declNormalizar_(n) === esc; });
    });
    candidatas.forEach(function (e) {
      var id = declTexto_(e.escolaId || e.EscolaID || e.linha);
      if (!id || porId[id]) return;
      porId[id] = {
        escolaId: id,
        nome: declTexto_(e.NomeEscola || e.escola),
        fantasia: declTexto_(e.Fantasia),
        documento: declTexto_(e.CNPJ || e.cnpj),
        vinculoOrigem: "Associados",
        telefoneDiretor: declTexto_(a.celular),
        contatos: declContatosEscola_(e)
      };
    });
  });

  return { diretorId: diretor.id, associadosEncontrados: associados.length, vinculos: Object.keys(porId).map(function (k) { return porId[k]; }) };
}

/**
 * O celular do dirigente, achado em Associados pelo nome.
 *
 * Fora de `declContextoDiretor_interno_` de propósito: o telefone é da
 * PESSOA, não do vínculo com a escola. Preso ao vínculo, o WhatsApp deixava
 * de funcionar justamente para quem precisou escolher a escola à mão.
 */
function declCelularDoDiretor_(diretor) {
  try {
    if (typeof assoc_todos_ !== "function") return "";
    var chave = declNormalizar_(diretor && diretor.nome);
    var achados = assoc_todos_().filter(function (a) {
      return declNormalizar_(a.nome) === chave && String(a.celular || "").replace(/\D/g, "").length >= 10;
    });
    return achados.length ? declTexto_(achados[0].celular) : "";
  } catch (e) {
    Logger.log("DeclaracaoDiretor: celular do dirigente indisponível — " + e.message);
    return "";
  }
}

/** Uma escola do cadastro no mesmo formato de um vínculo, marcada como manual. */
function declEscolaDoCadastro_(escolaId, diretor) {
  escolaId = declTexto_(escolaId);
  var achadas = declEscolas_().filter(function (e) {
    return declTexto_(e.escolaId || e.EscolaID || e.linha) === escolaId;
  });
  if (!achadas.length) return null;
  return declEscolaComoVinculo_(achadas[0], diretor, "Escolhida manualmente");
}

function declEscolaComoVinculo_(e, diretor, origem) {
  return {
    escolaId: declTexto_(e.escolaId || e.EscolaID || e.linha),
    nome: declTexto_(e.NomeEscola || e.escola),
    fantasia: declTexto_(e.Fantasia || e.fantasia),
    documento: declTexto_(e.CNPJ || e.cnpj),
    vinculoOrigem: origem,
    telefoneDiretor: declCelularDoDiretor_(diretor),
    contatos: declContatosEscola_(e)
  };
}

/**
 * Busca no cadastro de Escolas, para quando o vínculo não achou nada.
 *
 * Reaproveita `buscarEscolasPorTermo_interno_` (BuscaEscola.gs), que já
 * pontua nome, fantasia, CNPJ, cidade e e-mail — reimplementar busca de
 * escola aqui seria uma segunda regra de pesquisa se afastando da primeira.
 */
function declBuscarEscolas(termo, diretorId, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    if (typeof buscarEscolasPorTermo_interno_ !== "function") {
      return { ok: false, escolas: [], mensagem: "A busca de escolas não está disponível neste projeto." };
    }
    termo = declTexto_(termo);
    if (termo.length < 2) return { ok: true, escolas: [] };

    var diretor = declDiretorPorId_(diretorId);
    var achadas = (buscarEscolasPorTermo_interno_(termo) || []).slice(0, 12).map(function (e) {
      return declEscolaComoVinculo_(e, diretor, "Escolhida manualmente");
    }).filter(function (v) { return !!v.escolaId; });

    return { ok: true, escolas: achadas };
  } catch (e) {
    return { ok: false, escolas: [], mensagem: "Erro na busca: " + e.message };
  }
}

function declContatosEscola_(escola) {
  var mapa = {};
  function juntar(valor, origem) {
    String(valor || "").split(/[;,\n]/).forEach(function (email) {
      email = String(email || "").trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
      if (!mapa[email]) mapa[email] = { email: email, origens: [], falhas: 0, confirmacoes: 0 };
      if (mapa[email].origens.indexOf(origem) < 0) mapa[email].origens.push(origem);
      var h = declHistoricoEmail_(email);
      mapa[email].falhas = h.falhas;
      mapa[email].confirmacoes = h.confirmacoes;
    });
  }
  juntar(escola.Email || escola.email, "Escolas · principal");
  juntar(escola.EmailsTodos, "Escolas · todos");
  /* A Controle pode conter endereços usados depois da última atualização do
     cadastro. O índice já está pronto — ver DECL_MEMO_CONTROLE. */
  var indice = declControleIndex_();
  [escola.NomeEscola, escola.escola, escola.Fantasia, escola.CodigoInterno]
    .map(declNormalizar_).filter(Boolean)
    .forEach(function (alvo) {
      (indice[alvo] || []).forEach(function (emails) { juntar(emails, "Controle · histórico"); });
    });
  /* Falhas e confirmações vêm da mesma memória usada pelos Ofícios; assim o
     conhecimento operacional não é duplicado. */
  return Object.keys(mapa).map(function (k) {
    var c = mapa[k]; c.marcado = c.falhas === 0; return c;
  });
}

function declContextoDiretor(diretorId, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  var diretor = declDiretorPorId_(diretorId);
  if (!diretor || diretor.fonte !== "GOVERNANCA") return { ok: false, mensagem: "Dirigente vigente não encontrado em Governança." };
  var r = declContextoDiretor_interno_(diretor); r.ok = true; return r;
}

function declAcharEmissao_(numero) {
  var sh = declGarantirEmissoes_(), hm = declCabecalho_(sh);
  if (sh.getLastRow() < 2) return null;
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) if (declTexto_(dados[i][hm.NUMERO - 1]) === declTexto_(numero)) return { sh: sh, hm: hm, linha: i + 2, valores: dados[i] };
  return null;
}

/**
 * Reabre a entrega de uma declaração já emitida — só lê, não envia nada.
 *
 * OS CONTATOS SAEM DA LINHA, não de uma nova varredura de Associados e
 * Escolas. É a conferência congelada no dia da emissão, que é exatamente o
 * conjunto que `declEnviarEmail` aceita logo abaixo. Reconsultar o cadastro
 * aqui traria endereços que ninguém conferiu para dentro de um documento
 * assinado — e ainda faria a trava de destinatário divergir da tela.
 *
 * Existe porque, até 15/09/2026, a entrega só aparecia logo depois de emitir:
 * fechar a tela deixava a declaração parada em AGUARDANDO_CONFERENCIA sem
 * nenhum caminho de volta.
 */
function declEntregaDeclaracao(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var achado = declAcharEmissao_(numero);
    if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };

    function campo(nome) {
      return achado.hm[nome] ? declTexto_(achado.valores[achado.hm[nome] - 1]) : "";
    }

    var contatos = [];
    try {
      contatos = JSON.parse(campo("CONTATOS_ORIGEM") || "[]") || [];
    } catch (eJson) {
      contatos = [];
    }

    return {
      ok: true,
      numero: campo("NUMERO"),
      diretorNome: campo("DIRETOR_NOME"),
      escola: {
        escolaId: campo("ESCOLA_ID"),
        nome: campo("ESCOLA_NOME"),
        documento: campo("ESCOLA_DOCUMENTO"),
        vinculoOrigem: campo("VINCULO_ORIGEM"),
        contatos: contatos
      },
      pdfUrl: campo("PDF_URL"),
      emailStatus: campo("EMAIL_STATUS"),
      emailsUsados: campo("EMAILS_USADOS"),
      whatsappStatus: campo("WHATSAPP_STATUS")
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao abrir a entrega: " + e.message };
  }
}

function declEnviarEmail(numero, emails, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  var achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var validacao = validarListaEmails_(Array.isArray(emails) ? emails.join(";") : emails);
  if (!validacao.ok || !validacao.emails.length) return { ok: false, mensagem: "Selecione ao menos um e-mail válido." };
  var permitidos = [];
  try {
    permitidos = JSON.parse(declTexto_(achado.valores[achado.hm.CONTATOS_ORIGEM - 1]) || "[]")
      .map(function (c) { return String(c.email || "").trim().toLowerCase(); });
  } catch (eContatos) {}
  var foraDaConferencia = validacao.emails.filter(function (e) { return permitidos.indexOf(String(e).toLowerCase()) < 0; });
  if (foraDaConferencia.length) return { ok: false, mensagem: "Destinatário não pertence à conferência desta declaração." };

  var ambiente = String(getAmbienteAtual() || "producao").toLowerCase();
  var destinoReal = validacao.todos;
  var destinoEnvio = ambiente === "homologacao" ? OFICIOS_HML_EMAIL_PADRAO_TESTE : destinoReal;
  var pdfId = declTexto_(achado.valores[achado.hm.PDF_ID - 1]);
  var nome = declTexto_(achado.valores[achado.hm.DIRETOR_NOME - 1]);
  var escola = declTexto_(achado.valores[achado.hm.ESCOLA_NOME - 1]);
  var assunto = "Declaração " + numero + " — " + nome;
  var html = "<p>Prezados(as),</p><p>Segue, em anexo, a declaração de liberação sindical de <strong>" + declEscapar_(nome) + "</strong>.</p><p>Atenciosamente,<br>SindEducação-ES</p>";
  if (ambiente === "homologacao") html = "<p><strong>HOMOLOGAÇÃO.</strong> Destinatário real: " + declEscapar_(destinoReal) + "</p>" + html;
  try {
    var op = montarOpcoesEmailSISGEP_(declQuem_(sessao), html, [DriveApp.getFileById(pdfId).getBlob()], assunto, destinoEnvio);
    MailApp.sendEmail(op);
    achado.sh.getRange(achado.linha, achado.hm.EMAILS_USADOS).setValue(destinoReal);
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_STATUS).setValue(ambiente === "homologacao" ? "TESTE_HML_ENVIADO" : "ENVIADO");
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_ENVIADO_EM).setValue(new Date());
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_ENVIADO_POR).setValue(declQuem_(sessao));
    declAuditar_({ sessao: sessao, registroId: numero, acao: "DECLARACAO_EMAIL_ENVIADO", documento: escola, valorNovo: ambiente === "homologacao" ? "TESTE_HML" : "ENVIADO" });
    return { ok: true, mensagem: ambiente === "homologacao" ? "Teste enviado à Secretaria. A escola real não recebeu." : "Declaração enviada à escola.", destinoReal: destinoReal, destinoUtilizado: destinoEnvio };
  } catch (e) {
    achado.sh.getRange(achado.linha, achado.hm.EMAIL_STATUS).setValue("ERRO");
    return { ok: false, mensagem: "Falha no envio: " + e.message };
  }
}

function declPrepararWhatsapp(numero, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false), achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var diretor = declDiretorPorId_(declTexto_(achado.valores[achado.hm.DIRETOR_ID - 1]));
  /* O telefone é da pessoa, não do vínculo — ver declCelularDoDiretor_. */
  var fone = String(declCelularDoDiretor_(diretor) || "").replace(/\D/g, "");
  if (fone.length < 10) return { ok: false, mensagem: "O diretor não possui celular válido em Associados." };
  if (fone.length <= 11) fone = "55" + fone;
  var urlPdf = declTexto_(achado.valores[achado.hm.PDF_URL - 1]);
  var msg = "Olá! A declaração " + numero + " foi emitida para ciência. PDF: " + urlPdf;
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_STATUS).setValue("PREPARADO");
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_EM).setValue(new Date());
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_POR).setValue(declQuem_(sessao));
  return { ok: true, url: "https://wa.me/" + fone + "?text=" + encodeURIComponent(msg), mensagem: msg };
}

function declConfirmarWhatsapp(numero, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false), achado = declAcharEmissao_(numero);
  if (!achado) return { ok: false, mensagem: "Declaração não encontrada." };
  var atual = declTexto_(achado.valores[achado.hm.WHATSAPP_STATUS - 1]);
  if (atual !== "PREPARADO") return { ok: false, mensagem: "Prepare a mensagem antes de confirmar o envio." };
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_STATUS).setValue("ENVIADO_CONFIRMADO");
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_EM).setValue(new Date());
  achado.sh.getRange(achado.linha, achado.hm.WHATSAPP_POR).setValue(declQuem_(sessao));
  declAuditar_({ sessao: sessao, registroId: numero, acao: "DECLARACAO_WHATSAPP_CONFIRMADO" });
  return { ok: true, mensagem: "Ciência por WhatsApp registrada." };
}

function declHistoricoDeclaracoes(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    filtros = filtros || {};
    var busca = declTexto_(filtros.busca).toUpperCase();
    var de    = declSoData_(filtros.de);
    var ate   = declSoData_(filtros.ate);

    var itens = declEmissoes_interno_().filter(function (e) {
      if (busca) {
        var alvo = (e.diretorNome + " " + e.numero + " " + e.dataLiberacao).toUpperCase();
        if (alvo.indexOf(busca) < 0) return false;
      }
      if (de || ate) {
        var d = declSoData_(e.dataLiberacao);
        if (!d) return false;
        if (de && d < de) return false;
        if (ate && d > ate) return false;
      }
      return true;
    });

    itens.reverse(); // mais recente primeiro
    return { ok: true, itens: itens, total: itens.length };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar: " + e.message, itens: [] };
  }
}

/* =========================================
 * PDF
 * ========================================= */

/**
 * Gera o PDF e devolve { id, url }.
 *
 * Isolada de propósito: é a única parte do fluxo que depende de Drive e do
 * conversor de HTML, que o emulador de teste não reproduz. Separada assim, o
 * teste cobre número, texto, duplicata, registro e auditoria de verdade, e o
 * PDF em si fica honestamente marcado como "não testado" até alguém emitir
 * uma declaração no ar.
 */
function declGerarPdf_(p) {
  p = p || {};
  var html = declHtmlDeclaracao_(p);
  var nome = "Declaracao_" + String(p.numero).replace("/", "-") + "_" +
             declTexto_(p.diretor && p.diretor.nome).split(" ")[0];

  var blob = HtmlService.createHtmlOutput(html)
    .getBlob()
    .getAs("application/pdf")
    .setName(nome + ".pdf");

  var pasta = declPastaDestino_();
  var arquivo = pasta.createFile(blob);

  try {
    if (typeof arquivoAplicarPolitica_ === "function") {
      arquivoAplicarPolitica_(arquivo, "Declaração de Diretor " + p.numero);
    }
  } catch (e) {
    Logger.log("DeclaracaoDiretor: política de compartilhamento falhou — " + e.message);
  }

  return { id: arquivo.getId(), url: arquivo.getUrl() };
}

/**
 * O documento em si. Espelha o modelo em papel: título centralizado, corpo
 * justificado, citação do art. 543 recuada e menor, fecho, cidade/data e
 * assinatura.
 */
/**
 * Logo e assinatura em base64, prontas para entrar no HTML.
 *
 * 🚨 O LOGO DO `carregarImagensRecibo_` É UM PDF. Medido em 15/09/2026 pelo
 * metadado do Drive: o arquivo `1F1yUL…` é `Logo.pdf`, application/pdf, 80 KB.
 * Aquela função devolve o blob com o contentType real, e quem monta o HTML
 * escreve `<img src="data:application/pdf;base64,…">` — que NÃO renderiza em
 * navegador nenhum nem no conversor do Google.
 *
 * O efeito é o pior tipo: o documento sai assinado, sem logo, e sem uma linha
 * de erro em lugar nenhum. Ninguém olha o log de um PDF que "saiu".
 *
 * Por isso aqui: só entra como imagem o que TEM mime de imagem. O logo bom é
 * o PNG que os Vouchers já usam (LOGO_VOUCHER_FILE_ID) — mesma arte, uma
 * fonte só. Se nenhum servir, o cabeçalho cai no texto, que é feio mas
 * honesto.
 *
 * Falha aqui nunca derruba a emissão: declaração sem logo ainda vale;
 * emissão que explode porque o Drive piscou, não.
 */
function declImagens_() {
  var out = { logoBase64: "", logoMime: "", assBase64: "", assMime: "" };

  try {
    if (typeof carregarImagensRecibo_ === "function") {
      var imgs = carregarImagensRecibo_() || {};
      out.assBase64 = imgs.assBase64 || "";
      out.assMime = imgs.assMime || "image/jpeg";
      if (/^image\//.test(String(imgs.logoMime || ""))) {
        out.logoBase64 = imgs.logoBase64 || "";
        out.logoMime = imgs.logoMime;
      }
    }
  } catch (e) {
    Logger.log("DeclaracaoDiretor: imagens institucionais indisponíveis — " + e.message);
  }

  if (!out.logoBase64 && typeof LOGO_VOUCHER_FILE_ID !== "undefined") {
    try {
      var blob = DriveApp.getFileById(LOGO_VOUCHER_FILE_ID).getBlob();
      var mime = blob.getContentType() || "";
      if (/^image\//.test(mime)) {
        out.logoBase64 = Utilities.base64Encode(blob.getBytes());
        out.logoMime = mime;
      }
    } catch (eLogo) {
      Logger.log("DeclaracaoDiretor: logo do Drive indisponível — " + eLogo.message);
    }
  }

  return out;
}

function declHtmlDeclaracao_(p) {
  p = p || {};
  var sig = p.signatario || {};
  var imgs = declImagens_();

  var logo = imgs.logoBase64
    ? '<img src="data:' + imgs.logoMime + ';base64,' + imgs.logoBase64 + '" style="max-height:90px;">'
    : '<div style="font-size:18px;font-weight:bold;color:#001f4d;">SindEducação/ES</div>';

  var assinaturaImg = imgs.assBase64
    ? '<img src="data:' + imgs.assMime + ';base64,' + imgs.assBase64 + '" style="max-height:70px;"><br>'
    : '<div style="height:52px;"></div>';

  return '' +
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@page { size: A4; margin: 2.5cm 2.5cm; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #111; line-height: 1.6; }' +
    '.cabecalho { text-align: center; margin-bottom: 26px; }' +
    '.titulo { text-align: center; font-size: 15pt; font-weight: bold; letter-spacing: 2px; margin: 26px 0 34px; }' +
    '.corpo { text-align: justify; margin-bottom: 18px; }' +
    '.citacao { text-align: justify; font-size: 10.5pt; margin: 16px 0 16px 2.2cm; color: #222; }' +
    '.fecho { margin-top: 26px; }' +
    '.local { margin-top: 30px; }' +
    '.assinatura { text-align: center; margin-top: 46px; }' +
    '.assinatura .nome { font-weight: bold; }' +
    '.rodape { margin-top: 40px; text-align: center; font-size: 8pt; color: #777; }' +
    '</style></head><body>' +
    '<div class="cabecalho">' + logo + '</div>' +
    '<div class="titulo">DECLARAÇÃO</div>' +
    '<div class="corpo">' + declEscapar_(p.texto) + '</div>' +
    '<div class="corpo">Nos termos do Artigo 543, da CLT, requeremos a liberação do empregado ' +
      'para o pleno exercício de seu mandato sindical, conforme lhe assegura a lei:</div>' +
    '<div class="citacao">' + declEscapar_(DECL_ART_543) + '</div>' +
    '<div class="fecho">Por ser verdade firmamos a presente.</div>' +
    '<div class="local">' + DECL_CIDADE + ', ' + declDataExtenso_(p.dataEmissao) + '.</div>' +
    '<div class="assinatura">' + assinaturaImg +
      '<div class="nome">' + declEscapar_(sig.nome || "") + '</div>' +
      '<div>' + declEscapar_(sig.cargo || "Presidente") + ' – SindEducação/ES</div>' +
    '</div>' +
    '<div class="rodape">Declaração nº ' + declEscapar_(p.numero || "") + ' · SISGEP</div>' +
    '</body></html>';
}

function declEscapar_(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================
 * AUDITORIA
 *
 * Nunca derruba a emissão. Documento assinado que não chega à escola porque
 * a trilha de auditoria estava fora do ar seria o defeito pior.
 * ========================================= */

function declAuditar_(dados) {
  try {
    if (typeof auditar_ !== "function") return;
    auditar_({
      sessao: dados.sessao,
      registroId: dados.registroId,
      modulo: "Documentos",
      submodulo: "Declarações",
      acao: dados.acao,
      documento: dados.documento || "",
      valorNovo: dados.valorNovo || "",
      origem: "PORTAL_ADMIN"
    });
  } catch (e) {
    Logger.log("DeclaracaoDiretor: auditoria falhou — " + e.message);
  }
}

/* =========================================
 * DIAGNÓSTICO — roda no editor do Apps Script, só lê.
 * ========================================= */

/**
 * O estado da configuração, em dados — uma fonte só para a tela e o editor.
 *
 * Nasceu em 15/09/2026, quando o usuário foi rodar `declDiagnosticoPasta_()`
 * no editor e ela não estava no seletor de funções: o Apps Script esconde
 * toda função terminada em `_`. Ele precisou colar um invólucro à mão, que o
 * deploy seguinte apagou. Diagnóstico que só roda com remendo não é
 * diagnóstico — por isso agora ele tem porta pela tela.
 */
function declDiagnostico_interno_() {
  var r = { pastaOk: false, pastaId: "", pastaNome: "", pastaErro: "", signatario: null, habilitados: 0 };
  try {
    r.pastaId = getRecursoId_("DECLARACOES");
    r.pastaNome = DriveApp.getFolderById(r.pastaId).getName();
    r.pastaOk = true;
  } catch (e) {
    r.pastaErro = e.message;
  }
  try {
    var s = declSignatario_();
    if (s) r.signatario = { nome: s.nome, cargo: s.cargo };
    r.habilitados = declDiretoresHabilitados_().length;
  } catch (eGov) {
    r.governancaErro = eGov.message;
  }
  return r;
}

/** Mesmo diagnóstico, pela tela. Só lê. */
function declConferirConfiguracao(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var d = declDiagnostico_interno_();
    return {
      ok: true,
      pronto: d.pastaOk && !!d.signatario && d.habilitados > 0,
      pasta: d.pastaOk
        ? { ok: true, texto: d.pastaNome, detalhe: d.pastaId }
        : { ok: false, texto: "Pasta não configurada neste ambiente",
            detalhe: "Configure a Script Property SISGEP_PASTA_DECLARACOES com o ID da pasta do Drive. " + d.pastaErro },
      signatario: d.signatario
        ? { ok: true, texto: d.signatario.nome, detalhe: d.signatario.cargo + " — de Governança" }
        : { ok: false, texto: "Nenhum Presidente vigente",
            detalhe: "Corrija a composição em Governança: sem signatário a declaração não vale." },
      dirigentes: { ok: d.habilitados > 0, texto: d.habilitados + " dirigente(s) habilitado(s)",
                    detalhe: "mandato vigente na composição de Governança" }
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao conferir: " + e.message };
  }
}

/** A mesma coisa no editor do Apps Script, para quem estiver com ele aberto. */
function declDiagnosticoPasta_() {
  var d = declDiagnostico_interno_();
  var linhas = [];
  if (d.pastaOk) {
    linhas.push("ID resolvido: " + d.pastaId);
    linhas.push("Pasta: " + d.pastaNome + " ✅ acessível");
  } else {
    linhas.push("❌ " + d.pastaErro);
    linhas.push("Configure a Script Property SISGEP_PASTA_DECLARACOES com o ID da pasta do Drive.");
  }
  linhas.push("Signatário: " + (d.signatario ? d.signatario.nome + " (" + d.signatario.cargo + ")" : "❌ ninguém marcado"));
  linhas.push("Diretores habilitados: " + d.habilitados);
  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
