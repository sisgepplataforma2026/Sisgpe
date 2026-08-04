// ================================
// ARQUIVO: CobrancaRelacaoNominal.gs
// MÓDULO: Escolas — Cobrança automática da Relação Nominal de Associados
//
// Objetivo: acompanhar, por escola e por competência, se a relação
// nominal de associados (documento usado para emissão das guias
// sindicais) já foi recebida por e-mail — e, quando não, conduzir uma
// régua de lembretes (1º lembrete / 2º lembrete / crítica) sempre sob
// aprovação humana do financeiro antes de qualquer envio real.
//
// REGRA DE OURO (repetida do pedido original do usuário e do
// CLAUDE.md): nunca inventar associado, e-mail ou dado nenhum. A
// leitura do Gmail só identifica SE uma relação foi enviada (metadados
// do e-mail: assunto/remetente/data/anexo) — nunca fabrica conteúdo de
// anexo que as ferramentas não conseguiram extrair.
//
// A caixa de e-mail usada é a mesma que já autoriza GmailApp neste
// projeto (financeirosindecucacao@gmail.com — confirmado pelo
// usuário), a mesma conta usada por CentralEmailIA.gs/EmailCore.gs.
//
// NENHUMA função deste arquivo envia e-mail para escola sozinha. A
// rotina diária (cob_rotinaDiariaTrigger_) só LÊ o Gmail e ATUALIZA
// status/recomendação — quem decide disparar um lote de lembretes é
// sempre um clique humano em cob_aprovarEnviarLote_publico, na tela
// CobrancaAdmin.html.
// ================================

var ABA_COBRANCA_RELACAO = "COBRANCA_RELACAO_NOMINAL";

var COB_STATUS = {
  PENDENTE: "PENDENTE",
  RECEBIDA: "RECEBIDA",
  SOLICITADA: "SOLICITADA",
  LEMBRETE_1: "LEMBRETE_1",
  LEMBRETE_2: "LEMBRETE_2",
  CRITICA: "CRITICA",
  SEM_EMAIL: "SEM_EMAIL",
  INCONSISTENTE: "INCONSISTENTE"
};

var COB_ASSINATURA_PADRAO_ =
  "Wanderson N Castelo\n" +
  "Financeiro & Cobrança\n" +
  "SindEducação\n" +
  "📞 27 99813-5965 | 27 3222-2706";

/* =========================================
 * DATA MODEL
 * ========================================= */

function cob_garantirSheet_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_COBRANCA_RELACAO);
  if (!sh) sh = ss.insertSheet(ABA_COBRANCA_RELACAO);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "ESCOLA_CNPJ", "ESCOLA_NOME", "ESCOLA_EMAIL", "COMPETENCIA",
      "STATUS", "DATA_SOLICITACAO", "DATA_LEMBRETE1", "DATA_LEMBRETE2",
      "DATA_CRITICA", "DATA_RECEBIDA", "EMAIL_ASSUNTO_ORIGEM", "EMAIL_REMETENTE_ORIGEM",
      "OBSERVACOES", "ATUALIZADO_POR", "CRIADO_EM", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 17).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ["EMAIL_ASSUNTO_ORIGEM", "EMAIL_REMETENTE_ORIGEM"].forEach(function (nomeCol) {
      var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      if (cab.indexOf(nomeCol) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(nomeCol).setFontWeight("bold");
      }
    });
  }
  return sh;
}

function cob_mapaCabecalho_(sh) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var mapa = {};
  cab.forEach(function (nome, i) { if (nome) mapa[String(nome).trim().toUpperCase()] = i + 1; });
  return mapa;
}

function cob_gerarId_() {
  return "COB-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function cob_normalizar_(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().trim().replace(/\s+/g, " ");
}

/* =========================================
 * COMPETÊNCIA
 * ========================================= */

function cob_competenciaDe_(data) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(data, tz, "yyyy-MM");
}

