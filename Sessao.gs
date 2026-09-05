// ============================================================================
// 📄 ARQUIVO: Sessao.gs
// 🔐 Sessão de Login e Recuperação de Senha
//    Usado por Login1.gs (autenticarUsuario, trocarSenhaPrimeiroAcesso)
//    Depende de: PLANILHA_ID, ABA_USUARIOS_LOGIN, gerarHashSenha_ (Login1.gs),
//                validarSenhaForte_ (Login1.gs),
//                _localizarLinhaUsuarioPorIdentificador_ (Login1.gs),
//                _validarColunasObrigatorias_ (Login1.gs)
// ============================================================================

var SESSAO_CONFIG = {
  // O CacheService do Apps Script tem um teto real de 6 horas (21600s).
  // Valores acima disso eram cortados silenciosamente pelo Google — por isso
  // a sessão expirava em 6h mesmo com "8 * 60 * 60" escrito aqui.
  DURACAO_SEGUNDOS: 6 * 60 * 60,         // 6 horas de sessão (máximo real do CacheService)
  TOKEN_RECUPERACAO_SEGUNDOS: 30 * 60,   // 30 minutos para o link de recuperação
  CHAVE_CACHE_SESSAO: "SESSAO_SISGEP_",
  CHAVE_CACHE_RECUPERACAO: "RECUPERAR_SENHA_"
};

// ============================================================================
// LIMITE DE SOLICITAÇÕES DE RECUPERAÇÃO DE SENHA
// ============================================================================
// Evita spam de e-mail de recuperação para o mesmo usuário/e-mail em um
// curto intervalo de tempo.

var RECUPERACAO_LIMITE_CONFIG = {
  MAX_SOLICITACOES: 3,
  JANELA_SEGUNDOS: 60 * 60, // 1 hora
  CHAVE_CACHE: "RECUP_LIMITE_"
};


// ============================================================================
// SALVAR SESSÃO
// ============================================================================

/**
 * Salva a sessão do usuário autenticado no CacheService (compartilhado,
 * protegido pelo token — um UUID imprevisível). Não depende mais da
 * identidade "anônima" do navegador (UserCache/UserProperties), que
 * causava mistura de sessão entre usuários no mesmo computador/navegador.
 *
 * @param {Object} dados { usuario, nome, email, perfil }
 * @returns {string} token da sessão criada
 */
function salvarSessaoUsuario_(dados) {
  dados = dados || {};

  var token = Utilities.getUuid();
  var agora = new Date().getTime();
  var sessao = {
    token: token,
    logado: true,
    usuario: String(dados.usuario || "").trim().toLowerCase(),
    nome: String(dados.nome || "").trim(),
    email: String(dados.email || "").trim().toLowerCase(),
    perfil: String(dados.perfil || "Administrador").trim(),
    // Módulos que este usuário pode abrir. "TODOS" (ou ausente) = tudo,
    // que é o comportamento de sempre — ver AcessoModulos.gs. Fica
    // gravado na sessão para não reler a planilha a cada chamada; por
    // isso mudança de acesso só vale no PRÓXIMO login do usuário.
    modulos: (dados.modulos === undefined || dados.modulos === null || dados.modulos === "")
      ? "TODOS" : dados.modulos,
    criadoEm: agora,
    expiraEm: agora + (SESSAO_CONFIG.DURACAO_SEGUNDOS * 1000)
  };

  var chave = SESSAO_CONFIG.CHAVE_CACHE_SESSAO + token;
  var json = JSON.stringify(sessao);

  CacheService.getScriptCache().put(chave, json, SESSAO_CONFIG.DURACAO_SEGUNDOS);
  PropertiesService.getScriptProperties().setProperty(chave, json);

  return token;
}


// ============================================================================
// OBTER SESSÃO ATUAL
// ============================================================================

/**
 * Retorna os dados da sessão a partir de um token explícito.
 * O token deve ser fornecido pelo chamador — vem da URL (?sessao=token)
 * no carregamento da página, ou de uma variável já embutida no cliente
 * depois disso. Se o token não existir ou tiver expirado, retorna null.
 *
 * @param {string} token
 * @returns {Object|null} { token, usuario, nome, email, perfil, criadoEm } ou null
 */
