// ============================================================================
// ARQUIVO: AcessoModulos.gs
// CONTROLE DE ACESSO POR MÓDULO — SISGEP
//
// POR QUE ESTE ARQUIVO EXISTE
// Até aqui o SISGEP tinha um único portão: administrador ou não
// (exigirSessaoDocumentos_ com o segundo parâmetro true). Não existia
// nada entre "vê tudo" e "não é admin" — a coluna PERFIL da aba de
// usuários era só um rótulo exibido na tela, e o menu do index.html não
// filtrava nada. Na prática, QUALQUER pessoa que logasse enxergava os
// 15 módulos, incluindo RH (salário, CPF e holerite dos colaboradores),
// Jurídico (processos), Sindicalização (base de associados) e
// Configurações (gestão dos próprios usuários).
//
// Isso apareceu ao preparar o acesso do Diretor Financeiro, que precisa
// do módulo Financeiro inteiro e de mais nada. Sem controle por módulo,
// dar acesso a ele significaria entregar salário de colega e dado
// pessoal de associado junto — questão de LGPD, não de desconfiança.
//
// COMO FUNCIONA
// Uma coluna MODULOS na aba de usuários. Dois formatos aceitos:
//   · "TODOS"                → acesso a tudo (comportamento de sempre)
//   · "FINANCEIRO,ESCOLAS"   → só os módulos listados
//
// 🚨 VAZIO SIGNIFICA "TODOS", DE PROPÓSITO.
// A migração acrescenta a coluna sem preencher nada, e célula vazia é
// lida como acesso total. Isso é deliberado: se vazio significasse
// "nenhum módulo", no instante em que a coluna fosse criada TODA a
// equipe perderia o sistema de uma vez, em produção, sem aviso. A
// restrição só passa a valer para quem tiver a célula preenchida à mão.
// O preço é que um usuário novo nasce com acesso total até alguém
// definir os módulos dele — está documentado na tela de usuários.
//
// DUAS CAMADAS, E SÓ UMA DELAS É SEGURANÇA
//   1. MENU (index.html) — esconde o que a pessoa não pode abrir.
//      Resolve o uso e o constrangimento, mas NÃO é segurança: sumir o
//      botão não impede ninguém de chamar a função por outro caminho.
//   2. SERVIDOR (exigirModulo_) — é a trava de verdade. Aplicada nos
//      pontos de entrada dos módulos que guardam dado de pessoa.
//
// Não travei as ~240 funções do sistema de uma vez: volume alto demais
// num commit só, com risco real de derrubar coisa que funciona. A
// escolha foi começar por onde o dano seria maior — RH, Jurídico,
// Sindicalização e Configurações. Os demais módulos continuam abertos a
// qualquer usuário logado, como sempre estiveram, e entram depois.
// ============================================================================

var ACESSO_COLUNA_MODULOS = "MODULOS";
var ACESSO_TODOS = "TODOS";

// Chaves iguais ao data-mod dos botões do menu em index.html — é o que
// permite o front esconder item por item sem tabela de tradução.
var ACESSO_MODULOS_CATALOGO = [
  { chave: "inicio",           rotulo: "Início",                sensivel: false },
  { chave: "sofia",            rotulo: "SOFIA (IA)",            sensivel: false },
  { chave: "sindicalizacao",   rotulo: "Sindicalização",        sensivel: true  },
  { chave: "aprovacoesPortal", rotulo: "Aprovações do Portal",  sensivel: true  },
  { chave: "documentos",       rotulo: "Documentos",            sensivel: false },
  { chave: "beneficios",       rotulo: "Benefícios",            sensivel: false },
  { chave: "financeiro",       rotulo: "Financeiro",            sensivel: false },
  { chave: "escolas",          rotulo: "Escolas",               sensivel: false },
  { chave: "rh",               rotulo: "RH",                    sensivel: true  },
  { chave: "juridico",         rotulo: "Jurídico",              sensivel: true  },
  { chave: "negociacao",       rotulo: "Negociação Coletiva",   sensivel: false },
  { chave: "assembleias",      rotulo: "Assembleias Gerais",    sensivel: true  },
  { chave: "governanca",       rotulo: "Governança e Mandatos", sensivel: true  },
  { chave: "auditoria",        rotulo: "Auditoria e Compliance",sensivel: true  },
  { chave: "comunicacao",      rotulo: "Central de Comunicação",sensivel: false },
  { chave: "eventos",          rotulo: "Eventos",               sensivel: false },
  { chave: "relatorios",       rotulo: "Relatórios",            sensivel: false },
  { chave: "radio",            rotulo: "Rádio SindEducação",    sensivel: false },
  { chave: "config",           rotulo: "Configurações",         sensivel: true  }
];

