// ============================================================================
// ARQUIVO: AssociadosBase.gs
// MÓDULO: Sindicalização › Base de Associados
//
// POR QUE ESTE ARQUIVO EXISTE
// A aba Associados tem ~8.000 pessoas e é a base cadastral do sindicato:
// Portal, carteirinha, China Park, voucher e cobrança leem dela. Até hoje ela
// não tinha tela nenhuma.
//
// Dava para alcançar um associado por DENTRO de outro fluxo — aprovando uma
// ficha, emitindo uma carteirinha, consultando um CPF. Nunca por ela mesma.
// Na prática: para saber quantos filiados existem, alguém abria a planilha.
// Para achar quem está sem e-mail, alguém filtrava na mão. Para conferir se
// um associado tem matrícula, alguém procurava linha por linha.
//
// O item 6 do PROMPT-MESTRE lista "Cadastro de Associados" como área própria
// do sindicato, e o 7.6 manda dar submódulo a ela. É o que este arquivo faz.
//
// O DESENHO SEGUE O §4: TELA É ESTADO, NÃO ASSUNTO
// As telas deste submódulo são filas de trabalho, não categorias:
//
//   Filiados          quem está ativo — a base que os outros módulos leem
//   Não filiados      desfiliados e ex-associados
//   Sem matrícula     filiado que nunca recebeu matrícula. É defeito de
//                     cadastro: sem matrícula não sai carteirinha.
//   Sem e-mail        filiado que o sistema NÃO CONSEGUE avisar de nada —
//                     nem de assembleia, nem de benefício, nem de cobrança
//   Sem escola        filiado sem vínculo com estabelecimento, o que quebra
//                     a cobrança da relação nominal
//
// As três últimas são o ponto: são pendências que ninguém enxergava porque
// não havia onde olhar. Não é relatório — é trabalho a fazer.
//
// O QUE ESTE MÓDULO NÃO FAZ
// Não cria associado. Associado nasce de ficha aprovada (Sindicalizacaoadmin)
// ou de importação — nunca digitado direto, senão a base perde a rastreabilidade
// de qual ficha originou cada pessoa. Aqui se consulta, corrige contato e
// resolve pendência.
//
// LGPD: a listagem devolve CPF MASCARADO (***.***.789-01). O CPF inteiro só
// sai na consulta individual, que é registrada. Uma tela de 8.000 CPFs abertos
// fica exposta na mesa o dia inteiro.
// ============================================================================

var ASSOC_MODULO = "sindicalizacao";

// Quanto a listagem devolve por vez. 8.000 linhas de uma vez estouram o
// tempo de resposta do google.script.run e travam a tela.
var ASSOC_PAGINA = 50;

/** As filas de trabalho. Cada uma é uma tela (§4). */
var ASSOC_FILAS = {
  FILIADOS: {
    rotulo: "Filiados",
    descricao: "Base ativa — é esta que Portal, carteirinha e benefícios leem",
    filtro: function (a) { return a.filiado; }
  },
  NAO_FILIADOS: {
    rotulo: "Não filiados",
    descricao: "Desfiliados e ex-associados",
    filtro: function (a) { return !a.filiado; }
  },
  SEM_MATRICULA: {
    rotulo: "Sem matrícula",
    descricao: "Filiado sem matrícula — sem ela não se emite carteirinha",
    pendencia: true,
    filtro: function (a) { return a.filiado && !a.matricula; }
  },
  SEM_EMAIL: {
    rotulo: "Sem e-mail",
    descricao: "Filiado que o sindicato não consegue avisar de nada",
    pendencia: true,
    filtro: function (a) { return a.filiado && !a.email; }
  },
  SEM_ESCOLA: {
    rotulo: "Sem escola",
    descricao: "Filiado sem vínculo — quebra a cobrança da relação nominal",
    pendencia: true,
    filtro: function (a) { return a.filiado && !a.escola; }
  }
};

