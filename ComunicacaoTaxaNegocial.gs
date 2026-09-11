// ============================================================================
// ARQUIVO: ComunicacaoTaxaNegocial.gs
// A COMUNICAÇÃO DA TAXA NEGOCIAL ÀS ESCOLAS — fase 1, informativa
// ============================================================================
//
// DE ONDE VEIO, 11/09/2026. O usuário, por voz:
//
//   "preciso enviar um e-mail pras escolas com ofício, informando que o
//    período de competência é agora em setembro, a primeira parcela vence no
//    dia dez de outubro. Pra todas as escolas da base. Tem que ver a questão
//    da cota de e-mails por dia: se chegar próximo da cota ele trava, joga
//    para o dia seguinte, porque até o final do mês todas as escolas devem
//    ter sido comunicadas. Que seja escalonado, não tudo de uma vez."
//
// POR QUE ARQUIVO NOVO, E NÃO O TaxaAssistencial.gs QUE JÁ ENVIA EM MASSA.
// Três motivos, e nenhum é estético:
//
//   1. `prepararFilaTaxaAssistencial` chama `clearContents()` na aba inteira.
//      Numa campanha de um dia é inofensivo; numa de vinte, clicar "Preparar"
//      pela segunda vez apaga o registro de quem já recebeu — e o laço lê essa
//      mesma aba, então todo mundo recebe de novo.
//   2. A fila de lá é POR ESCOLA. A de cá é POR ENDEREÇO, e isso torna
//      estruturalmente impossível o bug que consertei hoje no outro arquivo:
//      não existe "escola pela metade" quando a unidade já é o endereço.
//   3. Lá o teto é cego — 100 por hora escritos no código, ZERO consultas à
//      cota. Aqui quem manda é o `CotaEmail.gs`, que pergunta antes.
//
// E POR QUE NÃO DENTRO DO MÓDULO DE OPOSIÇÃO. O `TaxaNegocialConfig.gs` e
// companhia são o portal de oposição do trabalhador, travado em homologação
// por `tnExigirHomologacaoSegura_()`. Isto aqui roda em produção e é outra
// coisa: comunicação ao empregador.
//
// ⚠ TUDO AQUI É PRIVADO, E ISSO NÃO É ESTILO. O teto de exposição do projeto
// está em 204 de 204 — zero folga —, e o `exposicao-teto.json` diz que ele só
// desce. Então o motor inteiro nasce sem porta. A tela vai precisar de UMA
// função pública, e essa é decisão registrada do usuário, não minha.
// ============================================================================

var TN_COM_ABA           = "COMUNICACAO_TAXA_NEGOCIAL";
var TN_COM_CAMPANHA      = "TAXA_NEGOCIAL";   /* a chave no CotaEmail.gs */
var TN_COM_MAX_TENTATIVAS = 3;

var TN_COM_CAB = ["ID","NUMERO_OFICIO","ESCOLA","CNPJ","EMAIL","STATUS",
                  "ERRO","TENTATIVAS","DATA_HORA","USUARIO","PDF_FILE_ID"];

var TN_COM_PROP = {
  NUMERO:      "TN_COM_NUMERO_OFICIO",
  CODIGO:      "TN_COM_CODIGO",
  CCT_ID:      "TN_COM_CCT_FILE_ID",
  CCT_NOME:    "TN_COM_CCT_NOME",
  TETO:        "TN_COM_TETO_DIA",
  ALVO:        "TN_COM_DATA_ALVO",
  COMPETENCIA: "TN_COM_COMPETENCIA",
  LIBERADA:    "TN_COM_LIBERADA",
  PAUSADA:     "TN_COM_PAUSADA"
};

function tnCom_props_() { return PropertiesService.getScriptProperties(); }

/**
 * A aba da campanha. NUNCA apaga conteúdo — é a diferença que motivou este
 * arquivo. Repreparar acrescenta o que falta e deixa intacto o que já saiu.
 */
function tnCom_aba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(TN_COM_ABA);
  if (!sh) {
    sh = ss.insertSheet(TN_COM_ABA);
    sh.getRange(1, 1, 1, TN_COM_CAB.length).setValues([TN_COM_CAB]).setFontWeight("bold");
  }
  return sh;
}

