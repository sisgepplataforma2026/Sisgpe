/**
 * IMPORTAR PLANILHA PELA TELA — CONFERIR ANTES, GRAVAR DEPOIS
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. O usuário: *"Tem local para enviar planilha?"* — e não tinha. A
 * importação existia só por `COMPASSO_IMPORT_PLANILHA` nas Propriedades do
 * script, que é lugar de configuração de sistema, não de operação. Depois ele
 * definiu como queria: *"seria mais uma opção, por exemplo anexar uma
 * planilha e o painel reconhecer"*.
 *
 * O QUE ESTE TESTE GUARDA, E POR QUÊ
 *
 * A ordem dos passos É a segurança: conferir → prévia → importar. O passo de
 * conferência é o que impede importar 400 pessoas com a coluna de escola no
 * lugar do nome, e ele só serve se NÃO GRAVAR NADA. Por isso as duas
 * primeiras asserções injetam um `compasso_criarInscricaoAssociado_publica_`
 * que EXPLODE: se a conferência gravar, o teste não passa — ele quebra.
 *
 * A ARMADILHA DO MAPEAMENTO
 *
 * "Nome da Escola" contém "Nome". Um mapeador que procure por "contém" antes
 * de tentar igualdade exata rouba a coluna do nome da pessoa e importa 400
 * cadastros com o nome da escola no campo errado — e ninguém percebe até a
 * portaria. O teste executa o mapeador contra um cabeçalho armado justamente
 * assim.
 *
 * O ANEXO NÃO PODE FICAR NO DRIVE
 *
 * A planilha vira arquivo temporário para ser convertida. Se a leitura
 * estourar no meio, o temporário TEM de ser apagado assim mesmo — senão cada
 * tentativa frustrada deixa lixo no Drive de quem operou. É a asserção do
 * `finally`, e ela roda os dois caminhos: sucesso e exceção.
 *
 * MUTAÇÕES MATADAS (21/08/2026) — 12 de 12, nenhuma sobrevivente
 *
 *   1. a conferência passar a gravar ........................ quebra dura
 *   2. o desempate por apelido mais longo sumir ............. 4 falhas
 *   3. CPF inválido entrar na importação .................... 5 falhas
 *   4. a prévia não dizer o motivo da recusa ................ 1 falha
 *   5. o temporário do Drive não ser apagado ................ 2 falhas
 *   6. a coluna apontada pela pessoa ser ignorada ........... 2 falhas
 *   7. o limite de linhas ser ignorado ...................... 1 falha
 *   8. aceitar arquivo de qualquer extensão ................. 3 falhas
 *   9. apelidos fracos voltarem a ter voz ................... 4 falhas
 *  10. a primeira passada já incluir os fracos .............. 4 falhas
 *  11. a rota voltar a createHtmlOutputFromFile ............. 1 falha
 *  12. o botão de remover arquivo sumir ..................... 1 falha
 *  13. remover parar de limpar a conferência anterior ....... 1 falha
 *
 * UMA MUTAÇÃO FOI RETIRADA, E VALE DIZER POR QUÊ
 *
 * Havia uma 2b — "o maior apelido virar o primeiro que casar". Ela mordia
 * antes dos apelidos fracos, e depois deles deixou de morder: rodando as duas
 * versões contra 5.445 combinações, os casos que ela distinguia eram
 * justamente aqueles em que `associado` interferia — e agora `associado` não
 * vota. Ficou equivalente na prática.
 *
 * O desempate por comprimento continua no código, e continua necessário: é
 * ele que faz `escola` (6) vencer `nome` (4) em "Nome da Escola", que a
 * mutação 2 prova. Mutação que virou equivalente sai da lista; a regra que
 * ela cobria fica, guardada por outra.
 *
 * O QUE A MUTAÇÃO ACHOU — e não era só no teste
 *
 * A mutação 2 sobreviveu duas vezes, e da segunda revelou um DEFEITO REAL do
 * mapeador, que existia desde antes desta tela.
 *
 * O cabeçalho de exemplo tinha "Nome do Servidor" ANTES de "Nome da Escola",
 * e isso escondia o problema: o mapeador achava a coluna certa por sorte de
 * posição. Invertendo a ordem — como vem em planilha exportada de sistema —,
 * nenhum apelido casava por igualdade exata, o passo "contém" pegava
 * "Nome da Escola" para o campo `nome`, e a importação inteira sairia com o
 * nome da escola no lugar do nome da pessoa.
 *
 * A correção foi o desempate por apelido mais longo (`escola` 6 vence `nome`
 * 4). E a mutação 2b, sobre esse desempate, eu SUPUS que fosse inofensiva —
 * rodei as duas versões contra 5.445 combinações de apelidos e eram 666 os
 * títulos que mudavam de campo, um deles "CPF do Associado (titular)", que é
 * cabeçalho de planilha real. Supor que uma mutação é equivalente sem medir
 * é o mesmo erro de supor que uma asserção morde sem mutá-la.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const tela = ler("EventosImportacaoTela.gs");
const teste = ler("EventosImportacaoTeste.gs");
const admin = ler("EventosAdmin.html");
const code = ler("Code.gs");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: codigo.slice(m.index + m[0].length, i - 1) };
}
const fn = (codigo, nome, deps) => {
  const a = corpoDe(codigo, nome);
  const nomes = Object.keys(deps || {});
  return (...vals) => new Function(...a.args, ...nomes, a.corpo)(
    ...vals, ...nomes.map(n => (deps || {})[n]));
};

/* ── as peças reaproveitadas do arquivo antigo ── */
const normalizar = fn(teste, "compasso_normalizarTexto_", {});
const COLUNAS = eval("(" + (teste.match(/var COMPASSO_IMPORT_COLUNAS = (\{[\s\S]*?\n\});/) || [])[1] + ")");
/* 'associado' e 'participante' dizem DE QUEM, não O QUÊ — entraram como
   apelidos fracos em 21/08/2026, depois de a planilha real do usuário mapear
   "E-mail do associado(a):" para o campo nome. */
