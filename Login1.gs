// ============================================================================
// 📄 ARQUIVO: Login1.gs
// 🔐 Autenticação, bloqueio progressivo e primeiro acesso
//    Depende de: PLANILHA_ID, ABA_USUARIOS_LOGIN, SEGURANCA (SistemaConfig.gs),
//                getSistemaUrlBase (SistemaConfig.gs), salvarSessaoUsuario_ (Sessao.gs)
// ============================================================================

// ── Reaproveita os valores já definidos em SistemaConfig.gs (SEGURANCA) ────
// Única fonte de verdade — antes existiam dois lugares com números
// parcialmente divergentes para o mesmo conceito de bloqueio de login.
var LOGIN_TENTATIVAS_CONFIG = {
  MAX_TENTATIVAS: (typeof SEGURANCA === "object" && SEGURANCA && SEGURANCA.MAX_TENTATIVAS_LOGIN)
    ? SEGURANCA.MAX_TENTATIVAS_LOGIN
    : 5,                            // tentativas falhas permitidas antes de bloquear
  JANELA_SEGUNDOS: 15 * 60,          // janela de contagem das tentativas (15 min)
  BLOQUEIO_BASE_SEGUNDOS: (typeof SEGURANCA === "object" && SEGURANCA && SEGURANCA.BLOQUEIO_APOS_FALHAS_MINUTOS)
    ? SEGURANCA.BLOQUEIO_APOS_FALHAS_MINUTOS * 60
    : 5 * 60,                       // bloqueio inicial (padrão: 15 min, vindo de SEGURANCA)
  BLOQUEIO_MAXIMO_SEGUNDOS: 2 * 60 * 60, // teto do bloqueio progressivo (2h)
  CHAVE_TENTATIVAS: "LOGIN_TENT_",
  CHAVE_BLOQUEIO: "LOGIN_BLOQ_",
  CHAVE_NIVEL: "LOGIN_NIVEL_"
};


// ============================================================================
// HELPERS COMPARTILHADOS (usados também por Sessao.gs)
// ============================================================================

/**
 * Localiza a linha do usuário pelo identificador canônico (usuário ou
 * e-mail, já normalizado). Usado na hora de redimir um token, em vez de
 * depender do número da linha salvo no momento em que o token foi gerado —
 * que quebra se a planilha for reordenada ou tiver linhas inseridas/
 * removidas nesse meio tempo.
 *
 * @param {string} identificador (usuario ou email, já normalizado)
 * @returns {Object|null} { linha, aba, colunas, usuario, email } ou null
 */
function _localizarLinhaUsuarioPorIdentificador_(identificador) {
  identificador = String(identificador || "").trim().toLowerCase();
  if (!identificador) return null;

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_USUARIOS_LOGIN);
  if (!aba) return null;

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return null;

  var cab = dados[0].map(function(h) { return String(h || "").trim().toUpperCase(); });

  var colunas = {
    usuario:  cab.indexOf("USUARIO"),
    email:    cab.indexOf("EMAIL"),
    senha:    cab.indexOf("SENHA"),
    primeiro: cab.indexOf("PRIMEIRO_ACESSO"),
    nome:     cab.indexOf("NOME"),
    perfil:   cab.indexOf("PERFIL"),
    status:   cab.indexOf("STATUS")
  };

  for (var i = 1; i < dados.length; i++) {
    var usuario = String(dados[i][colunas.usuario] || "").trim().toLowerCase();
    var email   = String(dados[i][colunas.email]   || "").trim().toLowerCase();

    if (identificador === usuario || identificador === email) {
      return { linha: i + 1, aba: aba, colunas: colunas, usuario: usuario, email: email };
    }
  }

  return null;
}

/**
 * Confere se todas as colunas obrigatórias foram encontradas na planilha
 * (nenhuma retornou -1 do indexOf). Evita comparações silenciosas contra
 * `undefined` quando uma coluna é renomeada ou removida.
 *
 * @param {Object} colunas mapa { chave: indice }
 * @param {Array<string>} obrigatorias lista de chaves que devem existir
 * @returns {Object} { ok, faltantes }
 */