function cob_competenciaAnterior_(competenciaYYYYMM) {
  var partes = competenciaYYYYMM.split("-");
  var ano = parseInt(partes[0], 10), mes = parseInt(partes[1], 10);
  mes -= 1;
  if (mes < 1) { mes = 12; ano -= 1; }
  return ano + "-" + (mes < 10 ? "0" + mes : mes);
}

function cob_competenciaLabel_(competenciaYYYYMM) {
  var nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  var partes = competenciaYYYYMM.split("-");
  var mes = parseInt(partes[1], 10);
  return nomes[mes - 1] + "/" + partes[0];
}

/* =========================================
 * ESCOLAS-ALVO (cruzamento com Sindicalização, best-effort por nome)
 *
 * Escolas.gs não tem contador de associados por escola, e o cadastro
 * de Filiados (Sindicalizacao.gs) guarda o nome da escola como texto
 * livre, não por CNPJ — não existe hoje uma chave exata entre os dois
 * cadastros. Por isso "possuiAssociados" aqui é um SINAL calculado
 * (bate pelo menos 1 filiado com nome de escola normalizado igual),
 * não uma contagem oficial. A tela mostra isso como heurística e
 * permite ao financeiro incluir/excluir escolas manualmente da régua —
 * nunca tratamos esse cruzamento como fato absoluto.
 * ========================================= */

function cob_nomesEscolasComFiliados_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(SINDICALIZACAO_ABA);
  var set = {};
  if (!sh || sh.getLastRow() < 2) return set;
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colEscola = cab.indexOf("ESCOLA");
  if (colEscola === -1) return set;
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  dados.forEach(function (linha) {
    var nome = cob_normalizar_(linha[colEscola]);
    if (nome) set[nome] = true;
  });
  return set;
}

function cob_escolasAlvo_interno_() {
  var escolas = listarEscolasCadastro_interno_();
  var comFiliados = cob_nomesEscolasComFiliados_();
  return escolas.map(function (e) {
    var nomeNorm = cob_normalizar_(e.NomeEscola || e.Fantasia);
    var fantasiaNorm = cob_normalizar_(e.Fantasia);
    return {
      cnpj: String(e.CNPJ || "").trim(),
      nome: e.NomeEscola || e.Fantasia || "(sem nome)",
      email: String(e.Email || "").trim(),
      emailsTodos: String(e.EmailsTodos || "").trim(),
      possuiAssociados: !!(comFiliados[nomeNorm] || (fantasiaNorm && comFiliados[fantasiaNorm]))
    };
  }).filter(function (e) { return e.cnpj || e.nome !== "(sem nome)"; });
}

/* =========================================
 * BUSCA NO GMAIL — reaproveita eiaBuscarEmailsGmail_ (CentralEmailIA.gs),
 * já usado por Cockpit e Caixa de E-mails, em vez de reimplementar
 * GmailApp.search por conta própria.
 * ========================================= */

var COB_TERMOS_BUSCA_ = [
  "guia sindical", "boleto", "mensalidade sindical", "contribuição sindical",
  "contribuição confederativa", "contribuição assistencial", "contribuição negocial",
  "relação nominal", "lista de associados", "associados", "folha de pagamento"
];

function cob_montarQuery_(escola, competenciaLabel) {
  var termos = "(" + COB_TERMOS_BUSCA_.map(function (t) { return '"' + t + '"'; }).join(" OR ") + ")";
  var identificador = escola.cnpj ? '"' + escola.cnpj + '"' : '"' + escola.nome + '"';
  return identificador + " " + termos + " has:attachment";
}

/**
 * Busca e-mails candidatos a "relação nominal" para UMA escola. Não
 * baixa/lê o conteúdo do anexo (mesma limitação já registrada na busca
 * manual anterior) — só identifica candidatos por metadados, para o
 * financeiro (ou uma extração futura) confirmar. Retorna o candidato
 * mais recente com anexo.
 */
