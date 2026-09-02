/**
 * DIAGNOSTICO DO ITEM 49 — SO LEITURA, e com porta.
 * ============================================================================
 *
 * ESTA E A VERSAO DO REPOSITORIO, que vai para a HOMOLOGACAO pelo deploy.
 * Existe uma segunda em tests/fixtures/producao/DiagnosticoItem49.gs.txt, SEM
 * porta, e a diferenca e proposital — esta abaixo.
 *
 * POR QUE DUAS VERSOES
 *
 * A porta e o `exigirAdminOuSessao_`, que so existe se o projeto ja tiver o
 * AcessoModulos.gs numa versao recente. A homologacao tem (esta na versao 94,
 * que veio deste repositorio). A PRODUCAO nao se sabe — e descobrir isso e
 * justamente uma das tres perguntas que este diagnostico existe para
 * responder. Por a porta na versao de producao seria fazer o diagnostico
 * depender da resposta que ele foi escrito para dar.
 *
 * POR QUE A PORTA AQUI, ENTAO
 *
 * Sem ela esta funcao entraria na contagem de exposicao, que estava em 204 de
 * um teto de 204 quando este arquivo nasceu (02/09/2026). Uma ferramenta
 * temporaria nao vale gastar um teto que custou quatro rodadas para descer de
 * 224 ate ali. A porta dupla resolve as duas pontas: o editor executa (o
 * `Session.getActiveUser()` devolve o e-mail de quem clicou), e a rota web
 * recusa sem sessao — entao o t6 nao a conta.
 *
 * O RELATORIO E O MESMO NOS DOIS ARQUIVOS, e o t137 compara os dois textos
 * para que nao divirjam em silencio.
 *
 * NAO ESCREVE NADA: sem setValue, sem appendRow, sem envio de e-mail. So le a
 * aba de Registro e escreve no Logger.
 */

/**
 * Ferramenta de editor. Rode `diagnosticoItem49` pelo seletor de funcoes e
 * leia o log. Depois de usada, o arquivo pode sair do projeto.
 */
function diagnosticoItem49(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "documentos", "Diagnostico do item 49", true);
  return diagnosticoItem49_relatorio_();
}

/** Os tres oficios do achado. Muda aqui se quiser olhar outros. */
var DIAG49_OFICIOS = ["144", "236", "242"];

/** Marca que o proprio sistema grava quando quem confirmou foi a rotina. */
var DIAG49_MARCA_AUTOMATICA = /confirma[çc][ãa]o localizada automaticamente/i;

