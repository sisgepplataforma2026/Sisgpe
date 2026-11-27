/**
 * EDITAR UMA SOLICITAÇÃO DE VOUCHER (24/11/2026)
 *
 * Pedido do usuário: "Preciso do botão editar, pois caso tenha esquecido de alguma informação eu consigo editar" — todos os campos que
 * ele preenche na Nova solicitação. Regras:
 *  - protocolo, código e datas do sistema NÃO se editam; o CPF do titular edita (com validação);
 *  - cada mudança vira UMA linha no Voucher_Historico (campo, valor antigo → novo, quem, quando);
 *  - escrito POR NOME DE COLUNA, só as células que mudaram, dentro da trava do script;
 *  - voucher já EMITIDO: se a mudança aparece no certificado, avisa e OFERECE refazer o PDF (mesmo protocolo e mesmo código);
 *    nada é enviado por e-mail aqui;
 *  - mesma trava de duplicidade da criação (mesma pessoa, curso e período), sem a saída por exceção — quem precisa dela cria pela tela.
 */

/* chave do formulário → colunas, rótulo, tipo de validação e se aparece no certificado */
var VEDIT_CAMPOS = {
  cpf:               { col: ["CPF_SOLICITANTE"], rot: "CPF do titular", tipo: "cpf" },
  nome:              { col: ["NOME_SOLICITANTE", "NOME_TITULAR_ASSOCIADO"], rot: "Nome do titular", certificado: true },
  email:             { col: ["EMAIL"], rot: "E-mail do titular", tipo: "email" },
  telefone:          { col: ["TELEFONE"], rot: "Telefone" },
  situacaoSindical:  { col: ["SITUACAO_SINDICAL"], rot: "Situação sindical" },
  escola:            { col: ["ESCOLA_SELECIONADA"], rot: "Escola onde o titular trabalha", certificado: true },
  escolaFantasia:    { col: ["ESCOLA_FANTASIA"], rot: "Nome fantasia da escola", certificado: true },
  unidadeEscola:     { col: ["UNIDADE_ESCOLA"], rot: "Unidade da escola" },
  cnpjEscola:        { col: ["CNPJ_ESCOLA"], rot: "CNPJ da escola", tipo: "digitos", certificado: true },
  cidadeEscola:      { col: ["CIDADE_ESCOLA"], rot: "Cidade da escola" },
  escolaId:          { col: ["ESCOLA_ID"], rot: "ID da escola" },
  instituicao:       { col: ["INSTITUICAO_ENSINO"], rot: "Instituição de ensino", certificado: true },
  cnpjInstituicao:   { col: ["CNPJ_INSTITUICAO"], rot: "CNPJ da instituição", tipo: "digitos", certificado: true },
  emailInstituicao:  { col: ["EMAIL_INSTITUICAO"], rot: "E-mail da instituição", tipo: "email" },
  tipoBeneficiario:  { col: ["TIPO_BENEFICIARIO"], rot: "Quem é o beneficiário", tipo: "tipo", certificado: true },
  beneficiario:      { col: ["NOME_BENEFICIARIO"], rot: "Nome do beneficiário", certificado: true },
  dataNascimento:    { col: ["DATA_NASCIMENTO_BENEFICIARIO"], rot: "Data de nascimento" },
  idadeBeneficiario: { col: ["IDADE_BENEFICIARIO"], rot: "Idade" },
  parentesco:        { col: ["PARENTESCO"], rot: "Parentesco" },
  enteadoDeclaradoIR:{ col: ["ENTEADO_DECLARADO_IR"], rot: "Enteado declarado no IR" },
  ordemFilho:        { col: ["ORDEM_FILHO"], rot: "Ordem do filho", certificado: true },
  modalidade:        { col: ["MODALIDADE"], rot: "Modalidade", tipo: "modalidade", certificado: true },
  area:              { col: ["AREA_CURSO"], rot: "Área do curso", certificado: true },
  curso:             { col: ["CURSO"], rot: "Curso", certificado: true },
  regime:            { col: ["REGIME"], rot: "Regime", tipo: "regime", certificado: true },
  periodo:           { col: ["PERIODO_REFERENCIA"], rot: "Período", tipo: "periodo", certificado: true },
  percentual:        { col: ["PERCENTUAL_APLICADO"], rot: "Percentual", tipo: "percentual", certificado: true }
};
var VEDIT_MODALIDADES = ["CRECHE", "EDUCACAO_INFANTIL", "ENSINO_FUNDAMENTAL", "ENSINO_MEDIO", "TECNICO", "GRADUACAO", "POS_GRADUACAO"];

