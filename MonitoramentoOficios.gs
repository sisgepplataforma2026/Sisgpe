// ============================================================================
// ARQUIVO: MonitoramentoOficios.gs
// VERSÃO AJUSTADA — preserva funções públicas e sincroniza Controle + Fila
// ----------------------------------------------------------------------------
// OBJETIVO DA CORREÇÃO
// 1. Não perder nenhuma função pública usada pelo frontend/triggers.
// 2. Manter o monitoramento funcionando com a aba Controle.
// 3. Sincronizar status também na FILA_ENVIO_OFICIOS quando existir.
// 4. Listar status combinando Controle + Fila para evitar tela vazia.
// ============================================================================

/* ── Confirmações de Recebimento ── */

/* ==========================================================================
   COMO SE DECIDE QUE UM OFICIO FOI RECEBIDO — e o que estava errado

   Achado em 01/09/2026, puxando o fio de tres bounces reais para a FAESA
   (oficios 144, 236 e 242, todos para thalia.ferreira@faesa.br). Na producao
   o 144 estava marcado CONFIRMADO. A pergunta foi: confirmado por quem?

   O DEFEITO ERA A PALAVRA "ok", PROCURADA COM indexOf

   `indexOf` casa PEDACO de palavra. Medido contra textos reais:

     "Enviado do meu Outlook"                  -> casava por "ok"
     "Sent from Outlook for iOS"               -> casava por "ok"
     "Nao pode ser entregue. Token invalido."  -> casava por "ok"
     "Estou de ferias. Obrigado pelo contato." -> casava por "obrigado"

   Ou seja: o oficio era dado como recebido porque alguem respondeu de um
   Outlook, ou porque um robo de ferias agradeceu.

   E A BUSCA JA ERA LARGA

   A consulta ao Gmail procura pelo numero do oficio OU PELO NOME DA ESCOLA.
   Buscar pelo nome da escola significa que qualquer e-mail trocado com
   aquela escola, sobre qualquer assunto, entrava na conta. Somando as duas
   coisas: qualquer conversa com a FAESA em que aparecesse "Outlook"
   confirmava o oficio.

   O QUE FICA PIOR DEPOIS: confirmado sai do filtro do verificador de bounce,
   que so olha ENVIADO e PENDENTE. Entao o oficio que mais claramente NAO
   chegou era justamente o que nenhuma rotina voltava a olhar.

   O QUE MUDOU

   1. "ok" passou a valer so como palavra inteira. "Outlook" e "token" nao
      confirmam mais nada.
   2. Remetente automatico — mailer-daemon, postmaster, no-reply e afins —
      nao confirma. Antes so financeiro@ e secretaria@ eram ignorados, entao
      um robo podia confirmar oficio.

   O QUE NAO MUDOU, DE PROPOSITO: "obrigado" e "obrigada" continuam na lista.
   Sao ambiguos de verdade — muita gente responde "obrigado, recebido" — e
   tira-los faria o sistema deixar de reconhecer confirmacao legitima. E
   decisao de operacao, nao de codigo, e fica registrada aqui como escolha.
   ========================================================================== */

/* Termos que confirmam. "ok" fica fora daqui porque exige limite de palavra. */
var MON_OFICIOS_CONFIRMA_ = ["recebido", "recebemos", "confirmo", "confirmamos",
                             "ciente", "acusamos", "obrigado", "obrigada"];

var MON_OFICIOS_AUTOMATICOS_ = ["mailer-daemon", "mailerdaemon", "postmaster",
                                "no-reply", "noreply", "nao-responda",
                                "naoresponda", "do-not-reply", "donotreply",
                                "automatic", "notification@", "notifications@"];

/** O remetente e um robo? Robo nao confirma recebimento de oficio. */
function MON_OFICIOS_ehRemetenteAutomatico_(from) {
  var f = String(from || "").toLowerCase();
  for (var i = 0; i < MON_OFICIOS_AUTOMATICOS_.length; i++) {
    if (f.indexOf(MON_OFICIOS_AUTOMATICOS_[i]) > -1) return true;
  }
  return false;
}

/** O texto confirma recebimento? "ok" so vale como palavra inteira. */
function MON_OFICIOS_textoConfirmaRecebimento_(texto) {
  var t = String(texto || "").toLowerCase();
  for (var i = 0; i < MON_OFICIOS_CONFIRMA_.length; i++) {
    if (t.indexOf(MON_OFICIOS_CONFIRMA_[i]) > -1) return true;
  }
  /* O defeito inteiro morava aqui: "Outlook" tem "ok" dentro. */
  return /(^|[^a-z0-9])ok([^a-z0-9]|$)/i.test(t);
}

/* ══════════════════════════════════════════════════════════════════════════
   QUEM É "A PRÓPRIA CASA" — e por que isto deixou de ser lista cravada

   Achado em 02/09/2026, olhando um ofício real (487/2026, enviado às 11:17).
   O cabeçalho dizia:

     De:            SindEducação-ES <financeirosindecucacao@gmail.com>
     Responder para: secretaria@sindeducacao.com

   A lista de ignorados cravava `financeiro@sindeducacao.com` e
   `secretaria@sindeducacao.com`. NENHUM dos dois casa com
   `financeirosindecucacao@gmail.com` — que é o endereço que realmente
   envia. A guarda existia e não guardava nada.

   NÃO DEU PROBLEMA POR SORTE. O corpo do ofício não contém nenhuma das
   palavras de confirmação — medido, não suposto: "confirmação" não contém
   "confirmo" nem "confirmamos". Bastaria alguém acrescentar um "Agradecemos"
   ou um "recebido" ao modelo para TODO ofício passar a se autoconfirmar no
   instante em que fosse enviado.

   POR ISSO A LISTA PASSOU A SER PERGUNTADA, NÃO ESCRITA. A conta executora e
   os aliases dela são exatamente quem envia; qualquer troca de conta, alias
   novo ou mudança de domínio acompanha sozinha. Os endereços institucionais
   ficam como piso, para o caso de a consulta falhar.
   ══════════════════════════════════════════════════════════════════════════ */

var MON_OFICIOS_INSTITUCIONAIS_ = ["financeiro@sindeducacao.com",
                                   "secretaria@sindeducacao.com"];

/** Endereços da própria casa: a conta que executa, os aliases dela e o piso. */
function MON_OFICIOS_enderecosProprios_() {
  var lista = MON_OFICIOS_INSTITUCIONAIS_.slice();

  try {
    var efetivo = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase();
    if (efetivo) lista.push(efetivo);
  } catch (e) {}

  try {
    GmailApp.getAliases().forEach(function (a) {
      var v = String(a || "").trim().toLowerCase();
      if (v) lista.push(v);
    });
  } catch (e2) {}

  return lista;
}

/** O remetente é a própria casa? Ofício não se confirma sozinho. */
function MON_OFICIOS_ehRemetenteProprio_(from) {
  var f = String(from || "").toLowerCase();
  var proprios = MON_OFICIOS_enderecosProprios_();
  for (var i = 0; i < proprios.length; i++) {
    if (f.indexOf(proprios[i]) > -1) return true;
  }
  return false;
}




/* ─────────────────────────────────────────────────────────────────────────
   POR QUE ESTES QUATRO GANHARAM PORTA — 01/09/2026

   Achado na frente A da auditoria do Módulo 03, cruzando as funções públicas
   com as que escrevem estado. Os quatro criavam e APAGAVAM gatilho sem pedir
   permissão nenhuma, e sem sequer receber um token.

   No Apps Script não existe rota para `google.script.run`: toda função global
   é endpoint para QUALQUER página do projeto, inclusive as anônimas que o
   `Code.gs` serve. Ou seja, um visitante qualquer podia chamar
   `removerTriggerConfirmacoes()` e desligar, em silêncio, a verificação de
   confirmação de recebimento e a de falha de entrega.

   E desligar essas duas não dá erro nenhum: as confirmações simplesmente
   param de ser registradas e as falhas param de ser detectadas. Ninguém liga
   uma coisa à outra.

   Isso ficou pior depois da correção da Home de hoje: o FALHA_ENTREGA passou
   a aparecer no painel, e quem marca esse status é justamente o
   `verificarFalhasEntregaOficios`. Sem o gatilho, o indicador fica em zero
   dizendo que está tudo bem.

   NÃO É PADRÃO NOVO — é o padrão da casa, que estes quatro não tinham. O
   `instalarTriggerFilaEnvioOficios` (FilaOficios.gs:802), no mesmo módulo, já
   usava `exigirAdminOuSessao_` com o mesmo rótulo e o mesmo `true`.

   A porta é DUPLA de propósito: aceita o token de sessão do SISGEP e também a
   conta Google do dono do projeto, porque estas funções são rodadas do editor,
   onde não há token. Sem a segunda metade, a correção quebraria o único jeito
   de instalá-las.
   ───────────────────────────────────────────────────────────────────────── */

function instalarTriggerConfirmacoes(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Instalação do gatilho de confirmações de recebimento", true);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarConfirmacoesRecebimento") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("verificarConfirmacoesRecebimento").timeBased().everyHours(2).create();
  Logger.log("✅ Trigger de confirmações instalado — executa a cada 2 horas.");
  return { ok: true, mensagem: "Trigger de confirmações instalado com sucesso." };
}

