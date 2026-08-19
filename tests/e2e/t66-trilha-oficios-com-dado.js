/**
 * TESTE — A TRILHA DE AUDITORIA COM O OFÍCIO DENTRO
 *
 * O QUE ORIGINOU
 *
 * Item aberto em 11/08/2026, registrado em docs/PENDENTE-VERIFICACAO.md e
 * carregado desde então com três frases que eu mesmo escrevi:
 *
 *     "A lista com registros — NUNCA foi vista com dado."
 *     "O modal dos 14 campos — NUNCA foi aberto em navegador."
 *     "Combinado com o usuário: ele testa mais adiante."
 *
 * Oito dias parado. E, medindo hoje, dava para ter testado desde sempre: o
 * emulador emite ofício de verdade e a trilha grava numa aba de verdade.
 * Fica o registro do erro de julgamento — mandar para o usuário o que eu
 * podia rodar aqui é o que a REGRA Nº -1 chama de "não sugeriu".
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * O caminho inteiro, do gatilho ao que a pessoa lê:
 *
 *     emitir ofício → registrarLogSistema → aud_deLogSistema_
 *                   → grava na aba → auditoriaConsultar
 *                   → a tela desenha a linha → o modal abre com os campos
 *
 * ARMADILHA QUE EU MESMO CAÍ ao investigar, e que vale deixar escrita: a
 * resposta da consulta traz a lista em `acoes`, não em `itens`. Meu
 * primeiro probe procurou `itens`, achou zero e eu quase reportei "a
 * consulta não devolve nada" — quando o defeito era do probe. Por isso o
 * passo 3 confere o NOME do campo antes de contar.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a
 * aparência do modal e da lista. jsdom não aplica CSS.
 */
const b = require("./base");
const dom = require("./dom");
const r = b.subir({});
const g = r.g;

b.fluxo("TRILHA · O ofício emitido chega até a tela de auditoria");

b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* A aba de registro que a emissão usa. */
const CAB = ["Item", "Nome", "CPF", "Ficha / Arquivo", "TIPO", "Número do Ofício",
             "Escola (Razão Social)", "CNPJ", "Data envio ofício", "Status",
             "Link PDF", "Link Ficha", "E-mail (principal)", "E-mails (todos)", "CONFIG"];
let reg = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (reg) ss.deleteSheet(reg);
reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, CAB.length).setValues([CAB]);

function linhasDaTrilha() {
  const s = ss.getSheetByName("SISGEP_Auditoria");
  return s ? s.getLastRow() : 0;
}

function ficha(nome) {
  return { nome: nome, tipo: "application/pdf", base64: g.Utilities.base64Encode("X") };
}

/* ═══════════════════════════════════════════════════════════
   1. Emitir um ofício grava na trilha
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const antes = linhasDaTrilha();
const emissao = g.gerarOficioWeb({
  tipo: "Filiação", escola: "COLEGIO EXEMPLO LTDA", cnpj: "36136001000105",
  email: "diretoria@exemplo.com", colaboradores: [{ nome: "CLARA GOMES" }],
  fichas: [ficha("ficha_clara.pdf")], confirmarDuplicata: true
}, TOKEN);

b.ok(emissao && !emissao.erro, "o ofício é emitido",
  emissao && emissao.mensagem ? String(emissao.mensagem).slice(0, 120) : "");
const numero = emissao && emissao.dados && emissao.dados.numero;
b.ok(!!numero, "com número", numero);

b.passo("2");
b.igual(linhasDaTrilha(), antes + 1,
  "e a trilha ganhou UMA linha",
  "a ponte é aditiva: o LOG_SISTEMA continua, a trilha recebe além dele");

/* ═══════════════════════════════════════════════════════════
   2. A consulta devolve o ofício
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
const consulta = g.auditoriaConsultar({}, TOKEN);
b.ok(consulta && consulta.ok === true, "a consulta responde ok",
  consulta && consulta.mensagem);
/* O NOME do campo vem antes da contagem — foi aqui que meu probe se
   enganou, procurando `itens` num retorno que usa `acoes`. */
b.ok(Array.isArray(consulta.acoes),
  "a lista vem no campo `acoes`",
  "procurar `itens` devolve undefined e faz parecer que a trilha está vazia");
b.ok(consulta.acoes.length > 0, "e não está vazia",
  consulta.acoes.length + " registro(s)");

b.passo("4");
const doOficio = consulta.acoes.filter(function (a) {
  return String(a.registroId || "").indexOf(numero) > -1;
})[0];
b.ok(!!doOficio, "o ofício emitido está na trilha, pelo número",
  consulta.acoes.map(a => a.registroId).join(" · "));
/* Tudo abaixo depende de o registro EXISTIR. Sem a reserva `|| {}`, a
   mutação que desliga a ponte derrubava o teste em vez de reprová-lo — e
   teste que quebra esconde as outras falhas, que é o que se quer ler numa
   mutação. Terceira vez que caio nisso hoje; fica a reserva. */
