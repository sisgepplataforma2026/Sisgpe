/**
 * TESTE — A SEÇÃO DE DEPENDENTES, QUE EXISTIA NO HTML E NUNCA FUNCIONOU
 *
 * "Onde eu adiciono outros filhos para solicitação? Aqui não tem a opção" /
 * "essa é do pai/mãe e ficou faltando dos dependentes" — você, 17/09/2026, e
 * antes disso em 16/09. Três vezes o mesmo apontamento.
 *
 * O QUE HAVIA: a seção "3b — Dependentes" no HTML, com o botão "+ Adicionar
 * dependente" e a lista vazia — e NENHUMA linha de JavaScript. Nada preenchia
 * a lista, nada escutava o botão, e ela nascia escondida e nunca aparecia. O
 * backend aceitava três dependentes, criava um protocolo para cada e gravava
 * o documento de cada um; ninguém do lado da tela chamava.
 *
 * É O CASO EXTREMO DA REGRA Nº -1: o código estava escrito, correto e
 * inalcançável. Ler o arquivo dava a impressão de pronto — só executando é
 * que se via que a seção nunca aparecia.
 *
 * ESTE TESTE CLICA. Ele escolhe "para meus dependentes", clica em adicionar,
 * preenche os três cartões e lê o que sai — como a pessoa faria.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("PORTAL · Até três dependentes num envio só");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Cartões de dependente", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const tela = dom.montar(g, ["PortalVoucher.html"], { token: "" });
const win = tela.win, doc = win.document;

function campo(id) { return doc.getElementById(id); }
function cartoes() { return doc.querySelectorAll("#listaDependentes .dep-card"); }
function clicar(el) { if (el) el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }

/* As listas vêm do servidor; o teste as semeia como o carregamento faria. */
win.INIT.modalidades = [
  { value: "ENSINO_FUNDAMENTAL", label: "Ensino Fundamental" },
  { value: "ENSINO_MEDIO", label: "Ensino Médio" },
  { value: "GRADUACAO", label: "Graduação" }
];
win.INIT.areas = [{ value: "HUMANAS", label: "Humanas" }];

/* ── 1. O SELETOR ────────────────────────────────────────────────────────── */
b.passo("1. 'Para quem é a bolsa' abre um caminho e fecha o outro");

b.ok(!!campo("paraQuem"), "o seletor existe na tela");
b.igual(doc.querySelectorAll("#paraQuem .btn-escolha").length, 2,
  "com as duas opções: para mim, para meus dependentes");

win.paraQuemEscolher("TITULAR");
b.igual(campo("secaoDependentes").style.display, "none",
  "em 'para mim', a seção de dependentes fica fechada");
b.ok(campo("camposTitular").style.display !== "none",
  "e os campos do beneficiário aparecem");

win.paraQuemEscolher("DEPENDENTES");
b.ok(campo("secaoDependentes").style.display !== "none",
  "em 'para meus dependentes', a seção 3b APARECE — era o que nunca acontecia");
b.igual(campo("camposTitular").style.display, "none",
  "e os campos do beneficiário único somem: não se pergunta duas vezes");

/* ── 2. OS CARTÕES ───────────────────────────────────────────────────────── */
b.passo("2. O primeiro cartão nasce sozinho, e dá para somar até três");

b.igual(cartoes().length, 1,
  "escolher dependentes já abre o primeiro cartão — sem obrigar um clique a mais");

clicar(campo("btnAdicionarDependente"));
clicar(campo("btnAdicionarDependente"));
b.igual(cartoes().length, 3, "e o botão soma até três");

/* O TETO É DA CONVENÇÃO: três por associado no período. */
clicar(campo("btnAdicionarDependente"));
b.igual(cartoes().length, 3, "o quarto não entra");
b.igual(campo("btnAdicionarDependente").style.display, "none",
  "e o botão some quando o teto é atingido — em vez de existir e recusar");
b.ok(campo("depLimite").style.display !== "none",
  "no lugar dele entra a explicação do limite");

b.passo("o ✕ remove, e a numeração se refaz");
const antes = cartoes().length;
clicar(cartoes()[1].querySelector(".dep-remove"));
b.igual(cartoes().length, antes - 1, "o cartão do meio sai");
const nums = Array.prototype.map.call(cartoes(), function (c) {
  return c.querySelector(".dep-num").textContent;
});
b.igual(nums.join(","), "1,2",
  "e os que ficam são renumerados — senão sobraria 'Dependente 3' sem o 2");