/* ==========================================================================
 * LEITURA
 * ========================================================================== */

/**
 * Lê a base inteira uma vez e devolve objetos normalizados.
 * Uma leitura de intervalo só — ler célula a célula em 8.000 linhas leva
 * minutos e estoura o limite de execução do Apps Script.
 */
function assoc_todos_() {
  var aba = sindAss_aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];

  var mapa = sindAss_mapaCabecalho_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();

  function idx(nome) {
    var i = mapa[String(nome).toUpperCase()];
    return (i === undefined) ? SIND_ASS_COLUNAS.indexOf(nome) : i;
  }
  var cNome = idx("Nome"), cCpf = idx("CPF"), cFil = idx("Filiado"),
      cMat = idx("MATRICULA"), cMail = idx("E-mail"), cEsc = idx("Nome fantasia"),
      cCel = idx("Celular"), cCid = idx("Cidade"), cData = idx("DATA_FILIACAO"),
      cAtu = idx("ULTIMA_ATUALIZACAO"), cFicha = idx("ID_FICHA");

  return dados.map(function (l, i) {
    var cpf = sindAss_digitos_(l[cCpf]);
    return {
      linha: i + 2,
      nome: String(l[cNome] || "").trim(),
      cpf: cpf,
      cpfMascarado: assoc_mascararCpf_(cpf),
      filiado: String(l[cFil] || "").trim().toUpperCase() === "S",
      matricula: String(l[cMat] || "").trim(),
      email: String(l[cMail] || "").trim(),
      escola: String(l[cEsc] || "").trim(),
      celular: String(l[cCel] || "").trim(),
      cidade: String(l[cCid] || "").trim(),
      dataFiliacao: l[cData] || "",
      ultimaAtualizacao: l[cAtu] || "",
      idFicha: String(l[cFicha] || "").trim()
    };
  });
}

/**
 * ***.***.789-01 — mostra o suficiente para conferir com a pessoa ao
 * telefone, sem publicar o documento numa tela que fica aberta.
 */
function assoc_mascararCpf_(cpf) {
  var d = sindAss_digitos_(cpf);
  if (d.length !== 11) return "—";
  return "***.***." + d.slice(6, 9) + "-" + d.slice(9);
}

function assoc_normalizar_(v) {
  return String(v || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/* ==========================================================================
 * ENDPOINTS
 * ========================================================================== */

/**
 * Contagem de cada fila. É o que o painel abre primeiro: mostra onde há
 * trabalho antes de mostrar linha nenhuma.
 */
function assocPainel(tokenSessao) {
  exigirModulo_(tokenSessao, ASSOC_MODULO, false);
  var todos = assoc_todos_();

  var filas = Object.keys(ASSOC_FILAS).map(function (chave) {
    var f = ASSOC_FILAS[chave];
    return {
      chave: chave, rotulo: f.rotulo, descricao: f.descricao,
      pendencia: f.pendencia === true,
      total: todos.filter(f.filtro).length
    };
  });

  var pendencias = filas.filter(function (f) { return f.pendencia; })
    .reduce(function (s, f) { return s + f.total; }, 0);

  return {
    ok: true,
    totalBase: todos.length,
    filas: filas,
    totalPendencias: pendencias,
    // Sem isto o painel viraria só números. A frase diz o que fazer com eles.
    resumo: pendencias === 0
      ? "Nenhuma pendência de cadastro."
      : pendencias + " cadastro(s) com pendência que impede algum serviço: " +
        "sem matrícula não sai carteirinha, sem e-mail não há como avisar, " +
        "sem escola a relação nominal não fecha."
  };
}

/**
 * Uma fila, paginada e com busca. CPF vem mascarado.
 */
function assocListar(fila, termo, pagina, tokenSessao) {
  exigirModulo_(tokenSessao, ASSOC_MODULO, false);

  var f = ASSOC_FILAS[String(fila || "FILIADOS").toUpperCase()];
  if (!f) return { ok: false, mensagem: "Fila desconhecida: " + fila };

  var lista = assoc_todos_().filter(f.filtro);

  var busca = assoc_normalizar_(termo);
  if (busca) {
    var soDigitos = String(termo).replace(/\D/g, "");
    lista = lista.filter(function (a) {
      if (soDigitos.length >= 3 && a.cpf.indexOf(soDigitos) > -1) return true;
      return assoc_normalizar_(a.nome + " " + a.escola + " " + a.matricula +
        " " + a.email).indexOf(busca) > -1;
    });
  }

  lista.sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });

  var p = Math.max(1, parseInt(pagina, 10) || 1);
  var ini = (p - 1) * ASSOC_PAGINA;
  var fatia = lista.slice(ini, ini + ASSOC_PAGINA).map(function (a) {
    return {
      linha: a.linha, nome: a.nome, cpf: a.cpfMascarado,
      matricula: a.matricula || "—", email: a.email || "—",
      escola: a.escola || "—", cidade: a.cidade || "—",
      filiado: a.filiado
    };
  });

  return {
    ok: true, fila: f.rotulo, descricao: f.descricao,
    total: lista.length, pagina: p,
    totalPaginas: Math.max(1, Math.ceil(lista.length / ASSOC_PAGINA)),
    associados: fatia
  };
}

