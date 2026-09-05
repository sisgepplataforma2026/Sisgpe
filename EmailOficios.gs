// ============================================================================
// ARQUIVO: EmailOficios.gs
// Montagem e envio de e-mails de ofícios
// ============================================================================

var OFICIOS_EMAIL_INSTITUCIONAL = "secretaria@sindeducacao.com";
var OFICIOS_HML_EMAIL_PADRAO_TESTE = "secretaria@sindeducacao.com";

/**
 * Allowlist de destinatários reais autorizados em HOMOLOGAÇÃO.
 *
 * Por decisão operacional, HML envia exclusivamente para a Secretaria. A
 * lista é fixa para impedir que uma propriedade antiga reautorize, sem revisão,
 * destinatários reais ou o endereço do Financeiro.
 */
function obterAllowlistOficiosHml_() {
  return [OFICIOS_EMAIL_INSTITUCIONAL];
}

function validarDestinoOficioPorAmbiente_(destino) {
  var validacao = validarListaEmails_(destino);
  if (!validacao.ok || !validacao.emails || !validacao.emails.length) {
    throw new Error("E-mail de destino inválido ou não informado: " + (validacao.invalido || ""));
  }

  var ambiente = (typeof getAmbienteAtual === "function")
    ? String(getAmbienteAtual() || "").toLowerCase()
    : "producao";

  if (ambiente === "homologacao") {
    var permitidos = obterAllowlistOficiosHml_();
    var bloqueados = validacao.emails.filter(function(email) {
      return permitidos.indexOf(String(email || "").trim().toLowerCase()) === -1;
    });
    if (bloqueados.length) {
      throw new Error(
        "[HML] Envio bloqueado. Destinatário não autorizado para homologação: " +
        bloqueados.join(", ") + ". Em homologação, use somente " +
        OFICIOS_EMAIL_INSTITUCIONAL + "."
      );
    }
  }

  return {
    ambiente: ambiente,
    destino: validacao.todos,
    emails: validacao.emails
  };
}

