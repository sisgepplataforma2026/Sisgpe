// ============================================================================
// ARQUIVO: FinanceiroConciliacao.gs
//
// Conciliação bancária com persistência real.
//
// Achado da auditoria do módulo Financeiro: a tela de conciliação existia mas
// não tinha backend nenhum — guardava tudo em localStorage do navegador
// (chave "sisgep_conciliacao_bancaria_v1"). O trabalho de conciliar um mês
// inteiro sumia ao trocar de computador ou limpar o navegador, ninguém mais
// via o que já tinha sido conferido, e marcar um movimento como "conciliado"
// não gravava absolutamente nada na despesa real. Também só lia texto colado,
// não OFX — que é o formato que os bancos brasileiros exportam.
//
// Este arquivo resolve os três pontos: grava em planilha, entende OFX além de
// texto/CSV, e a baixa é feita chamando marcarDespesaComoPaga (Despesas.gs) —
// a função que já existe, já valida sessão, já usa LockService e já registra
// auditoria. Não se cria caminho paralelo para mexer em dinheiro.
// ============================================================================

var ABA_CONCILIACAO = "CONCILIACAO_BANCARIA";

var CONC_CABECALHO = [
  "ID", "DATA_IMPORTACAO", "IMPORTADO_POR", "ORIGEM",
  "FITID", "DATA_MOVIMENTO", "DESCRICAO", "VALOR", "TIPO",
  "STATUS", "ID_DESPESA", "SUGESTAO", "CONFIANCA",
  "CONCILIADO_POR", "DATA_CONCILIACAO", "OBSERVACAO"
];

var CONC_STATUS = {
  PENDENTE:   "PENDENTE",
  CONCILIADO: "CONCILIADO",
  IGNORADO:   "IGNORADO"
};

/* ================= INFRA ================= */

function conc_aba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA_CONCILIACAO);
  if (!sh) {
    sh = ss.insertSheet(ABA_CONCILIACAO);
    sh.appendRow(CONC_CABECALHO);
    sh.getRange(1, 1, 1, CONC_CABECALHO.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function conc_mapa_(sh) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var m = {};
  cab.forEach(function (c, i) { m[String(c || "").trim()] = i; });
  return m;
}

function conc_id_() {
  return "CONC-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function conc_num_(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var s = String(v || "").trim().replace(/\s/g, "").replace("R$", "");
  if (!s) return 0;
  // "1.234,56" (BR) vs "1234.56" (OFX/ISO): a vírgula decide quem é separador.
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function conc_normalizar_(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function conc_dataISO_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/* ================= LEITURA DE EXTRATO ================= */

/**
 * OFX (Open Financial Exchange) é o que Itaú, Bradesco, BB, Caixa, Santander e
 * Sicoob exportam como "extrato para conciliação". É SGML, não XML válido —
 * muitas tags não fecham — então não dá para usar parser XML; lê-se por regex
 * sobre cada bloco <STMTTRN>.
 *
 * FITID é o identificador único do movimento dado pelo próprio banco. É o que
 * permite reimportar o mesmo arquivo sem duplicar lançamento.
 */
function conc_lerOFX_(texto) {
  var out = [];
  var blocos = String(texto || "").split(/<STMTTRN>/i);

  for (var i = 1; i < blocos.length; i++) {
    var b = blocos[i];
    var pega = function (tag) {
      var m = b.match(new RegExp("<" + tag + ">([^<\\r\\n]*)", "i"));
      return m ? m[1].trim() : "";
    };

    var dtRaw = pega("DTPOSTED");          // YYYYMMDD[HHMMSS][fuso]
    var data = "";
    var md = dtRaw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (md) data = md[1] + "-" + md[2] + "-" + md[3];

    var valor = conc_num_(pega("TRNAMT")); // OFX já vem com sinal
    var memo  = pega("MEMO") || pega("NAME");
    var fitid = pega("FITID");

    if (!data && !valor) continue;

    out.push({
      fitid: fitid,
      data: data,
      descricao: memo || "Movimento sem descrição",
      valor: valor
    });
  }
  return out;
}

/**
 * Texto colado ou CSV. Bem menos confiável que OFX — só se usa quando o banco
 * não oferece OFX. Sem FITID, a deduplicação cai para data+valor+descrição.
 */
function conc_lerTexto_(texto) {
  var out = [];
  var linhas = String(texto || "").split(/\r?\n/);

  linhas.forEach(function (linha) {
    linha = linha.trim();
    if (!linha) return;

    var mValor = linha.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2}\b/g);
    if (!mValor || !mValor.length) return;
    var bruto = mValor[mValor.length - 1];

    var mData = linha.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    var data = "";
    if (mData) {
      var ano = mData[3] || String(new Date().getFullYear());
      if (ano.length === 2) ano = "20" + ano;
      data = ano + "-" + ("0" + mData[2]).slice(-2) + "-" + ("0" + mData[1]).slice(-2);
    }

    var valor = conc_num_(bruto);
    // Extrato em texto costuma marcar saída por palavra, não por sinal.
    if (valor > 0 && /\bD\b|DEB|SAIDA|SAÍDA|PAGAMENTO|TARIFA|PIX ENVIADO|COMPRA/i.test(linha)) valor = -valor;

    var desc = linha.replace(bruto, "")
      .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/, "")
      .replace(/\s{2,}/g, " ").trim();

    out.push({ fitid: "", data: data, descricao: desc || "Movimento sem descrição", valor: valor });
  });
  return out;
}

