/**
 * t110 — MÓDULO 02 · SOFIA · QUEM PODE MANDAR A SOFIA AGIR
 *
 * Auditoria do Módulo 02, 31/08/2026. O que o t38 e o t39 já guardam é a
 * QUALIDADE da resposta — qual documento entra no prompt, e se a tela avisa
 * quando uma citação sai sem fonte. Nenhum dos dois olha PERMISSÃO.
 *
 * E a SOFIA não só responde: ela EXECUTA. Três dos seus endpoints escrevem em
 * cadastro de associado e disparam ofício para a escola:
 *
 *   confirmarFiliacaoPapelIA          grava ficha sindical
 *   confirmarDesfiliacaoIA            desfilia e oficia a escola
 *   confirmarOposicaoTaxaNegocialIA   registra oposição à taxa e oficia
 *
 * O PROMPT-MESTRE é explícito sobre isto: "Nunca executar ação crítica,
 * externa ou irreversível sem autorização e log."
 *
 * O QUE ESTE TESTE MEDE
 *
 * O sistema tem dois guardas, e a diferença entre eles é toda a questão:
 *
 *   exigirSessaoDocumentos_(token, false)   só exige estar LOGADO
 *   exigirModulo_(token, "modulo", false)   exige logado E com o módulo
 *
 * O segundo é o padrão do SISGEP: 398 usos em 78 arquivos, protegendo
 * beneficios, financeiro, documentos, rh, escolas, juridico, sindicalizacao,
 * eventos. O primeiro aparece 45 vezes — e é o que TODOS os endpoints da
 * SOFIA usam. Na lista de módulos protegidos por exigirModulo_, "sofia" não
 * aparece uma única vez.
 *
 * Consequência: a mesma ficha sindical que o módulo Sindicalização protege
 * com exigirModulo_ fica alcançável, pela SOFIA, por qualquer sessão válida.
 * Esconder o botão no menu não é controle de acesso — quem chamar o endpoint
 * direto passa.
 *
 * CORRIGIDO EM 31/08/2026. As três confirmações passaram a exigir o módulo
 * sindicalizacao — que é o dono do dado que elas escrevem. A SOFIA é o
 * caminho por onde se chega, não a autoridade sobre a ficha. Este teste
 * passou de medição a guarda: se alguém afrouxar de novo, ele acusa.
 *
 * O chat (chatSISGEP) também passou a exigir o módulo sofia, em 31/08. Ele lê
 * mensalidades, escolas e painéis de benefícios e devolve isso em texto —
 * qualquer sessão válida conversava, sem nenhum módulo relacionado marcado.
 * O catálogo de acesso tem a chave "sofia" justamente para poder controlar
 * isso; é ela que passou a valer.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

/* rogerio tem "financeiro,rh" — NÃO tem sofia, NÃO tem sindicalizacao.
   É o perfil que torna a pergunta concreta: o financeiro do sindicato
   consegue desfiliar um associado passando pela SOFIA? */
const TOKEN_SEM_SOFIA = b.logar(g, "rogerio");
const TOKEN_ADMIN = b.logar(g, "wanderson");

/* ─── utilidades ─── */
function aba(nome, cabecalho, linhas) {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let a = ss.getSheetByName(nome);
  if (!a) a = ss.insertSheet(nome);
  a.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  (linhas || []).forEach((l, i) => a.getRange(2 + i, 1, 1, l.length).setValues([l]));
  return a;
}

/** Roda fn e diz se ela foi barrada por PERMISSÃO (e não por outro motivo). */
/* As três confirmações foram corrigidas em 31/08/2026 e agora exigem
   sindicalizacao — aqui são asserção firme, para que ninguém as afrouxe sem
   o teste acusar. O chat segue como AVISO: exigir o módulo sofia nele é
   decisão de produto ainda em aberto, não defeito. */
