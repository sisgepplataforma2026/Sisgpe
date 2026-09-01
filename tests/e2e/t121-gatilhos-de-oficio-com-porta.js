/**
 * t121 — MÓDULO 03 · OS GATILHOS QUE QUALQUER UM PODIA DESLIGAR
 *
 * Frente A da auditoria do Módulo 03, 01/09/2026. Segundo achado, e este é de
 * segurança.
 *
 * COMO APARECEU
 *
 * Cruzando as 59 funções públicas do módulo com as que ESCREVEM estado, treze
 * escreviam sem porta de permissão. A maioria com razão — gatilho roda sem
 * usuário, e exigir sessão ali quebraria a própria rotina.
 *
 * Mas quatro não tinham desculpa: `instalarTriggerConfirmacoes`,
 * `removerTriggerConfirmacoes`, `instalarTriggerFalhasEntrega` e
 * `removerTriggerFalhasEntrega` criavam e APAGAVAM gatilho sem pedir nada — e
 * sem sequer receber um token. Mais uma no OficiosDiagnostico.gs.
 *
 * POR QUE ISSO É GRAVE
 *
 * No Apps Script não existe rota para `google.script.run`: toda função global
 * é endpoint para QUALQUER página do projeto, inclusive as anônimas que o
 * `Code.gs` serve. Um visitante qualquer chamava `removerTriggerConfirmacoes()`
 * e desligava, em silêncio, a verificação de confirmação de recebimento e a de
 * falha de entrega.
 *
 * E desligar não dá erro nenhum. As confirmações apenas param de ser
 * registradas; as falhas param de ser detectadas. Ninguém liga uma coisa à
 * outra — é o sintoma que o CLAUDE.md descreve como o pior deste projeto.
 *
 * PIOROU COM A CORREÇÃO DE HOJE, e vale registrar a ironia: o `FALHA_ENTREGA`
 * passou a aparecer na Home (t118). Quem marca esse status é o
 * `verificarFalhasEntregaOficios`. Sem o gatilho, o indicador novo fica em
 * zero afirmando que está tudo bem.
 *
 * A CORREÇÃO NÃO É PADRÃO NOVO
 *
 * É o padrão da casa, que estas cinco não tinham. O
 * `instalarTriggerFilaEnvioOficios` (`FilaOficios.gs:802`), no MESMO módulo, já
 * usava `exigirAdminOuSessao_` com o mesmo rótulo e o mesmo `true`. Não se
 * inventou nada: copiou-se o vizinho.
 *
 * A porta é DUPLA de propósito — aceita o token do SISGEP e também a conta
 * Google do dono, porque estas funções são rodadas do editor, onde não há
 * token. Sem a segunda metade, a correção quebraria o único jeito de
 * instalá-las, e o teste cobra as duas.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADMIN    = b.logar(g, "wanderson");   // todos os módulos
const SEM_DOCS = b.logar(g, "rogerio");     // financeiro,rh

const AS_CINCO = [
  "instalarTriggerConfirmacoes",
  "removerTriggerConfirmacoes",
  "instalarTriggerFalhasEntrega",
  "removerTriggerFalhasEntrega",
  "instalarTriggerConfirmacoesOficios"
];

function tentar(fn, token) {
  try { g[fn](token); return { passou: true, msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

b.fluxo("MÓDULO 03 · gatilho não se desliga sem permissão");

b.passo("1. ANÔNIMO é recusado nas cinco");
/* É como um visitante do app publicado chega: sem token e sem usuário ativo.
   Antes desta correção, todas as cinco respondiam {ok:true}. */
g.__usuarioAtivoEmail = "";
AS_CINCO.forEach(function (fn) {
  const r = tentar(fn, "");
  b.ok(!r.passou, "anônimo NÃO desliga nem instala: " + fn,
    r.passou ? "PASSOU — endpoint aberto para mexer em gatilho"
             : r.msg.substring(0, 52));
});

b.passo("2. quem tem sessão mas NÃO tem o módulo Documentos também é recusado");
AS_CINCO.forEach(function (fn) {
  const r = tentar(fn, SEM_DOCS);
  b.ok(!r.passou, "perfil 'financeiro,rh' é barrado: " + fn);
});

b.passo("3. O OUTRO LADO — o administrador com sessão continua conseguindo");
/* Sem esta metade, a correção trocaria um buraco de segurança por um módulo
   que ninguém consegue mais configurar. */
AS_CINCO.forEach(function (fn) {
  const r = tentar(fn, ADMIN);
  b.ok(r.passou, "admin com sessão instala/remove: " + fn, r.msg.substring(0, 50));
});

b.passo("4. E A PORTA DUPLA — o dono do projeto, pelo editor, sem token");
/* Estas funções são rodadas do editor, onde não existe token de sessão. Se a
   porta só aceitasse token, a correção quebraria o único jeito de instalar o
   gatilho — e o defeito seria trocado por outro. */
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
AS_CINCO.forEach(function (fn) {
  const r = tentar(fn, "");
  b.ok(r.passou, "o dono roda pelo editor, sem token: " + fn, r.msg.substring(0, 50));
});

b.passo("5. e uma conta Google qualquer, que não é dona, não passa");
g.__usuarioAtivoEmail = "estranho@exemplo.com";
const r5 = tentar("removerTriggerConfirmacoes", "");
b.ok(!r5.passou,
  "conta Google que não é do dono é recusada",
  "estar logado no Google não é ser administrador do SISGEP");

b.passo("6. o padrão é o MESMO do vizinho, não um inventado aqui");
/* Se um dia alguém padronizar as portas do projeto, estas cinco têm de sair
   junto com a da fila, não ficar para trás de novo. */
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const fila = fs.readFileSync(path.join(RAIZ, "FilaOficios.gs"), "utf8");
const mon  = fs.readFileSync(path.join(RAIZ, "MonitoramentoOficios.gs"), "utf8");
b.ok(
  /exigirAdminOuSessao_\(tokenSessao,\s*"documentos"/.test(fila) &&
  /exigirAdminOuSessao_\(tokenSessao,\s*"documentos"/.test(mon),
  "fila e monitoramento usam a mesma chamada, com o mesmo módulo",
  "o padrão já existia em FilaOficios.gs:802 — estas cinco só não tinham"
);

b.passo("7. nenhuma tela chamava essas funções — o parâmetro novo não quebra UI");
/* Elas são de editor. Acrescentar `tokenSessao` seria arriscado se alguma
   tela chamasse sem argumento; nenhuma chama. */
const htmls = fs.readdirSync(RAIZ).filter(f => f.endsWith(".html"));
const chamadas = htmls.filter(function (arq) {
  const src = fs.readFileSync(path.join(RAIZ, arq), "utf8");
  return AS_CINCO.some(fn => src.indexOf(fn) >= 0);
});
b.igual(chamadas.length, 0,
  "nenhum .html chama as cinco",
  chamadas.join(", ") || "só o editor as executa");

b.naoTestavel(
  "o gatilho de fato criado no projeto",
  "ScriptApp.newTrigger é apenas registrado pelo emulador. O que se prova " +
  "aqui é QUEM pode chamar — conferir em Acionadores depois de instalar"
);

b.resumo();
