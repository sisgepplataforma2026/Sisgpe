/**
 * TESTE — A PORCENTAGEM É REAL, E A IMPORTAÇÃO PERDE O TETO DE TEMPO
 *
 * O QUE ORIGINOU, 15/09/2026. Ele pôs 201 linhas para importar, esperou, e
 * disse duas coisas na sequência:
 *
 *   "Mas demora muito para importar?"
 *   "Tinha que ter um contador de porcentagem quando estiver importando."
 *
 * A demora tinha outra causa, consertada no t172 — a base de associados era
 * lida uma vez por pessoa. Isto aqui é a segunda parte: saber ONDE se está.
 *
 * POR QUE NÃO DAVA PARA SÓ DESENHAR UMA BARRA. O `google.script.run` é uma
 * chamada única e bloqueante: o servidor processa tudo e só responde no fim.
 * Não existe meio do caminho para o navegador escutar. Barra animada por
 * relógio mostraria 60% quando pode estar em 10% — e ensina a pessoa a não
 * confiar nela. A única porcentagem honesta é a que vem de linhas que já
 * voltaram do servidor.
 *
 * O GANHO MAIOR NÃO É A BARRA. O caminho antigo carregava uma trava de tempo
 * no meio do laço: se estourasse, parava pela metade e devolvia "tempo
 * esgotado" — e quem importava não sabia o que tinha entrado e o que não. Em
 * faixas, cada chamada é curta por construção.
 *
 * O QUE ESTE TESTE GUARDA: que a faixa respeita o total pedido, que as faixas
 * se emendam sem pular nem repetir linha, que o número da linha é o da
 * PLANILHA (é o que alguém vai procurar no arquivo), e que a última diz que
 * terminou. Mais o que não pode mudar: as duas portas — a de uma tacada e a
 * de lotes — passam pelo mesmo miolo.
 */
const fs = require("fs");
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const ADM = b.logar(g, "wanderson");
const tela = fs.readFileSync(RAIZ + "/CompassoImportacao.html", "utf8");

/* ─── A planilha de origem, e o que o caminho público faz com cada linha ─── */
const LINHAS = [];
for (let i = 1; i <= 60; i++) {
  LINHAS.push(["Escola " + i, "Pessoa Numero " + i, String(10000000000 + i),
               "cidade", "p" + i + "@exemplo.com", "27999" + String(100000 + i)]);
}

let criadas = [];
g.compassoImp_abrir_ = () => ({
  grid: [["escola", "nome", "cpf", "cidade", "email", "whatsapp"]].concat(LINHAS),
  nomeAba: "Pagina1", abas: ["Pagina1"]
});
g.compasso_criarInscricaoAssociado_publica_ = (d) => {
  criadas.push(d);
  return { ok: true, inscricaoId: "INS-" + criadas.length };
};
g.compasso_auditar_ = () => {};
g.compasso_assertHomologacao_ = () => true;
/* A VALIDAÇÃO DE LINHA SAI DE CENA AQUI, de propósito. Os CPFs acima são
   sequenciais e inválidos de verdade — o `compassoImp_recusar_` recusa todos,
   e com razão. Mas o que este arquivo mede é a MECÂNICA DAS FAIXAS: onde cada
   uma começa, onde para, se emenda na seguinte. Deixar a validação ligada
   faria o teste medir a validação, que já tem dono em outro lugar.
   A recusa volta a valer no bloco do número da linha, mais abaixo, porque lá
   ela é justamente o que se quer observar. */
g.compassoImp_recusar_ = () => "";

const lote = (inicio, tamanho, total) =>
  g.compassoImp_importarLote({}, "Pagina1", {},
    { inicio: inicio, tamanho: tamanho, total: total }, ADM);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Uma faixa por vez, e ela sabe dizer onde parou");

criadas = [];
const l1 = lote(0, 25, 60);

passo("a primeira faixa faz 25 e diz que falta");
igual(l1.ok, true, "aceita");
igual(l1.criadas, 25, "criou 25");
igual(l1.inicio, 0, "  começou em 0");
igual(l1.fim, 25, "  parou em 25");
igual(l1.total, 60, "  de 60");
igual(l1.terminou, false, "não terminou");
igual(l1.proximoInicio, 25, "e diz de onde continuar",
      "é esse número que a tela devolve na chamada seguinte");

passo("a barra tem o que precisa, e só isso");
igual(Math.round(l1.fim / l1.total * 100), 42, "42% — vem de linha contada, não de relógio");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("As faixas se emendam: ninguém é pulado, ninguém entra duas vezes");

criadas = [];
let inicio = 0, voltas = 0, somaCriadas = 0;
while (inicio >= 0 && voltas < 20) {
  const r = lote(inicio, 25, 60);
  somaCriadas += r.criadas;
  inicio = r.proximoInicio;
  voltas++;
}