function veditTexto_(v) {
  if (v === null || v === undefined) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, "America/Sao_Paulo", "dd/MM/yyyy");
  }
  return String(v).replace(/^'/, "").trim();
}

/** O que a solicitação tem hoje, na chave do formulário — para abrir a janela de edição já preenchida. */
function voucherCarregarParaEdicao(protocolo, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var item = buscarSolicitacaoPorProtocolo_(String(protocolo || "").trim());
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };
    var reg = item.registro, valores = {};
    Object.keys(VEDIT_CAMPOS).forEach(function (k) { valores[k] = veditTexto_(reg[VEDIT_CAMPOS[k].col[0]]); });
    var emi = (typeof voucherLinhaEmitido_ === "function") ? voucherLinhaEmitido_(String(protocolo).trim()) : null;
    return { ok: true, protocolo: String(protocolo).trim(), status: String(reg.STATUS_SOLICITACAO || ""), valores: valores,
             emitido: !!emi, emitidoEm: emi ? veditTexto_(emi.reg.DATA_EMISSAO) : "" };
  } catch (e) {
    Logger.log("voucherCarregarParaEdicao: " + e.message);
    return { ok: false, mensagem: "Erro ao abrir a edição: " + e.message };
  }
}

/** Valida e normaliza UM campo. Devolve { valor } ou { erro }. */
function veditNormalizar_(k, bruto) {
  var def = VEDIT_CAMPOS[k], v = veditTexto_(bruto);
  if (def.tipo === "cpf") {
    var d = v.replace(/\D/g, "");
    if (!cpfValido(d)) return { erro: "CPF inválido." };
    return { valor: d };
  }
  if (def.tipo === "email") {
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { erro: def.rot + " inválido." };
    return { valor: v };
  }
  if (def.tipo === "digitos") return { valor: v.replace(/\D/g, "") };
  if (def.tipo === "tipo") {
    v = v.toUpperCase();
    if (["TITULAR", "FILHO", "CONJUGE", "ENTEADO"].indexOf(v) === -1) return { erro: "Tipo de beneficiário inválido." };
    return { valor: v };
  }
  if (def.tipo === "modalidade") {
    v = v.toUpperCase();
    if (v && VEDIT_MODALIDADES.indexOf(v) === -1) return { erro: "Modalidade inválida." };
    return { valor: v };
  }
  if (def.tipo === "regime") {
    v = v.toUpperCase();
    if (v && ["ANUAL", "SEMESTRAL"].indexOf(v) === -1) return { erro: "Regime inválido." };
    return { valor: v };
  }
  if (def.tipo === "percentual") {
    var n = Number(String(v).replace("%", "").replace(",", "."));
    if (!(n > 0 && n <= 100)) return { erro: "Percentual deve ser maior que 0 e no máximo 100." };
    return { valor: n };
  }
  if (def.tipo === "periodo") {
    if (!v) return { erro: "Informe o período." };
    return { valor: (typeof voucherPeriodoParaGravar_ === "function") ? voucherPeriodoParaGravar_(v) : v };
  }
  return { valor: v };
}

/**
 * Grava as mudanças. `campos` = só o que a pessoa mudou (ou tudo; o que for igual é ignorado).
 * opcoes.refazerCertificado: refaz o PDF do voucher já emitido com os dados corrigidos.
 */
