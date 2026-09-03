/**
 * t135 — MÓDULO 04 · A FICHA NO LAYOUT DO FORMULÁRIO DE PAPEL
 *
 * 01/09/2026. O usuário mandou a foto do formulário impresso que o sindicato
 * usa e disse: "precisamos de algo que fique assim". O PDF que o sistema
 * gerava tinha layout próprio, preto e branco, com campos e rótulos que não
 * batiam com o papel.
 *
 * O QUE É DECISÃO DELE E ESTÁ TRAVADO AQUI
 *
 *   1. título de eleitor, zona e seção SAEM — não existem no papel, e o
 *      sistema não os usava para nada;
 *   2. escolaridade vira caixa de marcar com NOVE opções;
 *   3. contatos viram WhatsApp / telefônico / recado;
 *   4. o texto da autorização fica o COMPLETO.
 *
 * POR QUE NOVE E NÃO OITO — o ponto mais fácil de errar
 *
 * O papel tem cinco opções; ele pediu mais três. Seriam oito. Mas o
 * formulário público separa "Fundamental incompleto" de "completo", e o papel
 * não: seguir o papel deixaria quem marcou "incompleto" SEM CAIXA — o mesmo
 * defeito da Pós-graduação, que foi o que originou esta correção. A lista
 * impressa tem de cobrir tudo que o formulário consegue gravar.
 *
 * A REGRA DAS CAIXINHAS
 *
 * Valor que não cabe vira linha contínua, não texto cortado. Truncar dado de
 * um documento assinado para caber numa decoração seria trocar a informação
 * pelo enfeite — e este documento tem valor legal (Art. 545 da CLT).
 */

const b = require("./base");
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const { g } = b.subir({});

const ADMIN = fs.readFileSync(path.join(RAIZ, "Sindicalizacaoadmin.gs"), "utf8");
const FORM = fs.readFileSync(path.join(RAIZ, "Fichasindicalizacao.html"), "utf8");

b.fluxo("MÓDULO 04 · as caixinhas, e o que elas não podem fazer");

b.passo("1. valor curto é espalhado uma letra por célula");
const cx = g.sindAdm_caixinhas_("ES", 2);
b.ok(/<table class="cx">/.test(cx), "sai como tabela");
b.igual((cx.match(/<td>/g) || []).length, 2, "com uma célula por caractere");
b.ok(/<td>E<\/td><td>S<\/td>/.test(cx), "e as letras na ordem");

b.passo("2. célula vazia sobra quando o valor é menor que o campo");
const curto = g.sindAdm_caixinhas_("ES", 6);
b.igual((curto.match(/<td>/g) || []).length, 6,
  "seis células para um valor de duas letras");
b.ok(/ /.test(curto), "as quatro restantes ficam em branco de verdade");

b.passo("3. E A REGRA QUE IMPORTA — o que não cabe NÃO é cortado");
/* Se truncasse, um e-mail longo sairia pela metade num documento assinado. */
const longo = "um-email-bem-comprido@exemplo.com.br";
const est = g.sindAdm_caixinhas_(longo, 10);
b.ok(!/<table class="cx">/.test(est), "deixa de ser caixinha");
b.ok(/class="cont"/.test(est), "e vira linha contínua");
b.ok(est.indexOf(longo) >= 0, "com o valor INTEIRO dentro", longo);

b.passo("4. e o valor é escapado — o nome vem de quem preencheu");
const perigo = g.sindAdm_caixinhas_("<script>x</script>@y.com", 8);
b.ok(perigo.indexOf("<script>") === -1,
  "tag não atravessa para o HTML do PDF",
  perigo.indexOf("<script>") >= 0 ? "ATRAVESSOU" : "escapado");

b.passo("5. tabela e não div — a conversão do Apps Script não faz flexbox");
/* Com div as células empilham e o formulário sai desmontado. */
b.ok(/table\.lin|class="cx"/.test(ADMIN), "o layout usa tabela");
b.ok(!/display:flex/.test(ADMIN.split("var html =")[1] || ""),
  "e o HTML do PDF não depende de flexbox");

b.fluxo("MÓDULO 04 · as quatro decisões do usuário");

b.passo("6. título de eleitor, zona e seção saíram dos DOIS lugares");
const htmlPdf = ADMIN.split("var html =")[1].split("var blob")[0];
b.ok(!/T[ÍI]TULO DE ELEITOR/i.test(htmlPdf), "não é mais impresso no PDF");
b.ok(!/tituloEleitor/.test(FORM), "e o formulário público não pede mais");
b.ok(!/\bzona\b/i.test(htmlPdf) && !/'zona'/.test(FORM),
  "zona idem", "nem no PDF nem no envio da tela");

b.passo("7. mas o ESQUEMA e o dado de quem já preencheu ficam intactos");
/* Apagar dado já coletado é decisão à parte, não efeito colateral de um
   ajuste de layout. As colunas continuam lá, vazias daqui para frente. */
b.ok((g.SIND_ADM_COLUNAS || []).indexOf("TITULO_ELEITOR") >= 0,
  "a coluna TITULO_ELEITOR continua no esquema");
