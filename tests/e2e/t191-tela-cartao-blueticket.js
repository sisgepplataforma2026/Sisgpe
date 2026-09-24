/**
 * TESTE — A TELA QUE VIRA INGRESSO DE BILHETERIA EM CARTÃO DO SISGEP
 *
 * O backend existia desde 18/09 e ninguém do lado da tela o alcançava: é o
 * mesmo caso da seção de dependentes (t189), e a REGRA Nº -1 chama isso de
 * "código escrito, correto e inalcançável". Este teste clica.
 *
 * O QUE ELE GUARDA COM MAIS CUIDADO é a leitura do número no nome do
 * arquivo. A bilheteria nomeia "13- Ingresso - EVENTO - 76902432.pdf": o
 * "13" é a posição no lote. Pegar o primeiro número em vez do último geraria
 * um lote inteiro de cartões com número de ordem no lugar do número do
 * ingresso — todos errados, e parecidos o bastante com o certo para ninguém
 * desconfiar até a portaria recusar o primeiro.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("TELA · Cartões de ingresso a partir da bilheteria");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("A tela de cartões", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const tela = dom.montar(g, ["EventosCartaoBlueticket.html"], { token: TOKEN });
const win = tela.win, doc = win.document;
doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

function campo(id) { return doc.getElementById(id); }
function clicar(sel) { return tela.clicar(sel); }

/* ── 1. O NÚMERO NO NOME DO ARQUIVO ──────────────────────────────────── */
b.passo("1. O número lido é o do INGRESSO, não a posição no lote");

b.igual(win.numeroDoArquivo("13- Ingresso - SINDEDUCACAO - ES - NO RITMO DA VIDA - 76902432.pdf"),
  "76902432", "pega o último número longo, não o '13' da frente");
b.igual(win.numeroDoArquivo("02- Ingresso - A VIDA E UMA FESTA - 98722216.pdf"),
  "98722216", "vale para qualquer posição do lote");
b.igual(win.numeroDoArquivo("Ingresso-69621594.pdf"), "69621594", "e sem posição também");
b.igual(win.numeroDoArquivo("0076902432.pdf"), "76902432",
  "zero à esquerda sai: é o mesmo ingresso, e duas linhas seriam dois cartões");
b.igual(win.numeroDoArquivo("comprovante.pdf"), "", "arquivo sem número não inventa nenhum");
b.igual(win.numeroDoArquivo("nota-123.pdf"), "",
  "e três dígitos não são número de ingresso — o piso é seis");

/* ── 1b. A PLANILHA COLADA ───────────────────────────────────────────── */
b.passo("1b. Planilha colada: o nome vem junto e ninguém vincula um por um");
/* "Vou importar a planilha" — você, 21/09/2026. Com ela o trabalho cai muito:
   o nome chega com o número, e a fila já nasce em PRONTO. */

const daPlanilha = win.lerColagem(
  "NÚMERO\tNOME\tESCOLA\n" +
  "76902432\tLuciana Rodrigues Vieira Portugal\tEEEFM Maria Ortiz\n" +
  "69621594\tGabriel Mozer Fraga\tColégio Salesiano\n");

b.igual(daPlanilha.length, 2, "duas linhas de dados");
b.igual(daPlanilha[0].numero, "76902432", "o número foi reconhecido");
b.igual(daPlanilha[0].nome, "Luciana Rodrigues Vieira Portugal", "o nome também");
b.igual(daPlanilha[0].escola, "EEEFM Maria Ortiz", "e a escola");

b.passo("O cabeçalho é descartado sozinho");
/* Quem copia a tabela inteira leva o cabeçalho junto, e um cartão para
   "NÚMERO / NOME" seria cômico na fila da portaria. */
b.ok(!daPlanilha.some(function (d) { return /N.MERO/i.test(d.nome); }),
  "nenhuma linha virou cartão do cabeçalho");

b.passo("A ordem das colunas não precisa ser a nossa");
/* Exigir ordem fixa seria exigir que a secretaria reorganizasse a planilha
   antes — trabalho que o programa faz melhor. */
const invertida = win.lerColagem("Gabriel Mozer Fraga;Colégio Salesiano;69621594");
b.igual(invertida.length, 1, "linha com o número no fim também é lida");
b.igual(invertida[0].numero, "69621594", "o número é achado por ser só dígitos");
b.igual(invertida[0].nome, "Gabriel Mozer Fraga", "e o nome, por ter letras");

b.passo("Separador de Excel, de CSV e de vírgula, todos servem");
b.igual(win.lerColagem("76902432\tFULANO").length, 1, "TAB (é o que o Excel cola)");
b.igual(win.lerColagem("76902432;FULANO").length, 1, "ponto e vírgula");
b.igual(win.lerColagem("76902432,FULANO").length, 1, "vírgula");
b.igual(win.lerColagem("linha sem numero nenhum").length, 0,
  "e linha sem número não vira ingresso");
b.igual(win.lerColagem("").length, 0, "colagem vazia não inventa nada");