function removerTriggerConfirmacoes(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Remoção do gatilho de confirmações de recebimento", true);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarConfirmacoesRecebimento") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log("✅ Trigger de confirmações removido.");
  return { ok: true, mensagem: "Trigger de confirmações removido com sucesso." };
}

/* ══════════════════════════════════════════════════════════════════════════
   POR QUE ESTA FICA PUBLICA E SEM PORTA — decidido em 01/09/2026, frente A

   Isto e HANDLER DE GATILHO: o Apps Script chama a funcao PELO NOME, entao
   ela nao pode virar privada. E a porta dupla, que resolveu o caso das
   ferramentas de editor, aqui e o remedio errado: o exigirAdminOuSessao_
   (AcessoModulos.gs:188) identifica quem executa por
   Session.getActiveUser().getEmail(), e num gatilho por tempo esse e-mail
   pode voltar VAZIO. Quando volta, a porta recusa — e o gatilho para.

   Parar este gatilho para a operacao que esta VIVA no sindicato. Nao vale a
   troca, e o que se ganharia e pouco: a funcao devolve so contadores (verificados, confirmados,
   sincronizadosControle) — nenhum dado de escola sai por ela.

   Fica publica, entao, e fica ANOTADA no teto de exposicao. Nao e aprovacao —
   e o registro de uma decisao que se reabre se aparecer um jeito de
   identificar o contexto de gatilho com seguranca.
   ══════════════════════════════════════════════════════════════════════════ */
/**
 * HANDLER DO GATILHO. Fica pública e sem porta de propósito — o Apps Script
 * chama pelo NOME, e `exigirAdminOuSessao_` recusaria num gatilho por tempo,
 * onde Session.getActiveUser() pode voltar vazio. Ver a decisão registrada em
 * tests/e2e/exposicao-teto.json.
 *
 * SEM ARGUMENTO ela varre a fila inteira, como sempre fez.
 */
function verificarConfirmacoesRecebimento() {
  return MON_OFICIOS_verificarConfirmacoes_(null);
}

/**
 * CONFERIR SÓ O QUE VOCÊ ESCOLHEU — 09/09/2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTE BOTÃO EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A varredura automática rodava a cada 2 horas — 12x por dia — e faz UMA
 * busca no Gmail POR OFÍCIO PENDENTE, sem teto. Ler e enviar saem do mesmo
 * orçamento de operações do Gmail, então ela comia a cota do envio. Foi o que
 * derrubou o reenvio do ofício 407 em 09/09.
 *
 * Palavras do usuário: "se ficar puxando automático toda vez ele vai bater na
 * cota de e-mails" e "quem envia é você, quem confere é você".
 *
 * E há um segundo motivo, independente da cota: a varredura automática é
 * justamente a que confirmava ofício errado. A busca é larga — casa pelo
 * número OU pelo nome da escola — e foi ela que deixou uma resposta automática
 * de Outlook confirmar um ofício que tinha quicado (item 49). Conferir só o
 * que alguém escolheu não conserta a largura da busca, mas reduz a quantas
 * pessoas ela é aplicada, e põe um humano olhando o resultado.
 *
 * O CUSTO VAI NO RETORNO. `consultas` diz quantas idas ao Gmail aquele clique
 * gastou. Sem isso o botão seria um relógio disfarçado de botão: a pessoa
 * clicaria em 300 sem perceber que é o mesmo gasto que ela acabou de desligar.
 *
 * @param {Array<string>} numeros  Números dos ofícios a conferir.
 * @param {string} tokenSessao
 */
function conferirRecebimentoOficios(numeros, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var lista = (numeros || []).map(function (n) {
    return String(n || "").trim();
  }).filter(function (n) { return !!n; });

  if (!lista.length) {
    return { ok: false, mensagem: "Selecione ao menos um ofício para conferir." };
  }

  /* TETO POR CLIQUE. Cada ofício é uma consulta ao Gmail; um clique em 500
     recriaria, de uma vez, o gasto que desligar o gatilho evitou. */
  if (lista.length > MON_OFICIOS_MAX_CONFERENCIA) {
    return {
      ok: false,
      mensagem: "Selecione no máximo " + MON_OFICIOS_MAX_CONFERENCIA +
                " ofícios por vez — cada um é uma consulta ao Gmail. " +
                "Você marcou " + lista.length + "."
    };
  }

  return MON_OFICIOS_verificarConfirmacoes_(lista);
}

/** Teto de ofícios por clique. Ver o cabeçalho de conferirRecebimentoOficios. */
var MON_OFICIOS_MAX_CONFERENCIA = 60;

/**
 * O NÚCLEO, usado pelo gatilho E pelo botão.
 *
 * Uma regra só. Se o botão tivesse cópia própria da lógica de confirmação, as
 * duas divergiriam — e o sistema passaria a ter duas respostas diferentes para
 * "esse ofício foi confirmado?", dependendo de quem perguntou.
 *
 * @param {Array<string>=} filtroNumeros  null = fila inteira (gatilho).
 */
