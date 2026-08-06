// =========================
// ARQUIVO: PagamentosControle.gs
// MÓDULO: Financeiro › Despesas — Controle de Pagamentos
//
// POR QUE ESTE ARQUIVO EXISTE
// O ciclo da despesa no SISGEP ia de "cadastrada" direto para "paga".
// Quem executa o pagamento (Diretor Financeiro) lança no banco e depois
// depende da assinatura conjunta do presidente para o dinheiro sair —
// e esse intervalo não existia em lugar nenhum. Na prática ninguém
// sabia o que já tinha sido lançado e estava só esperando compensar,
// nem onde estava o comprovante de um pagamento feito mês passado.
//
// O QUE ESTE ARQUIVO ACRESCENTA
//   1. O estado LANCADO_BANCO, entre "a pagar" e "pago", com data e
//      responsável PRÓPRIOS — separados da data em que o banco pagou.
//      São duas perguntas diferentes: "eu já mandei?" e "já caiu?".
//   2. Um slot de anexo EXCLUSIVO do comprovante de pagamento. Antes
//      havia um único anexo por despesa, usado pela nota fiscal do
//      fornecedor — anexar o comprovante ali SOBRESCREVERIA a nota, e a
//      perda seria silenciosa.
//   3. Gravação de verdade da FORMA_PAGAMENTO e da CONTA_BANCARIA. A
//      tela antiga pedia "Banco / Forma" e enfiava o texto dentro do
//      campo de observações ("Banco: Sicoob | ..."), enquanto a coluna
//      FORMA_PAGAMENTO existia e nunca era escrita. Resultado: não dava
//      para filtrar nem somar por forma de pagamento.
//   4. Trilha de histórico em aba própria (DESPESAS_PAGAMENTOS_LOG):
//      um registro por evento, com quem fez, quando, valor e a
//      transição de status. É o que responde "o que foi lançado e se
//      foi pago" mesmo depois de a despesa mudar de mão.
//
// SOBRE AUTORIZAÇÃO — decisão explícita, não esquecimento
// A autorização do pagamento acontece FORA do SISGEP: toda despesa sai
// do banco com assinatura conjunta do Diretor Financeiro e do
// Presidente. Por isso este módulo NÃO cria um portão de aprovação
// próprio — duplicar um controle que o banco já faz seria burocracia
// sem ganho. O que o sistema faz é registrar e dar visibilidade.
//
// RELAÇÃO COM O QUE JÁ EXISTE — este arquivo NÃO substitui nada:
//   · marcarDespesaComoPaga (Despesas.gs) continua existindo e sendo
//     usada pela tela antiga e pela confirmação da contabilidade por
//     link público. Quem passa por lá também é registrado no log, por
//     pagRegistrarEvento_, para o histórico não ficar com buraco.
//   · obterHistoricoDespesa (Despesas.gs) deriva eventos dos campos da
//     própria linha. Continua valendo; o log daqui é mais detalhado e
//     cobre o que a linha não guarda (desfazer lançamento, troca de
//     comprovante, quem confirmou).
// =========================

var ABA_PAGAMENTOS_LOG = "DESPESAS_PAGAMENTOS_LOG";

// Colunas acrescentadas à aba DESPESAS. Migração idempotente, mesmo
// padrão de garantirColunasAprovacaoDesp_: só cria o que falta, nunca
// mexe no que já existe, não exige setup manual.
var COLUNAS_CONTROLE_PAGAMENTO_DESP = [
  "DATA_LANCAMENTO_BANCO",
  "LANCADO_BANCO_POR",
  "CONTA_BANCARIA",
  "PAGO_POR",
  "LINK_COMPROVANTE",
  "FILE_ID_COMPROVANTE",
  "NOME_ARQUIVO_COMPROVANTE",
  "DATA_COMPROVANTE",
  "COMPROVANTE_POR"
];

var PAG_FORMAS = ["PIX", "TED", "DOC", "Boleto", "Débito automático", "Dinheiro", "Cartão", "Outra"];