function cob_buscarCandidatoParaEscola_(escola, competenciaYYYYMM) {
  var label = cob_competenciaLabel_(competenciaYYYYMM);
  var query = cob_montarQuery_(escola, label);
  var emails;
  try {
    emails = eiaBuscarEmailsGmail_(query, 0, 10);
  } catch (e) {
    Logger.log("[Cobrança] erro ao buscar Gmail para " + escola.nome + ": " + e.message);
    return null;
  }
  if (!emails || !emails.length) return null;

  emails.sort(function (a, b) { return (b.dataTs || 0) - (a.dataTs || 0); });
  var comAnexo = emails.filter(function (m) { return m.temAnexo; });
  var escolhido = comAnexo[0] || null;
  if (!escolhido) return null;

  var competenciaNoAssunto = escolhido.assunto.indexOf(competenciaYYYYMM) !== -1 ||
    escolhido.assunto.indexOf(label) !== -1 ||
    escolhido.corpo.indexOf(competenciaYYYYMM) !== -1 ||
    escolhido.corpo.indexOf(label) !== -1;

  return {
    assunto: escolhido.assunto,
    remetente: escolhido.remetente,
    dataStr: escolhido.dataStr,
    dataTs: escolhido.dataTs,
    qtdAnexos: escolhido.qtdAnexos,
    competenciaConfere: competenciaNoAssunto
  };
}

/* =========================================
 * RÉGUA DE LEMBRETES — cálculo de dias e textos
 * ========================================= */

function cob_diasDesde_(dataISO) {
  if (!dataISO) return null;
  var d = new Date(dataISO);
  if (isNaN(d.getTime())) return null;
  var hoje = new Date();
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000);
}

/**
 * Dado o status atual e as datas já registradas, recomenda a PRÓXIMA
 * ação — nunca executa nada sozinha. dias >= 5 sem RECEBIDA desde a
 * última etapa → recomenda a próxima etapa da régua.
 */
function cob_proximaAcaoRecomendada_(linha) {
  if (linha.status === COB_STATUS.RECEBIDA) return null;
  if (linha.status === COB_STATUS.SEM_EMAIL) return "CADASTRAR_EMAIL";
  if (linha.status === COB_STATUS.PENDENTE) return COB_STATUS.SOLICITADA;

  if (linha.status === COB_STATUS.SOLICITADA) {
    var dias1 = cob_diasDesde_(linha.dataSolicitacao);
    if (dias1 !== null && dias1 >= 5) return "LEMBRETE_1";
    return null;
  }
  if (linha.status === COB_STATUS.LEMBRETE_1) {
    var dias2 = cob_diasDesde_(linha.dataLembrete1);
    if (dias2 !== null && dias2 >= 5) return "LEMBRETE_2";
    return null;
  }
  if (linha.status === COB_STATUS.LEMBRETE_2) {
    var dias3 = cob_diasDesde_(linha.dataLembrete2);
    if (dias3 !== null && dias3 >= 5) return "CRITICA";
    return null;
  }
  return null;
}

function cob_assuntoLembrete_(nivel, competenciaLabel) {
  if (nivel === "SOLICITADA") return "[SindEducação-ES] Solicitação — relação nominal de associados — " + competenciaLabel;
  if (nivel === "LEMBRETE_1") return "[SindEducação-ES] Lembrete — relação nominal pendente — " + competenciaLabel;
  if (nivel === "LEMBRETE_2") return "[SindEducação-ES] Urgente — relação nominal pendente — " + competenciaLabel;
  return "[SindEducação-ES] Relação nominal — " + competenciaLabel;
}

/**
 * Corpo em texto puro dos 3 estágios. LEMBRETE_1 e LEMBRETE_2 usam o
 * texto EXATO fornecido pelo usuário — não parafrasear. SOLICITADA é
 * um rascunho no mesmo tom (não foi ditado literalmente) — a tela deve
 * deixar claro que é editável antes do envio.
 */