function diagnosticoItem49_relatorio_() {
  var L = [];
  L.push("DIAGNOSTICO DO ITEM 49 — " + new Date().toISOString());
  L.push("");

  /* ── 1. quais funcoes existem neste projeto ─────────────────────────── */
  L.push("1. FUNCOES PRESENTES NESTE PROJETO");
  /* SO OS NOMES NOVOS FICAM ESCRITOS AQUI. Para cada um terminado em "_", a
     versao SEM underscore e sondada tambem, derivando a string — nunca
     escrevendo o nome antigo por extenso.

     Nao e estilo: o t127 varre o repositorio atras de referencia ao nome
     antigo, porque renomear funcao usada por seis arquivos quebra em silencio
     (o Apps Script so reclama quando alguem aperta o botao). Um nome velho
     escrito aqui seria indistinguivel de uma chamada esquecida. Derivando, o
     detector continua inteiro e o diagnostico ganha alcance: ele passa a
     conferir os DOIS lados de toda funcao que foi fechada, e nao so a uma que
     eu tivesse lembrado de listar. */
  var nomes = ["registrarLogSistema_", "exigirModulo_", "exigirAdminOuSessao_",
               "exigirQualquerModulo_", "paginarItens_", "getHeaderMap_",
               "obterOuCriarAbaFilaOficios_", "MON_OFICIOS_textoConfirmaRecebimento_",
               "verificarConfirmacoesRecebimento", "verificarFalhasEntregaOficios"];
  var aSondar = [];
  for (var q = 0; q < nomes.length; q++) {
    aSondar.push([nomes[q], ""]);
    if (nomes[q].charAt(nomes[q].length - 1) === "_") {
      aSondar.push([nomes[q].slice(0, -1), "   <- nome ANTIGO, sem underscore"]);
    }
  }
  for (var n = 0; n < aSondar.length; n++) {
    var tem = false;
    try { tem = (eval("typeof " + aSondar[n][0]) === "function"); } catch (e) { tem = false; }
    L.push("   " + (tem ? "[x] TEM     " : "[ ] NAO TEM ") + aSondar[n][0] + aSondar[n][1]);
  }
  L.push("");

  /* ── 2 e 3. o que a planilha diz ─────────────────────────────────────── */
  var ss, sh;
  try {
    ss = SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    sh = ss.getSheetByName(PLANILHA_REGISTRO);
  } catch (e) {
    L.push("!! nao consegui abrir a planilha: " + e);
    Logger.log(L.join("\n"));
    return L.join("\n");
  }
  if (!sh || sh.getLastRow() < 2) {
    L.push("!! aba de Registro vazia ou inexistente (" + PLANILHA_REGISTRO + ")");
    Logger.log(L.join("\n"));
    return L.join("\n");
  }

  var hm      = getHeaderMap_(sh);
  var cNum    = hm["Número do Ofício"];
  var cStatus = hm["Status"];
  var cObs    = hm["Observações"];
  var cEmail  = hm["E-mails (todos)"] || hm["E-mail (principal)"];

  if (!cNum || !cStatus) {
    L.push("!! faltam colunas obrigatorias: Número do Ofício / Status");
    Logger.log(L.join("\n"));
    return L.join("\n");
  }
  if (!cObs) L.push("   (aviso: nao existe coluna 'Observações' — o item 3 nao vai medir nada)");

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  L.push("2. OS OFICIOS DO ACHADO");
  for (var k = 0; k < DIAG49_OFICIOS.length; k++) {
    var alvo = DIAG49_OFICIOS[k];
    var achou = false;
    for (var i = 0; i < dados.length; i++) {
      var num = String(dados[i][cNum - 1] || "").trim();
      /* "144" tem que casar com "144" e com "144/2026", e nao com "1440". */
      if (num !== alvo && num.indexOf(alvo + "/") !== 0) continue;
      achou = true;
      var obs = cObs ? String(dados[i][cObs - 1] || "") : "";
      L.push("   Oficio " + num + "  (linha " + (i + 2) + ")");
      L.push("     status ....... " + String(dados[i][cStatus - 1] || "").trim());
      L.push("     e-mail ....... " + (cEmail ? String(dados[i][cEmail - 1] || "") : "(sem coluna)"));
      L.push("     confirmado por ROTINA? " + (DIAG49_MARCA_AUTOMATICA.test(obs) ? "SIM" : "nao"));
      L.push("     observacao ... " + (obs.length > 180 ? obs.substring(0, 180) + "..." : obs));
    }
    if (!achou) L.push("   Oficio " + alvo + ": NAO ENCONTRADO na aba de Registro");
  }
  L.push("");

  L.push("3. QUANTOS FORAM CONFIRMADOS PELA ROTINA (e nao por uma pessoa)");
  var totalAuto = 0, porStatus = {};
  if (cObs) {
    for (var j = 0; j < dados.length; j++) {
      if (!DIAG49_MARCA_AUTOMATICA.test(String(dados[j][cObs - 1] || ""))) continue;
      totalAuto++;
      var st = String(dados[j][cStatus - 1] || "").trim().toUpperCase() || "(vazio)";
      porStatus[st] = (porStatus[st] || 0) + 1;
    }
  }
  L.push("   total de oficios no Registro ..... " + dados.length);
  L.push("   confirmados automaticamente ...... " + totalAuto);
  for (var s in porStatus) L.push("     " + s + ": " + porStatus[s]);
  L.push("");
  L.push("   Estes " + totalAuto + " sao os candidatos a reconferencia. A correcao");
  L.push("   impede novos; os antigos so aparecem reprocessando.");

  var txt = L.join("\n");
  Logger.log(txt);
  return txt;
}
