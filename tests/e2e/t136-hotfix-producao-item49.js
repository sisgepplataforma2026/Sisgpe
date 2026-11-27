/**
 * t136 — O PACOTE QUE VAI PARA A PRODUÇÃO (item 49)
 *
 * ESTE TESTE NÃO PROVA O REPOSITÓRIO. Prova os arquivos de
 * `tests/fixtures/producao/`, que são os que o usuário vai COLAR no projeto
 * Apps Script de produção. É a diferença que justifica o teste existir.
 *
 * POR QUE NÃO SE COLA O ARQUIVO DO REPOSITÓRIO
 *
 * O `MonitoramentoOficios.gs` do repositório chama `registrarLogSistema_` —
 * com underscore. Esse nome NASCEU EM 01/09/2026 (commit b563103), quando as
 * funções de Ofícios foram fechadas. A produção ainda tem `registrarLogSistema`,
 * pública, sem underscore. Colar o arquivo do repositório lá dentro faria toda
 * gravação de log estourar `ReferenceError` — e o pior: dentro de um `catch`,
 * em silêncio, que é exatamente como a regressão do item 53 passou batido.
 *
 * Por isso o arquivo entregue é OUTRO: a base que a produção tem, com SÓ a
 * correção do item 49 aplicada por cima. Este teste prova essa base.
 *
 * O QUE ELE FAZ QUE O t122 NÃO FAZ
 *
 * O t122 lê o fonte e confere que o filtro mudou. Aqui o verificador RODA:
 * planilha semeada, bounce entregue pelo Gmail falso, e no fim se olha o que
 * ficou escrito na célula de status. É a diferença entre "o código está certo"
 * e "os três ofícios voltam".
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const b = require("./base");

const FIXTURES = path.join(__dirname, "..", "fixtures", "producao");

/* Sobe o sistema SEM o arquivo do repositório e põe o de produção no lugar.
   É o único jeito de testar o que vai ser colado, e não o que está aqui. */
const { g, amb } = b.subir({ ignorar: ["MonitoramentoOficios.gs"] });

function carregarFixture(nome) {
  vm.runInContext(fs.readFileSync(path.join(FIXTURES, nome), "utf8"), g, { filename: nome });
}
carregarFixture("MonitoramentoOficios.gs.txt");
carregarFixture("DiagnosticoItem49.gs.txt");

/* A PRODUÇÃO TEM `registrarLogSistema` PÚBLICA. O repositório não tem mais.
   Declará-la aqui não é maquiagem: é reproduzir a forma da produção, que é
   o ambiente que este teste representa. O contador prova que ela foi
   chamada — ou seja, que o arquivo entregue casa com o nome de lá. */
let logsGravados = [];
g.registrarLogSistema = function (d) { logsGravados.push(d); };

b.fluxo("ITEM 49 · o arquivo entregue não depende de nada renomeado ontem");

b.passo("1. ele chama a função de log pelo nome QUE A PRODUÇÃO TEM");
const fonteEntregue = fs.readFileSync(path.join(FIXTURES, "MonitoramentoOficios.gs.txt"), "utf8");
b.ok(fonteEntregue.indexOf("registrarLogSistema_(") === -1,
  "não usa registrarLogSistema_ — o nome que nasceu em 01/09 e a produção não tem");
b.ok(fonteEntregue.indexOf("registrarLogSistema({") > -1,
  "usa registrarLogSistema, que é o nome de lá");

b.passo("2. e carregou sem erro no escopo global, como o Apps Script faz");
["MON_OFICIOS_textoConfirmaRecebimento_", "MON_OFICIOS_ehRemetenteAutomatico_",
 "verificarFalhasEntregaOficios", "verificarConfirmacoesRecebimento",
 "diagnosticoItem49"].forEach(function (n) {
  b.ok(typeof g[n] === "function", "existe: " + n);
});

b.fluxo("ITEM 49 · a correção, no arquivo que vai ser colado");

b.passo("3. 'Outlook' não confirma mais ofício nenhum");
[["Enviado do meu Outlook", "a assinatura que causou tudo"],
 ["Sent from Outlook for iOS", "idem, em inglês"],
 ["Nao pode ser entregue. Token invalido.", "'token' também tem 'ok' dentro"],
 ["Prezados, boa tarde", "texto neutro"]
].forEach(function (par) {
  b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(par[0]) === false,
    "NÃO confirma: " + JSON.stringify(par[0]), par[1]);
});

