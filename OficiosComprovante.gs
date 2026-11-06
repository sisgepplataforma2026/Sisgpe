/**
 * COMPROVANTE DE ENVIO DE OFÍCIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O QUE ORIGINOU, 10/09/2026. O usuário, depois de descobrir que a
 * conferência tinha olhado 3 ofícios de 362:
 *
 *   "isso é uma falha, como vou provar que foi enviado se não tenho a prova
 *    que a escola recebeu"
 *
 * Eu propus protocolo de recebimento — a escola clica num link e confirma. E
 * ele derrubou a proposta com uma pergunta melhor:
 *
 *   "Não vai burocratizar? Já que o email é pessoal"
 *
 * ELE ESTAVA CERTO, e a razão vale ficar escrita. O protocolo faz A ESCOLA
 * trabalhar — gente de fora, sobre quem o sindicato não tem controle nenhum.
 * Se ela não clica, não se ganha nada; e ainda se ganha uma tela dizendo "47
 * aguardando protocolo" que nunca esvazia. É o defeito do item 74 outra vez:
 * o alerta que vira ruído, o ruído que vira rótulo `SISGEP_Ignorado`, e o
 * aviso seguinte — o que importava — caindo na mesma pasta.
 *
 * A decisão dele fechou o escopo: **"Só preciso da confirmação do email
 * enviado."** Não é prova de recebimento. É prova de ENVIO, montada do que o
 * sistema JÁ TEM, sem pedir nada a ninguém.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A REGRA QUE GOVERNA ESTE ARQUIVO INTEIRO
 *
 * Um comprovante que exagera é pior que nenhum, porque só falha na hora em
 * que é usado — e essa hora é justamente uma disputa. Então:
 *
 *   1. cada linha diz O QUE PROVA, e não só o que aconteceu;
 *   2. evidência que falta aparece escrita como ausente, nunca em branco.
 *      Campo vazio o leitor preenche com otimismo;
 *   3. confirmação AUTOMÁTICA e confirmação de GENTE não são a mesma coisa e
 *      não podem sair com o mesmo peso. A automática vem de busca no Gmail,
 *      e foi ela que deixou uma assinatura "Outlook" confirmar ofício que
 *      tinha quicado (item 49);
 *   4. o rodapé diz o que e-mail NÃO prova. Sem isso o documento induz a
 *      erro por omissão.
 *
 * O QUE ESTE COMPROVANTE NÃO É: um AR dos Correios. Para ofício com efeito
 * jurídico em disputa, papel com carimbo continua sendo outro patamar — e o
 * documento diz isso em vez de deixar descobrir depois.
 */

/* Prefixos que denunciam caixa compartilhada. Endereço nominal identifica uma
   PESSOA; genérico identifica um setor, e "mandei para o setor" é evidência
   mais fraca de que alguém leu. O usuário levantou isso, e o comprovante
   deixa a diferença à vista em vez de tratar todo endereço como igual. */
var OFICIO_COMPROV_PREFIXOS_GENERICOS = [
  "contato", "secretaria", "financeiro", "rh", "atendimento", "adm",
  "administracao", "administrativo", "escola", "diretoria", "direcao",
  "info", "comercial", "faleconosco", "sac", "recepcao", "coordenacao"
];

/**
 * Classifica um endereço em nominal, generico ou indefinido.
 *
 * TRÊS RESPOSTAS, E NÃO DUAS, de propósito: `joao@escola.com` não é
 * classificável com honestidade — pode ser o João e pode ser um apelido de
 * setor. Chutar "nominal" nesse caso inflaria a força do comprovante
 * exatamente onde ele é mais fraco.
 */
function oficioComprovante_classificarEndereco_(email) {
  var e = String(email || "").trim().toLowerCase();
  if (!e || e.indexOf("@") < 1) return "indefinido";

  var local = e.split("@")[0].replace(/[0-9._-]+$/, "");
  for (var i = 0; i < OFICIO_COMPROV_PREFIXOS_GENERICOS.length; i++) {
    if (local === OFICIO_COMPROV_PREFIXOS_GENERICOS[i]) return "generico";
  }
  /* nome.sobrenome@ — o formato que praticamente só existe para pessoa. */
  if (/^[a-z]{2,}[._][a-z]{2,}/.test(local)) return "nominal";
  return "indefinido";
}

/**
 * Reúne, para UM ofício, tudo que o sistema sabe sobre o envio dele.
 *
 * Só LÊ. Não escreve na planilha, não fala com o Gmail e não gasta cota —
 * um comprovante não pode custar orçamento de envio (item 77).
 */
