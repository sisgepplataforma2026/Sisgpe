// ============================================================================
// ARQUIVO: EscolasPendencias.gs
// PENDÊNCIAS DE ESCOLAS — submódulo 10 do item 8 do PROMPT-MESTRE.
//
// A fila do que está incompleto ou torto no cadastro mestre.
//
// POR QUE ESTE SUBMÓDULO EXISTE
//
// Escola com cadastro incompleto não dá erro em lugar nenhum. Ela aparece na
// lista igual às outras, abre normalmente, e só falha quando alguém precisa
// dela: não recebe ofício porque não tem e-mail, não entra na cobrança porque
// não tem telefone, não aparece no filtro de ativas porque não tem situação.
//
// O saneamento de 11/08/2026 mediu isso pela primeira vez. Antes dele eram 642
// linhas com dado fora do lugar; depois, 19. Essas 19 não têm padrão limpo o
// bastante para migração automática — a decisão é humana, caso a caso. É para
// elas que esta fila existe.
//
// DECISÃO DE PROJETO QUE IMPORTA: a fila é gerada pelo MESMO código do
// validador (escolaTipoAparente_ / escolaTipoServe_, em EscolasIdentidade.gs),
// não por uma segunda implementação das mesmas regras. Duas implementações da
// mesma regra divergem — e aí a tela diz uma coisa e a medição diz outra, e
// ninguém sabe em qual acreditar. Uma só, compartilhada.
//
// SÓ LEITURA. Este arquivo não escreve nada em lugar nenhum: quem corrige é a
// tela de cadastro, pelo caminho normal, com a auditoria normal.
// ============================================================================

/* Cada tipo de pendência: como detectar, como explicar, e o que ela impede. */
var ESC_PENDENCIAS = [
  {
    chave: "DADO_FORA_DO_LUGAR",
    rotulo: "Dado fora do lugar",
    impacto: "O campo tem conteúdo de outro tipo — telefone onde devia ter e-mail, por exemplo.",
    gravidade: 1
  },
  {
    chave: "SEM_DOCUMENTO",
    rotulo: "Sem CNPJ nem CPF",
    impacto: "Não entra em ofício, cobrança nem guia. É a pendência que mais trava.",
    gravidade: 1
  },
  {
    chave: "SEM_EMAIL",
    rotulo: "Sem e-mail",
    impacto: "Não recebe ofício nem cobrança — o sindicato não tem como falar com ela.",
    gravidade: 1
  },
  {
    chave: "SEM_TELEFONE",
    rotulo: "Sem telefone",
    impacto: "Sobra só o e-mail. Sem retorno, não há segundo caminho.",
    gravidade: 2
  },
  {
    chave: "SEM_SITUACAO",
    rotulo: "Sem situação",
    impacto: "Não aparece em filtro de ativa nem de inativa — some das duas listas.",
    gravidade: 2
  },
  {
    chave: "SEM_UF",
    rotulo: "Sem UF",
    impacto: "Não entra em recorte por estado.",
    gravidade: 3
  },
  {
    chave: "SEM_NOME",
    rotulo: "Sem razão social",
    impacto: "Some da listagem inteira — listarEscolasCadastro_interno_ filtra linha sem nome.",
    gravidade: 1
  }
];

/**
 * Monta a fila de pendências, para a tela.
 *
 * Exige sessão do SISGEP — sem porta pelo editor. Diferente do resumo, esta
 * função devolve nome, cidade e documento mascarado de cada escola; é a
 * listagem que a tela consome, e listagem se abre com login, não com o
 * e-mail de quem por acaso está com o editor aberto.
 *
 * @param {Object} filtros  { tipo } — chave de ESC_PENDENCIAS, ou vazio para todas
 * @return {Object} { ok, total, resumo, escolas }
 */
function escolasPendenciasListar(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "escolas", false);
  return escolasPendenciasCalcular_(filtros);
}

