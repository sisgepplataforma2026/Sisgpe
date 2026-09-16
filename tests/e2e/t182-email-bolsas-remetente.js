/**
 * TESTE — TODO E-MAIL DE BOLSAS SAI PELA PORTA DA SECRETARIA, COM A CARA DO SISGEP
 *
 * TRÊS DEFEITOS, UM PEDIDO SÓ. O usuário olhou o e-mail de indeferimento em
 * 16/09/2026 e disse "o texto deveria ser melhorado". Ao abrir, eram três
 * coisas separadas:
 *
 *   1. REMETENTE ERRADO. Todo envio do módulo usava `MailApp.sendEmail`, e
 *      MailApp IGNORA a opção `from` — em silêncio. Foi o mesmo defeito que
 *      fez a Declaração de Diretor sair da conta executora mesmo com o alias
 *      da Secretaria configurado. Só `GmailApp.createDraft().send()` respeita.
 *   2. SEM PADRÃO VISUAL. Cada e-mail montava o próprio HTML: um usava roxo
 *      (#5b21b6, #ede9fe), outro azul chapado, nenhum tinha o cabeçalho navy
 *      que todo documento do sistema abre.
 *   3. TEXTO SECO. O indeferimento comunicava a recusa sem dizer que o
 *      associado pode tentar de novo.
 *
 * O QUE ESTE TESTE FAZ DE VERDADE: sobe o emulador, chama o caminho de envio
 * e LÊ A CAIXA DE SAÍDA. Não basta ver `voucherEnviarMsg_` escrito no arquivo
 * — REGRA Nº -1: ler código não é testar. O que decide é o que saiu.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.join(__dirname, "..", "..");
const { g, amb } = b.subir();

b.fluxo("BOLSAS · E-mail sai pela Secretaria e com o padrão do SISGEP");

/* ── 1. O CAMINHO EXECUTA E SAI PELO GMAIL, NÃO PELO MAILAPP ────────────── */
b.passo("envio pelo helper do módulo");
amb.reset();
g.voucherEnviarMsg_({
  to: "associado@exemplo.com",
  cc: "secretaria@sindeducacao.com",
  subject: "Assunto de teste",
  htmlBody: g.voucherEmailHtml_("Título da faixa", "<p>Corpo.</p>")
});

b.igual(amb.outbox.length, 1, "o envio produziu exatamente um e-mail");
const env = amb.outbox[0];
b.igual(env.via, "GmailApp", "saiu pelo GmailApp (createDraft().send()), não pelo MailApp");
b.igual(env.from, "secretaria@sindeducacao.com",
  "com a Secretaria como remetente — que é o que o usuário exigiu");
b.igual(env.to, "associado@exemplo.com", "e chegou a quem devia");
b.igual(env.cc, "secretaria@sindeducacao.com",
  "o cc sobreviveu ao caminho do rascunho (era só de MailApp antes)");
b.ok(!!env.mensagemId, "e a mensagem ficou com id — ou seja, foi ENVIADA, não só rascunhada", env.mensagemId);

/* O rascunho só entra no outbox quando enviado. Se `send()` falha, o helper
   apaga o rascunho — não pode ficar lixo na conta da Secretaria. */
b.passo("o alias ausente não quebra o envio");
const semAlias = b.subir({ gmailAliases: [] });
semAlias.amb.reset();
semAlias.g.voucherEnviarMsg_({ to: "x@exemplo.com", subject: "s", htmlBody: "<p>c</p>" });
b.igual(semAlias.amb.outbox.length, 1, "sem o alias verificado o e-mail ainda sai");
b.ok(!semAlias.amb.outbox[0].from,
  "sem `from` forjado — o Gmail recusaria — mas o envio acontece");
b.igual(semAlias.amb.outbox[0].replyTo, "secretaria@sindeducacao.com",
  "e a resposta ainda volta para a Secretaria");

/* ── 2. O HTML CARREGA O PADRÃO VISUAL DO SISTEMA ───────────────────────── */
b.passo("a casca visual");
const html = g.voucherEmailHtml_("Voucher de Bolsa emitido", "<p>Miolo.</p>");
b.ok(html.indexOf("#001f4d") > -1, "usa o navy do Design System");
b.ok(html.indexOf("#C9A84C") > -1, "e o dourado institucional");
b.ok(html.indexOf("SINDEDUCAÇÃO-ES") > -1, "traz o nome do sindicato no cabeçalho");
b.ok(html.indexOf("secretaria@sindeducacao.com") > -1, "e o contato no rodapé");
b.ok(html.indexOf("<p>Miolo.</p>") > -1, "o corpo de quem chama entra dentro da casca");

/* ESCAPE NO TÍTULO. O título vem de código, mas o corpo às vezes carrega nome
   digitado por associado — se a casca não escapasse o que recebe como título,
   um "<" num texto futuro quebraria o e-mail inteiro. */
