/**
 * TESTE — O CACHE DA LISTA DE ESCOLAS, QUE NUNCA TINHA SIDO GRAVADO
 *
 * "Está demorando para buscar a escola pela solicitação manual?" — você,
 * 24/09/2026.
 *
 * O QUE HAVIA. `listarEscolasCadastro_interno_` guardava a lista no
 * CacheService atrás de um `if (json.length < 95000)`. A base real tem 679
 * escolas com 43 colunas, e cada linha vira um objeto de 66 chaves (as
 * colunas mais os apelidos que o frontend usa). Medido: o JSON dá 1.199.925
 * bytes — doze vezes o limite. O `if` nunca foi verdadeiro. O cache nunca
 * foi gravado, nem uma vez, desde o dia em que foi escrito.
 *
 * O CUSTO. A busca de escola da solicitação manual de bolsa chama essa
 * função A CADA TECLA (debounce de 320ms). Medido antes da correção: digitar
 * uma palavra de seis letras custava 12 leituras de planilha e 175.440
 * células. E não é só a bolsa — Ofícios, Central de E-mails, o núcleo de IA
 * e o resumo da tela Início chamam a mesma função.
 *
 * O QUE MUDOU. O JSON vai picado em fatias de 90 KB, abaixo do limite de
 * ~100 KB POR CHAVE do CacheService, e o TTL subiu de 5 minutos para 6 horas
 * (o teto do Apps Script), decisão sua no mesmo dia.
 *
 * POR QUE ESTE TESTE MEDE CÉLULAS, E NÃO MILISSEGUNDOS. No emulador a
 * planilha está na memória, então o tempo aqui não diz nada sobre o Apps
 * Script de verdade. O que transfere é quantas células o servidor lê: é a ida
 * até a planilha que custa segundos lá. Por isso o `getValues` é instrumentado
 * e contado.
 *
 * O RISCO QUE O TTL DE 6 HORAS CRIA, e que a metade de baixo deste arquivo
 * existe para cobrir: dado velho. Escola editada que continua aparecendo com
 * o cadastro antigo por seis horas seria pior que a lentidão. Toda escrita
 * precisa invalidar — e são DOIS caminhos de invalidação, o de Escolas.gs e
 * o de BuscaEscola.gs, cada um com seus chamadores.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* ─── cabeçalho com as 43 colunas da planilha real ─────────────────── */
const CAB = [
  "EscolaID", "Unidade", "Escola (Razão Social)", "CNPJ", "E-mail (principal)",
  "E-mails (todos)", "Telefone 1", "Telefone 2", "Cidade", "Endereço", "Número",
  "Bairro", "Complemento", "UF", "CEP", "NOME_FANTASIA", "SITUACAO_CADASTRAL",
  "Rede", "Responsavel", "CargoResponsavel", "Observacoes", "DataCadastro",
  "UsuarioCadastro", "RAZAO_SOCIAL", "STATUS_SYNC", "DATA_SYNC", "ORIGEM",
  "CNAE", "PORTE", "NATUREZA_JURIDICA", "ABERTURA", "SITUACAO_RF",
  "MOTIVO_SITUACAO", "LOGRADOURO_RF", "MUNICIPIO_RF", "UF_RF", "CEP_RF",
  "TELEFONE_RF", "EMAIL_RF", "CAPITAL_SOCIAL", "MATRIZ_FILIAL", "OBS_SYNC",
  "ATUALIZADO_POR"
];
const c = (nome) => CAB.indexOf(nome);

/* 679 escolas — a contagem real da base, medida em 11/08/2026. O tamanho
 * importa: com 50 escolas o JSON caberia numa fatia só e o teste não provaria
 * nada sobre o caminho que a produção percorre. */
const N = 679;

