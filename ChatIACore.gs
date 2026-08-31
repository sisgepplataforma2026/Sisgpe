// ================================================================
// ARQUIVO: ChatIACore.gs — v2.0
// Chat SISGEP — Agente Central de IA
// v2.0: + CCT 2026/2027, + emails de escolas, + contexto rico
// ================================================================

var CHAT_MODEL_ = "claude-haiku-4-5-20251001";
var CHAT_MAX_TOKENS_ = 1500;

/* ═══════════════════════════════════════════════════════
   TEXTO DA CCT 2026/2027 — CLÁUSULAS RELEVANTES
   Vigência: 01/03/2026 a 28/02/2027
═══════════════════════════════════════════════════════ */
// CCT carregada via CCTCore.gs — getCCTTexto_()

/* ═══════════════════════════════════════════════════════
   ENTRADA PRINCIPAL
═══════════════════════════════════════════════════════ */
function chatSISGEP(payload, tokenSessao) {
  /* PERMISSÃO — auditoria do Módulo 02, 31/08/2026.
     O chat lê mensalidades, escolas e painéis de benefícios e devolve isso em
     texto. Passava só por exigirSessaoDocumentos_: qualquer sessão válida
     conversava, mesmo sem nenhum módulo relacionado marcado. O catálogo de
     acesso tem a chave "sofia" justamente para poder controlar isto.

     FORA do try, de propósito. Dentro, o catch devolvia
     { ok:false, resposta:"Erro interno: ..." } — e negar acesso não é erro
     interno: é resposta esperada do sistema. Lançar aqui alinha o chat aos
     outros 398 usos de exigirModulo_ no projeto, e o withFailureHandler da
     tela mostra a mensagem certa. */
  var sessao = exigirModulo_(tokenSessao, "sofia", false);

  try {
    payload = payload || {};
    var mensagem = String(payload.mensagem || "").trim();
    var historico = Array.isArray(payload.historico) ? payload.historico : [];
    var dominio = String(payload.dominio || "Geral").trim();

    if (!mensagem) return { ok: false, resposta: "Mensagem vazia." };

    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, resposta: "Chave da API Anthropic não configurada." };

    var contextoConversa = historico.slice(-4).map(function(h) { return String(h.content || ""); }).join("\n") + "\n" + mensagem;
    var contexto = coletarContextoSISGEP_(contextoConversa, dominio, sessao);
    var systemPrompt = montarSystemPrompt_(contexto, mensagem);

    var messages = [];
    historico.slice(-6).forEach(function(h) {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: String(h.content) });
      }
    });
    messages.push({ role: "user", content: mensagem });

    var requestBody = {
      model: CHAT_MODEL_,
      max_tokens: CHAT_MAX_TOKENS_,
      system: systemPrompt,
      messages: messages
    };

    var perguntar = function (prompt) {
      requestBody.system = prompt;
      var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      });
      return { codigo: resp.getResponseCode(), texto: resp.getContentText() };
    };

    var r1 = perguntar(systemPrompt);
    if (r1.codigo !== 200) {
      Logger.log("chatSISGEP erro API: " + r1.codigo + " — " + r1.texto);
      return { ok: false, resposta: "Erro na comunicação com a IA (código " + r1.codigo + "). Tente novamente." };
    }

    var respJson = JSON.parse(r1.texto);
    var textoResposta = respJson.content && respJson.content[0] ? respJson.content[0].text : "";

    if (!textoResposta) {
      registrarAuditoriaSofia_(sessao, dominio, mensagem, "", false);
      return { ok: false, resposta: "A IA não retornou nenhum conteúdo para esta pergunta. Tente reformular." };
    }

    /* A procedência sai do prompt que foi montado, nunca de um novo cálculo —
     * ver o comentário de fontesDoPrompt_. Se a leitura falhar por qualquer
     * motivo, a resposta segue sem a linha de fonte: melhor a tela calada do
     * que a tela afirmando o que não conferiu. */
    var fontes = [];
    var alertaFonte = "";
    var segundaLeitura = false;
    try {
      fontes = fontesDoPrompt_(systemPrompt);
      alertaFonte = alertaFonteAusente_(textoResposta, fontes);

      /* ── SEGUNDA LEITURA ──────────────────────────────────────────────
       *
       * Avisar "confira antes de usar" é tratar o sintoma. Se a resposta
       * cita artigo ou cláusula, a pergunta ERA sobre o documento — e o
       * documento deveria ter entrado. O usuário disse isso com todas as
       * letras no primeiro dia: *"mas ele deveria ser consultado"*.
       *
       * Então em vez de avisar, o sistema se corrige: anexa o documento que
       * faltou e pergunta de novo. A resposta que vale é a segunda, agora
       * com o texto à vista.
       *
       * POR QUE ISSO NÃO É CARO: só acontece quando a primeira resposta
       * citou algo sem fonte — raro depois do vocabulário mais largo, e
       * exatamente o caso em que uma chamada a mais vale muito mais que uma
       * resposta errada. Nunca há uma terceira: se depois de anexar o
       * documento a resposta continuar citando o que não foi consultado
       * (por exemplo, citando cláusula quando só o Estatuto entrou), aí sim
       * o aviso aparece — porque aí ele é a informação certa. */
      /* Sem `if (alertaFonte)` na frente: a mutação mostrou que a guarda era
       * REDUNDANTE — as condições abaixo são as mesmas que geram o aviso, e
       * o teste continuava verde com ela apagada, como tinha de continuar.
       * Guarda que não guarda nada é linha a mais para alguém entender. */
      var faltou = {};
      var temTipo_ = function (t) {
        for (var i = 0; i < fontes.length; i++) if (fontes[i].tipo === t) return true;
        return false;
      };
      if (citaArtigoProprio_(textoResposta) && !temTipo_("ESTATUTO") &&
          typeof getEstatutoTexto_ === "function") faltou.estatuto = true;
      if (/\bcl[áa]usula/i.test(textoResposta) && !temTipo_("CCT")) faltou.cct = true;

      if (faltou.estatuto || faltou.cct) {
        Logger.log("SOFIA · segunda leitura: anexando " +
          (faltou.estatuto ? "ESTATUTO " : "") + (faltou.cct ? "CCT" : "") +
          " porque a resposta citou sem fonte.");
        var prompt2 = montarSystemPrompt_(contexto, mensagem, faltou);
        var r2 = perguntar(prompt2);
        if (r2.codigo === 200) {
          var json2 = JSON.parse(r2.texto);
          var texto2 = json2.content && json2.content[0] ? json2.content[0].text : "";
          if (texto2) {
            textoResposta = texto2;
            systemPrompt = prompt2;
            fontes = fontesDoPrompt_(prompt2);
            alertaFonte = alertaFonteAusente_(texto2, fontes);
            segundaLeitura = true;
          }
        } else {
          /* Falhou a segunda: fica a primeira resposta COM o aviso. Nunca o
           * contrário — resposta sem fonte e sem aviso é o pior dos mundos. */
          Logger.log("SOFIA · segunda leitura falhou (" + r2.codigo + "); mantida a primeira com aviso.");
        }
      }
    } catch (eFonte) {
      Logger.log("chatSISGEP procedência: " + eFonte.message);
    }

    registrarAuditoriaSofia_(sessao, dominio, mensagem, textoResposta, true);

    return {
      ok: true,
      resposta: textoResposta,
      fontes: fontes,
      alertaFonte: alertaFonte,
      segundaLeitura: segundaLeitura,
      contexto: {
        totalRegistros: contexto.totalRegistros,
        resumo: contexto.resumo,
        dados: contexto.dados
      }
    };

  } catch (e) {
    Logger.log("chatSISGEP erro: " + e.message);
    registrarAuditoriaSofia_(sessao, (payload || {}).dominio, (payload || {}).mensagem, "ERRO: " + e.message, false);
    return { ok: false, resposta: "Erro interno: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   AUDITORIA — registra cada interação com a Sofia
═══════════════════════════════════════════════════════ */
function registrarAuditoriaSofia_(sessao, dominio, mensagem, resposta, ok) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = getOrCreateSheet_(ss, "Sofia_Auditoria");
    ensureHeaders_(aba, ["Data/Hora", "Usuário", "E-mail", "Domínio", "Pergunta", "Resposta", "OK"]);
    aba.appendRow([
      Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      sessao ? (sessao.nome || sessao.usuario || "") : "",
      sessao ? (sessao.email || "") : "",
      String(dominio || "Geral"),
      String(mensagem || "").substring(0, 500),
      String(resposta || "").substring(0, 1000),
      ok === true
    ]);
  } catch (eLog) {
    Logger.log("registrarAuditoriaSofia_ erro: " + eLog.message);
  }
}

