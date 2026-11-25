/**
 * TESTE — O DIAGNÓSTICO DE LATÊNCIA É SOMENTE LEITURA E RODA INTEIRO
 * (DiagnosticoLatencia.gs). Ele vai ser colado na PRODUÇÃO, que está lenta e
 * tem dado real: não pode gravar, enviar nem criar nada, e não pode travar no
 * meio por um item que falhe.
 * NÃO PROVA: os milissegundos — só o Google os produz.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
b.fluxo("DIAGNÓSTICO DE LATÊNCIA · somente leitura");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const antes = { abas: ss.getSheets().map(s => s.getName() + ":" + s.getLastRow()).join("|"), caixa: amb.outbox.length };
const props = JSON.stringify(g.PropertiesService.getScriptProperties().getProperties());

b.passo("1. ping devolve sem fazer nada");
b.ok(typeof g.pingSISGEP() === "number", "pingSISGEP existe e devolve número");

b.passo("2. roda inteiro e devolve os 12 itens");
const r = g.diagnosticoLatenciaSISGEP();
b.ok(r && Array.isArray(r.itens) && r.itens.length === 12, "12 itens medidos", String(r && r.itens && r.itens.length));
b.ok(r.itens.every(i => typeof i.ms === "number"), "cada item tem tempo em ms");
b.ok(typeof r.totalDentroMs === "number", "devolve o total dentro da função");

b.passo("3. item que falha não derruba os outros");
const rr = g.diagnosticoLatenciaSISGEP();
b.ok(rr.itens.length === 12, "mesmo com serviço não emulado, os 12 itens aparecem (erro vira texto, não exceção)");

b.passo("3b. 2ª rodada (caminhos) também roda inteira, sem derrubar por item não emulado");
const r2 = g.diagnosticoCaminhosSISGEP();
b.ok(r2 && Array.isArray(r2.itens) && r2.itens.length === 10, "10 itens medidos", String(r2 && r2.itens && r2.itens.length));
b.ok(r2.itens.every(i => typeof i.ms === "number"), "cada item tem tempo");

b.passo("4. NÃO GRAVA NADA");
const depois = { abas: ss.getSheets().map(s => s.getName() + ":" + s.getLastRow()).join("|"), caixa: amb.outbox.length };
b.igual(depois.abas, antes.abas, "nenhuma aba ganhou ou perdeu linha, nenhuma aba criada");
b.igual(depois.caixa, antes.caixa, "nenhum e-mail enviado");
b.igual(JSON.stringify(g.PropertiesService.getScriptProperties().getProperties()), props, "nenhuma propriedade do script alterada");
b.resumo();
