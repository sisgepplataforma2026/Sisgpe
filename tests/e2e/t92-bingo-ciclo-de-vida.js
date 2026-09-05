/**
 * BINGO ONLINE — O CICLO ADMINISTRATIVO INTEIRO, EXECUTADO
 *
 * O QUE ORIGINOU
 *
 * 25/08/2026, o cenário E2E-09 do comando de auditoria do módulo de Eventos:
 *
 *   evento → configuração → participantes → cartelas → link individual →
 *   sorteio → números → marcação → manifestação → validação → vencedor →
 *   relatório → auditoria
 *
 * O Bingo é o submódulo do qual o usuário diz, com todas as letras, que
 * "existe e nunca rodou". Havia um teste (`t73`) provando que as funções se
 * ligam entre si e outro (`t86`) provando a máscara de contato na inscrição.
 * Nenhum dos dois joga uma partida.
 *
 * Este joga: cria rodada, gera cartela para participante real, inicia,
 * sorteia número a número até dar bingo, e vai até o relatório da rodada.
 *
 * O QUE A PARTIDA REVELA — e é o motivo de o teste valer mais que a leitura
 *
 * A ordem das bolas NÃO é lacrada antes da rodada. O documento de arquitetura
 * (`docs/bingo/FASE-1-ARQUITETURA.md`, §8.1) desenhou "lacrar antes, revelar
 * depois": sortear a sequência inteira no início, publicar o hash, e revelar
 * a semente no encerramento — é o que prova para o associado que nada foi
 * escolhido no meio do jogo. O que existe é outra coisa: `bingo_registrarNumero`
 * grava um número por vez, digitado por quem opera.
 *
 * Isso não é um bug — é uma decisão diferente da desenhada, e ela cabe se o
 * sorteio for físico (globo, bolas, alguém digitando). O que NÃO cabe é a
 * diferença ficar sem registro: quem ler o documento vai procurar um lacre
 * que não existe. Está anotado aqui, e no relatório da auditoria.
 *
 * O FIRESTORE É O MESMO DE MENTIRA DO t91 — e aqui ele precisa de um pouco
 * mais: o Bingo tem uma consulta própria (`bingo_queryEquals_`) que fala
 * direto por HTTP e devolve `{id, data}`, e não pelas funções `fs_*`.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, aviso, naoTestavel, resumo } = b;

const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   // financeiro,rh — não tem eventos

/* ─── Firestore em memória ───────────────────────────────────────────────── */
const BANCO = new Map();
const clonar = o => JSON.parse(JSON.stringify(o));

g.fs_set_ = (col, id, obj) => { BANCO.set(col + "/" + id, clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => { const v = BANCO.get(col + "/" + id); return v ? clonar(v) : null; };
g.fs_list_ = col => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) o.push(clonar(v)); }); return o; };
g.fs_queryEquals_ = (col, campo, valor) =>
  g.fs_list_(col).filter(d => String(d[campo]) === String(valor));
g.fs_findByField_ = (col, campo, valor, lim) => g.fs_queryEquals_(col, campo, valor).slice(0, lim || 100);

/* A consulta do Bingo devolve o par {id, data} — o id do documento importa,
   porque `bingo_confirmarManifestacao` grava de volta por ele. */
g.bingo_queryEquals_ = (col, campo, valor, limite) => {
  const out = [];
  BANCO.forEach((v, k) => {
    if (k.indexOf(col + "/") !== 0) return;
    if (String(v[campo]) !== String(valor)) return;
    out.push({ id: k.slice(col.length + 1), data: clonar(v) });
  });
  return out.slice(0, limite || 500);
};

/* As cartelas são gravadas em LOTE por uma chamada HTTP própria
   (`bingo_firestoreBatchSet_`), que não passa pelas funções `fs_*`. Sem este
   desvio, gerar cartela não grava nada no banco de mentira e o teste mediria
   um vazio. */
g.bingo_firestoreBatchSet_ = (colecao, registros) => {
  (registros || []).forEach(r => g.fs_set_(colecao, r.docId, r.data));
  return { ok: true, total: (registros || []).length };
};

const props = g.PropertiesService.getScriptProperties();
/* MINÚSCULO, e isto não é detalhe — ver o bloco 1. */
props.setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

const EVENTO = "bingo-teste-auditoria";

fluxo("BINGO ONLINE · Uma partida inteira, do cadastro ao relatório");

