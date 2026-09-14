/**
 * TESTE — O QUE O PAINEL DEVOLVE PRECISA CHEGAR AO NAVEGADOR
 *
 * O QUE ORIGINOU, 14/09/2026. Ele mandou o print do Painel de Eventos:
 *
 *   INSCRIÇÕES 0 · A ANALISAR 0 · A ENVIAR 0 · VAGAS RESTANTES 2000
 *   "O servidor respondeu sem dados do evento."
 *
 * E, na mesma sessão, a tela de Inscrições listava TRÊS pessoas, duas delas
 * com ingresso esperando envio. Os dois números não podiam estar certos ao
 * mesmo tempo.
 *
 * A CAUSA, e ela já tem nome neste repositório. O `google.script.run`
 * serializa o retorno para o navegador. Quando algo no pacote não serializa,
 * o cliente recebe **NULL**: sem erro, sem log, sem handler de falha. Está
 * escrito em `HistoricoOficios.gs:80` e em `VoucherEnvio.gs:173`, das duas
 * vezes em que isso já derrubou uma tela — a última foi o envio do voucher,
 * em 18/08/2026.
 *
 * O QUE NÃO SERIALIZA AQUI: objetos `Date`. Tudo que vem do Firestore já é
 * texto (`fs_fromFields_` devolve `timestampValue` como string), então os
 * únicos Date nesses retornos eram os que o próprio código criava:
 *
 *   compasso_executivoResumo → evento.data = EMISSAO_CFG.DATA_EVENTO
 *       Date literal, sempre presente. Por isso o bloco executivo NUNCA
 *       carregou, em nenhum momento, desde que foi escrito.
 *
 *   compasso_validacaoResumo → chegada.ultimaEm = new Date(criadoEm)
 *       Só nasce quando existe pelo menos UMA inscrição. Com a base vazia o
 *       painel funcionava; bastou a primeira pessoa se inscrever para os
 *       cards irem a zero. E zero, ali, parece calmaria — não defeito.
 *
 * O QUE ESTE TESTE GUARDA, e é mais do que o conserto de hoje: que NENHUMA
 * das funções que a tela chama devolva um pacote que não atravessa. Consertar
 * dois campos resolve esta vez; a varredura resolve a próxima.
 *
 * O QUE NÃO ALCANÇA: o serializador de verdade do Apps Script. Aqui se aplica
 * a regra documentada — Date e função não passam. Que a tela volte a mostrar
 * os números, só o ensaio no ar responde.
 */
const fs = require("fs");
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const ADM = b.logar(g, "wanderson");

/* ─── Firestore em memória (mesmo padrão do t165) ────────────────────────── */
const BANCO = new Map();
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o));

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => { const v = BANCO.get(chave(col, id)); return v ? clonar(v) : null; };
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  return out;
};
g.fs_queryEquals_ = (col, campo, valor) =>
  g.fs_list_(col).filter(d => String(d[campo]) === String(valor));

const EV = g.EMISSAO_CFG.EVENTO_ID;

/**
 * A regra do google.script.run, aplicada ao pacote inteiro.
 *
 * Devolve a LISTA de caminhos problemáticos — o caminho importa mais do que o
 * fato: "evento.data" diz onde consertar; "tem um Date" manda procurar.
 */
function naoViajam(v, caminho, achados) {
  achados = achados || [];
  caminho = caminho || "";
  if (v instanceof Date)          achados.push((caminho || "(raiz)") + " → Date");
  else if (typeof v === "function") achados.push(caminho + " → function");
  else if (typeof v === "number" && !isFinite(v))
    achados.push(caminho + " → " + String(v));
  else if (Array.isArray(v))
    v.forEach(function (x, i) { naoViajam(x, caminho + "[" + i + "]", achados); });
  else if (v && typeof v === "object")
    Object.keys(v).forEach(function (k) {
      naoViajam(v[k], caminho ? caminho + "." + k : k, achados);
    });
  return achados;
}

function inscrever(id, dados) {
  g.fs_set_("inscricoesEventos", id, Object.assign({
    inscricaoId: id, eventoId: EV, status: "",
    criadoEm: new Date().toISOString()
  }, dados));
}

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A varredura acusa o que não atravessa — provando que ela funciona");

/* Uma varredura que nunca reprova não guarda nada. Antes de confiar nela nos
   retornos de verdade, ela precisa achar o problema quando ele existe. */
igual(naoViajam({ evento: { nome: "x", data: new Date() } }).length, 1,
      "acha um Date escondido dentro de um objeto");
igual(naoViajam({ evento: { nome: "x", data: new Date() } })[0], "evento.data → Date",
      "e diz ONDE ele está");
igual(naoViajam({ lista: [{ q: 1 }, { q: new Date() }] })[0], "lista[1].q → Date",
      "inclusive dentro de array");
