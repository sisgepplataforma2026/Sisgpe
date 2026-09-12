/**
 * t120 — MÓDULO 03 · AS PORTAS QUE NINGUÉM TINHA TESTADO
 *
 * Frente A da auditoria do Módulo 03, 01/09/2026.
 *
 * A MEDIÇÃO QUE ORIGINOU ISTO
 *
 * O módulo tem 59 funções públicas e 609 asserções já existentes — é o mais
 * testado do sistema, o que faz sentido por ser o único em uso diário.
 * Cruzando uma coisa com a outra: **47 das 59 nunca são citadas pelo nome em
 * teste nenhum**. Os testes exercitam o módulo por dentro; os pontos de
 * ENTRADA, que é por onde o `google.script.run` chega, ficaram de fora.
 *
 * Citar não é o mesmo que exercitar, e nem toda função precisa de teste. Mas
 * três grupos precisam, e é o que este arquivo cobre:
 *
 * 1. AS QUE APAGAM. `excluirRegistroOficio` e `excluirRegistrosOficio` somem
 *    com registro de ofício em três abas. Hoje ambas exigem admin do módulo
 *    Documentos — e é justamente isso que não estava travado por teste. Um
 *    refactor que troque `exigirModulo_(t,"documentos",true)` por `false`, ou
 *    que mova a chamada para dentro do try, passa despercebido.
 *
 * 2. A ROTA PÚBLICA. A validação que a escola faz com o código impresso no
 *    ofício não tem sessão — de propósito: quem valida está FORA do sindicato.
 *    Sem sessão, o que ela devolve é a superfície: número, tipo, ESCOLA, data e
 *    o link do PDF no Drive. O que este teste guarda é que só devolve com o
 *    código certo, e que errar o código não vaza nada.
 *
 *    CORREÇÃO DE 01/09/2026: este cabeçalho dizia que o
 *    `verificarCodigoPublico` era a rota. Não era — a rota que o Code.gs serve
 *    é o `validarPublico`, e o `verificarCodigoPublico` era um SEGUNDO caminho
 *    para o mesmo dado, alcançável por qualquer página do projeto e por
 *    nenhuma tela. Virou privado (t127). O teste abaixo continua valendo
 *    inteiro: chama o helper direto, que é onde a regra mora.
 *
 *    (Força bruta foi descartada por medição, não por suposição: o código é
 *    MD5 truncado em 12 hex — 48 bits. Enumerar por HTTP é inviável.)
 *
 * 3. A NUMERAÇÃO. `preverProximoNumeroOficio_` diz à tela qual será o próximo
 *    número. Se ela ignorar a sequência já reservada, duas pessoas emitindo
 *    no mesmo dia veem o mesmo número — e ofício com número repetido é
 *    problema que sai do sindicato em papel timbrado.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADMIN = b.logar(g, "wanderson");      // todos os módulos
const SEM_DOCS = b.logar(g, "rogerio");     // financeiro,rh — não tem documentos

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const ANO = new Date().getFullYear();

function semearRegistro() {
  let sh = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (!sh) sh = ss.insertSheet(g.PLANILHA_REGISTRO);
  sh.clear();
  const cab = ["Número do Ofício", "Escola (Razão Social)", "TIPO", "Status",
               "CONFIG", "Data envio ofício", "Link PDF (Drive)"];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  sh.getRange(2, 1, 2, cab.length).setValues([
    ["040/" + ANO, "Escola Alfa", "FILIACAO", "ENVIADO",
     "A1B2C3D4E5F6", new Date(), "https://drive.google.com/file/d/xyz/view"],
    ["041/" + ANO, "Escola Beta", "FILIACAO", "ENVIADO",
     "0F1E2D3C4B5A", new Date(), "https://drive.google.com/file/d/abc/view"]
  ]);
  return sh;
}
semearRegistro();

b.fluxo("MÓDULO 03 · quem pode APAGAR um ofício");

b.passo("1. quem não tem o módulo Documentos não apaga");
/* A trava existe hoje. O que faltava era o teste que impede alguém de
   afrouxá-la sem perceber — trocar o `true` por `false`, ou mover a chamada
   para dentro do try, passaria batido numa revisão. */
let barrou = false, msg = "";
try { g.excluirRegistroOficio("040/" + ANO, SEM_DOCS); }
catch (e) { barrou = true; msg = String(e.message || e); }
b.ok(barrou, "excluirRegistroOficio recusa quem não tem 'documentos'",
  barrou ? msg.substring(0, 60) : "APAGOU — porta aberta para apagar ofício");

b.passo("2. e a versão em lote também");
/* A de lote é a mais perigosa das duas: apaga vários de uma vez. */
let barrouLote = false;
try { g.excluirRegistrosOficio(["040/" + ANO, "041/" + ANO], SEM_DOCS); }
catch (e) { barrouLote = true; }
b.ok(barrouLote, "excluirRegistrosOficio também recusa",
  "é a mais perigosa: leva vários registros numa chamada");

