/* ================================================================
   VoucherEscolaDoTitular.gs — O DEPENDENTE PUXA A ESCOLA DO TITULAR (24/11/2026)

   Pedido do usuário: "todos os dependentes devem puxar a escola do titular
   para emissão do voucher". Decisões dele, na mesma conversa:

     - a escola vem do TITULAR (cadastro de Associados); mas tem de existir
       uma OPÇÃO de troca, porque o titular pode trabalhar numa faculdade e o
       filho estudar num colégio da mesma rede;
     - se a escola do titular não for achada: deixar digitar, com aviso;
     - "mesma rede" só AVISA, não bloqueia;
     - os dependentes já emitidos com escola diferente só são LISTADOS, nada é
       reescrito.

   ONDE A REGRA MORA: no servidor, em voucherCriarSolicitacao — o ponto por
   onde passam a tela da Secretaria e o pedido em lote. "A tela não deixa" nunca
   foi trava, é aparência. (O portal do associado já vinha com esta regra em
   VoucherSolicitacao.gs, "A escola NÃO vem do dependente".)

   O QUE NUNCA É FEITO EM SILÊNCIO: quando a escola digitada é substituída ou
   quando vale uma digitada sem cadastro, a resposta traz o aviso e o histórico
   da solicitação ganha uma linha (ESCOLA_DEPENDENTE). Campo que o sistema
   preencheu sozinho e não avisou é o que vira erro que ninguém percebe.
   ================================================================ */

/** CPF completado até 11 dígitos — a base de Associados guarda como NÚMERO e perde o zero. */
function voucherCpf11_(valor) {
  var d = String(valor == null ? "" : valor).replace(/\D/g, "");
  return d && d.length < 11 ? ("00000000000" + d).slice(-11) : d;
}

function voucherEscolaRaizCnpj_(cnpj) {
  return String(cnpj || "").replace(/\D/g, "").slice(0, 8);
}

/** O nome da escola que o cadastro de Associados guarda para este CPF (só duas colunas são lidas). */
function voucherEscolaNomeNoCadastro_(cpf11) {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Associados");
  if (!sh || sh.getLastRow() < 2) return "";
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (c) { return String(c || "").trim(); });
  function idx(nomes) {
    for (var i = 0; i < nomes.length; i++) { var p = cab.indexOf(nomes[i]); if (p > -1) return p; }
    return -1;
  }
  var iCpf = idx(["CPF", "Cpf", "CPF_ASSOCIADO"]);
  var iEsc = idx(["Nome fantasia", "ESCOLA", "Escola", "Empresa"]);
  if (iCpf === -1 || iEsc === -1) return "";
  var n = sh.getLastRow() - 1;
  var cpfs = sh.getRange(2, iCpf + 1, n, 1).getValues();
  for (var l = 0; l < n; l++) {
    if (voucherCpf11_(cpfs[l][0]) !== cpf11) continue;
    var nome = String(sh.getRange(2 + l, iEsc + 1).getValue() || "").trim();
    if (nome) return nome;
  }
  return "";
}

/**
 * Casa o nome do cadastro de Associados com UMA escola do cadastro de Escolas
 * (que tem CNPJ e ID). Só devolve quando a correspondência é segura: nome igual
 * e único, ou única escola achada. Parecido NÃO conta — CNPJ errado num
 * certificado não é conferido por ninguém depois.
 */
function voucherEscolaCasarComCadastro_(nomeCadastro) {
  if (typeof buscarEscolasPorTermo_interno_ !== "function") return null;
  var achadas = [];
  try { achadas = buscarEscolasPorTermo_interno_(nomeCadastro) || []; } catch (e) { return null; }
  if (!achadas.length) return null;

  var norm = (typeof voucherInstNormalizar_ === "function")
    ? voucherInstNormalizar_ : function (t) { return String(t || "").trim().toUpperCase(); };
  var alvo = norm(nomeCadastro);
  function nomeDe(e) { return String(e.escola || e.NomeEscola || e.nome || e["Escola (Razão Social)"] || "").trim(); }
  function fantasiaDe(e) { return String(e.fantasia || e.Fantasia || e.NOME_FANTASIA || "").trim(); }

  var exatas = achadas.filter(function (e) {
    return norm(nomeDe(e)) === alvo || (fantasiaDe(e) && norm(fantasiaDe(e)) === alvo);
  });
  var e = exatas.length === 1 ? exatas[0] : (exatas.length === 0 && achadas.length === 1 ? achadas[0] : null);
  if (!e) return null;
  return {
    nome: nomeDe(e),
    fantasia: fantasiaDe(e),
    unidade: "",
    cnpj: String(e.cnpjLimpo || e.cnpj || e.CNPJ || "").replace(/\D/g, ""),
    cidade: String(e.cidade || e.municipio || e.Cidade || "").trim(),
    escolaId: String(e.EscolaID || e.escolaId || (typeof ESC_COL_ID !== "undefined" ? e[ESC_COL_ID] : "") || "").trim()
  };
}

