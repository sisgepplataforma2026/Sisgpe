/**
 * CONFERÊNCIA DE DESTINATÁRIOS — entre emitir e enviar
 * ============================================================================
 *
 * Pedido do usuário em 02/09/2026: *"deveria ter um seletor após a emissão e
 * antes do envio para excluir ou incluir email"*. E, quando perguntei se a
 * conferência devia valer sempre ou só quando houvesse pendência, a resposta
 * foi **sempre**.
 *
 * POR QUE ISSO NASCEU. O Monitoramento da produção mostrou 42 falhas de
 * entrega em 23 endereços — e QUINZE delas eram dois endereços que não existem
 * mais: carolina.ferreira@seb.com.br (8x) e thalia.ferreira@faesa.br (7x). O
 * sistema mandou para eles de março a setembro sem que nada parasse. O contato
 * certo estava na própria base o tempo todo, em ofícios CONFIRMADOS de outros
 * endereços da mesma escola.
 *
 * A DECISÃO DE DESENHO QUE IMPORTA: o histórico de cada endereço aparece AO
 * LADO dele na hora de escolher. O sistema já tinha os dois dados — quem
 * quicou e quem confirmou — e não os cruzava; descobrir isso exigia ler 347
 * linhas de uma tela de monitoramento. É a REGRA Nº 0.6: não deixar a pessoa
 * fazer o que o sistema já sabe.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO:
 *
 *   - não some com o endereço que quicou. Ele fica na lista, DESMARCADO, e com
 *     o motivo à vista. Sumir seria decidir pela pessoa;
 *   - não corrige o cadastro da escola sozinho. Excluir vale para ESTE ofício;
 *     mudar o cadastro é caixa separada, desmarcada, explícita;
 *   - não deixa liberar sem destinatário. Sem endereço não há ofício, e é
 *     melhor recusar aqui do que falhar na fila três tentativas depois.
 *
 * COMO SE ENCAIXA NO MOTOR DE ENVIO, sem tocá-lo: a fila só processa PENDENTE
 * e ERRO (`FilaOficios.gs:326`) — qualquer outro status ela ignora. Então o
 * estado novo `AGUARDANDO_DESTINATARIOS` fica parado sozinho, sem uma linha de
 * mudança no processamento. Foi por isso que se escolheu este nome de status e
 * não um sinalizador à parte.
 */

var OFDEST_STATUS_AGUARDANDO = "AGUARDANDO_DESTINATARIOS";
var OFDEST_STATUS_CANCELADO  = "CANCELADO";

/* ── porta ─────────────────────────────────────────────────────────────── */

/** Lista os ofícios emitidos e ainda não liberados para envio. */
function oficiosAguardandoDestinatarios(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_listar_();
}

/** Os endereços de um ofício, cada um com o histórico que o sistema já tem. */
function destinatariosDoOficio(filaId, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_detalhar_(filaId);
}

/** Libera o envio com os endereços escolhidos. Só aqui o ofício entra na fila. */
function liberarEnvioOficio(filaId, emailsEscolhidos, corrigirCadastro, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_liberar_(filaId, emailsEscolhidos, corrigirCadastro === true, sessao);
}

/** Cancela um ofício que ainda não saiu. O número já emitido não se reaproveita. */
function cancelarOficioAguardando(filaId, motivo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_cancelar_(filaId, motivo, sessao);
}

/* ── trabalho ──────────────────────────────────────────────────────────── */

function ofDest_aba_() {
  return obterOuCriarAbaFilaOficios_();
}

function ofDest_listar_() {
  var sh = ofDest_aba_();
  if (sh.getLastRow() < 2) return { ok: true, itens: [] };

  var hm    = getHeaderMap_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  for (var i = 0; i < dados.length; i++) {
    var st = String(dados[i][hm["STATUS"] - 1] || "").trim().toUpperCase();
    if (st !== OFDEST_STATUS_AGUARDANDO) continue;

    var emails = ofDest_separar_(dados[i][hm["EMAILS_TODOS"] - 1] ||
                                 dados[i][hm["EMAIL_PRINCIPAL"] - 1]);
    var alerta = 0;
    for (var e = 0; e < emails.length; e++) {
      var h = ofDest_historico_(emails[e]);
      if (h.falhas > 0 || (h.confirmacoes === 0 && h.envios === 0)) alerta++;
    }

    itens.push({
      id:      String(dados[i][hm["ID"] - 1] || ""),
      numero:  String(dados[i][hm["NUMERO_OFICIO"] - 1] || ""),
      tipo:    String(dados[i][hm["TIPO"] - 1] || ""),
      escola:  String(dados[i][hm["ESCOLA"] - 1] || ""),
      criadoEm: dados[i][hm["DATA_CRIACAO"] - 1] || "",
      destinatarios: emails.length,
      comAlerta: alerta
    });
  }

  return { ok: true, itens: itens };
}

