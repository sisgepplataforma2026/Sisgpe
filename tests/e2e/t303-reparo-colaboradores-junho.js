/**
 * REPARO PONTUAL · Colaborador(es) dos ofícios de junho/2026 (OficiosReparoColaboradoresJunho.gs). Planilha FALSA, dados do reparo.
 * Prova: conferir NÃO grava; aplicar preenche só célula vazia, confere o tipo, trata duplicado e ausente, não sobrescreve,
 * é idempotente, e o reenvio passa a mostrar as pessoas. NÃO PROVA a planilha de produção (rodar Conferir lá primeiro).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 5).setValues([["Número do Ofício", "Tipo", "Escola (Razão Social)", "Colaborador(es)", "Status"]]);
const linhas = [
  ["215/2026", "Filiação", "", "", "ENVIADO"],
  ["232/2026", "Filiação", "", "", "ENVIADO"],
  ["225/2026", "Desfiliação", "", "", "ENVIADO"],
  ["223/2026", "Filiação", "", "1. JÁ ESTAVA\n2. PREENCHIDO", "ENVIADO"],
  ["226/2026", "Desfiliação", "", "", "ENVIADO"],            // tipo errado: o ofício 226 é Filiação
  ["228/2026", "Filiação", "", "", "ENVIADO"],
  ["228/2026", "Filiação", "", "", "ENVIADO"],                // duplicado: só a primeira
  ["300/2026", "Filiação", "", "", "ENVIADO"]                 // fora da lista: intocado
];
reg.getRange(2, 1, linhas.length, 5).setValues(linhas);
g.__usuarioAtivoEmail = ""; // como numa tela: visitante sem identidade
const ext = g.oficiosReparoColaboradoresJunhoAplicarSISGEP();
b.ok(ext && ext.erro === true, "de fora (tela, sem ser o dono no editor): RECUSA", ext && ext.mensagem);
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail; // como no editor: o dono
const col = (n) => reg.getRange(2 + n, 4).getValue();
b.ok(reg.getRange(2,4).getValue()==="","e a recusa não gravou nada");
b.fluxo("REPARO · conferir só lê");
const c = g.oficiosReparoColaboradoresJunhoConferirSISGEP();
b.ok(linhas.every((_, i) => i === 3 ? col(i) !== "" : col(i) === ""), "conferir não gravou nada");
b.ok(c.some(l => /215\/2026: ▶ preencheria 1/.test(l)) && c.some(l => /226\/2026: ✖ TIPO DIFERENTE/.test(l)) && c.some(l => /223\/2026: já tem/.test(l)) && c.some(l => /227\/2026: ✖ NÃO ENCONTRADO/.test(l)), "e diz o que faria em cada caso");
b.ok(!c.join("\n").match(/JOSIANE|MYLLENA|CLEBER/), "o log não mostra nomes");
b.fluxo("REPARO · aplicar");
const a = g.oficiosReparoColaboradoresJunhoAplicarSISGEP();
b.igual(col(0), "1. JOSIANE ALVES BARROSO DOS SANTOS", "215 preenchido");
b.igual(col(1), "1. MYLLENA SANTOS DA SILVA\n2. CAMILA SILVA DOS SANTOS", "232 com as duas, no formato da emissão");
b.igual(col(2).split("\n").length, 3, "225 com três nomes");
b.igual(col(3), "1. JÁ ESTAVA\n2. PREENCHIDO", "223 já preenchido: NÃO sobrescrito");
b.igual(col(4), "", "226 com tipo diferente: não mexeu");
b.ok(col(5) !== "" && col(6) === "", "228 duplicado: só a primeira linha");
b.igual(col(7), "", "300/2026 (fora da lista): intocado");
const a2 = g.oficiosReparoColaboradoresJunhoAplicarSISGEP();
b.ok(a2.some(l => /215\/2026: já tem/.test(l)) && col(0) === "1. JOSIANE ALVES BARROSO DOS SANTOS", "rodar de novo não muda nada (idempotente)");
b.passo("o reenvio passa a enxergar as pessoas");
g.ofDest_cacheRegistro_ = null;
const rr = g.ofDest_lerRegistroOficio_("232/2026");
b.igual(g.ofrPessoasDoRegistro_(rr.colaboradores), ["MYLLENA SANTOS DA SILVA", "CAMILA SILVA DOS SANTOS"], "ofrPessoasDoRegistro_ devolve Myllena e Camila");
b.resumo();
