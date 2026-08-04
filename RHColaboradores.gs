// ================================
// ARQUIVO: RHColaboradores.gs
// MÓDULO: RH — Colaboradores do próprio sindicato (Fase 1 da auditoria de RH)
//
// Antes, RHAdmin.html gravava cadastro de colaboradores e folha de
// pagamento inteiramente em localStorage do navegador — trocar de
// computador, trocar de navegador ou limpar o cache apagava tudo, e
// não havia nenhum arquivo .gs de backend para o módulo.
//
// Este arquivo é o backend real: abas centralizadas na planilha,
// sessão obrigatória em toda operação, com trilha de quem criou e
// quem atualizou cada colaborador (dado sensível — salário, benefícios).
//
// A folha de pagamento aqui grava um lançamento por colaborador POR
// COMPETÊNCIA, sem sobrescrever meses anteriores — resolve a perda de
// histórico. O cálculo em si (percentual único de encargos) permanece
// o mesmo desta fase; cálculo trabalhista real (INSS progressivo,
// FGTS, IRRF, pró-rata) é a Fase 2 do roadmap da auditoria.
// ================================

var ABA_RH_COLABORADORES = "RH_COLABORADORES";
var ABA_RH_FOLHA = "RH_FOLHA_PAGAMENTO";

function rh_garantirColaboradores_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_COLABORADORES);
  if (!sh) sh = ss.insertSheet(ABA_RH_COLABORADORES);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "NOME", "CARGO", "SETOR", "STATUS", "VENCIMENTO",
      "SALARIO", "BENEFICIOS", "DESCONTOS",
      "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"
    ]);
    sh.getRange(1, 1, 1, 13).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rh_garantirFolha_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_RH_FOLHA);
  if (!sh) sh = ss.insertSheet(ABA_RH_FOLHA);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "ID", "COMPETENCIA", "COLABORADOR_ID", "NOME", "CARGO",
      "SALARIO", "BENEFICIOS", "DESCONTOS", "ENCARGOS_PCT", "ENCARGOS", "BRUTO", "LIQUIDO",
      "OBSERVACAO", "GERADO_POR", "GERADO_EM"
    ]);
    sh.getRange(1, 1, 1, 15).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rh_gerarId_(prefixo) {
  return prefixo + "-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function rh_formatarData_(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v);
}

/* =========================================
 * COLABORADORES
 * ========================================= */
function listarColaboradoresRH(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var sh = rh_garantirColaboradores_();
    if (sh.getLastRow() < 2) return [];

    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    return dados
      .map(function (linha) {
        var obj = {};
        cab.forEach(function (col, i) { obj[col] = linha[i]; });
        return {
          id: String(obj.ID || ""),
          nome: String(obj.NOME || ""),
          cargo: String(obj.CARGO || ""),
          setor: String(obj.SETOR || "Administrativo"),
          status: String(obj.STATUS || "Ativo"),
          vencimento: rh_formatarData_(obj.VENCIMENTO),
          salario: Number(obj.SALARIO || 0),
          beneficios: Number(obj.BENEFICIOS || 0),
          descontos: Number(obj.DESCONTOS || 0)
        };
      })
      .filter(function (x) { return !!x.id; });
  } catch (e) {
    Logger.log("listarColaboradoresRH erro: " + e.message);
    return [];
  }
}

function salvarColaboradorRH(dados, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};
    var nome = String(dados.nome || "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o nome do colaborador." };

    var sh = rh_garantirColaboradores_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();
    var idAlvo = String(dados.id || "").trim();

    var linhaVals = [
      nome,
      String(dados.cargo || "").trim(),
      String(dados.setor || "Administrativo"),
      String(dados.status || "Ativo"),
      dados.vencimento || "",
      Number(dados.salario || 0),
      Number(dados.beneficios || 0),
      Number(dados.descontos || 0)
    ];

    if (idAlvo) {
      var idsCol = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
      for (var i = 0; i < idsCol.length; i++) {
        if (String(idsCol[i][0]) === idAlvo) {
          var linha = i + 2;
          sh.getRange(linha, 2, 1, 8).setValues([linhaVals]);
          sh.getRange(linha, 12).setValue(quem);
          sh.getRange(linha, 13).setValue(agora);
          return { ok: true, id: idAlvo, mensagem: "Colaborador atualizado com sucesso." };
        }
      }
      // ID informado não existe mais (linha removida por outra pessoa) — cadastra como novo.
    }

    var novoId = rh_gerarId_("COL");
    sh.appendRow([novoId].concat(linhaVals).concat([quem, agora, quem, agora]));
    return { ok: true, id: novoId, mensagem: "Colaborador cadastrado com sucesso." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar colaborador: " + e.message };
  }
}

