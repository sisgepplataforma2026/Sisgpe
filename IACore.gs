// ================================================================
// ARQUIVO: IACore.gs
// IA integrada ao módulo de Escolas e Ofícios do SISGEP
// Funções:
//   analisarEscolaIA(chave)       → análise inteligente da escola
//   gerarOficioIA(dados)          → geração de texto de ofício
//   responderEmailIA(dados)       → sugestão de resposta de e-mail
//   iaAssistente(prompt)          → função genérica (já usada pelo btnIAOficio)
// ================================================================

/* ─────────────────────────────────────────────────────────────────
   1. ANALISAR ESCOLA COM IA
   Chamada pelo botão "🤖 Analisar Escola" na seção Inteligência SISGEP
   Parâmetro: chave = CNPJ (preferencial) ou nome da escola
   Retorna: { resposta: "texto formatado" }
───────────────────────────────────────────────────────────────── */
function analisarEscolaIA(chave, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    chave = String(chave || "").trim();
    if (!chave) return { resposta: "Nenhuma escola informada para análise." };

    // Busca dados da escola na base
    var dadosEscola = null;
    try {
      var lista = listarEscolas() || [];
      var chaveNorm = chave.replace(/\D/g, "");

      for (var i = 0; i < lista.length; i++) {
        var item = lista[i];
        var cnpjItem = String(item.cnpj || item.CNPJ || "").replace(/\D/g, "");
        var nomeItem = String(item.escola || item.NomeEscola || item.nome || "").trim().toLowerCase();

        var matchCnpj = chaveNorm.length >= 8 && cnpjItem && cnpjItem.indexOf(chaveNorm) >= 0;
        var matchNome = chave.toLowerCase().length >= 3 && nomeItem.indexOf(chave.toLowerCase()) >= 0;

        if (matchCnpj || matchNome) {
          dadosEscola = item;
          break;
        }
      }
    } catch (eBusca) {
      Logger.log("[analisarEscolaIA] erro ao buscar escola: " + eBusca.message);
    }

    // Busca histórico de ofícios da escola
    var historicoTexto = "";
    try {
      var filtros = dadosEscola
        ? { escola: dadosEscola.escola || dadosEscola.NomeEscola || chave }
        : { escola: chave };
      var hist = listarHistoricoOficios(filtros);
      var itens = (hist && hist.itens) ? hist.itens : (Array.isArray(hist) ? hist : []);
      if (itens.length > 0) {
        historicoTexto = itens.slice(0, 10).map(function(of) {
          return "- Ofício " + (of.numero || of.Numero || "?") +
                 " | Tipo: " + (of.tipo || of.Tipo || "?") +
                 " | Status: " + (of.status || of.Status || "?") +
                 " | Data: " + (of.data || of.Data || "?");
        }).join("\n");
      }
    } catch (eHist) {
      Logger.log("[analisarEscolaIA] erro ao buscar histórico: " + eHist.message);
    }

    // Monta contexto da escola
    var contextoEscola = dadosEscola ? [
      "Nome / Razão Social: " + (dadosEscola.escola || dadosEscola.NomeEscola || dadosEscola.nome || "—"),
      "Nome Fantasia: "       + (dadosEscola.fantasia || "—"),
      "CNPJ: "               + (dadosEscola.cnpj || "—"),
      "E-mail principal: "   + (dadosEscola.email || "—"),
      "E-mails (todos): "    + (dadosEscola.emailsTodos || "—"),
      "Endereço: "           + [dadosEscola.endereco, dadosEscola.numero, dadosEscola.bairro].filter(Boolean).join(", "),
      "Cidade / UF: "        + (dadosEscola.cidadeUf || [dadosEscola.cidade, dadosEscola.uf].filter(Boolean).join(" / ") || "—"),
      "CEP: "                + (dadosEscola.cep || "—"),
    ].join("\n") : "Escola não encontrada na base local. Chave informada: " + chave;

    var prompt = [
      "Você é o assistente de inteligência do SISGEP — Sistema Integrado de Gestão de Processos do SindEducação-ES.",
      "",
      "Analise os dados da escola abaixo e produza um relatório executivo claro e objetivo.",
      "",
      "DADOS DA ESCOLA:",
      contextoEscola,
      "",
      historicoTexto ? "HISTÓRICO DE OFÍCIOS (últimos 10):\n" + historicoTexto : "HISTÓRICO DE OFÍCIOS: Nenhum ofício registrado para esta escola.",
      "",
      "Gere um relatório com as seguintes seções:",
      "1. RESUMO CADASTRAL — situação do cadastro (dados completos ou lacunas críticas como e-mail ausente, CNPJ inválido etc.)",
      "2. HISTÓRICO SINDICAL — quantos ofícios foram enviados, tipos predominantes, status dos envios, última interação",
      "3. PENDÊNCIAS E ALERTAS — o que está faltando ou irregular (ex: sem e-mail, nunca respondeu, muitos ofícios ERRO)",
      "4. AÇÕES RECOMENDADAS — o que o operador deve fazer agora (máximo 3 ações concretas e prioritárias)",
      "",
      "Regras obrigatórias:",
      "- Responda em português do Brasil.",
      "- Use linguagem direta, administrativa e objetiva.",
      "- Não use markdown, não use asteriscos, não use # ou ##.",
      "- Separe as seções apenas com o título em maiúsculas e linha em branco.",
      "- Não invente dados que não estejam nos dados fornecidos.",
      "- Se faltar dado relevante, mencione como pendência.",
    ].join("\n");

    var resposta = chamarClaude_SISGEP(prompt, tokenSessao);
    registrarAuditoriaSofia_(sessao, "Escolas", "analisarEscolaIA: " + chave, resposta, true);
    return { resposta: resposta };

  } catch (e) {
    Logger.log("[analisarEscolaIA] erro: " + e.message);
    registrarAuditoriaSofia_(sessao, "Escolas", "analisarEscolaIA: " + chave, "ERRO: " + e.message, false);
    return { resposta: "Erro ao analisar escola: " + e.message };
  }
}


