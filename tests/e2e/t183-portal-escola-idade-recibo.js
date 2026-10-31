/**
 * TESTE — TRÊS COISAS QUE O USUÁRIO VIU NA TELA, EM 16/09/2026
 *
 * Ele testou o portal com o PRÓPRIO CADASTRO e mandou três prints:
 *
 *   1. IDADE. Associado de 45 anos pedindo Pós-Graduação levava
 *      "⚠️ Idade incompatível! Para Graduação, a idade deve estar entre 17 e
 *      35 anos. Idade atual: 45 anos." — e o formulário travava.
 *      "Para titular não tem regra de idade." O backend nunca barrou o
 *      titular; quem barrava era a tela.
 *
 *   2. ESCOLA. Eram dois campos: uma lista com 679 escolas e, escondido,
 *      "Nome da escola" — que só aparecia ao achar, no fim da lista, a opção
 *      "🏫 Outra escola não listada". "Ele deve buscar a escola e se não
 *      encontrar deve digitar o nome da escola."
 *
 *   3. RECIBO. O card "Solicitação registrada" aparecia EMBAIXO do
 *      formulário inteiro, com os campos preenchidos e o botão "Salvar
 *      solicitação" ainda clicável. "Essa parte deve somente aparecer sem os
 *      cards anteriores."
 *
 * A tela sobe num DOM de verdade e as funções são CHAMADAS. jsdom não aplica
 * CSS, então "sumiu" aqui quer dizer `style.display === 'none'` — que é o
 * mecanismo real, já que a troca é feita por style inline, não por classe.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("PORTAL DE BOLSAS · idade do titular, busca de escola e recibo");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Idade, escola e recibo na tela", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const tela = dom.montar(g, ["PortalVoucher.html"], { token: "" });
const win = tela.win || tela.window || tela;
const doc = win.document;

function campo(id) { return doc.getElementById(id); }

/* SELECT SÓ ACEITA VALOR QUE EXISTE — e foi assim que a primeira versão deste
   teste "achou um defeito" que não existia: eu setava tipoBeneficiario =
   "FILHO" num select ainda vazio, o valor não pegava, a tela via tipo em
   branco e caía na tabela de faixas. O erro era do andaime, não da tela.
   Aqui a opção é criada antes de ser escolhida, como o navegador teria
   depois de preencherSelect rodar. */
function setar(id, valor) {
  const el = campo(id);
  if (!el) return el;
  if (el.tagName === "SELECT" && valor &&
      !Array.prototype.some.call(el.options, function (o) { return o.value === valor; })) {
    const op = doc.createElement("option");
    op.value = valor; op.textContent = valor;
    el.appendChild(op);
  }
  el.value = valor;
  if (el.tagName === "SELECT" && valor) {
    b.ok(el.value === valor, "(andaime) o select " + id + " aceitou o valor " + valor);
  }
  return el;
}

/* ── 1. IDADE ────────────────────────────────────────────────────────────── */
b.passo("1. O titular não passa por faixa de idade nenhuma");

b.ok(typeof win.validarIdadeModalidade === "function",
  "a função de validação de idade existe na tela");

/* O caso exato do print: 45 anos, POS_GRADUACAO, para o próprio associado.
   A faixa da tela dizia 21–50 para Pós e 17–35 para Graduação — as duas
   recusariam alguém fora, e nenhuma delas tem base na convenção. */
const hoje = new Date();
const nasc45 = (hoje.getFullYear() - 45) + "-08-01";
setar("dataNascimentoBeneficiario", nasc45);
setar("tipoBeneficiario", "TITULAR");

setar("modalidade", "POS_GRADUACAO");
b.ok(win.validarIdadeModalidade() === true, "titular de 45 anos passa em Pós-Graduação");
setar("modalidade", "GRADUACAO");
b.ok(win.validarIdadeModalidade() === true,
  "e em Graduação também — era exatamente a mensagem do print");

/* 70 anos: nenhuma faixa da tabela alcança, e continua tendo de passar. */
setar("dataNascimentoBeneficiario", (hoje.getFullYear() - 70) + "-03-15");
b.ok(win.validarIdadeModalidade() === true, "e um titular de 70 anos também");

b.ok(!campo("dataNascimentoBeneficiario").classList.contains("invalid"),
  "o campo não fica marcado em vermelho para o titular");