igual(voltas, 3, "três faixas para 60 linhas em lotes de 25");
igual(somaCriadas, 60, "e 60 inscrições ao todo");
igual(criadas.length, 60, "  sem repetir nenhuma");

passo("cada pessoa entrou exatamente uma vez");
const nomes = criadas.map(x => x.nome);
igual(new Set(nomes).size, 60, "60 nomes distintos",
      "faixa que se sobrepõe criaria a mesma pessoa duas vezes, e a segunda " +
      "consumiria mais uma das 2.000 vagas");
igual(nomes[0], "Pessoa Numero 1", "  a primeira da planilha");
igual(nomes[59], "Pessoa Numero 60", "  e a última");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O total pedido manda — a faixa não passa dele");

criadas = [];
const parcial = lote(0, 25, 10);
igual(parcial.criadas, 10, "pedindo 10, entram 10",
      "o lote é 25, mas quem decide é o total que a pessoa digitou");
igual(parcial.terminou, true, "e já terminou");
igual(parcial.proximoInicio, -1, "sem próxima faixa");

passo("e pedir mais linhas do que a planilha tem não quebra");
criadas = [];
const demais = lote(0, 25, 500);
igual(demais.total, 60, "o total cai para o tamanho da planilha");

criadas = [];
let i2 = 0, v2 = 0;
while (i2 >= 0 && v2 < 20) { const r = lote(i2, 25, 500); i2 = r.proximoInicio; v2++; }
igual(criadas.length, 60, "e importa as 60 que existem");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O número da linha é o da PLANILHA, não o da faixa");

/* Quem for conferir uma linha ignorada vai abrir o arquivo e procurar por
   ela. Número relativo à faixa mandaria a pessoa para a linha errada — e na
   terceira faixa o erro seria de 50 linhas. */
g.compasso_criarInscricaoAssociado_publica_ = () => ({ ok: false, erro: "recusada de proposito" });
criadas = [];
const terceira = lote(50, 25, 60);
igual(terceira.ignoradas.length, 10, "as 10 últimas foram ignoradas");
igual(terceira.ignoradas[0].linha, 52,
      "a primeira delas é a linha 52 da planilha",
      "cabeçalho + 50 já processadas + 1; relativo à faixa diria 2");
igual(terceira.ignoradas[9].linha, 61, "e a última é a 61");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("As duas portas passam pelo mesmo miolo");

/* A porta antiga continua existindo porque quem chamava continua chamando.
   Se ela tivesse cópia própria da regra, o teste de uma não diria nada sobre
   a outra — e elas divergiriam no primeiro conserto. */
const fonte = fs.readFileSync(RAIZ + "/EventosImportacaoTela.gs", "utf8");
ok(/function compassoImp_importar\(/.test(fonte), "a porta de uma tacada existe");
ok(/function compassoImp_importarLote\(/.test(fonte), "a de lotes também");
const corpoAntiga = (fonte.match(/function compassoImp_importar\(([\s\S]*?)\n\}/) || [""])[0];
ok(/compassoImp_rodarFaixa_/.test(corpoAntiga),
   "e a antiga delega para a faixa, em vez de repetir o laço");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A tela pede em lotes e mede o que voltou");

ok(/compassoImp_importarLote/.test(tela), "a tela chama a porta de lotes");
ok(/IMP_LOTE/.test(tela), "com tamanho de lote declarado num lugar só");
ok(/proximoInicio/.test(tela), "e continua de onde a resposta mandou");

passo("a porcentagem sai de linhas, não de tempo");
const prog = (tela.match(/function impProgresso\([\s\S]*?\n\}/) || [""])[0];
ok(/feitas \/ total/.test(prog), "a conta é feitas dividido por total", prog.slice(0, 80));
ok(!/setInterval|setTimeout/.test(prog),
   "nenhum relógio no meio",
   "barra por relógio mostra 60% quando pode estar em 10%");

passo("e o que já entrou continua à vista se uma faixa falhar");
ok(/if \(soma\.criadas\) g\('resultado'\)\.innerHTML = relatorio\(soma\)/.test(tela),
   "o relatório parcial permanece",
   "esconder faria alguém importar tudo de novo — e duplicar o que já entrou");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("A barra andando na tela",
  "não há CSS nem pintura aqui. Que a barra encha de 25 em 25 e que o texto " +
  "seja legível enquanto roda, só o navegador responde.");
naoTestavel("O tempo de cada faixa com a planilha real",
  "aqui a planilha é um objeto em memória. Quanto cada lote de 25 demora com " +
  "o Drive convertendo o anexo, só a importação no ar responde — e é ela que " +
  "diz se 25 é o tamanho certo.");

resumo();