const FRACOS = eval("(" + (teste.match(/var COMPASSO_APELIDOS_FRACOS = (\[[^\]]*\]);/) || [])[1] + ")");
const apelidoFraco = fn(teste, "compasso_apelidoFraco_", { COMPASSO_APELIDOS_FRACOS: FRACOS });
const maiorApelido = fn(teste, "compasso_importarMaiorApelido_", {
  compasso_apelidoFraco_: apelidoFraco });
const campoMaisForte = fn(teste, "compasso_importarCampoMaisForte_", {
  COMPASSO_IMPORT_COLUNAS: COLUNAS, compasso_importarMaiorApelido_: maiorApelido });
const mapear = fn(teste, "compasso_importarMapear_", {
  compasso_normalizarTexto_: normalizar,
  COMPASSO_IMPORT_COLUNAS: COLUNAS,
  compasso_importarMaiorApelido_: maiorApelido,
  compasso_importarCampoMaisForte_: campoMaisForte
});
const linhaPara = fn(teste, "compasso_importarLinha_", {});
const cpfValido = fn(ler("EventosInscricaoPublica.gs"), "compasso_cpfValido_", {});
const recusar = fn(tela, "compassoImp_recusar_", { compasso_cpfValido_: cpfValido });

/* CPFs com dígito verificador correto. */
const CPF_A = "52998224725", CPF_B = "11144477735", CPF_RUIM = "11111111111";

/* A planilha do ano passado, com as armadilhas de sempre. */
const GRID = [
  ["Matrícula", "Nome do Servidor", "CPF", "Nome da Escola", "Município", "E-mail institucional", "Celular"],
  ["001", "MARIA APARECIDA", CPF_A, "EEEFM CENTRAL", "Vitória", "maria@edu.es.gov.br", "27999998888"],
  ["002", "JOÃO DA SILVA", CPF_B, "EMEF NORTE", "Serra", "joao@edu.es.gov.br", "27999997777"],
  ["003", "ANA PAULA", CPF_RUIM, "EEEFM SUL", "Vila Velha", "", "27999996666"],
  ["004", "", CPF_A, "EMEF LESTE", "Cariacica", "", ""],
  ["", "", "", "", "", "", ""]
];

fluxo("IMPORTAR PLANILHA · confere antes, grava depois");

/* ─────────────────────────────────────────────────────────────────────────
   1. O MAPEADOR — a armadilha do "Nome da Escola"
   ───────────────────────────────────────────────────────────────────────*/
passo("qual coluna é qual");

const m = mapear(GRID[0]);

