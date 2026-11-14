/* ================================================================
   INGRESSOS DA FESTA (TickOne) — Compasso da Vida 2026 (14/11/2026)
   ================================================================
   Os ingressos são emitidos na plataforma TickOne
   (ingressos.sindeducacao.com.br). O SISGEP não emite nada ali — ele LÊ a base
   e ajuda a ENVIAR, individualmente, pelo WhatsApp.

   Decisões do usuário:
   - "Se a pessoa está na base do ingresso, se já foi feito" e "quando for
     solicitar, SEMPRE pesquisar antes": toda conferência compara a lista com a
     base lida pelo robô (CPF e, na falta, nome) e marca quem JÁ TEM ingresso.
     Quem já tem nunca é pedido de novo.
   - O robô (tools/ingressos-robo/ler-base.js, GitHub Actions) entra no TickOne
     com o login guardado nos Secrets do GitHub, SÓ LÊ, e grava ingressos-base.json
     numa pasta privada do Drive do Financeiro — a conta em que o SISGEP roda.
   - CAMPOS OBRIGATÓRIOS POR CATEGORIA (usuário, 14/11/2026): para ASSOCIADO todos
     (nome, CPF, telefone com DDD, e-mail, escola e cidade); para Acompanhante,
     Convite, Cortesia e Pago só NOME e CPF — o resto em branco libera (vira
     aviso, não trava).
   - Cinco categorias, as do TickOne: Associado, Acompanhante Associado,
     Convite, Cortesia, Pago. Acompanhante é categoria solta (sem ligação com um
     associado). Não existe limite de vagas.
   - O envio é individual: o SISGEP abre o WhatsApp da pessoa com a mensagem
     pronta; o PDF o operador abre no TickOne e anexa; o envio é o toque dele.
     Só vira "enviado" depois que a pessoa confirma.
   - EXCLUIR UM INGRESSO (usuário, 14/11/2026: "o cara não vai, quero excluir ... eu vou lá,
     pesquiso no SISGEP o nome dele, vou em exclusão e você faz toda a operação por trás"):
     botão "Excluir" na linha, com confirmação ("não tem volta"). O pedido vai para uma FILA
     (aba Ingressos_Exclusoes, com uma cópia dos dados, porque no TickOne eles se perdem) e
     para o arquivo exclusoes-fila.json; o robô (tools/ingressos-robo/excluir.js) exclui no
     TickOne SÓ o que está na fila, confere código E CPF, não exclui quem já passou na
     portaria, relê e confere que sumiu, e devolve exclusoes-resultado.json. O PDF da pasta do
     Drive NÃO é apagado. O robô ainda é acionado por mim (não pelo botão): o pedido espera.
     NÃO TESTADO no TickOne de verdade: o primeiro uso é com um ingresso de TESTE.
   - EMISSÃO (usuário, 14/11/2026: "faz um ingresso de teste"): depois da conferência, "Pedir emissão"
     com confirmação ("cria ingresso de verdade") grava o pedido (aba Ingressos_Emissoes) e
     emissoes-fila.json; o robô (tools/ingressos-robo/emitir.js) abre UM lugar livre da grade do
     TickOne, preenche o pop-up e clica "Emitir Ingresso", depois confere na lista. Só com a base
     lida há menos de 15 min e só para quem a conferência deu "novo". O robô é acionado por mim.
     NÃO TESTADO no TickOne de verdade: o primeiro uso é UM ingresso de teste.
   ================================================================ */

