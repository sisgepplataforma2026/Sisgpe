/**
 * t112 — MÓDULO 02 · SOFIA · O CONTEXTO RESPEITA O QUE A SESSÃO PODE VER
 *
 * Auditoria do Módulo 02, 31/08/2026, último achado da série.
 *
 * O t110 fechou a porta da frente: o chat passou a exigir o módulo "sofia".
 * Mas quem entrava por ela via TUDO. `coletarContextoSISGEP_` montava, para
 * qualquer sessão, dados de mensalidades, escolas, benefícios e e-mails
 * institucionais — e devolvia isso em texto pela resposta da IA.
 *
 * Quem tivesse "escolas,sofia" perguntava "como está a Escola X?" e recebia,
 * junto, nome e situação de mensalidade das pessoas daquela escola. Status de
 * mensalidade inclui DESFILIADO: é filiação sindical de pessoa identificada,
 * dado sensível pela LGPD art. 5º, II. A permissão de módulo existia e não
 * era consultada.
 *
 * A CORREÇÃO segue o precedente da própria casa. O InicioResumo.gs já faz
 * exatamente isto na Home: cada card consulta `sessaoPodeModulo_` antes de
 * pedir a fonte. Não é portão único na entrada — é permissão POR FONTE:
 *
 *   mensalidades            → financeiro
 *   escolas                 → escolas
 *   parque china / voucher  → beneficios
 *   e-mails institucionais  → comunicacao
 *
 * E sessão ausente fecha tudo. A função é privada e só o chatSISGEP a chama
 * em produção, sempre com sessão; um chamador novo que esqueça de passá-la
 * recebe contexto vazio em vez de contexto completo. É o erro seguro.
 *
 * ESTE TESTE COBRA OS DOIS LADOS, como todos os desta auditoria: quem não
 * pode não vê, e quem pode continua vendo. Fechar sem a segunda metade seria
 * trocar um defeito de exposição por um de utilidade.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const SESSAO_ADMIN = g.getSessaoUsuario(b.logar(g, "wanderson"));   // todos os módulos
const SESSAO_ESCOLAS = g.getSessaoUsuario(b.logar(g, "joscimar"));  // escolas,sindicalizacao
const SESSAO_FIN = g.getSessaoUsuario(b.logar(g, "rogerio"));       // financeiro,rh

const NOME = "JOANA PEREIRA DOS SANTOS";
const ESCOLA = "Escola Municipal Teste";

(function seed() {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let m = ss.getSheetByName(g.ABA_MENSALIDADE);
  if (!m) m = ss.insertSheet(g.ABA_MENSALIDADE);
  m.getRange(1, 1, 1, 9).setValues([["NOME", "CPF", "ESCOLA", "FILIADO",
    "NUMERO_OFICIO", "DATA_OFICIO", "STATUS", "DATA_ULTIMA_COB", "OBSERVACOES"]]);
  m.getRange(2, 1, 1, 9).setValues([[NOME, "529.982.247-25", ESCOLA, "S",
    "OF-2026-000123", "10/08/2026", "DESFILIADO", "", ""]]);

  let e = ss.getSheetByName("Escolas");
  if (!e) e = ss.insertSheet("Escolas");
  e.getRange(1, 1, 1, 4).setValues([["EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)"]]);
  e.getRange(2, 1, 1, 4).setValues([["E1", ESCOLA, "12345678000199", "escola@teste.com"]]);
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (x) {}
})();

const PERGUNTA = "buscar joana pereira";
const montar = sessao =>
  g.montarSystemPrompt_(g.coletarContextoSISGEP_(PERGUNTA, "Geral", sessao), PERGUNTA);

b.fluxo("MÓDULO 02 · SOFIA — o contexto respeita a permissão de módulo");

b.passo("1. quem PODE ver o Financeiro continua vendo");
/* A metade que impede a correção de virar defeito de utilidade. */
const pAdmin = montar(SESSAO_ADMIN);
b.ok(pAdmin.indexOf(NOME) >= 0,
  "admin recebe o nome da pessoa no contexto", "encontrado");

const pFin = montar(SESSAO_FIN);
b.ok(pFin.indexOf(NOME) >= 0,
  "quem tem financeiro também recebe", "perfil 'financeiro,rh'");

b.passo("2. quem NÃO tem Financeiro não recebe dado de mensalidade");
const pEsc = montar(SESSAO_ESCOLAS);
b.ok(
  pEsc.indexOf(NOME) === -1,
  "perfil 'escolas,sindicalizacao' NÃO recebe nome de pessoa por mensalidade",
  pEsc.indexOf(NOME) >= 0
    ? "VAZOU: o nome apareceu no prompt de quem não tem o módulo financeiro"
    : "contido"
);
/* Cuidado com o alvo: a palavra "DESFILIADO" também aparece no texto ESTÁTICO
   das regras do prompt (a lista de status possíveis, ChatIACore.gs:1148).
   Procurar por ela dá falso positivo. O marcador do dado é o cabeçalho do
   bloco de busca, que só existe quando alguém foi encontrado. */
b.ok(
  pEsc.indexOf("BUSCA POR") === -1,
  "nem o bloco de busca por pessoa — é ele que carrega nome e status juntos",
  pEsc.indexOf("BUSCA POR") >= 0 ? "VAZOU o bloco de busca" : "contido"
);

b.passo("3. a IA é AVISADA de que não consultou, em vez de achar que é zero");
/* Silêncio faria a SOFIA responder "não há pendências" com a mesma confiança
   de sempre. O aviso a instrui a não afirmar nada sobre pagamento — mesma
   distinção entre "zero" e "não consultei" que o Módulo 01 preserva na Home. */
const ctxEsc = g.coletarContextoSISGEP_(PERGUNTA, "Geral", SESSAO_ESCOLAS);
b.ok(
  !!(ctxEsc.dados && ctxEsc.dados.avisoSemFinanceiro),
  "o contexto registra que o Financeiro não foi consultado",
  (ctxEsc.dados && ctxEsc.dados.avisoSemFinanceiro || "").substring(0, 80)
);

b.passo("4. sessão ausente fecha tudo — o erro seguro");
const pSemSessao = montar(null);
b.ok(
  pSemSessao.indexOf(NOME) === -1,
  "sem sessão, nenhum dado de pessoa entra no contexto",
  "um chamador novo que esqueça a sessão recebe contexto vazio, não completo"
);

b.passo("5. escolas seguem a mesma regra");
/* Aqui a asserção é sobre o CONTEXTO e não sobre o prompt: o cadastro de
   escolas só vira texto quando a pergunta menciona uma escola, então medir
   pelo prompt daria falso negativo numa pergunta sobre pessoa. */
const ctxComEscolas = g.coletarContextoSISGEP_(PERGUNTA, "Geral", SESSAO_ESCOLAS);
const ctxSemEscolas = g.coletarContextoSISGEP_(PERGUNTA, "Geral", SESSAO_FIN);

b.ok(
  Number(ctxComEscolas.dados.totalEscolas || 0) > 0,
  "quem tem o módulo escolas recebe o cadastro de escolas",
  ctxComEscolas.dados.totalEscolas + " escola(s)"
);
b.ok(
  Number(ctxSemEscolas.dados.totalEscolas || 0) === 0,
  "quem não tem escolas recebe o cadastro vazio",
  "perfil 'financeiro,rh' → " + (ctxSemEscolas.dados.totalEscolas || 0)
);

b.naoTestavel(
  "o que a IA de fato responde com o contexto reduzido",
  "o emulador não chama a Anthropic. O que se prova aqui é o PROMPT — que é " +
  "o que ela receberia"
);

b.resumo();
