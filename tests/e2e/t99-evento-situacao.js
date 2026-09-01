/**
 * EVENTOS · O CICLO DE VIDA PASSA A TER REGRA
 *
 * O QUE ORIGINOU — 26/08/2026
 *
 * O usuário, olhando Dados da Festa: "Ele não deixa eu publicar, é assim
 * mesmo?". Era assim mesmo: o botão estava na tela desde 21/08 desligado, com
 * o aviso de que a transição de status não fora validada.
 *
 * E não fora mesmo. Os sete status existiam em `EVENTOS_V2_STATUS` desde o
 * começo, e NENHUMA linha dizia qual pode virar qual. Enum sem máquina de
 * estados é enum decorativo: `status` vira um texto que qualquer gravação
 * sobrescreve. O caso que dói é um evento ENCERRADO voltar para
 * INSCRICOES_ABERTAS depois da festa.
 *
 * O QUE FICOU DE FORA, POR DECISÃO DO USUÁRIO
 *
 * A trava do link público. Perguntado se ela entrava junto, respondeu: "Como
 * estou em período de teste, deve estar aberto para testes". Então este teste
 * NÃO cobra que a inscrição pública recuse por status — cobra o contrário,
 * que ela continue funcionando, porque é o comportamento que ele pediu e o
 * que quebraria em silêncio se alguém ligasse a trava sem avisar.
 *
 * O QUE ESTE TESTE PROVA: cada aresta da máquina de estados, as que não
 * existem, a exigência de conteúdo para publicar, o motivo obrigatório no
 * cancelamento, a auditoria, a permissão, e que mudar situação não apaga
 * edição de outra pessoa.
 *
 * O QUE NÃO PROVA: como o cartão de situação aparece na tela. jsdom não
 * aplica CSS.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, resumo } = b;

const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   /* financeiro,rh — não tem Eventos */

g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sinderacao.com";
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

fluxo("EVENTOS · A situação do evento e a máquina de estados");

/* ── A Festa 2026 no repositório, completa o bastante para publicar ─────── */
function gravarFesta(extra) {
  return g.eventosV2Repo_salvar_(g.eventosV2_normalizarEvento_(Object.assign({
    eventoId: "EVT-FESTA-2026",
    tipo: g.EVENTOS_V2_TIPOS.FESTA, ano: 2026,
    nome: "Festa Compasso da Vida", edicao: "2026",
    dataEvento: "2026-12-19", localNome: "Espaço Patrick Ribeiro",
    capacidade: 2000, status: g.EVENTOS_V2_STATUS.RASCUNHO
  }, extra || {}))).evento;
}
gravarFesta();

/* ══════════════════════════════════════════════════════════════════════════
   1 · A MÁQUINA DE ESTADOS EXISTE E TEM AS ARESTAS CERTAS
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · as transições estão declaradas, não implícitas");
ok(typeof g.EVENTOS_V2_TRANSICOES === "object" && g.EVENTOS_V2_TRANSICOES,
   "há um mapa de transições no domínio",
   "sem ele, status é texto que qualquer gravação sobrescreve");
igual(Object.keys(g.EVENTOS_V2_TRANSICOES).sort(),
      Object.keys(g.EVENTOS_V2_STATUS).sort(),
      "todo status tem regra — nenhum ficou sem saída declarada");

const PERMITIDAS = [
  ["RASCUNHO", "PROGRAMADO"],
  ["PROGRAMADO", "INSCRICOES_ABERTAS"],
  ["INSCRICOES_ABERTAS", "INSCRICOES_ENCERRADAS"],
  ["INSCRICOES_ENCERRADAS", "EM_ANDAMENTO"],
  ["EM_ANDAMENTO", "ENCERRADO"],
  ["INSCRICOES_ABERTAS", "PROGRAMADO"],   /* a volta que evita cancelar o evento */
  ["RASCUNHO", "CANCELADO"]
];
PERMITIDAS.forEach(([de, para]) =>
  ok(g.eventosV2_transicaoPermitida_(de, para).ok, "  " + de + " → " + para));

passo("1b · e as arestas que NÃO existem");
const PROIBIDAS = [
  ["RASCUNHO", "INSCRICOES_ABERTAS", "publicar e abrir inscrição são dois atos"],
  ["ENCERRADO", "INSCRICOES_ABERTAS", "reabrir inscrição depois da festa"],
  ["ENCERRADO", "CANCELADO", "cancelar o que já aconteceu não descreve nada"],
  ["RASCUNHO", "ENCERRADO", "encerrar sem nunca ter ocorrido"]
];
PROIBIDAS.forEach(([de, para, porque]) => {
  const r = g.eventosV2_transicaoPermitida_(de, para);
  ok(r.ok === false, "  " + de + " → " + para + " é recusado", porque);
  ok(String(r.mensagem || "").length > 10, "    com frase que explica",
     "mensagem de erro é o que a pessoa lê; código não serve");
});
ok(g.eventosV2_transicaoPermitida_("RASCUNHO", "RASCUNHO").ok === false,
   "ir para a situação em que já está é recusado");