var PAG_EVENTOS = {
  LANCADO:            "LANCADO_BANCO",
  LANCAMENTO_DESFEITO:"LANCAMENTO_DESFEITO",
  PAGO:               "PAGAMENTO_CONFIRMADO",
  COMPROVANTE:        "COMPROVANTE_ANEXADO",
  COMPROVANTE_TROCADO:"COMPROVANTE_SUBSTITUIDO",
  ESTORNADO:          "ESTORNADO"
};

/* =========================================
 * MIGRAÇÃO E LOG
 * ========================================= */

function pagGarantirColunas_() {
  var aba = obterAbaDesp_();
  var ultimaCol = aba.getLastColumn();
  var cab = aba.getRange(1, 1, 1, ultimaCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var criou = false;
  COLUNAS_CONTROLE_PAGAMENTO_DESP.forEach(function (nome) {
    if (cab.indexOf(nome) === -1) {
      ultimaCol++;
      aba.getRange(1, ultimaCol).setValue(nome).setFontWeight("bold");
      cab.push(nome);
      criou = true;
    }
  });
  if (criou && typeof limparCacheHeader_ === "function") limparCacheHeader_(aba);
  return aba;
}

function pagGarantirLog_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_PAGAMENTOS_LOG);
  if (!sh) {
    sh = ss.insertSheet(ABA_PAGAMENTOS_LOG);
    var cab = [
      "ID_EVENTO", "DATA_HORA", "ID_DESPESA", "NUMERO_DESPESA", "FORNECEDOR",
      "EVENTO", "DE_STATUS", "PARA_STATUS", "VALOR",
      "DATA_REFERENCIA", "FORMA_PAGAMENTO", "CONTA_BANCARIA",
      "USUARIO", "DETALHE"
    ];
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight("bold").setBackground("#002f6c").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Grava um evento na trilha. NUNCA lança erro para fora: falhar ao
 * registrar histórico não pode impedir o pagamento em si de ser
 * gravado — mas fica no log do Apps Script para não sumir de vez.
 */
function pagRegistrarEvento_(dados) {
  try {
    dados = dados || {};
    var sh = pagGarantirLog_();
    sh.appendRow([
      "EVT-" + Utilities.getUuid().substring(0, 8).toUpperCase(),
      new Date(),
      String(dados.idDespesa || ""),
      String(dados.numeroDespesa || ""),
      String(dados.fornecedor || ""),
      String(dados.evento || ""),
      String(dados.deStatus || ""),
      String(dados.paraStatus || ""),
      String(dados.valor || ""),
      String(dados.dataReferencia || ""),
      String(dados.formaPagamento || ""),
      String(dados.contaBancaria || ""),
      String(dados.usuario || ""),
      String(dados.detalhe || "")
    ]);
    return true;
  } catch (e) {
    Logger.log("[PAG] falha ao registrar evento (não bloqueia a operação): " + e.message);
    return false;
  }
}

/* =========================================
 * HELPERS
 * ========================================= */

function pag_(despInfo, coluna) {
  var i = (despInfo.headerMap[coluna] || 0) - 1;
  return i > -1 ? String(despInfo.row[i] || "").trim() : "";
}

// Aceita "2026-08-05" (input date) ou "05/08/2026" e devolve sempre no
// formato brasileiro, que é como o resto do módulo Despesas grava data.
function pagDataBR_(valor) {
  var s = String(valor || "").trim();
  if (!s) return "";
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
  return s;
}

// Competência = "YYYY-MM". Compara contra a data de VENCIMENTO, que é
// como o financeiro enxerga o mês ("as contas de agosto"), não contra a
// data de cadastro nem a de pagamento.
function pagCompetenciaDaData_(dataBR) {
  var m = String(dataBR || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  return m[3] + "-" + m[2];
}

function pagNumero_(valor) {
  var n = parseFloat(String(valor || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

/**
 * Formata NÚMERO para o texto de valor usado na aba DESPESAS.
 *
 * ⚠️ Não use formatarValorDesp_ para isto. Aquela função foi escrita
 * para normalizar texto digitado e faz `replace(/[^\d,]/g, "")` — ela
 * DESCARTA o ponto decimal. Passar o número 1234.56 devolve
 * "R$ 123456,00", cem vezes o valor certo, sem erro nenhum na tela.
 * Aqui a formatação é direta, a partir do número.
 */
function pagValorBR_(n) {
  var v = Number(n || 0);
  if (!isFinite(v)) v = 0;
  return "R$ " + v.toFixed(2).replace(".", ",");
}

/* =========================================
 * AÇÃO 1 — LANÇAR NO BANCO
 * ========================================= */

/**
 * Marca que o pagamento foi lançado no banco e está aguardando a
 * assinatura conjunta / compensação. NÃO é pagamento: a data que entra
 * aqui é a do lançamento, e a data em que o dinheiro saiu é gravada
 * depois, em pagConfirmarPagamento.
 */
function pagLancarNoBanco(payload, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "financeiro", false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "Despesa não informada." };

    pagGarantirColunas_();
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var statusAtual = pag_(despInfo, "STATUS");
    if (statusAtual === STATUS_DESPESA.PAGO) return { ok: false, mensagem: "Esta despesa já está paga." };
    if (statusAtual === STATUS_DESPESA.CANCELADO) return { ok: false, mensagem: "Esta despesa está cancelada." };
    if (statusAtual === STATUS_DESPESA.ESTORNADO) return { ok: false, mensagem: "Esta despesa está estornada." };
    if (statusAtual === STATUS_DESPESA.LANCADO_BANCO) return { ok: false, mensagem: "Esta despesa já está lançada no banco." };

    // Aprovação vem antes do banco. Sem isto, o dinheiro saía sem passar por
    // quem autoriza — e o fluxo do item 11 do prompt mestre exige aprovar
    // antes de lançar. A aprovação não é um status: é a coluna
    // APROVADO_PARA_PAGAMENTO, gravada por aprovarDespesaParaPagamento.
    //
    // Despesa criada antes desta coluna existir chega aqui sem "SIM" e é
    // barrada — de propósito. A mensagem manda aprovar, que é um clique, e
    // aprovar deixa registrado quem autorizou. Melhor do que abrir exceção
    // para dado antigo e nunca mais saber quem liberou o quê.
    if (String(pag_(despInfo, "APROVADO_PARA_PAGAMENTO") || "").trim().toUpperCase() !== "SIM") {
      return { ok: false, mensagem: "Esta despesa ainda não foi aprovada para pagamento. Aprove antes de lançar no banco." };
    }

    var dataLancamento = pagDataBR_(payload.dataLancamento) || formatarDataBRDesp_(new Date());
    var conta          = String(payload.contaBancaria  || "").trim();
    var forma          = String(payload.formaPagamento || "").trim();
    var quem           = sessao.nome || sessao.usuario || sessao.email || "SISGEP";

    var campos = {
      "STATUS":                STATUS_DESPESA.LANCADO_BANCO,
      "DATA_LANCAMENTO_BANCO": dataLancamento,
      "LANCADO_BANCO_POR":     quem
    };
    if (conta) campos["CONTA_BANCARIA"]  = conta;
    if (forma) campos["FORMA_PAGAMENTO"] = forma;
    atualizarCamposDespesa_(idDespesa, campos);

    pagRegistrarEvento_({
      idDespesa: idDespesa, numeroDespesa: pag_(despInfo, "NUMERO_DESPESA"),
      fornecedor: pag_(despInfo, "PRESTADOR_NOME"), evento: PAG_EVENTOS.LANCADO,
      deStatus: statusAtual, paraStatus: STATUS_DESPESA.LANCADO_BANCO,
      valor: pag_(despInfo, "VALOR"), dataReferencia: dataLancamento,
      formaPagamento: forma, contaBancaria: conta, usuario: quem,
      detalhe: String(payload.observacao || "").trim()
    });

    return { ok: true, mensagem: "Lançado no banco em " + dataLancamento + ". Aguardando a assinatura e a compensação." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao lançar no banco: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/**
 * Desfaz o lançamento — o banco rejeitou, o presidente não assinou, ou
 * foi engano. Devolve a despesa para o estado anterior ao lançamento.
 * Exige motivo: um lançamento que "some" sem explicação é exatamente o
 * tipo de coisa que o Conselho Fiscal pergunta depois.
 */
function pagDesfazerLancamentoBanco(payload, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "financeiro", false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    var motivo    = String(payload.motivo    || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "Despesa não informada." };
    if (!motivo)    return { ok: false, mensagem: "Informe o motivo — é ele que explica o lançamento que sumiu do banco." };

    pagGarantirColunas_();
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var statusAtual = pag_(despInfo, "STATUS");
    if (statusAtual !== STATUS_DESPESA.LANCADO_BANCO) {
      return { ok: false, mensagem: "Só dá para desfazer o lançamento de uma despesa que está lançada no banco." };
    }

    // Volta para o estado do ciclo do DOCUMENTO em que ela estava: se já
    // tinha ido à contabilidade, volta para lá; se o documento já tinha
    // chegado, volta para DOC_RECEBIDO; senão, pendente. Assim desfazer
    // o lançamento não apaga o progresso do lado fiscal.
    var voltaPara = STATUS_DESPESA.PENDENTE;
    if (pag_(despInfo, "DATA_ENVIO_CONTABILIDADE")) voltaPara = STATUS_DESPESA.ENVIADO_CONTABILIDADE;
    else if (pag_(despInfo, "DATA_RECEBIMENTO_DOC")) voltaPara = STATUS_DESPESA.DOC_RECEBIDO;

    var quem = sessao.nome || sessao.usuario || sessao.email || "SISGEP";
    atualizarCamposDespesa_(idDespesa, {
      "STATUS":                voltaPara,
      "DATA_LANCAMENTO_BANCO": "",
      "LANCADO_BANCO_POR":     ""
    });

    pagRegistrarEvento_({
      idDespesa: idDespesa, numeroDespesa: pag_(despInfo, "NUMERO_DESPESA"),
      fornecedor: pag_(despInfo, "PRESTADOR_NOME"), evento: PAG_EVENTOS.LANCAMENTO_DESFEITO,
      deStatus: statusAtual, paraStatus: voltaPara, valor: pag_(despInfo, "VALOR"),
      usuario: quem, detalhe: motivo
    });

    return { ok: true, mensagem: "Lançamento desfeito. A despesa voltou para a fila de pagamento." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao desfazer o lançamento: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/* =========================================
 * AÇÃO 2 — CONFIRMAR PAGAMENTO
 * ========================================= */

/**
 * Confirma que o dinheiro saiu. Diferente de marcarDespesaComoPaga
 * (Despesas.gs), aqui a forma de pagamento e a conta vão para as
 * COLUNAS próprias em vez de virarem texto dentro de observações — é o
 * que permite depois filtrar e somar por forma de pagamento.
 *
 * O comprovante NÃO trava a confirmação, por decisão: quem paga nem
 * sempre tem o arquivo em mãos na hora. A despesa fica marcada como
 * "paga sem comprovante" e aparece num contador de pendência até
 * alguém anexar — cobra sem bloquear o trabalho.
 */
function pagConfirmarPagamento(payload, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "financeiro", false);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "Despesa não informada." };

    pagGarantirColunas_();
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var statusAtual = pag_(despInfo, "STATUS");
    if (statusAtual === STATUS_DESPESA.PAGO)       return { ok: false, mensagem: "Esta despesa já está marcada como paga." };
    if (statusAtual === STATUS_DESPESA.CANCELADO)  return { ok: false, mensagem: "Esta despesa está cancelada." };
    if (statusAtual === STATUS_DESPESA.ESTORNADO)  return { ok: false, mensagem: "Esta despesa está estornada. Lance de novo se ela vai ser paga." };

    var dataPagamento = pagDataBR_(payload.dataPagamento);
    if (!dataPagamento) return { ok: false, mensagem: "Informe a data em que o pagamento saiu." };

    var forma = String(payload.formaPagamento || "").trim();
    var conta = String(payload.contaBancaria  || "").trim();
    var obs   = String(payload.observacao     || "").trim();
    var quem  = sessao.nome || sessao.usuario || sessao.email || "SISGEP";

    // Valor efetivamente pago pode divergir do previsto (juros, multa,
    // desconto). Quando divergir, o valor da despesa é atualizado e a
    // diferença fica registrada no histórico — nunca sobrescreve calado.
    var valorPrevisto = pagNumero_(pag_(despInfo, "VALOR"));
    var valorPago     = payload.valorPago === undefined || payload.valorPago === null || payload.valorPago === ""
      ? valorPrevisto
      : pagNumero_(payload.valorPago);
    var detalheValor = "";
    if (valorPago > 0 && Math.abs(valorPago - valorPrevisto) >= 0.01) {
      detalheValor = "Valor previsto " + pagValorBR_(valorPrevisto) +
        ", pago " + pagValorBR_(valorPago) + ". ";
    }

    var campos = {
      "STATUS":         STATUS_DESPESA.PAGO,
      "DATA_PAGAMENTO": dataPagamento,
      "PAGO_POR":       quem
    };
    if (forma) campos["FORMA_PAGAMENTO"] = forma;
    if (conta) campos["CONTA_BANCARIA"]  = conta;
    if (detalheValor) campos["VALOR"] = pagValorBR_(valorPago);
    if (obs || detalheValor) campos["OBSERVACOES"] = (detalheValor + obs).trim();
    atualizarCamposDespesa_(idDespesa, campos);

    pagRegistrarEvento_({
      idDespesa: idDespesa, numeroDespesa: pag_(despInfo, "NUMERO_DESPESA"),
      fornecedor: pag_(despInfo, "PRESTADOR_NOME"), evento: PAG_EVENTOS.PAGO,
      deStatus: statusAtual, paraStatus: STATUS_DESPESA.PAGO,
      valor: pagValorBR_(valorPago), dataReferencia: dataPagamento,
      formaPagamento: forma, contaBancaria: conta, usuario: quem,
      detalhe: (detalheValor + obs).trim()
    });

    var temComprovante = !!pag_(despInfo, "FILE_ID_COMPROVANTE");
    return {
      ok: true,
      semComprovante: !temComprovante,
      mensagem: "Pagamento confirmado em " + dataPagamento + "." +
        (temComprovante ? "" : " Falta anexar o comprovante — ele fica marcado como pendente até você anexar.")
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao confirmar o pagamento: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/* =========================================
 * AÇÃO 3 — ANEXAR COMPROVANTE
 * ========================================= */

/**
 * Sobe o comprovante para o Drive num slot PRÓPRIO. Isto é o ponto
 * central deste arquivo: as colunas LINK_DOCUMENTO/FILE_ID_DOCUMENTO
 * pertencem à nota fiscal do fornecedor e NÃO podem ser tocadas aqui —
 * antes, anexar o comprovante apagaria a nota sem avisar ninguém.
 */
function pagAnexarComprovante(payload, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "financeiro", false);
  try {
    payload = payload || {};
    var idDespesa = String(payload.idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "Despesa não informada." };
    if (!payload.base64 || !payload.nomeArquivo) return { ok: false, mensagem: "Selecione o arquivo do comprovante." };

    pagGarantirColunas_();
    var despInfo = localizarLinhaDespesaPorId_(idDespesa);
    if (!despInfo) return { ok: false, mensagem: "Despesa não encontrada." };

    var statusAtual = pag_(despInfo, "STATUS");
    if (statusAtual === STATUS_DESPESA.CANCELADO) return { ok: false, mensagem: "Despesa cancelada não recebe comprovante." };

    var nomeArquivo = String(payload.nomeArquivo).trim();
    var mime        = String(payload.mimeType || "application/octet-stream").trim();
    var bytes       = Utilities.base64Decode(payload.base64);
    if (bytes.length > 10 * 1024 * 1024) return { ok: false, mensagem: "O comprovante passa de 10MB. Envie um arquivo menor." };

    var numero = pag_(despInfo, "NUMERO_DESPESA") || idDespesa.substring(0, 8);
    var nomeFinal = "COMPROVANTE_" + numero.replace(/[^\w-]/g, "_") + "_" + nomeArquivo;

    var pasta = obterPastaDesp_();
    var arquivo = pasta.createFile(Utilities.newBlob(bytes, mime, nomeFinal));
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var comprovanteAnterior = pag_(despInfo, "FILE_ID_COMPROVANTE");
    var quem = sessao.nome || sessao.usuario || sessao.email || "SISGEP";
    var agora = agoraFormatadoDesp_();

    atualizarCamposDespesa_(idDespesa, {
      "LINK_COMPROVANTE":         arquivo.getUrl(),
      "FILE_ID_COMPROVANTE":      arquivo.getId(),
      "NOME_ARQUIVO_COMPROVANTE": nomeFinal,
      "DATA_COMPROVANTE":         agora,
      "COMPROVANTE_POR":          quem
    });

    // Substituir comprovante é evento distinto de anexar o primeiro: o
    // arquivo antigo continua no Drive, mas a linha deixa de apontar
    // para ele. Sem registrar isso, a troca ficaria invisível.
    pagRegistrarEvento_({
      idDespesa: idDespesa, numeroDespesa: numero,
      fornecedor: pag_(despInfo, "PRESTADOR_NOME"),
      evento: comprovanteAnterior ? PAG_EVENTOS.COMPROVANTE_TROCADO : PAG_EVENTOS.COMPROVANTE,
      deStatus: statusAtual, paraStatus: statusAtual,
      valor: pag_(despInfo, "VALOR"), dataReferencia: agora, usuario: quem,
      detalhe: comprovanteAnterior
        ? "Comprovante substituído. Anterior: " + pag_(despInfo, "NOME_ARQUIVO_COMPROVANTE") + " (arquivo antigo mantido no Drive). Novo: " + nomeFinal
        : nomeFinal
    });

    return { ok: true, link: arquivo.getUrl(), nomeArquivo: nomeFinal, mensagem: "Comprovante anexado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao anexar o comprovante: " + e.message };
  }
}

/* =========================================
 * LEITURA — LISTA, RESUMO E HISTÓRICO
 * ========================================= */

/**
 * Lista do mês para a tela de trabalho. Colapsa os status do ciclo do
 * DOCUMENTO (aguardando documento, documento recebido, enviado à
 * contabilidade) numa única situação "A pagar": quem executa pagamento
 * não precisa saber em que ponto do trâmite fiscal a nota está, e
 * mostrar cinco situações onde existem três só gera dúvida. O status
 * detalhado continua disponível no campo statusOriginal.
 */
function pagListarControle(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    filtros = filtros || {};
    pagGarantirColunas_();

    var res = listarDespesas_interno_({});
    if (!res.ok) return { ok: false, mensagem: res.mensagem, lista: [] };

    var competencia = String(filtros.competencia || "").trim();
    var situacao    = String(filtros.situacao    || "").trim();
    var busca       = String(filtros.busca       || "").trim();

    // Lê a aba UMA vez e monta um mapa por ID. A versão anterior chamava
    // localizarLinhaDespesaPorId_ dentro do laço, ou seja, varria a
    // planilha inteira a cada linha — com algumas centenas de despesas
    // isso vira leitura quadrática e estoura o tempo do Apps Script.
    var abaDesp = obterAbaDesp_();
    var mapaLinhas = {};
    if (abaDesp.getLastRow() > 1) {
      var todos = abaDesp.getRange(1, 1, abaDesp.getLastRow(), abaDesp.getLastColumn()).getValues();
      var cabDesp = todos[0].map(function (h) { return String(h || "").trim(); });
      function col(nome) { return cabDesp.indexOf(nome); }
      var iId   = col("ID_DESPESA");
      var idxs  = {
        dataLancamentoBanco: col("DATA_LANCAMENTO_BANCO"),
        lancadoBancoPor:     col("LANCADO_BANCO_POR"),
        contaBancaria:       col("CONTA_BANCARIA"),
        pagoPor:             col("PAGO_POR"),
        linkComprovante:     col("LINK_COMPROVANTE"),
        nomeComprovante:     col("NOME_ARQUIVO_COMPROVANTE"),
        dataComprovante:     col("DATA_COMPROVANTE"),
        comprovantePor:      col("COMPROVANTE_POR")
      };
      for (var i = 1; i < todos.length; i++) {
        var idLinha = iId > -1 ? String(todos[i][iId] || "").trim() : "";
        if (!idLinha) continue;
        var obj = {};
        Object.keys(idxs).forEach(function (k) {
          obj[k] = idxs[k] > -1 ? String(todos[i][idxs[k]] || "").trim() : "";
        });
        mapaLinhas[idLinha] = obj;
      }
    }

    var lista = [];
    (res.lista || []).forEach(function (d) {
      if (competencia && pagCompetenciaDaData_(d.dataVencimentoBR) !== competencia) return;

      var sit;
      if (d.status === STATUS_DESPESA.PAGO)               sit = "PAGO";
      else if (d.status === STATUS_DESPESA.LANCADO_BANCO) sit = "LANCADO_BANCO";
      else if (d.status === STATUS_DESPESA.CANCELADO)     sit = "CANCELADO";
      else if (d.status === STATUS_DESPESA.ESTORNADO)     sit = "ESTORNADO";
      else                                                sit = "A_PAGAR";

      if (situacao && sit !== situacao) return;
      if (busca && normalizarTextoDesp_([d.prestadorNome, d.descricao, d.numeroDespesa, d.categoria].join(" "))
            .indexOf(normalizarTextoDesp_(busca)) === -1) return;

      var extra = mapaLinhas[d.idDespesa] || {};

      lista.push({
        idDespesa: d.idDespesa, numeroDespesa: d.numeroDespesa,
        fornecedor: d.prestadorNome, descricao: d.descricao, categoria: d.categoria,
        valor: d.valor, valorNum: pagNumero_(d.valor),
        dataVencimento: d.dataVencimentoBR, statusVencimento: d.statusVencimento,
        competencia: pagCompetenciaDaData_(d.dataVencimentoBR),
        situacao: sit, statusOriginal: d.status,
        dataPagamento: d.dataPagamento, formaPagamento: d.formaPagamento,
        dataLancamentoBanco: extra.dataLancamentoBanco || "",
        lancadoBancoPor:     extra.lancadoBancoPor || "",
        contaBancaria:       extra.contaBancaria || "",
        pagoPor:             extra.pagoPor || "",
        linkComprovante:     extra.linkComprovante || "",
        nomeComprovante:     extra.nomeComprovante || "",
        dataComprovante:     extra.dataComprovante || "",
        comprovantePor:      extra.comprovantePor || "",
        temComprovante:      !!(extra.linkComprovante),
        // Pago sem comprovante é a pendência que a tela cobra.
        pendenteComprovante: sit === "PAGO" && !extra.linkComprovante
      });
    });

    return { ok: true, lista: lista, total: lista.length };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar o controle de pagamentos: " + e.message, lista: [] };
  }
}

function pagResumoControle(competencia, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    var r = pagListarControle({ competencia: competencia }, tokenSessao);
    if (!r.ok) return r;

    var resumo = {
      competencia: String(competencia || ""),
      qtdTotal: 0, qtdAPagar: 0, qtdLancado: 0, qtdPago: 0, qtdVencidas: 0, qtdSemComprovante: 0,
      valorTotal: 0, valorAPagar: 0, valorLancado: 0, valorPago: 0
    };

    (r.lista || []).forEach(function (d) {
      if (d.situacao === "CANCELADO" || d.situacao === "ESTORNADO") return;
      resumo.qtdTotal++;
      resumo.valorTotal += d.valorNum;
      if (d.situacao === "A_PAGAR")            { resumo.qtdAPagar++;  resumo.valorAPagar  += d.valorNum; }
      else if (d.situacao === "LANCADO_BANCO") { resumo.qtdLancado++; resumo.valorLancado += d.valorNum; }
      else if (d.situacao === "PAGO")          { resumo.qtdPago++;    resumo.valorPago    += d.valorNum; }
      if (d.statusVencimento === "VENCIDO" && d.situacao !== "PAGO") resumo.qtdVencidas++;
      if (d.pendenteComprovante) resumo.qtdSemComprovante++;
    });

    ["valorTotal", "valorAPagar", "valorLancado", "valorPago"].forEach(function (k) {
      resumo[k] = Math.round(resumo[k] * 100) / 100;
      resumo[k + "Fmt"] = pagValorBR_(resumo[k]);
    });

    return { ok: true, resumo: resumo };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar o resumo: " + e.message };
  }
}

/** Trilha completa de uma despesa, mais recente primeiro. */
function pagHistoricoDespesa(idDespesa, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    idDespesa = String(idDespesa || "").trim();
    if (!idDespesa) return { ok: false, mensagem: "Despesa não informada.", historico: [] };

    var sh = pagGarantirLog_();
    if (sh.getLastRow() < 2) return { ok: true, historico: [] };

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var historico = dados
      .filter(function (l) { return String(l[2]) === idDespesa; })
      .map(function (l) {
        return {
          id: String(l[0] || ""),
          dataHora: formatarDataHoraBRDesp_(l[1]),
          numeroDespesa: String(l[3] || ""),
          fornecedor: String(l[4] || ""),
          evento: String(l[5] || ""),
          deStatus: String(l[6] || ""),
          paraStatus: String(l[7] || ""),
          valor: String(l[8] || ""),
          dataReferencia: String(l[9] || ""),
          formaPagamento: String(l[10] || ""),
          contaBancaria: String(l[11] || ""),
          usuario: String(l[12] || ""),
          detalhe: String(l[13] || "")
        };
      })
      .reverse();

    return { ok: true, historico: historico };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ler o histórico: " + e.message, historico: [] };
  }
}

/** Trilha do mês inteiro — é o extrato que o Conselho Fiscal pede. */
function pagHistoricoCompetencia(competencia, tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    var sh = pagGarantirLog_();
    if (sh.getLastRow() < 2) return { ok: true, historico: [] };

    competencia = String(competencia || "").trim();
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    var historico = dados.map(function (l) {
      var d = l[1] instanceof Date ? l[1] : parseDataFlexivelDesp_(l[1]);
      return {
        dataHora: formatarDataHoraBRDesp_(l[1]),
        _comp: d ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM") : "",
        idDespesa: String(l[2] || ""), numeroDespesa: String(l[3] || ""),
        fornecedor: String(l[4] || ""), evento: String(l[5] || ""),
        valor: String(l[8] || ""), dataReferencia: String(l[9] || ""),
        formaPagamento: String(l[10] || ""), usuario: String(l[12] || ""),
        detalhe: String(l[13] || "")
      };
    }).filter(function (e) {
      return !competencia || e._comp === competencia;
    }).reverse();

    historico.forEach(function (e) { delete e._comp; });
    return { ok: true, historico: historico };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ler o histórico do mês: " + e.message, historico: [] };
  }
}

/** Competências que existem na base, para o seletor de mês da tela. */
function pagListarCompetencias(tokenSessao) {
  exigirModulo_(tokenSessao, "financeiro", false);
  try {
    var res = listarDespesas_interno_({});
    var vistas = {};
    (res.lista || []).forEach(function (d) {
      var c = pagCompetenciaDaData_(d.dataVencimentoBR);
      if (c) vistas[c] = true;
    });
    var lista = Object.keys(vistas).sort().reverse();
    return { ok: true, competencias: lista };
  } catch (e) {
    return { ok: false, mensagem: e.message, competencias: [] };
  }
}