/* A REGRA DO DEPENDENTE NÃO PODE TER IDO JUNTO. Este é o teste que impede a
   correção de virar "tirei a validação": o limite de 24 anos para filho é da
   convenção, e o backend o aplica. Se a tela parasse de avisar, a pessoa
   preencheria o formulário inteiro para ser recusada depois. */
/* O LIMITE DE 24 ANOS PARA DEPENDENTE — e ele mudou de forma em 17/09/2026.
   ANTES: travava o envio, e SÓ para Graduação e Pós. Para ensino básico,
   técnico e pré-vestibular a checagem nem rodava — um filho de 26 no
   pré-vestibular passava sem aviso nenhum.
   AGORA: vale para TODA modalidade, avisa e DEIXA SEGUIR. É a sua decisão de
   16/09: "ele pode preencher o cadastro, tudo normalmente; quando chegar para
   a Marcelha fazer validação, o sistema informa". O backend grava
   BLOQUEADA_POR_REGRA e a Secretaria responde — travar aqui faria o sindicato
   perder o registro de que a pessoa procurou. */
setar("tipoBeneficiario", "FILHO");
setar("dataNascimentoBeneficiario", (hoje.getFullYear() - 26) + "-03-15");

["GRADUACAO", "POS_GRADUACAO", "PRE_VESTIBULAR", "ENSINO_MEDIO", "TECNICO"]
  .forEach(function (mod) {
    setar("modalidade", mod);
    b.ok(win.validarIdadeModalidade() === true,
      "FILHO de 26 em " + mod + ": o envio segue — a Secretaria decide");
  });

/* MAS O AVISO PRECISA APARECER, senão "deixa seguir" vira "não viu". */
setar("modalidade", "PRE_VESTIBULAR");
win.validarIdadeModalidade();
const avisos = (tela.avisos || []).concat(
  doc.getElementById("msgBox") ? [{ msg: doc.getElementById("msgBox").textContent }] : []);
const textoAviso = avisos.map(function (a) { return String(a.msg || ""); }).join(" ");
b.ok(/24 anos/.test(textoAviso) && /26 anos/.test(textoAviso),
  "e a tela avisa, com a idade e o limite", textoAviso.slice(0, 120));
b.ok(/Secretaria/.test(textoAviso),
  "dizendo que a Secretaria analisa — em vez de só recusar");

/* O CAMPO NÃO FICA MARCADO DE VERMELHO: não é erro de preenchimento, é caso
   que precisa de análise. Vermelho ali diria "você errou", e ela não errou. */
b.ok(!campo("dataNascimentoBeneficiario").classList.contains("invalid"),
  "e o campo não é marcado como errado — não é erro, é caso para analisar");

setar("dataNascimentoBeneficiario", (hoje.getFullYear() - 20) + "-03-15");
b.ok(win.validarIdadeModalidade() === true, "e um filho de 20 anos passa");

/* ── 1b. CÔNJUGE TAMBÉM NÃO TEM REGRA DE IDADE ──────────────────────────── */
/* "Esposo, esposa não tem limite de idade" — você, 17/09/2026.

   MEDIDO ANTES DE CORRIGIR, e o defeito era real: cônjuge de 45 anos passava
   em Pós-Graduação (faixa 21–50) e era BARRADO em Graduação (17–35) e em
   Técnico (15–25). A pessoa não fazia ideia do porquê — a mensagem falava de
   idade, não de parentesco.

   É o MESMO defeito que o titular tinha, corrigido em 16/09 e não estendido
   ao cônjuge. Por isso este bloco varre as duas isenções juntas: quem
   corrigir uma no futuro esbarra na outra. */
b.passo("1b. Cônjuge passa em qualquer modalidade, em qualquer idade");

["TITULAR", "CONJUGE"].forEach(function (quem) {
  setar("tipoBeneficiario", quem);
  [30, 45, 60, 70].forEach(function (idade) {
    setar("dataNascimentoBeneficiario", (hoje.getFullYear() - idade) + "-05-10");
    ["GRADUACAO", "POS_GRADUACAO", "TECNICO", "ENSINO_MEDIO"].forEach(function (mod) {
      setar("modalidade", mod);
      b.ok(win.validarIdadeModalidade() === true,
        quem + " de " + idade + " anos passa em " + mod);
    });
  });
});

/* A REGRA DO FILHO NÃO PODE TER IDO JUNTO NA ISENÇÃO. Este é o par do teste
   acima: isentar demais é tão errado quanto isentar de menos. */
