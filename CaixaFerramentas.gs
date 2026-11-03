/* ================================================================
   CAIXA DE E-MAILS — AS FERRAMENTAS QUE ERAM SÓ DA CENTRAL ANTIGA
   (03/11/2026)
   ================================================================
   O usuário aprovou o mockup docs/mock-caixa-ferramentas-financeiro.png
   ("Aprovo"), com o anexo pedido junto ("Se eu quiser anexar?"):
     1. 🏫 a escola no SISGEP (cadastro, associados da escola e a situação
        das mensalidades, últimos ofícios) — achada pelo e-mail do
        remetente, pelo CNPJ no texto ou pelo nome;
     2. 🧾 o comprovante de desconto em folha lido pela IA (mês, valor,
        quantos), conferido com os associados da escola;
     3. ✨ resposta sugerida pela IA com esse contexto e com o jeito da
        equipe (memória do robô) — editável, sai só com o clique;
     4. ↪ encaminhar;
     5. 📎 anexar (do computador ou do SISGEP — os ofícios da escola).
   Nada aqui envia, lança ou muda cadastro sozinho. Toda leitura respeita
   "cada um com a sua caixa" (cxsExigirCaixaDe_).
   ================================================================ */

var CXF_ANEXOS_PASTA = "SISGEP — Anexos enviados pela Caixa";
var CXF_ANEXO_MAX_BYTES = 20 * 1024 * 1024;
/* Os mesmos tipos que o leitor aceita (LEITOR_ANEXO_OK): documento, imagem,
   planilha. Programa e afins não vão — avisa no clique, não na fila. */
var CXF_ANEXO_OK = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/(plain|csv)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/(msword|vnd\.ms-excel))$/i;

/* A conversa e quem escreveu de fora (o último e o primeiro). */
function cxfConversa_(id, sessao) {
  cxsExigirCaixaDe_(sessao, id);
  var p = cxsLinhaPonte_(id);
  if (!p) throw new Error("Conversa não encontrada na Caixa.");
  var msgs = vpeJson_(p.MENSAGENS_JSON, []);
  var fora = msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; });
  return { p: p, msgs: msgs, primeiro: fora[0] || msgs[0] || {}, ultimo: fora[fora.length - 1] || msgs[msgs.length - 1] || {} };
}

function cxfSoDigitos_(s) { return String(s || "").replace(/\D/g, ""); }

/* ── 1. A ESCOLA ── */
function cxfAcharEscola_(conv) {
  var lista = [];
  try { lista = listarEscolasCadastro_interno_() || []; } catch (e) { return null; }
  var em = cxsEmail_(conv.ultimo.replyTo || conv.ultimo.de);
  var porEmail = lista.filter(function (e) {
    return em && (String(e.email || "") + "," + String(e.EmailsTodos || "")).toLowerCase().split(/[\s,;]+/).indexOf(em) > -1;
  })[0];
  if (porEmail) return { e: porEmail, origem: "pelo e-mail de quem escreveu (" + em + ")" };
  var texto = conv.msgs.map(function (m) { return (m.assunto || "") + " " + (m.corpo || ""); }).join(" ");
  var cnpjs = (texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || []).map(cxfSoDigitos_);
  var porCnpj = lista.filter(function (e) { return cnpjs.indexOf(cxfSoDigitos_(e.cnpj)) > -1; })[0];
  if (porCnpj) return { e: porCnpj, origem: "pelo CNPJ citado no e-mail" };
  var nome = cxsNome_(conv.ultimo.de);
  if (nome && typeof eiaMelhorCorrespondenciaEscola_ === "function") {
    var r = eiaMelhorCorrespondenciaEscola_(lista, nome, ["escola", "NomeEscola", "Fantasia", "nome"]);
    if (r && r.match && !r.ambiguo) return { e: r.match, origem: "pelo nome de quem escreveu (" + nome + ") — confira" };
  }
  return null;
}

function cxfMensalidades_(nomeEscola) {
  try {
    var m = listarMensalidadeStatus({ escola: nomeEscola });
    var itens = (m && m.itens) || [];
    var c = { total: itens.length, CONFIRMADO: 0, AGUARDANDO: 0, PENDENTE_30D: 0, COBRANCA_ENVIADA: 0, REGULARIZADO: 0 };
    itens.forEach(function (i) { c[i.status] = (c[i.status] || 0) + 1; });
    c.nomes = itens.map(function (i) { return { nome: i.nome, cpf: i.cpf, status: i.status }; });
    return c;
  } catch (e) { return null; }
}

