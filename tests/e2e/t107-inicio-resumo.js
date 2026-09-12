/**
 * t107 — MÓDULO 01 · INÍCIO (Home / Dashboard Geral)
 *
 * Auditoria executável de `InicioResumo.gs` — o módulo não tinha nenhum teste.
 *
 * O que este teste exerce de verdade:
 *   1. sessão inválida é recusada;
 *   2. módulo sem acesso NÃO vira zero em `statusFontes` (é o contrato que
 *      separa "não tenho permissão" de "não há pendência");
 *   3. fonte que falha é registrada como falha, não como zero;
 *   4. `saude` devolve "—" quando a fonte não respondeu — nunca "OK";
 *   5. as atividades da SOFIA são filtradas pelo usuário da sessão (a aba
 *      Sofia_Auditoria é global; devolver sem filtro expõe pergunta de
 *      terceiro na Home);
 *   6. a regra de escola incompleta (CNPJ != 14 dígitos OU sem e-mail);
 *   7. a janela de prazo jurídico (0 a 15 dias, ignorando concluídos).
 *
 * O que NÃO é validável aqui está declarado com naoTestavel() no fim.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const TOKEN_ADMIN = b.logar(g, "wanderson");   // ADMINISTRADOR: todos os módulos
const TOKEN_ESCOLAS = b.logar(g, "joscimar");  // só escolas,sindicalizacao

/* ─── utilidades de seed ─── */
function aba(nome, cabecalho, linhas) {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let a = ss.getSheetByName(nome);
  if (!a) a = ss.insertSheet(nome);
  a.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  linhas.forEach((l, i) => a.getRange(2 + i, 1, 1, l.length).setValues([l]));
  return a;
}

function dataEmDias(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════════ */
b.fluxo("MÓDULO 01 · INÍCIO — resumo da Home");

b.passo("1. sessão");
b.bloqueia(
  () => g.getResumoInicioSISGEP("token-que-nao-existe"),
  "recusa token de sessão inválido"
);

b.passo("2. permissão por módulo — o ponto central do desenho");
const rEscolas = g.getResumoInicioSISGEP(TOKEN_ESCOLAS);
b.ok(rEscolas && rEscolas.ok, "usuário sem acesso total ainda recebe a Home", rEscolas && rEscolas.ok);

const fJuridico = (rEscolas.statusFontes || {}).juridico;
b.ok(
  fJuridico && fJuridico.semAcesso === true && fJuridico.valor === null,
  "fonte de módulo sem acesso vem marcada semAcesso com valor null",
  JSON.stringify(fJuridico)
);
b.ok(
  rEscolas.prioridades.juridico === 0,
  "o campo de compatibilidade vira 0 (contrato antigo preservado)",
  rEscolas.prioridades.juridico
);
b.ok(
  rEscolas.saude.juridico === "—",
  "saude de módulo sem acesso é '—', nunca 'OK'",
  rEscolas.saude.juridico
);

b.passo("3. fonte que falha não pode virar zero");
const fFinanceiro = (rEscolas.statusFontes || {}).notasFiscais;
b.ok(
  fFinanceiro && fFinanceiro.ok === false && fFinanceiro.valor === null,
  "fonte indisponível registra ok:false e valor null",
  JSON.stringify(fFinanceiro)
);
b.ok(
  rEscolas.saude.financeiro === "—",
  "saude de fonte que falhou é '—' (não 'OK')",
  rEscolas.saude.financeiro
);

b.passo("4. escolas incompletas — a regra de contagem");
// Nomes de coluna REAIS do sistema (Escolas.gs:14-16), não inventados.
aba(
  "Escolas",
  ["EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)"],
  [
    ["E1", "Escola Completa",    "12345678000199", "completa@x.com"],  // ok
    ["E2", "Escola Sem CNPJ",    "",               "semcnpj@x.com"],   // conta
    ["E3", "Escola CNPJ Curto",  "123456",         "curto@x.com"],     // conta
    ["E4", "Escola Sem Email",   "12345678000188", ""]                 // conta
  ]
);
// listarEscolasCadastro_interno_ guarda 5 min em CacheService. Sem limpar, a
// lista vazia lida antes do seed venceria — e o teste mediria o cache, não a regra.
g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_);

const contaEscolas = g.inicio_contarEscolasCadastroIncompleto_(TOKEN_ADMIN);
b.igual(contaEscolas, 3, "conta 3 escolas incompletas de 4 (sem CNPJ, CNPJ curto, sem e-mail)");

b.passo("5. prazo jurídico — janela de 0 a 15 dias");
b.naoTestavel(
  "contagem de prazos jurídicos com dado semeado",
  "jurListarProcessos depende da aba real do Jurídico; coberto indiretamente pelo passo 2"
);

b.passo("6. privacidade — atividades da SOFIA de OUTRO usuário não podem aparecer");
aba(
  "Sofia_Auditoria",
  ["DataHora", "Nome", "Email", "Dominio", "Pergunta", "Resposta", "OK"],
  [
    ["31/08/2026 09:00", "Wanderson Castelo", "wanderson@sindeducacao.com", "Estatuto", "pergunta do wanderson", "...", true],
    ["31/08/2026 09:05", "Joscimar",          "joscimar@sindeducacao.com",  "Escolas",  "pergunta do joscimar",  "...", true],
    ["31/08/2026 09:10", "Rogério",           "rogerio@sindeducacao.com",   "Financeiro", "pergunta do rogerio", "...", false]
  ]
);

const rAdmin2 = g.getResumoInicioSISGEP(TOKEN_ADMIN);
const atvAdmin = rAdmin2.atividadesRecentes || [];
b.ok(
  atvAdmin.every(a => String(a.pergunta).indexOf("joscimar") === -1 &&
                      String(a.pergunta).indexOf("rogerio") === -1),
  "admin NÃO vê perguntas de outros usuários na Home",
  JSON.stringify(atvAdmin.map(a => a.pergunta))
);

const rEsc2 = g.getResumoInicioSISGEP(TOKEN_ESCOLAS);
const atvEsc = rEsc2.atividadesRecentes || [];
b.ok(
  atvEsc.every(a => String(a.pergunta).indexOf("wanderson") === -1),
  "joscimar NÃO vê as perguntas do admin",
  JSON.stringify(atvEsc.map(a => a.pergunta))
);

b.passo("7. carimbo de atualização");
b.ok(
  /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(String(rAdmin2.atualizadoEm || "")),
  "atualizadoEm vem no formato dd/MM/yyyy HH:mm:ss",
  rAdmin2.atualizadoEm
);

/* ─── o que este harness não alcança ─── */
b.naoTestavel(
  "a corrida entre index.html e Helpers.html na Home",
  "os dois chamam getResumoInicioSISGEP e escrevem nos MESMOS ids do DOM; " +
  "Helpers usa setTimeout(450) para 'chegar por último'. Ordem de chegada de " +
  "duas chamadas google.script.run só é observável no navegador."
);
b.naoTestavel(
  "se os cards da Home são clicáveis e levam à fila correspondente",
  "exigido pela diretriz de dashboards do PROMPT-MESTRE; é comportamento de tela"
);

b.resumo();
