/**
 * TESTE — A LISTA DE BOLSAS MOSTRA QUEM ESTUDA, NÃO SÓ QUEM ASSINA
 *
 * O QUE ORIGINOU (22/09/2026). Seu print do painel:
 *
 *     BOLSA-2026-480404 · WANDERSON NASCIMENTO CASTELO · 085.381.047-80
 *     BOLSA-2026-214839 · WANDERSON NASCIMENTO CASTELO · 085.381.047-80
 *
 * "Aqui dá impressão de ser dois vouchers para o mesmo associado, não pode
 * ser assim. Pois tem direito a um somente por CPF. Tem que aparecer que é o
 * beneficiário."
 *
 * Estava certo no diagnóstico e no risco. As duas linhas eram de dependentes
 * diferentes — Guilherme e Bernardo —, mas a coluna mostrava o SOLICITANTE, e
 * o solicitante é o pai nas duas. Quem abrisse o painel para conferir a regra
 * de um voucher por CPF leria uma infração que não existe; e, pior, quem
 * fosse indeferir uma "duplicidade" indeferiria a bolsa de uma criança.
 *
 * O TESTE PERCORRE O CAMINHO INTEIRO: grava três solicitações reais — duas de
 * dependentes do mesmo titular e uma do próprio titular —, sobe a tela,
 * carrega pela MESMA função do botão e lê o HTML que foi parar em #certTbody.
 *
 * O QUE ELE NÃO PROVA, e segue "não testado" pela REGRA Nº -1: a aparência da
 * etiqueta e da linha do titular. jsdom não aplica CSS.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("PAINEL · Cada linha diz de quem é a bolsa");

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

/* MESMO TITULAR, MESMO CPF, MESMA ESCOLA, MESMO PERÍODO — de propósito. É
   exatamente a situação do print: tudo igual menos a criança. */
const TITULAR = "WANDERSON NASCIMENTO CASTELO";
const CPF = "11144477735";

gravar("Voucher_Solicitacoes", {
  ID_SOLICITACAO: "SOL-DEP-1", NUMERO_PROTOCOLO: "BOLSA-2026-480404",
  CPF_SOLICITANTE: CPF, NOME_SOLICITANTE: TITULAR,
  NOME_BENEFICIARIO: "GUILHERME SIMOURA CASTELO", TIPO_BENEFICIARIO: "FILHO",
  EMAIL: "w@exemplo.com", ESCOLA_SELECIONADA: "UVV - VILA VELHA",
  CURSO: "6 série", MODALIDADE: "ENSINO_FUNDAMENTAL",
  PERIODO_REFERENCIA: "2027/1", PERCENTUAL_APLICADO: "100",
  STATUS_SOLICITACAO: "PENDENTE", SITUACAO_SINDICAL: "ASSOCIADO"
});
gravar("Voucher_Solicitacoes", {
  ID_SOLICITACAO: "SOL-DEP-2", NUMERO_PROTOCOLO: "BOLSA-2026-214839",
  CPF_SOLICITANTE: CPF, NOME_SOLICITANTE: TITULAR,
  NOME_BENEFICIARIO: "BERNARDO SIMOURA CASTELO", TIPO_BENEFICIARIO: "FILHO",
  EMAIL: "w@exemplo.com", ESCOLA_SELECIONADA: "UVV - VILA VELHA",
  CURSO: "2 ano", MODALIDADE: "ENSINO_MEDIO",
  PERIODO_REFERENCIA: "2027/1", PERCENTUAL_APLICADO: "100",
  STATUS_SOLICITACAO: "PENDENTE", SITUACAO_SINDICAL: "ASSOCIADO",
  LINK_CONTRACHEQUE: "https://drive.exemplo/contracheque-wanderson",
  LINK_DOC_PESSOAL: "https://drive.exemplo/doc-bernardo"
});
/* A CONTRAPROVA: a bolsa do próprio associado. Se a etiqueta saísse em toda
   linha, ela não informaria nada. */
gravar("Voucher_Solicitacoes", {
  ID_SOLICITACAO: "SOL-TIT", NUMERO_PROTOCOLO: "BOLSA-2026-900001",
  CPF_SOLICITANTE: CPF, NOME_SOLICITANTE: TITULAR,
  NOME_BENEFICIARIO: TITULAR, TIPO_BENEFICIARIO: "TITULAR",
  EMAIL: "w@exemplo.com", ESCOLA_SELECIONADA: "UVV - VILA VELHA",
  CURSO: "Pedagogia", MODALIDADE: "GRADUACAO",
  PERIODO_REFERENCIA: "2027/1", PERCENTUAL_APLICADO: "70",
  STATUS_SOLICITACAO: "PENDENTE", SITUACAO_SINDICAL: "ASSOCIADO",
  LINK_CONTRACHEQUE: "https://drive.exemplo/contracheque-titular",
  LINK_DOC_PESSOAL: "https://drive.exemplo/doc-titular"
});

