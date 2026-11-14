/* ================================================================
   ROBÔ DOS COMPROVANTES — LÊ SOZINHO, À NOITE (03/11/2026)
   ================================================================
   O usuário (03/11/2026), sobre "uma rotina automática que lesse todos os
   comprovantes": "sim". Decisões dele: SÓ a caixa da secretaria@; às 20h;
   no máximo 10 por vez (o que sobrar fica para a noite seguinte).

   O que ele faz: o mesmo que abrir o e-mail e o "Ler comprovante" da Caixa
   (caixaLerComprovante / cxfLerComprovanteCore_ em CaixaFerramentas.gs) —
   mês, valor, quantidade, quem faltou, e guarda a lista de nomes para a
   Conferência mensal dos ofícios (ConferenciaMensal.gs).

   O que ele NÃO faz: não responde, não move, não arquiva, não marca nada no
   e-mail, não manda nada. Só lê e anota. ("O e-mail não sai sozinho em
   momento algum.") A secretaria@ continua lida só na Caixa de entrada e na
   CERTIFICADO 2027-1 — o robô usa o que o leitor já trouxe para a ponte.

   Robô que aprende (CLAUDE.md, 30/10/2026):
     1. Registrar — "Está certo" / "Corrigir" na leitura vira exemplo
        (memória do robô, tarefa "comprovante-conferido").
     2. Usar — as correções voltam no pedido à IA (crcExemplosCorrecao_).
     3. Medir — o acerto aparece no rodapé da Caixa.
     4. Ligar só com o usuário — começa DESLIGADO; quem liga é um
        administrador, no rodapé da Caixa, e dá para desligar.

   A leitura fica guardada (aba Caixa_Comprovantes_Lidos): abrir o e-mail
   mostra o que o robô leu, sem gastar IA de novo.
   ================================================================ */

var CRC_ABA = "Caixa_Comprovantes_Lidos";
var CRC_COLUNAS = ["THREAD_ID", "ULTIMA_MENSAGEM_ID", "CAIXA", "ASSUNTO", "LIDO_EM", "LIDO_POR", "STATUS", "RESULTADO_JSON",
                   "DETALHE", "TENTATIVAS", "CONFERIDO", "CONFERIDO_POR", "CONFERIDO_EM", "CORRECAO_JSON"];
var CRC_QUEM = "ROBÔ";
var CRC_LIMITE = 10;               // usuário, 03/11/2026: "Limite 10"
var CRC_HORA = 20;                 // usuário, 03/11/2026: 20h
var CRC_FUSO = "America/Sao_Paulo";
var CRC_TEMPO_MAX = 4.5 * 60000;   // o Apps Script corta em 6 min
var CRC_TENTATIVAS_MAX = 3;
var CRC_PROP_LIGADO = "CRC_ROBO_LIGADO";
var CRC_PROP_ULTIMA = "CRC_ROBO_ULTIMA";
var CRC_GATILHO = "caixaRoboComprovantesRodar";

function crcAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CRC_ABA);
  if (!sh) { sh = ss.insertSheet(CRC_ABA); sh.getRange(1, 1, 1, CRC_COLUNAS.length).setValues([CRC_COLUNAS]); }
  return sh;
}
/* Leitor próprio: { THREAD_ID → linha (com __linha) } */
function crcMapa_() {
  var sh = crcAba_(), m = {};
  if (sh.getLastRow() < 2) return m;
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = v[0].map(String);
  v.slice(1).forEach(function (l, i) {
    var o = { __linha: i + 2 };
    cab.forEach(function (c, k) { if (c) o[c] = l[k]; });
    if (o.THREAD_ID) m[String(o.THREAD_ID)] = o;
  });
  return m;
}
function crcGravar_(reg) {
  var sh = crcAba_();
  var linha = CRC_COLUNAS.map(function (c) { return reg[c] === undefined ? "" : reg[c]; });
  if (reg.__linha) sh.getRange(reg.__linha, 1, 1, CRC_COLUNAS.length).setValues([linha]);
  else sh.appendRow(linha);
}
function crcQuando_(d) {
  var x = d instanceof Date ? d : new Date(d);
  return isNaN(x) ? "" : Utilities.formatDate(x, CRC_FUSO, "dd/MM HH:mm");
}
function crcLeituraPublica_(reg) {
  return {
    status: String(reg.STATUS || ""), em: crcQuando_(reg.LIDO_EM),
    porRobo: String(reg.LIDO_POR) === CRC_QUEM, por: String(reg.LIDO_POR || ""),
    conferido: String(reg.CONFERIDO || ""), conferidoPor: String(reg.CONFERIDO_POR || ""), conferidoEm: crcQuando_(reg.CONFERIDO_EM)
  };
}

