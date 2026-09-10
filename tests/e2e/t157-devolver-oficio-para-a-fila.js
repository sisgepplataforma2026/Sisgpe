/**
 * TESTE — DEVOLVER UM OFÍCIO PARA A FILA TEM QUE FAZER ELE SAIR
 *
 * O QUE ORIGINOU, 10/09/2026. O usuário, olhando a planilha com os ofícios
 * 517, 518, 519 e 520 parados em ERRO_PERMANENTE desde a manhã:
 *
 *   "Vamos ajustar para o que os pendentes vão para o destinatário"
 *
 * A ARMADILHA, medida no emulador antes de qualquer conserto. Devolver o
 * status para PENDENTE pela tela do Histórico não devolvia o ofício para a
 * fila:
 *
 *   tela responde  -> "Status atualizado para PENDENTE."
 *   TENTATIVAS     -> continua 3
 *   próxima rodada -> ERRO_PERMANENTE de novo
 *   retorno        -> { enviados: 0, erros: 0, "Processamento concluído." }
 *
 * A tela escrevia STATUS e não encostava em TENTATIVAS; o processador decide
 * por TENTATIVAS. E a re-condenação não contava como erro nenhum, então nada
 * — nem a tela, nem o retorno da rodada, nem a célula — dizia que a devolução
 * tinha sido desfeita. A pessoa fazia a coisa certa e ia embora.
 *
 * POR QUE ISSO ERA GRAVE E NÃO SÓ CHATO: a fila não tem outra porta. O
 * "Enviar agora" só existe dentro do modal que aparece logo depois da
 * emissão; passado aquele momento, devolver o status pelo Histórico é o
 * único caminho para um ofício parado — e era o caminho que não abria.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA (REGRA Nº -1): a tela. Ele chama o backend que
 * o botão do Histórico chama, com os mesmos argumentos. Se o botão está
 * ligado nesse backend, isso o t97 e o t46 cobrem por outro lado — mas quem
 * clica de verdade é o usuário.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CAB = ["ID", "NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ",
             "EMAIL_PRINCIPAL", "EMAILS_TODOS", "ASSUNTO", "HTML_BODY",
             "ANEXOS_JSON", "STATUS", "TENTATIVAS", "ULTIMO_ERRO",
             "DATA_ULTIMA_TENTATIVA", "CODIGO_VERIFICACAO", "DATA_ENVIO",
             "MENSAGEM_ID", "STATUS_RECEBIMENTO"];

const col = (nome) => CAB.indexOf(nome) + 1;
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") ||
             ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const linha = (id, num, status, tentativas, ultimoErro) =>
  [id, num, "Filiação", "EMEF Teste", "00.000.000/0001-00",
   "escola@teste.com", "escola@teste.com", "Ofício " + num, "<p>corpo</p>",
   "[]", status, tentativas, ultimoErro || "", new Date(), "", "", "", ""];

const CEIFA = "Máximo de 3 tentativas atingido.";

/* O estado exato dos 517 a 520 na planilha de produção hoje. */
fila.getRange(2, 1, 4, CAB.length).setValues([
  linha("1_a", "517/2026", "ERRO_PERMANENTE", 3, CEIFA),
  linha("2_b", "518/2026", "ERRO_PERMANENTE", 3, CEIFA),
  linha("3_c", "519/2026", "CONFIRMADO",      2, "algum erro antigo"),
  linha("4_d", "520/2026", "ERRO",            3, CEIFA)
]);

const leia  = (l, nome) => fila.getRange(l, col(nome)).getValue();
const texto = (l, nome) => String(leia(l, nome) || "").trim();

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · devolver para a fila faz o ofício sair");

passo("o ponto de partida: condenado é ignorado pela fila");

const r0 = g.processarFilaEnvioOficios();
igual(texto(2, "STATUS"), "ERRO_PERMANENTE",
      "a fila pula quem está em ERRO_PERMANENTE",
      "é o teto de tentativas fazendo o trabalho dele — não é o defeito");

passo("A CORREÇÃO: devolver para PENDENTE zera as tentativas");

const r1 = g.atualizarStatusOficio("517/2026", "PENDENTE", "Cota do Google, reenviar", TOKEN);
igual(r1.erro, false, "a tela aceita a devolução");
igual(texto(2, "STATUS"), "PENDENTE", "  o status volta a PENDENTE");
igual(Number(leia(2, "TENTATIVAS")), 0,
      "  E AS TENTATIVAS VOLTAM A ZERO",
      "com 3 no contador a rodada seguinte re-condenava antes de tentar");

passo("a memória da falha não se perde ao devolver");

/* Lido AGORA, antes da rodada: um envio bem-sucedido limpa ULTIMO_ERRO, e é
   assim que deve ser. A janela em que a nota importa é justamente esta — o
   ofício está de volta na fila e ainda não se sabe se vai sair. */