setar("tipoBeneficiario", "FILHO");
setar("dataNascimentoBeneficiario", (hoje.getFullYear() - 30) + "-05-10");
setar("modalidade", "GRADUACAO");
win.validarIdadeModalidade();
const avisoFilho = (tela.avisos || []).map(function (a) { return String(a.msg || ""); }).join(" ") +
  (doc.getElementById("msgBox") ? doc.getElementById("msgBox").textContent : "");
b.ok(/24 anos/.test(avisoFilho),
  "mas FILHO de 30 continua sendo avisado do limite de 24");

/* ── 1c. A FAIXA POR CURSO AVISA, E NÃO RECUSA ──────────────────────────── */
/* "A idade não interfere" — você, 17/09/2026. A medição deu razão: a tela
   recusava CINCO casos que a convenção aprova. A tabela de faixas (Creche
   0–3, Médio 15–17…) não está na convenção — alguém a escreveu como apoio e
   ela virou regra por acidente, a mesma coisa que barrava o titular em Pós e
   o cônjuge em Graduação. */
b.passo("1c. Quem repetiu, entrou adiantado ou voltou a estudar consegue pedir");

function msgDaTela() {
  const el = doc.getElementById("msgBox");
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}
function tentar(idade, modalidade, tipo) {
  setar("tipoBeneficiario", tipo || "FILHO");
  setar("dataNascimentoBeneficiario", (hoje.getFullYear() - idade) + "-05-10");
  setar("modalidade", modalidade);
  const el = doc.getElementById("msgBox"); if (el) el.textContent = "";
  return { passou: win.validarIdadeModalidade(), aviso: msgDaTela() };
}

/* OS CINCO CASOS REAIS que a tela recusava. O backend aprovava todos —
   a divergência entre os dois é o defeito. */
[[16, "ENSINO_FUNDAMENTAL", "filho que repetiu"],
 [19, "ENSINO_MEDIO",       "filho que voltou a estudar"],
 [13, "TECNICO",            "filho que entrou cedo no técnico"],
 [10, "ENSINO_MEDIO",       "filho adiantado"],
 [4,  "ENSINO_FUNDAMENTAL", "criança alfabetizada cedo"]].forEach(function (c) {
  const r = tentar(c[0], c[1]);
  b.ok(r.passou === true, c[2] + " (" + c[0] + " em " + c[1] + ") consegue enviar");

  /* E a regra tem de concordar: se o backend recusasse, a tela estaria só
     empurrando o problema para a frente. */
  const regra = g.calcularRegraVoucher_({
    modalidade: c[1], tipoBeneficiario: "FILHO", ordemFilho: "1", curso: "x" }, c[0]);
  b.ok(regra.apto === true,
    "e a regra da convenção aprova o mesmo caso", regra.percentual + "%");
});

b.passo("mas o erro de digitação continua sendo avisado");
/* É por isso que a faixa não saiu de vez: ano de nascimento com um dígito
   trocado vira criança de 2 anos no Ensino Médio, e é bom ver isso ANTES do
   envio — não depois, no voucher emitido. */
const dedoErrado = tentar(2, "ENSINO_MEDIO");
b.ok(dedoErrado.passou === true, "o envio não é travado");
b.ok(/2 anos/.test(dedoErrado.aviso) && /fora do previsto/.test(dedoErrado.aviso),
  "mas a tela avisa, com a idade e a faixa esperada", dedoErrado.aviso.slice(0, 90));
b.ok(/[Cc]onfira a data/.test(dedoErrado.aviso),
  "e diz o que fazer: conferir a data de nascimento");

/* NÃO MARCA O CAMPO DE VERMELHO. Vermelho diz "você errou"; aqui o sistema
   não sabe se errou — está pedindo conferência. */
b.ok(!campo("dataNascimentoBeneficiario").classList.contains("invalid"),
  "sem marcar o campo como errado — o sistema pede conferência, não acusa");

/* E QUANDO A IDADE BATE, ninguém é incomodado. */
const normal = tentar(16, "ENSINO_MEDIO");
b.ok(normal.passou === true, "filho de 16 no Ensino Médio passa");
b.igual(normal.aviso, "", "e sem aviso nenhum — o caso comum é silencioso");

/* ── 2. ESCOLA ───────────────────────────────────────────────────────────── */
b.passo("2. Um campo só: busca na lista, ou escreve o nome");

