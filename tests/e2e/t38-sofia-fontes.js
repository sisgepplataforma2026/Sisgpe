/**
 * TESTE — A SOFIA RESPONDE PELA FONTE CERTA
 *
 * O que este arquivo protege não é a resposta da IA: é o que chega até ela.
 * A IA não é testável aqui — o emulador não chama a Anthropic. O que É
 * testável, e é onde moram os defeitos que ninguém percebe, é o PROMPT: qual
 * documento entrou, qual não entrou, e se o que entrou vem identificado.
 *
 * POR QUE ISSO IMPORTA MAIS QUE PARECE
 *
 * Um assistente que erra o formato é descoberto na primeira leitura. Um que
 * erra a FONTE não é descoberto nunca: a resposta sai com a mesma cara de
 * sempre, cita um artigo com a mesma segurança, e quem lê não tem como saber
 * que o artigo veio do documento errado — ou de nenhum documento.
 *
 * OS DOIS DEFEITOS REAIS QUE ESTE TESTE NASCEU DE ACHAR, ambos em 13/08/2026:
 *
 *   1. O botão "CCT" da barra lateral NÃO carregava a CCT. A decisão olhava
 *      só as palavras da pergunta. Quem clicava em CCT e perguntava "quanto
 *      ganha um secretário escolar?" recebia resposta sem a convenção.
 *
 *   2. O documento chegava SEM IDENTIFICAÇÃO. `selecionarContextoIA_` escolhe
 *      os parágrafos relevantes e descarta o resto — inclusive a primeira
 *      linha, que é onde mora "qual documento é este e desde quando vale".
 *      Os artigos certos chegavam soltos, sem dizer de que documento vieram.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

function prompt(msg, dominio) {
  return g.montarSystemPrompt_(g.coletarContextoSISGEP_(msg, dominio), msg);
}
const temCCT = p => p.indexOf("=== CCT —") > -1;
const temEst = p => p.indexOf("=== ESTATUTO —") > -1;

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · O domínio escolhido manda");

b.passo("1. A especialidade CCT carrega a CCT, mesmo sem a palavra 'CCT'");
/* Era o defeito nº 1. "Quanto ganha um secretário escolar?" não contém CCT,
 * convenção, cláusula nem dissídio — e a convenção não era anexada. */
const pCCT = prompt("quanto ganha um secretário escolar?", "CCT");
b.ok(temCCT(pCCT), "a convenção entrou pelo domínio, não pela palavra");

b.passo("2. A especialidade Estatuto carrega o Estatuto, mesmo sem a palavra");
/* A PERGUNTA NÃO PODE CONTER NENHUMA PALAVRA DA LISTA — e a minha primeira
 * versão continha. Eu tinha escrito "qual o quórum para deliberar?", e
 * "quórum" está entre as palavras que acionam o estatuto sozinhas: o teste
 * passava pelo caminho errado e não provava nada sobre o domínio.
 *
 * Descoberto por mutação: apagando `dominioAtual === "ESTATUTO"` o teste
 * continuava verde. "Votação" não está na lista; é por isso que serve. */
const pEst = prompt("quem pode participar da votação?", "Estatuto");
b.ok(temEst(pEst), "o estatuto entrou pelo domínio, não pela palavra");
b.igual(temEst(prompt("quem pode participar da votação?", "Geral")), false,
  "e a mesma pergunta no domínio Geral NÃO carrega o estatuto — é o domínio que decide");

b.passo("3. E o conteúdo é o certo, não um pedaço qualquer");
b.ok(pEst.indexOf("Assembleias Gerais") > -1, "traz a seção das Assembleias Gerais");
b.ok(/Art\. 6[0-9]/.test(pEst), "com os artigos da faixa das assembleias");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · Cada documento chega dizendo quem é");

b.passo("4. O bloco do Estatuto vem identificado e datado");
/* Era o defeito nº 2, e é o que torna o nº 1 perigoso: com os dois
 * documentos podendo entrar no mesmo prompt, artigo sem procedência é
 * convite para citar da fonte errada. */