/* =========================================
 * MIGRAÇÃO
 * ========================================= */

/**
 * Acrescenta a coluna MODULOS à aba de usuários se ela ainda não
 * existir. Idempotente e não destrutiva: não escreve valor nenhum nas
 * linhas existentes — ver a nota sobre "vazio = TODOS" no cabeçalho.
 */
function acessoGarantirColuna_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_USUARIOS_LOGIN);
  if (!aba) return null;

  var ultimaCol = aba.getLastColumn();
  var cab = aba.getRange(1, 1, 1, ultimaCol).getValues()[0].map(function (h) {
    return String(h || "").trim().toUpperCase();
  });
  if (cab.indexOf(ACESSO_COLUNA_MODULOS) === -1) {
    aba.getRange(1, ultimaCol + 1).setValue(ACESSO_COLUNA_MODULOS).setFontWeight("bold");
  }
  return aba;
}

/* =========================================
 * LEITURA E NORMALIZAÇÃO
 * ========================================= */

/**
 * Converte o conteúdo da célula MODULOS na lista efetiva de módulos.
 * Devolve a string "TODOS" (e não um array) quando o acesso é total —
 * quem consome precisa distinguir "tudo" de "uma lista que por acaso
 * tem tudo", porque módulo novo criado depois deve entrar sozinho para
 * quem tem TODOS.
 */
function acessoNormalizarModulos_(valor) {
  var s = String(valor == null ? "" : valor).trim();
  if (!s) return ACESSO_TODOS;
  if (s.toUpperCase() === ACESSO_TODOS) return ACESSO_TODOS;

  var lista = s.split(/[,;|]/)
    .map(function (x) { return String(x || "").trim().toLowerCase(); })
    .filter(function (x) { return !!x; });

  return lista.length ? lista : ACESSO_TODOS;
}

/** A sessão pode abrir este módulo? */
function sessaoPodeModulo_(sessao, modulo) {
  if (!sessao || sessao.logado !== true) return false;
  var alvo = String(modulo || "").trim().toLowerCase();
  if (!alvo) return true;

  var mods = sessao.modulos;
  // Sessão criada antes desta funcionalidade não carrega o campo — vale
  // acesso total, senão quem já estava logado seria expulso na hora em
  // que o código subisse.
  if (mods === undefined || mods === null || mods === "") return true;
  if (mods === ACESSO_TODOS) return true;
  if (!Array.isArray(mods)) return true;

  // Início é a tela de entrada: bloqueá-la deixaria a pessoa logada
  // olhando para uma casca vazia, sem entender o que houve.
  if (alvo === "inicio") return true;

  return mods.indexOf(alvo) > -1;
}

/**
 * Trava de servidor. Use no ponto de ENTRADA de cada módulo sensível —
 * lança erro com mensagem clara, no mesmo estilo de
 * exigirSessaoDocumentos_, e devolve a sessão para quem quiser usar.
 */
function exigirModulo_(tokenSessao, modulo, exigirAdministrador) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, exigirAdministrador === true);
  if (!sessaoPodeModulo_(sessao, modulo)) {
    var rotulo = modulo;
    ACESSO_MODULOS_CATALOGO.forEach(function (m) { if (m.chave === modulo) rotulo = m.rotulo; });
    throw new Error("Seu usuário não tem acesso ao módulo " + rotulo + ". Fale com o administrador do SISGEP.");
  }
  return sessao;
}