function cob_corpoLembrete_(nivel, competenciaLabel) {
  if (nivel === "SOLICITADA") {
    return "Prezados(as),\n\n" +
      "Para darmos andamento à conferência dos associados e à emissão da guia sindical da competência " + competenciaLabel + ", " +
      "solicitamos o envio da relação nominal de associados (colaboradores filiados ao sindicato).\n\n" +
      "Caso já tenha sido encaminhada, pedimos a gentileza de informar a data e o assunto do e-mail.\n\n" +
      "Atenciosamente,\n" + COB_ASSINATURA_PADRAO_;
  }
  if (nivel === "LEMBRETE_1") {
    return "Prezados(as),\n\n" +
      "Em continuidade à solicitação anterior, ainda não localizamos a relação nominal de associados referente à competência " + competenciaLabel + ".\n\n" +
      "Solicitamos, por gentileza, o envio do documento para conferência e emissão da guia sindical.\n\n" +
      "Caso já tenha sido encaminhado, pedimos informar a data e o assunto do e-mail.\n\n" +
      "Atenciosamente,\n" + COB_ASSINATURA_PADRAO_;
  }
  if (nivel === "LEMBRETE_2") {
    return "Prezados(as),\n\n" +
      "A relação nominal da competência " + competenciaLabel + " continua pendente em nosso controle, apesar das solicitações anteriores.\n\n" +
      "O documento é necessário para conferência dos associados e emissão correta da guia sindical. Solicitamos o envio com prioridade.\n\n" +
      "Caso já tenha sido enviado, pedimos informar os dados da mensagem para localização.\n\n" +
      "Atenciosamente,\n" + COB_ASSINATURA_PADRAO_;
  }
  return "";
}

/* =========================================
 * LEITURA DO PAINEL (pública, exige sessão)
 * ========================================= */

function cob_linhaParaObjeto_(cab, linha) {
  var obj = {};
  cab.forEach(function (nome, i) { obj[nome] = linha[i] !== undefined ? linha[i] : ""; });
  return {
    id: obj["ID"],
    cnpj: obj["ESCOLA_CNPJ"],
    nome: obj["ESCOLA_NOME"],
    email: obj["ESCOLA_EMAIL"],
    competencia: obj["COMPETENCIA"],
    status: obj["STATUS"],
    dataSolicitacao: rh_formatarData_(obj["DATA_SOLICITACAO"]),
    dataLembrete1: rh_formatarData_(obj["DATA_LEMBRETE1"]),
    dataLembrete2: rh_formatarData_(obj["DATA_LEMBRETE2"]),
    dataCritica: rh_formatarData_(obj["DATA_CRITICA"]),
    dataRecebida: rh_formatarData_(obj["DATA_RECEBIDA"]),
    assuntoOrigem: obj["EMAIL_ASSUNTO_ORIGEM"],
    remetenteOrigem: obj["EMAIL_REMETENTE_ORIGEM"],
    observacoes: obj["OBSERVACOES"]
  };
}

function cob_listarPainel(tokenSessao, competenciaParam) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var sh = cob_garantirSheet_();
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var competenciaAtual = competenciaParam || cob_competenciaDe_(new Date());
  var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];

  var linhas = dados
    .map(function (l) { return cob_linhaParaObjeto_(cab, l); })
    .filter(function (l) { return l.competencia === competenciaAtual; });

  var label = cob_competenciaLabel_(competenciaAtual);
  linhas.forEach(function (l) {
    l.proximaAcao = cob_proximaAcaoRecomendada_({
      status: l.status, dataSolicitacao: l.dataSolicitacao,
      dataLembrete1: l.dataLembrete1, dataLembrete2: l.dataLembrete2
    });
    if (l.proximaAcao === COB_STATUS.SOLICITADA || l.proximaAcao === COB_STATUS.LEMBRETE_1 || l.proximaAcao === COB_STATUS.LEMBRETE_2) {
      l.assuntoSugerido = cob_assuntoLembrete_(l.proximaAcao, label);
      l.corpoSugerido = cob_corpoLembrete_(l.proximaAcao, label);
    }
  });

  var total = linhas.length;
  var recebidas = linhas.filter(function (l) { return l.status === COB_STATUS.RECEBIDA; }).length;

  return {
    ok: true,
    competencia: competenciaAtual,
    competenciaLabel: cob_competenciaLabel_(competenciaAtual),
    total: total,
    recebidas: recebidas,
    pendentes: total - recebidas,
    linhas: linhas
  };
}

