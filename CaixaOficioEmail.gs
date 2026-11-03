/* ================================================================
   CAIXA DA SECRETARIA — "VER OFÍCIO": O OFÍCIO QUE O ROBÔ PREPAROU DO E-MAIL
   ================================================================
   03/11/2026, desenho aprovado (docs/mock-caixa-secretaria-oficios.png). O
   usuário: "quando eu clicar em ver ... aponta para o ofício". A Secretaria
   recebe ficha de filiação, pedido de desfiliação e carta de oposição por
   e-mail; o robô lê o e-mail e os anexos e prepara o ofício:
     Tipo          — do card (com a origem à vista)
     Escola        — pelo e-mail de quem escreveu / CNPJ citado; ou pela
                     pessoa (CPF na base) / nome escrito (como o robô das fichas)
     Para          — o e-mail da escola no cadastro
     Trabalhador   — lido da ficha/carta anexa (IA), CPF conferido
     Situação      — é filiado hoje? já existe ofício deste tipo para ele nesta escola?
   A pessoa confere e "Abrir em Ofícios › Novo ofício" preenche o formulário
   de sempre (OficiosFichasDriveUI: ofdPreencherNovoOficio). A EMISSÃO
   CONTINUA NO MÓDULO DE OFÍCIOS — é a operação viva; nada é emitido daqui.
   Robô que aprende: o que a pessoa mudou (tipo, escola, nome, CPF) fica na
   memória do robô (tarefa "oficio-email"; "ficha-escola" para o jeito de
   escrever a escola) e o acerto aparece no rodapé da Caixa.
   ================================================================ */

var CXO_CACHE_SEG = 21600;

function cxoTipoOficio_(tipoCard) {
  return (CXS_TIPOS[tipoCard] && CXS_TIPOS[tipoCard].oficio) || "";
}

