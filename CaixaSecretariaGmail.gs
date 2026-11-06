/* ================================================================
   A CAIXA DA SECRETARIA@, NA HORA — 06/11/2026
   ================================================================
   O usuário: a Marcela "vai trabalhar dentro do SISGEP junto ao e-mail",
   com as pastas. "Ler é uma coisa e aparecer é outra": o robô continua
   categorizando só a Entrada e a CERTIFICADO 2027-1 (pela ponte, como
   sempre); as outras pastas só APARECEM, e cada uma carrega no clique.

   O SISGEP roda na conta do Financeiro e não alcança o Gmail da Secretaria
   (sindeducacaosecretaria@gmail.com, que recebe a cópia da KingHost). Quem
   alcança é o Leitor da Secretaria, publicado como App da Web executado
   como a Secretaria (leitor-secretaria/, "CAIXA DA SECRETARIA NO SISGEP,
   NA HORA"). Este arquivo fala com ele: endereço e segredo ficam na ponte,
   na aba API (só as duas contas abrem a ponte).

   cxgGmail_() devolve um objeto com o MESMO jeito do GmailApp nas partes
   que a Caixa usa (search, getThreadById, getMessageById, marcadores,
   reply, forward, anexos) — assim as pastas, a conversa, a resposta e o
   encaminhar da financeiro@ servem para a secretaria@ sem código repetido.
   Os ids da secretaria@ que vêm por aqui começam com "S:".

   Decisões do usuário (06/11/2026, "De acordo"): apagar no SISGEP manda
   para a lixeira deste Gmail — a cópia na KingHost continua lá; a Marcela
   deixa de usar o webmail da KingHost.
   ================================================================ */

var CXG_PREFIXO = "S:";
var CXG_ABA_API = "API";

function cxgEhSecretariaGmail_(id) { return String(id || "").indexOf(CXG_PREFIXO) === 0; }

/** Endereço e segredo do leitor (aba API da ponte), guardados 10 min. */
function cxgConfig_() {
  var cache = null;
  try { cache = CacheService.getScriptCache(); var c = cache.get("cxg_cfg_v1"); if (c) return JSON.parse(c); } catch (e) {}
  var sh = null;
  try { sh = vpePonte_().getSheetByName(CXG_ABA_API); } catch (e) {}
  if (!sh || sh.getLastRow() < 2) {
    throw new Error("A caixa da secretaria@ ainda não está ligada ao SISGEP: falta publicar o leitor como App da Web e rodar caixaApiConfigurar (README do leitor, \"Caixa na hora\").");
  }
  var v = sh.getRange(2, 1, 1, 2).getValues()[0];
  var cfg = { url: String(v[0] || ""), segredo: String(v[1] || "") };
  if (!cfg.url || !cfg.segredo) throw new Error("A aba API da ponte está incompleta — rode caixaApiConfigurar no leitor.");
  /* 06/11/2026, no ar: rodado pelo editor, o Google devolveu o endereço de TESTE
     (/dev), que só abre para quem é editor logado — o SISGEP não entra. Só /exec. */
  if (!/\/exec(\?|$)/.test(cfg.url)) throw new Error("O endereço do leitor na ponte não é o da implantação (/exec) — é \"" + cfg.url.replace(/^.*\//, "…/") + "\". Publique o leitor como App da Web e rode caixaApiConfigurar de novo.");
  try { cache.put("cxg_cfg_v1", JSON.stringify(cfg), 600); } catch (e) {}
  return cfg;
}

/** Uma pergunta ao leitor. Erro dele vira erro aqui, com a palavra dele. */
function cxgApi_(op, args) {
  var cfg = cxgConfig_();
  var resp = UrlFetchApp.fetch(cfg.url, {
    method: "post", contentType: "application/json", muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ segredo: cfg.segredo, op: op, args: args || {} })
  });
  var txt = String(resp.getContentText() || "");
  var r = null;
  try { r = JSON.parse(txt); } catch (e) {
    throw new Error("A caixa da secretaria@ não respondeu direito (código " + resp.getResponseCode() + "). Confira se o leitor está publicado como App da Web.");
  }
  if (!r.ok) throw new Error("Caixa da secretaria@: " + (r.erro || "erro"));
  return r.r;
}

