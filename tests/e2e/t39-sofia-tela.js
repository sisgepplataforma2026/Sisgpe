/**
 * TESTE DE TELA — A SOFIA NO NAVEGADOR (jsdom)
 *
 * O t38 prova o que o servidor devolve. Este prova o que a TELA faz com
 * isso: se a linha de procedência aparece, se ela some quando não há
 * documento, e se a coluna da direita deixou de ocupar espaço para prometer
 * conteúdo que nunca chega.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 * aparência. jsdom não aplica CSS — a classe `sofia-sem-painel` existe no
 * elemento, mas quem faz a coluna sumir é a folha de estilo, e isso só se
 * confere no navegador. Aqui se prova a LÓGICA: qual classe entra, qual
 * elemento é criado, com que texto.
 *
 * A CHAMADA À ANTHROPIC É ENCENADA — e só ela. Todo o resto do caminho é
 * real: o clique, o `google.script.run`, o `chatSISGEP` de verdade com a
 * sessão de verdade, o prompt montado de verdade e a leitura das fontes a
 * partir dele. O que se troca é o `UrlFetchApp.fetch`, porque a resposta da
 * IA não é testável e não é o que está sob teste: o que está sob teste é o
 * que a tela faz com uma resposta.
 */
const b = require("./base");
const d = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

if (!d.jsdomDisponivel()) {
  b.fluxo("SOFIA · tela");
  b.naoTestavel("A tela da SOFIA em DOM real", "jsdom não instalado neste ambiente");
  b.resumo();
  process.exit(0);
}

/* A IA encenada. `respostaIA` é trocada a cada caso para simular o que o
 * modelo responderia — inclusive respondendo mal, que é o caso interessante. */
let respostaIA = "Resposta qualquer.";
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "sk-teste");
g.UrlFetchApp = {
  fetch: function () {
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () {
        return JSON.stringify({ content: [{ text: respostaIA }] });
      }
    };
  }
};

const t = d.montar(g, ["ChatSISGEP.html"], { token: token });
const doc = t.doc;
const grade = () => doc.querySelector(".sofiaOpsGrid");
const recolhido = () => grade().classList.contains("sofia-sem-painel");
const fontes = () => doc.querySelectorAll(".sofia-fonte");
const alerta = () => doc.querySelector(".sofia-alerta-fonte");

/* O CLIQUE NO BOTÃO NÃO É EXERCITÁVEL AQUI — e isto precisa estar escrito.
 *
 * O "Enviar" chama a tela por atributo `onclick`, e o jsdom em modo
 * `outside-only` não compila atributo de evento: o clique dispara e nada
 * acontece. Descobri isso aqui mesmo, vendo `chamadas: []` depois de um
 * clique que o andaime reportou como bem-sucedido.
 *
 * Então este arquivo entra pela função que o botão chama. O que ele prova é
 * tudo o que vem DEPOIS disso — pedido ao servidor, resposta, DOM. O que ele
 * NÃO prova é que o botão está ligado nessa função; isso continua
 * "não testado" e só se confere no navegador. */
async function perguntar(texto) {
  t.digitar("#chatInput", texto);
  t.win.enviarMensagemChat();
  await t.assentar(60);
}

