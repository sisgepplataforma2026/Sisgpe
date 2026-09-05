/**
 * TESTE — O SELO "PRESENCIAL" APARECE NA LISTA RENDERIZADA
 *
 * O QUE ORIGINOU
 *
 * VNA-4. O t44 já cobria a faixa presencial da tela de nova solicitação,
 * mas o selo da LISTA ele media lendo o código-fonte do .html com regex:
 *
 *     b.ok(/cert-tag-presencial/.test(fonteC), "a classe do selo existe")
 *
 * Isso não é comportamento — é documentação. Pela REGRA Nº -1, "a classe
 * existe no arquivo" não prova que a linha da lista sai com o selo. Uma
 * condição errada, um campo com outro nome vindo do backend, um filtro
 * que descarta a coluna: qualquer um desses deixaria a asserção verde com
 * a lista saindo sem selo nenhum.
 *
 * Este teste percorre o caminho inteiro: grava duas solicitações reais na
 * planilha — uma de associado, uma de não associado —, sobe a tela,
 * carrega a lista pela MESMA função que o botão usa
 * (listarSolicitacoesCertBolsa) e olha o HTML que foi parar em #certTbody.
 *
 * POR QUE O SELO IMPORTA. Regra de 14/08/2026: o não associado tem o
 * MESMO benefício, mas solicita em papel e retira na sede — o voucher
 * dele não vai por e-mail, por decisão. Sem o selo, quem olha a fila acha
 * que o e-mail falhou e liga para a pessoa cobrando algo que nunca foi
 * enviado.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência do selo. jsdom não aplica CSS — a cor, o tamanho e o
 * posicionamento se conferem abrindo a tela.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("LISTA · O selo presencial sai na linha de quem retira na sede");

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (c) { return String(c || "").trim(); });
  const linha = cab.map(function (c) { return campos[c] !== undefined ? campos[c] : ""; });
  sh.getRange(sh.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
}

/* Duas linhas que só diferem no que este teste mede. Tudo mais igual, de
   propósito: se o selo saísse por causa de outra coisa (o nome, o curso, a
   ordem na lista), as duas linhas o receberiam. */
gravar("Voucher_Solicitacoes", {
  ID_SOLICITACAO: "SOL-ASSOC", NUMERO_PROTOCOLO: "BOLSA-2026-000001",
  CPF_SOLICITANTE: "11144477735", NOME_SOLICITANTE: "MARIA DA SILVA ASSOCIADA",
  EMAIL: "maria@exemplo.com", ESCOLA_SELECIONADA: "MULTIVIX",
  INSTITUICAO_ENSINO: "MULTIVIX", CURSO: "Pedagogia",
  PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70",
  STATUS_SOLICITACAO: "APROVADO", SITUACAO_SINDICAL: "ASSOCIADO"
});
gravar("Voucher_Solicitacoes", {
  ID_SOLICITACAO: "SOL-NAO", NUMERO_PROTOCOLO: "BOLSA-2026-000002",
  CPF_SOLICITANTE: "52998224725", NOME_SOLICITANTE: "JOAO SOUZA NAO ASSOCIADO",
  EMAIL: "joao@exemplo.com", ESCOLA_SELECIONADA: "MULTIVIX",
  INSTITUICAO_ENSINO: "MULTIVIX", CURSO: "Pedagogia",
  PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70",
  STATUS_SOLICITACAO: "APROVADO", SITUACAO_SINDICAL: "NAO_ASSOCIADO"
});

/* ═══════════════════════════════════════════════════════════
   1. O backend entrega a situação de cada um
   ═══════════════════════════════════════════════════════════

   Antes de olhar a tela: se o campo não chegar, o selo nunca sairia — e o
   defeito seria no .gs, não no .html. Medir a fronteira separa os dois.
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const lista = g.listarSolicitacoesCertBolsa(TOKEN);
b.ok(Array.isArray(lista), "a listagem responde uma lista",
  lista && lista.mensagem);

function achar(proto) {
  return (lista || []).filter(function (s) { return s.protocolo === proto; })[0];
}
const linhaAssoc = achar("BOLSA-2026-000001");
const linhaNao = achar("BOLSA-2026-000002");

b.ok(!!linhaAssoc, "a solicitação do associado está na lista");
b.ok(!!linhaNao, "e a do não associado também",
  "não associado que some da fila é pior que selo errado");

b.passo("2");
/* O campo que a tela lê é situacaoSindicalDeclarada, com sindical de
   reserva. Um dos dois tem que vir preenchido, senão o selo não tem de
   onde sair. */