ok(g.eventosV2_transicaoPermitida_("RASCUNHO", "INVENTADO").ok === false,
   "situação inexistente é recusada");

/* ══════════════════════════════════════════════════════════════════════════
   2 · PUBLICAR — a exigência de conteúdo
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · publicar sem os dados essenciais é recusado, dizendo o que falta");
gravarFesta({ capacidade: 0, localNome: "" });
const semDados = g.eventosV2Admin_mudarSituacaoFesta2026(ADM, "PROGRAMADO");
ok(semDados.ok === false, "recusa publicar com lotação e local vazios");
ok(Array.isArray(semDados.pendencias) && semDados.pendencias.length === 2,
   "  e devolve a LISTA do que falta, não um não seco",
   "botão que só recusa deixa a pessoa caçando o erro numa tela de vinte campos");
ok(/local/.test(String(semDados.erro)) && /capacidade|lota/i.test(String(semDados.erro)),
   "  nomeando os dois campos");

passo("2b · com os dados no lugar, publica");
gravarFesta();
const sit0 = g.eventosV2Admin_situacaoFesta2026(ADM);
igual(sit0.status, "RASCUNHO", "a Festa começa em rascunho");
igual(sit0.rotulo, "Rascunho", "  com rótulo em português para a tela");
igual(sit0.pendenciasParaPublicar.length, 0, "  e sem pendências");
ok(sit0.proximos.some(p => p.status === "PROGRAMADO"),
   "  oferecendo publicar como próximo passo");
ok(!sit0.proximos.some(p => p.status === "ENCERRADO"),
   "  e NÃO oferecendo o que seria recusado",
   "botão que existe para ser recusado é clique desperdiçado");

const pub = g.eventosV2Admin_mudarSituacaoFesta2026(ADM, "PROGRAMADO");
ok(pub.ok === true, "publicar funciona");
igual(pub.de, "RASCUNHO", "  registrando de onde veio");
igual(g.eventosV2Repo_buscarPorId_("EVT-FESTA-2026").status, "PROGRAMADO",
      "  e o repositório guardou a nova situação");

/* ══════════════════════════════════════════════════════════════════════════
   3 · O RESTO DO CICLO, EXECUTADO DE PONTA A PONTA
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · o ciclo inteiro roda numa sequência só");
["INSCRICOES_ABERTAS", "INSCRICOES_ENCERRADAS", "EM_ANDAMENTO", "ENCERRADO"]
  .forEach(destino => {
    const r = g.eventosV2Admin_mudarSituacaoFesta2026(ADM, destino);
    ok(r.ok === true, "  chega em " + destino, r.ok ? "" : r.erro);
  });

passo("3b · encerrado é terminal de verdade");
const depois = g.eventosV2Admin_situacaoFesta2026(ADM);
igual(depois.proximos.length, 0, "não sobra nenhum destino a partir de encerrado");
const tentaReabrir = g.eventosV2Admin_mudarSituacaoFesta2026(ADM, "INSCRICOES_ABERTAS");
ok(tentaReabrir.ok === false, "  e reabrir inscrição é recusado pelo Service",
   "não basta a tela não oferecer — quem chama a função direto também é barrado");

/* ══════════════════════════════════════════════════════════════════════════
   4 · CANCELAR EXIGE MOTIVO
   ══════════════════════════════════════════════════════════════════════════ */
passo("4 · cancelamento sem motivo escrito é recusado");
gravarFesta({ status: "PROGRAMADO" });
const semMotivo = g.eventosV2Admin_mudarSituacaoFesta2026(ADM, "CANCELADO", "   ");
ok(semMotivo.ok === false, "cancelar sem motivo é recusado",
   "cancelamento é exatamente o que alguém pergunta meses depois");
igual(g.eventosV2Repo_buscarPorId_("EVT-FESTA-2026").status, "PROGRAMADO",
      "  e nada foi gravado na recusa");

const comMotivo = g.eventosV2Admin_mudarSituacaoFesta2026(
  ADM, "CANCELADO", "Obra no salão adiada pela prefeitura.");
ok(comMotivo.ok === true, "com motivo, cancela");
igual(g.eventosV2Repo_buscarPorId_("EVT-FESTA-2026").motivoSituacao,
      "Obra no salão adiada pela prefeitura.", "  e o motivo fica gravado");
ok(g.eventosV2Admin_situacaoFesta2026(ADM).proximos.some(p => p.status === "RASCUNHO"),
   "cancelado pode voltar a rascunho",
   "adiar não é apagar — o evento remarcado reaproveita o cadastro");

/* ══════════════════════════════════════════════════════════════════════════
   5 · O QUE PROTEGE O DADO
   ══════════════════════════════════════════════════════════════════════════ */
passo("5 · mudar situação não reescreve o evento inteiro");
gravarFesta({ status: "RASCUNHO", orientacoes: "Levar documento com foto." });
g.eventosV2Admin_mudarSituacaoFesta2026(ADM, "PROGRAMADO");
igual(g.eventosV2Repo_buscarPorId_("EVT-FESTA-2026").orientacoes,
      "Levar documento com foto.",
      "o texto que estava gravado sobreviveu à mudança de situação",
      "se publicar passasse pelo salvar, publicaria com a tela desatualizada e apagaria a edição de outra pessoa");

