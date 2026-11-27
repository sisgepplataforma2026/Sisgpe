/**
 * WHATSAPP NO COMPUTADOR (16/11/2026). O aplicativo do WhatsApp para Windows estraga os emojis (aparece "�") quando o link wa.me vem
 * do navegador. No COMPUTADOR a tela abre o WhatsApp WEB (web.whatsapp.com/send); no CELULAR continua o wa.me (abre o app certo).
 * Executa a própria função urlZap, extraída do HTML. NÃO PROVA: o WhatsApp de verdade (só ele mostra se o emoji chegou).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const html = fs.readFileSync(path.join(__dirname, "../../CompassoIngressos.html"), "utf8");
const ini = html.indexOf("function urlZap(u){"), fim = html.indexOf("\n  }", ini) + 4;
b.fluxo("WHATSAPP · computador abre o Web, celular abre o app");
b.ok(ini > 0 && fim > ini, "a função urlZap existe na tela");
const urlZap = (ua) => new Function("window", "navigator", html.slice(ini, fim) + "; return urlZap;")({ navigator: { userAgent: ua } }, { userAgent: ua });
const U = "https://wa.me/5527999990001?text=Ol%C3%A1%20%F0%9F%8E%89";
const pc = urlZap("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36 Edg/130")(U);
b.ok(pc === "https://web.whatsapp.com/send?phone=5527999990001&text=Ol%C3%A1%20%F0%9F%8E%89", "computador: abre o WhatsApp Web, com o texto e o emoji codificados igual", pc);
b.ok(urlZap("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1")(U) === U && urlZap("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")(U) === U, "celular (iPhone e Android): continua o wa.me");
b.ok(urlZap("Mozilla/5.0 (Windows NT 10.0)")("https://exemplo.com/x") === "https://exemplo.com/x", "link que não é wa.me passa sem mudar");
b.resumo();
