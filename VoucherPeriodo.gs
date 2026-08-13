// ============================================================================
// ARQUIVO: VoucherPeriodo.gs
// UM VOUCHER POR PESSOA, POR CURSO, POR PERÍODO — e nada além disso.
//
// A REGRA, NAS PALAVRAS DO USUÁRIO (13/08/2026)
//
//   "Somente um voucher por semestre ou por ano (no caso do integral)."
//   "Renovação é por curso — somente um por vez (semestre ou anual)."
//   "Não pode gerar duas vezes para a mesma pessoa."
//
// Três frases que dizem a mesma coisa por três lados: a unidade do benefício
// é PESSOA × CURSO × JANELA. Repetir dentro da janela é duplicata; repetir na
// janela seguinte é renovação, que é normal e esperado.
//
// POR QUE ISTO NÃO É O `verificarDuplicidadeVoucher_` QUE JÁ EXISTIA
//
// Aquele chaveava por CPF DO SOLICITANTE + MODALIDADE, e errava dos dois
// lados ao mesmo tempo:
//
//   • Bloqueava demais — dois filhos do mesmo associado, cursos diferentes,
//     mesmo ano: o segundo era recusado como duplicata. É o caso normal de
//     uma família, não é duplicata.
//   • Deixava passar de menos — a mesma pessoa em Administração e depois em
//     Direito no mesmo semestre passava, porque a MODALIDADE é a mesma
//     (GRADUAÇÃO) mesmo com o curso trocado.
//
// A função antiga continua existindo e continua sendo o nome chamado pelo
// portal; ela hoje delega para cá, para que exista UMA regra e não duas
// respostas diferentes para a mesma pergunta dependendo da porta de entrada.
//
// QUAL É A IDENTIDADE DA PESSOA, JÁ QUE O DEPENDENTE NÃO TEM CPF
//
// A aba `Voucher_Solicitacoes` não guarda CPF do beneficiário — o formulário
// pede nome e data de nascimento do filho, não o documento dele. Então a
// identidade é **CPF do titular + nome do beneficiário normalizado**. Para o
// titular isso é exatamente o CPF dele (o nome do beneficiário é o próprio
// nome); para os filhos, o nome distingue os irmãos dentro da mesma família,
// que é tudo o que precisa distinguir.
//
// QUAL É A IDENTIDADE DO CURSO NO ENSINO BÁSICO
//
// Criança de fundamental não tem "curso". Aí a chave cai para a MODALIDADE
// sozinha — deliberadamente SEM a escola. Incluir a escola pareceria mais
// preciso e seria pior: "EMEF João XXIII" e "E.M.E.F. Joao 23" viram dois
// cursos diferentes por diferença de digitação, e a trava deixa passar a
// segunda emissão exatamente no caso em que ela deveria travar.
// ============================================================================

/**
 * Os status que ocupam a janela.
 *
 * RECUSADO e CANCELADO ficam de fora de propósito: recusou, pode refazer —
 * senão um erro de digitação recusado hoje impediria a solicitação certa
 * amanhã, e não haveria como consertar sem mexer na planilha na mão.
 */
function VOUCHER_STATUS_OCUPA_PERIODO_() {
  return [
    "PENDENTE",
    "ANALISE",
    "AGUARDANDO_VALIDACAO_CADASTRAL",
    "AGUARDANDO_ATENDIMENTO_PRESENCIAL",
    "APROVADO",
    "EMITIDO"
  ];
}

/**
 * Quebra "2026/2" em ano e semestre, aceitando o que a vida escreve.
 *
 * Formatos vistos e aceitos: `2026/2`, `2026.2`, `2026-2`, `2026 2`, `2026`,
 * e o invertido `2/2026`. O que decide quem é o ano é ter 4 dígitos, não a
 * posição — quem digita depressa inverte, e inverter não pode virar um ano
 * "2" que nunca casa com nada e desliga a trava em silêncio.
 */
