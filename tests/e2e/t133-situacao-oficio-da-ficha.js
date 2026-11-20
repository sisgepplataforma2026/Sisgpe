/**
 * t133 — MÓDULO 04 · QUAL OFÍCIO PERTENCE A QUAL FICHA
 *
 * 01/09/2026, item 54.1. Backend da tela que falta: a que dá nome ao estado
 * "MATRICULADA sem ofício" — a matrícula saiu (e não se desfaz) e a escola
 * nunca foi comunicada.
 *
 * O VÍNCULO EXISTE, MAS DO LADO CONTRÁRIO DO QUE SE PROCURA
 *
 * A ficha NÃO sabe qual é o ofício dela: o `OBSERVACOES_OFICIO` é gravado,
 * mas a coluna não existe no esquema e o `sindAdm_gravar_` descarta em
 * silêncio (item 54.3). O caminho é o inverso: o CONTROLE sabe a ficha,
 * porque o `aprovarEEncaminharFicha` manda "Matrícula 000123 · Ficha
 * FICHA-2026..." em `observacoes`, e o `gerarOficioWeb` grava isso lá.
 *
 * Por isso este cálculo não depende de mudança de esquema nenhuma — e é isso
 * que o passo 2 prova, sem inventar coluna.
 *
 * O QUE NÃO PODE ACONTECER, EM ORDEM DE GRAVIDADE
 *
 * 1. dizer que uma ficha NÃO tem ofício quando tem → a secretaria emite um
 *    ofício duplicado para a mesma filiação, e queima número oficial;
 * 2. dizer que TEM quando não tem → a escola nunca é comunicada e ninguém
 *    percebe, que é exatamente o estado invisível de hoje;
 * 3. casar a ficha errada → o card mostra o ofício de outra pessoa.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const SIN = b.logar(g, "joscimar");   /* escolas + sindicalizacao */
const FIN = b.logar(g, "rogerio");    /* financeiro + rh */

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let ctrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!ctrl) ctrl = ss.insertSheet(g.PLANILHA_REGISTRO);

const CAB = ["Número do Ofício", "Data envio ofício", "TIPO",
             "Escola (Razão Social)", "CNPJ", "E-mail (principal)",
             "E-mails (todos)", "Observações", "Link PDF (Drive)", "Status"];
ctrl.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const F1 = "FICHA-20260901100000-1111";   /* tem ofício            */
const F2 = "FICHA-20260901100000-2222";   /* NÃO tem — o órfão     */
const F3 = "FICHA-20260901100000-3333";   /* tem DOIS (reemissão)  */

ctrl.getRange(2, 1, 5, CAB.length).setValues([
  ["070/2026", "28/08/2026", "Filiação", "Escola Alfa LTDA", "11111111000111",
   "alfa@teste.com", "alfa@teste.com, dir@alfa.com",
   "Matrícula 000101 · Ficha " + F1, "https://drive.google.com/file/d/AAA", "ENVIADO"],

  ["071/2026", "28/08/2026", "Filiação", "Escola Beta LTDA", "22222222000122",
   "beta@teste.com", "beta@teste.com",
   "Matrícula 000102 · Ficha " + F3, "https://drive.google.com/file/d/BBB", "ENVIADO"],

  ["072/2026", "29/08/2026", "Filiação", "Escola Gama LTDA", "33333333000133",
   "gama@teste.com", "gama@teste.com",
   "Reemissão · Matrícula 000102 · Ficha " + F3, "https://drive.google.com/file/d/CCC", "ENVIADO"],

  /* Ruído que TEM de ser ignorado: linha de cadastro, não é ofício. */
  ["7", "", "", "Linha que não é ofício", "", "", "", "Ficha " + F2, "", ""],

  /* Ofício LIVRE, sem ficha nenhuma nas observações. */
  ["073/2026", "29/08/2026", "Livre", "Prefeitura", "", "p@p.com", "p@p.com",
   "Assunto qualquer", "https://drive.google.com/file/d/DDD", "ENVIADO"]
]);

b.fluxo("MÓDULO 04 · a porta");

b.passo("1. sem sessão e sem o módulo não responde");
/* Devolve nome de escola e e-mail de destino — é cadastro de contato saindo
   por outra porta se ficar aberta. */
const anon = tentar(() => g.sindOf_situacaoOficioDasFichas([F1], ""));
b.ok(!anon.passou, "anônimo é barrado", anon.passou ? "PASSOU" : anon.msg.substring(0, 40));
const semMod = tentar(() => g.sindOf_situacaoOficioDasFichas([F1], FIN));
b.ok(!semMod.passou, "quem não tem nenhum dos dois módulos é barrado",
  semMod.passou ? "PASSOU" : semMod.msg.substring(0, 44));

b.passo("2. e os DOIS módulos passam — é ação dos dois fluxos");
b.ok(tentar(() => g.sindOf_situacaoOficioDasFichas([F1], SIN)).passou,
  "quem tem Sindicalização consulta");
b.ok(tentar(() => g.sindOf_situacaoOficioDasFichas([F1], ADM)).passou,
  "quem tem Documentos também");

b.fluxo("MÓDULO 04 · o cruzamento ficha ↔ ofício");

