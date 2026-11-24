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

/** CPF lido de célula de planilha: o Sheets trata como número e come o zero da frente (085... → 8538104780). Completa até 11. */
function cingCpf11_(s) { var d = cingSoDigitos_(s); return (d.length >= 9 && d.length < 11) ? ("00000000000" + d).slice(-11) : d; }

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

/* DDD PELA CIDADE (16/11/2026). O telefone de alguns ingressos veio do TickOne sem DDD (ex.: 99606-9084). O usuário: "tem que
   verificar a cidade". Só se deduz o DDD quando a CIDADE é do Espírito Santo e o DDD dela é certo: 27 (Grande Vitória, centro e
   norte) ou 28 (sul do estado). Cidade fora dessa lista, ou de DDD duvidoso, NÃO é deduzida: o botão continua travado e a tela
   diz por quê. A dedução é SUGESTÃO com a origem à vista ("DDD 27 assumido pela cidade"), nunca em silêncio. */
var CING_DDD_27 = "vitoria|vila velha|serra|cariacica|viana|guarapari|fundao|santa leopoldina|santa maria de jetiba|santa teresa|domingos martins|marechal floriano|aracruz|ibiracu|joao neiva|linhares|colatina|sao mateus|nova venecia|barra de sao francisco|sao gabriel da palha|baixo guandu|afonso claudio|itaguacu|itarana|laranja da terra|conceicao da barra|pedro canario|pinheiros|jaguare|sooretama|rio bananal|marilandia|pancas|governador lindenberg|vila valerio|vila pavao|boa esperanca|montanha|mucurici|ponto belo|ecoporanga|agua doce do norte|aguia branca|alto rio novo|mantenopolis|sao domingos do norte|sao roque do canaa";
var CING_DDD_28 = "cachoeiro de itapemirim|itapemirim|marataizes|piuma|anchieta|iconha|rio novo do sul|mimoso do sul|muqui|castelo|alegre|guacui|jeronimo monteiro|presidente kennedy|atilio vivacqua|apiaca|bom jesus do norte|sao jose do calcado";

/** "27", "28" ou "" (cidade desconhecida, de outro estado ou de DDD duvidoso). */
function cingDddPorCidade_(cidade) {
  var k = cingNomeChave_(cidade).replace(/\s*[-\/,]\s*(es|espirito santo)\s*$/, "").replace(/\s+/g, " ").trim();
  if (!k) return "";
  if (("|" + CING_DDD_27 + "|").indexOf("|" + k + "|") >= 0) return "27";
  if (("|" + CING_DDD_28 + "|").indexOf("|" + k + "|") >= 0) return "28";
  return "";
}

/** Telefone de 9 dígitos (celular sem DDD) + cidade conhecida → { fone: "55DDDnúmero", ddd }. Senão null. */
function cingFoneAssumido_(tel, cidade) {
  var d = cingSoDigitos_(tel);
  if (d.length !== 9 || d.charAt(0) !== "9") return null;
  var ddd = cingDddPorCidade_(cidade);
  return ddd ? { fone: "55" + ddd + d, ddd: ddd } : null;
}

/** O TEXTO DO WHATSAPP DO INGRESSO (16/11/2026). O usuário colou o texto padrão que quer: título "Festa No Compasso da Vida 2026",
 *  bloco "Na entrada, apresente", data/horário/portões/local em linhas próprias, "Acesse ou baixe seu ingresso" com o link do PDF,
 *  "Importante" e o fecho. Data, horários, local, endereço e referência vêm do CADASTRO da festa (compasso_dadosDaFesta_); a
 *  linha sem dado não aparece. Sem PDF na pasta, a seção do link não entra (a pessoa anexa o PDF). O texto antigo
 *  (compasso_textoEntrega_) fica só para o e-mail. */
/** Frase de abertura do WhatsApp conforme a categoria (decisão do usuário, 16/11/2026): associado/pago = inscrição confirmada;
 *  acompanhante e convidado (convite/cortesia) têm a sua própria frase. O resto da mensagem é igual para todos. */
