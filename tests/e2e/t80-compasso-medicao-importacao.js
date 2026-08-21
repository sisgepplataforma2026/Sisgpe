/**
 * MEDIR DE VERDADE, E IMPORTAR A PLANILHA DO ANO PASSADO SEM TROCAR COLUNA
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. O usuário fixou a data e o que precisa:
 *
 *   "preciso fazer teste, por isso a questão de medir o consumo do Firebase,
 *    porque o acesso é no dia dezenove de dezembro. Então preciso fazer teste
 *    se o QR Code é validado, se vai dar algum erro. Eu já tenho uma planilha
 *    do ano passado, quero utilizar ela como base."
 *
 * DUAS COISAS, E AS DUAS TÊM UMA ARMADILHA
 *
 * 1. MEDIR. O EventosFirebaseCusto.gs ESTIMA por fórmula e explica por que não
 *    mede: "não gravamos um documento de métrica a cada operação porque isso
 *    aumentaria artificialmente o próprio consumo". A objeção está certa. A
 *    saída é contar EM MEMÓRIA e reportar no fim — zero operação extra.
 *
 *    E a armadilha da medição: o que a Google cobra é DOCUMENTO lido, não
 *    chamada. Um `fs_list_` de 2.000 ingressos custa 2.000 leituras. Contar
 *    chamadas esconderia justo a operação mais cara do sistema.
 *
 * 2. IMPORTAR. Eu não vejo a planilha dele. O importador lê o CABEÇALHO e
 *    descobre as colunas — e a armadilha aqui é uma planilha com "Nome da
 *    Escola" ANTES de "Nome". Um mapeador ingênuo dá o nome da pessoa como
 *    sendo a escola, e ninguém percebe até o ingresso sair errado.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. contar chamada em vez de documento lido ................. 1 falha
 *   2. mapear por "contém" antes de igualdade exata ............ 1 falha
 *   3. o contador ligado por padrão ............................ 1 falha
 *   4. a limpeza apagar inscrição que não veio da importação ... 1 falha
 *   5. a limpeza não devolver as vagas ......................... 1 falha
 *   6. importar sem conferir CPF ............................... 1 falha
 *   7. importar por outra porta que não a pública .............. 1 falha
 *   8. o total cobrado ignorar os documentos listados .......... 1 falha
 *  3b. a medição não desligar ao fechar ....................... 1 falha
 *
 * A #3 sobreviveu na primeira rodada: a asserção casava com `FS_METRICAS = {`
 * e havia DOIS — a declaração e o reset dentro de fs_medirFechar_. Ligar o
 * contador na declaração deixava o reset com `false` e o teste verde.
 * Ancorada no `var`, ela morde — e revelou a 3b.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const imp   = semComentario(ler("EventosImportacaoTeste.gs"));
const store = semComentario(ler("EventosFirestore.gs"));
const query = semComentario(ler("EventosFirestoreQuery.gs"));
const custo = semComentario(ler("EventosFirebaseCusto.gs"));

function corpoDe(src, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(src);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < src.length && prof > 0) {
    const c = src[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: src.slice(m.index + m[0].length, i - 1) };
}

fluxo("MEDIÇÃO · Contar o que a Google cobra, não o que é fácil contar");

/* ─── 1. o contador nasce desligado ─── */
passo("o contador não pode pesar quando ninguém pediu");

/* Ancorado no `var` da DECLARAÇÃO. Sem o `var`, a regex também casava com o
   reset dentro de fs_medirFechar_ — e a mutação passou por cima: ligando o
   contador na declaração, o reset continuava com `false` e o teste verde. */
