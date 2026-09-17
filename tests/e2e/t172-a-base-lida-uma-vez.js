/**
 * TESTE — A BASE DE ASSOCIADOS É LIDA UMA VEZ, NÃO UMA POR PESSOA
 *
 * O QUE ORIGINOU, 15/09/2026. Ele pôs 201 linhas de uma planilha real para
 * importar como massa de teste e perguntou:
 *
 *   "Mas demora muito para importar?"
 *
 * Demorava, e a conta é constrangedora. `compasso_buscarAssociado_` abria a
 * planilha, lia a aba inteira de Associados — cerca de 8.000 linhas por 12
 * colunas, algo perto de 96 mil células — e varria tudo à procura de UM CPF.
 * A cada chamada.
 *
 * E a importação chama duas vezes por linha: uma para decidir o selo de
 * situação, outra dentro do caminho público de criação. Em 201 linhas são 402
 * leituras da base inteira — dezenove milhões de células para encontrar 201
 * pessoas. O "Conferir contra a base" da tela de gestão tem o mesmo desenho,
 * uma leitura por inscrição.
 *
 * A REGRA QUE ESTE TESTE GUARDA: a planilha é aberta UMA vez por execução e
 * vira índice por CPF. O que se conta aqui é literalmente quantas vezes a
 * planilha foi tocada — porque é esse número, e não o tempo, que explica a
 * espera. Tempo varia com a rede; o número de leituras é a causa.
 *
 * E GUARDA O QUE NÃO PODE MUDAR JUNTO: quem é encontrado, quem não é, o que
 * acontece quando a planilha falha, e de quem é o cadastro quando o mesmo CPF
 * aparece duas vezes.
 */
const b = require("./base");
const { g } = b.subir({});
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

/* ─── Uma planilha de mentira que CONTA quantas vezes foi lida ──────────── */
let leituras = 0;
let falhar = false;

const LINHAS = [
  /* escola, nome, cpf, filiado, _, _, _, cidade, _, whatsapp, _, email */
  ["EMEF Centro", "MARIA DA SILVA", "08029739737", "S", "", "", "", "Vitória", "", "27999161454", "", "maria@exemplo.com"],
  ["UVV",         "JOAO SOUZA",     "08538104780", "N", "", "", "", "Vila Velha", "", "27999451089", "", "joao@exemplo.com"],
  /* O MESMO CPF DE NOVO, com outro cadastro: é o caso que decide se o índice
     mantém a regra antiga de "fica o primeiro". */
  ["Colégio B",   "MARIA DA SILVA (DUPLICADA)", "08029739737", "S", "", "", "", "Serra", "", "27000000000", "", "outra@exemplo.com"],
  ["Sem CPF",     "FULANO",         "",            "N", "", "", "", "Vitória", "", "", "", ""]
];

function instalarPlanilha() {
  leituras = 0;
  g.COMPASSO_INDICE_ASSOCIADOS_ = null;   /* cada cenário começa do zero */
  g.SpreadsheetApp = {
    openById: function () {
      if (falhar) throw new Error("Serviço de planilhas indisponível.");
      return {
        getSheetByName: function () {
          return {
            getLastRow: function () { return LINHAS.length + 1; },
            getRange: function () {
              return { getValues: function () { leituras++; return LINHAS; } };
            }
          };
        }
      };
    }
  };
}

instalarPlanilha();

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Duzentas buscas, uma leitura");

passo("a primeira busca abre a planilha");
const m1 = g.compasso_buscarAssociado_("08029739737");
igual(leituras, 1, "uma leitura");
igual(m1.encontrado, true, "e acha a pessoa");
igual(m1.nome, "MARIA DA SILVA", "com o nome do cadastro");
igual(m1.escola, "EMEF Centro", "a escola");
igual(m1.cidade, "Vitória", "a cidade");
igual(m1.filiado, true, "e o S da coluna de filiação");

passo("as 200 seguintes não abrem mais nada");
for (let i = 0; i < 200; i++) g.compasso_buscarAssociado_("08538104780");
igual(leituras, 1, "continua uma leitura só",
      "antes eram 201 — cada uma varrendo as 8.000 linhas da base real");

passo("inclusive procurando quem não existe");
const ninguem = g.compasso_buscarAssociado_("11144477735");
igual(leituras, 1, "sem nova leitura");
igual(ninguem.encontrado, false, "e responde que não achou");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que NÃO podia mudar junto");

passo("CPF que não tem 11 dígitos nem chega a abrir a planilha");
instalarPlanilha();
igual(g.compasso_buscarAssociado_("123").encontrado, false, "recusa antes");
igual(leituras, 0, "e não lê nada",
      "era assim antes e continua: CPF curto não é motivo para ler 8.000 linhas");

passo("CPF repetido: fica o PRIMEIRO cadastro, como no laço original");
instalarPlanilha();
const dup = g.compasso_buscarAssociado_("08029739737");
igual(dup.escola, "EMEF Centro",
      "o primeiro da planilha",
      "trocar para o último mudaria em silêncio de quem é o cadastro que o " +
      "sistema enxerga — e ninguém perceberia");
igual(dup.cidade, "Vitória", "  com os dados dele");

passo("linha sem CPF não entra no índice e não atrapalha");
igual(g.compasso_buscarAssociado_("").encontrado, false, "busca vazia não acha");

passo("quem recebe pode mexer na resposta sem contaminar a próxima busca");
instalarPlanilha();
const a = g.compasso_buscarAssociado_("08538104780");
a.nome = "NOME TROCADO POR QUEM CHAMOU";
a.email = "";
const bb = g.compasso_buscarAssociado_("08538104780");
igual(bb.nome, "JOAO SOUZA", "a segunda busca traz o cadastro intacto",
      "o caminho público completa campo vazio com o que a pessoa digitou — " +
      "se isso escrevesse no índice, contaminaria as linhas seguintes da " +
      "mesma importação");
igual(bb.email, "joao@exemplo.com", "  inclusive o que foi apagado");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Quando a planilha falha, o erro sobe — e não vira 'não encontrado'");

/* A regra vem do comentário original, e ela importa: falha de leitura virando
   "não encontrado" silencioso faria a pessoa preencher tudo à mão sem saber
   que o sistema quebrou, e a equipe veria um X que não é verdade. */
instalarPlanilha();
falhar = true;
const erro = g.compasso_buscarAssociado_("08029739737");
igual(erro.encontrado, false, "não encontra");
ok(/indisponível/i.test(String(erro.erro || "")),
   "e carrega o motivo junto", String(erro.erro || ""));

passo("e a falha NÃO é memorizada");
falhar = false;
const depois = g.compasso_buscarAssociado_("08029739737");
igual(depois.encontrado, true, "a chamada seguinte tenta de novo e acha",
      "guardar um índice vazio repetiria a mentira até o fim da execução — " +
      "e uma importação inteira sairia marcada como 'fora da base'");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O tempo real da importação",
  "aqui a planilha é um objeto em memória, e o que se conta é o número de " +
  "leituras — que é a causa. Quanto isso vira em segundos com a base de 8.000 " +
  "associados e a rede do dia, só a importação no ar responde.");

resumo();
