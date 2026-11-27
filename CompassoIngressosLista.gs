/**
 * INGRESSOS · LISTA COLADA DO WHATSAPP (27/11/2026). Código NOVO: não altera nenhuma função existente.
 * Pedido do usuário: o Presidente manda no Zap listas com só NOME e TELEFONE; o SISGEP separa, o operador confere e gera.
 * O texto é interpretado por regras (sem IA): previsível, testável e sem custo. O que não for entendido NÃO é descartado:
 * vira linha "sem telefone" ou entra em `ignoradas` para a pessoa ver. Nada é emitido aqui — só organiza a lista; a
 * conferência (compassoIngressos_conferir) e a emissão continuam sendo as de sempre, com clique e confirmação.
 */
var CINGL_FONE_RE = /(?:\+?\s*55[\s.-]*)?\(?\s*\d{2}\s*\)?[\s.-]*9?\d{4}[\s.-]*\d{4}/g;

function cingListaFormatarFone_(digitos) {
  var d = String(digitos || "").replace(/\D/g, "");
  if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
  if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "";
}

function cingListaLimparNome_(s) {
  s = String(s || "")
    .replace(/\((?:sem|s\/)\s*(?:telefone|tel|zap|whats\w*)[^)]*\)/ig, " ")
    .replace(/^\s*(?:\d{1,3}\s*[.)\-–]|[-•*·➡→▪●])\s*/, "")
    .replace(/\b(?:tel(?:efone)?|cel(?:ular)?|zap|whats(?:app)?|contato|fone)\b\s*[:.\-]?/ig, " ")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, "");
  return s;
}

function cingListaNomeValido_(s) {
  var letras = String(s || "").replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letras.length >= 2 && !/^\d+$/.test(s);
}

/** Separa um trecho de nomes ("Ana, João e Maria") em nomes. Vírgula, ponto e vírgula e " e " separam. */
function cingListaSepararNomes_(trecho) {
  return String(trecho || "").split(/\s*[,;]\s*|\s+e\s+/i).map(cingListaLimparNome_).filter(cingListaNomeValido_);
}

/**
 * Entende o texto. Regras:
 *  - telefone na linha vale para os nomes da linha;
 *  - "Rótulo: nome, nome, nome  telefone" → o rótulo (quem pediu) não vira ingresso, vai como `grupo`;
 *  - linha só com telefone vale para os nomes SEM telefone que vieram logo antes dela;
 *  - nome sem telefone continua na lista, marcado.
 */
function cingListaParse_(texto) {
  var itens = [], ignoradas = [], pendentes = [];
  String(texto == null ? "" : texto).split(/\r?\n/).forEach(function (linha) {
    var bruta = String(linha || "").trim();
    if (!bruta) { return; }
    var fones = (bruta.match(CINGL_FONE_RE) || []).map(function (m) { return cingListaFormatarFone_(m); }).filter(String);
    var semFone = bruta.replace(CINGL_FONE_RE, " ");
    var grupo = "";
    var dois = semFone.match(/^([^:]{1,40}):\s*(.+)$/);
    if (dois) { grupo = cingListaLimparNome_(dois[1]); semFone = dois[2]; }
    var nomes = cingListaSepararNomes_(semFone);
    if (!nomes.length) {
      if (fones.length && pendentes.length) { pendentes.forEach(function (it) { it.telefone = fones[0]; }); pendentes = []; }
      else if (bruta.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length >= 2) ignoradas.push(bruta.substring(0, 120));
      return;
    }
    var novos = nomes.map(function (n) { return { nome: n, telefone: fones[0] || "", grupo: grupo }; });
    if (!fones.length) pendentes = pendentes.concat(novos); else pendentes = [];
    itens = itens.concat(novos);
  });
  return { itens: itens, ignoradas: ignoradas };
}

/** Chamada pela tela: devolve as pessoas já com a categoria escolhida para a lista inteira. */
function compassoIngressos_organizarTexto(texto, categoria, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    texto = String(texto == null ? "" : texto).substring(0, 20000);
    if (!texto.trim()) return { ok: false, mensagem: "Cole o texto da lista primeiro." };
    var cat = cingCategoria_(categoria) || "convite";
    var r = cingListaParse_(texto);
    if (!r.itens.length) return { ok: false, mensagem: "Não achei nenhum nome no texto.", ignoradas: r.ignoradas };
    if (r.itens.length > 300) return { ok: false, mensagem: "São " + r.itens.length + " nomes: envie em listas de até 300." };
    var itens = r.itens.map(function (it) { return { nome: it.nome, telefone: it.telefone, categoria: cat, grupo: it.grupo }; });
    var semTel = itens.filter(function (it) { return !it.telefone; }).length;
    return { ok: true, itens: itens, total: itens.length, semTelefone: semTel, ignoradas: r.ignoradas,
      mensagem: itens.length + " nome(s) lidos" + (semTel ? ", " + semTel + " sem telefone" : "") + (r.ignoradas.length ? ", " + r.ignoradas.length + " linha(s) não entendida(s)" : "") + "." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
