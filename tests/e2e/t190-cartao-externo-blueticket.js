/**
 * TESTE — O CARTÃO DO SISGEP COM O QR DA BLUETICKET
 *
 * "Os ingressos serão emitidos pela Blueticket, validados pela Blueticket. Só
 * que o QR Code da Blueticket eu anexo no SISGEP. O SISGEP vai gerar o mesmo
 * ingresso, bonito, com o mesmo QR Code, com as informações do associado, e a
 * gente envia pelo zap." — você, 18/09/2026.
 *
 * E o motivo, que é a régua deste teste: "eu tô com receio de chegar na hora
 * da festa e o aplicativo não funcionar, o QR Code não ler".
 *
 * ENTÃO O QUE ESTE TESTE GUARDA, ANTES DE QUALQUER OUTRA COISA, é que o
 * conteúdo do QR do nosso cartão seja EXATAMENTE o número da Blueticket. Um
 * prefixo, um zero à esquerda, um espaço — qualquer diferença e o aplicativo
 * da portaria recusa um ingresso legítimo, na fila, com a pessoa na frente.
 *
 * O QUE ESTE TESTE NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 * que o aplicativo da Blueticket LÊ o nosso cartão. Isso só o aparelho deles
 * responde, com o cartão impresso na mão. O roteiro vai no fim.
 */
const b = require("./base");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* O número real do ingresso que você mandou — 20/12/2025, Luciana. */
const NUMERO = "76902432";

b.fluxo("CARTÃO EXTERNO · o QR é o número da Blueticket, sem invenção");

b.passo("Os dados do evento valem para o lote inteiro");
const cfg = g.cartaoExterno_salvarCfg({
  evento: "No Ritmo da Vida",
  data: "Sábado, 20 de dezembro de 2025 • Abertura 19:00 • Início 20:00",
  local: "Espaço Patrick Ribeiro - Novo Aeroporto de Vitória",
  cidade: "Vitória, ES"
}, TOKEN);
b.ok(cfg.ok && cfg.cfg.evento === "No Ritmo da Vida",
  "nome, data e local ficam guardados uma vez só", cfg.cfg.evento);

b.passo("A importação aceita o que a tela leu dos PDFs");
const imp = g.cartaoExterno_importar([
  { numero: NUMERO, nome: "LUCIANA RODRIGUES VIEIRA PORTUGAL",
    arquivo: "13- Ingresso - NO RITMO DA VIDA - 76902432.pdf", origemNumero: "QR+ARQUIVO" },
  { numero: "76902433", arquivo: "14- Ingresso - 76902433.pdf", origemNumero: "ARQUIVO" },
  { numero: "", arquivo: "arquivo-sem-numero.pdf" }
], TOKEN);
b.ok(imp.ok, "o lote entra", imp.mensagem);
b.igual(imp.novos, 2, "dois ingressos com número entram");
b.igual(imp.recusados.length, 1, "e o arquivo sem número é recusado, dizendo qual");

const lista = g.cartaoExterno_listar(TOKEN);
b.igual(lista.total, 2, "a lista mostra os dois");
b.igual(lista.contagem.PRONTO, 1, "um pronto — tem nome");
b.igual(lista.contagem.SEM_NOME, 1, "e um esperando nome, em vez de sumir da tela");

b.passo("Reimportar o mesmo lote ATUALIZA, não duplica");
/* A secretaria vai baixar o lote mais de uma vez. Dois cartões com o mesmo
   número circulando é o tipo de confusão que só aparece na fila da portaria. */
const reimp = g.cartaoExterno_importar([
  { numero: NUMERO, nome: "LUCIANA RODRIGUES VIEIRA PORTUGAL", arquivo: "x.pdf" }
], TOKEN);
b.igual(reimp.novos, 0, "nada de novo");
b.igual(reimp.atualizados, 1, "o que já existia foi atualizado");
b.igual(g.cartaoExterno_listar(TOKEN).total, 2, "e a lista continua com dois");

b.passo("O zero à esquerda não cria uma segunda pessoa");
const zero = g.cartaoExterno_importar([{ numero: "0076902432", nome: "LUCIANA" }], TOKEN);
b.igual(zero.novos, 0, "'0076902432' é o mesmo ingresso que '76902432'");
b.igual(g.cartaoExterno_listar(TOKEN).total, 2, "a lista não cresceu");

