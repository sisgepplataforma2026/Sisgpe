// ============================================================================
// ARQUIVO: VoucherEnvio.gs
// O MODAL DE ENVIO DO CERTIFICADO — e-mail e WhatsApp, depois de emitido.
//
// O FLUXO, IGUAL AO DOS OFÍCIOS
//
//   1. escolher   → lista de solicitações aprovadas
//   2. conferir   → prévia renderizada, NADA gravado
//   3. emitir     → PDF + registro em Voucher_Emitidos
//   4. enviar     → este arquivo: e-mail e/ou WhatsApp
//
// Separar 3 de 4 é o que permite emitir hoje e enviar amanhã, reenviar quando
// o associado apaga o e-mail, e mandar pelo zap quando o e-mail volta.
//
// SOBRE O WHATSAPP — E ISTO NÃO É LIMITAÇÃO, É O DESENHO DO SISTEMA
//
// O SISGEP não envia WhatsApp. Não existe API de zap em nenhum arquivo deste
// projeto — nem Z-API, nem Twilio, nem nada. O que existe, em oito telas, é
// um link `wa.me` aberto numa aba nova com a mensagem já escrita, e QUEM
// APERTA ENVIAR É A PESSOA, no aparelho dela.
//
// Este arquivo segue esse padrão em vez de inventar um segundo. A função
// devolve o link pronto; a tela abre. Por isso o botão da tela diz "Abrir
// WhatsApp" e não "Enviar": botão que promete o que não faz é como se perde
// a confiança numa tela inteira.
//
// O LINK DO PDF é público para quem tiver o endereço — decisão do usuário em
// 12/08/2026, e já era o comportamento de salvarHtmlComoPdfVoucher_. É o
// único que funciona no celular do associado sem tela de login. Falsificar
// não dá: o documento carrega código de validação e QR que apontam para a
// rota de conferência. O que se aceita é o risco de leitura por quem receber
// o link encaminhado.
// ============================================================================

var VOUCHER_ABA_EMITIDOS = "Voucher_Emitidos";
var VOUCHER_ABA_SOLICITACOES = "Voucher_Solicitacoes";

/**
 * Junta tudo que o modal de envio precisa, numa chamada só.
 *
 * Uma chamada e não três porque o modal abre logo depois de emitir, e três
 * idas ao servidor com a planilha aberta viram meio segundo de tela cinza.
 */
/**
 * Data em texto, sempre — nunca objeto Date no retorno para a tela.
 *
 * Por que existe: google.script.run devolve NULL ao navegador, calado, se
 * algo no pacote não serializar. Uma Date inválida (célula com conteúdo
 * estranho, importação torta) é o caso clássico, e o sintoma engana: a tela
 * recebe "nada" e não tem como dizer o que houve.
 *
 * Aceita Date, texto ou vazio. Nunca lança: o pior que devolve é "".
 */