function getSessaoUsuario(token) {
  token = String(token || "").trim();
  if (!token) return null;

  var chave = SESSAO_CONFIG.CHAVE_CACHE_SESSAO + token;
  var cache = CacheService.getScriptCache();
  var bruto = cache.get(chave);

  if (!bruto) {
    bruto = PropertiesService.getScriptProperties().getProperty(chave);
  }
  if (!bruto) return null;

  try {
    var sessao = JSON.parse(bruto);
    var sessaoAlterada = sessao.logado !== true;
    if (sessaoAlterada) sessao.logado = true;
    var expiraEm = Number(sessao.expiraEm || 0);
    if (!expiraEm || expiraEm <= new Date().getTime()) {
      cache.remove(chave);
      PropertiesService.getScriptProperties().deleteProperty(chave);
      return null;
    }
    var agora = new Date().getTime();
    if (expiraEm - agora <= 60 * 60 * 1000) {
      sessao.expiraEm = agora + SESSAO_CONFIG.DURACAO_SEGUNDOS * 1000;
      sessaoAlterada = true;
    }
    if (sessaoAlterada) {
      bruto = JSON.stringify(sessao);
      PropertiesService.getScriptProperties().setProperty(chave, bruto);
    }
    cache.put(chave, bruto, SESSAO_CONFIG.DURACAO_SEGUNDOS);
    return sessao;
  } catch (e) {
    cache.remove(chave);
    PropertiesService.getScriptProperties().deleteProperty(chave);
    return null;
  }
}


/**
 * Encerra a sessão identificada pelo token informado (logout).
 * Só remove a sessão que corresponde exatamente a esse token — nunca
 * derruba a sessão de outro usuário por engano.
 *
 * @param {string} token
 * @returns {Object} { ok: true }
 */
function encerrarSessaoUsuario(token) {
  token = String(token || "").trim();

  /* Quem está saindo, lido ANTES de destruir a sessão — depois não há mais
   * de onde tirar o nome. Sem isto o registro de saída seria anônimo, e a
   * pergunta "até que horas fulano ficou no sistema" não teria resposta. */
  var quem = "";
  try {
    if (token && typeof getSessaoUsuario === "function") {
      var s = getSessaoUsuario(token);
      if (s) quem = s.email || s.usuario || "";
    }
  } catch (e) {}

  if (token) {
    var chave = SESSAO_CONFIG.CHAVE_CACHE_SESSAO + token;
    CacheService.getScriptCache().remove(chave);
    PropertiesService.getScriptProperties().deleteProperty(chave);
  }

  try {
    if (typeof aud_deAcesso_ === "function") aud_deAcesso_("SAIR", quem, "");
  } catch (e) { Logger.log("[acesso] ponte de auditoria falhou: " + e.message); }

  return { ok: true };
}


// ============================================================================
// GERAR RECUPERAÇÃO DE SENHA
// ============================================================================

/**
 * Gera um token de recuperação de senha e envia por e-mail (MailApp).
 * Busca o usuário pela coluna USUARIO ou EMAIL na aba ABA_USUARIOS_LOGIN.
 *
 * @param {string} loginOuEmail
 * @returns {Object} { ok, mensagem }
 */