var CING_PASTA = "SISGEP — Ingressos (robô)";
var CING_ARQ = "ingressos-base.json";
var CING_ABA_ENVIOS = "Ingressos_Envios";
var CING_COLUNAS_ENVIOS = ["CODIGO", "NOME", "TELEFONE", "CANAL", "ENVIADO_EM", "ENVIADO_POR"];
var CING_PASTA_PDF_ID = "1A6vZ_aVW1fXW7pKhNH14oWbOjMs4SdjV";   // "INGRESSOS FESTA COMPASSO 2026" (Drive do Financeiro): os PDFs "TickOne - Nome.pdf"
var CING_ABA_EXCL = "Ingressos_Exclusoes";
var CING_COLUNAS_EXCL = ["PEDIDO", "CODIGO", "NOME", "CPF", "TIPO", "ESCOLA", "CIDADE", "TELEFONE", "MOTIVO", "PEDIDO_EM", "PEDIDO_POR", "STATUS", "RESULTADO", "EXECUTADO_EM"];
var CING_ARQ_FILA = "exclusoes-fila.json";
var CING_ARQ_RESULTADO = "exclusoes-resultado.json";
var CING_ABA_EMIS = "Ingressos_Emissoes";
var CING_COLUNAS_EMIS = ["PEDIDO", "NOME", "CPF", "EMAIL", "TELEFONE", "CIDADE", "ESCOLA", "CATEGORIA", "PEDIDO_EM", "PEDIDO_POR", "STATUS", "CODIGO", "RESULTADO", "EXECUTADO_EM"];
var CING_ARQ_FILA_EMIS = "emissoes-fila.json";
var CING_ARQ_RES_EMIS = "emissoes-resultado.json";
var CING_IDADE_MAX_MIN = 15;   // a base precisa ser recente para pedir ingresso novo
var CING_URL_TICKET = "https://ingressos.sindeducacao.com.br/index.php?page=ticket&ref=";
var CING_CATEGORIAS = [
  { valor: "associado", rotulo: "Associado" },
  { valor: "acompanhante", rotulo: "Acompanhante Associado" },
  { valor: "convite", rotulo: "Convite" },
  { valor: "cortesia", rotulo: "Cortesia" },
  { valor: "pago", rotulo: "Pago" }
];

function cingSoDigitos_(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }

function cingCpfValido_(cpf) {
  var d = cingSoDigitos_(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (var t = 9; t < 11; t++) {
    var soma = 0;
    for (var i = 0; i < t; i++) soma += Number(d.charAt(i)) * (t + 1 - i);
    var dv = (soma * 10) % 11 % 10;
    if (dv !== Number(d.charAt(t))) return false;
  }
  return true;
}

function cingCpfMascara_(cpf) {
  var d = cingSoDigitos_(cpf);
  return d.length === 11 ? d.substring(0, 3) + ".***.***-" + d.substring(9) : (d ? "***" : "");
}

/** Telefone para o WhatsApp: 55 + DDD + número. Devolve "" se faltar DDD ou o tamanho for estranho. */
function cingFone_(s) {
  var d = cingSoDigitos_(s);
  if (d.length >= 12 && d.substring(0, 2) === "55") d = d.substring(2);
  if (d.length !== 10 && d.length !== 11) return "";
  if (Number(d.substring(0, 2)) < 11) return "";
  if (d.length === 11 && d.charAt(2) !== "9") return "";
  return "55" + d;
}

function cingNomeChave_(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cingCategoria_(s) {
  var c = cingNomeChave_(s);
  if (!c) return "";
  if (c === "convidado" || c === "convidada") return "convite";
  if (c === "acompanhante de associado" || c === "acompanhante associado") return "acompanhante";
  for (var i = 0; i < CING_CATEGORIAS.length; i++) {
    if (c === CING_CATEGORIAS[i].valor || c === cingNomeChave_(CING_CATEGORIAS[i].rotulo)) return CING_CATEGORIAS[i].valor;
  }
  return "";
}

function cingRotuloCategoria_(valor) {
  for (var i = 0; i < CING_CATEGORIAS.length; i++) if (CING_CATEGORIAS[i].valor === valor) return CING_CATEGORIAS[i].rotulo;
  return String(valor || "");
}

/** A base que o robô deixou no Drive. null se ainda não existe. */
function cingLerBase_() {
  var pastas = DriveApp.getFoldersByName(CING_PASTA);
  if (!pastas.hasNext()) return null;
  var arqs = pastas.next().getFilesByName(CING_ARQ);
  if (!arqs.hasNext()) return null;
  var doc = JSON.parse(arqs.next().getBlob().getDataAsString());
  doc.linhas = (doc.linhas || []).map(function (l) {
    return { nome: String(l.nome || ""), cpf: cingSoDigitos_(l.cpf), tel: String(l.tel || ""), codigo: String(l.codigo || ""),
             tipo: String(l.tipo || ""), escola: String(l.escola || ""), cidade: String(l.cidade || ""), ref: String(l.ref || ""), zap: Number(l.zap || 0) };
  });
  return doc;
}

/** nome (sem acento, minúsculo) → link do PDF na pasta do Drive. Sem a pasta, devolve {} e a tela usa o link do TickOne. */
function cingPdfs_() {
  var out = {};
  try {
    var it = DriveApp.getFolderById(CING_PASTA_PDF_ID).getFiles();
    while (it.hasNext()) {
      var f = it.next(), nome = f.getName();
      if (!/\.pdf$/i.test(nome)) continue;
      var k = cingNomeChave_(nome.replace(/\.pdf$/i, "").replace(/^TickOne\s*-\s*/i, ""));
      if (k) out[k] = "https://drive.google.com/file/d/" + f.getId() + "/view";
    }
  } catch (e) { /* pasta fora do alcance: segue sem os links do Drive */ }
  return out;
}

function cingIdadeMin_(lidoEm) {
  var t = new Date(lidoEm).getTime();
  return isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}

function cingAbaEnvios_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CING_ABA_ENVIOS);
  if (!sh) { sh = ss.insertSheet(CING_ABA_ENVIOS); sh.getRange(1, 1, 1, CING_COLUNAS_ENVIOS.length).setValues([CING_COLUNAS_ENVIOS]); }
  return sh;
}

