/**
 * A ENTIDADE EVENTO EXISTE — MAS ELA MANDA?
 *
 * O QUE ORIGINOU
 *
 * 26/08/2026. Depois de o usuário fechar a arquitetura ("só deve ficar em
 * Eventos o que é realmente dele"), eu ia começar a Fase 1 escrevendo a
 * entidade `evento` do zero — porque a minha auditoria de 25/08 dizia que ela
 * NÃO EXISTIA.
 *
 * Fui conferir antes e a auditoria estava errada. A entidade existe inteira em
 * `EventosDominioV2.gs`, com os sete estados, repositório em planilha, service
 * exigindo administrador e auditoria própria.
 *
 * O que ela NÃO tem é autoridade. E é isso que este arquivo mede.
 *
 * A PERGUNTA QUE O TESTE FAZ
 *
 * Se eu gravar um evento dizendo que a festa é dia 5 de outubro, com 300
 * lugares, o sistema obedece — ou continua respondendo 19 de dezembro e 2.000,
 * que é o que está cravado na constante `EMISSAO_CFG`?
 *
 * Enquanto a resposta vier da constante, "cadastrar evento" é tela decorativa:
 * a pessoa preenche, salva, e nada no sistema muda de comportamento. É o tipo
 * de coisa que só aparece quando alguém EXECUTA — ler o código dá a impressão
 * contrária, porque o cadastro está lá, bonito e completo.
 *
 * COMO ESTE ARQUIVO DEVE ENVELHECER
 *
 * Cada asserção aqui é um campo que precisa migrar da constante para o
 * registro. À medida que a Fase 1 avança, elas passam de vermelho para verde
 * uma a uma — e a que já está verde não pode voltar a depender da constante.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, aviso, resumo } = b;

fluxo("EVENTO · a entidade existe, mas ela manda?");

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

/* A camada V2 só opera em homologação — trava dela, e é acertada. */
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

/* Firestore em memória: as inscrições e os ingressos vivem lá, e o evento
   vive na planilha. Essa separação é, ela mesma, um dos achados. */
const BANCO = new Map();
const clonar = o => JSON.parse(JSON.stringify(o));
g.fs_set_ = (c, i, o) => { BANCO.set(c + "/" + i, clonar(o)); return { ok: true }; };
g.fs_get_ = (c, i) => { const v = BANCO.get(c + "/" + i); return v ? clonar(v) : null; };
g.fs_list_ = c => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(c + "/") === 0) o.push(clonar(v)); }); return o; };
g.fs_queryEquals_ = (c, campo, v) => g.fs_list_(c).filter(d => String(d[campo]) === String(v));

/* ══════════════════════════════════════════════════════════════════════════
   1 · A ENTIDADE EXISTE — e isto corrige a minha auditoria
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · o que já existe (e a auditoria de 25/08 negou)");

ok(typeof g.eventosV2_normalizarEvento_ === "function",
   "a entidade Evento existe, normalizada",
   "a auditoria disse que não existia — estava errada");

const ESTADOS = Object.keys(g.EVENTOS_V2_STATUS || {});
igual(ESTADOS.sort().join(","),
      ["CANCELADO","EM_ANDAMENTO","ENCERRADO","INSCRICOES_ABERTAS",
       "INSCRICOES_ENCERRADAS","PROGRAMADO","RASCUNHO"].sort().join(","),
      "e traz os sete estados do ciclo de vida",
      "são exatamente os estados que foram parar na arquitetura aprovada");

ok(typeof g.eventosV2Repo_salvar_ === "function" &&
   typeof g.eventosV2Repo_listar_ === "function",
   "  com persistência própria");
ok(typeof g.eventosV2Repo_registrarAuditoria_ === "function",
   "  e trilha de auditoria");

/* ══════════════════════════════════════════════════════════════════════════
   2 · O QUE NÃO EXISTE: porta para criar e listar evento
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · dá para cadastrar um segundo evento?");

/* Endpoint é o que o frontend alcança: função sem `_` no fim. O service sabe
   listar, mas se nenhum endpoint chamar, a tela não tem como pedir. */
const ENDPOINTS = Object.keys(g).filter(function (n) {
  return /^eventosV2/.test(n) && typeof g[n] === "function" && !/_$/.test(n);
});

ok(ENDPOINTS.length > 0, "há endpoints da V2 expostos: " + ENDPOINTS.join(", "));

const criaQualquer = ENDPOINTS.some(function (n) { return /criar|novo/i.test(n); });
const listaQualquer = ENDPOINTS.some(function (n) { return /listar/i.test(n); });

ok(criaQualquer,
   "existe endpoint para CRIAR um evento",
   criaQualquer ? "" : "não existe: os dois endpoints só sabem da Festa 2026, " +
     "então não há como cadastrar a assembleia nem o curso");
ok(listaQualquer,
   "existe endpoint para LISTAR os eventos",
   listaQualquer ? "" : "eventosV2Service_listar_ existe e ninguém o chama — " +
     "a tela 1 do desenho aprovado não tem de onde tirar a lista");