function montarBase() {
  let sh = ss.getSheetByName("Escolas");
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CAB.length).setValues([CAB]);
  const linhas = [];
  for (let i = 0; i < N; i++) {
    const r = new Array(CAB.length).fill("");
    r[c("EscolaID")] = "ESC" + String(i + 1).padStart(5, "0");
    r[c("Escola (Razão Social)")] = "CENTRO EDUCACIONAL EXEMPLO NUMERO " + i + " LTDA ME";
    r[c("CNPJ")] = String(10000000000000 + i * 137);
    r[c("E-mail (principal)")] = "contato" + i + "@escolaexemplo" + i + ".com.br";
    r[c("E-mails (todos)")] = "contato" + i + "@ex" + i + ".com.br; financeiro" + i + "@ex" + i + ".com.br";
    r[c("Cidade")] = ["Vitória", "Vila Velha", "Serra", "Cariacica", "Linhares"][i % 5];
    r[c("Endereço")] = "Avenida Nossa Senhora dos Navegantes";
    r[c("Número")] = String(100 + i);
    r[c("Bairro")] = "Enseada do Suá";
    r[c("UF")] = "ES";
    r[c("CEP")] = "29050335";
    r[c("NOME_FANTASIA")] = "Escola Exemplo " + i;
    r[c("SITUACAO_CADASTRAL")] = "ATIVA";
    r[c("Rede")] = "PARTICULAR";
    r[c("RAZAO_SOCIAL")] = "CENTRO EDUCACIONAL EXEMPLO NUMERO " + i + " LTDA ME";
    linhas.push(r);
  }
  linhas[300][c("Escola (Razão Social)")] = "UNIVERSIDADE VILA VELHA S/A";
  linhas[300][c("NOME_FANTASIA")] = "UVV";
  sh.getRange(2, 1, N, CAB.length).setValues(linhas);
  return sh;
}
const shEscolas = montarBase();

/* ─── contador de leitura de planilha ───────────────────────────────
 * O `getValues` do emulador é instrumentado no PROTÓTIPO do Range, então
 * conta toda leitura de qualquer aba — inclusive as que a sessão faz. Os
 * passos zeram o contador imediatamente antes do que querem medir. */
const Proto = Object.getPrototypeOf(shEscolas.getRange(1, 1, 1, 1));
const getValuesOrig = Proto.getValues;
const contador = { chamadas: 0, celulas: 0 };
Proto.getValues = function () {
  contador.chamadas++;
  contador.celulas += this.numRows * this.numCols;
  return getValuesOrig.apply(this, arguments);
};
function zerar() { contador.chamadas = 0; contador.celulas = 0; }

const PREFIXO = g.CACHE_PREFIXO_ESCOLAS_CADASTRO_;
const cache = g.CacheService.getScriptCache();
function limparTudo() { g.cacheEscolasLimparFatias_(); }
function fatiasGravadas() {
  let n = 0;
  for (let i = 0; i < 60; i++) if (cache.get(PREFIXO + "_" + i) !== null && cache.get(PREFIXO + "_" + i) !== undefined) n++;
  return n;
}

/* ══════════════════════════════════════════════════════════════════
   PARTE 1 — O CACHE PASSA A SER GRAVADO E LIDO
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Cache em fatias: o que antes nunca era gravado");

limparTudo();
zerar();
const lista1 = g.listarEscolasCadastro_interno_();
const leituraFria = { chamadas: contador.chamadas, celulas: contador.celulas };

b.igual(lista1.length, N, "a lista devolve as 679 escolas");

const tamanho = JSON.stringify(lista1).length;
b.ok(tamanho > 95000,
  "o JSON real passa do limite de 95.000 bytes que travava o cache antigo",
  tamanho + " bytes — " + Math.round(tamanho / 95000) + "x o limite");

b.ok(fatiasGravadas() > 1,
  "a lista foi gravada em VÁRIAS fatias, não numa chave só",
  fatiasGravadas() + " fatias");

b.igual(cache.get(PREFIXO + "_meta"), String(fatiasGravadas()),
  "a _meta registra a quantidade exata de fatias");

/* Nenhuma fatia pode passar do limite por chave do CacheService. Se passar,
 * o Apps Script recusa a gravação em silêncio — e o cache volta a nunca
 * existir, só que agora sem o Logger para avisar. */
let maiorFatia = 0;
for (let i = 0; i < fatiasGravadas(); i++) maiorFatia = Math.max(maiorFatia, String(cache.get(PREFIXO + "_" + i)).length);
b.ok(maiorFatia <= 90000,
  "nenhuma fatia passa de 90 KB (o CacheService recusa ~100 KB por chave)",
  "maior fatia: " + maiorFatia + " bytes");

zerar();
const lista2 = g.listarEscolasCadastro_interno_();
b.igual(contador.celulas, 0,
  "a SEGUNDA chamada não lê uma única célula da planilha");
b.igual(contador.chamadas, 0,
  "a segunda chamada não abre a planilha nenhuma vez");

b.igual(JSON.stringify(lista2), JSON.stringify(lista1),
  "o que volta do cache é idêntico ao que veio da planilha");

