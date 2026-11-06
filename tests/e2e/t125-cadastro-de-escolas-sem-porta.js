/**
 * t125 — MÓDULO 03 · O CADASTRO DE ESCOLAS ESTAVA ABERTO
 *
 * Frente A da auditoria do Módulo 03, terceira rodada, 01/09/2026.
 *
 * COMO APAREceu: cruzando as 60 funções públicas do módulo com as que
 * devolvem dado pessoal E não têm porta de permissão. Saiu um grupo de nove.
 *
 * A PIOR DELAS
 *
 * `buscarEscolasParaOficio(termo, nomeNaFicha)` — sem token, sem checagem —
 * devolvia, para até 60 escolas por chamada:
 *
 *     razão social · CNPJ · unidade · e-mail principal · e-mails (todos) · cidade
 *
 * Com `termo` vazio vinham as 60 primeiras do cadastro. Variando o termo —
 * "a", "b", "escola" — dá para varrer as 679. No Apps Script não existe rota
 * para `google.script.run`: toda função global é endpoint para QUALQUER página
 * do projeto, inclusive as anônimas que o `Code.gs` serve.
 *
 * Ou seja: o cadastro de escolas do sindicato, com CNPJ e e-mail
 * institucional, era legível sem login.
 *
 * AS OUTRAS OITO seguiam o mesmo padrão em menor escala — filas, painéis e
 * relatórios devolvendo escola, e-mail e o erro de entrega de cada ofício.
 *
 * E UM DEFEITO DE OUTRA NATUREZA, no mesmo lote
 *
 * `getDashboardOficiosDataV2` embrulhava a v1 num try/catch que engolia TUDO —
 * inclusive o erro que a porta lança. Quem estava sem acesso, ou com sessão
 * vencida, recebia um painel de ZEROS em vez de "sessão expirada", e concluía
 * que não havia ofício nenhum.
 *
 * É o mesmo defeito que a Home tinha e que o `t118` fechou: falha virando
 * número, em vez de aviso. Recusa de permissão não é "sem dados".
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const COM_DOCS = b.logar(g, "wanderson");   // todos os módulos
const SEM_DOCS = b.logar(g, "rogerio");     // financeiro,rh

/* A aba de Escolas precisa existir para o passo 3 medir a PORTA, e não a
   ausência de dado: sem ela a função morre em "Aba Escolas não encontrada" e
   o teste passaria a verde por motivo errado. */
(function semearEscolas() {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let sh = ss.getSheetByName("Escolas");
  if (!sh) sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, 8).setValues([["UNIDADE", "ESCOLA (RAZÃO SOCIAL)", "CNPJ",
    "E-MAIL (PRINCIPAL)", "E-MAILS (TODOS)", "X", "Y", "CIDADE"]]);
  sh.getRange(2, 1, 1, 8).setValues([["Sede", "Escola Teste Ltda", "12345678000199",
    "contato@teste.com", "contato@teste.com", "", "", "Vitória"]]);
})();

/* Assinaturas reais: o token é sempre o ÚLTIMO argumento. */
const PORTEIRAS = [
  ["buscarEscolasParaOficio",         (t) => g.buscarEscolasParaOficio("", "", t)],
  ["diagnosticarDeParaEscolas",       (t) => g.diagnosticarDeParaEscolas(t)],
  ["listarEscolasOficios",            (t) => g.listarEscolasOficios(t)],
  ["consultarEscolaDashboardOficios", (t) => g.consultarEscolaDashboardOficios("x", t)],
  ["dashboardFilaEnvioErrosRecentes", (t) => g.dashboardFilaEnvioErrosRecentes(t)],
  ["dashboardFilaPendenciasCriticas", (t) => g.dashboardFilaPendenciasCriticas(t)],
  ["dashboardFilaEnvioResumo",        (t) => g.dashboardFilaEnvioResumo(t)],
  ["dashboardFilaEnvioGraficos",      (t) => g.dashboardFilaEnvioGraficos(t)],
  ["processarFichasParaOficio",       (t) => g.processarFichasParaOficio([], t)]
];