function situacao(l) {
  return String((l && (l.situacaoSindicalDeclarada || l.sindical)) || "").toUpperCase();
}
b.igual(situacao(linhaNao), "NAO_ASSOCIADO",
  "o backend entrega NAO_ASSOCIADO na linha certa",
  JSON.stringify({ declarada: linhaNao && linhaNao.situacaoSindicalDeclarada,
                   sindical: linhaNao && linhaNao.sindical }));
b.ok(situacao(linhaAssoc) !== "NAO_ASSOCIADO",
  "e NÃO entrega isso na linha do associado", situacao(linhaAssoc));

/* ═══════════════════════════════════════════════════════════
   2. A TELA: o selo no HTML que foi parar na tabela
   ═══════════════════════════════════════════════════════════ */
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("O selo na lista renderizada", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc;

  t.win.initCertificadoAdmin();
  await t.assentar(80);

  b.passo("3");
  const tbody = doc.getElementById("certTbody");
  b.ok(!!tbody, "a tabela existe na tela");

  const linhas = Array.from(tbody.querySelectorAll("tr"));
  b.igual(linhas.length, 2, "as duas solicitações foram desenhadas",
    linhas.length + " linha(s)");

  /** A <tr> que contém o protocolo pedido. */
  function linhaDe(proto) {
    return linhas.filter(function (tr) {
      return tr.textContent.indexOf(proto) > -1;
    })[0];
  }
  const trNao = linhaDe("BOLSA-2026-000002");
  const trAssoc = linhaDe("BOLSA-2026-000001");

  b.passo("4");
  b.ok(!!trNao && !!trAssoc, "as duas linhas foram localizadas pelo protocolo");

  const seloNao = trNao && trNao.querySelector(".cert-tag-presencial");
  b.ok(!!seloNao,
    "a linha do NÃO ASSOCIADO traz o selo presencial",
    "sem ele a secretaria liga cobrando um e-mail que, por decisão, não foi enviado");
  b.ok(seloNao && /presencial/i.test(seloNao.textContent),
    "com a palavra 'presencial' escrita",
    seloNao && seloNao.textContent);

  b.passo("5");
  /* CONTRAPROVA. Sem ela, um selo desenhado em TODA linha passaria acima —
     e aí ele não informaria nada. */
  b.ok(trAssoc && !trAssoc.querySelector(".cert-tag-presencial"),
    "e a linha do ASSOCIADO NÃO traz o selo",
    "selo que aparece sempre é selo que ninguém lê");

  b.passo("6");
  /* O selo explica o que significa ao passar o mouse. Quem entra na fila
     hoje não estava na conversa de 14/08 que decidiu a regra. */
  b.ok(seloNao && String(seloNao.getAttribute("title") || "").length > 20,
    "o selo carrega explicação no title",
    seloNao && seloNao.getAttribute("title"));
  b.ok(seloNao && /sede|presencial|papel/i.test(seloNao.getAttribute("title") || ""),
    "dizendo que é retirada na sede, não erro de envio");

  b.passo("7");
  /* O selo fica na coluna do NOME, junto de quem é a pessoa — e não na
     coluna de status, que é do andamento do pedido. Canal e status são
     coisas diferentes: um não associado pode estar pendente, aprovado ou
     emitido, e o selo vale nos três. */
  const tds = trNao ? Array.from(trNao.querySelectorAll("td")) : [];
  const tdComSelo = tds.filter(function (td) {
    return !!td.querySelector(".cert-tag-presencial");
  })[0];
  b.ok(!!tdComSelo && tdComSelo.textContent.indexOf("JOAO SOUZA") > -1,
    "o selo fica na coluna do nome, junto de quem é a pessoa",
    tdComSelo ? tdComSelo.textContent.trim().slice(0, 60) : "(não achou)");

  b.naoTestavel("A aparência do selo — cor, tamanho, posição",
    "jsdom não aplica CSS; isso se confere abrindo a tela");

  b.resumo();
})();