function validarRemetenteInstitucionalOficios_() {
  var remetente = OFICIOS_EMAIL_INSTITUCIONAL;
  var efetivo = "";
  var aliases = [];

  try { efetivo = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  try { aliases = GmailApp.getAliases().map(function(x) { return String(x || "").trim().toLowerCase(); }); } catch (e2) {}

  if (efetivo === remetente || aliases.indexOf(remetente) !== -1) return remetente;

  /* O projeto de homologação é executado pela conta proprietária do Apps
     Script, que não possui a Secretaria como alias Gmail. Forçar `from`
     nesse cenário faz o Gmail recusar TODOS os ofícios. Sem alias, omitimos
     apenas o `from`: o Gmail usa a conta executora como remetente técnico,
     enquanto o destinatário e o reply-to continuam sendo exclusivamente a
     Secretaria. Isso não cria BCC nem cópia para o Financeiro. */
  Logger.log(
    "Aviso: " + remetente + " não é alias da conta executora; " +
    "envio seguirá pela conta executora com replyTo da Secretaria."
  );

  /* A FALTA DO ALIAS PRECISA APARECER — 02/09/2026.

     Antes isto era so um Logger.log, e ninguem le Logger.log. O resultado:
     durante meses os oficios sairam de `financeirosindecucacao@gmail.com`
     com replyTo da Secretaria, e ninguem soube. Foi preciso abrir um oficio
     enviado e olhar o cabecalho para descobrir.

     Agora vai para o log de sistema, com nome proprio, para aparecer na
     auditoria. Com trava de 6 horas: a fila roda de 5 em 5 minutos e sem
     isso a aba de log viraria uma linha por oficio enviado.

     DENTRO DE try/catch, SEM EXCECAO. Este aviso nao pode, em hipotese
     nenhuma, impedir um oficio de sair — a operacao viva vem antes do
     alerta sobre ela. */
  try {
    var chaveAviso = "OFICIOS_ALIAS_AUSENTE";
    if (!CacheService.getScriptCache().get(chaveAviso)) {
      CacheService.getScriptCache().put(chaveAviso, "1", 6 * 60 * 60);
      registrarLogSistema_({
        usuario: efetivo || "(conta executora desconhecida)",
        numero:  "-",
        tipo:    "OFICIOS_REMETENTE_SEM_ALIAS",
        escola:  "",
        cnpj:    "",
        email:   remetente,
        codigo:  ""
      });
    }
  } catch (eLog) {}

  return "";
}

function montarOpcoesEmailSISGEP_(emailUsuario, htmlBody, anexos, assunto, destino) {
  var politica = validarDestinoOficioPorAmbiente_(destino);
  var remetente = validarRemetenteInstitucionalOficios_();
  var assuntoFinal = String(assunto || "").trim();
  var htmlFinal = String(htmlBody || "");

  if (politica.ambiente === "homologacao") {
    if (assuntoFinal.indexOf("[HML]") !== 0) assuntoFinal = "[HML] " + assuntoFinal;
    htmlFinal =
      "<div style='font-family:Arial,sans-serif;background:#fff7ed;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#92400e;'>" +
      "<strong>HOMOLOGAÇÃO SISGEP</strong><br>Mensagem de teste autorizada. Destinatário: " +
      politica.destino.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      "</div>" + htmlFinal;
  }

  var opcoes = {
    to:          politica.destino,
    subject:     assuntoFinal,
    htmlBody:    htmlFinal,
    attachments: anexos || [],
    name:        "SindEducação-ES",
    replyTo:     OFICIOS_EMAIL_INSTITUCIONAL
    // Sem BCC: o financeiro não recebe cópia automática dos ofícios.
  };
  if (remetente) opcoes.from = remetente;
  return opcoes;
}

/* ══════════════════════════════════════════════════════════════════════════
   POR QUE RASCUNHO-E-ENVIA, E NAO sendEmail — 02/09/2026

   ATENCAO A QUEM LER DEPOIS: a primeira versao desta nota dizia que a troca
   servia para o oficio aparecer na caixa de Enviados. ERA FALSO, e fica
   registrado porque o engano custou uma mudanca no caminho de envio.

   O QUE ACONTECEU. O usuario relatou que os oficios enviados nao apareciam em
   Enviados. Eu troquei o `sendEmail` por rascunho-e-envia para resolver isso.
   Depois ele mostrou a caixa: os oficios ESTAVAM la — inclusive os de 01/09 e
   os de 02/09 pela manha, todos mandados pelo `sendEmail` antigo. Ele estava
   olhando a caixa da SECRETARIA; a copia fica na caixa da conta que EXECUTA o
   script, que e a do financeiro. A secretaria so recebe resposta, porque e
   para ela que aponta o replyTo.

   Ou seja: `GmailApp.sendEmail` sempre gravou em Enviados. Nao havia defeito.

   POR QUE A TROCA FICOU MESMO ASSIM — decisao do usuario em 02/09, com a
   justificativa original ja desfeita:

   `sendEmail` nao devolve NADA. Sem retorno nao ha ID de mensagem, e por isso
   o registro gravava o texto fixo "GMAILAPP_SEM_ID". Sem ID nao existe a
   thread do oficio para o verificador de confirmacao olhar; sobrou procurar
   pelo NUMERO e pelo NOME DA ESCOLA em toda a caixa. Foi essa busca larga que
   fez a assinatura "Outlook" confirmar oficio que na verdade quicou — o item
   49. Guardar o ID e o que destrava consertar aquilo direito.

   `createDraft(...).send()` devolve o GmailMessage, e dai sai o ID.

   O CUSTO, que nao existia antes: o rascunho e criado ANTES do envio. Se o
   `send()` falhar, ele ficaria na caixa parecendo oficio pendente de mandar.
   Por isso e apagado antes de a excecao subir, e o apagamento vai em try
   proprio — falhar ao limpar nao pode mascarar o erro real do envio.
   ══════════════════════════════════════════════════════════════════════════ */
function enviarEmailOficio_(emailUsuario, htmlBody, anexos, assunto, destino, corpoTexto) {
  var opcoes = montarOpcoesEmailSISGEP_(emailUsuario, htmlBody, anexos, assunto, destino);
  var opcoesGmail = {
    htmlBody:    opcoes.htmlBody,
    attachments: opcoes.attachments || [],
    name:        opcoes.name,
    replyTo:     opcoes.replyTo
  };
  if (opcoes.from) opcoesGmail.from = opcoes.from;

  var rascunho = GmailApp.createDraft(
    opcoes.to, opcoes.subject, corpoTexto || "Segue ofício em anexo.", opcoesGmail);

  var msg;
  try {
    msg = rascunho.send();
  } catch (eEnvio) {
    /* Sem isto, cada falha de envio deixaria um rascunho na caixa — que para
       quem olha parece ofício pendente de mandar. */
    try { rascunho.deleteDraft(); } catch (eLimpeza) {}
    throw eEnvio;
  }

  opcoes.mensagemId = "";
  try { opcoes.mensagemId = String(msg.getId() || ""); } catch (eId) {}

  return opcoes;
}

function montarEmailHTML_(tipo, numero, assuntoTipo, quantidade, textoPrincipalCustom) {
  var textoPrincipal = textoPrincipalCustom || "";

  if (!textoPrincipal) {
    if (assuntoTipo === "Filiação") {
      textoPrincipal = quantidade === 1
        ? "Encaminhamos, em anexo, o <strong>Ofício de Filiação nº " + numero + "</strong> acompanhado da ficha de filiação do(a) colaborador(a).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos a realização do desconto mensal de <strong>2% (dois por cento)</strong> sobre o salário-base do(a) trabalhador(a), a título de Mensalidade Sindical.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail."
        : "Encaminhamos, em anexo, o <strong>Ofício de Filiação nº " + numero + "</strong> acompanhado das fichas de filiação dos(as) colaboradores(as) relacionados(as).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos a realização dos descontos mensais de <strong>2% (dois por cento)</strong> sobre o salário-base de cada trabalhador(a), a título de Mensalidade Sindical.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Desfiliação") {
      textoPrincipal = quantidade === 1
        ? "Encaminhamos, em anexo, o <strong>Ofício de Desfiliação nº " + numero + "</strong> acompanhado da carta de desfiliação do(a) colaborador(a).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos que seja <strong>cessado imediatamente o desconto de 2% (dois por cento)</strong> sobre o salário-base.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail."
        : "Encaminhamos, em anexo, o <strong>Ofício de Desfiliação nº " + numero + "</strong> acompanhado das cartas de desfiliação dos(as) colaboradores(as) relacionados(as).\n\n" +
          "Nos termos da <strong>Cláusula 56ª da CCT 2026/2027</strong>, solicitamos que sejam <strong>cessados imediatamente os descontos de 2% (dois por cento)</strong> sobre os salários-base.\n\n" +
          "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Taxa Assistencial") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> referente à <strong>Taxa Assistencial – Assistência Médica</strong>, conforme a <strong>Cláusula 58ª da CCT 2026/2027</strong>.\n\n" +
        "O valor corresponde a <strong>4% (quatro por cento)</strong> da folha de pagamento bruta da <strong>competência março/2027</strong> dos colaboradores técnico-administrativos, recolhido em <strong>duas parcelas de 2% (dois por cento)</strong>, com vencimentos em <strong>15/04/2027</strong> e <strong>15/05/2027</strong>.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Taxa Negocial") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> referente à <strong>Taxa Negocial</strong>, em conformidade com a <strong>Cláusula 57ª da CCT 2026/2027</strong>.\n\n" +
        "A contribuição corresponde a <strong>6% (seis por cento)</strong> do salário-base, descontada em <strong>três parcelas mensais e sucessivas de 2% (dois por cento)</strong>, <strong>iniciando-se na competência de setembro de 2026</strong>. <strong>Os trabalhadores filiados ao sindicato estão isentos</strong>, por já recolherem a mensalidade sindical.\n\n" +
        "Solicitamos que os descontos sejam realizados e o repasse efetuado até o <strong>10º dia útil do mês subsequente</strong>, acompanhado da <strong>relação nominal</strong> dos trabalhadores e dos respectivos valores.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Oposição à Taxa Negocial") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> referente à <strong>oposição à Taxa Negocial</strong> prevista na <strong>Cláusula 57ª da CCT 2026/2027</strong>, acompanhado da carta de oposição.\n\n" +
        (quantidade === 1
          ? "O(a) trabalhador(a) relacionado(a) manifestou formalmente oposição ao desconto, no período de <strong>17 a 26 de agosto de 2026</strong>, em dia útil, conforme prazo publicado pelo Sindicato. Solicitamos, portanto, que <strong>o desconto da Taxa Negocial não seja realizado</strong>.\n\n"
          : "Os(as) trabalhadores(as) relacionados(as) manifestaram formalmente oposição ao desconto, no período de <strong>17 a 26 de agosto de 2026</strong>, em dia útil, conforme prazo publicado pelo Sindicato. Solicitamos, portanto, que <strong>o desconto da Taxa Negocial não seja realizado</strong> para essas pessoas.\n\n") +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    } else if (assuntoTipo === "Ofício Livre") {
      textoPrincipal =
        "Encaminhamos, em anexo, o <strong>Ofício nº " + numero + "</strong> conforme descrito no documento.\n\n" +
        "Solicitamos, por gentileza, a <strong>confirmação do recebimento</strong> respondendo a este e-mail.";
    }
  }

  var textoPrincipalHtml = formatarCorpoEmailHTML_(textoPrincipal);
  var saudacao = saudacaoHoraBR_();
  var badgeCor = "rgba(201,168,76,.15)", badgeBorda = "rgba(201,168,76,.35)", badgeTexto = "#C9A84C";
  if (assuntoTipo === "Filiação")          { badgeCor="rgba(217,119,6,.15)";  badgeBorda="rgba(217,119,6,.4)";   badgeTexto="#fbbf24"; }
  if (assuntoTipo === "Desfiliação")       { badgeCor="rgba(185,28,28,.2)";   badgeBorda="rgba(220,38,38,.4)";   badgeTexto="#fca5a5"; }
  if (assuntoTipo === "Taxa Assistencial") { badgeCor="rgba(22,101,52,.2)";   badgeBorda="rgba(34,197,94,.35)";  badgeTexto="#86efac"; }
  if (assuntoTipo === "Taxa Negocial")     { badgeCor="rgba(3,105,161,.2)";   badgeBorda="rgba(14,165,233,.35)"; badgeTexto="#7dd3fc"; }
  if (assuntoTipo === "Oposição à Taxa Negocial") { badgeCor="rgba(126,34,206,.2)"; badgeBorda="rgba(168,85,247,.4)"; badgeTexto="#d8b4fe"; }

  return (
    "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:680px;color:#0f172a;'>" +
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 55%,#003b82 100%);padding:22px 28px 20px;border-radius:8px 8px 0 0;'>" +
    "<div style='display:flex;align-items:flex-start;justify-content:space-between;gap:20px;'>" +
    "<div style='border-left:4px solid #C9A84C;padding-left:16px;'>" +
    "<div style='font-size:21px;font-weight:900;color:#fff;'>SINDEDUCAÇÃO-ES</div>" +
    "<div style='font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;'>Sindicato dos Educadores Técnico-Administrativos<br>em Estabelecimentos de Ensino Particular no Estado do Espírito Santo</div>" +
    "<div style='font-size:10.5px;font-weight:800;color:#C9A84C;margin-top:6px;'>CNPJ: 31.815.780/0001-51</div></div>" +
    "<div style='text-align:right;'><div style='font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;'>Ofício Nº</div>" +
    "<div style='font-size:26px;font-weight:900;color:#C9A84C;'>" + numero + "</div></div></div>" +
    "<div style='height:1px;background:rgba(201,168,76,.25);margin:16px 0 14px;'></div>" +
    "<div style='display:inline-flex;align-items:center;background:" + badgeCor + ";border:1px solid " + badgeBorda + ";color:" + badgeTexto + ";font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;text-transform:uppercase;'>" + assuntoTipo + "</div>" +
    "</div>" +
    "<div style='background:#fff;padding:28px 28px 24px;border:1px solid #e2e8f0;border-top:none;'>" +
    "<p style='margin:0 0 18px 0;font-size:14px;color:#334155;'>" + saudacao + "! Tudo bem?</p>" +
    "<div style='text-align:justify;line-height:1.7;font-size:13.5px;color:#1a2233;'>" + textoPrincipalHtml + "</div>" +
    "<div style='margin:20px 0 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;font-size:13px;font-weight:700;color:#1e3a8a;'>" +
    "⚠️ Solicitamos, por gentileza, a confirmação do recebimento respondendo a este e-mail.</div></div>" +
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 60%,#002f6c 100%);border-radius:0 0 8px 8px;padding:22px 28px;text-align:center;'>" +
    "<div style='height:3px;background:linear-gradient(90deg,#C9A84C,#f0c843,#C9A84C);margin-bottom:18px;'></div>" +
    "<div style='font-size:16px;font-weight:900;color:#fff;'>MARCELHA ALINE PINTO GOMES</div>" +
    "<div style='font-size:12px;color:#C9A84C;font-weight:700;margin-top:3px;'>Administrativo & Secretaria — SindEducação-ES</div>" +
    "<div style='margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.10);font-size:11px;color:rgba(255,255,255,.75);line-height:1.7;'>" +
    "Av. Nossa Senhora dos Navegantes, 755 - Salas 707/708<br>" +
    "Enseada do Suá - Vitória/ES - CEP 29.050-355<br>" +
    "(27) 99735-8900 • secretaria@sindeducacao.com • www.sindeducacao.com.br" +
    "</div>" +
    "<div style='margin-top:12px;font-size:10px;color:rgba(255,255,255,.25);'>Documento gerado pelo SISGEP · SindEducação-ES</div>" +
    "</div></div>"
  );
}