/** A escola gravada na solicitação MAIS RECENTE do próprio titular (beneficiário TITULAR), com CNPJ e ID já gravados. */
function voucherEscolaDaSolicitacaoAnterior_(cpf11) {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Voucher_Solicitacoes");
  if (!sh || sh.getLastRow() < 2) return null;
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (c) { return String(c || "").trim(); });
  var iCpf = cab.indexOf("CPF_SOLICITANTE"), iTipo = cab.indexOf("TIPO_BENEFICIARIO"), iEsc = cab.indexOf("ESCOLA_SELECIONADA");
  if (iCpf === -1 || iEsc === -1) return null;
  var n = sh.getLastRow() - 1;
  var cpfs = sh.getRange(2, iCpf + 1, n, 1).getValues();
  var tipos = iTipo === -1 ? null : sh.getRange(2, iTipo + 1, n, 1).getValues();
  for (var l = n - 1; l >= 0; l--) {
    if (voucherCpf11_(cpfs[l][0]) !== cpf11) continue;
    var tipo = tipos ? String(tipos[l][0] || "").trim().toUpperCase() : "TITULAR";
    if (tipo && tipo !== "TITULAR") continue;
    var linha = sh.getRange(2 + l, 1, 1, cab.length).getValues()[0];
    var v = function (nome) { var p = cab.indexOf(nome); return p === -1 ? "" : String(linha[p] == null ? "" : linha[p]).trim(); };
    if (!v("ESCOLA_SELECIONADA")) continue;
    return { nome: v("ESCOLA_SELECIONADA"), fantasia: v("ESCOLA_FANTASIA"), unidade: v("UNIDADE_ESCOLA"),
             cnpj: v("CNPJ_ESCOLA").replace(/\D/g, ""), cidade: v("CIDADE_ESCOLA"), escolaId: v("ESCOLA_ID") };
  }
  return null;
}

/**
 * A escola do titular, com a ORIGEM de onde veio — a tela mostra a origem, para
 * a escola preenchida sozinha não passar por conferida.
 *   origem: "CADASTRO" | "SOLICITACAO_ANTERIOR" | ""  (vazio = não achou)
 */
function voucherEscolaDoTitular_(cpf) {
  var r = { achou: false, origem: "", nome: "", fantasia: "", unidade: "", cnpj: "", cidade: "",
            escolaId: "", nomeCadastro: "", aviso: "" };
  var cpf11 = voucherCpf11_(cpf);
  if (cpf11.length !== 11) return r;

  try {
    var nomeCad = voucherEscolaNomeNoCadastro_(cpf11);
    r.nomeCadastro = nomeCad;
    if (nomeCad) {
      var casada = voucherEscolaCasarComCadastro_(nomeCad);
      if (casada) { Object.keys(casada).forEach(function (k) { r[k] = casada[k]; }); r.achou = true; r.origem = "CADASTRO"; return r; }
      r.aviso = "A escola do cadastro de Associados (“" + nomeCad + "”) não casou com certeza com o cadastro de Escolas.";
    }
  } catch (e1) { Logger.log("voucherEscolaDoTitular_ (cadastro): " + e1.message); }

  try {
    var ant = voucherEscolaDaSolicitacaoAnterior_(cpf11);
    if (ant) { Object.keys(ant).forEach(function (k) { r[k] = ant[k]; }); r.achou = true; r.origem = "SOLICITACAO_ANTERIOR"; r.aviso = ""; }
  } catch (e2) { Logger.log("voucherEscolaDoTitular_ (solicitação anterior): " + e2.message); }
  return r;
}

/**
 * Aplica a regra a UMA solicitação, ALTERANDO `dados` (escola, escolaFantasia,
 * unidadeEscola, cnpjEscola, cidadeEscola, escolaId). Devolve:
 *   { erro }                    — recusa, com o motivo;
 *   { origem, aviso, aplicada, registrar, trocada } — o que foi feito, para a tela e o histórico.
 *
 * origem: TITULAR (não é dependente, nada muda) · DO_TITULAR · TROCADA ·
 *         DIGITADA_SEM_CADASTRO · SEM_ESCOLA (avisa, não recusa).
 */