function tentar(fn, token) {
  try { fn(token); return { passou: true, msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

b.fluxo("MÓDULO 03 · o cadastro de escolas não é público");

b.passo("1. ANÔNIMO é recusado nas nove");
/* Antes desta correção, todas as nove respondiam normalmente sem token. */
PORTEIRAS.forEach(function (par) {
  const r = tentar(par[1], "");
  b.ok(!r.passou, "sem sessão é barrado: " + par[0],
    r.passou ? "PASSOU — endpoint aberto devolvendo dado de escola"
             : r.msg.substring(0, 44));
});

b.passo("2. e quem não tem o módulo Documentos também");
PORTEIRAS.forEach(function (par) {
  const r = tentar(par[1], SEM_DOCS);
  b.ok(!r.passou, "perfil 'financeiro,rh' é barrado: " + par[0]);
});

b.passo("3. O OUTRO LADO — quem tem o módulo continua trabalhando");
/* Sem esta metade a correção viraria defeito de utilidade: a tela de fichas
   sindicais precisa buscar escola para vincular o ofício. */
const rBusca = tentar(PORTEIRAS[0][1], COM_DOCS);
b.ok(rBusca.passou, "buscarEscolasParaOficio funciona com sessão de Documentos",
  rBusca.msg.substring(0, 50));

b.passo("4. A TELA PASSOU A MANDAR O TOKEN");
/* A porta sem o chamador atualizado quebraria a tela de fichas sindicais —
   trocaria um buraco de segurança por uma tela morta. */
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const fichas = fs.readFileSync(path.join(RAIZ, "FichasSindicaisAdmin.html"), "utf8");
b.ok(
  /buscarEscolasParaOficio\(termo,\s*FSA_FICHA_ATUAL\.ESCOLA,\s*SISGEP_TOKEN_SESSAO\)/.test(fichas),
  "FichasSindicaisAdmin passa SISGEP_TOKEN_SESSAO",
  "sem isto a busca de escola pararia de responder na tela"
);
const dash = fs.readFileSync(path.join(RAIZ, "Scripts_Dash.html"), "utf8");
b.ok(
  /dashboardFilaEnvioResumo\(SISGEP_TOKEN_SESSAO\)/.test(dash),
  "Scripts_Dash também"
);

b.passo("5. o que a busca devolvia — para o achado não virar abstração");
/* Registrar os campos torna concreto o que estava aberto: não era "dado de
   escola", era o cadastro com CNPJ e e-mail institucional. */
const fonte = String(g.buscarEscolasParaOficio).replace(/\s+/g, " ");
["nome", "cnpj", "emailPrincipal", "emailsTodos", "cidade"].forEach(function (campo) {
  b.ok(fonte.indexOf(campo + ":") >= 0, "devolve o campo " + campo);
});
b.ok(/slice\(0,\s*60\)/.test(fonte),
  "60 por chamada — varrer as 679 era questão de variar o termo");

b.fluxo("MÓDULO 03 · recusa de permissão não é 'sem dados'");

b.passo("6. o V2 deixou de engolir o erro da porta");
/* Quem estava sem acesso recebia painel de ZEROS e concluia que nao havia
   ofício nenhum. É o mesmo defeito que a Home tinha (t118): falha virando
   número em vez de aviso. */
/* MEDIDO SEM TOKEN, e a razão é um achado por si: a porta da v1 é
   `exigirSessaoDocumentos_`, que só confere se a SESSÃO é válida — não checa
   módulo (`Sessao.gs:405`). Então o perfil 'financeiro,rh' passa por ela.
   Quem não passa é quem não tem sessão. Ver a nota do passo 9. */
let barrouV2 = false, msgV2 = "";
try { g.getDashboardOficiosDataV2({}, ""); }
catch (e) { barrouV2 = true; msgV2 = String(e.message || e); }
b.ok(barrouV2,
  "sem sessão, o V2 agora LANÇA em vez de devolver zeros",
  barrouV2 ? msgV2.substring(0, 46) : "devolveu painel vazio — parece 'não há ofícios'");

b.passo("7. mas erro de DADO continua sendo tratado, não propagado");
/* A distinção é o ponto: falha de leitura devolve estrutura vazia e o painel
   sobrevive; falha de PERMISSÃO precisa chegar à pessoa. */
const fonteV2 = String(g.getDashboardOficiosDataV2).replace(/\s+/g, " ");
b.ok(/throw e/.test(fonteV2), "há um re-lançamento condicional");
b.ok(/dadosReais: false/.test(fonteV2),
  "e o caminho de erro de dado continua devolvendo estrutura vazia",
  "painel não pode morrer porque uma aba ficou ilegível");

b.passo("8. quem TEM acesso recebe o painel normalmente");
const okV2 = g.getDashboardOficiosDataV2({}, COM_DOCS);
b.ok(okV2 && typeof okV2 === "object", "o V2 responde para quem pode");

b.passo("9. A PORTA ANTIGA FOI TROCADA — agora checa módulo");
/* `exigirSessaoDocumentos_` (Sessao.gs:405) confere sessão válida e, quando
   pedido, perfil de administrador. NÃO consulta os módulos do usuário. Então
   qualquer pessoa logada — com ou sem o módulo Documentos — enxergava o
   dashboard de ofícios, o histórico e a emissão por chamada direta.

   Na Home isso não aparecia porque o InicioResumo consulta `sessaoPodeModulo_`
   ANTES de chamar a fonte: a proteção estava no CHAMADOR, não na função. Quem
   chamasse direto passava.

   As cinco chamadas do módulo passaram a usar `exigirModulo_`, que é o padrão
   da casa — 398 usos em 78 arquivos. */
[
  ["getDashboardOficiosData",  (t) => g.getDashboardOficiosData({}, t)],
  ["listarHistoricoOficios",   (t) => g.listarHistoricoOficios({}, t)],
  ["previewOficioWeb",         (t) => g.previewOficioWeb({}, t)],
  ["gerarOficioWeb",           (t) => g.gerarOficioWeb({}, t)]
].forEach(function (par) {
  const r = tentar(par[1], SEM_DOCS);
  b.ok(!r.passou,
    "perfil 'financeiro,rh' já NÃO alcança: " + par[0],
    r.passou ? "PASSOU — a porta antiga deixava entrar" : r.msg.substring(0, 42));
});

b.passo("10. e quem TEM o módulo continua entrando");
/* A metade que impede a correção de virar tela morta para quem trabalha. */
const rDash = tentar((t) => g.getDashboardOficiosData({}, t), COM_DOCS);
b.ok(rDash.passou, "o dashboard responde para quem tem Documentos",
  rDash.msg.substring(0, 44));

b.passo("11. a porta antiga saiu do módulo");
const fs2 = require("fs"), path2 = require("path");
["Oficios.gs", "DashboardOficios.gs", "HistoricoOficios.gs",
 "DocumentosSeguranca.gs"].forEach(function (arq) {
  const src = fs2.readFileSync(path2.join(RAIZ, arq), "utf8");
  b.ok(src.indexOf("exigirSessaoDocumentos_(") === -1,
    "sem chamada da porta antiga em " + arq);
});

b.naoTestavel(
  "quantas vezes essas funções foram chamadas sem sessão até hoje",
  "não há registro de chamada por função no Apps Script. O que se sabe é que " +
  "estavam abertas; quanto foram usadas, não"
);

b.resumo();