/* ══ O CORAÇÃO DO TESTE ═══════════════════════════════════════════════════ */
b.passo("O QR do nosso cartão carrega o número da Blueticket — e nada mais");

const ger = g.cartaoExterno_gerar(NUMERO, TOKEN);
b.ok(ger.ok, "o cartão é gerado", ger.mensagem);

const pedidosQr = amb.fetches.filter(f => /quickchart\.io\/qr/.test(f.url));
b.igual(pedidosQr.length, 1, "uma imagem de QR foi pedida");

const texto = decodeURIComponent((pedidosQr[0].url.match(/[?&]text=([^&]*)/) || [])[1] || "");
b.igual(texto, NUMERO,
  "e o conteúdo é EXATAMENTE o número do ingresso — sem prefixo, sem URL, sem sufixo",
  JSON.stringify(texto));
b.ok(/ecLevel=H/.test(pedidosQr[0].url),
  "no nível de correção mais alto: com oito dígitos não cresce, e aguenta dobra e reflexo");
b.ok(/margin=2/.test(pedidosQr[0].url),
  "com zona de silêncio em volta — é onde leitor costuma falhar");

b.passo("O número vai impresso, grande, embaixo do QR");
/* É o que salva a fila quando a tela do celular está escura: a portaria
   digita o número no aplicativo da Blueticket. */
const html = g.cartaoExterno_html_(
  { NUMERO: NUMERO, NOME: "LUCIANA RODRIGUES VIEIRA PORTUGAL", SETOR: "Cortesia", TIPO: "Cortesia" },
  g.cartaoExterno_lerCfg_(), "data:image/png;base64,AAAA");
b.ok(html.indexOf('<div class="numero">' + NUMERO + "</div>") > -1,
  "o número aparece em campo próprio, não só dentro do QR");
b.ok(/font-size:27px[^}]*letter-spacing/.test(html.replace(/\s+/g, "")) ||
     /\.numero\{[^}]*font-size:27px/.test(html.replace(/\s+/g, "")),
  "em corpo grande, legível de longe");
b.ok(html.indexOf("LUCIANA RODRIGUES VIEIRA PORTUGAL") > -1, "o nome do associado está no cartão");
b.ok(html.indexOf("No Ritmo da Vida") > -1, "o evento também");
b.ok(html.indexOf("Espaço Patrick Ribeiro") > -1, "e o local");

/* ══ A ESCOLA E A ARTE — 19/09/2026 ═══════════════════════════════════════ */
b.passo("A escola vem do cadastro, não da mão de ninguém");
/* "É possível incluir o nome da escola?" — você. E ela é o campo que resolve
   homônimo na fila: dois "José Carlos" viram duas pessoas quando a escola
   está no cartão. Pela REGRA Nº 0.6, dado que o sistema tem não se digita. */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let abaAssoc = ss.getSheetByName("Associados");
if (!abaAssoc) abaAssoc = ss.insertSheet("Associados");
abaAssoc.getRange(1, 1, 1, 5).setValues([["Nome", "CPF", "Nome fantasia", "Celular", "Filiado"]]);
abaAssoc.getRange(2, 1, 1, 5).setValues([
  ["GABRIEL MOZER FRAGA", "11144477735", "EEEFM MARIA ORTIZ", "27999887766", "S"]
]);

g.cartaoExterno_importar([{ numero: "69621594", arquivo: "11- Ingresso - 69621594.pdf" }], TOKEN);
const vinc = g.cartaoExterno_vincular("69621594", { cpf: "11144477735" }, TOKEN);
b.ok(vinc.ok, "o vínculo por CPF é aceito");
b.igual(vinc.nome, "GABRIEL MOZER FRAGA", "o nome veio do cadastro, sem ninguém digitar");
b.igual(vinc.telefone, "27999887766", "e o telefone junto — é por ele que o zap sai");

const gabriel = g.cartaoExterno_listar(TOKEN).itens
  .filter(function (i) { return i.numero === "69621594"; })[0];
b.igual(gabriel.escola, "EEEFM MARIA ORTIZ", "a escola também veio do cadastro");
b.igual(gabriel.status, "PRONTO", "e o ingresso saiu de 'falta o nome' sozinho");