/* ── 2. A LEITURA DOS ARQUIVOS ───────────────────────────────────────── */
b.passo("2. Arquivo lido entra na fila de importação, e o ruim fica de fora");

win.receberArquivos([
  { name: "13- Ingresso - NO RITMO DA VIDA - 76902432.pdf" },
  { name: "11- Ingresso - NO RITMO DA VIDA - 69621594.pdf" },
  { name: "recibo-sem-numero.pdf" }
]);

b.igual(win.__lidos().length, 3, "os três arquivos foram lidos");
b.igual(win.paraImportar().length, 2, "só os dois com número vão ao servidor");
b.ok(/sem número/i.test(campo("resumoLeitura").textContent),
  "e a tela diz qual ficou de fora, em vez de ignorar em silêncio",
  campo("resumoLeitura").textContent.replace(/\s+/g, " ").slice(0, 90));
b.ok(campo("resumoLeitura").textContent.indexOf("recibo-sem-numero.pdf") > -1,
  "nomeando o arquivo — senão a pessoa procura qual é entre duzentos");
b.ok(!campo("btnImportar").disabled, "o botão de importar liberou");

b.passo("Divergência entre o nome do arquivo e o QR barra o ingresso");
/* Um número trocado aqui vira ingresso recusado na portaria, com a pessoa na
   frente da fila. Duas fontes independentes existem justamente para isso. */
win.__lidos()[0].numeroQr = "99999999";
win.__lidos()[0].divergente = true;
b.igual(win.paraImportar().length, 1, "o divergente não é enviado");
win.__lidos()[0].divergente = false;