function gerarRecuperacaoSenha(loginOuEmail) {

  var valor = String(loginOuEmail || "").trim().toLowerCase();

  if (!valor) {
    return { ok: false, mensagem: "Informe seu usuário ou e-mail." };
  }

  // Resposta genérica reutilizada em todos os casos "silenciosos" — não
  // confirma nem nega existência de conta, nem expõe o e-mail cadastrado.
  var respostaGenerica = { ok: true, mensagem: "Se o usuário existir, um link de recuperação será enviado por e-mail." };

  // ── LIMITE DE SOLICITAÇÕES (atômico) ──────────────────────────────
  // Evita que o mesmo usuário/e-mail seja usado para disparar e-mails de
  // recuperação repetidamente em pouco tempo. Protegido por lock — leitura
  // e escrita do contador separadas permitiam duas requisições simultâneas
  // colidirem e o limite ser contornado.
  var podeSolicitar = true;
  var lockLimite = LockService.getScriptLock();
  try {
    lockLimite.waitLock(3000);
  } catch (e) {
    Logger.log("⚠ gerarRecuperacaoSenha — não obteve lock do limite, seguindo sem trava: " + e.message);
  }

  try {
    var cacheLimite = CacheService.getScriptCache();
    var chaveLimite = RECUPERACAO_LIMITE_CONFIG.CHAVE_CACHE + valor;
    var solicitacoesBruto = cacheLimite.get(chaveLimite);
    var solicitacoes = solicitacoesBruto ? Number(solicitacoesBruto) : 0;

    if (solicitacoes >= RECUPERACAO_LIMITE_CONFIG.MAX_SOLICITACOES) {
      podeSolicitar = false;
    } else {
      cacheLimite.put(chaveLimite, String(solicitacoes + 1), RECUPERACAO_LIMITE_CONFIG.JANELA_SEGUNDOS);
    }
  } finally {
    try { lockLimite.releaseLock(); } catch (e) {}
  }

  if (!podeSolicitar) {
    return respostaGenerica;
  }

  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_USUARIOS_LOGIN);

  if (!aba) {
    return { ok: false, mensagem: "Aba de usuários não encontrada." };
  }

  var dados = aba.getDataRange().getValues();

  if (dados.length < 2) {
    return respostaGenerica;
  }

  var cab = dados[0].map(function(h) {
    return String(h || "").trim().toUpperCase();
  });

  var idxUsuario = cab.indexOf("USUARIO");
  var idxEmail   = cab.indexOf("EMAIL");
  var idxNome    = cab.indexOf("NOME");
  var idxStatus  = cab.indexOf("STATUS");

  if (idxUsuario === -1 || idxEmail === -1 || idxStatus === -1) {
    Logger.log("⚠ gerarRecuperacaoSenha — colunas obrigatórias ausentes na aba de usuários.");
    return { ok: false, mensagem: "Erro de configuração da planilha de usuários. Contate o administrador." };
  }

  for (var i = 1; i < dados.length; i++) {

    var usuario = String(dados[i][idxUsuario] || "").trim().toLowerCase();
    var email   = String(dados[i][idxEmail]   || "").trim().toLowerCase();

    if (valor === usuario || valor === email) {

      var status = String(dados[i][idxStatus] || "").trim().toUpperCase();

      if (status !== "ATIVO") {
        return respostaGenerica;
      }

      if (!email) {
        return { ok: false, mensagem: "Usuário sem e-mail cadastrado. Contate o administrador." };
      }

      // Guarda o identificador canônico, não o número da linha — evita
      // quebra se a planilha for reordenada antes de o token ser usado.
      var idCanonico = usuario || email;
      var token = Utilities.getUuid();

      CacheService
        .getScriptCache()
        .put(
          SESSAO_CONFIG.CHAVE_CACHE_RECUPERACAO + token,
          idCanonico,
          SESSAO_CONFIG.TOKEN_RECUPERACAO_SEGUNDOS
        );

      var nome = String(dados[i][idxNome] || "").trim() || usuario;
      var link = getSistemaUrlBase() + "?recuperar=" + token;

      var corpoHtml =
        "<div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;'>" +
        "<h2 style='color:#002f6c;'>Recuperação de senha — SISGEP</h2>" +
        "<p>Olá, " + nome + ".</p>" +
        "<p>Recebemos uma solicitação para redefinir sua senha de acesso ao SISGEP.</p>" +
        "<p>Clique no link abaixo para criar uma nova senha. Este link expira em 30 minutos:</p>" +
        "<p><a href='" + link + "' style='background:#002f6c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;'>Redefinir minha senha</a></p>" +
        "<p style='font-size:12px;color:#888;'>Se você não solicitou isso, ignore este e-mail — sua senha atual continuará válida.</p>" +
        "<p style='font-size:12px;color:#888;'>SISGEP · SindEducação-ES</p>" +
        "</div>";

      try {
        MailApp.sendEmail({
          to: email,
          subject: "Recuperação de senha — SISGEP",
          htmlBody: corpoHtml
        });
      } catch (e) {
        Logger.log("⚠ gerarRecuperacaoSenha — falha ao enviar e-mail: " + e.message);
        return { ok: false, mensagem: "Não foi possível enviar o e-mail. Tente novamente em alguns minutos." };
      }

      // Resposta genérica mesmo em caso de sucesso — não confirma nem expõe
      // o e-mail cadastrado, mantendo consistência com os demais retornos
      // desta função (evita enumeração de contas).
      return respostaGenerica;
    }
  }

  return respostaGenerica;
}


// ============================================================================
// REDEFINIR SENHA COM TOKEN
// ============================================================================

/**
 * Redefine a senha do usuário usando o token gerado por gerarRecuperacaoSenha().
 *
 * @param {string} token
 * @param {string} novaSenha
 * @param {string} confirmarSenha
 * @returns {Object} { ok, mensagem }
 */
