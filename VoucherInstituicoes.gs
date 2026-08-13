// ============================================================================
// ARQUIVO: VoucherInstituicoes.gs
// A MEMÓRIA DAS INSTITUIÇÕES DE ENSINO — cresce sozinha, com o uso.
//
// O PROBLEMA QUE ELA RESOLVE
//
// Hoje toda solicitação é digitada do zero. A secretaria digita "IESES" e o
// CNPJ pela quinta vez. Se ela corrigir um e-mail de RH no modal de envio, a
// correção morre ali — na próxima solicitação some. O sistema não fica mais
// fácil de usar com o uso; fica igual.
//
// Aqui a instituição é gravada em toda emissão e todo envio. Ninguém cadastra
// nada: a aba nasce do uso. Da segunda vez em diante, digitar "IES" já
// oferece IESES com CNPJ e e-mail preenchidos.
//
// O QUE "APRENDER" SIGNIFICA AQUI — E O QUE NÃO SIGNIFICA
//
// É memória de padrão, não inteligência. O sistema lembra instituição,
// CNPJ, e-mail e percentual usado, e fica mais rápido a cada uso. Não decide
// quem merece bolsa nem infere regra nova. Dizer o contrário seria vender o
// que não existe.
//
// TRÊS REGRAS PARA "APRENDER" NÃO VIRAR "CHUTAR"
//
//   1. SUGERE, NÃO DECIDE. Todo campo preenchido pela memória volta com a
//      origem junto, para a tela poder mostrar de onde veio. É o mesmo
//      padrão do `origemEmailInstituicao` do VoucherEnvio.gs — sem isso,
//      campo preenchido passa impressão de conferido.
//
//   2. CORREÇÃO VENCE, E VIRA A NOVA MEMÓRIA. Se alguém trocar
//      rh@ieses.edu.br por coordenacao@ieses.edu.br no modal de envio, a
//      memória aprende ali. Correção humana é o sinal mais forte que existe;
//      errar duas vezes o mesmo endereço é o que não pode acontecer.
//
//   3. NUNCA PREENCHE SOZINHO O QUE MEXE EM DINHEIRO. O percentual volta
//      como AVISO — "as últimas 9 de Educação Infantil saíram com 70%" — e
//      nunca já digitado no campo. Concessão de bolsa é decisão, não
//      estatística.
//
// LIGAÇÃO COM A FASE 4 (escolaId)
//
// A instituição de ensino às vezes TAMBÉM é uma das 679 escolas da base — o
// associado estuda onde outra pessoa trabalha. Quando o CNPJ bate, o
// `ESCOLA_ID` é preenchido e as duas passam a ser a mesma entidade, como
// manda a regra do item 8 do PROMPT-MESTRE. Quando não bate, fica vazio: a
// faculdade do associado normalmente não é base do sindicato, e forçar um id
// seria inventar vínculo.
// ============================================================================

var VOUCHER_ABA_INSTITUICOES = "Voucher_Instituicoes";
var VOUCHER_ABA_PADROES      = "Voucher_Padroes";

var VOUCHER_PADRAO_COLUNAS = [
  "CHAVE", "MODALIDADE", "AREA_CURSO", "CURSO",
  "VEZES", "PERCENTUAIS", "ULTIMO_PERCENTUAL", "ULTIMO_USO"
];

var VOUCHER_INST_COLUNAS = [
  "CNPJ", "NOME", "EMAIL", "VEZES", "ULTIMO_USO", "ULTIMO_PERCENTUAL",
  "ESCOLA_ID", "CRIADO_EM", "ATUALIZADO_POR"
];

/* ══════════════════════════════════════════════════════════════════════
   GRAVAÇÃO — chamada de dentro do fluxo, nunca pela tela
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Guarda o que se aprendeu sobre uma instituição. NUNCA LANÇA.
 *
 * Falhar aqui não pode derrubar uma emissão nem um envio: a memória é
 * conveniência, o certificado é o trabalho. Erro vai para o log.
 *
 * @param {Object} d {nome, cnpj, email, percentual, quem}
 * @return {boolean} true se gravou
 */