function extrairIdDriveOficio_(link) {
  link = String(link || "").trim();
  if (!link) return "";
  var m = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  m = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(link)) return link;
  return "";
}


/** Normaliza o nome da escola do MESMO jeito que a emissao batiza o arquivo. */
function tokenEscolaArquivo_(escola) {
  return String(escola || "ESCOLA")
    .toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").slice(0, 45) || "ESCOLA";
}

/**
 * Procura no Drive as fichas/cartas daquele oficio, para o reenvio de
 * registros que nao tem mais ANEXOS_JSON na fila.
 *
 * Procura em TODAS as subpastas de ano da pasta do tipo, e nao so na do ano
 * corrente: oficio de 2025 reenviado em 2026 tem o arquivo na pasta de 2025.
 *
 * PRECISAO: casa pelo token da escola. Quando a data do envio e conhecida,
 * exige tambem a data no nome — e assim pega exatamente o lote daquele dia.
 * Sem data, aceita o casamento por escola e devolve o que achar; o chamador
 * registra quantos vieram.
 */
function recuperarAnexosDaPastaDrive_(tipo, escola, dataEnvio, jaAnexados, idOficio) {
  var achados = [];
  var token = tokenEscolaArquivo_(escola);
  if (!token || token === "ESCOLA") return achados;

  var nomesJa = (jaAnexados || []).map(function (b) { return String(b.getName() || ""); });

  var dataToken = "";
  if (dataEnvio instanceof Date && !isNaN(dataEnvio.getTime())) {
    dataToken = Utilities.formatDate(dataEnvio, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }

  var pastas = [];
  var vistasPasta = {};
  function juntarPasta(pasta) {
    try {
      var id = String(pasta.getId ? pasta.getId() : "");
      if (id && vistasPasta[id]) return;
      if (id) vistasPasta[id] = true;
      pastas.push(pasta);
    } catch (e) { pastas.push(pasta); }
  }

  /* A PASTA DO PRÓPRIO OFÍCIO VEM PRIMEIRO — 03/09/2026.

     A emissão grava o PDF do ofício e as fichas na MESMA pasta do ano
     (`pastaAno`, em Oficios.gs). Então o lugar mais certo para achar a ficha
     é a pasta onde o ofício está — e ela se descobre pelo próprio arquivo,
     sem depender de configuração.

     Antes a busca começava por `getPastaOficiosDestinoId_(tipo)`. Isso
     funciona enquanto a configuração apontar para a mesma árvore; se
     apontar para outro lugar — ou se o ofício foi movido — a busca varre a
     pasta errada e volta vazia em silêncio, que é o pior resultado
     possível: o ofício sai afirmando uma ficha que não foi. */
  if (idOficio) {
    try {
      var pais = DriveApp.getFileById(idOficio).getParents();
      while (pais.hasNext()) juntarPasta(pais.next());
    } catch (ePai) {
      Logger.log("recuperarAnexosDaPastaDrive_: pasta do ofício inacessível — " + ePai.message);
    }
  }

  var raizId = getPastaOficiosDestinoId_(String(tipo || "").toUpperCase());
  if (raizId) {
    try {
      var raiz = DriveApp.getFolderById(raizId);
      juntarPasta(raiz);
      var subs = raiz.getFolders();
      while (subs.hasNext()) juntarPasta(subs.next());
    } catch (ePasta) {
      Logger.log("recuperarAnexosDaPastaDrive_: pasta inacessivel — " + ePasta.message);
    }
  }

  if (!pastas.length) return achados;

  var comData = [], semData = [];
  pastas.forEach(function (pasta) {
    var arquivos = pasta.getFiles();
    while (arquivos.hasNext()) {
      var arq = arquivos.next();
      var nome = String(arq.getName() || "");
      if (!/^Fichas?_/i.test(nome)) continue;          /* so ficha/carta */
      if (nome.indexOf(token) === -1) continue;         /* a trava da escola */
      if (nomesJa.indexOf(nome) > -1) continue;         /* ja vai no pacote */
      (dataToken && nome.indexOf(dataToken) > -1 ? comData : semData).push(arq);
    }
  });

  /* Do lote do dia, quando se sabe o dia. Senao, o que houver da escola. */
  var escolhidos = comData.length ? comData : semData;
  escolhidos.forEach(function (arq) {
    achados.push(arq.getBlob().setName(arq.getName()));
  });
  return achados;
}


/**
 * Reconstroi o pacote de anexos ORIGINAL do oficio, a partir do ANEXOS_JSON
 * da fila de envio.
 *
 * PASSOU A DIZER SE CONSEGUIU — 01/09/2026.
 *
 * Antes devolvia so a lista, e quem chamava nao tinha como saber a diferenca
 * entre "reconstrui o pacote inteiro" e "so achei o PDF do oficio". A lista
 * nunca vinha vazia, porque o PDF e acrescentado antes da busca — o que
 * tornava morto o `if (!anexos.length)` do reenvio e escondia o caso ruim.
 *
 * A diferenca importa porque o corpo do e-mail de alguns tipos AFIRMA um
 * anexo: "acompanhado da carta de oposicao", "acompanhado da carta de
 * desfiliacao". Reenviar sem a carta manda um documento que promete um papel
 * que nao vai junto — e num questionamento e o sindicato que fica sem a prova.
 * E o mesmo defeito que o t55 fechou na emissao, reaparecendo no reenvio.
 *
 * @returns {{blobs: Array, reconstruido: boolean, achadosNaFila: number}}
 */
function obterAnexosOriginaisFilaOficio_(numero, idOficio) {
  var itens = [];
  var ids = {};
  var achadosNaFila = 0;
  var reconstruido = false;

  function adicionarArquivo_(fileId, nome) {
    fileId = String(fileId || "").trim();
    if (!fileId || ids[fileId]) return;
    var arquivo = DriveApp.getFileById(fileId);
    var blob = arquivo.getBlob().setName(String(nome || arquivo.getName()).trim());
    itens.push(blob);
    ids[fileId] = true;
  }

  if (idOficio) adicionarArquivo_(idOficio, "");

  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
    if (!fila || fila.getLastRow() < 2) return itens;
    var hm = getHeaderMap_(fila);
    var colNumero = hm["NUMERO_OFICIO"];
    var colAnexos = hm["ANEXOS_JSON"];
    if (!colNumero || !colAnexos) return itens;

    var dados = fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).getValues();
    for (var i = dados.length - 1; i >= 0; i--) {
      if (String(dados[i][colNumero - 1] || "").trim() !== String(numero || "").trim()) continue;
      var json = String(dados[i][colAnexos - 1] || "").trim();
      if (!json) break;
      var anexos = JSON.parse(json);
      if (Array.isArray(anexos)) {
        reconstruido = true;
        anexos.forEach(function(anexo) {
          if (anexo && anexo.fileId) { adicionarArquivo_(anexo.fileId, anexo.nome || ""); achadosNaFila++; }
        });
      }
      break;
    }
  } catch (e) {
    Logger.log("⚠ Reenvio: falha ao reconstruir ANEXOS_JSON: " + e.message);
  }

  return { blobs: itens, reconstruido: reconstruido, achadosNaFila: achadosNaFila };
}