/* MUTAÇÃO 2: se o mapeador tentar "contém" antes de igualdade exata, "Nome da
   Escola" rouba a coluna do nome — e 400 pessoas entram com o nome errado. */
igual(m.mapa.nome, 1,
      "'Nome do Servidor' vira o campo nome (coluna 2)",
      "'Nome da Escola' contém 'Nome': é a troca que estraga a importação inteira");
igual(m.mapa.escola, 3, "'Nome da Escola' vira escola (coluna 4)");
igual(m.mapa.cpf, 2, "CPF na coluna 3");
igual(m.mapa.cidade, 4, "'Município' vira cidade");
igual(m.mapa.whatsapp, 6, "'Celular' vira whatsapp");

/* A ORDEM DAS COLUNAS NÃO PODE DECIDIR O RESULTADO.
 *
 * Este caso foi encontrado por mutação em 21/08/2026, e revelou um defeito
 * REAL — não só um furo no teste. No cabeçalho acima, "Nome do Servidor" vem
 * antes de "Nome da Escola", e isso escondia o problema: o mapeador achava a
 * coluna certa por sorte de posição.
 *
 * Invertendo a ordem, nenhum apelido casa por igualdade exata, e o passo
 * "contém" pegava "Nome da Escola" para o campo `nome`. Planilha exportada de
 * sistema traz a escola antes do servidor com frequência. */
const armadilha = mapear(["Nome da Escola", "Nome do Servidor", "CPF", "Município"]);
igual(armadilha.mapa.nome, 1,
      "com a ESCOLA vindo primeiro, o nome ainda é o do servidor",
      "sem o desempate por apelido mais longo, 400 pessoas entram com o nome da escola");
igual(armadilha.mapa.escola, 0, "e a escola fica com a coluna dela");

igual(campoMaisForte("nome da escola"), "escola",
      "'nome da escola' pertence a escola — 'escola' (6) vence 'nome' (4)");
igual(campoMaisForte("nome do servidor"), "nome",
      "'nome do servidor' pertence a nome — 'servidor' (8) vence");

/* E o desempate tem de ser pelo MAIS LONGO, não pelo primeiro que casar.
 *
 * "CPF do Associado (titular)" contém 'cpf do associado' (16, de `cpf`) e
 * 'associado' (9, de `nome`). Pegando o primeiro apelido que casa em cada
 * lista, `cpf` ofereceria só 'cpf' (3) e PERDERIA para 'associado' — a coluna
 * do CPF viraria o campo nome.
 *
 * Achado em 21/08/2026 rodando as duas versões contra 5.445 combinações de
 * apelidos: 666 títulos mudam de campo. Eu tinha suposto que a diferença
 * fosse inofensiva; era o contrário. */
const cpfTitular = mapear(["CPF do Associado (titular)", "Nome do Servidor"]);
igual(cpfTitular.mapa.cpf, 0,
      "'CPF do Associado (titular)' é o CPF, não o nome",
      "'cpf do associado' (16) tem de vencer 'associado' (9)");
igual(cpfTitular.mapa.nome, 1, "e o nome fica com a coluna do servidor");

/* ─────────────────────────────────────────────────────────────────────────
   O CABEÇALHO REAL DA PLANILHA DO SINDICATO
   ─────────────────────────────────────────────────────────────────────────
   Colado do arquivo que o usuário importou em 21/08/2026 — o Sorteio de Dia
   dos Pais, 201 linhas, exportado do Google Formulários. A tela mostrou
   `nome → "E-mail do associado(a):"`, e ele avisou.

   O desempate por apelido mais longo, criado horas antes, tinha dado a
   vitória a `associado` (9) sobre `e-mail` (6). Formulário do sindicato
   termina QUASE TODA coluna em "do associado(a):" — a palavra que menos
   distingue era a que mais pesava.

   Este é o cabeçalho de verdade, e ele fica aqui como teste permanente: é o
   formato que vai voltar em toda planilha de inscrição do sindicato. */
passo("o cabeçalho real, do formulário do sindicato");

const REAL = mapear([
  "Carimbo de data/hora",
  "Nome completo do associado(a):",
  "E-mail do associado(a):",
  "CPF (Cadastro de Pessoa Física):",
  "Escola / Instituição onde trabalha:",
  "Cidade onde trabalha:",
  "Telefone (WhatsApp) do associado(a):",
  "TERMO DE COMPROMISSO DIGITAL: Inscrição–Especial de Dia dos Pais 2026|SindEducação-ES"
]);