ok(/var FS_METRICAS = \{ ligado: false/.test(store),
   "o contador nasce DESLIGADO na declaração",
   "ligado por padrão, ele custaria trabalho em toda execução do sistema");

ok(/FS_METRICAS = \{ ligado: false[\s\S]{0,200}\}\;\s*\n\s*var teto/.test(store) ||
   (store.match(/FS_METRICAS = \{ ligado: false/g) || []).length >= 2,
   "e volta a DESLIGADO quando a medição fecha",
   "medição que fica ligada pesa em toda execução seguinte");

ok(/function fs_medirIniciar_/.test(store) && /function fs_medirFechar_/.test(store),
   "e existe começar/fechar explícito");

/* Zero escrita no Firestore para medir — era a objeção do EventosFirebaseCusto. */
const medir = corpoDe(store, "fs_medirIniciar_").corpo +
              corpoDe(store, "fs_medirFechar_").corpo;
igual(["fs_set_", "UrlFetchApp", "appendRow"].filter(m => medir.indexOf(m) >= 0), [],
      "medir NÃO grava nada, em lugar nenhum",
      "gravar métrica por operação dobraria as escritas — é a objeção registrada " +
      "no cabeçalho do EventosFirebaseCusto.gs, e ela está certa");

/* ─── 2. A ARMADILHA: documento lido, não chamada ─── */
passo("o que a Google cobra");

ok(/FS_METRICAS\.docsLidos \+= out\.length/.test(query),
   "fs_list_ conta os DOCUMENTOS que trouxe, não a chamada",
   "um list de 2.000 ingressos custa 2.000 leituras — contar 1 esconderia " +
   "justo a operação mais cara do sistema");

const fechar = corpoDe(store, "fs_medirFechar_").corpo;
ok(/m\.leituras \+ m\.docsLidos/.test(fechar),
   "e o total cobrado soma get + documentos listados");

/* Executa o fechamento e confere a conta. */
const relatorio = new Function("FS_METRICAS", "COMPASSO_FIREBASE_BUDGET", "Date",
  fechar.replace(/FS_METRICAS = \{[^}]*\};/, "")
)({ ligado: true, leituras: 10, gravacoes: 5, listagens: 2, consultas: 1,
    docsLidos: 2000, inicio: 0, rotulo: "teste" },
  { LEITURAS_DIA: 50000, GRAVACOES_DIA: 20000 }, Date);

igual(relatorio.leiturasCobradas, 2010,
      "10 gets + 2.000 documentos listados = 2.010 leituras cobradas",
      "é o número que decide se cabe na faixa gratuita");
igual(relatorio.percentualDoTetoDiario.leituras, "4%",
      "e ele vira percentual do teto diário");

ok(/function compasso_medirRodada/.test(custo),
   "há uma função que roda carga e mede");

const rodada = corpoDe(custo, "compasso_medirRodada").corpo;
ok(/compasso_assertHomologacao_/.test(rodada) &&
   /exigirAdminOuSessao_\([^)]*,\s*true\s*\)/.test(rodada),
   "medir exige homologação E administrador",
   "ela cria dado de verdade");

ok(/Projeção p\/ 2\.000/.test(rodada),
   "e projeta de 50 para 2.000",
   "o número que importa é o da festa, não o do lote de teste");

fluxo("IMPORTAÇÃO · A planilha do ano passado, sem trocar coluna");

/* ─── 3. O MAPEADOR, executado contra cabeçalhos reais ─── */
passo("descobrir qual coluna é qual");

const COLS = eval("(" + imp.match(/var COMPASSO_IMPORT_COLUNAS = (\{[\s\S]*?\n\});/)[1] + ")");
const normalizar = new Function(...corpoDe(imp, "compasso_normalizarTexto_").args,
                                corpoDe(imp, "compasso_normalizarTexto_").corpo);
const mapear = cab => new Function("cabecalho", "COMPASSO_IMPORT_COLUNAS",
  "compasso_normalizarTexto_", corpoDe(imp, "compasso_importarMapear_").corpo
)(cab, COLS, normalizar);

function conferir(rotulo, cabecalho, esperado) {
  const r = mapear(cabecalho);
  const obtido = {};
  Object.keys(esperado).forEach(function (k) {
    obtido[k] = r.mapa[k] === undefined ? null : cabecalho[r.mapa[k]];
  });
  igual(obtido, esperado, rotulo);
}

conferir("cabeçalho clássico",
  ["Nome Completo", "CPF", "Escola", "Cidade", "E-mail", "WhatsApp"],
  { nome: "Nome Completo", cpf: "CPF", escola: "Escola", cidade: "Cidade",
    email: "E-mail", whatsapp: "WhatsApp" });

conferir("caixa alta e sinônimos",
  ["NOME", "CPF", "LOTAÇÃO", "MUNICÍPIO", "EMAIL", "CELULAR"],
  { nome: "NOME", cpf: "CPF", escola: "LOTAÇÃO", cidade: "MUNICÍPIO",
    email: "EMAIL", whatsapp: "CELULAR" });