var CING_ABERTURA_MARCA = "ZZABERTURAZZ";
function cingAbertura_(cat) {
  var c = String(cat || "");
  if (c === "acompanhante") return "Seu ingresso como acompanhante na *Festa No Compasso da Vida 2026* já está pronto! 🎟️";
  if (c === "convite" || c === "cortesia") return "Você é nosso convidado na *Festa No Compasso da Vida 2026*, e seu ingresso já está pronto! 🎟️";
  return "Sua inscrição na *Festa No Compasso da Vida 2026* foi confirmada, e seu ingresso já está pronto! 🎟️";
}
/** categoria "ZZ" = modelo com a marca no lugar da frase (a tela troca pela frase da categoria de cada pessoa). */
function cingTextoWhats_(nome, pdf, categoria) {
  var f = {}; try { f = compasso_dadosDaFesta_() || {}; } catch (e) { f = {}; }
  var quando = ""; try { quando = compasso_dataPorExtenso_(f.data); } catch (e) { quando = ""; }
  quando = quando ? quando.charAt(0).toUpperCase() + quando.slice(1) : "";
  var n = String(nome || "").trim().split(/\s+/)[0] || ""; n = n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
  var l = [];
  l.push("Olá" + (n ? ", *" + n + "*" : "") + "! 🎉"); l.push("");
  l.push(categoria === "ZZ" ? CING_ABERTURA_MARCA : cingAbertura_(categoria)); l.push("");
  l.push("*Na entrada, apresente:*");
  l.push("✅ O QR Code do ingresso em PDF (na tela do celular ou impresso);");
  l.push("✅ Um *documento oficial com foto* (RG, CNH ou outro), para conferência."); l.push("");
  if (quando) { l.push("📅 *Data:* " + quando); l.push(""); }
  if (f.horaInicio) { l.push("🕗 *Horário:* " + f.horaInicio); l.push(""); }
  if (f.horaAbertura) { l.push("🚪 *Abertura dos portões:* " + f.horaAbertura); l.push(""); }
  if (f.local) {
    l.push("📍 *Local:* " + f.local);
    if (f.endereco) l.push(f.endereco);
    if (f.referencia) l.push("(" + String(f.referencia).replace(/\.$/, "") + ")");
    l.push("");
  }
  l.push("📄 *Seu ingresso com QR Code está disponível em PDF.* Guarde o arquivo no celular para apresentar na entrada."); l.push("");
  if (pdf) { l.push("🔗 *Acesse ou baixe seu ingresso:*"); l.push(pdf); l.push(""); }
  l.push("⚠️ *Importante:* O ingresso é pessoal e válido para apenas uma entrada. Não compartilhe o arquivo com outras pessoas."); l.push("");
  l.push("Esperamos você para uma noite especial de celebração! 🎶🥳"); l.push("");
  l.push("*SindEducação-ES*");
  return l.join("\n");
}

/** Endereço do app publicado (…/exec) — onde mora a página do cartão do ingresso. Vazio fora do app publicado. */
/** DESLIGADO em 16/11/2026: o endereço do aplicativo (script.google.com/macros/s/…/exec) abriu a tela de erro do Drive ("Não foi possível
 *  abrir o arquivo") para quem clicou, então a mensagem leva o link DIRETO do PDF (aberto a qualquer pessoa, ArquivoDrive.gs). A página
 *  do cartão (CompassoIngressoCartao.gs) continua no ar; para voltar a usá-la no WhatsApp, troque para true DEPOIS de abrir o link do
 *  cartão numa janela anônima e ver a página (não a tela de erro). */
var CING_USAR_CARTAO = false;
function cingCartaoBase_() { if (!CING_USAR_CARTAO) return ""; try { return String(ScriptApp.getService().getUrl() || ""); } catch (e) { return ""; } }