/* ═══ 1. O backend entrega os dois nomes ═══════════════════════════════════
   Se nomeBeneficiario não chegar à tela, o defeito é no .gs e nenhuma
   mudança de HTML resolveria. Medir a fronteira separa os dois lados. */
b.passo("1");
const lista = g.listarSolicitacoesCertBolsa(TOKEN);
b.ok(Array.isArray(lista), "a listagem responde uma lista", lista && lista.mensagem);

function achar(proto) {
  return (lista || []).filter(function (s) { return s.protocolo === proto; })[0];
}
const dep1 = achar("BOLSA-2026-480404");
const dep2 = achar("BOLSA-2026-214839");
const tit = achar("BOLSA-2026-900001");

b.ok(!!dep1 && !!dep2 && !!tit, "as três solicitações estão na lista");
b.igual(dep1 && dep1.nomeBeneficiario, "GUILHERME SIMOURA CASTELO",
  "o nome do beneficiário chega à tela");
b.igual(dep1 && dep1.nome, TITULAR,
  "e o do titular continua chegando — é dele o direito e a conta por CPF");
b.igual(dep1 && dep1.tipoBeneficiario, "FILHO",
  "com o parentesco, que é o que explica o nome diferente");

/* ═══ 2. A TELA ═══════════════════════════════════════════════════════════ */
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("A coluna Beneficiário na lista renderizada", "jsdom não instalado");
  b.resumo();
  process.exit(process.exitCode || 0);
}