/* ══════════════════════════════════════════════════════════════════════════
   3 · O TESTE QUE IMPORTA: gravo um evento diferente. O sistema obedece?
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · gravo a festa em outra data, com outra lotação");

/* Valores deliberadamente diferentes da constante, para não haver empate:
   a constante diz 19/12/2026 e 2.000 lugares. */
const DATA_DO_REGISTRO = '2026-10-05';   /* como a tela grava: civil, sem fuso */
const LOTACAO_DO_REGISTRO = 300;

g.eventosV2Repo_salvar_(g.eventosV2_normalizarEvento_({
  eventoId: g.EMISSAO_CFG.EVENTO_ID,
  tipo: "FESTA",
  nome: "Festa Compasso da Vida 2026",
  ano: 2026,
  dataEvento: '2026-10-05',
  horaAbertura: "18:00",
  horaInicio: "19:00",
  localNome: "Espaço Patrick Ribeiro",
  endereco: "Av. Roza Helena Schorling Albuquerque, s/n — Goiabeiras, Vitória/ES",
  capacidade: LOTACAO_DO_REGISTRO,
  status: "INSCRICOES_ABERTAS"
}));

const gravado = g.eventosV2Repo_buscarPorId_(g.EMISSAO_CFG.EVENTO_ID);
ok(!!gravado, "o evento foi gravado e lido de volta");

/* 3.1 — a data. É a que vai no e-mail de confirmação e no relógio do painel. */
const festa = g.compasso_dadosDaFesta_();
const dataUsada = festa && festa.data ? new Date(festa.data) : null;

ok(!!dataUsada, "o sistema resolve alguma data para a festa");
igual(dataUsada ? dataUsada.getMonth() : -1, 9,
      "a DATA obedece ao registro (outubro), não à constante (dezembro)",
      "enquanto vier de EMISSAO_CFG.DATA_EVENTO, mudar a data no cadastro não " +
      "muda o e-mail que o associado recebe nem a contagem de dias do painel");

/* O DIA, não só o mês. A primeira versão desta asserção olhava apenas o mês,
   e uma mutação sobreviveu por causa disso: trocando a leitura civil por
   `new Date('2026-10-05')`, o JavaScript entende meia-noite em UTC e devolve
   4 de outubro às 21h no fuso do sindicato. Continua outubro — e continua a
   data errada no e-mail do associado. */
igual(dataUsada ? dataUsada.getDate() : -1, 5,
      "  e é o dia 5, não o 4",
      "ler a data civil como UTC atrasa o evento em um dia");

/* ESTA MÁQUINA CONSEGUE ENXERGAR O DEFEITO DO FUSO? — declarado, não suposto.
 *
 * A mutação "trocar a leitura civil por `new Date(texto)`" SOBREVIVEU à
 * asserção acima, e não por fraqueza dela: o contêiner de teste roda em UTC,
 * onde `new Date('2026-10-05')` devolve mesmo o dia 5. No fuso do sindicato
 * (UTC-3) devolveria 4 de outubro às 21h — um dia a menos no e-mail do
 * associado e na contagem do painel.
 *
 * Então aqui se mede se a máquina consegue distinguir. Quando não consegue, o
 * veredito é "não testável" com o motivo escrito, e sobra a guarda de fonte
 * abaixo — que é mais fraca, e está dito que é. */
const FUSO_DISTINGUE = new Date('2026-10-05').getDate() !== 5;
if (FUSO_DISTINGUE) {
  ok(true, "  esta máquina distingue leitura civil de UTC",
     "fuso local: " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "?"));
} else {
  b.naoTestavel("o atraso de um dia por leitura UTC da data civil",
    "esta máquina roda em UTC (" +
    (Intl.DateTimeFormat().resolvedOptions().timeZone || "?") +
    "), onde new Date('2026-10-05') dá o dia 5 de qualquer jeito. " +
    "Para exercitar de verdade: TZ=America/Sao_Paulo node tests/e2e/t96-evento-manda.js");
}

/* Guarda de fonte, pelo motivo acima. Ela prova o CAMINHO ESCRITO, não o
   comportamento — a distinção que a REGRA Nº -1 exige que seja dita. */
const fonteEmissao = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EventosEmissao.gs"), "utf8");
const corpoData = (fonteEmissao.match(
  /function compasso_dataEvento_\(\)[\s\S]*?\n\}/) || [""])[0];
