// ================================
// ARQUIVO: InicioResumo.gs
// MÓDULO: Início (Home) — resumo real do dia
//
// A tela Início reutiliza as fontes canônicas dos próprios módulos em vez
// de recalcular contagens. Esta versão acrescenta três garantias importantes:
//   1) o resumo só consulta módulos aos quais a sessão tem acesso;
//   2) falhas de fonte são registradas separadamente do valor exibido, para
//      que o frontend possa diferenciar "zero" de "não foi possível atualizar";
//   3) atividades recentes da SOFIA são filtradas pelo usuário da sessão,
//      evitando exposição de perguntas de outros usuários na Home.
//
// Fontes atuais:
//   - E-mails             → getCockpit (CockpitCore.gs)
//   - Ofícios             → getDashboardOficiosData (DashboardOficios.gs)
//   - Jurídico            → jurListarProcessos (Juridico.gs)
//   - Notas fiscais       → obterResumoDespesas_interno_ (Despesas.gs)
//   - Escolas             → listarEscolasCadastro (Escolas.gs)
//   - Atividades da SOFIA → aba Sofia_Auditoria (ChatIACore.gs)
//
// IMPORTANTE: "Saúde do sindicato" ainda não possui regra de negócio
// canônica. Mantém-se provisoriamente a regra simples ATENÇÃO/OK somente para
// fontes disponíveis. Fonte sem acesso ou com falha retorna "—".
// ================================

function getResumoInicioSISGEP(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, false);

  var fontes = {};

  fontes.notasFiscais = inicio_executarFonte_(
    sessao,
    "financeiro",
    "Notas fiscais",
    function () { return inicio_contarNotasFiscaisAguardando_(); }
  );

  fontes.emails = inicio_executarFonte_(
    sessao,
    "comunicacao",
    "E-mails urgentes",
    function () { return inicio_contarEmailsUrgentes_(tokenSessao); }
  );

  // Ofícios pertence ao módulo Documentos no catálogo de acesso.
  fontes.oficios = inicio_executarFonte_(
    sessao,
    "documentos",
    "Ofícios pendentes",
    function () { return inicio_contarOficiosPendentes_(tokenSessao); }
  );

  fontes.juridico = inicio_executarFonte_(
    sessao,
    "juridico",
    "Prazos jurídicos",
    function () { return inicio_contarProcessosJuridicosComPrazo_(tokenSessao); }
  );

  fontes.escolasIncompletas = inicio_executarFonte_(
    sessao,
    "escolas",
    "Cadastros de escolas incompletos",
    function () { return inicio_contarEscolasCadastroIncompleto_(tokenSessao); }
  );

  var prioridades = {
    // Compatibilidade com o frontend atual: enquanto a UI não consumir
    // `statusFontes`, campos indisponíveis continuam numéricos. O status
    // verdadeiro fica separado e NÃO é perdido.
    notasFiscais: inicio_valorCompat_(fontes.notasFiscais),
    emails: inicio_valorCompat_(fontes.emails),
    oficios: inicio_valorCompat_(fontes.oficios),
    juridico: inicio_valorCompat_(fontes.juridico),
    escolasIncompletas: inicio_valorCompat_(fontes.escolasIncompletas)
  };

  return {
    ok: true,
    atualizadoEm: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
    prioridades: prioridades,
    statusFontes: fontes,
    saude: {
      financeiro: inicio_statusSaude_(fontes.notasFiscais),
      administrativo: inicio_statusSaude_(fontes.escolasIncompletas),
      juridico: inicio_statusSaude_(fontes.juridico),
      comunicacao: inicio_statusSaude_(fontes.emails),
      oficios: inicio_statusSaude_(fontes.oficios)
    },
    atividadesRecentes: inicio_atividadesRecentesSofia_(sessao)
  };
}

/**
 * Executa uma fonte respeitando a permissão da sessão e preservando o estado
 * real da consulta. Nunca transforma "sem acesso" ou "falhou" em sucesso.
 */