const elEscola = campo("escolaAtual");
b.ok(!!elEscola, "o campo de escola existe");
b.igual(elEscola.tagName, "INPUT", "é campo de digitação, não mais uma lista de 679 linhas");
b.igual(elEscola.getAttribute("list"), "listaEscolas", "ligado à lista de sugestões");
b.ok(!!doc.getElementById("listaEscolas"), "e a lista de sugestões existe no documento");

/* AS SUGESTÕES SAEM DO CADASTRO, e o valor é só o nome: com a cidade no
   `value`, a escola chegaria ao backend como "UVV — Vila Velha" e não casaria
   com nenhum cadastro. */
win.INIT.escolas = [
  { escola: "UVV - VILA VELHA", cidade: "Vila Velha" },
  { escola: "COLEGIO SALESIANO", cidade: "Vitória" }
];
win.preencherEscolas();
const ops = doc.getElementById("listaEscolas").querySelectorAll("option");
b.igual(ops.length, 2, "as escolas do cadastro viraram sugestões");
b.igual(ops[0].value, "UVV - VILA VELHA", "o valor é só o nome da escola");
b.ok(ops[0].label.indexOf("Vila Velha") > -1, "e a cidade aparece na sugestão, para distinguir homônimas");

/* O CASO QUE MOTIVOU O PEDIDO: escola que não está no cadastro. */
elEscola.value = "ESCOLA NOVA QUE NAO ESTA NO CADASTRO";
b.igual(elEscola.value, "ESCOLA NOVA QUE NAO ESTA NO CADASTRO",
  "o que foi digitado fica — não há mais opção especial a descobrir");

win.preencherEscolaAtual("COLEGIO SALESIANO");
b.igual(elEscola.value, "COLEGIO SALESIANO", "e o cadastro localizado preenche o campo");
win.preencherEscolaAtual("UMA QUE NINGUEM CADASTROU");
b.igual(elEscola.value, "UMA QUE NINGUEM CADASTROU",
  "inclusive quando a escola do cadastro não está na lista de sugestões");

/* O SEGUNDO CAMPO E A OPÇÃO ESPECIAL SUMIRAM DE VEZ. Deixar qualquer um dos
   dois para trás faria a tela ter dois caminhos para a mesma coisa. */
b.ok(!doc.getElementById("outraEscola"), "o campo 'Nome da escola' separado não existe mais");
b.ok(!doc.getElementById("boxOutraEscola"), "nem a caixa que o escondia");
const fonte = require("fs").readFileSync(
  require("path").join(dom.RAIZ, "PortalVoucher.html"), "utf8");
b.ok(fonte.indexOf("__OUTRA_ESCOLA__") === -1,
  "e o valor mágico '__OUTRA_ESCOLA__' não sobrou em lugar nenhum do arquivo");

/* ── 3. RECIBO ───────────────────────────────────────────────────────────── */
b.passo("3. Emitido o protocolo, só o recibo fica na tela");

const secoes = doc.querySelectorAll(".secao, .acoes");
b.ok(secoes.length >= 5, "a tela tem as seções do formulário e a barra de ações",
  secoes.length + " blocos");

win.portalSoRecibo(true);
let escondidas = 0;
secoes.forEach(function (el) { if (el.style.display === "none") escondidas++; });
b.igual(escondidas, secoes.length, "todas somem quando o recibo aparece");

/* E O BOTÃO DE SALVAR JUNTO — era o risco real: formulário preenchido com
   botão ativo, logo abaixo de um protocolo já emitido, é pedido duplicado. */
const areaAcoes = campo("btnSalvar").closest(".acoes");
b.ok(areaAcoes && areaAcoes.style.display === "none",
  "o botão 'Salvar solicitação' sai da tela com o resto");

b.ok(typeof win.portalNovaSolicitacao === "function",
  "existe a volta — sem ela, a saída seria recarregar a página");
win.portalNovaSolicitacao();
let visiveis = 0;
secoes.forEach(function (el) { if (el.style.display !== "none") visiveis++; });
/* TODAS MENOS UMA: a seção 3b (Dependentes) nasce escondida e tem de
   continuar assim — ver o bloco logo abaixo. */
b.igual(visiveis, secoes.length - 1, "e ela devolve o formulário");
b.igual(campo("cpf").value, "", "com os campos limpos, prontos para o próximo pedido");

