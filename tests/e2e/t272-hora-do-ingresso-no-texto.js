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
b.fluxo("TEXTO DO WHATSAPP · igual ao que o usuário colou (16/11/2026)");
const DATA = g.compasso_dadosDaFesta_().data;   // a data como o sistema a guarda
g.compasso_dadosDaFesta_ = () => ({ data: DATA, horaInicio: "20h", horaAbertura: "19h30", local: "Espaço Patrick Ribeiro", endereco: "Av. Roza Helena Schorling Albuquerque, S/N – Goiabeiras, Vitória/ES, 29109-350.", referencia: "Ao lado do Aeroporto de Vitória" });
const OURO = [
  "Olá, *Adna*! 🎉", "",
  "Sua inscrição na *Festa No Compasso da Vida 2026* foi confirmada, e seu ingresso já está pronto! 🎟️", "",
  "*Na entrada, apresente:*",
  "✅ O QR Code do ingresso em PDF (na tela do celular ou impresso);",
  "✅ Um *documento oficial com foto* (RG, CNH ou outro), para conferência.", "",
  "📅 *Data:* Sábado, 19 de dezembro de 2026", "",
  "🕗 *Horário:* 20h", "",
  "🚪 *Abertura dos portões:* 19h30", "",
  "📍 *Local:* Espaço Patrick Ribeiro",
  "Av. Roza Helena Schorling Albuquerque, S/N – Goiabeiras, Vitória/ES, 29109-350.",
  "(Ao lado do Aeroporto de Vitória)", "",
  "📄 *Seu ingresso com QR Code está disponível em PDF.* Guarde o arquivo no celular para apresentar na entrada.", "",
  "🔗 *Acesse ou baixe seu ingresso:*",
  "https://drive.google.com/file/d/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30/view", "",
  "⚠️ *Importante:* O ingresso é pessoal e válido para apenas uma entrada. Não compartilhe o arquivo com outras pessoas.", "",
  "Esperamos você para uma noite especial de celebração! 🎶🥳", "",
  "*SindEducação-ES*"].join("\n");
const gerado = g.cingTextoWhats_("ADNA DE JESUS VIEIRA SILVA", "https://drive.google.com/file/d/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30/view");
b.ok(gerado === OURO, "com PDF: a mensagem é IGUAL, caractere por caractere, à que o usuário colou", gerado === OURO ? "" : gerado.split("\n").map((l, i) => l === OURO.split("\n")[i] ? null : "linha " + (i + 1) + ": " + l).filter(Boolean).slice(0, 3).join(" | "));
const semPdf = g.cingTextoWhats_("Adna", "");
b.ok(semPdf === OURO.replace("🔗 *Acesse ou baixe seu ingresso:*\nhttps://drive.google.com/file/d/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30/view\n\n", ""), "sem PDF na pasta: a mesma mensagem, só sem a seção do link");
g.compasso_dadosDaFesta_ = () => ({ data: DATA, horaInicio: "", horaAbertura: "", local: "", endereco: "", referencia: "" });
const so = g.cingTextoWhats_("Ana", "");
b.ok(/📅 \*Data:\* Sábado, 19 de dezembro de 2026/.test(so) && !/Horário:|Abertura dos portões|📍/.test(so) && !/\n\n\n/.test(so), "campo sem dado não aparece e não deixa linha em branco sobrando");
// Categorias (decisão de 16/11/2026): só a frase de abertura muda; o resto da mensagem é idêntico para todos.
const fraseAssoc = "Sua inscrição na *Festa No Compasso da Vida 2026* foi confirmada, e seu ingresso já está pronto! 🎟️";
const fraseAcomp = "Seu ingresso como acompanhante na *Festa No Compasso da Vida 2026* já está pronto! 🎟️";
const fraseConv = "Você é nosso convidado na *Festa No Compasso da Vida 2026*, e seu ingresso já está pronto! 🎟️";
const PDFX = "https://drive.google.com/file/d/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30/view";
g.compasso_dadosDaFesta_ = () => ({ data: DATA, horaInicio: "20h", horaAbertura: "19h", local: "Clube", endereco: "Rua A", referencia: "perto" });
const tAssoc = g.cingTextoWhats_("Adna", PDFX, "associado"), tAcomp = g.cingTextoWhats_("Adna", PDFX, "acompanhante"), tConv = g.cingTextoWhats_("Adna", PDFX, "convite"), tCort = g.cingTextoWhats_("Adna", PDFX, "cortesia"), tPago = g.cingTextoWhats_("Adna", PDFX, "pago"), tSem = g.cingTextoWhats_("Adna", PDFX);
b.ok(tAssoc.includes(fraseAssoc) && tPago.includes(fraseAssoc) && tSem.includes(fraseAssoc), "associado, pago e sem categoria: 'inscrição confirmada'");
b.ok(tAcomp.includes(fraseAcomp) && !tAcomp.includes("inscrição"), "acompanhante: frase própria");
b.ok(tConv.includes(fraseConv) && tCort.includes(fraseConv) && !tConv.includes("inscrição"), "convidado (convite e cortesia): frase própria");
b.ok(tAcomp.replace(fraseAcomp, fraseAssoc) === tAssoc && tConv.replace(fraseConv, fraseAssoc) === tAssoc, "o resto da mensagem é idêntico entre as categorias");
const modelo = g.cingTextoWhats_("ZZNOMEZZ", "ZZPDFZZ", "ZZ");
b.ok(modelo.includes("ZZABERTURAZZ") && !modelo.includes("inscrição"), "modelo da tela leva a marca no lugar da frase (a tela troca por categoria)");
// 16/11/2026: o endereço do app abriu a tela de erro do Drive para quem clicou → a mensagem leva o link DIRETO do PDF; o cartão fica desligado.
b.ok(g.CING_USAR_CARTAO === false && g.cingCartaoBase_() === "", "link do cartão DESLIGADO: sem endereço do app na mensagem (a tela usa o link direto do PDF)");
g.ScriptApp.getService = () => ({ getUrl: () => "https://script.google.com/macros/s/XYZ/exec" });
b.ok(g.cingCartaoBase_() === "", "mesmo com o app publicado, enquanto desligado, não monta link do cartão");
// 18/11/2026: a TickOne escreve "Acompanhante do Associado"; sem reconhecer, o PDF ia para a pasta principal e o texto saía de associado.
b.ok(["Acompanhante do Associado", "Acompanhante de Associado", "Acompanhante Associado", "acompanhante", "ACOMPANHANTE DO ASSOCIADO"].every((r) => g.cingCategoria_(r) === "acompanhante"), "'Acompanhante do/de Associado' e variações = acompanhante");
b.ok(g.cingCategoria_("Associado") === "associado" && g.cingCategoria_("Convite") === "convite" && g.cingCategoria_("Convidado") === "convite" && g.cingCategoria_("Cortesia") === "cortesia" && g.cingCategoria_("Pago") === "pago" && g.cingCategoria_("") === "", "as outras categorias seguem iguais");
b.resumo();
