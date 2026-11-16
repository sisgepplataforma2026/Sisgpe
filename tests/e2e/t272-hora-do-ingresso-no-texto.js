/**
 * A HORA DO INGRESSO NO TEXTO (16/11/2026). O WhatsApp do ingresso saiu com "às Sat Dec 30 1899 20:00:00 GMT-0306 (Horário Padrão
 * de Brasília)": a planilha guarda a hora como valor de tempo (Date de 30/12/1899) e o código a convertia com String().
 * Dados FICTÍCIOS. NÃO PROVA: a planilha de verdade (o emulador monta o mesmo tipo de Date).
 */
const b = require("./base");
const { g } = b.subir({});
b.fluxo("HORA · de valor de tempo da planilha para texto");
const T = (h, m) => new Date(1899, 11, 30, h, m, 0);   // como a planilha entrega "20:00"
b.ok(g.compasso_horaTexto_(T(20, 0)) === "20h" && g.compasso_horaTexto_(T(19, 30)) === "19h30" && g.compasso_horaTexto_(T(9, 5)) === "9h05", "Date de hora vira '20h', '19h30', '9h05'");
b.ok(g.compasso_horaTexto_("20:00") === "20h" && g.compasso_horaTexto_("19:30") === "19h30" && g.compasso_horaTexto_("20:00:00") === "20h", "texto '20:00' vira '20h'");
b.ok(g.compasso_horaTexto_("19h30") === "19h30" && g.compasso_horaTexto_("20h") === "20h" && g.compasso_horaTexto_("") === "" && g.compasso_horaTexto_(null) === "", "o que já é '20h' e o vazio ficam como estão");
b.ok(g.compasso_horaTexto_(new Date("invalido")) === "", "data inválida não vira lixo no texto");
b.fluxo("HORA · no texto padrão do ingresso");
g.eventosV2Repo_listar_ = () => [{ tipo: "FESTA", ano: 2026, horaAbertura: T(19, 30), horaInicio: T(20, 0), localNome: "Espaço Fictício", endereco: "Av. Fictícia, 1" }];
const f = g.compasso_dadosDaFesta_();
b.ok(f.horaInicio === "20h" && f.horaAbertura === "19h30", "os dados da festa já trazem '20h' e '19h30'", JSON.stringify([f.horaInicio, f.horaAbertura]));
const txt = g.compasso_textoEntrega_({ nome: "Adna Fictícia", numero: "ABC-0001" }, "");
b.ok(/às 20h/.test(txt) && /a partir das 19h30/.test(txt) && !/1899|GMT|Horário Padrão/.test(txt), "o WhatsApp diz 'às 20h' e 'a partir das 19h30', sem 1899 nem GMT", txt.split("\n").filter(l => /Quando|Portões/.test(l)).join(" | "));
b.ok(/Na entrada, apresente/.test(txt) && /QR Code do PDF/.test(txt) && /documento oficial com foto/.test(txt) && /segue em PDF nesta conversa/.test(txt), "e o texto padrão continua inteiro (incluindo 'Na entrada, apresente')");
b.resumo();