function _validarColunasObrigatorias_(colunas, obrigatorias) {
  var faltantes = obrigatorias.filter(function(chave) {
    return colunas[chave] === -1 || colunas[chave] === undefined;
  });
  return { ok: faltantes.length === 0, faltantes: faltantes };
}


// ============================================================================
// CONTROLE DE TENTATIVAS DE LOGIN (bloqueio progressivo)
// ============================================================================

/**
 * Verifica se o identificador está atualmente bloqueado por excesso de
 * tentativas.
 * @param {string} identificador (usuario, email ou texto digitado — já normalizado)
 * @returns {Object} { bloqueado, segundosRestantes }
 */
function verificarLoginBloqueado_(identificador) {
  var cache = CacheService.getScriptCache();
  var bruto = cache.get(LOGIN_TENTATIVAS_CONFIG.CHAVE_BLOQUEIO + identificador);

  if (!bruto) {
    return { bloqueado: false, segundosRestantes: 0 };
  }

  var expiraEm = Number(bruto) || 0;
  var agora = new Date().getTime();
  var restanteMs = expiraEm - agora;

  if (restanteMs <= 0) {
    return { bloqueado: false, segundosRestantes: 0 };
  }

  return { bloqueado: true, segundosRestantes: Math.ceil(restanteMs / 1000) };
}

/**
 * Nível de escalonamento do bloqueio progressivo. Usa PropertiesService
 * (persistente) em vez de CacheService — o CacheService tem um teto real de
 * 6h (21600s); gravar algo com TTL de 24h nele é cortado silenciosamente
 * para 6h, fazendo o nível resetar bem antes do esperado.
 * @param {string} identificador
 * @returns {number} nível atual (0 se não houver escalonamento ativo)
 */
function _obterNivelEscalonamento_(identificador) {
  try {
    var props = PropertiesService.getScriptProperties();
    var bruto = props.getProperty(LOGIN_TENTATIVAS_CONFIG.CHAVE_NIVEL + identificador);
    if (!bruto) return 0;

    var registro = JSON.parse(bruto);
    var agora = new Date().getTime();

    if (!registro.expiraEm || agora > registro.expiraEm) {
      props.deleteProperty(LOGIN_TENTATIVAS_CONFIG.CHAVE_NIVEL + identificador);
      return 0;
    }

    return Number(registro.nivel) || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Grava o nível de escalonamento com validade real de 24h (via timestamp
 * manual, não via TTL do CacheService).
 * @param {string} identificador
 * @param {number} nivel
 */
function _definirNivelEscalonamento_(identificador, nivel) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expiraEm = new Date().getTime() + (24 * 60 * 60 * 1000); // 24h reais
    props.setProperty(
      LOGIN_TENTATIVAS_CONFIG.CHAVE_NIVEL + identificador,
      JSON.stringify({ nivel: nivel, expiraEm: expiraEm })
    );
  } catch (e) {
    Logger.log("⚠ _definirNivelEscalonamento_ — falha: " + e.message);
  }
}

/**
 * Registra uma tentativa de login falha. Se ultrapassar o limite dentro da
 * janela, aplica bloqueio progressivo (cada bloqueio consecutivo dobra a
 * duração do anterior, até o teto configurado). Protegido por lock — leitura,
 * incremento e escrita do contador não podem acontecer em passos separados
 * sem proteção, senão duas tentativas simultâneas colidem e o contador
 * subestima o número real de falhas.
 * @param {string} identificador (já normalizado)
 */