/* A ORIGEM FICA À VISTA, como manda a REGRA Nº 0.6: dado preenchido em
   silêncio é o que vira erro que ninguém percebe. */
b.ok(/cadastro de associados/i.test(vinc.observacao || ""),
  "e a tela diz de onde vieram, em vez de parecer conferido", vinc.observacao);

b.passo("A escola aparece no cartão");
const htmlEscola = g.cartaoExterno_html_(
  { NUMERO: "69621594", NOME: "GABRIEL MOZER FRAGA", ESCOLA: "EEEFM MARIA ORTIZ",
    SETOR: "Cortesia", TIPO: "Cortesia" }, g.cartaoExterno_lerCfg_(), "data:image/png;base64,AA");
b.ok(htmlEscola.indexOf("EEEFM MARIA ORTIZ") > -1, "com o nome da escola impresso");
b.ok(htmlEscola.indexOf(">Escola</div>") > -1, "sob o rótulo próprio");

b.passo("Cartão de quem não tem escola no cadastro não fica com rótulo vazio");
/* Rótulo "Escola" com nada embaixo é pior que a ausência da linha: parece
   que faltou dado na hora de imprimir. */
const semEscola = g.cartaoExterno_html_(
  { NUMERO: "1", NOME: "FULANO", ESCOLA: "", SETOR: "Cortesia", TIPO: "Cortesia" },
  g.cartaoExterno_lerCfg_(), "data:image/png;base64,AA");
b.ok(semEscola.indexOf(">Escola</div>") === -1, "a linha inteira some");

b.passo("A arte do evento entra como faixa no topo");
/* "Tem como colocar a imagem do evento?" — você. Ela entra ACIMA do bloco
   navy, e não atrás do texto: arte clara engole letra branca, arte carregada
   engole qualquer letra, e quem descobre é quem recebeu o cartão. */
const ARTE = "data:image/png;base64,AAAAARTE";
const comArte = g.cartaoExterno_html_(
  { NUMERO: "1", NOME: "FULANO", SETOR: "Cortesia", TIPO: "Cortesia" },
  g.cartaoExterno_lerCfg_(), "data:image/png;base64,AA", ARTE);
b.ok(comArte.indexOf('<img class="arte" src="' + ARTE + '"') > -1, "a arte aparece no cartão");
b.ok(comArte.indexOf('class="topo compacto"') > -1,
  "e o bloco navy encolhe, para o cartão não virar duas tarjas do mesmo tamanho");
b.ok(comArte.indexOf('<img class="arte"') < comArte.indexOf('class="topo'),
  "a arte vem ANTES do texto, não por trás dele");

b.passo("Sem arte, o cartão continua inteiro");
b.ok(semEscola.indexOf('class="arte"') === -1, "nenhuma imagem quebrada aparece");
b.ok(semEscola.indexOf('class="topo"') > -1, "e o bloco navy volta ao tamanho cheio");

b.passo("Arte que não carrega não derruba a geração");
/* O ingresso vale pelo QR. Perder o cartão inteiro por causa de uma figura
   seria trocar um cartão feio por nenhum cartão. */
b.igual(g.cartaoExterno_arteDataUri_(""), "", "sem arte configurada, devolve vazio");
b.igual(g.cartaoExterno_arteDataUri_("https://exemplo.invalido/arte.png"), "",
  "endereço que não devolve imagem também — e sem estourar");

b.passo("É o padrão visual do SISGEP, não uma paleta nova");
["#001f4d", "#002f6c", "#C9A84C"].forEach(function (cor) {
  b.ok(html.toUpperCase().indexOf(cor.toUpperCase()) > -1, "usa " + cor + " do Design System");
});
b.ok(/Plus Jakarta Sans/.test(html), "e a tipografia do sistema");

b.passo("O cartão não depende de buscar imagem na hora de virar PDF");
/* O conversor do Apps Script não roda script de CDN: um QR gerado por
   JavaScript sairia EM BRANCO no PDF, e ninguém perceberia até a portaria.
   Por isso a imagem entra embutida, como no ingresso da Festa. */
b.ok(html.indexOf('src="data:image/png;base64,') > -1,
  "a imagem do QR vai embutida no próprio HTML");
b.ok(!/<script/.test(html), "e não há script nenhum para o conversor ignorar");