function voucherAplicarEscolaDoTitular_(dados, cpf) {
  var tipo = String(dados.tipoBeneficiario || "TITULAR").trim().toUpperCase();
  var neutro = { origem: "TITULAR", aviso: "", aplicada: null, registrar: false, trocada: false };
  if (!tipo || tipo === "TITULAR") return neutro;

  var titular = voucherEscolaDoTitular_(cpf);
  function resumo(o) { return { nome: o.nome, fantasia: o.fantasia, cnpj: o.cnpj, escolaId: o.escolaId }; }

  /* A OPÇÃO DE TROCA — titular numa faculdade, filho num colégio da mesma rede. */
  if (dados.escolaDiferenteDoTitular === true) {
    var motivo = String(dados.motivoEscolaDiferente || "").trim();
    if (!motivo) return { erro: "Informe o motivo de a escola do dependente ser diferente da do titular." };
    if (!String(dados.escola || "").trim()) return { erro: "Escolha a escola do dependente." };
    var aviso = "";
    var raizT = voucherEscolaRaizCnpj_(titular.cnpj), raizD = voucherEscolaRaizCnpj_(dados.cnpjEscola);
    if (titular.achou && raizT && raizD && raizT !== raizD) {
      aviso = "A escola escolhida não tem a mesma raiz de CNPJ da escola do titular (" + titular.nome +
              "). Confira se é da mesma rede.";
    }
    return { origem: "TROCADA", aviso: aviso, trocada: true, registrar: true, motivo: motivo,
             titular: titular.achou ? resumo(titular) : null,
             aplicada: { nome: String(dados.escola).trim(), fantasia: String(dados.escolaFantasia || "").trim(),
                         cnpj: String(dados.cnpjEscola || "").replace(/\D/g, ""), escolaId: String(dados.escolaId || "").trim() } };
  }

  if (titular.achou) {
    var digitada = String(dados.escola || "").trim();
    var difere = digitada && digitada.toUpperCase() !== String(titular.nome).trim().toUpperCase();
    dados.escola = titular.nome;
    dados.escolaFantasia = titular.fantasia;
    dados.unidadeEscola = titular.unidade;
    dados.cnpjEscola = titular.cnpj;
    dados.cidadeEscola = titular.cidade;
    dados.escolaId = titular.escolaId;
    return { origem: "DO_TITULAR", fonte: titular.origem, registrar: true, trocada: false, aplicada: resumo(titular),
             aviso: difere ? "A escola digitada (“" + digitada + "”) foi substituída pela do titular (“" + titular.nome + "”)." : "" };
  }

  /* NÃO ACHOU: deixa digitar, com aviso (decisão do usuário). Sem escola nenhuma
     a solicitação continua sendo criada, como sempre foi — a escola nunca foi
     obrigatória na criação —, mas o aviso diz que falta preencher antes de emitir. */
  if (!String(dados.escola || "").trim()) {
    return { origem: "SEM_ESCOLA", registrar: true, trocada: false,
             aplicada: { nome: "", fantasia: "", cnpj: "", escolaId: "" },
             aviso: "A escola do titular não foi encontrada no cadastro" +
                    (titular.nomeCadastro ? " (cadastro diz “" + titular.nomeCadastro + "”)" : "") +
                    " e nenhuma foi informada. Preencha a escola antes de emitir o certificado." };
  }
  return { origem: "DIGITADA_SEM_CADASTRO", registrar: true, trocada: false,
           aplicada: { nome: String(dados.escola).trim(), fantasia: String(dados.escolaFantasia || "").trim(),
                       cnpj: String(dados.cnpjEscola || "").replace(/\D/g, ""), escolaId: String(dados.escolaId || "").trim() },
           aviso: "A escola do titular não foi encontrada no cadastro; valeu a que foi digitada." +
                  (titular.aviso ? " " + titular.aviso : "") };
}

/** A linha do histórico (append-only) que diz de onde veio a escola do dependente. Nunca lança. */
function voucherRegistrarEscolaDoDependente_(idSolicitacao, cpf, protocolo, quem, ap) {
  try {
    if (typeof registrarHistoricoVoucher_ !== "function" || !ap || !ap.registrar) return;
    var onde = ap.aplicada ? ap.aplicada.nome + (ap.aplicada.cnpj ? " (CNPJ " + ap.aplicada.cnpj + ")" : "") : "";
    var texto = ap.origem === "SEM_ESCOLA"
      ? "Escola do dependente em branco: a do titular não foi encontrada no cadastro."
      : ap.origem === "DO_TITULAR"
      ? "Escola do dependente: " + onde + " — a mesma do titular (" + (ap.fonte === "CADASTRO" ? "cadastro de Associados" : "solicitação anterior do titular") + ")."
      : ap.origem === "TROCADA"
        ? "Escola do dependente DIFERENTE da do titular: " + onde + ". Motivo: " + ap.motivo + "."
        : "Escola do dependente digitada, sem a do titular no cadastro: " + onde + ".";
    if (ap.aviso) texto += " AVISO: " + ap.aviso;
    registrarHistoricoVoucher_(idSolicitacao, cpf, "ESCOLA_DEPENDENTE", quem, texto, protocolo);
  } catch (e) { Logger.log("voucherRegistrarEscolaDoDependente_: " + e.message); }
}