b.igual(campo("btnAdicionarDependente").style.display, "",
  "o botão de adicionar volta, porque abriu vaga");

/* NUNCA FICA VAZIO: remover o último devolve um cartão em branco. Uma seção
   aberta e vazia faria a pessoa procurar o que fazer. */
clicar(cartoes()[0].querySelector(".dep-remove"));
clicar(cartoes()[0].querySelector(".dep-remove"));
b.igual(cartoes().length, 1, "removendo todos, um cartão em branco fica");

b.passo("o + de dentro insere logo depois daquele cartão");
const c0 = cartoes()[0];
c0.querySelector(".dep-nome").value = "PRIMEIRO";
clicar(c0.querySelector(".dep-add"));
b.igual(cartoes().length, 2, "o + do cartão cria outro");
b.igual(cartoes()[0].querySelector(".dep-nome").value, "PRIMEIRO",
  "e o novo entra DEPOIS, sem empurrar o que já estava preenchido");

/* ── 3. O QUE SAI DOS CARTÕES ────────────────────────────────────────────── */
b.passo("3. depPayload lê do DOM, não de um espelho em memória");

/** Preenche um cartão inteiro, como a pessoa faria. */
function preencher(card, dados) {
  function põe(sel, valor) {
    var el = card.querySelector(sel);
    if (!el) return;
    if (el.tagName === "SELECT" && valor &&
        !el.querySelector('option[value="' + valor + '"]')) {
      var op = doc.createElement("option"); op.value = valor; op.textContent = valor;
      el.appendChild(op);
    }
    el.value = valor;
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
  }
  põe(".dep-nome", dados.nome);
  põe(".dep-nascimento", dados.nasc);
  põe(".dep-tipo", dados.tipo || "FILHO");
  põe(".dep-ordem", dados.ordem);
  põe(".dep-modalidade", dados.modalidade || "ENSINO_FUNDAMENTAL");
  põe(".dep-curso", dados.curso || "5 ANO");
  if (dados.area) põe(".dep-area", dados.area);
  card._arquivo = new win.File([new win.Uint8Array(40)],
    (dados.nome || "doc") + ".pdf", { type: "application/pdf" });
}

/* Três cartões cheios, cada um diferente do outro. */
while (cartoes().length < 3) clicar(campo("btnAdicionarDependente"));
preencher(cartoes()[0], { nome: "ANA", nasc: "2016-03-02", ordem: "1", curso: "6 ANO" });
preencher(cartoes()[1], { nome: "BRUNO", nasc: "2014-07-19", ordem: "2", curso: "8 ANO" });
preencher(cartoes()[2], { nome: "CLARA", nasc: "2012-11-30", ordem: "3", curso: "9 ANO" });

var pay = win.depPayload();
b.igual(pay.length, 3, "sai um item por cartão");
b.igual(pay.map(function (d) { return d.nomeBeneficiario; }).join(","), "ANA,BRUNO,CLARA",
  "na ordem em que estão na tela");
b.igual(pay.map(function (d) { return d.ordem; }).join(","), "1,2,3",
  "com a posição refeita na leitura — não guardada de quando o cartão nasceu");
b.igual(pay[1].curso, "8 ANO", "o curso lido é o daquele cartão, não o do primeiro");
b.igual(pay[0].parentesco, pay[0].tipoBeneficiario,
  "parentesco acompanha o tipo, como no caminho do titular — sem campo para divergir");
b.ok(!!pay[2]._arquivo, "e o arquivo vem junto, preso ao elemento");

/* O ESPELHO QUE NÃO EXISTE: trocar o valor no DOM muda o que sai, sem
   ninguém precisar avisar ninguém. É essa a razão de ler do DOM. */
cartoes()[0].querySelector(".dep-nome").value = "ANA MARIA";
b.igual(win.depPayload()[0].nomeBeneficiario, "ANA MARIA",
  "mudou na tela, mudou no envio");

/* ── 4. A VALIDAÇÃO ──────────────────────────────────────────────────────── */
b.passo("4. depValidar recusa cartão incompleto — e diz QUAL");