/**
 * Para onde o reenvio VAI, segundo o cadastro. So leitura.
 *
 * Existe para a tela poder MOSTRAR o destino antes de enviar. Ate 01/09/2026
 * o reenvio era um confirm cego — a pessoa mandava sem ver para onde ia, e o
 * caso da FAESA mostrou o custo: tres oficios reenviados para um endereco que
 * nao recebia mais.
 *
 * Tem porta porque devolve e-mail de escola, que e dado de terceiro. E exige
 * o modulo, nao admin: quem reenvia oficio ja precisa disso.
 */
/* LEGADO desde 03/09/2026 — substituída por `preverReenvioOficio`.

   Esta função devolvia o e-mail gravado na linha do PRÓPRIO OFÍCIO, e a tela
   o exibia sob o rótulo "Vai para (do cadastro)". O rótulo mentia: para um
   ofício de março, ela devolve o endereço de março — inclusive um que já
   morreu e já foi corrigido no cadastro da escola. Foi assim que o reenvio do
   ofício 144/2026 ofereceu de volta exatamente o endereço que o fez quicar.

   A substituta junta as duas origens (ofício e cadastro atual), com histórico
   de cada endereço, e devolve também a prévia dos anexos.

   POR QUE CONTINUA AQUI, sem chamador em tela: pela REGRA Nº 1, função sem
   chamador visível não é função morta — só é função cujo uso eu não achei.
   Remoção é pedido explícito do usuário, em commit separado. */
