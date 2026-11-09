/* ================================================================
   CAIXA DE E-MAILS — A NOTA FISCAL DO PRESTADOR VAI PARA A DESPESA (06/11/2026)
   ================================================================
   O usuário: "quando é nota fiscal, tem que ter a opção de enviar NF" — é o
   PRESTADOR que manda a nota ("2 - b"); desenho docs/mock-acoes-no-email.png
   com os ajustes aprovados ("sim"):
     - o SISGEP procura a DESPESA em aberto do prestador (pelo e-mail dele no
       cadastro da despesa; depois pelo domínio; depois pelo nome no
       assunto/texto/anexo), com o motivo à vista; achou mais de uma ou
       nenhuma, NÃO chuta: mostra as candidatas para a pessoa escolher;
     - "Anexar à despesa e enviar à contabilidade" usa o MESMO caminho do
       módulo de Despesas: uploadDocumentoManual (anexa, despesa vira "doc
       recebido") e enviarLoteDespesasParaContabilidade (o mesmo e-mail, com o
       link de confirmação da contabilidade). "Só anexar" para no primeiro;
     - só vão os anexos marcados (o robô pré-marca o que parece nota);
     - nada sai sem a confirmação; o que o robô propôs × o que foi fica na
       memória do robô (tarefa "nf-despesa").
   Pede o módulo Financeiro (as funções de Despesas já exigem).
   ================================================================ */

var CXN_NF_NOME = /\bnf|nfs-?e|nota|danfe|fiscal|\.xml$/i;
var CXN_NF_ABERTAS = ["PENDENTE", "AGUARDANDO_DOC", "DOC_RECEBIDO"];

function cxnfAnexos_(p) {
  return vpeJson_(p.ANEXOS_JSON, []).map(function (a, i) {
    var nome = String(a.nome || ""), tipo = String(a.tipo || "");
    var doc = /pdf|image|xml/i.test(tipo) || /\.(pdf|jpe?g|png|xml)$/i.test(nome);
    return { indice: i, nome: nome, tipo: tipo, doc: doc, sugerido: doc && CXN_NF_NOME.test(nome) };
  });
}
function cxnfNorm_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function cxnfDominio_(email) {
  var d = String(email || "").split("@")[1] || "";
  return /^(gmail|hotmail|outlook|yahoo|live|icloud|uol|bol|terra)\./i.test(d) ? "" : d.toLowerCase();
}

/** As despesas em aberto que podem ser desta nota, da mais provável para a menos. */
function cxnfCandidatas_(conv) {
  var r = listarDespesas_interno_({ ocultarPagos: true, ocultarCancelados: true });
  var lista = (r && r.lista) || [];
  var de = cxsEmail_(conv.ultimo.replyTo || conv.ultimo.de), dom = cxnfDominio_(de);
  var texto = cxnfNorm_(conv.msgs.map(function (m) { return (m.assunto || "") + " " + (m.corpo || ""); }).join(" ") + " " +
    vpeJson_(conv.p.ANEXOS_JSON, []).map(function (a) { return a.nome || ""; }).join(" "));
  return lista.filter(function (d) { return CXN_NF_ABERTAS.indexOf(String(d.status)) > -1; }).map(function (d) {
    var em = String(d.prestadorEmail || "").toLowerCase().split(/[;,\s]+/).filter(String);
    var nome = cxnfNorm_(d.prestadorNome), pontos = 0, motivo = "";
    if (de && em.indexOf(de) > -1) { pontos = 3; motivo = "pelo e-mail do prestador no cadastro da despesa"; }
    else if (dom && em.some(function (x) { return cxnfDominio_(x) === dom; })) { pontos = 2; motivo = "pelo domínio do e-mail (" + dom + ")"; }
    else if (nome.length >= 4 && texto.indexOf(nome) > -1) { pontos = 1; motivo = "pelo nome do prestador no e-mail"; }
    return { idDespesa: d.idDespesa, numero: d.numeroDespesa, prestador: d.prestadorNome, descricao: d.descricao, valor: d.valor,
             vencimento: d.dataVencimentoBR, status: d.status, pontos: pontos, motivo: motivo };
  }).filter(function (c) { return c.pontos > 0; }).sort(function (a, b) { return b.pontos - a.pontos; });
}