b.ok(pEst.indexOf("ESTATUTO SINDEDUCACAO-ES") > -1,
  "diz qual documento é");
b.ok(pEst.indexOf("17/11/2025") > -1,
  "e desde quando ele vale — a data é o que denuncia estatuto revogado");

b.passo("5. O bloco da CCT também");
b.ok(pCCT.indexOf("CCT 2026/2027") > -1, "identifica a convenção");
b.ok(pCCT.indexOf("01/03/2026") > -1, "com a vigência");

b.passo("6. A identificação NÃO depende da pergunta");
/* É a asserção que fecha o defeito: ela sobrevive ao corte do seletor de
 * contexto, porque é concatenada fora dele. Uma pergunta que não casa com a
 * primeira linha do documento continuaria identificada. */
const pArt = prompt("o que diz o art. 62?", "Geral");
b.ok(temEst(pArt), "art. 62 aciona o estatuto mesmo no domínio Geral");
b.ok(pArt.indexOf("ESTATUTO SINDEDUCACAO-ES") > -1,
  "e a identificação vem junto, embora 'estatuto' não case com a pergunta");

b.passo("7. E manda citar a origem");
b.ok(/de qual destes documentos/i.test(pEst),
  "o bloco instrui a dizer de qual documento veio a citação");
b.ok(/NUNCA responda\s+sobre Estatuto usando a CCT/i.test(pEst.replace(/\s+/g, " ")),
  "e o prompt proíbe trocar as fontes");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("SOFIA · O que NÃO deve entrar");

b.passo("8. Pergunta de rotina não arrasta 75 mil caracteres de documento");
/* Anexar tudo sempre seria mais simples e pior: enche o prompt, encarece a
 * chamada e afoga o dado do sistema — que é o que responde "quantos
 * associados temos". */
const pRotina = prompt("quantos associados temos?", "Geral");
b.igual(temCCT(pRotina), false, "sem CCT numa pergunta de cadastro");
b.igual(temEst(pRotina), false, "sem Estatuto também");
b.ok(pRotina.length < 8000, "e o prompt fica pequeno", pRotina.length + " caracteres");

b.passo("9. Palavras de cada domínio acionam o documento certo");
[["piso salarial da telefonista", true, false],
 ["reajuste de 2026", true, false],
 ["como destituir um diretor", false, true],
 ["quando é a posse da diretoria", false, true],
 ["quórum da assembleia", false, true]].forEach(function (c) {
  const p = prompt(c[0], "Geral");
  b.igual(temCCT(p), c[1], "'" + c[0] + "' → CCT " + (c[1] ? "sim" : "não"));
  b.igual(temEst(p), c[2], "'" + c[0] + "' → Estatuto " + (c[2] ? "sim" : "não"));
});

b.passo("10. A versão do Estatuto no código é a vigente");
/* O usuário mandou DOIS estatutos: o de 2023 e o de 2026. O 2023 está
 * revogado (art. 134 do novo diz que substitui "na integralidade"), e a
 * diferença entre eles desloca em UM toda a faixa das assembleias — o que
 * faria o sistema parecer errado para quem conferisse pelo documento velho. */
b.igual(g.ESTATUTO_VERSAO.aprovadoEm, "17/11/2025", "a data de aprovação é a do 2026");
b.igual(g.ESTATUTO_VERSAO.artigos, 134, "134 artigos, não os 135 do revogado");
b.ok(/Art\. 62\.\s*Serão sempre tomadas por escrutínios secretos/.test(g.getEstatutoTexto_()),
  "e o art. 62 é o do escrutínio secreto — a numeração que Assembleias.gs cita");

b.naoTestavel("A resposta que a IA de fato dá",
  "o emulador não chama a Anthropic; o que se prova aqui é o que chega até ela");

b.resumo();
process.exit(0);
