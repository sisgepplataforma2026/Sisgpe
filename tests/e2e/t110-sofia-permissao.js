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
 * Este teste NÃO propõe a correção. Ele mede o estado de hoje, para que a
 * decisão de corrigir seja tomada sobre fato e não sobre leitura de código.
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
/* ATENÇÃO e não FALHA: o achado é real e está medido, mas trocar o guarda de
   um endpoint é decisão de segurança que precisa de aprovação (REGRA Nº 0.5).
   Vira b.ok() no dia em que exigirModulo_ entrar. */
function relatar(cond, descricao, detalheOk, detalheFalha) {
  if (cond) b.ok(true, descricao, detalheOk);
  else b.aviso(descricao.replace(/^(\S+) barra/, "$1 NÃO barra"), detalheFalha);
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
relatar(
  r1.barrou,
  "confirmarFiliacaoPapelIA barra quem não tem sofia nem sindicalizacao",
  r1.erro,
  "NÃO barrou — passou com sessão de usuário 'financeiro,rh'. Retorno: " +
              JSON.stringify(r1.retorno).slice(0, 160)
);

const dadosDesfiliacao = {
  nome: "Maria Teste da Silva",
  cpf: "11144477735",
  escolaCnpj: "12345678000199",
  escolaEmail: "escola@teste.com"
};

const r2 = barradoPorPermissao(() => g.confirmarDesfiliacaoIA(dadosDesfiliacao, TOKEN_SEM_SOFIA));
relatar(
  r2.barrou,
  "confirmarDesfiliacaoIA barra quem não tem sofia nem sindicalizacao",
  r2.erro,
  "NÃO barrou — desfiliação alcançável por sessão sem o módulo. Retorno: " +
              JSON.stringify(r2.retorno).slice(0, 160)
);

const r3 = barradoPorPermissao(() => g.confirmarOposicaoTaxaNegocialIA(dadosDesfiliacao, TOKEN_SEM_SOFIA));
relatar(
  r3.barrou,
  "confirmarOposicaoTaxaNegocialIA barra quem não tem o módulo",
  r3.erro,
  "NÃO barrou. Retorno: " + JSON.stringify(r3.retorno).slice(0, 160)
);

b.passo("4. o chat também: quem não tem o módulo sofia consegue conversar?");
const r4 = barradoPorPermissao(() => g.chatSISGEP({ mensagem: "teste", dominio: "Geral" }, TOKEN_SEM_SOFIA));
relatar(
  r4.barrou,
  "chatSISGEP barra quem não tem o módulo sofia",
  r4.erro,
  "NÃO barrou. Sem a chave da API a resposta é recusada por outro motivo, " +
              "o que NÃO é controle de acesso: " + JSON.stringify(r4.retorno).slice(0, 120)
);

b.passo("5. a trilha da ação — quem confirmou o quê");
b.naoTestavel(
  "se a confirmação por IA deixa trilha de auditoria própria",
  "as três funções não gravam em aba de auditoria; o rastro que existe é a coluna " +
  "ORIGEM='PAPEL_IA' na própria ficha, que diz COMO entrou mas não QUEM confirmou " +
  "nem QUANDO. Precisa de decisão de produto antes de virar asserção."
);

b.resumo();
