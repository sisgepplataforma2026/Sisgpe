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
/* A SAUDAÇÃO PASSOU A USAR SÓ O PRIMEIRO NOME — "Olá, Maria! Tudo bem?", a
   mesma do ofício. O sobrenome não aparece mais, então o escape se prova no
   próprio helper, logo abaixo, e não neste corpo. */
b.ok(ind.htmlBody.indexOf("Olá, <strong>Maria</strong>! Tudo bem?") > -1,
  "e abre com a saudação única do SISGEP");
b.ok(g.sisgepSaudacaoEmail_("Ana&Paula Souza").indexOf("&amp;") > -1,
  "nome com & é escapado — não pode quebrar o e-mail");
b.ok(g.sisgepSaudacaoEmail_("<script>x</script> Souza").indexOf("&lt;script&gt;") > -1,
  "e um < digitado por engano vira texto, não tag");
/* ESTA ASSERÇÃO ACERTAVA PELO MOTIVO ERRADO, e escondeu um defeito por um
   dia inteiro. Ela procurava a cor "#001f4d" no corpo — e a cor aparecia
   numa BORDA do bloco de motivo, não no cabeçalho. O indeferimento estava
   saindo SEM cabeçalho e SEM rodapé, texto solto, e o teste dizia verde.

   Cor não é casca. O que prova a casca são as PARTES dela. */
["SINDEDUCAÇÃO-ES", "CNPJ: 31.815.780", "Nossa Senhora dos Navegantes"].forEach(function (parte) {
  b.ok(ind.htmlBody.indexOf(parte) > -1,
    "o indeferimento traz a casca do SISGEP: " + parte);
});
b.ok(ind.htmlBody.indexOf("BOL-2026-0001") > -1,
  "com o protocolo no cabeçalho, em dourado");
b.ok(ind.htmlBody.indexOf("Solicitação não deferida") > -1,
  "e o badge dizendo o assunto em uma palavra");

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

/* ── 4b. A CASCA É UMA SÓ, DO SISGEP INTEIRO ────────────────────────────── */
/* "O padrão SISGEP é o único, independente se é para a instituição ou para o
   associado" — você, 17/09/2026. Bolsas tinha o próprio cabeçalho navy, quase
   igual ao do ofício e diferente o bastante para quem recebe os dois notar. */
b.passo("a casca de Bolsas É a casca do SISGEP");

const cascaDireta = g.sisgepEmailHtml_({
  numero: "540/2026", rotuloNumero: "Ofício nº", badge: "Filiação", corpo: "<p>x</p>"
});
const cascaBolsas = g.voucherEmailHtml_("Bolsa aprovada", "<p>x</p>",
  { protocolo: "BOLSA-2026-9", badge: "Bolsa aprovada" });

/* As partes fixas têm de ser IDÊNTICAS nas duas — é isso que "um padrão só"
   quer dizer. Comparar as strings inteiras não serviria: número e badge
   mudam de propósito. */
["SINDEDUCAÇÃO-ES", "CNPJ: 31.815.780/0001-51",
 "Sindicato dos Educadores Técnico-Administrativos",
 "Nossa Senhora dos Navegantes", "(27) 3222-2706"].forEach(function (parte) {
  b.ok(cascaDireta.indexOf(parte) > -1 && cascaBolsas.indexOf(parte) > -1,
    "presente nas duas: " + parte);
});

b.ok(cascaBolsas.indexOf("BOLSA-2026-9") > -1, "o protocolo de Bolsas entra onde o ofício põe o número");
b.ok(cascaBolsas.indexOf("Protocolo") > -1, "com o rótulo certo");
b.ok(cascaDireta.indexOf("Ofício nº") > -1, "e o ofício mantém o dele");

/* QUEM NÃO TEM NÚMERO NÃO FICA COM BURACO. */
const semNumero = g.sisgepEmailHtml_({ badge: "Declaração", corpo: "<p>x</p>" });
b.ok(semNumero.indexOf("text-align:right;white-space:nowrap") === -1,
  "sem número, o canto direito nem é desenhado");
b.ok(semNumero.indexOf("SINDEDUCAÇÃO-ES") > -1, "e o resto da casca continua inteiro");

/* TABELA, NÃO FLEX: Outlook ignora flexbox e jogaria o número para baixo do
   nome. Foi por isso que o cabeçalho usa table. */
b.ok(cascaDireta.indexOf("<table role='presentation'") > -1,
  "o cabeçalho usa tabela, que o Outlook entende");

/* O QUE VEM DE DADO PRECISA SER ESCAPADO. */
const comBravo = g.sisgepEmailHtml_({ numero: "A & B <x>", rotuloNumero: "N", corpo: "" });
b.ok(comBravo.indexOf("A &amp; B &lt;x&gt;") > -1, "número vindo de dado é escapado");

/* A SAUDAÇÃO TAMBÉM É UMA SÓ. */
b.ok(g.sisgepSaudacaoEmail_("MARCELHA ALINE PINTO GOMES").indexOf("Olá, <strong>Marcelha</strong>! Tudo bem?") > -1,
  "a saudação do SISGEP: 'Olá, Marcelha! Tudo bem?'");
b.ok(g.sisgepSaudacaoEmail_("").indexOf("Olá! Tudo bem?") > -1,
  "e sem nome ela não fica com um vazio no meio");

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