function MON_OFICIOS_verificarConfirmacoes_(filtroNumeros) {
  var somenteEstes = null;
  if (filtroNumeros && filtroNumeros.length) {
    somenteEstes = {};
    filtroNumeros.forEach(function (n) { somenteEstes[String(n).trim()] = true; });
  }

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = obterOuCriarAbaFilaOficios_();

  if (!sh || sh.getLastRow() < 2) {
    var vazio = {
      ok: true,
      mensagem: "Fila vazia.",
      verificados: 0,
      confirmados: 0,
      sincronizadosControle: 0
    };

    Logger.log(JSON.stringify(vazio, null, 2));
    return vazio;
  }

  var hm = getHeaderMap_(sh);

  var colNumero            = hm["NUMERO_OFICIO"];
  var colEscola            = hm["ESCOLA"];
  var colEmailPrincipal    = hm["EMAIL_PRINCIPAL"];
  var colEmailsTodos       = hm["EMAILS_TODOS"];
  var colStatus            = hm["STATUS"];
  var colDataEnvio         = hm["DATA_ENVIO"];
  var colDataConfirmacao   = hm["DATA_CONFIRMACAO"];
  var colStatusRecebimento = hm["STATUS_RECEBIMENTO"];

  var obrigatorias = {
    NUMERO_OFICIO: colNumero,
    ESCOLA: colEscola,
    EMAIL_PRINCIPAL: colEmailPrincipal,
    EMAILS_TODOS: colEmailsTodos,
    STATUS: colStatus,
    DATA_ENVIO: colDataEnvio,
    DATA_CONFIRMACAO: colDataConfirmacao,
    STATUS_RECEBIMENTO: colStatusRecebimento
  };

  Object.keys(obrigatorias).forEach(function(nome) {
    if (!obrigatorias[nome]) {
      throw new Error("Coluna obrigatória não encontrada na fila: " + nome);
    }
  });

  var mapaControleConfirmado = {};

  try {
    var shControle = ss.getSheetByName(PLANILHA_REGISTRO);

    if (shControle && shControle.getLastRow() >= 2) {
      var hmControle = getHeaderMap_(shControle);
      var cNumeroControle = hmControle["Número do Ofício"];
      var cStatusControle = hmControle["Status"];

      if (cNumeroControle && cStatusControle) {
        var dadosControle = shControle
          .getRange(2, 1, shControle.getLastRow() - 1, shControle.getLastColumn())
          .getValues();

        dadosControle.forEach(function(linhaControle) {
          var numeroControle = String(linhaControle[cNumeroControle - 1] || "").trim();
          var statusControle = String(linhaControle[cStatusControle - 1] || "").trim().toUpperCase();

          if (numeroControle && statusControle === "CONFIRMADO") {
            mapaControleConfirmado[numeroControle] = true;
          }
        });
      }
    }
  } catch (eControle) {
    Logger.log("⚠ Erro ao ler confirmações do Controle: " + eControle.message);
  }

  var totalCols = sh.getLastColumn();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();

  var verificados = 0;
  var confirmados = 0;
  var sincronizadosControle = 0;

  dados.forEach(function(linha, idx) {
    var linhaPlanilha = idx + 2;

    var numero = String(linha[colNumero - 1] || "").trim();
    var escola = String(linha[colEscola - 1] || "").trim();
    var emailPrincipal = String(linha[colEmailPrincipal - 1] || "").trim();
    var emailsTodos = String(linha[colEmailsTodos - 1] || "").trim();
    var status = String(linha[colStatus - 1] || "").trim().toUpperCase();
    var statusReceb = String(linha[colStatusRecebimento - 1] || "").trim().toUpperCase();
    var dataEnvio = linha[colDataEnvio - 1];

    if (!numero) return;
    /* O FILTRO VEM ANTES DE TUDO: é o que faz o clique gastar só o que foi
       escolhido. Depois desta linha já há leitura de planilha e busca no
       Gmail. */
    if (somenteEstes && !somenteEstes[numero]) return;
    if (status !== "ENVIADO") return;
    if (statusReceb === "CONFIRMADO") return;

    var valoresLinha = sh.getRange(linhaPlanilha, 1, 1, totalCols).getValues()[0];

    if (mapaControleConfirmado[numero]) {
      valoresLinha[colStatusRecebimento - 1] = "CONFIRMADO";

      if (!valoresLinha[colDataConfirmacao - 1]) {
        valoresLinha[colDataConfirmacao - 1] = new Date();
      }

      sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);

      sincronizadosControle++;
      confirmados++;
      return;
    }

    verificados++;

    var dataFiltro = "";

    if (dataEnvio instanceof Date && !isNaN(dataEnvio.getTime())) {
      dataFiltro = " after:" + Utilities.formatDate(
        dataEnvio,
        Session.getScriptTimeZone(),
        "yyyy/MM/dd"
      );
    }

    var query =
      '(' +
      '"' + numero + '" OR ' +
      '"' + numero.replace("/", "-") + '" OR ' +
      '"' + escola + '"' +
      ')' +
      ' newer_than:30d' +
      dataFiltro +
      ' -from:financeiro@sindeducacao.com' +
      ' -from:secretaria@sindeducacao.com';

    var confirmado = false;

    try {
      var threads = GmailApp.search(query, 0, 10);

      for (var t = 0; t < threads.length; t++) {
        var msgs = threads[t].getMessages();

        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m];
          var from = String(msg.getFrom() || "").toLowerCase();
          var body = String(msg.getPlainBody() || "").toLowerCase();
          var subject = String(msg.getSubject() || "").toLowerCase();

          /* A propria casa nao confirma o proprio oficio — ver a nota grande
             sobre MON_OFICIOS_enderecosProprios_. */
          if (MON_OFICIOS_ehRemetenteProprio_(from)) continue;
          /* Remetente automatico nao confirma nada — ver a nota grande acima
             de MON_OFICIOS_CONFIRMA_. */
          if (MON_OFICIOS_ehRemetenteAutomatico_(from)) continue;

          var texto = subject + " " + body;

          if (MON_OFICIOS_textoConfirmaRecebimento_(texto)) {
            confirmado = true;
            break;
          }
        }

        if (confirmado) break;
      }

      if (confirmado) {
        valoresLinha[colStatusRecebimento - 1] = "CONFIRMADO";
        valoresLinha[colDataConfirmacao - 1] = new Date();

        sh.getRange(linhaPlanilha, 1, 1, totalCols).setValues([valoresLinha]);

        try {
          MON_OFICIOS_atualizarStatusNoControle_(ss, numero, "CONFIRMADO", "Confirmação localizada automaticamente no Gmail.");
          MON_OFICIOS_atualizarStatusNaFila_(ss, numero, "CONFIRMADO", "Confirmação localizada automaticamente no Gmail.");
        } catch (eStatus) {
          Logger.log("⚠ Não foi possível atualizar Controle: " + eStatus.message);
        }

        confirmados++;
      }

    } catch (e) {
      Logger.log("⚠ Erro ao verificar confirmação do ofício " + numero + ": " + e.message);
    }
  });

  SpreadsheetApp.flush();

  /* `verificados` é exatamente o número de buscas no Gmail: uma por ofício que
     passou pelos filtros. Dizer isso na tela é o que impede o botão de virar
     um relógio disfarçado. */
  var pendentes = verificados - confirmados + sincronizadosControle;
  var retorno = {
    ok: true,
    mensagem: verificados === 0
      ? "Nenhum ofício elegível para conferência entre os escolhidos."
      : (confirmados + " confirmado(s) de " + verificados + " conferido(s)" +
         (pendentes > 0 ? "; " + Math.max(0, verificados - confirmados) +
                          " continua(m) aguardando resposta" : "") +
         ". Custo: " + verificados + " consulta(s) ao Gmail."),
    verificados: verificados,
    confirmados: confirmados,
    consultas: verificados,
    sincronizadosControle: sincronizadosControle
  };

  Logger.log(JSON.stringify(retorno, null, 2));
  return retorno;
}
/* ══════════════════════════════════════════════════════════════════════════
   "QUAIS E-MAILS NÃO APARECEM EM ENVIADOS?" — 09/09/2026
   ══════════════════════════════════════════════════════════════════════════

   O usuário, depois de reenviar o ofício 407 e não achar o e-mail:

       "eu preciso saber quais emails não aparecem no item enviados,
        porque já tem alguns que estão assim"
       "tem que ser certeiro"
       "porque fico na dúvida se foi enviado ou não"

   ISSO MUDOU O DESENHO. A primeira versão desta função respondia por dedução:
   MENSAGEM_ID gravado = envio bem-sucedido, porque `createDraft().send()` só
   devolve um GmailMessage quando dá certo. O raciocínio continua correto — mas
   ele responde "o envio deu certo", e NÃO responde "a mensagem está lá agora".
   São coisas diferentes: alguém pode ter apagado.

   E ele já viu ofícios assim. Dedução não serve para quem está em dúvida.
   Então esta versão PERGUNTA AO GMAIL, um por um, e não estima.

   ONDE A RESPOSTA FICA. Na PLANILHA, ao lado do ofício, em duas colunas novas
   (COMPROVACAO_ENVIO e COMPROVACAO_EM). Um relatório no Logger some quando a
   janela fecha, e aí a dúvida volta. Gravado, ele olha a linha do ofício e vê.

   OS QUATRO VEREDITOS, e cada um quer dizer uma coisa diferente:

     EM ENVIADOS            a mensagem existe. Fim da dúvida.
     NAO ENCONTRADO         o id está gravado e o Gmail não acha. É o que ele
                            procura — provavelmente apagada da caixa.
     NA LIXEIRA             existe, mas foi para a lixeira. Recuperável.
     SEM ID (envio antigo)  anterior a 02/09, quando o envio usava sendEmail,
                            que não devolve nada. A ausência é esperada e não
                            diz nada sobre a entrega — não é achado.
     SEM ID (verificar)     posterior a 02/09 e sem id. Achado de verdade.

   POR BLOCOS, E RETOMÁVEL. Cada ofício é uma consulta ao Gmail, e foi
   exatamente o excesso disso que esgotou a cota hoje. Ela processa um bloco
   por execução, guarda onde parou, e continua na próxima. Rodar de novo
   continua; não recomeça.

   PORTA QUE FUNCIONA NO EDITOR. A primeira versão usava `exigirModulo_`, que
   EXIGE token — e o botão Executar do editor não passa argumento nenhum. Ela
   teria recusado a própria pessoa que precisa rodá-la. É a armadilha que este
   projeto já registrou quatro vezes (ver PENDENTE-VERIFICACAO). Agora usa
   `exigirAdminOuSessao_`, que cai na conta Google de quem executa.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O MESMO, MAS PROCURANDO TAMBÉM PELO NÚMERO DO OFÍCIO.
 *
 * Existe porque o botão Executar do editor não passa argumento: sem esta,
 * não haveria como pedir o modo completo de dentro do editor. Mesmo motivo
 * de `compassoPiloto` existir ao lado de `compasso_pilotoExecutar`.
 *
 * É a que responde "quais NÃO estão em Enviados?" para a fila INTEIRA — e não
 * só para os 3 que têm id. Custa uma busca no Gmail por ofício, então é
 * retomável: roda, para no bloco, e continua na próxima execução.
 */
function conferirOficiosNaCaixaDeEnviadosCompleto() {
  return conferirOficiosNaCaixaDeEnviados(true, false, "");
}

var OFICIO_COL_COMPROVACAO     = "COMPROVACAO_ENVIO";
var OFICIO_COL_COMPROVACAO_EM  = "COMPROVACAO_EM";
var OFICIO_PROP_COMPROV_CURSOR = "SISGEP_COMPROVACAO_CURSOR";

/** Quantos ofícios por execução. Cada um é uma consulta ao Gmail. */
var OFICIO_COMPROVACAO_BLOCO = 150;

/**
 * Confere, um por um, se a mensagem de cada ofício está no Gmail, e grava o
 * veredito na planilha.
 *
 * Rode pelo editor, sem argumento. Se a fila for grande ela para no bloco e
 * avisa — rode de novo para continuar de onde parou.
 *
 * @param {boolean=} recomecar  true zera o cursor e confere tudo de novo.
 */