function oficioComprovante_dados_(numero) {
  var alvo = String(numero || "").trim();
  if (!alvo) return null;

  var sh = obterOuCriarAbaFilaOficios_();
  if (!sh || sh.getLastRow() < 2) return null;

  var hm = getHeaderMap_(sh);
  var col = function (nome) { return hm[nome] || 0; };
  var linhas = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var cNum = col("NUMERO_OFICIO");
  if (!cNum) return null;

  var l = null;
  for (var i = 0; i < linhas.length; i++) {
    if (String(linhas[i][cNum - 1] || "").trim() === alvo) { l = linhas[i]; break; }
  }
  if (!l) return null;

  var ler = function (nome) {
    var c = col(nome);
    return c ? l[c - 1] : "";
  };
  var texto = function (nome) { return String(ler(nome) || "").trim(); };
  var data = function (nome) {
    var v = ler(nome);
    return (v instanceof Date && !isNaN(v.getTime())) ? v : null;
  };

  var destinos = texto("EMAILS_TODOS") || texto("EMAIL_PRINCIPAL");
  var lista = destinos.split(/[;,]/).map(function (x) { return x.trim(); })
                      .filter(function (x) { return x; });

  var status = texto("STATUS").toUpperCase();
  var obs    = texto("OBSERVACOES");
  var recebimento = texto("STATUS_RECEBIMENTO").toUpperCase();

  /* CONFIRMAÇÃO AUTOMÁTICA x DE GENTE. A distinção já existia no sistema
     desde 01/09 e mora na OBSERVAÇÃO — a marcação manual grava "Confirmado
     manualmente pelo operador", a varredura grava "localizada
     automaticamente". Aqui ela vira peso de prova. */
  var confirmadoPorGente = /manualmente pelo operador/i.test(obs);
  var confirmadoAuto     = /automaticamente/i.test(obs);

  var anexos = [];
  try {
    var j = JSON.parse(texto("ANEXOS_JSON") || "[]");
    if (j && j.length) anexos = j.map(function (a) { return String(a.nome || a); });
  } catch (eJson) { anexos = []; }

  return {
    numero:       alvo,
    escola:       texto("ESCOLA"),
    cnpj:         texto("CNPJ"),
    tipo:         texto("TIPO"),
    destinos:     lista,
    classes:      lista.map(oficioComprovante_classificarEndereco_),
    dataEnvio:    data("DATA_ENVIO"),
    mensagemId:   (function (id) {
                    /* GMAILAPP_SEM_ID é marcador de "não deu para guardar",
                       não identificador. Tratá-lo como id faria o comprovante
                       exibir uma prova que não existe. */
                    return (id && id !== "GMAILAPP_SEM_ID") ? id : "";
                  })(texto("MENSAGEM_ID")),
    comprovacao:  texto(OFICIO_COL_COMPROVACAO),
    comprovadoEm: data(OFICIO_COL_COMPROVACAO_EM),
    devolvido:    status === "FALHA_ENTREGA",
    ultimoErro:   texto("ULTIMO_ERRO"),
    respondido:   recebimento === "CONFIRMADO",
    respondidoEm: data("DATA_CONFIRMACAO"),
    respostaDeGente: confirmadoPorGente,
    respostaAuto:    confirmadoAuto && !confirmadoPorGente,
    observacoes:  obs,
    anexos:       anexos,
    status:       status
  };
}

/**
 * Monta as LINHAS DE EVIDÊNCIA — o miolo do comprovante.
 *
 * Cada uma traz o fato e a força dele. Separado da renderização de propósito:
 * é aqui que mora o julgamento, e é isto que o teste precisa medir sem ter
 * que ler HTML.
 */