/**
 * Ficha individual, com o CPF inteiro e o que o associado tem em cada módulo.
 * É aqui que se responde "esse associado tem carteirinha?" sem abrir a
 * planilha — e a consulta fica registrada, porque abre dado pessoal.
 */
function assocDetalhe(cpf, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, ASSOC_MODULO, false);

  var d = sindAss_digitos_(cpf);
  if (d.length !== 11) return { ok: false, mensagem: "CPF inválido." };

  var a = assoc_todos_().filter(function (x) { return x.cpf === d; })[0];
  if (!a) return { ok: false, mensagem: "CPF não consta na base de associados." };

  // Consulta a dado pessoal completo é ação auditável (§15).
  try {
    if (typeof registrarLogSistema === "function") {
      registrarLogSistema({
        modulo: "Base de Associados", acao: "CONSULTA_FICHA",
        usuario: sessao.email || sessao.usuario || "—",
        detalhe: "CPF " + assoc_mascararCpf_(d)
      });
    }
  } catch (e) { Logger.log("assocDetalhe — log falhou: " + e); }

  var pendencias = [];
  if (a.filiado && !a.matricula) pendencias.push("Sem matrícula — não é possível emitir carteirinha.");
  if (a.filiado && !a.email) pendencias.push("Sem e-mail — o sindicato não consegue avisar esta pessoa.");
  if (a.filiado && !a.escola) pendencias.push("Sem escola vinculada — a relação nominal não fecha.");

  var carteirinha = null;
  try {
    if (typeof cartAd_emissaoAtivaPorCpf_ === "function") {
      carteirinha = cartAd_emissaoAtivaPorCpf_(d);
    }
  } catch (e) { Logger.log("assocDetalhe — carteirinha: " + e); }

  return {
    ok: true,
    associado: {
      nome: a.nome, cpf: sindAss_fmtCPF_(d), filiado: a.filiado,
      matricula: a.matricula || "—", email: a.email || "—",
      celular: a.celular || "—", escola: a.escola || "—", cidade: a.cidade || "—",
      dataFiliacao: a.dataFiliacao, ultimaAtualizacao: a.ultimaAtualizacao,
      idFicha: a.idFicha || "—", linha: a.linha
    },
    carteirinha: carteirinha
      ? { status: carteirinha.status, validade: carteirinha.validade, codigo: carteirinha.codigo }
      : null,
    pendencias: pendencias
  };
}

/**
 * Corrige contato (e-mail, celular). Só isso — nome, CPF e filiação mudam
 * por fluxo próprio, não por edição avulsa, senão a base perde a
 * rastreabilidade de quem alterou o quê e com que fundamento.
 */