/** O ofício que o robô preparou deste e-mail. (id, token) ou (id, forcar, token). */
function caixaOficioDoEmail(id, a2, a3) {
  var forcar = a3 !== undefined ? a2 === true : false;
  var tokenSessao = a3 !== undefined ? a3 : a2;
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    var est = cxsEstados_()[String(id)];
    var card = cxsTipoDoEmail_(conv.p, est);
    var tipo = cxoTipoOficio_(card);
    if (!tipo) return { ok: true, oficio: null };
    var chave = "cxo_" + String(id).replace(/[^\w]/g, "") + "_" + String(conv.p.ULTIMA_MENSAGEM_ID || "").replace(/[^\w]/g, "");
    var cache = null;
    try { cache = CacheService.getScriptCache(); var c0 = forcar ? null : cache.get(chave); if (c0) return JSON.parse(c0); } catch (e0) {}

    /* A IA lê o e-mail e as fichas/cartas anexas. */
    var blocos = [], anexos = vpeJson_(conv.p.ANEXOS_JSON, []), arquivos = [];
    for (var i = 0; i < anexos.length && blocos.length < 2; i++) {
      if (!/pdf|image/i.test(String(anexos[i].tipo || ""))) continue;
      var r = cxsAnexoInterno_(conv.p, i);
      if (!r || !r.ok) continue;
      var b64 = String(r.dataUrl).split(",")[1];
      blocos.push(/pdf/.test(r.tipo) ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
                                     : { type: "image", source: { type: "base64", media_type: r.tipo, data: b64 } });
      arquivos.push({ indice: i, nome: String(anexos[i].nome || ""), fileId: String(anexos[i].fileId || "") });
    }
    var texto = conv.msgs.filter(function (m) { return CXS_NOSSOS.indexOf(cxsEmail_(m.de)) === -1; })
      .map(function (m) { return "De: " + m.de + "\nAssunto: " + (m.assunto || "") + "\n" + String(m.corpo || "").substring(0, 2500); }).join("\n---\n");
    var prompt = "Um sindicato de trabalhadores da educação (SindEducação-ES) recebeu por e-mail um pedido de " + tipo +
      ". Do e-mail e dos anexos (fichas ou cartas, às vezes preenchidas à mão), identifique CADA pessoa a quem o pedido se refere. " +
      "Não invente nem corrija o que está escrito; a ficha não tem CNPJ. Responda SOMENTE com JSON: " +
      "{\"pessoas\":[{\"nome\":\"\",\"cpf\":\"só dígitos\",\"escola_escrita\":\"nome da escola/empresa como está escrito\"," +
      "\"tem_assinatura\":true,\"duvidas\":\"o que estava ilegível ou incerto\"}]}\n\nE-MAIL:\n" + texto.substring(0, 7000);
    var j = vpeChamarIA_(prompt, blocos);
    var lidas = (j && Array.isArray(j.pessoas)) ? j.pessoas : [];

    var lista = [];
    try { lista = listarEscolasCadastro_interno_() || []; } catch (e1) {}
    var achou = cxfAcharEscola_(conv);   // pelo e-mail de quem escreveu / CNPJ citado
    var registros = [];
    try { registros = typeof cfmOficios_ === "function" ? cfmOficios_() : []; } catch (e2) {}

    var escolaGeral = achou ? { escola: achou.e, origem: achou.origem } : null;
    var pessoas = lidas.map(function (x) {
      var cpf = ofdDig_(x.cpf), alertas = [], situacao = [];
      var cpfOk = cpf.length === 11 && validarCPFSindicalizacao_(cpf);
      if (!cpf) alertas.push("CPF não lido"); else if (!cpfOk) alertas.push("CPF não confere — olhe o anexo");
      var ass = null;
      if (cpfOk) { try { ass = consultarAssociadoPorCPF(cpf, tokenSessao); } catch (e3) { ass = null; } }
      var filiado = !!(ass && ass.existe && ass.filiado);
      if (tipo === "Filiação") { if (filiado) alertas.push("já consta como filiado(a) na base"); else situacao.push("não é filiado(a) hoje"); }
      if (tipo === "Desfiliação" || tipo === "Oposição à Taxa Negocial") {
        if (cpfOk && !filiado && tipo === "Desfiliação") alertas.push("não consta como filiado(a) na base");
        else if (filiado) situacao.push("filiado(a) hoje");
      }
      if (x.tem_assinatura === false) alertas.push("sem assinatura");
      if (x.duvidas) alertas.push("leitura: " + String(x.duvidas).substring(0, 120));
      var esc = escolaGeral || ofdAcharEscola_(String(x.escola_escrita || ""), ass, lista);
      var escObj = esc.escola || null;
      if (!escObj) alertas.push("escola não identificada");
      var nome = String((ass && ass.existe && ass.nome) || x.nome || "").trim();
      if (escObj) {
        var cnpj = ofdDig_(escObj.cnpj);
        var ja = registros.filter(function (o) { return o.cnpj === cnpj && o.tipo === tipo &&
          o.pessoas.some(function (pp) { return (cpf && pp.cpf === cpf) || cfmNome_(pp.nome) === cfmNome_(nome); }); })[0];
        if (ja) alertas.push("já existe ofício de " + tipo.toLowerCase() + " para esta pessoa nesta escola (nº " + ja.numero + ")");
        else situacao.push("nenhum ofício de " + tipo.toLowerCase() + " para ela nesta escola");
      }
      return { nome: nome, nomeLido: String(x.nome || ""), nomeOrigem: ass && ass.existe ? "da base de associados (pelo CPF)" : "lido do anexo",
               cpf: cpf, cpfOk: cpfOk, escolaEscrita: String(x.escola_escrita || ""),
               escola: escObj ? ofdEscolaCurta_(escObj) : null, escolaOrigem: esc.origem || "", candidatos: esc.candidatos || [],
               situacao: situacao, alertas: alertas, ok: !alertas.length };
    });
    var escola = pessoas.length && pessoas[0].escola ? pessoas[0].escola : (escolaGeral ? ofdEscolaCurta_(escolaGeral.escola) : null);
    var out = { ok: true, oficio: {
      tipo: tipo, card: card, tipoOrigem: est && est.TIPO_CORRIGIDO ? "pelo card que a equipe escolheu" : "pelo assunto e pelo anexo (regra) — confira",
      escola: escola, escolaOrigem: pessoas.length ? pessoas[0].escolaOrigem : (escolaGeral ? escolaGeral.origem : ""),
      para: escola ? escola.email : "", paraOrigem: escola && escola.email ? "e-mail da escola no cadastro" : "a escola não tem e-mail no cadastro",
      pessoas: pessoas, arquivos: arquivos, semPessoa: !pessoas.length
    } };
    roboMemoriaRegistrar_({ tarefa: "oficio-email-lido", origem: "SECRETARIA", chave: String(id), remetente: cxsEmail_(conv.ultimo.de),
      assunto: conv.primeiro.assunto, sugerido: cxoAssinatura_(tipo, escola && escola.cnpj, pessoas), decidido: "", quem: sessao.email || "" });
    try { cache.put(chave, JSON.stringify(out), CXO_CACHE_SEG); } catch (e4) {}
    return out;
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/* O que o robô propôs / o que foi para o ofício, numa linha comparável. */
function cxoAssinatura_(tipo, cnpj, pessoas) {
  return [tipo, ofdDig_(cnpj)].concat((pessoas || []).map(function (p) { return cfmNome_(p.nome) + ":" + ofdDig_(p.cpf); }).sort()).join("|");
}

/**
 * A pessoa conferiu: guarda o que mudou (o robô aprende) e devolve o que o
 * Novo Ofício precisa. conferido = { tipo, escolaCnpj, pessoas:[{nome,cpf}] }.
 * NÃO emite nada.
 */
function caixaOficioPreparar(id, conferido, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    var conv = cxfConversa_(id, sessao);
    var quem = sessao.email || sessao.usuario || "";
    conferido = conferido || {};
    var tipos = Object.keys(CXS_TIPOS).map(function (k) { return CXS_TIPOS[k].oficio; }).filter(String);
    var tipo = String(conferido.tipo || "");
    if (tipos.indexOf(tipo) === -1) return { ok: false, mensagem: "Escolha o tipo do ofício." };
    var pessoas = (conferido.pessoas || []).map(function (p) { return { nome: String(p.nome || "").trim(), cpf: ofdDig_(p.cpf) }; })
      .filter(function (p) { return p.nome; });
    if (!pessoas.length) return { ok: false, mensagem: "Nenhuma pessoa para o ofício." };
    var invalidos = pessoas.filter(function (p) { return p.cpf && !validarCPFSindicalizacao_(p.cpf); });
    if (invalidos.length) return { ok: false, mensagem: "CPF que não confere: " + invalidos.map(function (p) { return p.nome; }).join(", ") + ". Corrija antes." };
    var cnpj = ofdDig_(conferido.escolaCnpj);
    var lista = [];
    try { lista = listarEscolasCadastro_interno_() || []; } catch (e) {}
    var escola = cnpj ? lista.filter(function (e) { return ofdDig_(e.cnpj) === cnpj; })[0] : null;
    if (!escola) return { ok: false, mensagem: "Escolha a escola (uma por ofício) — ela precisa estar no cadastro." };

    /* O que o robô tinha proposto (da última leitura) × o que a pessoa conferiu. */
    var proposto = null;
    try {
      var c = CacheService.getScriptCache().get("cxo_" + String(id).replace(/[^\w]/g, "") + "_" + String(conv.p.ULTIMA_MENSAGEM_ID || "").replace(/[^\w]/g, ""));
      proposto = c ? JSON.parse(c).oficio : null;
    } catch (e1) {}
    if (proposto) {
      roboMemoriaRegistrar_({ tarefa: "oficio-email", origem: "SECRETARIA", chave: String(id), remetente: cxsEmail_(conv.ultimo.de),
        assunto: conv.primeiro.assunto, sugerido: cxoAssinatura_(proposto.tipo, proposto.escola && proposto.escola.cnpj, proposto.pessoas),
        decidido: cxoAssinatura_(tipo, cnpj, pessoas), quem: quem });
      (proposto.pessoas || []).forEach(function (lp) {
        if (lp.escolaEscrita) roboMemoriaRegistrar_({ tarefa: "ficha-escola", origem: "SECRETARIA", chave: String(id),
          remetente: ofdNorm_(lp.escolaEscrita), assunto: lp.escolaEscrita, sugerido: ofdDig_(lp.escola && lp.escola.cnpj), decidido: cnpj, quem: quem });
      });
    }
    /* O anexo (ficha/carta) vai junto, como quando se anexa do Drive à mão. */
    var ficha = null, anexos = vpeJson_(conv.p.ANEXOS_JSON, []);
    for (var i = 0; i < anexos.length && !ficha; i++) {
      var a = anexos[i];
      if (!a.fileId || !/pdf|image/i.test(String(a.tipo || ""))) continue;
      try { var f = DriveApp.getFileById(String(a.fileId)); ficha = { id: String(a.fileId), nome: String(a.nome || f.getName()), tipo: String(f.getMimeType()), url: f.getUrl() }; } catch (e2) {}
    }
    cxsAuditar_("OFICIO_PREPARADO", id, tipo + " · " + cnpj + " · " + pessoas.length + " pessoa(s)", sessao);
    return { ok: true, oficio: { tipo: tipo, escola: ofdEscolaCurta_(escola), pessoas: pessoas, ficha: ficha, origem: "Caixa da secretaria@" } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
