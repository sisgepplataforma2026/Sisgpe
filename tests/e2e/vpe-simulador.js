/**
 * Caixa da Secretaria, LEITOR e IA para os testes de Pedidos de voucher por
 * e-mail (t206 backend, t207 tela).
 *
 * O LEITOR É O DE VERDADE (leitor-secretaria/LeitorSecretaria.gs.txt), carregado
 * num contexto separado — como no ar, onde ele é outro projeto, em outra
 * conta. A caixa simulada pertence a ESSE contexto. O SISGEP fica com um
 * GmailApp que EXPLODE se for usado para ler ou responder: a regra do
 * usuário de 21/10/2026 ("os e-mails da secretaria não devem ser acessados
 * pelo financeiro") vira asserção, não promessa.
 *
 * Cada e-mail carrega um marcador CASO:xxx e a "IA" devolve a extração que
 * uma leitura correta daquele e-mail daria — o que se testa é o que o
 * sistema faz com a leitura, não a leitura.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gas = require("./gas");

const PONTE_ID = "PONTE_SECRETARIA_TESTE";
const CONTA_SECRETARIA = "sindeducacaosecretaria@gmail.com";

function contextoDoLeitor() {
  const ctx = { Buffer, JSON, Math, Date, RegExp, Error, String, Number, Boolean, Object, Array, Function,
                parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const amb = gas.install(ctx, {});
  const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "leitor-secretaria", "LeitorSecretaria.gs.txt"), "utf8");
  vm.runInContext(src, ctx, { filename: "LeitorSecretaria.gs" });
  ctx.Session.getEffectiveUser = () => ({ getEmail: () => CONTA_SECRETARIA });
  ctx.SpreadsheetApp.create = () => ctx.SpreadsheetApp.openById(PONTE_ID);
  /* A pasta do emulador não tem compartilhamento; aqui registra a quem foi dado. */
  const pastas = {};
  const criarPasta = ctx.DriveApp.createFolder;
  ctx.DriveApp.createFolder = n => {
    const p = criarPasta(n);
    p.compartilhada = [];
    p.addViewer = e => { p.compartilhada.push(e); return p; };
    p.addEditor = e => { p.compartilhada.push(e); return p; };
    pastas[p.getId()] = p;
    return p;
  };
  const pegarPasta = ctx.DriveApp.getFolderById;
  ctx.DriveApp.getFolderById = id => pastas[id] || pegarPasta(id);
  return { ctx, amb };
}

