/**
 * DECLARAÇÃO · TEXTO DO WHATSAPP (27/11/2026) — o texto é do usuário, palavra por palavra. Prova: o texto sai IDÊNTICO ao que ele escreveu
 * (nome, número, instituição, data e período no lugar certo); com o PDF já aberto por link leva o link; sem isso diz que o documento segue
 * por e-mail (link de arquivo privado não abriria no celular do diretor); linha sem dado some; a função NÃO altera compartilhamento de arquivo.
 * NÃO PROVA: o WhatsApp de verdade.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
b.fluxo("DECLARAÇÃO · texto do WhatsApp");
const esperado = [
  "Olá, Wanderson! Tudo bem? 😊", "",
  "Aqui é do *SindEducação-ES*.", "",
  "✅ Sua *Declaração de Liberação Sindical* foi emitida com sucesso!", "",
  "📄 *Declaração:* nº 002/2026",
  "🏫 *Instituição de ensino:* Teste",
  "📅 *Data da liberação:* 28/11/2026",
  "🕒 *Período:* Integral", "",
  "📥 *Acesse sua declaração:*",
  "https://drive.google.com/file/d/ABC/view", "",
  "Guarde este documento e apresente-o à direção da instituição de ensino, quando solicitado.", "",
  "Desejamos um excelente e abençoado dia!", "",
  "*SindEducação-ES*",
  "Compromisso com os educadores."
].join("\n");
const dados = { nome: "WANDERSON NASCIMENTO CASTELO", numero: "002/2026", escola: "Teste", dataLiberacao: "28/11/2026", periodoRotulo: "Integral", link: "https://drive.google.com/file/d/ABC/view" };
b.igual(g.declTextoWhatsapp_(dados), esperado, "com o link: o texto sai IDÊNTICO ao que o usuário escreveu");
const sem = g.declTextoWhatsapp_(Object.assign({}, dados, { link: "" }));
b.ok(/📥 \*O documento segue por e-mail\.\*/.test(sem) && !/drive\.google/.test(sem) && !/Acesse sua declaração/.test(sem), "sem link: 'O documento segue por e-mail' e nenhum endereço de arquivo privado");
b.ok(sem.split("\n")[0] === "Olá, Wanderson! Tudo bem? 😊" && /Compromisso com os educadores\.$/.test(sem), "o resto do texto continua igual (abertura e despedida)");
const falta = g.declTextoWhatsapp_({ nome: "", numero: "9/2026", escola: "", dataLiberacao: "", periodoRotulo: "", link: "" });
b.ok(/^Olá! Tudo bem\? 😊/.test(falta) && !/Instituição de ensino|Data da liberação|Período/.test(falta) && /nº 9\/2026/.test(falta), "linha sem dado some, em vez de sair vazia");
b.passo("a função de preparar não mexe em compartilhamento");
const fonte = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "DeclaracaoDiretor.gs"), "utf8");
const corpo = fonte.slice(fonte.indexOf("function declPrepararWhatsapp("), fonte.indexOf("function declConfirmarWhatsapp("));
b.ok(!/setSharing|arquivoAplicarExcecao_|arquivoAplicarPolitica_/.test(corpo.replace(/\/\*[\s\S]*?\*\//g, "")), "declPrepararWhatsapp só LÊ o compartilhamento (getSharingAccess); não chama setSharing nem exceção");
b.resumo();