function redefinirSenhaComToken(token, novaSenha, confirmarSenha) {

  token          = String(token || "").trim();
  novaSenha      = String(novaSenha || "").trim();
  confirmarSenha = String(confirmarSenha || "").trim();

  if (!token) {
    return { ok: false, mensagem: "Link de recuperação inválido ou expirado." };
  }

  // Política de senha unificada com o primeiro acesso (Login1.gs).
  var validacaoSenha = validarSenhaForte_(novaSenha);
  if (!validacaoSenha.ok) {
    return validacaoSenha;
  }

  if (novaSenha !== confirmarSenha) {
    return { ok: false, mensagem: "As senhas não coincidem." };
  }

  var idCanonico;
  var lockToken = LockService.getScriptLock();
  lockToken.waitLock(5000);
  try {
    // Reivindica o token de forma atômica — lê e já remove antes de seguir,
    // pra evitar que o mesmo link de recuperação seja usado duas vezes em
    // requisições simultâneas.
    var cache = CacheService.getScriptCache();
    var chave = SESSAO_CONFIG.CHAVE_CACHE_RECUPERACAO + token;
    idCanonico = cache.get(chave);

    if (!idCanonico) {
      return { ok: false, mensagem: "Link de recuperação inválido ou expirado. Solicite um novo." };
    }

    cache.remove(chave);
  } finally {
    lockToken.releaseLock();
  }

  var localizacao = _localizarLinhaUsuarioPorIdentificador_(idCanonico);

  if (!localizacao) {
    return { ok: false, mensagem: "Usuário não encontrado. Contate o administrador." };
  }

  var validacaoColunas = _validarColunasObrigatorias_(localizacao.colunas, ["senha"]);
  if (!validacaoColunas.ok) {
    Logger.log("⚠ redefinirSenhaComToken — colunas ausentes: " + validacaoColunas.faltantes.join(", "));
    return { ok: false, mensagem: "Erro de configuração da planilha de usuários. Contate o administrador." };
  }

  var hash = gerarHashSenha_(novaSenha);

  // Lock para evitar escrita concorrente na planilha caso duas requisições
  // cheguem quase ao mesmo tempo (ex: duplo clique, múltiplas abas).
  var lockEscrita = LockService.getScriptLock();
  lockEscrita.waitLock(5000);
  try {
    localizacao.aba.getRange(localizacao.linha, localizacao.colunas.senha + 1).setValue(hash);

    if (localizacao.colunas.primeiro !== -1) {
      localizacao.aba.getRange(localizacao.linha, localizacao.colunas.primeiro + 1).setValue("");
    }
  } finally {
    lockEscrita.releaseLock();
  }

  return { ok: true, mensagem: "Senha redefinida com sucesso." };
}

/**
 * Exige uma sessão SISGEP válida para operações administrativas de Documentos.
 * Nunca usa Session.getEffectiveUser(), pois o web app executa como o proprietário.
 */