function conferirOficiosNaCaixaDeEnviados(buscarPorNumero, recomecar, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos",
                       "Conferência de ofícios na caixa de Enviados", false);

  var sh = obterOuCriarAbaFilaOficios_();
  if (!sh || sh.getLastRow() < 2) {
    return { ok: true, mensagem: "A fila de ofícios está vazia." };
  }

  var hm    = getHeaderMap_(sh);
  var cNum  = hm["NUMERO_OFICIO"];
  var cEsc  = hm["ESCOLA"];
  var cSt   = hm["STATUS"];
  var cData = hm["DATA_ENVIO"];
  var cMsg  = hm["MENSAGEM_ID"];

  if (!cNum || !cSt || !cMsg) {
    return { ok: false, mensagem: "A fila não tem NUMERO_OFICIO, STATUS e MENSAGEM_ID." };
  }

  var cVer = oficio_garantirColuna_(sh, OFICIO_COL_COMPROVACAO);
  var cVerEm = oficio_garantirColuna_(sh, OFICIO_COL_COMPROVACAO_EM);

  var props = PropertiesService.getScriptProperties();
  if (recomecar === true) props.deleteProperty(OFICIO_PROP_COMPROV_CURSOR);
  var inicio = Number(props.getProperty(OFICIO_PROP_COMPROV_CURSOR) || 0) || 0;

  var ultima  = sh.getLastRow();
  var totalLn = ultima - 1;
  var linhas  = sh.getRange(2, 1, totalLn, sh.getLastColumn()).getValues();

  /* 02/09/2026: a partir daí o envio passou a devolver id. Antes, não. */
  var VIRADA = new Date(2026, 8, 2);
  var agora  = new Date();

  var r = {
    ok: true, conferidos: 0, emEnviados: 0, emEnviadosPorNumero: 0,
    naoEncontrados: [], naLixeira: [], semIdVerificar: [],
    semIdAntigos: 0, semIdSemData: 0,
    consultasAoGmail: 0, parou: false, restam: 0, cotaAcabou: false,
    modo: buscarPorNumero === true ? "COMPLETO (id + busca por número)" : "SÓ POR ID"
  };

  var i = inicio;
  for (; i < linhas.length; i++) {
    if (r.consultasAoGmail >= OFICIO_COMPROVACAO_BLOCO) { r.parou = true; break; }

    var l = linhas[i];
    var numero = String(l[cNum - 1] || "").trim();
    if (!numero) continue;

    var status = String(l[cSt - 1] || "").trim().toUpperCase();
    if (status !== "ENVIADO" && status !== "CONFIRMADO") continue;

    var escola = String(l[cEsc - 1] || "").trim();
    var quando = l[cData - 1];
    var ref    = { numero: numero, escola: escola };
    var id     = String(l[cMsg - 1] || "").trim();
    var veredito;

    if (!id || id === "GMAILAPP_SEM_ID") {
      /* SEM ID: PROCURA PELO NÚMERO — 09/09/2026, depois da primeira rodada real.
         ══════════════════════════════════════════════════════════════════════
         A primeira rodada em produção conferiu 362 ofícios e fez 3 consultas:
         só 3 tinham id. O id só começou a ser gravado em 02/09, então para 359
         ofícios o sistema não tinha recibo nenhum — e a pergunta dele ("quais
         NÃO estão em Enviados?") ficava sem resposta para 99% da fila.

         Sem id ainda dá para procurar: pelo NÚMERO DO OFÍCIO na caixa de
         Enviados. É mais caro (uma busca por ofício) e menos preciso que o id,
         mas responde — e responder mal é melhor que não responder, desde que
         a diferença fique escrita no veredito, e fica: "POR NUMERO".

         E UM ERRO MEU QUE A RODADA EXPÔS. A classificação anterior mandava
         para "verificar" todo ofício sem DATA_ENVIO, porque a comparação com a
         data da virada falhava e caía no else. Deu 179 falsos achados — os
         números 119, 120, 122… sequenciais e baixos, registros antigos sem
         data. Sem data não dá para dizer se é antigo ou recente: agora isso
         tem veredito próprio, e a busca por número resolve os dois casos. */
      if (buscarPorNumero) {
        r.consultasAoGmail++;
        try {
          var achados = GmailApp.search(
            'in:sent "' + numero.replace(/"/g, "") + '"', 0, 3);
          if (achados && achados.length) {
            veredito = "EM ENVIADOS (por numero)";
            r.emEnviadosPorNumero++;
          } else {
            veredito = "NAO ENCONTRADO (por numero)";
            r.naoEncontrados.push(ref);
          }
        } catch (eB) {
          /* COTA ESTOURADA NÃO É NOTÍCIA SOBRE ESTE OFÍCIO — ver o comentário
             logo abaixo do laço. Para aqui, sem gravar nada nesta linha. */
          if (oficio_ehLimiteDoGmail_(eB)) { r.cotaAcabou = true; r.parou = true; break; }
          veredito = "SEM ID (busca falhou)";
          r.semIdVerificar.push(ref);
        }
      } else {
        var temData = (quando instanceof Date && !isNaN(quando.getTime()));
        if (!temData)               { veredito = "SEM ID (sem data)";      r.semIdSemData++; }
        else if (quando < VIRADA)   { veredito = "SEM ID (envio antigo)";  r.semIdAntigos++; }
        else                        { veredito = "SEM ID (verificar)";     r.semIdVerificar.push(ref); }
      }
    } else {
      /* AQUI está a consulta — e é o que torna a resposta certeira em vez de
         deduzida. */
      r.consultasAoGmail++;
      try {
        var msg = GmailApp.getMessageById(id);
        if (!msg) { veredito = "NAO ENCONTRADO"; r.naoEncontrados.push(ref); }
        else if (msg.isInTrash()) { veredito = "NA LIXEIRA"; r.naLixeira.push(ref); }
        else { veredito = "EM ENVIADOS"; r.emEnviados++; }
      } catch (e) {
        if (oficio_ehLimiteDoGmail_(e)) { r.cotaAcabou = true; r.parou = true; break; }
        veredito = "NAO ENCONTRADO";
        r.naoEncontrados.push(ref);
      }
    }

    r.conferidos++;
    try {
      sh.getRange(i + 2, cVer).setValue(veredito);
      sh.getRange(i + 2, cVerEm).setValue(agora);
    } catch (eGrav) {
      Logger.log("Comprovação: não consegui gravar o veredito do " + numero +
                 " — " + (eGrav && eGrav.message || eGrav));
    }
  }

  SpreadsheetApp.flush();

  /* POR QUE A COTA PARA A RODADA INTEIRA, E NÃO SÓ AQUELE OFÍCIO.
     ══════════════════════════════════════════════════════════════════════
     09/09/2026, antes da primeira rodada no modo completo. Sem esta trava, o
     dia em que a cota do Gmail acabasse a conferência responderia ERRADO, e
     de um jeito que ninguém teria como perceber:

       - no caminho do id, a exceção caía em "NAO ENCONTRADO" — ou seja, o
         sistema afirmaria que o ofício NÃO está em Enviados. É exatamente a
         pergunta que ele quer responder, respondida ao contrário;
       - no caminho da busca por número, viravam 150 "SEM ID (busca falhou)"
         seguidos, o cursor avançava, e rodar de novo marcava os 150 seguintes.
         Em três rodadas a fila inteira ficaria carimbada por um apagão de
         cota, com a data de hoje ao lado, como se fosse veredito.

     E não é hipótese: a cota desta conta acabou HOJE às 11:56 (item 77), e o
     modo completo custa uma busca POR OFÍCIO — 359 delas nesta fila. É o uso
     mais provável de bater no teto que existe no sistema.

     Cota estourada não diz nada sobre o ofício: diz que não deu para
     perguntar. Então a linha fica SEM veredito, o cursor fica onde parou, e o
     relatório manda voltar amanhã. Silêncio honesto vale mais que um "não
     encontrado" que dispara busca por um ofício que está lá. */
  if (r.parou) {
    props.setProperty(OFICIO_PROP_COMPROV_CURSOR, String(i));
    r.restam = Math.max(0, linhas.length - i);
  } else {
    props.deleteProperty(OFICIO_PROP_COMPROV_CURSOR);
  }

  var nomes = function (lista) {
    return lista.slice(0, 15).map(function (x) { return x.numero; }).join(", ") +
           (lista.length > 15 ? " …e mais " + (lista.length - 15) : "");
  };

  var L = [];
  L.push("═══════════════════════════════════════════════════════════");
  L.push("  OS OFÍCIOS ESTÃO NA CAIXA DE ENVIADOS?");
  L.push("═══════════════════════════════════════════════════════════");
  L.push("  Conferidos nesta execução : " + r.conferidos);
  L.push("  Consultas ao Gmail        : " + r.consultasAoGmail);
  L.push("");
  L.push("  Modo                      : " + r.modo);
  L.push("");
  L.push("  ✅ EM ENVIADOS (por id)   : " + r.emEnviados);
  if (buscarPorNumero === true)
    L.push("  ✅ EM ENVIADOS (por nº)   : " + r.emEnviadosPorNumero);
  L.push("  ❌ NÃO ENCONTRADO         : " + r.naoEncontrados.length +
         (r.naoEncontrados.length ? "  → " + nomes(r.naoEncontrados) : ""));
  L.push("  🗑️  NA LIXEIRA             : " + r.naLixeira.length +
         (r.naLixeira.length ? "  → " + nomes(r.naLixeira) : ""));
  L.push("  ⚠️  SEM ID (verificar)     : " + r.semIdVerificar.length +
         (r.semIdVerificar.length ? "  → " + nomes(r.semIdVerificar) : ""));
  L.push("  ⚪ SEM ID (envio antigo)  : " + r.semIdAntigos +
         "  (anterior a 02/09 — ausência esperada)");
  L.push("  ⚪ SEM ID (sem data)      : " + r.semIdSemData +
         "  (sem DATA_ENVIO não dá para dizer se é antigo)");
  if (buscarPorNumero !== true && (r.semIdVerificar.length + r.semIdAntigos + r.semIdSemData) > 0) {
    L.push("");
    L.push("  ℹ️  " + (r.semIdVerificar.length + r.semIdAntigos + r.semIdSemData) +
           " ofício(s) não têm id — o sistema só passou a gravá-lo em 02/09.");
    L.push("     Para saber deles, rode com busca por NÚMERO:");
    L.push("         conferirOficiosNaCaixaDeEnviadosCompleto()");
    L.push("     Custa uma busca no Gmail por ofício, e é retomável.");
  }
  L.push("");
  if (r.cotaAcabou) {
    L.push("  🛑 O LIMITE DIÁRIO DO GMAIL ACABOU — parei aqui, de propósito.");
    L.push("      Faltam ~" + r.restam + " linha(s), e elas ficaram SEM veredito:");
    L.push("      nenhum ofício foi marcado como 'não encontrado' por causa");
    L.push("      disto. Não dá para saber se a mensagem está lá quando não dá");
    L.push("      nem para perguntar.");
    L.push("      RODE DE NOVO AMANHÃ: continua de onde parou, não recomeça.");
  } else if (r.parou) {
    L.push("  ⏸️  PAROU NO BLOCO DE " + OFICIO_COMPROVACAO_BLOCO + ".");
    L.push("      Faltam ~" + r.restam + " linha(s). RODE DE NOVO para continuar");
    L.push("      de onde parou — não recomeça.");
  } else {
    L.push("  ✅ Fila inteira conferida.");
  }
  L.push("");
  L.push("  O veredito de cada ofício ficou gravado na fila, nas colunas");
  L.push("  " + OFICIO_COL_COMPROVACAO + " e " + OFICIO_COL_COMPROVACAO_EM + ".");
  L.push("═══════════════════════════════════════════════════════════");

  r.relatorio = L.join("\n");
  r.mensagem  = r.emEnviados + " em Enviados, " + r.naoEncontrados.length +
                " não encontrado(s), " + r.naLixeira.length + " na lixeira, " +
                r.semIdVerificar.length + " sem id a verificar." +
                (r.cotaAcabou
                   ? " PAREI: o limite diário do Gmail acabou. Rode de novo amanhã."
                   : r.parou ? " Rode de novo para continuar." : "");
  Logger.log(r.relatorio);
  return r;
}

/* ── Falhas de Entrega (Bounces) ── */

/* O TEXTO QUE VAI PARA A PLANILHA E PARA O AVISO — em português.
   09/09/2026. O usuário perguntou "esse bounce é o que?" e depois: "podemos
   ajustar esse termo em inglês". Ele tem razão — quem lê a coluna OBSERVAÇÕES
   é a secretaria, não um programador. "Bounce" é o nome técnico do aviso que o
   servidor devolve quando o e-mail não pôde ser entregue; na tela isso tem de
   estar escrito em palavras que se entendem sem tradução.
   Os NOMES DE FUNÇÃO seguem como estão: renomear função em produção é risco
   sem retorno, e ninguém que opera o sistema lê nome de função. */
var MON_OFICIOS_TEXTO_NAO_CHEGOU = "E-mail não chegou ao destino — devolvido pelo servidor em ";

function instalarTriggerFalhasEntrega(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Instalação do gatilho de falhas de entrega", true);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarFalhasEntregaOficios") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  /* UMA VEZ POR DIA, DE MADRUGADA — decisão do usuário em 09/09/2026.
     ══════════════════════════════════════════════════════════════════════
     Era de 3 em 3 horas: 8 rodadas por dia, TODAS em horário de expediente,
     disputando com o envio de ofício o mesmo orçamento de operações do Gmail.

     Foi o que estourou hoje. Ele reenviou o ofício 407 e nada saiu; o log
     trazia "Service invoked too many times for one day: gmail". Em 04/09 os
     reenvios tinham saído normalmente — o que mudou não foi o código, foi o
     acúmulo de leituras.

     Às 3h ninguém está enviando ofício, então esta varredura não tira cota de
     ninguém. E ele chega de manhã já sabendo o que não chegou, que é o que
     esta rotina existe para responder.

     POR QUE ESTA CONTINUA AUTOMÁTICA, e a conferência de recebimento não:
     é o único aviso que precisa chegar SEM alguém pedir. Ofício que não chegou
     e ninguém percebeu é o pior desfecho — a escola fica sem o documento e o
     sindicato não sabe. Conferir se a escola respondeu pode esperar um clique;
     descobrir que o e-mail voltou, não. */
  ScriptApp.newTrigger("verificarFalhasEntregaOficios")
    .timeBased().everyDays(1).atHour(3).create();
  Logger.log("✅ Gatilho de e-mails que não chegaram instalado — roda 1x por dia, às 3h.");
  return { ok: true, mensagem: "Gatilho instalado — roda uma vez por dia, de madrugada." };
}