function cingNomeChave_(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cingCategoria_(s) {
  var c = cingNomeChave_(s);
  if (!c) return "";
  if (c === "convidado" || c === "convidada") return "convite";
  /* A TickOne escreve "Acompanhante do Associado" (visto na tela em 18/11/2026): qualquer rótulo que COMECE por "acompanhante" é acompanhante.
     Sem isso o ingresso ficava sem categoria: o PDF ia para a pasta principal e a mensagem saía com a frase de associado. */
  if (/^acompanhante/.test(c)) return "acompanhante";
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
  var arqs = cingPastaRobo_().getFilesByName(CING_ARQ);
  if (!arqs.hasNext()) return null;
  var doc = JSON.parse(arqs.next().getBlob().getDataAsString());
  doc.linhas = (doc.linhas || []).map(function (l) {
    return { nome: String(l.nome || ""), cpf: cingSoDigitos_(l.cpf), tel: String(l.tel || ""), codigo: String(l.codigo || ""),
             tipo: String(l.tipo || ""), escola: String(l.escola || ""), cidade: String(l.cidade || ""), ref: String(l.ref || ""), zap: Number(l.zap || 0) };
  });
  return doc;
}

/** nome (sem acento, minúsculo) → link do PDF na pasta do Drive. Sem a pasta, devolve {} e a tela usa o link do TickOne. */
/** Subpastas da pasta INGRESSOS FESTA COMPASSO 2026, por categoria do ingresso (a equipe as criou em 16/11/2026: "cada pasta com seu
 *  ingresso"). Pago não tem subpasta: fica na raiz. */
var CING_SUBPASTAS = { associado: "INGRESSOS ASSOCIADOS", acompanhante: "INGRESSOS ACOMPANHANTES", convite: "INGRESSOS CONVIDADOS", cortesia: "INGRESSOS CONVIDADOS" };

/** Todos os PDFs da pasta dos ingressos E das subpastas (até 2 níveis): { "TickOne - Nome.pdf": idDoArquivo }. */
function cingPdfsDaPasta_() {
  var out = {};
  function varrer(pasta, nivel) {
    var it = pasta.getFiles();
    while (it.hasNext()) { var f = it.next(), nm = f.getName(); if (/\.pdf$/i.test(nm) && !out[nm]) out[nm] = f.getId(); }
    if (nivel >= 2) return;
    var sub = pasta.getFolders();
    while (sub.hasNext()) varrer(sub.next(), nivel + 1);
  }
  varrer(DriveApp.getFolderById(CING_PASTA_PDF_ID), 0);
  return out;
}

function cingPdfs_() {
  var chave = "CING_PDFS_V2";
  try { var c = CacheService.getScriptCache().get(chave); if (c) return JSON.parse(c); } catch (eC) {}
  var out = {};
  try {
    var todos = cingPdfsDaPasta_();
    Object.keys(todos).forEach(function (nome) {
      var k = cingNomeChave_(nome.replace(/\.pdf$/i, "").replace(/^TickOne\s*-\s*/i, ""));
      if (k) out[k] = "https://drive.google.com/file/d/" + todos[nome] + "/view";
    });
  } catch (e) { /* pasta fora do alcance: segue sem os links do Drive */ }
  try { var txt = JSON.stringify(out); if (txt.length < 90000) CacheService.getScriptCache().put(chave, txt, 300); } catch (eP) {}
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
    out[String(l[0])] = { quando: q, quem: String(l[5] || ""), vezes: ((out[String(l[0])] || {}).vezes || 0) + 1, tempo: (l[4] instanceof Date) ? l[4].getTime() : 0 };
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
    var modelo = "", modeloPdf = "";   // O TEXTO PADRÃO do WhatsApp (cingTextoWhats_), montado NA TELA para abrir a conversa no mesmo toque
    try { modelo = cingTextoWhats_("ZZNOMEZZ", "", "ZZ"); modeloPdf = cingTextoWhats_("ZZNOMEZZ", "ZZPDFZZ", "ZZ"); } catch (eM) { modelo = ""; modeloPdf = ""; }
    var linhas = base.linhas.map(function (l) {
      var fone = cingFone_(l.tel), e = envios[l.codigo] || null, assumido = null;
      if (!fone) { assumido = cingFoneAssumido_(l.tel, l.cidade); if (assumido) fone = assumido.fone; }
      var falta = [];
      if (cingCategoria_(l.tipo) === "associado") {   // a base do TickOne não traz e-mail: só confere o que ela traz
        if (!l.nome) falta.push("nome"); if (!cingCpfValido_(l.cpf)) falta.push("CPF válido");
        if (!fone) falta.push("telefone com DDD");   // com DDD deduzido pela cidade, o telefone passa a servir (aparece o aviso "DDD assumido") if (!l.escola) falta.push("nome da escola"); if (!l.cidade) falta.push("cidade");
      }
      var ex = excl[l.codigo], exOk = ex && (ex.STATUS === "PEDIDO" || ex.STATUS === "EXCLUIDO" || ex.STATUS === "FALHOU" || ex.STATUS === "JA_ENTROU");
      return { exclusao: exOk ? { pedido: String(ex.PEDIDO), status: String(ex.STATUS), quem: String(ex.PEDIDO_POR || ""), quando: cingFmtData_(ex.PEDIDO_EM), resultado: String(ex.RESULTADO || "") } : null,
        nome: l.nome, faltando: falta, cpf: cingCpfMascara_(l.cpf), tel: l.tel, foneOk: !!fone, fone: fone, foneAssumido: assumido ? assumido.ddd : "", codigo: l.codigo,
        categoria: cingCategoria_(l.tipo) || "", tipo: l.tipo, escola: l.escola, cidade: l.cidade,
        ref: l.ref, pdfDrive: pdfs[cingNomeChave_(l.nome)] || "", urlIngresso: l.ref ? CING_URL_TICKET + encodeURIComponent(l.ref) : "",
        enviadoTick: l.zap, enviado: e ? { quando: e.quando, quem: e.quem, vezes: e.vezes } : null };
    });
    return { ok: true, lidoEm: base.lidoEm, idadeMin: cingIdadeMin_(base.lidoEm), modelo: modelo, modeloPdf: modeloPdf, aberturas: { associado: cingAbertura_("associado"), acompanhante: cingAbertura_("acompanhante"), convite: cingAbertura_("convite"), cortesia: cingAbertura_("cortesia"), pago: cingAbertura_("pago") }, cartaoBase: cingCartaoBase_(), linhas: linhas };
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
    if (!fone) { var as2 = cingFoneAssumido_(l.tel, l.cidade); if (as2) fone = as2.fone; }
    if (!fone) return { ok: false, mensagem: "Telefone de " + l.nome + " sem DDD ou com tamanho errado" + (cingSoDigitos_(l.tel).length === 9 ? " e a cidade (" + (l.cidade || "em branco") + ") não permite deduzir o DDD" : "") + ". Corrija no TickOne e leia a base de novo." };
    var pdf = ""; try { pdf = cingPdfs_()[cingNomeChave_(l.nome)] || ""; } catch (eP) { pdf = ""; }
    var cb = cingCartaoBase_();
    var texto = cingTextoWhats_(l.nome, pdf ? (cb ? cb + "?page=ingresso-festa&c=" + encodeURIComponent(l.codigo) : pdf) : "", cingCategoria_(l.tipo));
    return { ok: true, fone: fone, texto: texto, link: pdf, url: "https://wa.me/" + fone + "?text=" + encodeURIComponent(texto) };
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
      var ult = cingEnvios_()[l.codigo];   // toque repetido (2, 3 vezes) NÃO conta como novo envio: janela de 30 s
      if (ult && ult.tempo && (Date.now() - ult.tempo) < 30000) return { ok: true, repetido: true, enviado: { quando: ult.quando, quem: ult.quem, vezes: ult.vezes } };
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
 * repetido). Não emite nada. emissaoLiberada só depende de a lista estar sem pendência (a idade da base é só aviso; o robô confere ao vivo).
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
    var vistos = {}, idade = cingIdadeMin_(base.lidoEm), res = [], pdfsMemo = null;
    function pdfsDe() { if (!pdfsMemo) pdfsMemo = cingPdfs_(); return pdfsMemo; }   // só lista a pasta do Drive se ALGUÉM já tem ingresso
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
        o.nomeNaBase = achado.nome; o.pdfDrive = pdfsDe()[cingNomeChave_(achado.nome)] || "";
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
      /* A IDADE DA BASE NÃO BLOQUEIA MAIS (16/11/2026, "tem que ser mais prático"): quem confere ao vivo se o CPF já tem ingresso é
         o ROBÔ, no TickOne, na hora de emitir (emitir.js: CPF que já tem ingresso NÃO é emitido). A base serve para avisar aqui;
         não é a trava. Base velha só aparece como aviso. */
      emissaoLiberada: cont.conferir === 0 && cont.novo > 0,
      emissaoMotivo: cont.conferir > 0 ? "Corrija as linhas em 'Conferir' antes de gerar."
        : (cont.novo === 0 ? "Ninguém novo para gerar: todos já têm ingresso."
        : cont.novo + " novo(s) podem ser gerados." + (recente ? "" : " A base do TickOne tem " + idade + " min; o robô confere de novo, ao vivo, antes de emitir.")) };
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