function relatar(cond, descricao, detalheOk, detalheFalha) {
  if (cond) b.ok(true, descricao, detalheOk);
  else b.aviso(descricao.replace(/^(\S+) barra/, "$1 NÃO barra"), detalheFalha);
}

function exigir(cond, descricao, detalheOk, detalheFalha) {
  b.ok(cond, descricao, cond ? detalheOk : detalheFalha);
}

function barradoPorPermissao(fn) {
  try {
    const r = fn();
    // Recusa por validação de dado NÃO é recusa por permissão.
    return { barrou: false, retorno: r };
  } catch (e) {
    const msg = String(e && e.message || e);
    return { barrou: /não tem acesso ao módulo|somente para administradores/i.test(msg), erro: msg };
  }
}

b.fluxo("MÓDULO 02 · SOFIA — permissão nos endpoints que EXECUTAM");

b.passo("1. o guarda de módulo existe e funciona (base de comparação)");
b.bloqueia(
  () => g.exigirModulo_(TOKEN_SEM_SOFIA, "sindicalizacao", false),
  "exigirModulo_ barra quem não tem o módulo sindicalizacao"
);
b.ok(
  !!g.exigirModulo_(TOKEN_SEM_SOFIA, "financeiro", false),
  "e deixa passar quem tem — o guarda funciona, não está quebrado"
);

b.passo("2. sessão inválida é recusada em todos os três (isto funciona)");
["confirmarFiliacaoPapelIA", "confirmarDesfiliacaoIA", "confirmarOposicaoTaxaNegocialIA"]
  .forEach(function (fn) {
    b.bloqueia(() => g[fn]({}, "token-que-nao-existe"), fn + " recusa token inválido");
  });

b.passo("3. usuário SEM o módulo — a pergunta da auditoria");
aba("Escolas",
  ["EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)"],
  [["E1", "Escola Teste", "12345678000199", "escola@teste.com"]]);

const dadosFiliacao = {
  confirmadoPeloAtendente: true,
  nome: "Maria Teste da Silva",
  cpf: "11144477735",           // CPF matematicamente válido
  escola: "Escola Teste",
  tipo: "CADASTRAMENTO"
};

const r1 = barradoPorPermissao(() => g.confirmarFiliacaoPapelIA(dadosFiliacao, TOKEN_SEM_SOFIA));
exigir(
  r1.barrou,
  "confirmarFiliacaoPapelIA barra quem não tem sofia nem sindicalizacao",
  r1.erro,
  "NÃO barrou — passou com sessão de usuário 'financeiro,rh'. Retorno: " +
              JSON.stringify(r1.retorno || null).slice(0, 160)
);

const dadosDesfiliacao = {
  nome: "Maria Teste da Silva",
  cpf: "11144477735",
  escolaCnpj: "12345678000199",
  escolaEmail: "escola@teste.com"
};

const r2 = barradoPorPermissao(() => g.confirmarDesfiliacaoIA(dadosDesfiliacao, TOKEN_SEM_SOFIA));
exigir(
  r2.barrou,
  "confirmarDesfiliacaoIA barra quem não tem sofia nem sindicalizacao",
  r2.erro,
  "NÃO barrou — desfiliação alcançável por sessão sem o módulo. Retorno: " +
              JSON.stringify(r2.retorno || null).slice(0, 160)
);

const r3 = barradoPorPermissao(() => g.confirmarOposicaoTaxaNegocialIA(dadosDesfiliacao, TOKEN_SEM_SOFIA));
exigir(
  r3.barrou,
  "confirmarOposicaoTaxaNegocialIA barra quem não tem o módulo",
  r3.erro,
  "NÃO barrou. Retorno: " + JSON.stringify(r3.retorno || null).slice(0, 160)
);

b.passo("3b. E QUEM TEM o módulo continua passando?");
/* A metade que importa tanto quanto a outra. Apertar o guarda é fácil; apertar
   sem trancar a porta de quem devia entrar é o trabalho. joscimar tem
   "escolas,sindicalizacao" — é exatamente o perfil que USA estas telas. */
