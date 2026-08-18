/**
 * TESTE — O ENVIO DO VOUCHER DIZ O QUE DEU ERRADO
 *
 * O QUE ORIGINOU
 *
 * Relato do usuário em 18/08/2026: "o voucher não é enviado, dá erro de
 * servidor".
 *
 * "Erro de servidor" é a mensagem que o Apps Script mostra quando a função
 * do backend levanta uma exceção que ninguém capturou. Ela não diz nada:
 * pode ser sessão expirada, falta de acesso ao módulo, PDF que sumiu do
 * Drive, cota de e-mail estourada. Quem atende fica sem saber se reloga, se
 * chama o administrador ou se o problema é outro.
 *
 * Medindo o código, voucherEnviarPorEmail já devolvia mensagem legível para
 * tudo que acontecia DENTRO dela — o try/catch cobre o preparo, o anexo, o
 * MailApp e o registro. O único ponto que escapava era a guarda de sessão,
 * que ficava FORA do try. Qualquer recusa ali virava exceção crua.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Chama a função com token inválido, com token de quem não tem o módulo
 * Benefícios, e com protocolo inexistente — e confere que em nenhum desses
 * casos ela EXPLODE: todas devolvem { ok:false, mensagem } com texto que
 * explica o motivo.
 *
 * A contraprova está junto: recusar tem que continuar recusando. Nenhum
 * e-mail pode sair nesses casos.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: qual é a
 * causa do erro que o usuário viu no sistema no ar. Isto torna o erro
 * LEGÍVEL; a causa aparece na próxima tentativa dele, ou no painel de
 * Execuções do Apps Script.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;
const outbox = r.amb.outbox;

b.fluxo("VOUCHER · O erro de envio chega com nome");

b.seedUsuarios(g);
const tokenAdmin = b.logar(g, "wanderson");
/* rogerio tem MODULOS "financeiro,rh" — não tem benefícios. */
const tokenSemAcesso = b.logar(g, "rogerio");

function enviar(protocolo, token) {
  outbox.length = 0;
  try {
    return { retorno: g.voucherEnviarPorEmail(protocolo, { para: "x@y.com" }, token) };
  } catch (e) {
    return { explodiu: String(e && e.message || e) };
  }
}

/* ═══════════════════════════════════════════════════════════
   1. Token inválido: recusa com texto, não com explosão
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const semToken = enviar("PROTO-1", "token-que-nao-existe");
b.ok(!semToken.explodiu,
  "token inválido NÃO derruba a função",
  semToken.explodiu ? "explodiu: " + semToken.explodiu : "");
b.ok(semToken.retorno && semToken.retorno.ok === false,
  "devolve ok:false");
b.ok(semToken.retorno && String(semToken.retorno.mensagem || "").length > 10,
  "e uma mensagem que explica o motivo",
  semToken.retorno && semToken.retorno.mensagem);
b.igual(outbox.length, 0, "e NENHUM e-mail sai — recusar continua recusando");

/* ═══════════════════════════════════════════════════════════
   2. Usuário sem o módulo Benefícios
   ═══════════════════════════════════════════════════════════ */
b.passo("2");
const semModulo = enviar("PROTO-1", tokenSemAcesso);
b.ok(!semModulo.explodiu,
  "falta de acesso ao módulo NÃO derruba a função",
  semModulo.explodiu ? "explodiu: " + semModulo.explodiu : "");
b.ok(semModulo.retorno && semModulo.retorno.ok === false, "devolve ok:false");
b.ok(semModulo.retorno && /m(ó|o)dulo|acesso|administrador/i.test(String(semModulo.retorno.mensagem || "")),
  "e a mensagem fala de acesso ao módulo — quem lê sabe chamar o administrador",
  semModulo.retorno && semModulo.retorno.mensagem);
b.igual(outbox.length, 0, "e nenhum e-mail sai");

/* ═══════════════════════════════════════════════════════════
   3. Protocolo que não existe
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
const semProto = enviar("PROTOCOLO-INEXISTENTE-999", tokenAdmin);
b.ok(!semProto.explodiu,
  "protocolo inexistente NÃO derruba a função",
  semProto.explodiu ? "explodiu: " + semProto.explodiu : "");
b.ok(semProto.retorno && semProto.retorno.ok === false, "devolve ok:false");
b.ok(semProto.retorno && String(semProto.retorno.mensagem || "").length > 5,
  "com mensagem", semProto.retorno && semProto.retorno.mensagem);

/* ═══════════════════════════════════════════════════════════
   4. A guarda está DENTRO do try — a origem do erro genérico
   ═══════════════════════════════════════════════════════════

   Medido sobre o código sem comentários: uma asserção que lesse comentário
   mediria documentação, não comportamento. Aprendi isso hoje mesmo, com uma
   mutação que passou no t56 porque eu tinha citado o id dentro do
   comentário que explicava a correção.
   ═══════════════════════════════════════════════════════════ */
b.passo("4");
const fs = require("fs"), path = require("path");
const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "VoucherEnvio.gs"), "utf8");
const corpo = fonte.slice(fonte.indexOf("function voucherEnviarPorEmail"),
                          fonte.indexOf("function voucherRegistrarEnvio_"));
const semComentario = corpo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const posTry = semComentario.indexOf("try {");
const posGuarda = semComentario.indexOf("exigirModulo_");
b.ok(posTry > -1 && posGuarda > posTry,
  "a guarda de sessão fica DEPOIS do try, e não antes",
  "fora do try, a recusa vira 'erro de servidor' sem explicação");

b.naoTestavel("A causa do erro que o usuário viu no sistema no ar",
  "isto torna o erro legível; a causa aparece na próxima tentativa ou no painel de Execuções do Apps Script");

b.resumo();