function obterDestinoReenvioOficio(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);
  try {
    var num = String(numero || "").trim();
    if (!num) return { ok: false, emails: "" };

    var ss    = SpreadsheetApp.openById(PLANILHA_ID);
    var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet || sheet.getLastRow() < 2) return { ok: false, emails: "" };

    var h = getHeaderMap_(sheet);
    var colNumero = h["Número do Ofício"];
    var colTodos  = h["E-mails (todos)"];
    var colPrinc  = h["E-mail (principal)"];
    if (!colNumero) return { ok: false, emails: "" };

    var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][colNumero - 1] || "").trim() !== num) continue;
      var e = colTodos ? String(dados[i][colTodos - 1] || "").trim() : "";
      if (!e && colPrinc) e = String(dados[i][colPrinc - 1] || "").trim();
      return { ok: true, emails: e };
    }
    return { ok: false, emails: "" };
  } catch (e) {
    Logger.log("obterDestinoReenvioOficio: " + e.message);
    return { ok: false, emails: "" };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   REUNIR OS ANEXOS DO REENVIO — UMA FUNÇÃO SÓ, 03/09/2026

   POR QUE UMA SÓ. O usuário pediu que o modal mostrasse, ANTES de enviar, o
   que vai em anexo — e em particular se a ficha foi encontrada. Se a prévia
   reunisse os anexos por um caminho e o envio por outro, a prévia mentiria
   no dia em que os dois divergissem. Prévia que mente é pior que não ter
   prévia: ela dá confiança onde não há.

   Então esta função é a ÚNICA que sabe montar o pacote, e as duas chamam.

   AS TRÊS CAMADAS, na ordem em que valem:

   1. o pacote original da fila (ANEXOS_JSON) — é o que de fato foi enviado;
   2. resgate no Drive pelo nome determinístico, para ofício antigo cuja linha
      da fila já não tem a lista. A trava é o token da escola normalizado
      exatamente como a emissão normaliza: anexar a carta de OUTRA escola
      seria pior que não anexar nenhuma;
   3. `Link Ficha` legado, sem duplicar o que já entrou.

   DEVOLVE TAMBÉM `itens`, com nome e origem de cada anexo. É o que a tela
   mostra — e é medição, não promessa: são os blobs que realmente vão.
   ══════════════════════════════════════════════════════════════════════════ */
function reunirAnexosReenvioOficio_(numero, idOficio, tipo, escola, dataEnvio, linkFicha) {
  var itens = [];
  var pacote = obterAnexosOriginaisFilaOficio_(numero, idOficio);
  var anexos = pacote.blobs || [];

  anexos.forEach(function (b) {
    itens.push({ nome: String(b.getName() || ""), origem: "pacote original da fila" });
  });

  if (!anexos.length) {
    var arqOficio = DriveApp.getFileById(idOficio);
    var blobOficio = arqOficio.getBlob().setName(arqOficio.getName());
    anexos.push(blobOficio);
    itens.push({ nome: String(blobOficio.getName() || ""), origem: "PDF do ofício, do Drive" });
  }

  if (!pacote.reconstruido) {
    try {
      recuperarAnexosDaPastaDrive_(tipo, escola, dataEnvio, anexos, idOficio).forEach(function (b) {
        anexos.push(b);
        itens.push({ nome: String(b.getName() || ""), origem: "recuperada do Drive" });
      });
    } catch (eResgate) {
      Logger.log("Reenvio " + numero + ": resgate no Drive falhou — " + eResgate.message);
    }
  }

  if (linkFicha) {
    var idFicha = extrairIdDriveOficio_(linkFicha);
    if (idFicha) {
      try {
        var nomesAtuais = anexos.map(function (b) { return String(b.getName() || ""); });
        var arqFicha = DriveApp.getFileById(idFicha);
        if (nomesAtuais.indexOf(arqFicha.getName()) === -1) {
          var blobFicha = arqFicha.getBlob().setName(arqFicha.getName());
          anexos.push(blobFicha);
          itens.push({ nome: String(blobFicha.getName() || ""), origem: "Link Ficha (registro legado)" });
        }
      } catch (eFicha) {
        Logger.log("⚠ Não foi possível anexar a ficha legada: " + eFicha.message);
      }
    }
  }

  return { blobs: anexos, itens: itens, reconstruido: pacote.reconstruido === true };
}

/* Quais tipos AFIRMAM no corpo que a ficha/carta segue em anexo. Mandar um
   destes sem o documento manda uma ordem sem a prova — a escola recebe
   instrução para descontar, ou para parar de descontar, sem o papel que a
   sustenta. Por isso a tela avisa antes, em vez de o operador descobrir
   depois pela reclamação da escola. */
function tipoOficioExigeFicha_(tipo) {
  var t = String(tipo || "").toLowerCase();
  return t.indexOf("filia") > -1 || t.indexOf("desfilia") > -1 || t.indexOf("oposi") > -1;
}

/* Um anexo é ficha/carta quando não é o PDF do próprio ofício. A emissão
   nomeia o ofício como "Ofício <n> <ano> - ..." e as fichas como
   "Ficha_" / "Fichas_" (Oficios.gs:795-812). */
function anexoEhFicha_(nome) {
  return /^fichas?_/i.test(String(nome || "").trim());
}

/* ══════════════════════════════════════════════════════════════════════════
   O REENVIO TIRA O OFÍCIO DA CAIXA DE FALHA — SEM APAGAR A MEMÓRIA — 04/09/2026

   O usuário perguntou: "quando reenvia ele não deveria sair da caixa de
   falha?". Deveria, e não saía — `reenviarOficio` mandava o e-mail e não
   tocava no Status. Os sete da FAESA continuariam listados como falha depois
   de reenviados, e ele não teria como saber quais já tinha feito.

   A ARMADILHA DO CONSERTO ÓBVIO. O contador de falhas por ENDEREÇO — o
   `❌ 7 falha(s)` que aparece no seletor — é lido da MESMA coluna Status
   (`ofDest_mapaHistorico_`). Virar o status para ENVIADO a cada reenvio faria
   a `thalia.ferreira@faesa.br` perder uma falha por vez; depois dos sete ela
   apareceria com ZERO, voltaria a nascer marcada, e o aviso que evitou o
   oitavo bounce sumiria.

   Duas informações diferentes estavam presas na mesma coluna:

     · "este ofício ainda não chegou"     → o que falta reenviar;
     · "este endereço já quicou 7 vezes"  → não sugerir endereço morto.

   Por isso a falha vira fato PERMANENTE do ofício, numa coluna própria, antes
   de o status ser trocado. O reenvio limpa a fila de trabalho; a reputação do
   endereço fica.
   ══════════════════════════════════════════════════════════════════════════ */

var OFICIO_COL_JA_FALHOU = "JA_FALHOU";

/** Garante a coluna, criando-a no fim se não existir. Mesmo padrão do
    escolaGarantirColunaId_ — acrescentar coluna não mexe em dado nenhum. */
function oficio_garantirColunaJaFalhou_(sh) {
  var hm = getHeaderMap_(sh);
  if (hm[OFICIO_COL_JA_FALHOU]) return hm[OFICIO_COL_JA_FALHOU];
  var col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue(OFICIO_COL_JA_FALHOU).setFontWeight("bold");
  SpreadsheetApp.flush();
  /* O getHeaderMap_ guarda o cabeçalho em cache com TTL. Sem esta limpeza, a
     leitura seguinte usa o mapa antigo, não enxerga a coluna recém-criada, e
     a contagem de falhas do endereço cai a zero — exatamente a regressão que
     esta coluna existe para impedir. O t146 pegou isso. */
  try { limparCacheHeader_(sh); } catch (e) {}
  return col;
}

/**
 * Depois de um reenvio bem-sucedido: grava que o ofício JÁ FALHOU alguma vez
 * e coloca o status em ENVIADO.
 *
 * A ordem importa. A marca é gravada ANTES da troca do status, lendo o status
 * que ainda está lá. Invertida, a informação que se quer preservar já teria
 * sido apagada quando fôssemos lê-la.
 *
 * Vai inteira em try/catch: falhar em atualizar o registro não pode desfazer
 * um e-mail que já saiu, nem transformar um reenvio bom em erro na tela.
 */
function oficio_marcarReenviado_(numero) {
  try {
    var ss = SpreadsheetApp.openById(
      typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sh || sh.getLastRow() < 2) return { ok: false, motivo: "registro vazio" };

    var hm    = getHeaderMap_(sh);
    var cNum  = hm["Número do Ofício"];
    var cSt   = hm["Status"];
    if (!cNum || !cSt) return { ok: false, motivo: "colunas não encontradas" };

    var cJa = oficio_garantirColunaJaFalhou_(sh);

    var alvo  = String(numero || "").trim();
    var dados = sh.getRange(2, cNum, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][0] || "").trim() !== alvo) continue;
      var linha = i + 2;

      var statusAtual = String(sh.getRange(linha, cSt).getValue() || "").trim().toUpperCase();
      if (statusAtual === "FALHA_ENTREGA") {
        sh.getRange(linha, cJa).setValue("SIM");
      }
      sh.getRange(linha, cSt).setValue("ENVIADO");
      SpreadsheetApp.flush();

      /* DUAS ABAS GUARDAM O STATUS, E ATUALIZAR UMA SÓ É PIOR DO QUE NÃO
         ATUALIZAR NENHUMA — 04/09/2026.

         O Registro é a memória do ofício; a FILA_ENVIO_OFICIOS é o que a tela
         do Histórico LÊ e o que o reenvio em lote consulta. Este código
         escrevia só no Registro. O usuário reenviou quatro ofícios, viu
         "Status agora: ENVIADO" na resposta, e a lista continuou marcando os
         onze: *"e mesmo assim fica os 11, não atualizou"*.

         O estrago real não é a contagem errada na tela. É que a preparação
         seguinte lê a fila, acharia os quatro AINDA em falha e os ofereceria
         de novo — o mesmo documento oficial saindo duas vezes para a mesma
         escola, sem como desfazer a segunda cópia.

         O detector de bounce já fazia certo desde sempre: escreve no Registro
         e chama esta função para a fila (MonitoramentoOficios.gs:614 e 624).
         O reenvio só não usava.

         Vai em try/catch próprio: falhar aqui não pode transformar um e-mail
         que JÁ SAIU em erro na tela — mas o retorno diz se sincronizou, para a
         mensagem não afirmar mais do que aconteceu. */
      var naFila = false;
      try {
        if (typeof MON_OFICIOS_atualizarStatusNaFila_ === "function") {
          naFila = MON_OFICIOS_atualizarStatusNaFila_(
            ss, alvo, "ENVIADO",
            "Reenviado em " + Utilities.formatDate(
              new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"));
        }
      } catch (eFila) {
        Logger.log("oficio_marcarReenviado_ (fila): " + (eFila && eFila.message || eFila));
      }

      return { ok: true, statusAnterior: statusAtual, linha: linha, naFila: naFila };
    }
    return { ok: false, motivo: "ofício não encontrado no registro" };
  } catch (e) {
    Logger.log("oficio_marcarReenviado_: " + (e && e.message || e));
    return { ok: false, motivo: String(e && e.message || e) };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RECONCILIAR OS REENVIOS QUE ACONTECERAM ANTES DA MARCAÇÃO EXISTIR

   ORIGEM, 04/09/2026. A marcação de reenvio (`oficio_marcarReenviado_`)
   entrou em produção na versão 695, às 13h14. Ofício reenviado ANTES disso
   continuou com Status FALHA_ENTREGA — nada volta e conserta o passado.

   O usuário perguntou: "se já foi reenviado ele atualiza?". Não atualizava. E
   reenviar de novo só para limpar a lista faria a escola receber duas vezes.

   O DADO JÁ EXISTE. Todo reenvio grava no LOG_SISTEMA com o número e o
   sufixo "(REENVIO)". O sistema sabe quais foram reenviados; só não estava
   usando isso para acertar o status.

   POR QUE COMEÇA SIMULANDO. Isto escreve na coluna Status do Controle, que é
   o que decide o que aparece como falha. Rodar às cegas numa base de 347
   ofícios é o tipo de coisa que não se desfaz. O padrão é SIMULAR: só
   escreve quando alguém pede explicitamente `simular = false`.

   O QUE ELE NÃO FAZ, de propósito: não reenvia nada, não toca em e-mail, não
   inventa reenvio que o log não registre. Se o log não tem, para ele não
   aconteceu.
   ══════════════════════════════════════════════════════════════════════════ */
function reconciliarReenviosOficios(simular, tokenSessao) {
  /* PORTA DUPLA. Isto é ferramenta de manutenção: roda uma vez, do EDITOR do
     Apps Script, onde não existe token de sessão. Fechar só com token deixaria
     a função sem lugar nenhum de onde ser chamada — foi o que eu fiz na
     primeira versão, e o usuário descobriu ao procurá-la no seletor do editor
     e não achar como executar.

     Mesmo padrão do `sincronizarStatusOficiosEnviados` (01/09) e dos
     handlers de gatilho: aceita sessão OU administrador identificado pela
     conta que executa. */
  exigirAdminOuSessao_(tokenSessao, "documentos",
                       "Reconciliacao de reenvios de oficios", true);
  /* Simular é o padrão: só escreve quem passar `false` de propósito. */
  return oficio_reconciliarReenvios_(simular !== false);
}

function oficio_reconciliarReenvios_(simular) {
  var ss = SpreadsheetApp.openById(
    typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);

  var log = ss.getSheetByName("LOG_SISTEMA");
  if (!log || log.getLastRow() < 2) {
    return { ok: true, simulado: simular, reenviadosNoLog: 0, ajustar: [], ajustados: 0,
             mensagem: "LOG_SISTEMA vazio — nenhum reenvio registrado." };
  }

  /* ── quais números o log diz que foram reenviados ── */
  var hmLog = getHeaderMap_(log);
  var cNumLog = hmLog["NUMERO"];
  if (!cNumLog) {
    return { ok: false, mensagem: "Coluna NUMERO não encontrada no LOG_SISTEMA." };
  }
  var linhasLog = log.getRange(2, cNumLog, log.getLastRow() - 1, 1).getValues();
  var reenviados = {};
  for (var i = 0; i < linhasLog.length; i++) {
    var texto = String(linhasLog[i][0] || "");
    if (texto.indexOf("(REENVIO") === -1) continue;
    /* O campo é "144/2026 (REENVIO - ENDERECO SUBSTITUIDO)": o número é o que
       vem antes do parêntese. */
    var numero = texto.split("(")[0].trim();
    if (numero) reenviados[numero] = true;
  }

  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: false, mensagem: "Registro de ofícios vazio." };
  }
  var hm   = getHeaderMap_(sh);
  var cNum = hm["Número do Ofício"];
  var cSt  = hm["Status"];
  if (!cNum || !cSt) {
    return { ok: false, mensagem: "Colunas do Controle não encontradas." };
  }

  /* A coluna só é criada quando houver algo a gravar — simular não deve
     alterar a estrutura da planilha. */
  var cJa = simular ? (hm[OFICIO_COL_JA_FALHOU] || 0) : oficio_garantirColunaJaFalhou_(sh);

  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var ajustar = [], ajustados = 0;

  for (var j = 0; j < dados.length; j++) {
    var num = String(dados[j][cNum - 1] || "").trim();
    if (!num || !reenviados[num]) continue;

    var st = String(dados[j][cSt - 1] || "").trim().toUpperCase();
    if (st !== "FALHA_ENTREGA") continue;   /* já está resolvido */

    ajustar.push({ numero: num, linha: j + 2, statusAtual: st });

    if (!simular) {
      if (cJa) sh.getRange(j + 2, cJa).setValue("SIM");
      sh.getRange(j + 2, cSt).setValue("ENVIADO");
      /* A fila também, pelo mesmo motivo do oficio_marcarReenviado_: é ela que
         a tela lê e que o reenvio em lote consulta. Reconciliar só o Registro
         deixaria o ofício sumido do relatório e presente na lista de falhas. */
      try {
        if (typeof MON_OFICIOS_atualizarStatusNaFila_ === "function") {
          MON_OFICIOS_atualizarStatusNaFila_(ss, num, "ENVIADO",
            "Reconciliado: o log registra reenvio deste ofício");
        }
      } catch (eFila) {
        Logger.log("oficio_reconciliarReenvios_ (fila): " + (eFila && eFila.message || eFila));
      }
      ajustados++;
    }
  }
  if (!simular && ajustados) SpreadsheetApp.flush();

  var quantosNoLog = 0;
  for (var k in reenviados) if (reenviados.hasOwnProperty(k)) quantosNoLog++;

  return {
    ok: true,
    simulado: simular,
    reenviadosNoLog: quantosNoLog,
    ajustar: ajustar,
    ajustados: ajustados,
    mensagem: simular
      ? ("SIMULAÇÃO — nada foi escrito. O log registra " + quantosNoLog +
         " ofício(s) reenviado(s); " + ajustar.length +
         " ainda está(ão) como FALHA_ENTREGA e seria(m) ajustado(s)." +
         (ajustar.length ? " Para aplicar, rode de novo com simular = false." : ""))
      : (ajustados + " ofício(s) ajustado(s) para ENVIADO, com JA_FALHOU = SIM. " +
         "A memória da falha foi preservada.")
  };
}