/* A VOLTA NÃO PODE REVELAR O QUE ESTAVA ESCONDIDO.
   A seção 3b (Dependentes) nasce com display:none e é casca vazia hoje — não
   tem campo nenhum dentro. A primeira versão de portalSoRecibo devolvia '' a
   TODAS as seções na volta, e fazia essa aparecer. Defeito que este bloco
   criou; agora o estado anterior de cada seção é guardado. */
b.igual(campo("secaoDependentes").style.display, "none",
  "e a seção de Dependentes, que nascia escondida, continua escondida");

/* Ida e volta duas vezes: se o guardado não fosse apagado na volta, a segunda
   ida gravaria 'none' como "estado anterior" e tudo ficaria invisível. */
win.portalSoRecibo(true);
win.portalSoRecibo(false);
b.igual(campo("secaoDependentes").style.display, "none",
  "inclusive depois de esconder e mostrar duas vezes");
let visiveis2 = 0;
secoes.forEach(function (el) { if (el.style.display !== "none") visiveis2++; });
b.igual(visiveis2, secoes.length - 1,
  "e as outras seis voltam a aparecer — só a escondida fica escondida");

/* ── 4. NENHUM CAMPO PESSOAL GUARDA HISTÓRICO NO NAVEGADOR ──────────────── */
/* Achado por você em 16/09/2026: o campo CPF do portal PÚBLICO abria uma
   lista com quatro CPFs de outras pessoas. É o histórico de formulário do
   navegador — que num computador compartilhado entrega CPF, nome, telefone e
   endereço de quem preencheu antes para o associado seguinte. */
b.passo("4. O campo não oferece o que a pessoa anterior digitou");

const PESSOAIS = ["cpf", "dataNascimento", "nome", "telefone", "email", "cep",
                  "endereco", "cargoFuncao", "nomeBeneficiario",
                  "dataNascimentoBeneficiario", "nomeTitularAssociado",
                  "curso", "escolaAtual"];
PESSOAIS.forEach(function (id) {
  const el = campo(id);
  b.ok(!!el, "o campo " + id + " existe na tela");
  if (el) {
    b.igual(String(el.getAttribute("autocomplete") || "").toLowerCase(), "off",
      id + " não guarda histórico no navegador");
  }
});

/* A VARREDURA QUE IMPEDE O PRÓXIMO CAMPO DE NASCER SEM A TRAVA. Listar os
   treze acima protege os treze; esta olha TODO campo de digitação da página,
   inclusive o que alguém acrescentar amanhã. Arquivo e botão ficam de fora —
   não guardam texto. */
const digitaveis = Array.prototype.slice.call(
  doc.querySelectorAll('input[type="text"], input[type="email"], input[type="date"], input[type="tel"], input[type="number"], textarea'));
b.ok(digitaveis.length >= 13, "a varredura alcançou os campos da página",
  digitaveis.length + " campos");
const semTrava = digitaveis.filter(function (el) {
  return String(el.getAttribute("autocomplete") || "").toLowerCase() !== "off";
}).map(function (el) { return el.id || el.name || "(sem id)"; });
b.igual(semTrava.length, 0,
  "nenhum campo de digitação do portal ficou sem autocomplete=off",
  semTrava.join(", ") || "todos protegidos");

/* ── 5. O BOTÃO FECHAR ──────────────────────────────────────────────────── */
/* Pedido seu em 16/09/2026, olhando a tela de recibo já funcionando. */
b.passo("5. Fechar encerra sem enganar");

b.ok(typeof win.portalEncerrar === "function", "a ação de fechar existe");

/* O bloco anterior terminou pedindo uma nova solicitação, que tira o recibo
   da tela. Repõe o cenário de quem acabou de salvar — senão a asserção sobre
   o protocolo continuar à vista mediria o estado deixado por outro passo. */
campo("protocoloBox").classList.add("visible");
b.igual(campo("protocoloEncerrado").style.display, "none",
  "o encerramento começa escondido");

/* window.close() só funciona em aba que o próprio script abriu; esta veio de
   um link, e o navegador recusa EM SILÊNCIO. Por isso o botão não pode
   depender dele — tem que deixar a tela dizendo que acabou.

   AQUI O ANDAIME PRECISA SEGURAR O close(), e a razão é boa de saber: jsdom
   IMPLEMENTA window.close() e destrói o documento. A primeira versão deste
   bloco estourou com "Cannot read properties of null" logo depois de chamar
   portalEncerrar — não porque a tela estivesse errada, mas porque o DOM
   inteiro tinha deixado de existir. Neutralizar o close reproduz o navegador
   real, que é onde a recusa acontece. */
