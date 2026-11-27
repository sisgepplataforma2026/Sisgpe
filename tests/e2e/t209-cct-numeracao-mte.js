/**
 * CCT — TEXTO QUE SAI PARA FORA CITA A NUMERAÇÃO DO MTE — 29/10/2026.
 *
 * Regra do usuário: "Sempre o MTE." A CCT 2026/2027 registrada no MTE
 * (ES000256/2026) numera a mensalidade sindical como 38ª, a taxa negocial
 * como 40ª e a assistência médica como "38ª – Assistência Médica". O texto
 * negociado usava 56, 57 e 58, e o sistema inteiro citava esses números —
 * a escola abria a CCT registrada e não achava a cláusula.
 *
 * Duas provas: (1) varredura — nenhum .gs/.html cita 56/57/58 como cláusula,
 * fora o módulo de Negociação Coletiva, que trabalha sobre o texto negociado;
 * (2) execução — o corpo real do e-mail de ofício de cada tipo e a base da
 * Sofia saem com a numeração nova.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const EXCECOES = ["NegociacaoAdmin.html", "NegociacaoColetiva.gs"];

b.fluxo("CCT · numeração do registro no MTE");

b.passo("1. Nenhum arquivo cita a numeração negociada das contribuições");
const achados = [];
fs.readdirSync(RAIZ).filter(f => /\.(gs|html)$/.test(f) && EXCECOES.indexOf(f) === -1).forEach(f => {
  fs.readFileSync(path.join(RAIZ, f), "utf8").split("\n").forEach((linha, i) => {
    /* Exceção única: o cabeçalho "CLÁUSULA 56 —" do CCTCore, que a Negociação lê. */
    if (f === "CCTCore.gs" && /"CLÁUSULA 5[678] — /.test(linha)) return;
    if (/cl[aá]usula\s+5[678]\b/i.test(linha)) achados.push(f + ":" + (i + 1));
  });
});
b.ok(achados.length === 0, "nenhuma citação de cláusula 56/57/58 fora da Negociação",
  achados.slice(0, 5).join(", "));

const { g } = b.subir({});

b.passo("2. O e-mail de cada tipo de ofício cita a cláusula do MTE");
const esperado = {
  "Filiação": /Cláusula 38ª da CCT 2026\/2027/,
  "Desfiliação": /Cláusula 38ª da CCT 2026\/2027/,
  "Taxa Negocial": /Cláusula 40ª da CCT 2026\/2027/,
  "Taxa Assistencial": /Cláusula 38ª – Assistência Médica, da CCT 2026\/2027/
};
Object.keys(esperado).forEach(tipo => {
  const corpo = String(g.montarEmailHTML_(tipo, "999/2026", tipo, 2, ""));
  b.ok(esperado[tipo].test(corpo), tipo + ": cita " + esperado[tipo].source.replace(/\\/g, ""),
    corpo.slice(0, 160));
});

b.passo("3. A base da Sofia traz as duas numerações e a multa limitada ao principal");
/* O cabeçalho fica na negociada: a Negociação Coletiva divide o texto por ele (t10). */
const cct = String(g.getCCTTexto_());
b.ok(/CLÁUSULA 56 — MENSALIDADE[^\n]*\n[^\n]*registro no MTE[^\n]*CLÁUSULA 38ª/.test(cct), "mensalidade: 56 negociada, com a 38ª do MTE logo abaixo");
b.ok(/CLÁUSULA 57 — TAXA NEGOCIAL[^\n]*\n[^\n]*registro no MTE[^\n]*CLÁUSULA 40ª/.test(cct), "taxa negocial: 57 negociada, com a 40ª do MTE logo abaixo");
b.ok(/CLÁUSULA 58 — ASSISTÊNCIA MÉDICA[^\n]*\n[^\n]*registro no MTE[^\n]*CLÁUSULA 38ª – ASSISTÊNCIA MÉDICA/.test(cct), "assistência médica: 58 negociada, com a 38ª do MTE logo abaixo");
b.ok(/Registro no MTE: ES000256\/2026/.test(cct), "o número do registro está no topo da CCT");
b.ok(/LIMITADA AO VALOR DO PRINCIPAL/.test(cct), "multa da mensalidade limitada ao principal, como no registro");

b.resumo();
