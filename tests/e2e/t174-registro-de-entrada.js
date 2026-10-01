/**
 * TESTE — O REGISTRO DE QUEM ENTROU, E DE QUEM FOI BARRADO
 *
 * O QUE ORIGINOU, 15/09/2026: *"preciso ver como vai ficar o registro do
 * ingresso lido"*.
 *
 * Fui olhar e não ficava. O check-in gravava um documento completo em
 * `checkinsEventos` — hora, quem leu, qual aparelho, se foi manual e por quê —
 * e nenhum lugar do sistema lia aquilo: a coleção aparecia duas vezes no
 * projeto inteiro, as duas gravando. Na portaria a leitura vira uma faixa
 * verde de 2,5 segundos e some. Na noite da festa, ninguém conseguiria
 * responder "quantos já entraram?".
 *
 * E faltava a outra metade: RECUSA não deixava rastro. QR já utilizado,
 * ingresso cancelado — a portaria mostrava o ❌ e o sistema esquecia. Quem
 * fosse barrado e reclamasse depois não teria o que consultar.
 *
 * O QUE ESTE TESTE GUARDA, e o que mais importa nele: o CUSTO. A tela atualiza
 * sozinha a cada 15 segundos, a noite inteira. Se ela listasse as entradas,
 * cada atualização custaria uma leitura por pessoa — com 2.000 entradas, perto
 * de meio milhão por hora contra uma faixa gratuita de 50 mil por dia.
 * Estourar a cota no dia 19/12 é portaria parada com fila na porta.
 *
 * Por isso o teste CONTA quantos documentos são lidos. Não é preciosismo: é a
 * diferença entre a tela existir e a festa parar.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ADM = b.logar(g, "wanderson");

/* ─── Firestore em memória que CONTA as leituras ────────────────────────── */
const BANCO = new Map();
let lidos = 0;
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o));

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => {
  const v = BANCO.get(chave(col, id));
  lidos += 1;
  return v ? clonar(v) : null;
};
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  lidos += out.length;
  return out;
};
g.compasso_auditar_ = () => {};
g.compasso_emailUsuario_ = () => "portaria@sindeducacao.com";

const EV = g.EMISSAO_CFG.EVENTO_ID;
const registro = () => g.fs_get_("checkinResumo", EV);

function zerarTudo() {
  BANCO.clear();
  g.fs_set_("contadores", EV, { limite: 2000, vagasUsadas: 5, ultimoNumero: 5 });
  lidos = 0;
}

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Quem entra vira linha no registro");

zerarTudo();
g.compasso_registroAnotar_({ tipo: "ENTROU", nome: "Marcelha Aline Pinto Gomes",
  numero: "FCV-2026-000002", escola: "Favi", categoria: "ASSOCIADO",
  por: "portaria@sindeducacao.com", dispositivo: "PORT-A3F9K2" });

const r1 = registro();
igual(r1.entraram, 1, "o contador sobe");
igual(r1.ultimos.length, 1, "e a linha entra na janela");
igual(r1.ultimos[0].nome, "Marcelha Aline Pinto Gomes", "com o nome");
igual(r1.ultimos[0].numero, "FCV-2026-000002", "o número do ingresso");
igual(r1.ultimos[0].dispositivo, "PORT-A3F9K2", "e QUAL aparelho leu",
      "com dois celulares na porta, saber qual leu é o que resolve divergência");

passo("a hora viaja como TEXTO, não como objeto de data");
igual(typeof r1.ultimos[0].em, "string", "é string",
      "Date no pacote faz o google.script.run entregar NULL ao navegador, " +
      "sem erro e sem log — foi o que derrubou o painel em 14/09");
ok(!isNaN(new Date(r1.ultimos[0].em).getTime()), "  e ainda é uma data legível");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Quem é barrado também — era o buraco maior");

g.compasso_registroAnotar_({ tipo: "RECUSADO", codigo: "JA_UTILIZADO",
  nome: "Marcelha Aline Pinto Gomes", numero: "FCV-2026-000002",
  detalhe: "já utilizado em 20:14:03", por: "portaria@sindeducacao.com",
  dispositivo: "PORT-A3F9K2" });

const r2 = registro();
igual(r2.recusas, 1, "a recusa é contada");
igual(r2.entraram, 1, "e NÃO conta como entrada");
igual(r2.ultimos[0].tipo, "RECUSADO", "a linha mais recente é a recusa");
igual(r2.ultimos[0].codigo, "JA_UTILIZADO", "com o código");
ok(/já utilizado/.test(r2.ultimos[0].detalhe),
   "e o detalhe que explica o ❌ para quem está na porta",
   "é o que responde 'fulano diz que foi barrado'");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Entrada manual carrega o motivo");

g.compasso_registroAnotar_({ tipo: "ENTROU", manual: true,
  motivo: "celular descarregado", nome: "Maria das Gracas",
  numero: "FCV-2026-000091", por: "financeiro@sindeducacao.com",
  dispositivo: "manual" });

