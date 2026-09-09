/**
 * TESTE — A ENTREGA DA FESTA É PELO WHATSAPP, E NADA SAI SOZINHO
 *
 * O QUE ORIGINOU, 09/09/2026. Conversa com o usuário enquanto preparávamos a
 * abertura das inscrições. Três frases dele, nesta ordem:
 *
 *   "não é enviado nada sozinho"
 *   "os ingressos serão enviados pelo zap / somente por esse caminho"
 *   "o comprovante de inscrição também sai do e-mail? Não"
 *
 * E o código fazia o contrário: `compasso_inscrever` disparava um e-mail de
 * comprovante na hora de gravar, sem ninguém apertar nada. Abrir para 2.000
 * pessoas assim produziria 2.000 e-mails que ele não esperava.
 *
 * POR QUE INTERRUPTOR E NÃO `return` CRAVADO. Mesma lição da data de abertura,
 * de quatro dias antes: decisão de operação não pode custar uma publicação.
 * Se a conta virar Workspace, ou se aparecer associado sem WhatsApp, quem
 * decide é quem opera.
 *
 * O PADRÃO É DESLIGADO — ausente a propriedade, nada sai.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: o emulador não entrega e-mail nem abre o
 * WhatsApp. Ele prova a REGRA — quem recusa, quem passa, e o que fica gravado.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const props = g.PropertiesService.getScriptProperties();
const PROP = g.COMPASSO_PROP_EMAIL_INGRESSO;
const PROP_COMP = g.COMPASSO_PROP_EMAIL_COMPROVANTE;
const PROP_ANTIGA = g.COMPASSO_PROP_EMAIL_LIGADO;

function limparProps() {
  [PROP, PROP_COMP, PROP_ANTIGA].forEach(k => props.setProperty(k, ""));
}

fluxo("FESTA · duas decisões, dois interruptores");
passo("os padrões seguem a operação");

/* CORRIGIDO EM 09/09/2026, DEPOIS DE RODAR NO AR.
   Este teste nasceu de manhã afirmando que o comprovante nascia LIGADO, porque
   eu tinha lido o "É UMA MENSAGEM E DEVE sair" do usuário como "deve sair por
   e-mail". Duas coisas derrubaram isso no mesmo dia: o envio falhou de verdade
   na homologação ("Service invoked too many times for one day: gmail"), e ele
   foi direto — "tira esse comprovante, todos os ingressos são solicitados pelo
   zap e enviados".

   O "DEVE sair" continua cumprido, e melhor: o PROTOCOLO aparece na tela de
   inscrição, na hora, sem depender de cota nem de a pessoa ter e-mail (t153).

   Os dois interruptores continuam separados — é o que permite religar só um. */
limparProps();
igual(g.compasso_emailComprovanteLigado_(), false,
      "o COMPROVANTE nasce DESLIGADO",
      "nada desta festa sai por e-mail; a pessoa leva o protocolo da tela");
igual(g.compasso_emailIngressoLigado_(), false,
      "o INGRESSO nasce DESLIGADO",
      "a entrega da festa é pelo WhatsApp, aos poucos, a partir de novembro");

passo("cada um obedece só ao seu");

props.setProperty(PROP_COMP, "true");
igual(g.compasso_emailComprovanteLigado_(), true, "religar o comprovante funciona");
igual(g.compasso_emailIngressoLigado_(), false, "e não liga o ingresso por tabela");

limparProps();
props.setProperty(PROP, "true");
igual(g.compasso_emailIngressoLigado_(), true, "ligar o ingresso funciona");
igual(g.compasso_emailComprovanteLigado_(), false, "e o comprovante segue desligado");

passo("a chave única antiga ainda vale, para os dois");

/* Ela existiu por algumas horas hoje. Se alguém a declarou no ambiente, tem
   de continuar valendo — senão o comportamento muda sem ninguém mexer. */
limparProps();
props.setProperty(PROP_ANTIGA, "true");
igual(g.compasso_emailComprovanteLigado_(), true, "a chave antiga liga o comprovante");
igual(g.compasso_emailIngressoLigado_(), true, "e o ingresso");

limparProps();
props.setProperty(PROP_ANTIGA, "false");
igual(g.compasso_emailIngressoLigado_(), false, "e desliga os dois quando false");
igual(g.compasso_emailComprovanteLigado_(), false, "  os dois mesmo");

passo("valor estranho cai no padrão de cada um");

limparProps();
["nao", "0", "qualquer coisa"].forEach(v => {
  props.setProperty(PROP, v);
  props.setProperty(PROP_COMP, v);
  igual(g.compasso_emailIngressoLigado_(), false, 'ingresso: "' + v + '" → desligado');
  igual(g.compasso_emailComprovanteLigado_(), false, 'comprovante: "' + v + '" → desligado');
});
limparProps();

fluxo("FESTA · a entrega por e-mail recusa, e explica o que fazer");
passo("individual");