b.ok((g.SINDICALIZACAO_COLUNAS || []).indexOf("ZONA") >= 0,
  "e ZONA também — nada foi apagado da planilha");

b.passo("8. NOVE opções de escolaridade, não oito");
b.igual((g.SIND_ADM_ESCOLARIDADE || []).length, 9, "são nove");
["Ensino Fundamental incompleto", "Ensino Fundamental completo",
 "Pós-graduação", "Mestrado", "Doutorado"].forEach(function (op) {
  b.ok((g.SIND_ADM_ESCOLARIDADE || []).indexOf(op) >= 0, "inclui: " + op);
});

b.passo("9. E O MOTIVO DE SEREM NOVE — a lista cobre o que a tela grava");
/* Se a tela puder gravar um valor sem caixa correspondente, o defeito da
   Pós-graduação volta com outro nome. */
const opcoesTela = (FORM.match(/<option>([^<]+)<\/option>/g) || [])
  .map(o => o.replace(/<\/?option>/g, "").trim())
  .filter(o => /fundamental|médio|superior|gradua|mestrado|doutorado/i.test(o));
b.ok(opcoesTela.length > 0, "a tela oferece opções de escolaridade",
  opcoesTela.length + " opções");
const semCaixa = opcoesTela.filter(function (op) {
  return g.sindAdm_opcoesEscolaridade_(op).indexOf("&#9746;") === -1;
});
b.igual(semCaixa.length, 0,
  "toda opção da tela tem caixa correspondente no papel", semCaixa.join(", "));

