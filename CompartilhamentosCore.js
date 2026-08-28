// ============================================================================
// ARQUIVO: CompartilhamentosCore.gs
// COMPARTILHAMENTOS — item 16.6 do PROMPT-MESTRE (Auditoria e Compliance).
//
// O QUE ESTE ARQUIVO RESOLVE
// O SISGEP gera links que abrem SEM LOGIN: o fornecedor envia nota fiscal
// por um, a contabilidade confirma pagamento por outro. Quem tem o link
// entra — é essa a natureza deles, e é o que os torna úteis.
//
// O problema é que, até aqui, ninguém tinha a lista. Não havia como
// responder "quantos links estão no ar", "para quem foram", nem — o que mais
// importa — "como eu desligo aquele que foi para o endereço errado".
//
// REVOGAÇÃO QUE REVOGA DE VERDADE
// Um botão "revogar" que só muda o status numa tela é pior que não existir:
// dá a sensação de controle sem o controle. Aqui a revogação é consultada
// pelos DOIS funis de validação de token do Despesas.gs
// (buscarTokenFornecedorDespesa_ e buscarTokenContabilidadeDespesa_), que é
// por onde todo acesso público passa obrigatoriamente. Revogado ali, o link
// para de abrir.
//
// POR QUE PLANILHA, E NÃO A TRILHA
// A trilha é imutável por desenho — é o que a torna prova. Revogação é
// mudança de estado: um link nasce ativo e pode virar revogado. Estado
// mutável não cabe num registro que não se altera. Então o link vive numa
// aba própria, e cada mudança dele ENTRA na trilha como evento.
// ============================================================================

var COMPART_ABA = "SISGEP_Links";
var COMPART_MODULO = "auditoria";

var COMPART_COLUNAS = [
  "ID", "TOKEN", "TIPO", "REFERENCIA", "PARA", "CRIADO_EM", "CRIADO_POR",
  "VALIDADE", "ESTADO", "USADO_EM", "REVOGADO_EM", "REVOGADO_POR", "MOTIVO"
];

var COMPART_TIPOS = {
  NF_FORNECEDOR: { rotulo: "Envio de nota fiscal", quem: "Fornecedor", revogavel: true },
  CONTABILIDADE: { rotulo: "Confirmação de pagamento", quem: "Contabilidade", revogavel: true },
  PIXEL_LEITURA: { rotulo: "Pixel de leitura de e-mail", quem: "Destinatário do e-mail", revogavel: false }
};

function compart_aba_() {
  return abaSisgep_(COMPART_ABA, COMPART_COLUNAS);
}

/**
 * Registra um link recém-criado. NUNCA lança — é chamada de dentro do fluxo
 * que manda o e-mail ao fornecedor, e falhar aqui não pode impedir o e-mail.
 */
function compart_registrar_(d) {
  try {
    d = d || {};
    if (!d.token || !d.tipo) return { ok: false, mensagem: "Faltou token ou tipo." };

    var aba = compart_aba_();
    var id = "LNK-" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss") +
             "-" + String(d.token).slice(0, 6);

    aba.appendRow([
      id, d.token, String(d.tipo).toUpperCase(), d.referencia || "", d.para || "",
      new Date(), d.criadoPor || "SISTEMA",
      d.validade instanceof Date ? d.validade : (d.validade ? new Date(d.validade) : ""),
      "ATIVO", "", "", "", ""
    ]);

    if (typeof auditar_ === "function") {
      auditar_({
        registroId: d.referencia || id,
        modulo: "Auditoria e Compliance", submodulo: "Compartilhamentos",
        acao: "GERAR_LINK_PUBLICO",
        usuario: d.criadoPor,
        justificativa: (COMPART_TIPOS[String(d.tipo).toUpperCase()] || {}).rotulo +
          (d.para ? " · para " + d.para : "")
      });
    }
    return { ok: true, id: id };
  } catch (e) {
    Logger.log("compart_registrar_ falhou (o link seguiu): " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/**
 * O link foi revogado?
 *
 * Consultada pelos funis de validação do Despesas.gs. Precisa ser barata e,
 * sobretudo, precisa errar para o lado SEGURO: se a checagem falhar, devolve
 * false — o link continua valendo.
 *
 * Essa escolha merece explicação, porque a intuição pede o contrário. Se um
 * erro de leitura bloqueasse todos os links, uma falha na planilha derrubaria
 * o envio de nota fiscal de todos os fornecedores de uma vez, sem ninguém
 * entender por quê. Revogação é exceção rara; indisponibilidade não pode
 * virar bloqueio geral.
 */
function compart_revogado_(token) {
  try {
    if (!token) return false;
    var aba = compart_aba_();
    if (!aba || aba.getLastRow() < 2) return false;

    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, COMPART_COLUNAS.length).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][1]) === String(token)) {
        return String(dados[i][8]).toUpperCase() === "REVOGADO";
      }
    }
    return false;
  } catch (e) {
    Logger.log("compart_revogado_ falhou — link mantido: " + e.message);
    return false;
  }
}