function reenviarOficio(registro, tokenSessao) {
  var sessaoDocumentos = exigirModulo_(tokenSessao, "documentos", false);
  try {
    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();
    var numero = String(registro.numero || "").trim();
    var escola = String(registro.escola || "").trim();
    var tipo   = String(registro.tipo   || "").trim();
    var url    = String(registro.url    || "").trim();

    /* ENDERECO FORA DO CADASTRO — pedido do usuario em 01/09/2026, a partir do
       caso da FAESA: tres oficios quicaram no mesmo endereco, e ele precisava
       reenviar antes de o cadastro ser corrigido.

       `somenteExtras` existe porque acrescentar nem sempre serve: quando o
       endereco do cadastro nao recebe mais, mandar de novo para ele gera outro
       bounce — que agora marca FALHA_ENTREGA mesmo tendo a copia chegado no
       endereco novo. Nesse caso o certo e substituir. */
    var emailsExtras  = String(registro.emailsExtras || "").trim();
    var somenteExtras = registro.somenteExtras === true;

    if (!numero) return { erro: true, mensagem: "Número do ofício não informado." };
    if (!url)    return { erro: true, mensagem: "PDF não encontrado para este ofício." };

    var ss    = SpreadsheetApp.openById(PLANILHA_ID);
    var sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet) return { erro: true, mensagem: "Aba de registro não encontrada." };

    var h              = getHeaderMap_(sheet);
    var colNumero      = h["Número do Ofício"];
    var colEmail       = h["E-mail (principal)"];
    var colEmailsTodos = h["E-mails (todos)"];
    var colLinkFicha   = h["Link Ficha"];
    /* A data do envio entra no NOME do arquivo da carta na emissao, entao e
       ela que permite resgatar exatamente o lote daquele dia. */
    var colDataEnvio   = h["Data envio ofício"] || h["Data envio oficio"];
    if (!colNumero || (!colEmail && !colEmailsTodos)) {
      return { erro: true, mensagem: "Colunas necessárias não encontradas." };
    }

    var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var emailDestino = "", linkFicha = "", dataEnvioOficio = null;
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][colNumero - 1] || "").trim() !== numero) continue;
      emailDestino = colEmailsTodos ? String(dados[i][colEmailsTodos - 1] || "").trim() : "";
      if (!emailDestino && colEmail) emailDestino = String(dados[i][colEmail - 1] || "").trim();
      if (colLinkFicha) linkFicha = String(dados[i][colLinkFicha - 1] || "").trim();
      if (colDataEnvio) {
        var brutoData = dados[i][colDataEnvio - 1];
        if (brutoData instanceof Date && !isNaN(brutoData.getTime())) dataEnvioOficio = brutoData;
      }
      break;
    }

    /* O extra e validado ANTES de qualquer coisa: um endereco malformado
       derruba o envio inteiro no Gmail, e o operador ficaria sem saber se o
       oficio saiu. Melhor recusar aqui, dizendo qual endereco esta errado. */
    var validacaoExtras = null;
    if (emailsExtras) {
      validacaoExtras = validarListaEmails_(emailsExtras);
      if (!validacaoExtras.ok) {
        return { erro: true, mensagem: "Endereço informado é inválido: " +
                 (validacaoExtras.invalido || emailsExtras) };
      }
    }

    if (somenteExtras && !emailsExtras) {
      return { erro: true, mensagem: "Marque 'somente este endereço' apenas quando informar um endereço." };
    }

    if (!emailDestino && !emailsExtras) {
      return { erro: true, mensagem: "E-mail do destinatário não encontrado." };
    }

    /* ESCOLHA EXPLÍCITA DA TELA — 03/09/2026.

       O usuário abriu o reenvio do ofício 144 e viu, no campo rotulado "do
       cadastro", o endereço da Thalia — morto, e que ele já tinha corrigido
       no cadastro da escola no dia anterior. O rótulo mentia: este campo
       nunca leu o cadastro da escola, e sim a linha do PRÓPRIO OFÍCIO no
       Registro, congelada no dia da emissão.

       Agora a tela manda a lista escolhida, e ela vence tudo: nem cadastro
       antigo, nem extras, nem `somenteExtras`. Quem escolheu foi a pessoa,
       olhando origem e histórico de cada endereço. */
    var escolhaExplicita = Array.isArray(registro.destinatarios)
      ? registro.destinatarios : null;
    if (escolhaExplicita && escolhaExplicita.length) {
      var validacaoEscolha = validarListaEmails_(escolhaExplicita.join(";"));
      if (!validacaoEscolha.ok) {
        return { erro: true, mensagem: "Endereço inválido na escolha: " +
                 (validacaoEscolha.invalido || "") };
      }
      emailsExtras  = "";
      somenteExtras = false;
      emailDestino  = validacaoEscolha.todos;
    }

    var listaFinal = [];
    if (!somenteExtras && emailDestino) {
      var validacaoEmails = validarListaEmails_(emailDestino);
      if (!validacaoEmails.ok) {
        return { erro: true, mensagem: "Há e-mail inválido salvo neste ofício: " + (validacaoEmails.invalido || "") };
      }
      listaFinal = String(validacaoEmails.todos || "").split(/[;,]/);
    }
    if (validacaoExtras) {
      listaFinal = listaFinal.concat(String(validacaoExtras.todos || "").split(/[;,]/));
    }

    /* Sem duplicar: o mesmo endereco em cadastro e extra mandaria duas copias
       do mesmo oficio para a mesma pessoa. */
    var vistos = {}, destinos = [];
    listaFinal.forEach(function (e) {
      var n = String(e || "").trim().toLowerCase();
      if (!n || vistos[n]) return;
      vistos[n] = true;
      destinos.push(n);
    });
    if (!destinos.length) return { erro: true, mensagem: "Nenhum destinatário válido para o reenvio." };

    var validacaoEmails = { ok: true, todos: destinos.join(",") };

    var idOficio = extrairIdDriveOficio_(url);
    if (!idOficio) return { erro: true, mensagem: "Não foi possível identificar o arquivo PDF na URL informada." };

    var reuniao = reunirAnexosReenvioOficio_(numero, idOficio, tipo, escola, dataEnvioOficio, linkFicha);
    var anexos  = reuniao.blobs;
    var pacote  = { reconstruido: reuniao.reconstruido };

    var htmlBody = montarEmailHTML_(
      "Reenvio — " + tipo, numero, obterLabelTipoOficio_(tipo), 0,
      "Reenviamos, em anexo, o ofício Nº " + numero + " referente a " + escola + ", conforme solicitado."
    );

    var opcoes = enviarEmailOficio_(
      emailUsuario, htmlBody, anexos,
      "Reenvio: " + tipo + " Nº " + numero,
      validacaoEmails.todos,
      "Segue reenvio do ofício em anexo."
    );

    /* Sai da caixa de falha, sem apagar a memória de que falhou. */
    var marcado = oficio_marcarReenviado_(numero);

    /* A TRILHA PRECISA DIZER QUE SAIU DO CADASTRO. Este recurso permite mandar
       um oficio, com dado pessoal dentro, para um endereco que ninguem
       cadastrou. E necessidade legitima de operacao — mas a contrapartida e o
       registro de quem mandou para onde. Sem isto, o recurso seria uma porta
       de saida de documento sem rastro. */
    registrarLogSistema_({
      usuario: emailUsuario,
      numero:  numero + (emailsExtras
                 ? (somenteExtras ? " (REENVIO - ENDERECO SUBSTITUIDO)"
                                  : " (REENVIO - ENDERECO ACRESCENTADO)")
                 : " (REENVIO)"),
      tipo: tipo,
      escola: escola,
      cnpj: "",
      email: opcoes.to,
      codigo: ""
    });

    return {
      erro: false,
      /* Diz QUANTOS e DE ONDE. "Anexos: 1" num tipo que promete carta e o
         sinal de que algo faltou — antes essa informacao nao existia. */
      mensagem: "Ofício " + numero + " reenviado para " + opcoes.to +
        (emailsExtras ? (somenteExtras ? " [endereço do cadastro NÃO recebeu]"
                                       : " [inclui endereço fora do cadastro]") : "") +
        ". Anexos: " + anexos.length +
        (pacote.reconstruido ? " (pacote original da fila)."
                             : " (fila sem lista de anexos; recuperados do Drive).") +
        (marcado && marcado.ok
          ? (marcado.naFila
              ? " Status agora: ENVIADO."
              : " Status agora: ENVIADO no Controle, mas a FILA não foi" +
                " sincronizada — ele ainda vai aparecer como falha na tela.")
          : " ATENÇÃO: o status no Controle não pôde ser atualizado" +
            (marcado && marcado.motivo ? " (" + marcado.motivo + ")" : "") +
            " — o ofício vai continuar aparecendo como falha.")
    };

  } catch(e) {
    return { erro: true, mensagem: "Erro ao reenviar: " + e.message };
  }
}

/* ── Helpers de formatação de corpo ── */
function normalizarTextoParagrafosEmail_(texto) {
  return String(texto || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function removerFrasesIndesejadas_(texto) {
  return String(texto || "")
    .replace(/Ressaltamos que o referido repasse possui finalidade específica[\s\S]*?partes\./gi, "")
    .replace(/\n{2,}/g, "\n\n").trim();
}

function formatarCorpoEmailHTML_(texto) {
  texto = removerFrasesIndesejadas_(texto);
  var conteudo = normalizarTextoParagrafosEmail_(texto);
  if (!conteudo) return "<p style='margin:0 0 12px 0;text-align:justify;line-height:1.7;'> </p>";
  return conteudo.split(/\n\s*\n/).map(function(paragrafo) {
    var html = String(paragrafo).replace(/\n/g,"<br>");
    return "<p style='margin:0 0 14px 0;text-align:justify;line-height:1.7;'>" + html + "</p>";
  }).join("");
}