function cxfOficiosDaEscola_(cnpj, tokenSessao) {
  try {
    var h = listarHistoricoOficios({}, tokenSessao);
    var itens = (h && h.itens) || [];
    var alvo = cxfSoDigitos_(cnpj);
    return itens.filter(function (o) { return alvo && cxfSoDigitos_(o.cnpj) === alvo; })
      .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); })
      .slice(0, 5)
      .map(function (o) {
        var fid = (String(o.link || "").match(/[-\w]{25,}/) || [""])[0];
        return { numero: o.numero, tipo: o.tipo, status: o.status, data: o.data, fileId: fid };
      });
  } catch (e) { return []; }
}

/** O que o SISGEP sabe da escola deste e-mail. */
function caixaContexto(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    var achou = cxfAcharEscola_(conv);
    if (!achou) return { ok: true, escola: null };
    var e = achou.e;
    var nome = String(e.escola || e.NomeEscola || "");
    var mens = cxfMensalidades_(nome);
    if (mens) delete mens.nomes;
    return { ok: true, escola: {
      nome: nome, fantasia: String(e.Fantasia || ""), cnpj: String(e.documentoMascarado || e.cnpj || ""),
      cidade: [e.cidade, e.uf].filter(String).join("/"), situacao: String(e.situacao || ""),
      id: String(e.EscolaID || ""), origem: achou.origem
    }, mensalidade: mens, oficios: cxfOficiosDaEscola_(e.cnpj, tokenSessao) };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* ── 2. O COMPROVANTE ── */
/** A IA lê o comprovante (texto + PDF anexo) e confere com os associados da escola. */
function caixaLerComprovante(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    var blocos = [];
    var anexos = vpeJson_(conv.p.ANEXOS_JSON, []);
    for (var i = 0; i < anexos.length && blocos.length < 2; i++) {
      var r = caixaSecretariaAnexo(id, i, tokenSessao);
      if (r && r.ok && /pdf|image/.test(r.tipo)) {
        var b64 = String(r.dataUrl).split(",")[1];
        blocos.push(/pdf/.test(r.tipo)
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
          : { type: "image", source: { type: "base64", media_type: r.tipo, data: b64 } });
      }
    }
    var texto = conv.msgs.map(function (m) { return "Assunto: " + (m.assunto || "") + "\n" + (m.corpo || ""); }).join("\n---\n");
    var prompt = "Você lê comprovantes de desconto em folha (mensalidade sindical ou taxa negocial) que escolas mandam a um " +
      "sindicato. Do e-mail e dos anexos, extraia. Responda SOMENTE com JSON: {\"e_comprovante\":true|false,\"tipo\":\"MENSALIDADE|TAXA_NEGOCIAL|OUTRO\"," +
      "\"escola\":\"\",\"cnpj\":\"\",\"mes\":\"MM\",\"ano\":\"AAAA\",\"valor\":\"R$ …\",\"quantidade\":0," +
      "\"pessoas\":[{\"nome\":\"\",\"cpf\":\"\"}]} — pessoas só se o comprovante listar nomes.\n\nE-MAIL:\n" + texto.substring(0, 6000);
    var j = vpeChamarIA_(prompt, blocos);
    if (!j || j.e_comprovante === false) return { ok: true, comprovante: null };
    var achou = cxfAcharEscola_(conv);
    var mens = achou ? cxfMensalidades_(String(achou.e.escola || "")) : null;
    var faltaram = [];
    if (mens && Array.isArray(j.pessoas) && j.pessoas.length) {
      var cpfs = j.pessoas.map(function (x) { return cxfSoDigitos_(x.cpf); }).filter(String);
      var nomes = j.pessoas.map(function (x) { return String(x.nome || "").toUpperCase().trim(); });
      faltaram = mens.nomes.filter(function (a) {
        return !(cpfs.indexOf(cxfSoDigitos_(a.cpf)) > -1 || nomes.indexOf(String(a.nome || "").toUpperCase().trim()) > -1);
      }).map(function (a) { return a.nome; });
    }
    roboMemoriaRegistrar_({ tarefa: "comprovante-lido", origem: String(conv.p.CAIXA || ""), chave: id,
      remetente: cxsEmail_(conv.ultimo.de), assunto: conv.primeiro.assunto, sugerido: JSON.stringify({ m: j.mes, a: j.ano, v: j.valor, q: j.quantidade }),
      decidido: "", quem: sessao.email || "" });
    return { ok: true, comprovante: {
      tipo: String(j.tipo || ""), escola: String(j.escola || ""), referencia: [j.mes, j.ano].filter(String).join("/"),
      valor: String(j.valor || ""), quantidade: Number(j.quantidade || 0) || (j.pessoas || []).length,
      esperado: mens ? mens.total : null, faltaram: faltaram, listaNomes: !!(j.pessoas && j.pessoas.length)
    } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* ── 3. A RESPOSTA PELA IA ── */
/* Como a equipe responde (03/11/2026: "sempre aprendendo com o que estou
   fazendo"): primeiro o que se respondeu a ESTE remetente, depois a e-mails
   do MESMO tipo, depois os mais recentes da caixa — até 4 exemplos. */
function cxfExemplosResposta_(caixa, tipoEmail, remetente) {
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ROBO_MEM_ABA);
    if (!sh || sh.getLastRow() < 2) return "";
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var c = v[0].map(String), iT = c.indexOf("TAREFA"), iO = c.indexOf("ORIGEM"), iD = c.indexOf("DECIDIDO"), iA = c.indexOf("ASSUNTO"),
        iR = c.indexOf("REMETENTE"), iK = c.indexOf("TIPO_EMAIL");
    var todas = v.slice(1).filter(function (l) { return l[iT] === "resposta-email" && String(l[iO]) === caixa && l[iD]; }).reverse();
    var rem = String(remetente || "").toLowerCase(), vistos = {}, ex = [];
    [function (l) { return rem && String(l[iR]).toLowerCase() === rem; },
     function (l) { return tipoEmail && iK > -1 && String(l[iK]) === tipoEmail; },
     function () { return true; }].forEach(function (f) {
      todas.forEach(function (l, i) { if (ex.length < 4 && !vistos[i] && f(l)) { vistos[i] = 1; ex.push(l); } });
    });
    if (!ex.length) return "";
    return "Respostas que a equipe enviou (siga o tom e o jeito):\n" + ex.map(function (l) {
      return "— Sobre \"" + String(l[iA]).substring(0, 80) + "\":\n" + String(l[iD]).substring(0, 600);
    }).join("\n") + "\n\n";
  } catch (e) { return ""; }
}

/** Uma resposta escrita pela IA com o e-mail + o que o SISGEP sabe. Não envia. */
/* (id, token) ou (id, forcar, token): o clique em ✨ pede uma nova; ao abrir
   a conversa, a já feita vale. */
function caixaSugerirResposta(id, a2, a3) {
  var forcar = a3 !== undefined ? a2 === true : false;
  var tokenSessao = a3 !== undefined ? a3 : a2;
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    /* A mesma conversa, sem mensagem nova: a proposta já feita vale
       (abrir de novo não gasta IA). */
    var chaveCache = "cxf_resp_" + String(id).replace(/[^\w]/g, "") + "_" + String(conv.ultimo.id || "").replace(/[^\w]/g, "");
    var cache = null;
    try { cache = CacheService.getScriptCache(); var c0 = forcar ? null : cache.get(chaveCache); if (c0) return JSON.parse(c0); } catch (e0) {}
    var ctx = caixaContexto(id, tokenSessao);
    var sabe = [];
    if (ctx.ok && ctx.escola) {
      sabe.push("Escola no cadastro: " + ctx.escola.nome + " (CNPJ " + ctx.escola.cnpj + ")");
      if (ctx.mensalidade) sabe.push("Associados da escola na mensalidade: " + ctx.mensalidade.total +
        " (confirmados " + (ctx.mensalidade.CONFIRMADO || 0) + ", aguardando " + (ctx.mensalidade.AGUARDANDO || 0) +
        ", pendentes há 30 dias " + (ctx.mensalidade.PENDENTE_30D || 0) + ")");
      if (ctx.oficios && ctx.oficios.length) sabe.push("Último ofício: nº " + ctx.oficios[0].numero + " (" + ctx.oficios[0].tipo + ", " + ctx.oficios[0].data + ")");
    }
    var conversa = conv.msgs.slice(-4).map(function (m) { return "De: " + m.de + "\nAssunto: " + (m.assunto || "") + "\n" + String(m.corpo || "").substring(0, 1500); }).join("\n---\n");
    var prompt = "Você escreve, em português, a resposta de um sindicato de trabalhadores da educação (SindEducação-ES) " +
      "a um e-mail. Seja cordial, objetivo e não invente dado que não esteja no e-mail ou no que o sistema sabe. " +
      "Cite a CCT, se precisar, pela numeração do registro no MTE (ES000256/2026). Não assine (a assinatura entra depois). " +
      "Responda ao que foi pedido de fato: se a pessoa pede um documento (boleto, guia, declaração, relação), escreva como quem " +
      "envia o documento em anexo e diga em \"anexar\" o que precisa ir junto. Comece cumprimentando pelo primeiro nome.\n\n" +
      cxfExemplosResposta_(String(conv.p.CAIXA || "SECRETARIA"), cxsTipo_((cxsEstados_()[String(id)] || {}).TIPO_CORRIGIDO || conv.p.TIPO),
        cxsEmail_(conv.ultimo.replyTo || conv.ultimo.de)) +
      (sabe.length ? "O QUE O SISTEMA SABE:\n" + sabe.join("\n") + "\n\n" : "") +
      "CONVERSA (a última é a que se responde):\n" + conversa +
      "\n\nResponda SOMENTE com JSON: {\"resposta\":\"texto da resposta, sem assinatura\",\"anexar\":\"o que anexar, ou vazio\"}";
    var j = vpeChamarIA_(prompt);
    var corpo = String((j && j.resposta) || "").trim();
    if (!corpo) return { ok: false, mensagem: "A IA não devolveu texto. Escreva a resposta à mão." };
    var out = { ok: true, texto: corpo + "\n\n" + vpeAssinaturaTexto_(sessao), anexar: String((j && j.anexar) || "").trim().substring(0, 200) };
    try { cache.put(chaveCache, JSON.stringify(out), 21600); } catch (e1) {}
    return out;
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* ── 5. OS ANEXOS ── */
function cxfPastaAnexos_() {
  var it = DriveApp.getFoldersByName(CXF_ANEXOS_PASTA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CXF_ANEXOS_PASTA);
}
/* Os arquivos que vão junto: os enviados do computador (guardados no Drive,
   ficam de registro) e os do SISGEP (por id). Devolve os ids no Drive. */
function cxfGuardarAnexos_(meta, quem) {
  var ids = [], total = 0;
  var pasta = null;
  (meta.anexos || []).forEach(function (a) {
    if (!CXF_ANEXO_OK.test(String(a.tipo || ""))) throw new Error("Tipo de arquivo não aceito para anexar (" + (a.nome || "anexo") + "). Vale PDF, imagem, Word, Excel, CSV ou TXT.");
    var bytes = Utilities.base64Decode(String(a.base64 || ""));
    total += bytes.length;
    if (total > CXF_ANEXO_MAX_BYTES) throw new Error("Os anexos passam de 20 MB. Tire algum antes de enviar.");
    pasta = pasta || cxfPastaAnexos_();
    var f = pasta.createFile(Utilities.newBlob(bytes, a.tipo || "application/octet-stream", String(a.nome || "anexo")));
    try { f.setDescription("Anexado na Caixa de E-mails por " + quem + " em " + new Date().toISOString()); } catch (e) {}
    ids.push(f.getId());
  });
  (meta.anexosSisgep || []).forEach(function (fid) {
    var f = DriveApp.getFileById(String(fid));
    total += f.getSize();
    if (total > CXF_ANEXO_MAX_BYTES) throw new Error("Os anexos passam de 20 MB. Tire algum antes de enviar.");
    ids.push(String(fid));
  });
  return ids;
}

/* ── 4. ENCAMINHAR ── */
/** Encaminha a conversa para outro e-mail, com uma nota. Só com o clique. */
function caixaEncaminhar(id, para, nota, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    para = String(para || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return { ok: false, mensagem: "Informe um e-mail válido para encaminhar." };
    vpeChecarDestinoAmbiente_(para);
    var quem = sessao.email || sessao.usuario || "";
    var html = vpeTextoParaHtml_(String(nota || "")) + vpeAssinaturaHtml_(String(conv.p.CAIXA || "SECRETARIA"), sessao);
    if (cxsEhFinanceiro_(id)) {
      var m = cxsGmailFinanceiro_().getMessageById(String(conv.ultimo.id));
      if (!m) return { ok: false, mensagem: "A mensagem não está mais na caixa do Financeiro." };
      m.forward(para, { htmlBody: html });
    } else {
      var shS = vpePonteAba_("Saida");
      var cabS = shS.getRange(1, 1, 1, shS.getLastColumn()).getValues()[0].map(String);
      if (cabS.indexOf("ENCAMINHAR_PARA") === -1) shS.getRange(1, cabS.length + 1).setValue("ENCAMINHAR_PARA");
      vpeGravar_({ ID: "ENV_" + Utilities.getUuid().replace(/-/g, "").slice(0, 20).toUpperCase(), THREAD_ID: String(conv.p.THREAD_ID),
                   MENSAGEM_ID: String(conv.ultimo.id || conv.p.ULTIMA_MENSAGEM_ID), HTML: html, ANEXOS_FILE_IDS: "",
                   STATUS: "PENDENTE", CRIADO_EM: new Date(), CRIADO_POR: quem, ENCAMINHAR_PARA: para }, shS);
    }
    cxsAuditar_("ENCAMINHAR", id, "Encaminhado para " + para, sessao);
    roboMemoriaRegistrar_({ tarefa: "encaminhar-email", origem: String(conv.p.CAIXA || ""), chave: id,
      remetente: cxsEmail_(conv.ultimo.de), assunto: conv.primeiro.assunto, sugerido: "", decidido: para, quem: quem });
    return { ok: true, mensagem: cxsEhFinanceiro_(id) ? "Encaminhado para " + para + "." :
      "Encaminhamento para " + para + " na fila da Secretaria — sai em até 15 minutos." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