function ultimoAviso() {
  var el = campo("msgBox");
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

b.ok(!!win.depValidar(), "os três completos passam");

/* Cada campo que falta, um de cada vez, devolvendo ao estado bom depois. */
[[".dep-nome", "nome"], [".dep-nascimento", "nascimento"],
 [".dep-ordem", "ordem"], [".dep-modalidade", "modalidade"],
 [".dep-curso", "curso"]].forEach(function (par) {
  var el = cartoes()[1].querySelector(par[0]);
  var guardado = el.value;
  el.value = "";
  b.igual(win.depValidar(), null, "sem " + par[1] + ", não envia");
  b.ok(/Dependente 2/.test(ultimoAviso()),
    "e o aviso aponta o cartão 2 — não um 'preencha os campos' genérico", ultimoAviso());
  b.ok(el.classList.contains("invalid"), "com o campo marcado na tela");
  el.value = guardado;
});

b.passo("documento em falta também barra — é ele que a Secretaria vai olhar");
var arqGuardado = cartoes()[2]._arquivo;
cartoes()[2]._arquivo = null;
b.igual(win.depValidar(), null, "sem o documento do dependente, não envia");
b.ok(/Dependente 3/.test(ultimoAviso()), "apontando o terceiro", ultimoAviso());
cartoes()[2]._arquivo = arqGuardado;

b.passo("graduação sem área é recusada — é a área que define o percentual");
var mod = cartoes()[0].querySelector(".dep-modalidade");
var modGuardada = mod.value;
if (!mod.querySelector('option[value="GRADUACAO"]')) {
  var opG = doc.createElement("option"); opG.value = "GRADUACAO"; mod.appendChild(opG);
}
mod.value = "GRADUACAO";
mod.dispatchEvent(new win.Event("change", { bubbles: true }));
cartoes()[0].querySelector(".dep-area").value = "";
b.igual(win.depValidar(), null, "sem área, não envia");
b.ok(/área do curso/i.test(ultimoAviso()), "dizendo o porquê", ultimoAviso());
mod.value = modGuardada;
mod.dispatchEvent(new win.Event("change", { bubbles: true }));
b.ok(!!win.depValidar(), "de volta ao Fundamental, a área deixa de ser exigida");

b.passo("duas vezes o mesmo filho é erro de digitação, e barra antes de gravar");
/* DOIS "1º FILHO" produziriam dois certificados de 100% para a mesma posição,
   e o segundo não teria como ser desfeito sem cancelar o voucher emitido. O
   backend também barra (t177); esta é a checagem que avisa antes da viagem. */
cartoes()[1].querySelector(".dep-ordem").value = "1";
b.igual(win.depValidar(), null, "duas ordens iguais não passam");
b.ok(/1º filho/.test(ultimoAviso()) && /uma vez/i.test(ultimoAviso()),
  "e o aviso explica a regra, em vez de só recusar", ultimoAviso());
cartoes()[1].querySelector(".dep-ordem").value = "2";

/* ── 5. OS DOCUMENTOS, EM SÉRIE ──────────────────────────────────────────── */
b.passo("5. cada documento chega na solicitação do SEU dependente");
/* EM PARALELO A ORDEM DE CHEGADA NÃO É GARANTIDA, e o documento da Ana iria
   na solicitação do Bruno — erro que ninguém percebe até a escola receber o
   documento de outra criança. */

(async function () {
  var deps = win.depValidar();
  var lidos = await new Promise(function (r) { win.lerDocsDependentes(deps, r); });

  b.igual(lidos.length, 3, "os três documentos foram lidos");
  b.igual(lidos.map(function (d) { return d.nomeBeneficiario; }).join(","),
    "ANA MARIA,BRUNO,CLARA", "na mesma ordem dos cartões");
  b.igual(lidos.map(function (d) { return d.docPessoal.nome; }).join(","),
    "ANA.pdf,BRUNO.pdf,CLARA.pdf",
    "e o documento de cada um foi parar no dele — não embaralhou");
  b.ok(lidos.every(function (d) { return d.docPessoal.base64; }),
    "com o conteúdo, não só o nome");
  b.ok(lidos.every(function (d) { return !("_arquivo" in d) && !("_card" in d); }),
    "e o que era andaime da tela (o File cru, o elemento) não vai ao servidor");

  /* ── 6. A PORTA QUE ESTAVA FECHADA POR DENTRO ──────────────────────────── */
  b.passo("6. o envio não exige campo que a pessoa não vê");
  /* DEFEITO REAL, achado ao escrever este teste: as validações do
     beneficiário único rodavam SEMPRE. No caminho dos dependentes esses
     campos estão escondidos, então o envio parava em "Selecione o tipo de
     beneficiário" apontando um campo fora da tela — sem nada a fazer a
     respeito. A seção funcionava e mesmo assim ninguém conseguiria enviar. */
  campo("cpf").value = "12345678909";
  campo("dataNascimento").value = "1985-04-12";
  campo("nome").value = "WANDERSON CASTELO";
  campo("escolaAtual").value = "UVV - VILA VELHA";
  var opSind = campo("situacaoSindicalDeclarada")
    .querySelector("option[value]:not([value=''])");
  campo("situacaoSindicalDeclarada").value = opSind ? opSind.value : "";
  campo("periodoReferencia").value = "2030/1";

  var dt = new win.DataTransfer();
  dt.items.add(new win.File([new win.Uint8Array(60)], "contracheque.pdf",
    { type: "application/pdf" }));
  campo("contracheque").files = dt.files;

  b.ok(campo("boxDocPessoalTitular").classList.contains("hidden"),
    "o documento pessoal DO TITULAR sai de cena: quem manda é o do cartão");

  /* O LIXO DOS CAMPOS ESCONDIDOS, de propósito: é exatamente o que sobra
     quando alguém preenche o caminho do titular e depois troca para
     dependentes. Ele não pode aparecer no recibo. */
  campo("curso").value = "Fundamental 1";
  campo("modalidade").value = "ENSINO_MEDIO";

  clicar(campo("btnSalvar"));
  await tela.assentar(200);

  var enviados = tela.chamadas.filter(function (c) {
    return c.fn === "salvarCadastroESolicitacaoVoucher";
  });
  b.igual(enviados.length, 1, "o envio chegou ao servidor — antes parava na validação",
    ultimoAviso());

  var enviado = enviados[0] && enviados[0].args && enviados[0].args[0];
  b.ok(enviado && Array.isArray(enviado.dependentes) && enviado.dependentes.length === 3,
    "levando os três dependentes num envio só, como você perguntou");
  b.ok(enviado && !enviado.docPessoal,
    "e sem o documento do titular no lugar do da criança");
  b.ok(enviado && enviado.contracheque && enviado.contracheque.base64,
    "o comprovante de vínculo do associado vai em todas — é dele que ele é");
  b.ok(enviado && String(enviado.periodoReferencia).trim() === "2030/1",
    "e o período, que vale para o envio inteiro, saiu de fora dos campos que somem");

  /* ── 7. O RECIBO ───────────────────────────────────────────────────────── */
  b.passo("7. o recibo não inventa um curso que não é de ninguém");
  /* DEFEITO REAL, do seu print de 22/09/2026: "Curso: Fundamental 1 —
     ENSINO_MEDIO" no topo, e dois dependentes registrados logo abaixo. O
     cabeçalho lia os campos do beneficiário único, escondidos no caminho dos
     dependentes e cheios do que sobrou de uma digitação anterior. */
  var recibo = campo("protocoloSub").innerHTML;

  b.ok(!/Fundamental 1/.test(recibo),
    "o curso do campo escondido não vai para o recibo", recibo.slice(0, 400));
  b.ok(!/ENSINO_MEDIO/.test(recibo),
    "nem a modalidade dele — nenhuma das duas era de um dependente real");
  b.ok(/Dependentes/.test(recibo),
    "no lugar entra a contagem: quantas solicitações foram registradas");

  b.passo("e cada dependente aparece com o curso DELE");
  b.ok(/ANA MARIA/.test(recibo) && /BRUNO/.test(recibo) && /CLARA/.test(recibo),
    "os três nomes estão na lista");
  b.ok(/6 ANO/.test(recibo) && /8 ANO/.test(recibo) && /9 ANO/.test(recibo),
    "com o curso de cada um ao lado do nome", recibo.slice(0, 800));

  b.passo("a modalidade é mostrada por extenso, não pelo valor do banco");
  b.igual(win.rotuloModalidade("ENSINO_FUNDAMENTAL"), "Ensino Fundamental",
    "ENSINO_FUNDAMENTAL vira 'Ensino Fundamental'");
  b.ok(/Ensino Fundamental/.test(recibo),
    "e é assim que sai no recibo — quem lê não conhece o nome da coluna");

  b.naoTestavel("o desenho dos cartões na tela",
  "jsdom não aplica CSS — roteiro manual: abrir o portal, escolher " +
    "'para meus dependentes' e conferir que os cartões aparecem empilhados");
  b.resumo();
})();