/* ═══════════════════════════════════════════════════════
   COLETA CONTEXTO — mensalidades + escolas
═══════════════════════════════════════════════════════ */
function extrairConteudoAnexoIA_(anexo) {
  var nome = anexo.getName() || "anexo";
  var tipo = String(anexo.getContentType() || "").toLowerCase();
  var resultado = { nome: nome, tipo: tipo, tamanho: anexo.getBytes().length, conteudo: "", lido: false };
  var arquivoTemp = null;
  try {
    if (/text|csv|json|xml|html/.test(tipo) || /\.(csv|txt|json|xml)$/i.test(nome)) {
      resultado.conteudo = anexo.getDataAsString("UTF-8").substring(0, 15000);
      resultado.lido = true;
      return resultado;
    }
    if (/spreadsheet|excel|officedocument\.spreadsheetml/.test(tipo) || /\.(xlsx|xls)$/i.test(nome)) {
      arquivoTemp = Drive.Files.insert({ title: "TEMP_SOFIA_" + nome, mimeType: MimeType.GOOGLE_SHEETS }, anexo.copyBlob(), { convert: true });
      var ss = SpreadsheetApp.openById(arquivoTemp.id);
      var partes = [];
      ss.getSheets().slice(0, 5).forEach(function(aba) {
        var valores = aba.getDataRange().getDisplayValues().slice(0, 250);
        partes.push("ABA: " + aba.getName());
        valores.forEach(function(linha) { partes.push(linha.slice(0, 20).join(" | ")); });
      });
      resultado.conteudo = partes.join("\n").substring(0, 30000);
      resultado.lido = true;
    } else if (/pdf/.test(tipo) || /\.pdf$/i.test(nome)) {
      arquivoTemp = Drive.Files.insert({ title: "TEMP_SOFIA_" + nome, mimeType: MimeType.GOOGLE_DOCS }, anexo.copyBlob(), { convert: true, ocr: true, ocrLanguage: "pt" });
      resultado.conteudo = DocumentApp.openById(arquivoTemp.id).getBody().getText().substring(0, 30000);
      resultado.lido = true;
    }
  } catch (e) {
    resultado.erro = "Não foi possível extrair automaticamente: " + e.message;
  } finally {
    if (arquivoTemp && arquivoTemp.id) {
      try { DriveApp.getFileById(arquivoTemp.id).setTrashed(true); } catch (eTrash) {}
    }
  }
  return resultado;
}

/* ═══════════════════════════════════════════════════════
   ANEXO ENVIADO PELA HOME (SOFIA) — upload direto do usuário
═══════════════════════════════════════════════════════ */
function analisarAnexoSofiaHome_(base64, nome, tipo, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    if (!base64) return { ok: false, mensagem: "Nenhum arquivo recebido." };

    var bytes = Utilities.base64Decode(base64);
    if (bytes.length > 12 * 1024 * 1024) {
      return { ok: false, mensagem: "Arquivo maior que 12 MB. Envie um arquivo menor." };
    }

    var blob = Utilities.newBlob(bytes, tipo || "application/octet-stream", nome || "anexo");
    var resultado = extrairConteudoAnexoIA_(blob);

    if (!resultado.lido) {
      return { ok: false, mensagem: resultado.erro || "Não foi possível ler este tipo de arquivo. Tipos aceitos: PDF, Excel, CSV, TXT, JSON, XML." };
    }

    return { ok: true, nome: resultado.nome, conteudo: resultado.conteudo };
  } catch (e) {
    Logger.log("analisarAnexoSofiaHome_ erro: " + e.message);
    return { ok: false, mensagem: "Erro ao processar o arquivo: " + e.message };
  }
}

function buscarEmailsInstitucionaisRecentes_(termo, opcoes) {
  try {
    opcoes = opcoes || {};
    var lerAnexos = opcoes.lerAnexos === true;
    termo = String(termo || "").trim();
    if (!termo) return [];
    var contas = ["financeiro@sindeducacao.com", "secretaria@sindeducacao.com"];
    var consulta = "{from:" + contas[0] + " to:" + contas[0] + " cc:" + contas[0] +
      " from:" + contas[1] + " to:" + contas[1] + " cc:" + contas[1] + "} \"" + termo.replace(/"/g, "") + "\"";
    var threads = GmailApp.search(consulta, 0, lerAnexos ? 10 : 6);
    var mensagens = [];
    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(msg) {
        var de = String(msg.getFrom() || "").toLowerCase();
        var para = String(msg.getTo() || "").toLowerCase();
        var cc = String(msg.getCc() || "").toLowerCase();
        var prioridade = 3;
        if (de.indexOf(contas[0]) >= 0 || para.indexOf(contas[0]) >= 0 || cc.indexOf(contas[0]) >= 0) prioridade = 1;
        else if (de.indexOf(contas[1]) >= 0 || para.indexOf(contas[1]) >= 0 || cc.indexOf(contas[1]) >= 0) prioridade = 2;
        mensagens.push({
          data: msg.getDate().getTime(),
          dataTexto: Utilities.formatDate(msg.getDate(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
          de: msg.getFrom(),
          para: msg.getTo(),
          assunto: msg.getSubject(),
          resumo: String(msg.getPlainBody() || "").replace(/\s+/g, " ").substring(0, 350),
          contaPrioritaria: prioridade === 1 ? contas[0] : contas[1],
          prioridade: prioridade,
          _mensagem: msg
        });
      });
    });
    mensagens.sort(function(a, b) { return b.data - a.data || a.prioridade - b.prioridade; });
    var selecionadas = mensagens.slice(0, lerAnexos ? 6 : 3);
    selecionadas.forEach(function(item, indice) {
      item.anexos = [];
      if (lerAnexos && indice < 1 && item._mensagem) {
        try {
          item.anexos = item._mensagem.getAttachments({ includeInlineImages: false, includeAttachments: true })
            .slice(0, 5).map(extrairConteudoAnexoIA_);
        } catch (eAnexo) {
          item.erroAnexos = eAnexo.message;
        }
      }
      delete item._mensagem;
    });
    return selecionadas;
  } catch (e) {
    Logger.log("buscarEmailsInstitucionaisRecentes_: " + e.message);
    return [];
  }
}