conferir("planilha de Google Forms, com colunas a mais",
  ["Carimbo de data/hora", "Nome do associado", "C.P.F", "Unidade",
   "Cidade/Município", "Endereço de e-mail", "Telefone", "Observação"],
  { nome: "Nome do associado", cpf: "C.P.F", escola: "Unidade",
    cidade: "Cidade/Município", email: "Endereço de e-mail", whatsapp: "Telefone" });

/* A ARMADILHA. "Nome da Escola" vem ANTES de "Nome": um mapeador que casa por
   "contém" na primeira passada daria nome = "Nome da Escola", e o ingresso
   sairia com a escola no lugar da pessoa. Ninguém perceberia até a portaria. */
conferir("ARMADILHA: 'Nome da Escola' antes de 'Nome'",
  ["Nome da Escola", "Nome", "CPF", "Cidade", "E-mail", "Fone"],
  { nome: "Nome", cpf: "CPF", escola: "Nome da Escola", cidade: "Cidade",
    email: "E-mail", whatsapp: "Fone" });

const mapeador = corpoDe(imp, "compasso_importarMapear_").corpo;
ok(mapeador.indexOf("apelidos.indexOf(normalizado[i]) >= 0") <
   mapeador.indexOf("normalizado[j].indexOf(apelidos[k]) >= 0"),
   "igualdade exata roda ANTES de 'contém'",
   "é exatamente o que faz a armadilha acima não pegar");

/* ─── 4. conferir antes de importar ─── */
passo("mostrar o que entendeu antes de gravar");

const conf = corpoDe(imp, "compasso_importarConferir").corpo;
igual(["fs_set_", "compasso_criarInscricao"].filter(m => conf.indexOf(m) >= 0), [],
      "conferir NÃO grava nada",
      "é o passo que impede importar 400 pessoas com a coluna trocada");

ok(/AS 5 PRIMEIRAS LINHAS/.test(conf),
   "e mostra as primeiras linhas como as leria",
   "coluna trocada salta aos olhos numa amostra; nenhuma validação substitui isso");

ok(/CPF válido/.test(conf) && /Sem contato/.test(conf),
   "com o diagnóstico do arquivo inteiro",
   "quantos CPFs válidos, quantos sem contato — sem contato não recebe ingresso");

/* ─── 5. importar pelo caminho real ─── */
passo("o que a importação usa");

const exec = corpoDe(imp, "compasso_importarExecutar").corpo;
ok(/compasso_criarInscricaoAssociado_publica_/.test(exec),
   "importa pelo MESMO caminho da inscrição pública",
   "importar por outra porta provaria outra coisa — o objetivo é testar aquele caminho");

ok(/compasso_cpfValido_\(p\.cpf\)/.test(exec),
   "e confere o CPF de cada linha");

ok(/compasso_assertHomologacao_/.test(exec),
   "só roda em homologação");

ok(/fs_medirIniciar_/.test(exec) && /fs_medirFechar_/.test(exec),
   "a importação já vem medida",
   "é a primeira carga real, e o número dela vale");

/* ─── 6. a limpeza não pode levar junto o que não é dela ─── */
passo("desfazer sem estrago");

const limpar = corpoDe(imp, "compasso_importarLimpar").corpo;
ok(/origem \|\| ''\) === COMPASSO_IMPORT_ORIGEM/.test(limpar),
   "apaga SÓ o que veio da importação",
   "inscrição feita pela tela pública durante o teste tem outra origem — " +
   "apagá-la junto seria pior que não ter limpeza");

ok(/if \(ins\.ingressoId\) \{ comIngresso\+\+; return; \}/.test(limpar),
   "e não apaga quem já tem ingresso emitido",
   "o QR está emitido e a vaga consumida — o caminho é cancelar o ingresso antes");

ok(/r\.reservadas = Math\.max\(0, Number\(r\.reservadas \|\| 0\) - apagadas\)/.test(limpar),
   "devolve as vagas ao contador",
   "sem isso, cada rodada de teste comeria vagas das 2.000 para sempre");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("o consumo real do Firebase",
      "isto prova que a CONTA está certa. O número só sai rodando " +
      "compasso_medirRodada em homologação — e o painel do Firebase " +
      "continua sendo a fonte de verdade da cobrança");

aviso("que a planilha do usuário será lida corretamente",
      "os cabeçalhos aqui são realistas, mas inventados por mim. " +
      "compasso_importarConferir existe exatamente para isso: rodar com a " +
      "planilha DELE e conferir o mapeamento antes de importar");

resumo();
