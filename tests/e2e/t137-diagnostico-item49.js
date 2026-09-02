/**
 * t137 — O DIAGNÓSTICO DO ITEM 49, NAS DUAS VERSÕES
 *
 * Existem dois arquivos com o mesmo relatório, e a diferença é proposital:
 *
 *   DiagnosticoItem49.gs                      (raiz)  → vai para a HOMOLOGAÇÃO
 *                                                       pelo deploy. TEM porta.
 *   tests/fixtures/producao/…gs.txt                   → cola-se na PRODUÇÃO.
 *                                                       NÃO tem porta.
 *
 * POR QUE A DE PRODUÇÃO NÃO TEM PORTA. A porta é `exigirAdminOuSessao_`, que
 * só existe se o projeto tiver o AcessoModulos.gs numa versão recente. A
 * homologação tem. A produção não se sabe — e **descobrir isso é uma das três
 * perguntas que este diagnóstico existe para responder**. Pôr a porta lá seria
 * fazer o diagnóstico depender da resposta que ele foi escrito para dar.
 *
 * POR QUE A DA RAIZ TEM. Sem ela a função entraria na contagem de exposição,
 * que estava em 204 de um teto de 204 quando este arquivo nasceu. Uma
 * ferramenta temporária não vale gastar um teto que custou quatro rodadas para
 * descer de 224 até ali.
 *
 * O RISCO QUE ESTE TESTE FECHA: duas cópias do mesmo relatório divergirem em
 * silêncio, e eu passar a testar uma e entregar a outra.
 */

const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const NA_RAIZ   = fs.readFileSync(path.join(RAIZ, "DiagnosticoItem49.gs"), "utf8");
const PRODUCAO  = fs.readFileSync(path.join(RAIZ, "tests", "fixtures", "producao", "DiagnosticoItem49.gs.txt"), "utf8");

const { g } = b.subir({});

b.fluxo("ITEM 49 · o diagnóstico da HOMOLOGAÇÃO tem porta");

b.passo("1. a função existe e é chamável pelo editor");
b.ok(typeof g.diagnosticoItem49 === "function", "diagnosticoItem49 carregou");
b.ok(typeof g.diagnosticoItem49_relatorio_ === "function",
  "e o relatório fica numa função privada, que o editor não lista");

b.passo("2. SEM SESSÃO ela recusa — é o que a mantém fora da contagem");
/* Se esta asserção cair, a função virou endpoint anônimo e o teto de
   exposição sobe de 204 para 205 sem ninguém decidir isso. */
let recusou = false, msg = "";
try { g.diagnosticoItem49(""); } catch (e) { recusou = true; msg = String(e.message || e); }
b.ok(recusou, "recusa sem token de sessão", msg);
b.ok(/sess|permiss|acesso|autoriz|login/i.test(msg),
  "e recusa POR SEGURANÇA, não por erro de outra coisa", msg);

b.passo("3. com sessão de administrador, ela roda");
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
let reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 4).setValues([["Número do Ofício", "Status", "E-mails (todos)", "Observações"]]);
reg.getRange(2, 1, 3, 4).setValues([
  ["144/2026", "CONFIRMADO", "thalia.ferreira@faesa.br", "Confirmação localizada automaticamente no Gmail."],
  ["236/2026", "CONFIRMADO", "thalia.ferreira@faesa.br", "Confirmação localizada automaticamente no Gmail."],
  ["242/2026", "ENVIADO",    "thalia.ferreira@faesa.br", ""]
]);
g._headerCache = {};

const saida = g.diagnosticoItem49(token);
b.ok(typeof saida === "string" && saida.length > 0, "devolveu o relatório");
["1. FUNCOES PRESENTES", "2. OS OFICIOS DO ACHADO",
 "3. QUANTOS FORAM CONFIRMADOS PELA ROTINA"].forEach(function (s) {
  b.ok(saida.indexOf(s) > -1, "tem a seção: " + s);
});

b.passo("4. e a seção 1 mede este projeto de verdade");
/* Não é decoração: é ela que vai dizer se a produção tem `registrarLogSistema`
   ou `registrarLogSistema_`. Aqui, no repositório, a resposta é conhecida — e
   é justamente por isso que serve de aferição do medidor. */
b.ok(/\[x\] TEM     registrarLogSistema_/.test(saida),
  "acha registrarLogSistema_, que É o nome deste repositório");