const r3 = registro();
igual(r3.manuais, 1, "as manuais são contadas à parte");
igual(r3.entraram, 2, "e entram na contagem geral também");
igual(r3.ultimos[0].motivo, "celular descarregado", "o motivo fica gravado",
      "entrada manual sem motivo à vista é a porta pela qual se libera " +
      "alguém sem ingresso e ninguém percebe depois");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A janela rola: o documento não cresce para sempre");

zerarTudo();
const JANELA = g.COMPASSO_REGISTRO_JANELA;
for (let i = 1; i <= JANELA + 15; i++) {
  g.compasso_registroAnotar_({ tipo: "ENTROU", nome: "Pessoa " + i,
    numero: "FCV-2026-" + String(i).padStart(6, "0") });
}

const r4 = registro();
igual(r4.entraram, JANELA + 15, "o CONTADOR conta todo mundo");
igual(r4.ultimos.length, JANELA, "mas a janela para em " + JANELA,
      "sem teto, o documento cresceria até estourar o limite do Firestore " +
      "no meio da festa");
igual(r4.ultimos[0].nome, "Pessoa " + (JANELA + 15), "o mais recente primeiro");
igual(r4.ultimos[JANELA - 1].nome, "Pessoa 16", "e o mais antigo que ainda cabe");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O CUSTO — é o que decide se a tela pode existir");

/* A tela pede sozinha a cada 15 segundos. Se cada atualização custasse uma
   leitura por entrada, a noite do evento estouraria a cota — e cota estourada
   no dia 19/12 é portaria parada com fila na porta. */
zerarTudo();
for (let i = 1; i <= 300; i++) {
  g.compasso_registroAnotar_({ tipo: "ENTROU", nome: "Pessoa " + i, numero: "N" + i });
}
lidos = 0;
const vista = g.compasso_checkinRegistro(ADM);

passo("uma atualização da tela inteira");
igual(lidos, 2, "custa DUAS leituras de documento",
      "o resumo e o contador de emissão — não 300, que é quanta gente já " +
      "passou pela porta");
ok(lidos < 10, "  e não cresce com o número de pessoas",
   "é essa propriedade que faz a tela poder atualizar a noite toda");

passo("e ela devolve o que os cards precisam");
igual(vista.entraram, 300, "quantos entraram");
igual(vista.emitidos, 5, "quantos ingressos existem");
igual(vista.faltam, 0, "e faltam nunca fica negativo",
      "em teste dá para entrar mais gente do que ingresso emitido; " +
      "'-295 faltando' não ajudaria ninguém");
igual(vista.ultimos.length, g.COMPASSO_REGISTRO_JANELA, "com a janela de linhas");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O ritmo dos últimos 10 minutos diz quando é só um piso");

/* Tudo o que acabou de ser anotado está dentro dos 10 minutos, e a janela
   encheu. Então o número REAL de entradas recentes é maior do que a janela
   consegue enxergar — e a tela precisa dizer isso em vez de fingir precisão. */
igual(vista.ultimos10min, g.COMPASSO_REGISTRO_JANELA,
      "conta o que está na janela");
igual(vista.ritmoEhPiso, true, "e avisa que é um PISO, não a conta",
      "afirmar 60 quando entraram 300 seria inventar uma precisão que o " +
      "dado não sustenta");

passo("com a janela folgada, o número é a conta mesmo");
zerarTudo();
g.compasso_registroAnotar_({ tipo: "ENTROU", nome: "Fulano", numero: "N1" });
lidos = 0;
const calma = g.compasso_checkinRegistro(ADM);
igual(calma.ultimos10min, 1, "uma entrada nos últimos 10 minutos");
igual(calma.ritmoEhPiso, false, "e não é piso: a janela cabe tudo");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Anotar nunca pode impedir alguém de entrar");

/* O check-in é a operação; o registro é a vista dela. Se o Firestore recusar
   a gravação do resumo no meio da festa, a pessoa entra do mesmo jeito. */
zerarTudo();
const setBom = g.fs_set_;
g.fs_set_ = () => { throw new Error("Firestore indisponível"); };
let estourou = false;
try { g.compasso_registroAnotar_({ tipo: "ENTROU", nome: "Alguém" }); }
catch (e) { estourou = true; }
g.fs_set_ = setBom;
igual(estourou, false, "a exceção não sobe",
      "deixar subir faria a portaria recusar a entrada de quem tem ingresso " +
      "válido, por causa de uma falha na CONTAGEM");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("A tela atualizando na frente de alguém",
  "não há navegador aqui. Que os cards mudem sozinhos a cada 15 segundos, e " +
  "que a atualização pare quando a aba está escondida, só o navegador responde.");
naoTestavel("A leitura do QR por câmera",
  "continua sendo o risco número 1 desde 21/08. Este arquivo prova o que " +
  "acontece DEPOIS da leitura; que a câmera leia o QR do PDF, só o celular " +
  "na porta responde.");

resumo();