/** CPF → nome da escola no cadastro de Associados, numa leitura só (para a lista, que olha muitos titulares). */
function voucherMapaEscolaDoCadastro_() {
  var mapa = {};
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Associados");
  if (!sh || sh.getLastRow() < 2) return mapa;
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (c) { return String(c || "").trim(); });
  function idx(nomes) { for (var i = 0; i < nomes.length; i++) { var p = cab.indexOf(nomes[i]); if (p > -1) return p; } return -1; }
  var iCpf = idx(["CPF", "Cpf", "CPF_ASSOCIADO"]), iEsc = idx(["Nome fantasia", "ESCOLA", "Escola", "Empresa"]);
  if (iCpf === -1 || iEsc === -1) return mapa;
  var n = sh.getLastRow() - 1;
  var cpfs = sh.getRange(2, iCpf + 1, n, 1).getValues(), escs = sh.getRange(2, iEsc + 1, n, 1).getValues();
  for (var l = 0; l < n; l++) {
    var c = voucherCpf11_(cpfs[l][0]), e = String(escs[l][0] || "").trim();
    if (c && e && !mapa[c]) mapa[c] = e;
  }
  return mapa;
}

/**
 * LISTA DE LEITURA (decisão do usuário: "só listar, sem alterar nada"):
 * dependentes já gravados cuja escola difere da escola do TITULAR no cadastro
 * (ou, sem cadastro, da gravada no voucher do próprio titular).
 * NÃO escreve em lugar nenhum.
 */
function voucherListarDependentesComEscolaDiferente(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName("Voucher_Solicitacoes");
  if (!sh || sh.getLastRow() < 2) return { ok: true, itens: [], total: 0 };
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (c) { return String(c || "").trim(); });
  var ix = {};
  ["NUMERO_PROTOCOLO", "PROTOCOLO", "CPF_SOLICITANTE", "NOME_SOLICITANTE", "TIPO_BENEFICIARIO", "NOME_BENEFICIARIO",
   "ESCOLA_SELECIONADA", "CNPJ_ESCOLA"].forEach(function (c) { ix[c] = cab.indexOf(c); });
  var iProt = ix.NUMERO_PROTOCOLO > -1 ? ix.NUMERO_PROTOCOLO : ix.PROTOCOLO;
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues();
  function v(l, c) { return ix[c] === -1 ? "" : String(l[ix[c]] == null ? "" : l[ix[c]]).trim(); }

  var mapaCad = voucherMapaEscolaDoCadastro_();
  var porCasamento = {}, porTitular = {};
  dados.forEach(function (l) {                       // voucher do próprio titular, para quando o cadastro não diz
    var t = v(l, "TIPO_BENEFICIARIO").toUpperCase();
    if (t && t !== "TITULAR") return;
    var cpf = voucherCpf11_(v(l, "CPF_SOLICITANTE"));
    if (cpf && v(l, "ESCOLA_SELECIONADA")) porTitular[cpf] = { nome: v(l, "ESCOLA_SELECIONADA"), cnpj: v(l, "CNPJ_ESCOLA").replace(/\D/g, "") };
  });
  function escolaDoTitular(cpf) {
    var nomeCad = mapaCad[cpf];
    if (nomeCad) {
      if (!(nomeCad in porCasamento)) porCasamento[nomeCad] = voucherEscolaCasarComCadastro_(nomeCad);
      var c = porCasamento[nomeCad];
      if (c) return { nome: c.nome, cnpj: c.cnpj };
    }
    return porTitular[cpf] || null;
  }

  var itens = [];
  dados.forEach(function (l) {
    var t = v(l, "TIPO_BENEFICIARIO").toUpperCase();
    if (!t || t === "TITULAR") return;
    var cpf = voucherCpf11_(v(l, "CPF_SOLICITANTE")), tit = escolaDoTitular(cpf);
    if (!tit) return;
    var nome = v(l, "ESCOLA_SELECIONADA"), cnpj = v(l, "CNPJ_ESCOLA").replace(/\D/g, "");
    var diferente = cnpj && tit.cnpj ? cnpj !== tit.cnpj : nome.toUpperCase() !== String(tit.nome).toUpperCase();
    if (!diferente) return;
    itens.push({ protocolo: iProt === -1 ? "" : String(l[iProt] || "").trim(), titular: v(l, "NOME_SOLICITANTE"),
                 dependente: v(l, "NOME_BENEFICIARIO"), escolaDoDependente: nome, escolaDoTitular: tit.nome,
                 mesmaRaizCnpj: voucherEscolaRaizCnpj_(cnpj) !== "" && voucherEscolaRaizCnpj_(cnpj) === voucherEscolaRaizCnpj_(tit.cnpj) });
  });
  return { ok: true, itens: itens, total: itens.length };
}