function voucherPeriodoPartes_(periodo) {
  var t = String(periodo || "").trim();
  if (!t) return { ano: "", semestre: "" };

  var nums = t.match(/\d+/g) || [];
  var ano = "", sem = "";
  for (var i = 0; i < nums.length; i++) {
    if (nums[i].length === 4 && !ano) ano = nums[i];
    else if (nums[i].length === 1 && !sem) sem = nums[i];
  }
  /* Semestre só é 1 ou 2. "2026/10" não é semestre nenhum — é outra coisa,
   * e tratar como semestre inventaria uma janela que não existe. */
  if (sem !== "1" && sem !== "2") sem = "";
  return { ano: ano, semestre: sem };
}

function voucherPeriodoEhAnual_(regime) {
  return String(regime || "").toUpperCase().indexOf("ANUAL") > -1;
}

/**
 * Em que situação as duas solicitações estão, uma em relação à outra.
 *
 * TRÊS RESPOSTAS, não duas — e a do meio é a que existe porque a realidade
 * tem dado faltando:
 *
 *   CONFLITA — é a mesma janela. Trava.
 *   INCERTO  — o ano coincide, mas falta o semestre de algum lado e não há
 *              como saber. Avisa, não trava.
 *   LIVRE    — janelas diferentes. Nem avisa.
 *
 * | regime envolvido      | janela         |
 * |-----------------------|----------------|
 * | ANUAL (qualquer lado) | o ano inteiro  |
 * | SEMESTRAL dos dois    | ano + semestre |
 *
 * O ANUAL manda mesmo quando é só de um lado, e isso é intencional nas duas
 * direções: a bolsa integral de 2026 já cobre 2026/1 e 2026/2, então nem
 * cabe um semestral por cima; e um semestral de 2026/1 já concedido impede
 * a integral de 2026, que cobriria um período já concedido.
 *
 * Sem ano de um dos lados é LIVRE: período em branco não é prova de nada, e
 * recusar por falta de informação nega solicitação legítima sem dar à pessoa
 * como provar o contrário.
 *
 * POR QUE O INCERTO DEIXOU DE TRAVAR — 13/08/2026, decisão do usuário.
 * Até aqui, semestre faltando travava por precaução. Travar por dado que
 * FALTA é recusar o atendimento por um defeito do formulário, não por uma
 * regra do sindicato — e quem paga é a pessoa do outro lado do balcão. O
 * caminho certo foi atacar a origem: o período virou dois seletores na tela,
 * e solicitação nova não consegue mais nascer sem semestre. O INCERTO existe
 * para o que JÁ ESTÁ GRAVADO — ali, o sistema avisa e deixa a pessoa decidir,
 * que é o que ela pode fazer e o sistema não.
 */
function voucherPeriodoJanelaSituacao_(regimeA, periodoA, regimeB, periodoB) {
  var a = voucherPeriodoPartes_(periodoA);
  var b = voucherPeriodoPartes_(periodoB);

  if (!a.ano || !b.ano) return "LIVRE";
  if (a.ano !== b.ano) return "LIVRE";

  if (voucherPeriodoEhAnual_(regimeA) || voucherPeriodoEhAnual_(regimeB)) return "CONFLITA";

  if (!a.semestre || !b.semestre) return "INCERTO";

  return a.semestre === b.semestre ? "CONFLITA" : "LIVRE";
}

/** Só o que TRAVA. O incerto não entra aqui — ele avisa. */
function voucherPeriodoJanelaConflita_(regimeA, periodoA, regimeB, periodoB) {
  return voucherPeriodoJanelaSituacao_(regimeA, periodoA, regimeB, periodoB) === "CONFLITA";
}

/** Chave da pessoa: CPF do titular + nome do beneficiário. Ver cabeçalho. */
function voucherPeriodoChavePessoa_(cpfTitular, nomeBeneficiario) {
  var cpf = String(cpfTitular || "").replace(/\D/g, "");
  if (cpf.length && cpf.length < 11) cpf = ("00" + cpf).slice(-11);
  var nome = typeof voucherInstNormalizar_ === "function"
    ? voucherInstNormalizar_(nomeBeneficiario)
    : String(nomeBeneficiario || "").trim().toUpperCase();
  return cpf + "|" + nome;
}

/** Chave do curso: o curso; sem curso, a modalidade. Ver cabeçalho. */
function voucherPeriodoChaveCurso_(modalidade, curso) {
  var norm = function (t) {
    return typeof voucherInstNormalizar_ === "function"
      ? voucherInstNormalizar_(t)
      : String(t || "").trim().toUpperCase();
  };
  var c = norm(curso);
  return c ? "C:" + c : "M:" + norm(modalidade);
}