/**
 * Porta dupla: sessão do SISGEP OU conta Google com poder de administrador.
 *
 * Existe por causa de uma armadilha do editor do Apps Script: o botão Run
 * chama a função SEM ARGUMENTO NENHUM. Uma função de manutenção escrita para
 * ser rodada ali não recebe token — e se ela exigir token, é inútil no editor;
 * se não exigir nada, vira endpoint anônimo de google.script.run, porque no
 * Apps Script toda função global sem "_" no fim é alcançável por QUALQUER
 * página do projeto, inclusive as públicas.
 *
 * A saída é aceitar os dois caminhos e recusar o terceiro:
 *   - veio token  → vale a permissão de módulo do SISGEP;
 *   - sem token   → só passa o dono do projeto ou um ADMINISTRADOR ATIVO
 *                   da aba de usuários, identificado pela conta Google;
 *   - anônimo     → recusa.
 *
 * Falhar em verificar é recusar: sem e-mail identificável, sem consulta à aba,
 * o veredito é não.
 *
 * Nota de dívida: EscolasIdentidade.gs tem 5 cópias desta mesma lógica
 * (escolaExigirAdminOuSessao_ e as anteriores a ela). A consolidação delas
 * fica para um commit separado — mexer nelas junto com uma correção de
 * segurança misturaria duas coisas que precisam ser revisadas em separado.
 *
 * @param {string} tokenSessao  token do SISGEP, ou vazio quando roda no editor
 * @param {string} modulo       chave do módulo (ex.: "beneficios")
 * @param {string} rotulo       nome da operação, para o log
 * @param {boolean} exigeAdmin  true quando nem todo usuário do módulo pode
 * @return {string} e-mail de quem executou pelo editor, ou "" quando veio por sessão
 */
function exigirAdminOuSessao_(tokenSessao, modulo, rotulo, exigeAdmin) {
  if (String(tokenSessao || "").trim()) {
    exigirModulo_(tokenSessao, modulo, !!exigeAdmin);
    Logger.log(rotulo + " — execução por sessão do SISGEP");
    return "";
  }

  var email = "";
  try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  if (!email) {
    Logger.log(rotulo + " — RECUSADO: sem sessão e sem conta Google identificável.");
    throw new Error("Sessão inválida ou expirada. Entre novamente no SISGEP.");
  }

  var dono = "";
  try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
  var ehDono = !!dono && dono === email;

  var ehAdmin = false;
  if (!ehDono && typeof escolaEhAdministradorPorEmail_ === "function") {
    ehAdmin = escolaEhAdministradorPorEmail_(email);
  }

  if (!ehDono && !ehAdmin) {
    Logger.log(rotulo + " — RECUSADO para " + email + " (dono do projeto: " + (dono || "desconhecido") + ")");
    throw new Error(
      "Ação permitida somente para administradores. A conta " + email +
      " não é a dona deste projeto Apps Script (" + (dono || "desconhecida") +
      ") nem foi encontrada na aba " + ABA_USUARIOS_LOGIN +
      " com EMAIL igual a esse, PERFIL = ADMINISTRADOR e STATUS = ATIVO."
    );
  }

  Logger.log(rotulo + " — execução " +
    (ehDono ? "pelo dono do projeto" : "por administrador cadastrado") + ": " + email);
  return email;
}

/* =========================================
 * API PARA A TELA
 * ========================================= */

/** O front usa para esconder do menu o que a pessoa não pode abrir. */
function acessoMeusModulos(tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var mods = sessao.modulos;
    var total = (mods === undefined || mods === null || mods === "" || mods === ACESSO_TODOS || !Array.isArray(mods));
    return {
      ok: true,
      todos: total,
      modulos: total ? ACESSO_MODULOS_CATALOGO.map(function (m) { return m.chave; }) : mods,
      perfil: sessao.perfil || ""
    };
  } catch (e) {
    // Falhar aqui não pode esconder o menu inteiro de quem está logado
    // legitimamente: na dúvida, o menu aparece e a trava de servidor
    // continua valendo em cada módulo sensível.
    return { ok: false, todos: true, modulos: ACESSO_MODULOS_CATALOGO.map(function (m) { return m.chave; }), mensagem: e.message };
  }
}