b.passo("10. e o cadastro ANTIGO, escrito de outro jeito, também casa");
/* A base tem "Superior completo" sem o "Ensino" na frente. */
[["Superior completo", "SUPERIOR COMPLETO"],
 ["POS-GRADUACAO", "PÓS-GRADUAÇÃO"],
 ["ensino médio completo", "MÉDIO COMPLETO"]].forEach(function (par) {
  const saida = g.sindAdm_opcoesEscolaridade_(par[0]);
  const marcada = (saida.match(/&#9746;\s*([A-ZÁÂÃÉÊÍÓÔÕÚÇ\- ]+)/) || [])[1] || "";
  b.ok(marcada.indexOf(par[1]) >= 0,
    "'" + par[0] + "' marca a caixa certa", marcada.trim());
});

b.passo("11. valor fora das nove aparece, em vez de sumir");
/* Ficha com escolaridade que ninguém previu não pode sair com as nove caixas
   vazias — o documento estaria negando um dado que está na base. */
const exotico = g.sindAdm_opcoesEscolaridade_("Técnico em Enfermagem");
b.ok(exotico.indexOf("TÉCNICO EM ENFERMAGEM") >= 0,
  "o valor gravado é mostrado do lado");
b.igual((exotico.match(/&#9746;/g) || []).length, 1,
  "e só ele fica marcado — nenhuma das nove é marcada por engano");

b.passo("12. contatos no mapeamento que o usuário confirmou");
b.ok(/CONTATO WHATSAPP[\s\S]{0,80}r\.CELULAR/.test(htmlPdf),
  "WhatsApp ← CELULAR");
b.ok(/CONTATO TELEF[ÔO]NICO[\s\S]{0,90}r\.TELEFONE_1/.test(htmlPdf),
  "telefônico ← TELEFONE_1");
b.ok(/CONTATO PARA RECADO[\s\S]{0,90}r\.TELEFONE_2/.test(htmlPdf),
  "recado ← TELEFONE_2");

b.passo("13. o texto da autorização ficou o COMPLETO");
/* O papel cita só o Art. 545. Encurtar texto de documento com valor legal
   por questão de layout não se faz. */
["Art. 545 da CLT", "Cláusula 56", "Assembleia Geral", "Edital",
 "2% (dois por cento)"].forEach(function (t) {
  b.ok(htmlPdf.indexOf(t) >= 0, "mantém: " + t);
});

b.fluxo("MÓDULO 04 · o que o papel tem e o PDF passou a ter");

b.passo("14. as seções do formulário impresso, nos mesmos nomes");
["TRABALHADOR (A)", "IDENTIFICAÇÃO", "ENDEREÇO RESIDENCIAL", "CONTATOS",
 "ESCOLARIDADE", "EMPRESA ONDE TRABALHA"].forEach(function (s) {
  b.ok(htmlPdf.indexOf(s) >= 0, "seção: " + s);
});

b.passo("15. os rótulos que estavam diferentes");
b.ok(/ATUALIZA[ÇC][ÃA]O CADASTRAL/.test(htmlPdf),
  "'Atualização cadastral' no lugar de 'Recadastramento'");
b.ok(/ORG[ÃA]O EMISSOR/.test(htmlPdf),
  "'Orgão emissor' no lugar de 'Órgão expedidor'");
b.ok(!/RECADASTRAMENTO<\/div>|&#9744; RECADASTRAMENTO/.test(htmlPdf),
  "e o rótulo antigo saiu da impressão");

b.passo("16. tipo de logradouro virou caixa de marcar, com seis opções");
const log = g.sindAdm_opcoesLogradouro_("AVENIDA");
["ALAMEDA", "AVENIDA", "ESTRADA", "PRAÇA", "RUA", "TRAVESSA"].forEach(function (t) {
  b.ok(log.indexOf(t) >= 0, "opção: " + t);
});
b.igual((log.match(/&#9746;/g) || []).length, 1, "só uma marcada");
b.ok(/&#9746; AVENIDA/.test(log), "e é a do cadastro");
b.ok(/&#9746; RUA/.test(g.sindAdm_opcoesLogradouro_("")),
  "sem tipo gravado, cai em RUA — que é o padrão do papel");

b.passo("17. e o versículo do rodapé, que faltava");
b.ok(/Colossenses 3:23/.test(htmlPdf), "Colossenses 3:23 está no PDF");
b.ok(/de todo o cora[çc][ãa]o/.test(htmlPdf), "com o texto do papel");

b.passo("18. E A MOLDURA AZUL — é o que faz parecer o mesmo documento");
b.ok(/#1E56B8/.test(ADMIN), "a moldura usa o azul do formulário impresso");
b.ok(/#9EC6EE/.test(ADMIN), "e as barras de seção o azul-claro");
b.ok(!/background:#000|background:#333/.test(htmlPdf),
  "as barras pretas do layout antigo sumiram");

b.fluxo("MÓDULO 04 · a logo");

b.passo("19. a tagline NÃO aparece duas vezes");
/* A arte da logo já traz "Somos todos educadores" dentro dela. O cabeçalho
   chegou a acrescentar a frase de novo por baixo — ficava escrita duas vezes
   no documento. */
b.igual((ADMIN.match(/SOMOS TODOS EDUCADORES/g) || []).length, 1,
  "a frase existe uma vez só no arquivo — e é no texto de emergência");
/* A frase está dentro do ramo de emergência do ternário (logo depois do
   <span class="marca">) e ANTES do cabeçalho montado (<div class="cab">).
   É isso que prova que ela não é acrescentada por fora da imagem. */
const posFrase = ADMIN.indexOf("SOMOS TODOS EDUCADORES");
b.ok(posFrase > ADMIN.indexOf('<span class="marca">'),
  "a frase vem logo depois do texto de emergência que ela acompanha");
b.ok(posFrase < ADMIN.indexOf('<div class="cab">'),
  "e antes do cabeçalho — ou seja, não está na célula da logo");
b.ok(ADMIN.indexOf('text-align:center;">\' + marcaHtml + \'</div>') > 0,
  "a célula da logo carrega só a marca, sem frase colada por fora");

b.passo("20. o tamanho manda pela LARGURA, não pela altura");
/* A arte tem 466x247 (proporção 1,9:1). Com max-height:40px ela saía com
   ~75px de largura numa coluna de ~180px: pequena e perdida no canto. */
b.ok(/width:100%;max-width:\d+px/.test(ADMIN),
  "a imagem é dimensionada por largura");
b.ok(!/max-height:40px/.test(ADMIN),
  "e o limite de altura que a encolhia saiu");
b.ok(/height:auto/.test(ADMIN),
  "com altura automática, para não distorcer a proporção");

b.passo("21. e o texto de emergência usa a cor da MARCA, não a do SISGEP");
/* Quando a logo não carrega, o PDF cai num texto. Ele usava dourado
   (#C9A84C), que é a cor institucional do SISGEP — não a do sindicato, que é
   rosa e azul. Num documento com a marca do sindicato, a cor errada é a que
   quem lê nota primeiro. */
const marca = (ADMIN.match(/'\.marca\{[^']*'/) || [""])[0] +
              (ADMIN.match(/'\.marca i\{[^']*'/) || [""])[0];
b.ok(!/C9A84C/.test(marca), "o dourado do SISGEP saiu do texto de emergência");
b.ok(/1E56B8/.test(marca) && /E4467E/.test(marca),
  "e ficaram o azul e o rosa da marca", marca.substring(0, 60));

b.naoTestavel(
  "se a arte da logo está boa o bastante para impressão",
  "o arquivo no Drive se chama Screenshot_3.png e tem 466x247 — é um recorte " +
  "de tela, não arte vetorial. Em 150px de largura no PDF deve passar, mas se " +
  "sair serrilhada na impressão, a correção é trocar o arquivo por um PNG " +
  "grande ou um SVG, sem mexer em código: o ID do arquivo continua o mesmo"
);

b.naoTestavel(
  "se o PDF IMPRESSO fica igual ao papel",
  "o emulador não converte HTML em PDF nem desenha página. O que se prova " +
  "aqui é o HTML que entra na conversão. A conferência é gerar uma ficha em " +
  "homologação, abrir o PDF e pôr ao lado do formulário impresso — " +
  "principalmente a largura das caixinhas, que é onde a conversão do Apps " +
  "Script costuma divergir do navegador"
);

b.resumo();
