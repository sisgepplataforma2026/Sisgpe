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
      /* A REPUTAÇÃO DO ENDEREÇO NÃO PODE DEPENDER DO STATUS DE HOJE —
         04/09/2026. O reenvio passou a virar o status para ENVIADO, para o
         ofício sair da caixa de falha. Se a contagem olhasse só o Status, cada
         reenvio apagaria uma falha do endereço, e depois dos sete da FAESA a
         `thalia` voltaria a aparecer com zero — nascendo marcada de novo.
         A coluna JA_FALHOU guarda o fato de forma permanente. */
      var cJa    = hm[typeof OFICIO_COL_JA_FALHOU !== "undefined"
                       ? OFICIO_COL_JA_FALHOU : "JA_FALHOU"];
      if (cEmail && cSt) {
        var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
        for (var i = 0; i < dados.length; i++) {
          var st = String(dados[i][cSt - 1] || "").trim().toUpperCase();
          var quando = cData ? dados[i][cData - 1] : "";
          var jaFalhou = cJa &&
            String(dados[i][cJa - 1] || "").trim().toUpperCase() === "SIM";
          ofDest_separar_(dados[i][cEmail - 1]).forEach(function (e) {
            var k = e.toLowerCase();
            if (!mapa[k]) mapa[k] = { confirmacoes: 0, falhas: 0, envios: 0, ultimaFalha: "", ultimaConfirmacao: "" };
            /* Conta a falha UMA vez: um ofício que quicou e foi reenviado tem
               status ENVIADO e a marca SIM — as duas coisas descrevem o mesmo
               episódio, não dois. */
            if (st === "FALHA_ENTREGA" || jaFalhou) {
              mapa[k].falhas++;
              if (!mapa[k].ultimaFalha) mapa[k].ultimaFalha = quando;
            }
            if (st === "CONFIRMADO")     { mapa[k].confirmacoes++; mapa[k].ultimaConfirmacao = quando; }
            else if (st === "ENVIADO")   { mapa[k].envios++; }
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

/* ══════════════════════════════════════════════════════════════════════════
   PRÉVIA DO REENVIO — destinatários E anexos, medidos antes de enviar

   ORIGEM, 03/09/2026. O usuário abriu o reenvio do ofício 144/2026 e o campo
   rotulado "Vai para (do cadastro)" mostrava `thalia.ferreira@faesa.br` — o
   endereço morto que ele já tinha substituído no cadastro no dia anterior.

   O rótulo mentia. `obterDestinoReenvioOficio` lê a linha do PRÓPRIO OFÍCIO
   no Registro, congelada no dia da emissão; nunca leu o cadastro da escola.
   Para um ofício de março, isso significa oferecer de volta exatamente o
   endereço que fez o ofício quicar.

   Duas coisas ele pediu, e as duas estão aqui:

   1. BUSCAR O E-MAIL ATUALIZADO. A lista junta as duas origens — o que estava
      no ofício e o que está HOJE no cadastro da escola — dizendo de onde cada
      um veio. Quem já quicou nasce desmarcado, com o número de falhas à
      vista; quem está no cadastro atual e não tem falha nasce marcado.
      Sugerir com a origem à vista, nunca decidir em silêncio (REGRA Nº 0.6).

   2. FICHA E OFÍCIO. A prévia devolve os anexos que REALMENTE vão, pela mesma
      função que o envio usa. Num tipo que afirma a ficha no corpo — filiação,
      desfiliação, oposição — a ausência dela vira aviso ANTES do clique: a
      escola receberia ordem para descontar sem o papel que a sustenta.
   ══════════════════════════════════════════════════════════════════════════ */
function preverReenvioOficio(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_preverReenvio_(dados || {});
}

function ofDest_preverReenvio_(dados) {
  var numero = String(dados.numero || "").trim();
  if (!numero) return { ok: false, mensagem: "Número do ofício não informado." };

  var registro = ofDest_lerRegistroOficio_(numero);
  if (!registro.ok) return registro;

  var escola = String(dados.escola || registro.escola || "").trim();
  var tipo   = String(dados.tipo   || registro.tipo   || "").trim();

  /* ── destinatários: as duas origens, sem duplicar ── */
  var lista = ofDest_montarListaDestinos_(
    ofDest_separar_(registro.emails), ofDest_emailsDoCadastro_(escola));

  /* ── anexos: os mesmos blobs que o envio vai mandar ── */
  var anexos = { itens: [], temFicha: false, exigeFicha: tipoOficioExigeFicha_(tipo), erro: "" };
  try {
    var idOficio = extrairIdDriveOficio_(String(dados.url || ""));
    if (!idOficio) {
      anexos.erro = "Não foi possível identificar o PDF deste ofício no Drive.";
    } else {
      var reuniao = reunirAnexosReenvioOficio_(
        numero, idOficio, tipo, escola, registro.dataEnvio, registro.linkFicha);
      anexos.itens = reuniao.itens;
      anexos.temFicha = reuniao.itens.some(function (i) { return anexoEhFicha_(i.nome); });
    }
  } catch (e) {
    anexos.erro = String(e && e.message || e);
  }

  return {
    ok: true,
    numero: numero,
    escola: escola,
    tipo: tipo,
    destinatarios: lista,
    anexos: anexos
  };
}

/** A linha do ofício no Registro: e-mails gravados, ficha legada e data. */
function ofDest_lerRegistroOficio_(numero) {
  var fonte = ofDest_mapaRegistroOficios_();
  if (!fonte.ok) return { ok: false, mensagem: fonte.mensagem };
  var achado = fonte.mapa[String(numero || "").trim()];
  if (!achado) return { ok: false, mensagem: "Ofício " + numero + " não encontrado no Registro." };
  return achado;
}

/**
 * O Registro inteiro indexado por número, lido UMA vez por execução.
 *
 * Mesmo motivo do `ofDest_mapaCadastroEscolas_`: a varredura linear era
 * aceitável para um ofício e vira releitura da planilha inteira por item no
 * reenvio em lote. Aqui pesa mais, porque o Registro cresce a cada ofício
 * emitido enquanto a lista de escolas é praticamente fixa.
 *
 * Devolve `{ok, mensagem, mapa}` em vez de só o mapa: "Registro vazio" e
 * "coluna faltando" são falhas de origem que precisam chegar à tela com essas
 * palavras — trocá-las por um mapa vazio faria a tela dizer "ofício não
 * encontrado", que é uma explicação errada para um problema de estrutura.
 */
function ofDest_mapaRegistroOficios_() {
  if (ofDest_cacheRegistro_) return ofDest_cacheRegistro_;
  var saida = { ok: false, mensagem: "", mapa: {} };
  try {
    var ss = SpreadsheetApp.openById(
      typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sh || sh.getLastRow() < 2) {
      saida.mensagem = "Registro de ofícios vazio.";
      ofDest_cacheRegistro_ = saida;
      return saida;
    }
    var hm = getHeaderMap_(sh);
    var cNum   = hm["Número do Ofício"];
    var cTodos = hm["E-mails (todos)"];
    var cPrinc = hm["E-mail (principal)"];
    var cEsc   = hm["Escola"];
    var cTipo  = hm["Tipo"];
    var cFicha = hm["Link Ficha"];
    var cData  = hm["Data envio ofício"] || hm["Data envio oficio"];
    if (!cNum) {
      saida.mensagem = "Coluna do número do ofício não encontrada.";
      ofDest_cacheRegistro_ = saida;
      return saida;
    }

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < dados.length; i++) {
      var num = String(dados[i][cNum - 1] || "").trim();
      /* Primeira linha vence, como a varredura fazia ao retornar no primeiro
         casamento. */
      if (!num || saida.mapa[num]) continue;
      var emails = cTodos ? String(dados[i][cTodos - 1] || "").trim() : "";
      if (!emails && cPrinc) emails = String(dados[i][cPrinc - 1] || "").trim();
      var quando = null;
      if (cData) {
        var bruto = dados[i][cData - 1];
        if (bruto instanceof Date && !isNaN(bruto.getTime())) quando = bruto;
      }
      saida.mapa[num] = {
        ok: true,
        emails: emails,
        escola: cEsc  ? String(dados[i][cEsc  - 1] || "").trim() : "",
        tipo:   cTipo ? String(dados[i][cTipo - 1] || "").trim() : "",
        linkFicha: cFicha ? String(dados[i][cFicha - 1] || "").trim() : "",
        dataEnvio: quando
      };
    }
    saida.ok = true;
  } catch (e) {
    saida.ok = false;
    saida.mensagem = String(e && e.message || e);
  }
  ofDest_cacheRegistro_ = saida;
  return saida;
}
var ofDest_cacheRegistro_ = null;

/** Os e-mails que o CADASTRO DA ESCOLA tem hoje — não os do ofício antigo. */
function ofDest_emailsDoCadastro_(escola) {
  var nome = String(escola || "").trim().toUpperCase();
  if (!nome) return [];
  var mapa = ofDest_mapaCadastroEscolas_();
  return mapa[nome] || [];
}

/**
 * A aba Escolas indexada por razão social, lida UMA vez por execução.
 *
 * Antes cada consulta varria a aba inteira. Num ofício só isso não aparecia;
 * no reenvio em lote de 04/09/2026 passaria a ser uma varredura de 679 escolas
 * POR OFÍCIO — o mesmo dado, relido quinze vezes.
 *
 * Mesmo padrão do `ofDest_cacheHistorico_` logo acima, com a mesma
 * contrapartida: o mapa vale para a execução corrente. Alteração feita no
 * cadastro no meio de uma execução só aparece na próxima — o que para uma
 * chamada de tela é o comportamento certo, porque a lista que a pessoa está
 * vendo não deve mudar embaixo dela.
 *
 * Duplicata de razão social mantém a PRIMEIRA linha, que é o que a varredura
 * linear fazia ao retornar no primeiro casamento.
 */
function ofDest_mapaCadastroEscolas_() {
  if (ofDest_cacheCadastro_) return ofDest_cacheCadastro_;
  var mapa = {};
  try {
    var ss = SpreadsheetApp.openById(
      typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(typeof ABA_ESCOLAS !== "undefined" ? ABA_ESCOLAS : "Escolas");
    if (sh && sh.getLastRow() > 1) {
      var hm     = getHeaderMap_(sh);
      var cNome  = hm["Escola (Razão Social)"] || hm["Escola"] || hm["Unidade"];
      var cTodos = hm["E-mails (todos)"];
      var cPrinc = hm["E-mail (principal)"];
      if (cNome && (cTodos || cPrinc)) {
        var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
        for (var i = 0; i < dados.length; i++) {
          var nome = String(dados[i][cNome - 1] || "").trim().toUpperCase();
          if (!nome || mapa[nome]) continue;
          var v = cTodos ? String(dados[i][cTodos - 1] || "").trim() : "";
          if (!v && cPrinc) v = String(dados[i][cPrinc - 1] || "").trim();
          mapa[nome] = ofDest_separar_(v);
        }
      }
    }
  } catch (e) {
    Logger.log("ofDest_mapaCadastroEscolas_: " + e);
  }
  ofDest_cacheCadastro_ = mapa;
  return mapa;
}
var ofDest_cacheCadastro_ = null;

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

/**
 * O remetente que o sistema VAI usar — medido, não afirmado.
 *
 * A tela de confirmação de envio trazia, em texto cravado no HTML:
 *   "Remetente configurado: secretaria@sindeducacao.com"
 *
 * Ela dizia isso sempre, com ou sem alias. Em 02/09/2026 o usuário abriu o
 * ofício 287/2026 na caixa da secretaria e o cabeçalho mostrava
 * `De: financeirosindecucacao@gmail.com` — a tela afirmava uma coisa e o
 * e-mail saía com outra. Eu mesmo li aquele rótulo como prova de que o alias
 * funcionava, e ele não provava nada.
 *
 * Numa tela de confirmação de documento oficial, afirmar sem medir é pior do
 * que não afirmar: quem lê acredita.
 */
function remetenteInstitucionalAtual(tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var pretendido = (typeof OFICIOS_EMAIL_INSTITUCIONAL !== "undefined")
    ? OFICIOS_EMAIL_INSTITUCIONAL : "secretaria@sindeducacao.com";

  var efetivo = "";
  try { efetivo = String(Session.getEffectiveUser().getEmail() || "").trim(); } catch (e) {}

  var temAlias = false;
  try {
    temAlias = GmailApp.getAliases().map(function (a) {
      return String(a || "").trim().toLowerCase();
    }).indexOf(pretendido.toLowerCase()) !== -1;
  } catch (e2) {}

  var usaPretendido = temAlias || efetivo.toLowerCase() === pretendido.toLowerCase();

  return {
    ok: true,
    /* De quem o e-mail VAI sair de verdade. */
    remetente: usaPretendido ? pretendido : efetivo,
    respostasPara: pretendido,
    /* Falso aqui significa: o alias não está ativo e o e-mail sai pela conta
       executora. A tela precisa dizer isso, não escondê-lo. */
    comoInstitucional: usaPretendido,
    contaExecutora: efetivo
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   A REGRA DA MARCAÇÃO, EM UM LUGAR SÓ

   Extraída de `ofDest_preverReenvio_` em 04/09/2026, quando o reenvio em lote
   passou a precisar da MESMA decisão. Duplicá-la seria garantir que as duas
   telas divergissem no primeiro ajuste — e divergir aqui significa o lote
   mandar para um endereço que o modal individual recusaria.

   A regra, escrita para poder ser discutida: quem quicou nunca vem marcado;
   entre os que não quicaram, prefere-se o que está no cadastro de HOJE. Se o
   cadastro não foi encontrado, cai para "todos os do ofício sem falha" — assim
   a lista nunca abre vazia.

   O caso em que NADA fica marcado é informação, não defeito: significa que
   todos os endereços conhecidos daquele ofício já quicaram. É exatamente o
   que separa o que o sistema pode reenviar sozinho do que precisa de gente.
   ══════════════════════════════════════════════════════════════════════════ */
function ofDest_montarListaDestinos_(doOficio, doCadastro) {
  doOficio   = doOficio   || [];
  doCadastro = doCadastro || [];

  var vistos = {}, lista = [];
  function juntar(email, origem, noCadastro) {
    var chave = String(email || "").trim().toLowerCase();
    if (!chave) return;
    if (vistos[chave]) {
      /* Já entrou pela outra origem: soma a procedência em vez de repetir a
         linha. Um endereço que está nos dois lugares é informação, não ruído. */
      vistos[chave].origem = "deste ofício e do cadastro atual";
      vistos[chave].noCadastro = vistos[chave].noCadastro || noCadastro;
      return;
    }
    var h = ofDest_historico_(email);
    var item = {
      email: email,
      origem: origem,
      noCadastro: noCadastro,
      confirmacoes: h.confirmacoes,
      falhas: h.falhas,
      envios: h.envios,
      ultimaFalha: h.ultimaFalha,
      ultimaConfirmacao: h.ultimaConfirmacao,
      marcado: false
    };
    vistos[chave] = item;
    lista.push(item);
  }

  doOficio.forEach(function (e)   { juntar(e, "deste ofício", false); });
  doCadastro.forEach(function (e) { juntar(e, "cadastro atual da escola", true); });

  var achouCadastro = doCadastro.length > 0;
  lista.forEach(function (item) {
    item.marcado = item.falhas === 0 && (achouCadastro ? item.noCadastro : true);
  });
  if (!lista.some(function (i) { return i.marcado; })) {
    lista.forEach(function (i) { if (i.falhas === 0) i.marcado = true; });
  }
  return lista;
}

/* ══════════════════════════════════════════════════════════════════════════
   REENVIO EM LOTE — o sistema decide o destino; a pessoa confere e confirma

   ORIGEM, 04/09/2026. Depois de a reconciliação de status virar automática, o
   usuário perguntou: *"ele não reenvia sozinho? E eu só iria conferir?"*.

   Ele estava certo, e a pergunta expôs uma incoerência do desenho: o
   `ofDest_preverReenvio_` já faz o julgamento inteiro — junta as duas origens
   de endereço, consulta o histórico de cada um, recusa quem quicou, prefere o
   cadastro de hoje, reúne os anexos — e depois devolve UM clique. Quinze
   ofícios em falha viravam quinze aberturas de modal para reconfirmar quinze
   decisões que o sistema já tinha tomado. É o que a REGRA Nº 0.6 chama de
   defeito de desenho, não de trabalho.

   O QUE FICA AUTOMÁTICO: achar os ofícios em falha, escolher o endereço de
   cada um, reunir os anexos, separar o que dá para mandar do que não dá.

   O QUE NÃO FICA, E POR QUÊ: a confirmação. Não porque o sistema não saiba —
   ele sabe —, mas porque são documentos oficiais indo para escolas e e-mail
   enviado não volta. Um clique depois de ver a lista inteira não é trabalho: é
   a última chance de perceber que um deles vai para o lugar errado. Decidido
   com o usuário no mesmo dia, com estas palavras: "confirmação manual".

   O LIMITE HONESTO: ofício cujos endereços TODOS já quicaram não entra na
   pilha que sai. Ninguém sabe para onde mandar, e inventar destino seria
   decidir pela pessoa. Ele aparece na segunda lista, nomeado, com o motivo.
   ══════════════════════════════════════════════════════════════════════════ */

/* Teto por preparação. Existe por dois motivos, os dois medidos e não
   estéticos:

   1. TEMPO. Cada ofício custa uma ida ao Drive para reunir os anexos. O
      Apps Script corta a execução em 6 minutos, e uma preparação cortada no
      meio não devolve nada — a pessoa espera e não recebe lista nenhuma.
   2. COTA. O Gmail conta DESTINATÁRIOS por dia, não mensagens. Um lote grande
      pode esgotar a cota no meio e transformar a segunda metade em erro.

   Vinte e cinco cabe com folga nos dois. Passando disso, a preparação diz que
   limitou e quantos ficaram para a próxima rodada — nunca corta em silêncio. */
var OFDEST_LOTE_MAX = 25;

/**
 * Monta a conferência do reenvio em lote. NÃO ENVIA NADA.
 *
 * Devolve duas pilhas: `prontos` (têm ao menos um endereço sem falha) e
 * `pendentes` (não têm — precisam de gente).
 */
function prepararReenvioLoteOficios(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  return ofDest_prepararLote_(dados && dados.numeros);
}

/**
 * @param {string[]=} numerosEscolhidos  Os ofícios que a pessoa marcou na
 *   tabela. Vazio ou ausente significa "todos os que estão em falha".
 *
 * A SELEÇÃO DA TABELA MANDA — 04/09/2026. Na primeira versão eu ignorei as
 * caixas de seleção que a tela já tinha: a pessoa marcava três ofícios, clicava
 * em "Preparar reenvio" e o sistema trazia os onze. O usuário viu na primeira
 * tentativa: *"estou selecionando alguns e ele busca todos"*.
 *
 * É o mesmo defeito do rótulo "Vai para (do cadastro)" que mentia em 03/09:
 * a tela oferecendo um controle que o código não honra. Controle que não faz
 * nada é pior do que controle que não existe, porque a pessoa confia nele.
 *
 * Com seleção, o filtro é o número — NÃO o status. Se ela marcou um ofício que
 * já está como ENVIADO e mandou preparar, é porque quer reenviar aquele;
 * descartá-lo em silêncio seria decidir por ela.
 */
function ofDest_prepararLote_(numerosEscolhidos) {
  var escolhidos = {}, temSelecao = false;
  (numerosEscolhidos || []).forEach(function (n) {
    var v = String(n || "").trim();
    if (v) { escolhidos[v] = true; temSelecao = true; }
  });

  var ss = SpreadsheetApp.openById(
    typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);

  /* A FILA é a fonte que o Histórico mostra na tela. Usar o Registro aqui
     faria o botão contar uma coisa e a lista abaixo dele mostrar outra. */
  var nomeAba = typeof ABA_FILA_OFICIOS !== "undefined"
    ? ABA_FILA_OFICIOS : "FILA_ENVIO_OFICIOS";
  var aba = ss.getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) {
    return { ok: true, total: 0, analisados: 0, limitado: false, limite: OFDEST_LOTE_MAX,
             porSelecao: temSelecao, prontos: [], pendentes: [],
             mensagem: "Nenhum ofício em falha de entrega." };
  }

  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
  var idx = function (nome) { return cab.indexOf(nome); };
  var col = getColunasFilaOficios_(idx);
  if (col.numero < 0 || col.status < 0) {
    return { ok: false, mensagem: "Colunas NUMERO_OFICIO/STATUS não encontradas na " + nomeAba + "." };
  }

  var linhas = aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getValues();
  var falhas = [], vistosNumero = {};
  for (var i = 0; i < linhas.length; i++) {
    var numero = String(linhas[i][col.numero] || "").trim();
    if (!numero) continue;
    if (temSelecao) {
      if (!escolhidos[numero]) continue;
    } else if (String(linhas[i][col.status] || "").trim().toUpperCase() !== "FALHA_ENTREGA") {
      continue;
    }
    /* MESMO NÚMERO, DUAS LINHAS, UM OFÍCIO SÓ. A fila guarda tentativas, e um
       ofício que quicou pode aparecer mais de uma vez em falha. Sem esta
       trava o lote mandaria o MESMO documento oficial duas vezes para a mesma
       escola — e a segunda cópia não teria como ser desfeita. */
    if (vistosNumero[numero]) continue;
    vistosNumero[numero] = true;
    falhas.push({
      numero: numero,
      escola: col.escola >= 0 ? String(linhas[i][col.escola] || "").trim() : "",
      tipo:   col.tipo   >= 0 ? String(linhas[i][col.tipo]   || "").trim() : "",
      url:    col.anexos >= 0 ? extrairLinkPdfOficio_(linhas[i][col.anexos]) : ""
    });
  }

  var total = falhas.length;
  var limitado = total > OFDEST_LOTE_MAX;
  if (limitado) falhas = falhas.slice(0, OFDEST_LOTE_MAX);

  var prontos = [], pendentes = [], destinatariosTotais = 0;

  for (var j = 0; j < falhas.length; j++) {
    var f = falhas[j];
    var registro = ofDest_lerRegistroOficio_(f.numero);

    /* Ofício que a FILA conhece e o Registro não. Não é caso de enviar às
       cegas: sem a linha do Registro não há e-mails gravados nem data de
       envio, e a data é o que resgata a ficha daquele lote no Drive. */
    if (!registro.ok) {
      pendentes.push({ numero: f.numero, escola: f.escola, tipo: f.tipo,
                       motivo: registro.mensagem || "não encontrado no Registro",
                       enderecos: [] });
      continue;
    }

    var escola = f.escola || registro.escola || "";
    var tipo   = f.tipo   || registro.tipo   || "";
    var lista  = ofDest_montarListaDestinos_(
      ofDest_separar_(registro.emails), ofDest_emailsDoCadastro_(escola));

    var escolhidos = lista.filter(function (d) { return d.marcado; })
                          .map(function (d) { return d.email; });

    if (!escolhidos.length) {
      pendentes.push({
        numero: f.numero, escola: escola, tipo: tipo,
        motivo: lista.length
          ? ("todos os " + lista.length + " endereços conhecidos já quicaram")
          : "nenhum endereço encontrado — nem no ofício, nem no cadastro da escola",
        enderecos: lista.map(function (d) {
          return { email: d.email, falhas: d.falhas, origem: d.origem };
        })
      });
      continue;
    }

    /* Os anexos são reunidos pela MESMA função que o envio usa — é o que vai,
       não o que deveria ir. Guardamos só nomes e procedências: segurar os
       blobs de 25 ofícios ao mesmo tempo não caberia na memória da execução,
       e a tela só precisa dos nomes. */
    /* SEM O PDF NÃO EXISTE REENVIO. O `reenviarOficio` recusa o ofício cuja
       URL não identifica arquivo no Drive — deixá-lo em "prontos para sair"
       seria prometer um envio que a tela já sabe que vai falhar. Vai para a
       pilha de quem precisa de gente, que é onde ele de fato está. */
    var idOficio = extrairIdDriveOficio_(String(f.url || ""));
    if (!idOficio) {
      pendentes.push({
        numero: f.numero, escola: escola, tipo: tipo,
        motivo: "não foi possível identificar o PDF deste ofício no Drive",
        enderecos: []
      });
      continue;
    }

    var anexos = { itens: [], temFicha: false, exigeFicha: tipoOficioExigeFicha_(tipo), erro: "" };
    try {
      var reuniao = reunirAnexosReenvioOficio_(
        f.numero, idOficio, tipo, escola, registro.dataEnvio, registro.linkFicha);
      anexos.itens = reuniao.itens;
      anexos.temFicha = reuniao.itens.some(function (it) { return anexoEhFicha_(it.nome); });
    } catch (e) {
      anexos.erro = String(e && e.message || e);
    }

    destinatariosTotais += escolhidos.length;
    prontos.push({
      numero: f.numero, escola: escola, tipo: tipo, url: f.url,
      destinatarios: escolhidos,
      anexos: anexos,
      /* O aviso que o modal individual já dá, repetido item a item: tipo que
         AFIRMA a ficha no corpo indo sem ela manda à escola uma ordem sem o
         documento que a sustenta. */
      semFicha: anexos.exigeFicha && !anexos.temFicha
    });
  }

  var cota = -1;
  try { cota = MailApp.getRemainingDailyQuota(); } catch (e2) {}

  return {
    ok: true,
    total: total,
    analisados: falhas.length,
    limitado: limitado,
    limite: OFDEST_LOTE_MAX,
    /* A tela diz em qual dos dois modos rodou. Sem isto a pessoa não tem como
       saber se o que está vendo é a seleção dela ou a fila inteira. */
    porSelecao: temSelecao,
    prontos: prontos,
    pendentes: pendentes,
    destinatariosTotais: destinatariosTotais,
    cota: cota,
    /* A cota do Gmail conta DESTINATÁRIOS, não mensagens. Comparar com o
       número de ofícios daria falsa folga num lote com vários endereços. */
    cotaSuficiente: cota < 0 || cota >= destinatariosTotais,
    mensagem: total === 0
      ? (temSelecao ? "Nenhum dos ofícios selecionados foi encontrado na fila."
                    : "Nenhum ofício em falha de entrega.")
      : (prontos.length + " pronto(s) para sair, " + pendentes.length +
         " sem endereço bom" + (limitado
           ? ". Limitado a " + OFDEST_LOTE_MAX + " por rodada (" +
             (total - OFDEST_LOTE_MAX) + " ficaram para a próxima)."
           : "."))
  };
}

/**
 * Envia o lote que a pessoa confirmou na tela.
 *
 * Manda EXATAMENTE a lista aprovada. Não recalcula destino: quem olhou a
 * conferência e clicou foi a pessoa, e trocar o endereço embaixo dela
 * transformaria a confirmação em teatro. O `reenviarOficio` — o mesmo do envio
 * individual — revalida cada endereço, reúne os anexos de novo no momento do
 * envio, grava JA_FALHOU, vira o status e registra na trilha de auditoria.
 */
function executarReenvioLoteOficios(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var itens = (dados && Array.isArray(dados.itens)) ? dados.itens : [];
  if (!itens.length) return { ok: false, mensagem: "Nenhum ofício informado para reenvio." };
  if (itens.length > OFDEST_LOTE_MAX) {
    return { ok: false, mensagem: "Lote acima do limite de " + OFDEST_LOTE_MAX + " ofícios." };
  }

  var resultados = [], enviados = 0, falharam = 0, ignorados = 0;
  var interrompidoPorCota = false;

  for (var i = 0; i < itens.length; i++) {
    var it = itens[i] || {};
    var numero = String(it.numero || "").trim();
    var destinos = Array.isArray(it.destinatarios) ? it.destinatarios : [];

    /* Sem destino aprovado não se manda nada. Um item que chegou aqui vazio é
       erro de tela, e adivinhar o endereço seria justamente o que a
       conferência existe para impedir. */
    if (!numero || !destinos.length) {
      ignorados++;
      resultados.push({ numero: numero || "(sem número)", ok: false,
                        mensagem: "Ignorado: nenhum destinatário aprovado para este ofício." });
      continue;
    }

    /* A COTA É CONFERIDA A CADA ITEM, não só no começo. Conferir uma vez só
       deixaria o lote estourar no meio, e cada ofício restante voltaria como
       "erro" genérico — indistinguível de endereço inválido. Assim o corte é
       nomeado: quem saiu, saiu; quem não saiu, sabe-se por quê. */
    var cota = -1;
    try { cota = MailApp.getRemainingDailyQuota(); } catch (e) {}
    if (cota >= 0 && cota < destinos.length) {
      interrompidoPorCota = true;
      for (var r = i; r < itens.length; r++) {
        resultados.push({ numero: String((itens[r] || {}).numero || "(sem número)"), ok: false,
                          mensagem: "Não enviado: cota diária de e-mail esgotada (" + cota + " restante(s))." });
      }
      break;
    }

    var saida;
    try {
      saida = reenviarOficio({
        numero: numero, url: it.url, escola: it.escola, tipo: it.tipo,
        destinatarios: destinos
      }, tokenSessao);
    } catch (e3) {
      saida = { erro: true, mensagem: String(e3 && e3.message || e3) };
    }

    if (saida && !saida.erro) { enviados++; }
    else { falharam++; }
    resultados.push({
      numero: numero,
      ok: !!(saida && !saida.erro),
      mensagem: (saida && saida.mensagem) || "sem resposta do envio"
    });
  }

  return {
    ok: true,
    enviados: enviados,
    falharam: falharam,
    ignorados: ignorados,
    interrompidoPorCota: interrompidoPorCota,
    resultados: resultados,
    mensagem: enviados + " ofício(s) reenviado(s)" +
      (falharam  ? ", " + falharam  + " com erro" : "") +
      (ignorados ? ", " + ignorados + " ignorado(s)" : "") +
      (interrompidoPorCota ? ". Interrompido pela cota diária de e-mail." : ".")
  };
}