/** Catálogo para a tela de usuários montar as caixas de seleção. */
function acessoListarModulos(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  return { ok: true, modulos: ACESSO_MODULOS_CATALOGO };
}

/* =========================================
 * ADMINISTRAÇÃO
 * ========================================= */

/** Quem tem acesso a quê — visão do administrador. */
function acessoListarUsuarios(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var aba = acessoGarantirColuna_();
    if (!aba) return { ok: false, mensagem: "Aba de usuários não encontrada.", usuarios: [] };
    if (aba.getLastRow() < 2) return { ok: true, usuarios: [] };

    var dados = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getValues();
    var cab = dados[0].map(function (h) { return String(h || "").trim().toUpperCase(); });
    var iUsuario = cab.indexOf("USUARIO");
    var iNome    = cab.indexOf("NOME");
    var iEmail   = cab.indexOf("EMAIL");
    var iPerfil  = cab.indexOf("PERFIL");
    var iStatus  = cab.indexOf("STATUS");
    var iMods    = cab.indexOf(ACESSO_COLUNA_MODULOS);

    var usuarios = [];
    for (var i = 1; i < dados.length; i++) {
      var usuario = iUsuario > -1 ? String(dados[i][iUsuario] || "").trim() : "";
      if (!usuario) continue;
      var bruto = iMods > -1 ? String(dados[i][iMods] || "").trim() : "";
      var norm = acessoNormalizarModulos_(bruto);
      usuarios.push({
        usuario: usuario,
        nome:    iNome   > -1 ? String(dados[i][iNome]   || "").trim() : "",
        email:   iEmail  > -1 ? String(dados[i][iEmail]  || "").trim() : "",
        perfil:  iPerfil > -1 ? String(dados[i][iPerfil] || "").trim() : "",
        status:  iStatus > -1 ? String(dados[i][iStatus] || "").trim() : "",
        modulosBruto: bruto,
        todos: norm === ACESSO_TODOS,
        modulos: norm === ACESSO_TODOS ? [] : norm
      });
    }
    return { ok: true, usuarios: usuarios };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao listar usuários: " + e.message, usuarios: [] };
  }
}

/**
 * Define os módulos de um usuário. Só administrador — é o controle que
 * decide quem enxerga salário e dado de associado.
 *
 * @param {string}   usuario  login do usuário
 * @param {string[]} modulos  lista de chaves; vazio ou nulo = TODOS
 */
