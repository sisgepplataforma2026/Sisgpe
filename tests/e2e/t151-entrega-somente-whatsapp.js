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
const PROP = g.COMPASSO_PROP_EMAIL_LIGADO;

fluxo("FESTA · o e-mail nasce desligado");
passo("o padrão");

props.setProperty(PROP, "");
igual(g.compasso_emailLigado_(), false,
      "sem a propriedade, o e-mail está DESLIGADO",
      "ausência não pode significar 'pode mandar' — nada sai sozinho");

["false", "FALSE", "nao", "0", "qualquer coisa"].forEach(v => {
  props.setProperty(PROP, v);
  igual(g.compasso_emailLigado_(), false, 'valor "' + v + '" mantém desligado');
});

props.setProperty(PROP, "true");
igual(g.compasso_emailLigado_(), true,
      'só o "true" explícito liga',
      "ligar é ato deliberado, com nome e valor");
props.setProperty(PROP, "TRUE");
igual(g.compasso_emailLigado_(), true, "maiúsculas também");

fluxo("FESTA · a entrega por e-mail recusa, e explica o que fazer");
passo("individual");

props.setProperty(PROP, "");
const um = g.compasso_enviarIngressoEmail("qualquer-id", TOKEN);
igual(um.ok, false, "o envio individual por e-mail é recusado");
igual(um.codigo, "ENTREGA_SOMENTE_WHATSAPP", "com código nomeado, não erro genérico");
ok(String(um.erro).indexOf("WhatsApp") > -1,
   "e a mensagem diz por onde é a entrega",
   "recusa que não diz o caminho vira chamado para o suporte");
ok(String(um.erro).indexOf("COMPASSO_EMAIL_LIGADO") > -1,
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

props.setProperty(PROP, "");
const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EventosInscricaoPublica.gs"), "utf8");
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

ok(semComentarios.indexOf("EMAIL_DESLIGADO") > -1,
   "o comprovante tem um caminho de saída quando o e-mail está desligado");
ok(/compasso_carimbarConfirmacao_\([\s\S]{0,200}protocoloSemEnvio/.test(semComentarios),
   "e ele CARIMBA o protocolo mesmo sem enviar",
   "sem o carimbo a equipe perderia a lista de quem ainda não recebeu aviso nenhum");
ok(semComentarios.indexOf("compasso_emailLigado_()") > -1,
   "usa o MESMO interruptor da entrega",
   "duas chaves para a mesma decisão divergem no primeiro ajuste");

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

props.setProperty(PROP, "");

naoTestavel("se a mensagem chega de fato no WhatsApp",
  "o wa.me abre o aplicativo e quem aperta enviar é gente. O emulador não " +
  "abre janela nenhuma — só o uso responde.");

resumo();