b.passo("O PDF foi guardado com nome que se acha na pasta");
const arquivos = (amb.driveFiles || []).filter(f => /Ingresso - /.test(f.name));
b.igual(arquivos.length, 1, "um arquivo criado");
b.ok(/^Ingresso - No Ritmo da Vida - 76902432 - LUCIANA/.test(arquivos[0].name),
  "com evento, número e nome — quem procura na pasta acha pelos três", arquivos[0].name);

/* ══ AS RECUSAS QUE PROTEGEM A FILA ═══════════════════════════════════════ */
b.passo("Cartão sem nome não é gerado");
/* Cartão com o nome vazio é pior que cartão nenhum: parece pronto, vai para o
   zap, e a pessoa recebe um ingresso que não diz de quem é. */
const semNome = g.cartaoExterno_gerar("76902433", TOKEN);
b.ok(!semNome.ok && /sem nome/i.test(semNome.mensagem),
  "recusa explicando o que fazer", semNome.mensagem);

b.passo("Número que não foi importado não vira cartão");
const inexistente = g.cartaoExterno_gerar("99999999", TOKEN);
b.ok(!inexistente.ok && /não foi importado/i.test(inexistente.mensagem),
  "porque um número inventado aqui é um ingresso recusado na portaria",
  inexistente.mensagem);

b.passo("Marcar como enviado exige que o cartão exista");
b.ok(!g.cartaoExterno_marcarEnviado("76902433", TOKEN).ok,
  "sem cartão gerado, não há o que enviar");
const env = g.cartaoExterno_marcarEnviado(NUMERO, TOKEN);
b.ok(env.ok && env.status === "ENVIADO", "com cartão gerado, o envio fica registrado");
b.igual(g.cartaoExterno_listar(TOKEN).contagem.ENVIADO, 1, "e a contagem acompanha");

b.passo("Reimportar não apaga o que já foi gerado e enviado");
/* Apagar um envio registrado faria a secretaria mandar o mesmo cartão duas
   vezes — e o associado achar que o primeiro não valia. */
g.cartaoExterno_importar([{ numero: NUMERO, nome: "LUCIANA RODRIGUES VIEIRA PORTUGAL" }], TOKEN);
b.igual(g.cartaoExterno_listar(TOKEN).contagem.ENVIADO, 1,
  "continua como enviado depois da reimportação");

b.passo("Sem os dados do evento, nada é gerado");
g.cartaoExterno_salvarCfg({ evento: "", data: "", local: "", cidade: "" }, TOKEN);
g.cartaoExterno_importar([{ numero: "76902440", nome: "TESTE SEM EVENTO" }], TOKEN);
const semEvento = g.cartaoExterno_gerar("76902440", TOKEN);
b.ok(!semEvento.ok && /evento/i.test(semEvento.mensagem),
  "um cartão sem nome de evento não diz para onde a pessoa vai", semEvento.mensagem);

b.passo("O SISGEP não valida, não marca usado e não conta entrada");
/* Esta é a garantia do desenho inteiro: quem valida é a Blueticket. Se um dia
   alguém acrescentar um "marcar como utilizado" aqui, passam a existir duas
   verdades sobre quem entrou — e a da portaria é a única que importa. */
const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EventosCartaoExterno.gs"), "utf8");

/* A VARREDURA TIRA OS COMENTÁRIOS ANTES DE PROCURAR, e a primeira versão não
   tirava: ela acusou o arquivo por causa do próprio comentário que EXPLICA a
   ausência da palavra. Varredura que lê comentário mede o que se escreveu
   sobre o código, não o código — é a mesma armadilha do t138. */
const codigo = fonte
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .toLowerCase();
["utilizado", "checkin", "validarqr", "marcarentrada"].forEach(function (palavra) {
  b.ok(codigo.indexOf(palavra) === -1,
    "nada de '" + palavra + "' no código — validação não é nossa");
});

b.naoTestavel("O aplicativo da Blueticket lendo o nosso cartão",
  "só o aparelho deles responde. Roteiro: gerar um cartão, imprimir e abrir " +
  "no celular, e ler com o app do Blueticket nos dois — de dia e com pouca luz");
b.naoTestavel("A aparência do cartão no papel",
  "nenhum teste daqui aplica folha de estilo nem converte PDF de verdade");
b.resumo();