b.ok(g.voucherEmailHtml_("A & B <x>", "").indexOf("A &amp; B &lt;x&gt;") > -1,
  "o título é escapado antes de virar HTML");

/* ── 3. O TEXTO DO INDEFERIMENTO DIZ QUE DÁ PARA TENTAR DE NOVO ─────────── */
b.passo("o texto que o usuário mandou melhorar");
amb.reset();
g.enviarEmailIndeferimentoVoucher_(
  { EMAIL: "associado@exemplo.com", NOME_SOLICITANTE: "Maria & Silva" },
  "BOL-2026-0001",
  "Dependente fora da faixa etária prevista."
);
b.igual(amb.outbox.length, 1, "o indeferimento enviou");
const ind = amb.outbox[0];
b.igual(ind.via, "GmailApp", "também pela porta da Secretaria");
b.ok(ind.htmlBody.indexOf("Isso não impede novas solicitações") > -1,
  "e o texto diz, com todas as letras, que o associado pode solicitar de novo");
b.ok(ind.htmlBody.indexOf("Dependente fora da faixa etária prevista.") > -1,
  "o motivo registrado pela Secretaria aparece para quem recebe");
b.ok(ind.htmlBody.indexOf("BOL-2026-0001") > -1, "com o protocolo, para ela localizar o caso");
b.ok(ind.htmlBody.indexOf("Maria &amp; Silva") > -1,
  "e o nome do associado escapado — nome com & não pode quebrar o e-mail");
b.ok(ind.htmlBody.indexOf("#001f4d") > -1, "na mesma casca visual dos outros");

/* SEM E-MAIL NÃO SE ENVIA NADA. Um registro sem e-mail não pode virar envio
   para endereço vazio nem estourar exceção no meio da aprovação. */
amb.reset();
g.enviarEmailIndeferimentoVoucher_({ EMAIL: "", NOME_SOLICITANTE: "Sem Contato" }, "BOL-2026-0002", "motivo");
b.igual(amb.outbox.length, 0, "registro sem e-mail não gera envio");

/* ── 4. NÃO SOBROU MAILAPP EM LUGAR NENHUM DO MÓDULO ────────────────────── */
b.passo("a varredura do módulo inteiro");
const arquivos = fs.readdirSync(RAIZ).filter(f => /^Voucher.*\.gs$/.test(f));
b.ok(arquivos.length >= 5, "a varredura alcançou os arquivos do módulo", arquivos.join(", "));
arquivos.forEach(function (arq) {
  const src = fs.readFileSync(path.join(RAIZ, arq), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")   // o comentário CITA MailApp para explicar o defeito
    .replace(/\/\/[^\n]*/g, "");
  b.ok(src.indexOf("MailApp.sendEmail") === -1,
    arq + " não envia mais pelo MailApp");
});

/* ── 5. NENHUM E-MAIL DO MÓDULO MONTA CABEÇALHO PRÓPRIO ─────────────────── */
/* Era o defeito 2: um e-mail em roxo, outro em azul chapado, cada um com o
   seu <h2>. Agora todo corpo entra pela casca — ou pelo corpo do certificado,
   que é documento formatado à parte. A varredura olha CADA chamada de envio. */
b.passo("todo envio passa pela casca");
arquivos.forEach(function (arq) {
  const src = fs.readFileSync(path.join(RAIZ, arq), "utf8");
  const re = /voucherEnviarMsg_\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    /* Pular as DUAS definições do próprio par de helpers: elas não montam
       corpo nenhum, só repassam o que recebem. */
    if (/(function|return)\s+voucherEnviarMsg_\($/.test(src.slice(0, m.index + 18))) continue;
    /* A janela olha para TRÁS também: em VoucherEnvio o corpo é montado numa
       variável `msg` algumas linhas antes da chamada. Só olhar para a frente
       reprovaria um envio correto. */
    const trecho = src.slice(Math.max(0, m.index - 900), m.index + 900);
    b.ok(/voucherEmailHtml_\(|voucherCorpoEmail_\(/.test(trecho),
      arq + ": o envio na posição " + m.index + " usa a casca do SISGEP");
  }
});
/* E o <h2> colorido que cada um trazia não volta. */
arquivos.forEach(function (arq) {
  const src = fs.readFileSync(path.join(RAIZ, arq), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  b.ok(!/<h2 style='color:#(166534|92400e|002f6c)/.test(src),
    arq + " não tem mais cabeçalho de cor própria");
});

b.naoTestavel("o e-mail chegando de fato na caixa do associado",
  "entrega depende do Gmail real e do alias verificado na conta executora — roteiro manual: aprovar uma bolsa em homologação e conferir o remetente na mensagem recebida");
b.resumo();
