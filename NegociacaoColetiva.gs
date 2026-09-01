// ============================================================================
// ARQUIVO: NegociacaoColetiva.gs
// MÓDULO: Negociação Coletiva — a CCT como regra do sistema, não como texto.
//
// POR QUE ESTE ARQUIVO EXISTE
// A CCT 2026/2027 já estava no SISGEP desde antes: CCTCore.gs guarda o texto
// inteiro, ~40 cláusulas e todos os pisos. Só que ela era lida por UM único
// lugar do sistema — ChatIACore.gs, para dar contexto à SOFIA quando alguém
// perguntava no chat.
//
// Ou seja: a CCT era memória da IA. Não era regra.
//
// Consequências que isso produzia no dia a dia:
//   • Ninguém da equipe conseguia consultar uma cláusula sem perguntar à IA
//     e torcer para ela ter pegado o trecho certo.
//   • Os pisos salariais existiam só como texto corrido. Não dava para
//     conferir o salário de um associado contra o piso do cargo dele — que é
//     exatamente o trabalho da fiscalização sindical.
//   • As cláusulas 56, 57 e 58 viraram módulo no Financeiro (Mensalidade,
//     Taxa Negocial, Assistência Médica) sem nenhum vínculo com a fonte.
//     Se a CCT do ano que vem mudar o percentual, nada avisa.
//   • A CCT vence 28/02/2027 e a data-base é 1º de março. Nada no sistema
//     olhava essa data.
//
// O QUE ESTE MÓDULO FAZ
// Lê o MESMO texto de CCTCore.gs — fonte única, não há segunda cópia da CCT
// no projeto — e o transforma em três coisas consultáveis: cláusulas
// separadas e pesquisáveis, tabela estruturada de pisos, e o estado da
// vigência com alerta de data-base.
//
// SOBRE A TABELA DE PISOS
// Ela é transcrita à mão a partir da cláusula 04, porque extrair valor de
// prosa por expressão regular é o tipo de coisa que funciona no dia em que
// se escreve e quebra na primeira vírgula fora do lugar — e aqui um erro de
// transcrição vira salário errado conferido como certo.
//
// Para que a transcrição não se descole do documento, o teste
// tests/e2e/t10-negociacao.js confere CADA valor da tabela contra o texto da
// CCT. Se alguém atualizar CCTCore.gs no ano que vem e esquecer da tabela, o
// teste acusa. É essa checagem que dá o direito de confiar na tabela.
//
// AO TROCAR A CCT NO ANO QUE VEM
//   1. Substitua o texto em CCTCore.gs (getCCTTexto_).
//   2. Atualize NEGCOL_PISOS e NEGCOL_VIGENCIA aqui.
//   3. Rode tests/e2e/t10-negociacao.js. Ele diz o que ficou para trás.
// ============================================================================

var NEGCOL_MODULO = "negociacao";

// Vigência da CCT em vigor. Conferida contra o texto pelo teste.
var NEGCOL_VIGENCIA = {
  identificacao: "CCT 2026/2027 — SindEducação-ES x Sinepe-ES",
  inicio: "2026-03-01",
  fim: "2027-02-28",
  dataBase: "1º de março",
  assinatura: "19/05/2026, em Vitória-ES",
  // Quando começar a avisar que a próxima campanha salarial se aproxima.
  // 120 dias antes do fim: é o tempo que a diretoria precisa para montar
  // pauta, consultar a categoria e marcar assembleia.
  diasAlertaAntecedencia: 120
};

/**
 * Pisos da cláusula 04, vigentes a partir de 01/05/2026.
 * jornada em horas semanais; valor em reais.
 * O campo "ancora" é um trecho que TEM que aparecer no texto da CCT — é por
 * ele que o teste amarra a linha da tabela ao documento.
 */
