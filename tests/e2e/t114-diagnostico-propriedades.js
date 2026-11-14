/**
 * t114 — DIAGNÓSTICO DAS PROPRIEDADES DO SCRIPT
 *
 * Acrescentado em 31/08/2026, depois de um episódio que vale registrar.
 *
 * O chat da SOFIA respondeu "Chave da API Anthropic não configurada" na
 * homologação. A chave existia em produção. Para conferir o que estava
 * faltando, o caminho natural seria abrir ⚙ Configurações do projeto →
 * Propriedades do script — só que este projeto passou de 50 propriedades, e
 * a tela avisa: "A lista acima mostra as primeiras 50 e é somente leitura.
 * Para gerenciar ou ver todas, faça isso de forma programática."
 *
 * Ou seja: descobrir se uma propriedade existe virou tentativa e erro. Daí
 * estas duas funções, e daí este teste.
 *
 * O QUE ESTE TESTE PROTEGE, e é a parte perigosa:
 *
 * `diagnosticoPropriedades_` imprime TODAS as propriedades. Se a máscara
 * falhar, ele vira uma função que despeja todos os segredos do sindicato no
 * registro de execução — de dentro de um "diagnóstico", que é justamente o
 * tipo de coisa que se roda sem pensar duas vezes.
 *
 * A máscara é a única coisa entre "ferramenta útil" e "vazamento com nome
 * amigável". É ela que este teste guarda.
 */

const b = require("./base");
const { g } = b.subir({});

const CHAVE_FALSA = "sk-ant-api03-SEGREDOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-FIM9";
const TOKEN_FALSO = "ghp_TOKENsecretoxxxxxxxxxxxxxxxxxxxx";

const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "homologacao");
props.setProperty("ANTHROPIC_API_KEY", CHAVE_FALSA);
props.setProperty("ALGUM_TOKEN", TOKEN_FALSO);
props.setProperty("PLANILHA_NOME", "SISGEP Homologação");   // não é segredo

b.fluxo("PROPRIEDADES · o diagnóstico não pode vazar segredo");

b.passo("1. a função existe e roda");
const saida = g.diagnosticoPropriedades_();
b.ok(typeof saida === "string" && saida.length > 0, "diagnosticoPropriedades_ devolve texto");

b.passo("2. NENHUM segredo aparece inteiro — é o que separa ferramenta de vazamento");
b.ok(
  saida.indexOf(CHAVE_FALSA) === -1,
  "a ANTHROPIC_API_KEY não aparece inteira no diagnóstico",
  saida.indexOf(CHAVE_FALSA) >= 0 ? "VAZOU a chave inteira" : "mascarada"
);
b.ok(
  saida.indexOf(TOKEN_FALSO) === -1,
  "nem um token qualquer — a máscara vale por PADRÃO de nome, não por lista fixa",
  "KEY|TOKEN|SECRET|SENHA|PASSWORD|CREDENCIAL|CLIENT_ID"
);
b.ok(
  saida.indexOf("SEGREDO") === -1,
  "e o miolo do valor não escapa em lugar nenhum"
);

b.passo("3. mas dá para saber QUE existe, e QUAL é");
/* Máscara que esconde demais não serve: o caso de uso é conferir se a chave
   deste ambiente é a mesma de outro. Prefixo e final resolvem isso. */
b.ok(saida.indexOf("ANTHROPIC_API_KEY") >= 0, "o nome da propriedade aparece");
b.ok(saida.indexOf("sk-ant-") >= 0, "com o prefixo, que diz qual chave é");
b.ok(saida.indexOf("FIM9") >= 0, "e o final, que distingue uma chave de outra");
b.ok(/\d+ caracteres/.test(saida), "e o tamanho, que denuncia chave truncada na cópia");

b.passo("4. o que NÃO é segredo aparece inteiro");
b.ok(saida.indexOf("SISGEP Homologação") >= 0,
  "valor comum é mostrado sem máscara — mascarar tudo esconderia o que importa ler");
b.ok(saida.indexOf("homologacao") >= 0, "o ambiente aparece, e é a primeira coisa que se quer saber");

b.passo("5. ausência é dita com todas as letras");
props.deleteProperty("ANTHROPIC_API_KEY");
const semChave = g.diagnosticoPropriedades_();
b.ok(
  /❌\s+ANTHROPIC_API_KEY/.test(semChave),
  "chave ausente vem marcada com ❌, não some da lista",
  "some da lista seria o pior: quem procura não acha e conclui que olhou errado"
);
b.ok(
  semChave.indexOf("AUSENTE") >= 0,
  "e dizendo que o que depende dela não funciona neste ambiente"
);

b.passo("6. revelar é ato deliberado, e avisa do rastro");
props.setProperty("ANTHROPIC_API_KEY", CHAVE_FALSA);
const revelado = g.revelarPropriedade_("ANTHROPIC_API_KEY");
b.ok(revelado.indexOf(CHAVE_FALSA) >= 0,
  "revelarPropriedade_ mostra o valor inteiro — é para isso que serve");
b.ok(revelado.indexOf("REGISTRO DE EXECUÇÃO") >= 0,
  "e avisa que o valor ficou gravado no log",
  "quem roda precisa saber que copiar a chave deixa rastro");

b.passo("7. propriedade inexistente não finge que existe");
const naoTem = g.revelarPropriedade_("PROPRIEDADE_QUE_NAO_EXISTE");
b.ok(naoTem.indexOf("NÃO existe") >= 0,
  "diz que não existe, em vez de devolver vazio",
  "vazio se confunde com 'existe e está em branco'");

b.resumo();