let tentouFechar = false;
win.close = function () { tentouFechar = true; };
win.portalEncerrar();
b.ok(tentouFechar, "o botão tenta fechar a aba de verdade, antes de desistir");
b.igual(campo("protocoloEncerrado").style.display, "",
  "depois de fechar, a tela diz que a solicitação foi concluída");
b.igual(campo("protocoloAcoesBox").style.display, "none",
  "e os botões saem — não há mais o que fazer aqui");

/* O PROTOCOLO NÃO PODE SUMIR: quem fecha pode estar tirando um print. */
b.ok(campo("protocoloBox").className.indexOf("visible") > -1,
  "o recibo continua na tela, com o protocolo à vista");

/* E A VOLTA DESFAZ O ENCERRAMENTO. Sem isto, quem fechasse e depois quisesse
   um segundo pedido cairia num formulário com a despedida em cima. */
win.portalNovaSolicitacao();
b.igual(campo("protocoloEncerrado").style.display, "none",
  "pedir outra solicitação desfaz o encerramento");
b.igual(campo("protocoloAcoesBox").style.display, "",
  "e devolve os botões do recibo para o próximo protocolo");

/* ── 6. PARENTESCO SAIU DA TELA, MAS NÃO DO DADO ────────────────────────── */
/* "Se dependente for filho o parentesco não deveria aparecer, correto?" —
   você, 17/09/2026. Correto: as duas listas eram quase a mesma, e escolher
   "Filho(a)" duas vezes abre a chance de dizer coisa diferente nas duas — que
   foi o defeito de ontem, tipo "Filho(a)" com parentesco preso em "Titular". */
b.passo("6. O parentesco deixa de ser perguntado");

b.ok(!!campo("boxParentesco"), "o campo continua no DOM");
b.ok(campo("boxParentesco").hasAttribute("hidden"), "mas escondido da pessoa");

/* NÃO FOI REMOVIDO, e isso é decisão: sete pontos deste arquivo leem
   getElementById('parentesco'). Tirá-lo do documento faria cada um deles
   estourar e derrubar a página inteira — a REGRA Nº 0 de novo. */
const usos = (fonte.match(/getElementById\('parentesco'\)/g) || []).length;
b.ok(usos >= 4, "e continua sendo lido pelo código", usos + " pontos");

/* O VALOR ACOMPANHA O TIPO. É o que garante que o dado gravado continua
   certo mesmo sem ninguém escolher. */
b.passo("e o valor passa a vir do tipo, sem chance de divergir");

function opcao(id, valor) {
  const el = campo(id);
  if (!Array.prototype.some.call(el.options, function (o) { return o.value === valor; })) {
    const op = doc.createElement("option");
    op.value = valor; op.textContent = valor;
    el.appendChild(op);
  }
  el.value = valor;
}
/* TITULAR JUNTO: sem ele o select rejeitaria o valor e o teste mediria ""
   em vez do que a tela grava. Foi o que aconteceu na primeira rodada. */
["TITULAR", "FILHO", "ENTEADO", "CONJUGE"].forEach(function (t) { opcao("parentesco", t); });

[["FILHO", "FILHO"], ["ENTEADO", "ENTEADO"], ["CONJUGE", "CONJUGE"]].forEach(function (par) {
  setar("tipoBeneficiario", par[0]);
  win.ajustarCamposVoucher();
  b.igual(campo("parentesco").value, par[1],
    "tipo " + par[0] + " grava parentesco " + par[1]);
});

/* O CASO QUE QUEBROU ONTEM: titular grava TITULAR, e trocar para filho tem
   de trocar o parentesco junto — antes ficava preso. */
setar("tipoBeneficiario", "TITULAR");
win.ajustarCamposVoucher();
b.igual(campo("parentesco").value, "TITULAR", "titular grava TITULAR");
setar("tipoBeneficiario", "FILHO");
win.ajustarCamposVoucher();
b.igual(campo("parentesco").value, "FILHO",
  "e ao trocar para filho o parentesco acompanha — não fica preso em TITULAR");

b.naoTestavel("como isso APARECE no navegador",
  "jsdom não desenha nem aplica CSS — roteiro manual: abrir o link público, " +
  "salvar uma solicitação e conferir que só o card verde fica na tela");
b.resumo();