/* ─────────────────────────────────────────────────────────────────
   2. GERAR TEXTO DE OFÍCIO COM IA
   Chamada pelo botão "📄 Gerar Ofício IA" na seção Inteligência SISGEP
   Parâmetro: dados = {
     tipo, escola, cnpj, email, cidade, uf,
     destinatario, cargo, assunto, instrucoes
   }
   Retorna: { texto: "corpo do ofício gerado" }
───────────────────────────────────────────────────────────────── */
function gerarOficioIA(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};

    var tipo        = String(dados.tipo        || "Ofício").trim();
    var escola      = String(dados.escola      || dados.nomeEscola || "").trim();
    var cnpj        = String(dados.cnpj        || "").trim();
    var email       = String(dados.email       || "").trim();
    var cidade      = String(dados.cidade      || dados.municipio || "").trim();
    var uf          = String(dados.uf          || "").trim();
    var destinatario= String(dados.destinatario|| "").trim();
    var cargo       = String(dados.cargo       || "").trim();
    var assunto     = String(dados.assunto     || "").trim();
    var instrucoes  = String(dados.instrucoes  || "").trim();

    if (!escola && !destinatario) {
      return { texto: "Informe a escola ou destinatário antes de gerar o ofício." };
    }

    var contextosTipo = {
      "Filiação": "O ofício solicita à escola que realize descontos mensais de 2% sobre o salário-base dos trabalhadores filiados, conforme Cláusula 56ª da CCT 2026/2027 (vigência 01/03/2026 a 28/02/2027). O desconto exige autorização expressa do associado via ficha de filiação. O repasse deve ocorrer até o 10º dia do mês subsequente. Deve mencionar os colaboradores filiados e solicitar confirmação de recebimento.",
      "Desfiliação": "O ofício solicita à escola que cesse imediatamente os descontos de mensalidade sindical (2% sobre salário-base) dos trabalhadores desfiliados, conforme Cláusula 56ª da CCT 2026/2027. Deve mencionar os colaboradores e solicitar confirmação.",
      "Taxa Negocial": "O ofício notifica a escola sobre a Taxa Negocial devida conforme Cláusula 57ª da CCT 2026/2027. A taxa é de 6% paga em 3 parcelas mensais e sucessivas de 2%, com repasse até o 10º dia útil do mês subsequente ao desconto. Ficam isentos os filiados ao SindEducação-ES.",
      "Taxa Assistencial": "O ofício notifica a escola sobre a Taxa Assistencial conforme Cláusula 58ª da CCT 2026/2027. O valor corresponde a 4% da folha salarial bruta dos educadores técnico-administrativos, em duas parcelas de 2%, com vencimentos em 15 de abril e 15 de maio de 2027. Escolas que praticam somente educação infantil recolhem 2% em parcelas de 1%.",
      "Ofício Livre": "O ofício trata do assunto indicado abaixo. Use linguagem formal sindical."
    };

    var contextoTipo = contextosTipo[tipo] || contextosTipo["Ofício Livre"];

    var prompt = [
      "Você é especialista em elaboração de ofícios sindicais do SindEducação-ES.",
      "Gere somente o corpo textual do ofício, sem cabeçalho, sem número, sem data e sem assinatura.",
      "",
      "TIPO DE OFÍCIO: " + tipo,
      "CONTEXTO DO TIPO: " + contextoTipo,
      "",
      "DADOS DA ESCOLA / DESTINATÁRIO:",
      escola      ? "Escola / Destinatário: " + escola      : "",
      cnpj        ? "CNPJ: "                  + cnpj        : "",
      destinatario? "Atenção: "               + destinatario: "",
      cargo       ? "Cargo: "                 + cargo       : "",
      cidade || uf? "Cidade/UF: "             + [cidade, uf].filter(Boolean).join(" / ") : "",
      assunto     ? "Assunto/Referência: "    + assunto     : "",
      instrucoes  ? "Instruções adicionais: " + instrucoes  : "",
      "",
      "Regras obrigatórias:",
      "- Responda em português do Brasil.",
      "- Use linguagem formal, administrativa, sindical e objetiva.",
      "- Não crie número de ofício, data ou assinatura.",
      "- Não use markdown, não use asteriscos, não use negrito.",
      "- Não invente nomes, datas, valores, cláusulas ou CNPJs.",
      "- Preserve exatamente os dados informados.",
      "- Retorne apenas o corpo do ofício, pronto para colar no campo de texto.",
    ].filter(Boolean).join("\n");

    var texto = chamarClaude_SISGEP(prompt, tokenSessao);
    registrarAuditoriaSofia_(sessao, "Escolas", "gerarOficioIA: " + tipo + " / " + escola, texto, true);
    return { texto: String(texto || "").trim() };

  } catch (e) {
    Logger.log("[gerarOficioIA] erro: " + e.message);
    registrarAuditoriaSofia_(sessao, "Escolas", "gerarOficioIA", "ERRO: " + e.message, false);
    return { texto: "Erro ao gerar ofício: " + e.message };
  }
}


