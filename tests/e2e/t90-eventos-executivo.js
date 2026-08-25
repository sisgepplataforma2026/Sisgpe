/**
 * O EXECUTIVO DE EVENTOS — E A CONTA QUE NINGUÉM TINHA FEITO
 *
 * O QUE ORIGINOU
 *
 * 25/08/2026. O usuário: "está faltando, que eu acredito que seja importante,
 * o executivo do módulo de eventos. O que você acha?".
 *
 * Achei que sim, mas por um motivo diferente do óbvio. O painel operacional já
 * mostrava as filas; um segundo painel repetindo os mesmos números seria o que
 * o próprio PROMPT-MESTRE chama de dashboard decorativo. O executivo só se
 * justifica se responder o que o operacional não responde.
 *
 DUAS CORREÇÕES DELE, NA MESMA CONVERSA
 *
 * 1. "Os ingressos são enviados por WhatsApp, prioritariamente, raramente por
 *    e-mail." Eu tinha posto a cota de e-mail como risco principal. Não é.
 *
 * 2. "Os ingressos eram enviados de forma unitária, um por um, e não tudo ao
 *    mesmo tempo." Eu tinha somado as 2.000 entregas e anunciado 14 horas de
 *    trabalho. Ele estava certo: eles saem conforme as validações, ao longo de
 *    semanas. O total nunca é feito de uma vez, e alarmar sobre ele é assustar
 *    à toa.
 *
 * O QUE SOBROU, E QUE VALE
 *
 * O RITMO. Quantos ingressos esperam envio hoje, distribuídos nos dias que
 * faltam, e quantos minutos por dia isso custa. Nesse formato o painel fica
 * quieto quando a fila está em dia, e avisa quando ela acumula — antes de
 * virar mutirão de véspera. O risco nunca foi o total; é o acúmulo.
 *
 * Uma coisa da primeira leitura continua valendo e está guardada aqui: envio
 * em lote existe SOMENTE para e-mail (compasso_enviarLoteEmail). O canal que
 * eles usam é o único sem lote — o que não é urgente, mas explica por que o
 * acúmulo dói.
 *
 * O QUE ESTE ARQUIVO GUARDA
 *
 * A conta, executada — não que ela esteja "certa" (é estimativa declarada),
 * mas que ela exista, apareça na tela, e que os riscos venham com o próximo
 * passo. Risco sem ação é ansiedade em forma de card.
 */

const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const exec = ler("EventosExecutivo.gs");
const tela = ler("EventosAdmin.html");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: codigo.slice(m.index + m[0].length, i - 1) };
}
const fn = (codigo, nome, deps) => {
  const a = corpoDe(codigo, nome);
  const nomes = Object.keys(deps || {});
  return (...vals) => new Function(...a.args, ...nomes, a.corpo)(
    ...vals, ...nomes.map(n => (deps || {})[n]));
};

const SEGUNDOS = Number((exec.match(/var COMPASSO_SEGUNDOS_POR_WHATSAPP = (\d+)/) || [])[1]);

fluxo("EVENTOS · executivo do módulo — o relógio e o que para o dia");

/* ───────────────────────────────────────────────────────────────────────── */
passo("O RITMO DE ENVIO — não o total");

const esforco = fn(exec, "compasso_esforcoEntrega_",
                   { COMPASSO_SEGUNDOS_POR_WHATSAPP: SEGUNDOS });

/* A PRIMEIRA VERSÃO DESTE TESTE ESTAVA ERRADA, e o usuário corrigiu:
   "os ingressos eram enviados de forma unitária, um por um, e não tudo ao
   mesmo tempo". Eu somava as 2.000 e anunciava 14 horas — um susto que não
   corresponde a nada, porque eles saem conforme as validações. O número que
   decide algo é o ritmo. */
const folgado = esforco(120, 116);
igual(folgado.quantidade, 120, "a conta é sobre a FILA DE HOJE");
igual(folgado.diasRestantes, 116, "  distribuída nos dias que faltam");
igual(folgado.porDia, Math.ceil(120 / 116), "  o que dá o ritmo por dia");
igual(folgado.apertado, false,
      "120 ingressos em 116 dias NÃO é alarme",
      "somar o total daria 'quase uma hora de trabalho' e assustaria à toa; " +
      "painel que assusta sem motivo é painel que se aprende a ignorar");

/* O que vira risco é o ACÚMULO. */
const apertado = esforco(1200, 5);
ok(apertado.minutosPorDia > 60,
   "1.200 ingressos em 5 dias passa de uma hora por dia");
igual(apertado.apertado, true,
      "  e AÍ sim é alarme",
      "é o mutirão de véspera que o aviso existe para evitar");

igual(esforco(0, 116).quantidade, 0, "fila vazia não gera trabalho");
igual(esforco(0, 116).apertado, false, "  nem alarme");
igual(esforco(100, 0).diasRestantes, 1,
      "zero dias vira 1, não divisão por zero",
      "no dia da festa a conta ainda precisa devolver um número");
/* DEPOIS de 19/12 a contagem fica NEGATIVA, e isso acontece de verdade — a
   tela não some no dia 20. Sem o piso, `porDia` sairia negativo e o painel
   mostraria "-20 por dia", que não quer dizer nada. */
igual(esforco(100, -5).diasRestantes, 1, "dias negativos também viram 1");
ok(esforco(100, -5).porDia > 0,
   "  e o ritmo continua sendo um número positivo",
   "passada a festa, a contagem regressiva fica negativa e a conta tem de " +
   "aguentar isso sem produzir bobagem");

