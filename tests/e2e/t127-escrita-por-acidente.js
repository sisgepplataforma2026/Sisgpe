/**
 * t127 — MÓDULO 03 · AS DUAS QUE ESCREVIAM SEM PORTA NENHUMA
 *
 * Frente A, quinta rodada, 01/09/2026.
 *
 * A rodada anterior (t126) fechou as que LIAM. Esta fecha as que ESCREVEM —
 * e a diferença importa, porque dado lido indevidamente é vazamento, mas dado
 * escrito indevidamente é registro oficial corrompido, que ninguém tem de
 * onde recuperar.
 *
 * AS DUAS QUE ESCREVIAM
 *
 * `gerarProximoNumeroSeguro()` consome um número da sequência oficial de
 * ofícios do sindicato. Cada chamada QUEIMA um número. Um anônimo chamando em
 * laço abriria buracos na numeração oficial — e numeração de ofício com
 * buraco é problema de auditoria do sindicato, não de sistema. Não dá para
 * "devolver" um número gasto.
 *
 * `registrarLogSistema(dadosLog)` grava na aba LOG_SISTEMA exatamente o que o
 * chamador mandar: usuário, número, tipo, escola, CNPJ, e-mail. Sem porta,
 * qualquer um forjava entrada de auditoria. O log que registra quem fez o quê
 * aceitava qualquer versão da história.
 *
 * AS TRÊS QUE LIAM E VIRARAM PRIVADAS TAMBÉM
 *
 * `preverProximoNumeroOficio`, `verificarCodigoPublico` e `montarEmailHTML`.
 * Nenhuma tem chamador em tela — só outros `.gs`. `verificarCodigoPublico` era
 * a mais notável: uma SEGUNDA porta para o mesmo dado que a rota pública
 * `validarPublico` já serve com propósito. Uma porta basta.
 *
 * O QUE ESTE TESTE NÃO PODE DEIXAR PASSAR
 *
 * Renomear uma função chamada por 14 lugares em 6 arquivos é o tipo de
 * mudança que quebra em silêncio: o Apps Script só reclama na hora em que
 * alguém aperta o botão. Pior, dois arquivos guardam os nomes como STRING
 * (`OficiosDiagnostico.gs` confere quais funções existem; `Reservaparquechina.gs`
 * confere as dependências antes de emitir). String não é pega por renomeação
 * de identificador — e o sintoma seria um diagnóstico dizendo "função não
 * encontrada" sobre função que está lá. Os passos 4 e 5 existem por isso.
 *
 * E A DECISÃO DE NÃO FECHAR TRÊS
 *
 * `processarFilaEnvioOficios`, `verificarConfirmacoesRecebimento` e
 * `verificarFalhasEntregaOficios` continuam públicas e sem porta. São handlers
 * de gatilho: o Apps Script as chama pelo nome, então privadas não podem ser;
 * e a porta dupla identifica quem executa por `Session.getActiveUser()`, que
 * num gatilho por tempo pode voltar vazio — a porta recusaria e o gatilho
 * pararia. Parar a fila para a única operação viva do sindicato. O passo 6
 * mede o que se ganharia fechando: nada de dado, só contadores.
 */

const b = require("./base");
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const { g } = b.subir({});
b.seedUsuarios(g);

const COM_DOCS = b.logar(g, "wanderson");
const SEM_DOCS = b.logar(g, "rogerio");

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

const ARQS = fs.readdirSync(RAIZ).filter(f => /\.(gs|html)$/.test(f));
function ler(a) { return fs.readFileSync(path.join(RAIZ, a), "utf8"); }

b.fluxo("MÓDULO 03 · as duas que ESCREVIAM sem porta");

b.passo("1. queimar número oficial de ofício deixou de ser endpoint");
/* Não é sobre leitura: cada chamada gasta um número da sequência do sindicato,
   e número gasto não volta. */
b.ok(typeof g.gerarProximoNumeroSeguro !== "function",
  "gerarProximoNumeroSeguro não é mais global pública",
  typeof g.gerarProximoNumeroSeguro === "function"
    ? "AINDA É ENDPOINT — qualquer página queima a numeração" : "privada");
b.ok(typeof g.gerarProximoNumeroSeguro_ === "function",
  "e o código continua lá, com o sufixo");

b.passo("2. forjar entrada no log de auditoria também");
b.ok(typeof g.registrarLogSistema !== "function",
  "registrarLogSistema não é mais global pública",
  typeof g.registrarLogSistema === "function"
    ? "AINDA É ENDPOINT — qualquer página escreve no LOG_SISTEMA" : "privada");
b.ok(typeof g.registrarLogSistema_ === "function",
  "e o código continua lá, com o sufixo");