igual(REAL.mapa.nome, 1,
      "'Nome completo do associado(a):' é o nome",
      "foi o que quebrou: 'associado' roubou esta coluna para outro campo");
igual(REAL.mapa.email, 2,
      "'E-mail do associado(a):' é o e-mail, não o nome",
      "é o caso exato que o usuário viu na tela");
igual(REAL.mapa.cpf, 3, "'CPF (Cadastro de Pessoa Física):' é o CPF");
igual(REAL.mapa.escola, 4, "'Escola / Instituição onde trabalha:' é a escola");
igual(REAL.mapa.cidade, 5, "'Cidade onde trabalha:' é a cidade");
igual(REAL.mapa.whatsapp, 6, "'Telefone (WhatsApp) do associado(a):' é o WhatsApp");
igual(REAL.mapa.rg, undefined,
      "e rg fica sem coluna — esta planilha não tem",
      "campo que não existe tem de ficar vazio, não pegar a coluna de outro");

/* A regra em si, para o motivo ficar legível a quem mexer depois. */
igual(campoMaisForte("e-mail do associado(a):"), "email",
      "'associado' não decide nada quando há apelido forte na coluna");
igual(campoMaisForte("telefone (whatsapp) do associado(a):"), "whatsapp",
      "  nem aqui");
igual(campoMaisForte("associado"), "nome",
      "mas uma coluna chamada só 'Associado' ainda vira nome",
      "fraco não é inútil: decide quando é o único que aparece");

/* ─────────────────────────────────────────────────────────────────────────
   2. A RECUSA — o que não entra, e por quê
   ───────────────────────────────────────────────────────────────────────*/
passo("o que a prévia precisa avisar antes");

igual(recusar(linhaPara(GRID[1], m.mapa)), "", "linha boa entra");
/* MUTAÇÃO 3 */
igual(recusar(linhaPara(GRID[3], m.mapa)), "CPF inválido",
      "CPF de dígitos repetidos é recusado com motivo",
      "descobrir isso na portaria é tarde demais");
igual(recusar(linhaPara(GRID[4], m.mapa)), "sem nome", "linha sem nome é recusada");

/* A TRAVA QUE FALTOU EM 24/08/2026 — e que teria economizado o dia inteiro.
 *
 * O mapeador errou e mandou a coluna de e-mail para o campo nome. 122 linhas
 * foram gravadas com "fulano@gmail.com" no lugar do nome, e ninguém foi
 * avisado — porque esta função, a última porta antes de gravar, só perguntava
 * se o nome estava vazio.
 *
 * Pior: a outra porta de importação (a do editor) JÁ exigia nome com espaço,
 * e teria recusado as 122 na hora. A regra frouxa estava exatamente no
 * caminho que a pessoa usa de verdade. Agora a regra é uma só, e vive aqui. */
igual(recusar({ nome: "fulano@gmail.com", cpf: CPF_A }),
      "o nome parece um e-mail — confira o mapeamento das colunas",
      "E-MAIL NO CAMPO NOME É RECUSADO, dizendo onde está o erro",
      "sem isto, a coluna trocada só aparece depois de 122 cadastros gravados");
igual(recusar({ nome: "MARIA", cpf: CPF_A }), "nome sem sobrenome (MARIA)",
      "e nome de uma palavra só também é recusado",
      "é a mesma regra que a porta do editor já tinha; agora as duas usam esta");
igual(recusar({ nome: "MARIA APARECIDA", cpf: CPF_A }), "",
      "nome de gente continua passando");

/* A costura: a outra porta tem de chamar ESTA função, não uma cópia. */
ok(/compassoImp_recusar_\(p\)/.test(teste),
   "a importação pelo editor usa a mesma recusa da tela",
   "duas regras para a mesma checagem é uma delas ficando para trás");
igual(recusar({ nome: "MARIA SILVA", cpf: "123" }), "CPF com 3 dígito(s)",
      "CPF curto diz QUANTOS dígitos tem",
      "'CPF inválido' genérico não ajuda quem vai corrigir a planilha");

/* ─────────────────────────────────────────────────────────────────────────
   3. A PRÉVIA — mostra sem gravar
   ───────────────────────────────────────────────────────────────────────*/