/* ================= MOTOR DE SUGESTÃO ================= */

/**
 * Cruza a saída bancária com as despesas em aberto. Casa por valor exato
 * (tolerância de 1 centavo) e reforça a confiança quando o nome do prestador
 * aparece na descrição do extrato e quando a data está próxima do vencimento.
 * Nunca concilia sozinho: devolve sugestão para uma pessoa confirmar.
 */
function conc_sugerir_(mov, despesas) {
  if (mov.valor >= 0) return { texto: "Entrada — verificar em Receitas", idDespesa: "", confianca: 30 };

  var alvo = Math.abs(mov.valor);
  var desc = conc_normalizar_(mov.descricao);
  var melhor = null;

  despesas.forEach(function (d) {
    var vd = conc_num_(d.valor);
    if (Math.abs(vd - alvo) > 0.01) return;

    var nome = conc_normalizar_(d.prestadorNome || d.descricao || "");
    var conf = 70;

    nome.split(/\s+/).filter(function (p) { return p.length > 3; })
        .forEach(function (p) { if (desc.indexOf(p) >= 0) conf += 8; });

    if (mov.data && d.dataVencimento) {
      var dm = new Date(mov.data), dv = new Date(d.dataVencimento);
      if (!isNaN(dm.getTime()) && !isNaN(dv.getTime())) {
        var dias = Math.abs((dm - dv) / 86400000);
        if (dias <= 5) conf += 10; else if (dias > 45) conf -= 15;
      }
    }

    conf = Math.max(0, Math.min(conf, 98));
    if (!melhor || conf > melhor.confianca) {
      melhor = {
        texto: "Despesa: " + (d.prestadorNome || d.descricao || d.idDespesa),
        idDespesa: String(d.idDespesa || ""),
        confianca: conf
      };
    }
  });

  if (melhor) return melhor;
  if (/tarifa|cesta|manutencao|manutenção|iof|juros/i.test(mov.descricao)) return { texto: "Tarifa bancária", idDespesa: "", confianca: 60 };
  if (/salario|salário|folha|inss|fgts|rescis/i.test(mov.descricao))       return { texto: "Folha de pagamento (RH)", idDespesa: "", confianca: 55 };
  return { texto: "Saída sem despesa correspondente", idDespesa: "", confianca: 20 };
}

/* ================= IMPORTAÇÃO ================= */