var NEGCOL_PISOS = [
  { cargo: "Especialista em Educação / Pedagogo / Coordenador Pedagógico", segmento: "Ed. Infantil, Fundamental, Médio e Técnico", jornada: 40, valor: 4796.42, ancora: "4.796,42" },
  { cargo: "Especialista em Educação / Pedagogo / Coordenador Pedagógico", segmento: "Demais cursos", jornada: 40, valor: 4203.88, ancora: "4.203,88" },
  { cargo: "Especialista em Educação / Pedagogo / Coordenador Pedagógico", segmento: "Ensino Superior", jornada: 40, valor: 7291.28, ancora: "7.291,28" },
  { cargo: "Coordenador de Ensino Superior", segmento: "Ensino Superior", jornada: 40, valor: 7228.03, ancora: "7.228,03" },
  { cargo: "Bibliotecário com curso superior — Nível 1", segmento: "Todos", jornada: 40, valor: 4534.26, ancora: "4.534,26" },
  { cargo: "Bibliotecário com curso superior — Nível 2", segmento: "Todos", jornada: 40, valor: 5659.38, ancora: "5.659,38" },
  { cargo: "Bibliotecário com curso superior — Nível 3", segmento: "Todos", jornada: 40, valor: 6786.68, ancora: "6.786,68" },
  { cargo: "Coordenador de Turno", segmento: "Ed. Infantil e Fund. 1ª–5ª", jornada: 40, valor: 2464.42, ancora: "2.464,42" },
  { cargo: "Coordenador de Turno", segmento: "Fund. 6ª–9ª", jornada: 40, valor: 3535.34, ancora: "3.535,34" },
  { cargo: "Coordenador de Turno", segmento: "Médio e Técnico", jornada: 40, valor: 4708.30, ancora: "4.708,30" },
  { cargo: "Coordenador de Turno", segmento: "Ensino Superior", jornada: 40, valor: 4597.64, ancora: "4.597,64" },
  { cargo: "Secretário Escolar", segmento: "Todos", jornada: 44, valor: 3721.87, ancora: "3.721,87" },
  { cargo: "Secretaria / Recepção / RH / Tesouraria / Administrativo", segmento: "Todos", jornada: 44, valor: 2175.89, ancora: "2.175,89" },
  { cargo: "Telefonista", segmento: "Todos", jornada: 30, valor: 1824.73, ancora: "1.824,73" },
  { cargo: "Técnico em Laboratório com curso técnico", segmento: "Todos", jornada: 44, valor: 2683.87, ancora: "2.683,87" },
  { cargo: "Digitador", segmento: "Informática", jornada: 40, valor: 1828.21, ancora: "1.828,21" },
  { cargo: "Técnico de Informática com curso técnico", segmento: "Informática", jornada: 40, valor: 2643.91, ancora: "2.643,91" },
  { cargo: "Analista / Programador com curso superior", segmento: "Informática", jornada: 40, valor: 4753.29, ancora: "4.753,29" },
  { cargo: "Pessoal de Sala PcD", segmento: "Todos", jornada: 44, valor: 1775.24, ancora: "1.775,24" },
  { cargo: "Pessoal de Apoio (office boy, motoboy, serviços gerais)", segmento: "Exceto limpeza", jornada: 44, valor: 1680.31, ancora: "1.680,31" },
  { cargo: "Manutenção (bombeiro, pedreiro, marceneiro, eletricista)", segmento: "Todos", jornada: 44, valor: 1765.40, ancora: "1.765,40" },
  { cargo: "Cozinheira", segmento: "Todos", jornada: 44, valor: 1762.83, ancora: "1.762,83" },
  { cargo: "Motorista", segmento: "Todos", jornada: 44, valor: 1796.16, ancora: "1.796,16" },
  { cargo: "Porteiro e Vigia", segmento: "Todos", jornada: 44, valor: 1768.13, ancora: "1.768,13" },
  { cargo: "Serviços Gerais / Limpeza", segmento: "Todos", jornada: 44, valor: 1760.50, ancora: "1.760,50" },
  { cargo: "Especialista", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 3236.46, ancora: "3.236,46" },
  { cargo: "Coordenador Infantil", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 2518.91, ancora: "2.518,91" },
  { cargo: "Secretário", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 2733.51, ancora: "2.733,51" },
  { cargo: "Tesoureiro", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 2473.49, ancora: "2.473,49" },
  { cargo: "Administrativo / Secretaria / Recepção", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 2035.48, ancora: "2.035,48" },
  { cargo: "Berçarista / Creche", segmento: "Ed. Infantil exclusiva", jornada: 44, valor: 1841.13, ancora: "1.841,13" }
];

/**
 * Cláusulas que geram receita para o sindicato e já têm submódulo no
 * Financeiro. Serve para a tela mostrar o vínculo — e para o dia em que a
 * CCT nova mudar o percentual, alguém ver de onde o número saiu.
 */
var NEGCOL_CLAUSULAS_FINANCEIRAS = [
  { numero: 56, titulo: "Mensalidade Sindical", modulo: "mensalidades" },
  { numero: 57, titulo: "Taxa Negocial", modulo: "taxas" },
  { numero: 58, titulo: "Assistência Médica ao Sindicato", modulo: "taxas" }
];

/* ==========================================================================
 * LEITURA DA CCT
 * ========================================================================== */