function voucherEditarSolicitacao(protocolo, campos, opcoes, tokenSessao) {
  var sessao, travou = false, lock = LockService.getScriptLock();
  try {
    sessao = exigirModulo_(tokenSessao, "beneficios", false);
    protocolo = String(protocolo || "").trim();
    campos = campos || {}; opcoes = opcoes || {};
    if (!protocolo) return { ok: false, mensagem: "Informe o protocolo." };
    lock.waitLock(20000); travou = true;

    var item = buscarSolicitacaoPorProtocolo_(protocolo);
    if (!item) return { ok: false, mensagem: "Solicitação não encontrada." };
    var reg = item.registro, headers = item.headers;
    var status = String(reg.STATUS_SOLICITACAO || "").toUpperCase();
    if (/EXCLU/.test(status)) return { ok: false, mensagem: "Solicitação excluída não pode ser editada." };
    var quem = (sessao && (sessao.email || sessao.usuario || sessao.nome)) || "";

    /* 1) o que realmente mudou, já validado */
    var novos = {}, mudancas = [], erros = [];
    Object.keys(campos).forEach(function (k) {
      if (!VEDIT_CAMPOS[k]) return;                      // chave desconhecida: ignora, nunca grava
      var n = veditNormalizar_(k, campos[k]);
      if (n.erro) { erros.push(n.erro); return; }
      var antigo = veditTexto_(reg[VEDIT_CAMPOS[k].col[0]]);
      if (veditTexto_(n.valor) === antigo) return;       // igual: nada a fazer
      novos[k] = n.valor;
      mudancas.push({ chave: k, rot: VEDIT_CAMPOS[k].rot, de: antigo, para: veditTexto_(n.valor), certificado: !!VEDIT_CAMPOS[k].certificado });
    });
    if (erros.length) return { ok: false, mensagem: erros.join(" ") };
    if (!mudancas.length) return { ok: true, semMudanca: true, mensagem: "Nada foi alterado." };

    /* 2) regras que dependem de mais de um campo */
    var vis = function (k) { return novos[k] !== undefined ? novos[k] : reg[VEDIT_CAMPOS[k].col[0]]; };
    var tipo = veditTexto_(vis("tipoBeneficiario")).toUpperCase(), modal = veditTexto_(vis("modalidade")).toUpperCase();
    var ordem = veditTexto_(vis("ordemFilho"));
    if ((tipo === "FILHO" || tipo === "ENTEADO") && ordem && ["GRADUACAO", "POS_GRADUACAO"].indexOf(modal) === -1) {
      var on = parseInt(ordem, 10);
      if (isNaN(on) || on < 1 || on > 3) return { ok: false, mensagem: "A convenção prevê desconto até o 3º dependente no ensino básico. Informado: " + ordem + "º." };
    }
    var avisos = [];
    if (novos.escola !== undefined && typeof voucherEscolaDoCadastro_ === "function") {
      var cad = null;
      /* só o que a pessoa DIGITOU agora: reaproveitar o CNPJ/ID antigos faria o nome novo casar com a escola velha */
      try { cad = voucherEscolaDoCadastro_({ escola: novos.escola, cnpjEscola: novos.cnpjEscola || "", escolaId: novos.escolaId || "" }); } catch (eC) {}
      if (cad) {   // vale o CADASTRO, não o digitado — escola, fantasia, unidade, CNPJ, cidade e ID juntos
        var pares = { escola: cad.nome, escolaFantasia: cad.fantasia, unidadeEscola: cad.unidade, cnpjEscola: String(cad.cnpj || "").replace(/\D/g, ""), cidadeEscola: cad.cidade, escolaId: cad.escolaId };
        Object.keys(pares).forEach(function (k) {
          var antigo = veditTexto_(reg[VEDIT_CAMPOS[k].col[0]]);
          if (pares[k] !== undefined && veditTexto_(pares[k]) !== antigo && novos[k] === undefined) {
            novos[k] = pares[k]; mudancas.push({ chave: k, rot: VEDIT_CAMPOS[k].rot, de: antigo, para: veditTexto_(pares[k]), certificado: !!VEDIT_CAMPOS[k].certificado });
          }
        });
        novos.escola = cad.nome;
      } else {
        avisos.push("A escola “" + novos.escola + "” não foi encontrada no cadastro de escolas; valeu o que foi digitado. Confira o CNPJ.");
      }
    }

    /* 3) duplicidade: mesma pessoa, mesmo curso, mesmo período (de outra solicitação que ocupa a janela) */
    if (["cpf", "beneficiario", "curso", "periodo", "modalidade", "tipoBeneficiario"].some(function (k) { return novos[k] !== undefined; })) {
      var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(VOUCHER_ABA_SOLICITACOES);
      var dados = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), sh.getLastColumn()).getValues();
      var ix = function (c) { return headers.indexOf(c); };
      var cpfN = veditTexto_(vis("cpf")).replace(/\D/g, ""), benN = veditTexto_(vis("beneficiario")).toUpperCase();
      var curN = veditTexto_(vis("curso")).toUpperCase(), perN = veditTexto_(vis("periodo"));
      var ocupa = (typeof VOUCHER_STATUS_OCUPA_PERIODO_ === "function") ? VOUCHER_STATUS_OCUPA_PERIODO_() : null;
      for (var i = 0; i < dados.length; i++) {
        var lp = veditTexto_(dados[i][ix("NUMERO_PROTOCOLO")]);
        if (!lp || lp === protocolo) continue;
        if (veditTexto_(dados[i][ix("CPF_SOLICITANTE")]).replace(/\D/g, "") !== cpfN) continue;
        if (veditTexto_(dados[i][ix("NOME_BENEFICIARIO")]).toUpperCase() !== benN) continue;
        if (veditTexto_(dados[i][ix("CURSO")]).toUpperCase() !== curN) continue;
        if (veditTexto_(dados[i][ix("PERIODO_REFERENCIA")]) !== perN) continue;
        var st = veditTexto_(dados[i][ix("STATUS_SOLICITACAO")]).toUpperCase();
        if (ocupa && ocupa.indexOf && ocupa.indexOf(st) === -1) continue;
        return { ok: false, duplicado: true, mensagem: "Com essa mudança, esta solicitação ficaria igual à " + lp +
                 " (mesma pessoa, curso e período). Um voucher por pessoa, por curso, por janela." };
      }
    }

    /* 4) grava só as células que mudaram, por nome de coluna */
    var abaSol = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(VOUCHER_ABA_SOLICITACOES);
    Object.keys(novos).forEach(function (k) {
      VEDIT_CAMPOS[k].col.forEach(function (nomeCol) {
        var c = headers.indexOf(nomeCol);
        if (c > -1) abaSol.getRange(item.linha, c + 1).setValue(novos[k]);
      });
    });
    SpreadsheetApp.flush();

    /* 5) o histórico: uma linha por campo */
    mudancas.forEach(function (m) {
      voucherHistoricoAnotar_(protocolo, "CAMPO_EDITADO", quem, m.rot + ": “" + m.de + "” → “" + m.para + "”");
    });

    /* 6) certificado */
    var emi = (typeof voucherLinhaEmitido_ === "function") ? voucherLinhaEmitido_(protocolo) : null;
    var afeta = mudancas.some(function (m) { return m.certificado; });
    var refeito = false, certMsg = "";
    if (emi && afeta) {
      if (opcoes.refazerCertificado === true) {
        try {
          if (novos.percentual !== undefined) {   // o percentual impresso é o do registro da emissão
            var cp = emi.cab.indexOf("PERCENTUAL");
            if (cp > -1) emi.sh.getRange(emi.linha, cp + 1).setValue(novos.percentual);
          }
          var rr = voucherRedatarDocumento_(protocolo, new Date(), "correção de dados", quem, true);
          refeito = !!(rr && rr.ok);
          certMsg = refeito ? " Certificado refeito com os dados corrigidos (mesmo protocolo e código)." : " Não consegui refazer o certificado: " + ((rr && rr.mensagem) || "erro") + " Refaça pelo botão do capelo.";
        } catch (eR) { certMsg = " Não consegui refazer o certificado: " + eR.message + " Refaça pelo botão do capelo."; }
      } else {
        certMsg = " Este voucher já foi emitido e a mudança aparece no certificado — refaça o certificado antes de enviar.";
      }
    }
    return { ok: true, alteradas: mudancas.length, campos: mudancas.map(function (m) { return m.rot; }), avisos: avisos,
             certificadoDesatualizado: !!(emi && afeta && !refeito), certificadoRefeito: refeito,
             mensagem: mudancas.length + " campo(s) alterado(s)." + certMsg };
  } catch (e) {
    Logger.log("voucherEditarSolicitacao: " + e.message + "\n" + (e.stack || ""));
    return { ok: false, mensagem: "Erro ao editar: " + e.message };
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (eL) {} }
  }
}