/** codigo → { quando, quem } do último envio registrado no SISGEP. */
function cingEnvios_() {
  var sh = cingAbaEnvios_(), out = {};
  if (sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, CING_COLUNAS_ENVIOS.length).getValues().forEach(function (l) {
    var q = l[4] instanceof Date ? Utilities.formatDate(l[4], "America/Sao_Paulo", "dd/MM HH:mm") : String(l[4] || "");
    out[String(l[0])] = { quando: q, quem: String(l[5] || ""), vezes: ((out[String(l[0])] || {}).vezes || 0) + 1 };
  });
  return out;
}

function cingQuem_(sessao) { return String((sessao && (sessao.nome || sessao.email || sessao.usuario)) || ""); }

/** O quadro da tela: como está a base e quanto já foi enviado. */
function compassoIngressos_estado(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var base = cingLerBase_();
    var cats = CING_CATEGORIAS.map(function (c) { return { valor: c.valor, rotulo: c.rotulo }; });
    if (!base) return { ok: true, existe: false, categorias: cats, idadeMaxMin: CING_IDADE_MAX_MIN,
      mensagem: "A base do TickOne ainda não foi lida pelo robô." };
    var porTipo = {}, envios = cingEnvios_(), enviados = 0;
    base.linhas.forEach(function (l) {
      var k = cingCategoria_(l.tipo) || l.tipo;
      porTipo[k] = (porTipo[k] || 0) + 1;
      if (envios[l.codigo]) enviados++;
    });
    return { ok: true, existe: true, lidoEm: base.lidoEm, idadeMin: cingIdadeMin_(base.lidoEm), idadeMaxMin: CING_IDADE_MAX_MIN,
      evento: base.evento || "", total: base.linhas.length, porTipo: porTipo, enviados: enviados, categorias: cats };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Todos os ingressos da base, com a situação do envio. CPF sempre mascarado. */
function compassoIngressos_lista(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var base = cingLerBase_();
    if (!base) return { ok: false, mensagem: "A base do TickOne ainda não foi lida pelo robô." };
    cingSincronizarResultado_();
    var envios = cingEnvios_(), pdfs = cingPdfs_(), excl = cingExclusaoPorCodigo_();
    var linhas = base.linhas.map(function (l) {
      var fone = cingFone_(l.tel), e = envios[l.codigo] || null;
      var falta = [];
      if (cingCategoria_(l.tipo) === "associado") {   // a base do TickOne não traz e-mail: só confere o que ela traz
        if (!l.nome) falta.push("nome"); if (!cingCpfValido_(l.cpf)) falta.push("CPF válido");
        if (!fone) falta.push("telefone com DDD"); if (!l.escola) falta.push("nome da escola"); if (!l.cidade) falta.push("cidade");
      }
      var ex = excl[l.codigo], exOk = ex && (ex.STATUS === "PEDIDO" || ex.STATUS === "EXCLUIDO" || ex.STATUS === "FALHOU" || ex.STATUS === "JA_ENTROU");
      return { exclusao: exOk ? { pedido: String(ex.PEDIDO), status: String(ex.STATUS), quem: String(ex.PEDIDO_POR || ""), quando: cingFmtData_(ex.PEDIDO_EM), resultado: String(ex.RESULTADO || "") } : null,
        nome: l.nome, faltando: falta, cpf: cingCpfMascara_(l.cpf), tel: l.tel, foneOk: !!fone, codigo: l.codigo,
        categoria: cingCategoria_(l.tipo) || "", tipo: l.tipo, escola: l.escola, cidade: l.cidade,
        ref: l.ref, pdfDrive: pdfs[cingNomeChave_(l.nome)] || "", urlIngresso: l.ref ? CING_URL_TICKET + encodeURIComponent(l.ref) : "",
        enviadoTick: l.zap, enviado: e ? { quando: e.quando, quem: e.quem, vezes: e.vezes } : null };
    });
    return { ok: true, lidoEm: base.lidoEm, idadeMin: cingIdadeMin_(base.lidoEm), linhas: linhas };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** A mensagem e o link do WhatsApp daquela pessoa. Não envia nada. */
function compassoIngressos_mensagem(codigo, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var base = cingLerBase_();
    var l = base && base.linhas.filter(function (x) { return x.codigo === String(codigo); })[0];
    if (!l) return { ok: false, mensagem: "Ingresso não encontrado na base." };
    var fone = cingFone_(l.tel);
    if (!fone) return { ok: false, mensagem: "Telefone de " + l.nome + " sem DDD ou com tamanho errado. Corrija no TickOne e leia a base de novo." };
    var texto = compasso_textoEntrega_({ nome: l.nome, numero: l.codigo }, "");
    return { ok: true, fone: fone, texto: texto, url: "https://wa.me/" + fone + "?text=" + encodeURIComponent(texto) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Só depois de a pessoa dizer que enviou. Fica a data e quem enviou. */
function compassoIngressos_registrarEnvio(codigo, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "eventos", false);
    var base = cingLerBase_();
    var l = base && base.linhas.filter(function (x) { return x.codigo === String(codigo); })[0];
    if (!l) return { ok: false, mensagem: "Ingresso não encontrado na base." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está registrando agora. Tente de novo." };
    try {
      cingAbaEnvios_().appendRow([l.codigo, l.nome, cingFone_(l.tel), "WhatsApp", new Date(), cingQuem_(sessao)]);
    } finally { lock.releaseLock(); }
    var e = cingEnvios_()[l.codigo];
    return { ok: true, enviado: { quando: e.quando, quem: e.quem, vezes: e.vezes } };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/**
 * PESQUISAR ANTES DE SOLICITAR. Recebe a lista (planilha ou pessoa a pessoa) e,
 * para cada linha, diz se é NOVO, se JÁ TEM ingresso (com o código) ou se precisa
 * de CONFERÊNCIA (CPF inválido, telefone sem DDD, categoria inválida, nome ou CPF
 * repetido). Não emite nada. emissaoLiberada só fica true se a base for recente.
 */
function compassoIngressos_conferir(lista, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var base = cingLerBase_();
    if (!base) return { ok: false, mensagem: "A base do TickOne ainda não foi lida pelo robô. Sem ela não dá para conferir quem já tem ingresso." };
    lista = Array.isArray(lista) ? lista.slice(0, 600) : [];
    var porCpf = {}, porNome = {};
    base.linhas.forEach(function (l) {
      if (l.cpf) porCpf[l.cpf] = l;
      var k = cingNomeChave_(l.nome);
      if (k) (porNome[k] = porNome[k] || []).push(l);
    });
    var vistos = {}, idade = cingIdadeMin_(base.lidoEm), res = [];
    lista.forEach(function (it, i) {
      it = it || {};
      var nome = String(it.nome || "").trim().substring(0, 120), cpf = cingSoDigitos_(it.cpf);
      var cat = cingCategoria_(it.categoria || it.tipo), motivos = [], fone = cingFone_(it.telefone), foneOrigem = "";
      var o = { i: i, nome: nome, cpf: cpf, cpfMascara: cingCpfMascara_(cpf), telefone: fone, telefoneDigitado: String(it.telefone || ""),
                email: String(it.email || "").trim().substring(0, 120), escola: String(it.escola || "").trim().substring(0, 120),
                cidade: String(it.cidade || "").trim().substring(0, 80), categoria: cat, situacao: "novo", motivos: motivos };
      var achado = cingCpfValido_(cpf) ? porCpf[cpf] : null;
      var avisos = o.avisos = [], assoc = (cat === "associado");
      if (!cat) motivos.push("Categoria inválida (use: " + CING_CATEGORIAS.map(function (c) { return c.rotulo; }).join(", ") + ").");
      if (!assoc) {
        if (!nome) motivos.push("Falta o nome.");
        if (!cingCpfValido_(cpf)) motivos.push("CPF inválido ou ausente.");
      }
      if (cingCpfValido_(cpf)) {
        if (vistos[cpf] != null) motivos.push("CPF repetido na lista (linha " + (vistos[cpf] + 1) + ").");
        else vistos[cpf] = i;
      }
      if (achado) {
        o.situacao = "ja_tem"; o.codigo = achado.codigo; o.tipoNaBase = achado.tipo; o.ref = achado.ref;
        o.urlIngresso = achado.ref ? CING_URL_TICKET + encodeURIComponent(achado.ref) : "";
        if (!fone && cingFone_(achado.tel)) { o.telefone = cingFone_(achado.tel); foneOrigem = "telefone da base do ingresso"; }
      } else {
        var mesmoNome = nome ? (porNome[cingNomeChave_(nome)] || []) : [];
        if (mesmoNome.length) {
          o.situacao = "conferir";
          motivos.push("Já existe ingresso com este nome na base (código " + mesmoNome[0].codigo + "), mas com outro CPF. Confira se é a mesma pessoa.");
        }
      }
      if (assoc && o.situacao !== "ja_tem") {
        // ASSOCIADO: todos os campos. Diz QUEM é e O QUE falta, numa frase só (usuário, 14/11/2026).
        var falta = [];
        if (!nome) falta.push("nome");
        if (!cingCpfValido_(cpf)) falta.push(cpf ? "CPF válido" : "CPF");
        if (!o.telefone) falta.push(o.telefoneDigitado ? "telefone com DDD (o digitado não serve para o WhatsApp)" : "telefone com DDD");
        if (!o.email) falta.push("e-mail");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) falta.push("e-mail válido");
        if (!o.escola) falta.push("nome da escola");
        if (!o.cidade) falta.push("cidade");
        if (falta.length) { o.faltando = falta; motivos.push("Associado " + (nome || "(sem nome)") + ": está faltando " + falta.join(", ") + "."); }
      } else if (!o.telefone && o.situacao !== "ja_tem") {
        avisos.push(o.telefoneDigitado ? "Telefone sem DDD ou inválido: não dá para enviar pelo WhatsApp." : "Sem telefone: não dá para enviar pelo WhatsApp.");
      }
      if (o.situacao === "novo" && motivos.length) o.situacao = "conferir";
      if (foneOrigem) o.telefoneOrigem = foneOrigem;
      res.push(o);
    });
    var cont = { novo: 0, ja_tem: 0, conferir: 0 };
    res.forEach(function (r) { cont[r.situacao]++; });
    var faltas = res.filter(function (r) { return r.faltando && r.faltando.length; })
      .map(function (r) { return "Associado " + (r.nome || "(sem nome)") + ": está faltando " + r.faltando.join(", ") + "."; });
    var recente = idade != null && idade <= CING_IDADE_MAX_MIN;
    return { ok: true, resultados: res, contagem: cont, faltasAssociado: faltas, lidoEm: base.lidoEm, idadeMin: idade, baseRecente: recente,
      emissaoLiberada: recente && cont.conferir === 0 && cont.novo > 0,
      emissaoMotivo: !recente ? "A base do TickOne está com mais de " + CING_IDADE_MAX_MIN + " minutos: leia de novo antes de pedir (a pesquisa antes de pedir precisa ser recente)."
        : (cont.conferir > 0 ? "Corrija as linhas em 'Conferir' antes de pedir a emissão."
        : (cont.novo === 0 ? "Ninguém novo para emitir: todos já têm ingresso." : "Pronto: " + cont.novo + " novo(s) podem ser pedidos. Isto cria ingresso de verdade no TickOne.")) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}


/* ================= EXCLUSÃO DE INGRESSO (fila para o robô) ================= */

function cingAbaExcl_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CING_ABA_EXCL);
  if (!sh) { sh = ss.insertSheet(CING_ABA_EXCL); sh.getRange(1, 1, 1, CING_COLUNAS_EXCL.length).setValues([CING_COLUNAS_EXCL]); }
  return sh;
}

function cingExclusoes_() {
  var sh = cingAbaExcl_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CING_COLUNAS_EXCL.length).getValues().map(function (l, i) {
    var o = { _linha: i + 2 };
    CING_COLUNAS_EXCL.forEach(function (c, k) { o[c] = l[k]; });
    return o;
  }).filter(function (o) { return o.PEDIDO; });
}

function cingFmtData_(v) { return v instanceof Date ? Utilities.formatDate(v, "America/Sao_Paulo", "dd/MM HH:mm") : String(v || ""); }

function cingPastaRobo_() {
  var it = DriveApp.getFoldersByName(CING_PASTA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CING_PASTA);
}

function cingGravarArquivo_(pasta, nome, texto) {
  var it = pasta.getFilesByName(nome);
  if (it.hasNext()) it.next().setContent(texto); else pasta.createFile(nome, texto, "application/json");
}

/** A fila que o robô lê: só os pedidos ainda abertos. */
function cingPublicarFila_() {
  var fila = cingExclusoes_().filter(function (o) { return o.STATUS === "PEDIDO"; }).map(function (o) {
    return { pedido: String(o.PEDIDO), codigo: String(o.CODIGO), cpf: cingSoDigitos_(o.CPF), nome: String(o.NOME) };
  });
  cingGravarArquivo_(cingPastaRobo_(), CING_ARQ_FILA, JSON.stringify({ atualizadoEm: new Date().toISOString(), itens: fila }));
  return fila.length;
}

/** Aplica o que o robô devolveu (excluído, falhou, já entrou) nos pedidos abertos. */
function cingSincronizarResultado_() {
  try {
    var it = cingPastaRobo_().getFilesByName(CING_ARQ_RESULTADO);
    if (!it.hasNext()) return 0;
    var res = JSON.parse(it.next().getBlob().getDataAsString()), porPedido = {};
    (res.itens || []).forEach(function (r) { porPedido[String(r.pedido)] = r; });
    var sh = cingAbaExcl_(), n = 0, iStatus = CING_COLUNAS_EXCL.indexOf("STATUS") + 1;
    cingExclusoes_().forEach(function (o) {
      var r = porPedido[String(o.PEDIDO)];
      if (o.STATUS !== "PEDIDO" || !r || ["EXCLUIDO", "FALHOU", "JA_ENTROU"].indexOf(r.status) < 0) return;
      sh.getRange(o._linha, iStatus, 1, 3).setValues([[r.status, String(r.detalhe || "").substring(0, 200), r.em ? new Date(r.em) : new Date()]]);
      n++;
    });
    return n;
  } catch (e) { return 0; }
}

/** O pedido mais recente de cada ingresso (codigo → pedido). */
function cingExclusaoPorCodigo_() {
  var m = {};
  cingExclusoes_().forEach(function (o) { m[String(o.CODIGO)] = o; });
  return m;
}

function compassoIngressos_pedirExclusao(codigo, motivo, confirmado, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "eventos", true);
    if (confirmado !== true) return { ok: false, mensagem: "Confirme que entende que a exclusão no TickOne não tem volta." };
    var base = cingLerBase_();
    var l = base && base.linhas.filter(function (x) { return x.codigo === String(codigo); })[0];
    if (!l) return { ok: false, mensagem: "Ingresso não encontrado na base do TickOne (talvez já tenha sido excluído)." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está mexendo nas exclusões agora. Tente de novo." };
    try {
      var atual = cingExclusaoPorCodigo_()[l.codigo];
      if (atual && (atual.STATUS === "PEDIDO" || atual.STATUS === "EXCLUIDO")) return { ok: false, mensagem: "Este ingresso já tem pedido de exclusão (" + String(atual.STATUS).toLowerCase() + ")." };
      var id = "X" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + l.codigo;
      cingAbaExcl_().appendRow([id, l.codigo, l.nome, l.cpf, l.tipo, l.escola, l.cidade, l.tel,
        String(motivo || "").trim().substring(0, 200), new Date(), cingQuem_(sessao), "PEDIDO", "", ""]);
      var abertos = cingPublicarFila_();
      return { ok: true, pedido: id, abertos: abertos, mensagem: "Pedido de exclusão registrado. O robô exclui no TickOne quando for acionado." };
    } finally { lock.releaseLock(); }
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function compassoIngressos_cancelarPedidoExclusao(pedido, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", true);
    var o = cingExclusoes_().filter(function (x) { return String(x.PEDIDO) === String(pedido); })[0];
    if (!o) return { ok: false, mensagem: "Pedido não encontrado." };
    if (o.STATUS !== "PEDIDO") return { ok: false, mensagem: "Este pedido já foi tratado (" + String(o.STATUS).toLowerCase() + ") e não dá mais para cancelar." };
    cingAbaExcl_().getRange(o._linha, CING_COLUNAS_EXCL.indexOf("STATUS") + 1).setValue("CANCELADO");
    cingPublicarFila_();
    return { ok: true, mensagem: "Pedido cancelado. Nada foi excluído." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

/** Para a tela: os pedidos (mais novos primeiro). */
function compassoIngressos_exclusoes(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    cingSincronizarResultado_();
    var lista = cingExclusoes_().reverse().map(function (o) {
      return { pedido: String(o.PEDIDO), codigo: String(o.CODIGO), nome: String(o.NOME), motivo: String(o.MOTIVO || ""),
        status: String(o.STATUS), resultado: String(o.RESULTADO || ""), pedidoEm: cingFmtData_(o.PEDIDO_EM), pedidoPor: String(o.PEDIDO_POR || ""),
        executadoEm: cingFmtData_(o.EXECUTADO_EM) };
    });
    return { ok: true, exclusoes: lista };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}


/* ================= EMISSÃO DE INGRESSO (fila para o robô) ================= */

function cingAbaEmis_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CING_ABA_EMIS);
  if (!sh) { sh = ss.insertSheet(CING_ABA_EMIS); sh.getRange(1, 1, 1, CING_COLUNAS_EMIS.length).setValues([CING_COLUNAS_EMIS]); }
  return sh;
}

function cingEmissoes_() {
  var sh = cingAbaEmis_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CING_COLUNAS_EMIS.length).getValues().map(function (l, i) {
    var o = { _linha: i + 2 };
    CING_COLUNAS_EMIS.forEach(function (c, k) { o[c] = l[k]; });
    return o;
  }).filter(function (o) { return o.PEDIDO; });
}

function cingPublicarFilaEmissao_() {
  var fila = cingEmissoes_().filter(function (o) { return o.STATUS === "PEDIDO"; }).map(function (o) {
    return { pedido: String(o.PEDIDO), nome: String(o.NOME), cpf: cingSoDigitos_(o.CPF), email: String(o.EMAIL || ""), telefone: String(o.TELEFONE || ""),
             cidade: String(o.CIDADE || ""), escola: String(o.ESCOLA || ""), categoria: String(o.CATEGORIA) };
  });
  cingGravarArquivo_(cingPastaRobo_(), CING_ARQ_FILA_EMIS, JSON.stringify({ atualizadoEm: new Date().toISOString(), itens: fila }));
  return fila.length;
}

function cingSincronizarEmissoes_() {
  try {
    var it = cingPastaRobo_().getFilesByName(CING_ARQ_RES_EMIS);
    if (!it.hasNext()) return 0;
    var res = JSON.parse(it.next().getBlob().getDataAsString()), por = {};
    (res.itens || []).forEach(function (r) { por[String(r.pedido)] = r; });
    var sh = cingAbaEmis_(), n = 0, iSt = CING_COLUNAS_EMIS.indexOf("STATUS") + 1;
    cingEmissoes_().forEach(function (o) {
      var r = por[String(o.PEDIDO)];
      if (o.STATUS !== "PEDIDO" || !r || ["EMITIDO", "FALHOU"].indexOf(r.status) < 0) return;
      sh.getRange(o._linha, iSt, 1, 4).setValues([[r.status, String(r.codigo || ""), String(r.detalhe || "").substring(0, 200), r.em ? new Date(r.em) : new Date()]]);
      n++;
    });
    return n;
  } catch (e) { return 0; }
}

/** Pede a emissão dos NOVOS da lista. Refaz a conferência aqui (pesquisar antes) e só aceita se estiver tudo certo. */
function compassoIngressos_pedirEmissao(lista, confirmado, tokenSessao) {
  try {
    var sessao = exigirModulo_(tokenSessao, "eventos", true);
    if (confirmado !== true) return { ok: false, mensagem: "Confirme que entende que isto cria ingresso de verdade no TickOne." };
    var cf = compassoIngressos_conferir(lista, tokenSessao);
    if (!cf.ok) return cf;
    if (!cf.emissaoLiberada) return { ok: false, mensagem: cf.emissaoMotivo };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está pedindo emissão agora. Tente de novo." };
    try {
      var abertos = {};
      cingEmissoes_().forEach(function (o) { if (o.STATUS === "PEDIDO") abertos[cingSoDigitos_(o.CPF)] = true; });
      var sh = cingAbaEmis_(), n = 0, quem = cingQuem_(sessao), agora = new Date();
      cf.resultados.forEach(function (r, i) {
        if (r.situacao !== "novo" || abertos[r.cpf]) return;
        var id = "E" + Utilities.formatDate(agora, "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + (i + 1);
        sh.appendRow([id, r.nome, r.cpf, r.email, r.telefone || r.telefoneDigitado, r.cidade, r.escola, r.categoria, agora, quem, "PEDIDO", "", "", ""]);
        n++;
      });
      if (!n) return { ok: false, mensagem: "Estes já estão na fila de emissão." };
      return { ok: true, pedidos: n, naFila: cingPublicarFilaEmissao_(), mensagem: n + " pedido(s) de emissão registrado(s). O robô emite no TickOne quando for acionado." };
    } finally { lock.releaseLock(); }
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function compassoIngressos_cancelarPedidoEmissao(pedido, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", true);
    var o = cingEmissoes_().filter(function (x) { return String(x.PEDIDO) === String(pedido); })[0];
    if (!o) return { ok: false, mensagem: "Pedido não encontrado." };
    if (o.STATUS !== "PEDIDO") return { ok: false, mensagem: "Este pedido já foi tratado (" + String(o.STATUS).toLowerCase() + ")." };
    cingAbaEmis_().getRange(o._linha, CING_COLUNAS_EMIS.indexOf("STATUS") + 1).setValue("CANCELADO");
    cingPublicarFilaEmissao_();
    return { ok: true, mensagem: "Pedido cancelado. Nada foi emitido." };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}

function compassoIngressos_emissoes(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    cingSincronizarEmissoes_();
    return { ok: true, emissoes: cingEmissoes_().reverse().slice(0, 50).map(function (o) {
      return { pedido: String(o.PEDIDO), nome: String(o.NOME), categoria: String(o.CATEGORIA), status: String(o.STATUS), codigo: String(o.CODIGO || ""),
        resultado: String(o.RESULTADO || ""), pedidoEm: cingFmtData_(o.PEDIDO_EM), pedidoPor: String(o.PEDIDO_POR || "") };
    }) };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}
