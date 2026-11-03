/* ================================================================
   ROBÔ DAS FICHAS DO DRIVE → OFÍCIO (03/11/2026)
   ================================================================
   Desenho aprovado (docs/mock-robo-fichas-oficio.png, "Aprovo"). O usuário:
   a maioria dos ofícios nasce de FICHA EM PAPEL — "a pessoa preenche, a
   gente digitaliza ... salva no drive ... vou lá no SISGEP, documentos,
   ofício, e faço todo o procedimento". Várias fichas da mesma escola podem
   vir num PDF só. A ficha NÃO tem CNPJ.

   O que este arquivo faz (e só isto):
     1. olha as três pastas do ano no Drive (o tipo sai da pasta);
     2. a IA lê o PDF/imagem e acha cada ficha (nome, CPF, escola escrita);
     3. confere: CPF pelo dígito, pessoa na base de associados, escola no
        cadastro (pelo associado, pelo que a equipe já corrigiu antes, ou
        pelo nome parecido) — com a ORIGEM de cada dado à vista;
     4. entrega à tela de Novo Ofício os dados para preencher.
   NÃO emite, NÃO envia, NÃO mexe na fila de ofícios: a emissão continua no
   módulo de Ofícios, como hoje (é a operação viva — Marcela, todo dia).
   Fichas que já estavam nas pastas antes da 1ª vez contam como feitas.
   ================================================================ */

var OFD_PASTA_MAE = "1JQOe8WTguf0vMxb83xVfezIySNSWnvu3";
var OFD_ABA = "Oficios_Fichas_Drive";
var OFD_COLUNAS = ["FILE_ID", "NOME", "TIPO", "PASTA", "CRIADO_EM", "ESTADO", "LEITURA_JSON", "LIDO_EM",
                   "PREPARADO_EM", "PREPARADO_POR", "OBS"];
/* O caminho de cada tipo, a partir da pasta-mãe. {ano} vira o ano atual. */
var OFD_CAMINHOS = [
  { tipo: "Filiação", rotulo: "Filiação", caminho: ["FILIAÇÕES", "FILIAÇÕES {ano}", "Ficha de Filiação"] },
  { tipo: "Desfiliação", rotulo: "Desfiliação", caminho: ["DESFILIAÇÕES", "DESFILIAÇÃO {ano}"] },
  { tipo: "Oposição à Taxa Negocial", rotulo: "Oposição à taxa negocial", caminho: ["DESFILIAÇÕES", "TAXA NEGOCIAL {ano}"] }
];
var OFD_MAX_BYTES = 18 * 1024 * 1024;

function ofdNorm_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function ofdDig_(s) { return String(s || "").replace(/\D/g, ""); }

function ofdAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(OFD_ABA);
  if (!sh) { sh = ss.insertSheet(OFD_ABA); sh.getRange(1, 1, 1, OFD_COLUNAS.length).setValues([OFD_COLUNAS]); }
  return sh;
}
function ofdLinhas_() {
  var sh = ofdAba_();
  if (sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), OFD_COLUNAS.length).getValues();
  return v.slice(1).map(function (l, i) {
    var o = { __linha: i + 2 };
    OFD_COLUNAS.forEach(function (c, j) { o[c] = l[j]; });
    return o;
  }).filter(function (o) { return o.FILE_ID; });
}
function ofdGravar_(reg) {
  var sh = ofdAba_();
  var linha = reg.__linha;
  if (!linha) {
    var ja = ofdLinhas_().filter(function (o) { return String(o.FILE_ID) === String(reg.FILE_ID); })[0];
    linha = ja ? ja.__linha : 0;
  }
  var vals = [OFD_COLUNAS.map(function (c) { return reg[c] === undefined ? "" : reg[c]; })];
  if (linha) sh.getRange(linha, 1, 1, OFD_COLUNAS.length).setValues(vals); else sh.appendRow(vals[0]);
}