b.passo("3. sem token nenhum, idem");
let barrouSemToken = false;
try { g.excluirRegistroOficio("040/" + ANO, ""); } catch (e) { barrouSemToken = true; }
b.ok(barrouSemToken, "sem sessão não apaga");

b.passo("4. O OUTRO LADO — o administrador continua conseguindo");
/* Fechar sem esta metade trocaria um defeito de segurança por um de
   utilidade, e ninguém descobriria até precisar apagar um ofício errado. */
const rAdmin = g.excluirRegistroOficio("040/" + ANO, ADMIN);
b.ok(rAdmin && rAdmin.ok !== false,
  "o admin de Documentos apaga normalmente",
  JSON.stringify(rAdmin).substring(0, 70));

const restou = ss.getSheetByName(g.PLANILHA_REGISTRO)
  .getRange(2, 1, 2, 1).getValues().map(r => String(r[0] || "")).filter(Boolean);
b.ok(restou.indexOf("040/" + ANO) === -1, "o registro saiu do Controle", restou.join(", "));
b.ok(restou.indexOf("041/" + ANO) >= 0,
  "e o ofício vizinho NÃO foi levado junto",
  "apagar o certo é metade; não apagar o outro é a metade que ninguém confere");

b.fluxo("MÓDULO 03 · a rota pública de validação");

semearRegistro();

b.passo("5. o código certo devolve o ofício");
const ok = g.verificarCodigoPublico_("A1B2C3D4E5F6");
b.igual(ok.status, "VALIDO", "código correto valida");
b.igual(ok.numero, "040/" + ANO, "e devolve o número do ofício");
b.igual(ok.escola, "Escola Alfa", "e a escola — é o que a validação precisa mostrar");

b.passo("6. minúscula e espaço não quebram — quem digita do papel erra assim");
const ok2 = g.verificarCodigoPublico_("  a1b2c3d4e5f6  ");
b.igual(ok2.status, "VALIDO",
  "o código é normalizado antes de comparar",
  "quem valida está copiando de um PDF impresso");

b.passo("7. CÓDIGO ERRADO NÃO VAZA NADA");
/* A rota não tem sessão, então o que ela devolve numa falha é o que qualquer
   pessoa da internet consegue. Tem de ser só a recusa. */
const nao = g.verificarCodigoPublico_("FFFFFFFFFFFF");
b.igual(nao.status, "INVALIDO", "código inexistente é recusado");
const texto = JSON.stringify(nao);
["Escola Alfa", "Escola Beta", "040/", "041/", "drive.google.com"].forEach(function (t) {
  b.ok(texto.indexOf(t) === -1, "a recusa não vaza: " + t,
    texto.indexOf(t) >= 0 ? "VAZOU na resposta pública" : "contido");
});

b.passo("8. código vazio também");
b.igual(g.verificarCodigoPublico_("").status, "INVALIDO", "vazio não valida nada");
b.igual(g.verificarCodigoPublico_(null).status, "INVALIDO", "nulo também não");

b.fluxo("MÓDULO 03 · o próximo número do ofício");

b.passo("9. prevê a partir do maior número do ano");
semearRegistro();
const prox = g.preverProximoNumeroOficio_();
b.ok(/^\d+\/\d{4}$/.test(String(prox)) || /^\d+$/.test(String(prox)),
  "devolve um número no formato esperado", String(prox));
b.ok(String(prox).indexOf("42") >= 0,
  "e é 42 — o seguinte ao 041 que está na base",
  String(prox));

b.passo("10. A SEQUÊNCIA RESERVADA MANDA — é o que evita número repetido");
/* Quando alguém já reservou um número mas o ofício ainda não foi gravado, o
   maior da planilha está DESATUALIZADO. Ignorar a reserva faria a tela
   oferecer um número já tomado — e ofício com número repetido sai do
   sindicato em papel timbrado. */
const ambiente = (typeof g.getAmbienteAtual === "function")
  ? String(g.getAmbienteAtual() || "producao").toUpperCase() : "PRODUCAO";
g.PropertiesService.getScriptProperties()
  .setProperty("SISGEP_OFICIO_SEQ_" + ambiente + "_" + ANO, "99");

const proxReservado = g.preverProximoNumeroOficio_();
b.ok(String(proxReservado).indexOf("100") >= 0,
  "com 99 reservado, a previsão pula para 100",
  "previsto: " + proxReservado + " — ignorar a reserva daria 42, um número já tomado"
);

b.naoTestavel(
  "duas emissões simultâneas de verdade",
  "o emulador é de execução única; concorrência real depende do LockService " +
  "do Apps Script. O que se prova aqui é que a PREVISÃO respeita a reserva — " +
  "a trava da gravação é outro caminho (gerarProximoNumeroSeguro_)"
);
b.naoTestavel(
  "as outras 44 funções públicas sem teste",
  "esta rodada cobriu as de maior risco: as duas que apagam, a rota pública " +
  "sem sessão e a numeração. Ficam sem teste os dashboards, os relatórios, os " +
  "seis instaladores de gatilho e os diagnósticos — menor risco, mas o item " +
  "47 registra que a frente A não terminou"
);

b.resumo();