/* ══════════════════════════════════════════════════════════════════════════
   1 · A COLEÇÃO SEPARA HOMOLOGAÇÃO DE PRODUÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · onde o Bingo guarda as coisas");

const col = g.bingo_colecao_("rodadas");
ok(/^bingo_hml_/.test(col), "as coleções do Bingo carregam o ambiente no nome: " + col,
   "é o que impede uma rodada de teste aparecer no telão da festa — " +
   "e é justamente o que o Compasso NÃO faz (ver o relatório)");

/* ─── E AQUI SAI UM ACHADO QUE SÓ A EXECUÇÃO ENTREGA ───────────────────────
   A MESMA propriedade `SISGEP_AMBIENTE` é lida com duas convenções de caixa
   diferentes, em dois lugares do sistema:

     getAmbienteAtual()            compara com 'homologacao' (minúsculo)
     compasso_repeticaoLiberada_() converte para MAIÚSCULO e compara

   Com a propriedade em 'HOMOLOGACAO', o Compasso se reconhece em homologação
   e o Bingo NÃO: ele cai no padrão e passa a gravar em bingo_prd_*.
   Nada quebra, nada avisa. É o pior tipo de defeito de ambiente. */
props.setProperty("SISGEP_AMBIENTE", "HOMOLOGACAO");
g.getAmbienteAtual._cache = undefined;
const colMaiuscula = g.bingo_colecao_("rodadas");
ok(/^bingo_prd_/.test(colMaiuscula),
   "com SISGEP_AMBIENTE='HOMOLOGACAO' (maiúsculo) o Bingo grava em PRODUÇÃO: " +
   colMaiuscula,
   "getAmbienteAtual compara com 'homologacao' minúsculo e cai no padrão " +
   "'producao'; o Compasso lê a mesma propriedade em maiúsculo e se acha em " +
   "homologação. A mesma chave, duas leituras, dois ambientes ao mesmo tempo.");

props.setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
igual(g.bingo_colecao_("rodadas"), col, "  em minúsculo os dois concordam");

/* ══════════════════════════════════════════════════════════════════════════
   2 · CRIAR E CONFIGURAR A RODADA
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · criar a rodada");

const semEvento = g.bingo_criarRodada({}, ADM);
ok(semEvento.ok === false, "rodada sem evento é recusada", semEvento.mensagem);

const modInvalida = g.bingo_criarRodada({ eventoId: EVENTO, modalidade: "QUADRADO" }, ADM);
ok(modInvalida.ok === false, "modalidade inventada é recusada", modInvalida.mensagem);

const cr = g.bingo_criarRodada({
  eventoId: EVENTO, nome: "Rodada 1 — Cartela Cheia",
  modalidade: "CARTELA_CHEIA", premioDescricao: "Smart TV 50\"",
  prazoManifestacaoSegundos: 180 }, ADM);
ok(cr.ok === true, "criar a rodada funciona", cr.ok ? cr.rodada.rodadaId : cr.mensagem);
const ROD = cr.rodada.rodadaId;
igual(cr.rodada.status, "RASCUNHO", "  e ela nasce em RASCUNHO");
ok(g.fs_list_(col).length === 1, "  gravada no banco");

/* ══════════════════════════════════════════════════════════════════════════
   3 · PARTICIPANTES E CARTELAS
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · sem participante não há cartela");

const semGente = g.bingo_gerarCartelasDoEvento(ROD, ADM);
ok(semGente.ok === false, "gerar cartela sem participante é recusado com instrução",
   semGente.mensagem);

const PARTICIPANTES = [
  { participanteId: "PAR-1", nome: "Maria Aparecida da Silva", associadoId: "ASS-1" },
  { participanteId: "PAR-2", nome: "João Pereira Santos",      associadoId: "ASS-2" },
  { participanteId: "PAR-3", nome: "Ana Lúcia Ferreira",       associadoId: "ASS-3" }
];

/* ─── O ACHADO MAIS GRAVE DESTA AUDITORIA, E ELE SÓ APARECE EXECUTANDO ─────
   Duas linhas do mesmo módulo, sobre a mesma coleção:

     BingoInscricao.gs:300    fs_set_(bingo_colecao_('evento_participantes'), …)
     BingoParticipantes.gs:36 bingo_queryEquals_('evento_participantes', …)

   A primeira GRAVA em `bingo_hml_evento_participantes`. A segunda LÊ de
   `evento_participantes` — sem o prefixo. São coleções diferentes.

   E o pior não é a leitura vazia: é o que o código faz quando ela vem vazia.
   Ele cai para a coleção `ingressos` — que é a dos ingressos da FESTA
   COMPASSO. Ou seja: quem se inscreve no Bingo não recebe cartela, e quem tem
   ingresso da festa recebe uma sem nunca ter pedido. */