/**
 * Tudo que a aba já tem sobre esta pessoa neste curso.
 *
 * Devolve o que bloqueia (mesma janela) e o que é histórico (janelas
 * anteriores) SEPARADOS, porque a tela mostra os dois de jeitos opostos: um
 * é trava vermelha, o outro é etiqueta azul de renovação.
 *
 * `sheet` é opcional e existe para quem já abriu a aba dentro de um lock não
 * abrir de novo — reabrir dentro do lock é caro e desnecessário.
 */
function voucherPeriodoHistorico_(dados, sheet) {
  dados = dados || {};
  var vazio = { ok: true, bloqueado: false, bloqueio: null, anteriores: [], vezes: 0, ultima: null };

  var sh = sheet;
  if (!sh) {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
  }
  if (!sh || sh.getLastRow() < 2) return vazio;

  var chavePessoa = voucherPeriodoChavePessoa_(dados.cpf, dados.beneficiario || dados.nome);
  if (chavePessoa.indexOf("|") === 0) return vazio;   // sem CPF não há de quem falar

  var chaveCurso = voucherPeriodoChaveCurso_(dados.modalidade, dados.curso);
  var ocupa = VOUCHER_STATUS_OCUPA_PERIODO_();

  var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
  function v(linha, nome) {
    var i = cab.indexOf(nome);
    return i === -1 ? "" : linha[i];
  }

  var bloqueio = null;
  var incertos = [];
  var anteriores = [];

  /* De trás para frente: quando houver mais de uma na mesma janela — o que
   * só acontece com dado antigo, anterior a esta trava — a que a tela mostra
   * é a mais recente, que é a que a pessoa lembra de ter emitido. */
  for (var l = tudo.length - 1; l >= 1; l--) {
    var linha = tudo[l];

    if (voucherPeriodoChavePessoa_(v(linha, "CPF_SOLICITANTE"),
        v(linha, "NOME_BENEFICIARIO") || v(linha, "NOME_SOLICITANTE")) !== chavePessoa) continue;
    if (voucherPeriodoChaveCurso_(v(linha, "MODALIDADE"), v(linha, "CURSO")) !== chaveCurso) continue;

    var status = String(v(linha, "STATUS_SOLICITACAO") || "").trim().toUpperCase();
    if (ocupa.indexOf(status) === -1) continue;

    /* O protocolo da linha que está sendo REEDITADA não bloqueia a si mesmo.
     * Sem isto, salvar de novo a mesma solicitação acusaria duplicata dela
     * mesma — e a mensagem apontaria o próprio protocolo do usuário. */
    var protocolo = String(v(linha, "NUMERO_PROTOCOLO") || "").trim();
    if (dados.protocoloAtual && protocolo && protocolo === String(dados.protocoloAtual).trim()) continue;

    var registro = {
      protocolo: protocolo,
      periodo: String(v(linha, "PERIODO_REFERENCIA") || "").trim(),
      regime: String(v(linha, "REGIME") || "").trim(),
      status: status,
      curso: String(v(linha, "CURSO") || "").trim(),
      modalidade: String(v(linha, "MODALIDADE") || "").trim(),
      beneficiario: String(v(linha, "NOME_BENEFICIARIO") || "").trim(),
      percentual: v(linha, "PERCENTUAL_APLICADO"),
      quem: String(v(linha, "USUARIO_VALIDACAO") || v(linha, "USUARIO_CADASTRO") || "").trim(),
      data: String(v(linha, "DATA_SOLICITACAO_TEXTO") || "").trim(),
      email: String(v(linha, "EMAIL") || "").trim()
    };

    var situacao = voucherPeriodoJanelaSituacao_(
      dados.regime, dados.periodo, registro.regime, registro.periodo);

    if (situacao === "CONFLITA") {
      if (!bloqueio) bloqueio = registro;
    } else if (situacao === "INCERTO") {
      incertos.push(registro);
      /* O incerto TAMBÉM conta como anterior para efeito de renovação: seja
       * qual for o semestre dele, é uma bolsa que esta pessoa já teve neste
       * curso. Deixar de contar diria "primeira vez" sobre a terceira. */
      anteriores.push(registro);
    } else {
      anteriores.push(registro);
    }
  }

  return {
    ok: true,
    bloqueado: !!bloqueio,
    bloqueio: bloqueio,
    /* Separado do bloqueio de propósito: a tela pinta um de vermelho e trava,
     * o outro de amarelo e deixa passar. Misturar os dois num campo só
     * obrigaria a tela a re-decidir o que o backend já sabe. */
    incerto: incertos.length ? incertos[0] : null,
    incertos: incertos,
    anteriores: anteriores,
    vezes: anteriores.length + (bloqueio ? 1 : 0),
    ultima: anteriores.length ? anteriores[0] : null
  };
}