/* =========================================
 * ROTINA DIÁRIA — só lê e atualiza status/recomendação. NUNCA envia
 * e-mail para escola. Gera as linhas que ainda não existem (uma por
 * escola-alvo x competência) e roda o motor de correspondência.
 * ========================================= */

function cob_rotinaDiaria_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = cob_garantirSheet_();
    var mapa = cob_mapaCabecalho_(sh);
    var competenciaAtual = cob_competenciaDe_(new Date());
    var competenciaAnterior = cob_competenciaAnterior_(competenciaAtual);

    var escolasAlvo = cob_escolasAlvo_interno_().filter(function (e) { return e.possuiAssociados; });

    var existentes = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var porChave = {}; // "CNPJ::COMPETENCIA" -> numero da linha na planilha
    existentes.forEach(function (l, i) {
      var obj = cob_linhaParaObjeto_(cab, l);
      porChave[obj.cnpj + "::" + obj.competencia] = i + 2;
    });

    // Decide a competência de trabalho: se já existe alguma RECEBIDA na
    // atual, trabalha na atual; senão, tenta atual e, se nada aparecer
    // em lugar nenhum ainda, mantém também a anterior em aberto.
    var competencias = [competenciaAtual, competenciaAnterior];
    var agora = new Date();
    var processadas = 0, recebidasHoje = 0;

    escolasAlvo.forEach(function (escola) {
      competencias.forEach(function (competencia) {
        var chave = escola.cnpj + "::" + competencia;
        var numLinha = porChave[chave];

        if (!numLinha) {
          var novoId = cob_gerarId_();
          numLinha = sh.getLastRow() + 1;
          sh.getRange(numLinha, mapa["ID"]).setValue(novoId);
          sh.getRange(numLinha, mapa["ESCOLA_CNPJ"]).setValue(escola.cnpj);
          sh.getRange(numLinha, mapa["ESCOLA_NOME"]).setValue(escola.nome);
          sh.getRange(numLinha, mapa["ESCOLA_EMAIL"]).setValue(escola.email);
          sh.getRange(numLinha, mapa["COMPETENCIA"]).setValue(competencia);
          sh.getRange(numLinha, mapa["STATUS"]).setValue(escola.email ? COB_STATUS.PENDENTE : COB_STATUS.SEM_EMAIL);
          sh.getRange(numLinha, mapa["CRIADO_EM"]).setValue(agora);
          porChave[chave] = numLinha;
        }

        var statusAtual = String(sh.getRange(numLinha, mapa["STATUS"]).getValue() || "");
        if (statusAtual === COB_STATUS.RECEBIDA) return; // já resolvida — nunca reabre sozinha

        var candidato = cob_buscarCandidatoParaEscola_(escola, competencia);
        processadas++;

        if (candidato) {
          if (candidato.competenciaConfere) {
            sh.getRange(numLinha, mapa["STATUS"]).setValue(COB_STATUS.RECEBIDA);
            sh.getRange(numLinha, mapa["DATA_RECEBIDA"]).setValue(agora);
            sh.getRange(numLinha, mapa["EMAIL_ASSUNTO_ORIGEM"]).setValue(candidato.assunto);
            sh.getRange(numLinha, mapa["EMAIL_REMETENTE_ORIGEM"]).setValue(candidato.remetente);
            recebidasHoje++;
          } else {
            sh.getRange(numLinha, mapa["STATUS"]).setValue(COB_STATUS.INCONSISTENTE);
            sh.getRange(numLinha, mapa["EMAIL_ASSUNTO_ORIGEM"]).setValue(candidato.assunto);
            sh.getRange(numLinha, mapa["EMAIL_REMETENTE_ORIGEM"]).setValue(candidato.remetente);
            sh.getRange(numLinha, mapa["OBSERVACOES"]).setValue(
              "Anexo localizado (" + candidato.dataStr + "), mas a competência não bate claramente com o assunto/corpo do e-mail — confira manualmente."
            );
          }
        }
        // Se não achou candidato nenhum, mantém status/régua como está —
        // é a régua de lembretes (aprovada manualmente) que avança isso.

        sh.getRange(numLinha, mapa["ATUALIZADO_EM"]).setValue(agora);
      });
    });

    Logger.log("[Cobrança] Rotina diária — escolas processadas: " + processadas + " | recebidas hoje: " + recebidasHoje);
    return { ok: true, processadas: processadas, recebidasHoje: recebidasHoje };
  } finally {
    lock.releaseLock();
  }
}