passo("as 5 primeiras linhas, já com veredito");

const previa = fn(tela, "compassoImp_previa_", {
  compasso_importarLinha_: linhaPara,
  compassoImp_recusar_: recusar
})(GRID.slice(1), m.mapa, 5);

igual(previa.length, 5, "devolve 5 linhas");
igual(previa[0].ok, true, "a primeira passa");
igual(previa[2].ok, false, "a terceira não");
/* MUTAÇÃO 4 */
ok(previa[2].motivo.length > 0,
   "e a prévia diz o motivo: " + previa[2].motivo,
   "linha vermelha sem motivo não diz o que corrigir");
igual(previa[0].linha, 2,
      "a numeração é a da PLANILHA (linha 2), não a do array",
      "quem vai corrigir procura pela linha da planilha");

/* ─────────────────────────────────────────────────────────────────────────
   4. CONFERIR NÃO GRAVA  — a asserção central
   ───────────────────────────────────────────────────────────────────────*/
passo("o passo 2 não pode tocar no Firestore");

/* MUTAÇÃO 1: as dependências abaixo são armadilhas. Se a conferência gravar,
   o teste QUEBRA — não falha com elegância, quebra. É de propósito. */
let apagouTemporario = false;
function conferir(gridUsado, aba) {
  apagouTemporario = false;
  return fn(tela, "compassoImp_conferir", {
    exigirAdminOuSessao_: () => "",
    compasso_assertHomologacao_: () => {},
    compasso_importarMapear_: mapear,
    compasso_importarLinha_: linhaPara,
    compassoImp_recusar_: recusar,
    compassoImp_previa_: fn(tela, "compassoImp_previa_", {
      compasso_importarLinha_: linhaPara, compassoImp_recusar_: recusar }),
    compassoImp_abrir_: () => ({ grid: gridUsado, nomeAba: aba || "Inscritos",
                                 abas: ["Inscritos", "Outra"] }),
    compasso_criarInscricaoAssociado_publica_: () => {
      throw new Error("CONFERIR NÃO PODE GRAVAR");
    },
    fs_set_: () => { throw new Error("CONFERIR NÃO PODE GRAVAR"); },
    compasso_auditar_: () => { throw new Error("CONFERIR NÃO AUDITA — não fez nada"); }
  })({ base64: "x", nome: "a.xlsx" }, aba, "");
}

const c = conferir(GRID);
igual(c.ok, true, "a conferência responde sem gravar nada");
igual(c.linhas, 4,
      "conta 4 linhas de dados — a linha em branco do fim não entra",
      "planilha exportada quase sempre termina com linhas vazias");
igual(c.abas.join(","), "Inscritos,Outra", "devolve as abas para a tela escolher");
igual(c.previa.length, 4, "e a prévia vem junto");

/* As colunas que sobraram, ditas por nome: é o que faz a pessoa perceber que
   a coluna que ela procura está ali com outro título. */
ok(c.naoUsadas.some(x => /Matr/i.test(x.titulo)),
   "diz quais colunas não usou: " + c.naoUsadas.map(x => x.titulo).join(", "));

/* ─────────────────────────────────────────────────────────────────────────
   5. IMPORTAR — grava, respeita limite e o que a pessoa apontou
   ───────────────────────────────────────────────────────────────────────*/
passo("o passo 4, o único que grava");

function importar(limite, mapaManual, gridUsado) {
  const criadas = [];
  const auditado = [];
  const r = fn(tela, "compassoImp_importar", {
    exigirAdminOuSessao_: () => "",
    compasso_assertHomologacao_: () => {},
    compasso_importarMapear_: mapear,
    compasso_importarLinha_: linhaPara,
    compassoImp_recusar_: recusar,
    COMPASSO_IMPORT_ORIGEM: "IMPORTACAO_TESTE",
    compassoImp_abrir_: () => ({ grid: gridUsado || GRID, nomeAba: "Inscritos", abas: ["Inscritos"] }),
    compasso_criarInscricaoAssociado_publica_: p => { criadas.push(p); return { ok: true }; },
    compasso_auditar_: (a, t, i, extra) => auditado.push({ a, extra })
  })({ base64: "x", nome: "a.xlsx" }, "Inscritos", limite, mapaManual, "");
  return { r, criadas, auditado };
}