function removerTriggerFalhasEntrega(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Remoção do gatilho de falhas de entrega", true);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "verificarFalhasEntregaOficios") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log("✅ Trigger de falhas de entrega removido.");
  return { ok: true, mensagem: "Trigger removido com sucesso." };
}

/* ══════════════════════════════════════════════════════════════════════════
   POR QUE ESTA FICA PUBLICA E SEM PORTA — decidido em 01/09/2026, frente A

   Isto e HANDLER DE GATILHO: o Apps Script chama a funcao PELO NOME, entao
   ela nao pode virar privada. E a porta dupla, que resolveu o caso das
   ferramentas de editor, aqui e o remedio errado: o exigirAdminOuSessao_
   (AcessoModulos.gs:188) identifica quem executa por
   Session.getActiveUser().getEmail(), e num gatilho por tempo esse e-mail
   pode voltar VAZIO. Quando volta, a porta recusa — e o gatilho para.

   Parar este gatilho para a operacao que esta VIVA no sindicato. Nao vale a
   troca, e o que se ganharia e pouco: a funcao devolve so um contador de falhas e uma mensagem curta —
   nenhum dado de escola sai por ela.

   Fica publica, entao, e fica ANOTADA no teto de exposicao. Nao e aprovacao —
   e o registro de uma decisao que se reabre se aparecer um jeito de
   identificar o contexto de gatilho com seguranca.
   ══════════════════════════════════════════════════════════════════════════ */