/** O texto da CCT, vindo de CCTCore.gs. Fonte única. */
function negcol_texto_() {
  if (typeof getCCTTexto_ !== "function") {
    throw new Error("CCTCore.gs não está no projeto — sem ele não há CCT para consultar.");
  }
  return String(getCCTTexto_() || "");
}

/**
 * Quebra o texto em cláusulas.
 * A CCT não é numerada de forma contínua (pula da 29 para a 31, da 33 para a
 * 36): o corte é feito pelo marcador "CLÁUSULA nn —", não por contagem.
 */
function negcol_clausulas_() {
  var texto = negcol_texto_();
  var partes = texto.split(/(?=CLÁUSULA\s+\d+\s+—)/);
  var lista = [];

  partes.forEach(function (p) {
    var cab = /^CLÁUSULA\s+(\d+)\s+—\s*([^\n:]*)/.exec(p);
    if (!cab) return;
    var numero = parseInt(cab[1], 10);
    var titulo = String(cab[2] || "").replace(/[:\s]+$/, "").trim();
    var corpo = p.slice(cab[0].length).replace(/^[:\s]+/, "").trim();
    lista.push({ numero: numero, titulo: titulo, texto: corpo });
  });

  return lista;
}

/* ==========================================================================
 * VIGÊNCIA
 * ========================================================================== */

/** Meia-noite de hoje — comparar datas com hora dentro produz erro de 1 dia. */
function negcol_hoje_() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function negcol_dataDe_(iso) {
  var p = String(iso).split("-");
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

/**
 * Situação da CCT hoje: vigente, perto do fim, ou vencida.
 * Retorna { situacao, diasParaVencer, alerta, ... }
 */
function negcol_situacaoVigencia_() {
  var hoje = negcol_hoje_();
  var inicio = negcol_dataDe_(NEGCOL_VIGENCIA.inicio);
  var fim = negcol_dataDe_(NEGCOL_VIGENCIA.fim);
  var dia = 24 * 60 * 60 * 1000;
  var dias = Math.round((fim.getTime() - hoje.getTime()) / dia);

  var situacao, alerta = "";
  if (hoje.getTime() < inicio.getTime()) {
    situacao = "FUTURA";
    alerta = "Esta CCT ainda não entrou em vigor.";
  } else if (dias < 0) {
    situacao = "VENCIDA";
    alerta = "A CCT venceu há " + Math.abs(dias) + " dia(s). Enquanto não houver " +
      "CCT nova, os pisos e cláusulas abaixo são os do documento vencido — " +
      "confira com o Jurídico antes de usar como base para fiscalização.";
  } else if (dias <= NEGCOL_VIGENCIA.diasAlertaAntecedencia) {
    situacao = "A VENCER";
    alerta = "Faltam " + dias + " dia(s) para o fim da vigência. A data-base é " +
      NEGCOL_VIGENCIA.dataBase + " — é hora de montar a pauta da campanha salarial.";
  } else {
    situacao = "VIGENTE";
  }

  return {
    situacao: situacao,
    diasParaVencer: dias,
    alerta: alerta,
    identificacao: NEGCOL_VIGENCIA.identificacao,
    inicio: NEGCOL_VIGENCIA.inicio,
    fim: NEGCOL_VIGENCIA.fim,
    dataBase: NEGCOL_VIGENCIA.dataBase,
    assinatura: NEGCOL_VIGENCIA.assinatura
  };
}

/* ==========================================================================
 * ENDPOINTS (google.script.run)
 * ========================================================================== */

/**
 * Painel do módulo: vigência, contagem de cláusulas, pisos e vínculos.
 */
function negcolPainel(tokenSessao) {
  exigirModulo_(tokenSessao, NEGCOL_MODULO, false);
  var clausulas = negcol_clausulas_();
  return {
    ok: true,
    vigencia: negcol_situacaoVigencia_(),
    totalClausulas: clausulas.length,
    totalPisos: NEGCOL_PISOS.length,
    menorPiso: negcol_menorPiso_(),
    clausulasFinanceiras: NEGCOL_CLAUSULAS_FINANCEIRAS
  };
}

/** O menor piso da tabela — base de cálculo da insalubridade (cláusula 13). */
function negcol_menorPiso_() {
  var menor = null;
  NEGCOL_PISOS.forEach(function (p) {
    if (menor === null || p.valor < menor.valor) menor = p;
  });
  return menor;
}

/**
 * Cláusulas, com busca opcional por número ou por texto.
 * A busca é sem acento e sem caixa: quem procura "ticket" acha "TÍQUETE".
 */
function negcolListarClausulas(termo, tokenSessao) {
  exigirModulo_(tokenSessao, NEGCOL_MODULO, false);
  var lista = negcol_clausulas_();
  var busca = negcol_normalizar_(termo);
  if (!busca) return { ok: true, total: lista.length, clausulas: lista };

  var soNumero = /^\d+$/.test(busca) ? parseInt(busca, 10) : null;
  var achadas = lista.filter(function (c) {
    if (soNumero !== null && c.numero === soNumero) return true;
    return negcol_normalizar_(c.titulo + " " + c.texto).indexOf(busca) > -1;
  });
  return { ok: true, total: achadas.length, termo: String(termo || ""), clausulas: achadas };
}

function negcol_normalizar_(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éê]/g, "e").replace(/í/g, "i")
    .replace(/[óôõ]/g, "o").replace(/ú/g, "u").replace(/ç/g, "c")
    .trim();
}