/** Guarda a leitura (chamado pelo miolo da leitura, do robô ou da tela). */
function crcGuardar_(id, conv, quem, status, comp, detalhe) {
  try {
    var mapa = crcMapa_(), antes = mapa[String(id)] || {};
    var mesma = String(antes.ULTIMA_MENSAGEM_ID || "") === String(conv.p.ULTIMA_MENSAGEM_ID || "");
    var reg = {
      __linha: antes.__linha, THREAD_ID: String(id), ULTIMA_MENSAGEM_ID: String(conv.p.ULTIMA_MENSAGEM_ID || ""),
      CAIXA: String(conv.p.CAIXA || "SECRETARIA"), ASSUNTO: String(conv.primeiro.assunto || "").substring(0, 200),
      LIDO_EM: new Date(), LIDO_POR: String(quem || ""), STATUS: status,
      RESULTADO_JSON: comp ? JSON.stringify(comp) : "", DETALHE: String(detalhe || "").substring(0, 300),
      TENTATIVAS: status === "FALHOU" ? (mesma ? Number(antes.TENTATIVAS || 0) : 0) + 1 : 0,
      /* Ler de novo apaga a conferência anterior: é outra leitura. */
      CONFERIDO: "", CONFERIDO_POR: "", CONFERIDO_EM: "", CORRECAO_JSON: ""
    };
    crcGravar_(reg);
    return crcLeituraPublica_(reg);
  } catch (e) { Logger.log("Robô dos comprovantes: não guardou — " + e.message); return null; }
}

/** A leitura já feita deste e-mail (null se não há, se chegou mensagem nova, ou se falhou). */
function crcLeituraGuardada_(id, ultimaMensagemId) {
  var reg = crcMapa_()[String(id)];
  if (!reg || String(reg.STATUS) === "FALHOU") return null;
  if (String(reg.ULTIMA_MENSAGEM_ID || "") !== String(ultimaMensagemId || "")) return null;
  var comp = reg.RESULTADO_JSON ? vpeJson_(reg.RESULTADO_JSON, null) : null;
  var cor = reg.CORRECAO_JSON ? vpeJson_(reg.CORRECAO_JSON, null) : null;
  if (comp && cor) { if (cor.referencia) comp.referencia = cor.referencia; if (cor.tipo) comp.tipo = cor.tipo; }
  return { comprovante: String(reg.STATUS) === "LIDO" ? comp : null, leitura: crcLeituraPublica_(reg) };
}

/* "Usar o que aprendeu": as correções da equipe voltam no pedido à IA. */
function crcExemplosCorrecao_() {
  try {
    var mapa = crcMapa_(), ex = [];
    Object.keys(mapa).forEach(function (k) {
      var r = mapa[k];
      if (String(r.CONFERIDO) !== "CORRIGIDO") return;
      var comp = vpeJson_(r.RESULTADO_JSON, {}), cor = vpeJson_(r.CORRECAO_JSON, {});
      ex.push({ em: new Date(r.CONFERIDO_EM).getTime() || 0,
        txt: "— \"" + String(r.ASSUNTO).substring(0, 80) + "\": a leitura deu " + (comp.referencia || "?") + " " + (comp.tipo || "") +
             "; a equipe corrigiu para " + (cor.referencia || comp.referencia || "?") + " " + (cor.tipo || comp.tipo || "") + "." });
    });
    if (!ex.length) return "";
    ex.sort(function (a, b) { return b.em - a.em; });
    return "Correções que a equipe já fez em leituras anteriores (atenção a estes enganos — o mês de referência é o da folha " +
      "descontada, não o da data do e-mail):\n" + ex.slice(0, 4).map(function (e) { return e.txt; }).join("\n") + "\n\n";
  } catch (e) { return ""; }
}

/* Quem o robô lê: e-mails da secretaria@ no card Contribuições (FINANCEIRO),
   com PDF ou imagem guardado, que ainda não foram lidos (ou que chegaram com
   mensagem nova). Os mais recentes primeiro. */