function oficioComprovante_evidencias_(d) {
  var fmt = function (dt) {
    return dt ? Utilities.formatDate(dt, Session.getScriptTimeZone(),
                                     "dd/MM/yyyy 'às' HH'h'mm") : "";
  };
  var ev = [];

  /* 1. O ENVIO. Sem data não há o que afirmar — e dizer isso é o ponto. */
  ev.push(d.dataEnvio
    ? { item: "Envio", valor: fmt(d.dataEnvio),
        prova: "media", diz: "O sistema registrou a saída nesta data e hora." }
    : { item: "Envio", valor: "sem data registrada",
        prova: "nenhuma", diz: "A linha está sem DATA_ENVIO. Não é possível " +
                               "afirmar quando, ou se, este ofício saiu." });

  /* 2. O ACEITE DO GMAIL. createDraft().send() só devolve um GmailMessage
        quando o envio deu certo — então o id gravado JÁ É prova de aceite. */
  ev.push(d.mensagemId
    ? { item: "Identificador da mensagem", valor: d.mensagemId,
        prova: "media",
        diz: "O Gmail aceitou a mensagem e devolveu este identificador. " +
             "Ele só existe quando o envio se completa." }
    : { item: "Identificador da mensagem", valor: "não guardado",
        prova: "nenhuma",
        diz: "Até 02/09/2026 o envio não devolvia identificador. A ausência " +
             "aqui é do sistema de então, e nada diz sobre este ofício." });

  /* 3. A CONFERÊNCIA na caixa de Enviados. */
  if (/^EM ENVIADOS/i.test(d.comprovacao)) {
    ev.push({ item: "Caixa de Enviados", valor: d.comprovacao +
                (d.comprovadoEm ? " · conferido em " + fmt(d.comprovadoEm) : ""),
              prova: "forte",
              diz: "A mensagem foi procurada na caixa de Enviados da conta " +
                   "que envia e está lá." });
  } else if (/^NAO ENCONTRADO/i.test(d.comprovacao)) {
    ev.push({ item: "Caixa de Enviados", valor: "não encontrada",
              prova: "contraria",
              diz: "A mensagem foi procurada na caixa de Enviados e NÃO foi " +
                   "localizada. Isto contraria o envio e precisa ser apurado " +
                   "antes de este comprovante ser usado." });
  } else {
    ev.push({ item: "Caixa de Enviados", valor: "ainda não conferida",
              prova: "nenhuma",
              diz: "A conferência não passou por este ofício. Rodar " +
                   "conferirOficiosNaCaixaDeEnviadosCompleto() responde." });
  }

  /* 4. A DEVOLUÇÃO — a evidência que o usuário levantou ao dizer que o
        endereço é pessoal. Ausência de devolução é fraca, e o texto diz por
        quê: prova que o servidor da escola aceitou, não que alguém leu. */
  ev.push(d.devolvido
    ? { item: "Devolução", valor: "SIM — o servidor devolveu",
        prova: "contraria",
        diz: "O servidor de destino recusou a entrega" +
             (d.ultimoErro ? " (" + d.ultimoErro + ")" : "") +
             ". Este ofício NÃO chegou." }
    : { item: "Devolução", valor: "nenhuma registrada",
        prova: "fraca",
        diz: "Nenhuma devolução foi registrada, o que indica que o servidor " +
             "de destino aceitou a mensagem. Não prova que foi lida, nem " +
             "descarta filtro de spam." });

  /* 5. A RESPOSTA — o único sinal forte que e-mail dá, e só quando é gente. */
  if (d.respondido && d.respostaDeGente) {
    ev.push({ item: "Resposta da escola", valor: fmt(d.respondidoEm) || "confirmada",
              prova: "forte",
              diz: "Confirmação registrada por uma pessoa do sindicato, que " +
                   "viu a resposta. É a evidência mais forte deste documento." });
  } else if (d.respondido && d.respostaAuto) {
    ev.push({ item: "Resposta da escola", valor: fmt(d.respondidoEm) ||
                "localizada automaticamente",
              prova: "fraca",
              diz: "Confirmação localizada por varredura automática do Gmail. " +
                   "Esse mecanismo já confirmou ofício que havia quicado, " +
                   "por casar mensagem errada — vale menos que a leitura de " +
                   "uma pessoa." });
  } else if (d.respondido) {
    ev.push({ item: "Resposta da escola", valor: fmt(d.respondidoEm) || "confirmada",
              prova: "media",
              diz: "Há confirmação de recebimento registrada, sem indicação " +
                   "de quem a registrou." });
  } else {
    ev.push({ item: "Resposta da escola", valor: "nenhuma até agora",
              prova: "nenhuma",
              diz: "A escola não respondeu, ou a resposta não foi associada " +
                   "a este ofício. Isto não indica que não recebeu." });
  }

  return ev;
}

/** O veredito de uma linha vira rótulo e cor. */
function oficioComprovante_rotuloProva_(p) {
  if (p === "forte")     return { texto: "prova forte",   cor: "#0f8a5f" };
  if (p === "media")     return { texto: "prova média",   cor: "#1565C0" };
  if (p === "fraca")     return { texto: "indício",       cor: "#d97706" };
  if (p === "contraria") return { texto: "CONTRARIA",     cor: "#dc2626" };
  return { texto: "não prova nada", cor: "#6b7280" };
}