const r = g.sindOf_situacaoOficioDasFichas([F1, F2, F3], ADM);
b.passo("3. responde ok, sem depender de coluna nova na aba de fichas");
b.ok(r && r.ok === true, "consulta responde", r && r.mensagem ? r.mensagem : "ok");
b.ok(!(g.SIND_ADM_COLUNAS || []).some(c => c === "OBSERVACOES_OFICIO"),
  "e a coluna OBSERVACOES_OFICIO continua NÃO existindo",
  "o cruzamento vem do Controle, não da ficha");

b.passo("4. a ficha COM ofício traz o que o card precisa mostrar");
const s1 = r.situacao[F1];
b.ok(!!s1, "a ficha 1 tem ofício");
b.igual(s1 && s1.numero, "070/2026", "o número certo");
b.igual(s1 && s1.escola, "Escola Alfa LTDA", "a escola para onde foi");
b.igual(s1 && s1.emails, "alfa@teste.com, dir@alfa.com",
  "e os e-mails de destino — é o que o Reenviar precisa");
b.ok(!!(s1 && s1.url), "o link do PDF", s1 ? s1.url : "");
b.ok(!!(s1 && s1.tipo), "e o tipo, que o reenviarOficio exige", s1 ? s1.tipo : "");

b.passo("5. E O CASO QUE A TELA EXISTE PARA MOSTRAR — a ficha órfã");
/* Se este passo falhar dizendo que a F2 tem ofício, a tela esconde o
   problema exatamente como hoje. */
b.igual(r.situacao[F2], null,
  "a ficha 2 aparece SEM ofício — matriculada e escola não comunicada");

b.passo("6. linha que não é ofício não conta como ofício");
/* A linha "7" tem o ID da ficha 2 nas observações, mas o número não é
   NNN/AAAA. Sem esta trava, a ficha órfã sumiria da lista. */
b.igual(r.situacao[F2], null,
  "a linha de cadastro com o ID da ficha foi ignorada");

b.passo("7. ficha com DOIS ofícios mostra o mais recente");
/* Reemitir para outra escola gera número novo e os dois ficam válidos —
   decisão do usuário. O card mostra o vigente; o anterior continua no
   Controle, que é o registro oficial. */
const s3 = r.situacao[F3];
b.ok(!!s3, "a ficha 3 tem ofício");
b.igual(s3 && s3.numero, "072/2026", "e é o mais recente dos dois");
b.igual(s3 && s3.escola, "Escola Gama LTDA", "com a escola da reemissão");
b.ok(s3 && s3.reemissao === true, "marcado como reemissão");

b.passo("8. o ofício LIVRE, que não é de ficha nenhuma, não entra");
const texto = JSON.stringify(r.situacao);
b.ok(texto.indexOf("073/2026") === -1,
  "o 073/2026 não foi atribuído a ficha nenhuma");
b.ok(texto.indexOf("Prefeitura") === -1, "nem a Prefeitura apareceu");

b.fluxo("MÓDULO 04 · o que não pode quebrar");

b.passo("9. lista vazia não varre a planilha à toa");
const vazio = g.sindOf_situacaoOficioDasFichas([], ADM);
b.ok(vazio && vazio.ok === true, "responde ok");
b.igual(vazio.situacao, {}, "com mapa vazio");

b.passo("10. id que não existe volta como sem ofício, não como erro");
const inexistente = g.sindOf_situacaoOficioDasFichas(["FICHA-NAO-EXISTE"], ADM);
b.ok(inexistente && inexistente.ok === true, "responde ok");
b.igual(inexistente.situacao["FICHA-NAO-EXISTE"], null, "e diz que não tem ofício");

b.passo("11. E O CASO QUE MENTIRIA FEIO — Controle sem as colunas do cruzamento");
/* Sem "Observações" não há como cruzar. Devolver "nenhuma tem ofício" faria a
   tela mostrar 100% de pendência e mandar emitir ofício duplicado para todo
   mundo — queimando número oficial em série. Tem que recusar dizendo por quê. */
(function () {
  const semObs = ["Número do Ofício", "Data envio ofício", "TIPO",
                  "Escola (Razão Social)", "CNPJ", "E-mail (principal)",
                  "E-mails (todos)", "SEM_A_COLUNA", "Link PDF (Drive)", "Status"];
  ctrl.getRange(1, 1, 1, semObs.length).setValues([semObs]);
  /* O getHeaderMap_ (Utils.gs:46) guarda o mapa por 5 minutos. Sem limpar,
     trocar o cabeçalho não tem efeito nenhum e este passo mediria o cache em
     vez da trava — foi o que aconteceu na primeira versão deste teste. */
  g._headerCache = {};
  const quebrado = g.sindOf_situacaoOficioDasFichas([F1, F2], ADM);
  b.ok(quebrado && quebrado.ok === false,
    "recusa em vez de dizer que ninguém tem ofício",
    quebrado && quebrado.ok ? "DISSE QUE NINGUÉM TEM — emitiria duplicado" : "recusou");
  b.ok(/Observa/i.test(String(quebrado && quebrado.mensagem || "")),
    "e a mensagem nomeia a coluna que falta",
    String(quebrado && quebrado.mensagem || "").substring(0, 56));
  ctrl.getRange(1, 1, 1, CAB.length).setValues([CAB]);
  g._headerCache = {};
})();

b.naoTestavel(
  "se a produção tem fichas MATRICULADAS sem ofício, e quantas",
  "é a pergunta que a tela existe para responder, e só a produção responde. " +
  "Depois de publicar, o chip \"SEM OFÍCIO\" mostra o número na hora"
);

b.resumo();