function crcCandidatos_() {
  var est = cxsEstados_(), lidos = crcMapa_();
  return cxsLinhasPonte_().filter(function (p) {
    if (String(p.CAIXA || "SECRETARIA") !== "SECRETARIA") return false;
    var e = est[String(p.THREAD_ID)];
    if (cxsTipoDoEmail_(p, e) !== "FINANCEIRO") return false;
    var temArquivo = vpeJson_(p.ANEXOS_JSON, []).some(function (a) { return a.fileId && /pdf|image/i.test(String(a.tipo || "")); });
    if (!temArquivo) return false;
    var l = lidos[String(p.THREAD_ID)];
    if (!l || String(l.ULTIMA_MENSAGEM_ID) !== String(p.ULTIMA_MENSAGEM_ID)) return true;
    return String(l.STATUS) === "FALHOU" && Number(l.TENTATIVAS || 0) < CRC_TENTATIVAS_MAX;
  }).map(function (p) {
    var msgs = vpeJson_(p.MENSAGENS_JSON, []), ult = msgs[msgs.length - 1] || {};
    return { p: p, ts: ult.data ? new Date(ult.data).getTime() : 0 };
  }).sort(function (a, b) { return b.ts - a.ts; });
}

/** O agendamento (20h). É função pública (todo gatilho precisa ser), então
    só roda quando quem chama é o PRÓPRIO gatilho do projeto: o Apps Script
    passa o evento com o id dele (triggerUid), e o id tem que ser de um
    gatilho deste robô. Chamada pela tela (google.script.run, com ou sem
    login) não faz nada e não devolve nada — ver tests/e2e/t6-exposicao.js. */
function caixaRoboComprovantesRodar(e) {
  try {
    var uid = e && typeof e === "object" ? String(e.triggerUid || "") : "";
    var meu = uid && ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === CRC_GATILHO && String(t.getUniqueId()) === uid;
    });
    if (!meu) return;
    crcRodar_();
  } catch (err) { Logger.log("Robô dos comprovantes: " + err.message); }
}

function crcRodar_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(CRC_PROP_LIGADO) !== "SIM") return { ok: true, desligado: true, mensagem: "O robô dos comprovantes está desligado." };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, mensagem: "O robô dos comprovantes já está rodando." };
  try {
    if (typeof cxcCarregar_ === "function") cxcCarregar_();
    var inicio = Date.now();
    var cand = crcCandidatos_();
    var res = { em: new Date().toISOString(), lidos: 0, naoEram: 0, falhas: 0, restam: 0, vistos: 0 };
    for (var i = 0; i < cand.length && res.vistos < CRC_LIMITE; i++) {
      if (Date.now() - inicio > CRC_TEMPO_MAX) break;
      var p = cand[i].p, id = String(p.THREAD_ID);
      res.vistos++;
      var conv = cxfConversaDe_(p);
      try {
        var r = cxfLerComprovanteCore_(id, conv, CRC_QUEM);
        var st = r.leitura ? r.leitura.status : (r.comprovante ? "LIDO" : "NAO_E_COMPROVANTE");
        if (st === "LIDO") res.lidos++; else if (st === "FALHOU") res.falhas++; else res.naoEram++;
      } catch (e) {
        res.falhas++;
        crcGuardar_(id, conv, CRC_QUEM, "FALHOU", null, e.message);
      }
    }
    res.restam = cand.length - res.vistos;
    props.setProperty(CRC_PROP_ULTIMA, JSON.stringify(res));
    cxsAuditar_("ROBO_COMPROVANTES", "", "leu " + res.lidos + ", não eram " + res.naoEram + ", falharam " + res.falhas +
      ", ficaram " + res.restam, { email: CRC_QUEM, usuario: CRC_QUEM });
    return { ok: true, resultado: res };
  } finally {
    lock.releaseLock();
  }
}

function crcPodeLigar_(sessao) {
  return String((sessao && sessao.perfil) || "").toUpperCase().indexOf("ADMIN") > -1;
}
function crcAgendado_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === CRC_GATILHO; });
}

