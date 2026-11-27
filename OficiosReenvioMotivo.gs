/* ================================================================
   REENVIO DE OFÍCIO COM MOTIVO — 04/11/2026 (desenho aprovado: "Aprovo")
   ================================================================
   O usuário: "Na opção reenvio do ofício, poderia ter a opção de escolher
   quais associados eu preciso reenviar?" e "Eu consigo colocar uma
   observação informando que o reenvio é porque algum funcionário não está
   sendo descontado? Ou todos não estão sendo descontados?"

   O que muda no reenvio (reenviarOficio, EmailOficios.gs):
     - motivo: "" (só reenviar — EXATAMENTE como era), ALGUNS, TODOS, OUTRO;
     - ALGUNS: a pessoa marca quem; vão só as fichas de quem foi marcado
       (ofício emitido em lote: as fichas estão num PDF só e ele vai inteiro,
       com aviso);
     - a observação (texto proposto pelo tipo, com a cláusula pelo MTE, e
       editável) entra no corpo do e-mail;
     - o PDF do ofício é o mesmo, com o mesmo número: nada é emitido de novo.
   Robô que aprende: o texto proposto × o enviado vai para a memória do robô
   (tarefa "reenvio-oficio-texto"); quem a Conferência mensal já sabe que não
   consta na lista da escola vem marcado, com a origem à vista.
   ================================================================ */

var OFR_MOTIVOS = ["ALGUNS", "TODOS", "OUTRO"];

/* "1. MARIA SOUZA\n2. JOÃO LIMA" → ["MARIA SOUZA", "JOÃO LIMA"] */
function ofrPessoasDoRegistro_(texto) {
  return String(texto || "").split(/\n|;/).map(function (s) { return s.replace(/^\s*\d+\.\s*/, "").trim(); }).filter(String);
}

/* O mesmo jeito que a emissão escreve o nome no arquivo da ficha (Oficios.gs). */
function ofrNomeNoArquivo_(nome) {
  return String(nome || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").slice(0, 40);
}

/* De quem é esta ficha? "" se não for ficha individual (ou não casar). */
function ofrDonoDaFicha_(nomeArquivo, pessoas) {
  var n = String(nomeArquivo || "").toUpperCase();
  if (!/^FICHA_/.test(n)) return "";
  var achou = "";
  (pessoas || []).forEach(function (p) {
    var k = ofrNomeNoArquivo_(p);
    if (k && n.indexOf("_" + k + "_") > -1 && (!achou || k.length > ofrNomeNoArquivo_(achou).length)) achou = p;
  });
  return achou;
}

/* A cláusula pelo registro no MTE (CLAUDE.md, 29/10/2026: "Sempre o MTE"). */
function ofrClausula_(tipo) {
  var t = String(tipo || "").toLowerCase();
  if (/oposi|negocial/.test(t)) return "Cláusula 40ª da CCT 2026/2027 (registro no MTE ES000256/2026)";
  if (/assistencial/.test(t)) return "Cláusula 38ª – Assistência Médica, da CCT 2026/2027 (registro no MTE ES000256/2026)";
  return "Cláusula 38ª da CCT 2026/2027 (registro no MTE ES000256/2026)";
}

/* Os textos propostos, pelo tipo. {PESSOAS} vira os nomes marcados. */
function ofrModelos_(tipo, numero) {
  var t = String(tipo || "").toLowerCase(), cl = ofrClausula_(tipo), n = String(numero || "");
  var base = "Reenviamos o Ofício nº " + n + " porque, até o momento, ";
  if (/oposi/.test(t)) return {
    ALGUNS: base + "o desconto da Taxa Negocial continua sendo feito para: {PESSOAS}, que apresentaram oposição. Solicitamos que o desconto seja cessado, nos termos da " + cl + ".",
    TODOS: base + "o desconto da Taxa Negocial continua sendo feito para os(as) trabalhadores(as) relacionados(as) no ofício, que apresentaram oposição. Solicitamos que o desconto seja cessado, nos termos da " + cl + ".",
    OUTRO: "" };
  if (/desfilia/.test(t)) return {
    ALGUNS: base + "o desconto da mensalidade sindical continua sendo feito para: {PESSOAS}, que solicitaram a desfiliação. Solicitamos que o desconto seja cessado, nos termos da " + cl + ".",
    TODOS: base + "o desconto da mensalidade sindical continua sendo feito para os(as) trabalhadores(as) relacionados(as) no ofício, que solicitaram a desfiliação. Solicitamos que o desconto seja cessado, nos termos da " + cl + ".",
    OUTRO: "" };
  if (/filia/.test(t)) return {
    ALGUNS: base + "não identificamos o desconto da mensalidade sindical de: {PESSOAS}. Solicitamos a regularização nos termos da " + cl + ".",
    TODOS: base + "não identificamos o desconto da mensalidade sindical de nenhum(a) dos(as) trabalhadores(as) relacionados(as) no ofício. Solicitamos a regularização nos termos da " + cl + ".",
    OUTRO: "" };
  var o = /assistencial/.test(t) ? "da Taxa Assistencial" : /negocial/.test(t) ? "da Taxa Negocial" : "";
  return {
    ALGUNS: base + "não identificamos o desconto" + (o ? " " + o : "") + " de: {PESSOAS}. Solicitamos a regularização nos termos da " + cl + ".",
    TODOS: base + "não identificamos o desconto" + (o ? " " + o : "") + " dos(as) trabalhadores(as) relacionados(as) no ofício. Solicitamos a regularização nos termos da " + cl + ".",
    OUTRO: "" };
}

/* "A, B e C" */
function ofrJuntarNomes_(nomes) {
  var l = (nomes || []).filter(String);
  return l.length <= 1 ? (l[0] || "") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1];
}