PARTICIPANTES.forEach(p => g.fs_set_(g.bingo_colecao_('evento_participantes'), p.participanteId,
  Object.assign({ eventoId: EVENTO, status: 'ATIVO', criadoEm: new Date().toISOString() }, p)));

const vistosPeloBingo = g.bingo_listarParticipantesEvento(EVENTO, ADM);
igual(vistosPeloBingo.length, 0,
      "os 3 inscritos no Bingo NÃO são vistos pelo gerador de cartelas",
      "gravados em " + g.bingo_colecao_('evento_participantes') + ", lidos de " +
      "'evento_participantes' — o prefixo de ambiente falta na leitura");

/* A prova do desvio: um ingresso da FESTA aparece como participante do BINGO. */
g.fs_set_('ingressos', 'ING-DA-FESTA', {
  eventoId: EVENTO, participanteId: 'ING-DA-FESTA', nome: 'Pessoa da Festa Compasso',
  status: 'EMITIDO', categoria: 'associado' });
const desviados = g.bingo_listarParticipantesEvento(EVENTO, ADM);
ok(desviados.length === 1 && desviados[0].origem === 'INGRESSOS',
   "e um INGRESSO DA FESTA entra no lugar como participante do Bingo",
   "origem devolvida: " + (desviados[0] || {}).origem +
   " — é a queda para a coleção errada acontecendo de verdade");

/* Daqui para a frente o teste usa o caminho que o código realmente lê, para
   poder jogar a partida. O defeito acima fica registrado, não corrigido —
   o comando da auditoria diz, no item 25, para não corrigir ainda. */
PARTICIPANTES.forEach(p => g.fs_set_('evento_participantes', p.participanteId,
  Object.assign({ eventoId: EVENTO, status: 'ATIVO' }, p)));

const gc = g.bingo_gerarCartelasDoEvento(ROD, ADM);
ok(gc.ok === true, "gerar cartelas para os 3 participantes funciona",
   gc.ok ? JSON.stringify({ novas: (gc.cartelas || gc.novos || []).length || gc.geradas }) : gc.mensagem);

const cartelas = g.fs_list_(g.bingo_colecao_("cartelas"));
igual(cartelas.length, 3, "  3 cartelas no banco, uma por participante");

/* A cartela é uma matriz de 5 colunas × 5, com o 0 na casa livre do centro. */
const numerosPorCartela = cartelas.map(c =>
  [].concat.apply([], g.bingo_parseJson_(c.numerosJson, [])).map(Number));
numerosPorCartela.forEach((n, i) => {
  const cheios = n.filter(x => x !== 0);
  ok(cheios.length === 24 && new Set(cheios).size === 24,
     "  cartela " + (i + 1) + ": 24 números + casa livre, nenhum repetido");
});
/* Cada coluna respeita a faixa do B-I-N-G-O: sem isso a cartela é bonita e
   errada, e ninguém percebe até alguém não conseguir bater nunca. */
const faixas = [[1,15],[16,30],[31,45],[46,60],[61,75]];
ok(cartelas.every(c => {
  const m = g.bingo_parseJson_(c.numerosJson, []);
  return m.every((coluna, ci) => coluna.every(v =>
    Number(v) === 0 || (Number(v) >= faixas[ci][0] && Number(v) <= faixas[ci][1])));
}), "  e cada coluna fica na faixa certa do B-I-N-G-O");
const hashes = cartelas.map(c => c.combinacaoHash);
igual(new Set(hashes).size, 3, "  e as 3 combinações são diferentes entre si",
      "duas cartelas iguais dariam dois bingos no mesmo número");

ok(cartelas.length > 0 && cartelas.every(c => !!c.tokenHash && !c.token),
   "  o banco guarda o HASH do link, nunca o link",
   "quem lê a coleção não consegue abrir a cartela de outra pessoa");