/** Tabela de pisos, com busca por cargo ou segmento. */
function negcolListarPisos(termo, tokenSessao) {
  exigirModulo_(tokenSessao, NEGCOL_MODULO, false);
  var busca = negcol_normalizar_(termo);
  var lista = NEGCOL_PISOS.map(function (p) {
    return { cargo: p.cargo, segmento: p.segmento, jornada: p.jornada, valor: p.valor };
  });
  if (busca) {
    lista = lista.filter(function (p) {
      return negcol_normalizar_(p.cargo + " " + p.segmento).indexOf(busca) > -1;
    });
  }
  return { ok: true, total: lista.length, vigenciaPisos: "a partir de 01/05/2026", pisos: lista };
}

/**
 * Confere um salário contra o piso do cargo — o trabalho da fiscalização
 * sindical feito à mão hoje.
 *
 * NÃO decide sozinho que a escola está irregular: devolve a diferença e a
 * cláusula, e diz que o caso precisa de análise humana. Piso depende de
 * jornada, segmento e enquadramento, e nada disso o sistema conhece com
 * certeza a partir de um cadastro.
 */
function negcolConferirPiso(cargo, salarioInformado, tokenSessao) {
  exigirModulo_(tokenSessao, NEGCOL_MODULO, false);

  var busca = negcol_normalizar_(cargo);
  if (!busca) return { ok: false, mensagem: "Informe o cargo." };

  var salario = negcol_valorNumerico_(salarioInformado);
  if (salario === null) return { ok: false, mensagem: "Informe um salário válido." };

  var candidatos = NEGCOL_PISOS.filter(function (p) {
    return negcol_normalizar_(p.cargo).indexOf(busca) > -1;
  });

  if (!candidatos.length) {
    return {
      ok: false,
      mensagem: 'Nenhum piso da CCT corresponde a "' + cargo + '". Confira o ' +
        "enquadramento na cláusula 04 antes de concluir qualquer coisa."
    };
  }

  // Mais de um piso para o mesmo cargo (segmentos diferentes) é o caso
  // normal, não a exceção. Devolver todos e deixar a pessoa escolher é mais
  // honesto do que adivinhar o segmento.
  var resultados = candidatos.map(function (p) {
    var dif = Math.round((salario - p.valor) * 100) / 100;
    return {
      cargo: p.cargo, segmento: p.segmento, jornada: p.jornada,
      piso: p.valor, salario: salario, diferenca: dif,
      abaixoDoPiso: dif < 0
    };
  });

  var algumAbaixo = resultados.some(function (r) { return r.abaixoDoPiso; });
  var todosAbaixo = resultados.every(function (r) { return r.abaixoDoPiso; });

  return {
    ok: true,
    resultados: resultados,
    abaixoDoPiso: todosAbaixo,
    exigeAnalise: algumAbaixo && !todosAbaixo,
    mensagem: todosAbaixo
      ? "Salário abaixo do piso em todos os enquadramentos possíveis deste cargo. " +
        "Cláusula 04 da CCT; a multa por descumprimento é a cláusula 71."
      : (algumAbaixo
        ? "Depende do enquadramento: em pelo menos um segmento o salário está abaixo " +
          "do piso, em outro não. Confirme o segmento e a jornada antes de notificar."
        : "Salário igual ou acima do piso em todos os enquadramentos deste cargo.")
  };
}

/** Aceita "2.175,89", "2175.89" e número. Devolve null se não der. */
function negcol_valorNumerico_(v) {
  if (typeof v === "number") return isNaN(v) ? null : v;
  var s = String(v == null ? "" : v).trim();
  if (!s) return null;
  s = s.replace(/[R$\s]/g, "");
  if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}