function acessoDefinirModulos(usuario, modulos, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };

    usuario = String(usuario || "").trim().toLowerCase();
    if (!usuario) return { ok: false, mensagem: "Informe o usuário." };

    var aba = acessoGarantirColuna_();
    if (!aba) return { ok: false, mensagem: "Aba de usuários não encontrada." };

    var dados = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getValues();
    var cab = dados[0].map(function (h) { return String(h || "").trim().toUpperCase(); });
    var iUsuario = cab.indexOf("USUARIO");
    var iEmail   = cab.indexOf("EMAIL");
    var iMods    = cab.indexOf(ACESSO_COLUNA_MODULOS);
    if (iUsuario === -1 || iMods === -1) return { ok: false, mensagem: "Colunas de usuário/módulos não encontradas." };

    var validas = {};
    ACESSO_MODULOS_CATALOGO.forEach(function (m) { validas[m.chave] = true; });

    var lista = (modulos || [])
      .map(function (m) { return String(m || "").trim(); })
      .filter(function (m) { return !!m && validas[m]; });

    // Lista vazia grava "TODOS" explicitamente, em vez de deixar a
    // célula em branco: assim fica visível na planilha que a decisão foi
    // tomada, e não que ninguém configurou ainda.
    var valor = lista.length ? lista.join(",") : ACESSO_TODOS;

    for (var i = 1; i < dados.length; i++) {
      var u = String(dados[i][iUsuario] || "").trim().toLowerCase();
      var e = iEmail > -1 ? String(dados[i][iEmail] || "").trim().toLowerCase() : "";
      if (u === usuario || (e && e === usuario)) {
        aba.getRange(i + 1, iMods + 1).setValue(valor);
        Logger.log("[ACESSO] " + (sessao.usuario || sessao.email) + " definiu módulos de " + usuario + ": " + valor);
        return {
          ok: true,
          mensagem: lista.length
            ? "Acesso atualizado: " + lista.length + " módulo(s). A mudança vale no próximo login do usuário."
            : "Usuário passou a ter acesso a todos os módulos. A mudança vale no próximo login."
        };
      }
    }
    return { ok: false, mensagem: "Usuário não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao definir acesso: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/**
 * Cria um usuário de login. Até aqui isso só era possível editando a
 * planilha à mão, o que na prática significava que ninguém novo entrava
 * no sistema sem alguém mexer em célula — e que a coluna de módulos
 * ficava em branco (ou seja, acesso total) por esquecimento.
 *
 * A senha entra como HASH desde o primeiro instante (gerarHashSenha_,
 * Login1.gs) e o usuário nasce em PRIMEIRO_ACESSO, obrigado a trocá-la
 * no primeiro login. A senha provisória nunca é gravada em texto puro.
 */
function acessoCriarUsuario(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };

    dados = dados || {};
    var usuario = String(dados.usuario || "").trim().toLowerCase();
    var nome    = String(dados.nome    || "").trim();
    var email   = String(dados.email   || "").trim().toLowerCase();
    var senha   = String(dados.senha   || "").trim();

    if (!usuario) return { ok: false, mensagem: "Informe o login do usuário." };
    if (/\s/.test(usuario)) return { ok: false, mensagem: "O login não pode ter espaços." };
    if (!nome)    return { ok: false, mensagem: "Informe o nome." };
    if (!email)   return { ok: false, mensagem: "Informe o e-mail — é por ele que a recuperação de senha funciona." };
    if (senha.length < 6) return { ok: false, mensagem: "A senha provisória precisa de pelo menos 6 caracteres." };

    var aba = acessoGarantirColuna_();
    if (!aba) return { ok: false, mensagem: "Aba de usuários não encontrada." };

    var dadosAba = aba.getRange(1, 1, Math.max(1, aba.getLastRow()), aba.getLastColumn()).getValues();
    var cab = dadosAba[0].map(function (h) { return String(h || "").trim().toUpperCase(); });
    function col(n) { return cab.indexOf(n); }

    var iUsuario = col("USUARIO"), iEmail = col("EMAIL"), iSenha = col("SENHA");
    var iPrimeiro = col("PRIMEIRO_ACESSO"), iNome = col("NOME");
    var iPerfil = col("PERFIL"), iStatus = col("STATUS"), iMods = col(ACESSO_COLUNA_MODULOS);

    if (iUsuario === -1 || iSenha === -1 || iStatus === -1) {
      return { ok: false, mensagem: "A aba de usuários não tem as colunas obrigatórias (USUARIO, SENHA, STATUS)." };
    }

    // Login e e-mail precisam ser únicos: duplicar qualquer um dos dois
    // faz a autenticação encontrar a linha errada, porque ela casa pelos
    // dois campos indistintamente.
    for (var i = 1; i < dadosAba.length; i++) {
      var u = String(dadosAba[i][iUsuario] || "").trim().toLowerCase();
      var e = iEmail > -1 ? String(dadosAba[i][iEmail] || "").trim().toLowerCase() : "";
      if (u && u === usuario) return { ok: false, mensagem: "Já existe um usuário com este login." };
      if (e && e === email)   return { ok: false, mensagem: "Já existe um usuário com este e-mail." };
    }

    var validas = {};
    ACESSO_MODULOS_CATALOGO.forEach(function (m) { validas[m.chave] = true; });
    var lista = (dados.modulos || [])
      .map(function (m) { return String(m || "").trim(); })
      .filter(function (m) { return !!m && validas[m]; });

    var linha = new Array(aba.getLastColumn()).fill("");
    linha[iUsuario] = usuario;
    linha[iSenha]   = gerarHashSenha_(senha);
    linha[iStatus]  = "ATIVO";
    if (iEmail    > -1) linha[iEmail]    = email;
    if (iNome     > -1) linha[iNome]     = nome;
    if (iPerfil   > -1) linha[iPerfil]   = String(dados.perfil || "Usuário").trim();
    if (iPrimeiro > -1) linha[iPrimeiro] = "SIM";
    if (iMods     > -1) linha[iMods]     = lista.length ? lista.join(",") : ACESSO_TODOS;

    aba.appendRow(linha);
    Logger.log("[ACESSO] " + (sessao.usuario || sessao.email) + " criou o usuário " + usuario +
      " com módulos: " + (lista.length ? lista.join(",") : ACESSO_TODOS));

    return {
      ok: true,
      mensagem: "Usuário " + usuario + " criado. Ele entra com a senha provisória e é obrigado a trocá-la no primeiro acesso." +
        (lista.length ? "" : " ATENÇÃO: ficou com acesso a TODOS os módulos — marque os módulos se não for isso.")
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao criar usuário: " + e.message };
  } finally { try { lock.releaseLock(); } catch (eRel) {} }
}