function assocCorrigirContato(cpf, dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, ASSOC_MODULO, false);
  dados = dados || {};

  var d = sindAss_digitos_(cpf);
  if (d.length !== 11) return { ok: false, mensagem: "CPF inválido." };

  var email = String(dados.email || "").trim().toLowerCase();
  var celular = String(dados.celular || "").trim();
  if (!email && !celular) {
    return { ok: false, mensagem: "Informe e-mail ou celular para corrigir." };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, mensagem: "E-mail inválido." };
  }

  var trava = travarSisgep_(20000);
  try {
    var a = assoc_todos_().filter(function (x) { return x.cpf === d; })[0];
    if (!a) return { ok: false, mensagem: "CPF não consta na base." };

    var aba = sindAss_aba_();
    var mapa = sindAss_mapaCabecalho_(aba);
    function col(nome) {
      var i = mapa[String(nome).toUpperCase()];
      return (i === undefined ? SIND_ASS_COLUNAS.indexOf(nome) : i) + 1;
    }

    var mudou = [];
    if (email && email !== a.email) {
      aba.getRange(a.linha, col("E-mail")).setValue(email);
      mudou.push("e-mail: " + (a.email || "vazio") + " → " + email);
    }
    if (celular) {
      var fmt = sindAss_fmtTelefone_(celular);
      if (fmt !== a.celular) {
        aba.getRange(a.linha, col("Celular")).setValue(fmt);
        mudou.push("celular: " + (a.celular || "vazio") + " → " + fmt);
      }
    }
    if (!mudou.length) return { ok: true, alterado: false, mensagem: "Nada mudou." };

    aba.getRange(a.linha, col("ULTIMA_ATUALIZACAO")).setValue(new Date());

    try {
      if (typeof registrarLogSistema === "function") {
        registrarLogSistema({
          modulo: "Base de Associados", acao: "CORRECAO_CONTATO",
          usuario: sessao.email || sessao.usuario || "—",
          detalhe: "CPF " + assoc_mascararCpf_(d) + " — " + mudou.join("; ")
        });
      }
    } catch (e) { Logger.log("assocCorrigirContato — log falhou: " + e); }

    return { ok: true, alterado: true, alteracoes: mudou,
      mensagem: "Contato atualizado: " + mudou.join("; ") };
  } finally {
    trava.liberar();
  }
}

/**
 * Exporta a fila para conferência fora do sistema.
 * CPF continua mascarado: planilha exportada circula por e-mail e WhatsApp.
 */
function assocExportarFila(fila, tokenSessao) {
  exigirModulo_(tokenSessao, ASSOC_MODULO, false);
  var f = ASSOC_FILAS[String(fila || "").toUpperCase()];
  if (!f) return { ok: false, mensagem: "Fila desconhecida." };

  var lista = assoc_todos_().filter(f.filtro)
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });

  var linhas = [["Nome", "CPF", "Matrícula", "E-mail", "Escola", "Cidade"]];
  lista.forEach(function (a) {
    linhas.push([a.nome, a.cpfMascarado, a.matricula || "", a.email || "",
                 a.escola || "", a.cidade || ""]);
  });

  /* Exportação da base na trilha. dadoPessoal fica VERDADEIRO mesmo com o
   * CPF mascarado: nome completo, e-mail e escola juntos já identificam a
   * pessoa, e a LGPD não fala em CPF — fala em dado que identifica. */
  try {
    if (typeof aud_deExportacao_ === "function") {
      aud_deExportacao_({
        modulo: "Base de Associados", submodulo: "Exportações",
        formato: "CSV", total: lista.length, dadoPessoal: true,
        filtros: { fila: f.rotulo },
        sessao: { token: tokenSessao }
      });
    }
  } catch (e) { Logger.log("[exportacao] ponte de auditoria falhou: " + e.message); }

  return { ok: true, fila: f.rotulo, total: lista.length, linhas: linhas };
}
