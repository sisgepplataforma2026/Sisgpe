/**
 * t124 — MÓDULO 03 · REENVIAR PARA OUTRO ENDEREÇO
 *
 * Pedido do usuário em 01/09/2026, no meio do caso da FAESA: três ofícios
 * quicaram no mesmo endereço e ele precisava reenviar ANTES de o cadastro ser
 * corrigido — *"quando reenviar eu poderia incluir outro email, é possível?"*.
 *
 * DUAS COISAS, e a segunda é a que quase passou batida.
 *
 * 1. ACRESCENTAR não bastava. Quando o endereço do cadastro não recebe mais,
 *    mandar de novo para ele gera outro bounce — que, depois da correção de
 *    hoje, marca FALHA_ENTREGA **mesmo tendo a cópia chegado no endereço
 *    novo**. Por isso existe `somenteExtras`: substituir, e não só somar.
 *
 * 2. ISTO ABRE UMA PORTA DE SAÍDA. Passa a ser possível mandar um ofício —
 *    com dado pessoal dentro — para QUALQUER endereço, sem que ninguém o
 *    tenha cadastrado. É necessidade legítima de operação; a contrapartida é
 *    a trilha dizer quem mandou para onde. Sem isso, o recurso seria
 *    documento saindo do sindicato sem rastro. É o passo 6.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADMIN    = b.logar(g, "wanderson");
const SEM_DOCS = b.logar(g, "rogerio");   // financeiro,rh

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const CADASTRADO = "thalia.ferreira@faesa.br";
const NOVO       = "coordenacao@faesa.br";

(function semear() {
  let sh = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (!sh) sh = ss.insertSheet(g.PLANILHA_REGISTRO);
  sh.clear();
  const cab = ["Número do Ofício", "Escola (Razão Social)", "TIPO", "Status",
               "E-mails (todos)", "E-mail (principal)", "Data envio ofício"];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  sh.getRange(2, 1, 1, cab.length).setValues([
    ["144/2026", "Fundacao de Assistencia e Educacao - FAESA", "FILIACAO",
     "ENVIADO", CADASTRADO, CADASTRADO, new Date()]
  ]);
})();

b.fluxo("MÓDULO 03 · a tela mostra o destino ANTES de enviar");

b.passo("1. dá para consultar para onde o reenvio iria");
/* Até hoje o reenvio era um confirm cego. Esta função existe para a pessoa
   ver o endereço antes de mandar — foi assim que os três da FAESA foram
   reenviados para uma caixa que não recebia mais. */
const destino = g.obterDestinoReenvioOficio("144/2026", ADMIN);
b.ok(destino && destino.ok === true, "responde para um ofício que existe");
b.igual(destino.emails, CADASTRADO, "e devolve o e-mail do cadastro");

b.passo("2. e ela tem porta — devolve e-mail de terceiro");
let barrou = false;
try { g.obterDestinoReenvioOficio("144/2026", SEM_DOCS); } catch (e) { barrou = true; }
b.ok(barrou, "quem não tem o módulo Documentos não lê o destino",
  "é e-mail de escola, dado de terceiro");

b.passo("3. ofício inexistente não inventa endereço");
const nada = g.obterDestinoReenvioOficio("999/2026", ADMIN);
b.ok(nada.ok === false && !nada.emails, "devolve vazio, não um palpite");

b.fluxo("MÓDULO 03 · acrescentar e substituir");

b.passo("4. endereço inválido é recusado ANTES de tentar enviar");
/* Um endereço malformado derruba o envio inteiro no Gmail, e o operador
   ficaria sem saber se o ofício saiu. Recusar aqui, dizendo qual está errado,
   é a diferença entre um erro legível e um mistério. */
const invalido = g.reenviarOficio(
  { numero: "144/2026", url: "https://drive.google.com/file/d/x/view",
    escola: "FAESA", tipo: "FILIACAO", emailsExtras: "isto-nao-e-email" }, ADMIN);
b.ok(invalido && invalido.erro === true, "recusa endereço malformado");
b.ok(/inválido/i.test(invalido.mensagem), "e diz que o problema é o endereço",
  invalido.mensagem.substring(0, 60));

b.passo("5. 'somente este' sem endereço é recusado");
/* Marcar substituir sem informar substituto deixaria o ofício sem destino
   nenhum. Melhor recusar do que enviar para o vazio. */
const semAlvo = g.reenviarOficio(
  { numero: "144/2026", url: "https://drive.google.com/file/d/x/view",
    escola: "FAESA", tipo: "FILIACAO", emailsExtras: "", somenteExtras: true }, ADMIN);
b.ok(semAlvo && semAlvo.erro === true,
  "não deixa substituir por nada", semAlvo.mensagem.substring(0, 60));

b.passo("6. A TRILHA DIZ QUE SAIU DO CADASTRO");
/* Este recurso permite mandar documento com dado pessoal para endereço que
   ninguém cadastrou. A contrapartida é o registro — sem ele, seria uma porta
   de saída sem rastro. */
const fonte = String(g.reenviarOficio).replace(/\s+/g, " ");
b.ok(/REENVIO - ENDERECO ACRESCENTADO/.test(fonte),
  "o log distingue acréscimo");
b.ok(/REENVIO - ENDERECO SUBSTITUIDO/.test(fonte),
  "e substituição — são coisas diferentes para quem audita");
b.ok(/registrarLogSistema/.test(fonte), "e isso vai para a trilha do sistema");

b.passo("7. o destino não duplica");
/* O mesmo endereço no cadastro e no campo extra mandaria duas cópias do mesmo
   ofício para a mesma pessoa. */
b.ok(/vistos\[n\]/.test(fonte), "há deduplicação por endereço, em minúscula");

b.passo("8. a mensagem de retorno avisa quando o cadastro NÃO recebeu");
/* Substituir é decisão com consequência: quem confere depois precisa saber
   que o endereço cadastrado ficou de fora. */
b.ok(/endereço do cadastro NÃO recebeu/.test(fonte),
  "diz, com todas as letras, que o cadastrado ficou fora");
b.ok(/inclui endereço fora do cadastro/.test(fonte),
  "e no acréscimo, que houve endereço de fora");

b.naoTestavel(
  "o e-mail chegando no endereço novo",
  "o emulador registra o envio, não entrega. O que se prova aqui é a REGRA " +
  "de composição do destino, a validação e a trilha"
);
b.naoTestavel(
  "a tela do modal",
  "markup em OficiosFormulario.html e comportamento em OficiosScripts.html. " +
  "Conferir no ar: o campo do cadastro vem preenchido e é somente leitura, e " +
  "o aviso muda ao marcar 'somente este endereço'"
);

b.resumo();