function instalar(g, amb, opcoes) {
  opcoes = opcoes || {};
  const L = contextoDoLeitor();
  const leitor = L.ctx;
  /* ══════════════ A CAIXA SIMULADA ══════════════ */
  let seq = 0;
  const threads = [];
  const tocadas = [];          // qualquer markRead/arquivar/estrela vira registro aqui
  function anexo(nomeOriginal, tipo) {
    let nome = nomeOriginal;
    const bytes = Buffer.from("conteudo-" + nome);
    return {
      getName: () => nome, getContentType: () => tipo,
      getBytes: () => bytes, getSize: () => bytes.length,
      copyBlob() { return this; }, setName(n) { nome = n; return this; }
    };
  }
  function mensagem(th, de, corpo, anexos, para) {
    const id = "M" + (++seq);
    const m = {
      getId: () => id, getFrom: () => de, getReplyTo: () => "",
      getTo: () => para || "secretaria@sindeducacao.com", getCc: () => "",
      getSubject: () => th.assunto, getPlainBody: () => corpo, getBody: () => corpo,
      getDate: () => new Date(2026, 9, 10, 9, seq),
      getAttachments: () => anexos || [],
      getThread: () => th.obj,
      isUnread: () => true, isStarred: () => false,
      markRead: () => tocadas.push("markRead " + id),
      moveToArchive: () => tocadas.push("archive " + id),
      reply(body, op) {
        amb.outbox.push(Object.assign({ via: "reply", emResposta: id, to: vpeEmail(de),
          subject: "Re: " + th.assunto, body }, op || {}));
        th.msgs.push(mensagem(th, "SindEducação-ES <secretaria@sindeducacao.com>", "(nossa resposta)", [],
          vpeEmail(de)));
      }
    };
    return m;
  }
  function vpeEmail(s) { const m = String(s).match(/[^<\s]+@[^>\s]+/); return m ? m[0] : s; }
  function novaThread(assunto, de, corpo, anexos, para) {
    const th = { id: "T" + (threads.length + 1), assunto, msgs: [] };
    th.etiquetas = [];
    th.obj = { getId: () => th.id, getMessages: () => th.msgs.slice(), getFirstMessageSubject: () => assunto,
               markRead: () => tocadas.push("markRead " + th.id), moveToArchive: () => tocadas.push("archive " + th.id),
               addLabel: et => { th.etiquetas.push(et.getName()); return th.obj; } };
    th.msgs.push(mensagem(th, de, corpo, anexos, para));
    threads.push(th);
    return th;
  }
  function responder(th, de, corpo, anexos) { th.msgs.push(mensagem(th, de, corpo, anexos)); }
  /* A caixa é DO LEITOR. A busca respeita o destino: só entra o que foi
     mandado para a secretaria@ — um e-mail ao financeiro@ nunca aparece. */
  leitor.GmailApp.search = (q) => {
    consultas.push(String(q));
    return threads.filter(t => !t.arquivada && t.msgs.some(m =>
      /secretaria@sindeducacao\.com/i.test(m.getTo() + "," + m.getCc()))).map(t => t.obj);
  };
  leitor.GmailApp.getThreadById = id => (threads.find(t => t.id === id) || {}).obj || null;
  leitor.GmailApp.getMessageById = id => {
    for (const t of threads) for (const m of t.msgs) if (m.getId() === id) return m;
    return null;
  };
  leitor.GmailApp.getAliases = () => (opcoes.semAlias ? [] : ["secretaria@sindeducacao.com"]);
  const etiquetasCriadas = {};
  leitor.GmailApp.getUserLabelByName = n => etiquetasCriadas[n] || null;
  /* Como no Gmail: a etiqueta devolve as conversas que a têm. */
  leitor.GmailApp.createLabel = n => (etiquetasCriadas[n] = { getName: () => n,
    getThreads: (ini, max) => threads.filter(t => (t.etiquetas || []).indexOf(n) > -1)
      .slice(ini || 0, (ini || 0) + (max || 100)).map(t => t.obj) });
  /* As PASTAS importadas da KingHost viram etiquetas no Gmail (importação
     única). Conversa de pasta fica ARQUIVADA: não aparece na busca da caixa. */
  const pastasImportadas = {};
  leitor.GmailApp.getUserLabels = () => Object.keys(etiquetasCriadas).map(n => etiquetasCriadas[n])
    .concat(Object.keys(pastasImportadas).map(n => ({
      getName: () => n,
      getThreads: (ini, max) => pastasImportadas[n].slice(ini, ini + max).map(t => t.obj)
    })));
  function pasta(nome, th) {
    th.arquivada = true;
    (pastasImportadas[nome] = pastasImportadas[nome] || []).push(th);
    return th;
  }

  /* O ROBÔ DA KINGHOST (tools/kinghost-pendentes) deixa cada pendente como
     .eml numa pasta do Drive; o leitor põe no Gmail pelo serviço avançado.
     Aqui: a pasta é uma lista de {nome, raw}; o import vira conversa na
     etiqueta pedida — como o Gmail faz (sem INBOX: fica arquivada). */
  const drivePendentes = { existe: false, arquivos: [] };
  const importados = [];
  leitor.DriveApp.searchFolders = () => {
    let dado = !drivePendentes.existe;
    return { hasNext: () => !dado, next: () => { dado = true; return {
      getFiles: () => { let i = 0; const l = drivePendentes.arquivos.slice();
        return { hasNext: () => i < l.length, next: () => { const a = l[i++];
          return { getName: () => a.nome, getBlob: () => ({ getBytes: () => Buffer.from(a.raw) }) }; } }; } }; } };
  };
  leitor.Gmail = { Users: {
    Labels: { list: () => ({ labels: Object.keys(etiquetasCriadas).concat(Object.keys(pastasImportadas))
      .map(n => ({ name: n, id: "L:" + n })) }) },
    Messages: { import: (rec, user, blob, op) => {
      const texto = Buffer.from(rec.raw, "base64url").toString("utf8");
      const cab = n => ((texto.match(new RegExp("^" + n + ":\\s*(.*)$", "mi")) || [])[1] || "").trim();
      const nome = String(rec.labelIds[0]).replace(/^L:/, "");
      delete etiquetasCriadas[nome];   // a etiqueta vira "pasta" (com conversas)
      importados.push({ etiqueta: nome, op });
      return pasta(nome, novaThread(cab("Subject"), cab("From"), texto.split(/\r?\n\r?\n/).slice(1).join("\n"),
        [], cab("To")));
    } } } };

  /* A IA DO LEITOR (29/10/2026): ela diz o que é cada e-mail, dentro da conta
     da Secretaria. No simulador: "voucher"/"bolsa" no texto é VOUCHER; o
     marcador TIPO:XXX força outro tipo (propaganda que fala em desconto…);
     estadoIALeitor.fora simula "sem crédito". */
  const chamadasIALeitor = [];
  const estadoIALeitor = { fora: false };
  leitor.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");
  leitor.UrlFetchApp.fetch = function (url, params) {
    const payload = JSON.parse(params.payload);
    const texto = String(payload.messages[0].content);
    const email = texto.slice(texto.indexOf("E-MAIL:"));
    chamadasIALeitor.push({ modelo: payload.model, texto: email });
    if (estadoIALeitor.fora) {
      return { getResponseCode: () => 400,
               getContentText: () => JSON.stringify({ error: { message: "Your credit balance is too low" } }) };
    }
    const forcado = (email.match(/TIPO:(\w+)/) || [])[1];
    const tipo = forcado || (/voucher|bolsa/i.test(email) ? "VOUCHER" : "OUTRO");
    const resp = { tipo, resposta: tipo === "VOUCHER" ? "SIM" : "NAO", pedido: "", motivo: "simulado" };
    return { getResponseCode: () => 200,
             getContentText: () => JSON.stringify({ content: [{ type: "text", text: JSON.stringify(resp) }] }) };
  };
  const consultas = [];

  /* O SISGEP NÃO PODE TOCAR EM CAIXA NENHUMA. */
  const tentativasSisgep = [];
  ["search", "getThreadById", "getMessageById", "getInboxThreads", "sendEmail", "createDraft"].forEach(fn => {
    g.GmailApp[fn] = function () {
      tentativasSisgep.push(fn);
      throw new Error("O SISGEP tentou usar GmailApp." + fn + " — a caixa da Secretaria é só do leitor");
    };
  });

  leitor.configurarLeitor();
  g.PropertiesService.getScriptProperties().setProperty("VOUCHER_PEDIDOS_PONTE_ID", PONTE_ID);
  const ponte = g.SpreadsheetApp.openById(PONTE_ID);

  /* ══════════════ A IA SIMULADA ══════════════
     Cada e-mail carrega um marcador CASO:xxx; a "IA" devolve a extração que
     uma leitura correta daquele e-mail daria. O que se testa é o que o
     sistema faz com ela. */
  const chamadasIA = [];
  const estadoIA = { voltou: false };   // "credit balance is too low" até alguém pôr crédito
  const EXTRACOES = {};
  const fetchOriginal = g.UrlFetchApp.fetch;
  g.UrlFetchApp.fetch = function (url, params) {
    if (String(url).indexOf("api.anthropic.com") === -1) return fetchOriginal(url, params);
    const payload = JSON.parse(params.payload);
    const blocos = payload.messages[0].content;
    const texto = blocos.filter(x => x.type === "text").map(x => x.text).join("\n");
    const casos = (texto.match(/CASO:(\w+)/g) || []).map(s => s.slice(5));
    const caso = casos[casos.length - 1];
    chamadasIA.push({ caso, anexos: blocos.filter(x => x.type !== "text").length, modelo: payload.model });
    if (caso === "FALHA" && !estadoIA.voltou) {
      return { getResponseCode: () => 500, getContentText: () => JSON.stringify({ error: { message: "sobrecarga" } }) };
    }
    const ext = typeof EXTRACOES[caso] === "function" ? EXTRACOES[caso]() : EXTRACOES[caso];
    return { getResponseCode: () => 200,
             getContentText: () => JSON.stringify({ content: [{ type: "text", text: JSON.stringify(ext || {}) }] }) };
  };

  const CC = (nome, cpf, comp, emp) => ({ indice: 1, tipo: "CONTRACHEQUE", nome_pessoa: nome, cpf, competencia: comp, empregador: emp, legivel: true });
  const RG = (i, nome, cpf, rg, nasc) => ({ indice: i, tipo: "RG", nome_pessoa: nome, cpf, rg: rg || "1234567", data_nascimento: nasc || "", legivel: true });
  const base = (o) => Object.assign({
    eh_pedido_voucher: true, titular: { nome: "", cpf: "", telefone: "" },
    beneficiario: { tipo: "TITULAR", nome: "", data_nascimento: "" },
    curso: "Pedagogia", modalidade: "GRADUACAO", area: "HUMANAS", instituicao_ensino: "FACULDADE X",
    periodo: "2027/1", regime: "SEMESTRAL", anexos: [], resumo: "pede voucher"
  }, o);

  return { threads, tocadas, chamadasIA, EXTRACOES, novaThread, responder, anexo, CC, RG, base,
           pdf: n => anexo(n, "application/pdf"), jpg: n => anexo(n, "image/jpeg"),
           leitor, ponte, consultas, tentativasSisgep, PONTE_ID, CONTA_SECRETARIA, estadoIA,
           chamadasIALeitor, estadoIALeitor, pasta, drivePendentes, importados,
           /** Um ciclo do leitor: copia o que chegou e envia o que está na fila. */
           ciclo: () => leitor.leitorCiclo(),
           aba: nome => ponte.getSheetByName(nome) };
}
module.exports = { instalar };