/** Ponto de entrada do trigger — sem tokenSessao, roda sem usuário logado. */
function cob_rotinaDiariaTrigger_() {
  try {
    cob_rotinaDiaria_();
  } catch (e) {
    Logger.log("[Cobrança] ERRO na rotina diária: " + e.message);
  }
}

/** Público — permite ao financeiro forçar uma nova varredura na hora, sem esperar o trigger das 9h. */
function cob_forcarVarreduraAgora_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return cob_rotinaDiaria_();
  } catch (e) {
    return { ok: false, mensagem: "Erro na varredura: " + e.message };
  }
}

/* =========================================
 * INSTALADOR DO TRIGGER DIÁRIO (~9h) — botão admin, mesmo motivo dos
 * botões de seed do RH: o editor do projeto é pouco confiável para
 * instalar triggers manualmente.
 * ========================================= */

function cob_instalarTriggerDiario_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === "cob_rotinaDiariaTrigger_") ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger("cob_rotinaDiariaTrigger_").timeBased().everyDays(1).atHour(9).create();
    return { ok: true, mensagem: "Trigger diário instalado — a rotina roda automaticamente por volta das 9h." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao instalar trigger: " + e.message };
  }
}

function cob_removerTriggerDiario_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var removidos = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === "cob_rotinaDiariaTrigger_") { ScriptApp.deleteTrigger(t); removidos++; }
    });
    return { ok: true, mensagem: removidos ? "Trigger diário removido." : "Nenhum trigger instalado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao remover trigger: " + e.message };
  }
}

function cob_statusTriggerDiario_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var instalado = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "cob_rotinaDiariaTrigger_";
  });
  return { ok: true, instalado: instalado };
}

/* =========================================
 * APROVAÇÃO E ENVIO DE LOTE — a ÚNICA função deste arquivo que
 * efetivamente envia e-mail para escola, e só roda por clique humano
 * (google.script.run vindo do painel), nunca pelo trigger.
 * ========================================= */