/* Cada participante tem um LINK individual — item do fluxo desenhado. */
const link = g.bingo_gerarLinkCartela(cartelas[0].cartelaId, ADM);
ok(link && link.ok === true, "o link individual da cartela é gerado",
   link && (link.url || "").slice(0, 45) + "…");

/* ══════════════════════════════════════════════════════════════════════════
   4 · INICIAR — e o que trava a partir daqui
   ══════════════════════════════════════════════════════════════════════════ */
passo("4 · iniciar a rodada congela as cartelas");

const ini = g.bingo_iniciarRodada(ROD, ADM);
ok(ini.ok === true, "iniciar funciona");
igual(g.bingo_obterRodada_(ROD).status, "EM_ANDAMENTO", "  status EM_ANDAMENTO");

const gcDepois = g.bingo_gerarCartelasDoEvento(ROD, ADM);
ok(gcDepois.ok === false,
   "depois de iniciada, NÃO se gera mais cartela", gcDepois.mensagem);
igual(g.fs_list_(g.bingo_colecao_("cartelas")).length, 3,
      "  e continuam 3 cartelas, não 4");

ok(g.bingo_obterRodada_(ROD).cartelasBloqueadas === true,
   "  e a rodada fica marcada com as cartelas bloqueadas",
   "o congelamento é da rodada, não de cada cartela — uma marca só, " +
   "que é o que torna impossível emitir depois da primeira bola");

/* O LACRE QUE O DOCUMENTO DESENHOU E O CÓDIGO NÃO TEM. */
const rodadaIniciada = g.bingo_obterRodada_(ROD);
const temLacre = !!(rodadaIniciada.seedHash || rodadaIniciada.ordemLacrada ||
                    rodadaIniciada.sequenciaHash || rodadaIniciada.seed);
ok(!temLacre,
   "a ordem das bolas NÃO é lacrada no início — divergência do desenho",
   "docs/bingo/FASE-1-ARQUITETURA.md §8.1 pede lacrar a sequência e publicar " +
   "o hash; o código sorteia número a número. Cabe se o globo for físico, " +
   "mas o documento promete uma prova que o sistema não dá.");

/* ══════════════════════════════════════════════════════════════════════════
   5 · SORTEAR
   ══════════════════════════════════════════════════════════════════════════ */
passo("5 · o sorteio, número a número");

const foraDaFaixa = g.bingo_registrarNumero({ rodadaId: ROD, numero: 76 }, ADM);
ok(foraDaFaixa.ok === false, "número fora de 1–75 é recusado", foraDaFaixa.mensagem);

const n1 = g.bingo_registrarNumero({ rodadaId: ROD, numero: 7 }, ADM);
ok(n1.ok === true, "registrar um número funciona: " +
   (n1.ok ? n1.sorteio.letra + "-" + n1.sorteio.numero : n1.mensagem));
igual(Number(g.bingo_obterRodada_(ROD).sequenciaAtual), 1, "  a sequência anda 1");

const repetido = g.bingo_registrarNumero({ rodadaId: ROD, numero: 7 }, ADM);
ok(repetido.ok === false && repetido.duplicado === true,
   "o MESMO número duas vezes é recusado", repetido.mensagem);
igual(Number(g.bingo_obterRodada_(ROD).sequenciaAtual), 1,
      "  e a sequência não anda de novo",
      "clique duplo do operador não pode virar duas bolas");

const pausa = g.bingo_pausarRodada(ROD, "Problema no som do salão", ADM);
ok(pausa && pausa.ok === true, "pausar a rodada funciona");
const durantePausa = g.bingo_registrarNumero({ rodadaId: ROD, numero: 13 }, ADM);
ok(durantePausa.ok === false, "  e com ela pausada não se sorteia", durantePausa.mensagem);
ok(g.bingo_retomarRodada(ROD, ADM).ok === true, "retomar funciona");

/* ══════════════════════════════════════════════════════════════════════════
   6 · ATÉ ALGUÉM BATER — a partida de verdade
   ══════════════════════════════════════════════════════════════════════════ */
passo("6 · sortear até o primeiro bingo");

/* Cartela cheia: sortear todos os números da cartela 1. O último tem de
   disparar a detecção. */
