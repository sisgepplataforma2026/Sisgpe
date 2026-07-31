// ============================================================================
// ARQUIVO: Code.gs
// VERSÃO ATUALIZADA COM ROTEAMENTO DO PORTAL DO ASSOCIADO
// ============================================================================
function doPost(e) {
  try {
    e = e || {};
    var p = e.parameter || {};
    var acao = String(p.acao || "");
    if (["abrirSessao", "loginDireto"].indexOf(acao) === -1) return doGet(e);

    var token = "";

    if (acao === "loginDireto") {
      var autenticacao = autenticarUsuario(String(p.usuario || ""), String(p.senha || ""));
      Logger.log("[DIAGNOSTICO doPost] autenticação concluída: " + !!(autenticacao && autenticacao.ok));

      if (!autenticacao || !autenticacao.ok || autenticacao.primeiroAcesso) {
        return HtmlService.createHtmlOutputFromFile("Login")
          .setTitle("SISGEP — Login")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .setSandboxMode(HtmlService.SandboxMode.IFRAME);
      }

      token = String(autenticacao.token || "").trim();

      Logger.log("[DIAGNOSTICO doPost] sessão recebida: " + (token ? "sim" : "não"));
    } else {
      token = String(p.sessao || "").trim();
    }

    var sessao = getSessaoUsuario(token);

    if (!sessao) {
      return HtmlService.createHtmlOutputFromFile("Login")
        .setTitle("SISGEP — Login")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // Serve o sistema direto nesta mesma resposta do POST — sem redirect
    // via JavaScript. O redirect anterior (window.location.replace) era
    // bloqueado pelo navegador por rodar sem gesto do usuário dentro de
    // um iframe sandboxed — por isso o login validava e voltava sozinho
    // pro Login (ou dava tela branca).
    var template = HtmlService.createTemplateFromFile("index");
    template.tokenSessao = sessao.token;

    return template
      .evaluate()
      .setTitle("Portal Administrativo — SindEducação-ES")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  } catch (erro) {
    Logger.log("Erro no doPost SISGEP-OFICIOS: " + erro);
    return HtmlService.createHtmlOutput("<h2>Não foi possível abrir o SISGEP.</h2><p>Atualize a página e tente novamente.</p>").setTitle("SISGEP — Erro");
  }
}

function doGet(e) {
  try {
    e = e || {};
    var p = e.parameter || {};

    Logger.log("[DIAGNOSTICO doGet] parâmetros recebidos: " + Object.keys(p).join(", "));

    // ── NOVO: Rota do Portal do Associado (MEU SINDEDUCAÇÃO) ──
    // Deve vir ANTES da verificação de sessão de administrador
if (p.portal === "associado") {
      Logger.log("[PORTAL] Redirecionando para o Portal do Associado");
      return servirPortalAssociado(p);
    }

    // ── Portal público de solicitação de Voucher (Bolsa de Estudo) ──
    // Público, sem sessão — o próprio formulário pede CPF + data de nascimento.
    if (p.portal === "voucher") {
      Logger.log("[PORTAL] Redirecionando para o Portal de Voucher");
      return HtmlService.createHtmlOutputFromFile("PortalVoucher")
        .setTitle("SindEducação-ES — Solicitação de Voucher")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Portal público de solicitação de reserva do Parque do China ──
    // Público, sem sessão — solicitarReservaParqueChina (Reservaparquechina.gs)
    // já é uma função pública, chamada direto por este formulário; a reserva
    // nasce PENDENTE e a equipe aprova pelo painel administrativo.
    if (p.portal === "chinapark") {
      Logger.log("[PORTAL] Redirecionando para o Portal do Parque do China");
      return HtmlService.createHtmlOutputFromFile("ReservaParqueChina")
        .setTitle("SindEducação-ES — Reserva Parque do China")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Portal público de agendamento de Oftalmologia ──
    // Público, sem sessão — só funciona quando a equipe libera uma data
    // (AgendOftalmo.html, "Data liberada para o Portal"). Sem data liberada,
    // a própria página avisa que não há atendimento no momento.
    if (p.portal === "oftalmo") {
      Logger.log("[PORTAL] Redirecionando para o Portal de Oftalmologia");
      return HtmlService.createHtmlOutputFromFile("AgendaOftalmoPublica")
        .setTitle("SindEducação-ES — Agendamento de Oftalmologia")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
// ── Rota da tela de Emissão de Ingressos (Eventos) — protegida por sessão ──
    if (p.painel === "emissao") {
      var tokenEmissao = String(p.sessao || "").trim();
      var sessaoEmissao = getSessaoUsuario(tokenEmissao);
      if (!sessaoEmissao) {
        return HtmlService.createHtmlOutputFromFile("Login")
          .setTitle("SISGEP — Login")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .setSandboxMode(HtmlService.SandboxMode.IFRAME);
      }
      return HtmlService.createHtmlOutputFromFile("EventoPainel")
        .setTitle("Emissão de Ingressos — Compasso da Vida")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    // ── Rota pública: Ficha de Sindicalização (QR Code das visitas) ──
    // Precisa vir ANTES da checagem de sessão: o trabalhador na escola
    // não tem login no SISGEP.
    if (p.ficha === "sindicalizacao") {
      Logger.log("[FICHA] Servindo ficha de sindicalização. Visita: " +
        (p.idVisita || "(sem visita)"));
      return servirFichaSindicalizacao(p);
    }

    // ── Rastreamento de abertura de e-mail/ofício ──
    if (p.track === "open" && p.id) {
      registrarAberturaOficio_(p.id);
      return pixelTransparente_();
    }

    // ── Rastreamento de abertura de e-mail (despesas / guias de NF) ──
    // As duas funções só agem se o token pertencer ao seu próprio prefixo
    // (PIXEL_DOC_ ou LEITURA_NF_), então é seguro chamar as duas aqui.
    if (p.page === "pub-pixel-nf" && p.t) {
      despesas_registrarLeituraEmail(p.t);
      guiasPagamento_registrarLeituraEmail(p.t);
      return pixelTransparente_();
    }

    // ── Portal público do Fornecedor: envio de nota fiscal/recibo de despesa ──
    // Mesmo problema da rota da contabilidade abaixo: o link já era enviado
    // nos e-mails de D-5/D-3/D-1 pedindo a NF, mas essa rota nunca tinha
    // sido cadastrada aqui — o link do fornecedor nunca abria nada.
    // PubNFDespesa.html injeta o token via template scriptlet (<?= token ?>).
    if (p.page === "pub-nf-despesa" && p.token) {
      var templateNF = HtmlService.createTemplateFromFile("PubNFDespesa");
      templateNF.token = p.token;
      return templateNF.evaluate()
        .setTitle("Envio de Documento Fiscal — SindEducação-ES")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Portal público da Contabilidade: confirmação de pagamento de despesa ──
    // Link enviado no e-mail de "Enviar à Contabilidade" — sem login, o
    // próprio token identifica a despesa. Rota nunca tinha sido cadastrada
    // aqui, então o link enviado por e-mail nunca abria nada.
    // PubContabilDespesa.html lê o token da URL no próprio cliente.
    if (p.page === "pub-contabil-despesa" && p.token) {
      return HtmlService.createHtmlOutputFromFile("PubContabilDespesa")
        .setTitle("Confirmação de Pagamento — SindEducação-ES")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Tela de redefinição de senha via link de recuperação ──
    var temTokenRecuperacao = p.recuperar;

    if (temTokenRecuperacao) {
      Logger.log("[DIAGNOSTICO doGet] indo para fluxo de recuperacao de senha");
      return HtmlService
        .createHtmlOutputFromFile("Login")
        .setTitle("SISGEP — Recuperar senha")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Rota pública: validação de autenticidade de ofício (link/QR impresso no PDF) ──
    // Precisa vir ANTES da checagem de sessão: quem valida é a escola/associado
    // que recebeu o documento, sem login no SISGEP.
    if (p.codigo) {
      Logger.log("[VALIDACAO] Validando código público de ofício.");
      return validarPublico(p.codigo);
    }

    // ── Checa sessão — token vem explicitamente da URL (?sessao=token) ──
    var tokenSessao = String(p.sessao || "").trim();
    Logger.log("[DIAGNOSTICO doGet] sessão recebida: " + (tokenSessao ? "sim" : "não"));

    var sessao = getSessaoUsuario(tokenSessao);
    Logger.log("[DIAGNOSTICO doGet] sessão válida: " + !!sessao);

    if (!sessao) {
      Logger.log("[DIAGNOSTICO doGet] sessao NULA -> servindo tela de Login");
      return HtmlService
        .createHtmlOutputFromFile("Login")
        .setTitle("SISGEP — Login")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── Usuário autenticado: serve o sistema normalmente ──
    Logger.log("[DIAGNOSTICO doGet] sessao valida -> servindo index.html para: " + sessao.nome);
    var template = HtmlService.createTemplateFromFile("index");
    template.tokenSessao = sessao.token;

    return template
      .evaluate()
      .setTitle("Portal Administrativo — SindEducação-ES")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  } catch (erro) {
    Logger.log("Erro no doGet SISGEP-OFICIOS: " + erro);

    return HtmlService
      .createHtmlOutput(
        "<div style='font-family:sans-serif;padding:40px;background:#fff;color:#111;'>" +
        "<h2 style='color:#c00;'>Erro ao abrir o módulo de Ofícios</h2>" +
        "<pre style='white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px;'>" +
        (erro && erro.stack ? erro.stack : (erro && erro.message ? erro.message : String(erro))) +
        "</pre>" +
        "</div>"
      )
      .setTitle("Erro — SISGEP Ofícios")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}
function include(nomeArquivo) {
  try {
    return HtmlService
      .createTemplateFromFile(nomeArquivo)
      .evaluate()
      .getContent();
  } catch (e) {
    Logger.log("include: arquivo não encontrado — " + nomeArquivo + " — " + e.message);
    return "<!-- include falhou: " + nomeArquivo + " -->";
  }
}
/**
 * Serve a Ficha de Sindicalização pública (acesso sem login).
 * Os parâmetros da visita (idVisita, diretorBase, escola) são lidos no
 * cliente via google.script.url — por isso o arquivo é servido como
 * HtmlOutput simples, sem template.
 *
 * addMetaTag('viewport') é obrigatório: o GAS remove as meta tags do
 * HTML original, e sem isso o formulário fica minúsculo no celular.
 */
function servirFichaSindicalizacao(p) {
  try {
    return HtmlService
      .createHtmlOutputFromFile("Fichasindicalizacao")
      .setTitle("Ficha de Sindicalização — SindEducação/ES")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (erro) {
    Logger.log("servirFichaSindicalizacao: " + erro);
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif;padding:40px;text-align:center;'>" +
      "<h2>Não foi possível abrir a ficha</h2>" +
      "<p>Tente novamente em alguns instantes ou procure o SindEducação/ES.</p>" +
      "</div>").setTitle("Ficha de Sindicalização");
  }
}