function registrarTentativaFalha_(identificador) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(3000);
  } catch (e) {
    Logger.log("⚠ registrarTentativaFalha_ — não obteve lock, seguindo sem trava: " + e.message);
  }

  try {
    var cache = CacheService.getScriptCache();
    var chaveTentativas = LOGIN_TENTATIVAS_CONFIG.CHAVE_TENTATIVAS + identificador;

    var bruto = cache.get(chaveTentativas);
    var count = bruto ? (Number(bruto) + 1) : 1;

    cache.put(chaveTentativas, String(count), LOGIN_TENTATIVAS_CONFIG.JANELA_SEGUNDOS);

    if (count >= LOGIN_TENTATIVAS_CONFIG.MAX_TENTATIVAS) {
      var nivel = _obterNivelEscalonamento_(identificador) + 1;

      var duracaoSegundos = Math.min(
        LOGIN_TENTATIVAS_CONFIG.BLOQUEIO_BASE_SEGUNDOS * Math.pow(2, nivel - 1),
        LOGIN_TENTATIVAS_CONFIG.BLOQUEIO_MAXIMO_SEGUNDOS
      );

      var expiraEm = new Date().getTime() + (duracaoSegundos * 1000);

      cache.put(LOGIN_TENTATIVAS_CONFIG.CHAVE_BLOQUEIO + identificador, String(expiraEm), duracaoSegundos);
      _definirNivelEscalonamento_(identificador, nivel);
      cache.remove(chaveTentativas);

      Logger.log("🔒 Login bloqueado — identificador: " + identificador + " | nivel: " + nivel + " | duracao: " + duracaoSegundos + "s");

      /* Bloqueio na trilha. É o registro mais importante desta função:
       * cinco tentativas erradas seguidas é o que uma tentativa de invasão
       * parece de fora. Até aqui isso só existia no Logger, que some em dias
       * e ninguém abre. */
      try {
        if (typeof aud_deAcesso_ === "function") {
          aud_deAcesso_("BLOQUEIO_POR_TENTATIVAS", identificador,
            count + " tentativas · bloqueio nível " + nivel + " por " +
            Math.round(duracaoSegundos / 60) + " min");
        }
      } catch (e) { Logger.log("[acesso] ponte de auditoria falhou: " + e.message); }
    }

    /* Toda tentativa falha passa por aqui — senha errada, usuário inativo e
     * usuário inexistente. Um ponto só cobre os três. */
    try {
      if (typeof aud_deAcesso_ === "function") {
        aud_deAcesso_("SENHA_INCORRETA", identificador,
          "tentativa " + count + " de " + LOGIN_TENTATIVAS_CONFIG.MAX_TENTATIVAS);
      }
    } catch (e2) { Logger.log("[acesso] ponte de auditoria falhou: " + e2.message); }

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Limpa o histórico de tentativas falhas após um login bem-sucedido.
 * @param {string} identificador (já normalizado)
 */
function limparTentativasLogin_(identificador) {
  var cache = CacheService.getScriptCache();
  cache.remove(LOGIN_TENTATIVAS_CONFIG.CHAVE_TENTATIVAS + identificador);
  try {
    PropertiesService.getScriptProperties().deleteProperty(LOGIN_TENTATIVAS_CONFIG.CHAVE_NIVEL + identificador);
  } catch (e) {}
  // Não remove CHAVE_BLOQUEIO aqui de propósito — se por algum motivo o
  // usuário está bloqueado e tentou de novo, o bloqueio ativo deve valer
  // até expirar, não ser derrubado por uma coincidência de outro fluxo.
}


// ============================================================================
// LOGIN / AUTENTICAÇÃO
// ============================================================================

function autenticarUsuario(login, senha) {

  login = String(login || "").trim().toLowerCase();
  senha = String(senha || "").trim();

  if (!login || !senha) {
    return { ok: false, mensagem: "Informe login e senha." };
  }

  // Checagem rápida pelo texto exatamente digitado — barra abuso antes
  // mesmo de ler a planilha.
  var statusBloqueioInicial = verificarLoginBloqueado_(login);
  if (statusBloqueioInicial.bloqueado) {
    var minutosInicial = Math.ceil(statusBloqueioInicial.segundosRestantes / 60);
    return {
      ok: false,
      mensagem: "Muitas tentativas de login. Tente novamente em " + minutosInicial + " minuto(s)."
    };
  }

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_USUARIOS_LOGIN);

  if (!aba) {
    return { ok: false, mensagem: "Aba de usuários não encontrada." };
  }

  var dados = aba.getDataRange().getValues();

  if (dados.length < 2) {
    return { ok: false, mensagem: "Nenhum usuário cadastrado." };
  }

  var cab = dados[0].map(function(h) {
    return String(h || "").trim().toUpperCase();
  });

  var idxUsuario  = cab.indexOf("USUARIO");
  var idxPrimeiro = cab.indexOf("PRIMEIRO_ACESSO");
  var idxSenha    = cab.indexOf("SENHA");
  var idxNome     = cab.indexOf("NOME");
  var idxEmail    = cab.indexOf("EMAIL");
  var idxPerfil   = cab.indexOf("PERFIL");
  var idxStatus   = cab.indexOf("STATUS");

  var colunas = { usuario: idxUsuario, senha: idxSenha, email: idxEmail, nome: idxNome, perfil: idxPerfil, status: idxStatus };
  var validacaoColunas = _validarColunasObrigatorias_(colunas, ["usuario", "senha", "email", "nome", "perfil", "status"]);

  if (!validacaoColunas.ok) {
    Logger.log("⚠ autenticarUsuario — colunas obrigatórias ausentes: " + validacaoColunas.faltantes.join(", "));
    return { ok: false, mensagem: "Erro de configuração da planilha de usuários. Contate o administrador." };
  }

  for (var i = 1; i < dados.length; i++) {

    var usuario = String(dados[i][idxUsuario] || "").trim().toLowerCase();
    var email   = String(dados[i][idxEmail]   || "").trim().toLowerCase();

    if (login === usuario || login === email) {

      // Identificador canônico da conta — usado daqui pra frente no
      // bloqueio, pra que trocar entre usuário e e-mail na mesma conta não
      // reinicie o contador de tentativas (bypass do limite).
      var idCanonico = usuario || email;

      var statusBloqueioCanonico = verificarLoginBloqueado_(idCanonico);
      if (statusBloqueioCanonico.bloqueado) {
        var minutosCanonico = Math.ceil(statusBloqueioCanonico.segundosRestantes / 60);
        return {
          ok: false,
          mensagem: "Muitas tentativas de login. Tente novamente em " + minutosCanonico + " minuto(s)."
        };
      }

      var status = String(dados[i][idxStatus] || "").trim().toUpperCase();

      if (status !== "ATIVO") {
        registrarTentativaFalha_(idCanonico);
        return { ok: false, mensagem: "Usuário inativo." };
      }

      var senhaSalva     = String(dados[i][idxSenha]    || "").trim();
      var primeiroAcesso = String(dados[i][idxPrimeiro] || "").trim();

      var hashDigitado = gerarHashSenha_(senha);

      var confereComHash = (senhaSalva === hashDigitado);
      var confereComTextoPuro = (!confereComHash && senhaSalva === senha);
      var senhaConfere = confereComHash || confereComTextoPuro;

      if (!senhaConfere) {
        registrarTentativaFalha_(idCanonico);
        return { ok: false, mensagem: "Usuário ou senha inválidos." };
      }

      // Migração silenciosa: se a senha ainda estava em texto puro na
      // planilha, regrava já como hash agora que confirmamos a senha certa.
      // Fecha a brecha de plaintext sem exigir ação do usuário.
      if (confereComTextoPuro) {
        try {
          var lockMigracao = LockService.getScriptLock();
          lockMigracao.waitLock(5000);
          try {
            aba.getRange(i + 1, idxSenha + 1).setValue(hashDigitado);
          } finally {
            lockMigracao.releaseLock();
          }
        } catch (e) {
          Logger.log("⚠ autenticarUsuario — falha ao migrar senha para hash: " + e.message);
          // Não bloqueia o login por causa disso — só loga para investigar depois.
        }
      }

      limparTentativasLogin_(idCanonico);
      if (login !== idCanonico) limparTentativasLogin_(login);

      var urlBase = getSistemaUrlBase();

      // ── PRIMEIRO ACESSO ──────────────────────────────────
      if (
        primeiroAcesso === "123456" ||
        primeiroAcesso.toUpperCase() === "SIM"
      ) {
        var tokenPrimeiroAcesso = Utilities.getUuid();

        // Guarda o identificador canônico, não o número da linha — evita
        // quebra se a planilha for reordenada antes de o token ser usado.
        CacheService
          .getScriptCache()
          .put("PRIMEIRO_ACESSO_" + tokenPrimeiroAcesso, idCanonico, 600);

        return {
          ok: true,
          primeiroAcesso: true,
          token: tokenPrimeiroAcesso,
          url: urlBase,
          usuario: {
            nome:   dados[i][idxNome],
            email:  email,
            perfil: dados[i][idxPerfil]
          }
        };
      }

      // ── LOGIN NORMAL ─────────────────────────────────────
      // Captura o token da sessão para devolver ao cliente — é ele que
      // vai na URL (?sessao=token) e mantém a sessão isolada por aba/usuário.
      // Módulos permitidos vêm da coluna MODULOS (AcessoModulos.gs).
      // Protegido por typeof e por try/catch lá dentro: se o arquivo de
      // acesso não estiver instalado ou a leitura falhar, o login segue
      // normalmente com acesso total — nunca derrubar quem tenta entrar
      // por causa de leitura de permissão.
      var modulosUsuario = "TODOS";
      if (typeof acessoModulosDoUsuario_ === "function") {
        modulosUsuario = acessoModulosDoUsuario_(dados[i], cab);
      }

      var tokenSessao = salvarSessaoUsuario_({
        usuario: usuario,
        nome:    String(dados[i][idxNome]   || "").trim(),
        email:   email,
        perfil:  String(dados[i][idxPerfil] || "Administrador").trim(),
        modulos: modulosUsuario
      });

      /* Entrada bem-sucedida na trilha. Sem isto, a trilha teria só as
       * tentativas falhas — e não daria para responder "quem estava dentro
       * do sistema quando aquilo aconteceu", que é metade de qualquer
       * apuração. */
      try {
        if (typeof aud_deAcesso_ === "function") {
          aud_deAcesso_("ENTRAR", email || usuario,
            String(dados[i][idxPerfil] || "").trim());
        }
      } catch (e) { Logger.log("[acesso] ponte de auditoria falhou: " + e.message); }

      return {
        ok: true,
        primeiroAcesso: false,
        token: tokenSessao,
        url: urlBase,
        usuario: {
          nome:   dados[i][idxNome],
          email:  email,
          perfil: dados[i][idxPerfil]
        }
      };
    }
  }

  registrarTentativaFalha_(login);

  return {
    ok: false,
    mensagem: "Usuário ou senha inválidos."
  };
}