/** A fila só é ATUALIZADA, nunca criada aqui: o robô só lê arquivo que ele mesmo criou (acesso drive.file do Drive). */
function cingFilaPronta_(nome) { return cingPastaRobo_().getFilesByName(nome).hasNext(); }
function cingGravarFila_(nome, texto) {
  var it = cingPastaRobo_().getFilesByName(nome);
  if (!it.hasNext()) throw new Error("A fila do robô (" + nome + ") ainda não foi preparada. Peça ao Claude para preparar a fila e tente de novo.");
  it.next().setContent(texto);
}

function cingGravarArquivo_(pasta, nome, texto) {
  var it = pasta.getFilesByName(nome);
  if (it.hasNext()) it.next().setContent(texto); else pasta.createFile(nome, texto, "application/json");
}

/** A fila que o robô lê: só os pedidos ainda abertos. */
function cingPublicarFila_() {
  var fila = cingExclusoes_().filter(function (o) { return o.STATUS === "PEDIDO"; }).map(function (o) {
    return { pedido: String(o.PEDIDO), codigo: String(o.CODIGO), cpf: cingCpf11_(o.CPF), nome: String(o.NOME) };
  });
  cingGravarFila_(CING_ARQ_FILA, JSON.stringify({ atualizadoEm: new Date().toISOString(), itens: fila }));
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
    if (!cingFilaPronta_(CING_ARQ_FILA)) return { ok: false, mensagem: "A fila de exclusão do robô ainda não foi preparada. Peça ao Claude para preparar a fila e tente de novo." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está mexendo nas exclusões agora. Tente de novo." };
    try {
      var atual = cingExclusaoPorCodigo_()[l.codigo];
      if (atual && (atual.STATUS === "PEDIDO" || atual.STATUS === "EXCLUIDO")) return { ok: false, mensagem: "Este ingresso já tem pedido de exclusão (" + String(atual.STATUS).toLowerCase() + ")." };
      var id = "X" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + l.codigo;
      var shX = cingAbaExcl_(), linhaX = shX.getLastRow() + 1;
      try { shX.getRange(linhaX, 4).setNumberFormat("@"); shX.getRange(linhaX, 8).setNumberFormat("@"); } catch (eF) {}   // CPF e telefone como TEXTO
      shX.appendRow([id, l.codigo, l.nome, l.cpf, l.tipo, l.escola, l.cidade, l.tel,
        String(motivo || "").trim().substring(0, 200), new Date(), cingQuem_(sessao), "PEDIDO", "", ""]);
      var abertos = cingPublicarFila_();
      var rb = cingDispararRobo_("excluir");
      return { ok: true, pedido: id, abertos: abertos, robo: rb, mensagem: rb.acionado ? "Pedido de exclusão registrado. O robô já foi acionado." : "Pedido de exclusão registrado. " + rb.motivo };
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
    return { pedido: String(o.PEDIDO), nome: String(o.NOME), cpf: cingCpf11_(o.CPF), email: String(o.EMAIL || ""), telefone: String(o.TELEFONE || ""),
             cidade: String(o.CIDADE || ""), escola: String(o.ESCOLA || ""), categoria: String(o.CATEGORIA) };
  });
  cingGravarFila_(CING_ARQ_FILA_EMIS, JSON.stringify({ atualizadoEm: new Date().toISOString(), itens: fila }));
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
    if (!cingFilaPronta_(CING_ARQ_FILA_EMIS)) return { ok: false, mensagem: "A fila de emissão do robô ainda não foi preparada. Peça ao Claude para preparar a fila e tente de novo." };
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return { ok: false, mensagem: "Outra pessoa está pedindo emissão agora. Tente de novo." };
    try {
      var abertos = {};
      cingEmissoes_().forEach(function (o) { if (o.STATUS === "PEDIDO") abertos[cingCpf11_(o.CPF)] = true; });
      var sh = cingAbaEmis_(), n = 0, quem = cingQuem_(sessao), agora = new Date(), linhas = [];
      cf.resultados.forEach(function (r, i) {
        if (r.situacao !== "novo" || abertos[r.cpf]) return;
        var id = "E" + Utilities.formatDate(agora, "America/Sao_Paulo", "yyyyMMddHHmmss") + "-" + (i + 1);
        linhas.push([id, r.nome, r.cpf, r.email, r.telefone || r.telefoneDigitado, r.cidade, r.escola, r.categoria, agora, quem, "PEDIDO", "", "", ""]);
        n++;
      });
      if (n) {   // UMA gravação para o lote inteiro (40 pedidos linha a linha levavam dezenas de segundos)
        var ini = sh.getLastRow() + 1, area = sh.getRange(ini, 1, n, CING_COLUNAS_EMIS.length);
        try { sh.getRange(ini, 3, n, 1).setNumberFormat("@"); sh.getRange(ini, 5, n, 1).setNumberFormat("@"); } catch (eF) {}   // CPF e telefone como TEXTO
        area.setValues(linhas);
      }
      if (!n) return { ok: false, mensagem: "Estes já estão na fila de emissão." };
      var naFilaE = cingPublicarFilaEmissao_(), rb = cingDispararRobo_("emitir");
      return { ok: true, pedidos: n, naFila: naFilaE, emissoes: cingListaEmissoes_(), robo: rb, mensagem: n + " pedido(s) registrado(s). " + (rb.acionado ? "O robô já foi acionado." : rb.motivo) };
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

function cingListaEmissoes_() {
  return cingEmissoes_().reverse().slice(0, 50).map(function (o) {
    return { pedido: String(o.PEDIDO), nome: String(o.NOME), categoria: String(o.CATEGORIA), status: String(o.STATUS), codigo: String(o.CODIGO || ""),
      resultado: String(o.RESULTADO || ""), pedidoEm: cingFmtData_(o.PEDIDO_EM), pedidoPor: String(o.PEDIDO_POR || "") };
  });
}

function compassoIngressos_emissoes(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    cingSincronizarEmissoes_();
    return { ok: true, emissoes: cingListaEmissoes_() };
  } catch (e) {
    return { ok: false, mensagem: e.message };
  }
}


/* ══ DISPARO AUTOMÁTICO DOS ROBÔS (14/11/2026) ══
 * O botão do SISGEP aciona o workflow do GitHub sozinho (workflow_dispatch) — sem esperar pelo Claude.
 * A chave do GitHub (permissão SÓ de Actions, só neste repositório) fica nas Propriedades do script
 * (INGRESSOS_GH_TOKEN), gravada por administrador na tela; nunca no código, nunca no chat, nunca no log.
 * Sem chave, tudo segue como antes: o pedido fica na fila e o robô é acionado à mão. */
var CING_GH_REPO = "sisgepplataforma2026/Sisgpe";
var CING_GH_REF = "integracao/sisgep-homologacao";
var CING_ROBOS = { emitir: "ingressos-emitir.yml", excluir: "ingressos-excluir.yml", lerBase: "ingressos-ler-base.yml" };

function cingDispararRobo_(qual) {
  var arq = CING_ROBOS[qual];
  var tk = PropertiesService.getScriptProperties().getProperty("INGRESSOS_GH_TOKEN");
  if (!arq) return { acionado: false, motivo: "robô desconhecido" };
  if (!tk) return { acionado: false, motivo: "A chave do disparo automático ainda não foi cadastrada — o robô será acionado pelo Claude." };
  try {
    var r = UrlFetchApp.fetch("https://api.github.com/repos/" + CING_GH_REPO + "/actions/workflows/" + arq + "/dispatches", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + tk, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      payload: JSON.stringify({ ref: CING_GH_REF }) });
    var cod = r.getResponseCode();
    if (cod === 204) return { acionado: true, motivo: "" };
    return { acionado: false, motivo: "O GitHub recusou o disparo (código " + cod + "). O pedido está na fila; o Claude aciona o robô." };
  } catch (e) {
    return { acionado: false, motivo: "Não consegui falar com o GitHub agora. O pedido está na fila." };
  }
}