/** O rodapé da Caixa: ligado?, a última noite, o acerto. */
function caixaRoboComprovantesEstado(tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var papel = cxsMeuPapel_(sessao);
    var props = PropertiesService.getScriptProperties();
    var mapa = crcMapa_(), n = 0, ok = 0, falhas = [];
    Object.keys(mapa).forEach(function (k) {
      var r = mapa[k];
      if (String(r.LIDO_POR) !== CRC_QUEM) return;
      if (r.CONFERIDO) { n++; if (String(r.CONFERIDO) === "CERTO") ok++; }
      if (String(r.STATUS) === "FALHOU" && (!papel || papel === "SECRETARIA")) falhas.push({ id: k, assunto: String(r.ASSUNTO || "(sem assunto)") });
    });
    var ultima = vpeJson_(props.getProperty(CRC_PROP_ULTIMA), null);
    return { ok: true, ligado: props.getProperty(CRC_PROP_LIGADO) === "SIM", agendado: crcAgendado_(),
             podeLigar: crcPodeLigar_(sessao), hora: CRC_HORA, limite: CRC_LIMITE,
             ultima: ultima ? { em: crcQuando_(ultima.em), lidos: ultima.lidos, naoEram: ultima.naoEram, falhas: ultima.falhas, restam: ultima.restam } : null,
             acerto: { n: n, ok: ok }, falhas: falhas.slice(0, 10) };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Ligar/desligar — só administrador. Liga = agenda às 20h; desliga = tira o agendamento. */
function caixaRoboComprovantesLigar(ligar, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    if (!crcPodeLigar_(sessao)) throw new Error("Só um administrador liga ou desliga o robô dos comprovantes.");
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === CRC_GATILHO) ScriptApp.deleteTrigger(t); });
    var props = PropertiesService.getScriptProperties();
    if (ligar) {
      ScriptApp.newTrigger(CRC_GATILHO).timeBased().everyDays(1).atHour(CRC_HORA).inTimezone(CRC_FUSO).create();
      props.setProperty(CRC_PROP_LIGADO, "SIM");
    } else {
      props.deleteProperty(CRC_PROP_LIGADO);
    }
    cxsAuditar_(ligar ? "ROBO_COMPROVANTES_LIGADO" : "ROBO_COMPROVANTES_DESLIGADO", "", ligar ? "todo dia às " + CRC_HORA + "h, até " + CRC_LIMITE : "", sessao);
    var e = caixaRoboComprovantesEstado(tokenSessao);
    e.mensagem = ligar ? "Robô dos comprovantes ligado: lê a secretaria@ todo dia às " + CRC_HORA + "h, até " + CRC_LIMITE + " por vez. Nada sai sozinho."
                       : "Robô dos comprovantes desligado.";
    return e;
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** "Está certo" ou "Corrigir" a leitura — é com isso que o robô aprende e se mede. */
function caixaComprovanteConferir(id, decisao, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    cxsExigirCaixaDe_(sessao, id);
    decisao = decisao || {};
    var reg = crcMapa_()[String(id)];
    if (!reg || String(reg.STATUS) !== "LIDO") throw new Error("Este comprovante ainda não foi lido.");
    var comp = vpeJson_(reg.RESULTADO_JSON, {});
    var refNova = String(decisao.referencia || "").trim(), tipoNovo = String(decisao.tipo || "").trim().toUpperCase();
    var certo = decisao.certo === true;
    if (!certo) {
      var m = refNova.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
      if (refNova && (!m || Number(m[1]) < 1 || Number(m[1]) > 12)) throw new Error("Referência no formato MM/AAAA (ex.: 09/2026).");
      if (m) refNova = ("0" + Number(m[1])).slice(-2) + "/" + m[2];
      if (tipoNovo && ["MENSALIDADE", "TAXA_NEGOCIAL"].indexOf(tipoNovo) === -1) throw new Error("Tipo: mensalidade ou taxa negocial.");
      if (!refNova) refNova = comp.referencia || "";
      if (!tipoNovo) tipoNovo = comp.tipo || "";
      if (refNova === comp.referencia && tipoNovo === comp.tipo) certo = true;   // "corrigiu" para o mesmo: está certo
    }
    var quem = sessao.email || sessao.usuario || "";
    reg.CONFERIDO = certo ? "CERTO" : "CORRIGIDO";
    reg.CONFERIDO_POR = quem; reg.CONFERIDO_EM = new Date();
    reg.CORRECAO_JSON = certo ? "" : JSON.stringify({ referencia: refNova, tipo: tipoNovo });
    crcGravar_(reg);
    if (!certo && comp.listaNomes && typeof cfmCorrigirLista_ === "function") cfmCorrigirLista_(id, comp.referencia, refNova, tipoNovo);
    var sug = (comp.referencia || "") + "|" + (comp.tipo || "");
    roboMemoriaRegistrar_({ tarefa: "comprovante-conferido", origem: String(reg.CAIXA || ""), chave: String(id),
      assunto: reg.ASSUNTO, sugerido: sug, decidido: certo ? sug : refNova + "|" + tipoNovo, quem: quem });
    cxsAuditar_(certo ? "COMPROVANTE_CONFERIDO" : "COMPROVANTE_CORRIGIDO", id, certo ? sug : sug + " → " + refNova + "|" + tipoNovo, sessao);
    return { ok: true, mensagem: certo ? "Leitura conferida. Obrigado — o robô aprende com isso." : "Leitura corrigida: " + refNova + ". O robô aprende com isso.",
             leitura: crcLeituraPublica_(reg), comprovante: crcLeituraGuardada_(id, reg.ULTIMA_MENSAGEM_ID).comprovante };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