b.passo("3. as três que liam e não tinham chamador em tela");
["preverProximoNumeroOficio", "verificarCodigoPublico", "montarEmailHTML"]
  .forEach(function (nome) {
    b.ok(typeof g[nome] !== "function", "saiu da superfície: " + nome,
      typeof g[nome] === "function" ? "AINDA É ENDPOINT" : "privada");
    b.ok(typeof g[nome + "_"] === "function", "existe: " + nome + "_");
  });

b.fluxo("MÓDULO 03 · o que a renomeação não podia quebrar");

b.passo("4. nenhuma chamada antiga sobrou em nenhum arquivo");
/* Renomear função usada por 6 arquivos quebra em silêncio: o Apps Script só
   reclama quando alguém aperta o botão. */
["gerarProximoNumeroSeguro", "registrarLogSistema", "verificarCodigoPublico",
 "preverProximoNumeroOficio", "montarEmailHTML"].forEach(function (nome) {
  const rx = new RegExp("(^|[^_a-zA-Z0-9])" + nome + "([^_a-zA-Z0-9]|$)");
  const sobrou = ARQS.filter(a => rx.test(ler(a)));
  b.igual(sobrou.length, 0, "sem referência antiga a " + nome, sobrou.join(", "));
});

b.passo("5. E OS NOMES GUARDADOS COMO STRING — o que renomear não alcança");
/* Dois arquivos conferem funções pelo NOME, procurando no escopo global. Se a
   string ficar para trás, o diagnóstico passa a dizer "função não encontrada"
   sobre função que está lá — e o erro aponta para o lugar errado. */
const diag = ler("OficiosDiagnostico.gs");
const parque = ler("Reservaparquechina.gs");
[["OficiosDiagnostico.gs", diag, "gerarProximoNumeroSeguro_"],
 ["OficiosDiagnostico.gs", diag, "montarEmailHTML_"],
 ["Reservaparquechina.gs", parque, "gerarProximoNumeroSeguro_"],
 ["Reservaparquechina.gs", parque, "preverProximoNumeroOficio_"]
].forEach(function (t) {
  b.ok(t[1].indexOf('"' + t[2] + '"') >= 0,
    t[0] + " guarda o nome novo: " + t[2]);
});

b.passo("6. e a conferência de dependências do Parque do China ainda fecha");
/* Ela lista as funções de ofício de que depende e reporta as que faltam. Com
   uma string desatualizada, reportaria falta de função que existe. */
const listadas = (parque.match(/"[a-zA-Z_][a-zA-Z0-9_]*"/g) || [])
  .map(s => s.slice(1, -1));
["gerarProximoNumeroSeguro_", "preverProximoNumeroOficio_"].forEach(function (n) {
  b.ok(listadas.indexOf(n) >= 0 && typeof g[n] === "function",
    "está na lista E existe no escopo: " + n);
});

b.fluxo("MÓDULO 03 · a rota pública que FICA pública");

b.passo("7. validarPublico continua aberta — é o desenho, não um esquecimento");
/* A escola que recebeu o ofício confere ali se ele é autêntico, sem login:
   quem valida está fora do sindicato. */
b.ok(typeof g.validarPublico === "function",
  "validarPublico continua sendo endpoint");
const code = ler("Code.gs");
b.ok(/validarPublico\(/.test(code),
  "e o Code.gs continua servindo a rota que a usa");

b.passo("8. mas ela só responde a quem JÁ tem o código do ofício");
/* O ponto: rota pública que devolve UM registro pelo código é diferente de
   rota pública que LISTA. Esta não lista, não busca por escola, não aceita
   parcial. */
const semCodigo = tentar(() => g.validarPublico(""));
b.ok(semCodigo.passou, "responde sem quebrar quando o código vem vazio");
b.ok(!/SindEduca|CNPJ|@/.test(String(semCodigo.valor || "").replace(/SISGEP/g, "")) ||
     /inv[áa]lido|n[ãa]o encontrado|nenhum/i.test(String(semCodigo.valor || "")),
  "e não devolve cadastro nenhum para código vazio");

b.fluxo("MÓDULO 03 · as TRÊS que ficam públicas de propósito");

b.passo("9. os handlers de gatilho continuam alcançáveis pelo nome");
/* Privadas elas não podem ser: o Apps Script chama o handler PELO NOME. */
["processarFilaEnvioOficios", "verificarConfirmacoesRecebimento",
 "verificarFalhasEntregaOficios"].forEach(function (nome) {
  b.ok(typeof g[nome] === "function",
    "continua pública (é handler de gatilho): " + nome);
});

b.passo("10. E O QUE JUSTIFICA A DECISÃO — elas não devolvem dado de escola");
/* Se devolvessem, a conta mudaria e valeria pagar o risco de fechar. Não
   devolvem: só contadores. */
const fila = ler("FilaOficios.gs");
const mon  = ler("MonitoramentoOficios.gs");
b.ok(/processados:\s*0,\s*enviados:\s*0,\s*erros:\s*0/.test(fila),
  "processarFilaEnvioOficios devolve contadores");
b.ok(/verificados:\s*verificados/.test(mon),
  "verificarConfirmacoesRecebimento devolve contadores");
b.ok(/falhas:\s*totalFalhas/.test(mon),
  "verificarFalhasEntregaOficios devolve um contador");

b.passo("11. e a decisão está ESCRITA no arquivo, não só aqui");
/* Decisão de segurança que só vive no teste some na primeira leitura do
   código por outra pessoa. */
[["FilaOficios.gs", fila], ["MonitoramentoOficios.gs", mon]].forEach(function (t) {
  b.ok(/POR QUE ESTA FICA PUBLICA E SEM PORTA/.test(t[1]),
    t[0] + " explica por que o handler fica aberto");
});
b.ok(/getActiveUser/.test(fila),
  "e nomeia a razão técnica: o e-mail pode voltar vazio no gatilho");

b.fluxo("MÓDULO 03 · o diagnóstico que virou porta dupla");

b.passo("12. anônimo é barrado nas duas");
g.__usuarioAtivoEmail = "";
[["oficiosDiagnostico_diagnosticarModulo", () => g.oficiosDiagnostico_diagnosticarModulo("")],
 ["oficiosQueNaoChegaram", () => g.oficiosQueNaoChegaram("")]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(!r.passou, "anônimo não roda: " + par[0],
    r.passou ? "PASSOU — reconhecimento do sistema aberto" : r.msg.substring(0, 40));
});

