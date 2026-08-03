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
  var sessao = null;
  try {
    sessao = exigirSessaoDocumentos_(tokenSessao, false);
    payload = payload || {};
    var mensagem = String(payload.mensagem || "").trim();
    var historico = Array.isArray(payload.historico) ? payload.historico : [];
    var dominio = String(payload.dominio || "Geral").trim();

    if (!mensagem) return { ok: false, resposta: "Mensagem vazia." };

    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, resposta: "Chave da API Anthropic não configurada." };

    var contextoConversa = historico.slice(-4).map(function(h) { return String(h.content || ""); }).join("\n") + "\n" + mensagem;
    var contexto = coletarContextoSISGEP_(contextoConversa, dominio);
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

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var respCode = response.getResponseCode();
    var respText = response.getContentText();

    if (respCode !== 200) {
      Logger.log("chatSISGEP erro API: " + respCode + " — " + respText);
      return { ok: false, resposta: "Erro na comunicação com a IA (código " + respCode + "). Tente novamente." };
    }

    var respJson = JSON.parse(respText);
    var textoResposta = respJson.content && respJson.content[0] ? respJson.content[0].text : "";

    if (!textoResposta) {
      registrarAuditoriaSofia_(sessao, dominio, mensagem, "", false);
      return { ok: false, resposta: "A IA não retornou nenhum conteúdo para esta pergunta. Tente reformular." };
    }

    registrarAuditoriaSofia_(sessao, dominio, mensagem, textoResposta, true);

    return {
      ok: true,
      resposta: textoResposta,
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

function coletarContextoSISGEP_(mensagem, dominio) {
  var msg = mensagem.toLowerCase();
  var contexto = {
    totalRegistros: 0,
    resumo: {},
    dados: {},
    dominio: String(dominio || "Geral")
  };

  // Fontes específicas por domínio funcional. Somente leituras e resumos.
  if (contexto.dominio === "Benefícios") {
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
    var listaEsc = listarEscolasCadastro_interno_() || [];
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

  // ── Sempre busca resumo de mensalidades ──
  try {
    var statusGeral = listarMensalidadeStatus({});
    if (statusGeral && statusGeral.ok) {
      contexto.resumo = statusGeral.resumo || {};
      contexto.totalRegistros = (statusGeral.itens || []).length;

      // Pergunta sobre escola específica
      var termoEscola = extrairTermoEscola_(msg);
      if (termoEscola) {
        var precisaLerAnexos = /\b(rela[cç][aã]o|nominal|anexo|arquivo|pdf|planilha|excel|lista|guia)\b/i.test(msg);
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
            itens: filtrado.itens.slice(0, 20).map(function(i) {
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
      if (termoNome) {
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

function montarSystemPrompt_(contexto, mensagem) {
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  var resumo = contexto.resumo || {};

    var consulta = String(mensagem || "").toLowerCase();
  var precisaCCT = /(cct|convenção|convencao|cláusula|clausula|dissídio|dissidio|acordo coletivo)/i.test(consulta);
  var conteudoCCT = precisaCCT ? selecionarContextoIA_(getCCTTexto_(), consulta, 90000) : "";
  var memoriaRelevante = selecionarContextoIA_(carregarMemoriaOrganizacional(), consulta, 30000);

var prompt =
    "Você é o assistente de IA do SISGEP — Sistema Integrado de Gestão de Processos " +
    "do SindEducação-ES (Sindicato dos Educadores Técnico-Administrativos em " +
    "Estabelecimentos de Ensino Particular no Estado do Espírito Santo).\n\n" +
    "Responda sempre em português brasileiro, de forma direta e objetiva. " +
    "Use listas quando houver múltiplos itens. Seja assertivo, não especule. " +
    "Para perguntas sobre a CCT, cite o número da cláusula relevante.\n\n" +
    conteudoCCT +
    "\n" +
    memoriaRelevante +

    "━━━ DADOS REAIS DO SISTEMA — " + hoje + " ━━━\n\n";

  // Resumo geral
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