function voucherDataTexto_(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  try {
    if (Object.prototype.toString.call(valor) === "[object Date]") {
      if (isNaN(valor.getTime())) return "";
      return Utilities.formatDate(valor, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    }
    return String(valor);
  } catch (e) {
    return "";
  }
}

function voucherPrepararEnvio(protocolo, tokenSessao) {
  try {
    /* Guarda DENTRO do try, pelo mesmo motivo de voucherEnviarPorEmail:
       fora dele, a recusa vira exceção crua e a tela mostra erro sem nome. */
    exigirModulo_(tokenSessao, "beneficios", false);

    protocolo = String(protocolo || "").trim();
    if (!protocolo) return { ok: false, mensagem: "Informe o protocolo." };

    var ss = SpreadsheetApp.openById(PLANILHA_ID);

    var emissao = voucherLinhaPorProtocolo_(ss, VOUCHER_ABA_EMITIDOS, protocolo);
    if (!emissao) {
      return { ok: false,
               mensagem: "O protocolo " + protocolo + " ainda não foi emitido. " +
                         "Emita antes de enviar — não há documento para mandar." };
    }
    var solic = voucherLinhaPorProtocolo_(ss, VOUCHER_ABA_SOLICITACOES, protocolo) || {};

    var nome = String(emissao.NOME_SOLICITANTE || solic.NOME_SOLICITANTE || "").trim();
    var link = String(emissao.LINK_ARQUIVO || "").trim();
    var codigo = String(emissao.CODIGO_VALIDACAO || "").trim();
    var curso = String(solic.CURSO || "").trim();
    /* NORMALIZADO, e não lido cru — este era o último lugar que ainda lia.
     *
     * Medido em 17/08/2026: a tela de envio recebia "'2027/1", COM o
     * apóstrofo protetor que a planilha usa para não converter o período em
     * data. Ele não faz parte do valor, mas aparece em quem lê a célula sem
     * passar pelo normalizador.
     *
     * O estrago não parava na tela: o mesmo `periodo` entra no texto do
     * WhatsApp e no corpo do e-mail. O associado receberia uma mensagem do
     * sindicato escrita "referente ao período '2027/1" — com uma aspa solta
     * que ninguém consegue explicar.
     *
     * `voucherPeriodoTexto_` resolve os dois casos de uma vez: tira o
     * apóstrofo e converte de volta a Date que o Sheets tenha criado. */
    var periodo = (typeof voucherPeriodoTexto_ === "function")
      ? voucherPeriodoTexto_(solic.PERIODO_REFERENCIA)
      : String(solic.PERIODO_REFERENCIA || "").replace(/^'/, "").trim();
    var percentual = String(emissao.PERCENTUAL || solic.PERCENTUAL_APLICADO || "").trim();

    /* Dois e-mails, dois papéis. O do associado vem da solicitação; o da
     * instituição de ensino é onde ele estuda, e é quem aplica o desconto.
     * Se a instituição não tiver e-mail cadastrado, o campo volta vazio e a
     * tela mostra a caixa em branco — em vez de sumir com a linha e deixar
     * quem emite achando que a cópia foi. */
    var emailAssociado = voucherPrimeiroEmail_(solic.EMAIL);

    /* O e-mail da instituição vem de três lugares, nesta ordem — e a tela
     * mostra DE ONDE veio, porque a confiança em cada um é diferente:
     *
     *   1. gravado na solicitação   — alguém digitou de propósito
     *   2. achado no cadastro de Escolas pelo CNPJ/nome
     *   3. nenhum                   — o campo abre vazio, para digitar
     *
     * Mostrar a origem importa: um e-mail que veio do cadastro pode estar
     * desatualizado há anos, e quem envia precisa saber que está usando um
     * palpite do sistema em vez de algo confirmado. Sem isso, o campo
     * preenchido passa a impressão de conferido. */
    var emailInstituicao = voucherPrimeiroEmail_(solic.EMAIL_INSTITUICAO);
    var origemEmailInstituicao = emailInstituicao ? "SOLICITACAO" : "";

    if (!emailInstituicao && typeof buscarEmailRhEscolaVoucher_ === "function") {
      try {
        var achado = voucherPrimeiroEmail_(
          buscarEmailRhEscolaVoucher_(solic.INSTITUICAO_ENSINO || "", solic.CNPJ_INSTITUICAO || ""));
        if (achado) { emailInstituicao = achado; origemEmailInstituicao = "CADASTRO"; }
      } catch (e) {
        Logger.log("Busca do e-mail da instituição falhou: " + e.message);
      }
    }

    var telefone = String(solic.TELEFONE || "").replace(/\D/g, "");
    var telefoneZap = voucherTelefoneParaZap_(telefone);

    return {
      ok: true,
      protocolo: protocolo,
      nome: nome,
      codigo: codigo,
      percentual: percentual,
      curso: curso,
      periodo: periodo,
      instituicao: String(solic.INSTITUICAO_ENSINO || "").trim(),
      linkPdf: link,
      temPdf: !!link,
      emailAssociado: emailAssociado,
      emailInstituicao: emailInstituicao,
      /* "SOLICITACAO" = digitado por alguém · "CADASTRO" = achado na aba
       * Escolas, pode estar velho · "" = não achou, campo em branco. */
      origemEmailInstituicao: origemEmailInstituicao,
      telefone: voucherTelefoneFormatado_(telefone),
      /* Vazio quando o número não serve. A tela desabilita o botão em vez de
       * abrir um wa.me quebrado, que no celular vira "número inválido" e faz
       * a pessoa achar que o sistema perdeu o contato. */
      whatsappUrl: telefoneZap
        ? "https://wa.me/" + telefoneZap + "?text=" +
          encodeURIComponent(voucherTextoWhatsApp_(nome, protocolo, curso, periodo, link))
        : "",
      textoWhatsApp: voucherTextoWhatsApp_(nome, protocolo, curso, periodo, link),
      envios: voucherEnviosAnteriores_(ss, protocolo),
      /* TEXTO, NÃO Date. Esta é a causa mais provável do "o servidor não
       * respondeu nada" que o usuário viu em 18/08/2026 no protocolo
       * BOLSA-2026-916155.
       *
       * google.script.run serializa o retorno para o navegador. Quando algo
       * no pacote não serializa — e uma Date inválida vinda de célula com
       * conteúdo estranho é o caso clássico — o cliente recebe NULL, sem
       * erro, sem log, sem nada. A tela então cai no ramo `!r`, mostra a
       * mensagem genérica e fecha o modal.
       *
       * Data convertida para texto no servidor não tem como quebrar a
       * serialização, e a tela já exibia isso como texto de qualquer forma. */
      emitidoEm: voucherDataTexto_(emissao.DATA_EMISSAO),
      emitidoPor: String(emissao.USUARIO || "").trim()
    };
  } catch (e) {
    Logger.log("voucherPrepararEnvio: " + e.message);
    return { ok: false, mensagem: "Erro ao preparar o envio: " + e.message };
  }
}

/**
 * Envia o certificado por e-mail, para o associado e — se houver — para a
 * instituição de ensino em cópia.
 *
 * O PDF vai ANEXADO, não só linkado. Anexo o associado guarda; link o Drive
 * pode mudar. O link vai junto no corpo, para quem lê no celular.
 */
function voucherEnviarPorEmail(protocolo, opcoes, tokenSessao) {
  /* A sessão é guardada, não descartada: sem ela a trilha registra o envio
   * como usuário "—", e um rastro que não diz QUEM mandou o certificado de
   * alguém não serve para a única pergunta que se faz depois. */
  opcoes = opcoes || {};
  try {
    /* A GUARDA DE SESSÃO FICA DENTRO DO TRY.
     *
     * Fora dele, qualquer recusa aqui vira exceção não capturada — e o que
     * chega na tela é "erro de servidor", genérico, sem dizer o que houve.
     * O usuário relatou exatamente isso em 18/08/2026: "o voucher não é
     * enviado, dá erro de servidor".
     *
     * Recusar continua recusando: nada é enviado, nada é gravado. O que
     * muda é que a pessoa lê o motivo — sessão expirada, falta de acesso ao
     * módulo — em vez de um erro sem nome, e sabe se relogar resolve ou se
     * precisa chamar o administrador.
     *
     * Todo o resto desta função já devolvia mensagem legível pelo catch. A
     * guarda era o único ponto que escapava. */
    var sessao = exigirModulo_(tokenSessao, "beneficios", false);

    var pronto = voucherPrepararEnvio(protocolo, tokenSessao);
    if (!pronto.ok) return pronto;

    var para = String(opcoes.para || pronto.emailAssociado || "").trim();
    if (!para) {
      return { ok: false, mensagem: "Sem e-mail do associado. Preencha o destinatário." };
    }
    /* A cópia para a instituição é OPCIONAL e EDITÁVEL.
     *
     * enviarInstituicao === false desliga de vez — há casos em que o
     * associado prefere levar o documento pessoalmente, e mandar por fora
     * disso é decidir pela vida dele.
     *
     * `copia` vindo preenchido substitui o sugerido: quem emite corrige o
     * endereço ali, sem precisar abrir o cadastro da escola para trocar uma
     * letra. O que ele digitar vale mais que o palpite do sistema. */
    var copia = "";
    if (opcoes.enviarInstituicao !== false) {
      copia = String(opcoes.copia !== undefined && opcoes.copia !== null
        ? opcoes.copia
        : (pronto.emailInstituicao || "")).trim();
    }
    if (copia && copia.indexOf("@") < 1) {
      return { ok: false, mensagem: "O e-mail da instituição não parece válido: " + copia };
    }

    var anexos = [];
    if (opcoes.anexarPdf !== false && pronto.linkPdf) {
      try {
        var id = voucherIdDoLink_(pronto.linkPdf);
        if (id) anexos.push(DriveApp.getFileById(id).getBlob());
      } catch (e) {
        /* Anexo falhou, mas o link continua no corpo. Não trava o envio: o
         * associado recebe o aviso e consegue abrir o documento. */
        Logger.log("Anexo do PDF falhou (o link vai no corpo): " + e.message);
      }
    }

    var msg = {
      to: para,
      subject: "Certificado de Bolsa de Estudo — protocolo " + pronto.protocolo,
      htmlBody: voucherCorpoEmail_(pronto),
      name: "SindEducação-ES"
    };
    if (copia) msg.cc = copia;
    if (anexos.length) msg.attachments = anexos;

    MailApp.sendEmail(msg);
    voucherRegistrarEnvio_(pronto.protocolo, "EMAIL",
      para + (copia ? " (cc " + copia + ")" : ""), sessao);

    /* A MEMÓRIA APRENDE AQUI, e este é o ponto mais valioso dela.
     *
     * Quando quem envia CORRIGE o e-mail da instituição no modal, essa
     * correção é o sinal mais forte que o sistema recebe: alguém olhou o
     * endereço sugerido, viu que estava errado e digitou o certo. Antes
     * disso, a correção morria no envio e a próxima solicitação sugeria o
     * endereço velho de novo — errar duas vezes o mesmo endereço é o que
     * não pode acontecer.
     *
     * Nunca lança: memória é conveniência, o e-mail já saiu. */
    if (typeof voucherInstLembrar_ === "function") {
      voucherInstLembrar_({
        nome: pronto.instituicao,
        cnpj: (voucherLinhaPorProtocolo_(SpreadsheetApp.openById(PLANILHA_ID),
                 VOUCHER_ABA_SOLICITACOES, pronto.protocolo) || {}).CNPJ_INSTITUICAO,
        email: copia,
        percentual: pronto.percentual,
        quem: (sessao && (sessao.email || sessao.usuario)) || ""
      });
    }

    return { ok: true, mensagem: "E-mail enviado para " + para + (copia ? " com cópia para " + copia : "") + ".",
             para: para, copia: copia, comAnexo: anexos.length > 0 };
  } catch (e) {
    Logger.log("voucherEnviarPorEmail: " + e.message);
    return { ok: false, mensagem: "Erro ao enviar o e-mail: " + e.message };
  }
}

/**
 * Registra que o link do WhatsApp foi aberto.
 *
 * NÃO ENVIA NADA — o sistema não tem como. Quem envia é a pessoa, no
 * aplicativo. Isto marca "abri o zap para fulano às 16:42", que é o que
 * permite a quem emitiu 15 certificados saber quais já tocou.
 *
 * Por isso o registro diz ABERTO e não ENVIADO: afirmar entrega que não se
 * pode confirmar é pior que não registrar nada.
 */
function voucherRegistrarAberturaWhatsApp(protocolo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var r = voucherRegistrarEnvio_(String(protocolo || "").trim(), "WHATSAPP_ABERTO", "", sessao);
    return r ? { ok: true } : { ok: false, mensagem: "Não consegui registrar a abertura." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   APOIO
   ══════════════════════════════════════════════════════════════════════ */

function voucherLinhaPorProtocolo_(ss, nomeAba, protocolo) {
  var sh = ss.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() < 2) return null;
  var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
  var iProt = cab.indexOf("PROTOCOLO");
  if (iProt === -1) iProt = cab.indexOf("NUMERO_PROTOCOLO");
  if (iProt === -1) return null;

  var alvo = String(protocolo).trim().toUpperCase();
  /* De trás para frente: quando o mesmo protocolo foi emitido duas vezes,
   * a que vale é a última. */
  for (var l = tudo.length - 1; l >= 1; l--) {
    if (String(tudo[l][iProt] || "").trim().toUpperCase() !== alvo) continue;
    var obj = {};
    cab.forEach(function (nome, i) { if (nome) obj[nome] = tudo[l][i]; });
    obj.__linha = l + 1;
    return obj;
  }
  return null;
}

/** O primeiro e-mail de um campo que pode trazer vários, separados por vírgula. */
function voucherPrimeiroEmail_(v) {
  var t = String(v == null ? "" : v).trim();
  if (!t) return "";
  var partes = t.split(/[;,\s]+/).filter(function (p) { return p.indexOf("@") > 0; });
  return partes.length ? partes[0].toLowerCase() : "";
}

/**
 * Número pronto para o wa.me, ou vazio quando não serve.
 *
 * Vazio é resposta legítima aqui: telefone fixo de 8 dígitos, celular sem o
 * nono, campo com "não tem". Devolver um número torto faria o WhatsApp abrir
 * em "número inválido" — e a pessoa concluiria que o cadastro perdeu o
 * contato, quando o contato nunca serviu.
 */
function voucherTelefoneParaZap_(digitos) {
  var d = String(digitos || "").replace(/\D/g, "");
  if (d.indexOf("55") === 0 && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 11 || d.length === 10) return "55" + d;
  return "";
}

function voucherTelefoneFormatado_(digitos) {
  var d = String(digitos || "").replace(/\D/g, "");
  if (d.indexOf("55") === 0 && d.length > 11) d = d.slice(2);
  if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return d || "";
}

/** Só o primeiro nome, que é como se fala com alguém no WhatsApp. */
function voucherPrimeiroNome_(nome) {
  var t = String(nome || "").trim();
  if (!t) return "";
  var p = t.split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function voucherTextoWhatsApp_(nome, protocolo, curso, periodo, link) {
  var l = [];
  l.push("Olá" + (nome ? ", " + voucherPrimeiroNome_(nome) : "") + "! Aqui é do SindEducação-ES.");
  l.push("");
  l.push("Seu Certificado de Bolsa de Estudo foi emitido" +
         (curso ? " para o curso de " + curso : "") +
         (periodo ? " (" + periodo + ")" : "") + ".");
  l.push("Protocolo: " + protocolo);
  if (link) {
    l.push("");
    l.push("Documento: " + link);
    l.push("");
    l.push("Apresente-o à instituição de ensino para aplicar o desconto.");
  }
  return l.join("\n");
}

/**
 * O e-mail do certificado, no padrão visual do SISGEP.
 *
 * POR QUE FOI REFEITO (pedido do usuário em 18/08/2026: "só precisa
 * ajustar o texto para ficar no padrão Sisgep")
 *
 * O e-mail anterior era de outra família visual: Arial, faixa lisa com só
 * "SindEducação-ES" — que ainda saía CORTADA no topo —, dados soltos no
 * meio do texto e um rodapé de duas linhas cinza. Quem recebe um ofício e
 * depois um certificado via dois remetentes diferentes.
 *
 * Este agora usa o MESMO desenho do e-mail de ofício (EmailOficios.gs):
 * cabeçalho navy em gradiente com o filete dourado à esquerda, o nome
 * inteiro do sindicato e o CNPJ, o protocolo em dourado à direita, badge
 * do tipo, corpo branco e rodapé navy assinado.
 *
 * DUAS DECISÕES QUE VALE REGISTRAR:
 *
 * - QUEM ASSINA O QUÊ, definido pelo usuário em 18/08/2026: o CERTIFICADO
 *   em anexo é assinado pelo presidente, Leonil Dias da Silva; o E-MAIL
 *   que o acompanha é da Marcelha, do administrativo — a mesma assinatura
 *   do e-mail de ofício. São papéis diferentes: o documento é ato do
 *   sindicato, o e-mail é quem atende. Quem responder a mensagem cai em
 *   quem sabe resolver, e não na presidência.
 * - O bloco de dados é rotulado (curso, período, desconto, validação) em
 *   vez de diluído na frase. O associado leva esse e-mail para a
 *   secretaria da faculdade, e lá o que se procura é campo, não prosa.
 *
 * Tudo em style inline e sem imagem externa: cliente de e-mail ignora
 * <style> em <head> e bloqueia imagem remota por padrão.
 */
function voucherCorpoEmail_(d) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Uma linha do bloco de dados. Some inteira quando o dado não existe —
     rótulo com traço na frente é pior do que rótulo nenhum. */
  function linha(rotulo, valor, espacado) {
    if (!valor) return "";
    return "<tr>" +
      "<td style='padding:7px 0;font-size:10.5px;font-weight:700;color:#64748b;" +
        "text-transform:uppercase;letter-spacing:.09em;white-space:nowrap;" +
        "vertical-align:top;width:34%;'>" + esc(rotulo) + "</td>" +
      "<td style='padding:7px 0;font-size:14px;font-weight:800;color:#0f172a;" +
        (espacado ? "letter-spacing:.06em;" : "") + "'>" + esc(valor) + "</td>" +
    "</tr>";
  }

  var saudacao = "Olá" + (d.nome ? ", " + esc(voucherPrimeiroNome_(d.nome)) : "") + "!";

  return "" +
  "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:680px;color:#0f172a;'>" +

    /* ── CABEÇALHO ── */
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 55%,#003b82 100%);" +
      "padding:22px 28px 20px;border-radius:8px 8px 0 0;'>" +
      "<div style='display:flex;align-items:flex-start;justify-content:space-between;gap:20px;'>" +
        "<div style='border-left:4px solid #C9A84C;padding-left:16px;'>" +
          "<div style='font-size:21px;font-weight:900;color:#fff;'>SINDEDUCAÇÃO-ES</div>" +
          "<div style='font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;'>" +
            "Sindicato dos Educadores Técnico-Administrativos<br>" +
            "em Estabelecimentos de Ensino Particular no Estado do Espírito Santo</div>" +
          "<div style='font-size:10.5px;font-weight:800;color:#C9A84C;margin-top:6px;'>" +
            "CNPJ: 31.815.780/0001-51</div>" +
        "</div>" +
        "<div style='text-align:right;'>" +
          "<div style='font-size:10px;font-weight:700;color:rgba(255,255,255,.4);" +
            "text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;'>Protocolo</div>" +
          "<div style='font-size:16px;font-weight:900;color:#C9A84C;white-space:nowrap;'>" +
            esc(d.protocolo) + "</div>" +
        "</div>" +
      "</div>" +
      "<div style='height:1px;background:rgba(201,168,76,.25);margin:16px 0 14px;'></div>" +
      /* Verde, e não o dourado institucional: o dourado é identidade, não
         estado. Concessão de benefício é notícia boa, e o badge diz isso
         antes de a pessoa ler o texto. */
      "<div style='display:inline-block;background:rgba(16,185,129,.18);" +
        "border:1px solid rgba(52,211,153,.42);color:#6ee7b7;font-size:11px;" +
        "font-weight:800;padding:5px 14px;border-radius:999px;" +
        "text-transform:uppercase;'>Bolsa de Estudo</div>" +
    "</div>" +

    /* ── CORPO ── */
    "<div style='background:#fff;padding:28px 28px 24px;border:1px solid #e2e8f0;border-top:none;'>" +
      "<p style='margin:0 0 18px 0;font-size:14px;color:#334155;'>" + saudacao + " Tudo bem?</p>" +

      "<div style='text-align:justify;line-height:1.7;font-size:13.5px;color:#1a2233;'>" +
        "Seu <strong>Certificado de Bolsa de Estudo</strong> foi emitido pelo SindEducação-ES, " +
        "nos termos da Convenção Coletiva de Trabalho vigente, e segue " +
        (d.linkPdf ? "<strong>anexo a este e-mail</strong>" : "em anexo") + "." +
      "</div>" +

      "<table role='presentation' cellpadding='0' cellspacing='0' " +
        "style='width:100%;background:#f8fafc;border:1px solid #cbd5e1;" +
        "border-radius:10px;padding:6px 16px;margin:20px 0;border-collapse:separate;'>" +
        linha("Curso", d.curso) +
        linha("Período", d.periodo) +
        linha("Desconto", d.percentual ? d.percentual + "%" : "") +
        linha("Código de validação", d.codigo, true) +
      "</table>" +

      (d.linkPdf
        ? "<div style='text-align:center;margin:24px 0 20px;'>" +
            "<a href='" + esc(d.linkPdf) + "' style='background:#001f4d;color:#fff;" +
            "text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:800;" +
            "font-size:14px;display:inline-block;'>Abrir o certificado</a>" +
          "</div>"
        : "") +

      "<div style='margin:20px 0 0;padding:14px 16px;background:#eff6ff;" +
        "border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;" +
        "font-size:13px;color:#1e3a8a;line-height:1.65;'>" +
        "<strong>Apresente o certificado à instituição de ensino</strong> para que o desconto " +
        "seja aplicado na matrícula, rematrícula e mensalidades." +
      "</div>" +
    "</div>" +

    /* ── RODAPÉ ── */
    "<div style='background:linear-gradient(135deg,#001228 0%,#001f4d 60%,#002f6c 100%);" +
      "border-radius:0 0 8px 8px;padding:22px 28px;text-align:center;'>" +
      "<div style='height:3px;background:linear-gradient(90deg,#C9A84C,#f0c843,#C9A84C);" +
        "margin-bottom:18px;'></div>" +
      "<div style='font-size:16px;font-weight:900;color:#fff;'>MARCELHA ALINE PINTO GOMES</div>" +
      "<div style='font-size:12px;color:#C9A84C;font-weight:700;margin-top:3px;'>" +
        "Administrativo &amp; Secretaria — SindEducação-ES</div>" +
      "<div style='margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.10);" +
        "font-size:11px;color:rgba(255,255,255,.75);line-height:1.7;'>" +
        "Av. Nossa Senhora dos Navegantes, 755 - Salas 707/708<br>" +
        "Enseada do Suá - Vitória/ES - CEP 29.050-355<br>" +
        "(27) 99735-8900 • secretaria@sindeducacao.com • www.sindeducacao.com.br" +
      "</div>" +
      "<div style='margin-top:12px;font-size:10px;color:rgba(255,255,255,.25);'>" +
        "Documento gerado pelo SISGEP · SindEducação-ES</div>" +
    "</div>" +
  "</div>";
}

/** Extrai o id do arquivo de uma URL do Drive, para poder anexar o blob. */
function voucherIdDoLink_(url) {
  var m = String(url || "").match(/[-\w]{25,}/);
  return m ? m[0] : "";
}

/**
 * Registra o envio na trilha de auditoria.
 *
 * Não cria aba nova: usa a trilha que o projeto já tem. Uma aba
 * "Voucher_Envios" seria um terceiro lugar para procurar histórico, e o
 * Histórico 360° já vai ler da trilha.
 *
 * A FUNÇÃO CHAMADA É auditar_, NÃO "auditoriaRegistrar".
 *
 * Escrevi este arquivo chamando auditoriaRegistrar, que não existe em lugar
 * nenhum do projeto — o nome saiu de suposição, não de leitura. E o defeito
 * era do tipo que não aparece: a guarda `typeof ... !== "function"` devolvia
 * false calada, o e-mail saía normalmente e o rastro simplesmente não era
 * gravado. Ninguém descobriria antes de precisar provar que enviou.
 *
 * A trilha real é auditar_(dados) — AuditoriaCore.gs:133. Ela NUNCA lança, e
 * cai para a planilha de reserva quando o Firestore não está configurado.
 */
function voucherRegistrarEnvio_(protocolo, canal, destino, sessao) {
  /* A anotação na linha vem ANTES da auditoria e fora do try dela de
   * propósito: são dois registros independentes, e uma auditoria indisponível
   * não pode levar junto a data de envio que fica à vista de quem abre a
   * planilha. */
  voucherAnotarEnvioNaObservacao_(protocolo, canal, destino, sessao);

  try {
    if (typeof auditar_ !== "function") return false;
    var r = auditar_({
      modulo: "Benefícios",
      submodulo: "Certificado de Bolsa",
      acao: canal === "EMAIL" ? "ENVIAR_EMAIL" : "ABRIR_WHATSAPP",
      registroId: String(protocolo || ""),
      valorNovo: destino || canal,
      documento: String(protocolo || ""),
      sessao: sessao || {}
    });
    return !!(r && r.ok);
  } catch (e) {
    Logger.log("Registro do envio falhou (o envio em si foi feito): " + e.message);
    return false;
  }
}

/**
 * Carimba a DATA DO ENVIO nas Observações da própria solicitação.
 *
 * Pedido do usuário em 13/08/2026: "tem que salvar em observações a data de
 * envio do voucher".
 *
 * POR QUE NÃO BASTAVA A AUDITORIA. O envio já era registrado lá, e o modal
 * de envio já mostrava o histórico — mas só o modal. Quem abre a planilha,
 * quem exporta a lista, quem confere no fim do mês, quem atende no telefone
 * o associado perguntando "vocês mandaram?" não vê a auditoria. A linha da
 * solicitação é o lugar onde essa pergunta é feita, e era o único lugar que
 * não tinha a resposta.
 *
 * ACRESCENTA, NUNCA SUBSTITUI. As observações são texto que a secretaria
 * escreveu — o que o e-mail do associado dizia, o que ficou combinado. Um
 * carimbo automático que apagasse aquilo destruiria informação que ninguém
 * tem de onde recuperar. Cada envio vira mais uma linha, e reenvio aparece
 * como mais um carimbo, que é exatamente o que se quer enxergar.
 *
 * WHATSAPP DIZ "ABERTO", não "enviado": o sistema abre o link, quem envia é
 * a pessoa, no aplicativo. Afirmar entrega que não se pode confirmar é pior
 * que não registrar nada.
 *
 * Nunca lança. O e-mail já saiu quando isto roda; falhar aqui não pode virar
 * erro na tela de quem enviou com sucesso.
 */
function voucherAnotarEnvioNaObservacao_(protocolo, canal, destino, sessao) {
  var prot = String(protocolo || "").trim();
  if (!prot) return false;

  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    travou = lock.tryLock(10000);

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var linha = voucherLinhaPorProtocolo_(ss, VOUCHER_ABA_SOLICITACOES, prot);
    if (!linha || !linha.__linha) return false;

    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });
    var iObs = cab.indexOf("OBSERVACOES");
    if (iObs === -1) return false;

    var quando = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
    var quem = (sessao && (sessao.email || sessao.usuario || sessao.nome)) || "";
    var ehEmail = String(canal || "").toUpperCase().indexOf("EMAIL") > -1;

    var carimbo = (ehEmail ? "Enviado por e-mail em " : "WhatsApp aberto em ") + quando +
      (destino ? " para " + destino : "") +
      (quem ? " por " + quem : "") + ".";

    var atual = String(sh.getRange(linha.__linha, iObs + 1).getValue() || "").trim();
    sh.getRange(linha.__linha, iObs + 1).setValue(atual ? atual + "\n" + carimbo : carimbo);
    return true;

  } catch (e) {
    Logger.log("Carimbo do envio nas observações falhou (o envio foi feito): " + e.message);
    return false;
  } finally {
    if (travou) lock.releaseLock();
  }
}

