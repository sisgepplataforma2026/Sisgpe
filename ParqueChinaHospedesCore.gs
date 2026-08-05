// ============================================================================
// ARQUIVO: ParqueChinaHospedesCore.gs
//
// ⚠️ O SUFIXO "Core" NO NOME NÃO É ENFEITE — NÃO RENOMEIE PARA
//    "ParqueChinaHospedes.gs".
// O Apps Script não aceita dois arquivos com o mesmo nome no mesmo projeto,
// nem quando um é script e o outro é HTML. A tela pública PRECISA se chamar
// ParqueChinaHospedes, porque Code.gs a pede por esse nome literal em
// createHtmlOutputFromFile("ParqueChinaHospedes"). Já o nome deste arquivo
// não tem efeito nenhum: o Apps Script coloca todas as funções de todos os
// .gs no mesmo escopo global. Então quem cede é este aqui.
// (Descoberto na implantação de 2026-08-05, quando o editor recusou o nome.)
//
// SEGUNDA ETAPA DO CHINA PARK — o solicitante informa quem vai se hospedar.
//
// POR QUE EXISTE
// Depois da reserva aprovada, o sindicato precisa mandar ao China Park um
// ofício com o nome de cada pessoa autorizada a entrar. Até aqui esses nomes
// eram digitados pela secretaria, um a um, a partir do que chegava no
// WhatsApp. Agora quem se hospeda preenche — e o ofício sai do que ele mesmo
// escreveu, sem redigitação e sem erro de transcrição de nome.
//
// COMO O LINK É PROTEGIDO SEM LOGIN
// Quem preenche não tem conta no SISGEP. O link carrega um token derivado do
// ID da reserva com HMAC-SHA256 e um segredo guardado no cofre do script
// (ScriptProperties). Consequências dessa escolha:
//   • não dá para adivinhar o link de outra reserva mudando um número;
//   • não precisou de coluna nova na planilha — o token se recalcula;
//   • se o segredo for trocado, todos os links antigos param de valer, o que
//     é o comportamento certo para um link que circula em WhatsApp.
// O token identifica a reserva. Ele NÃO é senha: quem tem o link edita os
// hóspedes daquela reserva, e é isso que se quer — a pessoa repassa para o
// acompanhante preencher.
//
// O QUE O LINK NÃO PERMITE
// Ver valor, ver outras reservas, mudar data, mudar suíte, aprovar, cancelar.
// Só os nomes dos acompanhantes da própria reserva, e só enquanto ela estiver
// aprovada. Reserva cancelada, recusada ou finalizada devolve recado e não
// grava nada.
// ============================================================================

var PC_HOSP_CHAVE_SEGREDO = "PC_HOSPEDES_SEGREDO";

/** Segredo do cofre, criado na primeira vez que alguém gera um link. */
function pcHosp_segredo_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty(PC_HOSP_CHAVE_SEGREDO);
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(PC_HOSP_CHAVE_SEGREDO, s);
  }
  return s;
}

function pcHosp_token_(idReserva) {
  var bruto = Utilities.computeHmacSha256Signature(String(idReserva || ""), pcHosp_segredo_());
  return Utilities.base64EncodeWebSafe(bruto).replace(/=+$/g, "").slice(0, 32);
}

/**
 * Descobre a reserva a partir do token. Percorre as reservas e recalcula o
 * token de cada uma — não há coluna para consultar, de propósito (ver o
 * cabeçalho). O custo é uma varredura por acesso ao link, aceitável para a
 * ordem de grandeza de reservas do sindicato.
 */
function pcHosp_localizar_(token) {
  token = String(token || "").trim();
  if (!token) return null;
  var aba = obterAbaReservaParqueChina_(), last = aba.getLastRow();
  if (last < 2) return null;
  var dados = aba.getRange(2, 1, last - 1, PC_CABECALHO.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    var id = String(dados[i][PC_COL.ID_RESERVA - 1] || "");
    if (id && pcHosp_token_(id) === token) return { linha: i + 2, valores: dados[i] };
  }
  return null;
}

/** Só reserva viva aceita hóspede. */
function pcHosp_statusAceita_(status) {
  return [PC_STATUS.APROVADA, PC_STATUS.AGUARDANDO_PAGAMENTO].indexOf(String(status || "")) !== -1;
}

function pcHosp_dataBR_(v) {
  if (!v) return "";
  var d = (v instanceof Date) ? v : new Date(v);
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, PARQUE_CHINA_CONFIG.TIMEZONE, "dd/MM/yyyy");
}

/* ═══════════════════ LADO ADMINISTRATIVO ═══════════════════ */

/**
 * Monta o link e a mensagem de WhatsApp para pedir os hóspedes.
 * Exige sessão com o módulo Benefícios — é a equipe que dispara.
 */