b.ok(/\[ \] NAO TEM registrarLogSistema\b/.test(saida.replace(/registrarLogSistema_/g, "XX")),
  "e não acha registrarLogSistema sem underscore, que não existe mais aqui",
  "se este par se inverter na produção, o arquivo a colar lá é outro");

b.passo("4b. o nome antigo é DERIVADO, nunca escrito por extenso");
/* O t127 varre o repositório atrás de referência ao nome antigo, porque
   renomear função usada por seis arquivos quebra em silêncio. Um nome velho
   escrito neste arquivo seria indistinguível de uma chamada esquecida — e foi
   exatamente assim que a suíte ficou vermelha na primeira versão dele.

   Derivar resolveu as duas pontas: o detector do t127 fica inteiro, e o
   diagnóstico passa a conferir os DOIS lados de TODA função fechada, não só a
   uma que eu tivesse lembrado de listar. */
b.ok(NA_RAIZ.replace(/registrarLogSistema_/g, "XX").indexOf("registrarLogSistema") === -1,
  "o arquivo não contém o nome antigo em lugar nenhum");
b.ok(NA_RAIZ.indexOf('nomes[q].slice(0, -1)') > -1,
  "porque ele tira o underscore do nome novo para sondar o antigo");
b.igual((saida.match(/<- nome ANTIGO, sem underscore/g) || []).length,
  (saida.match(/_$/gm) || []).length,
  "e sonda um par para cada função terminada em underscore");

b.passo("5. os três ofícios, e a distinção que importa");
b.ok(/Oficio 144\/2026/.test(saida) && /Oficio 236\/2026/.test(saida) &&
     /Oficio 242\/2026/.test(saida), "achou os três");
b.igual((saida.match(/confirmado por ROTINA\? SIM/g) || []).length, 2,
  "dois marcados como confirmados pela ROTINA");
b.igual((saida.match(/confirmado por ROTINA\? nao/g) || []).length, 1,
  "e o que estava ENVIADO não é contado como tal");

b.fluxo("ITEM 49 · as duas versões não podem divergir em silêncio");

b.passo("6. o relatório é IDÊNTICO nos dois arquivos");
/* O corpo começa na constante DIAG49_OFICIOS e vai até o fim. A única
   diferença permitida entre os dois arquivos é o nome da função que o embrulha
   e o cabeçalho — o miolo tem de bater caractere a caractere. */
function miolo(txt) {
  const i = txt.indexOf("/** Os tres oficios do achado.");
  return txt.slice(i)
            .replace("function diagnosticoItem49_relatorio_() {", "FUNC")
            .replace("function diagnosticoItem49() {", "FUNC");
}
b.igual(miolo(NA_RAIZ), miolo(PRODUCAO),
  "o miolo dos dois arquivos é o mesmo texto");

b.passo("7. e cada um tem — ou não tem — a porta que lhe cabe");
b.ok(NA_RAIZ.indexOf("exigirAdminOuSessao_(tokenSessao") > -1,
  "a versão da raiz tem porta: o t6 não a conta como exposta");
/* Procura a CHAMADA, não a menção: o arquivo de produção cita
   `exigirAdminOuSessao_` de propósito, dentro da lista de nomes que ele vai
   sondar no projeto. É a diferença entre usar a função e perguntar se ela
   existe — e este teste falhou uma vez por confundir as duas. */
b.ok(PRODUCAO.indexOf("exigirAdminOuSessao_(") === -1,
  "a de produção NÃO chama a porta",
  "ela roda num projeto onde essa função pode não existir — e é isso que ela foi escrita para descobrir");
b.ok(PRODUCAO.indexOf('"exigirAdminOuSessao_"') > -1,
  "mas SONDA por ela, que é o ponto do diagnóstico");

b.passo("8. nenhuma das duas escreve coisa alguma");
/* A checagem inteira vale zero se o diagnóstico puder mexer no dado real. Aqui
   se procura, no texto dos dois arquivos, qualquer chamada de escrita. */
[["raiz", NA_RAIZ], ["produção", PRODUCAO]].forEach(function (par) {
  ["setValue", "setValues", "appendRow", "deleteRow", "insertSheet",
   "sendEmail", "createFile", "setFormula"].forEach(function (proibido) {
    b.ok(par[1].indexOf(proibido + "(") === -1,
      "versão " + par[0] + " não chama " + proibido + "()");
  });
});

b.naoTestavel(
  "o clique em Executar",
  "eu publico código na homologação, mas não invoco função de Apps Script — " +
  "nem lá, nem na produção. O relatório se prova aqui; quem roda é uma pessoa " +
  "no editor"
);

b.resumo();
