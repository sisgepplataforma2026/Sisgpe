// ================================
// ARQUIVO: RHTempoServico.gs
// MÓDULO: RH — Elegibilidade a Quinquênio/Decênio por tempo de serviço
//
// Pedido do usuário: calcular automaticamente, pela data de admissão de
// cada colaborador, se ele tem direito a Quinquênio/Decênio da
// convenção coletiva — sem precisar aplicar rubrica fixa manualmente
// pessoa por pessoa.
//
// IMPORTANTE sobre a origem da regra: não temos o texto da CCT em mãos
// neste arquivo — a regra abaixo foi DERIVADA cruzando a admissão dos 7
// colaboradores reais com o valor de QUINQUENIO/DECENIO que já constava
// no Extrato Mensal 06/2026, e bateu 100% nos 4 casos que tinham uma
// das duas rubricas (Celismar e Marcelha com ~6-7 anos → Quinquênio =
// exatamente 5% do salário; Fabiana e Karla com 15+/17+ anos → Decênio
// = exatamente 10% do salário, sem quinquênio somado). Ou seja: 5% para
// quem tem de 5 a 9 anos completos de admissão, 10% para quem tem 10
// anos ou mais (substitui o quinquênio, não acumula).
//
// Nenhum dos 7 colaboradores reais tem 15/20 anos de casa — então uma
// eventual faixa adicional da convenção (ex.: "vintênio") NÃO está
// coberta por esta regra. Se existir, só dá pra confirmar com o texto
// da CCT — não foi inventada aqui.
// ================================

var RH_PCT_QUINQUENIO_ = 5;
var RH_PCT_DECENIO_ = 10;
var RH_CODIGO_QUINQUENIO_ = "292";
var RH_CODIGO_DECENIO_ = "355";

function rh_anosServicoCompletos_(admissaoISO, dataRef) {
  if (!admissaoISO) return null;
  var admissao = new Date(admissaoISO + "T00:00:00");
  if (isNaN(admissao.getTime())) return null;
  var ref = dataRef || new Date();
  var anos = ref.getFullYear() - admissao.getFullYear();
  var aniversarioEsteAno = new Date(ref.getFullYear(), admissao.getMonth(), admissao.getDate());
  if (ref < aniversarioEsteAno) anos--;
  return Math.max(0, anos);
}

function rh_elegibilidadeTempoServico_(anos) {
  if (anos >= 10) return "DECENIO";
  if (anos >= 5) return "QUINQUENIO";
  return "NENHUM";
}

/* =========================================
 * VERIFICAÇÃO — só leitura, compara o que já está aplicado (rubricas
 * fixas) contra o que o tempo de serviço calcula agora.
 * ========================================= */

function verificarQuinquenioDecenioRH_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return rh_verificarQuinquenioDecenio_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao verificar: " + e.message };
  }
}

function rh_verificarQuinquenioDecenio_() {
  var colaboradores = listarColaboradoresRH_interno_().filter(function (c) { return c.status !== "Desligado"; });
  var hoje = new Date();

  var itens = colaboradores.map(function (c) {
    var anos = rh_anosServicoCompletos_(c.admissao, hoje);
    var elegibilidade = anos === null ? "SEM_ADMISSAO" : rh_elegibilidadeTempoServico_(anos);
    var fixas = rh_listarRubricasFixasColaborador_interno_(c.id).filter(function (f) { return f.ativo; });
    var temQuinquenio = fixas.some(function (f) { return f.codigo === RH_CODIGO_QUINQUENIO_; });
    var temDecenio = fixas.some(function (f) { return f.codigo === RH_CODIGO_DECENIO_; });
    var situacaoAtual = temDecenio ? "DECENIO" : (temQuinquenio ? "QUINQUENIO" : "NENHUM");

    return {
      colaboradorId: c.id, nome: c.nome, admissao: c.admissao,
      anosServico: anos, elegibilidadeCalculada: elegibilidade,
      situacaoAtual: situacaoAtual, divergente: situacaoAtual !== elegibilidade
    };
  });

  return { ok: true, itens: itens, divergentes: itens.filter(function (i) { return i.divergente; }).length };
}