function oficioComprovante_escapar_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renderiza o comprovante. Estilo embutido de propósito: esta página é
 * impressa e vira PDF, e o CSS do sistema não acompanha o arquivo.
 * Tokens iguais aos do Design System (OficiosStyles.html).
 */
function oficioComprovante_html_(d) {
  var esc = oficioComprovante_escapar_;
  var evs = oficioComprovante_evidencias_(d);
  var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
                                   "dd/MM/yyyy 'às' HH'h'mm");

  var destinos = d.destinos.map(function (e, i) {
    var c = d.classes[i];
    var nota = c === "nominal"  ? "endereço nominal"
             : c === "generico" ? "caixa de setor"
             : "não classificado";
    return '<div class="dest">' + esc(e) +
           ' <span class="tag">' + nota + '</span></div>';
  }).join("") || '<div class="dest">nenhum endereço registrado</div>';

  var linhas = evs.map(function (e) {
    var r = oficioComprovante_rotuloProva_(e.prova);
    return '<tr>' +
      '<th>' + esc(e.item) + '</th>' +
      '<td><div class="val">' + esc(e.valor) + '</div>' +
      '<div class="diz">' + esc(e.diz) + '</div></td>' +
      '<td class="pv"><span style="color:' + r.cor + '">' + esc(r.texto) + '</span></td>' +
      '</tr>';
  }).join("");

  return '' +
'<style>' +
'  @page { margin: 18mm 16mm; }' +
'  body { font-family: "Plus Jakarta Sans", -apple-system, Segoe UI, Arial, sans-serif;' +
'         color:#1f2937; font-size:12px; line-height:1.5; margin:0; }' +
'  .cab { border-bottom:3px solid #001f4d; padding-bottom:10px; margin-bottom:16px; }' +
'  .cab h1 { font-size:17px; color:#001f4d; margin:0 0 2px; letter-spacing:.2px; }' +
'  .cab .sub { color:#6b7280; font-size:11px; }' +
'  .ident { background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px;' +
'           padding:12px 14px; margin-bottom:16px; }' +
'  .ident b { color:#001f4d; }' +
'  .dest { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11.5px; margin-top:3px; }' +
'  .tag { font-family:inherit; font-size:9.5px; color:#6b7280; border:1px solid #e5e7eb;' +
'         border-radius:6px; padding:1px 5px; margin-left:5px; }' +
'  table { width:100%; border-collapse:collapse; }' +
'  th, td { text-align:left; vertical-align:top; padding:9px 8px; border-bottom:1px solid #eef1f5; }' +
'  th { width:24%; color:#001f4d; font-size:11px; text-transform:uppercase; letter-spacing:.4px; }' +
'  .val { font-weight:600; }' +
'  .diz { color:#6b7280; font-size:10.5px; margin-top:2px; }' +
'  .pv { width:17%; text-align:right; font-size:10px; font-weight:700;' +
'        text-transform:uppercase; letter-spacing:.3px; white-space:nowrap; }' +
'  .rod { margin-top:18px; border-top:1px solid #e5e7eb; padding-top:10px;' +
'         color:#6b7280; font-size:10px; }' +
'  .rod b { color:#1f2937; }' +
'</style>' +
'<div class="cab">' +
'  <h1>Comprovante de envio — Ofício ' + esc(d.numero) + '</h1>' +
'  <div class="sub">Emitido em ' + esc(agora) + ' · documento gerado pelo SISGEP</div>' +
'</div>' +
'<div class="ident">' +
'  <div><b>Destinatário:</b> ' + esc(d.escola || "não informado") +
      (d.cnpj ? ' &nbsp;·&nbsp; CNPJ ' + esc(d.cnpj) : '') + '</div>' +
     (d.tipo ? '<div><b>Assunto:</b> ' + esc(d.tipo) + '</div>' : '') +
'  <div style="margin-top:6px"><b>Enviado para:</b></div>' + destinos +
     (d.anexos.length
        ? '<div style="margin-top:6px"><b>Anexos:</b> ' + esc(d.anexos.join(", ")) + '</div>'
        : '<div style="margin-top:6px"><b>Anexos:</b> nenhum registrado</div>') +
'</div>' +
'<table>' + linhas + '</table>' +
'<div class="rod">' +
'  <b>O que este documento é.</b> Um retrato do que o sistema registrou sobre ' +
'  o envio deste ofício, com a força de cada evidência declarada linha a linha. ' +
'  <b>O que ele não é.</b> Prova de que a escola leu o ofício. E-mail não ' +
'  produz essa prova: mesmo sem devolução, a mensagem pode ter sido filtrada ' +
'  ou não lida. Para ofício com efeito jurídico em disputa, protocolo ' +
'  assinado ou aviso de recebimento continuam sendo outro patamar.' +
'</div>';
}