const imp = importar(10, {});
igual(imp.r.ok, true, "importa");
igual(imp.criadas.length, 2,
      "cria só as 2 linhas boas — as 2 ruins ficam de fora",
      "CPF inválido e linha sem nome não viram inscrição");
igual(imp.r.ignoradas.length, 2, "e as ignoradas voltam com motivo");
igual(imp.criadas[0].origem, "IMPORTACAO_TESTE",
      "com origem marcada — é o que permite limpar depois sem tocar no resto");

/* MUTAÇÃO 7 */
const limitado = importar(1, {});
igual(limitado.criadas.length, 1,
      "o limite é respeitado: 1 linha pedida, 1 criada",
      "começar com 10 e conferir é a diferença entre erro barato e caro");

/* MUTAÇÃO 6: a pessoa está olhando a planilha; eu estou olhando o nome da
   coluna. O que ela aponta vence. */
const GRID_SEM_EMAIL = [
  ["Nome", "CPF", "Escola", "Contato eletrônico"],
  ["MARIA SILVA", CPF_A, "EEEFM CENTRAL", "maria@x.com"]
];
const semApontar = importar(10, {}, GRID_SEM_EMAIL);
igual(semApontar.criadas[0].email, "",
      "coluna com título estranho não é adivinhada");
const apontando = importar(10, { email: 3 }, GRID_SEM_EMAIL);
igual(apontando.criadas[0].email, "maria@x.com",
      "mas a coluna que a pessoa aponta na tela é usada",
      "senão ela teria de editar a planilha só para renomear um cabeçalho");
igual(apontando.r.ajustesDeColuna, 1, "e o ajuste é contado no relatório");

igual(imp.auditado.length, 1, "a importação é auditada");
igual(imp.auditado[0].a, "IMPORTACAO_TELA", "  com ação própria: " + imp.auditado[0].a);

/* ─────────────────────────────────────────────────────────────────────────
   6. O ANEXO NÃO FICA NO DRIVE
   ───────────────────────────────────────────────────────────────────────*/
passo("o temporário é apagado — inclusive quando dá erro");

function abrir(deConversao) {
  let apagou = [];
  const abrirFn = fn(tela, "compassoImp_abrir_", {
    compasso_importarIdDaPlanilha_: v => String(v).replace(/.*\/d\/([^/]+).*/, "$1"),
    compassoImp_extensaoAceita_: fn(tela, "compassoImp_extensaoAceita_", {
      COMPASSO_IMP_EXTENSOES: [".xlsx", ".xls", ".csv", ".ods"] }),
    compassoImp_blobDoBase64_: () => ({}),
    COMPASSO_IMP_EXTENSOES: [".xlsx", ".xls", ".csv", ".ods"],
    Drive: { Files: { insert: () => ({ id: "TMP1" }) } },
    DriveApp: { getFileById: id => ({ setTrashed: () => apagou.push(id) }) },
    SpreadsheetApp: { openById: () => ({
      getSheets: () => [{ getName: () => "Inscritos",
        getDataRange: () => ({ getValues: () => {
          if (deConversao) throw new Error("planilha corrompida");
          return GRID; } }) }],
      getSheetByName: () => null
    }) }
  });
  let erro = null;
  try { abrirFn({ base64: "x", nome: "a.xlsx" }, ""); } catch (e) { erro = e.message; }
  return { apagou, erro };
}

/* MUTAÇÃO 5, os dois lados. */
const bom = abrir(false);
igual(bom.apagou.join(","), "TMP1",
      "no caminho normal o temporário é apagado");
const ruim = abrir(true);
igual(ruim.apagou.join(","), "TMP1",
      "e no caminho de ERRO também — o finally garante",
      "senão cada tentativa frustrada deixa lixo no Drive de quem operou");
ok(!!ruim.erro, "  e o erro sobe para a tela: " + ruim.erro);

/* MUTAÇÃO 8 */
passo("extensões aceitas");
const aceita = fn(tela, "compassoImp_extensaoAceita_", {
  COMPASSO_IMP_EXTENSOES: [".xlsx", ".xls", ".csv", ".ods"] });
[["planilha.xlsx", true], ["dados.csv", true], ["antiga.ods", true],
 ["foto.png", false], ["texto.pdf", false], ["semextensao", false]].forEach(([n, esp]) => {
  igual(aceita(n), esp, n + " → " + (esp ? "aceita" : "recusa"));
});