// Exclusão exige administrador — dado sensível (salário) sem trilha de
// recuperação, mesmo padrão de excluirReceita/excluirEscolasEmLote.
function excluirColaboradorRH(id, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    id = String(id || "").trim();
    if (!id) return { ok: false, mensagem: "Informe o colaborador a excluir." };

    var sh = rh_garantirColaboradores_();
    if (sh.getLastRow() < 2) return { ok: false, mensagem: "Colaborador não encontrado." };

    var idsCol = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = idsCol.length - 1; i >= 0; i--) {
      if (String(idsCol[i][0]) === id) {
        sh.deleteRow(i + 2);
        return { ok: true, mensagem: "Colaborador excluído com sucesso." };
      }
    }
    return { ok: false, mensagem: "Colaborador não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao excluir colaborador: " + e.message };
  }
}

/* =========================================
 * FOLHA DE PAGAMENTO — um lançamento por colaborador por competência.
 * Reprocessar uma competência substitui só os lançamentos DAQUELA
 * competência, preservando o histórico dos meses anteriores.
 * ========================================= */
function gerarFolhaRH(competencia, percentualEncargos, observacao, tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    competencia = String(competencia || "").trim();
    if (!competencia) return { ok: false, mensagem: "Informe a competência." };
    var perc = Number(percentualEncargos || 0);

    var colaboradores = listarColaboradoresRH(tokenSessao).filter(function (c) { return c.status !== "Desligado"; });

    var sh = rh_garantirFolha_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";
    var agora = new Date();

    if (sh.getLastRow() > 1) {
      var existentes = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = existentes.length - 1; i >= 0; i--) {
        if (String(existentes[i][1]) === competencia) sh.deleteRow(i + 2);
      }
    }

    var linhas = colaboradores.map(function (c) {
      var salario = Number(c.salario || 0), beneficios = Number(c.beneficios || 0), descontos = Number(c.descontos || 0);
      var encargos = salario * (perc / 100);
      var bruto = salario + beneficios;
      var liquido = bruto - descontos;
      return [
        rh_gerarId_("FOLHA"), competencia, c.id, c.nome, c.cargo,
        salario, beneficios, descontos, perc, encargos, bruto, liquido,
        observacao || "", quem, agora
      ];
    });

    if (linhas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    }

    return {
      ok: true,
      competencia: competencia,
      linhas: linhas.map(function (l) {
        return { id: l[0], competencia: l[1], colaboradorId: l[2], nome: l[3], cargo: l[4],
                 salario: l[5], beneficios: l[6], descontos: l[7], encargosPct: l[8],
                 encargos: l[9], bruto: l[10], liquido: l[11] };
      }),
      mensagem: "Folha de " + competencia + " gerada com " + linhas.length + " colaborador(es)."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao gerar folha: " + e.message };
  }
}

function listarFolhaRH(competencia, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    competencia = String(competencia || "").trim();
    var sh = rh_garantirFolha_();
    if (sh.getLastRow() < 2) return [];

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    return dados
      .filter(function (l) { return !competencia || String(l[1]) === competencia; })
      .map(function (l) {
        return { id: l[0], competencia: l[1], colaboradorId: l[2], nome: l[3], cargo: l[4],
                 salario: Number(l[5] || 0), beneficios: Number(l[6] || 0), descontos: Number(l[7] || 0),
                 encargosPct: Number(l[8] || 0), encargos: Number(l[9] || 0),
                 bruto: Number(l[10] || 0), liquido: Number(l[11] || 0) };
      });
  } catch (e) {
    Logger.log("listarFolhaRH erro: " + e.message);
    return [];
  }
}