function verificarFalhasEntregaOficios() {
  try {
    /* RECONCILIAÇÃO AUTOMÁTICA — 04/09/2026, a pedido do usuário: "tudo
       automatizado".

       Ofício reenviado ANTES de a marcação existir (produção 695, 13h14)
       ficou com Status FALHA_ENTREGA mesmo tendo saído. Havia uma função de
       manutenção para acertar isso, que alguém teria de lembrar de rodar —
       e o que a pessoa precisa lembrar de fazer, ela esquece.

       AQUI É O LUGAR CERTO, e não é oportunismo: esta função existe para
       manter o status de entrega verdadeiro. Um ofício que o log diz que foi
       reenviado e a planilha diz que falhou é justamente o status deixando de
       ser verdadeiro.

       NÃO É DECISÃO, É ESCRITURAÇÃO. Não há julgamento a fazer: o log
       registra o reenvio, o status contradiz, e os dois não podem estar
       certos. Por isso pode ser automático — o limite da REGRA Nº 0.6 é não
       decidir pela pessoa, e aqui não há o que decidir.

       E NÃO É EM SILÊNCIO: quando ajusta alguma coisa, grava no log de
       sistema com nome próprio, para aparecer na auditoria.

       VEM ANTES da verificação de bounce de propósito. O ofício reconciliado
       passa a ENVIADO, e só nesse estado ele volta a ser examinado por esta
       função — reconciliar depois deixaria a checagem dele para a próxima
       execução, cinco minutos mais tarde. */
    try {
      if (typeof oficio_reconciliarReenvios_ === "function") {
        var rec = oficio_reconciliarReenvios_(false);
        if (rec && rec.ajustados > 0) {
          Logger.log("verificarFalhasEntregaOficios: " + rec.ajustados +
                     " ofício(s) reconciliado(s) — reenviados que seguiam como falha.");
          try {
            registrarLogSistema_({
              usuario: "sistema",
              numero:  rec.ajustados + " ofício(s)",
              tipo:    "OFICIOS_REENVIO_RECONCILIADO",
              escola:  "",
              cnpj:    "",
              email:   "",
              codigo:  rec.ajustar.map(function (a) { return a.numero; }).join(", ")
            });
          } catch (eLog) {}
        }
      }
    } catch (eRec) {
      /* Reconciliar é conveniência; verificar bounce é a obrigação desta
         função. Falhar na primeira não pode impedir a segunda. */
      Logger.log("verificarFalhasEntregaOficios: reconciliação falhou — " +
                 (eRec && eRec.message || eRec));
    }

    var ss = MON_OFICIOS_getSS_();
    var shRegistro = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!shRegistro || shRegistro.getLastRow() < 2) return { ok: true, falhas: 0, mensagem: "Registro vazio." };

    var headerMap     = getHeaderMap_(shRegistro);
    var colStatus     = headerMap["Status"];
    var colNumero     = headerMap["Número do Ofício"];
    var colEmailTodos = headerMap["E-mails (todos)"] || headerMap["E-mail (principal)"];
    var colObs        = headerMap["Observações"];
    /* Para separar bounce velho de bounce novo. Ausentes, a comparação cai
       num caminho conservador — ver `MON_OFICIOS_ultimoEnvio_`. */
    var colDataEnvio  = headerMap["Data envio ofício"] || headerMap["Data envio oficio"];
    var colReenvEm    = headerMap[typeof OFICIO_COL_REENVIADO_EM !== "undefined"
                                    ? OFICIO_COL_REENVIADO_EM : "REENVIADO_EM"];
    var colJaFalhou   = headerMap[typeof OFICIO_COL_JA_FALHOU !== "undefined"
                                    ? OFICIO_COL_JA_FALHOU : "JA_FALHOU"];

    if (!colStatus || !colNumero || !colEmailTodos) {
      Logger.log("verificarFalhasEntregaOficios: colunas não encontradas.");
      return { ok: false, mensagem: "Colunas obrigatórias não encontradas." };
    }

    var dados = shRegistro.getRange(2, 1, shRegistro.getLastRow() - 1, shRegistro.getLastColumn()).getValues();
    var oficiosAtivos = [];

    for (var i = 0; i < dados.length; i++) {
      var status = MON_OFICIOS_normStatus_(dados[i][colStatus - 1]);
      if (status !== "ENVIADO" && status !== "PENDENTE") {
        /* CONFIRMADO tambem entra — mas SO quando a confirmacao foi
           AUTOMATICA. Achado em 01/09/2026: a confirmacao por palavra-chave
           marcava oficios que na verdade quicaram (ver a nota grande sobre
           MON_OFICIOS_CONFIRMA_), e uma vez confirmado o oficio saia deste
           filtro para sempre — nenhuma rotina voltava a olha-lo.

           O que uma PESSOA confirmou fica intocado: ela viu a resposta, e o
           bounce de um endereco antigo nao pode desfazer isso. A distincao
           existe porque o proprio sistema grava a origem na observacao. */
        if (status !== "CONFIRMADO") continue;
        var obsConf = colObs ? String(dados[i][colObs - 1] || "") : "";
        if (!/confirma[\u00e7c][\u00e3a]o localizada automaticamente/i.test(obsConf)) continue;
      }

      var numero = String(dados[i][colNumero - 1] || "").trim();
      if (!numero) continue;

      var emails = MON_OFICIOS_normalizarEmails_(dados[i][colEmailTodos - 1]);
      if (!emails.length) continue;

      oficiosAtivos.push({
        linhaReal: i + 2, numero: numero, emails: emails,
        dataEnvio:   colDataEnvio ? dados[i][colDataEnvio - 1] : null,
        reenviadoEm: colReenvEm   ? dados[i][colReenvEm   - 1] : null,
        jaFalhou: colJaFalhou &&
          String(dados[i][colJaFalhou - 1] || "").trim().toUpperCase() === "SIM"
      });
    }

    if (!oficiosAtivos.length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum ofício ativo para verificar.");
      return { ok: true, falhas: 0, mensagem: "Nenhum ofício ativo para verificar." };
    }

    var queryBounce = [
      "subject:(\"delivery failed\")",
      "subject:(\"delivery status notification\")",
      "subject:(\"undeliverable\")",
      "subject:(\"mail delivery failed\")",
      "subject:(\"falha na entrega\")",
      "subject:(\"returned mail\")",
      "subject:(\"failure notice\")"
    ].join(" OR ");

    var threads = [];
    try {
      threads = GmailApp.search("(" + queryBounce + ") newer_than:90d", 0, 50);
    } catch (eSearch) {
      Logger.log("⚠ Erro ao buscar avisos de não entrega: " + eSearch.message);
      return { ok: false, mensagem: eSearch.message };
    }

    if (!threads.length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum aviso de não entrega encontrado.");
      return { ok: true, falhas: 0, mensagem: "Nenhum aviso de e-mail não entregue encontrado." };
    }

    /* ══════════════════════════════════════════════════════════════════════
       BOUNCE VELHO NÃO CONDENA ENVIO NOVO — 08/09/2026

       O usuário mandou o print da caixa de entrada: o MESMO alerta
       "9 ofício(s) com falha de entrega", de três em três horas, dias
       seguidos. E ele já tinha criado um rótulo `SISGEP_Ignorado` para
       varrê-los da vista — que é a prova do estrago. Alerta que se repete
       vira ruído, ruído é filtrado, e o alerta seguinte, o de verdade, cai
       na mesma pasta e ninguém vê.

       Depois disse a frase que fechou o diagnóstico: **"esses ofícios foram
       enviados"**. Não era o alerta que estava com defeito — era a detecção
       marcando como falha o que tinha chegado.

       O CICLO, que se fechava sozinho:

         1. ofício quica            → Status = FALHA_ENTREGA
         2. alguém reenvia          → Status volta a ENVIADO
         3. este gatilho roda       → ENVIADO está na lista de ativos
         4. o Registro ainda guarda o endereço MORTO em "E-mails (todos)"
         5. a busca é newer_than:90d — o bounce de março ainda está no Gmail
         6. casa por ENDEREÇO       → marca FALHA_ENTREGA de novo → alerta
                                     └── volta ao 2, a cada três horas ──┘

       Três coisas se somavam: a detecção casava por endereço e não por
       envio; o reenvio não gravava quando aconteceu; e o bounce sobrevive
       90 dias. Guardar só `true` jogava fora justamente o dado que separa
       "quicou agora" de "quicou em março".

       Agora guarda a data do bounce mais recente por endereço, e a
       comparação com a data do último envio decide. Um bounce anterior ao
       reenvio não diz nada sobre ele.
       ══════════════════════════════════════════════════════════════════════ */
    var emailsComBounce = {};
    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(msg) {
        var quando = null;
        try { quando = msg.getDate(); } catch (eData) { quando = null; }
        var corpo = (msg.getPlainBody() || "") + " " + (msg.getBody() || "");
        (corpo.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach(function(email) {
          var n = String(email || "").trim().toLowerCase();
          if (!n || n.indexOf("sindeducacao.com") > -1) return;
          /* Fica o bounce MAIS RECENTE do endereço: é o único que pode ser
             posterior ao último envio. */
          var atual = emailsComBounce[n];
          if (!atual || (quando && atual < quando)) emailsComBounce[n] = quando || new Date(0);
        });
      });
    });

    if (!Object.keys(emailsComBounce).length) {
      Logger.log("verificarFalhasEntregaOficios: nenhum endereço extraído dos avisos.");
      return { ok: true, falhas: 0, mensagem: "Nenhum endereço extraído dos avisos de não entrega." };
    }

    var totalFalhas = 0, numerosComFalha = [];
    var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    oficiosAtivos.forEach(function(item) {
      /* O bounce só vale se for POSTERIOR ao último envio deste ofício. Antes
         a comparação era `=== true`, o que dava o mesmo peso a um bounce de
         março e a um de hoje — e era o que devolvia à falha, de três em três
         horas, ofício que já tinha sido reenviado e entregue. */
      var envio = MON_OFICIOS_ultimoEnvio_(item);
      var teveBounce = item.emails.some(function(e) {
        var quandoQuicou = emailsComBounce[e];
        if (!quandoQuicou) return false;
        if (!envio) {
          /* Sem data de envio não dá para comparar. Para ofício que NUNCA
             falhou, o bounce vale — é a única informação que existe. Para o
             que JÁ foi reenviado, não: reabri-lo sem prova nova é exatamente
             o ciclo que este conserto existe para quebrar. */
          return !item.jaFalhou;
        }
        return quandoQuicou > envio;
      });
      if (!teveBounce) return;

      shRegistro.getRange(item.linhaReal, colStatus).setValue("FALHA_ENTREGA");

      if (colObs) {
        var obsAtual = String(shRegistro.getRange(item.linhaReal, colObs).getValue() || "").trim();
        var novaObs = obsAtual
          ? obsAtual + " | " + MON_OFICIOS_TEXTO_NAO_CHEGOU + agora
          : MON_OFICIOS_TEXTO_NAO_CHEGOU + agora;
        shRegistro.getRange(item.linhaReal, colObs).setValue(novaObs);
      }

      MON_OFICIOS_atualizarStatusNaFila_(ss, item.numero, "FALHA_ENTREGA", MON_OFICIOS_TEXTO_NAO_CHEGOU + agora);

      registrarLogSistema_({
        usuario: "sistema",
        numero: item.numero + " (FALHA_ENTREGA)",
        tipo: "E-mail não chegou",
        escola: item.emails.join(", "),
        cnpj: "",
        email: item.emails.join(", "),
        codigo: ""
      });

      Logger.log("❌ Não chegou — Ofício " + item.numero + " · " + item.emails.join(", "));
      numerosComFalha.push(item.numero);
      totalFalhas++;
    });

    /* Avisa só o que é NOVO. Ver o bloco em notificarFalhasEntregaOficios_. */
    if (totalFalhas > 0) notificarFalhasEntregaOficios_(numerosComFalha);
    return { ok: true, falhas: totalFalhas, mensagem: totalFalhas + " falha(s) registrada(s)." };

  } catch (e) {
    Logger.log("❌ Erro em verificarFalhasEntregaOficios: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/**
 * Quando este ofício saiu pela última vez.
 *
 * O reenvio vale mais que a emissão: é o envio mais recente, e é contra ele
 * que um bounce precisa ser comparado. Devolve null quando nenhuma das duas
 * datas é utilizável — data inválida na planilha não pode virar 1970 e fazer
 * todo bounce parecer novo.
 */
function MON_OFICIOS_ultimoEnvio_(item) {
  var candidatas = [item.reenviadoEm, item.dataEnvio];
  var melhor = null;
  for (var i = 0; i < candidatas.length; i++) {
    var d = candidatas[i];
    if (d instanceof Date && !isNaN(d.getTime())) {
      if (!melhor || d > melhor) melhor = d;
    }
  }
  return melhor;
}

/* ══════════════════════════════════════════════════════════════════════════
   O ALERTA AVISA O QUE É NOVO — 08/09/2026

   O usuário mandou o print: o mesmo "9 ofício(s) com falha de entrega", de
   três em três horas, dias a fio. E já tinha criado o rótulo
   `SISGEP_Ignorado` para tirá-los da frente.

   Esse rótulo é a medida do defeito. **Alerta que se repete vira ruído,
   ruído é filtrado, e o próximo alerta — o que importa — cai na mesma pasta
   e ninguém vê.** O aviso não fica só inútil: fica pior que não existir,
   porque dá a impressão de que alguém está vigiando.

   Havia ainda um custo lateral que ninguém contava: cada alerta gasta um
   destinatário da cota diária do Gmail, a MESMA que vai entregar os 2.000
   ingressos da festa. Oito por dia, duzentos e quarenta por mês.

   Agora o conjunto já avisado fica guardado, e só sai e-mail quando entra
   ofício que ainda não foi. Quando a lista esvazia, o registro zera — se o
   mesmo ofício voltar a falhar depois de resolvido, é notícia de novo.
   ══════════════════════════════════════════════════════════════════════════ */
var MON_OFICIOS_PROP_ALERTADOS = "SISGEP_OFICIOS_FALHA_ALERTADOS";

function MON_OFICIOS_lerAlertados_() {
  try {
    var bruto = PropertiesService.getScriptProperties()
                  .getProperty(MON_OFICIOS_PROP_ALERTADOS);
    var lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) { return []; }
}

function MON_OFICIOS_gravarAlertados_(numeros) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty(MON_OFICIOS_PROP_ALERTADOS, JSON.stringify(numeros || []));
  } catch (e) {
    Logger.log("⚠ Não foi possível guardar os alertados: " + e.message);
  }
}