const nota = texto(2, "ULTIMO_ERRO");
ok(/3 tentativa/.test(nota), "a nota diz quantas tentativas foram zeradas");
ok(/Antes: .*Máximo de 3 tentativas/.test(nota),
   "  e preserva o erro que estava ali",
   "sem isso, um endereço ruim voltaria à fila para sempre sem deixar rastro");
ok(/Cota do Google/.test(nota), "  junto da observação de quem devolveu");

passo("O QUE O USUÁRIO PEDIU: o pendente vai para o destinatário");

const r2 = g.processarFilaEnvioOficios();
igual(texto(2, "STATUS"), "ENVIADO",
      "o 517 SAIU — é a asserção que fecha o pedido");
ok(r2.enviados >= 1, "  e a rodada contou o envio");
igual(texto(2, "ULTIMO_ERRO"), "",
      "  e o envio bem-sucedido limpa a nota",
      "erro antigo em linha que deu certo faz a planilha mentir");

passo("ERRO também volta a zero — é o outro status que a fila aceita");

g.atualizarStatusOficio("520/2026", "ERRO", "Reenviar", TOKEN);
igual(Number(leia(5, "TENTATIVAS")), 0,
      "o 520 volta com o contador zerado",
      "PENDENTE e ERRO são os dois que o processador pega de volta");

passo("CONFIRMADO e ENVIADO não mexem no contador");

g.atualizarStatusOficio("519/2026", "CONFIRMADO", "Escola respondeu", TOKEN);
igual(Number(leia(4, "TENTATIVAS")), 2,
      "o 519 mantém as 2 tentativas que tinha",
      "zerar aqui seria inventar história: o contador não vale mais nada");
igual(texto(4, "ULTIMO_ERRO"), "Escola respondeu",
      "  e a observação entra limpa, sem nota de devolução");

passo("devolver duas vezes não empilha texto na célula");

fila.getRange(3, 1, 1, CAB.length).setValues([
  linha("2_b", "518/2026", "ERRO_PERMANENTE", 3, CEIFA)
]);
g.atualizarStatusOficio("518/2026", "PENDENTE", "primeira volta", TOKEN);
const nota1 = texto(3, "ULTIMO_ERRO");
fila.getRange(3, col("STATUS")).setValue("ERRO_PERMANENTE");
fila.getRange(3, col("TENTATIVAS")).setValue(3);
g.atualizarStatusOficio("518/2026", "PENDENTE", "segunda volta", TOKEN);
const nota2 = texto(3, "ULTIMO_ERRO");

ok(/Antes: Máximo de 3 tentativas atingido\.$/.test(nota2),
   "a segunda devolução ainda aponta o erro ORIGINAL",
   "citar a nota anterior enterraria o motivo no fim de um novelo");
ok(nota2.length < nota1.length + 40,
   "  e a célula não cresce a cada volta (" + nota1.length + " -> " + nota2.length + ")");
ok(!/Devolvido a fila em .*Devolvido a fila em /.test(nota2),
   "  sem nota dentro de nota");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · a rodada não encerra um ofício em silêncio");

passo("esgotar as tentativas é a morte do ofício — e precisa aparecer");

fila.getRange(2, 1, 4, CAB.length).setValues([
  linha("5_e", "521/2026", "ERRO", 3, CEIFA),
  linha("6_f", "522/2026", "ERRO", 3, CEIFA),
  linha("7_g", "523/2026", "CONFIRMADO", 0, ""),
  linha("8_h", "524/2026", "CONFIRMADO", 0, "")
]);

const r3 = g.processarFilaEnvioOficios();

igual(texto(2, "STATUS"), "ERRO_PERMANENTE", "os dois são encerrados");
igual(r3.condenados, 2, "  e a rodada CONTA quantos encerrou",
      "antes isto não contava em lugar nenhum: erros ficava em 0");
ok(/ATENÇÃO/.test(r3.mensagem), "  a mensagem chama atenção");
ok(/não tenta mais sozinha/i.test(r3.mensagem),
   "  diz que a fila não volta a pegar",
   "\"encerrado\" sozinho se lê como \"acabou\", e o ofício fica esperando");
ok(/PENDENTE no Histórico/.test(r3.mensagem),
   "  e diz o que a pessoa faz a respeito",
   "aviso sem saída é só má notícia");

passo("rodada limpa continua limpa");

fila.getRange(2, 1, 4, CAB.length).setValues([
  linha("9_i", "525/2026", "CONFIRMADO", 0, ""),
  linha("10_j", "526/2026", "CONFIRMADO", 0, ""),
  linha("11_k", "527/2026", "CONFIRMADO", 0, ""),
  linha("12_l", "528/2026", "CONFIRMADO", 0, "")
]);
const r4 = g.processarFilaEnvioOficios();
igual(r4.condenados, 0, "sem encerramento, o contador fica em 0");
ok(!/ATENÇÃO/.test(r4.mensagem),
   "  e a mensagem não inventa alarme: " + r4.mensagem);

resumo();