function cob_aprovarEnviarLote_publico(tokenSessao, itens) {
  exigirSessaoDocumentos_(tokenSessao, true);
  if (!Array.isArray(itens) || !itens.length) return { ok: false, mensagem: "Nenhum item selecionado." };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = cob_garantirSheet_();
    var mapa = cob_mapaCabecalho_(sh);
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var porId = {};
    dados.forEach(function (l, i) { porId[l[mapa["ID"] - 1]] = i + 2; });

    var quem = Session.getActiveUser().getEmail() || "SISGEP (cobrança)";
    var agora = new Date();
    var enviados = [], falhas = [];

    itens.forEach(function (item) {
      var numLinha = porId[item.id];
      if (!numLinha) { falhas.push(item.id + ": não encontrado"); return; }
      var linha = cob_linhaParaObjeto_(cab, sh.getRange(numLinha, 1, 1, sh.getLastColumn()).getValues()[0]);
      if (!linha.email) { falhas.push(linha.nome + ": sem e-mail cadastrado"); return; }

      var nivel = String(item.acao || "").toUpperCase();
      if ([COB_STATUS.SOLICITADA, COB_STATUS.LEMBRETE_1, COB_STATUS.LEMBRETE_2].indexOf(nivel) === -1) {
        falhas.push(linha.nome + ": ação inválida (" + nivel + ")"); return;
      }

      var label = cob_competenciaLabel_(linha.competencia);
      var assunto = cob_assuntoLembrete_(nivel, label);
      var corpo = item.corpoPersonalizado ? String(item.corpoPersonalizado) : cob_corpoLembrete_(nivel, label);

      try {
        enviarEmailSISGEP_(linha.email, assunto, corpo, { origem: "Cobrança Relação Nominal" });
        sh.getRange(numLinha, mapa["STATUS"]).setValue(nivel);
        if (nivel === COB_STATUS.SOLICITADA) sh.getRange(numLinha, mapa["DATA_SOLICITACAO"]).setValue(agora);
        if (nivel === COB_STATUS.LEMBRETE_1) sh.getRange(numLinha, mapa["DATA_LEMBRETE1"]).setValue(agora);
        if (nivel === COB_STATUS.LEMBRETE_2) sh.getRange(numLinha, mapa["DATA_LEMBRETE2"]).setValue(agora);
        sh.getRange(numLinha, mapa["ATUALIZADO_POR"]).setValue(quem);
        sh.getRange(numLinha, mapa["ATUALIZADO_EM"]).setValue(agora);
        enviados.push(linha.nome);
      } catch (e) {
        falhas.push(linha.nome + ": " + e.message);
      }
    });

    return { ok: true, enviados: enviados, falhas: falhas };
  } finally {
    lock.releaseLock();
  }
}

/** Marca CRÍTICA manualmente (avisa o financeiro internamente) — não envia nada para a escola. */
function cob_marcarCritica_publico(tokenSessao, id, observacao) {
  return cob_atualizarStatusManual_publico(tokenSessao, id, COB_STATUS.CRITICA, observacao);
}

/* =========================================
 * AJUSTE MANUAL DE STATUS — RECEBIDA / INCONSISTENTE / SEM_EMAIL /
 * CRÍTICA, para quando o financeiro confirma algo que a busca
 * automática não capturou (ex.: relação recebida por outro canal).
 * ========================================= */

function cob_atualizarStatusManual_publico(tokenSessao, id, novoStatus, observacao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  if (Object.keys(COB_STATUS).map(function (k) { return COB_STATUS[k]; }).indexOf(novoStatus) === -1) {
    return { ok: false, mensagem: "Status inválido: " + novoStatus };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = cob_garantirSheet_();
    var mapa = cob_mapaCabecalho_(sh);
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) return { ok: false, mensagem: "Nada cadastrado ainda." };

    var ids = sh.getRange(2, mapa["ID"], ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        var numLinha = i + 2;
        var quem = Session.getActiveUser().getEmail() || "SISGEP (cobrança)";
        var agora = new Date();
        sh.getRange(numLinha, mapa["STATUS"]).setValue(novoStatus);
        if (novoStatus === COB_STATUS.RECEBIDA) sh.getRange(numLinha, mapa["DATA_RECEBIDA"]).setValue(agora);
        if (novoStatus === COB_STATUS.CRITICA) sh.getRange(numLinha, mapa["DATA_CRITICA"]).setValue(agora);
        if (observacao) sh.getRange(numLinha, mapa["OBSERVACOES"]).setValue(String(observacao));
        sh.getRange(numLinha, mapa["ATUALIZADO_POR"]).setValue(quem);
        sh.getRange(numLinha, mapa["ATUALIZADO_EM"]).setValue(agora);
        return { ok: true, mensagem: "Status atualizado." };
      }
    }
    return { ok: false, mensagem: "Registro não encontrado." };
  } finally {
    lock.releaseLock();
  }
}
