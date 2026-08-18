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

/* ═══════════════════════════════════════════════════════════
   5. O retorno do PREPARO tem que serializar
   ═══════════════════════════════════════════════════════════

   Segundo relato, mais preciso: "O servidor não respondeu nada ao preparar o
   envio de BOLSA-2026-916155" — e o modal FECHA.

   Essa frase é da própria tela, no ramo `!r`: o servidor devolveu NULL. Em
   google.script.run isso acontece quando algo no pacote de retorno não
   serializa — e o caso clássico é uma Date inválida, vinda de célula com
   conteúdo estranho. O sintoma engana: sem erro, sem log, sem nada. A tela
   recebe "nada", mostra a mensagem genérica e fecha.

   O preparo devolvia DUAS datas cruas: emitidoEm e o `quando` de cada envio
   do histórico. Agora saem como texto.
   ═══════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O preparo devolve pacote que atravessa para a tela");

/* Varre o objeto inteiro atrás de Date — o que google.script.run pode não
   conseguir mandar. Recursivo: uma data escondida dentro de envios[] quebra
   igual a uma no primeiro nível. */
function datasNoPacote(obj, caminho, achados) {
  caminho = caminho || "raiz"; achados = achados || [];
  if (obj === null || typeof obj !== "object") return achados;
  if (Object.prototype.toString.call(obj) === "[object Date]") {
    achados.push(caminho + (isNaN(obj.getTime()) ? " (Date INVÁLIDA)" : " (Date)"));
    return achados;
  }
  Object.keys(obj).forEach(function (k) {
    datasNoPacote(obj[k], caminho + "." + k, achados);
  });
  return achados;
}

b.passo("5");
/* Protocolo inexistente devolve ok:false — que também precisa serializar. */
const pacoteRecusa = g.voucherPrepararEnvio("NAO-EXISTE-1", tokenAdmin);
b.igual(datasNoPacote(pacoteRecusa), [],
  "o pacote de recusa não leva nenhum objeto Date");
b.ok(JSON.stringify(pacoteRecusa).length > 2,
  "e sobrevive a JSON.stringify, que é o que o Apps Script faz para mandar");

b.passo("6");
/* O conversor de data é o coração da correção: precisa aguentar Date válida,
   Date INVÁLIDA (a que derruba a serialização), texto e vazio. */
b.ok(typeof g.voucherDataTexto_ === "function",
  "existe um conversor de data para texto");
b.igual(typeof g.voucherDataTexto_(new Date(2026, 7, 18)), "string",
  "Date válida vira texto");
b.igual(g.voucherDataTexto_(new Date("banana")), "",
  "Date INVÁLIDA vira texto vazio, não derruba nada",
  "era o caso que fazia o servidor responder null sem dizer por quê");
b.igual(g.voucherDataTexto_(""), "", "vazio continua vazio");
b.igual(g.voucherDataTexto_("18/08/2026"), "18/08/2026", "texto passa direto");

b.passo("7");
/* Contraprova: o conversor não pode devolver "" para tudo — aí ele
   "resolveria" o problema apagando a informação. */
b.ok(g.voucherDataTexto_(new Date(2026, 7, 18)).indexOf("2026") > -1,
  "e a data válida sai LEGÍVEL, com o ano dentro",
  g.voucherDataTexto_(new Date(2026, 7, 18)));

b.passo("8");
/* Nenhuma Date pode ter sobrado no código do preparo. Sem comentários, pela
   lição do t56: asserção que lê comentário mede documentação. */
const fonteEnvio = fs.readFileSync(path.join(__dirname, "..", "..", "VoucherEnvio.gs"), "utf8");
const preparo = fonteEnvio.slice(fonteEnvio.indexOf("function voucherPrepararEnvio"),
                                fonteEnvio.indexOf("function voucherEnviarPorEmail"));
const preparoLimpo = preparo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
b.ok(/emitidoEm:\s*voucherDataTexto_/.test(preparoLimpo),
  "emitidoEm sai pelo conversor, não cru");
b.ok(!/emitidoEm:\s*emissao\.DATA_EMISSAO/.test(preparoLimpo),
  "e a leitura crua da data de emissão não sobrou");

b.naoTestavel("Se ERA isto que derrubava o protocolo BOLSA-2026-916155",
  "o emulador serializa em JavaScript puro e não reproduz a serialização do Apps Script — só a próxima tentativa no ar diz");

b.resumo();