/* ══════════════════════════════════════════════════════════════════
   PARTE 2 — O GANHO NA BUSCA DA BOLSA, QUE ORIGINOU A CORREÇÃO
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · Digitar o nome da escola não relê a planilha a cada tecla");

const TECLAS = ["un", "uni", "univ", "unive", "univer", "univers"];

limparTudo();
zerar();
TECLAS.forEach((t) => g.voucherBuscarEscola(t, ADM));
const digitacao = { chamadas: contador.chamadas, celulas: contador.celulas };

b.ok(digitacao.chamadas <= leituraFria.chamadas,
  "digitar seis letras custa UMA leitura de planilha, não uma por tecla",
  digitacao.chamadas + " leituras / " + digitacao.celulas + " células (antes: 12 e 175.440)");

/* Da segunda tecla em diante, zero. É o número que a pessoa sente. */
zerar();
TECLAS.forEach((t) => g.voucherBuscarEscola(t, ADM));
b.igual(contador.celulas, 0,
  "com o cache quente, nenhuma tecla toca na planilha");

/* O ganho não pode ter vindo de a busca passar a achar menos coisa. */
limparTudo();
const semCache = g.voucherBuscarEscola("universidade", ADM);
const comCache = g.voucherBuscarEscola("universidade", ADM);
b.igual(JSON.stringify(comCache), JSON.stringify(semCache),
  "a busca devolve exatamente o mesmo resultado com e sem cache");
b.ok((semCache.escolas || []).length > 0 && semCache.escolas[0].nome.indexOf("UNIVERSIDADE") > -1,
  "e continua achando a escola certa pelo nome",
  semCache.escolas[0].nome);

b.ok(String(semCache.escolas[0].nome || "").trim().length > 0,
  "o nome da escola vem preenchido no retorno do dropdown");

/* ══════════════════════════════════════════════════════════════════
   PARTE 3 — O DADO VELHO, QUE É O RISCO DO TTL DE 6 HORAS
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Editar uma escola derruba o cache na hora");

function nomeDaLinha302() {
  const achada = g.listarEscolasCadastro_interno_().filter((e) => e.EscolaID === "ESC00301")[0];
  return achada ? String(achada.escola || "") : "";
}

g.listarEscolasCadastro_interno_();            // esquenta
b.igual(nomeDaLinha302(), "UNIVERSIDADE VILA VELHA S/A", "ponto de partida: o nome antigo está em cache");

shEscolas.getRange(302, c("Escola (Razão Social)") + 1).setValue("UNIVERSIDADE VILA VELHA - UVV S/A");
b.igual(nomeDaLinha302(), "UNIVERSIDADE VILA VELHA S/A",
  "sem invalidar, o cache ainda serve o nome ANTIGO — é exatamente o risco das 6 horas");

g.invalidarCacheEscolasInterno_();
b.igual(nomeDaLinha302(), "UNIVERSIDADE VILA VELHA - UVV S/A",
  "invalidarCacheEscolasInterno_ derruba as fatias e o nome novo aparece");

/* O SEGUNDO caminho de invalidação. `invalidarCacheEscolas_` mora em
 * BuscaEscola.gs e é o que a sincronização por CNPJ e a atualização pela
 * Receita chamam — quatro chamadores que NÃO passam por Escolas.gs. Antes
 * desta correção ele limpava só a lista de Ofícios; se tivesse continuado
 * assim, escola atualizada pela Receita ficaria velha por seis horas. */
g.listarEscolasCadastro_interno_();            // esquenta de novo
shEscolas.getRange(302, c("Escola (Razão Social)") + 1).setValue("UVV - VILA VELHA");
g.invalidarCacheEscolas_();
b.igual(nomeDaLinha302(), "UVV - VILA VELHA",
  "invalidarCacheEscolas_ (o caminho da Receita e da sincronização) também limpa as fatias");

/* Cadastrar uma escola pela tela precisa aparecer na busca imediatamente —
 * quem cadastra é quem vai procurar em seguida. */
g.listarEscolasCadastro_interno_();
const novaCnpj = "11222333000181";
const resCad = g.cadastrarEscola({
  nomeEscola: "COLEGIO RECEM CADASTRADO LTDA", cnpj: novaCnpj,
  email: "novo@recem.com.br", cidade: "Vitória", uf: "ES"
}, ADM);
b.ok(resCad && resCad.ok, "cadastro da escola nova foi aceito", resCad && resCad.mensagem);
const achouNova = g.listarEscolasCadastro_interno_()
  .filter((e) => String(e.escola || "").indexOf("RECEM CADASTRADO") > -1).length;
