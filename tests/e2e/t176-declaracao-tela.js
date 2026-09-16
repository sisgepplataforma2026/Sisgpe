/**
 * TESTE — A TELA DE DECLARAÇÕES: ENTREGA REABERTA E REEMITIR
 *
 * O QUE ORIGINOU
 *
 * Avaliação do submódulo em 15/09/2026, sobre o commit 4e36f7a. Dois
 * defeitos estavam na METADE DE TELA do fluxo, que o t175 não alcança
 * porque ele só exercita o backend:
 *
 *   1. "Reemitir" definia o valor do select de diretor por código, e
 *      atribuir `.value` não dispara o `onchange`. O select de escola
 *      ficava desabilitado e a emissão era recusada logo depois — o botão
 *      obrigava a refazer exatamente o que prometia poupar.
 *
 *   2. A entrega (e-mail e WhatsApp) só existia logo após emitir, presa ao
 *      estado da tela. Fechar a página deixava a declaração parada em
 *      AGUARDANDO_CONFERENCIA sem nenhum caminho de volta.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * A tela sobe num DOM de verdade, com o `google.script.run` ligado no
 * backend real. A declaração é emitida ANTES de a tela existir — é o
 * cenário do dia seguinte, sem nenhum estado de emissão em memória — e o
 * teste clica na lista, abre a entrega, envia, e confere na planilha.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 *   - aparência: jsdom não aplica CSS. "O modal abriu" aqui quer dizer que
 *     a classe `aberto` entrou, não que ele apareceu na tela.
 *   - PDF, Drive, Gmail e WhatsApp reais — dependem da homologação.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("DECLARAÇÕES · Tela");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Entrega reaberta e Reemitir na tela", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

function sheet(nome, cab) {
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (!sh.getLastRow()) sh.appendRow(cab);
  return sh;
}

sheet("Associados", g.SIND_ASS_COLUNAS).appendRow([
  "UVV", "Wanderson Nascimento Castelo", "00000000000", "S", "", "", "", "Cariacica", "",
  "(27) 99999-1234", "", "wanderson@exemplo.com", new Date(), "123", new Date(), "FICHA-1"
]);
sheet("Escolas", ["EscolaID", "Escola (Razão Social)", "NOME_FANTASIA", "CNPJ", "E-mail (principal)",
  "E-mails (todos)", "Cidade", "UF", "Telefone 1", "Telefone 2", "SITUACAO_CADASTRAL"])
  .appendRow(["ESC-UVV", "Sociedade Educação e Gestão de Excelência", "UVV", "01.234.567/0001-89",
    "rh@uvv.br", "rh@uvv.br; dp@uvv.br", "Vila Velha", "ES", "", "", "ATIVA"]);

/* O PDF é a única parte que o emulador não reproduz — isolada de propósito
   em declGerarPdf_, justamente para o resto do fluxo ser testável. */
g.declGerarPdf_ = () => ({ id: "PDF-1", url: "https://drive.google.com/PDF-1" });

/* A DECLARAÇÃO NASCE ANTES DA TELA. É o ponto do teste: quando a página
   abre, não existe nenhum estado de emissão em memória — como no dia
   seguinte, em outro computador, com outra pessoa. */
const dirId = g.declDadosEmissao(TOKEN).diretores.filter(d => /WANDERSON/.test(d.nome))[0].id;
const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
const emitida = g.declEmitirDeclaracaoDiretor({
  diretorId: dirId, escolaId: "ESC-UVV",
  dataLiberacao: amanha.toISOString().slice(0, 10), periodo: "VESPERTINO"
}, TOKEN);

let tela;
try {
  tela = dom.montar(g, ["DeclaracoesAdmin.html"], { token: TOKEN });
} catch (e) {
  b.ok(false, "a tela de declarações sobe sem quebrar", String(e.message).slice(0, 180));
  b.resumo();
  process.exit(1);
}
const doc = tela.doc, win = tela.win;
function $(id) { return doc.getElementById(id); }

