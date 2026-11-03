/* ================================================================
   CONFERÊNCIA MENSAL — OFÍCIO ENVIADO × LISTA DA ESCOLA (03/11/2026)
   ================================================================
   Etapa 2 do robô das fichas (desenho aprovado,
   docs/mock-robo-fichas-oficio.png). O usuário: "quando eu enviar um ofício
   para a escola, no próximo mês, ele deve conferir se aquela pessoa está na
   lista de contribuição. Se não estiver, ou ele pode me propor um e-mail ou
   ele pode me mostrar".

   De onde vem cada lado:
     - QUEM RECEBEU OFÍCIO: a planilha de registro dos ofícios
       (PLANILHA_REGISTRO: tipo, nº, data, escola, CNPJ, "Colaborador(es)");
       o CPF da filiação vem do Controle de Mensalidade.
     - A LISTA DA ESCOLA: o comprovante/relação que chega à financeiro@ e que
       a Caixa lê com a IA (caixaLerComprovante guarda aqui, na aba
       Contribuicao_Listas, quando a lista traz os nomes).
   Regra: filiação → a pessoa TEM que aparecer; desfiliação e oposição → NÃO
   pode mais aparecer (mensalidade para filiação/desfiliação; taxa negocial
   para a oposição). Só confere a lista de um mês DEPOIS do mês do ofício.
   Nada sai sozinho: "Propor e-mail" monta o texto (CCT citada pelo MTE) e
   abre o Novo e-mail; quem envia é a pessoa.
   ================================================================ */

var CFM_LISTAS_ABA = "Contribuicao_Listas";
var CFM_LISTAS_COL = ["CNPJ", "ESCOLA", "TIPO", "REFERENCIA", "PESSOAS_JSON", "ORIGEM", "REGISTRADO_EM", "QUEM"];
var CFM_TRATADOS_ABA = "Conferencia_Mensal_Tratados";
var CFM_TRATADOS_COL = ["CHAVE", "EM", "QUEM", "COMO"];
var CFM_TIPOS = {
  "Filiação": { lista: "MENSALIDADE", deveConstar: true },
  "Desfiliação": { lista: "MENSALIDADE", deveConstar: false },
  "Oposição à Taxa Negocial": { lista: "TAXA_NEGOCIAL", deveConstar: false }
};

function cfmAba_(nome, colunas) {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(nome);
  if (!sh) { sh = ss.insertSheet(nome); sh.getRange(1, 1, 1, colunas.length).setValues([colunas]); }
  return sh;
}
function cfmLinhas_(sh) {
  if (sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = v[0].map(function (c) { return String(c || "").trim(); });
  return v.slice(1).map(function (l) { var o = {}; cab.forEach(function (c, i) { if (c) o[c] = l[i]; }); return o; });
}
function cfmDig_(s) { return String(s || "").replace(/\D/g, ""); }
function cfmNome_(s) { return String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim(); }
/* "10/2026" → 202610 */
function cfmMes_(ref) {
  var m = String(ref || "").match(/(\d{1,2})\D+(\d{4})/);
  return m ? Number(m[2]) * 100 + Number(m[1]) : 0;
}
function cfmMesDe_(data) { var d = new Date(data); return isNaN(d) ? 0 : d.getFullYear() * 100 + (d.getMonth() + 1); }

/** A Caixa guarda a lista que a escola mandou (chamado por caixaLerComprovante). */
function cfmGuardarLista_(cnpj, escola, tipo, referencia, pessoas, origem, quem) {
  try {
    cnpj = cfmDig_(cnpj);
    if (!cnpj || !cfmMes_(referencia) || !(pessoas || []).length) return false;
    tipo = /TAXA/.test(String(tipo || "").toUpperCase()) ? "TAXA_NEGOCIAL" : "MENSALIDADE";
    var sh = cfmAba_(CFM_LISTAS_ABA, CFM_LISTAS_COL);
    /* Abrir o mesmo e-mail de novo não duplica a lista. */
    if (origem && cfmLinhas_(sh).some(function (l) { return String(l.ORIGEM) === String(origem) && String(l.REFERENCIA) === String(referencia) && cfmDig_(l.CNPJ) === cnpj; })) return true;
    var reg = { CNPJ: cnpj, ESCOLA: String(escola || ""), TIPO: tipo, REFERENCIA: String(referencia),
                PESSOAS_JSON: JSON.stringify(pessoas.map(function (p) { return { nome: String(p.nome || ""), cpf: cfmDig_(p.cpf) }; })),
                ORIGEM: String(origem || ""), REGISTRADO_EM: new Date(), QUEM: String(quem || "") };
    sh.appendRow(CFM_LISTAS_COL.map(function (c) { return reg[c]; }));
    return true;
  } catch (e) { Logger.log("Conferência mensal: não guardou a lista — " + e.message); return false; }
}

/* Os ofícios de filiação, desfiliação e oposição, com as pessoas. */
function cfmOficios_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(PLANILHA_REGISTRO);
  if (!sh) return [];
  var cpfPorNome = {};
  /* CPF da filiação: Controle de Mensalidade (NOME, CPF, ESCOLA, Nº). */
  try {
    var am = getAbaMensalidade_();
    if (am.getLastRow() > 1) am.getRange(2, 1, am.getLastRow() - 1, 5).getValues().forEach(function (l) {
      cpfPorNome[cfmNome_(l[0]) + "|" + String(l[4] || "").trim()] = cfmDig_(l[1]);
    });
  } catch (e2) {}
  return cfmLinhas_(sh).map(function (r) {
    var tipo = String(r["TIPO"] || "").trim();
    var tn = /oposi/i.test(tipo) ? "Oposição à Taxa Negocial" : /desfili/i.test(tipo) ? "Desfiliação" : /filia/i.test(tipo) ? "Filiação" : "";
    if (!tn) return null;
    var numero = String(r["Número do Ofício"] || "").trim();
    var pessoas = String(r["Colaborador(es)"] || "").split(/\n|;/).map(function (s) { return s.replace(/^\s*\d+\.\s*/, "").trim(); })
      .filter(String).map(function (nome) { return { nome: nome, cpf: cpfPorNome[cfmNome_(nome) + "|" + numero] || "" }; });
    return { numero: numero, tipo: tn, data: r["Data envio ofício"], escola: String(r["Escola (Razão Social)"] || ""),
             cnpj: cfmDig_(r["CNPJ"]), email: String(r["E-mail (principal)"] || ""), status: String(r["Status"] || ""), pessoas: pessoas };
  }).filter(function (o) { return o && o.numero && o.cnpj && o.pessoas.length && !/CANCEL/i.test(o.status); });
}