/* ─────────────────────────────────────────────────────────────────────────
   7. A COSTURA — tela, rota e botão
   ───────────────────────────────────────────────────────────────────────*/
passo("a tela está ligada");

ok(/painel === "compasso-importar"/.test(code),
   "a rota ?painel=compasso-importar existe em Code.gs");
ok(/exigirModulo_\(tokenImp, "eventos", true\)/.test(code),
   "e exige ADMINISTRADOR do módulo Eventos, não só sessão");
/* O CAMINHO MUDOU DE LUGAR EM 24/08/2026, e é isto que a asserção guarda.
   Antes a tela de Eventos tinha um card próprio chamando
   evAbrirPainel('compasso-importar'). O usuário pediu "tudo num único lugar",
   e a importação virou uma ABA da Central de Inscrições — que a carrega num
   quadro apontando para a mesma rota. A rota continua sendo a única porta;
   quem mudou foi quem a abre. */
const painel = ler("CompassoInscricoes.html");
ok(!/evAbrirPainel\('compasso-importar'\)/.test(admin),
   "a tela de Eventos não tem mais um caminho separado para a importação");
ok(/painel=compasso-importar/.test(painel),
   "quem abre a rota agora é a Central de Inscrições");
/* DEIXOU DE SER ABA EM 26/08/2026. A tela de Eventos já abre esta Central na
   tela "Inscrições" do submódulo Festa; a aba interna com o mesmo nome deixava
   duas "Inscrições" uma dentro da outra. Importar não é um ESTADO da lista, é
   uma AÇÃO sobre ela — então virou botão. O que esta guarda cobra continua o
   mesmo: que exista um caminho único para a importação, dentro da Central. */
/* O BOTÃO ABRE O SELETOR, NÃO UMA TELA — 26/08/2026. O usuário: "não
   precisaria de outra tela, só deveria abrir para anexar um arquivo". A
   conferência só aparece quando já existe planilha para conferir. */
ok(/id="btAbaImportar"/.test(painel) && /impEscolherArquivo/.test(painel),
   "  por um botão que abre o seletor de arquivo");
ok(/include\('CompassoImportacao'\)/.test(painel),
   "  e a importação vem INCLUÍDA na Central, não num quadro",
   "as duas telas têm funções globais de mesmo nome (api, esc, g, aviso): " +
   "juntar os arquivos num escopo só derrubaria o JavaScript da página");

const html = ler("CompassoImportacao.html");
ok(/compassoImp_conferir/.test(html) && /compassoImp_importar/.test(html),
   "a tela chama as duas funções do backend");
ok(/readAsDataURL/.test(html),
   "e envia o anexo pelo mesmo padrão das outras telas do projeto");

/* A TELA PRECISA HERDAR O DESIGN SYSTEM — e isso depende da ROTA.
 *
 * 21/08/2026: o usuário abriu a importação e disse "a tela está fora do padrão
 * do SISGEP". Ela usa include('OficiosStyles') para herdar os tokens, e a rota
 * servia com `createHtmlOutputFromFile`, que NÃO avalia scriptlet — o include
 * simplesmente não acontecia, e a página saía sem estilo nenhum.
 *
 * É a única tela do projeto que usa include; as outras trazem o CSS inline.
 * Por isso o defeito não existia antes e ninguém tinha esbarrado nele. */
/* O include de OficiosStyles saiu quando a tela virou fragmento incluído
   dentro da Central — o design system já está na página, e trazer de novo
   duplicaria a folha e o toast(). Quem serve a rota avulsa é o Code.gs. */
ok(/#compassoImportacao/.test(html),
   "o CSS da tela é escopado, para não vazar sobre quem a inclui");
/* A ROTA PASSOU A MONTAR OS DOIS — 26/08/2026. A tela virou fragmento para
   poder ser incluída dentro da Central, e fragmento não traz o design system
   por conta própria (dentro da Central ele já está na página, e incluir de
   novo duplicaria a folha e o toast()). Então quem serve a rota avulsa junta
   OficiosStyles + a tela. O que a guarda protege continua o mesmo: avaliação
   por template, porque createHtmlOutputFromFile não avalia scriptlet e a
   página sairia sem estilo. */
