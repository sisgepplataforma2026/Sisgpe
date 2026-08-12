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
function voucherPrepararEnvio(protocolo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
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
    var periodo = String(solic.PERIODO_REFERENCIA || "").trim();
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
      emitidoEm: emissao.DATA_EMISSAO || "",
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
  exigirModulo_(tokenSessao, "beneficios", false);
  opcoes = opcoes || {};
  try {
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
      para + (copia ? " (cc " + copia + ")" : ""), tokenSessao);

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
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var r = voucherRegistrarEnvio_(String(protocolo || "").trim(), "WHATSAPP_ABERTO", "", tokenSessao);
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

function voucherCorpoEmail_(d) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  return "" +
    "<div style='font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827;'>" +
    "<div style='background:#002f6c;padding:22px;border-radius:12px 12px 0 0;text-align:center;'>" +
      "<div style='color:#C9A84C;font-size:20px;font-weight:900;'>SindEducação-ES</div>" +
    "</div>" +
    "<div style='background:#fff;padding:26px;border:1px solid #e2e8f0;border-top:none;line-height:1.7;'>" +
      "<p>Olá <strong>" + esc(d.nome) + "</strong>,</p>" +
      "<p>Seu <strong>Certificado de Bolsa de Estudo</strong> foi emitido" +
        (d.curso ? " para o curso de <strong>" + esc(d.curso) + "</strong>" : "") +
        (d.periodo ? " (" + esc(d.periodo) + ")" : "") + "." +
      "</p>" +
      (d.percentual ? "<p>Desconto concedido: <strong>" + esc(d.percentual) + "%</strong></p>" : "") +
      "<div style='background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:18px 0;'>" +
        "<div style='font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;'>Protocolo</div>" +
        "<div style='font-weight:800;font-size:15px;'>" + esc(d.protocolo) + "</div>" +
        (d.codigo
          ? "<div style='font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:10px;'>Código de validação</div>" +
            "<div style='font-weight:800;font-size:15px;letter-spacing:.08em;'>" + esc(d.codigo) + "</div>"
          : "") +
      "</div>" +
      (d.linkPdf
        ? "<p style='text-align:center;margin:22px 0;'>" +
          "<a href='" + esc(d.linkPdf) + "' style='background:#002f6c;color:#fff;text-decoration:none;" +
          "padding:12px 26px;border-radius:8px;font-weight:800;display:inline-block;'>Abrir o certificado</a></p>"
        : "") +
      "<p style='font-size:13px;color:#475569;'>Apresente o certificado à instituição de ensino para " +
      "que o desconto seja aplicado na matrícula, rematrícula e mensalidades.</p>" +
    "</div>" +
    "<div style='padding:14px;font-size:11px;color:#64748b;text-align:center;line-height:1.6;'>" +
      esc(typeof ENDERECO_SIND_V !== "undefined" ? ENDERECO_SIND_V : "") + "<br>" +
      esc(typeof TELEFONE_SIND_V !== "undefined" ? TELEFONE_SIND_V : "") +
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
 */
function voucherRegistrarEnvio_(protocolo, canal, destino, tokenSessao) {
  try {
    if (typeof auditoriaRegistrar !== "function") return false;
    auditoriaRegistrar({
      modulo: "Benefícios",
      submodulo: "Certificado de Bolsa",
      acao: canal === "EMAIL" ? "ENVIAR_EMAIL" : "ABRIR_WHATSAPP",
      registroId: protocolo,
      valorNovo: destino || canal,
      resultado: "OK"
    }, tokenSessao);
    return true;
  } catch (e) {
    Logger.log("Registro do envio falhou (o envio em si foi feito): " + e.message);
    return false;
  }
}

/** O que já foi enviado deste protocolo, para o modal não repetir sem avisar. */
function voucherEnviosAnteriores_(ss, protocolo) {
  try {
    if (typeof auditoriaConsultar !== "function") return [];
    var r = auditoriaConsultar({ modulo: "Benefícios", limite: 200 });
    var lista = (r && r.acoes) || [];
    return lista
      .filter(function (a) {
        return String(a.registroId || "") === protocolo &&
               /ENVIAR_EMAIL|ABRIR_WHATSAPP/.test(String(a.acao || ""));
      })
      .map(function (a) {
        return { quando: a.dataHora, canal: a.acao, destino: a.valorNovo, quem: a.usuario };
      });
  } catch (e) {
    return [];
  }
}