function tnCom_linhas_() {
  var sh = tnCom_aba_();
  if (sh.getLastRow() < 2) return { sh: sh, dados: [], hm: {} };
  var hm = {};
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cab.forEach(function (c, i) { hm[String(c || "").trim()] = i; });
  return {
    sh: sh, hm: hm,
    dados: sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O REMETENTE É MEDIDO, NUNCA AFIRMADO

   Este projeto pagou duas vezes por tela que afirmava remetente sem medir: os
   ofícios saíram de `financeirosindecucacao@gmail.com` durante meses com a
   tela dizendo outra coisa, e só se descobriu abrindo o cabeçalho do ofício
   287/2026.

   Aqui a consequência de errar é maior: 679 escolas recebendo documento
   oficial com remetente errado não tem desfazer. Então esta função não devolve
   uma promessa — devolve o que o Gmail vai realmente usar, e a tela BARRA a
   liberação quando não for o esperado. Nos ofícios barrar pararia trabalho
   vivo; aqui não há nada vivo ainda.
   ══════════════════════════════════════════════════════════════════════════ */

var TN_COM_REMETENTE_PRETENDIDO = "financeiro@sindeducacao.com";

function tnCom_remetente_() {
  var pretendido = TN_COM_REMETENTE_PRETENDIDO;
  var efetivo = "", aliases = [];

  try { efetivo = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  try {
    aliases = GmailApp.getAliases().map(function (a) {
      return String(a || "").trim().toLowerCase();
    });
  } catch (e2) {}

  var temAlias = aliases.indexOf(pretendido.toLowerCase()) !== -1;
  var ehAConta = efetivo === pretendido.toLowerCase();
  var ok = temAlias || ehAConta;

  return {
    ok: ok,
    pretendido: pretendido,
    /* De quem o e-mail VAI sair de verdade — não de quem gostaríamos. */
    real: ok ? pretendido : efetivo,
    contaExecutora: efetivo,
    aliases: aliases,
    mensagem: ok
      ? "As escolas vão ver: " + pretendido
      : "ATENÇÃO: o alias " + pretendido + " não está ativo nesta conta. " +
        "O e-mail sairia de " + (efetivo || "conta desconhecida") +
        ". Cadastre o alias em Gmail → Contas e importação → Enviar e-mail como."
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O TETO DO DIA NASCE CALCULADO, COM A CONTA À MOSTRA

   REGRA Nº 0.6: o sistema não deixa a pessoa fazer o que ele sabe fazer
   sozinho. Ela diz até quando quer todas comunicadas; o teto sai da divisão
   pelos dias úteis restantes — e a conta vai junto, para ser conferida e
   corrigida, nunca imposta em silêncio.
   ══════════════════════════════════════════════════════════════════════════ */

function tnCom_diasUteisAte_(alvo, desde) {
  var ini = new Date(desde || new Date());
  var fim = new Date(alvo);
  if (isNaN(fim.getTime())) return 0;
  ini.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  var dias = 0;
  var d = new Date(ini);
  while (d <= fim) {
    var s = d.getDay();
    if (s !== 0 && s !== 6) dias++;
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function tnCom_tetoSugerido_(enderecosRestantes, dataAlvo) {
  var dias = tnCom_diasUteisAte_(dataAlvo);
  var n = parseInt(enderecosRestantes, 10) || 0;
  if (n <= 0) return { teto: 0, dias: dias, conta: "nada restante" };
  /* Sem dia útil sobrando o prazo já estourou: manda tudo o que a cota
     permitir, em vez de devolver zero e travar a campanha. */
  if (dias <= 0) return { teto: n, dias: 0, conta: "prazo vencido — sem escalonar" };
  var teto = Math.ceil(n / dias);
  return {
    teto: teto, dias: dias,
    conta: n + " endereços ÷ " + dias + " dia(s) útil(eis) = " + teto + "/dia"
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PREPARAR A FILA — ACRESCENTA, NUNCA APAGA

   Uma linha POR ENDEREÇO, e é essa escolha que mata na origem o bug que o
   `TaxaAssistencial.gs` tinha: lá a unidade era a escola, o limite podia virar
   no meio dela, e a linha ficava PENDENTE depois de um dos endereços já ter
   recebido — no lote seguinte a escola inteira saía de novo, com o MESMO
   número de ofício. Quando a unidade já é o endereço, não existe "metade".

   Escola sem e-mail vira linha com STATUS = SEM_EMAIL. Não é falha de envio, é
   cadastro incompleto: fica esperando gente, não gasta tentativa e não entra
   na conta da cota.
   ══════════════════════════════════════════════════════════════════════════ */

function tnCom_normCab_(txt) {
  return String(txt || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function tnCom_lerEscolas_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("Escolas");
  if (!sh) throw new Error("Aba 'Escolas' não encontrada.");
  var dados = sh.getDataRange().getValues();
  if (!dados || dados.length < 2) throw new Error("Nenhuma escola cadastrada.");

  var cab = dados[0].map(function (h) { return String(h || "").trim(); });
  function achar(lista) {
    for (var i = 0; i < cab.length; i++) {
      for (var j = 0; j < lista.length; j++) {
        if (tnCom_normCab_(cab[i]) === tnCom_normCab_(lista[j])) return i;
      }
    }
    return -1;
  }

  var iNome  = achar(["Escola (Razão Social)","Escola","Razão Social","Nome Escola","Nome Fantasia"]);
  var iTodos = achar(["E-mails (todos)","Emails (todos)","Todos os E-mails","EmailsTodos"]);
  var iPrinc = achar(["E-mail (principal)","Email (principal)","E-mail","Email","EmailPrincipal"]);
  var iCnpj  = achar(["CNPJ"]);

  if (iNome === -1) throw new Error("Coluna da escola não encontrada na aba 'Escolas'.");
  if (iTodos === -1 && iPrinc === -1) throw new Error("Nenhuma coluna de e-mail encontrada.");

  var saida = [];
  for (var k = 1; k < dados.length; k++) {
    var nome = String(dados[k][iNome] || "").trim();
    if (!nome) continue;
    var bruto = (iTodos > -1 ? String(dados[k][iTodos] || "").trim() : "") ||
                (iPrinc > -1 ? String(dados[k][iPrinc] || "").trim() : "");
    saida.push({
      nome: nome,
      cnpj: iCnpj > -1 ? String(dados[k][iCnpj] || "").trim() : "",
      emailsBruto: bruto
    });
  }
  return saida;
}

function tnCom_preparar_(params, quem) {
  params = params || {};
  var sh = tnCom_aba_();
  var props = tnCom_props_();

  var numero = String(props.getProperty(TN_COM_PROP.NUMERO) || "").trim();
  if (!numero) {
    numero = gerarProximoNumeroSeguro_();
    props.setProperty(TN_COM_PROP.NUMERO, numero);
    var codigo = numero.replace("/", "-");
    try { if (typeof gerarCodigoVerificacao === "function") codigo = gerarCodigoVerificacao(numero); } catch (e) {}
    props.setProperty(TN_COM_PROP.CODIGO, codigo);
  }

  /* O que JÁ está na fila, para não duplicar no repreparo. A chave é
     escola+endereço: a mesma escola pode ganhar um contato novo no cadastro
     entre uma preparação e outra, e esse contato TEM de entrar. */
  var atual = tnCom_linhas_();
  var jaTem = {};
  atual.dados.forEach(function (r) {
    var k = String(r[atual.hm["ESCOLA"]] || "").trim().toLowerCase() + "|" +
            String(r[atual.hm["EMAIL"]]  || "").trim().toLowerCase();
    jaTem[k] = true;
  });

  var escolas = tnCom_lerEscolas_();
  var novas = [], agora = new Date();
  var contagem = { escolas: escolas.length, enderecos: 0, semEmail: 0, invalidos: 0, acrescentados: 0 };

  escolas.forEach(function (e) {
    if (!e.emailsBruto) {
      contagem.semEmail++;
      var kv = e.nome.toLowerCase() + "|";
      if (!jaTem[kv]) {
        novas.push([Utilities.getUuid(), numero, e.nome, e.cnpj, "", "SEM_EMAIL",
                    "Escola sem e-mail no cadastro", 0, agora, quem, ""]);
        jaTem[kv] = true;
      }
      return;
    }

    var v = validarListaEmails_(e.emailsBruto);
    var lista = (v.ok && v.emails) ? v.emails : [];
    if (!v.ok) {
      contagem.invalidos++;
      var ki = e.nome.toLowerCase() + "|" + String(v.invalido || "").toLowerCase();
      if (!jaTem[ki]) {
        novas.push([Utilities.getUuid(), numero, e.nome, e.cnpj, String(v.invalido || ""),
                    "EMAIL_INVALIDO", "E-mail inválido no cadastro", 0, agora, quem, ""]);
        jaTem[ki] = true;
      }
    }

    lista.forEach(function (email) {
      contagem.enderecos++;
      var k = e.nome.toLowerCase() + "|" + String(email).trim().toLowerCase();
      if (jaTem[k]) return;
      novas.push([Utilities.getUuid(), numero, e.nome, e.cnpj, String(email).trim(),
                  "PENDENTE", "", 0, "", quem, ""]);
      jaTem[k] = true;
      contagem.acrescentados++;
    });
  });

  if (novas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, novas.length, TN_COM_CAB.length).setValues(novas);
  }

  if (params.anexo && params.anexo.base64) {
    try {
      var pasta = obterPastaPorTipo_("TAXA_NEGOCIAL");
      var nomeCct = String(params.anexo.nome || "CCT.pdf").trim();
      var arq = pasta.createFile(Utilities.newBlob(
        Utilities.base64Decode(params.anexo.base64),
        params.anexo.tipo || "application/pdf", nomeCct));
      props.setProperty(TN_COM_PROP.CCT_ID, arq.getId());
      props.setProperty(TN_COM_PROP.CCT_NOME, nomeCct);
    } catch (eC) {
      Logger.log("⚠ CCT não pôde ser guardada: " + (eC.message || eC));
    }
  }

  if (params.competencia) props.setProperty(TN_COM_PROP.COMPETENCIA, String(params.competencia));
  if (params.dataAlvo)    props.setProperty(TN_COM_PROP.ALVO, String(params.dataAlvo));

  var pendentes = tnCom_contar_().PENDENTE || 0;
  var sug = tnCom_tetoSugerido_(pendentes, props.getProperty(TN_COM_PROP.ALVO));
  if (params.tetoDia) {
    props.setProperty(TN_COM_PROP.TETO, String(parseInt(params.tetoDia, 10) || sug.teto));
  } else if (!props.getProperty(TN_COM_PROP.TETO)) {
    props.setProperty(TN_COM_PROP.TETO, String(sug.teto));
  }

  return {
    ok: true, numero: numero, contagem: contagem,
    tetoSugerido: sug,
    mensagem: contagem.acrescentados
      ? contagem.acrescentados + " endereço(s) acrescentado(s) à fila."
      : "A fila já estava completa — nada foi acrescentado nem apagado."
  };
}

/** Quantos em cada status. Uma varredura só. */
function tnCom_contar_() {
  var f = tnCom_linhas_();
  var c = {};
  if (!f.dados.length) return c;
  var iSt = f.hm["STATUS"];
  f.dados.forEach(function (r) {
    var s = String(r[iSt] || "").trim().toUpperCase() || "PENDENTE";
    c[s] = (c[s] || 0) + 1;
  });
  return c;
}

/* ══════════════════════════════════════════════════════════════════════════
   LIBERAR — A ÚNICA TRAVA QUE BARRA

   Nos ofícios, barrar pararia a operação viva da Marcela, e por isso lá o
   remetente errado só vira aviso. Aqui é o contrário: não há nada vivo, e 679
   escolas recebendo documento oficial com remetente errado não tem desfazer.
   Então esta função RECUSA — e diz exatamente o que fazer para destravar.
   ══════════════════════════════════════════════════════════════════════════ */

function tnCom_liberar_() {
  var rem = tnCom_remetente_();
  if (!rem.ok) return { ok: false, remetente: rem, mensagem: rem.mensagem };

  var c = tnCom_contar_();
  if (!(c.PENDENTE > 0)) {
    return { ok: false, mensagem: "Não há endereço pendente. Prepare a fila antes de liberar." };
  }

  var props = tnCom_props_();
  props.setProperty(TN_COM_PROP.LIBERADA, "1");
  props.deleteProperty(TN_COM_PROP.PAUSADA);
  tnCom_agendarProximo_(0);

  return {
    ok: true, remetente: rem, pendentes: c.PENDENTE,
    mensagem: "Campanha liberada. " + c.PENDENTE + " endereço(s) na fila; o primeiro lote sai agora."
  };
}

function tnCom_pausar_() {
  tnCom_props_().setProperty(TN_COM_PROP.PAUSADA, "1");
  tnCom_removerTriggers_();
  return { ok: true, mensagem: "Campanha pausada. Nada mais sai até você liberar de novo." };
}

function tnCom_ajustarTeto_(n) {
  var v = parseInt(n, 10);
  if (isNaN(v) || v <= 0) return { ok: false, mensagem: "Teto inválido: " + n };
  tnCom_props_().setProperty(TN_COM_PROP.TETO, String(v));
  return { ok: true, teto: v, mensagem: "Teto de hoje passou para " + v + " endereço(s)." };
}

function tnCom_removerTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "tnCom_loteAgendado_") ScriptApp.deleteTrigger(t);
  });
}

function tnCom_agendarProximo_(horas) {
  tnCom_removerTriggers_();
  var ms = Math.max(1, (parseFloat(horas) || 1)) * 60 * 60 * 1000;
  ScriptApp.newTrigger("tnCom_loteAgendado_").timeBased().after(ms).create();
}

/* Handler de gatilho. Termina em `_` e isso FUNCIONA no Apps Script — é o
   mesmo padrão de `cob_rotinaDiariaTrigger_` e `rh_rotinaQuinquenioDecenioTrigger_`
   neste projeto. Mantém o teto de exposição intacto. */
function tnCom_loteAgendado_() { tnCom_enviarLote_(); }

/* ══════════════════════════════════════════════════════════════════════════
   O LOTE — QUEM ENVIA EM LAÇO PERGUNTA ANTES

   A diferença central para o `TaxaAssistencial.gs`: lá o teto é `100` escrito
   no código e NENHUMA consulta à cota. Aqui, antes de cada envio, o
   `CotaEmail.gs` diz quantos ainda cabem — considerando a reserva do resto do
   SISGEP e o teto do dia desta campanha. Quando devolve zero, o laço SAI e
   reagenda: é o "se chegar próximo da cota ele trava, joga para o dia
   seguinte" do pedido.

   E a linha é por ENDEREÇO. Não existe metade: cada envio ou concluiu aquela
   linha ou não, e o veredito é sempre escrito.
   ══════════════════════════════════════════════════════════════════════════ */

function tnCom_enviarLote_() {
  var props = tnCom_props_();
  if (props.getProperty(TN_COM_PROP.PAUSADA) === "1") {
    return { ok: true, enviados: 0, motivo: "PAUSADA", mensagem: "Campanha pausada." };
  }
  if (props.getProperty(TN_COM_PROP.LIBERADA) !== "1") {
    return { ok: false, enviados: 0, motivo: "NAO_LIBERADA",
             mensagem: "Campanha ainda não foi liberada." };
  }

  var rem = tnCom_remetente_();
  if (!rem.ok) {
    /* O alias pode cair DEPOIS de liberada. Parar é melhor que mandar 600
       ofícios do remetente errado. */
    tnCom_pausar_();
    tnCom_avisar_({ pausouPorRemetente: true, remetente: rem });
    return { ok: false, enviados: 0, motivo: "REMETENTE", mensagem: rem.mensagem };
  }

  var f = tnCom_linhas_();
  if (!f.dados.length) return { ok: true, enviados: 0, mensagem: "Fila vazia." };

  var iSt = f.hm["STATUS"], iEmail = f.hm["EMAIL"], iEsc = f.hm["ESCOLA"],
      iCnpj = f.hm["CNPJ"], iErro = f.hm["ERRO"], iTent = f.hm["TENTATIVAS"],
      iData = f.hm["DATA_HORA"], iPdf = f.hm["PDF_FILE_ID"];

  var pendentes = [];
  for (var i = 0; i < f.dados.length; i++) {
    var st = String(f.dados[i][iSt] || "").trim().toUpperCase();
    if (st === "PENDENTE" || st === "ERRO") pendentes.push(i);
  }
  if (!pendentes.length) {
    tnCom_removerTriggers_();
    tnCom_avisar_({ finalizada: true, total: f.dados.length });
    return { ok: true, enviados: 0, finalizada: true,
             mensagem: "Todas as escolas já foram comunicadas." };
  }

  var teto = parseInt(props.getProperty(TN_COM_PROP.TETO), 10) || 0;
  var orc  = cotaEmail_quantosCabem_(TN_COM_CAMPANHA, pendentes.length, teto);

  if (orc.cabem <= 0) {
    /* Zero não é erro e não gasta tentativa de ninguém: é ausência de espaço.
       A campanha volta amanhã sozinha — e AVISA, que é o que faltava no
       TaxaAssistencial.gs, onde `enviarAlerteLimiteDiario` nunca existiu. */
    tnCom_agendarProximo_(6);
    tnCom_avisar_({ parou: true, orcamento: orc, restantes: pendentes.length });
    return { ok: true, enviados: 0, motivo: orc.motivo, orcamento: orc,
             mensagem: orc.mensagem };
  }

  var numero = String(props.getProperty(TN_COM_PROP.NUMERO) || "").trim();
  var codigo = String(props.getProperty(TN_COM_PROP.CODIGO) || "").trim();
  var quem   = rem.real;

  var blobCct = null;
  var cctId = String(props.getProperty(TN_COM_PROP.CCT_ID) || "").trim();
  if (cctId) {
    try {
      blobCct = DriveApp.getFileById(cctId).getBlob()
                  .setName(String(props.getProperty(TN_COM_PROP.CCT_NOME) || "CCT.pdf"));
    } catch (eB) { Logger.log("⚠ CCT indisponível: " + (eB.message || eB)); }
  }

  var enviados = 0, erros = 0, detalhes = [];
  var pdfPorEscola = {};

  for (var k = 0; k < pendentes.length && enviados < orc.cabem; k++) {
    var li = pendentes[k];
    var linhaReal = li + 2;
    var escola = String(f.dados[li][iEsc] || "").trim();
    var cnpj   = String(f.dados[li][iCnpj] || "").trim();
    var email  = String(f.dados[li][iEmail] || "").trim();
    if (!email) continue;

    try {
      /* O PDF é por ESCOLA, não por endereço: três contatos da mesma escola
         recebem o mesmo documento nominal. Gerar três vezes seria desperdiçar
         cópia de Docs e arquivo no Drive. */
      var chave = escola.toLowerCase() + "|" + cnpj;
      var pdf = pdfPorEscola[chave];
      if (!pdf) {
        pdf = tnCom_gerarPdf_(numero, codigo, escola, cnpj);
        pdfPorEscola[chave] = pdf;
      }

      var anexos = [pdf.blob];
      if (blobCct) anexos.push(blobCct);

      tnCom_enviar_(quem, email, escola, numero, anexos);

      /* Contar DEPOIS do envio dar certo — contar antes faz o orçamento
         encolher por tentativa que falhou. */
      cotaEmail_registrarEnvio_(TN_COM_CAMPANHA, 1);
      enviados++;

      f.sh.getRange(linhaReal, iSt + 1).setValue("ENVIADO");
      f.sh.getRange(linhaReal, iErro + 1).setValue("");
      f.sh.getRange(linhaReal, iData + 1).setValue(new Date());
      if (iPdf !== undefined) f.sh.getRange(linhaReal, iPdf + 1).setValue(pdf.fileId);

      registrarLogSistema_({
        usuario: quem, numero: numero, tipo: "Comunicação Taxa Negocial",
        escola: escola, cnpj: cnpj, email: email, codigo: codigo
      });
      Utilities.sleep(300);

    } catch (eEnv) {
      /* COTA NÃO É VEREDITO SOBRE A LINHA — mesma regra do FilaOficios.gs.
         Recusa do Gmail por limite é ausência de notícia sobre o envio, não
         defeito dele: a linha fica intacta e a rodada para. */
      if (typeof oficio_ehLimiteDoGmail_ === "function" && oficio_ehLimiteDoGmail_(eEnv)) {
        tnCom_agendarProximo_(6);
        tnCom_avisar_({ parou: true, limiteDoGmail: true, restantes: pendentes.length - k });
        return { ok: true, enviados: enviados, motivo: "COTA",
                 mensagem: "O Google recusou por limite. A campanha continua amanhã, sozinha." };
      }
      erros++;
      var tent = (parseInt(f.dados[li][iTent], 10) || 0) + 1;
      f.sh.getRange(linhaReal, iTent + 1).setValue(tent);
      f.sh.getRange(linhaReal, iErro + 1).setValue(String(eEnv.message || eEnv).slice(0, 250));
      f.sh.getRange(linhaReal, iData + 1).setValue(new Date());
      f.sh.getRange(linhaReal, iSt + 1)
          .setValue(tent >= TN_COM_MAX_TENTATIVAS ? "ERRO_PERMANENTE" : "ERRO");
      detalhes.push(escola + " / " + email + ": " + String(eEnv.message || eEnv));
    }
  }

  var restam = tnCom_contar_();
  var aindaFalta = (restam.PENDENTE || 0) + (restam.ERRO || 0);

  if (aindaFalta > 0) {
    tnCom_agendarProximo_(1);
  } else {
    tnCom_removerTriggers_();
    tnCom_avisar_({ finalizada: true, total: f.dados.length });
  }

  return {
    ok: true, enviados: enviados, erros: erros, restam: aindaFalta,
    orcamento: orc, detalhes: detalhes,
    mensagem: enviados + " envio(s) neste lote. Restam " + aindaFalta + " endereço(s)."
  };
}

/* ── O documento e o envio ─────────────────────────────────────────────── */

function tnCom_gerarPdf_(numero, codigo, escola, cnpj) {
  var pasta = obterPastaPorTipo_("TAXA_NEGOCIAL");
  var base = "";
  try { base = ScriptApp.getService().getUrl(); } catch (e) {}

  var retorno = gerarPDFUniversal_({
    templateId: (typeof TEMPLATE_TAXA_ID !== "undefined" && TEMPLATE_TAXA_ID)
                  ? TEMPLATE_TAXA_ID : "",
    pastaDestinoId: pasta.getId(),
    nomeArquivo: "Ofício " + numero + " - " + escola + " - Taxa Negocial",
    substituicoes: {
      "{{NUMERO}}":    numero,
      "{{DATA}}":      (typeof dataPorExtenso === "function") ? dataPorExtenso() : "",
      "{{CIDADE_UF}}": (typeof CIDADE_UF !== "undefined" && CIDADE_UF) ? CIDADE_UF : "Vitória/ES",
      "{{ESCOLA}}":    escola,
      "{{CNPJ}}":      cnpj,
      "{{CORPO}}":     tnCom_corpo_(),
      "{{CODIGO}}":    codigo,
      "{{LINK_VALIDACAO}}": base ? (base + "?codigo=" + codigo) : ""
    }
  });
  return { blob: retorno.pdf.getBlob(), fileId: retorno.pdf.getId() };
}

/* O TEXTO, COMO O USUÁRIO O DEIXOU — 11/09/2026.

   A versão que eu propus tinha "solicitamos o encaminhamento até 30/09/2026".
   Ele reprovou, e a razão é operacional: *"se colocar data fica difícil por nem
   todas entregam no prazo"*. Prometer um prazo que o sindicato não cobra
   desgasta o próprio ofício.
   
   A data não sumiu — MUDOU DE LUGAR. Ela virou parâmetro interno da campanha
   (TN_COM_PROP.ALVO), que calcula o teto do dia e responde "no ritmo de hoje, a
   última escola recebe em DD/MM". A escola não lê prazo nenhum; o sindicato
   continua tendo um alvo. */
function tnCom_corpo_() {
  var comp = String(tnCom_props_().getProperty(TN_COM_PROP.COMPETENCIA) || "setembro/2026");
  return [
    "O SindEducação-ES, no uso de suas atribuições de representação sindical, vem, por meio deste, ",
    "informar acerca do recolhimento da Taxa Negocial 2026, aplicável aos empregados não associados ",
    "ao Sindicato, nos termos da Convenção Coletiva de Trabalho vigente, cuja cópia segue anexa.\n\n",
    "A contribuição corresponde ao percentual total de 6%, calculado sobre a folha de pagamento da ",
    "competência " + comp + ", com recolhimento em três parcelas de 2%, conforme cronograma abaixo:\n\n",
    "    1ª parcela – 2%: vencimento em 10/10/2026;\n",
    "    2ª parcela – 2%: vencimento em 10/11/2026;\n",
    "    3ª parcela – 2%: vencimento em 10/12/2026.\n\n",
    "Para fins de apuração dos valores e emissão das respectivas cobranças, solicitamos o ",
    "encaminhamento ao SindEducação-ES de relatório contendo a relação dos empregados não ",
    "associados, os dados da instituição de ensino e o valor descontado de cada empregado.\n\n",
    "O envio dessas informações em tempo hábil permite que a cobrança da primeira parcela seja ",
    "emitida corretamente, evitando retificações posteriores.\n\n",
    "Caso as informações já tenham sido encaminhadas, solicitamos a gentileza de desconsiderar ",
    "esta comunicação."
  ].join("");
}

function tnCom_enviar_(remetente, destino, escola, numero, anexos) {
  var assunto = "Ofício " + numero + " — Taxa Negocial 2026 — " + escola;
  var html = (typeof montarEmailHTML_ === "function")
    ? montarEmailHTML_("Ofício de Taxa Negocial", numero, "Taxa Negocial", 0,
        "Encaminhamos, em anexo, o ofício referente à Taxa Negocial 2026 e a cópia da CCT vigente.")
    : "";

  var opcoes = {
    htmlBody: html,
    attachments: anexos || [],
    name: "SindEducação-ES",
    replyTo: remetente
  };
  /* O `from` só é aplicado quando de fato é alias — quem decidiu isso foi o
     tnCom_remetente_, e o laço já se recusou a rodar sem ele. */
  opcoes.from = remetente;

  var rascunho = GmailApp.createDraft(destino, assunto,
    "Segue o ofício da Taxa Negocial 2026 em anexo.", opcoes);
  try {
    return rascunho.send();
  } catch (e) {
    /* Rascunho parado na caixa parece ofício pendente de mandar. */
    try { rascunho.deleteDraft(); } catch (e2) {}
    throw e;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   O AVISO QUE FALTAVA

   O `TaxaAssistencial.gs` chama `enviarAlerteLimiteDiario` em dois pontos e
   essa função NÃO EXISTE em lugar nenhum do projeto — `typeof` devolve
   undefined, e as duas chamadas estão dentro de `try/catch` que engole. O
   aviso de "a campanha pausou" nunca disparou, desde sempre.

   O usuário pediu explicitamente que a campanha "trave e jogue para o dia
   seguinte". Travar sem avisar deixaria ele sem saber se a campanha parou
   ontem ou se está andando — que é exatamente o que não pode acontecer numa
   coisa que leva vinte dias.
   ══════════════════════════════════════════════════════════════════════════ */

function tnCom_avisar_(o) {
  o = o || {};
  var para = TN_COM_REMETENTE_PRETENDIDO;
  var assunto = "", corpo = "";

  if (o.pausouPorRemetente) {
    assunto = "⚠ SISGEP — campanha da Taxa Negocial PAUSADA (remetente)";
    corpo = "A campanha parou sozinha porque o remetente deixou de ser o esperado.\n\n" +
            o.remetente.mensagem + "\n\nNada foi enviado com o remetente errado.";
  } else if (o.parou) {
    assunto = "SISGEP — a comunicação da Taxa Negocial pausou por hoje";
    corpo = (o.limiteDoGmail
      ? "O Google recusou novos envios por limite de uso."
      : (o.orcamento && o.orcamento.mensagem) || "O limite do dia foi alcançado.") +
      "\n\nFaltam " + (o.restantes || 0) + " endereço(s). " +
      "A campanha continua amanhã, sozinha. Não é preciso refazer nada.";
  } else if (o.finalizada) {
    assunto = "✅ SISGEP — Taxa Negocial: todas as escolas foram comunicadas";
    corpo = "A comunicação terminou. " + (o.total || 0) + " endereço(s) na fila.\n\n" +
            "As escolas sem e-mail no cadastro continuam pendentes de correção — " +
            "elas aparecem na tela de acompanhamento.";
  } else {
    return;
  }

  try {
    GmailApp.sendEmail(para, assunto, corpo, { name: "SindEducação-ES | SISGEP" });
  } catch (e) {
    /* Aviso que falha não pode derrubar a campanha — a operação vem antes do
       alerta sobre ela. Mesma regra do OFICIOS_REMETENTE_SEM_ALIAS. */
    Logger.log("⚠ Aviso da campanha não saiu: " + (e.message || e));
  }
}

/* ── O painel ──────────────────────────────────────────────────────────── */

function tnCom_status_() {
  var props = tnCom_props_();
  var c = tnCom_contar_();
  var total = 0;
  Object.keys(c).forEach(function (k) { total += c[k]; });

  var comunicadas = c.ENVIADO || 0;
  var naFila      = (c.PENDENTE || 0) + (c.ERRO || 0);
  var aCorrigir   = (c.SEM_EMAIL || 0) + (c.EMAIL_INVALIDO || 0) + (c.ERRO_PERMANENTE || 0);
  var teto        = parseInt(props.getProperty(TN_COM_PROP.TETO), 10) || 0;
  var orc         = cotaEmail_orcamentoDoDia_(TN_COM_CAMPANHA, teto);

  /* "No ritmo de hoje, a última escola recebe em DD/MM" — a previsão usa o
     teto, não a média histórica: é o que a campanha VAI fazer, não o que fez. */
  var previsao = "";
  if (naFila > 0 && teto > 0) {
    var diasFalta = Math.ceil(naFila / teto);
    var d = new Date(); var somados = 0;
    while (somados < diasFalta) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) somados++;
    }
    previsao = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM");
  }

  return {
    ok: true,
    numero: String(props.getProperty(TN_COM_PROP.NUMERO) || ""),
    liberada: props.getProperty(TN_COM_PROP.LIBERADA) === "1",
    pausada: props.getProperty(TN_COM_PROP.PAUSADA) === "1",
    remetente: tnCom_remetente_(),
    total: total, comunicadas: comunicadas, naFila: naFila, aCorrigir: aCorrigir,
    percentual: total ? Math.round((comunicadas / total) * 100) : 0,
    tetoDia: teto, enviadoHoje: orc.jaEnviadoHoje, orcamento: orc,
    previsaoUltima: previsao,
    porStatus: c
  };
}
