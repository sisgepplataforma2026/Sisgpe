/**
 * TEXTO DO INGRESSO NO WHATSAPP (12/11/2026). O usuário: "melhora o texto do
 * ingresso no zap" e "ele tem que levar o documento também para conferir".
 */
const b = require("./base");
const { g } = b.subir({});
b.fluxo("INGRESSO · texto do WhatsApp");
const url = "https://script.google.com/macros/s/X/exec?ingresso=abc";
const t = g.compasso_textoEntrega_({ nome: "MARIA DA SILVA", numero: "CV26-0042" }, url);
b.passo("1. Nome e número; sem link (vai em PDF)");
b.ok(/Olá, \*Maria\*!/.test(t), "primeiro nome, sem caixa alta", t.split("\n")[0]);
b.ok(t.indexOf("CV26-0042") > -1, "número do ingresso");
b.ok(t.indexOf(url) === -1 && !/https?:\/\//.test(t) && /segue em PDF/.test(t), "sem link: o ingresso vai em PDF");
b.passo("2. Quando e onde (os mesmos dados do e-mail)");
const f = g.compasso_dadosDaFesta_();
b.ok(t.indexOf(f.local) > -1 && t.indexOf(f.horaAbertura) > -1 && t.indexOf(f.horaInicio) > -1, "local e horários", f.local);
const ext = g.compasso_dataPorExtenso_(f.data);
b.ok(!ext || t.indexOf(ext) > -1, "data por extenso", ext);
b.passo("3. Documento com foto para conferência");
b.ok(/documento oficial com foto/.test(t) && /conferência/.test(t), "pede o documento");
b.passo("4. O e-mail diz o mesmo");
const html = g.compasso_emailIngressoHtml_({ nome: "MARIA DA SILVA", numero: "CV26-0042" }, url, false);
b.ok(/documento oficial com foto/.test(html), "e-mail também pede o documento");
b.passo("5. Sem dado, sem linha vazia de rótulo");
b.ok(!/\*Quando:\*\s*(,|$)/m.test(t) && !/undefined|null/.test(t), "nada de undefined/null");
console.log("\n" + t + "\n");
b.resumo();