/* ── O "GmailApp" da secretaria@ ── */
function cxgMensagem_(d) {
  var m = {
    getId: function () { return String(d.id); },
    getFrom: function () { return d.de || ""; },
    getReplyTo: function () { return d.replyTo || ""; },
    getTo: function () { return d.para || ""; },
    getCc: function () { return d.cc || ""; },
    getSubject: function () { return d.assunto || ""; },
    getDate: function () { return new Date(d.data); },
    getPlainBody: function () { return d.corpo || ""; },
    isStarred: function () { return !!d.estrela; },
    isUnread: function () { return d.lida === false; },
    star: function () { cxgApi_("estrela", { id: d.id, on: true }); d.estrela = true; },
    unstar: function () { cxgApi_("estrela", { id: d.id, on: false }); d.estrela = false; },
    getAttachments: function () {
      return (d.anexos || []).map(function (a, pos) {
        var bytes = null;
        var carregar = function () {
          if (!bytes) { var x = cxgApi_("anexo", { msgId: d.id, pos: pos }); bytes = Utilities.base64Decode(x.b64); }
          return bytes;
        };
        return { getName: function () { return a.nome; }, getContentType: function () { return a.tipo; },
                 getSize: function () { return a.tamanho; }, getBytes: carregar,
                 copyBlob: function () { return Utilities.newBlob(carregar(), a.tipo, a.nome); } };
      });
    },
    reply: function (corpo, op) { return cxgApi_("responder", cxgOpcoes_(d.id, op)); },
    forward: function (para, op) { var a = cxgOpcoes_(d.id, op); a.para = para; return cxgApi_("encaminhar", a); }
  };
  return m;
}
function cxgOpcoes_(msgId, op) {
  op = op || {};
  return { msgId: msgId, html: String(op.htmlBody || ""), cc: op.cc || "", cco: op.bcc || "",
           anexos: (op.attachments || []).map(function (b) {
             return { nome: b.getName(), tipo: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
           }) };
}
function cxgConversa_(d) {
  var msgs = (d.msgs || []).map(cxgMensagem_);
  var faz = function (x, nome) { cxgApi_("naConversas", { ids: [d.id], faz: x, nome: nome || "" }); };
  return {
    getId: function () { return String(d.id); },
    getMessages: function () { return msgs; },
    moveToTrash: function () { faz("LIXEIRA"); },
    moveToArchive: function () { faz("ARQUIVAR"); },
    moveToInbox: function () { faz("ENTRADA"); },
    addLabel: function (lab) { faz("MARCAR", lab.getName()); }
  };
}
function cxgMarcador_(m) {
  return {
    getName: function () { return m.nome; },
    getUnreadCount: function () { return m.naoLidos || 0; },
    getThreads: function (ini, max) { return (cxgApi_("doMarcador", { nome: m.nome, ini: ini, max: max }) || []).map(cxgConversa_); }
  };
}
function cxgGmail_() {
  return {
    search: function (q, ini, max) { return (cxgApi_("buscar", { q: q, ini: ini || 0, max: max || 50 }) || []).map(cxgConversa_); },
    getUserLabels: function () { return (cxgApi_("marcadores", {}) || []).map(cxgMarcador_); },
    getUserLabelByName: function (nome) {
      var m = (cxgApi_("marcadores", {}) || []).filter(function (x) { return x.nome === nome; })[0];
      return m ? cxgMarcador_(m) : null;
    },
    createLabel: function (nome) { cxgApi_("criarMarcador", { nome: nome }); return cxgMarcador_({ nome: nome, naoLidos: 0 }); },
    getThreadById: function (id) {
      try { return cxgConversa_(cxgApi_("conversa", { id: id })); }
      catch (e) { if (/não está mais/.test(e.message)) return null; throw e; }
    },
    getMessageById: function (id) {
      try { return cxgMensagem_(cxgApi_("mensagem", { id: id })); }
      catch (e) { if (/não está mais/.test(e.message)) return null; throw e; }
    }
  };
}

/** Uma conversa da secretaria@ (id "S:…") com a cara de uma linha da ponte. */
function cxgLinha_(id) {
  var th = cxgGmail_().getThreadById(String(id).substring(CXG_PREFIXO.length));
  return th ? cxsLinhaDeThreadFin_(th, true, null, "SECRETARIA") : null;
}

/** Ligada? (para a tela mostrar as pastas só quando der para abrir). */
function cxgLigada_() {
  try { cxgConfig_(); return true; } catch (e) { return false; }
}