limparProps();
const um = g.compasso_enviarIngressoEmail("qualquer-id", TOKEN);
igual(um.ok, false, "o envio individual por e-mail é recusado");
igual(um.codigo, "ENTREGA_SOMENTE_WHATSAPP", "com código nomeado, não erro genérico");
ok(String(um.erro).indexOf("WhatsApp") > -1,
   "e a mensagem diz por onde é a entrega",
   "recusa que não diz o caminho vira chamado para o suporte");
ok(String(um.erro).indexOf("COMPASSO_EMAIL_INGRESSO") > -1,
   "e nomeia a propriedade que reabre, se for mesmo necessário");

passo("lote");

const lote = g.compasso_enviarLoteEmail(["a", "b", "c"], TOKEN);
igual(lote.ok, false, "o lote por e-mail também é recusado");
igual(lote.codigo, "ENTREGA_SOMENTE_WHATSAPP", "mesmo código");

passo("a recusa acontece ANTES de qualquer leitura");

/* A recusa vem antes de procurar a inscrição: um id inexistente devolve a
   recusa de política, não "inscrição não encontrada". Assim a decisão fica
   visível mesmo quando o resto do caminho falharia por outro motivo. */
ok(String(um.erro).indexOf("não encontrada") === -1,
   "id inexistente devolve a recusa de política, não erro de dado");

fluxo("FESTA · religar é possível, e é ato explícito");
passo("com a propriedade em true, o caminho volta");

props.setProperty(PROP, "true");
/* Religado, a função segue para o Firestore — que o emulador não tem. O que
   importa aqui não é o resultado, e sim que ela DEIXOU de recusar por
   política: seguir adiante já prova que o interruptor abriu o caminho. */
let religado, seguiuAdiante = false;
try {
  religado = g.compasso_enviarIngressoEmail("id-que-nao-existe", TOKEN);
  seguiuAdiante = !religado || religado.codigo !== "ENTREGA_SOMENTE_WHATSAPP";
} catch (e) {
  seguiuAdiante = String(e.message || e).indexOf("ENTREGA_SOMENTE_WHATSAPP") < 0;
}
ok(seguiuAdiante,
   "ligado, a função volta a percorrer o caminho normal",
   "para de recusar pela política e passa a depender do dado");

fluxo("FESTA · o comprovante não sai, mas o protocolo fica");
passo("desligado");

limparProps();
props.setProperty(PROP_COMP, "false");
const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EventosInscricaoPublica.gs"), "utf8");
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

ok(semComentarios.indexOf("EMAIL_DESLIGADO") > -1,
   "o comprovante tem um caminho de saída quando o e-mail está desligado");
/* Mede o COMPORTAMENTO, não o nome da variável. A asserção anterior casava
   com `protocoloSemEnvio` literal e quebrou quando a variável passou a se
   chamar `protocolo` — sem que nada do comportamento mudasse. Teste que
   depende de nome de variável reprova refatoração e não pega defeito. */
ok(/compasso_carimbarConfirmacao_\([\s\S]{0,200}protocolo[\s\S]{0,40}\)/.test(semComentarios),
   "e ele CARIMBA o protocolo mesmo sem enviar",
   "sem o carimbo a equipe perderia a lista de quem ainda não recebeu aviso nenhum");
ok(semComentarios.indexOf("compasso_emailComprovanteLigado_()") > -1,
   "o comprovante usa o interruptor DELE",
   "amarrado ao do ingresso, desligar a entrega calaria a confirmação junto");

passo("a ordem importa");

/* O carimbo tem de vir ANTES do `return`, senão a inscrição fica sem protocolo
   e sem rastro — invisível para quem for trabalhar a fila do zap. */
const trecho = semComentarios.slice(
  semComentarios.indexOf("function compasso_confirmarInscricaoPorEmail_"));
ok(trecho.indexOf("compasso_carimbarConfirmacao_") <
   trecho.indexOf("motivo: 'EMAIL_DESLIGADO'"),
   "carimba antes de devolver",
   "invertido, a inscrição sairia sem protocolo gravado");

fluxo("FESTA · o caminho do WhatsApp continua inteiro");
passo("nada foi apagado");

ok(typeof g.compasso_prepararIngressoWhatsApp === "function",
   "preparar o WhatsApp continua existindo");
ok(typeof g.compasso_confirmarEnvioWhatsApp === "function",
   "e confirmar o envio também",
   "o sistema não sabe se a pessoa apertou enviar — quem confirma é ela");
ok(typeof g.compasso_enviarIngressoEmail === "function",
   "e o e-mail NÃO foi apagado, só desligado",
   "apagar jogaria fora a única saída para quem não tem WhatsApp");

limparProps();

naoTestavel("se a mensagem chega de fato no WhatsApp",
  "o wa.me abre o aplicativo e quem aperta enviar é gente. O emulador não " +
  "abre janela nenhuma — só o uso responde.");

resumo();