const alvo = numerosPorCartela[0].filter(n => Number(n) !== 0).map(Number);
let deteccaoDisparada = null, sorteados = 1;   /* o 7 já saiu */
for (const num of alvo) {
  if (num === 7) continue;
  const r = g.bingo_registrarNumero({ rodadaId: ROD, numero: num }, ADM);
  if (r.ok) sorteados++;
  if (r.ok && r.bingosDetectados && r.bingosDetectados.length) {
    deteccaoDisparada = r.bingosDetectados[0];
    break;
  }
}
ok(!!deteccaoDisparada, "o sistema detecta o bingo sozinho, no número que fecha",
   deteccaoDisparada ? "após " + sorteados + " bolas" : "NÃO detectou — defeito");

igual(g.bingo_obterRodada_(ROD).status, "AGUARDANDO_MANIFESTACAO",
      "  e a rodada pausa sozinha esperando a manifestação",
      "continuar sorteando com um bingo em aberto criaria vencedor de mentira");

const oficial = g.bingo_validarCartelaOficial(
  deteccaoDisparada.cartelaId, ROD, ADM);
ok(oficial.ok === true && oficial.valido === true,
   "a validação oficial confirma a cartela contra os números sorteados",
   "modalidade " + oficial.modalidade + ", " + oficial.totalSorteados + " bolas");

/* A conferência é do SERVIDOR, contra a cartela selada — não do navegador. */
const outraCartela = cartelas.filter(c => c.cartelaId !== deteccaoDisparada.cartelaId)[0];
const falso = g.bingo_validarCartelaOficial(outraCartela.cartelaId, ROD, ADM);
ok(falso.ok === true && falso.valido === false,
   "e uma cartela que NÃO fechou é recusada pela mesma validação",
   "quem grita bingo sem ter não passa");

/* ══════════════════════════════════════════════════════════════════════════
   7 · CONFIRMAR O VENCEDOR E ENCERRAR
   ══════════════════════════════════════════════════════════════════════════ */
passo("7 · vencedor, encerramento e relatório");

const conf = g.bingo_confirmarManifestacao(deteccaoDisparada.deteccaoId, ADM);
ok(conf.ok === true, "confirmar a manifestação funciona", conf.mensagem);

const vencedores = g.fs_list_(g.bingo_colecao_("vencedores"));
igual(vencedores.length, 1, "  1 vencedor gravado");
igual(vencedores[0].cartelaId, deteccaoDisparada.cartelaId,
      "  e é a cartela que bateu");

const conf2 = g.bingo_confirmarManifestacao(deteccaoDisparada.deteccaoId, ADM);
ok(conf2.ok === true && conf2.existente === true,
   "confirmar de novo é idempotente — não cria um segundo vencedor");
igual(g.fs_list_(g.bingo_colecao_("vencedores")).length, 1, "  continua 1 vencedor");

const enc = g.bingo_encerrarRodada(ROD, ADM);
ok(enc && enc.ok === true, "encerrar a rodada funciona", enc && enc.mensagem);
igual(g.bingo_obterRodada_(ROD).status, "ENCERRADA", "  status ENCERRADA");

const depoisDoFim = g.bingo_registrarNumero({ rodadaId: ROD, numero: 42 }, ADM);
ok(depoisDoFim.ok === false, "e rodada encerrada não aceita mais número",
   depoisDoFim.mensagem);

const rel = g.bingo_relatorioRodada(ROD, ADM);
ok(!!rel, "o relatório da rodada responde");
const sorteiosBanco = g.fs_list_(g.bingo_colecao_("sorteios")).length;
const relNumeros = (rel.sorteios || rel.numeros || []).length ||
                   Number(rel.totalSorteios || rel.totalNumeros || 0);
igual(relNumeros, sorteiosBanco,
      "  e o número de bolas do relatório = o do banco (" + sorteiosBanco + ")",
      "relatório aprovado não é o que abre, é o que bate");

/* ══════════════════════════════════════════════════════════════════════════
   8 · AUDITORIA E PERMISSÃO
   ══════════════════════════════════════════════════════════════════════════ */
passo("8 · a trilha e a porta");

/* O Bingo NÃO tem trilha própria: ele chama `auditar_`, a trilha do sistema
   inteiro (AuditoriaCore.gs). Com o Firestore fora do ar, ela cai para a aba
   SISGEP_Auditoria da planilha — e é de lá que este teste lê.

   Vale registrar a diferença, porque é do tipo que só aparece na hora de
   auditar: o COMPASSO grava a própria trilha numa coleção separada
   (`auditoriaEventos`), que a tela de Auditoria do SISGEP não enxerga. Dois
   submódulos do mesmo módulo, duas trilhas, dois lugares para procurar. */