ok(/createTemplate\(/.test(code) && /include\('CompassoImportacao'\)/.test(code),
   "e a rota avulsa monta OficiosStyles + a tela, por template",
   "createHtmlOutputFromFile não avalia scriptlet: o include não aconteceria " +
   "e a página sairia sem estilo");
ok(/include\('OficiosStyles'\)[\s\S]{0,80}include\('CompassoImportacao'\)/.test(code),
   "  com o design system ANTES da tela");

/* REMOVER O ARQUIVO — o usuário pediu, e a falta prendia a tela.
 *
 * Sem isso não havia como trocar de planilha nem desfazer: escolhido o
 * primeiro arquivo, a conferência dele ficava na tela para sempre. */
passo("dá para desfazer a escolha");

ok(/function removerArquivo\(\)/.test(html),
   "existe remover arquivo");
ok(/onclick="impRemoverArquivo\(\)"/.test(html),
   "  ligado a um botão visível",
   "os nomes ganharam o prefixo `imp` quando o script virou escopo próprio");

const corpoRemover = (html.match(/function removerArquivo\(\)\{[\s\S]*?\n\}/) ||
                      html.match(/function removerArquivo\(\)\s*\{[\s\S]*?\n\}/) || [""])[0];
["ORIGEM = null", "'e2'", "g('mapa').innerHTML = ''"].forEach(marca => {
  ok(corpoRemover.indexOf(marca) >= 0,
     "  e limpa " + (marca === "ORIGEM = null" ? "a origem" :
                     marca === "'e2'" ? "os passos seguintes" : "a conferência anterior"),
     "deixar a conferência antiga na tela faria a pessoa importar achando que era o novo arquivo");
});

/* DESFAZER NÃO PODE DEPENDER DE ANEXAR A PLANILHA QUE CAUSOU O ERRO.
 *
 * 24/08/2026: o usuário importou 122 linhas com o mapeador antigo e o e-mail
 * entrou no lugar do nome. Para apagar aquilo, a tela exigia anexar uma
 * planilha de novo — porque "Limpar importação" morava no passo 4, que só
 * aparece depois de conferir um arquivo. Ou seja: desfazer o estrago pedia
 * repetir o gesto que o causou.
 *
 * Emitir e apagar falam do que JÁ ESTÁ gravado, não da planilha da vez. */
passo("apagar e emitir não dependem de ter uma planilha anexada");

/* Cada bloco .etapa vai até o começo do próximo — o que estiver dentro de um
   que nasce com a classe `off` está escondido enquanto nada foi conferido. */
const etapas = html.split(/<div class="etapa/).slice(1)
  .map(t => ({ escondida: /^ off"/.test(t) || /^\s+off"/.test(t), corpo: t }));

["impLimpar()", "impEmitir()"].forEach(acao => {
  const donas = etapas.filter(e => e.corpo.indexOf('onclick="' + acao + '"') >= 0);
  ok(donas.length === 1, acao + " aparece em exatamente um bloco");
  ok(donas.length === 1 && !donas[0].escondida,
     "  e esse bloco está sempre visível",
     "dentro de uma etapa `off`, desfazer exigiria anexar planilha antes");
});

ok(/id="limiteEmitir"/.test(html) && /g\('limiteEmitir'\)/.test(html),
   "emitir lê o próprio campo, não o do passo escondido",
   "input escondido ainda devolve valor: emitiria 10 sem a pessoa ter visto o 10");

/* O NEGRITO NO MEIO DA FRASE NÃO PODE QUEBRAR LINHA.
 *
 * 24/08/2026, na tela de Eventos: "…uma prévia / antes / de gravar". A regra
 * era `.ev-acao b{display:block}`, escrita para o TÍTULO do card — mas como
 * seletor de descendente ela alcançava todo <b> dentro da descrição, e cada
 * ênfase no meio do texto virava um parágrafo solto. */
passo("ênfase no meio da frase continua na frase");

ok(!/\.ev-acao\s+b\s*\{/.test(admin) && !/\.ev-acao\s+span\s*\{/.test(admin),
   "o CSS do card não alcança b/span por descendência");
ok(/\.ev-acao \.txt>b\{display:block/.test(admin) &&
   /\.ev-acao \.txt>span\{display:block/.test(admin),
   "  só o título e a descrição, que são filhos diretos, viram bloco");

resumo();