/* =========================================
 * APLICAÇÃO — só mexe em quem está divergente. Ativa a rubrica fixa
 * certa (com valor calculado automaticamente: salário × percentual) e
 * desativa a outra, se for o caso (ninguém acumula quinquênio+decênio).
 * ========================================= */

function aplicarQuinquenioDecenioRH_publico(tokenSessao) {
  var sessao = exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var verificacao = rh_verificarQuinquenioDecenio_();
    var quem = sessao.nome || sessao.usuario || "SISGEP";

    var catalogo = rh_listarRubricas_interno_();
    var rubricaQuinquenio = catalogo.filter(function (r) { return r.codigo === RH_CODIGO_QUINQUENIO_; })[0];
    var rubricaDecenio = catalogo.filter(function (r) { return r.codigo === RH_CODIGO_DECENIO_; })[0];
    if (!rubricaQuinquenio || !rubricaDecenio) {
      return { ok: false, mensagem: "Rubricas de Quinquênio/Decênio não encontradas no catálogo." };
    }

    var colaboradoresPorId = {};
    listarColaboradoresRH_interno_().forEach(function (c) { colaboradoresPorId[c.id] = c; });

    var aplicados = [];

    verificacao.itens.forEach(function (item) {
      if (!item.divergente) return;
      var colaborador = colaboradoresPorId[item.colaboradorId];
      if (!colaborador) return;
      var salario = Number(colaborador.salario || 0);

      var fixasAtuais = rh_listarRubricasFixasColaborador_interno_(item.colaboradorId);
      var fixaQuinquenio = fixasAtuais.filter(function (f) { return f.codigo === RH_CODIGO_QUINQUENIO_; })[0];
      var fixaDecenio = fixasAtuais.filter(function (f) { return f.codigo === RH_CODIGO_DECENIO_; })[0];

      if (item.elegibilidadeCalculada === "QUINQUENIO") {
        rh_salvarRubricaFixaColaborador_(item.colaboradorId, rubricaQuinquenio.id, Math.round(salario * RH_PCT_QUINQUENIO_ / 100 * 100) / 100, quem);
        if (fixaDecenio && fixaDecenio.ativo) alternarRubricaFixaColaboradorRH(fixaDecenio.id, false, tokenSessao);
      } else if (item.elegibilidadeCalculada === "DECENIO") {
        rh_salvarRubricaFixaColaborador_(item.colaboradorId, rubricaDecenio.id, Math.round(salario * RH_PCT_DECENIO_ / 100 * 100) / 100, quem);
        if (fixaQuinquenio && fixaQuinquenio.ativo) alternarRubricaFixaColaboradorRH(fixaQuinquenio.id, false, tokenSessao);
      } else {
        if (fixaQuinquenio && fixaQuinquenio.ativo) alternarRubricaFixaColaboradorRH(fixaQuinquenio.id, false, tokenSessao);
        if (fixaDecenio && fixaDecenio.ativo) alternarRubricaFixaColaboradorRH(fixaDecenio.id, false, tokenSessao);
      }

      aplicados.push(item.nome + " → " + item.elegibilidadeCalculada + " (" + item.anosServico + " anos de admissão)");
    });

    Logger.log("[RH] Quinquênio/Decênio por tempo de serviço — aplicados: " + (aplicados.join(", ") || "nenhum"));
    return {
      ok: true,
      aplicados: aplicados,
      mensagem: aplicados.length
        ? "Atualizado(s): " + aplicados.length + " colaborador(es)."
        : "Nenhuma divergência encontrada — já está tudo de acordo com o tempo de serviço."
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao aplicar: " + e.message };
  }
}