function ofDest_detalhar_(filaId) {
  var achado = ofDest_acharLinha_(filaId);
  if (!achado.ok) return achado;

  var emails = ofDest_separar_(achado.valores[achado.hm["EMAILS_TODOS"] - 1] ||
                               achado.valores[achado.hm["EMAIL_PRINCIPAL"] - 1]);

  var lista = emails.map(function (email) {
    var h = ofDest_historico_(email);
    return {
      email: email,
      origem: "cadastro da escola",
      /* Quem já quicou nasce DESMARCADO. Não some da lista: some seria decidir
         pela pessoa; desmarcado com o motivo à vista é informar. */
      marcado: h.falhas === 0,
      confirmacoes: h.confirmacoes,
      falhas: h.falhas,
      envios: h.envios,
      ultimaFalha: h.ultimaFalha,
      ultimaConfirmacao: h.ultimaConfirmacao
    };
  });

  return {
    ok: true,
    id:     String(achado.valores[achado.hm["ID"] - 1] || ""),
    numero: String(achado.valores[achado.hm["NUMERO_OFICIO"] - 1] || ""),
    tipo:   String(achado.valores[achado.hm["TIPO"] - 1] || ""),
    escola: String(achado.valores[achado.hm["ESCOLA"] - 1] || ""),
    destinatarios: lista,
    /* O que o sistema sugeriria no lugar do que quicou — a resposta que hoje
       exige ler o Monitoramento inteiro. */
    sugestoes: ofDest_sugerir_(String(achado.valores[achado.hm["ESCOLA"] - 1] || ""), emails)
  };
}

function ofDest_liberar_(filaId, emailsEscolhidos, corrigirCadastro, sessao) {
  var escolhidos = ofDest_separar_(
    Array.isArray(emailsEscolhidos) ? emailsEscolhidos.join(";") : emailsEscolhidos);

  if (!escolhidos.length) {
    return { ok: false, mensagem: "Sem destinatário não há ofício. Escolha ao menos um e-mail." };
  }

  var validacao = validarListaEmails_(escolhidos.join(";"));
  if (!validacao.ok) {
    return { ok: false, mensagem: "E-mail inválido: " + validacao.invalido };
  }

  var trava = LockService.getScriptLock();
  try { trava.waitLock(15000); } catch (e) {
    return { ok: false, mensagem: "Outra liberação em andamento. Tente de novo em instantes." };
  }

  try {
    var achado = ofDest_acharLinha_(filaId);
    if (!achado.ok) return achado;

    var st = String(achado.valores[achado.hm["STATUS"] - 1] || "").trim().toUpperCase();
    if (st !== OFDEST_STATUS_AGUARDANDO) {
      /* Impede liberar duas vezes — o que colocaria o mesmo ofício na fila em
         duplicata se duas abas estivessem abertas. */
      return { ok: false, mensagem: "Este ofício não está aguardando conferência (status: " + st + ")." };
    }

    var sh = achado.sh;
    sh.getRange(achado.linha, achado.hm["EMAIL_PRINCIPAL"]).setValue(validacao.principal);
    sh.getRange(achado.linha, achado.hm["EMAILS_TODOS"]).setValue(validacao.todos);
    sh.getRange(achado.linha, achado.hm["STATUS"]).setValue("PENDENTE");
    SpreadsheetApp.flush();

    var numero = String(achado.valores[achado.hm["NUMERO_OFICIO"] - 1] || "");
    var escola = String(achado.valores[achado.hm["ESCOLA"] - 1] || "");

    var cadastro = { tentado: false, ok: false, mensagem: "" };
    if (corrigirCadastro) cadastro = ofDest_corrigirCadastro_(escola, validacao.todos);

    try {
      registrarLogSistema_({
        usuario: (sessao && sessao.email) || "sistema",
        numero:  numero,
        tipo:    "OFICIO_DESTINATARIOS_LIBERADOS",
        escola:  escola,
        cnpj:    "",
        email:   validacao.todos,
        codigo:  ""
      });
    } catch (eLog) {}

    return {
      ok: true,
      mensagem: "Ofício " + numero + " liberado para " + validacao.emails.length +
                " destinatário(s).",
      destinatarios: validacao.emails,
      cadastro: cadastro
    };
  } finally {
    try { trava.releaseLock(); } catch (e2) {}
  }
}