/** A conferência: ofício enviado × a lista mais recente da escola (de um mês depois). */
function oficiosConferenciaMensal(tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var listas = cfmLinhas_(cfmAba_(CFM_LISTAS_ABA, CFM_LISTAS_COL));
    var tratados = {};
    cfmLinhas_(cfmAba_(CFM_TRATADOS_ABA, CFM_TRATADOS_COL)).forEach(function (t) { tratados[String(t.CHAVE)] = t; });
    var problemas = [], semLista = [], conferidos = 0;
    cfmOficios_().forEach(function (o) {
      var regra = CFM_TIPOS[o.tipo];
      var mesOf = cfmMesDe_(o.data);
      var daEscola = listas.filter(function (l) { return cfmDig_(l.CNPJ) === o.cnpj && String(l.TIPO) === regra.lista && cfmMes_(l.REFERENCIA) > mesOf; })
        .sort(function (a, b) { return cfmMes_(b.REFERENCIA) - cfmMes_(a.REFERENCIA); });
      if (!daEscola.length) {
        var dias = (Date.now() - new Date(o.data).getTime()) / 864e5;
        if (dias >= 35) semLista.push({ numero: o.numero, tipo: o.tipo, escola: o.escola, data: cfmData_(o.data) });
        return;
      }
      var lista = daEscola[0], ps = vpeJson_(lista.PESSOAS_JSON, []);
      var cpfs = ps.map(function (p) { return cfmDig_(p.cpf); }).filter(String), nomes = ps.map(function (p) { return cfmNome_(p.nome); });
      var ok = [], ruins = [];
      o.pessoas.forEach(function (p) {
        var consta = (p.cpf && cpfs.indexOf(p.cpf) > -1) || nomes.indexOf(cfmNome_(p.nome)) > -1;
        ((consta === regra.deveConstar) ? ok : ruins).push(p);
      });
      conferidos++;
      var chave = o.numero + "|" + lista.REFERENCIA;
      if (ruins.length && !tratados[chave]) {
        problemas.push({ chave: chave, numero: o.numero, tipo: o.tipo, escola: o.escola, cnpj: o.cnpj, email: o.email, data: cfmData_(o.data),
          referencia: String(lista.REFERENCIA), deveConstar: regra.deveConstar, problema: ruins, ok: ok,
          situacao: regra.deveConstar ? "não consta" : "ainda descontado" });
      }
    });
    return { ok: true, problemas: problemas, semLista: semLista, conferidos: conferidos, listas: listas.length };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
function cfmData_(d) { var x = new Date(d); return isNaN(x) ? String(d || "") : Utilities.formatDate(x, "America/Sao_Paulo", "dd/MM/yyyy"); }

/** O e-mail de cobrança para a escola (texto pronto, CCT pelo MTE). Não envia. */
function oficiosConferenciaEmail(chave, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var r = oficiosConferenciaMensal(tokenSessao);
    var p = (r.problemas || []).filter(function (x) { return x.chave === String(chave); })[0];
    if (!p) return { ok: false, mensagem: "Esta pendência não está mais na conferência." };
    var lista = p.problema.map(function (x) { return "• " + x.nome.toUpperCase() + (x.cpf ? " (CPF " + x.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") + ")" : ""); }).join("\n");
    var ref = p.referencia;
    var corpo, assunto;
    if (p.tipo === "Filiação") {
      assunto = "Desconto da mensalidade sindical — Ofício nº " + p.numero;
      corpo = "Prezados,\n\nConforme o Ofício de Filiação nº " + p.numero + ", enviado em " + p.data + ", solicitamos o desconto em folha da mensalidade sindical " +
        "(CCT 2026/2027, cláusula 38ª — registro MTE ES000256/2026) do(s) trabalhador(es) abaixo, que não constam na relação de " + ref + " recebida:\n\n" + lista +
        "\n\nPedimos a inclusão a partir da próxima folha e o envio da relação atualizada.";
    } else if (p.tipo === "Desfiliação") {
      assunto = "Cessar desconto da mensalidade sindical — Ofício nº " + p.numero;
      corpo = "Prezados,\n\nConforme o Ofício de Desfiliação nº " + p.numero + ", enviado em " + p.data + ", solicitamos que cesse o desconto da mensalidade sindical " +
        "(CCT 2026/2027, cláusula 38ª — registro MTE ES000256/2026) do(s) trabalhador(es) abaixo, que ainda constam na relação de " + ref + ":\n\n" + lista +
        "\n\nPedimos a regularização a partir da próxima folha.";
    } else {
      assunto = "Oposição à taxa negocial — Ofício nº " + p.numero;
      corpo = "Prezados,\n\nConforme o Ofício nº " + p.numero + ", enviado em " + p.data + ", o(s) trabalhador(es) abaixo apresentaram oposição à taxa negocial " +
        "(CCT 2026/2027, cláusula 40ª — registro MTE ES000256/2026) e ainda constam na relação de " + ref + ":\n\n" + lista +
        "\n\nSolicitamos que não seja feito o desconto e, se já foi, a devolução ao trabalhador.";
    }
    var email = p.email;
    if (!email) { try { var e = (listarEscolasCadastro_interno_() || []).filter(function (x) { return cfmDig_(x.cnpj) === p.cnpj; })[0]; email = e ? String(e.email || "") : ""; } catch (e1) {} }
    return { ok: true, email: { para: email, assunto: assunto, texto: corpo, escola: p.escola } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Já tratei (mandou e-mail, ligou, resolveu): sai da conferência deste mês. */
function oficiosConferenciaTratado(chave, como, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    cfmAba_(CFM_TRATADOS_ABA, CFM_TRATADOS_COL).appendRow([String(chave), new Date(), sessao.email || sessao.usuario || "", String(como || "").substring(0, 200)]);
    roboMemoriaRegistrar_({ tarefa: "conferencia-mensal", origem: "OFICIOS", chave: String(chave), sugerido: "cobrar", decidido: String(como || "tratado"),
      quem: sessao.email || "" });
    return { ok: true, mensagem: "Marcado como tratado." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* A equipe corrigiu a leitura do comprovante (mês ou tipo errado — robô dos
   comprovantes, 03/11/2026): a lista guardada daquele e-mail passa a valer
   com o mês/tipo certos, para a conferência não usar o mês errado. */
function cfmCorrigirLista_(origem, refAntiga, refNova, tipoNovo) {
  try {
    var sh = cfmAba_(CFM_LISTAS_ABA, CFM_LISTAS_COL);
    if (sh.getLastRow() < 2) return 0;
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var c = v[0].map(String), iO = c.indexOf("ORIGEM"), iR = c.indexOf("REFERENCIA"), iT = c.indexOf("TIPO"), n = 0;
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][iO]) !== String(origem) || String(v[i][iR]) !== String(refAntiga)) continue;
      if (refNova && cfmMes_(refNova)) sh.getRange(i + 1, iR + 1).setValue(String(refNova));
      if (tipoNovo) sh.getRange(i + 1, iT + 1).setValue(/TAXA/.test(String(tipoNovo)) ? "TAXA_NEGOCIAL" : "MENSALIDADE");
      n++;
    }
    return n;
  } catch (e) { Logger.log("Conferência mensal: não corrigiu a lista — " + e.message); return 0; }
}