/**
 * Importa um extrato. Idempotente: reimportar o mesmo arquivo não duplica
 * lançamento — a chave é o FITID quando o arquivo é OFX, ou a combinação
 * data+valor+descrição quando é texto.
 */
function conc_importarExtrato(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, mensagem: "Sistema ocupado, tente novamente em instantes." };

  try {
    payload = payload || {};
    var texto = String(payload.conteudo || "").trim();
    if (!texto) return { ok: false, mensagem: "Nenhum conteúdo de extrato recebido." };

    var ehOFX = /<STMTTRN>/i.test(texto) || /<OFX>/i.test(texto);
    var movs = ehOFX ? conc_lerOFX_(texto) : conc_lerTexto_(texto);

    if (!movs.length) {
      return { ok: false, mensagem: ehOFX
        ? "O arquivo OFX foi lido, mas não continha nenhum lançamento."
        : "Não encontrei lançamentos com data e valor. Se o extrato for PDF escaneado, exporte em OFX pelo internet banking — é o formato que o sistema lê melhor." };
    }

    var sh = conc_aba_();
    var mapa = conc_mapa_(sh);
    var existentes = sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];

    var chaves = {};
    existentes.forEach(function (l) {
      var fit = String(l[mapa["FITID"]] || "").trim();
      if (fit) chaves["F:" + fit] = true;
      chaves["H:" + String(l[mapa["DATA_MOVIMENTO"]] || "") + "|" +
             conc_num_(l[mapa["VALOR"]]).toFixed(2) + "|" +
             conc_normalizar_(l[mapa["DESCRICAO"]])] = true;
    });

    var despResp = listarDespesas_interno_({ ocultarPagos: true, ocultarCancelados: true });
    var despesas = (despResp && despResp.lista) || [];

    var usuario = "";
    try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e) {}

    var novas = [], duplicados = 0;
    movs.forEach(function (m) {
      var kF = m.fitid ? "F:" + m.fitid : null;
      var kH = "H:" + m.data + "|" + m.valor.toFixed(2) + "|" + conc_normalizar_(m.descricao);
      if ((kF && chaves[kF]) || chaves[kH]) { duplicados++; return; }
      if (kF) chaves[kF] = true;
      chaves[kH] = true;

      var s = conc_sugerir_(m, despesas);
      novas.push([
        conc_id_(), new Date(), usuario, ehOFX ? "OFX" : "TEXTO",
        m.fitid, m.data, m.descricao, m.valor, m.valor >= 0 ? "ENTRADA" : "SAIDA",
        CONC_STATUS.PENDENTE, s.idDespesa, s.texto, s.confianca, "", "", ""
      ]);
    });

    if (novas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, novas.length, CONC_CABECALHO.length).setValues(novas);
    }

    return {
      ok: true,
      importados: novas.length,
      duplicados: duplicados,
      formato: ehOFX ? "OFX" : "TEXTO",
      mensagem: novas.length
        ? (novas.length + " lançamento(s) importado(s)" + (duplicados ? " · " + duplicados + " já existia(m) e foram ignorados." : "."))
        : "Nenhum lançamento novo — todos os " + duplicados + " já haviam sido importados."
    };
  } catch (e) {
    Logger.log("conc_importarExtrato: " + e);
    return { ok: false, mensagem: "Erro ao importar: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ================= LEITURA ================= */

function conc_listar(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var sh = conc_aba_();
  if (sh.getLastRow() < 2) return { ok: true, itens: [], resumo: conc_resumoVazio_() };

  var mapa = conc_mapa_(sh);
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var itens = dados.map(function (l, i) {
    return {
      linha: i + 2,
      id: String(l[mapa["ID"]] || ""),
      origem: String(l[mapa["ORIGEM"]] || ""),
      fitid: String(l[mapa["FITID"]] || ""),
      data: String(l[mapa["DATA_MOVIMENTO"]] || ""),
      descricao: String(l[mapa["DESCRICAO"]] || ""),
      valor: conc_num_(l[mapa["VALOR"]]),
      tipo: String(l[mapa["TIPO"]] || ""),
      status: String(l[mapa["STATUS"]] || CONC_STATUS.PENDENTE),
      idDespesa: String(l[mapa["ID_DESPESA"]] || ""),
      sugestao: String(l[mapa["SUGESTAO"]] || ""),
      confianca: Number(l[mapa["CONFIANCA"]] || 0),
      conciliadoPor: String(l[mapa["CONCILIADO_POR"]] || ""),
      dataConciliacao: l[mapa["DATA_CONCILIACAO"]] instanceof Date
        ? Utilities.formatDate(l[mapa["DATA_CONCILIACAO"]], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : String(l[mapa["DATA_CONCILIACAO"]] || ""),
      observacao: String(l[mapa["OBSERVACAO"]] || "")
    };
  }).reverse();

  var r = conc_resumoVazio_();
  itens.forEach(function (m) {
    r.total++;
    if (m.valor >= 0) r.entradas += m.valor; else r.saidas += Math.abs(m.valor);
    if (m.status === CONC_STATUS.CONCILIADO) r.conciliados++;
    else if (m.status === CONC_STATUS.IGNORADO) r.ignorados++;
    else { r.pendentes++; if (m.confianca >= 70) r.prontos++; }
  });

  return { ok: true, itens: itens, resumo: r };
}

function conc_resumoVazio_() {
  return { total: 0, entradas: 0, saidas: 0, conciliados: 0, pendentes: 0, ignorados: 0, prontos: 0 };
}

/* ================= AÇÕES ================= */

/**
 * Concilia um movimento com uma despesa. Quando o usuário pede para dar baixa,
 * a baixa NÃO é escrita aqui: delega para marcarDespesaComoPaga (Despesas.gs),
 * que é a dona da regra, já valida status, usa LockService e registra
 * auditoria. Se a baixa falhar, o movimento não é marcado como conciliado —
 * não pode ficar "conciliado" de um lado e "em aberto" do outro.
 */
function conc_conciliar(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);

  try {
    payload = payload || {};
    var id        = String(payload.id || "").trim();
    var idDespesa = String(payload.idDespesa || "").trim();
    var darBaixa  = !!payload.darBaixa;
    if (!id) return { ok: false, mensagem: "Movimento não informado." };

    // ── 1. Localiza e valida (leitura, sem lock) ──────────────────────────
    var sh = conc_aba_(), mapa = conc_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var linha = -1;
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["ID"]]) === id) { linha = i + 2; break; }
    }
    if (linha < 0) return { ok: false, mensagem: "Movimento não encontrado." };
    var mov = dados[linha - 2];
    if (String(mov[mapa["STATUS"]]) === CONC_STATUS.CONCILIADO) {
      return { ok: false, mensagem: "Este movimento já está conciliado." };
    }

    // ── 2. Baixa na despesa, ANTES de pegar o lock ────────────────────────
    // marcarDespesaComoPaga pega o próprio LockService. Se este função já
    // estivesse segurando o lock do script, o pedido de dentro poderia travar
    // a execução inteira. Por isso a baixa acontece fora do nosso lock, e só
    // depois entramos para gravar. Se a baixa falhar, nada é marcado — não
    // pode ficar "conciliado" de um lado e "em aberto" do outro.
    var avisoBaixa = "";
    if (darBaixa && idDespesa) {
      var res = marcarDespesaComoPaga({
        idDespesa: idDespesa,
        dataPagamento: String(mov[mapa["DATA_MOVIMENTO"]] || ""),
        observacao: "Baixa pela conciliação bancária — extrato de " +
                    String(mov[mapa["DATA_MOVIMENTO"]] || "") + ", " +
                    String(mov[mapa["DESCRICAO"]] || "")
      }, tokenSessao);
      if (!res || !res.ok) {
        return { ok: false, mensagem: "Não foi possível dar baixa na despesa: " +
                 ((res && res.mensagem) || "erro desconhecido") + ". O movimento continua pendente." };
      }
      avisoBaixa = " Despesa marcada como paga.";
    }

    // ── 3. Grava a conciliação (aqui sim, com lock) ───────────────────────
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return { ok: false, mensagem: avisoBaixa
        ? "A despesa foi marcada como paga, mas o sistema estava ocupado para registrar a conciliação. Tente conciliar o movimento novamente."
        : "Sistema ocupado, tente novamente em instantes." };
    }
    try {
      var usuario = "";
      try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e2) {}

      sh.getRange(linha, mapa["STATUS"] + 1).setValue(CONC_STATUS.CONCILIADO);
      if (idDespesa) sh.getRange(linha, mapa["ID_DESPESA"] + 1).setValue(idDespesa);
      sh.getRange(linha, mapa["CONCILIADO_POR"] + 1).setValue(usuario);
      sh.getRange(linha, mapa["DATA_CONCILIACAO"] + 1).setValue(new Date());
      if (payload.observacao) sh.getRange(linha, mapa["OBSERVACAO"] + 1).setValue(String(payload.observacao));
    } finally {
      lock.releaseLock();
    }

    return { ok: true, mensagem: "Movimento conciliado." + avisoBaixa };
  } catch (e) {
    Logger.log("conc_conciliar: " + e);
    return { ok: false, mensagem: "Erro ao conciliar: " + e.message };
  }
}

