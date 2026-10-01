/**
 * t122 — MÓDULO 03 · "OUTLOOK" CONTÉM "OK"
 *
 * O achado mais grave do módulo, e ele veio de puxar um fio de três bounces
 * reais. Vale contar a cadeia inteira, porque nenhum passo dela dá erro.
 *
 * 01/09/2026. Instalado o gatilho de falhas de entrega na homologação, ele
 * achou três bounces — ofícios 144, 236 e 242, todos para o MESMO endereço,
 * `thalia.ferreira@faesa.br`. Rodando o mesmo verificador na PRODUÇÃO: nada.
 * Zero. E a planilha de produção explicou por quê: o ofício 144 estava com
 * status **CONFIRMADO**.
 *
 * Confirmado por quem?
 *
 * A confirmação é automática, decidida por palavra-chave com `indexOf` — que
 * casa PEDAÇO de palavra, não palavra. Medido contra texto real:
 *
 *   "Enviado do meu Outl(ok)"                  → confirmava
 *   "Sent from Outl(ok) for iOS"               → confirmava
 *   "Não pode ser entregue. T(ok)en inválido." → confirmava
 *   "Estou de férias. Obrigado pelo contato."  → confirmava
 *
 * E a busca no Gmail já era larga: procura pelo número do ofício OU PELO NOME
 * DA ESCOLA. Somando as duas coisas, qualquer conversa com a FAESA em que
 * aparecesse a assinatura "Outlook" confirmava o ofício.
 *
 * A CADEIA COMPLETA, e nenhum passo dela reclama:
 *
 *   1. o ofício sai para um endereço que não existe mais
 *   2. quica
 *   3. alguma mensagem da thread menciona a escola e traz "Outlook"
 *   4. → marcado CONFIRMADO
 *   5. o verificador de bounce só olha ENVIADO e PENDENTE → pula para sempre
 *   6. a Home mostra tudo verde
 *
 * O ofício que mais claramente NÃO chegou era justamente o que ficava marcado
 * como recebido, e depois disso nenhuma rotina voltava a olhá-lo.
 *
 * AS TRÊS CORREÇÕES, e o que cada uma guarda aqui:
 *   1. "ok" só como palavra inteira
 *   2. remetente automático não confirma
 *   3. o bounce volta a olhar o que foi confirmado AUTOMATICAMENTE —
 *      e nunca o que uma pessoa confirmou
 */

const b = require("./base");
const { g } = b.subir({});

b.fluxo("MÓDULO 03 · o que conta como confirmação de recebimento");

b.passo("1. O DEFEITO QUE ORIGINOU TUDO — 'Outlook' não confirma mais nada");
/* Se esta asserção cair, ofícios voltam a ser dados como recebidos por causa
   da assinatura do cliente de e-mail de quem respondeu. */
[
  ["Enviado do meu Outlook",                      "assinatura de cliente de e-mail"],
  ["Sent from Outlook for iOS",                   "idem, em inglês"],
  ["A mensagem nao pode ser entregue. Token invalido.", "'token' também tem 'ok'"],
  ["Bloqueado pelo servidor",                     "texto de recusa"]
].forEach(function (par) {
  b.ok(
    g.MON_OFICIOS_textoConfirmaRecebimento_(par[0]) === false,
    "NÃO confirma: " + JSON.stringify(par[0]),
    par[1]
  );
});

b.passo("2. mas 'ok' de verdade continua confirmando");
/* A metade que impede a correção de virar defeito de utilidade: quem responde
   "ok" está confirmando, e o sistema tem de entender. */
["ok", "OK", "Ok, recebido", "tudo ok por aqui", "ok."].forEach(function (t) {
  b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(t) === true,
    "confirma: " + JSON.stringify(t));
});

b.passo("3. e as outras palavras seguem valendo");
["Recebido, obrigado", "Confirmamos o recebimento", "Estamos cientes",
 "Acusamos recebimento"].forEach(function (t) {
  b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(t) === true, "confirma: " + t);
});

b.passo("4. texto neutro não confirma");
["Segue em anexo o documento solicitado",
 "Prezados, boa tarde",
 ""].forEach(function (t) {
  b.ok(g.MON_OFICIOS_textoConfirmaRecebimento_(t) === false,
    "não confirma: " + JSON.stringify(t));
});

b.fluxo("MÓDULO 03 · robô não confirma ofício");

b.passo("5. remetentes automáticos são ignorados");
/* Antes só financeiro@ e secretaria@ eram excluídos. O aviso de que a
   mensagem NÃO foi entregue vem de mailer-daemon — e não estava na lista. */
["mailer-daemon@googlemail.com", "postmaster@faesa.br",
 "no-reply@sistema.com", "noreply@x.com", "nao-responda@y.com.br",
 "notifications@github.com"].forEach(function (f) {
  b.ok(g.MON_OFICIOS_ehRemetenteAutomatico_(f) === true, "é robô: " + f);
});

b.passo("6. pessoa de verdade continua passando");
["thalia.ferreira@faesa.br", "diretoria@escola.com.br",
 "contato@multivix.edu.br"].forEach(function (f) {
  b.ok(g.MON_OFICIOS_ehRemetenteAutomatico_(f) === false, "é gente: " + f);
});

b.fluxo("MÓDULO 03 · o bounce volta a olhar o confirmado AUTOMÁTICO");

b.passo("7. a regra está no código, e distingue as duas confirmações");
/* Esta é a correção que resgata os 144, 236 e 242 sem desfazer o que uma
   pessoa confirmou. O sistema já grava a origem na observação — é o que
   permite separar uma coisa da outra. */
const fonte = String(g.verificarFalhasEntregaOficios).replace(/\s+/g, " ");
b.ok(
  fonte.indexOf('!== "CONFIRMADO") continue') >= 0,
  "o filtro deixou de descartar todo CONFIRMADO"
);
/* Casa por "localizada automaticamente" e não pela frase inteira: no código a
   regex escreve o "ç" e o "ã" como escapes (`[\u00e7c][\u00e3a]`), então a
   frase literal não existe no fonte stringificado. Medir pelo pedaço estável
   é o que faz esta asserção significar alguma coisa. */
b.ok(
  /localizada automaticamente/i.test(fonte),
  "e só reabre os que trazem 'confirmação localizada automaticamente'",
  "confirmação humana fica intocada: a pessoa viu a resposta"
);

b.passo("8. e a observação que o sistema grava casa com esse teste");
/* Se o texto gravado mudar e o teste do filtro não mudar junto, a correção
   volta a não pegar nada — sem falhar em lugar nenhum. É o tipo de erro que
   este passo existe para impedir. */
const arq = require("fs").readFileSync(
  require("path").join(require("./dom").RAIZ, "MonitoramentoOficios.gs"), "utf8");
b.ok(
  arq.indexOf("Confirmação localizada automaticamente no Gmail.") >= 0,
  "o texto gravado ao confirmar automaticamente continua o mesmo",
  "é a chave que liga a gravação ao filtro"
);

b.naoTestavel(
  "reprocessar os ofícios 144, 236 e 242 na produção",
  "a correção faz o verificador voltar a olhá-los, mas quem roda é o gatilho " +
  "de 3 em 3 horas, na produção, que ainda não recebeu este código. Conferir " +
  "o status deles depois de levar a correção para lá"
);
b.naoTestavel(
  "se 'obrigado' devia sair da lista",
  "ficou de propósito: muita gente responde 'obrigado, recebido', e tirá-lo " +
  "faria o sistema deixar de reconhecer confirmação legítima. É decisão de " +
  "operação, e está registrada como escolha no cabeçalho do arquivo"
);

b.resumo();