function normalizarCadastroSofia_(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function localizarCadastrosSofia_(mapa, termo) {
  var alvo = normalizarCadastroSofia_(termo);
  if (!alvo) return [];
  var chaves = Object.keys(mapa || {});
  var exatos = chaves.filter(function(k) { return normalizarCadastroSofia_(k) === alvo; });
  if (exatos.length) return exatos.map(function(k) { return mapa[k]; });
  return chaves.filter(function(k) {
    var nk = normalizarCadastroSofia_(k);
    return alvo.length >= 3 && (" " + nk + " ").indexOf(" " + alvo + " ") >= 0;
  }).map(function(k) { return mapa[k]; });
}

function consultarCnpjSofia_(cnpj) {
  var digitos = String(cnpj || "").replace(/\D/g, "");
  if (digitos.length !== 14 || typeof consultarBrasilApiReceita_ !== "function") return null;
  try {
    var cache = CacheService.getScriptCache();
    var chave = "SOFIA_CNPJ_" + digitos;
    var salvo = cache.get(chave);
    if (salvo) return JSON.parse(salvo);
    var dados = consultarBrasilApiReceita_(digitos);
    if (dados) cache.put(chave, JSON.stringify(dados), 21600);
    return dados;
  } catch (e) {
    Logger.log("consultarCnpjSofia_: " + e.message);
    return null;
  }
}

function divergenciasCadastroSofia_(planilha, receita) {
  if (!planilha || !receita) return [];
  var normal = function(v) { return normalizarCadastroSofia_(v).replace(/\s+/g, " "); };
  var apenasDigitos = function(v) { return String(v || "").replace(/\D/g, ""); };
  var lista = [];
  var comparar = function(campo, a, b, tipo) {
    if (!a || !b) return;
    var iguais = tipo === "numero" ? apenasDigitos(a) === apenasDigitos(b) : normal(a) === normal(b);
    if (!iguais) lista.push({ campo: campo, planilha: String(a), receita: String(b) });
  };
  comparar("Razão social", planilha.razaoSocial, receita.razaoSocial);
  comparar("Cidade", planilha.cidade, receita.cidade + (receita.uf ? " - " + receita.uf : ""));
  comparar("Telefone", planilha.telefone, receita.telefone, "numero");
  comparar("E-mail", planilha.email, receita.email);
  return lista;
}

/**
 * PERMISSÃO POR FONTE — auditoria do Módulo 02, 31/08/2026.
 *
 * Ter o módulo "sofia" dava acesso a TUDO que a SOFIA alcança: mensalidades,
 * escolas, benefícios e e-mails institucionais. Quem só devia ver escolas
 * perguntava e recebia situação de mensalidade de gente com nome e escola.
 *
 * A trava é a mesma que o InicioResumo.gs já usa na Home — sessaoPodeModulo_
 * por fonte, e não um portão único na entrada. Precedente da casa, não
 * invenção: lá cada card do Início consulta só o que a sessão pode ver.
 *
 * Sessão AUSENTE fecha tudo, de propósito. Esta função é privada e só o
 * chatSISGEP a chama em produção, sempre com sessão; um chamador novo que
 * esqueça de passá-la recebe contexto vazio em vez de contexto completo. É o
 * erro seguro.
 */
function chatPodeFonte_(sessao, modulo) {
  if (!sessao) return false;
  if (typeof sessaoPodeModulo_ !== "function") return true;
  try { return !!sessaoPodeModulo_(sessao, modulo); }
  catch (e) { return false; }
}

function coletarContextoSISGEP_(mensagem, dominio, sessao) {
  var msg = mensagem.toLowerCase();
  var contexto = {
    totalRegistros: 0,
    resumo: {},
    dados: {},
    dominio: String(dominio || "Geral")
  };

  // Fontes específicas por domínio funcional. Somente leituras e resumos.
  if (contexto.dominio === "Benefícios" && chatPodeFonte_(sessao, "beneficios")) {
    contexto.dados.fontesBeneficios = [];
    try {
      if (typeof dashboardReservaParqueChina === "function") {
        contexto.dados.parqueChina = dashboardReservaParqueChina();
        contexto.dados.fontesBeneficios.push("MÓDULO_PARQUE_CHINA");
      }
    } catch (eParque) { contexto.dados.erroParqueChina = eParque.message; }
    try {
      if (typeof dashboardVoucher === "function") {
        contexto.dados.vouchersCertBolsa = dashboardVoucher();
        contexto.dados.fontesBeneficios.push("PLANILHAS_VOUCHER_CERTBOLSA");
      }
    } catch (eVoucher) { contexto.dados.erroVoucher = eVoucher.message; }
  }

  if (contexto.dominio === "Jurídico" || contexto.dominio === "RH e Administrativo") {
    contexto.dados.avisoFonteDominio = "Os registros deste módulo ainda ficam no armazenamento local da tela e não estão disponíveis ao servidor. Não invente dados; use apenas memória institucional, CCT, e-mails ou documentos realmente encontrados.";
  }

  // ── Carrega emails das escolas (cache em memória) ──
  var mapaEmailEscolas = {};
  try {
    var listaEsc = chatPodeFonte_(sessao, "escolas") ? (listarEscolasCadastro_interno_() || []) : [];
    listaEsc.forEach(function(e) {
      var nome = String(e[COL_NOME_ESCOLA] || e.escola || e.NomeEscola || "").trim().toLowerCase();
      var email = String(e[COL_EMAIL] || e.email || e.Email || "").trim();
      var emailTodos = String(e[COL_EMAILS_TODOS] || e.EmailsTodos || "").trim();
      if (nome) {
        mapaEmailEscolas[nome] = {
          nomeCadastro: String(e[COL_NOME_ESCOLA] || e.escola || e.NomeEscola || "").trim(),
          cnpj: String(e.cnpj || e.CNPJ || e.Cnpj || "").trim(),
          razaoSocial: String(e.razaoSocial || e.RazaoSocial || e["Razão Social"] || e[COL_NOME_ESCOLA] || "").trim(),
          email: email,
          emailTodos: emailTodos,
          situacao: String(e[COL_SITUACAO] || e.situacao || "ATIVA").trim(),
          cidade: String(e[COL_CIDADE] || e.cidade || e.Municipio || "").trim(),
          telefone: String(e[COL_TELEFONE] || e.telefone || "").trim()
        };
      }
    });
    contexto.dados.totalEscolas = listaEsc.length;
  } catch(eEsc) {
    Logger.log("coletarContexto_ escolas: " + eEsc.message);
  }

  /* ── Mensalidades ──
     CONTAGEM NÃO É PESSOA. Corrigido em 31/08/2026, depois de uma primeira
     tentativa que barrava o bloco inteiro para quem não tem o módulo
     financeiro — e deixava a SOFIA respondendo "não consultei" a perguntas
     que ela podia responder. O usuário apontou, e estava certo.

     O que é sensível pela LGPD (art. 5º, II) é filiação sindical de pessoa
     IDENTIFICADA: nome + status. "Há 12 pendências nesta escola" não
     identifica ninguém e não é dado pessoal.

     Então o corte é este, e não no bloco:
       contadores e totais    → qualquer sessão com o módulo sofia
       nomes de pessoas       → só com o módulo financeiro

     Assim a assistente continua útil para quem faz gestão, sem virar porta
     lateral para a lista de quem se desfiliou. */
  var podeVerPessoas = chatPodeFonte_(sessao, "financeiro");

  try {
    var statusGeral = listarMensalidadeStatus({});
    if (statusGeral && statusGeral.ok) {
      contexto.resumo = statusGeral.resumo || {};
      if (!podeVerPessoas) {
        /* A IA precisa saber por que não tem nomes — senão inventa que não há
           ninguém, ou pede desculpa como se fosse falha. */
        contexto.dados.avisoSemPessoas =
          "Esta sessão não tem acesso ao módulo Financeiro. Os NÚMEROS abaixo " +
          "estão completos e podem ser usados; a lista de PESSOAS não foi " +
          "consultada. Se pedirem nomes, explique que é preciso acesso ao " +
          "módulo Financeiro — não diga que não há registros.";
      }
      contexto.totalRegistros = (statusGeral.itens || []).length;

      // Pergunta sobre escola específica
      var termoEscola = extrairTermoEscola_(msg);
      if (termoEscola) {
        var precisaLerAnexos = /\b(rela[cç][aã]o|nominal|anexo|arquivo|pdf|planilha|excel|lista|guia)\b/i.test(msg);
        /* Caixa de e-mails é do módulo Comunicação. */
        if (chatPodeFonte_(sessao, "comunicacao"))
          contexto.dados.emailsInstitucionais = buscarEmailsInstitucionaisRecentes_(termoEscola, { lerAnexos: precisaLerAnexos });
        var filtrado = listarMensalidadeStatus({ escola: termoEscola });
        if (termoEscola === "gestão de excelencia" && (!filtrado || !filtrado.itens || !filtrado.itens.length)) {
          filtrado = listarMensalidadeStatus({ escola: "Gestão de Excelência" });
        }
        if (termoEscola === "gestão de excelencia" && (!filtrado || !filtrado.itens || !filtrado.itens.length)) {
          filtrado = listarMensalidadeStatus({ escola: "Gestao de Excelencia" });
        }
        if (filtrado && filtrado.ok && filtrado.itens) {
          // Localiza cadastros sem misturar instituições com nomes semelhantes.
          var emailDaEscola = "";
          var infoEscola = null;
          var opcoesEscola = localizarCadastrosSofia_(mapaEmailEscolas, termoEscola);
          if (opcoesEscola.length === 1) {
            var cadastroPlanilha = opcoesEscola[0];
            var dadosReceita = consultarCnpjSofia_(cadastroPlanilha.cnpj);
            infoEscola = {
              nomeCadastro: cadastroPlanilha.nomeCadastro,
              cnpj: cadastroPlanilha.cnpj,
              razaoSocial: dadosReceita && dadosReceita.razaoSocial ? dadosReceita.razaoSocial : cadastroPlanilha.razaoSocial,
              nomeFantasia: dadosReceita ? dadosReceita.fantasia : "",
              situacao: dadosReceita && dadosReceita.situacaoCadastral ? dadosReceita.situacaoCadastral : cadastroPlanilha.situacao,
              cidade: dadosReceita && dadosReceita.cidade ? dadosReceita.cidade + (dadosReceita.uf ? " - " + dadosReceita.uf : "") : cadastroPlanilha.cidade,
              telefone: dadosReceita && dadosReceita.telefone ? dadosReceita.telefone : cadastroPlanilha.telefone,
              endereco: dadosReceita ? [dadosReceita.logradouro, dadosReceita.numero, dadosReceita.complemento, dadosReceita.bairro].filter(Boolean).join(", ") : "",
              cep: dadosReceita ? dadosReceita.cep : "",
              emailCnpj: dadosReceita ? dadosReceita.email : "",
              cnae: dadosReceita ? [dadosReceita.cnaePrincipal, dadosReceita.cnaeDescricao].filter(Boolean).join(" — ") : "",
              divergencias: divergenciasCadastroSofia_(cadastroPlanilha, dadosReceita),
              fontes: { cnpj: "PLANILHA_SISGEP", cadastro: dadosReceita ? "RECEITA_CNPJ" : "PLANILHA_SISGEP" }
            };
            emailDaEscola = cadastroPlanilha.email || cadastroPlanilha.emailTodos || "";
          } else if (opcoesEscola.length > 1) {
            infoEscola = {
              requerEscolha: true,
              candidatos: opcoesEscola.map(function(c) {
                return { nomeCadastro: c.nomeCadastro, razaoSocial: c.razaoSocial || c.nomeCadastro, cnpj: c.cnpj, cidade: c.cidade };
              }),
              fontes: { candidatos: "PLANILHA_SISGEP" }
            };
          }

          // Agrupa por status
          var confirmados = filtrado.itens.filter(function(i) { return i.status === "CONFIRMADO"; }).length;
          var pendentes   = filtrado.itens.filter(function(i) { return i.status === "PENDENTE_30D"; }).length;
          var aguardando  = filtrado.itens.filter(function(i) { return i.status === "AGUARDANDO"; }).length;

          contexto.dados.escolaFiltrada = {
            termo: termoEscola,
            total: filtrado.itens.length,
            confirmados: confirmados,
            pendentes: pendentes,
            aguardando: aguardando,
            email: emailDaEscola,
            infoEscola: infoEscola,
            /* Os contadores acima vão para todo mundo; a LISTA NOMINAL, não.
               Sem o módulo financeiro a SOFIA sabe quantos são e não sabe
               quem são — que é exatamente a fronteira do dado pessoal. */
            itens: !podeVerPessoas ? [] : filtrado.itens.slice(0, 20).map(function(i) {
              return {
                nome: i.nome,
                status: i.status,
                diasSemConfirm: i.diasSemConfirm,
                numeroOficio: i.numeroOficio,
                dataOficio: i.dataOficio,
                observacoes: i.observacoes ? i.observacoes.substring(0, 80) : ""
              };
            })
          };
        }
      }

      // Pergunta sobre emails / contatos de escolas
      if (msg.indexOf("email") >= 0 || msg.indexOf("e-mail") >= 0 ||
          msg.indexOf("contato") >= 0 || msg.indexOf("sem email") >= 0 ||
          msg.indexOf("sem contato") >= 0) {
        var semEmail = [];
        var comEmail = [];
        Object.keys(mapaEmailEscolas).forEach(function(k) {
          var info = mapaEmailEscolas[k];
          if (!info.email && !info.emailTodos) {
            semEmail.push(k);
          } else {
            comEmail.push(k);
          }
        });
        contexto.dados.emailEscolas = {
          totalComEmail: comEmail.length,
          totalSemEmail: semEmail.length,
          semEmail: semEmail.slice(0, 15)
        };
      }

      // Urgentes para cobrança
      if (msg.indexOf("cobr") >= 0 || msg.indexOf("pendent") >= 0 ||
          msg.indexOf("atrasd") >= 0 || msg.indexOf("urgente") >= 0 ||
          msg.indexOf("hoje") >= 0 || msg.indexOf("prioridade") >= 0) {
        var pendentesLista = (statusGeral.itens || [])
          .filter(function(i) { return i.status === "PENDENTE_30D" || i.status === "AGUARDANDO"; })
          .sort(function(a, b) { return (b.diasSemConfirm || 0) - (a.diasSemConfirm || 0); })
          .slice(0, 15)
          .map(function(i) {
            // Tenta enriquecer com email da escola
            var emailEsc = "";
            var nomeEscLower = (i.escola || "").toLowerCase();
            Object.keys(mapaEmailEscolas).forEach(function(k) {
              if (nomeEscLower.indexOf(k.substring(0, 12)) >= 0 ||
                  k.indexOf(nomeEscLower.substring(0, 12)) >= 0) {
                emailEsc = mapaEmailEscolas[k].email || "";
              }
            });
            return {
              nome: i.nome,
              escola: i.escola,
              status: i.status,
              diasSemConfirm: i.diasSemConfirm,
              numeroOficio: i.numeroOficio,
              emailEscola: emailEsc
            };
          });
        contexto.dados.maisUrgentes = pendentesLista;
      }

      // Confirmados
      if (msg.indexOf("confirm") >= 0 || msg.indexOf("regulariz") >= 0) {
        var confirmadosLista = (statusGeral.itens || [])
          .filter(function(i) { return i.status === "CONFIRMADO" || i.status === "REGULARIZADO"; })
          .slice(0, 10)
          .map(function(i) {
            return { nome: i.nome, escola: i.escola, status: i.status };
          });
        contexto.dados.confirmados = confirmadosLista;
      }

      // Associado por nome
      var termoNome = extrairTermoNome_(msg);
      if (termoNome && podeVerPessoas) {
        var porNome = listarMensalidadeStatus({ nome: termoNome });
        if (porNome && porNome.ok && porNome.itens && porNome.itens.length > 0) {
          contexto.dados.associadoBuscado = {
            termo: termoNome,
            itens: porNome.itens.slice(0, 5).map(function(i) {
              return {
                nome: i.nome,
                escola: i.escola,
                status: i.status,
                diasSemConfirm: i.diasSemConfirm,
                numeroOficio: i.numeroOficio,
                dataOficio: i.dataOficio,
                observacoes: i.observacoes ? i.observacoes.substring(0, 100) : ""
              };
            })
          };
        }
      }

      // Pergunta sobre CCT / legislação — não precisa de dados extras, o system prompt já tem a CCT
    }
  } catch (e) {
    /* Recusa por permissão não é erro: é o sistema funcionando. Fica separada
       no log para não parecer falha de leitura da planilha. */
    Logger.log("coletarContextoSISGEP_ erro mensalidades: " + e.message);
  }

  return contexto;
}

/* ═══════════════════════════════════════════════════════
   EXTRAI TERMO DE ESCOLA
═══════════════════════════════════════════════════════ */
function extrairTermoEscola_(msg) {
  if (msg.indexOf("uvv") >= 0) return "gestão de excelencia";
  var prefixos = [
    "escola ", "colegio ", "colégio ", "faculdade ", "centro ", "instituto ",
    "fundacao ", "fundação ", "universidade ", "unidade ", "multivix",
    "faesa", "uvv", "salesiano", "marista", "darwin", "facha",
    "emescam", "unisales", "estacio", "estácio", "multivix"
  ];

  for (var i = 0; i < prefixos.length; i++) {
    var idx = msg.indexOf(prefixos[i]);
    if (idx >= 0) {
      var trecho = msg.substring(idx).split(/[?,!.]/)[0].trim();
      if (trecho.length >= 3) return trecho.substring(0, 40);
    }
  }

  var padroes = ["status da ", "status do ", "situacao da ", "situação da ",
                 "da escola ", "do colegio ", "na escola ", "da faesa",
                 "do salesiano", "da uvv", "do marista"];
  for (var j = 0; j < padroes.length; j++) {
    var idxP = msg.indexOf(padroes[j]);
    if (idxP >= 0) {
      var t = msg.substring(idxP + padroes[j].length).split(/[?,!.\s]/)[0].trim();
      if (t.length >= 3) return padroes[j].replace("da ", "").replace("do ", "").trim() + " " + t;
    }
  }

  return "";
}

/* ═══════════════════════════════════════════════════════
   EXTRAI TERMO DE NOME
═══════════════════════════════════════════════════════ */
function extrairTermoNome_(msg) {
  var padroes = [
    "status do ", "status da ", "situacao de ", "situação de ",
    "buscar ", "procurar ", "encontrar ", "associado ", "associada "
  ];

  for (var i = 0; i < padroes.length; i++) {
    var idx = msg.indexOf(padroes[i]);
    if (idx >= 0) {
      var trecho = msg.substring(idx + padroes[i].length).split(/[?,!.]/)[0].trim();

      /* DESCASCA AS PALAVRAS-GATILHO QUE SOBRARAM — auditoria do Módulo 02,
         31/08/2026.
         Antes, só o PRIMEIRO padrão era removido, e o resto ficava no termo:

           "buscar joana pereira"            → "joana pereira"       achava
           "buscar associado joana pereira"  → "associado joana ..." não achava

         A segunda é como uma pessoa pergunta. A busca não encontrava ninguém
         e a SOFIA respondia que não havia registros — o pior tipo de erro de
         assistente, porque parece resposta e é falha de leitura. */
      var mudou = true;
      while (mudou) {
        mudou = false;
        for (var j = 0; j < padroes.length; j++) {
          if (trecho.indexOf(padroes[j]) === 0) {
            trecho = trecho.substring(padroes[j].length).trim();
            mudou = true;
          }
        }
      }

      if (trecho.length >= 3 && trecho.length <= 60) return trecho;
    }
  }
  return "";
}

/* ═══════════════════════════════════════════════════════
   MONTA SYSTEM PROMPT COM DADOS REAIS + CCT
═══════════════════════════════════════════════════════ */

/* Seleciona apenas os trechos relacionados à consulta, mantendo a fonte completa disponível. */
function selecionarContextoIA_(texto, consulta, limite) {
  texto = String(texto || "");
  limite = Number(limite || 30000);
  if (!texto || texto.length <= limite) return texto;

  var normalizar = function(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };
  var q = normalizar(consulta);
  var termos = q.split(/[^a-z0-9]+/).filter(function(t) {
    return t.length >= 3 && ["que","qual","quais","sobre","para","com","uma","das","dos"].indexOf(t) < 0;
  });
  var numeroClausula = q.match(/(?:clausula|cl)\s*(\d+)/);
  if (numeroClausula) termos.push(numeroClausula[1]);

  var blocos = texto.split(/\n{2,}/);
  var avaliados = blocos.map(function(bloco, indice) {
    var b = normalizar(bloco);
    var pontos = 0;
    termos.forEach(function(t) {
      if (b.indexOf(t) >= 0) pontos += /^\d+$/.test(t) ? 8 : 2;
    });
    return { texto: bloco, indice: indice, pontos: pontos };
  }).filter(function(x) { return x.pontos > 0; })
    .sort(function(a, b) { return b.pontos - a.pontos || a.indice - b.indice; });

  if (!avaliados.length) return texto.substring(0, Math.min(limite, 12000));

  var escolhidos = [];
  var tamanho = 0;
  avaliados.some(function(x) {
    if (tamanho + x.texto.length > limite && escolhidos.length) return true;
    escolhidos.push(x);
    tamanho += x.texto.length + 2;
    return tamanho >= limite;
  });
  escolhidos.sort(function(a, b) { return a.indice - b.indice; });
  return escolhidos.map(function(x) { return x.texto; }).join("\n\n").substring(0, limite);
}

/**
 * Um documento longo virando bloco de contexto — COM A IDENTIFICAÇÃO PRESA.
 *
 * O DEFEITO QUE ISTO CORRIGE, medido em 13/08/2026 e não relatado por
 * ninguém: `selecionarContextoIA_` escolhe os PARÁGRAFOS mais relevantes para
 * a pergunta e descarta o resto — inclusive a primeira linha, que é onde mora
 * "qual documento é este e desde quando ele vale".
 *
 * O resultado media certo e estava errado: perguntando o quórum de assembleia
 * dentro da especialidade Estatuto, chegavam à IA os arts. 62, 66 e a seção
 * das Assembleias Gerais — os artigos CERTOS — mas soltos, sem dizer de que
 * documento vieram nem de que ano. Com CCT e Estatuto podendo entrar no mesmo
 * prompt, isso é o convite para a resposta citar "art. 62" da fonte errada, e
 * o prompt logo abaixo manda justamente NÃO trocar as fontes. Mandar não
 * trocar sem dizer qual é qual é pedir o impossível.
 *
 * A identificação vai FORA do seletor, sempre. É uma linha; o corte de 60 ou
 * 90 mil caracteres não pode escolher jogá-la fora.
 */
function blocoDocumentoIA_(rotulo, texto, consulta, limite) {
  var inteiro = String(texto || "");
  if (!inteiro) return "";
  /* A primeira linha não vazia do documento é a identificação dele — é assim
   * que CCTCore e EstatutoCore começam. Ler de lá em vez de repetir a
   * vigência aqui evita a cópia que envelhece sozinha. */
  var linhas = inteiro.split("\n");
  var identificacao = "";
  for (var i = 0; i < linhas.length && i < 5; i++) {
    if (String(linhas[i]).trim()) { identificacao = linhas[i].trim(); break; }
  }
  var trechos = selecionarContextoIA_(inteiro, consulta, limite);
  if (!trechos) return "";
  return "\n=== " + rotulo + " — TRECHOS RELEVANTES ===\n" +
         (identificacao ? identificacao + "\n" : "") +
         "(Ao citar, diga o artigo ou a cláusula E de qual destes documentos.)\n\n" +
         trechos + "\n";
}

/* ═══════════════════════════════════════════════════════
   PROCEDÊNCIA — de que documento a resposta saiu

   Isto é a contrapartida do bloco acima: lá o documento passou a chegar
   identificado à IA; aqui a identificação chega a quem lê a resposta.

   A REGRA DE OURO DESTE PEDAÇO: a lista de fontes NÃO é recalculada.
   Ela é LIDA DO PROMPT que de fato foi montado. Recalcular — repetindo as
   condições de `precisaCCT`/`precisaEstatuto` — criaria duas verdades que
   envelhecem em separado, e a segunda seria a que aparece na tela: um dia a
   condição muda de um lado só e a SOFIA passa a anunciar um documento que
   não consultou. Anunciar fonte errada é pior que não anunciar nada, porque
   dá ao leitor a confiança que ele não teria sozinho.

   Lendo do prompt, a única forma de a tela dizer "consultei o Estatuto" é o
   bloco do Estatuto estar lá dentro.
═══════════════════════════════════════════════════════ */
var FONTES_IA_ = {
  CCT:      { rotulo: "CCT",      icone: "📘" },
  ESTATUTO: { rotulo: "Estatuto", icone: "📜" }
};

/** Tira a moldura (=== , ━━━) que enfeita a primeira linha dos documentos. */
function limparIdentificacaoFonte_(linha) {
  return String(linha || "").replace(/^[\s=━─—*#]+/, "").replace(/[\s=━─—*#]+$/, "").trim();
}

/**
 * Quais documentos entraram no prompt — lido do próprio prompt.
 * Devolve [] quando nenhum entrou, que é o caso da maioria das perguntas.
 */
function fontesDoPrompt_(systemPrompt) {
  var texto = String(systemPrompt || "");
  var re = /=== ([A-ZÀ-Ú0-9 ._-]+) — TRECHOS RELEVANTES ===\n([^\n]*)/g;
  var fontes = [];
  var m;
  while ((m = re.exec(texto)) !== null) {
    var tipo = String(m[1]).trim();
    var meta = FONTES_IA_[tipo] || { rotulo: tipo, icone: "📄" };
    /* Documento sem primeira linha de identificação: o que vem depois do
     * cabeçalho é a instrução de citação, e ela não é identificação de
     * coisa nenhuma. Melhor ficar sem do que mostrar a instrução. */
    var ident = limparIdentificacaoFonte_(m[2]);
    if (/^\(Ao citar/i.test(ident)) ident = "";
    fontes.push({ tipo: tipo, rotulo: meta.rotulo, icone: meta.icone, identificacao: ident });
  }
  return fontes;
}

/**
 * A resposta cita artigo DE DOCUMENTO NOSSO?
 *
 * "Art. 477 da CLT" e "art. 8º da Constituição" não são citação do Estatuto —
 * são referência de lei, que a IA pode fazer legitimamente sem o Estatuto
 * anexado. Contar essas como citação faria o alerta disparar em resposta
 * correta, e alerta que grita à toa é alerta que se aprende a ignorar.
 */
function citacoesDeArtigo_(texto) {
  /* "Arts. 74, 85 e 96" É UMA CITAÇÃO DE TRÊS, não de uma.
   *
   * A primeira versão lia só o número colado no "art." e devolvia [74] para
   * a linha de referência que o próprio caso real trouxe — deixando 85 e 96
   * de fora justamente do aviso que manda conferir. Por isso a captura
   * segue a lista inteira depois do "arts.". */
  var re = /\bart(?:\.|igos?|s\.?)\s*(\d+(?:\s*[ºo°]?\s*(?:,|e)\s*\d+)*)/gi;
  var achados = [];
  var m;
  while ((m = re.exec(String(texto || ""))) !== null) {
    var cauda = String(texto).substr(m.index + m[0].length, 40);
    if (/^\s*[ºo°]?\s*,?\s*(?:d[ao]s?\s+)?(?:CLT|Lei|Decreto|Constitui|C[óo]digo|CF\b)/i.test(cauda)) continue;
    String(m[1]).split(/[^0-9]+/).forEach(function (n) {
      if (n && achados.indexOf(n) < 0) achados.push(n);
    });
  }
  return achados;
}

/** Mantida para quem só quer saber se houve citação. */
function citaArtigoProprio_(texto) {
  return citacoesDeArtigo_(texto).length > 0;
}

function citacoesDeClausula_(texto) {
  var re = /\bcl[áa]usulas?\s*n?[º°]?\s*(\d+)/gi;
  var achados = [];
  var m;
  while ((m = re.exec(String(texto || ""))) !== null) {
    if (achados.indexOf(m[1]) < 0) achados.push(m[1]);
  }
  return achados;
}

/** "74, 85 e 96" — como se escreve, não como se programa. */
function listarNumerosPt_(lista) {
  if (lista.length === 1) return lista[0];
  return lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
}

/**
 * O aviso que aparece quando a resposta cita um documento que não foi lido.
 *
 * É o defeito que a procedência existe para pegar: a IA respondendo "conforme
 * a cláusula 12" sem a CCT no prompt, ou "art. 62" sem o Estatuto. A resposta
 * sai com a mesma cara de sempre e o número pode ser invenção — quem lê não
 * tem como distinguir. Aqui tem.
 */
function alertaFonteAusente_(resposta, fontes) {
  var lista = Array.isArray(fontes) ? fontes : [];
  var temTipo = function(t) {
    for (var i = 0; i < lista.length; i++) if (lista[i].tipo === t) return true;
    return false;
  };
  var texto = String(resposta || "");
  var partes = [];

  /* A REDAÇÃO IMPORTA, e a primeira estava errada.
   *
   * Dizia: "Esta resposta cita artigo do Estatuto, mas o documento não foi
   * consultado". O usuário apontou a contradição no primeiro dia de uso, e
   * ele tem razão: se o documento não foi consultado, NÃO SE SABE que aquele
   * número é do Estatuto. Pode ser de outro documento, de outra versão, ou
   * de lugar nenhum. Chamar de "artigo do Estatuto" é justamente conceder a
   * procedência que este aviso existe para negar.
   *
   * A frase de agora afirma só o que se sabe: qual documento não entrou, e
   * quais números saíram sem conferência. Nomear os números também ajuda —
   * quem for conferir já sabe o que procurar. */
  var arts = citacoesDeArtigo_(texto);
  if (arts.length && !temTipo("ESTATUTO")) {
    partes.push("o Estatuto não foi consultado nesta resposta, e o" +
      (arts.length > 1 ? "s arts. " : " art. ") + listarNumerosPt_(arts) +
      (arts.length > 1 ? " saíram" : " saiu") + " sem conferência");
  }
  var claus = citacoesDeClausula_(texto);
  if (!claus.length && /\bcl[áa]usula/i.test(texto)) claus = null; // citou sem número
  if ((claus === null || (claus && claus.length)) && !temTipo("CCT")) {
    partes.push("a CCT não foi consultada nesta resposta, e a" +
      (claus && claus.length > 1 ? "s cláusulas " + listarNumerosPt_(claus) + " saíram" :
       claus ? " cláusula " + claus[0] + " saiu" : " cláusula citada saiu") + " sem conferência");
  }

  if (!partes.length) return "";
  var frase = partes.join(" · ") +
    ". O número pode não corresponder ao documento — confira antes de usar.";
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * @param {Object} forcar  {cct:true} / {estatuto:true} — anexa o documento
 *        independentemente das palavras da pergunta. É o que a segunda
 *        leitura usa quando a resposta cita um documento que não entrou.
 */
function montarSystemPrompt_(contexto, mensagem, forcar) {
  forcar = forcar || {};
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  var resumo = contexto.resumo || {};

    var consulta = String(mensagem || "").toLowerCase();

  /* O BOTÃO "CCT" DA BARRA LATERAL NÃO CARREGAVA A CCT.
   *
   * A decisão de anexar o texto da convenção olhava SÓ as palavras da
   * pergunta. Quem clicava em "CCT" na lista de especialidades e perguntava
   * "quanto ganha um secretário escolar?" — sem escrever "CCT", "cláusula"
   * nem "convenção" — recebia resposta SEM a convenção anexada. A IA
   * respondia assim mesmo, do que sabia por fora, e ninguém tinha como
   * perceber: a resposta vinha com a mesma cara de sempre.
   *
   * É o pior tipo de defeito num assistente: ele não erra o formato, erra a
   * fonte. Agora o domínio escolhido também manda — quem entrou na
   * especialidade CCT está dizendo, com todas as letras, sobre o que quer
   * falar. */
  var dominioAtual = String((contexto && contexto.dominio) || "").toUpperCase();
  var precisaCCT = forcar.cct === true || dominioAtual === "CCT" ||
    /(cct|convenção|convencao|cláusula|clausula|dissídio|dissidio|acordo coletivo|piso|reajuste)/i.test(consulta);
  var conteudoCCT = precisaCCT
    ? blocoDocumentoIA_("CCT", getCCTTexto_(), consulta, 90000) : "";
  /* O ESTATUTO, pela mesma porta da CCT e com o mesmo cuidado.
   *
   * São documentos diferentes e não podem se substituir: a CCT rege a
   * relação com as escolas (piso, reajuste, bolsa); o Estatuto rege o
   * sindicato por dentro (assembleia, mandato, eleição, conselho fiscal).
   * Responder assembleia com CCT, ou piso com Estatuto, é errar a fonte —
   * e errar a fonte é o defeito que ninguém confere, porque a resposta sai
   * com a mesma cara de sempre.
   *
   * 60.000 de teto contra os 90.000 da CCT: os dois juntos precisam caber
   * no prompt, e a pergunta que aciona os dois ao mesmo tempo é rara. */
  /* O VOCABULÁRIO FOI CURTO DEMAIS, e o caso real mostrou onde.
   *
   * "Quem pode participar da votação?" é pergunta de Estatuto para qualquer
   * pessoa que leia — e não acionava nada, porque "votação", "voto" e
   * "eleitor" não estavam na lista. A resposta saiu citando três artigos de
   * memória, todos com o número errado.
   *
   * Lista de palavras sempre vaza; por isso ela agora é mais larga E existe
   * a segunda leitura (ver `chatSISGEP`), que pega o que ela deixar passar.
   * Larga sem ser indiscriminada: cada palavra aqui é de assunto que só o
   * Estatuto rege. */
  var precisaEstatuto = forcar.estatuto === true || dominioAtual === "ESTATUTO" ||
    /(estatuto|estatutári|assembleia|assembléia|mandato|diretoria|conselho fiscal|elei(ção|cao|toral)|posse|quórum|quorum|destitui|filia(ção|cao)|desfilia|vot(o|ar|ação|acao|antes)|eleitor|chapa|urna|escrut[íi]nio|delegad|sindical(izad|iza)|art\.\s*\d)/i.test(consulta);
  var conteudoEstatuto = (precisaEstatuto && typeof getEstatutoTexto_ === "function")
    ? blocoDocumentoIA_("ESTATUTO", getEstatutoTexto_(), consulta, 60000) : "";

  var memoriaRelevante = selecionarContextoIA_(carregarMemoriaOrganizacional(), consulta, 30000);

var prompt =
    "Você é o assistente de IA do SISGEP — Sistema Integrado de Gestão de Processos " +
    "do SindEducação-ES (Sindicato dos Educadores Técnico-Administrativos em " +
    "Estabelecimentos de Ensino Particular no Estado do Espírito Santo).\n\n" +
    "Responda sempre em português brasileiro, de forma direta e objetiva. " +
    "Use listas quando houver múltiplos itens. Seja assertivo, não especule. " +
    "Para perguntas sobre a CCT, cite o número da cláusula relevante.\n\n" +
    "Para perguntas sobre o Estatuto, cite o número do artigo. NUNCA responda " +
    "sobre Estatuto usando a CCT, nem sobre CCT usando o Estatuto: são " +
    "documentos diferentes, e trocá-los produz resposta com a forma certa e a " +
    "fonte errada.\n\n" +
    conteudoCCT +
    "\n" +
    conteudoEstatuto +
    "\n" +
    memoriaRelevante +

    "━━━ DADOS REAIS DO SISTEMA — " + hoje + " ━━━\n\n";

  // Resumo geral
  /* O aviso vem ANTES dos números, para a IA ler a ressalva junto com o dado
     e não depois de já ter concluído. (avisoFonteDominio, definido na coleta
     desde antes, nunca chegou aqui — fica anotado como achado à parte.) */
  if (contexto.dados.avisoSemPessoas) {
    prompt += "AVISO DE ACESSO: " + contexto.dados.avisoSemPessoas + "\n\n";
  }

  if (resumo.total) {
    prompt +=
      "RESUMO DE MENSALIDADES:\n" +
      "• Total de associados: " + (resumo.total || 0) + "\n" +
      "• Confirmados: " + (resumo.confirmados || 0) + "\n" +
      "• Aguardando: " + (resumo.aguardando || 0) + "\n" +
      "• Pendentes +30 dias: " + (resumo.pendentes || 0) + "\n" +
      "• Cobrança enviada: " + (resumo.cobracaEnviada || 0) + "\n" +
      "• Regularizados: " + (resumo.regularizados || 0) + "\n" +
      (contexto.dados.totalEscolas ? "• Total de escolas cadastradas: " + contexto.dados.totalEscolas + "\n" : "") +
      "\n";
  }

  // Escola filtrada (contexto rico)
  if (contexto.dados.escolaFiltrada) {
    var ef = contexto.dados.escolaFiltrada;
    prompt += "ESCOLA: " + ef.termo.toUpperCase() + "\n";
    prompt += "• Total de associados: " + ef.total + "\n";
    prompt += "• Confirmados: " + ef.confirmados + " | Pendentes +30d: " + ef.pendentes + " | Aguardando: " + ef.aguardando + "\n";
    if (ef.email) prompt += "• Contato da planilha: " + ef.email + " | Fonte: PLANILHA_SISGEP\n";
    if (ef.infoEscola) {
      if (ef.infoEscola.requerEscolha) {
        prompt += "• Existem vários cadastros compatíveis. Mostre TODAS as opções e peça ao usuário que escolha; não selecione automaticamente.\n";
        (ef.infoEscola.candidatos || []).forEach(function(c, idx) {
          prompt += "  " + (idx + 1) + ". " + c.razaoSocial + (c.cnpj ? " | CNPJ " + c.cnpj : "") + (c.cidade ? " | " + c.cidade : "") + " | Fonte: PLANILHA_SISGEP\n";
        });
      } else {
        if (ef.infoEscola.cnpj) prompt += "• CNPJ: " + ef.infoEscola.cnpj + " | Fonte: PLANILHA_SISGEP\n";
        if (ef.infoEscola.razaoSocial) prompt += "• Razão social: " + ef.infoEscola.razaoSocial + " | Fonte: " + ef.infoEscola.fontes.cadastro + "\n";
        if (ef.infoEscola.nomeFantasia) prompt += "• Nome fantasia: " + ef.infoEscola.nomeFantasia + " | Fonte: RECEITA_CNPJ\n";
        if (ef.infoEscola.situacao) prompt += "• Situação cadastral: " + ef.infoEscola.situacao + " | Fonte: " + ef.infoEscola.fontes.cadastro + "\n";
        if (ef.infoEscola.endereco) prompt += "• Endereço: " + ef.infoEscola.endereco + " | Fonte: RECEITA_CNPJ\n";
        if (ef.infoEscola.cidade) prompt += "• Cidade: " + ef.infoEscola.cidade + " | Fonte: " + ef.infoEscola.fontes.cadastro + "\n";
        if (ef.infoEscola.cep) prompt += "• CEP: " + ef.infoEscola.cep + " | Fonte: RECEITA_CNPJ\n";
        if (ef.infoEscola.telefone) prompt += "• Telefone: " + ef.infoEscola.telefone + " | Fonte: " + ef.infoEscola.fontes.cadastro + "\n";
        if (ef.infoEscola.emailCnpj) prompt += "• E-mail do CNPJ: " + ef.infoEscola.emailCnpj + " | Fonte: RECEITA_CNPJ\n";
        if (ef.infoEscola.cnae) prompt += "• CNAE: " + ef.infoEscola.cnae + " | Fonte: RECEITA_CNPJ\n";
        (ef.infoEscola.divergencias || []).forEach(function(d) {
          prompt += "• DIVERGÊNCIA — " + d.campo + ": Planilha = " + d.planilha + " | Receita = " + d.receita + "\n";
        });
      }
    }
    prompt += "ASSOCIADOS:\n";
    ef.itens.forEach(function(i) {
      prompt += "  • " + i.nome + " — " + i.status + " — " + (i.diasSemConfirm || 0) + " dias" +
        (i.numeroOficio ? " — Ofício " + i.numeroOficio : "") +
        (i.observacoes ? " — " + i.observacoes.substring(0, 60) : "") + "\n";
    });
    prompt += "\n";
  }

    // E-mails institucionais mais recentes
  if (contexto.dados.emailsInstitucionais && contexto.dados.emailsInstitucionais.length) {
    prompt += "E-MAILS INSTITUCIONAIS MAIS RECENTES (ordem do mais novo para o mais antigo):\n";
    contexto.dados.emailsInstitucionais.forEach(function(e, idx) {
      prompt += (idx + 1) + ". [" + e.dataTexto + "] " + e.assunto +
        " | Fonte: " + e.contaPrioritaria +
        " | De: " + e.de + " | Para: " + e.para +
        " | Trecho: " + e.resumo + "\n";
      (e.anexos || []).forEach(function(a) {
        prompt += "  ANEXO: " + a.nome + " | Tipo: " + a.tipo + " | Tamanho: " + a.tamanho + " bytes\n";
        if (a.lido && a.conteudo) prompt += "  CONTEÚDO EXTRAÍDO:\n" + a.conteudo + "\n";
        else if (a.erro) prompt += "  AVISO: " + a.erro + "\n";
      });
    });
    prompt += "Use esses e-mails como evidência complementar. Nunca confirme vínculo de associado apenas pelo e-mail.\n\n";
  }

// Emails das escolas
  if (contexto.dados.emailEscolas) {
    var ee = contexto.dados.emailEscolas;
    prompt += "SITUAÇÃO DE EMAILS DAS ESCOLAS:\n" +
      "• Com email cadastrado: " + ee.totalComEmail + "\n" +
      "• Sem email: " + ee.totalSemEmail + "\n";
    if (ee.semEmail && ee.semEmail.length > 0) {
      prompt += "• Escolas sem email (primeiras " + ee.semEmail.length + "): " + ee.semEmail.join(", ") + "\n";
    }
    prompt += "\n";
  }

  // Urgentes para cobrança
  if (contexto.dados.maisUrgentes && contexto.dados.maisUrgentes.length > 0) {
    prompt += "ASSOCIADOS MAIS URGENTES (por dias sem confirmação):\n";
    contexto.dados.maisUrgentes.forEach(function(i, idx) {
      prompt += (idx + 1) + ". " + i.nome +
        " | " + i.escola.substring(0, 45) +
        " | " + i.status +
        " | " + (i.diasSemConfirm || 0) + " dias" +
        (i.numeroOficio ? " | Ofício " + i.numeroOficio : "") +
        (i.emailEscola ? " | Email: " + i.emailEscola : " | ⚠️ sem email") + "\n";
    });
    prompt += "\n";
  }

  // Confirmados
  if (contexto.dados.confirmados && contexto.dados.confirmados.length > 0) {
    prompt += "ASSOCIADOS CONFIRMADOS RECENTES:\n";
    contexto.dados.confirmados.forEach(function(i) {
      prompt += "• " + i.nome + " — " + i.escola.substring(0, 40) + "\n";
    });
    prompt += "\n";
  }

  // Associado buscado
  if (contexto.dados.associadoBuscado) {
    var ab = contexto.dados.associadoBuscado;
    prompt += "BUSCA POR '" + ab.termo.toUpperCase() + "':\n";
    ab.itens.forEach(function(i) {
      prompt += "• " + i.nome + "\n" +
        "  Escola: " + i.escola + "\n" +
        "  Status: " + i.status + " | Dias: " + (i.diasSemConfirm || 0) + "\n" +
        (i.numeroOficio ? "  Ofício: " + i.numeroOficio + " em " + i.dataOficio + "\n" : "") +
        (i.observacoes ? "  Obs: " + i.observacoes + "\n" : "");
    });
    prompt += "\n";
  }

  prompt +=
    "━━━ FIM DOS DADOS ━━━\n\n" +
    "REGRAS:\n" +
    "1. Responda APENAS com base nos dados acima. Nunca invente dados nem atribua o RESUMO GERAL a uma escola específica. Se ESCOLA não estiver presente nos dados, informe que não localizou registros específicos.\n" +
    "2. Para perguntas sobre a CCT, cite o número da cláusula e seja preciso.\n" +
    "3. Se não tiver os dados para responder, diga claramente o que falta.\n" +
    "4. Quando listar urgentes para cobrança, destaque os que têm email cadastrado.\n" +
    "5. Status: AGUARDANDO, CONFIRMADO, PENDENTE_30D, COBRANCA_ENVIADA, REGULARIZADO, DESFILIADO.\n" +
    "6. O usuário já está autenticado no SISGEP. Nunca pergunte quem ele é, seu cargo ou setor. Continue a tarefa usando o contexto da conversa.\n" +
    "7. Quando relevante, mencione o prazo de repasse da Cláusula 56 (dia 10 do mês seguinte).";

  return prompt;
}