(async function () {
  /* ── 3. IMPORTAR DE VERDADE ──────────────────────────────────────────── */
  b.passo("3. O clique em importar grava, e a fila aparece na tela");

  clicar("#btnImportar");
    await tela.assentar(60);

  b.igual(g.cartaoExterno_listar(TOKEN).total, 2, "os dois foram gravados no servidor");

  /* A tela recarrega sozinha depois de importar. */
  win.carregarTela();
    await tela.assentar(60);
  b.igual(win.__itens().length, 2, "e voltaram para a tela");
  b.igual(campo("nTodos").textContent, "2", "o contador de todos acompanha");
  b.igual(campo("nSemNome").textContent, "2",
    "os dois entram em 'falta o nome' — o PDF da bilheteria não tem texto para ler");
  b.ok(doc.querySelectorAll("#corpoTabela tr").length === 2, "duas linhas na tabela");
  b.ok(campo("corpoTabela").textContent.indexOf("76902432") > -1, "com o número à vista");
  b.ok(/falta o nome/i.test(campo("corpoTabela").textContent),
    "e dizendo o que falta, em vez de linha vazia");

  b.passo("Quem está sem nome não oferece 'gerar cartão'");
  /* Cartão com o nome vazio parece pronto, vai para o zap, e a pessoa recebe
     um ingresso que não diz de quem é. */
  b.igual(doc.querySelectorAll(".acao-gerar").length, 0, "nenhum botão de gerar");
  b.igual(doc.querySelectorAll(".acao-vincular").length, 2, "e dois de vincular associado");

  /* ── 4. VINCULAR O ASSOCIADO ─────────────────────────────────────────── */
  b.passo("4. O CPF traz nome, escola e telefone do cadastro");

  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let assoc = ss.getSheetByName("Associados");
  if (!assoc) assoc = ss.insertSheet("Associados");
  assoc.getRange(1, 1, 1, 5).setValues([["Nome", "CPF", "Nome fantasia", "Celular", "Filiado"]]);
  assoc.getRange(2, 1, 1, 5).setValues([
    ["LUCIANA RODRIGUES VIEIRA PORTUGAL", "11144477735", "EEEFM MARIA ORTIZ", "27999887766", "S"]
  ]);

  win.prompt = function () { return "111.444.777-35"; };
  clicar(".acao-vincular");
    await tela.assentar(60);
  win.carregarTela();
    await tela.assentar(60);

  const luciana = win.__itens().filter(function (i) { return i.numero === "76902432"; })[0];
  b.igual(luciana.nome, "LUCIANA RODRIGUES VIEIRA PORTUGAL", "o nome veio do cadastro");
  b.igual(luciana.escola, "EEEFM MARIA ORTIZ", "a escola também");
  b.igual(luciana.telefone, "27999887766", "e o telefone, que é por onde o cartão vai");
  b.igual(luciana.status, "PRONTO", "e o ingresso saiu de 'falta o nome' sozinho");
  b.igual(campo("nPronto").textContent, "1", "o contador de prontos subiu");
  b.igual(campo("nSemNome").textContent, "1", "e o de sem nome caiu");
  b.igual(doc.querySelectorAll(".acao-gerar").length, 1,
    "agora sim aparece o botão de gerar, e só para quem tem nome");

  /* ── 5. OS FILTROS ───────────────────────────────────────────────────── */
  b.passo("5. Os cards contam de verdade e filtram a lista");
  clicar('.contador[data-estado="PRONTO"]');
  b.igual(doc.querySelectorAll("#corpoTabela tr").length, 1, "só o pronto na tela");
  b.ok(campo("corpoTabela").textContent.indexOf("LUCIANA") > -1, "e é ele mesmo");
  clicar('.contador[data-estado="SEM_NOME"]');
  b.ok(/falta o nome/i.test(campo("corpoTabela").textContent), "trocando o filtro, troca a lista");
  clicar("#contTodos");
  b.igual(doc.querySelectorAll("#corpoTabela tr").length, 2, "e 'todos' volta com os dois");

  /* ── 6. OS DADOS DO EVENTO ───────────────────────────────────────────── */
  b.passo("6. Os dados do evento são salvos e relidos");
  campo("cfgEvento").value = "No Compasso da Vida 2026";
  campo("cfgData").value = "Sábado, 19 de dezembro de 2026";
  campo("cfgLocal").value = "Espaço Patrick Ribeiro";
  campo("cfgCidade").value = "Vitória, ES";
  campo("cfgArteData").checked = true;
  campo("cfgArteMarca").checked = true;

  const lido = win.lerCfgDaTela();
  b.igual(lido.arteTrazDataLocal, "SIM", "a marcação vira 'SIM' para o servidor");
  b.igual(lido.arteTrazMarca, "SIM", "as duas");

  clicar("#btnSalvarEvento");
    await tela.assentar(60);
  const cfgGravada = g.cartaoExterno_listar(TOKEN).cfg;
  b.igual(cfgGravada.evento, "No Compasso da Vida 2026", "o evento foi gravado");
  b.igual(cfgGravada.arteTrazDataLocal, "SIM", "com as marcações");

  b.passo("E desmarcado é vazio, não 'NAO' — o padrão é mostrar tudo");
  /* Se um dia isto virar "NAO", quem ler a planilha vai achar que alguém
     decidiu esconder; vazio diz o que é: ninguém marcou nada. */
  campo("cfgArteData").checked = false;
  b.igual(win.lerCfgDaTela().arteTrazDataLocal, "", "desmarcado devolve vazio");

  /* ── 7. GERAR ────────────────────────────────────────────────────────── */
  b.passo("7. Gerar cartão pela tela chega ao servidor");
  clicar(".acao-gerar");
    await tela.assentar(80);
  win.carregarTela();
    await tela.assentar(60);
  const depois = win.__itens().filter(function (i) { return i.numero === "76902432"; })[0];
  b.igual(depois.status, "GERADO", "o ingresso virou cartão gerado");
  b.ok(String(depois.linkCartao || "").length > 0, "com o link do arquivo", depois.linkCartao);
  b.igual(campo("nGerado").textContent, "1", "e o contador acompanha");

  b.passo("A tela não oferece validar, marcar usado nem contar entrada");
  /* É a garantia do desenho inteiro: quem valida é o aplicativo da bilheteria.
     Dois lugares marcando entrada produziriam duas verdades sobre quem entrou,
     e a da portaria é a única que importa. */
  const fonte = require("fs").readFileSync(
    require("path").join(__dirname, "..", "..", "EventosCartaoBlueticket.html"), "utf8");
  const marcacao = fonte.replace(/<script[\s\S]*?<\/script>/gi, " ").toLowerCase();
  ["validar entrada", "check-in", "marcar como usado", "quantos entraram"]
    .forEach(function (t) {
      b.ok(marcacao.indexOf(t) === -1, "nada de '" + t + "' na tela");
    });

  b.passo("8. Importar pela planilha já entrega o cartão PRONTO");
  /* É a diferença que a planilha faz: sem ela, cada ingresso passa pelo
     vínculo por CPF, um por um. Com ela, a fila nasce pronta para gerar. */
  campo("colagem").value =
    "NUMERO\tNOME\tESCOLA\n" +
    "96706474\tCristiane Naomi Kawaguti\tEEEFM Arnulpho Mattos";
  clicar("#btnLerColagem");
  b.ok(/já com nome/.test(campo("resumoLeitura").textContent),
    "a tela avisa que essas linhas já trazem nome",
    campo("resumoLeitura").textContent.replace(/\s+/g, " ").slice(0, 80));

  clicar("#btnImportar");
  await tela.assentar(80);
  win.carregarTela();
  await tela.assentar(80);

  const cristiane = win.__itens().filter(function (i) { return i.numero === "96706474"; })[0];
  b.ok(!!cristiane, "o ingresso da planilha foi gravado");
  b.igual(cristiane.nome, "Cristiane Naomi Kawaguti", "com o nome da planilha");
  b.igual(cristiane.escola, "EEEFM Arnulpho Mattos", "e a escola");
  b.igual(cristiane.status, "PRONTO",
    "já em PRONTO — sem passar pelo vínculo por CPF");

  b.naoTestavel("Arrastar o PDF e o navegador ler o QR da página",
    "jsdom não renderiza PDF; roteiro manual: abrir a tela, arrastar três PDFs " +
    "e conferir que os números lidos batem com os impressos nos ingressos");
  b.resumo();

})();