/** Marca como ignorado (tarifa, transferência interna, movimento que não é despesa). */
function conc_ignorar(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var id = String((payload || {}).id || "").trim();
    if (!id) return { ok: false, mensagem: "Movimento não informado." };
    var sh = conc_aba_(), mapa = conc_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["ID"]]) === id) {
        sh.getRange(i + 2, mapa["STATUS"] + 1).setValue(CONC_STATUS.IGNORADO);
        if ((payload || {}).observacao) sh.getRange(i + 2, mapa["OBSERVACAO"] + 1).setValue(String(payload.observacao));
        return { ok: true, mensagem: "Movimento marcado como ignorado." };
      }
    }
    return { ok: false, mensagem: "Movimento não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/**
 * Desfaz a conciliação do movimento. NÃO estorna a despesa de propósito:
 * desfazer um pagamento é decisão do módulo de Despesas (estornarDespesa),
 * com motivo obrigatório e auditoria própria. Aqui só se desfaz o vínculo.
 */
function conc_desfazer(payload, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var id = String((payload || {}).id || "").trim();
    if (!id) return { ok: false, mensagem: "Movimento não informado." };
    var sh = conc_aba_(), mapa = conc_mapa_(sh);
    var dados = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][mapa["ID"]]) === id) {
        var tinhaDespesa = String(dados[i][mapa["ID_DESPESA"]] || "").trim();
        sh.getRange(i + 2, mapa["STATUS"] + 1).setValue(CONC_STATUS.PENDENTE);
        sh.getRange(i + 2, mapa["CONCILIADO_POR"] + 1).setValue("");
        sh.getRange(i + 2, mapa["DATA_CONCILIACAO"] + 1).setValue("");
        return { ok: true, mensagem: tinhaDespesa
          ? "Conciliação desfeita. A despesa " + tinhaDespesa + " continua marcada como paga — para reverter o pagamento, use Estornar na tela de Despesas."
          : "Conciliação desfeita." };
      }
    }
    return { ok: false, mensagem: "Movimento não encontrado." };
  } catch (e) {
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/** Despesas em aberto, para o seletor de vínculo manual da tela. */
function conc_despesasEmAberto(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var r = listarDespesas_interno_({ ocultarPagos: true, ocultarCancelados: true });
  return ((r && r.lista) || []).map(function (d) {
    return {
      idDespesa: String(d.idDespesa || ""),
      nome: String(d.prestadorNome || d.descricao || ""),
      valor: conc_num_(d.valor),
      vencimento: String(d.dataVencimentoBR || d.dataVencimento || "")
    };
  });
}