/* ─────────────────────────────────────────────────────────────────
   3. RESPONDER E-MAIL COM IA
   Chamada pelo botão "📧 Responder E-mail IA" na seção Inteligência SISGEP
   Parâmetro: dados = {
     emailRecebido, assunto, remetente,
     escola, cnpj, contexto
   }
   Retorna: { resposta: "texto sugerido para resposta" }
───────────────────────────────────────────────────────────────── */
function responderEmailIA(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};

    var emailRecebido = String(dados.emailRecebido || dados.corpo || "").trim();
    var assunto       = String(dados.assunto       || "").trim();
    var remetente     = String(dados.remetente     || "").trim();
    var escola        = String(dados.escola        || dados.nomeEscola || "").trim();
    var cnpj          = String(dados.cnpj          || "").trim();
    var contexto      = String(dados.contexto      || "").trim();

    if (!emailRecebido) {
      return { resposta: "Informe o conteúdo do e-mail recebido para gerar uma sugestão de resposta." };
    }

    var prompt = [
      "Você é o assistente de comunicação do SindEducação-ES.",
      "Sua tarefa é redigir uma resposta profissional e cordial ao e-mail abaixo.",
      "",
      assunto   ? "ASSUNTO DO E-MAIL RECEBIDO: " + assunto   : "",
      remetente ? "REMETENTE: "                  + remetente : "",
      escola    ? "ESCOLA: "                     + escola    : "",
      cnpj      ? "CNPJ: "                       + cnpj      : "",
      contexto  ? "CONTEXTO ADICIONAL: "         + contexto  : "",
      "",
      "E-MAIL RECEBIDO:",
      emailRecebido,
      "",
      "Instruções para a resposta:",
      "- Comece com saudação adequada ao horário comercial (ex: Bom dia!, Boa tarde!).",
      "- Identifique o assunto principal e responda de forma direta e objetiva.",
      "- Use tom cordial, formal e institucional adequado a um sindicato.",
      "- Se o e-mail for uma confirmação de recebimento de ofício, registre a confirmação e agradeça.",
      "- Se for uma dúvida, responda de forma clara sem inventar informações.",
      "- Se for uma pendência ou cobrança, seja assertivo mas educado.",
      "- Encerre com 'Atenciosamente,' seguido de linha em branco (a assinatura será adicionada pelo sistema).",
      "- Não use markdown, asteriscos ou negrito.",
      "- Não invente dados, valores, datas ou nomes que não estejam no e-mail original.",
      "- Responda apenas o texto do e-mail, sem explicações adicionais.",
    ].filter(Boolean).join("\n");

    var resposta = chamarClaude_SISGEP(prompt, tokenSessao);
    registrarAuditoriaSofia_(sessao, "Escolas", "responderEmailIA: " + assunto, resposta, true);
    return { resposta: String(resposta || "").trim() };

  } catch (e) {
    Logger.log("[responderEmailIA] erro: " + e.message);
    registrarAuditoriaSofia_(sessao, "Escolas", "responderEmailIA", "ERRO: " + e.message, false);
    return { resposta: "Erro ao gerar resposta: " + e.message };
  }
}


/* ─────────────────────────────────────────────────────────────────
   4. ASSISTENTE GENÉRICO — iaAssistente(prompt)
   Já usado pelo botão "🤖 Gerar Texto com IA" no formulário de ofícios
   (btnIAOficio em OficiosFormulario.html)
   Mantido aqui para centralizar toda chamada à API
───────────────────────────────────────────────────────────────── */
function iaAssistente(prompt, tokenSessao) {
  try {
    if (!prompt || String(prompt).trim() === "") {
      return "Prompt vazio. Informe o contexto para a IA.";
    }
    return chamarClaude_SISGEP(String(prompt).trim(), tokenSessao);
  } catch (e) {
    Logger.log("[iaAssistente] erro: " + e.message);
    throw new Error("Erro no assistente IA: " + e.message);
  }
}