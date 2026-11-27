/**
 * TESTE — diagnosticoFilaOficiosSISGEP (DiagnosticoFilaOficios.gs): SOMENTE LEITURA e diz a causa em palavras.
 * PROVA (emulador): cota, gatilho, contagem por status, os que esperam, veredito; e que NADA é gravado, enviado nem criado.
 * NÃO PROVA: o Gmail/Apps Script de verdade (cota real, gatilhos reais).
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const fila = g.obterOuCriarAbaFilaOficios_();
const hm = g.getHeaderMap_(fila);
function escrever(linhas) {
  if (fila.getLastRow() > 1) fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).clearContent();
  linhas.forEach((d, i) => Object.keys(d).forEach(k => { if (hm[k]) fila.getRange(2 + i, hm[k]).setValue(d[k]); }));
}
const agora = new Date();
escrever([
  { NUMERO_OFICIO: "500/2026", ESCOLA: "COLEGIO ALFA", STATUS: "PENDENTE", EMAILS_TODOS: "a@alfa.br;b@alfa.br;c@alfa.br", TENTATIVAS: 0, DATA_CRIACAO: agora },
  { NUMERO_OFICIO: "501/2026", ESCOLA: "COLEGIO BETA", STATUS: "ERRO", EMAILS_TODOS: "d@beta.br", TENTATIVAS: 1, ULTIMO_ERRO: "Cota diária estourada", DATA_CRIACAO: agora, DATA_ULTIMA_TENTATIVA: agora },
  { NUMERO_OFICIO: "502/2026", ESCOLA: "COLEGIO GAMA", STATUS: "ERRO_PERMANENTE", EMAILS_TODOS: "f@gama.br", TENTATIVAS: 3, ULTIMO_ERRO: "E-mail inválido", DATA_ULTIMA_TENTATIVA: agora },
  { NUMERO_OFICIO: "503/2026", ESCOLA: "COLEGIO DELTA", STATUS: "ENVIADO", EMAILS_TODOS: "g@delta.br", TENTATIVAS: 1, DATA_ENVIO: agora }
]);
const abasAntes = ss.getSheets().map(s => s.getName()).join("|");
b.fluxo("DIAGNÓSTICO · fila de ofícios");

b.passo("1. Cota normal: lista o que espera e diz que a rodada deve enviar");
g.__cotaEmailRestante = 80;
amb.outbox.length = 0;
const r = g.diagnosticoFilaOficiosSISGEP();
b.ok(/Por status: .*ENVIADO 1.*ERRO 1.*ERRO_PERMANENTE 1.*PENDENTE 1/.test(r.texto), "contagem por status", r.texto.split("\n").find(l => /Por status/.test(l)));
b.ok(/Esperando envio \(PENDENTE ou ERRO\): 2 ofício\(s\), ~4 destinatário/.test(r.texto), "2 esperando, ~4 destinatários", r.texto.split("\n").find(l => /Esperando/.test(l)));
b.ok(/500\/2026 · COLEGIO ALFA · PENDENTE/.test(r.texto) && /501\/2026 .* erro: Cota diária estourada/.test(r.texto), "lista cada um com status e último erro");
b.ok(/ERRO_PERMANENTE: 1/.test(r.texto) && /502\/2026/.test(r.texto) && /E-mail inválido/.test(r.texto), "mostra o erro permanente");
b.ok(/Enviados HOJE: 1/.test(r.texto), "enviados hoje");
b.ok(/LEITURA: Há ofício esperando e a cota cobre/.test(r.texto), "veredito: a cota cobre", r.texto.split("\n").pop());
b.ok(!/@/.test(r.texto), "não imprime endereço de e-mail");

b.passo("2. Cota zerada: o veredito é a cota");
g.__cotaEmailRestante = 0;
const r2 = g.diagnosticoFilaOficiosSISGEP();
b.ok(/ABAIXO DE 5/.test(r2.texto) && /LEITURA: A COTA DE E-MAIL ACABOU/.test(r2.texto), "diz que a cota acabou e que nada se perdeu", r2.texto.split("\n").pop());

b.passo("3. Fila sem nada esperando: diz que o defeito é antes do envio");
escrever([{ NUMERO_OFICIO: "600/2026", ESCOLA: "COLEGIO X", STATUS: "ENVIADO", EMAILS_TODOS: "x@x.br", DATA_ENVIO: agora }]);
g.__cotaEmailRestante = 80;
const r3 = g.diagnosticoFilaOficiosSISGEP();
b.ok(/LEITURA: Nenhum ofício esperando/.test(r3.texto) && /nem entrou na fila/.test(r3.texto), "aponta a emissão", r3.texto.split("\n").pop());

b.passo("4. SOMENTE LEITURA: nada gravado, nada enviado, nenhuma aba criada");
escrever([
  { NUMERO_OFICIO: "500/2026", ESCOLA: "COLEGIO ALFA", STATUS: "PENDENTE", EMAILS_TODOS: "a@alfa.br", TENTATIVAS: 0, DATA_CRIACAO: agora }]);
const antes2 = JSON.stringify(fila.getDataRange().getValues());
g.diagnosticoFilaOficiosSISGEP();
b.igual(JSON.stringify(fila.getDataRange().getValues()), antes2, "a fila ficou IDÊNTICA");
b.igual(amb.outbox.length, 0, "nenhum e-mail saiu");
b.igual(ss.getSheets().map(s => s.getName()).join("|"), abasAntes, "nenhuma aba criada");
b.resumo();