/** Só administrador. O valor vem da tela do SISGEP e vai direto às Propriedades; não é devolvido nem registrado. */
function compassoIngressos_salvarChaveRobo(chave, tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", true);
    chave = String(chave || "").trim();
    var props = PropertiesService.getScriptProperties();
    if (!chave) { props.deleteProperty("INGRESSOS_GH_TOKEN"); return { ok: true, ligado: false, mensagem: "Disparo automático desligado (chave removida)." }; }
    if (!/^[A-Za-z0-9_\-]{20,255}$/.test(chave)) return { ok: false, mensagem: "Esta chave não parece válida. Cole só o token do GitHub, sem espaços." };
    props.setProperty("INGRESSOS_GH_TOKEN", chave);
    return { ok: true, ligado: true, mensagem: "Chave guardada. O disparo automático está ligado." };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

function compassoIngressos_estadoRobo(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    return { ok: true, ligado: !!PropertiesService.getScriptProperties().getProperty("INGRESSOS_GH_TOKEN") };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}

/** Botão "Atualizar base": só leitura. */
function compassoIngressos_atualizarBase(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var d = cingDispararRobo_("lerBase");
    return { ok: true, robo: d, mensagem: d.acionado ? "Lendo o TickOne agora. Em cerca de 1 minuto a contagem atualiza." : d.motivo };
  } catch (e) { return { ok: false, mensagem: e.message }; }
}