passo("5b · quem não é do módulo não muda situação");
let barrou = false;
try {
  const r = g.eventosV2Admin_mudarSituacaoFesta2026(FIN, "INSCRICOES_ABERTAS");
  if (r && r.ok === false) barrou = true;   /* recusa devolvida também vale */
} catch (e) { barrou = true; }
ok(barrou, "usuário sem o módulo Eventos é recusado");
igual(g.eventosV2Repo_buscarPorId_("EVT-FESTA-2026").status, "PROGRAMADO",
      "  e a situação não mudou");

passo("5c · cada mudança deixa trilha");
/* A ABA É LIDA DIRETO, e isso é correção de uma fraqueza deste próprio teste.
   A primeira versão fazia `g.eventosV2Repo_listarAuditoria_ ? ... : []` — e
   como esse leitor NÃO existe no Repository, a guarda caía no `[]` e nunca
   podia falhar. Guarda que não consegue reprovar é pior do que guarda
   nenhuma: dá a sensação de cobertura sem cobrir nada. O Repository escreve
   na aba EVENTOS_V2_AUDITORIA; é lá que a prova está. */
const abaAud = g.SpreadsheetApp.openById(g.getPlanilhaId('homologacao'))
  .getSheetByName(g.EVENTOS_V2_ABA_AUDITORIA);
const linhasAud = abaAud ? abaAud.getDataRange().getValues() : [];
const colAcao = linhasAud.length ? linhasAud[0].indexOf('acao') : -1;
const trilha = linhasAud.slice(1).filter(l => String(l[colAcao]) === 'MUDAR_STATUS');
ok(trilha.length >= 1, "há registro de MUDAR_STATUS na auditoria",
   trilha.length ? trilha.length + " registros" : "sem trilha ninguém explica quem publicou e quando");
ok(trilha.some(l => String(l[linhasAud[0].indexOf('executadoPor')])
                      .indexOf('wanderson') >= 0),
   "  com o nome de quem mudou");

/* ══════════════════════════════════════════════════════════════════════════
   6 · O QUE O USUÁRIO PEDIU PARA NÃO MUDAR
   ══════════════════════════════════════════════════════════════════════════ */
passo("6 · o link público continua aberto durante os testes");
/* "Como estou em período de teste, deve estar aberto para testes." Esta guarda
   existe para que ligar a trava vire uma decisão consciente, e não um efeito
   colateral que ninguém percebe até o link parar de aceitar inscrição. */
const fs = require("fs"), path = require("path");
const publico = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "EventosInscricaoPublica.gs"), "utf8");
ok(!/EVENTOS_V2_STATUS\.(INSCRICOES_ABERTAS|PROGRAMADO)/.test(publico),
   "a inscrição pública NÃO recusa por situação do evento",
   "decisão do usuário em 26/08 — a trava entra quando ele pedir");

passo("6b · a tela oferece o cartão de situação");
const tela = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "EventosAdmin.html"), "utf8");
ok(/id="evSituacaoCard"/.test(tela), "o cartão de situação existe na tela");
ok(/eventosV2Admin_situacaoFesta2026\(token\)/.test(tela),
   "  e lê a situação pelo Controller");
ok(/eventosV2Admin_mudarSituacaoFesta2026\(token,destino,motivo/.test(tela),
   "  e muda pelo Controller, com motivo");
ok(/evSituacaoCarregar\(\);/.test(tela),
   "  sendo chamado ao carregar a tela",
   "cartão que ninguém pinta é cartão que fica em 'Carregando…' para sempre");
ok(!/disabled title="Publicação será habilitada/.test(tela),
   "o botão Publicar desligado saiu da barra de ações",
   'era ele que fazia o usuário perguntar "é assim mesmo?"');
ok(/pendenciasParaPublicar/.test(tela),
   "a tela diz o que falta ANTES de a pessoa clicar e ouvir não");
ok(/r\.proximos\|\|\[\]/.test(tela),
   "os botões vêm do backend, não de uma lista fixa na tela",
   "assim a tela nunca oferece um destino que o Service vai recusar");

passo("6c · nenhuma caixa nativa sobrou no módulo de Eventos");
/* Estender o t97 para EventosAdmin achou SEIS diálogos nativos que já estavam
   lá antes desta tarefa — um confirm() de excluir evento e cinco prompt(),
   três deles o plano B do "copiar link". Todos anunciavam o endereço cru do
   googleusercontent, que é o que o usuário mandou tirar da Importação horas
   antes, no mesmo dia. */
const semComent = tela.replace(/<!--[\s\S]*?-->/g, "")
                      .replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/(?<![\w$.])(confirm|alert|prompt)\s*\(/.test(semComent),
   "EventosAdmin não tem confirm/alert/prompt nativo");
ok(/function evMostrarLink\(url\)/.test(tela),
   "  o plano B do copiar link usa o diálogo do sistema");

resumo();