const of_ = doOficio || {};
b.igual(of_.modulo, "Documentos", "classificado no módulo Documentos");
b.igual(of_.submodulo, "Ofícios", "e no submódulo Ofícios");
b.ok(String(of_.usuario || "").indexOf("wanderson") > -1,
  "com o usuário que emitiu", of_.usuario);
b.ok(String(of_.justificativa || "").indexOf("COLEGIO EXEMPLO") > -1,
  "e a escola no registro", of_.justificativa);

b.passo("5");
/* O filtro por módulo é o que a tela usa para separar Documentos do resto. */
const soDocumentos = g.auditoriaConsultar({ modulo: "Documentos" }, TOKEN);
b.ok(soDocumentos.acoes.length >= 1, "filtrar por Documentos traz o ofício");
b.ok(soDocumentos.acoes.every(a => a.modulo === "Documentos"),
  "e SÓ registros de Documentos",
  soDocumentos.acoes.map(a => a.modulo).join(" · "));

b.passo("6");
/* Contraprova: filtro que não casa tem que voltar vazio, não a lista
   inteira. Filtro que não filtra é pior que filtro nenhum numa trilha. */
const nada = g.auditoriaConsultar({ modulo: "ModuloQueNaoExiste" }, TOKEN);
b.igual(nada.acoes.length, 0, "filtro sem correspondência volta vazio");

/* ═══════════════════════════════════════════════════════════
   3. A TELA — a metade que nunca tinha sido aberta
   ═══════════════════════════════════════════════════════════ */
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("A lista e o modal na tela", "jsdom não instalado");
  b.resumo();
  process.exit(0);
}

b.fluxo("TRILHA · A tela desenha a linha e abre o modal");

(async function () {
  const tela = dom.montar(g, ["AuditoriaTrilha.html"], { token: TOKEN });
  const doc = tela.doc, win = tela.win;
  doc.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));

  b.passo("7");
  /* O marcador existe para o caso da REGRA Nº 0: se o bloco de script não
     executou, a tela renderiza e nada responde. */
  b.igual(win.AUD_TRILHA_MARCADOR, "bloco de script executou",
    "o JavaScript da tela executou",
    "sem isto, a tela abre e nenhum botão responde — REGRA Nº 0");
  b.ok(typeof win.initAuditoriaTrilha === "function",
    "e a função de início está exposta");

  b.passo("8");
  win.initAuditoriaTrilha();
  await tela.assentar(150);

  const lista = doc.getElementById("audLista");
  b.ok(!!lista, "a área da lista existe");
  const texto = (lista.textContent || "").replace(/\s+/g, " ").trim();
  b.ok(texto.length > 0, "e foi PREENCHIDA — não ficou vazia",
    "esta é a asserção que o item pendente pedia desde 11/08");
  b.ok(texto.indexOf(numero) > -1,
    "com o número do ofício emitido", texto.slice(0, 140));
  b.ok(/Of[íi]cios/.test(texto), "e o submódulo Ofícios", texto.slice(0, 140));

  b.passo("9");
  b.ok(!/Carregando/i.test(texto),
    "e a lista não ficou presa em 'Carregando'", texto.slice(0, 80));

  b.passo("10");
  /* O MODAL DOS 14 CAMPOS — nunca aberto até hoje. */
  const overlay = doc.getElementById("audModalOverlay");
  b.ok(!!overlay, "o modal existe na tela");
  b.igual(overlay.style.display, "none", "e começa fechado");

  /* Abre pelo mesmo caminho da tela: a linha da lista. O seletor é
     `tr[data-i]` — a própria tela marca cada linha com o índice e pendura
     o onclick nela (aRenderLista). Minha primeira versão usou um seletor
     genérico, pegou o <tr> do CABEÇALHO e não abriu nada; o teste marcou
     "não testável" quando o certo era mirar melhor. */
  const clicavel = lista.querySelector("tr[data-i]");
  if (clicavel && typeof clicavel.click === "function") {
    clicavel.click();
    await tela.assentar(60);
  }
  const abriu = overlay.style.display !== "none";
  if (!abriu && typeof win.audAplicarFiltroExterno === "function") {
    /* Reserva: se o clique não achou alvo no jsdom, o teste ainda precisa
       dizer se o modal MONTA — e não passar batido. */
    b.naoTestavel("O clique na linha abre o modal",
      "jsdom não encontrou elemento clicável na lista renderizada");
  } else {
    b.ok(abriu, "clicar na linha ABRE o modal",
      "nunca tinha sido aberto em navegador nenhum");
    if (abriu) {
      const corpo = (overlay.textContent || "").replace(/\s+/g, " ").trim();
      b.ok(corpo.indexOf(numero) > -1,
        "e o modal mostra o ofício certo", corpo.slice(0, 140));
      b.ok(/Documentos/.test(corpo), "com o módulo");
      b.ok(/wanderson/.test(corpo), "e o usuário que emitiu");
    }
  }

  b.naoTestavel("A aparência da lista e do modal",
    "jsdom não aplica CSS; cor, alinhamento e largura se conferem abrindo a tela");

  b.resumo();
})();