// ============================================================================
// TROCA SENHA PRIMEIRO ACESSO
// ============================================================================

function trocarSenhaPrimeiroAcesso(token, novaSenha, confirmarSenha) {

  token = String(token || "").trim();
  novaSenha = String(novaSenha || "").trim();
  confirmarSenha = String(confirmarSenha || "").trim();

  if (!token) {
    return { ok: false, mensagem: "Sessão expirada." };
  }

  if (novaSenha !== confirmarSenha) {
    return { ok: false, mensagem: "As senhas não coincidem." };
  }

  var validacao = validarSenhaForte_(novaSenha);
  if (!validacao.ok) {
    return validacao;
  }

  var idCanonico;
  var lockToken = LockService.getScriptLock();
  lockToken.waitLock(5000);
  try {
    // Reivindica o token de forma atômica: lê e já remove antes de fazer
    // qualquer outra coisa, pra que duas requisições simultâneas com o
    // mesmo token não consigam usar o mesmo acesso duas vezes.
    var cache = CacheService.getScriptCache();
    var chave = "PRIMEIRO_ACESSO_" + token;
    idCanonico = cache.get(chave);

    if (!idCanonico) {
      return { ok: false, mensagem: "Sessão expirada." };
    }

    cache.remove(chave);
  } finally {
    lockToken.releaseLock();
  }

  var localizacao = _localizarLinhaUsuarioPorIdentificador_(idCanonico);

  if (!localizacao) {
    return { ok: false, mensagem: "Usuário não encontrado. Contate o administrador." };
  }

  var validacaoColunas = _validarColunasObrigatorias_(localizacao.colunas, ["senha", "primeiro"]);
  if (!validacaoColunas.ok) {
    Logger.log("⚠ trocarSenhaPrimeiroAcesso — colunas ausentes: " + validacaoColunas.faltantes.join(", "));
    return { ok: false, mensagem: "Erro de configuração da planilha de usuários. Contate o administrador." };
  }

  var hash = gerarHashSenha_(novaSenha);

  var lockEscrita = LockService.getScriptLock();
  lockEscrita.waitLock(5000);
  try {
    localizacao.aba.getRange(localizacao.linha, localizacao.colunas.senha + 1).setValue(hash);
    localizacao.aba.getRange(localizacao.linha, localizacao.colunas.primeiro + 1).setValue("");
  } finally {
    lockEscrita.releaseLock();
  }

  return {
    ok: true,
    mensagem: "Senha alterada com sucesso."
  };
}


