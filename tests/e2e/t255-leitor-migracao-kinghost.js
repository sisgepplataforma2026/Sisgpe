/**
 * A CÓPIA DE TODA A KINGHOST PARA O GMAIL DA SECRETARIA (12/11/2026) — o lado
 * do LEITOR (leitorMigracaoKingHost_). O usuário: "tem que copiar todos os
 * e-mails", "e todas as pastas também". Leitor DE VERDADE num contexto
 * separado; Gmail e Drive FALSOS; dados FICTÍCIOS.
 * NÃO PROVA: o Gmail de verdade aceitar o import (roda no ar, em lotes).
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const b = require("./base");
const gas = require("./gas");
const ctx = { Buffer, JSON, Math, Date, RegExp, Error, String, Number, Boolean, Object, Array, Function, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent };
ctx.globalThis = ctx; vm.createContext(ctx); gas.install(ctx, {});
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", "..", "leitor-secretaria", "LeitorSecretaria.gs.txt"), "utf8"), ctx);

/* Drive falso: pasta da migração com lotes (subpastas) de arquivos .eml. */
function arq(nome, desc, tam) { return { getName: () => nome, getDescription: () => JSON.stringify(desc), getSize: () => tam || 100,
  getBlob: () => ({ getBytes: () => Buffer.from("Subject: x\r\n\r\ncorpo") }) }; }
function lote(nome, arqs) { const l = { nome, arqs }; l.obj = { getName: () => l.nome, setName: n => { l.nome = n; },
  getFiles: () => { let i = 0; return { hasNext: () => i < arqs.length, next: () => arqs[i++] }; } }; return l; }
const lotes = [
  lote("lote-000002", [arq("000000-9.eml", { r: "OFICIOS/2025", s: false, u: false, m: "<c@x>" })]),
  lote("lote-000001", [arq("000000-1.eml", { r: "FICHAS DE SINDICALIZAÇÃO", s: false, u: true, m: "<a@x>" }),
                       arq("000001-2.eml", { r: "", s: true, u: false, m: "<b@x>" }),
                       arq("000002-3.eml", { r: "FICHAS DE SINDICALIZAÇÃO", s: false, u: false, m: "<ja@x>" }),
                       arq("000003-4.eml", { r: "ABRIR", s: false, u: false, m: "<grande@x>" }, 40000000)]),
  lote("enchendo-lote-000003", [arq("000000-5.eml", { r: "X", s: false, u: false, m: "<e@x>" })])
];
ctx.DriveApp.searchFolders = q => { let dado = !/Migração KingHost/.test(q); return { hasNext: () => !dado, next: () => { dado = true;
  return { getFolders: () => { let i = 0; const l = lotes.map(x => x.obj); return { hasNext: () => i < l.length, next: () => l[i++] }; } }; } }; };
/* Gmail falso */
const rotulos = {}, importados = [], modificados = [];
ctx.GmailApp.createLabel = n => { rotulos[n] = "L" + Object.keys(rotulos).length; return {}; };
let recusaSent = false;
ctx.Gmail = { Users: {
  Labels: { list: () => ({ labels: Object.keys(rotulos).map(n => ({ name: n, id: rotulos[n] })) }) },
  Messages: {
    list: (u, op) => ({ messages: /ja@x/.test(op.q) ? [{ id: "EXISTE" }] : [] }),
    modify: (rec, u, id) => modificados.push({ id, add: rec.addLabelIds }),
    import: (rec, u, blob, op) => { if (recusaSent && rec.labelIds.indexOf("SENT") > -1) throw new Error("Invalid label: SENT");
      importados.push({ labels: rec.labelIds, op }); return {}; }
  } } };