function voucherInstLembrar_(d) {
  try {
    d = d || {};
    var nome  = String(d.nome || "").trim();
    var cnpj  = String(d.cnpj || "").replace(/\D/g, "");
    var email = String(d.email || "").trim().toLowerCase();

    /* Sem nome nem CNPJ não há o que lembrar — e uma linha em branco na
     * memória viraria sugestão vazia na tela de quem digita. */
    if (!nome && !cnpj) return false;

    var sh = voucherInstAba_();
    var cab = sh.getRange(1, 1, 1, VOUCHER_INST_COLUNAS.length).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });
    function col(n) { return cab.indexOf(n) + 1; }

    var achado = voucherInstProcurar_(sh, cnpj, nome);
    var agora = new Date();

    if (achado) {
      var linha = achado.linha;
      sh.getRange(linha, col("VEZES")).setValue(Number(achado.vezes || 0) + 1);
      sh.getRange(linha, col("ULTIMO_USO")).setValue(agora);
      if (d.quem) sh.getRange(linha, col("ATUALIZADO_POR")).setValue(String(d.quem));

      /* O QUE VEIO AGORA VENCE O QUE ESTAVA — mas só quando veio de fato.
       * Campo vazio não apaga o que a memória já sabia: quem enviou sem
       * preencher a cópia não está dizendo que o e-mail antigo é falso,
       * está dizendo que não quis mandar cópia desta vez. */
      if (email) sh.getRange(linha, col("EMAIL")).setValue(email);
      if (nome)  sh.getRange(linha, col("NOME")).setValue(nome);
      if (cnpj)  sh.getRange(linha, col("CNPJ")).setValue(cnpj);
      if (d.percentual !== undefined && d.percentual !== null && d.percentual !== "") {
        sh.getRange(linha, col("ULTIMO_PERCENTUAL")).setValue(d.percentual);
      }
      var idAtual = String(achado.escolaId || "").trim();
      if (!idAtual) {
        var idNovo = voucherInstEscolaId_(cnpj);
        if (idNovo) sh.getRange(linha, col("ESCOLA_ID")).setValue(idNovo);
      }
      return true;
    }

    var nova = VOUCHER_INST_COLUNAS.map(function (c) {
      switch (c) {
        case "CNPJ": return cnpj;
        case "NOME": return nome;
        case "EMAIL": return email;
        case "VEZES": return 1;
        case "ULTIMO_USO": return agora;
        case "ULTIMO_PERCENTUAL":
          return (d.percentual === undefined || d.percentual === null) ? "" : d.percentual;
        case "ESCOLA_ID": return voucherInstEscolaId_(cnpj);
        case "CRIADO_EM": return agora;
        case "ATUALIZADO_POR": return String(d.quem || "");
        default: return "";
      }
    });
    sh.appendRow(nova);
    return true;
  } catch (e) {
    Logger.log("voucherInstLembrar_ falhou (o fluxo seguiu): " + e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   LEITURA — o que a tela consome
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Sugestões para o campo "instituição de ensino".
 *
 * Devolve no máximo 8, das mais usadas para as menos: quem digita quer o
 * nome que já digitou vinte vezes, não o que apareceu uma vez em 2024.
 */
function voucherInstituicoesSugerir(termo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var busca = voucherInstNormalizar_(termo);
    var linhas = voucherInstTodas_();

    var lista = linhas.filter(function (i) {
      if (!busca) return true;
      /* CNPJ entra na busca só com 3+ dígitos. Com menos, "00" casaria com
       * quase todo CNPJ do país e a sugestão viraria ruído. */
      var digitos = String(termo || "").replace(/\D/g, "");
      return voucherInstNormalizar_(i.nome).indexOf(busca) > -1 ||
             (digitos.length >= 3 && String(i.cnpj || "").indexOf(digitos) > -1);
    });

    lista.sort(function (a, b) {
      var d = Number(b.vezes || 0) - Number(a.vezes || 0);
      if (d !== 0) return d;
      return voucherInstNormalizar_(a.nome) < voucherInstNormalizar_(b.nome) ? -1 : 1;
    });

    return { ok: true, total: lista.length, instituicoes: lista.slice(0, 8) };
  } catch (e) {
    Logger.log("voucherInstituicoesSugerir: " + e.message);
    return { ok: false, mensagem: e.message, instituicoes: [] };
  }
}

/**
 * Tudo que a memória sabe sobre UMA instituição, para preencher o formulário.
 *
 * A resposta traz `origem` em cada campo sugerido, e é isso que permite a
 * tela dizer "achado no cadastro, confira" em vez de entregar um campo
 * preenchido que passa por conferido.
 */
function voucherInstituicaoDetalhe(chave, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var cnpj = String(chave || "").replace(/\D/g, "");
    var nome = cnpj ? "" : String(chave || "").trim();
    var sh = voucherInstAba_();
    var achado = voucherInstProcurar_(sh, cnpj, nome);
    if (!achado) return { ok: true, achou: false };

    return {
      ok: true, achou: true,
      nome: achado.nome, cnpj: achado.cnpj, email: achado.email,
      escolaId: achado.escolaId,
      vezes: achado.vezes,
      origem: "MEMORIA",
      /* O percentual vem SEPARADO do resto, e com o texto do aviso pronto.
       * A tela mostra ao lado do campo; não preenche. Concessão de bolsa é
       * decisão de quem analisa, não repetição do que aconteceu antes. */
      avisoPercentual: achado.ultimoPercentual
        ? "A última bolsa desta instituição saiu com " + achado.ultimoPercentual + "%."
        : ""
    };
  } catch (e) {
    Logger.log("voucherInstituicaoDetalhe: " + e.message);
    return { ok: false, mensagem: e.message, achou: false };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   APOIO
   ══════════════════════════════════════════════════════════════════════ */

function voucherInstAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(VOUCHER_ABA_INSTITUICOES);
  if (!sh) {
    sh = ss.insertSheet(VOUCHER_ABA_INSTITUICOES);
    sh.getRange(1, 1, 1, VOUCHER_INST_COLUNAS.length).setValues([VOUCHER_INST_COLUNAS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function voucherInstTodas_() {
  var sh = voucherInstAba_();
  if (sh.getLastRow() < 2) return [];
  var tudo = sh.getRange(1, 1, sh.getLastRow(), VOUCHER_INST_COLUNAS.length).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
  function idx(n) { return cab.indexOf(n); }

  var lista = [];
  for (var l = 1; l < tudo.length; l++) {
    var nome = String(tudo[l][idx("NOME")] || "").trim();
    var cnpj = String(tudo[l][idx("CNPJ")] || "").replace(/\D/g, "");
    if (!nome && !cnpj) continue;
    lista.push({
      linha: l + 1,
      nome: nome,
      cnpj: cnpj,
      email: String(tudo[l][idx("EMAIL")] || "").trim(),
      vezes: Number(tudo[l][idx("VEZES")] || 0),
      ultimoUso: tudo[l][idx("ULTIMO_USO")] || "",
      ultimoPercentual: tudo[l][idx("ULTIMO_PERCENTUAL")] || "",
      escolaId: String(tudo[l][idx("ESCOLA_ID")] || "").trim()
    });
  }
  return lista;
}

/**
 * Acha a instituição por CNPJ e, sem CNPJ, por nome normalizado.
 *
 * O CNPJ MANDA quando existe. Nome é campo digitado por gente: "IESES",
 * "Ieses", "IESES - Instituto" e "IESES " são a mesma faculdade, e casar por
 * nome cru criaria quatro linhas para uma instituição só — que é justamente
 * a duplicidade que o item 8 do PROMPT-MESTRE manda evitar.
 */
function voucherInstProcurar_(sh, cnpj, nome) {
  var todas = voucherInstTodas_();
  var alvoCnpj = String(cnpj || "").replace(/\D/g, "");
  var alvoNome = voucherInstNormalizar_(nome);

  if (alvoCnpj) {
    for (var i = 0; i < todas.length; i++) {
      if (todas[i].cnpj && todas[i].cnpj === alvoCnpj) return todas[i];
    }
  }
  if (alvoNome) {
    for (var j = 0; j < todas.length; j++) {
      if (voucherInstNormalizar_(todas[j].nome) === alvoNome) return todas[j];
    }
  }
  return null;
}

function voucherInstNormalizar_(t) {
  return String(t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * O escolaId, quando a instituição de ensino também é uma das 679 escolas.
 *
 * Só pelo CNPJ: é a única chave que não confunde. Nome de fantasia bate
 * entre empresas diferentes, e amarrar a escola errada seria pior que não
 * amarrar nenhuma — o vínculo é o que a Fase 4 usa para juntar histórico.
 */
function voucherInstEscolaId_(cnpj) {
  var digitos = String(cnpj || "").replace(/\D/g, "");
  if (!digitos || digitos.length !== 14) return "";
  if (typeof listarEscolasCadastro_interno_ !== "function") return "";
  try {
    var lista = listarEscolasCadastro_interno_() || [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      var c = String(e.CNPJ || e.cnpj || "").replace(/\D/g, "");
      if (c && c === digitos) {
        return String(e[ESC_COL_ID] || e.EscolaID || "").trim();
      }
    }
    return "";
  } catch (e2) {
    /* Não achar o escolaId não é erro: a faculdade do associado normalmente
     * não é base do sindicato. Vazio aqui significa "não é uma das 679", e
     * é resposta legítima. */
    Logger.log("voucherInstEscolaId_: " + e2.message);
    return "";
  }
}

/* ══════════════════════════════════════════════════════════════════════
   PADRÃO DE PERCENTUAL — por modalidade, área e curso

   PEDIDO DO USUÁRIO EM 12/08/2026, com estas palavras: "aprender com as
   solicitações realizadas: Ex. Percentual de desconto por curso, modalidade,
   ensino".

   ISTO NÃO É A REGRA — É O QUE ACONTECEU

   A aba `Voucher_Regras` guarda o que a Convenção Coletiva DETERMINA. Esta
   aqui guarda o que a secretaria de fato CONCEDEU. São coisas diferentes, e
   a diferença entre elas é a informação mais útil das duas: quando a regra
   diz 50% e as últimas nove saíram com 70%, ou a regra está desatualizada ou
   alguém vem concedendo fora dela. Nos dois casos alguém precisa saber.

   POR QUE NÃO PREENCHE O CAMPO SOZINHO

   Percentual é dinheiro do sindicato. Campo já preenchido é campo que
   ninguém relê — e a bolsa passaria a ser decidida por repetição, não por
   análise. A resposta vem como AVISO, com o número de casos à vista, para
   quem analisa poder pesar se 9 casos valem mais que a regra escrita.

   BUSCA EM TRÊS NÍVEIS, DO ESPECÍFICO PARA O GERAL

     1. modalidade + área + curso  — "Pedagogia, Humanas, Graduação"
     2. modalidade + área          — "Humanas, Graduação"
     3. modalidade                 — "Graduação"

   O primeiro que tiver caso responde, e a resposta DIZ QUAL NÍVEL casou.
   Sem isso, "70%" baseado em um único caso de curso raro pareceria tão
   sólido quanto "70%" baseado em quarenta casos de modalidade inteira.
   ══════════════════════════════════════════════════════════════════════ */

function voucherPadraoChave_(modalidade, area, curso) {
  return [
    voucherInstNormalizar_(modalidade),
    voucherInstNormalizar_(area),
    voucherInstNormalizar_(curso)
  ].join("|");
}

function voucherPadraoAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(VOUCHER_ABA_PADROES);
  if (!sh) {
    sh = ss.insertSheet(VOUCHER_ABA_PADROES);
    sh.getRange(1, 1, 1, VOUCHER_PADRAO_COLUNAS.length).setValues([VOUCHER_PADRAO_COLUNAS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function voucherPadraoTodos_() {
  var sh = voucherPadraoAba_();
  if (sh.getLastRow() < 2) return [];
  var tudo = sh.getRange(1, 1, sh.getLastRow(), VOUCHER_PADRAO_COLUNAS.length).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
  function idx(n) { return cab.indexOf(n); }
  var lista = [];
  for (var l = 1; l < tudo.length; l++) {
    var chave = String(tudo[l][idx("CHAVE")] || "");
    if (!chave) continue;
    lista.push({
      linha: l + 1, chave: chave,
      modalidade: String(tudo[l][idx("MODALIDADE")] || ""),
      area: String(tudo[l][idx("AREA_CURSO")] || ""),
      curso: String(tudo[l][idx("CURSO")] || ""),
      vezes: Number(tudo[l][idx("VEZES")] || 0),
      percentuais: String(tudo[l][idx("PERCENTUAIS")] || ""),
      ultimoPercentual: tudo[l][idx("ULTIMO_PERCENTUAL")] || "",
      ultimoUso: tudo[l][idx("ULTIMO_USO")] || ""
    });
  }
  return lista;
}

/**
 * Registra que uma bolsa saiu com tal percentual, nas três granularidades.
 *
 * Grava a MESMA emissão em três linhas — curso, área e modalidade — porque
 * é assim que a consulta consegue responder tanto "Pedagogia" quanto
 * "Graduação" sem varrer a base inteira a cada pergunta.
 *
 * NUNCA LANÇA: aprender é conveniência, emitir é o trabalho.
 */
function voucherPadraoLembrar_(d) {
  try {
    d = d || {};
    var pct = Number(d.percentual);
    /* Percentual fora de 1..100 não é concessão, é dado sujo — e sujeira na
     * memória vira sugestão errada meses depois, quando ninguém lembra de
     * onde veio. */
    if (!pct || isNaN(pct) || pct <= 0 || pct > 100) return false;

    var modalidade = String(d.modalidade || "").trim();
    var area  = String(d.area || "").trim();
    var curso = String(d.curso || "").trim();
    if (!modalidade && !area && !curso) return false;

    var niveis = [
      { modalidade: modalidade, area: area,  curso: curso },
      { modalidade: modalidade, area: area,  curso: "" },
      { modalidade: modalidade, area: "",    curso: "" }
    ];

    var sh = voucherPadraoAba_();
    var cab = sh.getRange(1, 1, 1, VOUCHER_PADRAO_COLUNAS.length).getValues()[0]
      .map(function (c) { return String(c || "").trim(); });
    function col(n) { return cab.indexOf(n) + 1; }
    var agora = new Date();
    var existentes = voucherPadraoTodos_();

    niveis.forEach(function (n) {
      if (!n.modalidade && !n.area && !n.curso) return;
      var chave = voucherPadraoChave_(n.modalidade, n.area, n.curso);
      var achado = null;
      for (var i = 0; i < existentes.length; i++) {
        if (existentes[i].chave === chave) { achado = existentes[i]; break; }
      }

      if (achado) {
        /* PERCENTUAIS guarda a contagem por valor: "70:9,50:2". É o que
         * permite dizer "o mais usado", e não só "o último" — um caso
         * isolado de 100% não pode virar a sugestão para sempre. */
        var mapa = voucherPadraoContagem_(achado.percentuais);
        mapa[pct] = (mapa[pct] || 0) + 1;
        sh.getRange(achado.linha, col("VEZES")).setValue(Number(achado.vezes || 0) + 1);
        sh.getRange(achado.linha, col("PERCENTUAIS")).setValue(voucherPadraoSerializar_(mapa));
        sh.getRange(achado.linha, col("ULTIMO_PERCENTUAL")).setValue(pct);
        sh.getRange(achado.linha, col("ULTIMO_USO")).setValue(agora);
      } else {
        sh.appendRow(VOUCHER_PADRAO_COLUNAS.map(function (c) {
          switch (c) {
            case "CHAVE": return chave;
            case "MODALIDADE": return n.modalidade;
            case "AREA_CURSO": return n.area;
            case "CURSO": return n.curso;
            case "VEZES": return 1;
            case "PERCENTUAIS": return pct + ":1";
            case "ULTIMO_PERCENTUAL": return pct;
            case "ULTIMO_USO": return agora;
            default: return "";
          }
        }));
      }
    });
    return true;
  } catch (e) {
    Logger.log("voucherPadraoLembrar_ falhou (a emissão seguiu): " + e.message);
    return false;
  }
}

function voucherPadraoContagem_(texto) {
  var mapa = {};
  String(texto || "").split(",").forEach(function (p) {
    var partes = p.split(":");
    var v = Number(partes[0]), n = Number(partes[1]);
    if (v && n) mapa[v] = n;
  });
  return mapa;
}

function voucherPadraoSerializar_(mapa) {
  return Object.keys(mapa)
    .map(Number)
    .sort(function (a, b) { return mapa[b] - mapa[a] || b - a; })
    .map(function (v) { return v + ":" + mapa[v]; })
    .join(",");
}

/**
 * O que a memória sabe sobre o percentual desta combinação.
 *
 * A resposta NUNCA é só um número: vem com o nível que casou e o número de
 * casos, porque é isso que diz se a sugestão vale alguma coisa. "70% — 9 de
 * 11 casos de Educação Infantil" é uma informação; "70%" sozinho é um
 * palpite disfarçado de fato.
 */
function voucherPadraoPercentual(modalidade, area, curso, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var todos = voucherPadraoTodos_();
    var tentativas = [
      { chave: voucherPadraoChave_(modalidade, area, curso), nivel: "CURSO",
        rotulo: String(curso || "") }
    ];

    /* O NÍVEL "ÁREA" SÓ EXISTE QUANDO HÁ ÁREA.
     *
     * Sem esta condição, com a área vazia a chave do nível 2 fica idêntica à
     * do nível 3 — `modalidade||` nos dois casos — e a busca casa no nível 2
     * respondendo "AREA" para o que na verdade é a modalidade inteira. O
     * percentual sairia certo e a EXPLICAÇÃO sairia errada: quem lê "base:
     * área" pensa que a sugestão veio de um recorte fino, quando veio do
     * mais grosso que existe. Sugestão sem lastro correto é pior que
     * sugestão nenhuma, e aqui o lastro é justamente o que se anuncia. */
    if (String(area || "").trim()) {
      tentativas.push({ chave: voucherPadraoChave_(modalidade, area, ""), nivel: "AREA",
                        rotulo: String(area || "") });
    }
    tentativas.push({ chave: voucherPadraoChave_(modalidade, "", ""), nivel: "MODALIDADE",
                      rotulo: String(modalidade || "") });

    for (var t = 0; t < tentativas.length; t++) {
      if (tentativas[t].chave === "||") continue;
      for (var i = 0; i < todos.length; i++) {
        if (todos[i].chave !== tentativas[t].chave) continue;

        var mapa = voucherPadraoContagem_(todos[i].percentuais);
        var valores = Object.keys(mapa).map(Number)
          .sort(function (a, b) { return mapa[b] - mapa[a] || b - a; });
        if (!valores.length) continue;

        var mais = valores[0];
        var casos = mapa[mais];
        var total = todos[i].vezes || casos;

        /* O aviso é escrito aqui, e não na tela, para que as duas telas que
         * vão consumir isto — a de solicitação e a de emissão — digam
         * exatamente a mesma coisa. Texto de aviso duplicado em dois lugares
         * diverge no primeiro ajuste. */
        var aviso = casos === total
          ? "As últimas " + total + " bolsas de " + (tentativas[t].rotulo || "—") +
            " saíram com " + mais + "%."
          : mais + "% em " + casos + " de " + total + " bolsas de " +
            (tentativas[t].rotulo || "—") + ".";

        return {
          ok: true, achou: true,
          percentualSugerido: mais,
          casos: casos, total: total,
          nivel: tentativas[t].nivel,
          rotulo: tentativas[t].rotulo,
          /* Divergência dentro da própria memória também é informação: se
           * saiu 70% nove vezes e 50% duas, quem analisa precisa saber que
           * há exceção, não só que "o padrão é 70". */
          variacao: valores.length > 1
            ? valores.map(function (v) { return v + "% (" + mapa[v] + ")"; }).join(" · ")
            : "",
          aviso: aviso
        };
      }
    }
    return { ok: true, achou: false, aviso: "" };
  } catch (e) {
    Logger.log("voucherPadraoPercentual: " + e.message);
    return { ok: false, achou: false, mensagem: e.message, aviso: "" };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   MEMÓRIA PELO ASSOCIADO — a mais forte das três

   O EXEMPLO DO USUÁRIO, 12/08/2026, com as palavras dele:

     "Marcelo é da faculdade Multivix. Ele solicita um voucher de desconto
      para o curso de graduação, 70%. Quando o Marcelo no próximo semestre
      solicitar novamente, quando a gente digita Marcelo Alves de Oliveira,
      ele já aparece: curso de administração, 70%. A partir do momento que
      eu fiz a primeira vez, as demais ele já faz."

   NÃO EXISTE ABA NOVA AQUI, E ISSO É DE PROPÓSITO

   As solicitações anteriores do Marcelo já estão gravadas em
   Voucher_Solicitacoes. Copiá-las para uma "aba de memória" criaria uma
   segunda verdade que diverge da primeira no dia em que alguém corrigir a
   solicitação e esquecer da cópia. Ler direto da origem é o que garante que
   a sugestão seja sempre o que de fato aconteceu.

   É também o que faz o "auto salvar" ser automático de verdade: não há o
   que salvar — toda solicitação já é a memória.

   BUSCA POR CPF, NÃO POR NOME

   Nome é campo digitado por gente: "Marcelo Alves de Oliveira", "Marcelo A.
   de Oliveira" e "marcelo alves oliveira" são a mesma pessoa. O CPF é o que
   não confunde. A tela busca o associado pelo nome — mas a memória se
   ancora no CPF que aquela busca resolveu.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Tudo que o sistema já sabe sobre as bolsas deste associado.
 *
 * Devolve os campos prontos para PREENCHER o formulário — decisão do usuário
 * em 12/08/2026: "se eu digitar Direito, já está preestabelecido 50%".
 * Cada campo vem com a origem, para a tela poder mostrar de onde veio e a
 * pessoa poder discordar. Preenchido não é o mesmo que confirmado.
 */
function voucherMemoriaAssociado(cpf, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var digitos = String(cpf || "").replace(/\D/g, "");
    if (digitos.length !== 11) {
      return { ok: false, achou: false, mensagem: "Informe um CPF com 11 dígitos." };
    }

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(VOUCHER_ABA_SOLICITACOES);
    if (!sh || sh.getLastRow() < 2) return { ok: true, achou: false };

    var tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
    function v(linha, nome) {
      var i = cab.indexOf(nome);
      return i === -1 ? "" : linha[i];
    }

    /* DE TRÁS PARA FRENTE: a última solicitação é a que vale. O Marcelo pode
     * ter mudado de curso, de faculdade ou de percentual — e a sugestão tem
     * que refletir a vida dele hoje, não a de 2024. */
    var anteriores = [];
    for (var l = tudo.length - 1; l >= 1; l--) {
      if (String(v(tudo[l], "CPF_SOLICITANTE") || "").replace(/\D/g, "") !== digitos) continue;
      anteriores.push(tudo[l]);
    }
    if (!anteriores.length) return { ok: true, achou: false };

    var ultima = anteriores[0];
    var curso = String(v(ultima, "CURSO") || "").trim();
    var modalidade = String(v(ultima, "MODALIDADE") || "").trim();
    var area = String(v(ultima, "AREA_CURSO") || "").trim();

    /* O percentual da ÚLTIMA vale mais que o padrão do curso: é o que se
     * concedeu a esta pessoa. O padrão entra só quando ela nunca teve um. */
    var pct = v(ultima, "PERCENTUAL_APLICADO");
    var origemPct = pct ? "ULTIMA_SOLICITACAO" : "";
    if (!pct && typeof voucherPadraoTodos_ === "function") {
      var padrao = voucherPadraoPercentual(modalidade, area, curso, tokenSessao);
      if (padrao && padrao.achou) { pct = padrao.percentualSugerido; origemPct = "PADRAO_DO_CURSO"; }
    }

    return {
      ok: true, achou: true,
      vezes: anteriores.length,
      /* Dados do associado */
      nome: String(v(ultima, "NOME_SOLICITANTE") || "").trim(),
      email: String(v(ultima, "EMAIL") || "").trim(),
      telefone: String(v(ultima, "TELEFONE") || "").trim(),
      situacaoSindical: String(v(ultima, "SITUACAO_SINDICAL") || "").trim(),
      /* Onde trabalha */
      escola: String(v(ultima, "ESCOLA_SELECIONADA") || "").trim(),
      cnpjEscola: String(v(ultima, "CNPJ_ESCOLA") || "").trim(),
      cidadeEscola: String(v(ultima, "CIDADE_ESCOLA") || "").trim(),
      /* Onde estuda */
      instituicao: String(v(ultima, "INSTITUICAO_ENSINO") || "").trim(),
      cnpjInstituicao: String(v(ultima, "CNPJ_INSTITUICAO") || "").trim(),
      emailInstituicao: String(v(ultima, "EMAIL_INSTITUICAO") || "").trim(),
      /* O benefício */
      beneficiario: String(v(ultima, "NOME_BENEFICIARIO") || "").trim(),
      parentesco: String(v(ultima, "PARENTESCO") || "").trim(),
      tipoBeneficiario: String(v(ultima, "TIPO_BENEFICIARIO") || "").trim(),
      dataNascimento: v(ultima, "DATA_NASCIMENTO_BENEFICIARIO") || "",
      modalidade: modalidade,
      area: area,
      curso: curso,
      regime: String(v(ultima, "REGIME") || "").trim(),
      percentual: pct,
      origemPercentual: origemPct,
      ultimoPeriodo: String(v(ultima, "PERIODO_REFERENCIA") || "").trim(),
      ultimoProtocolo: String(v(ultima, "NUMERO_PROTOCOLO") || "").trim(),
      /* O aviso que a tela mostra no topo, escrito aqui para as duas telas
       * que vão consumir isto dizerem exatamente a mesma coisa. */
      aviso: anteriores.length === 1
        ? "Já houve 1 solicitação deste associado — os campos vieram dela."
        : "Já houve " + anteriores.length +
          " solicitações deste associado — os campos vieram da última."
    };
  } catch (e) {
    Logger.log("voucherMemoriaAssociado: " + e.message);
    return { ok: false, achou: false, mensagem: e.message };
  }
}

/**
 * O percentual sugerido para um CURSO, digitado solto.
 *
 * É o segundo caminho do exemplo do usuário: "ou quando a gente digita
 * administração, 70%. Se eu digitar Direito, já está preestabelecido 50%".
 * Aqui não há pessoa nem modalidade — só o nome do curso, como ele sai da
 * boca de quem atende no balcão.
 */
function voucherPercentualPorCurso(curso, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var alvo = voucherInstNormalizar_(curso);
    if (!alvo) return { ok: true, achou: false };

    var todos = voucherPadraoTodos_().filter(function (p) {
      return voucherInstNormalizar_(p.curso) === alvo;
    });
    if (!todos.length) return { ok: true, achou: false };

    /* O mesmo curso pode aparecer em modalidades diferentes — "Administração"
     * de graduação e de técnico. Somam-se as contagens: quem digita o curso
     * solto está perguntando pelo curso, não por uma modalidade. */
    var mapa = {};
    var total = 0;
    todos.forEach(function (p) {
      var m = voucherPadraoContagem_(p.percentuais);
      Object.keys(m).forEach(function (k) { mapa[k] = (mapa[k] || 0) + m[k]; total += m[k]; });
    });

    var valores = Object.keys(mapa).map(Number)
      .sort(function (a, b) { return mapa[b] - mapa[a] || b - a; });
    if (!valores.length) return { ok: true, achou: false };

    var mais = valores[0];
    return {
      ok: true, achou: true,
      percentualSugerido: mais,
      casos: mapa[mais], total: total,
      curso: todos[0].curso,
      origem: "PADRAO_DO_CURSO",
      variacao: valores.length > 1
        ? valores.map(function (v) { return v + "% (" + mapa[v] + ")"; }).join(" · ")
        : "",
      aviso: mapa[mais] === total
        ? "As " + total + " bolsas de " + todos[0].curso + " saíram com " + mais + "%."
        : mais + "% em " + mapa[mais] + " de " + total + " bolsas de " + todos[0].curso + "."
    };
  } catch (e) {
    Logger.log("voucherPercentualPorCurso: " + e.message);
    return { ok: false, achou: false, mensagem: e.message };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   O RESOLVEDOR — uma chamada só, para a tela de solicitação

   Junta as quatro fontes numa resposta só, porque é assim que a tela
   consegue preencher o formulário sem quatro idas ao servidor com a
   planilha aberta.

   A ORDEM IMPORTA, E É ESTA:

     1. REGRA DA CCT           — o que a convenção determina. É a base.
     2. ÚLTIMA DO ASSOCIADO    — o que se concedeu a esta pessoa.
     3. PADRÃO DO CURSO        — o que costuma sair naquele curso.

   A regra vem primeiro porque é a única com valor normativo: memória é
   observação, convenção é obrigação. Mas quando a história da pessoa
   diverge da regra, as DUAS aparecem — e é justamente aí que quem analisa
   precisa olhar. Um associado que vinha recebendo 70% num curso cuja regra
   diz 50% é uma exceção que alguém concedeu; pode ter havido motivo, e pode
   ter havido engano. Esconder qualquer um dos dois números decidiria por
   quem deveria decidir.
   ══════════════════════════════════════════════════════════════════════ */

function voucherSugerirSolicitacao(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    dados = dados || {};
    var r = { ok: true, campos: {}, origens: {}, avisos: [] };

    /* ── 1. a pessoa ── */
    var mem = null;
    var cpf = String(dados.cpf || "").replace(/\D/g, "");
    if (cpf.length === 11) {
      mem = voucherMemoriaAssociado(cpf, tokenSessao);
      if (mem && mem.achou) {
        ["nome", "email", "telefone", "situacaoSindical", "escola", "cnpjEscola",
         "cidadeEscola", "instituicao", "cnpjInstituicao", "emailInstituicao",
         "beneficiario", "parentesco", "tipoBeneficiario", "modalidade",
         "area", "curso", "regime"].forEach(function (c) {
          if (mem[c]) { r.campos[c] = mem[c]; r.origens[c] = "ULTIMA_SOLICITACAO"; }
        });
        r.avisos.push(mem.aviso);
        r.ultimoProtocolo = mem.ultimoProtocolo;
        r.ultimoPeriodo = mem.ultimoPeriodo;
      }
    }

    /* O que a tela mandou VENCE o que a memória lembrou: se a pessoa já
     * trocou a modalidade no formulário, é sobre a nova que ela quer saber
     * o percentual, não sobre a do semestre passado. */
    var modalidade = String(dados.modalidade || r.campos.modalidade || "").trim();
    var area  = String(dados.area  || r.campos.area  || "").trim();
    var curso = String(dados.curso || r.campos.curso || "").trim();
    if (dados.modalidade) { r.campos.modalidade = dados.modalidade; delete r.origens.modalidade; }
    if (dados.area)  { r.campos.area  = dados.area;  delete r.origens.area; }
    if (dados.curso) { r.campos.curso = dados.curso; delete r.origens.curso; }

    /* ── 2. a regra da convenção ── */
    var regra = null;
    if (modalidade && typeof calcularRegraVoucher_ === "function") {
      try {
        regra = calcularRegraVoucher_({
          modalidade: modalidade, areaCurso: area,
          tipoBeneficiario: dados.tipoBeneficiario || r.campos.tipoBeneficiario || "TITULAR",
          /* A situação sindical vai junto: é ela que decide se há direito.
           * Sem passá-la, a regra calcularia percentual para quem não é
           * associado — e a recusa só apareceria na emissão, com todo o
           * cadastro já feito. */
          situacaoSindical: dados.situacaoSindical || r.campos.situacaoSindical || "",
          ordemFilho: dados.ordemFilho || "",
          enteadoDeclaradoIR: dados.enteadoDeclaradoIR || ""
        }, dados.idadeBeneficiario === undefined ? "" : dados.idadeBeneficiario);
      } catch (e) { Logger.log("regra da CCT falhou: " + e.message); }
    }

    if (regra && regra.apto && regra.percentual) {
      r.campos.percentual = Number(regra.percentual);
      r.origens.percentual = "REGRA_CCT";
      r.campos.regime = regra.regime || r.campos.regime || "";
      r.regraObservacao = regra.observacao || "";
    } else if (regra && !regra.apto) {
      /* Regra que RECUSA é informação, não silêncio. Mestrado sem desconto,
       * filho fora do limite de idade, enteado sem declaração de IR — em
       * todos, o campo fica vazio E o motivo aparece. */
      r.campos.percentual = "";
      r.origens.percentual = "REGRA_CCT_RECUSA";
      r.avisos.push(regra.observacao || "A convenção não prevê desconto para este caso.");
      r.bloqueadoPelaRegra = true;
    }

    /* ── 3. a história do associado, e a divergência ── */
    if (mem && mem.achou && mem.percentual) {
      var daPessoa = Number(mem.percentual);
      if (!r.campos.percentual && !r.bloqueadoPelaRegra) {
        r.campos.percentual = daPessoa;
        r.origens.percentual = "ULTIMA_SOLICITACAO";
      } else if (r.campos.percentual && Number(r.campos.percentual) !== daPessoa) {
        r.avisos.push("Atenção: a última bolsa deste associado saiu com " +
                      daPessoa + "%, e a regra da convenção indica " +
                      r.campos.percentual + "%.");
        r.divergencia = { regra: Number(r.campos.percentual), associado: daPessoa };
      }
    }

    /* ── 4. o padrão observado do curso, quando nada acima resolveu ── */
    if (!r.campos.percentual && !r.bloqueadoPelaRegra && curso) {
      var pc = voucherPercentualPorCurso(curso, tokenSessao);
      if (pc && pc.achou) {
        r.campos.percentual = pc.percentualSugerido;
        r.origens.percentual = "PADRAO_DO_CURSO";
        r.avisos.push(pc.aviso);
      }
    }

    /* ── a instituição, quando a pessoa é nova mas a faculdade não ── */
    if (!r.campos.instituicao && dados.instituicao) {
      var inst = voucherInstituicaoDetalhe(dados.instituicao, tokenSessao);
      if (inst && inst.achou) {
        r.campos.instituicao = inst.nome;
        r.campos.cnpjInstituicao = inst.cnpj;
        r.campos.emailInstituicao = inst.email;
        r.origens.instituicao = "MEMORIA_INSTITUICAO";
        r.origens.emailInstituicao = "MEMORIA_INSTITUICAO";
      }
    }

    r.avisos = r.avisos.filter(Boolean);
    return r;
  } catch (e) {
    Logger.log("voucherSugerirSolicitacao: " + e.message);
    return { ok: false, mensagem: e.message, campos: {}, origens: {}, avisos: [] };
  }
}