b.passo("13. quem não é administrador também — a porta pede ADMIN");
/* Estas duas passam exigeAdmin=true. O Rogério é USUARIO comum, então para
   nele antes mesmo da checagem de módulo — e a mensagem tem que dizer isso,
   não falar de módulo. */
[["oficiosDiagnostico_diagnosticarModulo", () => g.oficiosDiagnostico_diagnosticarModulo(SEM_DOCS)],
 ["oficiosQueNaoChegaram", () => g.oficiosQueNaoChegaram(SEM_DOCS)]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(!r.passou && /administrador/i.test(r.msg),
    "usu\u00e1rio comum n\u00e3o roda: " + par[0],
    r.passou ? "PASSOU" : r.msg.substring(0, 44));
});

b.passo("13b. E A CHECAGEM DE MÓDULO, PROVADA à PARTE");
/* Sem este passo o teste anterior provaria só metade da porta: recusar
   usuário comum não prova que a exigência de "documentos" chegou a rodar.
   Aqui entra um ADMINISTRADOR de verdade que TEM módulos listados e
   documentos não está entre eles. */
(function () {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  const aba = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
  aba.getRange(5, 1, 1, 8).setValues([[
    "marcela", g.gerarHashSenha_("Senha@2026"), "Marcela",
    "marcela@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", "financeiro,rh"
  ]]);
  const ADMIN_SEM_DOCS = b.logar(g, "marcela");
  const r = tentar(() => g.oficiosQueNaoChegaram(ADMIN_SEM_DOCS));
  b.ok(!r.passou && /m\u00f3dulo|modulo/i.test(r.msg),
    "administrador SEM o m\u00f3dulo Documentos \u00e9 barrado pelo m\u00f3dulo",
    r.passou ? "PASSOU \u2014 a checagem de m\u00f3dulo n\u00e3o roda"
             : r.msg.substring(0, 52));
})();

b.passo("14. E A METADE QUE IMPORTA — o dono roda do editor, sem token");
/* Sem esta metade a correção viraria ferramenta inalcançável: são funções de
   diagnóstico, não têm tela, e o editor não passa token. */
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
[["oficiosDiagnostico_diagnosticarModulo", () => g.oficiosDiagnostico_diagnosticarModulo("")],
 ["oficiosQueNaoChegaram", () => g.oficiosQueNaoChegaram("")]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(r.passou || !/sess[ãa]o|permiss|administrador/i.test(r.msg),
    "o dono passa da porta: " + par[0], r.passou ? "rodou" : r.msg.substring(0, 40));
});
g.__usuarioAtivoEmail = "";

b.passo("15. e o administrador com o módulo também, pela sessão");
[["oficiosQueNaoChegaram", () => g.oficiosQueNaoChegaram(COM_DOCS)]
].forEach(function (par) {
  const r = tentar(par[1]);
  b.ok(r.passou || !/sess[ãa]o|permiss|administrador/i.test(r.msg),
    "passa da porta com sessão: " + par[0],
    r.passou ? "rodou" : r.msg.substring(0, 40));
});

b.naoTestavel(
  "se o Session.getActiveUser volta vazio num gatilho por tempo REAL",
  "é a premissa da decisão de não fechar os três handlers. O emulador não " +
  "reproduz contexto de gatilho do Apps Script. Se algum dia se provar que o " +
  "e-mail vem preenchido de forma confiável ali, a decisão se reabre e os " +
  "três ganham porta dupla"
);

b.resumo();