/* ─── E O TESTE TROPEÇOU NUM SEGUNDO ACHADO, PROCURANDO A TRILHA ───────────
   Procurei a aba de auditoria pela planilha de `getPlanilhaId()` e não achei
   nada. A trilha estava em OUTRA planilha:

     getPlanilhaId()    resolve o ID conforme o ambiente, a cada chamada
     planilhaSisgep_()  prefere a CONSTANTE global PLANILHA_ID

   E `PLANILHA_ID` é `var PLANILHA_ID = getPlanilhaId()` (SistemaConfig.gs:582),
   avaliada UMA VEZ, no carregamento do projeto. Quem trocar o ambiente pela
   tela de Configurações no meio de uma execução continua escrevendo na
   planilha do ambiente anterior — auditoria e Agenda de Eventos incluídas.

   HONESTIDADE SOBRE O ALCANCE: neste teste a divergência aparece porque a
   propriedade é definida DEPOIS do carregamento. No projeto real ela já está
   lá antes, então cada execução resolve certo. O que fica provado aqui é o
   MECANISMO — a constante congela —, não que a produção esteja errada hoje.
   Confirmar isso exige olhar o projeto no ar. */
const idPorAmbiente = g.getPlanilhaId();
const idDaConstante = g.planilhaSisgep_().getId();
ok(idPorAmbiente !== idDaConstante,
   "planilhaSisgep_() e getPlanilhaId() podem apontar para planilhas DIFERENTES",
   "por ambiente: …" + idPorAmbiente.slice(-6) +
   " · pela constante: …" + idDaConstante.slice(-6) +
   " — a constante é avaliada no carregamento e não acompanha a troca");

const abaAud = g.planilhaSisgep_().getSheetByName(g.AUD_ABA_RESERVA);
ok(!!abaAud, "o Bingo grava na trilha DO SISTEMA, não numa própria",
   "aba " + g.AUD_ABA_RESERVA + " — a mesma que a tela de Auditoria lê");

const linhasAud = abaAud && abaAud.getLastRow() > 1
  ? abaAud.getRange(2, 1, abaAud.getLastRow() - 1, abaAud.getLastColumn()).getValues()
  : [];
const acoes = linhasAud.map(l => String(l[4] || ""));
["RODADA_CRIADA", "RODADA_INICIADA", "NUMERO_REGISTRADO", "BINGO_DETECTADO",
 "CARTELAS_BLOQUEADAS"]
  .forEach(a => ok(acoes.indexOf(a) >= 0, "a trilha registrou " + a,
                   "de " + linhasAud.length + " linhas"));
/* A aba é do sistema inteiro — tem linha de login e de outros módulos. O que
   se confere é que TODA linha do Bingo se identifica. */
const doBingo = linhasAud.filter(l => String(l[3]) === "Bingo Online");
ok(doBingo.length > 0 && doBingo.every(l => String(l[2]) === "Eventos"),
   "  e toda linha do Bingo se identifica como Eventos › Bingo Online",
   doBingo.length + " de " + linhasAud.length + " linhas da aba");

[["bingo_criarRodada", [{ eventoId: EVENTO }]],
 ["bingo_iniciarRodada", [ROD]],
 ["bingo_registrarNumero", [{ rodadaId: ROD, numero: 5 }]],
 ["bingo_encerrarRodada", [ROD]],
 ["bingo_listarCartelas", [EVENTO, ROD]],
 ["bingo_validarCartelaOficial", ["X", ROD]]].forEach(([nome, args]) => {
  let recusou = false, msg = "";
  try { g[nome](...args, FIN); }
  catch (e) { recusou = /permit|permiss|acesso|autoriz|sess|administrador/i.test(e.message); msg = e.message; }
  ok(recusou, nome + " recusa quem não tem o módulo eventos", msg.slice(0, 55));
});

naoTestavel("o associado vê a bola cair na tela dele sem recarregar",
            "onSnapshot do Firestore roda no navegador; aqui não há navegador " +
            "nem Firestore — é a parte do Bingo que só a partida real prova");
naoTestavel("o telão e a cartela do associado sob 300 pessoas ao mesmo tempo",
            "carga simultânea não é reproduzível no emulador de uma thread só");

resumo();