/* ══ PDFs DOS INGRESSOS: do robô para a pasta INGRESSOS FESTA COMPASSO 2026 (15/11/2026) ══
 * O robô (baixar-pdfs.js) baixa o PDF de cada ingresso do TickOne para a pasta PRIVADA dele e anota em pdfs-estado.json.
 * O SISGEP copia os novos para a pasta que a equipe já usa. A tela chama isto ao abrir a lista, em lotes de 20, até acabar. */
var CING_ARQ_PDFS = "pdfs-estado.json";

/** Diz ao robô quais PDFs a equipe JÁ TEM na pasta (para ele não baixar de novo). O arquivo nasce no robô; aqui só se atualiza o conteúdo. */
function cingAtualizarExistentes_(pasta, nomes) {
  var f = pasta.getFilesByName("pdfs-existentes.json");
  if (!f.hasNext()) return false;
  var arq = f.next(), atual = {};
  try { atual = JSON.parse(arq.getBlob().getDataAsString()); } catch (e) { atual = {}; }
  var novos = nomes.slice().sort();
  if (atual.atualizadoEm && JSON.stringify((atual.nomes || []).slice().sort()) === JSON.stringify(novos)) return false;
  arq.setContent(JSON.stringify({ atualizadoEm: new Date().toISOString(), nomes: novos }));
  return true;
}

