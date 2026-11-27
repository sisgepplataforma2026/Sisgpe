/**
 * EMOJI QUE VIRA QUADRADINHO (19/11/2026). O 🪪 (cartão de identidade, Emoji 14, 2021) aparecia como "▯" no Windows 10 da secretaria: menu de
 * Sindicalização, Carteirinhas, Vouchers, RH e a categoria "Filiação" da Caixa. Trocado por 🆔. Este teste barra os emojis de versões novas
 * (Emoji 13 em diante, que o Windows 10 não desenha) em qualquer .html e .gs, para o defeito não voltar por outro caminho.
 * NÃO PROVA: o aspecto num Windows 10 real (a prova é a secretaria ver o ícone).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const raiz = path.join(__dirname, "../..");
b.fluxo("EMOJI · nada que o Windows 10 deixe como quadradinho");
const novos = /[\u{1FAA0}-\u{1FAFF}\u{1FA7B}\u{1FA7C}\u{1F972}\u{1F977}\u{1F978}\u{1F9CC}\u{1F6DD}-\u{1F6DF}\u{1F7F0}\u{1F6DE}]/gu;
const achados = [];
fs.readdirSync(raiz).filter((f) => /\.(html|gs)$/.test(f)).forEach((f) => {
  const t = fs.readFileSync(path.join(raiz, f), "utf8"); let m;
  novos.lastIndex = 0;
  while ((m = novos.exec(t))) achados.push(f + " " + m[0] + " U+" + m[0].codePointAt(0).toString(16).toUpperCase());
});
b.ok(achados.length === 0, "nenhum emoji de versão nova (Emoji 13+) nas telas e textos", achados.slice(0, 5).join(" | "));
const idx = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
b.ok(/🆔 Carteirinhas/.test(idx) && /<span class="spNI">🆔<\/span><div><strong>Sindicalização/.test(idx), "menu: Sindicalização e Carteirinhas usam o 🆔");
b.resumo();