/**
 * Ativa/inativa um usuário. Não existe exclusão: usuário inativo não
 * loga (autenticarUsuario exige STATUS ATIVO), e apagar a linha
 * destruiria o rastro de quem fez o quê no histórico dos módulos.
 */
function acessoAlternarUsuario(usuario, ativo, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  try {
    usuario = String(usuario || "").trim().toLowerCase();
    if (!usuario) return { ok: false, mensagem: "Usuário não informado." };

    // Trava contra o tiro no pé: um administrador que se inativa perde o
    // acesso na hora e não tem como se reativar pela tela.
    if (String(sessao.usuario || "").trim().toLowerCase() === usuario && ativo === false) {
      return { ok: false, mensagem: "Você não pode inativar o próprio usuário." };
    }

    var aba = acessoGarantirColuna_();
    if (!aba) return { ok: false, mensagem: "Aba de usuários não encontrada." };
    var dados = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getValues();
    var cab = dados[0].map(function (h) { return String(h || "").trim().toUpperCase(); });
    var iUsuario = cab.indexOf("USUARIO"), iStatus = cab.indexOf("STATUS");
    if (iUsuario === -1 || iStatus === -1) return { ok: false, mensagem: "Colunas obrigatórias não encontradas." };

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][iUsuario] || "").trim().toLowerCase() === usuario) {
        aba.getRange(i + 1, iStatus + 1).setValue(ativo === false ? "INATIVO" : "ATIVO");
        Logger.log("[ACESSO] " + (sessao.usuario || sessao.email) + (ativo === false ? " inativou " : " reativou ") + usuario);
        return { ok: true, mensagem: ativo === false
          ? "Usuário inativado — não consegue mais entrar. A sessão aberta cai quando expirar."
          : "Usuário reativado." };
      }
    }
    return { ok: false, mensagem: "Usuário não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/**
 * Lê os módulos de um usuário direto da planilha, para o login montar a
 * sessão. Sem checagem de sessão de propósito: roda ANTES de a sessão
 * existir. Nunca lança — se algo falhar, devolve TODOS, porque derrubar
 * o login por causa de leitura de permissão seria pior do que o
 * problema que ela resolve.
 */
function acessoModulosDoUsuario_(linhaDados, cabecalho) {
  try {
    if (!linhaDados || !cabecalho) return ACESSO_TODOS;
    var idx = cabecalho.indexOf(ACESSO_COLUNA_MODULOS);
    if (idx === -1) return ACESSO_TODOS;
    return acessoNormalizarModulos_(linhaDados[idx]);
  } catch (e) {
    Logger.log("[ACESSO] falha ao ler módulos do usuário (liberando tudo): " + e.message);
    return ACESSO_TODOS;
  }
}