function compassoIngressos_sincronizarPdfs(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "eventos", false);
    var pasta = cingPastaRobo_();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return { ok: true, copiados: 0, faltam: 0, total: 0, ocupado: true };
    try {
      var destino = DriveApp.getFolderById(CING_PASTA_PDF_ID), jaTem = cingPdfsDaPasta_();   // raiz + subpastas por categoria
      var existentesAtualizado = false;
      try { existentesAtualizado = cingAtualizarExistentes_(pasta, Object.keys(jaTem)); /* nomes de toda a árvore de pastas */ } catch (eE) { /* sem o arquivo do robô ainda: segue */ }
      var it = pasta.getFilesByName(CING_ARQ_PDFS);
      if (!it.hasNext()) return { ok: true, copiados: 0, faltam: 0, total: 0, existentesAtualizado: existentesAtualizado, mensagem: "O robô ainda não baixou PDFs." };
      var est = JSON.parse(it.next().getBlob().getDataAsString()), feitos = est.feitos || {};
      /* SÓ os PDFs que o ROBÔ baixou (têm arquivo na pasta dele). Os marcados "existente" são ingressos que a equipe já tinha
         (o robô os achou pelo nome, sem acento/maiúscula): não há o que copiar. Antes, eles ocupavam as 20 vagas de cada lote
         e travavam a cópia dos novos (achado em 16/11/2026: nada era copiado desde as 09:27). */
      var nomes = [], codDoNome = {};
      Object.keys(feitos).forEach(function (k) { if (!feitos[k].existente) { nomes.push(feitos[k].arquivo); codDoNome[feitos[k].arquivo] = k; } });
      var tipoDe = {}; try { var bs = cingLerBase_(); if (bs) bs.linhas.forEach(function (l2) { tipoDe[l2.codigo] = l2.tipo; }); } catch (eB) {}
      var subCache = {};
      var pastaDaCategoria = function (codigo) {   // subpasta da categoria do ingresso; sem subpasta (ou Pago): a raiz
        var nomeSub = CING_SUBPASTAS[cingCategoria_(tipoDe[codigo] || "")] || "";
        if (!nomeSub) return destino;
        if (!(nomeSub in subCache)) { var sf = destino.getFoldersByName(nomeSub); subCache[nomeSub] = sf.hasNext() ? sf.next() : destino; }
        return subCache[nomeSub];
      };
      var pend = nomes.filter(function (nm2) { return !jaTem[nm2]; }), n = 0, semArquivo = 0, vistos = 0;
      for (var i = 0; i < pend.length && n < 20; i++) {
        vistos++;
        var f = pasta.getFilesByName(pend[i]);
        if (!f.hasNext()) { semArquivo++; continue; }   // não trava o lote: segue para o próximo
        var copia = f.next().makeCopy(pend[i], pastaDaCategoria(codDoNome[pend[i]])); n++;
        arquivoAplicarExcecao_(copia, "ingresso_festa", pend[i]);   // link aberto SÓ para o PDF do ingresso: exceção nomeada em ArquivoDrive.gs (decisão do usuário, 15/11/2026)
      }
      if (n || existentesAtualizado) { try { CacheService.getScriptCache().remove("CING_PDFS_V2"); } catch (e) {} }
      return { ok: true, copiados: n, faltam: Math.max(0, pend.length - vistos), semArquivo: semArquivo, total: nomes.length, existentesAtualizado: existentesAtualizado };
    } finally { lock.releaseLock(); }
  } catch (e) { return { ok: false, mensagem: e.message }; }
}