/**
 * PRIMEIRA_VEZ ou RENOVACAO — deduzido, nunca perguntado.
 *
 * Perguntar seria pedir para a secretaria lembrar de algo que a planilha já
 * sabe, e o campo erraria na primeira vez que alguém tivesse pressa.
 */
function voucherTipoSolicitacao_(hist) {
  return (hist && hist.anteriores && hist.anteriores.length) ? "RENOVACAO" : "PRIMEIRA_VEZ";
}

/**
 * O texto da trava. Escrito aqui, e não na tela, porque as duas portas de
 * entrada (secretaria e, mais adiante, o portal) precisam recusar com as
 * mesmas palavras.
 */
function voucherPeriodoMensagemBloqueio_(bloqueio, dados) {
  var b = bloqueio || {};
  var quando = b.periodo || "no mesmo período";
  var partesNovo = voucherPeriodoPartes_((dados || {}).periodo);
  var partesVelho = voucherPeriodoPartes_(b.periodo);

  var frase = "Já existe voucher para esta pessoa neste período (" + quando + ")";
  if (b.protocolo) frase += " — protocolo " + b.protocolo;
  frase += ". Somente um por " +
    (voucherPeriodoEhAnual_(b.regime) || voucherPeriodoEhAnual_((dados || {}).regime)
      ? "ano" : "semestre") + ".";
  return frase;
}

/**
 * O texto do AVISO — o caso em que não dá para saber.
 *
 * Diferente do bloqueio em tudo: não trava, não acusa, e termina pedindo a
 * conferência a quem pode fazê-la. O sistema não sabe o semestre daquela
 * linha antiga; a pessoa abre o registro e sabe em cinco segundos.
 */
function voucherPeriodoMensagemIncerteza_(incerto) {
  var i = incerto || {};
  var qual = [i.beneficiario, i.curso || i.modalidade, i.periodo].filter(Boolean).join(" · ");
  return "Pode ser a mesma bolsa — o período da anterior (" +
    (i.periodo || "em branco") + ") não diz o semestre, então não dá para" +
    " saber se é o mesmo." + (qual ? " Anterior: " + qual + "." : "") +
    (i.protocolo ? " Protocolo " + i.protocolo + "." : "") +
    " Confira antes de salvar.";
}

/* ══════════════════════════════════════════════════════════════════════════
   A EXCEÇÃO AUTORIZADA

   A trava não tem escapatória para quem atende — e não deve ter. Mas a
   operação de um sindicato tem casos que a regra não previu, e um sistema
   sem nenhuma saída acaba contornado por fora: alguém recusa a anterior só
   para poder gravar a nova, e aí a planilha passa a mentir sobre o que
   aconteceu. A saída controlada existe justamente para não haver a saída
   descontrolada.

   TRÊS EXIGÊNCIAS, e nenhuma é decorativa:

     1. Só ADMINISTRADOR. Decisão de gestão, não de atendimento. Se qualquer
        pessoa com Benefícios pudesse liberar, a trava viraria um aviso que
        se clica para sumir — e em duas semanas ninguém mais o leria.
     2. JUSTIFICATIVA ESCRITA, e não uma palavra. Exceção sem motivo é
        indistinguível de clique por engano quando alguém for conferir seis
        meses depois.
     3. RASTRO EM TRÊS LUGARES — coluna, observações e auditoria. O que sai
        da regra é justamente o que mais precisa ser encontrável.

   A tela pede; QUEM DECIDE É AQUI. O backend nunca aceita a exceção porque a
   tela mandou: ele reconfere o perfil e o texto, e recusa os dois casos com
   mensagens diferentes, porque "você não pode" e "faltou escrever o motivo"
   pedem ações opostas de quem está do outro lado.
   ══════════════════════════════════════════════════════════════════════════ */