function notificarFalhasEntregaOficios_(numerosComFalha) {
  /* Compatível com o formato antigo (só o total). Sem os números não há como
     saber o que é novo — então avisa, que é o comportamento conservador. */
  var lista = Array.isArray(numerosComFalha) ? numerosComFalha : null;
  var totalFalhas = lista ? lista.length : Number(numerosComFalha || 0);
  if (!totalFalhas) return;

  var novos = lista;
  if (lista) {
    var jaAvisados = MON_OFICIOS_lerAlertados_();
    novos = lista.filter(function (n) { return jaAvisados.indexOf(n) < 0; });
    /* O registro passa a ser a lista ATUAL, não a união: ofício que saiu da
       falha some daqui e, se voltar, vira notícia outra vez. */
    MON_OFICIOS_gravarAlertados_(lista);
    if (!novos.length) {
      Logger.log("Falhas de entrega: " + totalFalhas +
                 " ofício(s), nenhum novo desde o último aviso — e-mail não enviado.");
      return;
    }
  }

  try {
    var htmlBody = "<div style='font-family:Arial,sans-serif;padding:20px;max-width:600px;'>" +
      "<div style='background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:16px 20px;margin-bottom:16px;'>" +
      "<strong style='color:#991b1b;font-size:15px;'>⚠️ Falhas de entrega detectadas</strong>" +
      "<p style='margin:8px 0 0;font-size:13px;color:#7f1d1d;'>" +
        (novos ? novos.length + " ofício(s) NOVO(S) que não chegaram ao destino"
               : totalFalhas + " ofício(s) que não chegaram ao destino") +
        ". Acesse o painel SISGEP para verificar.</p>" +
      /* NOMEAR os ofícios. "9 com falha" não diz o que fazer nem permite
         perceber que é sempre a mesma lista — foi assim que o aviso virou
         rótulo de ignorados. Com os números, dá para agir sem abrir o painel. */
      (novos && novos.length
        ? "<p style='margin:10px 0 0;font-size:13px;color:#7f1d1d;'><strong>Novos:</strong> " +
          novos.join(", ") + "</p>"
        : "") +
      (novos && totalFalhas > novos.length
        ? "<p style='margin:6px 0 0;font-size:12px;color:#9a3412;'>Outros " +
          (totalFalhas - novos.length) + " já avisados continuam em falha.</p>"
        : "") +
      "</div>" +
      "<p style='font-size:13px;color:#334155;'>Este e-mail foi gerado automaticamente pelo SISGEP. " +
      "Você só recebe este aviso quando aparece ofício novo em falha.</p></div>";

    GmailApp.sendEmail(
      "financeiro@sindeducacao.com",
      "⚠️ SISGEP — " + (novos ? novos.length : totalFalhas) + " ofício(s) com falha de entrega",
      "Falhas de entrega detectadas. Acesse o painel SISGEP.",
      { htmlBody: htmlBody, name: "SISGEP — Alerta Automático" }
    );
  } catch (e) {
    Logger.log("⚠ Erro ao notificar falhas: " + e.message);
  }
}

/* ── Painel de Status ── */

function _resumoStatusVazio_() {
  return { total: 0, confirmados: 0, enviados: 0, pendentes: 0, falhas: 0, erros: 0 };
}

function listarStatusOficios(filtros, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    filtros = filtros || {};

    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    var ss = MON_OFICIOS_getSS_();
    var itensControle = MON_OFICIOS_listarStatusControle_(ss);
    var itensFila     = MON_OFICIOS_listarStatusFila_(ss);

    var mapa = {};
    itensControle.concat(itensFila).forEach(function(item) {
      var chave = String(item.numero || "").trim() || (String(item.escola || "") + "::" + String(item.data || ""));
      if (!chave) return;

      if (!mapa[chave]) {
        mapa[chave] = item;
        return;
      }

      // Prioriza status mais recente/relevante sem descartar dados do Controle.
      mapa[chave] = MON_OFICIOS_mesclarItemStatus_(mapa[chave], item);
    });

    var itens = Object.keys(mapa).map(function(k) { return mapa[k]; });
    var resumo = MON_OFICIOS_resumirItens_(itens);

    itens = MON_OFICIOS_aplicarFiltrosStatus_(itens, filtros);
    itens.sort(MON_OFICIOS_ordenarStatus_);

    // Paginação opcional (achado #9) — resumo continua batendo com o total
    // real (calculado acima, antes de filtrar/paginar); só a lista de itens
    // é fatiada, e só se filtros.porPagina for enviado.
    var pag = paginarItens_(itens, filtros);
    return {
      erro: false, itens: pag.itens, resumo: resumo,
      total: pag.total, pagina: pag.pagina, porPagina: pag.porPagina, totalPaginas: pag.totalPaginas
    };

  } catch (e) {
    Logger.log("❌ Erro em listarStatusOficios: " + e.message);
    return { erro: true, mensagem: e.message, itens: [], resumo: _resumoStatusVazio_() };
  }
}

function atualizarStatusOficio(numero, novoStatus, observacao, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    novoStatus = MON_OFICIOS_normStatus_(novoStatus);
    var statusPermitidos = ["CONFIRMADO", "FALHA_ENTREGA", "ENVIADO", "PENDENTE", "ERRO", "ERRO_PERMANENTE", "PROCESSANDO"];
    if (statusPermitidos.indexOf(novoStatus) === -1) throw new Error("Status inválido: " + novoStatus);

    var ss = MON_OFICIOS_getSS_();
    var alvo = String(numero || "").trim();
    if (!alvo) throw new Error("Número do ofício não informado.");

    var atualizouControle = MON_OFICIOS_atualizarStatusNoControle_(ss, alvo, novoStatus, observacao);
    var atualizouFila     = MON_OFICIOS_atualizarStatusNaFila_(ss, alvo, novoStatus, observacao);

    if (atualizouControle || atualizouFila) {
      registrarLogSistema_({
        usuario: emailUsuario,
        numero: alvo + " (STATUS → " + novoStatus + ")",
        tipo: "",
        escola: "",
        cnpj: "",
        email: "",
        codigo: ""
      });

      return { erro: false, mensagem: "Status atualizado para " + novoStatus + "." };
    }

    return { erro: true, mensagem: "Ofício " + alvo + " não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: e.message };
  }
}

/* ============================================================================
   HELPERS PRIVADOS DO MONITORAMENTO
============================================================================ */

function MON_OFICIOS_getSS_() {
  return SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
}

function MON_OFICIOS_normStatus_(v) {
  return String(v || "").trim().toUpperCase();
}