(async function () {
  const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  const doc = t.doc;

  t.win.initCertificadoAdmin();
  await t.assentar(80);

  b.passo("2");
  const tbody = doc.getElementById("certTbody");
  b.ok(!!tbody, "a tabela existe na tela");

  const linhas = Array.from(tbody.querySelectorAll("tr"));
  b.igual(linhas.length, 3, "as três solicitações foram desenhadas",
    linhas.length + " linha(s)");

  function linhaDe(proto) {
    return linhas.filter(function (tr) { return tr.textContent.indexOf(proto) > -1; })[0];
  }
  const tr1 = linhaDe("BOLSA-2026-480404");
  const tr2 = linhaDe("BOLSA-2026-214839");
  const trTit = linhaDe("BOLSA-2026-900001");
  b.ok(!!tr1 && !!tr2 && !!trTit, "as três linhas foram localizadas pelo protocolo");

  b.passo("3. o nome grande é o de quem estuda");
  b.ok(tr1 && /GUILHERME SIMOURA CASTELO/.test(tr1.textContent),
    "a linha do Guilherme traz o nome dele",
    tr1 && tr1.textContent.replace(/\s+/g, " ").trim());
  b.ok(tr2 && /BERNARDO SIMOURA CASTELO/.test(tr2.textContent),
    "e a do Bernardo, o dele");

  /* O DEFEITO EM UMA ASSERÇÃO: antes, as duas linhas eram indistinguíveis
     porque só traziam o nome do pai. */
  const nomeForte = function (tr) {
    var el = tr && tr.querySelector("td:nth-child(3) div");
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  };
  b.ok(nomeForte(tr1) !== nomeForte(tr2),
    "as duas linhas do mesmo titular deixam de ser idênticas",
    nomeForte(tr1) + " | " + nomeForte(tr2));
  b.ok(nomeForte(tr1).indexOf("GUILHERME") === 0,
    "e o nome do beneficiário vem PRIMEIRO na célula, não escondido embaixo",
    nomeForte(tr1));

  b.passo("4. a etiqueta explica por que o nome é outro");
  const tag1 = tr1 && tr1.querySelector(".cert-tag-parentesco");
  b.ok(!!tag1, "a linha do dependente traz a etiqueta de parentesco");
  b.ok(tag1 && /filho/i.test(tag1.textContent),
    "dizendo 'filho(a)'", tag1 && tag1.textContent);
  b.ok(trTit && !trTit.querySelector(".cert-tag-parentesco"),
    "e a linha do próprio associado NÃO traz etiqueta — seria ruído em quase toda linha");

  b.passo("5. o titular continua visível, porque a conta por CPF é dele");
  b.ok(tr1 && /Titular:/.test(tr1.textContent),
    "a linha do dependente mostra de quem é o direito",
    tr1 && tr1.textContent.replace(/\s+/g, " ").trim());
  b.ok(tr1 && tr1.textContent.indexOf(TITULAR) > -1,
    "com o nome do associado");
  b.ok(tr1 && /111\.444\.777-35/.test(tr1.textContent),
    "e o CPF dele, formatado — é por ele que se conta o limite",
    tr1 && tr1.textContent.replace(/\s+/g, " ").trim());
  b.ok(trTit && !/Titular:/.test(trTit.textContent),
    "na linha do próprio associado o rótulo não se repete: o nome já é o dele");

  b.passo("6. a busca acha pelos dois nomes");
  /* Quem digita "Guilherme" espera achar a bolsa dele; quem digita o nome do
     pai espera achar as dos filhos. Antes, o primeiro não achava nada. */
  const filtro = doc.getElementById("certFiltroSolicitante");
  filtro.value = "Guilherme";
  filtro.dispatchEvent(new t.win.Event("input", { bubbles: true }));
  await t.assentar(400);
  var visiveis = Array.from(doc.getElementById("certTbody").querySelectorAll("tr"));
  b.igual(visiveis.length, 1, "buscar pelo nome do dependente acha a bolsa dele",
    visiveis.map(function (x) { return x.textContent.slice(0, 40); }).join(" / "));
  b.ok(visiveis[0] && visiveis[0].textContent.indexOf("480404") > -1,
    "e é a linha certa");

  filtro.value = "WANDERSON";
  filtro.dispatchEvent(new t.win.Event("input", { bubbles: true }));
  await t.assentar(400);
  visiveis = Array.from(doc.getElementById("certTbody").querySelectorAll("tr"));
  b.igual(visiveis.length, 3, "buscar pelo titular continua trazendo as três");

  /* ── 7. O MODAL ────────────────────────────────────────────────────────── */
  b.passo("7. no detalhe, cada anexo diz de quem é");
  /* "Tem que aparecer a documentação do titular junto do dependente" — você,
     22/09/2026. Os dois anexos já estavam na solicitação do dependente: o
     contracheque é do associado e o documento pessoal é da criança. O que
     faltava era dizer isso — sem o nome, quem analisa abre os dois para
     descobrir de quem é cada um, ou conclui que o do titular não veio e pede
     complementação de algo que está ali. */
  t.win.certAbrirSolicitacao(dep2);
  await t.assentar(60);

  var docs = doc.getElementById("cmi-docs");
  var txtDocs = docs.textContent.replace(/\s+/g, " ").trim();

  b.ok(/Contracheque do titular/.test(txtDocs),
    "o contracheque aparece identificado como do titular", txtDocs);
  b.ok(txtDocs.indexOf(TITULAR) > -1,
    "com o nome do associado — é o vínculo dele que dá o direito");
  b.ok(/Documento do dependente/.test(txtDocs),
    "e o documento pessoal, como do dependente", txtDocs);
  b.ok(/BERNARDO SIMOURA CASTELO/.test(txtDocs),
    "com o nome da criança, que é de quem ele é");

  b.passo("e os dois links continuam abrindo o arquivo certo");
  var links = Array.from(docs.querySelectorAll("a")).map(function (a) {
    return a.getAttribute("href");
  });
  b.igual(links.length, 2, "os dois anexos estão lá");
  b.ok(links.indexOf("https://drive.exemplo/contracheque-wanderson") > -1,
    "o link do contracheque é o gravado na solicitação", links.join(" | "));
  b.ok(links.indexOf("https://drive.exemplo/doc-bernardo") > -1,
    "e o do documento do dependente também");

  b.passo("na bolsa do próprio associado não se inventa dono");
  /* CONTRAPROVA: repetir "do titular / WANDERSON" numa solicitação em que só
     existe uma pessoa seria ruído — e ruído que some quando importa. */
  t.win.certAbrirSolicitacao(tit);
  await t.assentar(60);
  var txtTit = doc.getElementById("cmi-docs").textContent.replace(/\s+/g, " ").trim();
  b.ok(!/Documento do dependente/.test(txtTit),
    "o documento pessoal não é chamado de 'do dependente'", txtTit);
  b.ok(/Documento com CPF/.test(txtTit),
    "e sim pelo que ele é", txtTit);

  b.naoTestavel("a aparência da etiqueta e da linha do titular",
    "jsdom não aplica CSS — roteiro: abrir o painel de Bolsas e conferir que o " +
    "nome do beneficiário está em destaque e o titular em cinza embaixo");
  b.resumo();
})();