igual(naoViajam({ n: NaN })[0], "n → NaN", "e pega número que não é número");
igual(naoViajam({ a: 1, b: "dois", c: null, d: [1, 2], e: { f: true } }).length, 0,
      "e não reclama do que é são");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Com a base VAZIA — era assim que o defeito se escondia");

BANCO.clear();
g.fs_set_("reservasEventos", EV, { eventoId: EV, limite: 2000, reservadas: 0 });
g.fs_set_("contadores", EV, { limite: 2000, vagasUsadas: 0, ultimoNumero: 0 });

let r = g.compasso_validacaoResumo(ADM);
igual(r.total, 0, "nenhuma inscrição");
igual(naoViajam(r).length, 0, "e o pacote atravessa",
      JSON.stringify(naoViajam(r)));
igual(r.chegada.ultimaEm, null,
      "porque ultimaEm ainda é nulo — o Date só nascia com a primeira pessoa");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Com gente inscrita — era aqui que o painel ia a zero");

inscrever("INS-1", { nome: "MARCELHA ALINE PINTO GOMES", cpf: "08029739737",
                     escola: "Favi", cidade: "Vitória",
                     whatsapp: "27999161454", ingressoId: "ING-2",
                     numeroIngresso: "FCV-2026-000002" });
inscrever("INS-2", { nome: "PILOTO COMPASSO", cpf: "96577102350",
                     escola: "ESCOLA DE TESTE", cidade: "Vitória",
                     ingressoId: "ING-1", numeroIngresso: "FCV-2026-000001" });
inscrever("INS-3", { nome: "WANDERSON NASCIMENTO CASTELO", cpf: "08538104780",
                     escola: "UVV - Vila Velha", cidade: "VITÓRIA",
                     status: "VALIDADA_ADMINISTRATIVAMENTE" });

r = g.compasso_validacaoResumo(ADM);

passo("os números batem com a lista que ele viu na tela");
igual(r.total, 3, "três inscrições");
igual(r.aEnviar, 2, "duas com ingresso esperando envio");
igual(r.semIngresso, 1, "e uma validada sem ingresso");

passo("e agora o pacote atravessa — antes desta correção, não");
const achadosResumo = naoViajam(r);
igual(achadosResumo.length, 0,
      "nada no retorno de compasso_validacaoResumo deixa de serializar",
      achadosResumo.join(" · "));
ok(typeof r.chegada.ultimaEm === "string",
   "  a última chegada viaja como texto",
   "era um Date, e ele sozinho zerava os quatro cards do painel");
ok(!isNaN(new Date(r.chegada.ultimaEm).getTime()),
   "  e continua sendo uma data legível para quem recebe");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O executivo — que nunca carregou uma vez sequer");

const ex = g.compasso_executivoResumo(ADM);

passo("o pacote inteiro atravessa");
const achadosEx = naoViajam(ex);
igual(achadosEx.length, 0,
      "nada no retorno de compasso_executivoResumo deixa de serializar",
      achadosEx.join(" · "));

passo("e o relógio continua dizendo a mesma coisa");
ok(typeof ex.evento.data === "string", "a data do evento viaja como texto");
igual(new Date(ex.evento.data).getFullYear(), 2026, "  ano certo");
igual(new Date(ex.evento.data).getMonth(), 11, "  dezembro");
igual(new Date(ex.evento.data).getDate(), 19, "  dia 19");
ok(ex.evento.dias > 0, "e os dias que faltam continuam sendo contados",
   "a conta é feita ANTES da conversão — trocar a ordem quebraria o relógio");

passo("os números do executivo são os mesmos do painel");
igual(ex.inscricoes.total, 3, "três inscrições");
igual(ex.inscricoes.aEnviar, 2, "duas a enviar");
igual(ex.evento.vagasRestantes, 2000 - 2, "e as vagas descontam quem tem ingresso");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O painel não pinta zero no lugar de 'não veio'");

const admin = fs.readFileSync(RAIZ + "/EventosAdmin.html", "utf8");

passo("a resposta nula deixa de virar calmaria");
ok(!/r=r\|\|\{\};/.test(admin),
   "o r||{} saiu do carregamento do painel",
   "era ele que transformava NULL em 0 inscrições e 2.000 vagas livres");
ok(/O servidor respondeu sem os números do evento/.test(admin),
   "e a tela passa a dizer que a carga falhou",
   "zero é uma informação; ausência de resposta é outra");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O serializador de verdade do Apps Script",
  "aqui se aplica a regra documentada em HistoricoOficios.gs:80 — Date e " +
  "função não atravessam. Que os cards do painel voltem a mostrar 3 e o " +
  "bloco executivo deixe de dizer 'sem dados do evento', só o ensaio em " +
  "homologação responde.");

resumo();