b.igual(achouNova, 1, "a escola recém-cadastrada aparece na lista sem esperar o TTL");

/* ══════════════════════════════════════════════════════════════════
   PARTE 4 — CACHE PELA METADE É PIOR QUE CACHE NENHUM
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Fatia faltando derruba o cache inteiro, não devolve meia lista");

g.listarEscolasCadastro_interno_();
const totalFatias = Number(cache.get(PREFIXO + "_meta"));
b.ok(totalFatias > 1, "há mais de uma fatia para poder faltar uma", totalFatias + " fatias");

/* Uma fatia do MEIO some — é o caso real: o CacheService despeja chaves sob
 * pressão de memória, e não necessariamente a última. */
cache.remove(PREFIXO + "_" + Math.floor(totalFatias / 2));
zerar();
const listaRemontada = g.listarEscolasCadastro_interno_();
b.igual(listaRemontada.length, N + 1,
  "com uma fatia faltando, a lista volta INTEIRA (releu a planilha)");
b.ok(contador.celulas > 0,
  "e a releitura realmente aconteceu — não devolveu meia lista do cache",
  contador.celulas + " células lidas");

/* A _meta sozinha, sem as fatias, não pode ser tomada como cache válido. */
limparTudo();
cache.put(PREFIXO + "_meta", "3", 600);
zerar();
const listaMetaOrfa = g.listarEscolasCadastro_interno_();
b.igual(listaMetaOrfa.length, N + 1, "_meta órfã não engana: a planilha é relida");

/* Fatia com lixo dentro: o JSON.parse estoura e o certo é reler, não morrer. */
limparTudo();
g.listarEscolasCadastro_interno_();
cache.put(PREFIXO + "_0", "{isto nao e json", 600);
let quebrou = false;
let listaCorrompida = [];
try { listaCorrompida = g.listarEscolasCadastro_interno_(); } catch (e) { quebrou = true; }
b.ok(!quebrou, "fatia corrompida não derruba a função");
b.igual(listaCorrompida.length, N + 1, "e a lista volta inteira, relida da planilha");

/* _meta absurda não pode fazer a função sair varrendo o cache sem fim. */
limparTudo();
cache.put(PREFIXO + "_meta", "99999", 600);
b.igual(g.listarEscolasCadastro_interno_().length, N + 1,
  "_meta com número absurdo é descartada em vez de obedecida");

/* ═════════════════════════════════════════════════════════════════
   PARTE 5 — O QUE A LISTA MOSTRA: NOME À ESQUERDA, CNPJ À DIREITA

   "Tem que buscar por nome de escola e ao lado o CNPJ" — você, 24/09/2026,
   com print onde apareciam TRÊS sugestões e nenhum nome: só
   "31300858000367 · Vitória/ES", três vezes. Quem atende escolhia entre três
   linhas indistinguíveis.

   Eram DOIS defeitos no mesmo lugar. O nome era desenhado, mas em cor
   herdada — quase branco no fundo branco. E o CNPJ, que é justamente o que
   desempata escola de nome parecido, estava espremido na segunda linha.
   ════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · A sugest\u00e3o de escola mostra nome e CNPJ");

const fs = require("fs");
const path = require("path");
const fonte = fs.readFileSync(path.resolve(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");

/* A COR NÃO SE PROVA AQUI, e o teste diz isso em voz alta. O jsdom deste
 * projeto não aplica folha de estilo (ver o cabeçalho de dom.js), então
 * texto invisível continua "não testado" pela REGRA Nº -1 até alguém abrir
 * no navegador. O que dá para travar é a REGRESSÃO: garantir que a regra
 * voltou a declarar a cor, para ninguém apagar sem perceber. */