/**
 * O endpoint da tela.
 *
 * PORTA: `exigirModulo_`, e não `exigirAdminOuSessao_` — este comprovante
 * devolve nome de escola, CNPJ e os endereços de contato dela. É a mesma
 * base que o item 69 mostrou ser destrutível por engano, e o teto de
 * exposição não sobe por causa de um relatório.
 */
function comprovanteDeEnvioOficio(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var d = oficioComprovante_dados_(numero);
  if (!d) {
    return { ok: false, mensagem: "Ofício " + numero + " não encontrado na fila de envio." };
  }

  return {
    ok: true,
    numero: d.numero,
    escola: d.escola,
    html: oficioComprovante_html_(d),
    evidencias: oficioComprovante_evidencias_(d).map(function (e) {
      return { item: e.item, valor: e.valor, prova: e.prova };
    })
  };
}

/**
 * ARQUIVAR O COMPROVANTE NO DRIVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 10/09/2026. O usuário pediu os dois caminhos — "Imprimir ou arquivar no
 * Drive? Os dois" — e eles resolvem coisas diferentes: imprimir serve para
 * mostrar agora; arquivar serve para poder mostrar de novo daqui a um ano,
 * sem depender de a fila ainda ter a linha e de o Gmail ainda ter a mensagem.
 *
 * PASTA: RELATORIOS, que já existe nos DOIS ambientes e foi verificada no ar
 * em 21/08 (item 27). Não criei chave nova em RECURSOS_AMBIENTE de propósito:
 * uma chave sem ID de homologação faria a trava barrar — corretamente — e o
 * arquivamento nasceria quebrado no único ambiente onde dá para ensaiar.
 *
 * A TRAVA DE AMBIENTE VEM DE GRAÇA: getRecursoId_ recusa gravar na pasta de
 * produção quando o ambiente é homologação. É o que impede o ensaio sujar o
 * acervo real.
 *
 * IDEMPOTENTE POR NOME: arquivar duas vezes o mesmo ofício no mesmo dia
 * devolve o arquivo que já existe. Sem isso, clicar duas vezes deixaria duas
 * cópias de um documento que serve para provar algo — e a dúvida sobre qual
 * vale é o oposto do que ele existe para fazer.
 */
function oficioComprovante_nomeArquivo_(d) {
  var quando = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy");
  /* Barra é separador de caminho e não pode ir para nome de arquivo — o
     número do ofício tem uma (519/2026). */
  var num = String(d.numero || "").replace(/\//g, "-");
  var escola = String(d.escola || "sem escola").replace(/[\\\/:*?"<>|]/g, "-").trim();
  return "Comprovante " + num + " - " + escola + " - " + quando;
}

function arquivarComprovanteDeEnvioOficio(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "documentos", false);

  var d = oficioComprovante_dados_(numero);
  if (!d) {
    return { ok: false, mensagem: "Ofício " + numero + " não encontrado na fila de envio." };
  }

  var nome = oficioComprovante_nomeArquivo_(d);

  try {
    var pasta = obterOuCriarSubpastaAno(getRecursoId_("RELATORIOS"));

    /* Já existe? Devolve o que está lá. */
    var existentes = pasta.getFilesByName(nome + ".pdf");
    if (existentes.hasNext()) {
      var jaTem = existentes.next();
      return {
        ok: true, jaExistia: true, numero: d.numero,
        nome: jaTem.getName(), url: jaTem.getUrl(),
        mensagem: "O comprovante do ofício " + d.numero + " já estava arquivado hoje."
      };
    }

    var arq = oficios_converterHtmlParaPdf_(oficioComprovante_html_(d), nome, pasta);
    return {
      ok: true, jaExistia: false, numero: d.numero,
      nome: arq.getName(), url: arq.getUrl(),
      mensagem: "Comprovante do ofício " + d.numero + " arquivado."
    };

  } catch (e) {
    /* A mensagem da trava de ambiente é longa e explica o que configurar —
       vale mais que qualquer texto meu por cima dela. */
    Logger.log("❌ arquivarComprovanteDeEnvioOficio " + d.numero + ": " + (e.message || e));
    return {
      ok: false, numero: d.numero,
      mensagem: "Não consegui arquivar o comprovante do ofício " + d.numero +
                ": " + (e.message || e)
    };
  }
}