/** O cálculo em si. Sem guarda: quem chama já checou. */
function escolasPendenciasCalcular_(filtros) {
  try {
    filtros = filtros || {};
    var tipoFiltro = String(filtros.tipo || "").trim().toUpperCase();

    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_ESCOLAS);
    if (!sh) return { ok: false, mensagem: "Aba '" + ABA_ESCOLAS + "' não encontrada." };
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha < 2) {
      return { ok: true, total: 0, totalEscolasComPendencia: 0, totalNaBase: 0,
               resumo: escolasPendenciasResumoVazio_(), catalogo: ESC_PENDENCIAS, escolas: [] };
    }

    var tudo = sh.getRange(1, 1, ultimaLinha, sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    function idx(n) { return cab.indexOf(n); }

    var iId    = idx(ESC_COL_ID);
    var iNome  = idx(COL_NOME_ESCOLA);
    var iDoc   = idx(COL_CNPJ);
    var iEmail = idx(COL_EMAIL);
    var iTel1  = idx(COL_TELEFONE);
    var iTel2  = idx(COL_WHATSAPP);
    var iSit   = idx(COL_SITUACAO);
    var iUf    = idx(COL_UF);
    var iCidade = idx(COL_CIDADE);

    // Colunas que o validador sabe avaliar — a MESMA lista, não uma cópia.
    var avaliadas = [];
    cab.forEach(function (nome, i) {
      if (typeof ESC_TIPO_ESPERADO !== "undefined" && ESC_TIPO_ESPERADO[nome]) {
        avaliadas.push({ i: i, nome: nome, esperado: ESC_TIPO_ESPERADO[nome] });
      }
    });

    var resumo = escolasPendenciasResumoVazio_();
    var escolas = [];
    var comAlgumaPendencia = 0;

    for (var l = 1; l < tudo.length; l++) {
      var linha = tudo[l];
      var pend = [];

      // 1) dado fora do lugar — pelo validador compartilhado
      var camposTortos = [];
      for (var k = 0; k < avaliadas.length; k++) {
        var c = avaliadas[k];
        var aparente = escolaTipoAparente_(linha[c.i]);
        if (aparente === "VAZIO") continue;
        if (escolaTipoServe_(c.esperado, aparente)) continue;
        camposTortos.push({
          campo: c.nome,
          valor: escolaTexto_(linha[c.i]),
          pareceSer: aparente,
          esperado: c.esperado
        });
      }
      if (camposTortos.length) pend.push({ tipo: "DADO_FORA_DO_LUGAR", campos: camposTortos });

      // 2) faltas
      function vazio(i) { return i === -1 || !String(linha[i] == null ? "" : linha[i]).trim(); }
      if (vazio(iNome))  pend.push({ tipo: "SEM_NOME" });
      if (vazio(iDoc))   pend.push({ tipo: "SEM_DOCUMENTO" });
      if (vazio(iEmail)) pend.push({ tipo: "SEM_EMAIL" });
      if (vazio(iTel1) && vazio(iTel2)) pend.push({ tipo: "SEM_TELEFONE" });
      if (vazio(iSit))   pend.push({ tipo: "SEM_SITUACAO" });
      if (vazio(iUf))    pend.push({ tipo: "SEM_UF" });

      if (!pend.length) continue;

      // O resumo conta SEMPRE a base inteira, mesmo com filtro ligado. Se ele
      // contasse só o filtrado, os cards mudariam de número ao clicar num
      // deles — e o usuário nunca saberia quantas pendências existem de fato.
      comAlgumaPendencia++;
      pend.forEach(function (p) { resumo[p.tipo] = (resumo[p.tipo] || 0) + 1; });

      if (tipoFiltro && !pend.some(function (p) { return p.tipo === tipoFiltro; })) continue;

      escolas.push({
        escolaId: iId > -1 ? String(linha[iId] || "").trim() : "",
        linha: l + 1,
        nome: iNome > -1 ? String(linha[iNome] || "").trim() : "",
        documento: iDoc > -1 ? escolaDocMascarado_(linha[iDoc]) : "",
        cidade: iCidade > -1 ? String(linha[iCidade] || "").trim() : "",
        uf: iUf > -1 ? String(linha[iUf] || "").trim() : "",
        pendencias: pend,
        gravidade: Math.min.apply(null, pend.map(escolasPendenciaGravidade_))
      });
    }

    // Mais grave primeiro; dentro da mesma gravidade, quem tem mais pendências.
    escolas.sort(function (a, b) {
      if (a.gravidade !== b.gravidade) return a.gravidade - b.gravidade;
      return b.pendencias.length - a.pendencias.length;
    });

    return {
      ok: true,
      total: escolas.length,                    // quantas a lista traz (com filtro)
      totalEscolasComPendencia: comAlgumaPendencia,  // quantas existem (sem filtro)
      totalNaBase: tudo.length - 1,
      resumo: resumo,
      catalogo: ESC_PENDENCIAS,
      escolas: escolas.slice(0, 300)
    };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao montar pendências: " + e.message };
  }
}