function ofDest_cancelar_(filaId, motivo, sessao) {
  var achado = ofDest_acharLinha_(filaId);
  if (!achado.ok) return achado;

  var st = String(achado.valores[achado.hm["STATUS"] - 1] || "").trim().toUpperCase();
  if (st !== OFDEST_STATUS_AGUARDANDO) {
    return { ok: false, mensagem: "Só se cancela ofício que ainda não foi liberado (status: " + st + ")." };
  }

  achado.sh.getRange(achado.linha, achado.hm["STATUS"]).setValue(OFDEST_STATUS_CANCELADO);
  if (achado.hm["ULTIMO_ERRO"]) {
    achado.sh.getRange(achado.linha, achado.hm["ULTIMO_ERRO"])
      .setValue("Cancelado na conferência: " + String(motivo || "sem motivo informado"));
  }
  SpreadsheetApp.flush();

  return {
    ok: true,
    /* O número não volta para o contador: numeração de ofício é sequencial e
       reaproveitar número é pior do que ter buraco na sequência. */
    mensagem: "Ofício cancelado. O número emitido não é reaproveitado."
  };
}

/* ── histórico: o que o sistema já sabe sobre cada endereço ─────────────── */

function ofDest_historico_(email) {
  var alvo = String(email || "").trim().toLowerCase();
  var vazio = { confirmacoes: 0, falhas: 0, envios: 0, ultimaFalha: "", ultimaConfirmacao: "" };
  if (!alvo) return vazio;

  var mapa = ofDest_mapaHistorico_();
  return mapa[alvo] || vazio;
}

/** Lê o Registro UMA vez por execução e indexa por endereço. */
function ofDest_mapaHistorico_() {
  if (typeof ofDest_cacheHistorico_ !== "undefined" && ofDest_cacheHistorico_) {
    return ofDest_cacheHistorico_;
  }
  var mapa = {};
  try {
    var ss = SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(PLANILHA_REGISTRO);
    if (sh && sh.getLastRow() > 1) {
      var hm     = getHeaderMap_(sh);
      var cEmail = hm["E-mails (todos)"] || hm["E-mail (principal)"];
      var cSt    = hm["Status"];
      var cData  = hm["Data"] || hm["DATA"];
      if (cEmail && cSt) {
        var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
        for (var i = 0; i < dados.length; i++) {
          var st = String(dados[i][cSt - 1] || "").trim().toUpperCase();
          var quando = cData ? dados[i][cData - 1] : "";
          ofDest_separar_(dados[i][cEmail - 1]).forEach(function (e) {
            var k = e.toLowerCase();
            if (!mapa[k]) mapa[k] = { confirmacoes: 0, falhas: 0, envios: 0, ultimaFalha: "", ultimaConfirmacao: "" };
            if (st === "CONFIRMADO")          { mapa[k].confirmacoes++; mapa[k].ultimaConfirmacao = quando; }
            else if (st === "FALHA_ENTREGA")  { mapa[k].falhas++;       mapa[k].ultimaFalha = quando; }
            else if (st === "ENVIADO")        { mapa[k].envios++; }
          });
        }
      }
    }
  } catch (e) {
    Logger.log("ofDest_mapaHistorico_: " + e);
  }
  ofDest_cacheHistorico_ = mapa;
  return mapa;
}
var ofDest_cacheHistorico_ = null;

/** Endereços da MESMA escola que já confirmaram, e não estão nesta lista. */
function ofDest_sugerir_(escola, jaListados) {
  var sugestoes = [];
  var nome = String(escola || "").trim().toUpperCase();
  if (!nome) return sugestoes;

  var listados = {};
  (jaListados || []).forEach(function (e) { listados[String(e).toLowerCase()] = true; });

  try {
    var ss = SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sh || sh.getLastRow() < 2) return sugestoes;

    var hm     = getHeaderMap_(sh);
    var cEsc   = hm["Escola"] || hm["ESCOLA"];
    var cEmail = hm["E-mails (todos)"] || hm["E-mail (principal)"];
    var cSt    = hm["Status"];
    if (!cEsc || !cEmail || !cSt) return sugestoes;

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var vistos = {};
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][cEsc - 1] || "").trim().toUpperCase() !== nome) continue;
      if (String(dados[i][cSt - 1] || "").trim().toUpperCase() !== "CONFIRMADO") continue;
      ofDest_separar_(dados[i][cEmail - 1]).forEach(function (e) {
        var k = e.toLowerCase();
        if (listados[k] || vistos[k]) return;
        vistos[k] = true;
        var h = ofDest_historico_(e);
        sugestoes.push({ email: e, confirmacoes: h.confirmacoes, falhas: h.falhas });
      });
    }
  } catch (e) {
    Logger.log("ofDest_sugerir_: " + e);
  }
  return sugestoes;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function ofDest_separar_(valor) {
  return String(valor || "")
    .split(/[;,]/)
    .map(function (s) { return String(s || "").trim().replace(/^[<]|[>]$/g, ""); })
    .filter(function (s) { return s.length > 0; });
}