/** O que o robô preparou para a nota deste e-mail. */
function caixaNotaFiscalDoEmail(id, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "financeiro", false);
    var conv = cxfConversa_(id, sessao);
    var cands = cxnfCandidatas_(conv);
    var topo = cands.filter(function (c) { return c.pontos === (cands[0] || {}).pontos; });
    return { ok: true, nota: {
      anexos: cxnfAnexos_(conv.p),
      candidatas: cands.slice(0, 8),
      escolhida: topo.length === 1 ? topo[0].idDespesa : "",   // mais de uma com a mesma força: a pessoa escolhe
      de: cxsEmail_(conv.ultimo.replyTo || conv.ultimo.de)
    } };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/**
 * Anexa a nota à despesa (e, se pedido, envia à contabilidade) pelo caminho
 * do módulo de Despesas. dados = { idDespesa, anexos:[índices], enviar: true|false, conferi: true }.
 */
function caixaNotaFiscalAnexar(id, dados, tokenSessao) {
  try {
    var sessao = cxsExigir_(tokenSessao);
    exigirModulo_(tokenSessao, "financeiro", false);
    dados = dados || {};
    if (dados.conferi !== true) return { ok: false, mensagem: "Marque que conferiu a nota e a despesa antes." };
    var conv = cxfConversa_(id, sessao);
    var idDesp = String(dados.idDespesa || "").trim();
    var cands = cxnfCandidatas_(conv);
    var r0 = listarDespesas_interno_({ ocultarPagos: true, ocultarCancelados: true });
    var desp = ((r0 && r0.lista) || []).filter(function (d) { return d.idDespesa === idDesp; })[0];
    if (!desp) return { ok: false, mensagem: "Escolha a despesa (em aberto) desta nota." };
    if (CXN_NF_ABERTAS.indexOf(String(desp.status)) === -1) return { ok: false, mensagem: "Esta despesa já foi enviada, paga ou cancelada." };
    var disp = cxnfAnexos_(conv.p);
    var idx = (dados.anexos || []).map(Number).filter(function (n) { return disp[n] && disp[n].doc; });
    if (!idx.length) return { ok: false, mensagem: "Marque o anexo da nota fiscal." };
    var arquivos = idx.map(function (n) {
      var ax = cxsAnexoInterno_(conv.p, n);
      if (!ax.ok) throw new Error("Não consegui pegar o anexo " + disp[n].nome + ": " + ax.mensagem);
      return { nome: ax.nome, tipo: ax.tipo, base64: String(ax.dataUrl).split(",")[1] || "" };
    });
    /* O MESMO caminho do módulo de Despesas. */
    var up = uploadDocumentoManual({ idDespesa: idDesp, arquivos: arquivos, obs: "Pela Caixa de E-mails: " + String(conv.primeiro.assunto || "").substring(0, 120) }, tokenSessao);
    if (!up || !up.ok) return { ok: false, mensagem: (up && up.mensagem) || "Não anexou." };
    var env = null;
    if (dados.enviar === true) {
      env = enviarLoteDespesasParaContabilidade([idDesp], tokenSessao);
      if (!env || !env.ok) return { ok: false, anexou: true, mensagem: "A nota foi anexada à despesa, mas o envio à contabilidade não saiu: " + ((env && env.mensagem) || "erro") + ". Envie por Financeiro › Despesas." };
    }
    var quem = sessao.email || sessao.usuario || "";
    var oque = "NF anexada à despesa " + (desp.numeroDespesa || idDesp) + " (" + desp.prestadorNome + ")" + (env ? " e enviada à contabilidade" : "");
    crnTratou_(id, conv.p, "TRATAR", sessao);
    cxsGravarEstado_(id, { ESTADO: CXS_ESTADOS.RESOLVIDO, NOTA: oque + " pela Caixa." }, quem);
    cxsAuditar_("NF_DESPESA", id, oque + " · " + arquivos.length + " arquivo(s)", sessao);
    roboMemoriaRegistrar_({ tarefa: "nf-despesa", origem: String(conv.p.CAIXA || ""), chave: String(id), remetente: cxsEmail_(conv.ultimo.de),
      assunto: conv.primeiro.assunto, sugerido: (cands[0] && cands[0].idDespesa) || "", decidido: idDesp, quem: quem });
    return { ok: true, enviado: !!env, mensagem: oque + "." };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}