igual(folgado.canal, "WhatsApp",
      "o canal é o que eles usam de verdade",
      "o usuário: 'os ingressos são enviados por WhatsApp, prioritariamente'");
igual(folgado.temLote, false,
      "e fica registrado que este canal não tem envio em lote",
      "compasso_enviarLoteEmail existe; equivalente para WhatsApp, não");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a estimativa é declarada, não escondida");

ok(SEGUNDOS > 0, "existe um número de segundos por envio, nomeado");
igual(folgado.segundosPorEnvio, SEGUNDOS,
      "e ele volta na resposta, para a tela poder mostrar",
      "estimativa que não diz de onde veio é chute com cara de medição");
ok(/estimativa declarada, não medição/.test(exec),
   "o próprio arquivo diz que é estimativa e não medição");

/* ───────────────────────────────────────────────────────────────────────── */
passo("os riscos vêm com o próximo passo");

const riscos = fn(exec, "compasso_riscosDoEvento_", {
  EMISSAO_CFG: { LIMITE_VAGAS: 2000 },
  compasso_esforcoEntrega_: esforco
});

const lista = riscos(116, { aprovado: true }, esforco(1200, 5));
ok(lista.length >= 2, "há riscos listados");
lista.forEach(function (x, i) {
  ok(!!x.titulo && !!x.acao,
     "risco " + (i + 1) + " tem título e AÇÃO",
     "risco sem próximo passo é ansiedade em forma de card");
  ok(["alto", "medio"].indexOf(x.grau) >= 0, "  e um grau");
});

ok(lista.some(x => /QR/.test(x.titulo)),
   "o QR nunca lido por câmera está entre eles",
   "é o item mais importante em aberto desde 21/08, e nenhum código o prova");
ok(lista.some(x => /fila de envio acumulou/i.test(x.titulo)),
   "e a fila de envio acumulada também");

/* Fila em dia: o painel fica quieto sobre entrega. */
const semAcumulo = riscos(116, { aprovado: true }, esforco(120, 116));
ok(!semAcumulo.some(x => /fila de envio/i.test(x.titulo)),
   "com a fila em dia, nenhum aviso sobre entrega",
   "avisar sobre o que está sob controle é o mesmo que não avisar");

/* ───────────────────────────────────────────────────────────────────────── */
passo("o Firestore só vira risco quando a projeção estoura");

const semEstouro = riscos(116, { aprovado: true }, esforco(120, 116));
ok(!semEstouro.some(x => /Firestore/.test(x.titulo)),
   "projeção dentro da cota não gera alarme",
   "alarmar sobre o que está bem ensina a ignorar o painel");

const comEstouro = riscos(116, { aprovado: false, percentualLeituras: 140, percentualGravacoes: 80 }, esforco(120, 116));
ok(comEstouro.some(x => /Firestore/.test(x.titulo)),
   "projeção estourada vira risco");
const rf = comEstouro.filter(x => /Firestore/.test(x.titulo))[0];
ok(/140/.test(rf.texto), "  com o número que estourou à vista");
ok(/portaria parada/.test(rf.texto),
   "  e dizendo o que isso significa no dia",
   "'140% da cota' não diz nada a quem vai operar a portaria");

/* ───────────────────────────────────────────────────────────────────────── */
passo("o relógio aperta o discurso quando falta menos de um mês");

ok(!riscos(116, { aprovado: true }, esforco(120, 116)).some(x => /menos de um mês/.test(x.titulo)),
   "a 116 dias, não");
ok(riscos(20, { aprovado: true }, esforco(120, 20)).some(x => /menos de um mês/.test(x.titulo)),
   "a 20 dias, sim");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a projeção do Firestore é sobre a festa CHEIA");

const corpoResumo = corpoDe(exec, "compasso_executivoResumo").corpo;
ok(/compasso_estimarDiaFesta\(EMISSAO_CFG\.LIMITE_VAGAS/.test(corpoResumo),
   "estima sobre as 2.000 vagas, não sobre quem já se inscreveu",
   "projetar sobre 124 inscritos daria um 'tudo bem' que não vale nada");

/* A ENTREGA É O CONTRÁRIO: fila de hoje, não lotação. As duas contas olham
   para coisas diferentes, e trocá-las é fácil — o Firestore pergunta "cabe
   quando estiver cheio?", a entrega pergunta "o que está parado agora?". */
ok(/compasso_esforcoEntrega_\(aEnviar, dias\)/.test(corpoResumo),
   "mas o esforço de entrega é sobre a FILA DE HOJE",
   "contar as 2.000 aqui traria de volta o susto que o usuário corrigiu");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a data da festa não depende de tela preenchida");

ok(/DATA_EVENTO/.test(ler("EventosEmissao.gs")),
   "a data mora na configuração do evento");
ok(/EMISSAO_CFG\.DATA_EVENTO/.test(corpoResumo),
   "  e o relógio lê de lá",
   "se dependesse da tela de Informações, o relógio sumiria com ela vazia");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a tela mostra o que o backend calculou");

ok(/id="exDias"/.test(tela) && /id="exRiscos"/.test(tela),
   "o relógio e a lista de riscos existem na tela");
ok(/id="tela-executivo"|rotulo:'Executivo'/.test(tela),
   "  como uma tela do submódulo Painel");
ok(/compasso_executivoResumo\(token\)/.test(tela),
   "  alimentada pela função do executivo");
ok(/en\.porDia/.test(tela),
   "  e a tela mostra o RITMO, não o total",
   "o total nunca é feito de uma vez — o usuário corrigiu isso em 25/08");

resumo();