(async function () {

/* O init() da tela roda no DOMContentLoaded, que no jsdom só dispara no
 * tique seguinte à montagem. Sem esta espera, as asserções de estado inicial
 * medem a tela antes de ela ter começado — e acusariam de defeito o que é
 * pressa do teste. */
await t.assentar(30);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · As especialidades viraram uma linha");

b.passo("1. Os 11 modos continuam todos disponíveis");
/* Virar chip não pode ser desculpa para sumir com modo nenhum: a escolha
 * manual é o que permite FORÇAR a fonte quando a pergunta não denuncia o
 * assunto sozinha. */
const chips = doc.querySelectorAll("#sofiaEspecialidades .sofia-chip");
b.igual(chips.length, 11, "os 11 chips estão na barra");
const rotulos = Array.prototype.map.call(chips, c => c.getAttribute("data-sofia-dominio"));
b.ok(rotulos.indexOf("CCT") > -1 && rotulos.indexOf("Estatuto") > -1,
  "CCT e Estatuto entre eles — são os dois que carregam documento");

b.passo("2. Um modo ativo por vez, e a marca acompanha a troca");
const ativos = () => Array.prototype.map.call(
  doc.querySelectorAll("#sofiaEspecialidades .sofia-chip.ativo"),
  c => c.getAttribute("data-sofia-dominio"));
b.igual(ativos(), ["Geral"], "começa em Geral");
t.win.selecionarDominioSofia_("Estatuto");
b.igual(ativos(), ["Estatuto"], "clicar em Estatuto move a marca — e só ela fica");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · O painel da direita só existe quando tem o que dizer");

b.passo("3. Ele nasce recolhido");
/* Antes ele ocupava um quinto da tela desde o primeiro segundo para dizer
 * "Fontes serão exibidas aqui" — espaço permanente para informação
 * eventual, que é o dashboard decorativo que o PROMPT-MESTRE proíbe. */
b.ok(recolhido(), "a grade nasce com sofia-sem-painel");
b.igual(t.texto("#sofiaContextoPainel"), "", "e o painel nasce sem texto de promessa");

b.passo("4. Uma resposta sem escola identificada não o abre");
respostaIA = "Temos 8.014 associados na base.";
await perguntar("quantos associados temos?");
b.ok(recolhido(), "continua recolhido — não havia contexto para mostrar");

b.passo("5. Trocar de especialidade recolhe de novo");
t.win.selecionarDominioSofia_("CCT");
b.ok(recolhido(), "modo novo, painel fechado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · A procedência aparece embaixo da resposta");

b.passo("6. Documento consultado → a linha aparece, com a identificação");
t.win.selecionarDominioSofia_("Estatuto");
respostaIA = "O escrutínio secreto é obrigatório (art. 62).";
await perguntar("quem pode participar da votação?");
b.igual(fontes().length, 1, "um chip de fonte");
const texto1 = fontes()[0].textContent;
b.ok(/Estatuto/.test(texto1), "diz que foi o Estatuto", texto1);
b.ok(/17\/11\/2025/.test(texto1), "com a data que denuncia estatuto revogado");
b.igual(alerta(), null, "e nenhum alerta — a citação tem fonte");

b.passo("7. Nenhum documento consultado → nenhuma linha");
/* Silêncio aqui é a resposta certa: a maioria das perguntas é de cadastro e
 * não envolve documento. Desenhar "consultei: nada" seria ruído em toda
 * conversa. */
t.win.selecionarDominioSofia_("Geral");
respostaIA = "São 6.203 confirmados no mês.";
await perguntar("quantos confirmados no mês?");
b.igual(doc.querySelectorAll(".sofia-fontes").length, 0,
  "sem documento no prompt, a tela não anuncia fonte nenhuma");

b.passo("8. Citação sem documento → o aviso âmbar");
/* É o defeito que a procedência existe para pegar. A resposta afirma
 * "cláusula 12" com a mesma segurança de sempre e o número pode ser
 * invenção; sem esta linha, ninguém tem como desconfiar. */
respostaIA = "Conforme a cláusula 12 da convenção, o adicional é devido.";
await perguntar("quantos associados temos em Vitória?");
const av = alerta();
b.ok(av, "o aviso aparece");
b.ok(av && /cl[áa]usula/i.test(av.textContent), "dizendo o que foi citado sem fonte",
  av ? av.textContent.slice(0, 90) : "");

b.passo("9. E a mesma citação COM a CCT no prompt não gera aviso");
/* A contraprova. Sem ela, um alerta que dispara sempre passaria neste
 * arquivo — e alerta que grita à toa se aprende a ignorar. */
t.win.selecionarDominioSofia_("CCT");
respostaIA = "Conforme a cláusula 04, o piso é R$ 3.721,87.";
await perguntar("qual o piso do secretário escolar?");
b.igual(doc.querySelectorAll(".sofia-alerta-fonte").length, 0,
  "com a convenção consultada, nenhum aviso");
b.ok(fontes().length >= 1, "e a fonte aparece no lugar dele");

b.passo("10. Com escola identificada, o painel abre — e traz o cadastro");
/* Aqui o servidor é encenado de propósito. Fazer o `coletarContextoSISGEP_`
 * real devolver uma escola exigiria semear mensalidade, cadastro e Receita —
 * e o que está sob teste não é a busca (isso é do t25/t26), é o que a TELA
 * faz quando o contexto chega. Sem este caso, uma mutação que deixasse o
 * painel fechado para sempre passaria despercebida: os outros passos todos
 * esperam ele fechado. */
const chatReal = g.chatSISGEP;
g.chatSISGEP = function () {
  return {
    ok: true,
    resposta: "A UVV tem 12 associados, 8 confirmados.",
    fontes: [],
    alertaFonte: "",
    contexto: { dados: { escolaFiltrada: {
      termo: "UVV", total: 12, confirmados: 8, pendentes: 2, aguardando: 2,
      email: "rh@uvv.br", infoEscola: { cnpj: "31.736.435/0001-30", razaoSocial: "Universidade Vila Velha" }
    } } }
  };
};
await perguntar("status da UVV");
b.igual(recolhido(), false, "o painel abriu");
const painel = t.texto("#sofiaContextoPainel");
b.ok(/UVV/.test(painel || ""), "com a escola identificada", (painel || "").slice(0, 70));
b.ok(/12/.test(painel || ""), "e os números do cadastro");

b.passo("11. Trocar de especialidade fecha o painel aberto");
/* Este passo existe porque o anterior a ele não bastava: eu tinha a mesma
 * asserção lá em cima, com o painel JÁ fechado — ela passava sem provar
 * nada, e a mutação que apagava o fechamento na troca de modo sobreviveu.
 * Só verifica fechamento quem viu abrir primeiro. */
t.win.selecionarDominioSofia_("Escolas");
b.ok(recolhido(), "modo novo, contexto da conversa anterior fora da tela");

b.passo("12. E fecha de novo quando a resposta seguinte não tem contexto");
/* O painel abrir é metade; a outra metade é ele não ficar aberto para
 * sempre depois da primeira escola, ocupando a tela com dado velho. */
await perguntar("status da UVV");
b.igual(recolhido(), false, "reaberto para a checagem seguinte");
g.chatSISGEP = chatReal;
respostaIA = "São 6.203 confirmados no mês.";
await perguntar("quantos confirmados no mês?");
b.ok(recolhido(), "voltou a recolher — contexto velho não fica na tela");

b.naoTestavel("O botão Enviar estar ligado à função que envia",
  "handler por atributo onclick; o jsdom em outside-only não o compila");
b.naoTestavel("Se a coluna da direita some de fato e o chip cabe na barra",
  "jsdom não aplica CSS nem desenha — largura e visibilidade só no navegador");
b.naoTestavel("A resposta que a IA de fato daria",
  "a chamada à Anthropic é encenada; o que se prova é o que a tela faz com a resposta");

b.resumo();
process.exit(0);
})();