const regraItem = (fonte.match(/#certNovaBox \.cert-nv-item \{[^}]*\}/) || [""])[0];
b.ok(/color\s*:/.test(regraItem),
  "o item da lista declara a cor do texto em vez de herdar",
  regraItem.slice(0, 110));
b.ok(/\.cert-nv-item-cnpj\b/.test(fonte),
  "existe a regra do CNPJ ao lado do nome");
b.naoTestavel("o nome aparecer de fato na tela",
  "jsdom n\u00e3o aplica CSS \u2014 texto invis\u00edvel s\u00f3 se confirma no navegador");

const dom = require("./dom");
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a sugest\u00e3o desenhada na tela", "jsdom n\u00e3o instalado (npm i)");
  b.resumo();
  return;
}

/* A tela busca contra a base de verdade deste teste, mas 679 escolas de nome
 * quase igual n\u00e3o deixam ver o item. Aqui fica uma escola s\u00f3, com o CNPJ do
 * seu print. */
(function () {
  const shT = ss.getSheetByName("Escolas");
  shT.clear();
  shT.getRange(1, 1, 1, 6).setValues([["EscolaID", "Escola (Raz\u00e3o Social)", "NOME_FANTASIA", "CNPJ", "Cidade", "UF"]]);
  shT.getRange(2, 1, 3, 6).setValues([
    ["ESC-1", "UNIVERSIDADE VILA VELHA S/A", "UVV", "31300858000367", "Vit\u00f3ria", "ES"],
    ["ESC-2", "ESCOLA SEM DOCUMENTO LTDA",  "",    "",               "Serra",   "ES"],
    ["ESC-3", "<img src=x onerror=alert(1)>", "",  "31300858000103", "Vit\u00f3ria", "ES"]
  ]);
  g.invalidarCacheEscolas_();
})();

(async function () {
  const tela = dom.montar(g, ["Scripts_Certificado.html"], { token: ADM });
  if (tela.win.initCertificadoAdmin) tela.win.initCertificadoAdmin();
  await tela.assentar(80);

  /* Digitar de verdade no campo: o `input` passa pelo debounce de 320ms e
   * chama o backend. 700ms de folga sobre ele. */
  async function digitarEscola(termo) {
    tela.digitar("#certNvEscola", termo);
    await tela.assentar(700);
    return tela.doc.getElementById("certNvListaEscola").innerHTML;
  }

  const htmlUvv = await digitarEscola("universidade");
  b.ok(htmlUvv.indexOf("UNIVERSIDADE VILA VELHA S/A") > -1,
    "o nome da escola est\u00e1 na sugest\u00e3o \u2014 era o que faltava no print");
  b.ok(htmlUvv.indexOf("cert-nv-item-nome") > -1 && htmlUvv.indexOf("cert-nv-item-cnpj") > -1,
    "nome e CNPJ v\u00e3o na MESMA linha, lado a lado");
  b.ok(htmlUvv.indexOf("31.300.858/0003-67") > -1,
    "o CNPJ sai pontuado, como est\u00e1 no contrato e no papel na m\u00e3o",
    "31.300.858/0003-67");
  b.ok(/data-i="0"/.test(htmlUvv),
    "o item carrega o \u00edndice pelo qual o clique acha a escola de volta");
  /* A cidade desce para a segunda linha: ela ajuda a reconhecer, n\u00e3o a
     decidir. Quem decide \u00e9 o CNPJ, e ele subiu. */
  b.ok(/<small>[^<]*Vit\u00f3ria\/ES/.test(htmlUvv),
    "cidade e fantasia descem para a segunda linha");

  /* Escolher pela lista continua preenchendo o formul\u00e1rio \u2014 o layout mudou,
     o clique n\u00e3o pode ter mudado junto. */
  tela.clicar(".cert-nv-item");
  await tela.assentar(80);
  b.igual(tela.doc.getElementById("certNvEscola").value, "UNIVERSIDADE VILA VELHA S/A",
    "clicar na sugest\u00e3o ainda preenche o campo da escola");
  b.igual(tela.doc.getElementById("certNvCnpjEscola").value, "31300858000367",
    "e leva o CNPJ junto, cru, para o certificado");

  const htmlSem = await digitarEscola("sem documento");
  b.ok(htmlSem.indexOf("sem CNPJ") > -1,
    "escola sem CNPJ diz que n\u00e3o tem, em vez de deixar um espa\u00e7o em branco");
  b.ok(htmlSem.indexOf("cert-nv-item-cnpj vazio") > -1,
    "e vem marcada para sair na cor de alerta, n\u00e3o como se estivesse tudo certo");

  /* O nome vem da planilha, que qualquer pessoa da secretaria edita. */
  const htmlTag = await digitarEscola("onerror");
  b.ok(htmlTag.indexOf("<img") === -1 && htmlTag.indexOf("&lt;img") > -1,
    "nome com HTML dentro sai escapado, n\u00e3o vira tag na tela");

  b.resumo();
})();