function inicio_executarFonte_(sessao, modulo, rotulo, fn) {
  try {
    if (typeof sessaoPodeModulo_ === "function" && !sessaoPodeModulo_(sessao, modulo)) {
      return {
        ok: false,
        disponivel: false,
        semAcesso: true,
        modulo: modulo,
        rotulo: rotulo,
        valor: null,
        mensagem: "Sem acesso a este módulo."
      };
    }

    var valor = Number(fn());
    if (!isFinite(valor)) throw new Error("valor inválido retornado pela fonte");

    return {
      ok: true,
      disponivel: true,
      semAcesso: false,
      modulo: modulo,
      rotulo: rotulo,
      valor: valor,
      mensagem: ""
    };
  } catch (e) {
    Logger.log("[Início] falha em " + rotulo + ": " + e.message);
    return {
      ok: false,
      disponivel: false,
      semAcesso: false,
      modulo: modulo,
      rotulo: rotulo,
      valor: null,
      mensagem: "Não foi possível atualizar esta informação."
    };
  }
}

function inicio_valorCompat_(fonte) {
  return fonte && fonte.ok ? Number(fonte.valor || 0) : 0;
}

function inicio_statusSaude_(fonte) {
  if (!fonte || !fonte.ok) return "—";
  return Number(fonte.valor || 0) > 0 ? "ATENÇÃO" : "OK";
}

function inicio_contarNotasFiscaisAguardando_() {
  var r = obterResumoDespesas_interno_();
  if (!r || !r.ok || !r.resumo) throw new Error("resumo financeiro indisponível");
  return Number(r.resumo.totalDocRecebido || 0);
}

function inicio_contarEmailsUrgentes_(tokenSessao) {
  var r = getCockpit(tokenSessao);
  if (!r || !r.ok || !r.indicadores) throw new Error("cockpit de e-mails indisponível");
  return Number(r.indicadores.urgentes || 0);
}

function inicio_contarOficiosPendentes_(tokenSessao) {
  var r = getDashboardOficiosData({}, tokenSessao);
  if (!r || !r.resumo) throw new Error("dashboard de ofícios indisponível");
  return Number(r.resumo.pendentes || 0);
}

function inicio_contarProcessosJuridicosComPrazo_(tokenSessao) {
  var r = jurListarProcessos(tokenSessao);
  if (!r || !r.ok || !Array.isArray(r.itens)) throw new Error("lista jurídica indisponível");

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return r.itens.filter(function (x) {
    if (x.status === "Concluído" || !x.prazo) return false;
    var dataPrazo = new Date(x.prazo + "T00:00:00");
    if (isNaN(dataPrazo.getTime())) return false;
    var d = Math.ceil((dataPrazo - hoje) / 86400000);
    return d >= 0 && d <= 15;
  }).length;
}

function inicio_contarEscolasCadastroIncompleto_(tokenSessao) {
  var escolas = listarEscolasCadastro(tokenSessao);
  if (!Array.isArray(escolas)) throw new Error("cadastro de escolas indisponível");

  return escolas.filter(function (e) {
    return !e.CNPJ || String(e.CNPJ).replace(/\D/g, "").length !== 14 || !e.Email;
  }).length;
}

/**
 * Retorna somente as atividades recentes da SOFIA pertencentes ao usuário
 * logado. A aba Sofia_Auditoria é global, portanto jamais deve ser devolvida
 * diretamente para a Home sem filtro de identidade.
 */
function inicio_atividadesRecentesSofia_(sessao) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName("Sofia_Auditoria");
    if (!aba || aba.getLastRow() < 2) return [];

    var emailSessao = String((sessao && sessao.email) || "").trim().toLowerCase();
    var nomeSessao = String((sessao && (sessao.nome || sessao.usuario)) || "").trim().toLowerCase();

    // Lê uma janela recente em vez da planilha inteira. Se houver grande
    // volume de uso, esta janela pode evoluir para índice/cache específico.
    var ultimaLinha = aba.getLastRow();
    var primeiraLinha = Math.max(2, ultimaLinha - 199);
    var dados = aba.getRange(primeiraLinha, 1, ultimaLinha - primeiraLinha + 1, 7).getValues();

    return dados.reverse().filter(function (l) {
      var nomeLinha = String(l[1] || "").trim().toLowerCase();
      var emailLinha = String(l[2] || "").trim().toLowerCase();

      if (emailSessao) return emailLinha === emailSessao;
      if (nomeSessao) return nomeLinha === nomeSessao;
      return false;
    }).slice(0, 5).map(function (l) {
      return {
        dataHora: String(l[0] || ""),
        dominio: String(l[3] || "Geral"),
        pergunta: String(l[4] || "").substring(0, 90),
        ok: l[6] === true
      };
    });
  } catch (e) {
    Logger.log("[Início] falha ao ler atividades recentes da SOFIA: " + e.message);
    return [];
  }
}