/* A subpasta pelo nome (sem acento/caixa; aceita "2026.1"/"2026-1"). */
function ofdSubpasta_(pai, nome) {
  var alvo = ofdNorm_(nome);
  var it = pai.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var n = ofdNorm_(f.getName());
    if (n === alvo || n.replace(/ \d$/, "") === alvo || n.indexOf(alvo + " ") === 0) return f;
  }
  return null;
}
/** As pastas do ano (acha sozinho quando vira o ano). */
function ofdPastas_() {
  var ano = String(new Date().getFullYear());
  var mae = DriveApp.getFolderById(OFD_PASTA_MAE);
  return OFD_CAMINHOS.map(function (c) {
    var atual = mae, ok = true;
    c.caminho.forEach(function (passo) {
      if (!ok) return;
      var prox = ofdSubpasta_(atual, passo.replace("{ano}", ano));
      if (!prox) { ok = false; return; }
      atual = prox;
    });
    return { tipo: c.tipo, rotulo: c.rotulo, pasta: ok ? atual : null,
             caminho: c.caminho.join(" › ").replace("{ano}", ano) };
  });
}

/** As fichas novas (desde a 1ª vez que o robô olhou), por pasta. */
function oficiosFichasListar(tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var props = PropertiesService.getScriptProperties();
    var corte = props.getProperty("OFD_CORTE");
    if (!corte) { corte = new Date().toISOString(); props.setProperty("OFD_CORTE", corte); }
    var corteTs = new Date(corte).getTime();
    var conhecidas = {};
    ofdLinhas_().forEach(function (o) { conhecidas[String(o.FILE_ID)] = o; });
    var avisos = [];
    ofdPastas_().forEach(function (p) {
      if (!p.pasta) { avisos.push("Não achei a pasta " + p.caminho + " no Drive."); return; }
      var it = p.pasta.getFiles();
      while (it.hasNext()) {
        var f = it.next();
        var id = String(f.getId());
        if (conhecidas[id]) continue;
        if (!/pdf|image/.test(String(f.getMimeType()))) continue;
        var criado = f.getDateCreated();
        if (criado && new Date(criado).getTime() < corteTs) continue;   // já estava lá: conta como feita
        var reg = { FILE_ID: id, NOME: f.getName(), TIPO: p.tipo, PASTA: p.caminho, CRIADO_EM: criado || new Date(), ESTADO: "NOVA" };
        ofdGravar_(reg);
        conhecidas[id] = reg;
      }
    });
    var itens = Object.keys(conhecidas).map(function (k) { return conhecidas[k]; })
      .filter(function (o) { return ["NOVA", "LIDA"].indexOf(String(o.ESTADO)) > -1; })
      .map(ofdResumo_)
      .sort(function (a, b) { return b.criadoTs - a.criadoTs; });
    var preparadas = ofdLinhas_().filter(function (o) { return String(o.ESTADO) === "PREPARADA"; }).map(ofdResumo_).slice(-10).reverse();
    return { ok: true, itens: itens, preparadas: preparadas, avisos: avisos, desde: corte };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
function ofdResumo_(o) {
  var l = vpeJson_(o.LEITURA_JSON, null);
  var criado = o.CRIADO_EM ? new Date(o.CRIADO_EM) : null;
  return { id: String(o.FILE_ID), nome: String(o.NOME), tipo: String(o.TIPO), pasta: String(o.PASTA), estado: String(o.ESTADO),
           criadoTs: criado ? criado.getTime() : 0,
           criadoEm: criado ? Utilities.formatDate(criado, "America/Sao_Paulo", "dd/MM HH:mm") : "",
           leitura: l, preparadoPor: String(o.PREPARADO_POR || "") };
}

/* ── A ESCOLA: pelo associado, pelo que já se corrigiu, pelo nome parecido ── */
var OFD_PALAVRAS_FRACAS = ["colegio", "escola", "centro", "educacional", "educacao", "ensino", "ltda", "me", "eireli", "de", "da", "do",
  "das", "dos", "e", "infantil", "fundamental", "medio", "instituto", "col", "esc", "cei", "sociedade", "soc", "ss", "s", "a", "epp"];
function ofdTokens_(s) {
  return ofdNorm_(s).split(" ").filter(function (w) { return w && OFD_PALAVRAS_FRACAS.indexOf(w) === -1; });
}
function ofdParecido_(a, b) {
  var ta = ofdTokens_(a), tb = ofdTokens_(b);
  if (!ta.length || !tb.length) return 0;
  var bate = 0;
  ta.forEach(function (w) {
    if (tb.some(function (x) { return x === w || (w.length >= 4 && x.indexOf(w) === 0) || (x.length >= 4 && w.indexOf(x) === 0); })) bate++;
  });
  return bate / Math.max(ta.length, tb.length);
}
function ofdNomesEscola_(e) { return [e.Fantasia, e.escola, e.NomeEscola, e.nome].filter(function (x) { return x; }).map(String); }
function ofdAcharEscola_(escrito, associado, lista) {
  /* 1) a pessoa já é da base: a escola do cadastro dela */
  if (associado && associado.existe && associado.escola) {
    var porAss = lista.filter(function (e) { return ofdNomesEscola_(e).some(function (n) { return ofdNorm_(n) === ofdNorm_(associado.escola); }); })[0];
    if (porAss) return { escola: porAss, origem: "do cadastro do associado (pelo CPF)", certeza: "ALTA" };
  }
  /* 2) o que a equipe já decidiu para este mesmo jeito de escrever */
  var aprendido = escrito ? roboMemoriaUltimaDecisao_("ficha-escola", ofdNorm_(escrito)) : "";
  if (aprendido) {
    var porMem = lista.filter(function (e) { return ofdDig_(e.cnpj) === ofdDig_(aprendido); })[0];
    if (porMem) return { escola: porMem, origem: "da última vez, \"" + escrito + "\" era esta escola (a equipe corrigiu)", certeza: "ALTA" };
  }
  /* 3) o nome escrito mais parecido */
  if (!escrito) return { escola: null, origem: "a ficha não diz a escola", certeza: "NENHUMA", candidatos: [] };
  var pont = lista.map(function (e) {
    var s = Math.max.apply(null, ofdNomesEscola_(e).map(function (n) { return ofdParecido_(escrito, n); }).concat([0]));
    return { e: e, s: s };
  }).filter(function (x) { return x.s >= 0.5; }).sort(function (a, b) { return b.s - a.s; });
  var cand = pont.slice(0, 4).map(function (x) { return ofdEscolaCurta_(x.e); });
  if (pont.length && (pont.length === 1 || pont[0].s - pont[1].s >= 0.25) && pont[0].s >= 0.66) {
    return { escola: pont[0].e, origem: "pelo nome escrito na ficha (\"" + escrito + "\") — confira", certeza: "MEDIA", candidatos: cand };
  }
  return { escola: null, origem: "escrito: \"" + escrito + "\" — " + (pont.length ? pont.length + " parecida(s), escolha" : "nenhuma parecida no cadastro"),
           certeza: "NENHUMA", candidatos: cand };
}
function ofdEscolaCurta_(e) {
  return { nome: String(e.Fantasia || e.escola || e.NomeEscola || ""), razao: String(e.escola || ""), cnpj: String(e.documentoMascarado || e.cnpj || ""),
           email: String(e.email || ""), id: String(e.EscolaID || "") };
}

/** A IA lê as fichas do arquivo e o SISGEP confere cada pessoa. Não emite nada. */
function oficiosFichasLer(fileId, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var reg = ofdLinhas_().filter(function (o) { return String(o.FILE_ID) === String(fileId); })[0];
    if (!reg) return { ok: false, mensagem: "Ficha não encontrada na lista do robô." };
    var f = DriveApp.getFileById(String(fileId));
    if (f.getSize() > OFD_MAX_BYTES) return { ok: false, mensagem: "O arquivo passa de 18 MB — divida o PDF antes." };
    var tipoMime = String(f.getMimeType());
    var b64 = Utilities.base64Encode(f.getBlob().getBytes());
    var bloco = /pdf/.test(tipoMime) ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
                                     : { type: "image", source: { type: "base64", media_type: tipoMime, data: b64 } };
    var prompt = "Você lê fichas de sindicalização (" + reg.TIPO + ") do SindEducação-ES, escaneadas e preenchidas À MÃO. " +
      "Um arquivo pode ter VÁRIAS fichas (uma por pessoa, em páginas diferentes). Para CADA ficha, extraia o que está escrito, " +
      "sem inventar nem corrigir. A ficha não tem CNPJ. Responda SOMENTE com JSON: " +
      "{\"fichas\":[{\"pagina\":1,\"nome\":\"\",\"cpf\":\"só dígitos\",\"escola_escrita\":\"o nome da escola/empresa como está escrito\"," +
      "\"cargo\":\"\",\"data_admissao\":\"dd/mm/aaaa\",\"tem_assinatura\":true,\"duvidas\":\"o que estava ilegível ou incerto\"}]}";
    var j = vpeChamarIA_(prompt, [bloco]);
    var fichas = (j && Array.isArray(j.fichas)) ? j.fichas : [];
    if (!fichas.length) return { ok: false, mensagem: "A IA não achou nenhuma ficha neste arquivo. Abra e confira." };
    var lista = [];
    try { lista = listarEscolasCadastro_interno_() || []; } catch (e) {}
    var pessoas = fichas.map(function (x) {
      var cpf = ofdDig_(x.cpf), alertas = [];
      var cpfOk = cpf.length === 11 && validarCPFSindicalizacao_(cpf);
      if (!cpf) alertas.push("CPF não lido"); else if (!cpfOk) alertas.push("CPF não confere — olhe a ficha");
      var ass = null;
      if (cpfOk) { try { ass = consultarAssociadoPorCPF(cpf, tokenSessao); } catch (e) { ass = null; } }
      if (reg.TIPO === "Filiação" && ass && ass.existe && ass.filiado) alertas.push("já consta como filiado na base");
      if (reg.TIPO === "Desfiliação" && cpfOk && !(ass && ass.existe && ass.filiado)) alertas.push("não consta como filiado na base");
      if (x.tem_assinatura === false) alertas.push("sem assinatura");
      if (x.duvidas) alertas.push("leitura: " + String(x.duvidas).substring(0, 120));
      var esc = ofdAcharEscola_(String(x.escola_escrita || ""), ass, lista);
      if (!esc.escola) alertas.push("escola não identificada");
      return { pagina: Number(x.pagina || 0), nome: String((ass && ass.existe && ass.nome) || x.nome || "").trim(),
               nomeLido: String(x.nome || ""), nomeOrigem: ass && ass.existe ? "da base de associados (pelo CPF)" : "lido da ficha",
               cpf: cpf, cpfOk: cpfOk, cargo: String(x.cargo || ""), escolaEscrita: String(x.escola_escrita || ""),
               escola: esc.escola ? ofdEscolaCurta_(esc.escola) : null, escolaOrigem: esc.origem, certeza: esc.certeza,
               candidatos: esc.candidatos || [], alertas: alertas, ok: !alertas.length };
    });
    var leitura = { lidoEm: new Date().toISOString(), pessoas: pessoas };
    reg.LEITURA_JSON = JSON.stringify(leitura); reg.ESTADO = "LIDA"; reg.LIDO_EM = new Date();
    ofdGravar_(reg);
    roboMemoriaRegistrar_({ tarefa: "ficha-lida", origem: "OFICIOS", chave: String(fileId), assunto: String(reg.NOME),
      sugerido: JSON.stringify(pessoas.map(function (p) { return [p.nome, p.cpf, p.escola && p.escola.cnpj]; })), decidido: "",
      quem: sessao.email || sessao.usuario || "" });
    return { ok: true, item: ofdResumo_(reg) };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/**
 * A pessoa conferiu e corrigiu: guarda o que mudou (é assim que o robô
 * aprende) e devolve o que a tela de Novo Ofício precisa para se preencher.
 * conferido = { pessoas:[{nome,cpf,escolaCnpj}] } — uma escola por ofício.
 */
function oficiosFichasPreparar(fileId, conferido, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var quem = sessao.email || sessao.usuario || "";
    var reg = ofdLinhas_().filter(function (o) { return String(o.FILE_ID) === String(fileId); })[0];
    if (!reg) return { ok: false, mensagem: "Ficha não encontrada na lista do robô." };
    var leitura = vpeJson_(reg.LEITURA_JSON, { pessoas: [] });
    var pessoas = ((conferido && conferido.pessoas) || []).map(function (p) {
      return { nome: String(p.nome || "").trim(), cpf: ofdDig_(p.cpf), escolaCnpj: ofdDig_(p.escolaCnpj), pagina: Number(p.pagina || 0) };
    }).filter(function (p) { return p.nome; });
    if (!pessoas.length) return { ok: false, mensagem: "Nenhuma pessoa para o ofício." };
    var cnpjs = pessoas.map(function (p) { return p.escolaCnpj; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    if (cnpjs.length !== 1 || pessoas.some(function (p) { return !p.escolaCnpj; })) {
      return { ok: false, mensagem: "Cada ofício é para UMA escola. Escolha a escola de todas as pessoas (ou separe em outro ofício)." };
    }
    var invalidos = pessoas.filter(function (p) { return p.cpf && !validarCPFSindicalizacao_(p.cpf); });
    if (invalidos.length) return { ok: false, mensagem: "CPF que não confere: " + invalidos.map(function (p) { return p.nome; }).join(", ") + ". Corrija antes." };
    var lista = [];
    try { lista = listarEscolasCadastro_interno_() || []; } catch (e) {}
    var escola = lista.filter(function (e) { return ofdDig_(e.cnpj) === cnpjs[0]; })[0];
    if (!escola) return { ok: false, mensagem: "Escola não encontrada no cadastro." };
    /* O que a pessoa mudou vira exemplo (a letra, o jeito de escrever a escola). */
    pessoas.forEach(function (p) {
      var lido = (leitura.pessoas || []).filter(function (x) { return x.pagina === p.pagina && p.pagina; })[0] ||
                 (leitura.pessoas || []).filter(function (x) { return x.cpf === p.cpf; })[0] || {};
      if (lido.escolaEscrita) roboMemoriaRegistrar_({ tarefa: "ficha-escola", origem: "OFICIOS", chave: String(fileId),
        remetente: ofdNorm_(lido.escolaEscrita), assunto: lido.escolaEscrita, sugerido: ofdDig_(lido.escola && lido.escola.cnpj),
        decidido: p.escolaCnpj, quem: quem });
      if (lido.cpf !== undefined) roboMemoriaRegistrar_({ tarefa: "ficha-cpf", origem: "OFICIOS", chave: String(fileId),
        assunto: p.nome, sugerido: String(lido.cpf || ""), decidido: p.cpf, quem: quem });
    });
    reg.ESTADO = "PREPARADA"; reg.PREPARADO_EM = new Date(); reg.PREPARADO_POR = quem;
    ofdGravar_(reg);
    var f = DriveApp.getFileById(String(fileId));
    return { ok: true, oficio: {
      tipo: String(reg.TIPO), escola: ofdEscolaCurta_(escola),
      pessoas: pessoas.map(function (p) { return { nome: p.nome, cpf: p.cpf }; }),
      ficha: { id: String(fileId), nome: f.getName(), tipo: String(f.getMimeType()), url: f.getUrl() }
    } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/** Tirar da lista (não é ficha, duplicada…) — fica registrado. */
function oficiosFichasIgnorar(fileId, motivo, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var reg = ofdLinhas_().filter(function (o) { return String(o.FILE_ID) === String(fileId); })[0];
    if (!reg) return { ok: false, mensagem: "Ficha não encontrada." };
    reg.ESTADO = "IGNORADA"; reg.OBS = String(motivo || "").substring(0, 200) + " — " + (sessao.email || sessao.usuario || "");
    ofdGravar_(reg);
    return { ok: true, mensagem: "Tirada da lista." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