const TOKEN_COM_SIND = b.logar(g, "joscimar");

[["confirmarFiliacaoPapelIA", dadosFiliacao],
 ["confirmarDesfiliacaoIA", dadosDesfiliacao],
 ["confirmarOposicaoTaxaNegocialIA", dadosDesfiliacao]].forEach(function (par) {
  const r = barradoPorPermissao(() => g[par[0]](par[1], TOKEN_COM_SIND));
  b.ok(
    !r.barrou,
    par[0] + " NÃO barra quem tem sindicalizacao",
    r.barrou ? "TRANCOU quem devia entrar: " + r.erro
             : "passou do guarda (parou depois, por dado/ambiente, o que é esperado aqui)"
  );
});

b.passo("4. o chat também: quem não tem o módulo sofia consegue conversar?");
const r4 = barradoPorPermissao(() => g.chatSISGEP({ mensagem: "teste", dominio: "Geral" }, TOKEN_SEM_SOFIA));
exigir(
  r4.barrou,
  "chatSISGEP barra quem não tem o módulo sofia",
  r4.erro,
  "NÃO barrou. Sem a chave da API a resposta é recusada por outro motivo, " +
              "o que NÃO é controle de acesso: " + JSON.stringify(r4.retorno || null).slice(0, 120)
);

b.passo("5. a trilha da ação — quem confirmou o quê, e quando");
/* Corrigido em 31/08/2026. Antes, as três não gravavam nada: o rastro era a
   coluna ORIGEM='PAPEL_IA' na ficha, que diz COMO o registro entrou, não QUEM
   confirmou. Desfiliação afeta o vínculo sindical de uma pessoa — se ela
   questionar meses depois, é preciso poder responder.

   A trilha reaproveita registrarAuditoriaSofia_ e a aba Sofia_Auditoria que o
   chat já alimenta: mesma aba, mesmo formato, mesma tela de consulta. */
b.ok(
  typeof g.docIA_registrarConfirmacao_ === "function",
  "existe a função de trilha das confirmações"
);

/* Exercita a trilha direto, com a sessão de quem TEM o módulo: o que se prova
   aqui é que a linha é gravada com identidade e hora — não o fluxo inteiro de
   desfiliação, que depende de Drive e e-mail e não roda no emulador. */
const sessaoJos = g.exigirModulo_(TOKEN_COM_SIND, "sindicalizacao", false);
g.docIA_registrarConfirmacao_(sessaoJos, "Desfiliação",
  "MARIA TESTE DA SILVA · Escola Teste", "Ofício OF-2026-000999", true);

const abaTrilha = g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("Sofia_Auditoria");
b.ok(!!abaTrilha && abaTrilha.getLastRow() >= 2, "a linha foi gravada em Sofia_Auditoria");

const linha = abaTrilha.getRange(abaTrilha.getLastRow(), 1, 1, 7).getValues()[0];
b.ok(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(String(linha[0])),
  "com data e hora", String(linha[0]));
b.ok(String(linha[2]).indexOf("joscimar") >= 0,
  "e com o e-mail de QUEM confirmou", String(linha[2]));
b.ok(String(linha[3]).indexOf("Desfiliação") >= 0,
  "dizendo qual ação foi", String(linha[3]));
b.ok(String(linha[4]).indexOf("MARIA TESTE") >= 0,
  "e sobre quem", String(linha[4]));

/* A trilha fica na mesma aba que a Home lê, filtrada por identidade — então a
   confirmação aparece para quem a fez, e não para os outros. */
b.ok(
  String(linha[1] || linha[2]).length > 0,
  "identificada, não anônima"
);

b.naoTestavel(
  "se a trilha grava no fluxo completo de desfiliação",
  "o caminho inteiro passa por Drive e e-mail, que o emulador só registra. " +
  "A chamada está no ponto de sucesso das três funções; conferir em homologação"
);

b.resumo();