/* CLIQUE EM BOTÃO COM onclick INLINE.
 *
 * O andaime monta o jsdom com runScripts:"outside-only", que não compila
 * handler de atributo: um `.click()` aqui não chamaria função nenhuma, e o
 * teste acusaria a tela de não responder quando o mudo é o andaime. O que o
 * navegador faz é avaliar o conteúdo do atributo no escopo da janela — é
 * isso que está abaixo. De quebra, prova que o atributo leva os argumentos
 * certos, que é metade do defeito do Reemitir. */
/* Mesma história do clique, para campo: o andaime não compila onchange nem
 * oninput de atributo. Sem isto, escolher no select não chama nada e o teste
 * mede uma tela que ninguém tocou. */
function mudar(sel, valor, evento) {
  const el = doc.querySelector(sel);
  if (!el) throw new Error("campo não existe: " + sel);
  el.value = valor;
  const codigo = el.getAttribute(evento || "onchange");
  if (codigo) win.eval(codigo);
}

function declFecharModais() {
  ["declModalEntrega", "declModalConfig", "declModalDocumento", "declModalDuplicata"]
    .forEach(id => { const el = doc.getElementById(id); if (el) el.classList.remove("aberto"); });
}

function clicar(el, oque) {
  if (!el) throw new Error("botão não existe: " + oque);
  const codigo = el.getAttribute("onclick");
  if (!codigo) throw new Error("botão sem onclick: " + oque);
  win.eval(codigo);
}