// ============================================================================
// HASH SENHA
// ============================================================================

function gerarHashSenha_(senha) {

  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha,
    Utilities.Charset.UTF_8
  );

  return digest.map(function(b){

    var v = (b < 0)
      ? b + 256
      : b;

    var h = v.toString(16);

    return h.length === 1
      ? "0" + h
      : h;

  }).join("");
}


// ============================================================================
// VALIDA SENHA
// ============================================================================

function validarSenhaForte_(senha) {

  if (senha.length < 8) {
    return {
      ok: false,
      mensagem: "A senha deve ter no mínimo 8 caracteres."
    };
  }

  if (!/[A-Z]/.test(senha)) {
    return {
      ok: false,
      mensagem: "A senha precisa de letra maiúscula."
    };
  }

  if (!/[0-9]/.test(senha)) {
    return {
      ok: false,
      mensagem: "A senha precisa de número."
    };
  }

  if (!/[^A-Za-z0-9]/.test(senha)) {
    return {
      ok: false,
      mensagem: "A senha precisa de caractere especial."
    };
  }

  return {
    ok: true
  };
}


// ============================================================================
// CONVERTE SENHAS 123456 PARA HASH
// ============================================================================

function gerarHashInicialUsuarios123456() {

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_USUARIOS_LOGIN);

  var dados = aba.getDataRange().getValues();

  var cab = dados[0].map(function(h){
    return String(h || "")
      .trim()
      .toUpperCase();
  });

  var colSenha = cab.indexOf("SENHA") + 1;

  var hash123456 = gerarHashSenha_("123456");

  for (var i = 2; i <= aba.getLastRow(); i++) {

    var senhaAtual = String(
      aba.getRange(i, colSenha).getValue() || ""
    ).trim();

    if (senhaAtual === "123456") {

      aba
        .getRange(i, colSenha)
        .setValue(hash123456);
    }
  }

  return {
    ok: true,
    mensagem: "Conversão concluída."
  };
}

// ============================================================================
// TESTE MANUAL DE SESSÃO (uso no editor — Executar > testarSessao)
// ============================================================================
// getSessaoUsuario() exige um token explícito. Pra testar manualmente
// no editor, gere um login de verdade primeiro e cole o token retornado aqui.
function testarSessao(tokenParaTestar) {
  var sessao = getSessaoUsuario(tokenParaTestar || "");
  Logger.log(JSON.stringify(sessao));
}