b.passo("4. e quem responde 'ok' de verdade continua sendo entendido");
["ok", "OK", "Ok, recebido", "tudo ok por aqui", "Recebido, obrigado",
 "Confirmamos o recebimento", "Estamos cientes"].forEach(function (t) {
  b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(t) === true, "confirma: " + t);
});

b.passo("5. robô não confirma");
["mailer-daemon@googlemail.com", "postmaster@faesa.br", "no-reply@x.com"
].forEach(function (f) {
  b.ok(g.MON_OFICIOS_ehRemetenteAutomatico_(f) === true, "é robô: " + f);
});
b.ok(g.MON_OFICIOS_ehRemetenteAutomatico_("thalia.ferreira@faesa.br") === false,
  "e uma pessoa continua passando");

b.fluxo("ITEM 49 · os três ofícios VOLTAM — verificador rodado de verdade");

/* ── a planilha, montada como a de produção ────────────────────────────── */
const FAESA = "thalia.ferreira@faesa.br";
const AUTO  = "Confirmação localizada automaticamente no Gmail.";
const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
let reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 4).setValues([["Número do Ofício", "Status", "E-mails (todos)", "Observações"]]);
const LINHAS = [
  ["144/2026", "CONFIRMADO", FAESA,                    AUTO],
  ["236/2026", "CONFIRMADO", FAESA,                    AUTO],
  ["242/2026", "CONFIRMADO", FAESA,                    AUTO],
  /* A PESSOA que confirmou não pode ser desfeita por um bounce antigo. */
  ["300/2026", "CONFIRMADO", FAESA,                    "Diretora confirmou por telefone em 12/08."],
  /* Mesmo e-mail, mas já ENVIADO: o caminho que sempre funcionou. */
  ["301/2026", "ENVIADO",    FAESA,                    ""],
  /* Escola sem bounce: nada pode acontecer com ela. */
  ["302/2026", "ENVIADO",    "contato@escolaboa.com.br", ""],
  /* Status fora do jogo continua fora. */
  ["303/2026", "ARQUIVADO",  FAESA,                    AUTO]
];
reg.getRange(2, 1, LINHAS.length, 4).setValues(LINHAS);
g._headerCache = {};

/* O bounce, entregue pelo Gmail falso — um só, citando o endereço da FAESA. */
g.GmailApp.search = function () {
  return [{
    getMessages: function () {
      return [{
        getPlainBody: function () {
          return "Address not found. Your message wasn't delivered to " + FAESA +
                 " because the address couldn't be found.";
        },
        getBody: function () { return ""; }
      }];
    }
  }];
};

b.passo("6. o verificador roda e devolve as três falhas");
const r = g.verificarFalhasEntregaOficios();
b.ok(r && r.ok === true, "rodou sem erro", JSON.stringify(r));
b.igual(r.falhas, 4, "quatro ofícios com bounce: os três do achado + o 301, que já estava ENVIADO");

b.passo("7. E ESTA É A ASSERÇÃO QUE IMPORTA — o status na célula");
/* Antes da correção estes três eram invisíveis: CONFIRMADO saía do filtro e
   nenhuma rotina voltava a olhá-los. Se este passo cair, o achado voltou. */
function statusDe(numero) {
  const dados = reg.getRange(2, 1, LINHAS.length, 4).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === numero) return String(dados[i][1]);
  }
  return "(não achado)";
}
["144/2026", "236/2026", "242/2026"].forEach(function (n) {
  b.igual(statusDe(n), "FALHA_ENTREGA", "ofício " + n + " deixou de constar como recebido");
});

b.passo("8. e o que uma PESSOA confirmou fica intocado");
/* O limite da correção. Um bounce de endereço antigo não pode apagar o que
   alguém viu e confirmou — por isso o filtro olha a origem da confirmação. */
b.igual(statusDe("300/2026"), "CONFIRMADO",
  "confirmação humana sobrevive, mesmo com bounce no mesmo endereço");
b.igual(statusDe("303/2026"), "ARQUIVADO", "e status fora do fluxo não é tocado");
b.igual(statusDe("302/2026"), "ENVIADO", "escola sem bounce não é tocada");

b.passo("9. a gravação de log usou o nome da produção");
b.ok(logsGravados.length === 4, "quatro registros de log", logsGravados.length + " gravados");
b.ok(logsGravados.every(function (l) { return l.tipo === "Bounce"; }),
  "todos do tipo Bounce");

b.passo("10. e o aviso saiu para o financeiro");
/* Correção de uma afirmação minha: eu escrevi no t118 que "ninguém é avisado
   quando um ofício falha". É verdade para a FILA e FALSO para falha de
   entrega — este passo é a prova. */