/**
 * O que já foi enviado deste protocolo, para o modal não repetir sem avisar.
 *
 * Lê por aud_consultar_, e não por auditoriaConsultar, porque esta última
 * exige o módulo AUDITORIA — que quem emite certificado normalmente não tem.
 * Com ela, a lista voltava vazia para o usuário comum, sem erro visível, e o
 * modal dizia "nunca enviado" sobre um protocolo já enviado três vezes.
 *
 * O filtro por modulo + registroId é o que mantém a leitura presa ao
 * protocolo que a pessoa já tem direito de ver: voucherPrepararEnvio, único
 * chamador, já passou por exigirModulo_("beneficios").
 */
function voucherEnviosAnteriores_(ss, protocolo) {
  try {
    if (typeof aud_consultar_ !== "function") return [];
    var r = aud_consultar_({ modulo: "Benefícios", registroId: String(protocolo || ""), limite: 200 });
    var lista = (r && r.acoes) || [];
    return lista
      .filter(function (a) { return /ENVIAR_EMAIL|ABRIR_WHATSAPP/.test(String(a.acao || "")); })
      .map(function (a) {
        return {
          /* Mesma razão do emitidoEm: Date no pacote é risco de resposta
             nula e silenciosa. Sai como texto. */
          quando: voucherDataTexto_(a.dataHora),
          canal: a.acao,
          /* A reserva grava valorNovo com JSON.stringify, então o endereço
           * volta entre aspas. Tirar aqui evita "cc \"x@y.com\"" na tela. */
          destino: String(a.valorNovo == null ? "" : a.valorNovo).replace(/^"|"$/g, ""),
          quem: a.usuario
        };
      });
  } catch (e) {
    Logger.log("Histórico de envios do voucher falhou: " + e.message);
    return [];
  }
}