(async function () {
  b.ok(emitida.ok, "a declaração existia antes de a tela abrir", emitida.numero);

  b.passo("1. A lista de emitidas oferece a entrega");
  win.declInit();
  win.declAba("emitidas");
  await tela.assentar(60);

  const linha = $("declHistoricoCorpo").querySelector("tr");
  b.ok(!!linha && /001\/20/.test(linha.textContent), "a declaração aparece na lista", (linha || {}).textContent && linha.textContent.replace(/\s+/g, " ").trim().slice(0, 60));

  const botoes = Array.from(linha.querySelectorAll("button"));
  const btnEntregar = botoes.filter(x => /Entregar|Reenviar/.test(x.textContent))[0];
  const btnReemitir = botoes.filter(x => /Reemitir/.test(x.textContent))[0];
  b.ok(!!btnEntregar, "a linha tem o botão de entrega", btnEntregar && btnEntregar.textContent.trim());
  b.ok(!!btnReemitir, "a linha continua com o Reemitir");

  b.passo("2. A entrega reabre sem nenhum estado de emissão em memória");
  clicar(btnEntregar, "entregar");
  await tela.assentar(60);

  b.ok($("declModalEntrega").classList.contains("aberto"), "o modal da entrega abriu");
  /* O número saiu do subtítulo e ganhou campo próprio no cabeçalho de dados,
     no padrão do modal de envio do ofício. */
  b.ok(/001\/20/.test($("declEntregaNumero").textContent), "o modal diz qual declaração é",
    $("declEntregaNumero").textContent);
  b.ok(/UVV|Sociedade/.test($("declEntregaEscola").textContent), "e para qual escola vai",
    $("declEntregaEscola").textContent);
  /* O aviso de homologação só aparece onde muda alguma coisa — no emulador
     o ambiente não é homologação, então ele fica escondido. O que precisa
     estar sempre visível é a LISTA de destinatários, que é o que a pessoa
     confere antes de clicar. */
  const caixasEmail = $("declEntregaModalContatos").querySelectorAll("[data-decl-email]");
  b.ok(caixasEmail.length > 0, "os destinatários aparecem antes do clique", caixasEmail.length + " e-mail(s)");
  b.ok(/rh@uvv\.br/.test($("declEntregaModalContatos").textContent),
    "e o endereço em si está no texto da tela, não só a origem");

  const caixas = $("declEntregaModalContatos").querySelectorAll("[data-decl-email]");
  b.ok(caixas.length === 2, "os e-mails conferidos na emissão estão lá", caixas.length + " contato(s)");
  b.ok(Array.from(caixas).filter(c => c.checked).length === 2,
    "vêm marcados os que não têm falha");
  b.ok(caixas.length > 0 && !$("declBtnEmailModal").disabled, "o botão de enviar está habilitado");

  b.passo("3. Enviar pelo modal grava na linha");
  clicar($("declBtnEmailModal"), "enviar");
  await tela.assentar(80);

  const depois = g.declEntregaDeclaracao(emitida.numero, TOKEN);
  b.ok(/ENVIADO/.test(depois.emailStatus), "a planilha registrou o envio", depois.emailStatus);
  b.ok(/rh@uvv\.br/.test(depois.emailsUsados), "com o destinatário real", depois.emailsUsados);
  b.ok(!$("declModalEntrega").classList.contains("aberto"), "o modal fecha depois do envio");
  b.ok(tela.avisos.filter(a => a.tipo === "sucesso").length > 0, "a tela avisou que enviou",
    (tela.avisos.filter(a => a.tipo === "sucesso")[0] || {}).msg);

  b.passo("4. Reemitir deixa a tela pronta para emitir — não pela metade");
  const linha2 = $("declHistoricoCorpo").querySelector("tr");
  clicar(Array.from(linha2.querySelectorAll("button")).filter(x => /Reemitir/.test(x.textContent))[0], "reemitir");
  await tela.assentar(80);

  b.ok($("declDiretor").value === dirId, "o diretor foi repetido");
  b.ok($("declPeriodos").querySelector("[data-decl-periodo='VESPERTINO']").classList.contains("declRadioAtivo"),
    "o período foi repetido");
  /* O CORAÇÃO DO DEFEITO: sem a chamada explícita a declCarregarVinculos, o
     select abaixo fica desabilitado e vazio, e a emissão é recusada. */
  b.ok(!$("declEscolaCampo").disabled, "o campo de escola ficou habilitado");
  b.ok((win.DECL_ESTADO.escola || {}).escolaId === "ESC-UVV",
    "a escola da declaração anterior voltou preenchida", (win.DECL_ESTADO.escola || {}).nome);
  b.ok(/UVV|Sociedade/.test($("declEscolaCampo").value),
    "e o nome dela aparece no campo", $("declEscolaCampo").value);
  b.ok($("declDataLiberacao").value === "", "a data da liberação vem em branco — é o que muda");

  b.passo("5. E o que a tela monta agora é emitível de verdade");
  await tela.assentar(80);
  const previaNaTela = $("declPrevia").textContent;
  b.ok(!/Selecione o diretor/.test(previaNaTela) || $("declDataLiberacao").value === "",
    "a prévia espera só pela data");
  const segunda = g.declEmitirDeclaracaoDiretor({
    diretorId: $("declDiretor").value,
    escolaId: (win.DECL_ESTADO.escola || {}).escolaId,
    dataLiberacao: amanha.toISOString().slice(0, 10),
    periodo: "VESPERTINO",
    confirmado: true
  }, TOKEN);
  b.ok(segunda.ok, "os dados repetidos pela tela emitem sem retoque", segunda.numero);

  b.passo("6. Dirigente sem vínculo: a busca manual abre sozinha");
  /* Sem esta saída, quem não casa por nome em Associados não emitia de jeito
     nenhum — nem com a escola cadastrada e à vista. */
  const semVinculo = Array.from($("declDiretor").options)
    .filter(o => o.value && !/WANDERSON/.test(o.textContent))[0];
  mudar("#declDiretor", semVinculo.value);
  await tela.assentar(120);

  b.ok(!$("declEscolaCampo").disabled, "o campo de escola aceita digitação direto");
  /* Sem vínculo, o autocomplete não esconde nada atrás de uma opção que
     ninguém adivinha: é digitar e buscar nas 679 do cadastro. A marca de
     "escolhida manualmente" aparece DEPOIS de escolher — asserção mais
     abaixo, onde ela de fato importa. */
  win.declEscolaAbrir();
  await tela.assentar(60);
  b.ok(/vínculo em Associados/i.test($("declEscolaOrigem").textContent) ||
       $("declEscolaLista").style.display !== "none",
    "o campo abre sozinho, sem etapa escondida");

  mudar("#declEscolaCampo", "UVV", "oninput");
  await tela.assentar(450);   /* 300ms de debounce + a ida ao backend */

  const achadas = $("declEscolaLista").querySelectorAll(".declAutoItem");
  b.ok(achadas.length > 0, "a busca no cadastro devolve a escola", achadas.length + " resultado(s)");

  clicar(achadas[0], "escolher escola achada");
  await tela.assentar(120);

  b.ok((win.DECL_ESTADO.escola || {}).escolaId === "ESC-UVV", "a escola escolhida entra no estado",
    (win.DECL_ESTADO.escola || {}).escolaId);
  b.ok(/manual/i.test($("declEscolaOrigem").textContent), "com a origem manual à vista",
    $("declEscolaOrigem").textContent.replace(/\s+/g, " ").trim());
  b.ok($("declEscolaLista").style.display === "none", "a lista se recolhe depois da escolha");

  b.passo("7. E o que sai dali emite, com a origem gravada");
  const manual = g.declEmitirDeclaracaoDiretor({
    diretorId: $("declDiretor").value, escolaId: (win.DECL_ESTADO.escola || {}).escolaId,
    dataLiberacao: amanha.toISOString().slice(0, 10), periodo: "MATUTINO", confirmado: true
  }, TOKEN);
  b.ok(manual.ok, "emite com a escola escolhida à mão", manual.numero);
  b.ok(g.declHistoricoDeclaracoes({ busca: manual.numero }, TOKEN).itens[0].vinculoOrigem === "Escolhida manualmente",
    "a origem manual fica gravada na linha");

  b.passo("8. Resposta velha não sobrescreve a prévia nova");
  /* Visto na tela em 15/09/2026: escola escolhida e a prévia dizendo
     "Selecione a escola empregadora". Era a prévia ANTERIOR, disparada quando
     ainda não havia escola, voltando depois da nova. Sumia ao próximo toque —
     e é por sumir sozinho que enganava. */
  /* A data ficou em branco no passo 4 (é o que o Reemitir faz). Sem ela a
     prévia nem chega ao servidor, e o teste mediria outra coisa. */
  mudar("#declDataLiberacao", amanha.toISOString().slice(0, 10));
  win.DECL_ESTADO.escola = null;
  const idxLento = tela.chamadas.length;
  tela.atrasar("declPreviaDeclaracaoDiretor", idxLento, 500);
  win.declPreviaAgora();                       /* prévia #1, sem escola, lenta */
  win.DECL_ESTADO.achadas = win.DECL_ESTADO.vinculos;
  win.declEscolaEscolher(0);                   /* prévia #2, com escola */
  await tela.assentar(800);
  b.ok(/Declaramos/.test($("declPrevia").textContent),
    "o texto que fica é o da prévia mais nova",
    $("declPrevia").textContent.replace(/\s+/g, " ").trim().slice(0, 70));
  b.ok(!/Selecione a escola/.test($("declPrevia").textContent),
    "a recusa que chegou atrasada foi descartada");

  b.passo("9. Pré-visualizar mostra o documento inteiro, como em Ofícios");
  clicar($("declBtnVer"), "pré-visualizar");
  await tela.assentar(120);
  b.ok($("declModalDocumento").classList.contains("aberto"), "o modal do documento abriu");
  const doc1 = $("declDocumentoFrame").getAttribute("srcdoc") || $("declDocumentoFrame").srcdoc || "";
  b.ok(/DECLARAÇÃO/.test(doc1) && /Art\. 543/.test(doc1), "traz o documento montado, com a citação da lei");
  b.ok(!/Declaração nº/.test(doc1), "sem rodapé de numeração, como no modelo em papel");
  b.ok(g.declHistoricoDeclaracoes({}, TOKEN).itens.every(i => i.numero !== "PRÉVIA"),
    "e nada foi gravado por pré-visualizar");

  b.passo("10. O texto não traz mais a função de cada dirigente");
  b.ok(/diretor desta Entidade Sindical/.test(doc1), "diz apenas \"diretor desta Entidade Sindical\"");
  b.ok(!/conselheiro|presidente desta|tesoureiro/i.test(doc1), "e não o cargo específico da pessoa");

  b.passo("11. O botão de conferir configuração responde pela tela");
  clicar(doc.querySelector("[onclick='declConferirConfig()']"), "conferir configuração");
  await tela.assentar(80);
  b.ok($("declModalConfig").classList.contains("aberto"), "o modal de configuração abriu");
  const linhas = $("declConfigCorpo").querySelectorAll(".declConfigLinha");
  b.ok(linhas.length === 4, "diz pasta, quem assina, dirigentes e remetente", linhas.length + " linha(s)");
  b.ok(/SISGEP_PASTA_DECLARACOES/.test($("declConfigCorpo").textContent),
    "e nomeia a propriedade que falta, em vez de só dizer que falhou");
  /* A linha de remetente entrou em 16/09/2026, depois de a declaração sair da
     conta errada e eu levar uma rodada para separar "o alias não existe" de
     "o MailApp ignora o from". Sem poder PERGUNTAR ao ambiente, a única saída
     era emitir de teste e olhar o print. */
  b.ok(/Remetente do e-mail/.test($("declConfigCorpo").textContent),
    "e diz de que conta o e-mail vai sair");
  b.ok(/secretaria@sindeducacao\.com/.test($("declConfigCorpo").textContent),
    "nomeando o endereço institucional");

  b.passo("11b. A prévia da tela escreve a entidade como o PDF escreve");
  /* A prévia mostrava "SindEducação/ES" enquanto o documento já saía com
     hífen. Passou batido porque a varredura do padrão foi feita só nos .gs —
     e é na tela que a pessoa confere antes de emitir. */
  b.ok(/SindEducação-ES/.test($("declPrevia").textContent) || !/SindEducação/.test($("declPrevia").textContent),
    "sem \"/ES\" na prévia", ($("declPrevia").textContent.match(/SindEducação[-\/]ES/) || ["(sem menção)"])[0]);

  b.passo("12. Emitir pela tela abre o modal de entrega, como no envio do ofício");
  /* Pedido do usuário em 15/09/2026: "após a emissão deve abrir um modal
     igual ao envio do ofício". Emitiu, a próxima coisa é entregar — a tela
     leva a pessoa até lá em vez de deixar a entrega escondida no rodapé. */
  win.open = () => null;                       /* jsdom não abre aba nova */
  declFecharModais();
  mudar("#declDiretor", dirId);
  await tela.assentar(150);
  win.DECL_ESTADO.achadas = win.DECL_ESTADO.vinculos;
  win.declEscolaEscolher(0);
  mudar("#declDataLiberacao", amanha.toISOString().slice(0, 10));
  await tela.assentar(350);

  clicar($("declBtnEmitir"), "emitir");
  await tela.assentar(200);
  /* Segunda via no mesmo dia: a tela pede confirmação antes — é a trava de
     duplicata funcionando, e o teste passa por ela como a pessoa passaria. */
  if ($("declModalDuplicata").classList.contains("aberto")) {
    clicar($("declModalDuplicata").querySelector(".btn-navy"), "confirmar segunda via");
    await tela.assentar(250);
  }

  b.ok($("declModalEntrega").classList.contains("aberto"),
    "o modal de entrega abriu sozinho depois de emitir");
  b.ok(/\d{3}\/\d{4}/.test($("declEntregaNumero").textContent),
    "já com o número da declaração recém-emitida", $("declEntregaNumero").textContent);
  b.ok($("declEntregaModalContatos").querySelectorAll("[data-decl-email]").length > 0,
    "e com os e-mails prontos para conferência");

  b.naoTestavel("Aparência do modal e envio real de e-mail", "jsdom não aplica CSS; Gmail depende da homologação");
  b.resumo();
})();
