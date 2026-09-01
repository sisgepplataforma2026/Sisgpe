/**
 * t117 — SOFIA · O DOCUMENTO QUE CHEGA À IA
 *
 * Este teste nasceu de uma medição no ar, em 01/09/2026, com a chave da API já
 * configurada na homologação. Vale contar inteiro, porque o caminho até a
 * causa é o que impede de consertar a coisa errada.
 *
 * O QUE FOI OBSERVADO, na tela, em quatro perguntas
 *
 * 1. "quem pode participar da votação?" → citou arts. 74, 76, 82, 94, 96.
 * 2. "é o 88 ou o 74?" → "O Art. 88 NÃO CONSTA no Estatuto vigente".
 * 3. "quantos artigos tem?" → "134 artigos, o último é o Art. 134".
 * 4. "o que diz o art. 88?" → citou o art. 88 inteiro, e ele é EXATAMENTE
 *    sobre o assunto: "a relação dos associados em condições de VOTAR".
 *
 * As respostas 2 e 3 não podem ser as duas verdadeiras. E a 4 provou qual era
 * a falsa.
 *
 * AS DUAS CAUSAS, e nenhuma delas é a IA inventando
 *
 * PRIMEIRA — a pontuação era por texto literal. A pergunta gera "votacao"; o
 * art. 88 escreve "votar". `indexOf("votacao")` não acha "votar", o artigo
 * pontuou zero e foi FILTRADO FORA. Nunca chegou ao prompt. Num documento
 * jurídico isso é sistemático: quem pergunta usa o substantivo, a lei escreve
 * o verbo.
 *
 * SEGUNDA, e a mais grave — o corte era por linha em branco. "Art. 88. A
 * relação…" e "§1º Aos associados previstos no art. 5º…" são blocos separados
 * no texto. A seleção levava um sem o outro: 74 dos 448 blocos do Estatuto
 * começam com "§". Chegava à IA um parágrafo legal SEM NÚMERO, encostado em
 * outro artigo — e ela o pendurava no último número visível. Foi assim que o
 * §1º do art. 88 saiu como "§1º do Art. 82".
 *
 * Ela não trocou o número. Recebeu o texto sem número nenhum.
 *
 * O QUE ESTE TESTE GUARDA
 *
 * Que o artigo certo chega, que nenhum parágrafo viaja sozinho, e que o prompt
 * proíbe afirmar ausência a partir de um pedaço. As três coisas juntas — a
 * terceira porque, mesmo com seleção perfeita, o trecho nunca é o documento
 * inteiro, e negar existência olhando um pedaço continuaria possível.
 */

const b = require("./base");
const { g } = b.subir({});

const ESTATUTO = g.getEstatutoTexto_();
const PERGUNTA = "quem pode participar da votação?";

b.fluxo("SOFIA · o artigo certo tem de chegar ao prompt");

b.passo("1. o caso real — 'votação' precisa alcançar 'votar'");
/* A asserção que reproduz o defeito medido no ar. Se ela cair, a SOFIA volta
   a citar 74/76/96 para uma pergunta cuja resposta é o 88. */
const trecho = g.selecionarContextoIA_(ESTATUTO, PERGUNTA, 60000);
b.ok(ESTATUTO.indexOf("Art. 88") >= 0, "o art. 88 existe no documento (senão o teste não prova nada)");
b.ok(
  trecho.indexOf("Art. 88") >= 0,
  "o art. 88 CHEGA no trecho enviado à IA",
  trecho.indexOf("Art. 88") >= 0 ? "presente" :
    "AUSENTE — a IA responderia sobre votação sem o artigo que trata de votação"
);

b.passo("2. e o assunto dele confirma que é o artigo certo");
const pos = trecho.indexOf("Art. 88");
b.ok(
  /rela[çc][ãa]o dos associados em condi[çc][õo]es de votar/i.test(trecho.substring(pos, pos + 200)),
  "o art. 88 é sobre quem pode votar — é a resposta da pergunta",
  trecho.substring(pos, pos + 60)
);

b.passo("3. o radical é o que faz isso funcionar");
b.igual(g.radicalBuscaIA_("votacao"), "vot", "'votação' vira o radical 'vot'");
b.igual(g.radicalBuscaIA_("participar"), "particip", "'participar' vira 'particip'");
b.igual(g.radicalBuscaIA_("eleitoral"), "eleitor", "'eleitoral' vira 'eleitor'");
b.ok("votar".indexOf(g.radicalBuscaIA_("votacao")) >= 0,
  "e o radical de 'votação' acha 'votar' — que é o casamento que faltava");

b.passo("4. o radical vale MENOS que o termo exato");
/* Ele existe para o artigo certo entrar na disputa, não para vencer de quem
   casou a palavra inteira. Se pesasse igual, a seleção viraria ruído. */
const fonte = String(g.selecionarContextoIA_);
b.ok(
  /termos\.forEach[\s\S]{0,80}pontos \+= 2/.test(fonte) &&
  /radicais\.forEach[\s\S]{0,80}pontos \+= 1/.test(fonte),
  "termo exato pontua 2, radical pontua 1"
);

b.fluxo("SOFIA · nenhum parágrafo viaja sem o seu artigo");

b.passo("5. A CORREÇÃO QUE MAIS IMPORTA — medida nos dois estados");
const porLinhaEmBranco = ESTATUTO.split(/\n{2,}/);
const porArtigo = g.agruparPorArtigoIA_(ESTATUTO);
const comecaComParagrafo = a => a.filter(x => /^\s*§/.test(x)).length;

const antes = comecaComParagrafo(porLinhaEmBranco);
b.ok(antes > 0,
  "cortando por linha em branco, " + antes + " blocos começam com § — sem número de artigo",
  "é o estado que produziu '§1º do Art. 82' para um parágrafo do art. 88");