/* Quem a Conferência mensal já sabe que está com problema neste ofício. */
function ofrSugeridosConferencia_(numero, tokenSessao) {
  try {
    if (typeof oficiosConferenciaMensal !== "function") return [];
    var c = oficiosConferenciaMensal(tokenSessao);
    var p = ((c && c.problemas) || []).filter(function (x) { return String(x.numero) === String(numero); })[0];
    return p ? (p.problema || []).map(function (x) { return String(x.nome || ""); }).filter(String) : [];
  } catch (e) { return []; }
}

/** O que a prévia do reenvio ganha: as pessoas, as fichas de cada uma, os textos. */
function ofrPreviaMotivo_(numero, tipo, registro, itensAnexos, tokenSessao) {
  var pessoas = ofrPessoasDoRegistro_(registro && registro.colaboradores);
  var individuais = 0, lote = false;
  var comFicha = {};
  (itensAnexos || []).forEach(function (a) {
    var nome = String(a.nome || "");
    if (/^fichas_/i.test(nome)) lote = true;
    var dono = ofrDonoDaFicha_(nome, pessoas);
    if (dono) { comFicha[dono] = nome; individuais++; }
  });
  var sug = ofrSugeridosConferencia_(numero, tokenSessao);
  var sugN = sug.map(function (s) { return ofrNomeNoArquivo_(s); });
  return {
    pessoas: pessoas.map(function (p) {
      return { nome: p, ficha: comFicha[p] || "", sugerido: sugN.indexOf(ofrNomeNoArquivo_(p)) > -1 };
    }),
    fichasEmLote: lote && !individuais,
    sugeridosOrigem: sug.length ? "a Conferência mensal não achou na lista da escola" : "",
    modelos: ofrModelos_(tipo, numero)
  };
}

/**
 * No reenvio: valida o motivo e filtra as fichas (ALGUNS). Não muda nada
 * quando não há motivo — o reenvio continua EXATAMENTE como era.
 * Devolve { erro } ou { motivo, observacao, anexos, avisos, pessoas }.
 */
function ofrAplicarMotivo_(registro, anexos, pessoasDoOficio) {
  var motivo = String(registro.motivo || "").toUpperCase();
  if (OFR_MOTIVOS.indexOf(motivo) === -1) return { motivo: "", observacao: "", anexos: anexos, avisos: [], pessoas: [] };
  var observacao = String(registro.observacao || "").replace(/\r/g, "").trim().substring(0, 3000);
  if (!observacao) return { erro: "Escreva a observação do reenvio (ou escolha \"Só reenviar\")." };
  var avisos = [], sel = [];
  if (motivo === "ALGUNS") {
    sel = (Array.isArray(registro.pessoas) ? registro.pessoas : []).map(function (s) { return String(s || "").trim(); }).filter(String);
    if (!sel.length) return { erro: "Marque ao menos um associado." };
    var selN = sel.map(ofrNomeNoArquivo_);
    var temLote = false, tirou = 0;
    anexos = anexos.filter(function (b) {
      var nome = String(b.getName() || "");
      if (/^fichas_/i.test(nome)) { temLote = true; return true; }
      var dono = ofrDonoDaFicha_(nome, pessoasDoOficio.length ? pessoasDoOficio : sel);
      if (!dono) return true;                       // o ofício e o que não é ficha de alguém
      if (selN.indexOf(ofrNomeNoArquivo_(dono)) > -1) return true;
      tirou++;
      return false;
    });
    if (temLote) avisos.push("as fichas deste ofício estão num PDF só (emitido em lote) e foram todas");
    if (tirou) avisos.push(tirou + " ficha(s) de quem não foi marcado ficaram de fora");
  }
  return { motivo: motivo, observacao: observacao, anexos: anexos, avisos: avisos, pessoas: sel };
}

function ofrEscaparHtml_(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
