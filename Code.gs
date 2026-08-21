// ============================================================================
// ARQUIVO: Code.gs
// ROTEAMENTO CENTRAL DO WEBAPP SISGEP
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

    var template = HtmlService.createTemplateFromFile("index");
    template.tokenSessao = sessao.token;
    return template.evaluate()
      .setTitle("Portal Administrativo — SindEducação-ES")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (erro) {
    Logger.log("Erro no doPost SISGEP: " + erro);
    return HtmlService.createHtmlOutput("<h2>Não foi possível abrir o SISGEP.</h2><p>Atualize a página e tente novamente.</p>")
      .setTitle("SISGEP — Erro");
  }
}

function doGet(e) {
  try {
    e = e || {};
    var p = e.parameter || {};
    Logger.log("[DIAGNOSTICO doGet] parâmetros recebidos: " + Object.keys(p).join(", "));

    // ── PORTAIS PÚBLICOS ────────────────────────────────────────────────────
    if (p.portal === "associado") {
      Logger.log("[PORTAL] Portal do Associado");
      return servirPortalAssociado(p);
    }
    if (p.portal === "voucher") {
      return HtmlService.createHtmlOutputFromFile("PortalVoucher")
        .setTitle("SindEducação-ES — Solicitação de Voucher")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.portal === "chinapark") {
      return HtmlService.createHtmlOutputFromFile("ReservaParqueChina")
        .setTitle("SindEducação-ES — Reserva Parque do China")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.portal === "chinapark-hospedes") {
      return HtmlService.createHtmlOutputFromFile("ParqueChinaHospedes")
        .setTitle("SindEducação-ES — Hóspedes da reserva")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.portal === "oftalmo") {
      return HtmlService.createHtmlOutputFromFile("AgendaOftalmoPublica")
        .setTitle("SindEducação-ES — Agendamento de Oftalmologia")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── INGRESSO PÚBLICO DO COMPASSO: por token, sem login ──────────────────
    // O associado não tem conta no SISGEP. O que ele recebe por e-mail e por
    // WhatsApp é este link, e o token HMAC É a credencial: quem tem vê aquele
    // ingresso e só aquele; quem não tem vê a mesma página de "não encontrado"
    // que qualquer chute veria.
    //
    // Esta rota MOSTRA. Ela NÃO faz check-in — ver não é entrar. Se abrir o
    // link consumisse o ingresso, quem conferisse o próprio ingresso em casa
    // chegaria na portaria com ele já utilizado.
    //
    // Toda a validação está em EventosEntrega.gs
    // (compasso_validarQrTokenPublico_). Esta rota só entrega a página.
    if (p.page === "ingresso") {
      Logger.log("[COMPASSO] Ingresso publico por token");
      return compasso_paginaIngressoPublica_(String(p.t || ""));
    }

    // ── BINGO PÚBLICO: INSCRIÇÃO, sem login ─────────────────────────────────
    // Vem ANTES da rota da cartela de propósito: `p.bingo` e
    // `p["bingo-inscricao"]` são parâmetros distintos, mas quem lê o código
    // depois entende melhor a ordem inscrição → cartela, que é a do fluxo.
    // Toda a validação (teto de 300, prazo, CPF, termo) está no servidor, em
    // BingoInscricao.gs. Esta rota só entrega a página.
    if (p["bingo-inscricao"]) {
      Logger.log("[BINGO] Inscricao publica");
      return HtmlService.createHtmlOutputFromFile("BingoInscricaoPublica")
        .setTitle("Inscrição — Bingo Online — SindEducação-ES")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── BINGO PÚBLICO: cartela por token, sem login ─────────────────────────
    if (p.bingo) {
      Logger.log("[BINGO] Cartela pública por token");
      return HtmlService.createHtmlOutputFromFile("BingoAssociado")
        .setTitle("Bingo Online — SindEducação")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── PAINÉIS PROTEGIDOS DE EVENTOS ───────────────────────────────────────
    if (p.painel === "emissao") {
      var tokenEmissao = String(p.sessao || "").trim();
      var sessaoEmissao = getSessaoUsuario(tokenEmissao);
      if (!sessaoEmissao) return HtmlService.createHtmlOutputFromFile("Login").setTitle("SISGEP — Login").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setSandboxMode(HtmlService.SandboxMode.IFRAME);
      return HtmlService.createHtmlOutputFromFile("EventoPainel")
        .setTitle("Emissão de Ingressos — Compasso da Vida")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.painel === "checkin") {
      var tokenCheckin = String(p.sessao || "").trim();
      var sessaoCheckin = getSessaoUsuario(tokenCheckin);
      if (!sessaoCheckin) return HtmlService.createHtmlOutputFromFile("Login").setTitle("SISGEP — Login").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setSandboxMode(HtmlService.SandboxMode.IFRAME);
      return HtmlService.createHtmlOutputFromFile("EventoCheckin")
        .setTitle("Check-in — Compasso da Vida")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.painel === "bingo") {
      var tokenBingo = String(p.sessao || "").trim();
      var sessaoBingo = getSessaoUsuario(tokenBingo);
      if (!sessaoBingo) return HtmlService.createHtmlOutputFromFile("Login").setTitle("SISGEP — Login").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setSandboxMode(HtmlService.SandboxMode.IFRAME);
      exigirModulo_(tokenBingo, "eventos", false);
      return HtmlService.createHtmlOutputFromFile("BingoAdmin")
        .setTitle("Bingo Online — SISGEP")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.painel === "bingo-telao") {
      var tokenTelao = String(p.sessao || "").trim();
      var sessaoTelao = getSessaoUsuario(tokenTelao);
      if (!sessaoTelao) return HtmlService.createHtmlOutputFromFile("Login").setTitle("SISGEP — Login").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setSandboxMode(HtmlService.SandboxMode.IFRAME);
      exigirModulo_(tokenTelao, "eventos", false);
      return HtmlService.createHtmlOutputFromFile("BingoTelao")
        .setTitle("Bingo Online — Telão")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── FICHA PÚBLICA DE SINDICALIZAÇÃO ────────────────────────────────────
    if (p.ficha === "sindicalizacao") {
      return servirFichaSindicalizacao(p);
    }

    // ── RASTREAMENTO ────────────────────────────────────────────────────────
    if (p.track === "open" && p.id) {
      registrarAberturaOficio_(p.id);
      return pixelTransparente_();
    }
    if (p.page === "pub-pixel-nf" && p.t) {
      despesas_registrarLeituraEmail(p.t);
      guiasPagamento_registrarLeituraEmail(p.t);
      return pixelTransparente_();
    }

    // ── PORTAIS PÚBLICOS FINANCEIROS ───────────────────────────────────────
    if (p.page === "pub-nf-despesa" && p.token) {
      var templateNF = HtmlService.createTemplateFromFile("PubNFDespesa");
      templateNF.token = p.token;
      return templateNF.evaluate()
        .setTitle("Envio de Documento Fiscal — SindEducação-ES")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }
    if (p.page === "pub-contabil-despesa" && p.token) {
      return HtmlService.createHtmlOutputFromFile("PubContabilDespesa")
        .setTitle("Confirmação de Pagamento — SindEducação-ES")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── RECUPERAÇÃO DE SENHA ────────────────────────────────────────────────
    if (p.recuperar) {
      return HtmlService.createHtmlOutputFromFile("Login")
        .setTitle("SISGEP — Recuperar senha")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    // ── VALIDAÇÕES PÚBLICAS ─────────────────────────────────────────────────
    if (p.codigo) return validarPublico(p.codigo);
    if (p.credencial) return validarCarteirinhaPublico(p.credencial);

    // ── SISTEMA ADMINISTRATIVO ──────────────────────────────────────────────
    var tokenSessao = String(p.sessao || "").trim();
    Logger.log("[DIAGNOSTICO doGet] sessão recebida: " + (tokenSessao ? "sim" : "não"));
    var sessao = getSessaoUsuario(tokenSessao);
    Logger.log("[DIAGNOSTICO doGet] sessão válida: " + !!sessao);

    if (!sessao) {
      return HtmlService.createHtmlOutputFromFile("Login")
        .setTitle("SISGEP — Login")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    var template = HtmlService.createTemplateFromFile("index");
    template.tokenSessao = sessao.token;
    return template.evaluate()
      .setTitle("Portal Administrativo — SindEducação-ES")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (erro) {
    Logger.log("Erro no doGet SISGEP: " + erro);
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif;padding:40px;background:#fff;color:#111;'>" +
      "<h2 style='color:#c00;'>Erro ao abrir o SISGEP</h2>" +
      "<pre style='white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px;'>" +
      (erro && erro.stack ? erro.stack : (erro && erro.message ? erro.message : String(erro))) +
      "</pre></div>")
      .setTitle("Erro — SISGEP")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function include(nomeArquivo) {
  try {
    var conteudo = HtmlService.createTemplateFromFile(nomeArquivo).evaluate().getContent();

    /* Piloto SOFIA · AgentEscolas v0.1 — trazido de
       claude/sisgep-project-analysis-h9wcy3 em 21/08/2026.

       A extensão visual fica ISOLADA, acoplada aqui em vez de dentro do
       CadastroEscolas, para que a tela principal de Escolas permaneça intacta
       e o rollback seja apenas remover este bloco.

       O try/catch interno é o que importa: uma falha da extensão NÃO pode
       derrubar o módulo de Escolas, que atende as 679 escolas da base. Se o
       SofiaEscolasUI não carregar, a tela abre sem ele e o erro fica no log. */
    if (String(nomeArquivo || "") === "CadastroEscolas") {
      try {
        conteudo += "\n" + HtmlService
          .createTemplateFromFile("SofiaEscolasUI")
          .evaluate()
          .getContent();
      } catch (eSofiaEscolas) {
        Logger.log("include: SofiaEscolasUI não carregada — " + eSofiaEscolas.message);
      }
    }

    return conteudo;
  } catch (e) {
    Logger.log("include: arquivo não encontrado — " + nomeArquivo + " — " + e.message);
    return "<!-- include falhou: " + nomeArquivo + " -->";
  }
}

function servirFichaSindicalizacao(p) {
  try {
    return HtmlService.createHtmlOutputFromFile("Fichasindicalizacao")
      .setTitle("Ficha de Sindicalização — SindEducação/ES")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (erro) {
    Logger.log("servirFichaSindicalizacao: " + erro);
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif;padding:40px;text-align:center;'>" +
      "<h2>Não foi possível abrir a ficha</h2>" +
      "<p>Tente novamente em alguns instantes ou procure o SindEducação/ES.</p></div>")
      .setTitle("Ficha de Sindicalização");
  }
}