ok(/new Date\(Number\(iso\[1\]\)/.test(corpoData),
   "  a data civil é desmontada à mão, não entregue ao construtor",
   "`new Date('2026-10-05')` é meia-noite em UTC — no Brasil, véspera às 21h");

ok(String(festa.local || "").indexOf("Patrick") >= 0,
   "  o LOCAL já obedece ao registro",
   "este campo foi ligado em 25/08 — é a prova de que o caminho funciona");

/* O contador de vagas nasce com o limite do registro — e se a lotação for
   corrigida depois, ele acompanha. Sem isto, um contador criado quando o
   evento tinha 2.000 lugares continuaria emitindo 2.000 ingressos para um
   salão de 300. */
passo("3.1 · o contador de emissão acompanha a lotação corrigida");

g.fs_set_("contadores", g.EMISSAO_CFG.EVENTO_ID,
          { limite: 2000, vagasUsadas: 0, ultimoNumero: 0 });
const contador = g.emissao_lerContador_();
igual(Number(contador.limite), LOTACAO_DO_REGISTRO,
      "um contador antigo, gravado com 2.000, é corrigido para 300 na leitura",
      "o limite gravado é cache do registro, não verdade própria");

/* 3.2 — a lotação. É o que decide quando parar de aceitar inscrição. */
let lotacaoUsada = null;
try {
  const resumoV = g.compasso_validacaoResumo(TOKEN);
  if (resumoV && resumoV.capacidade != null) lotacaoUsada = Number(resumoV.capacidade);
  else if (resumoV && resumoV.limiteVagas != null) lotacaoUsada = Number(resumoV.limiteVagas);
} catch (e) { aviso("resumo de validação não respondeu", e.message); }

if (lotacaoUsada === null) {
  aviso("a lotação não aparece no resumo",
        "medida indireta: o teste passa a olhar a constante");
  lotacaoUsada = Number(g.EMISSAO_CFG.LIMITE_VAGAS);
}

igual(lotacaoUsada, LOTACAO_DO_REGISTRO,
      "a LOTAÇÃO obedece ao registro (300), não à constante (2.000)",
      "enquanto vier da constante, um evento de 300 lugares aceita 2.000 " +
      "inscrições — e ninguém percebe até a porta do salão");

/* 3.3 — o valor do acompanhante. Muda por CCT, e hoje muda por deploy. */
let valorUsado = null;
try {
  const pg = g.compasso_pagamentoOpcoes(TOKEN);
  if (pg && pg.valorSugerido != null) valorUsado = Number(pg.valorSugerido);
} catch (e) {}
if (valorUsado === null) valorUsado = Number(g.EMISSAO_CFG.VALOR_ACOMPANHANTE);

ok(valorUsado != null, "o sistema resolve um valor de acompanhante: " + valorUsado);
aviso("o VALOR DO ACOMPANHANTE não tem campo no cadastro de evento",
      "hoje só existe em EMISSAO_CFG.VALOR_ACOMPANHANTE — mudar exige deploy, " +
      "e a REGRA Nº 0.6 diz que regra escrita (CCT) se calcula e se explica");

/* ══════════════════════════════════════════════════════════════════════════
   4 · ONDE O DADO MORA
   ══════════════════════════════════════════════════════════════════════════ */
passo("4 · dois lugares para o mesmo evento");

aviso("o evento mora em PLANILHA e as inscrições no FIRESTORE",
      "aba EVENTOS_V2 × coleção inscricoesEventos. Não é erro hoje, mas é a " +
      "razão de a lotação não poder ser conferida numa consulta só");


/* ══════════════════════════════════════════════════════════════════════════
   5 · O CAMINHO DA TELA: digitar a lotação e ver o painel obedecer
   ══════════════════════════════════════════════════════════════════════════ */
passo("5 · a lotação digitada na tela chega ao painel");

/* É o caminho real: a tela de Informações chama este endpoint. */
const salvo = g.eventosV2Admin_salvarInformacoesFesta2026(TOKEN, {
  nome: "Festa Compasso da Vida 2026",
  dataEvento: "2026-10-05",
  localNome: "Espaço Patrick Ribeiro",
  capacidade: 450
});
ok(salvo && salvo.ok === true, "a tela salva a lotação",
   salvo && salvo.mensagem ? salvo.mensagem : "");
igual(salvo && salvo.evento ? Number(salvo.evento.capacidade) : -1, 450,
      "  e ela volta no payload da tela",
      "sem isto o campo aparece vazio ao recarregar, e o usuário digita de novo");

/* O cache é por execução; no navegador cada chamada é uma execução nova. */
g.COMPASSO_EVENTO_CACHE_ = undefined;

const exec = g.compasso_executivoResumo
  ? g.compasso_executivoResumo(TOKEN) : null;
if (exec && exec.evento) {
  igual(Number(exec.evento.vagas), 450,
        "o painel do evento passa a dizer 450",
        "era aqui que a tela mostrava 2.000 fizesse o que fizesse");
} else {
  aviso("resumo executivo não respondeu neste ambiente",
        "a lotação foi conferida pelo resolvedor, não pela tela");
}

igual(g.compasso_limiteVagas_(), 450,
      "  e o resolvedor concorda");

/* Salvar SEM tocar na lotação não pode zerá-la. */
g.eventosV2Admin_salvarInformacoesFesta2026(TOKEN, {
  nome: "Festa Compasso da Vida 2026",
  dataEvento: "2026-10-05",
  localNome: "Espaço Patrick Ribeiro",
  capacidade: ""
});
g.COMPASSO_EVENTO_CACHE_ = undefined;
igual(g.compasso_limiteVagas_(), 450,
      "salvar a tela com o campo em branco NÃO apaga a lotação",
      "zerar por omissão devolveria o evento aos 2.000 sem ninguém pedir");

resumo();