/** Marca o link como usado. Também não lança. */
function compart_marcarUsado_(token) {
  try {
    var aba = compart_aba_();
    if (!aba || aba.getLastRow() < 2) return;
    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, COMPART_COLUNAS.length).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][1]) === String(token)) {
        // Só o primeiro uso é registrado — a data de "usado" responde quando
        // o destinatário abriu, não quantas vezes voltou.
        if (!dados[i][9]) {
          aba.getRange(i + 2, 10).setValue(new Date());
          if (String(dados[i][8]).toUpperCase() === "ATIVO") {
            aba.getRange(i + 2, 9).setValue("USADO");
          }
        }
        return;
      }
    }
  } catch (e) { Logger.log("compart_marcarUsado_ falhou: " + e.message); }
}

/* ==========================================================================
 * API DA TELA
 * ========================================================================== */

/** Estado derivado: ATIVO vira EXPIRADO quando a validade passou. */
function compart_estadoAtual_(estado, validade) {
  var e = String(estado || "").toUpperCase();
  if (e === "REVOGADO" || e === "USADO") return e;
  if (validade) {
    var v = (validade instanceof Date) ? validade : new Date(validade);
    if (!isNaN(v.getTime()) && v.getTime() < new Date().getTime()) return "EXPIRADO";
  }
  return e || "ATIVO";
}

function compartListar(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, COMPART_MODULO, false);
  filtros = filtros || {};

  var aba = compart_aba_();
  if (!aba || aba.getLastRow() < 2) return { ok: true, total: 0, links: [] };

  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, COMPART_COLUNAS.length).getValues();
  var links = dados.map(function (l) {
    var tipo = COMPART_TIPOS[String(l[2]).toUpperCase()] || { rotulo: l[2], quem: "", revogavel: false };
    return {
      id: l[0],
      // O token NUNCA sai inteiro para a tela: quem lê a lista veria o link
      // funcionando e poderia usá-lo. Um prefixo basta para correlacionar.
      tokenPrefixo: String(l[1]).slice(0, 8),
      tipo: String(l[2]).toUpperCase(), tipoRotulo: tipo.rotulo, quem: tipo.quem,
      revogavel: tipo.revogavel === true,
      referencia: l[3], para: l[4], criadoEm: l[5], criadoPor: l[6],
      validade: l[7], estado: compart_estadoAtual_(l[8], l[7]),
      usadoEm: l[9], revogadoEm: l[10], revogadoPor: l[11], motivo: l[12]
    };
  });

  if (filtros.estado) {
    links = links.filter(function (x) { return x.estado === String(filtros.estado).toUpperCase(); });
  }
  links.reverse();

  return {
    ok: true, total: links.length, links: links,
    resumo: links.reduce(function (m, x) { m[x.estado] = (m[x.estado] || 0) + 1; return m; }, {})
  };
}

/**
 * Revoga um link. Exige administrador e motivo.
 *
 * O motivo é obrigatório de propósito: revogar é desligar o acesso de alguém
 * de fora que estava contando com ele — o fornecedor que ia mandar a nota
 * fiscal descobre que o link parou, sem explicação. Quem revoga precisa
 * deixar escrito por quê.
 */
function compartRevogar(id, motivo, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, COMPART_MODULO, true);
  motivo = String(motivo || "").trim();
  if (motivo.length < 5) {
    return { ok: false, mensagem: "Escreva o motivo da revogação (mínimo 5 caracteres)." };
  }

  var aba = compart_aba_();
  if (!aba || aba.getLastRow() < 2) return { ok: false, mensagem: "Nenhum link registrado." };

  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, COMPART_COLUNAS.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) !== String(id)) continue;

    var tipo = COMPART_TIPOS[String(dados[i][2]).toUpperCase()];
    if (!tipo || tipo.revogavel !== true) {
      return { ok: false, mensagem: "Este tipo de link não é revogável — o pixel de leitura " +
        "não dá acesso a nada, só registra que o e-mail foi aberto." };
    }
    if (String(dados[i][8]).toUpperCase() === "REVOGADO") {
      return { ok: false, mensagem: "Este link já estava revogado." };
    }

    aba.getRange(i + 2, 9).setValue("REVOGADO");
    aba.getRange(i + 2, 11).setValue(new Date());
    aba.getRange(i + 2, 12).setValue(sessao.email || sessao.usuario || "—");
    aba.getRange(i + 2, 13).setValue(motivo);

    auditar_({
      registroId: dados[i][3] || id,
      modulo: "Auditoria e Compliance", submodulo: "Compartilhamentos",
      acao: "REVOGAR_LINK_PUBLICO", sessao: sessao,
      valorAnterior: { estado: dados[i][8] }, valorNovo: { estado: "REVOGADO" },
      justificativa: motivo
    });

    return { ok: true, mensagem: "Link revogado. Ele deixa de abrir a partir de agora." };
  }
  return { ok: false, mensagem: "Link não encontrado." };
}