b.fluxo("MIGRAÇÃO KINGHOST · o leitor põe no Gmail");
b.passo("1. Cada e-mail vai para a pasta de mesmo nome, fora da caixa de entrada");
const r = ctx.leitorMigracaoKingHost_();
const nomeDe = id => Object.keys(rotulos).find(n => rotulos[n] === id) || id;
const l1 = importados.map(x => x.labels.map(nomeDe));
b.ok(l1.some(l => l[0] === "FICHAS DE SINDICALIZAÇÃO" && l.indexOf("UNREAD") > -1), "pasta com acento criada; não lido continua não lido", JSON.stringify(l1));
b.ok(l1.some(l => l.length === 1 && l[0] === "SENT"), "enviado → Itens enviados");
b.ok(l1.every(l => l.indexOf("INBOX") === -1), "nada vai para a caixa de entrada");
b.ok(importados.every(x => x.op.internalDateSource === "dateHeader"), "com a data original do e-mail");
b.passo("2. Já existe no Gmail (mesmo Message-ID): não duplica, só ganha a pasta");
b.ok(modificados.length === 1 && modificados[0].id === "EXISTE" && nomeDe(modificados[0].add[0]) === "FICHAS DE SINDICALIZAÇÃO", "ganhou a pasta");
b.ok(r.totais.jaTinha === 1 && r.totais.grandes === 1, "contados: 1 já tinha, 1 grande demais", JSON.stringify(r.totais));
b.passo("3. Lote terminado vira 'OK'; o que ainda está enchendo não é tocado");
b.ok(lotes[1].nome === "lote-000001 OK" && lotes[0].nome === "lote-000002 OK", "lotes 1 e 2 terminados", lotes.map(l => l.nome).join(", "));
b.ok(lotes[2].nome === "enchendo-lote-000003" && !importados.some(x => x.labels.map(nomeDe).indexOf("X") > -1), "o 'enchendo' fica para depois");
b.ok(importados.findIndex(x => x.labels.map(nomeDe)[0] === "OFICIOS/2025") === importados.length - 1, "lotes em ordem (1 antes do 2)");
b.passo("4. Se o Gmail recusar 'Itens enviados', vai para a pasta KINGHOST ENVIADOS");
recusaSent = true; importados.length = 0;
lotes.push(lote("lote-000004", [arq("000000-6.eml", { r: "", s: true, u: false, m: "<s2@x>" })]));
ctx.leitorMigracaoKingHost_();
b.ok(importados.length === 1 && nomeDe(importados[0].labels[0]) === "KINGHOST ENVIADOS", "plano B");
b.passo("5. Teto de tempo: para no meio do lote e continua do mesmo ponto");
const props = ctx.PropertiesService.getScriptProperties();
importados.length = 0;
const muitos = []; for (let i = 0; i < 5; i++) muitos.push(arq("00000" + i + "-x.eml", { r: "P", s: false, u: false, m: "<t" + i + "@x>" }));
lotes.push(lote("lote-000005", muitos));
const agoraReal = Date.now; let t = 0; Date.now = () => (t += 40000);   // cada passo "gasta" 40 s
ctx.leitorMigracaoKingHost_();
Date.now = agoraReal;
const parou = importados.length;
b.ok(parou > 0 && parou < 5 && JSON.parse(props.getProperty("MIG_ATUAL")).lote === "lote-000005", "parou no meio (" + parou + " de 5)");
ctx.leitorMigracaoKingHost_();
b.igual(importados.length, 5, "e terminou depois, sem repetir");
b.passo("6. Teto do dia: não toma o tempo do leitor");
props.setProperty("MIG_DIA", JSON.stringify({ d: ctx.Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd"), ms: 99999999 }));
lotes.push(lote("lote-000006", [arq("000000-7.eml", { r: "P", s: false, u: false, m: "<z@x>" })]));
b.ok(ctx.leitorMigracaoKingHost_().pausa === "teto do dia", "pausa até amanhã");
b.passo("7. Conta quase cheia: para antes de lotar (folga de 2 GB)");
props.setProperty("MIG_DIA", "{}");
const GB = 1024 * 1024 * 1024;
ctx.DriveApp.getStorageLimit = () => 15 * GB;
ctx.DriveApp.getStorageUsed = () => 13.5 * GB;
importados.length = 0;
const rr = ctx.leitorMigracaoKingHost_();
b.ok(/sem espaço/.test(rr.pausa) && importados.length === 0, "não importa nada", rr.pausa);
ctx.DriveApp.getStorageUsed = () => 13 * GB - 150;   // cabe 1 arquivo de 100 bytes, não 2
lotes.push(lote("lote-000007", [arq("000000-a.eml", { r: "P", s: false, u: false, m: "<y1@x>" }), arq("000001-b.eml", { r: "P", s: false, u: false, m: "<y2@x>" })]));
const r2 = ctx.leitorMigracaoKingHost_();
/* O lote 6 (1 arquivo, parado pelo teto do dia) vem antes; depois dele só sobram 50 bytes. */
b.ok(/sem espaço/.test(r2.pausa || "") && importados.length === 1 && JSON.parse(props.getProperty("MIG_ATUAL")).lote === "lote-000007",
  "importa o que cabe e para, guardando o ponto (" + importados.length + ")", JSON.stringify(r2));
b.resumo();