function escolasPendenciaGravidade_(p) {
  for (var i = 0; i < ESC_PENDENCIAS.length; i++) {
    if (ESC_PENDENCIAS[i].chave === p.tipo) return ESC_PENDENCIAS[i].gravidade;
  }
  return 9;
}

function escolasPendenciasResumoVazio_() {
  var r = {};
  ESC_PENDENCIAS.forEach(function (p) { r[p.chave] = 0; });
  return r;
}

/**
 * Contagem por tipo, para os cards do dashboard. NÃO devolve a lista.
 *
 * Aceita as duas portas: a tela manda o token; o editor do Apps Script chama
 * sem argumento nenhum e cai na checagem de administrador. Enquanto a tela do
 * submódulo não existe, esta é a única forma de medir a base real — e é
 * seguro justamente porque o retorno é só contagem: nenhum nome de escola,
 * nenhum documento, nada de pessoal.
 */
function escolasPendenciasResumo(tokenSessao) {
  escolaExigirAdminOuSessao_(tokenSessao, "escolasPendenciasResumo");

  var r = escolasPendenciasCalcular_({});
  if (!r.ok) { Logger.log("FALHOU: " + r.mensagem); return r; }

  var saida = {
    ok: true,
    totalEscolasComPendencia: r.totalEscolasComPendencia,
    totalNaBase: r.totalNaBase,
    resumo: r.resumo,
    catalogo: ESC_PENDENCIAS
  };
  escolasPendenciasImprimir_(saida);
  return saida;
}

/* Sem isto, rodar pelo editor mostra "Execução concluída" e mais nada: o
 * valor devolvido some, porque ninguém está do outro lado para receber. Já
 * aconteceu duas vezes nesta migração. */
function escolasPendenciasImprimir_(r) {
  try {
    var L = [];
    L.push("═══ PENDÊNCIAS DO CADASTRO DE ESCOLAS ═══");
    L.push(r.totalEscolasComPendencia + " de " + r.totalNaBase + " escolas têm alguma pendência");
    L.push("");
    ESC_PENDENCIAS.slice().sort(function (a, b) { return a.gravidade - b.gravidade; })
      .forEach(function (p) {
        var n = String(r.resumo[p.chave] || 0);
        while (n.length < 5) n = " " + n;
        var rot = p.rotulo;
        while (rot.length < 24) rot += ".";
        L.push("  " + n + "  " + rot + " (gravidade " + p.gravidade + ")");
      });
    L.push("");
    L.push("Uma escola pode ter mais de uma pendência — a soma acima passa do total.");
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("Resumo calculado, mas a impressão falhou: " + e.message);
    Logger.log(JSON.stringify(r));
  }
}
