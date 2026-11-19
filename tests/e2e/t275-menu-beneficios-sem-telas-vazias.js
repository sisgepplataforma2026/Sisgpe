/**
 * MENU DE BENEFÍCIOS SEM TELA EM BRANCO (19/11/2026). Guriri Beach, Pousada Club Assefaz e Central de solicitações abriam uma área vazia
 * (os painéis nunca receberam conteúdo, desde 01/09/2026). O usuário: "É necessária? ... Pode" → os botões do menu e os dois cartões da
 * página inicial de Benefícios ficam escondidos. Nada foi apagado: os painéis e o mapa de títulos continuam no arquivo.
 * NÃO PROVA: o aspecto na tela real (só o HTML é conferido aqui).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
b.fluxo("MENU · Benefícios: sem item que abre tela em branco");
const botao = (sub) => { const m = html.match(new RegExp('<button[^>]*data-sub-mod="beneficios:' + sub + '"[^>]*>')); return m ? m[0] : ""; };
["guririBeach", "assefaz", "historico"].forEach((s) => b.ok(/\bhidden\b/.test(botao(s)) && /display:none/.test(botao(s)), "menu: '" + s + "' está escondido"));
["parqueChina", "vouchers"].forEach((s) => b.ok(botao(s) && !/\bhidden\b/.test(botao(s)) && !/display:none/.test(botao(s)), "menu: '" + s + "' continua visível"));
const cartao = (nome) => { const i = html.indexOf("<h4>" + nome + "</h4>"); const j = html.lastIndexOf("<article", i); return html.slice(j, html.indexOf(">", j) + 1); };
["Guriri Beach", "Pousada Club Assefaz"].forEach((n) => b.ok(/\bhidden\b/.test(cartao(n)) && /display:none/.test(cartao(n)), "cartão da página inicial: '" + n + "' escondido"));
["China Park Eco Resort", "Vouchers"].forEach((n) => b.ok(!/\bhidden\b/.test(cartao(n)), "cartão da página inicial: '" + n + "' continua visível"));
b.ok(/id="benefSubGuririBeach"/.test(html) && /id="benefSubAssefaz"/.test(html) && /id="benefSubHistorico"/.test(html) && /historico: \["Central de solicitações"/.test(html), "nada foi apagado: painéis e títulos continuam no arquivo");
b.resumo();
