/**
 * TESTE — O REENVIO TIRA O OFÍCIO DA CAIXA DE FALHA, SEM APAGAR A MEMÓRIA
 *
 * O QUE ORIGINOU, 04/09/2026. O usuário perguntou: "quando reenvia ele não
 * deveria sair da caixa de falha?". Deveria, e não saía — `reenviarOficio`
 * mandava o e-mail e não tocava no Status. Os sete da FAESA continuariam
 * listados como falha depois de reenviados, sem como saber quais já foram.
 *
 * A ARMADILHA, que é o que este teste protege. O contador de falhas por
 * ENDEREÇO — o `❌ 7 falha(s)` do seletor — era lido da MESMA coluna Status.
 * Virar o status para ENVIADO a cada reenvio faria a `thalia` perder uma falha
 * por vez; depois dos sete apareceria com ZERO e voltaria a nascer MARCADA.
 * O aviso que evitou o oitavo bounce sumiria justamente por termos consertado
 * outra coisa.
 *
 * Por isso a falha virou fato permanente do ofício (coluna JA_FALHOU), gravado
 * ANTES de o status mudar.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const MORTO = "thalia.ferreira@faesa.br";
const VIVO  = "luiza.stefani@faesa.br";

const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 6).setValues([[
  "Número do Ofício", "Tipo", "Escola", "E-mail (principal)", "E-mails (todos)", "Status"
]]);
/* Três ofícios da FAESA que quicaram no mesmo endereço morto. */
reg.getRange(2, 1, 3, 6).setValues([
  ["144/2026", "Filiação", "FAESA", MORTO, MORTO, "FALHA_ENTREGA"],
  ["168/2026", "Filiação", "FAESA", MORTO, MORTO, "FALHA_ENTREGA"],
  ["172/2026", "Filiação", "FAESA", MORTO, MORTO, "FALHA_ENTREGA"]
]);

function statusDe(numero) {
  const d = reg.getRange(2, 1, reg.getLastRow() - 1, reg.getLastColumn()).getValues();
  const hm = {}; reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0]
    .forEach((c, i) => hm[String(c)] = i);
  for (const linha of d) {
    if (String(linha[hm["Número do Ofício"]]).trim() === numero) {
      return { status: String(linha[hm["Status"]]).trim(),
               jaFalhou: String(linha[hm["JA_FALHOU"]] || "").trim() };
    }
  }
  return null;
}

function falhasDoMorto() {
  g.ofDest_cacheHistorico_ = null;   // o mapa é cacheado por execução
  return g.ofDest_historico_(MORTO).falhas;
}

fluxo("REENVIO · o ofício sai da caixa de falha");
passo("antes");

igual(falhasDoMorto(), 3, "o endereço morto começa com 3 falhas");
igual(statusDe("144/2026").status, "FALHA_ENTREGA", "e o 144 está como falha");

passo("reenvia o 144");

amb.outbox.length = 0;
const env = g.reenviarOficio({
  numero: "144/2026", url: "https://drive.google.com/file/d/ARQ-144/view",
  escola: "FAESA", tipo: "Filiação", destinatarios: [VIVO]
}, TOKEN);

ok(env && !env.erro, "reenviou", env && env.mensagem);
igual(statusDe("144/2026").status, "ENVIADO",
      "o status virou ENVIADO — sai da caixa de falha");
igual(statusDe("144/2026").jaFalhou, "SIM",
      "e ficou gravado que ele JÁ FALHOU alguma vez");

ok(String(env.mensagem).indexOf("Status agora: ENVIADO") > -1,
   "a mensagem diz o que aconteceu com o status",
   "sem isso a pessoa não sabe se saiu da lista ou não");

passo("a memória do endereço sobrevive — que é a armadilha");

igual(falhasDoMorto(), 3,
      "o endereço morto CONTINUA com 3 falhas depois do reenvio");

const dep = g.reenviarOficio({
  numero: "168/2026", url: "https://drive.google.com/file/d/ARQ-168/view",
  escola: "FAESA", tipo: "Filiação", destinatarios: [VIVO]
}, TOKEN);
ok(dep && !dep.erro, "reenvia o segundo");

const ter = g.reenviarOficio({
  numero: "172/2026", url: "https://drive.google.com/file/d/ARQ-172/view",
  escola: "FAESA", tipo: "Filiação", destinatarios: [VIVO]
}, TOKEN);
ok(ter && !ter.erro, "e o terceiro");

igual(falhasDoMorto(), 3,
      "com os TRÊS reenviados, o endereço morto ainda tem 3 falhas",
      "era exatamente aqui que a contagem zeraria e o morto voltaria a ser sugerido");

igual(statusDe("168/2026").status, "ENVIADO", "e nenhum deles ficou na caixa de falha");
igual(statusDe("172/2026").status, "ENVIADO", "nem o terceiro");

passo("a falha não é contada duas vezes");

/* Status ENVIADO + JA_FALHOU SIM descrevem o MESMO episódio. Se a contagem
   somasse os dois, cada reenvio inflaria o número e o histórico viraria
   ficção no sentido oposto. */
ok(falhasDoMorto() === 3,
   "três ofícios que quicaram continuam valendo três falhas, não seis");

passo("a ordem da gravação");

const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EmailOficios.gs"), "utf8");
const corpo = String(g.oficio_marcarReenviado_).replace(/\s+/g, " ");
ok(corpo.indexOf('cJa).setValue("SIM")') < corpo.indexOf('cSt).setValue("ENVIADO")'),
   "a marca é gravada ANTES da troca do status",
   "invertida, leríamos o status já apagado e a memória se perderia");

ok(/oficio_marcarReenviado_/.test(String(g.reenviarOficio)),
   "e o reenvio chama isso de fato");

resumo();