const avisos = amb.outbox.filter(function (m) {
  return String(m.to || "").indexOf("financeiro@sindeducacao.com") > -1;
});
b.ok(avisos.length >= 1, "o financeiro foi avisado do bounce", avisos.length + " e-mail(s)");

b.fluxo("ITEM 49 · o diagnóstico que vai junto — e que NÃO escreve nada");

b.passo("11. ele lê a planilha e responde as três perguntas");
amb.reset();
logsGravados = [];
const antes = reg.getRange(2, 1, LINHAS.length, 4).getValues();
const saida = g.diagnosticoItem49();

b.ok(typeof saida === "string" && saida.length > 0, "devolveu texto");
b.ok(/1\. FUNCOES PRESENTES/.test(saida), "seção 1 — quais funções existem no projeto");
b.ok(/2\. OS OFICIOS DO ACHADO/.test(saida), "seção 2 — os ofícios 144, 236 e 242");
b.ok(/3\. QUANTOS FORAM CONFIRMADOS PELA ROTINA/.test(saida), "seção 3 — quantos outros");

b.passo("12. e acha os três pelo número, mesmo escritos como '144/2026'");
["144", "236", "242"].forEach(function (n) {
  b.ok(saida.indexOf("Oficio " + n + "/2026") > -1,
    "achou o ofício " + n, "casa '144' com '144/2026' e não com '1440'");
});
b.ok(saida.indexOf("NAO ENCONTRADO") === -1, "nenhum dos três ficou sem resposta");

b.passo("13. distingue confirmação de ROTINA da de PESSOA");
b.ok(/confirmado por ROTINA\? SIM/.test(saida), "marca as automáticas");
b.ok(saida.indexOf("confirmados automaticamente ...... 4") > -1,
  "e conta 4 confirmadas pela rotina — os três mais o 303",
  "é a resposta da pergunta 'quantos outros estão errados?'");

b.passo("13b. o nome ANTIGO é derivado, nunca escrito por extenso");
/* Veio do t137, que testava uma segunda cópia deste diagnóstico na raiz do
   repositório. A cópia saiu em 02/09 porque o deploy de produção exige
   exatamente 173 arquivos .gs e ela fazia 174 — e uma ferramenta temporária
   não tem por que ir para a produção. As asserções que só ela cobria vivem
   aqui agora.

   POR QUE DERIVAR IMPORTA: o t127 varre o repositório atrás de referência ao
   nome antigo, porque renomear função usada por seis arquivos quebra em
   silêncio. Um nome velho escrito neste arquivo seria indistinguível de uma
   chamada esquecida — e foi assim que a suíte ficou vermelha na primeira
   versão dele. Derivando, o detector fica inteiro e o relatório ganha alcance:
   confere os DOIS lados de toda função fechada. */
const fonteDiag = fs.readFileSync(path.join(FIXTURES, "DiagnosticoItem49.gs.txt"), "utf8");
b.ok(fonteDiag.indexOf("nomes[q].slice(0, -1)") > -1,
  "ele tira o underscore do nome novo para sondar o antigo");
b.igual((saida.match(/<- nome ANTIGO, sem underscore/g) || []).length,
  (saida.match(/_$/gm) || []).length,
  "e sonda um par para cada função terminada em underscore");

b.passo("14. E NÃO ESCREVEU NADA — é o que autoriza rodá-lo na produção");
/* A checagem inteira do diagnóstico vale zero se ele puder mexer no dado
   real. Aqui se compara a planilha célula a célula, antes e depois. */
const depois = reg.getRange(2, 1, LINHAS.length, 4).getValues();
b.igual(depois, antes, "a planilha está idêntica depois de rodar o diagnóstico");
b.igual(amb.outbox.length, 0, "nenhum e-mail saiu");
b.igual(logsGravados.length, 0, "nenhum log gravado");

b.naoTestavel(
  "o que a PRODUÇÃO realmente tem hoje",
  "eu só enxergo o repositório. O diagnóstico existe justamente para medir " +
  "isso lá: rodar `diagnosticoItem49` na produção e me mandar o log responde " +
  "quais funções existem, o estado real dos três ofícios e quantos outros " +
  "foram confirmados pela rotina"
);
b.naoTestavel(
  "o e-mail da FAESA no cadastro",
  "três ofícios para o mesmo endereço indica contato que saiu da instituição. " +
  "Corrigir o cadastro ANTES de reenviar, senão o reenvio vira o quarto bounce"
);

b.resumo();