b.igual(comecaComParagrafo(porArtigo), 0,
  "agrupando por artigo, NENHUMA unidade começa com § — o parágrafo nunca chega sozinho");

b.passo("6. e o artigo chega com os parágrafos dele, na ordem");
const unidade88 = porArtigo.filter(u => /^\s*Art\.\s*88\b/.test(u))[0] || "";
b.ok(!!unidade88, "existe uma unidade que começa no art. 88");
b.ok(
  unidade88.indexOf("direito de voto em separado") >= 0,
  "o §1º está DENTRO da unidade do art. 88",
  "é o parágrafo que a IA atribuiu ao art. 82 quando chegou solto"
);
b.ok(unidade88.indexOf("impugnação fundamentada") >= 0, "o §2º também");

b.passo("7. título, capítulo e seção NÃO entram no artigo");
b.ok(
  unidade88.indexOf("SEÇÃO II") === -1,
  "a unidade para antes do próximo cabeçalho de seção",
  "senão o artigo carregaria texto que não é dele"
);

b.passo("8. número citado na pergunta busca AQUELE artigo");
/* Antes só "cláusula N" era reconhecida; "art. N" ficava de fora — e é a forma
   de perguntar sobre o Estatuto. */
const porNumero = g.selecionarContextoIA_(ESTATUTO, "o que diz o art. 88 do Estatuto?", 60000);
b.ok(porNumero.indexOf("Art. 88") >= 0, "perguntar pelo número traz o artigo");

b.passo("9. documento sem artigos continua sendo tratado como antes");
/* A mudança não pode alterar o tratamento de texto que não é lei. */
const solto = "Primeiro parágrafo qualquer.\n\nSegundo parágrafo.\n\nTerceiro.";
b.igual(g.agruparPorArtigoIA_(solto).length, 3,
  "texto sem 'Art. N' vira uma unidade por bloco, como antes");

b.fluxo("SOFIA · o prompt proíbe afirmar ausência");

b.passo("10. a instrução está no prompt, e é explícita");
/* Mesmo com seleção perfeita o trecho nunca é o documento inteiro. Sem esta
   regra, negar a existência de um artigo continuaria possível — e negar é pior
   que não achar, porque quem pergunta guarda a negação como fato. */
const ctx = g.coletarContextoSISGEP_("quem pode participar da votação?", "Estatuto", null);
const prompt = g.montarSystemPrompt_(ctx, "quem pode participar da votação?");
b.ok(
  /NUNCA afirme que um artigo n[ãa]o existe/i.test(prompt),
  "o prompt proíbe, com todas as letras, afirmar que um artigo não existe"
);
b.ok(
  /TRECHOS selecionados/i.test(prompt),
  "e diz que o documento chega em trechos, não inteiro"
);
b.ok(
  /n[ãa]o veio nos trechos/i.test(prompt),
  "oferecendo a saída certa: 'não veio nos trechos', em vez de 'não existe'"
);

b.passo("11. o bloco do documento repete o aviso onde ele é lido");
const bloco = g.blocoDocumentoIA_("ESTATUTO", ESTATUTO, PERGUNTA, 60000);
b.ok(
  /NUNCA que n[ãa]o existe/i.test(bloco),
  "o aviso vai junto do próprio documento, não só nas regras do fim"
);

b.fluxo("SOFIA · o inciso não pode ser citado sem o texto");

b.passo("12. o artigo chega com TODOS os incisos, numa unidade só");
/* Conferido no ar em 01/09, depois da correção anterior: com o art. 4º
   chegando inteiro, a SOFIA citou "Art. 4º, I" para "pleno gozo dos direitos
   associativos" — e o inciso I é "utilizar as dependências do sindicato". O
   artigo estava certo, o algarismo não. Este passo garante a PRÉ-CONDIÇÃO: o
   texto dos cinco incisos está no prompt. Se um dia não estiver, o erro deixa
   de ser de precisão e volta a ser de entrega. */
const unidade4 = porArtigo.filter(u => /^\s*Art\.\s*4º/.test(u))[0] || "";
b.ok(!!unidade4, "existe uma unidade que começa no art. 4º");
["utilizar as dependências", "votar e ser votado", "gozar dos benefícios",
 "convocar Assembleias Gerais", "direito a voz e voto"].forEach(function (txt, i) {
  b.ok(unidade4.indexOf(txt) >= 0,
    "o inciso " + ["I","II","III","IV","V"][i] + " está na mesma unidade",
    txt.substring(0, 30));
});

b.passo("13. e o art. 4º chega na pergunta sobre votação");
b.ok(trecho.indexOf("Art. 4º") >= 0,
  "o art. 4º entra no trecho — é onde está 'votar e ser votado' (inciso II)");

b.passo("14. o prompt obriga a transcrever o inciso");
/* Quem é obrigado a transcrever não erra o número: o erro fica visível na
   própria frase que ele escreve. */
b.ok(
  /transcreva o texto/i.test(prompt),
  "o prompt manda transcrever o texto do inciso junto do número"
);
b.ok(
  /cite s[óo] o artigo/i.test(prompt),
  "e dá a saída para quando o texto não veio: citar só o artigo"
);

b.naoTestavel(
  "o que a IA de fato responde depois disto",
  "o emulador não chama a Anthropic. O que se prova aqui é que o art. 88 " +
  "CHEGA, com os parágrafos dele, e que o prompt proíbe negar existência. " +
  "A conferência no ar é repetir 'quem pode participar da votação?' e ver se " +
  "o art. 88 aparece na resposta"
);

b.resumo();