function MON_OFICIOS_normalizarEmails_(valor) {
  return String(valor || "")
    .split(/[\n,;]+/)
    .map(function(e) { return String(e || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(e, i, arr) { return arr.indexOf(e) === i; });
}

function MON_OFICIOS_formatarData_(v) {
  if (!v) return "";
  try {
    if (typeof formatarDataHoraBR_ === "function") return formatarDataHoraBR_(v);
    return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  } catch (e) {
    return String(v || "");
  }
}

function MON_OFICIOS_diasSemResposta_(dataVal) {
  if (!dataVal) return null;
  var d = dataVal instanceof Date ? dataVal : new Date(dataVal);
  if (isNaN(d.getTime())) return null;
  return Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function MON_OFICIOS_listarStatusControle_(ss) {
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["Status"];
  var cNumero = hm["Número do Ofício"];
  var cTipo   = hm["TIPO"] || hm["Tipo"];
  var cEscola = hm["Escola (Razão Social)"] || hm["NomeEscola"] || hm["Escola"];
  var cEmail  = hm["E-mails (todos)"] || hm["E-mail (principal)"] || hm["EmailsTodos"] || hm["Email"];
  var cData   = hm["Data envio ofício"] || hm["DATA_CRIACAO"];
  var cObs    = hm["Observações"] || hm["OBSERVACOES"];
  var cLink   = hm["Link PDF (Drive)"] || hm["LINK_PDF"];

  if (!cStatus || !cNumero) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  dados.forEach(function(row) {
    var numero = String(row[cNumero - 1] || "").trim();
    if (!numero) return;

    var status = MON_OFICIOS_normStatus_(row[cStatus - 1]) || "PENDENTE";
    var tipoRaw = cTipo ? String(row[cTipo - 1] || "").trim() : "";
    var dataVal = cData ? row[cData - 1] : null;

    itens.push({
      origem: "Controle",
      numero: numero,
      status: status,
      tipo: typeof obterLabelTipoOficio_ === "function" ? obterLabelTipoOficio_(tipoRaw) : tipoRaw,
      tipoRaw: tipoRaw,
      escola: cEscola ? String(row[cEscola - 1] || "").trim() : "",
      email: cEmail ? String(row[cEmail - 1] || "").trim() : "",
      data: MON_OFICIOS_formatarData_(dataVal),
      obs: cObs ? String(row[cObs - 1] || "").trim() : "",
      link: cLink ? String(row[cLink - 1] || "").trim() : "",
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal)
    });
  });

  return itens;
}

function MON_OFICIOS_listarStatusFila_(ss) {
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return [];

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cTipo   = hm["TIPO"];
  var cEscola = hm["ESCOLA"];
  var cEmail  = hm["EMAILS_TODOS"] || hm["EMAIL_PRINCIPAL"];
  var cData   = hm["DATA_CRIACAO"];
  var cErro   = hm["ULTIMO_ERRO"];
  var cAnexos = hm["ANEXOS_JSON"];

  if (!cStatus || !cNumero) return [];

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var itens = [];

  dados.forEach(function(row) {
    var numero = String(row[cNumero - 1] || "").trim();
    if (!numero) return;

    var status = MON_OFICIOS_normStatus_(row[cStatus - 1]) || "PENDENTE";
    if (status === "ERRO_PERMANENTE") status = "ERRO";

    var tipoRaw = cTipo ? String(row[cTipo - 1] || "").trim() : "";
    var dataVal = cData ? row[cData - 1] : null;

    itens.push({
      origem: "Fila",
      numero: numero,
      status: status,
      tipo: typeof obterLabelTipoOficio_ === "function" ? obterLabelTipoOficio_(tipoRaw) : tipoRaw,
      tipoRaw: tipoRaw,
      escola: cEscola ? String(row[cEscola - 1] || "").trim() : "",
      email: cEmail ? String(row[cEmail - 1] || "").trim() : "",
      data: MON_OFICIOS_formatarData_(dataVal),
      obs: cErro ? String(row[cErro - 1] || "").trim() : "",
      link: cAnexos ? MON_OFICIOS_extrairLinkPdf_(row[cAnexos - 1]) : "",
      diasSemResposta: MON_OFICIOS_diasSemResposta_(dataVal)
    });
  });

  return itens;
}

function MON_OFICIOS_mesclarItemStatus_(a, b) {
  var prioridade = { FALHA_ENTREGA: 0, ERRO: 1, PENDENTE: 2, PROCESSANDO: 3, ENVIADO: 4, CONFIRMADO: 5 };
  var pa = prioridade[a.status] !== undefined ? prioridade[a.status] : 9;
  var pb = prioridade[b.status] !== undefined ? prioridade[b.status] : 9;

  // Menor prioridade numérica = mais crítico. Mantém o mais crítico, mas completa campos vazios.
  var base = pb < pa ? b : a;
  var extra = pb < pa ? a : b;

  Object.keys(extra).forEach(function(k) {
    if ((base[k] === "" || base[k] === null || base[k] === undefined) && extra[k]) base[k] = extra[k];
  });

  base.origem = base.origem === extra.origem ? base.origem : "Controle/Fila";
  return base;
}

function MON_OFICIOS_resumirItens_(itens) {
  var resumo = _resumoStatusVazio_();
  (itens || []).forEach(function(i) {
    var s = MON_OFICIOS_normStatus_(i.status);
    if (!s) return;
    resumo.total++;
    if      (s === "CONFIRMADO")    resumo.confirmados++;
    else if (s === "ENVIADO")       resumo.enviados++;
    else if (s === "PENDENTE" || s === "PROCESSANDO") resumo.pendentes++;
    else if (s === "FALHA_ENTREGA") resumo.falhas++;
    else if (s === "ERRO" || s === "ERRO_PERMANENTE") resumo.erros++;
  });
  return resumo;
}

function MON_OFICIOS_aplicarFiltrosStatus_(itens, filtros) {
  filtros = filtros || {};
  var statusFiltro = MON_OFICIOS_normStatus_(filtros.status);
  var tipoFiltro = String(filtros.tipo || "").trim().toLowerCase();
  var escolaFiltro = String(filtros.escola || "").trim().toLowerCase();
  var numeroFiltro = String(filtros.numero || "").trim().toLowerCase();

  return (itens || []).filter(function(i) {
    if (statusFiltro && MON_OFICIOS_normStatus_(i.status) !== statusFiltro) return false;
    if (tipoFiltro && String(i.tipoRaw || i.tipo || "").toLowerCase().indexOf(tipoFiltro) === -1) return false;
    if (escolaFiltro && String(i.escola || "").toLowerCase().indexOf(escolaFiltro) === -1) return false;
    if (numeroFiltro && String(i.numero || "").toLowerCase().indexOf(numeroFiltro) === -1) return false;
    return true;
  });
}

function MON_OFICIOS_ordenarStatus_(a, b) {
  var p = { FALHA_ENTREGA: 0, ERRO: 1, PENDENTE: 2, PROCESSANDO: 3, ENVIADO: 4, CONFIRMADO: 5 };
  var pa = p[a.status] !== undefined ? p[a.status] : 9;
  var pb = p[b.status] !== undefined ? p[b.status] : 9;
  if (pa !== pb) return pa - pb;
  return (b.diasSemResposta || 0) - (a.diasSemResposta || 0);
}

function MON_OFICIOS_atualizarStatusNoControle_(ss, numero, novoStatus, observacao) {
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) return false;

  var hm = getHeaderMap_(sh);
  var cStatus = hm["Status"];
  var cNumero = hm["Número do Ofício"];
  var cObs    = hm["Observações"];
  if (!cStatus || !cNumero) return false;

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var atualizou = false;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][cNumero - 1] || "").trim() !== String(numero || "").trim()) continue;

    sh.getRange(i + 2, cStatus).setValue(novoStatus);

    if (cObs && observacao) {
      var obsAtual = String(sh.getRange(i + 2, cObs).getValue() || "").trim();
      var registro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      var novaObs = obsAtual
        ? obsAtual + " | " + novoStatus + " em " + registro + ": " + observacao
        : novoStatus + " em " + registro + ": " + observacao;
      sh.getRange(i + 2, cObs).setValue(novaObs);
    }

    atualizou = true;
  }

  return atualizou;
}

function MON_OFICIOS_atualizarStatusNaFila_(ss, numero, novoStatus, observacao) {
  var sh = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!sh || sh.getLastRow() < 2) return false;

  var hm = getHeaderMap_(sh);
  var cStatus = hm["STATUS"];
  var cNumero = hm["NUMERO_OFICIO"];
  var cErro   = hm["ULTIMO_ERRO"];
  var cData   = hm["DATA_ULTIMA_TENTATIVA"];
  if (!cStatus || !cNumero) return false;

  var totalCols = sh.getLastColumn();
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, totalCols).getValues();
  var atualizou = false;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][cNumero - 1] || "").trim() !== String(numero || "").trim()) continue;

    var row = dados[i].slice();
    row[cStatus - 1] = novoStatus;
    if (cErro && observacao) row[cErro - 1] = String(observacao || "").trim();
    if (cData) row[cData - 1] = new Date();
    sh.getRange(i + 2, 1, 1, totalCols).setValues([row]);
    atualizou = true;
  }

  return atualizou;
}

function MON_OFICIOS_extrairLinkPdf_(anexosJson) {
  try {
    var anexos = JSON.parse(String(anexosJson || "[]"));
    var pdf = null;
    for (var i = 0; i < anexos.length; i++) {
      if (String(anexos[i].mimeType || "").indexOf("pdf") > -1) {
        pdf = anexos[i];
        break;
      }
    }
    if (!pdf && anexos.length) pdf = anexos[0];
    if (pdf && pdf.fileId) return "https://drive.google.com/file/d/" + pdf.fileId + "/view";
  } catch (e) {}
  return "";
}