function pcHospedesPrepararLink(idReserva, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);

    var achada = buscarReservaParqueChinaPorId_(idReserva);
    if (!achada) return { ok: false, mensagem: "Reserva não encontrada." };

    var r = mapearLinhaParaObjetoParqueChina_(achada.valores);
    if (!pcHosp_statusAceita_(r.status)) {
      return { ok: false, mensagem: "A reserva precisa estar aprovada para pedir os hóspedes. Situação atual: " + r.status + "." };
    }

    var url = benefUrlBase_() + "?portal=chinapark-hospedes&t=" + pcHosp_token_(r.idReserva);
    var suite = r.suiteDefinida || r.suiteSolicitada || "a definir";

    var texto = [
      "*SINDEDUCAÇÃO-ES*",
      "*Reserva aprovada — China Park Eco Resort*",
      "",
      "Olá, *" + r.nomeSolicitante + "*.",
      "Sua reserva foi aprovada.",
      "",
      "*Protocolo:* " + r.idReserva,
      "*Período:* " + pcHosp_dataBR_(r.dataEntrada) + " a " + pcHosp_dataBR_(r.dataSaida),
      "*Chalé:* " + suite,
      "*Pessoas:* " + (r.quantidadePessoas || "—"),
      "",
      "Para liberarmos a entrada no parque, informe o nome completo de cada pessoa que vai se hospedar:",
      "",
      url,
      "",
      "_Sem essa lista não conseguimos emitir a autorização de entrada._"
    ].join("\n");

    return {
      ok: true,
      idReserva: r.idReserva,
      url: url,
      texto: texto,
      telefone: benefTelefoneWhats_(r.telefone),
      nomeSolicitante: r.nomeSolicitante
    };
  } catch (erro) {
    Logger.log("pcHospedesPrepararLink: " + erro);
    return { ok: false, mensagem: pcMensagemErro_(erro) };
  }
}

/* ═══════════════════ LADO PÚBLICO (sem login) ═══════════════════ */

/**
 * Dados que a tela pública mostra. Devolve só o necessário para a pessoa se
 * reconhecer — nunca valor, nunca CPF, nunca observação interna.
 */
function pcHospedesCarregar(token) {
  try {
    var achada = pcHosp_localizar_(token);
    if (!achada) return { ok: false, mensagem: "Link inválido ou expirado. Fale com a secretaria do sindicato." };

    var r = mapearLinhaParaObjetoParqueChina_(achada.valores);
    if (!pcHosp_statusAceita_(r.status)) {
      return { ok: false, mensagem: "Esta reserva não está mais ativa. Fale com a secretaria do sindicato." };
    }

    var qtd = Number(r.quantidadePessoas || 1);
    var vagas = Math.max(0, Math.min(4, qtd - 1)); // o titular não entra na lista

    return {
      ok: true,
      protocolo: r.idReserva,
      titular: r.nomeSolicitante,
      entrada: pcHosp_dataBR_(r.dataEntrada),
      saida: pcHosp_dataBR_(r.dataSaida),
      chale: r.suiteDefinida || r.suiteSolicitada || "a definir",
      quantidadePessoas: qtd,
      vagasAcompanhantes: vagas,
      acompanhantes: [r.dependente1, r.dependente2, r.dependente3, r.dependente4]
        .map(function (n) { return String(n || "").trim(); })
    };
  } catch (erro) {
    Logger.log("pcHospedesCarregar: " + erro);
    return { ok: false, mensagem: "Não foi possível abrir a reserva. Tente novamente." };
  }
}

/**
 * Grava os acompanhantes. Pode ser reenviado — a lista sempre substitui a
 * anterior, e cada envio vira um evento na auditoria com o que havia antes.
 */
function pcHospedesSalvar(token, dados) {
  try {
    dados = dados || {};
    var achada = pcHosp_localizar_(token);
    if (!achada) return { ok: false, mensagem: "Link inválido ou expirado. Fale com a secretaria do sindicato." };

    var r = mapearLinhaParaObjetoParqueChina_(achada.valores);
    if (!pcHosp_statusAceita_(r.status)) {
      return { ok: false, mensagem: "Esta reserva não está mais ativa. Fale com a secretaria do sindicato." };
    }

    var qtd = Number(r.quantidadePessoas || 1);
    var vagas = Math.max(0, Math.min(4, qtd - 1));

    var nomes = (dados.acompanhantes || [])
      .map(function (n) { return pcSanitizarCelula_(String(n || "").trim()); })
      .filter(function (n) { return n.length > 0; });

    if (nomes.length > vagas) {
      return { ok: false, mensagem: "A reserva é para " + qtd + " pessoa(s), então cabem no máximo " +
        vagas + " acompanhante(s) além de " + r.nomeSolicitante + "." };
    }
    for (var i = 0; i < nomes.length; i++) {
      if (nomes[i].length < 5 || nomes[i].indexOf(" ") === -1) {
        return { ok: false, mensagem: "Informe o nome completo de cada acompanhante (nome e sobrenome)." };
      }
    }

    // O lock protege contra dois acompanhantes preenchendo o mesmo link ao
    // mesmo tempo — situação real quando o titular repassa a mensagem.
    return pcComLock_(function () {
      var aba = obterAbaReservaParqueChina_(), linha = achada.linha;
      var anterior = [r.dependente1, r.dependente2, r.dependente3, r.dependente4]
        .map(function (n) { return String(n || "").trim(); }).filter(function (n) { return n; });

      for (var c = 0; c < 4; c++) {
        aba.getRange(linha, PC_COL.DEPENDENTE_1 + c).setValue(nomes[c] || "");
      }
      aba.getRange(linha, PC_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(linha, PC_COL.ATUALIZADO_POR).setValue("Solicitante (link de hóspedes)");

      pcAuditar_(r.idReserva, "HOSPEDES_INFORMADOS", anterior.join(" | "), nomes.join(" | "),
        "Solicitante", "", { totalAnterior: anterior.length, totalNovo: nomes.length });

      pcInvalidarCache_();

      return {
        ok: true,
        protocolo: r.idReserva,
        total: nomes.length,
        mensagem: nomes.length
          ? "Lista recebida. A autorização de entrada será emitida pela secretaria."
          : "Lista salva sem acompanhantes — apenas " + r.nomeSolicitante + " se hospedará."
      };
    });
  } catch (erro) {
    Logger.log("pcHospedesSalvar: " + erro);
    return { ok: false, mensagem: "Não foi possível salvar. Tente novamente em instantes." };
  }
}