function exigirSessaoDocumentos_(tokenSessao, exigirAdministrador) {
  var sessao = getSessaoUsuario(tokenSessao);
  if (!sessao || sessao.logado !== true) {
    throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
  }

  if (exigirAdministrador === true) {
    var perfil = String(sessao.perfil || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (perfil.indexOf("ADMIN") === -1) {
      throw new Error("Ação permitida somente para administradores.");
    }
  }

  return sessao;
}


/* ══════════════════════════════════════════════════════════════════════════
   LIMPEZA DAS SESSÕES EXPIRADAS
   Acrescentado em 31/08/2026.

   O QUE ORIGINOU

   A tela de Propriedades do script parou de mostrar tudo — passou de 50 e o
   Apps Script trunca a lista. Olhando o que havia lá, a maioria esmagadora
   eram sessões: 46 delas, todas do mesmo usuário, criadas entre 18 e 31/08.
   Treze dias, ~3,5 sessões por dia.

   POR QUE ELAS FICAM

   Cada login grava SESSAO_SISGEP_<uuid> nas propriedades. A limpeza existe,
   mas só dispara quando alguém APRESENTA aquele token específico já vencido
   — getSessaoUsuario apaga na hora de validar. Quem entra, fecha o navegador
   e nunca mais volta com aquele token deixa a propriedade para sempre. A
   sessão dura 6 horas; a propriedade, indefinidamente.

   POR QUE ISSO É PROBLEMA, e não só bagunça

   O armazenamento de propriedades tem teto de 500 KB. Cada sessão ocupa ~261
   bytes, o que dá cerca de 1.900 sessões. No ritmo de UMA pessoa testando,
   isso é pouco mais de um ano; com a equipe usando, bem menos.

   E o que quebra quando o teto chega é o LOGIN — porque é ali que a sessão é
   gravada. O erro não vai dizer "excesso de sessões velhas": vai dizer que
   não conseguiu gravar, e ninguém liga uma coisa à outra.

   O CUIDADO QUE IMPORTA

   Só apaga o que JÁ VENCEU. Sessão viva não se toca — apagar uma derruba a
   pessoa do sistema no meio do trabalho, e isso seria trocar um problema
   lento por um imediato.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Varre as propriedades do script e remove as sessões já expiradas.
 * Seguro de rodar a qualquer momento: sessão viva não é tocada.
 *
 * @param {boolean} simular  true = só conta, não apaga. Bom para conferir antes.
 */
function limparSessoesExpiradas_(simular) {
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var agora = new Date().getTime();
  var prefixo = SESSAO_CONFIG.CHAVE_CACHE_SESSAO;

  var vivas = 0, expiradas = 0, corrompidas = 0, apagadas = 0, outras = 0;
  var maisAntiga = null;

  Object.keys(todas).forEach(function (chave) {
    if (chave.indexOf(prefixo) !== 0) { outras++; return; }

    var expira = 0, criado = 0;
    try {
      var s = JSON.parse(todas[chave]);
      expira = Number(s.expiraEm || 0);
      criado = Number(s.criadoEm || 0);
    } catch (e) {
      /* JSON quebrado não serve para autenticar ninguém: nunca vai virar
         sessão válida, e ocupa espaço igual. Vai junto. */
      corrompidas++;
      if (!simular) { props.deleteProperty(chave); apagadas++; }
      return;
    }

    if (expira && expira > agora) {
      vivas++;
      return;   /* SESSÃO VIVA — não se toca. Apagar derruba a pessoa. */
    }

    expiradas++;
    if (criado && (!maisAntiga || criado < maisAntiga)) maisAntiga = criado;
    if (!simular) {
      props.deleteProperty(chave);
      try { CacheService.getScriptCache().remove(chave); } catch (eC) {}
      apagadas++;
    }
  });

  var linhas = [];
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  LIMPEZA DE SESSÕES " + (simular ? "— SIMULAÇÃO (nada foi apagado)" : ""));
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  Sessões vivas, preservadas : " + vivas);
  linhas.push("  Expiradas encontradas      : " + expiradas);
  linhas.push("  Corrompidas (JSON inválido): " + corrompidas);
  linhas.push("  Apagadas nesta execução    : " + apagadas);
  linhas.push("  Outras propriedades        : " + outras + "  (intocadas)");
  if (maisAntiga) {
    linhas.push("  Expirada mais antiga       : " +
      Utilities.formatDate(new Date(maisAntiga), "America/Sao_Paulo", "dd/MM/yyyy"));
  }
  linhas.push("═══════════════════════════════════════════════════════════");

  var texto = linhas.join("\n");
  Logger.log(texto);
  return { ok: true, vivas: vivas, expiradas: expiradas, corrompidas: corrompidas,
           apagadas: apagadas, outras: outras, relatorio: texto };
}

/** Ponto de entrada do gatilho — sem parâmetro, porque trigger não passa nenhum. */
function limparSessoesExpiradasDiario() {
  return limparSessoesExpiradas_(false);
}

/**
 * Instala o gatilho diário. Mesmo padrão dos outros do projeto: apaga o
 * anterior antes de criar, para não acumular gatilho duplicado a cada
 * reinstalação — que é como se acaba com quatro execuções do mesmo trabalho.
 */
function instalarTriggerLimpezaSessoes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "limparSessoesExpiradasDiario") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("limparSessoesExpiradasDiario").timeBased().everyDays(1).atHour(3).create();
  Logger.log("✅ Gatilho instalado — limpeza diária às 3h.");
  return { ok: true, mensagem: "Gatilho de limpeza de sessões instalado (diário, 3h)." };
}

function removerTriggerLimpezaSessoes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "limparSessoesExpiradasDiario") ScriptApp.deleteTrigger(t);
  });
  Logger.log("✅ Gatilho removido.");
  return { ok: true };
}