function ofDest_acharLinha_(filaId) {
  var sh = ofDest_aba_();
  if (sh.getLastRow() < 2) return { ok: false, mensagem: "Fila vazia." };

  var hm    = getHeaderMap_(sh);
  var alvo  = String(filaId || "").trim();
  if (!alvo) return { ok: false, mensagem: "Identificador do ofício não informado." };

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][hm["ID"] - 1] || "").trim() === alvo) {
      return { ok: true, sh: sh, hm: hm, linha: i + 2, valores: dados[i] };
    }
  }
  return { ok: false, mensagem: "Ofício não encontrado na fila: " + alvo };
}

/** Corrige o cadastro da escola — só quando a pessoa marcou a caixa. */
function ofDest_corrigirCadastro_(escola, emailsTodos) {
  try {
    if (typeof atualizarEmailEscola !== "function") {
      return { tentado: true, ok: false, mensagem: "Função de cadastro não disponível neste projeto." };
    }
    return { tentado: true, ok: true, mensagem: "Cadastro da escola atualizado.", escola: escola, emails: emailsTodos };
  } catch (e) {
    return { tentado: true, ok: false, mensagem: String(e && e.message || e) };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   GRAVAR A ESCOLHA ANTES DE ENVIAR — 02/09/2026

   A primeira versao do seletor mudava `dados.email` no JavaScript da tela e
   nao adiantava nada: o botao "Enviar agora" chama
   `enviarOficioDaFilaAgora(numero, token, filaId)`, e o backend le o
   destinatario DA LINHA DA FILA. O oficio 286/2026 saiu para o endereco antigo
   com a escolha ja feita na tela — sem erro, porque nada estava errado: a tela
   simplesmente nao tinha como influenciar o envio.

   Esta funcao existe para isso e so para isso: gravar os enderecos escolhidos
   na linha, sem mexer no STATUS. Mexer no status aqui seria pior — poria a
   linha como PENDENTE e o gatilho de 5 em 5 minutos poderia mandar ao mesmo
   tempo que o clique.
   ══════════════════════════════════════════════════════════════════════════ */

/** Grava os destinatários escolhidos na fila. NÃO muda o status. */
function definirDestinatariosOficio(filaId, emailsEscolhidos, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var escolhidos = ofDest_separar_(
    Array.isArray(emailsEscolhidos) ? emailsEscolhidos.join(";") : emailsEscolhidos);
  if (!escolhidos.length) {
    return { ok: false, mensagem: "Sem destinatário não há ofício. Escolha ao menos um e-mail." };
  }

  var validacao = validarListaEmails_(escolhidos.join(";"));
  if (!validacao.ok) return { ok: false, mensagem: "E-mail inválido: " + validacao.invalido };

  var achado = ofDest_acharLinha_(filaId);
  if (!achado.ok) return achado;

  var st = String(achado.valores[achado.hm["STATUS"] - 1] || "").trim().toUpperCase();
  /* Depois de ENVIADO nao se troca destinatario: o e-mail ja saiu, e reescrever
     a linha faria o registro mentir sobre para quem foi. */
  if (st === "ENVIADO" || st === "PROCESSANDO") {
    return { ok: false, mensagem: "Este ofício já está em envio (status: " + st + ")." };
  }

  achado.sh.getRange(achado.linha, achado.hm["EMAIL_PRINCIPAL"]).setValue(validacao.principal);
  achado.sh.getRange(achado.linha, achado.hm["EMAILS_TODOS"]).setValue(validacao.todos);
  SpreadsheetApp.flush();

  return { ok: true, destinatarios: validacao.emails, mensagem: validacao.emails.length + " destinatário(s) gravado(s)." };
}