/** Mínimo de caracteres da justificativa. "ok" e "sim" não são motivo. */
var VOUCHER_EXCECAO_MIN_JUSTIFICATIVA = 15;

function voucherSessaoEhAdmin_(sessao) {
  var perfil = String((sessao && sessao.perfil) || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return perfil.indexOf("ADMIN") > -1;
}

/**
 * A exceção pedida vale? Devolve `{ vale, justificativa, mensagem }`.
 *
 * `vale:false` com `mensagem:""` significa "não foi pedida exceção nenhuma" —
 * o caminho normal, em que o bloqueio simplesmente recusa.
 */
function voucherPeriodoValidarExcecao_(excecao, sessao) {
  if (!excecao) return { vale: false, justificativa: "", mensagem: "" };

  if (!voucherSessaoEhAdmin_(sessao)) {
    return { vale: false, justificativa: "", mensagem:
      "Já existe voucher para esta pessoa neste período. Só um administrador " +
      "pode autorizar exceção — procure quem tem esse perfil." };
  }

  var texto = String((excecao && excecao.justificativa) || "").trim();
  if (texto.length < VOUCHER_EXCECAO_MIN_JUSTIFICATIVA) {
    return { vale: false, justificativa: "", mensagem:
      "Para autorizar a exceção, escreva o motivo (ao menos " +
      VOUCHER_EXCECAO_MIN_JUSTIFICATIVA + " caracteres). Ele fica gravado " +
      "com o seu nome." };
  }

  return { vale: true, justificativa: texto, mensagem: "" };
}

/** O carimbo da exceção nas observações. Ver o bloco acima. */
function voucherPeriodoCarimboExcecao_(bloqueio, justificativa, quem) {
  return "⚠ Exceção autorizada por " + (quem || "—") + " em " +
    Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm") +
    " — " + justificativa +
    (bloqueio && bloqueio.protocolo ? " (duplicata de " + bloqueio.protocolo + ")" : "");
}

/**
 * A checagem que a TELA faz enquanto a pessoa preenche.
 *
 * Existe para o alerta aparecer antes de digitar o resto do formulário. Ela
 * NÃO é a que vale: a que vale roda no servidor, dentro do lock, na hora de
 * gravar. Tela desatualizada e duas abas abertas ao mesmo tempo não podem
 * furar a regra, e é por isso que a mesma pergunta é feita duas vezes.
 */
function voucherChecarPeriodo(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    dados = dados || {};
    /* Quem NÃO é administrador nem vê o botão de exceção. Esconder não é a
     * trava — a trava está no servidor, em voucherPeriodoValidarExcecao_ —
     * mas oferecer um botão que sempre recusa é pior que não oferecer. */
    var podeAutorizar = voucherSessaoEhAdmin_(sessao);

    var cpf = String(dados.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11 || !String(dados.modalidade || "").trim()) {
      return { ok: true, bloqueado: false, tipo: "", vezes: 0,
               podeAutorizarExcecao: podeAutorizar };
    }

    var hist = voucherPeriodoHistorico_(dados);
    return {
      ok: true,
      bloqueado: hist.bloqueado,
      bloqueio: hist.bloqueio,
      incerto: hist.incerto,
      tipo: voucherTipoSolicitacao_(hist),
      vezes: hist.vezes,
      ultima: hist.ultima,
      podeAutorizarExcecao: podeAutorizar,
      mensagem: hist.bloqueado ? voucherPeriodoMensagemBloqueio_(hist.bloqueio, dados) : "",
      mensagemIncerteza: (!hist.bloqueado && hist.incerto)
        ? voucherPeriodoMensagemIncerteza_(hist.incerto) : ""
    };
  } catch (e) {
    Logger.log("voucherChecarPeriodo: " + e.message);
    /* Falha de leitura NÃO vira "pode emitir". A tela mostra o alerta de
     * indisponibilidade e a trava do servidor continua de pé — errar para o
     * lado de deixar passar aqui seria emitir o segundo voucher em silêncio. */
    return { ok: false, bloqueado: false, mensagem: e.message, tipo: "", vezes: 0 };
  }
}
